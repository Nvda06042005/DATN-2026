"""Kiểu dữ liệu vào/ra của dịch vụ AI."""
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class ExcelValidateRequest(BaseModel):
    file_b64: str = Field(..., min_length=4, max_length=3_000_000, description="Nội dung file .xlsx (base64)")
    filename: str = Field(..., min_length=1, max_length=200)
    mime: str = Field("", max_length=120)


class MatchCandidate(BaseModel):
    id: int
    user_code: Optional[str] = None
    email: Optional[str] = None
    full_name: Optional[str] = None
    school_code: Optional[str] = None
    row_data: dict[str, Any] = Field(default_factory=dict)
    embedding: Optional[list[float]] = None


class MatchRow(BaseModel):
    row: int
    values: dict[str, Any]
    embedding: list[float] = Field(default_factory=list)
    candidates: list[MatchCandidate] = Field(default_factory=list, max_length=20)


class ProvisionMatchRequest(BaseModel):
    rows: list[MatchRow] = Field(default_factory=list, max_length=1000)


class GroundingSource(BaseModel):
    doc_name: str = Field(description="Tài liệu gốc, ví dụ SGK Lịch sử 7 KNTT hoặc Đại Việt sử ký toàn thư")
    page_number: Optional[int] = None
    curriculum_match: Optional[str] = Field(None, description="Mục bài học tương ứng trong chương trình GDPT 2018")
    fact_chunk: str = Field(description="Đoạn tư liệu được truy xuất làm căn cứ trả lời")


class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000)
    session_id: Optional[str] = Field(None, max_length=120)
    character_id: Optional[str] = Field(None, max_length=120)


class ChatResponse(BaseModel):
    answer: str
    character_name: str = "Trợ Lý AI Lịch Sử Đông A"
    grounding_sources: list[GroundingSource] = Field(default_factory=list)
    badge_unlocked: Optional[str] = None
    exp_reward: int = 20


class GeneratedQuestion(BaseModel):
    id: str
    question: str
    options: list[str]
    correct_index: int
    cognitive_level: Literal["Nhận biết", "Thông hiểu", "Vận dụng", "Vận dụng cao"]
    explanation: str
    curriculum_reference: str


class QuizGenerateRequest(BaseModel):
    topic: str = Field("Ba lần kháng chiến chống quân Mông - Nguyên (1258 - 1288)", max_length=300)
    num_questions: int = Field(4, ge=1, le=20)
    cognitive_level: Optional[str] = Field("Tất cả mức độ", max_length=60)


class QuizGenerateResponse(BaseModel):
    topic: str
    total_generated: int
    questions: list[GeneratedQuestion]
    generation_notes: str


class StoryGenerateRequest(BaseModel):
    campaign_name: str = Field("Ba lần kháng chiến chống quân Mông - Nguyên", max_length=200)
    stage_title: str = Field("Trận địa cọc ngầm sông Bạch Đằng", max_length=200)
    key_event: Optional[str] = Field(None, max_length=400)


class StoryGenerateResponse(BaseModel):
    stage_title: str
    story_narrative: str
    historical_fact: str
    challenge_question: str
    suggested_xp: int = 100
    suggested_gp: int = 50


class BktUpdateRequest(BaseModel):
    """Trạng thái BKT hiện có của học sinh (cột bkt_state) và một câu trả lời đã được chấm."""
    state: dict[str, Any] = Field(default_factory=dict)
    unit_id: str = Field(..., pattern=r"^[A-Z0-9_]{1,64}$")
    is_correct: bool


class BktUpdateResponse(BaseModel):
    state: dict[str, Any]
    unit_id: str
    topic: str
    old_p_l: float
    new_p_l: float
    p_l_delta: float
    mastery_status: str
    attempts: int


class BktRecommendRequest(BaseModel):
    state: dict[str, Any] = Field(default_factory=dict)
    top_k: int = Field(5, ge=1, le=10)


class QuestionGenerateRequest(BaseModel):
    unit_id: str = Field(..., pattern=r"^[A-Z0-9_]{1,64}$")
    topic: str = Field(..., min_length=1, max_length=300)
    count: int = Field(3, ge=1, le=5)
