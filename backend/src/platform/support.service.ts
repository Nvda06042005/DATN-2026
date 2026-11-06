/**
 * Hỗ trợ và hướng dẫn (Sprint 11): gửi yêu cầu hỗ trợ / báo lỗi kèm ảnh chụp màn hình (HK.HS.111, HK.GV.081, HK.QT.052), quản trị viên tổng xem danh sách, phản hồi và đổi
 * trạng thái Mới / Đang xử lý / Đã xong (HK.AD.073, HK.AD.074), cùng kho hướng dẫn và câu hỏi thường gặp theo vai trò (HK.HS.110, HK.GV.080, HK.QT.054, HK.AD.067).
 * Ảnh (png, jpeg, webp, tối đa 1,5 MB) được kiểm tra chữ ký tệp và lưu trong cơ sở dữ liệu cùng yêu cầu; chỉ người gửi và quản trị tổng xem được.
 */
import { BadRequestException, ForbiddenException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, Q, UserRow } from '../database/database.service';

const MAX_IMAGE = 1_500_000;
const CATEGORIES = ['bug', 'feedback', 'question', 'account'];
const STATUSES = ['new', 'processing', 'done'];
const TICKET_COLS = 't.id::int AS id, t.user_id, t.school_id, t.role, t.category, t.subject, t.body, t.status, t.page, t.attachment_name, (t.attachment IS NOT NULL) AS has_attachment, t.created_at, t.updated_at';

function sniff(buf: Buffer): 'image/png' | 'image/jpeg' | 'image/webp' | null {
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}

@Injectable()
export class SupportService {
  constructor(private readonly db: DatabaseService) {}

  async create(user: UserRow, body: Record<string, unknown>) {
    if (user.role === 'root_admin') throw new ForbiddenException('Quản trị viên tổng xử lý yêu cầu, không gửi yêu cầu cho chính mình');
    const category = String(body.category ?? 'bug');
    if (!CATEGORIES.includes(category)) throw new BadRequestException('Loại yêu cầu là bug, feedback, question hoặc account');
    const subject = String(body.subject ?? '').trim(), text = String(body.body ?? '').trim();
    if (subject.length < 3 || subject.length > 160) throw new BadRequestException('Tiêu đề từ 3 đến 160 ký tự');
    if (text.length < 5 || text.length > 3000) throw new BadRequestException('Nội dung từ 5 đến 3000 ký tự');
    const page = body.page ? String(body.page).slice(0, 200) : null;
    let image: { name: string; mime: string; data: Buffer } | null = null;
    const att = body.attachment as { name?: string; data?: string } | undefined | null;
    if (att?.data) {
      const raw = String(att.data).replace(/^data:[^;]+;base64,/, '');
      const buf = Buffer.from(raw, 'base64');
      if (!buf.length || buf.length > MAX_IMAGE) throw new BadRequestException('Ảnh chụp màn hình tối đa 1,5 MB');
      const mime = sniff(buf);
      if (!mime) throw new BadRequestException('Ảnh phải là png, jpeg hoặc webp');
      image = { name: String(att.name ?? 'anh-chup-man-hinh').replace(/[^\p{L}\p{N}._ -]/gu, '').slice(0, 80) || 'anh-chup-man-hinh', mime, data: buf };
    }
    const recent = Number((await this.db.query<{ n: string }>("SELECT count(*) AS n FROM hk_support_tickets WHERE user_id = $1 AND created_at > now() - interval '24 hours'", [user.id]))[0].n);
    if (recent >= 5) throw new HttpException('Bạn đã gửi 5 yêu cầu trong 24 giờ qua. Hãy chờ phản hồi hoặc thử lại vào ngày mai.', 429);
    return this.db.tx(async (q) => {
      const t = (await q<{ id: number }>(
        `INSERT INTO hk_support_tickets (user_id, school_id, role, category, subject, body, page, attachment_name, attachment_mime, attachment) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id::int AS id`,
        [user.id, user.school_id, user.role, category, subject, text, page, image?.name ?? null, image?.mime ?? null, image?.data ?? null]))[0];
      await q(
        `INSERT INTO app_notifications (user_id, school_id, kind, title, body, ref) SELECT u.id, NULL, 'support', $1, $2, $3 FROM app_users u WHERE u.role = 'root_admin' AND u.is_active = 1 AND u.deleted_at IS NULL`,
        [`Yêu cầu hỗ trợ mới: ${subject}`.slice(0, 160), `${user.full_name} (${user.role}) vừa gửi yêu cầu.`, JSON.stringify({ ticket_id: t.id })]);
      return this.detail(user, t.id, q);
    });
  }

