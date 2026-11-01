/**
 * Thống kê theo chủ đề (Sprint 10, HK.HS.095, GV.068, SYS.012–013): mỗi câu hỏi gắn với nhân vật / sự kiện / địa danh / trận đánh / tư liệu / cuộc kháng chiến qua bảng liên kết;
 * tỉ lệ đúng của một học sinh (hoặc cả lớp) theo từng chủ đề cho biết điểm mạnh, điểm yếu. Chỉ tính lượt làm bài thật (không tính bản xem thử của giáo viên).
 */
import { Q } from '../database/database.service';

export type TopicType = 'campaign' | 'figure' | 'event' | 'place' | 'battle' | 'source';
export const TOPIC_LABEL: Record<TopicType, string> = { campaign: 'Cuộc kháng chiến', figure: 'Nhân vật', event: 'Sự kiện', place: 'Địa danh', battle: 'Trận đánh', source: 'Tư liệu' };
const TABLE: Record<TopicType, [string, string]> = {
  campaign: ['hist_campaigns', 'title'], figure: ['hist_figures', 'name'], event: ['hist_events', 'name'], place: ['hist_places', 'name'], battle: ['hist_battles', 'name'], source: ['hist_sources', 'title'],
};

export interface TopicRow { type: TopicType; id: number; name: string; answered: number; correct: number; percent: number; last_at: string | null; level: 'strong' | 'ok' | 'weak' | 'new' }

/** Mức của một chủ đề theo ngưỡng cấu hình: chưa đủ số câu tối thiểu → mới; dưới ngưỡng → yếu; từ 85% → mạnh */
export function levelOf(answered: number, percent: number, weakThreshold: number, minAnswers: number): TopicRow['level'] {
  if (answered < minAnswers) return 'new';
  if (percent < weakThreshold) return 'weak';
  return percent >= 85 ? 'strong' : 'ok';
}

/**
 * Tỉ lệ đúng theo chủ đề của các học sinh (gộp lại). Một câu có thể gắn nhiều chủ đề nên được tính cho từng chủ đề đó;
 * câu có `campaign_id` được tính cho cuộc kháng chiến tương ứng.
 */
export async function topicStats(q: Q, userIds: number[], opts: { weakThreshold: number; minAnswers: number; since?: string }): Promise<TopicRow[]> {
  if (!userIds.length) return [];
  const params: unknown[] = [userIds];
  const since = opts.since ? (params.push(opts.since), `AND a.answered_at >= $${params.length}`) : '';
  const rows = await q<{ type: TopicType; id: number; answered: number; correct: number; last_at: string | null }>(
    `WITH ans AS (
       SELECT a.question_id, a.correct, a.answered_at FROM hk_attempt_answers a JOIN hk_attempts t ON t.id = a.attempt_id
       WHERE t.user_id = ANY($1) AND t.mode <> 'preview' ${since}
     ), tagged AS (
       SELECT l.ref_type AS type, l.ref_id AS id, ans.correct, ans.answered_at FROM ans JOIN hk_question_links l ON l.question_id = ans.question_id
       UNION ALL
       SELECT 'campaign', t.campaign_id, ans.correct, ans.answered_at FROM ans JOIN hk_questions t ON t.id = ans.question_id
       WHERE t.campaign_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM hk_question_links l2 WHERE l2.question_id = t.id AND l2.ref_type = 'campaign' AND l2.ref_id = t.campaign_id)
     )
     SELECT type, id, count(*)::int AS answered, count(*) FILTER (WHERE correct)::int AS correct, max(answered_at) AS last_at FROM tagged GROUP BY type, id`, params);
  const names = new Map<string, string>();
  for (const type of Object.keys(TABLE) as TopicType[]) {
    const ids = rows.filter((r) => r.type === type).map((r) => r.id);
    if (!ids.length) continue;
    const [table, col] = TABLE[type];
    for (const n of await q<{ id: number; name: string }>(`SELECT id, ${col} AS name FROM ${table} WHERE id = ANY($1)`, [ids])) names.set(`${type}:${n.id}`, n.name);
  }
  return rows.filter((r) => names.has(`${r.type}:${r.id}`)).map((r) => {
    const percent = Math.round((r.correct / r.answered) * 100);
    return { ...r, name: names.get(`${r.type}:${r.id}`)!, percent, level: levelOf(r.answered, percent, opts.weakThreshold, opts.minAnswers) };
  }).sort((a, b) => a.percent - b.percent || b.answered - a.answered);
}

/** Tổng hợp theo loại chủ đề (cho biểu đồ): số câu, số đúng, tỉ lệ */
export function byType(rows: TopicRow[]): Array<{ type: TopicType; label: string; answered: number; correct: number; percent: number | null; topics: number }> {
  return (Object.keys(TOPIC_LABEL) as TopicType[]).map((type) => {
    const list = rows.filter((r) => r.type === type);
    const answered = list.reduce((n, r) => n + r.answered, 0), correct = list.reduce((n, r) => n + r.correct, 0);
    return { type, label: TOPIC_LABEL[type], answered, correct, percent: answered ? Math.round((correct / answered) * 100) : null, topics: list.length };
  });
}
