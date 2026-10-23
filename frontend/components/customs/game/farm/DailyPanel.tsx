import React from 'react';
import { Check, Gift } from 'lucide-react';
import { GBtn } from '@/components/ui/button';
import { Bar } from '@/components/ui/progress-bar';
import { storeCap, troopCap } from '@/constants/game/buildings';
import { useGame } from '@/hooks/use-game';
import { dailyTasksFor } from '@/store/game.store';
import type { DailyTaskDef } from '@/types/gameType';

export const DailyPanel: React.FC = () => {
  const { state, update, toast } = useGame();
  const tasks = dailyTasksFor(state.daily.day);
  const claim = (t: DailyTaskDef) => {
    update((s) => ({ ...s, luong: Math.min(storeCap(s.buildings.kho.level), s.luong + t.reward.luong), quan: Math.min(troopCap(s.buildings.trai.level), s.quan + t.reward.quan), daily: { ...s.daily, claimed: [...s.daily.claimed, t.id] } }));
    toast(`Nhận thưởng: +${t.reward.luong} Lương Thảo, +${t.reward.quan} Quân Lực`);
  };
  return (
    <section className="g-card p-4" aria-labelledby="daily-title">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 id="daily-title" className="font-display font-extrabold text-lg">
          Nhiệm vụ hôm nay
        </h3>
        <span className="g-chip bg-giay-2 text-muc-2">
          {state.daily.claimed.length}/{tasks.length} đã nhận
        </span>
      </div>
      <ul className="grid gap-2">
        {tasks.map((t) => {
          const value = Math.min(t.target, state.daily.progress[t.metric] ?? 0);
          const done = value >= t.target;
          const claimed = state.daily.claimed.includes(t.id);
          const Icon = t.Icon;
          return (
            <li key={t.id} className="flex items-center gap-3">
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${done ? 'bg-ngoc text-white' : 'bg-giay-2 text-muc-2'}`}>
                <Icon className="w-5 h-5" aria-hidden={true} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold leading-tight">{t.text}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Bar value={value} max={t.target} fill="bg-ngoc" className="flex-1 !h-2" label={t.text} />
                  <span className="text-xs font-bold text-muc-2 tabular">
                    {value}/{t.target}
                  </span>
                </div>
              </div>
              {claimed ? (
                <span className="g-chip bg-ngoc-nhat text-ngoc-chu">
                  <Check className="w-3.5 h-3.5" aria-hidden={true} /> Đã nhận
                </span>
              ) : (
                <GBtn variant="dong" size="sm" disabled={!done} onClick={() => claim(t)} aria-label={`Nhận thưởng: ${t.text}`}>
                  <Gift className="w-4 h-4" aria-hidden={true} /> Nhận
                </GBtn>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};
