/**
 * Khung ảnh đại diện và danh hiệu nhận từ hòm báu (17/11/2026, kiểu quà sự kiện của Liên Quân / PUBG): khung là vòng màu xoay quanh ảnh đại diện,
 * phát sáng nhịp nhàng (khung huyền thoại có thêm tia lấp lánh); danh hiệu là nhãn có viền sáng nhấp nháy. Danh mục, việc mở khóa và trang bị do máy chủ
 * quyết định (/api/saga/cosmetics); ở đây chỉ vẽ. Học sinh còn chọn được ảnh đại diện có sẵn theo nhân vật của dự án (Rồng Con, danh tướng) ở Hồ sơ cá nhân và Kho trang phục. Máy bật "giảm chuyển động" thì đứng yên. Không dùng hình ảnh của các trò chơi kể trên.
 * 25/11/2026 ("Binh thư Sát Thát"): thêm khung của Chợ phiên / thành tích và **cờ hiệu** (huy hiệu ở góc ảnh), cùng ba màn Hồ sơ (`ProfileScreen`),
 * Chợ phiên Thăng Long (`ShopScreen`: mua bằng vàng qua máy chủ, mua xong tự trang bị, món thành tích không bán) và Giao diện (`ThemeScreen`: xem thử, đổi màu cả trang).
 */
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { Check, Coins, Crown, Fence, Flag, Flame, KeyRound, LifeBuoy, Lightbulb, Lock, LogOut, Palette, Sailboat, ShieldCheck, Sparkles, Stamp, Store, Swords, Users } from 'lucide-react-native';
import * as saga from '@/lib/saga-api';
import { errorMessage } from '@/api/client';
import type { Session } from '@/components/auth';
import { Mascot, type MascotAccessory, type MascotMood } from '@/components/art';
import { Portrait, num, useLoad, type SagaNav } from '@/components/portal/SagaKit';
import { BtBar, BtButton, BtCard, BtPage, Columns, Eyebrow, Pill, SegTabs, SerifTitle, StatTile, StepHeader, TtSays, themeOf, useBT } from '@/components/portal/StudentDesign';
import { Avatar, Chip, Sheet, Spinner, Txt, useToast } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { IconType } from '@/types/game';
import type { LookItem, LookRarity, LookSlot, SagaLook, Wardrobe } from '@/types/saga';

/** Màu và hiệu ứng của từng khung (mã do máy chủ cấp); món lạ dùng màu theo độ hiếm */
const FRAME_STYLE: Record<string, { colors: string[]; glow: string; speed: number; sparkle: boolean }> = {
  'dong-bo-dau': { colors: ['#15803d', '#86efac', '#facc15', '#15803d'], glow: '#22c55e', speed: 6000, sparkle: false },
  'chuong-duong': { colors: ['#c2410c', '#fde047', '#f97316', '#fde047', '#c2410c'], glow: '#f97316', speed: 3600, sparkle: false },
  'bach-dang': { colors: ['#b91c1c', '#facc15', '#0ea5e9', '#facc15', '#b91c1c'], glow: '#facc15', speed: 2400, sparkle: true },
  // khung của Chợ phiên / thành tích (25/11/2026)
  'go-moc': { colors: ['#6b4423', '#b98552', '#6b4423'], glow: '#a8703a', speed: 9000, sparkle: false },
  'dong-co': { colors: ['#8a5a0b', '#e3b55f', '#5b3a06', '#e3b55f', '#8a5a0b'], glow: '#c9902a', speed: 7000, sparkle: false },
  'lua-dong-a': { colors: ['#b91c1c', '#f97316', '#fde047', '#f97316', '#b91c1c'], glow: '#f97316', speed: 2600, sparkle: false },
  'rong-thoi-tran': { colors: ['#7e1616', '#f2c66d', '#7e1616', '#f2c66d', '#7e1616'], glow: '#f2c66d', speed: 4200, sparkle: false },
  'hoa-sen-vang': { colors: ['#f2c66d', '#fff3c9', '#e8a1a1', '#f2c66d'], glow: '#fde68a', speed: 3000, sparkle: true },
};
/** Cờ hiệu (25/11/2026): huy hiệu nhỏ ở góc ảnh đại diện; màu và biểu tượng theo mã máy chủ cấp */
const FLAG_STYLE: Record<string, { bg: string; fg: string; icon: IconType }> = {
  'sat-that': { bg: '#A61E1E', fg: '#F2C66D', icon: Flag },
  'thuyen-chien': { bg: '#2F5563', fg: '#F2C66D', icon: Sailboat },
  'pha-cuong-dich': { bg: '#7E1616', fg: '#FFF6E5', icon: Swords },
  'rong-cuon': { bg: '#8A5A0B', fg: '#FFF6E5', icon: Crown },
  'coc-bach-dang': { bg: '#14252B', fg: '#F2C66D', icon: Fence },
  'an-dong-a': { bg: '#5C3A06', fg: '#F2C66D', icon: Stamp },
};
/** Huy hiệu cờ hiệu tròn (đứng riêng hoặc ở góc ảnh đại diện) */
export const FlagMark: React.FC<{ flag: LookItem; size?: number }> = ({ flag, size = 22 }) => {
  const f = FLAG_STYLE[flag.code] ?? { bg: RARITY_LOOK[flag.rarity].colors[0], fg: '#FFFFFF', icon: Flag };
  const Icon = f.icon;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: f.bg, borderWidth: Math.max(1.5, size * 0.08), borderColor: '#FFF6E5', alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={Math.round(size * 0.52)} color={f.fg} strokeWidth={2.4} />
    </View>
  );
};
const RARITY_LOOK: Record<LookRarity, { label: string; colors: string[]; glow: string; text: string }> = {
  common: { label: 'Thường', colors: ['#64748b', '#cbd5e1'], glow: '#94a3b8', text: '#ffffff' },
  rare: { label: 'Hiếm', colors: ['#0369a1', '#38bdf8'], glow: '#38bdf8', text: '#ffffff' },
  epic: { label: 'Sử thi', colors: ['#7e22ce', '#e879f9'], glow: '#d946ef', text: '#ffffff' },
  legendary: { label: 'Huyền thoại', colors: ['#b45309', '#fde047', '#b45309'], glow: '#facc15', text: '#3b2300' },
};
const web = Platform.OS === 'web';
const gradient = (kind: 'conic' | 'linear', colors: string[]) => (kind === 'conic' ? `conic-gradient(${colors.join(', ')})` : `linear-gradient(110deg, ${colors.join(', ')})`);

/** Vòng lặp hoạt ảnh 0 → 1; đứng yên ở `still` khi máy bật giảm chuyển động */
function useLoop(duration: number, on: boolean, still = 0.5): Animated.Value {
  const v = useRef(new Animated.Value(still)).current;
  useEffect(() => {
    if (!on) return undefined;
    let live = true;
    let anim: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!live || reduce) return;
      v.setValue(0);
      anim = Animated.loop(Animated.timing(v, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: false }));
      anim.start();
    }).catch(() => undefined);
    return () => { live = false; anim?.stop(); };
  }, [duration, on, v]);
  return v;
}

