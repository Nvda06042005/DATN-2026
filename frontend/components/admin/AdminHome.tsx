/**
 * Hai cổng quản trị độc lập dùng chung màn hình này (không có nút hay liên kết về trang chủ):
 * - Quản trị tổng (/admin): toàn hệ thống – các trường, giáo viên, học sinh từng Khối 6 – 9 của mỗi trường; thêm trường, cấp quản trị trường.
 * - Quản trị trường (/school-manager-admin): chỉ dữ liệu trường mình (server lọc theo school_id trong token và Row-Level Security của PostgreSQL).
 * Cả hai: tìm kiếm, lọc nhanh tài khoản; nhập file Excel mẫu; duyệt lớp; hàng đợi thư; thùng rác 45 ngày.
 * Mật khẩu cấp thủ công hoặc đặt lại chỉ hiện một lần trong phiếu tài khoản.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  AlertTriangle, Check, ClipboardCopy, FileSpreadsheet, KeyRound, LayoutDashboard, Lock, Mail, MapPin, MoreVertical, Printer, School, Search, ShieldCheck, Trash2, Unlock, UserPlus, Users,
} from 'lucide-react-native';
import { AdminWorkspace } from './AdminWorkspace';
import { AdminSelect } from './AdminSelect';
import * as adminApi from '@/api/adminApi';
import { ApiError, errorMessage } from '@/api/client';
import { GradeBadge } from '@/components/art';
import { PORTAL_PATH, PORTAL_TITLE, ROLE_LABEL, type Session } from '@/components/auth';
import { ClassReviewPanel, ImportPanel, IncompletePanel, NotificationBell, OutboxPanel, TrashPanel, useFail } from '@/components/provisioning';
import { AdminUiContext, Avatar, Bar, Btn, Card, Chip, ConfirmSheet, EmptyState, Field, Inset, PressCard, Segmented, Sheet, Skeleton, Spinner, Txt, useToast } from '@/components/ui';
import { onFill, type Palette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { currentSchoolYear, fmt, formatDateTime, pct, webHref } from '@/lib/format';
import type { AccountCredential, AdminOverview, AdminUser, AuthRole, Grade, ManagedRole, SchoolStat, UserFilters, UsersPage } from '@/types/api';
import type { IconType } from '@/types/game';

type AdminTab = 'overview' | 'schools' | 'users' | 'import' | 'classes' | 'mail' | 'trash';
type Modal = null | { kind: 'account'; role?: ManagedRole; schoolId?: number } | { kind: 'school' };

const GRADES: Grade[] = [6, 7, 8, 9];

const roleChip = (c: Palette, role: AuthRole) =>
  role === 'root_admin' || role === 'school_admin' ? { bg: c.sonNhat, fg: c.sonChu } : role === 'teacher' ? { bg: c.thongNhat, fg: c.thongChu } : { bg: c.ngocNhat, fg: c.ngocChu };

/** Trang đăng nhập ghi trên phiếu: giáo viên, học sinh dùng /portal; quản trị trường dùng cổng riêng */
const loginUrl = (role: AuthRole) => {
  const learner = role === 'teacher' || role === 'student';
  return webHref(learner ? '/portal' : PORTAL_PATH[role]) ?? `${learner ? PORTAL_TITLE.app : PORTAL_TITLE[role]} trong app Đông A`;
};

