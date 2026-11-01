/**
 * Sao lưu và phục hồi dữ liệu (Sprint 11, HK.AD.072, HK.SYS.019): sao chép logic mọi bảng nghiệp vụ của PostgreSQL thành một tệp JSON nén gzip (kèm ảnh đính kèm
 * trong cơ sở dữ liệu), thủ công hoặc tự động mỗi ngày vào giờ cấu hình; giữ số bản mới nhất theo cấu hình. Phục hồi ghi đè dữ liệu bằng bản đã chọn trong MỘT giao dịch
 * (lỗi thì giữ nguyên) sau khi tự tạo thêm bản "trước khi phục hồi".
 *
 * Giới hạn cần biết: bản sao lưu nằm trong CHÍNH cơ sở dữ liệu đó nên chỉ bảo vệ khỏi thao tác nhầm, không bảo vệ khi mất cả cơ sở dữ liệu; hãy tải về để cất nơi khác
 * (Supabase cũng có sao lưu riêng của nhà cung cấp). Không sao lưu chỉ mục tri thức AI (lập lại được), gợi ý học tập, nhật ký lỗi và mã tạm.
 */
import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { gunzipSync, gzipSync } from 'zlib';
import { DatabaseService, Q, UserRow } from '../database/database.service';
import { ErrorLog } from './error-log';
import { assertSystemAdmin, SystemService } from './system.service';

const SKIP = new Set(['hk_backups', 'app_schema_migrations', 'app_revoked_tokens', '_prisma_migrations', 'hk_ai_chunks', 'hk_recommendations', 'hk_error_log', 'hk_two_factor_codes', 'hk_job_heartbeats']);
const MAX_BYTES = 25 * 1024 * 1024;
const q = (name: string): string => `"${name.replace(/"/g, '""')}"`;
export const CONFIRM_PHRASE = 'PHUC HOI';

interface Meta { id: number; kind: string; label: string | null; size_bytes: number; table_count: number; row_count: number; schema_version: number; created_by: number | null; created_at: string; created_by_name?: string | null }

@Injectable()
export class BackupService {
  private running = false;

  constructor(private readonly db: DatabaseService, private readonly system: SystemService) {}

  private async tableNames(run: Q): Promise<string[]> {
    const rows = await run<{ table_name: string }>("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name");
    return rows.map((r) => r.table_name).filter((n) => !SKIP.has(n) && n === n.toLowerCase());
  }

  private async schemaVersion(run: Q): Promise<number> {
    return Number((await run<{ v: number | null }>('SELECT max(version) AS v FROM public.app_schema_migrations'))[0]?.v ?? 0);
  }

  async list(user: UserRow) {
    assertSystemAdmin(user);
    const items = await this.db.query<Meta>(
      `SELECT b.id::int AS id, b.kind, b.label, b.size_bytes::float8 AS size_bytes, b.table_count, b.row_count::float8 AS row_count, b.schema_version, b.created_by, b.created_at, u.full_name AS created_by_name
       FROM hk_backups b LEFT JOIN app_users u ON u.id = b.created_by ORDER BY b.created_at DESC, b.id DESC LIMIT 100`);
    const total = items.reduce((n, i) => n + i.size_bytes, 0);
    return { items, total_bytes: total, note: 'Bản sao lưu nằm trong cùng cơ sở dữ liệu; hãy tải về để cất giữ nơi khác.' };
  }

