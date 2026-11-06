/**
 * Cấu hình hệ thống (Sprint 11): thông tin chung (HK.AD.065), cờ bật / tắt tính năng (HK.AD.071), mẫu thư (HK.AD.068), giới hạn theo trường (HK.AD.017)
 * và giám sát tình trạng (HK.AD.010). Chỉ quản trị tổng cấp 1 được sửa; cấp 2 chỉ xem. Giá trị được đệm vài giây để không tốn truy vấn mỗi yêu cầu.
 */
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MailService } from '../admin/mail.service';
import { config } from '../config';
import { DatabaseService, Q, UserRow } from '../database/database.service';
import { DEFAULT_TEMPLATES, checkTemplate, TEMPLATE_KEYS, TemplateKey } from './templates';

export interface SystemSettings {
  system_name: string; logo_url: string | null; mail_from: string | null; language: string; timezone: string;
  rate_ip_per_min: number | null; rate_user_per_min: number | null; rate_ai_per_min: number | null; backup_enabled: boolean; backup_hour: number; backup_keep: number; updated_at: string;
}

const COLS = 'system_name, logo_url, mail_from, language, timezone, rate_ip_per_min, rate_user_per_min, rate_ai_per_min, backup_enabled, backup_hour, backup_keep, updated_at';
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;
export const STARTED_AT = new Date();

/** Chỉ quản trị tổng cấp 1 sửa được cấu hình hệ thống (HK.AD.026) */
export function assertSystemAdmin(user: UserRow): void {
  if (user.role !== 'root_admin') throw new ForbiddenException('Chỉ quản trị viên tổng được thực hiện thao tác này');
  if (user.admin_level !== 1) throw new ForbiddenException('Quản trị viên tổng cấp 2 không được sửa cấu hình hệ thống');
}

@Injectable()
export class SystemService {
  private cache: { at: number; value: SystemSettings } | null = null;
  private flagCache: { at: number; value: Map<string, boolean> } | null = null;

  constructor(private readonly db: DatabaseService, private readonly mail: MailService) {}

  // ---------------------------------------------------------------------- cấu hình chung (HK.AD.065)
  async settings(): Promise<SystemSettings> {
    if (this.cache && Date.now() - this.cache.at < 5000) return this.cache.value;
    const value = (await this.db.query<SystemSettings>(`SELECT ${COLS} FROM hk_system_settings WHERE id = 1`))[0];
    this.cache = { at: Date.now(), value };
    return value;
  }

  /** Thông tin công khai (tên, logo, múi giờ) cho mọi người dùng đã đăng nhập */
  async publicConfig() {
    const s = await this.settings();
    return { system_name: s.system_name, logo_url: s.logo_url, language: s.language, timezone: s.timezone };
  }

