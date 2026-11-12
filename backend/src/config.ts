import 'dotenv/config';
import { randomBytes } from 'crypto';
import { resolve } from 'path';

/** Cấu hình đọc từ biến môi trường (hoặc file backend/.env khi chạy trên máy). */
const env = (key: string, fallback = ''): string => (process.env[key] ?? fallback).trim();
const repoRoot = resolve(__dirname, '..', '..');
const secret = env('AUTH_SECRET_KEY');

export const config = {
  port: Number(env('PORT', '8000')) || 8000,
  /** PostgreSQL (Supabase): backend tự chạy database/migrations/*.sql khi khởi động */
  databaseUrl: env('DATABASE_URL'),
  /** Khóa ký token đăng nhập; để trống thì sinh tạm mỗi lần khởi động (mọi phiên mất hiệu lực khi restart) */
  authSecret: secret || randomBytes(32).toString('hex'),
  authSecretFromEnv: Boolean(secret),
  tokenTtlHours: Number(env('TOKEN_TTL_HOURS', '12')) || 12,
  /** Tài khoản quản trị tổng được tạo ở lần chạy đầu tiên – đăng nhập tại trang /admin */
  adminUsername: env('ADMIN_USERNAME', 'admin').toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD ?? 'admin@123',
  /** Email của quản trị tổng: nơi nhận mã OTP "Quên mật khẩu" (chỉ điền khi tài khoản chưa có email) */
  adminEmail: env('ADMIN_EMAIL').toLowerCase(),
  migrationsDir: env('MIGRATIONS_DIR') ? resolve(env('MIGRATIONS_DIR')) : resolve(repoRoot, 'database', 'migrations'),
  /** Phần sau @ của tên đăng nhập sinh tự động */
  accountDomain: env('ACCOUNT_DOMAIN', 'donga.local').toLowerCase(),
  /** Địa chỉ website ghi trong email gửi tài khoản */
  appUrl: env('APP_URL', 'https://datn-2026-indol.vercel.app').replace(/\/+$/, ''),
  publicApiUrl: env('PUBLIC_API_URL', env('RENDER_EXTERNAL_URL', 'https://dong-a-api.onrender.com')).replace(/\/+$/, ''),
  /** Đăng nhập Google (HK.HS.002): OAuth client ID của ứng dụng web; để trống thì tắt tính năng */
  googleClientId: env('GOOGLE_CLIENT_ID'),
  /** Gửi email: SMTP_URL (smtps://user:pass@host:465) hoặc SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS; MAIL_TRANSPORT=json chỉ ghi nhận (kiểm thử) */
  smtpUrl: env('SMTP_URL'),
  smtpHost: env('SMTP_HOST'),
  smtpPort: Number(env('SMTP_PORT', '587')) || 587,
  smtpUser: env('SMTP_USER'),
  smtpPass: process.env.SMTP_PASS ?? '',
  /** Cầu gửi thư qua HTTPS (Google Apps Script, xem backend/mail-relay.gs) cho nơi chặn cổng SMTP như Render Free; cần cả hai biến, ưu tiên hơn SMTP */
  mailRelayUrl: env('MAIL_RELAY_URL'),
  mailRelaySecret: env('MAIL_RELAY_SECRET'),
  mailFrom: env('MAIL_FROM', 'Đông A EDU <no-reply@donga.local>'),
  mailTransport: env('MAIL_TRANSPORT'),
  /** Tiến trình nền gửi thư mỗi 4 giây (kiểm thử đặt MAIL_WORKER=off để tự gọi từng lượt) */
  mailWorker: env('MAIL_WORKER', 'on') !== 'off',
  /**
   * AI Tutor (Sprint 9): mô hình và khóa API có thể đặt bằng biến môi trường (ưu tiên hơn trang quản trị) để khóa không nằm trong CSDL; không bao giờ ghi vào Git.
   * AI_PROVIDER = anthropic | openai (openai gồm mọi API tương thích: Gemini, Ollama, vLLM…); AI_BASE_URL tùy chọn.
   */
  aiProvider: env('AI_PROVIDER').toLowerCase(),
  aiApiKey: process.env.AI_API_KEY ?? '',
  aiBaseUrl: env('AI_BASE_URL'),
  aiChatModel: env('AI_CHAT_MODEL'),
  aiEmbedModel: env('AI_EMBED_MODEL'),
  /** Tự lập chỉ mục khi nội dung công bố thay đổi và lúc khởi động; kiểm thử đặt AI_INDEX_JOB=off để tự gọi lập chỉ mục */
  aiIndexJob: env('AI_INDEX_JOB', 'on') !== 'off',
};
