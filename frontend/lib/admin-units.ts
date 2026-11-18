/**
 * Khu vực của trường theo mô hình chính quyền địa phương hai cấp từ 01/07/2025: tỉnh / thành phố và phường / xã / đặc khu, không còn quận / huyện /
 * thị xã. Danh sách 34 tỉnh / thành và 3.321 phường / xã / đặc khu lấy từ máy chủ (/api/admin/admin-units, nguồn ở backend/src/admin/admin-units.ts);
 * ở đây chỉ có các hàm hiển thị và ghép địa chỉ "số nhà, đường, phường / xã, tỉnh / thành".
 */
import { apiRequest } from '@/api/client';

/** Bỏ dấu, chữ thường, gom ký tự khác chữ / số thành một dấu cách */
export const foldText = (text: string | null | undefined): string =>
  String(text ?? '').replace(/đ/g, 'd').replace(/Đ/g, 'D').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Phường / xã / đặc khu của mô hình hai cấp */
export const isNewUnit = (region: string | null | undefined): boolean => /^(phường|xã|đặc khu)\s/i.test(String(region ?? '').trim());
/** Quận / huyện / thị xã / thành phố thuộc tỉnh cũ (đã bỏ từ 01/07/2025) */
export const isOldDistrict = (region: string | null | undefined): boolean => /^(quận|huyện|thị xã|thành phố)\s/i.test(String(region ?? '').trim());

const ADMIN_SEGMENT = /^(phuong|p|xa|x|dac khu|thi tran|tt|quan|q|huyen|h|thi xa|tx|thanh pho|tp|tinh|viet nam|vn)( |$)/;

/** Phần số nhà / đường / thôn ở đầu địa chỉ, trước phần đơn vị hành chính */
export function streetPart(address: string | null | undefined, city?: string | null): string {
  const cityKey = foldText(city).replace(/^(tinh|thanh pho) /, '');
  const out: string[] = [];
  for (const part of String(address ?? '').split(',').map((s) => s.trim()).filter(Boolean)) {
    const f = foldText(part);
    if (ADMIN_SEGMENT.test(f) || (cityKey && f === cityKey) || /^\d{5,6}$/.test(f)) break;
    out.push(part);
  }
  return out.join(', ');
}

/** Địa chỉ dạng mới: số nhà / đường, phường / xã, tỉnh / thành */
export const composeAddress = (street: string | null | undefined, ward: string | null | undefined, city: string | null | undefined): string =>
  [street, ward, city].map((s) => String(s ?? '').trim()).filter(Boolean).join(', ');

/** Khu vực để hiển thị: chỉ phường / xã mới và tỉnh / thành (quận / huyện cũ không còn là địa chỉ) */
export const placeText = (region: string | null | undefined, city: string | null | undefined): string =>
  [isNewUnit(region) ? region : null, city].filter(Boolean).join(' · ');

/** Địa chỉ để hiển thị: địa chỉ đã lưu, chưa có thì ghép từ phường / xã và tỉnh / thành */
export const addressText = (school: { address?: string | null; region?: string | null; city?: string | null }): string =>
  school.address || composeAddress(null, isNewUnit(school.region) ? school.region : null, school.city);

export interface AdminProvince { code: string; name: string; wards: number }
type UnitsInfo = { version: string; decree: string; source: string; provinces: number | AdminProvince[]; wards: number | string[] };

let provincesCache: Promise<AdminProvince[]> | null = null;
const wardCache = new Map<string, Promise<string[]>>();

/** 34 tỉnh / thành hiện hành (tải một lần mỗi phiên trang) */
export function loadProvinces(token: string): Promise<AdminProvince[]> {
  if (!provincesCache) provincesCache = apiRequest<UnitsInfo & { provinces: AdminProvince[] }>('/api/admin/admin-units', { token }).then((r) => r.provinces).catch((e) => { provincesCache = null; throw e; });
  return provincesCache;
}

/** Phường / xã / đặc khu của một tỉnh / thành */
export function loadWards(token: string, city: string): Promise<string[]> {
  const key = foldText(city);
  let hit = wardCache.get(key);
  if (!hit) {
    hit = apiRequest<UnitsInfo & { wards: string[] }>(`/api/admin/admin-units?city=${encodeURIComponent(city)}`, { token }).then((r) => r.wards).catch((e) => { wardCache.delete(key); throw e; });
    wardCache.set(key, hit);
  }
  return hit;
}

/** Tỉnh / thành trong danh sách khớp tên đang lưu (không phân biệt dấu, chữ hoa, chữ "Tỉnh / Thành phố / TP." ở đầu) */
export function matchProvince(provinces: AdminProvince[], city: string | null | undefined): AdminProvince | null {
  const key = foldText(String(city ?? '').replace(/^tp\.\s*/i, 'Thành phố ')).replace(/^(tinh|thanh pho|tp) /, '');
  return key ? provinces.find((p) => foldText(p.name).replace(/^(tinh|thanh pho) /, '') === key) ?? null : null;
}

/** Lọc phường / xã theo chữ đang gõ (không dấu, không cần gõ chữ "Phường / Xã") */
export function filterWards(wards: string[], query: string, limit = 40): string[] {
  const q = foldText(query).replace(/^(phuong|xa|dac khu|p|x) /, '');
  if (!q) return wards.slice(0, limit);
  const starts: string[] = [], contains: string[] = [];
  for (const w of wards) {
    const name = foldText(w).replace(/^(phuong|xa|dac khu) /, '');
    if (name.startsWith(q)) starts.push(w); else if (name.includes(q)) contains.push(w);
  }
  return [...starts, ...contains].slice(0, limit);
}
