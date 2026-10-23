import type { GeneratedQuizQuestion } from '@/types/libraryType';
import { API_BASE_URL } from '@/utils/http';

/** Nhờ AI soạn câu hỏi trắc nghiệm theo chủ đề và mức độ nhận thức */
export const generateQuiz = async (topic: string, numQuestions: number, cognitiveLevel: string): Promise<{ questions?: GeneratedQuizQuestion[] }> => {
  const response = await fetch(`${API_BASE_URL}/api/quiz/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, num_questions: numQuestions, cognitive_level: cognitiveLevel }),
  });
  if (!response.ok) throw new Error(`Máy chủ AI phản hồi lỗi: ${response.status}`);
  return response.json();
};
