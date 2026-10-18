from fastapi import APIRouter, HTTPException
from app.models.schemas import StoryGenerateRequest, StoryGenerateResponse
from app.core.rag_engine import rag_engine
from app.core.gemini_client import gemini_client

router = APIRouter(prefix="/story", tags=["Nhiệm Vụ - Sinh Cốt Truyện Nhập Vai"])

@router.post("/generate", response_model=StoryGenerateResponse)
async def generate_stage_story(req: StoryGenerateRequest):
    """
    Sinh lời dẫn truyện nhập vai cho các ải thử thách trên Bản đồ Nhiệm vụ (Quest)
    """
    try:
        query_text = f"{req.campaign_name} {req.stage_title} {req.key_event or ''}"
        relevant_records = rag_engine.search_relevant_chunks(
            query=query_text,
            top_k=3
        )

        result = await gemini_client.generate_story(
            campaign_name=req.campaign_name,
            stage_title=req.stage_title,
            key_event=req.key_event or "Trận chiến lịch sử thời Trần",
            grounding_records=relevant_records
        )

        return StoryGenerateResponse(
            stage_title=req.stage_title,
            story_narrative=result["story_narrative"],
            historical_fact=result["historical_fact"],
            challenge_question=result["challenge_question"],
            suggested_xp=100,
            suggested_gp=50
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi sinh cốt truyện nhập vai: {str(e)}")