  mine(user: UserRow) {
    return this.db.query(
      `SELECT ${TICKET_COLS}, (SELECT count(*)::int FROM hk_support_messages m WHERE m.ticket_id = t.id) AS replies FROM hk_support_tickets t WHERE t.user_id = $1 ORDER BY t.created_at DESC, t.id DESC LIMIT 50`, [user.id]);
  }

  async detail(user: UserRow, id: number, q: Q = this.db.query.bind(this.db) as Q): Promise<Record<string, any>> {
    const t = (await q<Record<string, any>>(`SELECT ${TICKET_COLS}, u.full_name AS user_name, s.name AS school_name FROM hk_support_tickets t JOIN app_users u ON u.id = t.user_id LEFT JOIN app_schools s ON s.id = t.school_id WHERE t.id = $1`, [id]))[0];
    if (!t || (user.role !== 'root_admin' && t.user_id !== user.id)) throw new NotFoundException('Không tìm thấy yêu cầu hỗ trợ');
    const messages = await q('SELECT m.id::int AS id, m.author_role, m.body, m.created_at, u.full_name AS author_name FROM hk_support_messages m LEFT JOIN app_users u ON u.id = m.author_id WHERE m.ticket_id = $1 ORDER BY m.id', [id]);
    return { ...t, messages };
  }

  async reply(user: UserRow, id: number, body: Record<string, unknown>) {
    const text = String(body.body ?? '').trim();
    if (text.length < 1 || text.length > 3000) throw new BadRequestException('Nội dung từ 1 đến 3000 ký tự');
    return this.db.tx(async (q) => {
      const t = await this.detail(user, id, q);
      await q('INSERT INTO hk_support_messages (ticket_id, author_id, author_role, body) VALUES ($1, $2, $3, $4)', [id, user.id, user.role, text]);
      if (user.role === 'root_admin') {
        await q("UPDATE hk_support_tickets SET status = CASE WHEN status = 'new' THEN 'processing' ELSE status END, handled_by = $2, updated_at = now() WHERE id = $1", [id, user.id]);
        await q(`INSERT INTO app_notifications (user_id, school_id, kind, title, body, ref) VALUES ($1, $2, 'support', $3, $4, $5)`,
          [t.user_id, t.school_id, `Phản hồi yêu cầu hỗ trợ: ${t.subject}`.slice(0, 160), text.slice(0, 300), JSON.stringify({ ticket_id: id })]);
      } else {
        await q("UPDATE hk_support_tickets SET status = CASE WHEN status = 'done' THEN 'new' ELSE status END, updated_at = now() WHERE id = $1", [id]);
      }
      return this.detail(user, id, q);
    });
  }

