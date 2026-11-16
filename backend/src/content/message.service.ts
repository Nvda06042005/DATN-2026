/**
 * Thư của giáo viên (16/11/2026, migration 070) – mục "Nội dung đã gửi": giáo viên chọn người nhận trong danh sách cùng trường (quản trị viên trường,
 * giáo viên, học sinh; trường nào chỉ thấy người của trường đó), soạn tiêu đề và nội dung, có thể đính kèm câu hỏi / bộ đề / hành trình trong kho riêng.
 * Đính kèm thì cần có quản trị viên trường trong người nhận: hệ thống tạo yêu cầu duyệt vào kho chung của trường (ShareService). Mọi người nhận được
 * thông báo ở chuông / mục Thông báo.
 */
import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { notify } from '../classroom/notify';
import { DatabaseService, UserRow } from '../database/database.service';
import { notFound } from './access';
import { ShareEntity, ShareService } from './share.service';

const ROLE_LABEL: Record<string, string> = { school_admin: 'Quản trị trường', teacher: 'Giáo viên', student: 'Học sinh' };
export interface MessageInput { recipient_ids?: unknown; subject?: unknown; body?: unknown; entity?: unknown; entity_id?: unknown }

@Injectable()
export class MessageService {
  constructor(private readonly db: DatabaseService, private readonly shares: ShareService) {}

  private school(user: UserRow): number {
    if (user.role !== 'teacher') throw new ForbiddenException('Chức năng dành cho giáo viên');
    if (!user.school_id) throw new ForbiddenException('Tài khoản chưa được gán trường');
    return user.school_id;
  }

  /** Người nhận có thể chọn: quản trị viên trường, giáo viên, học sinh đang hoạt động của chính trường (trừ bản thân); học sinh kèm lớp */
  async recipients(user: UserRow, f: { role?: string; q?: string }) {
    const school = this.school(user);
    const params: unknown[] = [school, user.id];
    const where = ["u.school_id = $1", 'u.id <> $2', "u.role IN ('school_admin', 'teacher', 'student')", 'u.is_active = 1', 'u.deleted_at IS NULL'];
    if (f.role && ROLE_LABEL[f.role]) { params.push(f.role); where.push(`u.role = $${params.length}`); }
    const term = String(f.q ?? '').trim().toLowerCase();
    if (term) { params.push(`%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`); where.push(`(lower(u.full_name) LIKE $${params.length} OR lower(coalesce(u.user_code, '')) LIKE $${params.length})`); }
    const rows = await this.db.query<{ id: number; full_name: string; role: string; user_code: string | null; classes: string | null }>(
      `SELECT u.id, u.full_name, u.role, u.user_code,
              (SELECT string_agg(c.name, ', ' ORDER BY c.name) FROM app_class_members m JOIN app_classes c ON c.id = m.class_id AND c.is_active WHERE m.user_id = u.id) AS classes
       FROM app_users u WHERE ${where.join(' AND ')}
       ORDER BY CASE u.role WHEN 'school_admin' THEN 0 WHEN 'teacher' THEN 1 ELSE 2 END, u.full_name LIMIT 500`, params);
    return rows.map((r) => ({ ...r, role_label: ROLE_LABEL[r.role] }));
  }

