/**
 * Thông báo (Sprint 11): gửi tới lớp / khối / trường / toàn hệ thống và đặt lịch gửi (HK.GV.076, HK.QT.043, HK.AD.069), sửa hoặc thu hồi cả đợt,
 * danh sách có phân loại, đánh dấu đã đọc và xóa (HK.HS.106–107, HK.GV.077–078, HK.QT.053) và thông báo tự động qua hàng đợi (HK.HS.108, HK.SYS.017):
 * nhắc học và giữ chuỗi, bài tập sắp đến hạn, lên cấp, huy hiệu mới. Mỗi người nhận một dòng `app_notifications`; thông báo tự động có khóa chống gửi trùng.
 */
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MailService } from '../admin/mail.service';
import { config } from '../config';
import { DatabaseService, Q, UserRow } from '../database/database.service';
import { ErrorLog } from './error-log';
import { SystemService } from './system.service';
import { DEFAULT_TEMPLATES, fill } from './templates';

export const CATEGORY: Record<string, 'system' | 'class' | 'achievement'> = {
  system: 'system', school: 'system', support: 'system', survey: 'system', study_reminder: 'system', backup: 'system',
  announce: 'class', assignment: 'class', event: 'class', leave: 'class', skill: 'class', reminder: 'class', goal: 'class',
  reward: 'achievement', level_up: 'achievement', badge: 'achievement', achievement: 'achievement',
};
export const categoryOf = (kind: string): 'system' | 'class' | 'achievement' => CATEGORY[kind] ?? 'system';
const kindsOf = (category: string): string[] => Object.entries(CATEGORY).filter(([, c]) => c === category).map(([k]) => k);

interface Broadcast {
  id: number; sender_id: number | null; sender_role: 'teacher' | 'school_admin' | 'root_admin'; school_id: number | null; scope: 'class' | 'grade' | 'school' | 'system';
  class_ids: number[]; grades: number[]; school_ids: number[]; roles: string[]; title: string; body: string; send_at: string; sent_at: string | null; status: 'scheduled' | 'sent' | 'cancelled'; recipients: number;
}

const BCOLS = 'id, sender_id, sender_role, school_id, scope, class_ids, grades, school_ids, roles, title, body, send_at, sent_at, status, recipients';
const ROLE_SET = new Set(['student', 'teacher', 'school_admin']);
const ymd = (d: Date, tz: string): { date: string; hour: number } => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
};

@Injectable()
export class NoticeService {
  constructor(private readonly db: DatabaseService, private readonly mail: MailService, private readonly system: SystemService) {}

  // ---------------------------------------------------------------------- danh sách và đọc / xóa (mọi vai trò)
  async list(user: UserRow, f: { category?: string; unread?: boolean; page?: number } = {}) {
    const params: unknown[] = [user.id];
    let where = 'n.user_id = $1';
    if (f.category && ['system', 'class', 'achievement'].includes(f.category)) { params.push(kindsOf(f.category)); where += ` AND n.kind = ANY($${params.length})`; }
    if (f.unread) where += ' AND n.read_at IS NULL';
    const limit = 40, offset = (Math.max(1, Number(f.page) || 1) - 1) * limit;
    const items = await this.db.query<Record<string, any>>(
      `SELECT n.id, n.kind, n.title, n.body, n.read_at, n.created_at, n.class_id, c.name AS class_name, n.ref FROM app_notifications n LEFT JOIN app_classes c ON c.id = n.class_id
       WHERE ${where} ORDER BY n.created_at DESC, n.id DESC LIMIT ${limit} OFFSET ${offset}`, params);
    const counts = await this.db.query<{ kind: string; n: number }>('SELECT kind, count(*)::int AS n FROM app_notifications WHERE user_id = $1 AND read_at IS NULL GROUP BY kind', [user.id]);
    const unread = { system: 0, class: 0, achievement: 0, total: 0 };
    for (const c of counts) { unread[categoryOf(c.kind)] += c.n; unread.total += c.n; }
    return { unread: unread.total, unread_by_category: unread, items: items.map((i) => ({ ...i, category: categoryOf(i.kind) })) };
  }

