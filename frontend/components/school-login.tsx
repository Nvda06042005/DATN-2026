import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, View, type TextInputInstance } from 'react-native';
import { useRouter } from 'expo-router';
import { AlertTriangle, ArrowLeft, GraduationCap, KeyRound, Presentation, School, Sparkles } from 'lucide-react-native';
import * as authApi from '@/api/authApi';
import { errorMessage } from '@/api/client';
import { LoginLayout, LoginHeading, LoginInput, LoginActions, LoginPasswordToggle, useLoginDensity } from '@/components/login-layout';
import { GoogleSignIn } from '@/components/google-sign-in';
import { Btn, Inset, Txt } from '@/components/ui';
import { useShake } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';
import { SCHOOL_ROLES, type SchoolRole } from '@/lib/school-portal';
import type { AuthSession, AuthUser } from '@/types/api';
import type { TwoFactorChallenge } from '@/types/platform';

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
  const dense = useLoginDensity();
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
    <LoginLayout kind="school" subtitle="Cổng học tập" onHome={() => router.replace('/')}>
      <LoginHeading title="Đăng nhập" text={copy.account} testIDPrefix="school-auth" />
      <View accessibilityRole="radiogroup" accessibilityLabel="Chọn vai trò đăng nhập" style={{ flexDirection: 'row', gap: dense ? 6 : 10 }}>
        {SCHOOL_ROLES.map(item => {
          const selected = item === role;
          const { Icon, label } = ROLE_COPY[item];
          return <Pressable key={item} testID={`login-role-${item}`} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: selected, disabled: loading }} disabled={loading} onPress={() => chooseRole(item)} style={{ flex: 1, minHeight: dense ? 48 : 64, borderRadius: 12, borderWidth: selected ? 2 : 1, borderColor: selected ? c.logoRed : c.bienXanh, backgroundColor: selected ? '#fff0e2' : 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, paddingVertical: dense ? 4 : 8, gap: dense ? 2 : 4 }}>
            <Icon size={dense ? 18 : 22} color={selected ? c.logoRed : c.xanhMuc2} strokeWidth={1.8} />
            <Txt f="bold" size={dense ? 11 : 12} color={selected ? c.logoRed : c.logoInk} center>{label}</Txt>
          </Pressable>;
        })}
      </View>
      {notice && <Inset style={{ backgroundColor: c.thuyNhat }}><Txt size={14} color={c.thuyChu} accessibilityLiveRegion="polite">{notice}</Txt></Inset>}
      {challenge ? <View style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}><KeyRound size={20} color={c.logoRed} /><Txt f="bold" color={c.logoInk}>Xác thực hai lớp</Txt></View>
        <Txt size={14} color={c.muc2}>{challenge.method === 'email' ? 'Nhập mã đã gửi tới email của bạn.' : 'Nhập mã từ ứng dụng xác thực hoặc mã dự phòng.'}</Txt>
        <LoginInput nativeID="login-two-factor" label="Mã xác thực" value={code} onChangeText={setCode} autoComplete="one-time-code" autoCapitalize="none" autoCorrect={false} returnKeyType="go" onSubmitEditing={() => { void submit(); }} />
        <Btn title="Quay lại đăng nhập" icon={ArrowLeft} tone="ghost" size="sm" disabled={loading} onPress={() => { setChallenge(null); setCode(''); setError(null); }} />
      </View> : <View style={{ gap: dense ? 10 : 14 }}>
        <LoginInput nativeID="login-username" label={role === 'student' ? 'Tên đăng nhập, email hoặc mã học sinh' : 'Tên đăng nhập hoặc email'} placeholder={copy.hint} value={username} onChangeText={setUsername} autoComplete="username" textContentType="username" autoCapitalize="none" autoCorrect={false} editable={!loading} returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} />
        <LoginInput nativeID="login-password" inputRef={passwordRef} label="Mật khẩu" placeholder="Nhập mật khẩu" value={password} onChangeText={setPassword} autoComplete="current-password" textContentType="password" secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false} editable={!loading} returnKeyType="go" onSubmitEditing={() => { void submit(); }} right={<LoginPasswordToggle shown={showPassword} onToggle={() => setShowPassword(v => !v)} />} />
      </View>}
      {error && <Animated.View style={shake}><Inset style={{ backgroundColor: c.sonNhat, flexDirection: 'row', gap: 8 }}><AlertTriangle size={18} color={c.sonChu} /><Txt size={14} color={c.sonChu} style={{ flex: 1 }} accessibilityRole="alert">{error}</Txt></Inset></Animated.View>}
      <LoginActions title={challenge ? 'Xác thực và đăng nhập' : 'Đăng nhập'} loading={loading} onPress={() => { void submit(); }} onForgot={challenge ? undefined : onForgotPassword} actionsTestID="school-login-actions" />
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
            minHeight: 40,
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
    </LoginLayout>
  );
}
