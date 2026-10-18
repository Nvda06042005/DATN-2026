import sys
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query
from app.models.schemas import (
    QuizGenerateRequest, 
    QuizGenerateResponse,
    StudentAnswerSubmission,
    BKTUpdateResponse,
    PersonalizedRecommendationResponse,
    PersonalizedRecommendationItem
)
from app.core.rag_engine import rag_engine
from app.core.gemini_client import gemini_client

BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from bkt_engine import bkt_engine

router = APIRouter(prefix="/quiz", tags=["Giảng Viên & Khảo Thí - Sinh Đề & BKT Cá Nhân Hóa"])

@router.post("/generate", response_model=QuizGenerateResponse)
async def generate_quiz(req: QuizGenerateRequest):
    """
    Giáo viên yêu cầu sinh bộ câu hỏi trắc nghiệm tự động chuẩn kiến thức SGK 7
    """
    try:
        # 1. RAG Retrieval: Trích xuất các sự kiện & tư liệu liên quan đến chủ đề
        relevant_records = rag_engine.search_relevant_chunks(
            query=req.topic,
            top_k=5
        )

        # 2. Sinh câu hỏi trắc nghiệm
        questions = await gemini_client.generate_quiz(
            topic=req.topic,
            num_questions=req.num_questions,
            cognitive_level=req.cognitive_level or "Tất cả mức độ",
            grounding_records=relevant_records
        )

        return QuizGenerateResponse(
            topic=req.topic,
            total_generated=len(questions),
            questions=questions,
            generation_notes=(
                f"Đã sinh {len(questions)} câu hỏi dựa trên {len(relevant_records)} căn cứ sử liệu chính thức "
                "từ SGK Lịch sử 7 và Đại Việt Sử Ký Toàn Thư."
            )
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi sinh đề trắc nghiệm AI: {str(e)}")


@router.post("/submit-answer", response_model=BKTUpdateResponse)
async def submit_student_answer(sub: StudentAnswerSubmission):
    """
    Cập nhật tiến trình học sinh theo Bayesian Knowledge Tracing (BKT) sau mỗi câu hỏi.
    Tính toán lại xác suất nắm vững kiến thức P(L) theo công thức Bayes.
    """
    try:
        result = bkt_engine.update_student_response(
            student_id=sub.student_id,
            unit_id=sub.unit_id,
            is_correct=sub.is_correct
        )
        return BKTUpdateResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi cập nhật BKT: {str(e)}")


@router.get("/recommendations/{student_id}", response_model=PersonalizedRecommendationResponse)
async def get_personalized_recommendations(student_id: str, top_k: int = Query(3, ge=1, le=10)):
    """
    Gợi ý cá nhân hóa các cụm tri thức yếu (P(L) < 0.60) cần ôn tập trọng tâm.
    Dựa trên Q-matrix (32 kỹ năng, độ khó, mức độ nhận thức).
    """
    try:
        recs = bkt_engine.recommend_personalized_review(student_id=student_id, top_k=top_k)
        rec_items = [PersonalizedRecommendationItem(**item) for item in recs]
        return PersonalizedRecommendationResponse(
            student_id=student_id,
            total_recommendations=len(rec_items),
            recommendations=rec_items
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi truy vấn gợi ý cá nhân hóa: {str(e)}")

