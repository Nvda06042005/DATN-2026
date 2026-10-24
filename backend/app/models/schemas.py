from typing import List, Optional, Literal, Dict, Any
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

class StudyMaterialItem(BaseModel):
    unit_id: str
    title: str
    doc_source: str
    reading_section: str
    summary_points: List[str] = Field(default_factory=list)
    practice_prompt: str = ""
    bloom_target: str = "NHAN_BIET"
    current_mastery: Optional[float] = None
    mastery_status: Optional[str] = None

class ChatRequest(BaseModel):
    query: str = Field(..., description="Câu hỏi của học sinh về Lịch sử thời Trần")
    session_id: Optional[str] = Field(None, description="Mã phiên hội thoại của học sinh")
    student_id: Optional[str] = Field("student_demo_01", description="Mã tài khoản học sinh để đồng bộ hồ sơ BKT")
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
    recommended_materials: List[StudyMaterialItem] = Field(default_factory=list, description="Tài liệu học tập gợi ý theo chủ đề vừa hỏi")
    study_hint: Optional[str] = Field(None, description="Gợi ý lộ trình học tập cá nhân hóa từ hồ sơ học sinh")
    student_mastery_summary: Optional[Dict[str, Any]] = Field(None, description="Tóm tắt nhanh tiến độ BKT của tài khoản sau câu hỏi")

class TeachKnowledgeRequest(BaseModel):
    unit_id: Optional[str] = Field(None, description="Mã chủ điểm mới (tự sinh nếu để trống)")
    topic: str = Field(..., description="Tên chủ đề lịch sử mới do giáo viên bổ sung")
    entity: Optional[str] = Field("Nhân vật / Sự kiện thời Trần", description="Nhân vật hoặc thực thể chính")
    event: Optional[str] = Field("Kháng chiến chống Mông - Nguyên", description="Sự kiện gắn liền")
    fact_chunk: str = Field(..., description="Căn cứ sử liệu chuẩn để trích dẫn (SGK / Đại Việt Sử Ký Toàn Thư)")
    answer: str = Field(..., description="Nội dung bài giảng chuẩn do giáo viên biên soạn")
    sample_questions: List[str] = Field(..., description="Danh sách câu hỏi mẫu của học sinh cho chủ đề này")
    cognitive_level: Optional[str] = Field("THONG_HIEU", description="Mức độ nhận thức (NHAN_BIET, THONG_HIEU, VAN_DUNG)")
    difficulty: Optional[float] = Field(0.5, description="Độ khó (0.1 - 0.9)")

class TeachKnowledgeResponse(BaseModel):
    status: str
    unit_id: str
    topic: str
    added_training_samples: int
    total_units: int

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
    study_material: Optional[StudyMaterialItem] = None

class PersonalizedRecommendationResponse(BaseModel):
    student_id: str
    total_recommendations: int
    recommendations: List[PersonalizedRecommendationItem]

class CampaignMasteryItem(BaseModel):
    campaign_id: str
    campaign_name: str
    average_mastery: float
    mastered_units: int
    total_units: int
    status: str

class CognitiveMasteryItem(BaseModel):
    level_code: str
    level_name: str
    average_mastery: float
    practiced_units: int
    total_units: int

class StudyPlanStep(BaseModel):
    step: int
    phase_name: str
    action_title: str
    description: str
    target_units: List[str]
    estimated_minutes: int

class StudentAccountAnalysisResponse(BaseModel):
    student_id: str
    overall_mastery: float
    student_rank_title: str
    total_attempts: int
    total_correct: int
    accuracy_rate: float
    chat_questions_asked: int
    ai_evaluator_comment: str
    strengths: List[str]
    weaknesses: List[str]
    campaign_breakdown: List[CampaignMasteryItem]
    cognitive_breakdown: List[CognitiveMasteryItem]
    study_plan: List[StudyPlanStep]
    recommended_materials: List[StudyMaterialItem]

class ShortAnswerSubmission(BaseModel):
    student_id: str = Field("student_demo_01", description="ID tài khoản học sinh")
    unit_id: str = Field(..., description="ID chủ điểm lịch sử cần chấm tự luận ngắn")
    student_answer: str = Field(..., description="Câu trả lời tự luận ngắn của học sinh")

class ShortAnswerEvaluationResponse(BaseModel):
    student_id: str
    unit_id: str
    topic: str
    score_10: float
    coverage_ratio: float
    is_passed: bool
    matched_concepts: List[str]
    missing_concepts: List[str]
    ai_feedback: str
    standard_reference_answer: str
    bkt_update: BKTUpdateResponse
