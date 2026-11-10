/**
 * Trang đăng nhập của hai cổng quản trị (/admin, /school-manager-admin), dựng theo danh sách chức năng nhóm "01. Tài khoản và xác thực":
 * TM.AUTH.001 đăng nhập bằng tài khoản được cấp (mật khẩu hoặc Google đã gắn với hồ sơ, không đăng ký tự do), TM.AUTH.007 quên mật khẩu
 * (HK.QT.002/HK.AD: gửi mã OTP 6 chữ số hiệu lực 5 phút qua email rồi đặt mật khẩu mới). Đăng xuất là nút ở thanh trên cùng của
 * trang quản trị (AdminWorkspace).
 * Khung nhỏ giữa màn hình, chia đôi bên trong bằng cạnh chéo: ảnh động/logo trắng bên trái, form hoa văn bên phải.
 * Manrope cho form và phần chính tiêu đề, Newsreader nghiêng đỏ cho chữ nhấn. Giữ logo nhỏ, không có khẩu hiệu lớn.
 * Màn hẹp thu phần nhận diện thành đầu khung; form gồm ô nhập có chữ gợi ý, nút đỏ và liên kết "Quên mật khẩu".
 * Cổng quản trị độc lập: không có nút hay liên kết về trang chủ hoặc cổng khác.
 */
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Animated, Platform, Pressable, View, type TextInputInstance } from 'react-native';

import { ArrowLeft, ArrowRight, CircleCheck, Info, MailCheck, TriangleAlert } from 'lucide-react-native';
import * as authApi from '@/api/authApi';
import { ApiError, errorMessage } from '@/api/client';

import { GoogleSignIn } from '@/components/google-sign-in';
import { Txt } from '@/components/ui';
import { LoginLayout, LoginHeading as Heading, LoginInput as AuthInput, LoginPasswordToggle as ShowToggle, LoginActions } from '@/components/login-layout';

import { useShake } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';
import { newPasswordError, PASSWORD_HINT } from '@/lib/password-policy';
import type { AuthUser } from '@/types/api';
import type { IconType } from '@/types/game';

export type AdminPortal = 'root_admin' | 'school_admin';
type Step = 'login' | 'forgot' | 'reset' | 'password';

const COPY: Record<AdminPortal, { label: string; placeholder: string; account: string }> = {
  root_admin: {
    label: 'Quản lý tổng',
    placeholder: 'Tên đăng nhập quản trị tổng',
    account: 'Dùng tài khoản quản lý tổng được cấp, hoặc Google có email trùng hồ sơ.',
  },
  school_admin: {
    label: 'Quản trị trường',
    placeholder: 'Tên đăng nhập quản trị trường',
    account: 'Quản trị trường chỉ truy cập trường được gán. Tài khoản do quản trị tổng cấp, không có đăng ký tự do.',
  },
};

// ---------------------------------------------------------------------- thành phần nhỏ
const Banner: React.FC<{ tone: 'error' | 'success' | 'info'; text: string }> = ({ tone, text }) => {
  const { c } = useTheme();
  const t = tone === 'error' ? { bg: c.sonNhat, fg: c.sonChu, Icon: TriangleAlert } : tone === 'success' ? { bg: c.mocNhat, fg: c.mocChu, Icon: CircleCheck } : { bg: c.thuyNhat, fg: c.thuyChu, Icon: Info };
  return (
    <View style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: 4, backgroundColor: t.bg }}>
      <t.Icon size={18} color={t.fg} style={{ marginTop: 1 }} />
      <Txt f="semibold" size={14} color={t.fg} style={{ flex: 1 }} accessibilityRole={tone === 'error' ? 'alert' : undefined} accessibilityLiveRegion="polite">
        {text}
      </Txt>
    </View>
  );
};

/** Nút đỏ như trang LMS (đỏ cờ `son`, chữ trắng) */
const SubmitButton: React.FC<{ title: string; loading?: boolean; onPress: () => void; testID?: string; stretch?: boolean }> = ({ title, loading = false, onPress, testID, stretch = false }) => {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: loading, busy: loading }}
      style={({ pressed }) => ({ minHeight: stretch ? 46 : 54, minWidth: stretch ? 0 : 140, flex: stretch ? 1 : undefined, borderRadius: stretch ? 10 : 4, paddingHorizontal: stretch ? 12 : 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: stretch ? 'stretch' : 'flex-start', backgroundColor: pressed ? c.sonDam : stretch ? c.logoRed : c.son, opacity: loading ? 0.8 : 1 })}
    >
      {loading ? <ActivityIndicator size="small" color={c.trang} /> : null}
      <Txt f="semibold" size={stretch ? 14 : 18} color={c.trang}>
        {title}
      </Txt>
      {stretch && !loading ? <ArrowRight size={18} color={c.trang} /> : null}
    </Pressable>
  );
};

