import { useEffect, useState } from 'react';

/**
 * true khi đã qua `seconds` giây kể từ lúc `key` đổi (key đổi thì đếm lại, key rỗng thì chưa đếm). Dùng cho nút "Gửi lại mã" của bước xác thực hai lớp:
 * hiện khi mã email đã hết hạn. Tính theo đồng hồ thật và kiểm tra lại khi tab hiện lên, nên tab nền bị trình duyệt làm chậm bộ đếm vẫn báo đúng
 * ngay khi người dùng quay lại từ hộp thư. Kết quả gắn với đúng `key` đã hết hạn: nhận mã mới thì lần vẽ đầu tiên đã là "chưa hết hạn" (không nháy).
 */
export function useExpired(key: string | null | undefined, seconds: number): boolean {
  const [state, setState] = useState<{ key: string | null | undefined; expired: boolean }>({ key, expired: false });
  useEffect(() => {
    setState((prev) => (prev.key === key && !prev.expired ? prev : { key, expired: false }));
    if (!key) return undefined;
    const startedAt = Date.now();
    const check = () => {
      const expired = Date.now() - startedAt >= seconds * 1000;
      setState((prev) => (prev.key === key && prev.expired === expired ? prev : { key, expired }));
    };
    const timer = setInterval(check, 1000);
    const web = typeof document !== 'undefined' && typeof document.addEventListener === 'function';
    if (web) document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(timer);
      if (web) document.removeEventListener('visibilitychange', check);
    };
  }, [key, seconds]);
  return Boolean(key) && state.key === key && state.expired;
}
