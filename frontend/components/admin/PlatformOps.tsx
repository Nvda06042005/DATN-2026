/**
 * Vận hành nền tảng (Sprint 11): hộp thư hỗ trợ của quản trị tổng (HK.AD.073–074), quản lý hướng dẫn và câu hỏi thường gặp (HK.AD.067), nhật ký đăng nhập – thao tác – lỗi
 * (HK.QT.051, HK.AD.027, HK.AD.075, HK.AD.076) và xác thực hai lớp cho tài khoản quản trị (HK.AD.002).
 */
import React, { useState } from 'react';
import { Image, View } from 'react-native';
import { KeyRound, Pencil, Plus, Send, ShieldCheck, Trash2 } from 'lucide-react-native';
import * as api from '@/api/platformApi';
import { AdminSelect } from '@/components/admin/AdminSelect';
import { Cell, DataTable, ErrorNote, FilterBar, FilterBox, FormSheet, Page, PageHeader, Pager, StatusChip, useAction, useDebounced, useLoad, usePageSize } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { StatGrid, StatTile } from '@/components/charts';
import { TicketImage } from '@/components/portal/HelpCenter';
import { Btn, Card, Chip, ConfirmSheet, Field, InfoNote, Segmented, Sheet, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { AuditItem, ErrorItem, FaqItem, LoginItem, Ticket, TicketStatus } from '@/types/platform';
import { TICKET_CATEGORY_TEXT, TICKET_STATUS_TEXT } from '@/types/platform';

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }) : '—');
const ROLE_TEXT: Record<string, string> = { student: 'Học sinh', teacher: 'Giáo viên', school_admin: 'QTV trường', root_admin: 'QTV tổng' };
const STATUS_KIND: Record<TicketStatus, 'warn' | 'info' | 'on'> = { new: 'warn', processing: 'info', done: 'on' };

// ---------------------------------------------------------------------- hộp thư hỗ trợ
const TicketAdminSheet: React.FC<{ session: Session; id: number; onClose: () => void; onChanged: () => void }> = ({ session, id, onClose, onChanged }) => {
  const { c } = useTheme();
  const t = useLoad(() => api.ticket(session.token, id), [session.token, id], session.expired);
  const { busy, run } = useAction(session.expired);
  const [text, setText] = useState('');
  const d = t.data;
  return (
    <Sheet open onClose={onClose} wide title={d?.subject ?? 'Yêu cầu hỗ trợ'} subtitle={d ? `${d.user_name} · ${ROLE_TEXT[d.role] ?? d.role}${d.school_name ? ` · ${d.school_name}` : ''} · ${when(d.created_at)}` : undefined}
      footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}><Btn title="Đóng" tone="giay" onPress={onClose} /></View>}>
      <ErrorNote message={t.error} />
      {t.loading && !d ? <Spinner /> : null}
      {d ? (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Chip text={TICKET_CATEGORY_TEXT[d.category] ?? d.category} bg={c.the2} fg={c.muc2} />
            {(['new', 'processing', 'done'] as TicketStatus[]).map((s) => <Btn key={s} title={TICKET_STATUS_TEXT[s]} tone={d.status === s ? 'son' : 'giay'} size="sm" loading={busy} onPress={async () => { const o = await run(() => api.setTicketStatus(session.token, id, s), `Đã chuyển sang “${TICKET_STATUS_TEXT[s]}”`); if (o) { t.setData(o); onChanged(); } }} testID={`ticket-status-${s}`} />)}
          </View>
          <Txt size={15} style={{ lineHeight: 22 }} selectable>{d.body}</Txt>
          {d.page ? <Txt size={12} color={c.muc3}>Trang đang xem: {d.page}</Txt> : null}
          {d.has_attachment ? <TicketImage session={session} id={d.id} name={d.attachment_name} /> : null}
          {d.messages.map((m) => (
            <View key={m.id} style={{ alignSelf: m.author_role === 'root_admin' ? 'flex-end' : 'flex-start', maxWidth: '92%', padding: 10, borderRadius: 8, backgroundColor: m.author_role === 'root_admin' ? c.thuyNhat : c.the2, gap: 2 }}>
              <Txt f="bold" size={12} color={c.muc3}>{m.author_name ?? ROLE_TEXT[m.author_role]} · {when(m.created_at)}</Txt>
              <Txt size={14} selectable>{m.body}</Txt>
            </View>
          ))}
          <Field label="Phản hồi cho người gửi" value={text} onChangeText={setText} multiline numberOfLines={4} maxLength={3000} inputStyle={{ minHeight: 100, textAlignVertical: 'top' }} nativeID="ticket-admin-reply" />
          <View style={{ flexDirection: 'row' }}><Btn icon={Send} title="Gửi phản hồi" tone="son" disabled={!text.trim()} loading={busy} onPress={async () => { const o = await run(() => api.replyTicket(session.token, id, text.trim()), 'Đã gửi phản hồi'); if (o) { setText(''); t.setData(o); onChanged(); } }} testID="ticket-admin-send" /></View>
        </View>
      ) : null}
    </Sheet>
  );
};

