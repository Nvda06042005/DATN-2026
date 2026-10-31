import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, Logger, ServiceUnavailableException, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomInt, randomUUID } from 'crypto';
import { MailService } from '../admin/mail.service';
import { config } from '../config';
import { SecurityService } from './security.service';
import { DatabaseService, nowIso, Role, searchText, UserRow } from '../database/database.service';
import { hashPassword, needsPasswordUpgrade, passwordFingerprint, verifyPassword } from './passwords';

export type PublicUser = Omit<UserRow, 'password_hash' | 'token_version'>;
export const toPublic = ({ password_hash: _hash, token_version: _version, ...user }: UserRow): PublicUser => user;

/** Trang đăng nhập: hai cổng quản trị tách biệt, trang giáo viên, trang học sinh; "app" = giáo viên hoặc học sinh (/portal) */
export type Portal = 'root_admin' | 'school_admin' | 'teacher' | 'student' | 'app';

const ALLOWED: Record<Portal, Role[]> = {
  root_admin: ['root_admin'],
  school_admin: ['school_admin'],
  teacher: ['teacher'],
  student: ['student'],
  app: ['teacher', 'student'],
};

/** Lời nhắn khi đăng nhập nhầm trang; không chỉ đường tới cổng quản trị cho người học */
function wrongPortal(role: Role, portal: Portal): string {
  if (portal === 'root_admin' || portal === 'school_admin') return 'Trang này chỉ dành cho tài khoản quản trị được cấp quyền.';
  if (role === 'root_admin' || role === 'school_admin') return 'Tài khoản quản trị không đăng nhập ở trang học tập.';
  return role === 'teacher'
    ? 'Đây là tài khoản giáo viên – hãy đăng nhập tại trang giáo viên (/giao-vien).'
    : 'Đây là tài khoản học sinh – hãy đăng nhập tại trang học sinh (/hoc-sinh).';
}

/** Chống dò mật khẩu (HK.*.001): khóa tạm 15 phút sau 5 lần sai liên tiếp, tính theo tài khoản dù đăng nhập bằng tên, email hay mã */
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60_000;

/** Quên mật khẩu / đăng ký tự học: mã OTP 6 chữ số hiệu lực 5 phút; mỗi định danh chỉ được yêu cầu 3 lần trong 15 phút (quá số lần vẫn trả lời như bình thường) */
const OTP_TTL_MIN = 5;
const RESET_MAX_ASKS = 3;
const RESET_WINDOW_MS = 15 * 60_000;
const RESET_MAP_LIMIT = 5000;
const ALL_ROLES: Role[] = ['root_admin', 'school_admin', 'teacher', 'student'];
const OTP_INVALID = 'Mã xác thực không đúng hoặc đã hết hạn. Hãy yêu cầu mới.';

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');
/** Băm OTP kèm định danh để cùng một mã của hai người không trùng giá trị lưu */
const hashOtp = (id: number | string, otp: string): string => hashToken(`${id}:${otp}`);

/** Trường hồ sơ mỗi vai trò được tự sửa (HK.HS.010, HK.GV.006, HK.QT.005, HK.AD.005); họ tên, lớp, email học sinh/giáo viên do quản trị quản lý */
const PROFILE_FIELDS: Record<Role, string[]> = {
  student: ['nickname', 'avatar_url', 'bio'],
  teacher: ['phone', 'avatar_url', 'bio'],
  school_admin: ['full_name', 'email', 'phone', 'avatar_url'],
  root_admin: ['full_name', 'email', 'phone', 'avatar_url'],
};
const FIELD_LABEL: Record<string, string> = { full_name: 'họ tên', email: 'email', phone: 'số điện thoại', avatar_url: 'ảnh đại diện', bio: 'giới thiệu', nickname: 'biệt danh' };

export interface GoogleIdentity { email: string }

@Injectable()
export class AuthService {
  private readonly logger = new Logger('Auth');
  private readonly failed = new Map<string, { fails: number; since: number }>();
  private readonly resetAsks = new Map<string, number[]>();

  constructor(
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
    private readonly security: SecurityService,
  ) {}

  /** Token JWT (HS256): sub = id tài khoản, sid = trường của tài khoản (lọc dữ liệu theo trường), pfp = dấu vân tay mật khẩu */
  createToken(user: UserRow): string {
    return this.jwt.sign({ sub: user.id, role: user.role, sid: user.school_id, pfp: passwordFingerprint(user.password_hash), ver: user.token_version, jti: randomUUID() });
  }

