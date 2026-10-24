import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';
import { AuthGuard, CurrentUser, Roles } from '../auth/auth.guard';
import type { UserRow } from '../database/database.service';
import { AiService } from './ai.service';

class ChatDto {
  @IsString() @Length(1, 1000) query: string;
  @IsOptional() @IsString() @MaxLength(120) session_id?: string;
  @IsOptional() @IsString() @MaxLength(120) character_id?: string;
}

class QuizDto {
  @IsOptional() @IsString() @MaxLength(300) topic = 'Ba lần kháng chiến chống quân Mông - Nguyên (1258 - 1288)';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(20) num_questions = 4;
  @IsOptional() @IsString() @MaxLength(60) cognitive_level = 'Tất cả mức độ';
}

class StoryDto {
  @IsOptional() @IsString() @MaxLength(200) campaign_name = 'Ba lần kháng chiến chống quân Mông - Nguyên';
  @IsOptional() @IsString() @MaxLength(200) stage_title = 'Trận địa cọc ngầm sông Bạch Đằng';
  @IsOptional() @IsString() @MaxLength(400) key_event?: string;
}

/** Tính năng AI (dịch vụ Python): cần đăng nhập để không ai dùng chùa hạn mức Gemini */
@Controller()
@UseGuards(AuthGuard)
export class AiController {
  constructor(private readonly ai: AiService) {}

  /** Quân Sư AI: NLP + truy xuất kho tri thức (RAG) + LLM; mỗi người dùng một phiên hội thoại riêng */
  @Post('chat/dong-a')
  @HttpCode(200)
  chat(@CurrentUser() user: UserRow, @Body() body: ChatDto) {
    return this.ai.forward('/chat', { query: body.query, character_id: body.character_id ?? null, session_id: `user_${user.id}_${body.session_id ?? 'chat'}` }, 30_000);
  }

  @Post('quiz/generate')
  @HttpCode(200)
  @Roles('teacher')
  quiz(@Body() body: QuizDto) {
    return this.ai.forward('/quiz/generate', body);
  }

  @Post('story/generate')
  @HttpCode(200)
  @Roles('teacher')
  story(@Body() body: StoryDto) {
    return this.ai.forward('/story/generate', body);
  }
}
