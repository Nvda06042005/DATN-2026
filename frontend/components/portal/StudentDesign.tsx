/**
 * Ngôn ngữ hình ảnh của trang học sinh. Minh họa là tranh trang trí tự vẽ, không phải bản đồ địa lý.
 * 23/11/2026 – "Sắc Việt" (người dùng: "na ná Duolingo, mang đậm tính tự tôn dân tộc, bản sắc Việt Nam", gửi ảnh mẫu nhân vật chibi áo nâu, áo tứ thân,
 * quan phục, sân khấu bảng xếp hạng; chọn "chỉ tham khảo – tự vẽ mới"): nền giấy dó ấm, đỏ son làm màu chính, vàng cho phần thưởng, xanh tre cho tiến độ;
 * nút / thẻ khối dày có viền đáy như trò chơi học tập; nhân vật và cảnh nền vẽ bằng SVG ở `StudentArt.tsx`. Chỉ lấy thể loại, không dùng hình, tên hay nhân vật
 * của sản phẩm khác. Tên khóa cũ của `STUDENT` (teal, mint, deep…) giữ lại để các màn khác không phải đổi, nhưng nay mang màu son.
 */
import React from 'react';
import { Pressable, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { BookOpen, Coins, Flag, Flame, Star } from 'lucide-react-native';
import { Txt } from '@/components/ui';
import { Chibi, DrumSun, VnScene, type ChibiKind, type VnSceneKind } from '@/components/portal/StudentArt';
import { PALETTES, type Palette } from '@/constants/theme';
import type { IconType } from '@/types/game';
import type { SagaHome } from '@/types/saga';

export const STUDENT = {
  ink: '#2b1d12', muted: '#6b5644', canvas: '#fff8ec', paper2: '#f8ecd6', white: '#ffffff', line: '#ecdcc2', line2: '#dcc39b',
  /** đỏ son – màu chính (giữ tên khóa cũ `teal` / `deep` / `mint`) */
  teal: '#c8261c', deep: '#9c1a12', mint: '#fdebe3', red: '#d6281e', redDeep: '#a11a12',
  gold: '#ffc23a', goldDeep: '#d99300', goldSoft: '#fff3d1', goldInk: '#6e4b00',
  green: '#46a840', greenDeep: '#2e7d2c', greenSoft: '#e6f4dc', greenInk: '#245f1d',
  jade: '#1f8a70', jadeSoft: '#dcf2ea', indigo: '#2d4a8a', indigoSoft: '#e3e9f6', orange: '#e8751a', orangeSoft: '#ffeedd',
  blue: '#2a6fb0',
};

/** Chỉ áp dụng trong StudentApp: bảng màu của giáo viên và quản trị giữ nguyên. */
export const STUDENT_PALETTE: Palette = {
  ...PALETTES.light,
  giay: STUDENT.canvas, giay2: STUDENT.paper2, the: STUDENT.white, the2: '#fff4e0',
  muc: STUDENT.ink, muc2: STUDENT.muted, muc3: '#7a6450',
  vien: STUDENT.line, vien2: STUDENT.line2,
  // đỏ son vẫn là màu báo sai / lỗi (đáp án sai, lỗi nhập, lỗi máy chủ) như trước, chỉ tươi hơn
  son: STUDENT.red, sonDam: STUDENT.redDeep, sonNhat: '#fde4dc', sonChu: '#b3241a',
  ngoc: STUDENT.green, ngocDam: STUDENT.greenDeep, ngocNhat: STUDENT.greenSoft, ngocChu: STUDENT.greenInk,
  vang: STUDENT.gold, vangDam: STUDENT.goldDeep, vangNhat: STUDENT.goldSoft, vangChu: STUDENT.goldInk,
  logoInk: STUDENT.ink, logoPaper: STUDENT.canvas, logoRed: STUDENT.red, logoGold: '#e3b244',
  adminLine: STUDENT.line, adminCanvas: '#fdf3e2', adminTint: STUDENT.mint,
};

type GameTone = 'red' | 'gold' | 'green' | 'paper';
const GAME_TONE: Record<GameTone, { bg: string; edge: string; fg: string; border?: string }> = {
  red: { bg: STUDENT.red, edge: STUDENT.redDeep, fg: '#ffffff' },
  gold: { bg: STUDENT.gold, edge: STUDENT.goldDeep, fg: '#3d2600' },
  green: { bg: STUDENT.green, edge: STUDENT.greenDeep, fg: '#0f2b0a' },
  paper: { bg: STUDENT.white, edge: STUDENT.line2, fg: STUDENT.ink, border: STUDENT.line },
};

/** Nút khối dày (viền đáy, nhấn thì lún xuống) của trang học sinh */
export function GameButton({ title, onPress, icon: Icon, light = false, tone, testID, style, label, size = 'md' }: {
  title: string; onPress: () => void; icon?: IconType; light?: boolean; tone?: GameTone; testID?: string; style?: StyleProp<ViewStyle>; label?: string; size?: 'md' | 'lg';
}) {
  const t = GAME_TONE[tone ?? (light ? 'gold' : 'red')];
  const depth = size === 'lg' ? 5 : 4;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label ?? title} onPress={onPress} testID={testID} style={[{ alignSelf: 'flex-start', maxWidth: '100%' }, style]}>
      {({ pressed }) => (
        <View style={{ paddingBottom: depth }}>
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: depth, borderRadius: 16, backgroundColor: t.edge }} />
          <View style={{ minHeight: size === 'lg' ? 54 : 48, paddingHorizontal: size === 'lg' ? 24 : 20, borderRadius: 16, backgroundColor: t.bg, borderWidth: t.border ? 2 : 0, borderColor: t.border,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, transform: [{ translateY: pressed ? depth - 1 : 0 }] }}>
            {Icon ? <Icon size={size === 'lg' ? 21 : 19} color={t.fg} strokeWidth={2.6} /> : null}
            <Txt f="heavy" size={size === 'lg' ? 17 : 15} color={t.fg} style={{ flexShrink: 1, letterSpacing: 0.3 }}>{title}</Txt>
          </View>
        </View>
      )}
    </Pressable>
  );
}

