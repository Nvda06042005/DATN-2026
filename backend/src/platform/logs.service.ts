/**
 * Nhật ký hoạt động và lỗi truy vấn được từ trang quản trị (Sprint 11, HK.QT.051, HK.AD.027, HK.AD.075, HK.AD.076, HK.SYS.020).
 * Lịch sử đăng nhập (kèm IP, thiết bị) và nhật ký thao tác dùng lại bảng của Sprint 1; nhật ký lỗi là bảng mới, được ghi từ bộ lọc lỗi, bộ gửi thư, bộ gọi AI và việc nền.
 * Quản trị trường chỉ thấy dữ liệu của trường mình; quản trị tổng thấy tất cả. Không ghi nội dung yêu cầu, mật khẩu hay mã.
 */
import { ForbiddenException, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { LogFacet, SecurityService, SecurityFilter } from '../auth/security.service';
import { DatabaseService, UserRow } from '../database/database.service';
import { ErrorEntry, ErrorLog } from './error-log';

const NOUN: Array<[RegExp, string]> = [
  [/\/teachers\b/, 'giáo viên'], [/\/students\b/, 'học sinh'], [/\/users\b/, 'tài khoản'], [/\/classes\b/, 'lớp'], [/\/schools\b|\/school\b/, 'trường'], [/\/school-years\b|\/years\b/, 'năm học'],
  [/\/questions\b/, 'câu hỏi'], [/\/quizzes\b/, 'bộ đề'], [/\/journeys\b/, 'hành trình'], [/\/lessons\b/, 'bài học'], [/\/history\b/, 'kho lịch sử'], [/\/ai\b/, 'AI Tutor'],
  [/\/shares\b/, 'đề xuất nội dung'], [/\/assignments\b/, 'bài tập'], [/\/teams\b/, 'đội'], [/\/live\b/, 'phòng thi đấu'], [/\/game\b/, 'trò chơi hóa'], [/\/war\b/, 'game thẻ tướng'],
  [/\/battle\b/, 'mô phỏng trận đánh'], [/\/platform\b/, 'hệ thống'], [/\/content\b/, 'nội dung'], [/\/mail\b/, 'thư'], [/\/auth\b/, 'tài khoản'], [/\/analytics\b/, 'báo cáo'],
];
const VERB: Array<[RegExp, string]> = [
  [/reissue-password/, 'Cấp lại mật khẩu'], [/reset-password/, 'Đặt lại mật khẩu'], [/\/lock\b/, 'Khóa'], [/\/unlock\b/, 'Mở khóa'], [/\/restore\b/, 'Khôi phục'], [/\/status\b/, 'Đổi trạng thái'], [/\/publish/, 'Công bố'],
  [/\/copy\b/, 'Nhân bản'], [/\/import\b/, 'Nhập Excel'], [/\/archive\b/, 'Lưu trữ'], [/\/approve\b/, 'Duyệt'], [/\/reject\b/, 'Từ chối'], [/\/assign\b/, 'Giao'], [/\/transfer\b/, 'Chuyển'],
  [/\/members\b/, 'Cập nhật thành viên'], [/\/send\b|\/feedback\b|\/broadcasts\b/, 'Gửi'], [/\/reindex\b/, 'Lập chỉ mục'], [/change-password/, 'Đổi mật khẩu'], [/\/settings\b/, 'Đổi cấu hình'],
];

/** Nhãn riêng cho các thao tác của nhóm nền tảng và tài khoản (kiểm tra trước các quy tắc chung bên dưới); [phương thức, mẫu đường dẫn, nhãn] */
const SPECIAL: Array<[string | null, RegExp, string]> = [
  ['POST', /\/platform\/broadcasts$/, 'Gửi thông báo'], ['PUT', /\/platform\/broadcasts\/:id$/, 'Sửa thông báo'], ['DELETE', /\/platform\/broadcasts\/:id$/, 'Thu hồi / hủy thông báo'],
  // khảo sát đã xóa ngày 16/11/2026; giữ nhãn để nhật ký thao tác cũ vẫn đọc được
  ['POST', /\/platform\/surveys\/:id\/respond$/, 'Trả lời khảo sát'], ['POST', /\/platform\/surveys$/, 'Tạo khảo sát'], ['PUT', /\/platform\/surveys\/:id$/, 'Cập nhật khảo sát'], ['DELETE', /\/platform\/surveys\/:id$/, 'Xóa khảo sát'],
  [null, /\/platform\/survey-templates/, 'Sửa mẫu khảo sát'], [null, /\/platform\/experiments\/classes/, 'Gán lớp vào nhóm thử nghiệm'], [null, /\/platform\/experiments\/groups/, 'Sửa nhóm thử nghiệm'],
  [null, /\/platform\/support\/:id\/reply$/, 'Trả lời yêu cầu hỗ trợ'], [null, /\/platform\/support\/:id\/status$/, 'Đổi trạng thái yêu cầu hỗ trợ'], ['POST', /\/platform\/support$/, 'Gửi yêu cầu hỗ trợ'],
  [null, /\/platform\/prefs$/, 'Đổi cài đặt cá nhân'], [null, /\/platform\/notices\//, 'Đọc / xóa thông báo'], [null, /\/platform\/settings$/, 'Đổi cấu hình hệ thống'], [null, /\/platform\/flags\//, 'Bật / tắt tính năng'],
  [null, /\/platform\/templates\//, 'Sửa mẫu thư'], [null, /\/platform\/schools\/:id\/limits/, 'Đổi giới hạn của trường'], [null, /\/platform\/rbac$/, 'Đổi ma trận phân quyền'],
  [null, /\/platform\/backups\/:id\/restore$/, 'Phục hồi dữ liệu'], [null, /\/platform\/backups/, 'Sao lưu dữ liệu'], [null, /\/platform\/2fa/, 'Đổi cài đặt xác thực hai lớp'], [null, /\/platform\/faq/, 'Sửa hướng dẫn / FAQ'],
  [null, /\/platform\/logs\/errors/, 'Dọn nhật ký lỗi'], ['POST', /\/users\/:id\/lock$/, 'Khóa / mở khóa tài khoản'], [null, /\/schools\/:id\/logo$/, 'Đổi logo trường'], [null, /\/school\/logo$/, 'Đổi logo trường'], [null, /\/auth\/confirm-profile$/, 'Xác nhận hồ sơ'], [null, /\/auth\/change-password$/, 'Đổi mật khẩu'], [null, /\/game\/character$/, 'Chọn nhân vật'],
];

/** "POST /admin/teachers" → "Tạo giáo viên": nhãn dễ đọc cho nhật ký thao tác (không phải bản dịch hoàn chỉnh của mọi đường dẫn) */
export function describeAction(action: string): string {
  const [method, ...rest] = action.split(' ');
  const route = rest.join(' ');
  const special = SPECIAL.find(([m, re]) => (m === null || m === method) && re.test(route));
  if (special) return special[2];
  const noun = NOUN.find(([re]) => re.test(route))?.[1] ?? 'dữ liệu';
  const verb = VERB.find(([re]) => re.test(route))?.[1];
  if (verb) return `${verb} ${noun}`;
  if (method === 'POST') return `Tạo / thực hiện ${noun}`;
  if (method === 'DELETE') return `Xóa ${noun}`;
  return `Cập nhật ${noun}`;
}

export interface ErrorFilterQuery { source?: string; q?: string; from?: string; to?: string; page?: number; limit?: number }

@Injectable()
export class LogsService implements OnModuleInit, OnModuleDestroy {
  private recent = new Map<string, number>();

  constructor(private readonly db: DatabaseService, private readonly security: SecurityService) {}

  onModuleInit(): void {
    ErrorLog.setSink((e) => void this.write(e));
  }

  onModuleDestroy(): void { ErrorLog.setSink(null); }

  /** Ghi một lỗi; lỗi y hệt trong 10 giây chỉ ghi một lần để một sự cố lặp không làm đầy bảng */
  private async write(e: ErrorEntry): Promise<void> {
    if (!this.db.ready) return;
    const key = `${e.source}|${e.route ?? ''}|${e.message}`;
    const now = Date.now();
    if ((this.recent.get(key) ?? 0) > now - 10_000) return;
    this.recent.set(key, now);
    if (this.recent.size > 500) for (const [k, t] of this.recent) if (t < now - 10_000) this.recent.delete(k);
    try {
      await this.db.query('INSERT INTO hk_error_log (source, message, route, status, user_id, school_id) VALUES ($1, $2, $3, $4, $5, $6)', [e.source, e.message, e.route ?? null, e.status ?? null, e.user_id ?? null, e.school_id ?? null]);
    } catch { /* nhật ký lỗi không được gây lỗi mới */ }
  }

  async errors(user: UserRow, f: ErrorFilterQuery) {
    if (user.role !== 'root_admin') throw new ForbiddenException('Chỉ quản trị viên tổng xem nhật ký lỗi');
    const where: string[] = [], params: unknown[] = [];
    const add = (sql: string, v: unknown) => { params.push(v); where.push(sql.replace('?', `$${params.length}`)); };
    if (f.source && ['api', 'ai', 'email', 'job', 'db'].includes(f.source)) add('e.source = ?', f.source);
    if (f.q?.trim()) add("(e.message || ' ' || COALESCE(e.route, '')) ILIKE ? ESCAPE '\\'", `%${f.q.trim().replace(/[\\%_]/g, '\\$&')}%`);
    if (f.from && /^\d{4}-\d{2}-\d{2}$/.test(f.from)) add('e.created_at >= ?::date', f.from);
    if (f.to && /^\d{4}-\d{2}-\d{2}$/.test(f.to)) add("e.created_at < (?::date + 1)", f.to);
    const cond = where.length ? where.join(' AND ') : 'TRUE';
    const page = Math.max(1, Number(f.page) || 1), limit = Math.min(100, Math.max(1, Number(f.limit) || 30));
    const total = Number((await this.db.query<{ n: string }>(`SELECT count(*) AS n FROM hk_error_log e WHERE ${cond}`, params))[0].n);
    const items = await this.db.query(
      `SELECT e.id::int AS id, e.source, e.message, e.route, e.status, e.created_at, u.full_name AS user_name FROM hk_error_log e LEFT JOIN app_users u ON u.id = e.user_id
       WHERE ${cond} ORDER BY e.created_at DESC, e.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, (page - 1) * limit]);
    const by = await this.db.query<{ source: string; n: number }>('SELECT source, count(*)::int AS n FROM hk_error_log e WHERE e.created_at >= now() - interval \'24 hours\' GROUP BY source');
    return { total, page, limit, items, last_24h: Object.fromEntries(by.map((b) => [b.source, b.n])) };
  }

  async clearErrors(user: UserRow, olderThanDays: number) {
    if (user.role !== 'root_admin' || user.admin_level !== 1) throw new ForbiddenException('Chỉ quản trị viên tổng cấp 1 được dọn nhật ký lỗi');
    const days = Math.min(365, Math.max(1, Math.round(Number(olderThanDays)) || 30));
    const rows = await this.db.query('DELETE FROM hk_error_log WHERE created_at < now() - ($1::int * interval \'1 day\') RETURNING id', [days]);
    return { deleted: rows.length, older_than_days: days };
  }

  /** Nhật ký thao tác kèm nhãn dễ đọc (HK.QT.051, HK.AD.075); `label` lọc theo nhãn thao tác (quy đổi ra các đường dẫn gốc) */
  async audit(user: UserRow, f: SecurityFilter & { label?: string }) {
    // mặc định chỉ hiện thao tác của giáo viên và quản trị (học sinh thao tác rất nhiều nên làm loãng nhật ký); `students=true` để hiện cả học sinh
    const staff_only = f.staff_only ?? true;
    const actions = f.label ? (await this.security.facets(user, 'audit', 'action', '', staff_only)).map((x) => x.value).filter((a) => describeAction(a) === f.label) : undefined;
    const page = (await this.security.events(user, 'audit', { ...f, staff_only, actions: actions ? (actions.length ? actions : ['__khong_co__']) : undefined })) as unknown as { total: number; page: number; limit: number; items: Array<{ action: string } & Record<string, unknown>> };
    return { ...page, items: page.items.map((i) => ({ ...i, label: describeAction(i.action) })) };
  }

  /**
   * Lịch sử đăng nhập có thiết bị (HK.AD.027); quản trị trường chỉ xem người dùng trường mình. Từ 18/11/2026 không trả địa chỉ IP cho giao diện
   * (người dùng chọn chỉ bỏ khỏi giao diện; máy chủ vẫn lưu để điều tra sự cố). `device` lọc theo nhãn thiết bị (quy đổi ra user-agent gốc).
   */
  async logins(user: UserRow, f: SecurityFilter & { device?: string }) {
    const agents = f.device ? (await this.security.facets(user, 'login', 'device', '', false)).map((x) => x.value).filter((ua) => deviceOf(ua || null) === f.device) : undefined;
    const page = (await this.security.events(user, 'login', { ...f, agents: agents ? (agents.length ? agents : ['__khong_co__']) : undefined })) as unknown as { items: Array<{ user_agent?: string | null; ip?: unknown } & Record<string, unknown>> } & Record<string, unknown>;
    return { ...page, items: page.items.map(({ ip: _ip, ...i }) => ({ ...i, device: deviceOf(i.user_agent ?? null) })) };
  }

  /** Giá trị để chọn khi lọc một cột nhật ký: thao tác / thiết bị gộp theo nhãn dễ đọc, kết quả đăng nhập theo lý do */
  async facets(user: UserRow, kind: 'audit' | 'login', field: LogFacet, term = '', staffOnly = true): Promise<Array<{ value: string; label: string }>> {
    if (field === 'action' || field === 'device') {
      const raw = await this.security.facets(user, kind, field, '', staffOnly);
      const labels = [...new Set(raw.map((x) => (field === 'action' ? describeAction(x.value) : deviceOf(x.value || null))))].sort((a, b) => a.localeCompare(b, 'vi'));
      const needle = term.trim().toLowerCase();
      return labels.filter((l) => !needle || l.toLowerCase().includes(needle)).map((l) => ({ value: l, label: l }));
    }
    return (await this.security.facets(user, kind, field, term, staffOnly)).slice(0, 500);
  }
}

/** Tóm tắt user-agent thành "Chrome trên Windows" để quản trị đọc nhanh; không phân tích sâu */
export function deviceOf(ua: string | null): string {
  if (!ua) return 'Không rõ';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /node|axios|curl|undici/i.test(ua) ? 'Chương trình tự động' : 'Trình duyệt khác';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iOS/.test(ua) ? 'iOS' : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} trên ${os}` : browser;
}