export const AdminHome: React.FC<{ session: Session }> = ({ session }) => {
  const { token, user: me } = session;
  const system = me.role === 'root_admin';
  const { c } = useTheme();
  const toast = useToast();
  const fail = useFail(session);
  const { width } = useWindowDimensions();
  const wide = width >= 1000;
  const [tab, setTab] = useState<AdminTab>('users');
  const [ov, setOv] = useState<AdminOverview | null>(null);
  const [ovError, setOvError] = useState<string | null>(null);
  const [preset, setPreset] = useState<{ key: number; filters: UserFilters }>({ key: 0, filters: {} });
  const [reloadKey, setReloadKey] = useState(0);
  const [modal, setModal] = useState<Modal>(null);
  const [cred, setCred] = useState<{ title: string; item: AccountCredential } | null>(null);

  const loadOverview = useCallback(() => {
    adminApi
      .getOverview(token)
      .then((o) => {
        setOv(o);
        setOvError(null);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) fail(err);
        else setOvError(errorMessage(err, 'Không tải được số liệu'));
      });
  }, [token, fail]);

  useEffect(loadOverview, [loadOverview]);

  /** Số liệu và danh sách tài khoản cùng tải lại (sau khi cấp, khóa, xóa, khôi phục, nhập file) */
  const refresh = useCallback(() => {
    loadOverview();
    setReloadKey((k) => k + 1);
  }, [loadOverview]);

  const schools = useMemo(() => ov?.per_school ?? [], [ov]);
  const mySchool = system ? null : (schools[0] ?? null);
  const mailWaiting = ov ? ov.outbox.queued + ov.outbox.sending + ov.outbox.failed : 0;

  const openUsers = (filters: UserFilters) => {
    setPreset((p) => ({ key: p.key + 1, filters }));
    setTab('users');
  };

  const showCred = (title: string, item: AccountCredential) => {
    setModal(null);
    setCred({ title, item });
    refresh();
  };

  const nav: Array<{ id: AdminTab; label: string; icon: IconType; color: string; count?: number }> = [
    { id: 'users', label: 'Tài khoản', icon: Users, color: c.son },
    { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard, color: c.son },
    ...(system ? [{ id: 'schools' as const, label: 'Trường học', icon: School, color: c.thuy, count: ov?.schools }] : []),
    { id: 'import', label: 'Nhập Excel', icon: FileSpreadsheet, color: c.ngoc, count: ov?.incomplete || undefined },
    { id: 'classes', label: 'Duyệt lớp', icon: Check, color: c.vang, count: ov?.pending_classes || undefined },
    { id: 'mail', label: 'Thư gửi', icon: Mail, color: c.thuy, count: mailWaiting || undefined },
    { id: 'trash', label: 'Thùng rác', icon: Trash2, color: c.son, count: ov?.trash || undefined },
  ];
  const TITLES: Record<AdminTab, [string, string]> = {
    overview: system ? ['Tổng quan hệ thống', 'Toàn bộ trường, giáo viên và học sinh khối 6 – 9'] : [mySchool?.name ?? 'Trường của bạn', `Mã trường ${mySchool?.school_code ?? '—'} · chỉ dữ liệu của trường bạn`],
    schools: ['Trường học', 'Thêm trường, cấp tài khoản quản trị trường'],
    users: ['Tài khoản', system ? 'Tìm và lọc tài khoản của mọi trường' : 'Giáo viên, học sinh của trường'],
    import: ['Nhập file Excel', 'Cấp tài khoản hàng loạt từ file mẫu, gửi thư đăng nhập'],
    classes: ['Duyệt lớp', 'Yêu cầu mở lớp của giáo viên'],
    mail: ['Thư gửi', 'Hàng đợi thư thông tin đăng nhập và thông báo lớp'],
    trash: ['Thùng rác', 'Khôi phục trong 45 ngày trước khi tự xóa vĩnh viễn'],
  };

  const header = (
    <View style={{ gap: 16, paddingBottom: 20 }}>
      <Txt f="bold" upper size={10} color={c.son} style={{ letterSpacing: 1.4 }}>Quản lý {tab === 'users' ? 'tài khoản' : TITLES[tab][0].toLowerCase()}</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flexShrink: 1 }}>
          <Txt f="displayHeavy" size={28} accessibilityRole="header">
            {TITLES[tab][0]}
          </Txt>
          <Txt f="semibold" size={14} color={c.muc2}>
            {TITLES[tab][1]}
          </Txt>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {system && (tab === 'overview' || tab === 'schools') && <Btn title="Thêm trường" icon={School} tone="giay" onPress={() => setModal({ kind: 'school' })} />}
          {tab !== 'users' && <Btn title="Cấp tài khoản" icon={UserPlus} tone="son" onPress={() => setModal({ kind: 'account' })} testID="admin-create" />}
        </View>
      </View>
      {ovError && (
        <Inset style={{ backgroundColor: c.sonNhat, flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <AlertTriangle size={16} color={c.sonChu} />
          <Txt f="bold" size={14} color={c.sonChu} style={{ flex: 1 }}>
            {ovError}
          </Txt>
          <Btn title="Thử lại" size="sm" onPress={loadOverview} />
        </Inset>
      )}
    </View>
  );

  const body = () => {
    switch (tab) {
      case 'overview':
        return <Overview ov={ov} system={system} onUsers={openUsers} go={setTab} />;
      case 'schools':
        return <SchoolsList schools={schools} loading={!ov} onUsers={(id) => openUsers({ school_id: id })} onAdmin={(id) => setModal({ kind: 'account', role: 'school_admin', schoolId: id })} />;
      case 'import':
        return (
          <>
            <ImportPanel
              session={session}
              scope={
                system
                  ? 'Quản trị tổng nhập được cho mọi trường; trường chưa có sẽ được tạo từ cột Trường, Mã số trường, Khu vực, Thành phố.'
                  : `Chỉ nhận dòng của trường ${mySchool?.name ?? 'bạn'} (mã ${mySchool?.school_code ?? '—'}); dòng của trường khác bị từ chối.`
              }
              upload={adminApi.importExcel}
              history={adminApi.getImports}
              credentialsCsv={adminApi.pendingCredentialsCsv}
              onImported={refresh}
            />
            <IncompletePanel key={reloadKey} session={session} />
          </>
        );
      case 'classes':
        return <ClassReviewPanel session={session} onChanged={loadOverview} />;
      case 'mail':
        return <OutboxPanel session={session} />;
      case 'trash':
        return <TrashPanel session={session} onChanged={refresh} />;
      default:
        return null;
    }
  };

  return (
    <AdminUiContext.Provider value>
      <AdminWorkspace session={session} nav={nav} active={tab} onSelect={setTab} extra={system ? undefined : <NotificationBell session={session} />}>
        {tab === 'users' ? (
          <UsersTab key={preset.key} session={session} system={system} schools={schools} preset={preset.filters} reloadKey={reloadKey} header={header} onCreate={() => setModal({ kind: 'account' })} onCred={showCred} onChanged={refresh} />
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: wide ? 28 : 16, gap: 16, width: '100%', maxWidth: 1600, alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
            {header}{body()}
          </ScrollView>
        )}
      </AdminWorkspace>
      {modal?.kind === 'account' && (
        <CreateAccountSheet
          token={token}
          system={system}
          schools={schools}
          role={modal.role}
          schoolId={modal.schoolId}
          onClose={() => setModal(null)}
          onCreated={(item) => showCred('Đã cấp tài khoản', item)}
        />
      )}
      {modal?.kind === 'school' && (
        <CreateSchoolSheet
          token={token}
          onClose={() => setModal(null)}
          onCreated={(s) => {
            toast(`Đã thêm trường ${s.name}`);
            loadOverview();
            setModal({ kind: 'account', role: 'school_admin', schoolId: s.id });
          }}
        />
      )}
      {cred && <CredentialsSheet title={cred.title} cred={cred.item} onClose={() => setCred(null)} />}
    </AdminUiContext.Provider>
  );
};

