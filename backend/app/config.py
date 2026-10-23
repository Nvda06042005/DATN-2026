import os
from pathlib import Path
from dotenv import load_dotenv

# Nạp file .env nếu có
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# Thư mục gốc dự án (chứa frontend/, backend/, ai/, database/)
ROOT_DIR = Path(__file__).resolve().parent.parent.parent

class Settings:
    PROJECT_NAME: str = "Hào Khí Đông A AI Engine - Lịch Sử 7"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    
    # Gemini API Key (Được nạp từ .env hoặc biến môi trường)
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    _raw_gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-flash-latest").strip()
    GEMINI_MODEL: str = (
        "gemini-flash-latest"
        if _raw_gemini_model in ("", "gemini-3.5-flash-lite", "gemini-1.5-flash")
        else _raw_gemini_model
    )
    
    # Hugging Face Settings (Mô hình nguồn mở tối ưu cho Tiếng Việt)
    HF_TOKEN: str = os.getenv("HF_TOKEN", "")
    HF_MODEL: str = os.getenv("HF_MODEL", "Qwen/Qwen2.5-7B-Instruct")
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "bkai-foundation-models/vietnamese-bi-encoder")
    
    # Đường dẫn file dữ liệu gốc
    GOLDEN_DATASET_PATH: Path = ROOT_DIR / "ai" / "data" / "Tran_Dynasty_Gold_Standard_Curriculum.jsonl"
    DEDUPLICATED_DATASET_PATH: Path = ROOT_DIR / "ai" / "data" / "Tran_Dynasty_3_Wars_Deduplicated.jsonl"
    
    # Xác thực & tài khoản
    # DATABASE_URL (Supabase Postgres) có giá trị -> lưu tài khoản trên Postgres; để trống -> SQLite cục bộ.
    DATABASE_URL: str = os.getenv("DATABASE_URL", "").strip()
    USERS_DB_PATH: str = os.getenv("USERS_DB_PATH", str(ROOT_DIR / "database" / "data" / "users.db"))
    AUTH_SECRET_KEY: str = os.getenv("AUTH_SECRET_KEY", "").strip()
    TOKEN_TTL_HOURS: int = int(os.getenv("TOKEN_TTL_HOURS", "12"))
    # Tài khoản quản trị được tạo tự động ở lần chạy đầu – đăng nhập tại trang /admin.
    # Khi triển khai thật, đặt ADMIN_PASSWORD riêng trên server thay cho mật khẩu mặc định.
    ADMIN_USERNAME: str = os.getenv("ADMIN_USERNAME", "admin").strip().lower()
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "admin@123")
    # Đá quý tặng học sinh mới
    STARTING_GEMS: int = int(os.getenv("STARTING_GEMS", "100"))

    # Cấu hình CORS cho Frontend React Vite
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "*"
    ]

settings = Settings()
