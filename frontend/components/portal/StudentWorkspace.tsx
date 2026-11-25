/**
 * Khung trang học sinh, độc lập với khung quản trị; mọi thao tác tài khoản dùng lại API sẵn có.
 * 20/11/2026 (người dùng chọn "Bỏ menu trái, trang cuộn dọc"): không còn menu bên trái / ngăn kéo menu.
 * 25/11/2026 (người dùng: "để kiểu chữ lại không dùng icon nữa, học hỏi bên trang chủ chính", "thêm trang chủ và trang chủ sổ xuống"):
 * thanh đầu là **viên thuốc trắng như thanh điều hướng của trang chủ công khai** (`Header` trong `components/home.tsx`) – logo, các mục chỉ có chữ
 * (mục đang mở màu đỏ), cờ, chỉ số, cài đặt, thông báo, hồ sơ, đăng xuất. Mục đầu **Trang chủ** mở sảnh mở đầu; menu sổ xuống của nó liệt kê các phần
 * của sảnh (Giới thiệu, Nhân vật, Bảng vàng, Thư viện, Hướng dẫn) – rê chuột hoặc bấm mũi tên cạnh chữ để mở (không chỉ dựa vào rê chuột).
 * Màn hẹp (dưới 900) dùng nút mở menu như trang chủ công khai: bảng liên kết chữ ngay dưới thanh đầu; không còn thanh mục dưới đáy có biểu tượng.
 */
