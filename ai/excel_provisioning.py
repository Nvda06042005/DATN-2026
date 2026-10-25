"""File Excel mẫu cấp tài khoản Đông A (OpenPyXL).

- build_template(): file .xlsx có trang ẩn _sys_signature (khóa mật khẩu) chứa mã HMAC-SHA256 của cấu trúc cột,
  mã mẫu ghi cả trong Custom Workbook Properties; trang dữ liệu khóa hàng tiêu đề, chỉ mở các ô nhập.
- validate_file(): từ chối file không phải .xlsx chuẩn (đuôi, MIME, chữ ký ZIP, macro), file tự tạo (không có chữ ký),
  file bị sửa cấu trúc (thêm/xóa/đổi tên/đổi vị trí cột); đọc từng dòng, chuẩn hóa, ghi rõ ô thiếu/sai.
- Công thức tài khoản: tên đăng nhập [tên].[2 số năm học][4 số mã trường][khối + 3 số niên khóa] (+ 3 số thứ tự@miền do backend gán),
  mật khẩu mặc định [chữ cái đầu họ tên][ddmmyyyy]VN@.
- embed() + match_rows(): vector đặc trưng hồ sơ (băm trigram ký tự, 128 chiều) để backend lưu vào pgvector; đối chiếu dòng mới với
  các dòng thiếu trước đây (khớp chính xác mã/email, hoặc cùng họ tên và hồ sơ gần giống) – phần quyết định của RAG Smart Delta Dispatch.
"""
import hashlib
import hmac
import io
import json
import math
import re
import unicodedata
import uuid
import zipfile
from datetime import date, datetime

from openpyxl import Workbook, load_workbook
from openpyxl.packaging.custom import StringProperty
from openpyxl.styles import Alignment, Font, PatternFill, Protection
from openpyxl.workbook.protection import WorkbookProtection
from openpyxl.worksheet.datavalidation import DataValidation

from config import settings

COLUMNS = [
    "Mã số người dùng", "Trường", "Mã số trường", "Khu vực", "Thành phố", "Tên",
    "Ngày tháng năm sinh", "Năm học", "Email", "Khối", "Vai trò",
]
KEYS = ["user_code", "school_name", "school_code", "region", "city", "full_name", "birth_date", "school_year", "email", "grade", "role"]
DATA_SHEET = "Danh sach"
GUIDE_SHEET = "Huong dan"
SIGNATURE_SHEET = "_sys_signature"
TEMPLATE_VERSION = "1"
PROP_ID = "DongA-Template-Id"
PROP_VERSION = "DongA-Template-Version"
MAX_DATA_ROWS = 1000
MAX_BYTES = 2 * 1024 * 1024
XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
ACCEPTED_MIMES = {XLSX_MIME, "application/octet-stream", ""}
EMBED_DIMS = 128

_EMAIL = re.compile(r"^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$")
_DATE = re.compile(r"^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$")
_YEAR = re.compile(r"^(\d{4})\s*[-–]\s*(\d{4})$")


def _key() -> bytes:
    # Render tạo EXCEL_SIGNING_KEY; chạy thử trên máy dùng khóa suy ra từ AI_SERVICE_TOKEN (hoặc khóa thử)
    return (settings.EXCEL_SIGNING_KEY or f"dong-a-dev:{settings.AI_SERVICE_TOKEN}").encode("utf-8")


def sign(template_id: str, version: str = TEMPLATE_VERSION) -> str:
    """HMAC-SHA256 của phiên bản mẫu + mã mẫu + tên trang + đúng thứ tự các cột"""
    message = "|".join([version, template_id, DATA_SHEET, *COLUMNS])
    return hmac.new(_key(), message.encode("utf-8"), hashlib.sha256).hexdigest()


def _sheet_password() -> str:
    # Mật khẩu khóa trang trong Excel (chống sửa nhầm); kiểm tra thật nằm ở chữ ký HMAC
    return hashlib.sha256(_key() + b":sheet").hexdigest()[:16]


