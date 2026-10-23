type LivePhase = 'lobby' | 'question' | 'reveal' | 'scoreboard' | 'podium';

export type LiveKey = number | boolean | string;

/** replaced: phòng đang mở ở tab/thiết bị khác; expired: phiên đăng nhập hết hạn */
export type LiveStatus = 'connecting' | 'open' | 'reconnecting' | 'replaced' | 'expired';

interface LiveOption {
  key: LiveKey;
  text: string;
}

export interface LiveQuestion {
  id: string;
  type: 'mcq' | 'tf';
  prompt: string;
  topic: string;
  options: LiveOption[];
}

interface LiveBase {
  pin: string;
  title: string;
  phase: LivePhase;
  index: number;
  total: number;
  duration_ms: number;
  remaining_ms: number;
  question: LiveQuestion | null;
}

export interface LiveHostPlayer {
  id: number;
  name: string;
  score: number;
  streak: number;
  correct: number;
  connected: boolean;
  answered: boolean;
  last_gain: number;
  last_correct: boolean | null;
}

export interface LiveHostRoom extends LiveBase {
  scope: string;
  class_name: string;
  locked: boolean;
  answered: number;
  players: LiveHostPlayer[];
  reveal: { key: LiveKey; counts: number[]; explanation: string; source?: string | null } | null;
  saved: boolean;
  session_id: number | null;
}

export interface LivePlayerState extends LiveBase {
  players: number;
  host_online: boolean;
  me: {
    name: string;
    score: number;
    rank: number;
    streak: number;
    correct: number;
    answered_total: number;
    answered: boolean;
    choice: LiveKey | null;
    last_gain: number;
    last_correct: boolean | null;
  };
  reveal: { key: LiveKey; explanation: string } | null;
  top: Array<{ name: string; score: number }>;
}

export type LiveServerMsg =
  | { type: 'room'; room: LiveHostRoom | null; closed?: string }
  | { type: 'state'; state: LivePlayerState | null }
  | { type: 'error'; code: string; message: string }
  | { type: 'kicked' }
  | { type: 'replaced' }
  | { type: 'closed'; reason: string }
  | { type: 'saved'; session_id: number | null }
  | { type: 'pong' };
