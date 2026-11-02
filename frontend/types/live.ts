/** Kiểu dữ liệu thi đấu trực tiếp (Sprint 8 và ver0.2 Sprint 8: khóa phòng, chống tra cứu, đánh trùm). Khớp với /api/live và các sự kiện Socket.IO (/api/live/ws). */
import type { PlayQuestion, QData, QType } from '@/types/learning';

export type LiveState = 'lobby' | 'question' | 'results' | 'ended';
export type LiveMode = 'solo' | 'team' | 'boss';
export type LiveAction = 'start' | 'next' | 'pause' | 'resume' | 'skip' | 'end' | 'lock' | 'unlock';

export interface LivePlayerLite { id: number; nickname: string; avatar: string; team_id: number | null; team_name: string | null; online: boolean; tab_switches?: number }
export interface LiveTop { rank: number; nickname: string; avatar: string; team_name: string | null; score: number; correct_count: number }
export interface LiveTeamRow { team_id: number; name: string; members: number; score: number; total: number; rank: number }
export interface LiveOption { id: string; text: string; correct: boolean; count: number }

/** Đáp án trên thiết bị: `shape` là vị trí trên màn chiếu (0 ▲, 1 ◆, 2 ●, 3 ■); `text` vắng khi giáo viên ẩn nội dung trên thiết bị học sinh */
export interface LiveOptionView { id: string; text?: string; shape: number }
export type LiveQuestionView = Omit<PlayQuestion, 'options'> & { options?: LiveOptionView[]; hidden?: boolean; video_url?: string | null };
export interface LiveQuestion {
  index: number; total: number; qtype: QType; seconds: number; points_max: number; paused: boolean; remaining_ms: number; deadline: number | null; view: LiveQuestionView;
}
export interface BossHit { q: number; damage: number; wrong: number; hp: number; class_hp: number; top: Array<{ nickname: string; avatar: string; damage: number }> }
export interface BossView { key: string; name: string; max_hp: number | null; hp: number | null; class_max_hp: number | null; class_hp: number | null; outcome: 'win' | 'lose' | null }
export interface LiveRequest { id: number; full_name: string; user_code: string | null; created_at: string }
export interface LiveAlert { player_id: number; nickname: string; count: number }
export interface LiveTheme { bg?: string; music?: string }
export interface LiveResults {
  index: number; qtype: QType; prompt: string; explanation: string | null; answer_key: QData; skipped: boolean; last: boolean;
  stats: { correct: number; wrong: number; none: number }; options: LiveOption[] | null; top: LiveTop[]; teams: LiveTeamRow[] | null; boss_hit: BossHit | null;
}
export interface LiveFinal {
  podium: LiveTop[]; ended_early: boolean; played: number; teams: LiveTeamRow[] | null;
  ranking: Array<LiveTop & { answered_count: number; xp_awarded: number }>;
}
export interface LiveMe {
  player_id: number; nickname: string; avatar: string; team_id: number | null; team_name: string | null; score: number; rank: number | null; correct_count: number; answered_count: number;
  answered: boolean; xp_awarded: number; joined_q: number; last: { correct: boolean; points: number; elapsed_ms: number | null; damage: number } | null;
}
/** Trạng thái phòng thi do máy chủ gửi, riêng cho từng người xem */
export interface LiveView {
  server_now: number; role: 'host' | 'player';
  room: {
    id: number; title: string; mode: LiveMode; class_id: number; class_name: string; host_name: string | null; state: LiveState; q_index: number; total: number; paused: boolean; pin: string; created_at: string; ended_early: boolean;
    locked: boolean; auto_lock_seconds: number | null; profile_names: boolean; hide_on_device: boolean; shuffle_device: boolean; tab_alert: boolean; theme: LiveTheme;
  };
  boss: BossView | null;
  /** Chỉ giáo viên chủ phòng: yêu cầu vào phòng đã khóa và cảnh báo chuyển tab ở câu hiện tại */
  requests?: LiveRequest[]; alerts?: LiveAlert[];
  players: LivePlayerLite[]; player_count: number; answered: { count: number; online: number };
  question: LiveQuestion | null; results: LiveResults | null; final: LiveFinal | null; me: LiveMe | null;
  /** Chỉ có ở API của giáo viên: đường dẫn và mã QR (ảnh PNG dạng data URL) để học sinh vào phòng */
  join_url?: string; qr?: string;
}

