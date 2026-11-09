/**
 * Nghiên cứu hiệu quả trò chơi hóa và AI (Sprint 12, mục tiêu 5 của đề cương): thiết lập nhóm thử nghiệm và gán lớp vào nhóm (HK.AD.078), xuất dữ liệu học tập ẩn danh dạng CSV
 * (HK.AD.077) và báo cáo so sánh các nhóm có kiểm định thống kê (HK.AD.079). Nhóm có tác dụng thật: lớp thuộc nhóm "không trò chơi hóa" thì học sinh không thấy cửa hàng,
 * xếp hạng, thẻ, huy hiệu, nhiệm vụ, quà và game thẻ tướng; lớp thuộc nhóm "không AI" thì không dùng được Tiểu Tướng và gợi ý học tập. Điểm học tập vẫn được ghi để so sánh.
 *
 * Quyền riêng tư: dữ liệu xuất ra không có tên, tên đăng nhập, email, mã học sinh hay tên trường; mã người tham gia là băm HMAC có khóa của máy chủ nên không suy ngược được.
 * Việc dùng dữ liệu của học sinh vào nghiên cứu cần được nhà trường và phụ huynh đồng ý trước (ngoài phạm vi phần mềm).
 */
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { AnalyticsService, Period } from '../analytics/analytics.service';
import { config } from '../config';
import { DatabaseService, UserRow } from '../database/database.service';
import { summarize, Summary, welch, Welch } from './stats';

export interface Features { gamification: boolean; ai: boolean }
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const DICTIONARY: Array<{ column: string; meaning: string }> = [
  { column: 'participant_id', meaning: 'Mã người tham gia: băm HMAC của tài khoản bằng khóa riêng của máy chủ (16 ký tự hex); ổn định giữa các lần xuất, không suy ngược được.' },
  { column: 'school_code', meaning: 'Mã trường ẩn danh (băm 6 ký tự hex), để phân biệt các trường mà không lộ tên trường.' },
  { column: 'grade', meaning: 'Khối lớp của học sinh (6–9), trống nếu chưa có.' },
  { column: 'group', meaning: 'Tên nhóm thử nghiệm của lớp học sinh đang học; nếu học sinh thuộc nhiều lớp khác nhóm thì lấy nhóm có mã nhỏ nhất.' },
  { column: 'gamification', meaning: '1 nếu nhóm có trò chơi hóa, 0 nếu không.' },
  { column: 'ai', meaning: '1 nếu nhóm có AI (Tiểu Tướng, gợi ý học tập), 0 nếu không.' },
  { column: 'events', meaning: 'Số hoạt động học tập ghi nhận trong khoảng thời gian.' },
  { column: 'active_days', meaning: 'Số ngày có hoạt động (theo múi giờ hệ thống).' },
  { column: 'study_minutes', meaning: 'Tổng thời gian học tính từ nhật ký hoạt động (phút).' },
  { column: 'attempts', meaning: 'Số lượt làm bài đã hoàn thành (không tính xem thử của giáo viên).' },
  { column: 'avg_percent', meaning: 'Điểm trung bình các lượt làm bài (%), trống nếu chưa làm bài nào.' },
  { column: 'answered', meaning: 'Số câu hỏi đã trả lời.' },
  { column: 'correct', meaning: 'Số câu trả lời đúng.' },
  { column: 'accuracy_percent', meaning: 'Tỉ lệ trả lời đúng (%).' },
  { column: 'nodes_done', meaning: 'Số nút hành trình đã hoàn thành.' },
  { column: 'nodes_total', meaning: 'Tổng số nút trong các hành trình được giao.' },
  { column: 'progress_percent', meaning: 'Tiến độ hành trình (%).' },
  { column: 'xp', meaning: 'Tổng điểm kinh nghiệm hiện có.' },
  { column: 'level', meaning: 'Cấp độ hiện tại.' },
  { column: 'streak', meaning: 'Chuỗi ngày học hiện tại.' },
  { column: 'ai_questions', meaning: 'Số câu hỏi đã gửi Tiểu Tướng trong khoảng thời gian (chỉ đếm, không có nội dung).' },
  { column: 'surveys_answered', meaning: 'Số khảo sát đã trả lời.' },
];

@Injectable()
export class ResearchService {
  constructor(private readonly db: DatabaseService, private readonly analytics: AnalyticsService) {}

  private root(user: UserRow): void {
    if (user.role !== 'root_admin' && !(user.role === 'school_admin' && user.school_id)) throw new ForbiddenException('Chỉ quản trị viên tổng quản lý nghiên cứu');
  }

