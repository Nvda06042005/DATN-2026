/**
 * Hành trình Đông A – ba màn mở đầu của vòng chơi, dựng bằng bộ thành phần của các cổng quản trị (tiêu đề hai nửa, thẻ số liệu, thẻ viền mảnh, bảng dữ liệu):
 *   1. "Chiến dịch" (16/11/2026): danh sách lớp trước (StudentClasses), vào lớp rồi mới tới ba phần theo ba cuộc kháng chiến 1258, 1285, 1287–1288,
 *      cột cấp độ – chuỗi ngày – vàng, nhiệm vụ hôm nay, câu cần ôn, kỳ thi.
 *   2. Trang bản đồ: ba phần nối nhau khi cuộn, mỗi phần là ảnh bản đồ gốc của Wikipedia tiếng Việt kiểu sa bàn: các chặng đặt theo tỉ lệ 0–1 trên ảnh, có số thứ tự,
 *      tên, ngày, trạng thái (màu, biểu tượng, chữ, nhãn trợ năng), đường nối, Rồng Con ở chặng đang học và khung chú thích bên dưới. Phóng to, kéo để xem.
 *   3. Bảng thông tin chặng: mục tiêu học, các bước, lý do còn khóa, kết quả cũ và nút Học / Chơi tiếp / Ôn lại.
 * Mục "Nhập vai" gom các cảnh khám phá và trận đánh đã mở để chơi lại nhanh.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, Platform, Pressable, ScrollView, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { Award, BookOpen, Check, ChevronLeft, Coins, Footprints, Gamepad2, Lock, Maximize2, Play, Puzzle, RotateCcw, Sparkles, Swords, Target, Users, ZoomIn, ZoomOut } from 'lucide-react-native';
import * as saga from '@/lib/saga-api';
import * as authApi from '@/api/authApi';
import { Mascot } from '@/components/art';
import { RolePlayLobby } from '@/components/portal/RolePlayLobby';
import type { Session } from '@/components/auth';
import {
  BlockTitle, KIND_TEXT, LoadState, Portrait, RARITY, STATE, SagaHeader, SagaPage, StarRow, TONE, mapSource, num, stageIcon, useLoad, type SagaNav, type SagaStep,
} from '@/components/portal/SagaKit';
import { ChestArt, SagaRail } from '@/components/portal/SagaRail';
import { ChestOpening } from '@/components/portal/SagaChest';
import { AdventureScene, LearnerStats, STUDENT as S } from '@/components/portal/StudentDesign';
import { HALL, HallBoard, HallGallery, HallHero, HallSteps, HallTitle, RankLadder, scholarRank } from '@/components/portal/StudentHall';
import { Btn, Card, Chip, Inset, Segmented, Sheet, Txt, useToast } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { IconType } from '@/types/game';
import type { CampaignView, SagaCampaign, SagaChest, SagaMapInfo, StageBrief, StageDetail, StepState } from '@/types/saga';

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

/** Campaign portal. The miniature island is decorative; the actual campaign uses the original Wikipedia map. */
const UnitBanner: React.FC<{ camp: SagaCampaign; onOpen: () => void }> = ({ camp, onOpen }) => {
  const tone = TONE[camp.campaign_no];
  const { width } = useWindowDimensions();
  const label = camp.completed ? 'Ôn lại chiến dịch' : camp.available ? 'Khám phá chiến dịch' : 'Xem điều kiện mở';
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Phần ${camp.campaign_no}: ${camp.title}, ${camp.done} trên ${camp.stages} chặng, ${camp.stars} trên ${camp.max_stars} sao. ${label}`} testID={`path-unit-${camp.campaign_no}`}
      style={({ pressed }) => ({ borderRadius: 22, backgroundColor: pressed ? '#f1faf6' : S.white, padding: 18, gap: 13, alignSelf: 'stretch', borderWidth: 1, borderBottomWidth: 4, borderColor: S.line, opacity: pressed ? 0.94 : 1 })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        {width >= 680 ? <View style={{ width: 132, height: 137, borderRadius: 17, backgroundColor: tone.soft, overflow: 'hidden', justifyContent: 'center' }}><AdventureScene variant={camp.campaign_no} style={{ width: 169, height: 137, marginLeft: -18 }} /></View> : null}
        <View style={{ flex: 1, minWidth: 0, gap: 9 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }}>
            <Txt f="bold" size={12} color={tone.text} style={{ letterSpacing: 0.9 }}>PHẦN {camp.campaign_no} · {tone.years}</Txt>
            {camp.completed ? <Check size={19} color={S.teal} /> : !camp.available ? <Lock size={17} color={S.muted} /> : null}
          </View>
          <Txt f="heavy" size={18} color={S.ink} accessibilityRole="header">{camp.title}</Txt>
          <Txt size={16} color={S.muted} numberOfLines={2}>{camp.summary}</Txt>
          <View style={{ height: 10, borderRadius: 5, backgroundColor: '#e6efe8', overflow: 'hidden' }}>
            <View style={{ width: `${Math.max(0, Math.min(100, Math.round(camp.percent)))}%`, height: '100%', borderRadius: 5, backgroundColor: tone.main }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <Txt size={13} color={S.muted}>{camp.done}/{camp.stages} chặng</Txt>
            <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}><StarRow n={camp.stars > 0 ? 1 : 0} max={1} size={16} /><Txt f="bold" size={13} color={S.goldInk}>{camp.stars}/{camp.max_stars}</Txt></View>
          </View>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <Txt f="semibold" size={13} color={camp.available ? S.teal : S.muted}>{camp.completed ? 'Đã chinh phục' : camp.available ? 'Sẵn sàng khám phá' : 'Hoàn thành phần trước để mở'}</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 11, backgroundColor: camp.available ? S.mint : '#edf1ef', paddingHorizontal: 12, minHeight: 44 }} testID={`path-go-${camp.campaign_no}`}>
          {camp.available ? <Play size={15} color={S.teal} /> : <Lock size={15} color={S.muted} />}<Txt f="bold" size={13} color={camp.available ? S.deep : S.muted}>{label}</Txt>
        </View>
      </View>
    </Pressable>
  );
};

// ---------------------------------------------------------------------- 1. trang chủ: sảnh Hành trình Đông A (trang cuộn dọc)
/**
 * Trang chủ học sinh (20/11/2026, theo ảnh VL-LEGEND người dùng gửi, chọn "Bỏ menu trái, trang cuộn dọc"), mở sau khi em chọn lớp ở danh sách lớp:
 * nút quay lại "Lớp học" + lớp đang học → màn mở đầu cung điện có nút VÀO TRẬN (tới chặng tiếp theo) → giới thiệu Học – Luyện – Ra trận,
 * ba chiến dịch (bấm một phần mở trang bản đồ) và cột nhiệm vụ / giải đấu / ôn tập / kỳ thi → thang danh hiệu 5 bậc khoa cử thời Trần
 * → bảng vàng (bảng xếp hạng lớp / trường) → thư viện tranh. Mọi số liệu lấy từ máy chủ; danh hiệu chỉ là cách hiển thị tiến độ đó.
 */
export const HomeScreen: React.FC<{ session: Session; nav: SagaNav; loading: boolean; error: string | null; cls: MyClass | null; onLeave: () => void }> = ({ session, nav, loading, error, cls, onLeave }) => {
  const { width } = useWindowDimensions();
  const wide = width >= 1280;
  const home = nav.home;
  const hud = home?.hud ?? null;
  const next = home?.next ?? null;
  const level = hud?.level ?? null;
  const rank = useMemo(() => scholarRank(home?.campaigns), [home]);
  // cột bên phải kiểu Duolingo (17/11/2026): dải chỉ số, cấp độ, giải đấu tuần, nhiệm vụ hằng ngày có hòm báu, ôn tập, kỳ thi
  const rail = home && hud && level ? <SagaRail session={session} nav={nav} wide={wide} /> : null;
  const units = home ? (
    <View style={{ gap: 14, flex: wide ? 1 : undefined, minWidth: 0, alignSelf: 'stretch' }} testID="home-units">
      <HallTitle eyebrow="BẢN ĐỒ HÀNH TRÌNH" ink="Ba chiến dịch," red={`${home.totals.stages} chặng khám phá`} />
      {home.campaigns.map((camp) => <UnitBanner key={camp.campaign_no} camp={camp} onOpen={() => nav.go('chien-dich', { c: camp.campaign_no, s: null, v: null })} />)}
      <View style={{ borderRadius: 20, backgroundColor: '#e8f3ed', padding: 19, gap: 12 }}>
        <Txt f="bold" size={17}>Đổi gió một chút?</Txt>
        <Txt size={16} color={S.muted}>Luyện trí nhớ, nhập vai hoặc khám phá bộ thẻ của em.</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
          <Btn title="Ôn tập" icon={RotateCcw} tone="giay" onPress={() => nav.go('cau-hoi')} />
          <Btn title="Nhập vai" icon={Gamepad2} tone="giay" onPress={() => nav.go('nhap-vai')} />
          <Btn title="Bộ thẻ" icon={Award} tone="giay" onPress={() => nav.go('bo-the')} />
        </View>
      </View>
    </View>
  ) : null;
  const play = (): void => nav.go('chien-dich', next ? { c: next.campaign_no, s: next.stage_id, v: null } : { c: 1, s: null, v: null });
  return (
    <SagaPage testID="saga-home" max={1320}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Btn title="Lớp học" icon={ChevronLeft} tone="ghost" size="sm" onPress={onLeave} label="Về danh sách lớp học" testID="saga-back" style={{ marginLeft: -10 }} />
        {cls ? <View style={{ flex: 1, minWidth: 220 }}><ClassBar cls={cls} /></View> : null}
      </View>
      {!home || !hud || !level ? <LoadState loading={loading} error={error} onRetry={nav.refresh} /> : (
        <>
          <HallHero home={home} rank={rank} onPlay={play} onMap={() => nav.go('chien-dich', { c: next?.campaign_no ?? 1, s: null, v: null })} />
          {width < 1320 ? <LearnerStats home={home} compact={width < 600} /> : null}
          <HallSteps />
          <View style={{ flexDirection: wide ? 'row' : 'column', gap: 24, alignItems: 'flex-start' }}>
            {units}{rail}
          </View>
          <RankLadder rank={rank} />
          <HallBoard session={session} classId={cls?.id ?? null} className={cls?.name ?? null} />
          <HallGallery level={rank.level} home={home} />
          <Txt size={12} color={HALL.muted} center style={{ lineHeight: 18 }}>
            Nhân vật, trang phục, cung điện và tranh trong sảnh là hình vẽ cách điệu do nhóm Đông A tự sáng tác, không phục dựng di tích hay trang phục cụ thể.
            Bản đồ các phần là bản đồ gốc trên Wikipedia tiếng Việt.
          </Txt>
        </>
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

/** Một phần trên trang bản đồ: tên cuộc kháng chiến, tiến độ, bản đồ gốc có các chặng và khung chú thích sa bàn */
const PartSection: React.FC<{
  no: number; camp: SagaCampaign | null; view: CampaignView | null; loading: boolean; error: string | null; onRetry: () => void;
  selectedId: number | null; mascotId: number | null; onPick: (st: StageBrief) => void; maxHeight: number; onLayoutPart: (y: number, h: number) => void; onChest: (chest: SagaChest) => void;
}> = ({ no, camp, view, loading, error, onRetry, selectedId, mascotId, onPick, maxHeight, onLayoutPart, onChest }) => {
  const { c } = useTheme();
  const tone = TONE[no];
  return (
    <View onLayout={(e) => onLayoutPart(e.nativeEvent.layout.y, e.nativeEvent.layout.height)} style={{ gap: 10 }} testID={`saga-part-${no}`}>
      <View style={{ gap: 2 }}>
        <Txt f="bold" size={12} color={tone.main} style={{ letterSpacing: 0.6 }}>PHẦN {no} · {tone.years}</Txt>
        <Txt f="bold" size={20} accessibilityRole="header">{view?.map.title ?? camp?.title ?? `Phần ${no}`}</Txt>
        {view ? <Txt size={13} color={c.muc3}>Đã xong {view.totals.done}/{view.totals.stages} chặng · {view.totals.stars}/{view.totals.max_stars} sao{camp && !camp.available ? ' · mở khi xong phần trước' : ''}</Txt> : null}
      </View>
      {!view ? <LoadState loading={loading} error={error} onRetry={onRetry} /> : (
        <Card flat pad={12} style={{ borderRadius: 12, gap: 8, borderTopWidth: 4, borderTopColor: tone.main }} testID={`unit-map-${no}`}>
          <SagaMap map={view.map} stages={view.stages} currentId={view.current_stage_id} selectedId={selectedId} mascotId={mascotId} onPick={onPick} maxHeight={maxHeight} chests={view.chests ?? []} onChest={onChest} />
          <View testID="map-caption" style={{ borderRadius: 10, padding: 12, gap: 4, backgroundColor: c.logoInk }}>
            <Txt f="bold" size={13} color={c.logoGold} style={{ letterSpacing: 0.4 }}>{`Sa bàn: ${view.map.title} (${view.map.years})`.toLocaleUpperCase('vi')}</Txt>
            <Txt size={12} color="#ffffff" style={{ lineHeight: 18 }}>• {view.stages.length} chặng: {view.stages.map((st) => st.title).join(', ')}.</Txt>
            <Txt size={12} color="#ffffff" style={{ lineHeight: 18 }}>• Bấm trực tiếp vào từng chặng trên bản đồ để học; xong chặng thì mở hòm báu trên đường đi để nhận vàng.</Txt>
          </View>
        </Card>
      )}
    </View>
  );
};

/**
 * Trang bản đồ của Hành trình (16/11/2026 đợt 7): ba phần nối nhau khi cuộn – mỗi phần một bản đồ gốc của Wikipedia kiểu sa bàn (số, tên, ngày từng chặng,
 * đường nối, khung chú thích); Rồng Con đi trên bản đồ tới chặng đang học. Bấm một phần ở trang Chiến dịch hoặc ở thanh chọn phần thì cuộn tới phần đó.
 * Bấm chặng trên bản đồ mở bảng thông tin chặng. Đã bỏ lộ trình uốn lượn riêng, thẻ phần có ảnh thu nhỏ và dòng ghi nguồn (ghi công bản đồ ở trang
 * Thông tin hình ảnh).
 */
export const CampaignScreen: React.FC<{ session: Session; nav: SagaNav; no: number }> = ({ session, nav, no }) => {
  const toast = useToast();
  const { height } = useWindowDimensions();
  const p1 = useLoad<CampaignView>(session, (t) => saga.campaign(t, 1), []);
  const p2 = useLoad<CampaignView>(session, (t) => saga.campaign(t, 2), []);
  const p3 = useLoad<CampaignView>(session, (t) => saga.campaign(t, 3), []);
  // hòm báu: còn khóa / đã mở thì báo; sẵn sàng thì mở màn mở rương – chạm vào hòm mới gọi máy chủ (máy chủ tung độ hiếm, trao thưởng một lần)
  const [opening, setOpening] = useState<{ box: SagaChest; part: number } | null>(null);
  const onChest = (box: SagaChest, part: number): void => {
    if (box.state === 'opened') { toast('Em đã mở hòm báu này rồi.'); return; }
    if (box.state === 'locked') { toast(box.kind === 'part' ? 'Hoàn thành mọi chặng của phần này để mở hòm báu cuối phần.' : `Hoàn thành chặng ${box.after} để mở hòm báu này.`); return; }
    setOpening({ box, part });
  };
  const parts = [p1, p2, p3];
  const next = nav.home?.next ?? null;
  const open = nav.route.s !== null && nav.route.v === null ? nav.route.s : null;
  const openNo = open === null ? no : (parts.findIndex((p) => p.data?.stages.some((st) => st.id === open)) + 1 || no);
  const pick = (st: StageBrief): void => nav.go('chien-dich', { c: no, s: st.id, v: null }, 'params');
  const sum = (k: 'done' | 'stages' | 'stars' | 'max_stars') => parts.reduce((n, p) => n + (p.data?.totals[k] ?? 0), 0);
  // cuộn tới phần đang chọn: vị trí tính từ phần 1 cộng chiều cao các phần phía trên (bản đồ dãn ra sau khi đo khung nên trong ~2 giây đầu
  // mỗi lần một phần đổi chiều cao thì cuộn lại cho đúng)
  const scroll = useRef<ScrollViewInstance | null>(null);
  const lay = useRef<Record<number, { y: number; h: number }>>({});
  const shown = useRef<number | null>(null);
  const settle = useRef(0);
  const target = useRef(no);
  target.current = no;
  const loaded = parts.every((p) => p.data || p.error);
  const jump = useCallback((animated: boolean) => {
    const n = target.current, first = lay.current[1];
    if (!first) return;
    let y = first.y;
    for (let k = 1; k < n; k += 1) { const sec = lay.current[k]; if (!sec) return; y += sec.h + 16; }
    scroll.current?.scrollTo({ y: n === 1 ? 0 : Math.max(0, y - 8), animated });
  }, []);
  useEffect(() => {
    if (!loaded || shown.current === no) return undefined;
    const animated = shown.current !== null;
    shown.current = no;
    settle.current = Date.now() + 2000;
    const t = setTimeout(() => jump(animated), 120);
    return () => clearTimeout(t);
  }, [loaded, no, jump]);
  const onLayoutPart = (n: number, y: number, h: number): void => {
    lay.current[n] = { y, h };
    if (shown.current !== null && Date.now() < settle.current) jump(false);
  };
  return (
    <SagaPage testID="saga-campaign" max={1180} scrollRef={scroll}>
      <SagaHeader title="Bản đồ Hành trình" subtitle={loaded ? `Ba lần kháng chiến chống quân Mông – Nguyên · đã xong ${sum('done')}/${sum('stages')} chặng · ${sum('stars')}/${sum('max_stars')} sao` : 'Ba lần kháng chiến chống quân Mông – Nguyên (1258, 1285, 1287–1288)'}
        back={{ label: 'Chiến dịch', hint: 'Về ba phần của Hành trình', onPress: () => nav.back('chien-dich', { c: null, s: null, v: null }) }}
        actions={next ? <Btn icon={Play} title={`${next.state === 'learning' ? 'Học tiếp' : 'Bắt đầu'}: ${next.title}`} tone="son" size="sm" onPress={() => nav.go('chien-dich', { c: next.campaign_no, s: next.stage_id, v: null }, 'params')} testID="unit-continue" /> : undefined} />
      <Segmented<number> label="Chọn phần" value={no} onChange={(n) => nav.go('chien-dich', { c: n, s: null, v: null }, 'params')}
        options={[1, 2, 3].map((n) => ({ value: n, label: `Phần ${n} · ${TONE[n].years}` }))} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {(Object.keys(STATE) as Array<keyof typeof STATE>).map((k) => <StateChip key={k} state={k} />)}
      </View>
      {parts.map((p, i) => (
        <PartSection key={i + 1} no={i + 1} camp={nav.home?.campaigns.find((x) => x.campaign_no === i + 1) ?? null} view={p.data} loading={p.loading} error={p.error} onRetry={p.reload}
          selectedId={open} mascotId={next && next.campaign_no === i + 1 ? next.stage_id : null} onPick={pick} maxHeight={Math.max(320, Math.min(760, height - 190))}
          onLayoutPart={(y, h) => onLayoutPart(i + 1, y, h)} onChest={(box) => onChest(box, i + 1)} />
      ))}
      {open !== null ? <StageSheet session={session} nav={nav} stageId={open} campaignNo={openNo} /> : null}
      {opening ? (
        <ChestOpening session={session} chest={opening.box} look={nav.home?.look} open={() => saga.openChest(session.token, opening.box.key)}
          onClose={(opened) => { const part = opening.part; setOpening(null); if (opened) { [p1, p2, p3][part - 1].reload(); nav.refresh(); } }} />
      ) : null}
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
export const RolePlayScreen: React.FC<{ session: Session; nav: SagaNav }> = ({ session, nav }) => <RolePlayLobby session={session} nav={nav} />;