export interface LiveRoomRow {
  id: number; title: string; mode: LiveMode; state: LiveState; total: number; q_index: number; created_at: string; started_at: string | null; ended_at: string | null; ended_early: boolean;
  pin: string | null; class_id: number; class_name: string; players: number; avg_score: number; locked?: boolean;
}
export interface LiveOpenRoom { id: number; title: string; mode: LiveMode; state: LiveState; total: number; class_name: string; host_name: string | null; players: number; joined: boolean; locked: boolean }
export interface LiveLookup {
  room_id: number; title: string; class_name: string; mode: LiveMode; state: LiveState; total: number; host_name: string | null; mine: { id: number; nickname: string; avatar: string } | null; avatars: string[]; suggested: string;
  profile_names: boolean; locked: boolean; request: { status: 'pending' | 'approved' | 'rejected' } | null;
}
export interface LiveMatch { id: number; title: string; mode: LiveMode; total: number; ended_at: string | null; q_index: number; ended_early: boolean; class_name: string; score: number; correct_count: number; answered_count: number; xp_awarded: number; rank: number; players: number }
export interface LiveReviewItem {
  index: number; qtype: QType; prompt: string; explanation: string | null; answer_key: QData; skipped: boolean; answered: boolean; my_answer: unknown; correct: boolean; points: number; elapsed_ms: number | null; class_correct_rate: number | null;
}
export interface LiveReview {
  room: { id: number; title: string; mode: LiveMode; ended_at: string | null; ended_early: boolean }; boss?: { name: string; outcome: 'win' | 'lose' | null } | null;
  summary: { score: number; correct_count: number; answered_count: number; xp_awarded: number; rank: number | null; players: number };
  items: LiveReviewItem[];
}
export interface LiveReport {
  room: { id: number; title: string; mode: LiveMode; state: LiveState; class_name: string; created_at: string; started_at: string | null; ended_at: string | null; ended_early: boolean; total: number; played: number };
  summary: { players: number; avg_score: number; participation_rate: number; skipped: number };
  hardest: { number: number; prompt: string; correct_rate: number | null } | null;
  questions: Array<{ index: number; number: number; qtype: QType; prompt: string; skipped: boolean; answered: number; correct: number; wrong: number; none: number; correct_rate: number | null; avg_seconds: number | null }>;
  players: Array<{ rank: number; nickname: string; full_name: string; user_code: string | null; team_name: string | null; score: number; correct_count: number; answered_count: number; accuracy: number; avg_seconds: number | null; xp_awarded: number; tab_switches: number; joined_q: number }>;
  teams: LiveTeamRow[] | null; removed: Array<{ nickname: string; full_name: string }>;
  boss: { name: string; max_hp: number | null; hp: number | null; class_max_hp: number | null; class_hp: number | null; outcome: 'win' | 'lose' | null; log: BossHit[] } | null;
}

export const LIVE_AVATARS = ['star', 'swords', 'shield', 'crown', 'flag', 'flame', 'book', 'scroll', 'gem', 'heart', 'target', 'trophy'] as const;
export interface BossOption { key: string; name: string }
export const LIVE_MODE_TEXT: Record<LiveMode, string> = { solo: 'Thi cá nhân', team: 'Thi theo đội', boss: 'Đánh trùm cả lớp' };
export const LIVE_STATE_TEXT: Record<LiveState, string> = { lobby: 'Phòng chờ', question: 'Đang thi', results: 'Xem kết quả câu', ended: 'Đã kết thúc' };
