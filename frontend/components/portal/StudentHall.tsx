/**
 * Sảnh học sinh dạng trang cuộn dọc (20/11/2026, người dùng gửi ảnh VL-LEGEND và chọn: bỏ menu trái, trang cuộn dọc, danh hiệu khoa cử thời Trần,
 * đủ bốn phần). Thứ tự: màn mở đầu cung điện có nút VÀO TRẬN → giới thiệu (Học – Luyện – Ra trận) → thang danh hiệu 5 bậc → bảng vàng
 * (bảng xếp hạng dạng sân khấu) → thư viện tranh. Chỉ lấy thể loại của trang mẫu; hình vẽ, tên gọi và nội dung là của Đông A (StudentArt.tsx).
 *
 * Danh hiệu là cách hiển thị tiến độ do máy chủ trả về (/api/saga/home: phần đã xong, số sao) – không trao thưởng, không lưu gì ở giao diện:
 *   Học trò (bắt đầu) → Thái học sinh (xong Phần 1 · 1258) → Thám hoa (xong Phần 2 · 1285) → Bảng nhãn (xong Phần 3 · 1287–1288)
 *   → Trạng nguyên (đủ sao tối đa của cả ba phần).
 * Dữ kiện lịch sử (Wikipedia tiếng Việt, đã đối chiếu 20/11/2026): học vị Thái học sinh có từ khoa thi Nhâm Thìn (1232) đời Trần Thái Tông;
 * Tam khôi đặt lần đầu năm 1247 – Trạng nguyên Nguyễn Hiền (các nguồn chép 12 hoặc 13 tuổi), Bảng nhãn Lê Văn Hưu (soạn Đại Việt sử ký, xong 1272),
 * Thám hoa Đặng Ma La.
 * Bảng vàng dùng API bảng xếp hạng sẵn có (/api/game/leaderboard: lớp của em hoặc toàn trường); ba bạn dẫn đầu là "Tam khôi" của bảng.
 */
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Award, BookOpen, Check, Lock, Map as MapIcon, Puzzle, Swords, ZoomIn } from 'lucide-react-native';
import * as game from '@/api/gameApi';
import type { Session } from '@/components/auth';
import { LoadState, TONE, mapSource, num, useLoad } from '@/components/portal/SagaKit';
import { Chibi, PalaceScene, RANK_LOOK, RankScene, Scholar, ScholarPair, StageBackdrop } from '@/components/portal/StudentArt';
import { Sheet, Txt } from '@/components/ui';
import { RANKS, scholarRank, type RankState } from '@/lib/scholar-rank';
import type { IconType } from '@/types/game';
import type { Board } from '@/types/gamification';
import type { SagaHome } from '@/types/saga';

/** Màu riêng của sảnh: sơn son, vàng kim, giấy dó (chữ trên nền giấy đạt tương phản ≥ 4,5 : 1) */
export const HALL = {
  red: '#b8261b', redDeep: '#8f1f17', lacquer: '#5b1a14', gold: '#e3b244', goldSoft: '#f6dc97',
  paper: '#fffaf0', paperLine: '#ecd9b4', ink: '#2b1d16', muted: '#6b5644', wood: '#8a5a2b',
};

// ---------------------------------------------------------------------- danh hiệu (tính trong lib/scholar-rank.ts, có kiểm thử)
export { RANKS, scholarRank, type RankState };

// ---------------------------------------------------------------------- tiện ích chung
function useCalm(): boolean {
  const [calm, setCalm] = useState(true); // đứng yên cho tới khi biết máy không bật giảm chuyển động
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().then((r) => { if (live) setCalm(r); }).catch(() => undefined);
    return () => { live = false; };
  }, []);
  return calm;
}

/** Nhún nhẹ lên xuống (nhân vật trang trí); đứng yên khi bật giảm chuyển động */
const Bob: React.FC<{ children: React.ReactNode; delay?: number }> = ({ children, delay = 0 }) => {
  const calm = useCalm();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (calm) { v.setValue(0); return undefined; }
    const a = Animated.loop(Animated.sequence([Animated.delay(delay),
      Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      Animated.timing(v, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: false })]));
    a.start();
    return () => a.stop();
  }, [calm, delay, v]);
  return <Animated.View style={{ transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] }}>{children}</Animated.View>;
};

const Progress: React.FC<{ done: number; total: number; label: string; light?: boolean }> = ({ done, total, label, light = false }) => {
  const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((done / total) * 100))) : 0;
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: pct }}
      style={{ height: 10, borderRadius: 5, backgroundColor: light ? 'rgba(255,255,255,0.25)' : '#efe1c4', overflow: 'hidden', alignSelf: 'stretch' }}>
      <View style={{ width: `${pct}%`, height: '100%', borderRadius: 5, backgroundColor: HALL.gold }} />
    </View>
  );
};

