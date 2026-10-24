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
import { WebSocket } from 'ws';
import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import type { BktResult } from '../src/ai/ai.service';

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

/** Dịch vụ AI giả: BKT đơn giản (đúng thì P(L) tăng, sai thì giảm), không gọi mạng */
export class FakeAi {
  questions: Array<{ question: string; options: string[]; correct_index: number; explanation: string; source: string }> = [];
  calls: string[] = [];

  async health(): Promise<boolean> {
    return true;
  }

  async bktUpdate(state: Record<string, { p_l?: number; attempts?: number }>, unitId: string, isCorrect: boolean): Promise<BktResult> {
    const before = state[unitId] ?? {};
    const old = Number(before.p_l ?? 0.3);
    const next = isCorrect ? old + (1 - old) * 0.4 : old * 0.5;
    const attempts = Number(before.attempts ?? 0) + 1;
    this.calls.push(`bkt:${unitId}:${isCorrect}`);
    return {
      state: { ...state, [unitId]: { p_l: next, attempts } }, unit_id: unitId, topic: unitId, old_p_l: old, new_p_l: next,
      p_l_delta: next - old, mastery_status: next >= 0.95 ? 'Đã thành thạo' : 'Đang học', attempts,
    };
  }

  async bktRecommend(state: Record<string, { p_l?: number }>, topK: number): Promise<Array<Record<string, unknown>>> {
    return Object.entries(state)
      .sort(([, a], [, b]) => Number(a.p_l) - Number(b.p_l))
      .slice(0, topK)
      .map(([unit_id, s]) => ({ unit_id, p_l: s.p_l }));
  }

  async generateQuestions(unitId: string): Promise<FakeAi['questions']> {
    this.calls.push(`questions:${unitId}`);
    return this.questions;
  }

  async forward<T>(path: string, body: Record<string, unknown>): Promise<T> {
    this.calls.push(`forward:${path}`);
    return { path, echo: body } as T;
  }
}

export interface Started {
  app: INestApplication;
  base: string;
  ws: string;
  url: string;
  ai: FakeAi;
  moduleRef: TestingModule;
  close(): Promise<void>;
}

/** Khởi động backend NestJS thật trên một cổng ngẫu nhiên với CSDL riêng; dịch vụ AI được thay bằng FakeAi */
export async function startApp(dbName: string): Promise<Started> {
  const url = await createDatabase(dbName);
  Object.assign(process.env, { DATABASE_URL: url, AUTH_SECRET_KEY: 'nest-test-secret', ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: 'admin@123', STARTING_GEMS: '100' });
  const { Test } = await import('@nestjs/testing');
  const { AppModule, configureApp } = await import('../src/app.module');
  const { AiService } = await import('../src/ai/ai.service');
  const ai = new FakeAi();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(AiService).useValue(ai).compile();
  const app = configureApp(moduleRef.createNestApplication({ logger: ['error'] }));
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;
  return {
    app, base, ws: `ws://127.0.0.1:${port}/api/live/ws`, url, ai, moduleRef,
    close: () => app.close(),
  };
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

/** Quản trị viên cấp tài khoản, người dùng đăng nhập lần đầu và đổi mật khẩu; trả về [token, tài khoản] */
export async function makeUser(base: string, adminToken: string, fullName: string, role: 'teacher' | 'student', className: string | null, newPassword: string) {
  const created = await call(base, 'POST', '/api/admin/users', { full_name: fullName, role, class_name: className }, adminToken);
  if (created.status !== 201) throw new Error(`Không tạo được tài khoản: ${JSON.stringify(created.body)}`);
  const login = await call(base, 'POST', '/api/auth/login', { username: created.body.user.username, password: created.body.password, portal: role });
  const changed = await call(base, 'POST', '/api/auth/change-password', { current_password: created.body.password, new_password: newPassword }, login.body.token);
  return [changed.body.token as string, changed.body.user as { id: number; username: string; full_name: string }] as const;
}

export async function adminLogin(base: string): Promise<string> {
  return (await call(base, 'POST', '/api/auth/login', { username: 'admin', password: 'admin@123', portal: 'admin' })).body.token;
}

// ---------------------------------------------------------------------- WebSocket
type Msg = Record<string, any>;

/** Máy khách WebSocket cho bài kiểm thử: gom tin nhắn và chờ tin thỏa điều kiện (không treo quá thời gian chờ) */
export class LiveClient {
  readonly messages: Msg[] = [];
  closeCode: number | null = null;
  private waiters: Array<() => void> = [];
  private readonly ws: WebSocket;
  private readonly opened: Promise<void>;

  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.opened = new Promise((resolve, reject) => {
      this.ws.once('open', () => resolve());
      this.ws.once('error', reject);
    });
    this.ws.on('message', (data) => {
      this.messages.push(JSON.parse(data.toString()));
      this.wake();
    });
    this.ws.on('close', (code) => {
      this.closeCode = code;
      this.wake();
    });
  }

  private wake(): void {
    const waiters = this.waiters;
    this.waiters = [];
    for (const w of waiters) w();
  }

  async send(msg: Msg): Promise<void> {
    await this.opened;
    this.ws.send(JSON.stringify(msg));
  }

  /** Lấy (và bỏ khỏi hàng đợi) tin nhắn đầu tiên thỏa `pred`; các tin đứng trước bị bỏ qua */
  async until(pred: (m: Msg) => boolean, timeoutMs = 5000): Promise<Msg> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const index = this.messages.findIndex(pred);
      if (index >= 0) return this.messages.splice(0, index + 1)[index];
      if (this.closeCode !== null) throw new Error(`Kết nối đã đóng (${this.closeCode}) trước khi nhận được tin mong đợi`);
      const left = deadline - Date.now();
      if (left <= 0) throw new Error(`Hết thời gian chờ tin nhắn; đã nhận: ${JSON.stringify(this.messages.slice(-3))}`);
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, left);
        this.waiters.push(() => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
  }

  async closed(timeoutMs = 5000): Promise<number> {
    const deadline = Date.now() + timeoutMs;
    while (this.closeCode === null && Date.now() < deadline) await new Promise((r) => setTimeout(r, 20));
    if (this.closeCode === null) throw new Error('Kết nối chưa đóng');
    return this.closeCode;
  }

  close(): void {
    this.ws.close();
  }
}
