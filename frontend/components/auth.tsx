/**
 * Học sinh, giáo viên và quản trị trường đăng nhập chung tại /portal, rồi mở khu vực theo vai trò máy chủ trả về.
 * /admin vẫn là cổng riêng của quản trị tổng. Mỗi vai trò giữ phiên riêng và kiểm tra lại bằng /api/auth/me.
 * Đổi mật khẩu mặc định và xác nhận hồ sơ lần đầu vẫn là bước bắt buộc trước khi truy cập nội dung.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Animated, Platform, Pressable, View, useWindowDimensions } from 'react-native';
import { Redirect } from 'expo-router';
import { AlertTriangle, Eye, EyeOff, KeyRound, LogOut, User } from 'lucide-react-native';
import * as authApi from '@/api/authApi';
import { ApiError, errorMessage } from '@/api/client';
import { AdminLogin } from '@/components/admin/AdminLogin';
import { SchoolLogin } from '@/components/school-login';
import type { SchoolBrandInfo } from '@/components/school-brand';
import type { SchoolRole } from '@/lib/school-portal';
import { BrandLogo, Mascot } from '@/components/art';
import { ProfileSheet } from '@/components/profile';
import { Avatar, Btn, Card, Field, Inset, PaperBg, Sheet, Spinner, Txt, useToast } from '@/components/ui';
import { useSystemBrand } from '@/hooks/use-system-brand';
import { useTheme } from '@/hooks/use-theme';
import { readToken, saveToken } from '@/lib/storage';
import type { AuthRole, AuthUser, Portal, ProfileData, ProfilePatch } from '@/types/api';

export { PORTAL_PATH } from '@/lib/school-portal';
export const PORTAL_TITLE: Record<Portal | 'app', string> = {
  student: 'Trang học sinh',
  teacher: 'Trang giáo viên',
  root_admin: 'Quản trị tổng',
  school_admin: 'Quản trị trường',
  app: 'Đăng nhập học tập',
};
export const ROLE_LABEL: Record<AuthRole, string> = { root_admin: 'Quản trị tổng', school_admin: 'Quản trị trường', teacher: 'Giáo viên', student: 'Học sinh' };

/** Cổng quản trị: không hiện nút, liên kết về trang chủ hay trang khác */
export const isAdminPortal = (p: Portal | 'app'): p is 'root_admin' | 'school_admin' => p === 'root_admin' || p === 'school_admin';

/** Tiêu đề tab trình duyệt (web) */
export const useDocumentTitle = (title: string) => {
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.title = title;
  }, [title]);
};

export interface Session {
  token: string;
  user: AuthUser;
  /** Đăng xuất (kèm lời nhắn trên màn đăng nhập) */
  logout: (notice?: string) => void;
  /** Phiên hết hạn (server trả 401) */
  expired: () => void;
  changePassword: () => void;
  /** Cập nhật hồ sơ sau khi đổi thông tin (vd: giáo viên chọn lớp đang dạy) */
  updateUser: (user: AuthUser) => void;
}

