/**
 * Trang học sinh "Binh thư Sát Thát" (25/11/2026, theo bản vẽ người dùng gửi) – các màn của thanh điều hướng:
 *   1. Doanh trại (màn 1): lời chào, chặng đang học với vòng 5 bước và nút đi tiếp, nhiệm vụ hôm nay, gợi ý riêng của Tiểu Tướng, chiến dịch của khối, chuỗi ngày.
 *   2. Chiến dịch (màn 2): bốn khối 6–9, mỗi khối một chiến dịch không trùng nội dung (dải tối ghi vai, mức nhận thức, số câu, số trận, phần thưởng khi xong);
 *      danh sách chặng có hòm báu xen giữa; nút "Bản đồ gốc" giữ bản đồ Wikipedia kiểu sa bàn của ba cuộc kháng chiến (Khối 6–8).
 *   3. Quân lệnh (màn 3, bước 1/5 của chặng): lời giao nhiệm vụ (lời dẫn của trò chơi), mục tiêu, năm bước, phần thưởng, nút vào bước tiếp theo.
 *   4. Bảng vàng (màn 4): giải đấu tuần, bảng lớp / toàn trường, so với tuần trước (▲ / ▼ hạng), thang Khoa bảng, huy hiệu.
 * Mọi điểm, sao, phần thưởng và việc mở khóa do máy chủ quyết định (/api/saga, /api/game); ở đây chỉ gửi lệnh và vẽ lại. Mục "Nhập vai" (thế giới khối 3D) là phần thêm.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, Platform, Pressable, ScrollView, Switch, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import {
  ArrowDown, ArrowUp, Award, BookOpen, Box, Check, ChevronRight, Flame, Lock, Map as MapIcon, Maximize2, Minus, ScrollText, Swords, Target, Trophy, Users, ZoomIn, ZoomOut,
} from 'lucide-react-native';
import * as saga from '@/lib/saga-api';
import * as game from '@/api/gameApi';
import { Mascot } from '@/components/art';
import { RolePlayLobby } from '@/components/portal/RolePlayLobby';
import type { Session } from '@/components/auth';
import { LoadState, Portrait, RARITY, STATE, StarRow, mapSource, num, useLoad, type SagaNav, type SagaStep } from '@/components/portal/SagaKit';
import { ChestArt, ChestOpening } from '@/components/portal/SagaChest';
import { FramedAvatar, TitleBadge } from '@/components/portal/SagaLook';
import {
  BtBar, BtButton, BtCard, BtPage, Columns, Eyebrow, Pill, SegTabs, SerifTitle, StatTile, StepDots, StepHeader, TtSays, useBT,
} from '@/components/portal/StudentDesign';
import { VnScene } from '@/components/portal/StudentArt';
import { Btn, Spinner, Txt, useToast } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { IconType } from '@/types/game';
import type { BadgeItem, Board, LeagueView } from '@/types/gamification';
import type { BattleMode, CampaignView, GradeSummary, GradeView, SagaChest, SagaMapInfo, StageBrief, StageDetail, StepState } from '@/types/saga';

// ---------------------------------------------------------------------- dùng chung
/** Bước tiếp theo của chặng → màn của bước đó (bước 2–5); bước 1 là Quân lệnh */
export const NEXT_STEP: Record<'lesson' | 'practice' | 'battle' | 'summary', { v: SagaStep; label: string; n: number }> = {
  lesson: { v: 'tham-su', label: 'Thám sử', n: 2 }, practice: { v: 'hoi-dong', label: 'Hội đồng quân sự', n: 3 },
  battle: { v: 'xuat-tran', label: 'Xuất trận', n: 4 }, summary: { v: 'su-quan', label: 'Sử quan tổng kết', n: 5 },
};
const MODE_TEXT: Record<BattleMode, string> = { tactics: 'Trận chiến thuật', bachdang: 'Trận Bạch Đằng', council: 'Trận hội đồng' };
type Dot = 'done' | 'now' | 'todo' | 'none';
/** Năm vạch tiến độ của chặng: Quân lệnh, Thám sử, Hội đồng, Xuất trận (không có trận thì vạch rỗng), Sử quan */
export function stepDots(steps: StageBrief['steps']): Dot[] {
  const map = (s: StepState, k: string): Dot => (s === 'done' ? 'done' : s === 'none' ? 'none' : steps.next === k ? 'now' : 'todo');
  return [steps.order === 'done' ? 'done' : 'todo', map(steps.lesson, 'lesson'), map(steps.practice, 'practice'), map(steps.battle, 'battle'), map(steps.summary, 'summary')];
}
/** Màn nên mở khi bấm vào một chặng: chặng chưa bắt đầu hoặc đã xong → Quân lệnh (xem lại / chơi lại từng bước); đang dở → bước tiếp theo */
function entryOf(st: { state: StageBrief['state']; steps: StageBrief['steps'] }): SagaStep {
  if (st.state === 'ready' || st.state === 'done' || st.state === 'review' || !st.steps.next) return 'quan-lenh';
  return NEXT_STEP[st.steps.next].v;
}
/** Nhãn trạng thái chặng theo màu của giao diện (luôn có chữ, không chỉ dựa vào màu) */
const StatePill: React.FC<{ state: StageBrief['state'] }> = ({ state }) => {
  const t = useBT();
  const look: Record<StageBrief['state'], { bg: string; fg: string }> = {
    locked: { bg: t.card2, fg: t.muted }, ready: { bg: t.tealSoft, fg: t.teal }, learning: { bg: t.goldSoft, fg: t.goldInk }, done: { bg: t.greenSoft, fg: t.green }, review: { bg: t.dangerSoft, fg: t.danger },
  };
  return <Pill text={STATE[state].label} bg={look[state].bg} fg={look[state].fg} strong />;
};

// ---------------------------------------------------------------------- 1. Doanh trại
/**
 * Doanh trại: lời chào + chỉ số (chuỗi ngày, vàng), thẻ chặng đang học (5 vạch bước, nút đi tiếp), nhiệm vụ hôm nay, gợi ý Luyện binh riêng của Tiểu Tướng,
 * chiến dịch của khối em, chuỗi ngày và mốc thưởng kế tiếp. Máy rộng: hai cột.
 */