# ---------------------------------------------------------------------- tạo file mẫu
def build_template() -> bytes:
    template_id = uuid.uuid4().hex
    wb = Workbook()
    ws = wb.active
    ws.title = DATA_SHEET
    ws.append(COLUMNS)
    header_fill = PatternFill("solid", fgColor="FF9600")
    for col, title in enumerate(COLUMNS, start=1):
        cell = ws.cell(row=1, column=col)
        cell.font = Font(bold=True, color="1F1300")
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        ws.column_dimensions[cell.column_letter].width = max(14, len(title) + 4)
    ws.row_dimensions[1].height = 30
    ws.freeze_panes = "A2"
    # Ô nhập: mở khóa, định dạng chữ (giữ số 0 đầu mã, ngày sinh gõ DD/MM/YYYY không bị đổi theo máy)
    for r in range(2, MAX_DATA_ROWS + 2):
        for c in range(1, len(COLUMNS) + 1):
            cell = ws.cell(row=r, column=c)
            cell.protection = Protection(locked=False)
            cell.number_format = "@"
    grade = DataValidation(type="list", formula1='"6,7,8,9"', allow_blank=True, showErrorMessage=True, errorTitle="Khối", error="Khối chỉ nhận 6, 7, 8 hoặc 9")
    role = DataValidation(type="list", formula1='"GV,HS"', allow_blank=True, showErrorMessage=True, errorTitle="Vai trò", error="Vai trò là GV hoặc HS")
    last = MAX_DATA_ROWS + 1
    grade.add(f"J2:J{last}")
    role.add(f"K2:K{last}")
    ws.add_data_validation(grade)
    ws.add_data_validation(role)
    ws.protection.sheet = True
    ws.protection.password = _sheet_password()
    ws.protection.formatColumns = False

    guide = wb.create_sheet(GUIDE_SHEET)
    notes = [
        "HƯỚNG DẪN ĐIỀN FILE MẪU CẤP TÀI KHOẢN ĐÔNG A",
        "1. Điền mỗi người một dòng ở trang 'Danh sach'. Không thêm, xóa, đổi tên hay đổi vị trí cột – hệ thống sẽ từ chối file.",
        "2. Ngày tháng năm sinh: DD/MM/YYYY (ví dụ 06/04/2012). Năm học: 2025-2026. Khối: 6, 7, 8 hoặc 9. Vai trò: GV hoặc HS.",
        "3. Mã số trường được chuẩn hóa thành 4 chữ số (lấy 4 số cuối).",
        "4. Dòng thiếu thông tin chưa được cấp tài khoản; bổ sung rồi nhập lại file – hệ thống chỉ gửi email cho người vừa đủ thông tin.",
        "5. Tên đăng nhập: [tên].[2 số năm học][mã trường][khối + 3 số niên khóa][số thứ tự]@miền; mật khẩu mặc định: [chữ cái đầu họ tên][ngày sinh ddmmyyyy]VN@.",
        "   Ví dụ Nguyễn Vũ Đức Anh, sinh 06/04/2012: mật khẩu Nvda06042012VN@ – bắt buộc đổi ở lần đăng nhập đầu tiên.",
        "Ví dụ một dòng (không điền vào trang này):",
    ]
    for line in notes:
        guide.append([line])
    guide.append(COLUMNS)
    guide.append(["HS001", "THCS Văn Lang", "7480", "Miền Nam", "TP. Hồ Chí Minh", "Nguyễn Vũ Đức Anh", "06/04/2012", "2025-2026", "anh@example.edu.vn", "7", "HS"])
    guide["A1"].font = Font(bold=True, size=13)
    guide.column_dimensions["A"].width = 18
    guide.protection.sheet = True
    guide.protection.password = _sheet_password()

    sig = wb.create_sheet(SIGNATURE_SHEET)
    sig.append(["template_id", template_id])
    sig.append(["version", TEMPLATE_VERSION])
    sig.append(["columns", json.dumps(COLUMNS, ensure_ascii=False)])
    sig.append(["signature", sign(template_id)])
    sig.sheet_state = "veryHidden"
    sig.protection.sheet = True
    sig.protection.password = _sheet_password()

    wb.custom_doc_props.append(StringProperty(name=PROP_ID, value=template_id))
    wb.custom_doc_props.append(StringProperty(name=PROP_VERSION, value=TEMPLATE_VERSION))
    wb.security = WorkbookProtection(workbookPassword=_sheet_password(), lockStructure=True)
    wb.active = 0
    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


# ---------------------------------------------------------------------- công thức tài khoản
def strip_accents(text: str) -> str:
    text = text.replace("đ", "d").replace("Đ", "D")
    return "".join(ch for ch in unicodedata.normalize("NFD", text) if unicodedata.category(ch) != "Mn")