/** Liên kết chữ thường, tối màu như "Quên mật khẩu" ở trang LMS */
const TextLink: React.FC<{ title: string; onPress: () => void; icon?: IconType }> = ({ title, onPress, icon: Icon }) => {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="link" accessibilityLabel={title} hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' }}>
      {Icon ? <Icon size={18} color={c.muc} strokeWidth={2.2} /> : null}
      <Txt f="medium" size={18} color={c.muc}>
        {title}
      </Txt>
    </Pressable>
  );
};

const Shell: React.FC<{ portal: AdminPortal; children: React.ReactNode }> = ({ portal, children }) => <LoginLayout kind="admin" subtitle={COPY[portal].label}>{children}</LoginLayout>;

// ---------------------------------------------------------------------- đăng nhập (TM.AUTH.001)
const LoginForm: React.FC<{ portal: AdminPortal; onLogin: (token: string, user: AuthUser) => void; onForgot: () => void; notice?: string | null; success?: string | null }> = ({ portal, onLogin, onForgot, notice, success }) => {
  const copy = COPY[portal];
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const [challenge, setChallenge] = useState<{ challenge: string; method: 'email' | 'totp' } | null>(null);
  const [code, setCode] = useState('');
  const passwordRef = useRef<TextInputInstance>(null);
  const shake = useShake(error ? tries : null);

  const verify = async () => {
    if (!challenge || !code.trim()) { setError('Hãy nhập mã xác thực.'); setTries((n) => n + 1); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.verifyTwoFactor(challenge.challenge, code.trim(), portal);
      onLogin(res.token, res.user);
    } catch (err) {
      setError(errorMessage(err, 'Mã xác thực không đúng.'));
      setTries((n) => n + 1);
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (loading) return;
    if (!username.trim() || !password) {
      setError('Hãy nhập tên đăng nhập và mật khẩu.');
      setTries((n) => n + 1);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.loginAdmin(username.trim(), password, portal);
      if ('two_factor' in res) { setChallenge({ challenge: res.challenge, method: res.method }); setPassword(''); return; }
      onLogin(res.token, res.user);
    } catch (err) {
      setError(errorMessage(err, 'Đăng nhập thất bại.'));
      setTries((n) => n + 1);
    } finally {
      setLoading(false);
    }
  };

  const googleLogin = async (idToken: string) => {
    if (loading || challenge) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.loginWithGoogle(idToken, portal);
      if ('two_factor' in res) {
        setChallenge({ challenge: res.challenge, method: res.method });
        setPassword('');
        setCode('');
        return;
      }
      onLogin(res.token, res.user);
    } catch (err) {
      setError(errorMessage(err, 'Đăng nhập Google thất bại.'));
      setTries((n) => n + 1);
    } finally { setLoading(false); }
  };

  if (challenge) {
    return (
      <>
        <Heading title="Xác thực hai lớp" />
        <Banner tone="info" text={challenge.method === 'email' ? 'Mã 6 chữ số đã được gửi tới email của tài khoản (hiệu lực 5 phút).' : 'Mở ứng dụng xác thực và nhập mã 6 chữ số của tài khoản này.'} />
        <AuthInput label="Mã xác thực hoặc mã dự phòng" nativeID="admin-2fa-code" value={code} onChangeText={setCode} invalid={Boolean(error)} autoCapitalize="none" autoCorrect={false} autoComplete="one-time-code" textContentType="oneTimeCode"
          returnKeyType="go" onSubmitEditing={verify} autoFocus={Platform.OS === 'web'} />
        {error ? <Animated.View style={shake}><Banner tone="error" text={error} /></Animated.View> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 24, rowGap: 8 }}>
          <SubmitButton title={loading ? 'Đang xác thực…' : 'Xác nhận'} loading={loading} onPress={verify} testID="login-2fa-submit" />
          <TextLink title="Quay lại" onPress={() => { setChallenge(null); setCode(''); setError(null); }} />
        </View>
      </>
    );
  }

  return (
    <>
      <Heading title="Đăng nhập" text={copy.account} />
      {success ? <Banner tone="success" text={success} /> : null}
      {notice ? <Banner tone="info" text={notice} /> : null}
      <AuthInput
        label={copy.placeholder}
        placeholder="Nhập tên đăng nhập"
        showLabel
        nativeID="admin-username"
        value={username}
        onChangeText={setUsername}
        invalid={Boolean(error) && !username.trim()}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        autoFocus={Platform.OS === 'web'}
      />
      <AuthInput
        label="Mật khẩu"
        placeholder="Nhập mật khẩu"
        showLabel
        nativeID="admin-password"
        inputRef={passwordRef}
        value={password}
        onChangeText={setPassword}
        invalid={Boolean(error) && !password}
        secureTextEntry={!show}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
        right={<ShowToggle shown={show} onToggle={() => setShow((v) => !v)} />}
      />
      {error ? (
        <Animated.View style={shake}>
          <Banner tone="error" text={error} />
        </Animated.View>
      ) : null}
      <LoginActions loading={loading} onPress={submit} onForgot={onForgot} actionsTestID="admin-login-actions" />
      <GoogleSignIn disabled={loading} onToken={idToken => { void googleLogin(idToken); }} />
    </>
  );
};

