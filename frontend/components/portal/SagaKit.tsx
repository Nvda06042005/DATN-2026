/**
 * Bộ thành phần chung của trang học sinh (Hành trình Đông A): bảng màu trò chơi, nút khối, nền trời, tia nắng, pháo giấy, linh vật Tiểu Tướng,
 * chân dung cách điệu của các nhân vật (tranh minh họa tự vẽ, không phải chân dung lịch sử), huy chương, tranh ba cuộc kháng chiến và ảnh bản đồ.
 * Chữ dùng Manrope / Newsreader qua `Txt`; mọi nút có vùng chạm ≥ 44pt và nhãn trợ năng.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Linking, Platform, Pressable, StyleSheet, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Ellipse, G, Path, Polygon, Rect } from 'react-native-svg';
import {
  Anchor, BookOpen, Check, ChevronLeft, Crown, Droplets, ExternalLink, Fence, Flag, Flame, Footprints, House, Info, Landmark, Lock, Mail, Map as MapIcon, Moon, Play, RotateCcw, Sailboat, ScrollText, Shield, Ship, Star, Sun,
  Swords, Target, Tent, Users, Warehouse,
} from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import type { Session } from '@/components/auth';
import { Btn, Txt } from '@/components/ui';
import { usePopIn, useReduceMotion } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';
import { play } from '@/lib/saga-sound';
import type { IconType } from '@/types/game';
import type { Completion, SagaHome, SagaMapInfo, SourceRef, StageState } from '@/types/saga';

// ---------------------------------------------------------------------- màu
export const SG = {
  green: '#34b354', greenEdge: '#22863c', orange: '#ff9a1f', orangeEdge: '#d9730d', red: '#ef4040', redEdge: '#bf2a2a', purple: '#a06af0', purpleEdge: '#7a45cf',
  blue: '#2f9bea', blueEdge: '#1c77bf', yellow: '#ffc93c', yellowEdge: '#e0a312', navy: '#263a66', navyEdge: '#17264a', white: '#ffffff', onYellow: '#3b2a00',
  quizA: '#f4583f', quizB: '#2b82f0', quizC: '#f9a602', quizD: '#9f5fe6',
} as const;
interface SagaPalette { dark: boolean; ink: string; sub: string; card: string; card2: string; line: string; sky: readonly [string, string]; hill: string; hill2: string; cloud: string; scrim: string }
const LIGHT: SagaPalette = { dark: false, ink: '#1e2a4a', sub: '#5b6785', card: '#ffffff', card2: '#f3f7ff', line: '#dfe7f5', sky: ['#7ec8fb', '#cfeeff'], hill: '#8fd46b', hill2: '#7cc65a', cloud: '#ffffff', scrim: 'rgba(22, 37, 63, 0.6)' };
const DARK: SagaPalette = { dark: true, ink: '#f2f5ff', sub: '#aab6d3', card: '#1b2745', card2: '#22305a', line: '#2f3f68', sky: ['#0f1d3a', '#213a6b'], hill: '#2f6b3a', hill2: '#265a31', cloud: '#3a4f7e', scrim: 'rgba(5, 10, 24, 0.72)' };
export type SagaColors = SagaPalette;
/** Màu bề mặt theo chế độ sáng / tối của tài khoản; các màu nhấn của trò chơi giữ nguyên ở cả hai chế độ */
export const useSaga = (): SagaColors => (useTheme().dark ? DARK : LIGHT);

export const TONE: Record<number, { main: string; edge: string; soft: string; text: string; label: string }> = {
  1: { main: SG.green, edge: SG.greenEdge, soft: '#e2f7e6', text: '#156b2c', label: 'LẦN I' },
  2: { main: SG.orange, edge: SG.orangeEdge, soft: '#fff0db', text: '#8f4a00', label: 'LẦN II' },
  3: { main: SG.red, edge: SG.redEdge, soft: '#ffe3e3', text: '#a31f1f', label: 'LẦN III' },
};
export const RARITY: Record<string, { label: string; main: string; edge: string; stars: number }> = {
  common: { label: 'THƯỜNG', main: '#8a97b3', edge: '#65718c', stars: 1 }, rare: { label: 'HIẾM', main: '#2f8bea', edge: '#1c68bf', stars: 2 },
  epic: { label: 'SỬ THI', main: '#9a62e8', edge: '#7341c4', stars: 3 }, legendary: { label: 'HUYỀN THOẠI', main: '#ffb81f', edge: '#d99306', stars: 5 },
};

// ---------------------------------------------------------------------- ảnh bản đồ (bản gốc của Wikipedia tiếng Việt, tác giả Lưu Ly, phạm vi công cộng)
const MAP_FILES: Record<string, ImageSourcePropType> = {
  'ban-do-khang-chien-1': require('@/assets/ban-do-khang-chien-1.webp'),
  'ban-do-khang-chien-2': require('@/assets/ban-do-khang-chien-2.webp'),
  'ban-do-khang-chien-3': require('@/assets/ban-do-khang-chien-3.webp'),
};
/** Ảnh nền bản đồ: liên kết do quản trị đặt (nếu có), không thì ảnh có sẵn theo khóa */
export const mapSource = (m: Pick<SagaMapInfo, 'image_key' | 'image_url'>): ImageSourcePropType => (m.image_url ? { uri: m.image_url } : MAP_FILES[m.image_key] ?? MAP_FILES['ban-do-khang-chien-1']);

// ---------------------------------------------------------------------- tải dữ liệu
export function useLoad<T>(session: Session, fetcher: (token: string) => Promise<T>, deps: unknown[]): { data: T | null; error: string | null; loading: boolean; reload: () => void; set: (v: T) => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const fn = useRef(fetcher);
  fn.current = fetcher;
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    fn.current(session.token).then((d) => { if (live) { setData(d); setLoading(false); } }).catch((e) => {
      if (!live) return;
      if ((e as { status?: number }).status === 401) session.expired();
      setError(errorMessage(e, 'Chưa tải được dữ liệu. Thử lại sau ít phút.'));
      setLoading(false);
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.token, tick, ...deps]);
  return { data, error, loading, reload: useCallback(() => setTick((n) => n + 1), []), set: setData };
}