def username_prefix(full_name: str, school_year: str, school_code: str, grade: int) -> str:
    """anh.2374807022: tên gọi cuối không dấu . 2 số năm học + 4 số mã trường + khối + 3 số cuối năm vào lớp 6 (niên khóa)"""
    words = strip_accents(full_name).split()
    name = re.sub(r"[^a-z0-9]", "", words[-1].lower()) if words else ""
    start = int(school_year[:4])
    cohort = str(start - (grade - 6))[-3:]
    return f"{name or 'user'}.{str(start)[-2:]}{school_code}{grade}{cohort}"


def default_password(full_name: str, birth_iso: str) -> str:
    """Nvda06042005VN@: chữ cái đầu các từ trong họ tên (đầu viết hoa) + ngày sinh ddmmyyyy + VN@"""
    initials = "".join(w[0] for w in strip_accents(full_name).split() if w[0].isalnum()).lower()
    y, m, d = birth_iso.split("-")
    return f"{initials[:1].upper()}{initials[1:]}{d}{m}{y}VN@"


# ---------------------------------------------------------------------- vector đặc trưng
def embed(text: str, dims: int = EMBED_DIMS) -> list[float]:
    """Băm trigram ký tự (không dấu, chữ thường) có dấu, chuẩn hóa L2 – hai hồ sơ cùng người có cosine cao dù khác một vài ô"""
    t = " " + re.sub(r"\s+", " ", strip_accents(text).lower()).strip() + " "
    v = [0.0] * dims
    for i in range(len(t) - 2):
        h = int.from_bytes(hashlib.blake2b(t[i:i + 3].encode("utf-8"), digest_size=4).digest(), "little")
        v[h % dims] += -1.0 if (h >> 31) & 1 else 1.0
    norm = math.sqrt(sum(x * x for x in v)) or 1.0
    return [round(x / norm, 5) for x in v]


def profile_text(values: dict) -> str:
    return " | ".join(str(values.get(k) or "") for k in ("full_name", "birth_date", "user_code", "email", "school_code", "school_name"))


def cosine(a: list[float] | None, b: list[float] | None) -> float:
    if not a or not b:
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0


# ---------------------------------------------------------------------- kiểm duyệt file
def _fail(*errors: str) -> dict:
    return {"ok": False, "errors": list(errors), "template_id": None, "rows": []}


def _text(v) -> str:
    if v is None:
        return ""
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return re.sub(r"\s+", " ", str(v)).strip()


def _norm_code(code: str) -> str:
    digits = re.sub(r"\D", "", code)
    return digits[-4:].rjust(4, "0") if digits else ""


def _parse_date(v):
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    m = _DATE.match(_text(v))
    if not m:
        return None
    try:
        return date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
    except ValueError:
        return None


def parse_row(number: int, cells: tuple) -> dict:
    raw = {key: cells[i] if i < len(cells) else None for i, key in enumerate(KEYS)}
    values = {key: _text(raw[key]) for key in KEYS}
    missing = [COLUMNS[i] for i, key in enumerate(KEYS) if not values[key]]
    invalid = []

    if values["school_code"]:
        code = _norm_code(values["school_code"])
        if code:
            values["school_code"] = code
        else:
            invalid.append({"field": "Mã số trường", "message": "Mã số trường cần có chữ số"})
    birth = None
    if values["birth_date"] or raw["birth_date"] is not None:
        birth = _parse_date(raw["birth_date"])
        if not birth:
            invalid.append({"field": "Ngày tháng năm sinh", "message": "Ngày sinh có dạng DD/MM/YYYY"})
        elif not (1900 <= birth.year and birth <= date.today()):
            invalid.append({"field": "Ngày tháng năm sinh", "message": "Ngày sinh không hợp lệ"})
            birth = None
    values["birth_date"] = birth.isoformat() if birth else None
    if values["school_year"]:
        m = _YEAR.match(values["school_year"])
        if m and int(m.group(2)) == int(m.group(1)) + 1:
            values["school_year"] = f"{m.group(1)}-{m.group(2)}"
        else:
            invalid.append({"field": "Năm học", "message": "Năm học có dạng 2025-2026"})
    if values["email"]:
        values["email"] = values["email"].lower()
        if not _EMAIL.match(values["email"]):
            invalid.append({"field": "Email", "message": "Email không hợp lệ"})
    grade = None
    if values["grade"]:
        digits = re.sub(r"\D", "", values["grade"])
        if digits in ("6", "7", "8", "9"):
            grade = int(digits)
        else:
            invalid.append({"field": "Khối", "message": "Khối chỉ nhận 6, 7, 8 hoặc 9"})
    values["grade"] = grade
    role = None
    if values["role"]:
        r = strip_accents(values["role"]).upper().replace(" ", "")
        role = "GV" if r in ("GV", "GIAOVIEN") else "HS" if r in ("HS", "HOCSINH") else None
        if not role:
            invalid.append({"field": "Vai trò", "message": "Vai trò là GV hoặc HS"})
    values["role"] = role

    complete = not missing and not invalid
    credentials = None
    if complete:
        credentials = {
            "username_prefix": username_prefix(values["full_name"], values["school_year"], values["school_code"], grade),
            "password": default_password(values["full_name"], values["birth_date"]),
        }
    return {
        "row": number, "values": values, "missing": missing, "invalid": invalid, "complete": complete,
        "embedding": embed(profile_text(values)), "credentials": credentials,
    }


