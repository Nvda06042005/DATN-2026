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
    if (!this.db.ready) throw new ServiceUnavailableException('Kho tài khoản chưa sẵn sàng. Kiểm tra cấu hình cơ sở dữ liệu.');
    const request = ctx.switchToHttp().getRequest();
    const header: string | undefined = request.headers.authorization;
    const user = header?.toLowerCase().startsWith('bearer ') ? await this.auth.authenticate(header.slice(7).trim()) : null;
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
