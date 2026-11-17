/**
 * Cột bên phải của trang Chiến dịch (17/11/2026, bố cục theo kiểu Duolingo, giữ giao diện sáng của dự án):
 *  - dải chỉ số (chuỗi ngày, vàng, điểm kinh nghiệm, chặng) và thẻ cấp độ;
 *  - Giải đấu tuần: hạng của em, khoảng cách tới vùng lên hạng / xuống hạng; "Xem bảng" mở bảng xếp hạng nhóm (huy hiệu các hạng, vùng lên / xuống hạng);
 *  - Nhiệm vụ hằng ngày: mỗi nhiệm vụ một thanh tiến độ "x / y" và hòm báu (mở khi xong); "Xem tất cả" mở nhiệm vụ tháng, ngày, tuần;
 *  - Ôn tập nhanh và Kỳ thi.
 * Số liệu lấy từ máy chủ (/api/saga/home, /api/game/league, /api/game/quests); phần thưởng nhiệm vụ do máy chủ trao khi hoàn thành.
 * Không dùng hình ảnh / nhân vật của Duolingo: biểu tượng lucide, hòm báu và huy hiệu vẽ bằng SVG.
 */
import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { BookOpen, ChevronDown, ChevronUp, ClipboardCheck, Clock, Coins, Flag, Flame, Lock, RotateCcw, Star, Swords, Target, Zap } from 'lucide-react-native';
import * as game from '@/api/gameApi';
import { Mascot } from '@/components/art';
import type { Session } from '@/components/auth';
import { BlockTitle, Meter, num, useLoad, type SagaNav } from '@/components/portal/SagaKit';
import { Avatar, Btn, Card, Sheet, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { IconType } from '@/types/game';
import type { GameQuest, GameQuests, LeagueView } from '@/types/gamification';

// ---------------------------------------------------------------------- hình vẽ: hòm báu, huy hiệu giải đấu
/** Hòm báu vẽ bằng SVG: khóa (xám), sẵn sàng (gỗ – vàng), đã mở (nắp mở, có vàng bên trong) */
export const ChestArt: React.FC<{ size?: number; state: 'locked' | 'ready' | 'opened' }> = ({ size = 32, state }) => {
  const wood = state === 'locked' ? '#9aa1ab' : '#b45309';
  const dark = state === 'locked' ? '#6b7280' : '#7c2d12';
  const trim = state === 'locked' ? '#c7ccd3' : '#facc15';
  const h = size * 0.86;
  return (
    <Svg width={size} height={h} viewBox="0 0 40 34" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {state === 'opened' ? (
        <>
          <Path d="M4 4 L36 4 L34 13 L6 13 Z" fill={wood} stroke={dark} strokeWidth={1.5} />
          <Rect x={4} y={14} width={32} height={6} fill="#3f1d0b" />
          <Circle cx={13} cy={16} r={3.2} fill="#fde047" stroke="#ca8a04" strokeWidth={1} />
          <Circle cx={20} cy={15} r={3.2} fill="#fde047" stroke="#ca8a04" strokeWidth={1} />
          <Circle cx={27} cy={16} r={3.2} fill="#fde047" stroke="#ca8a04" strokeWidth={1} />
        </>
      ) : (
        <Path d="M3 15 L3 9 Q3 3 9 3 L31 3 Q37 3 37 9 L37 15 Z" fill={wood} stroke={dark} strokeWidth={1.5} />
      )}
      <Rect x={3} y={15} width={34} height={17} rx={3} fill={wood} stroke={dark} strokeWidth={1.5} />
      <Rect x={9} y={state === 'opened' ? 15 : 3} width={3.5} height={state === 'opened' ? 17 : 29} fill={trim} />
      <Rect x={27.5} y={state === 'opened' ? 15 : 3} width={3.5} height={state === 'opened' ? 17 : 29} fill={trim} />
      {state === 'opened' ? null : <Rect x={16.5} y={12} width={7} height={8} rx={1.5} fill={trim} stroke={dark} strokeWidth={1} />}
    </Svg>
  );
};

const TIER_COLORS = ['#b45309', '#94a3b8', '#eab308', '#22c55e', '#0ea5e9', '#a855f7', '#ec4899', '#475569'];
/** Huy hiệu một hạng giải đấu: hình lục giác màu theo hạng; hạng chưa tới thì xám có ổ khóa */
const TierBadge: React.FC<{ index: number; size?: number; locked?: boolean; current?: boolean }> = ({ index, size = 40, locked = false, current = false }) => {
  const color = locked ? '#cbd5e1' : TIER_COLORS[index % TIER_COLORS.length];
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', opacity: locked ? 0.8 : 1 }}>
      <Svg width={size} height={size} viewBox="0 0 40 40" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Path d="M20 2 L36 11 L36 29 L20 38 L4 29 L4 11 Z" fill={color} stroke={current ? '#1f2937' : 'rgba(0,0,0,0.15)'} strokeWidth={current ? 2.5 : 1.5} />
        <Path d="M20 7 L31 13.5 L31 26.5 L20 33 L9 26.5 L9 13.5 Z" fill="rgba(255,255,255,0.25)" />
      </Svg>
      {locked ? <View style={{ position: 'absolute' }}><Lock size={size * 0.38} color="#64748b" /></View> : null}
    </View>
  );
};

