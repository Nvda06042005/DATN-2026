/**
 * Tài khoản (HK.AD.018–025, HK.QT.014–034): quản trị tổng quản lý người dùng toàn hệ thống; quản trị trường quản lý giáo viên và học sinh của trường mình.
 * Mọi thao tác chạy trong giao dịch có khóa, kiểm tra lại quyền của người thao tác; mật khẩu tạm chỉ trả về một lần và gửi qua hàng đợi email.
 * Quản trị tổng được xóa từng tài khoản đã dùng; quản trị trường chỉ xóa tài khoản chưa phát sinh dữ liệu. Nhập Excel có xem trước báo lỗi từng dòng.
 */
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { toPublic } from '../auth/auth.service';
import { generatePassword, hashPassword, openPassword, sealPassword } from '../auth/passwords';
import { config } from '../config';
import { DatabaseService, DuplicateUsername, Q, Role, searchText, toUser, USER_COLUMNS, UserRow } from '../database/database.service';
import { buildFormSheet, cellText, checkUpload, Column, FormColumn, givenNameUpper, memberCode, memberCredentials, normHeader, parseDate, readSheet, schoolInitials, shownUsername, studentTemplateFilename, teacherTemplateFilename, UploadedXlsx, vnDayLabel } from './excel';
import { SystemService } from '../platform/system.service';
import { MailService } from './mail.service';
import { dmyDate, officialPdf, PdfCol, schoolPdfLogo } from './pdf';
import { likeEscape, schoolAdminCredentials, SchoolService } from './school.service';

export type MemberRole = 'teacher' | 'student';
const BATCH_ROUNDS = 8;
const EMAIL = /^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/;
const PHONE = /^[0-9]{10}$/;

/**
 * Họ tên viết hoa chữ cái đầu mỗi từ, các chữ sau viết thường (yêu cầu 18/11/2026): "Nguyễn Vũ Đức Anh" được; "Nguyễn vũ Đức Anh", "NGUYỄN VŨ" thì không.
 * Trả câu báo lỗi kèm cách viết đúng, hoặc null khi hợp lệ.
 */
export const properName = (name: string): string => name.normalize('NFC').trim().split(/\s+/).filter(Boolean)
  .map((w) => w.charAt(0).toLocaleUpperCase('vi') + w.slice(1).toLocaleLowerCase('vi')).join(' ');
export function nameCaseError(name: string | null | undefined): string | null {
  const text = String(name ?? '').normalize('NFC').trim();
  if (!text) return null;
  const ok = text.split(/\s+/).every((w) => /^\p{Lu}[\p{Ll}\p{M}]*$/u.test(w) || /^\d+$/.test(w));
  return ok ? null : `Họ và tên phải viết hoa chữ cái đầu mỗi từ, ví dụ “${properName(text)}”`;
}
const GENDERS: Record<string, 'male' | 'female' | 'other'> = { nam: 'male', male: 'male', nu: 'female', female: 'female', khac: 'other', other: 'other' };
const GENDER_LABEL = { male: 'Nam', female: 'Nữ', other: 'Khác' } as const;

/** Một cách viết tên đăng nhập cho mọi màn quản trị; giá trị lưu trong database vẫn là chữ thường để đăng nhập không phân biệt hoa thường. */
const displayAccountUsername = (u: { username: string; role: string; full_name: string; phone: string | null; birth_date: string | null }): string => {
  if (u.role === 'school_admin' && u.username.startsWith('qly')) return u.username.toUpperCase();
  const conventional = u.role === 'teacher' || u.role === 'student'
    ? memberCredentials(u.role, u.full_name, u.phone, u.birth_date)?.username
    : null;
  return shownUsername(u.username, conventional);
};

/** Cột của file nhập giáo viên (số thứ tự chỉ để nhìn, không đọc). Tên cột khác như "Số điện thoại", "Ngày sinh" cũng được nhận */
export const TEACHER_COLUMNS: Column[] = [
  { key: 'user_code', header: 'Mã giáo viên', width: 22 },
  { key: 'full_name', header: 'Họ và tên *', required: true, width: 30 },
  { key: 'gender', header: 'Giới tính', width: 13 },
  { key: 'phone', header: 'SĐT *', aliases: ['Số điện thoại', 'Điện thoại'], required: true, width: 16 },
  { key: 'email', header: 'Email *', required: true, width: 32 },
  { key: 'birth_date', header: 'Ngày tháng năm sinh *', aliases: ['Ngày sinh'], required: true, width: 22 },
];
const TEACHER_FORM_COLUMNS: FormColumn[] = [
  { key: 'stt', header: 'Số thứ tự', kind: 'index', watch: 'full_name', width: 11 },
  { ...TEACHER_COLUMNS[0], kind: 'text' },
  { ...TEACHER_COLUMNS[1], kind: 'text' },
  { ...TEACHER_COLUMNS[2], kind: 'list', options: ['Nam', 'Nữ'] },
  { ...TEACHER_COLUMNS[3], kind: 'phone' },
  { ...TEACHER_COLUMNS[4], kind: 'text' },
  { ...TEACHER_COLUMNS[5], kind: 'date', prompt: 'Ngày sinh dd/mm/yyyy, ví dụ 15/03/1985.' },
];
/**
 * Cột của file nhập học sinh: cùng bảy cột với giáo viên (số thứ tự chỉ để nhìn, không đọc). Họ tên, SĐT, email và ngày sinh bắt buộc (11/11/2026):
 * tên đăng nhập ghép từ tên, 4 số cuối SĐT và ngày sinh, rồi gửi vào email.
 * Cột cuối (Lớp) không có trong file mẫu mới nhưng vẫn được nhận nếu file cũ hoặc file xuất còn giữ, để không mất cách xếp lớp.
 * "Email phụ huynh" đã bỏ hẳn (13/11/2026, migration 062): file cũ còn cột này thì cột bị bỏ qua.
 */
export const STUDENT_COLUMNS: Column[] = [
  { key: 'user_code', header: 'Mã học sinh', width: 29 },
  { key: 'full_name', header: 'Họ và tên *', required: true, width: 30 },
  { key: 'gender', header: 'Giới tính', width: 13 },
  { key: 'phone', header: 'SĐT *', aliases: ['Số điện thoại', 'Điện thoại'], required: true, width: 16 },
  { key: 'email', header: 'Email *', required: true, width: 32 },
  { key: 'birth_date', header: 'Ngày tháng năm sinh *', aliases: ['Ngày sinh'], required: true, width: 22 },
  { key: 'class_name', header: 'Lớp', width: 14 },
];
const STUDENT_FORM_COLUMNS: FormColumn[] = [
  { key: 'stt', header: 'Số thứ tự', kind: 'index', watch: 'full_name', width: 11 },
  { ...STUDENT_COLUMNS[0], kind: 'text' },
  { ...STUDENT_COLUMNS[1], kind: 'text' },
  { ...STUDENT_COLUMNS[2], kind: 'list', options: ['Nam', 'Nữ', 'Khác'] },
  { ...STUDENT_COLUMNS[3], kind: 'phone' },
  { ...STUDENT_COLUMNS[4], kind: 'text' },
  { ...STUDENT_COLUMNS[5], kind: 'date', prompt: 'Ngày sinh dd/mm/yyyy, ví dụ 02/04/2013.' },
];

const MISSING_FOR_ACCOUNT = 'Cần đủ họ tên, SĐT, email và ngày sinh để tạo tài khoản';

/** Dòng tiêu đề A2 của file mẫu: loại mẫu, tên trường và mã trường (mã trường chống nhầm file giữa hai trường trùng tên) */
export const templateSubtitle = (role: MemberRole, school: string, code?: string | null): string =>
  `Mẫu nhập danh sách ${role === 'teacher' ? 'giáo viên' : 'học sinh'} · ${school}${code ? ` · Mã trường ${code}` : ''}`;
/** Dòng tiêu đề A2 của file xuất danh sách (cùng bố cục, nhập lại được ở đúng trường) */
export const exportSubtitle = (role: MemberRole, school: string | null, code?: string | null): string =>
  `Danh sách ${role === 'teacher' ? 'giáo viên' : 'học sinh'}${school ? ` · ${school}${code ? ` · Mã trường ${code}` : ''}` : ''}`;

/**
 * Nhập file giáo viên/học sinh phải đúng file của trường này và đúng loại (yêu cầu 11/11/2026). File mẫu và file xuất của hệ thống ghi ở dòng A2
 * loại danh sách, tên trường và mã trường: khác trường (kể cả hai trường trùng tên, hoặc đổi tên file cho khớp) hay nhầm giáo viên/học sinh đều bị từ chối
 * với lời báo rõ. File cũ/tự lập có tiêu đề cột ở dòng 1 không ghi trường nên vẫn nhận như trước (tên file đã phải đúng tên file mẫu của trường).
 * File mẫu tải trước khi có mã trường thì so tên trường.
 */
export function checkTemplateOwner(role: MemberRole, subtitle: string, spec: { school_name: string; school_code: string }): void {
  const text = normHeader(subtitle), label = (r: MemberRole) => (r === 'teacher' ? 'giáo viên' : 'học sinh');
  const kinds = (['teacher', 'student'] as const).flatMap((r) => [
    { role: r, file: `file mẫu ${label(r)}`, head: normHeader(`Mẫu nhập danh sách ${label(r)}`) },
    { role: r, file: `file danh sách ${label(r)}`, head: normHeader(`Danh sách ${label(r)}`) },
  ]);
  const kind = kinds.find((k) => text === k.head || text.startsWith(`${k.head} `));
  if (!kind) return; // không phải file của hệ thống (file cũ tiêu đề ở dòng 1): kiểm tra cột như trước
  if (kind.role !== role) throw new BadRequestException(`Đây là ${kind.file}. Hãy nhập file này ở trang ${kind.role === 'teacher' ? 'Giáo viên' : 'Học sinh'}.`);
  const code = /Mã trường\s+(\S+)/.exec(subtitle)?.[1];
  const owner = subtitle.split('·')[1]?.trim() ?? '';
  const sameSchool = code ? code === spec.school_code : normHeader(owner) === normHeader(spec.school_name);
  if (!sameSchool) {
    throw new BadRequestException(`File này của trường khác${owner ? ` (${owner}${code ? `, mã ${code}` : ''})` : ''}. Chỉ nhận file mẫu của ${spec.school_name}; hãy tải mẫu của trường rồi điền.`);
  }
}

