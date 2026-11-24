/**
 * Bộ 12 hình minh họa riêng của Sảnh học sinh Hào Khí Đông A (nền trong suốt PNG và tranh bối cảnh JPG),
 * dùng cho màn mở đầu Hoàng thành Thăng Long, khu trưng bày 9 nhân vật lịch sử thời Trần,
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

export interface HallCharacter {
  key: string;
  name: string;
  shortName: string;
  title: string;
  era: string;
  image: ImageSourcePropType;
  backdrop: string;
  accent: string;
  bio: string;
  deed: string;
  quote: string;
}

/** 9 nhân vật lịch sử tiêu biểu trong ba cuộc kháng chiến chống quân Mông – Nguyên (1258, 1285, 1287–1288) */
export const HALL_CHARACTERS: ReadonlyArray<HallCharacter> = [
  {
    key: 'tran-hung-dao',
    name: 'Trần Hưng Đạo',
    shortName: 'Trần Hưng Đạo',
    title: 'Quốc công Tiết chế · Hưng Đạo Đại Vương',
    era: '1228 – 1300',
    image: HALL_ART.tranHungDao,
    backdrop: '#23324a',
    accent: '#d9483b',
    bio: 'Vị tổng chỉ huy kiệt xuất lãnh đạo quân dân Đại Việt qua hai cuộc kháng chiến 1285 và 1287–1288. Ông soạn Hịch tướng sĩ khích lệ tinh thần toàn quân và lập kế trận cọc trên sông Bạch Đằng.',
    deed: 'Đại thắng Bạch Đằng (1288), Vạn Kiếp, Chương Dương và soạn Binh thư yếu lược.',
    quote: '“Nếu bệ hạ muốn hàng, xin hãy chém đầu thần trước đã!”',
  },
  {
    key: 'vua-tran',
    name: 'Vua Trần Thái Tông – Thánh Tông',
    shortName: 'Vua Trần',
    title: 'Hoàng đế khai sáng vương triều Trần',
    era: 'Thế kỷ XIII',
    image: HALL_ART.vuaTran,
    backdrop: '#5c3c12',
    accent: '#e3b244',
    bio: 'Các vị Hoàng đế anh minh trực tiếp cầm quân trong kháng chiến lần thứ nhất (1258), đặt nền móng khoa cử Tam khôi (1247) và xây dựng khối đoàn kết trên dưới một lòng.',
    deed: 'Đặt khoa thi Thái học sinh (1232), Tam khôi (1247) và lãnh đạo chiến thắng Đông Bộ Đầu (1258).',
    quote: '“Vua tôi đồng lòng, anh em hòa mục, cả nước góp sức.”',
  },
  {
    key: 'tran-nhan-tong',
    name: 'Vua Trần Nhân Tông',
    shortName: 'Trần Nhân Tông',
    title: 'Phật hoàng · Lãnh đạo kháng chiến lần II & III',
    era: '1258 – 1308',
    image: HALL_ART.tranNhanTong,
    backdrop: '#6b1d24',
    accent: '#f0b840',
    bio: 'Vị vua triệu tập Hội nghị Diên Hồng hỏi kế bô lão cả nước, cùng quân dân hai lần đánh tan giặc Nguyên – Mông. Sau khi đất nước thái bình, ông lên Yên Tử sáng lập Thiền phái Trúc Lâm.',
    deed: 'Tổ chức Hội nghị Diên Hồng (1284), chỉ huy kháng chiến thắng lợi năm 1285 và 1288.',
    quote: '“Xã tắc lưỡng hồi lao thạch mã, sơn hà thiên cổ điện kim âu.”',
  },
  {
    key: 'tran-thu-do',
    name: 'Trần Thủ Độ',
    shortName: 'Trần Thủ Độ',
    title: 'Thái sư · Kiến trúc sư vương triều Trần',
    era: '1194 – 1264',
    image: HALL_ART.tranThuDo,
    backdrop: '#3f1e3a',
    accent: '#c06c99',
    bio: 'Người giữ vai trò trụ cột buổi đầu nhà Trần, nổi tiếng cương trực, kỷ luật và giữ vững khí tiết trong giờ phút hiểm nguy nhất của cuộc kháng chiến lần thứ nhất (1258).',
    deed: 'Củng cố triều chính Đại Việt và truyền quyết tâm kháng chiến năm 1258.',
    quote: '“Đầu thần chưa rơi xuống đất, xin bệ hạ đừng lo!”',
  },
  {
    key: 'tran-quang-khai',
    name: 'Trần Quang Khải',
    shortName: 'Trần Quang Khải',
    title: 'Thượng tướng Thái sư · Văn võ song toàn',
    era: '1241 – 1294',
    image: HALL_ART.tranQuangKhai,
    backdrop: '#163c42',
    accent: '#3aa89d',
    bio: 'Danh tướng kiêm nhà thơ xuất sắc của triều Trần. Ông chỉ huy chiến dịch phản công giải phóng kinh thành Thăng Long năm 1285 và để lại bài thơ bất hủ Tụng giá hoàn kinh sư.',
    deed: 'Đại thắng Chương Dương, Hàm Tử (1285) và giải phóng kinh đô Thăng Long.',
    quote: '“Đoạt sáo Chương Dương độ, cầm Hồ Hàm Tử quan.”',
  },
  {
    key: 'tran-khanh-du',
    name: 'Trần Khánh Dư',
    shortName: 'Trần Khánh Dư',
    title: 'Phó tướng thủy quân · Nhân Huệ Vương',
    era: 'Thế kỷ XIII – XIV',
    image: HALL_ART.tranKhanhDu,
    backdrop: '#263f24',
    accent: '#78b04b',
    bio: 'Vị tướng mưu lược, táo bạo với tầm nhìn chiến lược đánh trúng điểm yếu hậu cần của địch. Ông dùng kế mai phục đánh tan đoàn thuyền lương của Trương Văn Hổ tại Vân Đồn.',
    deed: 'Chiến thắng Vân Đồn (1288), cắt đứt hoàn toàn nguồn lương thảo của quân Nguyên.',
    quote: '“Quân giặc trông cậy vào lương thực; đánh tan thuyền lương thì giặc tự vỡ.”',
  },
  {
    key: 'tran-nhat-duat',
    name: 'Trần Nhật Duật',
    shortName: 'Trần Nhật Duật',
    title: 'Chiêu Văn Vương · Danh tướng tài hoa',
    era: '1255 – 1330',
    image: HALL_ART.tranNhatDuat,
    backdrop: '#541b21',
    accent: '#e39b39',
    bio: 'Vị tướng thông thạo nhiều ngôn ngữ, ngoại giao khéo léo và cầm quân sắc bén. Ông cầm hổ phù chỉ huy đánh tan đạo quân Toa Đô tại cửa Hàm Tử năm 1285.',
    deed: 'Chiến công vang dội tại Hàm Tử Quan (1285) và giữ vững vùng biên ải.',
    quote: 'Tài thao lược kết hợp lòng nhân hậu và tri thức rộng mở.',
  },
  {
    key: 'yet-kieu',
    name: 'Yết Kiêu',
    shortName: 'Yết Kiêu',
    title: 'Danh tướng thủy chiến · Biệt tài bơi lặn',
    era: 'Thế kỷ XIII',
    image: HALL_ART.yetKieu,
    backdrop: '#1a2748',
    accent: '#4a8fe7',
    bio: 'Gia tướng trung thành của Trần Hưng Đạo, nổi danh với tài bơi lặn phi thường. Ông từng kiên quyết giữ thuyền chờ chủ tướng ở Bãi Tân và lặn đục thủng nhiều chiến thuyền giặc.',
    deed: 'Góp công lớn trong thủy chiến chống giặc Nguyên và giữ trọn lòng trung nghĩa.',
    quote: '“Chưa thấy Quốc công thì ta quyết không rời bến!”',
  },
  {
    key: 'tuong-nguyen-mong',
    name: 'Tướng quân Nguyên – Mông',
    shortName: 'Quân Nguyên',
    title: 'Đội quân xâm lược phương Bắc',
    era: '1258 · 1285 · 1287–1288',
    image: HALL_ART.tuongNguyenMong,
    backdrop: '#4a2318',
    accent: '#d96b38',
    bio: 'Đại diện cho các đạo quân xâm lược hùng mạnh của đế quốc Mông – Nguyên do Ngột Lương Hợp Thai, Thoát Hoan, Toa Đô và Ô Mã Nhi chỉ huy. Ba lần tiến đánh Đại Việt đều thất bại trước Hào khí Đông A.',
    deed: 'Đối thủ lịch sử giúp làm nổi bật ý chí tự cường và nghệ thuật quân sự Đại Việt.',
    quote: 'Kỵ binh và thủy binh hùng hậu nhưng không khuất phục được lòng dân Đại Việt.',
  },
];
