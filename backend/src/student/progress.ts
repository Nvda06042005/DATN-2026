/**
 * Quy tắc tiến độ dùng chung (HK.HS.019–022, HK.SYS.007): hành trình đang học của học sinh, trạng thái từng nút, tư liệu còn khóa.
 *  - Mỗi cuộc kháng chiến học theo MỘT hành trình: hành trình giáo viên giao cho lớp (mới giao nhất), nếu không có thì hành trình mặc định của hệ thống.
 *  - Nút mở theo thứ tự: nút đầu luôn mở; hoàn thành nút trước mới mở nút sau.
 *  - Tư liệu bị khóa khi nằm trong một nút của hành trình đang học mà học sinh chưa hoàn thành; tư liệu không thuộc nút nào thì mở sẵn.
 */
import { Q } from '../database/database.service';

export interface ActiveJourney { campaign_id: number; journey_id: number; title: string; from_class: boolean }
export type NodeState = 'done' | 'available' | 'locked';

export async function activeJourneys(q: Q, userId: number): Promise<ActiveJourney[]> {
  return q<ActiveJourney>(
    `SELECT DISTINCT ON (j.campaign_id) j.campaign_id, j.id AS journey_id, j.title, (a.journey_id IS NOT NULL) AS from_class
     FROM hk_journeys j
     JOIN hist_campaigns c ON c.id = j.campaign_id AND c.status = 'published'
     LEFT JOIN (
       SELECT cj.journey_id, max(cj.assigned_at) AS assigned_at FROM hk_class_journeys cj
       JOIN app_class_members m ON m.class_id = cj.class_id AND m.user_id = $1 GROUP BY cj.journey_id
     ) a ON a.journey_id = j.id
     WHERE j.status = 'published' AND (a.journey_id IS NOT NULL OR j.is_default)
     ORDER BY j.campaign_id, (a.journey_id IS NOT NULL) DESC, a.assigned_at DESC NULLS LAST, j.id`, [userId]);
}

export interface ProgressNode {
  id: number; journey_id: number; position: number; kind: 'lesson' | 'quiz' | 'battle' | 'source' | 'final'; title: string; icon: string | null; objective: string | null;
  lesson_id: number | null; quiz_id: number | null; source_id: number | null; battle_id: number | null; pass_percent: number | null; reward_points: number;
  stars: number; best_percent: number; attempts: number; completed_at: string | null; state: NodeState;
}

export async function nodesWithState(q: Q, userId: number, journeyId: number): Promise<ProgressNode[]> {
  const rows = await q<Omit<ProgressNode, 'state'>>(
    `SELECT n.id, n.journey_id, n.position, n.kind, n.title, n.icon, n.objective, n.lesson_id, n.quiz_id, n.source_id, n.battle_id, n.pass_percent, n.reward_points,
            COALESCE(p.stars, 0) AS stars, COALESCE(p.best_percent, 0) AS best_percent, COALESCE(p.attempts, 0) AS attempts, p.completed_at
     FROM hk_nodes n LEFT JOIN hk_node_progress p ON p.node_id = n.id AND p.user_id = $1
     WHERE n.journey_id = $2 ORDER BY n.position`, [userId, journeyId]);
  let allBeforeDone = true;
  return rows.map((r) => {
    const done = Boolean(r.completed_at);
    const state: NodeState = done ? 'done' : allBeforeDone ? 'available' : 'locked';
    if (!done) allBeforeDone = false;
    return { ...r, state };
  });
}

/** Tư liệu còn khóa của học sinh: id -> nút cần hoàn thành để mở */
export async function lockedSources(q: Q, userId: number): Promise<Map<number, { node_id: number; node_title: string }>> {
  const rows = await q<{ source_id: number; node_id: number; node_title: string }>(
    `WITH act AS (
       SELECT DISTINCT ON (j.campaign_id) j.id AS journey_id
       FROM hk_journeys j JOIN hist_campaigns c ON c.id = j.campaign_id AND c.status = 'published'
       LEFT JOIN (SELECT cj.journey_id, max(cj.assigned_at) AS assigned_at FROM hk_class_journeys cj JOIN app_class_members m ON m.class_id = cj.class_id AND m.user_id = $1 GROUP BY cj.journey_id) a ON a.journey_id = j.id
       WHERE j.status = 'published' AND (a.journey_id IS NOT NULL OR j.is_default)
       ORDER BY j.campaign_id, (a.journey_id IS NOT NULL) DESC, a.assigned_at DESC NULLS LAST, j.id
     ), gated AS (
       SELECT u.source_id, n.id AS node_id, n.title AS node_title, n.position FROM hk_node_unlocks u JOIN hk_nodes n ON n.id = u.node_id WHERE n.journey_id IN (SELECT journey_id FROM act)
       UNION ALL
       SELECT n.source_id, n.id, n.title, n.position FROM hk_nodes n WHERE n.kind = 'source' AND n.journey_id IN (SELECT journey_id FROM act)
     )
     SELECT DISTINCT ON (g.source_id) g.source_id, g.node_id, g.node_title FROM gated g
     WHERE NOT EXISTS (SELECT 1 FROM hk_unlocked_sources us WHERE us.user_id = $1 AND us.source_id = g.source_id)
     ORDER BY g.source_id, g.position`, [userId]);
  return new Map(rows.map((r) => [r.source_id, { node_id: r.node_id, node_title: r.node_title }]));
}

/** Chuỗi ngày học liên tiếp, tính theo giờ Việt Nam đến hôm nay (hoặc hôm qua nếu hôm nay chưa học) */
export async function streakDays(q: Q, userId: number): Promise<number> {
  const rows = await q<{ d: string }>(
    `SELECT DISTINCT to_char((created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, 'YYYY-MM-DD') AS d FROM hk_events
     WHERE user_id = $1 AND event IN ('answer', 'node_complete', 'lesson_complete', 'view_lesson', 'view_source') ORDER BY d DESC LIMIT 400`, [userId]);
  const days = new Set(rows.map((r) => r.d));
  const fmt = (t: number) => new Date(t).toISOString().slice(0, 10);
  const vn = Date.now() + 7 * 3600_000;
  let cursor = vn;
  if (!days.has(fmt(cursor))) cursor -= 86400_000;
  let n = 0;
  while (days.has(fmt(cursor))) { n += 1; cursor -= 86400_000; }
  return n;
}
