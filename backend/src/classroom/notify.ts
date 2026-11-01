/** Gửi thông báo trong ứng dụng (HK.HS.104): dùng bảng app_notifications có sẵn; mỗi người nhận một dòng, cùng thời điểm tạo để gom được theo lần gửi */
import { Q } from '../database/database.service';

export interface Notice { kind: string; title: string; body: string; class_id?: number | null; ref?: unknown; by?: number | null; school_id?: number | null }

export async function notify(q: Q, userIds: number[], n: Notice): Promise<number> {
  const ids = [...new Set(userIds)];
  if (!ids.length) return 0;
  const rows = await q(
    `INSERT INTO app_notifications (user_id, school_id, kind, title, body, class_id, ref, created_by)
     SELECT u.id, COALESCE($2, u.school_id), $3, $4, $5, $6, $7, $8 FROM app_users u WHERE u.id = ANY($1) RETURNING id`,
    [ids, n.school_id ?? null, n.kind, n.title.slice(0, 160), n.body.slice(0, 1000), n.class_id ?? null, n.ref === undefined ? null : JSON.stringify(n.ref), n.by ?? null]);
  return rows.length;
}
