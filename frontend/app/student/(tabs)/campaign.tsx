import React, { useState } from 'react';
import { ChevronRight, Lock, Trophy, Users } from 'lucide-react';
import { HeroMedallion } from '@/components/customs/game/art/HeroMedallion';
import { SchematicMap } from '@/components/customs/game/art/SchematicMap';
import { BattleScreen } from '@/components/customs/game/battle/BattleScreen';
import { TeamPicker } from '@/components/customs/game/campaign/TeamPicker';
import { QuizSheet } from '@/components/customs/game/QuizSheet';
import { GBtn } from '@/components/ui/button';
import { InfoNote } from '@/components/ui/info-note';
import { SectionTitle } from '@/components/ui/section-title';
import { Sheet } from '@/components/ui/sheet';
import { Stars } from '@/components/ui/stars';
import { CAMPAIGNS, CAMPAIGN_ROUTES, PHASES } from '@/constants/game/campaigns';
import { HERO_BY_ID } from '@/constants/game/heroes';
import { MAP_PLACES } from '@/constants/game/places';
import { useGame } from '@/hooks/use-game';
import { starsOf } from '@/lib/game/battle-engine';
import { campaignDone, campaignStars, phaseUnlocked } from '@/store/game.store';
import type { BattleState } from '@/types/battleType';
import type { GameState, GameTab, HeroState, PhaseDef } from '@/types/gameType';
import { fmt } from '@/utils/format';

