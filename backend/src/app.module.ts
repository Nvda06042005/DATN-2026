import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditInterceptor } from './auth/audit.interceptor';
import { SecurityService } from './auth/security.service';
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, INestApplication, Logger, Module, RequestMethod, UnprocessableEntityException, ValidationError, ValidationPipe } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AccountService } from './admin/account.service';
import { AdminController } from './admin/admin.controller';
import { ClassService } from './admin/class.service';
import { MailService } from './admin/mail.service';
import { SchoolService } from './admin/school.service';
import { AppController } from './app.controller';
import { AuthController } from './auth/auth.controller';
import { AuthGuard } from './auth/auth.guard';
import { AuthService } from './auth/auth.service';
import { BattleController } from './battle/battle.controller';
import { BattleService } from './battle/battle.service';
import { WarCardsService } from './battle/war-cards.service';
import { WarController } from './battle/war.controller';
import { WarGate } from './battle/war-gate';
import { WarMarchService } from './battle/war-march.service';
import { WarService } from './battle/war.service';
import { AiAdminService } from './ai/ai-admin.service';
import { AiIndexService } from './ai/ai-index.service';
import { AiRetrievalService } from './ai/ai-retrieval.service';
import { AiSettingsService } from './ai/ai-settings.service';
import { AiToolsService } from './ai/ai-tools.service';
import { AiTutorService } from './ai/ai-tutor.service';
import { AiController } from './ai/ai.controller';
import { LlmClient } from './ai/llm.client';
import { AnalyticsController } from './analytics/analytics.controller';
import { AnalyticsJob } from './analytics/analytics.job';
import { AnalyticsService } from './analytics/analytics.service';
import { FeedbackService } from './analytics/feedback.service';
import { RecoService } from './analytics/reco.service';
import { PlatformAdminController } from './platform/platform-admin.controller';
import { ResearchService } from './platform/research.service';
import { SurveyController } from './platform/survey.controller';
import { SurveyService } from './platform/survey.service';
import { PlatformController } from './platform/platform.controller';
import { PlatformJob } from './platform/platform.job';
import { BackupService } from './platform/backup.service';
import { ErrorLog } from './platform/error-log';
import { LogsService } from './platform/logs.service';
import { NoticeService } from './platform/notice.service';
import { PolicyInterceptor } from './platform/policy.interceptor';
import { PrefsService } from './platform/prefs.service';
import { RbacService } from './platform/rbac.service';
import { json as jsonBody } from 'express';
import { DEFAULT_RATE, requestMiddleware } from './platform/request-context';
import { FaqService, SupportService } from './platform/support.service';
import { SystemService } from './platform/system.service';
import { TwoFactorService } from './platform/twofa.service';
import { AssignmentService } from './classroom/assignment.service';
import { ClassroomController } from './classroom/classroom.controller';
import { ClassroomService } from './classroom/classroom.service';
import { SkillService } from './classroom/skill.service';
import { config } from './config';
import { BoardService } from './game/board.service';
import { CatalogService } from './game/catalog.service';
import { GameClock } from './game/clock';
import { GameController } from './game/game.controller';
import { GameJob } from './game/game.job';
import { GameService } from './game/game.service';
import { SettingsService } from './game/settings';
import { ContentController } from './content/content.controller';
import { JourneyService } from './content/journey.service';
import { LessonService } from './content/lesson.service';
import { QuestionService } from './content/question.service';
import { QuizService } from './content/quiz.service';
import { ShareService } from './content/share.service';
import { DatabaseService } from './database/database.service';
import { HistoryController } from './history/history.controller';
import { HistoryService } from './history/history.service';
import { LiveController } from './live/live.controller';
import { LiveGateway } from './live/live.gateway';
import { LiveService } from './live/live.service';
import { LearnController, PlayController } from './student/learn.controller';
import { LearnService } from './student/learn.service';
import { PlayService } from './student/play.service';
import { StudentController } from './student/student.controller';

