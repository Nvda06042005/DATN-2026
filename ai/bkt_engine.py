"""
MODULE: BAYESIAN KNOWLEDGE TRACING (BKT), PHÂN TÍCH HỒ SƠ HỌC TẬP & CHẤM TỰ LUẬN AI
================================================================================
- Code này là gì: Động cơ AI theo dõi tiến độ tri thức học sinh (4-Parameter BKT),
  phân tích toàn diện hồ sơ tài khoản người dùng (Student Profile Analytics), đề xuất
  phương án & tài liệu học tập cá nhân hóa (Adaptive Study Plan), chấm câu trả lời tự luận
  ngắn (AI Semantic Answer Grader) và ghi nhận nhật ký tự học (Active Learning Log).
- Tại sao lại có nó:
  1. Đánh giá chính xác năng lực thực sự của học sinh (phân biệt giữa thuộc bài thật với
     đoán mò P(G) hoặc trượt tay P(S)), kết hợp đường cong quên lãng Ebbinghaus.
  2. Đọc dữ liệu tài khoản người dùng (kết quả làm Quiz + lịch sử hỏi bài trên Chat AI)
     để chẩn đoán điểm mạnh/yếu theo 3 cuộc kháng chiến và 3 mức độ nhận thức Bloom
     (Nhận biết - Thông hiểu - Vận dụng), từ đó cấp đúng tài liệu SGK và phương pháp ôn tập.
  3. Lưu trữ bền vững ra đĩa (`backend/data/student_profiles.json` & `learning_analytics.json`)
     để không mất dữ liệu học sinh khi khởi động lại server.
- Liên kết với file nào:
  + Đọc dữ liệu từ: `backend/data/q_matrix.json`, `backend/data/knowledge_base.json`.
  + Được gọi bởi: `app/api/quiz.py` (nộp bài, gợi ý BKT, phân tích hồ sơ, chấm tự luận)
    và `app/api/chat.py` (đồng bộ tương tác hỏi đáp vào hồ sơ học sinh).
"""

import json
import math
import re
import time
import unicodedata
from pathlib import Path
from typing import Dict, List, Any, Optional

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
QMATRIX_FILE = DATA_DIR / "q_matrix.json"
KNOWLEDGE_BASE_FILE = DATA_DIR / "knowledge_base.json"
STUDENT_PROFILES_FILE = DATA_DIR / "student_profiles.json"
ANALYTICS_FILE = DATA_DIR / "learning_analytics.json"


def _normalize_vi_text(text: str) -> str:
    """Chuẩn hóa chuỗi tiếng Việt không dấu phục vụ đối sánh khái niệm tự luận."""
    text = text.lower().strip()
    nfd = unicodedata.normalize("NFD", text)
    unacc = "".join(c for c in nfd if not unicodedata.combining(c)).replace("đ", "d").replace("Đ", "D")
    unacc = re.sub(r"[^a-z0-9\s]", " ", unacc)
    return re.sub(r"\s+", " ", unacc).strip()


# Danh mục ánh xạ Tài liệu SGK Lịch sử 7 & Phương pháp học theo từng nhóm chuyên đề
CATEGORY_STUDY_GUIDE: Dict[str, Dict[str, str]] = {
    "KHANG_CHIEN_LAN_1_1258": {
        "pillar": "KHANG_CHIEN_1",
        "pillar_label": "Kháng chiến chống Mông Cổ lần thứ nhất (1258)",
        "sgk_reference": "SGK Lịch sử & Địa lí 7 (Kết nối tri thức) - Bài 15, Mục 1, Trang 66–67",
        "core_summary": "Nắm vững mốc tháng 1/1258: Trận chặn giặc Bình Lệ Nguyên -> Kế sách 'Vườn không nhà trống' tại Thăng Long -> Đại thắng phản công Đông Bộ Đầu (29/1/1258)."
    },
    "BINH_THAN_TRAN_QUOC_TOAN": {
        "pillar": "NHAN_VAT_HOI_NGHI",
        "pillar_label": "Nhân vật Lịch sử, Hội nghị & Nghệ thuật Quân sự",
        "sgk_reference": "SGK Lịch sử & Địa lí 7 (Kết nối tri thức) - Bài 15, Mục 2a, Trang 68",
        "core_summary": "Hội nghị Bình Than (10/1282) bàn kế đánh giặc, cử Trần Quốc Tuấn chỉ huy toàn quân; gắn liền tấm gương thiếu niên Trần Quốc Toản bóp nát quả cam và lá cờ 6 chữ vàng."
    },
    "DIEN_HONG_HICH_TUONG_SI": {
        "pillar": "NHAN_VAT_HOI_NGHI",
        "pillar_label": "Nhân vật Lịch sử, Hội nghị & Nghệ thuật Quân sự",
        "sgk_reference": "SGK Lịch sử & Địa lí 7 (Kết nối tri thức) - Bài 15, Mục 2a, Trang 68–69",
        "core_summary": "Hội nghị Diên Hồng (đầu 1285) biểu thị ý chí 'ĐÁNH!' của muôn dân; Hịch tướng sĩ (1284) và hai chữ 'Sát Thát' thổi bùng tinh thần quyết chiến của quân sĩ nhà Trần."
    },
    "KHANG_CHIEN_LAN_2_1285": {
        "pillar": "KHANG_CHIEN_2",
        "pillar_label": "Kháng chiến chống quân Nguyên lần thứ hai (1285)",
        "sgk_reference": "SGK Lịch sử & Địa lí 7 (Kết nối tri thức) - Bài 15, Mục 2b, Trang 69–71",
        "core_summary": "Phá thế gọng kìm 50 vạn quân Thoát Hoan (phía Bắc) – Toa Đô (phía Nam); tổng phản công tháng 5–6/1285 tại Tây Kết, Hàm Tử, Chương Dương; Toa Đô tử trận, Thoát Hoan chui ống đồng."
    },
    "HAI_CHIEN_VAN_DON_1288": {
        "pillar": "KHANG_CHIEN_3",
        "pillar_label": "Kháng chiến chống quân Nguyên lần thứ ba (1287 – 1288)",
        "sgk_reference": "SGK Lịch sử & Địa lí 7 (Kết nối tri thức) - Bài 15, Mục 3a, Trang 71–72",
        "core_summary": "Đầu năm 1288, Trần Khánh Dư phục kích tại Vân Đồn tiêu diệt đoàn thuyền chở 17 vạn thạch lương của Trương Văn Hổ, bẻ gãy hoàn toàn hậu cần của 30 vạn quân Nguyên."
    },
    "DAI_THANG_BACH_DANG_1288": {
        "pillar": "KHANG_CHIEN_3",
        "pillar_label": "Kháng chiến chống quân Nguyên lần thứ ba (1287 – 1288)",
        "sgk_reference": "SGK Lịch sử & Địa lí 7 (Kết nối tri thức) - Bài 15, Mục 3b, Trang 72–73",
        "core_summary": "Tháng 4/1288, Trần Hưng Đạo bố trí bãi cọc ngầm trên sông Bạch Đằng, nhử thủy quân giặc lúc triều lên và tổng công kích khi triều rút, bắt sống Ô Mã Nhi, kết thúc hoàn toàn 3 lần kháng chiến."
    },
    "NGUYEN_NHAN_Y_NGHIA": {
        "pillar": "NHAN_VAT_HOI_NGHI",
        "pillar_label": "Nhân vật Lịch sử, Hội nghị & Nghệ thuật Quân sự",
        "sgk_reference": "SGK Lịch sử & Địa lí 7 (Kết nối tri thức) - Bài 15, Mục 4, Trang 74–75",
        "core_summary": "Tổng kết 3 nguyên nhân thắng lợi (đại đoàn kết toàn dân, lãnh đạo tài ba, nghệ thuật quân sự lấy đoản binh thắng trường trận) và bài học 'Khoan thư sức dân để làm kế sâu rễ bền gốc'."
    },
    "DANH_TUONG_GIA_THAN": {
        "pillar": "NHAN_VAT_HOI_NGHI",
        "pillar_label": "Nhân vật Lịch sử, Hội nghị & Nghệ thuật Quân sự",
        "sgk_reference": "SGK Lịch sử & Địa lí 7 (Kết nối tri thức) - Bài 15, Tư liệu mở rộng, Trang 68–74",
        "core_summary": "Ghi nhớ công lao của vua Trần Nhân Tông, các gia tướng xuất thân bình dân (Phạm Ngũ Lão, Yết Kiêu, Dã Tượng) và các tù trưởng dân tộc thiểu số (Hà Khuất, Hà Đặc, Hà Chương, Nguyễn Thế Lộc)."
    },
    "NEN_TANG_QUAN_SU": {
        "pillar": "NHAN_VAT_HOI_NGHI",
        "pillar_label": "Nhân vật Lịch sử, Hội nghị & Nghệ thuật Quân sự",
        "sgk_reference": "SGK Lịch sử & Địa lí 7 (Kết nối tri thức) - Bài 14 & Bài 15, Trang 62–73",
        "core_summary": "Nắm vững chính sách 'Ngụ binh ư nông', tổ chức Cấm quân Thánh Dực – Tinh binh Sát Thát và hệ thống căn cứ địa chiến lược Vạn Kiếp – Thiên Trường – Trường Yên."
    }
}

