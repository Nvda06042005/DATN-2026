/**
 * Hành trình Đông A – ba màn mở đầu của vòng chơi:
 *   1. "Chọn cuộc kháng chiến": ba thẻ 1258, 1285, 1287–1288 với tiến độ, sao, nhiệm vụ hôm nay và nút chơi tiếp.
 *   2. Bản đồ chiến dịch: ảnh bản đồ gốc của Wikipedia tiếng Việt làm nền, các chặng đặt theo tỉ lệ 0–1 trên ảnh (đổi ảnh hay vị trí ở trang quản trị là bản đồ đổi theo,
 *      không sửa mã). Phóng to, kéo để xem; trạng thái chặng thể hiện bằng màu, biểu tượng và chữ; bên dưới luôn có danh sách chặng cho màn hình nhỏ và trình đọc màn hình.
 *   3. Bảng thông tin chặng: mục tiêu học, các bước, lý do còn khóa, kết quả cũ và nút Học / Chơi tiếp / Ôn lại.
 * Mục "Nhập vai" gom các cảnh khám phá và trận đánh đã mở để chơi lại nhanh.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Linking, Platform, Pressable, ScrollView, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { BookOpen, Check, ChevronRight, Coins, Flame, Footprints, Gamepad2, Gift, Layers, Lock, Maximize2, Play, Puzzle, RotateCcw, Sparkles, Star, Swords, Target, ZoomIn, ZoomOut } from 'lucide-react-native';
import * as saga from '@/api/sagaApi';
import type { Session } from '@/components/auth';
import {
  CampaignArt, Chunky, GameBtn, KIND_TEXT, LoadState, Meter, Panel, Pill, Portrait, RARITY, SG, STATE, ScreenHead, SkyBg, StarRow, TONE, TieuTuongArt, mapSource, num, stageIcon, useLoad, useSaga,
  type SagaNav, type SagaStep,
} from '@/components/portal/SagaKit';
import { Sheet, Txt } from '@/components/ui';
import type { IconType } from '@/types/game';
import type { CampaignView, SagaCampaign, SagaMapInfo, StageBrief, StageDetail, StepState } from '@/types/saga';

// ---------------------------------------------------------------------- 1. chọn cuộc kháng chiến
const CampaignCard: React.FC<{ c: SagaCampaign; onPress: () => void; wide: boolean }> = ({ c, onPress, wide }) => {
  const s = useSaga();
  const tone = TONE[c.campaign_no] ?? TONE[1];
  return (
    <Chunky bg={tone.main} edge={tone.edge} onPress={onPress} disabled={!c.available} radius={26} depth={7} testID={`campaign-${c.campaign_no}`} style={wide ? { flex: 1 } : { alignSelf: 'stretch' }}
      label={`${c.title}, ${c.years}. Đã xong ${c.done} trên ${c.stages} chặng, ${c.stars} trên ${c.max_stars} sao${c.is_new ? ', chưa bắt đầu' : ''}`}>
      <View style={{ margin: 5, borderRadius: 21, backgroundColor: s.card, overflow: 'hidden', flexDirection: wide ? 'column' : 'row' }}>
        <View style={wide ? undefined : { width: '42%' }}>
          <CampaignArt no={c.campaign_no} height={wide ? 150 : 132} />
          <View style={{ position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Star size={14} color={SG.yellowEdge} fill={SG.yellow} />
            <Txt f="heavy" size={13} color="#1e2a4a">{c.stars}/{c.max_stars}</Txt>
          </View>
          {c.is_new ? <Pill text="MỚI" bg={SG.red} size={12} style={{ position: 'absolute', top: 8, right: 8 }} /> : null}
          {c.completed ? <Pill text="XONG" icon={Check} bg={SG.green} size={12} style={{ position: 'absolute', top: 8, right: 8 }} /> : null}
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 12, gap: 4 }}>
          <Pill text={tone.label} bg={tone.main} size={13} style={{ alignSelf: 'center', marginTop: wide ? -26 : 0 }} />
          <Txt f="heavy" size={wide ? 32 : 28} color={s.ink}>{c.years}</Txt>
          <Txt f="bold" size={14} color={s.sub} center numberOfLines={2}>{c.places}</Txt>
          <Meter value={c.stages ? c.done / c.stages : 0} fill={tone.main} label={`Tiến độ ${c.title}`} style={{ alignSelf: 'stretch', marginTop: 6 }} />
          <Txt f="semibold" size={13} color={s.sub}>{c.done}/{c.stages} chặng</Txt>
        </View>
      </View>
    </Chunky>
  );
};

export const HomeScreen: React.FC<{ nav: SagaNav; loading: boolean; error: string | null }> = ({ nav, loading, error }) => {
  const s = useSaga();
  const { width } = useWindowDimensions();
  const wide = width >= 760;
  const home = nav.home;
  return (
    <View style={{ flex: 1 }} testID="saga-home">
      <SkyBg />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 104, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: 1040, gap: 16 }}>
          {!home ? <LoadState loading={loading} error={error} onRetry={nav.refresh} /> : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
                <TieuTuongArt size={wide ? 96 : 72} cheer />
                <View style={{ flex: 1, backgroundColor: s.card, borderRadius: 18, borderBottomLeftRadius: 4, padding: 12, marginBottom: 14, borderWidth: 2, borderColor: s.line }}>
                  <Txt f="heavy" size={17} color={s.ink}>Chào {home.learner.name}!</Txt>
                  <Txt f="semibold" size={14} color={s.sub}>
                    {home.next ? `Mình là Tiểu Tướng. Chặng đang chờ em: ${home.next.title}.` : 'Em đã đi hết hành trình. Ôn lại để giữ vững kiến thức nhé!'}
                  </Txt>
                </View>
              </View>

              <Txt f="heavy" size={wide ? 30 : 24} color={s.dark ? '#ffffff' : '#12305c'} center accessibilityRole="header">Chọn cuộc kháng chiến</Txt>
              <View style={{ flexDirection: wide ? 'row' : 'column', gap: 16 }}>
                {home.campaigns.map((c) => <CampaignCard key={c.campaign_no} c={c} wide={wide} onPress={() => nav.go('chien-dich', { c: c.campaign_no, s: null, v: null })} />)}
              </View>

              {home.next ? (
                <GameBtn title={`${home.next.state === 'learning' ? 'Chơi tiếp' : 'Bắt đầu'}: ${home.next.title}`} icon={Play} tone="yellow" size="lg" full testID="home-continue"
                  onPress={() => nav.go('chien-dich', { c: home.next!.campaign_no, s: home.next!.stage_id, v: null })} />
              ) : null}

              <View style={{ flexDirection: wide ? 'row' : 'column', gap: 12 }}>
                {home.daily ? (
                  <Panel style={{ flex: wide ? 1.4 : undefined, flexDirection: 'row', alignItems: 'center', gap: 12 }} testID="home-daily">
                    <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: '#fff0db', alignItems: 'center', justifyContent: 'center' }}><Gift size={26} color={SG.orangeEdge} strokeWidth={2.4} /></View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Txt f="heavy" size={15} color={s.ink}>Nhiệm vụ hôm nay{home.daily.done ? ' · đã xong' : ''}</Txt>
                      <Txt f="semibold" size={13} color={s.sub} numberOfLines={2}>{home.daily.title} (+{home.daily.reward_xp} điểm{home.daily.reward_gold ? `, +${home.daily.reward_gold} vàng` : ''})</Txt>
                      <Meter value={home.daily.target ? home.daily.progress / home.daily.target : 0} fill={SG.green} label="Tiến độ nhiệm vụ hôm nay" />
                    </View>
                    <Txt f="heavy" size={16} color={s.ink}>{Math.min(home.daily.progress, home.daily.target)}/{home.daily.target}</Txt>
                  </Panel>
                ) : null}
                <Panel style={{ flex: wide ? 1 : undefined, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: '#efe4ff', alignItems: 'center', justifyContent: 'center' }}><RotateCcw size={24} color={SG.purpleEdge} strokeWidth={2.6} /></View>
                  <View style={{ flex: 1 }}>
                    <Txt f="heavy" size={15} color={s.ink}>{home.review_due ? `${home.review_due} câu cần ôn lại` : 'Ôn tập nhanh'}</Txt>
                    <Txt f="semibold" size={13} color={s.sub}>{home.review_due ? 'Những câu em từng trả lời sai đang chờ.' : 'Trả lời câu hỏi tính giờ để giữ chuỗi đúng.'}</Txt>
                  </View>
                  <GameBtn title="Ôn" tone="purple" size="sm" onPress={() => nav.go('cau-hoi', { c: null, s: null, v: null })} testID="home-review" label="Mở mục Câu hỏi ôn tập" />
                </Panel>
              </View>

              <Txt f="semibold" size={13} color={s.dark ? '#c8d6ee' : '#1f4a7a'} center>
                Đã hoàn thành {home.totals.done}/{home.totals.stages} chặng của ba lần kháng chiến chống quân Mông – Nguyên (1258, 1285, 1287–1288).
              </Txt>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

// ---------------------------------------------------------------------- 2. bản đồ chiến dịch
const NODE = 46;
const ZOOMS = [1, 1.5, 2, 2.6];
const BORDER = 4;

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
  const tone = TONE[map.campaign_no] ?? TONE[1];
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
  // màn hẹp: chỉ hiện tên của chặng đang chọn / đang học để các nhãn không đè lên nhau; danh sách bên dưới có đủ tên
  const compact = cw < 620;
  const pt = (st: StageBrief): [number, number] => [st.map_x * cw, st.map_y * ch];
  const zoomBtn = (Icon: IconType, label: string, on: () => void, off: boolean, id: string): React.ReactElement => (
    <Chunky bg="#ffffff" edge="#c9d5ea" onPress={on} disabled={off} label={label} radius={22} depth={4} style={{ width: 44 }} testID={id}>
      <View style={{ height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon size={20} color="#1e2a4a" strokeWidth={2.6} /></View>
    </Chunky>
  );
  return (
    <View onLayout={(e) => setBoxW(e.nativeEvent.layout.width)} testID="saga-map" style={{ width: '100%', height: boxW ? viewH + BORDER * 2 : 240, borderRadius: 22, overflow: 'hidden', borderWidth: BORDER, borderColor: tone.main, backgroundColor: '#efe6cf' }}>
      {boxW > 0 ? (
        <ScrollView ref={outer} showsVerticalScrollIndicator={scrolls}>
          <ScrollView ref={inner} horizontal showsHorizontalScrollIndicator={scrolls} contentContainerStyle={{ minWidth: '100%', justifyContent: 'center' }}>
            <View style={{ width: cw, height: ch }}>
              <Image source={mapSource(map)} style={{ width: cw, height: ch }} resizeMode="stretch" accessibilityLabel={`Bản đồ ${map.title} (${map.years})`} />
              <Svg width={cw} height={ch} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
                {stages.length > 1 ? <Polyline points={stages.map((st) => pt(st).join(',')).join(' ')} fill="none" stroke="#7a3b12" strokeWidth={3.5} strokeDasharray="2 9" strokeLinecap="round" /> : null}
                {stages.filter((st) => st.anchor_x !== null && st.anchor_y !== null).map((st) => {
                  const [x, y] = pt(st), ax = (st.anchor_x ?? 0) * cw, ay = (st.anchor_y ?? 0) * ch;
                  return <React.Fragment key={st.id}><Line x1={x} y1={y} x2={ax} y2={ay} stroke="#1e2a4a" strokeWidth={2} /><Circle cx={ax} cy={ay} r={5} fill="#1e2a4a" stroke="#ffffff" strokeWidth={2} /></React.Fragment>;
                })}
              </Svg>
              {stages.map((st) => {
                const [x, y] = pt(st);
                const state = STATE[st.state];
                const current = st.id === currentId, picked = st.id === selectedId;
                const showLabel = !compact || current || picked;
                const bubble = st.state === 'ready' ? 'BẮT ĐẦU!' : st.steps.next === 'explore' && st.has_battle ? 'VÀO TRẬN!' : 'HỌC TIẾP!';
                return (
                  <View key={st.id} pointerEvents="box-none" style={{ position: 'absolute', left: x - NODE / 2, top: y - NODE / 2, width: NODE, height: NODE, zIndex: picked ? 6 : current ? 5 : 1 }}>
                    {current ? (
                      <View pointerEvents="none" style={{ position: 'absolute', bottom: NODE - 2, left: -47, width: 140, alignItems: 'center' }}>
                        <View style={{ backgroundColor: SG.red, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 2 }}><Txt f="heavy" size={11} color="#ffffff">{bubble}</Txt></View>
                        <TieuTuongArt size={34} bust />
                      </View>
                    ) : st.stars > 0 ? (
                      <View pointerEvents="none" style={{ position: 'absolute', bottom: NODE + 1, left: -17, width: 80, alignItems: 'center' }}><StarRow n={st.stars} size={14} dim="rgba(255,255,255,0.85)" /></View>
                    ) : null}
                    <Pressable accessibilityRole="button" testID={`map-node-${st.code}`} onPress={() => onPick(st)} hitSlop={4}
                      accessibilityLabel={`Chặng ${st.order}: ${st.title}, ${st.date_label}. ${state.label}${st.stars ? `, ${st.stars} sao` : ''}${st.lock_reason ? `. ${st.lock_reason}` : ''}`}
                      style={({ pressed }) => ({ width: NODE, height: NODE + 4, borderRadius: NODE / 2, backgroundColor: state.edge, transform: [{ scale: pressed ? 0.94 : picked ? 1.1 : 1 }] })}>
                      <View style={{ width: NODE, height: NODE, borderRadius: NODE / 2, backgroundColor: state.bg, borderWidth: 3, borderColor: picked ? SG.yellow : '#ffffff', alignItems: 'center', justifyContent: 'center' }}>
                        <Txt f="heavy" size={19} color={state.fg}>{st.order}</Txt>
                      </View>
                      <View style={{ position: 'absolute', right: -7, top: -7, width: 22, height: 22, borderRadius: 11, backgroundColor: '#ffffff', borderWidth: 2, borderColor: state.edge, alignItems: 'center', justifyContent: 'center' }}>
                        <state.icon size={11} color={state.edge} strokeWidth={3.2} />
                      </View>
                    </Pressable>
                    {showLabel ? (
                      <View pointerEvents="none" style={{ position: 'absolute', top: NODE + 6, left: -57, width: 160, alignItems: 'center', gap: 2 }}>
                        <View style={{ backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 999, borderWidth: 2, borderColor: state.edge, paddingHorizontal: 8, paddingVertical: 1 }}>
                          <Txt f="heavy" size={12} color="#1e2a4a" numberOfLines={1}>{st.title}</Txt>
                        </View>
                        {st.battle_mode === 'bachdang' ? <View style={{ backgroundColor: SG.red, borderRadius: 6, paddingHorizontal: 6 }}><Txt f="heavy" size={10} color="#ffffff">QUYẾT CHIẾN</Txt></View> : null}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </ScrollView>
      ) : null}
      <View style={{ position: 'absolute', right: 10, top: 10, gap: 8 }}>
        {zoomBtn(ZoomIn, 'Phóng to bản đồ', () => setZi((i) => Math.min(ZOOMS.length - 1, i + 1)), zi >= ZOOMS.length - 1, 'map-zoom-in')}
        {zoomBtn(ZoomOut, 'Thu nhỏ bản đồ', () => setZi((i) => Math.max(0, i - 1)), zi === 0, 'map-zoom-out')}
        {zi > 0 ? zoomBtn(Maximize2, 'Xem toàn bộ bản đồ', () => setZi(() => 0), false, 'map-zoom-fit') : null}
      </View>
    </View>
  );
};

const StageRow: React.FC<{ st: StageBrief; current: boolean; onPress: () => void }> = ({ st, current, onPress }) => {
  const s = useSaga();
  const state = STATE[st.state];
  const Icon = stageIcon(st.icon);
  return (
    <Pressable accessibilityRole="button" onPress={onPress} testID={`stage-row-${st.code}`}
      accessibilityLabel={`Chặng ${st.order}: ${st.title}, ${st.date_label}. ${state.label}${st.lock_reason ? `. ${st.lock_reason}` : ''}`}
      style={({ pressed }) => ({ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 16, borderWidth: 2, borderColor: current ? SG.yellow : s.line, backgroundColor: pressed ? s.card2 : s.card, opacity: st.state === 'locked' ? 0.78 : 1 })}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: state.bg, alignItems: 'center', justifyContent: 'center' }}><Txt f="heavy" size={18} color={state.fg}>{st.order}</Txt></View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon size={16} color={s.sub} strokeWidth={2.4} />
          <Txt f="heavy" size={16} color={s.ink} numberOfLines={1} style={{ flexShrink: 1 }}>{st.title}</Txt>
        </View>
        <Txt f="semibold" size={13} color={s.sub} numberOfLines={1}>{st.date_label} · {KIND_TEXT[st.kind] ?? st.kind}{st.has_battle && st.kind !== 'battle' ? ' · có chạm trán' : ''}</Txt>
        {st.lock_reason ? <Txt size={12} color={s.sub} numberOfLines={2}>{st.lock_reason}</Txt> : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Pill text={state.label} icon={state.icon} bg={state.bg} fg={state.fg} size={12} style={{ alignSelf: 'flex-end' }} />
        {st.stars > 0 ? <StarRow n={st.stars} size={15} /> : null}
      </View>
      <ChevronRight size={20} color={s.sub} />
    </Pressable>
  );
};

export const CampaignScreen: React.FC<{ session: Session; nav: SagaNav; no: number }> = ({ session, nav, no }) => {
  const s = useSaga();
  const { height, width } = useWindowDimensions();
  const data = useLoad<CampaignView>(session, (t) => saga.campaign(t, no), [no]);
  const view = data.data;
  const open = nav.route.s !== null && nav.route.v === null ? nav.route.s : null;
  const pick = (st: StageBrief): void => nav.go('chien-dich', { c: no, s: st.id, v: null }, 'params');
  return (
    <View style={{ flex: 1, backgroundColor: s.dark ? '#101a33' : '#fdf3d7' }} testID="saga-campaign">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 104, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: 1100, gap: 14 }}>
          <ScreenHead title={view?.map.title ?? 'Bản đồ chiến dịch'} subtitle={view ? `${view.map.years} · ${view.totals.done}/${view.totals.stages} chặng · ${view.totals.stars}/${view.totals.max_stars} sao` : undefined}
            onBack={() => nav.back('chien-dich', { c: null, s: null, v: null })} backLabel="Về trang chọn cuộc kháng chiến" />
          <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {[1, 2, 3].map((n) => {
              const t = TONE[n], on = n === no;
              return (
                <Pressable key={n} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={`Bản đồ kháng chiến ${t.label.toLowerCase()}`} onPress={() => nav.go('chien-dich', { c: n, s: null, v: null }, 'params')} testID={`campaign-tab-${n}`}
                  style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 14, backgroundColor: on ? t.main : s.card, borderWidth: 2, borderColor: t.main }}>
                  <Txt f="heavy" size={14} color={on ? '#ffffff' : s.ink}>{t.label} · {n === 1 ? '1258' : n === 2 ? '1285' : '1287–1288'}</Txt>
                </Pressable>
              );
            })}
          </View>
          {!view ? <LoadState loading={data.loading} error={data.error} onRetry={data.reload} /> : (
            <>
              <SagaMap map={view.map} stages={view.stages} currentId={view.current_stage_id} selectedId={open} onPick={pick} maxHeight={Math.max(320, Math.min(760, height - (width >= 760 ? 250 : 300)))} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                {(Object.keys(STATE) as Array<keyof typeof STATE>).map((k) => <Pill key={k} text={STATE[k].label} icon={STATE[k].icon} bg={STATE[k].bg} fg={STATE[k].fg} size={12} />)}
              </View>
              <Pressable accessibilityRole="link" accessibilityLabel="Mở trang gốc của bản đồ trên Wikipedia" disabled={!view.map.credit_url} onPress={() => { if (view.map.credit_url) void Linking.openURL(view.map.credit_url); }} style={{ minHeight: 32, justifyContent: 'center' }}>
                <Txt size={12} color={s.sub}>{view.map.credit}{view.map.credit_url ? ' Bấm để mở trang gốc.' : ''} Vị trí các chặng do nhóm phát triển đánh dấu trên bản đồ.</Txt>
              </Pressable>
              <Txt f="heavy" size={18} color={s.ink} accessibilityRole="header">Các chặng</Txt>
              <View style={{ gap: 8 }}>
                {view.stages.map((st) => <StageRow key={st.id} st={st} current={st.id === view.current_stage_id} onPress={() => pick(st)} />)}
              </View>
            </>
          )}
        </View>
      </ScrollView>
      {open !== null ? <StageSheet session={session} nav={nav} stageId={open} campaignNo={no} /> : null}
    </View>
  );
};

// ---------------------------------------------------------------------- 3. bảng thông tin chặng
const STEP_ICON: Record<StepState, IconType> = { locked: Lock, ready: Play, done: Check, none: Lock };
const StepLine: React.FC<{ icon: IconType; title: string; note: string; state: StepState; onPress?: () => void; testID: string }> = ({ icon: Icon, title, note, state, onPress, testID }) => {
  const s = useSaga();
  const color = state === 'done' ? SG.green : state === 'ready' ? SG.blue : '#9aa5bd';
  const Mark = STEP_ICON[state];
  return (
    <Pressable accessibilityRole="button" disabled={!onPress} onPress={onPress} testID={testID}
      accessibilityLabel={`${title}: ${state === 'done' ? 'đã xong' : state === 'ready' ? 'sẵn sàng' : 'chưa mở'}. ${note}`}
      style={({ pressed }) => ({ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, borderWidth: 2, borderColor: s.line, backgroundColor: pressed ? s.card2 : s.card, opacity: state === 'locked' ? 0.7 : 1 })}>
      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}><Icon size={20} color="#ffffff" strokeWidth={2.6} /></View>
      <View style={{ flex: 1 }}>
        <Txt f="heavy" size={15} color={s.ink}>{title}</Txt>
        <Txt size={13} color={s.sub}>{note}</Txt>
      </View>
      <Mark size={18} color={color} strokeWidth={3} />
    </Pressable>
  );
};

const StageSheet: React.FC<{ session: Session; nav: SagaNav; stageId: number; campaignNo: number }> = ({ session, nav, stageId, campaignNo }) => {
  const s = useSaga();
  const data = useLoad<StageDetail>(session, (t) => saga.stage(t, stageId), [stageId]);
  const d = data.data;
  const close = (): void => nav.go('chien-dich', { c: campaignNo, s: null, v: null }, 'params');
  const open = (v: SagaStep): void => nav.go('chien-dich', { c: campaignNo, s: stageId, v });
  const locked = d?.state === 'locked';
  const next = d?.steps.next ?? null;
  const cta = !d || locked ? null
    : next === 'lesson' ? <GameBtn title="Bắt đầu học" icon={BookOpen} tone="green" size="lg" full onPress={() => open('hoc')} testID="stage-cta" />
    : next === 'practice' ? <GameBtn title={d.practice.tries ? 'Luyện tập tiếp' : 'Luyện tập'} icon={Puzzle} tone="orange" size="lg" full onPress={() => open('luyen')} testID="stage-cta" />
    : next === 'explore' ? <GameBtn title="Nhập vai khám phá" icon={Gamepad2} tone="red" size="lg" full onPress={() => open('kham-pha')} testID="stage-cta" />
    : <GameBtn title="Xem tổng kết" icon={Sparkles} tone="yellow" size="lg" full onPress={() => open('tong-ket')} testID="stage-cta" />;
  return (
    <Sheet open onClose={close} wide title={d ? d.title : 'Chặng'} subtitle={d ? `${d.place} · ${d.date_label}` : undefined} footer={cta ?? undefined}>
      {!d ? <LoadState loading={data.loading} error={data.error} onRetry={data.reload} /> : (
        <View style={{ gap: 14 }} testID="stage-sheet">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <Pill text={STATE[d.state].label} icon={STATE[d.state].icon} bg={STATE[d.state].bg} fg={STATE[d.state].fg} />
            <Pill text={KIND_TEXT[d.kind] ?? d.kind} icon={stageIcon(d.icon)} bg={s.card2} fg={s.ink} />
            {d.stars > 0 ? <StarRow n={d.stars} /> : null}
          </View>
          <Txt size={15} color={s.ink}>{d.summary}</Txt>
          {d.lock_reason ? (
            <View accessibilityRole="alert" style={{ flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: s.card2, borderRadius: 14, padding: 12 }}>
              <Lock size={20} color={s.sub} strokeWidth={2.6} /><Txt f="bold" size={14} color={s.ink} style={{ flex: 1 }}>{d.lock_reason}</Txt>
            </View>
          ) : null}

          <View style={{ gap: 6 }}>
            <Txt f="heavy" size={16} color={s.ink} accessibilityRole="header">Sau chặng này em sẽ</Txt>
            {d.objectives.map((o) => (
              <View key={o.id} style={{ flexDirection: 'row', gap: 8 }}><Target size={16} color={SG.red} strokeWidth={2.6} style={{ marginTop: 3 }} /><Txt size={14} color={s.ink} style={{ flex: 1 }}>{o.text}</Txt></View>
            ))}
          </View>

          <View style={{ gap: 8 }}>
            <Txt f="heavy" size={16} color={s.ink} accessibilityRole="header">Các bước</Txt>
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
            <Txt f="heavy" size={16} color={s.ink} accessibilityRole="header">Phần thưởng khi hoàn thành lần đầu</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <Pill text={`+${d.rewards.xp} điểm`} icon={Sparkles} bg="#efe4ff" fg="#5b2fa8" />
              <Pill text={`+${d.rewards.gold} vàng`} icon={Coins} bg="#fff3c9" fg="#7a5a00" />
              {d.rewards.has_badge ? <Pill text="Huy hiệu" icon={Flame} bg="#ffe3e3" fg="#a31f1f" /> : null}
              {d.unlocks_next ? <Pill text={`Mở chặng: ${d.unlocks_next.title}`} icon={Play} bg="#e2f7e6" fg="#156b2c" /> : null}
            </View>
            {d.rewards.card ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: s.card2, borderRadius: 16, padding: 10 }}>
                <Portrait code={d.rewards.card.portrait} size={56} locked={Boolean(d.rewards.card.hidden)} />
                <View style={{ flex: 1 }}>
                  <Txt f="heavy" size={15} color={s.ink}>Thẻ nhân vật: {d.rewards.card.name}</Txt>
                  <Txt size={13} color={s.sub}>{RARITY[d.rewards.card.rarity]?.label ?? ''} · {d.rewards.card.hidden ? 'hoàn thành chặng để mở thẻ' : d.rewards.card.title}</Txt>
                </View>
              </View>
            ) : null}
          </View>

          {d.completed_at ? (
            <View style={{ gap: 8 }}>
              <Txt f="heavy" size={16} color={s.ink} accessibilityRole="header">Ôn lại chặng này</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <GameBtn title="Thẻ kiến thức" icon={BookOpen} tone="white" size="sm" onPress={() => open('hoc')} testID="replay-lesson" />
                <GameBtn title="Luyện lại" icon={Puzzle} tone="white" size="sm" onPress={() => open('luyen')} testID="replay-practice" />
                <GameBtn title="Nhập vai lại" icon={Gamepad2} tone="white" size="sm" onPress={() => open('kham-pha')} testID="replay-explore" />
                {d.battle ? <GameBtn title="Đánh lại trận" icon={Swords} tone="white" size="sm" onPress={() => open('tran')} testID="replay-battle" /> : null}
                {d.review_due ? <GameBtn title={`Ôn ${d.review_due} câu đã sai`} icon={RotateCcw} tone="purple" size="sm" onPress={() => nav.go('cau-hoi', { c: null, s: null, v: null })} testID="replay-review" /> : null}
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
  const s = useSaga();
  const data = useLoad<CampaignView[]>(session, (t) => Promise.all([1, 2, 3].map((n) => saga.campaign(t, n))), []);
  const next = nav.home?.next ?? null;
  return (
    <View style={{ flex: 1 }} testID="saga-roleplay">
      <SkyBg hill={false} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: 980, gap: 14 }}>
          <ScreenHead title="Nhập vai" subtitle="Vào vai một người lính nhà Trần: đi lại trong cảnh, nhận quân lệnh, tìm người, tìm vật rồi ra trận." />
          {next ? (
            <Panel style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TieuTuongArt size={64} bust />
              <View style={{ flex: 1 }}>
                <Txt f="heavy" size={16} color={s.ink}>Chặng đang chờ: {next.title}</Txt>
                <Txt size={13} color={s.sub}>Học thẻ kiến thức và đạt phần luyện tập để mở cảnh nhập vai của chặng.</Txt>
              </View>
              <GameBtn title="Mở chặng" icon={Play} tone="yellow" size="sm" onPress={() => nav.go('chien-dich', { c: next.campaign_no, s: next.stage_id, v: null })} testID="roleplay-next" />
            </Panel>
          ) : null}
          {!data.data ? <LoadState loading={data.loading} error={data.error} onRetry={data.reload} /> : data.data.map((cv) => {
            const tone = TONE[cv.map.campaign_no] ?? TONE[1];
            return (
              <Panel key={cv.map.campaign_no} tone={tone.main} style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Pill text={tone.label} bg={tone.main} /><Txt f="heavy" size={17} color={s.ink} style={{ flex: 1 }} accessibilityRole="header">{cv.map.years} · {cv.map.title}</Txt>
                </View>
                {cv.stages.map((st) => {
                  const canExplore = st.steps.explore !== 'locked', canBattle = st.steps.battle === 'done';
                  return (
                    <View key={st.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap', paddingVertical: 6, borderTopWidth: 1, borderTopColor: s.line }}>
                      <View style={{ flex: 1, minWidth: 180 }}>
                        <Txt f="bold" size={15} color={s.ink}>{st.order}. {st.title}</Txt>
                        <Txt size={13} color={s.sub}>{canExplore ? (st.steps.explore === 'done' ? 'Đã hoàn thành nhiệm vụ nhập vai' : 'Cảnh nhập vai đã mở') : st.lock_reason ?? 'Đạt phần luyện tập của chặng để mở cảnh nhập vai'}</Txt>
                      </View>
                      {st.battle_stars > 0 ? <StarRow n={st.battle_stars} size={15} /> : null}
                      <GameBtn title="Nhập vai" icon={Footprints} tone="red" size="sm" disabled={!canExplore} onPress={() => nav.go('chien-dich', { c: st.campaign_no, s: st.id, v: 'kham-pha' })} testID={`roleplay-explore-${st.code}`} label={`Nhập vai ở chặng ${st.title}`} />
                      {st.has_battle ? <GameBtn title="Đánh trận" icon={Swords} tone="navy" size="sm" disabled={!canBattle} onPress={() => nav.go('chien-dich', { c: st.campaign_no, s: st.id, v: 'tran' })} testID={`roleplay-battle-${st.code}`} label={canBattle ? `Đánh lại trận ${st.title}` : `Trận ${st.title}: thắng lần đầu trong phần nhập vai để mở`} /> : null}
                    </View>
                  );
                })}
              </Panel>
            );
          })}
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Layers size={16} color={s.dark ? '#c8d6ee' : '#1f4a7a'} />
            <Txt size={13} color={s.dark ? '#c8d6ee' : '#1f4a7a'} style={{ flex: 1 }}>Nhân vật em điều khiển và các nhân vật phụ trong cảnh là hư cấu; sự kiện lịch sử nằm ở thẻ kiến thức và phần tổng kết, có ghi nguồn.</Txt>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};
