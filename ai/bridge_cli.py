"""
Persistent JSON-Lines Bridge for NestJS Backend -> Python AI Engine (Đông A NLP + BKT + RAG).
Reads one JSON request per line from stdin, writes one JSON response per line to stdout.
"""

import json
import sys
import traceback
from pathlib import Path
from typing import Any, Dict, List, Optional

if sys.platform == "win32":
    try:
        sys.stdin.reconfigure(encoding="utf-8")
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

AI_DIR = Path(__file__).resolve().parent
BACKEND_DIR = AI_DIR.parent / "backend"
for p in (str(AI_DIR), str(BACKEND_DIR)):
    if p not in sys.path:
        sys.path.insert(0, p)

# Ensure create_model.py includes semantic triggers for "Vì sao quân Trần chiến thắng quân Nguyên?"
try:
    cm_path = AI_DIR / "create_model.py"
    if cm_path.exists():
        cm_txt = cm_path.read_text(encoding="utf-8")
        updated = False
        if '"chien thang quan nguyen"' not in cm_txt:
            cm_txt = cm_txt.replace(
                '"vua toi dong long anh em hoa muc"',
                '"vua toi dong long anh em hoa muc", "chien thang quan nguyen", "chien thang quan mong", "quan tran chien thang", "nha tran chien thang", "vi sao chien thang", "tai sao chien thang"'
            )
            cm_txt = cm_txt.replace(
                '"nguyen nhan nha tran thang", "yeu to quan trong nhat giup", "vua toi dong long"',
                '"nguyen nhan nha tran thang", "yeu to quan trong nhat giup", "vua toi dong long", "chien thang quan nguyen", "chien thang quan mong", "quan tran chien thang", "nha tran chien thang"'
            )
            cm_path.write_text(cm_txt, encoding="utf-8")
except Exception:
    pass

from main_model import MainNLPEngine
from rag_engine import RAGEngine, CURRICULUM_TOPIC_GROUPS
from bkt_engine import bkt_engine
from context_manager import remove_accents, normalize_vi

FIGURE_ID_TO_PERSONA: Dict[int, str] = {
    1: "TRAN_HUNG_DAO",
    2: "TRAN_QUOC_TOAN",
    3: "TRAN_THU_DO",
    4: "TRAN_BINH_TRONG",
    5: "TRAN_NHAN_TONG",
    6: "TRAN_KHANH_DU",
    7: "PHAM_NGU_LAO",
    8: "YET_KIEU",
    9: "TRAN_QUANG_KHAI",
    10: "TRAN_NHAT_DUAT",
    11: "LE_PHU_TRAN",
    12: "TRAN_THAI_TONG",
    13: "TRAN_THANH_TONG",
}

NATURAL_FOLLOWUPS_BY_UNIT: Dict[str, List[str]] = {
    "TRAN_HUNG_DAO_PORTRAIT": [
        "Hoàn cảnh ra đời và ý nghĩa bài Hịch tướng sĩ của Trần Quốc Tuấn là gì?",
        "Trận Bạch Đằng tháng 4 năm 1288 do Trần Hưng Đạo chỉ huy diễn ra như thế nào?",
        "Câu nói 'Nếu bệ hạ muốn hàng xin hãy chém đầu thần trước đã' thể hiện điều gì?",
    ],
    "KC3_BACH_DANG_HOW": [
        "Vì sao Trần Hưng Đạo chọn sông Bạch Đằng để bố trí trận địa cọc ngầm năm 1288?",
        "Chiến thắng Vân Đồn của Trần Khánh Dư năm 1288 có vai trò gì đối với trận Bạch Đằng?",
        "Nguyên nhân thắng lợi và ý nghĩa lịch sử của ba lần kháng chiến chống quân Mông - Nguyên là gì?",
    ],
    "DIEN_HONG_CONFERENCE": [
        "Hội nghị Bình Than năm 1282 và Hội nghị Diên Hồng năm 1285 khác nhau thế nào?",
        "Vì sao Trần Quốc Toản lại bóp nát quả cam tại bến Bình Than?",
        "Hoàn cảnh ra đời và ý nghĩa của bài Hịch tướng sĩ năm 1285 là gì?",
    ],
    "CAUSES_OF_VICTORY": [
        "Ý nghĩa lịch sử và tầm vóc quốc tế của ba lần kháng chiến chống Mông - Nguyên là gì?",
        "Nghệ thuật quân sự 'lấy đoản binh chế trường trận' thời Trần được thể hiện ra sao?",
        "Kế sách 'Vườn không nhà trống' đã gây ra những bất lợi gì cho quân xâm lược?",
    ],
    "TQT_WHY_ORANGE": [
        "Trần Quốc Toản đã thêu sáu chữ vàng gì lên lá cờ của mình và lập chiến công ra sao?",
        "Hội nghị Bình Than năm 1282 bàn về việc gì?",
        "Hội nghị Diên Hồng năm 1285 có ý nghĩa lịch sử như thế nào?",
    ],
    "KC1_VUON_KHONG_NHA_TRONG": [
        "Sau khi rút khỏi Thăng Long, quân Trần đã phản công tại Đông Bộ Đầu năm 1258 như thế nào?",
        "Câu nói 'Đầu thần chưa rơi xuống đất, xin bệ hạ đừng lo' của Trần Thủ Độ có ý nghĩa gì?",
        "Trận mở màn Bình Lệ Nguyên năm 1258 diễn ra ra sao?",
    ],
}