// ---------------------------------------------------------------------- quên mật khẩu bằng OTP (HK.*.005)
const ForgotForm: React.FC<{ onBack: () => void; onSent: (identifier: string) => void }> = ({ onBack, onSent }) => {
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!identifier.trim()) {
      setError('Hãy nhập tên đăng nhập hoặc email của tài khoản.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await authApi.requestPasswordReset(identifier.trim());
      onSent(identifier.trim());
    } catch (err) {
      setError(errorMessage(err, 'Chưa gửi được yêu cầu. Hãy thử lại sau.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Heading title="Quên mật khẩu" text="Nhập tên đăng nhập hoặc email của tài khoản quản trị. Chúng tôi sẽ gửi mã xác thực 6 chữ số tới email của tài khoản." />
      <AuthInput
        label="Tên đăng nhập hoặc email"
        nativeID="admin-forgot"
        value={identifier}
        onChangeText={setIdentifier}
        invalid={Boolean(error) && !identifier.trim()}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        returnKeyType="send"
        onSubmitEditing={submit}
        autoFocus={Platform.OS === 'web'}
      />
      {error ? <Banner tone="error" text={error} /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 24, rowGap: 8 }}>
        <SubmitButton title={loading ? 'Đang gửi…' : 'Gửi mã xác thực'} loading={loading} onPress={submit} testID="forgot-submit" />
        <TextLink title="Quay lại đăng nhập" icon={ArrowLeft} onPress={onBack} />
      </View>
    </>
  );
};

// ---------------------------------------------------------------------- bước 2: nhập mã OTP (đúng mới sang bước đặt mật khẩu)
const CodeForm: React.FC<{ identifier: string; onVerified: (ticket: string) => void; onRequestNew: () => void }> = ({ identifier, onVerified, onRequestNew }) => {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dead, setDead] = useState(false);

  const submit = async () => {
    if (!/^\d{6}$/.test(otp)) return setError('Mã xác thực gồm 6 chữ số trong thư.');
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.verifyResetCode(identifier, otp);
      onVerified(res.reset_token);
    } catch (err) {
      setError(errorMessage(err, 'Chưa xác nhận được mã. Hãy thử lại sau.'));
      if (err instanceof ApiError && err.status === 400) setDead(true); // mã sai hoặc đã hết hạn; sai quá 5 lần thì mã bị vô hiệu
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Heading title="Nhập mã xác thực" text="Nếu thông tin khớp với một tài khoản có email, mã 6 chữ số đã được gửi (hiệu lực 5 phút, dùng một lần; xem cả mục thư rác). Nhập mã để tiếp tục; ô đặt mật khẩu mới chỉ hiện sau khi mã đúng." />
      <AuthInput
        label="Mã xác thực"
        nativeID="admin-otp"
        showLabel
        value={otp}
        onChangeText={(v) => { setOtp(v.replace(/\D/g, '').slice(0, 6)); setError(null); }}
        invalid={Boolean(error) && !/^\d{6}$/.test(otp)}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        returnKeyType="go"
        onSubmitEditing={submit}
        autoFocus={Platform.OS === 'web'}
      />
      {error ? <Banner tone="error" text={error} /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 24, rowGap: 8 }}>
        <SubmitButton title={loading ? 'Đang kiểm tra…' : 'Xác nhận mã'} loading={loading} onPress={submit} testID="reset-verify" />
        <TextLink title={dead ? 'Yêu cầu mã mới' : 'Gửi lại mã'} icon={MailCheck} onPress={onRequestNew} />
      </View>
    </>
  );
};

