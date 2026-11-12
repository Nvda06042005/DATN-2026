/**
 * Màn Học — Lộ trình học tập phong cách Duolingo (HK.HS.117–118, 120–123):
 *  - Hai tầng điều hướng: màn Đường đi các Cửa trong một Phần <-> màn Tổng quan các Phần (nút ← ở góc trái băng tiêu đề).
 *  - Băng tiêu đề ghim trên cùng tự động đổi màu theo Cửa đang cuộn tới (Ngọc Lục Bảo, Hồng Mai, Thiên Thanh, Hổ Phách, Tử Đằng, Chu Sa) kèm nút Hướng dẫn mở Cẩm nang.
 *  - Đường cong S-curve với nút khối 3D, Rương báu SVG 3 trạng thái, vạch phân cách Cửa tối giản, linh vật Rồng Con đặt ở các hốc trống xen kẽ và thẻ Popover màu theo Cửa.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, NativeScrollEvent, NativeSyntheticEvent, Platform, Pressable, ScrollView, View, type ScrollViewInstance } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BookMarked, Check, Lock, Play, RotateCcw, Swords } from 'lucide-react-native';
import * as api from '@/api/learningApi';
import { ErrorNote, useLoad } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { LearningSections } from '@/components/portal/LearningSections';
import { DemoActivityPlayer } from '@/components/portal/DemoActivityPlayer';
import { activateDemoMode, useDemoLearningState } from '@/lib/learning-path-demo';
import { PathMascotVignette, TreasureChestArt } from '@/components/portal/PathArt';
import { PathNodePopover } from '@/components/portal/PathNodePopover';
import { NODE_ICON, STATE_TEXT, type NodeActions } from '@/components/portal/QuestMap';
import { Btn, Card, Chip, EmptyState, InfoNote, Sheet, Spinner, Stars, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useReduceMotion } from '@/hooks/use-motion';
import {
  activeGateItem,
  BANNER_H,
  CENTER_Y,
  CIRCLE,
  defaultFocusPartNo,
  layoutPartPath,
  MASCOT_SIZE,
  resolveSelectedPartNo,
  ROW_H,
  scrollButtonDirection,
  unitTheme,
  type UnitTheme,
} from '@/lib/learning-path';
import type { GateGuide, NodeIcon, PathGate, PathNode } from '@/types/learning';

const KIND_ICON: Record<PathNode['kind'], NodeIcon> = {
  lesson: 'book',
  quiz: 'quiz',
  battle: 'sword',
  source: 'scroll',
  final: 'crown',
  practice: 'dumbbell',
  listen: 'headphones',
  chest: 'chest',
  gate_test: 'trophy',
};

// ---------------------------------------------------------------------- vòng tiến độ & nhãn Bắt đầu
const Ring: React.FC<{ done: number; total: number; color: string; track: string }> = ({ done, total, color, track }) => {
  const size = CIRCLE + 18;
  const r = size / 2 - 4;
  const len = 2 * Math.PI * r;
  const frac = total > 0 ? Math.min(1, Math.max(0.14, done / total)) : 0.14;
  return (
    <Svg width={size} height={size} style={{ position: 'absolute', left: -9, top: -9 }} pointerEvents="none">
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={5} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={5}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${len * frac} ${len}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
};

const StartCallout: React.FC<{ label: string; theme: UnitTheme; bg: string; border: string }> = ({
  label,
  theme,
  bg,
  border,
}) => {
  const { dark } = useTheme();
  const reduce = useReduceMotion();
  const y = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduce) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(y, { toValue: -5, duration: 750, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(y, { toValue: 0, duration: 750, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [reduce, y]);

  const textColor = dark ? theme.textDark : theme.textLight;

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: -40,
        left: -28,
        width: CIRCLE + 56,
        alignItems: 'center',
        zIndex: 4,
        transform: [{ translateY: y }],
      }}
    >
      <View
        style={{
          paddingHorizontal: 14,
          minHeight: 30,
          borderRadius: 12,
          backgroundColor: bg,
          borderWidth: 2,
          borderColor: border,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Txt f="displayHeavy" size={12} color={textColor} upper>
          {label}
        </Txt>
      </View>
      <View
        style={{
          width: 10,
          height: 10,
          marginTop: -6,
          backgroundColor: bg,
          borderRightWidth: 2,
          borderBottomWidth: 2,
          borderColor: border,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </Animated.View>
  );
};

const PathButton: React.FC<{
  node: PathNode;
  theme: UnitTheme;
  current: boolean;
  x: number;
  onPress: () => void;
}> = ({ node, theme, current, x, onPress }) => {
  const { c, dark } = useTheme();
  const done = node.state === 'done';
  const locked = node.state === 'locked';
  const isChest = node.kind === 'chest';
  const Icon = NODE_ICON[node.icon ?? KIND_ICON[node.kind]] ?? NODE_ICON.star;
  const steps = node.steps ?? { done: 0, total: 1 };

  const lockedBg = dark ? '#273244' : '#e5e0d4';
  const lockedEdge = dark ? '#18202c' : '#c6beab';
  const bg = locked ? lockedBg : theme.bg;
  const edge = locked ? lockedEdge : theme.edge;
  const iconColor = locked ? (dark ? '#64748b' : '#8c8376') : '#ffffff';

  const label = `${node.kind_label}: ${node.title}. ${STATE_TEXT[node.state]}${done && node.stars ? `, ${node.stars} sao` : ''}${current ? '. Bài hiện tại, bấm để bắt đầu' : ''}${locked && node.lock_reason ? `. ${node.lock_reason}` : ''}`;

  return (
    <View style={{ height: ROW_H, alignItems: 'center' }}>
      <View style={{ marginTop: CENTER_Y - CIRCLE / 2, width: 160, alignItems: 'center', transform: [{ translateX: x }] }}>
        <View style={{ width: CIRCLE, height: CIRCLE, alignItems: 'center', justifyContent: 'center' }}>
          {!locked && !done && !isChest ? (
            <Ring
              done={steps.done}
              total={steps.total}
              color={theme.ring}
              track={dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.09)'}
            />
          ) : null}

          {isChest ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={label}
              onPress={onPress}
              testID={`path-node-${node.id}`}
              style={({ pressed }) => ({
                width: CIRCLE + 4,
                height: CIRCLE + 4,
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ scale: pressed ? 0.94 : 1 }],
              })}
            >
              <TreasureChestArt state={node.state} size={76} unitBg={theme.bg} />
              {done ? (
                <View
                  style={{
                    position: 'absolute',
                    right: -2,
                    top: -2,
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: c.the,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2,
                    borderColor: theme.bg,
                  }}
                >
                  <Check size={13} color={theme.bg} strokeWidth={3} />
                </View>
              ) : null}
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={label}
              onPress={onPress}
              testID={`path-node-${node.id}`}
              style={({ pressed }) => ({
                width: CIRCLE,
                height: CIRCLE,
                borderRadius: CIRCLE / 2,
                backgroundColor: bg,
                alignItems: 'center',
                justifyContent: 'center',
                borderBottomWidth: pressed ? 3 : 7,
                borderBottomColor: edge,
                transform: [{ translateY: pressed ? 3 : 0 }],
              })}
            >
              {/* Vệt bóng nổi nhẹ tạo cảm giác 3D đặc trưng Duolingo */}
              {!locked ? (
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    top: 6,
                    left: 16,
                    right: 16,
                    height: 10,
                    borderRadius: 999,
                    backgroundColor: 'rgba(255,255,255,0.20)',
                  }}
                />
              ) : null}
              <Icon size={30} color={iconColor} strokeWidth={2.4} />
              {done ? (
                <View
                  style={{
                    position: 'absolute',
                    right: -3,
                    top: -3,
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: c.the,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2.5,
                    borderColor: theme.bg,
                  }}
                >
                  <Check size={13} color={theme.bg} strokeWidth={3} />
                </View>
              ) : null}
              {locked ? (
                <View
                  style={{
                    position: 'absolute',
                    right: -2,
                    bottom: 0,
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: c.the,
                    borderWidth: 1.5,
                    borderColor: c.vien2,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Lock size={11} color={c.muc3} strokeWidth={2.5} />
                </View>
              ) : null}
            </Pressable>
          )}

          {current ? (
            <StartCallout
              label={isChest ? 'Mở rương' : 'Bắt đầu'}
              theme={theme}
              bg={c.the}
              border={c.vien2}
            />
          ) : null}
        </View>

        <Txt
          f={current ? 'bold' : 'semibold'}
          size={12.5}
          center
          numberOfLines={2}
          color={locked ? c.muc3 : c.muc}
          style={{ marginTop: 6, width: 152, lineHeight: 16 }}
        >
          {node.title}
        </Txt>
        {done && !isChest ? <Stars n={node.stars} size={12} /> : null}
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------- Cẩm nang (HK.HS.123)
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View style={{ gap: 6 }}>
    <Txt f="bold" size={15}>
      {title}
    </Txt>
    {children}
  </View>
);

