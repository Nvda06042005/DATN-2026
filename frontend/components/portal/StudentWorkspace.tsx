/**
 * Khung trang học sinh, độc lập với khung quản trị; mọi thao tác tài khoản dùng lại API sẵn có.
 * 20/11/2026 (người dùng chọn "Bỏ menu trái, trang cuộn dọc"): không còn menu bên trái / ngăn kéo menu. Thanh trên cùng có logo, trường,
 * chỉ số, cài đặt, thông báo, hồ sơ (đổi mật khẩu trong hồ sơ), đăng xuất; ngay dưới là dải nút các mục (Chiến dịch, Nhập vai, Câu hỏi ôn tập, ...).
 * 23/11/2026 ("Sắc Việt", người dùng chọn "Giữ dải nút trên cùng"): dải nút kiểu trò chơi học tập – mỗi mục một huy hiệu tròn màu, chữ đậm, mục đang mở
 * có viền khối; dải hoa văn đỏ son trên cùng. Điện thoại (bề ngang dưới 760) dùng **thanh mục dưới đáy** (4 mục đầu + "Thêm" mở bảng các mục còn lại,
 * ngay trong trang, không phải menu trái hay hộp thoại).
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import { Grid2x2, KeyRound, LogOut, X } from 'lucide-react-native';
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

/** Màu huy hiệu của từng mục (mục lạ dùng đỏ son) */
const TAB_COLOR: Record<string, string> = {
  'chien-dich': S.red, 'nhap-vai': S.green, 'cau-hoi': S.orange, 'ky-thi': S.indigo, 'tu-lieu': S.jade,
  'bo-the': S.goldDeep, hoi: '#8a3fb5', 'tin-nhan': S.blue, 'tro-giup': '#8a6a4a',
};
/** Tên ngắn trên thanh mục dưới đáy của điện thoại */
const SHORT: Record<string, string> = { 'cau-hoi': 'Ôn tập', hoi: 'Tiểu Tướng', 'tro-giup': 'Trợ giúp' };
const colorOf = (id: string): string => TAB_COLOR[id] ?? S.red;

