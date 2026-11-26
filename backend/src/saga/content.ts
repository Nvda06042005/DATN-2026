/**
 * Nội dung một chặng của Hành trình Đông A (cột hk_saga_stages.content): mục tiêu học, 3–5 thẻ kiến thức ngắn, nguồn tham khảo, cảnh khám phá,
 * kịch bản trận đánh (nếu chặng có chiến đấu) và phần tổng kết lịch sử đã kiểm chứng. Hàm thuần: kiểm tra cấu trúc khi lưu, tạo phần gửi cho học sinh.
 * Lời thoại, nhân vật phụ và mọi chỉ số trong trò chơi là phần sáng tạo để phục vụ việc học; dữ kiện lịch sử nằm ở thẻ kiến thức và phần tổng kết, kèm nguồn.
 */
import { BadRequestException } from '@nestjs/common';
import { BdScenario, normalizeBachDang } from './bachdang';
import { CouncilScenario, normalizeCouncil } from './council';
import { ExploreScript, normalizeExplore } from './explore';
import { normalizeTactics, TacticsScenario } from './tactics';

export interface StageObjective { id: string; text: string }
export interface StageSource { key: string; title: string; publisher: string; url: string | null; note: string | null }
export const CARD_KINDS = ['who', 'where', 'when', 'why', 'how'] as const;
export type CardKind = (typeof CARD_KINDS)[number];
export const CARD_KIND_LABEL: Record<CardKind, string> = { who: 'Nhân vật', where: 'Địa điểm', when: 'Mốc thời gian', why: 'Nguyên nhân – kết quả', how: 'Diễn biến' };
export interface StageCard { id: string; kind: CardKind; title: string; body: string; facts: Array<{ label: string; value: string }>; objective: string; source: string; art: string | null }
export interface StageDebrief { title: string; paragraphs: string[]; sources: string[]; fiction: string }
export type BattleScenario = TacticsScenario | BdScenario | CouncilScenario;
/** Lời dẫn của màn Quân lệnh (25/11/2026): ai giao nhiệm vụ và nội dung; là lời dẫn của trò chơi, không phải trích dẫn lịch sử */
export interface StageOrder { by: string; text: string }
export interface StageContent {
  objectives: StageObjective[]; cards: StageCard[]; sources: StageSource[];
  /** Cảnh nhập vai 2D cũ (đã bỏ khỏi giao diện 21/11/2026, dữ liệu giữ nguyên); chặng mới từ 25/11/2026 không có */
  explore: ExploreScript | null; battle: BattleScenario | null; debrief: StageDebrief;
  order?: StageOrder | null;
  /** Nhiệm vụ thế giới khối thay cảnh nhập vai 2D (21/11/2026); kiểm tra cùng bản đồ khối bằng normalizeWorldQuest (world.ts) */
  world?: unknown;
}

const bad = (m: string): never => { throw new BadRequestException(m); };
const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);
const KEY = /^[a-z0-9-]{1,30}$/;
const text = (v: unknown, label: string, max: number): string => {
  if (typeof v !== 'string' || !v.trim()) return bad(`${label} không được để trống`);
  return v.trim().length > max ? bad(`${label} tối đa ${max} ký tự`) : v.trim();
};
const list = (v: unknown, label: string, min: number, max: number): any[] => (Array.isArray(v) && v.length >= min && v.length <= max ? v : bad(`${label}: cần từ ${min} đến ${max} mục`));
const unique = (keys: string[], label: string): void => { if (new Set(keys).size !== keys.length) bad(`${label}: mã bị trùng`); };

