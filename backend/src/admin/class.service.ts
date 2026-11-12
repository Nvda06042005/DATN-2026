/**
 * Lớp học (HK.QT.022, HK.QT.035–040, HK.HS.008): quản trị trường tạo lớp theo năm học và khối, phân công một giáo viên mỗi học kỳ,
 * xếp học sinh hàng loạt, chuyển lớp cùng khối, nhân bản sang năm học mới (lên lớp); học sinh tham gia lớp bằng mã 6 ký tự, không mật khẩu.
 * Lớp đã có học sinh chỉ được lưu trữ, không xóa; năm học đã kết thúc không cho sửa dữ liệu.
 */
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { randomInt } from 'crypto';
import { DatabaseService, Q, UserRow } from '../database/database.service';
import { buildClassListSheet, cellText, checkUpload, classTemplateFilename, Column, normHeader, parseDate, readSheet, UploadedXlsx } from './excel';
import { likeEscape, SchoolService } from './school.service';
import { notify } from '../classroom/notify';

/**
 * Cột của file xếp lớp (giống danh sách lớp của nhà trường: STT, họ tên, ngày sinh, giới tính) cộng mã học sinh và lớp.
 * Học sinh được nhận ra bằng mã; để trống mã thì bằng họ tên + ngày sinh. Giới tính chỉ để đối chiếu, không đọc.
 * Mẫu mỗi lớp một file ghi lớp ở ô Lớp đầu file (cột LỚP tự lấy theo ô đó); file cũ nhiều lớp ghi lớp ở từng dòng.
 */
const ASSIGN_COLUMNS: Column[] = [
  { key: 'user_code', header: 'Mã học sinh', aliases: ['Mã HS'], required: true, width: 24 },
  { key: 'full_name', header: 'Họ và tên', aliases: ['Họ tên'], width: 30 },
  { key: 'birth_date', header: 'Ngày sinh', aliases: ['Ngày tháng năm sinh'], width: 16 },
  { key: 'gender', header: 'Giới tính', width: 12 },
  { key: 'class_name', header: 'Lớp', width: 14 },
];
/** Tên lớp gõ tay: bỏ khoảng trắng thừa, viết hoa phần khối + chữ ("6a1" → "6A1") */
const tidyClassName = (text: string) => text.trim().replace(/\s+/g, ' ').replace(/^(\d+)([a-zđ]+)/i, (m) => m.toLocaleUpperCase('vi'));
const plainName = (text: string) => text.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');
const ddmmyyyy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/** Dòng tiêu đề A2 của file mẫu xếp lớp: năm học, tên trường, mã trường (để chỉ nhận đúng file của trường và năm học) */
export const assignSubtitle = (yearLabel: string, school: string, code?: string | null) => `Mẫu xếp lớp năm học ${yearLabel} · ${school}${code ? ` · Mã trường ${code}` : ''}`;

/**
 * Chỉ nhận đúng file mẫu xếp lớp của trường và năm học đang chọn (yêu cầu 12/11/2026). File mẫu/danh sách giáo viên, học sinh bị từ chối;
 * file cũ tự lập (tiêu đề cột ở dòng 1, không ghi trường) vẫn nhận như trước.
 */
