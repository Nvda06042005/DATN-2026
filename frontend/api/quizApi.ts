import type { GeneratedQuizQuestion, TopicGroupItem } from '@/types/libraryType';
import { API_BASE_URL } from '@/utils/http';

export interface QuizGenerateParams {
  topic?: string;
  topicGroupId?: string;
  unitIds?: string[];
  numQuestions: number;
  cognitiveLevel: string;
}

export interface QuizGenerateResult {
  topic: string;
  topic_group_id?: string;
  topic_group_name?: string;
  total_generated: number;
  questions?: GeneratedQuizQuestion[];
  generation_notes?: string;
}

/** Lấy danh sách các nhóm chủ đề khảo thí chuẩn SGK Lịch sử 7 */
export const getTopicGroups = async (): Promise<{ total_groups: number; groups: TopicGroupItem[] }> => {
  const response = await fetch(`${API_BASE_URL}/api/quiz/topic-groups`);
  if (!response.ok) throw new Error(`Máy chủ AI phản hồi lỗi: ${response.status}`);
  return response.json();
};

/** Nhờ AI soạn câu hỏi trắc nghiệm theo nhóm chủ đề và mức độ nhận thức */
export const generateQuiz = async (
  topicOrParams: string | QuizGenerateParams,
  numQuestions?: number,
  cognitiveLevel?: string
): Promise<QuizGenerateResult> => {
  let body: any;
  if (typeof topicOrParams === 'object') {
    body = {
      topic: topicOrParams.topic,
      topic_group_id: topicOrParams.topicGroupId,
      unit_ids: topicOrParams.unitIds,
      num_questions: topicOrParams.numQuestions,
      cognitive_level: topicOrParams.cognitiveLevel,
    };
  } else {
    body = {
      topic: topicOrParams,
      num_questions: numQuestions ?? 4,
      cognitive_level: cognitiveLevel ?? 'Phân bổ ma trận',
    };
  }

  const response = await fetch(`${API_BASE_URL}/api/quiz/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Máy chủ AI phản hồi lỗi: ${response.status}`);
  return response.json();
};
