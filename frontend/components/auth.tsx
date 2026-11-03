/**
 * Phiên đăng nhập theo từng trang: học sinh (/hoc-sinh), giáo viên (/giao-vien), quản trị tổng (/admin),
 * quản trị trường (/school-manager-admin); /portal đăng nhập chung cho giáo viên và học sinh. Hai cổng quản trị tách biệt:
 * không có nút hay liên kết về trang chủ. Mỗi trang giữ token riêng (kho bảo mật của điện thoại hoặc localStorage trên web).
 * Lần đầu đăng nhập bằng mật khẩu mặc định: màn hình chính bị khóa, cửa sổ bắt buộc đặt mật khẩu mới; đổi mật khẩu làm token cũ hết hiệu lực.
 * Trang đăng nhập của hai cổng quản trị (kèm quên mật khẩu) nằm ở components/admin/AdminLogin.tsx; ở đây chỉ còn đăng nhập giáo viên/học sinh.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type TextInputInstance,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronLeft,
  Eye,
  EyeOff,
  GraduationCap,
  Info,
  KeyRound,
  LogOut,
  Presentation,
  School,
  Sparkles,
  Trophy,
  User,
} from 'lucide-react-native';
import * as authApi from '@/api/authApi';
import { ApiError, errorMessage } from '@/api/client';
import { AdminLogin } from '@/components/admin/AdminLogin';
import { BrandLogo, Mascot } from '@/components/art';
import { ProfileSheet } from '@/components/profile';
import { Avatar, Btn, Card, Field, Inset, PaperBg, Sheet, Spinner, Txt, useToast } from '@/components/ui';
import { useShake } from '@/hooks/use-motion';
import { useSystemBrand } from '@/hooks/use-system-brand';
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

// ---------------------------------------------------------------------- đăng nhập VioEdu style (Ảnh 3, 4, 5)
type LearnerPortal = 'student' | 'teacher' | 'app';

type SelectableRole = 'student' | 'teacher' | 'school_admin';

const ROLES_LIST: Array<{ key: SelectableRole; label: string; Icon: React.ComponentType<{ size?: number; color?: string }> }> = [
  { key: 'student', label: 'Học sinh', Icon: GraduationCap },
  { key: 'teacher', label: 'Giáo viên', Icon: Presentation },
  { key: 'school_admin', label: 'Nhà trường', Icon: School },
];

/** Nền mây bồng bềnh cuộn sóng đáy màn hình (Ảnh 3, 4, 5) */
const CloudWaveBackdrop: React.FC = () => (
  <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 160, overflow: 'hidden' }}>
    <Svg width="100%" height="100%" viewBox="0 0 1440 220" preserveAspectRatio="none">
      <Path
        d="M0,120 C180,60 360,110 540,85 C720,60 900,105 1080,80 C1260,55 1380,95 1440,75 L1440,220 L0,220 Z"
        fill="#ffffff"
        opacity={0.35}
      />
      <Path
        d="M0,145 C150,95 320,135 480,115 C640,95 800,130 960,110 C1120,90 1280,125 1440,105 L1440,220 L0,220 Z"
        fill="#ffffff"
        opacity={0.65}
      />
      <Path
        d="M0,175 C120,145 220,165 340,150 C460,135 560,160 680,145 C800,130 920,155 1040,140 C1160,125 1280,150 1440,135 L1440,220 L0,220 Z"
        fill="#ffffff"
        opacity={1.0}
      />
    </Svg>
  </View>
);

/** Thẻ tính năng hình viên thuốc bo tròn (Ảnh 3) */
const FeaturePill: React.FC<{ icon: React.ReactNode; iconBg: string; text: string }> = ({ icon, iconBg, text }) => (
  <View
    style={{
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderRadius: 9999,
      paddingVertical: 10,
      paddingHorizontal: 16,
      gap: 12,
      shadowColor: '#002b49',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
      elevation: 3,
      maxWidth: 480,
      width: '100%',
    }}
  >
    <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center' }}>
      {icon}
    </View>
    <Txt f="bold" size={13} color="#1e293b" style={{ flex: 1, lineHeight: 18 }}>
      {text}
    </Txt>
  </View>
);

type LoginProps = { portal: Portal | 'app'; onLogin: (token: string, user: AuthUser) => void; notice?: string | null };

