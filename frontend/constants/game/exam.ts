export const CATEGORY_LABEL: Record<string, string> = {
  KHANG_CHIEN_LAN_1_1258: 'Kháng chiến lần thứ nhất (1258)',
  BINH_THAN_TRAN_QUOC_TOAN: 'Hội nghị Bình Than & Trần Quốc Toản',
  DIEN_HONG_HICH_TUONG_SI: 'Diên Hồng, Hịch tướng sĩ & Trần Hưng Đạo',
  KHANG_CHIEN_LAN_2_1285: 'Kháng chiến lần thứ hai (1285)',
  HAI_CHIEN_VAN_DON_1288: 'Trận Vân Đồn (1288)',
  DAI_THANG_BACH_DANG_1288: 'Đại thắng Bạch Đằng (1288)',
  NGUYEN_NHAN_Y_NGHIA: 'Nguyên nhân thắng lợi & ý nghĩa',
  DANH_TUONG_GIA_THAN: 'Danh tướng & gia tướng',
  NEN_TANG_QUAN_SU: 'Nền tảng quân sự Đại Việt',
};

export const CATEGORY_ORDER = Object.keys(CATEGORY_LABEL);

export const TOWER_FLOORS = Array.from({ length: 10 }, (_, i) => {
  const floor = i + 1;
  const boss = floor % 5 === 0;
  return {
    floor,
    boss,
    count: boss ? 5 : 3,
    pass: boss ? 4 : 2,
    levels: floor <= 3 ? ['NHAN_BIET'] : floor <= 7 ? ['THONG_HIEU', 'NHAN_BIET'] : ['VAN_DUNG', 'THONG_HIEU'],
    levelText: floor <= 3 ? 'Nhận biết' : floor <= 7 ? 'Thông hiểu' : 'Vận dụng',
    relic: floor === 5 ? 'hich' : floor === 10 ? 'binh_thu_relic' : null,
    luong: 40 * floor,
  };
});
