/**
 * Môi trường chạy mô hình AI Python (ai/bridge_cli.py) cho AiTutorService (14/11/2026):
 * - chọn lệnh Python: AI_PYTHON, rồi bản cài bởi scripts/setup-ai-python.mjs (backend/.ai-python), rồi python3 / python của máy;
 * - thời gian chờ nạp mô hình và chờ trả lời (máy chủ Render miễn phí chậm hơn máy cá nhân nhiều lần);
 * - chặn khởi động Python khi container không đủ bộ nhớ, để không làm sập cả backend (gói miễn phí 512 MB);
 * - trạng thái mô hình hiện ở /api/health (ai_engine) để biết AI đang chạy bằng mô hình Python hay chế độ dự phòng và vì sao.
 * Tách riêng khỏi ai-tutor.service.ts để code mô hình của nhóm AI ít bị xung đột khi gộp nhánh.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const BACKEND_DIR = join(__dirname, '..', '..');
const num = (v: string | undefined): number | null => (v && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);

export const onRender = Boolean(process.env.RENDER_SERVICE_NAME || process.env.RENDER === 'true' || BACKEND_DIR.startsWith('/opt/render/'));

/** Lệnh Python dùng để chạy cầu nối */
export function pythonCommand(): string {
  if (process.env.AI_PYTHON) return process.env.AI_PYTHON;
  const dir = join(BACKEND_DIR, '.ai-python');
  for (const p of [join(dir, 'python', 'bin', 'python3'), join(dir, 'venv', 'bin', 'python'), join(dir, 'venv', 'Scripts', 'python.exe')]) {
    if (existsSync(p)) return p;
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}

/** Chờ mô hình nạp xong (Render miễn phí: CPU 0,1 nên nạp chậm) */
export const bridgeReadyMs = (): number => num(process.env.AI_BRIDGE_READY_MS) ?? (onRender ? 240_000 : 45_000);
/** Chờ một câu trả lời */
export const bridgeRequestMs = (): number => num(process.env.AI_BRIDGE_TIMEOUT_MS) ?? (onRender ? 30_000 : 8_000);
/** Nạp mô hình ngay khi backend khởi động (mặc định bật trên Render) để câu hỏi đầu tiên không phải chờ */
export const warmOnBoot = (): boolean => process.env.AI_BRIDGE_WARM === '1' || (onRender && process.env.AI_BRIDGE_WARM !== '0');

const readNumber = (file: string): number | null => {
  try {
    const v = readFileSync(file, 'utf8').trim();
    return v === 'max' ? null : Number(v);
  } catch { return null; }
};

/**
 * Bộ nhớ còn trống của container (cgroup v2 hoặc v1, không tính bộ đệm tệp thu hồi được). Không đọc được giới hạn (Windows, máy cá nhân) thì coi là đủ.
 * Mô hình Python cần khoảng 220–250 MB; mặc định đòi còn trống 280 MB (AI_PYTHON_MIN_FREE_MB).
 */
export function memoryRoom(): { ok: boolean; free_mb: number | null; limit_mb: number | null; need_mb: number } {
  const need = num(process.env.AI_PYTHON_MIN_FREE_MB) ?? 280;
  const limit = readNumber('/sys/fs/cgroup/memory.max') ?? readNumber('/sys/fs/cgroup/memory/memory.limit_in_bytes');
  const current = readNumber('/sys/fs/cgroup/memory.current') ?? readNumber('/sys/fs/cgroup/memory/memory.usage_in_bytes');
  if (!limit || !current || limit > 64 * 2 ** 30) return { ok: true, free_mb: null, limit_mb: null, need_mb: need };
  let cache = 0;
  try { cache = Number(/^(?:total_)?inactive_file (\d+)$/m.exec(readFileSync('/sys/fs/cgroup/memory.stat', 'utf8'))?.[1] ?? 0); } catch { /* không có thì bỏ qua */ }
  const free = Math.round((limit - (current - cache)) / 2 ** 20);
  return { ok: free >= need, free_mb: free, limit_mb: Math.round(limit / 2 ** 20), need_mb: need };
}

export type EngineStatus = 'idle' | 'starting' | 'ready' | 'unavailable';
const engine: { status: EngineStatus; python: string | null; reason: string | null; since: string | null; ready_seconds: number | null; pid: number | null } = {
  status: 'idle', python: null, reason: null, since: null, ready_seconds: null, pid: null,
};

export function markEngine(status: EngineStatus, extra: { python?: string; reason?: string | null; pid?: number | null; readyMs?: number } = {}): void {
  engine.status = status;
  engine.since = new Date().toISOString();
  if (extra.python !== undefined) engine.python = extra.python;
  if (extra.reason !== undefined) engine.reason = extra.reason ? extra.reason.slice(-500) : null;
  if (extra.pid !== undefined) engine.pid = extra.pid;
  if (extra.readyMs !== undefined) engine.ready_seconds = Math.round(extra.readyMs / 100) / 10;
}

const rssMb = (pid: number | null): number | null => {
  if (!pid) return null;
  try { return Math.round(Number(/VmRSS:\s+(\d+)/.exec(readFileSync(`/proc/${pid}/status`, 'utf8'))?.[1] ?? 0) / 1024) || null; } catch { return null; }
};

/** Trạng thái cho /api/health: mô hình Python (python) hay chế độ dự phòng, kèm lý do và bộ nhớ */
export function engineHealth() {
  const room = memoryRoom();
  return {
    mode: engine.status === 'ready' ? 'python' : 'fallback',
    status: engine.status, reason: engine.reason, since: engine.since, ready_seconds: engine.ready_seconds,
    python: engine.python ? engine.python.replace(BACKEND_DIR, 'backend') : null,
    memory_mb: { node: Math.round(process.memoryUsage().rss / 2 ** 20), python: rssMb(engine.pid), free: room.free_mb, limit: room.limit_mb },
  };
}
