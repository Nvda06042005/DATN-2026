/**
 * Ngôn ngữ hình ảnh của trang học sinh – "Binh thư Sát Thát" (25/11/2026, theo bản vẽ người dùng gửi): nền giấy kem, đỏ son, vàng đồng, xanh sông nước;
 * bố cục kiểu ứng dụng điện thoại (thẻ bo tròn, dải tối có chữ vàng, thanh tiến độ mảnh), tiêu đề Newsreader (chữ có chân), nội dung Manrope.
 * Bốn giao diện đổi màu cả trang học sinh (mua / mở ở Chợ phiên, máy chủ lưu `saga_theme`): Thăng Long (mặc định), Sông Bạch Đằng, Đêm Đông Bộ Đầu (tối),
 * Hoàng thành (chỉ dành cho Trạng nguyên). Mọi màn học sinh đọc màu qua `useBT()`; các thành phần dùng chung (Txt, Sheet, Btn…) nhận bảng màu tương ứng
 * qua `themePalette()` nên cũng đổi theo. Màu chữ trên nền đã kiểm tra tương phản ≥ 4,5:1 ở cả bốn giao diện.
 * Các thành phần cũ (`STUDENT`, `GameButton`, `BlockCard`, `IconBadge`) giữ cho danh sách lớp và màn Nhập vai cũ.
 */
import React, { createContext, useContext } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View, useWindowDimensions, type ScrollViewInstance, type StyleProp, type ViewStyle } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { Txt } from '@/components/ui';
import { PALETTES, type Palette } from '@/constants/theme';
import type { IconType } from '@/types/game';
import type { ThemeCode } from '@/types/saga';

// ---------------------------------------------------------------------- bốn giao diện
export interface BtTheme {
  code: ThemeCode; name: string; dark: boolean; desc: string;
  /** nền trang, thẻ, thẻ chìm (khóa / phụ), nền thanh tab, viền, viền đậm */
  bg: string; card: string; card2: string; seg: string; line: string; line2: string;
  /** chữ chính, chữ phụ đậm, chữ phụ */
  ink: string; soft: string; muted: string;
  /** màu nhấn (nút chính, mục đang chọn) và chữ trên màu nhấn */
  accent: string; onAccent: string;
  /** dải đỏ đậm (thẻ chặng đang học, đầu Hồ sơ) và chữ trên đó */
  hero: string; onHero: string; onHeroMuted: string;
  /** khối tối (Hội đồng, Binh thư nổi bật) và chữ trên đó */
  night: string; night2: string; onNight: string; onNightMuted: string;
  /** vàng (chữ trên nền tối, nút phụ), đồng, chữ vàng trên nền sáng, nền vàng nhạt */
  gold: string; bronze: string; goldInk: string; goldSoft: string;
  /** xanh sông nước (Tiểu Tướng, thẻ địa thế), xanh tre (đã xong), đỏ báo sai */
  teal: string; tealSoft: string; green: string; greenSoft: string; danger: string; dangerSoft: string;
}