// ---------------------------------------------------------------------- tiện ích thời gian (giờ Việt Nam)
const VN = 7 * 3600_000;
const vnStart = (day: string): number => Date.parse(`${day}T00:00:00+07:00`);
const hoursUntil = (day: string): number => Math.max(1, Math.ceil((vnStart(day) - Date.now()) / 3600_000));
const daysUntil = (iso: string): number => Math.max(1, Math.ceil((Date.parse(iso) - Date.now()) / 86400_000));
const vnNow = (): Date => new Date(Date.now() + VN);

// ---------------------------------------------------------------------- nhiệm vụ
const QUEST_ICON: Record<string, { icon: IconType; color: string }> = {
  xp_earned: { icon: Zap, color: '#eab308' },
  correct_answers: { icon: Target, color: '#16a34a' },
  nodes_completed: { icon: BookOpen, color: '#0284c7' },
  lessons_completed: { icon: BookOpen, color: '#0284c7' },
  battles_completed: { icon: Swords, color: '#dc2626' },
  study_minutes: { icon: Clock, color: '#0284c7' },
};

/** Một nhiệm vụ: biểu tượng, tên, thanh tiến độ có chữ "x / y" và hòm báu ở cuối (mở khi xong) */
const QuestRow: React.FC<{ q: GameQuest; last?: boolean }> = ({ q, last }) => {
  const { c } = useTheme();
  const meta = QUEST_ICON[q.metric] ?? { icon: Star, color: c.vangChu };
  const done = Boolean(q.completed_at);
  const value = q.target ? Math.min(1, q.progress / q.target) : 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.adminLine }}
      accessible accessibilityLabel={`${q.title}: ${Math.min(q.progress, q.target)} trên ${q.target}${done ? ', đã xong' : ''}. Thưởng ${q.reward_xp} điểm${q.reward_gold ? `, ${q.reward_gold} vàng` : ''}`}>
      <meta.icon size={26} color={meta.color} />
      <View style={{ flex: 1, gap: 6 }}>
        <Txt f="bold" size={13} numberOfLines={2}>{q.title}</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1, height: 16, borderRadius: 8, backgroundColor: c.adminLine, overflow: 'hidden', justifyContent: 'center' }}>
            <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.round(value * 100)}%`, backgroundColor: done ? c.moc : c.vang, borderRadius: 8 }} />
            <Txt f="bold" size={10} center color={c.muc}>{Math.min(q.progress, q.target)} / {q.target}</Txt>
          </View>
          <ChestArt size={26} state={done ? 'opened' : 'ready'} />
        </View>
      </View>
    </View>
  );
};

/** Bảng nhiệm vụ đầy đủ: nhiệm vụ tháng, nhiệm vụ hằng ngày (còn mấy giờ), nhiệm vụ tuần (còn mấy ngày) */
const QuestsSheet: React.FC<{ data: GameQuests; onClose: () => void }> = ({ data, onClose }) => {
  const { c } = useTheme();
  const now = vnNow();
  const month = now.getUTCMonth() + 1;
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), month, 0)).getUTCDate();
  const monthLeft = daysInMonth - now.getUTCDate() + 1;
  const monthly = data.monthly ?? { completed: 0, target: 20 };
  return (
    <Sheet open onClose={onClose} title="Nhiệm vụ" subtitle="Hoàn thành nhiệm vụ để nhận điểm kinh nghiệm và vàng" wide>
      <View style={{ gap: 18 }} testID="quests-sheet">
        <View style={{ borderRadius: 14, backgroundColor: c.son, padding: 16, gap: 10 }}>
          <View style={{ alignSelf: 'flex-start', backgroundColor: '#ffffff', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}><Txt f="heavy" size={11} color={c.son}>THÁNG {month}</Txt></View>
          <Txt f="bold" size={20} color="#ffffff">Nhiệm vụ tháng {month}</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Clock size={14} color="#ffffff" /><Txt f="bold" size={12} color="#ffffff">CÒN {monthLeft} NGÀY</Txt></View>
          <View style={{ borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.28)', padding: 12, gap: 8 }}>
            <Txt f="bold" size={14} color="#ffffff">Hoàn thành {monthly.target} nhiệm vụ</Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1, height: 16, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden', justifyContent: 'center' }}>
                <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.round(Math.min(1, monthly.completed / Math.max(1, monthly.target)) * 100)}%`, backgroundColor: '#ffffff', borderRadius: 8 }} />
                <Txt f="bold" size={10} center color={c.son}>{Math.min(monthly.completed, monthly.target)} / {monthly.target}</Txt>
              </View>
              <Mascot size={36} mood="happy" />
            </View>
          </View>
        </View>
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Txt f="bold" size={17}>Nhiệm vụ hằng ngày</Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Clock size={14} color={c.vangChu} /><Txt f="bold" size={12} color={c.vangChu}>CÒN {hoursUntil(data.resets.daily)} GIỜ</Txt></View>
          </View>
          <Card flat pad={12} style={{ borderRadius: 12 }}>{data.daily.map((q, i) => <QuestRow key={q.id} q={q} last={i === data.daily.length - 1} />)}</Card>
        </View>
        {data.weekly.length ? (
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Txt f="bold" size={17}>Nhiệm vụ tuần</Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Clock size={14} color={c.vangChu} /><Txt f="bold" size={12} color={c.vangChu}>CÒN {daysUntil(`${data.resets.weekly}T00:00:00+07:00`)} NGÀY</Txt></View>
            </View>
            <Card flat pad={12} style={{ borderRadius: 12 }}>{data.weekly.map((q, i) => <QuestRow key={q.id} q={q} last={i === data.weekly.length - 1} />)}</Card>
          </View>
        ) : null}
      </View>
    </Sheet>
  );
};