/** Kiểm tra và chuẩn hóa toàn bộ nội dung một chặng; ném 400 kèm thông báo tiếng Việt khi sai cấu trúc */
export function normalizeStage(raw: unknown): StageContent {
  if (!isObj(raw)) return bad('Nội dung chặng không hợp lệ');
  const objectives: StageObjective[] = list(raw.objectives, 'Mục tiêu học', 2, 4).map((o, i) => ({ id: KEY.test(String(o?.id)) ? String(o.id) : bad(`Mục tiêu ${i + 1}: mã không hợp lệ`), text: text(o?.text, `Mục tiêu ${i + 1}`, 200) }));
  unique(objectives.map((o) => o.id), 'Mục tiêu học');
  const sources: StageSource[] = list(raw.sources, 'Nguồn tham khảo', 1, 6).map((s, i) => {
    const url = s?.url ? text(s.url, `Nguồn ${i + 1}: liên kết`, 500) : null;
    if (url && !/^https:\/\//.test(url)) bad(`Nguồn ${i + 1}: liên kết phải bắt đầu bằng https://`);
    return { key: KEY.test(String(s?.key)) ? String(s.key) : bad(`Nguồn ${i + 1}: mã không hợp lệ`), title: text(s?.title, `Nguồn ${i + 1}: tên tài liệu`, 200), publisher: text(s?.publisher, `Nguồn ${i + 1}: tác giả / cơ quan`, 160), url, note: s?.note ? text(s.note, `Nguồn ${i + 1}: ghi chú`, 300) : null };
  });
  unique(sources.map((s) => s.key), 'Nguồn tham khảo');
  const hasObjective = (id: unknown, label: string): string => (objectives.some((o) => o.id === id) ? String(id) : bad(`${label}: mục tiêu "${id}" không có trong chặng`));
  const hasSource = (key: unknown, label: string): string => (sources.some((s) => s.key === key) ? String(key) : bad(`${label}: nguồn "${key}" không có trong chặng`));
  const cards: StageCard[] = list(raw.cards, 'Thẻ kiến thức', 3, 5).map((c, i) => ({
    id: KEY.test(String(c?.id)) ? String(c.id) : `c${i + 1}`, kind: (CARD_KINDS as readonly string[]).includes(c?.kind) ? (c.kind as CardKind) : bad(`Thẻ ${i + 1}: loại thẻ không hợp lệ`),
    title: text(c?.title, `Thẻ ${i + 1}: tiêu đề`, 80), body: text(c?.body, `Thẻ ${i + 1}: nội dung`, 520),
    facts: (Array.isArray(c?.facts) ? c.facts : []).slice(0, 4).map((f: any) => ({ label: text(f?.label, 'Nhãn dữ kiện', 30), value: text(f?.value, 'Dữ kiện', 80) })),
    objective: hasObjective(c?.objective, `Thẻ ${i + 1}`), source: hasSource(c?.source, `Thẻ ${i + 1}`), art: c?.art ? text(c.art, 'Hình minh họa', 30) : null,
  }));
  unique(cards.map((c) => c.id), 'Thẻ kiến thức');
  for (const o of objectives) if (!cards.some((c) => c.objective === o.id)) bad(`Mục tiêu "${o.text}" chưa có thẻ kiến thức nào`);
  // 25/11/2026 (vòng 5 bước Quân lệnh → Thám sử → Hội đồng → Xuất trận → Sử quan): cảnh khám phá không còn bắt buộc, trận đánh mở thẳng sau Hội đồng
  const explore = raw.explore ? normalizeExplore(raw.explore) : null;
  let battle: BattleScenario | null = null;
  if (raw.battle) {
    const mode = raw.battle.mode;
    battle = mode === 'bachdang' ? normalizeBachDang(raw.battle) : mode === 'tactics' ? normalizeTactics(raw.battle) : mode === 'council' ? normalizeCouncil(raw.battle) : bad('Kiểu trận đánh không hợp lệ');
  }
  if (!battle && explore?.steps.some((s) => s.type === 'battle')) bad('Cảnh khám phá có bước chạm trán nhưng chặng chưa có kịch bản trận đánh');
  const order: StageOrder | null = isObj(raw.order) ? { by: text(raw.order.by, 'Quân lệnh: người giao', 60), text: text(raw.order.text, 'Quân lệnh', 400) } : null;
  const d = isObj(raw.debrief) ? raw.debrief : bad('Thiếu phần tổng kết lịch sử');
  const debrief: StageDebrief = {
    title: text(d.title, 'Tổng kết: tiêu đề', 100), paragraphs: list(d.paragraphs, 'Tổng kết', 2, 6).map((p, i) => text(p, `Tổng kết: đoạn ${i + 1}`, 700)),
    sources: list(d.sources, 'Tổng kết: nguồn', 1, 6).map((k) => hasSource(k, 'Tổng kết')), fiction: text(d.fiction, 'Tổng kết: ghi chú phần sáng tạo', 400),
  };
  return { objectives, cards, sources, explore, battle, debrief, ...(order ? { order } : {}), ...(isObj(raw.world) ? { world: raw.world } : {}) };
}

/** Loại thẻ Binh thư (25/11/2026): thẻ kiến thức nhặt ở bước Thám sử xếp vào ba ngăn của bộ sưu tập Binh thư */
export const LORE_SHELF: Record<CardKind, 'nhan-vat' | 'ke-sach' | 'dia-danh'> = { who: 'nhan-vat', where: 'dia-danh', when: 'ke-sach', why: 'ke-sach', how: 'ke-sach' };
export const LORE_TAG: Record<CardKind, string> = { who: 'Nhân vật', where: 'Địa thế', when: 'Thời cơ', why: 'Thế trận', how: 'Kế sách' };

/** Bài học gửi cho học sinh: thẻ kiến thức kèm nguồn đầy đủ để bấm "Xem nguồn" */
export function lessonView(c: StageContent): Record<string, unknown> {
  const source = (key: string): StageSource | null => c.sources.find((s) => s.key === key) ?? null;
  return {
    objectives: c.objectives,
    cards: c.cards.map((card) => ({ ...card, kind_label: CARD_KIND_LABEL[card.kind], tag: LORE_TAG[card.kind], shelf: LORE_SHELF[card.kind], objective_text: c.objectives.find((o) => o.id === card.objective)?.text ?? null, source: source(card.source) })),
    sources: c.sources,
  };
}

/** Tổng kết sau chặng: diễn biến lịch sử đã kiểm chứng và ghi chú phần sáng tạo của trò chơi */
export function debriefView(c: StageContent): Record<string, unknown> {
  return { ...c.debrief, sources: c.debrief.sources.map((key) => c.sources.find((s) => s.key === key)!).filter(Boolean) };
}

/** Sao kiến thức theo phần trăm tốt nhất của phần luyện tập (tách khỏi sao của trận đánh) */
export function knowledgeStars(percent: number, passPercent: number): number {
  if (percent < passPercent) return 0;
  return percent >= 95 ? 3 : percent >= 85 ? 2 : 1;
}
