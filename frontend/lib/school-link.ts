/**
 * Đường dẫn riêng của trường (donga_<mã trường>_<tên>_<khu vực>, ví dụ donga_79765507_phumy_binhthanh) và huy hiệu tự tạo từ tên trường.
 * Máy chủ là nơi tạo đường dẫn; ở đây chỉ nhận dạng đường dẫn và dựng huy hiệu để trường chưa có logo vẫn có hình riêng.
 */
export const SCHOOL_SLUG = /^donga_\d{4,8}(?:_[a-z0-9_]{0,80})?$/;

export const isSchoolSlug = (value: unknown): value is string => typeof value === 'string' && SCHOOL_SLUG.test(value.toLowerCase());

/** Mã trường nằm ngay sau "donga_"; phần tên và khu vực chỉ để người đọc */
export const schoolCodeOfSlug = (slug: string): string | null => /^donga_(\d{4,8})/.exec(slug.toLowerCase())?.[1] ?? null;

/**
 * Cụm từ chỉ cấp học ở đầu tên; mỗi từ cho phép viết có dấu hoặc không dấu. So khớp trên chữ thường còn dấu vì bỏ dấu sẽ làm họ
 * "Trương" trùng với "Trường"; chỉ bỏ cụm đầy đủ để không mất tên riêng như "Trung Sơn".
 */
const phrase = (...words: string[]) => words.map((w) => w.split('|'));
const TYPE_WORDS = [
  phrase('trung', 'học|hoc', 'cơ|co', 'sở|so'), phrase('trung', 'học|hoc', 'phổ|pho', 'thông|thong'), phrase('tiểu|tieu', 'học|hoc'), phrase('trường|truong'),
  phrase('thcs'), phrase('th'), phrase('thpt'), phrase('ptdtbt'), phrase('ptdtnt'), phrase('ptdt'), phrase('ptcs'), phrase('thcscl'), phrase('và|va'),
];

/** Các từ của tên riêng (giữ nguyên dấu) sau khi bỏ các từ chỉ cấp học ở đầu: "THCS Phú Mỹ" → ["Phú", "Mỹ"] */
export function ownNameWords(name: string): string[] {
  const words = name.normalize('NFC').replace(/&/g, ' ').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const lower = words.map((w) => w.toLowerCase());
  let i = 0;
  for (let moved = true; moved && i < words.length - 1;) {
    moved = false;
    for (const phraseWords of TYPE_WORDS) {
      if (i + phraseWords.length < words.length && phraseWords.every((alts, k) => alts.includes(lower[i + k]))) { i += phraseWords.length; moved = true; break; }
    }
  }
  return words.slice(i);
}

/** Chữ trên huy hiệu: "Phú Mỹ" → "PM", "Trương Công Định" → "TĐ", một chữ → hai chữ cái đầu ("Colette" → "CO") */
export function schoolInitials(name: string): string {
  const words = ownNameWords(name);
  if (!words.length) return '?';
  const letters = words.length === 1 ? Array.from(words[0]).slice(0, 2).join('') : `${Array.from(words[0])[0]}${Array.from(words[words.length - 1])[0]}`;
  return letters.toLocaleUpperCase('vi');
}

/** Tám bộ màu huy hiệu; trường nào cũng luôn ra cùng một màu theo mã trường */
export const EMBLEM_COLORS = [
  { bg: '#8c1d1d', ring: '#e8b84a' }, { bg: '#1c4d5e', ring: '#f0c75e' }, { bg: '#3d2c6b', ring: '#e8b84a' }, { bg: '#2e5b3a', ring: '#f0c75e' },
  { bg: '#7a4813', ring: '#f3d27a' }, { bg: '#5a1f49', ring: '#e8b84a' }, { bg: '#1f3a72', ring: '#f0c75e' }, { bg: '#6a2b19', ring: '#f3d27a' },
] as const;

export function emblemColors(code: string): { bg: string; ring: string } {
  const digits = String(code).replace(/\D/g, '');
  const n = digits ? Number(digits.slice(-4)) : 0;
  return EMBLEM_COLORS[n % EMBLEM_COLORS.length];
}
