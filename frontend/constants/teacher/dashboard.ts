import type { TodoTask } from '@/types/teacherType';

export const initialTodoTasks: TodoTask[] = [
  {
    id: '1',
    title: 'Xem báo cáo cho Bài 13: Ba lần kháng chiến chống quân Mông - Nguyên',
    description: 'Kiểm tra kết quả làm bài của lớp 7A1 để đánh giá mức độ hiểu bài của học sinh.',
    category: 'report',
    status: 'active',
    actionLabel: 'Xem báo cáo',
    actionType: 'report',
  },
  {
    id: '2',
    title: 'Khám phá 3 câu hỏi trắc nghiệm AI đề xuất cho lớp 7A1',
    description: 'Phân biệt Hội nghị Bình Than (1282 - Quả cam vua ban) và Hội nghị Diên Hồng (1285 - Tiếng hô Đánh).',
    category: 'ai',
    status: 'active',
    actionLabel: 'Tạo trắc nghiệm AI',
    actionType: 'ai',
  },
  {
    id: '3',
    title: 'Chuẩn bị bài giảng Chặng Chương Dương Độ (Năm 1285)',
    description: 'Xem trước 10 câu hỏi trắc nghiệm và tư liệu chiến thuật phản công mùa hè năm 1285.',
    category: 'lesson',
    status: 'active',
    actionLabel: 'Bắt đầu bài giảng',
    actionType: 'lesson',
  },
  {
    id: '4',
    title: 'Xuất bảng điểm lớp 7A1 định dạng Excel (.xlsx)',
    description: 'Tải file tổng kết tiến độ học tập của cả lớp (mở được bằng Excel).',
    category: 'excel',
    status: 'active',
    actionLabel: 'Xuất Excel',
    actionType: 'excel',
  },
  {
    id: '5',
    title: 'Tạo câu chuyện học liệu tương tác về Hưng Đạo Đại Vương',
    description: 'Xây dựng câu chuyện đa phương tiện với hình ảnh và tư liệu lịch sử Đông A.',
    category: 'assignment',
    status: 'active',
    actionLabel: 'Tạo câu chuyện',
    actionType: 'library',
  },
  {
    id: '6',
    title: 'Gửi thông báo ôn tập tuần tới cả lớp',
    description: 'Gửi đường link ôn tập và lịch kiểm tra 15 phút tuần này đến phụ huynh và học sinh.',
    category: 'assignment',
    status: 'active',
    actionLabel: 'Gửi thông báo',
    actionType: 'profile',
  },
  {
    id: '7',
    title: 'Cập nhật hồ sơ',
    description: 'Hoàn thiện thông tin còn thiếu trên hồ sơ của bạn.',
    category: 'profile',
    status: 'completed',
    actionLabel: 'Cập nhật',
    actionType: 'profile',
  },
];

export const DEFAULT_LESSON = 'Bài 14 (KNTT): Ba lần kháng chiến chống quân xâm lược Mông - Nguyên';

export const COURSE_STAGE_NAMES = ['Màn 1 – Kháng chiến lần thứ nhất (1258)', 'Màn 2 – Kháng chiến lần thứ hai (1285)', 'Màn 3 – Kháng chiến lần thứ ba (1287 – 1288)'];
