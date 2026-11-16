import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Length, Min } from 'class-validator';
import { ClassService } from '../admin/class.service';
import { AuthGuard, CurrentUser, Roles } from '../auth/auth.guard';
import { UserRow } from '../database/database.service';

class JoinClassDto {
  /** Mã tham gia lớp: 6 ký tự ngẫu nhiên hoặc theo quy ước DongA + lớp + giáo viên + HK + năm học (không phân biệt hoa thường, bỏ qua dấu gạch) */
  @IsString() @Length(6, 80) code: string;
  /** Đăng ký ở trang của một lớp: mã phải đúng lớp này */
  @IsOptional() @IsInt() @Min(1) class_id?: number;
}

/** /api/student – chức năng của học sinh trong Sprint 1: tham gia lớp bằng mã (HK.HS.008) và xem các lớp đã tham gia */
@Controller('student')
@UseGuards(AuthGuard)
@Roles('student')
export class StudentController {
  constructor(private readonly classes: ClassService) {}

  @Post('join-class')
  @HttpCode(200)
  join(@CurrentUser() user: UserRow, @Body() body: JoinClassDto) {
    return this.classes.joinByCode(user, body.code, body.class_id ?? null);
  }

  /** Danh mục lớp của trường (trang Lớp học của học sinh) */
  @Get('class-catalog')
  catalog(@CurrentUser() user: UserRow) {
    return this.classes.catalog(user);
  }

  @Get('classes')
  mine(@CurrentUser() user: UserRow) {
    return this.classes.mine(user);
  }
}
