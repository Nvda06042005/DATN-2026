/** /portal – đăng nhập chung cho giáo viên và học sinh: đăng nhập xong tự chuyển tới trang của vai trò (giữ phiên của trang đó) */
import { useRouter } from 'expo-router';
import { LoginScreen, PORTAL_PATH, PORTAL_TITLE, useDocumentTitle } from '@/components/auth';
import { saveToken } from '@/lib/storage';

export default function PortalRoute() {
  const router = useRouter();
  useDocumentTitle(`${PORTAL_TITLE.app} – Đông A`);
  return (
    <LoginScreen
      portal="app"
      onLogin={async (token, user) => {
        if (user.role !== 'teacher' && user.role !== 'student') return;
        await saveToken(user.role, token);
        router.replace(PORTAL_PATH[user.role]);
      }}
    />
  );
}
