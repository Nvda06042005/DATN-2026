import { useEffect, useRef, useState } from 'react';
import { Animated, ImageBackground, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type TextInputInstance } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertTriangle, ArrowLeft, ArrowRight, Eye, EyeOff, GraduationCap, KeyRound, Presentation, School, Sparkles } from 'lucide-react-native';
import * as authApi from '@/api/authApi';
import { errorMessage } from '@/api/client';
import { BrandLogo } from '@/components/art';
import { GoogleSignIn } from '@/components/google-sign-in';
import { Btn, Field, Inset, Txt } from '@/components/ui';
import { useShake } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';
import { SCHOOL_ROLES, type SchoolRole } from '@/lib/school-portal';
import type { AuthSession, AuthUser } from '@/types/api';
import type { TwoFactorChallenge } from '@/types/platform';

const BACKGROUND = require('../assets/dang-nhap-thanh-luy.webp');
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
  const wide = width >= 860;
  const compact = width < 430;
  const edge = height < 650 ? 12 : wide ? 24 : 16;
  const cardHeight = Math.min(wide ? 620 : 740, Math.max(200, height - insets.top - insets.bottom - edge * 2));
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
  const inputStyle = { backgroundColor: c.the, borderColor: c.bienDam, borderWidth: 1, borderRadius: 10, minHeight: 46, fontSize: 14 } as const;

  return (
    <KeyboardAvoidingView style={{ flex: 1, overflow: 'hidden' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ImageBackground testID="school-login-background" source={BACKGROUND} resizeMode="cover" style={StyleSheet.absoluteFill} accessible={false}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(20, 32, 25, 0.23)' }]} />
      </ImageBackground>
      <View testID="school-login-viewport" style={{ flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: edge, paddingTop: insets.top + edge, paddingBottom: insets.bottom + edge }}>
        <View testID="school-login-card" style={{ width: '100%', maxWidth: 940, height: cardHeight, maxHeight: '100%', flexDirection: wide ? 'row' : 'column', backgroundColor: c.the, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)', boxShadow: '0 24px 80px rgba(12, 24, 18, 0.24)', overflow: 'hidden' }}>
          <View style={{ width: wide ? '32%' : '100%', padding: wide ? 24 : 12, flexDirection: wide ? 'column' : 'row', alignItems: wide ? undefined : 'center', justifyContent: 'space-between', gap: 12, backgroundColor: c.logoPaper, borderRightWidth: wide ? 1 : 0, borderBottomWidth: wide ? 0 : 1, borderColor: c.vien }}>
            <BrandLogo />
            {wide && <View style={{ gap: 16 }}>
              <Txt f="heavy" size={25} color={c.logoInk} style={{ lineHeight: 34 }}>Cùng mở những{ '\n' }trang sử mới.</Txt>
              <Txt f="serifItalic" size={24} color={c.logoRed} style={{ lineHeight: 32 }}>Học lịch sử,{ '\n' }khơi hào khí Đông A.</Txt>
              {height >= 650 && <Txt size={12} color={c.muc2} style={{ lineHeight: 20 }}>Học sinh khám phá, giáo viên đồng hành và nhà trường kết nối.</Txt>}
            </View>}
            <Pressable onPress={() => router.replace('/')} accessibilityRole="link" accessibilityLabel="Về trang chủ" style={{ minHeight: 44, minWidth: 44, flexDirection: 'row', alignItems: 'center', justifyContent: wide ? 'flex-start' : 'center', gap: 8 }}>
              <ArrowLeft size={18} color={c.logoInk} />{wide && <Txt f="semibold" size={13} color={c.logoInk}>Về trang chủ</Txt>}
            </Pressable>
          </View>
          <ScrollView testID="school-login-form" keyboardShouldPersistTaps="handled" style={{ flex: 1, minHeight: 0 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: wide ? 24 : 16, gap: 10 }}>
            <View style={{ gap: 4 }}>
              <Txt f="heavy" size={26} color={c.logoInk} accessibilityRole="header">Đăng nhập</Txt>
              <Txt testID="login-role-description" size={12} color={c.muc2}>{copy.account}</Txt>
            </View>
              <View accessibilityRole="radiogroup" accessibilityLabel="Chọn vai trò đăng nhập" style={{ flexDirection: 'row', gap: compact ? 6 : 10 }}>
                {SCHOOL_ROLES.map(item => {
                  const selected = item === role;
                  const { Icon, label } = ROLE_COPY[item];
                  return <Pressable key={item} testID={`login-role-${item}`} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: selected, disabled: loading }} disabled={loading} onPress={() => chooseRole(item)} style={{ flex: 1, minHeight: 64, borderRadius: 12, borderWidth: selected ? 2 : 1, borderColor: selected ? c.logoRed : c.bienXanh, backgroundColor: selected ? '#fff5ef' : c.the, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, paddingVertical: 8, gap: 4 }}>
                    <Icon size={22} color={selected ? c.logoRed : c.xanhMuc2} strokeWidth={1.8} />
                    <Txt f="bold" size={12} color={selected ? c.logoRed : c.logoInk} center>{label}</Txt>
                  </Pressable>;
                })}
              </View>
            {notice && <Inset style={{ backgroundColor: c.thuyNhat }}><Txt size={14} color={c.thuyChu} accessibilityLiveRegion="polite">{notice}</Txt></Inset>}
            {challenge ? <View style={{ gap: 14 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}><KeyRound size={20} color={c.logoRed} /><Txt f="bold" color={c.logoInk}>Xác thực hai lớp</Txt></View>
              <Txt size={14} color={c.muc2}>{challenge.method === 'email' ? 'Nhập mã đã gửi tới email của bạn.' : 'Nhập mã từ ứng dụng xác thực hoặc mã dự phòng.'}</Txt>
              <Field nativeID="login-two-factor" label="Mã xác thực" value={code} onChangeText={setCode} autoComplete="one-time-code" autoCapitalize="none" autoCorrect={false} inputStyle={inputStyle} returnKeyType="go" onSubmitEditing={() => { void submit(); }} />
              <Btn title="Quay lại đăng nhập" icon={ArrowLeft} tone="ghost" size="sm" disabled={loading} onPress={() => { setChallenge(null); setCode(''); setError(null); }} />
            </View> : <View style={{ gap: 10 }}>
              <Field nativeID="login-username" label={role === 'student' ? 'Tên đăng nhập, email hoặc mã học sinh' : 'Tên đăng nhập hoặc email'} placeholder={copy.hint} value={username} onChangeText={setUsername} autoComplete="username" textContentType="username" autoCapitalize="none" autoCorrect={false} inputStyle={inputStyle} editable={!loading} returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} />
              <View>
                <Field nativeID="login-password" inputRef={passwordRef} label="Mật khẩu" placeholder="Nhập mật khẩu" value={password} onChangeText={setPassword} autoComplete="current-password" textContentType="password" secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false} inputStyle={{ ...inputStyle, paddingRight: 52 }} editable={!loading} returnKeyType="go" onSubmitEditing={() => { void submit(); }} />
                <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onPress={() => setShowPassword(v => !v)} style={{ position: 'absolute', right: 4, bottom: 4, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                  {showPassword ? <EyeOff size={20} color={c.muc2} /> : <Eye size={20} color={c.muc2} />}
                </Pressable>
              </View>
            </View>}
            {error && <Animated.View style={shake}><Inset style={{ backgroundColor: c.sonNhat, flexDirection: 'row', gap: 8 }}><AlertTriangle size={18} color={c.sonChu} /><Txt size={14} color={c.sonChu} style={{ flex: 1 }} accessibilityRole="alert">{error}</Txt></Inset></Animated.View>}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {!challenge && <Pressable testID="forgot-open" accessibilityRole="button" accessibilityLabel="Quên mật khẩu" onPress={onForgotPassword} style={{ minHeight: 44, justifyContent: 'center' }}><Txt f="semibold" size={12} color={c.logoRed}>Quên mật khẩu?</Txt></Pressable>}
              <Pressable testID="login-submit" accessibilityRole="button" accessibilityLabel={challenge ? 'Xác thực và đăng nhập' : 'Đăng nhập'} accessibilityState={{ disabled: loading, busy: loading }} disabled={loading} onPress={() => { void submit(); }} style={({ pressed }) => ({ flex: 1, minHeight: 46, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: pressed ? c.sonDam : c.logoRed, opacity: loading ? 0.7 : 1 })}>
                <Txt f="bold" size={14} color={c.trang}>{loading ? 'Đang đăng nhập…' : challenge ? 'Xác thực và đăng nhập' : 'Đăng nhập'}</Txt><ArrowRight size={18} color={c.trang} />
              </Pressable>
            </View>
            {!challenge && (
              <Pressable
                onPress={() => {
                  const targetRole = role === 'school_admin' ? 'school_admin' : role === 'teacher' ? 'teacher' : 'student';
                  const demoToken = `demo-${targetRole}-${Date.now()}`;
                  const mockUser: AuthUser = {
                    id: targetRole === 'teacher' ? 2 : targetRole === 'student' ? 1 : 3,
                    username: `${targetRole}.demo`,
                    full_name: targetRole === 'teacher' ? 'Thầy Cô Giáo Viên (Bản Xem Thử)' : targetRole === 'student' ? 'Học Sinh Đông A (Bản Xem Thử)' : 'Quản Trị Nhà Trường (Bản Xem Thử)',
                    role: targetRole,
                    class_name: '7A1',
                    must_change_password: false,
                    is_active: true,
                    created_at: '2026-01-01T00:00:00Z',
                    last_login_at: '2026-01-01T00:00:00Z',
                    school_id: 1,
                    user_code: targetRole === 'teacher' ? 'GV001' : targetRole === 'student' ? 'HS001' : 'QT001',
                    school_code: 'DA7',
                    region: 'Miền Bắc',
                    city: 'Hà Nội',
                    birth_date: targetRole === 'teacher' ? '1985-01-01' : '2012-05-15',
                    school_year: '2025-2026',
                    email: `${targetRole}@donga.edu.vn`,
                    grade: 7,
                    phone: '0987654321',
                    avatar_url: null,
                    bio: targetRole === 'teacher' ? 'Giáo viên bộ môn Lịch sử' : 'Yêu thích lịch sử',
                    nickname: null,
                    gender: null,
                    subject: targetRole === 'teacher' ? 'Lịch sử' : null,
                    parent_email: null,
                    lock_reason: null,
                    locked_at: null,
                    admin_level: targetRole === 'teacher' ? 2 : 1,
                    profile_confirmed_at: '2026-01-01T00:00:00Z',
                    self_registered: false,
                  };
                  void onLogin(demoToken, mockUser);
                }}
                style={({ pressed }) => ({
                  minHeight: 42,
                  borderRadius: 10,
                  borderWidth: 1.5,
                  borderColor: c.vien,
                  backgroundColor: pressed ? c.the2 : '#f8fafc',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                })}
                testID="demo-preview-btn"
              >
                <Sparkles size={16} color="#d97706" />
                <Txt f="bold" size={13} color="#334155">
                  {role === 'teacher' ? '⚡ Vào nhanh giao diện Giáo viên (Bản xem thử)' : role === 'student' ? '⚡ Vào nhanh giao diện Học sinh (Bản xem thử)' : '⚡ Vào nhanh Nhà trường (Bản xem thử)'}
                </Txt>
              </Pressable>
            )}
            {!challenge && <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <GoogleSignIn disabled={loading} onToken={idToken => { void googleLogin(idToken); }} />
            </View>}
            <Txt size={11} color={c.muc3} center>© 2026 · Bản quyền thuộc quản lý Đông A</Txt>
          </ScrollView>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
