/**
 * Năm học và hai học kỳ của trường: gợi ý ngày theo khung kế hoạch thời gian năm học của Bộ GD&ĐT, tính tuần, học kỳ đang diễn ra và lời khuyên cho quản trị viên.
 *
 * Căn cứ (đối chiếu Bộ GD&ĐT, UBND TP.HCM, Sở GD&ĐT, báo Thanh Niên, Dân trí):
 * - Quyết định 2308/QĐ-BGDĐT ngày 6/8/2026 (áp dụng từ năm học 2026-2027): khai giảng 5/9 hằng năm; đủ 35 tuần thực học, học kỳ I 18 tuần kết thúc trước 18/1,
 *   học kỳ II 17 tuần; hoàn thành chương trình và kết thúc năm học trước 31/5. Ngày nghỉ lễ, Tết theo Bộ luật Lao động và hướng dẫn hằng năm.
 * - Chủ tịch UBND tỉnh, thành phố quyết định lịch cụ thể cho địa phương. TP.HCM năm 2025-2026: khai giảng 5/9/2025, học kỳ 2 bắt đầu 19/1/2026 (thứ hai sau ngày 17/1).
 * Vì thế ngày ở đây chỉ là gợi ý để điền sẵn; trường vẫn sửa được theo kế hoạch của Sở và của trường.
 */

export const TERM_FRAMEWORK = {
  decision: 'Quyết định 2308/QĐ-BGDĐT (6/8/2026)',
  opening: '5/9',
  term1Weeks: 18,
  term2Weeks: 17,
  term1Deadline: '18/1',
  yearDeadline: '31/5',
  note: 'Gợi ý theo khung của Bộ GD&ĐT: khai giảng 5/9; học kỳ 1 (18 tuần thực học) kết thúc trước 18/1; học kỳ 2 (17 tuần) và năm học kết thúc trước 31/5. Sở GD&ĐT và UBND tỉnh quyết định lịch cụ thể và nghỉ Tết, nên hãy sửa lại cho đúng kế hoạch của trường.',
} as const;

export const TERM_KEYS = ['term1_starts_on', 'term1_ends_on', 'term2_starts_on', 'term2_ends_on'] as const;
export type TermKey = (typeof TERM_KEYS)[number];

export interface YearDates {
  starts_on: string;
  ends_on: string;
  term1_starts_on: string | null;
  term1_ends_on: string | null;
  term2_starts_on: string | null;
  term2_ends_on: string | null;
}
export type SuggestedYear = { [K in keyof YearDates]: string };

const DAY = 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Ngày YYYY-MM-DD hợp lệ trên lịch (không có 30/02) */
export const isIsoDate = (value: string | null | undefined): value is string => {
  const m = ISO.exec(value ?? '');
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
};