export function checkAssignFile(subtitle: string, spec: { school_name: string; school_code: string; year_label: string }): void {
  const text = normHeader(subtitle);
  for (const [head, label] of [['Mẫu nhập danh sách giáo viên', 'file mẫu giáo viên'], ['Mẫu nhập danh sách học sinh', 'file mẫu học sinh'], ['Danh sách giáo viên', 'file danh sách giáo viên'], ['Danh sách học sinh', 'file danh sách học sinh']] as const) {
    const h = normHeader(head);
    if (text === h || text.startsWith(`${h} `)) throw new BadRequestException(`Đây là ${label}, không phải file xếp lớp. Hãy tải file mẫu xếp lớp năm học ${spec.year_label} rồi điền.`);
  }
  if (!text.startsWith(normHeader('Mẫu xếp lớp năm học'))) return;
  const year = /năm học\s+(\d{4}\s*-\s*\d{4})/i.exec(subtitle)?.[1]?.replace(/\s/g, '');
  if (year && year !== spec.year_label) throw new BadRequestException(`File mẫu này của năm học ${year}, đang xếp lớp năm học ${spec.year_label}. Hãy tải mẫu của năm học ${spec.year_label} rồi điền.`);
  const code = /Mã trường\s+(\S+)/.exec(subtitle)?.[1];
  const owner = subtitle.split('·')[1]?.trim() ?? '';
  if (code ? code !== spec.school_code : normHeader(owner) !== normHeader(spec.school_name)) {
    throw new BadRequestException(`File này của trường khác${owner ? ` (${owner}${code ? `, mã ${code}` : ''})` : ''}. Chỉ nhận file mẫu xếp lớp của ${spec.school_name}; hãy tải mẫu của trường rồi điền.`);
  }
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** Mã tham gia lớp: 6 ký tự, bỏ I, O, 0, 1 dễ nhầm */
export const newJoinCode = (): string => Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
export const normJoinCode = (code: string): string => code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

interface ClassRow {
  id: number; school_id: number; year_id: number | null; school_year: string; class_code: string; name: string; grade: number | null; is_active: boolean;
  join_code: string | null; join_open: boolean; expected_size: number | null; description: string | null; status: string; closed_at: string | null;
}

export interface ClassFilter { school_id?: number; year_id?: number; semester?: number; grade?: number; q?: string; active?: 'true' | 'false'; teacher_id?: number; page?: number; limit?: number }

@Injectable()
export class ClassService {
  constructor(
    private readonly db: DatabaseService,
    private readonly schools: SchoolService,
  ) {}

  private async log(q: Q, cls: { id: number; school_id: number }, kind: string, actor: UserRow | null, extra: { user_id?: number | null; teacher_id?: number | null; related_class_id?: number | null; note?: string | null } = {}) {
    await q(
      'INSERT INTO app_class_events (school_id, class_id, kind, actor_id, teacher_id, user_id, related_class_id, note) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [cls.school_id, cls.id, kind, actor?.id ?? null, extra.teacher_id ?? null, extra.user_id ?? null, extra.related_class_id ?? null, extra.note ?? null],
    );
  }

  private async load(q: Q, actor: UserRow, id: number, lock = false): Promise<ClassRow> {
    const scope = actor.role === 'school_admin' ? actor.school_id : null;
    const cls = (await q<ClassRow>(`SELECT * FROM app_classes WHERE id = $1 AND ($2::integer IS NULL OR school_id = $2)${lock ? ' FOR UPDATE' : ''}`, [id, scope]))[0];
    if (!cls) throw new NotFoundException('Không tìm thấy lớp');
    return cls;
  }

  private async openClass(q: Q, actor: UserRow, id: number): Promise<ClassRow> {
    const cls = await this.load(q, actor, id, true);
    await this.schools.assertYearOpen(q, cls.year_id);
    return cls;
  }

  private async view(q: Q, id: number, semester?: number) {
    const cls = (await q<Record<string, unknown>>(
      `SELECT c.id, c.school_id, c.year_id, c.school_year, c.class_code, c.registration_code, c.name, c.grade, c.is_active, c.join_code, c.join_open, c.expected_size, c.description, c.status, c.closed_at, c.created_at,
              y.status AS year_status,
              COALESCE($2::int,public.app_class_semester(c.year_id),1) AS semester,
              COALESCE(public.app_class_semester(c.year_id),1) AS active_semester,
              EXISTS(SELECT 1 FROM app_class_teachers old WHERE old.class_id=c.id GROUP BY old.class_id HAVING count(*)>1)
                AND NOT EXISTS(SELECT 1 FROM app_class_term_teachers t WHERE t.class_id=c.id) AS legacy_teacher_review,
              COALESCE((SELECT json_agg(json_build_object('id', u.id, 'full_name', u.full_name, 'email', u.email, 'is_active', u.is_active) ORDER BY u.full_name)
                        FROM app_class_teacher_assignments t JOIN app_users u ON u.id=t.teacher_id WHERE t.class_id=c.id AND t.semester=COALESCE($2::int,public.app_class_semester(c.year_id),1)), '[]'::json) AS teachers,
              (SELECT json_agg(json_build_object('semester',s.n,'teacher_id',t.teacher_id,'teacher_name',u.full_name,'starts_on',CASE s.n WHEN 1 THEN y.term1_starts_on ELSE y.term2_starts_on END,
                'ends_on',CASE s.n WHEN 1 THEN y.term1_ends_on ELSE y.term2_ends_on END) ORDER BY s.n)
                FROM (VALUES(1),(2)) s(n) LEFT JOIN app_class_teacher_assignments t ON t.class_id=c.id AND t.semester=s.n LEFT JOIN app_users u ON u.id=t.teacher_id) AS term_teachers,
              (SELECT count(*)::int FROM app_class_members m JOIN app_users u ON u.id = m.user_id WHERE m.class_id = c.id AND u.role = 'student' AND u.deleted_at IS NULL) AS students
       FROM app_classes c LEFT JOIN app_school_years y ON y.id = c.year_id WHERE c.id = $1`, [id,semester ?? null]))[0];
    return cls;
  }

  /** Giáo viên hợp lệ của trường để phân công: đang hoạt động, đúng trường */
  private async validTeachers(q: Q, schoolId: number, ids: number[]): Promise<number[]> {
    const unique = [...new Set(ids)];
    if (unique.length>1) throw new UnprocessableEntityException('Mỗi lớp chỉ có một giáo viên phụ trách lớp trong một học kỳ');
    if (!unique.length) return [];
    const rows = await q<{ id: number }>("SELECT id FROM app_users WHERE id = ANY($1) AND school_id = $2 AND role = 'teacher' AND is_active = 1 AND deleted_at IS NULL", [unique, schoolId]);
    if (rows.length !== unique.length) throw new UnprocessableEntityException('Có giáo viên không thuộc trường hoặc đang bị khóa');
    return unique;
  }

  async list(actor: UserRow, f: ClassFilter) {
    return this.schools.run(actor, async (q, scope) => {
      const where: string[] = [], params: unknown[] = [];
      const add = (sql: string, v: unknown) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
      if (scope !== null) add('c.school_id = ?', scope); else if (f.school_id) add('c.school_id = ?', f.school_id);
      if (f.year_id) add('c.year_id = ?', f.year_id);
      if (f.grade) add('c.grade = ?', f.grade);
      if (f.active) add('c.is_active = ?', f.active === 'true');
      if (f.teacher_id) add('EXISTS (SELECT 1 FROM app_class_teacher_assignments t WHERE t.class_id=c.id AND t.semester=COALESCE('+ (f.semester === 1 || f.semester === 2 ? String(f.semester) : 'public.app_class_semester(c.year_id)') +',1) AND t.teacher_id=?)', f.teacher_id);
      if (f.q?.trim()) add("(c.name || ' ' || c.class_code || ' ' || c.registration_code) ILIKE ? ESCAPE '\\'", `%${likeEscape(f.q.trim())}%`);
      const condition = where.length ? where.join(' AND ') : 'TRUE';
      const page = f.page ?? 1, limit = f.limit ?? 50;
      const total = Number((await q<{ n: string }>(`SELECT count(*) AS n FROM app_classes c WHERE ${condition}`, params))[0].n);
      const items = await q(
        `SELECT c.id, c.school_id, c.year_id, c.school_year, c.class_code, c.registration_code, c.name, c.grade, c.is_active, c.join_code, c.join_open, c.expected_size, c.status, y.status AS year_status,
                COALESCE($${params.length+3}::int,public.app_class_semester(c.year_id),1) AS semester,
                COALESCE((SELECT json_agg(json_build_object('id', u.id, 'full_name', u.full_name) ORDER BY u.full_name) FROM app_class_teacher_assignments t JOIN app_users u ON u.id = t.teacher_id WHERE t.class_id = c.id AND t.semester=COALESCE($${params.length+3}::int,public.app_class_semester(c.year_id),1)), '[]'::json) AS teachers,
                (SELECT count(*)::int FROM app_class_members m JOIN app_users u ON u.id = m.user_id WHERE m.class_id = c.id AND u.role = 'student' AND u.deleted_at IS NULL) AS students
         FROM app_classes c LEFT JOIN app_school_years y ON y.id = c.year_id WHERE ${condition}
         ORDER BY c.school_year DESC, c.grade NULLS LAST, c.name, c.id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, (page - 1) * limit,f.semester ?? null]);
      return { items, total, page, limit };
    });
  }

  async detail(actor: UserRow, id: number, semester?: number) {
    return this.schools.run(actor, async (q) => {
      const cls = await this.load(q, actor, id);
      const students = await q(
        `SELECT u.id, u.full_name, u.user_code, u.username, u.birth_date, u.gender, u.is_active, u.nickname, m.joined_at FROM app_class_members m JOIN app_users u ON u.id = m.user_id
         WHERE m.class_id = $1 AND u.role = 'student' AND u.deleted_at IS NULL ORDER BY u.full_name, u.id`, [id]);
      return { ...(await this.view(q, cls.id,semester)), members: students };
    });
  }

  async events(actor: UserRow, id: number) {
    return this.schools.run(actor, async (q) => {
      await this.load(q, actor, id);
      return q(
        `SELECT e.id, e.kind, e.note, e.created_at, a.full_name AS actor_name, u.full_name AS user_name, t.full_name AS teacher_name
         FROM app_class_events e LEFT JOIN app_users a ON a.id = e.actor_id LEFT JOIN app_users u ON u.id = e.user_id LEFT JOIN app_users t ON t.id = e.teacher_id
         WHERE e.class_id = $1 ORDER BY e.id DESC LIMIT 100`, [id]);
    });
  }

  /** Tạo lớp (HK.QT.036): thuộc một năm học còn mở và một khối đang bật; có thể phân công giáo viên ngay */
  async create(actor: UserRow, body: { school_id?: number | null; year_id: number; grade: number; name: string; semester?: number; teacher_ids?: number[]; expected_size?: number | null; description?: string | null }) {
    const schoolId = this.schools.target(actor, body.school_id);
    const name = body.name.trim().replace(/\s+/g, ' ');
    return this.schools.run(actor, async (q) => {
      const year = (await q<{ id: number; label: string; status: string }>('SELECT id, label, status FROM app_school_years WHERE id = $1 AND school_id = $2', [body.year_id, schoolId]))[0];
      if (!year) throw new NotFoundException('Không tìm thấy năm học');
      if (year.status === 'ended') throw new ConflictException('Năm học đã kết thúc, không tạo thêm lớp được');
      await this.assertGradeOpen(q, schoolId, year.label, body.grade);
      const teachers = await this.validTeachers(q, schoolId, body.teacher_ids ?? []);
      const id = await this.insertClass(q, actor, { schoolId, year, grade: body.grade, name, expected_size: body.expected_size ?? null, description: body.description?.trim() || null });
      const cls=await this.load(q,actor,id);
      const semester=body.semester ?? (await q<{n:number}>('SELECT COALESCE(public.app_class_semester($1),1) AS n',[year.id]))[0].n;
      await this.setTeachers(q,actor,cls,teachers,semester,true);
      return this.view(q, id,semester);
    });
  }

  private async assertGradeOpen(q: Q, schoolId: number, yearLabel: string, grade: number): Promise<void> {
    const row = (await q<{ is_active: boolean }>('SELECT is_active FROM app_school_grades WHERE school_id = $1 AND school_year = $2 AND grade = $3', [schoolId, yearLabel, grade]))[0];
    if (!row?.is_active) throw new ConflictException(`Khối ${grade} chưa được bật trong năm học ${yearLabel}. Hãy thêm khối ở mục khối lớp.`);
  }

  private async insertClass(q: Q, actor: UserRow, c: { schoolId: number; year: { id: number; label: string }; grade: number; name: string; expected_size: number | null; description: string | null }): Promise<number> {
    const code = c.name.toUpperCase().replace(/\s+/g, '');
    if ((await q('SELECT 1 FROM app_classes WHERE school_id = $1 AND school_year = $2 AND class_code = $3', [c.schoolId, c.year.label, code])).length) throw new ConflictException(`Lớp ${c.name} đã có trong năm học ${c.year.label}`);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const joinCode = newJoinCode();
      if ((await q('SELECT 1 FROM app_classes WHERE join_code = $1', [joinCode])).length) continue;
      const row = (await q<{ id: number }>(
        `INSERT INTO app_classes (school_id, year_id, school_year, class_code, name, grade, status, is_active, join_open, join_code, expected_size, description, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, 'APPROVED', true, true, $7, $8, $9, $10) RETURNING id`,
        [c.schoolId, c.year.id, c.year.label, code, c.name, c.grade, joinCode, c.expected_size, c.description, actor.id]))[0];
      await this.log(q, { id: row.id, school_id: c.schoolId }, 'create', actor);
      return row.id;
    }
    throw new ConflictException('Không sinh được mã tham gia lớp duy nhất, thử lại');
  }

  /** Sửa lớp (HK.QT.037) và phân công giáo viên (HK.QT.022): `teacher_ids` thay toàn bộ danh sách giáo viên của lớp */
  async update(actor: UserRow, id: number, body: { name?: string; grade?: number; expected_size?: number | null; description?: string | null; join_open?: boolean; teacher_ids?: number[]; semester?: number; confirm_reassignment?: boolean }) {
    return this.schools.run(actor, async (q) => {
      const cls = await this.openClass(q, actor, id);
      const fields: Array<[string, unknown]> = [];
      if (body.name !== undefined) {
        const name = body.name.trim().replace(/\s+/g, ' ');
        const code = name.toUpperCase().replace(/\s+/g, '');
        if ((await q('SELECT 1 FROM app_classes WHERE school_id = $1 AND school_year = $2 AND class_code = $3 AND id <> $4', [cls.school_id, cls.school_year, code, id])).length) throw new ConflictException(`Lớp ${name} đã có trong năm học ${cls.school_year}`);
        fields.push(['name', name], ['class_code', code]);
      }
      if (body.grade !== undefined && body.grade !== cls.grade) {
        const members = (await q<{ n: number }>('SELECT count(*)::int AS n FROM app_class_members WHERE class_id = $1', [id]))[0].n;
        if (members) throw new ConflictException('Lớp đã có học sinh nên không đổi khối được');
        await this.assertGradeOpen(q, cls.school_id, cls.school_year, body.grade);
        fields.push(['grade', body.grade]);
      }
      if (body.expected_size !== undefined) fields.push(['expected_size', body.expected_size]);
      if (body.description !== undefined) fields.push(['description', body.description?.trim() || null]);
      if (body.join_open !== undefined) fields.push(['join_open', body.join_open]);
      if (fields.length) {
        await q(`UPDATE app_classes SET ${fields.map(([k], i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`, [id, ...fields.map(([, v]) => v)]);
        await this.log(q, cls, body.join_open !== undefined && fields.length === 1 ? (body.join_open ? 'join_open' : 'join_closed') : 'update', actor);
      }
      const semester=body.semester ?? (await q<{n:number}>('SELECT COALESCE(public.app_class_semester($1),1) AS n',[cls.year_id]))[0].n;
      if (body.teacher_ids !== undefined) await this.setTeachers(q, actor, cls, await this.validTeachers(q, cls.school_id, body.teacher_ids),semester,body.confirm_reassignment ?? false);
      return this.view(q, id,semester);
    });
  }

  private async setTeachers(q: Q, actor: UserRow, cls: ClassRow, wanted: number[],semester: number,confirmed: boolean,approvedRequest=false): Promise<void> {
    if (![1,2].includes(semester)) throw new UnprocessableEntityException('Học kỳ không hợp lệ');
    const current=await q<{teacher_id:number|null}>('SELECT teacher_id FROM app_class_term_teachers WHERE class_id=$1 AND semester=$2',[cls.id,semester]);
    const legacy=current.length ? [] : await q<{teacher_id:number}>('SELECT teacher_id FROM app_class_teachers WHERE class_id=$1',[cls.id]);
    const previous=current[0]?.teacher_id ?? (legacy.length===1 ? legacy[0].teacher_id : null), next=wanted[0] ?? null;
    if((previous!==null || legacy.length>1) && (previous!==next || legacy.length>1) && !approvedRequest){
      const year=(await q<{status:string;semester:number}>('SELECT status,COALESCE(public.app_class_semester(id),1) AS semester FROM app_school_years WHERE id=$1',[cls.year_id]))[0];
      if(year?.status==='active' && year.semester===semester) throw new ConflictException('Giáo viên phụ trách lớp cần gửi đề nghị thay đổi và được quản trị trường duyệt trong học kỳ này');
    }
    if (previous!==null && previous!==next && !confirmed) throw new ConflictException('Vui lòng xác nhận thay đổi giáo viên phụ trách lớp');
    await q('INSERT INTO app_class_term_teachers(class_id,school_id,semester,teacher_id,assigned_by) SELECT $1,$2,s.n,NULL,$3 FROM (VALUES(1),(2)) s(n) ON CONFLICT DO NOTHING',[cls.id,cls.school_id,actor.id]);
    if (previous===next && !legacy.length) return;
    await q('UPDATE app_class_term_teachers SET teacher_id=$3,assigned_by=$4,assigned_at=now() WHERE class_id=$1 AND semester=$2',[cls.id,semester,next,actor.id]);
    await this.log(q,cls,previous===null ? 'assign' : next===null ? 'unassign' : 'change_teacher',actor,{teacher_id:next,note:`Học kỳ ${semester}: ${previous ?? 'chưa phân công'} → ${next ?? 'chưa phân công'}`});
  }

  private async teacherRequestContext(q:Q,actor:UserRow,id:number){
    if(actor.role!=='teacher')throw new ForbiddenException('Chức năng này dành cho giáo viên phụ trách lớp');
    const cls=await this.openClass(q,actor,id);
    if(cls.school_id!==actor.school_id || !cls.is_active)throw new NotFoundException('Không tìm thấy lớp đang phụ trách');
    if(!(await q("SELECT 1 FROM app_school_years WHERE id=$1 AND status='active'",[cls.year_id])).length)throw new ConflictException('Chỉ gửi đề nghị trong năm học đang hoạt động');
    const semester=(await q<{n:number}>('SELECT COALESCE(public.app_class_semester($1),1) AS n',[cls.year_id]))[0].n;
    if(!(await q('SELECT 1 FROM app_current_class_teachers WHERE class_id=$1 AND teacher_id=$2',[id,actor.id])).length)throw new ForbiddenException('Bạn không phụ trách lớp trong học kỳ hiện tại');
    return {cls,semester};
  }

  async teacherChangeOptions(actor:UserRow,id:number){
    return this.schools.run(actor,async q=>{
      const {cls,semester}=await this.teacherRequestContext(q,actor,id);
      const candidates=await q("SELECT id,full_name,user_code FROM app_users WHERE school_id=$1 AND role='teacher' AND is_active=1 AND deleted_at IS NULL AND id<>$2 ORDER BY full_name,id",[cls.school_id,actor.id]);
      const requests=await this.requestRows(q,'r.class_id=$1',[id]);
      return {semester,class_name:cls.name,teacher_name:actor.full_name,candidates,requests};
    });
  }

  async requestTeacherChange(actor:UserRow,id:number,teacherId:unknown,note:unknown){
    if(!Number.isInteger(teacherId) || Number(teacherId)<1 || teacherId===actor.id)throw new UnprocessableEntityException('Hãy chọn giáo viên khác tiếp nhận lớp');
    const text=note==null ? null : String(note).trim() || null;
    if(text && text.length>1000)throw new UnprocessableEntityException('Nội dung đề nghị tối đa 1000 ký tự');
    return this.schools.run(actor,async q=>{
      const {cls,semester}=await this.teacherRequestContext(q,actor,id);
      await this.validTeachers(q,cls.school_id,[Number(teacherId)]);
      if((await q("SELECT 1 FROM app_class_teacher_change_requests WHERE class_id=$1 AND semester=$2 AND status='pending'",[id,semester])).length)throw new ConflictException('Lớp đã có đề nghị đổi giáo viên đang chờ duyệt trong học kỳ này');
      const row=(await q<{id:string}>(`INSERT INTO app_class_teacher_change_requests(class_id,school_id,semester,from_teacher_id,to_teacher_id,requested_by,note) VALUES($1,$2,$3,$4,$5,$4,$6) RETURNING id`,[id,cls.school_id,semester,actor.id,teacherId,text]))[0];
      const admins=await q<{id:number}>("SELECT id FROM app_users WHERE school_id=$1 AND role='school_admin' AND is_active=1 AND deleted_at IS NULL",[cls.school_id]);
      await notify(q,admins.map(a=>a.id),{kind:'teacher_change',title:'Đề nghị đổi giáo viên phụ trách lớp',body:`${actor.full_name} gửi đề nghị cho lớp ${cls.name}, Học kỳ ${semester}.`,class_id:id,school_id:cls.school_id,by:actor.id,ref:{request_id:row.id}});
      return (await this.requestRows(q,'r.id=$1',[row.id]))[0];
    });
  }

  private requestRows(q:Q,where:string,params:unknown[]){
    return q<Record<string,any>>(`SELECT r.*,c.name AS class_name,c.registration_code,f.full_name AS from_teacher_name,t.full_name AS to_teacher_name,a.full_name AS reviewer_name
      FROM app_class_teacher_change_requests r JOIN app_classes c ON c.id=r.class_id LEFT JOIN app_users f ON f.id=r.from_teacher_id LEFT JOIN app_users t ON t.id=r.to_teacher_id LEFT JOIN app_users a ON a.id=r.reviewed_by
      WHERE ${where} ORDER BY r.requested_at DESC,r.id DESC LIMIT 200`,params);
  }

  async teacherChangeRequests(actor:UserRow){
    if(!['school_admin','root_admin'].includes(actor.role))throw new ForbiddenException('Chức năng này dành cho quản trị trường');
    return this.schools.run(actor,q=>this.requestRows(q,"r.status='pending'",[]));
  }

  async decideTeacherChange(actor:UserRow,requestId:number,decision:'approved'|'rejected',reviewNote?:string){
    if(!['school_admin','root_admin'].includes(actor.role))throw new ForbiddenException('Chức năng này dành cho quản trị trường');
    return this.schools.run(actor,async q=>{
      const found=(await q<{class_id:number}>('SELECT class_id FROM app_class_teacher_change_requests WHERE id=$1',[requestId]))[0];
      if(!found)throw new NotFoundException('Không tìm thấy đề nghị');
      const cls=await this.load(q,actor,found.class_id,true);
      const request=(await q<Record<string,any>>('SELECT * FROM app_class_teacher_change_requests WHERE id=$1 FOR UPDATE',[requestId]))[0];
      if(request.status!=='pending')throw new ConflictException('Đề nghị đã được xử lý');
      if(decision==='approved'){
        await this.schools.assertYearOpen(q,cls.year_id);
        const semester=(await q<{n:number}>('SELECT COALESCE(public.app_class_semester($1),1) AS n',[cls.year_id]))[0].n;
        if(!cls.is_active || semester!==request.semester || !(await q("SELECT 1 FROM app_school_years WHERE id=$1 AND status='active'",[cls.year_id])).length || !(await q('SELECT 1 FROM app_current_class_teachers WHERE class_id=$1 AND teacher_id=$2',[cls.id,request.from_teacher_id])).length)throw new ConflictException('Phân công đã thay đổi hoặc học kỳ không còn phù hợp; hãy gửi đề nghị mới');
        const teachers=await this.validTeachers(q,cls.school_id,[request.to_teacher_id]);
        await this.setTeachers(q,actor,cls,teachers,request.semester,true,true);
      }
      await q('UPDATE app_class_teacher_change_requests SET status=$2,reviewed_by=$3,reviewed_at=now(),review_note=$4 WHERE id=$1',[requestId,decision,actor.id,reviewNote?.trim()||null]);
      await this.log(q,cls,'teachers',actor,{teacher_id:request.to_teacher_id,note:`${decision==='approved'?'Đã duyệt':'Từ chối'} đề nghị #${requestId} · Học kỳ ${request.semester}`});
      await notify(q,[request.from_teacher_id,request.to_teacher_id].filter((id):id is number=>typeof id==='number'),{kind:'teacher_change',title:decision==='approved'?'Đã duyệt thay đổi giáo viên':'Đề nghị đổi giáo viên chưa được duyệt',body:`Lớp ${cls.name} · Học kỳ ${request.semester}.`,class_id:cls.id,school_id:cls.school_id,by:actor.id,ref:{request_id:requestId}});
      return (await this.requestRows(q,'r.id=$1',[requestId]))[0];
    });
  }

  async cancelTeacherChange(actor:UserRow,requestId:number){
    if(actor.role!=='teacher')throw new ForbiddenException('Chức năng này dành cho giáo viên');
    return this.schools.run(actor,async q=>{
      const found=(await q<{class_id:number}>('SELECT class_id FROM app_class_teacher_change_requests WHERE id=$1 AND requested_by=$2',[requestId,actor.id]))[0];
      if(!found)throw new NotFoundException('Không tìm thấy đề nghị');
      await this.load(q,actor,found.class_id,true);
      const row=await q("UPDATE app_class_teacher_change_requests SET status='cancelled',reviewed_at=now() WHERE id=$1 AND requested_by=$2 AND status='pending' RETURNING id",[requestId,actor.id]);
      if(!row.length)throw new ConflictException('Đề nghị đã được xử lý');
      return {ok:true};
    });
  }

  /** Lưu trữ / khôi phục lớp (HK.QT.038): lớp lưu trữ không nhận học sinh mới và mã tham gia ngừng dùng được */
  async archive(actor: UserRow, id: number, archived: boolean) {
    return this.schools.run(actor, async (q) => {
      const cls = await this.openClass(q, actor, id);
      if (cls.is_active === !archived) return this.view(q, id);
      await q('UPDATE app_classes SET is_active = $2, closed_at = CASE WHEN $2 THEN NULL ELSE now() END WHERE id = $1', [id, !archived]);
      await this.log(q, cls, archived ? 'close' : 'reopen', actor);
      return this.view(q, id);
    });
  }

  /** Xóa lớp chưa có học sinh (HK.QT.038); lớp đã có học sinh chỉ được lưu trữ */
  async remove(actor: UserRow, id: number): Promise<void> {
    await this.schools.run(actor, async (q) => {
      const cls = await this.openClass(q, actor, id);
      const members = (await q<{ n: number }>('SELECT count(*)::int AS n FROM app_class_members WHERE class_id = $1', [id]))[0].n;
      if (members) throw new ConflictException(`Lớp đã có ${members} học sinh nên chỉ lưu trữ được, không xóa.`);
      await q('DELETE FROM app_classes WHERE id = $1', [cls.id]);
    });
  }

  /** Đổi mã tham gia lớp (làm mới mã 6 ký tự; mã cũ hết dùng được) */
  async regenerateCode(actor: UserRow, id: number) {
    return this.schools.run(actor, async (q) => {
      const cls = await this.openClass(q, actor, id);
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const code = newJoinCode();
        if ((await q('SELECT 1 FROM app_classes WHERE join_code = $1', [code])).length) continue;
        await q('UPDATE app_classes SET join_code = $2 WHERE id = $1', [id, code]);
        await this.log(q, cls, 'code', actor);
        return this.view(q, id);
      }
      throw new ConflictException('Không sinh được mã tham gia lớp duy nhất, thử lại');
    });
  }

  // ------------------------------------------------------------------ học sinh trong lớp
  private async studentsOf(q: Q, schoolId: number, ids: number[]): Promise<Array<{ id: number; full_name: string }>> {
    const unique = [...new Set(ids)];
    const rows = await q<{ id: number; full_name: string }>("SELECT id, full_name FROM app_users WHERE id = ANY($1) AND school_id = $2 AND role = 'student' AND is_active = 1 AND deleted_at IS NULL", [unique, schoolId]);
    if (rows.length !== unique.length) throw new UnprocessableEntityException('Có học sinh không thuộc trường hoặc đang bị khóa');
    return rows;
  }

  private async addStudent(q: Q, actor: UserRow | null, cls: ClassRow, studentId: number, kind = 'member_add'): Promise<boolean> {
    const done = await q('INSERT INTO app_class_members (class_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING user_id', [cls.id, studentId]);
    if (!done.length) return false;
    await q('UPDATE app_users SET grade = COALESCE($2, grade), school_year = $3 WHERE id = $1', [studentId, cls.grade, cls.school_year]);
    await this.log(q, cls, kind, actor, { user_id: studentId });
    return true;
  }

  /** Xếp nhiều học sinh vào lớp (HK.QT.039); học sinh đã ở trong lớp được bỏ qua */
  async addMembers(actor: UserRow, id: number, studentIds: number[]) {
    return this.schools.run(actor, async (q) => {
      const cls = await this.openClass(q, actor, id);
      if (!cls.is_active) throw new ConflictException('Lớp đã được lưu trữ');
      const students = await this.studentsOf(q, cls.school_id, studentIds);
      let added = 0;
      for (const s of students) if (await this.addStudent(q, actor, cls, s.id)) added += 1;
      return { added, skipped: students.length - added, class: await this.view(q, id) };
    });
  }

  async removeMember(actor: UserRow, id: number, studentId: number): Promise<void> {
    await this.schools.run(actor, async (q) => {
      const cls = await this.openClass(q, actor, id);
      const done = await q('DELETE FROM app_class_members WHERE class_id = $1 AND user_id = $2 RETURNING user_id', [id, studentId]);
      if (!done.length) throw new NotFoundException('Học sinh không ở trong lớp này');
      await this.log(q, cls, 'member_remove', actor, { user_id: studentId });
    });
  }

  /** Chuyển lớp (HK.QT.029): sang lớp khác cùng khối và cùng năm học; dữ liệu học của học sinh giữ nguyên */
  async transfer(actor: UserRow, studentId: number, fromId: number, toId: number) {
    if (fromId === toId) throw new BadRequestException('Lớp đích phải khác lớp hiện tại');
    return this.schools.run(actor, async (q) => {
      const from = await this.openClass(q, actor, fromId), to = await this.openClass(q, actor, toId);
      if (from.school_id !== to.school_id) throw new ForbiddenException('Chỉ chuyển trong cùng trường');
      if (from.year_id !== to.year_id) throw new ConflictException('Chỉ chuyển giữa các lớp cùng năm học; dùng nhân bản lớp để lên lớp.');
      if (from.grade !== to.grade) throw new ConflictException('Chỉ chuyển sang lớp cùng khối');
      if (!to.is_active) throw new ConflictException('Lớp đích đã được lưu trữ');
      if (!(await q('SELECT 1 FROM app_class_members WHERE class_id = $1 AND user_id = $2', [fromId, studentId])).length) throw new NotFoundException('Học sinh không ở trong lớp hiện tại');
      await q('DELETE FROM app_class_members WHERE class_id = $1 AND user_id = $2', [fromId, studentId]);
      const already = !(await this.addStudent(q, actor, to, studentId, 'transfer'));
      await this.log(q, from, 'transfer', actor, { user_id: studentId, related_class_id: toId });
      return { moved: !already, from: await this.view(q, fromId), to: await this.view(q, toId) };
    });
  }

  /** Thông tin file mẫu xếp lớp của trường và năm học (mặc định năm học đang hoạt động): tên file, tên/mã trường, các lớp đang hoạt động */
  async assignSpec(actor: UserRow, schoolId?: number | null, yearId?: number | null) {
    const id = this.schools.target(actor, schoolId);
    return this.schools.run(actor, async (q) => {
      const school = (await q<{ name: string; school_code: string }>('SELECT name, school_code FROM app_schools WHERE id = $1', [id]))[0];
      if (!school) throw new NotFoundException('Không tìm thấy trường');
      const year = (await q<{ id: number; label: string; status: string }>(
        "SELECT id, label, status FROM app_school_years WHERE school_id = $1 AND ($2::int IS NULL OR id = $2) ORDER BY (status = 'active') DESC, label DESC LIMIT 1", [id, yearId ?? null]))[0];
      if (!year) throw new NotFoundException('Không tìm thấy năm học');
      const classes = (await q<{ name: string }>('SELECT name FROM app_classes WHERE school_id = $1 AND year_id = $2 AND is_active ORDER BY grade, name', [id, year.id])).map((c) => c.name);
      const semester = Number((await q<{ n: number }>('SELECT COALESCE(public.app_class_semester($1),1) AS n', [year.id]))[0]?.n ?? 1);
      return { filename: classTemplateFilename(school.name, year.label), school_name: school.name, school_code: school.school_code, year_id: year.id, year_label: year.label, year_status: year.status, semester, classes };
    });
  }

  /**
   * Xếp lớp từ file Excel (HK.QT.039), mỗi lớp một file (yêu cầu 12/11/2026): ô Lớp, Học kỳ, Giáo viên phụ trách ở đầu file; mỗi dòng một học sinh.
   * Chỉ nhận đúng file mẫu của trường và năm học (tên file bắt đầu bằng tên file mẫu, được thêm tên lớp ở cuối; dòng nhận diện A2).
   * Học sinh nhận ra bằng mã học sinh, để trống mã thì bằng họ tên + ngày sinh; trùng cả họ tên lẫn ngày sinh thì phải điền mã.
   * Lớp chưa có trong năm học thì tạo khi lưu (khối lấy từ số đầu của tên lớp); giáo viên phụ trách được phân công cho học kỳ đã chọn nếu lớp chưa có ai;
   * sau khi lưu, sĩ số dự kiến của lớp bằng số học sinh thực có. File cũ ghi lớp ở từng dòng vẫn nhận.
   */
  async importAssignments(actor: UserRow, file: UploadedXlsx | undefined, opts: { commit: boolean; school_id?: number | null; year_id: number }) {
    const upload = checkUpload(file);
    const schoolId = this.schools.target(actor, opts.school_id);
    const spec = await this.assignSpec(actor, schoolId, opts.year_id);
    if (spec.year_id !== opts.year_id) throw new NotFoundException('Không tìm thấy năm học');
    const base = spec.filename.replace(/\.xlsx$/, '');
    if (!(upload.originalname === spec.filename || (upload.originalname.startsWith(base) && /^[ _.()-]/.test(upload.originalname.slice(base.length)) && upload.originalname.endsWith('.xlsx')))) {
      throw new BadRequestException(`Sai tên file. Tên file phải bắt đầu bằng ${base} (có thể thêm tên lớp ở cuối, ví dụ ${base}_6A1.xlsx).`);
    }
    // ô Lớp / Học kỳ / Giáo viên phụ trách ở đầu file (nhãn ở cột B kết thúc bằng dấu hai chấm, giá trị ở cột C)
    const header: { lop?: string; 'hoc ky'?: string; 'giao vien phu trach'?: string } = {};
    const parsed = await readSheet(upload, ASSIGN_COLUMNS, undefined, false, (sheet) => {
      checkAssignFile(cellText(sheet.getCell('A2').value), spec);
      for (let r = 1; r <= 20; r += 1) {
        const text = cellText(sheet.getCell(r, 2).value);
        const key = normHeader(text) as keyof typeof header;
        if (text.endsWith(':') && (key === 'lop' || key === 'hoc ky' || key === 'giao vien phu trach')) header[key] = cellText(sheet.getCell(r, 3).value);
      }
    });
    if (!parsed.length) throw new BadRequestException('File không có dòng dữ liệu nào');
    const headerClass = tidyClassName(header.lop ?? '');
    const semesterText = (header['hoc ky'] ?? '').trim();
    if (semesterText && !['1', '2'].includes(semesterText)) throw new BadRequestException('Ô Học kỳ chỉ nhận 1 hoặc 2 (một năm học có hai học kỳ)');
    const semester = semesterText ? Number(semesterText) : spec.semester;
    const teacherText = (header['giao vien phu trach'] ?? '').trim();
    return this.schools.run(actor, async (q) => {
      if (opts.commit) await q('SELECT pg_advisory_xact_lock(7412026)');
      const year = (await q<{ id: number; label: string; status: string }>('SELECT id, label, status FROM app_school_years WHERE id = $1 AND school_id = $2', [opts.year_id, schoolId]))[0];
      if (!year) throw new NotFoundException('Không tìm thấy năm học');
      if (year.status === 'ended') throw new ConflictException('Năm học đã kết thúc, không xếp lớp được');
      let teacher: { id: number; full_name: string; user_code: string | null } | null = null;
      if (teacherText) {
        const code = teacherText.split('·')[0].trim();
        const found = await q<{ id: number; full_name: string; user_code: string | null }>(
          "SELECT id, full_name, user_code FROM app_users WHERE school_id = $1 AND role = 'teacher' AND deleted_at IS NULL AND is_active = 1 AND (lower(user_code) = lower($2) OR lower(full_name) = lower($3)) ORDER BY (lower(user_code) = lower($2)) DESC, id", [schoolId, code, teacherText]);
        if (found.length !== 1 && !(found.length > 1 && found[0].user_code?.toLowerCase() === code.toLowerCase())) throw new BadRequestException(`Không có giáo viên "${teacherText}" trong trường (hoặc đang bị khóa). Hãy chọn giáo viên trong danh sách của file mẫu.`);
        teacher = found[0];
      }
      // lớp theo tên: có sẵn (đang hoạt động), sẽ tạo mới, hoặc lỗi (khối không hợp lệ, lớp đã lưu trữ)
      const plans = new Map<string, { name: string; cls: ClassRow | null; grade: number | null; error: string | null }>();
      // chỉ lớp gõ ở ô Lớp đầu file mới được tạo; file cũ ghi lớp ở từng dòng thì lớp phải có sẵn (tránh tạo lớp do gõ nhầm)
      const planFor = async (raw: string, allowCreate: boolean) => {
        const name = tidyClassName(raw), key = name.toLocaleLowerCase('vi');
        if (plans.has(key)) return plans.get(key)!;
        const same = (await q<ClassRow>('SELECT * FROM app_classes WHERE school_id = $1 AND year_id = $2 AND class_code = $3', [schoolId, opts.year_id, name.toUpperCase().replace(/\s+/g, '')]))[0];
        let plan: { name: string; cls: ClassRow | null; grade: number | null; error: string | null };
        if (same?.is_active) plan = { name: same.name, cls: same, grade: same.grade, error: null };
        else if (same) plan = { name: same.name, cls: null, grade: null, error: `Lớp ${same.name} đã được lưu trữ; hãy khôi phục lớp ở trang Lớp học trước khi xếp` };
        else if (!allowCreate) plan = { name, cls: null, grade: null, error: `Không có lớp "${name}" đang hoạt động trong năm học đã chọn` };
        else {
          const grade = /^([6-9])(?!\d)/.exec(name)?.[1];
          const open = grade ? (await q<{ is_active: boolean }>('SELECT is_active FROM app_school_grades WHERE school_id = $1 AND school_year = $2 AND grade = $3', [schoolId, year.label, Number(grade)]))[0]?.is_active : false;
          plan = !grade ? { name, cls: null, grade: null, error: `Tên lớp "${name}" phải bắt đầu bằng khối 6–9, ví dụ 6A1` }
            : !open ? { name, cls: null, grade: Number(grade), error: `Khối ${grade} chưa được bật trong năm học ${year.label}` }
            : { name, cls: null, grade: Number(grade), error: null };
        }
        plans.set(key, plan);
        return plan;
      };
      const rows: Array<{ row: number; user_code: string; full_name: string; class_name: string; status: 'ok' | 'error' | 'added' | 'exists'; errors: string[] }> = [];
      const valid: Array<{ result: (typeof rows)[number]; plan: Awaited<ReturnType<typeof planFor>>; studentId: number }> = [];
      for (const { row, values } of parsed) {
        const errors: string[] = [];
        const code = values.user_code.trim(), name = values.full_name.trim(), born = values.birth_date.trim(), rowClass = values.class_name.trim();
        const className = rowClass || headerClass, fromHeader = !!headerClass && (!rowClass || tidyClassName(rowClass).toLocaleLowerCase('vi') === headerClass.toLocaleLowerCase('vi'));
        let student: { id: number; user_code: string | null; full_name: string } | null = null;
        if (code) {
          student = (await q<{ id: number; user_code: string | null; full_name: string }>("SELECT id, user_code, full_name FROM app_users WHERE school_id = $1 AND role = 'student' AND lower(user_code) = lower($2) AND deleted_at IS NULL AND is_active = 1", [schoolId, code]))[0] ?? null;
          if (!student) errors.push(`Không có học sinh mã ${code} (hoặc đang bị khóa)`);
        } else if (name && born) {
          const iso = parseDate(born);
          if (!iso) errors.push('Ngày sinh sai định dạng (dd/mm/yyyy)');
          else {
            const same = (await q<{ id: number; user_code: string | null; full_name: string }>("SELECT id, user_code, full_name FROM app_users WHERE school_id = $1 AND role = 'student' AND birth_date = $2 AND deleted_at IS NULL AND is_active = 1", [schoolId, iso]))
              .filter((u) => plainName(u.full_name) === plainName(name));
            if (same.length === 1) student = same[0];
            else if (!same.length) errors.push(`Không có học sinh ${name} sinh ngày ${ddmmyyyy(iso)} (hoặc đang bị khóa)`);
            else errors.push(`Có ${same.length} học sinh cùng họ tên và ngày sinh; hãy điền mã học sinh`);
          }
        } else errors.push(name ? 'Thiếu ngày sinh (hoặc mã học sinh) để nhận ra học sinh' : 'Thiếu mã học sinh (hoặc họ tên và ngày sinh)');
        const plan = className ? await planFor(className, fromHeader) : null;
        if (!plan) errors.push('Thiếu tên lớp: gõ tên lớp ở ô Lớp đầu file');
        else if (plan.error) errors.push(plan.error);
        const result = { row, user_code: student?.user_code ?? code, full_name: student?.full_name ?? name, class_name: plan?.name ?? className, status: (errors.length ? 'error' : 'ok') as 'ok' | 'error' | 'added' | 'exists', errors };
        if (!errors.length && student && plan) valid.push({ result, plan, studentId: student.id });
        rows.push(result);
      }
      // lớp sẽ tạo, giáo viên phụ trách học kỳ, sĩ số
      const notes: string[] = [];
      const used = [...new Set(valid.map((v) => v.plan))];
      const classes: Array<{ name: string; created: boolean; students: number }> = [];
      for (const plan of used) {
        const count = valid.filter((v) => v.plan === plan).length;
        if (!plan.cls) notes.push(`Lớp ${plan.name} (khối ${plan.grade}) chưa có trong năm học ${year.label}: ${opts.commit ? 'đã tạo' : 'sẽ được tạo khi lưu'}.`);
        let current: number | null = null;
        if (plan.cls) current = (await q<{ teacher_id: number | null }>('SELECT teacher_id FROM app_class_term_teachers WHERE class_id = $1 AND semester = $2', [plan.cls.id, semester]))[0]?.teacher_id
          ?? (await q<{ teacher_id: number }>('SELECT teacher_id FROM app_class_teachers WHERE class_id = $1 LIMIT 1', [plan.cls.id]))[0]?.teacher_id ?? null;
        if (teacher) {
          if (current && current !== teacher.id) notes.push(`Lớp ${plan.name} đã có giáo viên phụ trách học kỳ ${semester} nên giữ nguyên; muốn đổi hãy dùng trang Lớp học.`);
          else if (current !== teacher.id) notes.push(`Giáo viên phụ trách lớp ${plan.name} học kỳ ${semester}: ${teacher.user_code ?? ''} · ${teacher.full_name}.`);
        }
        if (!opts.commit) { classes.push({ name: plan.name, created: !plan.cls, students: count }); continue; }
        const created = !plan.cls;
        if (!plan.cls) plan.cls = await this.load(q, actor, await this.insertClass(q, actor, { schoolId, year, grade: plan.grade!, name: plan.name, expected_size: null, description: null }));
        if (teacher && (created || !current)) await this.setTeachers(q, actor, plan.cls, [teacher.id], semester, true);
        else if (created) await this.setTeachers(q, actor, plan.cls, [], semester, true);
        for (const v of valid.filter((x) => x.plan === plan)) v.result.status = (await this.addStudent(q, actor, plan.cls, v.studentId)) ? 'added' : 'exists';
        const size = (await q<{ n: number }>("SELECT count(*)::int AS n FROM app_class_members m JOIN app_users u ON u.id = m.user_id WHERE m.class_id = $1 AND u.role = 'student' AND u.deleted_at IS NULL", [plan.cls.id]))[0].n;
        await q('UPDATE app_classes SET expected_size = $2 WHERE id = $1', [plan.cls.id, size]);
        classes.push({ name: plan.name, created, students: size });
      }
      const bad = rows.filter((r) => r.status === 'error').length;
      return { committed: opts.commit, total: rows.length, valid: rows.length - bad, errors: bad, added: rows.filter((r) => r.status === 'added').length, semester, teacher: teacher ? `${teacher.user_code ?? ''} · ${teacher.full_name}` : null, classes, notes, rows };
    });
  }

  /**
   * Nhân bản lớp sang năm học mới / lên lớp (HK.QT.040). Với mỗi lớp nguồn tạo một lớp ở năm đích (khối + 1 nếu `promote`, lớp khối 9 không lên lớp),
   * xếp các học sinh được chọn (mặc định mọi học sinh đang hoạt động của lớp) và chép giáo viên phụ trách nếu muốn. Lớp trùng tên hoặc khối chưa bật bị bỏ qua và nêu lý do.
   */
  async clone(actor: UserRow, body: { school_id?: number | null; from_year_id: number; to_year_id: number; class_ids?: number[]; promote?: boolean; copy_teachers?: boolean; student_ids?: number[] }) {
    const schoolId = this.schools.target(actor, body.school_id);
    if (body.from_year_id === body.to_year_id) throw new BadRequestException('Năm học đích phải khác năm học nguồn');
    const promote = body.promote ?? true, copyTeachers = body.copy_teachers ?? true;
    return this.schools.run(actor, async (q) => {
      const years = await q<{ id: number; label: string; status: string }>('SELECT id, label, status FROM app_school_years WHERE school_id = $1 AND id = ANY($2)', [schoolId, [body.from_year_id, body.to_year_id]]);
      const from = years.find((y) => y.id === body.from_year_id), to = years.find((y) => y.id === body.to_year_id);
      if (!from || !to) throw new NotFoundException('Không tìm thấy năm học');
      if (to.status === 'ended') throw new ConflictException('Năm học đích đã kết thúc');
      if (to.label <= from.label) throw new ConflictException('Năm học đích phải sau năm học nguồn');
      const sources = await q<ClassRow>('SELECT * FROM app_classes WHERE school_id = $1 AND year_id = $2 AND is_active AND ($3::int[] IS NULL OR id = ANY($3)) ORDER BY grade, name', [schoolId, from.id, body.class_ids ?? null]);
      const created: Array<{ id: number; name: string; grade: number; students: number; from_class: string }> = [];
      const skipped: Array<{ class: string; reason: string }> = [];
      const selected = body.student_ids ? new Set(body.student_ids) : null;
      for (const src of sources) {
        const grade = (src.grade ?? 0) + (promote ? 1 : 0);
        if (!src.grade) { skipped.push({ class: src.name, reason: 'Lớp chưa có khối' }); continue; }
        if (grade > 9) { skipped.push({ class: src.name, reason: 'Khối 9 đã hoàn thành chương trình, không lên lớp' }); continue; }
        const gradeRow = (await q<{ is_active: boolean }>('SELECT is_active FROM app_school_grades WHERE school_id = $1 AND school_year = $2 AND grade = $3', [schoolId, to.label, grade]))[0];
        if (!gradeRow?.is_active) { skipped.push({ class: src.name, reason: `Khối ${grade} chưa được bật trong năm học ${to.label}` }); continue; }
        const name = promote && src.name.startsWith(String(src.grade)) ? `${grade}${src.name.slice(String(src.grade).length)}` : src.name;
        if ((await q('SELECT 1 FROM app_classes WHERE school_id = $1 AND school_year = $2 AND class_code = $3', [schoolId, to.label, name.toUpperCase().replace(/\s+/g, '')])).length) { skipped.push({ class: src.name, reason: `Lớp ${name} đã có trong năm học ${to.label}` }); continue; }
        const id = await this.insertClass(q, actor, { schoolId, year: to, grade, name, expected_size: src.expected_size, description: src.description });
        const cls = await this.load(q, actor, id);
        const members = await q<{ id: number }>(
          "SELECT u.id FROM app_class_members m JOIN app_users u ON u.id = m.user_id WHERE m.class_id = $1 AND u.role = 'student' AND u.is_active = 1 AND u.deleted_at IS NULL ORDER BY u.full_name", [src.id]);
        let students = 0;
        for (const m of members) if (!selected || selected.has(m.id)) if (await this.addStudent(q, actor, cls, m.id)) students += 1;
        if (copyTeachers) {
          for (const semester of [1,2]) {
            const teachers = await q<{ teacher_id: number }>(`SELECT t.teacher_id FROM app_class_teacher_assignments t JOIN app_users u ON u.id=t.teacher_id WHERE t.class_id=$1 AND t.semester=$2 AND u.is_active=1 AND u.deleted_at IS NULL`,[src.id,semester]);
            await this.setTeachers(q,actor,cls,teachers.length===1 ? [teachers[0].teacher_id] : [],semester,true);
          }
        } else {
          await this.setTeachers(q,actor,cls,[],1,true);
        }
        await this.log(q, cls, 'clone', actor, { related_class_id: src.id, note: `Nhân bản từ lớp ${src.name} (${from.label})` });
        created.push({ id, name, grade, students, from_class: src.name });
      }
      return { from_year: from.label, to_year: to.label, created, skipped };
    });
  }

  // ------------------------------------------------------------------ học sinh tham gia lớp bằng mã (HK.HS.008)
  async joinByCode(student: UserRow, rawCode: string) {
    const code = normJoinCode(rawCode);
    if (code.length !== 6) throw new UnprocessableEntityException('Mã lớp gồm 6 ký tự');
    if (!student.school_id) throw new ForbiddenException('Tài khoản tự học không thuộc trường nên chưa tham gia lớp được. Hãy nhờ giáo viên hoặc nhà trường cấp tài khoản.');
    const result = await this.schools.run(student, async (q) => {
      // Học sinh chỉ thấy lớp của trường mình (Row-Level Security); mã của trường khác trả về "không đúng" như mã sai, không lộ lớp nào có thật
      const cls = (await q<ClassRow & { year_status: string | null }>(
        `SELECT c.*, y.status AS year_status FROM app_classes c LEFT JOIN app_school_years y ON y.id = c.year_id WHERE c.join_code = $1 AND c.school_id = $2`, [code, student.school_id]))[0];
      if (!cls) throw new NotFoundException('Mã lớp không đúng hoặc lớp không thuộc trường của bạn');
      if (!cls.is_active || cls.status !== 'APPROVED') throw new ConflictException('Lớp này đã được lưu trữ');
      if (cls.year_status === 'ended') throw new ConflictException('Năm học của lớp đã kết thúc');
      if (!cls.join_open) throw new ForbiddenException('Giáo viên đã tắt cho phép học sinh tự tham gia lớp này');
      if (!(await this.addStudent(q, null, cls, student.id, 'join'))) throw new ConflictException('Bạn đã ở trong lớp này');
      return this.view(q, cls.id);
    });
    return result;
  }

  async mine(student: UserRow) {
    return this.db.query(
      `SELECT c.id, c.name, c.grade, c.school_year, c.is_active,
              COALESCE((SELECT json_agg(u.full_name ORDER BY u.full_name) FROM app_class_teachers t JOIN app_users u ON u.id = t.teacher_id WHERE t.class_id = c.id), '[]'::json) AS teachers,
              (SELECT count(*)::int FROM app_class_members m2 WHERE m2.class_id = c.id) AS members
       FROM app_class_members m JOIN app_classes c ON c.id = m.class_id WHERE m.user_id = $1 ORDER BY c.school_year DESC, c.name`, [student.id]);
  }

  /**
   * File mẫu xếp lớp, mỗi lớp một file (yêu cầu 12/11/2026), trình bày như danh sách lớp in của nhà trường (xem `buildClassListSheet`):
   * ô Lớp gõ ở đầu file (gợi ý lớp đã có, gõ lớp mới được), Học kỳ 1/2, Giáo viên phụ trách chọn theo mã · họ tên; Sĩ số và Nam/Nữ tự đếm.
   */
  async template(actor: UserRow, schoolId?: number | null, yearId?: number | null, now: Date = new Date()): Promise<{ buffer: Buffer; filename: string }> {
    const spec = await this.assignSpec(actor, schoolId, yearId);
    const id = this.schools.target(actor, schoolId);
    const extra = await this.schools.run(actor, async (q) => ({
      region: (await q<{ region: string | null }>('SELECT region FROM app_schools WHERE id = $1', [id]))[0]?.region ?? null,
      teachers: (await q<{ user_code: string | null; full_name: string }>("SELECT user_code, full_name FROM app_users WHERE school_id = $1 AND role = 'teacher' AND deleted_at IS NULL AND is_active = 1 ORDER BY full_name, id", [id]))
        .map((t) => `${t.user_code ?? 'Chưa có mã'} · ${t.full_name}`),
    }));
    const buffer = await buildClassListSheet({
      identity: assignSubtitle(spec.year_label, spec.school_name, spec.school_code), school: spec.school_name, schoolCode: spec.school_code, region: extra.region,
      yearLabel: spec.year_label, semester: spec.semester, teachers: extra.teachers, classes: spec.classes, now,
      guide: [
        `Mỗi lớp một file: gõ tên lớp ở ô Lớp (ví dụ 6A1), chọn học kỳ (một năm học có học kỳ 1 và học kỳ 2) và giáo viên phụ trách (mã giáo viên · họ tên).`,
        'Mỗi học sinh một dòng: điền mã học sinh, hoặc họ tên và ngày sinh (dd/mm/yyyy) đúng như hồ sơ; trùng cả họ tên lẫn ngày sinh thì phải điền mã. Giới tính để đối chiếu.',
        `Cột LỚP và Sĩ số tự hiện. Lớp chưa có trong năm học ${spec.year_label} sẽ được tạo khi nhập (khối lấy từ số đầu của tên lớp); sau khi nhập, sĩ số lớp bằng số học sinh thực có.`,
        'Học sinh vào học muộn trong học kỳ: thêm trên web ở trang Lớp học (Tạo học sinh mới vào lớp), không cần nhập lại file.',
        `Giữ nguyên tên file ${spec.filename}; có thể thêm tên lớp ở cuối, ví dụ ${spec.filename.replace(/\.xlsx$/, '')}_6A1.xlsx. Chỉ nhập cho ${spec.school_name}, năm học ${spec.year_label}.`,
      ],
    });
    return { buffer, filename: spec.filename };
  }
}

