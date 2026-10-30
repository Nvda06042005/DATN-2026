/**
 * Trang đăng nhập của hai cổng quản trị (/admin, /school-manager-admin), dựng theo danh sách chức năng nhóm "01. Tài khoản và xác thực":
 * TM.AUTH.001 đăng nhập bằng tài khoản được cấp (không có đăng ký tự do, không đăng nhập qua bên thứ ba), TM.AUTH.007 quên mật khẩu
 * (gửi liên kết đặt lại qua email, liên kết mở lại đúng cổng bằng ?reset=<mã>). TM.AUTH.002 đăng xuất là nút ở thanh trên cùng của
 * trang quản trị (AdminWorkspace).
 * Bố cục đăng nhập cũ: ảnh bìa tối bên trái, cạnh vát chéo và form trắng bên phải. Giữ logo nhỏ, không có khẩu hiệu lớn.
 * Màn hẹp dùng ảnh thành dải đầu trang; form gồm ô nhập có chữ gợi ý, nút đỏ và liên kết "Quên mật khẩu".
 * Cổng quản trị độc lập: không có nút hay liên kết về trang chủ hoặc cổng khác.
 */
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Animated, Platform, Pressable, StyleSheet, TextInput, View, useWindowDimensions, type TextInputInstance, type TextInputProps } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Polygon } from 'react-native-svg';
import { ArrowLeft, CircleCheck, Eye, EyeOff, Info, MailCheck, TriangleAlert } from 'lucide-react-native';
import * as authApi from '@/api/authApi';
import { ApiError, errorMessage } from '@/api/client';
import { BrandLogo, FilmBackdrop } from '@/components/art';
import { Txt } from '@/components/ui';
import { FONT } from '@/constants/theme';
import { useShake } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';
import type { AuthUser } from '@/types/api';
import type { IconType } from '@/types/game';

export type AdminPortal = 'root_admin' | 'school_admin';
type Step = 'login' | 'forgot' | 'reset';

const COPY: Record<AdminPortal, { label: string; placeholder: string; account: string }> = {
  root_admin: {
    label: 'Quản trị tổng',
    placeholder: 'Tên đăng nhập quản trị',
    account: 'Tài khoản quản trị tổng được cấu hình khi triển khai hệ thống, không có đăng ký tự do.',
  },
  school_admin: {
    label: 'Quản trị trường',
    placeholder: 'Tên đăng nhập quản trị trường',
    account: 'Tài khoản quản trị trường do quản trị tổng cấp, không có đăng ký tự do.',
  },
};

/** Cạnh phải ảnh bìa vát chéo như bố cục đăng nhập cũ. */
const SLANT_TOP = 49.3;
const SLANT_BOTTOM = 41;

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

type InputProps = Omit<TextInputProps, 'style' | 'placeholder'> & {
  /** Vừa là chữ gợi ý trong ô vừa là nhãn cho trình đọc màn hình */
  label: string;
  nativeID: string;
  invalid?: boolean;
  hint?: string;
  inputRef?: React.Ref<TextInputInstance>;
  /** Nút trong ô (ví dụ hiện/ẩn mật khẩu) */
  right?: React.ReactNode;
  /** Hiện nhãn phía trên thay cho chữ gợi ý, dùng khi hai ô cùng loại nằm cạnh nhau (đặt mật khẩu mới) */
  showLabel?: boolean;
};

