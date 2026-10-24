/**
 * Hành Trình Đông A: thế giới 2D pixel gồm 3 vùng đất theo 3 lần kháng chiến (1258, 1282 – 1285, 1287 – 1288).
 * Đi lại bằng phím mũi tên / WASD, nút điều hướng hoặc chạm vào chỗ muốn đến; gặp người dân nghe chuyện xưa (thẻ Sử Ký)
 * rồi trả lời câu hỏi do server chấm để làm nhiệm vụ; gieo trồng trên luống đất (cây lớn theo thời gian thực, kể cả khi tắt máy);
 * đuổi thám báo; đóng cọc Bạch Đằng. Màn toàn màn hình: hộp thoại bên trong dùng InlineSheet, lượt hỏi dùng QuizPanel.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, Platform, Pressable, StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BookOpen, Check, ChevronLeft, ChevronRight, Compass, Crown, Footprints, Hammer, Hand, Keyboard, Lock, Map as MapIcon, MapPin, MessageCircle,
  Navigation, ScrollText, Shield, Sprout, Stamp, Swords, Wheat,
} from 'lucide-react-native';
import { Mascot, PixelArt } from '@/components/art';
import { LoreChip, QuizPanel, type QuizSummary } from '@/components/game/quiz';
import { Bar, Btn, Card, Chip, HudPill, InfoNote, InlineSheet, PressCard, Segmented, ToastView, Txt } from '@/components/ui';
import { CARDS, storeCap, troopCap } from '@/constants/game';
import { PALETTES } from '@/constants/theme';
import { CROPS, FARM_LESSON, QUEST_BY_ID, WORLD_MAPS, WORLD_MAP_BY_ID, WORLD_QUESTS } from '@/constants/world';
import { useGame } from '@/hooks/use-game';
import { useBob, usePopIn, useReduceMotion } from '@/hooks/use-motion';
import { ThemeContext, useTheme } from '@/hooks/use-theme';
import { useNow } from '@/hooks/use-timers';
import { fmt, fmtClock } from '@/lib/format';
import { bossArt, characterArt, cropArt, markerArt, objectArt, worldMapArt, type PixelPaths } from '@/lib/pixel-art';
import {
  DIRS, MAP_ORDER, activeQuest, besideTiles, cropState, faceToward, findPath, inside, mapGrid, mapUnlocked, objectCovers, objectSolid, objectVisible, portalOpen, questProgress,
  sideDone, solidAt, stakePlanted, stepFor, type PlotSpot,
} from '@/lib/world-engine';
import type { CodexEntry } from '@/types/api';
import type { CropId, GameState, IconType, WorldDir, WorldLesson, WorldMapDef, WorldMapId, WorldObjectDef, WorldQuestDef, WorldQuestStep, WorldReward } from '@/types/game';

const NATIVE = Platform.OS !== 'web';
const STEP_MS = 140;
const PATROL_MS = 700;

type Target = WorldObjectDef | PlotSpot;
type Marker = 'quest' | 'side' | 'alert' | 'ripe';
type Spot = { map: WorldMapId; x: number; y: number; dir: WorldDir };
type ScoutPos = Record<string, { x: number; y: number; to: number }>;

type SheetState =
  | { kind: 'talk'; obj: WorldObjectDef }
  | { kind: 'plot'; plot: PlotSpot }
  | { kind: 'journal' }
  | { kind: 'intro' }
  | { kind: 'region'; map: WorldMapId }
  | { kind: 'done'; questId: string };

const isObject = (t: Target): t is WorldObjectDef => 'kind' in t;

const KEY_DIR: Record<string, WorldDir> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right',
};

const DIR_LABEL: Record<WorldDir, string> = { up: 'Đi lên', down: 'Đi xuống', left: 'Sang trái', right: 'Sang phải' };

const ROTATE: Record<WorldDir, number> = { right: 0, down: 90, left: 180, up: 270 };

const EMPTY_ART: PixelPaths = { w: 16, h: 16, list: [] };

/** Cỡ ô trên màn hình: khoảng 11 ô theo chiều ngang điện thoại, tối đa 64 điểm ảnh */
const tileFor = (w: number, h: number) => Math.round(Math.max(32, Math.min(64, Math.min(w / 11, h / 12))));

const initScouts = (def: WorldMapDef): ScoutPos => Object.fromEntries(def.objects.filter((o) => o.patrol).map((o) => [o.id, { x: o.x, y: o.y, to: 1 }]));

/** Cộng thưởng (Lương Thảo, Quân Lực theo sức chứa; thẻ chiêu mộ dùng ở Hội Quán) */
const giveReward = (s: GameState, r?: WorldReward): GameState => {
  if (!r) return s;
  const cards = { ...s.cards };
  for (const id of r.cards ?? []) if (CARDS[id]) cards[id] = (cards[id] ?? 0) + 1;
  return { ...s, luong: Math.min(storeCap(s.buildings.kho.level), s.luong + r.luong), quan: Math.min(troopCap(s.buildings.trai.level), s.quan + r.quan), cards };
};

/** Ghi xong một bước nhiệm vụ (kèm thưởng của bước; bước cuối thì thưởng cả nhiệm vụ) */
const advanceQuest = (s: GameState, quest: WorldQuestDef, index: number): GameState => {
  if ((s.world.quests[quest.id] ?? 0) !== index) return s;
  const next = giveReward({ ...s, world: { ...s.world, quests: { ...s.world.quests, [quest.id]: index + 1 } } }, quest.steps[index].reward);
  return index + 1 >= quest.steps.length ? giveReward(next, quest.reward) : next;
};

const rewardText = (r: WorldReward) =>
  [r.luong ? `+${r.luong} Lương Thảo` : '', r.quan ? `+${r.quan} Quân Lực` : '', ...(r.cards ?? []).map((id) => `thẻ ${CARDS[id]?.name ?? id}`)].filter(Boolean).join(', ');

const objectPaths = (o: WorldObjectDef, w: GameState['world'], mapId: WorldMapId, night: boolean): PixelPaths => {
  switch (o.kind) {
    case 'npc':
    case 'scout':
      return characterArt(o.look ?? 'soldier', 'down', 0, night);
    case 'sign':
      return objectArt(o.sign ?? 'post', night);
    case 'scroll':
      return objectArt('scroll', night);
    case 'stake':
      return objectArt(stakePlanted(w, o.id) ? 'stake_done' : 'stake', night);
    case 'boss':
      return bossArt(night);
    case 'portal':
      return objectArt(!portalOpen(w, o) ? 'portal_locked' : o.to?.map === mapId ? 'ferry' : 'portal', night);
  }
};

/** Màn Hành Trình Đông A (toàn màn hình) */
export const WorldScreen: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { dark } = useGame();
  const theme = useMemo(() => ({ c: dark ? PALETTES.dark : PALETTES.light, dark }), [dark]);
  const back = useRef<() => void>(onClose);
  return (
    <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={() => back.current()} statusBarTranslucent>
      <ThemeContext.Provider value={theme}>
        <WorldBody onClose={onClose} backRef={back} />
      </ThemeContext.Provider>
    </Modal>
  );
};

