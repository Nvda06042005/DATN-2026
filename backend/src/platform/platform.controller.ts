import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Put, Query, StreamableFile, UseGuards, Patch } from '@nestjs/common';
import { AuthGuard, CurrentUser, Roles } from '../auth/auth.guard';
import { UserRow } from '../database/database.service';
import { NoticeService } from './notice.service';
import { PrefsService } from './prefs.service';
import { FaqService, SupportService } from './support.service';
import { SystemService } from './system.service';
import { TwoFactorService } from './twofa.service';

type Json = Record<string, any>;
const ALL = ['student', 'teacher', 'school_admin', 'root_admin'] as const;
const SENDERS = ['teacher', 'school_admin', 'root_admin'] as const;
const REQUESTERS = ['student', 'teacher', 'school_admin'] as const;

/**
 * /api/platform – phần dùng chung của mọi vai trò (Sprint 11): cấu hình công khai, tùy chọn cá nhân, thông báo, hướng dẫn, hỗ trợ và xác thực hai lớp.
 * Phần quản trị hệ thống nằm ở PlatformAdminController (cùng tiền tố).
 */
@Controller('platform')
@UseGuards(AuthGuard)
export class PlatformController {
  constructor(
    private readonly system: SystemService, private readonly prefs: PrefsService, private readonly notices: NoticeService,
    private readonly support: SupportService, private readonly faq: FaqService, private readonly twofa: TwoFactorService,
  ) {}

  // ---------------------------------------------------------------------- cấu hình công khai và cờ tính năng
  @Get('config') @Roles(...ALL)
  async config() { return { ...(await this.system.publicConfig()), flags: Object.fromEntries((await this.system.flags()).map((f: Json) => [f.key, f.enabled])) }; }

  // ---------------------------------------------------------------------- tùy chọn cá nhân (HK.HS.015, HK.HS.016)
  @Get('prefs') @Roles(...ALL) getPrefs(@CurrentUser() user: UserRow) { return this.prefs.get(user); }
  @Put('prefs') @Roles(...ALL) putPrefs(@CurrentUser() user: UserRow, @Body() body: Json) { return this.prefs.put(user, body); }

  // ---------------------------------------------------------------------- thông báo của tôi (HK.HS.106–107, HK.GV.077–078, HK.QT.053)
  @Get('notices') @Roles(...ALL) myNotices(@CurrentUser() user: UserRow, @Query() q: Json) { return this.notices.list(user, { category: q.category, unread: q.unread === 'true', page: q.page ? Number(q.page) : undefined }); }
  @Post('notices/read') @Roles(...ALL) @HttpCode(200) async read(@CurrentUser() user: UserRow, @Body() body: Json) { return this.notices.markRead(user, Array.isArray(body.ids) ? body.ids.map(Number).filter(Number.isInteger) : undefined); }
  @Post('notices/delete') @Roles(...ALL) @HttpCode(200) removeNotices(@CurrentUser() user: UserRow, @Body() body: Json) { return this.notices.remove(user, Array.isArray(body.ids) ? body.ids.map(Number).filter(Number.isInteger) : undefined); }

  // ---------------------------------------------------------------------- gửi thông báo (HK.GV.076, HK.QT.043, HK.AD.069)
  @Get('broadcasts') @Roles(...SENDERS) broadcasts(@CurrentUser() user: UserRow, @Query('status') status?: string) { return this.notices.broadcasts(user, { status }); }
  @Post('broadcasts') @Roles(...SENDERS) @HttpCode(200) createBroadcast(@CurrentUser() user: UserRow, @Body() body: Json) { return this.notices.create(user, body); }
  @Post('broadcasts/preview') @Roles(...SENDERS) @HttpCode(200) previewBroadcast(@CurrentUser() user: UserRow, @Body() body: Json) { return this.notices.preview(user, body); }
  @Put('broadcasts/:id') @Roles(...SENDERS) updateBroadcast(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.notices.update(user, id, body); }
  @Delete('broadcasts/:id') @Roles(...SENDERS) removeBroadcast(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.notices.removeBroadcast(user, id); }

  // ---------------------------------------------------------------------- hướng dẫn và câu hỏi thường gặp (HK.HS.110, HK.GV.080, HK.QT.054)
  @Get('faq') @Roles(...ALL) faqList(@CurrentUser() user: UserRow) { return this.faq.forUser(user); }

  // ---------------------------------------------------------------------- hỗ trợ (HK.HS.111, HK.GV.081, HK.QT.052, HK.AD.073–074)
  @Post('support') @Roles(...REQUESTERS) @HttpCode(200) createTicket(@CurrentUser() user: UserRow, @Body() body: Json) { return this.support.create(user, body); }
  @Get('support/mine') @Roles(...REQUESTERS) myTickets(@CurrentUser() user: UserRow) { return this.support.mine(user); }
  @Get('support') @Roles('root_admin') allTickets(@CurrentUser() user: UserRow, @Query() q: Json) { return this.support.list(user, { status: q.status, role: q.role, q: q.q, page: q.page ? Number(q.page) : undefined }); }
  @Get('support/:id') @Roles(...ALL) ticket(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.support.detail(user, id); }
  @Post('support/:id/reply') @Roles(...ALL) @HttpCode(200) replyTicket(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.support.reply(user, id, body); }
  @Patch('support/:id/status') @Roles('root_admin') ticketStatus(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.support.setStatus(user, id, body.status); }
  @Get('support/:id/attachment') @Roles(...ALL)
  async attachment(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) {
    const a = await this.support.attachment(user, id);
    return new StreamableFile(a.data, { type: a.mime, disposition: 'inline' });
  }

  // ---------------------------------------------------------------------- xác thực hai lớp (HK.AD.002)
  @Get('2fa') @Roles('school_admin', 'root_admin') twoFactorStatus(@CurrentUser() user: UserRow) { return this.twofa.status(user); }
  @Post('2fa/setup') @Roles('school_admin', 'root_admin') @HttpCode(200) twoFactorSetup(@CurrentUser() user: UserRow, @Body() body: Json) { return this.twofa.setup(user, body.method); }
  @Post('2fa/enable') @Roles('school_admin', 'root_admin') @HttpCode(200) twoFactorEnable(@CurrentUser() user: UserRow, @Body() body: Json) { return this.twofa.enable(user, String(body.code ?? '')); }
  @Post('2fa/disable') @Roles('school_admin', 'root_admin') @HttpCode(200) twoFactorDisable(@CurrentUser() user: UserRow, @Body() body: Json) { return this.twofa.disable(user, String(body.password ?? ''), String(body.code ?? '')); }
  @Post('2fa/backup-codes') @Roles('school_admin', 'root_admin') @HttpCode(200) twoFactorBackup(@CurrentUser() user: UserRow, @Body() body: Json) { return this.twofa.regenerateBackup(user, String(body.code ?? '')); }
  @Delete('2fa/users/:id') @Roles('root_admin') twoFactorReset(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.twofa.reset(user, id); }
}