/** Tiêu đề phần: dòng nhỏ chữ son, tiêu đề đậm + nửa sau nghiêng có chân màu son (như tiêu đề trang chủ) */
export const HallTitle: React.FC<{ eyebrow: string; ink: string; red: string; sub?: string; center?: boolean }> = ({ eyebrow, ink, red, sub, center = false }) => {
  const { width } = useWindowDimensions();
  const size = width < 600 ? 25 : 30;
  return (
    <View style={{ gap: 6, alignItems: center ? 'center' : 'flex-start' }}>
      <Txt f="bold" size={12} color={HALL.red} style={{ letterSpacing: 1.8 }}>{eyebrow}</Txt>
      <Txt f="heavy" size={size} color={HALL.ink} center={center} accessibilityRole="header" style={{ lineHeight: size + 9 }}>
        {ink} <Txt f="serifItalic" size={size + 2} color={HALL.red}>{red}</Txt>
      </Txt>
      {sub ? <Txt size={15} color={HALL.muted} center={center} style={{ lineHeight: 23, maxWidth: 720 }}>{sub}</Txt> : null}
    </View>
  );
};

/** Nút cuộn giấy: thân giấy son, hai trục gỗ viền vàng */
export const ScrollButton: React.FC<{ title: string; sub?: string; label: string; onPress: () => void; testID?: string }> = ({ title, sub, label, onPress, testID }) => {
  const rod = <View style={{ width: 16, height: 80, borderRadius: 8, backgroundColor: '#5b3520', borderWidth: 2, borderColor: HALL.gold, zIndex: 1 }} />;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} testID={testID}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', alignSelf: 'center', transform: [{ translateY: pressed ? 3 : 0 }], opacity: pressed ? 0.94 : 1, cursor: 'pointer' } as object)}>
      {rod}
      <View style={{ minHeight: 64, minWidth: 190, paddingHorizontal: 30, paddingVertical: 8, marginHorizontal: -5, backgroundColor: HALL.red, borderTopWidth: 3, borderBottomWidth: 3, borderColor: HALL.gold, alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 0 #6e140d' } as object}>
        <Txt f="heavy" size={24} color="#fff3cf" style={{ letterSpacing: 3 }}>{title}</Txt>
        {sub ? <Txt f="semibold" size={12} color="#ffe2a8" numberOfLines={1} style={{ maxWidth: 230 }}>{sub}</Txt> : null}
      </View>
      {rod}
    </Pressable>
  );
};

