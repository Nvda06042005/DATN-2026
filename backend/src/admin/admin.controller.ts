import { SecurityService } from '../auth/security.service';
import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, MaxLength, Min } from 'class-validator';
import { AuthGuard, CurrentUser, Roles } from '../auth/auth.guard';
import { Role, UserRow } from '../database/database.service';
import { SchoolService, UploadedXlsx } from './school.service';
import { MailService } from './mail.service';

const trimLower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() || undefined : value);
/** "  Đặng   Thu  Hà " -> "Đặng Thu Hà" */
const squash = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.split(/\s+/).filter(Boolean).join(' ') : value);

class SchoolQuery {
  @IsOptional() @Type(() => Number) @IsInt() school_id?: number;
}

class CreateSchoolDto {
  @IsString() @Length(1, 20) school_code: string;
  @IsString() @Length(2, 120) name: string;
  @IsOptional() @IsString() @MaxLength(80) region?: string | null;
  @IsOptional() @IsString() @MaxLength(80) city?: string | null;
}

class UpdateSchoolDto {
  @IsOptional() @IsString() @Length(2, 120) name?: string;
  @IsOptional() @IsString() @MaxLength(80) region?: string | null;
  @IsOptional() @IsString() @MaxLength(80) city?: string | null;
}

class UserQuery {
  @IsOptional() @IsString() @MaxLength(80) q?: string;
  @IsOptional() @Type(() => Number) @IsInt() school_id?: number;
  @IsOptional() @IsString() @MaxLength(80) region?: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsString() @MaxLength(9) school_year?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(6) @Max(9) grade?: number;
  @IsOptional() @IsIn(['root_admin', 'school_admin', 'teacher', 'student']) role?: Role;
  @IsOptional() @IsIn(['true', 'false']) active?: 'true' | 'false';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
}

class CreateUserDto {
  @Transform(squash) @IsString() @Length(2, 80) full_name: string;
  @IsIn(['root_admin', 'school_admin', 'teacher', 'student']) role: Role;
  @IsOptional() @Type(() => Number) @IsInt() school_id?: number | null;
  @IsOptional() @IsString() @MaxLength(40) class_name?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(6) @Max(9) grade?: number | null;
  @IsOptional() @IsString() @MaxLength(9) school_year?: string | null;
  @IsOptional() @IsEmail() email?: string | null;
  @IsOptional() @IsString() @MaxLength(40) user_code?: string | null;
  @IsOptional() @Transform(trimLower) @Matches(/^[a-z0-9._@-]{3,64}$/) username?: string | null;
  @IsOptional() @IsString() @Length(6, 128) password?: string | null;
}

class UpdateUserDto {
  @IsOptional() @Transform(squash) @IsString() @Length(2, 80) full_name?: string;
  @IsOptional() @IsString() @MaxLength(40) class_name?: string | null;
  @IsOptional() @IsBoolean() is_active?: boolean;
  @IsOptional() @IsEmail() email?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(6) @Max(9) grade?: number | null;
}

class RoleDto {
  @IsIn(['root_admin', 'school_admin', 'teacher', 'student']) role: Role;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) school_id?: number | null;
}
class SecurityQuery {
  @IsOptional() @IsString() @MaxLength(80) q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) school_id?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) user_id?: number;
  @IsOptional() @IsIn(['true','false']) success?: 'true' | 'false';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
class ClassQuery {
  @IsOptional() @IsIn(['PENDING', 'APPROVED', 'REJECTED']) status?: string;
}

class ReviewDto {
  @IsOptional() @IsString() @MaxLength(300) note?: string | null;
}

class BatchQuery {
  @IsOptional() @Type(() => Number) @IsInt() batch_id?: number;
}

/** Nhận file tối đa 2 MB trong bộ nhớ (không ghi ra đĩa) */
export const XLSX_UPLOAD = FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024, files: 1 } });

/**
 * /api/admin – hai cấp quản trị độc lập: quản trị tổng (toàn hệ thống, quản lý trường) và quản trị trường
 * (chỉ trường ghi trong token; truy vấn chạy dưới Row-Level Security của trường).
 */
@Controller('admin')
@UseGuards(AuthGuard)
@Roles('root_admin', 'school_admin')
export class AdminController {
  constructor(private readonly school: SchoolService, private readonly mail: MailService, private readonly security: SecurityService) {}

  /** Thống kê: số trường, giáo viên, học sinh từng khối 6–9 (quản trị trường: chỉ trường mình) */
  @Get('overview')
  overview(@CurrentUser() user: UserRow, @Query() query: SchoolQuery) {
    return this.school.overview(user, query.school_id);
  }

