/**
 * Bộ thành phần dùng chung: chữ, nút khối 3D ("jelly"), thẻ, chip, thanh tiến độ, công tắc, ô nhập, bảng trượt, thông báo nhanh.
 * Mọi nút có vùng chạm tối thiểu 44pt, nhãn cho trình đọc màn hình và phản hồi khi bấm không làm xô lệch bố cục.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo, ActivityIndicator, Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  useWindowDimensions, type StyleProp, type TextInputInstance, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Path, Pattern, Rect } from 'react-native-svg';
import { Info, Star, X } from 'lucide-react-native';
import { Mascot, type MascotMood } from '@/components/art';
import { FONT, ON_BRIGHT, toneColors, type FontName, type Palette, type Tone } from '@/constants/theme';
import { avatarColor, initialsOf } from '@/lib/format';
import { usePopIn, useReduceMotion } from '@/hooks/use-motion';
import { useStyles, useTheme } from '@/hooks/use-theme';
import type { IconType } from '@/types/game';

// ---------------------------------------------------------------------- chữ
type TxtProps = React.ComponentProps<typeof Text> & { f?: FontName; size?: number; color?: string; center?: boolean; upper?: boolean };

/** Chữ theo hệ thiết kế (cỡ mặc định 15, giới hạn phóng to 1.6 lần để không vỡ bố cục) */
export const Txt: React.FC<TxtProps> = ({ f = 'body', size = 15, color, center, upper, style, maxFontSizeMultiplier = 1.6, ...rest }) => {
  const { c } = useTheme();
  const display = f.startsWith('display');
  return (
    <Text
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[
        { fontFamily: FONT[f], fontSize: size, lineHeight: Math.round(size * (display ? 1.22 : 1.45)), color: color ?? c.muc },
        center && { textAlign: 'center' },
        upper && { textTransform: 'uppercase', letterSpacing: 0.6 },
        style,
      ]}
      {...rest}
    />
  );
};

// ---------------------------------------------------------------------- nút
type BtnSize = 'sm' | 'md' | 'lg';
const BTN: Record<BtnSize, { h: number; px: number; font: number; radius: number; depth: number; icon: number }> = {
  sm: { h: 40, px: 12, font: 14, radius: 14, depth: 3, icon: 18 },
  md: { h: 46, px: 18, font: 16, radius: 16, depth: 4, icon: 20 },
  lg: { h: 56, px: 24, font: 18, radius: 18, depth: 5, icon: 22 },
};

export interface BtnProps {
  title?: string;
  icon?: IconType;
  iconRight?: IconType;
  tone?: Tone;
  size?: BtnSize;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Nhãn cho trình đọc màn hình (bắt buộc với nút chỉ có biểu tượng) */
  label?: string;
  hint?: string;
  full?: boolean;
  upper?: boolean;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Nút khối 3D: mặt nút lún xuống viền đáy khi bấm, bật lại bằng lò xo (viền đáy giữ chỗ nên bố cục không đổi) */
export const Btn: React.FC<BtnProps> = ({
  title, icon: Icon, iconRight: IconRight, tone = 'son', size = 'md', onPress, disabled = false, loading = false, label, hint, full = false, upper = false,
  selected, style, testID,
}) => {
  const { c } = useTheme();
  const reduce = useReduceMotion();
  const press = useRef(new Animated.Value(0)).current;
  const m = BTN[size];
  const off = disabled || loading;
  const t = off ? { bg: c.giay2, edge: c.vien2, fg: c.muc3, border: undefined } : toneColors(c, tone);
  const iconOnly = !title;
  const flat = tone === 'ghost';
  const sink = (down: boolean) => {
    if (flat) return;
    if (reduce) press.setValue(down ? 1 : 0);
    else Animated.spring(press, { toValue: down ? 1 : 0, speed: 48, bounciness: down ? 0 : 10, useNativeDriver: Platform.OS !== 'web' }).start();
  };
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => sink(true)}
      onPressOut={() => sink(false)}
      disabled={off}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label ?? title}
      accessibilityHint={hint}
      accessibilityState={{ disabled: off, busy: loading, selected }}
      hitSlop={m.h < 44 ? (44 - m.h) / 2 : undefined}
      style={[full ? { alignSelf: 'stretch' } : { alignSelf: 'flex-start' }, style]}
    >
      {({ pressed }) => (
        <View style={{ paddingBottom: flat ? 0 : m.depth }}>
          {!flat && <View style={[StyleSheet.absoluteFill, { top: m.depth, borderRadius: m.radius, backgroundColor: t.edge }]} />}
          <Animated.View
            style={{
              minHeight: m.h, minWidth: iconOnly ? m.h : undefined, paddingHorizontal: iconOnly ? 0 : m.px, borderRadius: m.radius, backgroundColor: flat && pressed ? c.giay2 : t.bg,
              borderWidth: t.border ? 2 : 0, borderColor: t.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              transform: [{ translateY: press.interpolate({ inputRange: [0, 1], outputRange: [0, m.depth - 1] }) }],
            }}
          >
            {loading ? <ActivityIndicator size="small" color={t.fg} /> : Icon ? <Icon size={m.icon} color={t.fg} strokeWidth={2.4} /> : null}
            {title ? (
              <Txt f="display" size={m.font} color={t.fg} upper={upper} center numberOfLines={2} style={{ flexShrink: 1 }}>
                {title}
              </Txt>
            ) : null}
            {IconRight && <IconRight size={m.icon} color={t.fg} strokeWidth={2.4} />}
          </Animated.View>
        </View>
      )}
    </Pressable>
  );
};