// ---------------------------------------------------------------------- 1. màn mở đầu
export const HallHero: React.FC<{ home: SagaHome; rank: RankState; onPlay: () => void; onMap: () => void }> = ({ home, rank, onPlay, onMap }) => {
  const { width } = useWindowDimensions();
  const compact = width < 680;
  const next = home.next;
  const finished = home.totals.stages > 0 && home.totals.done >= home.totals.stages;
  const now = RANKS[rank.level], up = RANKS[rank.level + 1];
  const fig = compact ? 100 : 136;
  const text = next
    ? `${home.learner.name} ơi, chặng “${next.title}” đang chờ em. Qua từng chặng để từ ${now.name} tiến lên Trạng nguyên!`
    : finished ? 'Em đã đi trọn ba phần của hành trình. Ôn lại các chặng để giữ đủ sao và danh hiệu của em.'
    : 'Ba lần kháng chiến chống quân Mông – Nguyên (1258, 1285, 1287–1288) đang chờ em khám phá.';
  const play = (
    <ScrollButton title="VÀO TRẬN" sub={next ? next.title : 'Bản đồ hành trình'} onPress={onPlay} testID="hall-play"
      label={next ? `Vào trận: ${next.title}` : 'Vào trận: mở bản đồ hành trình'} />
  );
  const mapLink = (
    <Pressable accessibilityRole="button" accessibilityLabel="Xem bản đồ hành trình" onPress={onMap} testID="hall-map"
      style={({ pressed }) => ({ minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, borderRadius: 16, backgroundColor: pressed ? '#fff1d6' : '#fffaf0', borderWidth: 2, borderBottomWidth: 4, borderColor: HALL.paperLine })}>
      <MapIcon size={18} color={HALL.red} strokeWidth={2.6} /><Txt f="heavy" size={14} color={HALL.ink}>Xem bản đồ hành trình</Txt>
    </Pressable>
  );
  return (
    <View testID="hall-hero" style={{ borderRadius: 28, overflow: 'hidden', minHeight: compact ? 560 : 450, backgroundColor: '#fde3bd', borderWidth: 2, borderBottomWidth: 6, borderColor: '#e6c48c' }}>
      <PalaceScene style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
      <View style={{ padding: compact ? 14 : 26, alignItems: 'center' }}>
        <View style={{ backgroundColor: 'rgba(255,250,240,0.95)', borderRadius: 22, paddingHorizontal: compact ? 16 : 30, paddingVertical: compact ? 14 : 18, gap: 8, alignItems: 'center', maxWidth: 680, borderWidth: 2, borderBottomWidth: 5, borderColor: HALL.paperLine }}>
          <Txt f="bold" size={12} color={HALL.red} style={{ letterSpacing: 2 }}>HÀO KHÍ ĐÔNG A · KHOA BẢNG</Txt>
          <Txt f="heavy" size={compact ? 29 : 40} color={HALL.ink} center accessibilityRole="header" style={{ lineHeight: compact ? 37 : 50 }}>
            Muốn làm <Txt f="serifItalic" size={compact ? 31 : 43} color={HALL.red}>Trạng nguyên?</Txt>
          </Txt>
          <Txt size={15} color={HALL.muted} center style={{ lineHeight: 23 }}>{text}</Txt>
          <View testID="hall-rank" style={{ alignSelf: 'stretch', gap: 6, marginTop: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, flexWrap: 'wrap' }}>
              <Award size={17} color={HALL.red} />
              <Txt f="bold" size={14} color={HALL.ink}>Danh hiệu của em: {now.name}</Txt>
              {up && rank.next ? <Txt size={13} color={HALL.muted}>· {rank.next.done}/{rank.next.total} {rank.next.unit} tới {up.name}</Txt> : null}
            </View>
            {up && rank.next ? <Progress done={rank.next.done} total={rank.next.total} label={`Tiến độ tới danh hiệu ${up.name}`} /> : null}
          </View>
        </View>
      </View>
      <View style={{ marginTop: 'auto', paddingBottom: compact ? 16 : 24, alignItems: 'center', gap: 10 }}>
        {compact ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
              <Bob><Scholar rank={rank.level} gender="nam" size={fig} /></Bob>
              <Bob delay={450}><Scholar rank={rank.level} gender="nu" size={fig} flip /></Bob>
            </View>
            {play}{mapLink}
          </>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 20 }}>
            <Bob><Scholar rank={rank.level} gender="nam" size={fig} /></Bob>
            <View style={{ alignItems: 'center', gap: 12, marginBottom: 18 }}>{play}{mapLink}</View>
            <Bob delay={450}><Scholar rank={rank.level} gender="nu" size={fig} flip /></Bob>
          </View>
        )}
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------- 2. giới thiệu
const STEPS: ReadonlyArray<{ icon: IconType; title: string; text: string; color: string; edge: string }> = [
  { icon: BookOpen, color: '#d6281e', edge: '#a11a12', title: 'Học', text: 'Đọc thẻ kiến thức ngắn có ghi nguồn: ai, ở đâu, khi nào, vì sao.' },
  { icon: Puzzle, color: '#46a840', edge: '#2e7d2c', title: 'Luyện', text: 'Chơi minigame: trắc nghiệm, ghép cặp, sắp thứ tự, tìm vị trí trên bản đồ.' },
  { icon: Swords, color: '#e09a12', edge: '#a86d00', title: 'Ra trận', text: 'Nhập vai người lính nhà Trần, nhận quân lệnh rồi bước vào trận đánh.' },
];
export const HallSteps: React.FC = () => (
  <View style={{ gap: 16 }} testID="hall-intro">
    <HallTitle eyebrow="GIỚI THIỆU" ink="Học – Luyện –" red="Ra trận" sub="Mỗi chặng của Hành trình Đông A gồm ba bước. Xong mỗi phần (mỗi cuộc kháng chiến), danh hiệu của em lên một bậc." />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {STEPS.map(({ icon: Icon, title, text, color, edge }, i) => (
        <View key={title} style={{ flexGrow: 1, flexBasis: 240, flexDirection: 'row', gap: 12, padding: 16, borderRadius: 20, backgroundColor: '#ffffff', borderWidth: 2, borderBottomWidth: 5, borderColor: HALL.paperLine }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: color, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 4, borderBottomColor: edge }}><Icon size={24} color="#ffffff" strokeWidth={2.6} /></View>
          <View style={{ flex: 1, gap: 3 }}>
            <Txt f="heavy" size={16} color={HALL.ink}>{i + 1}. {title}</Txt>
            <Txt size={14} color={HALL.muted} style={{ lineHeight: 21 }}>{text}</Txt>
          </View>
        </View>
      ))}
    </View>
  </View>
);

