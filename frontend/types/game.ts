/** Kiểu dữ liệu minh họa nhân vật và chiến dịch được trang chủ sử dụng. */
import type { ComponentType } from 'react';
export type IconType = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

export type ElementId = 'thuy' | 'moc' | 'tho' | 'hoa' | 'thong';

export type Tier = 'hiem' | 'su_thi' | 'huyen_thoai' | 'tiet_che';

export type Lore = 'chinh_su' | 'giai_thoai' | 'sang_tao' | 'dan_gian';

export type EnemyType = 'ky' | 'bo' | 'thuyen' | 'luong';

type SkillKind =
  | 'strike'
  | 'multi'
  | 'aoe'
  | 'buff_atk'
  | 'self_atk'
  | 'buff_def'
  | 'heal'
  | 'taunt'
  | 'shield'
  | 'fear_immune'
  | 'evade'
  | 'ambush'
  | 'cut_supply'
  | 'stakes'
  | 'debuff'
  | 'ship_hunter';

export interface SkillDef {
  name: string;
  desc: string;
  kind: SkillKind;
  power: number;
}

interface StageDef {
  name: string;
  years: string;
  desc: string;
  unit: string;
}

export interface HeroDef {
  id: string;
  name: string;
  title: string;
  element: ElementId;
  tier: Tier;
  role: string;
  lore: Lore;
  story: string;
  symbol: IconType;
  join: 'start' | 'story' | 'recipe';
  base: { hp: number; atk: number; def: number; spd: number };
  basic: SkillDef;
  strat: SkillDef;
  ult: SkillDef;
  stages: [StageDef, StageDef, StageDef];
}

export type IntentId = 'strike' | 'charge' | 'volley' | 'forage' | 'roar' | 'supply' | 'brace';

export interface EnemyDef {
  id: string;
  name: string;
  type: EnemyType;
  boss?: boolean;
  base: { hp: number; atk: number; def: number; spd: number };
  intents: IntentId[];
  note: string;
  defeatText: string;
  fleeAt?: number;
  capture?: boolean;
}

export type PlaceId =
  | 'lang_son'
  | 'noi_bang'
  | 'binh_le_nguyen'
  | 'thang_long'
  | 'dong_bo_dau'
  | 'binh_than'
  | 'van_kiep'
  | 'yen_tu'
  | 'bach_dang'
  | 'van_don'
  | 'chuong_duong'
  | 'ham_tu'
  | 'tay_ket'
  | 'thien_truong'
  | 'truong_yen'
  | 'thanh_hoa'
  | 'champa';

type PhaseEffect = 'retreat' | 'vuon_khong' | 'counter' | 'rear_guard' | 'chuong_duong' | 'van_kiep' | 'van_don' | 'bach_dang' | 'capture';

export type BattleBg = 'plain' | 'river' | 'sea';

export interface PhaseDef {
  id: string;
  campaign: 1 | 2 | 3;
  name: string;
  date: string;
  place: PlaceId;
  story: string;
  objective: string;
  enemies: Array<{ id: string; hp?: number; defeatText?: string; fleeAt?: number }>;
  units: string[];
  recommended: string[];
  rules: { retreatAfter?: number; tide?: boolean; startStamina?: number; winWhenExhausted?: boolean };
  strat: { name: string; desc: string; unit: string; hero?: string; effect: PhaseEffect; starHint: string };
  bg: BattleBg;
  reward: { luong: number; quan: number };
  history: string;
}
