import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Put, Query, StreamableFile, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser, Roles } from '../auth/auth.guard';
import { UserRow } from '../database/database.service';
import { DICTIONARY, ResearchService } from './research.service';

type Json = Record<string, any>;
const num = (v: unknown): number | undefined => (v === undefined || v === '' ? undefined : Number(v));

/**
 * /api/platform – nhóm thử nghiệm và dữ liệu nghiên cứu (Sprint 12). Khảo sát (/api/platform/surveys, survey-templates) đã xóa hẳn theo yêu cầu 16/11/2026;
 * các bảng khảo sát cũ giữ nguyên dữ liệu nhưng không còn API nào dùng.
 */
@Controller('platform')
@UseGuards(AuthGuard)
export class ResearchController {
  constructor(private readonly research: ResearchService) {}

  // ---------------------------------------------------------------------- nhóm thử nghiệm và nghiên cứu (HK.AD.077–079)
  @Get('experiments/groups') @Roles('root_admin', 'school_admin') groups(@CurrentUser() user: UserRow) { return this.research.groups(user); }
  @Post('experiments/groups') @Roles('root_admin', 'school_admin') @HttpCode(200) createGroup(@CurrentUser() user: UserRow, @Body() body: Json) { return this.research.createGroup(user, body); }
  @Put('experiments/groups/:id') @Roles('root_admin', 'school_admin') updateGroup(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.research.updateGroup(user, id, body); }
  @Delete('experiments/groups/:id') @Roles('root_admin', 'school_admin') removeGroup(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.research.removeGroup(user, id); }
  @Get('experiments/classes') @Roles('root_admin', 'school_admin') classes(@CurrentUser() user: UserRow) { return this.research.classes(user); }
  @Put('experiments/classes/:id') @Roles('root_admin', 'school_admin') assign(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.research.assign(user, id, body.group_id); }
  @Get('research/dictionary') @Roles('root_admin', 'school_admin') dictionary() { return DICTIONARY; }
  @Get('research/compare') @Roles('root_admin', 'school_admin') compare(@CurrentUser() user: UserRow, @Query() q: Json) { return this.research.compare(user, { from: q.from, to: q.to, control: num(q.control) }); }
  @Get('research/export') @Roles('root_admin', 'school_admin')
  async exportCsv(@CurrentUser() user: UserRow, @Query() q: Json) {
    const f = await this.research.exportCsv(user, { from: q.from, to: q.to, group_id: num(q.group_id) });
    return new StreamableFile(f.data, { type: 'text/csv; charset=utf-8', disposition: `attachment; filename="${f.name}"` });
  }
}
