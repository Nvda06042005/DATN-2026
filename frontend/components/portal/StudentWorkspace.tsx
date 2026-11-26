/**
 * Khung trang học sinh "Binh thư Sát Thát" (25/11/2026, theo bản vẽ người dùng gửi; người dùng chọn "Thanh đầu chữ + bố cục rộng"):
 *  - Điện thoại (< 900 px): không có thanh đầu – mỗi màn tự có đầu màn như bản vẽ; **thanh điều hướng 5 mục dưới đáy** (Doanh trại, Chiến dịch, Binh thư,
 *    Tiểu Tướng, Bảng vàng: biểu tượng + chữ, mục đang mở màu đỏ son). Các bước trong một chặng, Hồ sơ, Giao diện, Luyện binh riêng ẩn thanh dưới (có nút quay lại).
 *  - Máy tính: thanh đầu dạng viên thuốc như trước (logo, năm mục chỉ có chữ, chuỗi ngày, vàng, cài đặt, thông báo, ảnh đại diện → Hồ sơ, đăng xuất).
 * Màu lấy từ giao diện đang dùng (`useBT`). Không có menu trái.
 */
import { type ReactNode } from 'react';
import { Platform, Pressable, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Coins, Flag, Flame, House, Layers, LogOut, MessageSquareText, Trophy } from 'lucide-react-native';
import { BrandLogo } from '@/components/art';
import type { Session } from '@/components/auth';
import { Txt } from '@/components/ui';
import { useSystemBrand } from '@/hooks/use-system-brand';
import { useBT } from '@/components/portal/StudentDesign';
import type { IconType } from '@/types/game';
import type { SagaHome } from '@/types/saga';

const WEB = Platform.OS === 'web';
/** Một mục điều hướng của học sinh (tên kiểu giữ như trước) */
export interface StudentLink<T extends string> { id: T; label: string; count?: number }
const ICONS: Record<string, IconType> = { 'doanh-trai': House, 'chien-dich': Flag, 'binh-thu': Layers, 'tieu-tuong': MessageSquareText, 'bang-vang': Trophy };

export function StudentWorkspace<T extends string>({ session, nav, active, onSelect, home, extra, avatar, onProfile, tabBar = true, schoolName, children }: {
  session: Session; nav: ReadonlyArray<StudentLink<T>>; active: T | null; onSelect: (tab: T) => void; home: SagaHome | null;
  extra?: ReactNode; avatar: ReactNode; onProfile: () => void; tabBar?: boolean; schoolName?: string; children: ReactNode;
}) {
  const t = useBT();
  const { width } = useWindowDimensions();
  const inline = width >= 900;
  const insets = useSafeAreaInsets();
  const brand = useSystemBrand(session.token);
  const shadow = (WEB ? { boxShadow: t.dark ? '0 8px 26px rgba(0,0,0,0.45)' : '0 10px 30px rgba(42,29,20,0.10)' } : null) as object;

  const link = (it: StudentLink<T>) => {
    const on = it.id === active;
    return (
      <Pressable key={it.id} testID={`student-nav-${it.id}`} accessibilityRole="link" accessibilityLabel={it.label} accessibilityState={{ selected: on }} aria-current={on ? 'page' : undefined} onPress={() => onSelect(it.id)}
        style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: width < 1180 ? 10 : 14, justifyContent: 'center', borderRadius: 999, backgroundColor: on ? t.goldSoft : pressed ? t.card2 : 'transparent' })}>
        <Txt f="heavy" size={14.5} color={on ? t.accent : t.soft} numberOfLines={1}>{it.label}</Txt>
      </Pressable>
    );
  };

  return (
    <View testID="student-workspace" style={{ flex: 1, backgroundColor: t.bg }}>
      {inline ? (
        <View testID="student-topbar" accessibilityLabel={schoolName ?? 'Không gian học sinh Đông A'} style={{ zIndex: 30, backgroundColor: t.bg, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6 }}>
          <View style={[{ width: '100%', maxWidth: 1320, alignSelf: 'center', minHeight: 62, borderRadius: 999, borderWidth: 1, borderColor: t.line, backgroundColor: t.card, paddingLeft: 12, paddingRight: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }, shadow]}>
            <Pressable accessibilityRole="link" accessibilityLabel="Về Doanh trại" onPress={() => onSelect(nav[0].id)} testID="student-go-home" style={{ minHeight: 44, justifyContent: 'center', flexShrink: 0 }}>
              <BrandLogo compact={width < 1240} brand={brand} />
            </Pressable>
            <View testID="student-tabs" role="navigation" accessibilityLabel="Các mục học tập" style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              {nav.map(link)}
            </View>
            <View style={{ flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {home && width >= 1100 ? (
                <View testID="student-live-stats" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 6 }}>
                  <View accessible accessibilityLabel={`${home.hud.streak.current} ngày học liên tiếp`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Flame size={18} color={t.accent} fill={t.accent} /><Txt f="heavy" size={14} color={t.accent}>{home.hud.streak.current}</Txt></View>
                  <View accessible accessibilityLabel={`${home.hud.gold.toLocaleString('vi-VN')} vàng`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Coins size={18} color={t.bronze} /><Txt f="heavy" size={14} color={t.goldInk}>{home.hud.gold.toLocaleString('vi-VN')}</Txt></View>
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>{extra}</View>
              <Pressable testID="student-profile-open" accessibilityRole="button" accessibilityLabel="Mở Hồ sơ của em" onPress={onProfile} style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}>
                {avatar}
              </Pressable>
              <Pressable testID="student-logout" accessibilityRole="button" accessibilityLabel="Đăng xuất" onPress={() => session.logout()}
                style={({ pressed }) => ({ minWidth: 44, minHeight: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? t.card2 : 'transparent' })}>
                <LogOut size={18} color={t.muted} />
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
      <View style={{ flex: 1, minHeight: 0 }}>{children}</View>
      {!inline && tabBar ? (
        <View testID="student-tabbar" role="navigation" accessibilityLabel="Điều hướng chính"
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: t.card, borderTopWidth: 1, borderTopColor: t.line, paddingTop: 8, paddingBottom: Math.max(10, insets.bottom), paddingHorizontal: 6, flexDirection: 'row', justifyContent: 'space-around' }}>
          {nav.map((it) => {
            const on = it.id === active;
            const Icon = ICONS[it.id] ?? House;
            return (
              <Pressable key={it.id} testID={`student-tab-${it.id}`} accessibilityRole="link" accessibilityLabel={it.label} accessibilityState={{ selected: on }} aria-current={on ? 'page' : undefined} onPress={() => onSelect(it.id)}
                style={({ pressed }) => ({ flex: 1, maxWidth: 88, minHeight: 50, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 12, backgroundColor: pressed ? t.card2 : 'transparent' })}>
                <Icon size={23} color={on ? t.accent : t.muted} strokeWidth={on ? 2.3 : 1.8} />
                <Txt f={on ? 'heavy' : 'semibold'} size={11} color={on ? t.accent : t.muted} numberOfLines={1}>{it.label}</Txt>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
