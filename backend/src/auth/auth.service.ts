import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService, Role, UserRow } from '../database/database.service';
import { hashPassword, passwordFingerprint, verifyPassword } from './passwords';

export type PublicUser = Omit<UserRow, 'password_hash'>;
export const toPublic = ({ password_hash: _hash, ...user }: UserRow): PublicUser => user;

type Portal = 'admin' | 'teacher' | 'student' | 'app';

const WRONG_PORTAL: Record<Role, string> = {
  admin: 'Đây là tài khoản quản trị – hãy đăng nhập tại trang quản trị (/admin).',
  teacher: 'Đây là tài khoản giáo viên – hãy đăng nhập tại trang giáo viên (/giao-vien).',
  student: 'Đây là tài khoản học sinh – hãy đăng nhập tại trang học sinh (/hoc-sinh).',
};
const ALLOWED: Record<Portal, Role[]> = { admin: ['admin'], teacher: ['teacher'], student: ['student'], app: ['teacher', 'student'] };

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

  /** Token JWT (HS256): sub = id tài khoản, pfp = dấu vân tay mật khẩu hiện tại */
  createToken(user: UserRow): string {
    return this.jwt.sign({ sub: user.id, role: user.role, pfp: passwordFingerprint(user.password_hash) });
  }

  /** Trả về tài khoản nếu token hợp lệ, tài khoản còn hoạt động và mật khẩu chưa đổi kể từ khi cấp token */
  async authenticate(token: string): Promise<UserRow | null> {
    let payload: { sub?: number; pfp?: string };
    try {
      payload = this.jwt.verify(token);
    } catch {
      return null;
    }
    const user = typeof payload.sub === 'number' ? await this.db.getById(payload.sub) : null;
    if (!user || !user.is_active || payload.pfp !== passwordFingerprint(user.password_hash)) return null;
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
    if (!user.is_active) throw new ForbiddenException('Tài khoản đã bị khóa. Liên hệ quản trị viên.');
    if (!ALLOWED[portal].includes(user.role)) throw new ForbiddenException(WRONG_PORTAL[user.role]);
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