/** Ô nhập như trang LMS: viền mảnh, góc vuông, chỉ có chữ gợi ý (nhãn nằm ở accessibilityLabel); vòng sáng khi đang nhập */
const AuthInput: React.FC<InputProps> = ({ label, nativeID, invalid, hint, inputRef, right, showLabel, ...rest }) => {
  const { c } = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      {showLabel ? (
        <Txt f="bold" size={14} color={c.muc2}>
          {label}
        </Txt>
      ) : null}
      <View>
        <TextInput
          ref={inputRef}
          nativeID={nativeID}
          accessibilityLabel={label}
          placeholder={showLabel ? undefined : label}
          placeholderTextColor={c.muc3}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={[
            {
              minHeight: 54,
              borderRadius: 4,
              borderWidth: 1.5,
              borderColor: invalid ? c.son : focus ? c.troi : c.muc3,
              backgroundColor: c.the,
              paddingHorizontal: 20,
              paddingRight: right ? 58 : 20,
              fontFamily: FONT.medium,
              fontSize: 17,
              color: c.muc,
            },
            focus && { boxShadow: `0 0 0 3px ${invalid ? 'rgba(185, 28, 28, 0.2)' : 'rgba(11, 108, 192, 0.22)'}` },
            // Trình duyệt vẽ thêm viền mặc định khi nhập: vòng sáng ở trên đã thay thế
            Platform.OS === 'web' && { outlineStyle: 'solid', outlineWidth: 0 },
          ]}
          {...rest}
        />
        {right ? <View style={{ position: 'absolute', right: 4, top: 0, bottom: 0, justifyContent: 'center' }}>{right}</View> : null}
      </View>
      {hint ? (
        <Txt size={13} color={c.muc2}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
};

/** Nút hiện/ẩn mật khẩu trong ô nhập */
const ShowToggle: React.FC<{ shown: boolean; onToggle: () => void }> = ({ shown, onToggle }) => {
  const { c } = useTheme();
  const Icon = shown ? EyeOff : Eye;
  return (
    <Pressable onPress={onToggle} accessibilityRole="button" accessibilityLabel={shown ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} accessibilityState={{ selected: shown }} style={{ width: 46, height: 46, alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={22} color={c.muc3} />
    </Pressable>
  );
};

/** Nút đỏ như trang LMS (đỏ cờ `son`, chữ trắng) */
const SubmitButton: React.FC<{ title: string; loading?: boolean; onPress: () => void; testID?: string }> = ({ title, loading = false, onPress, testID }) => {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: loading, busy: loading }}
      style={({ pressed }) => ({ minHeight: 54, minWidth: 140, borderRadius: 4, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: pressed ? c.sonDam : c.son, opacity: loading ? 0.8 : 1 })}
    >
      {loading ? <ActivityIndicator size="small" color={c.trang} /> : null}
      <Txt f="semibold" size={18} color={c.trang}>
        {title}
      </Txt>
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

const Heading: React.FC<{ title: string; text?: string }> = ({ title, text }) => {
  const { c } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Txt f="bold" size={34} color={c.muc} accessibilityRole="header" style={{ lineHeight: 42 }}>
        {title}
      </Txt>
      {text ? (
        <Txt size={16} color={c.muc2}>
          {text}
        </Txt>
      ) : null}
    </View>
  );
};

// ---------------------------------------------------------------------- khung: ảnh bìa trang chủ bên trái, form bên phải
const Shell: React.FC<{ portal: AdminPortal; children: React.ReactNode }> = ({ portal, children }) => {
  const { c } = useTheme();
  const { width, height } = useWindowDimensions();
  const wide = width >= 1000;
  const copy = COPY[portal];
  /** Xanh đêm (màu `dem` cố định) phủ lên ảnh: đậm bên trái, nhạt dần về phía cạnh vát để còn thấy ảnh */
  const tint = [`${c.dem}f2`, `${c.dem}d9`, `${c.dem}99`] as const;

  if (!wide) {
    return (
      <View testID="admin-login-shell" style={{ flex: 1, backgroundColor: c.the }}>
        <View testID="admin-login-art" style={{ height: 232, backgroundColor: c.dem, overflow: 'hidden' }}>
          <FilmBackdrop wide={false} />
          <LinearGradient colors={tint} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
            <BrandLogo light subtitle={copy.label} />
          </View>
          <Svg pointerEvents="none" width="100%" height={32} viewBox="0 0 100 32" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, right: 0, bottom: -1 }}>
            <Polygon points="0,32 100,0 100,32" fill={c.the} />
          </Svg>
        </View>
        <Animated.ScrollView testID="admin-login-form" style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, padding: 20, paddingTop: 12, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <View style={{ width: '100%', maxWidth: 570, alignSelf: 'center', gap: 24 }}>{children}</View>
        </Animated.ScrollView>
      </View>
    );
  }

  return (
    <View testID="admin-login-shell" style={{ flex: 1, backgroundColor: c.the, overflow: 'hidden' }}>
      <View testID="admin-login-art" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '52%', backgroundColor: c.dem }}>
        <FilmBackdrop wide />
        <LinearGradient colors={tint} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.4 }} style={StyleSheet.absoluteFill} />
        <View style={{ position: 'absolute', left: '3.4%', top: 18 }}>
          <BrandLogo light subtitle={copy.label} />
        </View>
      </View>
      <Svg pointerEvents="none" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
        <Polygon points={`${SLANT_TOP},0 100,0 100,100 ${SLANT_BOTTOM},100`} fill={c.the} />
      </Svg>
      <View style={{ position: 'absolute', left: '52%', right: 0, top: 0, bottom: 0 }}>
        <Animated.ScrollView testID="admin-login-form" style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, paddingLeft: Math.round(width * 0.07), paddingRight: 48, paddingTop: Math.max(56, Math.round(height * 0.11)), paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          {/* Cột form chiếm khoảng 31 % bề ngang như trang LMS (tối đa 570 px) */}
          <View style={{ width: '100%', maxWidth: Math.round(Math.min(570, Math.max(340, width * 0.31))), gap: 26 }}>{children}</View>
        </Animated.ScrollView>
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------- đăng nhập (TM.AUTH.001)
const LoginForm: React.FC<{ portal: AdminPortal; onLogin: (token: string, user: AuthUser) => void; onForgot: () => void; notice?: string | null; success?: string | null }> = ({ portal, onLogin, onForgot, notice, success }) => {
  const { c } = useTheme();
  const copy = COPY[portal];
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
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

  return (
    <>
      <Heading title="Đăng nhập" />
      {success ? <Banner tone="success" text={success} /> : null}
      {notice ? <Banner tone="info" text={notice} /> : null}
      <AuthInput
        label={copy.placeholder}
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
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 24, rowGap: 8 }}>
        <SubmitButton title={loading ? 'Đang đăng nhập…' : 'Đăng nhập'} loading={loading} onPress={submit} testID="login-submit" />
        <TextLink title="Quên mật khẩu" onPress={onForgot} />
      </View>
      <Txt size={14} color={c.muc2} style={{ maxWidth: 460 }}>
        {copy.account}
      </Txt>
    </>
  );
};

