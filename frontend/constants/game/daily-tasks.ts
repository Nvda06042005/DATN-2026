import { Landmark, MessageSquare, ScrollText, Stamp, Swords, Wheat } from 'lucide-react';
import type { DailyTaskDef } from '@/types/gameType';

export const DAILY_TASKS: DailyTaskDef[] = [
  { id: 'harvest', text: 'Thu hoạch Ruộng Ngụ Binh', target: 1, metric: 'harvest', reward: { luong: 40, quan: 3 }, Icon: Wheat },
  { id: 'correct5', text: 'Trả lời đúng 5 câu', target: 5, metric: 'correct', reward: { luong: 60, quan: 4 }, Icon: Stamp },
  { id: 'session', text: 'Hoàn thành 1 lượt khảo thí', target: 1, metric: 'session', reward: { luong: 50, quan: 3 }, Icon: Landmark },
  { id: 'battle', text: 'Đánh 1 trận chiến dịch', target: 1, metric: 'battle', reward: { luong: 60, quan: 5 }, Icon: Swords },
  { id: 'codex', text: 'Đọc 1 thẻ Sử Ký', target: 1, metric: 'codex', reward: { luong: 30, quan: 2 }, Icon: ScrollText },
  { id: 'ask', text: 'Hỏi Quân Sư 1 câu', target: 1, metric: 'ask', reward: { luong: 30, quan: 2 }, Icon: MessageSquare },
];
