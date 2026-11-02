/** /portal – đăng nhập chung cho giáo viên, học sinh và quản lý trường */
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
        if (user.role === 'teacher' || user.role === 'student') {
          await saveToken(user.role, token);
          router.replace(PORTAL_PATH[user.role]);
        } else if (user.role === 'school_admin') {
          await saveToken(user.role, token);
          router.replace('/school-manager-admin');
        } else if (user.role === 'root_admin') {
          await saveToken(user.role, token);
          router.replace('/admin');
        }
      }}
    />
  );
}