// ---------------------------------------------------------------------- khối
const cardStyles = (c: Palette) => ({
  card: { backgroundColor: c.the, borderWidth: 2, borderColor: c.vien, borderBottomWidth: 6, borderBottomColor: c.vien2, borderRadius: 22 },
  flat: { backgroundColor: c.the, borderWidth: 2, borderColor: c.vien, borderRadius: 18 },
  inset: { backgroundColor: c.giay2, borderRadius: 16 },
});

/** Thẻ giấy có viền đáy (flat: không có khối) */
export const Card: React.FC<{ children: React.ReactNode; flat?: boolean; pad?: number; style?: StyleProp<ViewStyle> }> = ({ children, flat = false, pad = 16, style }) => {
  const s = useStyles(cardStyles);
  return <View style={[flat ? s.flat : s.card, { padding: pad }, style]}>{children}</View>;
};

/** Ô nền chìm (giấy dó đậm) */
export const Inset: React.FC<{ children: React.ReactNode; pad?: number; style?: StyleProp<ViewStyle> }> = ({ children, pad = 12, style }) => {
  const s = useStyles(cardStyles);
  return <View style={[s.inset, { padding: pad }, style]}>{children}</View>;
};

/** Thẻ bấm được (cả thẻ là một nút) */
export const PressCard: React.FC<{
  children: React.ReactNode;
  onPress: () => void;
  label: string;
  hint?: string;
  pad?: number;
  disabled?: boolean;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}> = ({ children, onPress, label, hint, pad = 16, disabled = false, selected, style, testID }) => {
  const s = useStyles(cardStyles);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled, selected }}
      style={({ pressed }) => [s.card, { padding: pad, transform: [{ translateY: pressed ? 3 : 0 }], opacity: disabled ? 0.6 : 1 }, style]}
    >
      {children}
    </Pressable>
  );
};

/** Nhãn nhỏ dạng viên thuốc */
export const Chip: React.FC<{ text: string; bg: string; fg: string; icon?: IconType; style?: StyleProp<ViewStyle> }> = ({ text, bg, fg, icon: Icon, style }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: bg, alignSelf: 'flex-start' }, style]}>
    {Icon && <Icon size={13} color={fg} strokeWidth={2.4} />}
    <Txt f="bold" size={12} color={fg} numberOfLines={1}>
      {text}
    </Txt>
  </View>
);

/** Chỉ số trên thanh HUD (Lương Thảo, Quân Lực, Ấn Tín...) */
export const HudPill: React.FC<{ icon: IconType; value: string; label: string; tone: string }> = ({ icon: Icon, value, label, tone }) => {
  const { c } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingLeft: 4, paddingRight: 12, borderRadius: 999, backgroundColor: c.the, borderWidth: 2, borderColor: c.vien }}
    >
      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: tone, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={15} color="#ffffff" strokeWidth={2.4} />
      </View>
      <Txt f="display" size={16} style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </Txt>
    </View>
  );
};

