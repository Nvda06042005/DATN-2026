/**
 * Nội dung trang "Điều khoản sử dụng" (/dieu-khoan-su-dung): điều khoản và chính sách quyền riêng tư của Đông A, cùng dạng dữ liệu với constants/faq.ts
 * (nhóm → mục → các câu; chuỗi là một đoạn văn, mảng chuỗi là danh sách gạch đầu dòng).
 * Chỉ ghi điều có thật trong ứng dụng (xem README.md, AGENTS.md và mã backend); khi thay đổi cách thu thập hay xử lý dữ liệu thì sửa lại đây
 * và cập nhật TERMS_UPDATED. Đây là văn bản mô tả của đề tài, không phải tư vấn pháp lý.
 */
import type { FaqGroup } from '@/constants/faq';

export const TERMS_UPDATED = '29/10/2026';

export const TERMS_GROUPS: FaqGroup[] = [
  {
    id: 'dieu-khoan',
    title: 'Điều khoản sử dụng',
    categories: [
      {
        id: 'dk-gioi-thieu',
        label: 'Giới thiệu chung',
        items: [
          {
            id: 'ap-dung',
            q: 'Điều khoản này áp dụng cho ai?',
            a: [
              'Điều khoản áp dụng cho học sinh, giáo viên và quản trị viên nhà trường sử dụng Đông A: nền tảng học tập game hóa về ba lần kháng chiến chống Nguyên – Mông thời Trần, thuộc đề tài khóa luận tốt nghiệp và dùng cho mục đích học tập, nghiên cứu.',
              'Khi đăng nhập và sử dụng Đông A, người dùng đồng ý với các điều khoản dưới đây.',
            ],
          },
          {
            id: 'thay-doi',
            q: 'Điều khoản có thay đổi không?',
            a: ['Điều khoản có thể thay đổi khi ứng dụng được cập nhật. Phiên bản mới nhất luôn được đăng tại trang này, kèm ngày cập nhật lần cuối.'],
          },
        ],
      },
      {
        id: 'dk-tai-khoan',
        label: 'Tài khoản và mật khẩu',
        items: [
          {
            id: 'ai-duoc-cap',
            q: 'Ai được cấp tài khoản?',
            a: ['Tài khoản do nhà trường cấp cho giáo viên và học sinh (khối 6 – 9) qua file Excel mẫu; người dùng không tự đăng ký. Mỗi tài khoản gắn với một trường và một vai trò: học sinh, giáo viên hoặc quản trị viên.'],
          },
          {
            id: 'giu-mat-khau',
            q: 'Người dùng cần giữ mật khẩu như thế nào?',
            a: [
              'Mật khẩu ban đầu được gửi qua thư điện tử và phải đổi ở lần đăng nhập đầu tiên. Người dùng cần:',
              [
                'giữ bí mật mật khẩu, không chia sẻ cho người khác;',
                'không dùng tài khoản của người khác;',
                'báo ngay cho quản trị viên của trường nếu nghi ngờ mật khẩu bị lộ để được đặt lại mật khẩu tạm.',
              ],
            ],
          },
          {
            id: 'khoa-xoa',
            q: 'Khi nào tài khoản bị khóa hoặc xóa?',
            a: [
              'Nhập sai mật khẩu 5 lần thì đăng nhập bị khóa 60 giây. Quản trị viên của trường có thể khóa hoặc xóa tài khoản khi cần.',
              'Tài khoản bị xóa nằm trong thùng rác 45 ngày và có thể khôi phục; sau đó bị xóa vĩnh viễn.',
            ],
          },
        ],
      },
      {
        id: 'dk-quy-tac',
        label: 'Quy tắc sử dụng',
        items: [
          {
            id: 'su-dung-dung',
            q: 'Người dùng nên sử dụng Đông A như thế nào?',
            a: [
              'Đông A dành cho việc học và dạy Lịch sử. Người dùng không được:',
              [
                'cố tình truy cập trái phép, thăm dò lỗ hổng hoặc làm quá tải hệ thống;',
                'dùng công cụ tự động hoặc khai thác lỗi để tăng điểm, Ấn Tín hay thứ hạng;',
                'nhập nội dung xúc phạm hoặc thông tin cá nhân của người khác vào ô hỏi và các ô nhập khác.',
              ],
            ],
          },
          {
            id: 'vi-pham',
            q: 'Điều gì xảy ra nếu vi phạm?',
            a: ['Quản trị viên của trường có thể khóa hoặc xóa tài khoản vi phạm.'],
          },
        ],
      },
      {
        id: 'dk-noi-dung',
        label: 'Nội dung và Quân Sư AI',
        items: [
          {
            id: 'noi-dung-lich-su',
            q: 'Nội dung lịch sử có hoàn toàn chính xác không?',
            a: [
              'Phần giới thiệu ba lần kháng chiến viết theo Wikipedia tiếng Việt (bài “Chiến tranh Nguyên Mông – Đại Việt” và ba bài chi tiết lần 1, 2, 3) và dữ liệu của đề tài; số quân là ước tính, các nguồn chép khác nhau. Mỗi nhân vật gắn nhãn nguồn gốc (chính sử, giai thoại – truyền thuyết, sáng tạo của game, dân gian – cần đối chiếu).',
              'Nội dung có thể còn sai sót. Khi cần chắc chắn, hãy đối chiếu với sách giáo khoa và lời giảng của thầy cô.',
            ],
          },
          {
            id: 'tin-cay-ai',
            q: 'Câu trả lời của Quân Sư AI có đáng tin không?',
            a: ['Quân Sư AI trả lời dựa trên kho kiến thức của đề tài nhưng vẫn có thể thiếu hoặc sai. Câu trả lời chỉ để tham khảo, không thay thế sách giáo khoa và lời giảng của thầy cô; giáo viên nên đọc lại câu hỏi do AI soạn trước khi dùng trong lớp.'],
          },
          {
            id: 'hinh-anh',
            q: 'Hình ảnh và bản đồ lấy từ đâu?',
            a: ['Tranh danh tướng là tranh minh họa cách điệu, không phải chân dung đương thời. Bản đồ ba cuộc kháng chiến lấy từ Wikimedia Commons (tác giả Lưu Ly, phạm vi công cộng). Tác giả, nguồn và giấy phép của các hình ảnh có nguồn được ghi ở trang “Thông tin hình ảnh”.'],
          },
          {
            id: 'gian-doan',
            q: 'Dịch vụ có thể bị gián đoạn không?',
            a: ['Có. Dịch vụ có thể chậm hoặc tạm ngừng khi bảo trì, cập nhật hoặc quá tải. Trạng thái game được lưu lên máy chủ sau mỗi lần trả lời đúng nên tiến độ đã có không bị mất khi em đăng nhập lại.'],
          },
        ],
      },
    ],
  },
  {
    id: 'bao-mat',
    title: 'Quyền riêng tư và bảo mật',
    categories: [
      {
        id: 'bm-thu-thap',
        label: 'Thông tin được thu thập',
        items: [
          {
            id: 'thu-thap',
            q: 'Đông A thu thập những thông tin nào?',
            a: [
              'Đông A chỉ lưu những thông tin cần cho việc học và quản lý lớp:',
              [
                'Thông tin tài khoản do nhà trường cung cấp: họ tên, ngày sinh, email, trường, mã số trường, khu vực, thành phố, khối, năm học và vai trò.',
                'Dữ liệu học tập: tiến độ game, câu trả lời, điểm kinh nghiệm, Ấn Tín và mức nắm vững từng kiến thức.',
                'Dữ liệu lớp học: mã lớp, kết quả các trận thi đấu cả lớp.',
              ],
            ],
          },
        ],
      },
      {
        id: 'bm-muc-dich',
        label: 'Mục đích sử dụng',
        items: [
          {
            id: 'muc-dich',
            q: 'Thông tin được dùng để làm gì?',
            a: [
              [
                'Tạo và quản lý tài khoản, gửi thư thông tin đăng nhập và thông báo duyệt lớp.',
                'Lưu tiến độ, chấm điểm, gợi ý ôn lại phần còn yếu.',
                'Giúp giáo viên theo dõi tiến độ và mức nắm vững của lớp mình.',
              ],
            ],
          },
          {
            id: 'ai-xem',
            q: 'Ai xem được dữ liệu của em?',
            a: [
              [
                'Chính em: thấy dữ liệu học tập của mình.',
                'Giáo viên: thấy tiến độ và mức nắm vững của học sinh trong lớp mình.',
                'Quản trị viên trường: thấy dữ liệu của trường mình.',
                'Quản trị tổng: thấy dữ liệu toàn hệ thống để vận hành.',
              ],
              'Người dùng của một trường không thấy dữ liệu của trường khác.',
            ],
          },
        ],
      },
      {
        id: 'bm-bao-ve',
        label: 'Bảo vệ dữ liệu',
        items: [
          {
            id: 'bao-ve',
            q: 'Dữ liệu được bảo vệ như thế nào?',
            a: [
              [
                'Mật khẩu được băm bằng PBKDF2-SHA256 kèm muối ngẫu nhiên; hệ thống không lưu mật khẩu gốc và không trả mật khẩu về giao diện.',
                'Dữ liệu được tách theo trường bằng phân quyền ngay ở tầng cơ sở dữ liệu (Row-Level Security).',
                'Nội dung thư thông tin đăng nhập được mã hóa khi chờ gửi và xóa sau khi gửi.',
                'Phiên đăng nhập hết hạn sau 12 giờ, và mất hiệu lực ngay khi mật khẩu bị đổi hoặc tài khoản bị khóa, bị xóa.',
              ],
            ],
          },
        ],
      },
      {
        id: 'bm-ben-thu-ba',
        label: 'Dịch vụ bên thứ ba',
        items: [
          {
            id: 'ai-ben-ngoai',
            q: 'Quân Sư AI có gửi dữ liệu ra ngoài không?',
            a: [
              'Có. Nội dung em nhập vào ô hỏi, cùng kiến thức liên quan lấy từ kho tri thức của đề tài, được gửi tới dịch vụ mô hình ngôn ngữ bên ngoài (Google Gemini, hoặc Hugging Face khi dự phòng) để tạo câu trả lời.',
              'Vì vậy em không nên nhập họ tên, số điện thoại, địa chỉ hay thông tin cá nhân khác vào ô hỏi.',
            ],
          },
          {
            id: 'ha-tang',
            q: 'Đông A chạy trên những dịch vụ nào?',
            a: ['Giao diện web chạy trên Vercel, máy chủ trên Render và cơ sở dữ liệu PostgreSQL trên Supabase. Thư thông tin đăng nhập được gửi qua dịch vụ gửi thư điện tử (SMTP) do nhà vận hành cấu hình.'],
          },
        ],
      },
      {
        id: 'bm-quyen',
        label: 'Quyền của người dùng',
        items: [
          {
            id: 'sua-xoa',
            q: 'Em muốn sửa hoặc xóa thông tin thì làm sao?',
            a: ['Hãy nhờ quản trị viên của trường: họ có thể sửa thông tin tài khoản, đặt lại mật khẩu tạm hoặc xóa tài khoản. Khi tài khoản bị xóa vĩnh viễn, tiến độ học và kết quả thi đấu của tài khoản đó cũng bị xóa.'],
          },
          {
            id: 'luu-tru',
            q: 'Dữ liệu được giữ bao lâu?',
            a: ['Dữ liệu được giữ khi tài khoản còn hoạt động. Tài khoản bị xóa nằm trong thùng rác 45 ngày rồi bị xóa vĩnh viễn lúc 00:00 giờ Việt Nam.'],
          },
        ],
      },
    ],
  },
];

/** Mọi danh mục theo thứ tự trên trang, kèm nhóm của nó */
export const TERMS_CATEGORIES = TERMS_GROUPS.flatMap((g) => g.categories.map((c) => ({ ...c, groupId: g.id, groupTitle: g.title })));
