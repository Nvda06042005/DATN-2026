"""
Bộ điều phối Truy xuất Sử liệu (RAG Adapter) kết nối trực tiếp với
Model Ngôn ngữ Tự nhiên đã được tách module độc lập tại `ai/main_model.py`.
"""

import sys
from pathlib import Path
from typing import List, Dict, Any, Optional
from app.models.schemas import GroundingSource

# main_model.py nằm cùng thư mục ai/
AI_DIR = Path(__file__).resolve().parent
if str(AI_DIR) not in sys.path:
    sys.path.insert(0, str(AI_DIR))

from main_model import MainNLPEngine


class RAGEngine:
    """
    Adapter gọn nhẹ kết nối API với `MainNLPEngine` (không gộp dữ liệu cứng vào code).
    """
    def __init__(self):
        self.model = MainNLPEngine.get_model()

    @property
    def records(self) -> List[Dict[str, Any]]:
        return self.model.train_records

    def ask_natural(
        self,
        query: str,
        character_id: Optional[str] = None,
        session_id: str = "default",
        student_id: Optional[str] = None
    ) -> Dict[str, Any]:
        import json
        import re

        effective_student_id = student_id or session_id or "student_demo_01"
        db_user_id: Optional[int] = None

        # Đồng bộ tự động với tài khoản thật từ AdvisorChat (`student_<id>` -> `user_<id>` trong SQLite/Postgres)
        for candidate in (session_id, character_id, student_id):
            if candidate:
                m = re.match(r"^(?:student|user)_(\d+)$", str(candidate).strip())
                if m:
                    db_user_id = int(m.group(1))
                    if student_id in (None, "", "student_demo_01"):
                        effective_student_id = f"user_{db_user_id}"
                    break

        try:
            from bkt_engine import bkt_engine
            if db_user_id is not None and effective_student_id not in bkt_engine.student_states:
                from database.user_store import store
                p = store.get_progress(db_user_id)
                raw_bkt = (p or {}).get("bkt_state")
                if raw_bkt:
                    loaded = json.loads(raw_bkt) if isinstance(raw_bkt, str) else raw_bkt
                    if isinstance(loaded, dict):
                        bkt_engine.student_states[effective_student_id] = loaded
        except Exception:
            pass

        res = MainNLPEngine.ask(
            query=query,
            character_id=character_id,
            session_id=session_id,
            student_id=effective_student_id
        )
        # Tự động ghi nhận tiến độ học tập qua Chat vào BKT Engine (tương thích 100% với backend/app/api/chat.py)
        try:
            from bkt_engine import bkt_engine
            uid = res.get("unit_id", "")
            if uid and uid not in (
                "OOD_RANDOM_AND_OFFTOPIC", "INTENT_GREETING", "INTENT_THANKS",
                "INTENT_STUDENT_STRUGGLE", "INTENT_ASSISTANT_IDENTITY",
                "INTERACTIVE_CHAT_QUIZ", "INTERACTIVE_CHAT_QUIZ_GRADE", "ADAPTIVE_CUSTOM_EXAM"
            ) and not str(uid).startswith("CROSS_ERA_"):
                bkt_update = bkt_engine.record_chat_interaction(
                    student_id=effective_student_id,
                    unit_id=uid,
                    query=query,
                    confidence=float(res.get("confidence", 0.9)),
                    is_not_found=bool(res.get("is_not_found", False)),
                    topic=res.get("topic")
                )
                res["bkt_chat_update"] = bkt_update
                res["recommended_materials"] = bkt_engine.get_study_materials_for_units(
                    [uid], max_items=2, student_id=effective_student_id
                )

            # Đồng bộ ngược trạng thái BKT về user_store & alias `student_id` nếu frontend gửi `student_<id>`
            if student_id and student_id != effective_student_id and effective_student_id in bkt_engine.student_states:
                bkt_engine.student_states[student_id] = bkt_engine.student_states[effective_student_id]
            if db_user_id is not None and effective_student_id in bkt_engine.student_states:
                from database.user_store import store
                store.save_progress(
                    db_user_id,
                    {"bkt_state": json.dumps(bkt_engine.student_states[effective_student_id], ensure_ascii=False)}
                )
        except Exception:
            pass
        return res

    def search_relevant_chunks(
        self, query: str, character_id: Optional[str] = None, top_k: int = 3
    ) -> List[Dict[str, Any]]:
        best_uid, conf, meta = self.model.predict_unit(query)
        if best_uid == "OOD_RANDOM_AND_OFFTOPIC" or best_uid not in self.model.unit_lookup:
            return []
        unit_rec = dict(self.model.unit_lookup[best_uid])
        unit_rec["confidence"] = conf
        unit_rec["detected_q_type"] = meta.get("q_type", "OVERVIEW")
        return [unit_rec]

    def extract_grounding_sources(self, records: List[Dict[str, Any]]) -> List[GroundingSource]:
        sources = []
        for r in records:
            if r.get("q_type") in ["INTENT", "CROSS_ERA", "OOD"]:
                continue
            src = r.get("grounding_source", {})
            if src and src.get("fact_chunk"):
                sources.append(
                    GroundingSource(
                        doc_name=src.get("doc_name", "SGK Lịch sử 7 (KNTT) & Đại Việt Sử Ký Toàn Thư"),
                        page_number=src.get("page_number"),
                        curriculum_match=src.get("curriculum_match", "SGK Lịch sử 7 - Bài 13"),
                        fact_chunk=src.get("fact_chunk", "")
                    )
                )
        return sources


rag_engine = RAGEngine()
