import React, { useState } from 'react';
import { ArrowUpCircle, Check, Crown, Heart, Lock, Shield, Sparkles, Swords, Zap } from 'lucide-react';
import { HeroMedallion } from '@/components/customs/game/art/HeroMedallion';
import { ElementChip, LoreChip, TierChip } from '@/components/customs/game/GameChips';
import { QuizSheet } from '@/components/customs/game/QuizSheet';
import { GBtn } from '@/components/ui/button';
import { InfoNote } from '@/components/ui/info-note';
import { Bar } from '@/components/ui/progress-bar';
import { Sheet } from '@/components/ui/sheet';
import { ENEMY_TYPES } from '@/constants/game/elements';
import { HERO_BY_ID } from '@/constants/game/heroes';
import { useGame } from '@/hooks/use-game';
import { EVOLVE_BATTLES, evolveCost, heroJoinHint, heroStats } from '@/lib/game/heroes';
import type { EnemyType, IconType, SkillDef } from '@/types/gameType';
import { fmt } from '@/utils/format';

const StatRow: React.FC<{ Icon: IconType; label: string; value: number; max: number; fill: string }> = ({ Icon, label, value, max, fill }) => (
  <div className="flex items-center gap-2">
    <Icon className="w-4 h-4 text-muc-2 shrink-0" aria-hidden={true} />
    <span className="w-20 text-sm font-semibold text-muc-2">{label}</span>
    <Bar value={value} max={max} fill={fill} className="flex-1 !h-2.5" label={label} />
    <span className="w-10 text-right font-bold tabular">{value}</span>
  </div>
);

const SkillLine: React.FC<{ tag: string; skill: SkillDef; tone: string }> = ({ tag, skill, tone }) => (
  <li className="g-card-flat p-3">
    <div className="flex items-center gap-2">
      <span className={`g-chip ${tone}`}>{tag}</span>
      <p className="font-display font-bold">{skill.name}</p>
    </div>
    <p className="text-sm text-muc-2 mt-1">{skill.desc}</p>
  </li>
);

