import { apiRequest } from '@/api/client';
import type {
  AnswerPayload, AnswerResult, ChatbotReply, CodexEntry, LeaderboardEntry, LearnerProgress, QuestionsResponse, Recommendation, StudentClass,
} from '@/types/api';
import type { GameState } from '@/types/game';

/** Lớp đã vào */
export const getMyClasses = (token: string) => apiRequest<StudentClass[]>('/api/student/classes', { token });

/** Vào lớp đã được duyệt bằng mã lớp + mật khẩu lớp do thầy cô phát */
export const joinClass = (token: string, classCode: string, password: string) =>
  apiRequest<StudentClass>('/api/student/classes/join', { token, body: { class_code: classCode, password } });

/** Tiến độ học tập (XP, Ấn Tín, chuỗi ngày, hạng trong lớp) */
export const getProgress = (token: string) => apiRequest<LearnerProgress>('/api/student/progress', { token });

/** Trạng thái game đã lưu trên server (null nếu học sinh mới) */
export const getGameState = (token: string) => apiRequest<{ state: unknown }>('/api/student/game', { token });

export const putGameState = (token: string, state: GameState) => apiRequest<{ state: unknown }>('/api/student/game', { method: 'PUT', token, body: { state }, timeoutMs: 20_000 });

/** Thẻ Sử Ký (kho tri thức của chatbot + thẻ bổ sung của game) */
export const getCodex = (token: string) => apiRequest<CodexEntry[]>('/api/student/codex', { token });

/** Câu hỏi trong ngân hàng (server giữ đáp án) */
export const getQuestions = (token: string, params: Record<string, string>) =>
  apiRequest<QuestionsResponse>(`/api/student/questions?${new URLSearchParams(params).toString()}`, { token });

/** Câu hỏi do Quân Sư AI soạn; AI bận thì server dùng câu trong ngân hàng */
export const getAiQuestions = (token: string, unitId: string | null, count: number) =>
  apiRequest<QuestionsResponse>('/api/student/questions/ai', { token, body: { unit_id: unitId, count } });

/** Gửi câu trả lời để server chấm, cộng XP/Ấn Tín và cập nhật mức nắm vững (BKT) */
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

/** Hỏi Quân Sư AI (NLP + truy xuất kho tri thức + LLM); sessionId giữ ngữ cảnh hội thoại nhiều lượt */
export const askAdvisor = (token: string, query: string, characterId: string, sessionId: string) =>
  apiRequest<ChatbotReply>('/api/chat/dong-a', { token, body: { query, character_id: characterId, session_id: sessionId } });
