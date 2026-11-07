/** Chia trang cho các bảng quản trị: số dòng mỗi trang do người dùng chọn (10, 25 hoặc 30), và dãy số trang hiện ra ở nút chuyển trang. */

/** Từ độ rộng này bảng chuyển sang danh sách thẻ */
export const TABLE_MIN_WIDTH = 1000;

/** Các mức số dòng mỗi trang trong ô chọn cạnh nút chuyển trang */
export const PAGE_SIZES = [10, 25, 30] as const;
export const DEFAULT_PAGE_SIZE = 10;
const STORE_KEY = 'donga_admin_page_size';

/** Giá trị không hợp lệ (hỏng bộ nhớ, sửa tay) quay về mặc định 10 */
export const parsePageSize = (raw: unknown): number => {
  const n = Number(raw);
  return (PAGE_SIZES as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE;
};

let current: number = DEFAULT_PAGE_SIZE;
let loaded = false;
const listeners = new Set<() => void>();
const webStore = (): Storage | null => {
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; } // trình duyệt chặn lưu trữ: chỉ nhớ tới khi tải lại trang
};

/** Số dòng mỗi trang đang chọn; lần đầu đọc từ bộ nhớ trình duyệt (chỉ trên web) */
export function getPageSize(): number {
  if (!loaded) { loaded = true; current = parsePageSize(webStore()?.getItem(STORE_KEY)); }
  return current;
}

/** Đổi số dòng mỗi trang cho mọi bảng quản trị cùng lúc và nhớ cho lần mở sau */
export function setPageSize(size: number): void {
  const next = parsePageSize(size);
  if (loaded && next === current) return;
  loaded = true;
  current = next;
  try { webStore()?.setItem(STORE_KEY, String(next)); } catch { /* không lưu được: giữ cho tới khi tải lại trang */ }
  listeners.forEach((listener) => listener());
}

export function subscribePageSize(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Các số trang hiện ra: luôn có trang đầu, trang cuối và trang kề trang đang xem; chỗ cách quãng là "…" */
export function pageWindow(page: number, pages: number): Array<number | '…'> {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const keep = [...new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages))].sort((x, y) => x - y);
  const out: Array<number | '…'> = [];
  keep.forEach((n, i) => {
    if (i && n - keep[i - 1] > 1) out.push('…');
    out.push(n);
  });
  return out;
}
