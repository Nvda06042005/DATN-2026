import sys
from pathlib import Path
from fastapi import APIRouter, HTTPException
from app.models.schemas import ChatRequest, ChatResponse, GroundingSource
from app.core.rag_engine import rag_engine

BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from hybrid_router import hybrid_router

router = APIRouter(prefix="/chat", tags=["Trợ Lý AI Sử Học Đông A"])

@router.post("/dong-a", response_model=ChatResponse)
async def chat_with_tutor(req: ChatRequest):
    """
    Học sinh đàm thoại với Trợ lý AI Lịch sử Đông A sử dụng:
    1. Modular NLP Pipeline (NLU + ML Classifier + Semantic Re-ranker + Conversational NLG)
    2. Session Memory Coreference Rewriter (Khắc phục Khó khăn 1)
    3. Abbreviation Normalizer chuyên biệt Lịch sử 7 (Khắc phục Khó khăn 2)
    4. Hybrid Router với Timeout 2.5s, Circuit Breaker và Cache (Khắc phục Khó khăn 4)
    """
    try:
        session_key = req.session_id or req.character_id or "default_user_session"

        # 1. Suy luận cục bộ (Local High-Speed NLP)
        local_res = rag_engine.ask_natural(
            query=req.query,
            character_id=req.character_id,
            session_id=session_key
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

        return ChatResponse(
            answer=routed_res["answer"],
            character_name=routed_res.get("character_name", "Trợ Lý AI Lịch Sử Đông A"),
            grounding_sources=grounding_sources,
            badge_unlocked=routed_res.get("badge_unlocked"),
            exp_reward=routed_res.get("exp_reward", 0)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi xử lý AI Chat: {str(e)}")
