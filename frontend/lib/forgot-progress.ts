/**
 * Tiến độ "Quên mật khẩu" giữ trong sessionStorage của tab (chỉ trên web). Người dùng sang hộp thư lấy mã rồi quay lại: trình duyệt có thể đã giải phóng
 * hoặc tải lại tab, khi đó hộp quên mật khẩu mở lại đúng bước đang làm thay vì về màn đăng nhập trắng.
 *
 * Chỉ giữ hai bước sau khi đã có mã: "code" (đã gửi mã, mã sống 5 phút) và "password" (mã đúng, phiếu đổi mật khẩu sống 10 phút, một lần dùng).
 * Hết hạn thì bỏ. Xong, đóng hộp hoặc xin mã mới thì xóa. Mật khẩu người dùng gõ không bao giờ được lưu.
 */
export type ForgotStep = 'code' | 'password';
export interface ForgotProgress { scope: string; step: ForgotStep; identifier: string; ticket?: string; at: number }

const KEY = 'donga_forgot_progress';
/** Thời gian còn dùng được của từng bước, tính từ lúc vào bước đó (khớp với máy chủ: mã OTP 5 phút, phiếu 10 phút) */
export const FORGOT_TTL_MS: Record<ForgotStep, number> = { code: 5 * 60_000, password: 10 * 60_000 };

const store = (): Storage | null => {
  try { return typeof sessionStorage === 'undefined' ? null : sessionStorage; } catch { return null; }
};

export const clearForgotProgress = (): void => {
  try { store()?.removeItem(KEY); } catch { /* trình duyệt chặn lưu trữ: bỏ qua */ }
};

/** Chỉ lấy đúng các trường của tiến độ: dù người gọi truyền thêm gì (mã OTP, mật khẩu) cũng không được ghi xuống bộ nhớ của trình duyệt */
export const saveForgotProgress = ({ scope, step, identifier, ticket }: Omit<ForgotProgress, 'at'>, now = Date.now()): void => {
  const record: ForgotProgress = { scope, step, identifier, ...(ticket ? { ticket } : {}), at: now };
  try { store()?.setItem(KEY, JSON.stringify(record)); } catch { /* đầy hoặc bị chặn: người dùng chỉ mất khả năng khôi phục */ }
};

/** Tiến độ còn hạn của đúng cổng đăng nhập (`scope`), hoặc null. Bản ghi hỏng, hết hạn hoặc của cổng khác thì không dùng; hết hạn hoặc hỏng thì xóa. */
export const loadForgotProgress = (scope: string, now = Date.now()): ForgotProgress | null => {
  try {
    const raw = store()?.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<ForgotProgress>;
    const valid = typeof p.scope === 'string' && (p.step === 'code' || p.step === 'password') && typeof p.identifier === 'string' && p.identifier !== ''
      && typeof p.at === 'number' && (p.step === 'code' || (typeof p.ticket === 'string' && p.ticket !== ''));
    if (!valid) { clearForgotProgress(); return null; }
    if (now - (p.at as number) > FORGOT_TTL_MS[p.step as ForgotStep] || (p.at as number) > now + 60_000) { clearForgotProgress(); return null; }
    return p.scope === scope ? (p as ForgotProgress) : null;
  } catch {
    clearForgotProgress();
    return null;
  }
};
