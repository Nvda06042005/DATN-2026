/**
 * Gọi mô hình ngôn ngữ và mô hình nhúng (Sprint 9, HK.SYS.009, HK.AD.057). Hai kiểu API:
 *  - anthropic: POST {base}/v1/messages (khóa trong x-api-key); không có API nhúng nên truy xuất dùng từ khóa;
 *  - openai: POST {base}/chat/completions và {base}/embeddings (Bearer) – dùng được cho mọi dịch vụ tương thích (Gemini, Ollama, vLLM…).
 * Lỗi mạng hoặc phản hồi sai trả LlmError với thông báo tiếng Việt, không lộ khóa; mọi lệnh gọi có thời hạn 30 giây.
 */
import { Injectable } from '@nestjs/common';

export interface LlmConfig { provider: 'anthropic' | 'openai'; baseUrl: string; apiKey: string; chatModel: string; embedModel: string | null }
export interface LlmMessage { role: 'user' | 'assistant'; content: string }
export interface LlmResult { text: string; tokensIn: number; tokensOut: number }

export class LlmError extends Error {
  constructor(message: string, readonly status = 0) { super(message); }
}

const DEFAULT_BASE = { anthropic: 'https://api.anthropic.com', openai: 'https://api.openai.com/v1' } as const;
export const DEFAULT_CHAT_MODEL = { anthropic: 'claude-haiku-4-5', openai: 'gpt-4o-mini' } as const;
const TIMEOUT_MS = 30_000;

const trimBase = (c: LlmConfig): string => (c.baseUrl || DEFAULT_BASE[c.provider]).replace(/\/+$/, '');

async function post(url: string, headers: Record<string, string>, body: unknown): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    throw new LlmError((e as Error).name === 'TimeoutError' ? 'Mô hình AI phản hồi quá chậm (quá 30 giây).' : 'Không kết nối được tới dịch vụ AI.');
  }
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* phản hồi không phải JSON */ }
  if (!res.ok) {
    const detail = String(json?.error?.message ?? json?.message ?? '').slice(0, 200);
    throw new LlmError(`Dịch vụ AI trả lỗi ${res.status}${detail ? `: ${detail}` : ''}`, res.status);
  }
  if (!json) throw new LlmError('Dịch vụ AI trả phản hồi không hợp lệ.');
  return json;
}

@Injectable()
export class LlmClient {
  async chat(cfg: LlmConfig, req: { system: string; messages: LlmMessage[]; temperature: number; maxTokens: number }): Promise<LlmResult> {
    const base = trimBase(cfg);
    if (cfg.provider === 'anthropic') {
      const j = await post(`${base}/v1/messages`, { 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01' }, {
        model: cfg.chatModel, max_tokens: req.maxTokens, temperature: req.temperature, system: req.system, messages: req.messages,
      });
      const text = (Array.isArray(j.content) ? j.content : []).filter((b: any) => b?.type === 'text').map((b: any) => String(b.text)).join('\n').trim();
      if (!text) throw new LlmError('Mô hình AI không trả nội dung.');
      return { text, tokensIn: Number(j.usage?.input_tokens ?? 0), tokensOut: Number(j.usage?.output_tokens ?? 0) };
    }
    const j = await post(`${base}/chat/completions`, { Authorization: `Bearer ${cfg.apiKey}` }, {
      model: cfg.chatModel, temperature: req.temperature, max_tokens: req.maxTokens, messages: [{ role: 'system', content: req.system }, ...req.messages],
    });
    const text = String(j.choices?.[0]?.message?.content ?? '').trim();
    if (!text) throw new LlmError('Mô hình AI không trả nội dung.');
    return { text, tokensIn: Number(j.usage?.prompt_tokens ?? 0), tokensOut: Number(j.usage?.completion_tokens ?? 0) };
  }

  /** Vector nhúng cho từng chuỗi; chỉ kiểu openai có API này */
  async embed(cfg: LlmConfig, inputs: string[]): Promise<number[][]> {
    if (cfg.provider !== 'openai' || !cfg.embedModel) throw new LlmError('Chưa cấu hình mô hình nhúng.');
    const j = await post(`${trimBase(cfg)}/embeddings`, { Authorization: `Bearer ${cfg.apiKey}` }, { model: cfg.embedModel, input: inputs });
    const data: any[] = Array.isArray(j.data) ? [...j.data].sort((a, b) => Number(a.index ?? 0) - Number(b.index ?? 0)) : [];
    if (data.length !== inputs.length || data.some((d) => !Array.isArray(d.embedding))) throw new LlmError('Dịch vụ AI trả vector nhúng không hợp lệ.');
    return data.map((d) => d.embedding.map(Number));
  }
}
