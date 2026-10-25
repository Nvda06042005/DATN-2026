import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { XLSX_UPLOAD } from '../admin/admin.controller';
import { SchoolService, UploadedXlsx } from '../admin/school.service';
import { AuthGuard, CurrentUser, Roles } from '../auth/auth.guard';
import { DatabaseService, UserRow } from '../database/database.service';
import { ContentService } from '../student/content.service';
import * as prog from '../student/progress';

class LimitQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 10;
}

class ClassRequestDto {
  @IsString() @Length(2, 20) class_code: string;
  @IsString() @Length(9, 9) school_year: string;
  @IsString() @Length(2, 80) name: string;
  @IsString() @Length(4, 64) join_password: string;
}

const round3 = (x: number): number => Math.round(x * 1000) / 1000;

/** /api/teacher: lớp đang dạy (tiến độ học sinh thật), lịch sử thi đấu, yêu cầu mở lớp, nhập tài khoản học sinh từ file Excel mẫu */
@Controller('teacher')
@UseGuards(AuthGuard)
@Roles('teacher')
export class TeacherController {
  constructor(
    private readonly db: DatabaseService,
    private readonly content: ContentService,
    private readonly school: SchoolService,
  ) {}

  /** Yêu cầu mở lớp của giáo viên (chờ duyệt, đã duyệt, bị từ chối) */
  @Get('classes')
  classes(@CurrentUser() user: UserRow) {
    return this.school.teacherClasses(user);
  }

  @Post('classes')
  createClass(@CurrentUser() user: UserRow, @Body() body: ClassRequestDto) {
    return this.school.createClass(user, body);
  }

  /** Chọn lớp đang dạy (trả về tài khoản đã cập nhật class_name) */
  @Post('classes/:id/activate')
  @HttpCode(200)
  activate(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) {
    return this.school.activateClass(user, id);
  }

  /** Nhập tài khoản học sinh của trường mình từ file Excel mẫu (dòng giáo viên bị từ chối) */
  @Post('import')
  @HttpCode(200)
  @UseInterceptors(XLSX_UPLOAD)
  importExcel(@CurrentUser() user: UserRow, @UploadedFile() file: UploadedXlsx | undefined) {
    return this.school.importExcel(user, file);
  }

  @Get('imports')
  imports(@CurrentUser() user: UserRow) {
    return this.school.imports(user);
  }

  @Get('imports/:id')
  importReport(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) {
    return this.school.importReport(user, id);
  }

