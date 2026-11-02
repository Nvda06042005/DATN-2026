import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Put, Query, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard, CurrentUser, Roles } from '../auth/auth.guard';
import { UserRow } from '../database/database.service';
import { AiAdminService } from './ai-admin.service';
import { AiIndexService } from './ai-index.service';
import { AiSettingsService } from './ai-settings.service';
import { AiToolsService } from './ai-tools.service';
import { AiTutorService } from './ai-tutor.service';

type Json = Record<string, any>;
const ALL = ['student', 'teacher', 'school_admin', 'root_admin'] as const;
const STAFF = ['teacher', 'school_admin', 'root_admin'] as const;
const DOC_UPLOAD = FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024, files: 1 } });

/**
 * /api/ai – AI Tutor "Tiểu Tướng" (Sprint 9). Học sinh hỏi đáp, giải thích câu sai, tóm tắt, nhập vai, quản lý lịch sử và báo cáo sai; giáo viên hỏi đáp tư liệu, soạn câu hỏi,
 * soạn kịch bản tiết học, xem chủ đề học sinh hỏi (ẩn danh); quản trị tổng cấu hình mô hình, nguồn tri thức, chỉ mục, prompt, xem nhật ký, xử lý báo cáo, hạn mức.
 */
@Controller('ai')
@UseGuards(AuthGuard)
export class AiController {
  constructor(private readonly tutor: AiTutorService, private readonly tools: AiToolsService, private readonly admin: AiAdminService, private readonly index: AiIndexService, private readonly settings: AiSettingsService) {}

  // ---------------------------------------------------------------------- học sinh và giáo viên
  @Get('status') @Roles(...ALL) status(@CurrentUser() user: UserRow) { return this.tutor.status(user); }
  @Post('ask') @Roles(...ALL) @HttpCode(200) ask(@CurrentUser() user: UserRow, @Body() body: Json) { return this.tutor.ask(user, body); }
  @Post('explain') @Roles('student') @HttpCode(200) explain(@CurrentUser() user: UserRow, @Body() body: Json) { return this.tutor.explain(user, body); }
  @Post('summarize') @Roles(...ALL) @HttpCode(200) summarize(@CurrentUser() user: UserRow, @Body() body: Json) { return this.tutor.summarize(user, body); }
  @Get('summary/options') @Roles(...ALL) summaryOptions() { return this.tutor.summaryOptions(); }
  @Get('roleplay/figures') @Roles('student') figures() { return this.tutor.roleplayFigures(); }
  @Get('conversations') @Roles(...ALL) conversations(@CurrentUser() user: UserRow) { return this.tutor.conversations(user); }
  @Get('conversations/:id') @Roles(...ALL) conversation(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.tutor.conversationDetail(user, id); }
  @Delete('conversations/:id') @Roles(...ALL) @HttpCode(204) async removeConversation(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { await this.tutor.deleteConversation(user, id); }
  @Post('messages/:id/report') @Roles(...ALL) @HttpCode(200) report(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.tutor.report(user, id, body.reason); }

  // ---------------------------------------------------------------------- giáo viên
  @Post('teacher/question-drafts') @Roles('teacher', 'school_admin', 'root_admin') @HttpCode(200) drafts(@CurrentUser() user: UserRow, @Body() body: Json) { return this.tools.questionDrafts(user, body); }
  @Post('teacher/lesson-plan') @Roles('teacher', 'school_admin', 'root_admin') @HttpCode(200) plan(@CurrentUser() user: UserRow, @Body() body: Json) { return this.tools.lessonPlan(user, body); }
  @Get('teacher/topics') @Roles(...STAFF) topics(@CurrentUser() user: UserRow, @Query('days') days?: string) { return this.tools.topics(user, days ? Number(days) : undefined); }
  @Get('teacher/topic-groups') @Roles(...STAFF) topicGroups() { return this.tools.getTopicGroups(); }
  @Post('teacher/quiz-generate') @Roles(...STAFF) @HttpCode(200) generateQuiz(@CurrentUser() user: UserRow, @Body() body: Json) { return this.tools.generateQuiz(user, body); }

  // ---------------------------------------------------------------------- quản trị tổng
  @Get('admin/settings') @Roles('root_admin') settingsView() { return this.settings.publicView(); }
  @Put('admin/settings') @Roles('root_admin') updateSettings(@CurrentUser() user: UserRow, @Body() body: Json) { return this.settings.update(user, body); }
  @Post('admin/test') @Roles('root_admin') @HttpCode(200) test() { return this.admin.testConnection(); }
  @Get('admin/sources') @Roles('root_admin') sources() { return this.index.status(); }
  @Post('admin/reindex') @Roles('root_admin') @HttpCode(200) reindex(@Body() body: Json) { return this.index.sync({ force: body.force === true }); }
  @Post('admin/docs') @Roles('root_admin') @HttpCode(200) @UseInterceptors(DOC_UPLOAD)
  addDoc(@CurrentUser() user: UserRow, @Body() body: Json, @UploadedFile() file?: { originalname: string; buffer: Buffer; size: number }) {
    if (!file && !body.text) throw new BadRequestException('Hãy chọn tệp PDF, DOCX, TXT hoặc dán văn bản');
    return this.index.addDoc(user, body, file);
  }
  @Patch('admin/docs/:id') @Roles('root_admin') setDoc(@Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.index.setDocStatus(id, String(body.status)); }
  @Delete('admin/docs/:id') @Roles('root_admin') @HttpCode(204) async removeDoc(@Param('id', ParseIntPipe) id: number) { await this.index.removeDoc(id); }
  @Post('admin/playground') @Roles('root_admin') @HttpCode(200) playground(@Body() body: Json) { return this.admin.playground(body); }
  @Get('admin/logs') @Roles('root_admin') logs(@Query() q: Json) { return this.admin.logs(q); }
  @Get('admin/reports') @Roles('root_admin') reports(@Query('status') status?: string) { return this.admin.reports(status); }
  @Patch('admin/reports/:id') @Roles('root_admin') updateReport(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.admin.updateReport(user, id, body); }
  @Put('admin/messages/:id/label') @Roles('root_admin') label(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.admin.label(user, id, body); }
  @Get('admin/eval') @Roles('root_admin') evalSummary() { return this.admin.evalSummary(); }
  @Get('admin/eval/export') @Roles('root_admin') async evalExport() {
    return new StreamableFile(Buffer.from(JSON.stringify(await this.admin.evalDataset(), null, 2), 'utf8'), { type: 'application/json', disposition: 'attachment; filename="bo-danh-gia-tieu-tuong.json"' });
  }
  @Get('admin/limits') @Roles('root_admin') limits() { return this.admin.limits(); }
  @Put('admin/limits/:schoolId') @Roles('root_admin') setLimit(@CurrentUser() user: UserRow, @Param('schoolId', ParseIntPipe) id: number, @Body() body: Json) { return this.admin.setLimit(user, id, body); }
}
