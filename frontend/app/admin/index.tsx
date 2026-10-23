import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, GraduationCap, Info, KeyRound, LayoutDashboard, Loader2, Lock, Presentation, School, Search,
  ShieldCheck, Trash2, Unlock, UserPlus, UsersRound
} from 'lucide-react';
import * as adminApi from '@/api/adminApi';
import { BulkCreateModal } from '@/components/customs/admin/BulkCreateModal';
import { ConfirmModal } from '@/components/customs/admin/ConfirmModal';
import { CreateAccountModal } from '@/components/customs/admin/CreateAccountModal';
import { CredentialsModal } from '@/components/customs/admin/CredentialsModal';
import { BrandLogo } from '@/components/customs/BrandLogo';
import { Mascot } from '@/components/customs/Mascot';
import { ROLE_CHIP, ROLE_LABEL } from '@/constants/roles';
import { PORTAL_TITLE } from '@/constants/routes';
import { routeHref } from '@/lib/router';
import type { AccountCredential, AdminStats, AdminUser, AuthUser, Portal } from '@/types/authType';
import { avatarColor, formatDateTime, initialsOf, pct } from '@/utils/format';
import { ApiError } from '@/utils/http';

type AdminTab = 'overview' | 'teacher' | 'student';

export const AdminView: React.FC<{ token: string; me: AuthUser; onShowToast: (m: string) => void; onSessionExpired: () => void }> = ({
  token,
  me,
  onShowToast,
  onSessionExpired,
}) => {
  const [tab, setTab] = useState<AdminTab>('overview');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [modal, setModal] = useState<null | 'create' | 'bulk'>(null);
  const [creds, setCreds] = useState<{ title: string; items: AccountCredential[] } | null>(null);
  const [confirm, setConfirm] = useState<null | { kind: 'reset' | 'delete'; user: AuthUser }>(null);
  const [busy, setBusy] = useState(false);

  const handleError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) {
        onSessionExpired();
        return;
      }
      onShowToast(`⚠️ ${err instanceof Error ? err.message : 'Có lỗi xảy ra'}`);
    },
    [onSessionExpired, onShowToast]
  );

  const reload = useCallback(async () => {
    try {
      const [list, s] = await Promise.all([
        adminApi.getUsers(token),
        adminApi.getAdminStats(token),
      ]);
      setUsers(list);
      setStats(s);
      setLoadError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onSessionExpired();
      else setLoadError(err instanceof Error ? err.message : 'Không tải được dữ liệu');
    } finally {
      setLoading(false);
    }
  }, [token, onSessionExpired]);

  useEffect(() => {
    reload();
  }, [reload]);

  const classes = stats?.classes ?? [];
  const managed = users.filter((u) => u.role !== 'admin');

  const visible = managed.filter((u) => {
    if (tab !== 'overview' && u.role !== tab) return false;
    if (classFilter !== 'all' && (u.class_name ?? '') !== classFilter) return false;
    const q = search.trim().toLowerCase();
    return !q || u.full_name.toLowerCase().includes(q) || u.username.includes(q);
  });

  const onCreated = (items: AccountCredential[]) => {
    setModal(null);
    setCreds({ title: items.length > 1 ? `Đã cấp ${items.length} tài khoản` : 'Đã cấp tài khoản', items });
    onShowToast(`✅ Đã cấp ${items.length} tài khoản mới`);
    reload();
  };

  const toggleActive = async (u: AuthUser) => {
    try {
      await adminApi.setUserActive(token, u.id, !u.is_active);
      onShowToast(u.is_active ? `🔒 Đã khoá tài khoản ${u.username}` : `🔓 Đã mở khoá tài khoản ${u.username}`);
      reload();
    } catch (err) {
      handleError(err);
    }
  };

  const runConfirm = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.kind === 'reset') {
        const cred = await adminApi.resetUserPassword(token, confirm.user.id);
        setCreds({ title: 'Mật khẩu tạm mới', items: [cred] });
      } else {
        await adminApi.deleteUser(token, confirm.user.id);
        onShowToast(`🗑️ Đã xoá tài khoản ${confirm.user.username}`);
      }
      setConfirm(null);
      reload();
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  };

  const navItems: Array<{ id: AdminTab; label: string; icon: React.ElementType; color: string; count?: number }> = [
    { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard, color: '#d97706' },
    { id: 'teacher', label: 'Giáo viên', icon: Presentation, color: '#115e59', count: stats?.teachers },
    { id: 'student', label: 'Học sinh', icon: GraduationCap, color: '#0f766e', count: stats?.students },
  ];

  const statTiles = [
    { label: 'Giáo viên', value: stats?.teachers ?? 0, icon: <Presentation className="w-6 h-6" />, color: '#115e59' },
    { label: 'Học sinh', value: stats?.students ?? 0, icon: <GraduationCap className="w-6 h-6" />, color: '#0f766e' },
    { label: 'Đang hoạt động', value: stats?.active ?? 0, icon: <ShieldCheck className="w-6 h-6" />, color: '#0369a1' },
    { label: 'Chưa đăng nhập lần đầu', value: stats?.pending_first_login ?? 0, icon: <KeyRound className="w-6 h-6" />, color: '#c2410c' },
    { label: 'Số lớp', value: classes.length, icon: <School className="w-6 h-6" />, color: '#b91c1c' },
  ];

  const renderTable = (rows: AdminUser[]) => (
    <div className="card-duo overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-duo-polar text-duo-wolf text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3 font-black">Họ tên</th>
              <th className="text-left px-4 py-3 font-black">Tên đăng nhập</th>
              <th className="text-left px-4 py-3 font-black">Vai trò • Lớp</th>
              <th className="text-left px-4 py-3 font-black">Trạng thái</th>
              <th className="text-left px-4 py-3 font-black">Tiến độ học tập</th>
              <th className="text-left px-4 py-3 font-black">Đăng nhập gần nhất</th>
              <th className="text-right px-4 py-3 font-black">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-duo-swan">
            {rows.map((u) => (
              <tr key={u.id} className={u.is_active ? 'hover:bg-duo-polar/60' : 'bg-duo-polar/70 text-duo-hare'}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-full text-white font-black text-xs flex items-center justify-center shrink-0" style={{ background: avatarColor(u.username) }}>
                      {initialsOf(u.full_name)}
                    </span>
                    <span className="font-black text-duo-ink">{u.full_name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono font-bold text-duo-blue-dark">{u.username}</td>
                <td className="px-4 py-3">
                  <span className={`chip ${ROLE_CHIP[u.role]}`}>{ROLE_LABEL[u.role]}</span>
                  {u.class_name && <span className="ml-1.5 font-bold text-duo-wolf">{u.class_name}</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {u.is_active ? <span className="chip bg-duo-green-light text-duo-green-dark">Hoạt động</span> : <span className="chip bg-duo-red-light text-duo-red-dark">Đã khoá</span>}
                    {u.must_change_password && <span className="chip bg-duo-gold-light text-duo-gold-dark">Chưa đổi MK</span>}
                  </div>
                </td>
                <td className="px-4 py-3 font-bold text-duo-wolf whitespace-nowrap">
                  {u.role === 'student' ? (
                    <span>
                      <b className="text-duo-gold-dark">{(u.xp ?? 0).toLocaleString('vi-VN')} KN</b> • {u.lessons_completed ?? 0} chặng • {pct(u.accuracy)}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-3 font-bold text-duo-wolf whitespace-nowrap">{formatDateTime(u.last_login_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    <button onClick={() => setConfirm({ kind: 'reset', user: u })} className="btn-3d btn-outline btn-sm btn-icon !text-duo-blue" title="Đặt lại mật khẩu">
                      <KeyRound className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleActive(u)}
                      className={`btn-3d btn-outline btn-sm btn-icon ${u.is_active ? '!text-duo-orange' : '!text-duo-green'}`}
                      title={u.is_active ? 'Khoá tài khoản' : 'Mở khoá tài khoản'}
                    >
                      {u.is_active ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                    </button>
                    <button onClick={() => setConfirm({ kind: 'delete', user: u })} className="btn-3d btn-outline btn-sm btn-icon !text-duo-red" title="Xoá tài khoản">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <div className="py-12 flex flex-col items-center text-center px-4">
          <Mascot size={90} mood="thinking" />
          <p className="font-black text-duo-ink mt-2">{managed.length === 0 ? 'Chưa có tài khoản nào' : 'Không tìm thấy kết quả phù hợp'}</p>
          <p className="text-sm font-bold text-duo-wolf">{managed.length === 0 ? 'Bấm "Cấp hàng loạt" để tạo tài khoản cho cả lớp.' : 'Thử đổi từ khoá hoặc bộ lọc lớp.'}</p>
        </div>
      )}
    </div>
  );

  const defaultRole: 'teacher' | 'student' = tab === 'teacher' ? 'teacher' : 'student';

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden bg-white text-duo-ink">
      {/* Thanh bên */}
      <aside className="w-[88px] lg:w-64 border-r-2 border-duo-swan flex flex-col shrink-0 h-full py-5 px-3 lg:px-4">
        <div className="px-1 mb-6">
          <BrandLogo subtitle="Quản trị" className="hidden lg:flex" />
          <BrandLogo compact className="lg:hidden justify-center" />
        </div>
        <nav className="space-y-1.5 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setTab(item.id);
                  if (item.id === 'overview') {
                    setClassFilter('all');
                    setSearch('');
                  }
                }}
                className={`nav-duo justify-center lg:justify-start ${tab === item.id ? 'is-active' : ''}`}
                title={item.label}
              >
                <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: item.color }}>
                  <Icon className="w-[18px] h-[18px] text-white" strokeWidth={2.6} />
                </span>
                <span className="hidden lg:inline flex-1">{item.label}</span>
                {item.count !== undefined && <span className="hidden lg:inline-flex chip bg-duo-polar text-duo-wolf">{item.count}</span>}
              </button>
            );
          })}
        </nav>
        <div className="hidden lg:block rounded-2xl bg-duo-gold-light p-3 text-xs font-bold text-duo-gold-dark">
          Đăng nhập với <span className="font-mono">{me.username}</span>
        </div>
      </aside>

      {/* Nội dung */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-duo-ink">
                {tab === 'overview' ? 'Quản trị tài khoản' : tab === 'teacher' ? 'Giáo viên' : 'Học sinh'}
              </h1>
              <p className="text-sm font-bold text-duo-wolf">
                {tab === 'overview' ? 'Cấp và quản lý tài khoản cho toàn bộ giáo viên, học sinh' : `${visible.length} tài khoản`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setModal('create')} className="btn-3d btn-outline">
                <UserPlus className="w-4 h-4" /> Cấp tài khoản
              </button>
              <button onClick={() => setModal('bulk')} className="btn-3d btn-green">
                <UsersRound className="w-4 h-4" /> Cấp hàng loạt
              </button>
            </div>
          </div>

          {loadError && (
            <div className="rounded-2xl bg-duo-red-light text-duo-red-dark font-bold text-sm px-4 py-3 flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> {loadError}
              </span>
              <button onClick={reload} className="btn-3d btn-red btn-sm">
                Thử lại
              </button>
            </div>
          )}

          {loading ? (
            <div className="py-20 flex flex-col items-center">
              <Loader2 className="w-8 h-8 text-duo-green animate-spin" />
              <p className="font-bold text-duo-wolf mt-2">Đang tải danh sách tài khoản…</p>
            </div>
          ) : tab === 'overview' ? (
            <>
              <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {statTiles.map((s) => (
                  <div key={s.label} className="card-duo p-4">
                    <span className="w-11 h-11 rounded-2xl flex items-center justify-center text-white" style={{ background: s.color }}>
                      {s.icon}
                    </span>
                    <div className="font-black text-2xl text-duo-ink mt-2">{s.value}</div>
                    <div className="text-xs font-bold text-duo-hare">{s.label}</div>
                  </div>
                ))}
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(['student', 'teacher'] as Portal[]).map((p) => (
                  <div key={p} className="card-duo p-4 flex items-center gap-3">
                    <span className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${p === 'student' ? 'bg-duo-green' : 'bg-kh-purple'}`}>
                      {p === 'student' ? <GraduationCap className="w-6 h-6 text-white" /> : <Presentation className="w-6 h-6 text-white" />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-duo-hare uppercase tracking-wider">{PORTAL_TITLE[p]}</p>
                      <p className="font-mono font-black text-duo-blue-dark truncate">{routeHref(p)}</p>
                    </div>
                  </div>
                ))}
              </div>

              {stats?.storage === 'sqlite' && (
                <div className="rounded-2xl bg-duo-blue-light text-duo-blue-dark text-sm font-bold px-4 py-3 flex items-start gap-2">
                  <Info className="w-4 h-4 mt-0.5 shrink-0" />
                  Tài khoản đang lưu ở cơ sở dữ liệu cục bộ (SQLite) của backend. Khai báo DATABASE_URL (Supabase) để lưu lâu dài khi triển khai lên Render.
                </div>
              )}

              <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card-duo p-5">
                  <h3 className="font-black text-lg text-duo-ink mb-3">Theo lớp</h3>
                  {classes.length === 0 ? (
                    <p className="text-sm font-bold text-duo-wolf">Chưa có lớp nào. Khi cấp tài khoản, nhập tên lớp để nhóm học sinh.</p>
                  ) : (
                    <div className="space-y-3">
                      {classes.map((c) => {
                        const st = managed.filter((u) => u.role === 'student' && u.class_name === c).length;
                        const tc = managed.filter((u) => u.role === 'teacher' && u.class_name === c);
                        return (
                          <button
                            key={c}
                            onClick={() => {
                              setTab('student');
                              setClassFilter(c);
                            }}
                            className="w-full flex items-center gap-3 p-3 rounded-2xl border-2 border-duo-swan hover:bg-duo-polar text-left"
                          >
                            <span className="w-11 h-11 rounded-xl bg-duo-green text-white font-black flex items-center justify-center text-sm shrink-0">{c}</span>
                            <div className="flex-1 min-w-0">
                              <p className="font-black text-duo-ink">Lớp {c}</p>
                              <p className="text-xs font-bold text-duo-wolf truncate">
                                {tc.length ? `GV: ${tc.map((t) => t.full_name).join(', ')}` : 'Chưa có giáo viên phụ trách'}
                              </p>
                            </div>
                            <span className="chip bg-duo-green-light text-duo-green-dark">{st} HS</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="card-duo p-5">
                  <h3 className="font-black text-lg text-duo-ink mb-3">Tài khoản mới cấp</h3>
                  {managed.length === 0 ? (
                    <div className="flex flex-col items-center text-center py-4">
                      <Mascot size={90} mood="excited" accessory="crown" />
                      <p className="font-black text-duo-ink mt-2">Bắt đầu cấp tài khoản</p>
                      <p className="text-sm font-bold text-duo-wolf mb-4">Dán danh sách họ tên cả lớp để tạo tài khoản trong một lần.</p>
                      <button onClick={() => setModal('bulk')} className="btn-3d btn-green">
                        <UsersRound className="w-4 h-4" /> Cấp hàng loạt
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {[...managed]
                        .sort((a, b) => b.created_at.localeCompare(a.created_at))
                        .slice(0, 6)
                        .map((u) => (
                          <div key={u.id} className="flex items-center gap-3">
                            <span className="w-9 h-9 rounded-full text-white font-black text-xs flex items-center justify-center shrink-0" style={{ background: avatarColor(u.username) }}>
                              {initialsOf(u.full_name)}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="font-black text-sm text-duo-ink truncate">{u.full_name}</p>
                              <p className="text-xs font-bold text-duo-hare font-mono">{u.username}</p>
                            </div>
                            <span className={`chip ${ROLE_CHIP[u.role]}`}>{ROLE_LABEL[u.role]}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </section>

              <section>
                <h3 className="font-black text-lg text-duo-ink mb-3">Tất cả giáo viên & học sinh</h3>
                {renderTable(visible)}
              </section>
            </>
          ) : (
            <>
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-duo-hare" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo họ tên hoặc tên đăng nhập…" className="input-duo !pl-10" />
                </div>
                <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="input-duo !w-auto">
                  <option value="all">Tất cả lớp</option>
                  {classes.map((c) => (
                    <option key={c} value={c}>
                      Lớp {c}
                    </option>
                  ))}
                </select>
              </div>
              {renderTable(visible)}
            </>
          )}
        </div>
      </main>

      {modal === 'create' && <CreateAccountModal token={token} defaultRole={defaultRole} classes={classes} onClose={() => setModal(null)} onCreated={onCreated} />}
      {modal === 'bulk' && <BulkCreateModal token={token} defaultRole={defaultRole} classes={classes} onClose={() => setModal(null)} onCreated={onCreated} />}
      {creds && <CredentialsModal title={creds.title} creds={creds.items} onClose={() => setCreds(null)} onToast={onShowToast} />}
      {confirm && (
        <ConfirmModal
          title={confirm.kind === 'reset' ? 'Đặt lại mật khẩu?' : 'Xoá tài khoản?'}
          danger={confirm.kind === 'delete'}
          busy={busy}
          confirmLabel={confirm.kind === 'reset' ? 'Đặt lại' : 'Xoá vĩnh viễn'}
          message={
            confirm.kind === 'reset' ? (
              <>
                Mật khẩu hiện tại của <b className="text-duo-ink">{confirm.user.full_name}</b> ({confirm.user.username}) sẽ ngừng hoạt động và hệ thống cấp một mật khẩu tạm mới.
              </>
            ) : (
              <>
                Tài khoản <b className="text-duo-ink">{confirm.user.full_name}</b> ({confirm.user.username}) sẽ bị xoá và không đăng nhập được nữa. Nếu chỉ muốn tạm ngừng, hãy dùng nút Khoá.
              </>
            )
          }
          onConfirm={runConfirm}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
};