const WorldBody: React.FC<{ onClose: () => void; backRef: React.MutableRefObject<() => void> }> = ({ onClose, backRef }) => {
  const { state, update, toast, dark, progress } = useGame();
  const world = state.world;
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const now = useNow(4000);
  const [mapId, setMapId] = useState<WorldMapId>(world.map);
  const [dir, setDir] = useState<WorldDir>(world.dir);
  const [frame, setFrame] = useState<0 | 1 | 2>(0);
  const [sheet, setSheet] = useState<SheetState | null>(() => (world.intro ? null : { kind: 'intro' }));
  const [view, setView] = useState({ w: 0, h: 0 });
  const [scouts, setScouts] = useState<ScoutPos>(() => initScouts(mapGrid(world.map).def));
  const pos = useRef({ x: world.x, y: world.y });
  const dirRef = useRef<WorldDir>(world.dir);
  const mapRef = useRef<WorldMapId>(world.map);
  const anim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const fade = useRef(new Animated.Value(0)).current;
  const moving = useRef(false);
  const held = useRef<WorldDir | null>(null);
  const path = useRef<Array<[number, number]>>([]);
  const pending = useRef<Target | null>(null);
  const busy = useRef(!world.intro);
  const traveling = useRef(false);
  const touchStart = useRef({ x: 0, y: 0 });

  const grid = mapGrid(mapId);
  const def = grid.def;
  const T = view.w ? tileFor(view.w, view.h) : 40;
  const mapW = grid.cols * T;
  const mapH = grid.rows * T;
  const art = useMemo(() => worldMapArt(def, dark), [def, dark]);
  const objects = useMemo(() => def.objects.filter((o) => objectVisible(world, o)), [def, world]);
  const quest = activeQuest(world);
  const questIndex = quest ? questProgress(world, quest) : 0;
  const questStep: WorldQuestStep | null = quest ? quest.steps[questIndex] : null;

  useEffect(() => {
    busy.current = !!sheet || traveling.current;
  }, [sheet]);

  // ---------------------------------------------------------------- camera bám theo nhân vật (giữa vùng nhìn giữa HUD và nút)
  const hudTop = insets.top + 118;
  const hudBottom = insets.bottom + 170;
  const focusY = view.h ? hudTop + Math.max(0, view.h - hudTop - hudBottom) / 2 : 0;
  const camera = useMemo(() => {
    const axis = (v: Animated.Value, viewSize: number, size: number, focus: number) => {
      if (size <= viewSize) return (viewSize - size) / 2;
      const f = focus - T / 2;
      return v.interpolate({ inputRange: [f, f + size - viewSize], outputRange: [0, viewSize - size], extrapolate: 'clamp' });
    };
    return { x: axis(anim.x, view.w, mapW, view.w / 2), y: axis(anim.y, view.h, mapH, focusY) };
  }, [anim, view.w, view.h, mapW, mapH, focusY, T]);

  const cameraAt = (px: number, py: number) => {
    const axis = (p: number, viewSize: number, size: number, focus: number) => (size <= viewSize ? (viewSize - size) / 2 : Math.max(viewSize - size, Math.min(0, focus - T / 2 - p)));
    return { x: axis(px, view.w, mapW, view.w / 2), y: axis(py, view.h, mapH, focusY) };
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    anim.setValue({ x: pos.current.x * tileFor(width, height), y: pos.current.y * tileFor(width, height) });
    setView({ w: width, h: height });
  };

  // ---------------------------------------------------------------- ô, vật, chặn đường
  const scoutAt = (x: number, y: number) => objects.find((o) => o.kind === 'scout' && scouts[o.id]?.x === x && scouts[o.id]?.y === y) ?? null;
  const objectAt = (x: number, y: number): WorldObjectDef | null => scoutAt(x, y) ?? objects.find((o) => o.kind !== 'scout' && objectCovers(o, x, y)) ?? null;
  const plotAt = (x: number, y: number) => grid.plots.find((p) => p.x === x && p.y === y) ?? null;
  const blocked = (x: number, y: number) => {
    if (solidAt(grid, x, y)) return true;
    const o = objectAt(x, y);
    return !!o && objectSolid(world, o);
  };
  /** Đường tự đi tránh cuộn sử và cổng (đi ngang qua sẽ mở ra giữa đường), trừ khi đó chính là đích */
  const route = (goals: Array<[number, number]>) => {
    const isGoal = (x: number, y: number) => goals.some(([gx, gy]) => gx === x && gy === y);
    const avoid = (x: number, y: number) => blocked(x, y) || (!isGoal(x, y) && objects.some((o) => (o.kind === 'scroll' || o.kind === 'portal') && objectCovers(o, x, y)));
    return findPath(grid, avoid, [pos.current.x, pos.current.y], goals);
  };
  const boxOf = (t: Target) => (isObject(t) && t.kind === 'scout' && scouts[t.id] ? { ...t, x: scouts[t.id].x, y: scouts[t.id].y } : t);
  const scoutActive = (o: WorldObjectDef) => !!stepFor(world, mapId, o) || (!!o.lesson && !sideDone(world, o));

  /** Vật/luống đất ngay trước mặt (hoặc thám báo đứng sát bên) */
  const facing = (d: WorldDir = dirRef.current): Target | null => {
    const fx = pos.current.x + DIRS[d][0];
    const fy = pos.current.y + DIRS[d][1];
    const o = objectAt(fx, fy);
    if (o && o.kind !== 'scroll') return o;
    const p = plotAt(fx, fy);
    if (p) return p;
    for (const [ax, ay] of besideTiles(pos.current)) {
      const s = scoutAt(ax, ay);
      if (s) return s;
    }
    return null;
  };

  // ---------------------------------------------------------------- di chuyển
  const turn = (d: WorldDir) => {
    dirRef.current = d;
    setDir(d);
  };

  const commit = () => {
    const { x, y } = pos.current;
    const d = dirRef.current;
    const m = mapRef.current;
    update((s) => (s.world.map === m && s.world.x === x && s.world.y === y && s.world.dir === d ? s : { ...s, world: { ...s.world, map: m, x, y, dir: d } }));
  };

  const stopWalking = () => {
    held.current = null;
    path.current = [];
    pending.current = null;
  };

  const open = (s: SheetState) => {
    stopWalking();
    busy.current = true;
    setSheet(s);
  };

  const close = () => {
    busy.current = traveling.current;
    setSheet(null);
  };

  const interact = (t: Target) => {
    stopWalking();
    setFrame(0);
    commit();
    if (!isObject(t)) return open({ kind: 'plot', plot: t });
    if (t.kind === 'portal' && t.to && portalOpen(world, t)) return travel(t.to);
    open({ kind: 'talk', obj: t });
  };

  const step = (d: WorldDir) => {
    if (moving.current || busy.current) return;
    turn(d);
    const nx = pos.current.x + DIRS[d][0];
    const ny = pos.current.y + DIRS[d][1];
    if (blocked(nx, ny)) {
      const o = objectAt(nx, ny);
      const retry = pending.current;
      const auto = !held.current && (path.current.length > 0 || !!retry);
      path.current = [];
      if (o?.kind === 'portal' && !portalOpen(world, o)) {
        toast(o.lines[0] ?? 'Chưa đi qua được');
        stopWalking();
      } else if (o?.kind === 'scout' && scoutActive(o) && (!auto || (retry && isObject(retry) && retry.id === o.id))) {
        // Va vào thám báo đang là việc cần làm: đối đầu luôn
        return interact(o);
      } else if (auto && retry) {
        // Đang tự đi mà bị chặn (thám báo đứng giữa đường): tìm đường vòng
        pending.current = null;
        return goTo(retry);
      } else if (o?.kind === 'scout') {
        toast(o.lines[0]);
        stopWalking();
      }
      setFrame(0);
      commit();
      return;
    }
    moving.current = true;
    pos.current = { x: nx, y: ny };
    setFrame((f) => (f === 1 ? 2 : 1));
    Animated.timing(anim, { toValue: { x: nx * T, y: ny * T }, duration: reduce ? 0 : STEP_MS, easing: Easing.linear, useNativeDriver: NATIVE }).start(() => {
      moving.current = false;
      ctl.current.arrive(nx, ny);
    });
  };

  /** Tới ô mới: cuộn sử tự mở, cổng mở thì sang vùng khác; còn đường thì đi tiếp */
  const arrive = (x: number, y: number) => {
    const o = objects.find((it) => (it.kind === 'scroll' || it.kind === 'portal') && objectCovers(it, x, y));
    if (o?.kind === 'portal' && o.to) {
      stopWalking();
      return travel(o.to);
    }
    if (o?.kind === 'scroll') return interact(o);
    next();
  };

  const next = () => {
    const tile = path.current.shift();
    if (tile) {
      const [tx, ty] = tile;
      return step(tx > pos.current.x ? 'right' : tx < pos.current.x ? 'left' : ty > pos.current.y ? 'down' : 'up');
    }
    const t = pending.current;
    if (t) {
      pending.current = null;
      const box = boxOf(t);
      if (besideTiles(box).some(([bx, by]) => bx === pos.current.x && by === pos.current.y)) {
        turn(faceToward(pos.current.x, pos.current.y, box));
        return interact(t);
      }
      return goTo(t);
    }
    if (held.current) return step(held.current);
    setFrame(0);
    commit();
  };

  /** Tự đi tới một vật/luống đất rồi nói chuyện (chạm vào bản đồ, nút Chỉ đường, nhật ký) */
  const goTo = (t: Target) => {
    if (busy.current) return;
    const box = boxOf(t);
    const walkOver = isObject(t) && (t.kind === 'scroll' || (t.kind === 'portal' && portalOpen(world, t)));
    const here: [number, number] = [pos.current.x, pos.current.y];
    if (!walkOver && besideTiles(box).some(([bx, by]) => bx === here[0] && by === here[1])) {
      if (moving.current) {
        path.current = [];
        pending.current = t;
        return;
      }
      turn(faceToward(here[0], here[1], box));
      return interact(t);
    }
    const goals: Array<[number, number]> = walkOver ? [[box.x, box.y]] : besideTiles(box).filter(([bx, by]) => !blocked(bx, by));
    let way = route(goals);
    let after: Target | null = walkOver ? null : t;
    if (!way) {
      // Mục tiêu ở bờ sông bên kia (Bạch Đằng): xuống đò trước
      const ferry = objects.find((o) => o.kind === 'portal' && o.to?.map === mapId && route([[o.x, o.y]]));
      if (ferry) {
        way = route([[ferry.x, ferry.y]]);
        after = null;
        toast('Lên đò sang bờ bên kia trước đã');
      }
    }
    if (!way) return toast('Chưa tìm được đường tới đó');
    held.current = null;
    path.current = way;
    pending.current = after;
    if (!moving.current) next();
  };

  const travel = (to: Spot) => {
    stopWalking();
    traveling.current = true;
    busy.current = true;
    const first = to.map !== mapRef.current && !world.done.includes(`map:${to.map}`);
    Animated.timing(fade, { toValue: 1, duration: reduce ? 0 : 220, useNativeDriver: NATIVE }).start(() => {
      pos.current = { x: to.x, y: to.y };
      mapRef.current = to.map;
      setMapId(to.map);
      setScouts(initScouts(mapGrid(to.map).def));
      turn(to.dir);
      setFrame(0);
      anim.setValue({ x: to.x * T, y: to.y * T });
      commit();
      Animated.timing(fade, { toValue: 0, duration: reduce ? 0 : 260, useNativeDriver: NATIVE }).start(() => {
        traveling.current = false;
        busy.current = false;
        if (first) ctl.current.open({ kind: 'region', map: to.map });
      });
    });
  };

  const action = () => {
    if (busy.current) return;
    const t = facing();
    if (!t) return toast('Hãy quay mặt vào người, bảng hoặc luống đất rồi bấm nút này');
    turn(faceToward(pos.current.x, pos.current.y, boxOf(t)));
    interact(t);
  };

  /** Nút Chỉ đường: tới việc đang làm (khác vùng thì tới cổng dẫn sang vùng đó) */
  const guide = () => {
    if (!quest || !questStep) return;
    if (quest.map !== mapId) {
      const ahead = MAP_ORDER.indexOf(quest.map) > MAP_ORDER.indexOf(mapId) ? 1 : -1;
      const nextMap = MAP_ORDER[MAP_ORDER.indexOf(mapId) + ahead];
      const portal = objects.find((o) => o.kind === 'portal' && o.to?.map === nextMap);
      return portal ? goTo(portal) : undefined;
    }
    if (questStep.target === 'plot') return goTo(grid.plots.find((p) => !world.plots[p.id]) ?? grid.plots[0]);
    const obj = objects.find((o) => o.id === questStep.target);
    if (obj) goTo(obj);
  };

  const tapAt = (lx: number, ly: number) => {
    if (busy.current) return;
    const cam = cameraAt(pos.current.x * T, pos.current.y * T);
    const tx = Math.floor((lx - cam.x) / T);
    const ty = Math.floor((ly - cam.y) / T);
    if (!inside(grid, tx, ty)) return;
    if (tx === pos.current.x && ty === pos.current.y) return action();
    const t = objectAt(tx, ty) ?? plotAt(tx, ty);
    if (t) return goTo(t);
    if (blocked(tx, ty)) return;
    const way = route([[tx, ty]]);
    if (!way) return toast('Chưa tìm được đường tới đó');
    held.current = null;
    pending.current = null;
    path.current = way;
    if (!moving.current) next();
  };

  const markSeen = (key: string) => update((s) => (s.world.done.includes(key) ? s : { ...s, world: { ...s.world, done: [...s.world.done, key] } }));

  const closeSheet = () => {
    if (sheet?.kind === 'intro') {
      update((s) => ({ ...s, world: { ...s.world, intro: true, done: s.world.done.includes('map:dong_a') ? s.world.done : [...s.world.done, 'map:dong_a'] } }));
    }
    if (sheet?.kind === 'region') markSeen(`map:${sheet.map}`);
    close();
  };

  const exit = () => {
    stopWalking();
    commit();
    onClose();
  };

  backRef.current = () => (sheet ? closeSheet() : exit());

  // Hàm mới nhất cho các lời gọi trễ (hết hoạt ảnh, hẹn giờ, phím bấm)
  const ctl = useRef({ step, arrive, action, open, back: backRef.current, commit });
  ctl.current = { step, arrive, action, open, back: backRef.current, commit };

  // ---------------------------------------------------------------- thám báo đi tuần (đứng lại khi thấy người chơi)
  useEffect(() => {
    const patrol = def.objects.filter((o) => o.patrol);
    if (!patrol.length) return;
    const timer = setInterval(() => {
      if (busy.current) return;
      setScouts((cur) => {
        let changed = false;
        const nextPos = { ...cur };
        for (const o of patrol) {
          const s = cur[o.id];
          if (!s || !o.patrol) continue;
          const p = pos.current;
          if (Math.abs(p.x - s.x) + Math.abs(p.y - s.y) <= 2) continue;
          const [wx, wy] = o.patrol[s.to];
          if (wx === s.x && wy === s.y) {
            nextPos[o.id] = { ...s, to: (s.to + 1) % o.patrol.length };
            changed = true;
            continue;
          }
          const nx = s.x + Math.sign(wx - s.x);
          const ny = s.y + Math.sign(wy - s.y);
          if (nx === p.x && ny === p.y) continue;
          nextPos[o.id] = { ...s, x: nx, y: ny };
          changed = true;
        }
        return changed ? nextPos : cur;
      });
    }, PATROL_MS);
    return () => clearInterval(timer);
  }, [def]);

  // ---------------------------------------------------------------- bàn phím (web): mũi tên/WASD đi, Space/Enter/E nói chuyện, J nhật ký, Esc đóng bảng
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const down = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      if (e.key === 'Escape' && busy.current && !traveling.current) return ctl.current.back();
      if (busy.current) return;
      const d = KEY_DIR[e.key];
      if (d) {
        e.preventDefault();
        if (e.repeat) return;
        held.current = d;
        path.current = [];
        pending.current = null;
        return ctl.current.step(d);
      }
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'e' || e.key === 'E') {
        if (el?.getAttribute('role') === 'button') return;
        e.preventDefault();
        return ctl.current.action();
      }
      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        ctl.current.open({ kind: 'journal' });
      }
    };
    const up = (e: KeyboardEvent) => {
      if (KEY_DIR[e.key] && held.current === KEY_DIR[e.key]) held.current = null;
    };
    const blur = () => {
      held.current = null;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  // Rời màn: lưu vị trí
  useEffect(() => () => ctl.current.commit(), []);

  // ---------------------------------------------------------------- vẽ
  const front = sheet ? null : facing(dir);
  const frontInfo = ((): { label: string; Icon: IconType } => {
    if (!front) return { label: 'Tương tác', Icon: Hand };
    if (!isObject(front)) return { label: 'Luống đất', Icon: Sprout };
    switch (front.kind) {
      case 'npc':
        return { label: 'Nói chuyện', Icon: MessageCircle };
      case 'sign':
        return { label: 'Đọc', Icon: BookOpen };
      case 'scroll':
        return { label: 'Nhặt', Icon: ScrollText };
      case 'scout':
      case 'boss':
        return { label: 'Đối đầu', Icon: Swords };
      case 'stake':
        return { label: stakePlanted(world, front.id) ? 'Xem cọc' : 'Đóng cọc', Icon: Hammer };
      case 'portal':
        return portalOpen(world, front) ? { label: 'Đi qua', Icon: Footprints } : { label: 'Cổng khóa', Icon: Lock };
    }
  })();
  const frontName = front ? (isObject(front) ? front.name : `Luống đất số ${front.n}`) : '';

  const markerFor = (o: WorldObjectDef): Marker | null => {
    if (stepFor(world, mapId, o)) return 'quest';
    if (o.kind === 'scout') {
      const s = scouts[o.id];
      if (s && Math.abs(s.x - pos.current.x) + Math.abs(s.y - pos.current.y) <= 2) return 'alert';
    }
    return o.lesson && !sideDone(world, o) && o.kind !== 'scroll' ? 'side' : null;
  };
  const plotQuest = questStep?.target === 'plot' && quest?.map === mapId;
  const firstEmpty = grid.plots.find((p) => !world.plots[p.id])?.id;

  const tracker = !quest || !questStep
    ? 'Em đã đi hết hành trình! Ghé lại thu hoạch, nhặt cuộn sử còn sót và ôn chuyện xưa nhé.'
    : quest.map !== mapId
      ? `Đến ${WORLD_MAP_BY_ID[quest.map].name}: ${questStep.text}`
      : questStep.text;
  const sceneLabel = `Bản đồ ${def.name}. ${frontName ? `Trước mặt em: ${frontName}.` : ''} Việc đang làm: ${tracker}`;
  const wideScreen = view.w >= 720;

  return (
    <View style={{ flex: 1, backgroundColor: dark ? '#0b1220' : '#2f5a3a' }} accessibilityViewIsModal role="dialog" aria-label="Hành Trình Đông A">
      <View
        style={StyleSheet.absoluteFill}
        onLayout={onLayout}
        onStartShouldSetResponder={() => !busy.current}
        onResponderGrant={(e: GestureResponderEvent) => {
          touchStart.current = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY };
        }}
        onResponderRelease={(e: GestureResponderEvent) => {
          const { locationX, locationY } = e.nativeEvent;
          if (Math.abs(locationX - touchStart.current.x) < 14 && Math.abs(locationY - touchStart.current.y) < 14) tapAt(locationX, locationY);
        }}
        accessible
        accessibilityRole="image"
        accessibilityLabel={sceneLabel}
      >
        {view.w > 0 && (
          <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: mapW, height: mapH, transform: [{ translateX: camera.x }, { translateY: camera.y }] }}>
            <PixelArt art={art.ground} width={mapW} height={mapH} />
            {grid.plots.map((p) => {
              const plant = world.plots[p.id];
              if (!plant) return plotQuest && p.id === firstEmpty ? <Sprite key={p.id} art={EMPTY_ART} x={p.x} y={p.y} T={T} marker="quest" /> : null;
              const cs = cropState(plant, now);
              return <Sprite key={p.id} art={cropArt(plant.crop, cs.stage, dark)} x={p.x} y={p.y} T={T} marker={cs.ready ? 'ripe' : null} />;
            })}
            {objects.map((o) => {
              const s = o.kind === 'scout' ? scouts[o.id] : null;
              return (
                <Sprite
                  key={o.id}
                  art={objectPaths(o, world, mapId, dark)}
                  x={s?.x ?? o.x}
                  y={s?.y ?? o.y}
                  w={o.w}
                  h={o.h}
                  T={T}
                  marker={markerFor(o)}
                  bob={o.kind === 'scroll'}
                  slide={o.kind === 'scout'}
                  rotate={o.kind === 'portal' && o.to && o.to.map !== mapId && portalOpen(world, o) ? ROTATE[o.to.dir] : 0}
                />
              );
            })}
            <Animated.View style={{ position: 'absolute', left: 0, top: 0, width: T, height: T, transform: anim.getTranslateTransform() }}>
              <PixelArt art={characterArt('player', dir, frame, dark)} width={T} height={T} />
            </Animated.View>
            <View style={StyleSheet.absoluteFill}>
              <PixelArt art={art.over} width={mapW} height={mapH} />
            </View>
          </Animated.View>
        )}
      </View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#0b1220', opacity: fade }]} />

      {/* Thanh trên: về Điền Trang, tên vùng, tài nguyên, nhật ký, việc đang làm */}
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: 0, paddingTop: insets.top + 8, paddingHorizontal: 12, gap: 8 }}>
        <View pointerEvents="box-none" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Btn icon={ChevronLeft} title={wideScreen ? 'Về Điền Trang' : undefined} label="Về Điền Trang" tone="giay" size="sm" onPress={exit} />
          <View style={{ flexShrink: 1, paddingHorizontal: 12, paddingVertical: 3, borderRadius: 14, backgroundColor: c.the, borderWidth: 2, borderColor: c.vien }}>
            <Txt f="display" size={15} numberOfLines={1}>
              {def.name}
            </Txt>
            <Txt f="semibold" size={11} color={c.muc2} numberOfLines={1}>
              {def.era}
            </Txt>
          </View>
          <View pointerEvents="box-none" style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {view.w >= 430 && <HudPill icon={Wheat} value={fmt(state.luong)} label="Lương Thảo" tone={c.dong} />}
            <HudPill icon={Stamp} value={fmt(progress.gems)} label="Ấn Tín" tone={c.ngoc} />
            <Btn icon={MapIcon} title={wideScreen ? 'Nhật ký' : undefined} label="Nhật ký hành trình" tone="giay" size="sm" onPress={() => open({ kind: 'journal' })} />
          </View>
        </View>
        <View style={{ alignSelf: 'flex-start', width: '100%', maxWidth: 560, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 18, backgroundColor: c.the, borderWidth: 2, borderColor: c.vien }}>
          <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: c.dongNhat, alignItems: 'center', justifyContent: 'center' }}>
            {quest ? <Compass size={20} color={c.dongChu} /> : <Crown size={20} color={c.dongChu} />}
          </View>
          <View style={{ flex: 1 }} accessibilityLiveRegion="polite">
            <Txt f="semibold" size={12} color={c.muc2} numberOfLines={1}>
              {quest ? `${quest.title} · việc ${questIndex + 1}/${quest.steps.length}` : 'Hành Trình Đông A'}
            </Txt>
            <Txt f="bold" size={14} numberOfLines={2}>
              {tracker}
            </Txt>
          </View>
          {quest && <Btn icon={Navigation} title={view.w >= 480 ? 'Chỉ đường' : undefined} label="Chỉ đường tới việc đang làm" tone="dong" size="sm" onPress={guide} />}
        </View>
      </View>

      {/* Nút điều hướng và nút tương tác */}
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: insets.bottom + 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <DPad
          onPressIn={(d) => {
            if (busy.current) return;
            held.current = d;
            path.current = [];
            pending.current = null;
            step(d);
          }}
          onPressOut={(d) => {
            if (held.current === d) held.current = null;
          }}
        />
        {Platform.OS === 'web' && view.w >= 900 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: c.the, borderWidth: 2, borderColor: c.vien, marginBottom: 6 }}>
            <Keyboard size={16} color={c.muc2} />
            <Txt f="semibold" size={12} color={c.muc2}>
              Mũi tên / WASD: đi · Space: nói chuyện · J: nhật ký · chạm bản đồ để tự đi
            </Txt>
          </View>
        )}
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Pressable
            onPress={action}
            accessibilityRole="button"
            accessibilityLabel={front ? `${frontInfo.label}: ${frontName}` : 'Tương tác – chưa có gì trước mặt'}
            style={({ pressed }) => ({
              width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: front ? c.son : c.the, borderWidth: 3,
              borderColor: front ? c.sonDam : c.vien2, borderBottomWidth: pressed ? 3 : 7, transform: [{ translateY: pressed ? 3 : 0 }],
            })}
          >
            <frontInfo.Icon size={30} color={front ? '#ffffff' : c.muc3} strokeWidth={2.4} />
          </Pressable>
          <View style={{ paddingHorizontal: 10, paddingVertical: 2, borderRadius: 999, backgroundColor: c.the, borderWidth: 2, borderColor: c.vien, maxWidth: 150 }}>
            <Txt f="bold" size={12} numberOfLines={1}>
              {front ? `${frontInfo.label}${frontName ? ` · ${frontName}` : ''}` : frontInfo.label}
            </Txt>
          </View>
        </View>
      </View>

      {sheet?.kind === 'talk' && <TalkSheet key={sheet.obj.id} obj={sheet.obj} mapId={mapId} onClose={close} onQuestDone={(questId) => setSheet({ kind: 'done', questId })} />}
      {sheet?.kind === 'plot' && <PlotSheet plot={sheet.plot} mapId={mapId} onClose={close} onQuestDone={(questId) => setSheet({ kind: 'done', questId })} />}
      {sheet?.kind === 'journal' && (
        <JournalSheet
          mapId={mapId}
          objects={objects}
          plots={grid.plots}
          onClose={close}
          onGo={(t) => {
            close();
            goTo(t);
          }}
          onTravel={(m) => {
            close();
            travel({ map: m, ...WORLD_MAP_BY_ID[m].spawn });
          }}
        />
      )}
      {sheet?.kind === 'intro' && <IntroSheet onClose={closeSheet} />}
      {sheet?.kind === 'region' && <RegionSheet map={sheet.map} onClose={closeSheet} />}
      {sheet?.kind === 'done' && <DoneSheet questId={sheet.questId} onClose={close} />}
      <ToastView />
    </View>
  );
};