const THANG_LONG: BtTheme = {
  code: 'thang-long', name: 'Thăng Long', dark: false, desc: 'Mặc định: nền giấy dó, đỏ son và vàng đồng như cung điện Thăng Long.',
  bg: '#F7EFE0', card: '#FFFBF2', card2: '#F1E8D6', seg: '#EADFCB', line: '#E6D9C2', line2: '#D9C39B',
  ink: '#2A1D14', soft: '#4A3A2C', muted: '#6B5A4A', accent: '#A61E1E', onAccent: '#FFFFFF',
  hero: '#7E1616', onHero: '#FFF6E5', onHeroMuted: '#F3E3C8', night: '#2A1D14', night2: '#3E2E22', onNight: '#FFF6E5', onNightMuted: '#E8D9BE',
  gold: '#F2C66D', bronze: '#C9902A', goldInk: '#8A5A0B', goldSoft: '#FBF1DC',
  teal: '#2F5563', tealSoft: '#E4ECEE', green: '#2E6B3A', greenSoft: '#E3EEDF', danger: '#A61E1E', dangerSoft: '#FBEDEA',
};
export const BT_THEMES: Record<ThemeCode, BtTheme> = {
  'thang-long': THANG_LONG,
  'bach-dang': {
    ...THANG_LONG, code: 'bach-dang', name: 'Sông Bạch Đằng', desc: 'Xanh sông nước, dịu mắt khi học lâu. Hợp với người thích các trận thủy chiến.',
    bg: '#E6EFF0', card: '#FFFFFF', card2: '#EDF3F4', seg: '#D5E3E6', line: '#C7D8DC', line2: '#A9C3C9', ink: '#14252B', soft: '#2E4148', muted: '#4F6369',
    accent: '#2F5563', hero: '#1F4250', onHeroMuted: '#D7E6EA', night: '#14252B', night2: '#22363D', onNightMuted: '#C9D6D9', goldSoft: '#F4EEDC',
  },
  'dem-dong-bo-dau': {
    ...THANG_LONG, code: 'dem-dong-bo-dau', name: 'Đêm Đông Bộ Đầu', dark: true, desc: 'Giao diện tối, gợi trận đánh úp ban đêm năm 1258. Đỡ chói mắt khi học buổi tối.',
    bg: '#17191F', card: '#22262E', card2: '#1C1F26', seg: '#2A2F38', line: '#3A404B', line2: '#4A5260', ink: '#F1EBDD', soft: '#DCD4C4', muted: '#ABA397',
    accent: '#E0A33A', onAccent: '#17191F', hero: '#2C3340', onHero: '#F1EBDD', onHeroMuted: '#C9C1B2', night: '#0F1115', night2: '#262A33', onNight: '#F1EBDD', onNightMuted: '#BDB5A6',
    gold: '#E0A33A', bronze: '#B98A3A', goldInk: '#E8B55A', goldSoft: '#2E2A22', teal: '#7FB2C2', tealSoft: '#1D2A30', green: '#7CC48A', greenSoft: '#1B2B20', danger: '#F08070', dangerSoft: '#3A2022',
  },
  'hoang-thanh': {
    ...THANG_LONG, code: 'hoang-thanh', name: 'Hoàng thành', desc: 'Vàng son hoàng thành, chỉ dành cho học sinh đã đỗ Trạng nguyên.',
    bg: '#FBF3DA', card: '#FFFDF4', card2: '#F4EACB', seg: '#EFE2B8', line: '#E8D7A8', line2: '#D9C17E', accent: '#8A5A0B', hero: '#5C3A06', goldSoft: '#F7ECCB',
  },
};
export const themeOf = (code?: string | null): BtTheme => BT_THEMES[(code ?? '') as ThemeCode] ?? THANG_LONG;

/** Bảng màu cho các thành phần dùng chung (Txt, Sheet, Btn, ô nhập…) theo giao diện đang dùng */
export function themePalette(t: BtTheme): Palette {
  const base = t.dark ? PALETTES.dark : PALETTES.light;
  return {
    ...base,
    giay: t.bg, giay2: t.card2, the: t.card, the2: t.goldSoft, muc: t.ink, muc2: t.muted, muc3: t.muted, vien: t.line, vien2: t.line2,
    son: t.danger, sonDam: t.hero, sonNhat: t.dangerSoft, sonChu: t.danger, ngoc: t.green, ngocDam: t.green, ngocNhat: t.greenSoft, ngocChu: t.green,
    moc: t.green, mocNhat: t.greenSoft, mocChu: t.green, vang: t.gold, vangDam: t.bronze, vangNhat: t.goldSoft, vangChu: t.goldInk, dong: t.bronze, dongDam: t.goldInk,
    thuy: t.teal, thuyNhat: t.tealSoft, thuyChu: t.teal, logoInk: t.ink, logoPaper: t.bg, logoRed: t.accent, logoGold: t.gold,
    adminLine: t.line, adminCanvas: t.card2, adminTint: t.goldSoft, scrim: 'rgba(20, 14, 10, 0.6)',
  };
}