  /** Gửi thư: kiểm tra người nhận cùng trường, lưu thư, tạo yêu cầu duyệt nếu có đính kèm, báo từng người nhận */
  async send(user: UserRow, input: MessageInput) {
    const school = this.school(user);
    const ids = [...new Set((Array.isArray(input.recipient_ids) ? input.recipient_ids : []).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
    if (!ids.length) throw new BadRequestException('Hãy chọn ít nhất một người nhận');
    if (ids.length > 500) throw new BadRequestException('Mỗi thư gửi tối đa 500 người');
    const subject = String(input.subject ?? '').replace(/\s+/g, ' ').trim();
    if (!subject || subject.length > 150) throw new BadRequestException('Tiêu đề từ 1 đến 150 ký tự');
    const body = String(input.body ?? '').replace(/\r\n/g, '\n').trim() || null;
    if (body && body.length > 2000) throw new BadRequestException('Nội dung tối đa 2000 ký tự');
    const entity = input.entity ? String(input.entity) as ShareEntity : null;
    if (entity && !['question', 'quiz', 'journey'].includes(entity)) throw new BadRequestException('Loại nội dung đính kèm không hợp lệ');
    const entityId = entity ? Number(input.entity_id) : null;
    if (entity && !(Number.isInteger(entityId) && entityId! > 0)) throw new BadRequestException('Nội dung đính kèm không hợp lệ');
    const people = await this.db.query<{ id: number; role: string }>(
      "SELECT id, role FROM app_users WHERE id = ANY($1) AND school_id = $2 AND role IN ('school_admin', 'teacher', 'student') AND is_active = 1 AND deleted_at IS NULL AND id <> $3", [ids, school, user.id]);
    if (people.length !== ids.length) throw new BadRequestException('Có người nhận không thuộc trường của bạn hoặc tài khoản đã khóa');
    if (entity && !people.some((p) => p.role === 'school_admin')) throw new BadRequestException('Nội dung đính kèm được gửi quản trị trường duyệt; hãy chọn ít nhất một quản trị viên trường trong người nhận');
    const share = entity ? await this.shares.request(user, entity, entityId!, 'school', { subject, message: body }) : null;
    const id = await this.db.tx(async (q) => {
      const mid = (await q<{ id: number }>('INSERT INTO hk_messages (school_id, sender_id, subject, body, entity, entity_id, share_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
        [school, user.id, subject, body, entity, entityId, share?.id ?? null]))[0].id;
      await q('INSERT INTO hk_message_recipients (message_id, user_id, school_id) SELECT $1, unnest($2::int[]), $3', [mid, ids, school]);
      await notify(q, ids, { kind: 'message', title: `Thư mới: ${subject}`, body: `${user.full_name}: ${body ?? (entity ? 'gửi kèm nội dung đề nghị duyệt.' : '(không có nội dung)')}`, by: user.id, school_id: school, ref: { message_id: mid } });
      return mid;
    });
    return this.detail(user, id);
  }

  /** Thư đã gửi của giáo viên, mới nhất trước, kèm số người nhận / đã đọc và trạng thái duyệt của nội dung đính kèm */
  async sent(user: UserRow) {
    this.school(user);
    return this.db.query(
      `SELECT m.id, m.subject, m.body, m.entity, m.entity_id, m.share_id, m.created_at, s.status AS share_status, s.review_note, s.reviewed_at, rv.full_name AS reviewer,
              (SELECT count(*)::int FROM hk_message_recipients r WHERE r.message_id = m.id) AS recipients,
              (SELECT count(*)::int FROM hk_message_recipients r WHERE r.message_id = m.id AND r.read_at IS NOT NULL) AS read,
              (SELECT string_agg(u.full_name, ', ' ORDER BY CASE u.role WHEN 'school_admin' THEN 0 WHEN 'teacher' THEN 1 ELSE 2 END, u.full_name) FROM (SELECT u.full_name, u.role FROM hk_message_recipients r JOIN app_users u ON u.id = r.user_id WHERE r.message_id = m.id ORDER BY u.full_name LIMIT 4) u) AS names
       FROM hk_messages m LEFT JOIN hk_shares s ON s.id = m.share_id LEFT JOIN app_users rv ON rv.id = s.reviewed_by
       WHERE m.sender_id = $1 ORDER BY m.created_at DESC, m.id DESC LIMIT 300`, [user.id]);
  }

  /** Một thư đã gửi: người nhận (tên, vai trò, lớp, đã đọc), nội dung đính kèm và yêu cầu duyệt */
  async detail(user: UserRow, id: number) {
    this.school(user);
    const m = (await this.db.query<Record<string, any>>('SELECT * FROM hk_messages WHERE id = $1 AND sender_id = $2', [id, user.id]))[0];
    if (!m) throw notFound('thư');
    const recipients = (await this.db.query<{ id: number; full_name: string; role: string; user_code: string | null; read_at: string | null }>(
      `SELECT u.id, u.full_name, u.role, u.user_code, r.read_at FROM hk_message_recipients r JOIN app_users u ON u.id = r.user_id WHERE r.message_id = $1
       ORDER BY CASE u.role WHEN 'school_admin' THEN 0 WHEN 'teacher' THEN 1 ELSE 2 END, u.full_name`, [id])).map((r) => ({ ...r, role_label: ROLE_LABEL[r.role] }));
    const share = m.share_id ? await this.shares.detail(user, m.share_id).catch(() => null) : null;
    return { ...m, recipients, share };
  }
}