  /** Tạo một bản sao lưu nhất quán (một giao dịch REPEATABLE READ) */
  async create(kind: 'manual' | 'auto' | 'pre_restore', user: UserRow | null, label?: string | null): Promise<Meta> {
    if (this.running) throw new ConflictException('Đang có một thao tác sao lưu / phục hồi khác, hãy thử lại sau');
    this.running = true;
    try {
      const { json, tables, rows, version } = await this.db.tx(async (run) => {
        await run('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
        const names = await this.tableNames(run);
        const parts: string[] = [];
        let total = 0;
        for (const n of names) {
          const r = (await run<{ j: string; c: string }>(`SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)::text AS j, count(*)::text AS c FROM public.${q(n)} t`))[0];
          parts.push(`${JSON.stringify(n)}:${r.j}`);
          total += Number(r.c);
        }
        const version = await this.schemaVersion(run);
        return { json: `{"format":1,"created_at":${JSON.stringify(new Date().toISOString())},"schema_version":${version},"tables":{${parts.join(',')}}}`, tables: names.length, rows: total, version };
      });
      const data = gzipSync(Buffer.from(json, 'utf8'), { level: 6 });
      if (data.length > MAX_BYTES) throw new ServiceUnavailableException('Dữ liệu quá lớn để sao lưu trong cơ sở dữ liệu (trên 25 MB sau nén); hãy dùng sao lưu của Supabase');
      const meta = (await this.db.query<Meta>(
        `INSERT INTO hk_backups (kind, label, size_bytes, table_count, row_count, schema_version, created_by, data) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id::int AS id, kind, label, size_bytes::float8 AS size_bytes, table_count, row_count::float8 AS row_count, schema_version, created_by, created_at`,
        [kind, label?.slice(0, 120) ?? null, data.length, tables, rows, version, user?.id ?? null, data]))[0];
      await this.prune();
      return meta;
    } finally {
      this.running = false;
    }
  }

  /** Giữ số bản tự động theo cấu hình; bản thủ công tối đa 10, bản trước khi phục hồi tối đa 3 */
  private async prune(): Promise<void> {
    const keep = (await this.system.settings()).backup_keep;
    for (const [kind, n] of [['auto', keep], ['manual', 10], ['pre_restore', 3]] as const) {
      await this.db.query('DELETE FROM hk_backups WHERE kind = $1 AND id NOT IN (SELECT id FROM hk_backups WHERE kind = $1 ORDER BY created_at DESC, id DESC LIMIT $2)', [kind, n]);
    }
  }

  async createManual(user: UserRow, label?: string | null) {
    assertSystemAdmin(user);
    return this.create('manual', user, label ?? null);
  }

  async download(user: UserRow, id: number): Promise<{ data: Buffer; name: string }> {
    assertSystemAdmin(user);
    const row = (await this.db.query<{ data: Buffer; created_at: string; kind: string }>('SELECT data, created_at, kind FROM hk_backups WHERE id = $1', [id]))[0];
    if (!row) throw new NotFoundException('Không tìm thấy bản sao lưu');
    return { data: row.data, name: `sao-luu-${new Date(row.created_at).toISOString().slice(0, 19).replace(/[:T]/g, '-')}-${row.kind}.json.gz` };
  }

  async remove(user: UserRow, id: number) {
    assertSystemAdmin(user);
    const rows = await this.db.query('DELETE FROM hk_backups WHERE id = $1 RETURNING id', [id]);
    if (!rows.length) throw new NotFoundException('Không tìm thấy bản sao lưu');
    return { deleted: true };
  }

  /** Thứ tự chèn: bảng cha trước bảng con (khóa ngoại); lỗi nếu có vòng phụ thuộc giữa các bảng */
  private async insertOrder(run: Q, names: string[]): Promise<string[]> {
    const edges = await run<{ child: string; parent: string }>(
      `SELECT cc.relname AS child, pc.relname AS parent FROM pg_constraint c JOIN pg_class cc ON cc.oid = c.conrelid JOIN pg_class pc ON pc.oid = c.confrelid
       WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace`);
    const set = new Set(names);
    const parents = new Map<string, Set<string>>(names.map((n) => [n, new Set<string>()]));
    for (const e of edges) if (e.child !== e.parent && set.has(e.child) && set.has(e.parent)) parents.get(e.child)!.add(e.parent);
    const out: string[] = [];
    const left = new Map(parents);
    while (left.size) {
      const ready = [...left.entries()].filter(([, ps]) => [...ps].every((p) => !left.has(p))).map(([n]) => n).sort();
      if (!ready.length) throw new BadRequestException(`Không phục hồi được: các bảng ${[...left.keys()].slice(0, 4).join(', ')}… phụ thuộc vòng tròn`);
      for (const n of ready) { out.push(n); left.delete(n); }
    }
    return out;
  }

  /** Phục hồi từ một bản sao lưu; cần gõ đúng cụm xác nhận và cùng phiên bản lược đồ */
  async restore(user: UserRow, id: number, confirm: unknown) {
    assertSystemAdmin(user);
    if (String(confirm ?? '').trim().toUpperCase() !== CONFIRM_PHRASE) throw new BadRequestException(`Gõ "${CONFIRM_PHRASE}" để xác nhận phục hồi`);
    const row = (await this.db.query<{ data: Buffer; schema_version: number }>('SELECT data, schema_version FROM hk_backups WHERE id = $1', [id]))[0];
    if (!row) throw new NotFoundException('Không tìm thấy bản sao lưu');
    const current = await this.schemaVersion(this.db.query.bind(this.db) as Q);
    if (row.schema_version !== current) throw new ConflictException(`Bản sao lưu ở phiên bản lược đồ ${row.schema_version}, hệ thống đang ở ${current}; không phục hồi chéo phiên bản`);
    let parsed: { tables: Record<string, Array<Record<string, unknown>>> };
    try { parsed = JSON.parse(gunzipSync(row.data).toString('utf8')); } catch { throw new BadRequestException('Tệp sao lưu bị hỏng'); }
    const before = await this.create('pre_restore', user, `Tự động trước khi phục hồi bản #${id}`);
    if (this.running) throw new ConflictException('Đang có thao tác khác');
    this.running = true;
    try {
      const restored = await this.db.tx(async (run) => {
        const existing = new Set(await this.tableNames(run));
        const names = Object.keys(parsed.tables).filter((n) => existing.has(n));
        const order = await this.insertOrder(run, names);
        for (const n of [...order].reverse()) await run(`DELETE FROM public.${q(n)}`);
        let rows = 0;
        for (const n of order) {
          const list = parsed.tables[n] ?? [];
          for (let i = 0; i < list.length; i += 2000) {
            await run(`INSERT INTO public.${q(n)} SELECT * FROM jsonb_populate_recordset(NULL::public.${q(n)}, $1::jsonb)`, [JSON.stringify(list.slice(i, i + 2000))]);
          }
          rows += list.length;
        }
        // đưa bộ đếm tự tăng về sau giá trị lớn nhất để dữ liệu mới không trùng khóa
        const serials = await run<{ t: string; c: string; s: string }>(
          `SELECT c.table_name AS t, c.column_name AS c, pg_get_serial_sequence(format('public.%I', c.table_name), c.column_name) AS s FROM information_schema.columns c
           WHERE c.table_schema = 'public' AND c.column_default LIKE 'nextval(%'`);
        for (const s of serials.filter((x) => x.s && existing.has(x.t) && names.includes(x.t))) {
          await run(`SELECT setval($1, GREATEST(1, COALESCE((SELECT max(${q(s.c)}) FROM public.${q(s.t)}), 1)), (SELECT count(*) > 0 FROM public.${q(s.t)}))`, [s.s]);
        }
        return { tables: names.length, rows };
      });
      return { restored: true, backup_id: id, safety_backup_id: before.id, ...restored, note: 'Mọi người dùng có thể phải đăng nhập lại bằng mật khẩu tại thời điểm sao lưu.' };
    } finally {
      this.running = false;
    }
  }

  // ---------------------------------------------------------------------- tự động hằng ngày (HK.SYS.019)
  async autoIfDue(now = new Date()): Promise<boolean> {
    const s = await this.system.settings();
    if (!s.backup_enabled) return false;
    const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: s.timezone, hour: '2-digit', hourCycle: 'h23' }).format(now));
    if (hour !== s.backup_hour) return false;
    const recent = await this.db.query("SELECT 1 FROM hk_backups WHERE kind = 'auto' AND created_at > now() - interval '20 hours' LIMIT 1");
    if (recent.length) return false;
    try { await this.create('auto', null, 'Sao lưu tự động hằng ngày'); return true; } catch (e) { ErrorLog.report('job', `Sao lưu tự động lỗi: ${(e as Error).message}`); return false; }
  }
}
