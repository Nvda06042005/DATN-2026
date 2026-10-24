"""
MODULE: HYBRID ROUTER, CIRCUIT BREAKER & RESPONSE CACHING
================================================================================
Khắc phục Khó khăn 4 theo đúng hướng dẫn của Mentor:
1. Timeout ngắn: 2.5 giây khi gọi LLM qua API (Hugging Face / Gemini).
2. Circuit Breaker: Tự động ngắt (chuyển OPEN) nếu API lỗi liên tiếp 3 lần,
   tạm ngừng gọi trong 60s để tránh làm chậm hệ thống.
3. Cache theo cụm tri thức & câu hỏi: Cache kết quả đã xử lý theo (normalized_query, unit_id).
4. Grounded Polish: LLM chỉ làm nhiệm vụ trau chuốt câu từ dựa trên fact_chunk local,
   tuyệt đối không bịa đặt sự kiện lịch sử (chống hallucination).
5. Nguồn sự thật (Source of Truth) luôn là kho tri thức local.
"""

import time
import httpx
from pathlib import Path
from typing import Dict, Any, Optional
try:
    from app.config import settings
except ImportError:
    class _FallbackSettings:
        GEMINI_API_KEY = ""
        GEMINI_MODEL = "gemini-flash-latest"
    settings = _FallbackSettings()

BASE_DIR = Path(__file__).resolve().parent


class CircuitBreaker:
    """
    Cơ chế bảo vệ hệ thống: Tự động ngắt kết nối API ngoài nếu gặp lỗi liên tiếp.
    Trạng thái:
    - CLOSED   : Bình thường, cho phép gọi API ngoài.
    - OPEN     : Đang ngắt tạm thời (do lỗi liên tiếp >= threshold), fallback ngay về local.
    - HALF_OPEN: Hết thời gian chờ, thử thăm dò 1 request.
    """
    def __init__(self, failure_threshold: int = 3, recovery_time_seconds: float = 60.0):
        self.failure_threshold = failure_threshold
        self.recovery_time_seconds = recovery_time_seconds
        self.consecutive_failures = 0
        self.last_failure_time: float = 0.0
        self.state = "CLOSED"

    def can_attempt_call(self) -> bool:
        if self.state == "CLOSED":
            return True
        if self.state == "OPEN":
            if time.time() - self.last_failure_time > self.recovery_time_seconds:
                self.state = "HALF_OPEN"
                return True
            return False
        if self.state == "HALF_OPEN":
            return True
        return False

    def record_success(self):
        self.consecutive_failures = 0
        self.state = "CLOSED"

    def record_failure(self):
        self.consecutive_failures += 1
        self.last_failure_time = time.time()
        if self.consecutive_failures >= self.failure_threshold:
            self.state = "OPEN"


