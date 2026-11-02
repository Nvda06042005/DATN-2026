"""Ngân hàng câu hỏi của game "Hào Khí Đông A": server giữ đáp án và tự chấm.

Câu hỏi nằm trong ai/data/game_content.json. Khi gửi cho học sinh, đáp án được lược bỏ
và các lựa chọn được xáo thứ tự; mỗi lựa chọn mang một `key` cố định để server chấm.
Câu do AI sinh (Hugging Face / Gemini) được giữ tạm trong bộ nhớ để chấm theo cùng cách.

Dạng câu hỏi:
- mcq   : trắc nghiệm (gồm cả "điền câu nói", "vì sao…"), answer = vị trí đáp án đúng trong options
- tf    : đúng/sai, answer = true/false
- order : sắp xếp, items ghi theo đúng thứ tự
- match : nối, left[i] đi với right[i]
- map   : chọn địa danh trên lược đồ, options là mã địa danh, answer = mã đúng
"""
import json
import random
import threading
import time
import uuid
from collections import defaultdict
from pathlib import Path
from typing import Any, Optional

from app.config import ROOT_DIR

CONTENT_FILE = ROOT_DIR / "ai" / "data" / "game_content.json"
TYPES = {"mcq", "tf", "order", "match", "map"}
LEVELS = {"NHAN_BIET", "THONG_HIEU", "VAN_DUNG"}
AI_TTL_SECONDS = 3 * 3600
AI_CACHE_LIMIT = 3000


class QuestionBankError(RuntimeError):
    pass


def _validate(q: dict, places: dict) -> None:
    qid = q.get("id")
    if not isinstance(qid, str) or not qid:
        raise QuestionBankError("Câu hỏi thiếu id")
    kind = q.get("type")
    if kind not in TYPES:
        raise QuestionBankError(f"{qid}: dạng câu hỏi không hợp lệ ({kind})")
    for field in ("unit_id", "prompt", "explanation"):
        if not isinstance(q.get(field), str) or not q[field].strip():
            raise QuestionBankError(f"{qid}: thiếu {field}")
    if q.get("level", "THONG_HIEU") not in LEVELS:
        raise QuestionBankError(f"{qid}: mức độ không hợp lệ")
    if kind == "mcq":
        opts = q.get("options")
        if not isinstance(opts, list) or not 2 <= len(opts) <= 5 or len(set(opts)) != len(opts):
            raise QuestionBankError(f"{qid}: cần 2–5 lựa chọn khác nhau")
        if not isinstance(q.get("answer"), int) or not 0 <= q["answer"] < len(opts):
            raise QuestionBankError(f"{qid}: đáp án nằm ngoài danh sách lựa chọn")
    elif kind == "tf":
        if not isinstance(q.get("answer"), bool):
            raise QuestionBankError(f"{qid}: đáp án đúng/sai phải là true/false")
    elif kind == "order":
        items = q.get("items")
        if not isinstance(items, list) or not 3 <= len(items) <= 6 or len(set(items)) != len(items):
            raise QuestionBankError(f"{qid}: cần 3–6 mục khác nhau để sắp xếp")
    elif kind == "match":
        left, right = q.get("left"), q.get("right")
        if not isinstance(left, list) or not isinstance(right, list) or len(left) != len(right) or not 3 <= len(left) <= 5:
            raise QuestionBankError(f"{qid}: cần 3–5 cặp nối")
        if len(set(right)) != len(right) or len(set(left)) != len(left):
            raise QuestionBankError(f"{qid}: các vế nối phải khác nhau")
    elif kind == "map":
        opts = q.get("options")
        if not isinstance(opts, list) or not 2 <= len(opts) <= 5 or any(o not in places for o in opts):
            raise QuestionBankError(f"{qid}: địa danh không có trong lược đồ")
        if q.get("answer") not in opts:
            raise QuestionBankError(f"{qid}: đáp án không nằm trong các địa danh")


