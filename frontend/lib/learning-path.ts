/**
 * Logic thuần cho màn Hình trình học tập (tab Học) theo phong cách Duolingo:
 *  - Bảng màu động theo từng Cửa (Unit 1 ngọc, Unit 2 hồng mai, Unit 3 thủy, ...) đạt tương phản chữ trắng ≥ 4.5:1.
 *  - Phân loại trạng thái từng Phần (Hoàn thành / Đang học / Sắp tới / Đang chuẩn bị) và chọn Phần đang mở.
 *  - Tính sẵn tọa độ đường cong S-curve, vị trí minh họa linh vật ở hốc trống đối diện và vạch ngăn Cửa.
 */
import type { LearningPath, NodeDetail, PathGate, PathNode, PathPart } from '@/types/learning';

export type UnitTheme = {
  id: string;
  name: string;
  bg: string;
  edge: string;
  ring: string;
  lightBg: string;
  darkBg: string;
  textLight: string;
  textDark: string;
};

export const UNIT_THEMES: readonly UnitTheme[] = [
  { id: 'ngoc', name: 'Ngọc Lục Bảo', bg: '#0c8548', edge: '#075c31', ring: '#58cc02', lightBg: '#e7f8d6', darkBg: '#102a1d', textLight: '#0b6b3a', textDark: '#6ee7b7' },
  { id: 'hongMai', name: 'Hồng Mai', bg: '#b8328e', edge: '#821f63', ring: '#f472b6', lightBg: '#fdf2f8', darkBg: '#311229', textLight: '#9d174d', textDark: '#f9a8d4' },
  { id: 'thuy', name: 'Thiên Thanh', bg: '#0273b0', edge: '#02527d', ring: '#38bdf8', lightBg: '#e0f2fe', darkBg: '#0c2a3d', textLight: '#0369a1', textDark: '#7dd3fc' },
  { id: 'dong', name: 'Hổ Phách', bg: '#b35205', edge: '#803902', ring: '#fbbf24', lightBg: '#fef3c7', darkBg: '#332009', textLight: '#b45309', textDark: '#fcd34d' },
  { id: 'tuDang', name: 'Tử Đằng', bg: '#7c3aed', edge: '#5b21b6', ring: '#c084fc', lightBg: '#f3e8ff', darkBg: '#251540', textLight: '#6d28d9', textDark: '#d8b4fe' },
  { id: 'son', name: 'Chu Sa', bg: '#c82828', edge: '#8f1b1b', ring: '#f87171', lightBg: '#fee2e2', darkBg: '#381216', textLight: '#b91c1c', textDark: '#fca5a5' },
] as const;

export const unitTheme = (unitIndex: number): UnitTheme => UNIT_THEMES[Math.abs(unitIndex) % UNIT_THEMES.length];

export type MascotPoseMood = 'happy' | 'excited' | 'thinking' | 'love';
export type MascotPoseAccessory = 'conical' | 'helmet' | 'scholar' | 'crown';

export const BANNER_H = 74;
export const FIRST_GATE_PAD = 18;
export const DIVIDER_H = 68;
export const ROW_H = 122;
export const CIRCLE = 74;
export const CENTER_Y = 52;
export const MASCOT_SIZE = 96;
export const MASCOT_OFFSET_X = 132;
export const NEXT_SECTION_H = 132;

/** Đường uốn S-curve mượt giống Duolingo: xoay trái trước, rồi lượn sang phải */
export const WAVE = [0, -44, -68, -44, 0, 44, 68, 44] as const;

export type SectionStatus = 'completed' | 'active' | 'upcoming' | 'preparing';

export function resolveSelectedPartNo(path: LearningPath, currentSelection: number | null): number | null {
  if (currentSelection !== null) {
    const existing = path.parts.find((p) => p.no === currentSelection && p.journey !== null);
    if (existing) return existing.no;
  }
  if (path.current !== null) {
    const cur = path.parts.find((p) => p.no === path.current?.part_no && p.journey !== null);
    if (cur) return cur.no;
  }
  return path.parts.find((p) => p.journey !== null)?.no ?? null;
}

export function defaultFocusPartNo(path: LearningPath): number | null {
  if (path.current?.part_no) return path.current.part_no;
  const started = path.parts.find((p) => p.journey && p.totals.done < p.totals.nodes);
  return started?.no ?? path.parts.find((p) => p.journey)?.no ?? null;
}

export function classifySection(part: PathPart, focusPartNo: number | null): SectionStatus {
  if (!part.journey) return 'preparing';
  if (part.totals.nodes > 0 && part.totals.done >= part.totals.nodes) return 'completed';
  if (part.no === focusPartNo || part.totals.done > 0) return 'active';
  return 'upcoming';
}

export function sectionAccessory(partNo: number): MascotPoseAccessory {
  if (partNo === 1) return 'conical';
  if (partNo === 2) return 'helmet';
  return 'crown';
}

export function sectionSummary(part: PathPart): string {
  const custom = part.campaign.summary?.trim();
  if (custom) return custom;
  const gateSummary = part.gates.find((g) => g.summary?.trim())?.summary?.trim();
  if (gateSummary) return gateSummary;
  const gateTitles = part.gates.map((g) => g.title).filter(Boolean).slice(0, 2);
  if (gateTitles.length) return `Khám phá: ${gateTitles.join(' · ')}.`;
  return `Chinh phục hành trình ${part.campaign.title}.`;
}

export function sectionPercent(part: PathPart): number {
  if (!part.totals.nodes) return 0;
  return Math.round((part.totals.done / part.totals.nodes) * 100);
}

