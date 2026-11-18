/**
 * Đơn vị hành chính hai cấp từ 01/07/2025 (18/11/2026): 34 tỉnh / thành phố trực thuộc trung ương và 3.321 phường / xã / đặc khu; không còn
 * quận / huyện / thị xã. Dữ liệu admin-units.json do scripts/build-admin-units.py dựng từ bộ dữ liệu mở "vietnamese-provinces-database"
 * (ThangLeQuoc, giấy phép MIT). Dùng để: chọn phường / xã của trường theo tỉnh / thành, kiểm tra dữ liệu gửi lên, ghép địa chỉ dạng mới
 * "số nhà, đường, phường / xã, tỉnh / thành" (như "120B Ngô Tất Tố, Phường Thạnh Mỹ Tây, Thành phố Hồ Chí Minh").
 * Không nhập mã khác: school-directory.ts nhập tệp này (tránh vòng lặp).
 */
import units from './admin-units.json';

export interface AdminWard { code: string; name: string }
export interface AdminProvince { code: string; name: string; wards: AdminWard[] }

/** Bỏ dấu, chữ thường, mọi ký tự không phải chữ / số thành một dấu cách */
export const foldText = (text: string): string =>
  (text ?? '').replace(/đ/g, 'd').replace(/Đ/g, 'D').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Bỏ chữ chỉ cấp ở đầu: "Thành phố Hồ Chí Minh" → "ho chi minh", "Phường Thạnh Mỹ Tây" → "thanh my tay" */
const PROVINCE_PREFIX = /^(tinh|thanh pho|tp) /;
const UNIT_PREFIX = /^(phuong|xa|dac khu|thi tran) /;
const shortProvince = (name: string) => foldText(name).replace(PROVINCE_PREFIX, '');

export const PROVINCES: AdminProvince[] = (units.provinces as Array<[string, string, Array<[string, string]>]>).map(([code, name, wards]) => ({
  code, name, wards: wards.map(([wcode, wname]) => ({ code: wcode, name: wname })),
}));
const byShort = new Map(PROVINCES.map((p) => [shortProvince(p.name), p]));
const wardIndex = new Map(PROVINCES.map((p) => [p.code, new Map(p.wards.map((w) => [foldText(w.name), w]))]));
const wardByShort = new Map(PROVINCES.map((p) => {
  const m = new Map<string, AdminWard[]>();
  for (const w of p.wards) { const k = foldText(w.name).replace(UNIT_PREFIX, ''); m.set(k, [...(m.get(k) ?? []), w]); }
  return [p.code, m];
}));

export const unitsInfo = () => ({ version: units.version, decree: units.decree, source: units.source, provinces: PROVINCES.length, wards: PROVINCES.reduce((n, p) => n + p.wards.length, 0) });

/** Tỉnh / thành theo tên (chấp nhận viết "Tỉnh Bắc Ninh" cũ, "TP. Hồ Chí Minh", có / không dấu) */
export function provinceOf(city: string | null | undefined): AdminProvince | null {
  const key = shortProvince(String(city ?? '').replace(/^tp\.\s*/i, 'Thành phố '));
  return key ? byShort.get(key) ?? null : null;
}

/** Tên tỉnh / thành hiện hành: đổi khi cấp đơn vị khác ("Tỉnh Bắc Ninh" → "Thành phố Bắc Ninh"), giữ cách viết dấu đang dùng nếu chỉ khác vị trí dấu */
export function currentCityName(city: string | null | undefined): string | null {
  const raw = String(city ?? '').trim();
  if (!raw) return null;
  const p = provinceOf(raw);
  if (!p) return raw;
  return foldText(p.name) === foldText(raw) ? raw : p.name;
}

/** Phường / xã / đặc khu thuộc tỉnh / thành (đúng tên đầy đủ, không phân biệt dấu) */
export function findWard(city: string | null | undefined, region: string | null | undefined): AdminWard | null {
  const p = provinceOf(city);
  if (!p || !region) return null;
  return wardIndex.get(p.code)?.get(foldText(region)) ?? null;
}