  async updateSettings(user: UserRow, body: Record<string, unknown>): Promise<SystemSettings> {
    assertSystemAdmin(user);
    const cur = await this.settings();
    const has = (k: string): boolean => Object.prototype.hasOwnProperty.call(body, k);
    const text = (k: string, min: number, max: number, label: string, cur_: string): string => {
      if (!has(k)) return cur_;
      const v = String(body[k] ?? '').trim();
      if (v.length < min || v.length > max) throw new BadRequestException(`${label}: từ ${min} đến ${max} ký tự`);
      return v;
    };
    const optText = (k: string, label: string, cur_: string | null, rule: (v: string) => boolean, hint: string): string | null => {
      if (!has(k)) return cur_;
      const v = String(body[k] ?? '').trim();
      if (!v) return null;
      if (!rule(v)) throw new BadRequestException(`${label}: ${hint}`);
      return v;
    };
    const optInt = (k: string, label: string, min: number, max: number, cur_: number | null): number | null => {
      if (!has(k)) return cur_;
      if (body[k] === null || body[k] === '') return null;
      const v = Number(body[k]);
      if (!Number.isInteger(v) || v < min || v > max) throw new BadRequestException(`${label}: số nguyên từ ${min} đến ${max} (để trống để dùng mặc định)`);
      return v;
    };
    const int = (k: string, label: string, min: number, max: number, cur_: number): number => {
      if (!has(k)) return cur_;
      const v = Number(body[k]);
      if (!Number.isInteger(v) || v < min || v > max) throw new BadRequestException(`${label}: số nguyên từ ${min} đến ${max}`);
      return v;
    };
    const timezone = text('timezone', 3, 60, 'Múi giờ', cur.timezone);
    try { new Intl.DateTimeFormat('vi-VN', { timeZone: timezone }); } catch { throw new BadRequestException('Múi giờ không hợp lệ (ví dụ Asia/Ho_Chi_Minh)'); }
    if (has('language') && body.language !== 'vi') throw new BadRequestException('Hiện hệ thống chỉ có tiếng Việt');
    const next = {
      system_name: text('system_name', 2, 80, 'Tên hệ thống', cur.system_name),
      logo_url: optText('logo_url', 'Logo', cur.logo_url, (v) => /^https:\/\/\S+$/.test(v) && v.length <= 500, 'liên kết bắt đầu bằng https://'),
      mail_from: optText('mail_from', 'Email gửi', cur.mail_from, (v) => EMAIL.test((/<([^<>]+)>/.exec(v)?.[1] ?? v).trim()) && v.length <= 200, 'dạng "Tên <dia-chi@mien.vn>" hoặc dia-chi@mien.vn'),
      timezone,
      rate_ip_per_min: optInt('rate_ip_per_min', 'Giới hạn theo IP mỗi phút', 10, 100000, cur.rate_ip_per_min),
      rate_user_per_min: optInt('rate_user_per_min', 'Giới hạn theo người dùng mỗi phút', 10, 100000, cur.rate_user_per_min),
      rate_ai_per_min: optInt('rate_ai_per_min', 'Giới hạn AI mỗi phút', 1, 1000, cur.rate_ai_per_min),
      backup_enabled: has('backup_enabled') ? Boolean(body.backup_enabled) : cur.backup_enabled,
      backup_hour: int('backup_hour', 'Giờ sao lưu', 0, 23, cur.backup_hour),
      backup_keep: int('backup_keep', 'Số bản sao lưu giữ lại', 1, 30, cur.backup_keep),
    };
    await this.db.query(
      `UPDATE hk_system_settings SET system_name = $1, logo_url = $2, mail_from = $3, timezone = $4, rate_ip_per_min = $5, rate_user_per_min = $6, rate_ai_per_min = $7,
              backup_enabled = $8, backup_hour = $9, backup_keep = $10, updated_by = $11, updated_at = now() WHERE id = 1`,
      [next.system_name, next.logo_url, next.mail_from, next.timezone, next.rate_ip_per_min, next.rate_user_per_min, next.rate_ai_per_min, next.backup_enabled, next.backup_hour, next.backup_keep, user.id]);
    this.cache = null;
    this.mail.invalidateTemplates();
    return this.settings();
  }

  // ---------------------------------------------------------------------- cờ tính năng (HK.AD.071)
  private async flagMap(): Promise<Map<string, boolean>> {
    if (this.flagCache && Date.now() - this.flagCache.at < 5000) return this.flagCache.value;
    const value = new Map((await this.db.query<{ key: string; enabled: boolean }>('SELECT key, enabled FROM hk_feature_flags')).map((r) => [r.key, r.enabled]));
    this.flagCache = { at: Date.now(), value };
    return value;
  }

  /** Cờ chưa khai báo coi như bật (không vô tình tắt tính năng) */
  async isOn(key: string): Promise<boolean> { return (await this.flagMap()).get(key) ?? true; }

  async assertOn(key: string, what = 'Tính năng này'): Promise<void> {
    if (!(await this.isOn(key))) throw new ForbiddenException(`${what} đang được quản trị viên tạm tắt`);
  }