/** Ảnh đại diện có sẵn theo nhân vật của dự án: Rồng Con (vẻ mặt, mũ) và chân dung danh tướng (hình vẽ cách điệu, không phải chân dung thật) */
const AVATAR_PRESETS: Record<string, { name: string; bg: string; mascot?: { mood: MascotMood; accessory: MascotAccessory }; portrait?: string }> = {
  'rong-con-vui': { name: 'Rồng Con vui vẻ', bg: '#dcfce7', mascot: { mood: 'happy', accessory: 'none' } },
  'rong-con-ra-tran': { name: 'Rồng Con ra trận', bg: '#fee2e2', mascot: { mood: 'excited', accessory: 'helmet' } },
  'rong-con-hoc-gia': { name: 'Rồng Con học giả', bg: '#e0e7ff', mascot: { mood: 'thinking', accessory: 'scholar' } },
  'rong-con-non-la': { name: 'Rồng Con đội nón lá', bg: '#fef3c7', mascot: { mood: 'happy', accessory: 'conical' } },
  'rong-con-vua': { name: 'Rồng Con vương miện', bg: '#fde68a', mascot: { mood: 'excited', accessory: 'crown' } },
  'rong-con-dang-yeu': { name: 'Rồng Con đáng yêu', bg: '#fce7f3', mascot: { mood: 'love', accessory: 'none' } },
  'tran-hung-dao': { name: 'Trần Hưng Đạo', bg: '#ffe08a', portrait: 'tran-hung-dao' },
  'tran-quoc-toan': { name: 'Trần Quốc Toản', bg: '#cfe4ff', portrait: 'tran-quoc-toan' },
  'tran-thu-do': { name: 'Trần Thủ Độ', bg: '#ead9ff', portrait: 'tran-thu-do' },
  'tran-binh-trong': { name: 'Trần Bình Trọng', bg: '#e3d6ff', portrait: 'tran-binh-trong' },
  'tran-nhan-tong': { name: 'Trần Nhân Tông', bg: '#fff3c9', portrait: 'tran-nhan-tong' },
  'tran-khanh-du': { name: 'Trần Khánh Dư', bg: '#cfeaff', portrait: 'tran-khanh-du' },
};
export const avatarName = (code?: string | null): string | null => (code && AVATAR_PRESETS[code] ? AVATAR_PRESETS[code].name : null);

/** Ảnh tròn của một nhân vật có sẵn */
export const CharacterAvatar: React.FC<{ code: string; size?: number }> = ({ code, size = 40 }) => {
  const p = AVATAR_PRESETS[code];
  if (!p) return null;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }}>
      {p.mascot ? <View style={{ marginTop: size * 0.12 }}><Mascot size={size * 0.92} mood={p.mascot.mood} accessory={p.mascot.accessory} title={p.name} /></View>
        : <Portrait code={p.portrait!} size={size} round />}
    </View>
  );
};

/** Lưới chọn ảnh đại diện có sẵn (kiểu ô "Set your status"): ô đầu là ảnh / chữ cái của em, sau đó Rồng Con và các danh tướng */
export const AvatarPicker: React.FC<{ codes: string[]; value: string | null; name: string; uri?: string | null; busy?: boolean; onPick: (code: string | null) => void }> = ({ codes, value, name, uri, busy, onPick }) => {
  const { c } = useTheme();
  const cell = (code: string | null) => {
    const active = value === code;
    const label = code ? AVATAR_PRESETS[code]?.name ?? code : 'Ảnh của em';
    return (
      <Pressable key={code ?? 'mine'} onPress={() => onPick(code)} disabled={busy || active} accessibilityRole="button" accessibilityState={{ selected: active }}
        accessibilityLabel={`Ảnh đại diện: ${label}${active ? ', đang dùng' : ''}`} testID={`avatar-preset-${code ?? 'mine'}`}
        style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({ width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
          borderWidth: 2, borderColor: active ? c.mocChu : hovered ? c.vien : c.adminLine, backgroundColor: active ? c.mocNhat : c.the, opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] })}>
        {code ? <CharacterAvatar code={code} size={48} /> : <Avatar name={name} uri={uri} size={48} />}
        {active ? <View style={{ position: 'absolute', right: -6, top: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: c.mocChu, alignItems: 'center', justifyContent: 'center' }}><Check size={12} color="#ffffff" /></View> : null}
      </Pressable>
    );
  };
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }} testID="avatar-picker">
      {cell(null)}
      {codes.filter((x) => AVATAR_PRESETS[x]).map(cell)}
    </View>
  );
};

/**
 * Phần riêng của học sinh trong Hồ sơ cá nhân (17/11/2026): ảnh có khung và danh hiệu nhận từ hòm báu, lưới chọn ảnh đại diện có sẵn theo nhân vật.
 * Đổi ảnh xong gọi `onChanged` để thanh đầu, cột phải cập nhật.
 */
export const ProfileLook: React.FC<{ session: Session; onChanged: () => void }> = ({ session, onChanged }) => {
  const { c } = useTheme();
  const toast = useToast();
  const data = useLoad<Wardrobe>(session, (t) => saga.wardrobe(t), []);
  const [busy, setBusy] = useState(false);
  const w = data.data;
  if (!w) return data.error ? <Txt size={12} color={c.muc3}>{data.error}</Txt> : <Spinner />;
  const pick = (avatar: string | null): void => {
    setBusy(true);
    saga.equipLook(session.token, { avatar }).then((next) => { data.set(next); onChanged(); toast('Đã đổi ảnh đại diện'); }).catch((e) => toast(errorMessage(e))).finally(() => setBusy(false));
  };
  return (
    <View style={{ gap: 10, borderRadius: 14, borderWidth: 1, borderColor: c.adminLine, backgroundColor: c.the, padding: 12 }} testID="profile-look">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Txt f="bold" size={14} style={{ flex: 1 }}>Chọn ảnh đại diện nhân vật</Txt>
        {w.equipped.title ? <TitleBadge title={w.equipped.title} /> : null}
      </View>
      <AvatarPicker codes={w.avatars} value={w.equipped.avatar ?? null} name={session.user.full_name} uri={session.user.avatar_url} busy={busy} onPick={pick} />
      <Txt size={11} color={c.muc3}>{w.equipped.frame ? `Đang dùng ${w.equipped.frame.name}. ` : 'Mở hòm báu trên bản đồ Chiến dịch để nhận khung ảnh có hiệu ứng và danh hiệu. '}Đổi khung, danh hiệu ở Kho trang phục (cột bên phải trang Chiến dịch).</Txt>
    </View>
  );
};

/** Ảnh đại diện có khung: vòng màu xoay, quầng sáng nhịp thở, tia lấp lánh (khung huyền thoại); `preset` = ảnh nhân vật có sẵn */
export const FramedAvatar: React.FC<{ name: string; uri?: string | null; size?: number; frame?: LookItem | null; preset?: string | null; flag?: LookItem | null; style?: StyleProp<ViewStyle>; testID?: string }> = ({ name, uri, size = 40, frame, preset, flag, style, testID }) => {
  const look = frame ? FRAME_STYLE[frame.code] ?? { colors: RARITY_LOOK[frame.rarity].colors, glow: RARITY_LOOK[frame.rarity].glow, speed: 5000, sparkle: frame.rarity === 'legendary' } : null;
  const spin = useLoop(look?.speed ?? 4000, Boolean(look));
  const pulse = useLoop(1600, Boolean(look));
  const face = preset && AVATAR_PRESETS[preset] ? <CharacterAvatar code={preset} size={size} /> : <Avatar name={name} uri={uri} size={size} />;
  const flagSize = Math.max(14, Math.round(size * 0.38));
  const flagMark = flag && size >= 30 ? <View pointerEvents="none" style={{ position: 'absolute', right: -2, bottom: -2 }}><FlagMark flag={flag} size={flagSize} /></View> : null;
  if (!look) return (
    <View style={style} testID={testID} accessible={Boolean(preset || flag)} accessibilityLabel={preset || flag ? `Ảnh đại diện của ${name}${preset ? `: ${avatarName(preset)}` : ''}${flag ? `, cờ hiệu ${flag.name}` : ''}` : undefined}>
      {face}{flagMark}
    </View>
  );
  const ring = Math.max(3, Math.round(size * 0.09));
  const outer = size + ring * 2;
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const glow = pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.35, 0.95, 0.35] });
  return (
    <View style={[{ width: outer, height: outer, alignItems: 'center', justifyContent: 'center' }, style]} testID={testID}
      accessible accessibilityLabel={`Ảnh đại diện của ${name}${preset && avatarName(preset) ? ` (${avatarName(preset)})` : ''}, ${frame!.name}${flag ? `, cờ hiệu ${flag.name}` : ''}`}>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', width: outer, height: outer, borderRadius: outer / 2, opacity: glow,
        ...(web ? { boxShadow: `0 0 ${Math.round(size * 0.35)}px ${Math.round(size * 0.08)}px ${look.glow}` } as object : { backgroundColor: look.glow }) }} />
      <Animated.View pointerEvents="none" style={{ position: 'absolute', width: outer, height: outer, borderRadius: outer / 2, transform: [{ rotate }],
        ...(web ? { backgroundImage: gradient('conic', look.colors) } as object : { borderWidth: ring, borderColor: look.colors[0] }) }} />
      <View style={{ width: size + 2, height: size + 2, borderRadius: (size + 2) / 2, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' }}>
        {face}
      </View>
      {look.sparkle ? [0, 1, 2].map((i) => (
        <Animated.View key={i} pointerEvents="none" style={{ position: 'absolute', left: [-2, outer - 10, outer * 0.62][i], top: [outer * 0.18, outer * 0.08, outer - 10][i],
          opacity: pulse.interpolate({ inputRange: [0, (i + 1) / 4, 1], outputRange: [0, 1, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.6, 1.2, 0.6] }) }] }}>
          <Sparkles size={Math.max(10, Math.round(size * 0.28))} color="#fde047" fill="#fef9c3" />
        </Animated.View>
      )) : null}
      {flagMark}
    </View>
  );
};

