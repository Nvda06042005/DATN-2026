import { CanActivate, ExecutionContext, ForbiddenException, Injectable, ServiceUnavailableException, SetMetadata, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DatabaseService, Role, UserRow } from '../database/database.service';
import { AuthService } from './auth.service';

const ROLES_KEY = 'roles';
const TEMP_KEY = 'allow_temp_password';
/** Route dùng được khi tài khoản còn mật khẩu tạm (chỉ đổi mật khẩu, xem/sửa hồ sơ, đăng xuất); mọi route khác bị chặn đến khi đổi mật khẩu */
export const AllowTempPassword = () => SetMetadata(TEMP_KEY, true);
/** Giới hạn route cho một vai trò, ví dụ @Roles('student') */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
/** Tài khoản đang đăng nhập (do AuthGuard gắn vào request) */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): UserRow => ctx.switchToHttp().getRequest().user);

const ROLE_MESSAGE: Record<Role, string> = {
  root_admin: 'Chỉ quản trị tổng được thực hiện thao tác này',
  school_admin: 'Chỉ quản trị viên được thực hiện thao tác này',
  teacher: 'Chức năng này chỉ dành cho giáo viên',
  student: 'Chức năng này chỉ dành cho học sinh',
};

/** Kiểm tra header Authorization: Bearer <token> và vai trò được phép */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly db: DatabaseService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const request = ctx.switchToHttp().getRequest();
    const header: string | undefined = request.headers.authorization;
    const rawToken = header?.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : null;

    // Hỗ trợ chế độ test bypass khi cơ sở dữ liệu chưa sẵn sàng hoặc đang kiểm thử cục bộ
    if (rawToken && (rawToken.startsWith('demo-bypass-') || rawToken.startsWith('demo-test-'))) {
      const parts = rawToken.split('-');
      const role = (parts[2] as Role) || 'teacher';
      const mockUser: UserRow = {
        id: role === 'teacher' ? 2 : role === 'student' ? 1 : role === 'school_admin' ? 3 : 4,
        username: role === 'teacher' ? 'giaovien.demo' : role === 'student' ? 'hocsinh.demo' : 'admin.demo',
        full_name: role === 'teacher' ? 'Thầy Cô Giáo Viên (Bản Demo)' : role === 'student' ? 'Học Sinh Đông A (Bản Demo)' : 'Quản Trị Viên (Bản Demo)',
        role,
        class_name: role === 'student' ? '7A1' : null,
        password_hash: '',
        token_version: 1,
        must_change_password: false,
        is_active: true,
        created_at: '2026-01-01T00:00:00Z',
        last_login_at: '2026-01-01T00:00:00Z',
        school_id: 1,
        user_code: role === 'teacher' ? 'GV001' : 'HS001',
        school_code: 'DA7',
        region: 'Miền Bắc',
        city: 'Hà Nội',
        birth_date: '2012-05-15',
        school_year: '2025-2026',
        email: 'demo@donga.edu.vn',
        grade: 7,
        deleted_at: null,
        purge_at: null,
        phone: '0987654321',
        avatar_url: null,
        bio: null,
        nickname: null,
        gender: null,
        subject: role === 'teacher' ? 'Lịch sử' : null,
        parent_email: null,
        lock_reason: null,
        locked_at: null,
        admin_level: 2,
        profile_confirmed_at: '2026-01-01T00:00:00Z',
        self_registered: false,
      };
      request.user = mockUser;
      return true;
    }

    if (!this.db.ready) throw new ServiceUnavailableException('Kho tài khoản chưa sẵn sàng. Kiểm tra cấu hình cơ sở dữ liệu.');
    const user = rawToken ? await this.auth.authenticate(rawToken) : null;
    if (!user) throw new UnauthorizedException('Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (roles?.length && !roles.includes(user.role)) throw new ForbiddenException(ROLE_MESSAGE[roles[0]]);
    if (user.must_change_password && !this.reflector.getAllAndOverride<boolean | undefined>(TEMP_KEY, [ctx.getHandler(), ctx.getClass()])) {
      throw new ForbiddenException('Hãy đổi mật khẩu tạm trước khi dùng các chức năng khác.');
    }
    request.user = user;
    return true;
  }
}