// ---------------------------------------------------------------------- giải đấu
const me = (l: LeagueView) => l.entries.find((e) => e.me) ?? null;

/** Bảng xếp hạng nhóm trong giải tuần: huy hiệu các hạng, số người lên hạng, ngày còn lại, vùng lên / xuống hạng */
const LeagueSheet: React.FC<{ data: LeagueView; onClose: () => void }> = ({ data, onClose }) => {
  const { c } = useTheme();
  const size = data.entries.length;
  return (
    <Sheet open onClose={onClose} title={`Giải ${data.tier_name}`} subtitle={`Nhóm ${size} bạn cùng hạng trong tuần`} wide>
      <View style={{ gap: 14 }} testID="league-sheet">
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {data.tiers.map((t, i) => <TierBadge key={t} index={i} size={i === data.tier ? 58 : 40} current={i === data.tier} locked={i > data.tier} />)}
        </View>
        <View style={{ alignItems: 'center', gap: 2 }}>
          <Txt f="bold" size={20}>Giải {data.tier_name}</Txt>
          {data.promote ? <Txt size={14} color={c.muc2}>Top {data.promote} lên giải tiếp theo</Txt> : null}
          <Txt f="bold" size={14} color={c.vangChu}>Còn {daysUntil(data.ends_at)} ngày</Txt>
        </View>
        <View style={{ borderTopWidth: 1, borderTopColor: c.adminLine }}>
          {data.entries.map((e, i) => (
            <React.Fragment key={`${e.rank}-${e.name}`}>
              {data.demote && i === size - data.demote && size > data.demote ? (
                <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 10 }}>
                  <ChevronDown size={18} color={c.sonChu} /><Txt f="heavy" size={12} color={c.sonChu} style={{ letterSpacing: 0.8 }}>VÙNG XUỐNG HẠNG</Txt><ChevronDown size={18} color={c.sonChu} />
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: e.me ? c.adminTint : 'transparent' }}
                accessible accessibilityLabel={`Hạng ${e.rank}: ${e.name}, ${e.xp} điểm${e.zone === 'promote' ? ', vùng lên hạng' : e.zone === 'demote' ? ', vùng xuống hạng' : ''}`}>
                <Txt f="bold" size={14} color={e.zone === 'promote' ? c.mocChu : e.zone === 'demote' ? c.sonChu : c.muc2} style={{ width: 24, textAlign: 'center' }}>{e.rank}</Txt>
                <Avatar name={e.name} size={34} />
                <Txt f={e.me ? 'heavy' : 'bold'} size={14} color={e.me ? c.mocChu : c.muc} numberOfLines={1} style={{ flex: 1 }}>{e.name}</Txt>
                <Txt f="semibold" size={13} color={c.muc2}>{num(e.xp)} điểm</Txt>
              </View>
              {data.promote && i === data.promote - 1 && size > data.promote ? (
                <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 10 }}>
                  <ChevronUp size={18} color={c.mocChu} /><Txt f="heavy" size={12} color={c.mocChu} style={{ letterSpacing: 0.8 }}>VÙNG LÊN HẠNG</Txt><ChevronUp size={18} color={c.mocChu} />
                </View>
              ) : null}
            </React.Fragment>
          ))}
        </View>
      </View>
    </Sheet>
  );
};

