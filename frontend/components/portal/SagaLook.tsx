/**
 * Khung ảnh đại diện và danh hiệu nhận từ hòm báu (17/11/2026, kiểu quà sự kiện của Liên Quân / PUBG): khung là vòng màu xoay quanh ảnh đại diện,
 * phát sáng nhịp nhàng (khung huyền thoại có thêm tia lấp lánh); danh hiệu là nhãn có viền sáng nhấp nháy. Danh mục, việc mở khóa và trang bị do máy chủ
 * quyết định (/api/saga/cosmetics); ở đây chỉ vẽ. Học sinh còn chọn được ảnh đại diện có sẵn theo nhân vật của dự án (Rồng Con, danh tướng) ở Hồ sơ cá nhân và Kho trang phục. Máy bật "giảm chuyển động" thì đứng yên. Không dùng hình ảnh của các trò chơi kể trên.
 */
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { Check, Lock, Sparkles } from 'lucide-react-native';
import * as saga from '@/lib/saga-api';
import { errorMessage } from '@/api/client';
import type { Session } from '@/components/auth';
import { Mascot, type MascotAccessory, type MascotMood } from '@/components/art';
import { Portrait, useLoad } from '@/components/portal/SagaKit';
import { Avatar, Chip, Sheet, Spinner, Txt, useToast } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { LookItem, LookRarity, LookSlot, SagaLook, Wardrobe } from '@/types/saga';

/** Màu và hiệu ứng của từng khung (mã do máy chủ cấp); món lạ dùng màu theo độ hiếm */
const FRAME_STYLE: Record<string, { colors: string[]; glow: string; speed: number; sparkle: boolean }> = {
  'dong-bo-dau': { colors: ['#15803d', '#86efac', '#facc15', '#15803d'], glow: '#22c55e', speed: 6000, sparkle: false },
  'chuong-duong': { colors: ['#c2410c', '#fde047', '#f97316', '#fde047', '#c2410c'], glow: '#f97316', speed: 3600, sparkle: false },
  'bach-dang': { colors: ['#b91c1c', '#facc15', '#0ea5e9', '#facc15', '#b91c1c'], glow: '#facc15', speed: 2400, sparkle: true },
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
export const FramedAvatar: React.FC<{ name: string; uri?: string | null; size?: number; frame?: LookItem | null; preset?: string | null; style?: StyleProp<ViewStyle>; testID?: string }> = ({ name, uri, size = 40, frame, preset, style, testID }) => {
  const look = frame ? FRAME_STYLE[frame.code] ?? { colors: RARITY_LOOK[frame.rarity].colors, glow: RARITY_LOOK[frame.rarity].glow, speed: 5000, sparkle: frame.rarity === 'legendary' } : null;
  const spin = useLoop(look?.speed ?? 4000, Boolean(look));
  const pulse = useLoop(1600, Boolean(look));
  const face = preset && AVATAR_PRESETS[preset] ? <CharacterAvatar code={preset} size={size} /> : <Avatar name={name} uri={uri} size={size} />;
  if (!look) return <View style={style} testID={testID} accessible={Boolean(preset)} accessibilityLabel={preset ? `Ảnh đại diện của ${name}: ${avatarName(preset)}` : undefined}>{face}</View>;
  const ring = Math.max(3, Math.round(size * 0.09));
  const outer = size + ring * 2;
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const glow = pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.35, 0.95, 0.35] });
  return (
    <View style={[{ width: outer, height: outer, alignItems: 'center', justifyContent: 'center' }, style]} testID={testID}
      accessible accessibilityLabel={`Ảnh đại diện của ${name}${preset && avatarName(preset) ? ` (${avatarName(preset)})` : ''}, ${frame!.name}`}>
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

