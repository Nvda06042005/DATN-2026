/**
 * Cấu hình trò chơi hóa mặc định (HK.AD.054, HK.AD.066): điểm và vàng theo hoạt động, số tim và thời gian hồi, quy tắc chuỗi ngày, hệ số thưởng tốc độ,
 * tỉ lệ rơi thẻ, giải đấu tuần, quà hằng ngày. Giá trị lưu một dòng JSON trong `hk_settings`; khóa thiếu lấy từ mặc định ở đây.
 */
import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface GameSettings {
  hearts: { enabled: boolean; max: number; regen_hours: number; per_practice_correct: number };
  speed_bonus_ratio: number;
  practice_correct_xp: number;
  daily_goal: { default: 50 | 100 | 200; bonus_gold: number };
  gold: { node_first: number; battle_first: number; final_first: number; perfect_quiz: number; duplicate_card: number };
  streak: { freeze_max: number };
  cards: { rates: { common: number; rare: number; legendary: number } };
  hint_max: number;
  gift: { gold: number[]; freeze_on_day7: boolean };
  league: { group_size: number; promote: number; demote: number };
  leaderboard_cache_seconds: number;
}

export const GAME_DEFAULTS: GameSettings = {
  hearts: { enabled: true, max: 5, regen_hours: 4, per_practice_correct: 1 },
  speed_bonus_ratio: 0.5,
  practice_correct_xp: 10,
  daily_goal: { default: 50, bonus_gold: 5 },
  gold: { node_first: 10, battle_first: 20, final_first: 50, perfect_quiz: 5, duplicate_card: 5 },
  streak: { freeze_max: 2 },
  cards: { rates: { common: 70, rare: 25, legendary: 5 } },
  hint_max: 10,
  gift: { gold: [10, 15, 20, 25, 30, 40, 50], freeze_on_day7: true },
  league: { group_size: 30, promote: 10, demote: 5 },
  leaderboard_cache_seconds: 30,
};

export const DAILY_GOALS = [50, 100, 200] as const;
export const LEAGUE_TIERS = ['Đồng', 'Bạc', 'Vàng', 'Kim cương'] as const;

