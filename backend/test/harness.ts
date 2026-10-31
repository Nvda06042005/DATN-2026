/**
 * Hạ tầng kiểm thử: một cụm PostgreSQL tạm (initdb/pg_ctl) cho cả lượt chạy, mỗi file kiểm thử một CSDL riêng.
 * Không dùng dữ liệu thật. Không tìm thấy PostgreSQL thì các bài cần CSDL được bỏ qua (đặt POSTGRES_BIN để chỉ đường).
 * File này vừa là globalSetup/globalTeardown của Jest (export default), vừa cung cấp hàm tiện ích cho các bài kiểm thử.
 */
import { spawnSync } from 'child_process';
import { closeSync, existsSync, mkdtempSync, openSync, readdirSync, readFileSync, realpathSync, rmSync } from 'fs';
import { AddressInfo, createServer } from 'net';
import { tmpdir } from 'os';
import { basename, dirname, join } from 'path';
import { Client } from 'pg';
import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';

const PREFIX = 'dong_a_nest_test_';
const cluster = globalThis as typeof globalThis & { __pg?: { bin: string; root: string; data: string } };

function postgresBin(): string | null {
  if (process.env.POSTGRES_BIN) return process.env.POSTGRES_BIN;
  const exe = process.platform === 'win32' ? 'initdb.exe' : 'initdb';
  for (const dir of (process.env.PATH ?? '').split(process.platform === 'win32' ? ';' : ':')) if (dir && existsSync(join(dir, exe))) return dir;
  const base = join(process.env.ProgramFiles ?? 'C:/Program Files', 'PostgreSQL');
  if (!existsSync(base)) return null;
  for (const v of readdirSync(base).sort((a, b) => Number(b) - Number(a))) if (existsSync(join(base, v, 'bin', exe))) return join(base, v, 'bin');
  return null;
}

/** Ghi đầu ra ra file thay vì pipe: trên Windows tiến trình con của postgres giữ pipe làm lệnh treo */
function runPg(bin: string, root: string, tool: string, args: string[]): void {
  const log = join(root, `${tool}-command.log`);
  const fd = openSync(log, 'w');
  const result = spawnSync(join(bin, tool), args, { stdio: ['ignore', fd, fd], timeout: 60_000, windowsHide: true });
  closeSync(fd);
  if (result.status !== 0) throw new Error(`${tool} failed: ${readFileSync(log, 'utf8')}`);
}

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = createServer().listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      server.close(() => resolve(port));
    });
  });
}

