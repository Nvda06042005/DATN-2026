/** /portal – đăng nhập chung cho học sinh, giáo viên và quản trị trường. */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LoginScreen, PORTAL_PATH, PORTAL_TITLE, useDocumentTitle } from '@/components/auth';
import { isSchoolRole, schoolRoleFromParam } from '@/lib/school-portal';
import { saveToken } from '@/lib/storage';

export default function PortalRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: string | string[]; notice?: string }>();
  useDocumentTitle(`${PORTAL_TITLE.app} – Đông A`);
  return (
    <LoginScreen
      portal={schoolRoleFromParam(params.role)}
      notice={typeof params.notice === 'string' ? params.notice : undefined}
      onLogin={async (token, user) => {
        if (!isSchoolRole(user.role)) return;
        await saveToken(user.role, token);
        router.replace(PORTAL_PATH[user.role]);
      }}
    />
  );
}
