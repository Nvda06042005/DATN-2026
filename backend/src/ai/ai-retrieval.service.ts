/**
 * Truy xuất tư liệu cho câu hỏi (Sprint 9, HK.SYS.009): xếp hạng từ khóa BM25 trên mọi đoạn đã lập chỉ mục, thêm độ tương đồng cosine của vector nhúng khi có mô hình nhúng,
 * trộn hai bảng xếp hạng theo thứ hạng. Chỉ mục nằm trong bộ nhớ (vài nghìn đoạn) và được dựng lại sau mỗi lần lập chỉ mục. Nội dung vừa bị gỡ công bố không bao giờ được
 * trả về: sau khi chọn đoạn, máy chủ kiểm tra lại trạng thái công bố của nguồn.
 */
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { buildCorpus, Corpus, cosine, fuse, rank } from './ai-text';

export interface Passage {
  id: number; kind: string; sourceId: number; title: string; content: string;
  /** độ phủ từ khóa của câu hỏi (0–1) */
  coverage: number; cos: number; score: number;
}
interface Row { id: number; source_kind: string; source_id: number; title: string; content: string; embedding: number[] | null }

const TABLE: Record<string, string> = {
  campaign: 'hist_campaigns', place: 'hist_places', figure: 'hist_figures', event: 'hist_events', battle: 'hist_battles', source: 'hist_sources', term: 'hist_terms', lesson: 'hk_lessons',
};

@Injectable()
export class AiRetrievalService {
  private cache: { corpus: Corpus; rows: Map<number, Row> } | null = null;
  private loading: Promise<void> | null = null;

  constructor(private readonly db: DatabaseService) {}

  invalidate(): void { this.cache = null; }

  private async load(): Promise<{ corpus: Corpus; rows: Map<number, Row> }> {
    // Không dùng bộ nhớ đệm hệ thống cho dữ liệu riêng của trường.
    if (this.db.inWorkspace) {
      const list = await this.db.query<Row>(`SELECT c.id::int AS id,c.source_kind,c.source_id,c.title,c.content,c.embedding FROM hk_ai_chunks c
        WHERE c.source_kind<>'doc' OR EXISTS(SELECT 1 FROM hk_ai_docs d WHERE d.id=c.source_id AND d.status<>'disabled') ORDER BY c.id`);
      return { corpus: buildCorpus(list.map((r) => ({ id:r.id,text:`${r.title} ${r.title} ${r.content}` }))), rows:new Map(list.map((r) => [r.id,r])) };
    }
    if (this.cache) return this.cache;
    this.loading ??= (async () => {
      const list = await this.db.query<Row>(
        `SELECT c.id::int AS id, c.source_kind, c.source_id, c.title, c.content, c.embedding FROM hk_ai_chunks c
         WHERE c.school_id IS NULL AND (c.source_kind <> 'doc' OR EXISTS (SELECT 1 FROM hk_ai_docs d WHERE d.id = c.source_id AND d.status <> 'disabled')) ORDER BY c.id`);
      const rows = new Map(list.map((r) => [r.id, r]));
      this.cache = { corpus: buildCorpus(list.map((r) => ({ id: r.id, text: `${r.title} ${r.title} ${r.content}` }))), rows };
    })().finally(() => { this.loading = null; });
    await this.loading;
    return this.cache!;
  }

  async size(): Promise<number> { return (await this.load()).rows.size; }

  /**
   * Chọn tối đa k đoạn (mỗi nguồn không quá 2 đoạn). `only` giới hạn theo loại nguồn; `focus` ưu tiên các nguồn cụ thể (nhập vai nhân vật).
   * `queryVector` là vector nhúng của câu hỏi (nếu có) để trộn thứ hạng ngữ nghĩa.
   */
  async search(query: string, k: number, opts: { only?: string[]; focus?: Array<{ kind: string; id: number; w?: number }>; queryVector?: number[] | null } = {}): Promise<Passage[]> {
    const { corpus, rows } = await this.load();
    const allowed = (r: Row): boolean => !opts.only || opts.only.includes(r.source_kind);
    const hits = rank(corpus, query).filter((h) => allowed(rows.get(h.id)!));
    const byId = new Map(hits.map((h) => [h.id, h]));
    const lists: number[][] = [hits.map((h) => h.id)];
    const cosOf = new Map<number, number>();
    if (opts.queryVector?.length) {
      const dense: Array<{ id: number; c: number }> = [];
      for (const r of rows.values()) if (allowed(r) && r.embedding?.length === opts.queryVector.length) { const c = cosine(opts.queryVector, r.embedding); cosOf.set(r.id, c); dense.push({ id: r.id, c }); }
      dense.sort((a, b) => b.c - a.c);
      lists.push(dense.slice(0, 50).map((d) => d.id));
    }
    const fused = fuse(lists);
    // trọng số ưu tiên theo nguồn: nhân vật nhập vai (w ≥ 0,1) luôn được đưa vào, nguồn liên kết chỉ nhỉnh hơn một chút
    const focus = new Map((opts.focus ?? []).map((f) => [`${f.kind}:${f.id}`, f.w ?? 0.05] as const));
    const ranked = [...fused.entries()].map(([id, score]) => {
      const r = rows.get(id)!;
      return { id, score: score + (focus.get(`${r.source_kind}:${r.source_id}`) ?? 0) };
    }).sort((a, b) => b.score - a.score);
    // nhập vai: đưa mọi đoạn của nhân vật vào danh sách ứng viên dù câu hỏi không chứa tên
    if (focus.size) for (const r of rows.values()) { const w = focus.get(`${r.source_kind}:${r.source_id}`) ?? 0; if (w >= 0.1 && !fused.has(r.id)) ranked.push({ id: r.id, score: w }); }
    ranked.sort((a, b) => b.score - a.score);

    const perSource = new Map<string, number>();
    const picked: Passage[] = [];
    for (const { id, score } of ranked) {
      const r = rows.get(id)!;
      const key = `${r.source_kind}:${r.source_id}`;
      if ((perSource.get(key) ?? 0) >= 2) continue;
      perSource.set(key, (perSource.get(key) ?? 0) + 1);
      picked.push({ id, kind: r.source_kind, sourceId: r.source_id, title: r.title, content: r.content, coverage: byId.get(id)?.coverage ?? 0, cos: cosOf.get(id) ?? 0, score });
      if (picked.length >= k + 4) break;
    }
    return (await this.live(picked)).slice(0, k);
  }

  /** Giữ lại các đoạn mà nguồn còn được công bố (tránh dùng nội dung vừa gỡ trong lúc chờ lập chỉ mục lại) */
  private async live(list: Passage[]): Promise<Passage[]> {
    const ok = new Set<string>();
    for (const [kind, table] of Object.entries(TABLE)) {
      const ids = [...new Set(list.filter((p) => p.kind === kind).map((p) => p.sourceId))];
      if (!ids.length) continue;
      for (const r of await this.db.query<{ id: number }>(`SELECT id FROM ${table} WHERE id = ANY($1) AND status = 'published'`, [ids])) ok.add(`${kind}:${r.id}`);
    }
    return list.filter((p) => p.kind === 'doc' || ok.has(`${p.kind}:${p.sourceId}`));
  }
}
