/** Quy tắc tiến độ học tập: chuỗi ngày học, bộ đếm theo ngày/tuần (giờ Việt Nam), thưởng khi trả lời, mức nắm vững BKT. */
import type { Progress } from '../database/database.service';

export const XP_CORRECT = 10;
export const XP_WRONG = 2;
export const GEMS_CORRECT = 10;
/** Câu thuộc cụm tri thức học sinh đã làm nhưng còn yếu (P(L) < 0.6) */
export const GEMS_CORRECT_WEAK = 15;
export const DAILY_GEM_CAP = 300;
export const WEAK_THRESHOLD = 0.6;

const VN_OFFSET_MS = 7 * 3_600_000;
const DAY_MS = 86_400_000;

const vnDate = (daysBack = 0): string => new Date(Date.now() + VN_OFFSET_MS - daysBack * DAY_MS).toISOString().slice(0, 10);
export const today = (): string => vnDate(0);
export const daysAgo = (n: number): string => vnDate(n);

/** Tuần ISO 8601 của ngày hôm nay (giờ Việt Nam), ví dụ 2026-W43 */
export function weekKey(): string {
  const d = new Date(`${today()}T00:00:00Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / DAY_MS + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Sang ngày (tuần) mới thì đặt lại các bộ đếm trong ngày (tuần) */
export function rollDay(p: Progress): Progress {
  if (p.day_key !== today()) Object.assign(p, { day_key: today(), day_xp: 0, day_lessons: 0, day_correct: 0, day_ai_questions: 0, day_gems: 0 });
  if (p.week_key !== weekKey()) Object.assign(p, { week_key: weekKey(), week_xp: 0 });
  return p;
}

/** Mỗi tuần có 1 "ngày nghỉ phép": bỏ học 1 ngày vẫn giữ chuỗi */
export const freezeAvailable = (p?: Progress | null): boolean => !p || p.freeze_week !== weekKey();

/** Ghi nhận hôm nay có học: nối chuỗi nếu hôm qua có học (hoặc dùng ngày nghỉ phép), ngược lại bắt đầu lại từ 1 */
export function touchStreak(p: Progress): Progress {
  const last = p.last_active_date;
  if (last === today()) return p;
  const streak = Number(p.streak || 0);
  if (last === daysAgo(1)) p.streak = streak + 1;
  else if (last === daysAgo(2) && freezeAvailable(p)) {
    p.streak = streak + 1;
    p.freeze_week = weekKey();
  } else p.streak = 1;
  p.last_active_date = today();
  return p;
}

/** Chuỗi đang hiệu lực: bỏ học quá một ngày (đã dùng hết ngày nghỉ phép) thì coi như đã đứt */
export function effectiveStreak(p?: Progress | null): number {
  if (!p) return 0;
  const last = p.last_active_date;
  return last === today() || last === daysAgo(1) || (last === daysAgo(2) && freezeAvailable(p)) ? Number(p.streak || 0) : 0;
}

/** Cộng XP và Ấn Tín (cột gems) cho một câu trả lời đã được server chấm. Trả về [xp, gems]. */
export function awardAnswer(p: Progress, correct: boolean, weak: boolean): [number, number] {
  const xp = correct ? XP_CORRECT : XP_WRONG;
  let gems = 0;
  if (correct) {
    const room = Math.max(0, DAILY_GEM_CAP - Number(p.day_gems || 0));
    gems = Math.min(weak ? GEMS_CORRECT_WEAK : GEMS_CORRECT, room);
  }
  p.xp = Number(p.xp || 0) + xp;
  p.day_xp = Number(p.day_xp || 0) + xp;
  p.week_xp = Number(p.week_xp || 0) + xp;
  p.gems = Number(p.gems || 0) + gems;
  p.day_gems = Number(p.day_gems || 0) + gems;
  return [xp, gems];
}

const round3 = (x: number): number => Math.round(x * 1000) / 1000;

export function accuracy(p?: Progress | null): number | null {
  if (!p || !Number(p.questions_answered || 0)) return null;
  return round3(Number(p.questions_correct) / Number(p.questions_answered));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function loadJson(text?: string | null): Record<string, any> {
  if (!text) return {};
  try {
    const data = JSON.parse(text);
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

/** Trung bình P(L) trên các cụm tri thức học sinh đã làm */
export function avgMastery(p?: Progress | null): number | null {
  const values = Object.values(loadJson(p?.bkt_state))
    .filter((r) => r && typeof r === 'object' && r.attempts)
    .map((r) => Number(r.p_l));
  return values.length ? round3(values.reduce((a, b) => a + b, 0) / values.length) : null;
}

/** Số sao của 3 màn chiến dịch (mỗi màn 3 pha × 3 sao) đọc từ game_state */
export function campaignStars(p?: Progress | null): number[] {
  const camp = loadJson(p?.game_state).campaign;
  const totals = [0, 0, 0];
  if (camp && typeof camp === 'object') {
    for (const [key, stars] of Object.entries(camp)) {
      if (key.length >= 2 && key[0] === 'm' && '123'.includes(key[1]) && Number.isInteger(stars)) totals[Number(key[1]) - 1] += Math.max(0, Math.min(3, stars as number));
    }
  }
  return totals;
}

export function heroCount(p?: Progress | null): number {
  const heroes = loadJson(p?.game_state).heroes;
  return heroes && typeof heroes === 'object' && !Array.isArray(heroes) ? Object.keys(heroes).length : 0;
}

export function activeWithin(lastLoginAt: string | null, days: number): boolean {
  if (!lastLoginAt) return false;
  const when = Date.parse(lastLoginAt);
  return !Number.isNaN(when) && Date.now() - when <= days * DAY_MS;
}
