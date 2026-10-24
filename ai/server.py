"""Dịch vụ AI của Hào Khí Đông A (Python FastAPI).

Backend NestJS gọi các API này; người dùng không gọi trực tiếp.
- POST /chat               : Quân Sư AI – mô hình NLP + truy xuất kho tri thức (RAG) + LLM trau chuốt câu trả lời
- POST /quiz/generate      : soạn đề trắc nghiệm dựa trên đoạn tư liệu truy xuất được (RAG + Gemini/Hugging Face)
- POST /story/generate     : soạn màn truyện lịch sử (RAG + LLM)
- POST /questions/generate : câu hỏi AI cho game (kèm đáp án, backend giữ để chấm)
- POST /bkt/update         : Bayesian Knowledge Tracing – nhận trạng thái, trả trạng thái mới (không lưu ở đây)
- POST /bkt/recommend      : gợi ý cụm tri thức cần ôn

Chạy: cd ai && uvicorn server:app --port 8001
"""
import copy
import logging
import threading
import uuid

from fastapi import Depends, FastAPI, Header, HTTPException

from bkt_engine import bkt_engine
from config import settings
from gemini_client import gemini_client
from hybrid_router import hybrid_router
from rag_engine import rag_engine
from schemas import (
    BktRecommendRequest, BktUpdateRequest, BktUpdateResponse, ChatRequest, ChatResponse, GroundingSource,
    QuestionGenerateRequest, QuizGenerateRequest, QuizGenerateResponse, StoryGenerateRequest, StoryGenerateResponse,
)

logger = logging.getLogger(__name__)
_bkt_lock = threading.Lock()


def require_token(x_ai_token: str | None = Header(default=None)) -> None:
    if settings.AI_SERVICE_TOKEN and x_ai_token != settings.AI_SERVICE_TOKEN:
        raise HTTPException(401, "Thiếu hoặc sai khóa dịch vụ AI")


app = FastAPI(title="Hào Khí Đông A – dịch vụ AI", version="2.0.0")
api = Depends(require_token)


@app.get("/health")
def health():
    return {"status": "healthy", "ai_engine": "operational", "dataset_grounded": True, "units": len(bkt_engine.q_matrix)}


@app.post("/chat", response_model=ChatResponse, dependencies=[api])
async def chat(req: ChatRequest):
    session_key = req.session_id or req.character_id or "default_user_session"
    try:
        local = rag_engine.ask_natural(query=req.query, character_id=req.character_id, session_id=session_key)
        routed = await hybrid_router.route_and_respond(query=req.query, local_result=local, character_id=req.character_id)
    except Exception as exc:
        logger.error("Lỗi xử lý câu hỏi Quân Sư (%s)", type(exc).__name__)
        raise HTTPException(500, "Quân Sư AI đang gặp lỗi, thử lại sau") from None
    return ChatResponse(
        answer=routed["answer"],
        character_name=routed.get("character_name", "Trợ Lý AI Lịch Sử Đông A"),
        grounding_sources=[GroundingSource(**src) for src in routed.get("grounding_sources", [])],
        badge_unlocked=routed.get("badge_unlocked"),
        exp_reward=routed.get("exp_reward", 0),
    )


@app.post("/quiz/generate", response_model=QuizGenerateResponse, dependencies=[api])
async def generate_quiz(req: QuizGenerateRequest):
    records = rag_engine.search_relevant_chunks(query=req.topic, top_k=5)
    questions = await gemini_client.generate_quiz(
        topic=req.topic, num_questions=req.num_questions, cognitive_level=req.cognitive_level or "Tất cả mức độ", grounding_records=records,
    )
    return QuizGenerateResponse(
        topic=req.topic,
        total_generated=len(questions),
        questions=questions,
        generation_notes=f"Đã sinh {len(questions)} câu hỏi dựa trên {len(records)} căn cứ sử liệu từ SGK Lịch sử 7 và Đại Việt sử ký toàn thư.",
    )


@app.post("/story/generate", response_model=StoryGenerateResponse, dependencies=[api])
async def generate_story(req: StoryGenerateRequest):
    records = rag_engine.search_relevant_chunks(query=f"{req.campaign_name} {req.stage_title} {req.key_event or ''}", top_k=3)
    result = await gemini_client.generate_story(
        campaign_name=req.campaign_name, stage_title=req.stage_title, key_event=req.key_event or "Trận chiến lịch sử thời Trần", grounding_records=records,
    )
    return StoryGenerateResponse(stage_title=req.stage_title, **{k: result[k] for k in ("story_narrative", "historical_fact", "challenge_question")})


@app.post("/questions/generate", dependencies=[api])
async def generate_questions(req: QuestionGenerateRequest):
    """Câu hỏi AI cho game. Bỏ câu dự phòng cố định của gemini_client vì không thuộc cụm tri thức đang hỏi."""
    try:
        records = rag_engine.search_relevant_chunks(query=req.topic, top_k=5)
        generated = await gemini_client.generate_quiz(topic=req.topic, num_questions=req.count, cognitive_level="Tất cả mức độ", grounding_records=records)
    except Exception as exc:
        logger.warning("Không sinh được câu hỏi AI cho %s (%s)", req.unit_id, type(exc).__name__)
        return {"questions": []}
    questions = [
        {"question": g.question, "options": list(g.options), "correct_index": g.correct_index, "explanation": g.explanation, "source": f"Quân Sư AI – {g.curriculum_reference}"}
        for g in generated
        if not str(g.id).startswith("q-fallback")
    ][: req.count]
    return {"questions": questions}


def _with_state(state: dict, run):
    """Chạy hàm của bkt_engine trên một bản sao trạng thái, không giữ lại gì trong bộ nhớ dịch vụ."""
    sid = "req-" + uuid.uuid4().hex
    with _bkt_lock:
        bkt_engine.student_states[sid] = copy.deepcopy(state)
        try:
            return run(sid), bkt_engine.student_states[sid]
        finally:
            bkt_engine.student_states.pop(sid, None)


@app.post("/bkt/update", response_model=BktUpdateResponse, dependencies=[api])
def bkt_update(req: BktUpdateRequest):
    result, state = _with_state(req.state, lambda sid: bkt_engine.update_student_response(student_id=sid, unit_id=req.unit_id, is_correct=req.is_correct))
    return BktUpdateResponse(state=state, **{k: result[k] for k in ("unit_id", "topic", "old_p_l", "new_p_l", "p_l_delta", "mastery_status", "attempts")})


@app.post("/bkt/recommend", dependencies=[api])
def bkt_recommend(req: BktRecommendRequest):
    recs, _ = _with_state(req.state, lambda sid: bkt_engine.recommend_personalized_review(student_id=sid, top_k=req.top_k))
    return {"recommendations": recs, "total_recommendations": len(recs)}