/** Trạng thái đang tải / lỗi (có nút thử lại) dùng chung cho mọi màn */
export const LoadState: React.FC<{ loading: boolean; error: string | null; onRetry: () => void; light?: boolean }> = ({ loading, error, onRetry, light }) => {
  const s = useSaga();
  if (loading) return <View style={{ padding: 40, alignItems: 'center', gap: 10 }}><ActivityIndicator size="large" color={light ? '#ffffff' : SG.blue} /><Txt f="semibold" size={14} color={light ? '#ffffff' : s.sub}>Đang tải…</Txt></View>;
  if (!error) return null;
  return (
    <View style={{ padding: 28, alignItems: 'center', gap: 12 }}>
      <Txt f="bold" size={16} color={light ? '#ffffff' : s.ink} center>{error}</Txt>
      <Btn title="Thử lại" tone="thuy" onPress={onRetry} testID="saga-retry" />
    </View>
  );
};

// ---------------------------------------------------------------------- nút khối và nhãn
export const Chunky: React.FC<{
  bg: string; edge: string; onPress?: () => void; disabled?: boolean; label: string; testID?: string; style?: StyleProp<ViewStyle>; radius?: number; depth?: number; children: React.ReactNode; selected?: boolean; silent?: boolean;
}> = ({ bg, edge, onPress, disabled, label, testID, style, radius = 18, depth = 5, children, selected, silent }) => (
  <Pressable
    testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: Boolean(disabled), selected }} disabled={disabled}
    onPress={() => { if (!silent) play('tap'); onPress?.(); }}
    style={({ pressed }) => [{ minHeight: 44, borderRadius: radius, backgroundColor: edge, paddingBottom: pressed && !disabled ? 1 : depth, marginTop: pressed && !disabled ? depth - 1 : 0, opacity: disabled ? 0.55 : 1 }, style]}
  >
    <View style={{ flex: 1, borderRadius: radius, backgroundColor: bg, justifyContent: 'center' }}>{children}</View>
  </Pressable>
);

export const Pill: React.FC<{ text: string; bg: string; fg?: string; size?: number; style?: StyleProp<ViewStyle>; icon?: IconType }> = ({ text, bg, fg = '#ffffff', size = 13, style, icon: Icon }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: bg, borderRadius: 999, paddingHorizontal: size * 0.85, paddingVertical: size * 0.3 }, style]}>
    {Icon && <Icon size={size + 1} color={fg} strokeWidth={2.6} />}
    <Txt f="heavy" size={size} color={fg} numberOfLines={1}>{text}</Txt>
  </View>
);

/** Nút tròn có biểu tượng của thanh điều hướng (Chiến dịch, Nhập vai, Câu hỏi, Tư liệu, Bộ thẻ) */
export const RoundIcon: React.FC<{ icon: IconType; bg: string; edge: string; size?: number; label: string; caption?: string; active?: boolean; onPress: () => void; testID?: string; dot?: boolean }> = ({ icon: Icon, bg, edge, size = 48, label, caption, active, onPress, testID, dot }) => {
  const s = useSaga();
  return (
    <Pressable testID={testID} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: Boolean(active) }} onPress={() => { play('tap'); onPress(); }} hitSlop={6}
      style={({ pressed }) => ({ alignItems: 'center', gap: 3, minWidth: Math.max(48, size), opacity: pressed ? 0.85 : 1 })}>
      <View style={{ width: size, height: size + 4, borderRadius: size / 2, backgroundColor: edge, borderWidth: active ? 3 : 0, borderColor: SG.yellow }}>
        <View style={{ width: size - (active ? 6 : 0), height: size - (active ? 6 : 0), borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={Math.round(size * 0.5)} color="#ffffff" strokeWidth={2.6} />
        </View>
        {dot && <View style={{ position: 'absolute', top: -2, right: -2, width: 14, height: 14, borderRadius: 7, backgroundColor: SG.red, borderWidth: 2, borderColor: '#ffffff' }} />}
      </View>
      {caption !== undefined && <Txt f={active ? 'heavy' : 'bold'} size={12} color={active ? s.ink : s.sub} numberOfLines={1}>{caption}</Txt>}
    </Pressable>
  );
};

// ---------------------------------------------------------------------- nền
/** Nền trời xanh có mây và đồi cỏ (trang chọn cuộc kháng chiến); chế độ tối thành trời đêm */
export const SkyBg: React.FC<{ hill?: boolean }> = ({ hill = true }) => {
  const s = useSaga();
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      <LinearGradient colors={[s.sky[0], s.sky[1]]} style={StyleSheet.absoluteFill} />
      {[[6, 70, 150], [58, 40, 190], [78, 150, 120], [30, 210, 110]].map(([left, top, w], i) => (
        <View key={i} style={{ position: 'absolute', left: `${left}%`, top, width: w, height: w * 0.3, borderRadius: w, backgroundColor: s.cloud, opacity: s.dark ? 0.5 : 0.92 }}>
          <View style={{ position: 'absolute', left: w * 0.22, top: -w * 0.14, width: w * 0.42, height: w * 0.34, borderRadius: w, backgroundColor: s.cloud }} />
        </View>
      ))}
      {hill && (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 150 }}>
          <Svg width="100%" height="150" viewBox="0 0 1000 150" preserveAspectRatio="none">
            <Path d="M0 70 Q250 0 520 60 T1000 40 V150 H0 Z" fill={s.hill} />
            <Path d="M0 110 Q300 60 600 105 T1000 90 V150 H0 Z" fill={s.hill2} />
          </Svg>
        </View>
      )}
    </View>
  );
};

/** Nền tia nắng xoay quanh tâm (thẻ nhân vật mới, lên cấp) */
export const Sunburst: React.FC<{ color: string; ray: string; size?: number }> = ({ color, ray, size = 1400 }) => (
  <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: color, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }]}>
    <Svg width={size} height={size} viewBox="-100 -100 200 200">
      {Array.from({ length: 12 }, (_, i) => <Polygon key={i} points="0,0 -9,-140 9,-140" fill={ray} transform={`rotate(${i * 30})`} />)}
    </Svg>
  </View>
);

