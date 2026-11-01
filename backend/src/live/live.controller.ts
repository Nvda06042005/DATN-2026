import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query, StreamableFile, UseGuards } from '@nestjs/common';
import * as QRCode from 'qrcode';
import { XLSX_MIME } from '../admin/excel';
import { AuthGuard, CurrentUser, Roles } from '../auth/auth.guard';
import { config } from '../config';
import { notFound } from '../content/access';
import { UserRow } from '../database/database.service';
import { LiveService, LiveView } from './live.service';
import { reportPdf, reportWorkbook } from './live.report';

type Json = Record<string, any>;

/**
 * /api/live – thi đấu trực tiếp (Sprint 8): giáo viên tạo phòng, điều khiển, xem báo cáo và xuất file; học sinh xem phòng đang mở, vào bằng mã PIN, trả lời, xem lại kết quả.
 * Các lệnh thời gian thực chính đi qua WebSocket (live.gateway.ts); các route này là đường dự phòng và để đồng bộ lại trạng thái khi kết nối lại.
 */
@Controller('live')
@UseGuards(AuthGuard)
export class LiveController {
  constructor(private readonly live: LiveService) {}

  /** Mã QR dẫn học sinh tới trang vào phòng với mã PIN đã điền sẵn */
  private async withJoin(view: LiveView) {
    const join_url = `${config.appUrl}/hoc-sinh?pin=${view.room.pin}`;
    return { ...view, join_url, qr: await QRCode.toDataURL(join_url, { margin: 1, width: 360, errorCorrectionLevel: 'M' }) };
  }

  // ------------------------------------------------------------------ giáo viên (HK.GV.051–058)
  @Post('rooms') @Roles('teacher') async create(@CurrentUser() user: UserRow, @Body() body: Json) { return this.withJoin(await this.live.create(user, body)); }
  @Get('rooms') @Roles('teacher') list(@CurrentUser() user: UserRow, @Query('class_id') classId?: string) { return this.live.list(user, classId ? Number(classId) : undefined); }
  @Get('rooms/:id') @Roles('teacher') async host(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.withJoin(await this.live.hostState(user, id)); }
  @Post('rooms/:id/command') @Roles('teacher') @HttpCode(200) command(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.live.command(user, id, String(body.action ?? '')); }
  @Get('rooms/:id/report') @Roles('teacher') report(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.live.report(user, id); }
  @Get('rooms/:id/export') @Roles('teacher')
  async export(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Query('format') format = 'xlsx') {
    if (format !== 'xlsx' && format !== 'pdf') throw notFound('định dạng xuất (xlsx hoặc pdf)');
    const report = await this.live.report(user, id);
    const name = `bao-cao-thi-dau-${id}.${format}`;
    return format === 'xlsx'
      ? new StreamableFile(await reportWorkbook(report), { type: XLSX_MIME, disposition: `attachment; filename="${name}"` })
      : new StreamableFile(await reportPdf(report), { type: 'application/pdf', disposition: `attachment; filename="${name}"` });
  }

  // ------------------------------------------------------------------ học sinh (HK.HS.079–085)
  @Get('open') @Roles('student') open(@CurrentUser() user: UserRow) { return this.live.open(user); }
  @Get('my') @Roles('student') my(@CurrentUser() user: UserRow) { return this.live.myMatches(user); }
  @Get('my/:id') @Roles('student') review(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.live.review(user, id); }
  @Get('lookup/:pin') @Roles('student') lookup(@CurrentUser() user: UserRow, @Param('pin') pin: string) { return this.live.lookup(user, pin); }
  @Post('join') @Roles('student') @HttpCode(200) join(@CurrentUser() user: UserRow, @Body() body: Json) { return this.live.join(user, body); }
  @Post('rooms/:id/profile') @Roles('student') @HttpCode(200) profile(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.live.setProfile(user, id, body); }
  @Post('rooms/:id/answer') @Roles('student') @HttpCode(200) answer(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.live.answer(user, id, { answer: body.answer, q_index: body.q_index }); }

  /** Đồng bộ lại trạng thái (sau khi mất kết nối): giáo viên chủ phòng hoặc học sinh đã vào phòng */
  @Get('rooms/:id/state') @Roles('teacher', 'student')
  async state(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) {
    const role = await this.live.role(user, id);
    if (!role) throw notFound('phòng thi');
    return role === 'host' ? this.live.hostState(user, id) : this.live.playerState(user, id);
  }
}
