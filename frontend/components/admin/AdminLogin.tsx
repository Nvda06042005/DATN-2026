/**
 * Trang đăng nhập của hai cổng quản trị (/admin, /school-manager-admin), dựng theo danh sách chức năng nhóm "01. Tài khoản và xác thực":
 * TM.AUTH.001 đăng nhập bằng tài khoản được cấp (không có đăng ký tự do), TM.AUTH.007 quên mật khẩu (gửi liên kết đặt lại qua email,
 * liên kết mở lại đúng cổng bằng ?reset=<mã>). TM.AUTH.002 đăng xuất là nút ở thanh trên cùng của trang quản trị (TopBar trong auth.tsx).
 * Bố cục hai cột như trang đăng nhập của LMS: bên trái giới thiệu cổng trên nền xanh đậm, bên phải biểu mẫu trên nền trắng;
 * dưới 1000 px chỉ còn một cột. Cổng quản trị độc lập: không có nút hay liên kết về trang chủ hoặc cổng khác.
 */
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Animated, Platform, Pressable, StyleSheet, TextInput, View, useWindowDimensions, type TextInputInstance, type TextInputProps } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { ArrowLeft, CircleCheck, ClipboardCheck, Eye, EyeOff, FileSpreadsheet, Info, LogIn, MailCheck, School, ShieldCheck, TriangleAlert } from 'lucide-react-native';
import * as authApi from '@/api/authApi';
import { ApiError, errorMessage } from '@/api/client';
import { BrandLogo } from '@/components/art';
import { Txt } from '@/components/ui';
import { FONT } from '@/constants/theme';
import { useShake } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';
import type { AuthUser } from '@/types/api';
import type { IconType } from '@/types/game';

export type AdminPortal = 'root_admin' | 'school_admin';
type Step = 'login' | 'forgot' | 'reset';

const COPY: Record<AdminPortal, { label: string; headline: string; accent: string; lead: string; placeholder: string; account: string; features: Array<{ icon: IconType; title: string; text: string }> }> = {
  root_admin: {
    label: 'Quản trị tổng',
    headline: 'Cổng quản trị',
    accent: 'toàn hệ thống',
    lead: 'Theo dõi mọi trường, cấp tài khoản quản trị trường, duyệt lớp và xử lý thùng rác tại một nơi.',
    placeholder: 'Tên đăng nhập quản trị',
    account: 'Tài khoản quản trị tổng được cấu hình khi triển khai hệ thống, không có đăng ký tự do.',
    features: [
      { icon: School, title: 'Toàn hệ thống', text: 'Xem các trường, giáo viên và học sinh khối 6 – 9.' },
      { icon: ShieldCheck, title: 'Phân quyền quản trị trường', text: 'Tạo và quản lý tài khoản quản trị của từng trường.' },
      { icon: ClipboardCheck, title: 'Duyệt lớp, thùng rác 45 ngày', text: 'Xem xét yêu cầu mở lớp và khôi phục tài khoản đã xóa.' },
    ],
  },
  school_admin: {
    label: 'Quản trị trường',
    headline: 'Cổng quản trị',
    accent: 'của trường bạn',
    lead: 'Cấp tài khoản cho giáo viên và học sinh, duyệt lớp và theo dõi dữ liệu của riêng trường mình.',
    placeholder: 'Tên đăng nhập quản trị trường',
    account: 'Tài khoản quản trị trường do quản trị tổng cấp, không có đăng ký tự do.',
    features: [
      { icon: FileSpreadsheet, title: 'Cấp tài khoản bằng Excel', text: 'Nhập file mẫu để tạo tài khoản hàng loạt.' },
      { icon: School, title: 'Dữ liệu của trường bạn', text: 'Chỉ xem và quản lý dữ liệu thuộc trường mình, khối 6 – 9.' },
      { icon: ClipboardCheck, title: 'Duyệt lớp, gửi thông tin đăng nhập', text: 'Xem xét yêu cầu mở lớp và gửi tài khoản qua email.' },
    ],
  },
};

// ---------------------------------------------------------------------- thành phần nhỏ
const Banner: React.FC<{ tone: 'error' | 'success' | 'info'; text: string }> = ({ tone, text }) => {
  const { c } = useTheme();
  const t = tone === 'error' ? { bg: c.sonNhat, fg: c.sonChu, Icon: TriangleAlert } : tone === 'success' ? { bg: c.mocNhat, fg: c.mocChu, Icon: CircleCheck } : { bg: c.thuyNhat, fg: c.thuyChu, Icon: Info };
  return (
    <View style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: 10, backgroundColor: t.bg }}>
      <t.Icon size={18} color={t.fg} style={{ marginTop: 1 }} />
      <Txt f="semibold" size={14} color={t.fg} style={{ flex: 1 }} accessibilityRole={tone === 'error' ? 'alert' : undefined} accessibilityLiveRegion="polite">
        {text}
      </Txt>
    </View>
  );
};