/** Nhãn danh hiệu: nền chuyển màu theo độ hiếm, viền sáng nhấp nháy; danh hiệu huyền thoại có vệt sáng chạy ngang */
export const TitleBadge: React.FC<{ title: LookItem; size?: 'sm' | 'md'; center?: boolean; testID?: string }> = ({ title, size = 'sm', center = false, testID }) => {
  const r = RARITY_LOOK[title.rarity] ?? RARITY_LOOK.common;
  const blink = useLoop(1400, true);
  const shine = useLoop(2600, title.rarity === 'legendary' || title.rarity === 'epic', 1);
  const small = size === 'sm';
  const glow = blink.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.25, 1, 0.25] });
  return (
    <View style={{ alignSelf: center ? 'center' : 'flex-start' }} testID={testID} accessible accessibilityLabel={`Danh hiệu ${title.name} (${r.label})`}>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: -2, right: -2, top: -2, bottom: -2, borderRadius: 999, borderWidth: 2, borderColor: r.glow, opacity: glow,
        ...(web ? { boxShadow: `0 0 10px 1px ${r.glow}` } as object : {}) }} />
      <View style={{ borderRadius: 999, overflow: 'hidden', paddingHorizontal: small ? 8 : 12, paddingVertical: small ? 1 : 4, flexDirection: 'row', alignItems: 'center', gap: 4,
        ...(web ? { backgroundImage: gradient('linear', r.colors) } as object : { backgroundColor: r.colors[0] }) }}>
        {title.rarity === 'legendary' || title.rarity === 'epic' ? (
          <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, width: 18, backgroundColor: 'rgba(255,255,255,0.55)', transform: [{ skewX: '-20deg' }],
            left: shine.interpolate({ inputRange: [0, 1], outputRange: ['-20%', '120%'] }) }} />
        ) : null}
        <Txt f="heavy" size={small ? 10 : 13} color={r.text} numberOfLines={1} style={{ letterSpacing: 0.3 }}>{title.name}</Txt>
      </View>
    </View>
  );
};

/** Ô chọn một khung / danh hiệu trong kho */
const SlotCard: React.FC<{ slot: LookSlot | null; kind: 'frame' | 'title'; name: string; uri?: string | null; preset?: string | null; active: boolean; busy: boolean; onPick: () => void }> = ({ slot, kind, name, uri, preset, active, busy, onPick }) => {
  const { c } = useTheme();
  const locked = slot ? !slot.unlocked : false;
  const r = slot ? RARITY_LOOK[slot.rarity] : null;
  return (
    <Pressable onPress={onPick} disabled={locked || active || busy} accessibilityRole="button" accessibilityState={{ selected: active, disabled: locked }}
      accessibilityLabel={`${slot ? slot.name : kind === 'frame' ? 'Không dùng khung' : 'Không dùng danh hiệu'}${active ? ', đang dùng' : locked ? `, còn khóa: ${slot!.need}` : ', bấm để trang bị'}`}
      testID={`look-${kind}-${slot?.code ?? 'none'}`}
      style={({ pressed }) => ({ flexGrow: 1, flexBasis: 150, maxWidth: 220, minHeight: 150, borderRadius: 14, borderWidth: 2, borderColor: active ? c.mocChu : c.adminLine, backgroundColor: active ? c.mocNhat : c.the,
        padding: 10, gap: 6, alignItems: 'center', opacity: pressed ? 0.85 : 1 })}>
      <View style={{ minHeight: 72, alignItems: 'center', justifyContent: 'center', opacity: locked ? 0.45 : 1 }}>
        {kind === 'frame' ? <FramedAvatar name={name} uri={uri} preset={preset} size={52} frame={slot && !locked ? slot : null} />
          : slot ? <TitleBadge title={slot} size="md" center /> : <Txt size={13} color={c.muc3}>(không có)</Txt>}
        {locked ? <View style={{ position: 'absolute', width: 30, height: 30, borderRadius: 15, backgroundColor: c.the, alignItems: 'center', justifyContent: 'center' }}><Lock size={16} color={c.muc3} /></View> : null}
      </View>
      <Txt f="bold" size={13} center numberOfLines={2}>{slot ? slot.name : kind === 'frame' ? 'Không dùng khung' : 'Không dùng danh hiệu'}</Txt>
      {r ? <Chip text={r.label} bg={c.adminTint} fg={c.muc2} /> : null}
      {active ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Check size={14} color={c.mocChu} /><Txt f="bold" size={12} color={c.mocChu}>Đang dùng</Txt></View>
        : locked ? <Txt size={11} color={c.muc3} center>{slot!.need}</Txt> : <Txt f="bold" size={12} color={c.logoRed}>Trang bị</Txt>}
    </Pressable>
  );
};

