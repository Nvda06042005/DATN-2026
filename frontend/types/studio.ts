/** Kiểu dữ liệu trình soạn Quiz kiểu Kahoot (HK.GV.085–094). Khớp với backend/src/content/studio.service.ts và /api/content/studio, /api/content/media. */
import type { QuizDetail } from '@/types/learning';

/** `poll`: bình chọn không có đáp án đúng (HK.GV.088); chỉ dùng khi thi đấu trực tiếp */
export type StudioQType = 'single' | 'multiple' | 'truefalse' | 'poll';
export type ScoreMode = 'standard' | 'double' | 'none';

export interface StudioQuestion {
  uid: string; question_id: number | null; qtype: StudioQType; prompt: string;
  /** Bốn ô đáp án theo thứ tự ▲ ◆ ● ■ */
  options: string[]; correct: number[]; tf: boolean; seconds: number; score_mode: ScoreMode; image_url: string | null; video_url: string | null; explanation: string;
}
export interface StudioPayload {
  title: string; description: string; cover_url: string | null; theme: { bg: string; music: string; music_url?: string }; campaign_id: number | null; shuffle_questions: boolean; shuffle_options: boolean; questions: StudioQuestion[];
}
export interface StudioDraft { id: number; quiz_id: number | null; updated_at: string; payload: StudioPayload }
export interface StudioListItem { id: number; quiz_id: number | null; title: string; questions: number; updated_at: string }
export interface UploadedFile { token: string; name: string | null; url: string; mime: string; size_bytes: number }
export interface MediaLibrary {
  uploads: UploadedFile[];
  /** Video và nhạc tải lên (HK.GV.092, 093) */
  videos: UploadedFile[]; audios: UploadedFile[];
  library: Array<{ kind: 'source' | 'figure' | 'place' | 'campaign'; id: number; title: string; url: string }>;
}
export type CommitResult = { quiz: QuizDetail; draft: { id: number; quiz_id: number; payload: StudioPayload } };

export const STUDIO_SECONDS = [5, 10, 20, 30, 60, 90, 120] as const;
export const SCORE_TEXT: Record<ScoreMode, string> = { standard: 'Tiêu chuẩn (1000 điểm)', double: 'Gấp đôi (2000 điểm)', none: 'Không tính điểm' };
export const SOURCE_KIND_TEXT: Record<string, string> = { source: 'Tư liệu', figure: 'Nhân vật', place: 'Địa danh', campaign: 'Cuộc kháng chiến' };

let counter = 0;
export const newUid = (): string => `q${Date.now().toString(36)}${(counter++).toString(36)}`;
export const blankQuestion = (): StudioQuestion => ({
  uid: newUid(), question_id: null, qtype: 'single', prompt: '', options: ['', '', '', ''], correct: [0], tf: true, seconds: 20, score_mode: 'standard', image_url: null, video_url: null, explanation: '',
});

/** Lý do câu chưa đủ điều kiện lưu (hiện cạnh câu trong danh sách), hoặc null nếu ổn */
export function problemOf(q: StudioQuestion): string | null {
  if (q.prompt.trim().length < 3) return 'Chưa có nội dung câu hỏi';
  if (q.qtype === 'truefalse') return null;
  if (!q.options[0].trim() || !q.options[1].trim()) return q.qtype === 'poll' ? 'Cần nhập hai lựa chọn đầu' : 'Cần nhập hai đáp án đầu';
  if (q.qtype === 'poll') return null; // bình chọn không có đáp án đúng
  const filled = q.options.map((t, i) => (t.trim() ? i : -1)).filter((i) => i >= 0);
  const right = q.correct.filter((i) => filled.includes(i));
  if (q.qtype === 'single') return right.length === 1 ? null : 'Chưa chọn đáp án đúng';
  if (filled.length < 3) return 'Câu nhiều đáp án cần ít nhất 3 đáp án';
  return right.length >= 2 ? null : 'Cần đánh dấu từ 2 đáp án đúng';
}