// ---------------------------------------------------------------------- vật trên bản đồ
const Bubble: React.FC<{ kind: Marker; width: number; T: number }> = ({ kind, width, T }) => {
  const float = useBob(true, Math.max(2, T / 14));
  const s = Math.round(T * 0.6);
  return (
    <Animated.View style={[{ position: 'absolute', left: (width - s) / 2, top: -s * 0.95, width: s, height: s }, float]}>
      <PixelArt art={markerArt(kind)} width={s} height={s} />
    </Animated.View>
  );
};

interface SpriteProps {
  art: PixelPaths;
  x: number;
  y: number;
  T: number;
  w?: number;
  h?: number;
  rotate?: number;
  marker?: Marker | null;
  bob?: boolean;
  slide?: boolean;
}

/** Một vật/nhân vật theo ô (thám báo trượt sang ô mới), kèm bong bóng trên đầu */
const Sprite = React.memo<SpriteProps>(({ art, x, y, T, w = 1, h = 1, rotate = 0, marker = null, bob = false, slide = false }) => {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.ValueXY({ x: x * T, y: y * T })).current;
  useEffect(() => {
    if (!slide || reduce) {
      v.setValue({ x: x * T, y: y * T });
      return;
    }
    const a = Animated.timing(v, { toValue: { x: x * T, y: y * T }, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE });
    a.start();
    return () => a.stop();
  }, [x, y, T, slide, reduce, v]);
  const float = useBob(bob, Math.max(2, T / 16));
  return (
    <Animated.View style={{ position: 'absolute', left: 0, top: 0, width: w * T, height: h * T, transform: v.getTranslateTransform() }}>
      <Animated.View style={float}>
        <View style={rotate ? { transform: [{ rotate: `${rotate}deg` }] } : null}>
          <PixelArt art={art} width={w * T} height={h * T} />
        </View>
      </Animated.View>
      {marker && <Bubble kind={marker} width={w * T} T={T} />}
    </Animated.View>
  );
});
Sprite.displayName = 'Sprite';

