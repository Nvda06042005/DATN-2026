import os
from pathlib import Path
from dotenv import load_dotenv

# Nạp file .env nếu có
load_dotenv()

# Đường dẫn thư mục gốc Document
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
    GOLDEN_DATASET_PATH: Path = ROOT_DIR / "Tran_Dynasty_Gold_Standard_Curriculum.jsonl"
    DEDUPLICATED_DATASET_PATH: Path = ROOT_DIR / "Tran_Dynasty_3_Wars_Deduplicated.jsonl"
    
    # Cấu hình CORS cho Frontend React Vite
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "*"
    ]

settings = Settings()