type InputProps = Omit<TextInputProps, 'style'> & {
  label: string;
  nativeID: string;
  invalid?: boolean;
  hint?: string;
  inputRef?: React.Ref<TextInputInstance>;
  /** Liên kết cạnh nhãn (ví dụ "Quên mật khẩu?") */
  labelRight?: React.ReactNode;
  /** Nút trong ô (ví dụ hiện/ẩn mật khẩu) */
  right?: React.ReactNode;
};

/** Ô nhập phẳng: nhãn luôn hiện phía trên, viền đủ tương phản, vòng sáng khi đang nhập */
const AuthInput: React.FC<InputProps> = ({ label, nativeID, invalid, hint, inputRef, labelRight, right, ...rest }) => {
  const { c } = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Txt f="bold" size={14} color={c.xanhMuc}>
          {label}
        </Txt>
        {labelRight}
      </View>
      <View>
        <TextInput
          ref={inputRef}
          nativeID={nativeID}
          accessibilityLabel={label}
          placeholderTextColor={c.muc3}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={[
            {
              minHeight: 48,
              borderRadius: 10,
              borderWidth: 1.5,
              borderColor: invalid ? c.son : focus ? c.troi : c.bienDam,
              backgroundColor: c.the,
              paddingHorizontal: 14,
              paddingRight: right ? 52 : 14,
              fontFamily: FONT.semibold,
              fontSize: 16,
              color: c.xanhMuc,
            },
            focus && { boxShadow: `0 0 0 3px ${invalid ? 'rgba(185, 28, 28, 0.2)' : 'rgba(11, 108, 192, 0.22)'}` },
            // Trình duyệt vẽ thêm viền mặc định khi nhập: vòng sáng ở trên đã thay thế
            Platform.OS === 'web' && { outlineStyle: 'solid', outlineWidth: 0 },
          ]}
          {...rest}
        />
        {right ? <View style={{ position: 'absolute', right: 2, top: 0, bottom: 0, justifyContent: 'center' }}>{right}</View> : null}
      </View>
      {hint ? (
        <Txt size={13} color={c.xanhMuc2}>
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
    <Pressable onPress={onToggle} accessibilityRole="button" accessibilityLabel={shown ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} accessibilityState={{ selected: shown }} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={20} color={c.xanhMuc2} />
    </Pressable>
  );
};

const SubmitButton: React.FC<{ title: string; icon?: IconType; loading?: boolean; onPress: () => void; testID?: string }> = ({ title, icon: Icon, loading = false, onPress, testID }) => {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: loading, busy: loading }}
      style={({ pressed }) => ({ minHeight: 48, borderRadius: 10, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: pressed ? c.bau : c.troi, opacity: loading ? 0.8 : 1 })}
    >
      {loading ? <ActivityIndicator size="small" color={c.trang} /> : Icon ? <Icon size={20} color={c.trang} strokeWidth={2.4} /> : null}
      <Txt f="bold" size={16} color={c.trang}>
        {title}
      </Txt>
    </Pressable>
  );
};

const TextLink: React.FC<{ title: string; onPress: () => void; icon?: IconType; label?: string }> = ({ title, onPress, icon: Icon, label }) => {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="link" accessibilityLabel={label ?? title} hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
      {Icon ? <Icon size={16} color={c.troi} strokeWidth={2.4} /> : null}
      <Txt f="bold" size={14} color={c.troi}>
        {title}
      </Txt>
    </Pressable>
  );
};

const Heading: React.FC<{ title: string; text: string }> = ({ title, text }) => {
  const { c } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Txt f="heavy" size={30} color={c.xanhMuc} accessibilityRole="header" style={{ lineHeight: 36 }}>
        {title}
      </Txt>
      <Txt size={15} color={c.xanhMuc2}>
        {text}
      </Txt>
    </View>
  );
};

