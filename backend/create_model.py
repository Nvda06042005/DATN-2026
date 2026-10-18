"""
FILE 2: XÂY DỰNG & HUẤN LUYỆN MODEL NGÔN NGỮ TỰ NHIÊN (CREATE & TRAIN NLP MODEL)
================================================================================
Chức năng độc lập (1 File riêng biệt theo đúng kiến trúc chuẩn):
1. Đọc dữ liệu huấn luyện từ tập Train 80% (`backend/data/train_data.jsonl`).
2. Xây dựng kiến trúc Hybrid NLP gồm 3 tầng:
   - Tầng 1 (NLU - Natural Language Understanding): Phân tích hình thái câu hỏi tiếng Việt
     (Tại sao, Như thế nào, Ai, Khi nào, Ở đâu, Ý nghĩa, Câu nói), nhận diện cảm xúc
     học sinh và Giải quyết đồng tham chiếu đa lượt (Multi-turn Coreference Resolution).
   - Tầng 2 (ML Classifier & Semantic Retriever): Kết hợp Word N-gram + Char N-gram TF-IDF
     với bộ phân loại học máy có giám sát (Calibrated LinearSVC) được train trên 80% dữ liệu.
   - Tầng 3 (NLG - Natural Language Generation): Bộ sinh ngôn ngữ tự nhiên linh hoạt,
     tự động điều chỉnh lời dẫn nhập, mạch văn và câu hỏi gợi mở theo đúng ngữ cảnh,
     loại bỏ hoàn toàn cảm giác trả lời máy móc, rập khuôn.
3. Lưu model đã huấn luyện ra file `backend/models/dong_a_nlp_model.joblib`.
"""

import json
import re
import unicodedata
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import LinearSVC
from sklearn.calibration import CalibratedClassifierCV
from sklearn.pipeline import Pipeline, FeatureUnion

from context_manager import ConversationalContextManager, SPECIAL_GROUNDED_RESPONSES, context_manager

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
MODEL_DIR = BASE_DIR / "models"

TRAIN_FILE = DATA_DIR / "train_data.jsonl"
MODEL_PATH = MODEL_DIR / "dong_a_nlp_model.joblib"


# ==============================================================================
# 1. TIỆN ÍCH XỬ LÝ NGÔN NGỮ TIẾNG VIỆT (VIETNAMESE TEXT PROCESSING)
# ==============================================================================
def remove_accents(text: str) -> str:
    if not text:
        return ""
    nfd = unicodedata.normalize("NFD", text)
    return "".join(c for c in nfd if not unicodedata.combining(c)).replace("đ", "d").replace("Đ", "D")


def normalize_vi(text: str) -> str:
    if not text:
        return ""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s]", " ", text)
    return " ".join(text.split())


# Từ điển chuẩn hóa viết tắt chuyên biệt Lịch sử 7 (Khắc phục Khó khăn 2)
HISTORICAL_ABBREVIATIONS: Dict[str, str] = {
    "kccm": "kháng chiến chống mông nguyên",
    "kccn": "kháng chiến chống nguyên mông",
    "tqt": "trần quốc toản",
    "thđ": "trần hưng đạo",
    "thd": "trần hưng đạo",
    "tqk": "trần quang khải",
    "tnd": "trần nhật duật",
    "ttd": "trần thủ độ",
    "ttđ": "trần thủ độ",
    "tbt": "trần bình trọng",
    "tkd": "trần khánh dư",
    "pnl": "phạm ngũ lão",
    "bd": "bạch đằng",
    "bđ": "bạch đằng",
    "dh": "diên hồng",
    "bt": "bình than",
    "vknt": "vườn không nhà trống",
    "bln": "bình lệ nguyên",
    "dbd": "đông bộ đầu",
    "wả": "quả",
    "wa": "quả",
    "ko": "không",
    "k": "không",
    "nhìu": "nhiều",
    "zậy": "vậy",
    "z": "vậy",
    "đc": "được",
    "dc": "được",
    "wá": "quá"
}


def expand_abbreviations(text: str) -> str:
    """Ánh xạ từ viết tắt sang dạng đầy đủ gắn với ngữ cảnh bài học Lịch sử 7."""
    if not text:
        return ""
    words = text.split()
    expanded = []
    for w in words:
        clean_w = re.sub(r"[^\w]", "", w.lower())
        if clean_w in HISTORICAL_ABBREVIATIONS:
            expanded.append(HISTORICAL_ABBREVIATIONS[clean_w])
        else:
            expanded.append(w)
    return " ".join(expanded)


