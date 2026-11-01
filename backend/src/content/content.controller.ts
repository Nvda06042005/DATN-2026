import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Put, Query, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { UploadedXlsx, XLSX_MIME, XLSX_UPLOAD } from '../admin/excel';
import { AuthGuard, CurrentUser, Roles } from '../auth/auth.guard';
import { DatabaseService, UserRow } from '../database/database.service';
import { ENTITIES, SPECS } from '../history/history.service';
import { LessonService } from './lesson.service';
import { JourneyService, NodeInput } from './journey.service';
import { QuestionService, QuestionInput } from './question.service';
import { QuizService, QuizInput } from './quiz.service';
import { ShareEntity, ShareService, ShareTarget } from './share.service';
import { QTYPE_LABEL, QTYPES } from './questions';
import { LINK_TYPES } from './access';

const num = () => Type(() => Number);

class LinkDto {
  @IsIn([...LINK_TYPES]) ref_type: (typeof LINK_TYPES)[number];
  @num() @IsInt() @Min(1) ref_id: number;
}

/** Bài học còn gắn được với thuật ngữ */
class LessonLinkDto {
  @IsIn([...LINK_TYPES, 'term']) ref_type: (typeof LINK_TYPES)[number] | 'term';
  @num() @IsInt() @Min(1) ref_id: number;
}

class QuestionDto {
  @IsOptional() @IsString() qtype?: string;
  @IsOptional() @IsString() @MaxLength(1200) prompt?: string;
  @IsOptional() @IsString() @MaxLength(500) image_url?: string | null;
  @IsOptional() @IsString() @MaxLength(2200) explanation?: string | null;
  @IsOptional() @num() @IsInt() difficulty?: number;
  @IsOptional() @num() @IsInt() @Min(1) campaign_id?: number | null;
  @IsOptional() @IsObject() data?: Record<string, unknown>;
  @IsOptional() @IsArray() @ArrayMaxSize(12) @ValidateNested({ each: true }) @Type(() => LinkDto) links?: LinkDto[];
}

class QuestionListQuery {
  @IsOptional() @IsString() @MaxLength(80) q?: string;
  @IsOptional() @IsIn(['mine', 'school', 'system', 'all']) store?: string;
  @IsOptional() @num() @IsInt() @Min(1) campaign_id?: number;
  @IsOptional() @IsIn([...QTYPES]) qtype?: string;
  @IsOptional() @num() @IsInt() @Min(1) difficulty?: number;
  @IsOptional() @IsIn([...LINK_TYPES]) ref_type?: string;
  @IsOptional() @num() @IsInt() @Min(1) ref_id?: number;
  @IsOptional() @num() @IsInt() @Min(1) page?: number;
  @IsOptional() @num() @IsInt() @Min(1) limit?: number;
}

class ImportQuery {
  @IsOptional() @IsIn(['true', 'false']) commit?: 'true' | 'false';
}

class QuizItemDto {
  @num() @IsInt() @Min(1) question_id: number;
  @IsOptional() @num() @IsInt() points?: number;
  @IsOptional() @num() @IsInt() seconds?: number | null;
}

class QuizDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(1200) description?: string | null;
  @IsOptional() @num() @IsInt() @Min(1) campaign_id?: number | null;
  @IsOptional() @num() @IsInt() seconds_per_question?: number;
  @IsOptional() @IsBoolean() shuffle_questions?: boolean;
  @IsOptional() @IsBoolean() shuffle_options?: boolean;
  @IsOptional() @num() @IsInt() pass_percent?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(60) @ValidateNested({ each: true }) @Type(() => QuizItemDto) items?: QuizItemDto[];
}

class QuizListQuery {
  @IsOptional() @IsString() @MaxLength(80) q?: string;
  @IsOptional() @IsIn(['mine', 'school', 'system', 'all']) store?: string;
  @IsOptional() @num() @IsInt() @Min(1) campaign_id?: number;
  @IsOptional() @num() @IsInt() @Min(1) page?: number;
  @IsOptional() @num() @IsInt() @Min(1) limit?: number;
}

class LessonDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(700) summary?: string | null;
  @IsOptional() @num() @IsInt() @Min(1) campaign_id?: number | null;
  @IsOptional() @IsArray() @ArrayMaxSize(30) blocks?: unknown[];
  @IsOptional() @num() @IsInt() read_minutes?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(12) @ValidateNested({ each: true }) @Type(() => LessonLinkDto) links?: LessonLinkDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(3) @IsInt({ each: true }) check_question_ids?: number[];
}

class LessonListQuery {
  @IsOptional() @IsString() @MaxLength(80) q?: string;
  @IsOptional() @num() @IsInt() @Min(1) campaign_id?: number;
  @IsOptional() @IsIn(['draft', 'published']) status?: string;
}

class StatusDto {
  @IsIn(['draft', 'published']) status: 'draft' | 'published';
}

class JourneyDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(1200) description?: string | null;
  @IsOptional() @num() @IsInt() @Min(1) campaign_id?: number;
  @IsOptional() @IsString() @MaxLength(500) background_url?: string | null;
  @IsOptional() @num() @IsInt() @Min(1) template_id?: number | null;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsInt({ each: true }) class_ids?: number[];
}

class JourneyListQuery {
  @IsOptional() @IsString() @MaxLength(80) q?: string;
  @IsOptional() @IsIn(['mine', 'school', 'system', 'all']) store?: string;
  @IsOptional() @num() @IsInt() @Min(1) campaign_id?: number;
}

class NodeDto {
  @IsOptional() @IsIn(['lesson', 'quiz', 'battle', 'source', 'final', 'practice', 'listen', 'chest', 'gate_test']) kind?: NodeInput['kind'];
  @IsOptional() @IsString() @MaxLength(160) title?: string;
  @IsOptional() @IsString() @MaxLength(30) icon?: string | null;
  @IsOptional() @IsString() @MaxLength(500) objective?: string | null;
  @IsOptional() @num() @IsInt() @Min(1) lesson_id?: number | null;
  @IsOptional() @num() @IsInt() @Min(1) quiz_id?: number | null;
  @IsOptional() @num() @IsInt() @Min(1) source_id?: number | null;
  @IsOptional() @num() @IsInt() @Min(1) battle_id?: number | null;
  @IsOptional() @num() @IsInt() pass_percent?: number | null;
  @IsOptional() @num() @IsInt() reward_points?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsInt({ each: true }) unlock_source_ids?: number[];
  @IsOptional() @num() @IsInt() @Min(1) position?: number;
  @IsOptional() @IsString() opens_at?: string | null;
  @IsOptional() @num() @IsInt() min_percent?: number | null;
  @IsOptional() @num() @IsInt() min_stars?: number | null;
  @IsOptional() @num() @IsInt() reward_gold?: number;
  @IsOptional() @num() @IsInt() reward_card_id?: number | null;
  @IsOptional() @num() @IsInt() reward_badge_id?: number | null;
  @IsOptional() @num() @IsInt() @Min(1) gate_id?: number | null;
  @IsOptional() @IsString() @MaxLength(500) audio_url?: string | null;
  @IsOptional() @IsString() @MaxLength(4200) transcript?: string | null;
  @IsOptional() @num() @IsInt() reward_binh_thu?: number | null;
}

class GateDto {
  @IsOptional() @IsString() @MaxLength(160) title?: string;
  @IsOptional() @IsString() @MaxLength(500) summary?: string | null;
  @IsOptional() @IsString() @MaxLength(2200) guide_note?: string | null;
}

class OrderDto {
  @IsArray() @ArrayMaxSize(40) @IsInt({ each: true }) node_ids: number[];
}

class ClassesDto {
  @IsArray() @ArrayMaxSize(20) @IsInt({ each: true }) class_ids: number[];
  @IsOptional() @IsString() starts_at?: string | null;
  @IsOptional() @IsString() ends_at?: string | null;
}

