import { Body, Controller, Delete, Get, HttpCode, Param, ParseEnumPipe, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDefined, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { AuthGuard, CurrentUser, Roles } from '../auth/auth.guard';
import { UserRow } from '../database/database.service';
import { LearnService } from './learn.service';
import { PlayService } from './play.service';

const num = () => Type(() => Number);
const NOTE_TYPES = { lesson: 'lesson', source: 'source' };

class FigureQuery {
  @IsOptional() @IsIn(['king', 'general', 'official', 'other']) group?: string;
  @IsOptional() @num() @IsInt() @Min(1) campaign_id?: number;
  @IsOptional() @IsString() @MaxLength(80) q?: string;
}

class CampaignQuery {
  @IsOptional() @num() @IsInt() @Min(1) campaign_id?: number;
  @IsOptional() @IsString() @MaxLength(80) q?: string;
}

class TimelineQuery {
  @IsOptional() @num() @IsInt() @Min(1) campaign_id?: number;
  @IsOptional() @num() @IsInt() @Min(1) figure_id?: number;
  @IsOptional() @num() @IsInt() @Min(1) place_id?: number;
  @IsOptional() @num() @IsInt() @Min(1000) year_from?: number;
  @IsOptional() @num() @IsInt() @Max(1500) year_to?: number;
}

class TextQuery {
  @IsOptional() @IsString() @MaxLength(80) q?: string;
}

class SourceQuery {
  @IsOptional() @IsString() @MaxLength(80) q?: string;
  @IsOptional() @num() @IsInt() @Min(1) campaign_id?: number;
  @IsOptional() @IsIn(['su_lieu', 'tho_van', 'hich', 'hinh_anh', 'ban_do_co']) kind?: string;
  @IsOptional() @num() @IsInt() @Min(1) figure_id?: number;
  @IsOptional() @IsIn(['true', 'false']) unlocked?: string;
  @IsOptional() @IsIn(['true', 'false']) favorites?: string;
}

class AnswerDto {
  @num() @IsInt() @Min(1) question_id: number;
  @IsDefined() answer: unknown;
}

class ProgressDto {
  @num() @IsNumber() @Min(0) @Max(100) read_percent: number;
}

class LessonCompleteDto {
  @IsArray() @ArrayMaxSize(5) @ValidateNested({ each: true }) @Type(() => AnswerDto) answers: AnswerDto[];
}

class NoteDto {
  @IsString() @MaxLength(2200) body: string;
}

class ViewEventDto {
  @IsString() @MaxLength(40) event: string;
  @IsOptional() @IsString() @MaxLength(20) ref_type?: string;
  @IsOptional() @num() @IsInt() @Min(1) ref_id?: number;
  @IsOptional() @num() @IsInt() @Min(0) duration_ms?: number;
}

class HistoryQuery {
  @IsOptional() @num() @IsInt() @Min(1) page?: number;
  @IsOptional() @num() @IsInt() @Min(1) limit?: number;
}

/** /api/learn – đọc kho dữ liệu lịch sử đã công bố (học sinh, giáo viên) */
@Controller('learn')
@UseGuards(AuthGuard)
@Roles('student', 'teacher')
export class LearnController {
  constructor(private readonly learn: LearnService) {}

  @Get('campaigns') campaigns() { return this.learn.campaigns(); }
  @Get('figures') figures(@Query() query: FigureQuery) { return this.learn.figures(query); }
  @Get('figures/:id') figure(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.learn.figure(user, id); }
  @Get('events/:id') event(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.learn.event(user, id); }
  @Get('battles/:id') battle(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.learn.battle(user, id); }
  @Get('places') places(@Query() query: CampaignQuery) { return this.learn.places(query); }
  @Get('places/:id') place(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.learn.place(user, id); }
  @Get('terms') terms(@Query() query: TextQuery) { return this.learn.terms(query.q); }
  @Get('search') search(@CurrentUser() user: UserRow, @Query() query: TextQuery) { return this.learn.search(user, query.q ?? ''); }
  @Get('timeline') timeline(@Query() query: TimelineQuery) { return this.learn.timeline(query); }
  @Get('map') map(@Query() query: CampaignQuery) { return this.learn.map(query); }
  @Get('sources') sources(@CurrentUser() user: UserRow, @Query() query: SourceQuery) { return this.learn.sources(user, query); }
  @Get('sources/:id') source(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.learn.source(user, id); }
}

/**
 * /api/play – học và làm bài. Phần lớn chỉ dành cho học sinh; làm thử bộ đề và các lượt làm bài dùng chung cho giáo viên (chế độ xem trước).
 * Mọi câu trả lời được chấm ở máy chủ; đáp án chỉ được gửi về sau khi đã trả lời.
 */
@Controller('play')
@UseGuards(AuthGuard)
@Roles('student')
export class PlayController {
  constructor(private readonly play: PlayService) {}

  @Get('home') home(@CurrentUser() user: UserRow) { return this.play.home(user); }
  @Get('campaigns/:id/map') map(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.play.campaignMap(user, id); }
  @Get('quests') quests(@CurrentUser() user: UserRow) { return this.play.quests(user); }
  @Get('history') history(@CurrentUser() user: UserRow, @Query() query: HistoryQuery) { return this.play.history(user, query.page, query.limit); }

  @Get('nodes/:id') node(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.play.nodeDetail(user, id); }
  @Post('nodes/:id/complete') @HttpCode(200) complete(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.play.completeNode(user, id); }
  @Post('nodes/:id/attempts') @HttpCode(200) startQuiz(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.play.startNodeQuiz(user, id); }
  @Get('nodes/:id/lesson') lesson(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.play.lesson(user, id); }
  @Post('nodes/:id/lesson/progress') @HttpCode(200) lessonProgress(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: ProgressDto) { return this.play.lessonProgress(user, id, body.read_percent); }
  @Post('nodes/:id/lesson/complete') @HttpCode(200) lessonComplete(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: LessonCompleteDto) { return this.play.completeLesson(user, id, body.answers); }

  @Get('practice') practice(@CurrentUser() user: UserRow) { return this.play.practiceInfo(user); }
  @Post('practice/start') @HttpCode(200) startPractice(@CurrentUser() user: UserRow) { return this.play.startPractice(user); }

  @Post('quizzes/:id/preview') @Roles('teacher', 'school_admin', 'root_admin') @HttpCode(200)
  preview(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.play.startPreview(user, id); }

  @Get('attempts/:id') @Roles('student', 'teacher', 'school_admin', 'root_admin')
  attempt(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.play.attempt(user, id); }
  @Post('attempts/:id/answer') @Roles('student', 'teacher', 'school_admin', 'root_admin') @HttpCode(200)
  answer(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: AnswerDto) { return this.play.answer(user, id, body.question_id, body.answer); }
  @Post('attempts/:id/hint') @Roles('student') @HttpCode(200)
  hint(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.play.hint(user, id); }
  @Post('attempts/:id/next') @Roles('student', 'teacher', 'school_admin', 'root_admin') @HttpCode(200)
  next(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.play.next(user, id); }
  @Get('attempts/:id/review') @Roles('student', 'teacher', 'school_admin', 'root_admin')
  review(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.play.review(user, id); }

  @Get('notes') notes(@CurrentUser() user: UserRow) { return this.play.notes(user); }
  @Put('notes/:type/:id') saveNote(@CurrentUser() user: UserRow, @Param('type', new ParseEnumPipe(NOTE_TYPES)) type: 'lesson' | 'source', @Param('id', ParseIntPipe) id: number, @Body() body: NoteDto) { return this.play.saveNote(user, type, id, body.body); }
  @Delete('notes/:type/:id') @HttpCode(204) async removeNote(@CurrentUser() user: UserRow, @Param('type') type: string, @Param('id', ParseIntPipe) id: number) { await this.play.removeNote(user, type, id); }

  @Get('favorites') favorites(@CurrentUser() user: UserRow) { return this.play.favorites(user); }
  @Put('favorites/:id') favorite(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.play.setFavorite(user, id, true); }
  @Delete('favorites/:id') unfavorite(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.play.setFavorite(user, id, false); }

  @Post('events') @HttpCode(200)
  event(@CurrentUser() user: UserRow, @Body() body: ViewEventDto) { return this.play.viewEvent(user, body.event, body.ref_type ?? null, body.ref_id ?? null, body.duration_ms ?? null); }
}