export const CampaignTab: React.FC<{ onGoto: (tab: GameTab, sub?: string) => void }> = ({ onGoto }) => {
  const { state, update, dark, reward, bumpDaily, finishSession, toast, sound } = useGame();
  const firstOpen = ([1, 2, 3] as const).find((c) => !campaignDone(state, c)) ?? 3;
  const [sel, setSel] = useState<1 | 2 | 3>(firstOpen);
  const [prep, setPrep] = useState<PhaseDef | null>(null);
  const [fight, setFight] = useState<{ phase: PhaseDef; team: string[] } | null>(null);
  const [story, setStory] = useState<null | { title: string; text: string; heroes: string[] }>(null);
  const [finale, setFinale] = useState(false);
  const allDone = campaignDone(state, 3);

  const onExit = (b: BattleState | null, team: string[]) => {
    setFight(null);
    if (!b) return;
    const phase = b.phase;
    const stars = starsOf(b);
    const before = state.campaign[phase.id] ?? 0;
    finishSession('battle', b.correct, Math.max(1, b.answered));
    bumpDaily('battle');
    const bumpHeroes = (s: GameState) =>
      Object.fromEntries(Object.entries(s.heroes).map(([id, h]) => [id, team.includes(id) ? { ...h, battles: h.battles + 1 } : h])) as Record<string, HeroState>;
    if (b.result !== 'win') {
      update((s) => ({ ...s, stats: { ...s.stats, battles: s.stats.battles + 1 }, heroes: bumpHeroes(s) }));
      return;
    }
    const k = before === 0 ? 1 : 0.3;
    const gotLuong = Math.round(phase.reward.luong * k);
    const gotQuan = Math.round(phase.reward.quan * k);
    const campaignAfter = { ...state.campaign, [phase.id]: Math.max(before, stars) };
    const done = (c: 1 | 2) => PHASES.filter((p) => p.campaign === c).every((p) => (campaignAfter[p.id] ?? 0) > 0);
    const unlock1 = done(1) && !state.relics.includes('co_sau_chu');
    const unlock2 = done(2) && !state.relics.includes('tung_gia');
    const joined = unlock1 ? (CAMPAIGNS[1].joinHeroes ?? []).filter((id) => !state.heroes[id]) : [];
    update((s) => {
      let next: GameState = {
        ...s,
        campaign: { ...s.campaign, [phase.id]: Math.max(s.campaign[phase.id] ?? 0, stars) },
        codex: [...new Set([...s.codex, ...phase.units])],
        stats: { ...s.stats, battles: s.stats.battles + 1, wins: s.stats.wins + 1 },
        heroes: bumpHeroes(s),
      };
      if (unlock1 && !next.relics.includes('co_sau_chu')) {
        next = {
          ...next,
          heroes: { ...next.heroes, ...Object.fromEntries(joined.filter((id) => !next.heroes[id]).map((id) => [id, { stage: 1 as const, battles: 0 }])) },
          relics: [...next.relics, 'co_sau_chu'],
          cards: { ...next.cards, tuong_hoang_toc: (next.cards.tuong_hoang_toc ?? 0) + 1, binh_than: (next.cards.binh_than ?? 0) + 1 },
        };
      }
      if (unlock2 && !next.relics.includes('tung_gia')) next = { ...next, relics: [...next.relics, 'tung_gia'] };
      return next;
    });
    reward(gotLuong, gotQuan);
    if (stars > before) sound('win');
    if (unlock1)
      setStory({
        title: 'Hội nghị Bình Than (10/1282)',
        text: 'Vua Trần Nhân Tông họp vương hầu, trăm quan bàn kế đánh giặc và cử Trần Quốc Tuấn làm Quốc công Tiết chế. Các tướng mới gia nhập. Em nhận thẻ Tướng hoàng tộc, thẻ Hội nghị Bình Than và cổ vật Cờ thêu sáu chữ vàng.',
        heroes: joined,
      });
    else if (unlock2) setStory({ title: 'Kháng chiến lần thứ hai thắng lợi!', text: 'Em nhận cổ vật Thơ “Tụng giá hoàn kinh sư” của Trần Quang Khải.', heroes: [] });
    else toast(`Nhận ${fmt(gotLuong)} Lương Thảo, ${gotQuan} Quân Lực`);
  };

  const phases = PHASES.filter((p) => p.campaign === sel);
  return (
    <div className="max-w-6xl mx-auto px-4 py-4 lg:py-6 space-y-4">
      <SectionTitle title="Chiến Dịch" subtitle="Ba lần kháng chiến chống quân Mông – Nguyên (1258 – 1288)" />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 items-start">
        <div className="g-card overflow-hidden">
          <SchematicMap
            dark={dark}
            className="w-full h-auto"
            pins={[...new Set(phases.map((p) => p.place))]}
            highlight={phases.find((p) => phaseUnlocked(state, p) && !(state.campaign[p.id] ?? 0))?.place ?? null}
            routes={CAMPAIGN_ROUTES[sel]}
            title={`Lược đồ ${CAMPAIGNS[sel - 1].name}`}
          />
          <p className="px-4 pb-3 text-xs text-muc-2">Mũi tên đỏ: hướng tiến quân của giặc (minh họa).</p>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Chọn màn">
            {CAMPAIGNS.map((c) => {
              const locked = c.id > 1 && !campaignDone(state, (c.id - 1) as 1 | 2);
              const on = sel === c.id;
              return (
                <button
                  key={c.id}
                  role="tab"
                  type="button"
                  aria-selected={on}
                  onClick={() => setSel(c.id)}
                  className={`rounded-2xl p-2.5 border-2 text-left min-h-[88px] ${on ? 'border-son bg-son-nhat' : 'border-vien bg-the'} ${locked ? 'opacity-70' : ''}`}
                >
                  <p className="text-xs font-bold text-dong-chu">Màn {c.id}</p>
                  <p className="font-display font-extrabold leading-tight">{c.years}</p>
                  <div className="mt-1 flex items-center gap-1">
                    {locked ? <Lock className="w-4 h-4 text-muc-3" aria-label="Chưa mở" /> : <Stars n={Math.round(campaignStars(state, c.id) / 3)} size={14} label={`${campaignStars(state, c.id)}/9 sao`} />}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="g-inset p-3">
            <p className="font-display font-extrabold text-lg">{CAMPAIGNS[sel - 1].name}</p>
            <p className="text-sm text-muc-2">{CAMPAIGNS[sel - 1].desc}</p>
          </div>
          <ol className="grid gap-2.5">
            {phases.map((p, i) => {
              const open = phaseUnlocked(state, p);
              const stars = state.campaign[p.id] ?? 0;
              return (
                <li key={p.id} className={`g-card p-3 flex items-center gap-3 ${open ? '' : 'opacity-70'}`}>
                  <span className={`w-11 h-11 rounded-2xl flex items-center justify-center font-display font-extrabold text-lg shrink-0 ${stars ? 'bg-ngoc text-white' : open ? 'bg-son text-white' : 'bg-giay-2 text-muc-3'}`}>
                    {open ? i + 1 : <Lock className="w-5 h-5" aria-label="Chưa mở" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-extrabold leading-tight">{p.name}</p>
                    <p className="text-xs text-muc-2">
                      {p.date} · {MAP_PLACES[p.place].name}
                    </p>
                    <Stars n={stars} size={15} />
                  </div>
                  <GBtn variant={stars ? 'giay' : 'son'} size="sm" disabled={!open} onClick={() => setPrep(p)}>
                    {stars ? 'Đánh lại' : 'Xuất trận'} <ChevronRight className="w-4 h-4" aria-hidden={true} />
                  </GBtn>
                </li>
              );
            })}
          </ol>
          {sel > 1 && !campaignDone(state, (sel - 1) as 1 | 2) && <InfoNote>Hoàn thành Màn {sel - 1} để mở màn này.</InfoNote>}
          {allDone && (
            <div className="rounded-3xl border-2 border-dong bg-dong-nhat p-4 flex flex-wrap items-center gap-3">
              <Trophy className="w-8 h-8 text-dong-chu" aria-hidden={true} />
              <div className="flex-1 min-w-[180px]">
                <p className="font-display font-extrabold text-lg">Tổng kết: Hào Khí Đông A</p>
                <p className="text-sm text-muc">Trả lời 5 câu về nguyên nhân thắng lợi và ý nghĩa lịch sử của ba lần kháng chiến.</p>
              </div>
              <GBtn variant="dong" onClick={() => setFinale(true)}>
                Làm bài tổng kết
              </GBtn>
            </div>
          )}
        </div>
      </div>
      {prep && (
        <TeamPicker
          phase={prep}
          onClose={() => setPrep(null)}
          onStart={(team) => {
            setFight({ phase: prep, team });
            setPrep(null);
          }}
        />
      )}
      {fight && <BattleScreen phase={fight.phase} team={fight.team} onExit={(b) => onExit(b, fight.team)} />}
      {story && (
        <Sheet open onClose={() => setStory(null)} title={story.title} subtitle="Sự kiện lịch sử mở khóa">
          <div className="space-y-4">
            <p className="leading-relaxed">{story.text}</p>
            {story.heroes.length > 0 && (
              <ul className="grid grid-cols-2 gap-2">
                {story.heroes.map((id) => (
                  <li key={id} className="g-card-flat p-2 flex items-center gap-2">
                    <HeroMedallion hero={HERO_BY_ID[id]} size={42} />
                    <span className="font-display font-bold text-sm leading-tight">{HERO_BY_ID[id].name}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <GBtn variant="giay" className="flex-1" onClick={() => setStory(null)}>
                Đóng
              </GBtn>
              <GBtn
                variant="ngoc"
                className="flex-1"
                onClick={() => {
                  setStory(null);
                  onGoto('barracks', 'heroes');
                }}
              >
                <Users className="w-4 h-4" aria-hidden={true} /> Xem Doanh Trại
              </GBtn>
            </div>
          </div>
        </Sheet>
      )}
      <QuizSheet
        open={finale}
        onClose={() => setFinale(false)}
        title="Tổng kết: Hào Khí Đông A"
        subtitle="Nguyên nhân thắng lợi và ý nghĩa lịch sử"
        request={{ units: ['ALL_3_WARS_SUMMARY', 'CAUSES_OF_VICTORY', 'HISTORICAL_SIGNIFICANCE'], count: 5 }}
        passMark={4}
        timer
        sessionKind="practice"
        finishLabel="Hoàn thành"
        onFinish={(sum) => {
          if (sum.passed) {
            update((s) => ({ ...s, codex: [...new Set([...s.codex, 'ALL_3_WARS_SUMMARY', 'CAUSES_OF_VICTORY', 'HISTORICAL_SIGNIFICANCE'])] }));
            toast('Em đã hoàn thành chiến dịch Hào Khí Đông A!');
          }
        }}
      />
    </div>
  );
};