const DPad: React.FC<{ onPressIn: (d: WorldDir) => void; onPressOut: (d: WorldDir) => void }> = ({ onPressIn, onPressOut }) => {
  const { c } = useTheme();
  const size = 52;
  const button = (d: WorldDir, Icon: IconType, place: ViewStyle) => (
    <Pressable
      key={d}
      onPressIn={() => onPressIn(d)}
      onPressOut={() => onPressOut(d)}
      accessibilityRole="button"
      accessibilityLabel={DIR_LABEL[d]}
      style={({ pressed }) => [
        {
          position: 'absolute', width: size, height: size, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? c.son : c.the, borderWidth: 2,
          borderColor: c.vien, borderBottomWidth: pressed ? 2 : 5, borderBottomColor: pressed ? c.sonDam : c.vien2,
        },
        place,
      ]}
    >
      {({ pressed }) => <Icon size={24} color={pressed ? '#ffffff' : c.muc} strokeWidth={2.6} />}
    </Pressable>
  );
  return (
    <View style={{ width: size * 3, height: size * 3 }}>
      <View style={{ position: 'absolute', left: size, top: size, width: size, height: size, borderRadius: size / 2, backgroundColor: c.the, opacity: 0.6 }} />
      {button('up', ArrowUp, { left: size, top: 0 })}
      {button('left', ArrowLeft, { left: 0, top: size })}
      {button('right', ArrowRight, { left: size * 2, top: size })}
      {button('down', ArrowDown, { left: size, top: size * 2 })}
    </View>
  );
};