  // ------------------------------------------------------------------ trường
  @Post('schools')
  @Roles('root_admin')
  createSchool(@Body() body: CreateSchoolDto) {
    return this.school.createSchool(body);
  }

  @Patch('schools/:id')
  @Roles('root_admin')
  updateSchool(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateSchoolDto) {
    return this.school.updateSchool(id, body);
  }

  // ------------------------------------------------------------------ tài khoản
  @Get('users')
  users(@CurrentUser() user: UserRow, @Query() query: UserQuery) {
    return this.school.listUsers(user, query);
  }

  /** Cấp một tài khoản thủ công; mật khẩu tạm chỉ trả về một lần */
  @Post('users')
  create(@CurrentUser() user: UserRow, @Body() body: CreateUserDto) {
    return this.school.createUser(user, body);
  }

  @Get('users/:id')
  detail(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.school.userDetail(user, id); }

  @Patch('users/:id/role')
  assignRole(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: RoleDto) { return this.school.assignRole(user, id, body.role, body.school_id); }

  @Get('login-history')
  loginHistory(@CurrentUser() user: UserRow, @Query() query: SecurityQuery) { return this.security.events(user, 'login', query); }

  @Get('audit-history')
  auditHistory(@CurrentUser() user: UserRow, @Query() query: SecurityQuery) { return this.security.events(user, 'audit', query); }

  @Patch('users/:id')
  update(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: UpdateUserDto) {
    return this.school.updateUser(user, id, body);
  }

  @Post('users/:id/reset-password')
  @HttpCode(200)
  resetPassword(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) {
    return this.school.resetPassword(user, id);
  }

  /** Xóa = chuyển vào thùng rác 45 ngày (khôi phục được) */
  @Delete('users/:id')
  @HttpCode(204)
  async remove(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) {
    await this.school.trashUser(user, id);
  }

  @Get('trash')
  trash(@CurrentUser() user: UserRow) {
    return this.school.trash(user);
  }

  @Post('trash/:id/restore')
  @HttpCode(200)
  restore(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) {
    return this.school.restore(user, id);
  }

  @Delete('trash/:id')
  @HttpCode(204)
  async purge(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) {
    await this.school.purgeNow(user, id);
  }

  // ------------------------------------------------------------------ nhập file Excel mẫu
  @Post('import')
  @HttpCode(200)
  @UseInterceptors(XLSX_UPLOAD)
  importExcel(@CurrentUser() user: UserRow, @UploadedFile() file: UploadedXlsx | undefined) {
    return this.school.importExcel(user, file);
  }

  @Get('imports')
  imports(@CurrentUser() user: UserRow) {
    return this.school.imports(user);
  }

  @Get('imports/:id')
  importReport(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) {
    return this.school.importReport(user, id);
  }

  /** Dòng thiếu thông tin đang chờ bổ sung */
  @Get('incomplete')
  incomplete(@CurrentUser() user: UserRow) {
    return this.school.incomplete(user);
  }

  // ------------------------------------------------------------------ hàng đợi email
  @Get('outbox')
  outbox(@CurrentUser() user: UserRow) {
    return this.school.outbox(user);
  }

  @Post('outbox/test')
  @HttpCode(200)
  @Roles('root_admin')
  testMail() {
    return this.mail.sendTest();
  }

  @Post('outbox/retry')
  @HttpCode(200)
  retry(@CurrentUser() user: UserRow) {
    return this.school.retryFailed(user);
  }

  /** Tài khoản chưa gửi được thư (CSV, UTF-8 có BOM để Excel đọc đúng tiếng Việt) */
  @Get('outbox/credentials.csv')
  async credentials(@CurrentUser() user: UserRow, @Query() query: BatchQuery) {
    const csv = await this.school.pendingCredentialsCsv(user, query.batch_id);
    return new StreamableFile(Buffer.from(csv, 'utf8'), { type: 'text/csv; charset=utf-8', disposition: 'attachment; filename="tai-khoan-chua-gui.csv"' });
  }

  // ------------------------------------------------------------------ lớp học
  @Get('classes')
  classes(@CurrentUser() user: UserRow, @Query() query: ClassQuery) {
    return this.school.adminClasses(user, query.status);
  }

  @Post('classes/:id/approve')
  @HttpCode(200)
  approve(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: ReviewDto) {
    return this.school.reviewClass(user, id, true, body.note ?? null);
  }

  @Post('classes/:id/reject')
  @HttpCode(200)
  reject(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: ReviewDto) {
    return this.school.reviewClass(user, id, false, body.note ?? null);
  }
}
