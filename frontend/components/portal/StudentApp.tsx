/**
 * Trang học sinh (/hoc-sinh và đường dẫn riêng của trường với role=student).
 * Yêu cầu 15/11/2026: xóa toàn bộ giao diện cũ của trang học sinh để xây dựng lại từ đầu. Chỉ còn khung: thanh trên cùng (logo, tên học sinh, hồ sơ, đổi mật khẩu,
 * đăng xuất) và thông báo trang đang được xây dựng lại. API máy chủ và dữ liệu học tập của học sinh (tiến độ, điểm, bài làm, XP…) giữ nguyên để giao diện mới dùng lại;
 * các thành phần dùng chung với giáo viên / quản trị (Trợ lý AI, làm bài quiz, thi đấu trực tiếp, đọc bài học, thư viện, thông báo, trợ giúp, khảo sát) vẫn giữ.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, useColorScheme } from 'react-native';
import * as platform from '@/api/platformApi';
import { TopBar, type Session } from '@/components/auth';
import { EmptyState, PaperBg } from '@/components/ui';
import { PALETTES } from '@/constants/theme';
import { ThemeContext } from '@/hooks/use-theme';
import type { Prefs } from '@/types/platform';

/** Trang học sinh: giữ chế độ sáng / tối đã chọn của tài khoản; nội dung đang được xây dựng lại */
export const StudentApp: React.FC<{ session: Session }> = ({ session }) => {
  const system = useColorScheme();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  useEffect(() => { platform.prefs(session.token).then(setPrefs).catch(() => undefined); }, [session.token]);
  const dark = prefs?.theme === 'dark' || (prefs?.theme === 'system' && system === 'dark');
  const value = useMemo(() => ({ c: dark ? PALETTES.dark : PALETTES.light, dark: Boolean(dark) }), [dark]);
  return (
    <ThemeContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        <PaperBg />
        <TopBar session={session} subtitle="Học lịch sử cùng Hào Khí Đông A" />
        <ScrollView testID="student-rebuild" contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <View style={{ width: '100%', maxWidth: 560 }}>
            <EmptyState mood="thinking" title="Trang học sinh đang được xây dựng lại"
              text="Các chức năng học tập sẽ sớm trở lại với giao diện mới. Tiến độ, điểm và bài làm của em vẫn được lưu giữ đầy đủ." />
          </View>
        </ScrollView>
      </View>
    </ThemeContext.Provider>
  );
};