const utc = (iso: string): number => { const m = ISO.exec(iso)!; return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])); };
const toIso = (ms: number): string => { const d = new Date(ms); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
export const addDays = (iso: string, days: number): string => toIso(utc(iso) + days * DAY);
/** 0 = Chủ nhật … 6 = Thứ bảy */
export const weekdayOf = (iso: string): number => new Date(utc(iso)).getUTCDay();
export const daysBetween = (from: string, to: string): number => Math.round((utc(to) - utc(from)) / DAY);

/** Số tuần theo lịch từ ngày đầu đến ngày cuối (tính cả hai đầu, làm tròn lên); tuần nghỉ lễ, Tết nằm trong số này nên số tuần thực học ít hơn */
export const calendarWeeks = (from: string, to: string): number => Math.ceil((daysBetween(from, to) + 1) / 7);

/** "2026-09-05" -> "05/09/2026" */
export const fmtDay = (iso: string | null | undefined): string => {
  const m = ISO.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
};

/** Ngày hôm nay theo giờ Việt Nam (UTC+7), dạng YYYY-MM-DD */
export const todayVn = (now: number = Date.now()): string => toIso(now + 7 * 3_600_000);

const LABEL = /^(\d{4})-(\d{4})$/;
export const isYearLabel = (label: string): boolean => { const m = LABEL.exec(label.trim()); return !!m && Number(m[2]) === Number(m[1]) + 1; };

/** Năm học chứa ngày hôm nay: từ tháng 8 trở đi là năm học vừa khai giảng, còn lại là năm học đang học dở ("2026-11-08" -> "2026-2027", "2027-03-01" -> "2026-2027") */
export const labelForDate = (iso: string): string => {
  const year = Number(iso.slice(0, 4)), month = Number(iso.slice(5, 7));
  return month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
};

export const nextLabel = (label: string): string => { const y = Number(label.slice(0, 4)); return `${y + 1}-${y + 2}`; };

/**
 * Gợi ý ngày cho một năm học theo khung của Bộ GD&ĐT: bắt đầu 5/9, kết thúc 31/5; học kỳ 1 kết thúc vào thứ bảy cuối cùng trước ngày 18/1 (tức không muộn hơn 17/1),
 * học kỳ 2 bắt đầu vào thứ hai kế tiếp (như TP.HCM năm 2025-2026: học kỳ 1 hết 17/1/2026, học kỳ 2 từ 19/1/2026) và kết thúc cùng năm học.
 * `bounds` giữ nguyên ngày bắt đầu, kết thúc năm học đang có khi chỉ gợi ý thêm học kỳ.
 */
export function suggestTerms(label: string, bounds?: { starts_on?: string | null; ends_on?: string | null }): SuggestedYear | null {
  if (!isYearLabel(label)) return null;
  const first = Number(label.trim().slice(0, 4));
  const starts_on = isIsoDate(bounds?.starts_on) ? bounds!.starts_on! : `${first}-09-05`;
  const ends_on = isIsoDate(bounds?.ends_on) ? bounds!.ends_on! : `${first + 1}-05-31`;
  const cap = `${first + 1}-01-17`;
  const term1_ends_on = addDays(cap, -((weekdayOf(cap) - 6 + 7) % 7));
  const term2_starts_on = addDays(term1_ends_on, 2);
  return { starts_on, ends_on, term1_starts_on: starts_on, term1_ends_on, term2_starts_on, term2_ends_on: ends_on };
}

export const hasTerms = (y: Pick<YearDates, TermKey>): boolean => TERM_KEYS.every((k) => !!y[k]);

export interface TermCheck { error: string | null; warnings: string[] }

/** Kiểm tra ngày năm học và học kỳ (cùng quy tắc với máy chủ); `warnings` là cảnh báo không chặn khi lệch khung của Bộ GD&ĐT */
export function checkTerms(v: { starts_on: string; ends_on: string } & Record<TermKey, string | null | undefined>): TermCheck {
  const warnings: string[] = [];
  const dates = [v.starts_on, v.ends_on, ...TERM_KEYS.map((k) => v[k])].filter((x) => x);
  const bad = dates.find((d) => !isIsoDate(d));
  if (bad) return { error: `Ngày “${bad}” không đúng dạng năm-tháng-ngày, ví dụ 2026-09-05`, warnings };
  if (!(v.starts_on < v.ends_on)) return { error: 'Ngày bắt đầu năm học phải trước ngày kết thúc', warnings };
  const given = TERM_KEYS.filter((k) => v[k]);
  if (!given.length) return { error: null, warnings };
  if (given.length !== TERM_KEYS.length) return { error: 'Hãy nhập đủ ngày bắt đầu và kết thúc của cả hai học kỳ, hoặc để trống cả bốn ô', warnings };
  const [a1, b1, a2, b2] = TERM_KEYS.map((k) => v[k] as string);
  if (a1 < v.starts_on) return { error: 'Học kỳ 1 phải bắt đầu từ ngày bắt đầu năm học trở đi', warnings };
  if (a1 > b1) return { error: 'Học kỳ 1 phải kết thúc sau ngày bắt đầu', warnings };
  if (b1 >= a2) return { error: 'Học kỳ 2 phải bắt đầu sau khi học kỳ 1 kết thúc', warnings };
  if (a2 > b2) return { error: 'Học kỳ 2 phải kết thúc sau ngày bắt đầu', warnings };
  if (b2 > v.ends_on) return { error: 'Học kỳ 2 phải kết thúc trước hoặc đúng ngày kết thúc năm học', warnings };
  const w1 = calendarWeeks(a1, b1), w2 = calendarWeeks(a2, b2);
  if (w1 < TERM_FRAMEWORK.term1Weeks) warnings.push(`Học kỳ 1 chỉ có ${w1} tuần theo lịch, khung của Bộ GD&ĐT cần ${TERM_FRAMEWORK.term1Weeks} tuần thực học.`);
  if (w2 < TERM_FRAMEWORK.term2Weeks) warnings.push(`Học kỳ 2 chỉ có ${w2} tuần theo lịch, khung của Bộ GD&ĐT cần ${TERM_FRAMEWORK.term2Weeks} tuần thực học.`);
  const year1 = Number(v.starts_on.slice(0, 4));
  if (b1 > `${year1 + 1}-01-17`) warnings.push(`Khung của Bộ GD&ĐT: học kỳ 1 kết thúc trước ngày ${TERM_FRAMEWORK.term1Deadline}.`);
  if (b2 > `${year1 + 1}-05-31`) warnings.push(`Khung của Bộ GD&ĐT: năm học kết thúc trước ngày ${TERM_FRAMEWORK.yearDeadline}.`);
  return { error: null, warnings };
}

export type Phase =
  | { kind: 'none' }
  | { kind: 'before'; daysUntil: number }
  | { kind: 'term'; term: 1 | 2; week: number; weeks: number; daysLeft: number }
  | { kind: 'break'; daysUntil: number }
  | { kind: 'after'; daysSince: number };

/** Năm học đang ở đâu so với hôm nay: chưa bắt đầu, học kỳ 1 hoặc 2 (tuần thứ mấy), giữa hai học kỳ, hoặc đã hết */
export function phaseOf(y: YearDates, today: string): Phase {
  if (!hasTerms(y)) return { kind: 'none' };
  const [a1, b1, a2, b2] = TERM_KEYS.map((k) => y[k] as string);
  if (today < a1) return { kind: 'before', daysUntil: daysBetween(today, a1) };
  if (today <= b1) return { kind: 'term', term: 1, week: Math.floor(daysBetween(a1, today) / 7) + 1, weeks: calendarWeeks(a1, b1), daysLeft: daysBetween(today, b1) };
  if (today < a2) return { kind: 'break', daysUntil: daysBetween(today, a2) };
  if (today <= b2) return { kind: 'term', term: 2, week: Math.floor(daysBetween(a2, today) / 7) + 1, weeks: calendarWeeks(a2, b2), daysLeft: daysBetween(today, b2) };
  return { kind: 'after', daysSince: daysBetween(b2, today) };
}

/** Dòng chữ ngắn cho trạng thái theo thời gian ("Đang học kỳ 1 · tuần 10/20"); null khi chưa đặt học kỳ */
export function phaseText(y: YearDates, today: string): string | null {
  const p = phaseOf(y, today);
  if (p.kind === 'none') return null;
  if (p.kind === 'before') return `Còn ${p.daysUntil} ngày đến học kỳ 1`;
  if (p.kind === 'break') return `Nghỉ giữa hai học kỳ · còn ${p.daysUntil} ngày`;
  if (p.kind === 'after') return 'Đã qua ngày kết thúc năm học';
  return `Đang học kỳ ${p.term} · tuần ${p.week}/${p.weeks}`;
}

export interface YearLike extends YearDates { id: number; label: string; status: 'planned' | 'active' | 'ended' }
export type Advice<Y extends YearLike = YearLike> =
  | { kind: 'end'; year: Y }
  | { kind: 'terms'; year: Y }
  | { kind: 'create'; label: string };

/**
 * Lời khuyên cho quản trị viên: năm học đang hoạt động đã qua ngày kết thúc thì nên kết thúc; năm học chưa có học kỳ thì đặt theo gợi ý;
 * chưa có năm học của thời điểm hiện tại thì tạo (kèm ngày gợi ý). Năm học đã kết thúc không còn sửa nên không khuyên.
 */
export function yearAdvice<Y extends YearLike>(years: Y[], today: string): Array<Advice<Y>> {
  const out: Array<Advice<Y>> = [];
  for (const y of years) if (y.status === 'active' && y.ends_on < today) out.push({ kind: 'end', year: y });
  for (const y of years) if (y.status !== 'ended' && !hasTerms(y)) out.push({ kind: 'terms', year: y });
  const label = labelForDate(today);
  if (!years.some((y) => y.label === label)) out.push({ kind: 'create', label });
  return out;
}