export const HomeScreen: React.FC<{ session: Session; nav: SagaNav; loading: boolean; error: string | null; className: string | null; onRetry: () => void }> = ({ session, nav, loading, error, className, onRetry }) => {
  const t = useBT();
  const { width } = useWindowDimensions();
  const home = nav.home;
  if (!home) return <BtPage testID="saga-home"><LoadState loading={loading} error={error} onRetry={onRetry} /></BtPage>;
  const look = home.look;
  const next = home.next;
  const myGrade = home.grade ?? home.grades.find((g) => g.state === 'current')?.grade ?? home.grades[0]?.grade ?? 6;
  const gradeInfo = home.grades.find((g) => g.grade === myGrade) ?? null;
  const nextMilestone = home.streak.milestones.find((m) => !m.reached) ?? null;
  const go = (v: SagaStep): void => { if (next) nav.go('chien-dich', { c: next.grade, s: next.stage_id, v }); };
  const firstName = home.learner.name.split(/\s+/).filter(Boolean).slice(-1)[0] ?? home.learner.name;

  const greet = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} testID="home-greet">
      <Pressable onPress={() => nav.go('ho-so')} accessibilityRole="button" accessibilityLabel="Mở Hồ sơ của em" style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}>
        <FramedAvatar name={session.user.full_name} uri={session.user.avatar_url} size={46} frame={look?.frame} preset={look?.avatar} flag={look?.flag} testID="home-avatar" />
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Eyebrow text={`Doanh trại${className ? ` · Lớp ${className}` : ''}`} />
          <Pressable onPress={() => nav.go('lop-hoc')} accessibilityRole="link" accessibilityLabel="Đổi lớp: mở trang Lớp học" hitSlop={12} testID="home-classes">
            <Txt f="heavy" size={11.5} color={t.teal} style={{ textDecorationLine: 'underline' }}>Đổi lớp</Txt>
          </Pressable>
        </View>
        <SerifTitle size={width < 400 ? 21 : 24}>Chào {firstName}, sẵn sàng ra quân?</SerifTitle>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
          <Pill text={`Khoa bảng: ${home.rank.name}`} bg={t.goldSoft} fg={t.goldInk} strong />
          {look?.title ? <TitleBadge title={look.title} /> : null}
        </View>
      </View>
    </View>
  );
  const stats = (
    <View style={{ flexDirection: 'row', gap: 8 }} testID="home-stats">
      <StatTile value={`${home.hud.streak.current} ngày`} label="Chuỗi học" color={t.accent} onPress={() => nav.go('ho-so')} testID="home-streak" />
      <StatTile value={num(home.hud.gold)} label="Vàng · Chợ phiên" color={t.goldInk} onPress={() => nav.go('cua-hang')} testID="home-gold" />
      <StatTile value={`Cấp ${home.hud.level.level}`} label={`${num(home.hud.xp)} KN`} onPress={() => nav.go('ho-so')} testID="home-level" />
    </View>
  );
  const hero = next ? (
    <BtCard tone="hero" pad={16} testID="home-next">
      <Eyebrow text={`Chặng đang học · Khối ${next.grade ?? myGrade} · Chặng ${next.order}/${next.of}`} color={t.gold} />
      <SerifTitle size={23} color={t.onHero}>{next.title}</SerifTitle>
      <Txt size={13} color={t.onHeroMuted}>{[next.place, next.date_label].filter(Boolean).join(' · ')}</Txt>
      <StepDots states={stepDots(next.steps)} label={`Tiến độ 5 bước của chặng ${next.title}`} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {['Quân lệnh', 'Thám sử', 'Hội đồng', 'Xuất trận', 'Sử quan'].map((s, i) => {
          const d = stepDots(next.steps)[i];
          return <Txt key={s} size={11} f={d === 'now' ? 'heavy' : 'semibold'} color={d === 'now' ? t.gold : t.onHeroMuted} style={{ flex: 1, textAlign: 'center', minWidth: 52 }}>{s}</Txt>;
        })}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <Pill text={`Thẻ Binh thư ${next.lore.have}/${next.lore.total}`} bg="rgba(255,255,255,0.14)" fg={t.onHero} />
        {next.battle_mode ? <Pill text={MODE_TEXT[next.battle_mode]} bg="rgba(255,255,255,0.14)" fg={t.onHero} /> : null}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <BtButton title={next.state === 'ready' ? 'Nhận quân lệnh' : next.steps.next ? `Tiếp tục: ${NEXT_STEP[next.steps.next].label}` : 'Vào chặng'} tone="gold" size="lg" iconRight={ChevronRight}
          onPress={() => go(entryOf(next))} style={{ flexGrow: 1 }} testID="home-continue" />
        {next.state !== 'ready' ? <BtButton title="Quân lệnh" tone="glass" onPress={() => go('quan-lenh')} testID="home-order" label="Xem lại Quân lệnh của chặng" /> : null}
      </View>
    </BtCard>
  ) : (
    <BtCard tone="hero" pad={16} testID="home-next">
      <Eyebrow text="Chiến dịch" color={t.gold} />
      <SerifTitle size={22} color={t.onHero}>Em đã đi hết các chặng đang mở</SerifTitle>
      <Txt size={13} color={t.onHeroMuted}>Đánh lại các trận để lấy đủ 3 sao, hoặc vào Luyện binh riêng để nhớ chắc.</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <BtButton title="Xem chiến dịch" tone="gold" onPress={() => nav.go('chien-dich', { c: myGrade })} testID="home-campaign" />
        <BtButton title="Luyện binh riêng" tone="glass" onPress={() => nav.go('luyen-binh')} testID="home-review" />
      </View>
    </BtCard>
  );
  const quests = (
    <BtCard testID="home-quests">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <ScrollText size={18} color={t.accent} />
        <Txt f="heavy" size={15} color={t.ink} style={{ flex: 1 }}>Nhiệm vụ hôm nay</Txt>
        <Txt size={12} color={t.muted}>{home.quests.filter((q) => q.done).length}/{home.quests.length} xong</Txt>
      </View>
      {home.quests.length ? home.quests.map((q) => (
        <View key={q.id} style={{ gap: 5 }} testID={`quest-${q.id}`}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: q.done ? t.green : 'transparent', borderWidth: q.done ? 0 : 1.5, borderColor: t.line2 }}>
              {q.done ? <Check size={13} color={t.dark ? '#0F1115' : '#FFFFFF'} strokeWidth={3} /> : null}
            </View>
            <Txt f="semibold" size={14} color={q.done ? t.muted : t.ink} style={{ flex: 1, textDecorationLine: q.done ? 'line-through' : 'none' }}>{q.title}</Txt>
            <Txt f="heavy" size={12} color={t.goldInk}>{[q.reward_gold ? `+${q.reward_gold} vàng` : '', q.reward_xp ? `+${q.reward_xp} KN` : ''].filter(Boolean).join(' · ')}</Txt>
          </View>
          {!q.done ? <BtBar value={q.target ? q.progress / q.target : 0} height={6} label={`${q.title}: ${q.progress}/${q.target}`} style={{ marginLeft: 30 }} /> : null}
        </View>
      )) : <Txt size={13} color={t.muted}>Hôm nay chưa có nhiệm vụ.</Txt>}
      <Txt size={11.5} color={t.muted}>Nhiệm vụ làm mới lúc 0 giờ mỗi ngày.</Txt>
    </BtCard>
  );
  const suggest = home.suggest ? (
    <TtSays testID="home-suggest">
      <Txt f="heavy" size={13} color={t.teal}>Tiểu Tướng gợi ý</Txt>
      <Txt size={13.5} color={t.ink} style={{ lineHeight: 20 }}>{home.suggest.text}</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
        <BtButton title={`Luyện binh riêng · ${home.suggest.size} câu`} size="sm" onPress={() => nav.go('luyen-binh')} testID="home-suggest-go" />
        <BtButton title="Hỏi Tiểu Tướng" size="sm" tone="ghost" onPress={() => nav.go('tieu-tuong')} testID="home-ask" />
      </View>
    </TtSays>
  ) : (
    <TtSays testID="home-suggest">
      <Txt f="heavy" size={13} color={t.teal}>Tiểu Tướng</Txt>
      <Txt size={13.5} color={t.ink} style={{ lineHeight: 20 }}>Có điều gì chưa rõ về các trận đánh thời Trần? Hỏi ta, ta trả lời kèm nguồn sử liệu.</Txt>
      <BtButton title="Hỏi Tiểu Tướng" size="sm" tone="ghost" onPress={() => nav.go('tieu-tuong')} style={{ alignSelf: 'flex-start', marginTop: 4 }} testID="home-ask" />
    </TtSays>
  );
  const campaign = gradeInfo ? (
    <BtCard testID="home-grade">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Eyebrow text={`Chiến dịch Khối ${gradeInfo.grade} · ${gradeInfo.role}`} color={t.muted} />
          <Txt f="heavy" size={15} color={t.ink} numberOfLines={2}>{gradeInfo.title}</Txt>
        </View>
        <Txt f="heavy" size={13} color={t.goldInk}>{gradeInfo.stars}/{gradeInfo.max_stars} sao</Txt>
      </View>
      <BtBar value={gradeInfo.stages ? gradeInfo.done / gradeInfo.stages : 0} label={`Đã xong ${gradeInfo.done}/${gradeInfo.stages} chặng`} />
      <Txt size={12.5} color={t.soft}>Đã xong {gradeInfo.done}/{gradeInfo.stages} chặng · {gradeInfo.reward}</Txt>
      <BtButton title="Mở bản chiến dịch" tone="ghost" size="sm" iconRight={ChevronRight} onPress={() => nav.go('chien-dich', { c: gradeInfo.grade })} testID="home-grade-open" />
    </BtCard>
  ) : null;
  const streak = (
    <BtCard tone="gold" testID="home-streak-card">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Flame size={24} color={t.accent} fill={home.streak.current ? t.accent : 'transparent'} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt f="heavy" size={15} color={t.ink}>{home.streak.current} ngày liên tiếp{home.streak.at_risk ? ' · hôm nay chưa học' : ''}</Txt>
          <Txt size={12.5} color={t.soft}>{nextMilestone ? `Còn ${Math.max(0, nextMilestone.days - home.streak.current)} ngày nữa: ${nextMilestone.label}` : 'Em đã đạt mọi mốc chuỗi ngày!'}</Txt>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 4 }} accessible accessibilityLabel="Bảy ngày gần nhất">
        {home.streak.week.map((d) => <View key={d.day} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: d.state === 'done' ? t.accent : d.state === 'freeze' ? t.bronze : t.line }} />)}
      </View>
    </BtCard>
  );
  return (
    <BtPage testID="saga-home" max={1180}>
      {greet}
      {width < 980 ? stats : null}
      <Columns left={<>{hero}{quests}</>} right={<>{width >= 980 ? stats : null}{suggest}{campaign}{streak}</>} />
    </BtPage>
  );
};

