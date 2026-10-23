import React from 'react';
import { Heart, Utensils } from 'lucide-react';
import { EnemyBadge } from '@/components/customs/game/art/EnemyBadge';
import { HeroMedallion } from '@/components/customs/game/art/HeroMedallion';
import { Bar } from '@/components/ui/progress-bar';
import { INTENT_INFO } from '@/constants/game/battle';
import { ENEMIES } from '@/constants/game/enemies';
import { HERO_BY_ID } from '@/constants/game/heroes';
import type { BattleFx, Fighter } from '@/types/battleType';

export const FighterCard: React.FC<{ f: Fighter; active?: boolean; targeted?: boolean; onTarget?: () => void; showIntents: number; fx: BattleFx[] }> = ({ f, active = false, targeted = false, onTarget, showIntents, fx }) => {
  const out = f.st.ko || f.st.fled || f.st.captured;
  const myFx = fx.filter((x) => x.uid === f.uid);
  const hit = myFx.find((x) => x.kind === 'hit');
  const heal = myFx.find((x) => x.kind === 'heal' || x.kind === 'buff');
  const actFx = myFx.find((x) => x.kind === 'act');
  const miss = myFx.find((x) => x.kind === 'miss');
  const def = f.side === 'enemy' ? ENEMIES[f.ref] : null;
  const hero = f.side === 'ally' ? HERO_BY_ID[f.ref] : null;
  const status: Array<{ key: string; text: string; tone: string }> = [];
  if (f.st.atkUp > 0) status.push({ key: 'atk', text: `Tấn công +${Math.round(f.st.atkUp * 100)}%`, tone: 'bg-son-nhat text-son-chu' });
  if (f.st.defUp > 0) status.push({ key: 'def', text: 'Phòng thủ tăng', tone: 'bg-thuy-nhat text-thuy-chu' });
  if (f.st.taunt > 0) status.push({ key: 'taunt', text: 'Khiêu khích', tone: 'bg-hoa-nhat text-hoa-chu' });
  if (f.st.shield > 0) status.push({ key: 'shield', text: `Khiên ${f.st.shield}`, tone: 'bg-ngoc-nhat text-ngoc-chu' });
  if (f.st.evade > 0) status.push({ key: 'evade', text: 'Né đòn', tone: 'bg-ngoc-nhat text-ngoc-chu' });
  if (f.st.fear) status.push({ key: 'fear', text: 'Hoảng sợ', tone: 'bg-thong-nhat text-thong-chu' });
  if (f.st.stun > 0) status.push({ key: 'stun', text: 'Bị chặn', tone: 'bg-dong-nhat text-dong-chu' });
  if (f.st.weaken > 0) status.push({ key: 'weak', text: 'Yếu thế', tone: 'bg-dong-nhat text-dong-chu' });
  if (f.st.exhausted) status.push({ key: 'tired', text: 'Kiệt sức', tone: 'bg-dong-nhat text-dong-chu' });
  const Wrapper: React.ElementType = onTarget && !out ? 'button' : 'div';
  return (
    <Wrapper
      {...(onTarget && !out ? { type: 'button', onClick: onTarget, 'aria-pressed': targeted, 'aria-label': `Chọn mục tiêu ${f.name}, binh lực ${f.hp}/${f.maxHp}` } : {})}
      className={`relative w-full rounded-2xl p-2 sm:p-2.5 text-left bg-the/95 border-2 transition ${
        out ? 'opacity-45 grayscale border-vien' : active ? 'border-dong shadow-[0_0_0_3px_var(--color-dong)]' : targeted ? 'border-son shadow-[0_0_0_3px_var(--color-son)]' : 'border-vien'
      } ${hit ? 'animate-hit' : ''} ${heal ? 'animate-heal' : ''} ${actFx ? (f.side === 'ally' ? 'animate-lunge-right' : 'animate-lunge-left') : ''}`}
      key={`${f.uid}-${hit?.seq ?? 0}-${actFx?.seq ?? 0}`}
    >
      {hit?.amount !== undefined && (
        <span className="absolute -top-3 right-2 font-display font-extrabold text-lg text-son-chu animate-float-up" aria-hidden="true">
          −{hit.amount}
        </span>
      )}
      {heal?.amount !== undefined && heal.amount > 0 && (
        <span className="absolute -top-3 left-2 font-display font-extrabold text-lg text-ngoc-chu animate-float-up" aria-hidden="true">
          +{heal.amount}
        </span>
      )}
      {miss && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 font-display font-extrabold text-sm text-thuy-chu animate-float-up" aria-hidden="true">
          Né!
        </span>
      )}
      {f.side === 'enemy' && !out && f.intents.length > 0 && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex gap-1 z-10">
          {f.intents.slice(0, showIntents).map((intent, i) => {
            const info = INTENT_INFO[intent];
            const Icon = info.Icon;
            return (
              <span
                key={i}
                title={`${i === 0 ? 'Lượt tới' : 'Lượt sau nữa'}: ${info.name} – ${info.desc}`}
                className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-bold border-2 ${i > 0 ? 'opacity-70' : ''} ${info.danger ? 'bg-son text-white border-son-dam' : 'bg-the text-muc border-vien'}`}
              >
                <Icon className="w-3.5 h-3.5" aria-hidden={true} />
                <span className="hidden min-[400px]:inline">{info.name}</span>
                <span className="sr-only">
                  {i === 0 ? 'Ý đồ lượt tới' : 'Ý đồ lượt sau'}: {info.name}
                </span>
              </span>
            );
          })}
        </div>
      )}
      <div className="flex flex-col items-center text-center gap-1">
        {hero ? <HeroMedallion hero={hero} size={44} /> : def ? <EnemyBadge enemy={def} size={44} /> : null}
        <p className="font-display font-bold text-[13px] sm:text-sm leading-tight line-clamp-2 min-h-[2.2em]">{f.name}</p>
      </div>
      <div className="mt-1 space-y-1">
        <div className="flex items-center gap-1">
          <Heart className={`w-3 h-3 shrink-0 ${f.side === 'ally' ? 'text-ngoc-chu' : 'text-son-chu'}`} aria-hidden={true} />
          <Bar value={f.hp} max={f.maxHp} fill={f.side === 'ally' ? 'bg-ngoc' : 'bg-son'} className="flex-1 !h-2" label={f.side === 'ally' ? `Khí lực ${f.name}` : `Binh lực ${f.name}`} />
        </div>
        <p className="text-[11px] font-bold text-muc-2 tabular text-center">
          {f.hp}/{f.maxHp}
        </p>
        {f.side === 'enemy' && (
          <div className="flex items-center gap-1" title="Sức bền (lương thực)">
            <Utensils className="w-3 h-3 text-dong-chu shrink-0" aria-hidden={true} />
            <Bar value={f.stamina} max={100} fill="bg-dong" className="flex-1 !h-1.5" label={`Sức bền ${f.name}`} />
          </div>
        )}
      </div>
      {out && (
        <span className="absolute inset-x-1 bottom-1 g-chip justify-center bg-giay-2 text-muc-2 !text-[11px]">
          {f.st.captured ? 'Bị bắt sống' : f.st.fled ? 'Tháo chạy' : f.side === 'ally' ? 'Lui về hậu tuyến' : 'Bị đánh tan'}
        </span>
      )}
      {!out && status.length > 0 && (
        <div className="flex flex-wrap justify-center gap-0.5 mt-1">
          {status.slice(0, 2).map((s) => (
            <span key={s.key} className={`g-chip !text-[10px] !px-1.5 !py-0 ${s.tone}`}>
              {s.text}
            </span>
          ))}
        </div>
      )}
    </Wrapper>
  );
};