/** Thanh tiến độ */
export const Bar: React.FC<{ value: number; max: number; fill?: string; height?: number; label?: string; style?: StyleProp<ViewStyle> }> = ({ value, max, fill, height = 12, label, style }) => {
  const { c } = useTheme();
  const pctValue = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <View
      accessible={!!label}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: Math.round(max), now: Math.round(value) }}
      style={[{ height, borderRadius: 999, backgroundColor: c.vien, overflow: 'hidden' }, style]}
    >
      <View style={{ width: `${pctValue}%`, height: '100%', borderRadius: 999, backgroundColor: fill ?? c.ngoc }}>
        {height >= 10 && <View style={{ position: 'absolute', left: 6, right: 6, top: height * 0.22, height: Math.max(2, height * 0.22), borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.35)' }} />}
      </View>
    </View>
  );
};

export const Stars: React.FC<{ n: number; max?: number; size?: number; label?: string }> = ({ n, max = 3, size = 18, label }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 2 }} accessible accessibilityRole="image" accessibilityLabel={label ?? `${n}/${max} sao`}>
      {Array.from({ length: max }, (_, i) => (
        <Star key={i} size={size} color={i < n ? c.dong : c.vien2} fill={i < n ? c.dong : 'transparent'} strokeWidth={2.2} />
      ))}
    </View>
  );
};

/** Dòng cài đặt bật/tắt */
export const ToggleRow: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string; icon: IconType }> = ({ checked, onChange, label, desc, icon: Icon }) => {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={desc}
      accessibilityState={{ checked }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.giay2, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={20} color={c.muc2} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt f="semibold">{label}</Txt>
        {desc && (
          <Txt size={13} color={c.muc2}>
            {desc}
          </Txt>
        )}
      </View>
      <View style={{ width: 48, height: 28, borderRadius: 14, backgroundColor: checked ? c.ngoc : c.vien2, justifyContent: 'center' }}>
        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#ffffff', marginLeft: checked ? 24 : 4 }} />
      </View>
    </Pressable>
  );
};

/** Nhóm nút chọn một (thẻ phân loại) */
export function Segmented<T extends string | number>({ options, value, onChange, label }: { options: Array<{ value: T; label: string }>; value: T; onChange: (v: T) => void; label: string }) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 999, justifyContent: 'center', backgroundColor: on ? c.ngoc : c.the, borderWidth: 2, borderColor: on ? c.ngoc : c.vien }}
            hitSlop={4}
          >
            <Txt f="bold" size={14} color={on ? ON_BRIGHT : c.muc2}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

export const Spinner: React.FC<{ label?: string; color?: string }> = ({ label = 'Đang tải…', color }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' }} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator color={color ?? c.ngoc} />
      <Txt f="semibold" color={color ?? c.muc2}>
        {label}
      </Txt>
    </View>
  );
};

/** Khung chờ tải (nhấp nháy nhẹ) */
export const Skeleton: React.FC<{ height?: number; width?: ViewStyle['width']; radius?: number; style?: StyleProp<ViewStyle> }> = ({ height = 16, width = '100%', radius = 12, style }) => {
  const { c } = useTheme();
  const v = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(v, { toValue: 0.5, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return <Animated.View accessibilityElementsHidden importantForAccessibility="no" style={[{ height, width, borderRadius: radius, backgroundColor: c.giay2, opacity: v }, style]} />;
};

export const EmptyState: React.FC<{ mood?: MascotMood; title: string; text?: string; action?: React.ReactNode }> = ({ mood = 'thinking', title, text, action }) => {
  const { c } = useTheme();
  return (
    <Card flat style={{ alignItems: 'center', gap: 6 }} pad={24}>
      <Mascot size={96} mood={mood} />
      <Txt f="display" size={18} center>
        {title}
      </Txt>
      {text && (
        <Txt size={14} color={c.muc2} center style={{ maxWidth: 420 }}>
          {text}
        </Txt>
      )}
      {action}
    </Card>
  );
};

export const InfoNote: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle> }> = ({ children, style }) => {
  const { c } = useTheme();
  return (
    <View style={[{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }, style]}>
      <Info size={16} color={c.muc2} style={{ marginTop: 3 }} />
      <Txt size={14} color={c.muc2} style={{ flex: 1 }}>
        {children}
      </Txt>
    </View>
  );
};

export const SectionTitle: React.FC<{ title: string; subtitle?: string; action?: React.ReactNode; style?: StyleProp<ViewStyle> }> = ({ title, subtitle, action, style }) => {
  const { c } = useTheme();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }, style]}>
      <View style={{ flex: 1 }}>
        <Txt f="displayHeavy" size={22} accessibilityRole="header">
          {title}
        </Txt>
        {subtitle && (
          <Txt size={14} color={c.muc2}>
            {subtitle}
          </Txt>
        )}
      </View>
      {action}
    </View>
  );
};

