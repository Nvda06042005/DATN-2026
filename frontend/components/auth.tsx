/**
 * Phiên đăng nhập theo từng trang: học sinh (/hoc-sinh), giáo viên (/giao-vien), quản trị tổng (/admin),
 * quản trị trường (/school-manager-admin); /portal đăng nhập chung cho giáo viên và học sinh. Hai cổng quản trị tách biệt:
 * không có nút hay liên kết về trang chủ. Mỗi trang giữ token riêng (kho bảo mật của điện thoại hoặc localStorage trên web).
 * Lần đầu đăng nhập bằng mật khẩu mặc định: màn hình chính bị khóa, cửa sổ bắt buộc đặt mật khẩu mới; đổi mật khẩu làm token cũ hết hiệu lực.
 * Trang đăng nhập của hai cổng quản trị (kèm quên mật khẩu) nằm ở components/admin/AdminLogin.tsx; ở đây chỉ còn đăng nhập giáo viên/học sinh.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, View, useWindowDimensions, type TextInputInstance } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertTriangle, ChevronLeft, Eye, EyeOff, KeyRound, LogIn, LogOut, Presentation, User } from 'lucide-react-native';
import * as authApi from '@/api/authApi';
import { ApiError, errorMessage } from '@/api/client';
import { AdminLogin } from '@/components/admin/AdminLogin';
import { BrandLogo, Mascot } from '@/components/art';
import { ProfileSheet } from '@/components/profile';
import { Avatar, Btn, Card, Chip, Field, Inset, PaperBg, Sheet, Spinner, Txt, useToast } from '@/components/ui';
import { useShake } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';
import { readToken, saveToken } from '@/lib/storage';
import type { AuthRole, AuthUser, Portal, ProfileData, ProfilePatch } from '@/types/api';

export const PORTAL_PATH: Record<Portal, '/hoc-sinh' | '/giao-vien' | '/admin' | '/school-manager-admin'> = {
  student: '/hoc-sinh',
  teacher: '/giao-vien',
  root_admin: '/admin',
  school_admin: '/school-manager-admin',
};
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
  if (!user || !token) return <LoginScreen portal={portal} onLogin={start} notice={notice} />;
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

// ---------------------------------------------------------------------- đăng nhập
/** Trang đăng nhập của người học: học sinh, giáo viên và /portal chung (hai cổng quản trị dùng AdminLogin) */
type LearnerPortal = 'student' | 'teacher' | 'app';

const PORTAL_THEME: Record<LearnerPortal, { heading: string; sub: string; tone: 'son' | 'ngoc' | 'dong'; placeholder: string; panel: readonly [string, string, ...string[]]; panelTitle: string; panelText: string }> = {
  app: {
    heading: 'Đăng nhập học tập',
    sub: 'Giáo viên và học sinh dùng tài khoản nhà trường cấp',
    tone: 'dong',
    placeholder: 'tên đăng nhập, email hoặc mã học sinh',
    panel: ['#0b6cc0', '#0f4f8a', '#16253f'],
    panelTitle: 'Hào Khí Đông A',
    panelText: 'Một cổng đăng nhập cho giáo viên và học sinh: hệ thống tự đưa bạn tới đúng trang của mình.',
  },
  student: {
    heading: 'Học sinh đăng nhập',
    sub: 'Dùng tài khoản nhà trường cấp cho em, hoặc đăng ký tự học',
    tone: 'son',
    placeholder: 'tên đăng nhập, email hoặc mã học sinh',
    panel: ['#b91c1c', '#991b1b', '#7f1d1d'],
    panelTitle: 'Học lịch sử cùng Hào Khí Đông A',
    panelText: 'Tham gia lớp bằng mã giáo viên cung cấp và khám phá ba cuộc kháng chiến chống Nguyên – Mông thời Trần.',
  },
  teacher: {
    heading: 'Giáo viên đăng nhập',
    sub: 'Dùng tài khoản quản trị viên nhà trường cấp',
    tone: 'ngoc',
    placeholder: 'tên đăng nhập hoặc email',
    panel: ['#0b6cc0', '#0f4f8a', '#16253f'],
    panelTitle: 'Không gian giáo viên',
    panelText: 'Xem các lớp được phân công, mã tham gia lớp và hồ sơ cá nhân.',
  },
};

const PortalArt: React.FC<{ portal: LearnerPortal; size?: number }> = ({ portal, size = 1 }) =>
  portal === 'teacher' ? (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: 104 * size, height: 104 * size, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
        <Presentation size={60 * size} color="#ffffff" />
      </View>
      <Mascot size={104 * size} accessory="scholar" mood="happy" style={{ marginTop: -22 }} />
    </View>
  ) : (
    <Mascot size={190 * size} accessory="conical" mood="excited" bob />
  );