// ---------------------------------------------------------------------- hội thoại, chuyện xưa, phần thưởng
const Portrait: React.FC<{ obj: WorldObjectDef; size?: number }> = ({ obj, size = 56 }) => {
  const { c } = useTheme();
  const art =
    obj.kind === 'npc' || obj.kind === 'scout'
      ? characterArt(obj.look ?? 'soldier', 'down', 0, false)
      : obj.kind === 'boss'
        ? bossArt(false)
        : obj.kind === 'sign'
          ? objectArt(obj.sign ?? 'post', false)
          : obj.kind === 'scroll'
            ? objectArt('scroll', false)
            : obj.kind === 'stake'
              ? objectArt('stake', false)
              : objectArt('portal', false);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 3.5, backgroundColor: c.mocNhat, borderWidth: 2, borderColor: c.vien, alignItems: 'center', justifyContent: 'center' }}>
      <PixelArt art={art} width={size * 0.8} height={size * 0.8} />
    </View>
  );
};

const Speech: React.FC<{ text: string; page: number; total: number }> = ({ text, page, total }) => {
  const { c } = useTheme();
  const pop = usePopIn(page);
  return (
    <Animated.View style={[{ borderRadius: 18, borderWidth: 2, borderColor: c.vien, backgroundColor: c.the, padding: 14, gap: 6 }, pop]}>
      <Txt size={17} style={{ lineHeight: 26 }} accessibilityLiveRegion="polite">
        {text}
      </Txt>
      {total > 1 && (
        <Txt f="semibold" size={12} color={c.muc2} style={{ alignSelf: 'flex-end' }}>
          {page + 1}/{total}
        </Txt>
      )}
    </Animated.View>
  );
};

