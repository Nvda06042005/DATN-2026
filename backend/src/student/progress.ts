/**
 * Quy tắc tiến độ dùng chung (HK.HS.019–022, HK.SYS.007; HK.GV.022–023, 026): hành trình đang học của học sinh, trạng thái từng nút, tư liệu còn khóa.
 *  - Mỗi cuộc kháng chiến học theo MỘT hành trình: hành trình giáo viên giao cho lớp đang chạy theo lịch (mới giao nhất), nếu không có thì hành trình mặc định của hệ thống.
 *  - Hành trình chưa có đường nối: nút mở theo thứ tự (nút đầu luôn mở; hoàn thành nút trước mới mở nút sau).
 *  - Hành trình có đường nối (nhánh rẽ): nút mở khi mọi nút nối vào nó đã hoàn thành (kèm điểm tối thiểu/số sao nếu giáo viên đặt) và đã tới giờ mở; nút không có đường vào là điểm xuất phát.
 *  - Tư liệu bị khóa khi nằm trong một nút của hành trình đang học mà học sinh chưa hoàn thành; tư liệu không thuộc nút nào thì mở sẵn.
 */
import { Q } from '../database/database.service';

export interface ActiveJourney { campaign_id: number; journey_id: number; title: string; from_class: boolean }
export type NodeState = 'done' | 'available' | 'locked';

/** Hành trình giáo viên giao cho lớp chỉ chạy trong khoảng thời gian đã đặt (chưa đặt thì chạy ngay và không hết hạn) */
const WINDOW = '(cj.starts_at IS NULL OR cj.starts_at <= now()) AND (cj.ends_at IS NULL OR cj.ends_at > now())';

export async function activeJourneys(q: Q, userId: number): Promise<ActiveJourney[]> {
  return q<ActiveJourney>(
    `SELECT DISTINCT ON (j.campaign_id) j.campaign_id, j.id AS journey_id, j.title, (a.journey_id IS NOT NULL) AS from_class
     FROM hk_journeys j
     JOIN hist_campaigns c ON c.id = j.campaign_id AND c.status = 'published'
     LEFT JOIN (
       SELECT cj.journey_id, max(cj.assigned_at) AS assigned_at FROM hk_class_journeys cj
       JOIN app_class_members m ON m.class_id = cj.class_id AND m.user_id = $1 WHERE ${WINDOW} GROUP BY cj.journey_id
     ) a ON a.journey_id = j.id
     WHERE j.status = 'published' AND (a.journey_id IS NOT NULL OR j.is_default)
     ORDER BY j.campaign_id, (a.journey_id IS NOT NULL) DESC, a.assigned_at DESC NULLS LAST, j.id`, [userId]);
}

export interface ProgressNode {
  id: number; journey_id: number; position: number; kind: 'lesson' | 'quiz' | 'battle' | 'source' | 'final'; title: string; icon: string | null; objective: string | null;
  lesson_id: number | null; quiz_id: number | null; source_id: number | null; battle_id: number | null; pass_percent: number | null; reward_points: number;
  pos_x: number | null; pos_y: number | null; opens_at: string | null; min_percent: number | null; min_stars: number | null; reward_gold: number; reward_card_id: number | null; reward_badge_id: number | null;
  stars: number; best_percent: number; attempts: number; completed_at: string | null; state: NodeState; lock_reason: string | null; preds: number[];
}

type Raw = Omit<ProgressNode, 'state' | 'lock_reason' | 'preds'>;
const when = (iso: string): string => new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });

/** Tính trạng thái từng nút từ tiến độ và đường nối; dùng chung cho học sinh và cho giáo viên xem trước bản đồ (HK.GV.025) */
export function computeStates(rows: Raw[], edges: Array<{ from_node: number; to_node: number }>, now: Date = new Date()): ProgressNode[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const branching = edges.length > 0;
  return rows.map((r, i) => {
    const preds = branching ? edges.filter((e) => e.to_node === r.id).map((e) => e.from_node) : i > 0 ? [rows[i - 1].id] : [];
    const done = Boolean(r.completed_at);
    let reason: string | null = null;
    if (!done) {
      for (const pid of preds) {
        const p = byId.get(pid);
        if (!p?.completed_at) { reason = `Hoàn thành "${p?.title ?? 'nút trước'}" trước`; break; }
        if (r.min_percent && p.best_percent < r.min_percent) { reason = `Đạt ít nhất ${r.min_percent}% ở "${p.title}"`; break; }
        if (r.min_stars && p.stars < r.min_stars) { reason = `Đạt ít nhất ${r.min_stars} sao ở "${p.title}"`; break; }
      }
      if (!reason && r.opens_at && new Date(r.opens_at).getTime() > now.getTime()) reason = `Mở lúc ${when(r.opens_at)}`;
    }
    return { ...r, preds, state: done ? 'done' : reason ? 'locked' : 'available', lock_reason: done ? null : reason };
  });
}

const NODE_SELECT = `n.id, n.journey_id, n.position, n.kind, n.title, n.icon, n.objective, n.lesson_id, n.quiz_id, n.source_id, n.battle_id, n.pass_percent, n.reward_points,
  n.pos_x::float8 AS pos_x, n.pos_y::float8 AS pos_y, n.opens_at, n.min_percent, n.min_stars, n.reward_gold, n.reward_card_id, n.reward_badge_id`;

export async function nodesWithState(q: Q, userId: number, journeyId: number): Promise<ProgressNode[]> {
  const rows = await q<Raw>(
    `SELECT ${NODE_SELECT}, COALESCE(p.stars, 0) AS stars, COALESCE(p.best_percent, 0) AS best_percent, COALESCE(p.attempts, 0) AS attempts, p.completed_at
     FROM hk_nodes n LEFT JOIN hk_node_progress p ON p.node_id = n.id AND p.user_id = $1
     WHERE n.journey_id = $2 ORDER BY n.position`, [userId, journeyId]);
  const edges = await q<{ from_node: number; to_node: number }>('SELECT from_node, to_node FROM hk_node_edges WHERE journey_id = $1', [journeyId]);
  return computeStates(rows, edges);
}

/** Tư liệu còn khóa của học sinh: id -> nút cần hoàn thành để mở */
export async function lockedSources(q: Q, userId: number): Promise<Map<number, { node_id: number; node_title: string }>> {
  const rows = await q<{ source_id: number; node_id: number; node_title: string }>(
    `WITH act AS (
       SELECT DISTINCT ON (j.campaign_id) j.id AS journey_id
       FROM hk_journeys j JOIN hist_campaigns c ON c.id = j.campaign_id AND c.status = 'published'
       LEFT JOIN (SELECT cj.journey_id, max(cj.assigned_at) AS assigned_at FROM hk_class_journeys cj JOIN app_class_members m ON m.class_id = cj.class_id AND m.user_id = $1 WHERE ${WINDOW} GROUP BY cj.journey_id) a ON a.journey_id = j.id
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