// ---------------------------------------------------------------------- tổng quan
const Overview: React.FC<{ ov: AdminOverview | null; system: boolean; onUsers: (f: UserFilters) => void; go: (t: AdminTab) => void }> = ({ ov, system, onUsers, go }) => {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  if (!ov) {
    return (
      <View style={{ gap: 12 }}>
        <Skeleton height={170} radius={26} />
        <Skeleton height={90} />
        <Skeleton height={120} />
      </View>
    );
  }
  const people = ov.teachers + ov.students;
  const activated = Math.max(0, people - ov.pending_first_login);
  const school = system ? null : ov.per_school[0];
  const tiles: Array<{ label: string; value: number; icon: IconType; color: string }> = system
    ? [
        { label: 'Trường', value: ov.schools, icon: School, color: c.thuy },
        { label: 'Giáo viên', value: ov.teachers, icon: Users, color: c.thong },
        { label: 'Học sinh', value: ov.students, icon: Users, color: c.ngoc },
        { label: 'Chưa gán trường', value: ov.unassigned, icon: AlertTriangle, color: c.dong },
      ]
    : [
        { label: 'Giáo viên', value: ov.teachers, icon: Users, color: c.thong },
        { label: 'Học sinh', value: ov.students, icon: Users, color: c.ngoc },
        { label: 'Quản trị trường', value: school?.admins ?? 0, icon: ShieldCheck, color: c.dong },
        { label: 'Chưa đăng nhập lần đầu', value: ov.pending_first_login, icon: KeyRound, color: c.hoa },
      ];
  const quests: Array<{ id: AdminTab; label: string; value: number; icon: IconType; color: string }> = [
    { id: 'classes', label: 'Lớp chờ duyệt', value: ov.pending_classes, icon: Check, color: c.vang },
    { id: 'import', label: 'Dòng Excel thiếu thông tin', value: ov.incomplete, icon: FileSpreadsheet, color: c.dong },
    { id: 'mail', label: 'Thư đang chờ / lỗi', value: ov.outbox.queued + ov.outbox.sending + ov.outbox.failed, icon: Mail, color: c.thuy },
    { id: 'trash', label: 'Tài khoản trong thùng rác', value: ov.trash, icon: Trash2, color: c.son },
  ];
  return (
    <View style={{ gap: 16 }}>
      <Card pad={24} style={{ gap: 12 }}>
        <View style={{ flexDirection: width >= 760 ? 'row' : 'column', alignItems: width >= 760 ? 'center' : 'flex-start', gap: 16 }}>
          <View style={{ flex: 1, gap: 8, alignSelf: 'stretch' }}>
            <Chip text={system ? 'QUẢN TRỊ TỔNG · TOÀN HỆ THỐNG' : `QUẢN TRỊ TRƯỜNG · MÃ ${school?.school_code ?? '—'}`} bg={c.adminTint} fg={c.son} />
            <Txt f="displayHeavy" size={28} color={c.muc}>
              {system ? `${fmt(ov.schools)} trường đang tham gia` : (school?.name ?? 'Trường của bạn')}
            </Txt>
            <Txt f="semibold" color={c.muc2}>
              {fmt(ov.teachers)} giáo viên · {fmt(ov.students)} học sinh
              {!system && school?.city ? ` · ${school.city}` : ''}
            </Txt>
            <View style={{ gap: 4, marginTop: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Txt f="bold" size={13} color={c.muc2}>
                  Tài khoản đã kích hoạt
                </Txt>
                <Txt f="display" size={14} color={c.muc} style={{ fontVariant: ['tabular-nums'] }}>
                  {fmt(activated)}/{fmt(people)}
                </Txt>
              </View>
              <Bar value={activated} max={people} height={16} fill={c.son} label={`Đã kích hoạt ${activated} trên ${people} tài khoản`} style={{ backgroundColor: c.adminCanvas }} />
            </View>
          </View>
        </View>
      </Card>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <Card key={t.label} style={{ flexGrow: 1, flexBasis: 150, gap: 6 }} pad={14}>
              <View style={{ width: 42, height: 42, borderRadius: 6, backgroundColor: c.adminTint, alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={22} color={c.son} />
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

      <Card style={{ gap: 12 }}>
        <Txt f="display" size={19} accessibilityRole="header">
          Học sinh theo khối
        </Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {GRADES.map((g) => (
            <PressCard key={g} label={`Xem học sinh khối ${g}`} onPress={() => onUsers({ role: 'student', grade: g })} pad={12} style={{ flexGrow: 1, flexBasis: 140 }}>
              <GradeBadge grade={g} size={42} count={ov.grades[g] ?? 0} />
            </PressCard>
          ))}
        </View>
      </Card>

      <View style={{ gap: 10 }}>
        <Txt f="display" size={19} accessibilityRole="header">
          Nhiệm vụ cần xử lý
        </Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {quests.map((q) => {
            const Icon = q.icon;
            const done = q.value === 0;
            return (
              <PressCard key={q.id} label={`${q.label}: ${q.value}`} onPress={() => go(q.id)} pad={12} style={{ flexGrow: 1, flexBasis: 220, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: done ? 0.75 : 1 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: done ? c.giay2 : q.color, alignItems: 'center', justifyContent: 'center' }}>
                  {done ? <Check size={20} color={c.ngocChu} /> : <Icon size={20} color={onFill(c, q.color)} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Txt f="displayHeavy" size={20}>
                    {fmt(q.value)}
                  </Txt>
                  <Txt f="bold" size={12} color={c.muc2}>
                    {q.label}
                  </Txt>
                </View>
              </PressCard>
            );
          })}
        </View>
      </View>

      {system && (
        <View style={{ gap: 10 }}>
          <Txt f="display" size={19} accessibilityRole="header">
            Học sinh từng khối theo trường
          </Txt>
          {ov.per_school.length === 0 ? (
            <EmptyState title="Chưa có trường nào" text="Thêm trường, hoặc nhập file Excel mẫu: trường mới được tạo từ cột Trường và Mã số trường." />
          ) : (
            ov.per_school.map((s) => <SchoolCard key={s.id} s={s} onPress={() => onUsers({ school_id: s.id })} />)
          )}
        </View>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <Chip text={ov.features.rls_school_scope ? 'Phân quyền dữ liệu theo trường (RLS): bật' : 'RLS theo trường: chưa bật trên CSDL này'} bg={ov.features.rls_school_scope ? c.ngocNhat : c.dongNhat} fg={ov.features.rls_school_scope ? c.ngocChu : c.dongChu} />
        <Chip text={ov.features.pgvector ? 'Đối chiếu nhập lại: pgvector' : 'Đối chiếu nhập lại: so khớp dự phòng'} bg={c.thuyNhat} fg={c.thuyChu} />
        <Chip text={ov.features.smtp ? 'Gửi thư: đã cấu hình' : 'Gửi thư: chưa cấu hình SMTP'} bg={ov.features.smtp ? c.ngocNhat : c.dongNhat} fg={ov.features.smtp ? c.ngocChu : c.dongChu} />
      </View>
    </View>
  );
};

const SchoolCard: React.FC<{ s: SchoolStat; onPress: () => void; children?: React.ReactNode }> = ({ s, onPress, children }) => {
  const { c } = useTheme();
  return (
    <Card pad={14} style={{ gap: 10 }}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${s.name}: ${s.teachers} giáo viên, ${s.students} học sinh. Xem tài khoản`} style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <View style={{ minWidth: 56, height: 44, paddingHorizontal: 8, borderRadius: 12, backgroundColor: c.thuy, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 4, borderBottomColor: 'rgba(0,0,0,0.2)' }}>
            <Txt f="display" size={14} color="#ffffff">
              {s.school_code}
            </Txt>
          </View>
          <View style={{ flex: 1, minWidth: 180 }}>
            <Txt f="bold">{s.name}</Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <MapPin size={12} color={c.muc3} />
              <Txt size={12} color={c.muc2} numberOfLines={1}>
                {[s.region, s.city].filter(Boolean).join(' · ') || 'Chưa có khu vực'}
              </Txt>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <Chip text={`${fmt(s.teachers)} GV`} bg={c.thongNhat} fg={c.thongChu} />
            <Chip text={`${fmt(s.students)} HS`} bg={c.ngocNhat} fg={c.ngocChu} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {GRADES.map((g) => (
            <GradeBadge key={g} grade={g} size={26} count={s.grades[g] ?? 0} />
          ))}
        </View>
      </Pressable>
      {children}
    </Card>
  );
};

const SchoolsList: React.FC<{ schools: SchoolStat[]; loading: boolean; onUsers: (id: number) => void; onAdmin: (id: number) => void }> = ({ schools, loading, onUsers, onAdmin }) => {
  const { c } = useTheme();
  if (loading) return <Skeleton height={120} />;
  if (!schools.length) return <EmptyState title="Chưa có trường nào" text="Bấm Thêm trường, hoặc nhập file Excel mẫu: trường mới được tạo từ cột Trường và Mã số trường." />;
  return (
    <View style={{ gap: 10 }}>
      {schools.map((s) => (
        <SchoolCard key={s.id} s={s} onPress={() => onUsers(s.id)}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <Txt size={13} color={s.admins ? c.muc2 : c.dongChu} style={{ flex: 1, minWidth: 160 }}>
              {s.admins ? `${s.admins} quản trị trường` : 'Chưa có quản trị trường'}
            </Txt>
            <Btn title="Xem tài khoản" icon={Users} tone="giay" size="sm" onPress={() => onUsers(s.id)} />
            <Btn title="Cấp quản trị trường" icon={ShieldCheck} tone="dong" size="sm" onPress={() => onAdmin(s.id)} />
          </View>
        </SchoolCard>
      ))}
    </View>
  );
};

// ---------------------------------------------------------------------- danh sách tài khoản
const PAGE = 50;

const UsersTab: React.FC<{
  session: Session;
  system: boolean;
  schools: SchoolStat[];
  preset: UserFilters;
  reloadKey: number;
  header: React.ReactElement;
  onCred: (title: string, item: AccountCredential) => void;
  onCreate: () => void;
  onChanged: () => void;
}> = ({ session, system, schools, preset, reloadKey, header, onCred, onCreate, onChanged }) => {
  const { c } = useTheme();
  const toast = useToast();
  const fail = useFail(session);
  const me = session.user;
  const { width } = useWindowDimensions();
  const table = width >= 1180;
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<AuthRole | 'all'>(preset.role ?? 'all');
  const [grade, setGrade] = useState<number>(preset.grade ?? 0);
  const [schoolId, setSchoolId] = useState<number>(preset.school_id ?? 0);
  const [schoolYear, setSchoolYear] = useState('all');
  const [region, setRegion] = useState('all');
  const [city, setCity] = useState('all');
  const [advanced, setAdvanced] = useState(!!preset.school_id);
  const [page, setPage] = useState<UsersPage | null>(null);
  const [items, setItems] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [confirm, setConfirm] = useState<null | { kind: 'reset' | 'trash'; user: AdminUser }>(null);
  const [busy, setBusy] = useState(false);
  const req = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const filters = useMemo<UserFilters>(
    () => ({
      q: query || undefined,
      role: role === 'all' ? undefined : role,
      grade: grade || undefined,
      school_id: schoolId || undefined,
      school_year: schoolYear === 'all' ? undefined : schoolYear,
      region: region === 'all' ? undefined : region,
      city: city === 'all' ? undefined : city,
      limit: PAGE,
    }),
    [query, role, grade, schoolId, schoolYear, region, city],
  );

  const load = useCallback(
    async (next: number) => {
      const id = ++req.current;
      if (next === 1) setLoading(true);
      else setMore(true);
      try {
        const res = await adminApi.getUsers(session.token, { ...filters, page: next });
        if (id !== req.current) return;
        setPage(res);
        setItems((prev) => (next === 1 ? res.items : [...prev, ...res.items]));
      } catch (err) {
        if (id === req.current) fail(err);
      } finally {
        if (id === req.current) {
          setLoading(false);
          setMore(false);
        }
      }
    },
    [session.token, filters, fail],
  );

  useEffect(() => {
    load(1);
  }, [load, reloadKey]);

  const toggleActive = async (u: AdminUser) => {
    try {
      await adminApi.setUserActive(session.token, u.id, !u.is_active);
      toast(u.is_active ? `Đã khóa tài khoản ${u.username}` : `Đã mở khóa tài khoản ${u.username}`);
      setItems((list) => list.map((x) => (x.id === u.id ? { ...x, is_active: !u.is_active } : x)));
    } catch (err) {
      fail(err);
    }
  };

  const runConfirm = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.kind === 'reset') {
        const cred = await adminApi.resetUserPassword(session.token, confirm.user.id);
        setConfirm(null);
        onCred('Mật khẩu tạm mới', cred);
      } else {
        await adminApi.trashUser(session.token, confirm.user.id);
        toast(`Đã chuyển ${confirm.user.full_name} vào thùng rác (khôi phục được trong 45 ngày)`);
        setConfirm(null);
        onChanged();
      }
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const canManage = (u: AdminUser) => u.role !== 'root_admin' && u.id !== me.id && (system || u.role !== 'school_admin');
  const facets = page?.facets;
  const roleOptions: Array<{ value: AuthRole | 'all'; label: string }> = [
    { value: 'all', label: 'Mọi vai trò' },
    ...(system ? [{ value: 'school_admin' as const, label: 'Quản trị trường' }] : []),
    { value: 'teacher', label: 'Giáo viên' },
    { value: 'student', label: 'Học sinh' },
  ];
  const facetPicker = (label: string, values: string[] | undefined, value: string, onChange: (v: string) => void) =>
    values && values.length > 1 ? <View style={{ flexGrow: 1, flexBasis: 160 }}><AdminSelect label={label} options={[{ value: 'all', label: 'Tất cả' }, ...values.map(v => ({ value: v, label: v }))]} value={value} onChange={onChange} /></View> : null;
  const clearFilters = () => { setQ(''); setQuery(''); setRole('all'); setGrade(0); setSchoolId(0); setSchoolYear('all'); setRegion('all'); setCity('all'); setAdvanced(false); };
  const filtersUi = (
    <View style={{ backgroundColor: c.the, borderWidth: 1, borderColor: c.adminLine, borderBottomWidth: 0, borderTopLeftRadius: 8, borderTopRightRadius: 8 }}>
      <View style={{ padding: table ? 24 : 16, gap: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Txt f="bold" size={18} accessibilityRole="header">Tài khoản người dùng</Txt><Chip text={loading ? '…' : fmt(page?.total ?? 0)} bg={c.adminTint} fg={c.son} /></View>
          <Txt size={12} color={c.muc3}>Quản lý tài khoản, phân quyền và thông tin đăng nhập.</Txt>
        </View>
        <Btn title="Cấp tài khoản" icon={UserPlus} tone="son" size="sm" onPress={onCreate} testID="admin-create" />
      </View>
      <View style={{ paddingHorizontal: table ? 24 : 16, borderBottomWidth: 1, borderBottomColor: c.adminLine }}><View style={{ alignSelf: 'flex-start', borderBottomWidth: 2, borderBottomColor: c.son, paddingVertical: 12 }}><Txt f="bold" size={13} color={c.son}>Tài khoản</Txt></View></View>
      <View style={{ padding: table ? 24 : 16, gap: 14 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <Field label="Nhập từ khóa tìm kiếm" value={q} onChangeText={setQ} placeholder="Họ tên, tên đăng nhập hoặc email…" autoCapitalize="none" autoCorrect={false} returnKeyType="search" nativeID="admin-search" style={{ flexGrow: 2, flexBasis: 260 }} />
          <View style={{ flexGrow: 1, flexBasis: 160 }}><AdminSelect label="Vai trò" testID="admin-role-filter" options={roleOptions} value={role} onChange={setRole} /></View>
          <View style={{ flexGrow: 1, flexBasis: 140 }}><AdminSelect label="Khối" testID="admin-grade-filter" options={[{ value: 0, label: 'Tất cả khối' }, ...GRADES.map(g => ({ value: g as number, label: `Khối ${g}` }))]} value={grade} onChange={setGrade} /></View>
          <Btn title="Xóa bộ lọc" tone="giay" size="sm" onPress={clearFilters} testID="admin-clear-filters" />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Btn title={advanced ? 'Ẩn bộ lọc khác' : 'Lọc theo trường, năm học, khu vực'} icon={Search} tone="ghost" size="sm" onPress={() => setAdvanced(value => !value)} selected={advanced} />
          <Txt size={12} color={c.muc3} accessibilityLiveRegion="polite">{loading ? 'Đang tìm…' : `${fmt(page?.total ?? 0)} tài khoản phù hợp`}</Txt>
        </View>
        {advanced && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {system && schools.length > 0 && <View style={{ flexGrow: 1, flexBasis: 220 }}><AdminSelect label="Trường" testID="admin-school-filter" options={[{ value: 0, label: 'Tất cả trường' }, ...schools.map(school => ({ value: school.id, label: `${school.school_code} · ${school.name}` }))]} value={schoolId} onChange={setSchoolId} /></View>}
          {facetPicker('Năm học', facets?.school_years, schoolYear, setSchoolYear)}
          {facetPicker('Khu vực', facets?.regions, region, setRegion)}
          {facetPicker('Thành phố', facets?.cities, city, setCity)}
          {!(facets && (facets.school_years.length > 1 || facets.regions.length > 1 || facets.cities.length > 1)) && !(system && schools.length > 0) && <Txt size={13} color={c.muc2}>Chưa có thêm dữ liệu để lọc.</Txt>}
        </View>}
      </View>
      {table && <View testID="admin-table-head" style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14, backgroundColor: c.adminTint, borderTopWidth: 1, borderTopColor: c.adminLine, gap: 18 }}>
        <Txt f="bold" size={11} color={c.muc2} style={{ width: 36 }}>STT</Txt>
        <Txt f="bold" size={11} color={c.muc2} style={{ flex: 3 }}>Người dùng</Txt>
        <Txt f="bold" size={11} color={c.muc2} style={{ flex: 1.2 }}>Vai trò</Txt>
        <Txt f="bold" size={11} color={c.muc2} style={{ flex: 1.1 }}>Trạng thái</Txt>
        <Txt f="bold" size={11} color={c.muc2} style={{ flex: 1.5 }}>Đăng nhập gần nhất</Txt>
        <Txt f="bold" size={11} color={c.muc2} style={{ width: 54 }} center>Thao tác</Txt>
      </View>}
    </View>
  );

  return (
    <>
      <FlatList
        style={{ flex: 1 }}
        data={loading ? [] : items}
        keyExtractor={(u) => String(u.id)}
        ListHeaderComponent={
          <>
            {header}
            {filtersUi}
          </>
        }
        contentContainerStyle={{ padding: table ? 28 : 16, width: '100%', maxWidth: 1600, alignSelf: 'center', paddingBottom: 32 }}
        renderItem={({ item, index }) => (
          <UserRow index={index + 1} table={table}
            u={item}
            system={system}
            manage={canManage(item)}
            onReset={() => setConfirm({ kind: 'reset', user: item })}
            onToggle={() => toggleActive(item)}
            onTrash={() => setConfirm({ kind: 'trash', user: item })}
          />
        )}
        ListEmptyComponent={
          loading ? (
            <Spinner label="Đang tải danh sách tài khoản…" />
          ) : (
            <EmptyState
              title={filters.q || filters.role || filters.grade || filters.school_id ? 'Không tìm thấy kết quả phù hợp' : 'Chưa có tài khoản nào'}
              text={filters.q || filters.role || filters.grade || filters.school_id ? 'Thử đổi từ khóa hoặc bộ lọc.' : 'Vào mục Nhập Excel để cấp tài khoản hàng loạt từ file mẫu.'}
            />
          )
        }
        ListFooterComponent={!loading && page ? <View style={{ padding: 20, backgroundColor: c.the, borderWidth: 1, borderTopWidth: 0, borderColor: c.adminLine, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, gap: 16 }}>
          <Txt size={12} color={c.muc3}>Hiển thị {fmt(items.length)} / {fmt(page.total)} tài khoản</Txt>
          {items.length < page.total && <Btn title={`Xem thêm (${fmt(page.total - items.length)} tài khoản)`} tone="giay" loading={more} onPress={() => load(page.page + 1)} style={{ alignSelf: 'center' }} />}
        </View> : undefined}
        keyboardShouldPersistTaps="handled"
      />
      <ConfirmSheet
        open={!!confirm}
        title={confirm?.kind === 'reset' ? 'Đặt lại mật khẩu?' : 'Chuyển vào thùng rác?'}
        tone={confirm?.kind === 'trash' ? 'son' : 'ngoc'}
        busy={busy}
        confirmLabel={confirm?.kind === 'reset' ? 'Đặt lại' : 'Chuyển vào thùng rác'}
        message={
          confirm
            ? confirm.kind === 'reset'
              ? `Mật khẩu hiện tại của ${confirm.user.full_name} (${confirm.user.username}) sẽ ngừng hoạt động và hệ thống cấp một mật khẩu tạm mới.`
              : `Tài khoản ${confirm.user.full_name} (${confirm.user.username}) không đăng nhập được nữa và nằm trong thùng rác 45 ngày (khôi phục được), sau đó tự xóa vĩnh viễn cùng tiến độ học tập.`
            : ''
        }
        onConfirm={runConfirm}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
};

const UserRow = React.memo<{ u: AdminUser; index: number; table: boolean; system: boolean; manage: boolean; onReset: () => void; onToggle: () => void; onTrash: () => void }>(({ u, index, table, system, manage, onReset, onToggle, onTrash }) => {
  const { c } = useTheme();
  const [actions, setActions] = useState(false);
  const chip = roleChip(c, u.role);
  const identity = <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.adminTint, alignItems: 'center', justifyContent: 'center' }}><Txt f="bold" size={13} color={c.son}>{u.full_name.trim().charAt(0).toUpperCase()}</Txt></View>
    <View style={{ flex: 1, minWidth: 0, gap: 2 }}><Txt f="bold" size={13} numberOfLines={1}>{u.full_name}</Txt><Txt size={12} color={c.muc3} numberOfLines={1} selectable>{u.email || u.username}</Txt>{system && u.school_name && <Txt size={11} color={c.muc3} numberOfLines={1}>{u.school_name}</Txt>}</View>
  </View>;
  const status = <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: u.is_active ? c.moc : c.son }} /><Txt size={12} color={c.muc2}>{u.is_active ? 'Đang hoạt động' : 'Đã khóa'}</Txt></View>;
  const actionButton = manage ? <Pressable testID={`admin-user-actions-${u.id}`} accessibilityRole="button" accessibilityLabel={`Thao tác với ${u.full_name}`} accessibilityState={{ expanded: actions }} onPress={() => setActions(value => !value)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 5, backgroundColor: actions ? c.adminTint : 'transparent' }}><MoreVertical size={19} color={c.muc2} /></Pressable> : <Txt size={13} color={c.muc3}>—</Txt>;
  return <View testID={`admin-user-${u.id}`} style={{ backgroundColor: c.the, borderWidth: 1, borderTopWidth: 0, borderColor: c.adminLine, opacity: u.is_active ? 1 : 0.8 }}>
    {table ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, paddingHorizontal: 24, paddingVertical: 16, minHeight: 94 }}>
      <Txt size={12} color={c.muc3} style={{ width: 36 }}>{index}</Txt>
      <View style={{ flex: 3, minWidth: 0 }}>{identity}</View>
      <View style={{ flex: 1.2, minWidth: 0 }}><Chip text={ROLE_LABEL[u.role]} bg={chip.bg} fg={chip.fg} style={{ borderRadius: 4, paddingHorizontal: 6 }} />{u.class_name && <Txt size={11} color={c.muc3}>{u.class_name}{u.grade ? ` · Khối ${u.grade}` : ''}</Txt>}</View>
      <View style={{ flex: 1.1 }}>{status}</View>
      <Txt size={12} color={c.muc2} style={{ flex: 1.5 }}>{u.last_login_at ? formatDateTime(u.last_login_at) : 'Chưa đăng nhập'}</Txt>
      <View style={{ width: 54, alignItems: 'center' }}>{actionButton}</View>
    </View> : <View style={{ padding: 16, gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{identity}{actionButton}</View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}><Chip text={ROLE_LABEL[u.role]} bg={chip.bg} fg={chip.fg} />{status}{u.class_name && <Txt size={12} color={c.muc3}>Lớp {u.class_name}</Txt>}</View>
      <Txt size={12} color={c.muc3}>Đăng nhập gần nhất: {u.last_login_at ? formatDateTime(u.last_login_at) : 'Chưa đăng nhập'}</Txt>
    </View>}
    {actions && <View testID={`admin-user-menu-${u.id}`} style={{ padding: 16, backgroundColor: c.adminTint, borderTopWidth: 1, borderTopColor: c.adminLine, gap: 12 }}>
      <Txt size={12} color={c.muc2} selectable>{u.username}{u.school_year ? ` · ${u.school_year}` : ''}{u.must_change_password ? ' · Chưa đổi mật khẩu lần đầu' : ''}{u.role === 'student' ? ` · ${fmt(u.xp ?? 0)} XP · ${u.lessons_completed ?? 0} lượt học · đúng ${pct(u.accuracy)}` : ''}</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
        <Btn tone="giay" size="sm" icon={KeyRound} title="Đặt lại mật khẩu" label={`Đặt lại mật khẩu cho ${u.full_name}`} onPress={() => { setActions(false); onReset(); }} />
        <Btn tone="giay" size="sm" icon={u.is_active ? Lock : Unlock} title={u.is_active ? 'Khóa tài khoản' : 'Mở khóa tài khoản'} label={u.is_active ? `Khóa tài khoản ${u.full_name}` : `Mở khóa tài khoản ${u.full_name}`} onPress={() => { setActions(false); onToggle(); }} />
        <Btn tone="giay" size="sm" icon={Trash2} title="Thùng rác" label={`Chuyển ${u.full_name} vào thùng rác`} onPress={() => { setActions(false); onTrash(); }} />
      </View>
    </View>}
  </View>;
});
UserRow.displayName = 'UserRow';

// ---------------------------------------------------------------------- cấp tài khoản, thêm trường
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

const CreateAccountSheet: React.FC<{
  token: string;
  system: boolean;
  schools: SchoolStat[];
  role?: ManagedRole;
  schoolId?: number;
  onClose: () => void;
  onCreated: (cred: AccountCredential) => void;
}> = ({ token, system, schools, role: presetRole, schoolId: presetSchool, onClose, onCreated }) => {
  const { c } = useTheme();
  const [role, setRole] = useState<ManagedRole>(presetRole ?? 'teacher');
  const [schoolId, setSchoolId] = useState<number>(presetSchool ?? schools[0]?.id ?? 0);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [grade, setGrade] = useState<Grade>(7);
  const [schoolYear, setSchoolYear] = useState(currentSchoolYear());
  const [className, setClassName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (fullName.trim().length < 2) return setError('Họ tên cần ít nhất 2 ký tự.');
    if (system && !schoolId) return setError('Hãy chọn trường (thêm trường trước nếu chưa có).');
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Email chưa đúng định dạng.');
    if (role !== 'school_admin' && schoolYear.trim() && !/^\d{4}-\d{4}$/.test(schoolYear.trim())) return setError('Năm học có dạng 2025-2026.');
    if (username.trim() && !/^[a-z0-9._@-]{3,64}$/.test(username.trim().toLowerCase())) return setError('Tên đăng nhập chỉ gồm chữ thường không dấu, số, dấu chấm, gạch, @ (3–64 ký tự).');
    if (password && password.length < 6) return setError('Mật khẩu cần ít nhất 6 ký tự.');
    setLoading(true);
    setError(null);
    try {
      onCreated(
        await adminApi.createUser(token, {
          full_name: fullName.trim(),
          role,
          school_id: system ? schoolId : undefined,
          class_name: role === 'school_admin' ? null : className.trim() || null,
          grade: role === 'student' ? grade : null,
          school_year: role === 'school_admin' ? null : schoolYear.trim() || null,
          email: email.trim() || null,
          username: username.trim().toLowerCase() || null,
          password: password || null,
        }),
      );
    } catch (err) {
      setError(errorMessage(err, 'Không tạo được tài khoản.'));
    } finally {
      setLoading(false);
    }
  };

  const roles: Array<{ value: ManagedRole; label: string }> = [
    ...(system ? [{ value: 'school_admin' as const, label: ROLE_LABEL.school_admin }] : []),
    { value: 'teacher', label: ROLE_LABEL.teacher },
    { value: 'student', label: ROLE_LABEL.student },
  ];

  return (
    <Sheet
      open
      onClose={onClose}
      title="Cấp tài khoản mới"
      subtitle="Tài khoản lẻ; cấp hàng loạt dùng mục Nhập Excel"
      footer={
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
          <Btn title="Hủy" tone="giay" onPress={onClose} />
          <Btn title="Cấp tài khoản" icon={UserPlus} tone="ngoc" loading={loading} onPress={submit} testID="create-submit" />
        </View>
      }
    >
      <Segmented label="Vai trò" options={roles} value={role} onChange={setRole} />
      {system &&
        (schools.length ? (
          <Segmented label="Trường" options={schools.map((s) => ({ value: s.id, label: `${s.school_code} · ${s.name}` }))} value={schoolId} onChange={setSchoolId} />
        ) : (
          <Txt size={14} color={c.dongChu}>
            Chưa có trường nào – hãy thêm trường trước.
          </Txt>
        ))}
      <Field label="Họ và tên *" value={fullName} onChangeText={setFullName} placeholder="vd: Nguyễn Văn Long" autoFocus nativeID="create-name" />
      <Field label="Email (nhận thông báo, thư đăng nhập)" value={email} onChangeText={setEmail} placeholder="vd: long@truong.edu.vn" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />
      {role === 'student' && <Segmented label="Khối" options={GRADES.map((g) => ({ value: g, label: `Khối ${g}` }))} value={grade} onChange={setGrade} />}
      {role !== 'school_admin' && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Field label="Năm học" value={schoolYear} onChangeText={setSchoolYear} placeholder="2025-2026" style={{ flexGrow: 1, flexBasis: 160 }} />
          <Field label={role === 'teacher' ? 'Lớp phụ trách' : 'Lớp'} value={className} onChangeText={setClassName} placeholder="vd: 7A1" autoCapitalize="characters" style={{ flexGrow: 1, flexBasis: 160 }} />
        </View>
      )}
      <Field label="Tên đăng nhập" value={username} onChangeText={setUsername} placeholder="Để trống: tự sinh" autoCapitalize="none" autoCorrect={false} />
      <Field label="Mật khẩu tạm" value={password} onChangeText={setPassword} placeholder="Để trống: tự sinh" autoCapitalize="none" autoCorrect={false} />
      <Txt size={13} color={c.muc3}>
        Người dùng phải đổi mật khẩu ở lần đăng nhập đầu tiên.
      </Txt>
      <ErrorBox text={error} />
    </Sheet>
  );
};

const CreateSchoolSheet: React.FC<{ token: string; onClose: () => void; onCreated: (s: SchoolStat) => void }> = ({ token, onClose, onCreated }) => {
  const { c } = useTheme();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [region, setRegion] = useState('');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!/\d/.test(code)) return setError('Mã số trường cần có chữ số (vd: 0480).');
    if (name.trim().length < 2) return setError('Tên trường cần ít nhất 2 ký tự.');
    setLoading(true);
    setError(null);
    try {
      onCreated(await adminApi.createSchool(token, { school_code: code.trim(), name: name.trim(), region: region.trim() || null, city: city.trim() || null }));
    } catch (err) {
      setError(errorMessage(err, 'Không thêm được trường.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Thêm trường"
      subtitle="Sau khi thêm, cấp tài khoản quản trị cho trường"
      footer={
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
          <Btn title="Hủy" tone="giay" onPress={onClose} />
          <Btn title="Thêm trường" icon={School} tone="ngoc" loading={loading} onPress={submit} />
        </View>
      }
    >
      <Field label="Mã số trường *" value={code} onChangeText={setCode} placeholder="vd: 0480" keyboardType="number-pad" autoFocus hint="Dùng trong tên đăng nhập (4 chữ số cuối)." />
      <Field label="Tên trường *" value={name} onChangeText={setName} placeholder="vd: THCS Trần Hưng Đạo" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Field label="Khu vực" value={region} onChangeText={setRegion} placeholder="vd: Miền Bắc" style={{ flexGrow: 1, flexBasis: 160 }} />
        <Field label="Thành phố" value={city} onChangeText={setCity} placeholder="vd: Hà Nội" style={{ flexGrow: 1, flexBasis: 160 }} />
      </View>
      <Txt size={13} color={c.muc3}>
        Nhập file Excel mẫu cũng tự tạo trường chưa có từ cột Trường, Mã số trường, Khu vực, Thành phố.
      </Txt>
      <ErrorBox text={error} />
    </Sheet>
  );
};

// ---------------------------------------------------------------------- phiếu tài khoản
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string);

const CredentialsSheet: React.FC<{ cred: AccountCredential; title: string; onClose: () => void }> = ({ cred, title, onClose }) => {
  const { c } = useTheme();
  const toast = useToast();
  const u = cred.user;
  const url = loginUrl(u.role);
  const text = `${u.full_name} (${ROLE_LABEL[u.role]}) – Trang: ${url} – Tên đăng nhập: ${u.username} – Mật khẩu: ${cred.password}`;

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(text);
      toast('Đã sao chép thông tin tài khoản');
    } catch {
      toast('Không sao chép được – hãy ghi lại thông tin');
    }
  };

  const printCard = () => {
    const w = window.open('', '_blank');
    if (!w) return toast('Trình duyệt chặn cửa sổ in – hãy cho phép pop-up');
    w.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Phiếu tài khoản Đông A</title><style>
      body{font-family:"Manrope","Segoe UI",sans-serif;margin:16px;color:#1c1917}
      .card{border:2px dashed #6b6560;border-radius:14px;padding:14px;max-width:420px}
      .brand{color:#c97500;font-weight:900;font-size:18px}.name{font-weight:900;font-size:17px;margin-top:4px}
      .meta{color:#57534e;font-size:13px;margin-bottom:8px}.row{display:flex;justify-content:space-between;font-size:14px;padding:3px 0}
      .row b{font-family:Consolas,monospace;font-size:15px}.foot{color:#57534e;font-size:11px;margin-top:8px}
    </style></head><body><div class="card"><div class="brand">Đông A</div><div class="name">${escapeHtml(u.full_name)}</div>
      <div class="meta">${escapeHtml(ROLE_LABEL[u.role])}${u.class_name ? ' • Lớp ' + escapeHtml(u.class_name) : ''}</div>
      <div class="row"><span>Tên đăng nhập</span><b>${escapeHtml(u.username)}</b></div>
      <div class="row"><span>Mật khẩu tạm</span><b>${escapeHtml(cred.password)}</b></div>
      <div class="foot">Đăng nhập tại ${escapeHtml(url)} và đổi mật khẩu ở lần đầu.</div></div></body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={title}
      footer={
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10 }}>
          <Btn title="Sao chép" icon={ClipboardCopy} tone="giay" onPress={copy} />
          {Platform.OS === 'web' && <Btn title="In phiếu" icon={Printer} tone="giay" onPress={printCard} />}
          <Btn title="Xong" tone="ngoc" onPress={onClose} />
        </View>
      }
    >
      <Inset style={{ backgroundColor: c.dongNhat, flexDirection: 'row', gap: 8 }}>
        <AlertTriangle size={16} color={c.dongChu} style={{ marginTop: 2 }} />
        <Txt f="bold" size={14} color={c.dongChu} style={{ flex: 1 }}>
          Mật khẩu tạm chỉ hiển thị MỘT lần. Hãy sao chép hoặc in phiếu để giao cho người dùng trước khi đóng.
        </Txt>
      </Inset>
      <Card flat pad={14} style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {u.role === 'student' && u.grade ? <GradeBadge grade={u.grade} size={34} /> : <Avatar name={u.full_name} size={38} />}
          <View style={{ flex: 1 }}>
            <Txt f="bold">{u.full_name}</Txt>
            <Txt size={13} color={c.muc2}>
              {ROLE_LABEL[u.role]}
              {u.school_code ? ` · Trường ${u.school_code}` : ''}
              {u.class_name ? ` · Lớp ${u.class_name}` : ''}
            </Txt>
          </View>
        </View>
        <View>
          <Txt size={12} color={c.muc3}>
            Tên đăng nhập
          </Txt>
          <Txt f="mono" size={16} color={c.thuyChu} selectable testID="cred-username">
            {u.username}
          </Txt>
        </View>
        <View>
          <Txt size={12} color={c.muc3}>
            Mật khẩu tạm
          </Txt>
          <Txt f="mono" size={16} selectable testID="cred-password">
            {cred.password}
          </Txt>
        </View>
        <View>
          <Txt size={12} color={c.muc3}>
            Trang đăng nhập
          </Txt>
          <Txt f="mono" size={14} color={c.thuyChu} selectable>
            {url}
          </Txt>
        </View>
      </Card>
    </Sheet>
  );
};