class QuestionBank:
    def __init__(self, path: Path = CONTENT_FILE) -> None:
        try:
            data = json.loads(Path(path).read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            raise QuestionBankError(f"Không đọc được ngân hàng câu hỏi: {exc}") from None
        self.units: dict[str, dict] = data.get("units", {})
        self.codex: list[dict] = data.get("codex", [])
        self.places: dict[str, str] = data.get("places", {})
        self.questions: dict[str, dict] = {}
        self.by_unit: dict[str, list[str]] = defaultdict(list)
        for q in data.get("questions", []):
            _validate(q, self.places)
            if q["id"] in self.questions:
                raise QuestionBankError(f"Trùng mã câu hỏi {q['id']}")
            self.questions[q["id"]] = q
            self.by_unit[q["unit_id"]].append(q["id"])
        self._ai: dict[str, tuple[float, dict]] = {}
        self._lock = threading.Lock()

    # ------------------------------------------------------------------ tra cứu
    def get(self, qid: str) -> Optional[dict]:
        if qid in self.questions:
            return self.questions[qid]
        with self._lock:
            hit = self._ai.get(qid)
        if hit and hit[0] > time.time():
            return hit[1]
        return None

    def units_with_questions(self) -> list[str]:
        return [u for u, ids in self.by_unit.items() if ids]

    def pick(self, units: Optional[list[str]], count: int, exclude: set[str], types: Optional[set[str]] = None,
             rng: Optional[random.Random] = None, levels: Optional[set[str]] = None) -> list[dict]:
        """Chọn ngẫu nhiên `count` câu thuộc các cụm tri thức đã cho (ưu tiên câu chưa gặp)."""
        rng = rng or random.Random()
        ids = [qid for u in (units or self.by_unit.keys()) for qid in self.by_unit.get(u, [])]
        if types:
            ids = [qid for qid in ids if self.questions[qid]["type"] in types] or ids
        if levels:
            ids = [qid for qid in ids if self.questions[qid].get("level", "THONG_HIEU") in levels] or ids
        fresh = [qid for qid in ids if qid not in exclude]
        rng.shuffle(fresh)
        chosen = fresh[:count]
        if len(chosen) < count:  # hết câu mới thì cho gặp lại câu cũ
            seen = [qid for qid in ids if qid in exclude]
            rng.shuffle(seen)
            chosen += seen[: count - len(chosen)]
        return [self.questions[qid] for qid in chosen]

    # ------------------------------------------------------------------ gửi cho học sinh (không kèm đáp án)
    def serve(self, q: dict, topic: str = "", rng: Optional[random.Random] = None) -> dict:
        rng = rng or random.Random()
        out: dict[str, Any] = {
            "id": q["id"],
            "unit_id": q["unit_id"],
            "type": q["type"],
            "prompt": q["prompt"],
            "level": q.get("level", "THONG_HIEU"),
            "topic": topic,
            "source": q.get("source"),
            "hint": q.get("hint"),
        }
        kind = q["type"]
        if kind == "mcq":
            options = [{"key": i, "text": text} for i, text in enumerate(q["options"])]
            if not q.get("keep_order"):
                rng.shuffle(options)
            out["options"] = options
        elif kind == "map":
            options = [{"key": place, "text": self.places[place]} for place in q["options"]]
            rng.shuffle(options)
            out["options"] = options
        elif kind == "order":
            items = [{"key": i, "text": text} for i, text in enumerate(q["items"])]
            while len(items) > 1 and [it["key"] for it in items] == list(range(len(items))):
                rng.shuffle(items)
            out["items"] = items
        elif kind == "match":
            out["left"] = [{"key": i, "text": text} for i, text in enumerate(q["left"])]
            right = [{"key": i, "text": text} for i, text in enumerate(q["right"])]
            rng.shuffle(right)
            out["right"] = right
        return out

    # ------------------------------------------------------------------ chấm
    @staticmethod
    def grade(q: dict, choice: Any = None, order: Optional[list] = None, pairs: Optional[dict] = None) -> tuple[bool, dict]:
        """Trả về (đúng/sai, đáp án để hiển thị)."""
        kind = q["type"]
        if kind in ("mcq", "map"):
            answer = q["answer"]
            correct = choice == answer and type(choice) is type(answer)
            return correct, {"choice": answer}
        if kind == "tf":
            return choice is q["answer"], {"choice": q["answer"]}
        if kind == "order":
            expected = list(range(len(q["items"])))
            return list(order or []) == expected, {"order": expected}
        if kind == "match":
            expected = {str(i): i for i in range(len(q["left"]))}
            given = {str(k): v for k, v in (pairs or {}).items()}
            return given == expected, {"pairs": expected}
        return False, {}

    # ------------------------------------------------------------------ câu do AI sinh
    def remember_ai(self, unit_id: str, question: str, options: list[str], correct_index: int, explanation: str,
                    source: str, level: str = "THONG_HIEU") -> Optional[dict]:
        """Lưu tạm câu AI sinh để chấm ở server; bỏ qua câu sai định dạng."""
        clean = [str(o).strip() for o in options if str(o).strip()]
        if not question.strip() or len(clean) != len(options) or not 2 <= len(clean) <= 5 or len(set(clean)) != len(clean):
            return None
        if not isinstance(correct_index, int) or not 0 <= correct_index < len(clean):
            return None
        q = {
            "id": "ai-" + uuid.uuid4().hex[:12],
            "unit_id": unit_id,
            "type": "mcq",
            "prompt": question.strip(),
            "options": clean,
            "answer": correct_index,
            "explanation": explanation.strip() or "Đáp án dựa trên tư liệu của bài học.",
            "source": source,
            "level": level if level in LEVELS else "THONG_HIEU",
            "ai": True,
        }
        now = time.time()
        with self._lock:
            if len(self._ai) >= AI_CACHE_LIMIT:
                for key, (expires, _) in list(self._ai.items()):
                    if expires <= now or len(self._ai) >= AI_CACHE_LIMIT:
                        self._ai.pop(key, None)
            self._ai[q["id"]] = (now + AI_TTL_SECONDS, q)
        return q


question_bank = QuestionBank()
