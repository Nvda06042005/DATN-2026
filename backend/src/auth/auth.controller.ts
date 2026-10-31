import { Body, Controller, Get, HttpCode, Patch, Post, Req, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { IsEmail, IsIn, IsOptional, IsString, IsUrl, Length, Matches, MaxLength } from 'class-validator';
import { DatabaseService, UserRow } from '../database/database.service';
import { AllowTempPassword, AuthGuard, CurrentUser } from './auth.guard';
import { AuthService, Portal, toPublic } from './auth.service';

class LoginDto {
  @IsString() @Length(1, 96) username: string;
  @IsString() @Length(1, 128) password: string;
  /** Trang đăng nhập: root_admin (/admin), school_admin (/school-manager-admin), teacher (/giao-vien), student (/hoc-sinh); "app" = /portal */
  @IsOptional() @IsIn(['root_admin', 'school_admin', 'teacher', 'student', 'app']) portal: Portal = 'app';
}

class GoogleLoginDto {
  @IsString() @Length(20, 4096) id_token: string;
  @IsOptional() @IsIn(['student', 'app']) portal: Portal = 'student';
}

/** Mật khẩu người dùng tự đặt: tối thiểu 8 ký tự, gồm cả chữ và số (HK.*.006) */
export const PASSWORD_POLICY = /^(?=.*\p{L})(?=.*\p{N}).{8,128}$/u;
export const PASSWORD_MESSAGE = 'Mật khẩu tối thiểu 8 ký tự, gồm cả chữ và số';

class ForgotPasswordDto {
  /** Tên đăng nhập, email hoặc mã người dùng của tài khoản (mọi vai trò) */
  @IsString() @Length(1, 254) identifier: string;
}

class ResetPasswordDto {
  @IsString() @Length(1, 254) identifier: string;
  @Matches(/^\d{6}$/, { message: 'Mã xác thực gồm 6 chữ số' }) otp: string;
  @Matches(PASSWORD_POLICY, { message: PASSWORD_MESSAGE }) new_password: string;
}

class SignupRequestDto {
  @IsEmail() @MaxLength(254) email: string;
}

class SignupCompleteDto {
  @IsEmail() @MaxLength(254) email: string;
  @Matches(/^\d{6}$/, { message: 'Mã xác thực gồm 6 chữ số' }) otp: string;
  @IsString() @Length(2, 80) full_name: string;
  @IsOptional() @IsString() @Length(2, 24) nickname?: string | null;
  @Matches(PASSWORD_POLICY, { message: PASSWORD_MESSAGE }) password: string;
}

class ProfileDto {
  @IsOptional() @IsString() @Length(2, 80) full_name?: string;
  @IsOptional() @IsEmail() @MaxLength(254) email?: string | null;
  @IsOptional() @Matches(/^[0-9+() .-]{8,20}$/, { message: 'Số điện thoại gồm 8–20 chữ số hoặc ký hiệu + ( ) - .' }) phone?: string | null;
  @IsOptional() @IsUrl({ protocols: ['https'], require_protocol: true }, { message: 'Ảnh đại diện phải là liên kết https' }) @MaxLength(500) avatar_url?: string | null;
  @IsOptional() @IsString() @MaxLength(300) bio?: string | null;
  @IsOptional() @IsString() @Length(2, 24) nickname?: string | null;
}

class ConfirmProfileDto {
  @IsOptional() @IsEmail() @MaxLength(254) email?: string | null;
}

class ChangePasswordDto {
  @IsString() @Length(1, 128) current_password: string;
  @Matches(PASSWORD_POLICY, { message: PASSWORD_MESSAGE }) new_password: string;
}

/** /api/auth: đăng nhập, đăng ký tự học, quên mật khẩu, hồ sơ, đổi mật khẩu (mọi vai trò) */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly db: DatabaseService,
  ) {}

  private ensureReady(): void {
    if (!this.db.ready) throw new ServiceUnavailableException('Kho tài khoản chưa sẵn sàng. Kiểm tra cấu hình cơ sở dữ liệu.');
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() body: LoginDto) {
    this.ensureReady();
    return this.auth.login(body.username, body.password, body.portal);
  }

  /** Đăng nhập bằng Google (HK.HS.002): chỉ học sinh có email Google trùng email trong hồ sơ */
  @Post('google')
  @HttpCode(200)
  google(@Body() body: GoogleLoginDto) {
    this.ensureReady();
    return this.auth.googleLogin(body.id_token, body.portal);
  }

  /** Đăng ký tự học bước 1: gửi OTP tới email; luôn trả {ok:true} để không lộ email nào đã có tài khoản */
  @Post('register/request')
  @HttpCode(200)
  async registerRequest(@Body() body: SignupRequestDto) {
    this.ensureReady();
    await this.auth.requestSignup(body.email);
    return { ok: true };
  }

  /** Đăng ký tự học bước 2: nhập OTP + họ tên + mật khẩu, tạo tài khoản học sinh không thuộc trường và đăng nhập luôn */
  @Post('register/verify')
  @HttpCode(200)
  registerVerify(@Body() body: SignupCompleteDto) {
    this.ensureReady();
    return this.auth.completeSignup(body.email, body.otp, body.full_name, body.password, body.nickname);
  }

  /** Quên mật khẩu (mọi vai trò): gửi mã OTP 6 chữ số tới email tài khoản; luôn trả {ok:true} để không lộ tài khoản nào có thật */
  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    this.ensureReady();
    await this.auth.forgotPassword(body.identifier);
    return { ok: true };
  }

  /** Đặt mật khẩu mới bằng OTP trong thư (dùng một lần, hiệu lực 5 phút, sai quá 5 lần thì vô hiệu) */
  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() body: ResetPasswordDto) {
    this.ensureReady();
    await this.auth.resetPassword(body.identifier, body.otp, body.new_password);
    return { ok: true };
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @AllowTempPassword()
  async logout(@Req() request: { headers: { authorization: string } }) {
    await this.auth.logout(request.headers.authorization.slice(7).trim());
    return { ok: true };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @AllowTempPassword()
  me(@CurrentUser() user: UserRow) {
    return toPublic(user);
  }

  /** Hồ sơ của chính mình: thông tin cá nhân, trường, lớp và các trường vai trò được tự sửa */
  @Get('profile')
  @UseGuards(AuthGuard)
  @AllowTempPassword()
  profile(@CurrentUser() user: UserRow) {
    return this.auth.profile(user);
  }

  @Patch('profile')
  @UseGuards(AuthGuard)
  @AllowTempPassword()
  updateProfile(@CurrentUser() user: UserRow, @Body() body: ProfileDto) {
    return this.auth.updateProfile(user, body as Record<string, string | null | undefined>);
  }

  /** Học sinh xác nhận hồ sơ ở lần đăng nhập đầu tiên (HK.HS.004) */
  @Post('confirm-profile')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @AllowTempPassword()
  confirmProfile(@CurrentUser() user: UserRow, @Body() body: ConfirmProfileDto) {
    return this.auth.confirmProfile(user, body.email);
  }

  @Post('change-password')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @AllowTempPassword()
  changePassword(@CurrentUser() user: UserRow, @Body() body: ChangePasswordDto) {
    return this.auth.changePassword(user, body.current_password, body.new_password);
  }
}
