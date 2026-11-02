/**
 * Lớp học của giáo viên và "Lớp học của tôi" của học sinh (Sprint 7, HK.GV.007–017, 059–065; HK.HS.071, 076, 099, 103–105): danh sách và tạo lớp, sửa thông tin, lưu trữ/xóa,
 * mã tham gia, thêm/xóa/tìm học sinh, xem nhân vật của học sinh, chia đội (ngẫu nhiên hoặc thủ công), duyệt yêu cầu rời lớp, luật lớp, thưởng/phạt điểm – vàng – tim,
 * sự kiện may rủi đầu giờ, hộp quà cả lớp, trao huy hiệu, xếp hạng lớp/đội, thông báo, tiến độ lớp trên bản đồ.
 * Mọi điểm, vàng, tim đi qua GameService nên giữ các giới hạn (không âm, tim trong khoảng 0 đến tối đa) và khóa chống cộng hai lần.
 */
import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { buildWorkbook, checkUpload, readSheet, UploadedXlsx } from '../admin/excel';
import { ClassService } from '../admin/class.service';
import { DatabaseService, Q, searchText, UserRow } from '../database/database.service';
import { notFound } from '../content/access';
import { addDays, dayKey, dayStart, monthKey, weekKey } from '../game/clock';
import { GameService } from '../game/game.service';
import { nodesWithState } from '../student/progress';
import { notify } from './notify';

export const TEAM_ICONS = ['shield', 'swords', 'flag', 'crown', 'star', 'flame', 'heart', 'award', 'gem', 'lightbulb', 'target', 'trophy'] as const;
const TEAM_NAMES = ['Bạch Đằng', 'Chương Dương', 'Hàm Tử', 'Đông Bộ Đầu', 'Vân Đồn', 'Tây Kết', 'Bình Than', 'Vạn Kiếp', 'Thăng Long', 'Diên Hồng', 'Đông A', 'Hào Khí'];
export interface Rule { id: string; label: string; xp: number; gold: number; hp: number }
export const DEFAULT_RULES: Rule[] = [
  { id: 'phat-bieu', label: 'Phát biểu xây dựng bài', xp: 10, gold: 0, hp: 0 },
  { id: 'giup-ban', label: 'Giúp đỡ bạn học', xp: 10, gold: 5, hp: 0 },
  { id: 'nop-muon', label: 'Nộp bài muộn', xp: -10, gold: 0, hp: 0 },
  { id: 'mat-trat-tu', label: 'Làm mất trật tự', xp: -5, gold: 0, hp: -1 },
];
/** Sự kiện may rủi của "Vòng quay vận mệnh" (HK.GV.062) */
export const RANDOM_EVENTS: Array<{ id: string; label: string; xp?: number; gold?: number; hp?: number }> = [
  { id: 'mua-diem', label: 'Mưa điểm: mỗi bạn được cộng 20 điểm', xp: 20 },
  { id: 'kho-bau', label: 'Tìm thấy kho báu: mỗi bạn được 15 vàng', gold: 15 },
  { id: 'thay-lang', label: 'Gặp thầy lang: mỗi bạn hồi 1 tim', hp: 1 },
  { id: 'tiep-te', label: 'Quân tiếp tế đến: mỗi bạn được 10 điểm và 5 vàng', xp: 10, gold: 5 },
  { id: 'bao-to', label: 'Bão tố bất ngờ: mỗi bạn mất 1 tim', hp: -1 },
  { id: 'thieu-luong', label: 'Thiếu lương: mỗi bạn mất 10 vàng', gold: -10 },
  { id: 'phuc-kich', label: 'Trúng phục kích: mỗi bạn mất 10 điểm', xp: -10 },
  { id: 'binh-yen', label: 'Một ngày bình yên: không có gì xảy ra' },
];

export interface ClassInfo {
  id: number; school_id: number; name: string; grade: number | null; school_year: string; year_id: number | null; created_by: number | null; is_active: boolean;
  join_code: string | null; join_open: boolean; description: string | null; cover_url: string | null; year_status: string | null;
}
export interface AdjustInput { user_ids?: number[]; team_ids?: number[]; rule_id?: string; label?: string; xp?: number; gold?: number; hp?: number }
interface ScopeInput { target?: string; team_id?: number }

const clampInt = (v: unknown, min: number, max: number, label: string): number => {
  const n = v === undefined || v === null || v === '' ? 0 : Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new BadRequestException(`${label}: số nguyên từ ${min} đến ${max}`);
  return n;
};

@Injectable()
export class ClassroomService {
  constructor(private readonly db: DatabaseService, private readonly classes: ClassService, private readonly game: GameService) {}

  // ------------------------------------------------------------------ truy cập
  /** Lớp giáo viên phụ trách (hoặc lớp của trường với quản trị viên trường); `open` chặn thao tác ghi trên lớp lưu trữ hoặc năm học đã kết thúc */
  async mine(q: Q, user: UserRow, classId: number, open = false): Promise<ClassInfo> {
    if (user.role !== 'teacher' && user.role !== 'school_admin') throw new ForbiddenException('Chức năng này dành cho giáo viên và quản trị viên trường');
    const row = (await q<ClassInfo>(
      `SELECT c.id, c.school_id, c.name, c.grade, c.school_year, c.year_id, c.created_by, c.is_active, c.join_code, c.join_open, c.description, c.cover_url, y.status AS year_status
       FROM app_classes c LEFT JOIN app_school_years y ON y.id = c.year_id
       WHERE c.id = $1 AND (($2 = 'teacher' AND EXISTS (SELECT 1 FROM app_class_teachers t WHERE t.class_id = c.id AND t.teacher_id = $3)) OR ($2 = 'school_admin' AND c.school_id = $4))`,
      [classId, user.role, user.id, user.school_id]))[0];
    if (!row) throw notFound('lớp');
    if (open) {
      if (!row.is_active) throw new ConflictException('Lớp đã được lưu trữ');
      if (row.year_status === 'ended') throw new ConflictException('Năm học của lớp đã kết thúc nên không sửa được');
    }
    return row;
  }

  /** Quyền của giáo viên được chuyển cho dịch vụ lớp của quản trị viên trường sau khi đã kiểm tra lớp thuộc giáo viên */
  private asSchool(user: UserRow): UserRow { return { ...user, role: 'school_admin' }; }

  private async studentIds(q: Q, classId: number): Promise<number[]> {
    return (await q<{ id: number }>("SELECT u.id FROM app_class_members m JOIN app_users u ON u.id = m.user_id AND u.role = 'student' AND u.deleted_at IS NULL WHERE m.class_id = $1 ORDER BY u.id", [classId])).map((r) => r.id);
  }

  private async members(q: Q, classId: number, ids: number[]): Promise<UserRow[]> {
    const unique = [...new Set(ids)];
    const rows = await q<UserRow>("SELECT u.* FROM app_users u JOIN app_class_members m ON m.user_id = u.id AND m.class_id = $1 WHERE u.id = ANY($2) AND u.role = 'student'", [classId, unique]);
    if (rows.length !== unique.length) throw new ForbiddenException('Có học sinh không thuộc lớp này');
    return rows;
  }

