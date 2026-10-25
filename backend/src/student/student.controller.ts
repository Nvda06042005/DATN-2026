import { Body, Controller, Get, HttpCode, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsObject, IsOptional, IsString, Length, Matches, Max, MaxLength, Min } from 'class-validator';
import { SchoolService } from '../admin/school.service';
import { AuthGuard, CurrentUser, Roles } from '../auth/auth.guard';
import type { UserRow } from '../database/database.service';
import { ContentService } from './content.service';
import { StudentService } from './student.service';

class JoinClassDto {
  @IsString() @Length(2, 20) class_code: string;
  @IsString() @Length(1, 64) password: string;
}

class GameStateDto {
  @IsObject() state: Record<string, unknown>;
}

class QuestionsQuery {
  /** Danh sách unit_id, cách nhau bởi dấu phẩy */
  @IsOptional() @IsString() units?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(15) count = 5;
  @IsOptional() @IsIn(['mixed', 'weak']) mode = 'mixed';
  /** Mã câu đã gặp trong phiên (ưu tiên câu mới) */
  @IsOptional() @IsString() exclude?: string;
  /** Lọc dạng câu: mcq,tf,order,match,map */
  @IsOptional() @IsString() types?: string;
  /** Lọc mức độ: NHAN_BIET,THONG_HIEU,VAN_DUNG */
  @IsOptional() @IsString() levels?: string;
}

class AiQuestionsDto {
  @IsOptional() @Matches(/^[A-Z0-9_]{1,64}$/) unit_id?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5) count = 3;
}

class AnswerDto {
  @Matches(/^[A-Za-z0-9_-]{1,64}$/) question_id: string;
  /** Lựa chọn: số (mcq), true/false (tf) hoặc mã địa danh (map) – giữ nguyên kiểu để chấm */
  @IsOptional() choice?: unknown;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsInt({ each: true }) order?: number[];
  @IsOptional() @IsObject() pairs?: Record<string, number>;
}

class QuizCompleteDto {
  @Type(() => Number) @IsInt() @Min(0) @Max(50) correct: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(50) total: number;
}

class GemsDto {
  /** Chỉ được tiêu Ấn Tín (số âm) */
  @Type(() => Number) @IsInt() @Min(-100_000) @Max(-1) delta: number;
  @IsOptional() @IsString() @MaxLength(80) reason = '';
}

class TopKQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10) top_k = 5;
}

/** /api/student: tiến độ, trạng thái game, câu hỏi (server chọn và chấm), Sử Ký, bảng xếp hạng lớp */
@Controller('student')
@UseGuards(AuthGuard)
@Roles('student')
export class StudentController {
  constructor(
    private readonly student: StudentService,
    private readonly content: ContentService,
    private readonly school: SchoolService,
  ) {}

  /** Lớp đã vào (mã lớp + mật khẩu lớp do giáo viên phát sau khi lớp được duyệt) */
  @Get('classes')
  classes(@CurrentUser() user: UserRow) {
    return this.school.studentClasses(user);
  }

  @Post('classes/join')
  @HttpCode(200)
  joinClass(@CurrentUser() user: UserRow, @Body() body: JoinClassDto) {
    return this.school.joinClass(user, body.class_code, body.password);
  }

  @Get('progress')
  progress(@CurrentUser() user: UserRow) {
    return this.student.progress(user);
  }

  @Get('game')
  getGame(@CurrentUser() user: UserRow) {
    return this.student.getGame(user);
  }

  @Put('game')
  putGame(@CurrentUser() user: UserRow, @Body() body: GameStateDto) {
    return this.student.putGame(user, body.state);
  }

  @Get('questions')
  questions(@CurrentUser() user: UserRow, @Query() query: QuestionsQuery) {
    return this.student.questions(user, query);
  }

  @Post('questions/ai')
  @HttpCode(200)
  aiQuestions(@CurrentUser() user: UserRow, @Body() body: AiQuestionsDto) {
    return this.student.aiQuestions(user, body.unit_id, body.count);
  }

  @Post('answer')
  @HttpCode(200)
  answer(@CurrentUser() user: UserRow, @Body() body: AnswerDto) {
    return this.student.answer(user, body);
  }

  @Post('quiz-complete')
  @HttpCode(200)
  quizComplete(@CurrentUser() user: UserRow, @Body() body: QuizCompleteDto) {
    return this.student.quizComplete(user, body.correct, body.total);
  }

  @Post('ai-question')
  @HttpCode(200)
  aiQuestion(@CurrentUser() user: UserRow) {
    return this.student.aiQuestion(user);
  }

  @Post('gems')
  @HttpCode(200)
  gems(@CurrentUser() user: UserRow, @Body() body: GemsDto) {
    return this.student.spendGems(user, body.delta);
  }

  @Get('leaderboard')
  leaderboard(@CurrentUser() user: UserRow) {
    return this.student.leaderboard(user);
  }

  @Get('recommendations')
  recommendations(@CurrentUser() user: UserRow, @Query() query: TopKQuery) {
    return this.student.recommendations(user, query.top_k);
  }

  @Get('codex')
  codex() {
    return this.content.codex;
  }
}
