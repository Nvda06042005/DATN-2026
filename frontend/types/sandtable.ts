/** Dữ liệu Sa bàn 3D của trận đánh (HK.HS.137, HK.GV.084). Khớp với backend/src/battle/sandtable.ts và /api/war/sandtables. */
export type Pt = [number, number];
export type SandMode = 'advance' | 'retreat' | 'hold';

export interface SandScene {
  note: string | null; size: Pt;
  hills: Array<{ x: number; y: number; r: number; h: number; name?: string }>;
  rivers: Array<{ name?: string; points: Pt[]; width: number }>;
  sea: Array<{ x: number; y: number; w: number; h: number }>;
  markers: Array<{ id: string; kind: 'city' | 'camp' | 'stakes' | 'fort' | 'dock'; label: string; x: number; y: number }>;
  armies: Array<{ id: string; side: 'tran' | 'nguyen'; label: string; kind: 'foot' | 'cavalry' | 'fleet'; start: Pt }>;
  steps: Array<{ label: string; text: string; moves: Array<{ army: string; to: Pt; mode: SandMode }> }>;
}

export interface SandtableListItem { id: number; title: string; battle_name: string; year: number | null; campaign_title: string | null; status: 'draft' | 'published'; steps: number }
export interface SandtableDetail {
  stage: { id: number; title: string; summary: string | null; objective: string | null; status: string; battle_name: string; year: number | null; date_text: string | null };
  sandtable: SandScene;
}

/** Vị trí các đội quân sau `step` bước (step = -1 là lúc xuất phát) */
export function positionsAt(scene: SandScene, step: number): Record<string, { pos: Pt; mode: SandMode }> {
  const out: Record<string, { pos: Pt; mode: SandMode }> = {};
  for (const a of scene.armies) out[a.id] = { pos: a.start, mode: 'hold' };
  for (let i = 0; i <= step && i < scene.steps.length; i++) {
    for (const m of scene.steps[i].moves) {
      if (out[m.army]) out[m.army] = { pos: m.to, mode: m.mode };
    }
  }
  return out;
}

export const SIDE_TEXT = { tran: 'Quân Trần', nguyen: 'Quân Nguyên – Mông' } as const;
export const MODE_TEXT: Record<SandMode, string> = { advance: 'tiến quân', retreat: 'rút quân', hold: 'giữ vị trí' };
