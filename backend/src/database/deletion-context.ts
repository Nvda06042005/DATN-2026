import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

/** Chỉ lấy từ AuthGuard, không lấy người xóa/trường từ body, query hay header do khách gửi. Không chứa token hoặc request body. */
export interface DeletionContext {
  operation_id: string; actor_id: number; actor_name: string; actor_role: string; actor_school_id: number | null; route: string;
}
export const deletionContext = new AsyncLocalStorage<DeletionContext>();
export function withDeletionContext<T>(user: { id: number; full_name: string; role: string; school_id: number | null }, route: string, run: () => T): T {
  return deletionContext.run({ operation_id: randomUUID(), actor_id: user.id, actor_name: user.full_name, actor_role: user.role, actor_school_id: user.school_id, route }, run);
}