COGNITIVE_STUDY_STRATEGIES: Dict[str, Dict[str, str]] = {
    "NHAN_BIET": {
        "label": "Nhận biết (Mốc thời gian, Nhân vật, Địa danh)",
        "method": "Học qua Sơ đồ Trục thời gian (Timeline 1258 -> 1285 -> 1288) và Thẻ ghi nhớ nhanh (Flashcard): nối tên Vị tướng với Trận đánh và Câu nói nổi tiếng."
    },
    "THONG_HIEU": {
        "label": "Thông hiểu (Nguyên nhân, Diễn biến, Tác dụng chiến thuật)",
        "method": "Học theo sơ đồ Nhân – Quả (Vì sao rút lui? -> Để bảo toàn lực lượng & làm giặc đói lương -> Tạo thời cơ phản công) kết hợp đọc kỹ đoạn tư liệu trong SGK."
    },
    "VAN_DUNG": {
        "label": "Vận dụng & Vận dụng cao (So sánh, Đánh giá, Liên hệ bài học)",
        "method": "Lập bảng so sánh đối chiếu 3 lần kháng chiến (1258, 1285, 1288) và tập trả lời các câu hỏi 'Vì sao quân giặc đông mạnh mà vẫn thua?' bằng 3 luận điểm cốt lõi."
    }
}