// ---------------------------------------------------------------------- quên mật khẩu (TM.AUTH.007)
const ForgotForm: React.FC<{ portal: AdminPortal; onBack: () => void }> = ({ portal, onBack }) => {
  const { c } = useTheme();
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!identifier.trim()) {
      setError('Hãy nhập tên đăng nhập hoặc email của tài khoản.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await authApi.requestPasswordReset(identifier.trim(), portal);
      setSent(true);
    } catch (err) {
      setError(errorMessage(err, 'Chưa gửi được yêu cầu. Hãy thử lại sau.'));
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.mocNhat, alignItems: 'center', justifyContent: 'center' }}>
          <MailCheck size={28} color={c.mocChu} />
        </View>
        <Heading title="Kiểm tra hộp thư" text="Nếu thông tin khớp với một tài khoản có email, liên kết đặt lại mật khẩu đã được gửi. Liên kết có hiệu lực 30 phút và chỉ dùng được một lần. Hãy xem cả mục thư rác." />
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 24, rowGap: 8 }}>
          <SubmitButton title="Về đăng nhập" onPress={onBack} />
          <TextLink title="Gửi lại" onPress={() => setSent(false)} />
        </View>
      </>
    );
  }
  return (
    <>
      <Heading title="Quên mật khẩu" text="Nhập tên đăng nhập hoặc email của tài khoản quản trị. Chúng tôi sẽ gửi liên kết đặt lại mật khẩu tới email của tài khoản." />
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
        <SubmitButton title={loading ? 'Đang gửi…' : 'Gửi liên kết'} loading={loading} onPress={submit} testID="forgot-submit" />
        <TextLink title="Quay lại đăng nhập" icon={ArrowLeft} onPress={onBack} />
      </View>
    </>
  );
};

// ---------------------------------------------------------------------- đặt mật khẩu mới từ liên kết trong thư
const ResetForm: React.FC<{ token: string; onDone: () => void; onRequestNew: () => void }> = ({ token, onDone, onRequestNew }) => {
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dead, setDead] = useState(false);
  const confirmRef = useRef<TextInputInstance>(null);

  const submit = async () => {
    if (next.length < 6) return setError('Mật khẩu mới cần ít nhất 6 ký tự.');
    if (next !== confirm) return setError('Mật khẩu nhập lại chưa khớp.');
    setLoading(true);
    setError(null);
    try {
      await authApi.resetPassword(token, next);
      onDone();
    } catch (err) {
      setError(errorMessage(err, 'Chưa đặt lại được mật khẩu. Hãy thử lại sau.'));
      if (err instanceof ApiError && err.status === 400) setDead(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Heading title="Đặt mật khẩu mới" text="Nhập mật khẩu mới cho tài khoản quản trị của bạn. Các phiên đăng nhập cũ sẽ bị đăng xuất." />
      <AuthInput
        label="Mật khẩu mới"
        nativeID="admin-new-password"
        showLabel
        value={next}
        onChangeText={setNext}
        hint="Tối thiểu 6 ký tự."
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
        {dead ? <TextLink title="Yêu cầu liên kết mới" icon={MailCheck} onPress={onRequestNew} /> : null}
      </View>
    </>
  );
};

// ---------------------------------------------------------------------- trang
export const AdminLogin: React.FC<{ portal: AdminPortal; onLogin: (token: string, user: AuthUser) => void; notice?: string | null }> = ({ portal, onLogin, notice }) => {
  const router = useRouter();
  const { reset } = useLocalSearchParams<{ reset?: string | string[] }>();
  const resetToken = (Array.isArray(reset) ? reset[0] : reset) || '';
  const [view, setView] = useState<Step>(resetToken ? 'reset' : 'login');
  const [flash, setFlash] = useState<string | null>(null);

  /** Bỏ mã khỏi địa chỉ để làm mới trang không mở lại biểu mẫu đặt mật khẩu */
  const clearToken = () => {
    if (resetToken) router.setParams({ reset: undefined });
  };

  return (
    <Shell portal={portal}>
      {view === 'login' && <LoginForm portal={portal} onLogin={onLogin} onForgot={() => setView('forgot')} notice={notice} success={flash} />}
      {view === 'forgot' && <ForgotForm portal={portal} onBack={() => setView('login')} />}
      {view === 'reset' && (
        <ResetForm
          token={resetToken}
          onDone={() => {
            clearToken();
            setFlash('Đã đặt lại mật khẩu. Hãy đăng nhập bằng mật khẩu mới.');
            setView('login');
          }}
          onRequestNew={() => {
            clearToken();
            setView('forgot');
          }}
        />
      )}
    </Shell>
  );
};
