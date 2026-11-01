/**
 * Bản đồ nhiệm vụ rẽ nhánh (Sprint 7, HK.GV.022, 025, HK.HS.019–022): các nút đặt theo phần trăm trên khung bản đồ, nối bằng đường có hướng.
 * Dùng chung cho trình thiết kế của giáo viên (kéo nút, nối đường), xem trước như học sinh và bản đồ của học sinh (chỉ xem).
 * Nút chưa có vị trí được tự xếp theo tầng (nút nào cũng đứng sau mọi nút nối vào nó).
 */
import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, View } from 'react-native';
import { BookOpen, Castle, Check, CircleHelp, Crown, Dumbbell, Flag, Gift, Headphones, Lock, Map as MapIcon, PawPrint, ScrollText, Ship, Star, Swords, Trophy } from 'lucide-react-native';
import { Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { IconType } from '@/types/game';
import type { NodeIcon, NodeState } from '@/types/learning';

const ICON: Record<NodeIcon, IconType> = { book: BookOpen, quiz: CircleHelp, sword: Swords, scroll: ScrollText, flag: Flag, star: Star, castle: Castle, ship: Ship, horse: PawPrint, map: MapIcon, crown: Crown, headphones: Headphones, dumbbell: Dumbbell, chest: Gift, trophy: Trophy };
const SIZE = 56;

export interface GraphNode { id: number; title: string; icon: NodeIcon | null; pos_x: number | null; pos_y: number | null; state?: NodeState; stars?: number }
export interface GraphEdge { from: number; to: number }

/** Chiều cao khung theo số nút: cùng công thức ở trình thiết kế và bản đồ học sinh nên vị trí phần trăm trùng khớp */
export const graphHeight = (count: number): number => Math.min(900, Math.max(400, 74 * count));

/** Tự xếp theo tầng: tầng = đường dài nhất từ nút xuất phát; không có đường nối thì xếp zích zắc theo thứ tự nút */
export function autoLayout(nodes: GraphNode[], edges: GraphEdge[]): Record<number, { x: number; y: number }> {
  const out: Record<number, { x: number; y: number }> = {};
  if (!nodes.length) return out;
  const depth = new Map<number, number>(nodes.map((n) => [n.id, 0]));
  if (edges.length) {
    for (let pass = 0; pass < nodes.length; pass++) {
      let changed = false;
      for (const e of edges) { const d = (depth.get(e.from) ?? 0) + 1; if (d > (depth.get(e.to) ?? 0)) { depth.set(e.to, d); changed = true; } }
      if (!changed) break;
    }
  } else nodes.forEach((n, i) => depth.set(n.id, i));
  const layers = Math.max(...depth.values()) + 1;
  const byLayer = new Map<number, GraphNode[]>();
  for (const n of nodes) byLayer.set(depth.get(n.id)!, [...(byLayer.get(depth.get(n.id)!) ?? []), n]);
  const zig = [50, 28, 50, 72];
  for (const [layer, list] of byLayer) {
    const y = layers === 1 ? 50 : 8 + (layer * 84) / (layers - 1);
    list.forEach((n, j) => { out[n.id] = { x: edges.length ? ((j + 1) * 100) / (list.length + 1) : zig[layer % zig.length], y }; });
  }
  return out;
}

const clamp = (v: number) => Math.max(6, Math.min(94, v));

const Line: React.FC<{ x1: number; y1: number; x2: number; y2: number; color: string }> = ({ x1, y1, x2, y2, color }) => {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < SIZE) return null;
  const ux = dx / len, uy = dy / len, r = SIZE / 2 + 2;
  const sx = x1 + ux * r, sy = y1 + uy * r, ex = x2 - ux * r, ey = y2 - uy * r;
  const length = Math.hypot(ex - sx, ey - sy);
  const angle = Math.atan2(ey - sy, ex - sx);
  return (
    <>
      <View pointerEvents="none" style={{ position: 'absolute', left: sx, top: sy - 2, width: length, height: 4, borderRadius: 2, backgroundColor: color, transformOrigin: '0% 50%', transform: [{ rotate: `${angle}rad` }] }} />
      <View pointerEvents="none" style={{ position: 'absolute', left: ex - 6, top: ey - 6, width: 12, height: 12, backgroundColor: color, transform: [{ rotate: '45deg' }] }} />
    </>
  );
};

