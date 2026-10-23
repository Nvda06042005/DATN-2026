import React, { useState } from 'react';
import { BookOpen, Check, ChevronRight, Clock, Gift, Hourglass, Plus, ScrollText, Stamp, Wheat } from 'lucide-react';
import { BuildingSprite } from '@/components/customs/game/art/BuildingSprite';
import { HeroMedallion } from '@/components/customs/game/art/HeroMedallion';
import { ElementChip, LoreChip, TierChip } from '@/components/customs/game/GameChips';
import { QuizSheet } from '@/components/customs/game/QuizSheet';
import { GBtn } from '@/components/ui/button';
import { InfoNote } from '@/components/ui/info-note';
import { Sheet } from '@/components/ui/sheet';
import { HERO_BY_ID } from '@/constants/game/heroes';
import { CARDS, RECIPES } from '@/constants/game/recruit';
import { useGame } from '@/hooks/use-game';
import { useNow } from '@/hooks/use-now';
import type { CardDef, RecipeDef } from '@/types/gameType';
import { fmtClock } from '@/utils/format';

const CardTile: React.FC<{ card: CardDef; count: number; onLearn?: () => void }> = ({ card, count, onLearn }) => {
  const Icon = card.Icon;
  return (
    <div className="g-card-flat p-3 flex items-center gap-3">
      <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${card.kind === 'su_kien' ? 'bg-dong-nhat text-dong-chu' : 'bg-ngoc-nhat text-ngoc-chu'}`}>
        <Icon className="w-6 h-6" aria-hidden={true} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-display font-bold leading-tight">{card.name}</p>
        <p className="text-xs text-muc-2 leading-snug">{card.how}</p>
      </div>
      <span className="font-display font-extrabold text-lg tabular" aria-label={`Đang có ${count} thẻ`}>
        ×{count}
      </span>
      {onLearn && (
        <GBtn variant="giay" size="sm" onClick={onLearn} aria-label={`Học để nhận thẻ ${card.name}`}>
          <BookOpen className="w-4 h-4" aria-hidden={true} /> Học
        </GBtn>
      )}
    </div>
  );
};

export const RecruitPanel: React.FC = () => {
  const { state, update, progress, spendGems, toast, sound } = useGame();
  const now = useNow(1000);
  const [learn, setLearn] = useState<CardDef | null>(null);
  const [opening, setOpening] = useState(false);
  const [welcome, setWelcome] = useState<string | null>(null);
  const hq = state.buildings.hoiquan.level;
  const waitFactor = 1 - (Math.max(1, hq) - 1) * 0.25;
  const active = state.recruit ? RECIPES.find((r) => r.id === state.recruit?.recipe) ?? null : null;
  const left = state.recruit ? Math.max(0, (state.recruit.endsAt - now) / 1000) : 0;

  const start = async (r: RecipeDef) => {
    if (state.recruit) return toast('Đang có một lệnh bài triệu tập. Hãy mở lệnh bài đó trước.');
    if (state.luong < r.luong) return toast('Chưa đủ Lương Thảo');
    if (!(await spendGems(r.gems, `chieu_mo:${r.hero}`))) return;
    update((s) => ({
      ...s,
      luong: s.luong - r.luong,
      cards: { ...s.cards, [r.inputs[0]]: (s.cards[r.inputs[0]] ?? 0) - 1, [r.inputs[1]]: (s.cards[r.inputs[1]] ?? 0) - 1 },
      recruit: { recipe: r.id, endsAt: Date.now() + Math.round(r.waitSec * waitFactor) * 1000 },
    }));
    toast(`Đã gửi lệnh bài triệu tập ${HERO_BY_ID[r.hero].name}`);
  };

  const join = (r: RecipeDef) => {
    update((s) => ({ ...s, recruit: null, heroes: { ...s.heroes, [r.hero]: { stage: 1, battles: 0 } } }));
    setWelcome(r.hero);
    sound('win');
  };

  const nhanLuc = Object.values(CARDS).filter((c) => c.kind === 'nhan_luc');
  const suKien = Object.values(CARDS).filter((c) => c.kind === 'su_kien');

  return (
    <div className="space-y-5">
      <div className="g-card p-4 flex items-start gap-3">
        <BuildingSprite id="hoiquan" level={Math.max(1, hq)} className="w-20 h-16 shrink-0" />
        <div>
          <p className="font-display font-extrabold text-lg">Hội Quán Vạn Kiếp</p>
          <p className="text-sm text-muc leading-relaxed">
            Đặt <strong>một thẻ Nhân lực</strong> với <strong>một thẻ Sự kiện</strong> để nhận lệnh bài triệu tập. Chờ lệnh bài rồi trả lời câu hỏi về sự kiện đó – tướng sẽ gia nhập.
            Mỗi công thức là một quan hệ nhân – quả trong lịch sử.
          </p>
        </div>
      </div>

      {active && (
        <div className="rounded-3xl border-2 border-dong bg-dong-nhat p-4 flex flex-wrap items-center gap-4" aria-live="polite">
          <span className="w-14 h-16 rounded-xl bg-son text-white flex items-center justify-center shadow-[0_4px_0_#7f1d1d]" aria-hidden="true">
            <ScrollText className="w-8 h-8" aria-hidden={true} />
          </span>
          <div className="flex-1 min-w-[180px]">
            <p className="font-display font-extrabold text-lg">Lệnh bài triệu tập: {HERO_BY_ID[active.hero].name}</p>
            {left > 0 ? (
              <p className="text-sm text-muc flex items-center gap-1.5">
                <Hourglass className="w-4 h-4" aria-hidden={true} /> Còn <span className="tabular font-bold">{fmtClock(left)}</span>
              </p>
            ) : (
              <p className="text-sm font-semibold text-ngoc-chu">Lệnh bài đã đến! Trả lời {active.questions} câu để tướng gia nhập.</p>
            )}
          </div>
          <GBtn variant="ngoc" disabled={left > 0} onClick={() => setOpening(true)}>
            <Gift className="w-5 h-5" aria-hidden={true} /> Mở lệnh bài
          </GBtn>
        </div>
      )}

      <section>
        <h3 className="font-display font-extrabold text-lg mb-2">Công thức chiêu mộ</h3>
        <ul className="grid md:grid-cols-2 gap-3">
          {RECIPES.map((r) => {
            const hero = HERO_BY_ID[r.hero];
            const owned = !!state.heroes[r.hero];
            const haveA = (state.cards[r.inputs[0]] ?? 0) > 0;
            const haveB = (state.cards[r.inputs[1]] ?? 0) > 0;
            const ok = !owned && haveA && haveB && state.luong >= r.luong && progress.gems >= r.gems && !state.recruit;
            return (
              <li key={r.id} className="g-card p-4 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {[r.inputs[0], r.inputs[1]].map((cid, i) => {
                    const c = CARDS[cid];
                    const have = i === 0 ? haveA : haveB;
                    const Icon = c.Icon;
                    return (
                      <React.Fragment key={cid}>
                        {i === 1 && (
                          <Plus className="w-4 h-4 text-muc-3" aria-label="cộng" />
                        )}
                        <span className={`g-chip !text-sm !py-1.5 border-2 ${have ? 'bg-the border-ngoc text-muc' : 'bg-giay-2 border-dashed border-vien-2 text-muc-2'}`}>
                          <Icon className="w-4 h-4" aria-hidden={true} /> {c.name}
                          {have ? <Check className="w-3.5 h-3.5 text-ngoc-chu" aria-label="đã có" /> : null}
                        </span>
                      </React.Fragment>
                    );
                  })}
                </div>
                <div className="flex items-center gap-3">
                  <HeroMedallion hero={hero} size={54} dim={!owned} />
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-extrabold leading-tight">{hero.name}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <TierChip tier={hero.tier} />
                      <LoreChip lore={hero.lore} />
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muc-2">{r.lesson}</p>
                {owned ? (
                  <span className="g-chip bg-ngoc-nhat text-ngoc-chu !text-sm">
                    <Check className="w-4 h-4" aria-hidden={true} /> Đã gia nhập
                  </span>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`g-chip !text-sm ${state.luong >= r.luong ? 'bg-giay-2 text-muc' : 'bg-son-nhat text-son-chu'}`}>
                      <Wheat className="w-4 h-4" aria-hidden={true} /> {r.luong}
                    </span>
                    <span className={`g-chip !text-sm ${progress.gems >= r.gems ? 'bg-giay-2 text-muc' : 'bg-son-nhat text-son-chu'}`}>
                      <Stamp className="w-4 h-4" aria-hidden={true} /> {r.gems}
                    </span>
                    <span className="g-chip !text-sm bg-giay-2 text-muc-2">
                      <Clock className="w-4 h-4" aria-hidden={true} /> {fmtClock(Math.round(r.waitSec * waitFactor))}
                    </span>
                    <GBtn variant="son" size="sm" className="ml-auto" disabled={!ok} onClick={() => start(r)}>
                      Triệu tập <ChevronRight className="w-4 h-4" aria-hidden={true} />
                    </GBtn>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <div>
          <h3 className="font-display font-extrabold text-lg mb-2">Thẻ Nhân lực</h3>
          <div className="grid gap-2">
            {nhanLuc.map((c) => (
              <CardTile key={c.id} card={c} count={state.cards[c.id] ?? 0} />
            ))}
          </div>
        </div>
        <div>
          <h3 className="font-display font-extrabold text-lg mb-2">Thẻ Sự kiện – Văn kiện</h3>
          <div className="grid gap-2">
            {suKien.map((c) => (
              <CardTile key={c.id} card={c} count={state.cards[c.id] ?? 0} onLearn={() => setLearn(c)} />
            ))}
          </div>
          <InfoNote className="mt-2">Thẻ Sự kiện có được khi em trả lời đúng ít nhất 2/3 câu về chủ đề đó.</InfoNote>
        </div>
      </section>

      {learn && (
        <QuizSheet
          open
          onClose={() => setLearn(null)}
          title={`Thẻ: ${learn.name}`}
          subtitle={learn.desc}
          request={{ units: [learn.unit ?? 'ALL_3_WARS_SUMMARY'], count: 3 }}
          passMark={2}
          sessionKind="practice"
          finishLabel="Nhận thẻ"
          onFinish={(sum) => {
            if (!sum.passed) return toast('Cần đúng ít nhất 2/3 câu để nhận thẻ. Thử lại nhé!');
            update((s) => ({ ...s, cards: { ...s.cards, [learn.id]: (s.cards[learn.id] ?? 0) + 1 } }));
            toast(`Nhận thẻ ${learn.name}`);
          }}
        />
      )}
      {active && (
        <QuizSheet
          open={opening}
          onClose={() => setOpening(false)}
          title={`Mở lệnh bài: ${HERO_BY_ID[active.hero].name}`}
          subtitle={active.lesson}
          request={{ units: active.units, count: active.questions }}
          passMark={active.questions}
          sessionKind="recruit"
          finishLabel="Mời tướng gia nhập"
          onFinish={(sum) => {
            if (sum.passed) join(active);
            else toast('Chưa đúng hết các câu. Lệnh bài vẫn còn – em mở lại để thử tiếp nhé!');
          }}
        />
      )}
      {welcome && (
        <Sheet open onClose={() => setWelcome(null)} title="Tướng mới gia nhập!" subtitle={HERO_BY_ID[welcome].title}>
          <div className="flex flex-col items-center text-center gap-3">
            <HeroMedallion hero={HERO_BY_ID[welcome]} size={112} />
            <p className="font-display font-extrabold text-2xl">{HERO_BY_ID[welcome].name}</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              <ElementChip element={HERO_BY_ID[welcome].element} />
              <TierChip tier={HERO_BY_ID[welcome].tier} />
              <LoreChip lore={HERO_BY_ID[welcome].lore} />
            </div>
            <p className="leading-relaxed">{HERO_BY_ID[welcome].story}</p>
            <GBtn variant="ngoc" size="lg" className="w-full" onClick={() => setWelcome(null)}>
              <Check className="w-5 h-5" aria-hidden={true} /> Vào Doanh Trại
            </GBtn>
          </div>
        </Sheet>
      )}
    </div>
  );
};
