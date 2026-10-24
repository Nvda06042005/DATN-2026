import { apiRequest } from '@/api/client';
import type { GeneratedQuiz, GeneratedStory, LiveSessionSummary, TeacherClass } from '@/types/api';

/** Lớp phụ trách: học sinh thật, tóm tắt, câu sai nhiều, mức nắm vững, học sinh cần hỗ trợ */
export const getMyClass = (token: string) => apiRequest<TeacherClass>('/api/teacher/class', { token });

/** Các trận thi đấu đã lưu của giáo viên (mới nhất trước) */
export const getLiveSessions = (token: string, limit = 5) => apiRequest<LiveSessionSummary[]>(`/api/teacher/live-sessions?limit=${limit}`, { token });

/** Nhờ AI soạn câu hỏi trắc nghiệm theo chủ đề và mức độ nhận thức */
export const generateQuiz = (token: string, topic: string, numQuestions: number, cognitiveLevel: string) =>
  apiRequest<GeneratedQuiz>('/api/quiz/generate', { token, body: { topic, num_questions: numQuestions, cognitive_level: cognitiveLevel } });

/** Nhờ AI soạn một màn truyện lịch sử (lời kể, tư liệu, câu hỏi thử thách) */
export const generateStory = (token: string, campaignName: string, stageTitle: string, keyEvent: string) =>
  apiRequest<GeneratedStory>('/api/story/generate', { token, body: { campaign_name: campaignName, stage_title: stageTitle, key_event: keyEvent } });
