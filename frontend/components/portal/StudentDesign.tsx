/** Visual language for the learner portal. Illustrations are decorative, never geographical maps. */
import React from 'react';
import { Pressable, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { BookOpen, Coins, Flag, Flame, Sparkles, Star } from 'lucide-react-native';
import { Mascot } from '@/components/art';
import { Txt } from '@/components/ui';
import { PALETTES, type Palette } from '@/constants/theme';
import type { IconType } from '@/types/game';
import type { SagaHome } from '@/types/saga';

export const STUDENT = {
  ink: '#193c40', muted: '#526e70', teal: '#087f78', deep: '#125b58',
  mint: '#e7f7f1', line: '#d7e8e3', canvas: '#f3f8f5', gold: '#ffce58',
  goldInk: '#744905', white: '#ffffff', blue: '#2875a7',
};

/** Scoped to StudentApp: the teacher and management palettes keep their existing values. */
export const STUDENT_PALETTE: Palette = {
  ...PALETTES.light,
  giay: STUDENT.canvas, giay2: '#eaf4ef', the2: '#f1faf6',
  muc: STUDENT.ink, muc2: STUDENT.muted, muc3: '#597174',
  vien: STUDENT.line, vien2: '#bed8cf',
  // Keep the original red semantic colors for incorrect answers, validation and API errors.
  logoInk: STUDENT.ink, logoPaper: STUDENT.canvas, logoRed: STUDENT.teal,
  adminLine: STUDENT.line, adminCanvas: STUDENT.canvas, adminTint: STUDENT.mint,
};

export function GameButton({ title, onPress, icon: Icon, light = false, testID, style }: {
  title: string; onPress: () => void; icon?: IconType; light?: boolean; testID?: string; style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} testID={testID}
      style={({ pressed }) => [{ minHeight: 48, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 15,
        backgroundColor: light ? STUDENT.gold : STUDENT.teal, borderWidth: 1, borderBottomWidth: pressed ? 2 : 5,
        borderColor: light ? '#d89d21' : STUDENT.deep, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 9, opacity: pressed ? 0.9 : 1, paddingTop: pressed ? 14 : 11, alignSelf: 'flex-start', maxWidth: '100%' }, style]}>
      {Icon ? <Icon size={19} color={light ? '#47340b' : STUDENT.white} strokeWidth={2.5} /> : null}
      <Txt f="bold" size={15} color={light ? '#47340b' : STUDENT.white} style={{ flexShrink: 1 }}>{title}</Txt>
    </Pressable>
  );
}

