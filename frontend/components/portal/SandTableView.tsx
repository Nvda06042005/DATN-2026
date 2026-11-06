/**
 * Xem trận đánh trên Sa bàn (HK.HS.137, HK.GV.084): bản vẽ 2D nhẹ chạy được trên mọi máy và Sa bàn 3D (Three.js) cho máy đủ mạnh, dùng chung dữ liệu cảnh.
 * Có điều khiển phát lại hướng tiến quân / rút quân của hai bên theo từng bước (phát tự động, bước tới – lui, tốc độ), lời dẫn mỗi bước và chú giải.
 * Cảnh chỉ là sơ đồ minh họa, không phải bản đồ thật; lời dẫn đầy đủ nằm dưới dạng văn bản nên người dùng trình đọc màn hình vẫn nắm được diễn biến.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Polygon, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { ChevronLeft, ChevronRight, Cuboid, Map as MapIcon, Pause, Play, RotateCcw } from 'lucide-react-native';
import { SandCanvas } from '@/components/portal/SandCanvas';
import { Btn, Card, Chip, InfoNote, Segmented, Txt } from '@/components/ui';
import { FONT } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MODE_TEXT, positionsAt, SIDE_TEXT, type Pt, type SandMode, type SandScene, type SandtableDetail } from '@/types/sandtable';

/** Neo chữ vào trong khi nhãn nằm sát mép bản vẽ để không bị cắt */
const anchorFor = (x: number, w: number): 'start' | 'middle' | 'end' => (x > w * 0.8 ? 'end' : x < w * 0.2 ? 'start' : 'middle');
const SIDE_FILL = { tran: '#e0a526', nguyen: '#3f6fb5' } as const;
const MODE_STROKE: Record<SandMode, string> = { advance: '#16a34a', retreat: '#dc2626', hold: '#64748b' };

/** Mũi tên từ a tới b (đoạn thẳng + đầu tam giác) */
const Arrow: React.FC<{ from: Pt; to: Pt; color: string; opacity: number }> = ({ from, to, color, opacity }) => {
  const dx = to[0] - from[0], dy = to[1] - from[1];
  const len = Math.hypot(dx, dy);
  if (len < 1) return null;
  const ux = dx / len, uy = dy / len;
  const tip = to, base: Pt = [to[0] - ux * 3, to[1] - uy * 3];
  const left: Pt = [base[0] - uy * 1.5, base[1] + ux * 1.5], right: Pt = [base[0] + uy * 1.5, base[1] - ux * 1.5];
  return (
    <G opacity={opacity}>
      <Line x1={from[0]} y1={from[1]} x2={base[0]} y2={base[1]} stroke={color} strokeWidth={0.9} strokeDasharray="2 1.2" />
      <Polygon points={`${tip[0]},${tip[1]} ${left[0]},${left[1]} ${right[0]},${right[1]}`} fill={color} />
    </G>
  );
};

