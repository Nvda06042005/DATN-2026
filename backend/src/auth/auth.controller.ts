import { Body, Controller, Get, HttpCode, Patch, Post, Req, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsEmail, IsIn, IsInt, IsOptional, IsString, IsUrl, Length, Matches, MaxLength } from 'class-validator';
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

/** Mật khẩu người dùng tự đặt: tối thiểu 8 ký tự, gồm cả chữ và số (HK.*.006) */
const PASSWORD_POLICY = /^(?=.*\p{L})(?=.*\p{N}).{8,128}$/u;
const PASSWORD_MESSAGE = 'Mật khẩu tối thiểu 8 ký tự, gồm cả chữ và số';

class ForgotPasswordDto {
  /** Tên đăng nhập hoặc email của tài khoản (mọi vai trò) */
  @IsString() @Length(1, 254) identifier: string;
}

class ResetPasswordDto {
  @IsString() @Length(1, 254) identifier: string;
  @Matches(/^\d{6}$/, { message: 'Mã xác thực gồm 6 chữ số' }) otp: string;
  @Matches(PASSWORD_POLICY, { message: PASSWORD_MESSAGE }) new_password: string;
}

class ProfileDto {
  @IsOptional() @IsString() @Length(2, 80) full_name?: string;
  @IsOptional() @IsEmail() @MaxLength(254) email?: string | null;
  @IsOptional() @Matches(/^[0-9+() .-]{8,20}$/, { message: 'Số điện thoại gồm 8–20 chữ số hoặc ký hiệu + ( ) - .' }) phone?: string | null;
  @IsOptional() @IsUrl({ protocols: ['https'], require_protocol: true }, { message: 'Ảnh đại diện phải là liên kết https' }) @MaxLength(500) avatar_url?: string | null;
  @IsOptional() @IsString() @MaxLength(300) bio?: string | null;
  @IsOptional() @IsString() @Length(2, 24) nickname?: string | null;
}

class ReadDto {
  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsInt({ each: true }) ids?: number[];
}

class ChangePasswordDto {
  @IsString() @Length(1, 128) current_password: string;
  @Matches(PASSWORD_POLICY, { message: PASSWORD_MESSAGE }) new_password: string;
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

  /** Quên mật khẩu (mọi vai trò): gửi mã OTP 6 chữ số tới email tài khoản; luôn trả {ok:true} để không lộ tài khoản nào có thật */
  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    if (!this.db.ready) throw new ServiceUnavailableException('Kho tài khoản chưa sẵn sàng. Kiểm tra cấu hình cơ sở dữ liệu.');
    await this.auth.forgotPassword(body.identifier);
    return { ok: true };
  }

  /** Đặt mật khẩu mới bằng OTP trong thư (dùng một lần, hiệu lực 5 phút, sai quá 5 lần thì vô hiệu) */
  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() body: ResetPasswordDto) {
    if (!this.db.ready) throw new ServiceUnavailableException('Kho tài khoản chưa sẵn sàng. Kiểm tra cấu hình cơ sở dữ liệu.');
    await this.auth.resetPassword(body.identifier, body.otp, body.new_password);
    return { ok: true };
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  async logout(@Req() request: { headers: { authorization: string } }) {
    await this.auth.logout(request.headers.authorization.slice(7).trim());
    return { ok: true };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: UserRow) {
    return toPublic(user);
  }

  /** Hồ sơ của chính mình: thông tin cá nhân, trường, lớp và các trường vai trò được tự sửa */
  @Get('profile')
  @UseGuards(AuthGuard)
  profile(@CurrentUser() user: UserRow) {
    return this.auth.profile(user);
  }

  @Patch('profile')
  @UseGuards(AuthGuard)
  updateProfile(@CurrentUser() user: UserRow, @Body() body: ProfileDto) {
    return this.auth.updateProfile(user, body as Record<string, string | null | undefined>);
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
