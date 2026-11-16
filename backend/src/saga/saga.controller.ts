import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { AuthGuard, CurrentUser, Roles } from '../auth/auth.guard';
import { UserRow } from '../database/database.service';
import { SagaService } from './saga.service';

class StartDto { @IsOptional() @IsBoolean() restart?: boolean; }
class ActionDto {
  /** Mã do trình duyệt sinh cho mỗi lệnh: gửi lặp cùng mã nhận lại kết quả cũ */
  @IsString() @Matches(/^[A-Za-z0-9_-]{8,64}$/) action_id: string;
  /** Số thứ tự của trạng thái mà lệnh này dựa vào */
  @Type(() => Number) @IsInt() @Min(0) seq: number;
  @IsObject() action: Record<string, any>;
}
class StatusDto {
  @IsIn(['draft', 'reviewed', 'published']) status: string;
  @IsOptional() @IsString() @MaxLength(600) note?: string;
}

/**
 * /api/saga – Hành trình Đông A của trang học sinh: bản đồ ba cuộc kháng chiến, 13 chặng (học ngắn, luyện tập, nhập vai khám phá, trận đánh), ôn tập,
 * thẻ nhân vật và kho tư liệu; báo cáo lớp cho giáo viên; chỉnh bản đồ và nội dung cho quản trị tổng. Đường dẫn tĩnh khai báo trước đường dẫn có :id.
 */
@Controller('saga')
@UseGuards(AuthGuard)
export class SagaController {
  constructor(private readonly saga: SagaService) {}

  // ------------------------------------------------------------------ học sinh
  @Get('home') @Roles('student') home(@CurrentUser() user: UserRow) { return this.saga.home(user); }
  @Get('campaigns/:no') @Roles('student') campaign(@CurrentUser() user: UserRow, @Param('no', ParseIntPipe) no: number) { return this.saga.campaign(user, no); }

  @Get('stages/:id') @Roles('student') stage(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.saga.stageDetail(user, id); }
  @Get('stages/:id/lesson') @Roles('student') lesson(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.saga.lesson(user, id); }
  @Post('stages/:id/lesson/complete') @Roles('student') @HttpCode(200) lessonDone(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.saga.completeLesson(user, id); }
  @Post('stages/:id/practice') @Roles('student') @HttpCode(200)
  practice(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: StartDto) { return this.saga.start(user, id, 'practice', Boolean(body.restart)); }
  @Post('stages/:id/explore') @Roles('student') @HttpCode(200)
  explore(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: StartDto) { return this.saga.start(user, id, 'explore', Boolean(body.restart)); }
  @Post('stages/:id/battle') @Roles('student') @HttpCode(200)
  battle(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: StartDto) { return this.saga.start(user, id, 'battle', Boolean(body.restart)); }
  @Get('stages/:id/summary') @Roles('student') summary(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.saga.summary(user, id); }

  @Get('sessions/:id') @Roles('student') session(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.saga.session(user, id); }
  @Post('sessions/:id/actions') @Roles('student') @HttpCode(200)
  act(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: ActionDto) { return this.saga.act(user, id, body); }

  @Get('review') @Roles('student') review(@CurrentUser() user: UserRow) { return this.saga.review(user); }
  @Post('review/start') @Roles('student') @HttpCode(200) startReview(@CurrentUser() user: UserRow, @Body() body: StartDto) { return this.saga.startReview(user, Boolean(body.restart)); }

  @Get('cards') @Roles('student') cards(@CurrentUser() user: UserRow) { return this.saga.cards(user); }
  @Get('archive') @Roles('student') archive(@CurrentUser() user: UserRow) { return this.saga.archive(user); }

  // ------------------------------------------------------------------ giáo viên, quản trị trường
  @Get('teacher/classes/:classId') @Roles('teacher', 'school_admin')
  classReport(@CurrentUser() user: UserRow, @Param('classId', ParseIntPipe) classId: number) { return this.saga.classReport(user, classId); }

  // ------------------------------------------------------------------ quản trị tổng
  @Get('admin/overview') @Roles('root_admin') adminOverview() { return this.saga.adminOverview(); }
  @Get('admin/stages/:id') @Roles('root_admin') adminStage(@Param('id', ParseIntPipe) id: number) { return this.saga.adminStage(id); }
  @Put('admin/maps/:no') @Roles('root_admin')
  adminMap(@CurrentUser() user: UserRow, @Param('no', ParseIntPipe) no: number, @Body() body: Record<string, any>) { return this.saga.adminUpdateMap(user, no, body); }
  @Put('admin/stages/:id/position') @Roles('root_admin')
  adminMove(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Record<string, any>) { return this.saga.adminMoveStage(user, id, body); }
  @Put('admin/stages/:id') @Roles('root_admin')
  adminUpdate(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Record<string, any>) { return this.saga.adminUpdateStage(user, id, body); }
  @Patch('admin/stages/:id/status') @Roles('root_admin')
  adminStatus(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: StatusDto) { return this.saga.adminSetStatus(user, id, body.status, body.note); }
  @Put('admin/items/:id') @Roles('root_admin')
  adminItem(@Param('id', ParseIntPipe) id: number, @Body() body: Record<string, any>) { return this.saga.adminUpdateItem(id, body); }
}