export const GuideSheet: React.FC<{
  session: Session;
  gate: { id: number; title: string };
  onClose: () => void;
  onOpenDetail: (type: string, id: number) => void;
}> = ({ session, gate, onClose, onOpenDetail }) => {
  const { c } = useTheme();
  const guide = useLoad(() => api.gateGuide(session.token, gate.id), [session.token, gate.id], session.expired);
  const g: GateGuide | null = guide.data;
  const empty =
    g && !g.milestones.length && !g.figures.length && !g.places.length && !g.terms.length && !g.quotes.length && !g.gate.guide_note;
  const open = (type: string, id: number) => {
    onClose();
    onOpenDetail(type, id);
  };
  return (
    <Sheet
      open
      onClose={onClose}
      title="Cẩm nang"
      subtitle={gate.title}
      wide
      footer={
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <Btn title="Đóng" tone="ngoc" onPress={onClose} testID="guide-close" />
        </View>
      }
    >
      <ErrorNote message={guide.error} />
      {guide.loading && !g ? <Spinner /> : null}
      {g ? (
        <View style={{ gap: 16 }}>
          {g.gate.summary ? (
            <Txt size={15} color={c.muc2}>
              {g.gate.summary}
            </Txt>
          ) : null}
          {empty ? (
            <EmptyState
              mood="thinking"
              title="Cửa này chưa có dữ liệu Cẩm nang"
              text="Cẩm nang được tạo từ nhân vật, sự kiện và địa danh gắn với các bài học trong cửa."
            />
          ) : null}
          {g.milestones.length ? (
            <Section title="Mốc thời gian">
              {g.milestones.map((m) => (
                <Pressable
                  key={`${m.type}${m.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${m.date_text ?? m.year}: ${m.name}`}
                  onPress={() => open(m.type, m.id)}
                  style={{ flexDirection: 'row', gap: 10, minHeight: 44, alignItems: 'center' }}
                >
                  <Chip text={m.date_text ?? String(m.year)} bg={c.dongNhat} fg={c.dongChu} icon={m.type === 'battle' ? Swords : undefined} />
                  <Txt size={15} style={{ flex: 1 }}>
                    {m.name}
                  </Txt>
                </Pressable>
              ))}
            </Section>
          ) : null}
          {g.figures.length ? (
            <Section title="Nhân vật">
              {g.figures.map((f) => (
                <Pressable
                  key={f.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Nhân vật ${f.name}`}
                  onPress={() => open('figure', f.id)}
                  style={{ minHeight: 44, justifyContent: 'center' }}
                >
                  <Txt f="semibold" size={15}>
                    {f.name}
                    {f.honorific ? ` (${f.honorific})` : ''}
                  </Txt>
                  {f.role_text ? (
                    <Txt size={13} color={c.muc2}>
                      {f.role_text}
                    </Txt>
                  ) : null}
                </Pressable>
              ))}
            </Section>
          ) : null}
          {g.places.length ? (
            <Section title="Địa danh">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {g.places.map((p) => (
                  <Btn key={p.id} title={p.old_name ? `${p.name} (${p.old_name})` : p.name} tone="thuy" size="sm" onPress={() => open('place', p.id)} />
                ))}
              </View>
            </Section>
          ) : null}
          {g.terms.length ? (
            <Section title="Thuật ngữ">
              {g.terms.map((t) => (
                <View key={t.id}>
                  <Txt f="semibold" size={15}>
                    {t.term}
                  </Txt>
                  <Txt size={14} color={c.muc2}>
                    {t.definition}
                  </Txt>
                </View>
              ))}
            </Section>
          ) : null}
          {g.quotes.length ? (
            <Section title="Câu nói nổi tiếng">
              {g.quotes.map((q, i) => (
                <InfoNote key={i}>
                  “{q.text}” — {q.by}
                </InfoNote>
              ))}
            </Section>
          ) : null}
          {g.gate.guide_note ? (
            <Section title="Lời nhắn của người biên soạn">
              <Txt size={14}>{g.gate.guide_note}</Txt>
            </Section>
          ) : null}
        </View>
      ) : null}
    </Sheet>
  );
};

// ---------------------------------------------------------------------- màn Học
export const LearningPathTab: React.FC<{ session: Session; refreshKey: number; actions: NodeActions }> = ({
  session,
  refreshKey,
  actions,
}) => {
  const { c, dark } = useTheme();
  const load = useLoad(() => api.learningPath(session.token), [session.token, refreshKey], session.expired);
  // Bản xem trước chỉ có khi chạy local (__DEV__): dùng dữ liệu mẫu khi tài khoản chưa có hành trình được công bố
  const demoState = useDemoLearningState();
  const demo = __DEV__ && demoState.active;
  const path = demo ? demoState.path : load.data;
  const [demoNode, setDemoNode] = useState<PathNode | null>(null);

  const [view, setView] = useState<'path' | 'sections'>('path');
  const [manualPartNo, setManualPartNo] = useState<number | null>(null);
  const [openTarget, setOpenTarget] = useState<{ node: PathNode; gate: PathGate; theme: UnitTheme } | null>(null);
  const [guide, setGuide] = useState<{ id: number; title: string } | null>(null);
  const [scrollY, setScrollY] = useState(0);
  const [canvasW, setCanvasW] = useState(560);
  const [viewH, setViewH] = useState(640);

  const scroller = useRef<ScrollViewInstance>(null);
  const autoScrolledKey = useRef<string | null>(null);

  const selectedPartNo = useMemo(() => (path ? resolveSelectedPartNo(path, manualPartNo) : null), [path, manualPartNo]);
  const focusPartNo = useMemo(() => (path ? defaultFocusPartNo(path) : null), [path]);

  const selectedPart = useMemo(() => path?.parts.find((p) => p.no === selectedPartNo) ?? null, [path, selectedPartNo]);
  const nextPart = useMemo(() => {
    if (!path || !selectedPart) return null;
    const idx = path.parts.findIndex((p) => p.no === selectedPart.no);
    return idx >= 0 && idx + 1 < path.parts.length ? path.parts[idx + 1] : null;
  }, [path, selectedPart]);

  const { items, height } = useMemo(
    () => (selectedPart ? layoutPartPath(selectedPart, nextPart) : { items: [], height: 0 }),
    [selectedPart, nextPart],
  );

  // Nút hiện tại trong Phần đang mở (nút đang mở đầu tiên, ưu tiên path.current nếu trùng Phần)
  const partCurrentNodeItem = useMemo(() => {
    if (!selectedPart) return null;
    const preferredId = path?.current?.part_no === selectedPart.no ? path.current.node_id : null;
    return (
      items.find((it): it is Extract<typeof it, { type: 'node' }> => it.type === 'node' && it.node.id === preferredId) ??
      items.find((it): it is Extract<typeof it, { type: 'node' }> => it.type === 'node' && it.node.state === 'available') ??
      null
    );
  }, [items, path?.current, selectedPart]);

  // Khi mở lần đầu hoặc khi đổi sang Phần khác, tự cuộn mượt tới nút đang học của Phần đó
  useEffect(() => {
    if (view !== 'path' || !selectedPart) return;
    const key = `${selectedPart.no}:${partCurrentNodeItem?.node.id ?? 'top'}`;
    if (autoScrolledKey.current === key) return;
    autoScrolledKey.current = key;
    const targetY = partCurrentNodeItem ? Math.max(0, partCurrentNodeItem.top - 180) : 0;
    const timer = setTimeout(() => {
      setScrollY(targetY);
      scroller.current?.scrollTo({ y: targetY, animated: false });
    }, 50);
    return () => clearTimeout(timer);
  }, [view, selectedPart, partCurrentNodeItem]);

  const active = useMemo(() => activeGateItem(items, scrollY), [items, scrollY]);
  const activeTheme = active ? unitTheme(active.unitIndex) : unitTheme(0);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setScrollY(e.nativeEvent.contentOffset.y);
  const jumpDir = scrollButtonDirection(partCurrentNodeItem?.top ?? null, scrollY, viewH);

  const scrollToCurrent = () => {
    const y = partCurrentNodeItem ? Math.max(0, partCurrentNodeItem.top - 180) : 0;
    scroller.current?.scrollTo({ y, animated: true });
  };

  const openSectionPart = (partNo: number) => {
    setManualPartNo(partNo);
    setScrollY(0);
    autoScrolledKey.current = null;
    setView('path');
  };

  if (load.loading && !path) {
    return (
      <View style={{ padding: 16 }}>
        <Spinner label="Đang mở lộ trình…" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ErrorNote message={load.error} />
      {path && !path.parts.some((p) => p.journey) ? (
        <View style={{ padding: 16 }}>
          <EmptyState
            mood="thinking"
            title="Lộ trình đang được chuẩn bị"
            text="Các Phần và Cửa sẽ hiện ở đây khi nội dung học được công bố."
            action={__DEV__ ? <Btn label="Xem bản demo lộ trình (chỉ khi chạy local)" onPress={() => activateDemoMode(true)} /> : undefined}
          />
        </View>
      ) : null}

      {path && path.parts.some((p) => p.journey) && view === 'sections' ? (
        <LearningSections
          parts={path.parts}
          focusPartNo={focusPartNo}
          viewingPartNo={selectedPartNo}
          onBack={() => setView('path')}
          onSelectPart={openSectionPart}
        />
      ) : null}

      {path && selectedPart && view === 'path' ? (
        <>
          {/* Băng tiêu đề ghim trên cùng đổi màu động theo Cửa đang cuộn */}
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 5,
              backgroundColor: c.giay,
              paddingTop: 10,
              paddingHorizontal: 16,
              paddingBottom: 8,
            }}
          >
            <View
              accessibilityRole="header"
              accessibilityLabel={
                active
                  ? `Phần ${active.part.no}, Cửa ${active.gate.no}: ${active.gate.title}`
                  : `Phần ${selectedPart.no}: ${selectedPart.campaign.title}`
              }
              testID="path-banner"
              style={{
                maxWidth: 620,
                width: '100%',
                alignSelf: 'center',
                height: BANNER_H,
                borderRadius: 16,
                paddingHorizontal: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                backgroundColor: activeTheme.bg,
                borderBottomWidth: 5,
                borderBottomColor: activeTheme.edge,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Xem tất cả các Phần học"
                onPress={() => setView('sections')}
                testID="path-sections-back"
                style={({ pressed }) => ({
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: pressed ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.12)',
                  alignItems: 'center',
                  justifyContent: 'center',
                })}
              >
                <ArrowLeft size={20} color="#ffffff" strokeWidth={2.6} />
              </Pressable>

              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt f="bold" size={11.5} color="rgba(255,255,255,0.9)" upper>
                  {active ? `Phần ${active.part.no}, Cửa ${active.gate.no}` : `Phần ${selectedPart.no} · ${selectedPart.campaign.year_label}`}
                </Txt>
                <Txt f="displayHeavy" size={18} color="#ffffff" numberOfLines={1}>
                  {active ? active.gate.title : selectedPart.campaign.title}
                </Txt>
              </View>

              {active && active.gate.id !== null ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Hướng dẫn"
                  onPress={() => setGuide({ id: active.gate.id as number, title: active.gate.title })}
                  testID="path-guide"
                  style={({ pressed }) => ({
                    height: 40,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    backgroundColor: pressed ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.12)',
                    borderWidth: 1.5,
                    borderColor: 'rgba(255,255,255,0.28)',
                    borderBottomWidth: pressed ? 2 : 4,
                    borderBottomColor: 'rgba(0,0,0,0.22)',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  })}
                >
                  <BookMarked size={16} color="#ffffff" />
                  <Txt f="bold" size={13} color="#ffffff" upper>
                    Hướng dẫn
                  </Txt>
                </Pressable>
              ) : null}
            </View>
          </View>

          <ScrollView
            ref={scroller}
            onScroll={onScroll}
            onLayout={(e) => setViewH(e.nativeEvent.layout.height)}
            scrollEventThrottle={32}
            contentContainerStyle={{ paddingTop: BANNER_H + 22 }}
            showsVerticalScrollIndicator={false}
          >
            {!items.some((i) => i.type === 'node') ? (
              <View style={{ padding: 20, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
                <EmptyState mood="thinking" title="Phần này chưa có bài học" text="Các Cửa và bài học sẽ hiển thị khi giáo viên công bố nội dung." />
              </View>
            ) : null}
            <View
              style={{ height, width: '100%', maxWidth: 560, alignSelf: 'center' }}
              onLayout={(e) => setCanvasW(e.nativeEvent.layout.width)}
            >
              {items.map((it, idx) => {
                if (it.type === 'divider') {
                  if (!it.showRule) return null;
                  const divTheme = unitTheme(it.unitIndex);
                  return (
                    <View
                      key={`g-${it.part.no}-${it.gate.no}`}
                      style={{
                        position: 'absolute',
                        top: it.top,
                        left: 16,
                        right: 16,
                        height: it.height,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 14,
                      }}
                    >
                      <View style={{ flex: 1, height: 2, backgroundColor: c.vien, borderRadius: 2 }} />
                      <View style={{ alignItems: 'center', maxWidth: '68%' }}>
                        <Txt f="bold" size={14} color={dark ? c.muc2 : c.muc2} numberOfLines={1} center>
                          {it.gate.title}
                        </Txt>
                        <Txt size={11} color={dark ? divTheme.textDark : divTheme.textLight} f="semibold">
                          Cửa {it.gate.no} · {it.gate.done}/{it.gate.nodes.length}
                        </Txt>
                      </View>
                      <View style={{ flex: 1, height: 2, backgroundColor: c.vien, borderRadius: 2 }} />
                    </View>
                  );
                }

                if (it.type === 'mascot') {
                  const mTheme = unitTheme(it.unitIndex);
                  const narrow = canvasW < 450;
                  const scale = narrow ? 0.76 : 1;
                  const mSize = Math.round(MASCOT_SIZE * scale);
                  const offset = Math.round(it.offsetX * (narrow ? 0.72 : 1));
                  return (
                    <View
                      key={`m-${it.gate.no}-${idx}`}
                      pointerEvents="none"
                      style={{
                        position: 'absolute',
                        top: it.top,
                        left: '50%',
                        marginLeft: offset - Math.round(mSize / 2),
                      }}
                    >
                      <PathMascotVignette
                        size={mSize}
                        mood={it.mood}
                        accessory={it.accessory}
                        tintBg={dark ? mTheme.darkBg : mTheme.lightBg}
                        bob={it.gate.state === 'current'}
                        title={it.title}
                      />
                    </View>
                  );
                }

                if (it.type === 'next_section') {
                  const nextTheme = unitTheme(it.nextPart.no - 1);
                  return (
                    <View
                      key={`next-${it.nextPart.no}`}
                      style={{
                        position: 'absolute',
                        top: it.top,
                        left: 16,
                        right: 16,
                        height: it.height,
                        justifyContent: 'center',
                      }}
                    >
                      <View
                        style={{
                          borderRadius: 20,
                          borderWidth: 2,
                          borderColor: c.vien2,
                          backgroundColor: c.the,
                          padding: 16,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 14,
                        }}
                      >
                        <View style={{ flex: 1, gap: 3 }}>
                          <Txt f="bold" size={11.5} color={dark ? nextTheme.textDark : nextTheme.textLight} upper>
                            Phần tiếp theo · {it.nextPart.campaign.year_label}
                          </Txt>
                          <Txt f="displayHeavy" size={17} numberOfLines={1}>
                            {it.nextPart.campaign.title}
                          </Txt>
                          <Txt size={12.5} color={c.muc3}>
                            {it.nextPart.gates.length} Cửa · {it.nextPart.totals.nodes} bài học
                          </Txt>
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Sang Phần ${it.nextPart.no}`}
                          onPress={() => openSectionPart(it.nextPart.no)}
                          testID={`path-next-part-${it.nextPart.no}`}
                          style={({ pressed }) => ({
                            paddingHorizontal: 14,
                            minHeight: 42,
                            borderRadius: 14,
                            backgroundColor: nextTheme.bg,
                            borderBottomWidth: pressed ? 2 : 4,
                            borderBottomColor: nextTheme.edge,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                          })}
                        >
                          <Txt f="bold" size={13} color="#ffffff" upper>
                            Phần {it.nextPart.no}
                          </Txt>
                          <ArrowRight size={15} color="#ffffff" />
                        </Pressable>
                      </View>
                    </View>
                  );
                }

                const nodeTheme = unitTheme(it.unitIndex);
                const isCurrent = partCurrentNodeItem?.node.id === it.node.id;
                return (
                  <View key={`n-${it.node.id}`} style={{ position: 'absolute', top: it.top, left: 0, right: 0 }}>
                    <PathButton
                      node={it.node}
                      theme={nodeTheme}
                      current={isCurrent}
                      x={it.x}
                      onPress={() => setOpenTarget({ node: it.node, gate: it.gate, theme: nodeTheme })}
                    />
                  </View>
                );
              })}
            </View>
          </ScrollView>

          {/* Nút nhảy nhanh góc dưới bên phải giống Duolingo */}
          <View
            style={{
              position: 'absolute',
              right: 18,
              bottom: 18,
              zIndex: 6,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            }}
          >
            {jumpDir ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={jumpDir === 'up' ? 'Cuộn lên bài đang học' : 'Cuộn xuống bài đang học'}
                onPress={scrollToCurrent}
                testID="path-jump-scroll"
                style={({ pressed }) => ({
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  backgroundColor: c.the,
                  borderWidth: 2,
                  borderColor: c.vien2,
                  borderBottomWidth: pressed ? 2 : 4,
                  borderBottomColor: c.vien2,
                  alignItems: 'center',
                  justifyContent: 'center',
                })}
              >
                {jumpDir === 'up' ? <ArrowUp size={20} color={activeTheme.bg} strokeWidth={2.6} /> : <ArrowDown size={20} color={activeTheme.bg} strokeWidth={2.6} />}
              </Pressable>
            ) : null}

            {partCurrentNodeItem ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Học tiếp: ${partCurrentNodeItem.node.title}`}
                onPress={() =>
                  setOpenTarget({
                    node: partCurrentNodeItem.node,
                    gate: partCurrentNodeItem.gate,
                    theme: unitTheme(partCurrentNodeItem.unitIndex),
                  })
                }
                testID="path-continue"
                style={({ pressed }) => ({
                  height: 46,
                  paddingHorizontal: 16,
                  borderRadius: 14,
                  backgroundColor: activeTheme.bg,
                  borderBottomWidth: pressed ? 2 : 4,
                  borderBottomColor: activeTheme.edge,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                })}
              >
                <Play size={16} color="#ffffff" fill="#ffffff" />
                <Txt f="bold" size={14} color="#ffffff">
                  Học tiếp
                </Txt>
              </Pressable>
            ) : selectedPart.totals.nodes > 0 && selectedPart.totals.done >= selectedPart.totals.nodes ? (
              <Chip text={`Đã xong Phần ${selectedPart.no}`} bg={c.ngocNhat} fg={c.ngocChu} icon={RotateCcw} />
            ) : null}
          </View>
        </>
      ) : null}

      {openTarget ? (
        <PathNodePopover
          session={session}
          node={openTarget.node}
          gateTitle={openTarget.gate.title}
          gateNo={openTarget.gate.no}
          theme={openTarget.theme}
          refreshKey={refreshKey}
          actions={actions}
          onStartDemo={demo ? setDemoNode : undefined}
          onClose={() => setOpenTarget(null)}
        />
      ) : null}
      {demo && demoNode ? <DemoActivityPlayer key={demoNode.id} node={demoNode} onClose={() => setDemoNode(null)} /> : null}
      {guide ? <GuideSheet session={session} gate={guide} onClose={() => setGuide(null)} onOpenDetail={actions.onOpenDetail} /> : null}
    </View>
  );
};

// ---------------------------------------------------------------------- mục Luyện tập của thanh menu (HK.HS.125)
export const PracticeTab: React.FC<{
  session: Session;
  refreshKey: number;
  onPractice: () => void;
  onGoLearn: () => void;
  onGoBattles?: () => void;
}> = ({ session, refreshKey, onPractice, onGoLearn, onGoBattles }) => {
  const { c } = useTheme();
  const wrong = useLoad(() => api.practiceInfo(session.token), [session.token, refreshKey], session.expired);
  const list = wrong.data ?? [];
  return (
    <View style={{ gap: 14 }}>
      <Txt f="displayHeavy" size={24} accessibilityRole="header">
        Luyện tập
      </Txt>
      <ErrorNote message={wrong.error} />
      <Card style={{ gap: 10 }}>
        <Txt f="bold" size={17}>
          Luyện lại câu đã sai
        </Txt>
        {wrong.loading && !wrong.data ? <Spinner /> : null}
        {wrong.data && !list.length ? (
          <Txt size={14} color={c.muc2}>
            Em chưa có câu nào cần luyện lại. Tuyệt vời!
          </Txt>
        ) : null}
        {list.slice(0, 5).map((w) => (
          <Txt key={w.question_id} size={14} color={c.muc2} numberOfLines={2}>
            • {w.prompt}
          </Txt>
        ))}
        {list.length > 5 ? (
          <Txt size={13} color={c.muc3}>
            … và {list.length - 5} câu khác
          </Txt>
        ) : null}
        <Btn
          title={list.length ? `Luyện ngay ${Math.min(10, list.length)} câu` : 'Chưa có câu để luyện'}
          tone="dong"
          size="lg"
          full
          disabled={!list.length}
          onPress={onPractice}
          testID="practice-start"
        />
        <Txt size={12} color={c.muc3}>
          Luyện đúng một câu thì câu đó được gỡ khỏi danh sách, em còn được hồi tim.
        </Txt>
      </Card>
      <Card flat style={{ gap: 8 }}>
        <Txt f="bold" size={16}>
          Ôn theo từng cửa
        </Txt>
        <Txt size={14} color={c.muc2}>
          Mỗi cửa trên lộ trình có nút Luyện tập (biểu tượng tạ) ôn lại những gì em vừa học, làm sai không mất tim.
        </Txt>
        <Btn title="Về lộ trình học" tone="ngoc" size="sm" onPress={onGoLearn} />
      </Card>
      {onGoBattles ? (
        <Card flat style={{ gap: 8 }}>
          <Txt f="bold" size={16}>
            Trận đánh và mini-game
          </Txt>
          <Txt size={14} color={c.muc2}>
            Chơi mô phỏng trận đánh và các trò chơi ghép thẻ, sắp xếp dòng thời gian, ô chữ.
          </Txt>
          <Btn title="Mở trận đánh" tone="thuy" size="sm" onPress={onGoBattles} />
        </Card>
      ) : null}
    </View>
  );
};
