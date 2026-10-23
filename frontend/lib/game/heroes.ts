import { CARDS, RECIPES } from '@/constants/game/recruit';
import type { HeroDef } from '@/types/gameType';

/** Chỉ số tướng theo giai đoạn tiến hóa và cấp Doanh Trại */
export const heroStats = (hero: HeroDef, stage: number, doanhLevel: number) => {
  const m = 1 + (stage - 1) * 0.2;
  const hpBonus = 1 + (Math.max(1, doanhLevel) - 1) * 0.06;
  return {
    hp: Math.round(hero.base.hp * m * hpBonus),
    atk: Math.round(hero.base.atk * m),
    def: Math.round(hero.base.def * m),
    spd: hero.base.spd + (stage - 1),
  };
};

export const EVOLVE_BATTLES = [0, 2, 4];

export const evolveCost = (stage: number) => ({ luong: 150 * stage, gems: 30 * stage });

export const heroJoinHint = (hero: HeroDef) => {
  if (hero.join === 'story') return 'Gia nhập khi hoàn thành Màn 1 (Hội nghị Bình Than)';
  const r = RECIPES.find((x) => x.hero === hero.id);
  return r ? `Chiêu mộ ở Hội Quán: ${CARDS[r.inputs[0]].name} + ${CARDS[r.inputs[1]].name}` : 'Có sẵn từ đầu';
};