/** Markdown đơn giản của kho tri thức: **đậm** và gạch đầu dòng (•, -, *) */
export const RichText: React.FC<{ text: string; size?: number; color?: string }> = ({ text, size = 15, color }) => {
  const { c } = useTheme();
  const inline = (line: string) =>
    line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
      part.startsWith('**') && part.endsWith('**') ? (
        <Text key={j} style={{ fontFamily: FONT.bold, color: c.muc }}>
          {part.slice(2, -2)}
        </Text>
      ) : (
        <Text key={j}>{part}</Text>
      ),
    );
  return (
    <View style={{ gap: 8 }}>
      {text
        .split(/\n+/)
        .filter((l) => l.trim())
        .map((line, i) => {
          const bullet = /^\s*[•\-*]\s+/.test(line);
          const body = line.replace(/^\s*[•\-*]\s+/, '');
          return bullet ? (
            <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.dong, marginTop: size * 0.6 }} />
              <Txt size={size} color={color ?? c.muc2} style={{ flex: 1 }}>
                {inline(body)}
              </Txt>
            </View>
          ) : (
            <Txt key={i} size={size} color={color ?? c.muc2}>
              {inline(body)}
            </Txt>
          );
        })}
    </View>
  );
};

/** Ảnh đại diện chữ cái đầu */
export const Avatar: React.FC<{ name: string; size?: number }> = ({ name, size = 40 }) => (
  <View
    accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants"
    style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: avatarColor(name), alignItems: 'center', justifyContent: 'center' }}
  >
    <Txt f="display" size={size * 0.4} color="#ffffff">
      {initialsOf(name)}
    </Txt>
  </View>
);

// ---------------------------------------------------------------------- ô nhập
const fieldStyles = (c: Palette) => ({
  input: {
    minHeight: 48, borderRadius: 14, borderWidth: 2, borderColor: c.vien, backgroundColor: c.the2, paddingHorizontal: 14, paddingVertical: 10,
    fontFamily: FONT.semibold, fontSize: 16, color: c.muc,
  } as TextStyle,
});

export const Field: React.FC<
  Omit<TextInputProps, 'style'> & { label: string; error?: string | null; hint?: string; inputRef?: React.Ref<TextInputInstance>; style?: StyleProp<ViewStyle>; inputStyle?: StyleProp<TextStyle> }
> = ({ label, error, hint, inputRef, style, inputStyle, onFocus, onBlur, ...rest }) => {
  const { c } = useTheme();
  const s = useStyles(fieldStyles);
  const [focus, setFocus] = useState(false);
  return (
    <View style={[{ gap: 6 }, style]}>
      <Txt f="bold" size={14} color={c.muc2} nativeID={rest.nativeID ? `${rest.nativeID}-label` : undefined}>
        {label}
      </Txt>
      <TextInput
        ref={inputRef}
        placeholderTextColor={c.muc3}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        onFocus={(e) => {
          setFocus(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocus(false);
          onBlur?.(e);
        }}
        style={[s.input, { borderColor: error ? c.son : focus ? c.thuy : c.vien }, inputStyle]}
        {...rest}
      />
      {error ? (
        <Txt size={13} f="semibold" color={c.sonChu} accessibilityLiveRegion="polite">
          {error}
        </Txt>
      ) : hint ? (
        <Txt size={13} color={c.muc2}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
};

// ---------------------------------------------------------------------- thông báo nhanh
interface ToastState {
  msg: string;
  key: number;
}
const ToastContext = createContext<{ toast: ToastState | null; show: (msg: string) => void }>({ toast: null, show: () => undefined });

/** Hiện thông báo ngắn ở đầu màn hình (cũng được đọc cho trình đọc màn hình) */
export const useToast = () => useContext(ToastContext).show;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((msg: string) => {
    setToast({ msg, key: Date.now() });
    AccessibilityInfo.announceForAccessibility(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 3500);
  }, []);
  const value = useMemo(() => ({ toast, show }), [toast, show]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastView />
    </ToastContext.Provider>
  );
};

/** Vẽ thông báo; mỗi bảng trượt cũng vẽ một bản để thông báo nổi trên hộp thoại */
export const ToastView: React.FC = () => {
  const { toast } = useContext(ToastContext);
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const pop = usePopIn(toast?.key ?? null);
  if (!toast) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 12, left: 0, right: 0, alignItems: 'center', zIndex: 100 }}>
      <Animated.View
        accessibilityRole="alert"
        style={[
          {
            flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: 460, marginHorizontal: 16, paddingLeft: 8, paddingRight: 16, paddingVertical: 8, borderRadius: 18,
            backgroundColor: c.the, borderWidth: 2, borderColor: c.vien, borderBottomWidth: 5, borderBottomColor: c.vien2,
          },
          pop,
        ]}
      >
        <Mascot size={38} mood="excited" />
        <Txt f="bold" size={14} style={{ flexShrink: 1 }}>
          {toast.msg}
        </Txt>
      </Animated.View>
    </View>
  );
};

