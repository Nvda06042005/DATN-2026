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
import { Award, BookOpen, Check, ChevronLeft, Coins, Footprints, Gamepad2, Lock, Map as MapIcon, Maximize2, Play, Puzzle, Route, RotateCcw, Sparkles, Swords, Target, Users, ZoomIn, ZoomOut } from 'lucide-react-native';
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
import { BlockCard, GameButton, LearnerStats, STUDENT as S, sceneOf } from '@/components/portal/StudentDesign';
import { Chibi, DrumSun, VnScene, type ChibiKind } from '@/components/portal/StudentArt';
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

// ---------------------------------------------------------------------- lộ trình kiểu trò chơi học tập (23/11/2026, "Sắc Việt")
/**
 * Người dùng chọn "Đường đi kiểu Duolingo": mỗi phần là một dải tiêu đề màu (tên cuộc kháng chiến, tiến độ, nút "Xem bản đồ" mở bản đồ gốc Wikipedia)
 * và con đường uốn lượn qua các chặng – nút tròn khối theo trạng thái (vàng: đã xong, màu của phần: đang mở, cam: cần ôn, be: còn khóa), hòm báu nằm giữa
 * hai chặng, bóng chữ "BẮT ĐẦU / HỌC TIẾP" và nhân vật chibi đứng cạnh chặng đang chờ. Nền là cảnh làng tre / đình làng / sông núi tự vẽ (StudentArt).
 * Trạng thái, sao, hòm do máy chủ trả về; bấm chặng mở bảng thông tin chặng như trên bản đồ. Chỉ lấy thể loại, không dùng hình của sản phẩm khác.
 */
const PART_EDGE: Record<number, string> = { 1: '#0f5e2c', 2: '#8f300a', 3: '#7f1d1d' };
const PART_GUIDE: Record<number, ChibiKind> = { 1: 'thu-sinh', 2: 'thieu-nu', 3: 'tuong' };
const PART_GUEST: Record<number, ChibiKind> = { 1: 'nong-nu', 2: 'quan', 3: 'nong-nam' };
const WAVE = [0, 0.6, 0.95, 0.6, 0, -0.6, -0.95, -0.6];
const DUO = 76;
const STAGE_GAP = 160, CHEST_GAP = 96, CHEST_DROP = 140, PATH_TOP = 250;
type PathItem = { kind: 'stage'; st: StageBrief; x: number; y: number } | { kind: 'chest'; box: SagaChest; x: number; y: number };

const nodeLook = (st: StageBrief, no: number): { face: string; edge: string; fg: string; icon: IconType } => {
  if (st.state === 'done') return { face: S.gold, edge: S.goldDeep, fg: '#5a3d00', icon: Check };
  if (st.state === 'review') return { face: '#f08a24', edge: '#b25a0a', fg: '#ffffff', icon: RotateCcw };
  if (st.state === 'locked') return { face: '#eadfcb', edge: '#cdb995', fg: '#8a7552', icon: Lock };
  return { face: TONE[no].main, edge: PART_EDGE[no], fg: '#ffffff', icon: st.battle_mode ? Swords : st.state === 'learning' ? BookOpen : Play };
};

