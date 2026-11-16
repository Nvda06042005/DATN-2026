/**
 * Hành trình Đông A – ba màn mở đầu của vòng chơi, dựng bằng bộ thành phần của các cổng quản trị (tiêu đề hai nửa, thẻ số liệu, thẻ viền mảnh, bảng dữ liệu):
 *   1. "Chiến dịch" (16/11/2026): danh sách lớp trước (StudentClasses), vào lớp rồi mới tới ba phần theo ba cuộc kháng chiến 1258, 1285, 1287–1288,
 *      cột cấp độ – chuỗi ngày – vàng, nhiệm vụ hôm nay, câu cần ôn, kỳ thi.
 *   2. Trang một phần: lộ trình uốn lượn các chặng, bên dưới là ảnh bản đồ gốc của Wikipedia tiếng Việt kiểu sa bàn: các chặng đặt theo tỉ lệ 0–1 trên ảnh, có số thứ tự,
 *      tên, ngày, trạng thái (màu, biểu tượng, chữ, nhãn trợ năng), đường nối và khung chú thích bên dưới. Phóng to, kéo để xem.
 *   3. Bảng thông tin chặng: mục tiêu học, các bước, lý do còn khóa, kết quả cũ và nút Học / Chơi tiếp / Ôn lại.
 * Mục "Nhập vai" gom các cảnh khám phá và trận đánh đã mở để chơi lại nhanh.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Linking, Platform, Pressable, ScrollView, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { Award, BookOpen, Check, ClipboardCheck, Coins, Flag, Flame, Footprints, Gamepad2, Gift, Lock, Map as MapIcon, Maximize2, Play, Puzzle, RotateCcw, Sparkles, Swords, Target, Users, ZoomIn, ZoomOut } from 'lucide-react-native';
import * as saga from '@/lib/saga-api';
import * as authApi from '@/api/authApi';
import { Mascot } from '@/components/art';
import { Cell, DataTable, type Column } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import {
  BlockTitle, KIND_TEXT, LoadState, Meter, Portrait, RARITY, STATE, SagaHeader, SagaPage, StarRow, TONE, mapSource, num, stageIcon, useLoad, type SagaNav, type SagaStep,
} from '@/components/portal/SagaKit';
import { Btn, Card, Chip, InfoNote, Inset, Segmented, Sheet, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { IconType } from '@/types/game';
import type { CampaignView, SagaCampaign, SagaMapInfo, StageBrief, StageDetail, StepState } from '@/types/saga';

const thumb = (no: number) => mapSource({ image_key: `ban-do-khang-chien-${no}`, image_url: null });
const StateChip: React.FC<{ state: StageBrief['state'] }> = ({ state }) => {
  const st = STATE[state];
  return <Chip text={st.label} icon={st.icon} bg={st.soft} fg={st.text} />;
};

type MyClass = Awaited<ReturnType<typeof authApi.myClasses>>[number];

/**
 * Lớp đang học (16/11/2026 đợt 5): Chiến dịch mở danh sách lớp trước, vào lớp rồi mới tới ba phần. Thanh này cho biết em đang ở lớp nào
 * (nút quay lại "Lớp học" ở đầu trang về danh sách lớp, đăng ký lớp khác bằng mã cũng ở đó).
 */
const ClassBar: React.FC<{ cls: MyClass }> = ({ cls }) => {
  const { c } = useTheme();
  return (
    <Card flat pad={12} style={{ borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }} testID="my-class">
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.adminTint, alignItems: 'center', justifyContent: 'center' }}><Users size={18} color={c.logoRed} /></View>
      <View style={{ flex: 1, minWidth: 200 }}>
        <Txt f="bold" size={14}>Lớp {cls.name}</Txt>
        <Txt size={12} color={c.muc3}>{cls.teachers.length ? `GV ${cls.teachers.join(', ')}` : 'Chưa có giáo viên'} · {cls.members} bạn</Txt>
      </View>
    </Card>
  );
};

/** Độ lệch ngang của các chặng trên đường đi (uốn lượn trái – phải) */
const SWAY = [0, 54, 88, 54, 0, -54, -88, -54];