/** Bọc một trang: khôi phục phiên đã lưu, đăng nhập, đổi mật khẩu bắt buộc, rồi mới vẽ nội dung */
export const PortalApp: React.FC<{ portal: Portal; children: (session: Session) => React.ReactNode }> = ({ portal, children }) => {
  const toast = useToast();
  const { c } = useTheme();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [changing, setChanging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  useDocumentTitle(`${PORTAL_TITLE[portal]} – Đông A`);

  useEffect(() => {
    let alive = true;
    (async () => {
      const saved = await readToken(portal);
      if (!saved) return;
      try {
        const u = await authApi.getMe(saved);
        if (!alive) return;
        if (u.role === portal) {
          setToken(saved);
          setUser(u);
        } else await saveToken(portal, null);
      } catch (err) {
        if (!alive) return;
        if (err instanceof ApiError && err.status === 0) setNotice(err.message);
        else await saveToken(portal, null);
      }
    })().finally(() => alive && setChecking(false));
    return () => {
      alive = false;
    };
  }, [portal]);

  const start = useCallback(
    (t: string, u: AuthUser) => {
      saveToken(portal, t);
      setToken(t);
      setUser(u);
      setNotice(null);
    },
    [portal],
  );

  const end = useCallback(
    (msg: string | null = null) => {
      saveToken(portal, null);
      setToken(null);
      setUser(null);
      setChanging(false);
      setNotice(msg);
    },
    [portal],
  );

  const logout = useCallback(async (message?: string) => {
    try {
      if (token) await authApi.logout(token);
      end(message ?? (isAdminPortal(portal) ? 'Bạn đã đăng xuất khỏi hệ thống.' : 'Đã đăng xuất. Hẹn gặp lại!'));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) end('Phiên đăng nhập đã kết thúc.');
      else toast('Chưa thu hồi được phiên trên máy chủ. Kiểm tra kết nối và thử đăng xuất lại.');
    }
  }, [token, end, portal, toast]);

  if (checking) {
    // Cổng quản trị: chỉ một vòng chờ trên nền trắng, cùng nền với trang đăng nhập sắp hiện
    if (isAdminPortal(portal)) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.the }}>
          <Spinner label="Đang kiểm tra phiên đăng nhập…" />
        </View>
      );
    }
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <PaperBg />
        <Mascot size={120} mood="happy" bob />
        <Spinner label="Đang kiểm tra phiên đăng nhập…" />
      </View>
    );
  }
  if (!user || !token) {
    if (portal === 'root_admin') return <LoginScreen portal={portal} onLogin={start} notice={notice} />;
    return <Redirect href={{ pathname: '/portal', params: { role: portal, ...(notice ? { notice } : {}) } }} />;
  }
  const saved = (t: string, u: AuthUser) => {
    start(t, u);
    setChanging(false);
    toast('Đã lưu mật khẩu mới');
  };
  if (user.must_change_password) {
    // Màn hình chính bị khóa: chỉ có cửa sổ đặt mật khẩu mới (không đóng được), đổi xong mới vào trang
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 }}>
        <PaperBg />
        <Mascot size={110} mood="sleepy" accessory={isAdminPortal(portal) ? 'crown' : 'scholar'} />
        <Txt f="display" size={18} color={c.muc2} center>
          Trang đang khóa – hãy đặt mật khẩu mới để tiếp tục
        </Txt>
        <Sheet open persistent onClose={() => undefined} title="Đặt mật khẩu mới" subtitle="Bắt buộc ở lần đăng nhập đầu tiên">
          <ChangePasswordForm user={user} token={token} forced onDone={saved} onCancel={() => { void logout(); }} />
        </Sheet>
      </View>
    );
  }
  if (user.role === 'student' && !user.profile_confirmed_at) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <PaperBg />
        <ConfirmProfileSheet session={{ token, updateUser: setUser }} onLogout={() => { void logout(); }} />
      </View>
    );
  }
  if (changing) return <ChangePasswordScreen user={user} token={token} forced={false} onDone={saved} onCancel={() => setChanging(false)} />;
  return (
    <>
      {children({
        token,
        user,
        logout: message => { void logout(message); },
        expired: () => end('Phiên đăng nhập đã hết hạn, hãy đăng nhập lại.'),
        changePassword: () => setChanging(true),
        updateUser: setUser,
      })}
    </>
  );
};

// ---------------------------------------------------------------------- đăng nhập chung
type LoginProps = { portal: Portal | 'app'; onLogin: (token: string, user: AuthUser) => void | Promise<void>; notice?: string | null; school?: SchoolBrandInfo };

/** Quản trị tổng vẫn dùng cổng riêng; ba vai trò của nhà trường dùng cùng một biểu mẫu. */
export const LoginScreen: React.FC<LoginProps> = ({ portal, ...rest }) =>
  portal === 'root_admin' ? <AdminLogin portal={portal} {...rest} /> : <SchoolLoginWithRecovery initialRole={portal === 'app' ? 'student' : portal} {...rest} />;

const SchoolLoginWithRecovery: React.FC<Omit<LoginProps, 'portal'> & { initialRole: SchoolRole }> = ({ initialRole, onLogin, notice, school }) => {
  const [forgot, setForgot] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  return <>
    <SchoolLogin initialRole={initialRole} onLogin={onLogin} notice={flash ?? notice} onForgotPassword={() => setForgot(true)} school={school} />
    {forgot && <ForgotPasswordSheet onClose={() => setForgot(false)} onDone={() => { setForgot(false); setFlash('Đã đặt lại mật khẩu. Hãy đăng nhập bằng mật khẩu mới.'); }} />}
  </>;
};