// ---------------------------------------------------------------------- 2. Chiến dịch theo khối
/** Một hòm báu xen giữa các chặng (chạm để mở khi sẵn sàng) */
const ChestRow: React.FC<{ box: SagaChest; onPress: () => void }> = ({ box, onPress }) => {
  const t = useBT();
  const big = box.kind === 'part';
  const text = box.state === 'opened' ? 'Đã mở' : box.state === 'ready' ? `Hòm bí ẩn – chạm để mở${box.max_gold ? ` (tới ${box.max_gold} vàng)` : ''}` : big ? 'Xong mọi chặng của chiến dịch để mở' : `Xong chặng ${box.after} để mở`;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" testID={`chest-${box.key}`} accessibilityLabel={`${big ? 'Hòm báu cuối chiến dịch' : `Hòm báu sau chặng ${box.after}`}: ${text}`}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, marginLeft: 22, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed',
        borderColor: box.state === 'ready' ? t.bronze : t.line2, backgroundColor: box.state === 'ready' ? t.goldSoft : 'transparent', opacity: pressed ? 0.85 : 1 })}>
      <ChestArt size={big ? 40 : 32} state={box.state} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt f="heavy" size={13} color={t.ink}>{big ? 'Hòm báu cuối chiến dịch' : 'Hòm báu'}</Txt>
        <Txt size={12} color={box.state === 'ready' ? t.goldInk : t.muted}>{text}</Txt>
      </View>
      {box.state === 'ready' ? <Pill text="Mở" bg={t.gold} fg="#2A1D14" strong /> : box.state === 'opened' ? <Check size={16} color={t.green} /> : <Lock size={15} color={t.muted} />}
    </Pressable>
  );
};

/** Một hàng chặng trong chiến dịch: số thứ tự, tên, nơi – thời gian, trạng thái, sao, kiểu trận, thẻ Binh thư */
const StageRow: React.FC<{ st: StageBrief; current: boolean; onPress: () => void }> = ({ st, current, onPress }) => {
  const t = useBT();
  const locked = st.state === 'locked';
  const done = st.state === 'done' || st.state === 'review';
  return (
    <Pressable onPress={onPress} accessibilityRole="button" testID={`stage-${st.code}`}
      accessibilityLabel={`Chặng ${st.order}: ${st.title}, ${st.date_label}. ${STATE[st.state].label}${st.stars ? `, ${st.stars} sao` : ''}${st.lock_reason ? `. ${st.lock_reason}` : ''}`}
      style={({ pressed }) => ({ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12, borderRadius: 16, borderWidth: current ? 2 : 1, borderColor: current ? t.accent : t.line,
        backgroundColor: locked ? t.card2 : t.card, opacity: pressed ? 0.88 : locked ? 0.8 : 1 })}>
      <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? t.green : current ? t.accent : locked ? t.seg : t.goldSoft }}>
        {done ? <Check size={20} color={t.dark ? '#0F1115' : '#FFFFFF'} strokeWidth={3} /> : locked ? <Lock size={17} color={t.muted} /> : <Txt f="heavy" size={17} color={current ? t.onAccent : t.goldInk}>{st.order}</Txt>}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Txt f="heavy" size={15} color={t.ink} numberOfLines={2}>{st.title}</Txt>
        <Txt size={12.5} color={t.muted} numberOfLines={1}>{[st.place, st.date_label].filter(Boolean).join(' · ')}</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
          {current && !done ? <Pill text={st.state === 'ready' ? 'Bắt đầu' : 'Đang học'} bg={t.accent} fg={t.onAccent} strong /> : <StatePill state={st.state} />}
          {st.battle_mode ? <Pill text={MODE_TEXT[st.battle_mode]} /> : null}
          {st.lore.total ? <Pill text={`Thẻ ${st.lore.have}/${st.lore.total}`} /> : null}
          {st.review_due ? <Pill text={`${st.review_due} câu cần ôn`} bg={t.dangerSoft} fg={t.danger} /> : null}
        </View>
        {locked && st.lock_reason ? <Txt size={12} color={t.muted}>{st.lock_reason}</Txt> : null}
      </View>
      {st.stars > 0 ? <StarRow n={st.stars} size={14} /> : <ChevronRight size={18} color={t.muted} />}
    </Pressable>
  );
};

/** Bản đồ gốc của một cuộc kháng chiến (giữ từ bản cũ): các chặng của chiến dịch đó đặt trên ảnh bản đồ Wikipedia kiểu sa bàn */
const MapPart: React.FC<{ session: Session; no: number; currentId: number | null; onPick: (st: StageBrief) => void; onChest: (box: SagaChest, reload: () => void) => void }> = ({ session, no, currentId, onPick, onChest }) => {
  const t = useBT();
  const { height } = useWindowDimensions();
  const data = useLoad<CampaignView>(session, (tk) => saga.campaign(tk, no), [no]);
  const v = data.data;
  if (!v) return <LoadState loading={data.loading} error={data.error} onRetry={data.reload} />;
  return (
    <BtCard pad={12} testID={`unit-map-${no}`}>
      <Txt f="heavy" size={14} color={t.ink}>{v.map.title} ({v.map.years})</Txt>
      <SagaMap map={v.map} stages={v.stages} currentId={v.current_stage_id} selectedId={null} mascotId={currentId} onPick={onPick} maxHeight={Math.max(320, Math.min(720, height - 220))}
        chests={v.chests ?? []} onChest={(box) => onChest(box, data.reload)} />
      <Txt size={11.5} color={t.muted}>Ảnh bản đồ: {v.map.credit.replace(/[.\s]+$/, '')}. Bấm từng chặng trên bản đồ để mở Quân lệnh.</Txt>
    </BtCard>
  );
};

/**
 * Chiến dịch (màn 2): bốn tab Khối 6–9, dải tối của khối (vai, tên chiến dịch, mức nhận thức, dạng câu, tiến độ, số câu / trận, phần thưởng), danh sách chặng xen
 * hòm báu, nút đổi sang bản đồ gốc. Khối cao hơn lớp em hiện "Mở khi em lên lớp …" nhưng vẫn xem được danh sách.
 */