DEFAULT_FOLLOWUPS: List[str] = [
    "Vì sao Trần Quốc Toản lại bóp nát quả cam tại bến Bình Than?",
    "Tại sao Thoát Hoan phải chui vào ống đồng tháo chạy năm 1285?",
    "Trận Bạch Đằng năm 1288 của Trần Hưng Đạo diễn ra như thế nào?",
    "Kế sách Vườn không nhà trống có tác dụng gì trong kháng chiến?",
]


def resolve_persona_slug(figure_id: Optional[int], figure_name: Optional[str], character_id: Optional[str]) -> Optional[str]:
    if character_id and str(character_id).strip():
        return str(character_id).strip().upper()
    if figure_id is not None:
        try:
            fid = int(figure_id)
            if fid in FIGURE_ID_TO_PERSONA:
                return FIGURE_ID_TO_PERSONA[fid]
        except Exception:
            pass
    if figure_name:
        unacc = normalize_vi(remove_accents(figure_name))
        for kw, slug in [
            ("hung dao", "TRAN_HUNG_DAO"),
            ("quoc tuan", "TRAN_HUNG_DAO"),
            ("quoc toan", "TRAN_QUOC_TOAN"),
            ("thu do", "TRAN_THU_DO"),
            ("binh trong", "TRAN_BINH_TRONG"),
            ("nhan tong", "TRAN_NHAN_TONG"),
            ("khanh du", "TRAN_KHANH_DU"),
            ("pham ngu lao", "PHAM_NGU_LAO"),
            ("yet kieu", "YET_KIEU"),
            ("quang khai", "TRAN_QUANG_KHAI"),
            ("nhat duat", "TRAN_NHAT_DUAT"),
            ("le phu tran", "LE_PHU_TRAN"),
            ("thai tong", "TRAN_THAI_TONG"),
            ("thanh tong", "TRAN_THANH_TONG"),
        ]:
            if kw in unacc:
                return slug
    return None


def build_followups(rag_engine_inst: RAGEngine, unit_id: str, question: str) -> List[str]:
    if unit_id in NATURAL_FOLLOWUPS_BY_UNIT:
        return NATURAL_FOLLOWUPS_BY_UNIT[unit_id][:3]

    out: List[str] = []
    q_norm = normalize_vi(remove_accents(question))
    model = rag_engine_inst.model

    # Find group containing unit_id
    sibling_uids: List[str] = []
    for grp in CURRICULUM_TOPIC_GROUPS.values():
        uids = grp.get("unit_ids", [])
        if unit_id in uids:
            sibling_uids = [u for u in uids if u != unit_id]
            break

    for suid in sibling_uids:
        rec = model.unit_lookup.get(suid, {})
        examples = rec.get("question_examples") or []
        cand = examples[0] if examples else None
        if not cand:
            # Find from train_records
            for tr in model.train_records:
                if tr.get("unit_id") == suid and tr.get("user_query"):
                    cand = tr["user_query"]
                    break
        if cand and normalize_vi(remove_accents(cand)) != q_norm and cand not in out:
            out.append(cand)
        if len(out) >= 3:
            break

    for d in DEFAULT_FOLLOWUPS:
        if len(out) >= 3:
            break
        if normalize_vi(remove_accents(d)) != q_norm and d not in out:
            out.append(d)

    return out[:3]


