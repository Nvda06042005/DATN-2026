"""Health check duy nhất để xác nhận Render kết nối được Supabase Postgres.

Chưa có thao tác ghi dữ liệu: cần bổ sung bảng và API xác thực cho ứng dụng.
"""
import os
import logging

from fastapi import APIRouter, HTTPException
import psycopg

router = APIRouter(prefix="/database", tags=["Database"])
logger = logging.getLogger(__name__)


@router.get("/health")
def database_health():
    database_url = os.environ.get("DATABASE_URL", "").strip()
    if not database_url:
        raise HTTPException(status_code=503, detail="DATABASE_URL is not configured")

    try:
        # Render free tier generally needs Supabase Session Pooler (IPv4, port 5432).
        # SSL is required for database connections over the internet.
        with psycopg.connect(database_url, connect_timeout=8, sslmode="require") as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT 1")
                row = cursor.fetchone()
                if not row or row[0] != 1:
                    raise RuntimeError("Unexpected database health response")
        return {"status": "connected", "database": "postgresql"}
    except Exception:
        logger.error("Supabase database health check failed (connection details omitted)")
        raise HTTPException(status_code=503, detail="Database unavailable. Check connection settings on Render and Supabase.")