// ---------------------------------------------------------------------- bước 3: mật khẩu mới và nhập lại
const NewPasswordForm: React.FC<{ ticket: string; onDone: () => void; onRequestNew: () => void }> = ({ ticket, onDone, onRequestNew }) => {
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dead, setDead] = useState(false);
  const confirmRef = useRef<TextInputInstance>(null);

  const submit = async () => {
    const passwordError = newPasswordError(next);
    if (passwordError) return setError(passwordError);
    if (next !== confirm) return setError('Mật khẩu nhập lại chưa khớp.');
    setLoading(true);
    setError(null);
    try {
      await authApi.resetPasswordWithTicket(ticket, next);
      onDone();
    } catch (err) {
      setError(errorMessage(err, 'Chưa đặt lại được mật khẩu. Hãy thử lại sau.'));
      if (err instanceof ApiError && err.status === 400) setDead(true); // phiếu hết hạn (10 phút) hoặc đã dùng: phải xin mã mới
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Heading title="Đặt mật khẩu mới" text="Mã xác thực đã đúng. Bạn có 10 phút để đặt mật khẩu mới; các phiên đăng nhập cũ sẽ bị đăng xuất." />
      <AuthInput
        label="Mật khẩu mới"
        nativeID="admin-new-password"
        showLabel
        value={next}
        onChangeText={value => { setNext(value); setError(null); }}
        hint={PASSWORD_HINT}
        secureTextEntry={!show}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
        right={<ShowToggle shown={show} onToggle={() => setShow((v) => !v)} />}
        autoFocus={Platform.OS === 'web'}
      />
      <AuthInput
        label="Nhập lại mật khẩu mới"
        nativeID="admin-confirm-password"
        showLabel
        inputRef={confirmRef}
        value={confirm}
        onChangeText={setConfirm}
        invalid={Boolean(error) && !dead && next !== confirm}
        secureTextEntry={!show}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      {error ? <Banner tone="error" text={error} /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 24, rowGap: 8 }}>
        <SubmitButton title={loading ? 'Đang lưu…' : 'Lưu mật khẩu'} loading={loading} onPress={submit} testID="reset-submit" />
        {dead ? <TextLink title="Yêu cầu mã mới" icon={MailCheck} onPress={onRequestNew} /> : null}
      </View>
    </>
  );
};

// ---------------------------------------------------------------------- trang
export const AdminLogin: React.FC<{ portal: AdminPortal; onLogin: (token: string, user: AuthUser) => void; notice?: string | null }> = ({ portal, onLogin, notice }) => {
  const [view, setView] = useState<Step>('login');
  const [identifier, setIdentifier] = useState('');
  const [ticket, setTicket] = useState('');
  const [flash, setFlash] = useState<string | null>(null);

  return (
    <Shell portal={portal}>
      {view === 'login' && <LoginForm portal={portal} onLogin={onLogin} onForgot={() => setView('forgot')} notice={notice} success={flash} />}
      {view === 'forgot' && (
        <ForgotForm
          onBack={() => setView('login')}
          onSent={(id) => {
            setIdentifier(id);
            setView('reset');
          }}
        />
      )}
      {view === 'reset' && (
        <CodeForm
          identifier={identifier}
          onVerified={(t) => {
            setTicket(t);
            setView('password');
          }}
          onRequestNew={() => setView('forgot')}
        />
      )}
      {view === 'password' && (
        <NewPasswordForm
          ticket={ticket}
          onDone={() => {
            setFlash('Đã đặt lại mật khẩu. Hãy đăng nhập bằng mật khẩu mới.');
            setTicket('');
            setView('login');
          }}
          onRequestNew={() => setView('forgot')}
        />
      )}
    </Shell>
  );
};
