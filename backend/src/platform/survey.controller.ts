import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Put, Query, StreamableFile, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser, Roles } from '../auth/auth.guard';
import { UserRow } from '../database/database.service';
import { DICTIONARY, ResearchService } from './research.service';
import { SurveyService } from './survey.service';

type Json = Record<string, any>;
const num = (v: unknown): number | undefined => (v === undefined || v === '' ? undefined : Number(v));

/**
 * /api/platform – khảo sát (Sprint 12): người dùng trả lời, quản trị trường tạo và xem kết quả, quản trị tổng quản lý mẫu; cùng nhóm thử nghiệm và dữ liệu nghiên cứu của quản trị tổng.
 */
@Controller('platform')
@UseGuards(AuthGuard)
export class SurveyController {
  constructor(private readonly surveys: SurveyService, private readonly research: ResearchService) {}

  // ---------------------------------------------------------------------- trả lời (HK.HS.109, HK.GV.079)
  @Get('surveys/mine') @Roles('student', 'teacher') mine(@CurrentUser() user: UserRow) { return this.surveys.mine(user); }
  @Get('surveys/mine/:id') @Roles('student', 'teacher') form(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.surveys.form(user, id); }
  @Post('surveys/:id/respond') @Roles('student', 'teacher') @HttpCode(200) respond(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.surveys.respond(user, id, body); }

  // ---------------------------------------------------------------------- quản trị trường (HK.QT.049, HK.QT.050)
  @Get('surveys') @Roles('school_admin') list(@CurrentUser() user: UserRow) { return this.surveys.list(user); }
  @Post('surveys') @Roles('school_admin') @HttpCode(200) create(@CurrentUser() user: UserRow, @Body() body: Json) { return this.surveys.create(user, body); }
  @Get('surveys/:id') @Roles('school_admin', 'root_admin') detail(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.surveys.detail(user, id); }
  @Put('surveys/:id') @Roles('school_admin') update(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.surveys.update(user, id, body); }
  @Delete('surveys/:id') @Roles('school_admin') remove(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.surveys.remove(user, id); }
  @Get('surveys/:id/results') @Roles('school_admin', 'root_admin') results(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.surveys.results(user, id); }
  @Get('surveys/:id/export') @Roles('school_admin', 'root_admin')
  async exportRaw(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Query('format') format?: string) {
    if (format && format !== 'xlsx' && format !== 'csv') throw new BadRequestException('Định dạng là xlsx hoặc csv');
    const f = await this.surveys.exportRaw(user, id, format === 'csv' ? 'csv' : 'xlsx');
    return new StreamableFile(f.data, { type: f.type, disposition: `attachment; filename="${f.name}"` });
  }

  // ---------------------------------------------------------------------- mẫu khảo sát (HK.AD.070)
  @Get('survey-templates') @Roles('school_admin', 'root_admin') templates(@CurrentUser() user: UserRow) { return this.surveys.templates(user); }
  @Post('survey-templates') @Roles('root_admin', 'school_admin') @HttpCode(200) createTemplate(@CurrentUser() user: UserRow, @Body() body: Json) { return this.surveys.createTemplate(user, body); }
  @Put('survey-templates/:id') @Roles('root_admin', 'school_admin') updateTemplate(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.surveys.updateTemplate(user, id, body); }
  @Delete('survey-templates/:id') @Roles('root_admin', 'school_admin') removeTemplate(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.surveys.removeTemplate(user, id); }

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