export const SupportInbox: React.FC<{ session: Session }> = ({ session }) => {
  const [status, setStatus] = useState('');
  const [role, setRole] = useState('');
  const [query, setQuery] = useState('');
  const q = useDebounced(query);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<number | null>(null);
  const size = usePageSize();
  const list = useLoad(() => api.allTickets(session.token, { status, role, q, page, limit: size }), [session.token, status, role, q, page, size], session.expired);
  const counts = list.data?.counts ?? {};
  return (
    <Page>
      <PageHeader title="Yêu cầu hỗ trợ" subtitle="Yêu cầu và báo lỗi từ học sinh, giáo viên và quản trị viên trường học" />
      <StatGrid>
        <StatTile label="Mới" value={counts.new ?? 0} tone={counts.new ? 'vang' : undefined} />
        <StatTile label="Đang xử lý" value={counts.processing ?? 0} tone="thuy" />
        <StatTile label="Đã xong" value={counts.done ?? 0} tone="ngoc" />
      </StatGrid>
      <FilterBar>
        <FilterBox><AdminSelect<string> label="Trạng thái" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[{ value: '', label: 'Tất cả' }, ...(['new', 'processing', 'done'] as TicketStatus[]).map((s) => ({ value: s, label: TICKET_STATUS_TEXT[s] }))]} testID="support-status" /></FilterBox>
        <FilterBox><AdminSelect<string> label="Người gửi" value={role} onChange={(v) => { setRole(v); setPage(1); }} options={[{ value: '', label: 'Tất cả' }, { value: 'student', label: 'Học sinh' }, { value: 'teacher', label: 'Giáo viên' }, { value: 'school_admin', label: 'Quản trị trường' }]} /></FilterBox>
        <FilterBox flex={2}><Field label="Tìm theo tiêu đề, nội dung, tên" value={query} onChangeText={(v) => { setQuery(v); setPage(1); }} nativeID="support-search" /></FilterBox>
      </FilterBar>
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner /> : null}
      {list.data ? (
        <>
          <DataTable<Ticket> rows={list.data.items} rowKey={(t) => t.id} empty="Không có yêu cầu nào khớp bộ lọc." onRowPress={(t) => setOpen(t.id)}
            columns={[
              { key: 'subject', label: 'Yêu cầu', flex: 2.4, render: (t) => <Cell main={t.subject} sub={t.body} /> },
              { key: 'from', label: 'Người gửi', flex: 1.4, render: (t) => <Cell main={t.user_name ?? '—'} sub={`${ROLE_TEXT[t.role] ?? t.role}${t.school_name ? ` · ${t.school_name}` : ''}`} /> },
              { key: 'cat', label: 'Loại', render: (t) => <Txt size={13}>{TICKET_CATEGORY_TEXT[t.category] ?? t.category}{t.has_attachment ? ' · có ảnh' : ''}</Txt> },
              { key: 'status', label: 'Trạng thái', render: (t) => <StatusChip kind={STATUS_KIND[t.status]} text={TICKET_STATUS_TEXT[t.status]} /> },
              { key: 'time', label: 'Gửi lúc', render: (t) => <Txt size={12}>{when(t.created_at)}{t.replies ? `\n${t.replies} phản hồi` : ''}</Txt> },
            ]} />
          <Pager page={list.data.page} limit={list.data.limit} total={list.data.total} onPage={setPage} />
        </>
      ) : null}
      {open !== null ? <TicketAdminSheet session={session} id={open} onClose={() => setOpen(null)} onChanged={() => list.reload()} /> : null}
    </Page>
  );
};