/** Kho trang phục: chọn khung ảnh đại diện và danh hiệu đã mở khóa từ hòm báu */
export const WardrobeSheet: React.FC<{ session: Session; name: string; uri?: string | null; onClose: () => void; onChanged: (look: SagaLook) => void }> = ({ session, name, uri, onClose, onChanged }) => {
  const { c } = useTheme();
  const toast = useToast();
  const data = useLoad<Wardrobe>(session, (t) => saga.wardrobe(t), []);
  const [busy, setBusy] = useState(false);
  const w = data.data;
  const equip = (body: { frame?: string | null; title?: string | null; avatar?: string | null }): void => {
    setBusy(true);
    saga.equipLook(session.token, body).then((next) => { data.set(next); onChanged(next.equipped); toast('Đã trang bị'); }).catch((e) => toast(errorMessage(e))).finally(() => setBusy(false));
  };
  return (
    <Sheet open onClose={onClose} title="Kho trang phục" subtitle={w ? (w.opened >= w.total ? `Em đã mở hết ${w.total} hòm báu trên bản đồ` : `Đã mở ${w.opened}/${w.total} hòm báu trên bản đồ – mở thêm hòm để nhận khung và danh hiệu mới`) : 'Khung ảnh đại diện và danh hiệu nhận từ hòm báu'} wide>
      {!w ? <Spinner /> : (
        <View style={{ gap: 18 }} testID="wardrobe">
          <View style={{ alignItems: 'center', gap: 8, paddingVertical: 6 }}>
            <FramedAvatar name={name} uri={uri} preset={w.equipped.avatar} size={84} frame={w.equipped.frame} />
            <Txt f="bold" size={17}>{name}</Txt>
            {w.equipped.title ? <TitleBadge title={w.equipped.title} size="md" center /> : <Txt size={13} color={c.muc3}>Chưa dùng danh hiệu</Txt>}
          </View>
          <View style={{ gap: 8 }}>
            <Txt f="bold" size={16}>Ảnh đại diện nhân vật</Txt>
            <AvatarPicker codes={w.avatars} value={w.equipped.avatar ?? null} name={name} uri={uri} busy={busy} onPick={(avatar) => equip({ avatar })} />
          </View>
          <View style={{ gap: 8 }}>
            <Txt f="bold" size={16}>Khung ảnh đại diện</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <SlotCard slot={null} kind="frame" name={name} uri={uri} preset={w.equipped.avatar} active={!w.equipped.frame} busy={busy} onPick={() => equip({ frame: null })} />
              {w.frames.map((f) => <SlotCard key={f.code} slot={f} kind="frame" name={name} uri={uri} preset={w.equipped.avatar} active={w.equipped.frame?.code === f.code} busy={busy} onPick={() => equip({ frame: f.code })} />)}
            </View>
          </View>
          <View style={{ gap: 8 }}>
            <Txt f="bold" size={16}>Danh hiệu</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <SlotCard slot={null} kind="title" name={name} active={!w.equipped.title} busy={busy} onPick={() => equip({ title: null })} />
              {w.titles.map((t) => <SlotCard key={t.code} slot={t} kind="title" name={name} active={w.equipped.title?.code === t.code} busy={busy} onPick={() => equip({ title: t.code })} />)}
            </View>
          </View>
          <Txt size={12} color={c.muc3}>“Sát Thát” (giết giặc Thát) là hai chữ quân sĩ nhà Trần thích lên cánh tay năm 1285 để tỏ quyết tâm đánh giặc. Tên khung lấy theo các trận Đông Bộ Đầu (1258), Chương Dương (1285), Bạch Đằng (1288).</Txt>
        </View>
      )}
    </Sheet>
  );
};

// ---------------------------------------------------------------------- Hồ sơ, Chợ phiên Thăng Long, Giao diện (25/11/2026, "Binh thư Sát Thát")
const WEEKDAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
/** Bảng "Cách kiếm" – cùng nội dung với EARN_RULES của máy chủ (backend/src/saga/saga.service.ts); số thật do máy chủ cộng */
const EARN: Array<{ text: string; xp: string; gold: string }> = [
  { text: 'Trả lời đúng 1 câu (lần đầu)', xp: '+10', gold: '+2' },
  { text: 'Mỗi sao trong trận (lần đầu đạt)', xp: '+30', gold: '+10' },
  { text: 'Xong 1 chặng lần đầu', xp: '+100 trở lên', gold: '+30 trở lên' },
  { text: 'Nhiệm vụ hằng ngày', xp: 'theo nhiệm vụ', gold: '+10–30' },
  { text: 'Nhặt đủ thẻ Thám sử của chặng', xp: '+10', gold: '' },
];
/** Điều kiện của 5 bậc Khoa bảng (máy chủ xét: RANK_NAMES) */
const RANK_RULE = ['Bắt đầu hành trình', 'Xong chiến dịch Khối 6', 'Xong chiến dịch Khối 7', 'Xong chiến dịch Khối 8', 'Xong Khối 9 và đủ sao cả bốn khối'];
/** Món đẹp nhất chỉ mở bằng thành tích, không bán */
const ACHIEVEMENT_NOTE = 'Vàng chỉ đổi lấy đồ trang trí và vật phẩm hỗ trợ có giới hạn mỗi tuần; không mua được KN, sao hay đáp án. Món đẹp nhất (khung Sóng Bạch Đằng, Hoa sen vàng, cờ Cọc Bạch Đằng, Ấn Đông A, giao diện Hoàng thành) chỉ mở bằng thành tích.';

/** Đầu màn của Hồ sơ / Chợ phiên / Giao diện: nút quay lại, dòng nhỏ, tiêu đề có chân, phần phụ bên phải */
const ScreenHead: React.FC<{ eyebrow: string; title: string; onBack: () => void; backLabel: string; right?: React.ReactNode }> = (p) => (
  <StepHeader eyebrow={p.eyebrow} title={p.title} onBack={p.onBack} backLabel={p.backLabel} right={p.right} />
);
const GoldPill: React.FC<{ gold: number }> = ({ gold }) => {
  const t = useBT();
  return (
    <View accessible accessibilityLabel={`Em có ${gold.toLocaleString('vi-VN')} vàng`} testID="gold-balance"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: t.goldSoft, borderWidth: 1, borderColor: t.line2, borderRadius: 999, paddingHorizontal: 10, minHeight: 34 }}>
      <Coins size={16} color={t.bronze} />
      <Txt f="heavy" size={14} color={t.goldInk}>{gold.toLocaleString('vi-VN')}</Txt>
    </View>
  );
};

/** Bản xem thử một giao diện: khung điện thoại nhỏ vẽ bằng đúng màu của giao diện đó */
export const ThemePreview: React.FC<{ code: string; width?: number }> = ({ code, width = 150 }) => {
  const k = themeOf(code);
  const h = Math.round(width * 1.7);
  return (
    <View accessible accessibilityLabel={`Xem thử giao diện ${k.name}`} testID={`theme-preview-${k.code}`}
      style={{ width, height: h, borderRadius: 22, borderWidth: 4, borderColor: '#1c1712', backgroundColor: k.bg, overflow: 'hidden', padding: 9, gap: 7 }}>
      <View style={{ height: 8, width: '44%', borderRadius: 4, backgroundColor: k.accent }} />
      <View style={{ height: 6, width: '70%', borderRadius: 3, backgroundColor: k.line2 }} />
      <View style={{ borderRadius: 10, backgroundColor: k.hero, padding: 8, gap: 5 }}>
        <View style={{ height: 5, width: '40%', borderRadius: 3, backgroundColor: k.gold }} />
        <View style={{ height: 7, width: '78%', borderRadius: 3, backgroundColor: k.onHero }} />
        <View style={{ flexDirection: 'row', gap: 3 }}>{[0, 1, 2, 3, 4].map((i) => <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < 2 ? k.gold : 'rgba(255,255,255,0.3)' }} />)}</View>
        <View style={{ height: 16, borderRadius: 6, backgroundColor: k.gold }} />
      </View>
      {[0, 1].map((i) => (
        <View key={i} style={{ borderRadius: 8, backgroundColor: k.card, borderWidth: 1, borderColor: k.line, padding: 7, flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: i ? k.teal : k.green }} />
          <View style={{ flex: 1, gap: 3 }}>
            <View style={{ height: 5, width: '80%', borderRadius: 3, backgroundColor: k.ink }} />
            <View style={{ height: 4, width: '55%', borderRadius: 2, backgroundColor: k.muted }} />
          </View>
        </View>
      ))}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 26, backgroundColor: k.card, borderTopWidth: 1, borderTopColor: k.line, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }}>
        {[0, 1, 2, 3, 4].map((i) => <View key={i} style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: i === 0 ? k.accent : k.muted, opacity: i === 0 ? 1 : 0.55 }} />)}
      </View>
    </View>
  );
};

