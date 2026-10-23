import React, { useState } from 'react';
import { Eye, Shield, Sparkles, Swords } from 'lucide-react';
import { EnemyBadge } from '@/components/customs/game/art/EnemyBadge';
import { HeroMedallion } from '@/components/customs/game/art/HeroMedallion';
import { GBtn } from '@/components/ui/button';
import { InfoNote } from '@/components/ui/info-note';
import { Sheet } from '@/components/ui/sheet';
import { ELEMENTS, ENEMY_TYPES } from '@/constants/game/elements';
import { ENEMIES } from '@/constants/game/enemies';
import { HEROES, HERO_BY_ID } from '@/constants/game/heroes';
import { MAP_PLACES } from '@/constants/game/places';
import { RELICS } from '@/constants/game/relics';
import { useGame } from '@/hooks/use-game';
import type { PhaseDef } from '@/types/gameType';

export const TeamPicker: React.FC<{ phase: PhaseDef; onStart: (team: string[]) => void; onClose: () => void }> = ({ phase, onStart, onClose }) => {
  const { state, update } = useGame();
  const owned = HEROES.filter((h) => state.heroes[h.id]);
  const recommended = phase.recommended.filter((id) => state.heroes[id]);
  const [team, setTeam] = useState<string[]>(() => {
    const t = [...recommended];
    for (const h of owned) if (t.length < 3 && !t.includes(h.id)) t.push(h.id);
    return t.slice(0, 3);
  });
  const toggle = (id: string) => setTeam((t) => (t.includes(id) ? t.filter((x) => x !== id) : t.length >= 3 ? t : [...t, id]));
  const cost = 5;
  const canStart = team.length === 3 && state.quan >= cost;
  return (
    <Sheet
      open
      onClose={onClose}
      title={`Xuất trận: ${phase.name}`}
      subtitle={`${phase.date} · ${MAP_PLACES[phase.place].name}`}
      wide
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <span className={`g-chip !text-sm ${state.quan >= cost ? 'bg-giay-2 text-muc' : 'bg-son-nhat text-son-chu'}`}>
            <Shield className="w-4 h-4" aria-hidden={true} /> Cần {cost} Quân Lực (có {state.quan})
          </span>
          <GBtn
            variant="son"
            size="lg"
            className="ml-auto"
            disabled={!canStart}
            onClick={() => {
              update((s) => ({ ...s, quan: s.quan - cost }));
              onStart(team);
            }}
          >
            <Swords className="w-5 h-5" aria-hidden={true} /> Bắt đầu trận
          </GBtn>
        </div>
      }
    >
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="space-y-3">
          <div className="g-inset p-4">
            <p className="font-display font-bold text-lg flex items-center gap-2">
              <Eye className="w-5 h-5 text-dong-chu" aria-hidden={true} /> Tình báo
            </p>
            <p className="mt-1 leading-relaxed">{phase.story}</p>
            <p className="mt-2 font-semibold">Mục tiêu: {phase.objective}</p>
          </div>
          <div>
            <p className="font-display font-bold mb-2">Quân địch</p>
            <ul className="grid gap-2">
              {phase.enemies.map((e, i) => {
                const d = ENEMIES[e.id];
                const t = ENEMY_TYPES[d.type];
                return (
                  <li key={i} className="g-card-flat p-2.5 flex items-center gap-3">
                    <EnemyBadge enemy={d} size={42} />
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-bold leading-tight">{d.name}</p>
                      <p className="text-xs text-muc-2">
                        {t.name} · bị khắc bởi {t.weak.map((w) => ELEMENTS[w].name).join(', ')}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
            <InfoNote className="mt-2">{ENEMY_TYPES[ENEMIES[phase.enemies[0].id].type].lesson}</InfoNote>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-display font-bold">Chọn 3 tướng ({team.length}/3)</p>
            {recommended.length > 0 && (
              <GBtn
                variant="ghost"
                size="sm"
                onClick={() => {
                  const t = [...recommended];
                  for (const h of owned) if (t.length < 3 && !t.includes(h.id)) t.push(h.id);
                  setTeam(t.slice(0, 3));
                }}
              >
                Đội hình gợi ý
              </GBtn>
            )}
          </div>
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {owned.map((h) => {
              const on = team.includes(h.id);
              const rec = phase.recommended.includes(h.id);
              return (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => toggle(h.id)}
                    aria-pressed={on}
                    className={`w-full rounded-2xl p-2 border-2 flex flex-col items-center gap-1 text-center ${on ? 'border-son bg-son-nhat' : 'border-vien bg-the'}`}
                  >
                    <HeroMedallion hero={h} stage={state.heroes[h.id]?.stage} size={48} />
                    <span className="font-display font-bold text-sm leading-tight">{h.name}</span>
                    {rec && <span className="g-chip bg-dong-nhat text-dong-chu !text-[10px]">Gợi ý</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          {phase.recommended.some((id) => !state.heroes[id]) && (
            <InfoNote>
              Đội hình gợi ý còn thiếu: {phase.recommended.filter((id) => !state.heroes[id]).map((id) => HERO_BY_ID[id].name).join(', ')}. Chiêu mộ ở Hội Quán Vạn Kiếp.
            </InfoNote>
          )}
          <div className="g-card-flat p-3 flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-dong-chu" aria-hidden={true} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold">Cổ vật mang theo</p>
              <p className="text-sm text-muc-2">{state.relic ? RELICS[state.relic].name : 'Chưa chọn (chọn trong Doanh Trại → Cổ vật)'}</p>
            </div>
            {state.relics.length > 0 && (
              <select
                className="input-duo !w-auto !min-h-[44px] !py-1"
                value={state.relic ?? ''}
                onChange={(e) => update((s) => ({ ...s, relic: e.target.value || null }))}
                aria-label="Chọn cổ vật mang theo"
              >
                <option value="">Không mang</option>
                {state.relics.map((r) => (
                  <option key={r} value={r}>
                    {RELICS[r].name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>
    </Sheet>
  );
};
