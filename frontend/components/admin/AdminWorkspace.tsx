import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { KeyRound, LogOut, Menu, ShieldCheck, User, X } from 'lucide-react-native';
import * as authApi from '@/api/authApi';
import { ProfileSheet } from '@/components/profile';
import { BrandLogo, PatternOverlay } from '@/components/art';
import { BrandWordmark } from '@/components/brand-wordmark';
import { ROLE_LABEL, type Session } from '@/components/auth';
import { Avatar, Btn, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { fmt } from '@/lib/format';
import type { ProfilePatch } from '@/types/api';
import type { IconType } from '@/types/game';

export function AdminWorkspace<T extends string>({ session, nav, active, onSelect, extra, schoolName, schoolCount, children }: {
  session: Session; nav: Array<{ id: T; label: string; icon: IconType; count?: number }>;
  active: T; onSelect: (tab: T) => void; extra?: ReactNode; schoolName?:string;schoolCount?:number; children: ReactNode;
}) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 1000;
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState(false);
  const loadProfile = useCallback(() => authApi.getProfile(session.token), [session.token]);
  const saveProfile = useCallback((patch: ProfilePatch) => authApi.updateProfile(session.token, patch), [session.token]);
  const label = nav.find(item => item.id === active)?.label ?? 'Quản trị';
  useEffect(() => {
    if (!open || Platform.OS !== 'web') return undefined;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [open]);
  useEffect(() => { if (wide) setOpen(false); }, [wide]);

  const sidebar = (
    <LinearGradient testID="admin-sidebar" colors={[c.son, c.sonDam]} style={{ width: wide ? 232 : 260, height: '100%' }}>
      <PatternOverlay opacity={0.045} />
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 14, paddingTop: 26, gap: 18 }}>
        <Txt f="bold" upper size={10} color={c.trang} style={{ paddingHorizontal: 10, letterSpacing: 1.3, opacity: 0.8 }}>{session.user.role === 'root_admin' ? 'Quản trị hệ thống' : 'Quản trị trường học'}</Txt>
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
  return (
    <View testID="admin-workspace" style={{ flex: 1, backgroundColor: c.adminCanvas }}>
      <View testID="admin-topbar" style={{ minHeight: wide ? 80 : 72, backgroundColor: c.the, borderBottomWidth: 1, borderBottomColor: c.adminLine, paddingHorizontal: wide ? 24 : 12, flexDirection: 'row', alignItems: 'center', gap: wide ? 28 : 8 }}>
        {!wide && <Pressable testID="admin-menu-toggle" accessibilityRole="button" accessibilityLabel={open ? 'Đóng menu quản trị' : 'Mở menu quản trị'} accessibilityState={{ expanded: open }} onPress={() => setOpen(value => !value)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>{open ? <X size={23} color={c.muc} /> : <Menu size={23} color={c.muc} />}</Pressable>}
        <View style={{ flexShrink: 1 }}><BrandLogo compact={width < 350} /></View>
        {wide && <Txt size={12} color={c.muc3} style={{ flex: 1 }}>Quản trị / {label}</Txt>}
        <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {extra}
          {width >= 680 && <><Avatar name={session.user.full_name} size={34} /><View style={{ maxWidth: 190 }}><Txt f="bold" size={12} numberOfLines={1}>{session.user.full_name}</Txt><Txt size={10} color={c.muc3}>{ROLE_LABEL[session.user.role]}</Txt></View></>}
          <Btn title={width >= 680 ? 'Đăng xuất' : undefined} label="Đăng xuất" icon={LogOut} tone="giay" size="sm" onPress={() => session.logout()} />
        </View>
      </View>
      <View testID="admin-scope" accessibilityLabel="Vai trò và phạm vi quản lý" style={{backgroundColor:session.user.role==='root_admin'?c.adminTint:c.thongNhat,borderBottomWidth:1,borderBottomColor:c.adminLine,paddingHorizontal:wide?24:16,paddingVertical:12,flexDirection:'row',alignItems:'center',gap:12}}>
        <ShieldCheck size={23} color={session.user.role==='root_admin'?c.son:c.thongChu}/>
        <View style={{flex:1,minWidth:0,gap:3}}>
          <Txt f="bold" size={14} color={session.user.role==='root_admin'?c.son:c.thongChu}>{session.user.role==='root_admin'?'Quản trị tổng · Toàn hệ thống':'Quản trị trường · Trường được gán'}</Txt>
          <Txt size={12} color={c.muc2}>{session.user.role==='root_admin'?`Bạn quản lý mọi trường${schoolCount!==undefined?` (${fmt(schoolCount)} trường)`:''}, bao gồm tài khoản quản trị trường.`:`${schoolName??`Mã trường ${session.user.school_code??'chưa xác định'}`} · Bạn chỉ truy cập dữ liệu của trường này.`}</Txt>
        </View>
      </View>
      <View style={{ flex: 1, flexDirection: 'row', minHeight: 0 }}>
        {wide && sidebar}
        <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
        {profile && <ProfileSheet onClose={() => setProfile(false)} load={loadProfile} save={saveProfile} onSaved={session.updateUser} />}
        {!wide && open && <View style={{ position: 'absolute', inset: 0, zIndex: 40 }}><Pressable accessibilityRole="button" accessibilityLabel="Đóng menu quản trị" onPress={() => setOpen(false)} style={{ position: 'absolute', inset: 0, backgroundColor: c.scrim }} />{sidebar}</View>}
      </View>
    </View>
  );
}