/** Một chặng trên lộ trình: nút tròn theo trạng thái, sao đạt được, tên chặng; chặng đang chờ có nhãn "Bắt đầu" / "Học tiếp" và Rồng Con bên cạnh */
const PathNode: React.FC<{ st: StageBrief; index: number; current: boolean; color: string; onPress: () => void }> = ({ st, index, current, color, onPress }) => {
  const { c } = useTheme();
  const Icon = st.state === 'locked' ? Lock : st.state === 'done' || st.state === 'review' ? Check : stageIcon(st.icon);
  const locked = st.state === 'locked';
  const done = st.state === 'done' || st.state === 'review';
  const x = SWAY[index % SWAY.length];
  const size = current ? 76 : 66;
  return (
    <View style={{ alignItems: 'center', transform: [{ translateX: x }], width: 170 }}>
      {current ? (
        <View style={{ backgroundColor: c.the, borderColor: color, borderWidth: 2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 8 }}>
          <Txt f="heavy" size={12} color={color} style={{ letterSpacing: 0.6 }}>{st.state === 'learning' ? 'HỌC TIẾP' : 'BẮT ĐẦU'}</Txt>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {current && x <= 0 ? <View style={{ position: 'absolute', left: size + 18 }}><Mascot size={64} mood="happy" bob /></View> : null}
        {current && x > 0 ? <View style={{ position: 'absolute', right: size + 18 }}><Mascot size={64} mood="happy" bob /></View> : null}
        <Pressable onPress={onPress} accessibilityRole="button" testID={`path-node-${st.order}`}
          accessibilityLabel={`Chặng ${st.order}: ${st.title}, ${st.date_label}. ${STATE[st.state].label}${st.stars ? `, ${st.stars} sao` : ''}${st.lock_reason ? `. ${st.lock_reason}` : ''}`}
          style={({ pressed }) => ({
            width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center',
            backgroundColor: locked ? c.adminLine : done ? c.vang : color, borderWidth: current ? 5 : 0, borderColor: current ? c.the : 'transparent',
            opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.96 : 1 }],
            ...(current ? { boxShadow: `0 0 0 4px ${color}` } as object : {}),
          })}>
          <Icon size={current ? 32 : 28} color={locked ? c.muc3 : done ? c.vangChu : '#ffffff'} strokeWidth={2.4} />
        </Pressable>
      </View>
      <View style={{ height: 18, justifyContent: 'center', marginTop: 4 }}>{st.stars > 0 ? <StarRow n={st.stars} size={14} /> : null}</View>
      <Txt f={current ? 'bold' : 'semibold'} size={13} center numberOfLines={2} color={locked ? c.muc3 : c.muc} style={{ width: 160 }}>{st.title}</Txt>
      <Txt size={11} center color={c.muc3} numberOfLines={1} style={{ width: 160 }}>{st.date_label}</Txt>
    </View>
  );
};

/** Chấm nối hai chặng liên tiếp, đặt ở giữa hai độ lệch */
const PathDots: React.FC<{ from: number; to: number; done: boolean }> = ({ from, to, done }) => {
  const { c } = useTheme();
  return (
    <View style={{ height: 34, justifyContent: 'space-evenly', alignItems: 'center' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {[0.33, 0.66].map((t) => <View key={t} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: done ? c.vang : c.adminLine, transform: [{ translateX: SWAY[from % SWAY.length] * (1 - t) + SWAY[to % SWAY.length] * t }] }} />)}
    </View>
  );
};