def build_bilingual_features(text: str) -> str:
    """Kết hợp chuỗi có dấu, không dấu và đặc trưng ngữ nghĩa (Semantic Lexicon Features)."""
    expanded_text = expand_abbreviations(text)
    norm = normalize_vi(expanded_text)
    unacc = normalize_vi(remove_accents(expanded_text))
    words = unacc.split()
    tags = []
    if any(k in unacc for k in ["lan 1", "lan thu 1", "lan thu nhat", "lan mot", "lan dau", "1258"]):
        tags.append("__kc_lan_1__ __kc_lan_1__")
    if any(k in unacc for k in ["lan 2", "lan thu 2", "lan thu hai", "lan hai", "1285"]):
        tags.append("__kc_lan_2__ __kc_lan_2__")
    if any(k in unacc for k in ["lan 3", "lan thu 3", "lan thu ba", "lan ba", "1287", "1288"]):
        tags.append("__kc_lan_3__ __kc_lan_3__")

    # Điểm neo ngữ nghĩa chuyên sâu cho các trận đánh & hội nghị
    if "dien hong" in unacc:
        tags.append("__dien_hong__ __dien_hong__ __dien_hong__")
    if "binh than" in unacc:
        tags.append("__binh_than__ __binh_than__ __binh_than__")
    if "dong bo dau" in unacc:
        tags.append("__dong_bo_dau__ __dong_bo_dau__ __dong_bo_dau__")
    if any(k in unacc for k in ["binh le nguyen", "le phu tran", "le tan", "van thuyen"]):
        tags.append("__binh_le_nguyen__ __binh_le_nguyen__ __binh_le_nguyen__")
    if "bach dang" in unacc:
        tags.append("__bach_dang__ __bach_dang__ __bach_dang__")
    if any(k in unacc for k in ["van don", "thuyen luong", "truong van ho"]):
        tags.append("__van_don__ __van_don__ __van_don__")
    if any(k in unacc for k in ["thoat hoan", "chui ong", "ong dong"]):
        tags.append("__thoat_hoan_ong_dong__ __thoat_hoan_ong_dong__")
    if any(k in unacc for k in ["qua cam", "bop nat", "sau chu vang", "6 chu vang", "pha cuong dich"]):
        tags.append("__tran_quoc_toan__ __tran_quoc_toan__")
    if any(k in unacc for k in ["tran binh trong", "quy nuoc nam"]):
        tags.append("__tran_binh_trong__ __tran_binh_trong__")
    if any(k in unacc for k in ["hich tuong si", "sat that"]):
        tags.append("__hich_tuong_si__ __hich_tuong_si__")
    if any(k in unacc for k in [
        "rut khoi thang long", "rut lui khoi thang long", "roi thang long", "chu dong rut",
        "vuon khong nha trong", "vknt", "thanh trong rong", "so tan khoi thang long",
        "chien thuat rut lui", "rut lui khong dong nghia", "rut lui khong phai that bai"
    ]):
        tags.append("__vuon_khong_nha_trong__ __vuon_khong_nha_trong__ __vuon_khong_nha_trong__")
    if any(k in unacc for k in [
        "dong va manh", "van thua", "that bai truoc", "nguyen nhan thang loi",
        "vi sao thang", "tai sao thang", "vi sao thua", "tai sao thua",
        "nuoc nho thang", "danh thang quan mong", "danh thang de che"
    ]):
        tags.append("__causes_of_victory__ __causes_of_victory__ __causes_of_victory__")

    if any(w in words for w in ["hello", "hi"]) or any(k in unacc for k in ["xin chao", "chao thay", "chao ban", "chao tro ly"]):
        tags.append("__intent_greeting__ __intent_greeting__")
    if any(w in words for w in ["thanks"]) or any(k in unacc for k in ["cam on", "thank you", "tuyet voi de hieu"]):
        tags.append("__intent_thanks__ __intent_thanks__")
    if any(k in unacc for k in ["khong biet dap an", "chua hieu bai", "kho qua", "khong biet lam", "giup minh voi", "khong biet cau tra loi", "quen mat roi", "chi em cach", "kho nho qua"]):
        tags.append("__intent_struggle__ __intent_struggle__")
    tag_str = " ".join(tags)
    return f"{norm} {unacc} {tag_str}".strip()


