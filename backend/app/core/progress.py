"""Quy tắc tiến độ học tập: chuỗi ngày học, bộ đếm theo ngày/tuần, thưởng khi trả lời, mức nắm vững BKT."""
import json
from datetime import datetime, timedelta, timezone

VN_TZ = timezone(timedelta(hours=7))

# Thưởng khi server chấm một câu trả lời
XP_CORRECT = 10
XP_WRONG = 2
GEMS_CORRECT = 10
GEMS_CORRECT_WEAK = 15  # câu thuộc cụm tri thức học sinh đã làm nhưng còn yếu (P(L) < 0.6)
DAILY_GEM_CAP = 300
WEAK_THRESHOLD = 0.6


def _date():
    return datetime.now(VN_TZ).date()


def today() -> str:
    return _date().isoformat()


def _days_ago(n: int) -> str:
    return (_date() - timedelta(days=n)).isoformat()


def week_key() -> str:
    year, week, _ = _date().isocalendar()
    return f"{year}-W{week:02d}"


def roll_day(p: dict) -> dict:
    """Sang ngày (tuần) mới thì đặt lại các bộ đếm trong ngày (tuần)."""
    if p.get("day_key") != today():
        p.update(day_key=today(), day_xp=0, day_lessons=0, day_correct=0, day_ai_questions=0, day_gems=0)
    if p.get("week_key") != week_key():
        p.update(week_key=week_key(), week_xp=0)
    return p


def freeze_available(p: dict | None) -> bool:
    """Mỗi tuần có 1 "ngày nghỉ phép": bỏ học 1 ngày vẫn giữ chuỗi."""
    return not p or p.get("freeze_week") != week_key()


def touch_streak(p: dict) -> dict:
    """Ghi nhận hôm nay có học: nối chuỗi nếu hôm qua có học (hoặc dùng ngày nghỉ phép), ngược lại bắt đầu lại từ 1."""
    last = p.get("last_active_date")
    if last == today():
        return p
    streak = int(p.get("streak") or 0)
    if last == _days_ago(1):
        p["streak"] = streak + 1
    elif last == _days_ago(2) and freeze_available(p):
        p["streak"] = streak + 1
        p["freeze_week"] = week_key()
    else:
        p["streak"] = 1
    p["last_active_date"] = today()
    return p


def effective_streak(p: dict | None) -> int:
    """Chuỗi đang hiệu lực: bỏ học quá một ngày (đã dùng hết ngày nghỉ phép) thì chuỗi coi như đã đứt."""
    if not p:
        return 0
    last = p.get("last_active_date")
    if last in (today(), _days_ago(1)) or (last == _days_ago(2) and freeze_available(p)):
        return int(p.get("streak") or 0)
    return 0


def award_answer(p: dict, *, correct: bool, weak: bool) -> tuple[int, int]:
    """Cộng XP và Ấn Tín (cột gems) cho một câu trả lời đã được server chấm. Trả về (xp, gems)."""
    xp = XP_CORRECT if correct else XP_WRONG
    gems = 0
    if correct:
        room = max(0, DAILY_GEM_CAP - int(p.get("day_gems") or 0))
        gems = min(GEMS_CORRECT_WEAK if weak else GEMS_CORRECT, room)
    for key, value in (("xp", xp), ("day_xp", xp), ("week_xp", xp), ("gems", gems), ("day_gems", gems)):
        p[key] = int(p.get(key) or 0) + value
    return xp, gems


def accuracy(p: dict | None) -> float | None:
    if not p or not int(p.get("questions_answered") or 0):
        return None
    return round(int(p["questions_correct"]) / int(p["questions_answered"]), 3)


def load_json(text: str | None) -> dict:
    if not text:
        return {}
    try:
        data = json.loads(text)
        return data if isinstance(data, dict) else {}
    except (ValueError, TypeError):
        return {}


def avg_mastery(p: dict | None) -> float | None:
    """Trung bình P(L) trên các cụm tri thức học sinh đã làm."""
    state = load_json(p.get("bkt_state") if p else None)
    values = [float(r["p_l"]) for r in state.values() if isinstance(r, dict) and r.get("attempts")]
    return round(sum(values) / len(values), 3) if values else None


def campaign_stars(p: dict | None) -> list[int]:
    """Số sao của 3 màn chiến dịch (mỗi màn 3 pha × 3 sao) đọc từ game_state."""
    camp = load_json(p.get("game_state") if p else None).get("campaign")
    totals = [0, 0, 0]
    if isinstance(camp, dict):
        for key, stars in camp.items():
            if isinstance(key, str) and len(key) >= 2 and key[0] == "m" and key[1] in "123" and isinstance(stars, int):
                totals[int(key[1]) - 1] += max(0, min(3, stars))
    return totals


def hero_count(p: dict | None) -> int:
    heroes = load_json(p.get("game_state") if p else None).get("heroes")
    return len(heroes) if isinstance(heroes, dict) else 0


def active_within(last_login_at: str | None, days: int) -> bool:
    if not last_login_at:
        return False
    try:
        when = datetime.fromisoformat(last_login_at)
    except ValueError:
        return False
    if when.tzinfo is None:
        when = when.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - when <= timedelta(days=days)
