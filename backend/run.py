import uvicorn
import os
import sys

# Đảm bảo UTF-8 trên Windows console
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Đảm bảo đường dẫn import app chuẩn xác
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    is_render = os.getenv("RENDER") is not None
    print(f"[SERVER] Dang khoi dong Dong A EDU AI Engine tren cong {port} ...")
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=not is_render)