  async markRead(user: UserRow, ids?: number[]) {
    const rows = await this.db.query('UPDATE app_notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL AND ($2::int[] IS NULL OR id = ANY($2)) RETURNING id', [user.id, ids?.length ? ids : null]);
    return { marked: rows.length };
  }

  /** Xóa thông báo của chính mình: danh sách id, hoặc tất cả thông báo đã đọc khi không truyền id */
  async remove(user: UserRow, ids?: number[]) {
    const rows = await this.db.query(
      'DELETE FROM app_notifications WHERE user_id = $1 AND (($2::int[] IS NOT NULL AND id = ANY($2)) OR ($2::int[] IS NULL AND read_at IS NOT NULL)) RETURNING id', [user.id, ids?.length ? ids : null]);
    return { deleted: rows.length };
  }

  // ---------------------------------------------------------------------- người nhận
  private async recipientIds(q: Q, b: Pick<Broadcast, 'scope' | 'class_ids' | 'grades' | 'school_id' | 'school_ids' | 'roles'>): Promise<number[]> {
    const roles = b.roles.length ? b.roles : b.scope === 'system' ? ['student', 'teacher', 'school_admin'] : b.scope === 'class' ? ['student'] : ['student', 'teacher'];
    const active = "u.deleted_at IS NULL AND u.is_active = 1";
    if (b.scope === 'system') {
      const rows = await q<{ id: number }>(`SELECT u.id FROM app_users u WHERE ${active} AND u.role = ANY($1) AND ($2::int[] IS NULL OR u.school_id = ANY($2))`, [roles, b.school_ids.length ? b.school_ids : null]);
      return rows.map((r) => r.id);
    }
    if (b.scope === 'school') {
      return (await q<{ id: number }>(`SELECT u.id FROM app_users u WHERE ${active} AND u.school_id = $1 AND u.role = ANY($2)`, [b.school_id, roles])).map((r) => r.id);
    }
    // lớp hoặc khối: học sinh là thành viên lớp, giáo viên là người được phân công lớp
    const classes = b.scope === 'class' ? 'c.id = ANY($1)' : 'c.grade = ANY($1)';
    const ids = b.scope === 'class' ? b.class_ids : b.grades;
    const rows = await q<{ id: number }>(
      `SELECT DISTINCT u.id FROM app_classes c JOIN app_users u ON ${active} AND u.school_id = c.school_id
       WHERE ${classes} AND c.school_id = $2 AND c.is_active AND (
         (u.role = 'student' AND 'student' = ANY($3) AND EXISTS (SELECT 1 FROM app_class_members m WHERE m.class_id = c.id AND m.user_id = u.id))
         OR (u.role = 'teacher' AND 'teacher' = ANY($3) AND EXISTS (SELECT 1 FROM app_class_teachers t WHERE t.class_id = c.id AND t.teacher_id = u.id)))`, [ids, b.school_id, roles]);
    return rows.map((r) => r.id);
  }

