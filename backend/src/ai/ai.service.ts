import { Injectable, Logger, OnApplicationBootstrap, ServiceUnavailableException } from '@nestjs/common';
import { config } from '../config';

export interface BktResult {
  state: Record<string, unknown>;
  unit_id: string;
  topic: string;
  old_p_l: number;
  new_p_l: number;
  p_l_delta: number;
  mastery_status: string;
  attempts: number;
}

export interface AiQuestion {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
  source: string;
}

/** Gọi dịch vụ AI Python (ai/server.py): chatbot RAG, soạn đề, soạn truyện, Bayesian Knowledge Tracing. */
@Injectable()
export class AiService implements OnApplicationBootstrap {
  private readonly logger = new Logger('AI');

  /** Đánh thức dịch vụ AI (gói miễn phí của Render ngủ sau 15 phút không dùng) */
  onApplicationBootstrap(): void {
    this.health().catch(() => undefined);
  }

  private async request<T>(path: string, body: unknown | undefined, timeoutMs: number): Promise<T> {
    const res = await fetch(`${config.aiServiceUrl}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(config.aiServiceToken ? { 'X-AI-Token': config.aiServiceToken } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`AI service ${res.status}`);
    return (await res.json()) as T;
  }

  async health(): Promise<boolean> {
    try {
      await this.request('/health', undefined, 3000);
      return true;
    } catch {
      return false;
    }
  }

  /** Cập nhật BKT sau một câu trả lời; dịch vụ AI không trả lời kịp thì giữ nguyên trạng thái (trả null) */
  async bktUpdate(state: Record<string, unknown>, unitId: string, isCorrect: boolean): Promise<BktResult | null> {
    try {
      return await this.request<BktResult>('/bkt/update', { state, unit_id: unitId, is_correct: isCorrect }, 4000);
    } catch (exc) {
      this.logger.warn(`Không cập nhật được BKT (${(exc as Error).name})`);
      return null;
    }
  }

  async bktRecommend(state: Record<string, unknown>, topK: number): Promise<Array<Record<string, unknown>>> {
    try {
      return (await this.request<{ recommendations: Array<Record<string, unknown>> }>('/bkt/recommend', { state, top_k: topK }, 4000)).recommendations;
    } catch {
      return [];
    }
  }

  async generateQuestions(unitId: string, topic: string, count: number): Promise<AiQuestion[]> {
    try {
      return (await this.request<{ questions: AiQuestion[] }>('/questions/generate', { unit_id: unitId, topic, count }, 25_000)).questions;
    } catch {
      this.logger.warn(`Không sinh được câu hỏi AI cho ${unitId}`);
      return [];
    }
  }

  /** Chuyển tiếp yêu cầu của người dùng (chat, soạn đề, soạn truyện); AI bận thì báo 503 */
  async forward<T>(path: string, body: unknown, timeoutMs = 40_000): Promise<T> {
    try {
      return await this.request<T>(path, body, timeoutMs);
    } catch {
      throw new ServiceUnavailableException('Dịch vụ AI đang bận, thử lại sau ít phút');
    }
  }
}
