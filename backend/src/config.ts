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
  /** Tài khoản quản trị được tạo ở lần chạy đầu tiên – đăng nhập tại trang /admin */
  adminUsername: env('ADMIN_USERNAME', 'admin').toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD ?? 'admin@123',
  startingGems: Number(env('STARTING_GEMS', '100')),
  /** Dịch vụ AI Python (chatbot, RAG, BKT, soạn câu hỏi) */
  aiServiceUrl: /^https?:\/\//i.test(aiUrl) ? aiUrl : `http://${aiUrl}`,
  aiServiceToken: env('AI_SERVICE_TOKEN'),
  /** Ngân hàng câu hỏi game_content.json, kho tri thức knowledge_base.json, q_matrix.json */
  contentDir: env('CONTENT_DIR') ? resolve(env('CONTENT_DIR')) : resolve(repoRoot, 'ai', 'data'),
  migrationsDir: env('MIGRATIONS_DIR') ? resolve(env('MIGRATIONS_DIR')) : resolve(repoRoot, 'database', 'migrations'),
};
