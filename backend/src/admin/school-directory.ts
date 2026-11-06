/**
 * Danh mục trường THCS để quản trị tổng chọn khi thêm trường (mã, khu vực, tỉnh/thành tự điền) và quy tắc đặt tên đường dẫn riêng của trường.
 * Dữ liệu school-directory.json do scripts/build-school-directory.py dựng từ danh sách mã Bộ GD&ĐT (2020) và các sáp nhập 2026 của TP.HCM.
 * Đường dẫn trường: donga_<mã trường>_<tên trường>_<khu vực> không dấu, viết liền, ví dụ donga_79765507_phumy_binhthanh.
 */
import directory from './school-directory.json';
import extra from './school-directory-extra.json';
import metadata from './school-metadata.json';
import confirmed from './school-confirmed-2026.json';

export interface DirectoryEntry {
  code: string;
  name: string;
  /** Quận/huyện/thị xã theo dữ liệu gốc: mã trường vẫn gắn với đơn vị này */
  region: string;
  /** Tỉnh/thành phố theo đơn vị hành chính cấp tỉnh từ 01/07/2025 */
  city: string;
  note: string | null;
  address?: string | null;
  website?: string | null;
  logo_url?: string | null;
  source?: string | null;
  previous_codes?: string[];
}

interface SchoolMetadata { code: string; name: string; city: string; region: string; address?: string | null; website?: string | null; logo_url?: string | null; logo_sha256?: string | null; source?: string; additional?: boolean; verified: boolean; aliases?: string[]; previous_codes?: string[] }

type Row = [string, string, number, string, string | null];
const provinces = directory.provinces as string[];
const rows = [...directory.schools, ...extra.schools] as Row[];
const mergedAway = new Set((directory.merged as string[][]).map((m) => m[0]));
const metadataRows = [...metadata.schools, ...confirmed.schools] as SchoolMetadata[];
const mergedMetadata = new Map<string, SchoolMetadata>();
for (const row of metadataRows.filter(row => row.verified)) {
  const old = mergedMetadata.get(row.code);
  mergedMetadata.set(row.code, { ...old, ...row, address: row.address ?? old?.address, logo_url: row.logo_url ?? old?.logo_url });
}
const verified = [...mergedMetadata.values()];
for (const row of verified) for (const oldCode of row.previous_codes ?? []) if (oldCode !== row.code) mergedAway.add(oldCode);
const metadataByCode = new Map(verified.map(row => [row.code, row]));

/** Bỏ dấu tiếng Việt, hạ chữ thường; mọi ký tự không phải chữ/số thành một dấu cách */
export const foldVi = (text: string): string =>
  text.replace(/đ/g, 'd').replace(/Đ/g, 'D').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const entries: DirectoryEntry[] = rows.filter(row => !mergedAway.has(row[0])).map(([code, name, p, district, note]) => {
  const current = metadataByCode.get(code);
  return { code, name: current?.name || name, region: current?.region || district, city: current?.city || provinces[p], note,
    address: current?.address ?? null, website: current?.website ?? null, logo_url: current?.logo_url ?? null, source: current?.source ?? null,
    previous_codes: (directory.merged as string[][]).filter(m => m[2] === code).map(m => m[0]).concat(current?.previous_codes ?? []) };
});
const baseCodes = new Set(entries.map(e => e.code));
for (const item of verified) if (item.additional && !baseCodes.has(item.code)) entries.push({ ...item, note: null });
const byCode = new Map(entries.map((e) => [e.code, e]));
for (const entry of entries) for (const oldCode of entry.previous_codes ?? []) byCode.set(oldCode, entry);

export const directoryInfo = () => ({ version: metadata.version || directory.version, sources: [...directory.sources, extra.source], schools: entries.length, merged: mergedAway.size, excluded: extra.excluded.length, source_rows: extra.source_rows });
export const directoryEntry = (code: string): DirectoryEntry | null => byCode.get(code) ?? null;
/** Chỉ checksum của ảnh tham chiếu đã duyệt; bytes vẫn được tải riêng từ PostgreSQL. */
export const directoryLogoHash = (code: string): string | null => metadataByCode.get(byCode.get(code)?.code ?? code)?.logo_sha256 ?? null;

