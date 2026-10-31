/**
 * TM.SA-CONTENT.006 – nhật ký và sức khỏe hệ thống cho quản trị tổng: log truy cập/thao tác, lỗi nhập Excel, lỗi gửi thư và trạng thái dịch vụ.
 * Chỉ đọc dữ liệu đã có (app_login_events, app_audit_events, app_import_batches, app_email_outbox); không ghi thêm bảng và không trả mật khẩu,
 * token, nội dung thư hay địa chỉ email.
 */
import { Injectable } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { DatabaseService } from '../database/database.service';
import { MailService } from './mail.service';

export interface EventFilter { from?: string; to?: string; school_id?: number; kind?: string; level?: string; page?: number; limit?: number }

const EVENT_KINDS = ['login', 'audit', 'import', 'mail'] as const;
/** Bốn nguồn sự kiện gộp thành một dòng thời gian; level: info (bình thường), warn (cần chú ý), error (lỗi) */
const EVENTS_CTE = `WITH ev AS (
  SELECT 'login'::text AS kind, CASE WHEN success THEN 'info' ELSE 'warn' END AS level,
    CASE portal WHEN 'root_admin' THEN 'Quản trị tổng' WHEN 'school_admin' THEN 'Quản trị trường' WHEN 'teacher' THEN 'Giáo viên' WHEN 'student' THEN 'Học sinh' ELSE 'Ứng dụng' END || ' · ' ||
    CASE WHEN success THEN 'đăng nhập thành công' ELSE 'đăng nhập thất bại (' || CASE reason WHEN 'credentials' THEN 'sai thông tin' WHEN 'locked' THEN 'tài khoản bị khóa' WHEN 'deleted' THEN 'tài khoản đã xóa' WHEN 'portal' THEN 'sai cổng đăng nhập' WHEN 'rate_limit' THEN 'thử quá nhiều lần' ELSE reason END || ')' END AS title,
    username AS actor, NULL::text AS detail, school_id, created_at FROM app_login_events
  UNION ALL
  SELECT 'audit', CASE WHEN success THEN 'info' ELSE 'error' END, action, actor_name, nullif(concat_ws(' ', target_type, target_id), ''), school_id, created_at FROM app_audit_events
  UNION ALL
  SELECT 'import', CASE WHEN b.error_count > 0 THEN 'error' ELSE 'warn' END, 'Nhập tệp ' || b.file_name, u.full_name,
    b.error_count || ' dòng lỗi, ' || b.incomplete_count || ' dòng thiếu thông tin trên ' || b.total_rows || ' dòng', b.school_id, b.created_at
    FROM app_import_batches b LEFT JOIN app_users u ON u.id = b.uploaded_by WHERE b.error_count > 0 OR b.incomplete_count > 0
  UNION ALL
  SELECT 'mail', 'error', 'Gửi thư thất bại (' || kind || ', ' || attempts || ' lần thử)', NULL, last_error, school_id, created_at FROM app_email_outbox WHERE status = 'failed'
)`;
/** Ngày lọc tính theo giờ Việt Nam: [từ 00:00 ngày bắt đầu, trước 00:00 ngày sau ngày kết thúc) */
const EVENTS_WHERE = `($1::date IS NULL OR ev.created_at >= ($1::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'))
  AND ($2::date IS NULL OR ev.created_at < (($2::date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')) AND ($3::integer IS NULL OR ev.school_id = $3) AND ($4::text IS NULL OR ev.level = $4)`;

@Injectable()
export class SystemService {
  constructor(private readonly db: DatabaseService, private readonly ai: AiService, private readonly mail: MailService) {}

