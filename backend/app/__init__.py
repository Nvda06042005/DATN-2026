"""Ứng dụng FastAPI Đông A (thư mục backend/).

Dự án gồm 4 phần: frontend/, backend/, ai/ và database/. Khi backend chạy, đưa
thư mục gốc (để import gói `database`) và thư mục `ai/` vào sys.path. Các module
AI giữ tên phẳng (`bkt_engine`, `create_model`, ...) vì model .joblib đã được
pickle theo đúng các tên module này.
"""
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
AI_DIR = PROJECT_ROOT / "ai"

for _path in (PROJECT_ROOT, AI_DIR):
    if str(_path) not in sys.path:
        sys.path.insert(0, str(_path))
