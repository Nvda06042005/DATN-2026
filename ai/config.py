"""Cấu hình dịch vụ AI, đọc từ biến môi trường hoặc file ai/.env."""
import os
from pathlib import Path

from dotenv import load_dotenv

AI_DIR = Path(__file__).resolve().parent
load_dotenv(AI_DIR / ".env")


class Settings:
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    _raw_gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-flash-latest").strip()
    GEMINI_MODEL: str = (
        "gemini-flash-latest"
        if _raw_gemini_model in ("", "gemini-3.5-flash-lite", "gemini-1.5-flash")
        else _raw_gemini_model
    )
    # Hugging Face (mô hình nguồn mở dự phòng cho tiếng Việt)
    HF_TOKEN: str = os.getenv("HF_TOKEN", "")
    HF_MODEL: str = os.getenv("HF_MODEL", "Qwen/Qwen2.5-7B-Instruct")
    # Khóa nội bộ: backend NestJS gửi trong header X-AI-Token. Để trống khi chạy thử trên máy.
    AI_SERVICE_TOKEN: str = os.getenv("AI_SERVICE_TOKEN", "").strip()


settings = Settings()
