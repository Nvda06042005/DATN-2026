import type { PlaceId } from '@/types/gameType';

export const TIMELINE: Array<{ date: string; title: string; place?: PlaceId; units: string[] }> = [
  { date: 'Trước 1258', title: 'Mông Cổ âm mưu xâm lược, vua Trần bắt giam sứ giả', units: ['KC1_WHY_INVADE'] },
  { date: 'Tháng 1/1258', title: 'Trận Bình Lệ Nguyên – rút lui bảo toàn lực lượng', place: 'binh_le_nguyen', units: ['KC1_BINH_LE_NGUYEN', 'KC1_TRAN_THU_DO_QUOTE'] },
  { date: 'Tháng 1/1258', title: 'Vườn không nhà trống ở Thăng Long', place: 'thang_long', units: ['KC1_VUON_KHONG_NHA_TRONG'] },
  { date: '29/1/1258', title: 'Đại thắng Đông Bộ Đầu', place: 'dong_bo_dau', units: ['KC1_DONG_BO_DAU', 'KC1_OVERVIEW'] },
  { date: '10/1282', title: 'Hội nghị Bình Than – Trần Quốc Toản bóp nát quả cam', place: 'binh_than', units: ['BINH_THAN_CONFERENCE', 'TQT_WHY_ORANGE', 'TQT_SIX_GOLDEN_WORDS', 'TQT_OVERVIEW'] },
  { date: '1284', title: 'Hịch tướng sĩ – tinh thần Sát Thát', units: ['HICH_TUONG_SI', 'GAME_BINH_THU_YEU_LUOC', 'TRAN_HUNG_DAO_PORTRAIT'] },
  { date: 'Đầu năm 1285', title: 'Hội nghị Diên Hồng – “Đánh!”', place: 'thang_long', units: ['DIEN_HONG_CONFERENCE'] },
  { date: '1285', title: 'Thoát Hoan và Toa Đô đánh gọng kìm', units: ['KC2_OVERVIEW'] },
  { date: '2/1285', title: 'Trần Bình Trọng chặn giặc, giữ đường rút', units: ['KC2_TRAN_BINH_TRONG'] },
  { date: '5 – 6/1285', title: 'Tổng phản công: Hàm Tử, Chương Dương, Tây Kết', place: 'chuong_duong', units: ['KC2_HAM_TU_CHUONG_DUONG'] },
  { date: '6/1285', title: 'Thoát Hoan chui ống đồng tháo chạy', place: 'van_kiep', units: ['KC2_THOAT_HOAN_COPPER_PIPE'] },
  { date: 'Cuối 1287 – đầu 1288', title: 'Trần Khánh Dư phục kích ở Vân Đồn', place: 'van_don', units: ['KC3_VAN_DON', 'GAME_TRAN_KHANH_DU', 'KC3_OVERVIEW'] },
  { date: '4/1288', title: 'Đại thắng Bạch Đằng – bắt sống Ô Mã Nhi', place: 'bach_dang', units: ['KC3_BACH_DANG_HOW'] },
  { date: '1258 – 1288', title: 'Nguyên nhân thắng lợi và ý nghĩa lịch sử', units: ['ALL_3_WARS_SUMMARY', 'CAUSES_OF_VICTORY', 'HISTORICAL_SIGNIFICANCE'] },
];
