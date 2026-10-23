import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api import chat, quiz, story
from app.api import database as database_api
from app.api.auth import auth_router, admin_router
from app.api.learning import student_router, teacher_router
from app.api.live import router as live_router
from database.user_store import store
from database.migrator import MigrationError

logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Hệ thống AI Giáo dục chuyên sâu cho môn Lịch sử 7 - Ba lần kháng chiến chống Mông - Nguyên (1258 - 1288)",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Cấu hình CORS hỗ trợ cả Localhost lẫn mọi tên miền Vercel (*.vercel.app) khi deploy
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex=r"https?://.*",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Kết nối các Router
app.include_router(chat.router, prefix=settings.API_PREFIX)
app.include_router(quiz.router, prefix=settings.API_PREFIX)
app.include_router(story.router, prefix=settings.API_PREFIX)
app.include_router(database_api.router, prefix=settings.API_PREFIX)
app.include_router(auth_router, prefix=settings.API_PREFIX)
app.include_router(admin_router, prefix=settings.API_PREFIX)
app.include_router(student_router, prefix=settings.API_PREFIX)
app.include_router(teacher_router, prefix=settings.API_PREFIX)
app.include_router(live_router, prefix=settings.API_PREFIX)


@app.on_event("startup")
def init_user_store():
    # PostgreSQL must not serve a new release against a failed/partial migration.
    try:
        store.init()
    except MigrationError as exc:
        logger.error("Database migration failed: %s", exc)
        raise RuntimeError("Database migrations failed; check backend migration logs") from None
    except Exception:
        # Keep the previous SQLite/auth fallback; never log credentials from driver errors.
        logger.error("Không khởi tạo được kho tài khoản (chi tiết kết nối đã ẩn)")

@app.get("/")
async def root():
    return {
        "project": settings.PROJECT_NAME,
        "status": "online",
        "docs": "/docs",
        "version": settings.VERSION
    }

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "ai_engine": "operational",
        "dataset_grounded": True
    }
