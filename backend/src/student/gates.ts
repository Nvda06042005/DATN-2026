/**
 * Cửa của lộ trình học dạng đường đi (HK.HS.117, 121–123; HK.AD.080):
 *  - ngân hàng câu hỏi của cửa: các câu học sinh đã gặp trong cửa, dùng cho nút Luyện tập và (khi không có bộ đề riêng) bài Kiểm tra cuối cửa;
 *  - Cẩm nang: mốc thời gian, nhân vật, địa danh, thuật ngữ, câu nói nổi tiếng, tự tạo từ kho dữ liệu lịch sử đã Công bố gắn với các nút của cửa.
 */
import { Q } from '../database/database.service';
import { QType } from '../content/questions';

export interface PoolQuestion { id: number; qtype: QType; prompt: string; image_url: string | null; explanation: string | null; difficulty: number; data: Record<string, unknown> }

/** Số câu tối đa của một lượt luyện tập / kiểm tra cuối cửa tự ghép từ ngân hàng câu hỏi của cửa */
export const GATE_PLAN_SIZE = 8;

/** Câu hỏi trong cửa: câu kiểm tra nhanh của bài học và câu của bộ đề ở nút câu hỏi, trận đánh, nghe kể chuyện (không lấy Quyết chiến để không lộ đề cuối chiến dịch) */
export async function gatePool(q: Q, gateId: number): Promise<PoolQuestion[]> {
  return q<PoolQuestion>(
    `SELECT t.id, t.qtype, t.prompt, t.image_url, t.explanation, t.difficulty, t.data FROM hk_questions t WHERE t.id IN (
       SELECT k.question_id FROM hk_nodes n JOIN hk_lesson_checks k ON k.lesson_id = n.lesson_id WHERE n.gate_id = $1 AND n.kind = 'lesson'
       UNION
       SELECT qq.question_id FROM hk_nodes n JOIN hk_quiz_questions qq ON qq.quiz_id = n.quiz_id WHERE n.gate_id = $1 AND n.kind IN ('quiz', 'battle', 'listen')
     ) AND t.qtype <> 'poll' ORDER BY t.id`, [gateId]);
}

export async function gatePoolSize(q: Q, gateId: number): Promise<number> {
  return (await gatePool(q, gateId)).length;
}

export interface GateGuide {
  gate: { id: number; title: string; summary: string | null; guide_note: string | null };
  milestones: Array<{ type: 'event' | 'battle'; id: number; name: string; year: number; date_text: string | null }>;
  figures: Array<{ id: number; name: string; honorific: string | null; role_text: string | null }>;
  places: Array<{ id: number; name: string; old_name: string | null }>;
  terms: Array<{ id: number; term: string; definition: string }>;
  quotes: Array<{ text: string; by: string }>;
}

export async function gateGuide(q: Q, gateId: number): Promise<GateGuide | null> {
  const gate = (await q<GateGuide['gate']>('SELECT id, title, summary, guide_note FROM hk_gates WHERE id = $1', [gateId]))[0];
  if (!gate) return null;
  const links = await q<{ ref_type: string; ref_id: number }>(
    `SELECT l.ref_type, l.ref_id FROM hk_nodes n JOIN hk_lesson_links l ON l.lesson_id = n.lesson_id WHERE n.gate_id = $1 AND n.kind = 'lesson'
     UNION SELECT 'battle', n.battle_id FROM hk_nodes n WHERE n.gate_id = $1 AND n.battle_id IS NOT NULL`, [gateId]);
  const ids = (type: string): number[] => links.filter((l) => l.ref_type === type).map((l) => l.ref_id);
  const events = ids('event'), battles = ids('battle'), figures = ids('figure'), places = ids('place'), terms = ids('term');

  const eventRows = events.length ? await q<{ id: number; name: string; year: number; date_text: string | null }>("SELECT id, name, year_from AS year, date_text FROM hist_events WHERE id = ANY($1) AND status = 'published'", [events]) : [];
  const battleRows = battles.length ? await q<{ id: number; name: string; year: number; date_text: string | null }>("SELECT id, name, year, date_text FROM hist_battles WHERE id = ANY($1) AND status = 'published'", [battles]) : [];
  const milestones = [
    ...eventRows.map((e) => ({ type: 'event' as const, ...e })),
    ...battleRows.map((b) => ({ type: 'battle' as const, ...b })),
  ].sort((a, b) => a.year - b.year || a.name.localeCompare(b.name, 'vi'));

  // Nhân vật: gắn trực tiếp với bài học, hoặc tham gia các sự kiện / trận đánh của cửa
  const figureRows = await q<GateGuide['figures'][number] & { famous_quote: string | null }>(
    `SELECT f.id, f.name, f.honorific, f.role_text, f.famous_quote FROM hist_figures f
     WHERE f.status = 'published' AND (f.id = ANY($1) OR f.id IN (
       SELECT b_id FROM hist_links WHERE b_type = 'figure' AND ((a_type = 'battle' AND a_id = ANY($2)) OR (a_type = 'event' AND a_id = ANY($3)))))
     ORDER BY f.name`, [figures, battles, events]);
  const placeRows = await q<GateGuide['places'][number]>(
    `SELECT p.id, p.name, p.old_name FROM hist_places p WHERE p.status = 'published' AND (p.id = ANY($1) OR p.id IN (
       SELECT place_id FROM hist_events WHERE id = ANY($2) AND place_id IS NOT NULL UNION SELECT place_id FROM hist_battles WHERE id = ANY($3) AND place_id IS NOT NULL))
     ORDER BY p.name`, [places, events, battles]);
  const termRows = terms.length ? await q<GateGuide['terms'][number]>("SELECT id, term, definition FROM hist_terms WHERE id = ANY($1) AND status = 'published' ORDER BY term", [terms]) : [];
  return {
    gate, milestones,
    figures: figureRows.map(({ famous_quote: _quote, ...f }) => f),
    places: placeRows, terms: termRows,
    quotes: figureRows.filter((f) => f.famous_quote).map((f) => ({ text: f.famous_quote as string, by: f.name })),
  };
}
