import React, { useState } from 'react';
import { Loader2, UsersRound } from 'lucide-react';
import * as adminApi from '@/api/adminApi';
import { RolePicker } from '@/components/customs/admin/RolePicker';
import { ModalShell } from '@/components/ui/modal-shell';
import type { AccountCredential } from '@/types/authType';

export const BulkCreateModal: React.FC<{
  token: string;
  defaultRole: 'teacher' | 'student';
  classes: string[];
  onClose: () => void;
  onCreated: (creds: AccountCredential[]) => void;
}> = ({ token, defaultRole, classes, onClose, onCreated }) => {
  const [role, setRole] = useState<'teacher' | 'student'>(defaultRole);
  const [className, setClassName] = useState(classes[0] ?? '7A1');
  const [names, setNames] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = names
    .split(/\r?\n/)
    .map((n) => n.replace(/^\s*\d+[.)\-\s]+/, '').trim())
    .filter(Boolean);

  const submit = async () => {
    if (list.length === 0) return setError('Hãy dán danh sách họ tên, mỗi dòng một người.');
    if (list.length > 200) return setError('Mỗi lần tối đa 200 người.');
    if (list.some((n) => n.length < 2)) return setError('Có dòng chưa đủ họ tên (ít nhất 2 ký tự).');
    setLoading(true);
    setError(null);
    try {
      const creds = await adminApi.bulkCreateUsers(token, { role, class_name: className.trim() || null, full_names: list });
      onCreated(creds);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tạo được tài khoản.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell title="Cấp tài khoản hàng loạt" onClose={onClose}>
      <div className="p-6 space-y-4">
        <RolePicker value={role} onChange={setRole} />
        <div>
          <label className="block text-xs font-black text-duo-wolf uppercase tracking-wider mb-1.5">Lớp</label>
          <input list="bulk-class-options" value={className} onChange={(e) => setClassName(e.target.value)} placeholder="vd: 7A1" className="input-duo" />
          <datalist id="bulk-class-options">
            {classes.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-black text-duo-wolf uppercase tracking-wider">Danh sách họ tên (mỗi dòng một người)</label>
            <span className="chip bg-duo-blue-light text-duo-blue-dark">{list.length} người</span>
          </div>
          <textarea
            autoFocus
            rows={9}
            value={names}
            onChange={(e) => setNames(e.target.value)}
            placeholder={'Nguyễn Văn Long\nTrần Quốc Anh\nLê Minh Thư\n...'}
            className="input-duo resize-y font-semibold"
          />
          <p className="text-xs font-bold text-duo-hare mt-1">Có thể dán thẳng cột họ tên từ Excel. Số thứ tự đầu dòng sẽ tự bỏ.</p>
        </div>
        {error && <div className="rounded-2xl bg-duo-red-light text-duo-red-dark font-bold text-sm px-4 py-3">{error}</div>}
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="btn-3d btn-ghost">
            Huỷ
          </button>
          <button onClick={submit} disabled={loading || list.length === 0} className="btn-3d btn-green">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UsersRound className="w-4 h-4" />} Cấp {list.length || ''} tài khoản
          </button>
        </div>
      </div>
    </ModalShell>
  );
};