// ---------------------------------------------------------------------- quản lý hướng dẫn và câu hỏi thường gặp
const AUDIENCE_TEXT: Record<string, string> = { student: 'Học sinh', teacher: 'Giáo viên', school_admin: 'Quản trị trường', all: 'Mọi vai trò' };
const FAQ_FIELDS = [
  { name: 'audience', label: 'Dành cho', type: 'select' as const, required: true, options: Object.entries(AUDIENCE_TEXT).map(([value, label]) => ({ value, label })) },
  { name: 'category', label: 'Nhóm', required: true, hint: 'Ví dụ: Bắt đầu, Lớp học, Bài tập' },
  { name: 'question', label: 'Câu hỏi hoặc tiêu đề hướng dẫn', required: true },
  { name: 'answer', label: 'Nội dung (hỗ trợ **chữ đậm** và dòng bắt đầu bằng - hoặc •)', type: 'textarea' as const, required: true },
  { name: 'image_url', label: 'Ảnh minh họa (liên kết https, không bắt buộc)' },
  { name: 'video_url', label: 'Video hướng dẫn (liên kết https, không bắt buộc)' },
  { name: 'position', label: 'Thứ tự hiển thị (số nhỏ hiện trước)', type: 'number' as const },
  { name: 'is_published', label: 'Hiển thị cho người dùng', type: 'select' as const, options: [{ value: 'true', label: 'Có' }, { value: 'false', label: 'Ẩn' }] },
];

export const FaqManager: React.FC<{ session: Session }> = ({ session }) => {
  const list = useLoad(() => api.faqAll(session.token), [session.token], session.expired);
  const { busy, run } = useAction(session.expired);
  const [audience, setAudience] = useState('');
  const [edit, setEdit] = useState<FaqItem | 'new' | null>(null);
  const [remove, setRemove] = useState<FaqItem | null>(null);
  const rows = (list.data ?? []).filter((i) => !audience || i.audience === audience);
  return (
    <Page>
      <PageHeader title="Hướng dẫn và câu hỏi thường gặp" subtitle="Nội dung người dùng thấy ở mục Trợ giúp, chia theo vai trò" actions={<Btn icon={Plus} title="Thêm mục" tone="son" onPress={() => setEdit('new')} testID="faq-new" />} />
      <FilterBar><FilterBox><AdminSelect<string> label="Dành cho" value={audience} onChange={setAudience} options={[{ value: '', label: 'Tất cả' }, ...Object.entries(AUDIENCE_TEXT).map(([value, label]) => ({ value, label }))]} /></FilterBox></FilterBar>
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner /> : null}
      {list.data ? (
        <DataTable<FaqItem> rows={rows} rowKey={(i) => i.id} empty="Chưa có mục nào." onRowPress={setEdit}
          columns={[
            { key: 'q', label: 'Nội dung', flex: 3, render: (i) => <Cell main={i.question} sub={i.answer} /> },
            { key: 'a', label: 'Dành cho', render: (i) => <Txt size={13}>{AUDIENCE_TEXT[i.audience]}</Txt> },
            { key: 'c', label: 'Nhóm', render: (i) => <Txt size={13}>{i.category}</Txt> },
            { key: 's', label: 'Hiển thị', render: (i) => <StatusChip kind={i.is_published ? 'on' : 'muted'} text={i.is_published ? 'Hiện' : 'Ẩn'} /> },
          ]}
          actions={(i) => <><Btn icon={Pencil} label={`Sửa mục ${i.question}`} tone="giay" size="sm" onPress={() => setEdit(i)} /><Btn icon={Trash2} label={`Xóa mục ${i.question}`} tone="giay" size="sm" onPress={() => setRemove(i)} /></>} actionsWidth={110} />
      ) : null}
      {edit ? (
        <FormSheet wide title={edit === 'new' ? 'Thêm hướng dẫn' : 'Sửa hướng dẫn'} fields={FAQ_FIELDS}
          initial={edit === 'new' ? { audience: 'student', position: '0', is_published: 'true' } : { audience: edit.audience, category: edit.category, question: edit.question, answer: edit.answer, image_url: edit.image_url ?? '', video_url: edit.video_url ?? '', position: String(edit.position ?? 0), is_published: String(edit.is_published ?? true) }}
          onClose={() => setEdit(null)}
          onSubmit={async (v) => {
            await api.saveFaq(session.token, edit === 'new' ? null : edit.id, { audience: v.audience as FaqItem['audience'], category: String(v.category).trim(), question: String(v.question).trim(), answer: String(v.answer).trim(),
              image_url: String(v.image_url).trim() || null, video_url: String(v.video_url).trim() || null, position: Number(v.position) || 0, is_published: v.is_published !== 'false' });
            setEdit(null); list.reload();
          }} />
      ) : null}
      <ConfirmSheet open={Boolean(remove)} title="Xóa mục này?" message={remove?.question ?? ''} confirmLabel="Xóa" tone="son" busy={busy} onCancel={() => setRemove(null)}
        onConfirm={async () => { const i = remove!; if (await run(() => api.deleteFaq(session.token, i.id), 'Đã xóa')) { setRemove(null); list.reload(); } }} />
    </Page>
  );
};