  /** Trả về tài khoản nếu token hợp lệ, tài khoản còn hoạt động, chưa vào thùng rác, cùng trường và mật khẩu chưa đổi kể từ khi cấp token */
  async authenticate(token: string): Promise<UserRow | null> {
    let payload: { sub?: number; sid?: number | null; pfp?: string; ver?: number; role?: Role };
    try {
      payload = this.jwt.verify(token);
    } catch {
      return null;
    }
    const user = typeof payload.sub === 'number' ? await this.db.getById(payload.sub) : null;
    if (!user || !user.is_active || user.deleted_at || payload.pfp !== passwordFingerprint(user.password_hash)) return null;
    if ((payload.ver ?? 0) !== user.token_version || payload.role !== user.role) return null;
    if ((await this.db.query('SELECT 1 FROM app_revoked_tokens WHERE token_hash = $1 AND expires_at > now()', [hashToken(token)])).length) return null;
    if ((payload.sid ?? null) !== (user.school_id ?? null) || !(await this.db.schoolActive(user.school_id))) return null;
    return user;
  }

  private checkLock(key: string): void {
    const entry = this.failed.get(key);
    if (!entry || entry.fails < MAX_FAILS) return;
    const elapsed = Date.now() - entry.since;
    if (elapsed < LOCK_MS) {
      throw new HttpException(`Sai quá nhiều lần. Thử lại sau ${Math.ceil((LOCK_MS - elapsed) / 60_000)} phút.`, HttpStatus.TOO_MANY_REQUESTS);
    }
    this.failed.delete(key);
  }

  /** Kiểm tra trạng thái tài khoản sau khi đã xác thực danh tính (mật khẩu hoặc Google) và chọn đúng cổng đăng nhập */
  private async assertCanLogin(user: UserRow, username: string, portal: Portal): Promise<void> {
    if (user.deleted_at) { await this.security.login(user, username, portal, 'deleted'); throw new ForbiddenException('Tài khoản đang ở thùng rác. Liên hệ quản trị trường để khôi phục.'); }
    if (!user.is_active) {
      await this.security.login(user, username, portal, 'locked');
      throw new ForbiddenException(user.lock_reason ? `Tài khoản đã bị khóa. Lý do: ${user.lock_reason}` : 'Tài khoản đã bị khóa. Liên hệ quản trị viên.');
    }
    if (!(await this.db.schoolActive(user.school_id))) { await this.security.login(user, username, portal, 'locked'); throw new ForbiddenException('Trường đang tạm ngưng hoạt động. Liên hệ quản trị tổng.'); }
    if (!ALLOWED[portal].includes(user.role)) { await this.security.login(user, username, portal, 'portal'); throw new ForbiddenException(wrongPortal(user.role, portal)); }
  }

  /** Ghi nhận đăng nhập thành công trong một giao dịch, rồi cấp token; phát hiện tài khoản vừa bị đổi trong lúc đăng nhập */
  private async issueSession(user: UserRow, username: string, portal: Portal, upgradedHash: string | null) {
    const fresh = await this.db.tx(async q => {
      const rows = await q('SELECT id FROM app_users WHERE id = $1 FOR UPDATE', [user.id]);
      const current = rows.length ? await this.db.getById(user.id, q) : null;
      if (!current || !current.is_active || current.deleted_at || current.password_hash !== user.password_hash || current.role !== user.role || current.school_id !== user.school_id || current.token_version !== user.token_version) throw new UnauthorizedException('Tài khoản vừa thay đổi. Hãy đăng nhập lại.');
      if (!(await this.db.schoolActive(current.school_id, q))) throw new ForbiddenException('Trường đang tạm ngưng hoạt động.');
      if (upgradedHash) await this.db.setPassword(user.id, upgradedHash, user.must_change_password, q);
      await q('UPDATE app_users SET last_login_at = now() WHERE id = $1', [user.id]);
      await this.security.login(current, username, portal, 'success', q);
      return (await this.db.getById(user.id, q))!;
    });
    return { token: this.createToken(fresh), user: toPublic(fresh) };
  }

