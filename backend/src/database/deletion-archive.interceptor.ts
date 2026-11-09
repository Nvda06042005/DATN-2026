import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { defer, lastValueFrom, Observable } from 'rxjs';
import type { UserRow } from './database.service';
import { withDeletionContext } from './deletion-context';

/** Bao gồm DELETE, xóa thông báo bằng POST và dòng bị gỡ khi sửa danh sách. Trigger giữ nguyên RLS/quyền của thao tác gốc. */
@Injectable()
export class DeletionArchiveInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ user?: UserRow; method: string; route?: { path?: string } }>();
    if (!req.user || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next.handle();
    // Mẫu route thay vì URL thật: media/:token không làm lộ token, không lưu query/body.
    return defer(() => withDeletionContext(req.user!, `${req.method} ${req.route?.path ?? ''}`, () => lastValueFrom(next.handle())));
  }
}
