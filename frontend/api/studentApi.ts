import type { GameState } from '@/types/gameType';
import type {
  AnswerPayload, AnswerResult, CodexEntry, LeaderboardEntry, LearnerProgress, QuestionsResponse, Recommendation,
} from '@/types/learningType';
import { API_BASE_URL, apiRequest } from '@/utils/http';

/** Tiến độ học tập (XP, Ấn Tín, chuỗi ngày, hạng trong lớp) */
export const getProgress = (token: string) => apiRequest<LearnerProgress>('/api/student/progress', { token });

/** Trạng thái game đã lưu trên server (null nếu học sinh mới) */
export const getGameState = (token: string) => apiRequest<{ state: unknown }>('/api/student/game', { token });

/** Lưu trạng thái game. keepalive để vẫn gửi được khi đóng tab; trả về Response để biết mã 401 */
export const putGameState = (token: string, state: GameState, keepalive = false) =>
  fetch(`${API_BASE_URL}/api/student/game`, {
    method: 'PUT',
    keepalive,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ state }),
  });

/** Thẻ Sử Ký (kho tri thức của chatbot + thẻ bổ sung của game) */
export const getCodex = (token: string) => apiRequest<CodexEntry[]>('/api/student/codex', { token });

/** Câu hỏi trong ngân hàng (server giữ đáp án) */
export const getQuestions = (token: string, params: URLSearchParams) =>
  apiRequest<QuestionsResponse>(`/api/student/questions?${params.toString()}`, { token });

/** Câu hỏi do Quân Sư AI soạn; AI bận thì server dùng câu trong ngân hàng */
export const getAiQuestions = (token: string, unitId: string | null, count: number) =>
  apiRequest<QuestionsResponse>('/api/student/questions/ai', { token, body: { unit_id: unitId, count } });

/** Gửi câu trả lời để server chấm, cộng XP/Ấn Tín và cập nhật BKT */
export const submitAnswer = (token: string, questionId: string, payload: AnswerPayload) =>
  apiRequest<AnswerResult>('/api/student/answer', { token, body: { question_id: questionId, ...payload } });

/** Ghi nhận hoàn thành một lượt học / trận đánh */
export const completeQuiz = (token: string, correct: number, total: number) =>
  apiRequest<{ progress: LearnerProgress }>('/api/student/quiz-complete', { token, body: { correct, total } });

/** Tiêu Ấn Tín (chỉ được trừ; cộng Ấn Tín là việc của server khi chấm) */
export const spendGems = (token: string, amount: number, reason: string) =>
  apiRequest<LearnerProgress>('/api/student/gems', { token, body: { delta: -amount, reason } });

/** Đếm một câu hỏi gửi Quân Sư AI (nhiệm vụ ngày) */
export const countAiQuestion = (token: string) => apiRequest<LearnerProgress>('/api/student/ai-question', { token, method: 'POST' });

/** Bảng xếp hạng lớp theo XP tuần */
export const getLeaderboard = (token: string) => apiRequest<LeaderboardEntry[]>('/api/student/leaderboard', { token });

/** Chủ đề nên ôn tiếp theo mô hình BKT */
export const getRecommendations = (token: string, topK: number) =>
  apiRequest<{ recommendations: Recommendation[] }>(`/api/student/recommendations?top_k=${topK}`, { token });