// ---------------------------------------------------------------------- nhật ký
type LogPart = 'audit' | 'logins' | 'errors';

const AuditTable: React.FC<{ session: Session }> = ({ session }) => {
  const [query, setQuery] = useState('');
  const q = useDebounced(query);
  const [ok, setOk] = useState('');
  const [students, setStudents] = useState('');
  const [page, setPage] = useState(1);
  const size = usePageSize();
  const data = useLoad(() => api.auditLog(session.token, { q, success: ok, students: students || undefined, page, limit: size }), [session.token, q, ok, students, page, size], session.expired);
  return (
    <View style={{ gap: 12 }}>
      <FilterBar>
        <FilterBox flex={2}><Field label="Tìm theo người thực hiện hoặc thao tác" value={query} onChangeText={(v) => { setQuery(v); setPage(1); }} nativeID="audit-search" /></FilterBox>
        <FilterBox><AdminSelect<string> label="Kết quả" value={ok} onChange={(v) => { setOk(v); setPage(1); }} options={[{ value: '', label: 'Tất cả' }, { value: 'true', label: 'Thành công' }, { value: 'false', label: 'Thất bại' }]} /></FilterBox>
        <FilterBox><AdminSelect<string> label="Người thực hiện" value={students} onChange={(v) => { setStudents(v); setPage(1); }} options={[{ value: '', label: 'Giáo viên và quản trị' }, { value: 'true', label: 'Cả học sinh' }]} testID="audit-students" /></FilterBox>
      </FilterBar>
      <ErrorNote message={data.error} />
      {data.loading && !data.data ? <Spinner /> : null}
      {data.data ? (
        <>
          <DataTable<AuditItem> rows={data.data.items} rowKey={(i) => i.id} empty="Chưa có thao tác nào được ghi lại."
            columns={[
              { key: 'time', label: 'Thời điểm', render: (i) => <Txt size={13}>{when(i.created_at)}</Txt> },
              { key: 'who', label: 'Người thực hiện', flex: 1.3, render: (i) => <Cell main={i.actor_name} sub={ROLE_TEXT[i.actor_role] ?? i.actor_role} /> },
              { key: 'what', label: 'Thao tác', flex: 2, render: (i) => <Cell main={i.label} sub={i.action} /> },
              { key: 'res', label: 'Kết quả', render: (i) => <StatusChip kind={i.success ? 'on' : 'off'} text={i.success ? 'Thành công' : 'Thất bại'} /> },
              ...(session.user.role === 'root_admin' ? [{ key: 'school', label: 'Trường', render: (i: AuditItem) => <Txt size={13}>{i.school_name ?? '—'}</Txt> }] : []),
            ]} />
          <Pager page={data.data.page} limit={data.data.limit} total={data.data.total} onPage={setPage} />
        </>
      ) : null}
    </View>
  );
};