const CONFETTI = ['#ffc93c', '#ef4040', '#34b354', '#2f9bea', '#a06af0', '#ffffff'];
/** Pháo giấy rơi một lượt; tắt khi người dùng chọn giảm chuyển động */
export const Confetti: React.FC<{ count?: number }> = ({ count = 26 }) => {
  const reduce = useReduceMotion();
  const fall = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return;
    const anim = Animated.timing(fall, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: false });
    anim.start();
    return () => anim.stop();
  }, [fall, reduce]);
  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => ({ left: (i * 37 + 11) % 100, delay: ((i * 53) % 40) / 100, color: CONFETTI[i % CONFETTI.length], w: 6 + (i % 3) * 3, rot: (i * 47) % 360 })), [count]);
  if (reduce) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      {pieces.map((p, i) => (
        <Animated.View key={i} style={{ position: 'absolute', left: `${p.left}%`, top: -20, width: p.w, height: p.w * 0.5, borderRadius: 2, backgroundColor: p.color,
          opacity: fall.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
          transform: [{ translateY: fall.interpolate({ inputRange: [0, 1], outputRange: [0, 620 + p.delay * 300] }) }, { rotate: `${p.rot}deg` }] }} />
      ))}
    </View>
  );
};

// ---------------------------------------------------------------------- linh vật Tiểu Tướng
/** Cậu bé tiểu tướng: tóc búi, khăn vàng, áo đỏ viền vàng. `cheer` giơ tay mừng. */
export const TieuTuongArt: React.FC<{ size?: number; cheer?: boolean; bust?: boolean }> = ({ size = 120, cheer = false, bust = false }) => (
  <Svg width={size} height={bust ? size : size * 1.25} viewBox={bust ? '10 4 80 80' : '0 0 100 125'} accessibilityLabel="Tiểu Tướng">
    {!bust && <Ellipse cx="50" cy="120" rx="24" ry="4" fill="#000000" opacity="0.15" />}
    {!bust && <G><Rect x="38" y="100" width="9" height="16" rx="3" fill="#2a2f45" /><Rect x="53" y="100" width="9" height="16" rx="3" fill="#2a2f45" /><Rect x="35" y="112" width="13" height="6" rx="3" fill="#1b1f30" /><Rect x="52" y="112" width="13" height="6" rx="3" fill="#1b1f30" /></G>}
    <Path d="M28 104 Q28 72 50 72 Q72 72 72 104 Z" fill="#d8322f" />
    <Path d="M46 72 L50 96 L54 72 Z" fill="#f6c445" />
    <Rect x="29" y="92" width="42" height="7" rx="3" fill="#2a3a6b" />
    {cheer ? <Path d="M70 80 Q86 66 82 50" stroke="#d8322f" strokeWidth="9" strokeLinecap="round" fill="none" /> : <Path d="M70 80 Q80 88 78 98" stroke="#d8322f" strokeWidth="9" strokeLinecap="round" fill="none" />}
    <Circle cx={cheer ? 82 : 78} cy={cheer ? 48 : 99} r="5" fill="#f9d2b0" />
    <Path d="M30 80 Q20 88 22 98" stroke="#d8322f" strokeWidth="9" strokeLinecap="round" fill="none" />
    <Circle cx="22" cy="99" r="5" fill="#f9d2b0" />
    <Circle cx="50" cy="13" r="8" fill="#1f1a17" />
    <Circle cx="50" cy="46" r="28" fill="#f9d2b0" />
    <Path d="M22 44 Q22 16 50 16 Q78 16 78 44 Q64 30 50 31 Q36 30 22 44 Z" fill="#1f1a17" />
    <Path d="M22 38 Q50 26 78 38 L78 45 Q50 33 22 45 Z" fill="#f6c445" />
    <Path d="M78 40 L92 34 L88 44 L94 50 L80 47 Z" fill="#f6c445" />
    <Circle cx="50" cy="35" r="3.4" fill="#d8322f" />
    <Ellipse cx="39" cy="52" rx="3.6" ry="4.6" fill="#1f1a17" /><Ellipse cx="61" cy="52" rx="3.6" ry="4.6" fill="#1f1a17" />
    <Circle cx="40.2" cy="50.4" r="1.3" fill="#ffffff" /><Circle cx="62.2" cy="50.4" r="1.3" fill="#ffffff" />
    <Circle cx="31" cy="60" r="4.6" fill="#f59b8b" opacity="0.75" /><Circle cx="69" cy="60" r="4.6" fill="#f59b8b" opacity="0.75" />
    {cheer ? <Path d="M42 61 Q50 72 58 61 Z" fill="#8a2a22" /> : <Path d="M43 62 Q50 68 57 62" stroke="#8a2a22" strokeWidth="2.4" strokeLinecap="round" fill="none" />}
  </Svg>
);

