/** Nguồn sử liệu kèm câu trả lời của Quân Sư AI */
export interface ChatbotSource {
  curriculum_match?: string;
  doc_name?: string;
}

/** Câu trả lời của Quân Sư AI (POST /api/chat/dong-a) */
export interface ChatbotReply {
  answer: string;
  grounding_sources?: ChatbotSource[];
}
