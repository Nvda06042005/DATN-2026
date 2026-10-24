import { Body, Controller, Get, HttpCode, Post, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import { DatabaseService, UserRow } from '../database/database.service';
import { AuthGuard, CurrentUser } from './auth.guard';
import { AuthService, toPublic } from './auth.service';

class LoginDto {
  @IsString() @Length(1, 64) username: string;
  @IsString() @Length(1, 128) password: string;
  /** Trang đăng nhập: admin (/admin), teacher (/giao-vien), student (/hoc-sinh); "app" = giáo viên hoặc học sinh */
  @IsOptional() @IsIn(['admin', 'teacher', 'student', 'app']) portal: 'admin' | 'teacher' | 'student' | 'app' = 'app';
}

class ChangePasswordDto {
  @IsString() @Length(1, 128) current_password: string;
  @IsString() @Length(6, 128) new_password: string;
}

/** /api/auth: đăng nhập, xem phiên hiện tại, đổi mật khẩu (mọi vai trò) */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly db: DatabaseService,
  ) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() body: LoginDto) {
    if (!this.db.ready) throw new ServiceUnavailableException('Kho tài khoản chưa sẵn sàng. Kiểm tra cấu hình cơ sở dữ liệu.');
    return this.auth.login(body.username, body.password, body.portal);
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
}
