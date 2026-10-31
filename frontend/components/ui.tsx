/**
 * Thành phần dùng cho ba trang công khai: chữ, nút, nhãn nhỏ và nền giấy dó.
 * Mọi nút có vùng chạm tối thiểu 44pt, nhãn cho trình đọc màn hình và phản hồi khi bấm không làm xô lệch bố cục.
 */
import { PatternOverlay } from '@/components/art';
import { FONT,toneColors,type FontName,type Tone } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';
import type { IconType } from '@/types/game';
import React, { useRef } from 'react';
import {
ActivityIndicator,Animated,
Platform,Pressable,
StyleSheet,Text,
View,
type StyleProp,
type ViewStyle
} from 'react-native';
import Svg,{ Circle,Defs,Path,Pattern,Rect } from 'react-native-svg';

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
              minHeight: Math.max(44, m.h), minWidth: iconOnly ? Math.max(44, m.h) : undefined, paddingHorizontal: iconOnly ? 0 : m.px, borderRadius: m.radius, backgroundColor: tone === 'ghost' && pressed ? c.giay2 : t.bg,
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

/** Nhãn nhỏ dạng viên thuốc */
export const Chip: React.FC<{ text: string; bg: string; fg: string; icon?: IconType; style?: StyleProp<ViewStyle> }> = ({ text, bg, fg, icon: Icon, style }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: bg, alignSelf: 'flex-start' }, style]}>
    {Icon && <Icon size={13} color={fg} strokeWidth={2.4} />}
    <Txt f="bold" size={12} color={fg} numberOfLines={1}>
      {text}
    </Txt>
  </View>
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
      <PatternOverlay opacity={dark ? 0.055 : 0.07} />
    </View>
  );
};