// ---------------------------------------------------------------------- 3. thang danh hiệu
const RankCard: React.FC<{ i: number; rank: RankState; selected: boolean; onPress: () => void; fixed: boolean }> = ({ i, rank, selected, onPress, fixed }) => {
  const r = RANKS[i], L = RANK_LOOK[i];
  const current = i === rank.level;
  const state = i <= rank.level ? 'done' : i === rank.level + 1 ? 'next' : 'locked';
  const status = current ? 'Em đang ở bậc này' : state === 'done' ? 'Đã đạt' : state === 'next' && rank.next ? `Đang tới: ${rank.next.done}/${rank.next.total} ${rank.next.unit}` : 'Chưa mở';
  return (
    <Pressable testID={`rank-card-${r.key}`} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }}
      accessibilityLabel={`Bậc ${i + 1}: ${r.name}. ${r.need}. ${status}`}
      style={({ pressed }) => ({ flex: fixed ? 1 : undefined, width: fixed ? undefined : 196, borderRadius: 20, overflow: 'hidden', backgroundColor: '#ffffff',
        borderWidth: current || selected ? 3 : 2, borderBottomWidth: 6, borderColor: current ? HALL.gold : selected ? HALL.red : HALL.paperLine, transform: [{ translateY: pressed ? 2 : 0 }] })}>
      <View style={{ backgroundColor: L.soft, height: 136, alignItems: 'center', justifyContent: 'flex-end' }}>
        <View style={{ opacity: state === 'locked' ? 0.4 : 1 }}><ScholarPair rank={i} size={150} /></View>
        {current ? <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: HALL.red, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}><Txt f="bold" size={11} color="#fff3cf">EM Ở ĐÂY</Txt></View> : null}
        {state === 'locked' ? <View style={{ position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(43,29,22,0.7)', alignItems: 'center', justifyContent: 'center' }}><Lock size={15} color="#fff3cf" /></View> : null}
        {state === 'done' && !current ? <View style={{ position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: '#1d7a68', alignItems: 'center', justifyContent: 'center' }}><Check size={16} color="#ffffff" /></View> : null}
      </View>
      <View style={{ padding: 12, gap: 3 }}>
        <Txt f="bold" size={11} color={HALL.muted} style={{ letterSpacing: 1 }}>BẬC {i + 1}</Txt>
        <Txt f="heavy" size={17} color={HALL.ink}>{r.name}</Txt>
        <Txt size={13} color={HALL.muted} numberOfLines={2}>{r.need}</Txt>
        <Txt f="bold" size={12} color={current ? HALL.red : state === 'done' ? '#145a4c' : HALL.muted} style={{ marginTop: 3 }}>{status}</Txt>
      </View>
    </Pressable>
  );
};

export const RankLadder: React.FC<{ rank: RankState }> = ({ rank }) => {
  const { width } = useWindowDimensions();
  const [sel, setSel] = useState(rank.level);
  useEffect(() => setSel(rank.level), [rank.level]);
  const fixed = width >= 1120, wide = width >= 820;
  const r = RANKS[sel], L = RANK_LOOK[sel];
  const cards = RANKS.map((_, i) => <RankCard key={i} i={i} rank={rank} selected={i === sel} onPress={() => setSel(i)} fixed={fixed} />);
  const reached = sel <= rank.level, aiming = sel === rank.level + 1;
  return (
    <View style={{ gap: 16 }} testID="rank-ladder">
      <HallTitle eyebrow="THANG DANH HIỆU" ink="Từ Học trò đến" red="Trạng nguyên"
        sub="Năm bậc lấy cảm hứng từ khoa cử thời Trần. Xong mỗi phần của hành trình, danh hiệu của em lên một bậc; đạt đủ sao ở cả ba phần thì đỗ Trạng nguyên. Bấm một bậc để xem chi tiết." />
      {fixed ? <View style={{ flexDirection: 'row', gap: 12 }}>{cards}</View>
        : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 4 }}>{cards}</ScrollView>}
      <View testID="rank-detail" style={{ flexDirection: wide ? 'row' : 'column', borderRadius: 24, overflow: 'hidden', backgroundColor: '#ffffff', borderWidth: 2, borderBottomWidth: 6, borderColor: HALL.paperLine }}>
        <View style={{ backgroundColor: L.soft, alignItems: 'center', justifyContent: 'flex-end', minHeight: 230, width: wide ? 330 : '100%' }}>
          <ScholarPair rank={sel} size={wide ? 280 : 240} />
        </View>
        <View style={{ flex: 1, padding: wide ? 24 : 18, gap: 10 }}>
          <Txt f="bold" size={12} color={HALL.red} style={{ letterSpacing: 1.4 }}>BẬC {sel + 1} / {RANKS.length}</Txt>
          <Txt f="heavy" size={26} color={HALL.ink} accessibilityRole="header">{r.name}</Txt>
          <Txt f="serif" size={18} color={HALL.ink} style={{ lineHeight: 27 }}>{r.note}</Txt>
          <Txt f="semibold" size={14} color={HALL.ink}>Điều kiện trong trò chơi: {r.need}</Txt>
          {reached ? <Txt f="bold" size={14} color="#145a4c">{sel === rank.level ? 'Đây là danh hiệu hiện tại của em.' : 'Em đã đạt danh hiệu này.'}</Txt>
            : aiming && rank.next ? (
              <View style={{ gap: 6 }}>
                <Txt f="bold" size={14} color={HALL.red}>Em đã có {rank.next.done}/{rank.next.total} {rank.next.unit}.</Txt>
                <Progress done={rank.next.done} total={rank.next.total} label={`Tiến độ tới danh hiệu ${r.name}`} />
              </View>
            ) : <Txt f="semibold" size={14} color={HALL.muted}>Đạt danh hiệu {RANKS[sel - 1]?.name ?? ''} trước để mở bậc này.</Txt>}
        </View>
      </View>
      <Txt size={12} color={HALL.muted} style={{ lineHeight: 18 }}>
        Nguồn: Wikipedia tiếng Việt – các mục Thái học sinh, Tam khôi, Lê Văn Hưu, Nguyễn Hiền. Thời xưa chỉ nam giới được dự thi; trong trò chơi, bạn nào cũng có thể ghi danh bảng vàng.
        Trang phục là hình vẽ cách điệu, không phục dựng.
      </Txt>
    </View>
  );
};

