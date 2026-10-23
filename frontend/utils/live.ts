import { basePath, isHashRouting } from '@/lib/router';
import type { LiveKey } from '@/types/liveType';

/** So khớp khóa đáp án kể cả kiểu (true khác 1) – giống cách server chấm */
export const sameLiveKey = (a: LiveKey | null | undefined, b: LiveKey | null | undefined) =>
  a !== null && a !== undefined && b !== null && b !== undefined && typeof a === typeof b && a === b;

/** Đường link mở trang học sinh kèm sẵn mã PIN (chỉ khi chạy trên web, không phải file://) */
export const liveJoinHref = (pin: string) => {
  if (!/^https?:$/.test(window.location.protocol)) return null;
  return isHashRouting()
    ? `${window.location.origin}${window.location.pathname}?pin=${pin}#/hoc-sinh`
    : `${window.location.origin}${basePath()}hoc-sinh?pin=${pin}`;
};
