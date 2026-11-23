/**
 * Bộ thành phần chung của Hành trình Đông A. Từ 20/11/2026, dùng bảng màu học sinh và tiêu đề Manrope dễ đọc;
 * nút, thẻ và các tiện ích nền tảng vẫn dùng bộ thành phần chung, có chiều sâu khi nằm trong StudentWorkspace.
 * Tệp này chỉ giữ phần riêng của trò chơi: màu trạng thái chặng và ba cuộc kháng chiến, chân dung cách điệu của các nhân vật (tranh minh họa tự vẽ,
 * không phải chân dung lịch sử), huy chương, ảnh bản đồ, thanh tiến độ, dòng nguồn tham khảo, ô phương án trả lời và phím tắt.
 * Chữ dùng Manrope / Newsreader qua `Txt`; mọi nút có vùng chạm ≥ 44pt và nhãn trợ năng.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, View, useWindowDimensions, type ImageSourcePropType, type ScrollViewInstance, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Polygon, Rect } from 'react-native-svg';
import {
  Anchor, BookOpen, Check, ChevronLeft, Crown, Droplets, ExternalLink, Fence, Flag, Flame, Footprints, House, Info, Landmark, Lock, Mail, Map as MapIcon, Moon, Play, RotateCcw, Sailboat, ScrollText, Shield, Ship, Star, Sun,
  Swords, Target, Tent, Users, Warehouse, X,
} from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import { ErrorNote } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { Btn, Spinner, Txt } from '@/components/ui';
import { PALETTES } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { IconType } from '@/types/game';
import type { Completion, SagaHome, SagaMapInfo, SourceRef, StageState } from '@/types/saga';

// ---------------------------------------------------------------------- màu (bảng màu sáng chung của các cổng quản trị)
const L = PALETTES.light;
/** Ba cuộc kháng chiến: màu nhấn (thanh tiến độ, viền bản đồ), nền nhạt và chữ của nhãn */
export const TONE: Record<number, { main: string; soft: string; text: string; label: string; years: string }> = {
  1: { main: L.moc, soft: L.mocNhat, text: L.mocChu, label: 'Lần I', years: '1258' },
  2: { main: L.hoa, soft: L.hoaNhat, text: L.hoaChu, label: 'Lần II', years: '1285' },
  3: { main: L.son, soft: L.sonNhat, text: L.sonChu, label: 'Lần III', years: '1287–1288' },
};
export const RARITY: Record<string, { label: string; main: string; soft: string; stars: number }> = {
  common: { label: 'Thường', main: L.dich, soft: L.dichNhat, stars: 1 }, rare: { label: 'Hiếm', main: L.thuyChu, soft: L.thuyNhat, stars: 2 },
  epic: { label: 'Sử thi', main: L.thongChu, soft: L.thongNhat, stars: 3 }, legendary: { label: 'Huyền thoại', main: L.thoChu, soft: L.thoNhat, stars: 5 },
};

// ---------------------------------------------------------------------- ảnh bản đồ (bản gốc của Wikipedia tiếng Việt, tác giả Lưu Ly, phạm vi công cộng)
const MAP_FILES: Record<string, ImageSourcePropType> = {
  'ban-do-khang-chien-1': require('@/assets/ban-do-khang-chien-1.webp'),
  'ban-do-khang-chien-2': require('@/assets/ban-do-khang-chien-2.webp'),
  'ban-do-khang-chien-3': require('@/assets/ban-do-khang-chien-3.webp'),
};
/** Ảnh nền bản đồ: liên kết đã cấu hình (nếu có), không thì ảnh có sẵn theo khóa */
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

/** Đang tải / lỗi (có nút thử lại) như các trang quản trị */
export const LoadState: React.FC<{ loading: boolean; error: string | null; onRetry: () => void }> = ({ loading, error, onRetry }) => {
  if (loading) return <View style={{ paddingVertical: 32 }}><Spinner /></View>;
  if (!error) return null;
  return (
    <View style={{ gap: 10 }}>
      <ErrorNote message={error} />
      <Btn title="Thử lại" icon={RotateCcw} tone="giay" size="sm" onPress={onRetry} testID="saga-retry" />
    </View>
  );
};

// ---------------------------------------------------------------------- bố cục trang
/** Một trang trong khung học sinh: cuộn dọc, lề và độ rộng như `Page` của trang quản trị; màn chơi dùng `max` rộng hơn */
export const SagaPage: React.FC<{ children: React.ReactNode; testID: string; max?: number; scrollRef?: React.Ref<ScrollViewInstance> }> = ({ children, testID, max = 1120, scrollRef }) => {
  const { width } = useWindowDimensions();
  return (
  <View style={{ flex: 1 }} testID={testID}>
    <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: width >= 1080 ? 26 : 16, paddingBottom: 48, gap: 22, maxWidth: max, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  </View>
  );
};