/** Một phần của lộ trình: dải tiêu đề + con đường các chặng (dùng ở trang chủ trong lớp và trang Hành trình) */
const PathPart: React.FC<{
  no: number; camp: SagaCampaign | null; view: CampaignView | null; loading: boolean; error: string | null; onRetry: () => void; currentId: number | null; selectedId?: number | null;
  onPick: (st: StageBrief) => void; onChest: (box: SagaChest) => void; onMap: () => void; onLayoutPart?: (y: number, h: number) => void;
}> = ({ no, camp: given, view, loading, error, onRetry, currentId, selectedId = null, onPick, onChest, onMap, onLayoutPart }) => {
  const tone = TONE[no];
  const [w, setW] = useState(0);
  const camp: SagaCampaign = given ?? {
    campaign_no: no, title: view?.map.title ?? `Phần ${no}`, short_title: view?.map.short_title ?? '', years: tone.years, enemy: '', places: '', summary: '',
    stages: view?.totals.stages ?? 0, done: view?.totals.done ?? 0, stars: view?.totals.stars ?? 0, max_stars: view?.totals.max_stars ?? 0, percent: 0, completed: false, is_new: false, available: true,
  };
  // vị trí các chặng / hòm: đi xuống theo hàng, lệch trái phải theo nhịp sóng
  const { items, height } = useMemo(() => {
    const out: PathItem[] = [];
    if (!view || !w) return { items: out, height: 520 };
    const amp = Math.max(36, Math.min(118, (w - 230) / 2));
    let y = PATH_TOP, j = 0;
    const at = (): number => w / 2 + WAVE[j++ % WAVE.length] * amp;
    // hòm nằm dưới nhãn tên chặng (nhãn có thể hai dòng + hàng sao), chặng sau cách hòm một khoảng CHEST_GAP
    view.stages.forEach((st, k) => {
      const top = y;
      out.push({ kind: 'stage', st, x: at(), y }); y += STAGE_GAP;
      for (const box of (view.chests ?? []).filter((b) => b.after === k + 1)) { const cy = Math.max(top + CHEST_DROP, y - 20); out.push({ kind: 'chest', box, x: at(), y: cy }); y = cy + CHEST_GAP; }
    });
    return { items: out, height: y + 10 };
  }, [view, w]);
  const cur = items.findIndex((it) => it.kind === 'stage' && it.st.id === currentId);
  const guest = items.length > 3 ? Math.floor(items.length / 2) + (cur === Math.floor(items.length / 2) ? 1 : 0) : -1;
  /** chỗ đứng của nhân vật cạnh một chặng: phía đối diện với hướng lệch của đường, không tràn mép */
  const beside = (it: PathItem, size: number): { left: number; top: number } | null => {
    const sides = it.x >= w / 2 ? [-1, 1] : [1, -1];
    for (const sd of sides) {
      const left = sd < 0 ? it.x - DUO / 2 - 14 - size : it.x + DUO / 2 + 14;
      if (left >= 0 && left + size <= w) return { left, top: it.y - (size * 1.4) / 2 - 18 };
    }
    return null;
  };
  const chibiSize = w < 420 ? 74 : 96;
  const guideAt = cur >= 0 ? beside(items[cur], chibiSize) : null;
  const guestAt = guest >= 0 && guest < items.length && w >= 440 ? beside(items[guest], 86) : null;
  return (
    <View style={{ gap: 12 }} testID={`path-part-${no}`} onLayout={onLayoutPart ? (e) => onLayoutPart(e.nativeEvent.layout.y, e.nativeEvent.layout.height) : undefined}>
      <View testID={`path-unit-${no}`} style={{ borderRadius: 22, overflow: 'hidden', backgroundColor: tone.main, borderBottomWidth: 6, borderBottomColor: PART_EDGE[no] }}>
        <DrumSun size={240} color="#ffffff" opacity={0.16} style={{ position: 'absolute', right: -70, top: -90 }} />
        <View style={{ padding: 16, paddingLeft: 18, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, minWidth: 210, gap: 3 }}>
            <Txt f="heavy" size={12} color="#ffe9c2" style={{ letterSpacing: 1.6 }}>PHẦN {no} · {tone.years}{camp.completed ? ' · ĐÃ CHINH PHỤC' : ''}</Txt>
            <Txt f="heavy" size={21} color="#ffffff" accessibilityRole="header" style={{ lineHeight: 27 }}>{camp.title}</Txt>
            <Txt f="semibold" size={13} color="#fff4e2">{camp.done}/{camp.stages} chặng · {camp.stars}/{camp.max_stars} sao{!camp.available ? ' · mở khi xong phần trước' : ''}</Txt>
          </View>
          <Pressable testID={`path-go-${camp.campaign_no}`} accessibilityRole="button" accessibilityLabel={`Xem bản đồ gốc Phần ${camp.campaign_no}: ${camp.title}`} onPress={onMap} style={{ paddingBottom: 4 }}>
            {({ pressed }) => (
              <>
                <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 4, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.22)' }} />
                <View style={{ minHeight: 46, paddingHorizontal: 15, borderRadius: 14, backgroundColor: '#ffffff', flexDirection: 'row', alignItems: 'center', gap: 8, transform: [{ translateY: pressed ? 3 : 0 }] }}>
                  <MapIcon size={18} color={tone.main} strokeWidth={2.6} /><Txt f="heavy" size={14} color={tone.text}>Xem bản đồ</Txt>
                </View>
              </>
            )}
          </Pressable>
        </View>
      </View>
      {!view ? <LoadState loading={loading} error={error} onRetry={onRetry} /> : (
        <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height, borderRadius: 26, overflow: 'hidden', borderWidth: 2, borderBottomWidth: 5, borderColor: S.line, backgroundColor: '#fffaf0' }}>
          <VnScene kind={sceneOf(no)} fade="#fffaf0" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 240 }} />
          {Array.from({ length: Math.floor((height - 260) / 520) + 1 }, (_, i) => (
            <DrumSun key={i} size={230} opacity={0.08} style={{ position: 'absolute', top: 300 + i * 520, ...(i % 2 ? { right: -90 } : { left: -90 }) }} />
          ))}
          {w > 0 && items.length > 1 ? (
            <Svg width={w} height={height} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
              <Polyline points={items.map((it) => `${it.x},${it.y}`).join(' ')} fill="none" stroke="#e6d3ad" strokeWidth={10} strokeDasharray="1 18" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          ) : null}
          {guestAt ? <View pointerEvents="none" style={{ position: 'absolute', ...guestAt }}><Chibi kind={PART_GUEST[no]} size={86} flip={guestAt.left < w / 2} /></View> : null}
          {guideAt ? <View pointerEvents="none" testID="path-guide" style={{ position: 'absolute', zIndex: 4, ...guideAt }}><Chibi kind={PART_GUIDE[no]} size={chibiSize} flip={guideAt.left > w / 2} /></View> : null}
          {items.map((it) => {
            if (it.kind === 'chest') {
              const box = it.box;
              return (
                <Pressable key={box.key} onPress={() => onChest(box)} accessibilityRole="button" testID={`path-chest-${box.key}`}
                  accessibilityLabel={`${box.kind === 'part' ? 'Hòm báu cuối phần' : `Hòm báu sau chặng ${box.after}`}: ${box.state === 'opened' ? 'đã mở' : box.state === 'ready' ? `hòm bí ẩn, bấm để mở – phần thưởng lên tới ${box.max_gold ?? 100} vàng` : 'còn khóa'}`}
                  style={({ pressed }) => ({ position: 'absolute', zIndex: 3, left: it.x - 36, top: it.y - 32, width: 72, height: 64, alignItems: 'center', justifyContent: 'center', borderRadius: 20, opacity: pressed ? 0.85 : 1,
                    backgroundColor: box.state === 'ready' ? 'rgba(255,194,58,0.28)' : 'transparent' })}>
                  {box.state === 'ready' ? <Bounce><ChestArt size={56} state="ready" /></Bounce> : <ChestArt size={50} state={box.state} />}
                </Pressable>
              );
            }
            const st = it.st;
            const look = nodeLook(st, no);
            const current = st.id === currentId, picked = st.id === selectedId;
            const Icon = look.icon;
            return (
              <View key={st.id} pointerEvents="box-none" style={{ position: 'absolute', left: it.x - 95, top: it.y - DUO / 2, width: 190, alignItems: 'center', zIndex: current || picked ? 5 : 2 }}>
                {current || picked ? <View pointerEvents="none" style={{ position: 'absolute', top: -9, left: 95 - (DUO + 18) / 2, width: DUO + 18, height: DUO + 24, borderRadius: (DUO + 18) / 2, borderWidth: 5, borderColor: picked ? '#e3b244' : `${tone.main}55` }} /> : null}
                {current ? (
                  <View pointerEvents="none" style={{ position: 'absolute', top: -58, left: 0, right: 0, alignItems: 'center' }}>
                    <Bounce>
                      <View style={{ alignItems: 'center' }}>
                        <View style={{ backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 2, borderColor: tone.main, paddingHorizontal: 12, paddingVertical: 4 }}>
                          <Txt f="heavy" size={13} color={tone.text} style={{ letterSpacing: 1 }}>{st.state === 'learning' ? 'HỌC TIẾP' : st.state === 'review' ? 'ÔN LẠI' : 'BẮT ĐẦU'}</Txt>
                        </View>
                        <View style={{ width: 12, height: 12, backgroundColor: '#ffffff', borderRightWidth: 2, borderBottomWidth: 2, borderColor: tone.main, transform: [{ rotate: '45deg' }], marginTop: -7 }} />
                      </View>
                    </Bounce>
                  </View>
                ) : null}
                <Pressable testID={`path-node-${st.code}`} accessibilityRole="button" onPress={() => onPick(st)}
                  accessibilityLabel={`Chặng ${st.order}: ${st.title}, ${st.date_label}. ${STATE[st.state].label}${st.stars ? `, ${st.stars} sao` : ''}${st.lock_reason ? `. ${st.lock_reason}` : ''}`}
                  style={{ width: DUO, height: DUO + 6 }}>
                  {({ pressed }) => (
                    <>
                      <View style={{ position: 'absolute', top: 6, left: 0, width: DUO, height: DUO, borderRadius: DUO / 2, backgroundColor: look.edge }} />
                      <View style={{ position: 'absolute', top: pressed ? 5 : 0, left: 0, width: DUO, height: DUO, borderRadius: DUO / 2, backgroundColor: look.face, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)' }}>
                        <Icon size={31} color={look.fg} strokeWidth={2.8} />
                      </View>
                    </>
                  )}
                </Pressable>
                <View pointerEvents="none" style={{ marginTop: 6, maxWidth: 190, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 12, borderWidth: 2, borderColor: current ? tone.main : S.line, paddingHorizontal: 10, paddingVertical: 3, alignItems: 'center' }}>
                  <Txt f="heavy" size={13} color={st.state === 'locked' ? S.muted : S.ink} numberOfLines={2} center>{st.order}. {st.title}</Txt>
                  {st.stars > 0 ? <StarRow n={st.stars} size={13} /> : <Txt size={11} color={S.muted} numberOfLines={1}>{st.date_label}</Txt>}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

/** Kiểu xem của trang Hành trình (lộ trình / bản đồ gốc): nút "Xem bản đồ" mở bản đồ; quay lại từ một bước của chặng giữ kiểu xem đã chọn */
let campaignView: 'path' | 'map' = 'path';

// ---------------------------------------------------------------------- 1. trang chủ: sảnh Hành trình Đông A (trang cuộn dọc)
/**
 * Trang chủ học sinh, mở sau khi em chọn lớp ở danh sách lớp. 20/11/2026: sảnh cuộn dọc (màn mở đầu có VÀO TRẬN, giới thiệu, thang danh hiệu, bảng vàng,
 * thư viện tranh). 23/11/2026 ("Sắc Việt"): ngay sau màn mở đầu là **lộ trình kiểu trò chơi học tập** của cả ba phần (13 chặng) cạnh cột nhiệm vụ / giải đấu
 * bên phải; bấm chặng mở bảng thông tin chặng ngay trên trang, "Xem bản đồ" mở bản đồ gốc Wikipedia của phần đó. Mọi số liệu lấy từ máy chủ; danh hiệu chỉ là
 * cách hiển thị tiến độ đó.
 */
export const HomeScreen: React.FC<{ session: Session; nav: SagaNav; loading: boolean; error: string | null; cls: MyClass | null; onLeave: () => void }> = ({ session, nav, loading, error, cls, onLeave }) => {
  const toast = useToast();
  const { width } = useWindowDimensions();
  const wide = width >= 1180;
  const home = nav.home;
  const hud = home?.hud ?? null;
  const next = home?.next ?? null;
  const level = hud?.level ?? null;
  const rank = useMemo(() => scholarRank(home?.campaigns), [home]);
  const p1 = useLoad<CampaignView>(session, (t) => saga.campaign(t, 1), []);
  const p2 = useLoad<CampaignView>(session, (t) => saga.campaign(t, 2), []);
  const p3 = useLoad<CampaignView>(session, (t) => saga.campaign(t, 3), []);
  const parts = [p1, p2, p3];
  const [sheet, setSheet] = useState<{ id: number; no: number } | null>(null);
  const [opening, setOpening] = useState<{ box: SagaChest; part: number } | null>(null);
  const onChest = (box: SagaChest, part: number): void => {
    if (box.state === 'opened') { toast('Em đã mở hòm báu này rồi.'); return; }
    if (box.state === 'locked') { toast(box.kind === 'part' ? 'Hoàn thành mọi chặng của phần này để mở hòm báu cuối phần.' : `Hoàn thành chặng ${box.after} để mở hòm báu này.`); return; }
    setOpening({ box, part });
  };
  const toMap = (no: number): void => { campaignView = 'map'; nav.go('chien-dich', { c: no, s: null, v: null }); };
  // cột bên phải kiểu Duolingo (17/11/2026): dải chỉ số, cấp độ, giải đấu tuần, nhiệm vụ hằng ngày có hòm báu, ôn tập, kỳ thi
  const rail = home && hud && level ? <View style={{ width: wide ? 340 : '100%' }}><SagaRail session={session} nav={nav} wide={wide} /></View> : null;
  const units = home ? (
    <View style={{ gap: 18, flex: wide ? 1 : undefined, width: wide ? undefined : '100%', minWidth: 0 }} testID="home-units">
      <HallTitle eyebrow="LỘ TRÌNH HÀNH TRÌNH" ink="Ba chiến dịch," red={`${home.totals.stages} chặng khám phá`} />
      <View style={{ gap: 26 }} testID="duo-path">
        {parts.map((p, i) => (
          <PathPart key={i + 1} no={i + 1} camp={home.campaigns.find((x) => x.campaign_no === i + 1) ?? null} view={p.data} loading={p.loading} error={p.error} onRetry={p.reload}
            currentId={next && next.campaign_no === i + 1 ? next.stage_id : null} selectedId={sheet?.id ?? null}
            onPick={(st) => setSheet({ id: st.id, no: i + 1 })} onChest={(box) => onChest(box, i + 1)} onMap={() => toMap(i + 1)} />
        ))}
      </View>
      <BlockCard pad={18} color="#cfe6c4" bg={S.greenSoft} style={{ gap: 12 }}>
        <Txt f="heavy" size={17} color={S.ink}>Đổi gió một chút?</Txt>
        <Txt size={15} color={S.muted}>Luyện trí nhớ, nhập vai hoặc khám phá bộ thẻ của em.</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
          <GameButton title="Ôn tập" icon={RotateCcw} tone="paper" onPress={() => nav.go('cau-hoi')} />
          <GameButton title="Nhập vai" icon={Gamepad2} tone="paper" onPress={() => nav.go('nhap-vai')} />
          <GameButton title="Bộ thẻ" icon={Award} tone="paper" onPress={() => nav.go('bo-the')} />
        </View>
      </BlockCard>
    </View>
  ) : null;
  const play = (): void => { campaignView = 'path'; nav.go('chien-dich', next ? { c: next.campaign_no, s: next.stage_id, v: null } : { c: 1, s: null, v: null }); };
  return (
    <SagaPage testID="saga-home" max={1320}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Btn title="Lớp học" icon={ChevronLeft} tone="ghost" size="sm" onPress={onLeave} label="Về danh sách lớp học" testID="saga-back" style={{ marginLeft: -10 }} />
        {cls ? <View style={{ flex: 1, minWidth: 220 }}><ClassBar cls={cls} /></View> : null}
      </View>
      {!home || !hud || !level ? <LoadState loading={loading} error={error} onRetry={nav.refresh} /> : (
        <>
          <HallHero home={home} rank={rank} onPlay={play} onMap={() => toMap(next?.campaign_no ?? 1)} />
          {width < 560 ? <LearnerStats home={home} compact /> : null}
          <View style={{ flexDirection: wide ? 'row' : 'column', gap: 24, alignItems: 'flex-start' }}>
            {units}{rail}
          </View>
          <HallSteps />
          <RankLadder rank={rank} />
          <HallBoard session={session} classId={cls?.id ?? null} className={cls?.name ?? null} />
          <HallGallery level={rank.level} home={home} />
          <Txt size={12} color={HALL.muted} center style={{ lineHeight: 18 }}>
            Nhân vật, trang phục, cảnh làng quê, cung điện và tranh trong trang là hình vẽ cách điệu do nhóm Đông A tự sáng tác, không phục dựng di tích hay trang phục cụ thể.
            Bản đồ các phần là bản đồ gốc trên Wikipedia tiếng Việt.
          </Txt>
        </>
      )}
      {sheet ? <StageSheet session={session} nav={nav} stageId={sheet.id} campaignNo={sheet.no} onClose={() => setSheet(null)} /> : null}
      {opening ? (
        <ChestOpening session={session} chest={opening.box} look={nav.home?.look} open={() => saga.openChest(session.token, opening.box.key)}
          onClose={(opened) => { const part = opening.part; setOpening(null); if (opened) { parts[part - 1].reload(); nav.refresh(); } }} />
      ) : null}
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
  const [view, setViewState] = useState<'path' | 'map'>(campaignView);
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
  }, [loaded, no, jump, view]);
  const onLayoutPart = (n: number, y: number, h: number): void => {
    lay.current[n] = { y, h };
    if (shown.current !== null && Date.now() < settle.current) jump(false);
  };
  // 23/11/2026: hai kiểu xem – lộ trình kiểu trò chơi học tập (mặc định) và bản đồ gốc Wikipedia (nút "Xem bản đồ"); đổi kiểu thì cuộn lại tới phần đang chọn
  const setView = (v: 'path' | 'map'): void => {
    if (v === view) return;
    campaignView = v; lay.current = {}; shown.current = null; setViewState(v);
  };
  const VIEWS: ReadonlyArray<{ v: 'path' | 'map'; label: string; icon: IconType }> = [{ v: 'path', label: 'Lộ trình', icon: Route }, { v: 'map', label: 'Bản đồ gốc', icon: MapIcon }];
  return (
    <SagaPage testID="saga-campaign" max={1180} scrollRef={scroll}>
      <SagaHeader title={view === 'map' ? 'Bản đồ Hành trình' : 'Lộ trình Hành trình'} subtitle={loaded ? `Ba lần kháng chiến chống quân Mông – Nguyên · đã xong ${sum('done')}/${sum('stages')} chặng · ${sum('stars')}/${sum('max_stars')} sao` : 'Ba lần kháng chiến chống quân Mông – Nguyên (1258, 1285, 1287–1288)'}
        back={{ label: 'Chiến dịch', hint: 'Về ba phần của Hành trình', onPress: () => nav.back('chien-dich', { c: null, s: null, v: null }) }}
        actions={next ? <Btn icon={Play} title={`${next.state === 'learning' ? 'Học tiếp' : 'Bắt đầu'}: ${next.title}`} tone="son" size="sm" onPress={() => nav.go('chien-dich', { c: next.campaign_no, s: next.stage_id, v: null }, 'params')} testID="unit-continue" /> : undefined} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' }} accessibilityRole="tablist" accessibilityLabel="Kiểu xem">
        {VIEWS.map(({ v, label, icon: Icon }) => {
          const on = view === v;
          return (
            <Pressable key={v} testID={`campaign-view-${v}`} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={label} onPress={() => setView(v)}
              style={({ pressed }) => ({ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, borderRadius: 16, borderWidth: 2, borderBottomWidth: 4,
                borderColor: on ? S.red : S.line, backgroundColor: on ? S.mint : pressed ? S.paper2 : S.white })}>
              <Icon size={18} color={on ? S.red : S.muted} strokeWidth={2.6} /><Txt f="heavy" size={14} color={on ? S.deep : S.muted}>{label}</Txt>
            </Pressable>
          );
        })}
      </View>
      <Segmented<number> label="Chọn phần" value={no} onChange={(n) => nav.go('chien-dich', { c: n, s: null, v: null }, 'params')}
        options={[1, 2, 3].map((n) => ({ value: n, label: `Phần ${n} · ${TONE[n].years}` }))} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {(Object.keys(STATE) as Array<keyof typeof STATE>).map((k) => <StateChip key={k} state={k} />)}
      </View>
      {view === 'map' ? parts.map((p, i) => (
        <PartSection key={i + 1} no={i + 1} camp={nav.home?.campaigns.find((x) => x.campaign_no === i + 1) ?? null} view={p.data} loading={p.loading} error={p.error} onRetry={p.reload}
          selectedId={open} mascotId={next && next.campaign_no === i + 1 ? next.stage_id : null} onPick={pick} maxHeight={Math.max(320, Math.min(760, height - 190))}
          onLayoutPart={(y, h) => onLayoutPart(i + 1, y, h)} onChest={(box) => onChest(box, i + 1)} />
      )) : parts.map((p, i) => (
        <PathPart key={i + 1} no={i + 1} camp={nav.home?.campaigns.find((x) => x.campaign_no === i + 1) ?? null} view={p.data} loading={p.loading} error={p.error} onRetry={p.reload}
          currentId={next && next.campaign_no === i + 1 ? next.stage_id : null} selectedId={open} onPick={pick} onChest={(box) => onChest(box, i + 1)}
          onMap={() => { setView('map'); nav.go('chien-dich', { c: i + 1, s: null, v: null }, 'params'); }} onLayoutPart={(y, h) => onLayoutPart(i + 1, y, h)} />
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

const StageSheet: React.FC<{ session: Session; nav: SagaNav; stageId: number; campaignNo: number; onClose?: () => void }> = ({ session, nav, stageId, campaignNo, onClose }) => {
  const { c } = useTheme();
  const data = useLoad<StageDetail>(session, (t) => saga.stage(t, stageId), [stageId]);
  const d = data.data;
  const close = (): void => (onClose ? onClose() : nav.go('chien-dich', { c: campaignNo, s: null, v: null }, 'params'));
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