const BtContext = createContext<BtTheme>(THANG_LONG);
export const BtProvider = BtContext.Provider;
/** Màu của giao diện học sinh đang dùng */
export const useBT = (): BtTheme => useContext(BtContext);
/** Bảng màu mặc định (giữ tên cũ cho các nơi còn nhập) */
export const STUDENT_PALETTE: Palette = themePalette(THANG_LONG);

// ---------------------------------------------------------------------- bố cục
/** Trang của học sinh: cuộn dọc, lề 16 trên điện thoại; chừa chỗ cho thanh điều hướng dưới đáy khi có */
export const BtPage: React.FC<{ children: React.ReactNode; testID: string; max?: number; scrollRef?: React.Ref<ScrollViewInstance>; tabBar?: boolean; gap?: number; pad?: number }> = ({ children, testID, max = 1080, scrollRef, tabBar = true, gap = 14, pad }) => {
  const t = useBT();
  const { width } = useWindowDimensions();
  const phone = width < 900;
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }} testID={testID}>
      <ScrollView ref={scrollRef} style={{ flex: 1 }} keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: pad ?? (phone ? 16 : 24), paddingBottom: phone && tabBar ? 108 : 40, gap, maxWidth: max, width: '100%', alignSelf: 'center' }}>
        {children}
      </ScrollView>
    </View>
  );
};

/** Hai cột trên màn rộng, một cột trên điện thoại */
export const Columns: React.FC<{ left: React.ReactNode; right: React.ReactNode; split?: number }> = ({ left, right, split = 1.35 }) => {
  const { width } = useWindowDimensions();
  if (width < 980) return <View style={{ gap: 14 }}>{left}{right}</View>;
  return (
    <View style={{ flexDirection: 'row', gap: 18, alignItems: 'flex-start' }}>
      <View style={{ flex: split, gap: 14, minWidth: 0 }}>{left}</View>
      <View style={{ flex: 1, gap: 14, minWidth: 0 }}>{right}</View>
    </View>
  );
};

// ---------------------------------------------------------------------- chữ
export const Eyebrow: React.FC<{ text: string; color?: string; size?: number }> = ({ text, color, size = 11 }) => {
  const t = useBT();
  return <Txt f="heavy" size={size} color={color ?? t.accent} style={{ letterSpacing: 0.9 }}>{text.toUpperCase()}</Txt>;
};
export const SerifTitle: React.FC<{ children: React.ReactNode; size?: number; color?: string; center?: boolean }> = ({ children, size = 24, color, center }) => {
  const t = useBT();
  return <Txt f="serifBold" size={size} color={color ?? t.ink} center={center} accessibilityRole="header" style={{ lineHeight: Math.round(size * 1.25) }}>{children}</Txt>;
};

// ---------------------------------------------------------------------- thẻ, nút
type CardTone = 'card' | 'sunk' | 'night' | 'hero' | 'gold' | 'dashed';
export const BtCard: React.FC<{ children: React.ReactNode; tone?: CardTone; pad?: number; style?: StyleProp<ViewStyle>; testID?: string; radius?: number }> = ({ children, tone = 'card', pad = 14, style, testID, radius = 16 }) => {
  const t = useBT();
  const look: Record<CardTone, ViewStyle> = {
    card: { backgroundColor: t.card, borderWidth: 1, borderColor: t.line },
    sunk: { backgroundColor: t.card2, borderWidth: 1, borderColor: t.line },
    night: { backgroundColor: t.night },
    hero: { backgroundColor: t.hero },
    gold: { backgroundColor: t.goldSoft, borderWidth: 1, borderColor: t.line2 },
    dashed: { backgroundColor: t.card, borderWidth: 1, borderStyle: 'dashed', borderColor: t.line2 },
  };
  return <View testID={testID} style={[{ borderRadius: radius, padding: pad, gap: 10 }, look[tone], style]}>{children}</View>;
};

