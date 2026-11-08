/**
 * Tab mở từ trước khi triển khai bản mới: các tệp mã (chunk) của bản cũ không còn, máy chủ trả về trang HTML thay cho JavaScript nên màn hình sập với
 * "Unexpected token '<'" hoặc "Requiring unknown module". Điều hướng mềm hay dựng lại đúng mã cũ không cứu được; chỉ tải lại cả trang mới lấy bản mới.
 */

/** Thông báo lỗi do mã của bản cũ không tải được (không phải lỗi nghiệp vụ của một màn hình) */
const STALE_BUNDLE = /Unexpected token '<'|Requiring unknown module|ChunkLoadError|Loading chunk [\w-]+ failed|Loading CSS chunk|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i;

export const isStaleBundleError = (message: string | null | undefined): boolean => STALE_BUNDLE.test(message ?? '');

/** Khoảng tối thiểu giữa hai lần tự tải lại: nếu lỗi vẫn còn sau khi tải lại thì dừng và để người dùng bấm nút, không lặp vô hạn */
export const AUTO_RELOAD_GAP_MS = 60_000;

export const canAutoReload = (lastReloadAt: number, now: number): boolean => !(lastReloadAt > 0) || now - lastReloadAt >= AUTO_RELOAD_GAP_MS || now < lastReloadAt;

const KEY = 'donga_stale_reload_at';

/**
 * Tự tải lại trang một lần để lấy bản mới. Chỉ chạy trên web và chỉ khi trình duyệt cho ghi sessionStorage (cần để chống lặp).
 * Trả về true nếu đã ra lệnh tải lại.
 */
export function reloadForNewVersion(now: number = Date.now()): boolean {
  if (typeof window === 'undefined' || typeof window.location?.reload !== 'function') return false;
  try {
    const last = Number(window.sessionStorage.getItem(KEY) ?? 0);
    if (!canAutoReload(last, now)) return false;
    window.sessionStorage.setItem(KEY, String(now));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}
