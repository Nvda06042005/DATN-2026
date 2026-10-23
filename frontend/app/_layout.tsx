import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import * as authApi from '@/api/authApi';
import { ChangePasswordScreen } from '@/app/(auth)/change-password/index';
import { LoginScreen } from '@/app/(auth)/login/index';
import { AdminView } from '@/app/admin/index';
import { HomeChooser } from '@/app/index';
import { StudentView } from '@/app/student/_layout';
import { TeacherView } from '@/app/teacher/_layout';
import { Mascot } from '@/components/customs/Mascot';
import { TopBar } from '@/components/customs/TopBar';
import { PORTAL_TITLE } from '@/constants/routes';
import { currentRoute } from '@/lib/router';
import { readToken, saveToken } from '@/store/auth.store';
import type { AuthUser, Portal, Route } from '@/types/authType';
import { ApiError } from '@/utils/http';

/** Một phiên đăng nhập cho từng cổng: trang học tập (giáo viên, học sinh) hoặc trang quản trị */
const SessionApp: React.FC<{ portal: Portal }> = ({ portal }) => {
  const tokenKey = `donga_token_${portal}`;
  const [token, setToken] = useState<string | null>(() => readToken(tokenKey));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(() => readToken(tokenKey) !== null);
  const [changingPassword, setChangingPassword] = useState(false);
  const [loginNotice, setLoginNotice] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastKey, setToastKey] = useState(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setToastKey((k) => k + 1);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(null), 3500);
  }, []);

  const startSession = useCallback(
    (newToken: string, newUser: AuthUser) => {
      saveToken(tokenKey, newToken);
      setToken(newToken);
      setUser(newUser);
      setLoginNotice(null);
    },
    [tokenKey]
  );

  const endSession = useCallback(
    (notice: string | null = null) => {
      saveToken(tokenKey, null);
      setToken(null);
      setUser(null);
      setChangingPassword(false);
      setLoginNotice(notice);
    },
    [tokenKey]
  );

  const onSessionExpired = useCallback(() => endSession('Phiên đăng nhập đã hết hạn, hãy đăng nhập lại.'), [endSession]);

  // Khôi phục phiên đã lưu
  useEffect(() => {
    const saved = readToken(tokenKey);
    if (!saved) return;
    authApi.getMe(saved)
      .then((u) => {
        if (u.role === portal) setUser(u);
        else {
          saveToken(tokenKey, null);
          setToken(null);
        }
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 0) {
          setLoginNotice(err.message);
        } else {
          saveToken(tokenKey, null);
          setToken(null);
        }
      })
      .finally(() => setChecking(false));
  }, [tokenKey, portal]);

  const toast = toastMessage && (
    <div
      key={toastKey}
      role="status"
      className="fixed top-16 left-1/2 -translate-x-1/2 z-[80] bg-white border-2 border-duo-swan text-duo-ink pl-2 pr-4 py-2 rounded-2xl shadow-[0_4px_0_#e7d9bc] flex items-center gap-2.5 text-sm font-extrabold max-w-[92vw] sm:max-w-md animate-pop-in"
    >
      <Mascot size={38} mood="excited" />
      <span>{toastMessage}</span>
    </div>
  );

  if (checking) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-white">
        <Mascot size={120} mood="happy" bob />
        <p className="font-black text-duo-wolf mt-3 flex items-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Đang kiểm tra phiên đăng nhập…
        </p>
      </div>
    );
  }

  if (!user || !token) {
    return <LoginScreen portal={portal} onLogin={startSession} notice={loginNotice} />;
  }

  if (user.must_change_password || changingPassword) {
    return (
      <>
        <ChangePasswordScreen
          user={user}
          token={token}
          forced={user.must_change_password}
          onDone={(t, u) => {
            startSession(t, u);
            setChangingPassword(false);
            showToast('🔐 Đã lưu mật khẩu mới');
          }}
          onCancel={() => (user.must_change_password ? endSession() : setChangingPassword(false))}
        />
        {toast}
      </>
    );
  }

  if (user.role === 'student') {
    // Cổng học sinh là game "Hào Khí Đông A" với thanh HUD riêng (hồ sơ, đổi mật khẩu, đăng xuất)
    return (
      <>
        <StudentView
          token={token}
          user={user}
          onShowToast={showToast}
          onSessionExpired={onSessionExpired}
          onLogout={() => endSession('Đã đăng xuất. Hẹn gặp lại!')}
          onChangePassword={() => setChangingPassword(true)}
        />
        {toast}
      </>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden font-sans bg-giay">
      <TopBar user={user} onChangePassword={() => setChangingPassword(true)} onLogout={() => endSession('Đã đăng xuất. Hẹn gặp lại!')} />
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {user.role === 'admin' ? (
          <AdminView token={token} me={user} onShowToast={showToast} onSessionExpired={onSessionExpired} />
        ) : (
          <TeacherView token={token} user={user} onShowToast={showToast} onSessionExpired={onSessionExpired} />
        )}
      </div>
      {toast}
    </div>
  );
};

export function App() {
  const [route, setRoute] = useState<Route>(currentRoute);

  useEffect(() => {
    const sync = () => setRoute(currentRoute());
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);

  useEffect(() => {
    document.title = route === 'home' ? 'Đông A – Học Sử vui như chơi' : `${PORTAL_TITLE[route]} – Đông A`;
  }, [route]);

  if (route === 'home') return <HomeChooser />;
  return <SessionApp key={route} portal={route} />;
}

export default App;