const REASON: Record<string, string> = { success: 'Thành công', credentials: 'Sai mật khẩu', locked: 'Tài khoản bị khóa', deleted: 'Tài khoản đã xóa', portal: 'Sai cổng đăng nhập', rate_limit: 'Bị khóa tạm', two_factor: 'Sai mã hai lớp' };
const LoginTable: React.FC<{ session: Session }> = ({ session }) => {
  const [query, setQuery] = useState('');
  const q = useDebounced(query);
  const [ok, setOk] = useState('');
  const [page, setPage] = useState(1);
  const size = usePageSize();
  const data = useLoad(() => api.loginLog(session.token, { q, success: ok, page, limit: size }), [session.token, q, ok, page, size], session.expired);
  return (
    <View style={{ gap: 12 }}>
      <FilterBar>
        <FilterBox flex={2}><Field label="Tìm theo tên đăng nhập" value={query} onChangeText={(v) => { setQuery(v); setPage(1); }} nativeID="login-search" /></FilterBox>
        <FilterBox><AdminSelect<string> label="Kết quả" value={ok} onChange={(v) => { setOk(v); setPage(1); }} options={[{ value: '', label: 'Tất cả' }, { value: 'true', label: 'Thành công' }, { value: 'false', label: 'Thất bại' }]} /></FilterBox>
      </FilterBar>
      <ErrorNote message={data.error} />
      {data.loading && !data.data ? <Spinner /> : null}
      {data.data ? (
        <>
          <DataTable<LoginItem> rows={data.data.items} rowKey={(i) => i.id} empty="Chưa có lượt đăng nhập nào."
            columns={[
              { key: 'time', label: 'Thời điểm', render: (i) => <Txt size={13}>{when(i.created_at)}</Txt> },
              { key: 'user', label: 'Tài khoản', flex: 1.2, render: (i) => <Cell main={i.username} sub={i.school_name ?? undefined} /> },
              { key: 'portal', label: 'Cổng', render: (i) => <Txt size={13}>{i.portal}</Txt> },
              { key: 'res', label: 'Kết quả', render: (i) => <StatusChip kind={i.success ? 'on' : 'off'} text={REASON[i.reason] ?? i.reason} /> },
              { key: 'device', label: 'Thiết bị', flex: 1.2, render: (i) => <Txt size={13}>{i.device}</Txt> },
              { key: 'ip', label: 'Địa chỉ IP', render: (i) => <Txt size={13}>{i.ip ?? '—'}</Txt> },
            ]} />
          <Pager page={data.data.page} limit={data.data.limit} total={data.data.total} onPage={setPage} />
        </>
      ) : null}
    </View>
  );
};

const SOURCE: Record<string, string> = { api: 'API', ai: 'AI', email: 'Gửi thư', job: 'Việc nền', db: 'Cơ sở dữ liệu' };
const ErrorTable: React.FC<{ session: Session }> = ({ session }) => {
  const [source, setSource] = useState('');
  const [query, setQuery] = useState('');
  const q = useDebounced(query);
  const [page, setPage] = useState(1);
  const { busy, run } = useAction(session.expired);
  const size = usePageSize();
  const data = useLoad(() => api.errorLog(session.token, { source, q, page, limit: size }), [session.token, source, q, page, size], session.expired);
  return (
    <View style={{ gap: 12 }}>
      {data.data ? <StatGrid>{Object.entries(SOURCE).map(([k, label]) => <StatTile key={k} label={`${label} (24 giờ)`} value={data.data!.last_24h[k] ?? 0} tone={data.data!.last_24h[k] ? 'son' : 'ngoc'} />)}</StatGrid> : null}
      <FilterBar>
        <FilterBox><AdminSelect<string> label="Nguồn lỗi" value={source} onChange={(v) => { setSource(v); setPage(1); }} options={[{ value: '', label: 'Tất cả' }, ...Object.entries(SOURCE).map(([value, label]) => ({ value, label }))]} /></FilterBox>
        <FilterBox flex={2}><Field label="Tìm trong nội dung lỗi" value={query} onChangeText={(v) => { setQuery(v); setPage(1); }} nativeID="error-search" /></FilterBox>
        {session.user.admin_level === 1 ? <Btn icon={Trash2} title="Xóa lỗi cũ hơn 30 ngày" tone="giay" size="sm" loading={busy} onPress={async () => { const r = await run(() => api.clearErrors(session.token, 30)); if (r) { data.reload(); } }} /> : null}
      </FilterBar>
      <ErrorNote message={data.error} />
      {data.loading && !data.data ? <Spinner /> : null}
      {data.data ? (
        <>
          <DataTable<ErrorItem> rows={data.data.items} rowKey={(i) => i.id} empty="Không có lỗi nào được ghi lại."
            columns={[
              { key: 'time', label: 'Thời điểm', render: (i) => <Txt size={13}>{when(i.created_at)}</Txt> },
              { key: 'src', label: 'Nguồn', render: (i) => <StatusChip kind={i.source === 'api' ? 'off' : 'warn'} text={SOURCE[i.source] ?? i.source} /> },
              { key: 'msg', label: 'Nội dung', flex: 3, render: (i) => <Cell main={i.message} sub={[i.route, i.status ? `mã ${i.status}` : null, i.user_name].filter(Boolean).join(' · ')} /> },
            ]} />
          <Pager page={data.data.page} limit={data.data.limit} total={data.data.total} onPage={setPage} />
        </>
      ) : null}
    </View>
  );
};