  // ---------------------------------------------------------------------- soạn và kiểm tra (HK.GV.076, HK.QT.043, HK.AD.069)
  private async validate(q: Q, user: UserRow, body: Record<string, unknown>) {
    const title = String(body.title ?? '').trim(), text = String(body.body ?? '').trim();
    if (title.length < 2 || title.length > 160) throw new BadRequestException('Tiêu đề từ 2 đến 160 ký tự');
    if (text.length < 1 || text.length > 1000) throw new BadRequestException('Nội dung từ 1 đến 1000 ký tự');
    const ints = (v: unknown): number[] => (Array.isArray(v) ? v.map(Number).filter((n) => Number.isInteger(n)) : []);
    const roles = Array.isArray(body.roles) ? [...new Set(body.roles.map(String))] : [];
    if (roles.some((r) => !ROLE_SET.has(r))) throw new BadRequestException('Vai trò nhận không hợp lệ');
    let scope = String(body.scope ?? (user.role === 'teacher' ? 'class' : user.role === 'school_admin' ? 'school' : 'system'));
    const out: Pick<Broadcast, 'scope' | 'class_ids' | 'grades' | 'school_ids' | 'roles' | 'school_id'> = { scope: scope as Broadcast['scope'], class_ids: [], grades: [], school_ids: [], roles, school_id: user.school_id };

    if (user.role === 'teacher') {
      if (scope !== 'class') throw new ForbiddenException('Giáo viên chỉ gửi thông báo tới lớp mình phụ trách');
      out.roles = roles.filter((r) => r === 'student');
      out.class_ids = [...new Set(ints(body.class_ids))];
      if (!out.class_ids.length) throw new BadRequestException('Chọn ít nhất một lớp');
      const mine = await q<{ id: number }>('SELECT c.id FROM app_classes c JOIN app_class_teachers t ON t.class_id = c.id AND t.teacher_id = $2 WHERE c.id = ANY($1) AND c.school_id = $3 AND c.is_active', [out.class_ids, user.id, user.school_id]);
      if (mine.length !== out.class_ids.length) throw new NotFoundException('Có lớp không thuộc quyền phụ trách của bạn');
    } else if (user.role === 'school_admin') {
      if (!user.school_id) throw new ForbiddenException('Tài khoản chưa được gán trường');
      if (!['school', 'grade', 'class'].includes(scope)) throw new BadRequestException('Phạm vi là school, grade hoặc class');
      if (scope === 'grade') {
        out.grades = [...new Set(ints(body.grades))].filter((g) => g >= 6 && g <= 9);
        if (!out.grades.length) throw new BadRequestException('Chọn ít nhất một khối (6–9)');
      }
      if (scope === 'class') {
        out.class_ids = [...new Set(ints(body.class_ids))];
        if (!out.class_ids.length) throw new BadRequestException('Chọn ít nhất một lớp');
        const mine = await q<{ id: number }>('SELECT id FROM app_classes WHERE id = ANY($1) AND school_id = $2 AND is_active', [out.class_ids, user.school_id]);
        if (mine.length !== out.class_ids.length) throw new NotFoundException('Có lớp không thuộc trường của bạn');
      }
      if (roles.includes('school_admin')) throw new BadRequestException('Quản trị trường chỉ gửi cho học sinh và giáo viên');
    } else if (user.role === 'root_admin') {
      scope = 'system';
      out.scope = 'system';
      out.school_id = null;
      out.school_ids = [...new Set(ints(body.school_ids))];
      if (out.school_ids.length) {
        const found = await q<{ id: number }>('SELECT id FROM app_schools WHERE id = ANY($1)', [out.school_ids]);
        if (found.length !== out.school_ids.length) throw new NotFoundException('Có trường không tồn tại');
      }
    } else throw new ForbiddenException('Vai trò của bạn không gửi được thông báo');

    let sendAt = new Date();
    if (body.send_at !== undefined && body.send_at !== null && body.send_at !== '') {
      sendAt = new Date(String(body.send_at));
      if (Number.isNaN(sendAt.getTime())) throw new BadRequestException('Thời điểm gửi không hợp lệ');
      if (sendAt.getTime() > Date.now() + 366 * 86_400_000) throw new BadRequestException('Chỉ đặt lịch gửi trong vòng một năm');
      if (sendAt.getTime() < Date.now() - 60_000) throw new BadRequestException('Thời điểm gửi đã qua; bỏ trống để gửi ngay');
    }
    return { ...out, title, text, sendAt, immediate: sendAt.getTime() <= Date.now() + 5000 };
  }