export const CampaignScreen: React.FC<{ session: Session; nav: SagaNav }> = ({ session, nav }) => {
  const t = useBT();
  const toast = useToast();
  const home = nav.home;
  const grades = home?.grades ?? [];
  const mine = home?.grade ?? grades.find((g) => g.state === 'current')?.grade ?? null;
  const g = nav.route.c && nav.route.c >= 6 && nav.route.c <= 9 ? nav.route.c : mine ?? grades.find((x) => x.state !== 'locked')?.grade ?? 6;
  const data = useLoad<GradeView>(session, (tk) => saga.grade(tk, g), [g]);
  const [mode, setMode] = useState<'list' | 'map'>('list');
  const [opening, setOpening] = useState<{ box: SagaChest; reload: () => void } | null>(null);
  const v = data.data && data.data.grade.grade === g ? data.data : null;
  const info: GradeSummary | null = v?.grade ?? grades.find((x) => x.grade === g) ?? null;
  const pick = (st: StageBrief): void => {
    if (st.state === 'locked') { toast(st.lock_reason ?? 'Chặng này còn khóa.'); return; }
    nav.go('chien-dich', { c: st.grade ?? g, s: st.id, v: entryOf(st) });
  };
  const chest = (box: SagaChest, reload: () => void): void => {
    if (box.state === 'opened') { toast('Em đã mở hòm báu này rồi.'); return; }
    if (box.state === 'locked') { toast(box.kind === 'part' ? 'Hoàn thành mọi chặng của chiến dịch để mở hòm báu cuối.' : `Hoàn thành chặng ${box.after} để mở hòm báu này.`); return; }
    setOpening({ box, reload });
  };
  const tabs = (grades.length ? grades : [6, 7, 8, 9].map((n) => ({ grade: n, role: '' } as GradeSummary))).map((x) => ({ value: x.grade, label: `Khối ${x.grade}`, sub: x.role || undefined }));
  const header = info ? (
    <BtCard tone="night" pad={16} testID="grade-header">
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Eyebrow text={`Khối ${info.grade} · ${info.role}`} color={t.gold} />
          <SerifTitle size={22} color={t.onNight}>{info.title}</SerifTitle>
          <Txt size={13} color={t.onNightMuted} style={{ lineHeight: 19 }}>Mức {info.level.toLowerCase()} · {info.forms}</Txt>
        </View>
        {info.state === 'done' ? <Pill text="Đã xong" bg={t.green} fg={t.dark ? '#0F1115' : '#FFFFFF'} strong /> : info.mine ? <Pill text="Khối của em" bg={t.gold} fg="#2A1D14" strong /> : info.state === 'locked' ? <Pill text="Còn khóa" bg="rgba(255,255,255,0.14)" fg={t.onNight} /> : null}
      </View>
      <BtBar value={info.stages ? info.done / info.stages : 0} color={t.gold} track="rgba(255,255,255,0.18)" label={`Khối ${info.grade}: đã xong ${info.done}/${info.stages} chặng`} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <Pill text={`${info.done}/${info.stages} chặng`} bg="rgba(255,255,255,0.12)" fg={t.onNight} />
        <Pill text={`${info.stars}/${info.max_stars} sao`} bg="rgba(255,255,255,0.12)" fg={t.gold} strong />
        <Pill text={`${info.questions} câu hỏi`} bg="rgba(255,255,255,0.12)" fg={t.onNight} />
        <Pill text={`${info.battles} trận`} bg="rgba(255,255,255,0.12)" fg={t.onNight} />
      </View>
      <Txt size={12.5} color={t.gold}>{info.reward}</Txt>
      {info.lock_reason ? <Txt size={12.5} color={t.onNightMuted} accessibilityRole="alert">{info.lock_reason}. Em vẫn xem trước được các chặng.</Txt> : info.note ? <Txt size={12} color={t.onNightMuted}>{info.note}</Txt> : null}
    </BtCard>
  ) : null;
  const list = !v ? <LoadState loading={data.loading} error={data.error} onRetry={data.reload} /> : (
    <View style={{ gap: 8 }} testID="grade-stages">
      {v.stages.map((st, i) => (
        <React.Fragment key={st.id}>
          <StageRow st={st} current={st.id === v.current_stage_id} onPress={() => pick(st)} />
          {v.chests.filter((c) => c.after === i + 1).map((box) => <ChestRow key={box.key} box={box} onPress={() => chest(box, data.reload)} />)}
        </React.Fragment>
      ))}
    </View>
  );
  const hasMaps = Boolean(v && v.maps.length);
  return (
    <BtPage testID="saga-campaign" max={1180}>
      <View style={{ gap: 2 }}>
        <Eyebrow text="Chiến dịch" />
        <SerifTitle size={24}>Bốn chiến dịch, bốn khối lớp</SerifTitle>
        <Txt size={13} color={t.muted}>Mỗi khối một chiến dịch riêng, không trùng nội dung; khó dần từ nhận biết tới vận dụng cao.</Txt>
      </View>
      <SegTabs options={tabs} value={g} onChange={(n) => { setMode('list'); nav.go('chien-dich', { c: n }, 'params'); }} label="Chọn khối" testID="grade-tab" />
      <Columns split={1.5} left={(
        <>
          {header}
          {hasMaps ? (
            <SegTabs options={[{ value: 'list' as const, label: 'Lộ trình' }, { value: 'map' as const, label: 'Bản đồ gốc' }]} value={mode} onChange={setMode} label="Kiểu xem" testID="campaign-view" />
          ) : null}
          {mode === 'map' && v ? v.maps.map((m) => <MapPart key={m.campaign_no} session={session} no={m.campaign_no} currentId={v.current_stage_id} onPick={pick} onChest={chest} />) : list}
        </>
      )} right={(
        <>
          <TtSays>
            <Txt f="heavy" size={13} color={t.teal}>Mỗi chặng 5 bước</Txt>
            <Txt size={13} color={t.ink} style={{ lineHeight: 19 }}>Quân lệnh → Thám sử (nhặt thẻ Binh thư) → Hội đồng quân sự (trả lời câu hỏi) → Xuất trận → Sử quan tổng kết. Xong chặng thì mở hòm báu trên đường.</Txt>
          </TtSays>
          <BtCard testID="campaign-world">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Box size={22} color={t.teal} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt f="heavy" size={14} color={t.ink}>Khám phá thêm: thế giới 3D</Txt>
                <Txt size={12.5} color={t.muted}>Phần thêm, không bắt buộc: dạo bối cảnh, làm nhiệm vụ cùng lớp trong thế giới khối vuông.</Txt>
              </View>
            </View>
            <BtButton title="Vào Nhập vai" tone="ghost" size="sm" iconRight={ChevronRight} onPress={() => nav.go('nhap-vai')} testID="campaign-roleplay" />
          </BtCard>
          <BtCard tone="sunk">
            <Eyebrow text="Bốn khối" color={t.muted} />
            {grades.map((x) => (
              <Pressable key={x.grade} onPress={() => nav.go('chien-dich', { c: x.grade }, 'params')} accessibilityRole="button" testID={`grade-row-${x.grade}`}
                accessibilityLabel={`Khối ${x.grade}, ${x.role}: ${x.title}. Đã xong ${x.done}/${x.stages} chặng`}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, opacity: pressed ? 0.8 : 1 })}>
                <Txt f="heavy" size={13} color={x.grade === g ? t.accent : t.ink} style={{ width: 60 }}>Khối {x.grade}</Txt>
                <BtBar value={x.stages ? x.done / x.stages : 0} height={6} label={`Khối ${x.grade}: ${x.done}/${x.stages}`} style={{ flex: 1 }} />
                <Txt size={12} color={t.muted} style={{ width: 44, textAlign: 'right' }}>{x.done}/{x.stages}</Txt>
              </Pressable>
            ))}
          </BtCard>
        </>
      )} />
      {opening ? (
        <ChestOpening session={session} chest={opening.box} look={home?.look} open={() => saga.openChest(session.token, opening.box.key)}
          onClose={(opened) => { const r = opening.reload; setOpening(null); if (opened) { r(); data.reload(); nav.refresh(); } }} />
      ) : null}
    </BtPage>
  );
};

// ---------------------------------------------------------------------- 3. Quân lệnh (bước 1/5)
const STEP_ROWS: Array<{ key: 'order' | 'lesson' | 'practice' | 'battle' | 'summary'; n: number; title: string; v: SagaStep; icon: IconType }> = [
  { key: 'order', n: 1, title: 'Quân lệnh', v: 'quan-lenh', icon: ScrollText },
  { key: 'lesson', n: 2, title: 'Thám sử', v: 'tham-su', icon: MapIcon },
  { key: 'practice', n: 3, title: 'Hội đồng quân sự', v: 'hoi-dong', icon: Users },
  { key: 'battle', n: 4, title: 'Xuất trận', v: 'xuat-tran', icon: Swords },
  { key: 'summary', n: 5, title: 'Sử quan tổng kết', v: 'su-quan', icon: BookOpen },
];
const sceneKind = (d: StageDetail): 'song' | 'dinh' | 'lang' => (d.battle_mode === 'bachdang' || /sông|bạch đằng|vân đồn|chương dương|hàm tử/i.test(`${d.title} ${d.place}`) ? 'song' : d.kind === 'council' || d.battle_mode === 'council' ? 'dinh' : 'lang');

