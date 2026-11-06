/** Chia trang cho các bảng quản trị: số dòng mỗi trang theo chiều cao màn hình, và dãy số trang hiện ra ở nút chuyển trang. */

/** Từ độ rộng này bảng chuyển sang danh sách thẻ (mỗi thẻ cao khoảng 190 px) */
export const TABLE_MIN_WIDTH = 1000;
const CARDS_PER_PAGE = 5;
/** Phần trên bảng (thanh đầu, tiêu đề, bộ lọc) + hàng tiêu đề, nút chuyển trang và chân trang chiếm khoảng 540 px */
const RESERVED_HEIGHT = 540;
/** Mỗi dòng của bảng cao khoảng 68 px */
const ROW_HEIGHT = 68;
export const MIN_PAGE_SIZE = 5;
export const MAX_PAGE_SIZE = 30;

/** Số dòng mỗi trang để cả bảng và nút chuyển trang vừa một màn hình, không phải cuộn dài xuống */
export function pageSizeFor(width: number, height: number): number {
  if (width < TABLE_MIN_WIDTH) return CARDS_PER_PAGE;
  return Math.max(MIN_PAGE_SIZE, Math.min(MAX_PAGE_SIZE, Math.floor((height - RESERVED_HEIGHT) / ROW_HEIGHT)));
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
