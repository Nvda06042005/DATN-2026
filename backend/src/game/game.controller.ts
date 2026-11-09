import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { AuthGuard, CurrentUser, Roles } from '../auth/auth.guard';
import { UserRow } from '../database/database.service';
import { BoardService, ContestInput } from './board.service';
import { BADGE_RULES, CatalogService } from './catalog.service';
import { GameService } from './game.service';
import { DAILY_GOALS, GAME_DEFAULTS, SETTING_RULES, SettingsService } from './settings';

const num = () => Type(() => Number);

class CharacterDto { @num() @IsInt() @Min(1) class_id: number; }
class GoalDto { @num() @IsInt() goal: number; }
class AppearanceDto {
  @IsOptional() @num() @IsInt() outfit_id?: number | null;
  @IsOptional() @num() @IsInt() weapon_id?: number | null;
  @IsOptional() @num() @IsInt() banner_id?: number | null;
}
class AckDto { @IsArray() @ArrayMaxSize(50) @IsInt({ each: true }) ids: number[]; }
class BoardQuery {
  @IsIn(['class', 'school', 'system']) scope: 'class' | 'school' | 'system';
  @IsOptional() @IsIn(['week', 'month', 'all']) period?: string;
  @IsOptional() @num() @IsInt() @Min(1) class_id?: number;
}
class HeartsDto { @IsBoolean() hearts_enabled: boolean; }
class AwardDto { @IsArray() @ArrayMaxSize(100) @IsInt({ each: true }) user_ids: number[]; }
class SchoolSettingsDto {
  @IsOptional() @IsBoolean() leaderboard_enabled?: boolean;
  @IsOptional() @IsIn(['grade', 'school']) leaderboard_scope?: 'grade' | 'school';
  @IsOptional() @IsIn(['week', 'month']) leaderboard_period?: 'week' | 'month';
}
class SchoolQuery { @IsOptional() @num() @IsInt() @Min(1) school_id?: number; }
class CatalogQuery { @IsOptional() @IsString() @MaxLength(80) q?: string; }

/**
 * /api/game – trò chơi hóa: nhân vật, điểm – cấp độ – vàng – tim, chuỗi ngày, nhiệm vụ, huy hiệu, thẻ, cửa hàng, quà, bảng xếp hạng, giải đấu tuần,
 * hoạt động cấp trường; và các trang quản trị danh mục/cấu hình. Đường dẫn tĩnh khai báo trước đường dẫn có :id/:entity.
 */
@Controller('game')
@UseGuards(AuthGuard)
export class GameController {
  constructor(
    private readonly game: GameService,
    private readonly board: BoardService,
    private readonly catalog: CatalogService,
    private readonly settings: SettingsService,
  ) {}

  // ------------------------------------------------------------------ học sinh
  @Get('me') @Roles('student') me(@CurrentUser() user: UserRow) { return this.game.me(user); }

  /** Phần cấu hình học sinh cần biết để hiển thị (không gồm giá trị nội bộ) */
  @Get('config') @Roles('student', 'teacher', 'school_admin', 'root_admin')
  async config() {
    const s = await this.settings.get();
    return { hearts: s.hearts, daily_goal_options: [...DAILY_GOALS], gift: s.gift, hint_max: s.hint_max, streak_freeze_max: s.streak.freeze_max, league_tiers: s.league.tiers, card_rates: s.cards.rates, league: s.league };
  }

  @Get('classes') @Roles('student', 'teacher', 'school_admin', 'root_admin') classes() { return this.game.classes(); }
  @Post('character') @Roles('student') @HttpCode(200) character(@CurrentUser() user: UserRow, @Body() body: CharacterDto) { return this.game.chooseClass(user, body.class_id); }
  @Put('goal') @Roles('student') goal(@CurrentUser() user: UserRow, @Body() body: GoalDto) { return this.game.setGoal(user, body.goal); }
  @Put('appearance') @Roles('student') appearance(@CurrentUser() user: UserRow, @Body() body: AppearanceDto) { return this.game.setAppearance(user, body); }

  @Get('shop') @Roles('student') shop(@CurrentUser() user: UserRow) { return this.game.shop(user); }
  @Post('shop/:id/buy') @Roles('student') @HttpCode(200) buy(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.game.buy(user, id); }

  @Get('badges') @Roles('student') badges(@CurrentUser() user: UserRow) { return this.game.badgeCollection(user); }
  @Get('cards') @Roles('student') cards(@CurrentUser() user: UserRow) { return this.game.album(user); }
  @Get('cards/:id') @Roles('student') card(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.game.cardDetail(user, id); }
  @Get('drops') @Roles('student') drops(@CurrentUser() user: UserRow) { return this.game.pendingDrops(user); }
  @Post('drops/:id/flip') @Roles('student') @HttpCode(200) flip(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.game.flipDrop(user, id); }

  @Get('quests') @Roles('student') quests(@CurrentUser() user: UserRow) { return this.game.quests(user); }
  @Get('gift') @Roles('student') gift(@CurrentUser() user: UserRow) { return this.game.gift(user); }
  @Post('gift/claim') @Roles('student') @HttpCode(200) claim(@CurrentUser() user: UserRow) { return this.game.claimGift(user); }
  @Get('streak') @Roles('student') streak(@CurrentUser() user: UserRow) { return this.game.streakCalendar(user); }

