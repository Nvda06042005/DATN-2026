"""Đăng nhập & quản trị tài khoản.

- /api/auth/*  : đăng nhập, xem phiên hiện tại, đổi mật khẩu (mọi vai trò)
- /api/admin/* : chỉ quản trị viên – cấp tài khoản giáo viên/học sinh, xem toàn bộ người dùng
"""
import logging
import time
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from app.core.security import create_token, decode_token, generate_password, hash_password, password_fingerprint, verify_password
from app.core import progress as prog
from database.user_store import DuplicateUsername, store

logger = logging.getLogger(__name__)

auth_router = APIRouter(prefix="/auth", tags=["Auth"])
admin_router = APIRouter(prefix="/admin", tags=["Admin"])

Role = Literal["admin", "teacher", "student"]
ManagedRole = Literal["teacher", "student"]

USERNAME_PATTERN = r"^[a-z0-9._-]{3,32}$"


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class UserOut(BaseModel):
    id: int
    username: str
    full_name: str
    role: Role
    class_name: Optional[str] = None
    must_change_password: bool
    is_active: bool
    created_at: str
    last_login_at: Optional[str] = None


def to_out(user: dict) -> UserOut:
    return UserOut(**{k: v for k, v in user.items() if k != "password_hash"})


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=1, max_length=128)
    # Trang đăng nhập: /admin (quản trị), /giao-vien (giáo viên), /hoc-sinh (học sinh).
    # "app" giữ tương thích cũ: giáo viên hoặc học sinh.
    portal: Literal["admin", "teacher", "student", "app"] = "app"


class LoginResponse(BaseModel):
    token: str
    user: UserOut


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=6, max_length=128)


class CreateUserRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=80)
    role: ManagedRole
    class_name: Optional[str] = Field(None, max_length=40)
    username: Optional[str] = Field(None, pattern=USERNAME_PATTERN)
    password: Optional[str] = Field(None, min_length=6, max_length=128)

    @field_validator("username", mode="before")
    @classmethod
    def _lower(cls, v):
        return v.strip().lower() or None if isinstance(v, str) else v


class BulkCreateRequest(BaseModel):
    role: ManagedRole
    class_name: Optional[str] = Field(None, max_length=40)
    full_names: list[str] = Field(..., min_length=1, max_length=200)

    @field_validator("full_names")
    @classmethod
    def _clean(cls, names: list[str]) -> list[str]:
        cleaned = [" ".join(n.split()) for n in names if n and n.strip()]
        if not cleaned:
            raise ValueError("Danh sách tên trống")
        if any(len(n) < 2 or len(n) > 80 for n in cleaned):
            raise ValueError("Mỗi họ tên cần từ 2 đến 80 ký tự")
        return cleaned


class UpdateUserRequest(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=80)
    class_name: Optional[str] = Field(None, max_length=40)
    is_active: Optional[bool] = None


class AdminUserOut(UserOut):
    """Tài khoản kèm tiến độ học tập thật (chỉ học sinh)."""

    xp: Optional[int] = None
    streak: Optional[int] = None
    lessons_completed: Optional[int] = None
    accuracy: Optional[float] = None


class Credential(BaseModel):
    """Thông tin đăng nhập ban đầu – chỉ trả về MỘT lần khi tạo / đặt lại mật khẩu."""

    user: UserOut
    password: str


class StatsOut(BaseModel):
    teachers: int
    students: int
    admins: int
    active: int
    pending_first_login: int
    classes: list[str]
    storage: str


# ---------------------------------------------------------------------------
# Phụ thuộc xác thực
# ---------------------------------------------------------------------------
def _require_store() -> None:
    if not store.ready:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Kho tài khoản chưa sẵn sàng. Kiểm tra cấu hình cơ sở dữ liệu.")


def get_current_user(authorization: str | None = Header(default=None)) -> dict:
    _require_store()
    unauthorized = HTTPException(status.HTTP_401_UNAUTHORIZED, "Phiên đăng nhập không hợp lệ hoặc đã hết hạn")
    if not authorization or not authorization.lower().startswith("bearer "):
        raise unauthorized
    payload = decode_token(authorization[7:].strip())
    if not payload:
        raise unauthorized
    user = store.get_by_id(int(payload["sub"]))
    if not user or not user["is_active"] or payload.get("pfp") != password_fingerprint(user["password_hash"]):
        raise unauthorized
    return user


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Chỉ quản trị viên được thực hiện thao tác này")
    return user


# Chống dò mật khẩu: khóa tạm 60 giây sau 5 lần sai liên tiếp
_FAILED: dict[str, tuple[int, float]] = {}
_MAX_FAILS, _LOCK_SECONDS = 5, 60


def _check_lock(username: str) -> None:
    fails, since = _FAILED.get(username, (0, 0.0))
    if fails >= _MAX_FAILS and time.time() - since < _LOCK_SECONDS:
        wait = int(_LOCK_SECONDS - (time.time() - since)) + 1
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, f"Sai quá nhiều lần. Thử lại sau {wait} giây.")
    if fails >= _MAX_FAILS:
        _FAILED.pop(username, None)


def _record_fail(username: str) -> None:
    fails, _ = _FAILED.get(username, (0, 0.0))
    _FAILED[username] = (fails + 1, time.time())


# ---------------------------------------------------------------------------
# /api/auth
# ---------------------------------------------------------------------------
_WRONG_PORTAL = {
    "admin": "Đây là tài khoản quản trị – hãy đăng nhập tại trang quản trị (/admin).",
    "teacher": "Đây là tài khoản giáo viên – hãy đăng nhập tại trang giáo viên (/giao-vien).",
    "student": "Đây là tài khoản học sinh – hãy đăng nhập tại trang học sinh (/hoc-sinh).",
}

