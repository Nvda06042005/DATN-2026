"""Băm mật khẩu, ký token đăng nhập và sinh tài khoản – chỉ dùng thư viện chuẩn Python."""
import base64
import hashlib
import hmac
import json
import logging
import secrets
import time
import unicodedata

from app.config import settings

logger = logging.getLogger(__name__)

_PBKDF2_ITERATIONS = 240_000

if settings.AUTH_SECRET_KEY:
    _SECRET = settings.AUTH_SECRET_KEY.encode("utf-8")
else:
    # Không cấu hình khóa: sinh khóa ngẫu nhiên mỗi lần khởi động (mọi phiên đăng nhập mất hiệu lực khi restart).
    _SECRET = secrets.token_bytes(32)
    logger.warning("AUTH_SECRET_KEY chưa được cấu hình – dùng khóa tạm thời, người dùng sẽ phải đăng nhập lại sau mỗi lần khởi động server.")


def _b64e(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64d(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


# ---------------------------------------------------------------------------
# Mật khẩu
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, _PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${_PBKDF2_ITERATIONS}${_b64e(salt)}${_b64e(digest)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, iterations, salt, digest = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        candidate = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), _b64d(salt), int(iterations))
        return hmac.compare_digest(candidate, _b64d(digest))
    except (ValueError, TypeError):
        return False


def password_fingerprint(password_hash: str) -> str:
    """Dấu vân tay của mật khẩu hiện tại – đổi/đặt lại mật khẩu thì token cũ tự mất hiệu lực."""
    return hashlib.sha256(password_hash.encode("utf-8")).hexdigest()[:16]


# ---------------------------------------------------------------------------
# Token đăng nhập (HMAC-SHA256)
# ---------------------------------------------------------------------------
def create_token(user_id: int, role: str, password_hash: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "pfp": password_fingerprint(password_hash),
        "exp": int(time.time()) + settings.TOKEN_TTL_HOURS * 3600,
    }
    body = _b64e(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signature = _b64e(hmac.new(_SECRET, body.encode("ascii"), hashlib.sha256).digest())
    return f"{body}.{signature}"


def decode_token(token: str) -> dict | None:
    try:
        body, signature = token.split(".")
        expected = _b64e(hmac.new(_SECRET, body.encode("ascii"), hashlib.sha256).digest())
        if not hmac.compare_digest(signature, expected):
            return None
        payload = json.loads(_b64d(body))
        if int(payload.get("exp", 0)) < time.time():
            return None
        return payload
    except (ValueError, TypeError, json.JSONDecodeError):
        return None


# ---------------------------------------------------------------------------
# Sinh mật khẩu tạm & tên đăng nhập
# ---------------------------------------------------------------------------
_PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"  # bỏ ký tự dễ nhầm: i, l, o, 0, 1


def generate_password() -> str:
    """Mật khẩu tạm dễ đọc cho học sinh, ví dụ: k7m3-px9q."""
    chars = [secrets.choice(_PASSWORD_ALPHABET) for _ in range(8)]
    return "".join(chars[:4]) + "-" + "".join(chars[4:])


def _ascii_slug(text: str) -> str:
    text = text.replace("đ", "d").replace("Đ", "D")
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return "".join(c for c in text.lower() if c.isalnum() or c == " ").strip()


def base_username(full_name: str, role: str) -> str:
    """"Nguyễn Văn Long" -> học sinh: long.nv, giáo viên: gv.long.nv"""
    parts = _ascii_slug(full_name).split()
    if not parts:
        base = "user"
    elif len(parts) == 1:
        base = parts[0]
    else:
        base = parts[-1] + "." + "".join(p[0] for p in parts[:-1])
    base = base[:24]
    return f"gv.{base}" if role == "teacher" else base
