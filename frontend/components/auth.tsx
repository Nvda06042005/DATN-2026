/**
 * Phiên đăng nhập theo từng trang: học sinh (/hoc-sinh), giáo viên (/giao-vien), quản trị (/admin).
 * Mỗi trang giữ token riêng (kho bảo mật của điện thoại hoặc localStorage trên web). Lần đầu đăng nhập bằng mật khẩu tạm
 * phải đặt mật khẩu mới; đổi mật khẩu làm token cũ hết hiệu lực.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, View, useWindowDimensions, type TextInputInstance } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertTriangle, ChevronLeft, Eye, EyeOff, KeyRound, LogIn, LogOut, Presentation, ShieldCheck } from 'lucide-react-native';
import * as authApi from '@/api/authApi';
import { ApiError, errorMessage } from '@/api/client';
import { BrandLogo, KahootShape, Mascot } from '@/components/art';
import { Avatar, Btn, Card, Chip, Field, Inset, PaperBg, Spinner, Txt, useToast } from '@/components/ui';
import { ANSWER_STYLES, LIVE_BG } from '@/constants/theme';
import { useShake } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';
import { readToken, saveToken } from '@/lib/storage';
import type { AuthRole, AuthUser, Portal } from '@/types/api';

export const PORTAL_PATH: Record<Portal, '/hoc-sinh' | '/giao-vien' | '/admin'> = { student: '/hoc-sinh', teacher: '/giao-vien', admin: '/admin' };
export const PORTAL_TITLE: Record<Portal, string> = { student: 'Trang học sinh', teacher: 'Trang giáo viên', admin: 'Trang quản trị' };
export const ROLE_LABEL: Record<AuthRole, string> = { admin: 'Quản trị viên', teacher: 'Giáo viên', student: 'Học sinh' };

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
}

/** Bọc một trang: khôi phục phiên đã lưu, đăng nhập, đổi mật khẩu bắt buộc, rồi mới vẽ nội dung */
export const PortalApp: React.FC<{ portal: Portal; children: (session: Session) => React.ReactNode }> = ({ portal, children }) => {
  const toast = useToast();
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
  if (user.must_change_password || changing) {
    return (
      <ChangePasswordScreen
        user={user}
        token={token}
        forced={user.must_change_password}
        onDone={(t, u) => {
          start(t, u);
          setChanging(false);
          toast('Đã lưu mật khẩu mới');
        }}
        onCancel={() => (user.must_change_password ? end() : setChanging(false))}
      />
    );
  }
  return (
    <>
      {children({
        token,
        user,
        logout: (msg = 'Đã đăng xuất. Hẹn gặp lại!') => end(msg),
        expired: () => end('Phiên đăng nhập đã hết hạn, hãy đăng nhập lại.'),
        changePassword: () => setChanging(true),
      })}
    </>
  );
};

// ---------------------------------------------------------------------- đăng nhập
const PORTAL_THEME: Record<Portal, { heading: string; sub: string; tone: 'son' | 'ngoc' | 'dong'; placeholder: string; panel: readonly [string, string, ...string[]]; panelTitle: string; panelText: string }> = {
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
  admin: {
    heading: 'Quản trị viên',
    sub: 'Đăng nhập để cấp và quản lý tài khoản',
    tone: 'dong',
    placeholder: 'admin',
    panel: ['#1f2937', '#111827', '#0b1020'],
    panelTitle: 'Trang quản trị Đông A',
    panelText: 'Cấp tài khoản cho giáo viên và học sinh, theo dõi tiến độ học tập thật của toàn trường.',
  },
};

const PortalArt: React.FC<{ portal: Portal; size?: number }> = ({ portal, size = 1 }) =>
  portal === 'student' ? (
    <Mascot size={190 * size} accessory="conical" mood="excited" bob />
  ) : portal === 'teacher' ? (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: 104 * size, height: 104 * size, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
        <Presentation size={60 * size} color="#ffffff" />
      </View>
      <Mascot size={104 * size} accessory="scholar" mood="happy" style={{ marginTop: -22 }} />
    </View>
  ) : (
    <View style={{ width: 104 * size, height: 104 * size, borderRadius: 28, backgroundColor: '#d97706', alignItems: 'center', justifyContent: 'center', borderBottomWidth: 6, borderBottomColor: '#92400e' }}>
      <ShieldCheck size={60 * size} color="#6b4400" />
    </View>
  );

export const LoginScreen: React.FC<{ portal: Portal; onLogin: (token: string, user: AuthUser) => void; notice?: string | null }> = ({ portal, onLogin, notice }) => {
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

  const others = (['student', 'teacher'] as Portal[]).filter((p) => p !== portal);

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
            © Đông A EDU · Lịch sử và Địa lí 7
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
            <Chip text={PORTAL_TITLE[portal].toUpperCase()} bg={portal === 'student' ? c.sonNhat : portal === 'teacher' ? c.ngocNhat : c.dongNhat} fg={portal === 'student' ? c.sonChu : portal === 'teacher' ? c.ngocDam : c.dongChu} style={{ alignSelf: 'center' }} />
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
              {portal === 'admin' ? (
                <Txt size={14} color={c.muc2}>
                  Trang này chỉ dành cho quản trị viên nhà trường.
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
export const ChangePasswordScreen: React.FC<{ user: AuthUser; token: string; forced: boolean; onDone: (token: string, user: AuthUser) => void; onCancel: () => void }> = ({
  user, token, forced, onDone, onCancel,
}) => {
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
    <View style={{ flex: 1 }}>
      <PaperBg />
      <Animated.ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 16, paddingVertical: 40 }} keyboardShouldPersistTaps="handled">
        <Card pad={24} style={{ width: '100%', maxWidth: 460, alignSelf: 'center', gap: 14 }}>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Mascot size={96} mood="thinking" accessory="scholar" />
            <Txt f="displayHeavy" size={24} center accessibilityRole="header">
              {forced ? 'Đặt mật khẩu mới' : 'Đổi mật khẩu'}
            </Txt>
            <Txt f="semibold" size={14} color={c.muc2} center>
              {forced ? `Chào ${user.full_name}! Đây là lần đăng nhập đầu tiên với mật khẩu tạm – hãy đặt mật khẩu của riêng mình.` : `Tài khoản: ${user.username}`}
            </Txt>
          </View>
          <Field label={forced ? 'Mật khẩu tạm được cấp' : 'Mật khẩu hiện tại'} nativeID="cp-current" value={current} onChangeText={setCurrent} secureTextEntry={!show} autoCapitalize="none" autoComplete="current-password" />
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
        </Card>
      </Animated.ScrollView>
    </View>
  );
};

// ---------------------------------------------------------------------- thanh trên cùng (giáo viên, quản trị)
export const TopBar: React.FC<{ session: Session; subtitle: string }> = ({ session, subtitle }) => {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const { user } = session;
  const isAdmin = user.role === 'admin';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: c.the, borderBottomWidth: 2, borderBottomColor: c.vien }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
        <BrandLogo compact={width < 520} subtitle={isAdmin ? 'Trang quản trị' : 'Trang giáo viên'} />
        {width >= 900 && (
          <Txt f="semibold" size={13} color={c.muc3} numberOfLines={1} style={{ flex: 1 }}>
            {subtitle}
          </Txt>
        )}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
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