// ---------------------------------------------------------------------- 4. bảng vàng (bảng xếp hạng sân khấu)
type Scope = 'class' | 'school';
type Period = 'week' | 'month' | 'all';
const PERIOD_TEXT: Record<string, string> = { week: 'tuần này', month: 'tháng này', all: 'từ trước tới nay' };
/** Nhân vật trên bục là hình đại diện của danh hiệu (một dáng chung, đội mũ, tóc ngắn), không đoán giới tính của bạn đứng hạng đó */
const PODIUM = [
  { place: 1, costume: 4, title: 'Trạng nguyên', height: 124 },
  { place: 2, costume: 3, title: 'Bảng nhãn', height: 96 },
  { place: 3, costume: 2, title: 'Thám hoa', height: 74 },
];

/** Màu sân khấu bảng vàng (23/11/2026, "Sắc Việt"): tường cam son, rèm đỏ, đèn lồng (StageBackdrop); chữ luôn đặt trên nền tối / sáng đủ tương phản */
const STAGE = { plaque: '#3a140d', panel: 'rgba(36,16,10,0.86)', row: 'rgba(255,255,255,0.06)', line: 'rgba(255,226,168,0.18)', text: '#fff6e6', soft: '#f6dfc0' };
/** Màu vòng tròn số hạng từ hạng 4 trở đi (chỉ để dễ nhìn, không mang nghĩa) */
const RANK_DOT = ['#2f8f83', '#6a4fb3', '#2a6fb0', '#b5651d', '#c2417a', '#4f7d2c', '#8a5a2b'];

const Pill: React.FC<{ on: boolean; label: string; onPress: () => void; testID: string }> = ({ on, label, onPress, testID }) => (
  <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={label} onPress={onPress} testID={testID}
    style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 16, borderRadius: 22, justifyContent: 'center', backgroundColor: on ? HALL.gold : pressed ? 'rgba(36,16,10,0.75)' : 'rgba(36,16,10,0.55)', borderWidth: 2, borderBottomWidth: on ? 4 : 2, borderColor: on ? '#b98a1e' : 'rgba(255,226,168,0.55)' })}>
    <Txt f="heavy" size={13} color={on ? '#3a1a08' : STAGE.text}>{label}</Txt>
  </Pressable>
);