  @Get('class')
  async myClass(@CurrentUser() user: UserRow) {
    const students = await this.db.studentsInClass(user.class_name, user.school_id);
    const progress = await this.db.allProgress();
    const week = prog.weekKey();
    const wrongTotals = new Map<string, [number, number, number]>();
    const unitScores = new Map<string, number[]>();
    const roster = students.map((s) => {
      const p = progress.get(s.id);
      const camp = prog.campaignStars(p);
      for (const [qid, row] of Object.entries(prog.loadJson(p?.question_stats))) {
        if (Array.isArray(row) && row.length >= 2 && this.content.questions.has(qid)) {
          const total = wrongTotals.get(qid) ?? [0, 0, 0];
          total[0] += Number(row[0]);
          total[1] += Number(row[1]);
          total[2] += Number(row[1]) ? 1 : 0;
          wrongTotals.set(qid, total);
        }
      }
      for (const [uid, rec] of Object.entries(prog.loadJson(p?.bkt_state))) {
        if (rec && typeof rec === 'object' && rec.attempts) unitScores.set(uid, [...(unitScores.get(uid) ?? []), Number(rec.p_l ?? 0)]);
      }
      return {
        id: s.id, full_name: s.full_name, username: s.username, is_active: s.is_active, must_change_password: s.must_change_password, last_login_at: s.last_login_at,
        xp: Number(p?.xp ?? 0), week_xp: p?.week_key === week ? Number(p?.week_xp ?? 0) : 0, streak: prog.effectiveStreak(p),
        lessons_completed: Number(p?.lessons_completed ?? 0), perfect_runs: Number(p?.perfect_runs ?? 0), questions_answered: Number(p?.questions_answered ?? 0),
        accuracy: prog.accuracy(p), avg_mastery: prog.avgMastery(p), ai_questions: Number(p?.ai_questions ?? 0),
        campaign_stars: camp, stars: camp.reduce((a, b) => a + b, 0), heroes: prog.heroCount(p),
      };
    });
    roster.sort((a, b) => b.xp - a.xp || a.full_name.localeCompare(b.full_name));
    const accs = roster.map((r) => r.accuracy).filter((v): v is number => v !== null);
    const masteries = roster.map((r) => r.avg_mastery).filter((v): v is number => v !== null);
    const mean = (xs: number[]) => (xs.length ? round3(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
    const topWrong = [...wrongTotals.entries()]
      .filter(([, t]) => t[1] > 0)
      .sort(([qa, a], [qb, b]) => b[1] - a[1] || b[2] - a[2] || qa.localeCompare(qb))
      .slice(0, 5)
      .map(([qid, t]) => {
        const q = this.content.questions.get(qid)!;
        return { question_id: qid, prompt: q.prompt, unit_id: q.unit_id, topic: this.content.topicOf(q.unit_id), attempts: t[0], wrong: t[1], students: t[2] };
      });
    const unitMastery = [...unitScores.entries()]
      .filter(([uid]) => this.content.isLearningUnit(uid))
      .map(([uid, v]) => ({ unit_id: uid, topic: this.content.topicOf(uid), avg_p_l: mean(v)!, students: v.length }))
      .sort((a, b) => a.avg_p_l - b.avg_p_l);
    const needsSupport = roster.flatMap((r) => {
      const reasons: string[] = [];
      if (!prog.activeWithin(r.last_login_at, 7)) reasons.push('Chưa vào học 7 ngày qua');
      if (r.accuracy !== null && r.questions_answered >= 5 && r.accuracy < 0.5) reasons.push(`Trả lời đúng ${Math.round(r.accuracy * 100)}%`);
      if (r.avg_mastery !== null && r.avg_mastery < 0.4) reasons.push(`Mức nắm vững trung bình ${Math.round(r.avg_mastery * 100)}%`);
      return reasons.length ? [{ id: r.id, full_name: r.full_name, reasons }] : [];
    });
    return {
      class_name: user.class_name,
      students: roster,
      summary: {
        total: roster.length, active_7d: roster.filter((r) => prog.activeWithin(r.last_login_at, 7)).length, practiced: roster.filter((r) => r.questions_answered > 0).length,
        avg_accuracy: mean(accs), best_streak: Math.max(0, ...roster.map((r) => r.streak)), total_stars: roster.reduce((a, r) => a + r.stars, 0), avg_mastery: mean(masteries),
      },
      top_wrong: topWrong,
      unit_mastery: unitMastery,
      needs_support: needsSupport,
    };
  }

  /** Các trận thi đấu đã lưu (mới nhất trước) kèm thống kê từng câu */
  @Get('live-sessions')
  async liveSessions(@CurrentUser() user: UserRow, @Query() query: LimitQuery) {
    return (await this.db.liveSessionsForTeacher(user.id, query.limit)).map((s) => {
      let rows: unknown = [];
      try {
        rows = JSON.parse(String(s.question_stats ?? '[]'));
      } catch {
        rows = [];
      }
      const questions = (Array.isArray(rows) ? rows : [])
        .map((row: { id?: string; answered?: number; correct?: number }) => {
          const q = row?.id ? this.content.questions.get(row.id) : undefined;
          return q ? { question_id: q.id, prompt: q.prompt, topic: this.content.topicOf(q.unit_id), answered: Number(row.answered ?? 0), correct: Number(row.correct ?? 0) } : null;
        })
        .filter((q): q is NonNullable<typeof q> => q !== null);
      const answered = questions.reduce((a, q) => a + q.answered, 0);
      return {
        id: s.id, title: s.title, scope: s.scope, class_name: s.class_name ?? null, question_count: Number(s.question_count), player_count: Number(s.player_count),
        started_at: s.started_at, finished_at: s.finished_at, accuracy: answered ? round3(questions.reduce((a, q) => a + q.correct, 0) / answered) : null,
        results: s.results.map(({ user_id, full_name, rank, score, correct, answered: a }) => ({ user_id, full_name, rank, score, correct, answered: a })),
        questions,
      };
    });
  }
}
