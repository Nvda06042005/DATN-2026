import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { KeyRound, LogOut, Menu, User, X } from 'lucide-react-native';
import * as authApi from '@/api/authApi';
import { ProfileSheet } from '@/components/profile';
import { AccountSecurity } from '@/components/admin/PlatformOps';
import { BrandLogo, PatternOverlay } from '@/components/art';
import { BrandWordmark } from '@/components/brand-wordmark';
import { ROLE_LABEL, type Session } from '@/components/auth';
import { Avatar, Txt } from '@/components/ui';
import { useSystemBrand } from '@/hooks/use-system-brand';
import { useTheme } from '@/hooks/use-theme';
import { fmt } from '@/lib/format';
import type { ProfilePatch } from '@/types/api';
import type { IconType } from '@/types/game';

/** Kính mờ của thanh đầu trang, giống thanh đầu trang của trang chủ */
const GLASS = (Platform.OS === 'web' ? { backdropFilter: 'blur(10px)' } : null) as unknown as ViewStyle;
/** `text-wrap: pretty` được kế thừa: mọi đoạn chữ trong khung quản trị không còn dòng cuối chỉ có một từ lẻ ("… cho học / sinh."). */
const WRAP_PRETTY = (Platform.OS === 'web' ? { textWrap: 'pretty' } : null) as unknown as ViewStyle;

/**
 * Khung chung của cổng quản trị tổng, quản trị trường và giáo viên. Dùng cùng ngôn ngữ thiết kế với trang chủ: nền giấy dó có hoa văn trống đồng,
 * thanh đầu trang dạng viên thuốc nổi, nút tối bo tròn, thanh bên bo góc; chân trang có dòng bản quyền như ở trang đăng nhập.
 */