// ---------------------------------------------------------------------- quên mật khẩu bằng OTP (giáo viên, học sinh; HK.HS.005, HK.GV.002)
/** Hai bước trong một cửa sổ: nhập tên/email để nhận mã 6 chữ số (5 phút), rồi nhập mã và mật khẩu mới */
const ForgotPasswordSheet: React.FC<{ onClose: () => void; onDone: () => void }> = ({ onClose, onDone }) => {
  const { c } = useTheme();
  const [step, setStep] = useState<'ask' | 'code'>('ask');
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = async () => {
    if (!identifier.trim()) return setError('Hãy nhập tên đăng nhập, email hoặc mã học sinh của em.');
    setLoading(true);
    setError(null);
    try {
      await authApi.requestPasswordReset(identifier.trim());
      setStep('code');
    } catch (err) {
      setError(errorMessage(err, 'Chưa gửi được mã. Hãy thử lại sau.'));
    } finally {
      setLoading(false);
    }
  };
  const submit = async () => {
    if (!/^\d{6}$/.test(otp)) return setError('Mã xác thực gồm 6 chữ số trong thư.');
    if (next.length < 8 || !/\p{L}/u.test(next) || !/\p{N}/u.test(next)) return setError('Mật khẩu mới tối thiểu 8 ký tự, gồm cả chữ và số.');
    if (next !== confirm) return setError('Mật khẩu nhập lại chưa khớp.');
    setLoading(true);
    setError(null);
    try {
      await authApi.resetPassword(identifier.trim(), otp, next);
      onDone();
    } catch (err) {
      setError(errorMessage(err, 'Chưa đặt lại được mật khẩu.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Quên mật khẩu"
      subtitle={step === 'ask' ? 'Mã xác thực được gửi tới email đã khai báo trong hồ sơ' : 'Mã có hiệu lực 5 phút và chỉ dùng được một lần'}
      footer={
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
          <Btn title="Đóng" tone="giay" onPress={onClose} />
          {step === 'code' && <Btn title="Gửi lại mã" tone="giay" onPress={() => { setStep('ask'); setOtp(''); setError(null); }} />}
          <Btn title={step === 'ask' ? 'Gửi mã xác thực' : 'Lưu mật khẩu'} tone="ngoc" loading={loading} onPress={step === 'ask' ? ask : submit} testID="forgot-submit" />
        </View>
      }
    >
      {error && (
        <Inset style={{ backgroundColor: c.sonNhat }}>
          <Txt f="bold" size={14} color={c.sonChu} accessibilityRole="alert">{error}</Txt>
        </Inset>
      )}
      {step === 'ask' ? (
        <>
          <Txt size={14} color={c.muc2}>Nhập tên đăng nhập, email hoặc mã học sinh. Nếu tài khoản có email, mã xác thực 6 chữ số sẽ được gửi tới đó. Chưa có email trong hồ sơ thì nhờ quản trị viên nhà trường đặt lại mật khẩu.</Txt>
          <Field label="Tên đăng nhập, email hoặc mã học sinh" nativeID="forgot-identifier" value={identifier} onChangeText={setIdentifier} autoCapitalize="none" autoCorrect={false} returnKeyType="send" onSubmitEditing={ask} autoFocus={Platform.OS === 'web'} />
        </>
      ) : (
        <>
          <Txt size={14} color={c.muc2}>Nếu thông tin khớp với một tài khoản có email, mã đã được gửi (xem cả mục thư rác). Nhập mã và đặt mật khẩu mới; các phiên đăng nhập cũ sẽ bị đăng xuất.</Txt>
          <Field label="Mã xác thực" nativeID="forgot-otp" value={otp} onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" autoFocus={Platform.OS === 'web'} />
          <Field label="Mật khẩu mới (tối thiểu 8 ký tự, có chữ và số)" nativeID="forgot-new" value={next} onChangeText={setNext} secureTextEntry={!show} autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" />
          <Field label="Nhập lại mật khẩu mới" nativeID="forgot-confirm" value={confirm} onChangeText={setConfirm} secureTextEntry={!show} autoCapitalize="none" autoComplete="new-password" returnKeyType="done" onSubmitEditing={submit} />
          <Btn tone="ghost" size="sm" icon={show ? EyeOff : Eye} title={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onPress={() => setShow((v) => !v)} selected={show} />
        </>
      )}
    </Sheet>
  );
};

// ---------------------------------------------------------------------- xác nhận hồ sơ lần đầu (HK.HS.004)
const ConfirmProfileSheet: React.FC<{ session: Pick<Session, 'token' | 'updateUser'>; onLogout: () => void }> = ({ session, onLogout }) => {
  const { c } = useTheme();
  const [data, setData] = useState<ProfileData | null>(null);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    authApi.getProfile(session.token).then((p) => { setData(p); setEmail(p.user.email ?? ''); }).catch((e) => setError(errorMessage(e, 'Không tải được hồ sơ.')));
  }, [session.token]);
  const confirm = async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await authApi.confirmProfile(session.token, email.trim() || null);
      session.updateUser(next.user);
    } catch (err) {
      setError(errorMessage(err, 'Chưa xác nhận được hồ sơ.'));
    } finally {
      setLoading(false);
    }
  };
  const row = (label: string, value: string | null | undefined) => (
    <View key={label} style={{ gap: 2 }}><Txt f="bold" size={12} color={c.muc3}>{label}</Txt><Txt size={15}>{value || 'Chưa có'}</Txt></View>
  );
  return (
    <Sheet open persistent onClose={() => undefined} title="Xác nhận thông tin của em" subtitle="Kiểm tra lần đầu đăng nhập; nếu sai, hãy nhờ nhà trường sửa"
      footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}><Btn title="Đăng xuất" tone="giay" onPress={onLogout} /><Btn title="Thông tin đúng, vào học" tone="son" loading={loading} disabled={!data} onPress={confirm} testID="confirm-profile" /></View>}>
      {error && <Inset style={{ backgroundColor: c.sonNhat }}><Txt f="bold" size={14} color={c.sonChu} accessibilityRole="alert">{error}</Txt></Inset>}
      {!data && !error ? <Spinner label="Đang tải hồ sơ…" /> : null}
      {data ? (
        <>
          {row('Họ và tên', data.user.full_name)}
          {row('Mã học sinh', data.user.user_code)}
          {row('Ngày sinh', data.user.birth_date)}
          {row('Trường', data.school?.name)}
          {row('Lớp', data.classes.map((k) => `${k.name} (${k.school_year})`).join(', ') || 'Chưa xếp lớp')}
          <Field label="Email của em" hint="Dùng để nhận mã xác thực khi quên mật khẩu." value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        </>
      ) : null}
    </Sheet>
  );
};

