/** API game mô phỏng trận đánh bằng thẻ tướng (/api/war, Sprint 6 theo ver0.2): thẻ, đội hình, bản đồ hành quân, màn chơi, trận đánh; quản trị. */
import { apiRequest } from '@/api/client';
import type { SandtableDetail, SandtableListItem } from '@/types/sandtable';
import type { BattleLinkOptions, BattleView, CardDetail, Collection, Commander, DialogLogItem, FormationSlot, MarchListItem, MarchMap, MoveResult, StageIntro, StageItem, Truth, WarStatus } from '@/types/war';

const base = '/api/war';

// ---------------------------------------------------------------------- học sinh
export const sandtables = (token: string) => apiRequest<SandtableListItem[]>(`${base}/sandtables`, { token });
export const sandtable = (token: string, stageId: number) => apiRequest<SandtableDetail>(`${base}/sandtables/${stageId}`, { token });
export const classBattleLinks = (token: string, classId: number) => apiRequest<BattleLinkOptions>(`${base}/classes/${classId}/battle-links`, { token });
export const saveClassBattleLinks = (token: string, classId: number, links: BattleLinkOptions['links']) => apiRequest<BattleLinkOptions>(`${base}/classes/${classId}/battle-links`, { token, method: 'PUT', body: { links } });
export const warStatus = (token: string) => apiRequest<WarStatus>(`${base}/status`, { token });
export const warCards = (token: string) => apiRequest<Collection>(`${base}/cards`, { token });
export const warCard = (token: string, id: number) => apiRequest<CardDetail>(`${base}/cards/${id}`, { token });
export const upgradeCard = (token: string, id: number, kind: 'level' | 'star') => apiRequest<CardDetail>(`${base}/cards/${id}/upgrade`, { token, body: { kind } });
export const formations = (token: string) => apiRequest<{ slots: FormationSlot[] }>(`${base}/formations`, { token });
export const saveFormation = (token: string, slot: number, body: { name?: string; front: number[]; back: number[]; tactic_card_id: number | null }) => apiRequest<{ slots: FormationSlot[] }>(`${base}/formations/${slot}`, { token, method: 'PUT', body });
export const commanders = (token: string) => apiRequest<Commander[]>(`${base}/commanders`, { token });

export const marchList = (token: string) => apiRequest<MarchListItem[]>(`${base}/march`, { token });
export const marchMap = (token: string, campaignId: number) => apiRequest<MarchMap>(`${base}/march/${campaignId}`, { token });
export const marchMove = (token: string, pointId: number) => apiRequest<MoveResult>(`${base}/march/move`, { token, body: { point_id: pointId } });
export const marchAnswer = (token: string, pointId: number, answer: unknown) => apiRequest<{ correct: boolean; explanation: string | null; rewards: { gold: number; binh_thu: number } | null; done: boolean }>(`${base}/march/points/${pointId}/answer`, { token, body: { answer } });
export const marchLog = (token: string) => apiRequest<DialogLogItem[]>(`${base}/march/log`, { token });

export const warStages = (token: string) => apiRequest<{ war: WarStatus; stages: StageItem[] }>(`${base}/stages`, { token });
export const stageIntro = (token: string, id: number) => apiRequest<StageIntro>(`${base}/stages/${id}`, { token });
export const startStage = (token: string, id: number, body: { slot?: number; front?: number[]; back?: number[]; tactic_card_id?: number | null; restart?: boolean }) => apiRequest<BattleView>(`${base}/stages/${id}/start`, { token, body });
export const previewStage = (token: string, id: number) => apiRequest<BattleView>(`${base}/stages/${id}/preview`, { token, body: {} });
export const skipStage = (token: string, id: number) => apiRequest<{ skipped: boolean; rewards: { gold: number; binh_thu: number } }>(`${base}/stages/${id}/skip`, { token, body: {} });
export const stageTruth = (token: string, id: number) => apiRequest<Truth>(`${base}/stages/${id}/truth`, { token });
export const warBattle = (token: string, id: number) => apiRequest<BattleView>(`${base}/battles/${id}`, { token });
export const battleAct = (token: string, id: number, body: { type: string; slot?: string; target?: string; steps?: number }) => apiRequest<BattleView>(`${base}/battles/${id}/act`, { token, body });
export const battleAnswer = (token: string, id: number, answer: unknown) => apiRequest<{ result: { correct: boolean; in_time: boolean; explanation: string | null }; battle: BattleView }>(`${base}/battles/${id}/answer`, { token, body: { answer } });

// ---------------------------------------------------------------------- quản trị
export const adminCards = (token: string) => apiRequest<Array<{ id: number; code: string; name: string; rarity: string; kind: string; branch: string | null; is_active: boolean; base_stats: Record<string, number>; moves: number }>>(`${base}/admin/cards`, { token });
export const adminCard = (token: string, id: number) => apiRequest<Record<string, any>>(`${base}/admin/cards/${id}`, { token });
export const updateCardWar = (token: string, id: number, body: Record<string, unknown>) => apiRequest<Record<string, any>>(`${base}/admin/cards/${id}`, { token, method: 'PUT', body });
export const upsertMove = (token: string, id: number, slot: string, body: Record<string, unknown>) => apiRequest<Record<string, any>>(`${base}/admin/cards/${id}/moves/${slot}`, { token, method: 'PUT', body });
export const deleteMove = (token: string, id: number, slot: string) => apiRequest<Record<string, any>>(`${base}/admin/cards/${id}/moves/${slot}`, { token, method: 'DELETE' });

