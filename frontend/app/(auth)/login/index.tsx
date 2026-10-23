import React, { useState } from 'react';
import { AlertTriangle, ChevronLeft, Eye, EyeOff, Loader2, Lock, Presentation, ShieldCheck, User } from 'lucide-react';
import * as authApi from '@/api/authApi';
import { BrandLogo } from '@/components/customs/BrandLogo';
import { KahootShape } from '@/components/customs/KahootShape';
import { Mascot } from '@/components/customs/Mascot';
import { PORTAL_TITLE } from '@/constants/routes';
import { ANSWER_STYLES } from '@/constants/theme';
import { goTo } from '@/lib/router';
import type { AuthUser, Portal } from '@/types/authType';

const PORTAL_THEME: Record<
  Portal,
  { heading: string; sub: string; btn: string; chip: string; placeholder: string; panel: string; panelTitle: string; panelText: string }
> = {
  student: {
    heading: 'Học sinh đăng nhập',
    sub: 'Dùng tài khoản thầy cô / nhà trường cấp cho em',
    btn: 'btn-red',
    chip: 'bg-son-nhat text-son-chu',
    placeholder: 'vd: long.nv',
    panel: 'bg-gradient-to-br from-[#b91c1c] via-[#991b1b] to-[#7f1d1d]',
    panelTitle: 'Vào Điền Trang Đông A!',
    panelText: 'Xây căn cứ, chiêu mộ danh tướng nhà Trần và ra trận theo kế sách lịch sử – kiến thức là vũ khí.',
  },
  teacher: {
    heading: 'Giáo viên đăng nhập',
    sub: 'Dùng tài khoản quản trị viên nhà trường cấp',
    btn: 'btn-purple',
    chip: 'bg-duo-purple-light text-kh-purple',
    placeholder: 'vd: gv.hoa.tt',
    panel: 'kahoot-bg',
    panelTitle: 'Không gian giáo viên',
    panelText: 'Theo dõi tiến độ thật của học sinh, câu sai nhiều nhất và mức nắm vững theo chủ đề; tổ chức thi đấu trực tiếp và soạn đề bằng AI.',
  },
  admin: {
    heading: 'Quản trị viên',
    sub: 'Đăng nhập để cấp và quản lý tài khoản',
    btn: 'btn-gold',
    chip: 'bg-duo-gold-light text-duo-gold-dark',
    placeholder: 'admin',
    panel: 'bg-gradient-to-br from-[#1f2937] via-[#111827] to-[#0b1020]',
    panelTitle: 'Trang quản trị Đông A',
    panelText: 'Cấp tài khoản cho giáo viên và học sinh, theo dõi tiến độ học tập thật của toàn trường.',
  },
};