/** Một phần của Hành trình (một cuộc kháng chiến): tiến độ chặng, sao, ảnh thu nhỏ bản đồ gốc (Wikipedia). Bấm để vào lộ trình của phần (không có `onOpen` thì chỉ là thẻ thông tin). */
const UnitBanner: React.FC<{ camp: SagaCampaign; onOpen?: () => void; label?: string }> = ({ camp, onOpen, label = 'Vào học' }) => {
  const tone = TONE[camp.campaign_no];
  return (
    <Pressable onPress={onOpen} disabled={!onOpen} accessibilityRole={onOpen ? 'button' : 'summary'} accessibilityLabel={`Phần ${camp.campaign_no}: ${camp.title}, ${camp.done} trên ${camp.stages} chặng, ${camp.stars} trên ${camp.max_stars} sao. ${label}`} testID={`path-unit-${camp.campaign_no}`}
      style={({ pressed }) => ({ borderRadius: 14, backgroundColor: tone.main, padding: 16, gap: 8, alignSelf: 'stretch', opacity: pressed ? 0.92 : 1, transform: [{ scale: pressed ? 0.995 : 1 }] })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <View style={{ flex: 1, minWidth: 200, gap: 2 }}>
          <Txt f="bold" size={12} color="#ffffff" style={{ opacity: 0.85, letterSpacing: 0.6 }}>PHẦN {camp.campaign_no} · {tone.years}</Txt>
          <Txt f="bold" size={18} color="#ffffff" accessibilityRole="header">{camp.title}</Txt>
          <Txt size={12} color="#ffffff" style={{ opacity: 0.9 }}>{camp.done}/{camp.stages} chặng · {camp.stars}/{camp.max_stars} sao{camp.available ? '' : ' · mở khi xong phần trước'}</Txt>
        </View>
        <View style={{ borderRadius: 10, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.8)' }} testID={`path-map-${camp.campaign_no}`}>
          <Image source={thumb(camp.campaign_no)} style={{ width: 112, height: 70 }} resizeMode="cover" accessibilityIgnoresInvertColors />
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', paddingVertical: 2, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
            {!onOpen ? <MapIcon size={12} color="#ffffff" /> : camp.available ? <Play size={12} color="#ffffff" /> : <Lock size={12} color="#ffffff" />}<Txt f="bold" size={11} color="#ffffff">{label}</Txt>
          </View>
        </View>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' }}>
        <View style={{ width: `${Math.round(camp.percent)}%`, height: 8, borderRadius: 4, backgroundColor: '#ffffff' }} />
      </View>
    </Pressable>
  );
};

/** Lộ trình uốn lượn của một phần: các chặng nối bằng chấm, chặng đang chờ có Rồng Con */
const UnitPath: React.FC<{ stages: StageBrief[]; currentId: number | null; color: string; onPick: (st: StageBrief) => void }> = ({ stages, currentId, color, onPick }) => (
  <View style={{ alignItems: 'center', paddingVertical: 10 }} testID="unit-path">
    {stages.map((st, i) => (
      <React.Fragment key={st.id}>
        {i > 0 ? <PathDots from={i - 1} to={i} done={stages[i - 1].state === 'done' || stages[i - 1].state === 'review'} /> : null}
        <PathNode st={st} index={i} current={st.id === currentId} color={color} onPress={() => onPick(st)} />
      </React.Fragment>
    ))}
  </View>
);

// ---------------------------------------------------------------------- 1. trang chủ: lộ trình Hành trình Đông A
/**
 * Trang chủ học sinh dạng trò chơi (16/11/2026, giữ menu như các cổng quản trị), mở sau khi em chọn lớp ở danh sách lớp: thanh lớp đang học,
 * ba phần theo ba cuộc kháng chiến (bấm một phần mở lộ trình và bản đồ các chặng của phần đó);
 * cột bên phải: cấp độ – kinh nghiệm, chuỗi ngày học, vàng, nhiệm vụ hôm nay, câu cần ôn, kỳ thi.
 */
export const HomeScreen: React.FC<{ nav: SagaNav; loading: boolean; error: string | null; cls: MyClass | null; onLeave: () => void }> = ({ nav, loading, error, cls, onLeave }) => {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 1180;
  const home = nav.home;
  const hud = home?.hud ?? null;
  const next = home?.next ?? null;
  const level = hud?.level ?? null;
  const rail = home && hud && level ? (
    <View style={{ gap: 12, width: wide ? 320 : '100%' }}>
      <Card flat pad={14} style={{ borderRadius: 14, gap: 10 }} testID="home-level">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: c.sonNhat, alignItems: 'center', justifyContent: 'center' }}><Award size={24} color={c.son} /></View>
          <View style={{ flex: 1 }}>
            <Txt f="bold" size={15}>Cấp {level.level} · {level.title}</Txt>
            <Txt size={12} color={c.muc3}>{level.next_xp ? `${num(hud.xp)}/${num(level.next_xp)} điểm kinh nghiệm` : `${num(hud.xp)} điểm · cấp cao nhất`}</Txt>
          </View>
        </View>
        <Meter value={level.progress / 100} label={`Cấp ${level.level}, ${level.title}. ${num(hud.xp)} điểm kinh nghiệm`} />
        <View style={{ flexDirection: 'row', gap: 8 }} testID="home-metrics">
          {[{ icon: Flame, v: hud.streak.current, t: 'ngày liên tiếp', fg: c.hoaChu, bg: c.hoaNhat }, { icon: Coins, v: hud.gold, t: 'vàng', fg: c.vangChu, bg: c.vangNhat }, { icon: Flag, v: `${home.totals.done}/${home.totals.stages}`, t: 'chặng', fg: c.mocChu, bg: c.mocNhat }].map((m) => (
            <View key={m.t} style={{ flex: 1, borderRadius: 10, backgroundColor: m.bg, paddingVertical: 8, alignItems: 'center', gap: 2 }}>
              <m.icon size={18} color={m.fg} />
              <Txt f="bold" size={15} color={m.fg}>{typeof m.v === 'number' ? num(m.v) : m.v}</Txt>
              <Txt size={11} color={c.muc2}>{m.t}</Txt>
            </View>
          ))}
        </View>
      </Card>
      {home.daily ? (
        <Card flat pad={14} style={{ borderRadius: 14, gap: 8 }} testID="home-daily">
          <BlockTitle title={`Nhiệm vụ hôm nay${home.daily.done ? ' · đã xong' : ''}`} icon={Gift} />
          <Txt size={14} color={c.muc2}>{home.daily.title} (+{home.daily.reward_xp} điểm{home.daily.reward_gold ? `, +${home.daily.reward_gold} vàng` : ''})</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Meter value={home.daily.target ? home.daily.progress / home.daily.target : 0} color={c.moc} label="Tiến độ nhiệm vụ hôm nay" style={{ flex: 1 }} />
            <Txt f="bold" size={13}>{Math.min(home.daily.progress, home.daily.target)}/{home.daily.target}</Txt>
          </View>
        </Card>
      ) : null}
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
    </View>
  ) : null;
  const units = home ? (
    <View style={{ gap: 14, flex: wide ? 1 : undefined, minWidth: 0, alignSelf: 'stretch' }} testID="home-units">
      {home.campaigns.map((camp) => <UnitBanner key={camp.campaign_no} camp={camp} onOpen={() => nav.go('chien-dich', { c: camp.campaign_no, s: null, v: null })} />)}
      <Txt size={12} color={c.muc3} center>Bấm một phần để vào lộ trình các chặng và bản đồ gốc của Wikipedia của cuộc kháng chiến đó.</Txt>
    </View>
  ) : null;
  return (
    <SagaPage testID="saga-home" max={1180}>
      <SagaHeader title="Hành trình Đông A" back={{ label: 'Lớp học', hint: 'Về danh sách lớp học', onPress: onLeave }}
        subtitle={home ? `Chào ${home.learner.name}! Đi hết con đường qua ba lần kháng chiến chống quân Mông – Nguyên (1258, 1285, 1287–1288): mỗi chặng học, luyện, khám phá rồi ra trận.` : 'Ba lần kháng chiến chống quân Mông – Nguyên (1258, 1285, 1287–1288).'}
        actions={next ? <Btn title={`${next.state === 'learning' ? 'Học tiếp' : 'Bắt đầu'}: ${next.title}`} icon={Play} tone="son" size="sm" onPress={() => nav.go('chien-dich', { c: next.campaign_no, s: next.stage_id, v: null })} testID="home-continue" /> : undefined} />
      {cls ? <ClassBar cls={cls} /> : null}
      {!home || !hud || !level ? <LoadState loading={loading} error={error} onRetry={nav.refresh} /> : (
        <View style={{ flexDirection: wide ? 'row' : 'column', gap: 18, alignItems: 'flex-start' }}>
          {units}{rail}
        </View>
      )}
    </SagaPage>
  );
};

