import { useEffect, useId, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type TextInputInstance } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, Image as SvgImage, Pattern, Polygon } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertTriangle, ArrowLeft, ArrowRight, Eye, EyeOff, GraduationCap, KeyRound, Presentation, School } from 'lucide-react-native';
import * as authApi from '@/api/authApi';
import { errorMessage } from '@/api/client';
import { AuthInput } from '@/components/admin/AdminLogin';
import { BrandLogo, FilmBackdrop, PatternOverlay } from '@/components/art';
import { GoogleSignIn } from '@/components/google-sign-in';
import { Btn, Inset, Txt } from '@/components/ui';
import { useShake } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';
import { SCHOOL_ROLES, type SchoolRole } from '@/lib/school-portal';
import type { AuthSession, AuthUser } from '@/types/api';
import type { TwoFactorChallenge } from '@/types/platform';

const LOGIN_PATTERN = require('../assets/hoa-tiet-nen.png');
const ROLE_COPY = {
  student: { label: 'Học sinh', Icon: GraduationCap, hint: 'Tên đăng nhập, email hoặc mã học sinh', account: 'Dùng tài khoản học sinh do nhà trường cấp để bắt đầu học.' },
  teacher: { label: 'Giáo viên', Icon: Presentation, hint: 'Tên đăng nhập hoặc email', account: 'Dùng tài khoản giáo viên do nhà trường cấp để vào các lớp được phân công.' },
  school_admin: { label: 'Quản trị trường', Icon: School, hint: 'Tên đăng nhập hoặc email', account: 'Dùng tài khoản được cấp để quản lý trường học của bạn.' },
} as const;

type Props = {
  initialRole: SchoolRole;
  onLogin: (token: string, user: AuthUser) => void | Promise<void>;
  notice?: string | null;
  onForgotPassword: () => void;
};