  async preview(user: UserRow, body: Record<string, unknown>) {
    const v = await this.db.tx((q) => this.validate(q, user, { title: 'xem trước', body: 'xem trước', ...body }));
    const n = (await this.db.tx((q) => this.recipientIds(q, v))).length;
    return { recipients: n };
  }

  async create(user: UserRow, body: Record<string, unknown>) {
    const created = await this.db.tx(async (q) => {
      const v = await this.validate(q, user, body);
      const row = (await q<Broadcast>(
        `INSERT INTO hk_broadcasts (sender_id, sender_role, school_id, scope, class_ids, grades, school_ids, roles, title, body, send_at, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'scheduled')
         RETURNING ${BCOLS}`, [user.id, user.role, v.school_id, v.scope, v.class_ids, v.grades, v.school_ids, v.roles, v.title, v.text, v.sendAt]))[0];
      return { row, immediate: v.immediate };
    });
    const row = created.immediate ? await this.send(created.row.id) : created.row;
    return this.view(row);
  }

  /** Gửi một đợt: mỗi người nhận một dòng thông báo; chỉ gửi một lần dù được gọi nhiều lần (khóa dòng + đổi trạng thái trong cùng giao dịch) */
  async send(id: number): Promise<Broadcast> {
    return this.db.tx(async (q) => {
      const b = (await q<Broadcast>(`SELECT ${BCOLS} FROM hk_broadcasts WHERE id = $1 FOR UPDATE`, [id]))[0];
      if (!b) throw new NotFoundException('Không tìm thấy thông báo');
      if (b.status !== 'scheduled') return b;
      const ids = await this.recipientIds(q, b);
      const kind = b.scope === 'system' ? 'system' : b.scope === 'class' ? 'announce' : 'school';
      if (ids.length) {
        await q(
          `INSERT INTO app_notifications (user_id, school_id, kind, title, body, class_id, created_by, broadcast_id) SELECT u.id, u.school_id, $2, $3, $4, $5, $6, $7 FROM app_users u WHERE u.id = ANY($1)`,
          [ids, kind, b.title.slice(0, 160), b.body.slice(0, 1000), b.class_ids.length === 1 ? b.class_ids[0] : null, b.sender_id, b.id]);
      }
      return (await q<Broadcast>(`UPDATE hk_broadcasts SET status = 'sent', sent_at = now(), recipients = $2, updated_at = now() WHERE id = $1 RETURNING ${BCOLS}`, [id, ids.length]))[0];
    });
  }

  /** Việc nền: gửi các đợt đã đến giờ; trả số đợt đã gửi */
  async dispatchDue(): Promise<number> {
    const due = await this.db.query<{ id: number }>("SELECT id FROM hk_broadcasts WHERE status = 'scheduled' AND send_at <= now() ORDER BY send_at LIMIT 50");
    let n = 0;
    for (const d of due) {
      try { await this.send(d.id); n += 1; } catch (e) { ErrorLog.report('job', `Không gửi được thông báo ${d.id}: ${(e as Error).message}`); }
    }
    return n;
  }

  // ---------------------------------------------------------------------- quản lý các đợt đã soạn
  private async mine(q: Q, user: UserRow, id: number): Promise<Broadcast> {
    const b = (await q<Broadcast>(`SELECT ${BCOLS} FROM hk_broadcasts WHERE id = $1`, [id]))[0];
    const ok = b && (user.role === 'root_admin' || (user.role === 'school_admin' && b.school_id === user.school_id) || (user.role === 'teacher' && b.sender_id === user.id));
    if (!ok) throw new NotFoundException('Không tìm thấy thông báo');
    return b;
  }

  private async view(b: Broadcast) {
    const read = b.status === 'sent' ? Number((await this.db.query<{ n: string }>('SELECT count(read_at) AS n FROM app_notifications WHERE broadcast_id = $1', [b.id]))[0].n) : 0;
    const classes = b.class_ids.length ? (await this.db.query<{ name: string }>('SELECT name FROM app_classes WHERE id = ANY($1) ORDER BY name', [b.class_ids])).map((c) => c.name) : [];
    return { ...b, read, class_names: classes };
  }