/** Ba chấm màu của một giao diện (ô trong lưới Chợ phiên) */
const ThemeSwatch: React.FC<{ code: string; size?: number }> = ({ code, size = 56 }) => {
  const k = themeOf(code);
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: 14, backgroundColor: k.bg, borderWidth: 1, borderColor: k.line2, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 3 }}>
      {[k.accent, k.gold, k.teal].map((col, i) => <View key={i} style={{ width: size * 0.2, height: size * 0.2, borderRadius: size * 0.1, backgroundColor: col }} />)}
    </View>
  );
};

type ShopKind = 'frame' | 'flag' | 'theme';
/** Một ô hàng ở Chợ phiên: xem trước, tên, độ hiếm, trạng thái (đang dùng / dùng / giá / chỉ mở bằng thành tích) */
const ShopCard: React.FC<{
  kind: ShopKind; slot: LookSlot; active: boolean; selected: boolean; gold: number; busy: boolean; name: string; uri?: string | null; preset?: string | null;
  onSelect: () => void; onBuy: () => void; onEquip: () => void;
}> = ({ kind, slot, active, selected, gold, busy, name, uri, preset, onSelect, onBuy, onEquip }) => {
  const t = useBT();
  const r = RARITY_LOOK[slot.rarity] ?? RARITY_LOOK.common;
  const price = slot.price ?? 0;
  const short = slot.buyable && gold < price;
  const locked = !slot.unlocked && !slot.buyable;
  return (
    <Pressable onPress={onSelect} accessibilityRole="button" accessibilityState={{ selected }} testID={`shop-${kind}-${slot.code}`}
      accessibilityLabel={`${slot.name}, ${r.label}${active ? ', đang dùng' : slot.unlocked ? ', em đã có' : slot.buyable ? `, giá ${price} vàng` : `, chỉ mở bằng thành tích: ${slot.need}`}. Bấm để xem thử`}
      style={({ pressed }) => ({ flexGrow: 1, flexBasis: 150, maxWidth: 260, minHeight: 196, borderRadius: 16, borderWidth: 2, borderColor: selected ? t.accent : active ? t.green : t.line,
        backgroundColor: t.card, padding: 10, gap: 6, alignItems: 'center', opacity: pressed ? 0.88 : 1 })}>
      <View style={{ minHeight: 76, alignItems: 'center', justifyContent: 'center', opacity: locked ? 0.55 : 1 }}>
        {kind === 'frame' ? <FramedAvatar name={name} uri={uri} preset={preset} size={56} frame={slot} />
          : kind === 'flag' ? <FlagMark flag={slot} size={52} /> : <ThemeSwatch code={slot.code} />}
        {locked ? <View style={{ position: 'absolute', right: -6, top: -2, width: 26, height: 26, borderRadius: 13, backgroundColor: t.card2, borderWidth: 1, borderColor: t.line, alignItems: 'center', justifyContent: 'center' }}><Lock size={14} color={t.muted} /></View> : null}
      </View>
      <Txt f="heavy" size={14} center numberOfLines={2} color={t.ink}>{slot.name}</Txt>
      <Pill text={r.label} bg={slot.rarity === 'legendary' ? t.goldSoft : t.card2} fg={slot.rarity === 'legendary' ? t.goldInk : t.muted} />
      <View style={{ flex: 1 }} />
      {active ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 40 }}><Check size={15} color={t.green} /><Txt f="heavy" size={13} color={t.green}>Đang dùng</Txt></View>
      ) : slot.unlocked ? (
        <BtButton title="Dùng" size="sm" tone="ghost" onPress={onEquip} disabled={busy} full testID={`shop-equip-${kind}-${slot.code}`} label={`Dùng ${slot.name}`} />
      ) : slot.buyable ? (
        <View style={{ alignSelf: 'stretch', gap: 3 }}>
          <BtButton title={`${price} vàng`} icon={Coins} size="sm" tone="gold" onPress={onBuy} disabled={busy || short} full testID={`shop-buy-${kind}-${slot.code}`} label={`Mua ${slot.name} giá ${price} vàng`} />
          {short ? <Txt size={11} color={t.muted} center>Cần thêm {price - gold} vàng</Txt> : null}
        </View>
      ) : (
        <Txt size={11.5} color={t.muted} center style={{ lineHeight: 16 }}>Chỉ mở bằng thành tích: {slot.need}</Txt>
      )}
    </Pressable>
  );
};

/**
 * Hồ sơ (bản vẽ màn 13): ảnh có khung + cờ hiệu, bậc Khoa bảng, 4 chỉ số (Cấp, KN, Vàng, Sao), chuỗi ngày trong tuần và các mốc thưởng, thanh cấp độ với bảng
 * "Cách kiếm", thang Khoa bảng, chọn ảnh nhân vật và danh hiệu; các nút sang Chợ phiên, Giao diện, Tài khoản, Lớp học, Trợ giúp, Đăng xuất.
 */
