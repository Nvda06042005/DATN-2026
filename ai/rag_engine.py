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


CURRICULUM_TOPIC_GROUPS: Dict[str, Dict[str, Any]] = {
    "KHANG_CHIEN_1": {
        "id": "KHANG_CHIEN_1",
        "title": "Kháng chiến chống Mông Cổ lần thứ nhất (1258)",
        "short_title": "Kháng chiến lần 1 (1258)",
        "badge": "1258 - Bình Lệ Nguyên & Đông Bộ Đầu",
        "description": "Âm mưu xâm lược của Mông Cổ, Trận Bình Lệ Nguyên (Lê Phụ Trần), Kế sách Vườn không nhà trống tại Thăng Long, Thái sư Trần Thủ Độ, Trần Nhật Hiệu - Hoàng Cự Đà và Đại thắng phản công Đông Bộ Đầu.",
        "sgk_reference": "SGK Lịch sử & Địa lí 7 (KNTT) - Bài 15, Mục 1, Tr. 66–67 & Đại Việt Sử Ký Toàn Thư Quyển V, tờ [22a-23b], Tr. 519–522",
        "unit_ids": [
            "KC1_OVERVIEW", "KC1_WHY_INVADE", "KC1_BINH_LE_NGUYEN",
            "KC1_VUON_KHONG_NHA_TRONG", "KC1_TRAN_THU_DO_QUOTE", "KC1_DONG_BO_DAU",
            "DVSKTT_TRAN_NHAT_HIEU_HOANG_CU_DA"
        ]
    },
    "KHANG_CHIEN_2": {
        "id": "KHANG_CHIEN_2",
        "title": "Kháng chiến chống quân Nguyên lần thứ hai (1285)",
        "short_title": "Kháng chiến lần 2 (1285)",
        "badge": "1285 - Bình Than, Diên Hồng & Hàm Tử",
        "description": "Hội nghị Bình Than, Trần Quốc Toản bóp nát quả cam, Hội nghị Diên Hồng (tiếng hô ĐÁNH), Hịch tướng sĩ & chữ Sát Thát, Đỗ Khắc Chung đi sứ, Trần Quốc Tuấn rút đầu sắt gậy gỗ, Trần Bình Trọng, Hàm Tử - Chương Dương, Thoát Hoan chui ống đồng.",
        "sgk_reference": "SGK Lịch sử & Địa lí 7 (KNTT) - Bài 15, Mục 2, Tr. 68–71 & Đại Việt Sử Ký Toàn Thư Quyển V, tờ [42a-50a], Tr. 560–578",
        "unit_ids": [
            "BINH_THAN_CONFERENCE", "TQT_WHY_ORANGE", "TQT_SIX_GOLDEN_WORDS", "TQT_OVERVIEW",
            "DIEN_HONG_CONFERENCE", "HICH_TUONG_SI", "TRAN_HUNG_DAO_PORTRAIT", "GAME_BINH_THU_YEU_LUOC",
            "KC2_OVERVIEW", "KC2_TRAN_BINH_TRONG", "KC2_HAM_TU_CHUONG_DUONG", "KC2_THOAT_HOAN_COPPER_PIPE",
            "DVSKTT_DO_KHAC_CHUNG_SU_GIA", "DVSKTT_TRAN_QUOC_TUAN_GAY_BIT_SAT"
        ]
    },
    "KHANG_CHIEN_3": {
        "id": "KHANG_CHIEN_3",
        "title": "Kháng chiến chống quân Nguyên lần thứ ba (1287 – 1288)",
        "short_title": "Kháng chiến lần 3 (1287 - 1288)",
        "badge": "1287-1288 - Vân Đồn & Bạch Đằng",
        "description": "Toàn cảnh kháng chiến 1287-1288, Hải chiến Vân Đồn (Trần Khánh Dư tiêu diệt đoàn thuyền lương Trương Văn Hổ), Đại thắng Bạch Đằng 1288 (Nguyễn Khoái, Đỗ Hành bắt sống Ô Mã Nhi) và kế Hoàng Tá Thốn dùi thuyền kèm Lời bàn Ngô Sĩ Liên.",
        "sgk_reference": "SGK Lịch sử & Địa lí 7 (KNTT) - Bài 15, Mục 3, Tr. 71–73 & Đại Việt Sử Ký Toàn Thư Quyển V, tờ [51b-56b], Tr. 580–590",
        "unit_ids": [
            "KC3_OVERVIEW", "KC3_VAN_DON", "GAME_TRAN_KHANH_DU", "KC3_BACH_DANG_HOW",
            "DVSKTT_BACH_DANG_DO_HANH_NGUYEN_KHOAI", "DVSKTT_HOANG_TA_THON_NGO_SI_LIEN_BAN"
        ]
    },
    "NHAN_VAT_QUAN_SU": {
        "id": "NHAN_VAT_QUAN_SU",
        "title": "Nhân vật Lịch sử, Hội nghị & Nghệ thuật Quân sự thời Trần",
        "short_title": "Nhân vật & Nghệ thuật Quân sự",
        "badge": "Hào khí Đông A & Bài học lịch sử",
        "description": "Điện súy Phạm Ngũ Lão, Yết Kiêu - Dã Tượng, Phật Hoàng Trần Nhân Tông, Tù trưởng miền núi, Ngụ binh ư nông, Quân Thánh Dực, Căn cứ Vạn Kiếp - Thiên Trường, Kiểm pháp quan Trần Thì Kiến, Nguyên nhân thắng lợi & Bài học Khoan thư sức dân.",
        "sgk_reference": "SGK Lịch sử & Địa lí 7 (KNTT) - Bài 14 & 15, Tr. 62–75 & Đại Việt Sử Ký Toàn Thư Quyển VI, tờ [4a-14a], Tr. 610–630",
        "unit_ids": [
            "ALL_3_WARS_SUMMARY", "CAUSES_OF_VICTORY", "HISTORICAL_SIGNIFICANCE", "MILITARY_ART_TRAN_DYNASTY",
            "HISTORICAL_LESSONS_TODAY", "GAME_NGU_BINH_U_NONG", "GAME_QUAN_THANH_DUC_SAT_THAT",
            "GAME_VAN_KIEP_THIEN_TRUONG_BASES", "YET_KIEU_DA_TUONG", "PHAM_NGU_LAO", "GAME_TRAN_NHAN_TONG",
            "ROLE_OF_ETHNIC_MINORITIES", "GAME_TRUNG_THAN_VS_PHAN_BOI", "DVSKTT_TRAN_THI_KIEN_PHAP_LUAT",
            "DVSKTT_THANH_LAP_NHA_TRAN_1225", "DVSKTT_BO_MAY_PHAP_LUAT_QUOC_TRIEU_HINH_THU",
            "DVSKTT_KINH_TE_DIEN_TRANG_THAI_AP_DE_DINH_NHI", "DVSKTT_KHOA_CU_THAI_HOC_SINH_NGUYEN_HIEN_MAC_DINH_CHI",
            "DVSKTT_CHU_VAN_AN_THAT_TRAM_SO", "DVSKTT_TRUONG_HAN_SIEU_BACH_DANG_GIANG_PHU",
            "DVSKTT_DOAN_NHU_HAI_NGOAI_GIAO", "DVSKTT_VAN_HOA_AN_NAM_TU_DAI_KHI_CHUA_PHAP_VAN"
        ]
    },
    "TONG_HOP_TOAN_KHOA": {
        "id": "TONG_HOP_TOAN_KHOA",
        "title": "Tổng hợp Toàn khóa 3 lần Kháng chiến (1258 - 1288)",
        "short_title": "Đề Tổng hợp Toàn khóa",
        "badge": "Ma trận Bloom chuẩn GDPT 2018",
        "description": "Đề khảo thí tích hợp toàn diện bao quát 3 cuộc kháng chiến chống Mông - Nguyên và tư liệu gốc Đại Việt Sử Ký Toàn Thư, phân bổ ma trận Bloom (Nhận biết, Thông hiểu, Vận dụng).",
        "sgk_reference": "Toàn bộ Chương trình Lịch sử 7 & Đại Việt Sử Ký Toàn Thư (Bản Kỷ Quyển V - VI, Tr. 478–630)",
        "unit_ids": []
    }
}


