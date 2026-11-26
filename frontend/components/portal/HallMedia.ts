/**
 * Bộ 12 hình minh họa riêng của Sảnh học sinh Hào Khí Đông A (nền trong suốt PNG và tranh bối cảnh JPG),
 * dùng cho khung đầu trang chủ (Hoàng thành Thăng Long), khu trưng bày 9 nhân vật lịch sử thời Trần (components/home-hall.tsx, chữ lấy HERO_PROFILE),
 * khung Bảng vàng xếp hạng, thư viện tranh và mục hướng dẫn cách chơi.
 */
import type { ImageSourcePropType } from 'react-native';

export const HALL_ART = {
  citadel: require('@/assets/student-hall/hoang-thanh-thang-long.png') as ImageSourcePropType,
  boardFrame: require('@/assets/student-hall/khung-bang-vang.png') as ImageSourcePropType,
  classCardFrame: require('@/assets/student-hall/class-card-frame.png') as ImageSourcePropType,
  classroomBanner: require('@/assets/student-hall/classroom-banner.jpg') as ImageSourcePropType,
  bachDangPlan: require('@/assets/student-hall/ban-ke-bach-dang.jpg') as ImageSourcePropType,
  sceneRiver: require('@/assets/student-hall/gallery-river.jpg') as ImageSourcePropType,
  sceneMarch: require('@/assets/student-hall/gallery-march.jpg') as ImageSourcePropType,
  sceneFleet: require('@/assets/student-hall/gallery-fleet.jpg') as ImageSourcePropType,
  sceneBachDang: require('@/assets/student-hall/gallery-bach-dang.jpg') as ImageSourcePropType,
  map1: require('@/assets/student-hall/gallery-map-1.jpg') as ImageSourcePropType,
  map2: require('@/assets/student-hall/gallery-map-2.jpg') as ImageSourcePropType,
  map3: require('@/assets/student-hall/gallery-map-3.jpg') as ImageSourcePropType,
  featureGame: require('@/assets/student-hall/feature-game.png') as ImageSourcePropType,
  featureMap: require('@/assets/student-hall/feature-map.png') as ImageSourcePropType,
  featureAi: require('@/assets/student-hall/feature-ai.png') as ImageSourcePropType,
  rankHocTro: require('@/assets/student-hall/rank-hoc-tro.jpg') as ImageSourcePropType,
  rankThaiHocSinh: require('@/assets/student-hall/rank-thai-hoc-sinh.jpg') as ImageSourcePropType,
  rankThamHoa: require('@/assets/student-hall/rank-tham-hoa.jpg') as ImageSourcePropType,
  rankBangNhan: require('@/assets/student-hall/rank-bang-nhan.jpg') as ImageSourcePropType,
  rankTrangNguyen: require('@/assets/student-hall/rank-trang-nguyen.jpg') as ImageSourcePropType,
  tranHungDao: require('@/assets/student-hall/tran-hung-dao.png') as ImageSourcePropType,
  vuaTran: require('@/assets/student-hall/vua-tran.png') as ImageSourcePropType,
  tranNhanTong: require('@/assets/student-hall/tran-nhan-tong.png') as ImageSourcePropType,
  tranThuDo: require('@/assets/student-hall/tran-thu-do.png') as ImageSourcePropType,
  tranQuangKhai: require('@/assets/student-hall/tran-quang-khai.png') as ImageSourcePropType,
  tranKhanhDu: require('@/assets/student-hall/tran-khanh-du.png') as ImageSourcePropType,
  tranNhatDuat: require('@/assets/student-hall/tran-nhat-duat.png') as ImageSourcePropType,
  yetKieu: require('@/assets/student-hall/yet-kieu.png') as ImageSourcePropType,
  tuongNguyenMong: require('@/assets/student-hall/tuong-nguyen-mong.png') as ImageSourcePropType,
} as const;

/** 5 bức minh họa ứng với 5 bậc danh hiệu khoa cử thời Trần (Học trò → Thái học sinh → Thám hoa → Bảng nhãn → Trạng nguyên) */
export const HALL_RANK_ART: ReadonlyArray<ImageSourcePropType> = [
  HALL_ART.rankHocTro,
  HALL_ART.rankThaiHocSinh,
  HALL_ART.rankThamHoa,
  HALL_ART.rankBangNhan,
  HALL_ART.rankTrangNguyen,
];