  // ---------------------------------------------------------------------- nhóm thử nghiệm (HK.AD.078)
  async groups(user: UserRow) {
    this.root(user);
    return this.db.query(
      `SELECT g.id::int AS id,g.school_id, (g.school_id IS NOT DISTINCT FROM public.app_workspace_school()) AS can_edit, g.name, g.description, g.gamification, g.ai, g.created_at, count(DISTINCT ec.class_id)::int AS classes,
              (SELECT count(DISTINCT m.user_id)::int FROM hk_experiment_classes x JOIN app_class_members m ON m.class_id = x.class_id JOIN app_users u ON u.id = m.user_id AND u.role = 'student' AND u.deleted_at IS NULL WHERE x.group_id = g.id) AS students
       FROM hk_experiment_groups g LEFT JOIN hk_experiment_classes ec ON ec.group_id = g.id GROUP BY g.id ORDER BY g.id`);
  }

  private cleanGroup(body: Record<string, unknown>, cur?: Record<string, any>) {
    const has = (k: string): boolean => Object.prototype.hasOwnProperty.call(body, k);
    const name = String(has('name') ? body.name : cur?.name ?? '').trim();
    if (name.length < 2 || name.length > 80) throw new BadRequestException('Tên nhóm từ 2 đến 80 ký tự');
    const description = has('description') ? (String(body.description ?? '').trim() || null) : cur?.description ?? null;
    if (description && description.length > 400) throw new BadRequestException('Mô tả tối đa 400 ký tự');
    return { name, description, gamification: has('gamification') ? Boolean(body.gamification) : cur?.gamification ?? true, ai: has('ai') ? Boolean(body.ai) : cur?.ai ?? true };
  }

  async createGroup(user: UserRow, body: Record<string, unknown>) {
    this.root(user);
    const v = this.cleanGroup(body);
    try {
      return (await this.db.query('INSERT INTO hk_experiment_groups (name, description, gamification, ai, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id::int AS id, name, description, gamification, ai, created_at', [v.name, v.description, v.gamification, v.ai, user.id]))[0];
    } catch (e) {
      if ((e as { code?: string }).code === '23505') throw new ConflictException('Đã có nhóm trùng tên');
      throw e;
    }
  }

  async updateGroup(user: UserRow, id: number, body: Record<string, unknown>) {
    await this.db.assertWorkspaceWritable('hk_experiment_groups', id);
    this.root(user);
    const cur = (await this.db.query<Record<string, any>>('SELECT * FROM hk_experiment_groups WHERE id = $1', [id]))[0];
    if (!cur) throw new NotFoundException('Không tìm thấy nhóm');
    const v = this.cleanGroup(body, cur);
    try {
      return (await this.db.query('UPDATE hk_experiment_groups SET name = $2, description = $3, gamification = $4, ai = $5 WHERE id = $1 RETURNING id::int AS id, name, description, gamification, ai, created_at', [id, v.name, v.description, v.gamification, v.ai]))[0];
    } catch (e) {
      if ((e as { code?: string }).code === '23505') throw new ConflictException('Đã có nhóm trùng tên');
      throw e;
    }
  }

  async removeGroup(user: UserRow, id: number) {
    await this.db.assertWorkspaceWritable('hk_experiment_groups', id);
    this.root(user);
    const rows = await this.db.query('DELETE FROM hk_experiment_groups WHERE id = $1 RETURNING id', [id]); // các lớp đã gán tự trở về không thuộc nhóm
    if (!rows.length) throw new NotFoundException('Không tìm thấy nhóm');
    return { deleted: true };
  }

  async classes(user: UserRow) {
    this.root(user);
    return this.db.query(
      `SELECT c.id::int AS id, c.name, c.grade, s.name AS school_name, ec.group_id::int AS group_id, g.name AS group_name,
              (SELECT count(*)::int FROM app_class_members m JOIN app_users u ON u.id = m.user_id AND u.role = 'student' AND u.deleted_at IS NULL WHERE m.class_id = c.id) AS students
       FROM app_classes c JOIN app_schools s ON s.id = c.school_id LEFT JOIN hk_experiment_classes ec ON ec.class_id = c.id LEFT JOIN hk_experiment_groups g ON g.id = ec.group_id
       WHERE c.is_active ORDER BY s.name, c.name`);
  }

  async assign(user: UserRow, classId: number, groupId: unknown) {
    this.root(user);
    if (!(await this.db.query('SELECT 1 FROM app_classes WHERE id = $1', [classId])).length) throw new NotFoundException('Không tìm thấy lớp');
    if (groupId === null || groupId === undefined || groupId === '') {
      await this.db.query('DELETE FROM hk_experiment_classes WHERE class_id = $1', [classId]);
      return { class_id: classId, group_id: null };
    }
    const gid = Number(groupId);
    if (!Number.isInteger(gid) || !(await this.db.query('SELECT 1 FROM hk_experiment_groups WHERE id = $1', [gid])).length) throw new NotFoundException('Không tìm thấy nhóm');
    await this.db.query(
      'INSERT INTO hk_experiment_classes (class_id, group_id, assigned_by, assigned_at) VALUES ($1, $2, $3, now()) ON CONFLICT (class_id) DO UPDATE SET group_id = EXCLUDED.group_id, assigned_by = EXCLUDED.assigned_by, assigned_at = now()', [classId, gid, user.id]);
    return { class_id: classId, group_id: gid };
  }

