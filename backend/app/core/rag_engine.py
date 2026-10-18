"""
Bộ điều phối Truy xuất Sử liệu (RAG Adapter) kết nối trực tiếp với
Model Ngôn ngữ Tự nhiên đã được tách module độc lập tại `backend/main_model.py`.
"""

import sys
from pathlib import Path
from typing import List, Dict, Any, Optional
from app.models.schemas import GroundingSource

# Đảm bảo import được các module NLP độc lập ở thư mục gốc backend
BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

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
        session_id: str = "default"
    ) -> Dict[str, Any]:
        return MainNLPEngine.ask(query=query, character_id=character_id, session_id=session_id)

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
