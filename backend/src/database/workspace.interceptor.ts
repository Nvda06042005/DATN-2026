import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { defer, lastValueFrom, Observable } from 'rxjs';
import { DatabaseService, UserRow } from './database.service';

/** Cả API quản lý và API người học dùng cùng RLS, kể cả yêu cầu đồng thời của hai trường. */
@Injectable()
export class WorkspaceInterceptor implements NestInterceptor {
  constructor(private readonly db: DatabaseService) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ user?: UserRow; originalUrl?: string; url: string }>();
    const path = (req.originalUrl ?? req.url).split('?')[0];
    const isWorkspace = /^\/api\/(admin\/history|content|learn|play|game|battle|war|ai|analytics)(\/|$)/.test(path)
      || /^\/api\/platform\/(experiments|research|survey-templates|surveys)(\/|$)/.test(path);
    if (!req.user || req.user.role === 'root_admin' || !isWorkspace) return next.handle();
    return defer(() => this.db.withWorkspace(req.user!, () => lastValueFrom(next.handle())));
  }
}
