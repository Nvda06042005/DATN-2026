/**
 * Ma trận phân quyền theo vai trò (Sprint 11, HK.AD.026): bảng `hk_permissions` khởi tạo theo sheet "Phân quyền" của đặc tả.
 * Chỉ các tính năng đánh dấu `enforced` mới được nối vào kiểm tra của máy chủ (xem PolicyInterceptor); các dòng còn lại phản ánh quyền cố định trong mã nguồn
 * nên chỉ để xem. Quản trị viên tổng cấp 1 chỉ có thể THU HẸP quyền (tắt) hoặc khôi phục về mức đặc tả, không cấp thêm quyền mà mã nguồn không có, và không đổi
 * quyền của chính vai trò quản trị tổng để không tự khóa mình. Cấp 2 chỉ được xem.
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, UserRow } from '../database/database.service';
import { assertSystemAdmin } from './system.service';

export const ROLES = ['student', 'teacher', 'school_admin', 'root_admin'] as const;
export type RoleKey = (typeof ROLES)[number];

/** Đường dẫn nào thuộc tính năng nào của ma trận (chỉ các tính năng đã nối) */
export const FEATURE_ROUTES: Array<{ key: string; method?: string; re: RegExp; message: string }> = [
  { key: 'ai_tutor', re: /^\/api\/ai\/(?!admin\/)/, message: 'Vai trò của bạn hiện không được dùng AI Tutor' },
  { key: 'reco', re: /^\/api\/analytics\/me\//, message: 'Vai trò của bạn hiện không được dùng gợi ý học tập' },
  { key: 'reports', re: /^\/api\/analytics\/(classes|results|students|export|school|usage|ai|system)/, message: 'Vai trò của bạn hiện không được xem báo cáo' },
  { key: 'live_host', method: 'POST', re: /^\/api\/live\/rooms$/, message: 'Vai trò của bạn hiện không được tổ chức phòng thi đấu' },
  { key: 'announce', re: /^\/api\/platform\/broadcasts/, message: 'Vai trò của bạn hiện không được gửi thông báo' },
  { key: 'survey', re: /^\/api\/platform\/(surveys|survey-templates)/, message: 'Vai trò của bạn hiện không được dùng khảo sát' },
  { key: 'support', re: /^\/api\/platform\/support/, message: 'Vai trò của bạn hiện không được gửi yêu cầu hỗ trợ' },
  { key: 'audit_log', re: /^\/api\/(admin\/audit-history|platform\/logs\/audit)/, message: 'Vai trò của bạn hiện không được xem nhật ký hoạt động' },
];

@Injectable()
export class RbacService {
  private cache: { at: number; map: Map<string, boolean> } | null = null;

  constructor(private readonly db: DatabaseService) {}

  private async map(): Promise<Map<string, boolean>> {
    if (this.cache && Date.now() - this.cache.at < 5000) return this.cache.map;
    const rows = await this.db.query<{ feature_key: string; role: string; allowed: boolean }>('SELECT feature_key, role, allowed FROM hk_permissions');
    const map = new Map(rows.map((r) => [`${r.feature_key}:${r.role}`, r.allowed]));
    this.cache = { at: Date.now(), map };
    return map;
  }

  /** Chưa có dòng nào thì cho phép (không khóa nhầm khi bảng chưa sẵn sàng) */
  async can(role: string, key: string): Promise<boolean> { return (await this.map()).get(`${key}:${role}`) ?? true; }

  async matrix() {
    const features = await this.db.query<{ key: string; position: number; label: string; note: string | null; enforced: boolean }>('SELECT key, position, label, note, enforced FROM hk_permission_features ORDER BY position');
    const cells = await this.db.query<{ feature_key: string; role: string; allowed: boolean; baseline: boolean }>('SELECT feature_key, role, allowed, baseline FROM hk_permissions');
    return {
      roles: ROLES,
      features: features.map((f) => ({
        ...f,
        cells: Object.fromEntries(ROLES.map((r) => {
          const c = cells.find((x) => x.feature_key === f.key && x.role === r);
          // sửa được: tính năng đã nối, không phải vai trò quản trị tổng, và đặc tả có cấp quyền cho vai trò đó
          return [r, { allowed: c?.allowed ?? false, baseline: c?.baseline ?? false, editable: f.enforced && r !== 'root_admin' && Boolean(c?.baseline) }];
        })),
      })),
    };
  }

  async update(user: UserRow, changes: unknown) {
    assertSystemAdmin(user);
    if (!Array.isArray(changes) || !changes.length || changes.length > 100) throw new BadRequestException('Danh sách thay đổi không hợp lệ');
    await this.db.tx(async (q) => {
      for (const raw of changes as Array<{ feature_key?: string; role?: string; allowed?: boolean }>) {
        if (typeof raw?.feature_key !== 'string' || !ROLES.includes(raw.role as RoleKey) || typeof raw.allowed !== 'boolean') throw new BadRequestException('Thay đổi không hợp lệ');
        const cell = (await q<{ baseline: boolean; enforced: boolean }>(
          'SELECT p.baseline, f.enforced FROM hk_permissions p JOIN hk_permission_features f ON f.key = p.feature_key WHERE p.feature_key = $1 AND p.role = $2', [raw.feature_key, raw.role]))[0];
        if (!cell) throw new NotFoundException(`Không có ô phân quyền ${raw.feature_key} / ${raw.role}`);
        if (!cell.enforced) throw new BadRequestException('Dòng này là quyền cố định trong mã nguồn nên không sửa được');
        if (raw.role === 'root_admin') throw new BadRequestException('Không đổi quyền của quản trị viên tổng để tránh tự khóa hệ thống');
        if (raw.allowed && !cell.baseline) throw new BadRequestException('Không thể cấp thêm quyền ngoài đặc tả: mã nguồn không có chức năng này cho vai trò đó');
        await q('UPDATE hk_permissions SET allowed = $3, updated_by = $4, updated_at = now() WHERE feature_key = $1 AND role = $2', [raw.feature_key, raw.role, raw.allowed, user.id]);
      }
    });
    this.cache = null;
    return this.matrix();
  }

  invalidate(): void { this.cache = null; }
}
