/**
 * Trường, năm học và khối lớp (HK.AD.011–017, HK.QT.010–013).
 * Quản trị tổng: toàn hệ thống (thêm trường, bật/tắt, xóa). Quản trị trường: chỉ trường trong token;
 * truy vấn chạy trong db.scoped(school_id) nên Row-Level Security chặn dữ liệu trường khác kể cả khi quên điều kiện WHERE.
 * 18/11/2026: thêm trường không còn kèm quản trị viên đầu tiên (thêm sau ở mục Quản trị viên trường; API vẫn nhận `admin` cho client cũ);
 * khu vực theo mô hình hai cấp từ 01/07/2025 (tỉnh / thành + phường / xã / đặc khu, admin-units.ts) – không nhận quận / huyện cũ;
 * `deactivated_at` là ngày kết thúc (migration 073); logo trường tải ảnh lên (WebP ≤160px trong app_school_logo_assets).
 */
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { toPublic } from '../auth/auth.service';
import { generatePassword, hashPassword } from '../auth/passwords';
import { config } from '../config';
import { sealPassword } from '../auth/passwords';
import { DatabaseService, DuplicateUsername, Q, UserRow } from '../database/database.service';
import { MailService } from './mail.service';
import { DirectoryEntry, directoryEntry, foldVi, nameWords, sameSchoolName, schoolSlug, searchDirectory } from './school-directory';
import { composeAddress, currentCityName, findWard, isOldDistrict, PROVINCES, provinceOf, unitsInfo } from './admin-units';
import { createHash } from 'crypto';
import sharp from 'sharp';
import { isBase64 } from '../content/studio.service';
import { nameCaseError } from './person-name';
import { currentSchoolLogo } from './school-brand';
import { givenNameUpper, parseDate, schoolInitials } from './excel';

export const GRADES = [6, 7, 8, 9] as const;
export const likeEscape = (s: string) => s.replace(/[\\%_]/g, (ch) => `\\${ch}`);

/** Tên gọi của người quản lý dùng để ghép tên đăng nhập và mật khẩu: từ cuối của họ tên, viết hoa, bỏ dấu, chỉ giữ chữ và số. "Nguyễn Hoài An" → "AN". */
export function managerGivenName(fullName: string): string {
  return givenNameUpper(fullName);
}

/**
 * Tên đăng nhập và mật khẩu của quản trị viên trường theo quy ước (yêu cầu 10/11/2026):
 * tên đăng nhập = QLY + viết tắt tên trường + tên người quản lý + 4 số cuối điện thoại, ví dụ QLYGOTAN6720 (Giồng Ông Tố, An, ...6720);
 * mật khẩu = DongA + ngày sinh ddmmyyyy + @ + tên người quản lý, ví dụ DongA06042005@AN. Mật khẩu này chỉ dùng cho lần đăng nhập đầu: tài khoản bị buộc đổi mật khẩu.
 * Tên đăng nhập lưu chữ thường (đăng nhập không phân biệt hoa thường); hiển thị và gửi thư bằng chữ hoa như ví dụ.
 */
export function schoolAdminCredentials(schoolName: string, fullName: string, phone: string | null | undefined, birthDate: string | null | undefined): { username: string; password: string } {
  const given = managerGivenName(fullName);
  if (!given) throw new UnprocessableEntityException('Họ tên của quản trị viên cần có tên gọi để tạo tên đăng nhập');
  const digits = (phone ?? '').trim();
  if (!/^[0-9]{10}$/.test(digits)) throw new UnprocessableEntityException('Số điện thoại của quản trị viên gồm đúng 10 chữ số (dùng 4 số cuối để ghép tên đăng nhập)');
  const born = birthDate ? parseDate(birthDate) : null;
  const today = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
  if (!born) throw new UnprocessableEntityException('Chọn ngày tháng năm sinh của quản trị viên (dùng để ghép mật khẩu)');
  if (born > today || born < '1930-01-01') throw new UnprocessableEntityException('Ngày sinh của quản trị viên không hợp lệ');
  return {
    username: `QLY${schoolInitials(schoolName)}${given}${digits.slice(-4)}`,
    password: `DongA${born.slice(8, 10)}${born.slice(5, 7)}${born.slice(0, 4)}@${given}`,
  };
}

export interface SchoolRow {
  id: number;
  school_code: string;
  directory_code: string | null;
  name: string;
  region: string | null;
  city: string | null;
  address: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
  /** Ngày kết thúc: lúc trường bị vô hiệu hóa (migration 073); null khi đang hoạt động */
  deactivated_at: string | null;
}

/** Kết quả xóa trường: số tài khoản, lớp, năm học đã xóa kèm trường (dùng ghi nhật ký) */
export interface RemovedSchool { id: number; school_code: string; name: string; admins: number; teachers: number; students: number; classes: number; years: number }

export interface YearRow {
  id: number; school_id: number; label: string; starts_on: string; ends_on: string; status: 'planned' | 'active' | 'ended'; ended_at: string | null;
  /** Học kỳ 1 và học kỳ 2: hoặc cả bốn ngày đều trống (chưa đặt học kỳ) hoặc cả bốn ngày đều có */
  term1_starts_on: string | null; term1_ends_on: string | null; term2_starts_on: string | null; term2_ends_on: string | null;
  calendar_mode: 'manual' | 'national';
  /** Bắt đầu lúc: thời điểm bấm kích hoạt (migration 076) */
  activated_at?: string | null;
}
interface YearFramework {
  label: string; starts_on: string; ends_on: string;
  term1_starts_on: string; term1_ends_on: string; term2_starts_on: string; term2_ends_on: string;
  opening_on: string; term1_finish_before: string; term2_finish_before: string; year_finish_before: string;
  term1_teaching_weeks: number; term2_teaching_weeks: number; decision: string; source_url: string;
}
export const TERM_KEYS = ['term1_starts_on', 'term1_ends_on', 'term2_starts_on', 'term2_ends_on'] as const;
export type YearTerms = Partial<Record<(typeof TERM_KEYS)[number], string | null>>;

/**
 * Mã trường chuẩn hóa: chỉ giữ chữ số. Mã ngắn thêm số 0 phía trước cho đủ 4 chữ số; mã Bộ GD&ĐT (8 chữ số) giữ nguyên;
 * mã dài hơn 8 lấy 8 chữ số cuối. Không cắt còn 4 số vì chỉ 4 số cuối thì 95% trường trong danh mục trùng mã nhau.
 */
