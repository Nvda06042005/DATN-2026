/** Hiển thị thời gian. Khung học kỳ và số tuần thực học chỉ lấy từ máy chủ, không suy đoán ngày/tuần trên client. */
export interface YearDates {
  starts_on: string; ends_on: string;
  term1_starts_on: string | null; term1_ends_on: string | null;
  term2_starts_on: string | null; term2_ends_on: string | null;
  calendar_mode?: 'manual' | 'national';
}
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
export const fmtDay = (iso: string | null | undefined): string => {
  const m = ISO.exec(iso ?? ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
};
export const todayVn = (now = Date.now()): string => new Date(now + 7 * 3600000).toISOString().slice(0, 10);
export const labelForDate = (iso: string): string => {
  const y = Number(iso.slice(0, 4)); return Number(iso.slice(5, 7)) >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
};
export function phaseText(y: YearDates, today: string): string | null {
  const a1 = y.term1_starts_on, b1 = y.term1_ends_on, a2 = y.term2_starts_on, b2 = y.term2_ends_on;
  if (!a1 || !b1 || !a2 || !b2) return null;
  if (today < a1) return 'Chưa đến học kỳ 1';
  if (today <= b1) return y.calendar_mode === 'national' ? 'Trong khung học kỳ 1' : 'Đang học kỳ 1';
  if (today < a2) return 'Giữa hai học kỳ';
  if (today <= b2) return y.calendar_mode === 'national' ? 'Trong khung học kỳ 2' : 'Đang học kỳ 2';
  return today <= y.ends_on ? 'Đã hết khung học kỳ 2' : 'Đã qua ngày kết thúc năm học';
}