export const LoginScreen: React.FC<{ portal: Portal; onLogin: (token: string, user: AuthUser) => void; notice?: string | null }> = ({ portal, onLogin, notice }) => {
  const theme = PORTAL_THEME[portal];
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Hãy nhập tên đăng nhập và mật khẩu.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.loginToPortal(username.trim(), password, portal);
      onLogin(res.token, res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại.');
    } finally {
      setLoading(false);
    }
  };

  const panelIcon =
    portal === 'student' ? (
      <Mascot size={210} accessory="conical" mood="excited" bob />
    ) : portal === 'teacher' ? (
      <div className="flex flex-col items-center">
        <div className="w-28 h-28 rounded-3xl bg-white/15 flex items-center justify-center">
          <Presentation className="w-16 h-16 text-white" />
        </div>
        <Mascot size={110} accessory="scholar" mood="happy" className="-mt-6" />
      </div>
    ) : (
      <div className="w-28 h-28 rounded-3xl bg-duo-gold flex items-center justify-center shadow-[0_6px_0_#92400e]">
        <ShieldCheck className="w-16 h-16 text-[#6b4400]" />
      </div>
    );

  const others = (['student', 'teacher'] as Portal[]).filter((p) => p !== portal);

  return (
    <div className="min-h-screen w-full flex paper-bg">
      {/* Minh họa bên trái */}
      <div className={`hidden lg:flex flex-1 ${theme.panel} text-white relative overflow-hidden flex-col justify-between p-10`}>
        {portal === 'teacher' && (
          <div className="absolute inset-0 pointer-events-none">
            {ANSWER_STYLES.map((s, i) => (
              <div key={s.shape} className="absolute animate-float-slow" style={{ left: `${12 + i * 22}%`, top: `${i % 2 ? 72 : 16}%`, animationDelay: `${i * 0.5}s` }}>
                <KahootShape shape={s.shape} size={44 + i * 6} color={s.bg} />
              </div>
            ))}
          </div>
        )}
        {portal === 'student' && (
          <>
            <div className="absolute top-44 left-[10%] w-28 h-9 bg-white/25 rounded-full animate-float-slow" />
            <div className="absolute top-32 right-[14%] w-36 h-11 bg-white/20 rounded-full animate-float-slow" style={{ animationDelay: '1s' }} />
          </>
        )}
        {portal === 'admin' && (
          <>
            <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-duo-gold/10" />
            <div className="absolute -bottom-32 -left-20 w-[28rem] h-[28rem] rounded-full bg-duo-green/10" />
          </>
        )}
        <button onClick={() => goTo('home')} className="relative w-fit" title="Về trang chủ">
          <BrandLogo tone="white" subtitle={PORTAL_TITLE[portal]} />
        </button>
        <div className="relative flex flex-col items-center text-center">
          {panelIcon}
          <h2 className="text-3xl font-black mt-6 leading-tight">{theme.panelTitle}</h2>
          <p className="text-white/80 font-bold mt-2 max-w-md">{theme.panelText}</p>
        </div>
        <p className="relative text-xs font-bold text-white/75">© Đông A EDU · Lịch sử và Địa lí 7</p>
      </div>

      {/* Biểu mẫu */}
      <div className="flex-1 lg:max-w-xl flex items-center justify-center px-5 py-10">
        <form onSubmit={submit} className="w-full max-w-sm">
          <button type="button" onClick={() => goTo('home')} className="text-sm font-black text-duo-hare hover:text-duo-wolf mb-6 flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" /> Trang chủ
          </button>
          <div className="lg:hidden flex flex-col items-center mb-5">{panelIcon}</div>
          <span className={`chip ${theme.chip} mx-auto flex w-fit mb-2 uppercase`}>{PORTAL_TITLE[portal]}</span>
          <h1 className="text-3xl font-black text-duo-ink text-center">{theme.heading}</h1>
          <p className="text-sm font-bold text-duo-wolf text-center mt-1 mb-6">{theme.sub}</p>

          {notice && <div className="mb-4 rounded-2xl bg-duo-blue-light text-duo-blue-dark font-bold text-sm px-4 py-3">{notice}</div>}

          <label className="block text-xs font-black text-duo-wolf uppercase tracking-wider mb-1.5" htmlFor="login-username">
            Tên đăng nhập
          </label>
          <div className="relative mb-4">
            <User className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-duo-hare" />
            <input
              id="login-username"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={theme.placeholder}
              className="input-duo !pl-11 !py-3"
            />
          </div>

          <label className="block text-xs font-black text-duo-wolf uppercase tracking-wider mb-1.5" htmlFor="login-password">
            Mật khẩu
          </label>
          <div className="relative mb-4">
            <Lock className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-duo-hare" />
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mật khẩu"
              className="input-duo !pl-11 !pr-11 !py-3"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-duo-hare hover:text-duo-wolf"
              title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          {error && (
            <div role="alert" className="mb-4 rounded-2xl bg-duo-red-light text-duo-red-dark font-bold text-sm px-4 py-3 flex items-start gap-2 animate-shake">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
            </div>
          )}

          <button type="submit" disabled={loading} className={`btn-3d btn-lg w-full ${theme.btn}`}>
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>

          <div className="mt-6 rounded-2xl bg-duo-polar p-4 text-sm font-semibold text-duo-wolf leading-relaxed">
            {portal === 'admin' ? (
              <p>Trang này chỉ dành cho quản trị viên nhà trường.</p>
            ) : (
              <>
                <p>
                  <strong className="text-duo-ink">Chưa có tài khoản?</strong> Tài khoản do quản trị viên nhà trường cấp.
                </p>
                <p className="mt-1">
                  <strong className="text-duo-ink">Quên mật khẩu?</strong> Nhờ quản trị viên đặt lại mật khẩu tạm.
                </p>
              </>
            )}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {others.map((p) => (
                <button key={p} type="button" onClick={() => goTo(p)} className="font-black text-duo-blue hover:underline">
                  {p === 'student' ? 'Em là học sinh? →' : 'Bạn là giáo viên? →'}
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