export const normCode = (code: string | null | undefined): string => {
  const digits = String(code ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length <= 4 ? digits.padStart(4, '0') : digits.slice(-8);
};

/** Đường dẫn riêng của trường (donga_<mã>_<tên>_<khu vực>): trường dùng làm cổng đăng nhập của mình */
export interface SchoolLink { slug: string; path: string; url: string }
export const schoolLink = (s: { school_code: string; name: string; region?: string | null }): SchoolLink => {
  const slug = schoolSlug(s);
  return { slug, path: `/${slug}`, url: `${config.appUrl}/${slug}` };
};
const withLink = <T extends { school_code: string; name: string; region: string | null }>(row: T): T & { link: SchoolLink } => ({ ...row, link: schoolLink(row) });

const describeSchool = (s: { name: string; school_code: string; region?: string | null }): string => `“${s.name}” (mã ${s.school_code}${s.region ? `, ${s.region}` : ''})`;

const trimOrNull = (v: unknown): string | null => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') || null : null);

/**
 * Tỉnh / thành và phường / xã của trường theo mô hình hai cấp (từ 01/07/2025): tỉnh / thành phải là một trong 34 đơn vị hiện hành, phường / xã /
 * đặc khu phải thuộc tỉnh / thành đó; quận / huyện / thị xã cũ bị từ chối. Trả tên chuẩn theo danh sách (đúng chữ hoa, dấu).
 */
export function checkPlace(city: unknown, region: unknown): { city: string | null; region: string | null } {
  const c = trimOrNull(city), r = trimOrNull(region);
  if (!c) {
    if (r) throw new UnprocessableEntityException('Hãy chọn tỉnh / thành phố trước khi chọn phường / xã');
    return { city: null, region: null };
  }
  const province = provinceOf(c);
  if (!province) throw new UnprocessableEntityException(`“${c}” không thuộc 34 tỉnh / thành phố hiện hành`);
  if (!r) return { city: currentCityName(c), region: null };
  if (isOldDistrict(r)) throw new UnprocessableEntityException(`Từ 01/07/2025 không còn cấp quận / huyện / thị xã (“${r}”). Hãy chọn phường / xã / đặc khu của ${province.name}.`);
  const ward = findWard(province.name, r);
  if (!ward) throw new UnprocessableEntityException(`Không có “${r}” trong danh sách phường / xã / đặc khu của ${province.name}`);
  return { city: currentCityName(c), region: ward.name };
}

/** Logo tải lên: đường dẫn riêng /api/school-logos/u/<sha256>.webp để không bị logo danh mục thay thế (currentSchoolLogo, schoolPdfLogo) */
export const uploadedLogoUrl = (sha: string) => `${config.publicApiUrl}/api/school-logos/u/${sha}.webp`;
const LOGO_MAX_INPUT = 2 * 1024 * 1024;
const LOGO_MAX_STORED = 81920;

@Injectable()
export class SchoolService {
  constructor(
    private readonly db: DatabaseService,
    private readonly mail: MailService,
  ) {}

  /** Quản trị tổng: toàn hệ thống; quản trị trường: chỉ trường của mình (Row-Level Security) */
  run<T>(user: UserRow, fn: (q: Q, scope: number | null) => Promise<T>): Promise<T> {
    if (user.role === 'root_admin') return this.db.tx((q) => fn(q, null));
    if (!user.school_id) throw new ForbiddenException('Tài khoản chưa được gán trường – liên hệ quản trị tổng');
    return this.db.scoped(user.school_id, (q) => fn(q, user.school_id));
  }

  /** Trường mà thao tác nhắm tới: quản trị trường luôn là trường của mình; quản trị tổng phải chỉ rõ school_id */
  target(actor: UserRow, schoolId?: number | null): number {
    if (actor.role === 'school_admin') {
      if (!actor.school_id) throw new ForbiddenException('Tài khoản chưa được gán trường');
      if (schoolId && schoolId !== actor.school_id) throw new ForbiddenException('Chỉ thao tác được trên trường của bạn');
      return actor.school_id;
    }
    if (!schoolId) throw new UnprocessableEntityException('Hãy chọn trường (school_id)');
    return schoolId;
  }

  /** Quản trị tổng cấp 2 không được thay đổi hệ thống ở mức quản trị tổng (HK.AD.020/026) */
  assertTopAdmin(actor: UserRow): void {
    if (actor.role === 'root_admin' && actor.admin_level !== 1) throw new ForbiddenException('Chỉ quản trị tổng cấp 1 được thực hiện thao tác này');
  }

  // ------------------------------------------------------------------ trường (quản trị tổng)
  /** Đơn vị hành chính hai cấp: không có `city` thì trả 34 tỉnh / thành; có thì trả phường / xã / đặc khu của tỉnh / thành đó */
  adminUnits(city?: string) {
    const info = unitsInfo();
    if (!city?.trim()) return { ...info, provinces: PROVINCES.map((p) => ({ code: p.code, name: p.name, wards: p.wards.length })) };
    const province = provinceOf(city);
    if (!province) throw new NotFoundException(`“${city.trim()}” không thuộc 34 tỉnh / thành phố hiện hành`);
    return { ...info, province: { code: province.code, name: province.name }, wards: province.wards.map((w) => w.name) };
  }

  /** Xem số kế tiếp mà không gọi nextval hoặc giữ chỗ; create() luôn cấp mã chính thức trong giao dịch. */
  async codePreview(actor: UserRow): Promise<{ school_code: string }> {
    this.assertTopAdmin(actor);
    const rows = await this.db.query<{ school_code: string }>(`
      WITH RECURSIVE candidates(n) AS (
        SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END
        FROM public.app_school_registration_code_seq
        UNION ALL
        SELECT n + 1 FROM candidates
        WHERE n < 99999999 AND EXISTS (
          SELECT 1 FROM public.app_schools WHERE school_code = lpad(n::text, 8, '0')
        )
      )
      SELECT lpad(n::text, 8, '0') AS school_code FROM candidates
      WHERE n <= 99999999 AND NOT EXISTS (
        SELECT 1 FROM public.app_schools WHERE school_code = lpad(n::text, 8, '0')
      ) LIMIT 1
    `);
    if (!rows.length) throw new ConflictException('Đã hết mã trường có thể cấp');
    return rows[0];
  }

  async list(f: { q?: string; name?: string; code?: string; city?: string; region?: string; users?: number; created?: string; active?: 'true' | 'false'; page?: number; limit?: number }) {
    const where: string[] = [], params: unknown[] = [];
    const add = (sql: string, v: unknown) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
    if (f.q?.trim()) {
      const found = searchDirectory(f.q, 20000).flatMap(entry => [entry.code, ...(entry.previous_codes ?? [])]);
      const start = params.length;
      params.push(`%${likeEscape(foldVi(f.q))}%`, `%${likeEscape(f.q.trim())}%`, found);
      where.push(`(lower(replace(replace(regexp_replace(normalize(s.name, NFD), '[̀-ͯ]', '', 'g'), 'Đ', 'D'), 'đ', 'd')) LIKE $${start + 1} ESCAPE '\\'
        OR s.school_code ILIKE $${start + 2} ESCAPE '\\' OR s.directory_code = ANY($${start + 3}::text[])
        OR (s.directory_code IS NULL AND s.school_code = ANY($${start + 3}::text[])))`);
    }
    // tỉnh / thành lưu theo tên hiện hành ("Hà Nội" → "Thành phố Hà Nội"); lọc nhận cả cách viết cũ còn trong dữ liệu
    if (f.city) add('s.city = ANY(?::text[])', [...new Set([f.city, currentCityName(f.city) ?? f.city])]);
    if (f.region) add('s.region = ?', f.region);
    if (f.name?.trim()) add("s.name ILIKE ? ESCAPE '\\'", `%${likeEscape(f.name.trim())}%`);
    if (f.code?.trim()) add("s.school_code ILIKE ? ESCAPE '\\'", `%${likeEscape(f.code.trim())}%`);
    if (f.users !== undefined) add('(SELECT count(*) FROM app_users u WHERE u.school_id=s.id AND u.deleted_at IS NULL) = ?', f.users);
    if (f.created?.trim()) add("to_char(s.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh','DD/MM/YYYY') ILIKE ? ESCAPE '\\'", `%${likeEscape(f.created.trim())}%`);
    if (f.active) add('s.is_active = ?', f.active === 'true');
    const condition = where.length ? where.join(' AND ') : 'TRUE';
    const page = f.page ?? 1, limit = f.limit ?? 30;
    const total = Number((await this.db.query<{ n: string }>(`SELECT count(*) AS n FROM app_schools s WHERE ${condition}`, params))[0].n);
    const items = await this.db.query(
      `SELECT s.*,
        (SELECT count(*)::int FROM app_users u WHERE u.school_id = s.id AND u.deleted_at IS NULL) AS users,
        (SELECT count(*)::int FROM app_users u WHERE u.school_id = s.id AND u.role = 'school_admin' AND u.deleted_at IS NULL) AS admins,
        (SELECT count(*)::int FROM app_users u WHERE u.school_id = s.id AND u.role = 'teacher' AND u.deleted_at IS NULL) AS teachers,
        (SELECT count(*)::int FROM app_users u WHERE u.school_id = s.id AND u.role = 'student' AND u.deleted_at IS NULL) AS students,
        (SELECT count(*)::int FROM app_classes c WHERE c.school_id = s.id) AS classes
       FROM app_schools s WHERE ${condition} ORDER BY s.name, s.id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit],
    );
    const places = await this.db.query<{ city: string | null; region: string | null }>('SELECT DISTINCT city, region FROM app_schools');
    const uniq = (v: Array<string | null>) => [...new Set(v.filter((x): x is string => !!x))].sort();
    return { items: items.map((row) => withLink(currentSchoolLogo(row as unknown as SchoolRow))), total, page, limit, facets: { cities: uniq(places.map((x) => x.city)), regions: uniq(places.map((x) => x.region)) } };
  }

  /** Gợi ý trường từ danh mục khi thêm trường: kèm cờ đã có trong hệ thống và đường dẫn sẽ được tạo */
  async directory(query: string, limit = 12, excludeSchoolId?: number): Promise<{ items: Array<DirectoryEntry & { exists: boolean; existing_code: string | null; matches_school: boolean; slug: string }>; duplicates: Array<{ id: number; school_code: string; name: string; region: string | null; city: string | null; directory_code: string | null }> }> {
    const found = searchDirectory(query, limit);
    // trường đã có cùng tên với chữ đang gõ (kể cả trường nhập tay chưa gắn danh mục): báo trước để không tạo thêm một trường nữa
    const typed = query.trim().length >= 3 ? query.trim() : '';
    const schools = await this.db.query<{ id: number; school_code: string; name: string; region: string | null; city: string | null; directory_code: string | null }>('SELECT id, school_code, name, region, city, directory_code FROM app_schools WHERE ($1::integer IS NULL OR id <> $1)', [excludeSchoolId ?? null]);
    const duplicates = typed ? schools.filter(s => nameWords(s.name) === nameWords(typed)) : [];
    const own = excludeSchoolId ? (await this.db.query<{ name: string; city: string | null }>('SELECT name, city FROM app_schools WHERE id = $1', [excludeSchoolId]))[0] : null;
    if (!found.length) return { items: [], duplicates };
    const stored = await this.db.query<{code: string; logo_sha256: string | null}>('SELECT code, logo_sha256 FROM public.app_school_directory WHERE code = ANY($1::text[])', [found.map(entry => entry.code)]);
    const logos = new Map(stored.map(row => [row.code, row.logo_sha256 ? `${config.publicApiUrl}/api/school-logos/${row.logo_sha256}.webp` : null]));
    const keys = found.flatMap(entry => [entry.code, ...(entry.previous_codes ?? [])]);
    const used = await this.db.query<{ school_code: string; directory_code: string | null }>('SELECT school_code, directory_code FROM app_schools WHERE ($2::integer IS NULL OR id <> $2) AND (directory_code = ANY($1::text[]) OR (directory_code IS NULL AND school_code = ANY($1::text[])))', [keys, excludeSchoolId ?? null]);
    const items = found.map(e => {
      const linked = used.find(row => [e.code, ...(e.previous_codes ?? [])].includes(row.directory_code ?? row.school_code));
      // trường nhập tay chưa gắn danh mục nhưng trùng tên và tỉnh/thành: vẫn là trường đã có
      const twin = linked ? null : schools.find(s => !s.directory_code && sameSchoolName(s, e));
      return { ...e, logo_url: logos.get(e.code) ?? null, exists: !!linked || !!twin, existing_code: linked?.school_code ?? twin?.school_code ?? null, matches_school: !!own && sameSchoolName(own, e), slug: schoolSlug({ school_code: e.code, name: e.name, region: e.region }) };
    });
    return { items, duplicates };
  }

  async detail(actor: UserRow, id: number) {
    return this.run(actor, async (q, scope) => {
      const school = (await q<SchoolRow>('SELECT * FROM app_schools WHERE id = $1 AND ($2::integer IS NULL OR id = $2)', [id, scope]))[0];
      if (!school) throw new NotFoundException('Không tìm thấy trường');
      const counts = (await q<Record<string, number>>(
        `SELECT count(*) FILTER (WHERE role = 'school_admin')::int AS admins, count(*) FILTER (WHERE role = 'teacher')::int AS teachers, count(*) FILTER (WHERE role = 'student')::int AS students
         FROM app_users WHERE school_id = $1 AND deleted_at IS NULL`, [id]))[0];
      const classes = (await q<{ n: number }>('SELECT count(*)::int AS n FROM app_classes WHERE school_id = $1', [id]))[0].n;
      // người tạo sớm nhất đứng đầu: là người liên hệ của trường (đồng bộ khi đổi người liên hệ, 18/11/2026)
      const admins = (await q('SELECT id, username, full_name, email, phone, birth_date, is_active, last_login_at FROM app_users WHERE school_id = $1 AND role = \'school_admin\' AND deleted_at IS NULL ORDER BY created_at, id', [id]));
      const year = (await q<YearRow>("SELECT y.*, CASE WHEN calendar_mode='national' THEN public.school_year_framework(label) END AS framework FROM app_school_years y WHERE school_id = $1 AND status = 'active'", [id]))[0] ?? null;
      return { ...withLink(currentSchoolLogo(school)), counts: { ...counts, classes }, admins, current_year: year };
    });
  }

  /**
   * Thêm trường (HK.AD.013). Từ 18/11/2026 giao diện không còn khai báo quản trị viên đầu tiên khi thêm trường (thêm sau ở mục Quản trị viên trường);
   * `admin` vẫn được nhận để client cũ tạo kèm tài khoản và thư cấp mật khẩu như trước.
   */
  async create(actor: UserRow, body: {
    school_code?: string; directory_code?: string; name: string; region?: string | null; city?: string | null; address?: string | null; contact_name?: string | null; contact_email?: string | null; contact_phone?: string | null;
    admin?: { full_name: string; email: string; phone?: string | null; birth_date?: string | null } | null;
  }) {
    this.assertTopAdmin(actor);
    const selected = body.directory_code ? directoryEntry(body.directory_code) : null;
    if (body.directory_code && !selected) throw new UnprocessableEntityException('Không tìm thấy trường được chọn trong danh mục');
    // Giữ tương thích client cũ; giao diện mới luôn bỏ school_code và dùng mã tự sinh.
    const manualCode = selected ? '' : normCode(body.school_code);
    if (body.school_code !== undefined && !selected && !manualCode) throw new UnprocessableEntityException('Mã số trường cần có chữ số');
    // khu vực: trường trong danh mục dùng tỉnh / thành của danh mục; phường / xã lấy của danh mục khi biết chắc, không thì quản trị viên chọn
    const place = selected
      ? (selected.region ? { city: selected.city, region: selected.region } : checkPlace(selected.city, body.region))
      : checkPlace(body.city, body.region);
    const address = trimOrNull(body.address) ?? selected?.address ?? (place.region ? composeAddress(selected?.street, place.region, place.city) : null);
    const first = body.admin ?? null;
    const email = first ? first.email.trim().toLowerCase() : null;
    // có số điện thoại và ngày sinh của quản trị viên thì tên đăng nhập và mật khẩu theo quy ước (QLY + viết tắt trường + tên + 4 số cuối; DongA + ngày sinh + @ + tên); không thì mật khẩu tạm ngẫu nhiên như trước
    const conventional = first && (first.phone || first.birth_date)
      ? schoolAdminCredentials(selected?.name ?? body.name, first.full_name, first.phone, first.birth_date) : null;
    const password = first ? conventional?.password ?? generatePassword() : null;
    const passwordHash = password ? await hashPassword(password) : null;
    return this.db.tx(async (q) => {
      if (selected) {
        await q('SELECT pg_advisory_xact_lock(9031, hashtext($1))', [selected.code]);
        const keys = [selected.code, ...(selected.previous_codes ?? [])];
        if ((await q('SELECT 1 FROM app_schools WHERE directory_code = ANY($1::text[]) OR (directory_code IS NULL AND school_code = ANY($1::text[]))', [keys])).length) throw new ConflictException('Trường được chọn đã có trong hệ thống');
      }
      // không tạo thêm một trường đã có: chọn từ danh mục thì chặn trường nhập tay chưa gắn danh mục cùng tên; nhập tay thì chặn mọi trường cùng tên và tỉnh/thành
      const candidate = { name: selected?.name ?? body.name, city: selected?.city ?? body.city };
      const twin = (await q<SchoolRow>('SELECT * FROM app_schools')).find(s => (!selected || !s.directory_code) && sameSchoolName(s, candidate));
      if (twin) throw new ConflictException(`Trường ${describeSchool(twin)} đã có trong hệ thống nên không tạo thêm. ${twin.directory_code ? '' : 'Hãy mở trường đó trong danh sách, bấm “Sửa” và chọn đúng trường trong danh mục để dùng logo chính thức.'}`.trim());
      const code = manualCode || (await q<{ code: string }>('SELECT public.next_school_registration_code() AS code'))[0].code;
      const logoHash = selected ? (await q<{logo_sha256: string | null}>('SELECT logo_sha256 FROM public.app_school_directory WHERE code = $1', [selected.code]))[0]?.logo_sha256 : null;
      if ((await q('SELECT 1 FROM app_schools WHERE school_code = $1', [code])).length) throw new ConflictException(`Mã trường ${code} đã có trong hệ thống`);
      if (email && (await q('SELECT 1 FROM app_users WHERE lower(email) = $1 AND deleted_at IS NULL', [email])).length) throw new ConflictException('Email quản trị viên đã được dùng cho một tài khoản khác');
      const school = (await q<SchoolRow>(
        `INSERT INTO app_schools (school_code, directory_code, name, region, city, address, contact_name, contact_email, contact_phone, logo_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [code, selected?.code ?? null, trimOrNull(selected?.name ?? body.name), place.region, place.city, address, trimOrNull(body.contact_name), trimOrNull(body.contact_email)?.toLowerCase() ?? null, trimOrNull(body.contact_phone), logoHash ? `${config.publicApiUrl}/api/school-logos/${logoHash}.webp` : null],
      ))[0];
      if (!first || !email || !password || !passwordHash) return { school: withLink(school), admin: null, temporary_password: null, mail: 'none' as const };
      const username = conventional ? await this.db.uniqueUsernameFrom(conventional.username, q) : await this.db.uniqueUsername(first.full_name, 'school_admin', q);
      let admin: UserRow;
      try {
        admin = await this.db.createUser({
          username, full_name: first.full_name, role: 'school_admin', class_name: null, password_hash: passwordHash, must_change_password: true,
          school_id: school.id, school_code: school.school_code, region: school.region, city: school.city, email, phone: trimOrNull(first.phone),
          birth_date: conventional ? parseDate(first.birth_date as string) : null,
        }, q);
      } catch (exc) {
        if (exc instanceof DuplicateUsername) throw new ConflictException('Tên đăng nhập của quản trị viên bị trùng, thử lại');
        throw exc;
      }
      // lưu mã hóa mật khẩu ban đầu để quản trị tổng xem trong "Mật khẩu tài khoản" đến khi quản trị viên tự đổi (migration 060)
      await q('UPDATE app_users SET initial_password_enc = $2 WHERE id = $1', [admin.id, sealPassword(password, config.authSecret)]);
      await this.mail.enqueue(q, {
        school_id: school.id, user_id: admin.id, batch_id: null, kind: 'bulk', to: email, subject: '[Đông A EDU] Kích hoạt tài khoản quản trị viên trường học',
        payload: { type: 'account', full_name: admin.full_name, username: conventional ? username.toUpperCase() : username, password, role: 'school_admin', school: school.name },
      });
      return { school: withLink(school), admin: toPublic(admin), temporary_password: password, mail: this.mail.configured ? 'queued' as const : 'not_configured' as const };
    }).then((result) => { this.mail.kick(); return result; });
  }

  async update(id: number, body: { directory_code?: string; link_only?: boolean; name?: string; region?: string | null; city?: string | null; address?: string | null; contact_name?: string | null; contact_email?: string | null; contact_phone?: string | null; logo_url?: string | null; is_active?: boolean }, outer?: Q) {
    // outer: chạy trong giao dịch có sẵn (Sửa thông tin trường của quản trị trường gộp với đổi người liên hệ – lỗi ở bước nào cũng không lưu gì)
    const run = async (q: Q) => {
      const old = (await q<SchoolRow>('SELECT * FROM app_schools WHERE id = $1 FOR UPDATE', [id]))[0];
      if (!old) throw new NotFoundException('Không tìm thấy trường');
      if (body.directory_code) {
        const selected = directoryEntry(body.directory_code);
        if (!selected) throw new UnprocessableEntityException('Không tìm thấy trường được chọn trong danh mục');
        await q('SELECT pg_advisory_xact_lock(9031, hashtext($1))', [selected.code]);
        const keys = [selected.code, ...(selected.previous_codes ?? [])];
        if ((await q('SELECT 1 FROM app_schools WHERE id <> $1 AND (directory_code = ANY($2::text[]) OR (directory_code IS NULL AND school_code = ANY($2::text[])))', [id, keys])).length) throw new ConflictException('Trường được chọn đã liên kết với trường khác trong hệ thống');
        const logo = (await q<{logo_sha256: string | null}>('SELECT logo_sha256 FROM app_school_directory WHERE code=$1', [selected.code]))[0]?.logo_sha256;
        const logoUrl = logo ? `${config.publicApiUrl}/api/school-logos/${logo}.webp` : body.logo_url ?? old.logo_url;
        // link_only: chỉ gắn trường với danh mục để lấy mã danh mục và logo chính thức, giữ nguyên tên, khu vực, địa chỉ đang dùng (đường dẫn riêng của trường không đổi)
        // phường / xã: của danh mục khi biết chắc; không thì phường / xã quản trị viên chọn, rồi phường / xã đang lưu nếu thuộc đúng tỉnh / thành
        const place = selected.region ? { city: selected.city, region: selected.region }
          : body.region ? checkPlace(selected.city, body.region)
            : { city: selected.city, region: findWard(selected.city, old.region)?.name ?? null };
        body = body.link_only
          ? { directory_code: selected.code, logo_url: logoUrl }
          : { ...body, directory_code: selected.code, name: selected.name, city: place.city, region: place.region,
            address: trimOrNull(body.address) ?? selected.address ?? (place.region ? composeAddress(selected.street, place.region, place.city) : old.address), logo_url: logoUrl };
      } else if (body.city !== undefined || body.region !== undefined) {
        // đổi tỉnh / thành hoặc phường / xã thì kiểm tra theo mô hình hai cấp; gửi lại đúng giá trị cũ (trường cũ còn ghi quận / huyện) thì không chặn
        const city = body.city !== undefined ? body.city : old.city, region = body.region !== undefined ? body.region : old.region;
        if (trimOrNull(city) !== old.city || trimOrNull(region) !== old.region) {
          const place = checkPlace(city, region);
          body = { ...body, city: place.city, region: place.region };
        }
      }
      const entries = Object.entries(body).filter(([k, v]) => ['directory_code', 'name', 'region', 'city', 'address', 'contact_name', 'contact_email', 'contact_phone', 'logo_url', 'is_active'].includes(k) && v !== undefined);
      if (entries.length) {
        const values = entries.map(([k, v]) => (typeof v === 'string' ? (k === 'contact_email' ? v.trim().toLowerCase() : v.trim().replace(/\s+/g, ' ')) || null : v));
        // ngày kết thúc: lúc vô hiệu hóa; bật lại thì xóa (migration 073, cùng câu lệnh để thỏa ràng buộc is_active / deactivated_at)
        const ending = body.is_active !== undefined && body.is_active !== old.is_active ? `, deactivated_at = ${body.is_active ? 'NULL' : 'now()'}` : '';
        await q(`UPDATE app_schools SET ${entries.map(([k], i) => `${k} = $${i + 2}`).join(', ')}${ending} WHERE id = $1`, [id, ...values]);
        // Vô hiệu hóa/kích hoạt lại trường: thu hồi mọi phiên đăng nhập của tài khoản thuộc trường
        if (body.is_active !== undefined && body.is_active !== old.is_active) await q('UPDATE app_users SET token_version = token_version + 1 WHERE school_id = $1', [id]);
        if (body.region !== undefined || body.city !== undefined) await q('UPDATE app_users SET region = s.region, city = s.city FROM app_schools s WHERE app_users.school_id = s.id AND s.id = $1', [id]);
      }
      return withLink((await q<SchoolRow>('SELECT * FROM app_schools WHERE id = $1', [id]))[0]);
    };
    return outer ? run(outer) : this.db.tx(run);
  }

  /**
   * Logo trường tải lên (thay ô "Logo riêng (liên kết https…)"): nhận ảnh PNG, JPEG, WEBP, GIF (base64 / data URL, tối đa 2 MB), loại tệp xác định bằng nội dung
   * thật (sharp đọc được mới nhận), thu về WebP tối đa 160px, lưu một bản theo SHA-256 trong app_school_logo_assets như logo danh mục và gắn vào trường.
   * `null` bỏ logo tải lên: trường trong danh mục quay về logo chính thức của danh mục, trường khác không có logo.
   */
  async setLogo(id: number, data: unknown): Promise<SchoolRow & { link: SchoolLink }> {
    if (data === null) return this.update(id, { logo_url: null });
    const raw = typeof data === 'string' ? data.replace(/^data:[^;,]*;base64,/, '').replace(/\s+/g, '') : '';
    if (!isBase64(raw) || raw.length > Math.ceil((LOGO_MAX_INPUT * 4) / 3) + 8) throw new BadRequestException('Hãy chọn một tệp ảnh PNG, JPEG, WEBP hoặc GIF tối đa 2 MB');
    const input = Buffer.from(raw, 'base64');
    if (!input.length || input.length > LOGO_MAX_INPUT) throw new BadRequestException('Hãy chọn một tệp ảnh PNG, JPEG, WEBP hoặc GIF tối đa 2 MB');
    let image: { data: Buffer; info: { width: number; height: number } };
    try {
      const meta = await sharp(input, { limitInputPixels: 40_000_000 }).metadata();
      if (!meta.format || !['png', 'jpeg', 'webp', 'gif'].includes(meta.format)) throw new Error(meta.format ?? 'unknown');
      let quality = 90;
      image = await sharp(input, { limitInputPixels: 40_000_000, animated: false }).rotate().resize(160, 160, { fit: 'inside', withoutEnlargement: true }).webp({ quality }).toBuffer({ resolveWithObject: true });
      while (image.data.length > LOGO_MAX_STORED && quality > 40) {
        quality -= 15;
        image = await sharp(input, { limitInputPixels: 40_000_000, animated: false }).rotate().resize(160, 160, { fit: 'inside', withoutEnlargement: true }).webp({ quality }).toBuffer({ resolveWithObject: true });
      }
    } catch {
      throw new BadRequestException('Logo chỉ nhận ảnh PNG, JPEG, WEBP hoặc GIF; không nhận tệp Word, Excel, PDF hay tệp khác');
    }
    if (image.data.length > LOGO_MAX_STORED || image.data.length < 16) throw new BadRequestException('Không thu nhỏ được ảnh này; hãy chọn ảnh khác');
    const sha = createHash('sha256').update(image.data).digest('hex');
    await this.db.query('INSERT INTO public.app_school_logo_assets (sha256, image_data, mime_type, width, height) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (sha256) DO NOTHING',
      [sha, image.data, 'image/webp', image.info.width, image.info.height]);
    return this.update(id, { logo_url: uploadedLogoUrl(sha) });
  }

  async setMyLogo(actor: UserRow, schoolId: number | null | undefined, data: unknown) {
    const id = this.target(actor, schoolId);
    await this.setLogo(id, data);
    return this.detail(actor, id);
  }

  /**
   * Xóa trường cùng toàn bộ dữ liệu của trường (HK.AD.016; theo yêu cầu quản trị tổng 08/11/2026 không còn chặn khi trường đã có dữ liệu):
   * tài khoản quản trị viên, giáo viên, học sinh của trường (kéo theo tiến độ, điểm, huy hiệu, bài làm... của họ qua khóa ngoại CASCADE),
   * năm học, khối, lớp, nội dung và cấu hình riêng của trường. Khóa ngoại app_users.school_id chỉ là SET NULL nên phải xóa tài khoản trước,
   * nếu không họ thành tài khoản mồ côi không thuộc trường nào. Không bao giờ xóa quản trị tổng. Nhật ký kiểm toán và nhật ký đăng nhập được giữ lại
   * (chỉ mất liên kết tới trường). Một giao dịch: lỗi ở đâu thì không xóa gì cả.
   */
  async remove(actor: UserRow, id: number): Promise<RemovedSchool> {
    this.assertTopAdmin(actor);
    return this.db.tx(async (q) => {
      const school = (await q<SchoolRow>('SELECT * FROM app_schools WHERE id = $1 FOR UPDATE', [id]))[0];
      if (!school) throw new NotFoundException('Không tìm thấy trường');
      const r = (await q<{ admins: number; teachers: number; students: number; classes: number; years: number }>(
        `SELECT (SELECT count(*)::int FROM app_users WHERE school_id = $1 AND role = 'school_admin') AS admins,
                (SELECT count(*)::int FROM app_users WHERE school_id = $1 AND role = 'teacher') AS teachers,
                (SELECT count(*)::int FROM app_users WHERE school_id = $1 AND role = 'student') AS students,
                (SELECT count(*)::int FROM app_classes WHERE school_id = $1) AS classes,
                (SELECT count(*)::int FROM app_school_years WHERE school_id = $1) AS years`, [id]))[0];
      // app_progress (tiến độ học) là bảng duy nhất theo user_id không có khóa ngoại tới app_users nên không tự đi theo tài khoản: xóa tường minh
      await q("DELETE FROM app_progress WHERE user_id IN (SELECT id FROM app_users WHERE school_id = $1 AND role <> 'root_admin')", [id]);
      await q("DELETE FROM app_users WHERE school_id = $1 AND role <> 'root_admin'", [id]);
      await q('DELETE FROM app_schools WHERE id = $1', [id]);
      return { id, school_code: school.school_code, name: school.name, ...r };
    });
  }

  // ------------------------------------------------------------------ thông tin trường của quản trị viên trường học (HK.QT.010–011)
  async mine(actor: UserRow) {
    return this.detail(actor, this.target(actor));
  }

  async updateMine(actor: UserRow, schoolId: number | null | undefined, body: { name?: string; address?: string | null; contact_name?: string | null; contact_email?: string | null; contact_phone?: string | null; contact_birth_date?: string | null; logo_url?: string | null; region?: string | null; city?: string | null }) {
    const id = this.target(actor, schoolId);
    const { name, address, logo_url, region, city } = body;
    // một giao dịch: thông tin trường + người liên hệ (cấp lại đăng nhập); người liên hệ sai thì tên / địa chỉ cũng không đổi
    const reissued = await this.db.tx(async (q) => {
      await this.update(id, { name, address, logo_url, region, city }, q);
      return this.syncContact(actor, id, body, q);
    });
    if (reissued) this.mail.kick();
    return { ...(await this.detail(actor, id)), reissued };
  }

  /**
   * Người liên hệ của trường = tài khoản quản trị viên trường đầu tiên (18/11/2026, người dùng chọn "cập nhật và cấp lại đăng nhập"): đổi họ tên / email /
   * điện thoại / ngày sinh người liên hệ thì hồ sơ tài khoản đổi theo, tên đăng nhập và mật khẩu được cấp lại theo quy ước (QLY… / DongA…@…), gửi email
   * mới và hiện ở "Mật khẩu tài khoản" của quản trị tổng; mọi phiên cũ của tài khoản đó bị thu hồi. Thông tin liên hệ cũ và danh tính tài khoản cũ được
   * lưu một năm trong kho dữ liệu đã xóa (app_deleted_records, loại "replaced", migration 076) – không lưu mật khẩu.
   */
  private async syncContact(actor: UserRow, id: number, body: { name?: string; contact_name?: string | null; contact_email?: string | null; contact_phone?: string | null; contact_birth_date?: string | null }, q: Q) {
    const sent = (k: keyof typeof body) => Object.prototype.hasOwnProperty.call(body, k) && body[k] !== undefined;
    if (!(['contact_name', 'contact_email', 'contact_phone', 'contact_birth_date'] as const).some(sent)) return null;
    {
      const school = (await q<SchoolRow>('SELECT * FROM app_schools WHERE id = $1 FOR UPDATE', [id]))[0];
      if (!school) throw new NotFoundException('Không tìm thấy trường');
      const admin = (await q<UserRow>("SELECT * FROM app_users WHERE school_id = $1 AND role = 'school_admin' AND deleted_at IS NULL ORDER BY created_at, id LIMIT 1 FOR UPDATE", [id]))[0] ?? null;
      const pick = (k: 'contact_name' | 'contact_email' | 'contact_phone', current: string | null) => (sent(k) ? trimOrNull(body[k]) : current);
      const contactName = pick('contact_name', school.contact_name), contactEmail = pick('contact_email', school.contact_email)?.toLowerCase() ?? null, contactPhone = pick('contact_phone', school.contact_phone);
      // để trống ngày sinh thì giữ ngày sinh đang có của tài khoản
      const birth = body.contact_birth_date ? parseDate(body.contact_birth_date) : admin?.birth_date ?? null;
      if (body.contact_birth_date && !birth) throw new UnprocessableEntityException('Ngày sinh người liên hệ không hợp lệ');
      const schoolChanged = contactName !== school.contact_name || contactEmail !== school.contact_email || contactPhone !== school.contact_phone;
      const adminChanged = !!admin && !!contactName && (contactName !== admin.full_name || (contactEmail ?? null) !== (admin.email ?? null) || (contactPhone ?? null) !== (admin.phone ?? null) || (birth ?? null) !== (admin.birth_date ?? null));
      if (!schoolChanged && !adminChanged) return null;
      if (adminChanged) {
        const nameErr = nameCaseError(contactName);
        if (nameErr) throw new UnprocessableEntityException(`Người liên hệ: ${nameErr}`);
        if (!contactEmail) throw new UnprocessableEntityException('Người liên hệ là quản trị viên trường nên cần email (nhận tên đăng nhập và mật khẩu mới)');
        if ((await q('SELECT 1 FROM app_users WHERE lower(email) = $1 AND deleted_at IS NULL AND id <> $2', [contactEmail, admin!.id])).length) throw new ConflictException(`Email ${contactEmail} đã được dùng cho một tài khoản khác`);
      }
      // lưu người liên hệ cũ và danh tính tài khoản cũ (không có mật khẩu) vào kho dữ liệu đã xóa, giữ một năm (chưa từng ghi người liên hệ và tài khoản không đổi thì không có gì để lưu)
      if (adminChanged || school.contact_name || school.contact_email || school.contact_phone) await q(`INSERT INTO public.app_deleted_records (operation_id, source_schema, source_table, record_key, row_data, related_data, actor_id, actor_name, actor_role, actor_school_id, school_id, route, delete_kind, deleted_at, expires_at)
               VALUES (gen_random_uuid(), 'public', 'app_schools', jsonb_build_object('id', $1::int), public.app_archive_redact($2::jsonb), public.app_archive_redact($3::jsonb), $4, $5, $6, $7, $1, 'PATCH /api/admin/school (người liên hệ)', 'replaced', now(), now() + interval '1 year')`,
        [id, JSON.stringify({ contact_name: school.contact_name, contact_email: school.contact_email, contact_phone: school.contact_phone }),
          admin && adminChanged ? JSON.stringify({ app_users: { id: admin.id, username: admin.username, full_name: admin.full_name, email: admin.email, phone: admin.phone, birth_date: admin.birth_date } }) : null,
          actor.id, actor.full_name, actor.role, actor.school_id ?? null]);
      await q('UPDATE app_schools SET contact_name = $2, contact_email = $3, contact_phone = $4 WHERE id = $1', [id, contactName, contactEmail, contactPhone]);
      if (!adminChanged || !admin) return null;
      // cấp lại tên đăng nhập + mật khẩu theo quy ước (cần điện thoại 10 số và ngày sinh)
      const creds = schoolAdminCredentials(school.name, contactName as string, contactPhone, birth);
      const username = creds.username.toLowerCase() === admin.username.toLowerCase() ? admin.username : await this.db.uniqueUsernameFrom(creds.username, q);
      await q('UPDATE app_users SET full_name = $2, email = $3, phone = $4, birth_date = $5, username = $6 WHERE id = $1', [admin.id, contactName, contactEmail, contactPhone, parseDate(birth as string), username.toLowerCase()]);
      await this.db.setPassword(admin.id, await hashPassword(creds.password), true, q);
      await q('UPDATE app_users SET initial_password_enc = $2 WHERE id = $1', [admin.id, sealPassword(creds.password, config.authSecret)]);
      const display = username.toUpperCase();
      await this.mail.enqueue(q, {
        school_id: id, user_id: admin.id, batch_id: null, kind: 'bulk', to: contactEmail as string, subject: '[Đông A EDU] Thông tin đăng nhập mới của quản trị viên trường học',
        payload: { type: 'account', full_name: contactName, username: display, password: creds.password, role: 'school_admin', school: school.name, reset: true },
      });
      return { user_id: admin.id, full_name: contactName as string, username: display, temporary_password: creds.password, email: contactEmail as string, mail: this.mail.configured ? 'queued' as const : 'not_configured' as const, self: admin.id === actor.id };
    }
  }

  // ------------------------------------------------------------------ năm học (HK.QT.012)
  async yearOptions() {
    const current = new Date(Date.now() + 7 * 3600000).getUTCFullYear();
    const rows = await this.db.query<{ framework: YearFramework }>(
      `SELECT public.school_year_framework(y::text || '-' || (y+1)::text) AS framework
       FROM generate_series(2020, $1::int) y ORDER BY y DESC`, [current + 2]);
    return { items: rows.filter(r => r.framework).map(r => ({ label: r.framework.label, framework: r.framework })) };
  }

  private async yearFramework(label: string): Promise<YearFramework> {
    const framework = (await this.db.query<{ framework: YearFramework | null }>('SELECT public.school_year_framework($1) AS framework', [label]))[0]?.framework;
    if (!framework) throw new UnprocessableEntityException('Năm học chưa có khung thời gian đã xác minh');
    return framework;
  }

  private async withYearFramework(q: Q, year: YearRow) {
    const framework = year.calendar_mode === 'national'
      ? (await q<{ framework: YearFramework }>('SELECT public.school_year_framework($1) AS framework', [year.label]))[0].framework : null;
    return { ...year, framework };
  }

  async years(actor: UserRow, schoolId?: number | null) {
    const id = this.target(actor, schoolId);
    return this.run(actor, async (q) => q<YearRow & { classes: number }>(
      `SELECT y.*, CASE WHEN y.calendar_mode='national' THEN public.school_year_framework(y.label) END AS framework,
        (SELECT count(*)::int FROM app_classes c WHERE c.year_id = y.id) AS classes FROM app_school_years y WHERE y.school_id = $1 ORDER BY y.label DESC`, [id]));
  }

  private validYear(label: string, starts_on: string, ends_on: string): void {
    const m = /^(\d{4})-(\d{4})$/.exec(label);
    if (!m || Number(m[2]) !== Number(m[1]) + 1) throw new UnprocessableEntityException('Năm học có dạng 2026-2027 (hai năm liên tiếp)');
    if (!(starts_on < ends_on)) throw new UnprocessableEntityException('Ngày bắt đầu phải trước ngày kết thúc');
  }

  /**
   * Học kỳ phải đặt đủ cả hai (hoặc để trống cả bốn ngày), nối tiếp nhau và nằm trong năm học: học kỳ 1 từ ngày bắt đầu năm học trở đi,
   * học kỳ 2 bắt đầu sau khi học kỳ 1 kết thúc và kết thúc không muộn hơn năm học. Lịch riêng còn được API hỗ trợ;
   * chế độ national lấy khoảng phân loại từ khung đã xác minh ở database, không nhận ngày do client suy đoán.
   */
  private validTerms(starts_on: string, ends_on: string, t: Record<(typeof TERM_KEYS)[number], string | null>): void {
    const given = TERM_KEYS.filter((k) => t[k]);
    if (!given.length) return;
    if (given.length !== TERM_KEYS.length) throw new UnprocessableEntityException('Hãy nhập đủ ngày bắt đầu và kết thúc của cả hai học kỳ, hoặc để trống cả bốn ô');
    const [a1, b1, a2, b2] = TERM_KEYS.map((k) => t[k] as string);
    if (a1 < starts_on) throw new UnprocessableEntityException('Học kỳ 1 phải bắt đầu từ ngày bắt đầu năm học trở đi');
    if (a1 > b1) throw new UnprocessableEntityException('Học kỳ 1 phải kết thúc sau ngày bắt đầu');
    if (b1 >= a2) throw new UnprocessableEntityException('Học kỳ 2 phải bắt đầu sau khi học kỳ 1 kết thúc');
    if (a2 > b2) throw new UnprocessableEntityException('Học kỳ 2 phải kết thúc sau ngày bắt đầu');
    if (b2 > ends_on) throw new UnprocessableEntityException('Học kỳ 2 phải kết thúc trước hoặc đúng ngày kết thúc năm học');
  }

  async createYear(actor: UserRow, body: { school_id?: number | null; label: string; starts_on?: string; ends_on?: string; calendar_mode?: 'national' | 'manual' } & YearTerms) {
    const schoolId = this.target(actor, body.school_id);
    const label = body.label.trim();
    const national = body.calendar_mode === 'national' || (!body.starts_on && !body.ends_on && body.calendar_mode !== 'manual');
    const dates = national ? await this.yearFramework(label) : body;
    if (!dates.starts_on || !dates.ends_on) throw new UnprocessableEntityException('Hãy nhập đủ ngày bắt đầu và kết thúc năm học');
    const starts_on = dates.starts_on, ends_on = dates.ends_on;
    this.validYear(label, starts_on, ends_on);
    const terms = Object.fromEntries(TERM_KEYS.map((k) => [k, dates[k] ?? null])) as Record<(typeof TERM_KEYS)[number], string | null>;
    this.validTerms(starts_on, ends_on, terms);
    return this.run(actor, async (q) => {
      if ((await q('SELECT 1 FROM app_school_years WHERE school_id = $1 AND label = $2', [schoolId, label])).length) throw new ConflictException(`Năm học ${label} đã có`);
      const year = (await q<YearRow>('INSERT INTO app_school_years (school_id, label, starts_on, ends_on, term1_starts_on, term1_ends_on, term2_starts_on, term2_ends_on, calendar_mode, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
        [schoolId, label, starts_on, ends_on, terms.term1_starts_on, terms.term1_ends_on, terms.term2_starts_on, terms.term2_ends_on, national ? 'national' : 'manual', actor.id]))[0];
      // 18/11/2026 (bỏ mục "Khối lớp" khỏi giao diện): năm học nào cũng tự có đủ bốn khối 6, 7, 8, 9 đang bật
      await this.ensureGrades(q, schoolId, label, actor.id);
      return this.withYearFramework(q, year);
    });
  }

  /** Bốn khối 6–9 của một năm học luôn có và đang bật (không còn bật / tắt / xóa khối trên giao diện) */
  private async ensureGrades(q: Q, schoolId: number, label: string, actorId: number | null) {
    await q(`INSERT INTO app_school_grades (school_id, school_year, grade, is_active, created_by) SELECT $1, $2, g, true, $3 FROM unnest($4::smallint[]) g
             ON CONFLICT (school_id, school_year, grade) DO UPDATE SET is_active = true, updated_at = now() WHERE NOT app_school_grades.is_active`, [schoolId, label, actorId, GRADES]);
  }

  private async yearOf(q: Q, actor: UserRow, id: number, lock = true): Promise<YearRow> {
    const scope = actor.role === 'school_admin' ? actor.school_id : null;
    const year = (await q<YearRow>(`SELECT * FROM app_school_years WHERE id = $1 AND ($2::integer IS NULL OR school_id = $2)${lock ? ' FOR UPDATE' : ''}`, [id, scope]))[0];
    if (!year) throw new NotFoundException('Không tìm thấy năm học');
    return year;
  }

  async updateYear(actor: UserRow, id: number, body: { label?: string; starts_on?: string; ends_on?: string; calendar_mode?: 'national' | 'manual' } & YearTerms) {
    return this.run(actor, async (q) => {
      const year = await this.yearOf(q, actor, id);
      if (year.status === 'ended') throw new ConflictException('Năm học đã kết thúc, không sửa được');
      const label = body.label?.trim() ?? year.label;
      const national = body.calendar_mode === 'national' || (year.calendar_mode === 'national' && body.calendar_mode !== 'manual' && !body.starts_on && !body.ends_on && !TERM_KEYS.some(k => body[k] !== undefined));
      const dates = national ? await this.yearFramework(label) : body;
      const starts_on = dates.starts_on ?? year.starts_on, ends_on = dates.ends_on ?? year.ends_on;
      this.validYear(label, starts_on, ends_on);
      // gửi bất kỳ ngày học kỳ nào (kể cả null) là thay cả bộ học kỳ; không gửi thì giữ học kỳ đang có và kiểm tra lại với ngày năm học mới
      const sent = TERM_KEYS.some((k) => dates[k] !== undefined);
      const terms = Object.fromEntries(TERM_KEYS.map((k) => [k, sent ? (dates[k] ?? null) : year[k]])) as Record<(typeof TERM_KEYS)[number], string | null>;
      this.validTerms(starts_on, ends_on, terms);
      if (label !== year.label) {
        const used = (await q<{ n: number }>('SELECT (SELECT count(*) FROM app_classes WHERE year_id = $1)::int AS n', [id]))[0].n;
        if (used) throw new ConflictException('Năm học đã có lớp nên không đổi được tên; chỉ sửa được ngày bắt đầu và kết thúc');
        if ((await q('SELECT 1 FROM app_school_years WHERE school_id = $1 AND label = $2 AND id <> $3', [year.school_id, label, id])).length) throw new ConflictException(`Năm học ${label} đã có`);
        await q('UPDATE app_school_grades SET school_year = $3 WHERE school_id = $1 AND school_year = $2', [year.school_id, year.label, label]);
      }
      const updated = (await q<YearRow>('UPDATE app_school_years SET label = $2, starts_on = $3, ends_on = $4, term1_starts_on = $5, term1_ends_on = $6, term2_starts_on = $7, term2_ends_on = $8, calendar_mode = $9, updated_at = now() WHERE id = $1 RETURNING *',
        [id, label, starts_on, ends_on, terms.term1_starts_on, terms.term1_ends_on, terms.term2_starts_on, terms.term2_ends_on, national ? 'national' : 'manual']))[0];
      return this.withYearFramework(q, updated);
    });
  }

  /** Kích hoạt năm học (mỗi trường chỉ một năm đang hoạt động; phải kết thúc năm đang hoạt động trước) */
  async activateYear(actor: UserRow, id: number) {
    return this.run(actor, async (q) => {
      const year = await this.yearOf(q, actor, id);
      if (year.status === 'ended') throw new ConflictException('Năm học đã kết thúc, không kích hoạt lại được');
      if (year.status === 'active') return year;
      const other = (await q<{ label: string }>("SELECT label FROM app_school_years WHERE school_id = $1 AND status = 'active'", [year.school_id]))[0];
      if (other) throw new ConflictException(`Năm học ${other.label} đang hoạt động. Hãy kết thúc năm học đó trước khi kích hoạt năm mới.`);
      // bật năm học là có sẵn khối 6, 7, 8, 9
      await this.ensureGrades(q, year.school_id, year.label, actor.id);
      return (await q<YearRow>("UPDATE app_school_years SET status = 'active', activated_at = now(), updated_at = now() WHERE id = $1 RETURNING *", [id]))[0];
    });
  }

  /** Kết thúc năm học: từ đó dữ liệu của năm học (lớp, học sinh trong lớp) không sửa được nữa */
  async endYear(actor: UserRow, id: number) {
    return this.run(actor, async (q) => {
      const year = await this.yearOf(q, actor, id);
      if (year.status !== 'active') throw new ConflictException(year.status === 'ended' ? 'Năm học đã kết thúc' : 'Chỉ kết thúc được năm học đang hoạt động');
      return (await q<YearRow>("UPDATE app_school_years SET status = 'ended', ended_at = now(), updated_at = now() WHERE id = $1 RETURNING *", [id]))[0];
    });
  }

  /** Dùng chung cho lớp, học sinh: năm học đã kết thúc không cho ghi thêm */
  async assertYearOpen(q: Q, yearId: number | null): Promise<void> {
    if (!yearId) return;
    const status = (await q<{ status: string }>('SELECT status FROM app_school_years WHERE id = $1', [yearId]))[0]?.status;
    if (status === 'ended') throw new ConflictException('Năm học đã kết thúc, không sửa được dữ liệu của năm học này');
  }

  // ------------------------------------------------------------------ khối lớp (HK.QT.013)
  async grades(actor: UserRow, yearId: number, schoolId?: number | null) {
    return this.run(actor, async (q) => {
      const year = await this.yearOf(q, actor, yearId, false);
      if (schoolId && year.school_id !== schoolId) throw new NotFoundException('Không tìm thấy năm học');
      const rows = await q<{ grade: number; is_active: boolean; classes: number; students: number }>(
        `SELECT g.grade, g.is_active,
           (SELECT count(*)::int FROM app_classes c WHERE c.year_id = $3 AND c.grade = g.grade) AS classes,
           (SELECT count(DISTINCT m.user_id)::int FROM app_class_members m JOIN app_classes c ON c.id = m.class_id WHERE c.year_id = $3 AND c.grade = g.grade) AS students
         FROM app_school_grades g WHERE g.school_id = $1 AND g.school_year = $2 ORDER BY g.grade`, [year.school_id, year.label, yearId]);
      return { year, grades: rows };
    });
  }

  async setGrade(actor: UserRow, body: { year_id: number; grade: number; is_active: boolean }) {
    return this.run(actor, async (q) => {
      const year = await this.yearOf(q, actor, body.year_id);
      if (year.status === 'ended') throw new ConflictException('Năm học đã kết thúc, không sửa được khối lớp');
      if (!(GRADES as readonly number[]).includes(body.grade)) throw new BadRequestException('Khối lớp từ 6 đến 9');
      if (!body.is_active) {
        const open = (await q<{ n: number }>('SELECT count(*)::int AS n FROM app_classes WHERE year_id = $1 AND grade = $2 AND is_active', [year.id, body.grade]))[0].n;
        if (open) throw new ConflictException(`Khối ${body.grade} còn ${open} lớp đang hoạt động; hãy lưu trữ các lớp trước khi tắt khối.`);
      }
      await q(
        `INSERT INTO app_school_grades (school_id, school_year, grade, is_active, created_by) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (school_id, school_year, grade) DO UPDATE SET is_active = EXCLUDED.is_active, updated_at = now()`,
        [year.school_id, year.label, body.grade, body.is_active, actor.id]);
      return { year_id: year.id, grade: body.grade, is_active: body.is_active };
    });
  }

  async removeGrade(actor: UserRow, yearId: number, grade: number): Promise<void> {
    await this.run(actor, async (q) => {
      const year = await this.yearOf(q, actor, yearId);
      if (year.status === 'ended') throw new ConflictException('Năm học đã kết thúc, không sửa được khối lớp');
      const classes = (await q<{ n: number }>('SELECT count(*)::int AS n FROM app_classes WHERE year_id = $1 AND grade = $2', [year.id, grade]))[0].n;
      if (classes) throw new ConflictException(`Khối ${grade} đã có ${classes} lớp; chỉ xóa được khối chưa có lớp.`);
      const done = await q('DELETE FROM app_school_grades WHERE school_id = $1 AND school_year = $2 AND grade = $3 RETURNING grade', [year.school_id, year.label, grade]);
      if (!done.length) throw new NotFoundException('Khối chưa được thêm vào năm học này');
    });
  }
}
