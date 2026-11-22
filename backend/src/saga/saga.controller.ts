import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Matches, Min, ValidateIf } from 'class-validator';
import { AuthGuard, CurrentUser, Roles } from '../auth/auth.guard';
import { UserRow } from '../database/database.service';
import { SagaService, WORLD_LOOK } from './saga.service';

class StartDto {
  @IsOptional() @IsBoolean() restart?: boolean;
  /** Lớp em đang học (thế giới khối: vào phòng chung của lớp này); máy chủ kiểm tra em có thuộc lớp không */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) class_id?: number;
}
/** Thứ tự sự kiện em xếp cho trang Sổ sử Đông A */
class BookDto { @IsArray() @ArrayMaxSize(8) @IsString({ each: true }) @Matches(/^[a-z0-9_]{1,24}$/, { each: true }) order: string[]; }
/** Tự tạo nhân vật trong thế giới khối (21/11/2026) */
class WorldLookDto {
  @IsIn([...WORLD_LOOK.gender]) gender: 'nam' | 'nu';
  @IsIn([...WORLD_LOOK.robe]) robe: string;
  @IsIn([...WORLD_LOOK.hat]) hat: string;
  @IsIn([...WORLD_LOOK.skin]) skin: string;
}
/** Trang bị khung ảnh đại diện / danh hiệu (null = bỏ trang bị) */
class EquipDto {
  @IsOptional() @ValidateIf((_o, v) => v !== null) @IsString() @Matches(/^[a-z0-9-]{2,40}$/) frame?: string | null;
  @IsOptional() @ValidateIf((_o, v) => v !== null) @IsString() @Matches(/^[a-z0-9-]{2,40}$/) title?: string | null;
  @IsOptional() @ValidateIf((_o, v) => v !== null) @IsString() @Matches(/^[a-z0-9-]{2,40}$/) avatar?: string | null;
}
class ActionDto {
  /** Mã do trình duyệt sinh cho mỗi lệnh: gửi lặp cùng mã nhận lại kết quả cũ */
  @IsString() @Matches(/^[A-Za-z0-9_-]{8,64}$/) action_id: string;
  /** Số thứ tự của trạng thái mà lệnh này dựa vào */
  @Type(() => Number) @IsInt() @Min(0) seq: number;
  @IsObject() action: Record<string, any>;
}

/**
 * /api/saga – Hành trình Đông A của trang học sinh: bản đồ ba cuộc kháng chiến, 13 chặng (học ngắn, luyện tập, nhập vai khám phá, trận đánh), ôn tập,
 * thẻ nhân vật và kho tư liệu. Chỉ dành cho học sinh: mục Hành trình Đông A của quản trị tổng và giáo viên đã xóa theo yêu cầu ngày 16/11/2026.
 * Đường dẫn tĩnh khai báo trước đường dẫn có :id.
 */
@Controller('saga')
@UseGuards(AuthGuard)
export class SagaController {
  constructor(private readonly saga: SagaService) {}

  // ------------------------------------------------------------------ học sinh
  @Get('home') @Roles('student') home(@CurrentUser() user: UserRow) { return this.saga.home(user); }
  @Get('campaigns/:no') @Roles('student') campaign(@CurrentUser() user: UserRow, @Param('no', ParseIntPipe) no: number) { return this.saga.campaign(user, no); }

  /** Khung ảnh đại diện và danh hiệu nhận từ hòm báu (17/11/2026) */
  @Get('cosmetics') @Roles('student') cosmetics(@CurrentUser() user: UserRow) { return this.saga.cosmetics(user); }
  @Post('cosmetics/equip') @Roles('student') @HttpCode(200) equip(@CurrentUser() user: UserRow, @Body() body: EquipDto) { return this.saga.equip(user, body); }
  /** Mở hòm báu trên bản đồ (17/11/2026) */
  @Post('chests/:key/open') @Roles('student') @HttpCode(200) openChest(@CurrentUser() user: UserRow, @Param('key') key: string) { return this.saga.openChest(user, key); }
  @Get('stages/:id') @Roles('student') stage(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.saga.stageDetail(user, id); }
  @Get('stages/:id/lesson') @Roles('student') lesson(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.saga.lesson(user, id); }
  @Post('stages/:id/lesson/complete') @Roles('student') @HttpCode(200) lessonDone(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.saga.completeLesson(user, id); }
  @Post('stages/:id/practice') @Roles('student') @HttpCode(200)
  practice(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: StartDto) { return this.saga.start(user, id, 'practice', Boolean(body.restart)); }
  @Post('stages/:id/explore') @Roles('student') @HttpCode(200)
  explore(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: StartDto) { return this.saga.start(user, id, 'explore', Boolean(body.restart), { classId: body.class_id }); }
  /** Nhân vật của em trong thế giới khối: xem / lưu lựa chọn */
  @Get('world/look') @Roles('student') worldLook(@CurrentUser() user: UserRow) { return this.saga.worldLook(user); }
  @Post('world/look') @Roles('student') @HttpCode(200) setWorldLook(@CurrentUser() user: UserRow, @Body() body: WorldLookDto) { return this.saga.setWorldLook(user, body); }
  /** Sổ sử Đông A: sắp xếp sự kiện sau mỗi cuộc kháng chiến */
  @Get('world/book') @Roles('student') worldBook(@CurrentUser() user: UserRow) { return this.saga.worldBook(user); }
  @Post('world/book/:no') @Roles('student') @HttpCode(200) submitBook(@CurrentUser() user: UserRow, @Param('no', ParseIntPipe) no: number, @Body() body: BookDto) { return this.saga.submitBook(user, no, body.order); }
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
}
