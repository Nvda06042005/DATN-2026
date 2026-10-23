import React, { useState } from 'react';
import { Loader2, UserPlus } from 'lucide-react';
import * as adminApi from '@/api/adminApi';
import { RolePicker } from '@/components/customs/admin/RolePicker';
import { ModalShell } from '@/components/ui/modal-shell';
import type { AccountCredential } from '@/types/authType';

export const CreateAccountModal: React.FC<{
  token: string;
  defaultRole: 'teacher' | 'student';
  classes: string[];
  onClose: () => void;
  onCreated: (creds: AccountCredential[]) => void;
}> = ({ token, defaultRole, classes, onClose, onCreated }) => {
  const [role, setRole] = useState<'teacher' | 'student'>(defaultRole);
  const [fullName, setFullName] = useState('');
  const [className, setClassName] = useState(classes[0] ?? '7A1');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fullName.trim().length < 2) return setError('Họ tên cần ít nhất 2 ký tự.');
    if (username && !/^[a-z0-9._-]{3,32}$/.test(username.trim().toLowerCase()))
      return setError('Tên đăng nhập chỉ gồm chữ thường không dấu, số, dấu chấm, gạch (3–32 ký tự).');
    if (password && password.length < 6) return setError('Mật khẩu cần ít nhất 6 ký tự.');
    setLoading(true);
    setError(null);
    try {
      const cred = await adminApi.createUser(token, {
        full_name: fullName.trim(),
        role,
        class_name: className.trim() || null,
        username: username.trim() || null,
        password: password || null,
      });
      onCreated([cred]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tạo được tài khoản.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell title="Cấp tài khoản mới" onClose={onClose}>
      <form onSubmit={submit} className="p-6 space-y-4">
        <RolePicker value={role} onChange={setRole} />
        <div>
          <label className="block text-xs font-black text-duo-wolf uppercase tracking-wider mb-1.5">Họ và tên *</label>
          <input autoFocus value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="vd: Nguyễn Văn Long" className="input-duo" />
        </div>
        <div>
          <label className="block text-xs font-black text-duo-wolf uppercase tracking-wider mb-1.5">{role === 'teacher' ? 'Lớp phụ trách' : 'Lớp'}</label>
          <input list="class-options" value={className} onChange={(e) => setClassName(e.target.value)} placeholder="vd: 7A1" className="input-duo" />
          <datalist id="class-options">
            {classes.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-black text-duo-wolf uppercase tracking-wider mb-1.5">Tên đăng nhập</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Để trống: tự sinh" className="input-duo" />
          </div>
          <div>
            <label className="block text-xs font-black text-duo-wolf uppercase tracking-wider mb-1.5">Mật khẩu tạm</label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Để trống: tự sinh" className="input-duo" />
          </div>
        </div>
        <p className="text-xs font-bold text-duo-hare">Người dùng sẽ được yêu cầu đổi mật khẩu ở lần đăng nhập đầu tiên.</p>
        {error && <div className="rounded-2xl bg-duo-red-light text-duo-red-dark font-bold text-sm px-4 py-3">{error}</div>}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-3d btn-ghost">
            Huỷ
          </button>
          <button type="submit" disabled={loading} className="btn-3d btn-green">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Cấp tài khoản
          </button>
        </div>
      </form>
    </ModalShell>
  );
};