/** `glass`: nút phụ trên nền tối (dải đỏ chặng đang học, khối tối Hội đồng) */
type BtnTone = 'accent' | 'gold' | 'ghost' | 'green' | 'night' | 'muted' | 'glass';
export const BtButton: React.FC<{
  title?: string; onPress: () => void; tone?: BtnTone; icon?: IconType; iconRight?: IconType; disabled?: boolean; loading?: boolean; full?: boolean;
  testID?: string; label?: string; size?: 'sm' | 'md' | 'lg'; style?: StyleProp<ViewStyle>;
}> = ({ title, onPress, tone = 'accent', icon: Icon, iconRight: IconR, disabled, loading, full, testID, label, size = 'md', style }) => {
  const t = useBT();
  const c: Record<BtnTone, { bg: string; fg: string; line?: string }> = {
    accent: { bg: t.accent, fg: t.onAccent }, gold: { bg: t.gold, fg: '#2A1D14' }, ghost: { bg: 'transparent', fg: t.ink, line: t.line2 },
    green: { bg: t.green, fg: t.dark ? '#0F1115' : '#FFFFFF' }, night: { bg: t.night, fg: t.onNight }, muted: { bg: t.card2, fg: t.muted, line: t.line },
    glass: { bg: 'rgba(255,255,255,0.12)', fg: t.onHero, line: 'rgba(255,255,255,0.38)' },
  };
  const k = c[tone];
  const h = size === 'lg' ? 52 : size === 'sm' ? 40 : 46;
  const off = Boolean(disabled || loading);
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label ?? title} accessibilityState={{ disabled: off, busy: Boolean(loading) }} disabled={off} onPress={onPress} hitSlop={size === 'sm' ? 4 : 0}
      style={({ pressed }) => [{ minHeight: Math.max(h, 44), paddingHorizontal: title ? (size === 'sm' ? 12 : 16) : 10, borderRadius: 14, backgroundColor: k.bg, borderWidth: k.line ? 1 : 0, borderColor: k.line,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: off && !loading ? 0.55 : pressed ? 0.85 : 1, alignSelf: full ? 'stretch' : 'auto' }, style]}>
      {loading ? <ActivityIndicator size="small" color={k.fg} /> : Icon ? <Icon size={size === 'sm' ? 16 : 18} color={k.fg} strokeWidth={2.2} /> : null}
      {title ? <Txt f="heavy" size={size === 'lg' ? 16 : size === 'sm' ? 13 : 14} color={k.fg} numberOfLines={2} style={{ flexShrink: 1, textAlign: 'center' }}>{title}</Txt> : null}
      {IconR ? <IconR size={18} color={k.fg} strokeWidth={2.2} /> : null}
    </Pressable>
  );
};

/** Nút quay lại vuông 44×44 ở đầu màn */
export const BackButton: React.FC<{ onPress: () => void; label: string; dark?: boolean; testID?: string }> = ({ onPress, label, dark = false, testID = 'bt-back' }) => {
  const t = useBT();
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={4}
      style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: dark ? 'rgba(255,255,255,0.12)' : t.card, borderWidth: dark ? 0 : 1, borderColor: t.line, opacity: pressed ? 0.8 : 1 })}>
      <ChevronLeft size={20} color={dark ? t.onNight : t.ink} strokeWidth={2.4} />
    </Pressable>
  );
};

/** Đầu màn của một bước trong chặng: nút quay lại, dòng nhỏ (BƯỚC 2/5 · THÁM SỬ), tiêu đề có chân, phần phụ bên phải */
export const StepHeader: React.FC<{ eyebrow: string; title: string; onBack: () => void; backLabel: string; right?: React.ReactNode; dark?: boolean }> = ({ eyebrow, title, onBack, backLabel, right, dark = false }) => {
  const t = useBT();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <BackButton onPress={onBack} label={backLabel} dark={dark} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Eyebrow text={eyebrow} color={dark ? t.gold : t.accent} />
        <SerifTitle size={19} color={dark ? t.onNight : t.ink}>{title}</SerifTitle>
      </View>
      {right}
    </View>
  );
};