/** Quân lệnh: nhận nhiệm vụ của chặng – lời dẫn, mục tiêu, năm bước (bấm để vào bước đã mở), phần thưởng lần đầu, nút vào bước tiếp theo */
export const OrderScreen: React.FC<{ session: Session; nav: SagaNav; stageId: number; campaignNo: number }> = ({ session, nav, stageId, campaignNo }) => {
  const t = useBT();
  const data = useLoad<StageDetail>(session, (tk) => saga.stage(tk, stageId), [stageId]);
  const d = data.data;
  const grade = d?.grade ?? campaignNo;
  const back = (): void => nav.back('chien-dich', { c: grade });
  const open = (v: SagaStep): void => nav.go('chien-dich', { c: grade, s: stageId, v });
  if (!d) {
    return (
      <BtPage testID="saga-order" tabBar={false} max={1080}>
        <StepHeader eyebrow="Bước 1/5 · Quân lệnh" title="Chặng" onBack={back} backLabel="Về Chiến dịch" />
        <LoadState loading={data.loading} error={data.error} onRetry={data.reload} />
      </BtPage>
    );
  }
  const stateOf = (k: (typeof STEP_ROWS)[number]['key']): StepState => d.steps[k];
  const note = (k: (typeof STEP_ROWS)[number]['key']): string => {
    switch (k) {
      case 'order': return 'Nhận nhiệm vụ, xem mục tiêu của chặng';
      case 'lesson': return `Nhặt ${d.lore.total} thẻ Binh thư trên bản đồ (đã có ${d.lore.have})`;
      case 'practice': return `${d.practice.items} câu · cần đạt ${d.pass_percent}%${d.practice.tries ? ` · tốt nhất ${d.practice.best}%` : ''}`;
      case 'battle': return d.battle ? `${d.battle.title}${d.battle.won ? ` · ${d.battle.stars} sao` : ''}` : 'Chặng này không có trận đánh';
      default: return d.completed_at ? 'Xem lại so sánh với lịch sử và lời nhận xét' : 'So sánh lựa chọn của em với lịch sử';
    }
  };
  const next = d.steps.next;
  const locked = d.state === 'locked';
  const cta = locked ? null : next ? NEXT_STEP[next] : null;
  return (
    <BtPage testID="saga-order" tabBar={false} max={1080}>
      <StepHeader eyebrow={`Bước 1/5 · Quân lệnh · Khối ${grade} · Chặng ${d.order}/${d.of}`} title={d.title} onBack={back} backLabel="Về Chiến dịch" />
      <Columns left={(
        <>
          <View style={{ height: 150, borderRadius: 18, overflow: 'hidden', backgroundColor: t.card2 }}>
            <VnScene kind={sceneKind(d)} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
            <View style={{ position: 'absolute', left: 12, bottom: 12, right: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              <Pill text={[d.place, d.date_label].filter(Boolean).join(' · ')} bg="rgba(255,251,242,0.92)" fg="#2A1D14" strong />
              {d.grade_info ? <Pill text={`${d.grade_info.role} · ${d.grade_info.level}`} bg="rgba(255,251,242,0.92)" fg="#7E1616" /> : null}
            </View>
          </View>
          {d.order_text ? (
            <BtCard tone="gold" testID="order-text">
              <Eyebrow text={d.order_text.by && d.order_text.by !== 'Lời dẫn' ? `Quân lệnh của ${d.order_text.by}` : 'Quân lệnh'} />
              <Txt f="serif" size={17} color={t.ink} style={{ lineHeight: 26 }}>“{d.order_text.text}”</Txt>
              <Txt size={11.5} color={t.muted}>Lời dẫn của trò chơi, không phải trích dẫn lịch sử.</Txt>
            </BtCard>
          ) : <Txt size={14} color={t.soft} style={{ lineHeight: 21 }}>{d.summary}</Txt>}
          {d.lock_reason ? <TtSays tone="warn"><Txt f="semibold" size={13.5} color={t.ink} accessibilityRole="alert">{d.lock_reason}</Txt></TtSays> : null}
          <BtCard testID="order-objectives">
            <Txt f="heavy" size={15} color={t.ink}>Sau chặng này em sẽ</Txt>
            {d.objectives.map((o) => (
              <View key={o.id} style={{ flexDirection: 'row', gap: 8 }}><Target size={15} color={t.accent} style={{ marginTop: 3 }} /><Txt size={14} color={t.ink} style={{ flex: 1, lineHeight: 20 }}>{o.text}</Txt></View>
            ))}
          </BtCard>
        </>
      )} right={(
        <>
          <BtCard testID="order-steps">
            <Txt f="heavy" size={15} color={t.ink}>Năm bước của chặng</Txt>
            {STEP_ROWS.map((r) => {
              const s = stateOf(r.key);
              if (s === 'none') return null;
              const can = !locked && s !== 'locked' && r.key !== 'order' && (r.key !== 'summary' || s === 'done');
              const now = next !== null && NEXT_STEP[next].v === r.v;
              const Icon = r.icon;
              return (
                <Pressable key={r.key} disabled={!can} onPress={() => open(r.v)} accessibilityRole="button" testID={`step-${r.key}`}
                  accessibilityLabel={`Bước ${r.n}, ${r.title}: ${s === 'done' ? 'đã xong' : s === 'ready' ? 'sẵn sàng' : 'chưa mở'}. ${note(r.key)}`}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, borderWidth: now ? 2 : 1, borderColor: now ? t.accent : t.line,
                    backgroundColor: s === 'locked' ? t.card2 : t.card, opacity: pressed ? 0.85 : s === 'locked' ? 0.75 : 1 })}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: s === 'done' ? t.greenSoft : now ? t.accent : t.card2 }}>
                    {s === 'done' ? <Check size={18} color={t.green} strokeWidth={3} /> : s === 'locked' ? <Lock size={16} color={t.muted} /> : <Icon size={18} color={now ? t.onAccent : t.soft} />}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Txt f="heavy" size={14} color={t.ink}>{r.n}. {r.title}</Txt>
                    <Txt size={12.5} color={t.muted}>{note(r.key)}</Txt>
                  </View>
                  {can ? <ChevronRight size={17} color={t.muted} /> : null}
                </Pressable>
              );
            })}
            {d.steps.world !== 'none' ? (
              <Pressable disabled={d.steps.world === 'locked'} onPress={() => open('kham-pha')} accessibilityRole="button" testID="step-world"
                accessibilityLabel={`Khám phá thêm trong thế giới 3D: ${d.steps.world === 'done' ? 'đã xong' : d.steps.world === 'ready' ? 'sẵn sàng' : 'mở sau khi qua Hội đồng'}`}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: t.line2, opacity: pressed ? 0.85 : d.steps.world === 'locked' ? 0.7 : 1 })}>
                <View style={{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: t.tealSoft }}><Box size={18} color={t.teal} /></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt f="heavy" size={14} color={t.ink}>Khám phá thêm (3D, không bắt buộc)</Txt>
                  <Txt size={12.5} color={t.muted}>{d.steps.world === 'locked' ? 'Mở sau khi qua Hội đồng quân sự' : d.steps.world === 'done' ? 'Đã khám phá · +20 KN' : 'Dạo bối cảnh của chặng · +20 KN'}</Txt>
                </View>
              </Pressable>
            ) : null}
          </BtCard>
          <BtCard tone="sunk" testID="order-rewards">
            <Txt f="heavy" size={14} color={t.ink}>Phần thưởng lần đầu</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              <Pill text={`+${d.rewards.xp} KN`} bg={t.goldSoft} fg={t.accent} strong />
              <Pill text={`+${d.rewards.gold} vàng`} bg={t.goldSoft} fg={t.goldInk} strong />
              {d.battle ? <Pill text="Mỗi sao trận +30 KN +10 vàng" /> : null}
              {d.rewards.has_badge ? <Pill text="Huy hiệu" bg={t.dangerSoft} fg={t.danger} /> : null}
              {d.rewards.rank_up ? <Pill text={`Đỗ ${d.rewards.rank_up}`} bg={t.gold} fg="#2A1D14" strong testID="order-rank-up" /> : null}
            </View>
            {d.rewards.card ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Portrait code={d.rewards.card.portrait} size={48} locked={Boolean(d.rewards.card.hidden)} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt f="heavy" size={13.5} color={t.ink}>Thẻ nhân vật: {d.rewards.card.name}</Txt>
                  <Txt size={12} color={t.muted}>{RARITY[d.rewards.card.rarity]?.label ?? ''} · {d.rewards.card.hidden ? 'xong chặng để mở' : d.rewards.card.title}</Txt>
                </View>
              </View>
            ) : null}
            {d.unlocks_next ? <Txt size={12.5} color={t.soft}>Xong chặng mở: {d.unlocks_next.title}</Txt> : null}
          </BtCard>
          {cta ? <BtButton title={next === 'lesson' && d.state === 'ready' ? 'Nhận lệnh, vào Thám sử' : `Vào bước ${cta.n}: ${cta.label}`} size="lg" iconRight={ChevronRight} onPress={() => open(cta.v)} full testID="stage-cta" /> : null}
        </>
      )} />
    </BtPage>
  );
};

// ---------------------------------------------------------------------- 4. Bảng vàng
const PODIUM = ['#C9902A', '#9AA3AD', '#A8703A'];
const daysLeft = (iso: string): number => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
/** Đổi hạng so với tuần trước: ▲ lên / ▼ xuống / – giữ nguyên; null = tuần trước chưa có điểm */
const Delta: React.FC<{ d: number | null | undefined }> = ({ d }) => {
  const t = useBT();
  if (d === null || d === undefined) return <Txt size={11.5} color={t.muted} style={{ width: 40, textAlign: 'right' }}>mới</Txt>;
  const Icon = d > 0 ? ArrowUp : d < 0 ? ArrowDown : Minus;
  const col = d > 0 ? t.green : d < 0 ? t.danger : t.muted;
  return (
    <View accessible accessibilityLabel={d > 0 ? `lên ${d} hạng` : d < 0 ? `xuống ${-d} hạng` : 'giữ hạng'} style={{ width: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2 }}>
      <Icon size={13} color={col} strokeWidth={2.6} />{d ? <Txt f="heavy" size={12} color={col}>{Math.abs(d)}</Txt> : null}
    </View>
  );
};

