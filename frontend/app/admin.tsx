/** Trang đăng nhập quản trị tổng độc lập; các màn quản lý thuộc bản Sprint 1–2. */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import * as authApi from '@/api/authApi';
import { ApiError } from '@/api/client';
import { AdminLogin, AdminSignedIn } from '@/components/admin/AdminLogin';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { useTheme } from '@/hooks/use-theme';
import type { AuthUser } from '@/types/auth';

const TOKEN_KEY = 'donga_token_root_admin';

function readToken() {
  try {
    return Platform.OS === 'web' && typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_KEY) : null;
  } catch {
    return null;
  }
}

function saveToken(token: string | null) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Trình duyệt chặn lưu trữ: phiên vẫn hoạt động đến khi tải lại trang.
  }
}

export default function AdminRoute() {
  const { c } = useTheme();
  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState<{ token: string; user: AuthUser } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useDocumentTitle('Quản lý tổng – Đông A');

  useEffect(() => {
    let alive = true;
    const saved = readToken();
    if (!saved) {
      setChecking(false);
      return;
    }
    void authApi.getMe(saved).then((user) => {
      if (alive) setSession({ token: saved, user });
    }).catch((error: unknown) => {
      if (!alive) return;
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) saveToken(null);
      setNotice(error instanceof Error ? error.message : 'Hãy đăng nhập lại để tiếp tục.');
    }).finally(() => {
      if (alive) setChecking(false);
    });
    return () => { alive = false; };
  }, []);

  const start = (token: string, user: AuthUser) => {
    saveToken(token);
    setSession({ token, user });
    setNotice(null);
  };

  const logout = async () => {
    if (!session) return;
    try {
      await authApi.logout(session.token);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
    }
    saveToken(null);
    setSession(null);
    setNotice('Bạn đã đăng xuất khỏi hệ thống.');
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!session) return;
    const updated = await authApi.changePassword(session.token, currentPassword, newPassword);
    start(updated.token, updated.user);
  };

  if (checking) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.logoPaper }}><ActivityIndicator accessibilityLabel="Đang kiểm tra phiên đăng nhập" color={c.logoRed} /></View>;
  if (session) return <AdminSignedIn user={session.user} onLogout={logout} onPasswordChange={changePassword} />;
  return <AdminLogin portal="root_admin" onLogin={start} notice={notice} />;
}
