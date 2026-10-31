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
