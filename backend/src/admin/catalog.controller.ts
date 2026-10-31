import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Length, Matches, Max, MaxLength, Min } from 'class-validator';
import { AuthGuard, CurrentUser, Roles } from '../auth/auth.guard';
import type { UserRow } from '../database/database.service';
import { CatalogService, LORE_KINDS, NODE_KINDS, RARITIES, SOURCE_KINDS } from './catalog.service';
import { SystemService } from './system.service';

const STATES = ['draft', 'published', 'archived'] as const;
const TYPES = ['mcq', 'tf', 'order', 'match', 'map'] as const;
const LEVELS = ['NHAN_BIET', 'THONG_HIEU', 'VAN_DUNG'] as const;
const day = /^\d{4}-\d{2}-\d{2}$/;

class NewNodeDto {
  @IsIn(NODE_KINDS as unknown as string[]) kind: (typeof NODE_KINDS)[number];
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) parent_id?: number | null;
  @Matches(/^[A-Za-z0-9_.-]{2,40}$/) code: string;
  @IsString() @Length(2, 160) title: string;
  @IsOptional() @IsString() @MaxLength(2000) summary?: string;
  @IsOptional() @IsString() @MaxLength(60) period?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) sort_order?: number;
}
class PatchNodeDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) parent_id?: number | null;
  @IsOptional() @IsString() @Length(2, 160) title?: string;
  @IsOptional() @IsString() @MaxLength(2000) summary?: string;
  @IsOptional() @IsString() @MaxLength(60) period?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) sort_order?: number;
  @IsOptional() @IsIn(STATES as unknown as string[]) status?: (typeof STATES)[number];
}

class QuestionDto {
  @IsString() @Length(1, 80) unit_id: string;
  @IsIn(TYPES as unknown as string[]) type: (typeof TYPES)[number];
  @IsString() @Length(3, 600) prompt: string;
  @IsString() @Length(3, 1000) explanation: string;
  @IsOptional() @IsIn(LEVELS as unknown as string[]) level?: string;
  @IsOptional() @IsString() @MaxLength(300) source?: string | null;
  @IsOptional() @IsString() @MaxLength(300) hint?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsString({ each: true }) @MaxLength(300, { each: true }) options?: string[];
  @IsOptional() answer?: number | boolean | string;
  @IsOptional() @IsArray() @ArrayMaxSize(6) @IsString({ each: true }) @MaxLength(300, { each: true }) items?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsString({ each: true }) @MaxLength(300, { each: true }) left?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsString({ each: true }) @MaxLength(300, { each: true }) right?: string[];
  @IsOptional() @IsBoolean() keep_order?: boolean;
}
class QuestionQuery {
  @IsOptional() @IsString() @MaxLength(80) q?: string;
  @IsOptional() @IsString() @MaxLength(80) unit_id?: string;
  @IsOptional() @IsIn(TYPES as unknown as string[]) type?: string;
  @IsOptional() @IsIn(LEVELS as unknown as string[]) level?: string;
  @IsOptional() @IsIn(['draft', 'published', 'hidden']) status?: string;
  @IsOptional() @IsIn(['file', 'admin']) origin?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
class QuestionStatusDto {
  @IsIn(['draft', 'published', 'hidden']) status: 'draft' | 'published' | 'hidden';
  @IsOptional() @IsString() @MaxLength(300) note?: string | null;
}

class SourceDto {
  @IsString() @Length(3, 200) title: string;
  @IsString() @Length(3, 500) citation: string;
  @IsOptional() @IsIn(SOURCE_KINDS as unknown as string[]) kind?: (typeof SOURCE_KINDS)[number];
  @IsOptional() @IsString() @MaxLength(80) unit_id?: string | null;
  @IsOptional() @IsString() @MaxLength(200) file_name?: string | null;
  @IsString() @Length(20, 200000) content: string;
}
class PatchSourceDto {
  @IsOptional() @IsString() @Length(3, 200) title?: string;
  @IsOptional() @IsString() @Length(3, 500) citation?: string;
  @IsOptional() @IsIn(SOURCE_KINDS as unknown as string[]) kind?: (typeof SOURCE_KINDS)[number];
  @IsOptional() @IsString() @MaxLength(80) unit_id?: string | null;
}
class SourceQuery {
  @IsOptional() @IsIn(['pending', 'approved', 'rejected', 'archived']) status?: string;
  @IsOptional() @IsString() @MaxLength(80) q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
class SearchQuery {
  @IsString() @Length(2, 200) q: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10) limit?: number;
}
class ReviewDto {
  @IsIn(['approve', 'reject', 'archive', 'reopen']) decision: 'approve' | 'reject' | 'archive' | 'reopen';
  @IsOptional() @IsString() @MaxLength(300) note?: string | null;
}

class CardDto {
  @Matches(/^[a-z0-9_]{3,40}$/) code: string;
  @IsString() @Length(2, 80) name: string;
  @IsOptional() @IsString() @MaxLength(120) title?: string | null;
  @IsOptional() @IsString() @MaxLength(40) role?: string | null;
  @IsIn(RARITIES as unknown as string[]) rarity: (typeof RARITIES)[number];
  @IsIn(LORE_KINDS as unknown as string[]) kind: (typeof LORE_KINDS)[number];
  @IsOptional() @IsString() @MaxLength(1500) summary?: string;
  @IsString() @Length(3, 500) source: string;
  @IsString() @Length(3, 300) unlock_condition: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10000) sort_order?: number;
}
class PatchCardDto {
  @IsOptional() @IsString() @Length(2, 80) name?: string;
  @IsOptional() @IsString() @MaxLength(120) title?: string | null;
  @IsOptional() @IsString() @MaxLength(40) role?: string | null;
  @IsOptional() @IsIn(RARITIES as unknown as string[]) rarity?: (typeof RARITIES)[number];
  @IsOptional() @IsIn(LORE_KINDS as unknown as string[]) kind?: (typeof LORE_KINDS)[number];
  @IsOptional() @IsString() @MaxLength(1500) summary?: string;
  @IsOptional() @IsString() @Length(3, 500) source?: string;
  @IsOptional() @IsString() @Length(3, 300) unlock_condition?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10000) sort_order?: number;
  @IsOptional() @IsIn(STATES as unknown as string[]) status?: (typeof STATES)[number];
}
class CardQuery {
  @IsOptional() @IsString() @MaxLength(80) q?: string;
  @IsOptional() @IsIn(STATES as unknown as string[]) status?: string;
  @IsOptional() @IsIn(LORE_KINDS as unknown as string[]) kind?: string;
  @IsOptional() @IsIn(RARITIES as unknown as string[]) rarity?: string;
}