  /** Tính năng học sinh được dùng theo nhóm thử nghiệm của các lớp em học: chỉ cần một lớp thuộc nhóm tắt là tắt (hướng tránh làm lẫn nhóm); người không phải học sinh không bị ảnh hưởng */
  async featuresOf(user: UserRow): Promise<Features> {
    if (user.role !== 'student') return { gamification: true, ai: true };
    const row = (await this.db.query<{ g: boolean | null; a: boolean | null }>(
      `SELECT bool_and(g.gamification) AS g, bool_and(g.ai) AS a FROM app_class_members m JOIN hk_experiment_classes ec ON ec.class_id = m.class_id JOIN hk_experiment_groups g ON g.id = ec.group_id WHERE m.user_id = $1`, [user.id]))[0];
    return { gamification: row?.g ?? true, ai: row?.a ?? true };
  }

  // ---------------------------------------------------------------------- dữ liệu nghiên cứu (HK.AD.077)
  private period(f: { from?: string; to?: string }): Period {
    for (const k of ['from', 'to'] as const) if (f[k] && !DATE.test(f[k]!)) throw new BadRequestException('Ngày có dạng năm-tháng-ngày, ví dụ 2026-09-05');
    return { from: f.from || undefined, to: f.to || undefined };
  }

  private pseudo(label: string, id: number, len: number): string {
    return createHmac('sha256', `${config.authSecret}:research:${label}`).update(String(id)).digest('hex').slice(0, len);
  }

  /** Mỗi dòng một học sinh thuộc lớp đã gán nhóm */
  private async records(f: { from?: string; to?: string; group_id?: number }) {
    const period = this.period(f);
    const people = await this.db.query<{ id: number; full_name: string; user_code: string | null; email: string | null; school_id: number; grade: number | null; group_id: number; group_name: string; gamification: boolean; ai: boolean }>(
      `SELECT DISTINCT ON (u.id) u.id, u.full_name, u.user_code, u.email, u.school_id, COALESCE(c.grade, u.grade) AS grade, g.id AS group_id, g.name AS group_name, g.gamification, g.ai
       FROM app_users u JOIN app_class_members m ON m.user_id = u.id JOIN app_classes c ON c.id = m.class_id JOIN hk_experiment_classes ec ON ec.class_id = c.id JOIN hk_experiment_groups g ON g.id = ec.group_id
       WHERE u.role = 'student' AND u.deleted_at IS NULL AND ($1::int IS NULL OR g.id = $1) ORDER BY u.id, g.id`, [f.group_id ?? null]);
    if (!people.length) return { period, rows: [] as any[] };
    const ids = people.map((p) => p.id);
    const stats = new Map((await this.db.tx((q) => this.analytics.statsOf(q, people, period))).map((s) => [s.id, s]));
    const from = period.from ? `${period.from}T00:00:00+07:00` : null, to = period.to ? `${period.to}T23:59:59.999+07:00` : null;
    const events = new Map((await this.db.query<{ user_id: number; n: number }>('SELECT user_id, count(*)::int AS n FROM hk_events WHERE user_id = ANY($1) AND ($2::timestamptz IS NULL OR created_at >= $2) AND ($3::timestamptz IS NULL OR created_at <= $3) GROUP BY user_id', [ids, from, to])).map((r) => [r.user_id, r.n]));
    const ai = new Map((await this.db.query<{ user_id: number; n: number }>(
      `SELECT c.user_id, count(*)::int AS n FROM hk_ai_messages m JOIN hk_ai_conversations c ON c.id = m.conversation_id WHERE c.user_id = ANY($1) AND m.role = 'user' AND ($2::timestamptz IS NULL OR m.created_at >= $2) AND ($3::timestamptz IS NULL OR m.created_at <= $3) GROUP BY c.user_id`, [ids, from, to])).map((r) => [r.user_id, r.n]));
    const surveys = new Map((await this.db.query<{ user_id: number; n: number }>('SELECT user_id, count(*)::int AS n FROM hk_survey_responses WHERE user_id = ANY($1) GROUP BY user_id', [ids])).map((r) => [r.user_id, r.n]));
    const rows = people.map((p) => {
      const s = stats.get(p.id)!;
      return {
        participant_id: this.pseudo('student', p.id, 16), school_code: this.pseudo('school', p.school_id, 6), grade: p.grade, group: p.group_name, group_id: p.group_id, gamification: p.gamification ? 1 : 0, ai: p.ai ? 1 : 0,
        events: events.get(p.id) ?? 0, active_days: s.active_days, study_minutes: s.study_minutes, attempts: s.attempts, avg_percent: s.avg_percent, answered: s.answered, correct: s.correct, accuracy_percent: s.accuracy,
        nodes_done: s.nodes_done, nodes_total: s.nodes_total, progress_percent: s.progress, xp: s.xp, level: s.level, streak: s.streak, ai_questions: ai.get(p.id) ?? 0, surveys_answered: surveys.get(p.id) ?? 0,
      };
    });
    return { period, rows };
  }