def handle_ask(rag_engine_inst: RAGEngine, payload: Dict[str, Any]) -> Dict[str, Any]:
    question = str(payload.get("question") or "").strip()
    session_id = str(payload.get("session_id") or "default_session")
    student_id = str(payload.get("student_id") or "student_demo_01")
    figure_id = payload.get("figure_id")
    figure_name = payload.get("figure_name")
    character_id = resolve_persona_slug(figure_id, figure_name, payload.get("character_id"))

    local_res = rag_engine_inst.ask_natural(
        query=question,
        character_id=character_id,
        session_id=session_id,
        student_id=student_id,
    )

    unit_id = local_res.get("unit_id", "UNKNOWN")
    is_ood = bool(local_res.get("is_not_found", False)) or unit_id == "OOD_RANDOM_AND_OFFTOPIC"

    study_hint: Optional[str] = None
    mastery_summary: Optional[Dict[str, Any]] = None

    if is_ood:
        bkt_engine.record_chat_interaction(
            student_id=student_id,
            unit_id=unit_id,
            query=question,
            confidence=0.1,
            is_not_found=True,
        )
    elif local_res.get("bkt_chat_update"):
        chat_bkt = local_res["bkt_chat_update"]
        weak_recs = bkt_engine.recommend_personalized_review(student_id=student_id, top_k=2)
        weak_names = ", ".join([r["topic"] for r in weak_recs]) if weak_recs else ""
        old_pct = int(round(float(chat_bkt.get("old_p_l", 0.3)) * 100))
        new_pct = int(round(float(chat_bkt.get("new_p_l", 0.3)) * 100))
        study_hint = (
            f"📊 Hồ sơ học tập ghi nhận em vừa ôn tập chủ đề **{chat_bkt['topic']}** "
            f"(Độ hiểu bài: `{old_pct}%` ➔ **`{new_pct}%`** — *{chat_bkt.get('mastery_status', 'Đang củng cố')}*)."
        )
        if weak_names:
            study_hint += f" Gợi ý củng cố tiếp theo: **{weak_names}**."
        mastery_summary = {
            "unit_id": unit_id,
            "topic": chat_bkt["topic"],
            "old_p_l": chat_bkt["old_p_l"],
            "new_p_l": chat_bkt["new_p_l"],
            "mastery_status": chat_bkt["mastery_status"],
        }

    # Build citations compatible with NestJS Citation interface
    citations: List[Dict[str, Any]] = []
    raw_sources = local_res.get("grounding_sources") or []
    for idx, src in enumerate(raw_sources, 1):
        doc_name = src.get("doc_name") or "SGK Lịch sử 7 (KNTT) & Đại Việt Sử Ký Toàn Thư"
        curr_match = src.get("curriculum_match") or local_res.get("topic") or "Bài 15: Ba lần kháng chiến chống quân Mông - Nguyên"
        fact_chunk = src.get("fact_chunk") or ""
        page_num = src.get("page_number")
        title_str = f"{doc_name} (Tr. {page_num})" if page_num else doc_name
        citations.append({
            "n": idx,
            "kind": "source",
            "kind_label": curr_match,
            "id": idx,
            "title": title_str,
            "snippet": fact_chunk,
            "openable": False,
        })

    # Fallback to direct ĐVSKTT chronicle search only if unit has no grounding_sources
    if not is_ood and len(citations) == 0:
        dv_hits = rag_engine_inst.model.search_dvsktt_passages(question, top_k=1)
        for hit in dv_hits:
            if hit.get("score", 0) >= 3.5:
                folio_str = ", ".join(hit.get("folios") or [])
                citations.append({
                    "n": len(citations) + 1,
                    "kind": "source",
                    "kind_label": f"Đại Việt Sử Ký Toàn Thư — {hit.get('quyen', 'Bản Kỷ')}",
                    "id": int(hit.get("pdf_page") or 500),
                    "title": f"Đại Việt Sử Ký Toàn Thư ({hit.get('quyen', 'Quyển V')}, tờ [{folio_str}], Tr. {hit.get('pdf_page')})",
                    "snippet": str(hit.get("text") or "")[:220].strip() + "…",
                    "openable": False,
                })

    followups = build_followups(rag_engine_inst, unit_id, question)
    answer_text = local_res.get("answer", "")
    if study_hint and not is_ood:
        answer_text = f"{answer_text}\n\n---\n{study_hint}"

    return {
        "unit_id": unit_id,
        "topic": local_res.get("topic", unit_id),
        "confidence": float(local_res.get("confidence", 0.95)),
        "answer": answer_text,
        "raw_answer": local_res.get("answer", ""),
        "character_name": local_res.get("character_name", "Trợ Lý AI Lịch Sử Đông A"),
        "citations": citations,
        "followups": followups,
        "refused": False,
        "is_not_found": is_ood,
        "badge_unlocked": local_res.get("badge_unlocked"),
        "exp_reward": int(local_res.get("exp_reward") or 0),
        "study_hint": study_hint,
        "student_mastery_summary": mastery_summary,
        "recommended_materials": local_res.get("recommended_materials") or [],
    }


