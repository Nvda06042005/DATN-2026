/** Kiểu dữ liệu trò chơi hóa (Sprint 5). Khớp với /api/game. */

export type Rarity = 'common' | 'rare' | 'legendary';
export const RARITY_TEXT: Record<Rarity, string> = { common: 'Thường', rare: 'Hiếm', legendary: 'Huyền thoại' };
export const LEAGUE_TIERS = ['Đồng', 'Bạc', 'Vàng', 'Kim cương'];

export interface CharacterClass {
  id: number; code: string; name: string; description: string | null; icon: string; color: string;
  stats: { hp?: number; attack?: number; wisdom?: number; support?: number }; skills: Array<{ code: string; name: string; description: string; cost: number }>;
}
export interface EquippedItem { id: number; name: string; icon: string; color: string }
export interface Hud {
  user: { id: number; name: string }; class: CharacterClass | null; has_character: boolean;
  appearance: { outfit: EquippedItem | null; weapon: EquippedItem | null; banner: EquippedItem | null };
  gold: number; binh_thu: number; xp: number; hints: number; pending_drops: number; unseen_celebrations: number;
  level: { level: number; title: string; xp: number; floor: number; next_xp: number | null; next_title: string | null; progress: number };
  hearts: { current: number; max: number; enabled: boolean; next_in_ms: number | null; regen_hours: number };
  streak: { current: number; longest: number; freezes: number; freeze_max: number; last_day: string | null; at_risk: boolean };
  daily: { day: string; xp: number; goal: number; reached: boolean; options: number[]; selected: number };
  league: { tier: number; name: string }; gift: { available: boolean };
  /** Điểm hành động hôm nay để dùng kỹ năng nhân vật và hiệu ứng đang chờ (Sprint 7, HK.HS.072) */
  ap?: { current: number; max: number }; buffs?: Record<string, number>;
}
export interface GameConfig {
  hearts: { enabled: boolean; max: number; regen_hours: number; per_practice_correct: number }; daily_goal_options: number[]; gift: { gold: number[]; freeze_on_day7: boolean };
  hint_max: number; streak_freeze_max: number; league_tiers: string[]; card_rates: Record<Rarity, number>; league: { group_size: number; promote: number; demote: number };
}

export interface ShopItem {
  id: number; code: string; kind: 'outfit' | 'weapon' | 'banner' | 'streak_freeze' | 'heart' | 'hint'; name: string; description: string | null; icon: string; color: string;
  price: number; min_level: number; owned: boolean; qty?: number; equipped: boolean; locked: boolean; free_unlock: boolean;
}
export interface Shop { gold: number; level: number; freezes: number; items: ShopItem[] }

export interface BadgeRule { type: string; value?: number; campaign_id?: number }
export interface BadgeItem { id: number; code: string; scope: 'system' | 'school'; name: string; description: string | null; icon: string; color: string; rule: BadgeRule | null; awarded_at: string | null; earned: boolean }
export interface CardAlbumItem { id: number; rarity: Rarity; rarity_label: string; image_url: string | null; copies: number | null; first_at: string | null; owned: boolean; name: string | null; min_level: number }
export interface CardDetail {
  id: number; name: string; rarity: Rarity; rarity_label: string; image_url: string | null; flavor_quote: string | null; copies: number | null; owned: boolean;
  figure: { id: number; name: string; honorific: string | null; birth_year: number | null; death_year: number | null; role_text: string | null; biography: string | null; famous_quote: string | null } | null;
}
export interface FlipResult { duplicate: boolean; gold: number; card: CardDetail }

export interface GameQuest { id: number; title: string; metric: string; target: number; progress: number; reward_xp: number; reward_gold: number; completed_at: string | null; period: 'daily' | 'weekly' }
export interface GameQuests { daily: GameQuest[]; weekly: GameQuest[]; resets: { daily: string; weekly: string } }
export interface GiftState { claimed_today: boolean; streak: number; today_day: number; days: Array<{ day: number; gold: number; freeze: boolean }> }
export interface GiftClaim { day: number; streak: number; gold: number; freeze: boolean; state: GiftState }
export interface StreakCalendar { current: number; longest: number; freezes: number; days: Array<{ day: string; xp: number; goal: number; reached: boolean; today: boolean }> }

export interface Celebration { id: number; kind: 'level_up' | 'badge' | 'card' | 'goal' | 'quest' | 'gift' | 'league' | 'contest'; payload: Record<string, any>; created_at: string }

export interface BoardEntry { rank: number; name: string; xp: number; me: boolean }
export interface Board { scope: string; period: string; label: string; entries: BoardEntry[]; me: { rank: number; xp: number } | null; size: number; disabled?: boolean; message?: string }
export interface LeagueView {
  week: string; ends_at: string; tier: number; tier_name: string; tiers: string[]; size: number; promote: number; demote: number; saved_tier: number;
  entries: Array<BoardEntry & { zone: 'promote' | 'demote' | 'stay' }>;
}
export interface StudentContest { id: number; title: string; description: string | null; starts_at: string; ends_at: string; rewards: Record<string, number>; settled_at: string | null; status: 'upcoming' | 'active' | 'ended'; my_xp: number; my_rank: number | null; participants: number }

export interface ClassGameSetting { id: number; name: string; grade: number | null; school_year: string; hearts_enabled: boolean; students: number }
export interface SchoolGameSettings { leaderboard_enabled: boolean; leaderboard_scope: 'grade' | 'school'; leaderboard_period: 'week' | 'month' }
export interface SchoolContest {
  id: number; title: string; description: string | null; starts_at: string; ends_at: string; rewards: Record<string, number>; badge_id: number | null; settled_at: string | null;
  status: 'upcoming' | 'active' | 'ended'; classes: Array<{ id: number; name: string }>;
}

export interface CatalogField { name: string; label: string; type: 'text' | 'textarea' | 'int' | 'bool' | 'enum' | 'color' | 'ref' | 'url'; required?: boolean; options?: Array<{ value: string; label: string }>; min?: number; max?: number; ref?: 'figure' | 'campaign'; createOnly?: boolean; hint?: string }
export interface CatalogSpec { entity: string; label: string; plural: string; pk: string; fields: CatalogField[]; summary: string[] }
export interface GameSettingsView { values: Record<string, any>; rules: Record<string, { label: string; min?: number; max?: number; int?: boolean; bool?: boolean; oneOf?: number[] }>; defaults: Record<string, any> }