/** Bản vẽ nhìn từ trên xuống: nền, biển, sông, đồi, địa điểm, đội quân và mũi tên tiến – rút */
export const SandMap2D: React.FC<{ scene: SandScene; step: number }> = ({ scene, step }) => {
  const [w, h] = scene.size;
  const now = positionsAt(scene, step);
  const trails: Array<{ from: Pt; to: Pt; mode: SandMode; current: boolean }> = [];
  let prev = positionsAt(scene, -1);
  for (let i = 0; i <= step && i < scene.steps.length; i++) {
    for (const m of scene.steps[i].moves) trails.push({ from: prev[m.army].pos, to: m.to, mode: m.mode, current: i === step });
    prev = positionsAt(scene, i);
  }
  return (
    <View style={{ width: '100%', aspectRatio: w / h, borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: '#cbd5e1' }} accessibilityRole="image" accessibilityLabel="Bản vẽ 2D của trận đánh; xem lời dẫn từng bước ở bên dưới">
      <Svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
        <Rect x={0} y={0} width={w} height={h} fill="#cfe3b4" />
        {scene.sea.map((s, i) => <Rect key={`sea${i}`} x={s.x} y={s.y} width={s.w} height={s.h} fill="#8ec5ee" />)}
        {scene.rivers.map((r, i) => <Polyline key={`river${i}`} points={r.points.map((p) => p.join(',')).join(' ')} fill="none" stroke="#6fb4e8" strokeWidth={r.width} strokeLinecap="round" strokeLinejoin="round" />)}
        {scene.hills.map((hl, i) => (
          <G key={`hill${i}`}>
            <Circle cx={hl.x} cy={hl.y} r={hl.r} fill="#a39671" opacity={0.4} />
            <Circle cx={hl.x} cy={hl.y} r={hl.r * 0.55} fill="#8a7a52" opacity={0.55} />
            {hl.name ? <SvgText x={hl.x} y={hl.y + 1} fontSize={2.4} fontFamily={FONT.semibold} fill="#3f3a2a" textAnchor={anchorFor(hl.x, w)}>{hl.name}</SvgText> : null}
          </G>
        ))}
        {scene.markers.map((m) => (
          <G key={m.id}>
            {m.kind === 'stakes' ? <Line x1={m.x - 5} y1={m.y} x2={m.x + 5} y2={m.y} stroke="#5b3a1e" strokeWidth={1.4} strokeDasharray="0.8 1.1" /> : <Rect x={m.x - 1.6} y={m.y - 1.6} width={3.2} height={3.2} fill={m.kind === 'city' ? '#8c2f2f' : '#6b4423'} stroke="#fff" strokeWidth={0.3} />}
            <SvgText x={m.x} y={m.y - 2.6} fontSize={2.6} fontFamily={FONT.bold} fill="#1f2937" textAnchor={anchorFor(m.x, w)}>{m.label}</SvgText>
          </G>
        ))}
        {trails.map((t, i) => <Arrow key={`trail${i}`} from={t.from} to={t.to} color={MODE_STROKE[t.mode]} opacity={t.current ? 0.95 : 0.3} />)}
        {scene.armies.map((a) => (
          <G key={a.id}>
            <Circle cx={now[a.id].pos[0]} cy={now[a.id].pos[1]} r={3} fill={SIDE_FILL[a.side]} stroke="#ffffff" strokeWidth={0.5} />
            <SvgText x={now[a.id].pos[0]} y={now[a.id].pos[1] + 6} fontSize={2.5} fontFamily={FONT.bold} fill="#111827" textAnchor={anchorFor(now[a.id].pos[0], w)}>{a.label}</SvgText>
          </G>
        ))}
      </Svg>
    </View>
  );
};