// ---------------------------------------------------------------------- chân dung cách điệu
type Hat = 'helmet' | 'crown' | 'band' | 'cap' | 'bun' | 'scarf';
interface Face { hat: Hat; hatColor: string; robe: string; trim: string; bg: string; beard?: 'short' | 'long' | 'white'; hair?: string; stern?: boolean; young?: boolean }
const FACES: Record<string, Face> = {
  'le-phu-tran': { hat: 'helmet', hatColor: '#8fa3b8', robe: '#3f5f8a', trim: '#d9e3f0', bg: '#cfe4ff', beard: 'short', stern: true },
  'tran-thu-do': { hat: 'cap', hatColor: '#1c1c22', robe: '#6b2f6b', trim: '#f6c445', bg: '#ead9ff', beard: 'white', stern: true, hair: '#e8e4dc' },
  'tran-thai-tong': { hat: 'crown', hatColor: '#f6c445', robe: '#f2b90f', trim: '#b3261e', bg: '#fff0c2', beard: 'short' },
  'tran-quoc-toan': { hat: 'band', hatColor: '#d8322f', robe: '#d8322f', trim: '#f6c445', bg: '#cfe4ff', young: true },
  'tran-thanh-tong': { hat: 'crown', hatColor: '#f6c445', robe: '#c9881a', trim: '#7a1f1a', bg: '#ffe9c2', beard: 'long' },
  'tran-binh-trong': { hat: 'helmet', hatColor: '#9aa7b8', robe: '#4a5a78', trim: '#b3261e', bg: '#e3d6ff', beard: 'short', stern: true },
  'tran-nhat-duat': { hat: 'cap', hatColor: '#1c2f5a', robe: '#2f7f6b', trim: '#f6c445', bg: '#d2f5e6', beard: 'short' },
  'tran-quang-khai': { hat: 'cap', hatColor: '#1c1c22', robe: '#b3261e', trim: '#f6c445', bg: '#ffe0d6', beard: 'long' },
  'tran-nhan-tong': { hat: 'crown', hatColor: '#f6c445', robe: '#e0a312', trim: '#b3261e', bg: '#fff3c9' },
  'pham-ngu-lao': { hat: 'helmet', hatColor: '#b8862f', robe: '#7a4a22', trim: '#f6c445', bg: '#ffe6c2', beard: 'short', stern: true },
  'tran-khanh-du': { hat: 'scarf', hatColor: '#2f5fa8', robe: '#2f5fa8', trim: '#dfe8f7', bg: '#cfeaff', beard: 'short' },
  'nguyen-khoai': { hat: 'helmet', hatColor: '#c9a227', robe: '#3f6b3a', trim: '#f6c445', bg: '#dff5d2', stern: true },
  'tran-hung-dao': { hat: 'helmet', hatColor: '#f6c445', robe: '#b3261e', trim: '#f6c445', bg: '#ffe08a', beard: 'long', stern: true },
};

