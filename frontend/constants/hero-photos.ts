/** Public-gallery photos only. Game portraits remain independent. See assets/hero-photos/ATTRIBUTION.md. */
import type { ImageSourcePropType } from 'react-native';

export type HeroPhotoInfo = {
  source: ImageSourcePropType;
  kind: string;
  caption: string;
  credit: string;
  sourceUrl: string;
  license?: string;
  licenseUrl?: string;
  note?: string;
};

export const HERO_PHOTOS: Readonly<Record<string, HeroPhotoInfo>> = {
  tran_thai_tong: {
    source: { uri: "https://i.ex-cdn.com/phatgiao.org.vn/files/content/2020/12/11/vua-tran-thai-tong-44-0838.jpg" },
    kind: "Ảnh tượng",
    caption: "Tượng vua Trần Thái Tông",
    credit: "Phatgiao.org.vn",
    sourceUrl: "https://phatgiao.org.vn/tu-tuong-thien-hoc-cua-duc-vua-tran-thai-tong-i-d44956.html",
  },
  tran_thu_do: {
    source: { uri: "https://nhn.1cdn.vn/2023/10/24/tran-thu-do-tuong.jpg" },
    kind: "Ảnh tượng",
    caption: "Tượng Thái sư Trần Thủ Độ",
    credit: "Tạp chí Người Hà Nội",
    sourceUrl: "https://nguoihanoi.vn/thai-su-tran-thu-do-nha-chinh-tri-kiet-xuat-nguoi-kien-lap-trieu-tran-78928.html",
  },
  le_phu_tran: {
    source: require('../assets/hero-photos/le_phu_tran.webp'),
    kind: "Ảnh bối cảnh",
    caption: "Sông Mã – tư liệu địa lý",
    credit: "Nga-Việt Nguyễn",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:SongMa.JPG",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
    note: "Ảnh bối cảnh sông Mã, không phải chân dung Lê Phụ Trần.",
  },
  thanh_duc: {
    source: require('../assets/hero-photos/thanh_duc.webp'),
    kind: "Tranh tư liệu",
    caption: "Quân cấm vệ trong tranh Trúc Lâm đại sĩ xuất sơn đồ",
    credit: "Khuyết danh",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Viet_royal_guards,_1100-1300.jpg",
    license: "Phạm vi công cộng",
    licenseUrl: "https://commons.wikimedia.org/wiki/Commons:Public_domain",
    note: "Tư liệu về quân cấm vệ; không xác định đây là một đơn vị Thánh Dực cụ thể.",
  },
  tran_nhan_tong: {
    source: require('../assets/hero-photos/tran_nhan_tong.webp'),
    kind: "Ảnh tượng",
    caption: "Tượng Giác Hoàng Trần Nhân Tông tại tháp Huệ Quang, Yên Tử",
    credit: "Bùi Thụy Đào Nguyên",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:T%C6%B0%E1%BB%A3ng_Gi%C3%A1c_Ho%C3%A0ng_Tr%E1%BA%A7n_Nh%C3%A2n_T%C3%B4ng.jpg",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0",
  },
  tran_hung_dao: {
    source: require('../assets/hero-photos/tran_hung_dao.webp'),
    kind: "Ảnh tượng",
    caption: "Tượng đồng Trần Hưng Đạo tại đền Kiếp Bạc",
    credit: "Khangoii",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:T%C6%B0%E1%BB%A3ng_%C4%91%E1%BB%93ng_Tr%E1%BA%A7n_H%C6%B0ng_%C4%90%E1%BA%A1o_t%E1%BA%A1i_%C4%91%E1%BB%81n_Ki%E1%BA%BFp_B%E1%BA%A1c.jpg",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
  },
  tran_quang_khai: {
    source: { uri: "https://cdn.giaoducthoidai.vn/images/e68bd0ae7e0a4d2e84e451c6db68f2d4f450dda65e2b7809274f02f2369ead8be5e76c9c94a85dc4b8d5c14fdffd833ea8904041fc31274acb4faf5c0a71469e/23.jpg.webp" },
    kind: "Ảnh tượng",
    caption: "Tượng Trần Quang Khải và công chúa Phụng Dương ở đền Cao Đài",
    credit: "Báo Giáo dục và Thời đại",
    sourceUrl: "https://giaoducthoidai.vn/hien-the-cua-danh-tuong-tran-quang-khai-post528104.html",
  },
  tran_binh_trong: {
    source: require('../assets/hero-photos/tran_binh_trong.webp'),
    kind: "Ảnh tượng",
    caption: "Ban thờ Trần Bình tướng quân tại đền thờ Đức Thánh Trần, Quận 1",
    credit: "Phương Huy",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:%C4%90%E1%BB%81n_th%E1%BB%9D_%C4%90%E1%BB%A9c_Th%C3%A1nh_Tr%E1%BA%A7n,_Qu%E1%BA%ADn_1,_th%C3%A1ng_12_n%C4%83m_2021_(ban_th%E1%BB%9D_Tr%E1%BA%A7n_B%C3%ACnh_t%C6%B0%E1%BB%9Bng_qu%C3%A2n)_(4).jpg",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
  },
  tran_nhat_duat: {
    source: { uri: "https://danviet.ex-cdn.com/files/f1/296231569849192448/2023/5/3/tran-nhat-duat-01-16831278987761618089189.jpeg" },
    kind: "Ảnh tượng",
    caption: "Tượng Chiêu Văn Vương Trần Nhật Duật",
    credit: "Báo Dân Việt",
    sourceUrl: "https://danviet.vn/vi-vuong-tu-nha-tran-nao-bi-su-gia-nha-nguyen-nham-la-nguoi-han-o-bac-kinh-20230503223616614-d1091472.html",
  },
  tran_quoc_toan: {
    source: require('../assets/hero-photos/tran_quoc_toan.webp'),
    kind: "Phù điêu",
    caption: "Phù điêu Trần Quốc Toản bóp cam tại Bảo tàng Lịch sử TP.HCM",
    credit: "Phương Huy",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:B%E1%BA%A3o_t%C3%A0ng_L%E1%BB%8Bch_s%E1%BB%AD_TP_(Ch%E1%BA%A1m_n%E1%BB%95i_Tr%E1%BA%A7n_Qu%E1%BB%91c_To%E1%BA%A3n_b%C3%B3p_cam)_(3).jpg",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
  },
  tran_khanh_du: {
    source: { uri: "https://media.baoquangninh.vn/upload/image/202306/medium/2091339_ban_tho_tran_khanh_du_trong_hau_cung_07074506.jpg" },
    kind: "Ảnh di tích",
    caption: "Ban thờ Trần Khánh Dư trong hậu cung nghè Quan Lạn",
    credit: "Báo Quảng Ninh",
    sourceUrl: "https://baoquangninh.vn/nghe-tho-tran-khanh-du-tren-dao-quan-lan-3243721.html",
  },
  yet_kieu: {
    source: { uri: "https://cdn-i.vtcnews.vn/resize/1200x675/upload/2026/01/23/5--den-tho-danh-tuong-yet-kieu-o-hai-phong-11290185.JPG" },
    kind: "Ảnh tượng",
    caption: "Tượng thờ danh tướng Yết Kiêu trong đền Quát",
    credit: "Báo Điện tử VTC News",
    sourceUrl: "https://vtcnews.vn/chiem-nguong-nhung-pho-tuong-co-doc-dao-trong-den-tho-danh-tuong-yet-kieu-ar999801.html",
  },
  pham_ngu_lao: {
    source: require('../assets/hero-photos/pham_ngu_lao.webp'),
    kind: "Ảnh tượng",
    caption: "Tượng đồng Phạm Ngũ Lão tại đền Kiếp Bạc",
    credit: "Khangoii",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:T%C6%B0%E1%BB%A3ng_%C4%91%E1%BB%93ng_Ph%E1%BA%A1m_Ng%C5%A9_L%C3%A3o_t%E1%BA%A1i_%C4%91%E1%BB%81n_Ki%E1%BA%BFp_B%E1%BA%A1c.jpg",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
  },
  quan_sat_that: {
    source: require('../assets/hero-photos/quan_sat_that.webp'),
    kind: "Tranh tư liệu",
    caption: "Võ quan Đại Việt trong tranh Trúc Lâm đại sĩ xuất sơn đồ",
    credit: "Khuyết danh",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Viet_military_officers,_1100-1300_AD.jpg",
    license: "Phạm vi công cộng",
    licenseUrl: "https://commons.wikimedia.org/wiki/Commons:Public_domain",
    note: "Tranh tư liệu về võ quan thời Trần, không phải chân dung một người lính Sát Thát cụ thể.",
  },
};