/** Chuyện xưa lấy từ thẻ Sử Ký (kho tri thức) để nội dung game khớp với chatbot và câu hỏi */
const FactCards: React.FC<{ units: string[] }> = ({ units }) => {
  const { codex } = useGame();
  const { c } = useTheme();
  const entries = units.map((u) => codex.find((e) => e.unit_id === u)).filter((e): e is CodexEntry => !!e);
  if (!entries.length) return <InfoNote>Em có thể đọc lại chuyện này ở tab Sử Ký.</InfoNote>;
  return (
    <View style={{ gap: 10 }}>
      {entries.map((e) => (
        <Card key={e.unit_id} flat pad={14} style={{ gap: 6, backgroundColor: c.the2 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <ScrollText size={18} color={c.dongChu} />
            <Txt f="display" size={16} style={{ flex: 1, minWidth: 160 }}>
              Chuyện xưa: {e.topic}
            </Txt>
            <LoreChip lore={e.label} />
          </View>
          <Txt f="serif" size={15} style={{ lineHeight: 24 }}>
            {e.fact_chunk}
          </Txt>
          {e.source ? (
            <Txt size={12} color={c.muc2}>
              Nguồn: {e.source}
            </Txt>
          ) : null}
        </Card>
      ))}
    </View>
  );
};

const RewardRow: React.FC<{ r: WorldReward; xp?: boolean }> = ({ r, xp = true }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
      <Txt f="semibold" size={13} color={c.muc2}>
        Phần thưởng:
      </Txt>
      {r.luong > 0 && <Chip text={`+${r.luong} Lương Thảo`} icon={Wheat} bg={c.dongNhat} fg={c.dongChu} />}
      {r.quan > 0 && <Chip text={`+${r.quan} Quân Lực`} icon={Shield} bg={c.sonNhat} fg={c.sonChu} />}
      {(r.cards ?? []).map((id) => (
        <Chip key={id} text={`Thẻ ${CARDS[id]?.name ?? id}`} icon={CARDS[id]?.Icon} bg={c.thongNhat} fg={c.thongChu} />
      ))}
      {xp && <Chip text="XP, Ấn Tín khi trả lời đúng" icon={Stamp} bg={c.ngocNhat} fg={c.ngocChu} />}
    </View>
  );
};

interface TalkPlan {
  st: { quest: WorldQuestDef; index: number; step: WorldQuestStep } | null;
  lines: string[];
  lesson?: WorldLesson;
  reward?: WorldReward;
  practice?: boolean;
}

/** Nói chuyện / đọc bảng / nhặt cuộn sử: lời thoại → chuyện xưa → trả lời câu hỏi → thưởng */
const TalkSheet: React.FC<{ obj: WorldObjectDef; mapId: WorldMapId; onClose: () => void; onQuestDone: (questId: string) => void }> = ({ obj, mapId, onClose, onQuestDone }) => {
  const { state, update, toast, bumpDaily } = useGame();
  // Chốt nội dung lúc mở bảng: trả lời xong, trạng thái đổi nhưng bảng không nhảy nội dung
  const [plan] = useState((): TalkPlan => {
    const w = state.world;
    const st = stepFor(w, mapId, obj);
    if (st) return { st, lines: st.step.lines?.length ? st.step.lines : obj.lines, lesson: st.step.lesson, reward: st.step.reward };
    if (obj.kind === 'stake' && !stakePlanted(w, obj.id)) return { st: null, lines: ['Chỗ này sẽ đóng cọc. Hãy làm lần lượt theo nhiệm vụ nhé.'] };
    if (obj.kind === 'scout' && !obj.lesson) return { st: null, lines: [obj.lines[0], 'Gợi ý: làm xong các việc trước trong nhiệm vụ rồi hãy đuổi tên thám báo này.'] };
    if (obj.lesson && !sideDone(w, obj)) return { st: null, lines: obj.lines, lesson: obj.lesson, reward: obj.reward };
    if (obj.lesson) return { st: null, lines: obj.lines, lesson: obj.lesson, practice: true };
    return { st: null, lines: obj.lines.length ? obj.lines : [obj.name] };
  });
  const [page, setPage] = useState(0);
  const [quiz, setQuiz] = useState(false);
  const finished = useRef<string | null>(null);
  const last = page >= plan.lines.length - 1;

  useEffect(() => {
    if (last && plan.lesson) bumpDaily('codex');
  }, [last, plan.lesson, bumpDaily]);

  const completeStep = () => {
    if (!plan.st) return;
    const { quest, index, step } = plan.st;
    update((s) => advanceQuest(s, quest, index));
    if (index + 1 >= quest.steps.length) finished.current = quest.id;
    else toast(`Xong việc: ${step.text}${step.reward ? ` (${rewardText(step.reward)})` : ''}`);
  };

  const finishQuiz = (sum: QuizSummary) => {
    if (!sum.passed) return toast('Chưa đủ câu đúng – nói chuyện lại để thử lần nữa nhé');
    if (plan.st) return completeStep();
    if (plan.practice || !plan.reward) return toast('Ôn tập tốt lắm!');
    const reward = plan.reward;
    update((s) => (s.world.done.includes(obj.id) ? s : giveReward({ ...s, world: { ...s.world, done: [...s.world.done, obj.id] } }, reward)));
    toast(`${obj.kind === 'scout' ? 'Thám báo đã rút chạy' : obj.kind === 'scroll' ? 'Đã cất cuộn sử vào Sử Ký' : 'Xong việc phụ'}: ${rewardText(reward)}`);
  };

  const closeAll = () => (finished.current ? onQuestDone(finished.current) : onClose());
  const fight = obj.kind === 'scout' || obj.kind === 'boss';

  return (
    <InlineSheet open onClose={closeAll} wide={quiz} title={obj.name} subtitle={obj.role} icon={<Portrait obj={obj} />}>
      {quiz && plan.lesson ? (
        <QuizPanel
          request={{ units: plan.lesson.units, count: plan.lesson.count }}
          passMark={plan.lesson.pass}
          sessionKind={plan.lesson.count > 1 ? 'practice' : null}
          finishLabel="Tiếp tục"
          onFinish={finishQuiz}
          onClose={closeAll}
        />
      ) : (
        <>
          <Speech text={plan.lines[page] ?? ''} page={page} total={plan.lines.length} />
          {!last ? (
            <Btn title="Tiếp" iconRight={ChevronRight} tone="ngoc" onPress={() => setPage(page + 1)} style={{ alignSelf: 'flex-end' }} />
          ) : (
            <>
              {plan.lesson && <FactCards units={plan.lesson.units} />}
              {plan.reward && <RewardRow r={plan.reward} />}
              {plan.lesson && plan.lesson.count > 1 && (
                <InfoNote>
                  Cần đúng {plan.lesson.pass}/{plan.lesson.count} câu. Sai cũng không sao – có giải thích và được làm lại với câu khác.
                </InfoNote>
              )}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 }}>
                {plan.lesson ? (
                  <>
                    <Btn title="Để sau" tone="ghost" onPress={closeAll} />
                    <Btn
                      title={plan.practice ? 'Ôn lại chuyện này' : `Trả lời ${plan.lesson.count} câu`}
                      icon={fight ? Swords : Stamp}
                      tone="dong"
                      size="lg"
                      onPress={() => setQuiz(true)}
                    />
                  </>
                ) : (
                  <Btn
                    title={plan.st ? 'Đã hiểu' : 'Tạm biệt'}
                    icon={Check}
                    tone="ngoc"
                    size="lg"
                    onPress={() => {
                      completeStep();
                      closeAll();
                    }}
                  />
                )}
              </View>
            </>
          )}
        </>
      )}
    </InlineSheet>
  );
};