export const Portrait: React.FC<{ code: string; size?: number; locked?: boolean; round?: boolean }> = ({ code, size = 96, locked = false, round = false }) => {
  const f = FACES[code] ?? FACES['le-phu-tran'];
  const hair = f.hair ?? '#1f1a17';
  const beard = f.beard === 'white' ? '#f0ede6' : '#1f1a17';
  if (locked) {
    return (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Rect width="100" height="100" rx={round ? 50 : 14} fill="#3a4666" />
        <Path d="M14 100 Q14 72 50 72 Q86 72 86 100 Z" fill="#232c47" /><Circle cx="50" cy="46" r="24" fill="#232c47" />
        <Path d="M44 40 Q44 32 50 32 Q57 32 57 39 Q57 44 51 46 L51 50" stroke="#8793b3" strokeWidth="4" strokeLinecap="round" fill="none" /><Circle cx="51" cy="57" r="2.6" fill="#8793b3" />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Rect width="100" height="100" rx={round ? 50 : 14} fill={f.bg} />
      <Path d="M12 100 Q12 70 50 70 Q88 70 88 100 Z" fill={f.robe} />
      <Path d="M40 70 L50 88 L60 70 Z" fill={f.trim} />
      <Rect x="44" y="62" width="12" height="10" fill="#f0c39c" />
      <Circle cx="27" cy="48" r="5" fill="#f6cba6" /><Circle cx="73" cy="48" r="5" fill="#f6cba6" />
      <Circle cx="50" cy="46" r={f.young ? 25 : 24} fill="#f9d2b0" />
      {f.hat !== 'helmet' && f.hat !== 'crown' && <Path d="M26 42 Q26 20 50 20 Q74 20 74 42 Q62 31 50 32 Q38 31 26 42 Z" fill={hair} />}
      {f.hat === 'helmet' && <G><Path d="M24 46 Q22 16 50 16 Q78 16 76 46 L70 43 Q50 33 30 43 Z" fill={f.hatColor} /><Path d="M24 44 L22 60 L29 56 L30 43 Z" fill={f.hatColor} /><Path d="M76 44 L78 60 L71 56 L70 43 Z" fill={f.hatColor} /><Circle cx="50" cy="28" r="4" fill="#b3261e" /><Path d="M50 16 Q56 4 62 10 Q56 10 53 17 Z" fill="#d8322f" /><Path d="M30 43 Q50 33 70 43" stroke="#00000022" strokeWidth="2" fill="none" /></G>}
      {f.hat === 'crown' && <G><Path d="M26 42 Q26 24 50 24 Q74 24 74 42 Q62 34 50 35 Q38 34 26 42 Z" fill={hair} /><Rect x="28" y="22" width="44" height="12" rx="3" fill={f.hatColor} /><Rect x="24" y="15" width="52" height="8" rx="2" fill={f.hatColor} /><Rect x="24" y="15" width="52" height="3" fill="#b3261e" />{[30, 40, 50, 60, 70].map((x) => <Circle key={x} cx={x} cy="28" r="2" fill="#b3261e" />)}</G>}
      {f.hat === 'band' && <G><Circle cx="50" cy="15" r="7" fill={hair} /><Path d="M26 38 Q50 27 74 38 L74 44 Q50 33 26 44 Z" fill={f.hatColor} /><Path d="M74 40 L86 35 L83 44 L88 49 L76 46 Z" fill={f.hatColor} /></G>}
      {f.hat === 'cap' && <G><Path d="M27 38 Q27 14 50 14 Q73 14 73 38 Q50 28 27 38 Z" fill={f.hatColor} /><Rect x="10" y="30" width="18" height="6" rx="3" fill={f.hatColor} /><Rect x="72" y="30" width="18" height="6" rx="3" fill={f.hatColor} /><Rect x="45" y="20" width="10" height="8" rx="2" fill="#f6c445" /></G>}
      {f.hat === 'bun' && <Circle cx="50" cy="14" r="7" fill={hair} />}
      {f.hat === 'scarf' && <G><Path d="M25 40 Q25 16 50 16 Q75 16 75 40 Q50 29 25 40 Z" fill={f.hatColor} /><Path d="M72 34 L84 42 L74 46 Z" fill={f.hatColor} /></G>}
      {f.stern ? <G><Path d="M34 41 L45 44" stroke="#1f1a17" strokeWidth="3" strokeLinecap="round" /><Path d="M66 41 L55 44" stroke="#1f1a17" strokeWidth="3" strokeLinecap="round" /></G> : <G><Path d="M34 42 Q39 39 45 42" stroke="#1f1a17" strokeWidth="2.4" strokeLinecap="round" fill="none" /><Path d="M55 42 Q61 39 66 42" stroke="#1f1a17" strokeWidth="2.4" strokeLinecap="round" fill="none" /></G>}
      <Ellipse cx="40" cy="50" rx="3" ry={f.young ? 4.2 : 3.4} fill="#1f1a17" /><Ellipse cx="60" cy="50" rx="3" ry={f.young ? 4.2 : 3.4} fill="#1f1a17" />
      <Circle cx="41" cy="48.8" r="1.1" fill="#ffffff" /><Circle cx="61" cy="48.8" r="1.1" fill="#ffffff" />
      <Circle cx="33" cy="57" r="4" fill="#f59b8b" opacity="0.6" /><Circle cx="67" cy="57" r="4" fill="#f59b8b" opacity="0.6" />
      {f.beard === 'short' && <Path d="M38 60 Q50 76 62 60 Q56 64 50 62 Q44 64 38 60 Z" fill={beard} />}
      {(f.beard === 'long' || f.beard === 'white') && <Path d="M36 58 Q38 84 50 90 Q62 84 64 58 Q56 66 50 63 Q44 66 36 58 Z" fill={beard} />}
      {!f.beard && <Path d="M44 60 Q50 66 56 60" stroke="#8a2a22" strokeWidth="2.4" strokeLinecap="round" fill="none" />}
      {f.beard && <Path d="M45 60 Q50 63 55 60" stroke={f.beard === 'white' ? '#b9a48f' : '#f9d2b0'} strokeWidth="1.8" strokeLinecap="round" fill="none" />}
    </Svg>
  );
};

// ---------------------------------------------------------------------- huy chương
const MEDALS: Record<string, { metal: string; edge: string; emblem: 'stakes' | 'drum' | 'flame' | 'boat' | 'swords' | 'sack' | 'star' }> = {
  'saga-bach-dang': { metal: '#ffcf3f', edge: '#d99a06', emblem: 'stakes' }, 'saga-dien-hong': { metal: '#dfe5ee', edge: '#a9b4c6', emblem: 'drum' },
  'bay-ngay-lien-tiep': { metal: '#f0a56a', edge: '#c9773a', emblem: 'flame' }, 'saga-dong-bo-dau': { metal: '#ffcf3f', edge: '#d99a06', emblem: 'boat' },
  'saga-tay-ket': { metal: '#dfe5ee', edge: '#a9b4c6', emblem: 'swords' }, 'saga-van-don': { metal: '#f0a56a', edge: '#c9773a', emblem: 'sack' },
};
export const Medal: React.FC<{ code: string; size?: number; earned?: boolean }> = ({ code, size = 72, earned = true }) => {
  const m = MEDALS[code] ?? { metal: '#ffcf3f', edge: '#d99a06', emblem: 'star' as const };
  const metal = earned ? m.metal : '#56617f', edge = earned ? m.edge : '#3d4763';
  return (
    <Svg width={size} height={size * 1.2} viewBox="0 0 100 120" opacity={earned ? 1 : 0.75}>
      <Path d="M30 0 L46 40 L38 46 L20 6 Z" fill={earned ? '#e23d3d' : '#4a5573'} /><Path d="M70 0 L54 40 L62 46 L80 6 Z" fill={earned ? '#2f7fd8' : '#4a5573'} />
      <Circle cx="50" cy="76" r="40" fill={edge} /><Circle cx="50" cy="72" r="38" fill={metal} /><Circle cx="50" cy="72" r="29" fill="none" stroke={edge} strokeWidth="2.5" opacity="0.6" />
      {m.emblem === 'stakes' && <G><Path d="M26 84 Q38 78 50 84 T74 84" stroke="#2f7fd8" strokeWidth="5" fill="none" strokeLinecap="round" />{[36, 46, 56, 66].map((x, i) => <Path key={x} d={`M${x} 82 L${x} ${58 + (i % 2) * 5} L${x + 4} ${52 + (i % 2) * 5} L${x + 8} ${58 + (i % 2) * 5} L${x + 8} 82 Z`} fill="#7a4a22" />)}</G>}
      {m.emblem === 'drum' && <G><Ellipse cx="50" cy="62" rx="20" ry="7" fill="#f8eab8" /><Path d="M30 62 L30 82 Q50 92 70 82 L70 62 Q50 72 30 62 Z" fill="#d8322f" /></G>}
      {m.emblem === 'flame' && <Path d="M50 48 Q64 62 60 76 Q62 70 56 66 Q60 82 50 90 Q36 84 40 70 Q42 74 46 72 Q40 60 50 48 Z" fill="#f4583f" />}
      {m.emblem === 'boat' && <G><Path d="M28 76 L72 76 L64 88 L36 88 Z" fill="#7a4a22" /><Rect x="48" y="50" width="3" height="26" fill="#4a3320" /><Path d="M52 52 L68 72 L52 72 Z" fill="#d8322f" /></G>}
      {m.emblem === 'swords' && <G><Path d="M32 54 L66 88" stroke="#5b6785" strokeWidth="6" strokeLinecap="round" /><Path d="M68 54 L34 88" stroke="#5b6785" strokeWidth="6" strokeLinecap="round" /></G>}
      {m.emblem === 'sack' && <Path d="M38 62 Q50 54 62 62 Q72 78 62 90 L38 90 Q28 78 38 62 Z M44 58 L56 58" fill="#f8eab8" stroke="#8a6a3f" strokeWidth="3" />}
      {m.emblem === 'star' && <Polygon points="50,50 56,66 73,66 59,76 64,92 50,82 36,92 41,76 27,66 44,66" fill="#ffffff" opacity="0.9" />}
    </Svg>
  );
};

// ---------------------------------------------------------------------- tranh ba cuộc kháng chiến
/** Tranh minh họa trên thẻ chọn cuộc kháng chiến: thành Thăng Long (1258), thuyền chiến trên sông Hồng (1285), bãi cọc Bạch Đằng (1287–1288) */
export const CampaignArt: React.FC<{ no: number; height?: number }> = ({ no, height = 150 }) => (
  <Svg width="100%" height={height} viewBox="0 0 300 180" preserveAspectRatio="xMidYMid slice">
    <Rect width="300" height="180" fill={no === 1 ? '#bfe6ff' : no === 2 ? '#ffe6c2' : '#cfe2ff'} />
    <Circle cx={no === 2 ? 70 : 240} cy="42" r="22" fill={no === 2 ? '#ffb347' : '#ffd95a'} />
    {no === 1 && <G><Path d="M0 130 Q150 100 300 130 V180 H0 Z" fill="#8fd46b" /><Rect x="0" y="150" width="300" height="30" fill="#e09a5c" /><Rect x="50" y="78" width="110" height="74" fill="#c8623f" /><Path d="M78 152 Q78 118 105 118 Q132 118 132 152 Z" fill="#6b2f1f" /><Path d="M32 82 L178 82 L160 62 L50 62 Z" fill="#a4432a" /><Path d="M56 62 L154 62 L138 44 L72 44 Z" fill="#8a3520" /><Rect x="104" y="20" width="3" height="26" fill="#5b3516" /><Path d="M107 20 L128 26 L107 33 Z" fill="#d8322f" /><Path d="M200 160 L262 160 L252 172 L210 172 Z" fill="#7a4a22" /><Rect x="228" y="124" width="3" height="36" fill="#4a3320" /><Rect x="232" y="126" width="24" height="26" fill="#d8322f" /><Rect x="238" y="132" width="12" height="13" fill="#f6c445" /></G>}
    {no === 2 && <G><Path d="M90 150 Q110 40 160 60 Q200 30 230 150 Z" fill="#8fc7a5" /><Path d="M200 150 Q230 70 262 90 Q292 80 300 150 Z" fill="#7dba96" /><Rect x="0" y="126" width="300" height="54" fill="#4aa8ec" /><Path d="M20 144 h28 M120 158 h34 M220 142 h30" stroke="#bfe6ff" strokeWidth="3" strokeLinecap="round" />{[[60, 128], [190, 142]].map(([x, y]) => <G key={x}><Path d={`M${x - 34} ${y} L${x + 34} ${y} L${x + 24} ${y + 14} L${x - 24} ${y + 14} Z`} fill="#7a4a22" /><Rect x={x - 2} y={y - 42} width="3" height="42" fill="#4a3320" /><Rect x={x + 3} y={y - 40} width="26" height="30" fill="#d8322f" /><Rect x={x + 10} y={y - 33} width="12" height="15" fill="#f6c445" /></G>)}</G>}
    {no === 3 && <G><Path d="M0 120 Q30 40 70 60 Q100 30 130 120 Z" fill="#8fc7a5" /><Path d="M170 120 Q200 50 236 66 Q270 46 300 120 Z" fill="#7dba96" /><Rect x="0" y="104" width="300" height="76" fill="#3f9be0" />{[52, 78, 104, 130].map((x, i) => <Path key={x} d={`M${x} 150 L${x} ${98 + (i % 2) * 8} L${x + 6} ${88 + (i % 2) * 8} L${x + 12} ${98 + (i % 2) * 8} L${x + 12} 150 Z`} fill="#7a4a22" />)}<Path d="M180 128 L270 128 L258 146 L192 146 Z" fill="#5a4636" /><Rect x="222" y="74" width="4" height="54" fill="#3b2a1a" />{[0, 1, 2, 3].map((i) => <Rect key={i} x="198" y={78 + i * 12} width="46" height="9" fill="#c9b08a" />)}<Path d="M20 160 h40 M150 166 h36" stroke="#9fd3f7" strokeWidth="3" strokeLinecap="round" /></G>}
  </Svg>
);

/** Số có dấu chấm ngăn cách hàng nghìn (1.250) */
export const num = (n: number): string => Math.round(n).toLocaleString('vi-VN');

// ---------------------------------------------------------------------- điều hướng trong trang học sinh
export type SagaTab = 'chien-dich' | 'nhap-vai' | 'cau-hoi' | 'tu-lieu' | 'bo-the' | 'hoi' | 'tro-giup' | 'khao-sat';
/** Bước đang mở của một chặng: học thẻ kiến thức, luyện tập, nhập vai khám phá, trận đánh, tổng kết */
export type SagaStep = 'hoc' | 'luyen' | 'kham-pha' | 'tran' | 'tong-ket';
export interface SagaRoute { tab: SagaTab; c: number | null; s: number | null; v: SagaStep | null }
export type SagaTarget = { c?: number | null; s?: number | null; v?: SagaStep | null };
/** `push`: thêm một bước vào lịch sử trình duyệt; `replace`: thay bước hiện tại (một bước chơi vừa kết thúc); `params`: đổi ngay trên màn đang mở (mở / đóng bảng chặng, đổi bản đồ) */
export type NavMode = 'push' | 'replace' | 'params';
export interface SagaNav {
  route: SagaRoute;
  go: (tab: SagaTab, to?: SagaTarget, mode?: NavMode) => void;
  /** Quay về màn cha: lùi một bước nếu bước liền trước trong lịch sử đúng là màn đó, nếu không thì thay màn hiện tại bằng màn cha */
  back: (tab: SagaTab, to?: SagaTarget) => void;
  /** Dữ liệu trang chủ (cấp độ, vàng, chuỗi ngày, ba cuộc kháng chiến) và hàm tải lại sau khi có thưởng */
  home: SagaHome | null;
  refresh: () => void;
  /** Phần thưởng của chặng vừa hoàn thành, chờ màn tổng kết hiển thị một lần */
  reward: { stageId: number; completion: Completion } | null;
  setReward: (r: { stageId: number; completion: Completion } | null) => void;
}

// ---------------------------------------------------------------------- chặng: biểu tượng và trạng thái
const STAGE_ICON: Record<string, IconType> = { anchor: Anchor, crown: Crown, flame: Flame, home: House, landmark: Landmark, scroll: ScrollText, shield: Shield, star: Star, swords: Swords, target: Target, tent: Tent, users: Users, waves: Ship };
export const stageIcon = (name: string): IconType => STAGE_ICON[name] ?? Star;
const ART_ICON: Record<string, IconType> = {
  boat: Sailboat, crowd: Users, elephant: Shield, envoy: Mail, flag: Flag, general: Crown, granary: Warehouse, horse: Footprints, map: MapIcon, moon: Moon, palace: Landmark, river: Droplets,
  scroll: ScrollText, shield: Shield, stakes: Fence, star: Star, sun: Sun, swords: Swords,
};
export const artIcon = (name: string | null): IconType => ART_ICON[name ?? ''] ?? BookOpen;

/** Trạng thái chặng luôn thể hiện bằng cả màu, biểu tượng và chữ (không chỉ dựa vào màu) */
export const STATE: Record<StageState, { label: string; icon: IconType; bg: string; edge: string; fg: string }> = {
  locked: { label: 'Chưa mở', icon: Lock, bg: '#9aa5bd', edge: '#6f7b95', fg: '#ffffff' },
  ready: { label: 'Sẵn sàng', icon: Play, bg: SG.blue, edge: SG.blueEdge, fg: '#ffffff' },
  learning: { label: 'Đang học', icon: BookOpen, bg: SG.yellow, edge: SG.yellowEdge, fg: SG.onYellow },
  done: { label: 'Đã xong', icon: Check, bg: SG.green, edge: SG.greenEdge, fg: '#ffffff' },
  review: { label: 'Cần ôn', icon: RotateCcw, bg: SG.orange, edge: SG.orangeEdge, fg: '#ffffff' },
};
export const KIND_TEXT: Record<string, string> = { battle: 'Trận đánh', council: 'Hội nghị', strategy: 'Kế sách', prepare: 'Chuẩn bị' };

// ---------------------------------------------------------------------- khối giao diện dùng lại
const BTN_TONE = {
  green: [SG.green, SG.greenEdge, '#ffffff'], orange: [SG.orange, SG.orangeEdge, '#ffffff'], red: [SG.red, SG.redEdge, '#ffffff'], blue: [SG.blue, SG.blueEdge, '#ffffff'],
  purple: [SG.purple, SG.purpleEdge, '#ffffff'], yellow: [SG.yellow, SG.yellowEdge, SG.onYellow], navy: [SG.navy, SG.navyEdge, '#ffffff'], white: ['#ffffff', '#c9d5ea', '#1e2a4a'],
} as const;
export type BtnTone = keyof typeof BTN_TONE;
const BTN_SIZE = { sm: { h: 40, font: 14, px: 14, icon: 17 }, md: { h: 48, font: 16, px: 18, icon: 20 }, lg: { h: 58, font: 19, px: 26, icon: 24 } } as const;

/** Nút khối có chữ (và biểu tượng) theo phong cách trò chơi; `loading` khóa nút khi đang gửi lệnh */
export const GameBtn: React.FC<{
  title: string; icon?: IconType; iconRight?: IconType; tone?: BtnTone; size?: keyof typeof BTN_SIZE; onPress?: () => void; disabled?: boolean; loading?: boolean; full?: boolean; testID?: string; label?: string; style?: StyleProp<ViewStyle>;
}> = ({ title, icon: Icon, iconRight: IconRight, tone = 'green', size = 'md', onPress, disabled, loading, full, testID, label, style }) => {
  const [bg, edge, fg] = BTN_TONE[tone];
  const m = BTN_SIZE[size];
  return (
    <Chunky bg={bg} edge={edge} onPress={onPress} disabled={disabled || loading} label={label ?? title} testID={testID} radius={m.h / 2.6} depth={size === 'sm' ? 4 : 5} style={[{ alignSelf: full ? 'stretch' : 'flex-start', maxWidth: '100%' }, style]}>
      <View style={{ minHeight: Math.max(44, m.h), paddingHorizontal: m.px, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {loading ? <ActivityIndicator size="small" color={fg} /> : Icon ? <Icon size={m.icon} color={fg} strokeWidth={2.6} /> : null}
        <Txt f="heavy" size={m.font} color={fg} center numberOfLines={2} style={{ flexShrink: 1 }}>{title}</Txt>
        {IconRight && <IconRight size={m.icon} color={fg} strokeWidth={2.6} />}
      </View>
    </Chunky>
  );
};

/** Thẻ nền của trang học sinh: bo tròn, viền đáy dày */
export const Panel: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle>; pad?: number; testID?: string; tone?: string }> = ({ children, style, pad = 16, testID, tone }) => {
  const s = useSaga();
  return <View testID={testID} style={[{ backgroundColor: s.card, borderRadius: 20, borderWidth: 2, borderColor: tone ?? s.line, borderBottomWidth: 5, padding: pad }, style]}>{children}</View>;
};

/** Đầu màn hình con: nút quay lại, tiêu đề, dòng phụ và phần bên phải */
export const ScreenHead: React.FC<{ title: string; subtitle?: string; onBack?: () => void; backLabel?: string; right?: React.ReactNode; light?: boolean }> = ({ title, subtitle, onBack, backLabel = 'Quay lại', right, light }) => {
  const s = useSaga();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      {onBack && (
        <Chunky bg="#ffffff" edge="#c9d5ea" onPress={onBack} label={backLabel} testID="saga-back" radius={22} depth={4} style={{ width: 44 }}>
          <View style={{ height: 44, alignItems: 'center', justifyContent: 'center' }}><ChevronLeft size={24} color="#1e2a4a" strokeWidth={3} /></View>
        </Chunky>
      )}
      <View style={{ flex: 1 }}>
        <Txt f="heavy" size={22} color={light ? '#ffffff' : s.ink} accessibilityRole="header" numberOfLines={2}>{title}</Txt>
        {subtitle ? <Txt f="semibold" size={14} color={light ? 'rgba(255,255,255,0.86)' : s.sub} numberOfLines={2}>{subtitle}</Txt> : null}
      </View>
      {right}
    </View>
  );
};

/** Ngôi sao kết quả (đủ / thiếu), kèm nhãn cho trình đọc màn hình */
export const StarRow: React.FC<{ n: number; max?: number; size?: number; dim?: string }> = ({ n, max = 3, size = 20, dim = 'rgba(120,130,160,0.35)' }) => (
  <View accessible accessibilityLabel={`${n} trên ${max} sao`} style={{ flexDirection: 'row', gap: 2 }}>
    {Array.from({ length: max }, (_, i) => <Star key={i} size={size} color={i < n ? SG.yellowEdge : dim} fill={i < n ? SG.yellow : dim} strokeWidth={1.6} />)}
  </View>
);

/** Thanh tiến độ bo tròn (giá trị 0–1) */
export const Meter: React.FC<{ value: number; fill: string; track?: string; height?: number; label: string; style?: StyleProp<ViewStyle> }> = ({ value, fill, track, height = 12, label, style }) => {
  const s = useSaga();
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }} style={[{ height, borderRadius: height / 2, backgroundColor: track ?? s.line, overflow: 'hidden' }, style]}>
      <View style={{ width: `${v * 100}%`, height: '100%', borderRadius: height / 2, backgroundColor: fill }} />
    </View>
  );
};

