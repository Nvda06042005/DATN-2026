from typing import List, Optional, Literal
from pydantic import BaseModel, Field

# ==============================================================================
# SCHEMAS FOR CHAT (STUDENT AI TUTOR - "SỬ HỌC ĐÔNG A")
# ==============================================================================

class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str

class GroundingSource(BaseModel):
    doc_name: str = Field(description="Tên tài liệu gốc, ví dụ: SGK Lịch sử 7 KNTT hoặc Đại Việt Sử Ký Toàn Thư")
    page_number: Optional[int] = Field(None, description="Trang tài liệu")
    curriculum_match: Optional[str] = Field(None, description="Mục bài học tương ứng trong chương trình GDPT 2018")
    fact_chunk: str = Field(description="Đoạn tư liệu sử liệu được trích xuất làm căn cứ trả lời")

class ChatRequest(BaseModel):
    query: str = Field(..., description="Câu hỏi của học sinh về Lịch sử thời Trần")
    session_id: Optional[str] = Field(None, description="Mã phiên hội thoại của học sinh")
    character_id: Optional[str] = Field(
        None, 
        description="ID nhân vật lịch sử nhập vai nếu có (TRAN_QUOC_TUAN, TRAN_THAI_TONG, TRAN_QUOC_TOAN...)"
    )
    history: Optional[List[ChatMessage]] = Field(default_factory=list, description="Lịch sử hội thoại")

class ChatResponse(BaseModel):
    answer: str = Field(..., description="Câu trả lời của Trợ lý AI")
    character_name: str = Field("Trợ Lý AI Lịch Sử Đông A", description="Tên nhân vật phản hồi")
    grounding_sources: List[GroundingSource] = Field(default_factory=list, description="Căn cứ sử liệu")
    badge_unlocked: Optional[str] = Field(None, description="Huy hiệu lịch sử mở khóa nếu có")
    exp_reward: int = Field(20, description="Điểm kinh nghiệm thưởng cho câu hỏi hay")

# ==============================================================================
# SCHEMAS FOR QUIZ GENERATION (TEACHER AI STUDIO)
# ==============================================================================

class QuizOption(BaseModel):
    text: str = Field(..., description="Nội dung đáp án")
    is_correct: bool = Field(False, description="Đáp án đúng hay sai")

class GeneratedQuestion(BaseModel):
    id: str
    question: str
    options: List[str]
    correct_index: int
    cognitive_level: Literal["Nhận biết", "Thông hiểu", "Vận dụng", "Vận dụng cao"]
    explanation: str
    curriculum_reference: str

class QuizGenerateRequest(BaseModel):
    topic: str = Field("Ba lần kháng chiến chống quân Mông - Nguyên (1258 - 1288)", description="Chủ đề trắc nghiệm")
    num_questions: int = Field(4, ge=1, le=20, description="Số lượng câu hỏi cần sinh")
    cognitive_level: Optional[str] = Field("Tất cả mức độ", description="Mức độ nhận thức GDPT 2018")
    source_preference: Optional[str] = Field("SGK Lịch sử 7 Kết nối tri thức", description="Nguồn sách ưu tiên")

class QuizGenerateResponse(BaseModel):
    topic: str
    total_generated: int
    questions: List[GeneratedQuestion]
    generation_notes: str

# ==============================================================================
# SCHEMAS FOR STORY GENERATION (QUEST CAMPAIGN NARRATIVE)
# ==============================================================================

class StoryGenerateRequest(BaseModel):
    campaign_name: str = Field("Ba lần kháng chiến chống quân Mông - Nguyên", description="Tên chiến dịch")
    stage_title: str = Field("Trận địa cọc ngầm sông Bạch Đằng", description="Tên ải thử thách")
    key_event: Optional[str] = Field("Trần Hưng Đạo bố trí cọc ngầm đón thủy triều rút năm 1288", description="Sự kiện chính")

class StoryGenerateResponse(BaseModel):
    stage_title: str
    story_narrative: str
    historical_fact: str
    challenge_question: str
    suggested_xp: int = 100
    suggested_gp: int = 50

# ==============================================================================
# SCHEMAS FOR BAYESIAN KNOWLEDGE TRACING & PERSONALIZATION (BKT)
# ==============================================================================

class StudentAnswerSubmission(BaseModel):
    student_id: str = Field(..., description="ID học sinh")
    unit_id: str = Field(..., description="ID cụm tri thức câu hỏi (từ Q-matrix)")
    is_correct: bool = Field(..., description="Học sinh trả lời đúng hay sai")
    cognitive_level: Optional[str] = Field("THONG_HIEU", description="Mức độ nhận thức của câu hỏi")

class BKTUpdateResponse(BaseModel):
    student_id: str
    unit_id: str
    topic: str
    is_correct: bool
    old_p_l: float
    new_p_l: float
    p_l_delta: float
    mastery_status: str
    attempts: int

class PersonalizedRecommendationItem(BaseModel):
    unit_id: str
    topic: str
    category: str
    current_mastery: float
    difficulty: float
    cognitive_level: str
    reason: str

class PersonalizedRecommendationResponse(BaseModel):
    student_id: str
    total_recommendations: int
    recommendations: List[PersonalizedRecommendationItem]