export const adminMaps = (token: string) => apiRequest<Array<{ id: number; campaign_id: number; title: string; status: string; campaign_title: string; points: number; players: number }>>(`${base}/admin/maps`, { token });
export const adminMap = (token: string, id: number) => apiRequest<Record<string, any>>(`${base}/admin/maps/${id}`, { token });
export const createMap = (token: string, body: Record<string, unknown>) => apiRequest<Record<string, any>>(`${base}/admin/maps`, { token, body });
export const updateMap = (token: string, id: number, body: Record<string, unknown>) => apiRequest<Record<string, any>>(`${base}/admin/maps/${id}`, { token, method: 'PUT', body });
export const saveLayout = (token: string, id: number, body: { points: unknown[]; edges: unknown[] }) => apiRequest<Record<string, any>>(`${base}/admin/maps/${id}/layout`, { token, method: 'PUT', body });
export const deleteMap = (token: string, id: number) => apiRequest<void>(`${base}/admin/maps/${id}`, { token, method: 'DELETE' });
export const mapStatus = (token: string, id: number, status: string) => apiRequest<Record<string, any>>(`${base}/admin/maps/${id}/status`, { token, body: { status } });
export const adminDialogs = (token: string) => apiRequest<Array<{ id: number; title: string; status: string; point_name: string | null; lines: number; sources: number }>>(`${base}/admin/dialogs`, { token });
export const adminDialog = (token: string, id: number) => apiRequest<Record<string, any>>(`${base}/admin/dialogs/${id}`, { token });
export const saveDialog = (token: string, id: number | null, body: Record<string, unknown>) => (id ? apiRequest<Record<string, any>>(`${base}/admin/dialogs/${id}`, { token, method: 'PUT', body }) : apiRequest<Record<string, any>>(`${base}/admin/dialogs`, { token, body }));
export const dialogStatus = (token: string, id: number, status: string) => apiRequest<Record<string, any>>(`${base}/admin/dialogs/${id}/status`, { token, body: { status } });
export const deleteDialog = (token: string, id: number) => apiRequest<void>(`${base}/admin/dialogs/${id}`, { token, method: 'DELETE' });

export const adminStages = (token: string) => apiRequest<Array<{ id: number; title: string; status: string; difficulty: number; battle_name: string; year: number; waves: number; players: number }>>(`${base}/admin/stages`, { token });
export const adminStage = (token: string, id: number) => apiRequest<Record<string, any>>(`${base}/admin/stages/${id}`, { token });
export const stageOptions = (token: string) => apiRequest<Array<{ id: number; name: string; year: number; status: string; has_stage: boolean }>>(`${base}/admin/options`, { token });
export const saveStage = (token: string, id: number | null, body: Record<string, unknown>) => (id ? apiRequest<Record<string, any>>(`${base}/admin/stages/${id}`, { token, method: 'PUT', body }) : apiRequest<Record<string, any>>(`${base}/admin/stages`, { token, body }));
export const stageStatus = (token: string, id: number, status: string) => apiRequest<Record<string, any>>(`${base}/admin/stages/${id}/status`, { token, body: { status } });
export const stageBalance = (token: string, id: number, body: Record<string, unknown>) => apiRequest<{ runs: number; win_rate: number; avg_turns: number; avg_stars: number; avg_ally_down: number; cards: string[]; level: number; stars: number }>(`${base}/admin/stages/${id}/balance`, { token, body });
export const deleteStage = (token: string, id: number) => apiRequest<void>(`${base}/admin/stages/${id}`, { token, method: 'DELETE' });

export const adminCommanders = (token: string) => apiRequest<Array<Record<string, any>>>(`${base}/admin/commanders`, { token });
export const saveCommander = (token: string, id: number | null, body: Record<string, unknown>) => (id ? apiRequest<Record<string, any>>(`${base}/admin/commanders/${id}`, { token, method: 'PUT', body }) : apiRequest<Record<string, any>>(`${base}/admin/commanders`, { token, body }));
export const deleteCommander = (token: string, id: number) => apiRequest<void>(`${base}/admin/commanders/${id}`, { token, method: 'DELETE' });
export const adminAssets = (token: string) => apiRequest<Array<{ id: number; kind: string; name: string; url: string; source: string; license: string; note: string | null }>>(`${base}/admin/assets`, { token });
export const addAsset = (token: string, body: Record<string, unknown>) => apiRequest<Record<string, any>>(`${base}/admin/assets`, { token, body });
export const deleteAsset = (token: string, id: number) => apiRequest<void>(`${base}/admin/assets/${id}`, { token, method: 'DELETE' });

export const schoolWar = (token: string, schoolId?: number) => apiRequest<{ war_enabled: boolean; war_grades: number[]; war_from: string | null; war_to: string | null; war_minutes: number | null }>(`${base}/school-war${schoolId ? `?school_id=${schoolId}` : ''}`, { token });
export const saveSchoolWar = (token: string, body: Record<string, unknown>, schoolId?: number) => apiRequest<Record<string, any>>(`${base}/school-war${schoolId ? `?school_id=${schoolId}` : ''}`, { token, method: 'PUT', body });
