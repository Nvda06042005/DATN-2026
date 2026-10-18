"""
MODULE: BAYESIAN KNOWLEDGE TRACING (BKT) ENGINE & GỢI Ý CÁ NHÂN HÓA
================================================================================
Khắc phục Khó khăn 3 theo đúng hướng dẫn của Mentor:
1. Thuật toán Bayesian Knowledge Tracing (BKT) cho từng cụm tri thức (32 skills).
2. 4 tham số chuẩn:
   - P(L0): Xác suất nắm vững kiến thức ban đầu (Prior, mặc định 0.30)
   - P(T) : Xác suất học được sau mỗi lượt tương tác (Transition, 0.15)
   - P(G) : Xác suất đoán mò đúng khi chưa biết (Guess, 0.25)
   - P(S) : Xác suất trượt/lơ đễnh sai dù đã biết (Slip, 0.10)
3. Cập nhật Bayes sau mỗi câu hỏi trắc nghiệm/tương tác:
   - Khi trả lời ĐÚNG:
     P(L_t-1 | Correct) = [P(L) * (1 - P(S))] / [P(L) * (1 - P(S)) + (1 - P(L)) * P(G)]
   - Khi trả lời SAI:
     P(L_t-1 | Incorrect) = [P(L) * P(S)] / [P(L) * P(S) + (1 - P(L)) * (1 - P(G))]
   - Xác suất sau chuyển tiếp:
     P(L_t) = P(L_t-1 | Evidence) + (1 - P(L_t-1 | Evidence)) * P(T)
4. Hệ số quên theo thời gian (Forgetting Decay):
   P(L_after_days) = P(L) * exp(-lambda * delta_days)
5. Gợi ý cá nhân hóa (Personalized Recommendation):
   Tự động xác định các cụm tri thức có P(L) < 0.60 để đề xuất bài ôn tập / câu hỏi củng cố.
"""

import json
import math
import time
from pathlib import Path
from typing import Dict, List, Any, Optional

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
QMATRIX_FILE = DATA_DIR / "q_matrix.json"