/** Dòng nguồn tham khảo có nút mở liên kết gốc ("Xem nguồn") */
export const SourceLine: React.FC<{ source: Pick<SourceRef, 'title' | 'publisher' | 'url' | 'note'>; light?: boolean }> = ({ source, light }) => {
  const s = useSaga();
  const ink = light ? '#ffffff' : s.ink, sub = light ? 'rgba(255,255,255,0.8)' : s.sub;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ flex: 1 }}>
        <Txt f="bold" size={14} color={ink}>{source.title}</Txt>
        <Txt size={13} color={sub}>{source.publisher}{source.note ? ` · ${source.note}` : ''}</Txt>
      </View>
      {source.url ? (
        <Pressable accessibilityRole="link" accessibilityLabel={`Mở nguồn: ${source.title}`} onPress={() => { void Linking.openURL(source.url!); }} hitSlop={8}
          style={({ pressed }) => ({ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 12, backgroundColor: pressed ? 'rgba(47,155,234,0.22)' : 'rgba(47,155,234,0.12)' })}>
          <ExternalLink size={16} color={light ? '#bfe0ff' : SG.blueEdge} strokeWidth={2.6} />
          <Txt f="bold" size={13} color={light ? '#bfe0ff' : SG.blueEdge}>Mở nguồn</Txt>
        </Pressable>
      ) : null}
    </View>
  );
};

