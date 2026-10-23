import type { ChatbotReply } from '@/types/chatbotType';
import { API_BASE_URL } from '@/utils/http';

/** Hỏi Quân Sư AI (mô hình NLP + RAG); sessionId giữ ngữ cảnh hội thoại nhiều lượt */
export const askAdvisor = async (query: string, characterId: string, sessionId: string): Promise<ChatbotReply> => {
  const res = await fetch(`${API_BASE_URL}/api/chat/dong-a`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, character_id: characterId, session_id: sessionId }),
  });
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as ChatbotReply;
};