// ---------------------------------------------------------------------- khung hai cột
const Shell: React.FC<{ portal: AdminPortal; children: React.ReactNode }> = ({ portal, children }) => {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 1000;
  const copy = COPY[portal];
  const night = [c.bau, c.dem] as const;
  return (
    <View style={{ flex: 1, flexDirection: wide ? 'row' : 'column', backgroundColor: c.the }}>
      {wide ? (
        <LinearGradient colors={night} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, padding: 48, justifyContent: 'space-between', overflow: 'hidden' }}>
          <Svg accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" width="100%" height="100%" viewBox="0 0 640 860" preserveAspectRatio="xMidYMax slice" style={StyleSheet.absoluteFill}>
            {[110, 190, 270, 350, 430].map((r) => (
              <Circle key={`a${r}`} cx={600} cy={820} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={2} />
            ))}
            {[70, 140, 210].map((r) => (
              <Circle key={`b${r}`} cx={20} cy={30} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={2} />
            ))}
          </Svg>
          <BrandLogo light subtitle={copy.label} />
          <View style={{ gap: 20, maxWidth: 520 }}>
            <View>
              <Txt f="heavy" size={42} color={c.trang} style={{ lineHeight: 50 }} accessibilityRole="header">
                {copy.headline}
              </Txt>
              <Txt f="serifItalic" size={42} color={c.logoGold} style={{ lineHeight: 50 }}>
                {copy.accent}
              </Txt>
            </View>
            <Txt size={17} color="rgba(255, 255, 255, 0.85)">
              {copy.lead}
            </Txt>
            <View style={{ gap: 16, marginTop: 8 }}>
              {copy.features.map(({ icon: Icon, title, text }) => (
                <View key={title} style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 255, 255, 0.10)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)' }}>
                    <Icon size={20} color={c.logoGold} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt f="bold" size={15} color={c.trang}>
                      {title}
                    </Txt>
                    <Txt size={14} color="rgba(255, 255, 255, 0.78)">
                      {text}
                    </Txt>
                  </View>
                </View>
              ))}
            </View>
          </View>
          <Txt f="semibold" size={12} color="rgba(255, 255, 255, 0.7)">
            © 2026 · Đông A edu
          </Txt>
        </LinearGradient>
      ) : (
        <LinearGradient colors={night} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingHorizontal: 20, paddingVertical: 16 }}>
          <BrandLogo light subtitle={copy.label} />
        </LinearGradient>
      )}
      {/* ScrollView tự giãn theo flex nên đặt độ rộng cột phải ở khung ngoài */}
      <View style={wide ? { width: Math.max(480, Math.min(600, Math.round(width * 0.42))) } : { flex: 1 }}>
        <Animated.ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, justifyContent: wide ? 'center' : 'flex-start', padding: wide ? 48 : 20, paddingVertical: wide ? 48 : 32 }} keyboardShouldPersistTaps="handled">
          <View style={{ width: '100%', maxWidth: 400, alignSelf: 'center', gap: 20 }}>{children}</View>
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
      <Heading title="Đăng nhập" text="Dùng tài khoản được cấp để vào cổng quản trị." />
      {success ? <Banner tone="success" text={success} /> : null}
      {notice ? <Banner tone="info" text={notice} /> : null}
      <AuthInput
        label="Tên đăng nhập"
        nativeID="admin-username"
        value={username}
        onChangeText={setUsername}
        placeholder={copy.placeholder}
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
        placeholder="Nhập mật khẩu"
        invalid={Boolean(error) && !password}
        secureTextEntry={!show}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
        labelRight={<TextLink title="Quên mật khẩu?" onPress={onForgot} />}
        right={<ShowToggle shown={show} onToggle={() => setShow((v) => !v)} />}
      />
      {error ? (
        <Animated.View style={shake}>
          <Banner tone="error" text={error} />
        </Animated.View>
      ) : null}
      <SubmitButton title={loading ? 'Đang đăng nhập…' : 'Đăng nhập'} icon={LogIn} loading={loading} onPress={submit} testID="login-submit" />
      <View style={{ borderTopWidth: 1, borderTopColor: c.bienXanh, paddingTop: 16 }}>
        <Txt size={13} color={c.xanhMuc2}>
          {copy.account}
        </Txt>
      </View>
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
        <SubmitButton title="Quay lại đăng nhập" icon={ArrowLeft} onPress={onBack} />
        <TextLink title="Chưa nhận được thư? Gửi lại" onPress={() => setSent(false)} />
      </>
    );
  }
  return (
    <>
      <TextLink title="Quay lại đăng nhập" icon={ArrowLeft} onPress={onBack} />
      <Heading title="Quên mật khẩu?" text="Nhập tên đăng nhập hoặc email của tài khoản quản trị. Chúng tôi sẽ gửi liên kết đặt lại mật khẩu tới email của tài khoản." />
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
      <SubmitButton title={loading ? 'Đang gửi…' : 'Gửi liên kết đặt lại'} icon={MailCheck} loading={loading} onPress={submit} testID="forgot-submit" />
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
      <SubmitButton title={loading ? 'Đang lưu…' : 'Lưu mật khẩu mới'} icon={ShieldCheck} loading={loading} onPress={submit} testID="reset-submit" />
      {dead ? <TextLink title="Yêu cầu liên kết mới" icon={MailCheck} onPress={onRequestNew} /> : null}
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