  flags() { return this.db.query('SELECT key, label, description, enabled, updated_at FROM hk_feature_flags ORDER BY position, key'); }

  async setFlag(user: UserRow, key: string, enabled: unknown) {
    assertSystemAdmin(user);
    if (typeof enabled !== 'boolean') throw new BadRequestException('Giá trị bật / tắt không hợp lệ');
    const row = await this.db.query('UPDATE hk_feature_flags SET enabled = $2, updated_by = $3, updated_at = now() WHERE key = $1 RETURNING key, label, description, enabled, updated_at', [key, enabled, user.id]);
    if (!row.length) throw new NotFoundException('Không có tính năng này');
    this.flagCache = null;
    return row[0];
  }

  // ---------------------------------------------------------------------- mẫu thư (HK.AD.068)
  async templates() {
    const rows = await this.db.query<{ key: TemplateKey; subject: string; body: string; updated_at: string }>('SELECT key, subject, body, updated_at FROM hk_message_templates');
    return TEMPLATE_KEYS.map((key) => {
      const def = DEFAULT_TEMPLATES[key], custom = rows.find((r) => r.key === key);
      return { key, label: def.label, description: def.description, vars: def.vars, subject_editable: key !== 'temp_password', default_subject: def.subject, default_body: def.body, subject: custom?.subject ?? def.subject, body: custom?.body ?? def.body, customized: Boolean(custom), updated_at: custom?.updated_at ?? null };
    });
  }

  async saveTemplate(user: UserRow, key: string, body: { subject?: string; body?: string }) {
    if (user.role !== 'root_admin') throw new ForbiddenException('Chỉ quản trị viên tổng được sửa mẫu thư');
    if (!TEMPLATE_KEYS.includes(key as TemplateKey)) throw new NotFoundException('Không có mẫu này');
    const k = key as TemplateKey;
    const subject = k === 'temp_password' ? DEFAULT_TEMPLATES[k].subject : String(body.subject ?? '').trim();
    const text = String(body.body ?? '').trim();
    if (subject.length > 160 || text.length > 3000) throw new BadRequestException('Tiêu đề tối đa 160 ký tự, nội dung tối đa 3000 ký tự');
    const errors = checkTemplate(k, subject, text);
    if (errors.length) throw new BadRequestException(errors.join('; '));
    await this.db.query(
      `INSERT INTO hk_message_templates (key, subject, body, updated_by, updated_at) VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (key) DO UPDATE SET subject = EXCLUDED.subject, body = EXCLUDED.body, updated_by = EXCLUDED.updated_by, updated_at = now()`, [k, subject, text, user.id]);
    this.mail.invalidateTemplates();
    return (await this.templates()).find((t) => t.key === k);
  }

  async resetTemplate(user: UserRow, key: string) {
    if (user.role !== 'root_admin') throw new ForbiddenException('Chỉ quản trị viên tổng được sửa mẫu thư');
    if (!TEMPLATE_KEYS.includes(key as TemplateKey)) throw new NotFoundException('Không có mẫu này');
    await this.db.query('DELETE FROM hk_message_templates WHERE key = $1', [key]);
    this.mail.invalidateTemplates();
    return (await this.templates()).find((t) => t.key === key);
  }

