import { ForbiddenException, Injectable } from '@nestjs/common';
import { DatabaseService, Q, UserRow } from '../database/database.service';
import { currentContext } from '../platform/request-context';

export interface SecurityFilter {
  q?: string; school_id?: number; user_id?: number; success?: 'true' | 'false'; page?: number; limit?: number; staff_only?: boolean;
  /** Lọc theo giá trị cụ thể của từng cột (18/11/2026): ngày DD/MM/YYYY (giờ Việt Nam), người thực hiện / tài khoản, cổng, kết quả chi tiết,
   * và danh sách `action` / `user_agent` khớp nhãn thao tác / thiết bị đã chọn (dịch vụ nhật ký quy đổi nhãn ra giá trị gốc) */
  date?: string; actor?: string; username?: string; portal?: string; reason?: string; actions?: string[]; agents?: string[];
}
/** Cột lấy danh sách giá trị để lọc (facets) */
export type LogFacet = 'date' | 'actor' | 'action' | 'school' | 'username' | 'portal' | 'reason' | 'device';
@Injectable()
export class SecurityService {
  constructor(private readonly db: DatabaseService) {}
  async login(user: UserRow | null, username: string, portal: string, reason: string, q: Q = this.db.query.bind(this.db)): Promise<void> {
    const ctx = currentContext();
    await q('INSERT INTO app_login_events (user_id, school_id, username, portal, success, reason, ip, user_agent) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [user?.id ?? null, user?.school_id ?? null, username, portal, reason === 'success', reason, ctx?.ip ?? null, ctx?.ua || null]);
  }
  async audit(actor: UserRow, action: string, targetType: string, targetId: string | null, schoolId: number | null, success: boolean): Promise<void> {
    await this.db.query('INSERT INTO app_audit_events (actor_id, actor_name, actor_role, school_id, action, target_type, target_id, success) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [actor.id, actor.full_name, actor.role, schoolId, action, targetType, targetId, success]);
  }
  async events(actor: UserRow, kind: 'login' | 'audit', f: SecurityFilter) {
    if (actor.role !== 'root_admin' && actor.role !== 'school_admin') throw new ForbiddenException();
    const run = async (q: typeof this.db.query, scope: number | null) => {
      const table = kind === 'login' ? 'app_login_events' : 'app_audit_events';
      const where: string[] = [], params: unknown[] = [];
      const add = (text: string, value: unknown) => { params.push(value); where.push(text.replace('?', '$' + params.length)); };
      if (scope !== null) add('e.school_id = ?', scope); else if (f.school_id) add('e.school_id = ?', f.school_id);
      if (f.user_id) add(kind === 'login' ? 'e.user_id = ?' : 'e.actor_id = ?', f.user_id);
      if (f.success) add('e.success = ?', f.success === 'true');
      if (kind === 'audit' && f.staff_only) where.push("e.actor_role <> 'student'");
      if (f.date && /^\d{2}\/\d{2}\/\d{4}$/.test(f.date)) add("to_char(e.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY') = ?", f.date);
      if (kind === 'audit' && f.actor) add('e.actor_name = ?', f.actor);
      if (kind === 'login' && f.username) add('e.username = ?', f.username);
      if (kind === 'login' && f.portal) add('e.portal = ?', f.portal);
      if (kind === 'login' && f.reason) add('e.reason = ?', f.reason);
      if (kind === 'audit' && f.actions) add('e.action = ANY(?::text[])', f.actions);
      if (kind === 'login' && f.agents) add("COALESCE(e.user_agent, '') = ANY(?::text[])", f.agents);
      if (f.q?.trim()) add(kind === 'login' ? "e.username ILIKE ? ESCAPE '\\'" : "(e.actor_name || ' ' || e.action) ILIKE ? ESCAPE '\\'", '%' + f.q.trim().replace(/[\\%_]/g, '\\$&') + '%');
      const condition = where.length ? where.join(' AND ') : 'TRUE';
      const total = Number((await q<{ n: string }>(`SELECT count(*) AS n FROM ${table} e WHERE ${condition}`, params))[0].n);
      const page = f.page ?? 1, limit = f.limit ?? 30;
      const items = await q(`SELECT e.*, s.name AS school_name FROM ${table} e LEFT JOIN app_schools s ON s.id = e.school_id WHERE ${condition} ORDER BY e.created_at DESC, e.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, (page - 1) * limit]);
      return { total, page, limit, items: items.map(x => ({ ...x, id: Number(x.id) })) };
    };
    if (actor.role === 'root_admin') return run(this.db.query.bind(this.db), null);
    if (!actor.school_id) throw new ForbiddenException('Tài khoản chưa được gán trường');
    return this.db.scoped(actor.school_id, q => run(q, actor.school_id));
  }

  /**
   * Giá trị khác nhau của một cột nhật ký để chọn khi lọc (18/11/2026), trong phạm vi trường của người xem; `term` lọc theo chữ (không phân biệt hoa thường).
   * Thao tác / thiết bị trả giá trị gốc (`action`, `user_agent`) để dịch vụ nhật ký quy đổi ra nhãn dễ đọc.
   */
  async facets(actor: UserRow, kind: 'login' | 'audit', field: LogFacet, term: string, staffOnly: boolean): Promise<Array<{ value: string; label: string }>> {
    if (actor.role !== 'root_admin' && actor.role !== 'school_admin') throw new ForbiddenException();
    const table = kind === 'login' ? 'app_login_events' : 'app_audit_events';
    const expr: Record<string, string> = kind === 'audit'
      ? { date: "to_char(e.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY')", actor: 'e.actor_name', action: 'e.action', school: 's.name' }
      : { date: "to_char(e.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY')", username: 'e.username', portal: 'e.portal', reason: 'e.reason', device: "COALESCE(e.user_agent, '')", school: 's.name' };
    const col = expr[field];
    if (!col) return [];
    const run = async (q: typeof this.db.query, scope: number | null) => {
      const where: string[] = [`${col} IS NOT NULL`], params: unknown[] = [];
      if (scope !== null) { params.push(scope); where.push(`e.school_id = $${params.length}`); }
      if (kind === 'audit' && staffOnly) where.push("e.actor_role <> 'student'");
      const order = field === 'date' ? 'max(e.created_at) DESC' : 'v';
      const rows = await q<{ v: string; id: number | null }>(
        `SELECT ${col} AS v, ${field === 'school' ? 'min(e.school_id)' : 'NULL::int'} AS id FROM ${table} e LEFT JOIN app_schools s ON s.id = e.school_id
         WHERE ${where.join(' AND ')} GROUP BY ${col} ORDER BY ${order} LIMIT 2000`, params);
      const needle = term.trim().toLowerCase();
      return rows.map((r) => ({ value: field === 'school' ? String(r.id) : r.v, label: r.v })).filter((r) => !needle || r.label.toLowerCase().includes(needle));
    };
    if (actor.role === 'root_admin') return run(this.db.query.bind(this.db), null);
    if (!actor.school_id) throw new ForbiddenException('Tài khoản chưa được gán trường');
    return this.db.scoped(actor.school_id, q => run(q, actor.school_id));
  }
}