  async exportCsv(user: UserRow, f: { from?: string; to?: string; group_id?: number }): Promise<{ data: Buffer; name: string; rows: number }> {
    this.root(user);
    const { rows } = await this.records(f);
    const cols = DICTIONARY.map((d) => d.column);
    const esc = (v: unknown): string => { if (v === null || v === undefined) return ''; const t = String(v); return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
    const csv = `﻿${[cols.join(','), ...rows.map((r) => cols.map((c) => esc((r as Record<string, unknown>)[c])).join(','))].join('\r\n')}\r\n`;
    return { data: Buffer.from(csv, 'utf8'), name: `du-lieu-nghien-cuu-${new Date().toISOString().slice(0, 10)}.csv`, rows: rows.length };
  }

  // ---------------------------------------------------------------------- báo cáo so sánh nhóm (HK.AD.079)
  async compare(user: UserRow, f: { from?: string; to?: string; control?: number }) {
    this.root(user);
    const { period, rows } = await this.records({ from: f.from, to: f.to });
    const groups = await this.db.query<{ id: number; name: string; gamification: boolean; ai: boolean }>('SELECT id::int AS id, name, gamification, ai FROM hk_experiment_groups ORDER BY id');
    const control = f.control ? groups.find((g) => g.id === Number(f.control)) : groups.find((g) => !g.gamification && !g.ai) ?? groups[0];
    if (f.control && !control) throw new NotFoundException('Không tìm thấy nhóm đối chứng');
    const values = (gid: number, pick: (r: any) => number | null): number[] => rows.filter((r) => r.group_id === gid).map(pick).filter((x): x is number => x !== null && x !== undefined);
    const metrics: Array<{ key: string; label: string; unit: string; pick: (r: any) => number | null }> = [
      { key: 'avg_percent', label: 'Điểm trung bình các bài làm', unit: '%', pick: (r) => r.avg_percent },
      { key: 'study_minutes', label: 'Thời gian học', unit: 'phút', pick: (r) => r.study_minutes },
      { key: 'active_days', label: 'Số ngày học', unit: 'ngày', pick: (r) => r.active_days },
      { key: 'progress_percent', label: 'Tiến độ hành trình', unit: '%', pick: (r) => r.progress_percent },
      { key: 'participation', label: 'Mức độ tham gia (có hoạt động)', unit: 'tỉ lệ', pick: (r) => (r.events > 0 ? 1 : 0) },
    ];
    const out = groups.map((g) => {
      const members = rows.filter((r) => r.group_id === g.id);
      return {
        id: g.id, name: g.name, gamification: g.gamification, ai: g.ai, is_control: g.id === control?.id, students: members.length,
        metrics: Object.fromEntries(metrics.map((m) => [m.key, summarize(values(g.id, m.pick)) as Summary])),
        vs_control: control && g.id !== control.id ? Object.fromEntries(metrics.map((m) => [m.key, welch(values(control.id, m.pick), values(g.id, m.pick)) as Welch | null])) : null,
      };
    });
    const small = out.filter((g) => g.students > 0 && g.students < 10).map((g) => g.name);
    return {
      period: { from: period.from ?? null, to: period.to ?? null }, control: control ? { id: control.id, name: control.name } : null, metrics: metrics.map((m) => ({ key: m.key, label: m.label, unit: m.unit })), groups: out,
      notes: [
        'p là giá trị hai phía của kiểm định Welch (so với nhóm đối chứng); d là hệ số Cohen. p nhỏ (dưới 0,05) cho thấy khác biệt khó do ngẫu nhiên, nhưng không chứng minh nhân quả nếu các lớp không được chọn ngẫu nhiên.',
        ...(small.length ? [`Nhóm ${small.join(', ')} có dưới 10 học sinh: kết quả chỉ mang tính tham khảo.`] : []),
        'Mức độ tham gia tính theo tỉ lệ học sinh có ít nhất một hoạt động trong khoảng thời gian.',
      ],
    };
  }
}