import { useCallback, useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { ChevronDown, KeyRound, LogOut, Menu, X } from 'lucide-react-native';
import * as authApi from '@/api/authApi';
import { BrandLogo, VietnamFlag } from '@/components/art';
import type { Session } from '@/components/auth';
import { ProfileSheet } from '@/components/profile';
import { Avatar, Btn, Txt } from '@/components/ui';
import { PALETTES } from '@/constants/theme';
import { useSystemBrand } from '@/hooks/use-system-brand';
import { LearnerStats } from '@/components/portal/StudentDesign';
import type { ProfilePatch } from '@/types/api';
import type { SagaHome } from '@/types/saga';

const WEB = Platform.OS === 'web';
/** Màu lấy thẳng từ bảng màu sáng của trang chủ công khai (không theo bảng màu riêng của học sinh) */
const L = PALETTES.light;
export const HOME_LOOK = {
  paper: L.logoPaper,
  ink: L.logoInk,
  red: L.logoRed,
  gold: L.logoGold,
  nav: L.xanhMuc,
  navOn: L.sonChu,
  line: 'rgba(35, 56, 47, 0.16)',
  soft: 'rgba(35, 56, 47, 0.78)',
  white: L.the,
};

/** Một mục trên thanh đầu: chỉ có chữ (và số đếm nếu có) */
export interface StudentLink<T extends string> { id: T; label: string; count?: number }
/** Một phần của sảnh mở đầu trong menu sổ xuống của Trang chủ */
export interface HomeMenuItem { id: string; label: string }

const shadow = (strong = false) => (WEB ? { boxShadow: strong ? '0 18px 40px rgba(35, 56, 47, 0.18)' : '0 10px 30px rgba(35, 56, 47, 0.10)' } : null) as object;

const Count: React.FC<{ n?: number }> = ({ n }) => (n !== undefined && n > 0 ? (
  <View style={{ borderRadius: 10, minWidth: 20, minHeight: 20, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: HOME_LOOK.navOn }}>
    <Txt f="heavy" size={11} color="#ffffff">{n > 99 ? '99+' : n}</Txt>
  </View>
) : null);

export function StudentWorkspace<T extends string>({
  session, nav, active, onSelect, onHome, homeActive = false, homeMenu = [], homeSection = null, onHomeSection, extra, schoolName, children, home, avatar, roleLine, profileAvatar, profileExtra,
}: {
  session: Session; nav: ReadonlyArray<StudentLink<T>>; active: T | null; onSelect: (tab: T) => void;
  /** Mục Trang chủ (sảnh mở đầu); bỏ trống thì không có mục này */
  onHome?: () => void; homeActive?: boolean;
  /** Các phần của sảnh trong menu sổ xuống của Trang chủ, phần đang xem (để tô đỏ) và hàm mở một phần */
  homeMenu?: ReadonlyArray<HomeMenuItem>; homeSection?: string | null; onHomeSection?: (id: string) => void;
  extra?: ReactNode; schoolName?: string; children: ReactNode; home: SagaHome | null;
  avatar?: ReactNode; roleLine?: ReactNode; profileAvatar?: ReactNode; profileExtra?: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const inline = width >= 900;
  const brand = useSystemBrand(session.token);
  const [profile, setProfile] = useState(false);
  const [panel, setPanel] = useState(false); // bảng liên kết của màn hẹp
  const [drop, setDrop] = useState(false); // menu sổ xuống của Trang chủ
  const loadProfile = useCallback(() => authApi.getProfile(session.token), [session.token]);
  const saveProfile = useCallback((patch: ProfilePatch) => authApi.updateProfile(session.token, patch), [session.token]);
  const uploadAvatar = useCallback((img: { data: string }) => authApi.uploadAvatar(session.token, img), [session.token]);
  const dropBox = useRef<ComponentRef<typeof View>>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverAt = useRef(0); // lúc menu vừa mở do rê chuột: bấm mũi tên ngay sau đó không đóng lại
  /** Chỉ chuột mới mở / đóng theo rê; chạm (cảm ứng) dùng nút mũi tên */
  const byMouse = (e: { nativeEvent: { pointerType?: string } }): boolean => e.nativeEvent.pointerType === 'mouse';
  const keepOpen = (): void => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    if (!drop) hoverAt.current = Date.now();
    setDrop(true);
  };
  const closeSoon = (): void => { if (closeTimer.current) clearTimeout(closeTimer.current); closeTimer.current = setTimeout(() => setDrop(false), 220); };
  const toggleDrop = (): void => {
    const justHovered = drop && Date.now() - hoverAt.current < 800;
    hoverAt.current = 0;
    setDrop(justHovered ? true : !drop);
  };
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);
  useEffect(() => { setPanel(false); setDrop(false); }, [active, homeActive]);
  useEffect(() => { if (inline) setPanel(false); else setDrop(false); }, [inline]);
  // web: Esc đóng menu; bấm ra ngoài menu sổ xuống thì đóng
  useEffect(() => {
    if (!WEB || (!drop && !panel)) return undefined;
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') { setDrop(false); setPanel(false); } };
    const onDown = (e: PointerEvent): void => {
      const box = dropBox.current as unknown as HTMLElement | null;
      if (drop && box && typeof box.contains === 'function' && !box.contains(e.target as Node)) setDrop(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown); };
  }, [drop, panel]);

  const goHome = (): void => { setPanel(false); setDrop(false); onHome?.(); };
  const goSection = (id: string): void => { setPanel(false); setDrop(false); onHomeSection?.(id); };
  const goTab = (id: T): void => { setPanel(false); setDrop(false); onSelect(id); };

  const link = (label: string, on: boolean, onPress: () => void, testID: string, count?: number) => (
    <Pressable key={testID} testID={testID} accessibilityRole="link" accessibilityLabel={label} accessibilityState={{ selected: on }} aria-current={on ? 'page' : undefined} onPress={onPress}
      style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: width < 1180 ? 9 : 12, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, backgroundColor: pressed ? HOME_LOOK.paper : 'transparent' })}>
      <Txt f="bold" size={width < 1180 ? 14 : 14.5} color={on ? HOME_LOOK.navOn : HOME_LOOK.nav} numberOfLines={1}>{label}</Txt>
      <Count n={count} />
    </Pressable>
  );

  // Trang chủ + menu sổ xuống (giống mẫu: các phần của sảnh nằm trong một thẻ trắng có mũi nhọn chỉ lên).
  // Rê chuột vào khung bọc (chữ + mũi tên + menu, menu nằm sát dưới không có khe hở) thì mở, rời khung thì đóng sau một nhịp ngắn.
  const homeItem = onHome ? (
    <View ref={dropBox} style={{ position: 'relative', zIndex: 5 }}
      onPointerEnter={homeMenu.length ? (e) => { if (byMouse(e)) keepOpen(); } : undefined}
      onPointerLeave={homeMenu.length ? (e) => { if (byMouse(e)) closeSoon(); } : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Pressable testID="student-nav-trang-chu" accessibilityRole="link" accessibilityLabel="Trang chủ" accessibilityState={{ selected: homeActive }} aria-current={homeActive ? 'page' : undefined}
          onPress={goHome}
          style={({ pressed }) => ({ minHeight: 44, paddingLeft: width < 1180 ? 9 : 12, paddingRight: homeMenu.length ? 2 : 12, justifyContent: 'center', borderRadius: 999, backgroundColor: pressed ? HOME_LOOK.paper : 'transparent' })}>
          <Txt f="bold" size={width < 1180 ? 14 : 14.5} color={homeActive ? HOME_LOOK.navOn : HOME_LOOK.nav}>Trang chủ</Txt>
        </Pressable>
        {homeMenu.length ? (
          <Pressable testID="student-home-caret" accessibilityRole="button" accessibilityLabel={drop ? 'Đóng các phần của Trang chủ' : 'Mở các phần của Trang chủ'} accessibilityState={{ expanded: drop }} aria-expanded={drop} aria-haspopup="menu"
            onPress={toggleDrop}
            style={({ pressed }) => ({ minHeight: 44, minWidth: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: pressed ? HOME_LOOK.paper : 'transparent' })}>
            <ChevronDown size={16} color={homeActive ? HOME_LOOK.navOn : HOME_LOOK.nav} strokeWidth={2.4} style={{ transform: [{ rotate: drop ? '180deg' : '0deg' }] }} />
          </Pressable>
        ) : null}
      </View>
      {drop && homeMenu.length ? (
        <View testID="student-home-menu" style={{ position: 'absolute', top: 44, left: -8, minWidth: 230, paddingTop: 14 }}>
          {/* mũi nhọn chỉ lên mục Trang chủ */}
          <View style={{ position: 'absolute', top: 8, left: 34, width: 14, height: 14, backgroundColor: HOME_LOOK.white, borderLeftWidth: 1, borderTopWidth: 1, borderColor: HOME_LOOK.line, transform: [{ rotate: '45deg' }], zIndex: 2 }} />
          <View role="menu" accessibilityLabel="Các phần của Trang chủ" style={[{ backgroundColor: HOME_LOOK.white, borderRadius: 16, borderWidth: 1, borderColor: HOME_LOOK.line, paddingVertical: 8, paddingHorizontal: 6 }, shadow(true)]}>
            {homeMenu.map((it) => {
              const on = homeActive && homeSection === it.id;
              return (
                <Pressable key={it.id} testID={`student-home-${it.id}`} role="menuitem" accessibilityLabel={it.label} accessibilityState={{ selected: on }} onPress={() => goSection(it.id)}
                  style={(st) => {
                    const { pressed, hovered } = st as typeof st & { hovered?: boolean };
                    return { minHeight: 44, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 10, backgroundColor: pressed || hovered ? HOME_LOOK.paper : 'transparent' };
                  }}>
                  <Txt f="bold" size={15} color={on ? HOME_LOOK.navOn : HOME_LOOK.ink}>{it.label}</Txt>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  ) : null;

  const logo = (
    <Pressable accessibilityRole="link" accessibilityLabel={onHome ? 'Về Trang chủ' : 'Đông A'} onPress={onHome ? goHome : undefined} disabled={!onHome} testID="student-go-landing" hitSlop={4}
      style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 }}>
      <BrandLogo compact={width < 1240} brand={brand} />
      {width >= 1560 && schoolName ? <Txt f="semibold" size={12} color={HOME_LOOK.soft} numberOfLines={1} style={{ maxWidth: 170 }}>{schoolName}</Txt> : null}
    </Pressable>
  );

  return (
    <View testID="student-workspace" style={{ flex: 1, backgroundColor: HOME_LOOK.paper }}>
      <View testID="student-topbar" accessibilityLabel={schoolName ?? 'Không gian học sinh Đông A'} style={{ position: 'relative', zIndex: 30, backgroundColor: HOME_LOOK.paper, paddingHorizontal: inline ? 14 : 8, paddingTop: 10, paddingBottom: 8 }}>
        <View style={[{ width: '100%', maxWidth: 1400, alignSelf: 'center', minHeight: inline ? 64 : 58, borderRadius: 999, borderWidth: 1, borderColor: HOME_LOOK.line, backgroundColor: HOME_LOOK.white, paddingLeft: 10, paddingRight: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }, shadow()]}>
          {logo}
          {inline ? (
            <View testID="student-tabs" role="navigation" accessibilityLabel="Các mục học tập" style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              {homeItem}
              {nav.map((it) => link(it.label, it.id === active && !homeActive, () => goTab(it.id), `student-nav-${it.id}`, it.count))}
            </View>
          ) : <View style={{ flex: 1, minWidth: 0 }} />}
          <View style={{ flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {width >= 1320 ? <View style={{ borderRadius: 6, borderWidth: 1, borderColor: HOME_LOOK.line, padding: 1 }}><VietnamFlag width={30} /></View> : null}
            {home && width >= 1100 ? <LearnerStats home={home} bare compact /> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>{extra}</View>
            <Pressable testID="student-profile-open" accessibilityRole="button" accessibilityLabel="Hồ sơ cá nhân (đổi mật khẩu trong hồ sơ)" onPress={() => setProfile(true)} style={{ minHeight: 44, minWidth: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {avatar ?? <Avatar name={session.user.full_name} uri={session.user.avatar_url} size={34} />}
              {width >= 1700 ? <View style={{ maxWidth: 150 }}><Txt f="bold" size={13} numberOfLines={1}>{session.user.full_name}</Txt>{roleLine ?? <Txt size={11} color={HOME_LOOK.soft}>Nhà khám phá</Txt>}</View> : null}
            </Pressable>
            {inline ? (
              <Pressable testID="student-logout" accessibilityRole="button" accessibilityLabel="Đăng xuất" onPress={() => session.logout()}
                style={({ pressed }) => ({ minWidth: 44, minHeight: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? HOME_LOOK.paper : 'transparent' })}>
                <LogOut size={18} color={HOME_LOOK.soft} />
              </Pressable>
            ) : (
              <Pressable testID="student-nav-toggle" accessibilityRole="button" accessibilityLabel={panel ? 'Đóng menu điều hướng' : 'Mở menu điều hướng'} accessibilityState={{ expanded: panel }} aria-expanded={panel} aria-controls="student-nav-panel"
                onPress={() => setPanel((m) => !m)} style={{ width: 44, height: 44, borderRadius: 999, backgroundColor: HOME_LOOK.paper, alignItems: 'center', justifyContent: 'center' }}>
                {panel ? <X size={22} color={HOME_LOOK.ink} /> : <Menu size={22} color={HOME_LOOK.ink} />}
              </Pressable>
            )}
          </View>
        </View>
        {!inline && panel ? (
          <View nativeID="student-nav-panel" testID="student-nav-panel" role="navigation" accessibilityLabel="Các mục học tập"
            style={[{ position: 'absolute', top: 72, right: 8, left: width >= 560 ? undefined : 8, width: width >= 560 ? 360 : undefined, padding: 8, borderRadius: 20, borderWidth: 1, borderColor: HOME_LOOK.line, backgroundColor: HOME_LOOK.white }, shadow(true)]}>
            <ScrollView style={{ maxHeight: 560 }}>
              {home ? <View style={{ paddingHorizontal: 12, paddingVertical: 8 }}><LearnerStats home={home} bare compact /></View> : null}
              {onHome ? (
                <>
                  <Pressable testID="student-nav-trang-chu" accessibilityRole="link" accessibilityLabel="Trang chủ" accessibilityState={{ selected: homeActive }} onPress={goHome}
                    style={{ minHeight: 44, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 12, backgroundColor: homeActive ? HOME_LOOK.paper : 'transparent' }}>
                    <Txt f="bold" size={15} color={homeActive ? HOME_LOOK.navOn : HOME_LOOK.nav}>Trang chủ</Txt>
                  </Pressable>
                  {homeMenu.map((it) => (
                    <Pressable key={it.id} testID={`student-home-${it.id}`} accessibilityRole="link" accessibilityLabel={`Trang chủ – ${it.label}`} onPress={() => goSection(it.id)}
                      style={{ minHeight: 44, paddingLeft: 32, paddingRight: 16, justifyContent: 'center', borderRadius: 12 }}>
                      <Txt f="semibold" size={14} color={homeActive && homeSection === it.id ? HOME_LOOK.navOn : HOME_LOOK.soft}>{it.label}</Txt>
                    </Pressable>
                  ))}
                </>
              ) : null}
              {nav.map((it) => {
                const on = it.id === active && !homeActive;
                return (
                  <Pressable key={it.id} testID={`student-nav-${it.id}`} accessibilityRole="link" accessibilityLabel={it.label} accessibilityState={{ selected: on }} onPress={() => goTab(it.id)}
                    style={{ minHeight: 44, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, backgroundColor: on ? HOME_LOOK.paper : 'transparent' }}>
                    <Txt f="bold" size={15} color={on ? HOME_LOOK.navOn : HOME_LOOK.nav}>{it.label}</Txt>
                    <Count n={it.count} />
                  </Pressable>
                );
              })}
              <View style={{ height: 1, backgroundColor: HOME_LOOK.line, marginVertical: 6, marginHorizontal: 12 }} />
              <Pressable testID="student-logout" accessibilityRole="button" accessibilityLabel="Đăng xuất" onPress={() => session.logout()}
                style={{ minHeight: 44, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 12 }}>
                <Txt f="bold" size={15} color={HOME_LOOK.soft}>Đăng xuất</Txt>
              </Pressable>
            </ScrollView>
          </View>
        ) : null}
      </View>
      <View style={{ flex: 1, minHeight: 0 }}>
        {children}
      </View>
      {profile ? <ProfileSheet onClose={() => setProfile(false)} load={loadProfile} save={saveProfile} upload={uploadAvatar} onSaved={session.updateUser} avatar={profileAvatar} extra={profileExtra}>
        <Btn title="Đổi mật khẩu" icon={KeyRound} tone="giay" onPress={() => { setProfile(false); session.changePassword(); }} />
        {inline ? null : <Btn title="Đăng xuất" icon={LogOut} tone="giay" onPress={() => { setProfile(false); session.logout(); }} />}
      </ProfileSheet> : null}
    </View>
  );
}