# ==============================================================================
# 2. TẦNG HIỂU NGÔN NGỮ TỰ NHIÊN (NLU - QUESTION TYPE & COREFERENCE ANALYZER)
# ==============================================================================
class VietnameseNLU:
    """
    Phân tích ý định ngữ pháp của câu hỏi để giúp AI trả lời đúng trọng tâm
    thay vì trả lời máy móc một đoạn văn cố định.
    """
    QUESTION_PATTERNS = {
        "VERIFICATION": [
            "dung khong", "co dung khong", "co dung la", "phai khong", "co phai la",
            "co phai", "co the ket luan", "chi vi", "chi do", "co that su", "co that khong"
        ],
        "COUNTERFACTUAL": [
            "neu ", "neu nhu", "gia su", "gia dinh", "bat loi gi", "thi sao neu", "neu quan", "neu co"
        ],
        "COMPARISON": [
            "so sanh", "tuong tu khong", "diem chung", "giong nhau", "khac nhau",
            "co gi giong", "co gi khac", "diem giong", "diem tuong dong"
        ],
        "EVIDENCE": [
            "chinh xac bao nhieu", "bao nhieu binh si", "bao nhieu quan", "so lieu",
            "cau noi nguyen van", "nguyen van", "nguon trich dan", "trich dan",
            "loai thuoc no", "su lieu nao", "tai lieu nao ghi"
        ],
        "FACT": [
            "lan thu may", "lan may", "ai chi huy", "ai la", "la ai", "nam nao",
            "thoi gian nao", "khi nao", "bao gio", "o dau", "tai dau", "dia diem nao",
            "la tran nao", "tran nao", "bao nhieu lan", "ai da", "cua ai", "ben nao", "khuc song nao"
        ],
        "CAUSE": [
            "vi sao", "tai sao", "nguyen nhan", "ly do", "do dau", "muc dich", "am muu", "de lam gi"
        ],
        "EVENT": [
            "dien bien", "cuc dien thay doi", "cuc dien", "nhu the nao", "ra sao",
            "quan ta lam gi", "ket qua", "ke sach", "lam the nao", "bang cach nao", "chien thuat"
        ],
        "SIGNIFICANCE": [
            "y nghia", "vai tro", "bai hoc", "gia tri", "tam voc", "tac dong", "he qua", "anh huong", "the hien dieu gi"
        ],
        "FOLLOW_UP": [
            "khac phuc bat loi", "chien thuat rut lui", "sau do thi sao", "tiep theo",
            "the con", "con... thi sao", "sao nua", "lam gi tiep theo"
        ]
    }

    ANAPHORA_PRONOUNS = [
        "ong ay", "ong ta", "vi tuong do", "vi vua do", "nguoi do", "chang",
        "tran do", "cuoc chien do", "hoi nghi do", "luc do", "sau do", "the con"
    ]

    CROSS_ERA_RULES = [
        {
            "keywords": ["ham nghi", "vua ham nghi", "can vuong"],
            "unit_id": "CROSS_ERA_HAM_NGHI"
        },
        {
            "keywords": ["ngo quyen", "tien ngo vuong", "nam 938", "nam han"],
            "unit_id": "CROSS_ERA_NGO_QUYEN"
        },
        {
            "keywords": [
                "quang trung", "nguyen hue", "tay son", "dong da",
                "le loi", "nguyen trai", "lam son", "binh ngo dai cao",
                "ly thuong kiet", "nhu nguyet", "nam quoc son ha",
                "hai ba trung", "dinh bo linh", "ho chi minh", "vo nguyen giap", "dien bien phu"
            ],
            "unit_id": "CROSS_ERA_QUANG_TRUNG_LE_LOI_LY_THUONG_KIET"
        }
    ]

    DOMAIN_VOCAB = [
        "tran", "mong", "nguyen", "dai viet", "dong a", "thang long", "bach dang",
        "van don", "ham tu", "chuong duong", "tay ket", "binh than", "dien hong",
        "dong bo dau", "binh le nguyen", "van kiep", "quoc toan", "hung dao", "quoc tuan",
        "tran thu do", "binh trong", "khanh du", "quang khai", "nhat duat", "yet kieu",
        "da tuong", "pham ngu lao", "le tan", "le phu tran", "ha khuat", "thoat hoan",
        "toa do", "o ma nhi", "phan tiep", "truong van ho", "ngot luong hop thai",
        "hot tat liet", "qua cam", "ong dong", "coc go", "coc ngam", "vuon khong nha trong",
        "sat that", "hich tuong si", "bo lao", "thuyen luong", "khang chien", "lan 1",
        "lan 2", "lan 3", "lan thu nhat", "lan thu hai", "lan thu ba", "1258", "1282",
        "1284", "1285", "1287", "1288", "bai 13", "lich su",
        # Từ vựng quân sự, chiến thuật & tư duy lịch sử (Chống OOD giả đối với câu hỏi suy luận)
        "chien thuat", "rut lui", "chien luoc", "ke sach", "dau hang", "phan cong",
        "thao chay", "that bai", "dong va manh", "van thua", "thua", "danh thang",
        "thang loi", "boi vi sao", "bao toan luc luong", "nghe thuat quan su", "the giac", "doan ket"
    ]

    @classmethod
    def detect_question_type(cls, query: str) -> str:
        unacc = normalize_vi(remove_accents(query))
        for q_type, patterns in cls.QUESTION_PATTERNS.items():
            for pat in patterns:
                if pat in unacc:
                    return q_type
        return "EVENT"

    @classmethod
    def detect_cross_era(cls, query: str) -> Optional[str]:
        unacc = normalize_vi(remove_accents(query))
        for rule in cls.CROSS_ERA_RULES:
            for kw in rule["keywords"]:
                if kw in unacc:
                    return rule["unit_id"]
        return None

    @classmethod
    def has_historical_signal(cls, query: str) -> bool:
        unacc = normalize_vi(remove_accents(query))
        words = set(unacc.split())

        # 1. Từ khóa giao tiếp / câu hỏi tâm lý học sinh
        conversational_words = {"xin", "chao", "hello", "hi", "cam", "on", "thanks", "alo"}
        if conversational_words & words:
            conv_phrases = [
                "xin chao", "chao thay", "chao co", "chao ban", "cam on", "thank you",
                "khong biet", "chua hieu", "kho qua", "giup em", "giup minh", "dap an", "quen mat", "chi em"
            ]
            if any(cp in unacc for cp in conv_phrases) or words & {"hello", "hi", "thanks"}:
                return True

        # 2. Từ vựng chuyên đề Lịch sử thời Trần (khớp từ trọn vẹn theo ranh giới từ)
        for kw in cls.DOMAIN_VOCAB:
            if re.search(rf"\b{re.escape(kw)}\b", unacc):
                return True
        return False

    @classmethod
    def rewrite_query_with_session(cls, query: str, session_data: Optional[Dict[str, Any]]) -> Tuple[str, bool]:
        """
        Khắc phục Khó khăn 1: Đại từ trong hội thoại.
        Lưu trạng thái server theo session_id (last_entity, last_individual_entity, last_event).
        Khi phát hiện đại từ 'chàng', 'ông', 'ông ấy', 'trận đó', viết lại câu hỏi trước khi đưa vào pipeline:
        'Vì sao chàng lại bóp nát quả cam?' -> 'Vì sao Trần Quốc Toản lại bóp nát quả cam?'.
        'Sau trận đó thì sao?' -> 'Sau [last_event] thì sao?'.
        """
        if not session_data:
            return query, False
        last_entity = session_data.get("last_entity")
        last_event = session_data.get("last_event")

        rewritten = query
        is_rewritten = False

        # Nhận diện các motif lịch sử đặc trưng gắn liền với nhân vật cụ thể
        unacc_q = remove_accents(query).lower()
        if any(k in unacc_q for k in ["qua cam", "bop nat", "sau chu vang", "6 chu vang"]) and "tran quoc toan" not in unacc_q:
            effective_entity = "Trần Quốc Toản"
        elif any(k in unacc_q for k in ["chui ong", "ong dong"]) and "thoat hoan" not in unacc_q:
            effective_entity = "Thoát Hoan"
        elif any(k in unacc_q for k in ["dau chua roi xuong dat", "chem dau toi"]) and "tran hung dao" not in unacc_q:
            effective_entity = "Trần Hưng Đạo"
        elif any(k in unacc_q for k in ["cuop thuyen luong", "van don"]) and "tran khanh du" not in unacc_q:
            effective_entity = "Trần Khánh Dư"
        else:
            effective_entity = last_entity

        # Thay thế đại từ nhân vật bằng thực thể gần nhất
        person_pronouns = ["chàng", "ông ấy", "ông ta", "ông", "vị tướng đó", "vị vua đó", "người đó", "họ"]
        if effective_entity:
            for p in person_pronouns:
                pattern = re.compile(rf"\b{re.escape(p)}\b", re.IGNORECASE)
                if pattern.search(rewritten):
                    target_ent = effective_entity
                    # Nếu đại từ là "chàng" (nam anh hùng trẻ tuổi), không dùng thực thể tập thể như "Vua & Vương hầu"
                    if p == "chàng" and ("&" in target_ent or "và" in target_ent or "vua" in target_ent.lower()):
                        target_ent = session_data.get("last_individual_entity", "Trần Quốc Toản")
                    rewritten = pattern.sub(target_ent, rewritten, count=1)
                    is_rewritten = True
                    break

        # Thay thế đại từ sự kiện bằng sự kiện gần nhất
        event_pronouns = ["trận đó", "cuộc chiến đó", "hội nghị đó", "sự kiện đó", "chiến dịch đó"]
        if last_event:
            for ep in event_pronouns:
                pattern = re.compile(rf"\b{re.escape(ep)}\b", re.IGNORECASE)
                if pattern.search(rewritten):
                    rewritten = pattern.sub(last_event, rewritten, count=1)
                    is_rewritten = True
                    break

        return rewritten, is_rewritten