class RulesDto {
  @IsObject() config: Record<string, unknown>;
  @IsOptional() @IsString() @MaxLength(300) note?: string | null;
}
class HistoryQuery {
  @IsIn(['curriculum', 'question', 'ai_source', 'hero_card', 'exp_rules']) entity: string;
  @IsString() @Length(1, 80) id: string;
}

class EventQuery {
  @IsOptional() @Matches(day) from?: string;
  @IsOptional() @Matches(day) to?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) school_id?: number;
  @IsOptional() @IsIn(['login', 'audit', 'import', 'mail']) kind?: string;
  @IsOptional() @IsIn(['info', 'warn', 'error']) level?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

/** /api/admin/content: nội dung và cấu hình dùng chung toàn hệ thống – chỉ quản trị tổng (quản trị trường bị chặn ở lớp bảo vệ) */
@Controller('admin/content')
@UseGuards(AuthGuard)
@Roles('root_admin')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('history')
  history(@Query() q: HistoryQuery) { return this.catalog.history(q.entity, q.id); }

  // ---- TM.SA-CONTENT.001
  @Get('curriculum')
  curriculum() { return this.catalog.curriculum(); }

  @Post('curriculum')
  createNode(@CurrentUser() user: UserRow, @Body() body: NewNodeDto) { return this.catalog.createNode(user, body); }

  @Patch('curriculum/:id')
  updateNode(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: PatchNodeDto) { return this.catalog.updateNode(user, id, body); }

  // ---- TM.SA-CONTENT.002
  @Get('questions')
  questions(@Query() q: QuestionQuery) { return this.catalog.questions(q); }

  @Post('questions')
  createQuestion(@CurrentUser() user: UserRow, @Body() body: QuestionDto) { return this.catalog.createQuestion(user, body); }

  @Get('questions/:id')
  question(@Param('id') id: string) { return this.catalog.question(id); }

  @Patch('questions/:id')
  updateQuestion(@CurrentUser() user: UserRow, @Param('id') id: string, @Body() body: QuestionDto) { return this.catalog.updateQuestion(user, id, body); }

  @Post('questions/:id/status')
  @HttpCode(200)
  questionStatus(@CurrentUser() user: UserRow, @Param('id') id: string, @Body() body: QuestionStatusDto) { return this.catalog.setQuestionStatus(user, id, body.status, body.note); }

  @Delete('questions/:id')
  @HttpCode(204)
  async removeQuestion(@CurrentUser() user: UserRow, @Param('id') id: string) { await this.catalog.removeQuestionOverlay(user, id); }

  // ---- TM.SA-CONTENT.003
  @Get('sources')
  sources(@Query() q: SourceQuery) { return this.catalog.sources(q); }

  @Get('sources/search')
  searchSources(@Query() q: SearchQuery) { return this.catalog.searchSources(q.q, q.limit); }

  @Post('sources')
  createSource(@CurrentUser() user: UserRow, @Body() body: SourceDto) { return this.catalog.createSource(user, body); }

  @Get('sources/:id')
  source(@Param('id', ParseIntPipe) id: number) { return this.catalog.source(id); }

  @Patch('sources/:id')
  updateSource(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: PatchSourceDto) { return this.catalog.updateSource(user, id, body); }

  @Post('sources/:id/review')
  @HttpCode(200)
  reviewSource(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: ReviewDto) { return this.catalog.reviewSource(user, id, body.decision, body.note); }

  // ---- TM.SA-CONTENT.004
  @Get('cards')
  cards(@Query() q: CardQuery) { return this.catalog.cards(q); }

  @Post('cards')
  createCard(@CurrentUser() user: UserRow, @Body() body: CardDto) { return this.catalog.createCard(user, body); }

  @Patch('cards/:code')
  updateCard(@CurrentUser() user: UserRow, @Param('code') code: string, @Body() body: PatchCardDto) { return this.catalog.updateCard(user, code, body); }

  // ---- TM.SA-CONTENT.005
  @Get('rules')
  rules() { return this.catalog.rules(); }

  @Get('rules/:version')
  ruleVersion(@Param('version', ParseIntPipe) version: number) { return this.catalog.ruleVersion(version); }

  @Post('rules')
  saveRules(@CurrentUser() user: UserRow, @Body() body: RulesDto) { return this.catalog.saveRules(user, body.config, body.note); }
}

/** /api/admin/system: nhật ký và sức khỏe hệ thống (TM.SA-CONTENT.006), chỉ quản trị tổng */
@Controller('admin/system')
@UseGuards(AuthGuard)
@Roles('root_admin')
export class SystemController {
  constructor(private readonly system: SystemService) {}

  @Get('health')
  health() { return this.system.health(); }

  @Get('events')
  events(@Query() q: EventQuery) { return this.system.events(q); }
}