/** Bảng vàng (màn 4): giải đấu tuần, bảng lớp / toàn trường, so với tuần trước, thang Khoa bảng, huy hiệu */
export const BoardScreen: React.FC<{ session: Session; nav: SagaNav; classId: number | null; className: string | null }> = ({ session, nav, classId, className }) => {
  const t = useBT();
  const [picked, setScope] = useState<'class' | 'school' | null>(null);
  const scope = picked ?? (classId ? 'class' : 'school');
  const [compare, setCompare] = useState(true);
  const board = useLoad<Board>(session, (tk) => game.leaderboard(tk, scope === 'class' ? { scope, period: 'week', class_id: classId ?? undefined } : { scope, period: 'week' }), [scope, classId]);
  const league = useLoad<LeagueView>(session, (tk) => game.leagueView(tk), []);
  const badges = useLoad<BadgeItem[]>(session, (tk) => game.gameBadges(tk), []);
  const data = board.data && board.data.scope === scope ? board.data : null;
  const entries = data?.entries ?? [];
  const top = entries.filter((e) => e.rank <= 3).slice(0, 3);
  const rest = entries.filter((e) => !top.includes(e));
  const home = nav.home;
  const lg = league.data;
  const myLeague = lg?.entries.find((e) => e.me) ?? null;
  const showDelta = compare && Boolean(data?.compare);
  const row = (e: Board['entries'][number], i: number) => (
    <View key={`${e.rank}-${e.name}-${i}`} accessible accessibilityLabel={`Hạng ${e.rank}: ${e.name}${e.me ? ' (em)' : ''}, ${num(e.xp)} KN tuần này`} testID={e.me ? 'board-me' : undefined}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 12, borderTopWidth: i ? 1 : 0, borderTopColor: t.line, backgroundColor: e.me ? t.goldSoft : 'transparent' }}>
      <Txt f="heavy" size={14} color={t.muted} style={{ width: 26, textAlign: 'center' }}>{e.rank}</Txt>
      <Txt f={e.me ? 'heavy' : 'semibold'} size={14.5} color={t.ink} numberOfLines={1} style={{ flex: 1 }}>{e.name}{e.me && e.name !== 'Em' ? ' (em)' : ''}</Txt>
      <Txt f="heavy" size={14} color={t.goldInk}>{num(e.xp)} KN</Txt>
      {showDelta ? <Delta d={e.delta} /> : null}
    </View>
  );
  const leagueCard = (
    <BtCard tone="night" testID="board-league">
      {!lg ? <LoadState loading={league.loading} error={league.error} onRetry={league.reload} /> : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Trophy size={26} color={t.gold} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Eyebrow text="Giải đấu tuần" color={t.gold} />
              <SerifTitle size={21} color={t.onNight}>Hạng {lg.tier_name}</SerifTitle>
            </View>
            <Pill text={`Còn ${daysLeft(lg.ends_at)} ngày`} bg="rgba(255,255,255,0.14)" fg={t.onNight} strong />
          </View>
          <Txt size={13} color={t.onNightMuted} style={{ lineHeight: 19 }}>
            {myLeague ? `Em đang đứng thứ ${myLeague.rank}/${lg.size} trong nhóm. ` : ''}{[lg.promote ? `Top ${lg.promote} lên hạng` : '', lg.demote ? `${lg.demote} bạn cuối xuống hạng` : ''].filter(Boolean).join(', ') || 'Bảng chốt'} khi tuần kết thúc.
          </Txt>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {lg.tiers.map((name, i) => <View key={name} accessible accessibilityLabel={`${name}${i === lg.tier ? ' (hạng của em)' : ''}`} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i <= lg.tier ? t.gold : 'rgba(255,255,255,0.18)' }} />)}
          </View>
        </>
      )}
    </BtCard>
  );
  const boardCard = (
    <BtCard pad={0} testID="board-card" style={{ overflow: 'hidden', gap: 0 }}>
      <View style={{ padding: 12, gap: 10 }}>
        <SegTabs options={[{ value: 'class' as const, label: className ? `Lớp ${className}` : 'Lớp' }, { value: 'school' as const, label: 'Toàn trường' }]} value={scope} onChange={setScope} label="Phạm vi bảng" testID="board-scope" />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Txt f="semibold" size={13.5} color={t.ink} style={{ flex: 1 }}>So với tuần trước</Txt>
          <Switch value={compare} onValueChange={setCompare} accessibilityLabel="So với tuần trước" testID="board-compare" trackColor={{ false: t.line2, true: t.accent }} thumbColor="#FFFFFF" />
        </View>
      </View>
      {!data ? <View style={{ padding: 16 }}><LoadState loading={board.loading} error={board.error} onRetry={board.reload} /></View>
        : data.disabled ? <Txt f="semibold" size={14} color={t.muted} center style={{ padding: 20 }}>{data.message ?? 'Bảng xếp hạng đang tắt.'}</Txt> : (
        <View testID="board-list">
          {top.length ? (
            <View testID="board-podium" style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: 10, paddingHorizontal: 12, paddingVertical: 14, backgroundColor: t.card2 }}>
              {[1, 0, 2].map((idx) => {
                const e = top[idx];
                if (!e) return <View key={idx} style={{ flex: 1 }} />;
                const h = idx === 0 ? 86 : idx === 1 ? 66 : 54;
                return (
                  <View key={idx} style={{ flex: 1, alignItems: 'center', gap: 4 }} accessible accessibilityLabel={`Hạng ${e.rank}: ${e.name}, ${num(e.xp)} KN`}>
                    <Txt f={e.me ? 'heavy' : 'bold'} size={13} color={t.ink} numberOfLines={1} center>{e.name}</Txt>
                    <Txt f="heavy" size={12} color={t.goldInk}>{num(e.xp)} KN</Txt>
                    <View style={{ alignSelf: 'stretch', height: h, borderTopLeftRadius: 10, borderTopRightRadius: 10, backgroundColor: PODIUM[idx], alignItems: 'center', justifyContent: 'center' }}>
                      <Txt f="serifBold" size={24} color="#FFFFFF">{e.rank}</Txt>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}
          {rest.map(row)}
          {!entries.length ? <Txt size={13.5} color={t.muted} center style={{ padding: 20 }}>Tuần này chưa có bạn nào ghi điểm. Xong một chặng để ghi danh đầu tiên!</Txt> : null}
          {scope === 'school' ? <Txt size={11.5} color={t.muted} center style={{ padding: 10, borderTopWidth: 1, borderTopColor: t.line }}>Bảng toàn trường chỉ hiện biệt danh; bạn chưa đặt biệt danh được ẩn tên.</Txt> : null}
          {compare && data && !data.compare ? <Txt size={11.5} color={t.muted} center style={{ padding: 10 }}>Chỉ bảng tuần mới so được với tuần trước.</Txt> : null}
        </View>
      )}
    </BtCard>
  );
  const rankCard = home ? (
    <BtCard testID="board-khoa-bang">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Award size={20} color={t.accent} />
        <Txt f="heavy" size={15} color={t.ink} style={{ flex: 1 }}>Khoa bảng của em</Txt>
        <Pill text={home.rank.name} bg={t.goldSoft} fg={t.goldInk} strong />
      </View>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {home.rank.names.map((n, i) => (
          <View key={n} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <View style={{ alignSelf: 'stretch', height: 6, borderRadius: 3, backgroundColor: i <= home.rank.level ? t.accent : t.line }} />
            <Txt size={10.5} f={i === home.rank.level ? 'heavy' : 'semibold'} color={i === home.rank.level ? t.accent : t.muted} center numberOfLines={2}>{n}</Txt>
          </View>
        ))}
      </View>
      {home.rank.next && home.rank.next_name ? <Txt size={12.5} color={t.soft}>Còn {Math.max(0, home.rank.next.total - home.rank.next.done)} {home.rank.next.unit} nữa để đỗ {home.rank.next_name}.</Txt> : <Txt size={12.5} color={t.soft}>Em đã đỗ Trạng nguyên!</Txt>}
    </BtCard>
  ) : null;
  const earned = (badges.data ?? []).filter((b) => b.earned);
  const badgeCard = (
    <BtCard testID="board-badges">
      <Txt f="heavy" size={15} color={t.ink}>Huy hiệu</Txt>
      {!badges.data ? <Spinner /> : earned.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {earned.map((b) => (
            <View key={b.id} accessible accessibilityLabel={`Huy hiệu ${b.name}${b.description ? `: ${b.description}` : ''}`} style={{ width: 88, alignItems: 'center', gap: 4 }}>
              <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: b.color || t.bronze, alignItems: 'center', justifyContent: 'center' }}><Award size={22} color="#FFFFFF" /></View>
              <Txt size={11.5} f="semibold" color={t.ink} center numberOfLines={2}>{b.name}</Txt>
            </View>
          ))}
        </View>
      ) : <Txt size={13} color={t.muted}>Chưa có huy hiệu. Xong chặng, giữ chuỗi ngày và đánh trận 3 sao để nhận huy hiệu.</Txt>}
      <Txt size={11.5} color={t.muted}>{earned.length}/{(badges.data ?? []).length} huy hiệu</Txt>
    </BtCard>
  );
  return (
    <BtPage testID="saga-board" max={1180}>
      <View style={{ gap: 2 }}>
        <Eyebrow text="Bảng vàng" />
        <SerifTitle size={24}>Ai chăm học nhất tuần này?</SerifTitle>
        <Txt size={13} color={t.muted}>Xếp theo KN kiếm được trong tuần. Vàng và đồ trang trí không tính vào bảng.</Txt>
      </View>
      <Columns left={<>{leagueCard}{boardCard}</>} right={<>{rankCard}{badgeCard}<BtButton title="Xem Hồ sơ của em" tone="ghost" iconRight={ChevronRight} onPress={() => nav.go('ho-so')} testID="board-profile" /></>} />
    </BtPage>
  );
};

// ---------------------------------------------------------------------- bản đồ gốc kiểu sa bàn (giữ từ bản 16/11/2026)
const NODE = 44;
const ZOOMS = [1, 1.5, 2, 2.6];
const BORDER = 1;