// ---------------------------------------------------------------------- luống đất
const PlotSheet: React.FC<{ plot: PlotSpot; mapId: WorldMapId; onClose: () => void; onQuestDone: (questId: string) => void }> = ({ plot, mapId, onClose, onQuestDone }) => {
  const { state, update, toast, bumpDaily } = useGame();
  const { c } = useTheme();
  const now = useNow(1000);
  const [quiz, setQuiz] = useState(false);
  const plant = state.world.plots[plot.id];
  const cs = plant ? cropState(plant, now) : null;
  const full = state.luong >= storeCap(state.buildings.kho.level);

  const sow = (crop: CropId) => {
    const def = CROPS[crop];
    if (state.luong < def.seed) return toast('Chưa đủ Lương Thảo để mua hạt giống');
    const st = stepFor(state.world, mapId, plot);
    update((s) => {
      if (s.world.plots[plot.id] || s.luong < def.seed) return s;
      const sown: GameState = { ...s, luong: s.luong - def.seed, world: { ...s.world, plots: { ...s.world.plots, [plot.id]: { crop, at: Date.now(), boost: false } } } };
      return st ? advanceQuest(sown, st.quest, st.index) : sown;
    });
    if (st && st.index + 1 >= st.quest.steps.length) return onQuestDone(st.quest.id);
    toast(st ? `Xong việc: ${st.step.text}` : `Đã gieo ${def.name} – ${def.minutes} phút nữa sẽ chín`);
  };

  const harvest = () => {
    if (!plant || !cs?.ready) return;
    if (full) return toast('Kho Bí Mật đã đầy – nâng cấp kho ở Điền Trang để chứa thêm');
    const def = CROPS[plant.crop];
    update((s) => {
      if (!s.world.plots[plot.id]) return s;
      const plots = { ...s.world.plots };
      delete plots[plot.id];
      return { ...s, luong: Math.min(storeCap(s.buildings.kho.level), s.luong + def.yield), stats: { ...s.stats, harvests: s.stats.harvests + 1 }, world: { ...s.world, plots } };
    });
    bumpDaily('harvest');
    toast(`Thu hoạch ${def.name}: +${def.yield} Lương Thảo`);
    onClose();
  };

  const boost = (sum: QuizSummary) => {
    if (!sum.passed) return toast('Chưa đúng – cây vẫn lớn bình thường, em thử lại sau nhé');
    update((s) => {
      const p = s.world.plots[plot.id];
      return p ? { ...s, world: { ...s.world, plots: { ...s.world.plots, [plot.id]: { ...p, boost: true } } } } : s;
    });
    toast('Cây đã chín! Thu hoạch thôi');
  };

  return (
    <InlineSheet
      open
      onClose={onClose}
      wide={quiz}
      title={`Luống đất số ${plot.n}`}
      subtitle={plant ? `${CROPS[plant.crop].name} · ${cs?.ready ? 'đã chín' : 'đang lớn'}` : 'Đất trống – chọn hạt giống để gieo'}
      icon={
        <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: c.thoNhat, borderWidth: 2, borderColor: c.vien, alignItems: 'center', justifyContent: 'center' }}>
          <Sprout size={28} color={c.mocChu} />
        </View>
      }
    >
      {quiz ? (
        <QuizPanel request={{ units: FARM_LESSON.units, count: FARM_LESSON.count }} passMark={FARM_LESSON.pass} sessionKind={null} finishLabel="Tiếp tục" onFinish={boost} onClose={() => setQuiz(false)} />
      ) : !plant ? (
        <View style={{ gap: 10 }}>
          {Object.values(CROPS).map((cr) => (
            <PressCard
              key={cr.id}
              onPress={() => sow(cr.id)}
              disabled={state.luong < cr.seed}
              label={`Gieo ${cr.name}: ${cr.seed} Lương Thảo, chín sau ${cr.minutes} phút, thu ${cr.yield} Lương Thảo`}
              pad={12}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: c.giay2, alignItems: 'center', justifyContent: 'center' }}>
                <PixelArt art={cropArt(cr.id, 3, false)} width={44} height={44} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Txt f="display" size={16}>
                  {cr.name}
                </Txt>
                <Txt size={13} color={c.muc2}>
                  {cr.desc}
                </Txt>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  <Chip text={`Hạt giống ${cr.seed}`} icon={Wheat} bg={state.luong >= cr.seed ? c.giay2 : c.sonNhat} fg={state.luong >= cr.seed ? c.muc2 : c.sonChu} />
                  <Chip text={`${cr.minutes} phút`} bg={c.giay2} fg={c.muc2} />
                  <Chip text={`Thu +${cr.yield}`} bg={c.ngocNhat} fg={c.ngocChu} />
                </View>
              </View>
            </PressCard>
          ))}
          <InfoNote>Cây lớn theo thời gian thực, kể cả khi em tắt máy. Chín rồi thì cây chờ em về thu, không bao giờ hỏng.</InfoNote>
        </View>
      ) : cs?.ready ? (
        <View style={{ alignItems: 'center', gap: 12 }}>
          <PixelArt art={cropArt(plant.crop, 3, false)} width={96} height={96} />
          <Btn title={`Thu hoạch +${CROPS[plant.crop].yield} Lương Thảo`} icon={Wheat} tone="ngoc" size="lg" full onPress={harvest} />
          {full && <InfoNote>Kho Bí Mật đang đầy. Nâng cấp kho ở Điền Trang để chứa thêm Lương Thảo.</InfoNote>}
        </View>
      ) : (
        cs && (
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <PixelArt art={cropArt(plant.crop, cs.stage, false)} width={72} height={72} />
              <View style={{ flex: 1, gap: 6 }}>
                <Txt f="semibold">{['Mới gieo hạt', 'Đã nảy mầm', 'Đang lớn nhanh'][cs.stage]}</Txt>
                <Bar value={cs.total - cs.left} max={cs.total} fill={c.moc} label="Thời gian lớn của cây" />
                <Txt size={13} color={c.muc2}>
                  Còn {fmtClock(cs.left / 1000)} nữa là chín
                </Txt>
              </View>
            </View>
            {!plant.boost && <Btn title="Bón phân tri thức: trả lời đúng 1 câu để cây chín ngay" icon={Sprout} tone="dong" full onPress={() => setQuiz(true)} />}
            <InfoNote>Kiến thức là vũ khí – và cũng là phân bón! Mỗi lần gieo được bón một lần.</InfoNote>
          </View>
        )
      )}
    </InlineSheet>
  );
};

// ---------------------------------------------------------------------- nhật ký hành trình
const ControlsHelp: React.FC = () => {
  const { c } = useTheme();
  const rows: Array<[IconType, string]> = [
    [Footprints, 'Đi lại: phím mũi tên hoặc W A S D, nút điều hướng, hoặc chạm vào chỗ muốn đến (chạm vào người thì tự đi tới nói chuyện).'],
    [MessageCircle, 'Nói chuyện, đọc bảng, gieo hạt: quay mặt vào rồi bấm phím Space / Enter hoặc nút tròn.'],
    [Compass, 'Dấu ! vàng là việc chính đang chờ, dấu ba chấm xanh là việc phụ có thưởng, dấu ! đỏ là thám báo đã thấy em. Nút Chỉ đường tự dẫn em đi.'],
    [Stamp, 'XP và Ấn Tín chỉ được cộng khi trả lời đúng (server chấm). Lương Thảo, Quân Lực và thẻ chiêu mộ dùng ở Điền Trang, Doanh Trại.'],
    [BookOpen, 'Nhân vật trong Hành Trình là người hư cấu kể lại chuyện xưa; chuyện xưa lấy từ thẻ Sử Ký. Phím J mở nhật ký.'],
  ];
  return (
    <View style={{ gap: 10, alignSelf: 'stretch' }}>
      {rows.map(([Icon, text]) => (
        <View key={text} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: c.giay2, alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={18} color={c.muc2} />
          </View>
          <Txt size={14} style={{ flex: 1 }}>
            {text}
          </Txt>
        </View>
      ))}
    </View>
  );
};