export const Pill: React.FC<{ text: string; bg?: string; fg?: string; strong?: boolean; testID?: string }> = ({ text, bg, fg, strong = false, testID }) => {
  const t = useBT();
  return (
    <View testID={testID} style={{ backgroundColor: bg ?? t.card2, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 }}>
      <Txt f={strong ? 'heavy' : 'semibold'} size={12} color={fg ?? t.soft}>{text}</Txt>
    </View>
  );
};

/** Thanh tiến độ mảnh (giá trị 0–1) */
export const BtBar: React.FC<{ value: number; color?: string; track?: string; height?: number; label: string; style?: StyleProp<ViewStyle> }> = ({ value, color, track, height = 8, label, style }) => {
  const t = useBT();
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }} style={[{ height, borderRadius: height / 2, backgroundColor: track ?? t.line, overflow: 'hidden' }, style]}>
      <View style={{ width: `${v * 100}%`, height: '100%', borderRadius: height / 2, backgroundColor: color ?? t.bronze }} />
    </View>
  );
};

/** Dải tab dạng viên (chọn khối, ngăn Binh thư, loại hàng ở Chợ phiên) */
export function SegTabs<T extends string | number>({ options, value, onChange, label, testID }: { options: Array<{ value: T; label: string; sub?: string }>; value: T; onChange: (v: T) => void; label: string; testID?: string }) {
  const t = useBT();
  return (
    <View role="tablist" accessibilityLabel={label} testID={testID} style={{ flexDirection: 'row', gap: 4, backgroundColor: t.seg, padding: 4, borderRadius: 12 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={String(o.value)} role="tab" accessibilityRole="tab" accessibilityLabel={o.sub ? `${o.label}, ${o.sub}` : o.label} accessibilityState={{ selected: on }} aria-selected={on}
            onPress={() => onChange(o.value)} testID={testID ? `${testID}-${o.value}` : undefined}
            style={({ pressed }) => ({ flex: 1, minHeight: 44, borderRadius: 9, paddingHorizontal: 4, paddingVertical: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? t.card : pressed ? t.card2 : 'transparent' })}>
            <Txt f="heavy" size={13} color={on ? t.accent : t.muted} center numberOfLines={1}>{o.label}</Txt>
            {o.sub ? <Txt f="semibold" size={10} color={on ? t.accent : t.muted} center numberOfLines={1}>{o.sub}</Txt> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Ô vuông "TT" của Tiểu Tướng (trợ lý AI) */
export const TtMark: React.FC<{ size?: number }> = ({ size = 36 }) => {
  const t = useBT();
  return (
    <View accessible={false} importantForAccessibility="no" style={{ width: size, height: size, borderRadius: Math.round(size * 0.28), backgroundColor: t.dark ? '#2F5563' : t.teal, alignItems: 'center', justifyContent: 'center' }}>
      <Txt f="serifBold" size={Math.round(size * 0.38)} color={t.gold}>TT</Txt>
    </View>
  );
};

/** Lời của Tiểu Tướng (nhận xét, gợi ý) */
export const TtSays: React.FC<{ children: React.ReactNode; tone?: 'card' | 'warn' | 'light'; testID?: string }> = ({ children, tone = 'card', testID }) => {
  const t = useBT();
  const bg = tone === 'warn' ? t.dangerSoft : tone === 'light' ? (t.dark ? t.card : '#FFF6E5') : t.card;
  return (
    <View testID={testID} style={{ flexDirection: 'row', gap: 10, backgroundColor: bg, borderRadius: 14, borderWidth: tone === 'card' ? 1 : 0, borderColor: t.line, padding: 12 }}>
      <TtMark size={32} />
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>{children}</View>
    </View>
  );
};

/** Ô chỉ số nhỏ (chuỗi ngày, vàng, chặng) */
export const StatTile: React.FC<{ value: string; label: string; color?: string; onPress?: () => void; testID?: string }> = ({ value, label, color, onPress, testID }) => {
  const t = useBT();
  const body = (
    <View style={{ gap: 1 }}>
      <Txt f="heavy" size={17} color={color ?? t.ink} numberOfLines={1}>{value}</Txt>
      <Txt size={11} color={t.muted} numberOfLines={1}>{label}</Txt>
    </View>
  );
  const box: ViewStyle = { flex: 1, minWidth: 0, backgroundColor: t.card, borderWidth: 1, borderColor: t.line, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, minHeight: 50 };
  if (!onPress) return <View style={box} testID={testID}>{body}</View>;
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={`${value} ${label}`} onPress={onPress} style={({ pressed }) => [box, { opacity: pressed ? 0.85 : 1 }]}>{body}</Pressable>;
};

/** Vòng 5 bước của chặng dạng 5 vạch (đã xong / đang làm / chưa) */
export const StepDots: React.FC<{ states: Array<'done' | 'now' | 'todo' | 'none'>; onDark?: boolean; label: string }> = ({ states, onDark = true, label }) => {
  const t = useBT();
  const color = (s: string) => (s === 'done' ? t.gold : s === 'now' ? (onDark ? t.onHero : t.accent) : s === 'none' ? 'transparent' : onDark ? 'rgba(255,255,255,0.28)' : t.line);
  return (
    <View accessible accessibilityLabel={label} style={{ flexDirection: 'row', gap: 4 }}>
      {states.map((s, i) => <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: color(s), borderWidth: s === 'none' ? 1 : 0, borderColor: onDark ? 'rgba(255,255,255,0.28)' : t.line, borderStyle: 'dashed' }} />)}
    </View>
  );
};

// ---------------------------------------------------------------------- phần cũ (danh sách lớp, màn Nhập vai cũ)
export const STUDENT = {
  ink: '#2b1d12', muted: '#6b5644', canvas: '#fff8ec', paper2: '#f8ecd6', white: '#ffffff', line: '#ecdcc2', line2: '#dcc39b',
  teal: '#c8261c', deep: '#9c1a12', mint: '#fdebe3', red: '#d6281e', redDeep: '#a11a12',
  gold: '#ffc23a', goldDeep: '#d99300', goldSoft: '#fff3d1', goldInk: '#6e4b00',
  green: '#46a840', greenDeep: '#2e7d2c', greenSoft: '#e6f4dc', greenInk: '#245f1d',
  jade: '#1f8a70', jadeSoft: '#dcf2ea', indigo: '#2d4a8a', indigoSoft: '#e3e9f6', orange: '#e8751a', orangeSoft: '#ffeedd',
  blue: '#2a6fb0',
};
type GameTone = 'red' | 'gold' | 'green' | 'paper';
/** Nút của danh sách lớp / màn Nhập vai cũ: nay theo màu của giao diện đang dùng */
export function GameButton({ title, onPress, icon, light = false, tone, testID, style, label, size = 'md' }: {
  title: string; onPress: () => void; icon?: IconType; light?: boolean; tone?: GameTone; testID?: string; style?: StyleProp<ViewStyle>; label?: string; size?: 'md' | 'lg';
}) {
  const k = tone ?? (light ? 'gold' : 'red');
  return <BtButton title={title} onPress={onPress} icon={icon} tone={k === 'gold' ? 'gold' : k === 'green' ? 'green' : k === 'paper' ? 'ghost' : 'accent'} testID={testID} label={label} size={size === 'lg' ? 'lg' : 'md'} style={[{ alignSelf: 'flex-start' }, style]} />;
}
export const BlockCard: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string; color?: string; bg?: string; pad?: number }> = ({ children, style, testID, pad = 18 }) => (
  <BtCard pad={pad} style={style} testID={testID}>{children}</BtCard>
);
export const IconBadge: React.FC<{ icon: IconType; color: string; size?: number; soft?: boolean }> = ({ icon: Icon, color, size = 36, soft = false }) => (
  <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: soft ? `${color}22` : color, alignItems: 'center', justifyContent: 'center' }}>
    <Icon size={Math.round(size * 0.5)} color={soft ? color : '#ffffff'} strokeWidth={2.5} />
  </View>
);
