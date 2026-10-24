import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, INestApplication, Logger, Module, RequestMethod, UnprocessableEntityException, ValidationError, ValidationPipe } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminController } from './admin/admin.controller';
import { AiController } from './ai/ai.controller';
import { AiService } from './ai/ai.service';
import { AppController } from './app.controller';
import { AuthController } from './auth/auth.controller';
import { AuthGuard } from './auth/auth.guard';
import { AuthService } from './auth/auth.service';
import { config } from './config';
import { DatabaseService } from './database/database.service';
import { LiveGateway } from './live/live.gateway';
import { LiveHub } from './live/live.hub';
import { ContentService } from './student/content.service';
import { StudentController } from './student/student.controller';
import { StudentService } from './student/student.service';
import { TeacherController } from './teacher/teacher.controller';

@Module({
  imports: [JwtModule.register({ secret: config.authSecret, signOptions: { algorithm: 'HS256', expiresIn: config.tokenTtlHours * 3600 }, verifyOptions: { algorithms: ['HS256'] } })],
  controllers: [AppController, AuthController, AdminController, StudentController, TeacherController, AiController],
  providers: [DatabaseService, AuthService, AuthGuard, ContentService, AiService, StudentService, LiveHub, LiveGateway],
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
  app.enableShutdownHooks();
  return app;
}
