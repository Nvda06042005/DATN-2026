/**
 * Ghi nhật ký lỗi (Sprint 11, HK.AD.076, HK.SYS.020) từ mọi nơi mà không cần tiêm phụ thuộc: bộ lọc lỗi, bộ gọi AI, việc nền…
 * LogsService gắn "nơi ghi" khi khởi động; chưa gắn (kiểm thử đơn vị) thì bỏ qua. Việc ghi không bao giờ được làm hỏng luồng chính.
 */
export type ErrorSource = 'api' | 'ai' | 'email' | 'job' | 'db';
export interface ErrorEntry { source: ErrorSource; message: string; route?: string | null; status?: number | null; user_id?: number | null; school_id?: number | null }
type Sink = (entry: ErrorEntry) => void;

let sink: Sink | null = null;

export const ErrorLog = {
  setSink(next: Sink | null): void { sink = next; },
  report(source: ErrorSource, message: unknown, extra: Partial<Omit<ErrorEntry, 'source' | 'message'>> = {}): void {
    try { sink?.({ source, message: String(message ?? 'Lỗi không rõ').replace(/\s+/g, ' ').slice(0, 500), ...extra }); } catch { /* bỏ qua */ }
  },
};
