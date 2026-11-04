import React, { useEffect, useRef, useState } from 'react';
import { Animated, ImageBackground, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type TextInputInstance } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertTriangle, ArrowLeft, ArrowRight, Eye, EyeOff, GraduationCap, KeyRound, Presentation, School } from 'lucide-react-native';
import * as authApi from '@/api/authApi';
import { errorMessage } from '@/api/client';
import { BrandLogo } from '@/components/art';
import { Btn, Field, Inset, Txt } from '@/components/ui';
import { useShake } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';
import { SCHOOL_ROLES, type SchoolRole } from '@/lib/school-portal';
import type { AuthUser } from '@/types/api';
import type { TwoFactorChallenge } from '@/types/platform';

const BACKGROUND = require('../assets/dang-nhap-thanh-luy.webp');
const ROLE_COPY = {
  student: { label: 'Học sinh', Icon: GraduationCap, hint: 'Tên đăng nhập, email hoặc mã học sinh', account: 'Dùng tài khoản nhà trường cấp, hoặc đăng ký tự học bằng email.' },
  teacher: { label: 'Giáo viên', Icon: Presentation, hint: 'Tên đăng nhập hoặc email', account: 'Dùng tài khoản giáo viên do nhà trường cấp để vào các lớp được phân công.' },
  school_admin: { label: 'Quản trị trường', Icon: School, hint: 'Tên đăng nhập hoặc email', account: 'Dùng tài khoản được cấp để quản lý trường học của bạn.' },
} as const;

type Props = {
  initialRole: SchoolRole;
  onLogin: (token: string, user: AuthUser) => void | Promise<void>;
  notice?: string | null;
  onForgotPassword: () => void;
  studentActions: React.ReactNode;
};

