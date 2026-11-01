/** API trò chơi hóa (/api/game): nhân vật, cửa hàng, huy hiệu, thẻ, nhiệm vụ, quà, bảng xếp hạng, giải đấu; cấu hình và danh mục cho quản trị. */
import { apiRequest } from '@/api/client';
import type {
  Board, BadgeItem, CardAlbumItem, CardDetail, Celebration, CharacterClass, ClassGameSetting, CatalogSpec, FlipResult, GameConfig, GameQuests, GameSettingsView, GiftClaim, GiftState, Hud,
  LeagueView, SchoolContest, SchoolGameSettings, Shop, StreakCalendar, StudentContest,
} from '@/types/gamification';

type Query = Record<string, string | number | boolean | null | undefined>;
const qs = (query: Query = {}) => {
  const parts = Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
};

// ---------------------------------------------------------------------- học sinh
export const gameMe = (token: string) => apiRequest<Hud>('/api/game/me', { token });
export const gameConfig = (token: string) => apiRequest<GameConfig>('/api/game/config', { token });
export const gameClasses = (token: string) => apiRequest<CharacterClass[]>('/api/game/classes', { token });
export const chooseCharacter = (token: string, classId: number) => apiRequest<Hud>('/api/game/character', { token, body: { class_id: classId } });
export const setDailyGoal = (token: string, goal: number) => apiRequest<Hud>('/api/game/goal', { token, method: 'PUT', body: { goal } });
export const setAppearance = (token: string, body: { outfit_id?: number | null; weapon_id?: number | null; banner_id?: number | null }) => apiRequest<Hud['appearance']>('/api/game/appearance', { token, method: 'PUT', body });
export const gameShop = (token: string) => apiRequest<Shop>('/api/game/shop', { token });
export const buyItem = (token: string, id: number) => apiRequest<{ item: string; gold: number }>(`/api/game/shop/${id}/buy`, { token, body: {} });
export const gameBadges = (token: string) => apiRequest<BadgeItem[]>('/api/game/badges', { token });
export const gameCards = (token: string) => apiRequest<{ total: number; owned: number; cards: CardAlbumItem[] }>('/api/game/cards', { token });
export const cardDetail = (token: string, id: number) => apiRequest<CardDetail>(`/api/game/cards/${id}`, { token });
export const pendingDrops = (token: string) => apiRequest<Array<{ id: number; source: string; created_at: string }>>('/api/game/drops', { token });
export const flipDrop = (token: string, id: number) => apiRequest<FlipResult>(`/api/game/drops/${id}/flip`, { token, body: {} });
export const gameQuests = (token: string) => apiRequest<GameQuests>('/api/game/quests', { token });
export const giftState = (token: string) => apiRequest<GiftState>('/api/game/gift', { token });
export const claimGift = (token: string) => apiRequest<GiftClaim>('/api/game/gift/claim', { token, body: {} });
export const streakCalendar = (token: string) => apiRequest<StreakCalendar>('/api/game/streak', { token });
export const celebrations = (token: string) => apiRequest<Celebration[]>('/api/game/celebrations', { token });
export const ackCelebrations = (token: string, ids: number[]) => apiRequest<{ ok: boolean }>('/api/game/celebrations/ack', { token, body: { ids } });
export const leaderboard = (token: string, query: Query) => apiRequest<Board>(`/api/game/leaderboard${qs(query)}`, { token });
export const leagueView = (token: string) => apiRequest<LeagueView>('/api/game/league', { token });
export const studentContests = (token: string) => apiRequest<StudentContest[]>('/api/game/contests', { token });
export const contestBoard = (token: string, id: number) => apiRequest<{ entries: Array<{ rank: number; name: string; xp: number; me: boolean }> }>(`/api/game/contests/${id}/board`, { token });
export const requestHint = (token: string, attemptId: number) => apiRequest<{ removed: string[] }>(`/api/play/attempts/${attemptId}/hint`, { token, body: {} });

// ---------------------------------------------------------------------- giáo viên và quản trị viên trường
export const classGameSettings = (token: string) => apiRequest<ClassGameSetting[]>('/api/game/class-settings', { token });
export const setClassHearts = (token: string, classId: number, enabled: boolean) => apiRequest<{ class_id: number; hearts_enabled: boolean }>(`/api/game/class-settings/${classId}`, { token, method: 'PUT', body: { hearts_enabled: enabled } });
export const classStudents = (token: string, classId: number) => apiRequest<Array<{ id: number; full_name: string; user_code: string | null }>>(`/api/game/class-students/${classId}`, { token });
export const schoolBadges = (token: string) => apiRequest<Array<{ id: number; name: string; description: string | null; icon: string; color: string }>>('/api/game/school-badges', { token });
export const awardBadge = (token: string, badgeId: number, userIds: number[]) => apiRequest<{ badge: string; awarded: number; already: number }>(`/api/game/badges/${badgeId}/award`, { token, body: { user_ids: userIds } });
export const schoolGameSettings = (token: string, schoolId?: number) => apiRequest<SchoolGameSettings>(`/api/game/school-settings${qs({ school_id: schoolId })}`, { token });
export const updateSchoolGameSettings = (token: string, body: Partial<SchoolGameSettings>) => apiRequest<SchoolGameSettings>('/api/game/school-settings', { token, method: 'PUT', body });
export const adminContests = (token: string) => apiRequest<SchoolContest[]>('/api/game/admin/contests', { token });
export const createContest = (token: string, body: Record<string, unknown>) => apiRequest<SchoolContest>('/api/game/admin/contests', { token, body });
export const updateContest = (token: string, id: number, body: Record<string, unknown>) => apiRequest<SchoolContest>(`/api/game/admin/contests/${id}`, { token, method: 'PUT', body });
export const deleteContest = (token: string, id: number) => apiRequest<void>(`/api/game/admin/contests/${id}`, { token, method: 'DELETE' });

// ---------------------------------------------------------------------- quản trị: danh mục và cấu hình
export const adminSpecs = (token: string) => apiRequest<{ entities: CatalogSpec[]; badge_rules: Array<{ value: string; label: string }> }>('/api/game/admin/specs', { token });
export const adminList = (token: string, entity: string, q?: string) => apiRequest<Array<Record<string, any>>>(`/api/game/admin/${entity}${qs({ q })}`, { token });
export const adminCreate = (token: string, entity: string, body: Record<string, unknown>) => apiRequest<Record<string, any>>(`/api/game/admin/${entity}`, { token, body });
export const adminUpdate = (token: string, entity: string, id: number, body: Record<string, unknown>) => apiRequest<Record<string, any>>(`/api/game/admin/${entity}/${id}`, { token, method: 'PUT', body });
export const adminDelete = (token: string, entity: string, id: number) => apiRequest<void>(`/api/game/admin/${entity}/${id}`, { token, method: 'DELETE' });
export const adminSettings = (token: string) => apiRequest<GameSettingsView>('/api/game/admin/settings', { token });
export const updateAdminSettings = (token: string, body: Record<string, unknown>) => apiRequest<{ values: Record<string, any> }>('/api/game/admin/settings', { token, method: 'PUT', body });
