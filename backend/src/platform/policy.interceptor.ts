/**
 * Chính sách áp dụng sau khi đã xác thực (Sprint 11): giới hạn tần suất theo người dùng và riêng cho AI (HK.SYS.018), cờ bật / tắt tính năng (HK.AD.071),
 * ma trận phân quyền (HK.AD.026) và công tắc AI của từng trường (HK.AD.017). Chạy như interceptor để đã có `request.user`; không đụng đến mã của từng chức năng.
 */
import { CallHandler, ExecutionContext, ForbiddenException, HttpException, Injectable, NestInterceptor } from '@nestjs/common';
import { defer, mergeMap, Observable } from 'rxjs';
import { UserRow } from '../database/database.service';
import { DEFAULT_RATE, limiter } from './request-context';
import { FEATURE_ROUTES, RbacService } from './rbac.service';
import { SystemService } from './system.service';

/** Đường dẫn của người học / người dùng cuối (không phải trang quản trị) thuộc cờ tính năng nào */
const FLAG_ROUTES: Array<{ flag: string; re: RegExp; what: string }> = [
  { flag: 'ai_tutor', re: /^\/api\/ai\/(?!admin\/)/, what: 'AI Tutor' },
  { flag: 'leagues', re: /^\/api\/game\/(league|contests)/, what: 'Giải đấu' },
  { flag: 'shop', re: /^\/api\/game\/shop/, what: 'Cửa hàng' },
  { flag: 'live_quiz', re: /^\/api\/live\//, what: 'Thi đấu trực tiếp' },
  { flag: 'war_game', re: /^\/api\/war\/(?!admin\/)/, what: 'Game thẻ tướng' },
  { flag: 'recommendations', re: /^\/api\/analytics\/me\//, what: 'Gợi ý học tập' },
];
const AI_CALL = /^\/api\/ai\/(ask|explain|summarize|teacher\/)/;

@Injectable()
export class PolicyInterceptor implements NestInterceptor {
  constructor(private readonly system: SystemService, private readonly rbac: RbacService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<{ user?: UserRow; method: string; originalUrl?: string; url: string; body?: Record<string, unknown> }>();
    const user = req.user;
    if (!user) return next.handle();
    const path = (req.originalUrl ?? req.url).split('?')[0];
    return defer(async () => {
      const s = await this.system.settings();
      const wait = limiter.hit(`u:${user.id}`, s.rate_user_per_min ?? DEFAULT_RATE.user());
      if (wait > 0) this.tooMany(http.getResponse(), wait, 'Bạn thao tác quá nhanh');
      if (req.method === 'POST' && AI_CALL.test(path)) {
        const aiWait = limiter.hit(`ai:${user.id}`, s.rate_ai_per_min ?? DEFAULT_RATE.ai());
        if (aiWait > 0) this.tooMany(http.getResponse(), aiWait, 'Bạn hỏi AI quá nhanh');
      }
      for (const r of FLAG_ROUTES) if (r.re.test(path) && !(await this.system.isOn(r.flag))) throw new ForbiddenException(`${r.what} đang được quản trị viên tạm tắt`);
      if (req.method === 'POST' && path === '/api/ai/ask' && req.body?.mode === 'roleplay' && !(await this.system.isOn('roleplay'))) throw new ForbiddenException('Trò chuyện nhập vai đang được quản trị viên tạm tắt');
      for (const r of FEATURE_ROUTES) {
        if (r.re.test(path) && (!r.method || r.method === req.method) && !(await this.rbac.can(user.role, r.key))) throw new ForbiddenException(r.message);
      }
      if (/^\/api\/ai\/(?!admin\/)/.test(path) && user.school_id && !(await this.system.aiAllowed(user.school_id))) throw new ForbiddenException('AI Tutor đang tạm tắt cho trường của bạn');
    }).pipe(mergeMap(() => next.handle()));
  }

  private tooMany(res: { setHeader?: (k: string, v: string) => void }, wait: number, message: string): never {
    res.setHeader?.('Retry-After', String(wait));
    throw new HttpException(`${message}. Vui lòng thử lại sau ${wait} giây.`, 429);
  }
}
