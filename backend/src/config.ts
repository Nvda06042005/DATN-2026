import 'dotenv/config';
import { randomBytes } from 'crypto';
import { resolve } from 'path';

/** Cấu hình đọc từ biến môi trường (hoặc file backend/.env khi chạy trên máy). */
const env = (key: string, fallback = ''): string => (process.env[key] ?? fallback).trim();
const repoRoot = resolve(__dirname, '..', '..');
const secret = env('AUTH_SECRET_KEY');
/** Render cấp địa chỉ nội bộ dạng host:port (không có http://) */
const aiUrl = env('AI_SERVICE_URL', 'http://localhost:8001').replace(/\/+$/, '');

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
  /** Email của quản trị tổng: nơi nhận liên kết "Quên mật khẩu" (chỉ điền khi tài khoản chưa có email) */
  adminEmail: env('ADMIN_EMAIL').toLowerCase(),
  startingGems: Number(env('STARTING_GEMS', '100')),
  /** Dịch vụ AI Python (chatbot, RAG, BKT, soạn câu hỏi) */
  aiServiceUrl: /^https?:\/\//i.test(aiUrl) ? aiUrl : `http://${aiUrl}`,
  aiServiceToken: env('AI_SERVICE_TOKEN'),
  /** Ngân hàng câu hỏi game_content.json, kho tri thức knowledge_base.json, q_matrix.json */
  contentDir: env('CONTENT_DIR') ? resolve(env('CONTENT_DIR')) : resolve(repoRoot, 'ai', 'data'),
  migrationsDir: env('MIGRATIONS_DIR') ? resolve(env('MIGRATIONS_DIR')) : resolve(repoRoot, 'database', 'migrations'),
  /** Phần sau @ của tên đăng nhập sinh từ file Excel (anh.2374807022001@<miền>) */
  accountDomain: env('ACCOUNT_DOMAIN', 'donga.local').toLowerCase(),
  /** Địa chỉ website ghi trong email gửi tài khoản */
  appUrl: env('APP_URL', 'https://datn-2026-indol.vercel.app').replace(/\/+$/, ''),
  /** Gửi email: SMTP_URL (smtps://user:pass@host:465) hoặc SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS; MAIL_TRANSPORT=json chỉ ghi nhận (kiểm thử) */
  smtpUrl: env('SMTP_URL'),
  smtpHost: env('SMTP_HOST'),
  smtpPort: Number(env('SMTP_PORT', '587')) || 587,
  smtpUser: env('SMTP_USER'),
  smtpPass: process.env.SMTP_PASS ?? '',
  mailFrom: env('MAIL_FROM', 'Đông A EDU <no-reply@donga.local>'),
  mailTransport: env('MAIL_TRANSPORT'),
  /** Tiến trình nền gửi thư mỗi 4 giây (kiểm thử đặt MAIL_WORKER=off để tự gọi từng lượt) */
  mailWorker: env('MAIL_WORKER', 'on') !== 'off',
};