/** Kéo chuột để xê dịch bản đồ khi đã phóng to (cảm ứng dùng thao tác cuộn sẵn có) */
function useDragPan(outer: React.RefObject<ScrollViewInstance | null>, inner: React.RefObject<ScrollViewInstance | null>, enabled: boolean): void {
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return undefined;
    const node = (r: React.RefObject<ScrollViewInstance | null>): HTMLElement | null => ((r.current as unknown as { getScrollableNode?: () => HTMLElement } | null)?.getScrollableNode?.() ?? null);
    const v = node(outer), h = node(inner);
    if (!v || !h) return undefined;
    let pointer: number | null = null, sx = 0, sy = 0, left = 0, top = 0;
    const down = (e: PointerEvent): void => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || (e.target as Element).closest('[role="button"]')) return;
      pointer = e.pointerId; sx = e.clientX; sy = e.clientY; left = h.scrollLeft; top = v.scrollTop;
      v.style.cursor = 'grabbing';
    };
    const move = (e: PointerEvent): void => { if (e.pointerId === pointer) { h.scrollLeft = left - (e.clientX - sx); v.scrollTop = top - (e.clientY - sy); e.preventDefault(); } };
    const up = (): void => { pointer = null; v.style.cursor = 'grab'; };
    v.style.cursor = 'grab';
    v.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { v.style.cursor = ''; v.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [outer, inner, enabled]);
}

/** Nảy nhẹ lên xuống (hòm báu đang chờ mở); đứng yên khi bật giảm chuyển động */
const Bounce: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let live = true;
    let a: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!live || reduce) return;
      a = Animated.loop(Animated.sequence([Animated.timing(v, { toValue: 1, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: false }),
        Animated.timing(v, { toValue: 0, duration: 420, easing: Easing.in(Easing.quad), useNativeDriver: false }), Animated.delay(900)]));
      a.start();
    }).catch(() => undefined);
    return () => { live = false; a?.stop(); };
  }, [v]);
  return <Animated.View style={{ transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -7] }) }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }}>{children}</Animated.View>;
};