export const SandTableView: React.FC<{ detail: SandtableDetail; start3d?: boolean; presenter?: boolean }> = ({ detail, start3d = false, presenter = false }) => {
  const { c } = useTheme();
  const scene = detail.sandtable;
  const [step, setStep] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [want3d, setWant3d] = useState(start3d);
  const [failed, setFailed] = useState<string | null>(null);
  const last = scene.steps.length - 1;
  const cur = step >= 0 ? scene.steps[step] : null;
  const armies = useMemo(() => Object.fromEntries(scene.armies.map((a) => [a.id, a])), [scene]);
  const show3d = want3d && !failed;

  useEffect(() => {
    if (!playing) return undefined;
    const timer = setTimeout(() => {
      if (step >= last) setPlaying(false);
      else setStep((s) => s + 1);
    }, step < 0 ? 900 : 3400 / speed);
    return () => clearTimeout(timer);
  }, [playing, step, last, speed]);

  const toggle = () => {
    if (!playing && step >= last) setStep(-1);
    setPlaying((p) => !p);
  };

  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 4 }}>
        <Txt f="displayHeavy" size={presenter ? 30 : 22} accessibilityRole="header">{detail.stage.battle_name}</Txt>
        <Txt size={presenter ? 16 : 14} color={c.muc2}>{[detail.stage.year ? `Năm ${detail.stage.year}` : null, detail.stage.date_text, detail.stage.objective].filter(Boolean).join(' · ')}</Txt>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Btn icon={show3d ? MapIcon : Cuboid} title={show3d ? 'Chuyển sang bản vẽ 2D nhẹ' : 'Bật Sa bàn 3D'} tone={show3d ? 'giay' : 'son'} size="sm" onPress={() => { setFailed(null); setWant3d(!show3d); }} testID="sand-toggle" />
        {failed ? <Chip text={`Không bật được 3D: ${failed}`} bg={c.vangNhat} fg={c.vangChu} /> : null}
        <Chip text="Quân Trần" bg={c.vangNhat} fg={c.vangChu} />
        <Chip text="Quân Nguyên – Mông" bg={c.thuyNhat} fg={c.thuyChu} />
        <Chip text="Mũi tên xanh: tiến quân" bg={c.ngocNhat} fg={c.ngocChu} />
        <Chip text="Mũi tên đỏ: rút quân" bg={c.sonNhat} fg={c.sonChu} />
      </View>
      {show3d ? <SandCanvas scene={scene} step={step} speed={speed} height={presenter ? 560 : 400} onFail={(r) => setFailed(r)} /> : <SandMap2D scene={scene} step={step} />}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Btn icon={RotateCcw} label="Về lúc xuất phát" tone="giay" size="sm" onPress={() => { setPlaying(false); setStep(-1); }} testID="sand-restart" />
        <Btn icon={ChevronLeft} label="Bước trước" tone="giay" size="sm" disabled={step < 0} onPress={() => { setPlaying(false); setStep((s) => Math.max(-1, s - 1)); }} testID="sand-prev" />
        <Btn icon={playing ? Pause : Play} title={playing ? 'Tạm dừng' : step >= last ? 'Phát lại' : 'Phát diễn biến'} tone="ngoc" size="sm" onPress={toggle} testID="sand-play" />
        <Btn icon={ChevronRight} label="Bước sau" tone="giay" size="sm" disabled={step >= last} onPress={() => { setPlaying(false); setStep((s) => Math.min(last, s + 1)); }} testID="sand-next" />
        <View style={{ minWidth: 190 }}><Segmented<number> label="Tốc độ phát" value={speed} onChange={setSpeed} options={[{ value: 0.5, label: '0,5×' }, { value: 1, label: '1×' }, { value: 2, label: '2×' }]} /></View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn title="Xuất phát" tone={step === -1 ? 'son' : 'giay'} size="sm" onPress={() => { setPlaying(false); setStep(-1); }} />
        {scene.steps.map((st, i) => <Btn key={i} title={`${i + 1}. ${st.label}`} tone={step === i ? 'son' : 'giay'} size="sm" onPress={() => { setPlaying(false); setStep(i); }} testID={`sand-step-${i}`} />)}
      </View>
      <Card flat pad={presenter ? 18 : 14} style={{ gap: 6 }} testID="sand-narration">
        <Txt f="bold" size={presenter ? 22 : 17} accessibilityLiveRegion="polite">{cur ? `Bước ${step + 1}/${scene.steps.length}: ${cur.label}` : 'Lúc xuất phát'}</Txt>
        <Txt size={presenter ? 18 : 15}>{cur ? cur.text : 'Hai bên đứng ở vị trí xuất phát. Bấm “Phát diễn biến” hoặc “Bước sau” để xem hướng tiến quân và rút quân.'}</Txt>
        {cur?.moves.map((m, i) => (
          <Txt key={i} size={presenter ? 16 : 14} color={m.mode === 'advance' ? c.ngocChu : m.mode === 'retreat' ? c.sonChu : c.muc2}>• {armies[m.army]?.label ?? m.army} ({SIDE_TEXT[armies[m.army]?.side ?? 'tran']}): {MODE_TEXT[m.mode]}</Txt>
        ))}
      </Card>
      <InfoNote>{scene.note ?? 'Sơ đồ minh họa, không theo tỷ lệ.'}</InfoNote>
    </View>
  );
};