  // ---------------------------------------------------------------------- quản trị tổng (HK.AD.073, HK.AD.074)
  async list(user: UserRow, f: { status?: string; role?: string; q?: string; page?: number }) {
    if (user.role !== 'root_admin') throw new ForbiddenException('Chỉ quản trị viên tổng xem danh sách yêu cầu hỗ trợ');
    const where: string[] = [], params: unknown[] = [];
    const add = (sql: string, v: unknown) => { params.push(v); where.push(sql.replace('?', `$${params.length}`)); };
    if (f.status && STATUSES.includes(f.status)) add('t.status = ?', f.status);
    if (f.role && ['student', 'teacher', 'school_admin'].includes(f.role)) add('t.role = ?', f.role);
    if (f.q?.trim()) add("(t.subject || ' ' || t.body || ' ' || u.full_name) ILIKE ? ESCAPE '\\'", `%${f.q.trim().replace(/[\\%_]/g, '\\$&')}%`);
    const cond = where.length ? where.join(' AND ') : 'TRUE';
    const limit = 30, page = Math.max(1, Number(f.page) || 1);
    const total = Number((await this.db.query<{ n: string }>(`SELECT count(*) AS n FROM hk_support_tickets t JOIN app_users u ON u.id = t.user_id WHERE ${cond}`, params))[0].n);
    const items = await this.db.query(
      `SELECT ${TICKET_COLS}, u.full_name AS user_name, s.name AS school_name, (SELECT count(*)::int FROM hk_support_messages m WHERE m.ticket_id = t.id) AS replies
       FROM hk_support_tickets t JOIN app_users u ON u.id = t.user_id LEFT JOIN app_schools s ON s.id = t.school_id WHERE ${cond}
       ORDER BY CASE t.status WHEN 'new' THEN 0 WHEN 'processing' THEN 1 ELSE 2 END, t.created_at DESC LIMIT ${limit} OFFSET ${(page - 1) * limit}`, params);
    const counts = await this.db.query<{ status: string; n: number }>('SELECT status, count(*)::int AS n FROM hk_support_tickets GROUP BY status');
    return { total, page, limit, items, counts: Object.fromEntries(counts.map((c) => [c.status, c.n])) };
  }

  async setStatus(user: UserRow, id: number, status: unknown) {
    if (user.role !== 'root_admin') throw new ForbiddenException('Chỉ quản trị viên tổng đổi trạng thái yêu cầu');
    if (typeof status !== 'string' || !STATUSES.includes(status)) throw new BadRequestException('Trạng thái là new, processing hoặc done');
    return this.db.tx(async (q) => {
      const t = await this.detail(user, id, q);
      await q('UPDATE hk_support_tickets SET status = $2, handled_by = $3, updated_at = now() WHERE id = $1', [id, status, user.id]);
      if (status !== t.status) {
        await q(`INSERT INTO app_notifications (user_id, school_id, kind, title, body, ref) VALUES ($1, $2, 'support', $3, $4, $5)`,
          [t.user_id, t.school_id, `Yêu cầu hỗ trợ “${t.subject}”`.slice(0, 160), `Trạng thái mới: ${{ new: 'Mới', processing: 'Đang xử lý', done: 'Đã xong' }[status]}.`, JSON.stringify({ ticket_id: id })]);
      }
      return this.detail(user, id, q);
    });
  }

  async attachment(user: UserRow, id: number): Promise<{ mime: string; data: Buffer; name: string }> {
    const t = (await this.db.query<{ user_id: number; attachment: Buffer | null; attachment_mime: string | null; attachment_name: string | null }>('SELECT user_id, attachment, attachment_mime, attachment_name FROM hk_support_tickets WHERE id = $1', [id]))[0];
    if (!t || !t.attachment || (user.role !== 'root_admin' && t.user_id !== user.id)) throw new NotFoundException('Không có ảnh đính kèm');
    return { mime: t.attachment_mime ?? 'image/png', data: t.attachment, name: t.attachment_name ?? 'anh' };
  }
}

// ---------------------------------------------------------------------- hướng dẫn và câu hỏi thường gặp
const AUDIENCES = ['student', 'teacher', 'school_admin', 'all'];

@Injectable()
export class FaqService {
  constructor(private readonly db: DatabaseService) {}

  /** Người dùng thấy mục dành cho vai trò của mình và mục chung; quản trị tổng thấy mọi mục đã xuất bản */
  async forUser(user: UserRow) {
    const audiences = user.role === 'root_admin' ? AUDIENCES : [user.role, 'all'];
    const items = await this.db.query('SELECT id::int AS id, audience, category, question, answer, image_url, video_url FROM hk_faq WHERE is_published AND audience = ANY($1) ORDER BY (audience = \'all\'), position, id', [audiences]);
    return { audience: user.role, items };
  }

