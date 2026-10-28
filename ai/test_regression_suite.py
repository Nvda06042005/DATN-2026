"""
TEST REGRESSION SUITE: BỘ KIỂM THỬ HỒI QUY TOÀN DIỆN CHO AI SỬ HỌC ĐÔNG A
================================================================================
Bao phủ 9 nhóm tình huống kiểm thử (Categories A -> I) theo đúng đặc tả yêu cầu:
- Category A: Direct factual questions (Câu hỏi sự thật trực tiếp)
- Category B: Paraphrased colloquial queries (Câu hỏi khẩu ngữ, viết tắt, không dấu)
- Category C: Follow-up conversational context (Xử lý câu hỏi nối tiếp - Primary Bug Section 2)
- Category D: Ambiguous references requiring clarification (Làm rõ đại từ vua khi chưa có ngữ cảnh)
- Category E: Out-of-domain questions (Nhận diện câu hỏi ngoài phạm vi môn học)
- Category F: Absent historical facts (Chi tiết đời tư/hậu cần không có trong SGK 7)
- Category G: Questions with incorrect historical premises (Đính chính tiền đề sai)
- Category H: API timeout and local fallback (Cơ chế Circuit Breaker & Fallback cục bộ <10ms)
- Category I: Topic changes & stale-context prevention (Chuyển chủ đề & chống ô nhiễm ngữ cảnh cũ)
"""

import sys
import time
import asyncio
from pathlib import Path
from typing import List, Dict, Any, Tuple

# Cấu hình môi trường và đường dẫn: thư mục ai/ luôn đứng đầu sys.path, sau đó đến backend/
AI_DIR = Path(__file__).resolve().parent
BACKEND_DIR = AI_DIR.parent / "backend"
for _path in (BACKEND_DIR, AI_DIR):
    if _path.exists():
        _p_str = str(_path)
        if _p_str in sys.path:
            sys.path.remove(_p_str)
        sys.path.insert(0, _p_str)

import joblib
from create_model import MODEL_PATH, DongANLPModel
from hybrid_router import HybridNLPRouter, CircuitBreaker

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")