export const LogsPanel: React.FC<{ session: Session }> = ({ session }) => {
  const root = session.user.role === 'root_admin';
  const [part, setPart] = useState<LogPart>('audit');
  return (
    <Page>
      <PageHeader title="Nhật ký" subtitle={root ? 'Thao tác của quản trị viên, lịch sử đăng nhập có thiết bị và địa chỉ IP, và lỗi hệ thống' : 'Ai đã làm gì trong trường và lịch sử đăng nhập của người dùng trong trường'} />
      <Segmented<LogPart> label="Loại nhật ký" value={part} onChange={setPart} options={[{ value: 'audit', label: 'Thao tác' }, { value: 'logins', label: 'Đăng nhập' }, ...(root ? [{ value: 'errors' as const, label: 'Lỗi hệ thống' }] : [])]} />
      {part === 'audit' ? <AuditTable session={session} /> : part === 'logins' ? <LoginTable session={session} /> : <ErrorTable session={session} />}
    </Page>
  );
};

// ---------------------------------------------------------------------- bảo mật: xác thực hai lớp
export const AccountSecurity: React.FC<{ session: Session }> = ({ session }) => {
  const { c } = useTheme();
  const st = useLoad(() => api.twoFactor(session.token), [session.token, session.user.email], session.expired);
  const { busy, run } = useAction(session.expired);
  const [setup, setSetup] = useState<{ method: 'email' | 'totp'; secret?: string; qr?: string; sent_to?: string } | null>(null);
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [disable, setDisable] = useState(false);
  const [password, setPassword] = useState('');
  const d = st.data;
  const start = async (method: 'email' | 'totp') => { const r = await run(() => api.twoFactorSetup(session.token, method)); if (r) { setSetup({ method, secret: r.secret, qr: r.qr, sent_to: r.sent_to }); setCode(''); } };
  const enable = async () => { const r = await run(() => api.twoFactorEnable(session.token, code.trim()), 'Đã bật xác thực hai lớp'); if (r) { setCodes(r.backup_codes); setSetup(null); st.reload(); } };
  const off = async () => { if (await run(() => api.twoFactorDisable(session.token, password, code.trim()), 'Đã tắt xác thực hai lớp')) { setDisable(false); setPassword(''); setCode(''); st.reload(); } };
  return (
    <View testID="profile-security" style={{ gap: 12 }}>
      <Txt f="bold" size={18} accessibilityRole="header">Đăng nhập và bảo mật</Txt>
      <ErrorNote message={st.error} />
      {st.loading && !d ? <Spinner /> : null}
      {d ? (
        <Card pad={16} style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <ShieldCheck size={22} color={d.enabled ? c.ngocChu : c.muc3} />
            <Txt f="bold" size={17}>Xác thực hai lớp</Txt>
            <StatusChip kind={d.enabled ? 'on' : 'muted'} text={d.enabled ? `Đang bật (${d.method === 'totp' ? 'ứng dụng xác thực' : 'mã qua email'})` : 'Chưa bật'} />
          </View>
          {d.enabled ? (
            <>
              <Txt size={14}>Còn <Txt f="bold" size={14}>{d.backup_codes_left}</Txt> mã dự phòng dùng một lần (dùng khi mất điện thoại hoặc không nhận được email).</Txt>
              <View style={{ flexDirection: 'row' }}><Btn icon={KeyRound} title="Tắt xác thực hai lớp" tone="giay" onPress={() => { setDisable(true); setCode(''); }} testID="2fa-disable" /></View>
            </>
          ) : (
            <>
              <InfoNote><Txt size={14}>Nên bật cho tài khoản quản trị. Nếu mất cả thiết bị lẫn mã dự phòng, quản trị tổng cấp 1 khác có thể đặt lại giúp bạn.</Txt></InfoNote>
              <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                <Btn title="Dùng ứng dụng xác thực (khuyên dùng)" tone="son" disabled={!d.totp_available} loading={busy} onPress={() => start('totp')} testID="2fa-totp" />
                <Btn title="Nhận mã qua email" tone="giay" disabled={!d.has_email} loading={busy} onPress={() => start('email')} testID="2fa-email" />
              </View>
              {!d.totp_available ? <Txt size={12} color={c.muc3}>Ứng dụng xác thực hiện chưa sẵn sàng. Bạn có thể chọn nhận mã qua email.</Txt> : null}
              {!d.has_email ? <Txt size={12} color={c.muc3}>Tài khoản chưa có email trong hồ sơ nên chưa dùng được mã qua email.</Txt> : null}
            </>
          )}
        </Card>
      ) : null}
      {setup ? (
        <Sheet open onClose={() => setSetup(null)} title={setup.method === 'totp' ? 'Thiết lập ứng dụng xác thực' : 'Xác nhận mã gửi qua email'}
          footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}><Btn title="Hủy" tone="giay" onPress={() => setSetup(null)} /><Btn title="Bật" tone="son" loading={busy} disabled={code.trim().length < 6} onPress={enable} testID="2fa-enable" /></View>}>
          <View style={{ gap: 12 }}>
            {setup.method === 'totp' ? (
              <>
                <Txt size={14}>1. Mở ứng dụng xác thực (Google Authenticator, Microsoft Authenticator, Authy…) và quét mã QR, hoặc nhập khóa bên dưới.</Txt>
                {setup.qr ? <View style={{ alignItems: 'center' }}><Image source={{ uri: setup.qr }} accessibilityLabel="Mã QR để thêm tài khoản vào ứng dụng xác thực" style={{ width: 200, height: 200 }} /></View> : null}
                <Txt f="bold" size={15} selectable style={{ letterSpacing: 2 }}>{setup.secret}</Txt>
                <Txt size={14}>2. Nhập mã 6 chữ số ứng dụng đang hiển thị để xác nhận.</Txt>
              </>
            ) : <Txt size={14}>Mã 6 chữ số đã được gửi tới {setup.sent_to}. Nhập mã (hiệu lực 5 phút) để bật.</Txt>}
            <Field label="Mã xác nhận" value={code} onChangeText={setCode} keyboardType="numeric" maxLength={8} autoCapitalize="none" nativeID="2fa-code" />
          </View>
        </Sheet>
      ) : null}
      {codes ? (
        <Sheet open onClose={() => setCodes(null)} title="Lưu mã dự phòng" footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}><Btn title="Tôi đã lưu" tone="son" onPress={() => setCodes(null)} testID="2fa-codes-done" /></View>}>
          <View style={{ gap: 12 }}>
            <InfoNote><Txt size={14}>Mỗi mã dùng được một lần khi không có mã xác thực. Mã chỉ hiện lúc này, hãy chép và cất nơi an toàn.</Txt></InfoNote>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{codes.map((x) => <Chip key={x} text={x} bg={c.the2} fg={c.muc} />)}</View>
          </View>
        </Sheet>
      ) : null}
      {disable ? (
        <Sheet open onClose={() => setDisable(false)} title="Tắt xác thực hai lớp"
          footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}><Btn title="Hủy" tone="giay" onPress={() => setDisable(false)} /><Btn title="Tắt" tone="son" loading={busy} disabled={!password || code.trim().length < 6} onPress={off} testID="2fa-disable-confirm" /></View>}>
          <View style={{ gap: 12 }}>
            <Field label="Mật khẩu hiện tại" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" nativeID="2fa-password" />
            <Field label="Mã xác thực hoặc mã dự phòng" value={code} onChangeText={setCode} autoCapitalize="none" nativeID="2fa-off-code" />
          </View>
        </Sheet>
      ) : null}
    </View>
  );
};