export type PathLayoutItem =
  | { type: 'divider'; part: PathPart; gate: PathGate; unitIndex: number; top: number; height: number; showRule: boolean }
  | { type: 'node'; part: PathPart; gate: PathGate; unitIndex: number; node: PathNode; top: number; x: number; first: boolean; last: boolean }
  | { type: 'mascot'; part: PathPart; gate: PathGate; unitIndex: number; top: number; offsetX: number; side: 'left' | 'right'; mood: MascotPoseMood; accessory: MascotPoseAccessory; title: string }
  | { type: 'next_section'; nextPart: PathPart; top: number; height: number };

const GATE_POSES: ReadonlyArray<{ mood: MascotPoseMood; accessory: MascotPoseAccessory }> = [
  { mood: 'happy', accessory: 'helmet' },
  { mood: 'excited', accessory: 'conical' },
  { mood: 'thinking', accessory: 'scholar' },
  { mood: 'love', accessory: 'crown' },
];

/**
 * Xếp toàn bộ các Cửa trong Phần đang chọn thành danh sách có tọa độ dọc cố định,
 * đồng thời đặt linh vật Rồng Con ở các hốc trống đối diện đường cong S-curve.
 */
export function layoutPartPath(part: PathPart, nextPart: PathPart | null): { items: PathLayoutItem[]; height: number } {
  const items: PathLayoutItem[] = [];
  let top = 12;
  let globalIndex = 0;

  part.gates.forEach((gate, gateIndex) => {
    const showRule = gateIndex > 0;
    const height = showRule ? DIVIDER_H : FIRST_GATE_PAD;
    items.push({ type: 'divider', part, gate, unitIndex: gateIndex, top, height, showRule });
    top += height;

    const gateNodeItems: Array<Extract<PathLayoutItem, { type: 'node' }>> = [];
    gate.nodes.forEach((node, idx) => {
      const x = WAVE[globalIndex % WAVE.length];
      const item: Extract<PathLayoutItem, { type: 'node' }> = {
        type: 'node',
        part,
        gate,
        unitIndex: gateIndex,
        node,
        top,
        x,
        first: idx === 0,
        last: idx === gate.nodes.length - 1,
      };
      items.push(item);
      gateNodeItems.push(item);
      top += ROW_H;
      globalIndex += 1;
    });

    if (gateNodeItems.length >= 3) {
      // Đặt linh vật ở mỗi đoạn ~4 nút, ngay bên phía đối diện với đỉnh cong lớn nhất của đoạn đó
      for (let start = 0; start < gateNodeItems.length; start += 4) {
        const slice = gateNodeItems.slice(start, Math.min(gateNodeItems.length, start + 4));
        if (slice.length < 2) continue;
        const anchor = slice.reduce((best, cur) => (Math.abs(cur.x) > Math.abs(best.x) ? cur : best), slice[0]);
        if (Math.abs(anchor.x) < 20) continue;
        const side: 'left' | 'right' = anchor.x > 0 ? 'left' : 'right';
        const pose = GATE_POSES[(gateIndex + Math.floor(start / 4) + part.no) % GATE_POSES.length];
        items.push({
          type: 'mascot',
          part,
          gate,
          unitIndex: gateIndex,
          top: anchor.top + Math.round((ROW_H - MASCOT_SIZE) / 2),
          offsetX: side === 'right' ? MASCOT_OFFSET_X : -MASCOT_OFFSET_X,
          side,
          mood: pose.mood,
          accessory: pose.accessory,
          title: `Tiểu Tướng đồng hành Cửa ${gate.no}`,
        });
      }
    }
  });

  if (nextPart && nextPart.journey) {
    top += 8;
    items.push({ type: 'next_section', nextPart, top, height: NEXT_SECTION_H });
    top += NEXT_SECTION_H + 36;
  } else {
    top += 72;
  }

  return { items, height: top };
}

export function activeGateItem(
  items: PathLayoutItem[],
  scrollY: number,
): Extract<PathLayoutItem, { type: 'divider' }> | null {
  const dividers = items.filter((it): it is Extract<PathLayoutItem, { type: 'divider' }> => it.type === 'divider');
  if (!dividers.length) return null;
  const passed = dividers.filter((d) => d.top <= scrollY + 24);
  return passed.length ? passed[passed.length - 1] : dividers[0];
}

export function scrollButtonDirection(
  targetTop: number | null,
  scrollY: number,
  viewportHeight: number,
): 'up' | 'down' | null {
  if (targetTop === null || viewportHeight <= 0) return null;
  const nodeCenter = targetTop + CENTER_Y;
  const viewTop = scrollY + 24;
  const viewBottom = scrollY + viewportHeight - 36;
  if (nodeCenter < viewTop) return 'up';
  if (nodeCenter > viewBottom) return 'down';
  return null;
}

export function nodeActionLabel(detail: NodeDetail): string {
  const done = detail.state === 'done';
  if (detail.state === 'locked') return 'Chưa mở khóa';
  if (detail.kind === 'lesson') return done ? 'Ôn tập bài học' : 'Bắt đầu học';
  if (detail.kind === 'listen') return done ? 'Nghe lại' : 'Nghe kể chuyện';
  if (detail.kind === 'chest') return done ? 'Rương đã mở' : 'Mở rương';
  if (detail.kind === 'practice') return 'Luyện tập';
  if (detail.kind === 'gate_test') return done ? 'Làm lại kiểm tra cửa' : 'Làm bài kiểm tra';
  if (detail.kind === 'battle' && detail.has_sim) return done ? 'Chơi lại mô phỏng' : 'Vào trận mô phỏng';
  if (detail.needs_quiz) return done ? 'Ôn tập câu hỏi' : 'Bắt đầu';
  if (detail.kind === 'battle') return 'Đọc hồ sơ trận đánh';
  return 'Đọc tư liệu';
}