// ---------------------------------------------------------------------- cột bên phải
export const SagaRail: React.FC<{ session: Session; nav: SagaNav; wide: boolean }> = ({ session, nav, wide }) => {
  const { c } = useTheme();
  const quests = useLoad<GameQuests>(session, (t) => game.gameQuests(t), [nav.home?.hud.xp]);
  const league = useLoad<LeagueView>(session, (t) => game.leagueView(t), [nav.home?.hud.xp]);
  const [sheet, setSheet] = React.useState<'league' | 'quests' | null>(null);
  const home = nav.home;
  const hud = home?.hud;
  if (!home || !hud) return null;
  const level = hud.level;
  const mine = league.data ? me(league.data) : null;
  const stats: Array<{ icon: IconType; value: string; label: string; color: string }> = [
    { icon: Flame, value: num(hud.streak.current), label: 'ngày liên tiếp', color: '#f97316' },
    { icon: Coins, value: num(hud.gold), label: 'vàng', color: '#ca8a04' },
    { icon: Zap, value: num(hud.xp), label: 'điểm kinh nghiệm', color: '#16a34a' },
    { icon: Flag, value: `${home.totals.done}/${home.totals.stages}`, label: 'chặng đã xong', color: '#0284c7' },
  ];
  const leagueLine = !league.data || !mine ? 'Học để có điểm kinh nghiệm và vào bảng xếp hạng tuần này.'
    : mine.zone === 'promote' ? 'Em đang ở vùng lên hạng, giữ vững nhé!'
    : mine.zone === 'demote' ? 'Em đang ở vùng xuống hạng – học thêm để vượt lên!'
    : league.data.promote ? `Còn ${mine.rank - league.data.promote} hạng nữa là vào vùng lên hạng.` : 'Học thêm để tăng hạng trong tuần.';
  return (
    <View style={{ gap: 14, width: wide ? 330 : '100%' }} testID="saga-rail">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingHorizontal: 4 }} testID="home-metrics">
        {stats.map((s) => (
          <View key={s.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }} accessible accessibilityLabel={`${s.value} ${s.label}`}>
            <s.icon size={20} color={s.color} /><Txt f="heavy" size={15} color={s.color}>{s.value}</Txt>
          </View>
        ))}
      </View>
      <Card flat pad={14} style={{ borderRadius: 14, gap: 8 }} testID="home-level">
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Txt f="bold" size={15}>Cấp {level.level} · {level.title}</Txt>
          <Txt size={12} color={c.muc3}>{level.next_xp ? `${num(hud.xp)}/${num(level.next_xp)} điểm` : 'cấp cao nhất'}</Txt>
        </View>
        <Meter value={level.progress / 100} label={`Cấp ${level.level}, ${level.title}. ${num(hud.xp)} điểm kinh nghiệm`} />
      </Card>
      <Card flat pad={14} style={{ borderRadius: 14, gap: 10 }} testID="rail-league">
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Txt f="bold" size={16}>{league.data ? `Giải ${league.data.tier_name}` : 'Giải đấu tuần'}</Txt>
          <Btn title="XEM BẢNG" tone="ghost" size="sm" disabled={!league.data} onPress={() => setSheet('league')} testID="rail-league-open" />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TierBadge index={league.data?.tier ?? 0} size={46} />
          <View style={{ flex: 1, gap: 2 }}>
            {mine ? <Txt f="bold" size={15}>Em đang xếp hạng <Txt f="heavy" size={15} color={c.mocChu}>#{mine.rank}</Txt></Txt> : null}
            <Txt size={13} color={c.muc2}>{league.error ? 'Chưa tải được bảng xếp hạng.' : leagueLine}</Txt>
          </View>
        </View>
      </Card>
      <Card flat pad={14} style={{ borderRadius: 14, gap: 2 }} testID="rail-quests">
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Txt f="bold" size={16}>Nhiệm vụ hằng ngày</Txt>
          <Btn title="XEM TẤT CẢ" tone="ghost" size="sm" disabled={!quests.data} onPress={() => setSheet('quests')} testID="rail-quests-open" />
        </View>
        {quests.data ? quests.data.daily.map((q, i) => <QuestRow key={q.id} q={q} last={i === quests.data!.daily.length - 1} />)
          : <Txt size={13} color={c.muc3}>{quests.error ? 'Chưa tải được nhiệm vụ.' : 'Đang tải nhiệm vụ…'}</Txt>}
      </Card>
      <Card flat pad={14} style={{ borderRadius: 14, gap: 8 }}>
        <BlockTitle title={home.review_due ? `${home.review_due} câu cần ôn lại` : 'Ôn tập nhanh'} icon={RotateCcw} />
        <Txt size={13} color={c.muc2}>{home.review_due ? 'Những câu em từng trả lời sai đang chờ.' : 'Trả lời câu hỏi tính giờ để giữ chuỗi đúng.'}</Txt>
        <Btn title="Ôn tập" icon={RotateCcw} tone="giay" size="sm" onPress={() => nav.go('cau-hoi', { c: null, s: null, v: null })} testID="home-review" />
      </Card>
      <Card flat pad={14} style={{ borderRadius: 14, gap: 8 }}>
        <BlockTitle title="Kỳ thi" icon={ClipboardCheck} />
        <Txt size={13} color={c.muc2}>Bài kiểm tra giữa kỳ, cuối kỳ thầy cô tổ chức; vào giờ thi nhập mật khẩu để làm.</Txt>
        <Btn title="Mở Kỳ thi" icon={ClipboardCheck} tone="giay" size="sm" onPress={() => nav.go('ky-thi', { c: null, s: null, v: null })} testID="home-exams" />
      </Card>
      {sheet === 'league' && league.data ? <LeagueSheet data={league.data} onClose={() => setSheet(null)} /> : null}
      {sheet === 'quests' && quests.data ? <QuestsSheet data={quests.data} onClose={() => setSheet(null)} /> : null}
    </View>
  );
};