  async broadcasts(user: UserRow, f: { status?: string } = {}) {
    const where: string[] = [], params: unknown[] = [];
    if (user.role === 'teacher') { params.push(user.id); where.push(`b.sender_id = $${params.length}`); }
    else if (user.role === 'school_admin') { params.push(user.school_id); where.push(`b.school_id = $${params.length}`); }
    else if (user.role !== 'root_admin') throw new ForbiddenException('Vai trò của bạn không quản lý thông báo');
    if (f.status && ['scheduled', 'sent'].includes(f.status)) { params.push(f.status); where.push(`b.status = $${params.length}`); }
    const rows = await this.db.query<Broadcast & { sender_name: string | null; read: number }>(
      `SELECT ${BCOLS.split(', ').map((c) => `b.${c}`).join(', ')}, u.full_name AS sender_name,
              (SELECT count(read_at)::int FROM app_notifications n WHERE n.broadcast_id = b.id) AS read,
              COALESCE((SELECT array_agg(c.name ORDER BY c.name) FROM app_classes c WHERE c.id = ANY(b.class_ids)), '{}') AS class_names
       FROM hk_broadcasts b LEFT JOIN app_users u ON u.id = b.sender_id ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY b.created_at DESC, b.id DESC LIMIT 100`, params);
    return rows;
  }

  async update(user: UserRow, id: number, body: Record<string, unknown>) {
    const done = await this.db.tx(async (q) => {
      const cur = await this.mine(q, user, id);
      if (cur.status === 'cancelled') throw new BadRequestException('Thông báo đã bị hủy');
      const title = body.title !== undefined ? String(body.title).trim() : cur.title, text = body.body !== undefined ? String(body.body).trim() : cur.body;
      if (title.length < 2 || title.length > 160) throw new BadRequestException('Tiêu đề từ 2 đến 160 ký tự');
      if (text.length < 1 || text.length > 1000) throw new BadRequestException('Nội dung từ 1 đến 1000 ký tự');
      if (cur.status === 'sent') {
        // đã gửi: chỉ sửa được chữ, cập nhật luôn các dòng thông báo của người nhận
        await q('UPDATE hk_broadcasts SET title = $2, body = $3, updated_at = now() WHERE id = $1', [id, title, text]);
        await q('UPDATE app_notifications SET title = $2, body = $3 WHERE broadcast_id = $1', [id, title, text]);
        return id;
      }
      const merged = await this.validate(q, user, { scope: cur.scope, class_ids: cur.class_ids, grades: cur.grades, school_ids: cur.school_ids, roles: cur.roles, ...body, title, body: text, send_at: body.send_at ?? cur.send_at });
      await q('UPDATE hk_broadcasts SET scope = $2, class_ids = $3, grades = $4, school_ids = $5, roles = $6, title = $7, body = $8, send_at = $9, updated_at = now() WHERE id = $1',
        [id, merged.scope, merged.class_ids, merged.grades, merged.school_ids, merged.roles, merged.title, merged.text, merged.sendAt]);
      return id;
    });
    const row = (await this.db.query<Broadcast>(`SELECT ${BCOLS} FROM hk_broadcasts WHERE id = $1`, [done]))[0];
    return this.view(row);
  }

  /** Xóa đợt chưa gửi (hủy lịch) hoặc thu hồi đợt đã gửi (xóa luôn thông báo của người nhận) */
  async removeBroadcast(user: UserRow, id: number) {
    return this.db.tx(async (q) => {
      const b = await this.mine(q, user, id);
      await q('DELETE FROM hk_broadcasts WHERE id = $1', [id]);
      return { deleted: true, recalled: b.status === 'sent', recipients: b.recipients };
    });
  }