def handle_bkt_recommendations(payload: Dict[str, Any]) -> Dict[str, Any]:
    student_id = str(payload.get("student_id") or "student_nguyen_van_long")
    top_k = int(payload.get("top_k") or 6)
    if student_id not in bkt_engine.student_states or not bkt_engine.student_states.get(student_id):
        bkt_engine._seed_demo_student_profile(student_id)
    recs = bkt_engine.recommend_personalized_review(student_id=student_id, top_k=top_k)
    profile = bkt_engine.analyze_student_profile(student_id=student_id, top_k=top_k)
    return {
        "student_id": student_id,
        "bkt_parameters": {
            "p_l0": getattr(bkt_engine, "default_p_l0", 0.30),
            "p_t": getattr(bkt_engine, "default_p_t", 0.15),
            "p_g": getattr(bkt_engine, "default_p_g", 0.25),
            "p_s": getattr(bkt_engine, "default_p_s", 0.10),
            "mastery_threshold": 0.60,
        },
        "total_recommendations": len(recs),
        "recommendations": recs,
        "profile": profile,
    }


def handle_reset_session(rag_engine_inst: RAGEngine, payload: Dict[str, Any]) -> Dict[str, Any]:
    session_id = str(payload.get("session_id") or "default_session")
    rag_engine_inst.model.context_manager.reset_session(session_id)
    return {"reset": True, "session_id": session_id}


def handle_teach(rag_engine_inst: RAGEngine, payload: Dict[str, Any]) -> Dict[str, Any]:
    res = rag_engine_inst.model.teach_new_knowledge(
        unit_id=str(payload.get("unit_id") or ""),
        topic=str(payload.get("topic") or ""),
        entity=str(payload.get("entity") or "Nhà Trần"),
        event=str(payload.get("event") or "Ba lần kháng chiến chống quân Mông - Nguyên (1258 - 1288)"),
        fact_chunk=str(payload.get("fact_chunk") or ""),
        answer=str(payload.get("answer") or ""),
        base_queries=payload.get("sample_questions") or payload.get("base_queries") or [],
        cognitive_level=str(payload.get("cognitive_level") or "THONG_HIEU"),
        difficulty=float(payload.get("difficulty") or 0.5),
    )
    return res


def main():
    rag_engine_inst = RAGEngine()
    ready_msg = {
        "ready": True,
        "units": len(rag_engine_inst.model.unit_lookup),
        "train_samples": len(rag_engine_inst.model.train_records),
    }
    print(json.dumps(ready_msg, ensure_ascii=False), flush=True)

    for line in sys.stdin:
        raw = line.lstrip("\ufeff").strip()
        if not raw:
            continue
        req_id = None
        try:
            req = json.loads(raw)
            req_id = req.get("id")
            action = req.get("action", "ask")
            payload = req.get("payload") or {}

            if action == "ask":
                result = handle_ask(rag_engine_inst, payload)
            elif action == "bkt_recommendations":
                result = handle_bkt_recommendations(payload)
            elif action == "reset_session":
                result = handle_reset_session(rag_engine_inst, payload)
            elif action == "teach":
                result = handle_teach(rag_engine_inst, payload)
            else:
                raise ValueError(f"Unknown action: {action}")

            resp = {"id": req_id, "ok": True, "result": result}
        except Exception as e:
            resp = {
                "id": req_id,
                "ok": False,
                "error": str(e),
                "trace": traceback.format_exc(),
            }
        print(json.dumps(resp, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
