/**
 * Phiên đăng nhập theo từng trang: học sinh (/hoc-sinh), giáo viên (/giao-vien), quản trị tổng (/root-system-admin),
 * quản trị trường (/school-manager-admin); /portal đăng nhập chung cho giáo viên và học sinh. Hai cổng quản trị tách biệt:
 * không có nút hay liên kết về trang chủ. Mỗi trang giữ token riêng (kho bảo mật của điện thoại hoặc localStorage trên web).
 * Lần đầu đăng nhập bằng mật khẩu mặc định: màn hình chính bị khóa, cửa sổ bắt buộc đặt mật khẩu mới; đổi mật khẩu làm token cũ hết hiệu lực.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, View, useWindowDimensions, type TextInputInstance } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertTriangle, ChevronLeft, Eye, EyeOff, KeyRound, LogIn, LogOut, Presentation, ShieldCheck } from 'lucide-react-native';
import * as authApi from '@/api/authApi';
import { ApiError, errorMessage } from '@/api/client';
import { BrandLogo, KahootShape, Mascot } from '@/components/art';
import { Avatar, Btn, Card, Chip, Field, Inset, PaperBg, Sheet, Spinner, Txt, useToast } from '@/components/ui';
import { ANSWER_STYLES, LIVE_BG } from '@/constants/theme';
import { useShake } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';
import { readToken, saveToken } from '@/lib/storage';
import type { AuthRole, AuthUser, Portal } from '@/types/api';

export const PORTAL_PATH: Record<Portal, '/hoc-sinh' | '/giao-vien' | '/root-system-admin' | '/school-manager-admin'> = {
  student: '/hoc-sinh',
  teacher: '/giao-vien',
  root_admin: '/root-system-admin',
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

  if (checking) {
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
          <ChangePasswordForm user={user} token={token} forced onDone={saved} onCancel={() => end()} />
        </Sheet>
      </View>
    );
  }
  if (changing) return <ChangePasswordScreen user={user} token={token} forced={false} onDone={saved} onCancel={() => setChanging(false)} />;
  return (
    <>
      {children({
        token,
        user,
        logout: (msg = 'Đã đăng xuất. Hẹn gặp lại!') => end(msg),
        expired: () => end('Phiên đăng nhập đã hết hạn, hãy đăng nhập lại.'),
        changePassword: () => setChanging(true),
        updateUser: setUser,
      })}
    </>
  );
};

// ---------------------------------------------------------------------- đăng nhập
const PORTAL_THEME: Record<Portal | 'app', { heading: string; sub: string; tone: 'son' | 'ngoc' | 'dong'; placeholder: string; panel: readonly [string, string, ...string[]]; panelTitle: string; panelText: string }> = {
  app: {
    heading: 'Đăng nhập học tập',
    sub: 'Giáo viên và học sinh dùng tài khoản nhà trường cấp',
    tone: 'dong',
    placeholder: 'vd: anh.2374807022001@donga.local',
    panel: ['#ff9600', '#e07f00', '#b86400'],
    panelTitle: 'Học Sử vui như chơi',
    panelText: 'Một tài khoản cho cả giáo viên và học sinh: hệ thống tự đưa em tới đúng trang của mình.',
  },
  student: {
    heading: 'Học sinh đăng nhập',
    sub: 'Dùng tài khoản thầy cô / nhà trường cấp cho em',
    tone: 'son',
    placeholder: 'vd: long.nv',
    panel: ['#b91c1c', '#991b1b', '#7f1d1d'],
    panelTitle: 'Vào Điền Trang Đông A!',
    panelText: 'Xây căn cứ, chiêu mộ danh tướng nhà Trần và ra trận theo kế sách lịch sử – kiến thức là vũ khí.',
  },
  teacher: {
    heading: 'Giáo viên đăng nhập',
    sub: 'Dùng tài khoản quản trị viên nhà trường cấp',
    tone: 'ngoc',
    placeholder: 'vd: gv.hoa.tt',
    panel: LIVE_BG,
    panelTitle: 'Không gian giáo viên',
    panelText: 'Theo dõi tiến độ thật của học sinh, câu sai nhiều nhất và mức nắm vững theo chủ đề; tổ chức thi đấu trực tiếp và soạn đề bằng AI.',
  },
  root_admin: {
    heading: 'Quản trị tổng',
    sub: 'Toàn hệ thống: các trường, giáo viên, học sinh khối 6 – 9',
    tone: 'dong',
    placeholder: 'tên đăng nhập quản trị',
    panel: ['#1f2937', '#111827', '#0b1020'],
    panelTitle: 'Bảng điều khiển hệ thống',
    panelText: 'Theo dõi mọi trường, cấp tài khoản quản trị trường, duyệt lớp và xử lý thùng rác.',
  },
  school_admin: {
    heading: 'Quản trị trường',
    sub: 'Chỉ dữ liệu của trường bạn quản lý',
    tone: 'ngoc',
    placeholder: 'tên đăng nhập quản trị trường',
    panel: ['#3f9a00', '#2f7300', '#1f4d00'],
    panelTitle: 'Trường của bạn',
    panelText: 'Nhập file Excel mẫu để cấp tài khoản, theo dõi khối 6 – 9, duyệt lớp và gửi thông tin đăng nhập.',
  },
};

const PortalArt: React.FC<{ portal: Portal | 'app'; size?: number }> = ({ portal, size = 1 }) =>
  portal === 'student' || portal === 'app' ? (
    <Mascot size={190 * size} accessory="conical" mood="excited" bob />
  ) : portal === 'teacher' ? (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: 104 * size, height: 104 * size, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
        <Presentation size={60 * size} color="#ffffff" />
      </View>
      <Mascot size={104 * size} accessory="scholar" mood="happy" style={{ marginTop: -22 }} />
    </View>
  ) : (
    <View style={{ width: 104 * size, height: 104 * size, borderRadius: 28, backgroundColor: portal === 'school_admin' ? '#58cc02' : '#ff9600', alignItems: 'center', justifyContent: 'center', borderBottomWidth: 6, borderBottomColor: portal === 'school_admin' ? '#3f9a00' : '#c97500' }}>
      <ShieldCheck size={60 * size} color="#102b00" />
    </View>
  );

export const LoginScreen: React.FC<{ portal: Portal | 'app'; onLogin: (token: string, user: AuthUser) => void; notice?: string | null }> = ({ portal, onLogin, notice }) => {
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

  const admin = isAdminPortal(portal);
  const others = admin ? [] : (['student', 'teacher'] as Portal[]).filter((p) => p !== portal);

  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      <PaperBg />
      {wide && (
        <LinearGradient colors={theme.panel} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, padding: 40, justifyContent: 'space-between', overflow: 'hidden' }}>
          {portal === 'teacher' &&
            ANSWER_STYLES.map((s, i) => (
              <View key={s.shape} pointerEvents="none" style={{ position: 'absolute', left: `${12 + i * 22}%`, top: `${i % 2 ? 72 : 16}%` }}>
                <KahootShape shape={s.shape} size={44 + i * 6} color={s.bg} />
              </View>
            ))}
          {admin ? (
            <View style={{ alignSelf: 'flex-start' }}>
              <BrandLogo light subtitle={PORTAL_TITLE[portal]} />
            </View>
          ) : (
            <Pressable onPress={() => router.replace('/')} accessibilityRole="link" accessibilityLabel="Về trang chủ" style={{ alignSelf: 'flex-start' }}>
              <BrandLogo light subtitle={PORTAL_TITLE[portal]} />
            </Pressable>
          )}
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
            © Đông A EDU · Lịch sử và Địa lí THCS
          </Txt>
        </LinearGradient>
      )}
      <View style={{ flex: 1, maxWidth: wide ? 560 : undefined }}>
        <Animated.ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20, paddingVertical: 40 }} keyboardShouldPersistTaps="handled">
          <View style={{ width: '100%', maxWidth: 400, alignSelf: 'center', gap: 14 }}>
            {!admin && <Btn title="Trang chủ" icon={ChevronLeft} tone="ghost" size="sm" onPress={() => router.replace('/')} />}
            {!wide && (
              <View style={{ alignItems: 'center' }}>
                <PortalArt portal={portal} size={0.7} />
              </View>
            )}
            <Chip
              text={PORTAL_TITLE[portal].toUpperCase()}
              bg={portal === 'student' ? c.sonNhat : portal === 'teacher' || portal === 'school_admin' ? c.ngocNhat : c.dongNhat}
              fg={portal === 'student' ? c.sonChu : portal === 'teacher' || portal === 'school_admin' ? c.ngocChu : c.dongChu}
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
            {notice && (
              <Inset style={{ backgroundColor: c.thuyNhat }}>
                <Txt f="bold" size={14} color={c.thuyChu} accessibilityLiveRegion="polite">
                  {notice}
                </Txt>
              </Inset>
            )}
            <Field
              label="Tên đăng nhập"
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
              {admin ? (
                <Txt size={14} color={c.muc2}>
                  {portal === 'root_admin' ? 'Trang này chỉ dành cho quản trị tổng của hệ thống.' : 'Trang này chỉ dành cho quản trị viên được cấp quyền của trường.'}
                </Txt>
              ) : (
                <>
                  <Txt size={14} color={c.muc2}>
                    <Txt f="bold" size={14}>
                      Chưa có tài khoản?{' '}
                    </Txt>
                    Tài khoản do quản trị viên nhà trường cấp.
                  </Txt>
                  <Txt size={14} color={c.muc2}>
                    <Txt f="bold" size={14}>
                      Quên mật khẩu?{' '}
                    </Txt>
                    Nhờ quản trị viên đặt lại mật khẩu tạm.
                  </Txt>
                </>
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
    </View>
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
    if (next.length < 6) return setError('Mật khẩu mới cần ít nhất 6 ký tự.');
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
      <Field label="Mật khẩu mới (tối thiểu 6 ký tự)" nativeID="cp-new" value={next} onChangeText={setNext} secureTextEntry={!show} autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" />
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
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: c.the, borderBottomWidth: 2, borderBottomColor: c.vien }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
        <BrandLogo compact={width < 520} subtitle={isAdmin ? ROLE_LABEL[user.role] : 'Trang giáo viên'} />
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
        <Btn tone="giay" size="sm" icon={KeyRound} label="Đổi mật khẩu" onPress={session.changePassword} />
        <Btn tone="giay" size="sm" icon={LogOut} title={width >= 520 ? 'Đăng xuất' : undefined} label="Đăng xuất" onPress={() => session.logout()} />
      </View>
    </View>
  );
};
