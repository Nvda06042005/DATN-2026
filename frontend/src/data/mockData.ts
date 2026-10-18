import type { Student, BattleNode, ClassStats, AiDiagnosticAlert } from '../types/dashboard';

export const initialStudents: Student[] = [
  {
    id: 'hs-01',
    name: 'Nguyễn Văn Long',
    level: 3,
    role: 'Quân sư',
    roleTitle: 'Quân sư đại mưu',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    hp: 25,
    maxHp: 30,
    ap: 30,
    maxAp: 50,
    xp: 1450,
    maxXp: 2000,
    powerName: 'Thấu thị',
    powerDesc: 'Gợi ý 1 câu'
  },
  {
    id: 'hs-02',
    name: 'Trần Đức Anh',
    level: 2,
    role: 'Thủy binh',
    roleTitle: 'Thủy binh Vạn Kiếp',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
    hp: 30,
    maxHp: 30,
    ap: 50,
    maxAp: 50,
    xp: 980,
    maxXp: 1500,
    powerName: 'Khiên sóng',
    powerDesc: '+1 mạng'
  },
  {
    id: 'hs-03',
    name: 'Lê Minh Thư',
    level: 2,
    role: 'Tiên phong',
    roleTitle: 'Tiên phong quả cảm',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
    hp: 5,
    maxHp: 30,
    ap: 10,
    maxAp: 40,
    xp: 620,
    maxXp: 1500,
    powerName: 'Xung kích',
    powerDesc: 'Tăng 50% sát thương',
    isCritical: true,
    alertText: 'Sai liên tiếp 2 câu'
  },
  {
    id: 'hs-04',
    name: 'Vũ Hải Đăng',
    level: 3,
    role: 'Tiên phong',
    roleTitle: 'Tiên phong phá ải',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
    hp: 28,
    maxHp: 30,
    ap: 35,
    maxAp: 40,
    xp: 1320,
    maxXp: 2000,
    powerName: 'Hộ vệ',
    powerDesc: 'Giảm 30% mất máu'
  },
  {
    id: 'hs-05',
    name: 'Phạm Phương Thảo',
    level: 2,
    role: 'Quân sư',
    roleTitle: 'Quân sư biện tài',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&q=80',
    hp: 26,
    maxHp: 30,
    ap: 45,
    maxAp: 50,
    xp: 1100,
    maxXp: 1500,
    powerName: 'Mượn gió đông',
    powerDesc: 'Loại 2 phương án sai'
  },
  {
    id: 'hs-06',
    name: 'Đỗ Hoàng Nam',
    level: 2,
    role: 'Thủy binh',
    roleTitle: 'Thủy binh Bạch Đằng',
    avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=150&q=80',
    hp: 24,
    maxHp: 30,
    ap: 30,
    maxAp: 50,
    xp: 890,
    maxXp: 1500,
    powerName: 'Lặn sâu',
    powerDesc: 'Ẩn mình 1 lượt'
  }
];

export const battleNodes: BattleNode[] = [
  {
    id: 'node-01',
    number: 1,
    name: 'Ải 1: Bình Than',
    stars: 3,
    statusText: 'Đã toàn thắng',
    status: 'completed'
  },
  {
    id: 'node-02',
    number: 2,
    name: 'Ải 2: Vạn Kiếp',
    stars: 3,
    percentage: 85,
    statusText: '85% công phá',
    status: 'in_progress'
  },
  {
    id: 'node-03',
    number: 3,
    name: 'Ải 3: Chương Dương',
    statusText: 'ẢI QUYẾT CHIẾN • Sẵn sàng mở',
    status: 'active'
  },
  {
    id: 'node-04',
    number: 4,
    name: 'Ải 4: Thăng Long',
    statusText: 'Cần hoàn thành Ải 3',
    status: 'locked'
  }
];

export const classStats: ClassStats = {
  classCode: '#7A1-DONG-A-1285',
  className: 'Lớp 7A1',
  campaignTitle: 'Kháng chiến chống Mông - Nguyên (1285)',
  campaignPasscode: 'Lớp 7A1 - Kháng chiến 1285',
  totalStudents: 35,
  activeStudents: 32,
  averageMorale: 85,
  topStudent: {
    name: 'Nguyễn Văn Long',
    title: 'Điểm cao nhất lớp (Top 1)',
    xp: 1450,
    streak: 6,
    rank: 1
  }
};

export const aiDiagnosticAlert: AiDiagnosticAlert = {
  id: 'alert-01',
  title: 'Lỗ hổng kiến thức số 1 (75% nhầm lẫn)',
  description: 'Học sinh đang nhầm lẫn giữa Hội nghị Bình Than (1282 – Quả cam vua ban) và Hội nghị Diên Hồng (1285 – Các bô lão đồng thanh đánh).',
  misconceptionRate: 75,
  citationDoc: 'SGK Lịch sử & Địa lí 7 (Kết nối tri thức)',
  citationPage: 68,
  suggestedPrompt: 'Phân tích sự khác biệt về thành phần và mục đích giữa Hội nghị Bình Than (1282) và Hội nghị Diên Hồng (1285).'
};
