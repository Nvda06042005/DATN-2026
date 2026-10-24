/**
 * Điền Trang: bàn công trình (ruộng, trại, kho, xưởng cọc, bến Vân Đồn...), thu hoạch Lương Thảo theo thời gian,
 * xây/nâng cấp phải trả lời đúng một câu, nhiệm vụ hôm nay, sự kiện "giặc kéo đến cướp lương" (vườn không nhà trống).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, View, useWindowDimensions } from 'react-native';
import {
  AlertTriangle, ArrowUpCircle, BicepsFlexed, Check, ChessKnight, ChevronRight, Clock, Gift, Hammer, Sailboat, Shield, Siren, Stamp, Swords, Users, Warehouse, Wheat,
} from 'lucide-react-native';
import { BattleBackdrop, BuildingSprite, FarmBoardArt, Mascot } from '@/components/art';
import { QuestionCard, QuizPanel } from '@/components/game/quiz';
import { Bar, Btn, Card, Chip, InfoNote, Inset, PressCard, SectionTitle, Sheet, Spinner, Txt } from '@/components/ui';
import { BUILDINGS, BUILDING_BY_ID, UPGRADE_SECONDS, farmCap, farmRate, storeCap, troopCap, upgradeCost } from '@/constants/game';
import { useGame } from '@/hooks/use-game';
import { useBob, useReduceMotion } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';
import { useNow } from '@/hooks/use-timers';
import { fmt, fmtClock } from '@/lib/format';
import { dailyTasksFor, farmReady, levelOf, raidDue, todayKey } from '@/lib/game-state';
import type { ServedQuestion } from '@/types/api';
import type { BuildingDef, BuildingId, DailyTaskDef, GameState, GameTab } from '@/types/game';

export const FarmTab: React.FC<{ onGoto: (tab: GameTab, sub?: string) => void }> = ({ onGoto }) => {
  const { state, dark, progress } = useGame();
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const now = useNow(1000);
  const [open, setOpen] = useState<BuildingId | null>(null);
  const [raid, setRaid] = useState(false);
  const [board, setBoard] = useState(0);
  const due = raidDue(state);
  const wide = width >= 1024;
  return (
    <View style={{ flexDirection: wide ? 'row' : 'column', gap: 16, alignItems: 'flex-start' }}>
      <View style={{ flex: 1, gap: 14, width: '100%' }}>
        <SectionTitle title="Điền Trang Đông A" subtitle="Ngụ binh ư nông: thời bình làm ruộng, có giặc thì ra trận." action={<Chip text={`Cấp ${levelOf(progress.xp)}`} bg={c.son} fg="#ffffff" />} />
        {due && (
          <Card flat style={{ borderColor: c.son, backgroundColor: c.sonNhat, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
            <AlarmIcon />
            <View style={{ flex: 1, minWidth: 180 }} accessibilityRole="alert">
              <Txt f="displayHeavy" size={18} color={c.sonChu}>
                Giặc Mông – Nguyên kéo đến cướp lương!
              </Txt>
              <Txt size={14}>Ứng phó ngay để bảo vệ {fmt(state.luong)} Lương Thảo.</Txt>
            </View>
            <Btn title="Ứng phó" icon={AlertTriangle} onPress={() => setRaid(true)} />
          </Card>
        )}
        <View
          onLayout={(e) => setBoard(e.nativeEvent.layout.width)}
          style={{ width: '100%', maxWidth: 640, aspectRatio: 1, alignSelf: 'center', borderRadius: 36, borderWidth: 4, borderColor: c.vien, borderBottomWidth: 10, borderBottomColor: c.vien2 }}
        >
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 32, overflow: 'hidden' }}>
            <FarmBoardArt dark={dark} />
          </View>
          {board > 0 && BUILDINGS.map((def) => <BuildingButton key={def.id} def={def} now={now} board={board - 8} onOpen={() => setOpen(def.id)} />)}
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Stock icon={Wheat} label="Lương Thảo" value={state.luong} cap={storeCap(state.buildings.kho.level)} color={c.dongChu} />
          <Stock icon={Shield} label="Quân Lực" value={state.quan} cap={troopCap(state.buildings.trai.level)} color={c.sonChu} />
        </View>
      </View>
      <View style={{ width: wide ? 340 : '100%', gap: 14 }}>
        <DailyPanel />
        <Card style={{ gap: 8 }}>
          <Txt f="displayHeavy" size={18}>
            Mẹo của Rồng Con
          </Txt>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
            <Mascot size={64} mood="happy" accessory="conical" />
            <Txt size={14} style={{ flex: 1 }}>
              Chạm vào công trình để thu hoạch hoặc nâng cấp. Mỗi lần nâng cấp phải trả lời đúng một câu – <Txt f="bold" size={14}>kiến thức là vũ khí</Txt>! Ấn Tín chỉ có khi em trả lời đúng ở server.
            </Txt>
          </View>
        </Card>
      </View>
      <BuildingSheet id={open} now={now} onClose={() => setOpen(null)} onGoto={onGoto} />
      {raid && <RaidEvent onDone={() => setRaid(false)} />}
    </View>
  );
};

const AlarmIcon: React.FC = () => {
  const { c } = useTheme();
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1.12, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(v, { toValue: 1, duration: 700, easing: Easing.in(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, v]);
  return (
    <Animated.View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: c.son, alignItems: 'center', justifyContent: 'center', transform: [{ scale: v }] }}>
      <Siren size={28} color="#ffffff" />
    </Animated.View>
  );
};

const Stock: React.FC<{ icon: typeof Wheat; label: string; value: number; cap: number; color: string }> = ({ icon: Icon, label, value, cap, color }) => {
  const { c } = useTheme();
  return (
    <Card flat pad={12} style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon size={16} color={color} />
        <Txt f="semibold" size={14} color={c.muc2}>
          {label}
        </Txt>
      </View>
      <Txt f="displayHeavy" size={21} accessibilityLabel={`${label}: ${value} trên ${cap}`}>
        {fmt(value)}{' '}
        <Txt size={14} color={c.muc2}>
          / {fmt(cap)}
        </Txt>
      </Txt>
    </Card>
  );
};

// ---------------------------------------------------------------------- công trình trên bàn
const BuildingButton: React.FC<{ def: BuildingDef; now: number; board: number; onOpen: () => void }> = ({ def, now, board, onOpen }) => {
  const { state } = useGame();
  const { c } = useTheme();
  const b = state.buildings[def.id];
  const upgrading = b.upgradeEnds !== null && b.upgradeEnds > now;
  const ready = def.id === 'ruong' ? farmReady(state, now) : 0;
  const full = def.id === 'ruong' && ready >= farmCap(b.level) * 0.5;
  const bob = useBob(def.id === 'ruong' && ready >= 20 && !upgrading, 3);
  const w = (board * def.pos.w) / 100;
  const h = (board * def.pos.h) / 100;
  let badge: React.ReactNode = null;
  if (upgrading) badge = <Chip text={fmtClock(((b.upgradeEnds ?? now) - now) / 1000)} icon={Clock} bg={c.the} fg={c.muc} style={{ borderWidth: 2, borderColor: c.vien }} />;
  else if (b.level === 0) badge = <Chip text="Xây" icon={Hammer} bg={c.dong} fg="#1c1917" />;
  else if (def.id === 'ruong' && ready >= 5) badge = <Chip text={`+${fmt(ready)}`} icon={Wheat} bg={c.ngoc} fg="#ffffff" />;
  const label = `${def.name}, ${b.level === 0 ? 'chưa xây' : `cấp ${b.level}`}${upgrading ? ', đang nâng cấp' : ''}${def.id === 'ruong' && ready ? `, có ${ready} Lương Thảo chờ thu` : ''}`;
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        position: 'absolute', left: `${def.pos.x}%`, top: `${def.pos.y}%`, width: `${def.pos.w}%`, height: `${def.pos.h}%`, alignItems: 'center', justifyContent: 'flex-end',
        transform: [{ translateY: pressed ? 1 : 0 }, { scale: pressed ? 0.98 : 1 }],
      })}
    >
      <View style={{ opacity: upgrading ? 0.8 : 1 }}>
        <BuildingSprite id={def.id} level={b.level} full={full} size={Math.min(w, h * 1.2 - 16)} />
      </View>
      <View style={{ marginTop: -6, paddingHorizontal: 8, paddingVertical: 1, borderRadius: 999, backgroundColor: c.the, borderWidth: 2, borderColor: c.vien, maxWidth: w + 20 }}>
        <Txt f="bold" size={board < 380 ? 10 : 12} numberOfLines={1}>
          {def.name}
          {b.level > 0 ? <Txt f="bold" size={board < 380 ? 10 : 12} color={c.dongChu}>{` · ${b.level}`}</Txt> : null}
        </Txt>
      </View>
      {badge && <Animated.View style={[{ position: 'absolute', top: -6 }, bob]}>{badge}</Animated.View>}
    </Pressable>
  );
};

// ---------------------------------------------------------------------- bảng chi tiết công trình
const BuildingSheet: React.FC<{ id: BuildingId | null; now: number; onClose: () => void; onGoto: (tab: GameTab, sub?: string) => void }> = ({ id, now, onClose, onGoto }) => {
  const { state, update, progress, spendGems, toast, bumpDaily } = useGame();
  const { c } = useTheme();
  const [quiz, setQuiz] = useState(false);
  const def = id ? BUILDING_BY_ID[id] : null;
  if (!def) return null;
  const b = state.buildings[def.id];
  const upgrading = b.upgradeEnds !== null && b.upgradeEnds > now;
  const toLevel = b.level + 1;
  const maxed = b.level >= def.maxLevel;
  const cost = b.level === 0 ? { luong: def.buildCost, gems: 0 } : upgradeCost(def, toLevel);
  const canPay = state.luong >= cost.luong && progress.gems >= cost.gems;
  const ready = def.id === 'ruong' ? farmReady(state, now) : 0;
  const storeLeft = storeCap(state.buildings.kho.level) - state.luong;
  const buildSeconds = b.level === 0 ? 20 : UPGRADE_SECONDS[Math.min(5, toLevel)];

  const startUpgrade = async () => {
    if (cost.gems > 0 && !(await spendGems(cost.gems, `nang_cap:${def.id}:${toLevel}`))) return;
    update((s) => ({ ...s, luong: Math.max(0, s.luong - cost.luong), buildings: { ...s.buildings, [def.id]: { ...s.buildings[def.id], upgradeEnds: Date.now() + buildSeconds * 1000 } } }));
    toast(b.level === 0 ? `Bắt đầu xây ${def.name}` : `Bắt đầu nâng ${def.name} lên cấp ${toLevel}`);
  };

  const harvest = () => {
    const take = Math.min(ready, Math.max(0, storeLeft));
    if (take <= 0) return toast(storeLeft <= 0 ? 'Kho Bí Mật đã đầy – hãy nâng cấp kho' : 'Ruộng chưa có lúa chín');
    const rate = farmRate(b.level);
    update((s) => ({
      ...s,
      luong: s.luong + take,
      buildings: { ...s.buildings, ruong: { ...s.buildings.ruong, lastCollect: take >= ready ? Date.now() : s.buildings.ruong.lastCollect + (take / rate) * 3_600_000 } },
      stats: { ...s.stats, harvests: s.stats.harvests + 1 },
    }));
    bumpDaily('harvest');
    toast(`Thu hoạch +${fmt(take)} Lương Thảo`);
  };

  const trade = (luong: number, effect: (s: GameState) => GameState, msg: string) => {
    if (state.luong < luong) return toast('Chưa đủ Lương Thảo');
    update((s) => effect({ ...s, luong: s.luong - luong }));
    toast(msg);
  };
  const quanCap = troopCap(state.buildings.trai.level);
  const batch = 5 * state.buildings.trai.level;

  return (
    <Sheet
      open={!!id}
      onClose={quiz ? () => setQuiz(false) : onClose}
      wide={quiz}
      title={quiz ? `${b.level === 0 ? 'Xây' : 'Nâng cấp'} ${def.name}` : def.name}
      subtitle={quiz ? 'Trả lời đúng để bắt đầu thi công' : b.level === 0 ? 'Chưa xây' : `Cấp ${b.level}/${def.maxLevel} · ${def.levelText(b.level)}`}
      icon={<BuildingSprite id={def.id} level={Math.max(1, b.level)} size={64} />}
    >
      {quiz ? (
        <QuizPanel
          request={{ units: [def.unit], count: 1 }}
          passMark={1}
          sessionKind={null}
          finishLabel="Tiếp tục"
          onClose={() => setQuiz(false)}
          onFinish={(sum) => {
            if (sum.passed) startUpgrade();
            else toast('Chưa trả lời đúng – công trình chưa được thi công. Thử lại nhé!');
          }}
        />
      ) : (
        <>
        <Txt>{def.desc}</Txt>

        {def.id === 'ruong' && b.level > 0 && (
          <Card flat style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Txt f="semibold" color={c.muc2}>
                Lúa chín chờ thu
              </Txt>
              <Txt f="displayHeavy" size={21} color={c.ngocChu}>
                {fmt(ready)} / {fmt(farmCap(b.level))}
              </Txt>
            </View>
            <Bar value={ready} max={farmCap(b.level)} label="Lúa chín trên ruộng" />
            <Btn title="Thu hoạch" icon={Wheat} tone="ngoc" size="lg" full disabled={ready < 1} onPress={harvest} />
            <InfoNote>Ruộng vẫn sinh lúa khi em tắt máy, tối đa 8 giờ sản lượng. Thời bình binh lính về làm ruộng – đó là “ngụ binh ư nông”.</InfoNote>
          </Card>
        )}

        {def.id === 'trai' && b.level > 0 && (
          <Card flat style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Txt f="semibold" color={c.muc2}>
                Quân Lực
              </Txt>
              <Txt f="displayHeavy" size={21}>
                {fmt(state.quan)} / {fmt(quanCap)}
              </Txt>
            </View>
            <Btn
              title={`Gọi ${batch} Quân Lực (${batch * 10} Lương Thảo)`}
              icon={Shield}
              full
              disabled={state.quan >= quanCap}
              onPress={() => trade(batch * 10, (s) => ({ ...s, quan: Math.min(quanCap, s.quan + batch) }), `Đã gọi ${batch} Quân Lực ra trận`)}
            />
            <Btn title="Gọi Dân binh Ngụ Binh (60 Lương Thảo)" icon={Users} tone="giay" full onPress={() => trade(60, (s) => ({ ...s, cards: { ...s.cards, dan_binh: (s.cards.dan_binh ?? 0) + 1 } }), 'Nhận thẻ Dân binh Ngụ Binh')} />
            {state.heroes.quan_sat_that && (
              <Btn
                title="Huấn luyện Quân Sát Thát (120 Lương Thảo)"
                icon={BicepsFlexed}
                tone="giay"
                full
                onPress={() => trade(120, (s) => ({ ...s, cards: { ...s.cards, quan_sat_that: (s.cards.quan_sat_that ?? 0) + 1 } }), 'Nhận thẻ Quân Sát Thát')}
              />
            )}
            <Txt size={14} color={c.muc2}>
              Thẻ đang có: Dân binh ×{state.cards.dan_binh ?? 0}
              {state.heroes.quan_sat_that ? ` · Quân Sát Thát ×${state.cards.quan_sat_that ?? 0}` : ''}
            </Txt>
          </Card>
        )}

        {def.id === 'kho' && (
          <Card flat style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Txt f="semibold" color={c.muc2}>
                Lương Thảo trong kho
              </Txt>
              <Txt f="displayHeavy" size={21}>
                {fmt(state.luong)} / {fmt(storeCap(b.level))}
              </Txt>
            </View>
            <Bar value={state.luong} max={storeCap(b.level)} fill={c.dong} label="Lương Thảo trong kho" />
            <InfoNote>Khi giặc kéo đến cướp lương, chọn “Vườn không nhà trống” để giấu hết lương vào kho – giặc vào điền trang trống sẽ kiệt sức mà rút.</InfoNote>
          </Card>
        )}

        {def.id === 'xuong' && (
          <View style={{ gap: 8 }}>
            {['Cọc gỗ đẽo nhọn', 'Cọc gỗ đầu bịt sắt', 'Trận địa cọc kết hợp mai phục (4/1288)'].map((t, i) => (
              <Card key={t} flat pad={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, opacity: b.level >= i + 1 ? 1 : 0.6 }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: b.level >= i + 1 ? c.dong : c.giay2 }}>
                  <Txt f="bold" color={b.level >= i + 1 ? '#1c1917' : c.muc3}>
                    {i + 1}
                  </Txt>
                </View>
                <Txt f="semibold" style={{ flex: 1 }}>
                  {t}
                </Txt>
                {b.level >= i + 1 && <Check size={20} color={c.ngocChu} accessibilityLabel="Đã có" />}
              </Card>
            ))}
            <InfoNote>Cấp xưởng càng cao, tuyệt chiêu “Đại trận Bạch Đằng” càng mạnh (Màn 3).</InfoNote>
          </View>
        )}

        {def.id === 'ben' && b.level > 0 && (
          <Card flat style={{ gap: 8 }}>
            <Btn title="Gọi Thủy binh (80 Lương Thảo)" icon={Sailboat} tone="giay" full onPress={() => trade(80, (s) => ({ ...s, cards: { ...s.cards, thuy_binh: (s.cards.thuy_binh ?? 0) + 1 } }), 'Nhận thẻ Thủy binh')} />
            <Txt size={14} color={c.muc2}>
              Thẻ Thủy binh: ×{state.cards.thuy_binh ?? 0}. Nâng bến lên cấp 3 để nhận cổ vật Nón Ma Lôi.
            </Txt>
          </Card>
        )}

        {(def.id === 'doanh' || def.id === 'hoiquan' || def.id === 'qtg') && b.level > 0 && (
          <Btn
            title={def.id === 'qtg' ? 'Vào Quốc Tử Giám' : def.id === 'hoiquan' ? 'Vào Hội Quán Vạn Kiếp' : 'Vào Doanh Trại'}
            iconRight={ChevronRight}
            tone="ngoc"
            size="lg"
            full
            onPress={() => {
              onClose();
              onGoto(def.id === 'qtg' ? 'exam' : 'barracks', def.id === 'hoiquan' ? 'recruit' : 'heroes');
            }}
          />
        )}

        <Inset pad={16} style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ArrowUpCircle size={20} color={c.dongChu} />
            <Txt f="display" size={18}>
              {maxed ? 'Đã đạt cấp tối đa' : b.level === 0 ? 'Xây công trình' : `Nâng lên cấp ${toLevel}`}
            </Txt>
          </View>
          {upgrading ? (
            <View style={{ gap: 8 }}>
              <Txt f="semibold">Đang thi công · còn {fmtClock(((b.upgradeEnds ?? now) - now) / 1000)}</Txt>
              <Bar value={1 - ((b.upgradeEnds ?? now) - now) / (buildSeconds * 1000)} max={1} fill={c.dong} label="Tiến độ thi công" />
            </View>
          ) : (
            !maxed && (
              <>
                <Txt size={14} color={c.muc2}>
                  {def.levelText(toLevel)}
                </Txt>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <Chip text={`${fmt(cost.luong)} Lương Thảo`} icon={Wheat} bg={state.luong >= cost.luong ? c.the : c.sonNhat} fg={state.luong >= cost.luong ? c.muc : c.sonChu} />
                  {cost.gems > 0 && <Chip text={`${cost.gems} Ấn Tín`} icon={Stamp} bg={progress.gems >= cost.gems ? c.the : c.sonNhat} fg={progress.gems >= cost.gems ? c.muc : c.sonChu} />}
                  <Chip text={fmtClock(buildSeconds)} icon={Clock} bg={c.the} fg={c.muc2} />
                </View>
                <Btn title={`Trả lời 1 câu để ${b.level === 0 ? 'xây' : 'nâng cấp'}`} icon={Hammer} tone="dong" size="lg" full disabled={!canPay} onPress={() => setQuiz(true)} />
                {!canPay && (
                  <Txt f="semibold" size={14} color={c.sonChu}>
                    Chưa đủ tài nguyên. Thu hoạch ruộng hoặc trả lời đúng ở Quốc Tử Giám để có thêm.
                  </Txt>
                )}
              </>
            )
          )}
        </Inset>
        </>
      )}
    </Sheet>
  );
};

// ---------------------------------------------------------------------- nhiệm vụ hôm nay
const DailyPanel: React.FC = () => {
  const { state, update, toast } = useGame();
  const { c } = useTheme();
  const tasks = dailyTasksFor(state.daily.day);
  const claim = (t: DailyTaskDef) => {
    update((s) => ({
      ...s,
      luong: Math.min(storeCap(s.buildings.kho.level), s.luong + t.reward.luong),
      quan: Math.min(troopCap(s.buildings.trai.level), s.quan + t.reward.quan),
      daily: { ...s.daily, claimed: [...s.daily.claimed, t.id] },
    }));
    toast(`Nhận thưởng: +${t.reward.luong} Lương Thảo, +${t.reward.quan} Quân Lực`);
  };
  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <Txt f="displayHeavy" size={18} accessibilityRole="header">
          Nhiệm vụ hôm nay
        </Txt>
        <Chip text={`${state.daily.claimed.length}/${tasks.length} đã nhận`} bg={c.giay2} fg={c.muc2} />
      </View>
      {tasks.map((t) => {
        const value = Math.min(t.target, state.daily.progress[t.metric] ?? 0);
        const done = value >= t.target;
        const claimed = state.daily.claimed.includes(t.id);
        const Icon = t.Icon;
        return (
          <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? c.ngoc : c.giay2 }}>
              <Icon size={20} color={done ? '#ffffff' : c.muc2} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Txt f="semibold" size={14}>
                {t.text}
              </Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Bar value={value} max={t.target} height={8} style={{ flex: 1 }} label={t.text} />
                <Txt f="bold" size={12} color={c.muc2}>
                  {value}/{t.target}
                </Txt>
              </View>
            </View>
            {claimed ? <Chip text="Đã nhận" icon={Check} bg={c.ngocNhat} fg={c.ngocChu} /> : <Btn title="Nhận" icon={Gift} tone="dong" size="sm" disabled={!done} label={`Nhận thưởng: ${t.text}`} onPress={() => claim(t)} />}
          </View>
        );
      })}
    </Card>
  );
};

// ---------------------------------------------------------------------- giặc cướp lương
const RaidEvent: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const { state, update, toast, fetchQuestions, sound, finishSession } = useGame();
  const { c } = useTheme();
  const [stage, setStage] = useState<'alarm' | 'question' | 'result'>('alarm');
  const [mode, setMode] = useState<'vuon_khong' | 'chan' | null>(null);
  const [q, setQ] = useState<ServedQuestion | null>(null);
  const [outcome, setOutcome] = useState<{ title: string; text: string; delta: number; good: boolean } | null>(null);
  const [seconds, setSeconds] = useState(30);
  const [stamina, setStamina] = useState(100);
  const lastCorrect = useRef(false);
  const timed = state.settings.timer;

  const resolve = useCallback(
    (m: 'vuon_khong' | 'chan' | null, correct: boolean) => {
      const luong = state.luong;
      let delta: number;
      let title: string;
      let text: string;
      let good = false;
      if (m === 'vuon_khong' && correct) {
        delta = Math.max(20, Math.round(luong * 0.1));
        title = 'Giặc đói kiệt, phải rút lui!';
        text = 'Toàn bộ lương đã vào Kho Bí Mật. Giặc vào điền trang trống, không cướp được gì nên kiệt sức mà rút. Em nhận thêm phần thưởng.';
        good = true;
      } else if (m === 'vuon_khong') {
        delta = -Math.round(luong * 0.05);
        title = 'Giấu được một nửa số lương';
        text = 'Chưa trả lời đúng nên chỉ kịp giấu 50% lương vào kho. Giặc cướp được một ít rồi rút đi.';
      } else if (m === 'chan' && correct) {
        delta = Math.round(luong * 0.05);
        title = 'Đánh chặn thành công!';
        text = 'Quân ta chặn đánh, giặc không cướp được lương.';
        good = true;
      } else {
        delta = -Math.round(luong * 0.1);
        title = 'Giặc cướp được một ít lương';
        text = m ? 'Đánh chặn chưa thành công.' : 'Không kịp ứng phó.';
      }
      update((s) => ({ ...s, luong: Math.max(0, s.luong + delta), raid: { sessions: 0, lastDay: todayKey() } }));
      setOutcome({ title, text, delta, good });
      setStage('result');
      sound(good ? 'win' : 'bad');
    },
    [state.luong, update, sound],
  );

  useEffect(() => {
    if (!timed || stage !== 'alarm') return;
    if (seconds <= 0) {
      resolve(null, false);
      return;
    }
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds, stage, timed, resolve]);

  useEffect(() => {
    if (stage !== 'result' || !outcome?.good || mode !== 'vuon_khong') return;
    const t = setInterval(() => setStamina((s) => Math.max(0, s - 10)), 140);
    return () => clearInterval(t);
  }, [stage, outcome, mode]);

  const choose = (m: 'vuon_khong' | 'chan') => {
    setMode(m);
    setStage('question');
    fetchQuestions({ units: m === 'vuon_khong' ? ['KC1_VUON_KHONG_NHA_TRONG'] : ['KC1_OVERVIEW', 'KC1_DONG_BO_DAU', 'CAUSES_OF_VICTORY'], count: 1 })
      .then((res) => setQ(res.questions[0] ?? null))
      .catch(() => {
        toast('Không tải được câu hỏi');
        setStage('alarm');
      });
  };

  return (
    <Sheet
      open
      persistent={stage !== 'result'}
      onClose={onDone}
      wide
      title="Báo động! Giặc kéo đến cướp lương"
      subtitle={stage === 'result' ? 'Kết quả ứng phó' : 'Quân xâm lược đi xa, phải dựa vào lương cướp tại chỗ.'}
      icon={<AlarmIcon />}
    >
      {stage === 'alarm' && (
        <>
          <View style={{ height: 96, borderRadius: 18, overflow: 'hidden', backgroundColor: c.giay2 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <BattleBackdrop bg="plain" dark={false} />
            <View style={{ position: 'absolute', top: 0, bottom: 0, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: c.dich, alignItems: 'center', justifyContent: 'center' }}>
                  <ChessKnight size={26} color="#ffffff" />
                </View>
              ))}
            </View>
          </View>
          {timed && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} accessibilityLiveRegion="polite">
              <Bar value={seconds} max={30} fill={seconds <= 10 ? c.son : c.dong} style={{ flex: 1 }} label="Thời gian ứng phó" />
              <Txt f="displayHeavy" size={20} style={{ width: 52, textAlign: 'right' }}>
                {seconds}s
              </Txt>
            </View>
          )}
          <Txt f="semibold">
            Giặc sắp đến Điền Trang. Trong kho có <Txt f="bold">{fmt(state.luong)}</Txt> Lương Thảo. Em chọn cách ứng phó:
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <PressCard onPress={() => choose('vuon_khong')} label="Vườn không nhà trống" hint="Giấu hết lương vào Kho Bí Mật. Trả lời 1 câu." style={{ flexGrow: 1, flexBasis: 240, gap: 6 }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: c.ngoc, alignItems: 'center', justifyContent: 'center' }}>
                <Warehouse size={24} color="#ffffff" />
              </View>
              <Txt f="displayHeavy" size={18}>
                Vườn không nhà trống
              </Txt>
              <Txt size={14} color={c.muc2}>
                Giấu hết lương vào Kho Bí Mật. Trả lời 1 câu “Vì sao…?”.
              </Txt>
            </PressCard>
            <PressCard onPress={() => choose('chan')} label="Đánh chặn" hint="Ra quân chặn giặc. Trả lời 1 câu." style={{ flexGrow: 1, flexBasis: 240, gap: 6 }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: c.son, alignItems: 'center', justifyContent: 'center' }}>
                <Swords size={24} color="#ffffff" />
              </View>
              <Txt f="displayHeavy" size={18}>
                Đánh chặn
              </Txt>
              <Txt size={14} color={c.muc2}>
                Ra quân chặn giặc. Trả lời 1 câu để thắng trận phòng thủ ngắn.
              </Txt>
            </PressCard>
          </View>
          <InfoNote>Tệ nhất em chỉ mất 10% Lương Thảo. Không mất tướng, không mất công trình.</InfoNote>
        </>
      )}
      {stage === 'question' &&
        (q ? (
          <QuestionCard
            q={q}
            index={0}
            total={1}
            timerSec={null}
            nextLabel="Xem kết quả"
            onAnswered={(r) => {
              lastCorrect.current = r.correct;
              finishSession('raid', r.correct ? 1 : 0, 1);
            }}
            onNext={() => resolve(mode, lastCorrect.current)}
          />
        ) : (
          <Spinner label="Đang chuẩn bị câu hỏi…" />
        ))}
      {stage === 'result' && outcome && (
        <View style={{ gap: 12, alignItems: 'center' }}>
          {mode === 'vuon_khong' && outcome.good && (
            <Card flat style={{ gap: 6, alignSelf: 'stretch' }}>
              <Txt f="semibold" color={c.muc2}>
                Sức bền của giặc
              </Txt>
              <Bar value={stamina} max={100} fill={c.son} height={16} label="Sức bền của giặc" />
              <Txt size={14} color={c.muc2}>
                Không cướp được lương, giặc tụt sức bền rồi phải rút.
              </Txt>
            </Card>
          )}
          <Mascot size={100} mood={outcome.good ? 'excited' : 'sad'} accessory={outcome.good ? 'helmet' : 'none'} />
          <Txt f="displayHeavy" size={24} center accessibilityRole="header">
            {outcome.title}
          </Txt>
          <Txt color={c.muc2} center>
            {outcome.text}
          </Txt>
          <Txt f="displayHeavy" size={21} color={outcome.delta >= 0 ? c.ngocChu : c.sonChu}>
            {outcome.delta >= 0 ? '+' : ''}
            {fmt(outcome.delta)} Lương Thảo
          </Txt>
          <Inset pad={16} style={{ alignSelf: 'stretch', gap: 4 }}>
            <Txt f="display" size={16}>
              Bài học lịch sử
            </Txt>
            <Txt>
              Quân xâm lược đi xa, phải dựa vào lương cướp tại chỗ và đoàn vận lương. Khi nhân dân thực hiện “vườn không nhà trống”, giặc không cướp được lương nên kiệt sức và buộc phải rút – như ở Thăng Long
              năm 1258.
            </Txt>
          </Inset>
          <Btn title="Về Điền Trang" icon={Check} tone="ngoc" size="lg" full onPress={onDone} />
        </View>
      )}
    </Sheet>
  );
};
