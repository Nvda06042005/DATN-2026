/**
 * Migration PostgreSQL theo thứ tự, có checksum – dùng khi backend khởi động và cho lệnh `npm run migrate`.
 * Lịch sử ghi ở bảng public.app_schema_migrations; checksum = SHA-256 của nội dung (bỏ BOM, CRLF -> LF)
 * nên file checkout trên Windows và Linux cho cùng kết quả. Không sửa file đã chạy: tạo file mới.
 */
import { createHash } from 'crypto';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { Client, ClientConfig } from 'pg';

export class MigrationError extends Error {}

export interface Migration {
  version: number;
  name: string;
  sql: string;
  checksum: string;
}

const FILENAME = /^([0-9]{3,})_([a-z0-9]+(?:_[a-z0-9]+)*)\.sql$/;
const LOCK_ID = BigInt('0x444F4E47415F4442').toString();
const FORBIDDEN_FIRST = new Set(['BEGIN', 'START', 'COMMIT', 'END', 'ROLLBACK', 'ABORT', 'SAVEPOINT', 'RELEASE', 'VACUUM', 'DISCARD']);
const FORBIDDEN = /^(?:PREPARE\s+TRANSACTION|ALTER\s+SYSTEM|(?:CREATE|DROP)\s+DATABASE|(?:CREATE\s+(?:UNIQUE\s+)?INDEX|REINDEX\b.*?)\s+CONCURRENTLY)\b/;

/** Kiểm tra các lệnh cấp ngoài cùng (bỏ qua comment, chuỗi, thân DO $$ ... $$): không tự mở/đóng transaction. */
export function validateSql(sql: string, name: string): void {
  const plain: string[] = [];
  let i = 0;
  while (i < sql.length) {
    if (sql.startsWith('--', i)) {
      const end = sql.indexOf('\n', i);
      i = end < 0 ? sql.length : end + 1;
      plain.push(' ');
    } else if (sql.startsWith('/*', i)) {
      let depth = 1;
      i += 2;
      while (i < sql.length && depth) {
        if (sql.startsWith('/*', i)) {
          depth += 1;
          i += 2;
        } else if (sql.startsWith('*/', i)) {
          depth -= 1;
          i += 2;
        } else i += 1;
      }
      if (depth) throw new MigrationError(`Unclosed SQL comment: ${name}`);
      plain.push(' ');
    } else if (sql[i] === "'" || sql[i] === '"') {
      const quote = sql[i];
      const escapeString = quote === "'" && i > 0 && 'eE'.includes(sql[i - 1]) && (i < 2 || !/[\p{L}\p{N}_]/u.test(sql[i - 2]));
      i += 1;
      let closed = false;
      while (i < sql.length) {
        if (escapeString && sql[i] === '\\') i += 2;
        else if (sql[i] === quote) {
          i += 1;
          if (i < sql.length && sql[i] === quote) i += 1;
          else {
            closed = true;
            break;
          }
        } else i += 1;
      }
      if (!closed) throw new MigrationError(`Unclosed SQL string: ${name}`);
      plain.push(' ');
    } else if (sql[i] === '$' && /^\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$/.test(sql.slice(i))) {
      const tag = /^\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$/.exec(sql.slice(i))![0];
      const end = sql.indexOf(tag, i + tag.length);
      if (end < 0) throw new MigrationError(`Unclosed SQL dollar quote: ${name}`);
      i = end + tag.length;
      plain.push(' ');
    } else {
      plain.push(sql[i]);
      i += 1;
    }
  }
  const commands = plain
    .join('')
    .split(';')
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean);
  if (!commands.length) throw new MigrationError(`Migration has no SQL statements: ${name}`);
  for (const command of commands) {
    if (FORBIDDEN_FIRST.has(command.split(/\s+/)[0]) || FORBIDDEN.test(command)) {
      throw new MigrationError(`Migration must run inside the runner's transaction: ${name}`);
    }
  }
}

export function loadMigrations(directory: string): Migration[] {
  let names: string[];
  try {
    if (!statSync(directory).isDirectory()) throw new Error();
    names = readdirSync(directory).filter((f) => f.endsWith('.sql')).sort();
  } catch {
    throw new MigrationError('Migration directory is missing');
  }
  const result: Migration[] = [];
  const versions = new Set<number>();
  for (const name of names) {
    const match = FILENAME.exec(name);
    if (!match) throw new MigrationError(`Invalid migration filename: ${name}`);
    const version = Number(match[1]);
    if (versions.has(version)) throw new MigrationError(`Duplicate migration number: ${version}`);
    versions.add(version);
    let sql: string;
    try {
      sql = new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(join(directory, name)));
    } catch {
      throw new MigrationError(`Cannot read UTF-8 migration: ${name}`);
    }
    sql = sql.replace(/^﻿/, '').replace(/\r\n/g, '\n');
    if (!sql.trim()) throw new MigrationError(`Empty migration: ${name}`);
    validateSql(sql, name);
    result.push({ version, name, sql, checksum: createHash('sha256').update(sql, 'utf8').digest('hex') });
  }
  if (!result.length) throw new MigrationError('No SQL migrations found');
  return result.sort((a, b) => a.version - b.version);
}

