/**
 * Lập chỉ mục tri thức cho AI Tutor (Sprint 9, HK.SYS.011, HK.AD.055–056): gom nội dung ĐÃ CÔNG BỐ của kho lịch sử và bài học thành các đoạn ngắn, tạo vector nhúng nếu có
 * mô hình nhúng, và tải thêm tài liệu PDF / DOCX / TXT. Đồng bộ theo băm nội dung nên chỉ làm lại phần thay đổi; nội dung chuyển về Nháp hoặc bị xóa thì đoạn tương ứng bị gỡ.
 * Mỗi lần kho lịch sử hoặc bài học đổi, `touch()` hẹn một lần đồng bộ nền (gộp các thay đổi liên tiếp); quản trị cũng có thể lập lại chỉ mục thủ công.
 */
import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { config } from '../config';
import { DatabaseService, Q, UserRow } from '../database/database.service';
import { AiSettingsService, INDEX_KINDS } from './ai-settings.service';
import { chunkText, hashOf } from './ai-text';
import { LlmClient, LlmError } from './llm.client';
import { AiRetrievalService } from './ai-retrieval.service';

const jszip = (): typeof import('jszip') => require('jszip');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = (): ((buf: Buffer) => Promise<{ text: string }>) => require('pdf-parse/lib/pdf-parse.js');

export type SourceKind = (typeof INDEX_KINDS)[number];
interface Entity { kind: SourceKind; id: number; title: string; text: string }
interface Wanted { kind: string; id: number; no: number; title: string; content: string; hash: string }

const KIND_LABEL: Record<string, string> = { campaign: 'Cuộc kháng chiến', place: 'Địa danh', figure: 'Nhân vật', event: 'Sự kiện', battle: 'Trận đánh', source: 'Tư liệu', term: 'Thuật ngữ', lesson: 'Bài học', doc: 'Tài liệu tải lên' };
export const kindLabel = (k: string): string => KIND_LABEL[k] ?? k;

const lines = (...parts: Array<string | null | undefined | false>): string => parts.filter((p): p is string => typeof p === 'string' && p.trim().length > 0).join('\n');

const COLLECT: Record<Exclude<SourceKind, 'lesson'>, string> = {
  campaign: "SELECT id, title, year_label, summary FROM hist_campaigns WHERE status = 'published'",
  place: "SELECT id, name AS title, old_name, province, description FROM hist_places WHERE status = 'published'",
  figure: "SELECT id, name AS title, honorific, birth_year, death_year, role_text, biography, famous_quote FROM hist_figures WHERE status = 'published'",
  event: "SELECT id, name AS title, date_text, year_from, description, significance FROM hist_events WHERE status = 'published'",
  battle: "SELECT id, name AS title, date_text, year, context, forces, course, result FROM hist_battles WHERE status = 'published'",
  source: "SELECT id, title, translation, transliteration, original_text, annotation, citation FROM hist_sources WHERE status = 'published'",
  term: "SELECT id, term AS title, definition FROM hist_terms WHERE status = 'published'",
};

const TEXT_OF: Record<Exclude<SourceKind, 'lesson'>, (r: Record<string, any>) => string> = {
  campaign: (r) => lines(r.year_label && `Thời gian: ${r.year_label}`, r.summary),
  place: (r) => lines(r.old_name && `Tên cũ: ${r.old_name}`, r.province && `Tỉnh/thành: ${r.province}`, r.description),
  figure: (r) => lines(r.honorific, (r.birth_year || r.death_year) && `Năm sinh – năm mất: ${r.birth_year ?? '?'} – ${r.death_year ?? '?'}`, r.role_text, r.biography, r.famous_quote && `Câu nói nổi tiếng: ${r.famous_quote}`),
  event: (r) => lines(`Thời gian: ${r.date_text || r.year_from}`, r.description, r.significance && `Ý nghĩa: ${r.significance}`),
  battle: (r) => lines(`Thời gian: ${r.date_text || r.year}`, r.context && `Bối cảnh: ${r.context}`, r.forces && `Lực lượng: ${r.forces}`, r.course && `Diễn biến: ${r.course}`, r.result && `Kết quả: ${r.result}`),
  source: (r) => lines(r.translation, r.transliteration, r.original_text, r.annotation && `Chú thích: ${r.annotation}`, r.citation && `Nguồn: ${r.citation}`),
  term: (r) => String(r.definition ?? ''),
};