class BKTEngine:
    """
    Bộ máy theo dõi tiến độ tri thức học sinh theo phương pháp Bayesian Knowledge Tracing (BKT),
    kết hợp Phân tích Hồ sơ tài khoản, Đề xuất tài liệu học tập và Chấm câu trả lời tự luận ngắn.
    """
    def __init__(
        self,
        default_p_l0: float = 0.30,
        default_p_t: float = 0.15,
        default_p_g: float = 0.25,
        default_p_s: float = 0.10,
        forget_lambda: float = 0.05
    ):
        self.default_p_l0 = default_p_l0
        self.default_p_t = default_p_t
        self.default_p_g = default_p_g
        self.default_p_s = default_p_s
        self.forget_lambda = forget_lambda

        self.q_matrix: Dict[str, Any] = {}
        self.knowledge_base: Dict[str, Any] = {}
        self._load_curriculum_metadata()

        # Lưu trạng thái học sinh: student_id -> { unit_id: {"p_l": float, ...} }
        self.student_states: Dict[str, Dict[str, Dict[str, Any]]] = {}
        self.analytics_data: Dict[str, Any] = {
            "topic_popularity": {},
            "unanswered_queries": []
        }
        self._load_persistent_data()

    def _load_curriculum_metadata(self):
        if QMATRIX_FILE.exists():
            try:
                with open(QMATRIX_FILE, "r", encoding="utf-8") as f:
                    self.q_matrix = json.load(f)
            except Exception:
                pass
        if KNOWLEDGE_BASE_FILE.exists():
            try:
                with open(KNOWLEDGE_BASE_FILE, "r", encoding="utf-8") as f:
                    self.knowledge_base = json.load(f)
            except Exception:
                pass

    def _load_persistent_data(self):
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        if STUDENT_PROFILES_FILE.exists():
            try:
                with open(STUDENT_PROFILES_FILE, "r", encoding="utf-8") as f:
                    self.student_states = json.load(f)
            except Exception:
                self.student_states = {}

        if ANALYTICS_FILE.exists():
            try:
                with open(ANALYTICS_FILE, "r", encoding="utf-8") as f:
                    self.analytics_data = json.load(f)
            except Exception:
                pass

        # Khởi tạo hồ sơ mẫu cho tài khoản mặc định trên giao diện nếu chưa có
        if "student_nguyen_van_long" not in self.student_states:
            self._seed_demo_student_profile("student_nguyen_van_long")

    def _save_persistent_data(self):
        try:
            if STUDENT_PROFILES_FILE.exists():
                with open(STUDENT_PROFILES_FILE, "w", encoding="utf-8", newline="\n") as f:
                    json.dump(self.student_states, f, ensure_ascii=False, indent=2)
            if ANALYTICS_FILE.exists():
                with open(ANALYTICS_FILE, "w", encoding="utf-8", newline="\n") as f:
                    json.dump(self.analytics_data, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

    def _seed_demo_student_profile(self, student_id: str):
        """
        Khởi tạo dữ liệu học tập thực tế cho tài khoản mẫu 'student_nguyen_van_long'
        (Vững phần Kháng chiến lần 1 & Mức Nhận biết, nhưng còn yếu phần Kháng chiến lần 3 & Mức Vận dụng)
        để hệ thống sẵn sàng trình diễn phân tích hồ sơ ngay khi gọi API.
        """
        now = time.time()
        demo_mastery = {
            "KC1_OVERVIEW": {"p_l": 0.84, "attempts": 4, "correct_count": 4, "chat_count": 2},
            "KC1_TRAN_THU_DO_QUOTE": {"p_l": 0.88, "attempts": 3, "correct_count": 3, "chat_count": 1},
            "TQT_WHY_ORANGE": {"p_l": 0.82, "attempts": 3, "correct_count": 3, "chat_count": 2},
            "TQT_SIX_GOLDEN_WORDS": {"p_l": 0.85, "attempts": 3, "correct_count": 3, "chat_count": 1},
            "DIEN_HONG_CONFERENCE": {"p_l": 0.76, "attempts": 3, "correct_count": 2, "chat_count": 2},
            "KC2_THOAT_HOAN_COPPER_PIPE": {"p_l": 0.79, "attempts": 2, "correct_count": 2, "chat_count": 1},
            "KC1_VUON_KHONG_NHA_TRONG": {"p_l": 0.52, "attempts": 2, "correct_count": 1, "chat_count": 1},
            "KC2_HAM_TU_CHUONG_DUONG": {"p_l": 0.44, "attempts": 2, "correct_count": 1, "chat_count": 0},
            "KC3_VAN_DON": {"p_l": 0.36, "attempts": 2, "correct_count": 0, "chat_count": 1},
            "KC3_BACH_DANG_HOW": {"p_l": 0.41, "attempts": 3, "correct_count": 1, "chat_count": 1},
            "CAUSES_OF_VICTORY": {"p_l": 0.34, "attempts": 2, "correct_count": 0, "chat_count": 0},
            "MILITARY_ART_TRAN_DYNASTY": {"p_l": 0.32, "attempts": 1, "correct_count": 0, "chat_count": 0},
            "HISTORICAL_LESSONS_TODAY": {"p_l": 0.35, "attempts": 1, "correct_count": 0, "chat_count": 0},
        }
        profile: Dict[str, Dict[str, Any]] = {}
        for uid, data in demo_mastery.items():
            profile[uid] = {
                "p_l": data["p_l"],
                "last_updated_time": now,
                "attempts": data["attempts"],
                "correct_count": data["correct_count"],
                "chat_count": data["chat_count"]
            }
        self.student_states[student_id] = profile
        self._save_persistent_data()

    def get_student_knowledge_level(self, student_id: str, unit_id: str) -> float:
        """
        Lấy xác suất nắm vững kiến thức P(L) của học sinh tại một cụm tri thức,
        đã tính đến độ suy giảm trí nhớ theo thời gian (Forgetting Decay).
        """
        student_data = self.student_states.setdefault(student_id, {})
        if unit_id not in student_data:
            student_data[unit_id] = {
                "p_l": self.default_p_l0,
                "last_updated_time": time.time(),
                "attempts": 0,
                "correct_count": 0,
                "chat_count": 0
            }
            return self.default_p_l0

        record = student_data[unit_id]
        current_p_l = record["p_l"]

        # Áp dụng hàm suy giảm trí nhớ Ebbinghaus: P(L) * e^(-lambda * delta_days)
        delta_days = (time.time() - record["last_updated_time"]) / 86400.0
        if delta_days > 0.01:
            decay_factor = math.exp(-self.forget_lambda * delta_days)
            current_p_l = max(0.15, current_p_l * decay_factor)
            record["p_l"] = current_p_l
            record["last_updated_time"] = time.time()

        return round(current_p_l, 4)

    def get_study_material(self, unit_id: str) -> Dict[str, Any]:
        """
        Trích xuất gói tài liệu ôn tập chuẩn SGK, từ khóa trọng tâm và phương pháp học
        phù hợp với cấp độ nhận thức của cụm tri thức `unit_id`.
        """
        self._load_curriculum_metadata()
        q_meta = self.q_matrix.get(unit_id, {})
        kb_unit = self.knowledge_base.get(unit_id, {})

        category = q_meta.get("category", "NGUYEN_NHAN_Y_NGHIA")
        cog_level = q_meta.get("cognitive_level", "THONG_HIEU")
        cat_guide = CATEGORY_STUDY_GUIDE.get(category, CATEGORY_STUDY_GUIDE["NGUYEN_NHAN_Y_NGHIA"])
        cog_guide = COGNITIVE_STUDY_STRATEGIES.get(cog_level, COGNITIVE_STUDY_STRATEGIES["THONG_HIEU"])

        fact_chunk = kb_unit.get("fact_chunk", "") or cat_guide["core_summary"]
        entity = kb_unit.get("entity", q_meta.get("entity", "Nhà Trần"))
        event = kb_unit.get("event", q_meta.get("event", "Kháng chiến chống Mông - Nguyên"))

        # Trích xuất các từ khóa lịch sử cốt lõi cần nhớ khi thi
        key_takeaways = [entity, event]
        for year in re.findall(r"\b(?:1258|1282|1284|1285|1287|1288|938)\b", fact_chunk):
            if f"Mốc năm {year}" not in key_takeaways:
                key_takeaways.append(f"Mốc năm {year}")

        base_queries = kb_unit.get("base_queries", [])
        practice_question = (
            base_queries[0].capitalize() + "?"
            if base_queries
            else f"Hãy trình bày nội dung cốt lõi về: {q_meta.get('topic', unit_id)}?"
        )

        topic_title = q_meta.get("topic", unit_id)
        return {
            "unit_id": unit_id,
            "topic": topic_title,
            "title": topic_title,
            "category": category,
            "cognitive_level": cog_level,
            "bloom_target": cog_level,
            "sgk_reference": cat_guide["sgk_reference"],
            "reading_section": cat_guide["sgk_reference"],
            "doc_source": "SGK Lịch sử và Địa lí 7 (Kết nối tri thức) & Đại Việt Sử Ký Toàn Thư",
            "core_fact_summary": fact_chunk,
            "key_takeaways": key_takeaways[:4],
            "summary_points": key_takeaways[:4],
            "study_method": cog_guide["method"],
            "practice_question": practice_question,
            "practice_prompt": practice_question,
        }

    def get_study_materials_for_units(
        self,
        unit_ids: List[str],
        max_items: int = 2,
        student_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Trả về danh sách tài liệu học tập tương thích `StudyMaterialItem` cho các cụm tri thức."""
        self._load_curriculum_metadata()
        materials = []
        for uid in unit_ids[:max_items]:
            mat = self.get_study_material(uid)
            if student_id:
                p_l = self.get_student_knowledge_level(student_id, uid)
                mat["current_mastery"] = round(p_l, 4)
                mat["mastery_status"] = (
                    "Đã vững vàng" if p_l >= 0.80 else ("Đang tiếp thu" if p_l >= 0.60 else "Cần củng cố")
                )
            materials.append(mat)
        return materials

    def log_unanswered_query(
        self,
        query: str,
        student_id: str = "student_demo_01",
        session_id: str = "default",
        predicted_unit: str = "OOD_RANDOM_AND_OFFTOPIC",
        confidence: float = 0.0
    ) -> None:
        """Ghi nhận câu hỏi ngoài miền hoặc chưa trả lời được vào nhật ký Active Learning."""
        clean_q = (query or "").strip()
        if not clean_q:
            return
        unanswered = self.analytics_data.setdefault("unanswered_queries", [])
        existing = next((item for item in unanswered if item.get("query", "").lower() == clean_q.lower()), None)
        if existing:
            existing["count"] = existing.get("count", 1) + 1
            existing["last_asked"] = time.time()
        else:
            unanswered.append({
                "query": clean_q,
                "student_id": student_id,
                "session_id": session_id,
                "predicted_unit": predicted_unit,
                "confidence": round(float(confidence), 4),
                "count": 1,
                "last_asked": time.time()
            })
        self._save_persistent_data()

    def update_student_response(
        self,
        student_id: str,
        unit_id: str,
        is_correct: bool,
        cognitive_level: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Cập nhật Bayes chuẩn sau khi học sinh làm bài trắc nghiệm hoặc tự luận:
        """
        self._load_curriculum_metadata()
        old_p_l = self.get_student_knowledge_level(student_id, unit_id)

        q_meta = self.q_matrix.get(unit_id, {})
        difficulty = q_meta.get("difficulty", 0.5)

        p_g = max(0.10, self.default_p_g * (1.0 - difficulty * 0.5))
        p_s = min(0.30, self.default_p_s * (1.0 + difficulty * 0.5))
        p_t = self.default_p_t

        # 1. Cập nhật định lý Bayes theo bằng chứng thực nghiệm (Evidence)
        if is_correct:
            numerator = old_p_l * (1.0 - p_s)
            denominator = numerator + (1.0 - old_p_l) * p_g
            p_l_given_evidence = numerator / denominator if denominator > 0 else old_p_l
        else:
            numerator = old_p_l * p_s
            denominator = numerator + (1.0 - old_p_l) * (1.0 - p_g)
            p_l_given_evidence = numerator / denominator if denominator > 0 else old_p_l

        # 2. Bước chuyển tiếp tiếp thu kiến thức (Learning Transition)
        new_p_l = p_l_given_evidence + (1.0 - p_l_given_evidence) * p_t
        new_p_l = min(0.99, max(0.05, new_p_l))

        record = self.student_states[student_id][unit_id]
        record["p_l"] = round(new_p_l, 4)
        record["last_updated_time"] = time.time()
        record["attempts"] = record.get("attempts", 0) + 1
        if is_correct:
            record["correct_count"] = record.get("correct_count", 0) + 1

        self._save_persistent_data()

        mastery_status = "Đã vững vàng" if new_p_l >= 0.80 else ("Đang tiếp thu" if new_p_l >= 0.60 else "Cần củng cố")

        return {
            "student_id": student_id,
            "unit_id": unit_id,
            "topic": q_meta.get("topic", unit_id),
            "is_correct": is_correct,
            "old_p_l": old_p_l,
            "new_p_l": round(new_p_l, 4),
            "p_l_delta": round(new_p_l - old_p_l, 4),
            "mastery_status": mastery_status,
            "attempts": record["attempts"]
        }

    def record_chat_interaction(
        self,
        student_id: str,
        unit_id: str,
        query: str = "",
        confidence: float = 0.9,
        is_not_found: bool = False,
        topic: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Đồng bộ 2 chiều giữa Chat AI và Hồ sơ học sinh:
        - Nếu học sinh hỏi câu hỏi thuộc chủ điểm lịch sử, ghi nhận lượt tìm hiểu và tăng nhẹ P(L)
          theo bước học tập tương tác (micro-transition = +0.03), đồng thời trả về gợi ý tài liệu học.
        - Nếu câu hỏi nằm ngoài dữ liệu hoặc độ tin cậy thấp (< 0.35), ghi vào nhật ký Active Learning
          để giáo viên/nhà phát triển biết câu hỏi nào cần bổ sung thêm dữ liệu.
        """
        self._load_curriculum_metadata()
        clean_q = (query or "").strip()

        if is_not_found or unit_id in ("OOD_RANDOM_AND_OFFTOPIC", "ABSENT_HISTORICAL_FACT") or confidence < 0.35:
            if clean_q:
                unanswered = self.analytics_data.setdefault("unanswered_queries", [])
                existing = next((item for item in unanswered if item["query"].lower() == clean_q.lower()), None)
                if existing:
                    existing["count"] += 1
                    existing["last_asked"] = time.time()
                else:
                    unanswered.append({
                        "query": clean_q,
                        "predicted_unit": unit_id,
                        "confidence": round(confidence, 4),
                        "count": 1,
                        "last_asked": time.time()
                    })
                self._save_persistent_data()
            return None

        # Thống kê mức độ quan tâm theo chủ đề
        pop = self.analytics_data.setdefault("topic_popularity", {})
        pop[unit_id] = pop.get(unit_id, 0) + 1

        q_meta = self.q_matrix.get(unit_id, {})
        if q_meta.get("category") in ("OUT_OF_DOMAIN", "CONVERSATIONAL_INTENT", "CROSS_ERA_SAFEGUARD"):
            self._save_persistent_data()
            return None

        old_p_l = self.get_student_knowledge_level(student_id, unit_id)
        record = self.student_states[student_id][unit_id]
        record["chat_count"] = record.get("chat_count", 0) + 1
        # Tương tác hỏi đáp chủ động giúp tăng nhẹ xác suất tiếp thu (+3% phần chưa biết)
        new_p_l = min(0.95, round(old_p_l + (1.0 - old_p_l) * 0.03, 4))
        record["p_l"] = new_p_l
        record["last_updated_time"] = time.time()
        self._save_persistent_data()

        mastery_status = "Đã vững vàng" if new_p_l >= 0.80 else ("Đang tiếp thu" if new_p_l >= 0.60 else "Cần củng cố")
        material = self.get_study_material(unit_id)
        if topic:
            material["topic"] = topic
        material["current_mastery"] = new_p_l
        material["old_p_l"] = round(old_p_l, 4)
        material["new_p_l"] = round(new_p_l, 4)
        material["p_l_delta"] = round(new_p_l - old_p_l, 4)
        material["mastery_status"] = mastery_status
        return material

    def recommend_personalized_review(self, student_id: str, top_k: int = 3) -> List[Dict[str, Any]]:
        """
        Đề xuất lộ trình học cá nhân hóa:
        Tìm các cụm tri thức có P(L) thấp nhất (< 0.60) kèm tài liệu SGK và phương pháp học tương ứng.
        """
        self._load_curriculum_metadata()
        recommendations = []
        for uid, meta in self.q_matrix.items():
            if meta.get("category") in ["OUT_OF_DOMAIN", "CONVERSATIONAL_INTENT", "CROSS_ERA_SAFEGUARD"]:
                continue

            p_l = self.get_student_knowledge_level(student_id, uid)
            if p_l < 0.60:
                material = self.get_study_material(uid)
                material["current_mastery"] = round(p_l, 4)
                material["mastery_status"] = "Cần củng cố"
                recommendations.append({
                    "unit_id": uid,
                    "topic": meta.get("topic"),
                    "category": meta.get("category"),
                    "current_mastery": p_l,
                    "difficulty": meta.get("difficulty"),
                    "cognitive_level": meta.get("cognitive_level"),
                    "reason": (
                        f"Mức độ nắm vững hiện tại đạt {int(p_l * 100)}% (Cần đọc: {material['sgk_reference']})"
                    ),
                    "sgk_reference": material["sgk_reference"],
                    "study_method": material["study_method"],
                    "key_takeaways": material["key_takeaways"],
                    "study_material": material,
                })

        recommendations.sort(key=lambda x: x["current_mastery"])
        return recommendations[:top_k]

    def analyze_student_profile(self, student_id: str, top_k: int = 5) -> Dict[str, Any]:
        """
        Phân tích toàn diện dữ liệu tài khoản học sinh để đưa ra chẩn đoán năng lực AI
        và Phương án + Tài liệu học tập hiệu quả nhất:
        1. Điểm thành thạo trung bình theo 4 mảng nội dung lớn (Kháng chiến 1, 2, 3 & Nhân vật/Nghệ thuật).
        2. Điểm thành thạo theo 3 cấp độ nhận thức Bloom (Nhận biết, Thông hiểu, Vận dụng).
        3. Nhận xét chẩn đoán cá nhân hóa và danh sách tài liệu học tập ưu tiên.
        """
        self._load_curriculum_metadata()
        pillar_buckets: Dict[str, List[float]] = {
            "KHANG_CHIEN_1": [],
            "KHANG_CHIEN_2": [],
            "KHANG_CHIEN_3": [],
            "NHAN_VAT_HOI_NGHI": []
        }
        pillar_labels = {
            "KHANG_CHIEN_1": "Kháng chiến chống Mông Cổ lần 1 (1258)",
            "KHANG_CHIEN_2": "Kháng chiến chống quân Nguyên lần 2 (1285)",
            "KHANG_CHIEN_3": "Kháng chiến chống quân Nguyên lần 3 (1287 – 1288)",
            "NHAN_VAT_HOI_NGHI": "Nhân vật, Hội nghị & Nghệ thuật Quân sự"
        }
        cog_buckets: Dict[str, List[float]] = {
            "NHAN_BIET": [],
            "THONG_HIEU": [],
            "VAN_DUNG": []
        }

        all_scores: List[float] = []
        strengths: List[str] = []
        weaknesses: List[str] = []
        total_quiz_attempts = 0
        total_chat_questions = 0

        student_data = self.student_states.get(student_id, {})
        for uid, meta in self.q_matrix.items():
            cat = meta.get("category", "")
            if cat in ("OUT_OF_DOMAIN", "CONVERSATIONAL_INTENT", "CROSS_ERA_SAFEGUARD"):
                continue

            p_l = self.get_student_knowledge_level(student_id, uid)
            all_scores.append(p_l)

            rec = student_data.get(uid, {})
            total_quiz_attempts += rec.get("attempts", 0)
            total_chat_questions += rec.get("chat_count", 0)

            cat_guide = CATEGORY_STUDY_GUIDE.get(cat, CATEGORY_STUDY_GUIDE["NGUYEN_NHAN_Y_NGHIA"])
            pillar_key = cat_guide["pillar"]
            pillar_buckets.setdefault(pillar_key, []).append(p_l)

            cog_level = meta.get("cognitive_level", "THONG_HIEU")
            if cog_level in cog_buckets:
                cog_buckets[cog_level].append(p_l)

            if p_l >= 0.75:
                strengths.append(meta.get("topic", uid))
            elif p_l < 0.45:
                weaknesses.append(meta.get("topic", uid))

        overall_mastery = round(sum(all_scores) / len(all_scores), 4) if all_scores else self.default_p_l0
        if overall_mastery >= 0.75:
            mastery_rank = "Thống lĩnh Đại Việt (Thành thạo cao)"
        elif overall_mastery >= 0.50:
            mastery_rank = "Chiến binh Thăng Long (Đang tiến bộ)"
        else:
            mastery_rank = "Tân binh Đông A (Cần củng cố nền tảng)"

        campaign_breakdown = []
        for p_key, scores in pillar_buckets.items():
            avg_s = round(sum(scores) / len(scores), 4) if scores else self.default_p_l0
            status = "Vững vàng" if avg_s >= 0.70 else ("Đang tiếp thu" if avg_s >= 0.50 else "Cần ưu tiên ôn tập")
            campaign_breakdown.append({
                "pillar_id": p_key,
                "label": pillar_labels[p_key],
                "avg_mastery": avg_s,
                "status": status,
                "unit_count": len(scores)
            })

        cognitive_breakdown = []
        weakest_cog = "THONG_HIEU"
        lowest_cog_score = 1.0
        for c_key in ("NHAN_BIET", "THONG_HIEU", "VAN_DUNG"):
            scores = cog_buckets[c_key]
            avg_c = round(sum(scores) / len(scores), 4) if scores else self.default_p_l0
            if avg_c < lowest_cog_score:
                lowest_cog_score = avg_c
                weakest_cog = c_key
            c_info = COGNITIVE_STUDY_STRATEGIES[c_key]
            cognitive_breakdown.append({
                "cognitive_level": c_key,
                "label": c_info["label"],
                "avg_mastery": avg_c,
                "recommended_strategy": c_info["method"]
            })

        # Tìm giai đoạn kháng chiến yếu nhất
        weakest_pillar = min(campaign_breakdown, key=lambda x: x["avg_mastery"])
        strongest_pillar = max(campaign_breakdown, key=lambda x: x["avg_mastery"])

        ai_diagnosis = (
            f"Dựa trên {total_quiz_attempts} lượt làm bài khảo thí và {total_chat_questions} câu hỏi trao đổi với AI, "
            f"hồ sơ của học sinh đạt mức độ nắm vững tổng thể **{int(overall_mastery * 100)}% ({mastery_rank})**. "
            f"Điểm sáng: Em nắm khá tốt mảng **{strongest_pillar['label']}** ({int(strongest_pillar['avg_mastery'] * 100)}%). "
            f"Điểm cần cải thiện: Em đang hổng kiến thức nhiều nhất ở mảng **{weakest_pillar['label']}** "
            f"({int(weakest_pillar['avg_mastery'] * 100)}%), đặc biệt là các câu hỏi thuộc cấp độ "
            f"**{COGNITIVE_STUDY_STRATEGIES[weakest_cog]['label']}**. "
            f"Phương án học hiệu quả nhất hiện nay: {COGNITIVE_STUDY_STRATEGIES[weakest_cog]['method']}"
        )

        # Tính tốc độ tiến bộ (Learning Velocity) & Cảnh báo suy giảm trí nhớ Ebbinghaus (Forgetting Risk)
        total_interactions = max(1, total_quiz_attempts + total_chat_questions)
        learning_velocity = round((overall_mastery - self.default_p_l0) / total_interactions, 4)
        if learning_velocity >= 0.04 or overall_mastery >= 0.70:
            momentum_label = "Đang bứt phá nhanh 🚀"
        elif learning_velocity >= 0.01 or overall_mastery >= 0.42:
            momentum_label = "Tiến bộ ổn định 📈"
        else:
            momentum_label = "Cần tăng tốc ôn tập ⚠️"

        retention_alerts = []
        for uid, meta in self.q_matrix.items():
            p_l = self.get_student_knowledge_level(student_id, uid)
            if 0.35 <= p_l < 0.72:
                # Mô hình đường cong quên lãng Ebbinghaus: R = exp(-t / S)
                stability_days = round(2.0 + 8.0 * p_l, 1)
                effective_retention = round(p_l * 0.88, 4)
                retention_alerts.append({
                    "unit_id": uid,
                    "topic": meta.get("topic", uid),
                    "current_mastery": round(p_l, 4),
                    "ebbinghaus_effective_mastery": effective_retention,
                    "review_within_days": stability_days
                })
        retention_alerts.sort(key=lambda x: x["ebbinghaus_effective_mastery"])

        # Sinh lộ trình tài liệu học tập ưu tiên
        weak_recs = self.recommend_personalized_review(student_id=student_id, top_k=top_k)
        study_materials = [self.get_study_material(r["unit_id"]) for r in weak_recs]
        for idx, mat in enumerate(study_materials):
            mat["current_mastery"] = weak_recs[idx]["current_mastery"]

        return {
            "student_id": student_id,
            "overall_mastery": overall_mastery,
            "mastery_rank": mastery_rank,
            "learning_velocity": learning_velocity,
            "momentum_label": momentum_label,
            "retention_alerts": retention_alerts[:4],
            "total_quiz_attempts": total_quiz_attempts,
            "total_chat_questions": total_chat_questions,
            "campaign_breakdown": campaign_breakdown,
            "cognitive_breakdown": cognitive_breakdown,
            "strengths": strengths[:5],
            "weaknesses": weaknesses[:5],
            "ai_diagnosis": ai_diagnosis,
            "recommended_study_materials": study_materials
        }

    def analyze_student_account_profile(self, student_id: str, top_k: int = 5) -> Dict[str, Any]:
        """
        Phân tích toàn diện hồ sơ tài khoản học sinh tương thích 100% với schema
        `StudentAccountAnalysisResponse` của endpoint `GET /api/quiz/student-profile/{student_id}`.
        """
        base = self.analyze_student_profile(student_id=student_id, top_k=top_k)
        student_data = self.student_states.get(student_id, {})

        total_attempts = 0
        total_correct = 0
        for uid, meta in self.q_matrix.items():
            if meta.get("category") in ("OUT_OF_DOMAIN", "CONVERSATIONAL_INTENT", "CROSS_ERA_SAFEGUARD"):
                continue
            rec = student_data.get(uid, {})
            total_attempts += int(rec.get("attempts", 0))
            total_correct += int(rec.get("correct_count", 0))

        accuracy_rate = round(total_correct / total_attempts, 4) if total_attempts > 0 else 0.0

        # Map campaign_breakdown -> CampaignMasteryItem
        campaign_items = []
        for c in base["campaign_breakdown"]:
            p_id = c["pillar_id"]
            mastered_cnt = 0
            for uid, meta in self.q_matrix.items():
                cat = meta.get("category", "")
                if cat in ("OUT_OF_DOMAIN", "CONVERSATIONAL_INTENT", "CROSS_ERA_SAFEGUARD"):
                    continue
                cat_guide = CATEGORY_STUDY_GUIDE.get(cat, CATEGORY_STUDY_GUIDE["NGUYEN_NHAN_Y_NGHIA"])
                if cat_guide["pillar"] == p_id and self.get_student_knowledge_level(student_id, uid) >= 0.70:
                    mastered_cnt += 1
            campaign_items.append({
                "campaign_id": p_id,
                "campaign_name": c["label"],
                "average_mastery": c["avg_mastery"],
                "mastered_units": mastered_cnt,
                "total_units": c["unit_count"],
                "status": c["status"],
            })

        # Map cognitive_breakdown -> CognitiveMasteryItem
        cognitive_items = []
        for cb in base["cognitive_breakdown"]:
            lvl = cb["cognitive_level"]
            practiced_cnt = 0
            total_cnt = 0
            for uid, meta in self.q_matrix.items():
                if meta.get("category") in ("OUT_OF_DOMAIN", "CONVERSATIONAL_INTENT", "CROSS_ERA_SAFEGUARD"):
                    continue
                if meta.get("cognitive_level", "THONG_HIEU") == lvl:
                    total_cnt += 1
                    rec = student_data.get(uid, {})
                    if rec.get("attempts", 0) > 0 or rec.get("chat_count", 0) > 0:
                        practiced_cnt += 1
            cognitive_items.append({
                "level_code": lvl,
                "level_name": cb["label"],
                "average_mastery": cb["avg_mastery"],
                "practiced_units": practiced_cnt,
                "total_units": total_cnt,
            })

        weak_mats = base["recommended_study_materials"]
        weak_uids = [m["unit_id"] for m in weak_mats]
        study_plan = [
            {
                "step": 1,
                "phase_name": "Củng cố nền tảng SGK Lịch sử 7",
                "action_title": "Đọc lại các mục trọng tâm đang hổng kiến thức",
                "description": "Đọc kỹ căn cứ sử liệu và ghi nhớ các mốc thời gian, nhân vật cốt lõi của giai đoạn yếu nhất.",
                "target_units": weak_uids[:2] or ["KC1_VUON_KHONG_NHA_TRONG"],
                "estimated_minutes": 15,
            },
            {
                "step": 2,
                "phase_name": "Rèn luyện tư duy Thông hiểu & Vận dụng",
                "action_title": "Thực hành trả lời câu hỏi Vì sao & So sánh chiến thuật",
                "description": "Tập giải thích nguyên nhân thắng lợi và nghệ thuật quân sự của nhà Trần qua Hỏi - Đáp cùng Quân Sư AI.",
                "target_units": weak_uids[2:4] or ["KC3_BACH_DANG_HOW"],
                "estimated_minutes": 20,
            },
            {
                "step": 3,
                "phase_name": "Khảo thí thích ứng BKT",
                "action_title": "Làm đề ôn tập cá nhân hóa để nâng chuẩn P(L) >= 80%",
                "description": "Hoàn thành bài kiểm tra 5 câu kết hợp Trắc nghiệm và Tự luận ngắn để khóa chặt trí nhớ dài hạn.",
                "target_units": weak_uids[:3] or ["CAUSES_OF_VICTORY"],
                "estimated_minutes": 15,
            },
        ]

        return {
            "student_id": student_id,
            "overall_mastery": base["overall_mastery"],
            "student_rank_title": base["mastery_rank"],
            "total_attempts": total_attempts,
            "total_correct": total_correct,
            "accuracy_rate": accuracy_rate,
            "chat_questions_asked": base["total_chat_questions"],
            "ai_evaluator_comment": base["ai_diagnosis"],
            "strengths": base["strengths"],
            "weaknesses": base["weaknesses"],
            "campaign_breakdown": campaign_items,
            "cognitive_breakdown": cognitive_items,
            "study_plan": study_plan,
            "recommended_materials": weak_mats,
        }

    def generate_adaptive_exam(self, student_id: str, num_questions: int = 5) -> Dict[str, Any]:
        """
        Sinh Đề Ôn Tập Cá Nhân Hóa (Adaptive Custom Exam Generator):
        Kết hợp câu hỏi Trắc nghiệm (Multiple Choice từ `quiz_bank.json` hoặc `game_content.json`) và Tự luận ngắn
        nhắm chính xác vào các chủ điểm học sinh đang yếu nhất trong Hồ sơ năng lực BKT.
        """
        profile = self.analyze_student_profile(student_id=student_id, top_k=max(5, num_questions))
        weak_recs = self.recommend_personalized_review(student_id=student_id, top_k=10)

        quiz_bank_path = DATA_DIR / "quiz_bank.json"
        game_content_path = DATA_DIR / "game_content.json"
        mcq_pool = []
        if quiz_bank_path.exists():
            try:
                mcq_pool = json.loads(quiz_bank_path.read_text(encoding="utf-8"))
            except Exception:
                mcq_pool = []
        elif game_content_path.exists():
            try:
                gc_data = json.loads(game_content_path.read_text(encoding="utf-8"))
                for q in gc_data.get("questions", []):
                    if q.get("type") == "mcq":
                        mcq_pool.append({
                            "id": q.get("id"),
                            "unit_id": q.get("unit_id"),
                            "question": q.get("prompt", ""),
                            "options": q.get("options", []),
                            "correct_index": q.get("answer", 0),
                            "explanation": q.get("explanation", ""),
                        })
            except Exception:
                mcq_pool = []

        selected_questions = []
        used_units = set()

        # 1. Chọn tối đa 3 câu Trắc nghiệm khớp với các chủ điểm yếu nhất
        mcq_target = max(1, (num_questions * 3) // 5)
        for rec in weak_recs:
            uid = rec["unit_id"]
            for q_item in mcq_pool:
                if q_item.get("unit_id") == uid and uid not in used_units:
                    selected_questions.append({
                        "question_id": q_item.get("id", f"MCQ_{uid}"),
                        "unit_id": uid,
                        "question_type": "MULTIPLE_CHOICE",
                        "topic": rec["topic"],
                        "cognitive_level": rec["cognitive_level"],
                        "current_mastery": rec["current_mastery"],
                        "question_text": q_item.get("question", ""),
                        "options": q_item.get("options", []),
                        "correct_index": q_item.get("correct_index", 0),
                        "explanation": q_item.get("explanation", "")
                    })
                    used_units.add(uid)
                    break
            if len(selected_questions) >= mcq_target:
                break

        # Nếu chưa đủ câu MCQ, lấy bổ sung từ mcq_pool
        for q_item in mcq_pool:
            if len(selected_questions) >= mcq_target:
                break
            uid = q_item.get("unit_id", "KC1_OVERVIEW")
            if uid not in used_units:
                selected_questions.append({
                    "question_id": q_item.get("id", f"MCQ_{uid}"),
                    "unit_id": uid,
                    "question_type": "MULTIPLE_CHOICE",
                    "topic": self.q_matrix.get(uid, {}).get("topic", uid),
                    "cognitive_level": self.q_matrix.get(uid, {}).get("cognitive_level", "THONG_HIEU"),
                    "current_mastery": round(self.get_student_knowledge_level(student_id, uid), 4),
                    "question_text": q_item.get("question", ""),
                    "options": q_item.get("options", []),
                    "correct_index": q_item.get("correct_index", 0),
                    "explanation": q_item.get("explanation", "")
                })
                used_units.add(uid)

        # 2. Chọn các câu Tự luận ngắn (Short Answer Essay) cho các chủ điểm yếu tiếp theo
        for rec in weak_recs:
            if len(selected_questions) >= num_questions:
                break
            uid = rec["unit_id"]
            if uid in used_units:
                continue
            kb_item = self.knowledge_base.get(uid, {})
            base_qs = kb_item.get("base_queries", [])
            q_text = (
                base_qs[0].capitalize() + "?"
                if base_qs else f"Hãy trình bày nội dung và ý nghĩa cốt lõi của chủ đề: {rec['topic']}?"
            )
            selected_questions.append({
                "question_id": f"ESSAY_{uid}",
                "unit_id": uid,
                "question_type": "SHORT_ANSWER",
                "topic": rec["topic"],
                "cognitive_level": rec["cognitive_level"],
                "current_mastery": rec["current_mastery"],
                "question_text": q_text,
                "options": [],
                "reference_answer": kb_item.get("fact_chunk", "")
            })
            used_units.add(uid)

        return {
            "student_id": student_id,
            "overall_mastery": profile["overall_mastery"],
            "mastery_rank": profile["mastery_rank"],
            "learning_velocity": profile["learning_velocity"],
            "momentum_label": profile["momentum_label"],
            "total_questions": len(selected_questions),
            "questions": selected_questions
        }

    def evaluate_short_answer(
        self,
        student_id: str,
        unit_id: str,
        student_answer: str
    ) -> Dict[str, Any]:
        """
        AI Chấm Câu Trả Lời Tự Luận Ngắn của học sinh (Semantic & Key-Concept Answer Grader):
        1. Đối sánh các khái niệm lịch sử cốt lõi (nhân vật, địa danh, năm tháng, chiến thuật)
           trong câu trả lời của học sinh với tư liệu chuẩn (`fact_chunk` & `answer`).
        2. Chấm điểm trên thang 10, chỉ rõ các ý học sinh đã nêu đúng và các ý còn thiếu.
        3. Tự động cập nhật xác suất nắm vững kiến thức P(L) vào hồ sơ BKT của học sinh.
        """
        self._load_curriculum_metadata()
        kb_unit = self.knowledge_base.get(unit_id)
        if not kb_unit:
            raise ValueError(f"Không tìm thấy cụm tri thức '{unit_id}' trong cơ sở dữ liệu.")

        fact_chunk = kb_unit.get("fact_chunk", "")
        ref_answer = kb_unit.get("answer", "")
        topic = kb_unit.get("topic", unit_id)

        norm_student = _normalize_vi_text(student_answer)
        student_tokens = set(norm_student.split())

        # Trích xuất các cụm từ khóa quan trọng từ fact_chunk và entity
        stopwords = {
            "la", "va", "cua", "trong", "tai", "nam", "thang", "ngay", "cac", "nhung",
            "duoc", "cho", "khi", "sau", "truoc", "voi", "mot", "hai", "ba", "bon",
            "da", "de", "do", "bi", "vao", "ra", "len", "xuong", "theo", "tu", "den"
        }
        norm_fact = _normalize_vi_text(fact_chunk)
        fact_words = [w for w in norm_fact.split() if len(w) > 2 and w not in stopwords]

        # Tạo tập khái niệm trọng tâm (2-grams và từ khóa năm tháng/địa danh)
        candidate_concepts: List[str] = []
        raw_phrases = re.split(r"[,.;:()\-–]+", fact_chunk)
        for phrase in raw_phrases:
            clean_p = phrase.strip()
            if 4 <= len(clean_p) <= 45:
                candidate_concepts.append(clean_p)

        # Kiểm tra từng ý lịch sử trong câu trả lời của học sinh
        matched_concepts: List[str] = []
        missing_concepts: List[str] = []

        for concept in candidate_concepts[:6]:
            norm_c = _normalize_vi_text(concept)
            c_tokens = [t for t in norm_c.split() if t not in stopwords and len(t) > 2]
            if not c_tokens:
                continue
            hit_count = sum(1 for t in c_tokens if t in student_tokens)
            if hit_count / len(c_tokens) >= 0.5:
                matched_concepts.append(concept)
            else:
                missing_concepts.append(concept)

        # Độ phủ từ vựng cốt lõi (Token Recall trên fact_chunk)
        unique_fact_tokens = set(fact_words)
        token_recall = (
            len(unique_fact_tokens & student_tokens) / len(unique_fact_tokens)
            if unique_fact_tokens else 0.0
        )
        concept_ratio = (
            len(matched_concepts) / max(1, len(matched_concepts) + len(missing_concepts))
        )

        raw_score = (0.55 * concept_ratio + 0.45 * min(1.0, token_recall * 1.6)) * 10.0
        score_10 = round(min(10.0, max(1.0 if len(student_tokens) >= 3 else 0.0, raw_score)), 1)
        is_passed = score_10 >= 6.0

        # Cập nhật vào hồ sơ BKT của học sinh
        bkt_update = self.update_student_response(
            student_id=student_id,
            unit_id=unit_id,
            is_correct=is_passed
        )

        if score_10 >= 8.0:
            feedback = (
                f"🌟 Xuất sắc ({score_10}/10 điểm)! Câu trả lời của em rất chắc chắn, nắm trúng bản chất sự kiện '{topic}'."
            )
        elif score_10 >= 6.0:
            feedback = (
                f"✅ Đạt yêu cầu ({score_10}/10 điểm)! Em đã nhớ được ý chính của '{topic}', "
                "nhưng cần bổ sung thêm một vài chi tiết sử liệu bên dưới để đạt điểm tuyệt đối."
            )
        else:
            feedback = (
                f"💡 Cần cố gắng thêm ({score_10}/10 điểm). Câu trả lời của em còn thiếu nhiều dữ kiện cốt lõi về '{topic}'. "
                "Em hãy xem lại đáp án chuẩn SGK và các ý còn thiếu bên dưới nhé!"
            )

        return {
            "student_id": student_id,
            "unit_id": unit_id,
            "topic": topic,
            "score_10": score_10,
            "coverage_ratio": round(concept_ratio, 4),
            "is_passed": is_passed,
            "matched_concepts": matched_concepts[:4],
            "missing_concepts": missing_concepts[:4],
            "ai_feedback": feedback,
            "standard_reference_answer": fact_chunk or ref_answer,
            "bkt_update": bkt_update,
            "study_material": self.get_study_material(unit_id)
        }

    def get_learning_analytics(self) -> Dict[str, Any]:
        """Trả về thống kê chủ đề được hỏi nhiều nhất và danh sách câu hỏi cần bổ sung dữ liệu."""
        self._load_curriculum_metadata()
        pop = self.analytics_data.get("topic_popularity", {})
        sorted_topics = sorted(pop.items(), key=lambda x: x[1], reverse=True)
        top_topics = [
            {
                "unit_id": uid,
                "topic": self.q_matrix.get(uid, {}).get("topic", uid),
                "question_count": count
            }
            for uid, count in sorted_topics[:10]
        ]
        return {
            "total_tracked_students": len(self.student_states),
            "top_asked_topics": top_topics,
            "unanswered_queries": self.analytics_data.get("unanswered_queries", [])[-20:]
        }


# Khởi tạo Singleton BKT Engine
bkt_engine = BKTEngine()


if __name__ == "__main__":
    import sys
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")

    print("=" * 75)
    print("[BKT ENGINE] KIỂM THỬ PHÂN TÍCH HỒ SƠ TÀI KHOẢN & CHẤM TỰ LUẬN AI")
    print("=" * 75)

    profile_report = bkt_engine.analyze_student_profile("student_nguyen_van_long", top_k=3)
    print(f"• Học sinh : {profile_report['student_id']} | Cấp bậc: {profile_report['mastery_rank']}")
    print(f"• Chẩn đoán: {profile_report['ai_diagnosis']}\n")

    essay_res = bkt_engine.evaluate_short_answer(
        student_id="student_nguyen_van_long",
        unit_id="KC3_BACH_DANG_HOW",
        student_answer="Tháng 4/1288 Trần Hưng Đạo cho đóng cọc gỗ ngầm trên sông Bạch Đằng, nhử thuyền giặc vào lúc thủy triều lên rồi đánh lớn khi triều rút, bắt sống Ô Mã Nhi."
    )
    print(f"• Chấm tự luận Bạch Đằng 1288: {essay_res['score_10']}/10 điểm -> P(L) mới: {essay_res['bkt_update']['new_p_l']}")
    print(f"• Nhận xét AI: {essay_res['ai_feedback']}")
    print("=" * 75)
