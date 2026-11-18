/**
 * Danh sách cụ thể sau số liệu của trang thống kê (18/11/2026, người dùng chọn "bấm số liệu để xem danh sách"): bấm một ô số liệu mở bảng
 * trường / người / lớp / người hoạt động kèm lần hoạt động cuối; bảng "Theo từng trường" thay bốn thẻ tóm tắt cũ của Thống kê hệ thống,
 * bảng "Theo từng lớp" thay bốn thẻ tóm tắt cũ của Thống kê trường (quản trị trường làm tương ứng quản trị tổng).
 * Dữ liệu: GET /api/analytics/details?kind=… (quản trị trường chỉ thấy trường mình).
 */
import { View } from 'react-native';
import { apiRequest } from '@/api/client';
import { Cell, DataTable, ErrorNote, NameCell, StatusChip, useLoad } from '@/components/admin/kit';
import { ROLE_TEXT, dateText } from '@/components/admin/AccountSheet';
import type { Session } from '@/components/auth';
import { Card, Sheet, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { fmt } from '@/lib/format';
import type { AuthRole } from '@/types/api';

export type DetailKind = 'schools' | 'students' | 'teachers' | 'classes' | 'active_today' | 'active_7' | 'active_30';
export interface DetailRow {
  id: number; name?: string; full_name?: string; user_code?: string | null; role?: AuthRole; school_name?: string | null; school_code?: string; city?: string | null; is_active?: boolean;
  teachers?: number | string; students?: number; active_7?: number; active_30?: number; lessons_30?: number; ai_30?: number; last_activity?: string | null; last_login_at?: string | null;
  classes?: string; grade?: number | null; school_year?: string; events?: number;
}
export const dashboardDetails = (token: string, kind: DetailKind) => apiRequest<DetailRow[]>(`/api/analytics/details?kind=${kind}`, { token });

export const DETAIL_TITLE: Record<DetailKind, string> = {
  schools: 'Các trường', students: 'Học sinh', teachers: 'Giáo viên', classes: 'Lớp đang hoạt động',
  active_today: 'Người hoạt động hôm nay', active_7: 'Người hoạt động 7 ngày qua', active_30: 'Người hoạt động 30 ngày qua',
};

const when = (iso: string | null | undefined) => (iso ? dateText(iso) : 'Chưa có');

/** Bảng theo từng trường (giáo viên, học sinh, người hoạt động, bài học, câu hỏi AI) */
export function SchoolsTable({ rows, compact = false }: { rows: DetailRow[]; compact?: boolean }) {
  const { c } = useTheme();
  return <DataTable paginate={!compact} rows={rows} rowKey={(r) => r.id} empty="Chưa có trường nào."
    columns={[
      { key: 'name', label: 'Trường', flex: 2, render: (r) => <NameCell main={r.name ?? ''} sub={[r.school_code, r.city].filter(Boolean).join(' · ')} /> },
      { key: 'status', label: 'Trạng thái', render: (r) => <StatusChip kind={r.is_active ? 'on' : 'off'} text={r.is_active ? 'Hoạt động' : 'Vô hiệu hóa'} /> },
      { key: 'teachers', label: 'Giáo viên', flex: 0.7, render: (r) => <Txt size={14}>{fmt(Number(r.teachers ?? 0))}</Txt> },
      { key: 'students', label: 'Học sinh', flex: 0.7, render: (r) => <Txt size={14}>{fmt(r.students ?? 0)}</Txt> },
      { key: 'active', label: 'Hoạt động 7 / 30 ngày', render: (r) => <Txt size={14}>{fmt(r.active_7 ?? 0)} / {fmt(r.active_30 ?? 0)} người</Txt> },
      { key: 'lessons', label: 'Bài học 30 ngày', flex: 0.8, render: (r) => <Txt size={14}>{fmt(r.lessons_30 ?? 0)}</Txt> },
      { key: 'ai', label: 'Câu hỏi AI 30 ngày', flex: 0.8, render: (r) => <Txt size={14}>{fmt(r.ai_30 ?? 0)}</Txt> },
      { key: 'last', label: 'Hoạt động gần nhất', render: (r) => <Txt size={13} color={c.muc2}>{when(r.last_activity)}</Txt> },
    ]} />;
}

/** Bảng theo từng lớp (sĩ số, giáo viên phụ trách, học sinh hoạt động, bài học, câu hỏi AI) */
export function ClassesTable({ rows, root = false }: { rows: DetailRow[]; root?: boolean }) {
  const { c } = useTheme();
  return <DataTable rows={rows} rowKey={(r) => r.id} empty="Chưa có lớp nào đang hoạt động."
    columns={[
      { key: 'name', label: 'Lớp', flex: 1.1, render: (r) => <NameCell main={r.name ?? ''} sub={`Khối ${r.grade ?? '?'} · ${r.school_year ?? ''}`} /> },
      ...(root ? [{ key: 'school', label: 'Trường', flex: 1.4, render: (r: DetailRow) => <Txt size={14}>{r.school_name ?? '—'}</Txt> }] : []),
      { key: 'students', label: 'Sĩ số', flex: 0.6, render: (r) => <Txt size={14}>{fmt(r.students ?? 0)}</Txt> },
      { key: 'teachers', label: 'Giáo viên phụ trách', flex: 1.3, render: (r) => <Txt size={13} color={r.teachers ? c.muc : c.muc3}>{String(r.teachers || 'Chưa phân công')}</Txt> },
      { key: 'active', label: 'Học sinh hoạt động 7 / 30 ngày', render: (r) => <Txt size={14}>{fmt(r.active_7 ?? 0)} / {fmt(r.active_30 ?? 0)}</Txt> },
      { key: 'lessons', label: 'Bài học 30 ngày', flex: 0.8, render: (r) => <Txt size={14}>{fmt(r.lessons_30 ?? 0)}</Txt> },
      { key: 'ai', label: 'Câu hỏi AI 30 ngày', flex: 0.8, render: (r) => <Txt size={14}>{fmt(r.ai_30 ?? 0)}</Txt> },
      { key: 'last', label: 'Hoạt động gần nhất', render: (r) => <Txt size={13} color={c.muc2}>{when(r.last_activity)}</Txt> },
    ]} />;
}

/** Hộp danh sách cụ thể sau một số liệu */
export function DashboardDetailSheet({ session, kind, onClose }: { session: Session; kind: DetailKind; onClose: () => void }) {
  const { c } = useTheme();
  const list = useLoad(() => dashboardDetails(session.token, kind), [session.token, kind], session.expired);
  const rows = list.data ?? [];
  const root = session.user.role === 'root_admin';
  const people = kind === 'students' || kind === 'teachers' || kind.startsWith('active');
  return <Sheet open onClose={onClose} wide title={DETAIL_TITLE[kind]} subtitle={list.data ? `${fmt(rows.length)} ${kind === 'schools' ? 'trường' : kind === 'classes' ? 'lớp' : 'người'}${rows.length >= 1000 ? ' (hiện 1.000 dòng đầu)' : ''}` : undefined}>
    <ErrorNote message={list.error} />
    {list.loading && !list.data ? <Spinner label="Đang tải danh sách…" /> : null}
    {list.data ? (kind === 'schools' ? <SchoolsTable rows={rows} />
      : kind === 'classes' ? <ClassesTable rows={rows} root={root} />
      : people ? <DataTable rows={rows} rowKey={(r) => r.id} empty={kind.startsWith('active') ? 'Chưa có ai hoạt động trong khoảng này.' : 'Chưa có ai.'}
        columns={[
          { key: 'name', label: 'Họ và tên', flex: 1.6, render: (r) => <NameCell main={r.full_name ?? ''} sub={r.user_code ?? undefined} /> },
          ...(kind.startsWith('active') ? [{ key: 'role', label: 'Vai trò', render: (r: DetailRow) => <Txt size={13}>{r.role ? ROLE_TEXT[r.role] : '—'}</Txt> }] : []),
          ...(root ? [{ key: 'school', label: 'Trường', flex: 1.4, render: (r: DetailRow) => <Txt size={14}>{r.school_name ?? '—'}</Txt> }] : []),
          ...(kind === 'students' || kind === 'teachers' ? [{ key: 'classes', label: kind === 'teachers' ? 'Lớp' : 'Lớp', render: (r: DetailRow) => <Txt size={13} color={r.classes ? c.muc : c.muc3}>{r.classes || 'Chưa vào lớp'}</Txt> }] : []),
          ...(kind.startsWith('active') ? [{ key: 'events', label: 'Số lượt', flex: 0.6, render: (r: DetailRow) => <Txt size={14}>{fmt(r.events ?? 0)}</Txt> }] : []),
          { key: 'last', label: 'Hoạt động gần nhất', render: (r) => <Cell main={when(r.last_activity)} sub={r.last_login_at ? `Đăng nhập: ${dateText(r.last_login_at)}` : undefined} /> },
        ]} />
      : null) : null}
  </Sheet>;
}

/** Thẻ "Theo từng lớp" ở cuối Thống kê trường (thay bốn thẻ tóm tắt, 18/11/2026) */
export function ClassesCard({ session, refreshKey }: { session: Session; refreshKey: number }) {
  const { c } = useTheme();
  const list = useLoad(() => dashboardDetails(session.token, 'classes'), [session.token, refreshKey], session.expired);
  return <Card flat pad={12} style={{ borderRadius: 12, gap: 8 }} testID="dashboard-classes">
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
      <Txt f="bold" size={14} accessibilityRole="header">Theo từng lớp</Txt>
      <Txt size={11} color={c.muc3}>Hoạt động tính theo học sinh của lớp có thao tác học, thi, hỏi AI</Txt>
    </View>
    <ErrorNote message={list.error} />
    {list.loading && !list.data ? <Spinner label="Đang tải…" /> : null}
    {list.data ? <ClassesTable rows={list.data} /> : null}
  </Card>;
}

/** Thẻ "Theo từng trường" ở cuối Thống kê hệ thống (thay bốn thẻ tóm tắt) */
export function SchoolsCard({ session, refreshKey }: { session: Session; refreshKey: number }) {
  const { c } = useTheme();
  const list = useLoad(() => dashboardDetails(session.token, 'schools'), [session.token, refreshKey], session.expired);
  return <Card flat pad={12} style={{ borderRadius: 12, gap: 8 }} testID="dashboard-schools">
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
      <Txt f="bold" size={14} accessibilityRole="header">Theo từng trường</Txt>
      <Txt size={11} color={c.muc3}>Hoạt động tính theo người có thao tác học, thi, hỏi AI</Txt>
    </View>
    <ErrorNote message={list.error} />
    {list.loading && !list.data ? <Spinner label="Đang tải…" /> : null}
    {list.data ? <SchoolsTable rows={list.data} /> : null}
  </Card>;
}