const SagaMap: React.FC<{ map: SagaMapInfo; stages: StageBrief[]; currentId: number | null; selectedId: number | null; onPick: (st: StageBrief) => void; maxHeight: number; mascotId?: number | null; chests?: SagaChest[]; onChest?: (chest: SagaChest) => void }> = ({ map, stages, currentId, selectedId, onPick, maxHeight, mascotId = null, chests = [], onChest }) => {
  const { c } = useTheme();
  const [boxW, setBoxW] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const outer = useRef<ScrollViewInstance | null>(null), inner = useRef<ScrollViewInstance | null>(null);
  const ratio = map.image_w / Math.max(1, map.image_h);
  const viewW = Math.max(0, boxW - BORDER * 2), maxH = maxHeight - BORDER * 2;
  const fitW = Math.min(viewW, maxH * ratio);
  // Cỡ mặc định (16/11/2026 đợt 8: không có thanh cuộn riêng trong bản đồ): vừa chiều cao khung nhìn; nới rộng thêm (tối đa bằng bề ngang khung) khi bản đồ
  // quá nhỏ để đọc chữ hoặc khi hai chặng nằm sát tới mức các nút đè lên nhau – khi đó khung bản đồ cao theo ảnh và trang cuộn chung, không cuộn trong bản đồ
  const grow = useMemo(() => {
    if (!fitW) return 1;
    let near = Infinity;
    for (let i = 0; i < stages.length; i += 1) for (let j = i + 1; j < stages.length; j += 1) near = Math.min(near, Math.hypot((stages[i].map_x - stages[j].map_x) * fitW, (stages[i].map_y - stages[j].map_y) * (fitW / ratio)));
    const need = Math.max((NODE + 12) / Math.max(1, near), Math.min(viewW, 520) / fitW);
    return Math.max(1, Math.min(need, viewW / fitW));
  }, [fitW, ratio, stages, viewW]);
  const baseW = fitW * grow, baseH = baseW / ratio;
  // phóng to (nút +) thì mới cuộn / kéo trong khung bản đồ; khung giữ chiều cao của cỡ mặc định
  const zi = chosen ?? 0;
  const setZi = (next: (i: number) => number): void => setChosen(next(zi));
  const zoom = ZOOMS[zi];
  const cw = baseW * zoom, ch = baseH * zoom;
  const viewH = baseH;
  const scrolls = cw > viewW + 1 || ch > viewH + 1;
  useDragPan(outer, inner, scrolls);
  // Khi bản đồ lớn hơn khung: đưa chặng đang học (hoặc đang chọn) vào giữa khung nhìn mỗi lần đổi mức phóng
  const focusId = useRef<number | null>(null);
  focusId.current = selectedId ?? currentId;
  useEffect(() => {
    if (!fitW || !scrolls) return undefined;
    const st = stages.find((x) => x.id === focusId.current) ?? stages[0];
    if (!st) return undefined;
    const x = Math.max(0, Math.min(cw - viewW, st.map_x * cw - viewW / 2)), y = Math.max(0, Math.min(ch - viewH, st.map_y * ch - viewH / 2));
    const t = setTimeout(() => { inner.current?.scrollTo({ x, animated: false }); outer.current?.scrollTo({ y, animated: false }); }, 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zi, fitW, scrolls]);
  // màn hẹp: chỉ hiện tên của chặng đang chọn / đang học để các nhãn không đè lên nhau; bảng bên dưới có đủ tên
  const compact = cw < 620;
  const pt = (st: StageBrief): [number, number] => [st.map_x * cw, st.map_y * ch];
  /** vị trí trái (tính từ nút chặng) của nhãn rộng `w` căn giữa dưới / trên nút, đẩy vào trong để không tràn mép bản đồ */
  const inside = (x: number, w: number): number => Math.max(0, Math.min(cw - w, x - w / 2)) - (x - NODE / 2);
  // Rồng Con đi trên đường nối các chặng: từ chặng trước tới chặng đang học (máy bật giảm chuyển động thì đứng sẵn ở chặng đang học)
  const walk = useRef(new Animated.Value(1)).current;
  const mi = mascotId ? stages.findIndex((x) => x.id === mascotId) : -1;
  const ready = cw > 0;
  useEffect(() => {
    if (mi < 0 || !ready) return undefined;
    let live = true;
    if (mi === 0) { walk.setValue(1); return undefined; }
    walk.setValue(0);
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!live) return;
      if (reduce) walk.setValue(1); else Animated.timing(walk, { toValue: 1, duration: 1600, delay: 500, easing: Easing.inOut(Easing.quad), useNativeDriver: false }).start();
    }).catch(() => walk.setValue(1));
    return () => { live = false; walk.stopAnimation(); };
  }, [mi, ready, walk]);
  const mascotAt = mi >= 0 ? { from: pt(stages[Math.max(0, mi - 1)]), to: pt(stages[mi]) } : null;
  // Hòm báu: hòm sau chặng k nằm trên đoạn nối chặng k – k + 1, hòm cuối phần nằm tiếp sau chặng cuối theo hướng đường đi. Các chặng có thể nằm sát nhau
  // nên thử vài điểm dọc đoạn nối và lệch sang hai bên, chọn chỗ ít chồng lên nút chặng, nhãn tên chặng và các hòm đã đặt nhất
  const chestSpots = useMemo(() => {
    if (!cw) return new Map<string, [number, number]>();
    type Box = [number, number, number, number];
    const boxes: Box[] = [];
    for (const st of stages) {
      const x = st.map_x * cw, y = st.map_y * ch;
      boxes.push([x - NODE / 2 - 6, y - NODE / 2 - 22, x + NODE / 2 + 6, y + NODE / 2 + 4]);
      const lx = Math.max(0, Math.min(cw - 240, x - 120));
      boxes.push([lx + 50, y + NODE / 2 + 4, lx + 190, y + NODE / 2 + 44]);
    }
    const overlap = (r: Box) => boxes.reduce((n, o) => n + Math.max(0, Math.min(r[2], o[2]) - Math.max(r[0], o[0])) * Math.max(0, Math.min(r[3], o[3]) - Math.max(r[1], o[1])), 0);
    const out = new Map<string, [number, number]>();
    for (const box of chests) {
      const a = stages[box.after - 1];
      if (!a) continue;
      const b = stages[box.after];
      const ax = a.map_x * cw, ay = a.map_y * ch;
      let dx: number, dy: number, base: Array<[number, number]>;
      if (b) {
        dx = b.map_x * cw - ax; dy = b.map_y * ch - ay;
        base = [0.5, 0.4, 0.6, 0.3, 0.7].map((t) => [ax + dx * t, ay + dy * t]);
      } else {
        const p = stages[box.after - 2];
        dx = p ? ax - p.map_x * cw : 1; dy = p ? ay - p.map_y * ch : 0;
        const len = Math.max(1, Math.hypot(dx, dy));
        base = [60, 80, 100].map((d) => [ax + (dx / len) * d, ay + (dy / len) * d]);
      }
      const len = Math.max(1, Math.hypot(dx, dy)), px = -dy / len, py = dx / len;
      const w = box.kind === 'part' ? 44 : 36;
      let best: [number, number] = base[0], score = Infinity;
      base.forEach(([bx, by], i) => {
        for (const off of [0, 30, -30, 55, -55]) {
          const x = Math.max(w / 2 + 2, Math.min(cw - w / 2 - 2, bx + px * off)), y = Math.max(w / 2, Math.min(ch - w / 2, by + py * off));
          const sc = overlap([x - w / 2, y - w / 2, x + w / 2, y + w / 2]) + Math.abs(off) * 2 + i * 15;
          if (sc < score) { score = sc; best = [x, y]; }
        }
      });
      out.set(box.key, best);
      boxes.push([best[0] - w / 2, best[1] - w / 2, best[0] + w / 2, best[1] + w / 2]);
    }
    return out;
  }, [chests, stages, cw, ch]);
  const chestAt = (box: SagaChest): [number, number] | null => chestSpots.get(box.key) ?? null;
  return (
    <View onLayout={(e) => setBoxW(e.nativeEvent.layout.width)} testID="saga-map" style={{ width: '100%', height: boxW ? viewH + BORDER * 2 : 240, borderRadius: 12, overflow: 'hidden', borderWidth: BORDER, borderColor: c.adminLine, backgroundColor: c.adminCanvas }}>
      {boxW > 0 ? (
        <ScrollView ref={outer} showsVerticalScrollIndicator={scrolls}>
          <ScrollView ref={inner} horizontal showsHorizontalScrollIndicator={scrolls} contentContainerStyle={{ minWidth: '100%', justifyContent: 'center' }}>
            <View style={{ width: cw, height: ch, overflow: 'hidden' }}>
              <Image source={mapSource(map)} style={{ width: cw, height: ch }} resizeMode="stretch" accessibilityLabel={`Bản đồ ${map.title} (${map.years})`} />
              <Svg width={cw} height={ch} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
                {stages.length > 1 ? <Polyline points={stages.map((st) => pt(st).join(',')).join(' ')} fill="none" stroke="#ffffff" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" opacity={0.7} /> : null}
                {stages.length > 1 ? <Polyline points={stages.map((st) => pt(st).join(',')).join(' ')} fill="none" stroke={c.ngoc} strokeWidth={3} strokeDasharray="9 6" strokeLinecap="round" strokeLinejoin="round" /> : null}
                {stages.filter((st) => st.anchor_x !== null && st.anchor_y !== null).map((st) => {
                  const [x, y] = pt(st), ax = (st.anchor_x ?? 0) * cw, ay = (st.anchor_y ?? 0) * ch;
                  return <React.Fragment key={st.id}><Line x1={x} y1={y} x2={ax} y2={ay} stroke={c.logoInk} strokeWidth={1.5} /><Circle cx={ax} cy={ay} r={4} fill={c.logoInk} stroke="#ffffff" strokeWidth={1.5} /></React.Fragment>;
                })}
              </Svg>
              {mascotAt ? (
                <Animated.View pointerEvents="none" testID="map-mascot" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
                  style={{ position: 'absolute', zIndex: 4, left: walk.interpolate({ inputRange: [0, 1], outputRange: [Math.max(0, mascotAt.from[0] - NODE / 2 - 58), Math.max(0, mascotAt.to[0] - NODE / 2 - 58)] }),
                    top: walk.interpolate({ inputRange: [0, 1], outputRange: [mascotAt.from[1] - 24, mascotAt.to[1] - 24] }) }}>
                  <Mascot size={54} mood="happy" bob />
                </Animated.View>
              ) : null}
              {chests.map((box) => {
                const at = chestAt(box);
                if (!at) return null;
                const big = box.kind === 'part';
                const w = big ? 44 : 36;
                return (
                  <Pressable key={box.key} onPress={() => onChest?.(box)} accessibilityRole="button" testID={`map-chest-${box.key}`}
                    accessibilityLabel={`${big ? 'Hòm báu cuối phần' : `Hòm báu sau chặng ${box.after}`}: ${box.state === 'opened' ? 'đã mở' : box.state === 'ready' ? `hòm bí ẩn, bấm để mở – phần thưởng lên tới ${box.max_gold ?? 100} vàng` : 'còn khóa'}`}
                    style={({ pressed }) => ({ position: 'absolute', zIndex: 3, left: at[0] - w / 2 - 2, top: at[1] - w / 2, width: w + 4, height: w,
                      alignItems: 'center', justifyContent: 'center', borderRadius: 12, opacity: pressed ? 0.8 : 1,
                      backgroundColor: box.state === 'ready' ? 'rgba(250,204,21,0.35)' : 'transparent', ...(box.state === 'ready' ? { boxShadow: '0 0 0 3px rgba(250,204,21,0.55)' } as object : {}) })}>
                    {box.state === 'ready' ? <Bounce><ChestArt size={w - 6} state="ready" /></Bounce> : <ChestArt size={w - 6} state={box.state} />}
                  </Pressable>
                );
              })}
              {stages.map((st) => {
                const [x, y] = pt(st);
                const state = STATE[st.state];
                const current = st.id === currentId, picked = st.id === selectedId;
                const showLabel = !compact || current || picked;
                return (
                  <View key={st.id} pointerEvents="box-none" style={{ position: 'absolute', left: x - NODE / 2, top: y - NODE / 2, width: NODE, height: NODE, zIndex: picked ? 6 : current ? 5 : 1 }}>
                    {current ? (
                      <View pointerEvents="none" style={{ position: 'absolute', bottom: NODE + 4, left: inside(x, 120), width: 120, alignItems: 'center' }}>
                        <View style={{ backgroundColor: c.son, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 }}><Txt f="bold" size={11} color="#ffffff">{st.state === 'ready' ? 'Bắt đầu' : 'Đang học'}</Txt></View>
                      </View>
                    ) : st.stars > 0 ? (
                      <View pointerEvents="none" style={{ position: 'absolute', bottom: NODE + 2, left: inside(x, 80), width: 80, alignItems: 'center' }}>
                        <View style={{ backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 4, paddingHorizontal: 4 }}><StarRow n={st.stars} size={12} /></View>
                      </View>
                    ) : null}
                    <Pressable accessibilityRole="button" testID={`map-node-${st.code}`} onPress={() => onPick(st)} hitSlop={4}
                      accessibilityLabel={`Chặng ${st.order}: ${st.title}, ${st.date_label}. ${state.label}${st.stars ? `, ${st.stars} sao` : ''}${st.lock_reason ? `. ${st.lock_reason}` : ''}`}
                      style={({ pressed }) => ({ width: NODE, height: NODE, borderRadius: NODE / 2, backgroundColor: state.solid, borderWidth: picked || current ? 3 : 2, borderColor: picked ? c.logoGold : '#ffffff', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1, transform: [{ scale: picked ? 1.08 : 1 }] })}>
                      <Txt f="bold" size={17} color="#ffffff">{st.order}</Txt>
                      <View style={{ position: 'absolute', right: -6, top: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: '#ffffff', borderWidth: 1, borderColor: state.solid, alignItems: 'center', justifyContent: 'center' }}>
                        <state.icon size={11} color={state.solid} strokeWidth={2.8} />
                      </View>
                    </Pressable>
                    {showLabel ? (
                      <View pointerEvents="none" style={{ position: 'absolute', top: NODE + 4, left: inside(x, 240), width: 240, alignItems: 'center', gap: 2 }}>
                        <View style={{ backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 8, borderWidth: 1, borderColor: c.adminLine, paddingHorizontal: 8, paddingVertical: 2, alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' } as object}>
                          <Txt f="bold" size={12} color={c.logoInk} numberOfLines={1}>{st.order}. {st.title}</Txt>
                          {st.date_label ? <Txt size={10} color={c.muc3} numberOfLines={1}>{st.date_label}</Txt> : null}
                        </View>
                        {st.battle_mode === 'bachdang' ? <View style={{ backgroundColor: c.son, borderRadius: 4, paddingHorizontal: 6 }}><Txt f="bold" size={10} color="#ffffff">Quyết chiến</Txt></View> : null}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </ScrollView>
      ) : null}
      <View style={{ position: 'absolute', right: 8, top: 8, gap: 6 }}>
        <Btn icon={ZoomIn} label="Phóng to bản đồ" tone="giay" size="sm" disabled={zi >= ZOOMS.length - 1} onPress={() => setZi((i) => Math.min(ZOOMS.length - 1, i + 1))} testID="map-zoom-in" />
        <Btn icon={ZoomOut} label="Thu nhỏ bản đồ" tone="giay" size="sm" disabled={zi === 0} onPress={() => setZi((i) => Math.max(0, i - 1))} testID="map-zoom-out" />
        {zi > 0 ? <Btn icon={Maximize2} label="Xem toàn bộ bản đồ" tone="giay" size="sm" onPress={() => setZi(() => 0)} testID="map-zoom-fit" /> : null}
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------- mục "Nhập vai" (phần thêm): thế giới khối 3D của các chặng
export const RolePlayScreen: React.FC<{ session: Session; nav: SagaNav }> = ({ session, nav }) => <RolePlayLobby session={session} nav={nav} />;
