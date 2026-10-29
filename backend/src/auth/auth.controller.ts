import { Body, Controller, Get, HttpCode, Post, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, Length } from 'class-validator';
import { SchoolService } from '../admin/school.service';
import { DatabaseService, UserRow } from '../database/database.service';
import { AuthGuard, CurrentUser } from './auth.guard';
import { AuthService, Portal, toPublic } from './auth.service';

class LoginDto {
  @IsString() @Length(1, 96) username: string;
  @IsString() @Length(1, 128) password: string;
  /** Trang đăng nhập: root_admin (/admin), school_admin (/school-manager-admin), teacher (/giao-vien), student (/hoc-sinh); "app" = /portal */
  @IsOptional() @IsIn(['root_admin', 'school_admin', 'teacher', 'student', 'app']) portal: Portal = 'app';
}

class ForgotPasswordDto {
  /** Tên đăng nhập hoặc email của tài khoản quản trị */
  @IsString() @Length(1, 254) identifier: string;
  @IsIn(['root_admin', 'school_admin']) portal: 'root_admin' | 'school_admin';
}

class ResetPasswordDto {
  @IsString() @Length(20, 200) token: string;
  @IsString() @Length(6, 128) new_password: string;
}

class ReadDto {
  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsInt({ each: true }) ids?: number[];
}

class ChangePasswordDto {
  @IsString() @Length(1, 128) current_password: string;
  @IsString() @Length(6, 128) new_password: string;
}

/** /api/auth: đăng nhập, xem phiên hiện tại, đổi mật khẩu, thông báo (mọi vai trò) */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly db: DatabaseService,
    private readonly school: SchoolService,
  ) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() body: LoginDto) {
    if (!this.db.ready) throw new ServiceUnavailableException('Kho tài khoản chưa sẵn sàng. Kiểm tra cấu hình cơ sở dữ liệu.');
    return this.auth.login(body.username, body.password, body.portal);
  }

  /** Quên mật khẩu (cổng quản trị): gửi liên kết đặt lại tới email tài khoản; luôn trả {ok:true} để không lộ tài khoản nào có thật */
  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    if (!this.db.ready) throw new ServiceUnavailableException('Kho tài khoản chưa sẵn sàng. Kiểm tra cấu hình cơ sở dữ liệu.');
    await this.auth.forgotPassword(body.identifier, body.portal);
    return { ok: true };
  }

  /** Đặt mật khẩu mới bằng mã trong thư (mã dùng một lần, hiệu lực 30 phút) */
  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() body: ResetPasswordDto) {
    if (!this.db.ready) throw new ServiceUnavailableException('Kho tài khoản chưa sẵn sàng. Kiểm tra cấu hình cơ sở dữ liệu.');
    await this.auth.resetPassword(body.token, body.new_password);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: UserRow) {
    return toPublic(user);
  }

  @Post('change-password')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  changePassword(@CurrentUser() user: UserRow, @Body() body: ChangePasswordDto) {
    return this.auth.changePassword(user, body.current_password, body.new_password);
  }

  /** Thông báo trong app (duyệt lớp, yêu cầu mở lớp...) – mới nhất trước */
  @Get('notifications')
  @UseGuards(AuthGuard)
  notifications(@CurrentUser() user: UserRow) {
    return this.school.notifications(user);
  }

  /** Đánh dấu đã đọc (không gửi ids = đọc hết) */
  @Post('notifications/read')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  async read(@CurrentUser() user: UserRow, @Body() body: ReadDto) {
    await this.school.markRead(user, body.ids ?? null);
    return { ok: true };
  }
}