type LoginProps = { portal: Portal | 'app'; onLogin: (token: string, user: AuthUser) => void; notice?: string | null };

/** Đăng nhập một trang: hai cổng quản trị có trang riêng (AdminLogin); giáo viên, học sinh và /portal dùng màn LearnerLogin */
export const LoginScreen: React.FC<LoginProps> = ({ portal, ...rest }) =>
  isAdminPortal(portal) ? <AdminLogin portal={portal} {...rest} /> : <LearnerLogin portal={portal} {...rest} />;

const LearnerLogin: React.FC<Omit<LoginProps, 'portal'> & { portal: LearnerPortal }> = ({ portal, onLogin, notice }) => {
  const { c } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const theme = PORTAL_THEME[portal];
  const wide = width >= 1000;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const [forgot, setForgot] = useState(false);
  const [signup, setSignup] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const passwordRef = useRef<TextInputInstance>(null);
  const shake = useShake(error ? tries : null);

  const submit = async () => {
    if (!username.trim() || !password) {
      setError('Hãy nhập tên đăng nhập và mật khẩu.');
      setTries((n) => n + 1);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.loginToPortal(username.trim(), password, portal);
      onLogin(res.token, res.user);
    } catch (err) {
      setError(errorMessage(err, 'Đăng nhập thất bại.'));
      setTries((n) => n + 1);
    } finally {
      setLoading(false);
    }
  };

  const others = (['student', 'teacher'] as Portal[]).filter((p) => p !== portal);

  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      <PaperBg />
      {wide && (
        <LinearGradient colors={theme.panel} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, padding: 40, justifyContent: 'space-between', overflow: 'hidden' }}>
          <Pressable onPress={() => router.replace('/')} accessibilityRole="link" accessibilityLabel="Về trang chủ" style={{ alignSelf: 'flex-start' }}>
            <BrandLogo light subtitle={PORTAL_TITLE[portal]} />
          </Pressable>
          <View style={{ alignItems: 'center', gap: 10 }}>
            <PortalArt portal={portal} />
            <Txt f="displayHeavy" size={30} color="#ffffff" center>
              {theme.panelTitle}
            </Txt>
            <Txt f="bold" color="rgba(255,255,255,0.85)" center style={{ maxWidth: 440 }}>
              {theme.panelText}
            </Txt>
          </View>
          <Txt f="bold" size={12} color="rgba(255,255,255,0.8)">
            © Hào Khí Đông A · Học lịch sử qua trải nghiệm
          </Txt>
        </LinearGradient>
      )}
      <View style={{ flex: 1, maxWidth: wide ? 560 : undefined }}>
        <Animated.ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20, paddingVertical: 40 }} keyboardShouldPersistTaps="handled">
          <View style={{ width: '100%', maxWidth: 400, alignSelf: 'center', gap: 14 }}>
            <Btn title="Trang chủ" icon={ChevronLeft} tone="ghost" size="sm" onPress={() => router.replace('/')} />
            {!wide && (
              <View style={{ alignItems: 'center' }}>
                <PortalArt portal={portal} size={0.7} />
              </View>
            )}
            <Chip
              text={PORTAL_TITLE[portal].toUpperCase()}
              bg={portal === 'student' ? c.sonNhat : portal === 'teacher' ? c.ngocNhat : c.dongNhat}
              fg={portal === 'student' ? c.sonChu : portal === 'teacher' ? c.ngocChu : c.dongChu}
              style={{ alignSelf: 'center' }}
            />
            <View>
              <Txt f="displayHeavy" size={30} center accessibilityRole="header">
                {theme.heading}
              </Txt>
              <Txt f="semibold" size={14} color={c.muc2} center>
                {theme.sub}
              </Txt>
            </View>
            {(notice || flash) && (
              <Inset style={{ backgroundColor: c.thuyNhat }}>
                <Txt f="bold" size={14} color={c.thuyChu} accessibilityLiveRegion="polite">
                  {flash ?? notice}
                </Txt>
              </Inset>
            )}
            <Field
              label="Tên đăng nhập, email hoặc mã học sinh"
              nativeID="login-username"
              value={username}
              onChangeText={setUsername}
              placeholder={theme.placeholder}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              autoFocus={Platform.OS === 'web'}
            />
            <View>
              <Field
                label="Mật khẩu"
                nativeID="login-password"
                inputRef={passwordRef}
                value={password}
                onChangeText={setPassword}
                placeholder="Mật khẩu"
                secureTextEntry={!show}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={submit}
                inputStyle={{ paddingRight: 52 }}
              />
              <View style={{ position: 'absolute', right: 2, bottom: 2 }}>
                <Btn tone="ghost" size="sm" icon={show ? EyeOff : Eye} label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onPress={() => setShow((v) => !v)} />
              </View>
            </View>
            {error && (
              <Animated.View style={shake}>
                <Inset style={{ backgroundColor: c.sonNhat, flexDirection: 'row', gap: 8 }}>
                  <AlertTriangle size={16} color={c.sonChu} style={{ marginTop: 2 }} />
                  <Txt f="bold" size={14} color={c.sonChu} style={{ flex: 1 }} accessibilityRole="alert">
                    {error}
                  </Txt>
                </Inset>
              </Animated.View>
            )}
            <Btn title={loading ? 'Đang đăng nhập…' : 'Đăng nhập'} icon={LogIn} tone={theme.tone} size="lg" full loading={loading} onPress={submit} testID="login-submit" />
            <Inset pad={16} style={{ gap: 6 }}>
              <Txt size={14} color={c.muc2}>
                <Txt f="bold" size={14}>
                  Chưa có tài khoản?{' '}
                </Txt>
                Tài khoản do quản trị viên nhà trường cấp. Học sinh chưa thuộc trường có thể đăng ký tự học bằng email.
              </Txt>
              <Txt size={14} color={c.muc2}>
                <Txt f="bold" size={14}>
                  Quên mật khẩu?{' '}
                </Txt>
                Nhận mã xác thực qua email, hoặc nhờ quản trị viên đặt lại.
              </Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                <Btn tone="ghost" size="sm" title="Quên mật khẩu? Nhận mã qua email" onPress={() => setForgot(true)} testID="forgot-open" />
              </View>
              {portal !== 'teacher' && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                  <Btn tone="ghost" size="sm" title="Đăng ký tự học bằng email" onPress={() => setSignup(true)} testID="signup-open" />
                  {GOOGLE_CLIENT_ID ? <GoogleButton onToken={async (idToken) => { try { const res = await authApi.loginWithGoogle(idToken); onLogin(res.token, res.user); } catch (err) { setError(errorMessage(err, 'Đăng nhập Google thất bại.')); setTries((n) => n + 1); } }} /> : null}
                </View>
              )}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                {others.map((p) => (
                  <Btn key={p} tone="ghost" size="sm" title={p === 'student' ? 'Em là học sinh? →' : 'Bạn là giáo viên? →'} onPress={() => router.replace(PORTAL_PATH[p])} />
                ))}
              </View>
            </Inset>
          </View>
        </Animated.ScrollView>
      </View>
      {signup && <SignupSheet onClose={() => setSignup(false)} onDone={(token, user) => { setSignup(false); onLogin(token, user); }} />}
      {forgot && (
        <ForgotPasswordSheet
          onClose={() => setForgot(false)}
          onDone={() => {
            setForgot(false);
            setFlash('Đã đặt lại mật khẩu. Hãy đăng nhập bằng mật khẩu mới.');
          }}
        />
      )}
    </View>
  );
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

