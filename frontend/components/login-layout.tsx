import React, { useId, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions, type TextInputInstance, type TextInputProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Image as SvgImage, Pattern, Polygon } from 'react-native-svg';
import { ArrowLeft, ArrowRight, Eye, EyeOff } from 'lucide-react-native';
import { BrandLogo, FilmBackdrop, PatternOverlay } from '@/components/art';
import { HeritageBackdrop } from '@/components/admin/HeritageBackdrop';
import { Txt } from '@/components/ui';
import { FONT } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const PAPER_PATTERN = require('../assets/hoa-tiet-nen.png');
export const useLoginDensity = () => useWindowDimensions().height < 700;

/** One visual system for the independent admin and school sign-in flows. */
export function LoginLayout({ kind, subtitle, children, onHome }: { kind: 'admin' | 'school'; subtitle: string; children: React.ReactNode; onHome?: () => void }) {
  const { c } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const wide = width >= 860;
  const dense = height < 700;
  const edge = height < 650 ? 12 : wide ? 24 : 16;
  const cardWidth = Math.min(1000, width - edge * 2);
  const cardHeight = Math.min(wide ? 680 : 800, Math.max(200, height - insets.top - insets.bottom - edge * 2));
  const prefix = `${kind}-login`;
  const paperId = `login-paper-${useId().replace(/:/g, '')}`;
  return <KeyboardAvoidingView testID={`${prefix}-shell`} style={{ flex: 1, minHeight: 0, overflow: 'hidden', backgroundColor: c.logoPaper }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <HeritageBackdrop />
    <View style={{ flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: edge, paddingTop: insets.top + edge, paddingBottom: insets.bottom + edge }}>
      <View testID={`${prefix}-card`} style={{ width: '100%', maxWidth: 1000, height: cardHeight, maxHeight: '100%', backgroundColor: c.logoPaper, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)', boxShadow: '0 24px 80px rgba(85,49,19,0.22)', overflow: 'hidden' }}>
        <View testID={`${prefix}-art`} style={wide ? { position: 'absolute', left: 0, top: 0, bottom: 0, width: '50%', overflow: 'hidden', backgroundColor: c.dem } : { height: dense ? 64 : 112, overflow: 'hidden', backgroundColor: c.dem }}>
          <FilmBackdrop wide={wide} />
          <LinearGradient colors={[`${c.dem}db`, `${c.dem}b3`, `${c.dem}80`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.4 }} style={StyleSheet.absoluteFill} />
          <View testID={`${prefix}-brand`} style={{ position: 'absolute', left: wide ? 28 : 16, top: wide ? 28 : dense ? 9 : 18 }}><BrandLogo light subtitle={subtitle} /></View>
          {onHome && <Pressable onPress={onHome} accessibilityRole="link" accessibilityLabel="Về trang chủ" style={wide ? { position: 'absolute', left: 28, bottom: 20, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 } : { position: 'absolute', top: dense ? 9 : 18, right: 12, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <ArrowLeft size={18} color={c.trang} />{wide && <Txt f="semibold" size={12} color={c.trang}>Về trang chủ</Txt>}
          </Pressable>}
        </View>
        {wide && <Svg testID={`${prefix}-paper`} pointerEvents="none" width="100%" height="100%" viewBox={`0 0 ${cardWidth} ${cardHeight}`} preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
          <Defs><Pattern id={paperId} width={382} height={512} patternUnits="userSpaceOnUse"><SvgImage href={PAPER_PATTERN} width={382} height={512} opacity={0.075} /></Pattern></Defs>
          <Polygon testID={`${prefix}-diagonal`} points={`${cardWidth * 0.46},0 ${cardWidth},0 ${cardWidth},${cardHeight} ${cardWidth * 0.39},${cardHeight}`} fill={c.logoPaper} />
          <Polygon points={`${cardWidth * 0.46},0 ${cardWidth},0 ${cardWidth},${cardHeight} ${cardWidth * 0.39},${cardHeight}`} fill={`url(#${paperId})`} />
        </Svg>}
        <View testID={`${prefix}-panel`} style={wide ? { position: 'absolute', left: '44%', right: 0, top: 0, bottom: 0 } : { flex: 1, minHeight: 0 }}>
          {!wide && <PatternOverlay opacity={0.075} />}
          <ScrollView testID={`${prefix}-form`} keyboardShouldPersistTaps="handled" style={{ flex: 1, minHeight: 0 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: wide ? 32 : 20, paddingVertical: dense ? 10 : 16 }}>
            <View testID={`${prefix}-content`} style={{ width: '100%', maxWidth: 460, alignSelf: 'center', gap: dense ? 10 : 14 }}>
              {children}
              <Txt f="body" size={dense ? 10 : 11} color={c.muc3} center>© 2026 · Bản quyền thuộc quản lý Đông A</Txt>
            </View>
          </ScrollView>
        </View>
      </View>
    </View>
  </KeyboardAvoidingView>;
}

export function LoginHeading({ title, text, testIDPrefix = 'admin-auth' }: { title: string; text?: string; testIDPrefix?: string }) {
  const { c } = useTheme();
  const dense = useLoginDensity();
  const parts: Record<string, [string, string]> = { 'Đăng nhập': ['Đăng', 'nhập'], 'Quên mật khẩu': ['Quên', 'mật khẩu'], 'Đặt mật khẩu mới': ['Đặt', 'mật khẩu mới'], 'Kiểm tra hộp thư': ['Kiểm tra', 'hộp thư'] };
  const [main, accent] = parts[title] ?? [title, ''];
  const size = dense ? 28 : 32;
  return <View testID={`${testIDPrefix}-heading`} style={{ gap: dense ? 6 : 8 }}>
    <Txt testID={`${testIDPrefix}-title`} f="heavy" size={size} color={c.logoInk} accessibilityRole="header" style={{ lineHeight: dense ? 36 : 42 }}>{main}{accent ? ' ' : ''}{accent && <Txt testID={`${testIDPrefix}-title-accent`} f="serifItalic" size={size} color={c.logoRed} style={{ lineHeight: dense ? 36 : 42 }}>{accent}</Txt>}</Txt>
    {text && <Txt testID={`${testIDPrefix}-description`} f="body" size={dense ? 12 : 13} color={c.muc2} style={{ lineHeight: dense ? 18 : 20 }}>{text}</Txt>}
  </View>;
}

type LoginInputProps = Omit<TextInputProps, 'style' | 'placeholder'> & { label: string; nativeID: string; placeholder?: string; invalid?: boolean; hint?: string; inputRef?: React.Ref<TextInputInstance>; right?: React.ReactNode; showLabel?: boolean };

export function LoginInput({ label, nativeID, placeholder, invalid, hint, inputRef, right, showLabel = true, ...rest }: LoginInputProps) {
  const { c } = useTheme();
  const dense = useLoginDensity();
  const [focus, setFocus] = useState(false);
  return <View style={{ gap: 4 }}>
    {showLabel && <Txt f="semibold" size={dense ? 12 : 13} color={c.muc2}>{label}</Txt>}
    <View>
      <TextInput ref={inputRef} nativeID={nativeID} accessibilityLabel={label} placeholder={placeholder ?? label} placeholderTextColor={c.muc3} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} style={[{ minHeight: dense ? 44 : 48, borderRadius: 12, borderWidth: 1, borderColor: invalid ? c.son : focus ? c.logoRed : c.vien2, backgroundColor: c.the, paddingHorizontal: 14, paddingRight: right ? 54 : 14, fontFamily: FONT.medium, fontSize: dense ? 13 : 14, color: c.logoInk }, focus && { boxShadow: `0 0 0 3px ${c.logoRed}1f` }, Platform.OS === 'web' && { outlineStyle: 'solid', outlineWidth: 0 }]} {...rest} />
      {right && <View style={{ position: 'absolute', right: 2, top: 0, bottom: 0, justifyContent: 'center' }}>{right}</View>}
    </View>
    {hint && <Txt f="body" size={12} color={c.muc2}>{hint}</Txt>}
  </View>;
}

export function LoginPasswordToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  const { c } = useTheme();
  const Icon = shown ? EyeOff : Eye;
  return <Pressable onPress={onToggle} accessibilityRole="button" accessibilityLabel={shown ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} accessibilityState={{ selected: shown }} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon size={20} color={c.muc2} /></Pressable>;
}

export function LoginActions({ title = 'Đăng nhập', loading, onPress, onForgot, testID = 'login-submit', actionsTestID }: { title?: string; loading: boolean; onPress: () => void; onForgot?: () => void; testID?: string; actionsTestID?: string }) {
  const { c } = useTheme();
  const dense = useLoginDensity();
  return <View testID={actionsTestID} style={{ flexDirection: dense ? 'row' : 'column', alignItems: dense ? 'center' : 'stretch', gap: dense ? 12 : 4 }}>
    {onForgot && <Pressable testID="forgot-open" accessibilityRole="link" accessibilityLabel="Quên mật khẩu" disabled={loading} onPress={onForgot} style={{ minHeight: 44, alignSelf: dense ? 'center' : 'flex-end', justifyContent: 'center' }}><Txt f="semibold" size={12} color={c.logoRed}>Quên mật khẩu?</Txt></Pressable>}
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: loading, busy: loading }} disabled={loading} onPress={onPress} style={({ pressed }) => ({ flex: dense ? 1 : undefined, minHeight: dense ? 44 : 48, minWidth: 0, paddingHorizontal: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: pressed ? c.sonDam : c.logoRed, opacity: loading ? 0.7 : 1 })}>
      {loading && <ActivityIndicator size="small" color={c.trang} />}<Txt f="bold" size={14} color={c.trang} numberOfLines={1} style={{ flexShrink: 1 }}>{loading ? 'Đang xử lý…' : title}</Txt>{!loading && <ArrowRight size={18} color={c.trang} />}
    </Pressable>
  </View>;
}
