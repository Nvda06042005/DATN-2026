/**
 * Quy tắc dùng chung cho nội dung soạn thảo (câu hỏi, bộ đề, hành trình): ba kho – của giáo viên, của trường, của hệ thống.
 *  - Giáo viên thấy nội dung của mình, kho trường mình và kho hệ thống; chỉ sửa/xóa nội dung do mình soạn trong kho riêng.
 *  - Quản trị viên trường thấy kho trường mình và kho hệ thống, duyệt nội dung giáo viên chia sẻ, đề xuất nội dung lên hệ thống.
 *  - Quản trị tổng soạn và sửa kho hệ thống, xem nội dung kho trường để duyệt.
 */
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Q, UserRow } from '../database/database.service';
import { Entity, SPECS } from '../history/history.service';

export type Scope = 'teacher' | 'school' | 'system';
export const SCOPE_LABEL: Record<Scope, string> = { teacher: 'Của tôi', school: 'Kho của trường', system: 'Kho hệ thống' };

export interface Owned { scope: Scope; school_id: number | null; owner_id: number | null }

/** Điều kiện SQL các dòng người dùng được xem; thêm tham số vào `params` */
export function visibleSql(user: UserRow, alias: string, params: unknown[]): string {
  if (user.role === 'root_admin') return `${alias}.scope IN ('system', 'school')`;
  if (user.role === 'school_admin') {
    params.push(user.school_id);
    return `((${alias}.scope = 'school' AND ${alias}.school_id = $${params.length}) OR ${alias}.scope = 'system')`;
  }
  params.push(user.id, user.school_id);
  const me = params.length - 1;
  const school = params.length;
  return `((${alias}.scope = 'teacher' AND ${alias}.owner_id = $${me}) OR (${alias}.scope = 'school' AND ${alias}.school_id = $${school}) OR ${alias}.scope = 'system')`;
}

/** Điều kiện SQL theo ô chọn kho: mine | school | system | all (mặc định tất cả) */
export function storeSql(user: UserRow, alias: string, store: string | undefined, params: unknown[]): string {
  if (store === 'mine') {
    if (user.role === 'root_admin') return `${alias}.scope = 'system'`;
    if (user.role === 'school_admin') return 'false';
    params.push(user.id);
    return `(${alias}.scope = 'teacher' AND ${alias}.owner_id = $${params.length})`;
  }
  if (store === 'school') return `${alias}.scope = 'school'`;
  if (store === 'system') return `${alias}.scope = 'system'`;
  return 'true';
}

export function canSee(user: UserRow, row: Owned): boolean {
  if (user.role === 'root_admin') return row.scope !== 'teacher';
  if (row.scope === 'system') return true;
  if (row.scope === 'school') return Boolean(user.school_id) && row.school_id === user.school_id;
  return user.role === 'teacher' && row.owner_id === user.id;
}

/** Giáo viên sửa nội dung riêng của mình; quản trị tổng sửa kho hệ thống; kho trường chỉ đổi qua duyệt và sao chép */
export function canEdit(user: UserRow, row: Owned): boolean {
  if (user.role === 'root_admin') return row.scope === 'system';
  if (user.role === 'teacher') return row.scope === 'teacher' && row.owner_id === user.id;
  return false;
}

/** Kho và trường của nội dung mới do người dùng soạn */
export function authoringScope(user: UserRow): { scope: Scope; school_id: number | null; owner_id: number } {
  if (user.role === 'root_admin') return { scope: 'system', school_id: null, owner_id: user.id };
  if (user.role === 'teacher') {
    if (!user.school_id) throw new ForbiddenException('Tài khoản giáo viên chưa được gán trường');
    return { scope: 'teacher', school_id: user.school_id, owner_id: user.id };
  }
  throw new ForbiddenException('Quản trị viên trường duyệt và đề xuất nội dung; giáo viên hoặc quản trị tổng soạn nội dung');
}

export const notFound = (what: string): NotFoundException => new NotFoundException(`Không tìm thấy ${what}`);

// ------------------------------------------------------------------ liên kết với kho dữ liệu lịch sử
export const LINK_TYPES = ['campaign', 'figure', 'event', 'place', 'battle', 'source'] as const;
export type LinkType = (typeof LINK_TYPES)[number];
export interface LinkInput { ref_type: LinkType | 'term'; ref_id: number }

/** Kiểm tra từng liên kết tồn tại trong kho lịch sử, loại trùng; tối đa 12 liên kết mỗi nội dung */
export async function checkLinks(q: Q, links: LinkInput[] | undefined, allowed: readonly string[] = LINK_TYPES): Promise<LinkInput[]> {
  const unique = new Map<string, LinkInput>();
  for (const l of links ?? []) unique.set(`${l.ref_type}:${l.ref_id}`, l);
  if (unique.size > 12) throw new BadRequestException('Mỗi nội dung gắn tối đa 12 mục lịch sử');
  for (const l of unique.values()) {
    const spec = SPECS[l.ref_type as Entity];
    if (!allowed.includes(l.ref_type) || !spec || !(await q(`SELECT 1 FROM ${spec.table} WHERE id = $1`, [l.ref_id])).length) throw new NotFoundException(`Mục lịch sử ${l.ref_type} #${l.ref_id} không tồn tại`);
  }
  return [...unique.values()];
}

/** Tên hiển thị của các liên kết (mọi trạng thái cho người soạn; học sinh chỉ thấy mục đã công bố ở lớp dịch vụ học sinh) */
export async function linkLabels(q: Q, links: LinkInput[]): Promise<Array<LinkInput & { label: string }>> {
  const out: Array<LinkInput & { label: string }> = [];
  for (const l of links) {
    const spec = SPECS[l.ref_type as Entity];
    const row = (await q<Record<string, string>>(`SELECT ${spec.main} AS label FROM ${spec.table} WHERE id = $1`, [l.ref_id]))[0];
    if (row) out.push({ ...l, label: row.label });
  }
  return out;
}