class ScheduleDto {
  @IsOptional() @IsString() starts_at?: string | null;
  @IsOptional() @IsString() ends_at?: string | null;
}

class DefaultDto {
  @IsBoolean() value: boolean;
}

class ShareDto {
  @IsIn(['question', 'quiz', 'journey']) entity: ShareEntity;
  @num() @IsInt() @Min(1) entity_id: number;
  @IsIn(['school', 'system']) target: ShareTarget;
}

class ShareListQuery {
  @IsOptional() @IsIn(['pending', 'approved', 'rejected']) status?: string;
  @IsOptional() @IsIn(['question', 'quiz', 'journey']) entity?: string;
}

class ReviewDto {
  @IsBoolean() approve: boolean;
  @IsOptional() @IsString() @MaxLength(300) note?: string | null;
}

class OptionsQuery {
  @IsIn(['campaign', 'figure', 'event', 'place', 'battle', 'source', 'term']) type: string;
  @IsOptional() @IsString() @MaxLength(80) q?: string;
  @IsOptional() @num() @IsInt() @Min(1) campaign_id?: number;
}

/**
 * /api/content – soạn nội dung học tập: ngân hàng câu hỏi, bộ đề, bài học, hành trình học và chia sẻ/duyệt.
 * Giáo viên soạn trong kho riêng; quản trị viên trường duyệt và quản lý kho trường; quản trị tổng soạn kho hệ thống. Quyền chi tiết do từng dịch vụ kiểm tra.
 * Đường dẫn tĩnh khai báo trước đường dẫn có :id.
 */
@Controller('content')
@UseGuards(AuthGuard)
@Roles('teacher', 'school_admin', 'root_admin')
export class ContentController {
  constructor(
    private readonly db: DatabaseService,
    private readonly questions: QuestionService,
    private readonly quizzes: QuizService,
    private readonly lessons: LessonService,
    private readonly journeys: JourneyService,
    private readonly shares: ShareService,
  ) {}

  /** Danh mục dạng câu hỏi và mục lịch sử để chọn khi gắn liên kết (giáo viên chỉ thấy mục đã công bố) */
  @Get('question-types')
  types() { return QTYPES.map((value) => ({ value, label: QTYPE_LABEL[value] })); }

  @Get('history-options')
  async options(@CurrentUser() user: UserRow, @Query() query: OptionsQuery) {
    const spec = SPECS[query.type as (typeof ENTITIES)[number]];
    const params: unknown[] = [];
    const where: string[] = [];
    if (user.role !== 'root_admin') where.push("t.status = 'published'");
    if (query.q) { params.push(`%${query.q.trim().toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`); where.push(`lower(t.${spec.main}) LIKE $${params.length}`); }
    if (query.campaign_id && spec.fields.some((f) => f.name === 'campaign_id')) { params.push(query.campaign_id); where.push(`t.campaign_id = $${params.length}`); }
    return this.db.query(`SELECT t.id, t.${spec.main} AS label, t.status FROM ${spec.table} t ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY ${spec.order} LIMIT 60`, params);
  }

  // ------------------------------------------------------------------ câu hỏi
  @Get('questions')
  listQuestions(@CurrentUser() user: UserRow, @Query() query: QuestionListQuery) { return this.questions.list(user, query); }

  @Get('questions/template')
  async questionTemplate() { return new StreamableFile(await this.questions.template(), { type: XLSX_MIME, disposition: 'attachment; filename="mau-cau-hoi.xlsx"' }); }

  @Get('questions/export')
  async exportQuestions(@CurrentUser() user: UserRow, @Query() query: QuestionListQuery) {
    return new StreamableFile(await this.questions.exportXlsx(user, query), { type: XLSX_MIME, disposition: 'attachment; filename="cau-hoi.xlsx"' });
  }

