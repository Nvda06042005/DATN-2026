/**
 * Cấu hình AI Tutor (Sprint 9, HK.AD.057–058, 064): mô hình, khóa API, tham số sinh, prompt hệ thống, phạm vi trả lời, từ cấm, hạn mức.
 * Khóa API mã hóa AES-256-GCM trong CSDL và không bao giờ trả về giao diện (chỉ 4 ký tự cuối); biến môi trường AI_* ưu tiên hơn cấu hình ở trang quản trị.
 */
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { config } from '../config';
import { DatabaseService, UserRow } from '../database/database.service';
import { decryptSecret, encryptSecret } from './ai-text';
import { DEFAULT_CHAT_MODEL, LlmConfig } from './llm.client';

export interface AiSettings {
  provider: 'none' | 'anthropic' | 'openai';
  base_url: string | null; chat_model: string | null; embed_model: string | null; api_key_enc: string | null;
  temperature: number; max_tokens: number; top_k: number; min_score: number;
  system_prompt: string; refusal_message: string; banned_terms: string[]; index_kinds: string[];
  daily_per_user: number; daily_per_school: number; price_in: number; price_out: number;
  last_index_at: string | null; last_index_ms: number | null; last_index_error: string | null;
}

export const INDEX_KINDS = ['campaign', 'place', 'figure', 'event', 'battle', 'source', 'term', 'lesson'] as const;
const COLUMNS = 'provider, base_url, chat_model, embed_model, api_key_enc, temperature::float8 AS temperature, max_tokens, top_k, min_score::float8 AS min_score, system_prompt, refusal_message, banned_terms, index_kinds, daily_per_user, daily_per_school, price_in::float8 AS price_in, price_out::float8 AS price_out, last_index_at, last_index_ms, last_index_error';

@Injectable()
export class AiSettingsService {
  private readonly logger = new Logger('AiSettings');
  private cache: { at: number; row: AiSettings } | null = null;

  constructor(private readonly db: DatabaseService) {}

  invalidate(): void { this.cache = null; }

  async get(): Promise<AiSettings> {
    if (this.cache && Date.now() - this.cache.at < 3000) return this.cache.row;
    const row = (await this.db.query<AiSettings>(`SELECT ${COLUMNS} FROM hk_ai_settings WHERE id = 1`))[0];
    this.cache = { at: Date.now(), row };
    return row;
  }

  /** Cấu hình dùng thật: biến môi trường (nếu có) thay cho cấu hình lưu; null khi chưa có mô hình hoặc chưa có khóa */
  async llm(): Promise<LlmConfig | null> {
    const s = await this.get();
    const provider = (config.aiProvider === 'anthropic' || config.aiProvider === 'openai' ? config.aiProvider : s.provider) as AiSettings['provider'];
    if (provider === 'none') return null;
    const key = config.aiApiKey || decryptSecret(s.api_key_enc, config.authSecret);
    if (!key) { if (s.api_key_enc) this.logger.warn('Không giải mã được khóa API đã lưu (AUTH_SECRET_KEY đã đổi?); hãy nhập lại khóa ở trang quản trị'); return null; }
    return {
      provider, apiKey: key, baseUrl: config.aiBaseUrl || s.base_url || '',
      chatModel: config.aiChatModel || s.chat_model || DEFAULT_CHAT_MODEL[provider],
      embedModel: provider === 'openai' ? config.aiEmbedModel || s.embed_model || null : null,
    };
  }

  async publicView() {
    const s = await this.get();
    const envKey = Boolean(config.aiApiKey);
    const key = envKey ? config.aiApiKey : decryptSecret(s.api_key_enc, config.authSecret);
    const llm = await this.llm();
    const { api_key_enc: _enc, ...rest } = s;
    return {
      ...rest,
      provider_effective: llm?.provider ?? 'none',
      has_key: Boolean(key), key_hint: key ? `••••${key.slice(-4)}` : null, key_source: envKey ? 'env' : key ? 'db' : 'none', key_unreadable: Boolean(s.api_key_enc) && !key,
      env_overrides: [config.aiProvider && 'AI_PROVIDER', config.aiApiKey && 'AI_API_KEY', config.aiBaseUrl && 'AI_BASE_URL', config.aiChatModel && 'AI_CHAT_MODEL', config.aiEmbedModel && 'AI_EMBED_MODEL'].filter(Boolean),
      mode: llm ? 'llm' : 'extractive', embeddings: Boolean(llm?.embedModel),
      default_chat_model: { anthropic: DEFAULT_CHAT_MODEL.anthropic, openai: DEFAULT_CHAT_MODEL.openai },
    };
  }