export default async function globalSetupOrTeardown(): Promise<void> {
  if (cluster.__pg) {
    const { bin, root, data } = cluster.__pg;
    cluster.__pg = undefined;
    runPg(bin, root, 'pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop']);
    // Chỉ xóa đúng thư mục tạm do bài kiểm thử tạo ra
    if (dirname(root) === realpathSync(tmpdir()) && basename(root).startsWith(PREFIX)) rmSync(root, { recursive: true, force: true });
    return;
  }
  const bin = postgresBin();
  if (!bin) {
    process.env.TEST_PG_URL = '';
    console.warn('Không tìm thấy PostgreSQL (initdb/pg_ctl) – bỏ qua các bài kiểm thử cần CSDL; đặt POSTGRES_BIN');
    return;
  }
  const root = realpathSync(mkdtempSync(join(tmpdir(), PREFIX)));
  const data = join(root, 'pgdata');
  const port = await freePort();
  runPg(bin, root, 'initdb', ['-D', data, '-U', 'test_runner', '-A', 'trust', '-E', 'UTF8', '--no-locale']);
  runPg(bin, root, 'pg_ctl', ['-D', data, '-l', join(root, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start']);
  cluster.__pg = { bin, root, data };
  process.env.TEST_PG_URL = `postgresql://test_runner@127.0.0.1:${port}/postgres?sslmode=disable`;
}

// ---------------------------------------------------------------------- CSDL & ứng dụng
export const hasPostgres = (): boolean => Boolean(process.env.TEST_PG_URL);

export async function createDatabase(name: string): Promise<string> {
  const base = process.env.TEST_PG_URL!;
  const client = new Client({ connectionString: base.replace('?sslmode=disable', '') });
  await client.connect();
  try {
    await client.query(`DROP DATABASE IF EXISTS ${name}`);
    await client.query(`CREATE DATABASE ${name}`);
  } finally {
    await client.end();
  }
  return base.replace('/postgres?', `/${name}?`);
}

export async function sql<T = Record<string, unknown>>(url: string, text: string, params: unknown[] = []): Promise<T[]> {
  const client = new Client({ connectionString: url.replace('?sslmode=disable', '') });
  await client.connect();
  try {
    return (await client.query(text, params)).rows as T[];
  } finally {
    await client.end();
  }
}

export interface Started {
  app: INestApplication;
  base: string;
  url: string;
  moduleRef: TestingModule;
  close(): Promise<void>;
}

/** Khởi động backend NestJS thật trên một cổng ngẫu nhiên với CSDL riêng; email chỉ ghi nhận trong bộ nhớ (MAIL_TRANSPORT=json) */
export async function startApp(dbName: string): Promise<Started> {
  const url = await createDatabase(dbName);
  Object.assign(process.env, {
    DATABASE_URL: url, AUTH_SECRET_KEY: 'nest-test-secret', ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: 'admin@123', ADMIN_EMAIL: 'quantri@example.invalid',
    MAIL_TRANSPORT: 'json', MAIL_WORKER: 'off', ACCOUNT_DOMAIN: 'donga.local', GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com',
  });
  const { Test } = await import('@nestjs/testing');
  const { AppModule, configureApp } = await import('../src/app.module');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = configureApp(moduleRef.createNestApplication({ logger: ['error'] }));
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as AddressInfo;
  return { app, base: `http://127.0.0.1:${port}`, url, moduleRef, close: () => app.close() };
}

// ---------------------------------------------------------------------- HTTP
export interface Res<T = any> {
  status: number;
  body: T;
}

export async function call<T = any>(base: string, method: string, path: string, body?: unknown, token?: string): Promise<Res<T>> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

export async function adminLogin(base: string): Promise<string> {
  return (await call(base, 'POST', '/api/auth/login', { username: 'admin', password: 'admin@123', portal: 'root_admin' })).body.token;
}

/** Tải một file (xlsx/json) về dạng Buffer, kèm trạng thái */
export async function download(base: string, path: string, token: string): Promise<{ status: number; buffer: Buffer; type: string }> {
  const res = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  return { status: res.status, buffer: Buffer.from(await res.arrayBuffer()), type: res.headers.get('content-type') ?? '' };
}

/** Gửi file dạng multipart (trường "file") như trang quản trị */
export async function upload<T = any>(base: string, path: string, name: string, content: Buffer, token?: string): Promise<Res<T>> {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(content)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), name);
  const res = await fetch(`${base}${path}`, { method: 'POST', body: form, headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

/** Tạo file .xlsx thật cho bài kiểm thử nhập Excel: dòng 1 là tiêu đề, các dòng sau là dữ liệu */
export async function makeXlsx(header: string[], rows: string[][]): Promise<Buffer> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sheet1');
  sheet.addRow(header);
  for (const row of rows) sheet.addRow(row);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/** Quản trị viên cấp tài khoản, người dùng đăng nhập lần đầu và đổi mật khẩu; trả về token mới và tài khoản */
export async function activate(base: string, username: string, tempPassword: string, newPassword: string, portal: string) {
  const login = await call(base, 'POST', '/api/auth/login', { username, password: tempPassword, portal });
  if (login.status !== 200) throw new Error(`Không đăng nhập được: ${JSON.stringify(login.body)}`);
  const changed = await call(base, 'POST', '/api/auth/change-password', { current_password: tempPassword, new_password: newPassword }, login.body.token);
  if (changed.status !== 200) throw new Error(`Không đổi được mật khẩu: ${JSON.stringify(changed.body)}`);
  return { token: changed.body.token as string, user: changed.body.user as { id: number; username: string; full_name: string } };
}