# ==============================================================================
# 3. TẦNG SINH NGÔN NGỮ TỰ NHIÊN (NLG - NATURAL CONVERSATIONAL COMPOSER)
# ==============================================================================
class ConversationalNLG:
    """
    Bộ khung diễn đạt tự nhiên (Natural Discourse Composer):
    - Thay đổi lời mở đầu linh hoạt tùy theo loại câu hỏi (WHY, HOW, WHO, QUOTE, OVERVIEW)
      và trạng thái hội thoại (câu hỏi đầu tiên vs. câu hỏi nối tiếp).
    - Hỗ trợ hóa thân nhân vật lịch sử (Persona Roleplay) mượt mà.
    """
    DIRECT_ANSWER_TYPES = {
        "FACT", "VERIFICATION", "EVIDENCE", "COUNTERFACTUAL", "COMPARISON",
        "WHO", "WHEN", "WHERE"
    }

    NATURAL_LEAD_INS = {
        "CAUSE": [
            "Về nguyên nhân của sự việc này:\n\n",
            "Lý giải cho điều này nằm ở các điểm cốt lõi sau:\n\n"
        ],
        "EVENT": [
            "Về diễn biến cụ thể của sự kiện này:\n\n",
            "Mạch diễn biến chính được ghi nhận như sau:\n\n"
        ],
        "SIGNIFICANCE": [
            "Về mặt ý nghĩa và tầm vóc lịch sử:\n\n",
            "Giá trị lịch sử to lớn của sự kiện này thể hiện qua các điểm sau:\n\n"
        ],
        "FOLLOW_UP": [
            "Tiếp nối diễn biến trước đó:\n\n",
            "Về chi tiết tiếp theo này:\n\n"
        ],
        "FOLLOW_UP_BRIDGE": [
            "Tiếp nối diễn biến trước đó:\n\n",
            "Về chi tiết tiếp theo này:\n\n"
        ],
        "OVERVIEW": [
            "Tổng quan sự kiện lịch sử này như sau:\n\n"
        ],
        "QUOTE": [
            "Lời khẳng định bất hủ này gắn liền với khí phách ngút trời thời nhà Trần:\n\n"
        ],
        "WHY": [
            "Về nguyên nhân của sự việc này:\n\n",
            "Lý giải cho điều này nằm ở các điểm cốt lõi sau:\n\n"
        ],
        "HOW": [
            "Về diễn biến cụ thể của sự kiện này:\n\n",
            "Mạch diễn biến chính được ghi nhận như sau:\n\n"
        ],
        "MEANING": [
            "Về mặt ý nghĩa và tầm vóc lịch sử:\n\n",
            "Giá trị lịch sử to lớn của sự kiện này thể hiện qua các điểm sau:\n\n"
        ]
    }

    PERSONAS = {
        "TRAN_HUNG_DAO": {
            "name": "Quốc Công Tiết Chế Hưng Đạo Đại Vương",
            "openers": [
                "Tiểu hữu hỏi đúng điều ta từng trăn trở nơi quân trướng! ",
                "Hậu thế muốn tường tận việc quân cơ thời Đông A ư? Hãy nghe ta kể: ",
                "Nhớ lại những ngày khói lửa chống giặc Thát, ta nói cho tiểu hữu hay: "
            ]
        },
        "TRAN_QUOC_TOAN": {
            "name": "Hoài Văn Hầu Trần Quốc Toản",
            "openers": [
                "Bạn đồng trang lứa hỏi làm lòng ta lại sôi sục nhiệt huyết! ",
                "Nghe bạn hỏi, ta nhớ như in ngày dựng cờ sáu chữ vàng năm ấy: ",
                "Tuy tuổi trẻ nhưng chí giữ nước không hề nhỏ! Ta kể bạn nghe nhé: "
            ]
        },
        "TRAN_THU_DO": {
            "name": "Thái Sư Trần Thủ Độ",
            "openers": [
                "Lão phu nói thẳng để tiểu hữu rõ bản lĩnh của triều Trần: ",
                "Việc lớn giữ giang sơn không thể nao núng! Tiểu hữu hãy nghe đây: "
            ]
        },
        "TRAN_BINH_TRONG": {
            "name": "Bảo Nghĩa Vương Trần Bình Trọng",
            "openers": [
                "Một tấc đất nước Nam cũng không thể nhường cho giặc! Ta kể cho hậu thế rõ: ",
                "Khí tiết người Đại Việt ngàn năm vẫn sáng! Tiểu hữu hãy nghe lời ta: "
            ]
        },
        "TRAN_THANH_TONG": {
            "name": "Thượng Hoàng Trần Thánh Tông",
            "openers": [
                "Trẫm cùng muôn dân trăm họ đồng lòng mới làm nên cơ nghiệp ấy. Tiểu hữu hãy nghe: ",
                "Lấy dân làm gốc là đạo trị quốc của nhà Trần. Trẫm giải thích cho tiểu hữu nhé: "
            ]
        }
    }

    @classmethod
    def compose(
        cls,
        query: str,
        unit_record: Dict[str, Any],
        detected_q_type: str,
        is_coref_followup: bool = False,
        character_id: Optional[str] = None,
        turn_seed: int = 0
    ) -> Dict[str, Any]:
        persona = cls.PERSONAS.get(character_id) if character_id else None
        char_name = persona["name"] if persona else "Trợ Lý AI Lịch Sử Đông A"

        unit_q_type = unit_record.get("q_type", "EVENT")
        base_answer = unit_record.get("answer", "")
        follow_up = unit_record.get("follow_up", "")

        # Đối với câu giao tiếp (Chào hỏi, Cảm ơn, Hỏi bài khó) hoặc Phân biệt triều đại
        if (unit_q_type in ["INTENT", "CROSS_ERA"] or 
            unit_record.get("category") in ["CONVERSATIONAL_INTENT", "CROSS_ERA_SAFEGUARD"] or 
            "CROSS_ERA" in unit_record.get("unit_id", "")):
            return {
                "answer": base_answer,
                "character_name": char_name,
                "is_not_found": False
            }

        # Nếu là loại câu hỏi yêu cầu trả lời trực tiếp ngay ở câu 1-2 (FACT, VERIFICATION, EVIDENCE, COUNTERFACTUAL, COMPARISON)
        if (detected_q_type in cls.DIRECT_ANSWER_TYPES or 
            unit_q_type in cls.DIRECT_ANSWER_TYPES or 
            unit_record.get("category") in cls.DIRECT_ANSWER_TYPES):
            lead_in = ""
        else:
            # Chọn lời dẫn tự nhiên dựa trên ngữ cảnh câu hỏi của người dùng
            idx = abs(hash(query) + turn_seed)
            if persona:
                openers = persona["openers"]
                lead_in = openers[idx % len(openers)] + "\n\n"
            elif is_coref_followup:
                bridges = cls.NATURAL_LEAD_INS["FOLLOW_UP_BRIDGE"]
                lead_in = bridges[idx % len(bridges)]
            else:
                effective_type = detected_q_type if detected_q_type in cls.NATURAL_LEAD_INS else unit_q_type
                candidates = cls.NATURAL_LEAD_INS.get(effective_type, cls.NATURAL_LEAD_INS.get("OVERVIEW", [""]))
                lead_in = candidates[idx % len(candidates)]

        # Ghép mạch văn tự nhiên: Lời dẫn + Nội dung giải thích
        composed_text = f"{lead_in}{base_answer}"

        return {
            "answer": composed_text,
            "character_name": char_name,
            "is_not_found": False
        }