export const lessonText = (blocks: unknown): string =>
  (Array.isArray(blocks) ? blocks : []).map((b: any) => (b?.type === 'text' ? lines(b.heading, b.text) : b?.type === 'map' ? `Địa danh trên bản đồ: ${b.label}` : '')).filter(Boolean).join('\n');

@Injectable()
export class AiIndexService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('AiIndex');
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private again = false;

  constructor(private readonly db: DatabaseService, private readonly settings: AiSettingsService, private readonly llm: LlmClient, private readonly retrieval: AiRetrievalService) {}

  onModuleInit(): void { if (config.aiIndexJob && this.db.ready) this.touch(4000); }
  onModuleDestroy(): void { if (this.timer) clearTimeout(this.timer); }

  /** Hẹn một lần đồng bộ nền; các thay đổi liên tiếp gộp làm một (HK.SYS.011) */
  touch(delayMs = 1500): void {
    if (!config.aiIndexJob || !this.db.ready) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; void this.sync().catch((e) => this.logger.warn(`Lập chỉ mục lỗi: ${(e as Error).message}`)); }, delayMs);
    this.timer.unref?.();
  }

  private async collect(q: Q, kinds: string[]): Promise<Entity[]> {
    const out: Entity[] = [];
    for (const kind of kinds as SourceKind[]) {
      if (kind === 'lesson') {
        for (const r of await q<{ id: number; title: string; summary: string | null; blocks: unknown }>("SELECT id, title, summary, blocks FROM hk_lessons WHERE status = 'published'")) out.push({ kind, id: r.id, title: r.title, text: lines(r.summary, lessonText(r.blocks)) });
      } else if (COLLECT[kind]) {
        for (const r of await q<Record<string, any>>(COLLECT[kind])) out.push({ kind, id: r.id, title: String(r.title), text: TEXT_OF[kind](r) });
      }
    }
    return out;
  }

  /** Đồng bộ chỉ mục với nội dung đã công bố; trả số liệu để hiển thị ở trang quản trị */
  async sync(opts: { force?: boolean } = {}): Promise<{ added: number; updated: number; removed: number; embedded: number; failed: number; chunks: number; ms: number; error: string | null }> {
    if (this.running) { this.again = true; return { added: 0, updated: 0, removed: 0, embedded: 0, failed: 0, chunks: 0, ms: 0, error: null }; }
    this.running = true;
    const started = Date.now();
    let error: string | null = null;
    const stat = { added: 0, updated: 0, removed: 0, embedded: 0, failed: 0 };
    try {
      this.settings.invalidate();
      const s = await this.settings.get();
      const kinds = s.index_kinds.filter((k) => (INDEX_KINDS as readonly string[]).includes(k));
      await this.db.tx(async (q) => {
        const wanted = new Map<string, Wanted>();
        for (const e of await this.collect(q, kinds)) {
          chunkText(e.text).forEach((content, no) => wanted.set(`${e.kind}:${e.id}:${no}`, { kind: e.kind, id: e.id, no, title: e.title, content, hash: hashOf(`${e.title}\n${content}`) }));
        }
        const have = await q<{ id: number; source_kind: string; source_id: number; chunk_no: number; content_hash: string; title: string }>("SELECT id, source_kind, source_id, chunk_no, content_hash, title FROM hk_ai_chunks WHERE source_kind <> 'doc'");
        const seen = new Set<string>();
        for (const row of have) {
          const key = `${row.source_kind}:${row.source_id}:${row.chunk_no}`;
          const w = wanted.get(key);
          seen.add(key);
          if (!w) { await q('DELETE FROM hk_ai_chunks WHERE id = $1', [row.id]); stat.removed += 1; continue; }
          if (w.hash !== row.content_hash || opts.force) {
            await q('UPDATE hk_ai_chunks SET title = $2, content = $3, content_hash = $4, embedding = NULL, embed_model = NULL, embedded_at = NULL, indexed_at = now() WHERE id = $1', [row.id, w.title, w.content, w.hash]);
            stat.updated += 1;
          }
        }
        for (const [key, w] of wanted) {
          if (seen.has(key)) continue;
          await q('INSERT INTO hk_ai_chunks (source_kind, source_id, chunk_no, title, content, content_hash) VALUES ($1, $2, $3, $4, $5, $6)', [w.kind, w.id, w.no, w.title, w.content, w.hash]);
          stat.added += 1;
        }
      });
      const emb = await this.embedMissing();
      stat.embedded = emb.done; stat.failed = emb.failed; error = emb.error;
    } catch (e) {
      error = (e as Error).message.slice(0, 400);
      this.logger.warn(`Lập chỉ mục lỗi: ${error}`);
    } finally {
      this.running = false;
    }
    const ms = Date.now() - started;
    const chunks = Number((await this.db.query<{ n: string }>('SELECT count(*) AS n FROM hk_ai_chunks'))[0].n);
    await this.db.query('UPDATE hk_ai_settings SET last_index_at = now(), last_index_ms = $1, last_index_error = $2 WHERE id = 1', [ms, error]);
    this.settings.invalidate();
    this.retrieval.invalidate();
    if (this.again) { this.again = false; this.touch(500); }
    return { ...stat, chunks, ms, error };
  }

  /** Vector nhúng cho các đoạn còn thiếu (hoặc nhúng bằng mô hình cũ); lỗi một lô không làm hỏng phần còn lại */
  private async embedMissing(): Promise<{ done: number; failed: number; error: string | null }> {
    const cfg = await this.settings.llm();
    if (!cfg?.embedModel) return { done: 0, failed: 0, error: null };
    const rows = await this.db.query<{ id: number; title: string; content: string }>(
      "SELECT c.id, c.title, c.content FROM hk_ai_chunks c WHERE c.embedding IS NULL OR c.embed_model IS DISTINCT FROM $1 ORDER BY c.id LIMIT 2000", [cfg.embedModel]);
    let done = 0, failed = 0;
    let error: string | null = null;
    for (let i = 0; i < rows.length; i += 32) {
      const batch = rows.slice(i, i + 32);
      try {
        const vecs = await this.llm.embed(cfg, batch.map((r) => `${r.title}\n${r.content}`));
        for (const [j, r] of batch.entries()) await this.db.query('UPDATE hk_ai_chunks SET embedding = $2, embed_model = $3, embedded_at = now() WHERE id = $1', [r.id, vecs[j], cfg.embedModel]);
        done += batch.length;
      } catch (e) {
        failed += batch.length;
        error = (e instanceof LlmError ? e.message : (e as Error).message).slice(0, 300);
        break;
      }
    }
    return { done, failed, error };
  }

  // ---------------------------------------------------------------------- trạng thái (HK.AD.055–056)
  async status() {
    const [s, perKind, available, docs] = await Promise.all([
      this.settings.get(),
      this.db.query<{ source_kind: string; chunks: number; sources: number; embedded: number }>(
        'SELECT source_kind, count(*)::int AS chunks, count(DISTINCT source_id)::int AS sources, count(embedding)::int AS embedded FROM hk_ai_chunks GROUP BY source_kind'),
      this.availableCounts(),
      this.db.query<Record<string, any>>('SELECT id, title, filename, file_kind, char_count, status, error, created_at, (SELECT count(*)::int FROM hk_ai_chunks c WHERE c.source_kind = \'doc\' AND c.source_id = d.id) AS chunks FROM hk_ai_docs d ORDER BY d.id DESC'),
    ]);
    const kinds = [...INDEX_KINDS, 'doc' as const].map((k) => ({
      kind: k, label: kindLabel(k), enabled: k === 'doc' ? true : s.index_kinds.includes(k), published: k === 'doc' ? docs.filter((d) => d.status !== 'disabled').length : available[k] ?? 0,
      sources: perKind.find((p) => p.source_kind === k)?.sources ?? 0, chunks: perKind.find((p) => p.source_kind === k)?.chunks ?? 0, embedded: perKind.find((p) => p.source_kind === k)?.embedded ?? 0,
    }));
    return {
      kinds, docs, totals: { chunks: kinds.reduce((n, k) => n + k.chunks, 0), embedded: kinds.reduce((n, k) => n + k.embedded, 0), sources: kinds.reduce((n, k) => n + k.sources, 0) },
      last_index_at: s.last_index_at, last_index_ms: s.last_index_ms, last_index_error: s.last_index_error, running: this.running,
    };
  }

  private async availableCounts(): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    for (const [kind, table] of [['campaign', 'hist_campaigns'], ['place', 'hist_places'], ['figure', 'hist_figures'], ['event', 'hist_events'], ['battle', 'hist_battles'], ['source', 'hist_sources'], ['term', 'hist_terms'], ['lesson', 'hk_lessons']] as const) {
      out[kind] = Number((await this.db.query<{ n: string }>(`SELECT count(*) AS n FROM ${table} WHERE status = 'published'`))[0].n);
    }
    return out;
  }

  // ---------------------------------------------------------------------- tài liệu tải lên (HK.AD.055)
  private async extract(file: { originalname: string; buffer: Buffer }): Promise<{ text: string; kind: 'pdf' | 'docx' | 'txt' }> {
    const name = file.originalname.toLowerCase();
    if (name.endsWith('.txt') || name.endsWith('.md')) return { text: file.buffer.toString('utf8'), kind: 'txt' };
    if (name.endsWith('.docx')) {
      const zip = await jszip().loadAsync(file.buffer).catch(() => { throw new BadRequestException('Tệp DOCX bị hỏng hoặc không đọc được'); });
      const xml = await zip.file('word/document.xml')?.async('string');
      if (!xml) throw new BadRequestException('Tệp DOCX không có nội dung văn bản');
      const text = xml.replace(/<w:tab\/>/g, ' ').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
      return { text, kind: 'docx' };
    }
    if (name.endsWith('.pdf')) {
      const res = await pdfParse()(file.buffer).catch(() => { throw new BadRequestException('Tệp PDF bị hỏng hoặc có mật khẩu'); });
      return { text: res.text, kind: 'pdf' };
    }
    throw new BadRequestException('Chỉ nhận tệp PDF, DOCX hoặc TXT');
  }

  async addDoc(user: UserRow, body: { title?: string; text?: string }, file?: { originalname: string; buffer: Buffer; size: number }) {
    let text = String(body.text ?? '');
    let kind: 'pdf' | 'docx' | 'txt' | 'text' = 'text';
    let filename: string | null = null;
    if (file) {
      if (file.size > 8 * 1024 * 1024) throw new BadRequestException('Tệp tối đa 8 MB');
      const got = await this.extract(file);
      text = got.text; kind = got.kind; filename = file.originalname.slice(0, 200);
    }
    text = text.replace(/\u0000/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    if (text.length < 40) throw new BadRequestException('Tài liệu quá ngắn hoặc không đọc được chữ (cần ít nhất 40 ký tự văn bản; PDF dạng ảnh quét chưa được hỗ trợ)');
    if (text.length > 400_000) throw new BadRequestException('Tài liệu quá dài (tối đa 400.000 ký tự)');
    const title = String(body.title ?? filename ?? '').trim().replace(/\.(pdf|docx|txt|md)$/i, '');
    if (title.length < 2 || title.length > 200) throw new BadRequestException('Tên tài liệu từ 2 đến 200 ký tự');
    const doc = (await this.db.query<{ id: number }>(
      'INSERT INTO hk_ai_docs (title, filename, file_kind, char_count, uploaded_by) VALUES ($1, $2, $3, $4, $5) RETURNING id', [title, filename, kind, text.length, user.id]))[0];
    const chunks = chunkText(text).slice(0, 600);
    await this.db.tx(async (q) => {
      for (const [no, content] of chunks.entries()) await q('INSERT INTO hk_ai_chunks (source_kind, source_id, chunk_no, title, content, content_hash) VALUES (\'doc\', $1, $2, $3, $4, $5)', [doc.id, no, title, content, hashOf(`${title}\n${content}`)]);
    });
    await this.embedMissing().catch(() => undefined);
    this.retrieval.invalidate();
    return { id: doc.id, title, file_kind: kind, char_count: text.length, chunks: chunks.length };
  }

  async setDocStatus(id: number, status: string) {
    if (!['indexed', 'disabled'].includes(status)) throw new BadRequestException('Trạng thái tài liệu là indexed hoặc disabled');
    const res = await this.db.query('UPDATE hk_ai_docs SET status = $2 WHERE id = $1 RETURNING id', [id, status]);
    if (!res.length) throw new BadRequestException('Không tìm thấy tài liệu');
    this.retrieval.invalidate();
    return { id, status };
  }

  async removeDoc(id: number): Promise<void> {
    await this.db.tx(async (q) => {
      await q("DELETE FROM hk_ai_chunks WHERE source_kind = 'doc' AND source_id = $1", [id]);
      await q('DELETE FROM hk_ai_docs WHERE id = $1', [id]);
    });
    this.retrieval.invalidate();
  }
}