def validate_file(raw: bytes, filename: str, mime: str) -> dict:
    # 1. Định dạng: đuôi, MIME, chữ ký ZIP, cấu trúc gói Office, không macro
    if not filename.lower().endswith(".xlsx"):
        return _fail("Chỉ nhận file .xlsx tải từ trang chủ (không nhận .xls, .csv).")
    if mime not in ACCEPTED_MIMES:
        return _fail(f"Định dạng {mime} không phải file Excel .xlsx.")
    if len(raw) > MAX_BYTES:
        return _fail("File quá lớn (tối đa 2 MB).")
    if not raw.startswith(b"PK\x03\x04"):
        return _fail("Nội dung không phải file .xlsx chuẩn.")
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as z:
            names = set(z.namelist())
            if sum(i.file_size for i in z.infolist()) > 60 * 1024 * 1024:
                return _fail("File giải nén quá lớn – không nhận.")
    except zipfile.BadZipFile:
        return _fail("Nội dung không phải file .xlsx chuẩn.")
    if "[Content_Types].xml" not in names or "xl/workbook.xml" not in names:
        return _fail("Nội dung không phải file .xlsx chuẩn.")
    if any(n.lower().endswith("vbaproject.bin") for n in names):
        return _fail("File chứa macro – không nhận.")
    try:
        wb = load_workbook(io.BytesIO(raw), data_only=True)
    except Exception:  # noqa: BLE001 - mọi lỗi đọc file đều trả lời người dùng như nhau
        return _fail("Không đọc được file Excel.")

    # 2. Chữ ký hệ thống: file tự tạo không có trang ẩn _sys_signature
    if SIGNATURE_SHEET not in wb.sheetnames:
        return _fail("File không có chữ ký của hệ thống. Hãy tải file mẫu ở trang chủ rồi điền, không tự tạo file mới.")
    sig = wb[SIGNATURE_SHEET]
    template_id = _text(sig["B1"].value)
    version = _text(sig["B2"].value)
    signature = _text(sig["B4"].value)
    props = {p.name: getattr(p, "value", None) for p in wb.custom_doc_props}
    if sig.sheet_state == "visible" or not template_id or props.get(PROP_ID) != template_id or props.get(PROP_VERSION) != version:
        return _fail("Thuộc tính file mẫu đã bị thay đổi. Hãy tải lại file mẫu ở trang chủ.")
    if not hmac.compare_digest(sign(template_id, version), signature):
        return _fail("Chữ ký file mẫu không hợp lệ: file đã bị sửa cấu trúc hoặc không phải file của hệ thống.")

    # 3. Cấu trúc: đúng các trang, đúng tên và thứ tự cột, không thêm cột
    errors = []
    extra_sheets = [n for n in wb.sheetnames if n not in (DATA_SHEET, GUIDE_SHEET, SIGNATURE_SHEET)]
    if DATA_SHEET not in wb.sheetnames:
        return _fail(f"Không thấy trang '{DATA_SHEET}' của file mẫu.")
    if extra_sheets:
        errors.append(f"File có thêm trang ngoài mẫu: {', '.join(extra_sheets)}.")
    ws = wb[DATA_SHEET]
    header = [_text(c.value) for c in ws[1]]
    for i, title in enumerate(COLUMNS):
        got = header[i] if i < len(header) else ""
        if got != title:
            errors.append(f'Cấu trúc cột đã bị sửa: cột {i + 1} là "{got or "(trống)"}" thay vì "{title}".')
    extra = [h for h in header[len(COLUMNS):] if h]
    if not extra:
        for cells in ws.iter_rows(min_row=2, min_col=len(COLUMNS) + 1, values_only=True):
            if any(_text(v) for v in cells):
                extra = ["(dữ liệu)"]
                break
    if extra:
        errors.append(f"Có thêm cột ngoài mẫu sau cột \"{COLUMNS[-1]}\": {', '.join(extra)}.")
    if errors:
        return _fail(*errors)

    # 4. Đọc dòng (bỏ dòng trống)
    rows = []
    for number, cells in enumerate(ws.iter_rows(min_row=2, max_col=len(COLUMNS), values_only=True), start=2):
        if all(not _text(v) for v in cells):
            continue
        rows.append(parse_row(number, cells))
        if len(rows) > MAX_DATA_ROWS:
            return _fail(f"Mỗi lần nhập tối đa {MAX_DATA_ROWS} dòng.")
    return {"ok": True, "errors": [], "template_id": template_id, "rows": rows}