/** Thẻ khối: nền trắng, viền 2, viền đáy dày (kiểu thẻ của trò chơi học tập) */
export const BlockCard: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string; color?: string; bg?: string; pad?: number }> = ({ children, style, testID, color = STUDENT.line, bg = STUDENT.white, pad = 18 }) => (
  <View testID={testID} style={[{ backgroundColor: bg, borderRadius: 20, borderWidth: 2, borderBottomWidth: 5, borderColor: color, padding: pad }, style]}>{children}</View>
);

/** Huy hiệu tròn có biểu tượng (nút mục, bước, chỉ số) */
export const IconBadge: React.FC<{ icon: IconType; color: string; size?: number; soft?: boolean }> = ({ icon: Icon, color, size = 36, soft = false }) => (
  <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: soft ? `${color}22` : color, alignItems: 'center', justifyContent: 'center', borderBottomWidth: soft ? 0 : 3, borderBottomColor: 'rgba(0,0,0,0.18)' }}>
    <Icon size={Math.round(size * 0.5)} color={soft ? color : '#ffffff'} strokeWidth={2.5} />
  </View>
);

/** Cảnh nền trang trí theo phần: 1 làng tre (1258), 2 đình làng (1285), 3 sông núi Bạch Đằng (1287–1288) */
export const sceneOf = (variant: number): VnSceneKind => (variant === 3 ? 'song' : variant === 2 ? 'dinh' : 'lang');

/** Giữ tên cũ: tranh cảnh trang trí (nay là cảnh làng quê Việt tự vẽ), không phải bản đồ lịch sử */
export function AdventureScene({ variant = 1, style }: { variant?: number; style?: StyleProp<ViewStyle> }) {
  return <VnScene kind={sceneOf(variant)} style={style} />;
}

