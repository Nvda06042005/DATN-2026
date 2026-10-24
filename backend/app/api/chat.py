from fastapi import APIRouter, HTTPException
from app.models.schemas import (
    ChatRequest, ChatResponse, GroundingSource, StudyMaterialItem,
    TeachKnowledgeRequest, TeachKnowledgeResponse
)

# Các module AI nằm trong thư mục ai/ (xem app/__init__.py)
from rag_engine import rag_engine
from hybrid_router import hybrid_router
from bkt_engine import bkt_engine
from main_model import MainNLPEngine

router = APIRouter(prefix="/chat", tags=["Trợ Lý AI Sử Học Đông A"])

@router.post("/dong-a", response_model=ChatResponse)
async def chat_with_tutor(req: ChatRequest):
    """
    Học sinh đàm thoại với Trợ lý AI Lịch sử Đông A sử dụng:
    1. Modular NLP Pipeline (NLU + ML Classifier + Semantic Re-ranker + Conversational NLG)
    2. Session Memory Coreference Rewriter & Follow-Up Continuation (Khắc phục Khó khăn 1)
    3. Abbreviation Normalizer + Fuzzy Typo Repair + Indirect Paraphrase NLU (Khắc phục Khó khăn 2)
    4. Knowledge Graph Fact-Checker & Multi-Intent Synthesis
    5. Hybrid Router với Timeout 2.5s, Circuit Breaker và Cache (Khắc phục Khó khăn 4)
    """
    try:
        session_key = req.session_id or req.character_id or "default_user_session"
        student_id = req.student_id or "student_demo_01"

        # 1. Suy luận cục bộ (Local High-Speed NLP)
        local_res = rag_engine.ask_natural(
            query=req.query,
            character_id=req.character_id,
            session_id=session_key,
            student_id=student_id
        )

        # 2. Điều phối Hybrid Router (Cache -> Grounded LLM Polish 2.5s -> Local Fallback)
        routed_res = await hybrid_router.route_and_respond(
            query=req.query,
            local_result=local_res,
            character_id=req.character_id
        )

        grounding_sources = [
            GroundingSource(**src) for src in routed_res.get("grounding_sources", [])
        ]

        unit_id = local_res.get("unit_id", "UNKNOWN")
        raw_mats = local_res.get("recommended_materials") or []
        recommended_materials = [
            StudyMaterialItem(**m) if isinstance(m, dict) else m for m in raw_mats
        ]

        study_hint = None
        mastery_summary = None
        if unit_id == "OOD_RANDOM_AND_OFFTOPIC":
            bkt_engine.log_unanswered_query(query=req.query, student_id=student_id, session_id=session_key)
        elif local_res.get("bkt_chat_update"):
            chat_bkt = local_res["bkt_chat_update"]
            weak_recs = bkt_engine.recommend_personalized_review(student_id=student_id, top_k=2)
            if weak_recs:
                weak_names = ", ".join([r["topic"] for r in weak_recs])
                study_hint = (
                    f"📊 Hệ thống AI ghi nhận em vừa ôn tập chủ đề '{chat_bkt['topic']}' "
                    f"(Mức nắm vững P(L): {int(chat_bkt['new_p_l'] * 100)}%). "
                    f"Để đạt điểm tối đa, AI khuyên em nên đọc thêm tài liệu mục: {weak_names}."
                )
            mastery_summary = {
                "unit_id": unit_id,
                "topic": chat_bkt["topic"],
                "old_p_l": chat_bkt["old_p_l"],
                "new_p_l": chat_bkt["new_p_l"],
                "mastery_status": chat_bkt["mastery_status"],
            }

        return ChatResponse(
            answer=routed_res["answer"],
            character_name=routed_res.get("character_name", "Trợ Lý AI Lịch Sử Đông A"),
            grounding_sources=grounding_sources,
            badge_unlocked=routed_res.get("badge_unlocked"),
            exp_reward=routed_res.get("exp_reward", 0),
            recommended_materials=recommended_materials,
            study_hint=study_hint,
            student_mastery_summary=mastery_summary,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi xử lý AI Chat: {str(e)}")


@router.post("/teach", response_model=TeachKnowledgeResponse)
async def teach_new_historical_knowledge(req: TeachKnowledgeRequest):
    """
    Cho phép Giáo viên / Quản trị viên dạy thêm kiến thức lịch sử mới cho AI ngay lúc chạy (Hot-Reload)
    mà không cần khởi động lại server hay chờ train lại từ đầu.
    """
    try:
        model = MainNLPEngine.get_model()
        result = model.teach_new_knowledge(
            unit_id=req.unit_id or "",
            topic=req.topic,
            entity=req.entity or "Nhân vật / Sự kiện thời Trần",
            event=req.event or "Kháng chiến chống Mông - Nguyên",
            fact_chunk=req.fact_chunk,
            answer=req.answer,
            base_queries=req.sample_questions,
            cognitive_level=req.cognitive_level or "THONG_HIEU",
            difficulty=req.difficulty or 0.5,
        )
        return TeachKnowledgeResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi cập nhật tri thức động: {str(e)}")