const JournalSheet: React.FC<{
  mapId: WorldMapId;
  objects: WorldObjectDef[];
  plots: PlotSpot[];
  onClose: () => void;
  onGo: (t: Target) => void;
  onTravel: (m: WorldMapId) => void;
}> = ({ mapId, objects, plots, onClose, onGo, onTravel }) => {
  const { state } = useGame();
  const { c } = useTheme();
  const world = state.world;
  const [tab, setTab] = useState<'quests' | 'here' | 'maps' | 'help'>('quests');
  const now = Date.now();
  const doneCount = WORLD_QUESTS.filter((q) => questProgress(world, q) >= q.steps.length).length;
  return (
    <InlineSheet
      open
      onClose={onClose}
      wide
      title="Nhật ký hành trình"
      subtitle={`${doneCount}/${WORLD_QUESTS.length} nhiệm vụ chính · đang ở ${WORLD_MAP_BY_ID[mapId].name}`}
      icon={
        <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: c.dongNhat, borderWidth: 2, borderColor: c.vien, alignItems: 'center', justifyContent: 'center' }}>
          <MapIcon size={28} color={c.dongChu} />
        </View>
      }
    >
      <Segmented
        label="Mục nhật ký"
        options={[
          { value: 'quests' as const, label: 'Nhiệm vụ' },
          { value: 'here' as const, label: 'Quanh đây' },
          { value: 'maps' as const, label: 'Vùng đất' },
          { value: 'help' as const, label: 'Cách chơi' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'quests' &&
        WORLD_QUESTS.map((q) => {
          const n = questProgress(world, q);
          const unlocked = mapUnlocked(world, q.map);
          const doneQ = n >= q.steps.length;
          return (
            <Card key={q.id} flat pad={14} style={{ gap: 8, opacity: unlocked ? 1 : 0.65 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Txt f="display" size={17} style={{ flex: 1 }}>
                  {q.title}
                </Txt>
                <Chip text={doneQ ? 'Đã xong' : unlocked ? `${n}/${q.steps.length}` : 'Chưa mở'} icon={doneQ ? Check : unlocked ? undefined : Lock} bg={doneQ ? c.ngocNhat : c.giay2} fg={doneQ ? c.ngocChu : c.muc2} />
              </View>
              <Txt size={13} color={c.muc2}>
                {WORLD_MAP_BY_ID[q.map].name} · {WORLD_MAP_BY_ID[q.map].era}
              </Txt>
              {unlocked ? (
                q.steps.map((s, i) => (
                  <View key={`${q.id}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: i < n ? c.ngoc : i === n ? c.dong : c.giay2 }}>
                      {i < n ? (
                        <Check size={14} color="#ffffff" />
                      ) : (
                        <Txt f="bold" size={11} color={i === n ? '#1c1917' : c.muc3}>
                          {i + 1}
                        </Txt>
                      )}
                    </View>
                    <Txt size={14} f={i === n ? 'bold' : 'body'} color={i <= n ? c.muc : c.muc3} style={{ flex: 1 }}>
                      {s.text}
                    </Txt>
                  </View>
                ))
              ) : (
                <Txt size={13}>Hoàn thành nhiệm vụ của vùng trước để mở.</Txt>
              )}
              {doneQ && <RewardRow r={q.reward} xp={false} />}
            </Card>
          );
        })}
      {tab === 'here' && (
        <View style={{ gap: 8 }}>
          {objects.map((o) => {
            const st = stepFor(world, mapId, o);
            const status = st
              ? { text: 'Việc chính', bg: c.dongNhat, fg: c.dongChu }
              : o.lesson
                ? sideDone(world, o)
                  ? { text: 'Đã xong', bg: c.ngocNhat, fg: c.ngocChu }
                  : { text: 'Việc phụ', bg: c.thuyNhat, fg: c.thuyChu }
                : o.kind === 'portal'
                  ? portalOpen(world, o)
                    ? { text: 'Đường đi', bg: c.giay2, fg: c.muc2 }
                    : { text: 'Chưa mở', bg: c.giay2, fg: c.muc2 }
                  : null;
            return (
              <View key={o.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52 }}>
                <Portrait obj={o} size={44} />
                <View style={{ flex: 1 }}>
                  <Txt f="semibold" size={14} numberOfLines={1}>
                    {o.name}
                  </Txt>
                  {o.role ? (
                    <Txt size={12} color={c.muc2} numberOfLines={1}>
                      {o.role}
                    </Txt>
                  ) : null}
                </View>
                {status && <Chip text={status.text} bg={status.bg} fg={status.fg} />}
                <Btn icon={MapPin} label={`Đi tới ${o.name}`} tone="giay" size="sm" onPress={() => onGo(o)} />
              </View>
            );
          })}
          {plots.length > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52 }}>
              <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: c.thoNhat, borderWidth: 2, borderColor: c.vien, alignItems: 'center', justifyContent: 'center' }}>
                <Sprout size={22} color={c.mocChu} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt f="semibold" size={14}>
                  Luống đất nhà em
                </Txt>
                <Txt size={12} color={c.muc2}>
                  {plots.filter((p) => world.plots[p.id]).length}/{plots.length} luống đang trồng · {plots.filter((p) => world.plots[p.id] && cropState(world.plots[p.id], now).ready).length} luống đã chín
                </Txt>
              </View>
              <Btn icon={MapPin} label="Đi tới luống đất" tone="giay" size="sm" onPress={() => onGo(plots.find((p) => world.plots[p.id] && cropState(world.plots[p.id], now).ready) ?? plots[0])} />
            </View>
          )}
        </View>
      )}
      {tab === 'maps' &&
        WORLD_MAPS.map((m) => {
          const unlocked = mapUnlocked(world, m.id);
          const here = m.id === mapId;
          const thumbH = Math.round((84 * m.rows.length) / m.rows[0].length);
          return (
            <Card key={m.id} flat pad={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, opacity: unlocked ? 1 : 0.6 }}>
              <View style={{ width: 84, height: thumbH, borderRadius: 10, overflow: 'hidden', borderWidth: 2, borderColor: c.vien }}>
                <PixelArt art={worldMapArt(m, false).ground} width={80} height={thumbH - 4} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt f="display" size={16}>
                  {m.name}
                </Txt>
                <Txt size={13} color={c.muc2}>
                  {m.era}
                  {here ? ' · em đang ở đây' : ''}
                </Txt>
              </View>
              {!unlocked ? (
                <Chip text="Chưa mở" icon={Lock} bg={c.giay2} fg={c.muc2} />
              ) : here ? (
                <Chip text="Đang ở" icon={MapPin} bg={c.ngocNhat} fg={c.ngocChu} />
              ) : (
                <Btn title="Đến đây" icon={Footprints} tone="ngoc" size="sm" onPress={() => onTravel(m.id)} />
              )}
            </Card>
          );
        })}
      {tab === 'help' && <ControlsHelp />}
    </InlineSheet>
  );
};

const IntroSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <InlineSheet open onClose={onClose} title="Hành Trình Đông A" subtitle="Phiêu lưu 2D qua ba lần kháng chiến chống Mông – Nguyên">
    <View style={{ alignItems: 'center', gap: 12 }}>
      <Mascot size={110} mood="excited" accessory="conical" bob />
      <Txt size={16} center>
        Em sẽ đi qua Làng Đông A (1258), Bến Bình Than (1282 – 1285) và cửa sông Bạch Đằng (1288). Gặp người dân để nghe chuyện xưa, trả lời đúng để giúp họ – kiến thức là vũ khí!
      </Txt>
      <ControlsHelp />
      <Btn title="Bắt đầu phiêu lưu" iconRight={ChevronRight} size="lg" onPress={onClose} />
    </View>
  </InlineSheet>
);

const RegionSheet: React.FC<{ map: WorldMapId; onClose: () => void }> = ({ map, onClose }) => {
  const m = WORLD_MAP_BY_ID[map];
  return (
    <InlineSheet open onClose={onClose} title={m.name} subtitle={`Vùng đất mới · ${m.era}`}>
      <View style={{ alignItems: 'center', gap: 12 }}>
        <Mascot size={100} mood="happy" accessory="helmet" bob />
        <Txt size={16} center>
          {m.intro}
        </Txt>
        <Btn title="Khám phá" iconRight={ChevronRight} tone="ngoc" size="lg" onPress={onClose} />
      </View>
    </InlineSheet>
  );
};

const DoneSheet: React.FC<{ questId: string; onClose: () => void }> = ({ questId, onClose }) => {
  const q = QUEST_BY_ID[questId];
  const final = questId === WORLD_QUESTS[WORLD_QUESTS.length - 1].id;
  return (
    <InlineSheet open onClose={onClose} title={final ? 'Hoàn thành Hành Trình!' : 'Hoàn thành nhiệm vụ!'} subtitle={q.title}>
      <View style={{ alignItems: 'center', gap: 12 }}>
        <Mascot size={120} mood="love" accessory="crown" bob />
        <Txt f="displayHeavy" size={20} center accessibilityRole="header">
          {q.doneText}
        </Txt>
        <RewardRow r={q.reward} xp={false} />
        {final && <InfoNote>Em có thể quay lại bất cứ vùng nào để thu hoạch, nhặt cuộn sử còn sót và ôn lại chuyện xưa.</InfoNote>}
        <Btn title="Tuyệt vời!" icon={Crown} tone="dong" size="lg" onPress={onClose} />
      </View>
    </InlineSheet>
  );
};