interface Rule { label: string; min?: number; max?: number; int?: boolean; bool?: boolean; oneOf?: number[] }
/** Quy tắc kiểm tra từng khóa cho phép sửa (đường dẫn dạng a.b.c) */
export const SETTING_RULES: Record<string, Rule> = {
  'hearts.enabled': { label: 'Bật cơ chế tim', bool: true },
  'hearts.max': { label: 'Số tim tối đa', int: true, min: 1, max: 10 },
  'hearts.regen_hours': { label: 'Số giờ hồi một tim', int: true, min: 1, max: 48 },
  'hearts.per_practice_correct': { label: 'Số tim hồi cho mỗi câu luyện tập đúng', int: true, min: 0, max: 5 },
  speed_bonus_ratio: { label: 'Hệ số thưởng tốc độ (tối đa so với điểm gốc của câu)', min: 0, max: 1 },
  practice_correct_xp: { label: 'Điểm cho mỗi câu luyện tập đúng', int: true, min: 0, max: 1000 },
  'daily_goal.default': { label: 'Mục tiêu hằng ngày mặc định (điểm)', oneOf: [...DAILY_GOALS] },
  'daily_goal.bonus_gold': { label: 'Vàng thưởng khi đạt mục tiêu ngày', int: true, min: 0, max: 1000 },
  'gold.node_first': { label: 'Vàng khi hoàn thành nút lần đầu', int: true, min: 0, max: 10000 },
  'gold.battle_first': { label: 'Vàng khi hoàn thành trận đánh lần đầu', int: true, min: 0, max: 10000 },
  'gold.final_first': { label: 'Vàng khi thắng trận Quyết chiến lần đầu', int: true, min: 0, max: 10000 },
  'gold.perfect_quiz': { label: 'Vàng khi đạt 100% một bài', int: true, min: 0, max: 10000 },
  'gold.duplicate_card': { label: 'Vàng khi lật trúng thẻ đã có', int: true, min: 0, max: 10000 },
  'streak.freeze_max': { label: 'Số vật phẩm đóng băng chuỗi tối đa', int: true, min: 0, max: 10 },
  'cards.rates.common': { label: 'Tỉ lệ rơi thẻ Thường', int: true, min: 0, max: 100 },
  'cards.rates.rare': { label: 'Tỉ lệ rơi thẻ Hiếm', int: true, min: 0, max: 100 },
  'cards.rates.legendary': { label: 'Tỉ lệ rơi thẻ Huyền thoại', int: true, min: 0, max: 100 },
  hint_max: { label: 'Số gợi ý 50/50 tối đa được giữ', int: true, min: 0, max: 99 },
  'gift.freeze_on_day7': { label: 'Ngày thứ 7 tặng thêm một đóng băng chuỗi', bool: true },
  'league.group_size': { label: 'Số người mỗi nhóm giải đấu', int: true, min: 5, max: 100 },
  'league.promote': { label: 'Số người đứng đầu được thăng hạng', int: true, min: 1, max: 50 },
  'league.demote': { label: 'Số người cuối bảng bị giáng hạng', int: true, min: 0, max: 50 },
  leaderboard_cache_seconds: { label: 'Thời gian lưu bảng xếp hạng trong bộ nhớ (giây)', int: true, min: 0, max: 600 },
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function flatten(obj: Record<string, unknown>, prefix = ''): Array<[string, unknown]> {
  return Object.entries(obj).flatMap(([k, v]) => (isObj(v) ? flatten(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v] as [string, unknown]]));
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

function setPath(target: Record<string, any>, path: string, value: unknown): void {
  const keys = path.split('.');
  let cur = target;
  for (const k of keys.slice(0, -1)) cur = cur[k];
  cur[keys[keys.length - 1]] = value;
}

/** Gộp một bản vá vào cấu hình hiện có, kiểm tra từng khóa; ném BadRequest tiếng Việt khi sai */
export function applySettingsPatch(base: GameSettings, patch: unknown): GameSettings {
  if (!isObj(patch)) throw new BadRequestException('Cấu hình không hợp lệ');
  const next = clone(base);
  for (const [path, value] of flatten(patch)) {
    if (path === 'gift.gold') continue;
    const rule = SETTING_RULES[path];
    if (!rule) throw new BadRequestException(`Khóa cấu hình "${path}" không được phép sửa`);
    const n = Number(value);
    if (rule.bool) {
      if (typeof value !== 'boolean') throw new BadRequestException(`${rule.label}: phải là bật hoặc tắt`);
    } else if (typeof value === 'boolean' || !Number.isFinite(n)) throw new BadRequestException(`${rule.label}: phải là số`);
    else if ((rule.int && !Number.isInteger(n)) || (rule.min !== undefined && n < rule.min) || (rule.max !== undefined && n > rule.max) || (rule.oneOf && !rule.oneOf.includes(n))) {
      throw new BadRequestException(`${rule.label}: ${rule.oneOf ? `chỉ nhận ${rule.oneOf.join(', ')}` : `từ ${rule.min} đến ${rule.max}${rule.int ? ' (số nguyên)' : ''}`}`);
    }
    setPath(next as unknown as Record<string, any>, path, rule.bool ? value : n);
  }
  const gift = isObj(patch) && isObj(patch.gift) ? patch.gift.gold : undefined;
  if (gift !== undefined) {
    if (!Array.isArray(gift) || gift.length !== 7 || !gift.every((g) => Number.isInteger(g) && g >= 0 && g <= 1000)) throw new BadRequestException('Quà hằng ngày: cần đúng 7 số nguyên từ 0 đến 1000 vàng');
    next.gift.gold = gift as number[];
  }
  const rates = next.cards.rates;
  if (rates.common + rates.rare + rates.legendary <= 0) throw new BadRequestException('Tổng tỉ lệ rơi thẻ phải lớn hơn 0');
  if (next.league.promote + next.league.demote > next.league.group_size) throw new BadRequestException('Số người thăng hạng và giáng hạng không được vượt quá số người mỗi nhóm');
  return next;
}

/** Đọc/ghi cấu hình; lưu bộ nhớ đệm ngắn để không truy vấn ở mọi thao tác */
@Injectable()
export class SettingsService {
  private cache: { at: number; value: GameSettings } | null = null;

  constructor(private readonly db: DatabaseService) {}

  async get(): Promise<GameSettings> {
    if (this.cache && Date.now() - this.cache.at < 10_000) return this.cache.value;
    const row = (await this.db.query<{ value: Record<string, unknown> }>("SELECT value FROM hk_settings WHERE key = 'game'"))[0];
    const value = row ? applySettingsPatch(clone(GAME_DEFAULTS), row.value) : clone(GAME_DEFAULTS);
    this.cache = { at: Date.now(), value };
    return value;
  }

  async update(userId: number, patch: unknown): Promise<GameSettings> {
    const next = applySettingsPatch(await this.get(), patch);
    await this.db.query(
      `INSERT INTO hk_settings (key, value, updated_by) VALUES ('game', $1, $2) ON CONFLICT (key) DO UPDATE SET value = $1, updated_by = $2, updated_at = now()`, [JSON.stringify(next), userId]);
    this.cache = { at: Date.now(), value: next };
    return next;
  }

  invalidate(): void {
    this.cache = null;
  }
}