# ==============================================================================
# 4. KIẾN TRÚC MODEL NLP TỔNG THỂ (DONG A HYBRID NLP MODEL)
# ==============================================================================
class DongANLPModel:
    """
    Model Ngôn ngữ Tự nhiên hoàn chỉnh được huấn luyện từ tập Train (80%)
    và đóng gói độc lập để phục vụ Test (20%) cũng như Main API.
    """
    def __init__(self):
        self.classifier_pipeline: Optional[Pipeline] = None
        self.semantic_vectorizer: Optional[TfidfVectorizer] = None
        self.semantic_matrix = None
        self.train_records: List[Dict[str, Any]] = []
        self.unit_lookup: Dict[str, Dict[str, Any]] = {}
        # Bộ quản lý ngữ cảnh hội thoại đa lượt (Conversational Context Manager)
        self.context_manager = ConversationalContextManager()
        self.session_memory: Dict[str, Dict[str, Any]] = self.context_manager.sessions

    def fit(self, train_records: List[Dict[str, Any]]):
        """
        Huấn luyện đồng thời:
        1. Supervised Topic & Intent Classifier (Word + Char N-gram TF-IDF + Calibrated LinearSVC)
        2. Fine-grained Semantic Vector Space trên tập Train (80%)
        """
        self.train_records = train_records
        for r in train_records:
            uid = r["unit_id"]
            if uid not in self.unit_lookup:
                self.unit_lookup[uid] = r

        # Nạp các đơn vị phản hồi đặc biệt (Làm rõ đại từ vua, Đính chính, Ngoài SGK)
        for spec_uid, spec_rec in SPECIAL_GROUNDED_RESPONSES.items():
            if spec_uid not in self.unit_lookup:
                self.unit_lookup[spec_uid] = spec_rec

        X_texts = [build_bilingual_features(r["user_query"]) for r in train_records]
        y_labels = [r["unit_id"] for r in train_records]

        # 1. Pipeline Phân loại Học máy (Word N-grams + Character N-grams + Calibrated SVM)
        feature_union = FeatureUnion([
            ("word_tfidf", TfidfVectorizer(ngram_range=(1, 3), token_pattern=r"(?u)\b\w+\b", sublinear_tf=True)),
            ("char_tfidf", TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), sublinear_tf=True))
        ])

        base_svc = LinearSVC(C=1.5, class_weight="balanced", random_state=42)
        calibrated_clf = CalibratedClassifierCV(estimator=base_svc, cv=3)

        self.classifier_pipeline = Pipeline([
            ("features", feature_union),
            ("clf", calibrated_clf)
        ])
        self.classifier_pipeline.fit(X_texts, y_labels)

        # 2. Không gian Vector Ngữ nghĩa (Semantic Retrieval Matrix) kết hợp câu hỏi + nội dung
        corpus_docs = []
        for r in train_records:
            q_part = r["user_query"]
            topic_part = r.get("topic", "")
            fact_part = r.get("grounding_source", {}).get("fact_chunk", "")
            # Nhân trọng số cho câu hỏi để ưu tiên khớp sát câu hỏi tự nhiên
            combined = f"{q_part} {q_part} {q_part} {topic_part} {fact_part}"
            corpus_docs.append(build_bilingual_features(combined))

        self.semantic_vectorizer = TfidfVectorizer(ngram_range=(1, 2), token_pattern=r"(?u)\b\w+\b", sublinear_tf=True)
        self.semantic_matrix = self.semantic_vectorizer.fit_transform(corpus_docs)

        return self

    def predict_unit(self, query: str, session_id: str = "default") -> Tuple[str, float, Dict[str, Any]]:
        """
        Dự đoán đơn vị tri thức (unit_id) tốt nhất cùng độ tự tin (confidence score).
        Tích hợp Context Manager để giải quyết câu hỏi nối tiếp, đại từ, tiền đề sai và làm rõ vua Trần.
        """
        if not hasattr(self, "context_manager") or self.context_manager is None:
            self.context_manager = ConversationalContextManager()
            if hasattr(self, "session_memory") and self.session_memory:
                self.context_manager.sessions = self.session_memory
            else:
                self.session_memory = self.context_manager.sessions

        if not query or not query.strip():
            return "OOD_RANDOM_AND_OFFTOPIC", 1.0, {"reason": "empty"}

        # 0. Giải quyết ngữ cảnh hội thoại, đại từ, tiền đề sai & làm rõ
        rewritten_query, is_rewritten, override_res = self.context_manager.resolve_query(query, session_id=session_id)
        if override_res:
            spec_uid = override_res["unit_id"]
            if spec_uid not in self.unit_lookup:
                self.unit_lookup[spec_uid] = override_res
            return spec_uid, 0.99, {
                "is_coref": False,
                "q_type": override_res.get("category", "CLARIFICATION"),
                "override_result": override_res,
                "raw_cosine": 1.0,
                "rewritten": rewritten_query
            }

        normalized_query = expand_abbreviations(rewritten_query)

        # 1. Kiểm tra ranh giới triều đại trước (Cross-Era Guardrail)
        cross_era_uid = VietnameseNLU.detect_cross_era(normalized_query)
        if cross_era_uid and cross_era_uid in self.unit_lookup:
            return cross_era_uid, 0.98, {"is_coref": is_rewritten, "q_type": "CROSS_ERA", "rewritten": rewritten_query}

        # 2. Kiểm tra tín hiệu miền kiến thức (tránh các số ngẫu nhiên hoặc câu vô nghĩa)
        has_signal = VietnameseNLU.has_historical_signal(normalized_query)
        detected_q_type = VietnameseNLU.detect_question_type(normalized_query)

        feat_text = build_bilingual_features(normalized_query)

        # 3. Tính xác suất từ Classifier học máy
        probs = self.classifier_pipeline.predict_proba([feat_text])[0]
        classes = self.classifier_pipeline.classes_
        clf_scores = {classes[i]: float(probs[i]) for i in range(len(classes))}

        # 4. Tính độ tương đồng Cosine từ Semantic Vectorizer + Re-ranking theo loại câu hỏi (q_type)
        q_vec = self.semantic_vectorizer.transform([feat_text])
        cos_sims = (self.semantic_matrix @ q_vec.T).toarray().flatten()

        unit_sem_scores: Dict[str, float] = {}
        for idx, sim in enumerate(cos_sims):
            rec = self.train_records[idx]
            uid = rec["unit_id"]
            bonus = 0.08 if rec.get("q_type") == detected_q_type else 0.0
            score = float(sim) + bonus
            if score > unit_sem_scores.get(uid, 0.0):
                unit_sem_scores[uid] = score

        # 5. Hợp nhất điểm Hybrid (60% ML Classifier + 40% Semantic Cosine)
        combined_scores: Dict[str, float] = {}
        for uid in classes:
            c_score = clf_scores.get(uid, 0.0)
            s_score = unit_sem_scores.get(uid, 0.0)
            combined_scores[uid] = 0.60 * c_score + 0.40 * s_score

        # Sắp xếp top 3 cụm tri thức có điểm kết hợp cao nhất
        sorted_candidates = sorted(combined_scores.items(), key=lambda x: x[1], reverse=True)
        top_3 = []
        for uid, score in sorted_candidates[:3]:
            top_3.append({
                "unit_id": uid,
                "combined_score": round(float(score), 4),
                "classifier_prob": round(clf_scores.get(uid, 0.0), 4),
                "semantic_score": round(unit_sem_scores.get(uid, 0.0), 4)
            })

        best_uid = sorted_candidates[0][0]
        best_score = sorted_candidates[0][1]
        max_raw_cos = float(np.max(cos_sims)) if len(cos_sims) > 0 else 0.0

        # ======================================================================
        # CỔNG PHÙ HỢP Ý ĐỊNH & KIỂM SOÁT CHẤT LƯỢNG (RELEVANCE GATE)
        # ======================================================================
        gate_rationale = "ML Classifier + Semantic Cosine Hybrid Ranking"
        unacc_q = normalize_vi(remove_accents(normalized_query))

        # Gate 1: Câu hỏi về nguyên nhân giặc thua dù đông và mạnh / nguyên nhân thắng lợi
        is_why_enemy_lost = any(k in unacc_q for k in [
            "dong va manh", "van thua", "vi sao thua", "tai sao thua",
            "nguyen nhan thang loi", "vi sao thang", "tai sao thang", "nuoc nho thang",
            "danh thang quan mong", "danh thang de che"
        ])
        if is_why_enemy_lost and best_uid != "CAUSES_OF_VICTORY":
            causes_score = combined_scores.get("CAUSES_OF_VICTORY", 0.0)
            if causes_score > 0.03 or "CAUSES_OF_VICTORY" in [c["unit_id"] for c in top_3]:
                best_uid = "CAUSES_OF_VICTORY"
                best_score = max(best_score, causes_score)
                gate_rationale = "Relevance Gate: Re-routed query asking why enemy lost / causes of victory to CAUSES_OF_VICTORY"

        # Gate 2: Câu hỏi về rút khỏi Thăng Long / kế sách rút lui / chiến thuật rút lui
        is_withdraw_thang_long = any(k in unacc_q for k in [
            "rut khoi thang long", "rut lui khoi thang long", "roi thang long",
            "chu dong rut khoi thang long", "tam rut khoi thang long", "bo thang long",
            "chien thuat rut lui", "rut lui khong dong nghia", "rut lui khong phai that bai"
        ])
        if is_withdraw_thang_long and best_uid != "KC1_VUON_KHONG_NHA_TRONG":
            vknt_score = combined_scores.get("KC1_VUON_KHONG_NHA_TRONG", 0.0)
            if vknt_score > 0.03 or "KC1_VUON_KHONG_NHA_TRONG" in [c["unit_id"] for c in top_3]:
                best_uid = "KC1_VUON_KHONG_NHA_TRONG"
                best_score = max(best_score, vknt_score)
                gate_rationale = "Relevance Gate: Re-routed withdrawal/Thăng Long tactical query to KC1_VUON_KHONG_NHA_TRONG"

        # Gate 3: Câu hỏi hành động tiếp theo sau khi rút khỏi Thăng Long
        is_after_withdraw_next = any(k in unacc_q for k in [
            "sau khi rut khoi thang long thi quan ta lam gi",
            "sau khi rut khoi thang long quan ta lam gi",
            "quan tran lam gi tiep theo de phan cong"
        ])
        if is_after_withdraw_next and best_uid not in ["KC1_DONG_BO_DAU", "KC1_VUON_KHONG_NHA_TRONG"]:
            dbd_score = combined_scores.get("KC1_DONG_BO_DAU", 0.0)
            best_uid = "KC1_DONG_BO_DAU" if dbd_score > 0.05 else "KC1_VUON_KHONG_NHA_TRONG"
            gate_rationale = "Relevance Gate: Connected next military action after withdrawal to counter-attack at Đông Bộ Đầu"

        # Ghi log chuẩn đoán chi tiết
        import logging
        logging.info(
            f"[RETRIEVAL TOP-3] Query: '{query}' -> Rewritten: '{rewritten_query}'\n"
            f"  • Top 3: {top_3}\n"
            f"  • Selected: {best_uid} (Score: {best_score:.4f})\n"
            f"  • Rationale: {gate_rationale}"
        )

        # Ngưỡng an toàn chống trả lời bừa (Out-of-Domain Rejection)
        if best_uid == "OOD_RANDOM_AND_OFFTOPIC" or not has_signal or best_score < 0.14:
            return "OOD_RANDOM_AND_OFFTOPIC", best_score, {
                "is_coref": is_rewritten,
                "q_type": "OOD",
                "raw_cosine": max_raw_cos,
                "rewritten": rewritten_query,
                "top_3_retrieved": top_3,
                "selection_rationale": "Rejected as Out-of-Domain (low score or missing domain signal)"
            }

        return best_uid, best_score, {
            "is_coref": is_rewritten,
            "q_type": detected_q_type,
            "raw_cosine": max_raw_cos,
            "rewritten": rewritten_query,
            "top_3_retrieved": top_3,
            "selection_rationale": gate_rationale
        }

    def generate_natural_response(
        self,
        query: str,
        character_id: Optional[str] = None,
        session_id: str = "default"
    ) -> Dict[str, Any]:
        """
        Hàm suy luận chính trả về câu trả lời tự nhiên, nguồn trích dẫn và phần thưởng game.
        """
        if not hasattr(self, "context_manager") or self.context_manager is None:
            self.context_manager = ConversationalContextManager()
            if hasattr(self, "session_memory") and self.session_memory:
                self.context_manager.sessions = self.session_memory
            else:
                self.session_memory = self.context_manager.sessions

        best_uid, confidence, meta = self.predict_unit(query, session_id=session_id)

        # 1. Trường hợp có override_result (Làm rõ đại từ vua, Đính chính tiền đề sai, Thông tin ngoài phạm vi)
        if "override_result" in meta:
            override = meta["override_result"]
            speaker = ConversationalNLG.PERSONAS.get(character_id, {}).get("name", "Trợ Lý AI Lịch Sử Đông A")
            src = override.get("grounding_source")
            sources = []
            if src and override.get("category") not in ["COUNTERFACTUAL", "ABSENT", "FALSE_PREMISE", "COMPARISON"] and src.get("fact_chunk"):
                sources.append({
                    "doc_name": src.get("doc_name", "SGK Lịch sử 7 (KNTT)"),
                    "page_number": src.get("page_number"),
                    "curriculum_match": src.get("curriculum_match", "SGK Lịch sử 7 - Bài 13"),
                    "fact_chunk": src.get("fact_chunk", "")
                })
            self.context_manager.update_session(session_id, query, override, override["answer"], meta)
            self.session_memory = self.context_manager.sessions

            import logging
            ans_excerpt = (override["answer"][:100] + "...") if len(override["answer"]) > 100 else override["answer"]
            logging.info(
                f"\n[RETRIEVAL & NLG TRACE (SPECIAL GROUNDED)]\n"
                f"  • Original Query    : '{query}'\n"
                f"  • Rewritten Query   : '{meta.get('rewritten', query)}'\n"
                f"  • Classified Intent : {meta.get('q_type', 'SPECIAL_GROUNDED')}\n"
                f"  • Selected Unit     : {override['unit_id']}\n"
                f"  • Final Answer Excerpt: {ans_excerpt}\n"
            )

            return {
                "unit_id": override["unit_id"],
                "confidence": round(confidence, 4),
                "answer": override["answer"],
                "character_name": speaker,
                "grounding_sources": sources,
                "badge_unlocked": "Sử gia thông thái",
                "exp_reward": 25,
                "is_not_found": False
            }

        # 2. Nếu nằm ngoài phạm vi bài học (Out-of-Domain)
        if best_uid == "OOD_RANDOM_AND_OFFTOPIC" or best_uid not in self.unit_lookup:
            clean_q = query.strip()
            speaker = "ta" if character_id else "thầy"
            ood_ans = (
                f"⚠️ Rất tiếc, {speaker} chưa tìm thấy thông tin lịch sử phù hợp với nội dung **\"{clean_q}\"** "
                "trong chuyên đề **Ba lần kháng chiến chống quân Mông – Nguyên (1258 – 1288)** (Lịch sử 7).\n\n"
                "Em có thể thử hỏi những câu tự nhiên xoay quanh bài học như:\n"
                "• *\"Vì sao Trần Quốc Toản lại bóp nát quả cam?\"*\n"
                "• *\"Tại sao Thoát Hoan phải chui vào ống đồng năm 1285?\"*\n"
                "• *\"Trận Bạch Đằng năm 1288 của Trần Hưng Đạo diễn ra như thế nào?\"*\n"
                "• *\"Kế sách Vườn không nhà trống có tác dụng gì?\"*"
            )
            self.context_manager.update_session(
                session_id, query, {"unit_id": "OOD_RANDOM_AND_OFFTOPIC"}, ood_ans, meta
            )
            self.session_memory = self.context_manager.sessions

            import logging
            logging.info(
                f"\n[RETRIEVAL & NLG TRACE (OUT OF DOMAIN)]\n"
                f"  • Original Query    : '{query}'\n"
                f"  • Rewritten Query   : '{meta.get('rewritten', query)}'\n"
                f"  • Classified Intent : OOD\n"
                f"  • Top-3 Retrieved   : {meta.get('top_3_retrieved', [])}\n"
                f"  • Selected Unit     : OOD_RANDOM_AND_OFFTOPIC (Score: {confidence:.4f} < Threshold 0.14)\n"
            )

            return {
                "unit_id": "OOD_RANDOM_AND_OFFTOPIC",
                "confidence": round(confidence, 4),
                "answer": ood_ans,
                "character_name": ConversationalNLG.PERSONAS.get(character_id, {}).get("name", "Trợ Lý AI Lịch Sử Đông A"),
                "grounding_sources": [],
                "badge_unlocked": None,
                "exp_reward": 0,
                "is_not_found": True
            }

        unit_record = self.unit_lookup[best_uid]
        sess = self.context_manager.get_or_create_session(session_id)

        # Điều chỉnh câu trả lời sắc nét nếu là câu hỏi tiếp nối về xử lý của vua
        effective_unit_record = dict(unit_record)
        rewritten_q = meta.get("rewritten", query)
        unacc_q = remove_accents(query).lower()
        if meta.get("is_coref") and best_uid == "KC1_WHY_INVADE" and any(k in unacc_q for k in ["xu ly", "lam gi", "phan ung"]):
            effective_unit_record["answer"] = (
                "Trước âm mưu xâm lược và thái độ nghênh ngang của ba tên sứ giả Mông Cổ đòi mượn đường, "
                "**Vua Trần Thái Tông đã kiên quyết xử lý bằng cách cự tuyệt, hạ lệnh bắt trói giam ngay sứ giặc vào ngục** "
                "(theo Đại Việt Sử Ký Toàn Thư ghi chép là giam ở Thao Giang).\n\n"
                "Đồng thời, nhà vua lập tức ban lệnh cho các tướng lĩnh sắm sửa vũ khí, triệu tập quân đội "
                "và hiệu triệu muôn dân cả nước chuẩn bị bước vào cuộc kháng chiến trường kỳ giữ gìn non sông!"
            )
        elif any(k in unacc_q for k in ["chien thuat rut lui", "rut lui khong dong nghia", "rut lui khong phai that bai"]):
            effective_unit_record["answer"] = (
                "Trong nghệ thuật quân sự độc đáo thời Trần, việc chủ động rút lui hoàn toàn **không đồng nghĩa với thất bại hay đầu hàng**, "
                "mà là một **bước lùi chiến lược sắc bén** nhằm thực hiện kế sách *'lấy yếu thắng mạnh, lấy đoản binh chế trường trận'*:\n\n"
                "1. **Bảo toàn nguyên vẹn quân chủ lực**: Thế giặc lúc mới sang như thác lũ, kỵ binh hung hãn. Nếu đánh giáp lá cà sống mái sẽ tiêu hao lực lượng. Rút lui giúp ta giữ gìn nguyên vẹn binh lực quý giá.\n"
                "2. **Thực hiện triệt để 'Vườn không nhà trống'**: Chủ động rút lui sơ tán khỏi kinh thành Thăng Long khiến giặc rơi vào cảnh 'thành rỗng không bóng người', không cướp được một hạt thóc, nhanh chóng đói kiệt và phát sinh dịch bệnh.\n"
                "3. **Lấy thoái làm tiến, chuyển bại thành thắng**: Nhường bước khi giặc mạnh nhất, kiên nhẫn chờ thời cơ giặc sa lầy, sĩ khí suy sụp để mở đòn phản công quyết định (tiêu biểu như trận Đông Bộ Đầu năm 1258 hay Hàm Tử, Chương Dương 1285, Bạch Đằng 1288) quét sạch kẻ thù!"
            )
        elif any(k in unacc_q for k in ["sau khi rut khoi thang long", "rut khoi thang long thi quan ta lam gi", "rut khoi thang long quan ta lam gi"]):
            effective_unit_record["answer"] = (
                "Sau khi chủ động rút khỏi kinh thành Thăng Long, quân dân nhà Trần đã triển khai các bước đi chiến lược vô cùng bài bản:\n\n"
                "1. **Bảo toàn và củng cố lực lượng**: Triều đình và đại quân xuôi dòng sông Hồng về vùng hạ lưu (vùng Thiên Mạc) thiết lập phòng tuyến hiểm trở, giữ vững thế trận phòng thủ vững chắc.\n"
                "2. **Thực hiện triệt để 'Vườn không nhà trống'**: Để lại tòa thành rỗng không một bóng người, không lương thực, làm quân Mông Cổ sau hơn 9 ngày chiếm đóng lâm vào cảnh thiếu đói trầm trọng và suy kiệt sĩ khí.\n"
                "3. **Chớp thời cơ mở cuộc đại phản công Đông Bộ Đầu (29/1/1258)**: Khi thấy giặc đã cùng quẫn, vua Trần Thái Tông trực tiếp chỉ huy mở đợt tổng phản công sấm sét tại bến Đông Bộ Đầu, đánh tan nát quân giặc và thu phục lại kinh thành Thăng Long!"
            )

        composed = ConversationalNLG.compose(
            query=rewritten_q,
            unit_record=effective_unit_record,
            detected_q_type=meta.get("q_type", "EVENT"),
            is_coref_followup=meta.get("is_coref", False),
            character_id=character_id,
            turn_seed=sess["turn_count"] + 1
        )

        # Trích xuất nguồn sử liệu
        sources = []
        src_data = unit_record.get("grounding_source", {})
        if src_data and src_data.get("fact_chunk"):
            sources.append({
                "doc_name": src_data.get("doc_name", "SGK Lịch sử 7 (KNTT) & Đại Việt Sử Ký Toàn Thư"),
                "page_number": None,
                "curriculum_match": src_data.get("curriculum_match", "SGK Lịch sử 7 - Bài 13"),
                "fact_chunk": src_data.get("fact_chunk", "")
            })

        game_meta = unit_record.get("game_metadata", {})
        self.context_manager.update_session(session_id, query, unit_record, composed["answer"], meta)
        self.session_memory = self.context_manager.sessions

        import logging
        ans_excerpt = (composed["answer"][:100] + "...") if len(composed["answer"]) > 100 else composed["answer"]
        logging.info(
            f"\n[RETRIEVAL & NLG TRACE]\n"
            f"  • Original Query    : '{query}'\n"
            f"  • Rewritten Query   : '{rewritten_q}'\n"
            f"  • Classified Intent : {meta.get('q_type', 'UNKNOWN')}\n"
            f"  • Top-3 Retrieved   : {meta.get('top_3_retrieved', [])}\n"
            f"  • Selected Unit     : {best_uid} (Confidence: {confidence:.4f})\n"
            f"  • Gate / Rationale  : {meta.get('selection_rationale', 'Default')}\n"
            f"  • Final Answer Excerpt: {ans_excerpt}\n"
        )

        return {
            "unit_id": best_uid,
            "confidence": round(confidence, 4),
            "answer": composed["answer"],
            "character_name": composed["character_name"],
            "grounding_sources": sources,
            "badge_unlocked": game_meta.get("unlocked_badge"),
            "exp_reward": game_meta.get("exp_reward", 25 if sources else 0),
            "is_not_found": False
        }