export function StudentWorkspace<T extends string>({ session, nav, active, onSelect, extra, schoolName, children, home, avatar, roleLine, profileAvatar, profileExtra }: {
  session: Session; nav: ReadonlyArray<NavLeaf<T>>; active: T; onSelect: (tab: T) => void;
  extra?: ReactNode; schoolName?: string; children: ReactNode; home: SagaHome | null;
  avatar?: ReactNode; roleLine?: ReactNode; profileAvatar?: ReactNode; profileExtra?: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const wide = width >= 1080;
  const phone = width < 760;
  const brand = useSystemBrand(session.token);
  const [profile, setProfile] = useState(false);
  const [more, setMore] = useState(false);
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
  useEffect(() => { setMore(false); }, [active]);
  const pad = wide ? 24 : 12;
  // điện thoại: tối đa 5 ô dưới đáy – nhiều mục hơn thì 4 mục đầu + "Thêm"
  const bottom = nav.length <= 5 ? nav : nav.slice(0, 4);
  const rest = nav.length <= 5 ? [] : nav.slice(4);
  const restActive = rest.some((it) => it.id === active);
  const pickTab = (id: T): void => { setMore(false); onSelect(id); };

  const badge = (count: number | undefined, color: string): ReactNode => (count !== undefined && count > 0 ? (
    <View style={{ position: phone ? 'absolute' : 'relative', top: phone ? -4 : undefined, right: phone ? -10 : undefined, borderRadius: 11, minWidth: 22, minHeight: 22, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: color, borderWidth: 2, borderColor: S.white }}>
      <Txt f="heavy" size={11} color="#ffffff">{count > 99 ? '99+' : count}</Txt>
    </View>
  ) : null);

  return (
    <View testID="student-workspace" style={{ flex: 1, backgroundColor: S.canvas }}>
      <View testID="student-topbar" style={{ backgroundColor: S.white, borderBottomWidth: 2, borderBottomColor: S.line }}>
        {/* dải hoa văn: đỏ son, chấm vàng */}
        <View pointerEvents="none" style={{ height: 6, backgroundColor: S.red, flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center', overflow: 'hidden' }}>
          {Array.from({ length: 28 }, (_, i) => <View key={i} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: S.gold, opacity: 0.85 }} />)}
        </View>
        <View style={{ minHeight: wide ? 70 : 60, paddingHorizontal: pad, flexDirection: 'row', alignItems: 'center', gap: wide ? 14 : 6 }}>
          <View style={{ flexShrink: 1, minWidth: 0 }}><BrandLogo compact={width < 420} brand={brand} /></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            {width >= 900 ? <Txt f="semibold" size={12} color={S.muted} numberOfLines={1}>{schoolName ?? 'Không gian học sinh Đông A'}</Txt> : null}
          </View>
          {home && width >= 560 ? <LearnerStats home={home} bare /> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>{extra}</View>
          <Pressable testID="student-profile-open" accessibilityRole="button" accessibilityLabel="Hồ sơ cá nhân (đổi mật khẩu trong hồ sơ)" onPress={() => setProfile(true)} style={{ minHeight: 44, minWidth: 44, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {avatar ?? <Avatar name={session.user.full_name} uri={session.user.avatar_url} size={38} />}
            {width >= 1500 ? <View style={{ maxWidth: 160 }}><Txt f="bold" size={14} numberOfLines={1}>{session.user.full_name}</Txt>{roleLine ?? <Txt size={12} color={S.muted}>Nhà khám phá</Txt>}</View> : null}
          </Pressable>
          {phone ? null : <Pressable testID="student-logout" accessibilityRole="button" accessibilityLabel="Đăng xuất" onPress={() => session.logout()} style={({ pressed }) => ({ minWidth: 44, minHeight: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? S.line : S.canvas, borderWidth: 2, borderColor: S.line })}><LogOut size={19} color={S.muted} /></Pressable>}
        </View>
        {phone ? null : (
          <ScrollView ref={strip} horizontal showsHorizontalScrollIndicator={false} testID="student-tabs" accessibilityRole="tablist" accessibilityLabel="Các mục học tập"
            contentContainerStyle={{ paddingHorizontal: pad, paddingBottom: 10, gap: 6, flexGrow: 1, justifyContent: wide ? 'center' : 'flex-start' }}>
            {nav.map(({ id, label, icon: Icon, count }) => {
              const selected = id === active;
              const color = colorOf(id);
              return (
                <Pressable key={id} testID={`student-nav-${id}`} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected }}
                  onLayout={(e) => { spots.current[id] = e.nativeEvent.layout.x; }} onPress={() => onSelect(id)}
                  style={({ pressed }) => ({ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, paddingLeft: 6, paddingRight: 14, borderRadius: 18, borderWidth: 2, borderBottomWidth: selected ? 4 : 2,
                    borderColor: selected ? color : 'transparent', backgroundColor: selected ? `${color}17` : pressed ? S.paper2 : 'transparent' })}>
                  <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: color, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: 'rgba(0,0,0,0.2)' }}>
                    <Icon size={17} strokeWidth={2.6} color="#ffffff" />
                  </View>
                  <Txt f="heavy" size={14} color={selected ? S.ink : S.muted}>{label}</Txt>
                  {badge(count, color)}
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>
      <View style={{ flex: 1, minHeight: 0 }}>
        {children}
        {phone && more ? (
          <View testID="student-more" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: S.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 2, borderColor: S.line, padding: 16, gap: 12, boxShadow: '0 -6px 24px rgba(43,29,18,0.18)' } as object}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Txt f="heavy" size={16} color={S.ink}>Các mục khác</Txt>
              <Pressable accessibilityRole="button" accessibilityLabel="Đóng các mục khác" onPress={() => setMore(false)} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><X size={20} color={S.muted} /></Pressable>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {rest.map(({ id, label, icon: Icon, count }) => {
                const color = colorOf(id);
                const selected = id === active;
                return (
                  <Pressable key={id} testID={`student-nav-${id}`} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected }} onPress={() => pickTab(id)}
                    style={({ pressed }) => ({ flexBasis: '47%', flexGrow: 1, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, borderRadius: 16, borderWidth: 2, borderBottomWidth: 4,
                      borderColor: selected ? color : S.line, backgroundColor: selected ? `${color}17` : pressed ? S.paper2 : S.white })}>
                    <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}><Icon size={17} strokeWidth={2.6} color="#ffffff" /></View>
                    <Txt f="heavy" size={14} color={S.ink} style={{ flex: 1 }} numberOfLines={1}>{label}</Txt>
                    {badge(count, color)}
                  </Pressable>
                );
              })}
            </View>
            <Pressable testID="student-logout" accessibilityRole="button" accessibilityLabel="Đăng xuất" onPress={() => session.logout()}
              style={({ pressed }) => ({ minHeight: 48, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 2, borderBottomWidth: 4, borderColor: S.line, backgroundColor: pressed ? S.paper2 : S.white })}>
              <LogOut size={18} color={S.muted} /><Txt f="heavy" size={14} color={S.muted}>Đăng xuất</Txt>
            </Pressable>
          </View>
        ) : null}
      </View>
      {phone ? (
        <View testID="student-bottom-tabs" accessibilityLabel="Các mục học tập" style={{ flexDirection: 'row', backgroundColor: S.white, borderTopWidth: 2, borderTopColor: S.line, paddingHorizontal: 4, paddingTop: 6, paddingBottom: 8 }}>
          {bottom.map(({ id, label, icon: Icon, count }) => {
            const selected = id === active && !more;
            const color = colorOf(id);
            return (
              <Pressable key={id} testID={`student-nav-${id}`} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected }} onPress={() => pickTab(id)}
                style={{ flex: 1, minHeight: 54, alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                <View style={{ width: 40, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? `${color}22` : 'transparent', borderWidth: selected ? 2 : 0, borderColor: color }}>
                  <Icon size={20} strokeWidth={selected ? 2.7 : 2.2} color={selected ? color : S.muted} />
                  {badge(count, color)}
                </View>
                <Txt f={selected ? 'heavy' : 'semibold'} size={11} color={selected ? S.ink : S.muted} numberOfLines={1}>{SHORT[id] ?? label}</Txt>
              </Pressable>
            );
          })}
          {rest.length ? (
            <Pressable testID="student-nav-more" accessibilityRole="button" accessibilityLabel={more ? 'Đóng các mục khác' : 'Các mục khác'} accessibilityState={{ expanded: more }} onPress={() => setMore((m) => !m)}
              style={{ flex: 1, minHeight: 54, alignItems: 'center', justifyContent: 'center', gap: 3 }}>
              <View style={{ width: 40, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: more || restActive ? `${S.red}1f` : 'transparent', borderWidth: more || restActive ? 2 : 0, borderColor: S.red }}>
                <Grid2x2 size={20} strokeWidth={2.4} color={more || restActive ? S.red : S.muted} />
              </View>
              <Txt f={more || restActive ? 'heavy' : 'semibold'} size={11} color={more || restActive ? S.ink : S.muted}>Thêm</Txt>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {profile ? <ProfileSheet onClose={() => setProfile(false)} load={loadProfile} save={saveProfile} upload={uploadAvatar} onSaved={session.updateUser} avatar={profileAvatar} extra={profileExtra}>
        <Btn title="Đổi mật khẩu" icon={KeyRound} tone="giay" onPress={() => { setProfile(false); session.changePassword(); }} />
        {phone ? <Btn title="Đăng xuất" icon={LogOut} tone="giay" onPress={() => { setProfile(false); session.logout(); }} /> : null}
      </ProfileSheet> : null}
    </View>
  );
}