  // ---------------------------------------------------------------------- thông báo tự động (HK.HS.108, HK.SYS.017)
  private async insertDeduped(q: Q, rows: Array<{ user_id: number; school_id: number | null; kind: string; title: string; body: string; key: string; class_id?: number | null }>): Promise<number> {
    let n = 0;
    for (const r of rows) {
      const res = await q(
        'INSERT INTO app_notifications (user_id, school_id, kind, title, body, class_id, dedupe_key) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING RETURNING id',
        [r.user_id, r.school_id, r.kind, r.title.slice(0, 160), r.body.slice(0, 1000), r.class_id ?? null, r.key]);
      n += res.length;
    }
    return n;
  }

  /** Nhắc học và giữ chuỗi: theo cài đặt của học sinh (HK.HS.015) hoặc mặc định 19 giờ cho em đang có chuỗi từ 2 ngày; chỉ nhắc khi hôm nay chưa học */
  async studyReminders(now = new Date()): Promise<{ notified: number; emailed: number }> {
    const tz = (await this.system.settings()).timezone;
    const { date, hour } = ymd(now, tz);
    const rows = await this.db.query<{ id: number; full_name: string; email: string | null; school_id: number | null; channel: string | null; streak: number | null }>(
      `SELECT u.id, u.full_name, u.email, u.school_id, p.reminder_channel AS channel, pl.streak_current AS streak
       FROM app_users u LEFT JOIN hk_user_prefs p ON p.user_id = u.id LEFT JOIN hk_players pl ON pl.user_id = u.id
       WHERE u.role = 'student' AND u.is_active = 1 AND u.deleted_at IS NULL
         AND ((p.reminder_enabled AND p.reminder_hour = $1) OR (NOT COALESCE(p.reminder_enabled, false) AND COALESCE(pl.streak_current, 0) >= 2 AND $1 = 19))
         AND NOT EXISTS (SELECT 1 FROM hk_events e WHERE e.user_id = u.id AND e.event IN ('lesson_complete', 'node_complete', 'attempt_finish', 'battle_finish', 'minigame_finish') AND (e.created_at AT TIME ZONE $2)::date = $3::date)
       ORDER BY u.id LIMIT 2000`, [hour, tz, date]);
    if (!rows.length) return { notified: 0, emailed: 0 };
    const tpl = (await this.mail.overrides()).reminder ?? DEFAULT_TEMPLATES.reminder;
    let notified = 0, emailed = 0;
    for (const r of rows) {
      const vars = { ten: r.full_name, chuoi: r.streak && r.streak >= 2 ? `Chuỗi ${r.streak} ngày học liên tiếp của em đang chờ.` : '', duong_dan: `${config.appUrl}/hoc-sinh` };
      const text = fill(tpl.body, vars).replace(/[ \t]+\n/g, '\n').trim();
      const title = fill(tpl.subject, vars).replace(/^\[[^\]]*\]\s*/, '') || 'Nhắc học hôm nay';
      await this.db.tx(async (q) => {
        const channel = r.channel ?? 'web';
        const key = `reminder:${date}`;
        if (channel !== 'email') notified += await this.insertDeduped(q, [{ user_id: r.id, school_id: r.school_id, kind: 'study_reminder', title, body: text, key }]);
        if ((channel === 'email' || channel === 'both') && r.email) {
          // mỗi học sinh nhận tối đa một thư nhắc học trong 20 giờ
          const sent = await q("SELECT 1 FROM app_email_outbox WHERE user_id = $1 AND kind = 'notice' AND created_at > now() - interval '20 hours' LIMIT 1", [r.id]);
          if (!sent.length) { await this.mail.enqueue(q, { school_id: r.school_id, user_id: r.id, batch_id: null, kind: 'notice', to: r.email, subject: fill(tpl.subject, vars), payload: { type: 'note', text } }); emailed += 1; }
        }
      });
    }
    if (emailed) this.mail.kick();
    return { notified, emailed };
  }

  /** Bài tập sắp đến hạn trong 24 giờ mà học sinh chưa nộp: nhắc một lần cho mỗi bài */
  async dueSoon(): Promise<number> {
    return this.db.tx(async (q) => {
      const rows = await q<{ aid: number; title: string; due_at: string; class_id: number; user_id: number; school_id: number | null }>(
        `WITH due AS (SELECT a.id, a.title, a.due_at, a.class_id, a.audience, a.team_ids, a.student_ids FROM hk_assignments a WHERE a.status = 'active' AND a.due_at > now() AND a.due_at <= now() + interval '24 hours'),
         targets AS (
           SELECT d.id AS aid, d.title, d.due_at, d.class_id, m.user_id FROM due d JOIN app_class_members m ON m.class_id = d.class_id WHERE d.audience = 'class'
           UNION SELECT d.id, d.title, d.due_at, d.class_id, tm.user_id FROM due d JOIN hk_team_members tm ON tm.team_id = ANY(d.team_ids) WHERE d.audience = 'team'
           UNION SELECT d.id, d.title, d.due_at, d.class_id, s FROM due d CROSS JOIN LATERAL unnest(d.student_ids) AS s WHERE d.audience = 'students')
         SELECT t.aid, t.title, t.due_at, t.class_id, t.user_id, u.school_id FROM targets t JOIN app_users u ON u.id = t.user_id AND u.role = 'student' AND u.is_active = 1 AND u.deleted_at IS NULL
         WHERE NOT EXISTS (SELECT 1 FROM hk_submissions s WHERE s.assignment_id = t.aid AND s.user_id = t.user_id AND s.submitted_at IS NOT NULL) LIMIT 5000`);
      const tz = (await this.system.settings()).timezone;
      return this.insertDeduped(q, rows.map((r) => ({
        user_id: r.user_id, school_id: r.school_id, kind: 'assignment', class_id: r.class_id, key: `due:${r.aid}`,
        title: `Sắp hết hạn: ${r.title}`, body: `Bài tập hết hạn lúc ${new Date(r.due_at).toLocaleString('vi-VN', { timeZone: tz, hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}. Em làm bài ngay nhé!`,
      })));
    });
  }

  /** Lên cấp và huy hiệu mới (lấy từ hàng đợi chúc mừng của trò chơi hóa trong 2 ngày gần nhất) */
  async achievements(): Promise<number> {
    const tpl = (await this.mail.overrides()).achievement ?? DEFAULT_TEMPLATES.achievement;
    return this.db.tx(async (q) => {
      const rows = await q<{ id: number; kind: string; payload: Record<string, any>; user_id: number; full_name: string; school_id: number | null }>(
        `SELECT c.id::int AS id, c.kind, c.payload, c.user_id, u.full_name, u.school_id FROM hk_celebrations c JOIN app_users u ON u.id = c.user_id AND u.role = 'student' AND u.deleted_at IS NULL
         WHERE c.kind IN ('level_up', 'badge') AND c.created_at > now() - interval '2 days' ORDER BY c.id LIMIT 2000`);
      return this.insertDeduped(q, rows.map((r) => {
        const what = r.kind === 'level_up' ? `Em vừa lên cấp ${r.payload.level}${r.payload.title ? ` – ${r.payload.title}` : ''}!` : `Em vừa nhận huy hiệu “${r.payload.name ?? 'mới'}”!`;
        const vars = { ten: r.full_name, thanh_tich: what };
        return { user_id: r.user_id, school_id: r.school_id, kind: r.kind === 'level_up' ? 'level_up' : 'badge', key: `cel:${r.id}`, title: fill(tpl.subject, vars).replace(/^\[[^\]]*\]\s*/, ''), body: fill(tpl.body, vars).trim() };
      }));
    });
  }

  async automatic(now = new Date()) {
    const reminders = await this.studyReminders(now);
    return { ...reminders, due_soon: await this.dueSoon(), achievements: await this.achievements() };
  }
}
