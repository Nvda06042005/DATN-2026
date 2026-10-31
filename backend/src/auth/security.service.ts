import { ForbiddenException, Injectable } from '@nestjs/common';
import { DatabaseService, Q, UserRow } from '../database/database.service';

export interface SecurityFilter { q?: string; school_id?: number; user_id?: number; success?: 'true' | 'false'; page?: number; limit?: number }
@Injectable()
export class SecurityService {
  constructor(private readonly db: DatabaseService) {}
  async login(user: UserRow | null, username: string, portal: string, reason: string, q: Q = this.db.query.bind(this.db)): Promise<void> {
    await q('INSERT INTO app_login_events (user_id, school_id, username, portal, success, reason) VALUES ($1,$2,$3,$4,$5,$6)', [user?.id ?? null, user?.school_id ?? null, username, portal, reason === 'success', reason]);
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
}