/** Đầu trang: nút quay về màn cha (dạng đường dẫn nhỏ) rồi tiêu đề hai nửa của trang quản trị */
export const SagaHeader: React.FC<{ title: string; subtitle?: string; back?: { label: string; onPress: () => void; hint?: string }; actions?: React.ReactNode }> = ({ title, subtitle, back, actions }) => {
  const { c } = useTheme();
  return (
  <View style={{ gap: 8 }}>
    {back ? <Btn title={back.label} icon={ChevronLeft} tone="ghost" size="sm" onPress={back.onPress} label={back.hint ?? back.label} testID="saga-back" style={{ marginLeft: -10 }} /> : null}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 13 }}>
      <View style={{ flex: 1, minWidth: 200, gap: 6 }}>
        <Txt f="heavy" size={26} accessibilityRole="header">{title}</Txt>
        {subtitle ? <Txt size={16} color={c.muc2} style={{ lineHeight: 25 }}>{subtitle}</Txt> : null}
      </View>
      {actions ? <View style={{ maxWidth: '100%' }}>{actions}</View> : null}
    </View>
  </View>
  );
};

/** Tiêu đề nhỏ của một khối trong trang */
export const BlockTitle: React.FC<{ title: string; note?: string; icon?: IconType }> = ({ title, note, icon: Icon }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {Icon ? <Icon size={18} color={c.son} /> : null}
      <Txt f="bold" size={15} accessibilityRole="header">{title}</Txt>
      {note ? <Txt size={12} color={c.muc3} style={{ flexShrink: 1 }}>{note}</Txt> : null}
    </View>
  );
};

/** Ngôi sao kết quả (đủ / thiếu), kèm nhãn cho trình đọc màn hình */
export const StarRow: React.FC<{ n: number; max?: number; size?: number }> = ({ n, max = 3, size = 18 }) => {
  const { c } = useTheme();
  return (
    <View accessible accessibilityLabel={`${n} trên ${max} sao`} style={{ flexDirection: 'row', gap: 2 }}>
      {Array.from({ length: max }, (_, i) => <Star key={i} size={size} color={i < n ? c.dongDam : c.vien2} fill={i < n ? c.dong : 'transparent'} strokeWidth={1.8} />)}
    </View>
  );
};

/** Thanh tiến độ mảnh như thanh trong các thẻ thống kê (giá trị 0–1) */
export const Meter: React.FC<{ value: number; color?: string; height?: number; label: string; style?: StyleProp<ViewStyle> }> = ({ value, color, height = 8, label, style }) => {
  const { c } = useTheme();
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }} style={[{ height, borderRadius: height / 2, backgroundColor: c.adminLine, overflow: 'hidden' }, style]}>
      <View style={{ width: `${v * 100}%`, height: '100%', borderRadius: height / 2, backgroundColor: color ?? c.son }} />
    </View>
  );
};

/** Dòng nguồn tham khảo có nút mở liên kết gốc */
export const SourceLine: React.FC<{ source: Pick<SourceRef, 'title' | 'publisher' | 'url' | 'note'> }> = ({ source }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <View style={{ flex: 1, minWidth: 200 }}>
        <Txt f="semibold" size={14}>{source.title}</Txt>
        <Txt size={12} color={c.muc3}>{source.publisher}{source.note ? ` · ${source.note}` : ''}</Txt>
      </View>
      {source.url ? <Btn title="Mở nguồn" icon={ExternalLink} tone="giay" size="sm" onPress={() => { void Linking.openURL(source.url!); }} label={`Mở nguồn: ${source.title}`} /> : null}
    </View>
  );
};

