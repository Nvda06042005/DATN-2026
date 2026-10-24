/**
 * Trang quản trị: cấp tài khoản (lẻ hoặc cả lớp), khóa/mở, đặt lại mật khẩu tạm, xóa; xem tiến độ học tập thật của học sinh.
 * Mật khẩu tạm chỉ hiện một lần trong phiếu tài khoản (sao chép, tải CSV, in phiếu trên web).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, Share, View, useWindowDimensions } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  AlertTriangle, ClipboardCopy, Download, GraduationCap, KeyRound, LayoutDashboard, Lock, Presentation, Printer, School, ShieldCheck, Trash2, Unlock, UserPlus, UsersRound,
} from 'lucide-react-native';
import * as adminApi from '@/api/adminApi';
import { ApiError, errorMessage } from '@/api/client';
import { Mascot } from '@/components/art';
import { PORTAL_PATH, PORTAL_TITLE, ROLE_LABEL, TopBar, type Session } from '@/components/auth';
import { Avatar, Btn, Card, Chip, ConfirmSheet, EmptyState, Field, Inset, PaperBg, Segmented, Sheet, Spinner, Txt, useToast } from '@/components/ui';
import { type Palette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fmt, formatDateTime, pct, webHref } from '@/lib/format';
import type { AccountCredential, AdminStats, AdminUser, AuthRole, AuthUser, ManagedRole } from '@/types/api';
import type { IconType } from '@/types/game';

type AdminTab = 'overview' | 'teacher' | 'student';

const roleChip = (c: Palette, role: AuthRole) =>
  role === 'admin' ? { bg: c.dongNhat, fg: c.dongChu } : role === 'teacher' ? { bg: c.thongNhat, fg: c.thongChu } : { bg: c.ngocNhat, fg: c.ngocDam };

const loginUrl = (role: AuthRole) => webHref(PORTAL_PATH[role]) ?? `${PORTAL_TITLE[role]} trong app Đông A`;

export const AdminHome: React.FC<{ session: Session }> = ({ session }) => {
  const { token, user: me } = session;
  const { c } = useTheme();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
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

  const fail = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) session.expired();
      else toast(errorMessage(err));
    },
    [session, toast],
  );

  const reload = useCallback(async () => {
    try {
      const [list, s] = await Promise.all([adminApi.getUsers(token), adminApi.getAdminStats(token)]);
      setUsers(list);
      setStats(s);
      setLoadError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) session.expired();
      else setLoadError(errorMessage(err, 'Không tải được dữ liệu'));
    } finally {
      setLoading(false);
    }
  }, [token, session]);

  useEffect(() => {
    reload();
  }, [reload]);

  const classes = stats?.classes ?? [];
  const managed = useMemo(() => users.filter((u) => u.role !== 'admin'), [users]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return managed.filter((u) => {
      if (tab !== 'overview' && u.role !== tab) return false;
      if (classFilter !== 'all' && (u.class_name ?? '') !== classFilter) return false;
      return !q || u.full_name.toLowerCase().includes(q) || u.username.includes(q);
    });
  }, [managed, tab, classFilter, search]);

  const onCreated = (items: AccountCredential[]) => {
    setModal(null);
    setCreds({ title: items.length > 1 ? `Đã cấp ${items.length} tài khoản` : 'Đã cấp tài khoản', items });
    toast(`Đã cấp ${items.length} tài khoản mới`);
    reload();
  };

  const toggleActive = async (u: AuthUser) => {
    try {
      await adminApi.setUserActive(token, u.id, !u.is_active);
      toast(u.is_active ? `Đã khóa tài khoản ${u.username}` : `Đã mở khóa tài khoản ${u.username}`);
      reload();
    } catch (err) {
      fail(err);
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
        toast(`Đã xóa tài khoản ${confirm.user.username}`);
      }
      setConfirm(null);
      reload();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const nav: Array<{ id: AdminTab; label: string; icon: IconType; color: string; count?: number }> = [
    { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard, color: c.dong },
    { id: 'teacher', label: 'Giáo viên', icon: Presentation, color: c.thong, count: stats?.teachers },
    { id: 'student', label: 'Học sinh', icon: GraduationCap, color: c.ngoc, count: stats?.students },
  ];
  const pickTab = (id: AdminTab) => {
    setTab(id);
    if (id === 'overview') {
      setClassFilter('all');
      setSearch('');
    }
  };
  const defaultRole: ManagedRole = tab === 'teacher' ? 'teacher' : 'student';

  const header = (
    <View style={{ gap: 16, paddingBottom: 12 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <View>
          <Txt f="displayHeavy" size={28} accessibilityRole="header">
            {tab === 'overview' ? 'Quản trị tài khoản' : tab === 'teacher' ? 'Giáo viên' : 'Học sinh'}
          </Txt>
          <Txt f="semibold" size={14} color={c.muc2}>
            {tab === 'overview' ? 'Cấp và quản lý tài khoản cho toàn bộ giáo viên, học sinh' : `${visible.length} tài khoản`}
          </Txt>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Btn title="Cấp tài khoản" icon={UserPlus} tone="giay" onPress={() => setModal('create')} />
          <Btn title="Cấp hàng loạt" icon={UsersRound} tone="ngoc" onPress={() => setModal('bulk')} />
        </View>
      </View>
      {!wide && <Segmented label="Mục quản trị" options={nav.map((n) => ({ value: n.id, label: n.count === undefined ? n.label : `${n.label} (${n.count})` }))} value={tab} onChange={pickTab} />}
      {loadError && (
        <Inset style={{ backgroundColor: c.sonNhat, flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <AlertTriangle size={16} color={c.sonChu} />
          <Txt f="bold" size={14} color={c.sonChu} style={{ flex: 1 }}>
            {loadError}
          </Txt>
          <Btn title="Thử lại" size="sm" onPress={reload} />
        </Inset>
      )}
      {tab === 'overview' ? (
        <Overview stats={stats} classes={classes} managed={managed} onClass={(cls) => {
          setTab('student');
          setClassFilter(cls);
        }} onBulk={() => setModal('bulk')} />
      ) : (
        <View style={{ gap: 10 }}>
          <Field label="Tìm kiếm" value={search} onChangeText={setSearch} placeholder="Họ tên hoặc tên đăng nhập…" autoCapitalize="none" autoCorrect={false} />
          {classes.length > 0 && (
            <Segmented label="Lọc theo lớp" options={[{ value: 'all', label: 'Tất cả lớp' }, ...classes.map((cls) => ({ value: cls, label: `Lớp ${cls}` }))]} value={classFilter} onChange={setClassFilter} />
          )}
        </View>
      )}
      {tab === 'overview' && (
        <Txt f="display" size={19}>
          Tất cả giáo viên & học sinh
        </Txt>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <PaperBg />
      <TopBar session={session} subtitle="Cấp tài khoản và theo dõi toàn bộ giáo viên, học sinh của trường" />
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {wide && (
          <View style={{ width: 240, padding: 16, gap: 8, borderRightWidth: 2, borderRightColor: c.vien, backgroundColor: c.the }}>
            {nav.map((n) => {
              const on = tab === n.id;
              const Icon = n.icon;
              return (
                <Pressable
                  key={n.id}
                  onPress={() => pickTab(n.id)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingHorizontal: 10, borderRadius: 14, borderWidth: 2, borderColor: on ? '#5eead4' : 'transparent', backgroundColor: on ? c.ngocNhat : 'transparent' }}
                >
                  <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: n.color, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={18} color="#ffffff" strokeWidth={2.6} />
                  </View>
                  <Txt f="display" size={15} color={on ? c.ngocDam : c.muc2} upper style={{ flex: 1 }}>
                    {n.label}
                  </Txt>
                  {n.count !== undefined && <Chip text={String(n.count)} bg={c.giay2} fg={c.muc2} />}
                </Pressable>
              );
            })}
            <Inset style={{ backgroundColor: c.dongNhat, marginTop: 'auto' }}>
              <Txt f="bold" size={12} color={c.dongChu}>
                Đăng nhập với <Txt f="mono" size={12} color={c.dongChu}>{me.username}</Txt>
              </Txt>
            </Inset>
          </View>
        )}
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Spinner label="Đang tải danh sách tài khoản…" />
          </View>
        ) : (
          <FlatList
            data={visible}
            keyExtractor={(u) => String(u.id)}
            ListHeaderComponent={header}
            contentContainerStyle={{ padding: 16, gap: 10, width: '100%', maxWidth: 1100, alignSelf: 'center' }}
            renderItem={({ item }) => <UserRow u={item} onReset={() => setConfirm({ kind: 'reset', user: item })} onToggle={() => toggleActive(item)} onDelete={() => setConfirm({ kind: 'delete', user: item })} />}
            ListEmptyComponent={
              <EmptyState
                title={managed.length === 0 ? 'Chưa có tài khoản nào' : 'Không tìm thấy kết quả phù hợp'}
                text={managed.length === 0 ? 'Bấm "Cấp hàng loạt" để tạo tài khoản cho cả lớp.' : 'Thử đổi từ khóa hoặc bộ lọc lớp.'}
              />
            }
            keyboardShouldPersistTaps="handled"
          />
        )}
      </View>
      {modal === 'create' && <CreateAccountSheet token={token} defaultRole={defaultRole} classes={classes} onClose={() => setModal(null)} onCreated={onCreated} />}
      {modal === 'bulk' && <BulkCreateSheet token={token} defaultRole={defaultRole} classes={classes} onClose={() => setModal(null)} onCreated={onCreated} />}
      {creds && <CredentialsSheet title={creds.title} creds={creds.items} onClose={() => setCreds(null)} />}
      <ConfirmSheet
        open={!!confirm}
        title={confirm?.kind === 'reset' ? 'Đặt lại mật khẩu?' : 'Xóa tài khoản?'}
        tone={confirm?.kind === 'delete' ? 'son' : 'ngoc'}
        busy={busy}
        confirmLabel={confirm?.kind === 'reset' ? 'Đặt lại' : 'Xóa vĩnh viễn'}
        message={
          confirm
            ? confirm.kind === 'reset'
              ? `Mật khẩu hiện tại của ${confirm.user.full_name} (${confirm.user.username}) sẽ ngừng hoạt động và hệ thống cấp một mật khẩu tạm mới.`
              : `Tài khoản ${confirm.user.full_name} (${confirm.user.username}) cùng tiến độ học tập sẽ bị xóa và không đăng nhập được nữa. Nếu chỉ muốn tạm ngừng, hãy dùng nút Khóa.`
            : ''
        }
        onConfirm={runConfirm}
        onCancel={() => setConfirm(null)}
      />
    </View>
  );
};

// ---------------------------------------------------------------------- tổng quan
const Overview: React.FC<{ stats: AdminStats | null; classes: string[]; managed: AdminUser[]; onClass: (c: string) => void; onBulk: () => void }> = ({ stats, classes, managed, onClass, onBulk }) => {
  const { c } = useTheme();
  const tiles: Array<{ label: string; value: number; icon: IconType; color: string }> = [
    { label: 'Giáo viên', value: stats?.teachers ?? 0, icon: Presentation, color: c.thong },
    { label: 'Học sinh', value: stats?.students ?? 0, icon: GraduationCap, color: c.ngoc },
    { label: 'Đang hoạt động', value: stats?.active ?? 0, icon: ShieldCheck, color: c.thuy },
    { label: 'Chưa đăng nhập lần đầu', value: stats?.pending_first_login ?? 0, icon: KeyRound, color: c.hoa },
    { label: 'Số lớp', value: classes.length, icon: School, color: c.son },
  ];
  const recent = [...managed].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6);
  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <Card key={t.label} style={{ flexGrow: 1, flexBasis: 150, gap: 6 }} pad={14}>
              <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: t.color, alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={22} color="#ffffff" />
              </View>
              <Txt f="displayHeavy" size={26} accessibilityLabel={`${t.label}: ${t.value}`}>
                {fmt(t.value)}
              </Txt>
              <Txt f="bold" size={12} color={c.muc2}>
                {t.label}
              </Txt>
            </Card>
          );
        })}
      </View>
      {Platform.OS === 'web' && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {(['student', 'teacher'] as const).map((p) => (
            <Card key={p} pad={14} style={{ flexGrow: 1, flexBasis: 280, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: p === 'student' ? c.ngoc : c.thong, alignItems: 'center', justifyContent: 'center' }}>
                {p === 'student' ? <GraduationCap size={22} color="#ffffff" /> : <Presentation size={22} color="#ffffff" />}
              </View>
              <View style={{ flex: 1 }}>
                <Txt f="bold" size={12} color={c.muc3} upper>
                  {PORTAL_TITLE[p]}
                </Txt>
                <Txt f="mono" size={14} color={c.thuyChu} numberOfLines={1}>
                  {loginUrl(p)}
                </Txt>
              </View>
            </Card>
          ))}
        </View>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        <Card style={{ flexGrow: 1, flexBasis: 320, gap: 10 }}>
          <Txt f="display" size={18}>
            Theo lớp
          </Txt>
          {classes.length === 0 ? (
            <Txt size={14} color={c.muc2}>
              Chưa có lớp nào. Khi cấp tài khoản, nhập tên lớp để nhóm học sinh.
            </Txt>
          ) : (
            classes.map((cls) => {
              const st = managed.filter((u) => u.role === 'student' && u.class_name === cls).length;
              const tc = managed.filter((u) => u.role === 'teacher' && u.class_name === cls);
              return (
                <Pressable
                  key={cls}
                  onPress={() => onClass(cls)}
                  accessibilityRole="button"
                  accessibilityLabel={`Lớp ${cls}: ${st} học sinh. Xem danh sách`}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 16, borderWidth: 2, borderColor: c.vien, backgroundColor: pressed ? c.giay2 : 'transparent' })}
                >
                  <View style={{ minWidth: 44, height: 44, paddingHorizontal: 6, borderRadius: 12, backgroundColor: c.ngoc, alignItems: 'center', justifyContent: 'center' }}>
                    <Txt f="display" size={14} color="#ffffff">
                      {cls}
                    </Txt>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt f="bold">Lớp {cls}</Txt>
                    <Txt size={12} color={c.muc2} numberOfLines={1}>
                      {tc.length ? `GV: ${tc.map((t) => t.full_name).join(', ')}` : 'Chưa có giáo viên phụ trách'}
                    </Txt>
                  </View>
                  <Chip text={`${st} HS`} bg={c.ngocNhat} fg={c.ngocDam} />
                </Pressable>
              );
            })
          )}
        </Card>
        <Card style={{ flexGrow: 1, flexBasis: 320, gap: 10 }}>
          <Txt f="display" size={18}>
            Tài khoản mới cấp
          </Txt>
          {managed.length === 0 ? (
            <View style={{ alignItems: 'center', gap: 6, paddingVertical: 8 }}>
              <Mascot size={90} mood="excited" accessory="crown" />
              <Txt f="bold">Bắt đầu cấp tài khoản</Txt>
              <Txt size={14} color={c.muc2} center>
                Dán danh sách họ tên cả lớp để tạo tài khoản trong một lần.
              </Txt>
              <Btn title="Cấp hàng loạt" icon={UsersRound} tone="ngoc" onPress={onBulk} />
            </View>
          ) : (
            recent.map((u) => {
              const chip = roleChip(c, u.role);
              return (
                <View key={u.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Avatar name={u.full_name} size={36} />
                  <View style={{ flex: 1 }}>
                    <Txt f="bold" size={14} numberOfLines={1}>
                      {u.full_name}
                    </Txt>
                    <Txt f="mono" size={12} color={c.muc3}>
                      {u.username}
                    </Txt>
                  </View>
                  <Chip text={ROLE_LABEL[u.role]} bg={chip.bg} fg={chip.fg} />
                </View>
              );
            })
          )}
        </Card>
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------- một tài khoản
const UserRow = React.memo<{ u: AdminUser; onReset: () => void; onToggle: () => void; onDelete: () => void }>(({ u, onReset, onToggle, onDelete }) => {
  const { c } = useTheme();
  const chip = roleChip(c, u.role);
  return (
    <Card flat pad={12} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, opacity: u.is_active ? 1 : 0.75 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexGrow: 1, flexBasis: 240 }}>
        <Avatar name={u.full_name} size={40} />
        <View style={{ flex: 1 }}>
          <Txt f="bold" numberOfLines={1}>
            {u.full_name}
          </Txt>
          <Txt f="mono" size={13} color={c.thuyChu}>
            {u.username}
          </Txt>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, flexGrow: 1, flexBasis: 220 }}>
        <Chip text={u.class_name ? `${ROLE_LABEL[u.role]} · ${u.class_name}` : ROLE_LABEL[u.role]} bg={chip.bg} fg={chip.fg} />
        {u.is_active ? <Chip text="Hoạt động" bg={c.ngocNhat} fg={c.ngocDam} /> : <Chip text="Đã khóa" bg={c.sonNhat} fg={c.sonChu} />}
        {u.must_change_password && <Chip text="Chưa đổi MK" bg={c.dongNhat} fg={c.dongChu} />}
      </View>
      <View style={{ flexGrow: 1, flexBasis: 200 }}>
        <Txt f="semibold" size={13} color={c.muc2}>
          {u.role === 'student' ? `${fmt(u.xp ?? 0)} XP · ${u.lessons_completed ?? 0} lượt học · đúng ${pct(u.accuracy)}` : 'Giáo viên phụ trách lớp'}
        </Txt>
        <Txt size={12} color={c.muc3}>
          Đăng nhập gần nhất: {formatDateTime(u.last_login_at)}
        </Txt>
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <Btn tone="giay" size="sm" icon={KeyRound} label={`Đặt lại mật khẩu cho ${u.full_name}`} onPress={onReset} />
        <Btn tone="giay" size="sm" icon={u.is_active ? Lock : Unlock} label={u.is_active ? `Khóa tài khoản ${u.full_name}` : `Mở khóa tài khoản ${u.full_name}`} onPress={onToggle} />
        <Btn tone="giay" size="sm" icon={Trash2} label={`Xóa tài khoản ${u.full_name}`} onPress={onDelete} />
      </View>
    </Card>
  );
});
UserRow.displayName = 'UserRow';

// ---------------------------------------------------------------------- cấp tài khoản
const RolePicker: React.FC<{ value: ManagedRole; onChange: (r: ManagedRole) => void }> = ({ value, onChange }) => (
  <Segmented label="Vai trò" options={[{ value: 'teacher' as ManagedRole, label: ROLE_LABEL.teacher }, { value: 'student' as ManagedRole, label: ROLE_LABEL.student }]} value={value} onChange={onChange} />
);

const ErrorBox: React.FC<{ text: string | null }> = ({ text }) => {
  const { c } = useTheme();
  if (!text) return null;
  return (
    <Inset style={{ backgroundColor: c.sonNhat }}>
      <Txt f="bold" size={14} color={c.sonChu} accessibilityRole="alert">
        {text}
      </Txt>
    </Inset>
  );
};

const CreateAccountSheet: React.FC<{ token: string; defaultRole: ManagedRole; classes: string[]; onClose: () => void; onCreated: (c: AccountCredential[]) => void }> = ({
  token, defaultRole, classes, onClose, onCreated,
}) => {
  const { c } = useTheme();
  const [role, setRole] = useState<ManagedRole>(defaultRole);
  const [fullName, setFullName] = useState('');
  const [className, setClassName] = useState(classes[0] ?? '7A1');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (fullName.trim().length < 2) return setError('Họ tên cần ít nhất 2 ký tự.');
    if (username && !/^[a-z0-9._-]{3,32}$/.test(username.trim().toLowerCase())) return setError('Tên đăng nhập chỉ gồm chữ thường không dấu, số, dấu chấm, gạch (3–32 ký tự).');
    if (password && password.length < 6) return setError('Mật khẩu cần ít nhất 6 ký tự.');
    setLoading(true);
    setError(null);
    try {
      onCreated([await adminApi.createUser(token, { full_name: fullName.trim(), role, class_name: className.trim() || null, username: username.trim() || null, password: password || null })]);
    } catch (err) {
      setError(errorMessage(err, 'Không tạo được tài khoản.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Cấp tài khoản mới"
      footer={
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
          <Btn title="Hủy" tone="giay" onPress={onClose} />
          <Btn title="Cấp tài khoản" icon={UserPlus} tone="ngoc" loading={loading} onPress={submit} />
        </View>
      }
    >
      <RolePicker value={role} onChange={setRole} />
      <Field label="Họ và tên *" value={fullName} onChangeText={setFullName} placeholder="vd: Nguyễn Văn Long" autoFocus />
      <Field label={role === 'teacher' ? 'Lớp phụ trách' : 'Lớp'} value={className} onChangeText={setClassName} placeholder="vd: 7A1" autoCapitalize="characters" />
      {classes.length > 0 && <Segmented label="Chọn lớp đã có" options={classes.map((cls) => ({ value: cls, label: cls }))} value={className} onChange={setClassName} />}
      <Field label="Tên đăng nhập" value={username} onChangeText={setUsername} placeholder="Để trống: tự sinh" autoCapitalize="none" autoCorrect={false} />
      <Field label="Mật khẩu tạm" value={password} onChangeText={setPassword} placeholder="Để trống: tự sinh" autoCapitalize="none" autoCorrect={false} />
      <Txt size={13} color={c.muc3}>
        Người dùng sẽ được yêu cầu đổi mật khẩu ở lần đăng nhập đầu tiên.
      </Txt>
      <ErrorBox text={error} />
    </Sheet>
  );
};

const BulkCreateSheet: React.FC<{ token: string; defaultRole: ManagedRole; classes: string[]; onClose: () => void; onCreated: (c: AccountCredential[]) => void }> = ({
  token, defaultRole, classes, onClose, onCreated,
}) => {
  const { c } = useTheme();
  const [role, setRole] = useState<ManagedRole>(defaultRole);
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
      onCreated(await adminApi.bulkCreateUsers(token, role, className.trim() || null, list));
    } catch (err) {
      setError(errorMessage(err, 'Không tạo được tài khoản.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Cấp tài khoản hàng loạt"
      footer={
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
          <Btn title="Hủy" tone="giay" onPress={onClose} />
          <Btn title={`Cấp ${list.length || ''} tài khoản`} icon={UsersRound} tone="ngoc" loading={loading} disabled={list.length === 0} onPress={submit} />
        </View>
      }
    >
      <RolePicker value={role} onChange={setRole} />
      <Field label="Lớp" value={className} onChangeText={setClassName} placeholder="vd: 7A1" autoCapitalize="characters" />
      {classes.length > 0 && <Segmented label="Chọn lớp đã có" options={classes.map((cls) => ({ value: cls, label: cls }))} value={className} onChange={setClassName} />}
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Txt f="bold" size={14} color={c.muc2}>
            Danh sách họ tên (mỗi dòng một người)
          </Txt>
          <Chip text={`${list.length} người`} bg={c.thuyNhat} fg={c.thuyChu} />
        </View>
        <Field
          label="Họ tên"
          value={names}
          onChangeText={setNames}
          placeholder={'Nguyễn Văn Long\nTrần Quốc Anh\nLê Minh Thư\n...'}
          multiline
          numberOfLines={9}
          textAlignVertical="top"
          inputStyle={{ minHeight: 200 }}
          hint="Có thể dán thẳng cột họ tên từ Excel. Số thứ tự đầu dòng sẽ tự bỏ."
          autoFocus
        />
      </View>
      <ErrorBox text={error} />
    </Sheet>
  );
};

// ---------------------------------------------------------------------- phiếu tài khoản
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string);

const CredentialsSheet: React.FC<{ creds: AccountCredential[]; title: string; onClose: () => void }> = ({ creds, title, onClose }) => {
  const { c } = useTheme();
  const toast = useToast();
  const lines = creds.map((x) => `${x.user.full_name} (${x.user.class_name ?? ROLE_LABEL[x.user.role]}) – Trang: ${loginUrl(x.user.role)} – Tên đăng nhập: ${x.user.username} – Mật khẩu: ${x.password}`);
  const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv =
    '﻿' +
    [['Họ tên', 'Vai trò', 'Lớp', 'Trang đăng nhập', 'Tên đăng nhập', 'Mật khẩu tạm'], ...creds.map((x) => [x.user.full_name, ROLE_LABEL[x.user.role], x.user.class_name ?? '', loginUrl(x.user.role), x.user.username, x.password])]
      .map((r) => r.map(cell).join(','))
      .join('\r\n');

  const copyAll = async () => {
    try {
      await Clipboard.setStringAsync(lines.join('\n'));
      toast('Đã sao chép danh sách tài khoản');
    } catch {
      toast('Không sao chép được – hãy dùng Tải CSV');
    }
  };

  const exportCsv = async () => {
    if (Platform.OS !== 'web') {
      await Share.share({ title: 'Tài khoản Đông A', message: csv.slice(1) }).catch(() => undefined);
      return;
    }
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `tai-khoan-dong-a-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printCards = () => {
    const w = window.open('', '_blank');
    if (!w) return toast('Trình duyệt chặn cửa sổ in – hãy cho phép pop-up');
    const cards = creds
      .map(
        (x) => `<div class="card"><div class="brand">Đông A</div><div class="name">${escapeHtml(x.user.full_name)}</div>
        <div class="meta">${escapeHtml(ROLE_LABEL[x.user.role])}${x.user.class_name ? ' • Lớp ' + escapeHtml(x.user.class_name) : ''}</div>
        <div class="row"><span>Tên đăng nhập</span><b>${escapeHtml(x.user.username)}</b></div>
        <div class="row"><span>Mật khẩu tạm</span><b>${escapeHtml(x.password)}</b></div>
        <div class="foot">Đăng nhập tại ${escapeHtml(loginUrl(x.user.role))} và đổi mật khẩu ở lần đầu.</div></div>`,
      )
      .join('');
    w.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Phiếu tài khoản Đông A</title><style>
      body{font-family:"Be Vietnam Pro","Segoe UI",sans-serif;margin:16px;color:#1c1917}
      .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
      .card{border:2px dashed #6b6560;border-radius:14px;padding:14px;break-inside:avoid}
      .brand{color:#b91c1c;font-weight:900;font-size:18px}.name{font-weight:900;font-size:17px;margin-top:4px}
      .meta{color:#57534e;font-size:13px;margin-bottom:8px}.row{display:flex;justify-content:space-between;font-size:14px;padding:3px 0}
      .row b{font-family:Consolas,monospace;font-size:15px}.foot{color:#57534e;font-size:11px;margin-top:8px}
    </style></head><body><div class="grid">${cards}</div></body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={title}
      wide
      footer={
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10 }}>
          <Btn title="Sao chép" icon={ClipboardCopy} tone="giay" onPress={copyAll} />
          <Btn title={Platform.OS === 'web' ? 'Tải CSV' : 'Chia sẻ CSV'} icon={Download} tone="giay" onPress={exportCsv} />
          {Platform.OS === 'web' && <Btn title="In phiếu" icon={Printer} tone="giay" onPress={printCards} />}
          <Btn title="Xong" tone="ngoc" onPress={onClose} />
        </View>
      }
    >
      <Inset style={{ backgroundColor: c.dongNhat, flexDirection: 'row', gap: 8 }}>
        <AlertTriangle size={16} color={c.dongChu} style={{ marginTop: 2 }} />
        <Txt f="bold" size={14} color={c.dongChu} style={{ flex: 1 }}>
          Mật khẩu tạm chỉ hiển thị MỘT lần. Hãy sao chép, tải CSV hoặc in phiếu để phát cho {creds.length > 1 ? `${creds.length} người dùng` : 'người dùng'} trước khi đóng.
        </Txt>
      </Inset>
      <Inset style={{ backgroundColor: c.thuyNhat, gap: 2 }}>
        {creds.some((x) => x.user.role === 'student') && (
          <Txt f="bold" size={14} color={c.thuyChu}>
            Học sinh đăng nhập tại: <Txt f="mono" size={14} color={c.thuyChu}>{loginUrl('student')}</Txt>
          </Txt>
        )}
        {creds.some((x) => x.user.role === 'teacher') && (
          <Txt f="bold" size={14} color={c.thuyChu}>
            Giáo viên đăng nhập tại: <Txt f="mono" size={14} color={c.thuyChu}>{loginUrl('teacher')}</Txt>
          </Txt>
        )}
      </Inset>
      <View style={{ gap: 8 }}>
        {creds.map((x) => (
          <Card key={x.user.id} flat pad={12} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
            <View style={{ flexGrow: 1, flexBasis: 200 }}>
              <Txt f="bold">{x.user.full_name}</Txt>
              <Txt size={13} color={c.muc2}>
                {x.user.class_name ? `Lớp ${x.user.class_name}` : ROLE_LABEL[x.user.role]}
              </Txt>
            </View>
            <View style={{ flexGrow: 1, flexBasis: 160 }}>
              <Txt size={12} color={c.muc3}>
                Tên đăng nhập
              </Txt>
              <Txt f="mono" size={15} color={c.thuyChu} selectable>
                {x.user.username}
              </Txt>
            </View>
            <View style={{ flexGrow: 1, flexBasis: 140 }}>
              <Txt size={12} color={c.muc3}>
                Mật khẩu tạm
              </Txt>
              <Txt f="mono" size={15} selectable>
                {x.password}
              </Txt>
            </View>
          </Card>
        ))}
      </View>
    </Sheet>
  );
};