export interface AccountFilter {
  q?: string; role?: Role; school_id?: number; active?: 'true' | 'false'; grade?: number; class_id?: number; year_id?: number; semester?: number;
  code?: string; name?: string; gender?: 'male' | 'female' | 'other'; phone?: string; email?: string; birth?: string; username?: string; last?: string;
  page?: number; limit?: number;
}

export interface ImportRow { row: number; full_name: string; user_code: string | null; email: string | null; status: 'ok' | 'error' | 'created'; errors: string[]; username?: string }

interface ClassTarget { id: number; name: string; grade: number | null; school_year: string; year_id: number | null; is_active: boolean }

interface MemberInput {
  full_name: string; email?: string | null; phone?: string | null; user_code?: string | null;
  birth_date?: string | null; gender?: 'male' | 'female' | 'other' | null; class_id?: number | null;
  year_id?: number | null; semester?: number | null;
}

/** Ngày hôm nay theo giờ Việt Nam, dạng YYYY-MM-DD */
const todayVn = (): string => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
const clean = (v: unknown): string | null => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') || null : null);

@Injectable()
export class AccountService {
  async codePreview(actor: UserRow,kind: string, opts: {birth_date?:string;school_id?:number;user_id?:number}={}) {
    if (!['teacher','student','class'].includes(kind)) throw new BadRequestException('Loại mã không hợp lệ');
    if(kind==='teacher') return this.schools.run(actor,async(q,scope)=>{
      const target=opts.user_id ? await this.load(q,scope,opts.user_id) : null;
      if(target && target.role!=='teacher') throw new BadRequestException('Tài khoản không phải giáo viên');
      const schoolId=this.schools.target(actor,opts.school_id??target?.school_id??undefined);
      if(target) this.canManage(actor,target);
      if(opts.birth_date && (!parseDate(opts.birth_date)||opts.birth_date>todayVn())) throw new UnprocessableEntityException('Ngày sinh không hợp lệ');
      return this.teacherCode(q,schoolId,opts.birth_date||null,undefined,target?.id);
    });
    if(kind==='student') return this.schools.run(actor,async(q,scope)=>{
      const target=opts.user_id ? await this.load(q,scope,opts.user_id) : null;
      if(target && target.role!=='student') throw new BadRequestException('Tài khoản không phải học sinh');
      const schoolId=this.schools.target(actor,opts.school_id??target?.school_id??undefined);
      if(target) this.canManage(actor,target);
      if(opts.birth_date && (!parseDate(opts.birth_date)||opts.birth_date>todayVn())) throw new UnprocessableEntityException('Ngày sinh không hợp lệ');
      return this.studentCode(q,schoolId,opts.birth_date||null,undefined,target?.id);
    });
    return this.schools.run(actor,async q=>(await q<{code:string}>('SELECT public.app_registration_code($1,false) AS code',[kind]))[0]);
  }
  /** Xem trước không giữ chỗ; trigger 057 cấp số trong giao dịch tạo tài khoản. */
  private async studentCode(q:Q,schoolId:number,born:string|null,requested?:string|null,userId?:number,next?:number) {
    const meta=(await q<{name:string;serial:number|null;year:number|null;prefix:string}>(`SELECT s.name,
      CASE WHEN u.school_id=s.id THEN u.student_code_serial END AS serial,
      CASE WHEN u.school_id=s.id THEN u.student_code_year END AS year,
      public.app_school_initials(s.name) AS prefix FROM app_schools s
      LEFT JOIN app_users u ON u.id=$2 AND u.role='student' WHERE s.id=$1`,[schoolId,userId??null]))[0];
    if(!meta) throw new NotFoundException('Không tìm thấy trường');
    const year=meta.year??Number(todayVn().slice(2,4)),prefix=`HS${meta.prefix}`;
    let requestedSerial=next??null;
    const base=`${prefix}${String(year).padStart(2,'0')}${born?born.slice(8,10)+born.slice(5,7)+born.slice(0,4):''}`;
    if(!meta.serial && born && requested?.startsWith(base) && /^\d{3,9}$/.test(requested.slice(base.length))) requestedSerial=Math.max(requestedSerial??1,Number(requested.slice(base.length)));
    const serial=meta.serial??(await q<{serial:number}>('SELECT public.app_next_student_serial($1,$2,$3::date,$4) AS serial',[schoolId,year,born,requestedSerial]))[0].serial;
    const code=born?(await q<{code:string}>('SELECT public.app_student_identity($1,$2,$3::date,$4) AS code',[meta.name,year,born,serial]))[0].code:null;
    return {code,serial,year,prefix};
  }
  /** Xem trước không cấp số; trigger PostgreSQL chốt số trong cùng giao dịch tạo tài khoản. */
  private async teacherCode(q:Q,schoolId:number,born:string|null,requested?:string|null,userId?:number,next?:number) {
    const meta=(await q<{name:string;serial:number|null;year:number|null;prefix:string;next:number}>(`SELECT s.name,
      CASE WHEN u.school_id=s.id THEN u.teacher_code_serial END AS serial,
      CASE WHEN u.school_id=s.id THEN u.teacher_code_year END AS year,
      public.app_school_initials(s.name) AS prefix,
      coalesce(c.last_serial,0)+1 AS next FROM app_schools s
      LEFT JOIN app_teacher_code_counters c ON c.school_id=s.id
      LEFT JOIN app_users u ON u.id=$2 AND u.role='teacher' WHERE s.id=$1`,[schoolId,userId??null]))[0];
    if(!meta) throw new NotFoundException('Không tìm thấy trường');
    const year=meta.year??Number(todayVn().slice(2,4));
    let serial=meta.serial??next??meta.next;
    const base=`${meta.prefix}${String(year).padStart(2,'0')}${born?born.slice(8,10)+born.slice(5,7)+born.slice(0,4):''}`;
    if(!meta.serial && born && requested?.startsWith(base) && /^\d{3,9}$/.test(requested.slice(base.length))) serial=Math.max(serial,Number(requested.slice(base.length)));
    const code=born?(await q<{code:string}>('SELECT public.app_teacher_identity($1,$2,$3::date,$4) AS code',[meta.name,year,born,serial]))[0].code:null;
    return {code,serial,year,prefix:meta.prefix};
  }
  constructor(
    private readonly db: DatabaseService,
    private readonly schools: SchoolService,
    private readonly mail: MailService,
  ) {}

  // ------------------------------------------------------------------ quyền
  /** Quản trị trường chỉ quản lý giáo viên/học sinh cùng trường; quản trị tổng cấp 2 không đụng tới quản trị tổng; không ai tự khóa/xóa/đổi quyền chính mình */
  private canManage(actor: UserRow, target: UserRow): void {
    if (actor.id === target.id) throw new BadRequestException('Không tự thay đổi quyền, khóa hoặc xóa tài khoản đang đăng nhập');
    if (actor.role === 'school_admin') {
      if (!['teacher', 'student'].includes(target.role)) throw new ForbiddenException('Chỉ quản trị tổng quản lý tài khoản quản trị');
      if (target.school_id !== actor.school_id) throw new NotFoundException('Không tìm thấy tài khoản');
    }
    if (actor.role === 'root_admin' && actor.admin_level !== 1 && target.role === 'root_admin') throw new ForbiddenException('Quản trị tổng cấp 2 không được thay đổi tài khoản quản trị tổng');
  }

  private async load(q: Q, scope: number | null, id: number, forUpdate = false): Promise<UserRow> {
    const rows = await q(`SELECT ${USER_COLUMNS} FROM app_users WHERE id = $1 AND deleted_at IS NULL AND ($2::integer IS NULL OR school_id = $2)${forUpdate ? ' FOR UPDATE' : ''}`, [id, scope]);
    if (!rows.length) throw new NotFoundException('Không tìm thấy tài khoản');
    return toUser(rows[0]);
  }

  /** Tuần tự hóa các thay đổi nhạy cảm và kiểm tra lại người thao tác sau khi chờ khóa */
  private async managed<T>(actor: UserRow, id: number, fn: (q: Q, target: UserRow, actor: UserRow) => Promise<T>, lockRows = false): Promise<T> {
    return this.schools.run(actor, async (q, scope) => {
      await q('SELECT pg_advisory_xact_lock(7412026)');
      const fresh = await this.load(q, scope, actor.id, lockRows);
      if (!fresh.is_active || fresh.role !== actor.role || fresh.token_version !== actor.token_version || fresh.admin_level !== actor.admin_level) throw new ForbiddenException('Quyền của phiên đã thay đổi. Hãy đăng nhập lại.');
      const target = await this.load(q, scope, id, lockRows);
      this.canManage(fresh, target);
      return fn(q, target, fresh);
    });
  }

  /** Cùng một quy tắc cho chi tiết và DELETE: quản trị tổng được xóa tài khoản đã dùng; quản trị trường chỉ xóa khi chưa có dữ liệu. */
  private async deletionBlocker(actor: UserRow, target: UserRow, q: Q): Promise<string | null> {
    if (actor.id === target.id) return 'là tài khoản đang đăng nhập';
    if (target.role === 'root_admin' && actor.admin_level !== 1) return 'là quản trị tổng được bảo vệ';
    if (actor.role === 'root_admin') return null;
    return this.db.accountHasData(target.id, q);
  }

  private async schoolOf(q: Q, id: number) {
    const rows = await q<{ id: number; school_code: string; name: string; region: string | null; city: string | null; is_active: boolean }>('SELECT id, school_code, name, region, city, is_active FROM app_schools WHERE id = $1', [id]);
    if (!rows.length) throw new NotFoundException('Không tìm thấy trường');
    return rows[0];
  }

