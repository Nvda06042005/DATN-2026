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
import type { BktResult, ExcelRow, ExcelValidation, MatchCandidate, MatchDecision } from '../src/ai/ai.service';

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

  /** File mẫu giả (byte bất kỳ có chữ ký ZIP) */
  async excelTemplate(): Promise<Buffer> {
    this.calls.push('excel:template');
    return Buffer.concat([Buffer.from('504b0304', 'hex'), Buffer.from('mau-gia')]);
  }

  /**
   * "File Excel" trong kiểm thử = chữ ký ZIP + JSON {ok?, errors?, rows: [{row, values, missing?, invalid?}]}.
   * Bản giả tự tính complete, vector đặc trưng và tên đăng nhập/mật khẩu theo đúng công thức của dịch vụ Python.
   */
  async excelValidate(fileBase64: string): Promise<ExcelValidation> {
    this.calls.push('excel:validate');
    const doc = JSON.parse(Buffer.from(fileBase64, 'base64').subarray(4).toString('utf8'));
    if (doc.ok === false) return { ok: false, errors: doc.errors ?? ['Sai chữ ký'], template_id: null, rows: [] };
    const rows: ExcelRow[] = doc.rows.map((r: { row: number; values: ExcelRow['values']; missing?: string[]; invalid?: ExcelRow['invalid'] }) => {
      const missing = r.missing ?? [];
      const invalid = r.invalid ?? [];
      const complete = !missing.length && !invalid.length;
      return { row: r.row, values: r.values, missing, invalid, complete, embedding: fakeEmbedding(`${r.values.full_name} ${r.values.school_code}`), credentials: complete ? fakeCredentials(r.values) : null };
    });
    return { ok: true, errors: [], template_id: 'tpl-test', rows };
  }

  /** Khớp như dịch vụ Python: trùng mã người dùng hoặc email, hoặc cùng họ tên */
  async provisionMatch(rows: Array<{ row: number; values: ExcelRow['values']; candidates: MatchCandidate[] }>): Promise<MatchDecision[]> {
    this.calls.push(`match:${rows.length}`);
    return rows.map((r) => {
      const c = r.candidates.find((x) => (r.values.user_code && x.user_code === r.values.user_code) || (r.values.email && x.email === r.values.email.toLowerCase()) || x.full_name === r.values.full_name);
      return { row: r.row, log_id: c?.id ?? null, score: c ? 1 : 0, reason: c ? 'trùng mã người dùng' : 'không khớp' };
    });
  }
}

const fakeEmbedding = (text: string): number[] => {
  const v = new Array(128).fill(0);
  for (let i = 0; i < text.length - 2; i++) v[(text.charCodeAt(i) * 31 + text.charCodeAt(i + 1) * 7 + text.charCodeAt(i + 2)) % 128] += 1;
  const n = Math.sqrt(v.reduce((a, x) => a + x * x, 0)) || 1;
  return v.map((x) => x / n);
};

const strip = (s: string) => s.replace(/đ/g, 'd').replace(/Đ/g, 'D').normalize('NFD').replace(/\p{Mn}/gu, '');

/** Công thức của đặc tả (giống ai/excel_provisioning.py) */
export function fakeCredentials(v: ExcelRow['values']): { username_prefix: string; password: string } {
  const words = strip(v.full_name).split(/\s+/).filter(Boolean);
  const start = Number(v.school_year.slice(0, 4));
  const cohort = String(start - ((v.grade ?? 6) - 6)).slice(-3);
  const [y, m, d] = (v.birth_date ?? '2000-01-01').split('-');
  const initials = words.map((w) => w[0].toLowerCase()).join('');
  return {
    username_prefix: `${words[words.length - 1].toLowerCase()}.${String(start).slice(-2)}${v.school_code}${v.grade}${cohort}`,
    password: `${initials[0].toUpperCase()}${initials.slice(1)}${d}${m}${y}VN@`,
  };
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

/** Khởi động backend NestJS thật trên một cổng ngẫu nhiên với CSDL riêng; dịch vụ AI được thay bằng FakeAi, email chỉ ghi nhận (json) */
export async function startApp(dbName: string): Promise<Started> {
  const url = await createDatabase(dbName);
  Object.assign(process.env, {
    DATABASE_URL: url, AUTH_SECRET_KEY: 'nest-test-secret', ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: 'admin@123', STARTING_GEMS: '100',
    MAIL_TRANSPORT: 'json', MAIL_WORKER: 'off', ACCOUNT_DOMAIN: 'donga.local',
  });
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
  return (await call(base, 'POST', '/api/auth/login', { username: 'admin', password: 'admin@123', portal: 'root_admin' })).body.token;
}

/** Gửi file dạng multipart (trường "file") như trang quản trị */
export async function upload<T = any>(base: string, path: string, name: string, content: Buffer, mime: string, token?: string): Promise<Res<T>> {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(content)], { type: mime }), name);
  const res = await fetch(`${base}${path}`, { method: 'POST', body: form, headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

/** "File Excel" giả cho FakeAi */
export const fakeXlsx = (doc: unknown): Buffer => Buffer.concat([Buffer.from('504b0304', 'hex'), Buffer.from(JSON.stringify(doc), 'utf8')]);

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