  // ---------------------------------------------------------------------- giới hạn theo trường (HK.AD.017)
  async schoolLimits(schoolId: number) {
    const row = (await this.db.query<{ name: string; max_students: number | null; students: number; ai_enabled: boolean | null; daily_per_school: number | null; daily_per_user: number | null }>(
      `SELECT s.name, s.max_students, (SELECT count(*)::int FROM app_users u WHERE u.school_id = s.id AND u.role = 'student' AND u.deleted_at IS NULL) AS students,
              l.ai_enabled, l.daily_per_school, l.daily_per_user FROM app_schools s LEFT JOIN hk_ai_school_limits l ON l.school_id = s.id WHERE s.id = $1`, [schoolId]))[0];
    if (!row) throw new NotFoundException('Không tìm thấy trường');
    const def = (await this.db.query<{ daily_per_school: number; daily_per_user: number }>('SELECT daily_per_school, daily_per_user FROM hk_ai_settings WHERE id = 1 AND school_id IS NULL'))[0];
    return {
      school_id: schoolId, school_name: row.name, students: row.students, max_students: row.max_students, ai_enabled: row.ai_enabled ?? true,
      ai_daily_per_school: row.daily_per_school, ai_daily_per_school_default: def?.daily_per_school ?? null, ai_daily_per_user: row.daily_per_user, ai_daily_per_user_default: def?.daily_per_user ?? null,
    };
  }

  async setSchoolLimits(user: UserRow, schoolId: number, body: Record<string, unknown>) {
    if (user.role !== 'root_admin') throw new ForbiddenException('Chỉ quản trị viên tổng được cấu hình giới hạn cho trường');
    const cur = await this.schoolLimits(schoolId);
    const has = (k: string): boolean => Object.prototype.hasOwnProperty.call(body, k);
    const opt = (k: string, label: string, min: number, max: number, c: number | null): number | null => {
      if (!has(k)) return c;
      if (body[k] === null || body[k] === '') return null;
      const v = Number(body[k]);
      if (!Number.isInteger(v) || v < min || v > max) throw new BadRequestException(`${label}: số nguyên từ ${min} đến ${max} (để trống để dùng mặc định)`);
      return v;
    };
    const maxStudents = opt('max_students', 'Số học sinh tối đa', 1, 100000, cur.max_students);
    if (maxStudents !== null && maxStudents < cur.students) throw new ConflictException(`Trường đang có ${cur.students} học sinh, không đặt giới hạn thấp hơn số này`);
    const aiEnabled = has('ai_enabled') ? Boolean(body.ai_enabled) : cur.ai_enabled;
    const perSchool = opt('ai_daily_per_school', 'Hạn mức AI của trường mỗi ngày', 1, 100000, cur.ai_daily_per_school);
    const perUser = opt('ai_daily_per_user', 'Hạn mức AI mỗi người mỗi ngày', 1, 500, cur.ai_daily_per_user);
    await this.db.tx(async (q) => {
      await q('UPDATE app_schools SET max_students = $2 WHERE id = $1', [schoolId, maxStudents]);
      await q(
        `INSERT INTO hk_ai_school_limits (school_id, daily_per_user, daily_per_school, ai_enabled, updated_by, updated_at) VALUES ($1, $2, $3, $4, $5, now())
         ON CONFLICT (school_id) DO UPDATE SET daily_per_user = EXCLUDED.daily_per_user, daily_per_school = EXCLUDED.daily_per_school, ai_enabled = EXCLUDED.ai_enabled, updated_by = EXCLUDED.updated_by, updated_at = now()`,
        [schoolId, perUser, perSchool, aiEnabled, user.id]);
    });
    return this.schoolLimits(schoolId);
  }

  /** Dùng khi tạo thêm học sinh: trường đã đủ số học sinh tối đa thì từ chối (HK.AD.017) */
  static async assertStudentRoom(q: Q, schoolId: number, adding = 1): Promise<void> {
    const row = (await q<{ max_students: number | null; n: number }>(
      `SELECT s.max_students, (SELECT count(*)::int FROM app_users u WHERE u.school_id = s.id AND u.role = 'student' AND u.deleted_at IS NULL) AS n FROM app_schools s WHERE s.id = $1`, [schoolId]))[0];
    if (row?.max_students !== null && row?.max_students !== undefined && row.n + adding > row.max_students) {
      throw new ConflictException(`Trường đã đạt số học sinh tối đa (${row.max_students}). Liên hệ quản trị viên tổng để tăng giới hạn.`);
    }
  }