/** Một trang, một biểu mẫu; lựa chọn vai trò được kiểm tra lại tại API trước khi mở khu vực tương ứng. */
export function SchoolLogin({ initialRole, onLogin, notice, onForgotPassword, studentActions }: Props) {
  const router = useRouter();
  const { c } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const wide = width >= 860;
  const compact = width < 430;
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
      if ('two_factor' in result) {
        setChallenge(result);
        setPassword('');
      } else await onLogin(result.token, result.user);
    } catch (err) {
      setError(errorMessage(err, 'Đăng nhập thất bại.'));
      setTries(n => n + 1);
    } finally {
      setLoading(false);
    }
  };
  const inputStyle = { backgroundColor: c.the, borderColor: c.bienDam, borderWidth: 1, borderRadius: 12, minHeight: 52, fontSize: 16 } as const;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ImageBackground testID="school-login-background" source={BACKGROUND} resizeMode="cover" style={StyleSheet.absoluteFill} accessible={false}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(20, 32, 25, 0.23)' }]} />
      </ImageBackground>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, minHeight: height, alignItems: 'center', justifyContent: 'center', padding: wide ? 32 : 16, paddingTop: Math.max(wide ? 32 : 20, insets.top), paddingBottom: Math.max(24, insets.bottom) }}>
        <View testID="school-login-card" style={{ width: '100%', maxWidth: 1040, flexDirection: wide ? 'row' : 'column', backgroundColor: c.the, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)', boxShadow: '0 24px 80px rgba(12, 24, 18, 0.24)', overflow: 'hidden' }}>
          <View style={{ width: wide ? '38%' : '100%', padding: wide ? 40 : 24, paddingBottom: wide ? 40 : 20, justifyContent: 'space-between', gap: wide ? 40 : 16, backgroundColor: c.logoPaper, borderRightWidth: wide ? 1 : 0, borderBottomWidth: wide ? 0 : 1, borderColor: c.vien }}>
            <BrandLogo />
            {wide && <View style={{ gap: 18 }}>
              <Txt f="heavy" size={32} color={c.logoInk} style={{ lineHeight: 42 }}>Cùng mở những{ '\n' }trang sử mới.</Txt>
              <Txt f="serifItalic" size={30} color={c.logoRed} style={{ lineHeight: 38 }}>Học lịch sử,{ '\n' }khơi hào khí Đông A.</Txt>
              <Txt size={14} color={c.muc2} style={{ lineHeight: 23 }}>Một không gian chung để học sinh khám phá, giáo viên đồng hành và nhà trường kết nối.</Txt>
            </View>}
            <Pressable onPress={() => router.replace('/')} accessibilityRole="link" accessibilityLabel="Về trang chủ" style={{ alignSelf: 'flex-start', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ArrowLeft size={18} color={c.logoInk} /><Txt f="semibold" size={14} color={c.logoInk}>Về trang chủ</Txt>
            </Pressable>
          </View>
          <View style={{ flex: 1, padding: wide ? 40 : compact ? 20 : 28, gap: 20 }}>
            <View style={{ gap: 6 }}>
              <Txt f="heavy" size={wide ? 32 : 28} color={c.logoInk} accessibilityRole="header">Đăng nhập</Txt>
              <Txt size={14} color={c.muc2}>Chọn vai trò để bắt đầu cùng Đông A.</Txt>
            </View>
            <View style={{ gap: 8 }}>
              <Txt f="bold" size={14} color={c.logoInk}>Bạn là ai?</Txt>
              <View accessibilityRole="radiogroup" accessibilityLabel="Chọn vai trò đăng nhập" style={{ flexDirection: 'row', gap: compact ? 7 : 12 }}>
                {SCHOOL_ROLES.map(item => {
                  const selected = item === role;
                  const { Icon, label } = ROLE_COPY[item];
                  return <Pressable key={item} testID={`login-role-${item}`} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: selected, disabled: loading }} disabled={loading} onPress={() => chooseRole(item)} style={{ flex: 1, minHeight: 92, borderRadius: 15, borderWidth: selected ? 2 : 1, borderColor: selected ? c.logoRed : c.bienXanh, backgroundColor: selected ? '#fff5ef' : c.the, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, paddingVertical: 12, gap: 8 }}>
                    <Icon size={25} color={selected ? c.logoRed : c.xanhMuc2} strokeWidth={1.8} />
                    <Txt f="bold" size={compact ? 12 : 13} color={selected ? c.logoRed : c.logoInk} center>{label}</Txt>
                  </Pressable>;
                })}
              </View>
            </View>
            {notice && <Inset style={{ backgroundColor: c.thuyNhat }}><Txt size={14} color={c.thuyChu} accessibilityLiveRegion="polite">{notice}</Txt></Inset>}
            <Txt testID="login-role-description" size={14} color={c.muc2}>{copy.account}</Txt>
            {challenge ? <View style={{ gap: 14 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}><KeyRound size={20} color={c.logoRed} /><Txt f="bold" color={c.logoInk}>Xác thực hai lớp</Txt></View>
              <Txt size={14} color={c.muc2}>{challenge.method === 'email' ? 'Nhập mã đã gửi tới email của bạn.' : 'Nhập mã từ ứng dụng xác thực hoặc mã dự phòng.'}</Txt>
              <Field nativeID="login-two-factor" label="Mã xác thực" value={code} onChangeText={setCode} autoComplete="one-time-code" autoCapitalize="none" autoCorrect={false} inputStyle={inputStyle} returnKeyType="go" onSubmitEditing={() => { void submit(); }} />
              <Btn title="Quay lại đăng nhập" icon={ArrowLeft} tone="ghost" size="sm" disabled={loading} onPress={() => { setChallenge(null); setCode(''); setError(null); }} />
            </View> : <View style={{ gap: 16 }}>
              <Field nativeID="login-username" label={role === 'student' ? 'Tên đăng nhập, email hoặc mã học sinh' : 'Tên đăng nhập hoặc email'} placeholder={copy.hint} value={username} onChangeText={setUsername} autoComplete="username" textContentType="username" autoCapitalize="none" autoCorrect={false} inputStyle={inputStyle} editable={!loading} returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} />
              <View>
                <Field nativeID="login-password" inputRef={passwordRef} label="Mật khẩu" placeholder="Nhập mật khẩu" value={password} onChangeText={setPassword} autoComplete="current-password" textContentType="password" secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false} inputStyle={{ ...inputStyle, paddingRight: 52 }} editable={!loading} returnKeyType="go" onSubmitEditing={() => { void submit(); }} />
                <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onPress={() => setShowPassword(v => !v)} style={{ position: 'absolute', right: 4, bottom: 4, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                  {showPassword ? <EyeOff size={20} color={c.muc2} /> : <Eye size={20} color={c.muc2} />}
                </Pressable>
              </View>
              <Pressable testID="forgot-open" accessibilityRole="button" accessibilityLabel="Quên mật khẩu" onPress={onForgotPassword} style={{ alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center' }}><Txt f="semibold" size={14} color={c.logoRed}>Quên mật khẩu?</Txt></Pressable>
            </View>}
            {error && <Animated.View style={shake}><Inset style={{ backgroundColor: c.sonNhat, flexDirection: 'row', gap: 8 }}><AlertTriangle size={18} color={c.sonChu} /><Txt size={14} color={c.sonChu} style={{ flex: 1 }} accessibilityRole="alert">{error}</Txt></Inset></Animated.View>}
            <Pressable testID="login-submit" accessibilityRole="button" accessibilityLabel={challenge ? 'Xác thực và đăng nhập' : 'Đăng nhập'} accessibilityState={{ disabled: loading, busy: loading }} disabled={loading} onPress={() => { void submit(); }} style={({ pressed }) => ({ minHeight: 54, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: pressed ? c.sonDam : c.logoRed, opacity: loading ? 0.7 : 1 })}>
              <Txt f="bold" size={16} color={c.trang}>{loading ? 'Đang đăng nhập…' : challenge ? 'Xác thực và đăng nhập' : 'Đăng nhập'}</Txt><ArrowRight size={20} color={c.trang} />
            </Pressable>
            {role === 'student' && !challenge ? studentActions : null}
            <Txt size={11} color={c.muc3} center>© 2026 · Bản quyền thuộc quản lý Đông A</Txt>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