  async update(user: UserRow, body: Record<string, any>) {
    const cur = await this.get();
    const text = (k: string, max: number, label: string): string | null => {
      if (body[k] === undefined) return (cur as unknown as Record<string, string | null>)[k];
      const v = String(body[k] ?? '').trim();
      if (v.length > max) throw new BadRequestException(`${label} tối đa ${max} ký tự`);
      return v || null;
    };
    const num = (k: string, min: number, max: number, label: string, int = false): number => {
      if (body[k] === undefined) return (cur as unknown as Record<string, number>)[k];
      const v = Number(body[k]);
      if (!Number.isFinite(v) || v < min || v > max || (int && !Number.isInteger(v))) throw new BadRequestException(`${label}: ${int ? 'số nguyên' : 'số'} từ ${min} đến ${max}`);
      return v;
    };
    const provider = body.provider === undefined ? cur.provider : String(body.provider);
    if (!['none', 'anthropic', 'openai'].includes(provider)) throw new BadRequestException('Nhà cung cấp là none (tra cứu), anthropic hoặc openai (API tương thích)');
    const base = text('base_url', 300, 'Địa chỉ API');
    if (base && !/^https?:\/\/[^\s]+$/.test(base)) throw new BadRequestException('Địa chỉ API phải bắt đầu bằng https:// (hoặc http:// khi chạy nội bộ)');
    let keyEnc = cur.api_key_enc;
    if (body.api_key !== undefined) {
      const k = String(body.api_key ?? '').trim();
      if (!k) keyEnc = null;
      else if (k.length < 8 || k.length > 300 || /\s/.test(k)) throw new BadRequestException('Khóa API không hợp lệ (8–300 ký tự, không có khoảng trắng)');
      else keyEnc = encryptSecret(k, config.authSecret);
    }
    const system = body.system_prompt === undefined ? cur.system_prompt : String(body.system_prompt).trim();
    if (system.length < 20 || system.length > 4000) throw new BadRequestException('Prompt hệ thống từ 20 đến 4000 ký tự');
    const refusal = body.refusal_message === undefined ? cur.refusal_message : String(body.refusal_message).trim();
    if (refusal.length < 5 || refusal.length > 600) throw new BadRequestException('Thông báo từ chối từ 5 đến 600 ký tự');
    let banned = cur.banned_terms;
    if (body.banned_terms !== undefined) {
      const list = Array.isArray(body.banned_terms) ? body.banned_terms : String(body.banned_terms).split(/[\n,]+/);
      banned = [...new Set(list.map((t: unknown) => String(t).trim()).filter(Boolean))] as string[];
      if (banned.length > 100 || banned.some((t) => t.length > 40)) throw new BadRequestException('Tối đa 100 từ cấm, mỗi từ không quá 40 ký tự');
    }
    let kinds = cur.index_kinds;
    if (body.index_kinds !== undefined) {
      kinds = Array.isArray(body.index_kinds) ? body.index_kinds.map(String) : [];
      if (kinds.some((k) => !(INDEX_KINDS as readonly string[]).includes(k))) throw new BadRequestException(`Nguồn tri thức thuộc: ${INDEX_KINDS.join(', ')}`);
    }
    await this.db.query(
      `UPDATE hk_ai_settings SET provider = $1, base_url = $2, chat_model = $3, embed_model = $4, api_key_enc = $5, temperature = $6, max_tokens = $7, top_k = $8, min_score = $9,
              system_prompt = $10, refusal_message = $11, banned_terms = $12, index_kinds = $13, daily_per_user = $14, daily_per_school = $15, updated_by = $16, price_in = $17, price_out = $18, updated_at = now() WHERE id = 1`,
      [provider, base, text('chat_model', 100, 'Mô hình trả lời'), text('embed_model', 100, 'Mô hình nhúng'), keyEnc, num('temperature', 0, 1, 'Nhiệt độ'), num('max_tokens', 100, 4000, 'Giới hạn token', true),
        num('top_k', 1, 12, 'Số đoạn truy xuất', true), num('min_score', 0, 1, 'Ngưỡng liên quan'), system, refusal, banned, kinds,
        num('daily_per_user', 1, 500, 'Số câu hỏi mỗi người mỗi ngày', true), num('daily_per_school', 1, 100000, 'Số câu hỏi mỗi trường mỗi ngày', true), user.id,
        num('price_in', 0, 1000, 'Giá token đầu vào (USD cho 1 triệu token)'), num('price_out', 0, 1000, 'Giá token đầu ra (USD cho 1 triệu token)')]);
    this.invalidate();
    return this.publicView();
  }
}