export function AdminWorkspace<T extends string>({ session, nav, active, onSelect, extra, schoolName, children }: {
  session: Session; nav: Array<{ id: T; label: string; icon: IconType; count?: number }>;
  active: T; onSelect: (tab: T) => void; extra?: ReactNode; schoolName?: string; children: ReactNode;
}) {
  const { c } = useTheme();
  const brand = useSystemBrand(session.token);
  const { width } = useWindowDimensions();
  const wide = width >= 1000;
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState(false);
  const loadProfile = useCallback(() => authApi.getProfile(session.token), [session.token]);
  const saveProfile = useCallback((patch: ProfilePatch) => authApi.updateProfile(session.token, patch), [session.token]);
  const uploadAvatar = useCallback((img: { data: string }) => authApi.uploadAvatar(session.token, img), [session.token]);
  const label = nav.find(item => item.id === active)?.label ?? 'Quản trị';
  useEffect(() => {
    if (!open || Platform.OS !== 'web') return undefined;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [open]);
  useEffect(() => { if (wide) setOpen(false); }, [wide]);

  const sidebar = (
    <LinearGradient testID="admin-sidebar" colors={[c.son, c.sonDam]} style={wide ? { width: 232, marginLeft: 16, marginBottom: 12, borderRadius: 20, overflow: 'hidden' } : { width: 260, height: '100%' }}>
      <PatternOverlay opacity={0.045} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, padding: 14, paddingTop: 26, gap: 18 }}>
        <Txt f="bold" upper size={10} color={c.trang} style={{ paddingHorizontal: 10, letterSpacing: 1.3, opacity: 0.8 }}>{session.user.role === 'root_admin' ? 'Quản trị hệ thống' : session.user.role === 'teacher' ? 'Không gian giáo viên' : 'Quản trị trường học'}</Txt>
        <View accessibilityRole="tablist" accessibilityLabel="Chức năng quản trị" style={{ gap: 6 }}>
          {nav.map(item => {
            const selected = item.id === active, Icon = item.icon;
            return <Pressable key={item.id} testID={`admin-nav-${item.id}`} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => { onSelect(item.id); setOpen(false); }} style={({ pressed }) => ({ minHeight: 46, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 5, backgroundColor: selected ? c.the : pressed ? c.kinh : 'transparent' })}>
              <Icon size={18} color={selected ? c.son : c.trang} />
              <Txt f={selected ? 'bold' : 'medium'} size={13} color={selected ? c.son : c.trang} style={{ flex: 1 }}>{item.label}</Txt>
              {item.count !== undefined && <Txt f="bold" size={11} color={selected ? c.son : c.trang}>{fmt(item.count)}</Txt>}
            </Pressable>;
          })}
        </View>
        <View style={{ marginTop: 'auto', padding: 10, paddingTop: 30, gap: 10 }}>
          <BrandWordmark height={24} color={c.trang} />
          <Txt size={11} color={c.trang} style={{ opacity: 0.85 }}>Học lịch sử qua trải nghiệm</Txt>
          <Txt f="bold" size={12} color={c.trang} numberOfLines={2}>{session.user.full_name}</Txt>
          <Pressable accessibilityRole="button" accessibilityLabel="Hồ sơ cá nhân" testID="open-profile" onPress={() => { setOpen(false); setProfile(true); }} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }}><User size={16} color={c.trang} /><Txt size={12} color={c.trang}>Hồ sơ cá nhân</Txt></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Đổi mật khẩu" onPress={session.changePassword} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }}><KeyRound size={16} color={c.trang} /><Txt size={12} color={c.trang}>Đổi mật khẩu</Txt></Pressable>
        </View>
      </ScrollView>
    </LinearGradient>
  );
  const trail = [schoolName, `${session.user.role === 'teacher' ? 'Giáo viên' : 'Quản trị'} / ${label}`].filter(Boolean).join(' · ');
  const roomy = width >= 680;
  return (
    <View testID="admin-workspace" style={[{ flex: 1, backgroundColor: c.logoPaper }, WRAP_PRETTY]}>
      <PatternOverlay opacity={0.075} />
      <View testID="admin-topbar" style={[{ minHeight: wide ? 64 : 58, marginHorizontal: wide ? 16 : 10, marginTop: wide ? 14 : 8, marginBottom: wide ? 12 : 8, borderRadius: 999, borderWidth: 1, borderColor: c.bienXanh, backgroundColor: c.kinhDac, paddingHorizontal: wide ? 14 : 6, flexDirection: 'row', alignItems: 'center', gap: wide ? 20 : 6, zIndex: 20 }, GLASS]}>
        {!wide && <Pressable testID="admin-menu-toggle" accessibilityRole="button" accessibilityLabel={open ? 'Đóng menu quản trị' : 'Mở menu quản trị'} accessibilityState={{ expanded: open }} onPress={() => setOpen(value => !value)} style={{ width: 44, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center' }}>{open ? <X size={23} color={c.logoInk} /> : <Menu size={23} color={c.logoInk} />}</Pressable>}
        <View style={{ flexShrink: 1 }}><BrandLogo compact={width < 350} brand={brand} /></View>
        {wide && <Txt f="semibold" size={12} color={c.muc3} numberOfLines={1} style={{ flex: 1 }}>{trail}</Txt>}
        <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {extra}
          <Pressable testID="admin-profile-open" accessibilityRole="button" accessibilityLabel="Mở hồ sơ cá nhân" onPress={() => setProfile(true)} style={({ pressed }) => ({ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 4, paddingRight: roomy ? 12 : 4, borderRadius: 999, backgroundColor: pressed ? c.adminCanvas : 'transparent' })}>
            <Avatar name={session.user.full_name} uri={session.user.avatar_url} size={34} />
            {roomy && <View style={{ maxWidth: 190 }}><Txt f="bold" size={12} numberOfLines={1}>{session.user.full_name}</Txt><Txt size={10} color={c.muc3}>{ROLE_LABEL[session.user.role]}</Txt></View>}
          </Pressable>
          <Pressable testID="admin-logout" accessibilityRole="button" accessibilityLabel="Đăng xuất" onPress={() => session.logout()} style={({ pressed }) => ({ minHeight: 44, minWidth: 44, paddingHorizontal: roomy ? 18 : 12, borderRadius: 999, backgroundColor: pressed ? c.logoInk : c.den, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 })}>
            <LogOut size={16} color={c.trang} />{roomy && <Txt f="bold" size={14} color={c.trang}>Đăng xuất</Txt>}
          </Pressable>
        </View>
      </View>
      <View style={{ flex: 1, flexDirection: 'row', minHeight: 0 }}>
        {wide && sidebar}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flex: 1, minHeight: 0 }}>{children}</View>
          <Txt testID="admin-copyright" f="body" size={11} color={c.muc3} center style={{ paddingVertical: 8 }}>© 2026 · Bản quyền thuộc quản lý Đông A</Txt>
        </View>
        {profile && <ProfileSheet onClose={() => setProfile(false)} load={loadProfile} save={saveProfile} upload={uploadAvatar} onSaved={session.updateUser}>
          {(session.user.role === 'root_admin' || session.user.role === 'school_admin') ? <AccountSecurity session={session} /> : null}
        </ProfileSheet>}
        {!wide && open && <View style={{ position: 'absolute', inset: 0, zIndex: 40 }}><Pressable accessibilityRole="button" accessibilityLabel="Đóng menu quản trị" onPress={() => setOpen(false)} style={{ position: 'absolute', inset: 0, backgroundColor: c.scrim }} />{sidebar}</View>}
      </View>
    </View>
  );
}
