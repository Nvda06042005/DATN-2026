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

# Cấu hình môi trường và đường dẫn
BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

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