@Module({
  imports: [
    JwtModule.register({ secret: config.authSecret, signOptions: { algorithm: 'HS256', expiresIn: config.tokenTtlHours * 3600 }, verifyOptions: { algorithms: ['HS256'] } }),
  ],
  controllers: [AppController, AuthController, AdminController, HistoryController, ContentController, StudentController, LearnController, PlayController, GameController, BattleController, ClassroomController, LiveController, WarController, AiController, AnalyticsController, PlatformController, PlatformAdminController, SurveyController],
  providers: [SurveyService, ResearchService, SystemService, RbacService, LogsService, PrefsService, NoticeService, SupportService, FaqService, TwoFactorService, BackupService, PlatformJob, { provide: APP_INTERCEPTOR, useClass: PolicyInterceptor }, AnalyticsService, RecoService, FeedbackService, AnalyticsJob, LlmClient, AiSettingsService, AiRetrievalService, AiIndexService, AiTutorService, AiToolsService, AiAdminService, SecurityService, { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }, DatabaseService, AuthService, AuthGuard, MailService, SchoolService, AccountService, ClassService, HistoryService, QuestionService, QuizService, LessonService, JourneyService, ShareService, LearnService, PlayService, GameClock, SettingsService, GameService, BoardService, CatalogService, GameJob, BattleService, WarGate, WarCardsService, WarMarchService, WarService, ClassroomService, AssignmentService, SkillService, LiveService, LiveGateway],
})
export class AppModule {}

/** Lỗi trả về dạng {"detail": ...} như FastAPI cũ để frontend hiển thị được */
@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exc: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<{ status(code: number): { json(body: unknown): void } }>();
    if (!(exc instanceof HttpException)) {
      this.logger.error(`Lỗi không xử lý được (${(exc as Error)?.name ?? 'Error'})`, (exc as Error)?.stack);
      const req = host.switchToHttp().getRequest<{ method?: string; originalUrl?: string; user?: { id: number; school_id: number | null } }>();
      ErrorLog.report('api', `${(exc as Error)?.name ?? 'Error'}: ${(exc as Error)?.message ?? ''}`, { route: `${req.method ?? ''} ${(req.originalUrl ?? '').split('?')[0]}`.trim(), status: 500, user_id: req.user?.id ?? null, school_id: req.user?.school_id ?? null });
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ detail: 'Lỗi máy chủ, thử lại sau' });
      return;
    }
    const body = exc.getResponse();
    const detail = typeof body === 'string' ? body : ((body as { detail?: unknown }).detail ?? (body as { message?: unknown }).message ?? exc.message);
    res.status(exc.getStatus()).json({ detail });
  }
}

/** Lỗi kiểm tra dữ liệu: 422, detail là danh sách {loc, msg, type} */
function validationErrors(errors: ValidationError[]): UnprocessableEntityException {
  const flat = (list: ValidationError[], path: string[]): Array<{ loc: string[]; msg: string; type: string }> =>
    list.flatMap((e) => [
      ...Object.entries(e.constraints ?? {}).map(([type, msg]) => ({ loc: ['body', ...path, e.property], msg, type })),
      ...flat(e.children ?? [], [...path, e.property]),
    ]);
  return new UnprocessableEntityException({ detail: flat(errors, []) });
}

/** Cấu hình dùng chung cho main.ts và kiểm thử */
export function configureApp(app: INestApplication): INestApplication {
  app.enableCors({ origin: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Authorization', 'Content-Type'] });
  app.setGlobalPrefix('api', { exclude: [{ path: '/', method: RequestMethod.GET }] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, exceptionFactory: validationErrors }));
  app.useGlobalFilters(new ErrorFilter());
  // ngữ cảnh yêu cầu (IP, thiết bị) và giới hạn tần suất theo IP (HK.SYS.018); giới hạn đọc từ cấu hình hệ thống, mặc định theo môi trường
  const ipLimit = async (): Promise<number> => {
    try { return (await app.get(SystemService, { strict: false }).settings()).rate_ip_per_min ?? DEFAULT_RATE.ip(); } catch { return DEFAULT_RATE.ip(); }
  };
  app.use(requestMiddleware(ipLimit));
  // yêu cầu hỗ trợ kèm ảnh chụp màn hình (tối đa 1,5 MB, mã hóa base64 nên lớn hơn): chỉ tuyến này được nhận thân lớn hơn mặc định
  const largeJson = jsonBody({ limit: '3mb' });
  app.use((req: { path?: string; originalUrl?: string }, res: unknown, next: () => void) => (/^\/api\/platform\/support(\/|$|\?)/.test(req.originalUrl ?? '') ? (largeJson as any)(req, res, next) : next()));
  app.enableShutdownHooks();
  return app;
}