  @Post('questions/import')
  @HttpCode(200)
  @UseInterceptors(XLSX_UPLOAD)
  importQuestions(@CurrentUser() user: UserRow, @Query() query: ImportQuery, @UploadedFile() file: UploadedXlsx | undefined) { return this.questions.importXlsx(user, file, query.commit === 'true'); }

  @Post('questions')
  createQuestion(@CurrentUser() user: UserRow, @Body() body: QuestionDto) { return this.questions.create(user, body as unknown as QuestionInput); }

  @Get('questions/:id')
  getQuestion(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.questions.get(user, id); }

  @Put('questions/:id')
  updateQuestion(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: QuestionDto) { return this.questions.update(user, id, body as unknown as QuestionInput); }

  @Delete('questions/:id')
  @HttpCode(204)
  async removeQuestion(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { await this.questions.remove(user, id); }

  @Get('questions/:id/versions')
  questionVersions(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.questions.versions(user, id); }

  @Post('questions/:id/copy')
  @HttpCode(200)
  copyQuestion(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.questions.copyToMine(user, id); }

  // ------------------------------------------------------------------ bộ đề
  @Get('quizzes')
  listQuizzes(@CurrentUser() user: UserRow, @Query() query: QuizListQuery) { return this.quizzes.list(user, query); }

  @Post('quizzes')
  createQuiz(@CurrentUser() user: UserRow, @Body() body: QuizDto) { return this.quizzes.create(user, body as unknown as QuizInput); }

  @Get('quizzes/:id')
  getQuiz(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.quizzes.get(user, id); }

  @Put('quizzes/:id')
  updateQuiz(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: QuizDto) { return this.quizzes.update(user, id, body as unknown as QuizInput); }

  @Delete('quizzes/:id')
  @HttpCode(204)
  async removeQuiz(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { await this.quizzes.remove(user, id); }

  @Post('quizzes/:id/duplicate')
  @HttpCode(200)
  duplicateQuiz(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.quizzes.duplicate(user, id); }

  // ------------------------------------------------------------------ bài học (quản trị tổng soạn; vai trò khác chỉ đọc bài đã công bố)
  @Get('lessons')
  listLessons(@CurrentUser() user: UserRow, @Query() query: LessonListQuery) { return this.lessons.list(user, query); }

  @Post('lessons')
  @Roles('root_admin')
  createLesson(@CurrentUser() user: UserRow, @Body() body: LessonDto) { return this.lessons.create(user, body as never); }

  @Get('lessons/:id')
  getLesson(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.lessons.get(user, id); }

  @Put('lessons/:id')
  @Roles('root_admin')
  updateLesson(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: LessonDto) { return this.lessons.update(user, id, body as never); }

  @Patch('lessons/:id/status')
  @Roles('root_admin')
  lessonStatus(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: StatusDto) { return this.lessons.setStatus(user, id, body.status); }

  @Delete('lessons/:id')
  @Roles('root_admin')
  @HttpCode(204)
  async removeLesson(@Param('id', ParseIntPipe) id: number) { await this.lessons.remove(id); }

  // ------------------------------------------------------------------ hành trình
  @Get('my-classes')
  @Roles('teacher')
  myClasses(@CurrentUser() user: UserRow) { return this.journeys.myClasses(user); }

  @Get('reward-options')
  rewardOptions(@CurrentUser() user: UserRow) { return this.journeys.rewardOptions(user); }

  @Get('journeys')
  listJourneys(@CurrentUser() user: UserRow, @Query() query: JourneyListQuery) { return this.journeys.library(user, query); }

  @Post('journeys')
  createJourney(@CurrentUser() user: UserRow, @Body() body: JourneyDto) { return this.journeys.create(user, body as never); }

  @Get('journeys/:id')
  getJourney(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.journeys.get(user, id); }

  @Put('journeys/:id')
  updateJourney(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: JourneyDto) { return this.journeys.update(user, id, body as never); }

  @Delete('journeys/:id')
  @HttpCode(204)
  async removeJourney(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { await this.journeys.remove(user, id); }

  @Post('journeys/:id/duplicate')
  @HttpCode(200)
  duplicateJourney(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.journeys.duplicate(user, id); }

  @Patch('journeys/:id/status')
  journeyStatus(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: StatusDto) { return this.journeys.setStatus(user, id, body.status); }

  @Patch('journeys/:id/default')
  @Roles('root_admin')
  journeyDefault(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: DefaultDto) { return this.journeys.setDefault(user, id, body.value); }

  @Post('journeys/:id/nodes')
  addNode(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: NodeDto) { return this.journeys.addNode(user, id, body as NodeInput); }

  @Put('journeys/:id/order')
  orderNodes(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: OrderDto) { return this.journeys.reorder(user, id, body.node_ids); }

  @Post('journeys/:id/classes')
  @Roles('teacher')
  @HttpCode(200)
  assign(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: ClassesDto) { return this.journeys.assign(user, id, body.class_ids, { starts_at: body.starts_at, ends_at: body.ends_at }); }

  @Put('journeys/:id/classes/:classId/schedule')
  @Roles('teacher')
  setSchedule(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Param('classId', ParseIntPipe) classId: number, @Body() body: ScheduleDto) { return this.journeys.setSchedule(user, id, classId, body); }

  @Post('journeys/:id/copy')
  @HttpCode(200)
  copyJourney(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Record<string, any>) { return this.journeys.copyTo(user, id, body); }

  @Put('journeys/:id/layout')
  setLayout(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Record<string, any>) { return this.journeys.setLayout(user, id, body); }

  @Post('journeys/:id/preview')
  @HttpCode(200)
  previewJourney(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Record<string, any>) { return this.journeys.preview(user, id, Array.isArray(body.completed) ? body.completed.map(Number) : [], Number(body.hours ?? 0)); }

  @Delete('journeys/:id/classes/:classId')
  @Roles('teacher')
  unassign(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Param('classId', ParseIntPipe) classId: number) { return this.journeys.unassign(user, id, classId); }

  @Post('journeys/:id/gates')
  addGate(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: GateDto) { return this.journeys.addGate(user, id, body); }

  @Put('gates/:gateId')
  updateGate(@CurrentUser() user: UserRow, @Param('gateId', ParseIntPipe) gateId: number, @Body() body: GateDto) { return this.journeys.updateGate(user, gateId, body); }

  @Delete('gates/:gateId')
  removeGate(@CurrentUser() user: UserRow, @Param('gateId', ParseIntPipe) gateId: number) { return this.journeys.removeGate(user, gateId); }

  @Put('nodes/:nodeId')
  updateNode(@CurrentUser() user: UserRow, @Param('nodeId', ParseIntPipe) nodeId: number, @Body() body: NodeDto) { return this.journeys.updateNode(user, nodeId, body as NodeInput); }

  @Delete('nodes/:nodeId')
  removeNode(@CurrentUser() user: UserRow, @Param('nodeId', ParseIntPipe) nodeId: number) { return this.journeys.removeNode(user, nodeId); }

  // ------------------------------------------------------------------ chia sẻ và duyệt
  @Get('shares')
  listShares(@CurrentUser() user: UserRow, @Query() query: ShareListQuery) { return this.shares.list(user, query); }

  @Post('shares')
  requestShare(@CurrentUser() user: UserRow, @Body() body: ShareDto) { return this.shares.request(user, body.entity, body.entity_id, body.target); }

  @Get('shares/:id')
  getShare(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.shares.detail(user, id); }

  @Post('shares/:id/review')
  @Roles('school_admin', 'root_admin')
  @HttpCode(200)
  review(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: ReviewDto) { return this.shares.review(user, id, body.approve, body.note); }

  @Delete('shares/:id')
  @Roles('teacher', 'school_admin')
  @HttpCode(204)
  async withdraw(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { await this.shares.withdraw(user, id); }
}