  async login(rawUsername: string, password: string, portal: Portal) {
    const username = rawUsername.trim().toLowerCase();
    const user = await this.db.findForLogin(username);
    // Khóa theo tài khoản (không theo chuỗi gõ) để đổi qua lại giữa tên đăng nhập, email và mã không né được giới hạn
    const lockKey = user ? `u${user.id}` : `n:${username}`;
    try { this.checkLock(lockKey); } catch (error) { await this.security.login(user, username, portal, 'rate_limit'); throw error; }
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      this.failed.set(lockKey, { fails: (this.failed.get(lockKey)?.fails ?? 0) + 1, since: Date.now() });
      await this.security.login(user, username, portal, 'credentials');
      throw new UnauthorizedException('Sai tên đăng nhập hoặc mật khẩu');
    }
    await this.assertCanLogin(user, username, portal);
    this.failed.delete(lockKey);
    const upgraded = needsPasswordUpgrade(user.password_hash) && Buffer.byteLength(password, 'utf8') <= 72 ? await hashPassword(password) : null;
    return this.issueSession(user, username, portal, upgraded);
  }

  /** Xác thực mã đăng nhập Google (HK.HS.002) bằng điểm kiểm tra của Google: chữ ký, hạn dùng, đúng ứng dụng, email đã xác minh */
  async verifyGoogleToken(idToken: string): Promise<GoogleIdentity> {
    if (!config.googleClientId) throw new ServiceUnavailableException('Chưa cấu hình đăng nhập bằng Google.');
    let res: Response;
    try {
      res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`, { signal: AbortSignal.timeout(10_000) });
    } catch {
      throw new ServiceUnavailableException('Không kết nối được Google. Thử lại sau.');
    }
    const body = res.ok ? ((await res.json().catch(() => null)) as { aud?: string; email?: string; email_verified?: string | boolean } | null) : null;
    if (!body || body.aud !== config.googleClientId || !body.email || String(body.email_verified) !== 'true') throw new UnauthorizedException('Đăng nhập Google không hợp lệ.');
    return { email: body.email.toLowerCase() };
  }

  /** Đăng nhập Google: chỉ học sinh, và email Google phải trùng email đã khai báo trong hồ sơ (mỗi email chỉ thuộc một tài khoản) */
  async googleLogin(idToken: string, portal: Portal) {
    const identity = await this.verifyGoogleToken(idToken);
    const user = await this.db.findByEmail(identity.email);
    const reject = async (): Promise<never> => {
      await this.security.login(user, identity.email, portal, 'credentials');
      throw new UnauthorizedException('Email Google này chưa được khai báo trong hồ sơ học sinh. Hãy nhờ nhà trường cập nhật email hoặc đăng nhập bằng mật khẩu.');
    };
    if (!user || user.role !== 'student') return reject();
    await this.assertCanLogin(user, identity.email, portal);
    return this.issueSession(user, identity.email, portal, null);
  }

  async logout(token: string): Promise<void> {
    const payload = this.jwt.verify<{ exp: number }>(token);
    await this.db.query('INSERT INTO app_revoked_tokens (token_hash, expires_at) VALUES ($1, to_timestamp($2)) ON CONFLICT DO NOTHING', [hashToken(token), payload.exp]);
    await this.db.query('DELETE FROM app_revoked_tokens WHERE expires_at <= now()');
  }

  async changePassword(user: UserRow, currentPassword: string, newPassword: string) {
    if (!(await verifyPassword(currentPassword, user.password_hash))) throw new BadRequestException('Mật khẩu hiện tại không đúng');
    if (newPassword === currentPassword) throw new BadRequestException('Mật khẩu mới phải khác mật khẩu cũ');
    const passwordHash = await hashPassword(newPassword);
    const updated = await this.db.tx(async q => {
      const rows = await q('UPDATE app_users SET password_hash = $1, must_change_password = 0, token_version = token_version + 1 WHERE id = $2 AND password_hash = $3 AND token_version = $4 AND is_active = 1 AND deleted_at IS NULL RETURNING id', [passwordHash, user.id, user.password_hash, user.token_version]);
      if (!rows.length) throw new UnauthorizedException('Phiên đã thay đổi. Hãy đăng nhập lại.');
      return (await this.db.getById(user.id, q))!;
    });
    // Token cũ mất hiệu lực vì dấu vân tay mật khẩu đổi -> cấp token mới
    return { token: this.createToken(updated), user: toPublic(updated) };
  }

  /** Bước xác nhận hồ sơ ở lần đăng nhập đầu tiên (HK.HS.004): học sinh kiểm tra họ tên, lớp, trường rồi xác nhận (kèm nhập email nếu hồ sơ chưa có) */
  async confirmProfile(user: UserRow, email?: string | null) {
    const clean = email?.trim().toLowerCase() || null;
    if (clean) await this.assertEmailFree(clean, user.id);
    await this.db.query('UPDATE app_users SET profile_confirmed_at = now(), email = COALESCE($2, email) WHERE id = $1', [user.id, clean]);
    const fresh = (await this.db.getById(user.id))!;
    await this.db.query('UPDATE app_users SET search_text = $1 WHERE id = $2', [searchText(fresh.full_name, fresh.username, fresh.user_code, fresh.email, fresh.class_name), user.id]);
    return this.profile((await this.db.getById(user.id))!);
  }

  /** Mỗi email chỉ thuộc một tài khoản còn dùng được: đăng nhập bằng email, quên mật khẩu và đăng nhập Google đều dựa vào điều này */
  private async assertEmailFree(email: string, exceptId: number | null): Promise<void> {
    const rows = await this.db.query('SELECT 1 FROM app_users WHERE lower(email) = $1 AND deleted_at IS NULL AND ($2::integer IS NULL OR id <> $2)', [email, exceptId]);
    if (rows.length) throw new ConflictException('Email này đã được dùng cho một tài khoản khác');
  }

  /** Quá số lần yêu cầu trong cửa sổ thời gian thì thôi (ghi nhận lần này nếu chưa quá) */
  private tooManyResets(key: string): boolean {
    const now = Date.now();
    if (this.resetAsks.size > RESET_MAP_LIMIT) this.resetAsks.clear();
    const recent = (this.resetAsks.get(key) ?? []).filter((t) => now - t < RESET_WINDOW_MS);
    if (recent.length >= RESET_MAX_ASKS) {
      this.resetAsks.set(key, recent);
      return true;
    }
    this.resetAsks.set(key, [...recent, now]);
    return false;
  }

  /**
   * Quên mật khẩu (HK.*.005), mọi vai trò: gửi mã OTP 6 chữ số tới email đã khai báo của tài khoản. Luôn trả lời giống nhau dù tài khoản có
   * tồn tại hay không (không lộ tài khoản nào có thật); phần tạo mã và gửi thư chạy nền để thời gian trả lời không tiết lộ điều đó.
   */
  async forgotPassword(identifier: string): Promise<void> {
    if (!this.mail.configured) throw new ServiceUnavailableException('Máy chủ chưa cấu hình gửi thư nên chưa gửi được mã xác thực. Hãy liên hệ người quản lý hệ thống.');
    const key = identifier.trim().toLowerCase();
    if (!key || this.tooManyResets(key)) return;
    const user = await this.db.findForPasswordReset(key, ALL_ROLES);
    if (user?.email) void this.issueOtp(user, user.email).catch(() => this.logger.warn('Không gửi được thư mã xác thực'));
  }

  private async issueOtp(user: UserRow, email: string): Promise<void> {
    const otp = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.db.createPasswordReset(user.id, hashOtp(user.id, otp), OTP_TTL_MIN);
    await this.mail.sendPasswordOtp(email, user.full_name, otp, OTP_TTL_MIN);
  }

  /** Đặt mật khẩu mới bằng OTP: mã dùng một lần, sai quá 5 lần thì bị vô hiệu; các phiên đăng nhập cũ mất hiệu lực vì dấu vân tay mật khẩu đổi */
  async resetPassword(identifier: string, otp: string, newPassword: string): Promise<void> {
    const passwordHash = await hashPassword(newPassword);
    const user = await this.db.findForPasswordReset(identifier.trim().toLowerCase(), ALL_ROLES);
    if (!user || !(await this.db.consumePasswordOtp(user.id, hashOtp(user.id, otp)))) throw new BadRequestException(OTP_INVALID);
    await this.db.setPassword(user.id, passwordHash, false);
    this.failed.delete(`u${user.id}`);
  }

  // ------------------------------------------------------------------ đăng ký tự học (HK.HS.003)
  /** Bước 1: gửi OTP tới email. Luôn trả lời giống nhau, kể cả khi email đã có tài khoản (không lộ email nào đã đăng ký) */
  async requestSignup(rawEmail: string): Promise<void> {
    if (!this.mail.configured) throw new ServiceUnavailableException('Máy chủ chưa cấu hình gửi thư nên chưa gửi được mã xác thực.');
    const email = rawEmail.trim().toLowerCase();
    if (this.tooManyResets(`signup:${email}`)) return;
    const taken = (await this.db.query('SELECT 1 FROM app_users WHERE lower(email) = $1 AND deleted_at IS NULL', [email])).length > 0;
    if (taken) return;
    const otp = String(randomInt(0, 1_000_000)).padStart(6, '0');
    void (async () => {
      await this.db.createSignupOtp(email, hashOtp(email, otp), OTP_TTL_MIN);
      await this.mail.sendPasswordOtp(email, email, otp, OTP_TTL_MIN, 'signup');
    })().catch(() => this.logger.warn('Không gửi được thư mã đăng ký'));
  }

  /** Bước 2: nhập OTP, họ tên và mật khẩu; tạo tài khoản học sinh tự học (không thuộc trường, không có lớp) và đăng nhập luôn */
  async completeSignup(rawEmail: string, otp: string, fullName: string, password: string, nickname?: string | null) {
    const email = rawEmail.trim().toLowerCase();
    const passwordHash = await hashPassword(password);
    const user = await this.db.tx(async q => {
      if (!(await this.db.consumeSignupOtp(email, hashOtp(email, otp), q))) throw new BadRequestException(OTP_INVALID);
      if ((await q('SELECT 1 FROM app_users WHERE lower(email) = $1 AND deleted_at IS NULL', [email])).length) throw new ConflictException('Email này đã được dùng cho một tài khoản khác');
      if (await this.db.getByUsername(email, q)) throw new ConflictException('Email này đã được dùng cho một tài khoản khác');
      return this.db.createUser({
        username: email, full_name: fullName, role: 'student', class_name: null, password_hash: passwordHash, must_change_password: false,
        email, nickname: nickname?.trim() || null, self_registered: true, profile_confirmed_at: nowIso(),
      }, q);
    });
    return this.issueSession(user, email, 'student', null);
  }

  // ------------------------------------------------------------------ hồ sơ cá nhân
  /** Hồ sơ của chính người dùng: thông tin cá nhân, trường, năm học hiện tại, các lớp (giáo viên: lớp phụ trách; học sinh: lớp đã tham gia) */
  async profile(user: UserRow) {
    const school = user.school_id ? (await this.db.query('SELECT id, school_code, name, logo_url, city FROM app_schools WHERE id = $1', [user.school_id]))[0] ?? null : null;
    const year = user.school_id ? (await this.db.query("SELECT id, label FROM app_school_years WHERE school_id = $1 AND status = 'active'", [user.school_id]))[0] ?? null : null;
    const classes = user.role === 'teacher'
      ? await this.db.query(`SELECT c.id, c.class_code, c.name, c.grade, c.school_year, c.is_active, c.join_code FROM app_class_teachers t JOIN app_classes c ON c.id = t.class_id
          WHERE t.teacher_id = $1 AND c.school_id = $2 ORDER BY c.school_year DESC, c.name`, [user.id, user.school_id])
      : user.role === 'student'
        ? await this.db.query(`SELECT c.id, c.class_code, c.name, c.grade, c.school_year, c.is_active,
            COALESCE((SELECT json_agg(u.full_name ORDER BY u.full_name) FROM app_class_teachers t JOIN app_users u ON u.id = t.teacher_id WHERE t.class_id = c.id), '[]'::json) AS teachers
            FROM app_class_members m JOIN app_classes c ON c.id = m.class_id WHERE m.user_id = $1 ORDER BY c.school_year DESC, c.name`, [user.id])
        : [];
    return { user: toPublic(user), school, school_year: year, classes, editable: PROFILE_FIELDS[user.role], needs_profile_confirmation: user.role === 'student' && !user.profile_confirmed_at };
  }

  /** Tự sửa hồ sơ trong các trường vai trò được phép; trường khác bị từ chối rõ ràng thay vì bỏ qua âm thầm */
  async updateProfile(user: UserRow, patch: Record<string, string | null | undefined>) {
    const allowed = PROFILE_FIELDS[user.role];
    const entries = Object.entries(patch).filter(([, v]) => v !== undefined) as Array<[string, string | null]>;
    for (const [key] of entries) if (!allowed.includes(key)) throw new UnprocessableEntityException(`Bạn không tự sửa được ${FIELD_LABEL[key] ?? key}; hãy nhờ quản trị viên.`);
    const clean = entries.map(([k, v]) => [k, typeof v === 'string' ? (v.trim().replace(/\s+/g, ' ') || null) : null] as [string, string | null]);
    if (clean.some(([k, v]) => k === 'full_name' && v === null)) throw new UnprocessableEntityException('Họ tên không được để trống');
    const email = clean.find(([k]) => k === 'email')?.[1];
    if (email) await this.assertEmailFree(email.toLowerCase(), user.id);
    if (clean.length) {
      const sets = clean.map(([k], i) => `${k} = $${i + 2}`);
      await this.db.query(`UPDATE app_users SET ${sets.join(', ')} WHERE id = $1`, [user.id, ...clean.map(([k, v]) => (k === 'email' && v ? v.toLowerCase() : v))]);
      const fresh = (await this.db.getById(user.id))!;
      await this.db.query('UPDATE app_users SET search_text = $1 WHERE id = $2', [searchText(fresh.full_name, fresh.username, fresh.user_code, fresh.email, fresh.class_name), user.id]);
    }
    return this.profile((await this.db.getById(user.id))!);
  }
}