// ---------------------------------------------------------------------- đăng nhập Google (HK.HS.002)
/** OAuth client ID của ứng dụng web; để trống thì ẩn nút (EXPO_PUBLIC_GOOGLE_CLIENT_ID) */
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '';

/** Nút "Đăng nhập bằng Google" của Google Identity Services (chỉ web); mã trả về được máy chủ kiểm tra lại */
const GoogleButton: React.FC<{ onToken: (idToken: string) => void }> = ({ onToken }) => {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (Platform.OS !== 'web' || !GOOGLE_CLIENT_ID) return undefined;
    const render = () => {
      const g = (window as unknown as { google?: { accounts: { id: { initialize: (o: object) => void; renderButton: (el: HTMLElement, o: object) => void } } } }).google;
      const el = host.current;
      if (!g || !el) return;
      g.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: (r: { credential: string }) => onToken(r.credential) });
      g.accounts.id.renderButton(el, { theme: 'outline', size: 'medium', text: 'signin_with', locale: 'vi' });
    };
    if ((window as unknown as { google?: unknown }).google) { render(); return undefined; }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = render;
    document.head.appendChild(script);
    return () => { script.onload = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return Platform.OS === 'web' ? <div ref={host} aria-label="Đăng nhập bằng Google" style={{ minHeight: 44, display: 'flex', alignItems: 'center' }} /> : null;
};

