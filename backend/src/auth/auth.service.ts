import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { MailService } from '../admin/mail.service';
import { SecurityService } from './security.service';
import { config } from '../config';
import { DatabaseService, Role, UserRow } from '../database/database.service';
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

/** Chống dò mật khẩu: khóa tạm 60 giây sau 5 lần sai liên tiếp */
const MAX_FAILS = 5;
const LOCK_MS = 60_000;

/** Quên mật khẩu: liên kết sống 30 phút; mỗi tên đăng nhập/email chỉ được yêu cầu 3 lần trong 15 phút (quá số lần vẫn trả lời như bình thường) */
const RESET_TTL_MIN = 30;
const RESET_MAX_ASKS = 3;
const RESET_WINDOW_MS = 15 * 60_000;
const RESET_MAP_LIMIT = 5000;
/** Trang chứa biểu mẫu đặt lại mật khẩu (mở bằng ?reset=<mã>) */
const RESET_PATH: Record<'root_admin' | 'school_admin', string> = { root_admin: '/admin', school_admin: '/school-manager-admin' };

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

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

  private checkLock(username: string): void {
    const entry = this.failed.get(username);
    if (!entry || entry.fails < MAX_FAILS) return;
    const elapsed = Date.now() - entry.since;
    if (elapsed < LOCK_MS) {
      throw new HttpException(`Sai quá nhiều lần. Thử lại sau ${Math.floor((LOCK_MS - elapsed) / 1000) + 1} giây.`, HttpStatus.TOO_MANY_REQUESTS);
    }
    this.failed.delete(username);
  }

  async login(rawUsername: string, password: string, portal: Portal) {
    const username = rawUsername.trim().toLowerCase();
    const user = await this.db.getByUsername(username);
    try { this.checkLock(username); } catch (error) { await this.security.login(user, username, portal, 'rate_limit'); throw error; }
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      this.failed.set(username, { fails: (this.failed.get(username)?.fails ?? 0) + 1, since: Date.now() });
      await this.security.login(user, username, portal, 'credentials');
      throw new UnauthorizedException('Sai tên đăng nhập hoặc mật khẩu');
    }
    if (user.deleted_at) { await this.security.login(user, username, portal, 'deleted'); throw new ForbiddenException('Tài khoản đang ở thùng rác. Liên hệ quản trị trường để khôi phục.'); }
    if (!user.is_active) { await this.security.login(user, username, portal, 'locked'); throw new ForbiddenException('Tài khoản đã bị khóa. Liên hệ quản trị viên.'); }
    if (!(await this.db.schoolActive(user.school_id))) { await this.security.login(user, username, portal, 'locked'); throw new ForbiddenException('Trường đang tạm ngưng hoạt động. Liên hệ quản trị tổng.'); }
    if (!ALLOWED[portal].includes(user.role)) { await this.security.login(user, username, portal, 'portal'); throw new ForbiddenException(wrongPortal(user.role, portal)); }
    this.failed.delete(username);
    const upgraded = needsPasswordUpgrade(user.password_hash) && Buffer.byteLength(password, 'utf8') <= 72 ? await hashPassword(password) : null;
    const fresh = await this.db.tx(async q => {
      const rows = await q('SELECT id FROM app_users WHERE id = $1 FOR UPDATE', [user.id]);
      const current = rows.length ? await this.db.getById(user.id, q) : null;
      if (!current || !current.is_active || current.deleted_at || current.password_hash !== user.password_hash || current.role !== user.role || current.school_id !== user.school_id || current.token_version !== user.token_version) throw new UnauthorizedException('Tài khoản vừa thay đổi. Hãy đăng nhập lại.');
      if (!(await this.db.schoolActive(current.school_id,q))) throw new ForbiddenException('Trường đang tạm ngưng hoạt động.');
      if (upgraded) await this.db.setPassword(user.id, upgraded, user.must_change_password, q);
      await q('UPDATE app_users SET last_login_at = now() WHERE id = $1', [user.id]);
      await this.security.login(current, username, portal, 'success', q);
      return (await this.db.getById(user.id, q))!;
    });
    return { token: this.createToken(fresh), user: toPublic(fresh) };
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
   * Quên mật khẩu (TM.AUTH.007): gửi liên kết đặt lại tới email của tài khoản quản trị. Luôn trả lời giống nhau dù tài khoản có tồn tại hay
   * không (không lộ tài khoản nào có thật); phần tạo mã và gửi thư chạy nền để thời gian trả lời không tiết lộ điều đó.
   */
  async forgotPassword(identifier: string, portal: 'root_admin' | 'school_admin'): Promise<void> {
    if (!this.mail.configured) throw new ServiceUnavailableException('Máy chủ chưa cấu hình gửi thư nên chưa gửi được liên kết đặt lại mật khẩu. Hãy liên hệ người quản lý hệ thống.');
    const key = identifier.trim().toLowerCase();
    if (!key || this.tooManyResets(key)) return;
    const user = await this.db.findForPasswordReset(key, ALLOWED[portal]);
    if (user?.email) void this.issueReset(user, user.email, portal).catch(() => this.logger.warn('Không gửi được thư đặt lại mật khẩu'));
  }

  private async issueReset(user: UserRow, email: string, portal: 'root_admin' | 'school_admin'): Promise<void> {
    const token = randomBytes(32).toString('base64url');
    await this.db.createPasswordReset(user.id, hashToken(token), RESET_TTL_MIN);
    await this.mail.sendPasswordReset(email, user.full_name, `${config.appUrl}${RESET_PATH[portal]}?reset=${token}`, RESET_TTL_MIN);
  }

  /** Đặt mật khẩu mới bằng mã trong thư: mã dùng được một lần; các phiên đăng nhập cũ mất hiệu lực vì dấu vân tay mật khẩu đổi */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const passwordHash = await hashPassword(newPassword);
    const userId = await this.db.consumePasswordReset(hashToken(token));
    const user = userId === null ? null : await this.db.getById(userId);
    if (!user || !user.is_active || user.deleted_at) throw new BadRequestException('Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Hãy yêu cầu liên kết mới.');
    await this.db.setPassword(user.id, passwordHash, false);
    this.failed.delete(user.username);
  }
}