export const ProfileScreen: React.FC<{ session: Session; nav: SagaNav; schoolName?: string | null; className?: string | null }> = ({ session, nav, schoolName, className }) => {
  const t = useBT();
  const toast = useToast();
  const data = useLoad<Wardrobe>(session, (tk) => saga.wardrobe(tk), []);
  const [busy, setBusy] = useState(false);
  const home = nav.home;
  const w = data.data;
  const eq: SagaLook = w?.equipped ?? home?.look ?? { frame: null, title: null };
  const equip = (body: { avatar?: string | null; title?: string | null }, msg: string): void => {
    setBusy(true);
    saga.equipLook(session.token, body).then((next) => { data.set(next); nav.refresh(); toast(msg); }).catch((e) => toast(errorMessage(e))).finally(() => setBusy(false));
  };
  const head = <ScreenHead eyebrow="Hồ sơ" title="Hồ sơ của em" onBack={() => nav.back('doanh-trai')} backLabel="Quay lại Doanh trại" right={w ? <GoldPill gold={w.gold} /> : null} />;
  if (!home) return <BtPage testID="saga-profile" tabBar={false} max={1080}>{head}<Spinner /></BtPage>;
  const lv = home.hud.level;
  const stars = home.grades.reduce((n, g) => n + g.stars, 0);
  const maxStars = home.grades.reduce((n, g) => n + g.max_stars, 0);
  const rank = home.rank;
  const streak = home.streak;
  const name = session.user.full_name;

  const hero = (
    <BtCard tone="hero" pad={18} testID="profile-hero">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <FramedAvatar name={name} uri={session.user.avatar_url} size={78} frame={eq.frame} preset={eq.avatar} flag={eq.flag} testID="profile-avatar" />
        <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
          <SerifTitle size={22} color={t.onHero}>{name}</SerifTitle>
          <Txt size={13} color={t.onHeroMuted} numberOfLines={2}>{[className ?? home.learner.class_name, schoolName].filter(Boolean).join(' · ') || 'Học sinh Đông A'}</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <Pill text={`Khoa bảng: ${rank.name}`} bg="rgba(255,255,255,0.14)" fg={t.gold} strong testID="profile-rank-pill" />
            {eq.title ? <TitleBadge title={eq.title} testID="profile-title" /> : null}
          </View>
        </View>
      </View>
    </BtCard>
  );
  const statRow = (
    <View style={{ flexDirection: 'row', gap: 8 }} testID="profile-stats">
      <StatTile value={`Cấp ${lv.level}`} label={lv.title || 'Cấp độ'} color={t.accent} />
      <StatTile value={num(home.hud.xp)} label="KN" />
      <StatTile value={num(home.hud.gold)} label="Vàng" color={t.goldInk} />
      <StatTile value={`${stars}/${maxStars}`} label="Sao" />
    </View>
  );
  const streakCard = (
    <BtCard testID="profile-streak">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Flame size={26} color={t.accent} fill={streak.current > 0 ? t.accent : 'transparent'} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <SerifTitle size={20}>{streak.current} ngày liên tiếp</SerifTitle>
          <Txt size={12.5} color={t.muted}>Kỷ lục {streak.longest} ngày · Lệnh bài giữ chuỗi {streak.freezes}/{streak.freeze_max}</Txt>
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 4 }} accessibilityLabel="Bảy ngày gần nhất" accessible>
        {streak.week.map((d) => {
          const on = d.state === 'done', frz = d.state === 'freeze', today = d.state === 'today';
          return (
            <View key={d.day} style={{ alignItems: 'center', gap: 4, flex: 1 }}>
              <Txt f="heavy" size={11} color={today ? t.accent : t.muted}>{WEEKDAY[d.weekday] ?? ''}</Txt>
              <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? t.accent : frz ? t.goldSoft : 'transparent',
                borderWidth: on ? 0 : 1.5, borderColor: frz ? t.bronze : today ? t.accent : t.line2, borderStyle: today ? 'dashed' : 'solid' }}>
                {on ? <Check size={16} color={t.onAccent} strokeWidth={3} /> : frz ? <ShieldCheck size={15} color={t.bronze} /> : null}
              </View>
            </View>
          );
        })}
      </View>
      <Txt size={12.5} color={t.soft} style={{ lineHeight: 18 }}>Mỗi ngày đạt {home.hud.daily.goal} KN để giữ chuỗi (mỗi câu đúng lần đầu +10 KN, xong một chặng mới +100 KN trở lên). Lỡ một ngày, Lệnh bài tự giữ chuỗi cho em.</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }} testID="profile-milestones">
        {streak.milestones.map((m) => <Pill key={m.days} text={`${m.reached ? '✓ ' : ''}${m.days} ngày · ${m.label}`} bg={m.reached ? t.greenSoft : t.card2} fg={m.reached ? t.green : t.muted} strong={m.reached} />)}
      </View>
    </BtCard>
  );
  const levelCard = (
    <BtCard testID="profile-level">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <Txt f="heavy" size={15} color={t.ink}>Cấp {lv.level}{lv.title ? ` · ${lv.title}` : ''}</Txt>
        <Txt size={12.5} color={t.muted}>{lv.next_xp ? `${num(lv.xp)} / ${num(lv.next_xp)} KN` : 'Cấp cao nhất'}</Txt>
      </View>
      <BtBar value={lv.progress / 100} color={t.accent} label={`Tiến độ lên cấp ${lv.level + 1}: ${lv.progress}%`} />
      {lv.next_xp ? <Txt size={12.5} color={t.soft}>Còn {num(Math.max(0, lv.next_xp - lv.xp))} KN nữa lên cấp {lv.level + 1}{lv.next_title ? ` – ${lv.next_title}` : ''}.</Txt> : null}
      <Eyebrow text="Cách kiếm" color={t.muted} />
      <View style={{ borderRadius: 12, borderWidth: 1, borderColor: t.line, overflow: 'hidden' }} testID="profile-earn">
        <View style={{ flexDirection: 'row', backgroundColor: t.card2, paddingHorizontal: 10, paddingVertical: 7 }}>
          <Txt f="heavy" size={12} color={t.muted} style={{ flex: 1 }}>Việc làm</Txt>
          <Txt f="heavy" size={12} color={t.muted} style={{ width: 86, textAlign: 'right' }}>KN</Txt>
          <Txt f="heavy" size={12} color={t.muted} style={{ width: 78, textAlign: 'right' }}>Vàng</Txt>
        </View>
        {EARN.map((r, i) => (
          <View key={r.text} style={{ flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: t.line, alignItems: 'center' }}>
            <Txt size={13} color={t.ink} style={{ flex: 1, paddingRight: 6 }}>{r.text}</Txt>
            <Txt f="heavy" size={12.5} color={t.accent} style={{ width: 86, textAlign: 'right' }}>{r.xp}</Txt>
            <Txt f="heavy" size={12.5} color={t.goldInk} style={{ width: 78, textAlign: 'right' }}>{r.gold || '–'}</Txt>
          </View>
        ))}
      </View>
      <Txt size={12} color={t.muted} style={{ lineHeight: 17 }}>KN chỉ để lên cấp. Vàng chỉ dùng ở Chợ phiên Thăng Long. Chơi lại một chặng không được thưởng lần hai.</Txt>
    </BtCard>
  );
  const rankCard = (
    <BtCard testID="profile-khoa-bang">
      <Eyebrow text="Khoa bảng" />
      {rank.names.map((n, i) => {
        const got = i <= rank.level, now = i === rank.level;
        return (
          <View key={n} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, opacity: got ? 1 : 0.7 }} testID={`rank-${i}`}>
            <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: now ? t.accent : got ? t.goldSoft : t.card2, borderWidth: got && !now ? 1 : 0, borderColor: t.line2 }}>
              {got && !now ? <Check size={15} color={t.goldInk} strokeWidth={3} /> : <Txt f="heavy" size={13} color={now ? t.onAccent : t.muted}>{i + 1}</Txt>}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt f="heavy" size={14} color={now ? t.accent : t.ink}>{n}</Txt>
              <Txt size={12} color={t.muted}>{RANK_RULE[i]}</Txt>
            </View>
            {now ? <Pill text="Hiện tại" bg={t.goldSoft} fg={t.goldInk} strong /> : null}
          </View>
        );
      })}
      {rank.next && rank.next_name ? (
        <View style={{ gap: 5 }}>
          <BtBar value={rank.next.total ? rank.next.done / rank.next.total : 0} label={`Tiến độ tới ${rank.next_name}`} />
          <Txt size={12.5} color={t.soft}>Còn {Math.max(0, rank.next.total - rank.next.done)} {rank.next.unit} nữa để đỗ {rank.next_name}{rank.next.grade ? ` (Khối ${rank.next.grade})` : ''}.</Txt>
        </View>
      ) : null}
    </BtCard>
  );
  const lookCard = (
    <BtCard testID="profile-look">
      <Txt f="heavy" size={15} color={t.ink}>Ảnh nhân vật</Txt>
      {w ? <AvatarPicker codes={w.avatars} value={w.equipped.avatar ?? null} name={name} uri={session.user.avatar_url} busy={busy} onPick={(avatar) => equip({ avatar }, 'Đã đổi ảnh đại diện')} />
        : data.error ? <Txt size={12} color={t.muted}>{data.error}</Txt> : <Spinner />}
      {w ? (
        <View style={{ gap: 8 }}>
          <Txt f="heavy" size={15} color={t.ink}>Danh hiệu</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} testID="profile-titles">
            <Pressable onPress={() => equip({ title: null }, 'Đã bỏ danh hiệu')} disabled={busy || !w.equipped.title} accessibilityRole="button" accessibilityState={{ selected: !w.equipped.title }} testID="profile-title-none"
              style={{ minHeight: 36, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1.5, borderColor: !w.equipped.title ? t.accent : t.line, justifyContent: 'center' }}>
              <Txt f="heavy" size={12.5} color={!w.equipped.title ? t.accent : t.muted}>Không dùng</Txt>
            </Pressable>
            {w.titles.filter((x) => x.unlocked).map((x) => (
              <Pressable key={x.code} onPress={() => equip({ title: x.code }, `Đã dùng danh hiệu ${x.name}`)} disabled={busy || w.equipped.title?.code === x.code} accessibilityRole="button"
                accessibilityState={{ selected: w.equipped.title?.code === x.code }} accessibilityLabel={`Danh hiệu ${x.name}`} testID={`profile-title-${x.code}`}
                style={{ minHeight: 36, paddingHorizontal: 6, borderRadius: 999, borderWidth: 1.5, borderColor: w.equipped.title?.code === x.code ? t.accent : 'transparent', justifyContent: 'center' }}>
                <TitleBadge title={x} />
              </Pressable>
            ))}
          </View>
          <Txt size={12} color={t.muted}>{w.titles.some((x) => x.unlocked) ? `Mở hòm báu trên bản đồ Chiến dịch để nhận thêm danh hiệu (đã mở ${w.opened}/${w.total} hòm).` : 'Mở hòm báu trên bản đồ Chiến dịch để nhận danh hiệu đầu tiên.'}</Txt>
        </View>
      ) : null}
    </BtCard>
  );
  const actions = (
    <View style={{ gap: 8 }} testID="profile-actions">
      <BtButton title="Đổi khung, cờ hiệu ở Chợ phiên" icon={Store} onPress={() => nav.go('cua-hang')} full testID="profile-shop" />
      <BtButton title="Giao diện" icon={Palette} tone="ghost" onPress={() => nav.go('giao-dien')} full testID="profile-theme" />
      <BtButton title="Tài khoản và mật khẩu" icon={KeyRound} tone="ghost" onPress={() => nav.openAccount?.()} full testID="profile-account" />
      <BtButton title="Lớp học của em" icon={Users} tone="ghost" onPress={() => nav.go('lop-hoc')} full testID="profile-classes" />
      <BtButton title="Trợ giúp" icon={LifeBuoy} tone="ghost" onPress={() => nav.go('tro-giup')} full testID="profile-help" />
      <BtButton title="Đăng xuất" icon={LogOut} tone="muted" onPress={() => session.logout()} full testID="profile-logout" />
    </View>
  );
  return (
    <BtPage testID="saga-profile" tabBar={false} max={1080}>
      {head}
      <Columns left={<>{hero}{statRow}{streakCard}{levelCard}</>} right={<>{rankCard}{lookCard}{actions}</>} />
    </BtPage>
  );
};