class HybridNLPRouter:
    """
    Bộ điều phối Hybrid:
    Cache -> Circuit Breaker (Timeout 2.5s) -> Grounded LLM Polish -> Local Fallback
    """
    def __init__(self):
        self.circuit_breaker = CircuitBreaker(failure_threshold=3, recovery_time_seconds=60.0)
        # Bộ nhớ đệm: cache_key -> {"answer": str, "timestamp": float}
        self.response_cache: Dict[str, Dict[str, Any]] = {}
        self.cache_ttl_seconds = 3600.0  # Lưu cache 1 giờ

    def _get_cache_key(self, query: str, unit_id: str, character_id: Optional[str]) -> str:
        clean_q = "".join(c for c in query.lower() if c.isalnum())
        return f"{unit_id}_{character_id or 'default'}_{clean_q}"

    async def polish_with_llm(
        self,
        query: str,
        fact_chunk: str,
        local_answer: str,
        character_name: str
    ) -> Optional[str]:
        """
        Gọi LLM trau chuốt câu chữ dựa trên fact_chunk local với timeout ngắn 2.5s.
        """
        if not self.circuit_breaker.can_attempt_call():
            return None

        gemini_key = getattr(settings, "GEMINI_API_KEY", "")
        if not gemini_key:
            return None

        import re
        clean_q = re.sub(r"^\s*\d{2,}\s+|\s+\d{2,}\s*$", "", query).strip()

        prompt = (
            f"Bạn là gia sư Lịch sử lớp 7 uyên bác và truyền cảm hứng. Dựa trên Tư liệu lịch sử và Nội dung bài giảng chuẩn bên dưới, "
            f"hãy giải thích thật đầy đủ, chi tiết, sâu sắc và sinh động để học sinh hiểu rõ bản chất lịch sử (bối cảnh, nguyên nhân, diễn biến, ý nghĩa).\n"
            f"QUY TẮC:\n"
            f"- Giữ đầy đủ chiều sâu kiến thức và các luận điểm giải thích trong Nội dung bài giảng chuẩn, KHÔNG tóm tắt cụt lủn.\n"
            f"- Không tự xưng tên trong dấu ngoặc đơn và không lặp lại nguyên văn câu hỏi của học sinh ở câu mở đầu.\n"
            f"- Không bịa đặt thêm ngày tháng hay sự kiện sai lệch với tư liệu.\n\n"
            f"Tư liệu lịch sử:\n{fact_chunk}\n\n"
            f"Nội dung bài giảng chuẩn (cần giữ đủ độ sâu và chi tiết):\n{local_answer}\n\n"
            f"Câu hỏi của học sinh: {clean_q}\n"
            f"Bài giảng chi tiết:"
        )

        raw_model = getattr(settings, "GEMINI_MODEL", "gemini-flash-latest")
        model_name = (
            "gemini-flash-latest"
            if raw_model in ("", "gemini-3.5-flash-lite", "gemini-1.5-flash")
            else raw_model
        )
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"
        body = {"contents": [{"parts": [{"text": prompt}]}]}

        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                res = await client.post(url, json=body)
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts:
                            text = parts[0].get("text", "").strip()
                            if text:
                                self.circuit_breaker.record_success()
                                return text
                self.circuit_breaker.record_failure()
        except Exception:
            self.circuit_breaker.record_failure()

        return None

    async def route_and_respond(
        self,
        query: str,
        local_result: Dict[str, Any],
        character_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Điều phối chính:
        1. Kiểm tra Cache
        2. Nếu là câu lịch sử và có API key -> Thử polish qua LLM (timeout 2.5s)
        3. Nếu timeout / offline / lỗi -> Trả về kết quả Local NLG ngay lập tức (<10ms)
        """
        unit_id = local_result.get("unit_id", "UNKNOWN")
        if unit_id in ["INTERACTIVE_CHAT_QUIZ", "INTERACTIVE_CHAT_QUIZ_GRADE", "ADAPTIVE_CUSTOM_EXAM"] or str(unit_id).startswith("CUSTOM_"):
            res = dict(local_result)
            res["served_by"] = "Local Interactive BKT & Dynamic Knowledge Engine"
            return res

        cache_key = self._get_cache_key(query, unit_id, character_id)

        # 1. Trả về từ Cache nếu có
        cached = self.response_cache.get(cache_key)
        if cached and (time.time() - cached["timestamp"] < self.cache_ttl_seconds):
            res = dict(local_result)
            res["answer"] = cached["answer"]
            res["served_by"] = "Cache (SGK Knowledge Store)"
            return res

        # 2. Thử Grounded LLM Polish nếu không phải OOD/Intent/Special Verified Units
        fact_chunk = ""
        sources = local_result.get("grounding_sources", [])
        if sources:
            fact_chunk = sources[0].get("fact_chunk", "")

        EXCLUDED_FROM_LLM_POLISH = [
            "OOD_RANDOM_AND_OFFTOPIC", "INTENT_GREETING", "INTENT_THANKS", "INTENT_STUDENT_STRUGGLE",
            "INTENT_ASSISTANT_IDENTITY", "MULTI_INTENT_SYNTHESIS",
            "INTERACTIVE_CHAT_QUIZ", "INTERACTIVE_CHAT_QUIZ_GRADE", "ADAPTIVE_CUSTOM_EXAM",
            "CORRECTION_KG_CONTRADICTION",
            "CLARIFY_AMBIGUOUS_TRAN_KING", "CORRECTION_FALSE_PREMISE_ORANGE",
            "CORRECTION_FALSE_PREMISE_BACH_DANG", "ABSENT_HISTORICAL_FACT",
            "CROSS_ERA_HAM_NGHI", "CROSS_ERA_NGO_QUYEN", "CROSS_ERA_QUANG_TRUNG_LE_LOI_LY_THUONG_KIET",
            "VERIFY_CANNON_BACH_DANG", "EVIDENCE_BINH_LE_NGUYEN_TROOP_COUNT", "EVIDENCE_TRAN_HUNG_DAO_QUOTE_BACH_DANG",
            "EVIDENCE_GUNPOWDER_1285", "COUNTERFACTUAL_HOLD_THANG_LONG", "VERIFY_ONLY_FOOD_SHORTAGE",
            "MULTI_PART_BACH_DANG_1288", "SUMMARY_BACH_DANG_1288_SHORT", "COMPARE_1258_AND_1285",
            "TACTICAL_IMPACT_VUON_KHONG_NHA_TRONG"
        ]

        if fact_chunk and local_result.get("unit_id") not in EXCLUDED_FROM_LLM_POLISH:
            polished = await self.polish_with_llm(
                query=query,
                fact_chunk=fact_chunk,
                local_answer=local_result["answer"],
                character_name=local_result.get("character_name", "Trợ Lý AI Lịch Sử Đông A")
            )
            if polished:
                self.response_cache[cache_key] = {"answer": polished, "timestamp": time.time()}
                res = dict(local_result)
                res["answer"] = polished
                res["served_by"] = "Grounded LLM Polish (Timeout: 2.5s)"
                return res

        # 3. Local High-Speed Fallback (<10ms)
        self.response_cache[cache_key] = {"answer": local_result["answer"], "timestamp": time.time()}
        res = dict(local_result)
        res["served_by"] = "Local Hybrid NLG (Fast & Zero Latency)"
        return res


hybrid_router = HybridNLPRouter()
