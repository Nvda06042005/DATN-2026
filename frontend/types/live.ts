/** Kiểu dữ liệu thi đấu trực tiếp (Sprint 8). Khớp với /api/live và các sự kiện Socket.IO (/api/live/ws). */
import type { PlayQuestion, QData, QType } from '@/types/learning';

export type LiveState = 'lobby' | 'question' | 'results' | 'ended';
export type LiveMode = 'solo' | 'team';
export type LiveAction = 'start' | 'next' | 'pause' | 'resume' | 'skip' | 'end';

export interface LivePlayerLite { id: number; nickname: string; avatar: string; team_id: number | null; team_name: string | null; online: boolean }
export interface LiveTop { rank: number; nickname: string; avatar: string; team_name: string | null; score: number; correct_count: number }
export interface LiveTeamRow { team_id: number; name: string; members: number; score: number; total: number; rank: number }
export interface LiveOption { id: string; text: string; correct: boolean; count: number }

export interface LiveQuestion {
  index: number; total: number; qtype: QType; seconds: number; points_max: number; paused: boolean; remaining_ms: number; deadline: number | null; view: PlayQuestion;
}
export interface LiveResults {
  index: number; qtype: QType; prompt: string; explanation: string | null; answer_key: QData; skipped: boolean; last: boolean;
  stats: { correct: number; wrong: number; none: number }; options: LiveOption[] | null; top: LiveTop[]; teams: LiveTeamRow[] | null;
}
export interface LiveFinal {
  podium: LiveTop[]; ended_early: boolean; played: number; teams: LiveTeamRow[] | null;
  ranking: Array<LiveTop & { answered_count: number; xp_awarded: number }>;
}
export interface LiveMe {
  player_id: number; nickname: string; avatar: string; team_id: number | null; team_name: string | null; score: number; rank: number | null; correct_count: number; answered_count: number;
  answered: boolean; xp_awarded: number; last: { correct: boolean; points: number; elapsed_ms: number | null } | null;
}
/** Trạng thái phòng thi do máy chủ gửi, riêng cho từng người xem */
export interface LiveView {
  server_now: number; role: 'host' | 'player';
  room: { id: number; title: string; mode: LiveMode; class_id: number; class_name: string; host_name: string | null; state: LiveState; q_index: number; total: number; paused: boolean; pin: string; created_at: string; ended_early: boolean };
  players: LivePlayerLite[]; player_count: number; answered: { count: number; online: number };
  question: LiveQuestion | null; results: LiveResults | null; final: LiveFinal | null; me: LiveMe | null;
  /** Chỉ có ở API của giáo viên: đường dẫn và mã QR (ảnh PNG dạng data URL) để học sinh vào phòng */
  join_url?: string; qr?: string;
}

export interface LiveRoomRow {
  id: number; title: string; mode: LiveMode; state: LiveState; total: number; q_index: number; created_at: string; started_at: string | null; ended_at: string | null; ended_early: boolean;
  pin: string | null; class_id: number; class_name: string; players: number; avg_score: number;
}
export interface LiveOpenRoom { id: number; title: string; mode: LiveMode; state: LiveState; total: number; class_name: string; host_name: string | null; players: number; joined: boolean }
export interface LiveLookup {
  room_id: number; title: string; class_name: string; mode: LiveMode; state: LiveState; total: number; host_name: string | null; mine: { id: number; nickname: string; avatar: string } | null; avatars: string[]; suggested: string;
}
export interface LiveMatch { id: number; title: string; mode: LiveMode; total: number; ended_at: string | null; q_index: number; ended_early: boolean; class_name: string; score: number; correct_count: number; answered_count: number; xp_awarded: number; rank: number; players: number }
export interface LiveReviewItem {
  index: number; qtype: QType; prompt: string; explanation: string | null; answer_key: QData; skipped: boolean; answered: boolean; my_answer: unknown; correct: boolean; points: number; elapsed_ms: number | null; class_correct_rate: number | null;
}
export interface LiveReview {
  room: { id: number; title: string; mode: LiveMode; ended_at: string | null; ended_early: boolean };
  summary: { score: number; correct_count: number; answered_count: number; xp_awarded: number; rank: number | null; players: number };
  items: LiveReviewItem[];
}
export interface LiveReport {
  room: { id: number; title: string; mode: LiveMode; state: LiveState; class_name: string; created_at: string; started_at: string | null; ended_at: string | null; ended_early: boolean; total: number; played: number };
  summary: { players: number; avg_score: number; participation_rate: number; skipped: number };
  hardest: { number: number; prompt: string; correct_rate: number | null } | null;
  questions: Array<{ index: number; number: number; qtype: QType; prompt: string; skipped: boolean; answered: number; correct: number; wrong: number; none: number; correct_rate: number | null; avg_seconds: number | null }>;
  players: Array<{ rank: number; nickname: string; full_name: string; user_code: string | null; team_name: string | null; score: number; correct_count: number; answered_count: number; accuracy: number; avg_seconds: number | null; xp_awarded: number }>;
  teams: LiveTeamRow[] | null;
}

export const LIVE_AVATARS = ['star', 'swords', 'shield', 'crown', 'flag', 'flame', 'book', 'scroll', 'gem', 'heart', 'target', 'trophy'] as const;
export const LIVE_STATE_TEXT: Record<LiveState, string> = { lobby: 'Phòng chờ', question: 'Đang thi', results: 'Xem kết quả câu', ended: 'Đã kết thúc' };