const SHOP_TABS: Array<{ value: ShopKind | 'item'; label: string }> = [{ value: 'frame', label: 'Khung' }, { value: 'flag', label: 'Cờ hiệu' }, { value: 'theme', label: 'Giao diện' }, { value: 'item', label: 'Vật phẩm' }];
/**
 * Chợ phiên Thăng Long (bản vẽ màn 14): xem thử khung / cờ hiệu trên ảnh của em, mua bằng vàng (máy chủ trừ vàng qua sổ cái, mua rồi tự trang bị) hoặc dùng món đã có;
 * vật phẩm hỗ trợ (Lệnh bài giữ chuỗi, Gợi ý chiến thuật) có giới hạn mỗi tuần. Món đẹp nhất chỉ mở bằng thành tích.
 */
export const ShopScreen: React.FC<{ session: Session; nav: SagaNav }> = ({ session, nav }) => {
  const t = useBT();
  const toast = useToast();
  const data = useLoad<Wardrobe>(session, (tk) => saga.shop(tk), []);
  const [tab, setTab] = useState<ShopKind | 'item'>('frame');
  const [preview, setPreview] = useState<{ frame?: LookItem | null; flag?: LookItem | null; theme?: string }>({});
  const [confirm, setConfirm] = useState<{ kind: ShopKind | 'item'; code: string; name: string; price: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const w = data.data;
  const name = session.user.full_name;
  const done = (next: Wardrobe, msg: string): void => { data.set(next); nav.refresh(); toast(msg); };
  const equip = (kind: ShopKind, code: string): void => {
    setBusy(true);
    saga.equipLook(session.token, { [kind]: code }).then((next) => { done(next, 'Đã trang bị'); if (kind === 'theme') nav.setTheme?.(code); })
      .catch((e) => toast(errorMessage(e))).finally(() => setBusy(false));
  };
  const buy = (): void => {
    const it = confirm;
    if (!it) return;
    setBusy(true);
    saga.buy(session.token, it.kind, it.code).then(async (next) => {
      if (it.kind === 'item') { done(next, `Đã mua ${it.name}`); return; }
      const worn = await saga.equipLook(session.token, { [it.kind]: it.code });
      done(worn, `Đã mua và trang bị ${it.name}`);
      if (it.kind === 'theme') nav.setTheme?.(it.code);
    }).catch((e) => { toast(errorMessage(e)); data.reload(); }).finally(() => { setBusy(false); setConfirm(null); });
  };
  const head = <ScreenHead eyebrow="Chợ phiên Thăng Long" title="Đổi vàng lấy đồ trang trí" onBack={() => nav.back('ho-so')} backLabel="Quay lại Hồ sơ" right={w ? <GoldPill gold={w.gold} /> : null} />;
  if (!w) return <BtPage testID="saga-shop" tabBar={false} max={1080}>{head}{data.error ? <TtSays tone="warn"><Txt size={13} color={t.ink}>{data.error}</Txt></TtSays> : <Spinner />}</BtPage>;
  const eq = w.equipped;
  const frame = preview.frame !== undefined ? preview.frame : eq.frame;
  const flag = preview.flag !== undefined ? preview.flag : eq.flag ?? null;
  const list: LookSlot[] = tab === 'frame' ? w.frames : tab === 'flag' ? w.flags : tab === 'theme' ? w.themes : [];
  const isOn = (kind: ShopKind, code: string): boolean => (kind === 'frame' ? eq.frame?.code === code : kind === 'flag' ? eq.flag?.code === code : (eq.theme ?? 'thang-long') === code);
  const isSel = (kind: ShopKind, code: string): boolean => (kind === 'frame' ? preview.frame?.code === code : kind === 'flag' ? preview.flag?.code === code : preview.theme === code);
  const select = (kind: ShopKind, s: LookSlot): void => setPreview((p) => (kind === 'theme' ? { ...p, theme: s.code } : { ...p, [kind]: s }));

  const previewCard = tab === 'theme' ? (
    <BtCard tone="sunk" testID="shop-preview" style={{ alignItems: 'center' }}>
      <ThemePreview code={preview.theme ?? eq.theme ?? 'thang-long'} width={140} />
      <Txt f="heavy" size={14} color={t.ink}>{themeOf(preview.theme ?? eq.theme).name}</Txt>
      <Txt size={12.5} color={t.muted} center>{themeOf(preview.theme ?? eq.theme).desc}</Txt>
    </BtCard>
  ) : (
    <BtCard tone="sunk" testID="shop-preview" style={{ alignItems: 'center' }}>
      <FramedAvatar name={name} uri={session.user.avatar_url} size={92} frame={frame} preset={eq.avatar} flag={flag} testID="shop-preview-avatar" />
      <SerifTitle size={19} center>{name}</SerifTitle>
      <Txt size={12.5} color={t.muted} center>{[frame ? `Khung: ${frame.name}` : 'Không khung', flag ? `Cờ hiệu: ${flag.name}` : 'Không cờ hiệu'].join(' · ')}</Txt>
      {preview.frame !== undefined || preview.flag !== undefined ? <BtButton title="Bỏ xem thử" size="sm" tone="ghost" onPress={() => setPreview({})} testID="shop-preview-reset" /> : null}
    </BtCard>
  );
  return (
    <BtPage testID="saga-shop" tabBar={false} max={1080}>
      {head}
      <Columns split={0.8} left={<>{previewCard}<TtSays tone="light"><Txt size={12.5} color={t.soft} style={{ lineHeight: 18 }}>{ACHIEVEMENT_NOTE}</Txt></TtSays></>} right={(
        <>
          <SegTabs options={SHOP_TABS} value={tab} onChange={setTab} label="Loại hàng" testID="shop-tab" />
          {tab === 'item' ? (
            <View style={{ gap: 10 }}>
              {w.items.map((it) => {
                const full = it.code === 'lenh-bai' && w.freezes >= w.freeze_max;
                const weekDone = it.bought_week >= it.weekly;
                const short = w.gold < it.price;
                const Icon = it.code === 'lenh-bai' ? ShieldCheck : Lightbulb;
                return (
                  <BtCard key={it.code} testID={`shop-item-${it.code}`}>
                    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                      <View style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: t.goldSoft, alignItems: 'center', justifyContent: 'center' }}><Icon size={22} color={t.goldInk} /></View>
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <Txt f="heavy" size={15} color={t.ink}>{it.name}</Txt>
                        <Txt size={13} color={t.soft}>{it.note}</Txt>
                        <Txt size={12} color={t.muted}>Đang có {it.have}{it.code === 'lenh-bai' ? `/${w.freeze_max}` : ''} · Tuần này đã mua {it.bought_week}/{it.weekly}</Txt>
                      </View>
                    </View>
                    <BtButton title={full ? 'Đang giữ tối đa' : weekDone ? 'Hết lượt tuần này' : short ? `Cần thêm ${it.price - w.gold} vàng` : `Mua · ${it.price} vàng`} icon={Coins} tone="gold" size="sm"
                      disabled={busy || full || weekDone || short} onPress={() => setConfirm({ kind: 'item', code: it.code, name: it.name, price: it.price })} full testID={`shop-buy-item-${it.code}`} />
                  </BtCard>
                );
              })}
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }} testID={`shop-grid-${tab}`}>
              {list.map((s) => (
                <ShopCard key={s.code} kind={tab} slot={s} active={isOn(tab, s.code)} selected={isSel(tab, s.code)} gold={w.gold} busy={busy} name={name} uri={session.user.avatar_url} preset={eq.avatar}
                  onSelect={() => select(tab, s)} onEquip={() => equip(tab, s.code)} onBuy={() => setConfirm({ kind: tab, code: s.code, name: s.name, price: s.price ?? 0 })} />
              ))}
            </View>
          )}
        </>
      )} />
      {confirm ? (
        <Sheet open onClose={() => (busy ? undefined : setConfirm(null))} title={`Mua ${confirm.name}?`} subtitle={`Giá ${confirm.price} vàng · em đang có ${w.gold.toLocaleString('vi-VN')} vàng`}
          footer={(
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <BtButton title="Để sau" tone="ghost" onPress={() => setConfirm(null)} disabled={busy} style={{ flex: 1 }} testID="shop-cancel" />
              <BtButton title={`Mua · ${confirm.price} vàng`} icon={Coins} tone="gold" onPress={buy} loading={busy} style={{ flex: 1 }} testID="shop-confirm" />
            </View>
          )}>
          <Txt size={14} color={t.soft} style={{ lineHeight: 21 }} testID="shop-confirm-text">
            {confirm.kind === 'item' ? 'Vật phẩm dùng ngay khi cần; mỗi tuần mua có giới hạn.' : 'Mua xong em trang bị luôn; đổi lại món khác bất cứ lúc nào ở Chợ phiên.'} Còn lại {Math.max(0, w.gold - confirm.price).toLocaleString('vi-VN')} vàng sau khi mua.
          </Txt>
        </Sheet>
      ) : null}
    </BtPage>
  );
};