/** Tên đơn vị cấp xã của mô hình hai cấp */
export const isNewUnit = (region: string | null | undefined): boolean => /^(phường|xã|đặc khu)\s/i.test(String(region ?? '').trim());
/** Đơn vị cấp huyện cũ (đã bỏ từ 01/07/2025) */
export const isOldDistrict = (region: string | null | undefined): boolean => /^(quận|huyện|thị xã|thành phố)\s/i.test(String(region ?? '').trim());

const ADMIN_SEGMENT = /^(phuong|p|xa|x|dac khu|thi tran|tt|quan|q|huyen|h|thi xa|tx|thanh pho|tp|tinh|viet nam|vn)( |$)/;

/** Phần số nhà / đường / thôn ở đầu địa chỉ, trước phần đơn vị hành chính ("120B Ngô Tất Tố, phường Thạnh Mỹ Tây, …" → "120B Ngô Tất Tố") */
export function streetPart(address: string | null | undefined): string | null {
  const parts = String(address ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const out: string[] = [];
  for (const part of parts) {
    const f = foldText(part);
    if (ADMIN_SEGMENT.test(f) || byShort.has(f) || /^\d{5,6}$/.test(f)) break;
    out.push(part);
  }
  return out.join(', ') || null;
}

/** Địa chỉ dạng mới: số nhà / đường, phường / xã, tỉnh / thành */
export const composeAddress = (street: string | null | undefined, ward: string | null | undefined, city: string | null | undefined): string | null =>
  [street, ward, city].map((s) => String(s ?? '').trim()).filter(Boolean).join(', ') || null;

/**
 * Phường / xã đọc được từ địa chỉ đã ghi theo dạng mới (không còn quận / huyện); địa chỉ cũ có quận / huyện thì không đoán (một huyện cũ
 * đã chia về nhiều xã mới, tên xã cũ có thể trùng tên xã mới ở nơi khác).
 */
export function wardFromAddress(city: string | null | undefined, address: string | null | undefined): AdminWard | null {
  const p = provinceOf(city);
  const text = String(address ?? '');
  if (!p || !text || /(^|[\s,])(quận|huyện|thị xã|q\.|h\.|tx\.)\s/i.test(text)) return null;
  for (const part of text.split(',').map((s) => s.trim())) {
    const f = foldText(part);
    const m = /^(phuong|p|xa|x|dac khu)\s+(.+)$/.exec(f);
    if (!m) continue;
    const hits = (wardByShort.get(p.code)?.get(m[2]) ?? []).filter((w) => (m[1] === 'xa' || m[1] === 'x' ? /^xã/i.test(w.name) : m[1] === 'dac khu' ? /^đặc khu/i.test(w.name) : /^phường/i.test(w.name)));
    if (hits.length === 1) return hits[0];
  }
  return null;
}

/**
 * Gợi ý phường / xã khi chưa biết chắc (không tự điền – quản trị viên bấm chọn): tên xã / phường trong địa chỉ cũ trùng đúng một đơn vị mới của
 * tỉnh / thành, hoặc tên trường chứa đúng tên một đơn vị mới ("THCS An Thạnh 2" → "Xã An Thạnh").
 */
export function suggestWard(city: string | null | undefined, address: string | null | undefined, name: string | null | undefined): AdminWard | null {
  const p = provinceOf(city);
  if (!p) return null;
  const index = wardByShort.get(p.code)!;
  for (const part of String(address ?? '').split(',').map((s) => s.trim())) {
    const m = /^(phuong|p|xa|x|thi tran|tt)\s+(.+)$/.exec(foldText(part));
    const hits = m ? index.get(m[2]) ?? [] : [];
    if (hits.length === 1) return hits[0];
  }
  const words = ` ${foldText(String(name ?? '')).replace(/^(truong )?(thcs|th thcs|tieu hoc va thcs|trung hoc co so) /, '')} `;
  const found = [...index.entries()].filter(([k, list]) => list.length === 1 && k.length >= 4 && words.includes(` ${k} `));
  return found.length === 1 ? found[0][1][0] : null;
}