  // ------------------------------------------------------------------ danh sách
  async list(actor: UserRow, f: AccountFilter, fixedRole?: MemberRole) {
    return this.schools.run(actor, async (q, scope) => {
      const where = ['u.deleted_at IS NULL'];
      const params: unknown[] = [];
      const add = (cond: string, v: unknown) => { params.push(v); where.push(cond.replaceAll('?', `$${params.length}`)); };
      const role = fixedRole ?? f.role;
      if (scope !== null) {
        add('u.school_id = ?', scope);
        where.push("u.role IN ('teacher', 'student')");
      } else if (f.school_id) add('u.school_id = ?', f.school_id);
      if (role) add('u.role = ?', role);
      if (f.active) add('u.is_active = ?', f.active === 'true' ? 1 : 0);
      if (f.name?.trim()) add("(u.full_name ILIKE ? ESCAPE '\\' OR u.username ILIKE ? ESCAPE '\\')", `%${likeEscape(f.name.trim())}%`);
      for (const [column, value] of [['user_code', f.code], ['phone', f.phone], ['email', f.email], ['username', f.username]] as const) {
        if (value?.trim()) add(`coalesce(u.${column}, '') ILIKE ? ESCAPE '\\'`, `%${likeEscape(value.trim())}%`);
      }
      if (f.gender) add('u.gender = ?', f.gender);
      if (f.birth?.trim()) add("to_char(u.birth_date,'DD/MM/YYYY') ILIKE ? ESCAPE '\\'", `%${likeEscape(f.birth.trim())}%`);
      if (f.last?.trim()) add("to_char(u.last_login_at AT TIME ZONE 'Asia/Ho_Chi_Minh','DD/MM/YYYY') ILIKE ? ESCAPE '\\'", `%${likeEscape(f.last.trim())}%`);
      if (f.grade) add('(u.grade = ? OR EXISTS (SELECT 1 FROM app_class_members m JOIN app_classes c ON c.id = m.class_id WHERE m.user_id = u.id AND c.grade = ?::smallint))', f.grade);
      if (f.class_id) { params.push(f.class_id); const p = `$${params.length}`; params.push(f.semester ?? null); const sp = `$${params.length}`; where.push(`(EXISTS (SELECT 1 FROM app_class_members m WHERE m.user_id = u.id AND m.class_id = ${p}) OR EXISTS (SELECT 1 FROM app_class_teacher_assignments t JOIN app_classes c ON c.id=t.class_id WHERE t.teacher_id = u.id AND t.class_id = ${p} AND t.semester = COALESCE(${sp}::int, public.app_class_semester(c.year_id), 1)))`); }
      if (f.year_id && fixedRole) {
        params.push(f.year_id);
        const yp = `$${params.length}`;
        if (fixedRole === 'student') {
          params.push(f.semester ?? null);
          const sp = `$${params.length}`;
          where.push(`(EXISTS (SELECT 1 FROM app_class_members m JOIN app_classes c ON c.id=m.class_id WHERE m.user_id=u.id AND c.year_id=${yp}) OR EXISTS (SELECT 1 FROM app_member_school_terms mt WHERE mt.user_id=u.id AND mt.year_id=${yp} AND (${sp}::int IS NULL OR mt.semester=${sp})))`);
        }
        else {
          params.push(f.semester ?? null);
          const sp = `$${params.length}`;
          where.push(`(EXISTS (SELECT 1 FROM app_class_teacher_assignments t JOIN app_classes c ON c.id=t.class_id WHERE t.teacher_id=u.id AND c.year_id=${yp} AND t.semester=COALESCE(${sp}::int, public.app_class_semester(c.year_id), 1)) OR EXISTS (SELECT 1 FROM app_member_school_terms mt WHERE mt.user_id=u.id AND mt.year_id=${yp} AND (${sp}::int IS NULL OR mt.semester=${sp})))`);
        }
      }
      const text = searchText(f.q);
      if (text) add("u.search_text LIKE ? ESCAPE '\\'", `%${likeEscape(text)}%`);
      const limit = Math.min(200, Math.max(1, f.limit ?? 50));
      const page = Math.max(1, f.page ?? 1);
      const total = Number((await q<{ n: string }>(`SELECT COUNT(*) AS n FROM app_users u WHERE ${where.join(' AND ')}`, params))[0].n);
      const yearParam = `$${params.length + 3}`, semesterParam = `$${params.length + 4}`;
      const rows = await q<Record<string, unknown>>(
        `SELECT ${USER_COLUMNS.split(', ').map((c) => `u.${c}`).join(', ')}, s.name AS school_name,
                COALESCE((SELECT json_agg(json_build_object('id', c.id, 'name', c.name, 'school_year', c.school_year, 'grade', c.grade) ORDER BY c.school_year DESC, c.name)
                          FROM app_class_teacher_assignments t JOIN app_classes c ON c.id = t.class_id WHERE t.teacher_id = u.id
                            AND t.semester = COALESCE(${semesterParam}::int, public.app_class_semester(c.year_id), 1)
                            AND (${yearParam}::int IS NULL OR c.year_id = ${yearParam})), '[]'::json) AS teaching_classes,
                COALESCE((SELECT json_agg(json_build_object('id', c.id, 'name', c.name, 'school_year', c.school_year, 'grade', c.grade) ORDER BY c.school_year DESC, c.name)
                          FROM app_class_members m JOIN app_classes c ON c.id = m.class_id WHERE m.user_id = u.id
                            AND (${yearParam}::int IS NULL OR c.year_id = ${yearParam})), '[]'::json) AS member_classes
         FROM app_users u LEFT JOIN app_schools s ON s.id = u.school_id
         WHERE ${where.join(' AND ')}
         ORDER BY CASE u.role WHEN 'root_admin' THEN 0 WHEN 'school_admin' THEN 1 WHEN 'teacher' THEN 2 ELSE 3 END, u.full_name, u.id
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, (page - 1) * limit, f.year_id ?? null, f.semester ?? null],
      );
      const items = rows.map((r) => {
        const u = toUser(r);
        return { ...toPublic(u), username: displayAccountUsername(u), school_name: (r.school_name as string | null) ?? null, classes: u.role === 'teacher' ? r.teaching_classes : u.role === 'student' ? r.member_classes : [] };
      });
      return { total, page, limit, items };
    });
  }

  async detail(actor: UserRow, id: number) {
    return this.schools.run(actor, async (q, scope) => {
      const user = await this.load(q, scope, id);
      if (scope !== null && !['teacher', 'student'].includes(user.role)) throw new NotFoundException('Không tìm thấy tài khoản');
      const school = user.school_id ? await this.schoolOf(q, user.school_id) : null;
      const classes = await q(
        `SELECT c.id, c.name, c.grade, c.school_year, c.is_active, 'teacher' AS relation FROM app_current_class_teachers t JOIN app_classes c ON c.id = t.class_id WHERE t.teacher_id = $1
         UNION ALL SELECT c.id, c.name, c.grade, c.school_year, c.is_active, 'student' FROM app_class_members m JOIN app_classes c ON c.id = m.class_id WHERE m.user_id = $1
         ORDER BY school_year DESC, name`, [id]);
      const blocker = await this.deletionBlocker(actor, user, q);
      return { ...toPublic(user), username: displayAccountUsername(user), school_name: school?.name ?? null, classes, deletable: blocker === null, delete_blocker: blocker };
    });
  }

  // ------------------------------------------------------------------ tạo tài khoản
  private async queueAccountMail(q: Q, user: UserRow, password: string, schoolName: string | null, reset = false, shownUsername?: string): Promise<'queued' | 'no_email' | 'not_configured'> {
    // mọi lần cấp mật khẩu (tạo tài khoản, nhập file, đặt lại, cấp lại) đều qua đây: lưu bản mã hóa để quản trị xem trong "Mật khẩu tài khoản"
    // cho đến khi người dùng tự đổi (migration 060). Không lưu cho quản trị tổng.
    if (user.role !== 'root_admin') await q('UPDATE app_users SET initial_password_enc = $2 WHERE id = $1', [user.id, sealPassword(password, config.authSecret)]);
    if (!user.email) return 'no_email';
    await this.mail.enqueue(q, {
      school_id: user.school_id, user_id: user.id, batch_id: null, kind: 'bulk', to: user.email,
      subject: reset ? '[Đông A EDU] Mật khẩu tạm mới' : '[Đông A EDU] Thông tin tài khoản',
      payload: { type: 'account', full_name: user.full_name, username: shownUsername ?? displayAccountUsername(user), password, role: user.role, school: schoolName ?? 'Hệ thống Đông A', reset },
    });
    return this.mail.configured ? 'queued' : 'not_configured';
  }

  private async assertUnique(q: Q, school: number | null, email: string | null, code: string | null, exceptId: number | null = null): Promise<void> {
    if (email && (await q('SELECT 1 FROM app_users WHERE lower(email) = $1 AND deleted_at IS NULL AND ($2::integer IS NULL OR id <> $2)', [email.toLowerCase(), exceptId])).length) throw new ConflictException(`Email ${email} đã được dùng cho một tài khoản khác`);
    if (code && school && (await q('SELECT 1 FROM app_users WHERE school_id = $1 AND lower(user_code) = lower($2) AND deleted_at IS NULL AND ($3::integer IS NULL OR id <> $3)', [school, code, exceptId])).length) throw new ConflictException(`Mã ${code} đã có trong trường`);
  }

  /** Quản trị tổng cấp tài khoản quản trị (HK.AD.020): quản trị tổng cấp 1/2 hoặc quản trị viên trường học */
  async createAdmin(actor: UserRow, body: { full_name: string; role: 'root_admin' | 'school_admin'; email: string; phone?: string | null; birth_date?: string | null; school_id?: number | null; admin_level?: 1 | 2 }) {
    if (body.role === 'root_admin') this.schools.assertTopAdmin(actor);
    if (body.role === 'school_admin' && !body.school_id) throw new UnprocessableEntityException('Quản trị viên trường học cần thuộc một trường');
    const nameError = nameCaseError(body.full_name);
    if (nameError) throw new UnprocessableEntityException(nameError);
    const email = body.email.trim().toLowerCase();
    return this.db.tx(async (q) => {
      await q('SELECT pg_advisory_xact_lock(7412026)');
      await this.assertUnique(q, null, email, null);
      const school = body.role === 'school_admin' ? await this.schoolOf(q, body.school_id as number) : null;
      // quản trị viên trường: tên đăng nhập QLY + viết tắt trường + tên + 4 số cuối điện thoại, mật khẩu DongA + ngày sinh + @ + tên (gửi vào email); quản trị tổng giữ mật khẩu tạm ngẫu nhiên
      const conventional = school ? schoolAdminCredentials(school.name, body.full_name, body.phone, body.birth_date) : null;
      const password = conventional?.password ?? generatePassword();
      const passwordHash = await hashPassword(password, BATCH_ROUNDS);
      const username = conventional ? await this.db.uniqueUsernameFrom(conventional.username, q) : await this.db.uniqueUsername(body.full_name, body.role, q);
      const user = await this.db.createUser({
        username, full_name: clean(body.full_name) as string, role: body.role, class_name: null, password_hash: passwordHash, must_change_password: true, email, phone: clean(body.phone),
        school_id: school?.id ?? null, school_code: school?.school_code ?? null, region: school?.region ?? null, city: school?.city ?? null,
        birth_date: conventional ? parseDate(body.birth_date as string) : null,
        admin_level: body.role === 'root_admin' ? (body.admin_level ?? 2) : 1,
      }, q);
      const mail = await this.queueAccountMail(q, user, password, school?.name ?? null, false, conventional ? user.username.toUpperCase() : undefined);
      return { user: toPublic(user), temporary_password: password, mail };
    }).then((r) => { this.mail.kick(); return r; });
  }

  /** Thêm giáo viên (HK.QT.016) hoặc học sinh (HK.QT.026): sinh tên đăng nhập và mật khẩu tạm, bắt buộc đổi ở lần đăng nhập đầu */
  async createMember(actor: UserRow, role: MemberRole, body: MemberInput & { school_id?: number | null }) {
    const schoolId = this.schools.target(actor, body.school_id);
    const input = this.checkMember(body);
    // tên đăng nhập/mật khẩu theo quy ước GV|HS + tên + 4 số cuối SĐT + ngày sinh; checkMember đã bắt đủ thông tin nên luôn ghép được
    const conventional = memberCredentials(role, input.full_name, input.phone, input.birth_date);
    if (!conventional) throw new UnprocessableEntityException(MISSING_FOR_ACCOUNT);
    const password = conventional.password;
    const passwordHash = await hashPassword(password, BATCH_ROUNDS);
    return this.schools.run(actor, async (q) => {
      await q('SELECT pg_advisory_xact_lock(7412026)');
      const school = await this.schoolOf(q, schoolId);
      const cls = input.class_id ? await this.classTarget(q, schoolId, input.class_id) : null;
      await this.assertMemberTerm(q, schoolId, input.year_id, input.semester, cls);
      const user = await this.insertMember(q, school, role, input, passwordHash, cls, conventional.username);
      if (input.year_id && input.semester) await this.saveMemberTerm(q, user.id, schoolId, input.year_id, input.semester);
      const display = shownUsername(user.username, conventional.username);
      const mail = await this.queueAccountMail(q, user, password, school.name, false, display);
      return { user: toPublic(user), display_username: display, temporary_password: password, mail };
    }).then((r) => { this.mail.kick(); return r; });
  }

  private checkMember(body: MemberInput): MemberInput {
    const input: MemberInput = {
      full_name: clean(body.full_name) as string, email: clean(body.email)?.toLowerCase() ?? null, phone: clean(body.phone), user_code: clean(body.user_code),
      birth_date: body.birth_date ?? null, gender: body.gender ?? null, class_id: body.class_id ?? null,
      year_id: body.year_id ?? null, semester: body.semester ?? null,
    };
    if (!input.full_name || input.full_name.length < 2) throw new UnprocessableEntityException('Họ tên tối thiểu 2 ký tự');
    if (!givenNameUpper(input.full_name)) throw new UnprocessableEntityException('Họ tên cần có tên gọi bằng chữ (ví dụ Nguyễn Văn An)');
    // đủ họ tên, SĐT, email và ngày sinh mới tạo tài khoản (yêu cầu 11/11/2026)
    if (!input.phone) throw new UnprocessableEntityException('Cần số điện thoại (10 chữ số) để tạo tên đăng nhập');
    if (!input.email) throw new UnprocessableEntityException('Cần email để gửi tên đăng nhập và mật khẩu');
    if (!input.birth_date) throw new UnprocessableEntityException('Cần ngày sinh để tạo mã và tên đăng nhập');
    if (input.email && !EMAIL.test(input.email)) throw new UnprocessableEntityException('Email không hợp lệ');
    if (input.phone && !PHONE.test(input.phone)) throw new UnprocessableEntityException('Số điện thoại gồm đúng 10 chữ số');
    if (input.birth_date && (!parseDate(input.birth_date) || input.birth_date > todayVn())) throw new UnprocessableEntityException('Ngày sinh không hợp lệ (dạng YYYY-MM-DD, không ở tương lai)');
    if ((input.year_id == null) !== (input.semester == null)) throw new UnprocessableEntityException('Cần chọn cả năm học và học kỳ');
    return input;
  }

  private async assertMemberTerm(q: Q, schoolId: number, yearId?: number | null, semester?: number | null, cls?: ClassTarget | null) {
    if (yearId == null && semester == null) return;
    if (!Number.isSafeInteger(yearId) || !Number.isSafeInteger(semester) || ![1, 2].includes(semester as number)) throw new UnprocessableEntityException('Năm học hoặc học kỳ không hợp lệ');
    const year = (await q<{ status: string }>('SELECT status FROM app_school_years WHERE id=$1 AND school_id=$2', [yearId, schoolId]))[0];
    if (!year) throw new NotFoundException('Không tìm thấy năm học của trường');
    if (year.status === 'ended') throw new ConflictException('Năm học đã kết thúc');
    if (cls && cls.year_id !== yearId) throw new UnprocessableEntityException('Lớp không thuộc năm học đã chọn');
  }

  private async saveMemberTerm(q: Q, userId: number, schoolId: number, yearId: number, semester: number) {
    await q('INSERT INTO app_member_school_terms (user_id, school_id, year_id, semester) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING', [userId, schoolId, yearId, semester]);
  }

  private async templatePeriod(actor: UserRow, schoolId: number | null | undefined, period?: { year_id?: number | null; semester?: number | null }): Promise<{ yearLabel: string; semester: 1 | 2 } | null> {
    if (!period?.year_id && !period?.semester) return null;
    const id = this.schools.target(actor, schoolId);
    return this.schools.run(actor, async (q) => {
      await this.assertMemberTerm(q, id, period.year_id, period.semester);
      const year = (await q<{ label: string }>('SELECT label FROM app_school_years WHERE id=$1 AND school_id=$2', [period.year_id, id]))[0];
      return { yearLabel: year.label, semester: period.semester as 1 | 2 };
    });
  }

  private async classTarget(q: Q, schoolId: number, classId: number): Promise<ClassTarget> {
    const cls = (await q<ClassTarget>('SELECT id, name, grade, school_year, year_id, is_active FROM app_classes WHERE id = $1 AND school_id = $2', [classId, schoolId]))[0];
    if (!cls) throw new NotFoundException('Không tìm thấy lớp');
    if (!cls.is_active) throw new ConflictException(`Lớp ${cls.name} đã được lưu trữ`);
    await this.schools.assertYearOpen(q, cls.year_id);
    return cls;
  }

  private async insertMember(q: Q, school: { id: number; school_code: string; region: string | null; city: string | null }, role: MemberRole, input: MemberInput, passwordHash: string, cls: { id: number; grade: number | null; school_year: string } | null, conventional: string): Promise<UserRow> {
    if(role==='teacher' && input.birth_date) input={...input,user_code:(await this.teacherCode(q,school.id,input.birth_date,input.user_code)).code};
    // học sinh chưa có mã (biểu mẫu thêm từng em, hoặc file không có công thức mã) thì cấp mã HS + viết tắt trường + năm + ngày sinh + STT, giống mẫu Excel
    else if(role==='student' && input.birth_date) input={...input,user_code:(await this.studentCode(q,school.id,input.birth_date,input.user_code)).code};
    input={...input,user_code:input.user_code || (await q<{code:string}>('SELECT public.app_registration_code($1,true) AS code',[role]))[0].code};
    await this.assertUnique(q, school.id, input.email ?? null, input.user_code ?? null);
    if (role === 'student') await SystemService.assertStudentRoom(q, school.id);
    const username = await this.db.uniqueUsernameFrom(conventional, q);
    let user: UserRow;
    try {
      user = await this.db.createUser({
        username, full_name: input.full_name, role, class_name: null, password_hash: passwordHash, must_change_password: true, email: input.email, phone: input.phone,
        user_code: input.user_code, birth_date: input.birth_date, gender: input.gender,
        school_id: school.id, school_code: school.school_code, region: school.region, city: school.city, grade: cls?.grade ?? null, school_year: cls?.school_year ?? null,
      }, q);
    } catch (exc) {
      if (exc instanceof DuplicateUsername) throw new ConflictException('Tên đăng nhập sinh tự động bị trùng, thử lại');
      throw exc;
    }
    if (cls) await q('INSERT INTO app_class_members (class_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [cls.id, user.id]);
    return user;
  }

  // ------------------------------------------------------------------ sửa, khóa, đặt lại mật khẩu, đổi vai trò, xóa
  async update(actor: UserRow, id: number, body: Partial<MemberInput> & { school_id?: number | null }) {
    return this.managed(actor, id, async (q, target, me) => {
      const fields: Record<string, string | number | null> = {};
      const set = (k: string, v: unknown, normalize = clean) => { if (v !== undefined) fields[k] = normalize(v) as string | null; };
      set('full_name', body.full_name);
      if (fields.full_name === null) throw new UnprocessableEntityException('Họ tên không được để trống');
      // đổi họ tên thì phải viết hoa chữ cái đầu mỗi từ (giữ nguyên họ tên cũ khi chỉ sửa thông tin khác)
      if (fields.full_name !== undefined && fields.full_name !== target.full_name) { const err = nameCaseError(fields.full_name as string); if (err) throw new UnprocessableEntityException(err); }
      if (body.email !== undefined) {
        const email = clean(body.email)?.toLowerCase() ?? null;
        if (!email && ['teacher', 'school_admin', 'root_admin'].includes(target.role)) throw new UnprocessableEntityException('Tài khoản này cần có email');
        if (email && !EMAIL.test(email)) throw new UnprocessableEntityException('Email không hợp lệ');
        fields.email = email;
      }
      if (body.phone !== undefined) {
        const phone = clean(body.phone);
        if (phone && !PHONE.test(phone)) throw new UnprocessableEntityException('Số điện thoại gồm đúng 10 chữ số');
        fields.phone = phone;
      }
      // ngày sinh: giáo viên, học sinh (mã) và quản trị viên trường (ghép mật khẩu theo quy ước) – 18/11/2026
      if (target.role === 'school_admin' && body.birth_date !== undefined) {
        if (body.birth_date !== null && (!parseDate(body.birth_date) || body.birth_date > todayVn())) throw new UnprocessableEntityException('Ngày sinh không hợp lệ (YYYY-MM-DD, không ở tương lai)');
        fields.birth_date = body.birth_date;
      }
      if (target.role === 'student' || target.role === 'teacher') {
        if (body.birth_date !== undefined) {
          if ((target.role==='teacher'||target.role==='student') && target.birth_date && !body.birth_date) throw new UnprocessableEntityException('Tài khoản cần ngày sinh để sinh mã');
          if (body.birth_date !== null && (!parseDate(body.birth_date)||body.birth_date>todayVn())) throw new UnprocessableEntityException('Ngày sinh không hợp lệ (YYYY-MM-DD, không ở tương lai)');
          fields.birth_date = body.birth_date;
        }
        if (body.gender !== undefined) fields.gender = body.gender;
      }
      if (body.user_code !== undefined && !['teacher','student'].includes(target.role)) fields.user_code = clean(body.user_code);
      if (fields.user_code === null && target.role === 'student') throw new UnprocessableEntityException('Học sinh cần có mã học sinh');
      await this.assertUnique(q, target.school_id, (fields.email as string | null) ?? null, (fields.user_code as string | null) ?? null, id);
      if (body.school_id !== undefined && body.school_id !== target.school_id) {
        if (me.role !== 'root_admin') throw new ForbiddenException('Không được chuyển trường');
        if (target.role === 'teacher' || target.role === 'student') {
          const linked = (await q<{ n: number }>('SELECT ((SELECT count(*) FROM app_class_members WHERE user_id = $1) + (SELECT count(*) FROM app_class_teacher_assignments WHERE teacher_id = $1))::int AS n', [id]))[0].n;
          if (linked) throw new ConflictException('Tài khoản đang thuộc lớp; hãy gỡ khỏi lớp trước khi chuyển trường');
        }
        if (target.role !== 'root_admin' && !body.school_id) throw new UnprocessableEntityException('Tài khoản này cần thuộc một trường');
        const school = body.school_id ? await this.schoolOf(q, body.school_id) : null;
        await q('UPDATE app_users SET school_id = $2, school_code = $3, region = $4, city = $5, token_version = token_version + 1 WHERE id = $1', [id, school?.id ?? null, school?.school_code ?? null, school?.region ?? null, school?.city ?? null]);
      }
      const updated = await this.db.updateUser(id, fields, q);
      return toPublic(updated as UserRow);
    });
  }

  /** Khóa/mở khóa (HK.AD.023, HK.QT.019/030): khóa cần ghi lý do và thu hồi mọi phiên đăng nhập; dữ liệu giữ nguyên */
  async setLocked(actor: UserRow, id: number, locked: boolean, reason?: string | null) {
    const why = clean(reason);
    if (locked && !why) throw new UnprocessableEntityException('Hãy ghi lý do khóa tài khoản');
    return this.managed(actor, id, async (q, _target, me) => {
      await this.db.setLocked(id, locked, why, me.id, q);
      return toPublic((await this.db.getById(id, q)) as UserRow);
    });
  }

  /**
   * Đặt lại mật khẩu (HK.AD.024, HK.QT.020/031). Từ 18/11/2026 tài khoản của trường luôn đặt lại theo quy ước như "Cấp lại" (không còn mật khẩu ngẫu nhiên
   * kiểu "tdxj-uzhm"); chỉ tài khoản quản trị tổng (không có quy ước) còn nhận mật khẩu tạm ngẫu nhiên.
   */
  async resetPassword(actor: UserRow, id: number) {
    const role = (await this.db.getById(id))?.role;
    if (role && role !== 'root_admin') return this.reissuePassword(actor, id);
    const password = generatePassword();
    const passwordHash = await hashPassword(password, BATCH_ROUNDS);
    return this.managed(actor, id, async (q, target) => {
      await this.db.setPassword(id, passwordHash, true, q);
      await q('UPDATE app_users SET profile_confirmed_at = COALESCE(profile_confirmed_at, now()) WHERE id = $1 AND role <> \'student\'', [id]);
      const school = target.school_id ? await this.schoolOf(q, target.school_id) : null;
      const fresh = (await this.db.getById(id, q)) as UserRow;
      const display = displayAccountUsername(fresh);
      const mail = await this.queueAccountMail(q, fresh, password, school?.name ?? null, true, display);
      return { user: toPublic(fresh), display_username: display, temporary_password: password, mail };
    }).then((r) => { this.mail.kick(); return r; });
  }

  /**
   * Danh sách mật khẩu (yêu cầu 13/11/2026): quản trị trường thấy giáo viên, học sinh, quản trị viên khác của trường mình; quản trị tổng thấy mọi trường
   * (không gồm tài khoản quản trị tổng). Chưa tự đổi: hiện mật khẩu ban đầu / cấp lại (bản mã hóa của migration 060). Đã tự đổi: từ 18/11/2026 (người dùng
   * chọn "Lưu để quản trị xem được", migration 074) chỉ quản trị tổng xem được bản mã hóa của mật khẩu tự đặt; mật khẩu đổi trước ngày đó chỉ có băm một
   * chiều nên không xem được. Tên đăng nhập hiển thị đúng dạng quy ước (GVAnh…, QLY…).
   */
  async passwordList(actor: UserRow, f: { q?: string; name?: string; username?: string; role?: 'teacher' | 'student' | 'school_admin'; school_id?: number; active?: 'true' | 'false'; password_state?: 'initial' | 'changed' | 'unknown'; stt?: number; page?: number; limit?: number }) {
    // lọc STT (18/11/2026): chỉ hiện đúng dòng có số thứ tự đó theo các bộ lọc khác
    const page = Math.max(1, f.page ?? 1), limit = f.stt ? 1 : Math.min(200, Math.max(1, f.limit ?? 25));
    const offset = f.stt ? f.stt - 1 : (page - 1) * limit;
    return this.schools.run(actor, async (q, scope) => {
      const where = ['u.deleted_at IS NULL', "u.role <> 'root_admin'"];
      const params: unknown[] = [];
      const add = (cond: string, v: unknown) => { params.push(v); where.push(cond.replaceAll('?', `$${params.length}`)); };
      if (scope !== null) { add('u.school_id = ?', scope); add('u.id <> ?', actor.id); } else if (f.school_id) add('u.school_id = ?', f.school_id);
      if (f.role) add('u.role = ?', f.role);
      if (f.name?.trim()) add("(u.full_name ILIKE ? ESCAPE '\\' OR u.user_code ILIKE ? ESCAPE '\\')", `%${likeEscape(f.name.trim())}%`);
      if (f.username?.trim()) add("u.username ILIKE ? ESCAPE '\\'", `%${likeEscape(f.username.trim())}%`);
      if (f.active) add('u.is_active = ?', f.active === 'true' ? 1 : 0);
      if (f.password_state === 'initial') where.push('u.must_change_password = 1 AND u.initial_password_enc IS NOT NULL');
      if (f.password_state === 'changed') where.push('u.must_change_password = 0');
      if (f.password_state === 'unknown') where.push('u.must_change_password = 1 AND u.initial_password_enc IS NULL');
      const text = searchText(f.q);
      if (text) add("u.search_text LIKE ? ESCAPE '\\'", `%${likeEscape(text)}%`);
      const clause = where.join(' AND ');
      const total = (await q<{ n: number }>(`SELECT count(*)::int AS n FROM app_users u WHERE ${clause}`, params))[0].n;
      const rows = await q<{ id: number; user_code: string | null; full_name: string; username: string; role: string; email: string | null; phone: string | null; birth_date: string | null;
        school_id: number | null; school_name: string | null; must_change_password: number; initial_password_enc: string | null; password_view_enc: string | null; is_active: number }>(
        `SELECT u.id, u.user_code, u.full_name, u.username, u.role, u.email, u.phone, u.birth_date::text AS birth_date, u.school_id, s.name AS school_name,
                u.must_change_password, u.initial_password_enc, u.password_view_enc, u.is_active
           FROM app_users u LEFT JOIN app_schools s ON s.id = u.school_id
          WHERE ${clause}
          ORDER BY s.name NULLS LAST, CASE u.role WHEN 'school_admin' THEN 0 WHEN 'teacher' THEN 1 ELSE 2 END, u.full_name, u.id
          LIMIT ${limit} OFFSET ${offset}`, params);
      const items = rows.map((u) => {
        // chưa đổi: mật khẩu ban đầu / cấp lại; đã tự đổi: chỉ quản trị tổng xem bản mã hóa lưu từ 18/11/2026 (migration 074)
        const password = u.must_change_password ? openPassword(u.initial_password_enc, config.authSecret) : scope === null ? openPassword(u.password_view_enc, config.authSecret) : null;
        const username = displayAccountUsername(u);
        return {
          id: u.id, user_code: u.user_code, full_name: u.full_name, username, role: u.role, email: u.email, school_id: u.school_id, school_name: u.school_name, is_active: !!u.is_active,
          password, status: !u.must_change_password ? 'changed' as const : password ? 'initial' as const : 'unknown' as const,
        };
      });
      return { items, total, page, limit, offset };
    });
  }

  /**
   * Cấp lại mật khẩu theo quy ước và gửi email (yêu cầu 13/11/2026): giáo viên/học sinh DongA + GV/HS + tên + ngày sinh, quản trị viên trường
   * DongA + ngày sinh + @ + tên; tên đăng nhập giữ nguyên; người dùng phải đổi ở lần đăng nhập sau, mọi phiên cũ bị thu hồi. Thiếu SĐT hoặc ngày sinh thì báo lỗi.
   */
  async reissuePassword(actor: UserRow, id: number) {
    return this.managed(actor, id, async (q, target) => {
      if (target.role === 'root_admin') throw new ForbiddenException('Không cấp lại mật khẩu theo quy ước cho tài khoản quản trị tổng');
      const school = target.school_id ? await this.schoolOf(q, target.school_id) : null;
      const conventional = target.role === 'school_admin'
        ? (school ? schoolAdminCredentials(school.name, target.full_name, target.phone, target.birth_date) : null)
        : memberCredentials(target.role as MemberRole, target.full_name, target.phone, target.birth_date);
      if (!conventional) throw new UnprocessableEntityException('Tài khoản thiếu số điện thoại (10 chữ số) hoặc ngày sinh nên chưa cấp lại theo quy ước được; hãy bổ sung hồ sơ trước.');
      await this.db.setPassword(id, await hashPassword(conventional.password, BATCH_ROUNDS), true, q);
      const fresh = (await this.db.getById(id, q)) as UserRow;
      const display = target.role === 'school_admin' ? fresh.username.toUpperCase() : shownUsername(fresh.username, conventional.username);
      const mail = await this.queueAccountMail(q, fresh, conventional.password, school?.name ?? null, true, display);
      return { user: toPublic(fresh), display_username: display, temporary_password: conventional.password, mail };
    }).then((r) => { this.mail.kick(); return r; });
  }

  /** Đổi vai trò (HK.AD.022): chỉ khi tài khoản chưa thuộc lớp nào; mọi phiên cũ bị thu hồi */
  async changeRole(actor: UserRow, id: number, role: Role, schoolId?: number | null, adminLevel?: 1 | 2) {
    this.schools.assertTopAdmin(actor);
    return this.managed(actor, id, async (q, target) => {
      const linked = (await q<{ n: number }>('SELECT ((SELECT count(*) FROM app_class_members WHERE user_id = $1) + (SELECT count(*) FROM app_class_teacher_assignments WHERE teacher_id = $1))::int AS n', [id]))[0].n;
      if (linked && (role !== target.role || (schoolId !== undefined && schoolId !== target.school_id))) throw new ConflictException('Tài khoản đang thuộc lớp; hãy gỡ khỏi lớp trước khi đổi vai trò hoặc trường');
      const sid = role === 'root_admin' ? null : schoolId === undefined ? target.school_id : schoolId;
      if (role !== 'root_admin' && !sid) throw new UnprocessableEntityException('Hãy gán trường trước khi cấp vai trò này');
      if (role !== 'student' && !target.email) throw new UnprocessableEntityException('Giáo viên và quản trị viên cần có email');
      const school = sid ? await this.schoolOf(q, sid) : null;
      await q(
        `UPDATE app_users SET role = $2, school_id = $3, school_code = $4, region = $5, city = $6, class_name = NULL,
           grade = CASE WHEN $2 = 'student' THEN grade ELSE NULL END, admin_level = $7, token_version = token_version + 1 WHERE id = $1`,
        [id, role, sid, school?.school_code ?? null, school?.region ?? null, school?.city ?? null, role === 'root_admin' ? (adminLevel ?? target.admin_level) : 1]);
      return toPublic((await this.db.getById(id, q)) as UserRow);
    });
  }

  /**
   * Quản trị tổng được xóa từng tài khoản kể cả đã đăng nhập/có dữ liệu (08/11/2026).
   * Quản trị trường vẫn chỉ xóa giáo viên/học sinh chưa dùng. Khóa hàng phối hợp với đăng nhập/đổi mật khẩu;
   * dọn tiến độ cũ không có FK, xóa tài khoản và ghi nhật ký trong cùng giao dịch. Không xóa trường hoặc lớp.
   */
  async remove(actor: UserRow, id: number): Promise<void> {
    await this.managed(actor, id, async (q, target, me) => {
      const blocker = await this.deletionBlocker(me, target, q);
      if (blocker) throw new ConflictException(`Không xóa được vì tài khoản ${blocker}; hãy khóa tài khoản thay vì xóa.`);
      // app_progress không có FK và không cấp quyền DELETE cho vai trò RLS của trường.
      if (me.role === 'root_admin') await q('DELETE FROM app_progress WHERE user_id = $1', [id]);
      await this.db.deleteUser(id, q);
      if (me.role === 'root_admin') await q(
        'INSERT INTO app_audit_events (actor_id, actor_name, actor_role, school_id, action, target_type, target_id, success) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [me.id, me.full_name, me.role, target.school_id, `Xóa tài khoản “${target.full_name}” (${target.username}, ${target.role}) kèm dữ liệu cá nhân`, 'user', String(id), true]);
    }, true);
  }

  // ------------------------------------------------------------------ nhập / xuất Excel
  /** Tên trường để in lên đầu file mẫu/danh sách (quản trị tổng chưa chọn trường thì để trống) */
  private async schoolNameOf(actor: UserRow, schoolId?: number | null): Promise<string | null> {
    const id = actor.role === 'school_admin' ? actor.school_id : schoolId ?? null;
    if (!id) return null;
    return this.schools.run(actor, async (q) => (await q<{ name: string }>('SELECT name FROM app_schools WHERE id = $1', [id]))[0]?.name ?? null);
  }

  /** Mã trường ghi vào dòng tiêu đề file mẫu/file xuất để nhận đúng file của trường khi nhập */
  private async schoolCodeOf(actor: UserRow, schoolId?: number | null): Promise<string | null> {
    const id = actor.role === 'school_admin' ? actor.school_id : schoolId ?? null;
    if (!id) return null;
    return this.schools.run(actor, async (q) => (await q<{ school_code: string }>('SELECT school_code FROM app_schools WHERE id = $1', [id]))[0]?.school_code ?? null);
  }

  /**
   * File mẫu nhập giáo viên theo bố cục chuẩn: "Đông A", tên trường, ngày bắt đầu nhập (tự cập nhật theo lúc tải), rồi bảng Số thứ tự, Mã giáo viên, Họ và tên,
   * Giới tính (chọn Nam/Nữ), SĐT, Email, Ngày tháng năm sinh (ô ngày). Không có cột Bộ môn vì mặc định là Lịch sử.
   */
  async teacherImportSpec(actor:UserRow,schoolId?:number|null){
    const id=this.schools.target(actor,schoolId);
    return this.schools.run(actor,async q=>{
      const school=await this.schoolOf(q,id);
      const next=await this.teacherCode(q,id,null);
      return {filename:teacherTemplateFilename(school.name),legacy_filename:teacherTemplateFilename(school.name).replace(/\.xlsx$/,'.xlsm'),school_name:school.name,school_code:school.school_code,prefix:`${next.prefix}${String(next.year).padStart(2,'0')}`,next_serial:next.serial};
    });
  }

  async teacherTemplate(actor: UserRow, schoolId?: number | null, now: Date = new Date(), rows?:MemberInput[], selected?: { year_id?: number | null; semester?: number | null }): Promise<Buffer> {
    const school = await this.schoolNameOf(actor, schoolId);
    const period = await this.templatePeriod(actor, schoolId, selected);
    const initials = schoolInitials(school ?? ''), year = vnDayLabel(now).slice(8, 10), prefix = `${initials}${year}`;
    const id=actor.role==='school_admin'?actor.school_id:schoolId;
    const code=await this.schoolCodeOf(actor,schoolId);
    const offset=id?await this.schools.run(actor,async q=>Number((await q<{n:number}>('SELECT coalesce((SELECT last_serial FROM app_teacher_code_counters WHERE school_id=$1),0) AS n',[id]))[0]?.n??0)):0;
    return buildFormSheet({
      sheetName: 'Giáo viên', title: 'Đông A', subtitle: school ? templateSubtitle('teacher', school, code) : 'Mẫu nhập danh sách giáo viên',
      meta: [{ label: 'Ngày bắt đầu nhập', value: vnDayLabel(now) }], period: period ?? undefined, note: 'Xem ví dụ rồi nhập danh sách bên dưới. Cột có dấu * là bắt buộc.',
      entryNote:'Điền họ tên, SĐT, email và ngày sinh; nhấn Enter, STT và mã tự tính.',
      completedIndex:true,
      columns: TEACHER_FORM_COLUMNS.map(c => c.key === 'user_code' && !rows ? { ...c, kind: 'teacher-code', width: 29, watch: 'full_name', birthKey: 'birth_date', codePrefix: prefix, codeOffset:offset } : c), blankRows: 1000, now,
      rows:rows?.map((row,i)=>({...row,gender:row.gender?GENDER_LABEL[row.gender]:'',user_code:`${prefix}${row.birth_date!.slice(8,10)}${row.birth_date!.slice(5,7)}${row.birth_date!.slice(0,4)}${String(offset+i+1).padStart(3,'0')}`})),
      example: {
        values: { stt: 1, user_code: `${prefix}15031985001`, full_name: 'Nguyễn Văn Mẫu', gender: 'Nam', phone: '0900000000', email: 'giao.vien@example.invalid', birth_date: '1985-03-15' },
        explanation: `${initials} = ${school ?? 'viết tắt tên trường'}; ${year} = năm ${vnDayLabel(now).slice(6,10)}; 15 + 03 + 1985 = ngày sinh; 001 = số thứ tự. Mã ví dụ: ${prefix}15031985001.`,
      },
      guide: [
        'Điền mỗi giáo viên một dòng trong bảng ở sheet Giáo viên. Họ tên, SĐT, email và ngày sinh là bắt buộc; khối VÍ DỤ chỉ để tham khảo.',
        'Tên đăng nhập = GV + tên + 4 số cuối SĐT + ngày sinh ddmmyyyy; mật khẩu = DongA + GV + tên + ngày sinh. Hệ thống gửi cả hai vào email.',
        'STT và mã giáo viên tự hiện khi đã điền đủ họ tên, email và ngày sinh.',
        `Mã giáo viên = ${initials} + ${year} + ngày sinh ddmmyyyy + STT. Ví dụ: ${prefix}15031985001.`,
        'Ngày sinh ghi dd/mm/yyyy; SĐT gồm đúng 10 chữ số; email không trùng với tài khoản khác.',
        `Giữ nguyên tên file ${teacherTemplateFilename(school??'truong')} và chỉ nhập cho ${school ?? 'trường đã tải mẫu'}; file của trường khác sẽ bị báo lỗi. Tối đa 1000 giáo viên mỗi lần.`,
      ],
    });
  }

  async studentImportSpec(actor:UserRow,schoolId?:number|null){
    const id=this.schools.target(actor,schoolId);
    return this.schools.run(actor,async q=>{
      const school=await this.schoolOf(q,id),next=await this.studentCode(q,id,null);
      return {filename:studentTemplateFilename(school.name),legacy_filename:studentTemplateFilename(school.name).replace(/\.xlsx$/,'.xlsm'),school_name:school.name,school_code:school.school_code,prefix:`${next.prefix}${String(next.year).padStart(2,'0')}`,next_serial:next.serial};
    });
  }
  async studentTemplate(actor:UserRow,schoolId?:number|null,now:Date=new Date(),rows?:MemberInput[],selected?:{year_id?:number|null;semester?:number|null}):Promise<Buffer>{
    const id=this.schools.target(actor,schoolId);
    const period=await this.templatePeriod(actor,id,selected);
    const spec=await this.studentImportSpec(actor,id),school=spec.school_name;
    const initials=schoolInitials(school),prefix=spec.prefix,offset=spec.next_serial-1,yy=prefix.slice(-2);
    return buildFormSheet({
      sheetName:'Học sinh',title:'Đông A',subtitle:templateSubtitle('student',school,spec.school_code),
      meta:[{label:'Ngày bắt đầu nhập',value:vnDayLabel(now)}],period:period??undefined,note:'Xem ví dụ rồi nhập danh sách bên dưới. Cột có dấu * là bắt buộc.',
      entryNote:'Điền họ tên, SĐT, email và ngày sinh; nhấn Enter, STT và mã tự tính.',
      completedIndex:true,
      columns:STUDENT_FORM_COLUMNS.map(c=>c.key==='user_code'&&!rows?{...c,kind:'teacher-code' as const,watch:'full_name',birthKey:'birth_date',codePrefix:prefix,codeOffset:offset}:c),blankRows:1000,now,
      rows:rows?.map((row,i)=>({...row,gender:row.gender?GENDER_LABEL[row.gender]:'',user_code:memberCode(prefix,row.birth_date!,offset+i+1)})),
      example:{values:{stt:1,user_code:`${prefix}02042013001`,full_name:'Trần Thị Mẫu',gender:'Nữ',phone:'0900000000',email:'hoc.sinh@example.invalid',birth_date:'2013-04-02'},explanation:`HS = học sinh; ${initials} = ${school}; ${yy} = năm nhập; 02 + 04 + 2013 = ngày sinh; 001 = số thứ tự. Mã ví dụ: ${prefix}02042013001.`},
      guide:[
        'Điền mỗi học sinh một dòng trong bảng ở sheet Học sinh. Họ tên, SĐT, email và ngày sinh là bắt buộc; khối VÍ DỤ chỉ để tham khảo.',
        'STT và mã học sinh tự hiện khi đã điền đủ họ tên, email và ngày sinh.',
        'Tên đăng nhập = HS + tên + 4 số cuối SĐT + ngày sinh ddmmyyyy; mật khẩu = DongA + HS + tên + ngày sinh. Hệ thống gửi cả hai vào email.',
        `Mã học sinh = HS + ${initials} + ${yy} + ngày sinh ddmmyyyy + STT. Ví dụ: ${prefix}02042013001.`,
        'Ngày sinh ghi dd/mm/yyyy; SĐT gồm đúng 10 chữ số; email không trùng với tài khoản khác.',
        `Giữ nguyên tên file ${spec.filename} và chỉ nhập cho ${school}; file của trường khác sẽ bị báo lỗi. Tối đa 1000 học sinh mỗi lần.`,
      ],
    });
  }

  /**
   * Nhập danh sách giáo viên/học sinh (HK.QT.017/027). `commit=false`: chỉ kiểm tra và báo lỗi từng dòng (trùng email/mã trong file hoặc trong trường,
   * thiếu dữ liệu, sai định dạng, lớp không có). `commit=true`: kiểm tra lại và lưu các dòng hợp lệ, bỏ qua dòng lỗi; trả mật khẩu tạm một lần.
   */
  async importMembers(actor: UserRow, role: MemberRole, file: UploadedXlsx | undefined, opts: { commit: boolean; school_id?: number | null; year_id?: number | null; semester?: number | null }) {
    const upload = checkUpload(file,true);
    const schoolId = this.schools.target(actor, opts.school_id);
    const spec=role==='teacher'?await this.teacherImportSpec(actor,schoolId):await this.studentImportSpec(actor,schoolId);
    if(upload.originalname!==spec.filename&&upload.originalname!==spec.legacy_filename) throw new BadRequestException(`Sai tên file. Chỉ nhận ${spec.filename}. Hãy giữ đúng tên file mẫu của trường.`);
    // tên file có thể trùng giữa hai trường cùng tên: đọc thêm dòng tiêu đề trong file (loại mẫu, tên và mã trường) để chắc là đúng file của trường này
    const selectedPeriod = opts.year_id && opts.semester ? await this.templatePeriod(actor, schoolId, opts) : null;
    const parsed = await readSheet(upload, role === 'teacher' ? TEACHER_COLUMNS : STUDENT_COLUMNS, undefined, true, (sheet) => {
      checkTemplateOwner(role, cellText(sheet.getCell('A2').value), spec);
      // Mẫu mới ghi kỳ đã chọn ở đầu file; file cũ không có hai nhãn này vẫn nhập được.
      if (cellText(sheet.getCell('D3').value) === 'Năm học:' && cellText(sheet.getCell('D4').value) === 'Học kỳ:') {
        if (!selectedPeriod || cellText(sheet.getCell('E3').value) !== selectedPeriod.yearLabel || cellText(sheet.getCell('E4').value) !== `Học kỳ ${selectedPeriod.semester}`) {
          throw new BadRequestException('Năm học hoặc học kỳ trong file khác lựa chọn trên website. Hãy chọn đúng kỳ hoặc tải lại file mẫu.');
        }
      }
    });
    if (!parsed.length) throw new BadRequestException('File không có dòng dữ liệu nào');
    return this.schools.run(actor, async (q) => {
      if (opts.commit) await q('SELECT pg_advisory_xact_lock(7412026)');
      const school = await this.schoolOf(q, schoolId);
      const yearId = opts.year_id ?? (await q<{ id: number }>("SELECT id FROM app_school_years WHERE school_id = $1 AND status = 'active'", [schoolId]))[0]?.id ?? null;
      // File/API cũ chỉ gửi year_id: dùng học kỳ hiện hành; giao diện mới luôn gửi cả hai.
      const entrySemester = opts.year_id ? (opts.semester ?? (await q<{ semester: number }>('SELECT public.app_class_semester($1) AS semester', [opts.year_id]))[0]?.semester ?? 1) : opts.semester;
      if (opts.year_id != null || opts.semester != null) await this.assertMemberTerm(q, schoolId, opts.year_id, entrySemester);
      const seenEmail = new Set<string>(), seenCode = new Set<string>(), seenSourceCode = new Set<string>();
      let nextTeacherSerial=role==='teacher'?(await this.teacherCode(q,schoolId,null)).serial:(await this.studentCode(q,schoolId,null)).serial;
      const rows: ImportRow[] = [];
      const credentials: Array<{ row: number; username: string; password: string; full_name: string; email: string | null }> = [];
      for (const { row, values } of parsed) {
        const errors: string[] = [];
        const originalCode=clean(values.user_code)?.toLowerCase();
        if(originalCode && seenSourceCode.has(originalCode)) errors.push('Mã trùng với dòng trước trong file');
        if(originalCode)seenSourceCode.add(originalCode);
        const input: MemberInput = {
          full_name: clean(values.full_name) ?? '', email: clean(values.email)?.toLowerCase() ?? null, phone: clean(values.phone), user_code: clean(values.user_code),
          gender: null, birth_date: null, class_id: null,
        };
        if (input.full_name.length < 2) errors.push('Thiếu họ tên');
        else if (!givenNameUpper(input.full_name)) errors.push('Họ tên cần có tên gọi bằng chữ');
        // đủ họ tên, SĐT, email và ngày sinh mới tạo tài khoản (yêu cầu 11/11/2026)
        if (!input.phone) errors.push('Thiếu SĐT');
        if (!input.email) errors.push('Thiếu email');
        if (input.email && !EMAIL.test(input.email)) errors.push('Email không hợp lệ');
        if (input.phone && !PHONE.test(input.phone)) errors.push('Số điện thoại gồm đúng 10 chữ số');
        if (!values.birth_date) errors.push('Thiếu ngày sinh');
        else if (!(input.birth_date = parseDate(values.birth_date))) errors.push('Ngày sinh sai định dạng (dd/mm/yyyy)');
        else if (input.birth_date > todayVn()) errors.push('Ngày sinh không được ở tương lai');
        if (values.gender) {
          const g = GENDERS[searchText(values.gender)];
          if (!g || (role === 'teacher' && g === 'other')) errors.push(role === 'teacher' ? 'Giới tính phải là Nam hoặc Nữ' : 'Giới tính phải là Nam, Nữ hoặc Khác'); else input.gender = g;
        }
        let cls: ClassTarget | null = null;
        if (role === 'student' && clean(values.class_name)) {
          const found = yearId ? (await q<{ id: number }>('SELECT id FROM app_classes WHERE school_id = $1 AND year_id = $2 AND lower(name) = lower($3)', [schoolId, yearId, clean(values.class_name)]))[0] : null;
          if (!found) errors.push(`Không có lớp "${clean(values.class_name)}" trong năm học đã chọn`);
          else cls = await this.classTarget(q, schoolId, found.id).catch((e: Error) => { errors.push(e.message); return null; });
        }
        if(input.birth_date && !errors.length){
          if(role==='student' && input.user_code && (await q('SELECT 1 FROM app_users WHERE school_id=$1 AND lower(user_code)=lower($2) AND deleted_at IS NULL',[schoolId,input.user_code])).length) errors.push(`Mã ${input.user_code} đã có trong trường`);
          const generated=role==='teacher'?await this.teacherCode(q,schoolId,input.birth_date,input.user_code,undefined,nextTeacherSerial):await this.studentCode(q,schoolId,input.birth_date,input.user_code,undefined,nextTeacherSerial);
          input.user_code=generated.code;
          nextTeacherSerial=generated.serial+1;
        }
        const emailKey = input.email?.toLowerCase(), codeKey = input.user_code?.toLowerCase();
        if (emailKey && seenEmail.has(emailKey)) errors.push('Email trùng với dòng trước trong file');
        if (codeKey && seenCode.has(codeKey)) errors.push('Mã trùng với dòng trước trong file');
        if (!errors.length) {
          try { await this.assertUnique(q, schoolId, input.email ?? null, input.user_code ?? null); } catch (e) { errors.push((e as Error).message); }
        }
        if (emailKey) seenEmail.add(emailKey);
        if (codeKey) seenCode.add(codeKey);
        const result: ImportRow = { row, full_name: input.full_name, user_code: input.user_code ?? null, email: input.email ?? null, status: errors.length ? 'error' : 'ok', errors };
        if (!errors.length && opts.commit) {
          // cùng quy ước với thêm từng người; thư gửi tên đăng nhập và mật khẩu vào email (dòng đã đủ thông tin nên luôn ghép được)
          const conventional = memberCredentials(role, input.full_name, input.phone, input.birth_date)!;
          const password = conventional.password;
          const user = await this.insertMember(q, school, role, input, await hashPassword(password, BATCH_ROUNDS), cls, conventional.username);
          if (opts.year_id && entrySemester) await this.saveMemberTerm(q, user.id, schoolId, opts.year_id, entrySemester);
          const display = shownUsername(user.username, conventional.username);
          await this.queueAccountMail(q, user, password, school.name, false, display);
          result.status = 'created';
          result.username = display;
          result.user_code = user.user_code;
          credentials.push({ row, username: display, password, full_name: user.full_name, email: user.email });
        }
        rows.push(result);
      }
      const invalid = rows.filter((r) => r.status === 'error').length;
      return {
        committed: opts.commit, year_id: yearId, total: rows.length, valid: rows.length - invalid, errors: invalid,
        created: rows.filter((r) => r.status === 'created').length, rows, credentials,
      };
    }).then((r) => { if (opts.commit) this.mail.kick(); return r; });
  }

  /** Mọi giáo viên / học sinh khớp bộ lọc (đọc theo trang 200 dòng) */
  private async allMembers(actor: UserRow, role: MemberRole, f: AccountFilter) {
    const all: Awaited<ReturnType<AccountService['list']>>['items'] = [];
    for (let page = 1; page <= 100; page += 1) {
      const chunk = (await this.list(actor, { ...f, page, limit: 200 }, role)).items;
      all.push(...chunk);
      if (chunk.length < 200) break;
    }
    return all;
  }

  /**
   * Danh sách giáo viên / học sinh dạng PDF (yêu cầu 14/11/2026: quản trị trường chỉ xuất PDF) theo thể thức văn bản của nhà trường (`officialPdf`):
   * phần đầu UBND phường/xã, tên trường, Quốc hiệu, Tiêu ngữ, địa danh và ngày; "DANH SÁCH GIÁO VIÊN / HỌC SINH", năm học, tổng số (nam, nữ) và bộ lọc đang dùng;
   * bảng STT xếp theo tên như danh sách của trường; chỗ ký Người lập biểu, Hiệu trưởng.
   */
  async exportMembersPdf(actor: UserRow, role: MemberRole, f: AccountFilter): Promise<{ buffer: Buffer; filename: string }> {
    const id = actor.role === 'school_admin' ? actor.school_id : f.school_id ?? null;
    const extra = id ? await this.schools.run(actor, async (q) => ({
      school: (await q<{ name: string; code: string | null; region: string | null; city: string | null; address: string | null; directory_code: string | null; logo_url: string | null }>('SELECT name, school_code AS code, region, city, address, directory_code, logo_url FROM app_schools WHERE id = $1', [id]))[0] ?? null,
      year: f.year_id ? (await q<{ label: string }>('SELECT label FROM app_school_years WHERE school_id = $1 AND id = $2', [id, f.year_id]))[0]?.label ?? null : null,
      className: f.class_id ? (await q<{ name: string }>('SELECT name FROM app_classes WHERE id = $1 AND school_id = $2', [f.class_id, id]))[0]?.name ?? null : null,
    })) : { school: null, year: null, className: null };
    const school = extra.school ? { ...extra.school, logo: await schoolPdfLogo(this.db, extra.school) } : null;
    const given = (name: string) => name.trim().split(/\s+/).pop() ?? '';
    const all = (await this.allMembers(actor, role, f)).sort((a, b) => given(a.full_name).localeCompare(given(b.full_name), 'vi') || a.full_name.localeCompare(b.full_name, 'vi'));
    const names = (u: { classes: unknown }) => (u.classes as Array<{ name: string }>).map((c) => c.name).join(', ');
    const rows = all.map((u) => ({ ...u, gender: u.gender ? GENDER_LABEL[u.gender] : '', birth: dmyDate(u.birth_date), classes_text: names(u), status: u.is_active ? 'Hoạt động' : 'Đã khóa' }));
    const teacher = role === 'teacher', noun = teacher ? 'giáo viên' : 'học sinh';
    const male = rows.filter((r) => r.gender === 'Nam').length, female = rows.filter((r) => r.gender === 'Nữ').length;
    const filters = [f.q ? `tìm "${f.q}"` : null, f.grade ? `khối ${f.grade}` : null, extra.className ? `lớp ${extra.className}` : null, f.active === 'true' ? 'đang hoạt động' : f.active === 'false' ? 'đã khóa' : null].filter(Boolean);
    const cols: PdfCol[] = teacher
      ? [{ header: 'Mã giáo viên', key: 'user_code', width: 18, align: 'center' }, { header: 'Họ và tên', key: 'full_name', width: 24, keep: true }, { header: 'Giới tính', key: 'gender', width: 8, align: 'center' },
        { header: 'Ngày sinh', key: 'birth', width: 11, align: 'center' }, { header: 'Số điện thoại', key: 'phone', width: 12, align: 'center' }, { header: 'Email', key: 'email', width: 27 },
        { header: 'Lớp phụ trách', key: 'classes_text', width: 14, align: 'center' }, { header: 'Trạng thái', key: 'status', width: 12, align: 'center' }]
      : [{ header: 'Mã học sinh', key: 'user_code', width: 20, align: 'center' }, { header: 'Họ và tên', key: 'full_name', width: 24, keep: true }, { header: 'Giới tính', key: 'gender', width: 8, align: 'center' },
        { header: 'Ngày sinh', key: 'birth', width: 11, align: 'center' }, { header: 'Lớp', key: 'classes_text', width: 10, align: 'center' }, { header: 'Số điện thoại', key: 'phone', width: 12, align: 'center' },
        { header: 'Email', key: 'email', width: 26 }, { header: 'Trạng thái', key: 'status', width: 12, align: 'center' }];
    const buffer = await officialPdf({
      title: `Danh sách ${noun}`, footer: school?.code ? `Mã trường ${school.code}` : undefined,
      parts: [{
        school, title: `Danh sách ${noun}`, subtitle: `${extra.year ? `Năm học ${extra.year}` : 'Mọi năm học'}${extra.year && f.semester ? ` – Học kỳ ${f.semester}` : ''}`,
        info: [`Tổng số: ${rows.length} ${noun} (nam: ${male}, nữ: ${female})`, ...(filters.length ? [`Lọc theo: ${filters.join(', ')}`] : [])],
        tables: [{ cols, rows, empty: `Không có ${noun} nào khớp bộ lọc.`, total: rows.length ? `Danh sách này có ${rows.length} ${noun}.` : undefined }],
        signers: [{ title: 'Người lập biểu', name: actor.full_name }, { title: 'Hiệu trưởng', hint: '(Ký tên, đóng dấu)' }],
      }],
    });
    const yearSlug = extra.year && /^\d{4}-\d{4}$/.test(extra.year) ? extra.year : 'moi-nam-hoc';
    const termSlug = extra.year && (f.semester === 1 || f.semester === 2) ? f.semester : 'ca-nam';
    return { buffer, filename: `danh_sach_${teacher ? 'giao-vien' : 'hoc-sinh'}_${yearSlug}_hoc-ky-${termSlug}.pdf` };
  }

  async exportMembers(actor: UserRow, role: MemberRole, f: AccountFilter): Promise<Buffer> {
    const all = await this.allMembers(actor, role, f);
    const names = (u: { classes: unknown }) => (u.classes as Array<{ name: string }>).map((c) => c.name).join(', ');
    const rows = all.map((u) => ({
      ...u, gender: u.gender ? GENDER_LABEL[u.gender] : '', birth_date: u.birth_date ?? '', class_name: names(u), classes_text: names(u), status: u.is_active ? 'Đang hoạt động' : 'Đã khóa',
    }));
    if (role === 'teacher') {
      const school = await this.schoolNameOf(actor, f.school_id), code = await this.schoolCodeOf(actor, f.school_id);
      const now = new Date();
      return buildFormSheet({
        sheetName: 'Giáo viên', title: 'Đông A', subtitle: exportSubtitle('teacher', school, code), meta: [{ label: 'Ngày xuất', value: vnDayLabel(now) }, { label: 'Số giáo viên', value: String(rows.length) }],
        columns: [...TEACHER_FORM_COLUMNS.map((c) => ({ ...c, header: c.header.replace(' *', '') })), { key: 'classes_text', header: 'Lớp phụ trách', kind: 'text' as const, width: 26 }, { key: 'status', header: 'Trạng thái', kind: 'text' as const, width: 18 }],
        rows, now,
      });
    }
    const school = await this.schoolNameOf(actor, f.school_id), code = await this.schoolCodeOf(actor, f.school_id);
    const now = new Date();
    const grades = (u: { classes: unknown }) => [...new Set((u.classes as Array<{ grade: number | null }>).map((c) => c.grade).filter(Boolean))].map((g) => `Khối ${g}`).join(', ');
    return buildFormSheet({
      sheetName: 'Học sinh', title: 'Đông A', subtitle: exportSubtitle('student', school, code), meta: [{ label: 'Ngày xuất', value: vnDayLabel(now) }, { label: 'Số học sinh', value: String(rows.length) }],
      columns: [...STUDENT_FORM_COLUMNS.map((c) => ({ ...c, header: c.header.replace(' *', '') })), { key: 'class_name', header: 'Lớp', kind: 'text' as const, width: 14 }, { key: 'grade_text', header: 'Khối', kind: 'text' as const, width: 14 }, { key: 'status', header: 'Trạng thái', kind: 'text' as const, width: 18 }],
      rows: rows.map((r) => ({ ...r, grade_text: grades(r) })), now,
    });
  }
}
