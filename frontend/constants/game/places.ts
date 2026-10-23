import type { PlaceId } from '@/types/gameType';

export const MAP_PLACES: Record<PlaceId, { name: string; x: number; y: number; anchor?: 'start' | 'end' | 'middle'; dy?: number }> = {
  lang_son: { name: 'Lạng Sơn', x: 296, y: 58 },
  noi_bang: { name: 'Nội Bàng', x: 282, y: 128 },
  binh_le_nguyen: { name: 'Bình Lệ Nguyên', x: 132, y: 150, anchor: 'end' },
  thang_long: { name: 'Thăng Long', x: 178, y: 206, anchor: 'end' },
  dong_bo_dau: { name: 'Đông Bộ Đầu', x: 196, y: 186, anchor: 'end', dy: -10 },
  binh_than: { name: 'Bình Than', x: 246, y: 172, dy: -14 },
  van_kiep: { name: 'Vạn Kiếp', x: 278, y: 196 },
  yen_tu: { name: 'Yên Tử', x: 326, y: 168 },
  bach_dang: { name: 'Bạch Đằng', x: 334, y: 236 },
  van_don: { name: 'Vân Đồn', x: 392, y: 200, anchor: 'end', dy: -16 },
  chuong_duong: { name: 'Chương Dương', x: 190, y: 240, anchor: 'end' },
  ham_tu: { name: 'Hàm Tử', x: 222, y: 260 },
  tay_ket: { name: 'Tây Kết', x: 238, y: 282 },
  thien_truong: { name: 'Thiên Trường', x: 246, y: 322 },
  truong_yen: { name: 'Trường Yên', x: 192, y: 342, anchor: 'end' },
  thanh_hoa: { name: 'Thanh Hóa', x: 176, y: 404, anchor: 'end' },
  champa: { name: 'Chăm-pa', x: 246, y: 492 },
};