def train_and_save_model() -> DongANLPModel:
    """
    Hàm khởi tạo, huấn luyện model trên tập Train (80%) và lưu ra đĩa.
    Nếu chưa có file Train 80%, tự động gọi data_splitter để tạo.
    """
    if not TRAIN_FILE.exists():
        from data_splitter import generate_and_split_dataset
        generate_and_split_dataset(test_size=0.2, random_state=42)

    train_records = []
    with open(TRAIN_FILE, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                train_records.append(json.loads(line))

    # Đảm bảo class luôn gắn với module 'create_model' (không bị dính '__main__' khi chạy trực tiếp)
    import create_model as cm_module
    model = cm_module.DongANLPModel()
    model.fit(train_records)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    return model


if __name__ == "__main__":
    import sys
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")

    trained_model = train_and_save_model()
    print("=" * 65)
    print("[CREATE MODEL] ĐÃ HUẤN LUYỆN & LƯU MODEL NGÔN NGỮ TỰ NHIÊN THÀNH CÔNG")
    print("=" * 65)
    print(f"• Số mẫu huấn luyện (80% Train) : {len(trained_model.train_records)} mẫu")
    print(f"• Số chủ điểm tri thức (Classes): {len(trained_model.unit_lookup)} nhãn chuyên sâu")
    print(f"• Kích thước Ma trận Ngữ nghĩa  : {trained_model.semantic_matrix.shape}")
    print(f"• Đường dẫn lưu Model Artifact  : {MODEL_PATH}")
    print("=" * 65)
