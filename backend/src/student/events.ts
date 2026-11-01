/** Ghi nhận sự kiện học tập (HK.SYS.014): chỉ thêm, làm dữ liệu cho báo cáo và AI ở các sprint sau. Lỗi ghi sự kiện không làm hỏng thao tác của học sinh. */
import { Logger } from '@nestjs/common';
import { DatabaseService, Q, UserRow } from '../database/database.service';

const logger = new Logger('LearningEvents');

export async function logEvent(
  db: DatabaseService | null, user: UserRow, event: string, refType: string | null, refId: number | null, nodeId?: number | null, value?: Record<string, unknown> | null,
  durationMs?: number | null, q?: Q,
): Promise<void> {
  try {
    const run: Q = q ?? ((sql, params) => db!.query(sql, params));
    await run(
      'INSERT INTO hk_events (user_id, school_id, event, ref_type, ref_id, node_id, value, duration_ms) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [user.id, user.school_id, event, refType, refId, nodeId ?? null, value ? JSON.stringify(value) : null, durationMs ?? null]);
  } catch (e) {
    logger.warn(`Không ghi được sự kiện ${event}: ${(e as Error).message}`);
  }
}