// ---------------------------------------------------------------------- đăng ký tự học (HK.HS.003)
/** Hai bước: nhập email để nhận mã 6 chữ số (5 phút), rồi nhập mã, họ tên và mật khẩu; tài khoản tự học không thuộc trường nào */
const SignupSheet: React.FC<{ onClose: () => void; onDone: (token: string, user: AuthUser) => void }> = ({ onClose, onDone }) => {
  const { c } = useTheme();
  const [step, setStep] = useState<'email' | 'form'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [nick, setNick] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError('Hãy nhập đúng địa chỉ email.');
    setLoading(true);
    setError(null);
    try {
      await authApi.requestSignup(email.trim());
      setStep('form');
    } catch (err) {
      setError(errorMessage(err, 'Chưa gửi được mã.'));
    } finally {
      setLoading(false);
    }
  };
  const finish = async () => {
    if (!/^\d{6}$/.test(otp)) return setError('Mã xác thực gồm 6 chữ số trong thư.');
    if (name.trim().length < 2) return setError('Hãy nhập họ tên.');
    if (pass.length < 8 || !/\p{L}/u.test(pass) || !/\p{N}/u.test(pass)) return setError('Mật khẩu tối thiểu 8 ký tự, gồm cả chữ và số.');
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.completeSignup({ email: email.trim(), otp, full_name: name.trim(), nickname: nick.trim() || undefined, password: pass });
      onDone(res.token, res.user);
    } catch (err) {
      setError(errorMessage(err, 'Chưa đăng ký được.'));
    } finally {
      setLoading(false);
    }
  };
  return (
    <Sheet open onClose={onClose} title="Đăng ký tự học" subtitle="Dành cho học sinh chưa thuộc trường nào: chỉ có chế độ tự học, không có lớp"
      footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}><Btn title="Đóng" tone="giay" onPress={onClose} /><Btn title={step === 'email' ? 'Gửi mã xác thực' : 'Tạo tài khoản'} tone="son" loading={loading} onPress={step === 'email' ? send : finish} testID="signup-submit" /></View>}>
      {error && <Inset style={{ backgroundColor: c.sonNhat }}><Txt f="bold" size={14} color={c.sonChu} accessibilityRole="alert">{error}</Txt></Inset>}
      {step === 'email' ? (
        <Field label="Email của em" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" hint="Mã xác thực 6 chữ số được gửi tới email này, có hiệu lực 5 phút." onSubmitEditing={send} />
      ) : (
        <>
          <Txt size={14} color={c.muc2}>Nếu email hợp lệ, mã đã được gửi tới {email.trim()} (xem cả thư rác).</Txt>
          <Field label="Mã xác thực" value={otp} onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" />
          <Field label="Họ và tên" value={name} onChangeText={setName} autoComplete="name" />
          <Field label="Biệt danh (không bắt buộc)" value={nick} onChangeText={setNick} hint="2–24 ký tự; bảng xếp hạng chỉ hiện biệt danh." />
          <Field label="Mật khẩu (tối thiểu 8 ký tự, có chữ và số)" value={pass} onChangeText={setPass} secureTextEntry autoCapitalize="none" autoComplete="new-password" onSubmitEditing={finish} />
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
  const { width } = useWindowDimensions();
  const { user } = session;
  const isAdmin = user.role === 'root_admin' || user.role === 'school_admin';
  const [profile, setProfile] = useState(false);
  const loadProfile = useCallback(() => authApi.getProfile(session.token), [session.token]);
  const saveProfile = useCallback((patch: ProfilePatch) => authApi.updateProfile(session.token, patch), [session.token]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: c.the, borderBottomWidth: 2, borderBottomColor: c.vien }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
        <BrandLogo compact={width < 520} subtitle={isAdmin ? ROLE_LABEL[user.role] : user.role === 'student' ? 'Trang học sinh' : 'Trang giáo viên'} />
        {width >= 900 && (
          <Txt f="semibold" size={13} color={c.muc3} numberOfLines={1} style={{ flex: 1 }}>
            {subtitle}
          </Txt>
        )}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {extra}
        <Avatar name={user.full_name} size={34} />
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
        <Btn tone="giay" size="sm" icon={User} label="Hồ sơ cá nhân" onPress={() => setProfile(true)} testID="open-profile" />
        <Btn tone="giay" size="sm" icon={KeyRound} label="Đổi mật khẩu" onPress={session.changePassword} />
        <Btn tone="giay" size="sm" icon={LogOut} title={width >= 520 ? 'Đăng xuất' : undefined} label="Đăng xuất" onPress={() => session.logout()} />
      </View>
      {profile && <ProfileSheet onClose={() => setProfile(false)} load={loadProfile} save={saveProfile} onSaved={session.updateUser} />}
    </View>
  );
};
