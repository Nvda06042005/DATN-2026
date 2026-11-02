import { Body, Controller, Delete, Get, Header, HttpCode, Param, ParseIntPipe, Post, Put, Query, StreamableFile, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser, Roles } from '../auth/auth.guard';
import { UserRow } from '../database/database.service';
import { MediaService, QuizStudioService } from './studio.service';

type Json = Record<string, any>;

/**
 * /api/content/studio và /api/content/media – trình soạn Quiz kiểu Kahoot và kho ảnh tải lên (ver0.2 Sprint 8, HK.GV.085–094).
 * Giáo viên và quản trị tổng soạn; bản nháp chỉ chủ bản nháp thấy.
 */
@Controller('content')
@UseGuards(AuthGuard)
@Roles('teacher', 'root_admin')
export class StudioController {
  constructor(private readonly studio: QuizStudioService, private readonly media: MediaService) {}

  @Post('media') @HttpCode(200) upload(@CurrentUser() user: UserRow, @Body() body: Json) { return this.media.upload(user, body); }
  @Get('media-library') library(@CurrentUser() user: UserRow, @Query('q') q?: string) { return this.media.library(user, q); }

  @Get('studio') drafts(@CurrentUser() user: UserRow) { return this.studio.list(user); }
  @Post('studio') @HttpCode(200) create(@CurrentUser() user: UserRow, @Body() body: Json) { return this.studio.create(user, body ?? {}); }
  @Get('studio/:id') draft(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.studio.get(user, id); }
  @Put('studio/:id') save(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.studio.save(user, id, body); }
  @Post('studio/:id/commit') @HttpCode(200) commit(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.studio.commit(user, id); }
  @Delete('studio/:id') remove(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.studio.remove(user, id); }
}

/** Ảnh đã tải lên: công khai theo mã ngẫu nhiên 128 bit để thẻ <img> của học sinh tải được mà không cần đăng nhập */
@Controller('content/media')
export class MediaFileController {
  constructor(private readonly media: MediaService) {}

  @Get(':token')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Content-Security-Policy', "default-src 'none'")
  async file(@Param('token') token: string) {
    const f = await this.media.file(token);
    return new StreamableFile(f.data, { type: f.mime });
  }
}
