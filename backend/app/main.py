from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api import chat, quiz, story, database

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
app.include_router(database.router, prefix=settings.API_PREFIX)

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