export const HallBoard: React.FC<{ session: Session; classId: number | null; className?: string | null }> = ({ session, classId, className }) => {
  const { width } = useWindowDimensions();
  const compact = width < 640;
  const sides = width >= 900;
  // chưa bấm chọn thì mặc định lớp của em (danh sách lớp có thể tải xong sau khi sảnh đã hiện)
  const [picked, setScope] = useState<Scope | null>(null);
  const scope: Scope = picked ?? (classId ? 'class' : 'school');
  const [period, setPeriod] = useState<Period>('week');
  const board = useLoad<Board>(session, (t) => game.leaderboard(t, scope === 'class' ? { scope, period, class_id: classId ?? undefined } : { scope }), [scope, period, classId]);
  const data = board.data && board.data.scope === scope ? board.data : null;
  const entries = data?.entries ?? [];
  // máy chủ gửi tối đa 20 bạn dẫn đầu, em ở ngoài thì thêm một hàng "Em" cuối danh sách: sảnh hiện 10 bạn đầu và hàng của em nếu em ngoài top 10
  const ranked = entries.slice(0, 10);
  const rest = ranked.slice(3);
  const meBelow = entries.slice(10).find((e) => e.me) ?? null;
  const shownPeriod = PERIOD_TEXT[data?.period ?? period] ?? '';
  const row = (e: Board['entries'][number], key: string, i: number) => (
    <View key={key} accessible accessibilityLabel={`Hạng ${e.rank}: ${e.name}, ${num(e.xp)} điểm`}
      style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, borderTopWidth: i ? 1 : 0, borderTopColor: STAGE.line, backgroundColor: e.me ? 'rgba(255,194,58,0.22)' : i % 2 ? STAGE.row : 'transparent' }}>
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: e.me ? HALL.gold : RANK_DOT[(e.rank - 4 + RANK_DOT.length * 4) % RANK_DOT.length], alignItems: 'center', justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: 'rgba(0,0,0,0.3)' }}>
        <Txt f="heavy" size={14} color={e.me ? '#3a1a08' : '#ffffff'}>{e.rank}</Txt>
      </View>
      <Txt f={e.me ? 'heavy' : 'bold'} size={15} color={e.me ? '#ffe7a6' : STAGE.text} numberOfLines={1} style={{ flex: 1 }}>{e.name}{e.me && e.name !== 'Em' ? ' (em)' : ''}</Txt>
      <Txt f="heavy" size={14} color={STAGE.soft}>{num(e.xp)} điểm</Txt>
    </View>
  );
  return (
    <View style={{ gap: 16 }}>
      <HallTitle eyebrow="BẢNG XẾP HẠNG" ink="Bảng vàng" red={shownPeriod} sub="Ba bạn dẫn đầu là Tam khôi của bảng: Trạng nguyên, Bảng nhãn, Thám hoa. Điểm do máy chủ cộng từ việc học của em." />
      <View testID="hall-board" style={{ borderRadius: 26, overflow: 'hidden', backgroundColor: '#d9532e', borderWidth: 2, borderBottomWidth: 6, borderColor: '#8a2a14' }}>
        <StageBackdrop style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
        {sides ? (
          <>
            <View pointerEvents="none" style={{ position: 'absolute', left: 54, bottom: 4 }}><Bob delay={200}><Chibi kind="quan" size={140} /></Bob></View>
            <View pointerEvents="none" style={{ position: 'absolute', right: 54, bottom: 4 }}><Bob delay={650}><Chibi kind="phu-nhan" size={140} flip /></Bob></View>
          </>
        ) : null}
        <View style={{ paddingHorizontal: compact ? 14 : sides ? 210 : 28, paddingTop: compact ? 64 : 76, paddingBottom: compact ? 22 : 34, gap: 18 }}>
          <View style={{ alignSelf: 'center', alignItems: 'center', paddingHorizontal: 26, paddingVertical: 10, borderRadius: 16, backgroundColor: STAGE.plaque, borderWidth: 3, borderColor: HALL.gold, gap: 2, boxShadow: '0 5px 0 rgba(0,0,0,0.3)' } as object}>
            <Txt f="heavy" size={compact ? 20 : 26} color={HALL.goldSoft} style={{ letterSpacing: 4 }}>BẢNG VÀNG</Txt>
            <Txt f="semibold" size={13} color={STAGE.soft} center>{data?.label ?? (scope === 'class' ? `Lớp ${className ?? ''}` : 'Toàn trường')} · {shownPeriod}</Txt>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
            {classId ? <Pill on={scope === 'class'} label={className ? `Lớp ${className}` : 'Lớp của em'} onPress={() => setScope('class')} testID="board-scope-class" /> : null}
            <Pill on={scope === 'school'} label="Toàn trường" onPress={() => setScope('school')} testID="board-scope-school" />
            {scope === 'class' ? (['week', 'month', 'all'] as Period[]).map((p) => <Pill key={p} on={period === p} label={p === 'week' ? 'Tuần' : p === 'month' ? 'Tháng' : 'Từ đầu'} onPress={() => setPeriod(p)} testID={`board-period-${p}`} />) : null}
          </View>
          {!data ? <View style={{ backgroundColor: HALL.paper, borderRadius: 16, padding: 12 }}><LoadState loading={board.loading} error={board.error} onRetry={board.reload} /></View>
            : data.disabled ? <View style={{ backgroundColor: HALL.paper, borderRadius: 16, padding: 16 }}><Txt f="semibold" size={15} color={HALL.ink} center>{data.message ?? 'Bảng xếp hạng đang tắt.'}</Txt></View>
            : (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: compact ? 6 : 14 }} testID="board-podium">
                  {[PODIUM[1], PODIUM[0], PODIUM[2]].map((p) => {
                    const e = ranked[p.place - 1] ?? null;
                    return (
                      <View key={p.place} testID={`podium-${p.place}`} accessible accessibilityLabel={e ? `${p.title} của bảng – hạng ${e.rank}: ${e.name}, ${num(e.xp)} điểm` : `${p.title} của bảng: còn trống`}
                        style={{ width: compact ? 104 : 150, alignItems: 'center' }}>
                        <Bob delay={p.place * 300}><View style={{ opacity: e ? 1 : 0.4 }}><Scholar rank={p.costume} size={compact ? 72 : 98} /></View></Bob>
                        <View style={{ marginTop: -6, maxWidth: '100%', alignItems: 'center', backgroundColor: e?.me ? '#fff0c4' : '#fffaf0', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 2, borderColor: HALL.gold }}>
                          <Txt f="heavy" size={13} color={e?.me ? HALL.red : HALL.ink} numberOfLines={1}>{e ? e.name : 'Còn trống'}</Txt>
                          <Txt f="semibold" size={11} color={HALL.muted}>{e ? `${num(e.xp)} điểm` : '—'}</Txt>
                        </View>
                        <View style={{ marginTop: 6, alignSelf: 'stretch', height: compact ? p.height - 14 : p.height, borderTopLeftRadius: 12, borderTopRightRadius: 12, backgroundColor: p.place === 1 ? '#ffc23a' : p.place === 2 ? '#e9e4dc' : '#e0a06a', borderTopWidth: 4, borderColor: p.place === 1 ? '#fff0b8' : '#ffffff', alignItems: 'center', paddingTop: 6, borderBottomWidth: 0 }}>
                          <Txt f="heavy" size={compact ? 24 : 30} color={p.place === 1 ? '#6e4b00' : '#4a2a18'}>{e?.rank ?? p.place}</Txt>
                          <Txt f="heavy" size={11} color={p.place === 1 ? '#6e4b00' : '#4a2a18'} center>{p.title}</Txt>
                        </View>
                      </View>
                    );
                  })}
                </View>
                <View testID="board-list" style={{ backgroundColor: STAGE.panel, borderRadius: 18, borderWidth: 2, borderColor: 'rgba(255,226,168,0.45)', overflow: 'hidden', marginTop: -18 }}>
                  {rest.map((e, i) => row(e, `r${i}`, i))}
                  {meBelow ? row(meBelow, 'me', rest.length) : null}
                  {!entries.length ? <Txt f="semibold" size={14} color={STAGE.text} center style={{ padding: 16 }}>Chưa có ai ghi điểm {shownPeriod}. Học một chặng để ghi tên lên bảng vàng!</Txt>
                    : !rest.length && !meBelow ? <Txt f="semibold" size={13} color={STAGE.soft} center style={{ padding: 12 }}>Bảng mới có {ranked.length} bạn ghi điểm.</Txt> : null}
                  {scope === 'school' ? <Txt size={12} color={STAGE.soft} center style={{ paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: STAGE.line }}>Bảng toàn trường chỉ hiện biệt danh của các bạn; bạn chưa đặt biệt danh được ẩn tên.</Txt> : null}
                </View>
              </>
            )}
        </View>
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------- 5. thư viện tranh
const SCENES: ReadonlyArray<{ title: string; caption: string }> = [
  { title: 'Đèn sách', caption: 'Hai bạn học trò ôn bài bên đèn dầu, chuẩn bị cho kỳ thi.' },
  { title: 'Lều chõng vào trường thi', caption: 'Sĩ tử mang lều, chõng vào trường thi và làm bài ngay trong lều của mình.' },
  { title: 'Ngày xướng danh', caption: 'Tên người thi đỗ được xướng lên trước cổng trường thi.' },
  { title: 'Bảng vàng ghi danh', caption: 'Tên những người đỗ cao được ghi lên bảng vàng cho mọi người cùng xem.' },
  { title: 'Vinh quy bái tổ', caption: 'Người đỗ đạt được rước về quê dưới lọng, cờ để bái lạy tổ tiên.' },
];
type Picture = { key: string; title: string; caption: string; kind: 'scene' | 'map'; n: number; locked: boolean; need?: string };