export const HeroSheet: React.FC<{ heroId: string | null; onClose: () => void }> = ({ heroId, onClose }) => {
  const { state, update, progress, spendGems, toast } = useGame();
  const [quiz, setQuiz] = useState(false);
  const hero = heroId ? HERO_BY_ID[heroId] : null;
  if (!hero) return null;
  const owned = state.heroes[hero.id];
  const stage = owned?.stage ?? 1;
  const stats = heroStats(hero, stage, state.buildings.doanh.level);
  const next = stage === 1 ? hero.stages[1] : stage === 2 ? hero.stages[2] : null;
  const cost = evolveCost(stage);
  const needBattles = EVOLVE_BATTLES[stage] ?? 99;
  const canEvolve = !!owned && !!next && owned.battles >= needBattles && state.luong >= cost.luong && progress.gems >= cost.gems;
  const counters = (Object.keys(ENEMY_TYPES) as EnemyType[]).filter((t) => ENEMY_TYPES[t].weak.includes(hero.element));

  const evolve = async () => {
    if (!next) return;
    if (!(await spendGems(cost.gems, `tien_hoa:${hero.id}:${stage + 1}`))) return;
    update((s) => ({
      ...s,
      luong: Math.max(0, s.luong - cost.luong),
      heroes: { ...s.heroes, [hero.id]: { ...s.heroes[hero.id], stage: (stage + 1) as 1 | 2 | 3 } },
    }));
    toast(`${hero.name} tiến hóa: ${next.name}`);
  };

  return (
    <>
      <Sheet open={!quiz} onClose={onClose} title={hero.name} subtitle={hero.title} wide icon={<HeroMedallion hero={hero} stage={stage} size={56} dim={!owned} />}>
        <div className="grid md:grid-cols-[1fr_1fr] gap-5">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              <ElementChip element={hero.element} />
              <TierChip tier={hero.tier} />
              <LoreChip lore={hero.lore} />
              <span className="g-chip bg-giay-2 text-muc-2">{hero.role}</span>
            </div>
            <p className="leading-relaxed">{hero.story}</p>
            <div className="g-card-flat p-4 space-y-2.5">
              <StatRow Icon={Heart} label="Khí lực" value={stats.hp} max={260} fill="bg-ngoc" />
              <StatRow Icon={Swords} label="Tấn công" value={stats.atk} max={45} fill="bg-son" />
              <StatRow Icon={Shield} label="Phòng thủ" value={stats.def} max={22} fill="bg-thuy" />
              <StatRow Icon={Zap} label="Tốc độ" value={stats.spd} max={20} fill="bg-dong" />
            </div>
            {counters.length > 0 && (
              <InfoNote>
                Khắc chế {counters.map((t) => ENEMY_TYPES[t].name.toLowerCase()).join(', ')} (sát thương ×1,5). {ENEMY_TYPES[counters[0]].lesson}
              </InfoNote>
            )}
            <ul className="grid gap-2">
              <SkillLine tag="Đánh thường" skill={hero.basic} tone="bg-giay-2 text-muc-2" />
              <SkillLine tag="Kế sách · 1 câu hỏi" skill={hero.strat} tone="bg-dong-nhat text-dong-chu" />
              <SkillLine tag="Tuyệt chiêu · đầy Hào Khí" skill={hero.ult} tone="bg-son-nhat text-son-chu" />
            </ul>
          </div>
          <div className="space-y-4">
            <h3 className="font-display font-extrabold text-lg">Các giai đoạn cuộc đời</h3>
            <ol className="relative border-l-4 border-vien ml-3 space-y-4">
              {hero.stages.map((st, i) => {
                const reached = !!owned && stage >= i + 1;
                return (
                  <li key={st.name} className="pl-5 relative">
                    <span
                      className={`absolute -left-[14px] top-0.5 w-6 h-6 rounded-full border-4 border-giay flex items-center justify-center ${reached ? 'bg-dong' : 'bg-vien-2'}`}
                      aria-hidden="true"
                    >
                      {reached && <Check className="w-3 h-3 text-[#1c1917]" aria-hidden={true} />}
                    </span>
                    <p className="text-xs font-bold text-dong-chu">{st.years}</p>
                    <p className={`font-display font-bold ${reached ? 'text-muc' : 'text-muc-2'}`}>
                      Giai đoạn {i + 1}: {st.name}
                    </p>
                    <p className="text-sm text-muc-2">{st.desc}</p>
                  </li>
                );
              })}
            </ol>
            {!owned ? (
              <div className="g-inset p-4 flex items-start gap-3">
                <Lock className="w-5 h-5 text-muc-2 shrink-0 mt-0.5" aria-hidden={true} />
                <p className="text-sm font-semibold">{heroJoinHint(hero)}</p>
              </div>
            ) : next ? (
              <div className="g-inset p-4 space-y-3">
                <p className="font-display font-bold text-lg flex items-center gap-2">
                  <ArrowUpCircle className="w-5 h-5 text-dong-chu" aria-hidden={true} /> Tiến hóa: {next.name}
                </p>
                <ul className="text-sm space-y-1">
                  <li className={owned.battles >= needBattles ? 'text-ngoc-chu font-semibold' : 'text-muc-2'}>
                    • Đã ra trận {owned.battles}/{needBattles} lần
                  </li>
                  <li className={state.luong >= cost.luong ? 'text-ngoc-chu font-semibold' : 'text-muc-2'}>• {fmt(cost.luong)} Lương Thảo</li>
                  <li className={progress.gems >= cost.gems ? 'text-ngoc-chu font-semibold' : 'text-muc-2'}>• {cost.gems} Ấn Tín</li>
                  <li className="text-muc-2">• Trả lời đúng 2 câu về giai đoạn “{next.name}”</li>
                </ul>
                <GBtn variant="dong" size="lg" className="w-full" disabled={!canEvolve} onClick={() => setQuiz(true)}>
                  <Sparkles className="w-5 h-5" aria-hidden={true} /> Trả lời để tiến hóa
                </GBtn>
              </div>
            ) : (
              <div className="g-inset p-4 flex items-center gap-3">
                <Crown className="w-6 h-6 text-dong-chu" aria-hidden={true} />
                <p className="font-semibold">Đã đạt giai đoạn cao nhất.</p>
              </div>
            )}
          </div>
        </div>
      </Sheet>
      {next && (
        <QuizSheet
          open={quiz}
          onClose={() => setQuiz(false)}
          title={`Tiến hóa ${hero.name}`}
          subtitle={`Giai đoạn mới: ${next.name} (${next.years})`}
          request={{ units: [next.unit], count: 2 }}
          passMark={2}
          sessionKind="practice"
          finishLabel="Tiếp tục"
          onFinish={(sum) => {
            if (sum.passed) evolve();
            else toast('Cần trả lời đúng cả 2 câu để tiến hóa. Thử lại nhé!');
          }}
        />
      )}
    </>
  );
};
