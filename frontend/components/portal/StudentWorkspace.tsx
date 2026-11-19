/**
 * Khung trang học sinh, độc lập với khung quản trị; mọi thao tác tài khoản dùng lại API sẵn có.
 * 20/11/2026 (người dùng chọn "Bỏ menu trái, trang cuộn dọc"): không còn menu bên trái / ngăn kéo menu. Thanh trên cùng có logo, trường,
 * chỉ số, cài đặt, thông báo, hồ sơ (đổi mật khẩu trong hồ sơ), đăng xuất; ngay dưới là dải nút các mục (Chiến dịch, Nhập vai, Câu hỏi ôn tập, ...),
 * màn hẹp thì dải nút cuộn ngang và tự cuộn tới mục đang mở.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import { KeyRound, LogOut } from 'lucide-react-native';
import * as authApi from '@/api/authApi';
import { BrandLogo } from '@/components/art';
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
  const [profile, setProfile] = useState(false);
  const loadProfile = useCallback(() => authApi.getProfile(session.token), [session.token]);
  const saveProfile = useCallback((patch: ProfilePatch) => authApi.updateProfile(session.token, patch), [session.token]);
  const uploadAvatar = useCallback((img: { data: string }) => authApi.uploadAvatar(session.token, img), [session.token]);
  // dải nút cuộn ngang: đưa mục đang mở vào khung nhìn
  const strip = useRef<ScrollViewInstance | null>(null);
  const spots = useRef<Partial<Record<string, number>>>({});
  useEffect(() => {
    const x = spots.current[active];
    if (x !== undefined) strip.current?.scrollTo({ x: Math.max(0, x - 24), animated: true });
  }, [active]);
  const pad = wide ? 24 : 12;

  return (
    <View testID="student-workspace" style={{ flex: 1, backgroundColor: S.canvas }}>
      <View testID="student-topbar" style={{ backgroundColor: S.white, borderBottomWidth: 1, borderBottomColor: S.line }}>
        <View style={{ minHeight: wide ? 72 : 62, paddingHorizontal: pad, flexDirection: 'row', alignItems: 'center', gap: wide ? 14 : 6 }}>
          <View style={{ flexShrink: 1, minWidth: 0 }}><BrandLogo compact={width < 420} brand={brand} /></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            {width >= 760 ? <Txt size={12} color={S.muted} numberOfLines={1}>{schoolName ?? 'Không gian học sinh Đông A'}</Txt> : null}
          </View>
          {home && width >= 1320 ? <LearnerStats home={home} compact /> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>{extra}</View>
          <Pressable testID="student-profile-open" accessibilityRole="button" accessibilityLabel="Hồ sơ cá nhân (đổi mật khẩu trong hồ sơ)" onPress={() => setProfile(true)} style={{ minHeight: 44, minWidth: 44, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {avatar ?? <Avatar name={session.user.full_name} uri={session.user.avatar_url} size={38} />}
            {width >= 1500 ? <View style={{ maxWidth: 160 }}><Txt f="bold" size={14} numberOfLines={1}>{session.user.full_name}</Txt>{roleLine ?? <Txt size={12} color={S.muted}>Nhà khám phá</Txt>}</View> : null}
          </Pressable>
          <Pressable testID="student-logout" accessibilityRole="button" accessibilityLabel="Đăng xuất" onPress={() => session.logout()} style={({ pressed }) => ({ minWidth: 44, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? S.line : S.canvas })}><LogOut size={19} color={S.muted} /></Pressable>
        </View>
        <ScrollView ref={strip} horizontal showsHorizontalScrollIndicator={false} testID="student-tabs" accessibilityRole="tablist" accessibilityLabel="Các mục học tập"
          contentContainerStyle={{ paddingHorizontal: pad, paddingBottom: 10, gap: 8, flexGrow: 1, justifyContent: wide ? 'center' : 'flex-start' }}>
          {nav.map(({ id, label, icon: Icon, count }) => {
            const selected = id === active;
            return (
              <Pressable key={id} testID={`student-nav-${id}`} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected }}
                onLayout={(e) => { spots.current[id] = e.nativeEvent.layout.x; }} onPress={() => onSelect(id)}
                style={({ pressed }) => ({ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1,
                  borderColor: selected ? S.deep : S.line, backgroundColor: selected ? S.deep : pressed ? S.mint : S.white })}>
                <Icon size={18} strokeWidth={selected ? 2.4 : 2} color={selected ? S.gold : S.teal} />
                <Txt f="bold" size={14} color={selected ? '#ffffff' : S.ink}>{label}</Txt>
                {count !== undefined && count > 0 ? <View style={{ borderRadius: 10, minWidth: 22, minHeight: 22, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? S.gold : S.teal }}><Txt f="bold" size={12} color={selected ? S.deep : '#ffffff'}>{count > 99 ? '99+' : count}</Txt></View> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <View style={{ flex: 1, minHeight: 0 }}>{children}</View>
      {profile ? <ProfileSheet onClose={() => setProfile(false)} load={loadProfile} save={saveProfile} upload={uploadAvatar} onSaved={session.updateUser} avatar={profileAvatar} extra={profileExtra}>
        <Btn title="Đổi mật khẩu" icon={KeyRound} tone="giay" onPress={() => { setProfile(false); session.changePassword(); }} />
      </ProfileSheet> : null}
    </View>
  );
}