  private range(period: string): [Date, Date] | null {
    const now = this.game.clock.now();
    if (period === 'week') { const k = weekKey(now); return [dayStart(k), dayStart(addDays(k, 7))]; }
    if (period === 'month') {
      const k = monthKey(now);
      const [y, m] = k.split('-').map(Number);
      return [dayStart(`${k}-01`), dayStart(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`)];
    }
    return null;
  }

  // ------------------------------------------------------------------ danh sách và chi tiết lớp (HK.GV.007)
  private async journeysOf(q: Q, classId: number, students: number): Promise<Array<Record<string, any>>> {
    const rows = await q<Record<string, any>>(
      `SELECT cj.journey_id, j.title, j.campaign_id, c.title AS campaign_title, cj.starts_at, cj.ends_at, cj.assigned_at,
              (SELECT count(*)::int FROM hk_nodes n WHERE n.journey_id = j.id) AS nodes,
              (SELECT count(*)::int FROM hk_node_progress p JOIN hk_nodes n ON n.id = p.node_id JOIN app_class_members m ON m.user_id = p.user_id AND m.class_id = cj.class_id
               WHERE n.journey_id = j.id AND p.completed_at IS NOT NULL) AS done
       FROM hk_class_journeys cj JOIN hk_journeys j ON j.id = cj.journey_id JOIN hist_campaigns c ON c.id = j.campaign_id WHERE cj.class_id = $1 ORDER BY cj.assigned_at DESC`, [classId]);
    const now = Date.now();
    return rows.map((r) => ({
      ...r, percent: r.nodes && students ? Math.min(100, Math.round((r.done / (r.nodes * students)) * 100)) : 0,
      state: r.starts_at && new Date(r.starts_at).getTime() > now ? 'upcoming' : r.ends_at && new Date(r.ends_at).getTime() <= now ? 'ended' : 'running',
    }));
  }

  async myClasses(user: UserRow) {
    if (user.role !== 'teacher' && user.role !== 'school_admin') throw new ForbiddenException('Chức năng này dành cho giáo viên và quản trị viên trường');
    const rows = await this.db.query<Record<string, any>>(
      `SELECT c.id, c.name, c.grade, c.school_year, c.description, c.cover_url, c.join_code, c.join_open, c.is_active, c.created_by, y.status AS year_status,
              (SELECT count(*)::int FROM app_class_members m JOIN app_users u ON u.id = m.user_id AND u.role = 'student' WHERE m.class_id = c.id) AS students,
              (SELECT count(*)::int FROM hk_teams t WHERE t.class_id = c.id) AS teams,
              (SELECT count(*)::int FROM hk_leave_requests r WHERE r.class_id = c.id AND r.status = 'pending') AS pending_leaves,
              (SELECT count(*)::int FROM hk_skill_uses s WHERE s.class_id = c.id AND s.status = 'pending') AS pending_skills
       FROM app_classes c LEFT JOIN app_school_years y ON y.id = c.year_id
       WHERE ${user.role === 'teacher' ? 'EXISTS (SELECT 1 FROM app_class_teachers t WHERE t.class_id = c.id AND t.teacher_id = $1)' : 'c.school_id = $1'}
       ORDER BY c.is_active DESC, c.school_year DESC, c.grade NULLS LAST, c.name`, [user.role === 'teacher' ? user.id : user.school_id]);
    const out = [];
    for (const c of rows) {
      const journeys = await this.journeysOf(this.db.query.bind(this.db) as Q, c.id, c.students);
      const running = journeys.filter((j) => j.state === 'running');
      out.push({ ...c, own: c.created_by === user.id, journeys: running.map((j) => ({ id: j.journey_id, title: j.title, percent: j.percent })), avg_progress: running.length ? Math.round(running.reduce((n, j) => n + j.percent, 0) / running.length) : null });
    }
    return out;
  }

  async classDetail(user: UserRow, id: number) {
    return this.db.tx(async (q) => {
      const cls = await this.mine(q, user, id);
      const teachers = await q('SELECT u.id, u.full_name FROM app_class_teachers t JOIN app_users u ON u.id = t.teacher_id WHERE t.class_id = $1 ORDER BY u.full_name', [id]);
      const students = (await this.studentIds(q, id)).length;
      return {
        ...cls, own: cls.created_by === user.id, teachers, students, journeys: await this.journeysOf(q, id, students), settings: await this.settingsOf(q, id),
        pending_leaves: Number((await q<{ n: string }>("SELECT count(*) AS n FROM hk_leave_requests WHERE class_id = $1 AND status = 'pending'", [id]))[0].n),
        pending_skills: Number((await q<{ n: string }>("SELECT count(*) AS n FROM hk_skill_uses WHERE class_id = $1 AND status = 'pending'", [id]))[0].n),
      };
    });
  }

  // ------------------------------------------------------------------ tạo, sửa, lưu trữ, xóa (HK.GV.008–011)
  async createClass(user: UserRow, body: { name: string; grade: number; description?: string | null }) {
    if (user.role !== 'teacher') throw new ForbiddenException('Giáo viên tự tạo lớp; quản trị viên trường tạo lớp ở trang quản trị');
    const year = (await this.db.query<{ id: number }>("SELECT id FROM app_school_years WHERE school_id = $1 AND status = 'active' LIMIT 1", [user.school_id]))[0];
    if (!year) throw new ConflictException('Trường chưa có năm học đang hoạt động; hãy nhờ quản trị viên trường kích hoạt năm học');
    const created = await this.classes.create(this.asSchool(user), { year_id: year.id, grade: Number(body.grade), name: String(body.name ?? ''), teacher_ids: [user.id], description: body.description ?? null });
    return this.classDetail(user, (created as { id: number }).id);
  }

  async updateClass(user: UserRow, id: number, body: { name?: string; description?: string | null; cover_url?: string | null }) {
    await this.mine(this.db.query.bind(this.db) as Q, user, id, true);
    if (body.cover_url !== undefined && body.cover_url !== null && body.cover_url !== '' && (!/^https:\/\/[^\s]+$/.test(body.cover_url) || body.cover_url.length > 500)) throw new BadRequestException('Ảnh bìa phải là liên kết https');
    if (body.name !== undefined && (body.name.trim().length < 1 || body.name.trim().length > 60)) throw new BadRequestException('Tên lớp từ 1 đến 60 ký tự');
    if (body.name !== undefined || body.description !== undefined) await this.classes.update(this.asSchool(user), id, { name: body.name, description: body.description });
    if (body.cover_url !== undefined) await this.db.query('UPDATE app_classes SET cover_url = $2 WHERE id = $1', [id, body.cover_url || null]);
    return this.classDetail(user, id);
  }

  /** Lớp do giáo viên tự tạo mới được lưu trữ/xóa; lớp do nhà trường tạo chỉ quản trị viên trường lưu trữ */
  private async ownClass(user: UserRow, id: number): Promise<ClassInfo> {
    const cls = await this.mine(this.db.query.bind(this.db) as Q, user, id);
    if (user.role === 'teacher' && cls.created_by !== user.id) throw new ForbiddenException('Lớp do nhà trường tạo: chỉ quản trị viên trường lưu trữ hoặc xóa');
    return cls;
  }

  async archive(user: UserRow, id: number, archived: boolean) {
    await this.ownClass(user, id);
    await this.classes.archive(this.asSchool(user), id, archived);
    return this.classDetail(user, id);
  }

  async removeClass(user: UserRow, id: number): Promise<void> {
    await this.ownClass(user, id);
    const data = (await this.db.query<{ n: string }>(
      `SELECT (SELECT count(*) FROM hk_class_journeys WHERE class_id = $1) + (SELECT count(*) FROM hk_assignments WHERE class_id = $1) + (SELECT count(*) FROM hk_adjustments WHERE class_id = $1) AS n`, [id]))[0];
    if (Number(data.n)) throw new ConflictException('Lớp đã có dữ liệu học (hành trình, bài tập, thưởng/phạt) nên chỉ lưu trữ được, không xóa');
    await this.classes.remove(this.asSchool(user), id);
  }

  async regenerateCode(user: UserRow, id: number) {
    await this.mine(this.db.query.bind(this.db) as Q, user, id, true);
    await this.classes.regenerateCode(this.asSchool(user), id);
    return this.classDetail(user, id);
  }

  async setJoinOpen(user: UserRow, id: number, open: boolean) {
    await this.mine(this.db.query.bind(this.db) as Q, user, id, true);
    await this.classes.update(this.asSchool(user), id, { join_open: open });
    return this.classDetail(user, id);
  }

  // ------------------------------------------------------------------ học sinh trong lớp (HK.GV.012–015)
  /** Học sinh của trường chưa ở trong lớp, để chọn thêm vào lớp */
  async searchStudents(user: UserRow, classId: number, term: string) {
    const cls = await this.mine(this.db.query.bind(this.db) as Q, user, classId);
    const t = searchText(term ?? '');
    const rows = await this.db.query<{ id: number; full_name: string; user_code: string | null; nickname: string | null; grade: number | null }>(
      `SELECT u.id, u.full_name, u.user_code, u.nickname, u.grade FROM app_users u
       WHERE u.school_id = $1 AND u.role = 'student' AND u.is_active = 1 AND u.deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM app_class_members m WHERE m.class_id = $2 AND m.user_id = u.id)
       ORDER BY u.full_name LIMIT 400`, [cls.school_id, classId]);
    return rows.filter((r) => !t || searchText(r.full_name, r.user_code, r.nickname).includes(t)).slice(0, 50);
  }

  async addStudents(user: UserRow, classId: number, studentIds: number[]) {
    await this.mine(this.db.query.bind(this.db) as Q, user, classId, true);
    if (!studentIds?.length || studentIds.length > 100) throw new BadRequestException('Hãy chọn từ 1 đến 100 học sinh');
    const res = await this.classes.addMembers(this.asSchool(user), classId, studentIds) as { added: number; skipped: number };
    return { added: res.added, skipped: res.skipped };
  }

  async studentTemplate(): Promise<Buffer> {
    return buildWorkbook('Học sinh', [{ key: 'code', header: 'Mã học sinh *', required: true, width: 22 }], [{ code: 'HS0001' }], ['Điền mã học sinh của trường (một mã mỗi dòng).', 'Học sinh đã ở trong lớp hoặc không có mã trong trường sẽ được bỏ qua và báo lại.']);
  }

  /** Thêm học sinh vào lớp bằng file Excel mẫu: so khớp theo mã học sinh trong trường; báo từng dòng không thêm được */
  async importStudents(user: UserRow, classId: number, file: UploadedXlsx | undefined) {
    const cls = await this.mine(this.db.query.bind(this.db) as Q, user, classId, true);
    const rows = await readSheet(checkUpload(file), [{ key: 'code', header: 'Mã học sinh *', required: true }]);
    if (!rows.length) throw new BadRequestException('File không có dòng nào');
    const found = await this.db.query<{ id: number; user_code: string }>("SELECT id, user_code FROM app_users WHERE school_id = $1 AND role = 'student' AND is_active = 1 AND deleted_at IS NULL AND user_code IS NOT NULL", [cls.school_id]);
    const byCode = new Map(found.map((f) => [f.user_code.trim().toUpperCase(), f.id]));
    const ids: number[] = [];
    const errors: Array<{ row: number; code: string; message: string }> = [];
    for (const r of rows) {
      const code = r.values.code.trim().toUpperCase();
      const id = byCode.get(code);
      if (!id) errors.push({ row: r.row, code: r.values.code, message: 'Không có học sinh mang mã này trong trường' });
      else if (ids.includes(id)) errors.push({ row: r.row, code: r.values.code, message: 'Mã bị lặp trong file' });
      else ids.push(id);
    }
    const res = ids.length ? await this.classes.addMembers(this.asSchool(user), classId, ids) as { added: number; skipped: number } : { added: 0, skipped: 0 };
    return { added: res.added, skipped: res.skipped, errors };
  }

  async removeStudent(user: UserRow, classId: number, studentId: number): Promise<void> {
    await this.mine(this.db.query.bind(this.db) as Q, user, classId, true);
    await this.classes.removeMember(this.asSchool(user), classId, studentId);
    await this.db.query('DELETE FROM hk_team_members WHERE class_id = $1 AND user_id = $2', [classId, studentId]);
  }

  /** Danh sách học sinh kèm nhân vật (HK.GV.015) và tìm theo tên, mã, biệt danh (HK.GV.014) */
  async students(user: UserRow, classId: number, term?: string) {
    await this.mine(this.db.query.bind(this.db) as Q, user, classId);
    const rows = await this.db.query<Record<string, any>>(
      `SELECT u.id, u.full_name, u.nickname, u.user_code, u.username, COALESCE(p.level, 1) AS level, COALESCE(p.xp, 0) AS xp, COALESCE(p.gold, 0) AS gold, COALESCE(p.hearts, 5) AS hearts,
              COALESCE(p.streak_current, 0) AS streak, cc.name AS character_name, cc.icon AS character_icon, cc.color AS character_color, t.id AS team_id, t.name AS team_name,
              (SELECT max(e.created_at) FROM hk_events e WHERE e.user_id = u.id) AS last_active
       FROM app_class_members m JOIN app_users u ON u.id = m.user_id AND u.role = 'student' AND u.deleted_at IS NULL
       LEFT JOIN hk_players p ON p.user_id = u.id LEFT JOIN hk_character_classes cc ON cc.id = p.class_id
       LEFT JOIN hk_team_members tm ON tm.class_id = m.class_id AND tm.user_id = u.id LEFT JOIN hk_teams t ON t.id = tm.team_id
       WHERE m.class_id = $1 ORDER BY u.full_name, u.id`, [classId]);
    const t = searchText(term ?? '');
    // HP tối đa áp dụng cho học sinh của lớp này: mặc định chung hoặc mức giáo viên đặt cho lớp (nếu thấp hơn)
    const classMax = (await this.settingsOf(this.db.query.bind(this.db) as Q, classId)).hearts_max;
    const base = (await this.game.cfg()).hearts.max;
    const max = classMax ? Math.min(base, classMax) : base;
    return rows.filter((r) => !t || searchText(r.full_name, r.nickname, r.user_code, r.username).includes(t)).map((r) => ({ ...r, hearts_max: max }));
  }

  // ------------------------------------------------------------------ đội (HK.GV.016)
  async teams(user: UserRow, classId: number) {
    await this.mine(this.db.query.bind(this.db) as Q, user, classId);
    return this.teamsOf(this.db.query.bind(this.db) as Q, classId);
  }

  private async teamsOf(q: Q, classId: number) {
    const teams = await q<Record<string, any>>('SELECT id, name, icon FROM hk_teams WHERE class_id = $1 ORDER BY id', [classId]);
    const members = await q<{ team_id: number; id: number; full_name: string; nickname: string | null }>(
      'SELECT tm.team_id, u.id, u.full_name, u.nickname FROM hk_team_members tm JOIN app_users u ON u.id = tm.user_id WHERE tm.class_id = $1 ORDER BY u.full_name', [classId]);
    return teams.map((t) => ({ ...t, members: members.filter((m) => m.team_id === t.id) }));
  }

  /** Chia ngẫu nhiên mỗi đội 4–6 học sinh (số đội làm tròn để các đội đều nhau); thay toàn bộ đội cũ */
  async autoTeams(user: UserRow, classId: number, size: number) {
    await this.mine(this.db.query.bind(this.db) as Q, user, classId, true);
    const per = clampInt(size, 4, 6, 'Số học sinh mỗi đội');
    return this.db.tx(async (q) => {
      const ids = await this.studentIds(q, classId);
      if (ids.length < 2) throw new ConflictException('Lớp cần ít nhất 2 học sinh để chia đội');
      const shuffled = [...ids];
      for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(this.game.clock.random() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
      const count = Math.max(1, Math.round(shuffled.length / per));
      const groups: number[][] = Array.from({ length: count }, () => []);
      shuffled.forEach((id, i) => groups[i % count].push(id));
      await q('DELETE FROM hk_teams WHERE class_id = $1', [classId]);
      for (const [i, g] of groups.entries()) {
        const team = (await q<{ id: number }>('INSERT INTO hk_teams (class_id, name, icon, created_by) VALUES ($1, $2, $3, $4) RETURNING id', [classId, `Đội ${TEAM_NAMES[i % TEAM_NAMES.length]}${i >= TEAM_NAMES.length ? ` ${Math.floor(i / TEAM_NAMES.length) + 1}` : ''}`, TEAM_ICONS[i % TEAM_ICONS.length], user.id]))[0];
        for (const uid of g) await q('INSERT INTO hk_team_members (team_id, class_id, user_id) VALUES ($1, $2, $3)', [team.id, classId, uid]);
      }
      return this.teamsOf(q, classId);
    });
  }

  /** Chia đội thủ công (kéo thả trên giao diện): gửi toàn bộ danh sách đội; học sinh chỉ ở một đội; đội trống bị bỏ */
  async setTeams(user: UserRow, classId: number, teams: Array<{ name: string; icon?: string; member_ids: number[] }>) {
    await this.mine(this.db.query.bind(this.db) as Q, user, classId, true);
    if (!Array.isArray(teams) || teams.length > 12) throw new BadRequestException('Tối đa 12 đội');
    return this.db.tx(async (q) => {
      const ids = new Set(await this.studentIds(q, classId));
      const used = new Set<number>();
      const names = new Set<string>();
      for (const t of teams) {
        const name = String(t.name ?? '').trim().replace(/\s+/g, ' ');
        if (name.length < 2 || name.length > 40) throw new BadRequestException('Tên đội từ 2 đến 40 ký tự');
        if (names.has(name.toLowerCase())) throw new BadRequestException(`Tên đội "${name}" bị trùng`);
        names.add(name.toLowerCase());
        if (t.icon && !(TEAM_ICONS as readonly string[]).includes(t.icon)) throw new BadRequestException(`Biểu tượng đội phải thuộc: ${TEAM_ICONS.join(', ')}`);
        if (!Array.isArray(t.member_ids) || t.member_ids.length > 8) throw new BadRequestException(`Đội "${name}" tối đa 8 học sinh`);
        for (const uid of t.member_ids) {
          if (!ids.has(uid)) throw new ForbiddenException('Có học sinh không thuộc lớp này');
          if (used.has(uid)) throw new BadRequestException('Mỗi học sinh chỉ ở một đội');
          used.add(uid);
        }
      }
      await q('DELETE FROM hk_teams WHERE class_id = $1', [classId]);
      for (const [i, t] of teams.entries()) {
        if (!t.member_ids.length) continue;
        const team = (await q<{ id: number }>('INSERT INTO hk_teams (class_id, name, icon, created_by) VALUES ($1, $2, $3, $4) RETURNING id', [classId, String(t.name).trim().replace(/\s+/g, ' '), t.icon ?? TEAM_ICONS[i % TEAM_ICONS.length], user.id]))[0];
        for (const uid of t.member_ids) await q('INSERT INTO hk_team_members (team_id, class_id, user_id) VALUES ($1, $2, $3)', [team.id, classId, uid]);
      }
      return this.teamsOf(q, classId);
    });
  }

  // ------------------------------------------------------------------ rời lớp (HK.HS.105, HK.GV.017)
  async requestLeave(user: UserRow, classId: number, reason?: string | null) {
    return this.db.tx(async (q) => {
      const cls = (await q<{ id: number; name: string; school_id: number }>('SELECT c.id, c.name, c.school_id FROM app_classes c JOIN app_class_members m ON m.class_id = c.id AND m.user_id = $2 WHERE c.id = $1', [classId, user.id]))[0];
      if (!cls) throw notFound('lớp');
      if ((await q("SELECT 1 FROM hk_leave_requests WHERE class_id = $1 AND user_id = $2 AND status = 'pending'", [classId, user.id])).length) throw new ConflictException('Em đã gửi yêu cầu rời lớp, hãy chờ giáo viên xác nhận');
      const text = String(reason ?? '').trim().slice(0, 300) || null;
      const req = (await q<{ id: number }>('INSERT INTO hk_leave_requests (class_id, user_id, reason) VALUES ($1, $2, $3) RETURNING id', [classId, user.id, text]))[0];
      const teachers = (await q<{ teacher_id: number }>('SELECT teacher_id FROM app_class_teachers WHERE class_id = $1', [classId])).map((t) => t.teacher_id);
      await notify(q, teachers, { kind: 'leave', title: 'Yêu cầu rời lớp', body: `${user.nickname || user.full_name} xin rời lớp ${cls.name}${text ? `: ${text}` : ''}`, class_id: classId, ref: { request_id: req.id }, by: user.id, school_id: cls.school_id });
      return { id: req.id, status: 'pending' };
    });
  }

  async leaveRequests(user: UserRow, classId: number) {
    await this.mine(this.db.query.bind(this.db) as Q, user, classId);
    return this.db.query(
      `SELECT r.id, r.status, r.reason, r.created_at, r.decided_at, u.id AS user_id, u.full_name, u.user_code FROM hk_leave_requests r JOIN app_users u ON u.id = r.user_id
       WHERE r.class_id = $1 ORDER BY (r.status = 'pending') DESC, r.created_at DESC LIMIT 100`, [classId]);
  }

  async decideLeave(user: UserRow, requestId: number, approve: boolean) {
    const req = (await this.db.query<{ id: number; class_id: number; user_id: number; status: string }>('SELECT id, class_id, user_id, status FROM hk_leave_requests WHERE id = $1', [requestId]))[0];
    if (!req) throw notFound('yêu cầu rời lớp');
    const cls = await this.mine(this.db.query.bind(this.db) as Q, user, req.class_id, true);
    if (req.status !== 'pending') throw new ConflictException('Yêu cầu này đã được xử lý');
    if (approve) await this.removeStudent(user, req.class_id, req.user_id);
    await this.db.tx(async (q) => {
      await q('UPDATE hk_leave_requests SET status = $2, decided_by = $3, decided_at = now() WHERE id = $1', [requestId, approve ? 'approved' : 'rejected', user.id]);
      await notify(q, [req.user_id], { kind: 'leave', title: approve ? 'Giáo viên đồng ý cho em rời lớp' : 'Giáo viên chưa đồng ý cho em rời lớp', body: `Lớp ${cls.name}. ${approve ? 'Dữ liệu học của em vẫn được giữ nguyên.' : 'Em vẫn ở trong lớp.'}`, class_id: req.class_id, by: user.id, school_id: cls.school_id });
    });
    return { id: requestId, status: approve ? 'approved' : 'rejected' };
  }

  // ------------------------------------------------------------------ thông báo (HK.HS.104)
  async notifications(user: UserRow, unreadOnly = false) {
    const items = await this.db.query<Record<string, any>>(
      `SELECT n.id, n.kind, n.title, n.body, n.read_at, n.created_at, n.class_id, c.name AS class_name, n.ref
       FROM app_notifications n LEFT JOIN app_classes c ON c.id = n.class_id WHERE n.user_id = $1${unreadOnly ? ' AND n.read_at IS NULL' : ''} ORDER BY n.created_at DESC, n.id DESC LIMIT 60`, [user.id]);
    const unread = Number((await this.db.query<{ n: string }>('SELECT count(*) AS n FROM app_notifications WHERE user_id = $1 AND read_at IS NULL', [user.id]))[0].n);
    return { unread, items };
  }

  async markRead(user: UserRow, ids?: number[]) {
    await this.db.query('UPDATE app_notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL AND ($2::int[] IS NULL OR id = ANY($2))', [user.id, ids?.length ? ids : null]);
    return { ok: true };
  }

  /** Thông báo của lớp hoặc của một đội do giáo viên gửi */
  async announce(user: UserRow, classId: number, body: { title: string; body: string; team_id?: number | null }) {
    const cls = await this.mine(this.db.query.bind(this.db) as Q, user, classId, true);
    const title = String(body.title ?? '').trim(), text = String(body.body ?? '').trim();
    if (title.length < 2 || title.length > 120) throw new BadRequestException('Tiêu đề từ 2 đến 120 ký tự');
    if (text.length < 1 || text.length > 1000) throw new BadRequestException('Nội dung từ 1 đến 1000 ký tự');
    return this.db.tx(async (q) => {
      let ids = await this.studentIds(q, classId);
      if (body.team_id) {
        if (!(await q('SELECT 1 FROM hk_teams WHERE id = $1 AND class_id = $2', [body.team_id, classId])).length) throw notFound('đội');
        ids = (await q<{ user_id: number }>('SELECT user_id FROM hk_team_members WHERE team_id = $1', [body.team_id])).map((r) => r.user_id);
      }
      const sent = await notify(q, ids, { kind: 'announce', title, body: text, class_id: classId, by: user.id, school_id: cls.school_id });
      return { sent };
    });
  }

  async announcements(user: UserRow, classId: number) {
    await this.mine(this.db.query.bind(this.db) as Q, user, classId);
    return this.db.query(
      `SELECT title, body, created_at, count(*)::int AS recipients, count(read_at)::int AS read FROM app_notifications WHERE class_id = $1 AND kind = 'announce' AND created_by = $2
       GROUP BY title, body, created_at ORDER BY created_at DESC LIMIT 20`, [classId, user.id]);
  }

  // ------------------------------------------------------------------ luật lớp (HK.GV.060)
  private async settingsOf(q: Q, classId: number) {
    const row = (await q<Record<string, any>>('SELECT hearts_enabled, hearts_max, leaderboard_enabled, skill_approval, team_goal_per_member, rules, war_enabled, war_minutes FROM hk_class_settings WHERE class_id = $1', [classId]))[0];
    const rules = (row?.rules as Rule[] | undefined) ?? [];
    return {
      hearts_enabled: row?.hearts_enabled ?? true, hearts_max: row?.hearts_max ?? null, leaderboard_enabled: row?.leaderboard_enabled ?? true, skill_approval: row?.skill_approval ?? false,
      team_goal_per_member: row?.team_goal_per_member ?? 100, rules: rules.length ? rules : DEFAULT_RULES, rules_default: !rules.length,
      war_enabled: row?.war_enabled ?? true, war_minutes: row?.war_minutes ?? null,
    };
  }

  async rules(user: UserRow, classId: number) {
    await this.mine(this.db.query.bind(this.db) as Q, user, classId);
    return this.settingsOf(this.db.query.bind(this.db) as Q, classId);
  }

  async setRules(user: UserRow, classId: number, body: Record<string, any>) {
    await this.mine(this.db.query.bind(this.db) as Q, user, classId, true);
    const cur = await this.settingsOf(this.db.query.bind(this.db) as Q, classId);
    let rules: Rule[] | null = null;
    if (body.rules !== undefined) {
      if (!Array.isArray(body.rules) || body.rules.length > 20) throw new BadRequestException('Tối đa 20 hành vi');
      const seen = new Set<string>();
      rules = body.rules.map((r: Record<string, unknown>, i: number) => {
        const label = String(r.label ?? '').trim();
        if (label.length < 2 || label.length > 60) throw new BadRequestException(`Hành vi ${i + 1}: tên từ 2 đến 60 ký tự`);
        const id = typeof r.id === 'string' && /^[a-z0-9_-]{1,24}$/.test(r.id) ? r.id : `h${i + 1}`;
        if (seen.has(id)) throw new BadRequestException('Mã hành vi bị trùng');
        seen.add(id);
        return { id, label, xp: clampInt(r.xp, -200, 200, `Hành vi ${i + 1} – điểm`), gold: clampInt(r.gold, -200, 200, `Hành vi ${i + 1} – vàng`), hp: clampInt(r.hp, -5, 5, `Hành vi ${i + 1} – tim`) };
      });
    }
    const heartsMax = body.hearts_max === undefined ? cur.hearts_max : body.hearts_max === null || body.hearts_max === '' ? null : clampInt(body.hearts_max, 1, 10, 'HP tối đa');
    const goal = body.team_goal_per_member === undefined ? cur.team_goal_per_member : clampInt(body.team_goal_per_member, 10, 2000, 'Mục tiêu điểm mỗi người của đội');
    const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
    const warMinutes = body.war_minutes === undefined ? cur.war_minutes : body.war_minutes === null || body.war_minutes === '' ? null : clampInt(body.war_minutes, 5, 240, 'Giới hạn chơi game trận đánh mỗi ngày (phút)');
    await this.db.query(
      `INSERT INTO hk_class_settings (class_id, hearts_enabled, hearts_max, leaderboard_enabled, skill_approval, team_goal_per_member, rules, updated_by, war_enabled, war_minutes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (class_id) DO UPDATE SET hearts_enabled = $2, hearts_max = $3, leaderboard_enabled = $4, skill_approval = $5, team_goal_per_member = $6, rules = $7, updated_by = $8, war_enabled = $9, war_minutes = $10, updated_at = now()`,
      [classId, bool(body.hearts_enabled, cur.hearts_enabled), heartsMax, bool(body.leaderboard_enabled, cur.leaderboard_enabled), bool(body.skill_approval, cur.skill_approval), goal,
        JSON.stringify(rules ?? (cur.rules_default ? [] : cur.rules)), user.id, bool(body.war_enabled, cur.war_enabled), warMinutes]);
    return this.settingsOf(this.db.query.bind(this.db) as Q, classId);
  }

  // ------------------------------------------------------------------ thưởng/phạt, sự kiện, hộp quà (HK.GV.059, 062, 065)
  private describe(x: { xp: number; gold: number; hp: number }): string {
    return [x.xp ? `${x.xp > 0 ? '+' : ''}${x.xp} điểm` : '', x.gold ? `${x.gold > 0 ? '+' : ''}${x.gold} vàng` : '', x.hp ? `${x.hp > 0 ? '+' : ''}${x.hp} tim` : ''].filter(Boolean).join(', ') || 'không đổi';
  }

  /** Áp dụng một lần thưởng/phạt cho một học sinh: ghi nhật ký rồi áp qua GameService; trả phần thật sự thay đổi */
  private async applyOne(q: Q, user: UserRow, cls: ClassInfo, student: UserRow, x: { kind: 'reward' | 'penalty' | 'event' | 'goal'; label: string; xp: number; gold: number; hp: number; team_id?: number | null }) {
    const adj = (await q<{ id: number }>('INSERT INTO hk_adjustments (class_id, user_id, team_id, kind, label, xp, gold, hp, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id::int AS id',
      [cls.id, student.id, x.team_id ?? null, x.kind, x.label, x.xp, x.gold, x.hp, user.id]))[0];
    const key = `adj:${adj.id}`;
    const applied = { xp: await this.game.adjustXp(q, student, x.xp, key), gold: await this.game.adjustGold(q, student, x.gold, key), hp: await this.game.adjustHearts(q, student, x.hp) };
    await q('UPDATE hk_adjustments SET applied = $2 WHERE id = $1', [adj.id, JSON.stringify(applied)]);
    return applied;
  }

  async adjust(user: UserRow, classId: number, body: AdjustInput) {
    const cls = await this.mine(this.db.query.bind(this.db) as Q, user, classId, true);
    return this.db.tx(async (q) => {
      const settings = await this.settingsOf(q, classId);
      const rule = body.rule_id ? settings.rules.find((r) => r.id === body.rule_id) : undefined;
      if (body.rule_id && !rule) throw new BadRequestException('Hành vi không có trong luật lớp');
      const xp = body.xp !== undefined ? clampInt(body.xp, -500, 500, 'Điểm') : rule?.xp ?? 0;
      const gold = body.gold !== undefined ? clampInt(body.gold, -500, 500, 'Vàng') : rule?.gold ?? 0;
      const hp = body.hp !== undefined ? clampInt(body.hp, -5, 5, 'Tim') : rule?.hp ?? 0;
      if (!xp && !gold && !hp) throw new BadRequestException('Hãy nhập điểm, vàng hoặc tim cần thưởng/phạt');
      const label = String(body.label ?? rule?.label ?? '').trim();
      if (label.length < 2 || label.length > 120) throw new BadRequestException('Hãy ghi lý do (từ 2 đến 120 ký tự)');
      const teamIds = [...new Set(body.team_ids ?? [])];
      const targets = new Map<number, number | null>();
      for (const id of body.user_ids ?? []) targets.set(id, null);
      for (const tid of teamIds) {
        if (!(await q('SELECT 1 FROM hk_teams WHERE id = $1 AND class_id = $2', [tid, classId])).length) throw notFound('đội');
        for (const m of await q<{ user_id: number }>('SELECT user_id FROM hk_team_members WHERE team_id = $1', [tid])) targets.set(m.user_id, tid);
      }
      if (!targets.size) throw new BadRequestException('Hãy chọn học sinh hoặc đội');
      if (targets.size > 100) throw new BadRequestException('Tối đa 100 học sinh mỗi lần');
      const students = await this.members(q, classId, [...targets.keys()]);
      const kind = xp < 0 || gold < 0 || hp < 0 ? 'penalty' : 'reward';
      const results = [];
      for (const s of students) {
        const applied = await this.applyOne(q, user, cls, s, { kind, label, xp, gold, hp, team_id: targets.get(s.id) ?? null });
        await notify(q, [s.id], { kind: 'reward', title: kind === 'reward' ? 'Giáo viên thưởng cho em' : 'Giáo viên trừ điểm của em', body: `${label}: ${this.describe(applied)}`, class_id: classId, by: user.id, school_id: cls.school_id });
        results.push({ user_id: s.id, name: s.full_name, applied });
      }
      return { label, kind, count: results.length, results };
    });
  }

  async history(user: UserRow, classId: number) {
    await this.mine(this.db.query.bind(this.db) as Q, user, classId);
    return this.db.query(
      `SELECT a.id::int AS id, a.kind, a.label, a.xp, a.gold, a.hp, a.applied, a.created_at, u.full_name, t.name AS team_name FROM hk_adjustments a JOIN app_users u ON u.id = a.user_id LEFT JOIN hk_teams t ON t.id = a.team_id
       WHERE a.class_id = $1 ORDER BY a.id DESC LIMIT 60`, [classId]);
  }

  /** Vòng quay vận mệnh: máy chủ chọn ngẫu nhiên một sự kiện rồi áp cho cả lớp hoặc một đội */
  async randomEvent(user: UserRow, classId: number, body: ScopeInput) {
    const cls = await this.mine(this.db.query.bind(this.db) as Q, user, classId, true);
    return this.db.tx(async (q) => {
      let ids: number[];
      let scope = 'cả lớp';
      let teamId: number | null = null;
      if (body.target === 'team') {
        const team = (await q<{ id: number; name: string }>('SELECT id, name FROM hk_teams WHERE id = $1 AND class_id = $2', [body.team_id ?? 0, classId]))[0];
        if (!team) throw notFound('đội');
        ids = (await q<{ user_id: number }>('SELECT user_id FROM hk_team_members WHERE team_id = $1', [team.id])).map((r) => r.user_id);
        scope = team.name; teamId = team.id;
      } else ids = await this.studentIds(q, classId);
      if (!ids.length) throw new ConflictException('Chưa có học sinh để áp dụng sự kiện');
      const event = RANDOM_EVENTS[Math.min(RANDOM_EVENTS.length - 1, Math.floor(this.game.clock.random() * RANDOM_EVENTS.length))];
      const x = { xp: event.xp ?? 0, gold: event.gold ?? 0, hp: event.hp ?? 0 };
      const students = await this.members(q, classId, ids);
      if (x.xp || x.gold || x.hp) {
        for (const s of students) {
          const applied = await this.applyOne(q, user, cls, s, { kind: 'event', label: event.label, ...x, team_id: teamId });
          await notify(q, [s.id], { kind: 'event', title: 'Sự kiện đầu giờ', body: `${event.label}${applied.xp || applied.gold || applied.hp ? ` (${this.describe(applied)})` : ''}`, class_id: classId, by: user.id, school_id: cls.school_id });
        }
      } else await notify(q, students.map((s) => s.id), { kind: 'event', title: 'Sự kiện đầu giờ', body: event.label, class_id: classId, by: user.id, school_id: cls.school_id });
      return { event: { id: event.id, label: event.label, ...x }, scope, affected: students.length };
    });
  }

  private async goalProgress(q: Q, classId: number, since: Date): Promise<number> {
    return Number((await q<{ n: string }>(
      `SELECT COALESCE(sum(p.points), 0) AS n FROM hk_points p JOIN app_class_members m ON m.user_id = p.user_id AND m.class_id = $1 WHERE p.created_at >= $2 AND p.reason <> 'teacher'`, [classId, since]))[0].n);
  }

  async goals(user: UserRow, classId: number) {
    await this.mine(this.db.query.bind(this.db) as Q, user, classId);
    return this.goalsOf(this.db.query.bind(this.db) as Q, classId);
  }

  private async goalsOf(q: Q, classId: number) {
    const rows = await q<Record<string, any>>('SELECT id, title, target_xp, reward_gold, reward_xp, since, opened_at, created_at FROM hk_class_goals WHERE class_id = $1 ORDER BY id DESC LIMIT 20', [classId]);
    const out = [];
    for (const g of rows) { const progress = await this.goalProgress(q, classId, new Date(g.since)); out.push({ ...g, progress, reached: progress >= g.target_xp, opened: Boolean(g.opened_at) }); }
    return out;
  }

  async createGoal(user: UserRow, classId: number, body: { title: string; target_xp: number; reward_gold?: number; reward_xp?: number }) {
    await this.mine(this.db.query.bind(this.db) as Q, user, classId, true);
    const title = String(body.title ?? '').trim();
    if (title.length < 2 || title.length > 120) throw new BadRequestException('Tên mục tiêu từ 2 đến 120 ký tự');
    const target = clampInt(body.target_xp, 10, 1_000_000, 'Mục tiêu điểm');
    if (!target) throw new BadRequestException('Hãy nhập mục tiêu điểm');
    await this.db.query('INSERT INTO hk_class_goals (class_id, title, target_xp, reward_gold, reward_xp, since, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [classId, title, target, clampInt(body.reward_gold ?? 20, 0, 1000, 'Vàng thưởng'), clampInt(body.reward_xp ?? 0, 0, 1000, 'Điểm thưởng'), this.game.clock.now(), user.id]);
    return this.goalsOf(this.db.query.bind(this.db) as Q, classId);
  }

  /** Mở hộp quà: chỉ khi cả lớp đã đạt mục tiêu điểm chung kể từ lúc đặt; thưởng cho từng học sinh một lần */
  async openGoal(user: UserRow, goalId: number) {
    const goal = (await this.db.query<Record<string, any>>('SELECT * FROM hk_class_goals WHERE id = $1', [goalId]))[0];
    if (!goal) throw notFound('mục tiêu');
    const cls = await this.mine(this.db.query.bind(this.db) as Q, user, goal.class_id, true);
    return this.db.tx(async (q) => {
      const g = (await q<Record<string, any>>('SELECT * FROM hk_class_goals WHERE id = $1 FOR UPDATE', [goalId]))[0];
      if (g.opened_at) throw new ConflictException('Hộp quà này đã được mở');
      const progress = await this.goalProgress(q, g.class_id, new Date(g.since));
      if (progress < g.target_xp) throw new ConflictException(`Cả lớp mới đạt ${progress}/${g.target_xp} điểm, chưa mở được hộp quà`);
      const students = await this.members(q, g.class_id, await this.studentIds(q, g.class_id));
      for (const s of students) {
        const applied = await this.applyOne(q, user, cls, s, { kind: 'goal', label: `Hộp quà lớp: ${g.title}`, xp: g.reward_xp, gold: g.reward_gold, hp: 0 });
        await notify(q, [s.id], { kind: 'goal', title: 'Cả lớp đã mở hộp quà!', body: `${g.title}: ${this.describe(applied)}`, class_id: g.class_id, by: user.id, school_id: cls.school_id });
      }
      await q('UPDATE hk_class_goals SET opened_at = now(), opened_by = $2 WHERE id = $1', [goalId, user.id]);
      return { opened: true, students: students.length };
    });
  }

  async deleteGoal(user: UserRow, goalId: number): Promise<void> {
    const goal = (await this.db.query<{ class_id: number; opened_at: string | null }>('SELECT class_id, opened_at FROM hk_class_goals WHERE id = $1', [goalId]))[0];
    if (!goal) throw notFound('mục tiêu');
    await this.mine(this.db.query.bind(this.db) as Q, user, goal.class_id, true);
    if (goal.opened_at) throw new ConflictException('Hộp quà đã mở nên được giữ lại trong lịch sử');
    await this.db.query('DELETE FROM hk_class_goals WHERE id = $1', [goalId]);
  }

  // ------------------------------------------------------------------ huy hiệu thủ công (HK.GV.061)
  async awardBadge(user: UserRow, classId: number, badgeId: number, body: { user_ids?: number[]; team_ids?: number[] }) {
    const cls = await this.mine(this.db.query.bind(this.db) as Q, user, classId, true);
    return this.db.tx(async (q) => {
      const badge = (await q<{ id: number; name: string; icon: string; color: string }>("SELECT id, name, icon, color FROM hk_badges WHERE id = $1 AND is_active AND scope = 'school' AND school_id = $2", [badgeId, cls.school_id]))[0];
      if (!badge) throw notFound('huy hiệu của trường');
      const ids = new Set(body.user_ids ?? []);
      for (const tid of body.team_ids ?? []) {
        if (!(await q('SELECT 1 FROM hk_teams WHERE id = $1 AND class_id = $2', [tid, classId])).length) throw notFound('đội');
        for (const m of await q<{ user_id: number }>('SELECT user_id FROM hk_team_members WHERE team_id = $1', [tid])) ids.add(m.user_id);
      }
      if (!ids.size || ids.size > 100) throw new BadRequestException('Hãy chọn từ 1 đến 100 học sinh hoặc đội');
      let awarded = 0, already = 0;
      for (const s of await this.members(q, classId, [...ids])) {
        if (await this.game.awardBadge(q, s, badge, user.id)) awarded += 1; else already += 1;
      }
      return { badge: badge.name, awarded, already };
    });
  }

  // ------------------------------------------------------------------ xếp hạng lớp và đội (HK.GV.064, HK.HS.076)
  private async teamBoardOf(q: Q, classId: number, period: string) {
    const range = this.range(period);
    const rows = await q<{ id: number; name: string; icon: string; members: number; xp: number }>(
      `SELECT t.id, t.name, t.icon, (SELECT count(*)::int FROM hk_team_members x WHERE x.team_id = t.id) AS members,
              COALESCE((SELECT sum(p.points) FROM hk_team_members x JOIN hk_points p ON p.user_id = x.user_id${range ? ' AND p.created_at >= $2 AND p.created_at < $3' : ''} WHERE x.team_id = t.id), 0)::int AS xp
       FROM hk_teams t WHERE t.class_id = $1 ORDER BY xp DESC, t.id`, range ? [classId, range[0], range[1]] : [classId]);
    return rows.map((r) => ({ ...r, rank: 1 + rows.filter((x) => x.xp > r.xp).length }));
  }

  async classBoard(user: UserRow, classId: number, period?: string) {
    await this.mine(this.db.query.bind(this.db) as Q, user, classId);
    const used = period && ['week', 'month', 'all'].includes(period) ? period : 'week';
    const range = this.range(used);
    const students = await this.db.query<{ id: number; full_name: string; nickname: string | null; xp: number }>(
      `SELECT u.id, u.full_name, u.nickname, COALESCE(sum(p.points), 0)::int AS xp FROM app_class_members m JOIN app_users u ON u.id = m.user_id AND u.role = 'student'
       LEFT JOIN hk_points p ON p.user_id = u.id${range ? ' AND p.created_at >= $2 AND p.created_at < $3' : ''} WHERE m.class_id = $1 GROUP BY u.id ORDER BY xp DESC, u.full_name`, range ? [classId, range[0], range[1]] : [classId]);
    return { period: used, students: students.map((s) => ({ ...s, rank: 1 + students.filter((x) => x.xp > s.xp).length })), teams: await this.teamBoardOf(this.db.query.bind(this.db) as Q, classId, used) };
  }

  // ------------------------------------------------------------------ tiến độ lớp trên bản đồ (HK.GV.028)
  async journeyProgress(user: UserRow, classId: number, journeyId?: number) {
    await this.mine(this.db.query.bind(this.db) as Q, user, classId);
    const q = this.db.query.bind(this.db) as Q;
    const assigned = await q<{ journey_id: number; title: string; starts_at: string | null; ends_at: string | null }>(
      'SELECT cj.journey_id, j.title, cj.starts_at, cj.ends_at FROM hk_class_journeys cj JOIN hk_journeys j ON j.id = cj.journey_id WHERE cj.class_id = $1 ORDER BY cj.assigned_at DESC', [classId]);
    const pick = journeyId ? assigned.find((a) => a.journey_id === journeyId) : assigned[0];
    if (journeyId && !pick) throw notFound('hành trình trong lớp này');
    if (!pick) return { journeys: [], journey: null, nodes: [], students: [], summary: { avg_percent: 0, behind: 0 } };
    const ids = await this.studentIds(q, classId);
    const people = await q<{ id: number; full_name: string; nickname: string | null; last_active: string | null }>(
      `SELECT u.id, u.full_name, u.nickname, (SELECT max(e.created_at) FROM hk_events e WHERE e.user_id = u.id) AS last_active FROM app_users u WHERE u.id = ANY($1) ORDER BY u.full_name`, [ids]);
    const base = await q<Record<string, any>>('SELECT id, position, kind, title, pos_x, pos_y FROM hk_nodes WHERE journey_id = $1 ORDER BY position', [pick.journey_id]);
    const counts = new Map<number, { done: number; at: number }>(base.map((n) => [n.id, { done: 0, at: 0 }]));
    const now = Date.now();
    const starts = pick.starts_at ? new Date(pick.starts_at).getTime() : null, ends = pick.ends_at ? new Date(pick.ends_at).getTime() : null;
    const rows = [];
    for (const p of people) {
      const nodes = await nodesWithState(q, p.id, pick.journey_id);
      const done = nodes.filter((n) => n.state === 'done').length;
      for (const n of nodes) { const c = counts.get(n.id); if (c) { if (n.state === 'done') c.done += 1; else if (n.state === 'available') c.at += 1; } }
      const current = nodes.find((n) => n.state === 'available');
      rows.push({ id: p.id, name: p.nickname || p.full_name, full_name: p.full_name, done, total: nodes.length, percent: nodes.length ? Math.round((done / nodes.length) * 100) : 0, current_node: current?.title ?? null, last_active: p.last_active, behind: false, reason: null as string | null });
    }
    const avg = rows.length ? rows.reduce((n, r) => n + r.done, 0) / rows.length : 0;
    for (const r of rows) {
      if (r.done >= r.total) continue;
      const expected = starts && ends ? Math.ceil(r.total * Math.min(1, Math.max(0, (now - starts) / (ends - starts)))) : null;
      const idle = !r.last_active || now - new Date(r.last_active).getTime() > 7 * 86_400_000;
      if (expected !== null && r.done < expected) { r.behind = true; r.reason = `Mới xong ${r.done}/${expected} nút theo lịch`; }
      else if (idle) { r.behind = true; r.reason = 'Chưa học trong 7 ngày gần đây'; }
      else if (rows.length >= 4 && r.done < avg - 1.5) { r.behind = true; r.reason = 'Chậm hơn mức trung bình của lớp'; }
    }
    return {
      journeys: assigned.map((a) => ({ id: a.journey_id, title: a.title })), journey: { id: pick.journey_id, title: pick.title, starts_at: pick.starts_at, ends_at: pick.ends_at },
      nodes: base.map((n) => ({ ...n, done: counts.get(n.id)!.done, at_node: counts.get(n.id)!.at, percent: ids.length ? Math.round((counts.get(n.id)!.done / ids.length) * 100) : 0 })),
      students: rows.sort((a, b) => Number(b.behind) - Number(a.behind) || a.percent - b.percent),
      summary: { avg_percent: rows.length ? Math.round(rows.reduce((n, r) => n + r.percent, 0) / rows.length) : 0, behind: rows.filter((r) => r.behind).length, students: rows.length },
    };
  }

  // ------------------------------------------------------------------ học sinh: lớp học của tôi (HK.HS.099, 103, 071, 076)
  private async studentClass(q: Q, user: UserRow, classId: number): Promise<{ id: number; name: string; school_id: number }> {
    const row = (await q<{ id: number; name: string; school_id: number }>('SELECT c.id, c.name, c.school_id FROM app_classes c JOIN app_class_members m ON m.class_id = c.id AND m.user_id = $2 WHERE c.id = $1', [classId, user.id]))[0];
    if (!row) throw notFound('lớp');
    return row;
  }

  async myClassList(user: UserRow) {
    const q = this.db.query.bind(this.db) as Q;
    const rows = await q<Record<string, any>>(
      `SELECT c.id, c.name, c.grade, c.school_year, c.description, c.cover_url, c.is_active,
              COALESCE((SELECT json_agg(json_build_object('id', u.id, 'full_name', u.full_name) ORDER BY u.full_name) FROM app_class_teachers t JOIN app_users u ON u.id = t.teacher_id WHERE t.class_id = c.id), '[]'::json) AS teachers,
              (SELECT count(*)::int FROM app_class_members x JOIN app_users u ON u.id = x.user_id AND u.role = 'student' WHERE x.class_id = c.id) AS members,
              (SELECT t.name FROM hk_team_members tm JOIN hk_teams t ON t.id = tm.team_id WHERE tm.class_id = c.id AND tm.user_id = $1) AS team_name,
              (SELECT count(*)::int FROM hk_leave_requests r WHERE r.class_id = c.id AND r.user_id = $1 AND r.status = 'pending') AS leave_pending
       FROM app_classes c JOIN app_class_members m ON m.class_id = c.id AND m.user_id = $1 ORDER BY c.is_active DESC, c.school_year DESC, c.name`, [user.id]);
    const out = [];
    for (const c of rows) out.push({ ...c, journeys: (await this.journeysOf(q, c.id, c.members)).filter((j) => j.state === 'running').map((j) => ({ id: j.journey_id, title: j.title, campaign_title: j.campaign_title })) });
    return out;
  }

  async myClassDetail(user: UserRow, classId: number) {
    return this.db.tx(async (q) => {
      const cls = await this.studentClass(q, user, classId);
      const info = (await q<Record<string, any>>('SELECT c.id, c.name, c.grade, c.school_year, c.description, c.cover_url FROM app_classes c WHERE c.id = $1', [classId]))[0];
      const teachers = await q('SELECT u.id, u.full_name FROM app_class_teachers t JOIN app_users u ON u.id = t.teacher_id WHERE t.class_id = $1 ORDER BY u.full_name', [classId]);
      const members = await q<Record<string, any>>(
        `SELECT u.id, COALESCE(NULLIF(u.nickname, ''), u.full_name) AS name, COALESCE(p.level, 1) AS level, cc.name AS character_name, cc.icon AS character_icon, cc.color AS character_color, t.id AS team_id, t.name AS team_name, (u.id = $2) AS me
         FROM app_class_members m JOIN app_users u ON u.id = m.user_id AND u.role = 'student' LEFT JOIN hk_players p ON p.user_id = u.id LEFT JOIN hk_character_classes cc ON cc.id = p.class_id
         LEFT JOIN hk_team_members tm ON tm.class_id = m.class_id AND tm.user_id = u.id LEFT JOIN hk_teams t ON t.id = tm.team_id WHERE m.class_id = $1 ORDER BY name`, [classId, user.id]);
      const mine = members.find((m) => m.me);
      const settings = await this.settingsOf(q, classId);
      const journeys = await this.journeysOf(q, classId, members.length);
      const announcements = await q(`SELECT id, title, body, created_at FROM app_notifications WHERE class_id = $1 AND kind = 'announce' AND user_id = $2 ORDER BY created_at DESC LIMIT 10`, [classId, user.id]);
      const leave = (await q<{ status: string }>("SELECT status FROM hk_leave_requests WHERE class_id = $1 AND user_id = $2 AND status = 'pending'", [classId, user.id]))[0];
      return {
        ...info, name: cls.name, teachers, members, journeys: journeys.filter((j) => j.state !== 'ended').map((j) => ({ journey_id: j.journey_id, title: j.title, campaign_title: j.campaign_title, state: j.state, starts_at: j.starts_at, ends_at: j.ends_at, percent: j.percent })),
        team: mine?.team_id ? await this.myTeam(q, classId, mine.team_id, settings.team_goal_per_member) : null, leaderboard_enabled: settings.leaderboard_enabled, skill_approval: settings.skill_approval,
        goals: (await this.goalsOf(q, classId)).slice(0, 3), announcements, leave_pending: Boolean(leave),
      };
    });
  }

  /** Đội của em (HK.HS.071): thành viên, điểm đội tuần này, nhiệm vụ của đội (mục tiêu điểm tuần và cả đội đạt mục tiêu ngày) */
  private async myTeam(q: Q, classId: number, teamId: number, perMember: number) {
    const team = (await q<Record<string, any>>('SELECT id, name, icon FROM hk_teams WHERE id = $1', [teamId]))[0];
    const range = this.range('week')!;
    const members = await q<Record<string, any>>(
      `SELECT u.id, COALESCE(NULLIF(u.nickname, ''), u.full_name) AS name, COALESCE(p.level, 1) AS level,
              COALESCE((SELECT sum(x.points) FROM hk_points x WHERE x.user_id = u.id AND x.created_at >= $2 AND x.created_at < $3), 0)::int AS xp,
              COALESCE((SELECT d.reached FROM hk_daily d WHERE d.user_id = u.id AND d.day = $4::date), false) AS goal_today
       FROM hk_team_members tm JOIN app_users u ON u.id = tm.user_id LEFT JOIN hk_players p ON p.user_id = u.id WHERE tm.team_id = $1 ORDER BY xp DESC, name`, [teamId, range[0], range[1], dayKey(this.game.clock.now())]);
    const total = members.reduce((n, m) => n + m.xp, 0);
    const target = perMember * members.length;
    const board = await this.teamBoardOf(q, classId, 'week');
    return {
      ...team, members, xp_week: total, rank: board.find((b) => b.id === teamId)?.rank ?? null, teams: board.length,
      quests: [
        { id: 'weekly', title: `Cả đội ghi ${target} điểm trong tuần`, progress: Math.min(total, target), target, done: total >= target },
        { id: 'daily', title: 'Mọi thành viên đạt mục tiêu ngày hôm nay', progress: members.filter((m) => m.goal_today).length, target: members.length, done: members.length > 0 && members.every((m) => m.goal_today) },
      ],
    };
  }

  /** Bảng xếp hạng đội của lớp (HK.HS.076) cho học sinh trong lớp */
  async teamBoard(user: UserRow, classId: number, period?: string) {
    return this.db.tx(async (q) => {
      await this.studentClass(q, user, classId);
      const enabled = (await this.settingsOf(q, classId)).leaderboard_enabled;
      const used = period && ['week', 'month', 'all'].includes(period) ? period : 'week';
      if (!enabled) return { period: used, disabled: true, teams: [], me_team: null, message: 'Giáo viên đã tắt bảng xếp hạng của lớp này.' };
      const teams = await this.teamBoardOf(q, classId, used);
      const mine = (await q<{ team_id: number }>('SELECT team_id FROM hk_team_members WHERE class_id = $1 AND user_id = $2', [classId, user.id]))[0]?.team_id ?? null;
      return { period: used, disabled: false, teams: teams.map((t) => ({ ...t, mine: t.id === mine })), me_team: mine };
    });
  }
}