export const HallGallery: React.FC<{ level: number; home: SagaHome }> = ({ level, home }) => {
  const { width, height } = useWindowDimensions();
  const [open, setOpen] = useState<Picture | null>(null);
  const cols = width >= 1200 ? 4 : width >= 840 ? 3 : width >= 520 ? 2 : 1;
  const pictures: Picture[] = [
    ...SCENES.map((s, i) => ({ key: `scene-${i}`, title: s.title, caption: s.caption, kind: 'scene' as const, n: i, locked: i > level, need: RANKS[i].name })),
    ...[1, 2, 3].map((n) => {
      const camp = home.campaigns.find((c) => c.campaign_no === n);
      return { key: `map-${n}`, title: `Bản đồ Phần ${n} · ${TONE[n].years}`, caption: camp ? camp.title : 'Bản đồ cuộc kháng chiến', kind: 'map' as const, n, locked: false };
    }),
  ];
  const art = (p: Picture, big = false) => (p.kind === 'scene'
    ? <RankScene rank={p.n} style={{ width: '100%', height: '100%' }} />
    : <Image source={mapSource({ image_key: `ban-do-khang-chien-${p.n}`, image_url: null })} style={{ width: '100%', height: '100%' }} resizeMode={big ? 'contain' : 'cover'} accessibilityLabel={p.title} />);
  return (
    <View style={{ gap: 16 }} testID="hall-gallery">
      <HallTitle eyebrow="THƯ VIỆN TRANH" ink="Tranh" red="khoa bảng" sub="Mỗi danh hiệu mở một bức tranh về đường học hành thi cử xưa. Bấm vào tranh để xem lớn." />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -7 }}>
        {pictures.map((p) => {
          const body = (
            <>
              <View style={{ aspectRatio: 1.6, backgroundColor: '#efe1c4' }}>
                {art(p)}
                {p.locked ? (
                  <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(43,29,22,0.78)', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10 }}>
                    <Lock size={22} color="#fff3cf" />
                    <Txt f="bold" size={13} color="#fff3cf" center>Đạt danh hiệu {p.need} để mở tranh</Txt>
                  </View>
                ) : <View style={{ position: 'absolute', right: 8, bottom: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,250,240,0.92)', alignItems: 'center', justifyContent: 'center' }}><ZoomIn size={16} color={HALL.ink} /></View>}
              </View>
              <View style={{ padding: 12, gap: 3 }}>
                <Txt f="heavy" size={15} color={HALL.ink} numberOfLines={1}>{p.title}</Txt>
                <Txt size={13} color={HALL.muted} numberOfLines={2}>{p.kind === 'map' ? `${p.caption} · bản đồ gốc Wikipedia` : p.caption}</Txt>
              </View>
            </>
          );
          const card = { borderRadius: 18, overflow: 'hidden' as const, backgroundColor: '#ffffff', borderWidth: 2, borderBottomWidth: 5, borderColor: HALL.paperLine };
          return (
            <View key={p.key} style={{ width: `${100 / cols}%`, padding: 7 }}>
              {p.locked ? <View testID={`gallery-${p.key}`} accessible accessibilityLabel={`${p.title}: còn khóa, đạt danh hiệu ${p.need} để mở`} style={card}>{body}</View> : (
                <Pressable testID={`gallery-${p.key}`} accessibilityRole="button" accessibilityLabel={`Xem lớn: ${p.title}`} onPress={() => setOpen(p)}
                  style={({ pressed }) => ({ ...card, opacity: pressed ? 0.9 : 1 })}>{body}</Pressable>
              )}
            </View>
          );
        })}
      </View>
      {open ? (
        <Sheet open wide onClose={() => setOpen(null)} title={open.title} subtitle={open.kind === 'map' ? 'Bản đồ gốc – Wikipedia tiếng Việt' : 'Tranh minh họa do nhóm Đông A tự vẽ'}>
          <View style={{ gap: 12 }} testID="gallery-view">
            <View style={{ height: Math.max(220, Math.min(560, height * 0.6)), borderRadius: 16, overflow: 'hidden', backgroundColor: open.kind === 'map' ? '#f4f1ea' : '#efe1c4' }}>{art(open, true)}</View>
            <Txt size={15} style={{ lineHeight: 23 }}>{open.caption}</Txt>
            <Txt size={12} color={HALL.muted}>{open.kind === 'map' ? 'Tác giả bản đồ: Lưu Ly · phạm vi công cộng · ghi công đầy đủ ở trang Thông tin hình ảnh.' : 'Phong tục khoa cử xưa phần lớn được ghi chép từ thời Lê, Nguyễn; tranh là hình vẽ cách điệu, không phục dựng riêng thời Trần. Nhân vật là hư cấu.'}</Txt>
          </View>
        </Sheet>
      ) : null}
    </View>
  );
};
