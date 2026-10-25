import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService, Role, UserRow } from '../database/database.service';
import { hashPassword, passwordFingerprint, verifyPassword } from './passwords';

export type PublicUser = Omit<UserRow, 'password_hash'>;
export const toPublic = ({ password_hash: _hash, ...user }: UserRow): PublicUser => user;

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

@Injectable()
export class AuthService {
  private readonly failed = new Map<string, { fails: number; since: number }>();

  constructor(
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
  ) {}

  /** Token JWT (HS256): sub = id tài khoản, sid = trường của tài khoản (lọc dữ liệu theo trường), pfp = dấu vân tay mật khẩu */
  createToken(user: UserRow): string {
    return this.jwt.sign({ sub: user.id, role: user.role, sid: user.school_id, pfp: passwordFingerprint(user.password_hash) });
  }

  /** Trả về tài khoản nếu token hợp lệ, tài khoản còn hoạt động, chưa vào thùng rác, cùng trường và mật khẩu chưa đổi kể từ khi cấp token */
  async authenticate(token: string): Promise<UserRow | null> {
    let payload: { sub?: number; sid?: number | null; pfp?: string };
    try {
      payload = this.jwt.verify(token);
    } catch {
      return null;
    }
    const user = typeof payload.sub === 'number' ? await this.db.getById(payload.sub) : null;
    if (!user || !user.is_active || user.deleted_at || payload.pfp !== passwordFingerprint(user.password_hash)) return null;
    if ((payload.sid ?? null) !== (user.school_id ?? null)) return null;
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
    this.checkLock(username);
    const user = await this.db.getByUsername(username);
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      this.failed.set(username, { fails: (this.failed.get(username)?.fails ?? 0) + 1, since: Date.now() });
      throw new UnauthorizedException('Sai tên đăng nhập hoặc mật khẩu');
    }
    if (user.deleted_at) throw new ForbiddenException('Tài khoản đang ở thùng rác. Liên hệ quản trị trường để khôi phục.');
    if (!user.is_active) throw new ForbiddenException('Tài khoản đã bị khóa. Liên hệ quản trị viên.');
    if (!ALLOWED[portal].includes(user.role)) throw new ForbiddenException(wrongPortal(user.role, portal));
    this.failed.delete(username);
    await this.db.touchLogin(user.id);
    const fresh = (await this.db.getById(user.id))!;
    return { token: this.createToken(fresh), user: toPublic(fresh) };
  }

  async changePassword(user: UserRow, currentPassword: string, newPassword: string) {
    if (!(await verifyPassword(currentPassword, user.password_hash))) throw new BadRequestException('Mật khẩu hiện tại không đúng');
    if (newPassword === currentPassword) throw new BadRequestException('Mật khẩu mới phải khác mật khẩu cũ');
    await this.db.setPassword(user.id, await hashPassword(newPassword), false);
    const updated = (await this.db.getById(user.id))!;
    // Token cũ mất hiệu lực vì dấu vân tay mật khẩu đổi -> cấp token mới
    return { token: this.createToken(updated), user: toPublic(updated) };
  }
}