# ---------------------------------------------------------------------- RAG Smart Delta: dòng mới bổ sung cho dòng thiếu nào
def _same_name(a: str | None, b: str | None) -> bool:
    norm = lambda s: re.sub(r"\s+", " ", strip_accents(s or "").lower()).strip()  # noqa: E731
    return bool(norm(a)) and norm(a) == norm(b)


def _conflict(a, b) -> bool:
    """Hai giá trị cùng có mà khác nhau (ô trống không tính là mâu thuẫn)"""
    a, b = str(a or "").strip().lower(), str(b or "").strip().lower()
    return bool(a) and bool(b) and a != b


def match_rows(rows: list[dict]) -> list[dict]:
    """
    Với mỗi dòng (kèm các ứng viên backend truy xuất từ pgvector / khớp chính xác), chọn dòng thiếu tương ứng:
    trùng mã người dùng > trùng email > cùng họ tên, cùng trường, không mâu thuẫn ngày sinh/mã/email và hồ sơ đủ gần (cosine ≥ 0,5).
    Tên gần giống mà không trùng (ví dụ Thiếu – Thiệu) không ghép, để không gửi nhầm tài khoản. Mỗi dòng thiếu chỉ gán cho một dòng mới.
    """
    proposals = []
    for r in rows:
        v = r.get("values") or {}
        for c in r.get("candidates") or []:
            data = c.get("row_data") or {}
            if v.get("user_code") and c.get("user_code") == v.get("user_code"):
                score, reason = 1.0, "trùng mã người dùng"
            elif v.get("email") and (c.get("email") or "").lower() == str(v.get("email")).lower():
                score, reason = 0.98, "trùng email"
            else:
                sim = cosine(r.get("embedding"), c.get("embedding"))
                conflict = (
                    _conflict(v.get("birth_date"), data.get("birth_date"))
                    or _conflict(v.get("user_code"), c.get("user_code"))
                    or _conflict(v.get("email"), c.get("email"))
                    or _conflict(v.get("school_code"), c.get("school_code"))
                )
                if not _same_name(v.get("full_name"), c.get("full_name")) or conflict or sim < 0.5:
                    continue
                score, reason = round(0.6 + 0.4 * sim, 3), f"cùng họ tên và trường, hồ sơ giống {round(sim * 100)}%"
            proposals.append((score, r["row"], c["id"], reason))
    decided, used_rows, used_logs = {}, set(), set()
    for score, row, log_id, reason in sorted(proposals, key=lambda p: -p[0]):
        if row in used_rows or log_id in used_logs:
            continue
        used_rows.add(row)
        used_logs.add(log_id)
        decided[row] = {"row": row, "log_id": log_id, "score": score, "reason": reason}
    return [decided.get(r["row"], {"row": r["row"], "log_id": None, "score": 0.0, "reason": "không có dòng thiếu tương ứng"}) for r in rows]
