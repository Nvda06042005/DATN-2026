/**
 * Câu hỏi thường gặp của Đông A: nguồn dữ liệu chung cho khối "Câu hỏi thường gặp" ở trang chủ (các mục có `home`) và trang đầy đủ /cau-hoi-thuong-gap.
 * Chỉ ghi điều có thật trong ứng dụng (xem README.md, AGENTS.md); phần lịch sử viết theo Wikipedia tiếng Việt.
 * Đoạn trả lời: chuỗi là một đoạn văn, mảng chuỗi là danh sách gạch đầu dòng.
 */
export type FaqParagraph = string | string[];

export interface FaqItem {
  id: string;
  q: string;
  a: FaqParagraph[];
  /** Có mặt trong khối rút gọn ở trang chủ (chỉ dùng đoạn văn, bỏ danh sách) */
  home?: boolean;
}

export interface FaqCategory {
  id: string;
  label: string;
  items: FaqItem[];
}

export interface FaqGroup {
  id: string;
  title: string;
  categories: FaqCategory[];
}

export const FAQ_GROUPS: FaqGroup[] = [
  {
    id: 've-dong-a',
    title: 'Về Đông A',
    categories: [
      {
        id: 'gioi-thieu-chung',
        label: 'Giới thiệu chung',
        items: [
          {
            id: 'dong-a-la-gi',
            q: 'Đông A là gì?',
            home: true,
            a: ['Đông A là nền tảng học tập game hóa về ba lần kháng chiến chống Nguyên – Mông thời Trần (1258, 1285 và 1287 – 1288), thuộc đề tài khóa luận tốt nghiệp. Học sinh vừa chơi vừa trả lời câu hỏi lịch sử để chiêu mộ danh tướng và vượt các màn chiến dịch.'],
          },
          {
            id: 'danh-cho-ai',
            q: 'Đông A dành cho ai?',
            a: [
              'Đông A có ba nhóm người dùng:',
              [
                'Học sinh: chơi game, hỏi Quân Sư AI và ôn tập theo mức nắm vững của mình.',
                'Giáo viên: lập lớp, theo dõi tiến độ cả lớp và mở phòng thi đấu bằng mã PIN.',
                'Nhà trường: cấp tài khoản hàng loạt bằng file Excel mẫu và quản lý tài khoản của trường.',
              ],
              'Nội dung xoay quanh bài học Lịch sử 7 về ba lần kháng chiến chống Nguyên – Mông; tài khoản học sinh được cấp cho khối 6 – 9.',
            ],
          },
          {
            id: 'thiet-bi',
            q: 'Chơi được trên thiết bị nào?',
            home: true,
            a: ['Đông A chạy trên trình duyệt web, điện thoại Android và iPhone, iPad.'],
          },
        ],
      },
      {
        id: 'nguon-noi-dung',
        label: 'Nguồn nội dung lịch sử',
        items: [
          {
            id: 'nguon-lich-su',
            q: 'Nội dung lịch sử lấy từ đâu?',
            home: true,
            a: ['Phần giới thiệu ba lần kháng chiến trên trang này viết theo Wikipedia tiếng Việt (bài “Chiến tranh Nguyên Mông – Đại Việt” và ba bài chi tiết lần 1, 2, 3). Trong game, mỗi nhân vật gắn nhãn nguồn gốc: chính sử, giai thoại – truyền thuyết, sáng tạo của game hoặc dân gian – cần đối chiếu.'],
          },
          {
            id: 'nhan-nguon-goc',
            q: 'Các nhãn “Chính sử”, “Giai thoại” có nghĩa là gì?',
            a: [
              'Mỗi nhân vật và nội dung trong game gắn một nhãn để học sinh phân biệt mức độ tin cậy:',
              [
                'Chính sử: có ghi trong sử sách.',
                'Giai thoại – truyền thuyết: chuyện kể lưu truyền, không có ghi chép chắc chắn.',
                'Sáng tạo của game: phần do game bổ sung để câu chuyện sinh động.',
                'Dân gian – cần đối chiếu: thông tin dân gian, cần đối chiếu thêm với sách sử.',
              ],
            ],
          },
          {
            id: 'so-quan',
            q: 'Vì sao số quân hai bên chỉ ghi “khoảng”?',
            a: ['Các nguồn sử chép số quân khác nhau, có nguồn tính cả dân phu. Vì vậy phần giới thiệu chỉ ghi số ước tính theo hộp thông tin của Wikipedia, kèm chữ “khoảng”.'],
          },
        ],
      },
    ],
  },
  {
    id: 'hoc-sinh',
    title: 'Dành cho học sinh',
    categories: [
      {
        id: 'hs-tai-khoan',
        label: 'Tài khoản và đăng nhập',
        items: [
          {
            id: 'lam-sao-co-tai-khoan',
            q: 'Làm sao để có tài khoản?',
            home: true,
            a: ['Tài khoản do nhà trường cấp: quản trị trường nhập file Excel mẫu, mật khẩu ban đầu được gửi qua thư điện tử và phải đổi ở lần đăng nhập đầu tiên.'],
          },
          {
            id: 'dang-nhap-o-dau',
            q: 'Đăng nhập ở đâu?',
            a: ['Bấm “Vào học ngay” ở đầu hoặc cuối trang chủ để vào cổng đăng nhập chung của giáo viên và học sinh, rồi nhập tên đăng nhập và mật khẩu nhà trường đã cấp.'],
          },
          {
            id: 'quen-mat-khau',
            q: 'Quên mật khẩu thì làm thế nào?',
            a: ['Nhờ quản trị viên của trường đặt lại mật khẩu tạm. Em đăng nhập bằng mật khẩu tạm đó rồi đặt mật khẩu mới; cửa sổ đặt mật khẩu không đóng được cho tới khi đổi xong.'],
          },
          {
            id: 'khoa-dang-nhap',
            q: 'Vì sao đăng nhập bị khóa một lúc?',
            a: ['Nhập sai mật khẩu 5 lần thì đăng nhập bị khóa 60 giây. Em chờ hết thời gian rồi thử lại.'],
          },
        ],
      },
      {
        id: 'hs-choi-hoc',
        label: 'Chơi và học',
        items: [
          {
            id: 'trong-game-co-gi',
            q: 'Trong game có những gì?',
            a: [
              'Game có năm khu chính:',
              [
                'Điền Trang: thu Lương Thảo từ ruộng, nâng cấp công trình bằng cách trả lời đúng một câu hỏi.',
                'Doanh Trại: 14 danh tướng theo năm hệ, tiến hóa theo từng giai đoạn cuộc đời.',
                'Chiến Dịch: 3 màn, mỗi màn 3 pha, đánh theo lượt 3 đấu 3.',
                'Quốc Tử Giám: thi đấu cả lớp, luyện nhanh, luyện theo chủ đề, Tháp Khảo Thí 10 tầng và ôn điểm yếu.',
                'Sử Ký: dòng thời gian trên lược đồ, thẻ tri thức và trò chuyện với Quân Sư AI.',
              ],
            ],
          },
          {
            id: 'hanh-trinh',
            q: 'Hành Trình Đông A là gì?',
            a: [
              'Hành Trình Đông A là thế giới pixel 2D gồm ba vùng đất mở dần: Làng Đông A (1258), Bến Bình Than – Vạn Kiếp (1282 – 1285) và cửa sông Bạch Đằng (1287 – 1288). Em đi lại bằng phím mũi tên hoặc WASD, nút điều hướng hay chạm vào chỗ muốn đến; gặp người dân nghe kể chuyện xưa, trả lời câu hỏi để làm nhiệm vụ và mở đường sang vùng mới.',
              'Nhân vật trong thế giới này là người hư cấu kể lại chuyện người thật.',
            ],
          },
          {
            id: 'diem-thuong',
            q: 'Điểm kinh nghiệm và Ấn Tín được tính thế nào?',
            a: ['Câu hỏi do máy chủ chọn và chấm. Điểm kinh nghiệm (XP) và Ấn Tín chỉ tăng khi em trả lời đúng, tối đa 300 Ấn Tín mỗi ngày.'],
          },
          {
            id: 'luu-tien-do',
            q: 'Tiến độ chơi có được lưu lại không?',
            a: ['Có. Trạng thái game tự lưu lên máy chủ, nên em có thể đăng nhập lại và tiếp tục chơi.'],
          },
        ],
      },
      {
        id: 'hs-ai',
        label: 'Quân Sư AI và ôn tập',
        items: [
          {
            id: 'quan-su-ai',
            q: 'Quân Sư AI trả lời dựa trên gì?',
            home: true,
            a: ['Quân Sư AI trả lời dựa trên kho kiến thức sử liệu của đề tài (truy xuất kiến thức rồi mới sinh câu trả lời). Khi cần, học sinh nên đối chiếu thêm với sách giáo khoa.'],
          },
          {
            id: 'hoi-ai-gi',
            q: 'Em có thể hỏi Quân Sư AI những gì?',
            a: ['Em hỏi về ba lần kháng chiến chống Nguyên – Mông, các danh tướng, trận đánh và sự kiện; câu trả lời có trích nguồn từ kho tri thức của đề tài. Quân Sư AI không thay thế sách giáo khoa và lời giảng của thầy cô.'],
          },
          {
            id: 'on-diem-yeu',
            q: 'Hệ thống biết em còn yếu ở đâu bằng cách nào?',
            a: ['Mỗi lần trả lời, hệ thống ghi nhận mức nắm vững từng kiến thức của em (theo mô hình Bayesian Knowledge Tracing, viết tắt là BKT) rồi gợi ý ôn lại phần còn yếu trong mục Quốc Tử Giám.'],
          },
        ],
      },
    ],
  },
  {
    id: 'giao-vien',
    title: 'Dành cho giáo viên',
    categories: [
      {
        id: 'gv-lop',
        label: 'Lớp học',
        items: [
          {
            id: 'mo-lop',
            q: 'Làm sao để mở lớp?',
            a: [
              'Giáo viên gửi yêu cầu mở lớp gồm mã lớp, năm học, tên lớp và mật khẩu lớp. Yêu cầu ở trạng thái chờ cho tới khi quản trị trường duyệt hoặc từ chối.',
              'Kết quả được báo cho giáo viên trong ứng dụng (biểu tượng chuông) và qua thư điện tử.',
            ],
          },
          {
            id: 'hs-vao-lop',
            q: 'Học sinh vào lớp bằng cách nào?',
            a: ['Học sinh nhập mã lớp và mật khẩu lớp ở mục Hồ sơ trong game.'],
          },
        ],
      },
      {
        id: 'gv-thi-dau',
        label: 'Theo dõi và thi đấu',
        items: [
          {
            id: 'theo-doi',
            q: 'Giáo viên theo dõi được những gì?',
            a: ['Tiến độ của cả lớp, những câu hỏi sai nhiều nhất và mức nắm vững của từng em trên một màn hình.'],
          },
          {
            id: 'thi-dau',
            q: 'Thi đấu cả lớp diễn ra thế nào?',
            a: [
              'Giáo viên mở phòng, chọn 5, 10 hoặc 15 câu và phạm vi từng lần kháng chiến, rồi đọc mã PIN. Học sinh cùng lớp vào bằng mã PIN hoặc đường dẫn có sẵn mã.',
              'Mỗi câu 20 giây, điểm tính theo tốc độ và chuỗi câu đúng. Mỗi câu trả lời cũng được cộng vào tiến độ học thật của em, và trận đấu được lưu vào lịch sử lớp. Nếu mất mạng, em tự vào lại đúng phòng.',
            ],
          },
          {
            id: 'soan-de',
            q: 'Có thể nhờ AI soạn đề không?',
            a: ['Có. Giáo viên có thể nhờ Quân Sư AI soạn nhanh câu hỏi ôn tập từ kho kiến thức của đề tài, và nên đọc lại trước khi dùng.'],
          },
        ],
      },
    ],
  },
  {
    id: 'nha-truong',
    title: 'Dành cho nhà trường',
    categories: [
      {
        id: 'nt-tai-khoan',
        label: 'Cấp tài khoản',
        items: [
          {
            id: 'cap-hang-loat',
            q: 'Cấp tài khoản hàng loạt như thế nào?',
            a: [
              'Quản trị trường tải file Excel mẫu trong trang quản lý (nút “Tải file mẫu”), điền danh sách giáo viên và học sinh rồi nhập lại vào hệ thống. Hệ thống tạo tài khoản và gửi thông tin đăng nhập qua thư điện tử.',
              'Mẫu có 11 cột: mã số người dùng, trường, mã số trường, khu vực, thành phố, tên, ngày sinh, năm học, email, khối (6 – 9) và vai trò (giáo viên hoặc học sinh).',
            ],
          },
          {
            id: 'gioi-han-file',
            q: 'File nhập cần đáp ứng điều kiện nào?',
            a: [
              'Chỉ nhận file .xlsx tạo từ mẫu của hệ thống, tối đa 2 MB và 1.000 dòng, không có macro.',
              'File tự tạo hoặc file bị thêm, xóa, đổi tên, đổi thứ tự cột hay thêm trang sẽ bị từ chối.',
            ],
          },
          {
            id: 'dong-thieu',
            q: 'Dòng thiếu thông tin thì xử lý ra sao?',
            a: ['Dòng thiếu thông tin chưa được cấp tài khoản. Sau khi bổ sung, nhập lại cùng file: hệ thống chỉ cấp tài khoản và gửi thư cho những dòng vừa đủ thông tin, người đã có tài khoản không nhận lại thư.'],
          },
          {
            id: 'xoa-nham',
            q: 'Xóa nhầm tài khoản có khôi phục được không?',
            a: ['Có. Tài khoản bị xóa nằm trong thùng rác 45 ngày (không đăng nhập được trong thời gian này) và có thể khôi phục; sau đó được xóa vĩnh viễn.'],
          },
        ],
      },
      {
        id: 'nt-bao-mat',
        label: 'Dữ liệu và bảo mật',
        items: [
          {
            id: 'tach-du-lieu',
            q: 'Dữ liệu của trường có được tách riêng không?',
            home: true,
            a: ['Có. Mỗi trường chỉ thấy dữ liệu của mình nhờ phân quyền ngay ở tầng cơ sở dữ liệu. Tài khoản bị xóa nhầm vẫn khôi phục được trong 45 ngày trước khi xóa vĩnh viễn.'],
          },
          {
            id: 'bao-ve-mat-khau',
            q: 'Mật khẩu được bảo vệ ra sao?',
            a: ['Mật khẩu được băm bằng thuật toán PBKDF2-SHA256 kèm muối ngẫu nhiên; hệ thống không lưu mật khẩu gốc và không bao giờ trả mật khẩu về giao diện. Lần đăng nhập đầu bằng mật khẩu được cấp, người dùng bắt buộc đặt mật khẩu mới.'],
          },
          {
            id: 'phien-dang-nhap',
            q: 'Phiên đăng nhập kéo dài bao lâu?',
            a: ['Phiên đăng nhập hết hạn sau 12 giờ, và mất hiệu lực ngay khi mật khẩu bị đổi hoặc tài khoản bị khóa, bị xóa.'],
          },
        ],
      },
    ],
  },
];

/** Thứ tự các câu hiện ở khối rút gọn ở trang chủ; câu trả lời lấy đoạn văn của mục tương ứng */
const HOME_ORDER = ['dong-a-la-gi', 'lam-sao-co-tai-khoan', 'nguon-lich-su', 'quan-su-ai', 'thiet-bi', 'tach-du-lieu'];

const ALL_ITEMS = FAQ_GROUPS.flatMap((g) => g.categories.flatMap((c) => c.items));

export const FAQ_HOME: Array<{ q: string; a: string }> = HOME_ORDER.map((id) => {
  const item = ALL_ITEMS.find((i) => i.id === id && i.home);
  if (!item) throw new Error(`FAQ trang chủ thiếu mục ${id}`);
  return { q: item.q, a: item.a.filter((p): p is string => typeof p === 'string').join(' ') };
});

/** Mọi danh mục theo thứ tự trên trang, kèm nhóm của nó */
export const FAQ_CATEGORIES = FAQ_GROUPS.flatMap((g) => g.categories.map((c) => ({ ...c, groupId: g.id, groupTitle: g.title })));