/** Lớp phủ kết quả (thắng trận, hoàn thành, lên cấp): nền mờ, nội dung ở giữa, không dùng Modal để không chồng hộp thoại */
export const Overlay: React.FC<{ children: React.ReactNode; onClose?: () => void; label: string; maxWidth?: number; testID?: string }> = ({ children, onClose, label, maxWidth = 520, testID }) => {
  const s = useSaga();
  const pop = usePopIn();
  return (
    <View testID={testID} style={[StyleSheet.absoluteFill, { zIndex: 60, backgroundColor: s.scrim, alignItems: 'center', justifyContent: 'center', padding: 16 }]}>
      {onClose && <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} importantForAccessibility="no" />}
      <Animated.View accessibilityViewIsModal aria-modal role="dialog" aria-label={label} style={[{ width: '100%', maxWidth, maxHeight: '100%' }, pop]}>{children}</Animated.View>
    </View>
  );
};

/** Thông báo ngắn trong màn chơi (lệnh không hợp lệ, cảnh báo của máy chủ); tự ẩn sau vài giây */
export function useFlash(ms = 3600): [string | null, (text: string | null) => void] {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (!text) return;
    const t = setTimeout(() => setText(null), ms);
    return () => clearTimeout(t);
  }, [text, ms]);
  return [text, setText];
}
export const Flash: React.FC<{ text: string | null; tone?: 'warn' | 'info' }> = ({ text, tone = 'warn' }) =>
  text ? (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: tone === 'warn' ? '#fff0db' : '#e3f2ff', borderRadius: 14, borderWidth: 2, borderColor: tone === 'warn' ? SG.orange : SG.blue, paddingHorizontal: 12, paddingVertical: 9 }}>
      <Info size={18} color={tone === 'warn' ? '#8f4a00' : SG.blueEdge} strokeWidth={2.6} />
      <Txt f="bold" size={14} color={tone === 'warn' ? '#8f4a00' : '#124a7a'} style={{ flex: 1 }}>{text}</Txt>
    </View>
  ) : null;

/** Phím tắt trên web (mũi tên, Enter…); bỏ qua khi đang gõ vào ô nhập */
export function useKeys(handler: (key: string) => void, enabled = true): void {
  const fn = useRef(handler);
  fn.current = handler;
  useEffect(() => {
    if (!enabled || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent): void => {
      const el = document.activeElement;
      const tag = (el?.tagName ?? '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.ctrlKey || e.metaKey || e.altKey) return;
      // Enter / phím cách khi đang đứng trên một nút: để chính nút đó xử lý, tránh một lần nhấn thành hai thao tác
      const live = el !== null && el.getAttribute('aria-disabled') !== 'true' && !(el as HTMLButtonElement).disabled;
      if ((e.key === 'Enter' || e.key === ' ') && el && live && (tag === 'BUTTON' || tag === 'A' || ['button', 'tab', 'link', 'menuitem', 'switch'].includes(el.getAttribute('role') ?? ''))) return;
      fn.current(e.key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