/** Tìm theo tên, mã, quận/huyện hoặc tỉnh/thành (không phân biệt dấu); tên bắt đầu bằng cụm tìm được xếp trước */
export function searchDirectory(query: string, limit = 12): DirectoryEntry[] {
  const q = foldVi(query);
  if (!q) return entries.slice(0, limit);
  const tokens = q.split(' ');
  const acronymOnly = tokens.every(token => token.length === 1);
  const compact = tokens.join('');
  const scored: Array<{ at: number; score: number }> = [];
  for (let i = 0; i < entries.length; i++) {
    const item = indexed[i];
    const initials = item.initials.some(value => value.startsWith(compact));
    const plain = !acronymOnly && tokens.every(t => item.full.includes(t));
    const code = entries[i].code.toLowerCase().startsWith(q);
    if (!initials && !plain && !code) continue;
    scored.push({ at: i, score: item.names.some(name => name.startsWith(q)) ? 0 : initials ? 1 : code ? 2 : 3 });
  }
  scored.sort((a, b) => a.score - b.score || entries[a.at].name.localeCompare(entries[b.at].name, 'vi') || entries[a.at].code.localeCompare(entries[b.at].code));
  return scored.slice(0, limit).map((s) => entries[s.at]);
}

// ---------------------------------------------------------------------- đường dẫn riêng của trường
const AREA_PREFIX = new Set(['quan', 'huyen', 'thi', 'xa', 'thanh', 'pho', 'tp', 'tran']);
/**
 * Cụm từ chỉ cấp học ở đầu tên; mỗi từ cho phép viết có dấu hoặc không dấu. So khớp trên chữ thường còn dấu, vì bỏ dấu sẽ làm
 * họ "Trương" trùng với "Trường" ("THCS Trương Công Định" phải giữ nguyên là truongcongdinh). Chỉ bỏ cụm đầy đủ để không mất tên riêng như "Trung Sơn".
 */
const phrase = (...words: string[]) => words.map((w) => w.split('|'));
const TYPE_WORDS = [
  phrase('trung', 'học|hoc', 'cơ|co', 'sở|so'), phrase('trung', 'học|hoc', 'phổ|pho', 'thông|thong'), phrase('tiểu|tieu', 'học|hoc'), phrase('trường|truong'),
  phrase('thcs'), phrase('th'), phrase('thpt'), phrase('ptdtbt'), phrase('ptdtnt'), phrase('ptdt'), phrase('ptcs'), phrase('thcscl'), phrase('và|va'),
];

/** Bỏ các từ chỉ cấp học ở đầu tên ("THCS", "Trường", "Tiểu học và THCS"…) rồi viết liền: "THCS Phú Mỹ" → "phumy" */
export function nameWords(name: string): string {
  const tokens = name.normalize('NFC').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  let i = 0;
  for (let moved = true; moved && i < tokens.length - 1;) {
    moved = false;
    for (const words of TYPE_WORDS) {
      if (i + words.length < tokens.length && words.every((alts, k) => alts.includes(tokens[i + k]))) { i += words.length; moved = true; break; }
    }
  }
  return foldVi(tokens.slice(i).join(' '));
}

export const nameSlug = (name: string): string => nameWords(name).replace(/ /g, '').slice(0, 40);
const indexed = entries.map(entry => {
  const aliases = (directory.merged as string[][]).filter(m => m[2] === entry.code).map(m => m[1]).concat(metadataByCode.get(entry.code)?.aliases ?? []);
  const names = [entry.name, ...aliases].map(nameWords);
  return { names, initials: names.map(name => name.split(' ').map(word => word[0]).join('')), full: foldVi(`${entry.name} ${aliases.join(' ')} ${entry.region} ${entry.city} ${entry.code} ${(entry.previous_codes ?? []).join(' ')}`) };
});

/** "Quận Bình Thạnh" → "binhthanh", "Huyện Củ Chi" → "cuchi", "Quận 7" → "7" */
export function areaSlug(region: string | null | undefined): string {
  const tokens = foldVi(region ?? '').split(' ').filter(Boolean);
  let i = 0;
  while (i < tokens.length - 1 && AREA_PREFIX.has(tokens[i])) i++;
  return tokens.slice(i).join('').slice(0, 30);
}

export const schoolSlug = (s: { school_code: string; name: string; region?: string | null }): string =>
  ['donga', s.school_code, nameSlug(s.name), areaSlug(s.region)].filter(Boolean).join('_');

/** Lấy mã trường từ đường dẫn; phần tên và khu vực chỉ để đọc cho dễ nên không dùng để tra cứu */
export function parseSchoolSlug(slug: string): { code: string } | null {
  const m = /^donga_(\d{4,8})(?:_[a-z0-9_]{0,80})?$/.exec(String(slug).trim().toLowerCase());
  return m ? { code: m[1] } : null;
}
