/** Learner shell: independent of the management workspace; all account actions reuse the existing APIs. */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Flag, KeyRound, LogOut, Menu, Shield, User, X } from 'lucide-react-native';
import * as authApi from '@/api/authApi';
import { BrandLogo, Mascot } from '@/components/art';
import type { Session } from '@/components/auth';
import type { NavLeaf } from '@/components/admin/AdminWorkspace';
import { ProfileSheet } from '@/components/profile';
import { Avatar, Btn, Txt } from '@/components/ui';
import { useSystemBrand } from '@/hooks/use-system-brand';
import { LearnerStats, STUDENT as S } from '@/components/portal/StudentDesign';
import type { ProfilePatch } from '@/types/api';
import type { SagaHome } from '@/types/saga';

export function StudentWorkspace<T extends string>({ session, nav, active, onSelect, extra, schoolName, children, home, avatar, roleLine, profileAvatar, profileExtra }: {
  session: Session; nav: ReadonlyArray<NavLeaf<T>>; active: T; onSelect: (tab: T) => void;
  extra?: ReactNode; schoolName?: string; children: ReactNode; home: SagaHome | null;
  avatar?: ReactNode; roleLine?: ReactNode; profileAvatar?: ReactNode; profileExtra?: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const wide = width >= 1080;
  const brand = useSystemBrand(session.token);
  const [menu, setMenu] = useState(false);
  const [profile, setProfile] = useState(false);
  const label = nav.find((item) => item.id === active)?.label ?? 'Chiến dịch';
  const loadProfile = useCallback(() => authApi.getProfile(session.token), [session.token]);
  const saveProfile = useCallback((patch: ProfilePatch) => authApi.updateProfile(session.token, patch), [session.token]);
  const uploadAvatar = useCallback((img: { data: string }) => authApi.uploadAvatar(session.token, img), [session.token]);
  useEffect(() => { if (wide) setMenu(false); }, [wide]);
  useEffect(() => {
    if (!menu || Platform.OS !== 'web') return undefined;
    const previous = document.activeElement as HTMLElement | null;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenu(false); };
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('keydown', close); previous?.focus?.(); };
  }, [menu]);

  const sidebar = (drawer = false) => (
    <View testID="student-sidebar" style={{ width: drawer ? Math.min(310, width - 32) : 232, height: '100%', flexShrink: 0, backgroundColor: S.white, borderRightWidth: 1, borderRightColor: S.line }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, padding: 16, gap: 22 }}>
        <View style={{ minHeight: 61, gap: 6, paddingHorizontal: 5, justifyContent: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <BrandLogo compact={drawer && width < 350} brand={brand} />
            {drawer ? <Pressable testID="student-menu-close" accessibilityRole="button" accessibilityLabel="Đóng menu học tập" onPress={() => setMenu(false)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><X size={22} color={S.ink} /></Pressable> : null}
          </View>
          <Txt size={12} color={S.muted}>Học sử · Mở hành trình</Txt>
        </View>
        <View style={{ padding: 14, borderRadius: 18, backgroundColor: S.deep, gap: 10 }} testID="student-level-card">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
            <View style={{ width: 37, height: 42, borderRadius: 13, backgroundColor: '#2c7770', alignItems: 'center', justifyContent: 'center' }}><Shield size={23} color={S.gold} /></View>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt f="bold" size={15} color="#ffffff">{home ? `Cấp ${home.hud.level.level} · ${home.hud.level.title}` : 'Nhà khám phá Đông A'}</Txt>
              <Txt size={12} color="#d1e8dc">{home ? `${home.totals.done}/${home.totals.stages} chặng đã hoàn thành` : 'Sẵn sàng cho hành trình mới'}</Txt>
            </View>
          </View>
          {home ? <View accessible accessibilityRole="progressbar" accessibilityLabel="Tiến độ cấp độ" accessibilityValue={{ min: 0, max: 100, now: home.hud.level.progress }} style={{ height: 8, borderRadius: 4, backgroundColor: '#397d73', overflow: 'hidden' }}><View style={{ height: '100%', width: `${Math.max(0, Math.min(100, home.hud.level.progress))}%`, borderRadius: 4, backgroundColor: S.gold }} /></View> : null}
        </View>
        <View style={{ gap: 7 }}>
          <Txt f="bold" size={11} color={S.muted} style={{ letterSpacing: 1.6, paddingHorizontal: 12, marginBottom: 3 }}>KHÔNG GIAN CỦA EM</Txt>
          <View accessibilityRole="tablist" accessibilityLabel="Các mục học tập" style={{ gap: 6 }}>
            {nav.map(({ id, label: title, icon: Icon, count }) => {
              const selected = id === active;
              return (
                <Pressable key={id} testID={`student-nav-${id}`} accessibilityRole="tab" accessibilityLabel={title} accessibilityState={{ selected }}
                  onPress={() => { onSelect(id); setMenu(false); }}
                  style={({ pressed }) => ({ minHeight: 49, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 12, borderRadius: 13,
                    borderWidth: 1, borderBottomWidth: selected ? 3 : 1, borderColor: selected ? '#b6ded0' : 'transparent', backgroundColor: selected ? S.mint : pressed ? '#f0f7f3' : 'transparent' })}>
                  <Icon size={21} strokeWidth={selected ? 2.4 : 1.9} color={selected ? S.teal : S.muted} />
                  <Txt f={selected ? 'bold' : 'semibold'} size={14} color={selected ? S.deep : S.muted} style={{ flex: 1 }}>{title}</Txt>
                  {count !== undefined && count > 0 ? <View style={{ borderRadius: 8, minWidth: 24, minHeight: 24, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? S.teal : '#edf4ef' }}><Txt f="bold" size={12} color={selected ? '#ffffff' : S.deep}>{count > 99 ? '99+' : count}</Txt></View> : null}
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={{ marginTop: 'auto', paddingTop: 9, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, padding: 11, borderRadius: 16, backgroundColor: '#fff8e3' }}>
            <Mascot size={53} mood="happy" accessory="scholar" />
            <Txt size={12} color={S.goldInk} style={{ flex: 1 }}>Mỗi ngày một chút,
              {'\n'}hiểu lịch sử thêm nhiều!</Txt>
          </View>
          <Pressable testID="open-profile" accessibilityRole="button" accessibilityLabel="Hồ sơ cá nhân" onPress={() => { setMenu(false); setProfile(true); }} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 }}><User size={19} color={S.muted} /><Txt size={14} color={S.muted}>Hồ sơ cá nhân</Txt></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Đổi mật khẩu" onPress={() => { setMenu(false); session.changePassword(); }} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 }}><KeyRound size={19} color={S.muted} /><Txt size={14} color={S.muted}>Đổi mật khẩu</Txt></Pressable>
        </View>
      </ScrollView>
    </View>
  );

  return (
    <View testID="student-workspace" style={{ flex: 1, flexDirection: 'row', backgroundColor: S.canvas }}>
      {wide ? sidebar() : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View testID="student-topbar" style={{ minHeight: wide ? 82 : 70, paddingHorizontal: wide ? 27 : 10, backgroundColor: S.white, borderBottomWidth: 1, borderBottomColor: S.line, flexDirection: 'row', alignItems: 'center', gap: wide ? 16 : 6 }}>
          {!wide ? <Pressable testID="student-menu-toggle" accessibilityRole="button" accessibilityLabel="Mở menu học tập" accessibilityState={{ expanded: menu }} onPress={() => setMenu(true)} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: S.mint }}><Menu size={23} color={S.deep} /></Pressable> : null}
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>{wide ? <Flag size={17} color={S.teal} /> : null}<Txt f="bold" size={wide ? 18 : 15} numberOfLines={1}>{label}</Txt></View>
            <Txt size={12} color={S.muted} numberOfLines={1}>{schoolName ?? 'Không gian học sinh Đông A'}</Txt>
          </View>
          {home && width >= 1320 ? <LearnerStats home={home} compact /> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>{extra}</View>
          <Pressable testID="student-profile-open" accessibilityRole="button" accessibilityLabel="Mở hồ sơ cá nhân" onPress={() => setProfile(true)} style={{ minHeight: 44, minWidth: 44, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {avatar ?? <Avatar name={session.user.full_name} uri={session.user.avatar_url} size={38} />}
            {width >= 1500 ? <View style={{ maxWidth: 160 }}><Txt f="bold" size={14} numberOfLines={1}>{session.user.full_name}</Txt>{roleLine ?? <Txt size={12} color={S.muted}>Nhà khám phá</Txt>}</View> : null}
          </Pressable>
          <Pressable testID="student-logout" accessibilityRole="button" accessibilityLabel="Đăng xuất" onPress={() => session.logout()} style={({ pressed }) => ({ minWidth: 44, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? S.line : S.canvas })}><LogOut size={19} color={S.muted} /></Pressable>
        </View>
        <View style={{ flex: 1, minHeight: 0 }}>{children}</View>
        {wide ? <Txt size={11} color={S.muted} center style={{ paddingVertical: 7 }}>Đông A EDU · Học lịch sử qua trải nghiệm · © 2026</Txt> : null}
      </View>
      {!wide && menu ? <Modal transparent visible animationType="fade" onRequestClose={() => setMenu(false)}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Đóng menu học tập" onPress={() => setMenu(false)} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(17,44,41,0.4)' }} />
          {sidebar(true)}
        </View>
      </Modal> : null}
      {profile ? <ProfileSheet onClose={() => setProfile(false)} load={loadProfile} save={saveProfile} upload={uploadAvatar} onSaved={session.updateUser} avatar={profileAvatar} extra={profileExtra}>
        <Btn title="Đổi mật khẩu" icon={KeyRound} tone="giay" onPress={() => { setProfile(false); session.changePassword(); }} />
      </ProfileSheet> : null}
    </View>
  );
}
