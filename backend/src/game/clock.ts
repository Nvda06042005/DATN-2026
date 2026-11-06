/**
 * Thời gian của trò chơi hóa theo giờ Việt Nam (UTC+7): ngày học, tuần giải đấu (bắt đầu thứ Hai), tháng. `GameClock` cho phép kiểm thử "tua" thời gian
 * mà không đổi đồng hồ hệ thống; bản chạy thật luôn dùng giờ thật.
 */
import { Injectable } from '@nestjs/common';

export const VN_OFFSET_MS = 7 * 3600_000;
const DAY_MS = 86_400_000;

const vn = (d: Date): Date => new Date(d.getTime() + VN_OFFSET_MS);
/** Ngày theo giờ Việt Nam: YYYY-MM-DD */
export const dayKey = (d: Date): string => vn(d).toISOString().slice(0, 10);
/** Ngày thứ Hai của tuần chứa thời điểm `d` (theo giờ Việt Nam): YYYY-MM-DD */
export const weekKey = (d: Date): string => {
  const v = vn(d);
  v.setUTCDate(v.getUTCDate() - ((v.getUTCDay() + 6) % 7));
  return v.toISOString().slice(0, 10);
};
export const monthKey = (d: Date): string => vn(d).toISOString().slice(0, 7);
export const addDays = (key: string, n: number): string => new Date(Date.parse(`${key}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
export const daysBetween = (from: string, to: string): number => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
/** 0 giờ của ngày (giờ Việt Nam) dưới dạng thời điểm tuyệt đối */
export const dayStart = (key: string): Date => new Date(`${key}T00:00:00+07:00`);

// ---------------------------------------------------------------------- lịch chốt giải đấu tuần (HK.AD.054)
/** Thứ trong tuần của một ngày YYYY-MM-DD: 1 = thứ Hai … 7 = Chủ nhật */
export const isoWeekday = (key: string): number => { const d = new Date(`${key}T00:00:00Z`).getUTCDay(); return d === 0 ? 7 : d; };
/** Ngày gần nhất không muộn hơn `key` mang thứ `weekday` */
export const lastWeekday = (key: string, weekday: number): string => addDays(key, -((isoWeekday(key) - weekday + 7) % 7));
/** Ngày đầu tiên sau `key` mang thứ `weekday` */
export const nextWeekday = (key: string, weekday: number): string => addDays(key, ((weekday - isoWeekday(key) + 6) % 7) + 1);

/**
 * Lịch chốt: tuần giải đấu bắt đầu vào thứ `weekday` (mặc định thứ Hai, giống khóa tuần cũ nên dữ liệu đã có không đổi). `from` là ngày lịch này bắt đầu
 * áp dụng (null = từ trước đến nay); `next` là lịch mới đang chờ tới hạn: đổi ngày chốt không cắt ngang tuần đang chạy mà có hiệu lực từ tuần kế tiếp.
 */
export interface LeagueSchedule { weekday: number; from: string | null; next: { weekday: number; from: string } | null }
export const DEFAULT_LEAGUE_SCHEDULE: LeagueSchedule = { weekday: 1, from: null, next: null };
/** Tuần giải đấu: `key` là ngày bắt đầu (cũng là khóa lưu), `ends_on` là ngày bắt đầu của tuần sau */
export interface LeagueWeek { key: string; ends_on: string }

/** Lịch đang hiệu lực vào ngày `today`: lịch chờ đã tới hạn thì thay lịch cũ (giữ `from` để tuần chuyển tiếp không đổi khóa) */
export function settleSchedule(schedule: LeagueSchedule, today: string): LeagueSchedule {
  return schedule.next && today >= schedule.next.from ? { weekday: schedule.next.weekday, from: schedule.next.from, next: null } : schedule;
}

/** Tuần giải đấu chứa `now`. Tuần đầu của lịch mới có thể ngắn hơn 7 ngày (từ `from` tới thứ chốt kế tiếp) */
export function leagueWeekOf(schedule: LeagueSchedule, now: Date): LeagueWeek {
  const s = settleSchedule(schedule, dayKey(now));
  let start = lastWeekday(dayKey(now), s.weekday);
  if (s.from && start < s.from) start = s.from;
  return { key: start, ends_on: nextWeekday(start, s.weekday) };
}

/** Đưa lịch về khớp ngày chốt `target` trong cấu hình: khác lịch hiện tại thì hẹn áp dụng từ hết tuần đang chạy; đổi lại như cũ thì hủy lịch chờ */
export function reconcileSchedule(schedule: LeagueSchedule, target: number, now: Date): LeagueSchedule {
  const s = settleSchedule(schedule, dayKey(now));
  if ((s.next ? s.next.weekday : s.weekday) === target) return s;
  if (target === s.weekday) return { ...s, next: null };
  return { ...s, next: { weekday: target, from: leagueWeekOf(s, now).ends_on } };
}

export const sameSchedule = (a: LeagueSchedule, b: LeagueSchedule): boolean =>
  a.weekday === b.weekday && a.from === b.from && (a.next?.weekday ?? 0) === (b.next?.weekday ?? 0) && (a.next?.from ?? '') === (b.next?.from ?? '');

@Injectable()
export class GameClock {
  private offsetMs = 0;
  /** Bộ sinh số ngẫu nhiên [0, 1): kiểm thử thay bằng giá trị cố định để thẻ rơi có thể đoán trước */
  random: () => number = Math.random;

  now(): Date {
    return new Date(Date.now() + this.offsetMs);
  }

  /** Chỉ dùng trong kiểm thử: tua thời gian của trò chơi hóa */
  advance(ms: number): void {
    this.offsetMs += ms;
  }

  reset(): void {
    this.offsetMs = 0;
    this.random = Math.random;
  }
}