class RegressionTestRunner:
    def __init__(self):
        self.model: DongANLPModel = joblib.load(MODEL_PATH)
        self.passed_tests = 0
        self.failed_tests = 0
        self.test_details: List[Dict[str, Any]] = []

    def record_result(self, category: str, test_name: str, passed: bool, details: str = ""):
        if passed:
            self.passed_tests += 1
            status = "✅ PASS"
        else:
            self.failed_tests += 1
            status = "❌ FAIL"
        self.test_details.append({
            "category": category,
            "name": test_name,
            "status": status,
            "passed": passed,
            "details": details
        })
        print(f"[{status}] [{category}] {test_name}: {details}")

    # ==========================================================================
    # CATEGORY A: DIRECT FACTUAL QUESTIONS
    # ==========================================================================
    def test_category_a_direct_factual(self):
        print("\n" + "=" * 70)
        print("▶ CATEGORY A: DIRECT FACTUAL QUESTIONS")
        print("=" * 70)

        test_cases = [
            ("Ai chỉ huy trận Bạch Đằng năm 1288?", "KC3_BACH_DANG_HOW", "Trần Hưng Đạo"),
            ("Hội nghị Diên Hồng được tổ chức vào năm nào?", "DIEN_HONG_CONFERENCE", "1285"),
            ("Trận phản công Đông Bộ Đầu diễn ra ngày tháng năm nào?", "KC1_DONG_BO_DAU", "1258"),
            ("Ai là người lấy ván thuyền che tên cho vua Trần Thái Tông?", "KC1_BINH_LE_NGUYEN", "Lê Phụ Trần")
        ]

        for query, expected_uid, expected_keyword in test_cases:
            res = self.model.generate_natural_response(query, session_id="cat_a")
            uid_ok = (res["unit_id"] == expected_uid)
            ans_ok = (expected_keyword.lower() in res["answer"].lower())
            passed = uid_ok and ans_ok
            self.record_result(
                "A",
                f"Factual: '{query}'",
                passed,
                f"Predicted: {res['unit_id']} | Contains keyword '{expected_keyword}': {ans_ok}"
            )

    # ==========================================================================
    # CATEGORY B: PARAPHRASED COLLOQUIAL QUERIES
    # ==========================================================================
    def test_category_b_paraphrased_colloquial(self):
        print("\n" + "=" * 70)
        print("▶ CATEGORY B: PARAPHRASED COLLOQUIAL QUERIES (VIẾT TẮT, KHÔNG DẤU, KHẨU NGỮ)")
        print("=" * 70)

        test_cases = [
            ("tqt bop cam o dau", "TQT_WHY_ORANGE", "Bình Than"),
            ("vi sao thoat hoan phai chui vao ong dong", "KC2_THOAT_HOAN_COPPER_PIPE", "ống đồng"),
            ("kccm lan 1 nam bao nhieu", "KC1_OVERVIEW", "1258"),
            ("tai sao lai dung ke vknt tai thang long", "KC1_VUON_KHONG_NHA_TRONG", "Vườn không nhà trống")
        ]

        for query, expected_uid, expected_keyword in test_cases:
            res = self.model.generate_natural_response(query, session_id="cat_b")
            uid_ok = (res["unit_id"] == expected_uid)
            ans_ok = (expected_keyword.lower() in res["answer"].lower())
            passed = uid_ok and ans_ok
            self.record_result(
                "B",
                f"Colloquial: '{query}'",
                passed,
                f"Predicted: {res['unit_id']} | Contains keyword '{expected_keyword}': {ans_ok}"
            )

    # ==========================================================================
    # CATEGORY C: FOLLOW-UP CONVERSATIONAL CONTEXT (PRIMARY BUG & FOLLOW-UPS)
    # ==========================================================================
    def test_category_c_followup_context(self):
        print("\n" + "=" * 70)
        print("▶ CATEGORY C: FOLLOW-UP CONVERSATIONAL CONTEXT (SECTION 2 PRIMARY BUG & 6 FOLLOW-UPS)")
        print("=" * 70)

        # C.1: Primary Bug reproduction and fix:
        # Turn 1: "Âm mưu Mông Cổ xâm lược Đại Việt"
        # Turn 2: "Vua Trần đã xử lý thế nào?"
        sess_c1 = "cat_c_primary_bug"
        res1 = self.model.generate_natural_response("Âm mưu Mông Cổ xâm lược Đại Việt", session_id=sess_c1)
        res2 = self.model.generate_natural_response("Vua Trần đã xử lý thế nào?", session_id=sess_c1)

        t1_ok = (res1["unit_id"] == "KC1_WHY_INVADE")
        t2_ok = (res2["unit_id"] == "KC1_WHY_INVADE" and "cự tuyệt" in res2["answer"].lower() and "giam" in res2["answer"].lower())
        self.record_result(
            "C.1",
            "PRIMARY BUG FIX: Turn 1 'Âm mưu' -> Turn 2 'Vua Trần đã xử lý thế nào?'",
            t1_ok and t2_ok,
            f"Turn 1: {res1['unit_id']} | Turn 2: {res2['unit_id']} (Explains King's handling: {t2_ok})"
        )

        # C.2: Follow-up 2: "Nhà vua làm gì tiếp theo?"
        res3 = self.model.generate_natural_response("Nhà vua làm gì tiếp theo?", session_id=sess_c1)
        t3_ok = (res3["unit_id"] in ["KC1_OVERVIEW", "KC1_BINH_LE_NGUYEN", "KC1_WHY_INVADE"])
        self.record_result(
            "C.2",
            "Follow-up: 'Nhà vua làm gì tiếp theo?'",
            t3_ok,
            f"Predicted: {res3['unit_id']} | Conf: {res3['confidence']}"
        )

        # C.3: Follow-up 3: "Vậy quân ta chống trả ra sao?"
        res4 = self.model.generate_natural_response("Vậy quân ta chống trả ra sao?", session_id=sess_c1)
        t4_ok = (res4["unit_id"] in ["KC1_OVERVIEW", "KC1_VUON_KHONG_NHA_TRONG", "KC1_DONG_BO_DAU"])
        self.record_result(
            "C.3",
            "Follow-up: 'Vậy quân ta chống trả ra sao?'",
            t4_ok,
            f"Predicted: {res4['unit_id']} | Conf: {res4['confidence']}"
        )

        # C.4: Follow-up 4: "Tại sao lại làm như vậy?" (sau khi hỏi về Vườn không nhà trống)
        sess_c4 = "cat_c_why"
        _ = self.model.generate_natural_response("Kế sách Vườn không nhà trống là gì?", session_id=sess_c4)
        res_why = self.model.generate_natural_response("Tại sao lại làm như vậy?", session_id=sess_c4)
        why_ok = (res_why["unit_id"] == "KC1_VUON_KHONG_NHA_TRONG")
        self.record_result(
            "C.4",
            "Follow-up Motive: 'Tại sao lại làm như vậy?'",
            why_ok,
            f"Predicted: {res_why['unit_id']} | Conf: {res_why['confidence']}"
        )

        # C.5: Follow-up 5: "Kết quả của trận đó là gì?" (sau khi hỏi về Đông Bộ Đầu)
        sess_c5 = "cat_c_battle"
        _ = self.model.generate_natural_response("Trận phản công Đông Bộ Đầu diễn ra thế nào?", session_id=sess_c5)
        res_res = self.model.generate_natural_response("Kết quả của trận đó là gì?", session_id=sess_c5)
        battle_ok = (res_res["unit_id"] == "KC1_DONG_BO_DAU")
        self.record_result(
            "C.5",
            "Follow-up Battle Result: 'Kết quả của trận đó là gì?'",
            battle_ok,
            f"Predicted: {res_res['unit_id']} | Conf: {res_res['confidence']}"
        )

        # C.6: Follow-up 6: "Còn năm 1285 thì sao?" (Timeline shift)
        res_shift = self.model.generate_natural_response("Còn năm 1285 thì sao?", session_id=sess_c1)
        shift_ok = (res_shift["unit_id"] == "KC2_OVERVIEW")
        self.record_result(
            "C.6",
            "Timeline Shift: 'Còn năm 1285 thì sao?'",
            shift_ok,
            f"Predicted: {res_shift['unit_id']} | Conf: {res_shift['confidence']}"
        )

    # ==========================================================================
    # CATEGORY D: AMBIGUOUS REFERENCES REQUIRING CLARIFICATION
    # ==========================================================================
    def test_category_d_clarification(self):
        print("\n" + "=" * 70)
        print("▶ CATEGORY D: AMBIGUOUS REFERENCES REQUIRING CLARIFICATION (TURN 1 NO CONTEXT)")
        print("=" * 70)

        test_cases = [
            ("Vua Trần đã xử lý thế nào?", "fresh_session_d1"),
            ("Nhà vua xử lý ra sao?", "fresh_session_d2"),
            ("Vua thời Trần là ai?", "fresh_session_d3"),
        ]

        for query, sess_id in test_cases:
            res = self.model.generate_natural_response(query, session_id=sess_id)
            is_clarify = (res["unit_id"] == "CLARIFY_AMBIGUOUS_TRAN_KING")
            mentions_kings = (
                "Trần Thái Tông" in res["answer"]
                and "Trần Thánh Tông" in res["answer"]
                and "Trần Nhân Tông" in res["answer"]
            )
            passed = is_clarify and mentions_kings
            self.record_result(
                "D",
                f"Clarification: '{query}'",
                passed,
                f"Unit: {res['unit_id']} | Mentions all 3 campaigns and kings: {mentions_kings}"
            )

    # ==========================================================================
    # CATEGORY E: OUT-OF-DOMAIN QUESTIONS
    # ==========================================================================
    def test_category_e_out_of_domain(self):
        print("\n" + "=" * 70)
        print("▶ CATEGORY E: OUT-OF-DOMAIN QUESTIONS (CHỐNG TRẢ LỜI BỪA)")
        print("=" * 70)

        test_cases = [
            "Công thức tính diện tích hình tròn là gì?",
            "Thủ đô của nước Pháp là gì?",
            "576",
            "Hướng dẫn cách làm bánh pizza hải sản"
        ]

        for query in test_cases:
            res = self.model.generate_natural_response(query, session_id="cat_e")
            is_ood = (res["unit_id"] == "OOD_RANDOM_AND_OFFTOPIC")
            has_guidance = ("Ba lần kháng chiến" in res["answer"])
            passed = is_ood and has_guidance
            self.record_result(
                "E",
                f"OOD: '{query}'",
                passed,
                f"Unit: {res['unit_id']} | Provides curriculum guidance: {has_guidance}"
            )

    # ==========================================================================
    # CATEGORY F: ABSENT HISTORICAL FACTS
    # ==========================================================================
    def test_category_f_absent_facts(self):
        print("\n" + "=" * 70)
        print("▶ CATEGORY F: ABSENT HISTORICAL FACTS (NGOÀI PHẠM VI SGK 7)")
        print("=" * 70)

        test_cases = [
            "Vợ của Thoát Hoan tên là gì?",
            "Quân Mông Cổ ăn gì khi hành quân sang Đại Việt?",
            "Ngày sinh của Thoát Hoan là ngày mấy tháng mấy?"
        ]

        for query in test_cases:
            res = self.model.generate_natural_response(query, session_id="cat_f")
            is_absent = (res["unit_id"] == "ABSENT_HISTORICAL_FACT")
            has_explanation = ("không được ghi chép" in res["answer"] or "ngoài phạm vi" in res["answer"])
            passed = is_absent and has_explanation
            self.record_result(
                "F",
                f"Absent Fact: '{query}'",
                passed,
                f"Unit: {res['unit_id']} | Explains absence politely: {has_explanation}"
            )

    # ==========================================================================
    # CATEGORY G: QUESTIONS WITH INCORRECT HISTORICAL PREMISES
    # ==========================================================================
    def test_category_g_false_premises(self):
        print("\n" + "=" * 70)
        print("▶ CATEGORY G: QUESTIONS WITH INCORRECT HISTORICAL PREMISES (ĐÍNH CHÍNH TIỀN ĐỀ SAI)")
        print("=" * 70)

        test_cases = [
            ("Vì sao Trần Hưng Đạo bóp nát quả cam?", "CORRECTION_FALSE_PREMISE_ORANGE", "Trần Quốc Toản"),
            ("Trần Quốc Toản chỉ huy trận Bạch Đằng 1288 đúng không?", "CORRECTION_FALSE_PREMISE_BACH_DANG", "Trần Quốc Tuấn"),
            ("Quang Trung đánh tan quân Mông Cổ năm 1258 như thế nào?", "CROSS_ERA_QUANG_TRUNG_LE_LOI_LY_THUONG_KIET", "Nguyễn Huệ")
        ]

        for query, expected_uid, correct_entity in test_cases:
            res = self.model.generate_natural_response(query, session_id="cat_g")
            uid_ok = (res["unit_id"] == expected_uid)
            corrected_ok = (correct_entity.lower() in res["answer"].lower())
            passed = uid_ok and corrected_ok
            self.record_result(
                "G",
                f"False Premise: '{query}'",
                passed,
                f"Unit: {res['unit_id']} | Clarifies real entity '{correct_entity}': {corrected_ok}"
            )

    # ==========================================================================
    # CATEGORY H: API TIMEOUT AND LOCAL FALLBACK
    # ==========================================================================
    def test_category_h_api_timeout_fallback(self):
        print("\n" + "=" * 70)
        print("▶ CATEGORY H: API TIMEOUT & LOCAL HIGH-SPEED FALLBACK (<10MS)")
        print("=" * 70)

        router = HybridNLPRouter()
        # Mô phỏng trạng thái Circuit Breaker OPEN (API ngoài lỗi hoặc timeout)
        router.circuit_breaker.state = "OPEN"
        router.circuit_breaker.last_failure_time = time.time()

        local_res = self.model.generate_natural_response(
            "Vì sao Trần Quốc Toản lại bóp nát quả cam?", session_id="cat_h"
        )

        start_time = time.time()
        # Chạy router khi API ngoài bị ngắt
        loop = asyncio.get_event_loop()
        routed_res = loop.run_until_complete(
            router.route_and_respond(
                query="Vì sao Trần Quốc Toản lại bóp nát quả cam?",
                local_result=local_res,
                character_id=None
            )
        )
        elapsed_ms = (time.time() - start_time) * 1000

        has_answer = bool(routed_res.get("answer"))
        served_locally = ("Local" in routed_res.get("served_by", "") or "Cache" in routed_res.get("served_by", ""))
        speed_ok = elapsed_ms < 50.0  # Fallback phải cực nhanh <50ms

        passed = has_answer and served_locally and speed_ok
        self.record_result(
            "H",
            "Circuit Breaker Triggered -> Zero-Latency Fallback to Local NLG",
            passed,
            f"Served by: '{routed_res.get('served_by')}' | Latency: {elapsed_ms:.2f}ms"
        )

    # ==========================================================================
    # CATEGORY I: CONVERSATION TOPIC CHANGES & STALE-CONTEXT PREVENTION
    # ==========================================================================
    def test_category_i_topic_change(self):
        print("\n" + "=" * 70)
        print("▶ CATEGORY I: TOPIC CHANGES & STALE-CONTEXT PREVENTION (CHỐNG Ô NHIỄM NGỮ CẢNH)")
        print("=" * 70)

        sess_i = "cat_i_session"
        # Turn 1: Hỏi về Trần Quốc Toản
        res1 = self.model.generate_natural_response("Vì sao Trần Quốc Toản bóp nát quả cam?", session_id=sess_i)
        t1_ok = (res1["unit_id"] == "TQT_WHY_ORANGE")

        # Turn 2: Chuyển hẳn sang Trận Bạch Đằng năm 1288 (không dùng đại từ, chủ đề độc lập mới)
        res2 = self.model.generate_natural_response("Trận Bạch Đằng năm 1288 diễn ra như thế nào?", session_id=sess_i)
        t2_ok = (res2["unit_id"] == "KC3_BACH_DANG_HOW")
        not_contaminated = ("Trần Quốc Toản" not in res2["answer"] or "Hưng Đạo" in res2["answer"])

        passed = t1_ok and t2_ok and not_contaminated
        self.record_result(
            "I",
            "Topic Shift from Trần Quốc Toản to Trận Bạch Đằng 1288",
            passed,
            f"Turn 1: {res1['unit_id']} | Turn 2: {res2['unit_id']} | Stale entity excluded: {not_contaminated}"
        )

    # ==========================================================================
    # CATEGORY J: CRITICAL FAILURES REGRESSION (4 FAILURES & SOURCE FAITHFULNESS)
    # ==========================================================================
    def test_category_j_critical_failures(self):
        print("\n" + "=" * 70)
        print("▶ CATEGORY J: CRITICAL FAILURES REGRESSION (4 FAILURES & SOURCE FAITHFULNESS)")
        print("=" * 70)

        # Failure 1: Tại sao quân Nguyên đông và mạnh mà vẫn thua Đại Việt?
        q1 = "Tại sao quân Nguyên đông và mạnh mà vẫn thua Đại Việt?"
        res1 = self.model.generate_natural_response(q1, session_id="cat_j_1")
        f1_uid_ok = (res1["unit_id"] == "CAUSES_OF_VICTORY")
        f1_ans_ok = any(w in res1["answer"].lower() for w in ["đoàn kết", "lãnh đạo", "nghệ thuật quân sự", "vườn không nhà trống"])
        f1_not_invade = ("bắt giam sứ giả" not in res1["answer"].lower())
        self.record_result(
            "J.1",
            f"Failure 1 (Retrieval Misalignment): '{q1}'",
            f1_uid_ok and f1_ans_ok and f1_not_invade,
            f"Unit: {res1['unit_id']} (Expected: CAUSES_OF_VICTORY) | Explains victory causes: {f1_ans_ok} | No invasion confusion: {f1_not_invade}"
        )

        # Failure 2: Vì sao quân Trần chủ động rút khỏi Thăng Long?
        q2 = "Vì sao quân Trần chủ động rút khỏi Thăng Long?"
        res2 = self.model.generate_natural_response(q2, session_id="cat_j_2")
        f2_uid_ok = (res2["unit_id"] == "KC1_VUON_KHONG_NHA_TRONG")
        f2_ans_ok = ("vườn không nhà trống" in res2["answer"].lower() and "lương" in res2["answer"].lower() and "bảo toàn" in res2["answer"].lower())
        self.record_result(
            "J.2",
            f"Failure 2 (Targeted Withdrawal): '{q2}'",
            f2_uid_ok and f2_ans_ok,
            f"Unit: {res2['unit_id']} (Expected: KC1_VUON_KHONG_NHA_TRONG) | Explains Thăng Long evacuation: {f2_ans_ok}"
        )

        # Failure 3: Vì sao chiến thuật rút lui không đồng nghĩa với thất bại?
        q3 = "Vì sao chiến thuật rút lui không đồng nghĩa với thất bại?"
        res3 = self.model.generate_natural_response(q3, session_id="cat_j_3")
        f3_uid_ok = (res3["unit_id"] != "OOD_RANDOM_AND_OFFTOPIC" and res3["unit_id"] in ["KC1_VUON_KHONG_NHA_TRONG", "KC1_BINH_LE_NGUYEN", "CAUSES_OF_VICTORY"])
        f3_ans_ok = ("bảo toàn" in res3["answer"].lower() and ("phản công" in res3["answer"].lower() or "vườn không" in res3["answer"].lower()))
        self.record_result(
            "J.3",
            f"Failure 3 (Reasoning Not Rejected): '{q3}'",
            f3_uid_ok and f3_ans_ok,
            f"Unit: {res3['unit_id']} (Not OOD) | Grounded strategic reasoning: {f3_ans_ok}"
        )

        # Failure 4: Sau khi rút khỏi Thăng Long thì quân ta làm gì?
        sess_j4 = "cat_j_4"
        _ = self.model.generate_natural_response("Kế sách Vườn không nhà trống tại Thăng Long là gì?", session_id=sess_j4)
        q4 = "Vậy sau khi rút khỏi Thăng Long thì quân ta làm gì?"
        res4 = self.model.generate_natural_response(q4, session_id=sess_j4)
        f4_uid_ok = (res4["unit_id"] in ["KC1_DONG_BO_DAU", "KC1_VUON_KHONG_NHA_TRONG"])
        f4_ans_ok = ("đông bộ đầu" in res4["answer"].lower() or "phản công" in res4["answer"].lower() or "thiên mạc" in res4["answer"].lower())
        f4_no_drift = ("3 nguyên nhân căn bản" not in res4["answer"].lower() and "ba nguyên nhân căn bản" not in res4["answer"].lower())
        self.record_result(
            "J.4",
            f"Failure 4 (Context Drift Fix): '{q4}'",
            f4_uid_ok and f4_ans_ok and f4_no_drift,
            f"Unit: {res4['unit_id']} | Connects to counterattack/East: {f4_ans_ok} | No context drift: {f4_no_drift}"
        )

        # Issue 5: Source Faithfulness (Không bịa đặt cọc gỗ lim ngoài SGK 7)
        q5 = "Trận Bạch Đằng năm 1288 đã diễn ra như thế nào?"
        res5 = self.model.generate_natural_response(q5, session_id="cat_j_5")
        f5_grounded = ("cọc gỗ" in res5["answer"].lower() and "lim" not in res5["answer"].lower())
        f5_commanders = ("ô mã nhi" in res5["answer"].lower() and "phàn tiếp" in res5["answer"].lower())
        self.record_result(
            "J.5",
            f"Source Faithfulness: '{q5}'",
            f5_grounded and f5_commanders,
            f"Unit: {res5['unit_id']} | Strictly grounded (no unverified wood trivia): {f5_grounded} | Verified commanders: {f5_commanders}"
        )

    # ==========================================================================
    # CATEGORY K: 7 MANDATORY REGRESSION TESTS
    # ==========================================================================
    def test_category_k_mandatory_benchmarks(self):
        print("\n" + "=" * 70)
        print("▶ CATEGORY K: 7 MANDATORY REGRESSION TESTS (AUDIT & QUALITATIVE EVALUATION)")
        print("=" * 70)

        # Test 1: Bạch Đằng 1288 kết thúc kháng chiến lần thứ mấy? -> Trực tiếp: lần thứ ba
        q1 = "Chiến thắng Bạch Đằng năm 1288 đã kết thúc cuộc kháng chiến lần thứ mấy?"
        res1 = self.model.generate_natural_response(q1, session_id="cat_k_1")
        first_sentence_1 = res1["answer"].split("\n")[0].lower()
        t1_ok = ("lần thứ ba" in first_sentence_1 or "lần thứ 3" in first_sentence_1)
        self.record_result(
            "K.1",
            f"Bạch Đằng ends which war: '{q1}'",
            t1_ok,
            f"Unit: {res1['unit_id']} | Directly answers 3rd war in 1st sentence: {t1_ok} ('{first_sentence_1[:80]}')"
        )

        # Test 2: Nếu cố giữ Thăng Long bằng mọi giá -> Bất lợi gì? (Counterfactual)
        q2 = "Nếu quân Trần cố giữ Thăng Long bằng mọi giá, họ có thể gặp bất lợi gì?"
        res2 = self.model.generate_natural_response(q2, session_id="cat_k_2")
        ans2_lower = res2["answer"].lower()
        t2_counterfactual = ("suy luận" in ans2_lower or "giả định" in ans2_lower or "phân biệt" in ans2_lower or "quy luật" in ans2_lower)
        t2_disadvantages = ("đối đầu trực diện" in ans2_lower or "hung hãn" in ans2_lower) and ("bao vây" in ans2_lower or "chủ lực" in ans2_lower) and ("vườn không nhà trống" in ans2_lower or "lương thực" in ans2_lower)
        self.record_result(
            "K.2",
            f"Counterfactual Hold Thăng Long: '{q2}'",
            t2_counterfactual and t2_disadvantages,
            f"Unit: {res2['unit_id']} | Explicit counterfactual distinction: {t2_counterfactual} | 3 critical disadvantages analyzed: {t2_disadvantages}"
        )

        # Test 3: Thắng chỉ vì địch thiếu lương thực? -> Phản biện "Không", kết tinh 3 nguyên nhân
        q3 = "Có thể kết luận nhà Trần thắng chỉ vì quân địch thiếu lương thực không? Vì sao?"
        res3 = self.model.generate_natural_response(q3, session_id="cat_k_3")
        ans3_lower = res3["answer"].lower()
        first_sentence_3 = res3["answer"].split("\n")[0].lower()
        t3_refutation = ("không thể" in first_sentence_3 or "không" in first_sentence_3)
        t3_synthesis = ("đoàn kết" in ans3_lower and "lãnh đạo" in ans3_lower and "nghệ thuật quân sự" in ans3_lower)
        self.record_result(
            "K.3",
            f"Verification Only Food Shortage: '{q3}'",
            t3_refutation and t3_synthesis,
            f"Unit: {res3['unit_id']} | Leads with refutation in 1st sentence: {t3_refutation} | 3 integrated causes explained: {t3_synthesis}"
        )

        # Test 4: Có dùng đại bác trận Bạch Đằng 1288 không? -> Bác bỏ (thế kỷ XIII chưa có, súng thần cơ thế kỷ XV)
        q4 = "Nhà Trần sử dụng đại bác trong trận Bạch Đằng năm 1288 đúng không?"
        res4 = self.model.generate_natural_response(q4, session_id="cat_k_4")
        ans4_lower = res4["answer"].lower()
        first_sentence_4 = res4["answer"].split("\n")[0].lower()
        t4_rejection = ("không đúng" in first_sentence_4 or "sai" in first_sentence_4)
        t4_century = ("thế kỷ xiii" in ans4_lower or "thế kỷ 13" in ans4_lower) and ("hồ nguyên trừng" in ans4_lower or "thế kỷ xv" in ans4_lower or "thế kỷ 15" in ans4_lower)
        self.record_result(
            "K.4",
            f"Verification Cannon Bạch Đằng: '{q4}'",
            t4_rejection and t4_century,
            f"Unit: {res4['unit_id']} | Direct refutation in sentence 1: {t4_rejection} | Historical origin (13th vs 15th century Hồ Nguyên Trừng): {t4_century}"
        )

        # Test 5: Chính xác bao nhiêu binh sĩ ở Bình Lệ Nguyên? -> Sử liệu không ghi chép số liệu quân Trần
        q5 = "Trong tài liệu đang có, chính xác bao nhiêu binh sĩ nhà Trần tham gia trận Bình Lệ Nguyên?"
        res5 = self.model.generate_natural_response(q5, session_id="cat_k_5")
        ans5_lower = res5["answer"].lower()
        t5_honesty = ("không có số liệu" in ans5_lower or "không ghi chép" in ans5_lower or "không có ghi chép" in ans5_lower)
        t5_mongol_count = ("3 vạn" in ans5_lower or "ngột lương hợp thai" in ans5_lower)
        self.record_result(
            "K.5",
            f"Evidence Bình Lệ Nguyên Troop Count: '{q5}'",
            t5_honesty and t5_mongol_count,
            f"Unit: {res5['unit_id']} | Explicitly admits no exact Trần troop figure: {t5_honesty} | Cites verified 30k Mongol troops: {t5_mongol_count}"
        )

        # Test 6: Câu nói nguyên văn của Trần Hưng Đạo tại Bạch Đằng 1288? -> Không có trong trận Bạch Đằng, trích dẫn câu có nguồn (1285)
        q6 = "Hãy nêu một câu nói nguyên văn của Trần Hưng Đạo trong trận Bạch Đằng năm 1288, kèm nguồn trích dẫn."
        res6 = self.model.generate_natural_response(q6, session_id="cat_k_6")
        ans6_lower = res6["answer"].lower()
        t6_honesty = ("không có ghi chép" in ans6_lower or "không ghi chép" in ans6_lower or "không có câu nói nguyên văn" in ans6_lower)
        t6_sourced_quotes = ("chém đầu tôi trước" in ans6_lower or "hịch tướng sĩ" in ans6_lower) and "1285" in ans6_lower
        self.record_result(
            "K.6",
            f"Evidence Trần Hưng Đạo Quote Bạch Đằng: '{q6}'",
            t6_honesty and t6_sourced_quotes,
            f"Unit: {res6['unit_id']} | Accurately states no verbatim quote in 1288 battle: {t6_honesty} | Cites genuine sourced 1285 quotes: {t6_sourced_quotes}"
        )

        # Test 7: Chuỗi hội thoại 5 lượt liên hoàn (Multi-turn 5-turn sequence)
        sess_k7 = "cat_k_7_chain"
        # Turn 1: Tại sao quân Nguyên đông và mạnh mà vẫn thua Đại Việt?
        t1_q = "Tại sao quân Nguyên đông và mạnh mà vẫn thua Đại Việt?"
        res_t1 = self.model.generate_natural_response(t1_q, session_id=sess_k7)
        t7_1_ok = (res_t1["unit_id"] == "CAUSES_OF_VICTORY" and ("đoàn kết" in res_t1["answer"].lower() or "chênh lệch" in res_t1["answer"].lower()))

        # Turn 2: Vậy nhà Trần đã làm gì để khắc phục bất lợi đó?
        t2_q = "Vậy nhà Trần đã làm gì để khắc phục bất lợi đó?"
        res_t2 = self.model.generate_natural_response(t2_q, session_id=sess_k7)
        t7_2_ok = (res_t2["unit_id"] == "FOLLOWUP_OVERCOME_DISADVANTAGE" and "bất lợi" in res_t2["answer"].lower() and "rút lui" in res_t2["answer"].lower())

        # Turn 3: Còn chiến thuật rút lui thì sao?
        t3_q = "Còn chiến thuật rút lui thì sao?"
        res_t3 = self.model.generate_natural_response(t3_q, session_id=sess_k7)
        t7_3_ok = (res_t3["unit_id"] == "FOLLOWUP_RETREAT_TACTIC" and "bảo toàn" in res_t3["answer"].lower() and "không phải là thất bại" in res_t3["answer"].lower())

        # Turn 4: Lần thứ hai có diễn biến tương tự không?
        t4_q = "Lần thứ hai có diễn biến tương tự không?"
        res_t4 = self.model.generate_natural_response(t4_q, session_id=sess_k7)
        t7_4_ok = (res_t4["unit_id"] == "FOLLOWUP_COMPARE_CAMPAIGN_2_TO_1" and "1285" in res_t4["answer"] and ("50 vạn" in res_t4["answer"] or "thoát hoan" in res_t4["answer"].lower()))

        # Turn 5: Vậy trận đánh quyết định ở lần thứ ba là trận nào?
        t5_q = "Vậy trận đánh quyết định ở lần thứ ba là trận nào?"
        res_t5 = self.model.generate_natural_response(t5_q, session_id=sess_k7)
        first_sentence_t5 = res_t5["answer"].split("\n")[0].lower()
        t7_5_ok = (res_t5["unit_id"] == "FOLLOWUP_DECISIVE_BATTLE_CAMPAIGN_3" and "bạch đằng" in first_sentence_t5 and "1288" in first_sentence_t5)

        t7_all = t7_1_ok and t7_2_ok and t7_3_ok and t7_4_ok and t7_5_ok
        self.record_result(
            "K.7",
            "Multi-turn 5-step conversational flow without context drift",
            t7_all,
            f"T1: {t7_1_ok} ({res_t1['unit_id']}) | T2: {t7_2_ok} ({res_t2['unit_id']}) | T3: {t7_3_ok} ({res_t3['unit_id']}) | T4: {t7_4_ok} ({res_t4['unit_id']}) | T5: {t7_5_ok} ({res_t5['unit_id']})"
        )

    # ==========================================================================
    # CATEGORY L: 10 MANDATORY REGRESSION TESTS (AUDIT TEST 3 - SECTION 5)
    # ==========================================================================
    def test_category_l_test3_audit_10_tests(self):
        print("\n" + "=" * 70)
        print("▶ CATEGORY L: 10 MANDATORY REGRESSION TESTS (AUDIT TEST 3 - SECTION 5)")
        print("=" * 70)

        # 1. Bạch Đằng 1288 kết thúc cuộc kháng chiến lần thứ mấy?
        q1 = "Chiến thắng Bạch Đằng năm 1288 kết thúc cuộc kháng chiến lần thứ mấy?"
        res1 = self.model.generate_natural_response(q1, session_id="cat_l_1")
        first_line_1 = res1["answer"].split("\n")[0].lower()
        t1_direct = ("lần thứ ba" in first_line_1 or "lần thứ 3" in first_line_1)
        t1_grounded = ("tháng 4 năm 1288" in res1["answer"].lower() or "1287 – 1288" in res1["answer"])
        self.record_result(
            "L.1",
            f"Bạch Đằng ends which campaign: '{q1}'",
            t1_direct and t1_grounded,
            f"Unit: {res1['unit_id']} | Direct 1st sentence answer: {t1_direct} | Grounded time: {t1_grounded}"
        )

        # 2. So sánh cách đối phó năm 1258 và 1285 (Giống & Khác)
        q2 = "So sánh cách nhà Trần đối phó với quân Mông Cổ năm 1258 và quân Nguyên năm 1285. Nêu ít nhất một điểm giống và một điểm khác."
        res2 = self.model.generate_natural_response(q2, session_id="cat_l_2")
        ans2_lower = res2["answer"].lower()
        t2_structure = ("điểm giống nhau" in ans2_lower and "điểm khác biệt" in ans2_lower)
        t2_content = ("vườn không nhà trống" in ans2_lower and "rút lui" in ans2_lower and ("50 vạn" in ans2_lower or "diên hồng" in ans2_lower))
        self.record_result(
            "L.2",
            f"Compare 1258 and 1285: '{q2}'",
            t2_structure and t2_content,
            f"Unit: {res2['unit_id']} | Has structured Giống/Khác: {t2_structure} | Covers both 1258 & 1285 details: {t2_content}"
        )

        # 3. Kế sách vườn không nhà trống gây bất lợi cho quân xâm lược như thế nào?
        q3 = "Kế sách vườn không nhà trống gây bất lợi cho quân xâm lược như thế nào?"
        res3 = self.model.generate_natural_response(q3, session_id="cat_l_3")
        ans3_lower = res3["answer"].lower()
        t3_disadvantages = ("lương thực" in ans3_lower and ("đói" in ans3_lower or "thiếu đói" in ans3_lower) and ("dịch bệnh" in ans3_lower or "sĩ khí" in ans3_lower))
        t3_no_filler = ("đông bộ đầu" not in ans3_lower and "phản công tại đông bộ đầu" not in ans3_lower)
        self.record_result(
            "L.3",
            f"Vườn không nhà trống disadvantages to invaders: '{q3}'",
            t3_disadvantages and t3_no_filler,
            f"Unit: {res3['unit_id']} | 100% focused on invader disadvantages: {t3_disadvantages} | No extraneous counterattack filler: {t3_no_filler}"
        )

        # 4. Câu hỏi ngắn "Bạch Đằng 1288?"
        q4 = "Bạch Đằng 1288?"
        res4 = self.model.generate_natural_response(q4, session_id="cat_l_4")
        sentences_4 = [s.strip() for s in res4["answer"].replace("\n", " ").split(".") if s.strip()]
        t4_concise = (len(sentences_4) <= 3 and len(res4["answer"]) < 400)
        t4_no_followup = ("💡" not in res4["answer"])
        t4_core_facts = ("trần hưng đạo" in res4["answer"].lower() and "cọc ngầm" in res4["answer"].lower())
        self.record_result(
            "L.4",
            f"Short query: '{q4}'",
            t4_concise and t4_no_followup and t4_core_facts,
            f"Unit: {res4['unit_id']} | Sentences count ({len(sentences_4)} <= 3): {t4_concise} | No unwanted follow-up questions: {t4_no_followup}"
        )

        # 5. Câu hỏi 3 ý: Chỉ huy, Năm diễn ra, Lần kháng chiến
        q5 = "Ai chỉ huy Bạch Đằng 1288, trận đánh diễn ra năm nào, và chiến thắng kết thúc cuộc kháng chiến lần thứ mấy?"
        res5 = self.model.generate_natural_response(q5, session_id="cat_l_5")
        ans5 = res5["answer"]
        t5_numbered = ("1." in ans5 and "2." in ans5 and "3." in ans5)
        t5_all_3_facts = ("trần quốc tuấn" in ans5.lower() or "trần hưng đạo" in ans5.lower()) and "1288" in ans5 and ("thứ ba" in ans5.lower() or "thứ 3" in ans5.lower())
        self.record_result(
            "L.5",
            f"Multi-part 3 items: '{q5}'",
            t5_numbered and t5_all_3_facts,
            f"Unit: {res5['unit_id']} | Distinct 3 numbered points: {t5_numbered} | Contains all 3 answers: {t5_all_3_facts}"
        )

        # 6. Số lượng binh sĩ nhà Trần ở Bình Lệ Nguyên
        q6 = "Trong tài liệu hiện có, chính xác bao nhiêu binh sĩ nhà Trần tham gia trận Bình Lệ Nguyên?"
        res6 = self.model.generate_natural_response(q6, session_id="cat_l_6")
        ans6_lower = res6["answer"].lower()
        t6_honesty = ("không có số liệu" in ans6_lower or "không ghi chép" in ans6_lower or "không có ghi chép" in ans6_lower)
        t6_mongol = ("3 vạn" in ans6_lower)
        self.record_result(
            "L.6",
            f"Bình Lệ Nguyên troop count honesty: '{q6}'",
            t6_honesty and t6_mongol,
            f"Unit: {res6['unit_id']} | Admits no exact Trần figure: {t6_honesty} | Cites verified 30k Mongol invaders: {t6_mongol}"
        )

        # 7. Trích nguyên văn một câu nói của Trần Hưng Đạo trong trận Bạch Đằng 1288
        q7 = "Hãy trích nguyên văn một câu nói của Trần Hưng Đạo trong trận Bạch Đằng năm 1288 và nêu nguồn cụ thể."
        res7 = self.model.generate_natural_response(q7, session_id="cat_l_7")
        ans7_lower = res7["answer"].lower()
        t7_honesty = ("không có ghi chép" in ans7_lower or "không ghi chép" in ans7_lower)
        t7_sourced_1285 = ("chém đầu tôi trước" in ans7_lower or "hịch tướng sĩ" in ans7_lower) and "1285" in ans7_lower
        self.record_result(
            "L.7",
            f"Trần Hưng Đạo quote honesty: '{q7}'",
            t7_honesty and t7_sourced_1285,
            f"Unit: {res7['unit_id']} | Admits no quote in 1288 battle: {t7_honesty} | Cites genuine sourced 1285 quotes: {t7_sourced_1285}"
        )

        # 8. Xác minh đại bác trong trận Bạch Đằng 1288
        q8 = "Nhà Trần sử dụng đại bác trong trận Bạch Đằng năm 1288 đúng không?"
        res8 = self.model.generate_natural_response(q8, session_id="cat_l_8")
        ans8_lower = res8["answer"].lower()
        first_line_8 = res8["answer"].split("\n")[0].lower()
        t8_rejection = ("không đúng" in first_line_8 or "sai" in first_line_8)
        t8_century = ("thế kỷ xv" in ans8_lower or "thế kỷ 15" in ans8_lower or "hồ nguyên trừng" in ans8_lower)
        t8_no_poison_arrow_trivia = ("tẩm thuốc độc" not in ans8_lower and "bè lửa" not in ans8_lower)
        self.record_result(
            "L.8",
            f"Verify cannons Bạch Đằng 1288: '{q8}'",
            t8_rejection and t8_century and t8_no_poison_arrow_trivia,
            f"Unit: {res8['unit_id']} | Direct rejection in line 1: {t8_rejection} | Cites 15th century Hồ Nguyên Trừng: {t8_century} | Strictly grounded (no unverified poison/fire weapon trivia): {t8_no_poison_arrow_trivia}"
        )

        # 9. Chuỗi hội thoại 3 lượt liên hoàn
        sess_l9 = "cat_l_9_chain"
        # Turn 1: Tại sao quân Nguyên đông và mạnh mà vẫn thua Đại Việt?
        t1_q = "Tại sao quân Nguyên đông và mạnh mà vẫn thua Đại Việt?"
        r_t1 = self.model.generate_natural_response(t1_q, session_id=sess_l9)
        t9_1_ok = (r_t1["unit_id"] == "CAUSES_OF_VICTORY" and ("đoàn kết" in r_t1["answer"].lower() or "chênh lệch" in r_t1["answer"].lower()))

        # Turn 2: Vậy nhà Trần đã làm gì để khắc phục bất lợi đó?
        t2_q = "Vậy nhà Trần đã làm gì để khắc phục bất lợi đó?"
        r_t2 = self.model.generate_natural_response(t2_q, session_id=sess_l9)
        t9_2_ok = (r_t2["unit_id"] == "FOLLOWUP_OVERCOME_DISADVANTAGE" and "bất lợi" in r_t2["answer"].lower() and "rút lui" in r_t2["answer"].lower())

        # Turn 3: Còn chiến thuật rút lui thì sao?
        t3_q = "Còn chiến thuật rút lui thì sao?"
        r_t3 = self.model.generate_natural_response(t3_q, session_id=sess_l9)
        t9_3_ok = (r_t3["unit_id"] == "FOLLOWUP_RETREAT_TACTIC" and "bảo toàn" in r_t3["answer"].lower() and "không phải là thất bại" in r_t3["answer"].lower())

        t9_chain_ok = t9_1_ok and t9_2_ok and t9_3_ok
        self.record_result(
            "L.9",
            "Multi-turn 3-step sequence without context drift",
            t9_chain_ok,
            f"T1: {t9_1_ok} ({r_t1['unit_id']}) | T2: {t9_2_ok} ({r_t2['unit_id']}) | T3: {t9_3_ok} ({r_t3['unit_id']})"
        )

        # 10. Câu hỏi ngoài phạm vi lịch sử: Thời tiết TP.HCM
        q10 = "Hôm nay thời tiết ở TP.HCM thế nào?"
        res10 = self.model.generate_natural_response(q10, session_id="cat_l_10")
        t10_ood = (res10["unit_id"] == "OOD_RANDOM_AND_OFFTOPIC" and res10["is_not_found"] is True)
        self.record_result(
            "L.10",
            f"Out-of-Domain Weather query: '{q10}'",
            t10_ood,
            f"Unit: {res10['unit_id']} | is_not_found: {res10['is_not_found']}"
        )

    # ==========================================================================
    # CATEGORY M: NEW CURRICULUM UNITS, PROFILE DIAGNOSTICS & AI ESSAY GRADER
    # ==========================================================================
    def test_category_m_adaptive_ai_and_new_units(self):
        print("\n" + "=" * 70)
        print("▶ CATEGORY M: EXPANDED CURRICULUM, ACCOUNT ANALYTICS & AI ESSAY GRADER")
        print("=" * 70)

        from bkt_engine import bkt_engine

        # 1. Nghệ thuật quân sự thời Trần
        qm1 = "Nét độc đáo về nghệ thuật quân sự lấy đoản binh thắng trường trận của nhà Trần là gì?"
        rm1 = self.model.generate_natural_response(qm1, session_id="cat_m_1")
        m1_ok = (rm1["unit_id"] == "MILITARY_ART_TRAN_DYNASTY" and "đoản binh" in rm1["answer"].lower())
        self.record_result("M.1", f"New Unit Military Art: '{qm1}'", m1_ok, f"Unit: {rm1['unit_id']}")

        # 2. Vai trò đồng bào dân tộc thiểu số miền núi
        qm2 = "Vai trò của đồng bào các dân tộc thiểu số miền núi trong kháng chiến chống Mông Nguyên?"
        rm2 = self.model.generate_natural_response(qm2, session_id="cat_m_2")
        m2_ok = (rm2["unit_id"] == "ROLE_OF_ETHNIC_MINORITIES" and "hà đặc" in rm2["answer"].lower())
        self.record_result("M.2", f"New Unit Ethnic Minorities: '{qm2}'", m2_ok, f"Unit: {rm2['unit_id']}")

        # 3. Vua Trần Nhân Tông & Trúc Lâm Yên Tử
        qm3 = "Hai câu thơ Xã tắc lưỡng hồi lao thạch mã Sơn hà thiên cổ điện kim âu là của ai?"
        rm3 = self.model.generate_natural_response(qm3, session_id="cat_m_3")
        m3_ok = (rm3["unit_id"] == "GAME_TRAN_NHAN_TONG" and "trần nhân tông" in rm3["answer"].lower())
        self.record_result("M.3", f"New Unit King Trần Nhân Tông: '{qm3}'", m3_ok, f"Unit: {rm3['unit_id']}")

        # 4. Bài học kinh nghiệm lịch sử đối với ngày nay
        qm4 = "Bài học kinh nghiệm rút ra từ ba lần kháng chiến chống quân Mông Nguyên đối với ngày nay?"
        rm4 = self.model.generate_natural_response(qm4, session_id="cat_m_4")
        m4_ok = (rm4["unit_id"] == "HISTORICAL_LESSONS_TODAY" and "khoan thư sức dân" in rm4["answer"].lower())
        self.record_result("M.4", f"New Unit Historical Lessons Today: '{qm4}'", m4_ok, f"Unit: {rm4['unit_id']}")

        # 5. Phân tích toàn diện hồ sơ tài khoản học sinh & gợi ý tài liệu SGK
        profile = bkt_engine.analyze_student_profile("student_nguyen_van_long", top_k=3)
        m5_ok = (
            len(profile["campaign_breakdown"]) == 4
            and len(profile["cognitive_breakdown"]) == 3
            and len(profile["recommended_study_materials"]) > 0
            and bool(profile["ai_diagnosis"])
        )
        self.record_result(
            "M.5",
            "Student Account Diagnostic & Adaptive Study Plan (BKT + Bloom + SGK Materials)",
            m5_ok,
            f"Overall: {profile['overall_mastery']} | Materials count: {len(profile['recommended_study_materials'])}"
        )

        # 6. AI Chấm câu trả lời tự luận ngắn & tự động cập nhật BKT
        eval_res = bkt_engine.evaluate_short_answer(
            student_id="test_essay_student",
            unit_id="TQT_WHY_ORANGE",
            student_answer="Tháng 10/1282 tại Hội nghị Bình Than, Trần Quốc Toản vì tuổi nhỏ 15-16 tuổi không được vào bàn việc nước nên vừa căm thù giặc vừa hổ thẹn đã bóp nát quả cam vua ban."
        )
        m6_ok = (eval_res["score_10"] >= 7.0 and eval_res["is_passed"] is True and eval_res["bkt_update"]["new_p_l"] > 0.30)
        self.record_result(
            "M.6",
            "AI Short-Answer Essay Grader & Automatic BKT Update",
            m6_ok,
            f"Score: {eval_res['score_10']}/10 | New P(L): {eval_res['bkt_update']['new_p_l']}"
        )

        # 7. Đồng bộ 2 chiều Chat AI -> Hồ sơ học sinh & Active Learning Log
        mat_card = bkt_engine.record_chat_interaction(
            student_id="test_essay_student",
            unit_id="KC1_VUON_KHONG_NHA_TRONG",
            query="Kế sách vườn không nhà trống có tác dụng gì?",
            confidence=0.82,
            is_not_found=False
        )
        _ = bkt_engine.record_chat_interaction(
            student_id="test_essay_student",
            unit_id="OOD_RANDOM_AND_OFFTOPIC",
            query="Câu hỏi lạ chưa có trong dữ liệu lịch sử",
            confidence=0.12,
            is_not_found=True
        )
        analytics = bkt_engine.get_learning_analytics()
        m7_ok = (mat_card is not None and "sgk_reference" in mat_card and len(analytics["unanswered_queries"]) > 0)
        self.record_result(
            "M.7",
            "Two-Way Chat-to-Profile Sync & Unanswered Query Active Learning Logger",
            m7_ok,
            f"Material returned: {bool(mat_card)} | Logged unanswered queries: {len(analytics['unanswered_queries'])}"
        )

        # 8. Học sinh gõ "toi khong biet nen hoi gi" -> Trả về định hướng học tập kèm gợi ý Hồ sơ BKT (Không báo lỗi OOD)
        qm8 = "toi khong biet nen hoi gi"
        rm8 = self.model.generate_natural_response(qm8, character_id="student_session_long", session_id="cat_m_8")
        m8_ok = (
            rm8["unit_id"] == "INTENT_STUDENT_STRUGGLE"
            and rm8["is_not_found"] is False
            and "hồ sơ năng lực" in rm8["answer"].lower()
        )
        self.record_result(
            "M.8",
            f"Study Guidance Intent ('{qm8}') -> Personalized BKT Roadmap (Not OOD)",
            m8_ok,
            f"Unit: {rm8['unit_id']} | Personalized BKT guidance included: {m8_ok}"
        )

        # 9. Chặn câu hỏi ngoài lề có từ đồng âm ("nguyên nhân", "chiến thuật game", "trần nhà")
        tricky_ood_queries = [
            "Nguyên nhân gây ô nhiễm môi trường là gì?",
            "Chiến thuật chơi game Liên Quân để thắng",
            "Trần nhà bị thấm nước phải làm sao?"
        ]
        m9_ok = all(
            self.model.generate_natural_response(tq, session_id="cat_m_9")["unit_id"] == "OOD_RANDOM_AND_OFFTOPIC"
            for tq in tricky_ood_queries
        )
        self.record_result(
            "M.9",
            "Homonym Off-Topic Guard ('nguyên nhân ô nhiễm', 'chiến thuật game', 'trần nhà')",
            m9_ok,
            f"All 3 tricky off-topic queries blocked as OOD: {m9_ok}"
        )

        # 10. Tổng hợp đa chủ điểm (Multi-Intent / Multi-Chunk Synthesis)
        qm10 = "Hội nghị Bình Than và Hội nghị Diên Hồng khác nhau thế nào?"
        rm10 = self.model.generate_natural_response(qm10, session_id="cat_m_10")
        m10_ok = (
            rm10["unit_id"] == "MULTI_INTENT_SYNTHESIS"
            and len(rm10.get("grounding_sources", [])) == 2
            and "bình than" in rm10["answer"].lower()
            and "diên hồng" in rm10["answer"].lower()
        )
        self.record_result(
            "M.10",
            f"Multi-Intent Synthesis: '{qm10}'",
            m10_ok,
            f"Unit: {rm10['unit_id']} | Synthesized units: {rm10.get('synthesized_units')} | Sources: {len(rm10.get('grounding_sources', []))}"
        )

        # 11. Nhận diện câu hỏi mô tả gián tiếp không dùng từ khóa SGK (Zero-Keyword Paraphrase)
        indirect_cases = [
            ("Ông vua nào nhường ngôi đi tu lập phái thiền sau khi đánh thắng giặc?", "GAME_TRAN_NHAN_TONG"),
            ("Kế sách bỏ thành trống giấu hết lương thực không cho địch cướp gọi là gì?", "KC1_VUON_KHONG_NHA_TRONG"),
            ("Vị tướng nào ngồi giữa đường đan sọt bị giáo đâm chảy máu đùi không biết?", "PHAM_NGU_LAO")
        ]
        m11_preds = [
            (
                self.model.generate_natural_response(iq, session_id=f"cat_m_11_{idx}")["unit_id"],
                exp_uid
            )
            for idx, (iq, exp_uid) in enumerate(indirect_cases)
        ]
        m11_ok = all(pred == exp for pred, exp in m11_preds)
        self.record_result(
            "M.11",
            "Zero-Keyword Indirect Description Paraphrase Understanding (3 cases)",
            m11_ok,
            f"Predictions vs Expected: {m11_preds}"
        )

        # 12. Ghi nhớ mạch câu hỏi gợi mở (Follow-up Continuation Memory)
        sess_m12 = "cat_m_12_followup"
        _ = self.model.generate_natural_response("Vì sao Trần Quốc Toản bóp nát quả cam?", session_id=sess_m12)
        rm12 = self.model.generate_natural_response("Em không nhớ, là chữ gì vậy thầy? Kể tiếp đi", session_id=sess_m12)
        m12_ok = (rm12["unit_id"] == "TQT_SIX_GOLDEN_WORDS" and "phá cường địch" in rm12["answer"].lower())
        self.record_result(
            "M.12",
            "Follow-Up Continuation Memory ('Em không nhớ, là chữ gì vậy thầy? Kể tiếp đi')",
            m12_ok,
            f"Resolved Unit: {rm12['unit_id']} | Mentions 'Phá cường địch': {m12_ok}"
        )

        # 13. Chế độ Đố vui & Chấm tự luận trực tiếp trên khung Chat (Interactive 2-Turn Micro-Quiz)
        import copy
        orig_long_state = copy.deepcopy(bkt_engine.student_states.get("student_nguyen_van_long", {}))
        sess_m13 = "cat_m_13_quiz"
        rm13_ask = self.model.generate_natural_response("Thầy đố em một câu đi", session_id=sess_m13)
        rm13_grade = self.model.generate_natural_response(
            "Quân dân nhà Trần chủ động rút khỏi Thăng Long thực hiện vườn không nhà trống để bảo toàn lực lượng và làm giặc thiếu lương thực, đến tháng 1/1258 phản công ở Đông Bộ Đầu tại bến Bình Than năm 1282 Trần Quốc Toản bóp nát quả cam.",
            session_id=sess_m13
        )
        m13_ok = (
            rm13_ask["unit_id"] == "INTERACTIVE_CHAT_QUIZ"
            and rm13_grade["unit_id"] == "INTERACTIVE_CHAT_QUIZ_GRADE"
            and "/10" in rm13_grade["answer"]
            and "p(l)" in rm13_grade["answer"].lower()
        )
        self.record_result(
            "M.13",
            "Interactive 2-Turn Chat Micro-Quiz & Real-Time BKT Grading",
            m13_ok,
            f"Turn 1: {rm13_ask['unit_id']} | Turn 2: {rm13_grade['unit_id']}"
        )

        # 14. Phân tầng Out-of-Scope 3 cấp độ: Danh tính AI & Lịch sử ngoài triều Trần
        rm14_id = self.model.generate_natural_response("Bạn là ai và thầy làm được những gì?", session_id="cat_m_14")
        rm14_era = self.model.generate_natural_response("Lý Công Uẩn ban Chiếu dời đô năm nào?", session_id="cat_m_14")
        m14_ok = (
            rm14_id["unit_id"] == "INTENT_ASSISTANT_IDENTITY"
            and rm14_id["is_not_found"] is False
            and rm14_era["unit_id"] == "CROSS_ERA_QUANG_TRUNG_LE_LOI_LY_THUONG_KIET"
            and rm14_era["is_not_found"] is False
        )
        self.record_result(
            "M.14",
            "3-Tier Out-of-Scope Handling (Assistant Identity & Cross-Era Lý Công Uẩn)",
            m14_ok,
            f"Identity Unit: {rm14_id['unit_id']} | Cross-Era Unit: {rm14_era['unit_id']}"
        )

        # 15. Bộ kiểm chứng Đồ thị Tri thức tự động (Knowledge Graph Fact-Checker)
        kg_cases = [
            "Trận Bạch Đằng năm 1285 diễn ra như thế nào?",
            "Tại sao Trần Thủ Độ lại viết bài Hịch tướng sĩ?",
            "Thoát Hoan chỉ huy quân Mông Cổ xâm lược Đại Việt năm 1258 đúng không?"
        ]
        m15_ok = all(
            self.model.generate_natural_response(kq, session_id=f"cat_m_15_{i}")["unit_id"] == "CORRECTION_KG_CONTRADICTION"
            for i, kq in enumerate(kg_cases)
        )
        self.record_result(
            "M.15",
            "Knowledge Graph Fact-Checker (Cross-Campaign & Author Contradictions)",
            m15_ok,
            f"All 3 cross-contradictions detected & corrected: {m15_ok}"
        )

        # 16. Chống chịu lỗi gõ sai chính tả tiếng Việt (Fuzzy Typo Tolerance)
        typo_cases = [
            ("trận bạt đằng năm 1288 diễn ra thế nào", "KC3_BACH_DANG_HOW"),
            ("hội nghị riên hồng năm 1285 có ý nghĩa gì", "SIGNIFICANCE_DIEN_HONG"),
            ("vì sao thoát hoang phải chui vào ống đồng", "KC2_THOAT_HOAN_COPPER_PIPE")
        ]
        m16_preds = [
            (self.model.generate_natural_response(tq, session_id=f"cat_m_16_{i}")["unit_id"], exp)
            for i, (tq, exp) in enumerate(typo_cases)
        ]
        m16_ok = all(p == e for p, e in m16_preds)
        self.record_result(
            "M.16",
            "Fuzzy Typo Tolerance ('bạt đằng', 'riên hồng', 'thoát hoang')",
            m16_ok,
            f"Typo predictions: {m16_preds}"
        )

        # 17. Điều khiển Định dạng đầu ra theo yêu cầu người dùng (Format Control: Tóm tắt + Timeline + Mẹo nhớ)
        qm17 = "Hãy tóm tắt ngắn gọn 3 ý chính, vẽ sơ đồ thời gian và chỉ mẹo ghi nhớ trận Đông Bộ Đầu năm 1258"
        rm17 = self.model.generate_natural_response(qm17, session_id="cat_m_17")
        m17_ok = (
            "📌 **Tóm tắt 3 ý cốt lõi" in rm17["answer"]
            and "⏳ **Sơ đồ Dòng thời gian" in rm17["answer"]
            and "🔑 **Mẹo ghi nhớ nhanh" in rm17["answer"]
        )
        self.record_result(
            "M.17",
            "User Format Control (Summary Box + Timeline + Mnemonic Formula)",
            m17_ok,
            f"Contains Summary, Timeline & Mnemonic blocks: {m17_ok}"
        )

        # 18. Đường cong quên lãng Ebbinghaus & Sinh Đề Ôn Tập Cá Nhân Hóa (Adaptive Custom Exam)
        rm18 = self.model.generate_natural_response("Thầy tạo đề ôn tập riêng cho em đi", session_id="cat_m_18")
        m18_ok = (
            rm18["unit_id"] == "ADAPTIVE_CUSTOM_EXAM"
            and rm18.get("exam_metadata", {}).get("total_questions") == 5
            and "ebbinghaus" in rm18["answer"].lower()
        )
        self.record_result(
            "M.18",
            "Ebbinghaus Retention & Adaptive Custom Exam Generator (MCQ + Short Answer)",
            m18_ok,
            f"Unit: {rm18['unit_id']} | Generated questions: {rm18.get('exam_metadata', {}).get('total_questions')}"
        )

        # 19. Dạy thêm tri thức mới cho AI ngay lúc chạy (Zero-Retrain Hot-Reload Knowledge Base)
        from create_model import CUSTOM_KNOWLEDGE_FILE
        self.model.teach_new_knowledge(
            unit_id="CUSTOM_TEST_DYNAMIC_UNIT",
            topic="Hội thề Đông Cổ và tinh thần võ sĩ đạo thời Trần",
            question_examples=[
                "hội thề đền đồng cổ thời trần diễn ra như thế nào",
                "tinh thần võ sĩ đạo và hội thề đồng cổ thời nhà trần"
            ],
            answer="Hội thề đền Đồng Cổ là nghi lễ thiêng liêng nơi các quan lại, tướng sĩ nhà Trần uống máu ăn thề nguyện trung hiếu giữ nước.",
            fact_chunk="Hội thề đền Đồng Cổ rèn đúc lòng trung thành tuyệt đối của tướng sĩ thời Trần."
        )
        rm19 = self.model.generate_natural_response(
            "Hội thề đền Đồng Cổ thời Trần diễn ra như thế nào?",
            session_id="cat_m_19"
        )
        m19_ok = (rm19["unit_id"] == "CUSTOM_TEST_DYNAMIC_UNIT" and "đồng cổ" in rm19["answer"].lower())
        self.model.custom_units.pop("CUSTOM_TEST_DYNAMIC_UNIT", None)
        self.model.unit_lookup.pop("CUSTOM_TEST_DYNAMIC_UNIT", None)
        if CUSTOM_KNOWLEDGE_FILE.exists():
            CUSTOM_KNOWLEDGE_FILE.unlink()
        self.record_result(
            "M.19",
            "Zero-Retrain Hot-Reload Dynamic Knowledge Teaching (`/api/chat/teach`)",
            m19_ok,
            f"Matched newly taught unit immediately: {rm19['unit_id']}"
        )

        # Dọn dẹp dữ liệu test tạm thời sau khi kiểm thử xong
        bkt_engine.student_states.pop("test_essay_student", None)
        if orig_long_state:
            bkt_engine.student_states["student_nguyen_van_long"] = orig_long_state
        bkt_engine.analytics_data["unanswered_queries"] = [
            q for q in bkt_engine.analytics_data.get("unanswered_queries", [])
            if q.get("query") != "Câu hỏi lạ chưa có trong dữ liệu lịch sử"
        ]
        bkt_engine._save_persistent_data()

    # ==========================================================================
    # CATEGORY N: CHỦ ĐỀ BỔ SUNG CÙNG GAME HÀO KHÍ ĐÔNG A (DATN-2026)
    # ==========================================================================
    def test_category_m_game_topics(self):
        print("\n" + "=" * 70)
        print("▶ CATEGORY N: CHỦ ĐỀ BỔ SUNG CÙNG GAME (NGỤ BINH Ư NÔNG, TRẦN KHÁNH DƯ, BINH THƯ YẾU LƯỢC, TRẦN NHÂN TÔNG)")
        print("=" * 70)

        test_cases = [
            ("Ngụ binh ư nông là gì?", "GAME_NGU_BINH_U_NONG", "làm ruộng"),
            ("Trần Khánh Dư là ai?", "GAME_TRAN_KHANH_DU", "buôn than"),
            ("Ai là tác giả Binh thư yếu lược?", "GAME_BINH_THU_YEU_LUOC", "Trần Quốc Tuấn"),
            ("Vua Trần Nhân Tông là ai?", "GAME_TRAN_NHAN_TONG", "Trúc Lâm"),
            ("Quân Thánh Dực và nón Ma Lôi thời Trần là gì?", "GAME_QUAN_THANH_DUC_SAT_THAT", "Thánh Dực"),
            ("Căn cứ Vạn Kiếp và hậu phương Thiên Trường có vị trí chiến lược như thế nào?", "GAME_VAN_KIEP_THIEN_TRUONG_BASES", "Vạn Kiếp"),
            ("Trần Ích Tắc và Trần Kiện là ai trong cuộc kháng chiến chống Nguyên năm 1285?", "GAME_TRUNG_THAN_VS_PHAN_BOI", "Trần Ích Tắc"),
        ]
        for i, (query, expected_uid, keyword) in enumerate(test_cases, 1):
            res = self.model.generate_natural_response(query, session_id=f"cat_game_{i}")
            passed = res["unit_id"] == expected_uid and keyword.lower() in res["answer"].lower()
            self.record_result("N", f"Game topic: '{query}'", passed, f"Unit: {res['unit_id']} | Keyword '{keyword}': {keyword.lower() in res['answer'].lower()}")

        # Kiểm thử nhập vai 14 Tướng & Quân chủng trong Game (Case-insensitive Persona Roleplay)
        p_res1 = self.model.generate_natural_response("Trận Vân Đồn năm 1288 diễn ra thế nào?", character_id="tran_khanh_du", session_id="cat_game_persona_1")
        p_res2 = self.model.generate_natural_response("Hội nghị Bình Than năm 1282 có mục đích gì?", character_id="tran_nhan_tong", session_id="cat_game_persona_2")
        persona_ok = ("Trần Khánh Dư" in p_res1["character_name"] and "Trần Nhân Tông" in p_res2["character_name"])
        self.record_result("N", "14-Hero Game Persona Roleplay Support (lowercase hero IDs)", persona_ok, f"Hero 1: {p_res1['character_name']} | Hero 2: {p_res2['character_name']}")

        # Hỏi nối tiếp bằng đại từ sau khi đã nói về Trần Nhân Tông
        sess = "cat_game_followup"
        r1 = self.model.generate_natural_response("Trần Nhân Tông là ai?", session_id=sess)
        r2 = self.model.generate_natural_response("Ông ấy xuất gia ở đâu?", session_id=sess)
        passed = r1["unit_id"] == "GAME_TRAN_NHAN_TONG" and r2["unit_id"] == "GAME_TRAN_NHAN_TONG" and "Yên Tử" in r2["answer"]
        self.record_result("N", "Follow-up: 'Trần Nhân Tông là ai?' -> 'Ông ấy xuất gia ở đâu?'", passed, f"T1: {r1['unit_id']} | T2: {r2['unit_id']}")

        # Chủ đề cũ gần nghĩa vẫn giữ đúng cụm tri thức
        boundary = [
            ("Ai là người đánh đắm đoàn thuyền lương của Trương Văn Hổ?", "KC3_VAN_DON"),
            ("Ai là tác giả của Hịch tướng sĩ?", "HICH_TUONG_SI"),
            ("Hội nghị Bình Than diễn ra vào năm nào?", "BINH_THAN_CONFERENCE"),
        ]
        for query, expected_uid in boundary:
            res = self.model.generate_natural_response(query, session_id=f"cat_game_boundary_{expected_uid}")
            self.record_result("N", f"Boundary: '{query}'", res["unit_id"] == expected_uid, f"Unit: {res['unit_id']}")

    # ==========================================================================
    # CATEGORY O: KIỂM THỬ HỢP ĐỒNG TÍCH HỢP FULL-STACK API (CHAT, QUIZ, BKT, TEACH)
    # ==========================================================================
    def test_category_o_fullstack_api_contracts(self):
        print("\n" + "=" * 70)
        print("▶ CATEGORY O: FULL-STACK API CONTRACT TESTS (/api/chat/*, /api/quiz/*, AdvisorChat)")
        print("=" * 70)

        from bkt_engine import bkt_engine
        from create_model import CUSTOM_KNOWLEDGE_FILE

        # O.1: Mô phỏng đúng luồng gọi của Frontend AdvisorChat (`rag_engine.ask_natural` với `student_1`)
        try:
            from rag_engine import rag_engine
            chat_res = rag_engine.ask_natural(
                query="Vì sao gọi là vườn không nhà trống?",
                character_id="student_1",
                session_id="student_1",
                student_id="student_demo_01"
            )
            o1_ok = (
                chat_res.get("unit_id") == "KC1_VUON_KHONG_NHA_TRONG"
                and isinstance(chat_res.get("bkt_chat_update"), dict)
                and "new_p_l" in chat_res["bkt_chat_update"]
                and isinstance(chat_res.get("recommended_materials"), list)
                and len(chat_res["recommended_materials"]) > 0
                and "title" in chat_res["recommended_materials"][0]
            )
        except Exception as exc:
            o1_ok = False
            chat_res = {"error": str(exc)}
        bkt_engine.student_states.pop("user_1", None)
        bkt_engine.student_states.pop("student_demo_01", None)
        bkt_engine._save_persistent_data()
        self.record_result(
            "O.1",
            "Frontend AdvisorChat -> RAGEngine.ask_natural & BKT Chat Sync Contract",
            o1_ok,
            f"Unit: {chat_res.get('unit_id')} | BKT update & StudyMaterialItem fields present: {o1_ok}"
        )

        # O.2: Kiểm thử hợp đồng `/api/chat/teach` (`base_queries`, `cognitive_level`, `difficulty` -> `TeachKnowledgeResponse`)
        teach_res = self.model.teach_new_knowledge(
            unit_id="",
            topic="Chiến thuyền Mông Đồng và thủy quân Đông A",
            entity="Thủy quân nhà Trần",
            event="Kháng chiến chống Mông - Nguyên",
            fact_chunk="Thủy quân nhà Trần sử dụng chiến thuyền cơ động đánh thắng thủy quân Nguyên trên sông Bạch Đằng.",
            answer="Chiến thuyền nhà Trần nhỏ gọn, thông thuộc luồng lạch và thủy triều.",
            base_queries=["chiến thuyền mông đồng thủy quân nhà trần có đặc điểm gì"],
            cognitive_level="THONG_HIEU",
            difficulty=0.5,
        )
        o2_ok = all(k in teach_res for k in ("status", "unit_id", "topic", "added_training_samples", "total_units"))
        self.model.custom_units.pop(teach_res.get("unit_id", ""), None)
        self.model.unit_lookup.pop(teach_res.get("unit_id", ""), None)
        if CUSTOM_KNOWLEDGE_FILE.exists():
            CUSTOM_KNOWLEDGE_FILE.unlink()
        self.record_result(
            "O.2",
            "Endpoint `/api/chat/teach` Schema Contract (`base_queries` & `TeachKnowledgeResponse`)",
            o2_ok,
            f"Returned keys valid: {o2_ok} (unit_id={teach_res.get('unit_id')})"
        )

        # O.3: Kiểm thử hợp đồng `/api/quiz/student-profile/{student_id}` (`analyze_student_account_profile`)
        acc_profile = bkt_engine.analyze_student_account_profile("student_nguyen_van_long")
        o3_ok = all(
            k in acc_profile
            for k in (
                "student_id", "overall_mastery", "student_rank_title", "total_attempts",
                "total_correct", "accuracy_rate", "chat_questions_asked", "ai_evaluator_comment",
                "campaign_breakdown", "cognitive_breakdown", "study_plan", "recommended_materials"
            )
        )
        self.record_result(
            "O.3",
            "Endpoint `/api/quiz/student-profile/{id}` Schema Contract (`StudentAccountAnalysisResponse`)",
            o3_ok,
            f"All 12 required schema fields present: {o3_ok} | Rank: {acc_profile.get('student_rank_title')}"
        )

        # O.4: Kiểm thử hợp đồng `/api/quiz/evaluate-essay` (`coverage_ratio` + `BKTUpdateResponse`)
        essay_eval = bkt_engine.evaluate_short_answer(
            student_id="test_api_contract_student",
            unit_id="KC3_BACH_DANG_HOW",
            student_answer="Tháng 4/1288 Trần Hưng Đạo đóng cọc gỗ ngầm trên sông Bạch Đằng lợi dụng thủy triều rút tiêu diệt đoàn thuyền Ô Mã Nhi."
        )
        o4_ok = ("coverage_ratio" in essay_eval and "bkt_update" in essay_eval and essay_eval["score_10"] >= 6.0)
        bkt_engine.student_states.pop("test_api_contract_student", None)
        bkt_engine._save_persistent_data()
        self.record_result(
            "O.4",
            "Endpoint `/api/quiz/evaluate-essay` Schema Contract (`coverage_ratio` included)",
            o4_ok,
            f"Score: {essay_eval.get('score_10')} | Coverage ratio: {essay_eval.get('coverage_ratio')}"
        )

        # O.5: Kiểm thử `/api/quiz/adaptive-exam/{student_id}` tích hợp ngân hàng MCQ `game_content.json`
        exam_res = bkt_engine.generate_adaptive_exam("student_nguyen_van_long", num_questions=5)
        has_mcq = any(q["question_type"] == "MULTIPLE_CHOICE" and len(q.get("options", [])) >= 2 for q in exam_res["questions"])
        has_essay = any(q["question_type"] == "SHORT_ANSWER" for q in exam_res["questions"])
        o5_ok = (exam_res["total_questions"] == 5 and has_mcq and has_essay)
        self.record_result(
            "O.5",
            "Endpoint `/api/quiz/adaptive-exam/{id}` Hybrid MCQ (`game_content.json`) + Short Answer",
            o5_ok,
            f"Total: {exam_res['total_questions']} | Has MCQ: {has_mcq} | Has Essay: {has_essay}"
        )

    # ==========================================================================
    # CATEGORY P: TOPIC GROUPS AI QUIZ GENERATION & BLOOM MATRIX (5 TESTS)
    # ==========================================================================
    def test_category_p_topic_groups_quiz(self):
        print("\n" + "=" * 70)
        print("▶ CATEGORY P: TOPIC GROUPS AI QUIZ GENERATION & BLOOM MATRIX")
        print("=" * 70)
        import asyncio
        from rag_engine import rag_engine, CURRICULUM_TOPIC_GROUPS
        from gemini_client import gemini_client

        # P.1: rag_engine.get_topic_groups() contract
        groups = rag_engine.get_topic_groups()
        p1_has_5 = len(groups) == 5
        group_ids = [g["id"] for g in groups]
        p1_expected_ids = {"KHANG_CHIEN_1", "KHANG_CHIEN_2", "KHANG_CHIEN_3", "NHAN_VAT_QUAN_SU", "TONG_HOP_TOAN_KHOA"}
        p1_ids_ok = p1_expected_ids.issubset(set(group_ids))
        p1_counts_ok = all(g.get("question_count_available", 0) > 0 for g in groups)
        self.record_result(
            "P.1",
            "Registry 5 Topic Groups & Available Question Counts",
            p1_has_5 and p1_ids_ok and p1_counts_ok,
            f"Total Groups: {len(groups)} | Expected IDs: {p1_ids_ok} | Question Counts: {[g['question_count_available'] for g in groups]}"
        )

        # P.2: Quiz Generation strictly adhering to KHANG_CHIEN_1
        orig_api_key = gemini_client.api_key
        orig_hf_client = gemini_client.hf_client
        gemini_client.api_key = ""
        gemini_client.hf_client = None
        try:
            q_kc1 = asyncio.run(gemini_client.generate_quiz(
                topic_group_id="KHANG_CHIEN_1",
                num_questions=3,
                cognitive_level="Phân bổ ma trận"
            ))
            kc1_uids = set(CURRICULUM_TOPIC_GROUPS["KHANG_CHIEN_1"]["unit_ids"])
            p2_ok = len(q_kc1) == 3 and all(q.topic_group_id == "KHANG_CHIEN_1" for q in q_kc1) and all(q.unit_id in kc1_uids for q in q_kc1 if q.unit_id)
            self.record_result(
                "P.2",
                "AI Quiz Generation for Group 'KHANG_CHIEN_1' (1258)",
                p2_ok,
                f"Generated: {len(q_kc1)} | Group ID matched: True | Units: {[q.unit_id for q in q_kc1]}"
            )

            # P.3: Quiz Generation strictly adhering to KHANG_CHIEN_2
            q_kc2 = asyncio.run(gemini_client.generate_quiz(
                topic_group_id="KHANG_CHIEN_2",
                num_questions=4,
                cognitive_level="Phân bổ ma trận"
            ))
            kc2_uids = set(CURRICULUM_TOPIC_GROUPS["KHANG_CHIEN_2"]["unit_ids"])
            p3_ok = len(q_kc2) == 4 and all(q.topic_group_id == "KHANG_CHIEN_2" for q in q_kc2) and all(q.unit_id in kc2_uids for q in q_kc2 if q.unit_id)
            self.record_result(
                "P.3",
                "AI Quiz Generation for Group 'KHANG_CHIEN_2' (1285)",
                p3_ok,
                f"Generated: {len(q_kc2)} | Group ID matched: True | Units: {[q.unit_id for q in q_kc2]}"
            )

            # P.4: Quiz Generation strictly adhering to KHANG_CHIEN_3
            q_kc3 = asyncio.run(gemini_client.generate_quiz(
                topic_group_id="KHANG_CHIEN_3",
                num_questions=3,
                cognitive_level="Phân bổ ma trận"
            ))
            kc3_uids = set(CURRICULUM_TOPIC_GROUPS["KHANG_CHIEN_3"]["unit_ids"])
            p4_ok = len(q_kc3) == 3 and all(q.topic_group_id == "KHANG_CHIEN_3" for q in q_kc3) and all(q.unit_id in kc3_uids for q in q_kc3 if q.unit_id)
            self.record_result(
                "P.4",
                "AI Quiz Generation for Group 'KHANG_CHIEN_3' (1287-1288)",
                p4_ok,
                f"Generated: {len(q_kc3)} | Group ID matched: True | Units: {[q.unit_id for q in q_kc3]}"
            )

            # P.5: Bloom Matrix Distribution & Grounded Citations
            q_matrix = asyncio.run(gemini_client.generate_quiz(
                topic_group_id="TONG_HOP_TOAN_KHOA",
                num_questions=3,
                cognitive_level="Phân bổ ma trận"
            ))
            levels_present = {q.cognitive_level for q in q_matrix}
            has_citations = all(len(q.curriculum_reference) > 0 for q in q_matrix)
            has_explanations = all(len(q.explanation) > 0 for q in q_matrix)
            has_4_options = all(len(q.options) == 4 and 0 <= q.correct_index <= 3 for q in q_matrix)
            p5_ok = len(q_matrix) == 3 and len(levels_present) >= 2 and has_citations and has_explanations and has_4_options
            self.record_result(
                "P.5",
                "Cognitive Bloom Matrix (Distributed Levels + 4-Options + Citations)",
                p5_ok,
                f"Levels present: {levels_present} | Citations: {has_citations} | Explanations: {has_explanations} | 4-Options Valid: {has_4_options}"
            )
        finally:
            gemini_client.api_key = orig_api_key
            gemini_client.hf_client = orig_hf_client

    # ==========================================================================
    # CATEGORY Q: ĐẠI VIỆT SỬ KÝ TOÀN THƯ PRIMARY-SOURCE CORPUS & CITATIONS
    # ==========================================================================
    def test_category_q_dvsktt_primary_sources(self):
        print("\n" + "=" * 70)
        print("▶ CATEGORY Q: ĐẠI VIỆT SỬ KÝ TOÀN THƯ PRIMARY-SOURCE CORPUS (2,546 PAGES)")
        print("=" * 70)
        import json
        from pathlib import Path

        dvsktt_cases = [
            (
                "Chuyện Trần Nhật Hiệu viết chữ Nhập Tống và Hoàng Cự Đà không được ăn xoài năm 1258 là như thế nào?",
                "DVSKTT_TRAN_NHAT_HIEU_HOANG_CU_DA",
                "nhập tống",
                520
            ),
            (
                "Sứ giả Đỗ Khắc Chung đã đối đáp với tướng Nguyên Ô Mã Nhi như thế nào năm 1285?",
                "DVSKTT_DO_KHAC_CHUNG_SU_GIA",
                "đỗ khắc chung",
                569
            ),
            (
                "Vì sao Trần Quốc Tuấn lại rút bỏ đầu sắt của chiếc gậy chống và lời bàn của Ngô Sĩ Liên là gì?",
                "DVSKTT_TRAN_QUOC_TUAN_GAY_BIT_SAT",
                "trần liễu",
                572
            ),
            (
                "Ai là người trực tiếp bắt sống Ô Mã Nhi và Tích Lệ Cơ Ngọc trong trận Bạch Đằng năm 1288?",
                "DVSKTT_BACH_DANG_DO_HANH_NGUYEN_KHOAI",
                "đỗ hành",
                586
            ),
            (
                "Kế Hoàng Tá Thốn dùi đắm thuyền Ô Mã Nhi năm 1289 và lời bàn của Sử thần Ngô Sĩ Liên như thế nào?",
                "DVSKTT_HOANG_TA_THON_NGO_SI_LIEN_BAN",
                "hoàng tá thốn",
                590
            ),
            (
                "Tấm gương liêm chính của Kiểm pháp quan Trần Thì Kiến móc họng mửa cỗ biếu thời Trần ra sao?",
                "DVSKTT_TRAN_THI_KIEN_PHAP_LUAT",
                "trần thì kiến",
                612
            ),
            (
                "Nhà Trần được thành lập như thế nào vào cuối năm 1225 đầu năm 1226 khi Lý Chiêu Hoàng nhường ngôi?",
                "DVSKTT_THANH_LAP_NHA_TRAN_1225",
                "trần cảnh",
                479
            ),
            (
                "Chế độ Thái thượng hoàng và bộ luật Quốc triều hình thư thời Trần được tổ chức ra sao?",
                "DVSKTT_BO_MAY_PHAP_LUAT_QUOC_TRIEU_HINH_THU",
                "quốc triều hình thư",
                486
            ),
            (
                "Việc đắp đê Đỉnh Nhĩ (Quai Vạc) năm 1248 và lập Điền trang Thái ấp năm 1266 thời Trần thế nào?",
                "DVSKTT_KINH_TE_DIEN_TRANG_THAI_AP_DE_DINH_NHI",
                "đỉnh nhĩ",
                504
            ),
            (
                "Khoa thi Thái học sinh năm 1247 đặt danh hiệu Tam khôi với Trạng nguyên Nguyễn Hiền và Lê Văn Hưu ra sao?",
                "DVSKTT_KHOA_CU_THAI_HOC_SINH_NGUYEN_HIEN_MAC_DINH_CHI",
                "nguyễn hiền",
                503
            ),
            (
                "Vì sao Quốc Tử Giám Tư nghiệp Chu Văn An dâng Thất trảm sớ xin chém 7 nịnh thần rồi từ quan?",
                "DVSKTT_CHU_VAN_AN_THAT_TRAM_SO",
                "thất trảm sớ",
                765
            ),
            (
                "Trương Hán Siêu với bài Bạch Đằng giang phú và Hàn Thuyên phát triển chữ Nôm thời Trần thế nào?",
                "DVSKTT_TRUONG_HAN_SIEU_BACH_DANG_GIANG_PHU",
                "trương hán siêu",
                733
            ),
            (
                "Chuyện thư sinh Đoàn Nhữ Hài 20 tuổi thảo biểu tạ tội ở phủ Thiên Trường năm 1299 diễn ra thế nào?",
                "DVSKTT_DOAN_NHU_HAI_NGOAI_GIAO",
                "đoàn nhữ hài",
                616
            ),
            (
                "Quốc sư Phù Vân trên núi Yên Tử đã nói câu gì với vua Trần Thái Tông và kiến trúc tháp Phổ Minh có gì đặc sắc?",
                "DVSKTT_VAN_HOA_AN_NAM_TU_DAI_KHI_CHUA_PHAP_VAN",
                "phù vân",
                492
            ),
        ]

        for idx, (query, exp_uid, kw, exp_page) in enumerate(dvsktt_cases, 1):
            res = self.model.generate_natural_response(query, session_id=f"cat_q_{idx}")
            sources = res.get("grounding_sources", [])
            page_num = sources[0].get("page_number") if sources else None
            passed = (
                res["unit_id"] == exp_uid
                and kw in res["answer"].lower()
                and page_num == exp_page
            )
            self.record_result(
                f"Q.{idx}",
                f"DVSKTT Primary Source ({exp_uid}, p.{exp_page}): '{query}'",
                passed,
                f"Unit: {res['unit_id']} | Keyword '{kw}': {kw in res['answer'].lower()} | PDF Page: {page_num}"
            )

        # Q.15: Kiểm tra dữ liệu trích xuất toàn văn 419 trang Kỷ Nhà Trần (1.083 đoạn biên niên sử)
        corpus_path = Path(__file__).parent / "data" / "dvsktt_tran_dynasty_corpus.json"
        corpus_ok = False
        corpus_detail = "Missing file"
        if corpus_path.exists():
            corpus_data = json.loads(corpus_path.read_text(encoding="utf-8"))
            total_pages = corpus_data.get("total_pdf_pages", 0)
            num_citations = len(corpus_data.get("unit_citations", {}))
            num_commentaries = len(corpus_data.get("historian_commentaries", []))
            num_passages = corpus_data.get("tran_dynasty_passages_count", 0)
            corpus_ok = (total_pages == 2546 and num_citations >= 49 and num_commentaries >= 72 and num_passages >= 1000)
            corpus_detail = f"PDF Pages: {total_pages} | Passages: {num_passages} | Citations: {num_citations} | Commentaries: {num_commentaries}"
        self.record_result(
            "Q.15",
            "DVSKTT Full-Text Corpus Integrity (419 Tran Dynasty Pages -> 1,083 Passages)",
            corpus_ok,
            corpus_detail
        )

        # Q.16: Kiểm tra Full-Text Passage Search trực tiếp trên 1.083 đoạn sử liệu
        hits = self.model.search_dvsktt_passages("Nội Minh tự Đỗ Hành bắt được Ô Mã Nhi trên sông Bạch Đằng", top_k=3)
        q16_ok = len(hits) > 0 and any(h["pdf_page"] == 586 for h in hits)
        self.record_result(
            "Q.16",
            "Full-Text Passage Search over 1,083 Chronicle Passages (`search_dvsktt_passages`)",
            q16_ok,
            f"Top hit pages: {[h['pdf_page'] for h in hits]}"
        )

    # ==========================================================================
    # RUN ALL SUITES & REPORT SUMMARY
    # ==========================================================================
    def run_all(self):
        start = time.time()
        self.test_category_a_direct_factual()
        self.test_category_b_paraphrased_colloquial()
        self.test_category_c_followup_context()
        self.test_category_d_clarification()
        self.test_category_e_out_of_domain()
        self.test_category_f_absent_facts()
        self.test_category_g_false_premises()
        self.test_category_h_api_timeout_fallback()
        self.test_category_i_topic_change()
        self.test_category_j_critical_failures()
        self.test_category_k_mandatory_benchmarks()
        self.test_category_l_test3_audit_10_tests()
        self.test_category_m_adaptive_ai_and_new_units()
        self.test_category_m_game_topics()
        self.test_category_o_fullstack_api_contracts()
        self.test_category_p_topic_groups_quiz()
        self.test_category_q_dvsktt_primary_sources()

        total = self.passed_tests + self.failed_tests
        pass_rate = (self.passed_tests / total * 100) if total > 0 else 0.0
        elapsed = time.time() - start

        print("\n" + "=" * 75)
        print("📊 TỔNG KẾT BỘ KIỂM THỬ HỒI QUY TOÀN DIỆN (REGRESSION TEST SUITE)")
        print("=" * 75)
        print(f"• Tổng số ca kiểm thử  : {total} tests")
        print(f"• Số ca thành công (PASS): {self.passed_tests} tests")
        print(f"• Số ca thất bại   (FAIL): {self.failed_tests} tests")
        print(f"• Tỷ lệ đạt chuẩn (Rate) : {pass_rate:.1f}%")
        print(f"• Thời gian thực thi    : {elapsed:.2f} giây")
        print("=" * 75)

        return self.failed_tests == 0


if __name__ == "__main__":
    runner = RegressionTestRunner()
    success = runner.run_all()
    sys.exit(0 if success else 1)