// ---------------------------------------------------------------------- bảng trượt / hộp thoại
const sheetStyles = (c: Palette) => ({
  backdrop: { flex: 1, backgroundColor: c.scrim, alignItems: 'center' as const },
  panel: { width: '100%' as const, backgroundColor: c.giay, overflow: 'hidden' as const },
  head: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: c.vien, backgroundColor: c.giay },
  handle: { alignSelf: 'center' as const, width: 48, height: 5, borderRadius: 3, backgroundColor: c.vien2, marginBottom: 8 },
  foot: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 2, borderTopColor: c.vien, backgroundColor: c.giay },
});

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
  /** Không cho đóng bằng nút X / chạm nền / phím Back */
  persistent?: boolean;
  /** Nội dung tự cuộn (mặc định có) */
  scroll?: boolean;
  /** Nền tối riêng (màn thi đấu) */
  panelStyle?: StyleProp<ViewStyle>;
}

/** Khung bảng: tiêu đề, nội dung cuộn, chân (dùng chung cho Sheet và InlineSheet) */
const SheetPanel: React.FC<Omit<SheetProps, 'open'>> = ({ onClose, title, subtitle, icon, children, footer, wide = false, persistent = false, scroll = true, panelStyle }) => {
  const { c } = useTheme();
  const s = useStyles(sheetStyles);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const centered = width >= 680;
  return (
    <View style={[s.backdrop, { justifyContent: centered ? 'center' : 'flex-end', padding: centered ? 24 : 0 }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={persistent ? undefined : onClose} accessible={false} importantForAccessibility="no" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%', alignItems: 'center' }}>
        <View
          accessibilityViewIsModal
          aria-modal
          role="dialog"
          aria-label={title}
          style={[
            s.panel,
            centered
              ? { borderRadius: 24, maxWidth: wide ? 880 : 560, maxHeight: height - 48 }
              : { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: height - Math.max(insets.top, 24), paddingBottom: footer ? 0 : insets.bottom },
            panelStyle,
          ]}
        >
          <View style={s.head}>
            {!centered && <View style={s.handle} />}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              {icon}
              <View style={{ flex: 1 }}>
                <Txt f="displayHeavy" size={20} accessibilityRole="header">
                  {title}
                </Txt>
                {subtitle && (
                  <Txt size={14} color={c.muc2}>
                    {subtitle}
                  </Txt>
                )}
              </View>
              {!persistent && <Btn tone="ghost" icon={X} label="Đóng" onPress={onClose} size="sm" />}
            </View>
          </View>
          {scroll ? (
            <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          ) : (
            <View style={{ flexShrink: 1, padding: 16, gap: 14 }}>{children}</View>
          )}
          {footer && <View style={[s.foot, { paddingBottom: 12 + (centered ? 0 : insets.bottom) }]}>{footer}</View>}
        </View>
      </KeyboardAvoidingView>
      <ToastView />
    </View>
  );
};

/** Bảng trượt từ dưới lên trên điện thoại, hộp thoại giữa màn hình trên máy tính bảng / web rộng */
export const Sheet: React.FC<SheetProps> = ({ open, ...props }) => {
  const { width } = useWindowDimensions();
  return (
    <Modal
      visible={open}
      transparent
      animationType={width >= 680 ? 'fade' : 'slide'}
      onRequestClose={() => {
        if (!props.persistent) props.onClose();
      }}
      statusBarTranslucent
    >
      <SheetPanel {...props} />
    </Modal>
  );
};

/** Bảng nổi ngay trong màn hình hiện tại (dùng bên trong màn toàn màn hình như trận đánh, phòng thi đấu – không mở Modal lồng nhau) */
export const InlineSheet: React.FC<SheetProps> = ({ open, ...props }) =>
  open ? (
    <View style={[StyleSheet.absoluteFill, { zIndex: 80 }]}>
      <SheetPanel {...props} />
    </View>
  ) : null;

/** Mở hộp thoại tiếp theo sau khi hộp thoại hiện tại đóng hẳn (iOS không cho hai Modal chuyển cảnh cùng lúc) */
export const afterSheet = (fn: () => void) => setTimeout(fn, Platform.OS === 'ios' ? 450 : 0);

/** Hộp thoại xác nhận thao tác khó hoàn tác */
export const ConfirmSheet: React.FC<{
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  tone?: Tone;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ open, title, message, confirmLabel, tone = 'son', busy = false, onConfirm, onCancel }) => (
  <Sheet
    open={open}
    onClose={onCancel}
    title={title}
    footer={
      <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <Btn title="Hủy" tone="giay" onPress={onCancel} disabled={busy} />
        <Btn title={confirmLabel} tone={tone} onPress={onConfirm} loading={busy} />
      </View>
    }
  >
    <Txt>{message}</Txt>
  </Sheet>
);

// ---------------------------------------------------------------------- nền
/** Nền giấy dó: chấm mực và sóng nước Bạch Đằng mờ */
export const PaperBg: React.FC = () => {
  const { c, dark } = useTheme();
  const id = React.useId().replace(/:/g, '');
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: c.giay }]}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id={`d${id}`} width="18" height="18" patternUnits="userSpaceOnUse">
            <Circle cx="9" cy="9" r="1.2" fill={dark ? 'rgba(148,163,184,0.09)' : 'rgba(146,64,14,0.08)'} />
          </Pattern>
          <Pattern id={`w${id}`} width="120" height="60" patternUnits="userSpaceOnUse">
            <Path d="M0 40 Q15 28 30 40 T60 40 T90 40 T120 40" fill="none" stroke={dark ? 'rgba(56,189,248,0.08)' : 'rgba(180,83,9,0.07)'} strokeWidth="2" />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#d${id})`} />
        <Rect width="100%" height="100%" fill={`url(#w${id})`} />
      </Svg>
    </View>
  );
};