/** Kết nối PostgreSQL: mặc định bắt buộc SSL (Supabase); chỉ CSDL thử nghiệm cục bộ mới ghi sslmode=disable. */
export function pgConfig(databaseUrl: string): ClientConfig {
  if (!databaseUrl.trim()) throw new MigrationError('DATABASE_URL is required for PostgreSQL migrations');
  const url = new URL(databaseUrl);
  const mode = url.searchParams.get('sslmode');
  url.searchParams.delete('sslmode');
  return { connectionString: url.toString(), ssl: mode === 'disable' ? false : { rejectUnauthorized: false }, connectionTimeoutMillis: 10_000 };
}

type History = Map<number, { name: string; checksum: string }>;

async function readHistory(client: Client): Promise<History> {
  const exists = await client.query("SELECT to_regclass('public.app_schema_migrations') AS t");
  const history: History = new Map();
  if (!exists.rows[0].t) return history;
  const rows = await client.query('SELECT version, name, checksum FROM public.app_schema_migrations ORDER BY version');
  for (const r of rows.rows) history.set(Number(r.version), { name: r.name, checksum: r.checksum });
  return history;
}

function validateHistory(migrations: Migration[], history: History): void {
  const files = new Map(migrations.map((m) => [m.version, m]));
  for (const [version, { name, checksum }] of history) {
    const file = files.get(version);
    if (!file) throw new MigrationError(`Applied migration is missing from this release: ${name}`);
    if (file.name !== name || file.checksum !== checksum) throw new MigrationError(`Applied migration was changed: ${name}; create a new SQL file`);
  }
  const maxApplied = Math.max(0, ...history.keys());
  if (history.size && migrations.some((m) => m.version < maxApplied && !history.has(m.version))) {
    throw new MigrationError('A pending migration was inserted before applied migrations');
  }
}

/** Lỗi an toàn để ghi log: chỉ loại lỗi và SQLSTATE, không lộ chuỗi kết nối hay nội dung SQL. */
function safeError(exc: unknown): MigrationError {
  const code = (exc as { code?: string })?.code ?? 'unavailable';
  return new MigrationError(`PostgreSQL migration failed (${(exc as Error)?.name ?? 'Error'}, SQLSTATE ${code}); connection and SQL details omitted`);
}

/** Đọc lịch sử, không tạo bảng hay chạy SQL. */
export async function migrationStatus(databaseUrl: string, directory: string): Promise<Array<{ name: string; applied: boolean }>> {
  const migrations = loadMigrations(directory);
  const client = new Client(pgConfig(databaseUrl));
  try {
    await client.connect();
    await client.query('BEGIN READ ONLY');
    const history = await readHistory(client);
    validateHistory(migrations, history);
    await client.query('COMMIT');
    return migrations.map((m) => ({ name: m.name, applied: history.has(m.version) }));
  } catch (exc) {
    if (exc instanceof MigrationError) throw exc;
    throw safeError(exc);
  } finally {
    await client.end().catch(() => undefined);
  }
}

/** Chạy cả lô migration còn thiếu trong một transaction; nhiều tiến trình cùng lúc sẽ xếp hàng trên một khóa advisory. */
export async function applyMigrations(databaseUrl: string, directory: string): Promise<string[]> {
  const migrations = loadMigrations(directory);
  const client = new Client(pgConfig(databaseUrl));
  const applied: string[] = [];
  try {
    await client.connect();
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '30s'");
    await client.query("SET LOCAL statement_timeout = '120s'");
    await client.query('SET LOCAL standard_conforming_strings = on');
    await client.query('SET LOCAL search_path = public, pg_catalog');
    await client.query('SELECT pg_advisory_xact_lock($1)', [LOCK_ID]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.app_schema_migrations (
          version BIGINT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          checksum TEXT NOT NULL,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
    await client.query('ALTER TABLE public.app_schema_migrations ENABLE ROW LEVEL SECURITY');
    const history = await readHistory(client);
    validateHistory(migrations, history);
    for (const m of migrations) {
      if (history.has(m.version)) continue;
      await client.query(m.sql);
      await client.query('INSERT INTO public.app_schema_migrations (version, name, checksum) VALUES ($1, $2, $3)', [m.version, m.name, m.checksum]);
      applied.push(m.name);
    }
    await client.query('COMMIT');
    return applied;
  } catch (exc) {
    await client.query('ROLLBACK').catch(() => undefined);
    if (exc instanceof MigrationError) throw exc;
    throw safeError(exc);
  } finally {
    await client.end().catch(() => undefined);
  }
}