class BKTEngine:
    """
    Bộ máy theo dõi tiến độ tri thức học sinh theo phương pháp Bayesian Knowledge Tracing.
    """
    def __init__(
        self,
        default_p_l0: float = 0.30,
        default_p_t: float = 0.15,
        default_p_g: float = 0.25,
        default_p_s: float = 0.10,
        forget_lambda: float = 0.05  # Tỷ lệ suy giảm trí nhớ theo ngày
    ):
        self.default_p_l0 = default_p_l0
        self.default_p_t = default_p_t
        self.default_p_g = default_p_g
        self.default_p_s = default_p_s
        self.forget_lambda = forget_lambda

        self.q_matrix: Dict[str, Any] = {}
        self._load_q_matrix()

        # Lưu trạng thái học sinh: student_id -> { unit_id: {"p_l": float, "last_updated_time": float, "attempts": int} }
        self.student_states: Dict[str, Dict[str, Dict[str, Any]]] = {}

    def _load_q_matrix(self):
        if QMATRIX_FILE.exists():
            try:
                with open(QMATRIX_FILE, "r", encoding="utf-8") as f:
                    self.q_matrix = json.load(f)
            except Exception:
                pass

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
                "correct_count": 0
            }
            return self.default_p_l0

        record = student_data[unit_id]
        current_p_l = record["p_l"]

        # Áp dụng hàm suy giảm trí nhớ Ebbinghaus: P(L) * e^(-lambda * delta_days)
        delta_days = (time.time() - record["last_updated_time"]) / 86400.0
        if delta_days > 0.01:
            decay_factor = math.exp(-self.forget_lambda * delta_days)
            # Ngưỡng sàn kiến thức tối thiểu không bao giờ về 0 tuyệt đối
            current_p_l = max(0.15, current_p_l * decay_factor)
            record["p_l"] = current_p_l
            record["last_updated_time"] = time.time()

        return round(current_p_l, 4)

    def update_student_response(
        self,
        student_id: str,
        unit_id: str,
        is_correct: bool,
        cognitive_level: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Cập nhật Bayes chuẩn sau khi học sinh làm bài:
        """
        old_p_l = self.get_student_knowledge_level(student_id, unit_id)

        # Điều chỉnh P(G) và P(S) linh hoạt theo độ khó trong Q-matrix nếu có
        q_meta = self.q_matrix.get(unit_id, {})
        difficulty = q_meta.get("difficulty", 0.5)

        # Câu càng khó thì xác suất đoán trúng (P_G) càng thấp, xác suất trượt (P_S) càng cao
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

        # Lưu lại lịch sử
        record = self.student_states[student_id][unit_id]
        record["p_l"] = round(new_p_l, 4)
        record["last_updated_time"] = time.time()
        record["attempts"] += 1
        if is_correct:
            record["correct_count"] += 1

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

    def recommend_personalized_review(self, student_id: str, top_k: int = 3) -> List[Dict[str, Any]]:
        """
        Đề xuất lộ trình học cá nhân hóa:
        Tìm các cụm tri thức có P(L) thấp nhất (< 0.60) để nhắc nhở học sinh ôn tập trọng tâm.
        """
        recommendations = []
        for uid, meta in self.q_matrix.items():
            # Bỏ qua các nhãn ngoài phạm vi hoặc chào hỏi
            if meta.get("category") in ["OUT_OF_DOMAIN", "CONVERSATIONAL_INTENT"]:
                continue

            p_l = self.get_student_knowledge_level(student_id, uid)
            if p_l < 0.60:
                recommendations.append({
                    "unit_id": uid,
                    "topic": meta.get("topic"),
                    "category": meta.get("category"),
                    "current_mastery": p_l,
                    "difficulty": meta.get("difficulty"),
                    "cognitive_level": meta.get("cognitive_level"),
                    "reason": f"Mức độ nắm vững hiện tại chỉ đạt {int(p_l * 100)}% (Dưới ngưỡng 60%)"
                })

        # Sắp xếp từ yếu nhất lên để ưu tiên ôn tập
        recommendations.sort(key=lambda x: x["current_mastery"])
        return recommendations[:top_k]


# Khởi tạo Singleton BKT Engine
bkt_engine = BKTEngine()


if __name__ == "__main__":
    import sys
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")

    print("=" * 70)
    print("[BKT ENGINE] KIỂM THỬ THUẬT TOÁN BAYESIAN KNOWLEDGE TRACING & GỢI Ý")
    print("=" * 70)

    test_student = "student_nguyen_van_a"
    test_unit = "TQT_WHY_ORANGE"

    print(f"1. Xác suất ban đầu P(L0) của học sinh: {bkt_engine.get_student_knowledge_level(test_student, test_unit)}")

    # Lượt 1: Học sinh trả lời SAI
    step1 = bkt_engine.update_student_response(test_student, test_unit, is_correct=False)
    print(f"2. Sau khi trả lời SAI: P(L) giảm còn {step1['new_p_l']} ({step1['mastery_status']})")

    # Lượt 2: Học sinh được gợi ý và trả lời ĐÚNG
    step2 = bkt_engine.update_student_response(test_student, test_unit, is_correct=True)
    print(f"3. Sau khi trả lời ĐÚNG lượt 1: P(L) tăng lên {step2['new_p_l']} ({step2['mastery_status']})")

    # Lượt 3: Học sinh tiếp tục làm ĐÚNG câu vận dụng
    step3 = bkt_engine.update_student_response(test_student, test_unit, is_correct=True)
    print(f"4. Sau khi trả lời ĐÚNG lượt 2: P(L) tăng lên {step3['new_p_l']} ({step3['mastery_status']})")

    # Gợi ý cá nhân hóa các chủ đề cần củng cố
    recs = bkt_engine.recommend_personalized_review(test_student, top_k=3)
    print("\n[GỢI Ý CÁ NHÂN HÓA - VÙNG KIẾN THỨC CẦN ÔN TẬP]:")
    for idx, r in enumerate(recs, 1):
        print(f"  {idx}. {r['topic']} (Mastery: {int(r['current_mastery'] * 100)}% - Mức độ: {r['cognitive_level']})")
    print("=" * 70)