@auth_router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest):
    _require_store()
    username = body.username.strip().lower()
    _check_lock(username)
    user = store.get_by_username(username)
    if not user or not verify_password(body.password, user["password_hash"]):
        _record_fail(username)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sai tên đăng nhập hoặc mật khẩu")
    if not user["is_active"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Tài khoản đã bị khóa. Liên hệ quản trị viên.")
    allowed = {"admin": {"admin"}, "teacher": {"teacher"}, "student": {"student"}, "app": {"teacher", "student"}}[body.portal]
    if user["role"] not in allowed:
        raise HTTPException(status.HTTP_403_FORBIDDEN, _WRONG_PORTAL[user["role"]])
    _FAILED.pop(username, None)
    store.touch_login(user["id"])
    user = store.get_by_id(user["id"])
    return LoginResponse(token=create_token(user["id"], user["role"], user["password_hash"]), user=to_out(user))


@auth_router.get("/me", response_model=UserOut)
def me(user: dict = Depends(get_current_user)):
    return to_out(user)


@auth_router.post("/change-password", response_model=LoginResponse)
def change_password(body: ChangePasswordRequest, user: dict = Depends(get_current_user)):
    if not verify_password(body.current_password, user["password_hash"]):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Mật khẩu hiện tại không đúng")
    if body.new_password == body.current_password:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Mật khẩu mới phải khác mật khẩu cũ")
    store.set_password(user["id"], hash_password(body.new_password), must_change=False)
    updated = store.get_by_id(user["id"])
    # Token cũ mất hiệu lực vì dấu vân tay mật khẩu đổi -> cấp token mới
    return LoginResponse(token=create_token(updated["id"], updated["role"], updated["password_hash"]), user=to_out(updated))


# ---------------------------------------------------------------------------
# /api/admin
# ---------------------------------------------------------------------------
@admin_router.get("/stats", response_model=StatsOut)
def stats(_: dict = Depends(require_admin)):
    users = store.list_users()
    counts = store.count_by_role()
    return StatsOut(
        teachers=counts["teacher"],
        students=counts["student"],
        admins=counts["admin"],
        active=sum(1 for u in users if u["role"] != "admin" and u["is_active"]),
        pending_first_login=sum(1 for u in users if u["role"] != "admin" and u["must_change_password"]),
        classes=sorted({u["class_name"] for u in users if u["class_name"]}),
        storage="postgres" if store.kind == "postgres" else "sqlite",
    )


@admin_router.get("/users", response_model=list[AdminUserOut])
def list_users(role: Optional[Role] = None, _: dict = Depends(require_admin)):
    progress = store.all_progress(light=True)
    result = []
    for u in store.list_users(role):
        item = AdminUserOut(**to_out(u).model_dump())
        p = progress.get(u["id"])
        if u["role"] == "student":
            item.xp = int(p["xp"]) if p else 0
            item.streak = prog.effective_streak(p)
            item.lessons_completed = int(p["lessons_completed"]) if p else 0
            item.accuracy = prog.accuracy(p)
        result.append(item)
    return result


@admin_router.post("/users", response_model=Credential, status_code=status.HTTP_201_CREATED)
def create_user(body: CreateUserRequest, _: dict = Depends(require_admin)):
    username = body.username or store.unique_username(body.full_name, body.role)
    password = body.password or generate_password()
    try:
        user = store.create_user(
            username=username,
            full_name=body.full_name,
            role=body.role,
            class_name=body.class_name,
            password_hash=hash_password(password),
            must_change_password=True,
        )
    except DuplicateUsername:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Tên đăng nhập '{username}' đã tồn tại")
    return Credential(user=to_out(user), password=password)


@admin_router.post("/users/bulk", response_model=list[Credential], status_code=status.HTTP_201_CREATED)
def bulk_create(body: BulkCreateRequest, _: dict = Depends(require_admin)):
    created: list[Credential] = []
    for full_name in body.full_names:
        password = generate_password()
        user = store.create_user(
            username=store.unique_username(full_name, body.role),
            full_name=full_name,
            role=body.role,
            class_name=body.class_name,
            password_hash=hash_password(password),
            must_change_password=True,
        )
        created.append(Credential(user=to_out(user), password=password))
    return created


@admin_router.patch("/users/{user_id}", response_model=UserOut)
def update_user(user_id: int, body: UpdateUserRequest, admin: dict = Depends(require_admin)):
    target = store.get_by_id(user_id)
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy tài khoản")
    if target["role"] == "admin" and body.is_active is False:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Không thể khóa tài khoản quản trị")
    updated = store.update_user(user_id, full_name=body.full_name, class_name=body.class_name, is_active=body.is_active)
    return to_out(updated)


@admin_router.post("/users/{user_id}/reset-password", response_model=Credential)
def reset_password(user_id: int, _: dict = Depends(require_admin)):
    target = store.get_by_id(user_id)
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy tài khoản")
    if target["role"] == "admin":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Quản trị viên tự đổi mật khẩu trong phần Đổi mật khẩu")
    password = generate_password()
    store.set_password(user_id, hash_password(password), must_change=True)
    return Credential(user=to_out(store.get_by_id(user_id)), password=password)


@admin_router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, _: dict = Depends(require_admin)):
    target = store.get_by_id(user_id)
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy tài khoản")
    if target["role"] == "admin":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Không thể xóa tài khoản quản trị")
    store.delete_user(user_id)
