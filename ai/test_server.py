"""Kiểm thử API của dịch vụ AI (chạy trong thư mục ai/: python -m unittest test_server -v).

Không gọi Gemini/Hugging Face: khóa để trống nên dùng mô hình NLP cục bộ và câu hỏi dự phòng.
"""
import os
import unittest
from unittest.mock import patch

os.environ["GEMINI_API_KEY"] = ""
os.environ["HF_TOKEN"] = ""
os.environ["AI_SERVICE_TOKEN"] = ""

from fastapi.testclient import TestClient  # noqa: E402

from config import settings  # noqa: E402
from server import app  # noqa: E402

client = TestClient(app)


class AiServiceTests(unittest.TestCase):
    def test_health(self):
        r = client.get("/health")
        self.assertEqual(r.status_code, 200)
        self.assertGreaterEqual(r.json()["units"], 36)

    def test_chat_answers_from_knowledge_base(self):
        r = client.post("/chat", json={"query": "Trần Khánh Dư là ai?", "session_id": "test-1"})
        self.assertEqual(r.status_code, 200, r.text)
        body = r.json()
        self.assertIn("buôn than", body["answer"])
        self.assertTrue(body["grounding_sources"])

    def test_chat_rejects_out_of_domain(self):
        r = client.post("/chat", json={"query": "Công thức tính diện tích hình tròn?", "session_id": "test-2"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["grounding_sources"], [])

    def test_bkt_update_is_stateless(self):
        first = client.post("/bkt/update", json={"state": {}, "unit_id": "KC1_OVERVIEW", "is_correct": True}).json()
        self.assertEqual(first["attempts"], 1)
        self.assertGreater(first["new_p_l"], first["old_p_l"])
        self.assertEqual(first["state"]["KC1_OVERVIEW"]["correct_count"], 1)
        second = client.post("/bkt/update", json={"state": first["state"], "unit_id": "KC1_OVERVIEW", "is_correct": False}).json()
        self.assertEqual(second["attempts"], 2)
        self.assertLess(second["new_p_l"], first["new_p_l"])
        # Dịch vụ không giữ trạng thái: gửi lại trạng thái rỗng thì bắt đầu từ đầu
        again = client.post("/bkt/update", json={"state": {}, "unit_id": "KC1_OVERVIEW", "is_correct": True}).json()
        self.assertEqual(again["attempts"], 1)

    def test_bkt_recommend(self):
        state = {"KC3_VAN_DON": {"p_l": 0.12, "last_updated_time": 0, "attempts": 3, "correct_count": 0}}
        recs = client.post("/bkt/recommend", json={"state": state, "top_k": 3}).json()["recommendations"]
        self.assertLessEqual(len(recs), 3)
        self.assertTrue(all("unit_id" in r and "topic" in r for r in recs))

    def test_quiz_generate_falls_back_without_llm(self):
        r = client.post("/quiz/generate", json={"topic": "Trận Bạch Đằng 1288", "num_questions": 2})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertGreater(r.json()["total_generated"], 0)

    def test_game_questions_skip_fixed_fallback(self):
        r = client.post("/questions/generate", json={"unit_id": "KC3_VAN_DON", "topic": "Trận Vân Đồn", "count": 2})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["questions"], [])

    def test_internal_token(self):
        with patch.object(settings, "AI_SERVICE_TOKEN", "bi-mat"):
            self.assertEqual(client.post("/bkt/recommend", json={"state": {}}).status_code, 401)
            ok = client.post("/bkt/recommend", json={"state": {}}, headers={"X-AI-Token": "bi-mat"})
            self.assertEqual(ok.status_code, 200)
            self.assertEqual(client.get("/health").status_code, 200)


if __name__ == "__main__":
    unittest.main()
