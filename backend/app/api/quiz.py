from fastapi import APIRouter, HTTPException, Query
from app.models.schemas import (
    QuizGenerateRequest, 
    QuizGenerateResponse,
    TopicGroupsResponse,
    StudentAnswerSubmission,
    BKTUpdateResponse,
    PersonalizedRecommendationResponse,
    PersonalizedRecommendationItem,
    StudentAccountAnalysisResponse,
    ShortAnswerSubmission,
    ShortAnswerEvaluationResponse,
)

# Các module AI nằm trong thư mục ai/ (xem app/__init__.py)
from rag_engine import rag_engine
from gemini_client import gemini_client
from bkt_engine import bkt_engine

router = APIRouter(prefix="/quiz", tags=["Giảng Viên & Khảo Thí - Sinh Đề & BKT Cá Nhân Hóa"])

@router.get("/topic-groups", response_model=TopicGroupsResponse)
async def get_quiz_topic_groups():
    """
    Trả về danh mục các nhóm chủ đề khảo thí chuẩn SGK Lịch sử 7
    kèm danh sách các cụm tri thức con và số lượng câu hỏi trắc nghiệm sẵn có.
    """
    try:
        groups = rag_engine.get_topic_groups()
        return TopicGroupsResponse(
            total_groups=len(groups),
            groups=groups
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi lấy danh mục nhóm chủ đề khảo thí: {str(e)}")


@router.post("/generate", response_model=QuizGenerateResponse)
async def generate_quiz(req: QuizGenerateRequest):
    """
    Giáo viên yêu cầu sinh bộ câu hỏi trắc nghiệm tự động chuẩn kiến thức SGK 7
    theo nhóm chủ đề (Topic Group) và phân bổ mức độ nhận thức Bloom.
    """
    try:
        # 1. RAG Retrieval: Trích xuất các sự kiện & tư liệu liên quan đến nhóm chủ đề
        relevant_records = rag_engine.search_relevant_chunks(
            query=req.topic,
            topic_group_id=req.topic_group_id,
            unit_ids=req.unit_ids,
            top_k=8
        )

        # 2. Sinh câu hỏi trắc nghiệm bám sát nhóm chủ đề
        questions = await gemini_client.generate_quiz(
            topic=req.topic,
            num_questions=req.num_questions,
            cognitive_level=req.cognitive_level or "Phân bổ ma trận",
            grounding_records=relevant_records,
            topic_group_id=req.topic_group_id,
            unit_ids=req.unit_ids
        )

        # Lấy tên nhóm chủ đề chuẩn
        group_meta = rag_engine.get_topic_group_meta(req.topic_group_id)
        group_name = group_meta.get("title") if group_meta else (req.topic or "Lịch sử thời Trần")

        return QuizGenerateResponse(
            topic=req.topic or group_name,
            topic_group_id=req.topic_group_id,
            topic_group_name=group_name,
            total_generated=len(questions),
            questions=questions,
            generation_notes=(
                f"Đã sinh {len(questions)} câu hỏi chuẩn hóa theo nhóm chủ đề '{group_name}', "
                f"đối chiếu {len(relevant_records)} căn cứ sử liệu chính thức từ SGK Lịch sử 7 và Đại Việt Sử Ký Toàn Thư."
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
    Dựa trên Q-matrix (39 kỹ năng, độ khó, mức độ nhận thức).
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


@router.get("/student-profile/{student_id}", response_model=StudentAccountAnalysisResponse)
async def get_student_account_analysis(student_id: str):
    """
    Đánh giá dữ liệu toàn diện tài khoản học sinh (BKT + Bloom + 3 cuộc kháng chiến)
    và tự động đưa ra phương án học + danh mục tài liệu SGK phù hợp nhất.
    """
    try:
        profile = bkt_engine.analyze_student_account_profile(student_id=student_id)
        return StudentAccountAnalysisResponse(**profile)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi phân tích hồ sơ tài khoản học sinh: {str(e)}")


@router.post("/evaluate-essay", response_model=ShortAnswerEvaluationResponse)
async def evaluate_student_short_answer(sub: ShortAnswerSubmission):
    """
    Chấm câu trả lời tự luận ngắn của học sinh bằng AI ngữ nghĩa, chỉ ra ý đã nêu đúng / ý còn thiếu
    và tự động cập nhật hồ sơ năng lực BKT của tài khoản.
    """
    try:
        result = bkt_engine.evaluate_short_answer(
            student_id=sub.student_id,
            unit_id=sub.unit_id,
            student_answer=sub.student_answer
        )
        return ShortAnswerEvaluationResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi chấm câu trả lời tự luận ngắn: {str(e)}")


@router.get("/adaptive-exam/{student_id}")
async def get_adaptive_exam_for_student(student_id: str, num_questions: int = Query(5, ge=3, le=10)):
    """
    Sinh đề kiểm tra thích ứng cá nhân hóa dựa trên đường cong quên Ebbinghaus,
    tốc độ học (Learning Velocity) và các lỗ hổng kiến thức BKT của học sinh.
    """
    try:
        return bkt_engine.generate_adaptive_exam(student_id=student_id, num_questions=num_questions)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi sinh đề thi thích ứng BKT: {str(e)}")
