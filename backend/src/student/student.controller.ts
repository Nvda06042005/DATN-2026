import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { IsString, Length } from 'class-validator';
import { ClassService } from '../admin/class.service';
import { AuthGuard, CurrentUser, Roles } from '../auth/auth.guard';
import { UserRow } from '../database/database.service';

class JoinClassDto {
  /** Mã lớp 6 ký tự do giáo viên cung cấp (không phân biệt hoa thường) */
  @IsString() @Length(6, 12) code: string;
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
    return this.classes.joinByCode(user, body.code);
  }

  @Get('classes')
  mine(@CurrentUser() user: UserRow) {
    return this.classes.mine(user);
  }
}