  async events(f: EventFilter) {
    const limit = Math.min(Math.max(f.limit ?? 30, 1), 100), page = Math.max(f.page ?? 1, 1);
    const base = [f.from ?? null, f.to ?? null, f.school_id ?? null, f.level ?? null];
    const [items, counts] = await Promise.all([
      this.db.query(`${EVENTS_CTE} SELECT ev.kind, ev.level, ev.title, ev.actor, ev.detail, ev.school_id, s.name AS school_name, ev.created_at FROM ev LEFT JOIN app_schools s ON s.id = ev.school_id
        WHERE ${EVENTS_WHERE} AND ($5::text IS NULL OR ev.kind = $5) ORDER BY ev.created_at DESC LIMIT $6 OFFSET $7`, [...base, f.kind ?? null, limit + 1, (page - 1) * limit]),
      this.db.query<{ kind: string; n: number }>(`${EVENTS_CTE} SELECT ev.kind, count(*)::int AS n FROM ev WHERE ${EVENTS_WHERE} GROUP BY ev.kind`, base),
    ]);
    const byKind = Object.fromEntries(EVENT_KINDS.map((k) => [k, counts.find((c) => c.kind === k)?.n ?? 0]));
    const total = f.kind ? byKind[f.kind] ?? 0 : Object.values(byKind).reduce((a, b) => a + b, 0);
    return { items: items.slice(0, limit), page, limit, has_more: items.length > limit, total, counts: byKind, schools: await this.db.query('SELECT id, name FROM app_schools ORDER BY name, id') };
  }

  async health() {
    const started = Date.now();
    const settle = async <T>(run: () => Promise<T>): Promise<T | null> => {
      try {
        return await run();
      } catch {
        return null;
      }
    };
    const [dbOk, migrations, mail, imports, logins] = await Promise.all([
      settle(() => this.db.ping()),
      settle(() => this.db.query<{ applied: number; latest: number | null }>('SELECT count(*)::int AS applied, max(version)::int AS latest FROM public.app_schema_migrations')),
      settle(() => this.db.query<{ queued: number; failed: number; sent_24h: number }>("SELECT count(*) FILTER (WHERE status IN ('queued', 'sending'))::int AS queued, count(*) FILTER (WHERE status = 'failed')::int AS failed, count(*) FILTER (WHERE status = 'sent' AND sent_at > now() - interval '24 hours')::int AS sent_24h FROM app_email_outbox")),
      settle(() => this.db.query<{ batches_24h: number; error_rows_24h: number; open_incomplete: number }>("SELECT count(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS batches_24h, coalesce(sum(error_count) FILTER (WHERE created_at > now() - interval '24 hours'), 0)::int AS error_rows_24h, (SELECT count(*)::int FROM app_incomplete_import_logs WHERE resolved_at IS NULL) AS open_incomplete FROM app_import_batches")),
      settle(() => this.db.query<{ failed_24h: number; locked_24h: number }>("SELECT count(*) FILTER (WHERE NOT success)::int AS failed_24h, count(*) FILTER (WHERE reason = 'rate_limit')::int AS locked_24h FROM app_login_events WHERE created_at > now() - interval '24 hours'")),
    ]);
    const aiStart = Date.now(), aiOk = await settle(() => this.ai.health());
    const mailRow = mail?.[0];
    return {
      generated_at: new Date().toISOString(),
      api: { status: 'ok', uptime_seconds: Math.round(process.uptime()), response_ms: Date.now() - started },
      database: { status: dbOk ? 'ok' : 'error', schema_version: Number(migrations?.[0]?.latest ?? 0), migrations: migrations?.[0]?.applied ?? 0, school_scope_rls: this.db.rlsReady, pgvector: this.db.vectorSchema !== null },
      ai: { status: aiOk ? 'ok' : 'unavailable', latency_ms: aiOk ? Date.now() - aiStart : null },
      mail: { configured: this.mail.configured, worker: this.mail.workerEnabled, queued: mailRow?.queued ?? 0, failed: mailRow?.failed ?? 0, sent_24h: mailRow?.sent_24h ?? 0 },
      imports: imports?.[0] ?? { batches_24h: 0, error_rows_24h: 0, open_incomplete: 0 },
      logins: logins?.[0] ?? { failed_24h: 0, locked_24h: 0 },
    };
  }
}