/** Ô phương án trả lời: viền mảnh, ô chữ cái bên trái; sau khi máy chủ chấm thì đúng hiện xanh, sai hiện đỏ (kèm biểu tượng, không chỉ dựa vào màu) */
export type OptionMark = 'idle' | 'picked' | 'right' | 'wrong' | 'dim';
export const OptionButton: React.FC<{ badge: string; text: string; mark?: OptionMark; onPress: () => void; disabled?: boolean; label: string; testID?: string; style?: StyleProp<ViewStyle> }> = ({ badge, text, mark = 'idle', onPress, disabled, label, testID, style }) => {
  const { c } = useTheme();
  const t = mark === 'right' ? { line: c.moc, bg: c.mocNhat, fg: c.mocChu } : mark === 'wrong' ? { line: c.son, bg: c.sonNhat, fg: c.sonChu } : mark === 'picked' ? { line: c.son, bg: c.adminTint, fg: c.muc } : { line: c.adminLine, bg: c.the, fg: c.muc };
  const plain = mark === 'idle' || mark === 'dim';
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: Boolean(disabled), selected: mark === 'picked' }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 2, borderBottomWidth: pressed && !disabled ? 2 : 5, marginTop: pressed && !disabled ? 3 : 0,
        borderColor: t.line, backgroundColor: pressed && plain ? c.adminCanvas : t.bg, opacity: mark === 'dim' ? 0.6 : 1 }, style]}>
      <View style={{ minWidth: 32, height: 32, paddingHorizontal: 6, borderRadius: 10, borderWidth: plain ? 2 : 0, borderColor: c.adminLine, backgroundColor: plain ? c.the : t.line, alignItems: 'center', justifyContent: 'center' }}>
        <Txt f="heavy" size={14} color={plain ? c.muc2 : '#ffffff'}>{badge}</Txt>
      </View>
      <Txt f="semibold" size={15} color={t.fg} style={{ flex: 1 }}>{text}</Txt>
      {mark === 'right' ? <Check size={20} color={c.moc} strokeWidth={2.6} /> : mark === 'wrong' ? <X size={20} color={c.son} strokeWidth={2.6} /> : null}
    </Pressable>
  );
};

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

/** Số có dấu chấm ngăn cách hàng nghìn (1.250) */
export const num = (n: number): string => Math.round(n).toLocaleString('vi-VN');

// ---------------------------------------------------------------------- điều hướng trong trang học sinh
export type SagaTab = 'chien-dich' | 'nhap-vai' | 'cau-hoi' | 'ky-thi' | 'tu-lieu' | 'bo-the' | 'hoi' | 'lop-hoc' | 'tin-nhan' | 'tro-giup';
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
  /** Lớp em đang học (đã chọn ở danh sách lớp): thế giới khối vào phòng chung của lớp này */
  classId?: number | null;
}

// ---------------------------------------------------------------------- chặng: biểu tượng và trạng thái
const STAGE_ICON: Record<string, IconType> = { anchor: Anchor, crown: Crown, flame: Flame, home: House, landmark: Landmark, scroll: ScrollText, shield: Shield, star: Star, swords: Swords, target: Target, tent: Tent, users: Users, waves: Ship };
export const stageIcon = (name: string): IconType => STAGE_ICON[name] ?? Star;
const ART_ICON: Record<string, IconType> = {
  boat: Sailboat, crowd: Users, elephant: Shield, envoy: Mail, flag: Flag, general: Crown, granary: Warehouse, horse: Footprints, map: MapIcon, moon: Moon, palace: Landmark, river: Droplets,
  scroll: ScrollText, shield: Shield, stakes: Fence, star: Star, sun: Sun, swords: Swords,
};
export const artIcon = (name: string | null): IconType => ART_ICON[name ?? ''] ?? BookOpen;

/** Trạng thái chặng luôn thể hiện bằng cả màu, biểu tượng và chữ (không chỉ dựa vào màu): `solid` cho nút trên bản đồ, `soft` / `text` cho nhãn */
export const STATE: Record<StageState, { label: string; icon: IconType; solid: string; soft: string; text: string }> = {
  locked: { label: 'Chưa mở', icon: Lock, solid: L.muc3, soft: L.dichNhat, text: L.dich },
  ready: { label: 'Sẵn sàng', icon: Play, solid: L.thuy, soft: L.thuyNhat, text: L.thuyChu },
  learning: { label: 'Đang học', icon: BookOpen, solid: L.tho, soft: L.vangNhat, text: L.vangChu },
  done: { label: 'Đã xong', icon: Check, solid: L.moc, soft: L.mocNhat, text: L.mocChu },
  review: { label: 'Cần ôn', icon: RotateCcw, solid: L.hoa, soft: L.hoaNhat, text: L.hoaChu },
};
export const KIND_TEXT: Record<string, string> = { battle: 'Trận đánh', council: 'Hội nghị', strategy: 'Kế sách', prepare: 'Chuẩn bị' };

// ---------------------------------------------------------------------- thông báo ngắn và phím tắt
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
export const Flash: React.FC<{ text: string | null; tone?: 'warn' | 'info' }> = ({ text, tone = 'warn' }) => {
  const { c } = useTheme();
  if (!text) return null;
  const [bg, fg] = tone === 'warn' ? [c.vangNhat, c.vangChu] : [c.thuyNhat, c.thuyChu];
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: bg, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10 }}>
      <Info size={16} color={fg} />
      <Txt f="semibold" size={14} color={fg} style={{ flex: 1 }}>{text}</Txt>
    </View>
  );
};

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