/** Ô chào lớn đầu trang: cảnh làng quê Việt, đôi bạn chibi áo ngũ thân, tiêu đề và nút hành động */
export function AdventureHero({ eyebrow = 'HÀO KHÍ ĐÔNG A', title, subtitle, action, footnote, variant = 1, pair = ['thu-sinh', 'thieu-nu'] }: {
  eyebrow?: string; title: string; subtitle: string; action?: React.ReactNode; footnote?: string; variant?: number; pair?: [ChibiKind, ChibiKind];
}) {
  const { width } = useWindowDimensions();
  const compact = width < 760;
  return (
    <View testID="student-adventure-hero" style={{ borderRadius: 26, overflow: 'hidden', borderWidth: 2, borderBottomWidth: 6, borderColor: '#e6cfa6', backgroundColor: STUDENT.canvas }}>
      {compact ? (
        <View style={{ height: 176 }}>
          <AdventureScene variant={variant} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
          <View pointerEvents="none" style={{ position: 'absolute', bottom: -4, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
            <Chibi kind={pair[0]} size={92} /><Chibi kind={pair[1]} size={92} flip />
          </View>
        </View>
      ) : (
        <>
          <AdventureScene variant={variant} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
          <View pointerEvents="none" style={{ position: 'absolute', right: 34, bottom: -6, flexDirection: 'row', gap: 4 }}>
            <Chibi kind={pair[0]} size={128} /><Chibi kind={pair[1]} size={128} flip />
          </View>
        </>
      )}
      <View style={{ padding: compact ? 20 : 28, paddingRight: compact ? 20 : 300, minHeight: compact ? undefined : 290, justifyContent: 'center' }}>
        <View style={{ gap: 12, backgroundColor: compact ? 'transparent' : 'rgba(255,248,236,0.93)', borderRadius: 22, padding: compact ? 0 : 22, maxWidth: 560, borderWidth: compact ? 0 : 2, borderColor: '#efdcb8' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ backgroundColor: STUDENT.red, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 3 }}><Txt f="heavy" size={11} color="#ffffff" style={{ letterSpacing: 1.6 }}>{eyebrow}</Txt></View>
          </View>
          <Txt f="heavy" size={compact ? 27 : 32} color={STUDENT.ink} accessibilityRole="header" style={{ lineHeight: compact ? 34 : 40 }}>{title}</Txt>
          <Txt size={16} color={STUDENT.muted} style={{ lineHeight: 25, maxWidth: 480 }}>{subtitle}</Txt>
          {action}
          {footnote ? <Txt size={13} color={STUDENT.muted}>{footnote}</Txt> : null}
        </View>
      </View>
    </View>
  );
}

/** Chỉ số của em (chuỗi ngày, vàng, điểm kinh nghiệm); `bare` là kiểu gọn trên thanh đầu (biểu tượng + số) */
export function LearnerStats({ home, compact = false, bare = false }: { home: SagaHome; compact?: boolean; bare?: boolean }) {
  const stats = [
    { icon: Flame, value: home.hud.streak.current, label: 'ngày liên tiếp', short: 'ngày', color: STUDENT.orange, ink: '#9a4300', bg: STUDENT.orangeSoft, fill: true },
    { icon: Coins, value: home.hud.gold.toLocaleString('vi-VN'), label: 'vàng', short: 'vàng', color: STUDENT.goldDeep, ink: STUDENT.goldInk, bg: STUDENT.goldSoft, fill: true },
    { icon: Star, value: home.hud.xp.toLocaleString('vi-VN'), label: 'kinh nghiệm', short: 'XP', color: STUDENT.red, ink: STUDENT.deep, bg: STUDENT.mint, fill: true },
  ];
  const tight = bare && compact;
  return (
    <View testID="student-live-stats" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tight ? 8 : bare ? 4 : compact ? 8 : 12 }}>
      {stats.map(({ icon: Icon, value, label, short, color, ink, bg, fill }) => (
        <View key={label} accessible accessibilityLabel={`${value} ${label}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: tight ? 3 : 6, borderRadius: 14, minHeight: tight ? 22 : bare ? 40 : 44, paddingHorizontal: tight ? 2 : bare ? 8 : compact ? 11 : 14,
            backgroundColor: bare ? 'transparent' : bg, borderWidth: bare ? 0 : 2, borderBottomWidth: bare ? 0 : 4, borderColor: bare ? 'transparent' : `${color}55` }}>
          <Icon size={tight ? 14 : bare ? 22 : compact ? 18 : 21} color={color} fill={fill ? color : 'transparent'} strokeWidth={2.2} />
          <Txt f="heavy" size={tight ? 12 : bare ? 16 : compact ? 14 : 16} color={bare ? color : ink}>{value}</Txt>
          {bare ? null : <Txt f="semibold" size={compact ? 12 : 13} color={ink}>{compact ? short : label}</Txt>}
        </View>
      ))}
    </View>
  );
}

/** Hướng dẫn tân binh (chưa vào lớp nào): nhân vật chào, ba bước, nút xem mã lớp */
export function RookieGuide({ onInbox }: { onInbox?: () => void }) {
  return (
    <BlockCard testID="student-rookie-guide" style={{ gap: 16, overflow: 'hidden' }} pad={20}>
      <DrumSun size={210} style={{ position: 'absolute', right: -70, top: -70 }} opacity={0.12} />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
        <Chibi kind="thu-sinh" size={74} />
        <View style={{ flex: 1, gap: 3, paddingBottom: 8 }}><Txt f="heavy" size={18} color={STUDENT.ink}>Chào em, tân binh!</Txt><Txt size={15} color={STUDENT.muted}>Rồng Con và các bạn đồng hành cùng em.</Txt></View>
      </View>
      <Txt f="heavy" size={16} color={STUDENT.ink}>Cuộc phiêu lưu bắt đầu từ đây</Txt>
      {[
        { icon: Flag, color: STUDENT.red, title: 'Vào lớp của em', text: 'Chọn lớp. Nếu chưa tham gia, nhập mã thầy cô đã gửi.' },
        { icon: BookOpen, color: STUDENT.green, title: 'Khám phá từng chặng', text: 'Học kiến thức, luyện tập rồi thử sức nhập vai.' },
        { icon: Star, color: STUDENT.goldDeep, title: 'Ghi dấu thành tích', text: 'Hoàn thành chặng để tích lũy sao và mở phần thưởng.' },
      ].map(({ icon, color, title, text }) => (
        <View key={title} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <IconBadge icon={icon} color={color} size={38} />
          <View style={{ flex: 1, gap: 2 }}><Txt f="bold" size={15} color={STUDENT.ink}>{title}</Txt><Txt size={15} color={STUDENT.muted} style={{ lineHeight: 23 }}>{text}</Txt></View>
        </View>
      ))}
      {onInbox ? <GameButton title="Xem mã lớp trong Tin nhắn" onPress={onInbox} style={{ alignSelf: 'stretch' }} /> : null}
    </BlockCard>
  );
}
