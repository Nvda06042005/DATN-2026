/** API mô phỏng trận đánh và mini-game (/api/battle): người chơi, chơi thử của giáo viên, và soạn kịch bản / tham số cho quản trị tổng. */
import { apiRequest } from '@/api/client';
import type {
  AdminMinigame, AdminScenario, AnyRun, BattleAnimation, BattleAnswer, BattleList, BattleOption, BattleRun, MiniKind, MiniRun, ScenarioIntro,
} from '@/types/battle';

export const battleList = (token: string) => apiRequest<BattleList>('/api/battle/list', { token });
export const scenarioIntro = (token: string, id: number) => apiRequest<ScenarioIntro>(`/api/battle/scenarios/${id}`, { token });
export const scenarioAnimation = (token: string, id: number) => apiRequest<BattleAnimation>(`/api/battle/scenarios/${id}/animation`, { token });
export const startScenario = (token: string, id: number, opts: { restart?: boolean; preview?: boolean } = {}) => apiRequest<BattleRun>(`/api/battle/scenarios/${id}/start`, { token, body: opts });
export const startMinigame = (token: string, id: number, opts: { restart?: boolean; preview?: boolean } = {}) => apiRequest<MiniRun>(`/api/battle/minigames/${id}/start`, { token, body: opts });
export const getRun = (token: string, id: number) => apiRequest<AnyRun>(`/api/battle/runs/${id}`, { token });
export const answerBattle = (token: string, id: number, body: Record<string, unknown>) => apiRequest<BattleAnswer>(`/api/battle/runs/${id}/answer`, { token, body });
export const answerMini = (token: string, id: number, body: Record<string, unknown>) => apiRequest<{ correct?: boolean; finished: boolean; run: MiniRun }>(`/api/battle/runs/${id}/answer`, { token, body });
export const finishRun = (token: string, id: number) => apiRequest<MiniRun>(`/api/battle/runs/${id}/finish`, { token, body: {} });

export const adminScenarios = (token: string) => apiRequest<AdminScenario[]>('/api/battle/admin/scenarios', { token });
export const adminScenario = (token: string, id: number) => apiRequest<AdminScenario>(`/api/battle/admin/scenarios/${id}`, { token });
export const battleOptions = (token: string) => apiRequest<BattleOption[]>('/api/battle/admin/battles', { token });
export const scenarioTemplate = (token: string) => apiRequest<unknown>('/api/battle/admin/scenario-template', { token });
export const validateScenario = (token: string, content: unknown) => apiRequest<{ ok: boolean; steps: number; max_score: number; has_animation: boolean }>('/api/battle/admin/scenarios/validate', { token, body: { content } });
export const createScenario = (token: string, body: Record<string, unknown>) => apiRequest<AdminScenario>('/api/battle/admin/scenarios', { token, body });
export const updateScenario = (token: string, id: number, body: Record<string, unknown>) => apiRequest<AdminScenario>(`/api/battle/admin/scenarios/${id}`, { token, method: 'PUT', body });
export const setScenarioStatus = (token: string, id: number, status: 'draft' | 'published') => apiRequest<AdminScenario>(`/api/battle/admin/scenarios/${id}/status`, { token, body: { status } });
export const deleteScenario = (token: string, id: number) => apiRequest<void>(`/api/battle/admin/scenarios/${id}`, { token, method: 'DELETE' });

export const adminMinigames = (token: string) => apiRequest<AdminMinigame[]>('/api/battle/admin/minigames', { token });
export const adminMinigame = (token: string, id: number) => apiRequest<AdminMinigame>(`/api/battle/admin/minigames/${id}`, { token });
export const validateMinigame = (token: string, kind: MiniKind, params: unknown) => apiRequest<{ ok: boolean; layout: { rows: number; cols: number; words: unknown[] } | null }>('/api/battle/admin/minigames/validate', { token, body: { kind, params } });
export const createMinigame = (token: string, body: Record<string, unknown>) => apiRequest<AdminMinigame>('/api/battle/admin/minigames', { token, body });
export const updateMinigame = (token: string, id: number, body: Record<string, unknown>) => apiRequest<AdminMinigame>(`/api/battle/admin/minigames/${id}`, { token, method: 'PUT', body });
export const setMinigameStatus = (token: string, id: number, status: 'draft' | 'published') => apiRequest<AdminMinigame>(`/api/battle/admin/minigames/${id}/status`, { token, body: { status } });
export const deleteMinigame = (token: string, id: number) => apiRequest<void>(`/api/battle/admin/minigames/${id}`, { token, method: 'DELETE' });
