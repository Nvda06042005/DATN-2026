import React, { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import * as authApi from '@/api/authApi';
import { Mascot } from '@/components/customs/Mascot';
import type { AuthUser } from '@/types/authType';

export const ChangePasswordScreen: React.FC<{
  user: AuthUser;
  token: string;
  forced: boolean;
  onDone: (token: string, user: AuthUser) => void;
  onCancel: () => void;
}> = ({ user, token, forced, onDone, onCancel }) => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 6) return setError('Mật khẩu mới cần ít nhất 6 ký tự.');
    if (next !== confirm) return setError('Mật khẩu nhập lại chưa khớp.');
    if (next === current) return setError('Mật khẩu mới phải khác mật khẩu hiện tại.');
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.changePassword(token, current, next);
      onDone(res.token, res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không đổi được mật khẩu.');
    } finally {
      setLoading(false);
    }
  };

  const field = (id: string, label: string, value: string, set: (v: string) => void, auto: string) => (
    <div className="mb-4">
      <label htmlFor={id} className="block text-xs font-black text-duo-wolf uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <input id={id} type={show ? 'text' : 'password'} autoComplete={auto} value={value} onChange={(e) => set(e.target.value)} className="input-duo !py-3" />
    </div>
  );

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-duo-polar px-4 py-10">
      <form onSubmit={submit} className="w-full max-w-md bg-white rounded-3xl border-2 border-duo-swan shadow-[0_6px_0_#e7d9bc] p-6 sm:p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <Mascot size={100} mood="thinking" accessory="scholar" />
          <h1 className="text-2xl font-black text-duo-ink mt-2">{forced ? 'Đặt mật khẩu mới' : 'Đổi mật khẩu'}</h1>
          <p className="text-sm font-bold text-duo-wolf mt-1">
            {forced
              ? `Chào ${user.full_name}! Đây là lần đăng nhập đầu tiên với mật khẩu tạm – hãy đặt mật khẩu của riêng mình.`
              : `Tài khoản: ${user.username}`}
          </p>
        </div>
        {field('cp-current', forced ? 'Mật khẩu tạm được cấp' : 'Mật khẩu hiện tại', current, setCurrent, 'current-password')}
        {field('cp-new', 'Mật khẩu mới (tối thiểu 6 ký tự)', next, setNext, 'new-password')}
        {field('cp-confirm', 'Nhập lại mật khẩu mới', confirm, setConfirm, 'new-password')}
        <label className="flex items-center gap-2 text-sm font-bold text-duo-wolf mb-4 cursor-pointer select-none">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="w-4 h-4 accent-duo-green" />
          Hiện mật khẩu
        </label>
        {error && (
          <div role="alert" className="mb-4 rounded-2xl bg-duo-red-light text-duo-red-dark font-bold text-sm px-4 py-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
          </div>
        )}
        <div className="flex items-center gap-3">
          <button type="button" onClick={onCancel} className="btn-3d btn-outline !text-duo-wolf">
            {forced ? 'Đăng xuất' : 'Huỷ'}
          </button>
          <button type="submit" disabled={loading} className="btn-3d btn-green flex-1">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} Lưu mật khẩu
          </button>
        </div>
      </form>
    </div>
  );
};
