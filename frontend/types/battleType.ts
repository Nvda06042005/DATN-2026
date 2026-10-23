import type { ElementId, EnemyType, IntentId, PhaseDef } from '@/types/gameType';

export type TideState = 'len' | 'dung' | 'rut';

export interface FighterStatus {
  atkUp: number;
  atkUpTurns: number;
  defUp: number;
  defUpTurns: number;
  taunt: number;
  tauntDr: number;
  shield: number;
  evade: number;
  fear: boolean;
  stun: number;
  weaken: number;
  weakenTurns: number;
  defDown: number;
  ko: boolean;
  fled: boolean;
  captured: boolean;
  acted: boolean;
  exhausted: boolean;
}

export interface Fighter {
  uid: string;
  side: 'ally' | 'enemy';
  ref: string;
  name: string;
  element?: ElementId;
  etype?: EnemyType;
  boss: boolean;
  maxHp: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  stamina: number;
  st: FighterStatus;
  intents: IntentId[];
  fleeAt?: number;
  capture?: boolean;
  defeatText: string;
}

export interface BattleFx {
  uid: string;
  kind: 'hit' | 'heal' | 'act' | 'miss' | 'buff';
  amount?: number;
  seq: number;
}

export interface BattleState {
  phase: PhaseDef;
  round: number;
  allies: Fighter[];
  enemies: Fighter[];
  turn: 'ally' | 'enemy' | 'over';
  active: number;
  haoKhi: number;
  fearImmune: number;
  drain: number;
  supplyDestroyed: boolean;
  stratUsed: boolean;
  stratGood: boolean;
  tide: TideState | null;
  relic: string | null;
  relicUsed: boolean;
  answered: number;
  correct: number;
  log: Array<{ id: number; text: string; tone: 'ally' | 'enemy' | 'info' | 'good' | 'bad' }>;
  fx: BattleFx[];
  result: null | 'win' | 'lose';
  endText: string;
  xuong: number;
  ben: number;
}