/** Khung màn hình: nền giấy, chừa vùng an toàn (tai thỏ, thanh điều hướng), nội dung giới hạn bề ngang trên màn rộng */
export const Screen: React.FC<{ children: React.ReactNode; scroll?: boolean; maxWidth?: number; pad?: number; edges?: Array<'top' | 'bottom'>; contentStyle?: StyleProp<ViewStyle> }> = ({
  children, scroll = true, maxWidth = 1100, pad = 16, edges = ['top', 'bottom'], contentStyle,
}) => {
  const insets = useSafeAreaInsets();
  const padding = {
    paddingTop: (edges.includes('top') ? insets.top : 0) + pad,
    paddingBottom: (edges.includes('bottom') ? insets.bottom : 0) + pad,
    paddingLeft: insets.left + pad,
    paddingRight: insets.right + pad,
  };
  const inner = [{ width: '100%' as const, maxWidth, alignSelf: 'center' as const, gap: 16 }, contentStyle];
  return (
    <View style={{ flex: 1 }}>
      <PaperBg />
      {scroll ? (
        <ScrollView contentContainerStyle={[padding, { flexGrow: 1 }]} keyboardShouldPersistTaps="handled">
          <View style={inner}>{children}</View>
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, padding]}>
          <View style={[inner, { flex: 1 }]}>{children}</View>
        </View>
      )}
    </View>
  );
};