// ---------------------------------------------------------------------- đổi mật khẩu
type ChangePasswordProps = { user: AuthUser; token: string; forced: boolean; onDone: (token: string, user: AuthUser) => void; onCancel: () => void };

/** Đổi mật khẩu chủ động (từ thanh trên cùng / hồ sơ) */
export const ChangePasswordScreen: React.FC<ChangePasswordProps> = (props) => (
  <View style={{ flex: 1 }}>
    <PaperBg />
    <Animated.ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 16, paddingVertical: 40 }} keyboardShouldPersistTaps="handled">
      <Card pad={24} style={{ width: '100%', maxWidth: 460, alignSelf: 'center', gap: 14 }}>
        <ChangePasswordForm {...props} />
      </Card>
    </Animated.ScrollView>
  </View>
);

/** Nội dung biểu mẫu đổi mật khẩu (dùng trong cửa sổ bắt buộc lần đầu và màn đổi mật khẩu) */
const ChangePasswordForm: React.FC<ChangePasswordProps> = ({ user, token, forced, onDone, onCancel }) => {
  const { c } = useTheme();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (next.length < 8 || !/\p{L}/u.test(next) || !/\p{N}/u.test(next)) return setError('Mật khẩu mới tối thiểu 8 ký tự, gồm cả chữ và số.');
    if (next !== confirm) return setError('Mật khẩu nhập lại chưa khớp.');
    if (next === current) return setError('Mật khẩu mới phải khác mật khẩu hiện tại.');
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.changePassword(token, current, next);
      onDone(res.token, res.user);
    } catch (err) {
      setError(errorMessage(err, 'Không đổi được mật khẩu.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {forced ? (
        // Tiêu đề đã nằm trên khung cửa sổ: chỉ còn lời nhắn của Rồng Con
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Mascot size={72} mood="thinking" accessory="scholar" />
          <Txt f="semibold" size={14} color={c.muc2} style={{ flex: 1 }}>
            {`Chào ${user.full_name}! Đây là lần đăng nhập đầu tiên với mật khẩu mặc định – hãy đặt mật khẩu của riêng mình để mở khóa trang.`}
          </Txt>
        </View>
      ) : (
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Mascot size={96} mood="thinking" accessory="scholar" />
          <Txt f="displayHeavy" size={24} center accessibilityRole="header">
            Đổi mật khẩu
          </Txt>
          <Txt f="semibold" size={14} color={c.muc2} center>
            {`Tài khoản: ${user.username}`}
          </Txt>
        </View>
      )}
      <Field label={forced ? 'Mật khẩu mặc định được cấp' : 'Mật khẩu hiện tại'} nativeID="cp-current" value={current} onChangeText={setCurrent} secureTextEntry={!show} autoCapitalize="none" autoComplete="current-password" />
      <Field label="Mật khẩu mới (tối thiểu 8 ký tự, có chữ và số)" nativeID="cp-new" value={next} onChangeText={setNext} secureTextEntry={!show} autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" />
      <Field label="Nhập lại mật khẩu mới" nativeID="cp-confirm" value={confirm} onChangeText={setConfirm} secureTextEntry={!show} autoCapitalize="none" autoComplete="new-password" returnKeyType="done" onSubmitEditing={submit} />
      <Btn tone="ghost" size="sm" icon={show ? EyeOff : Eye} title={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onPress={() => setShow((v) => !v)} selected={show} />
      {error && (
        <Inset style={{ backgroundColor: c.sonNhat, flexDirection: 'row', gap: 8 }}>
          <AlertTriangle size={16} color={c.sonChu} style={{ marginTop: 2 }} />
          <Txt f="bold" size={14} color={c.sonChu} style={{ flex: 1 }} accessibilityRole="alert">
            {error}
          </Txt>
        </Inset>
      )}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Btn title={forced ? 'Đăng xuất' : 'Hủy'} tone="giay" onPress={onCancel} />
        <Btn title="Lưu mật khẩu" tone="ngoc" onPress={submit} loading={loading} style={{ flex: 1 }} full testID="cp-submit" />
      </View>
    </>
  );
};