// ---------------------------------------------------------------------- 2. bản đồ chiến dịch
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

const SagaMap: React.FC<{ map: SagaMapInfo; stages: StageBrief[]; currentId: number | null; selectedId: number | null; onPick: (st: StageBrief) => void; maxHeight: number }> = ({ map, stages, currentId, selectedId, onPick, maxHeight }) => {
  const { c } = useTheme();
  const [boxW, setBoxW] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const outer = useRef<ScrollViewInstance | null>(null), inner = useRef<ScrollViewInstance | null>(null);
  const ratio = map.image_w / Math.max(1, map.image_h);
  const viewW = Math.max(0, boxW - BORDER * 2), maxH = maxHeight - BORDER * 2;
  const fitW = Math.min(viewW, maxH * ratio);
  // Mức phóng mặc định: vừa khung; phóng thêm khi bản đồ dọc quá nhỏ để đọc chữ hoặc khi hai chặng nằm sát tới mức các nút đè lên nhau
  const auto = useMemo(() => {
    if (!fitW) return 0;
    let near = Infinity;
    for (let i = 0; i < stages.length; i += 1) for (let j = i + 1; j < stages.length; j += 1) near = Math.min(near, Math.hypot((stages[i].map_x - stages[j].map_x) * fitW, (stages[i].map_y - stages[j].map_y) * (fitW / ratio)));
    const need = Math.max((NODE + 12) / Math.max(1, near), Math.min(viewW, 520) / fitW);
    const i = ZOOMS.findIndex((z) => z >= need - 0.001);
    return i < 0 ? 2 : Math.min(i, 2);
  }, [fitW, ratio, stages, viewW]);
  const zi = chosen ?? auto;
  const setZi = (next: (i: number) => number): void => setChosen(next(zi));
  const zoom = ZOOMS[zi];
  const cw = fitW * zoom, ch = (fitW / ratio) * zoom;
  const viewH = Math.min(ch, maxH);
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
  return (
    <View onLayout={(e) => setBoxW(e.nativeEvent.layout.width)} testID="saga-map" style={{ width: '100%', height: boxW ? viewH + BORDER * 2 : 240, borderRadius: 12, overflow: 'hidden', borderWidth: BORDER, borderColor: c.adminLine, backgroundColor: c.adminCanvas }}>
      {boxW > 0 ? (
        <ScrollView ref={outer} showsVerticalScrollIndicator={scrolls}>
          <ScrollView ref={inner} horizontal showsHorizontalScrollIndicator={scrolls} contentContainerStyle={{ minWidth: '100%', justifyContent: 'center' }}>
            <View style={{ width: cw, height: ch }}>
              <Image source={mapSource(map)} style={{ width: cw, height: ch }} resizeMode="stretch" accessibilityLabel={`Bản đồ ${map.title} (${map.years})`} />
              <Svg width={cw} height={ch} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
                {stages.length > 1 ? <Polyline points={stages.map((st) => pt(st).join(',')).join(' ')} fill="none" stroke="#ffffff" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" opacity={0.7} /> : null}
                {stages.length > 1 ? <Polyline points={stages.map((st) => pt(st).join(',')).join(' ')} fill="none" stroke={c.ngoc} strokeWidth={3} strokeDasharray="9 6" strokeLinecap="round" strokeLinejoin="round" /> : null}
                {stages.filter((st) => st.anchor_x !== null && st.anchor_y !== null).map((st) => {
                  const [x, y] = pt(st), ax = (st.anchor_x ?? 0) * cw, ay = (st.anchor_y ?? 0) * ch;
                  return <React.Fragment key={st.id}><Line x1={x} y1={y} x2={ax} y2={ay} stroke={c.logoInk} strokeWidth={1.5} /><Circle cx={ax} cy={ay} r={4} fill={c.logoInk} stroke="#ffffff" strokeWidth={1.5} /></React.Fragment>;
                })}
              </Svg>
              {stages.map((st) => {
                const [x, y] = pt(st);
                const state = STATE[st.state];
                const current = st.id === currentId, picked = st.id === selectedId;
                const showLabel = !compact || current || picked;
                return (
                  <View key={st.id} pointerEvents="box-none" style={{ position: 'absolute', left: x - NODE / 2, top: y - NODE / 2, width: NODE, height: NODE, zIndex: picked ? 6 : current ? 5 : 1 }}>
                    {current ? (
                      <View pointerEvents="none" style={{ position: 'absolute', bottom: NODE + 4, left: -38, width: 120, alignItems: 'center' }}>
                        <View style={{ backgroundColor: c.son, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 }}><Txt f="bold" size={11} color="#ffffff">{st.state === 'ready' ? 'Bắt đầu' : 'Đang học'}</Txt></View>
                      </View>
                    ) : st.stars > 0 ? (
                      <View pointerEvents="none" style={{ position: 'absolute', bottom: NODE + 2, left: -18, width: 80, alignItems: 'center' }}>
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
                      <View pointerEvents="none" style={{ position: 'absolute', top: NODE + 4, left: -98, width: 240, alignItems: 'center', gap: 2 }}>
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

/**
 * Trang một phần của Hành trình (16/11/2026 đợt 6): thẻ phần và lộ trình uốn lượn các chặng ở trên, bản đồ gốc của Wikipedia ghép ngay bên dưới
 * theo kiểu sa bàn: số thứ tự và tên từng chặng trên bản đồ, đường nối các chặng, khung chú thích ngay dưới bản đồ (không che chú giải gốc). Bấm chặng ở lộ trình hoặc trên bản đồ đều mở
 * bảng thông tin chặng.
 */
export const CampaignScreen: React.FC<{ session: Session; nav: SagaNav; no: number }> = ({ session, nav, no }) => {
  const { c } = useTheme();
  const { height } = useWindowDimensions();
  const data = useLoad<CampaignView>(session, (t) => saga.campaign(t, no), [no]);
  const view = data.data;
  const camp = nav.home?.campaigns.find((x) => x.campaign_no === no) ?? null;
  const open = nav.route.s !== null && nav.route.v === null ? nav.route.s : null;
  const pick = (st: StageBrief): void => nav.go('chien-dich', { c: no, s: st.id, v: null }, 'params');
  const current = view?.stages.find((st) => st.id === view.current_stage_id) ?? null;
  const caption = view ? {
    title: `Sa bàn: ${view.map.title} (${view.map.years})`,
    lines: [`${view.stages.length} chặng: ${view.stages.map((st) => st.title).join(', ')}.`, 'Bấm trực tiếp vào từng chặng trên bản đồ để học.'],
  } : undefined;
  return (
    <SagaPage testID="saga-campaign" max={1180}>
      <SagaHeader title={view?.map.title ?? camp?.title ?? 'Lộ trình'} subtitle={view ? `${view.map.years} · đã xong ${view.totals.done}/${view.totals.stages} chặng · ${view.totals.stars}/${view.totals.max_stars} sao` : undefined}
        back={{ label: 'Chiến dịch', hint: 'Về ba phần của Hành trình', onPress: () => nav.back('chien-dich', { c: null, s: null, v: null }) }}
        actions={current ? <Btn icon={Play} title={`${current.state === 'ready' ? 'Bắt đầu' : 'Học tiếp'}: ${current.title}`} tone="son" size="sm" onPress={() => pick(current)} testID="unit-continue" /> : undefined} />
      <Segmented<number> label="Chọn phần" value={no} onChange={(n) => nav.go('chien-dich', { c: n, s: null, v: null }, 'params')}
        options={[1, 2, 3].map((n) => ({ value: n, label: `Phần ${n} · ${TONE[n].years}` }))} />
      {!view ? <LoadState loading={data.loading} error={data.error} onRetry={data.reload} /> : (
        <View style={{ gap: 16 }}>
          <View style={{ alignItems: 'center', gap: 6 }}>
            {camp ? <UnitBanner camp={camp} label="Bản đồ bên dưới" /> : null}
            <UnitPath stages={view.stages} currentId={view.current_stage_id} color={TONE[no].main} onPick={pick} />
          </View>
          <Card flat pad={12} style={{ borderRadius: 12, gap: 8 }} testID="unit-map">
            <BlockTitle title="Bản đồ các chặng" icon={MapIcon} />
            <SagaMap map={view.map} stages={view.stages} currentId={view.current_stage_id} selectedId={open} onPick={pick} maxHeight={Math.max(320, Math.min(760, height - 190))} />
            {caption ? (
              <View testID="map-caption" style={{ borderRadius: 10, padding: 12, gap: 4, backgroundColor: c.logoInk }}>
                <Txt f="bold" size={13} color={c.logoGold} style={{ letterSpacing: 0.4 }}>{caption.title.toLocaleUpperCase('vi')}</Txt>
                {caption.lines.map((t) => <Txt key={t} size={12} color="#ffffff" style={{ lineHeight: 18 }}>• {t}</Txt>)}
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              {(Object.keys(STATE) as Array<keyof typeof STATE>).map((k) => <StateChip key={k} state={k} />)}
            </View>
            <Pressable accessibilityRole="link" accessibilityLabel="Mở trang gốc của bản đồ trên Wikipedia" disabled={!view.map.credit_url} onPress={() => { if (view.map.credit_url) void Linking.openURL(view.map.credit_url); }} style={{ minHeight: 32, justifyContent: 'center' }}>
              <Txt size={12} color={c.muc3}>{view.map.credit}{view.map.credit_url ? ' Bấm để mở trang gốc.' : ''} Vị trí các chặng do nhóm phát triển đánh dấu trên bản đồ.</Txt>
            </Pressable>
          </Card>
        </View>
      )}
      {open !== null ? <StageSheet session={session} nav={nav} stageId={open} campaignNo={no} /> : null}
    </SagaPage>
  );
};

// ---------------------------------------------------------------------- 3. bảng thông tin chặng
const STEP_ICON: Record<StepState, IconType> = { locked: Lock, ready: Play, done: Check, none: Lock };
const StepLine: React.FC<{ icon: IconType; title: string; note: string; state: StepState; onPress?: () => void; testID: string }> = ({ icon: Icon, title, note, state, onPress, testID }) => {
  const { c } = useTheme();
  const tone = state === 'done' ? { fg: c.mocChu, bg: c.mocNhat, text: 'Đã xong' } : state === 'ready' ? { fg: c.thuyChu, bg: c.thuyNhat, text: 'Sẵn sàng' } : { fg: c.dich, bg: c.dichNhat, text: 'Chưa mở' };
  const Mark = STEP_ICON[state];
  return (
    <Pressable accessibilityRole="button" disabled={!onPress} onPress={onPress} testID={testID}
      accessibilityLabel={`${title}: ${tone.text.toLowerCase()}. ${note}`}
      style={({ pressed }) => ({ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: c.adminLine, backgroundColor: pressed ? c.adminCanvas : c.the, opacity: state === 'locked' ? 0.75 : 1 })}>
      <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: tone.bg, alignItems: 'center', justifyContent: 'center' }}><Icon size={18} color={tone.fg} /></View>
      <View style={{ flex: 1 }}>
        <Txt f="bold" size={14}>{title}</Txt>
        <Txt size={13} color={c.muc2}>{note}</Txt>
      </View>
      <Chip text={tone.text} icon={Mark} bg={tone.bg} fg={tone.fg} />
    </Pressable>
  );
};

const StageSheet: React.FC<{ session: Session; nav: SagaNav; stageId: number; campaignNo: number }> = ({ session, nav, stageId, campaignNo }) => {
  const { c } = useTheme();
  const data = useLoad<StageDetail>(session, (t) => saga.stage(t, stageId), [stageId]);
  const d = data.data;
  const close = (): void => nav.go('chien-dich', { c: campaignNo, s: null, v: null }, 'params');
  const open = (v: SagaStep): void => nav.go('chien-dich', { c: campaignNo, s: stageId, v });
  const locked = d?.state === 'locked';
  const next = d?.steps.next ?? null;
  const cta = !d || locked ? null
    : next === 'lesson' ? <Btn title="Bắt đầu học" icon={BookOpen} tone="son" full onPress={() => open('hoc')} testID="stage-cta" />
    : next === 'practice' ? <Btn title={d.practice.tries ? 'Luyện tập tiếp' : 'Luyện tập'} icon={Puzzle} tone="son" full onPress={() => open('luyen')} testID="stage-cta" />
    : next === 'explore' ? <Btn title="Nhập vai khám phá" icon={Gamepad2} tone="son" full onPress={() => open('kham-pha')} testID="stage-cta" />
    : <Btn title="Xem tổng kết" icon={Sparkles} tone="son" full onPress={() => open('tong-ket')} testID="stage-cta" />;
  return (
    <Sheet open onClose={close} wide title={d ? d.title : 'Chặng'} subtitle={d ? `${d.place} · ${d.date_label}` : undefined} footer={cta ?? undefined}>
      {!d ? <LoadState loading={data.loading} error={data.error} onRetry={data.reload} /> : (
        <View style={{ gap: 16 }} testID="stage-sheet">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <StateChip state={d.state} />
            <Chip text={KIND_TEXT[d.kind] ?? d.kind} icon={stageIcon(d.icon)} bg={c.adminCanvas} fg={c.muc2} />
            {d.stars > 0 ? <StarRow n={d.stars} /> : null}
          </View>
          <Txt size={15}>{d.summary}</Txt>
          {d.lock_reason ? (
            <Inset style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <Lock size={18} color={c.muc2} /><Txt f="semibold" size={14} style={{ flex: 1 }} accessibilityRole="alert">{d.lock_reason}</Txt>
            </Inset>
          ) : null}

          <View style={{ gap: 6 }}>
            <BlockTitle title="Sau chặng này em sẽ" />
            {d.objectives.map((o) => (
              <View key={o.id} style={{ flexDirection: 'row', gap: 8 }}><Target size={15} color={c.son} style={{ marginTop: 3 }} /><Txt size={14} style={{ flex: 1 }}>{o.text}</Txt></View>
            ))}
          </View>

          <View style={{ gap: 8 }}>
            <BlockTitle title="Các bước" />
            <StepLine testID="step-lesson" icon={BookOpen} title="1. Học kiến thức ngắn" note={`${d.cards_count} thẻ kiến thức có nguồn`} state={d.steps.lesson} onPress={d.steps.lesson !== 'locked' ? () => open('hoc') : undefined} />
            <StepLine testID="step-practice" icon={Puzzle} title="2. Minigame luyện tập" state={d.steps.practice} onPress={d.steps.practice !== 'locked' ? () => open('luyen') : undefined}
              note={`${d.practice.items} câu · cần đạt ${d.pass_percent}%${d.practice.tries ? ` · tốt nhất ${d.practice.best}% sau ${d.practice.tries} lượt` : ''}`} />
            <StepLine testID="step-explore" icon={Footprints} title="3. Nhập vai khám phá và ghi nhớ" state={d.steps.explore} onPress={d.steps.explore !== 'locked' ? () => open('kham-pha') : undefined}
              note={`${d.explore.title}${d.explore.done ? ` · ${d.explore.hints} lần xem gợi ý, ${d.explore.mistakes} lần sai` : ''}`} />
            {d.battle ? (
              <StepLine testID="step-battle" icon={Swords} title="4. Chạm trán" state={d.steps.battle} onPress={d.battle.won ? () => open('tran') : undefined}
                note={d.battle.won ? `${d.battle.title} · ${d.battle.stars} sao, ${num(d.battle.best)} điểm sau ${d.battle.tries} lượt · bấm để đánh lại` : `${d.battle.title} · tìm tới nơi quân địch trong phần nhập vai để mở trận`} />
            ) : null}
          </View>

          <View style={{ gap: 8 }}>
            <BlockTitle title="Phần thưởng khi hoàn thành lần đầu" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              <Chip text={`+${d.rewards.xp} điểm`} icon={Sparkles} bg={c.thongNhat} fg={c.thongChu} />
              <Chip text={`+${d.rewards.gold} vàng`} icon={Coins} bg={c.vangNhat} fg={c.vangChu} />
              {d.rewards.has_badge ? <Chip text="Huy hiệu" icon={Award} bg={c.sonNhat} fg={c.sonChu} /> : null}
              {d.unlocks_next ? <Chip text={`Mở chặng: ${d.unlocks_next.title}`} icon={Play} bg={c.mocNhat} fg={c.mocChu} /> : null}
            </View>
            {d.rewards.card ? (
              <Inset style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Portrait code={d.rewards.card.portrait} size={56} locked={Boolean(d.rewards.card.hidden)} />
                <View style={{ flex: 1 }}>
                  <Txt f="bold" size={14}>Thẻ nhân vật: {d.rewards.card.name}</Txt>
                  <Txt size={13} color={c.muc2}>{RARITY[d.rewards.card.rarity]?.label ?? ''} · {d.rewards.card.hidden ? 'hoàn thành chặng để mở thẻ' : d.rewards.card.title}</Txt>
                </View>
              </Inset>
            ) : null}
          </View>

          {d.completed_at ? (
            <View style={{ gap: 8 }}>
              <BlockTitle title="Ôn lại chặng này" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Btn title="Thẻ kiến thức" icon={BookOpen} tone="giay" size="sm" onPress={() => open('hoc')} testID="replay-lesson" />
                <Btn title="Luyện lại" icon={Puzzle} tone="giay" size="sm" onPress={() => open('luyen')} testID="replay-practice" />
                <Btn title="Nhập vai lại" icon={Gamepad2} tone="giay" size="sm" onPress={() => open('kham-pha')} testID="replay-explore" />
                {d.battle ? <Btn title="Đánh lại trận" icon={Swords} tone="giay" size="sm" onPress={() => open('tran')} testID="replay-battle" /> : null}
                {d.review_due ? <Btn title={`Ôn ${d.review_due} câu đã sai`} icon={RotateCcw} tone="giay" size="sm" onPress={() => nav.go('cau-hoi', { c: null, s: null, v: null })} testID="replay-review" /> : null}
              </View>
            </View>
          ) : null}
        </View>
      )}
    </Sheet>
  );
};

// ---------------------------------------------------------------------- mục "Nhập vai": cảnh khám phá và trận đánh đã mở
export const RolePlayScreen: React.FC<{ session: Session; nav: SagaNav }> = ({ session, nav }) => {
  const { c } = useTheme();
  const data = useLoad<CampaignView[]>(session, (t) => Promise.all([1, 2, 3].map((n) => saga.campaign(t, n))), []);
  const next = nav.home?.next ?? null;
  const columns: Column<StageBrief>[] = [
    { key: 'title', label: 'Chặng', width: 240, grow: 2, render: (st) => <Cell main={`${st.order}. ${st.title}`} sub={st.date_label} /> },
    { key: 'explore', label: 'Nhập vai', width: 220, grow: 1, render: (st) => <Txt size={13} color={c.muc2} numberOfLines={2}>{st.steps.explore === 'done' ? 'Đã hoàn thành nhiệm vụ nhập vai' : st.steps.explore !== 'locked' ? 'Cảnh nhập vai đã mở' : st.lock_reason ?? 'Đạt phần luyện tập của chặng để mở'}</Txt> },
    { key: 'battle', label: 'Trận đánh', width: 110, render: (st) => (!st.has_battle ? <Txt size={13} color={c.muc3}>Không có</Txt> : st.battle_stars > 0 ? <StarRow n={st.battle_stars} size={14} /> : <Txt size={13} color={c.muc3}>Chưa thắng</Txt>) },
  ];
  return (
    <SagaPage testID="saga-roleplay">
      <SagaHeader title="Nhập vai" subtitle="Vào vai một người lính nhà Trần: đi lại trong cảnh, nhận quân lệnh, tìm người, tìm vật rồi ra trận. Mở lại các cảnh và trận đánh em đã mở để chơi lại." />
      {next ? (
        <Card flat pad={14} style={{ borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <View style={{ flex: 1, minWidth: 220 }}>
            <Txt f="bold" size={15}>Chặng đang chờ: {next.title}</Txt>
            <Txt size={13} color={c.muc2}>Học thẻ kiến thức và đạt phần luyện tập để mở cảnh nhập vai của chặng.</Txt>
          </View>
          <Btn title="Mở chặng" icon={Play} tone="son" size="sm" onPress={() => nav.go('chien-dich', { c: next.campaign_no, s: next.stage_id, v: null })} testID="roleplay-next" />
        </Card>
      ) : null}
      {!data.data ? <LoadState loading={data.loading} error={data.error} onRetry={data.reload} /> : data.data.map((cv) => {
        const tone = TONE[cv.map.campaign_no] ?? TONE[1];
        return (
          <Card key={cv.map.campaign_no} flat pad={14} style={{ borderRadius: 12, gap: 10 }} testID={`roleplay-campaign-${cv.map.campaign_no}`}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Chip text={`${tone.label} · ${tone.years}`} bg={tone.soft} fg={tone.text} />
              <Txt f="bold" size={16} accessibilityRole="header" style={{ flex: 1 }}>{cv.map.title}</Txt>
            </View>
            <DataTable columns={columns} rows={cv.stages} rowKey={(st) => st.id} paginate={false} empty="Chưa có chặng nào." actionsWidth={250}
              actions={(st) => {
                const canExplore = st.steps.explore !== 'locked', canBattle = st.steps.battle === 'done';
                return (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    <Btn title="Nhập vai" icon={Footprints} tone="giay" size="sm" disabled={!canExplore} onPress={() => nav.go('chien-dich', { c: st.campaign_no, s: st.id, v: 'kham-pha' })} testID={`roleplay-explore-${st.code}`} label={`Nhập vai ở chặng ${st.title}`} />
                    {st.has_battle ? <Btn title="Đánh trận" icon={Swords} tone="giay" size="sm" disabled={!canBattle} onPress={() => nav.go('chien-dich', { c: st.campaign_no, s: st.id, v: 'tran' })} testID={`roleplay-battle-${st.code}`} label={canBattle ? `Đánh lại trận ${st.title}` : `Trận ${st.title}: thắng lần đầu trong phần nhập vai để mở`} /> : null}
                  </View>
                );
              }} />
          </Card>
        );
      })}
      <InfoNote>Nhân vật em điều khiển và các nhân vật phụ trong cảnh là hư cấu; sự kiện lịch sử nằm ở thẻ kiến thức và phần tổng kết, có ghi nguồn.</InfoNote>
    </SagaPage>
  );
};