/** Original, code-native game scenery. This is an imaginary island, not a historical map or reconstruction. */
export function AdventureScene({ variant = 1, style }: { variant?: number; style?: StyleProp<ViewStyle> }) {
  const river = variant === 3;
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={style}>
      <Svg width="100%" height="100%" viewBox="0 0 460 280" preserveAspectRatio="xMidYMid meet">
        <Circle cx={328} cy={78} r={61} fill="#fce7a1" opacity={0.65} />
        <Path d="M32 142L118 49l71 87 64-99 115 114z" fill="#4d9286" opacity={0.6} />
        <Path d="M76 140l61-60 65 75 68-89 92 100z" fill="#75b5a0" />
        <Path d="M40 173Q222 73 423 172L394 219Q229 294 72 219Z" fill="#205e53" />
        <Path d="M40 170Q217 70 423 170Q237 272 40 170Z" fill="#9bc89b" />
        <Path d="M60 169Q228 90 399 169Q229 246 60 169Z" fill="#bad79f" />
        <Path d={river ? 'M110 145Q302 147 239 177T341 207' : 'M126 147Q315 151 244 180T294 215'} fill="none" stroke={river ? '#3c9fad' : '#e4b878'} strokeWidth={river ? 31 : 18} />
        <Path d={river ? 'M110 145Q302 147 239 177T341 207' : 'M126 147Q315 151 244 180T294 215'} fill="none" stroke={river ? '#87d6d1' : '#fce2a5'} strokeWidth={river ? 16 : 10} />
        <Ellipse cx={237} cy={148} rx={74} ry={22} fill="#4d876d" opacity={0.35} />
        <Path d="M181 104l54-23 62 23v44l-62 25-54-24z" fill="#d8c392" />
        <Path d="M235 127l62-23v44l-62 25z" fill="#baa477" />
        <Path d="M174 104l61-28 69 27-69 29z" fill="#eecc8e" />
        <Path d="M211 128v31l24 11v-34z" fill="#2c6659" />
        <Path d="M217 135v24l12 5v-25z" fill="#123d37" />
        <Rect x={182} y={85} width={27} height={38} rx={2} fill="#f5dbab" />
        <Path d="M175 87l20-20 23 20z" fill="#b7563f" />
        <Path d="M178 85h37l7 5h-51z" fill="#824434" />
        <Rect x={268} y={83} width={27} height={39} rx={2} fill="#ead4a7" />
        <Path d="M261 85l20-20 23 20z" fill="#b7563f" />
        <Path d="M264 83h37l7 5h-51z" fill="#824434" />
        <Rect x={221} y={56} width={29} height={55} rx={2} fill="#f3d8a1" />
        <Path d="M213 59l22-20 23 20z" fill="#ba5940" />
        <Path d="M214 58h43l6 5h-55z" fill="#844633" />
        <Path d="M235 39V15" stroke="#613f31" strokeWidth={3} />
        <Path d="M237 16h29l-7 9 7 7h-29z" fill="#eebd42" />
        <Path d="M228 78h12v16h-12z" fill="#426c5b" />
        {[{ x: 112, y: 157, s: 1 }, { x: 328, y: 163, s: 1.2 }, { x: 367, y: 145, s: 0.8 }, { x: 155, y: 186, s: 0.8 }].map(({ x, y, s }, i) => (
          <G key={i} transform={`translate(${x},${y}) scale(${s})`}>
            <Ellipse cy={8} rx={13} ry={5} fill="#598d68" opacity={0.4} />
            <Path d="M0-17v26" stroke="#806441" strokeWidth={5} />
            <Path d="M-16-5L0-37 16-5z" fill="#287b65" /><Path d="M-12-18L0-44 12-18z" fill="#3c9270" />
          </G>
        ))}
        <Path d="M107 177v-41" stroke="#775939" strokeWidth={3} /><Path d="M109 137h28l-6 9 6 8h-28z" fill="#e3a54b" />
        <Path d="M334 205v-33" stroke="#775939" strokeWidth={3} /><Path d="M336 173h25l-6 8 6 8h-25z" fill="#b95740" />
        {river ? <G transform="translate(295,181)"><Path d="M-20 0h43l-10 10h-24z" fill="#885e3f" /><Path d="M0-30v30h20z" fill="#fff0c5" /><Path d="M-3-28v25h-15z" fill="#d88750" /></G> : null}
        <Circle cx={157} cy={48} r={3} fill="#ffe097" /><Circle cx={389} cy={110} r={4} fill="#ffe097" />
        <Path d="M91 76h13m-6-6v13M372 43h13m-6-6v13" stroke="#ffe097" strokeWidth={2} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

export function AdventureHero({ eyebrow = 'HÀO KHÍ ĐÔNG A', title, subtitle, action, footnote, variant = 1 }: {
  eyebrow?: string; title: string; subtitle: string; action?: React.ReactNode; footnote?: string; variant?: number;
}) {
  const { width } = useWindowDimensions();
  const compact = width < 760;
  return (
    <View testID="student-adventure-hero" style={{ backgroundColor: '#164e49', borderRadius: 25, overflow: 'hidden', borderWidth: 1, borderColor: '#1f655c', minHeight: compact ? 256 : 282 }}>
      <View pointerEvents="none" style={{ position: 'absolute', right: -50, top: -135, width: 440, height: 440, borderRadius: 220, backgroundColor: '#277368', opacity: 0.55 }} />
      {!compact ? <AdventureScene variant={variant} style={{ position: 'absolute', right: -12, bottom: 0, width: '46%', height: '100%' }} /> : null}
      <View style={{ padding: compact ? 23 : 30, gap: 14, width: compact ? '100%' : '59%' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><Sparkles size={15} color={STUDENT.gold} /><Txt f="bold" size={12} color="#ffe49b" style={{ letterSpacing: 1.8 }}>{eyebrow}</Txt></View>
        <Txt f="heavy" size={compact ? 28 : 33} color="#ffffff" accessibilityRole="header" style={{ lineHeight: compact ? 36 : 43 }}>{title}</Txt>
        <Txt size={16} color="#d9eee3" style={{ lineHeight: 25, maxWidth: 460 }}>{subtitle}</Txt>
        {action}
        {footnote ? <Txt size={13} color="#d1e8d8">{footnote}</Txt> : null}
      </View>
    </View>
  );
}

export function LearnerStats({ home, compact = false }: { home: SagaHome; compact?: boolean }) {
  const stats = [
    { icon: Flame, value: home.hud.streak.current, label: 'ngày liên tiếp', short: 'ngày', color: '#ae4c1e', bg: '#fff2e6' },
    { icon: Coins, value: home.hud.gold.toLocaleString('vi-VN'), label: 'vàng', short: 'vàng', color: STUDENT.goldInk, bg: '#fff7d9' },
    { icon: Star, value: home.hud.xp.toLocaleString('vi-VN'), label: 'kinh nghiệm', short: 'XP', color: STUDENT.teal, bg: STUDENT.mint },
  ];
  return (
    <View testID="student-live-stats" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: compact ? 8 : 12 }}>
      {stats.map(({ icon: Icon, value, label, short, color, bg }) => (
        <View key={label} accessible accessibilityLabel={`${value} ${label}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 13, backgroundColor: bg, paddingHorizontal: compact ? 10 : 14, minHeight: 42 }}>
          <Icon size={compact ? 18 : 21} color={color} strokeWidth={2.3} />
          <Txt f="bold" size={compact ? 14 : 16} color={color}>{value}</Txt>
          <Txt size={compact ? 12 : 13} color={color}>{compact ? short : label}</Txt>
        </View>
      ))}
    </View>
  );
}

export function RookieGuide({ onInbox }: { onInbox?: () => void }) {
  return (
    <View testID="student-rookie-guide" style={{ borderWidth: 1, borderBottomWidth: 4, borderColor: STUDENT.line, backgroundColor: STUDENT.white, borderRadius: 22, padding: 21, gap: 17 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Mascot size={68} mood="happy" accessory="helmet" />
        <View style={{ flex: 1, gap: 3 }}><Txt f="heavy" size={17} color={STUDENT.ink}>Chào em, tân binh!</Txt><Txt size={16} color={STUDENT.muted}>Rồng Con đồng hành cùng em.</Txt></View>
      </View>
      <Txt f="bold" size={16}>Cuộc phiêu lưu bắt đầu từ đây</Txt>
      {[
        { icon: Flag, title: 'Vào lớp của em', text: 'Chọn lớp. Nếu chưa tham gia, nhập mã thầy cô đã gửi.' },
        { icon: BookOpen, title: 'Khám phá từng chặng', text: 'Học kiến thức, luyện tập rồi thử sức nhập vai.' },
        { icon: Star, title: 'Ghi dấu thành tích', text: 'Hoàn thành chặng để tích lũy sao và mở phần thưởng.' },
      ].map(({ icon: Icon, title, text }) => (
        <View key={title} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 11 }}>
          <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: STUDENT.mint, alignItems: 'center', justifyContent: 'center' }}><Icon size={18} color={STUDENT.teal} /></View>
          <View style={{ flex: 1, gap: 3 }}><Txt f="bold" size={14}>{title}</Txt><Txt size={16} color={STUDENT.muted} style={{ lineHeight: 24 }}>{text}</Txt></View>
        </View>
      ))}
      {onInbox ? <GameButton title="Xem mã lớp trong Tin nhắn" onPress={onInbox} style={{ alignSelf: 'stretch' }} /> : null}
    </View>
  );
}
