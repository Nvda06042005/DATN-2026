import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Put, Query, StreamableFile, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser, Roles } from '../auth/auth.guard';
import { UserRow } from '../database/database.service';
import { BackupService } from './backup.service';
import { FaqService } from './support.service';
import { LogsService } from './logs.service';
import { RbacService } from './rbac.service';
import { limiter } from './request-context';
import { SystemService } from './system.service';

type Json = Record<string, any>;
const num = (v: unknown): number | undefined => (v === undefined || v === '' ? undefined : Number(v));
const filter = (q: Json) => ({ q: q.q, school_id: num(q.school_id), user_id: num(q.user_id), success: q.success === 'true' || q.success === 'false' ? (q.success as 'true' | 'false') : undefined, page: num(q.page), limit: num(q.limit) });

/**
 * /api/platform (phần quản trị): cấu hình hệ thống, cờ tính năng, mẫu thư, giới hạn theo trường, phân quyền, nhật ký, sao lưu, giám sát và quản lý hướng dẫn.
 * Thao tác sửa cấu hình chỉ dành cho quản trị tổng cấp 1 (kiểm tra trong dịch vụ); cấp 2 chỉ xem.
 */
@Controller('platform')
@UseGuards(AuthGuard)
export class PlatformAdminController {
  constructor(
    private readonly system: SystemService, private readonly rbac: RbacService, private readonly logs: LogsService,
    private readonly backups: BackupService, private readonly faq: FaqService,
  ) {}

  // ---------------------------------------------------------------------- cấu hình chung (HK.AD.065) và cờ tính năng (HK.AD.071)
  @Get('settings') @Roles('root_admin') settings() { return this.system.settings(); }
  @Put('settings') @Roles('root_admin') updateSettings(@CurrentUser() user: UserRow, @Body() body: Json) { return this.system.updateSettings(user, body); }
  @Get('flags') @Roles('root_admin') flags() { return this.system.flags(); }
  @Put('flags/:key') @Roles('root_admin') setFlag(@CurrentUser() user: UserRow, @Param('key') key: string, @Body() body: Json) { return this.system.setFlag(user, key, body.enabled); }

  // ---------------------------------------------------------------------- mẫu thư (HK.AD.068)
  @Get('templates') @Roles('root_admin') templates() { return this.system.templates(); }
  @Put('templates/:key') @Roles('root_admin') saveTemplate(@CurrentUser() user: UserRow, @Param('key') key: string, @Body() body: Json) { return this.system.saveTemplate(user, key, body); }
  @Delete('templates/:key') @Roles('root_admin') resetTemplate(@CurrentUser() user: UserRow, @Param('key') key: string) { return this.system.resetTemplate(user, key); }

  // ---------------------------------------------------------------------- giới hạn theo trường (HK.AD.017)
  @Get('schools/:id/limits') @Roles('root_admin') limits(@Param('id', ParseIntPipe) id: number) { return this.system.schoolLimits(id); }
  @Put('schools/:id/limits') @Roles('root_admin') setLimits(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.system.setSchoolLimits(user, id, body); }

  // ---------------------------------------------------------------------- phân quyền (HK.AD.026)
  @Get('rbac') @Roles('root_admin') matrix() { return this.rbac.matrix(); }
  @Put('rbac') @Roles('root_admin') updateMatrix(@CurrentUser() user: UserRow, @Body() body: Json) { return this.rbac.update(user, body.changes); }

  // ---------------------------------------------------------------------- giám sát (HK.AD.010)
  @Get('health') @Roles('root_admin') health() { return this.system.health(limiter.stats(15)); }

  // ---------------------------------------------------------------------- nhật ký (HK.QT.051, HK.AD.027, HK.AD.075, HK.AD.076, HK.SYS.020)
  @Get('logs/audit') @Roles('school_admin', 'root_admin') audit(@CurrentUser() user: UserRow, @Query() q: Json) { return this.logs.audit(user, filter(q)); }
  @Get('logs/logins') @Roles('school_admin', 'root_admin') logins(@CurrentUser() user: UserRow, @Query() q: Json) { return this.logs.logins(user, filter(q)); }
  @Get('logs/errors') @Roles('root_admin') errors(@CurrentUser() user: UserRow, @Query() q: Json) { return this.logs.errors(user, { source: q.source, q: q.q, from: q.from, to: q.to, page: num(q.page), limit: num(q.limit) }); }
  @Delete('logs/errors') @Roles('root_admin') clearErrors(@CurrentUser() user: UserRow, @Query('older_than_days') days?: string) { return this.logs.clearErrors(user, Number(days ?? 30)); }

  // ---------------------------------------------------------------------- sao lưu và phục hồi (HK.AD.072, HK.SYS.019)
  @Get('backups') @Roles('root_admin') listBackups(@CurrentUser() user: UserRow) { return this.backups.list(user); }
  @Post('backups') @Roles('root_admin') @HttpCode(200) createBackup(@CurrentUser() user: UserRow, @Body() body: Json) { return this.backups.createManual(user, body.label ? String(body.label) : null); }
  @Get('backups/:id/download') @Roles('root_admin')
  async downloadBackup(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) {
    const f = await this.backups.download(user, id);
    return new StreamableFile(f.data, { type: 'application/gzip', disposition: `attachment; filename="${f.name}"` });
  }
  @Delete('backups/:id') @Roles('root_admin') removeBackup(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.backups.remove(user, id); }
  @Post('backups/:id/restore') @Roles('root_admin') @HttpCode(200) restoreBackup(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.backups.restore(user, id, body.confirm); }

  // ---------------------------------------------------------------------- quản lý hướng dẫn và câu hỏi thường gặp (HK.AD.067)
  @Get('faq/all') @Roles('root_admin') faqAll(@CurrentUser() user: UserRow) { return this.faq.all(user); }
  @Post('faq') @Roles('root_admin') @HttpCode(200) faqCreate(@CurrentUser() user: UserRow, @Body() body: Json) { return this.faq.create(user, body); }
  @Put('faq/:id') @Roles('root_admin') faqUpdate(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.faq.update(user, id, body); }
  @Delete('faq/:id') @Roles('root_admin') faqRemove(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.faq.remove(user, id); }
}
