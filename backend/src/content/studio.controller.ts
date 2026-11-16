import { Body, Controller, Delete, Get, Header, Headers, HttpCode, Param, Post, Query, Res, StreamableFile, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard, CurrentUser, Roles } from '../auth/auth.guard';
import { UserRow } from '../database/database.service';
import { MediaService } from './studio.service';

type Json = Record<string, any>;

/**
 * /api/content/media – kho ảnh, video, nhạc tải lên (HK.GV.085, 092–093) của giáo viên và quản trị tổng.
 * Trình soạn "Quiz (Kahoot-style)" (/api/content/studio) đã xóa hẳn theo yêu cầu 16/11/2026.
 */
@Controller('content')
@UseGuards(AuthGuard)
@Roles('teacher', 'root_admin')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('media') @HttpCode(200) upload(@CurrentUser() user: UserRow, @Body() body: Json) { return this.media.upload(user, body); }
  @Get('media-library') library(@CurrentUser() user: UserRow, @Query('q') q?: string) { return this.media.library(user, q); }
  @Delete('media/:token') removeMedia(@CurrentUser() user: UserRow, @Param('token') token: string) { return this.media.remove(user, token); }

}

/**
 * Tệp đã tải lên (ảnh, video, nhạc): công khai theo mã ngẫu nhiên 128 bit để thẻ <img>, <video>, <audio> của học sinh tải được mà không cần đăng nhập.
 * Có trả lời `Range` (HTTP 206) vì trình duyệt, nhất là Safari, chỉ phát và tua video khi máy chủ hỗ trợ.
 */
@Controller('content/media')
export class MediaFileController {
  constructor(private readonly media: MediaService) {}

  @Get(':token')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Content-Security-Policy', "default-src 'none'")
  @Header('Accept-Ranges', 'bytes')
  async file(@Param('token') token: string, @Headers('range') range: string | undefined, @Res({ passthrough: true }) res: Response) {
    const meta = await this.media.meta(token);
    const m = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
    if (m && (m[1] !== '' || m[2] !== '')) {
      // "bytes=a-b", "bytes=a-" (tới hết) hoặc "bytes=-n" (n byte cuối)
      const start = m[1] === '' ? Math.max(0, meta.size - Number(m[2])) : Number(m[1]);
      const end = m[1] === '' || m[2] === '' ? meta.size - 1 : Math.min(Number(m[2]), meta.size - 1);
      if (!Number.isFinite(start) || start >= meta.size || end < start) {
        res.status(416).setHeader('Content-Range', `bytes */${meta.size}`);
        return new StreamableFile(Buffer.alloc(0), { type: meta.mime });
      }
      const chunk = await this.media.slice(token, start, end - start + 1);
      res.status(206).setHeader('Content-Range', `bytes ${start}-${end}/${meta.size}`);
      return new StreamableFile(chunk, { type: meta.mime, length: chunk.length });
    }
    const f = await this.media.file(token);
    return new StreamableFile(f.data, { type: f.mime, length: f.data.length });
  }
}
