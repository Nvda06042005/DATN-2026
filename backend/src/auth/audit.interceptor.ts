import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { defer, from, Observable, throwError } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';
import { DatabaseService, UserRow } from '../database/database.service';
import { SecurityService } from './security.service';

/** Record authenticated mutations without request bodies, credentials, query strings or response contents. */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly db: DatabaseService, private readonly security: SecurityService) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const actor: UserRow | undefined = req.user;
    if (!actor || !['POST','PATCH','PUT','DELETE'].includes(req.method)) return next.handle();
    const route: string = req.route?.path ?? '';
    const targetType = /\/(users|teachers|students)\b/.test(route) ? 'account' : route.includes('/history') ? 'history' : /\/school/.test(route) ? 'school' : route.includes('/classes') || route.includes('/student/') ? 'class' : 'system';
    return defer(async () => {
      const table = targetType === 'account' ? 'app_users' : targetType === 'class' ? 'app_classes' : null;
      if (!table || !/^\d+$/.test(req.params.id ?? '')) return null;
      return (await this.db.query<{ school_id: number | null }>(`SELECT school_id FROM ${table} WHERE id = $1 AND ($2::integer IS NULL OR school_id = $2)`, [Number(req.params.id), actor.role === 'root_admin' ? null : actor.school_id]))[0]?.school_id ?? null;
    }).pipe(mergeMap(beforeSchool => next.handle().pipe(
      mergeMap(result => {
        const data = result as { id?: number; school_id?: number | null; user?: { id: number; school_id: number | null }; school?: { id: number } } | undefined;
        const targetId = req.params.id ?? data?.user?.id ?? data?.school?.id ?? data?.id ?? null;
        const schoolId = data?.user?.school_id ?? data?.school_id ?? (targetType === 'school' && (data?.school?.id ?? data?.id) ? ((data?.school?.id ?? data?.id) as number) : beforeSchool ?? actor.school_id);
        return from(this.security.audit(actor, req.method + ' ' + route, targetType, targetId === null ? null : String(targetId), schoolId, true)).pipe(mergeMap(() => from([result])));
      }),
      catchError(error => from(this.security.audit(actor, req.method + ' ' + route, targetType, req.params.id ?? null, beforeSchool ?? actor.school_id, false)).pipe(mergeMap(() => throwError(() => error))))
    )));
  }
}