/** Một trang, một biểu mẫu; lựa chọn vai trò được kiểm tra lại tại API trước khi mở khu vực tương ứng. */
export function SchoolLogin({ initialRole, onLogin, notice, onForgotPassword }: Props) {
  const router = useRouter();
  const { c } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const wide = width >= 1000;
  const compact = width < 430;
  const short = height < 720;
  const paperId = `school-login-paper-${useId().replace(/:/g, '')}`;
  const tint = [`${c.dem}f2`, `${c.dem}d9`, `${c.dem}99`] as const;
  const [role, setRole] = useState<SchoolRole>(initialRole);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const [challenge, setChallenge] = useState<TwoFactorChallenge | null>(null);
  const [code, setCode] = useState('');
  const passwordRef = useRef<TextInputInstance>(null);
  const shake = useShake(error ? tries : null);
  const copy = ROLE_COPY[role];
  const acceptResult = async (result: AuthSession | TwoFactorChallenge) => {
    if ('two_factor' in result) {
      setChallenge(result);
      setPassword('');
      setCode('');
    } else await onLogin(result.token, result.user);
  };

  useEffect(() => {
    setRole(initialRole);
    setError(null);
    setChallenge(null);
    setCode('');
    setPassword('');
  }, [initialRole]);

  const chooseRole = (next: SchoolRole) => {
    if (loading || next === role) return;
    setRole(next);
    setPassword('');
    setShowPassword(false);
    setChallenge(null);
    setCode('');
    setError(null);
  };
  const submit = async () => {
    if (loading) return;
    if (challenge ? !code.trim() : !username.trim() || !password) {
      setError(challenge ? 'Hãy nhập mã xác thực.' : 'Hãy nhập tên đăng nhập và mật khẩu.');
      setTries(n => n + 1);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = challenge
        ? await authApi.verifyTwoFactor(challenge.challenge, code.trim(), role)
        : await authApi.loginWithPassword(username.trim(), password, role);
      await acceptResult(result);
    } catch (err) {
      setError(errorMessage(err, 'Đăng nhập thất bại.'));
      setTries(n => n + 1);
    } finally {
      setLoading(false);
    }
  };
  const googleLogin = async (idToken: string) => {
    if (loading || challenge) return;
    setLoading(true);
    setError(null);
    try { await acceptResult(await authApi.loginWithGoogle(idToken, role)); }
    catch (err) {
      setError(errorMessage(err, 'Đăng nhập Google thất bại.'));
      setTries(n => n + 1);
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, overflow: 'hidden' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View testID="school-login-viewport" style={{ flex: 1, minHeight: 0, backgroundColor: c.logoPaper, overflow: 'hidden' }}>
        {!wide && <PatternOverlay opacity={0.075} />}
        <View testID="school-login-background" style={wide ? { position: 'absolute', left: 0, top: 0, bottom: 0, width: '52%', backgroundColor: c.dem, overflow: 'hidden' } : { height: (short ? 76 : 116) + insets.top, backgroundColor: c.dem, overflow: 'hidden' }}>
          <FilmBackdrop wide={wide} />
          <LinearGradient colors={tint} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.4 }} style={StyleSheet.absoluteFill} />
          <View style={{ position: 'absolute', left: wide ? '3.4%' : 16, top: insets.top + (wide ? 18 : 12) }}>
            <BrandLogo light subtitle={copy.label} />
          </View>
          <Pressable onPress={() => router.replace('/')} accessibilityRole="link" accessibilityLabel="Về trang chủ" style={{ position: 'absolute', left: wide ? '3.4%' : undefined, bottom: wide ? Math.max(20, insets.bottom) : undefined, right: wide ? undefined : 16, top: wide ? undefined : insets.top + 12, minHeight: 44, minWidth: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <ArrowLeft size={18} color={c.trang} />{wide && <Txt f="semibold" size={13} color={c.trang}>Về trang chủ</Txt>}
          </Pressable>
          {!wide && <Svg pointerEvents="none" width="100%" height={18} viewBox="0 0 100 18" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, right: 0, bottom: -1 }}>
            <Polygon points="0,18 100,0 100,18" fill={c.logoPaper} />
          </Svg>}
        </View>
        {wide && <Svg testID="school-login-paper" pointerEvents="none" width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
          <Defs><Pattern id={paperId} width={382} height={512} patternUnits="userSpaceOnUse"><SvgImage href={LOGIN_PATTERN} width={382} height={512} opacity={0.075} /></Pattern></Defs>
          <Polygon points={`${width * 0.493},0 ${width},0 ${width},${height} ${width * 0.41},${height}`} fill={c.logoPaper} />
          <Polygon points={`${width * 0.493},0 ${width},0 ${width},${height} ${width * 0.41},${height}`} fill={`url(#${paperId})`} />
        </Svg>}
        <View testID="school-login-panel" style={wide ? { position: 'absolute', left: '52%', right: 0, top: 0, bottom: 0 } : { flex: 1, minHeight: 0 }}>
          <ScrollView testID="school-login-form" keyboardShouldPersistTaps="handled" style={{ flex: 1, minHeight: 0 }} contentContainerStyle={{ flexGrow: 1, paddingLeft: wide ? Math.round(width * 0.07) : 18, paddingRight: wide ? 48 : 18, paddingTop: wide ? Math.max(36, Math.round(height * (short ? 0.055 : 0.11))) : short ? 14 : 24, paddingBottom: Math.max(18, insets.bottom + 12) }}>
          <View style={{ width: '100%', maxWidth: wide ? Math.round(Math.min(570, Math.max(340, width * 0.31))) : 570, alignSelf: wide ? 'flex-start' : 'center', gap: short ? 10 : 18 }}>
            <View style={{ gap: 4 }}>
              <Txt testID="school-login-title" f="heavy" size={wide ? 34 : 28} color={c.logoInk} accessibilityRole="header" style={{ lineHeight: wide ? 44 : 38 }}>Đăng <Txt f="serifItalic" size={wide ? 34 : 28} color={c.logoRed} style={{ lineHeight: wide ? 44 : 38 }}>nhập</Txt></Txt>
              <Txt testID="login-role-description" size={short ? 11 : 13} color={c.muc2}>{short ? 'Tài khoản do nhà trường cấp.' : copy.account}</Txt>
            </View>
              <View accessibilityRole="radiogroup" accessibilityLabel="Chọn vai trò đăng nhập" style={{ flexDirection: 'row', gap: compact ? 6 : 10 }}>
                {SCHOOL_ROLES.map(item => {
                  const selected = item === role;
                  const { Icon, label } = ROLE_COPY[item];
                  return <Pressable key={item} testID={`login-role-${item}`} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: selected, disabled: loading }} disabled={loading} onPress={() => chooseRole(item)} style={{ flex: 1, minHeight: 64, borderRadius: 4, borderWidth: selected ? 1.5 : 1, borderColor: selected ? c.logoRed : c.vien, backgroundColor: selected ? '#fff5ef' : c.the, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, paddingVertical: 8, gap: 4 }}>
                    <Icon size={22} color={selected ? c.logoRed : c.xanhMuc2} strokeWidth={1.8} />
                    <Txt f="bold" size={12} color={selected ? c.logoRed : c.logoInk} center>{label}</Txt>
                  </Pressable>;
                })}
              </View>
            {notice && <Inset style={{ backgroundColor: c.thuyNhat }}><Txt size={14} color={c.thuyChu} accessibilityLiveRegion="polite">{notice}</Txt></Inset>}
            {challenge ? <View style={{ gap: 14 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}><KeyRound size={20} color={c.logoRed} /><Txt f="bold" color={c.logoInk}>Xác thực hai lớp</Txt></View>
              <Txt size={14} color={c.muc2}>{challenge.method === 'email' ? 'Nhập mã đã gửi tới email của bạn.' : 'Nhập mã từ ứng dụng xác thực hoặc mã dự phòng.'}</Txt>
              <AuthInput nativeID="login-two-factor" label="Mã xác thực" value={code} onChangeText={setCode} autoComplete="one-time-code" autoCapitalize="none" autoCorrect={false} editable={!loading} returnKeyType="go" onSubmitEditing={() => { void submit(); }} />
              <Btn title="Quay lại đăng nhập" icon={ArrowLeft} tone="ghost" size="sm" disabled={loading} onPress={() => { setChallenge(null); setCode(''); setError(null); }} />
            </View> : <View style={{ gap: 10 }}>
              <AuthInput nativeID="login-username" label={copy.hint} value={username} onChangeText={setUsername} autoComplete="username" textContentType="username" autoCapitalize="none" autoCorrect={false} editable={!loading} returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} />
              <AuthInput nativeID="login-password" inputRef={passwordRef} label="Mật khẩu" value={password} onChangeText={setPassword} autoComplete="current-password" textContentType="password" secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false} editable={!loading} returnKeyType="go" onSubmitEditing={() => { void submit(); }} right={
                <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onPress={() => setShowPassword(v => !v)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                  {showPassword ? <EyeOff size={20} color={c.muc2} /> : <Eye size={20} color={c.muc2} />}
                </Pressable>
              } />
            </View>}
            {error && <Animated.View style={shake}><Inset style={{ backgroundColor: c.sonNhat, flexDirection: 'row', gap: 8 }}><AlertTriangle size={18} color={c.sonChu} /><Txt size={14} color={c.sonChu} style={{ flex: 1 }} accessibilityRole="alert">{error}</Txt></Inset></Animated.View>}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <Pressable testID="login-submit" accessibilityRole="button" accessibilityLabel={challenge ? 'Xác thực và đăng nhập' : 'Đăng nhập'} accessibilityState={{ disabled: loading, busy: loading }} disabled={loading} onPress={() => { void submit(); }} style={({ pressed }) => ({ minHeight: short ? 46 : 54, minWidth: 140, paddingHorizontal: 20, borderRadius: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: pressed ? c.sonDam : c.son, opacity: loading ? 0.7 : 1 })}>
                <Txt f="bold" size={16} color={c.trang}>{loading ? 'Đang đăng nhập…' : challenge ? 'Xác thực và đăng nhập' : 'Đăng nhập'}</Txt><ArrowRight size={18} color={c.trang} />
              </Pressable>
              {!challenge && <Pressable testID="forgot-open" accessibilityRole="button" accessibilityLabel="Quên mật khẩu" onPress={onForgotPassword} style={{ minHeight: 44, justifyContent: 'center' }}><Txt f="medium" size={short ? 13 : 15} color={c.logoInk}>Quên mật khẩu?</Txt></Pressable>}
            </View>
            {!challenge && <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <GoogleSignIn disabled={loading} onToken={idToken => { void googleLogin(idToken); }} />
            </View>}
            <Txt size={11} color={c.muc3}>© 2026 · Bản quyền thuộc quản lý Đông A</Txt>
          </View>
          </ScrollView>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
