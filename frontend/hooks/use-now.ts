import { useEffect, useState } from 'react';

/** Đồng hồ cập nhật theo chu kỳ (dùng cho đếm ngược nâng cấp, triệu tập) */
export const useNow = (intervalMs = 1000) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
};
