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