  all(user: UserRow) {
    if (user.role !== 'root_admin') throw new ForbiddenException('Chỉ quản trị viên tổng quản lý hướng dẫn');
    return this.db.query('SELECT id::int AS id, audience, category, question, answer, image_url, video_url, position, is_published, updated_at FROM hk_faq ORDER BY audience, position, id');
  }

  private clean(body: Record<string, unknown>, cur?: Record<string, any>) {
    const has = (k: string): boolean => Object.prototype.hasOwnProperty.call(body, k);
    const get = (k: string): any => (has(k) ? body[k] : cur?.[k]);
    const audience = String(get('audience') ?? '');
    if (!AUDIENCES.includes(audience)) throw new BadRequestException('Đối tượng là student, teacher, school_admin hoặc all');
    const category = String(get('category') ?? '').trim(), question = String(get('question') ?? '').trim(), answer = String(get('answer') ?? '').trim();
    if (!category || category.length > 60) throw new BadRequestException('Nhóm từ 1 đến 60 ký tự');
    if (question.length < 3 || question.length > 200) throw new BadRequestException('Câu hỏi từ 3 đến 200 ký tự');
    if (answer.length < 3 || answer.length > 4000) throw new BadRequestException('Nội dung từ 3 đến 4000 ký tự');
    const link = (k: string): string | null => {
      const v = get(k);
      if (v === null || v === undefined || String(v).trim() === '') return null;
      if (!/^https:\/\/\S+$/.test(String(v).trim()) || String(v).length > 500) throw new BadRequestException('Liên kết ảnh / video phải bắt đầu bằng https://');
      return String(v).trim();
    };
    const position = Number(get('position') ?? 0);
    if (!Number.isInteger(position) || position < 0 || position > 10000) throw new BadRequestException('Thứ tự là số nguyên từ 0 đến 10000');
    return { audience, category, question, answer, image_url: link('image_url'), video_url: link('video_url'), position, is_published: has('is_published') ? Boolean(body.is_published) : cur?.is_published ?? true };
  }

  async create(user: UserRow, body: Record<string, unknown>) {
    if (user.role !== 'root_admin') throw new ForbiddenException('Chỉ quản trị viên tổng quản lý hướng dẫn');
    const v = this.clean(body);
    return (await this.db.query(
      `INSERT INTO hk_faq (audience, category, question, answer, image_url, video_url, position, is_published, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id::int AS id, audience, category, question, answer, image_url, video_url, position, is_published, updated_at`, [v.audience, v.category, v.question, v.answer, v.image_url, v.video_url, v.position, v.is_published, user.id]))[0];
  }

  async update(user: UserRow, id: number, body: Record<string, unknown>) {
    if (user.role !== 'root_admin') throw new ForbiddenException('Chỉ quản trị viên tổng quản lý hướng dẫn');
    const cur = (await this.db.query<Record<string, any>>('SELECT * FROM hk_faq WHERE id = $1', [id]))[0];
    if (!cur) throw new NotFoundException('Không tìm thấy mục hướng dẫn');
    const v = this.clean(body, cur);
    return (await this.db.query(
      `UPDATE hk_faq SET audience = $2, category = $3, question = $4, answer = $5, image_url = $6, video_url = $7, position = $8, is_published = $9, updated_by = $10, updated_at = now() WHERE id = $1
       RETURNING id::int AS id, audience, category, question, answer, image_url, video_url, position, is_published, updated_at`, [id, v.audience, v.category, v.question, v.answer, v.image_url, v.video_url, v.position, v.is_published, user.id]))[0];
  }

  async remove(user: UserRow, id: number) {
    if (user.role !== 'root_admin') throw new ForbiddenException('Chỉ quản trị viên tổng quản lý hướng dẫn');
    const rows = await this.db.query('DELETE FROM hk_faq WHERE id = $1 RETURNING id', [id]);
    if (!rows.length) throw new NotFoundException('Không tìm thấy mục hướng dẫn');
    return { deleted: true };
  }
}

