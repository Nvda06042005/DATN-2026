/** Trung bình trượt trên chuỗi ngày liên tiếp; không xem ngày thiếu dữ liệu là 0. */
export function rollingAverage(values: number[], window = 7): Array<number | null> {
  if (!Number.isInteger(window) || window < 1) throw new Error('Khoảng trung bình phải là số nguyên dương');
  let sum = 0;
  return values.map((value, i) => {
    sum += value;
    if (i >= window) sum -= values[i - window];
    return i < window - 1 ? null : Math.round((sum / window) * 100) / 100;
  });
}

/** Gắn hoạt động vào lịch do máy chủ trả về, giữ ngày không phát sinh hoạt động. */
export function alignActivity<T extends { bucket: string }>(days: string[], items: T[]): Array<T | null> {
  const byDay = new Map(items.map(item => [item.bucket, item]));
  return days.map(day => byDay.get(day) ?? null);
}

/** Các bucket giao với cửa sổ N ngày gần nhất của API; bucket đầu/cuối có thể chưa trọn kỳ. */
export function calendarBuckets(asOf: string | undefined, granularity: 'day' | 'week' | 'month', days: number): string[] {
  if (!asOf || !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) return [];
  const end = new Date(`${asOf}T00:00:00Z`);
  if (!Number.isFinite(end.getTime()) || !Number.isInteger(days) || days < 1 || days > 365) return [];
  const cursor = new Date(end);
  cursor.setUTCDate(cursor.getUTCDate() - days);
  const floor = (date: Date) => {
    if (granularity === 'month') date.setUTCDate(1);
    if (granularity === 'week') date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  };
  floor(cursor); floor(end);
  const keys: string[] = [];
  while (cursor <= end) {
    keys.push(cursor.toISOString().slice(0, granularity === 'month' ? 7 : 10));
    if (granularity === 'month') cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    else cursor.setUTCDate(cursor.getUTCDate() + (granularity === 'week' ? 7 : 1));
  }
  return keys;
}