class RAGEngine:
    """
    Adapter gọn nhẹ kết nối API với `MainNLPEngine` (không gộp dữ liệu cứng vào code).
    """
    def __init__(self):
        self.model = MainNLPEngine.get_model()

    @property
    def records(self) -> List[Dict[str, Any]]:
        return self.model.train_records

    def get_topic_group_meta(self, group_id: Optional[str]) -> Optional[Dict[str, Any]]:
        if not group_id:
            return None
        return CURRICULUM_TOPIC_GROUPS.get(group_id.strip().upper())

    def get_topic_groups(self) -> List[Dict[str, Any]]:
        import json
        DATA_DIR = Path(__file__).resolve().parent / "data"
        qm_path = DATA_DIR / "q_matrix.json"
        gc_path = DATA_DIR / "game_content.json"

        qm_data = {}
        if qm_path.exists():
            try:
                qm_data = json.loads(qm_path.read_text(encoding="utf-8"))
            except Exception:
                pass

        mcq_counts: Dict[str, int] = {}
        if gc_path.exists():
            try:
                gc_data = json.loads(gc_path.read_text(encoding="utf-8"))
                for q in gc_data.get("questions", []):
                    if q.get("type") == "mcq" and q.get("unit_id"):
                        uid = q.get("unit_id")
                        mcq_counts[uid] = mcq_counts.get(uid, 0) + 1
            except Exception:
                pass

        lvl_map = {
            "NHAN_BIET": "Nhận biết",
            "THONG_HIEU": "Thông hiểu",
            "VAN_DUNG": "Vận dụng",
        }

        all_academic_units: List[str] = []
        for gid, grp in CURRICULUM_TOPIC_GROUPS.items():
            if gid != "TONG_HOP_TOAN_KHOA":
                all_academic_units.extend(grp["unit_ids"])

        result = []
        for gid, grp in CURRICULUM_TOPIC_GROUPS.items():
            target_uids = grp["unit_ids"] if gid != "TONG_HOP_TOAN_KHOA" else all_academic_units
            units_list = []
            total_mcqs = 0
            for uid in target_uids:
                u_info = qm_data.get(uid, {})
                q_cnt = mcq_counts.get(uid, 0)
                total_mcqs += q_cnt
                units_list.append({
                    "unit_id": uid,
                    "topic": u_info.get("topic", uid),
                    "cognitive_level": lvl_map.get(u_info.get("cognitive_level", "THONG_HIEU"), "Thông hiểu"),
                    "difficulty": float(u_info.get("difficulty", 0.5)),
                    "question_count": q_cnt
                })
            result.append({
                "id": grp["id"],
                "title": grp["title"],
                "short_title": grp["short_title"],
                "badge": grp["badge"],
                "description": grp["description"],
                "sgk_reference": grp["sgk_reference"],
                "units": units_list,
                "question_count_available": total_mcqs
            })
        return result

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
        self,
        query: Optional[str] = None,
        character_id: Optional[str] = None,
        top_k: int = 5,
        topic_group_id: Optional[str] = None,
        unit_ids: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        # 1. Nếu chỉ định trực tiếp danh sách unit_ids
        if unit_ids and len(unit_ids) > 0:
            results = []
            for uid in unit_ids:
                if uid in self.model.unit_lookup:
                    rec = dict(self.model.unit_lookup[uid])
                    rec["confidence"] = 1.0
                    results.append(rec)
            if results:
                return results[:top_k]

        # 2. Nếu có topic_group_id
        if topic_group_id:
            norm_gid = topic_group_id.strip().upper()
            group_info = CURRICULUM_TOPIC_GROUPS.get(norm_gid)
            if group_info:
                target_uids = group_info["unit_ids"]
                if not target_uids:  # TONG_HOP_TOAN_KHOA
                    target_uids = [u for g in CURRICULUM_TOPIC_GROUPS.values() for u in g["unit_ids"] if u]

                # Nếu có query, ưu tiên dự đoán và sắp xếp theo query
                if query and query.strip():
                    best_uid, conf, meta = self.model.predict_unit(query)
                    ordered = []
                    if best_uid in target_uids and best_uid in self.model.unit_lookup:
                        rec = dict(self.model.unit_lookup[best_uid])
                        rec["confidence"] = conf
                        ordered.append(rec)
                    for uid in target_uids:
                        if uid != best_uid and uid in self.model.unit_lookup:
                            rec = dict(self.model.unit_lookup[uid])
                            rec["confidence"] = 0.8
                            ordered.append(rec)
                    return ordered[:top_k]

                # Nếu không có query, trả về các unit trong group
                results = []
                for uid in target_uids:
                    if uid in self.model.unit_lookup:
                        rec = dict(self.model.unit_lookup[uid])
                        rec["confidence"] = 0.9
                        results.append(rec)
                return results[:top_k]

        # 3. Fallback theo query ban đầu (tương thích 100% với code cũ)
        if query and query.strip():
            best_uid, conf, meta = self.model.predict_unit(query)
            if best_uid == "OOD_RANDOM_AND_OFFTOPIC" or best_uid not in self.model.unit_lookup:
                return []
            unit_rec = dict(self.model.unit_lookup[best_uid])
            unit_rec["confidence"] = conf
            unit_rec["detected_q_type"] = meta.get("q_type", "OVERVIEW")
            return [unit_rec]

        return []

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