  @Get('celebrations') @Roles('student') celebrations(@CurrentUser() user: UserRow) { return this.game.celebrations(user); }
  @Post('celebrations/ack') @Roles('student') @HttpCode(200) async ack(@CurrentUser() user: UserRow, @Body() body: AckDto) { await this.game.acknowledge(user, body.ids); return { ok: true }; }

  @Get('leaderboard') @Roles('student') leaderboard(@CurrentUser() user: UserRow, @Query() query: BoardQuery) { return this.board.leaderboard(user, query.scope, query.period, query.class_id); }
  @Get('league') @Roles('student') league(@CurrentUser() user: UserRow) { return this.board.league(user); }
  @Get('contests') @Roles('student') contests(@CurrentUser() user: UserRow) { return this.board.studentContests(user); }
  @Get('contests/:id/board') @Roles('student', 'school_admin') contestBoard(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.board.contestBoard(user, id); }

  // ------------------------------------------------------------------ giáo viên và quản trị viên trường
  @Get('class-settings') @Roles('teacher', 'school_admin') classSettings(@CurrentUser() user: UserRow) { return this.board.classSettings(user); }
  @Put('class-settings/:classId') @Roles('teacher', 'school_admin')
  setClass(@CurrentUser() user: UserRow, @Param('classId', ParseIntPipe) classId: number, @Body() body: HeartsDto) { return this.board.setClassHearts(user, classId, body.hearts_enabled); }
  @Get('class-students/:classId') @Roles('teacher', 'school_admin') classStudents(@CurrentUser() user: UserRow, @Param('classId', ParseIntPipe) classId: number) { return this.board.classStudents(user, classId); }
  @Get('school-badges') @Roles('teacher', 'school_admin') schoolBadges(@CurrentUser() user: UserRow) { return this.board.schoolBadges(user); }
  @Post('badges/:id/award') @Roles('teacher', 'school_admin') @HttpCode(200)
  award(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: AwardDto) { return this.board.awardBadge(user, id, body.user_ids); }

  @Get('school-settings') @Roles('school_admin', 'root_admin')
  async schoolSettings(@CurrentUser() user: UserRow, @Query() query: SchoolQuery) {
    return this.board.schoolSettings(user.role === 'school_admin' ? user.school_id! : query.school_id ?? 0);
  }
  @Put('school-settings') @Roles('school_admin', 'root_admin')
  updateSchoolSettings(@CurrentUser() user: UserRow, @Query() query: SchoolQuery, @Body() body: SchoolSettingsDto) { return this.board.updateSchoolSettings(user, body, query.school_id); }

  @Get('admin/contests') @Roles('school_admin') adminContests(@CurrentUser() user: UserRow) { return this.board.contests(user); }
  @Post('admin/contests') @Roles('school_admin') createContest(@CurrentUser() user: UserRow, @Body() body: Record<string, unknown>) { return this.board.createContest(user, body as unknown as ContestInput); }
  @Put('admin/contests/:id') @Roles('school_admin') updateContest(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>) { return this.board.updateContest(user, id, body as unknown as ContestInput); }
  @Delete('admin/contests/:id') @Roles('school_admin') @HttpCode(204) async deleteContest(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { await this.board.deleteContest(user, id); }

  // ------------------------------------------------------------------ quản trị: cấu hình và danh mục
  @Get('admin/specs') @Roles('root_admin', 'school_admin') specs() { return { entities: this.catalog.specs(), badge_rules: BADGE_RULES.map(([value, label]) => ({ value, label })) }; }
  @Get('admin/settings') @Roles('root_admin', 'school_admin')
  async adminSettings() { return { values: await this.settings.get(), rules: SETTING_RULES, defaults: GAME_DEFAULTS, league_schedule: await this.board.leagueSchedule() }; }
  @Put('admin/settings') @Roles('root_admin', 'school_admin')
  async updateSettings(@CurrentUser() user: UserRow, @Body() body: Record<string, unknown>) { return { values: await this.settings.update(user.id, body) }; }

  @Get('admin/:entity') @Roles('root_admin', 'school_admin') list(@CurrentUser() user: UserRow, @Param('entity') entity: string, @Query() query: CatalogQuery) { return this.catalog.list(user, entity, query.q); }
  @Post('admin/:entity') @Roles('root_admin', 'school_admin') create(@CurrentUser() user: UserRow, @Param('entity') entity: string, @Body() body: Record<string, unknown>) { return this.catalog.create(user, entity, body); }
  @Get('admin/:entity/:id') @Roles('root_admin', 'school_admin') get(@CurrentUser() user: UserRow, @Param('entity') entity: string, @Param('id', ParseIntPipe) id: number) { return this.catalog.get(user, entity, id); }
  @Put('admin/:entity/:id') @Roles('root_admin', 'school_admin') update(@CurrentUser() user: UserRow, @Param('entity') entity: string, @Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>) { return this.catalog.update(user, entity, id, body); }
  @Delete('admin/:entity/:id') @Roles('root_admin', 'school_admin') @HttpCode(204) async remove(@CurrentUser() user: UserRow, @Param('entity') entity: string, @Param('id', ParseIntPipe) id: number) { await this.catalog.remove(user, entity, id); }
}