// ---------------------------------------------------------------------- thanh trên cùng (giáo viên, quản trị)
export const TopBar: React.FC<{ session: Session; subtitle: string; extra?: React.ReactNode }> = ({ session, subtitle, extra }) => {
  const { c } = useTheme();
  const brand = useSystemBrand(session.token);
  const { width } = useWindowDimensions();
  const { user } = session;
  const isAdmin = user.role === 'root_admin' || user.role === 'school_admin';
  const [profile, setProfile] = useState(false);
  const loadProfile = useCallback(() => authApi.getProfile(session.token), [session.token]);
  const saveProfile = useCallback((patch: ProfilePatch) => authApi.updateProfile(session.token, patch), [session.token]);
  const uploadAvatar = useCallback((img: { data: string }) => authApi.uploadAvatar(session.token, img), [session.token]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: c.the, borderBottomWidth: 2, borderBottomColor: c.vien }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
        <BrandLogo compact={width < 520} brand={brand} subtitle={isAdmin ? ROLE_LABEL[user.role] : user.role === 'student' ? 'Trang học sinh' : 'Trang giáo viên'} />
        {width >= 900 && (
          <Txt f="semibold" size={13} color={c.muc3} numberOfLines={1} style={{ flex: 1 }}>
            {subtitle}
          </Txt>
        )}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {extra}
        <Pressable testID="topbar-profile-open" accessibilityRole="button" accessibilityLabel="Mở hồ sơ cá nhân" onPress={() => setProfile(true)} style={({ pressed }) => ({ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingRight: 6, backgroundColor: pressed ? c.dichNhat : 'transparent' })}>
          <Avatar name={user.full_name} uri={user.avatar_url} size={34} />
          {width >= 760 && (
            <View>
              <Txt f="bold" size={14} numberOfLines={1} style={{ maxWidth: 180 }}>
                {user.full_name}
              </Txt>
              <Txt size={12} color={c.muc2}>
                {ROLE_LABEL[user.role]}
                {user.class_name ? ` · Lớp ${user.class_name}` : ''}
              </Txt>
            </View>
          )}
        </Pressable>
        <Btn tone="giay" size="sm" icon={User} label="Hồ sơ cá nhân" onPress={() => setProfile(true)} testID="open-profile" />
        <Btn tone="giay" size="sm" icon={KeyRound} label="Đổi mật khẩu" onPress={session.changePassword} />
        <Btn tone="giay" size="sm" icon={LogOut} title={width >= 520 ? 'Đăng xuất' : undefined} label="Đăng xuất" onPress={() => session.logout()} />
      </View>
      {profile && <ProfileSheet onClose={() => setProfile(false)} load={loadProfile} save={saveProfile} upload={uploadAvatar} onSaved={session.updateUser} />}
    </View>
  );
};