  async aiAllowed(schoolId: number | null): Promise<boolean> {
    if (!schoolId) return true;
    const row = (await this.db.query<{ ai_enabled: boolean }>('SELECT ai_enabled FROM hk_ai_school_limits WHERE school_id = $1', [schoolId]))[0];
    return row?.ai_enabled ?? true;
  }

  // ---------------------------------------------------------------------- giám sát tình trạng (HK.AD.010)
  async beat(job: string, ok: boolean, error?: string | null): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO hk_job_heartbeats (job, last_run_at, last_ok, last_error, runs) VALUES ($1, now(), $2, $3, 1)
         ON CONFLICT (job) DO UPDATE SET last_run_at = now(), last_ok = EXCLUDED.last_ok, last_error = EXCLUDED.last_error, runs = hk_job_heartbeats.runs + 1`, [job, ok, error ? error.slice(0, 300) : null]);
    } catch { /* nhịp không được làm hỏng việc nền */ }
  }

  async health(requests: { total: number; client_errors: number; server_errors: number; rate_limited: number; window_min: number }) {
    const started = Date.now();
    let dbOk = true;
    try { await this.db.ping(); } catch { dbOk = false; }
    const latency = Date.now() - started;
    const version = dbOk ? Number((await this.db.query<{ v: number | null }>('SELECT max(version) AS v FROM public.app_schema_migrations'))[0]?.v ?? 0) : null;
    const mail = (await this.db.query<{ queued: number; sending: number; failed_day: number; oldest_min: number | null }>(
      `SELECT count(*) FILTER (WHERE status = 'queued')::int AS queued, count(*) FILTER (WHERE status = 'sending')::int AS sending,
              count(*) FILTER (WHERE status = 'failed' AND created_at >= now() - interval '24 hours')::int AS failed_day,
              (EXTRACT(EPOCH FROM now() - min(created_at) FILTER (WHERE status = 'queued')) / 60)::int AS oldest_min FROM app_email_outbox`))[0];
    const errors = await this.db.query<{ source: string; hour: number; day: number }>(
      `SELECT source, count(*) FILTER (WHERE created_at >= now() - interval '1 hour')::int AS hour, count(*)::int AS day FROM hk_error_log WHERE created_at >= now() - interval '24 hours' GROUP BY source`);
    const jobs = await this.db.query<{ job: string; last_run_at: string; last_ok: boolean; last_error: string | null; runs: string }>('SELECT job, last_run_at, last_ok, last_error, runs FROM hk_job_heartbeats ORDER BY job');
    const users = (await this.db.query<{ n: number }>("SELECT count(DISTINCT user_id)::int AS n FROM hk_events WHERE created_at >= now() - interval '15 minutes'"))[0].n;
    const mem = process.memoryUsage();
    return {
      checked_at: new Date().toISOString(),
      server: { started_at: STARTED_AT.toISOString(), uptime_s: Math.round(process.uptime()), node: process.version, memory_mb: Math.round(mem.rss / 1048576), commit: /^[a-f0-9]{40}$/.test(process.env.RENDER_GIT_COMMIT ?? '') ? process.env.RENDER_GIT_COMMIT : null },
      database: { ok: dbOk, latency_ms: latency, schema_version: version },
      mail: { configured: this.mail.configured, transport: config.mailTransport === 'json' ? 'json' : config.mailRelayUrl ? 'relay' : config.smtpUrl || config.smtpHost ? 'smtp' : 'none', ...mail },
      requests,
      errors: { by_source: Object.fromEntries(errors.map((e) => [e.source, { hour: e.hour, day: e.day }])), hour: errors.reduce((n, e) => n + e.hour, 0), day: errors.reduce((n, e) => n + e.day, 0) },
      jobs: jobs.map((j) => ({ ...j, runs: Number(j.runs), age_min: Math.round((Date.now() - new Date(j.last_run_at).getTime()) / 60000) })),
      active_users_15m: users,
    };
  }
}