/** Giao diện (bản vẽ màn 15): xem thử trên khung điện thoại, dùng / mua bằng vàng; Hoàng thành chỉ dành cho Trạng nguyên. Đổi xong cả trang học sinh đổi màu ngay. */
export const ThemeScreen: React.FC<{ session: Session; nav: SagaNav }> = ({ session, nav }) => {
  const t = useBT();
  const toast = useToast();
  const data = useLoad<Wardrobe>(session, (tk) => saga.shop(tk), []);
  const [pick, setPick] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const w = data.data;
  const head = <ScreenHead eyebrow="Giao diện" title="Chọn màu cho trang của em" onBack={() => nav.back('ho-so')} backLabel="Quay lại Hồ sơ" right={w ? <GoldPill gold={w.gold} /> : null} />;
  if (!w) return <BtPage testID="saga-theme" tabBar={false} max={1080}>{head}{data.error ? <TtSays tone="warn"><Txt size={13} color={t.ink}>{data.error}</Txt></TtSays> : <Spinner />}</BtPage>;
  const cur = (w.equipped.theme as string | undefined) ?? 'thang-long';
  const sel = pick ?? cur;
  const slot = w.themes.find((x) => x.code === sel) ?? null;
  const apply = (code: string, buyFirst: boolean): void => {
    setBusy(true);
    const go = buyFirst ? saga.buy(session.token, 'theme', code).then(() => saga.equipLook(session.token, { theme: code })) : saga.equipLook(session.token, { theme: code });
    go.then((next) => { data.set(next); nav.refresh(); nav.setTheme?.(code); toast(`Đã đổi sang giao diện ${themeOf(code).name}`); })
      .catch((e) => { toast(errorMessage(e)); data.reload(); }).finally(() => setBusy(false));
  };
  const action = !slot ? null : slot.code === cur ? <Pill text="Đang dùng" bg={t.greenSoft} fg={t.green} strong testID="theme-current" />
    : slot.unlocked ? <BtButton title="Dùng giao diện này" onPress={() => apply(slot.code, false)} loading={busy} full testID="theme-apply" />
    : slot.buyable ? <BtButton title={w.gold < (slot.price ?? 0) ? `Cần thêm ${(slot.price ?? 0) - w.gold} vàng` : `Mua và dùng · ${slot.price} vàng`} icon={Coins} tone="gold" onPress={() => apply(slot.code, true)} loading={busy} disabled={w.gold < (slot.price ?? 0)} full testID="theme-buy" />
    : <Txt size={13} color={t.muted} center testID="theme-locked">Chỉ mở bằng thành tích: {slot.need}</Txt>;
  return (
    <BtPage testID="saga-theme" tabBar={false} max={1080}>
      {head}
      <Columns split={0.8} left={(
        <BtCard tone="sunk" style={{ alignItems: 'center' }} testID="theme-preview-card">
          <ThemePreview code={sel} width={170} />
          <SerifTitle size={20} center>{themeOf(sel).name}</SerifTitle>
          <Txt size={13} color={t.soft} center style={{ lineHeight: 19 }}>{themeOf(sel).desc}</Txt>
          {action}
        </BtCard>
      )} right={(
        <View style={{ gap: 10 }}>
          {w.themes.map((x) => {
            const on = x.code === sel;
            return (
              <Pressable key={x.code} onPress={() => setPick(x.code)} accessibilityRole="radio" accessibilityState={{ checked: on }} testID={`theme-${x.code}`}
                accessibilityLabel={`${x.name}${x.code === cur ? ', đang dùng' : x.unlocked ? ', em đã có' : x.buyable ? `, giá ${x.price} vàng` : `, ${x.need}`}`}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 2, borderColor: on ? t.accent : t.line, backgroundColor: t.card, padding: 12, opacity: pressed ? 0.88 : 1 })}>
                <ThemeSwatch code={x.code} size={52} />
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Txt f="heavy" size={15} color={t.ink}>{x.name}</Txt>
                  <Txt size={12.5} color={t.muted} numberOfLines={2}>{themeOf(x.code).desc}</Txt>
                </View>
                {x.code === cur ? <Check size={18} color={t.green} /> : x.unlocked ? <Txt f="heavy" size={12} color={t.green}>Đã có</Txt>
                  : x.buyable ? <Txt f="heavy" size={12} color={t.goldInk}>{x.price} vàng</Txt> : <Lock size={16} color={t.muted} />}
              </Pressable>
            );
          })}
          <TtSays tone="light"><Txt size={12.5} color={t.soft} style={{ lineHeight: 18 }}>Giao diện chỉ đổi màu trang học sinh của em; nội dung và phần thưởng như nhau. Đêm Đông Bộ Đầu là giao diện tối, đỡ chói khi học buổi tối.</Txt></TtSays>
        </View>
      )} />
    </BtPage>
  );
};