const GraphNodeView: React.FC<{
  node: GraphNode; x: number; y: number; width: number; height: number; editable: boolean; selected: boolean; current: boolean;
  onPress?: (id: number) => void; onMove?: (id: number, x: number, y: number) => void;
}> = ({ node, x, y, width, height, editable, selected, current, onPress, onMove }) => {
  const { c } = useTheme();
  const Icon = ICON[node.icon ?? 'star'] ?? Star;
  const done = node.state === 'done', locked = node.state === 'locked';
  const live = useRef({ x, y, width, height, onMove, onPress });
  live.current = { x, y, width, height, onMove, onPress };
  const start = useRef({ x: 0, y: 0 });
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    // Vị trí bắt đầu quy về phần trăm khung bản đồ (x, y của nút là điểm ảnh)
    onPanResponderGrant: () => { start.current = { x: (live.current.x / live.current.width) * 100, y: (live.current.y / live.current.height) * 100 }; },
    onPanResponderMove: (_, g) => live.current.onMove?.(node.id, clamp(start.current.x + (g.dx / live.current.width) * 100), clamp(start.current.y + (g.dy / live.current.height) * 100)),
    onPanResponderRelease: (_, g) => { if (Math.abs(g.dx) < 4 && Math.abs(g.dy) < 4) live.current.onPress?.(node.id); },
    onPanResponderTerminationRequest: () => false,
  }), [node.id]);
  const bg = node.state === undefined ? c.dong : done ? c.ngoc : locked ? c.vien : c.dong;
  const body = (
    <View style={{ width: SIZE, height: SIZE, borderRadius: SIZE / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: bg, borderWidth: selected || current ? 4 : 0, borderColor: selected ? c.son : c.vang, borderBottomWidth: selected || current ? 4 : 5 }}>
      {locked ? <Lock size={22} color={c.muc3} /> : <Icon size={26} color="#ffffff" />}
      {done ? <View style={{ position: 'absolute', right: -3, top: -3, width: 22, height: 22, borderRadius: 11, backgroundColor: c.the, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.ngoc }}><Check size={12} color={c.ngocChu} /></View> : null}
    </View>
  );
  const label = (
    <Txt f="semibold" size={12} center numberOfLines={2} color={locked ? c.muc3 : c.muc} style={{ width: 112, marginTop: 4 }}>{node.title}</Txt>
  );
  const box = { position: 'absolute' as const, left: x - 56, top: y - SIZE / 2, width: 112, alignItems: 'center' as const };
  const a11y = `${node.title}${node.state === 'done' ? ', đã hoàn thành' : node.state === 'locked' ? ', chưa mở' : node.state === 'available' ? ', đang mở' : ''}`;
  if (editable) return <View {...responder.panHandlers} accessible accessibilityRole="button" accessibilityLabel={a11y} style={[box, { cursor: 'grab' as never }]}>{body}{label}</View>;
  return <Pressable accessibilityRole="button" accessibilityLabel={a11y} onPress={() => onPress?.(node.id)} style={box}>{body}{label}</Pressable>;
};

export const MapGraph: React.FC<{
  nodes: GraphNode[]; edges: GraphEdge[]; editable?: boolean; selected?: number | null; currentId?: number | null; background?: string;
  /** Vị trí đang chỉnh (trình thiết kế); mặc định lấy pos_x/pos_y của nút hoặc tự xếp */
  positions?: Record<number, { x: number; y: number }>; onPress?: (id: number) => void; onMove?: (id: number, x: number, y: number) => void;
}> = ({ nodes, edges, editable = false, selected = null, currentId = null, positions, onPress, onMove }) => {
  const { c } = useTheme();
  const [width, setWidth] = useState(0);
  const height = graphHeight(nodes.length);
  const auto = useMemo(() => autoLayout(nodes, edges), [nodes, edges]);
  const at = (n: GraphNode) => positions?.[n.id] ?? (n.pos_x !== null && n.pos_y !== null ? { x: n.pos_x, y: n.pos_y } : auto[n.id]);
  const point = (n: GraphNode) => { const p = at(n); return { x: (p.x / 100) * width, y: (p.y / 100) * height }; };
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return (
    <View accessibilityLabel="Bản đồ nhiệm vụ rẽ nhánh" onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ width: '100%', height, borderRadius: 16, borderWidth: 2, borderColor: c.vien, backgroundColor: c.giay2, overflow: 'hidden' }}>
      {width > 0 ? (
        <>
          {edges.map((e) => {
            const a = byId.get(e.from), b = byId.get(e.to);
            if (!a || !b) return null;
            const p = point(a), q = point(b);
            const color = a.state === 'done' ? c.ngoc : c.muc3;
            return <Line key={`${e.from}-${e.to}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} color={color} />;
          })}
          {nodes.map((n) => { const p = point(n); return <GraphNodeView key={n.id} node={n} x={p.x} y={p.y} width={width} height={height} editable={editable} selected={selected === n.id} current={currentId === n.id} onPress={onPress} onMove={onMove} />; })}
        </>
      ) : null}
    </View>
  );
};
