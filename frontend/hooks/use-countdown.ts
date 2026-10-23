import { useCallback, useEffect, useState } from 'react';

/**
 * Đếm ngược theo số mili giây còn lại server báo. `start(ms)` gọi ngay khi nhận tin nhắn,
 * nên mốc "bây giờ" luôn là lúc nhận (không lệch theo lúc mở màn hình); `start(null)` dừng đếm.
 */
export const useCountdown = () => {
  const [clock, setClock] = useState<{ end: number; now: number } | null>(null);
  const end = clock?.end ?? null;
  useEffect(() => {
    if (end === null) return;
    const t = window.setInterval(() => setClock((c) => (c ? { ...c, now: Date.now() } : c)), 250);
    return () => window.clearInterval(t);
  }, [end]);
  const start = useCallback((remainingMs: number | null) => {
    const now = Date.now();
    setClock(remainingMs === null ? null : { end: now + remainingMs, now });
  }, []);
  const seconds = clock ? Math.max(0, Math.ceil((clock.end - clock.now) / 1000)) : 0;
  return [seconds, start] as const;
};