/** Đăng nhập một trang: hai cổng quản trị có trang riêng (AdminLogin); giáo viên, học sinh và /portal dùng màn LearnerLogin */
export const LoginScreen: React.FC<LoginProps> = ({ portal, ...rest }) =>
  isAdminPortal(portal) ? <AdminLogin portal={portal} {...rest} /> : <LearnerLogin portal={portal} {...rest} />;

const LearnerLogin: React.FC<Omit<LoginProps, 'portal'> & { portal: LearnerPortal }> = ({ portal, onLogin, notice }) => {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 1000;

  // Chế độ: 'login' (Ảnh 3) hoặc 'signup' (Ảnh 4 & 5)
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  // Tab vai trò: mặc định theo portal prop nếu có
  const [selectedRole, setSelectedRole] = useState<SelectableRole>(
    portal === 'teacher' ? 'teacher' : 'student'
  );

  // Form đăng nhập
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const [forgot, setForgot] = useState(false);
  const [signupModal, setSignupModal] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const passwordRef = useRef<TextInputInstance>(null);
  const shake = useShake(error ? tries : null);

  // Form đăng ký học sinh (Ảnh 4)
  const [signupStep, setSignupStep] = useState<'form' | 'otp'>('form');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regNick, setRegNick] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regOtp, setRegOtp] = useState('');
  const [regAgreed, setRegAgreed] = useState(true);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  const submitLogin = async () => {
    if (!username.trim() || !password) {
      setError('Hãy nhập tên đăng nhập và mật khẩu.');
      setTries((n) => n + 1);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Gửi đúng portal theo tab đã chọn để máy chủ phân quyền chính xác
      const targetPortal: Portal | 'app' =
        selectedRole === 'school_admin'
          ? 'school_admin'
          : selectedRole === 'teacher'
          ? 'teacher'
          : portal === 'app'
          ? 'app'
          : 'student';

      const res = await authApi.loginToPortal(username.trim(), password, targetPortal);
      onLogin(res.token, res.user);
    } catch (err) {
      setError(errorMessage(err, 'Đăng nhập thất bại.'));
      setTries((n) => n + 1);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestSignup = async () => {
    if (!regName.trim() || regName.trim().length < 2) {
      return setRegError('Vui lòng nhập họ và tên của em.');
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(regEmail.trim())) {
      return setRegError('Hãy nhập đúng địa chỉ email để nhận mã OTP.');
    }
    if (regPassword.length < 8 || !/\p{L}/u.test(regPassword) || !/\p{N}/u.test(regPassword)) {
      return setRegError('Mật khẩu tối thiểu 8 ký tự, gồm cả chữ và số.');
    }
    if (regPassword !== regConfirm) {
      return setRegError('Mật khẩu nhập lại chưa khớp.');
    }
    if (!regAgreed) {
      return setRegError('Vui lòng đồng ý với Điều khoản sử dụng và Chính sách bảo mật.');
    }

    setRegLoading(true);
    setRegError(null);
    try {
      await authApi.requestSignup(regEmail.trim());
      setSignupStep('otp');
    } catch (err) {
      setRegError(errorMessage(err, 'Chưa gửi được mã xác thực.'));
    } finally {
      setRegLoading(false);
    }
  };

  const handleCompleteSignup = async () => {
    if (!/^\d{6}$/.test(regOtp.trim())) {
      return setRegError('Mã xác thực gồm 6 chữ số gửi tới email.');
    }
    setRegLoading(true);
    setRegError(null);
    try {
      const res = await authApi.completeSignup({
        email: regEmail.trim(),
        otp: regOtp.trim(),
        full_name: regName.trim(),
        nickname: regNick.trim() || undefined,
        password: regPassword,
      });
      onLogin(res.token, res.user);
    } catch (err) {
      setRegError(errorMessage(err, 'Chưa hoàn tất được đăng ký.'));
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#0284c7', '#0ea5e9', '#38bdf8']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1, position: 'relative' }}
    >
      <CloudWaveBackdrop />

      <Animated.ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
          paddingVertical: 48,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            width: '100%',
            maxWidth: 1120,
            flexDirection: wide ? 'row' : 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: wide ? 56 : 28,
            zIndex: 10,
          }}
        >
          {/* Cột trái: Giới thiệu AI & Linh vật Hào Khí Đông A (Ảnh 3) */}
          {wide ? (
            <View style={{ flex: 1, maxWidth: 480, alignItems: 'center', gap: 20 }}>
              <Pressable
                onPress={() => router.replace('/')}
                accessibilityRole="link"
                accessibilityLabel="Về trang chủ"
                style={{
                  alignSelf: 'flex-start',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 9999,
                  backgroundColor: 'rgba(255, 255, 255, 0.22)',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.35)',
                }}
              >
                <ChevronLeft size={16} color="#ffffff" />
                <Txt f="bold" size={13} color="#ffffff">
                  Trang chủ
                </Txt>
              </Pressable>

              <View style={{ alignItems: 'center', gap: 6 }}>
                <Txt f="displayHeavy" size={26} color="#ffffff" center style={{ textShadowColor: 'rgba(0,0,0,0.15)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 }}>
                  Nền tảng tự học trực tuyến với AI
                </Txt>
                <Txt f="bold" size={15} color="rgba(255,255,255,0.92)" center>
                  Hào Khí Đông A · Tiếp bước truyền thống cha ông
                </Txt>
              </View>

              {/* Linh vật Rồng Con 3D nhún nhảy giữa vòng hào quang */}
              <View style={{ alignItems: 'center', justifyContent: 'center', marginVertical: 8 }}>
                <View
                  style={{
                    position: 'absolute',
                    width: 200,
                    height: 200,
                    borderRadius: 100,
                    backgroundColor: 'rgba(255, 255, 255, 0.18)',
                  }}
                />
                <Mascot size={170} accessory="conical" mood="excited" bob />
              </View>

              {/* 3 Thẻ tính năng hình viên thuốc (Ảnh 3) */}
              <View style={{ width: '100%', gap: 10 }}>
                <FeaturePill
                  icon={<Trophy size={18} color="#d97706" />}
                  iconBg="#fef3c7"
                  text="Hơn 96% học sinh tiến bộ rõ rệt và yêu thích, tự giác học tập."
                />
                <FeaturePill
                  icon={<Sparkles size={18} color="#16a34a" />}
                  iconBg="#dcfce7"
                  text="Trợ lý AI phát hiện chính xác lỗ hổng kiến thức."
                />
                <FeaturePill
                  icon={<BookOpen size={18} color="#dc2626" />}
                  iconBg="#fee2e2"
                  text="Hơn 1,000,000++ nội dung kiến thức theo SGK và nâng cao."
                />
              </View>
            </View>
          ) : (
            <View style={{ width: '100%', maxWidth: 440, alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Pressable
                onPress={() => router.replace('/')}
                style={{
                  alignSelf: 'flex-start',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 9999,
                  backgroundColor: 'rgba(255, 255, 255, 0.25)',
                }}
              >
                <ChevronLeft size={16} color="#ffffff" />
                <Txt f="bold" size={12} color="#ffffff">
                  Trang chủ
                </Txt>
              </Pressable>
              <Mascot size={110} accessory="conical" mood="excited" bob />
            </View>
          )}

          {/* Cột phải: Hộp thẻ trắng nâng nổi cao cấp (Ảnh 3, 4, 5) */}
          <View
            style={{
              width: '100%',
              maxWidth: 460,
              backgroundColor: '#ffffff',
              borderRadius: 28,
              paddingHorizontal: wide ? 34 : 22,
              paddingVertical: 32,
              shadowColor: '#002b49',
              shadowOffset: { width: 0, height: 16 },
              shadowOpacity: 0.16,
              shadowRadius: 30,
              elevation: 10,
              gap: 16,
            }}
          >
            {/* Logo thương hiệu */}
            <View style={{ alignItems: 'center', marginBottom: 4 }}>
              <BrandLogo />
            </View>

            {mode === 'login' ? (
              // ---------------------- MÀN HÌNH ĐĂNG NHẬP (Ảnh 3)
              <View style={{ gap: 14 }}>
                {/* 3 Tab chọn vai trò (Học sinh / Giáo viên / Nhà trường) */}
                <View style={{ gap: 6 }}>
                  <Txt f="bold" size={13} color="#64748b">
                    Chọn vai trò:
                  </Txt>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {ROLES_LIST.map(({ key, label, Icon }) => {
                      const isSel = selectedRole === key;
                      return (
                        <Pressable
                          key={key}
                          onPress={() => {
                            setSelectedRole(key);
                            setError(null);
                          }}
                          style={{
                            flex: 1,
                            alignItems: 'center',
                            justifyContent: 'center',
                            paddingVertical: 10,
                            paddingHorizontal: 6,
                            borderRadius: 12,
                            borderWidth: 1.5,
                            borderColor: isSel ? '#16a34a' : '#e2e8f0',
                            backgroundColor: isSel ? '#f0fdf4' : '#ffffff',
                            gap: 4,
                          }}
                        >
                          <Icon size={20} color={isSel ? '#16a34a' : '#64748b'} />
                          <Txt f="bold" size={12} color={isSel ? '#16a34a' : '#475569'}>
                            {label}
                          </Txt>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* Thông báo hệ thống / flash */}
                {(notice || flash) && (
                  <View style={{ padding: 12, borderRadius: 10, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe' }}>
                    <Txt f="bold" size={13} color="#1d4ed8">
                      {flash ?? notice}
                    </Txt>
                  </View>
                )}

                {/* Ô Tên đăng nhập */}
                <View style={{ gap: 6 }}>
                  <Text style={{ fontFamily: 'Manrope_700Bold', fontSize: 13, color: '#334155' }}>
                    Tên đăng nhập <Text style={{ color: '#ef4444' }}>*</Text>
                  </Text>
                  <TextInput
                    value={username}
                    onChangeText={setUsername}
                    placeholder={
                      selectedRole === 'student'
                        ? 'Nhập tên đăng nhập, email hoặc mã học sinh'
                        : selectedRole === 'teacher'
                        ? 'Nhập tên đăng nhập hoặc email giáo viên'
                        : 'Nhập tên đăng nhập quản trị trường'
                    }
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="username"
                    textContentType="username"
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    style={{
                      height: 48,
                      borderRadius: 12,
                      borderWidth: 1.5,
                      borderColor: '#cbd5e1',
                      paddingHorizontal: 14,
                      backgroundColor: '#ffffff',
                      fontSize: 14,
                      color: '#0f172a',
                    }}
                  />
                </View>

                {/* Ô Mật khẩu */}
                <View style={{ gap: 6 }}>
                  <Text style={{ fontFamily: 'Manrope_700Bold', fontSize: 13, color: '#334155' }}>
                    Mật khẩu <Text style={{ color: '#ef4444' }}>*</Text>
                  </Text>
                  <View style={{ position: 'relative', justifyContent: 'center' }}>
                    <TextInput
                      ref={passwordRef}
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Nhập mật khẩu"
                      placeholderTextColor="#94a3b8"
                      secureTextEntry={!show}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="current-password"
                      textContentType="password"
                      returnKeyType="go"
                      onSubmitEditing={submitLogin}
                      style={{
                        height: 48,
                        borderRadius: 12,
                        borderWidth: 1.5,
                        borderColor: '#cbd5e1',
                        paddingLeft: 14,
                        paddingRight: 48,
                        backgroundColor: '#ffffff',
                        fontSize: 14,
                        color: '#0f172a',
                      }}
                    />
                    <Pressable
                      onPress={() => setShow(!show)}
                      style={{ position: 'absolute', right: 12, padding: 6 }}
                      accessibilityLabel={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {show ? <EyeOff size={18} color="#64748b" /> : <Eye size={18} color="#64748b" />}
                    </Pressable>
                  </View>
                </View>

                {/* Quên mật khẩu link */}
                <View style={{ alignItems: 'flex-end', marginTop: -2 }}>
                  <Pressable onPress={() => setForgot(true)}>
                    <Text style={{ fontFamily: 'Manrope_700Bold', fontSize: 13, color: '#16a34a' }}>
                      Quên mật khẩu?
                    </Text>
                  </Pressable>
                </View>

                {/* Lỗi đăng nhập */}
                {error && (
                  <Animated.View style={shake}>
                    <View style={{ flexDirection: 'row', gap: 8, padding: 12, borderRadius: 10, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca' }}>
                      <AlertTriangle size={16} color="#dc2626" style={{ marginTop: 2 }} />
                      <Txt f="bold" size={13} color="#b91c1c" style={{ flex: 1 }}>
                        {error}
                      </Txt>
                    </View>
                  </Animated.View>
                )}

                {/* Nút Đăng nhập dạng viên thuốc xanh lá (Ảnh 3) */}
                <Pressable
                  onPress={submitLogin}
                  disabled={loading}
                  style={({ pressed }) => ({
                    height: 50,
                    borderRadius: 9999,
                    backgroundColor: '#16a34a',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.9 : 1,
                    shadowColor: '#16a34a',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.25,
                    shadowRadius: 10,
                    elevation: 4,
                  })}
                  testID="login-submit"
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={{ fontFamily: 'Manrope_700Bold', fontSize: 16, color: '#ffffff' }}>
                      Đăng nhập
                    </Text>
                  )}
                </Pressable>

                {/* Đăng ký ngay */}
                <View style={{ alignItems: 'center', marginTop: 4 }}>
                  <Text style={{ fontSize: 14, color: '#475569' }}>
                    Bạn chưa có tài khoản Đông A?{' '}
                    <Text
                      onPress={() => {
                        setMode('signup');
                        setRegError(null);
                      }}
                      style={{ fontFamily: 'Manrope_700Bold', color: '#16a34a' }}
                    >
                      Đăng ký ngay
                    </Text>
                  </Text>
                </View>

                {/* Dải thông báo kích hoạt tài khoản (Ảnh 3) */}
                <Pressable
                  onPress={() => {
                    setMode('signup');
                    setSignupStep('otp');
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    borderRadius: 12,
                    backgroundColor: '#f0fdf4',
                    borderWidth: 1,
                    borderColor: '#bbf7d0',
                  }}
                >
                  <Info size={16} color="#16a34a" />
                  <Text style={{ fontSize: 13, color: '#15803d', flex: 1 }}>
                    <Text style={{ fontWeight: '700' }}>Tài khoản chưa kích hoạt?</Text> Nhập mã xác nhận tại đây
                  </Text>
                </Pressable>

                {GOOGLE_CLIENT_ID ? (
                  <View style={{ alignItems: 'center', marginTop: 4 }}>
                    <GoogleButton
                      onToken={async (idToken) => {
                        try {
                          const res = await authApi.loginWithGoogle(idToken);
                          onLogin(res.token, res.user);
                        } catch (err) {
                          setError(errorMessage(err, 'Đăng nhập Google thất bại.'));
                          setTries((n) => n + 1);
                        }
                      }}
                    />
                  </View>
                ) : null}

                {/* Liên kết mở cửa sổ đăng ký hoặc đăng ký tự học nếu cần */}
                {portal !== 'teacher' && (
                  <View style={{ alignItems: 'center' }}>
                    <Pressable onPress={() => setSignupModal(true)}>
                      <Txt size={12} color="#64748b">
                        Đăng ký tự học bằng cửa sổ phụ →
                      </Txt>
                    </Pressable>
                  </View>
                )}

                {/* Liên kết quản trị tổng */}
                <View style={{ alignItems: 'center', marginTop: 2 }}>
                  <Pressable onPress={() => router.replace('/admin')}>
                    <Txt size={12} color="#94a3b8">
                      Cổng Quản trị tổng →
                    </Txt>
                  </Pressable>
                </View>
              </View>
            ) : (
              // ---------------------- MÀN HÌNH ĐĂNG KÝ (Ảnh 4 & 5)
              <View style={{ gap: 14 }}>
                <View style={{ alignItems: 'center', gap: 4 }}>
                  <Txt f="displayHeavy" size={20} color="#0f172a" center>
                    Tham gia thế giới Hào Khí Đông A
                  </Txt>
                  <Txt size={13} color="#64748b" center>
                    Điền thông tin để tạo tài khoản
                  </Txt>
                </View>

                {/* Bạn là ai? với 3 Tab (Học sinh / Giáo viên / Nhà trường) */}
                <View style={{ gap: 6 }}>
                  <Txt f="bold" size={13} color="#475569">
                    Bạn là ai?
                  </Txt>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {ROLES_LIST.map(({ key, label, Icon }) => {
                      const isSel = selectedRole === key;
                      return (
                        <Pressable
                          key={key}
                          onPress={() => {
                            setSelectedRole(key);
                            setRegError(null);
                          }}
                          style={{
                            flex: 1,
                            alignItems: 'center',
                            justifyContent: 'center',
                            paddingVertical: 10,
                            paddingHorizontal: 6,
                            borderRadius: 12,
                            borderWidth: 1.5,
                            borderColor: isSel ? '#16a34a' : '#e2e8f0',
                            backgroundColor: isSel ? '#f0fdf4' : '#ffffff',
                            gap: 4,
                          }}
                        >
                          <Icon size={20} color={isSel ? '#16a34a' : '#64748b'} />
                          <Txt f="bold" size={12} color={isSel ? '#16a34a' : '#475569'}>
                            {label}
                          </Txt>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {selectedRole === 'student' ? (
                  signupStep === 'form' ? (
                    // Đăng ký Học sinh: Bước 1 (Ảnh 4)
                    <View style={{ gap: 12 }}>
                      {/* Họ tên */}
                      <View style={{ gap: 4 }}>
                        <Text style={{ fontFamily: 'Manrope_700Bold', fontSize: 13, color: '#334155' }}>
                          Họ tên <Text style={{ color: '#ef4444' }}>*</Text>
                        </Text>
                        <TextInput
                          value={regName}
                          onChangeText={setRegName}
                          placeholder="Nhập họ và tên"
                          placeholderTextColor="#94a3b8"
                          style={{
                            height: 44,
                            borderRadius: 10,
                            borderWidth: 1.5,
                            borderColor: '#cbd5e1',
                            paddingHorizontal: 12,
                            backgroundColor: '#ffffff',
                            fontSize: 14,
                            color: '#0f172a',
                          }}
                        />
                      </View>

                      {/* Email */}
                      <View style={{ gap: 4 }}>
                        <Text style={{ fontFamily: 'Manrope_700Bold', fontSize: 13, color: '#334155' }}>
                          Email <Text style={{ color: '#ef4444' }}>*</Text>
                        </Text>
                        <TextInput
                          value={regEmail}
                          onChangeText={setRegEmail}
                          placeholder="Nhập email để nhận mã xác thực"
                          placeholderTextColor="#94a3b8"
                          keyboardType="email-address"
                          autoCapitalize="none"
                          style={{
                            height: 44,
                            borderRadius: 10,
                            borderWidth: 1.5,
                            borderColor: '#cbd5e1',
                            paddingHorizontal: 12,
                            backgroundColor: '#ffffff',
                            fontSize: 14,
                            color: '#0f172a',
                          }}
                        />
                      </View>

                      {/* Mật khẩu & Nhập lại mật khẩu */}
                      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 8 }}>
                        <View style={{ flex: 1, gap: 4 }}>
                          <Text style={{ fontFamily: 'Manrope_700Bold', fontSize: 13, color: '#334155' }}>
                            Mật khẩu <Text style={{ color: '#ef4444' }}>*</Text>
                          </Text>
                          <TextInput
                            value={regPassword}
                            onChangeText={setRegPassword}
                            placeholder="Tối thiểu 8 ký tự"
                            placeholderTextColor="#94a3b8"
                            secureTextEntry
                            style={{
                              height: 44,
                              borderRadius: 10,
                              borderWidth: 1.5,
                              borderColor: '#cbd5e1',
                              paddingHorizontal: 12,
                              backgroundColor: '#ffffff',
                              fontSize: 14,
                              color: '#0f172a',
                            }}
                          />
                        </View>
                        <View style={{ flex: 1, gap: 4 }}>
                          <Text style={{ fontFamily: 'Manrope_700Bold', fontSize: 13, color: '#334155' }}>
                            Nhập lại mật khẩu <Text style={{ color: '#ef4444' }}>*</Text>
                          </Text>
                          <TextInput
                            value={regConfirm}
                            onChangeText={setRegConfirm}
                            placeholder="Nhập lại mật khẩu"
                            placeholderTextColor="#94a3b8"
                            secureTextEntry
                            style={{
                              height: 44,
                              borderRadius: 10,
                              borderWidth: 1.5,
                              borderColor: '#cbd5e1',
                              paddingHorizontal: 12,
                              backgroundColor: '#ffffff',
                              fontSize: 14,
                              color: '#0f172a',
                            }}
                          />
                        </View>
                      </View>

                      {/* Biệt danh (tùy chọn) */}
                      <View style={{ gap: 4 }}>
                        <Text style={{ fontFamily: 'Manrope_700Bold', fontSize: 13, color: '#334155' }}>
                          Biệt danh (không bắt buộc)
                        </Text>
                        <TextInput
                          value={regNick}
                          onChangeText={setRegNick}
                          placeholder="Hiển thị trên bảng vàng vinh danh"
                          placeholderTextColor="#94a3b8"
                          style={{
                            height: 44,
                            borderRadius: 10,
                            borderWidth: 1.5,
                            borderColor: '#cbd5e1',
                            paddingHorizontal: 12,
                            backgroundColor: '#ffffff',
                            fontSize: 14,
                            color: '#0f172a',
                          }}
                        />
                      </View>

                      {/* Checkbox điều khoản */}
                      <Pressable
                        onPress={() => setRegAgreed(!regAgreed)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}
                      >
                        <View
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 4,
                            borderWidth: 1.5,
                            borderColor: regAgreed ? '#16a34a' : '#94a3b8',
                            backgroundColor: regAgreed ? '#16a34a' : '#ffffff',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {regAgreed ? <Check size={12} color="#ffffff" strokeWidth={3} /> : null}
                        </View>
                        <Text style={{ fontSize: 13, color: '#475569', flex: 1 }}>
                          Tôi đồng ý với{' '}
                          <Text style={{ color: '#16a34a', fontWeight: '700' }}>Điều khoản sử dụng</Text> và{' '}
                          <Text style={{ color: '#16a34a', fontWeight: '700' }}>Chính sách bảo mật</Text>
                        </Text>
                      </Pressable>

                      {regError && (
                        <View style={{ padding: 10, borderRadius: 8, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca' }}>
                          <Txt f="bold" size={13} color="#b91c1c">
                            {regError}
                          </Txt>
                        </View>
                      )}

                      {/* Nút Đăng ký tài khoản (Ảnh 4) */}
                      <Pressable
                        onPress={handleRequestSignup}
                        disabled={regLoading}
                        style={({ pressed }) => ({
                          height: 48,
                          borderRadius: 9999,
                          backgroundColor: '#16a34a',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: pressed ? 0.9 : 1,
                          marginTop: 4,
                        })}
                      >
                        {regLoading ? (
                          <ActivityIndicator color="#ffffff" />
                        ) : (
                          <Text style={{ fontFamily: 'Manrope_700Bold', fontSize: 16, color: '#ffffff' }}>
                            Đăng ký tài khoản
                          </Text>
                        )}
                      </Pressable>
                    </View>
                  ) : (
                    // Đăng ký Học sinh: Bước 2 Nhập OTP
                    <View style={{ gap: 14 }}>
                      <View style={{ padding: 12, borderRadius: 10, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', gap: 4 }}>
                        <Txt f="bold" size={13} color="#15803d">
                          Mã xác thực 6 chữ số đã gửi tới {regEmail.trim()}
                        </Txt>
                        <Txt size={12} color="#166534">
                          Mã có hiệu lực trong 5 phút. Hãy kiểm tra cả hộp thư rác (Spam).
                        </Txt>
                      </View>

                      <View style={{ gap: 4 }}>
                        <Text style={{ fontFamily: 'Manrope_700Bold', fontSize: 13, color: '#334155' }}>
                          Mã xác thực OTP <Text style={{ color: '#ef4444' }}>*</Text>
                        </Text>
                        <TextInput
                          value={regOtp}
                          onChangeText={(v) => setRegOtp(v.replace(/\D/g, '').slice(0, 6))}
                          placeholder="Nhập 6 chữ số"
                          placeholderTextColor="#94a3b8"
                          keyboardType="number-pad"
                          maxLength={6}
                          style={{
                            height: 48,
                            borderRadius: 12,
                            borderWidth: 1.5,
                            borderColor: '#cbd5e1',
                            paddingHorizontal: 14,
                            backgroundColor: '#ffffff',
                            fontSize: 18,
                            fontWeight: '700',
                            letterSpacing: 4,
                            textAlign: 'center',
                            color: '#0f172a',
                          }}
                        />
                      </View>

                      {regError && (
                        <View style={{ padding: 10, borderRadius: 8, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca' }}>
                          <Txt f="bold" size={13} color="#b91c1c">
                            {regError}
                          </Txt>
                        </View>
                      )}

                      <Pressable
                        onPress={handleCompleteSignup}
                        disabled={regLoading}
                        style={({ pressed }) => ({
                          height: 48,
                          borderRadius: 9999,
                          backgroundColor: '#16a34a',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: pressed ? 0.9 : 1,
                        })}
                      >
                        {regLoading ? (
                          <ActivityIndicator color="#ffffff" />
                        ) : (
                          <Text style={{ fontFamily: 'Manrope_700Bold', fontSize: 16, color: '#ffffff' }}>
                            Xác thực & Tạo tài khoản
                          </Text>
                        )}
                      </Pressable>

                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Pressable onPress={() => setSignupStep('form')}>
                          <Text style={{ fontSize: 13, color: '#64748b' }}>← Nhập lại thông tin</Text>
                        </Pressable>
                        <Pressable onPress={handleRequestSignup}>
                          <Text style={{ fontSize: 13, color: '#16a34a', fontWeight: '700' }}>Gửi lại mã</Text>
                        </Pressable>
                      </View>
                    </View>
                  )
                ) : selectedRole === 'teacher' ? (
                  // Hướng dẫn Giáo viên (Ảnh 5)
                  <View style={{ padding: 18, borderRadius: 16, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', gap: 10, alignItems: 'center' }}>
                    <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#ecfdf5', alignItems: 'center', justifyContent: 'center' }}>
                      <Presentation size={24} color="#16a34a" />
                    </View>
                    <Txt f="bold" size={15} color="#0f172a" center>
                      Tài khoản Giáo viên
                    </Txt>
                    <Txt size={13} color="#475569" center style={{ lineHeight: 18 }}>
                      Tài khoản giáo viên do Quản trị viên Nhà trường cấp và phân quyền giảng dạy môn Lịch sử theo chương trình GDPT mới.
                    </Txt>
                    <Txt size={13} color="#64748b" center style={{ lineHeight: 18 }}>
                      Nếu thầy/cô chưa có tài khoản, vui lòng liên hệ Ban Giám hiệu hoặc Quản trị viên trường học của mình.
                    </Txt>
                    <Pressable
                      onPress={() => {
                        setMode('login');
                        setSelectedRole('teacher');
                      }}
                      style={{
                        marginTop: 6,
                        paddingVertical: 10,
                        paddingHorizontal: 20,
                        borderRadius: 9999,
                        backgroundColor: '#16a34a',
                      }}
                    >
                      <Text style={{ fontFamily: 'Manrope_700Bold', fontSize: 14, color: '#ffffff' }}>
                        Đã có tài khoản? Đăng nhập ngay
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  // Hướng dẫn Nhà trường (Ảnh 5)
                  <View style={{ padding: 18, borderRadius: 16, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', gap: 10, alignItems: 'center' }}>
                    <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' }}>
                      <School size={24} color="#0284c7" />
                    </View>
                    <Txt f="bold" size={15} color="#0f172a" center>
                      Tài khoản Quản trị Nhà trường
                    </Txt>
                    <Txt size={13} color="#475569" center style={{ lineHeight: 18 }}>
                      Hệ thống Quản lý Trường học Hào Khí Đông A dành cho các đơn vị giáo dục THCS & THPT toàn quốc.
                    </Txt>
                    <Txt size={13} color="#64748b" center style={{ lineHeight: 18 }}>
                      Để kích hoạt tài khoản Quản trị trường, vui lòng liên hệ ban quản trị qua email:{' '}
                      <Text style={{ fontWeight: '700', color: '#0284c7' }}>lienhe@dong-a.edu.vn</Text>
                    </Txt>
                    <Pressable
                      onPress={() => {
                        setMode('login');
                        setSelectedRole('school_admin');
                      }}
                      style={{
                        marginTop: 6,
                        paddingVertical: 10,
                        paddingHorizontal: 20,
                        borderRadius: 9999,
                        backgroundColor: '#0284c7',
                      }}
                    >
                      <Text style={{ fontFamily: 'Manrope_700Bold', fontSize: 14, color: '#ffffff' }}>
                        Đã có tài khoản? Đăng nhập ngay
                      </Text>
                    </Pressable>
                  </View>
                )}

                {/* Chuyển lại Đăng nhập */}
                <View style={{ alignItems: 'center', marginTop: 4 }}>
                  <Text style={{ fontSize: 14, color: '#475569' }}>
                    Bạn đã có tài khoản Đông A?{' '}
                    <Text
                      onPress={() => {
                        setMode('login');
                        setError(null);
                      }}
                      style={{ fontFamily: 'Manrope_700Bold', color: '#16a34a' }}
                    >
                      Đăng nhập tại đây
                    </Text>
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </Animated.ScrollView>

      {/* Sheet quên mật khẩu bằng OTP */}
      {forgot && (
        <ForgotPasswordSheet
          onClose={() => setForgot(false)}
          onDone={() => {
            setForgot(false);
            setFlash('Đã đặt lại mật khẩu. Hãy đăng nhập bằng mật khẩu mới.');
          }}
        />
      )}

      {/* Sheet đăng ký phụ nếu người dùng bấm đăng ký tự học */}
      {signupModal && (
        <SignupSheet
          onClose={() => setSignupModal(false)}
          onDone={(token, user) => {
            setSignupModal(false);
            onLogin(token, user);
          }}
        />
      )}
    </LinearGradient>
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
  const brand = useSystemBrand(session.token);
  const { width } = useWindowDimensions();
  const { user } = session;
  const isAdmin = user.role === 'root_admin' || user.role === 'school_admin';
  const [profile, setProfile] = useState(false);
  const loadProfile = useCallback(() => authApi.getProfile(session.token), [session.token]);
  const saveProfile = useCallback((patch: ProfilePatch) => authApi.updateProfile(session.token, patch), [session.token]);
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
