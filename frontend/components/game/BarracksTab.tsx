/**
 * Doanh Trại: danh tướng nhà Trần theo năm hệ quân (vật biểu trưng, không vẽ chân dung), hồ sơ và tiến hóa theo các giai đoạn cuộc đời,
 * Hội Quán Vạn Kiếp (thẻ Nhân lực + thẻ Sự kiện = lệnh bài triệu tập), cổ vật mang theo khi ra trận.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { ArrowUpCircle, BookOpen, Check, ChevronRight, Clock, Crown, Gift, Heart, Hourglass, Lock, Plus, ScrollText, Shield, Sparkles, Stamp, Swords, Wheat, Zap } from 'lucide-react-native';
import { BuildingSprite, HeroMedallion } from '@/components/art';
import { ElementChip, LoreChip, QuizPanel, TierChip } from '@/components/game/quiz';
import { Bar, Btn, Card, Chip, InfoNote, Inset, PressCard, SectionTitle, Segmented, Sheet, Txt } from '@/components/ui';
import { CARDS, ELEMENTS, ENEMY_TYPES, EVOLVE_BATTLES, RECIPES, RELICS, evolveCost, heroJoinHint, heroStats } from '@/constants/game';
import { HEROES, HERO_BY_ID } from '@/constants/heroes';
import { useGame } from '@/hooks/use-game';
import { useTheme } from '@/hooks/use-theme';
import { useNow } from '@/hooks/use-timers';
import { fmt, fmtClock } from '@/lib/format';
import type { CardDef, ElementId, EnemyType, IconType, RecipeDef, SkillDef } from '@/types/game';

export const BarracksTab: React.FC<{ sub: string; onSub: (s: string) => void }> = ({ sub, onSub }) => (
  <View style={{ gap: 14 }}>
    <SectionTitle title="Doanh Trại" subtitle="Năm hệ quân theo địa danh, chiêu mộ tướng và cổ vật" />
    <Segmented
      label="Doanh Trại"
      options={[
        { value: 'heroes', label: 'Tướng' },
        { value: 'recruit', label: 'Hội Quán Vạn Kiếp' },
        { value: 'relics', label: 'Cổ vật' },
      ]}
      value={sub}
      onChange={onSub}
    />
    {sub === 'recruit' ? <RecruitPanel /> : sub === 'relics' ? <RelicsPanel /> : <HeroesPanel />}
  </View>
);

// ---------------------------------------------------------------------- tướng
const HeroesPanel: React.FC = () => {
  const { state } = useGame();
  const { c } = useTheme();
  const [filter, setFilter] = useState<ElementId | 'all'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const list = HEROES.filter((h) => filter === 'all' || h.element === filter);
  const ownedCount = HEROES.filter((h) => state.heroes[h.id]).length;
  return (
    <View style={{ gap: 14 }}>
      <Segmented
        label="Lọc theo hệ quân"
        options={[{ value: 'all' as const, label: `Tất cả (${ownedCount}/${HEROES.length})` }, ...(['thuy', 'moc', 'tho', 'hoa', 'thong'] as const).map((f) => ({ value: f, label: ELEMENTS[f].name }))]}
        value={filter}
        onChange={setFilter}
      />
      {filter !== 'all' && (
        <Inset style={{ backgroundColor: c[ELEMENTS[filter].soft] }}>
          <Txt f="display" size={16} color={c[ELEMENTS[filter].text]}>
            {ELEMENTS[filter].place}
          </Txt>
          <Txt size={14}>{ELEMENTS[filter].desc}</Txt>
        </Inset>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {list.map((h) => {
          const owned = state.heroes[h.id];
          return (
            <PressCard
              key={h.id}
              onPress={() => setOpen(h.id)}
              label={`${h.name}${owned ? `, giai đoạn ${owned.stage}` : ', chưa có'}`}
              pad={12}
              style={{ flexGrow: 1, flexBasis: 150, maxWidth: 260, alignItems: 'center', gap: 6, opacity: owned ? 1 : 0.85 }}
            >
              <HeroMedallion hero={h} stage={owned?.stage ?? 1} size={68} dim={!owned} />
              <Txt f="displayHeavy" size={16} center>
                {h.name}
              </Txt>
              <Txt size={12} color={c.muc2} center>
                {h.title}
              </Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4 }}>
                <ElementChip element={h.element} />
                {!owned && <Chip text="Chưa có" icon={Lock} bg={c.giay2} fg={c.muc2} />}
              </View>
            </PressCard>
          );
        })}
      </View>
      <HeroSheet heroId={open} onClose={() => setOpen(null)} />
    </View>
  );
};

const StatRow: React.FC<{ icon: IconType; label: string; value: number; max: number; fill: string }> = ({ icon: Icon, label, value, max, fill }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Icon size={16} color={c.muc2} />
      <Txt f="semibold" size={14} color={c.muc2} style={{ width: 80 }}>
        {label}
      </Txt>
      <Bar value={value} max={max} fill={fill} height={10} style={{ flex: 1 }} label={label} />
      <Txt f="bold" style={{ width: 40, textAlign: 'right' }}>
        {value}
      </Txt>
    </View>
  );
};

const SkillLine: React.FC<{ tag: string; skill: SkillDef; bg: string; fg: string }> = ({ tag, skill, bg, fg }) => {
  const { c } = useTheme();
  return (
    <Card flat pad={12} style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <Chip text={tag} bg={bg} fg={fg} />
        <Txt f="display" size={16}>
          {skill.name}
        </Txt>
      </View>
      <Txt size={14} color={c.muc2}>
        {skill.desc}
      </Txt>
    </Card>
  );
};

const HeroSheet: React.FC<{ heroId: string | null; onClose: () => void }> = ({ heroId, onClose }) => {
  const { state, update, progress, spendGems, toast } = useGame();
  const { c } = useTheme();
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
    update((s) => ({ ...s, luong: Math.max(0, s.luong - cost.luong), heroes: { ...s.heroes, [hero.id]: { ...s.heroes[hero.id], stage: (stage + 1) as 1 | 2 | 3 } } }));
    toast(`${hero.name} tiến hóa: ${next.name}`);
  };

  return (
    <Sheet
      open
      onClose={quiz ? () => setQuiz(false) : onClose}
      wide
      title={quiz && next ? `Tiến hóa ${hero.name}` : hero.name}
      subtitle={quiz && next ? `Giai đoạn mới: ${next.name} (${next.years})` : hero.title}
      icon={<HeroMedallion hero={hero} stage={stage} size={56} dim={!owned} />}
    >
      {quiz && next ? (
        <QuizPanel
          request={{ units: [next.unit], count: 2 }}
          passMark={2}
          sessionKind="practice"
          finishLabel="Tiếp tục"
          onClose={() => setQuiz(false)}
          onFinish={(sum) => {
            if (sum.passed) evolve();
            else toast('Cần trả lời đúng cả 2 câu để tiến hóa. Thử lại nhé!');
          }}
        />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18 }}>
          <View style={{ flexGrow: 1, flexBasis: 300, gap: 12 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              <ElementChip element={hero.element} />
              <TierChip tier={hero.tier} />
              <LoreChip lore={hero.lore} />
              <Chip text={hero.role} bg={c.giay2} fg={c.muc2} />
            </View>
            <Txt>{hero.story}</Txt>
            <Card flat style={{ gap: 10 }}>
              <StatRow icon={Heart} label="Khí lực" value={stats.hp} max={260} fill={c.ngoc} />
              <StatRow icon={Swords} label="Tấn công" value={stats.atk} max={45} fill={c.son} />
              <StatRow icon={Shield} label="Phòng thủ" value={stats.def} max={22} fill={c.thuy} />
              <StatRow icon={Zap} label="Tốc độ" value={stats.spd} max={20} fill={c.dong} />
            </Card>
            {counters.length > 0 && (
              <InfoNote>
                Khắc chế {counters.map((t) => ENEMY_TYPES[t].name.toLowerCase()).join(', ')} (sát thương ×1,5). {ENEMY_TYPES[counters[0]].lesson}
              </InfoNote>
            )}
            <SkillLine tag="Đánh thường" skill={hero.basic} bg={c.giay2} fg={c.muc2} />
            <SkillLine tag="Kế sách · 1 câu hỏi" skill={hero.strat} bg={c.dongNhat} fg={c.dongChu} />
            <SkillLine tag="Tuyệt chiêu · đầy Hào Khí" skill={hero.ult} bg={c.sonNhat} fg={c.sonChu} />
          </View>
          <View style={{ flexGrow: 1, flexBasis: 280, gap: 12 }}>
            <Txt f="displayHeavy" size={18}>
              Các giai đoạn cuộc đời
            </Txt>
            <View style={{ borderLeftWidth: 4, borderLeftColor: c.vien, marginLeft: 12, gap: 14 }}>
              {hero.stages.map((st, i) => {
                const reached = !!owned && stage >= i + 1;
                return (
                  <View key={st.name} style={{ paddingLeft: 20 }}>
                    <View style={{ position: 'absolute', left: -14, top: 2, width: 24, height: 24, borderRadius: 12, borderWidth: 4, borderColor: c.giay, backgroundColor: reached ? c.dong : c.vien2, alignItems: 'center', justifyContent: 'center' }}>
                      {reached && <Check size={11} color="#1c1917" />}
                    </View>
                    <Txt f="bold" size={12} color={c.dongChu}>
                      {st.years}
                    </Txt>
                    <Txt f="display" size={16} color={reached ? c.muc : c.muc2}>
                      Giai đoạn {i + 1}: {st.name}
                    </Txt>
                    <Txt size={14} color={c.muc2}>
                      {st.desc}
                    </Txt>
                  </View>
                );
              })}
            </View>
            {!owned ? (
              <Inset pad={16} style={{ flexDirection: 'row', gap: 10 }}>
                <Lock size={20} color={c.muc2} />
                <Txt f="semibold" size={14} style={{ flex: 1 }}>
                  {heroJoinHint(hero)}
                </Txt>
              </Inset>
            ) : next ? (
              <Inset pad={16} style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ArrowUpCircle size={20} color={c.dongChu} />
                  <Txt f="display" size={18}>
                    Tiến hóa: {next.name}
                  </Txt>
                </View>
                <Txt size={14} f={owned.battles >= needBattles ? 'semibold' : 'body'} color={owned.battles >= needBattles ? c.ngocChu : c.muc2}>
                  • Đã ra trận {owned.battles}/{needBattles} lần
                </Txt>
                <Txt size={14} f={state.luong >= cost.luong ? 'semibold' : 'body'} color={state.luong >= cost.luong ? c.ngocChu : c.muc2}>
                  • {fmt(cost.luong)} Lương Thảo
                </Txt>
                <Txt size={14} f={progress.gems >= cost.gems ? 'semibold' : 'body'} color={progress.gems >= cost.gems ? c.ngocChu : c.muc2}>
                  • {cost.gems} Ấn Tín
                </Txt>
                <Txt size={14} color={c.muc2}>
                  • Trả lời đúng 2 câu về giai đoạn “{next.name}”
                </Txt>
                <Btn title="Trả lời để tiến hóa" icon={Sparkles} tone="dong" size="lg" full disabled={!canEvolve} onPress={() => setQuiz(true)} />
              </Inset>
            ) : (
              <Inset pad={16} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Crown size={24} color={c.dongChu} />
                <Txt f="semibold">Đã đạt giai đoạn cao nhất.</Txt>
              </Inset>
            )}
          </View>
        </View>
      )}
    </Sheet>
  );
};

// ---------------------------------------------------------------------- Hội Quán Vạn Kiếp
const CardTile: React.FC<{ card: CardDef; count: number; onLearn?: () => void }> = ({ card, count, onLearn }) => {
  const { c } = useTheme();
  const Icon = card.Icon;
  const event = card.kind === 'su_kien';
  return (
    <Card flat pad={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: event ? c.dongNhat : c.ngocNhat }}>
        <Icon size={24} color={event ? c.dongChu : c.ngocChu} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt f="display" size={16}>
          {card.name}
        </Txt>
        <Txt size={12} color={c.muc2}>
          {card.how}
        </Txt>
      </View>
      <Txt f="displayHeavy" size={18} accessibilityLabel={`Đang có ${count} thẻ`}>
        ×{count}
      </Txt>
      {onLearn && <Btn title="Học" icon={BookOpen} tone="giay" size="sm" label={`Học để nhận thẻ ${card.name}`} onPress={onLearn} />}
    </Card>
  );
};

type RecruitMode = { kind: 'learn'; card: CardDef } | { kind: 'open'; recipe: RecipeDef } | { kind: 'welcome'; hero: string } | null;

const RecruitPanel: React.FC = () => {
  const { state, update, progress, spendGems, toast, sound } = useGame();
  const { c } = useTheme();
  const now = useNow(1000);
  const [mode, setMode] = useState<RecruitMode>(null);
  const hq = state.buildings.hoiquan.level;
  const waitFactor = 1 - (Math.max(1, hq) - 1) * 0.25;
  const active = state.recruit ? (RECIPES.find((r) => r.id === state.recruit?.recipe) ?? null) : null;
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

  const nhanLuc = Object.values(CARDS).filter((x) => x.kind === 'nhan_luc');
  const suKien = Object.values(CARDS).filter((x) => x.kind === 'su_kien');
  const welcome = mode?.kind === 'welcome' ? HERO_BY_ID[mode.hero] : null;

  return (
    <View style={{ gap: 16 }}>
      <Card style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <BuildingSprite id="hoiquan" level={Math.max(1, hq)} size={80} />
        <View style={{ flex: 1, gap: 4 }}>
          <Txt f="displayHeavy" size={18}>
            Hội Quán Vạn Kiếp
          </Txt>
          <Txt size={14}>
            Đặt <Txt f="bold" size={14}>một thẻ Nhân lực</Txt> với <Txt f="bold" size={14}>một thẻ Sự kiện</Txt> để nhận lệnh bài triệu tập. Chờ lệnh bài rồi trả lời câu hỏi về sự kiện đó – tướng sẽ gia
            nhập. Mỗi công thức là một quan hệ nhân – quả trong lịch sử.
          </Txt>
        </View>
      </Card>

      {active && (
        <Card flat style={{ borderColor: c.dong, backgroundColor: c.dongNhat, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 56, height: 64, borderRadius: 12, backgroundColor: c.son, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 4, borderBottomColor: c.sonDam }}>
            <ScrollText size={32} color="#ffffff" />
          </View>
          <View style={{ flex: 1, minWidth: 180 }} accessibilityLiveRegion="polite">
            <Txt f="displayHeavy" size={18}>
              Lệnh bài triệu tập: {HERO_BY_ID[active.hero].name}
            </Txt>
            {left > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Hourglass size={16} color={c.muc} />
                <Txt size={14}>
                  Còn <Txt f="bold" size={14}>{fmtClock(left)}</Txt>
                </Txt>
              </View>
            ) : (
              <Txt f="semibold" size={14} color={c.ngocChu}>
                Lệnh bài đã đến! Trả lời {active.questions} câu để tướng gia nhập.
              </Txt>
            )}
          </View>
          <Btn title="Mở lệnh bài" icon={Gift} tone="ngoc" disabled={left > 0} onPress={() => setMode({ kind: 'open', recipe: active })} />
        </Card>
      )}

      <Txt f="displayHeavy" size={18}>
        Công thức chiêu mộ
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {RECIPES.map((r) => {
          const hero = HERO_BY_ID[r.hero];
          const owned = !!state.heroes[r.hero];
          const haveA = (state.cards[r.inputs[0]] ?? 0) > 0;
          const haveB = (state.cards[r.inputs[1]] ?? 0) > 0;
          const ok = !owned && haveA && haveB && state.luong >= r.luong && progress.gems >= r.gems && !state.recruit;
          return (
            <Card key={r.id} style={{ flexGrow: 1, flexBasis: 320, gap: 10 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                {[r.inputs[0], r.inputs[1]].map((cid, i) => {
                  const card = CARDS[cid];
                  const have = i === 0 ? haveA : haveB;
                  return (
                    <React.Fragment key={cid}>
                      {i === 1 && <Plus size={16} color={c.muc3} accessibilityLabel="cộng" />}
                      <View
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 2, borderStyle: have ? 'solid' : 'dashed', borderColor: have ? c.ngoc : c.vien2, backgroundColor: have ? c.the : c.giay2 }}
                        accessible
                        accessibilityLabel={`${card.name}${have ? ', đã có' : ', chưa có'}`}
                      >
                        <card.Icon size={15} color={have ? c.muc : c.muc2} />
                        <Txt f="bold" size={13} color={have ? c.muc : c.muc2}>
                          {card.name}
                        </Txt>
                        {have && <Check size={13} color={c.ngocChu} />}
                      </View>
                    </React.Fragment>
                  );
                })}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <HeroMedallion hero={hero} size={54} dim={!owned} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Txt f="displayHeavy" size={16}>
                    {hero.name}
                  </Txt>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                    <TierChip tier={hero.tier} />
                    <LoreChip lore={hero.lore} />
                  </View>
                </View>
              </View>
              <Txt size={14} color={c.muc2}>
                {r.lesson}
              </Txt>
              {owned ? (
                <Chip text="Đã gia nhập" icon={Check} bg={c.ngocNhat} fg={c.ngocChu} />
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                  <Chip text={String(r.luong)} icon={Wheat} bg={state.luong >= r.luong ? c.giay2 : c.sonNhat} fg={state.luong >= r.luong ? c.muc : c.sonChu} />
                  <Chip text={String(r.gems)} icon={Stamp} bg={progress.gems >= r.gems ? c.giay2 : c.sonNhat} fg={progress.gems >= r.gems ? c.muc : c.sonChu} />
                  <Chip text={fmtClock(Math.round(r.waitSec * waitFactor))} icon={Clock} bg={c.giay2} fg={c.muc2} />
                  <Btn title="Triệu tập" iconRight={ChevronRight} size="sm" disabled={!ok} onPress={() => start(r)} style={{ marginLeft: 'auto' }} label={`Triệu tập ${hero.name}`} />
                </View>
              )}
            </Card>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        <View style={{ flexGrow: 1, flexBasis: 320, gap: 8 }}>
          <Txt f="displayHeavy" size={18}>
            Thẻ Nhân lực
          </Txt>
          {nhanLuc.map((card) => (
            <CardTile key={card.id} card={card} count={state.cards[card.id] ?? 0} />
          ))}
        </View>
        <View style={{ flexGrow: 1, flexBasis: 320, gap: 8 }}>
          <Txt f="displayHeavy" size={18}>
            Thẻ Sự kiện – Văn kiện
          </Txt>
          {suKien.map((card) => (
            <CardTile key={card.id} card={card} count={state.cards[card.id] ?? 0} onLearn={() => setMode({ kind: 'learn', card })} />
          ))}
          <InfoNote>Thẻ Sự kiện có được khi em trả lời đúng ít nhất 2/3 câu về chủ đề đó.</InfoNote>
        </View>
      </View>

      <Sheet
        open={!!mode}
        onClose={() => setMode(null)}
        wide={mode?.kind !== 'welcome'}
        title={mode?.kind === 'learn' ? `Thẻ: ${mode.card.name}` : mode?.kind === 'open' ? `Mở lệnh bài: ${HERO_BY_ID[mode.recipe.hero].name}` : 'Tướng mới gia nhập!'}
        subtitle={mode?.kind === 'learn' ? mode.card.desc : mode?.kind === 'open' ? mode.recipe.lesson : welcome?.title}
      >
        {mode?.kind === 'learn' && (
          <QuizPanel
            request={{ units: [mode.card.unit ?? 'ALL_3_WARS_SUMMARY'], count: 3 }}
            passMark={2}
            sessionKind="practice"
            finishLabel="Nhận thẻ"
            onClose={() => setMode(null)}
            onFinish={(sum) => {
              if (!sum.passed) return toast('Cần đúng ít nhất 2/3 câu để nhận thẻ. Thử lại nhé!');
              const id = mode.card.id;
              update((s) => ({ ...s, cards: { ...s.cards, [id]: (s.cards[id] ?? 0) + 1 } }));
              toast(`Nhận thẻ ${mode.card.name}`);
            }}
          />
        )}
        {mode?.kind === 'open' && (
          <QuizPanel
            request={{ units: mode.recipe.units, count: mode.recipe.questions }}
            passMark={mode.recipe.questions}
            sessionKind="recruit"
            finishLabel="Mời tướng gia nhập"
            onClose={() => undefined}
            onFinish={(sum) => {
              if (!sum.passed) {
                toast('Chưa đúng hết các câu. Lệnh bài vẫn còn – em mở lại để thử tiếp nhé!');
                setMode(null);
                return;
              }
              const heroId = mode.recipe.hero;
              update((s) => ({ ...s, recruit: null, heroes: { ...s.heroes, [heroId]: { stage: 1, battles: 0 } } }));
              setMode({ kind: 'welcome', hero: heroId });
              sound('win');
            }}
          />
        )}
        {welcome && (
          <View style={{ alignItems: 'center', gap: 10 }}>
            <HeroMedallion hero={welcome} size={112} />
            <Txt f="displayHeavy" size={26} center accessibilityRole="header">
              {welcome.name}
            </Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 }}>
              <ElementChip element={welcome.element} />
              <TierChip tier={welcome.tier} />
              <LoreChip lore={welcome.lore} />
            </View>
            <Txt center>{welcome.story}</Txt>
            <Btn title="Vào Doanh Trại" icon={Check} tone="ngoc" size="lg" full onPress={() => setMode(null)} />
          </View>
        )}
      </Sheet>
    </View>
  );
};

// ---------------------------------------------------------------------- cổ vật
const RelicsPanel: React.FC = () => {
  const { state, update, toast } = useGame();
  const { c } = useTheme();
  return (
    <View style={{ gap: 14 }}>
      <InfoNote>Mỗi trận được mang theo 1 cổ vật. Hiệu ứng là sáng tạo của game; câu chuyện đi kèm có nhãn nguồn tư liệu.</InfoNote>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {Object.values(RELICS).map((r) => {
          const owned = state.relics.includes(r.id);
          const equipped = state.relic === r.id;
          const Icon = r.Icon;
          return (
            <Card key={r.id} style={{ flexGrow: 1, flexBasis: 300, gap: 8, opacity: owned ? 1 : 0.85 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: owned ? c.dong : c.giay2 }}>
                  {owned ? <Icon size={24} color="#1c1917" /> : <Lock size={20} color={c.muc3} />}
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Txt f="displayHeavy" size={16}>
                    {r.name}
                  </Txt>
                  <LoreChip lore={r.lore} />
                </View>
              </View>
              <Txt f="semibold" size={14}>
                {r.effect}
              </Txt>
              <Txt size={14} color={c.muc2}>
                {r.story}
              </Txt>
              {owned ? (
                <Btn
                  title={equipped ? 'Đang mang theo' : 'Mang theo khi ra trận'}
                  icon={equipped ? Check : undefined}
                  tone={equipped ? 'ngoc' : 'giay'}
                  size="sm"
                  full
                  selected={equipped}
                  onPress={() => {
                    update((s) => ({ ...s, relic: equipped ? null : r.id }));
                    toast(equipped ? `Đã cất ${r.name}` : `Mang theo ${r.name} khi ra trận`);
                  }}
                />
              ) : (
                <Txt f="bold" size={12} color={c.dongChu}>
                  Cách nhận: {r.how}
                </Txt>
              )}
            </Card>
          );
        })}
      </View>
    </View>
  );
};

