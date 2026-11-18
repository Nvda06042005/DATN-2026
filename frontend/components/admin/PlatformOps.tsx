/**
 * Vận hành nền tảng (Sprint 11): hộp thư hỗ trợ của quản trị tổng (HK.AD.073–074), quản lý hướng dẫn và câu hỏi thường gặp (HK.AD.067), nhật ký đăng nhập – thao tác – lỗi
 * (HK.QT.051, HK.AD.027, HK.AD.075, HK.AD.076) và xác thực hai lớp cho tài khoản quản trị (HK.AD.002).
 */
import React, { useState } from 'react';
import { Image, Linking, View } from 'react-native';
import { ImagePlus, KeyRound, Pencil, PlayCircle, Plus, Send, ShieldCheck, Trash2, Video } from 'lucide-react-native';
import * as api from '@/api/platformApi';
import { uploadMedia } from '@/api/learningApi';
import { errorMessage, type PickedFile } from '@/api/client';
import { AdminSelect } from '@/components/admin/AdminSelect';
import { Cell, DataTable, ErrorNote, FilterBar, FilterBox, FormSheet, Page, PageHeader, Pager, pickFile, SearchFilterBar, StatusChip, useAction, useDebounced, useLoad, usePageSize, type FieldDef, type SearchFilter } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { StatGrid, StatTile } from '@/components/charts';
import { mediaUrl, TicketImage } from '@/components/portal/HelpCenter';
import { Btn, Card, Chip, ConfirmSheet, Field, InfoNote, Segmented, Sheet, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { AuditItem, FaqItem, LoginItem, Ticket, TicketStatus } from '@/types/platform';
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
  const f_status: SearchFilter = { key: 'status', label: 'Trạng thái', value: status, options: [{ value: '', label: 'Tất cả' }, ...(['new', 'processing', 'done'] as TicketStatus[]).map((s) => ({ value: s, label: TICKET_STATUS_TEXT[s] }))], onChange: (v) => { setStatus(v); setPage(1); }, testID: 'support-status' };
  const f_role: SearchFilter = { key: 'role', label: 'Người gửi', value: role, options: [{ value: '', label: 'Tất cả' }, { value: 'student', label: 'Học sinh' }, { value: 'teacher', label: 'Giáo viên' }, { value: 'school_admin', label: 'Quản trị trường' }], onChange: (v) => { setRole(v); setPage(1); } };
  return (
    <Page>
      <PageHeader title="Yêu cầu hỗ trợ" subtitle="Yêu cầu và báo lỗi từ học sinh, giáo viên và quản trị viên trường học" />
      <StatGrid>
        <StatTile label="Mới" value={counts.new ?? 0} tone={counts.new ? 'vang' : undefined} />
        <StatTile label="Đang xử lý" value={counts.processing ?? 0} tone="thuy" />
        <StatTile label="Đã xong" value={counts.done ?? 0} tone="ngoc" />
      </StatGrid>
      <SearchFilterBar placeholder="Tìm theo tiêu đề, nội dung, tên" value={query} onChange={(v) => { setQuery(v); setPage(1); }} searchId="support-search"
        filters={[f_status, f_role]} />
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner /> : null}
      {list.data ? (
        <>
          <DataTable<Ticket> paginate={false} rows={list.data.items} rowKey={(t) => t.id} empty="Không có yêu cầu nào khớp bộ lọc." onRowPress={(t) => setOpen(t.id)}
            columns={[
              { key: 'subject', label: 'Yêu cầu', flex: 2.4, render: (t) => <Cell main={t.subject} sub={t.body} /> },
              { key: 'from', filter: f_role, label: 'Người gửi', flex: 1.4, render: (t) => <Cell main={t.user_name ?? '—'} sub={`${ROLE_TEXT[t.role] ?? t.role}${t.school_name ? ` · ${t.school_name}` : ''}`} /> },
              { key: 'cat', label: 'Loại', render: (t) => <Txt size={13}>{TICKET_CATEGORY_TEXT[t.category] ?? t.category}{t.has_attachment ? ' · có ảnh' : ''}</Txt> },
              { key: 'status', filter: f_status, label: 'Trạng thái', render: (t) => <StatusChip kind={STATUS_KIND[t.status]} text={TICKET_STATUS_TEXT[t.status]} /> },
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
const NEW_GROUP = '__new__';

/** Nhóm: chọn trong danh sách nhóm đã có (theo vai trò đang chọn trước), hoặc "Nhóm mới…" để gõ tên (18/11/2026) */
const FaqCategoryField: React.FC<{ values: Record<string, string | string[]>; set: (name: string, value: string) => void; items: FaqItem[] }> = ({ values, set, items }) => {
  const audience = String(values.audience ?? ''), category = String(values.category ?? '');
  const groups = [...new Set([...items.filter((i) => i.audience === audience), ...items].map((i) => i.category))];
  const typing = values.category_new === '1' || (!!category && !groups.includes(category));
  return (
    <View style={{ gap: 8 }}>
      <AdminSelect<string> label="Nhóm *" value={typing ? NEW_GROUP : category} testID="faq-category"
        options={[{ value: '', label: 'Chọn nhóm' }, ...groups.map((g) => ({ value: g, label: g })), { value: NEW_GROUP, label: '+ Nhóm mới…' }]}
        onChange={(v) => { if (v === NEW_GROUP) { set('category_new', '1'); set('category', ''); } else { set('category_new', ''); set('category', v); } }} />
      {typing ? <Field label="Tên nhóm mới" value={category} onChangeText={(t) => set('category', t)} placeholder="Ví dụ: Bắt đầu, Lớp học, Bài tập" maxLength={60} nativeID="faq-category-new" /> : null}
    </View>
  );
};

/** Ảnh / video hướng dẫn: tải tệp từ máy (lưu ở kho tệp của hệ thống) hoặc dán liên kết https (18/11/2026) */
const FaqMediaField: React.FC<{ kind: 'image' | 'video'; token: string; values: Record<string, string | string[]>; set: (name: string, value: string) => void }> = ({ kind, token, values, set }) => {
  const { c } = useTheme();
  const name = kind === 'image' ? 'image_url' : 'video_url';
  const url = String(values[name] ?? '');
  const uploaded = url.startsWith('/api/content/media/');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const types = kind === 'image' ? ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] : ['video/mp4', 'video/webm'];
  const pick = async () => {
    setBusy(true); setError(null);
    try {
      const picked: PickedFile | null = await pickFile(types);
      if (!picked) return;
      const blob: Blob = (picked.file as Blob | undefined) ?? (await (await fetch(picked.uri)).blob());
      const data = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(new Error('Không đọc được tệp.')); r.readAsDataURL(blob); });
      const res = await uploadMedia(token, { name: picked.name, data });
      set(name, res.url);
    } catch (e) { setError(errorMessage(e, 'Không tải được tệp lên.')); } finally { setBusy(false); }
  };
  return (
    <View style={{ gap: 8 }}>
      <Txt f="bold" size={14} color={c.muc2}>{kind === 'image' ? 'Ảnh minh họa (không bắt buộc)' : 'Video hướng dẫn (không bắt buộc)'}</Txt>
      {url && kind === 'image' ? <Image source={{ uri: mediaUrl(url) }} accessibilityLabel="Ảnh minh họa đã chọn" resizeMode="contain" style={{ width: '100%', height: 140, borderRadius: 8, backgroundColor: c.adminCanvas }} /> : null}
      {url && kind === 'video' ? <Btn icon={PlayCircle} title={uploaded ? 'Xem video đã tải lên' : 'Mở liên kết video'} tone="giay" size="sm" onPress={() => void Linking.openURL(mediaUrl(url))} /> : null}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn icon={kind === 'image' ? ImagePlus : Video} title={kind === 'image' ? (url ? 'Đổi ảnh' : 'Tải ảnh lên') : (url ? 'Đổi video' : 'Tải video lên')} tone="giay" size="sm" loading={busy} onPress={pick} testID={`faq-${kind}-pick`} />
        {url ? <Btn icon={Trash2} title="Bỏ" tone="giay" size="sm" disabled={busy} onPress={() => set(name, '')} /> : null}
      </View>
      {!uploaded ? <Field label={kind === 'image' ? 'Hoặc dán liên kết ảnh (https)' : 'Hoặc dán liên kết video (https, ví dụ YouTube)'} value={url} onChangeText={(t) => set(name, t)} autoCapitalize="none" placeholder="https://…" nativeID={`faq-${kind}-link`} /> : null}
      <Txt size={12} color={c.muc3}>{kind === 'image' ? 'PNG, JPG, WEBP hoặc GIF, tối đa 1,5 MB.' : 'MP4 hoặc WebM, tối đa 8 MB.'}</Txt>
      {error ? <Txt size={13} f="semibold" color={c.sonChu} accessibilityRole="alert">{error}</Txt> : null}
    </View>
  );
};

/** Biểu mẫu hướng dẫn: nhóm chọn trong danh sách, ảnh / video tải lên hoặc dán liên kết, thứ tự hiển thị tự động (không hiện ô Thứ tự) */
const faqFields = (token: string, items: FaqItem[]): FieldDef[] => [
  { name: 'audience', label: 'Dành cho', type: 'select', required: true, options: Object.entries(AUDIENCE_TEXT).map(([value, label]) => ({ value, label })) },
  { name: 'category', label: 'Nhóm', render: (values, set) => <FaqCategoryField values={values} set={set} items={items} /> },
  { name: 'question', label: 'Câu hỏi hoặc tiêu đề hướng dẫn', required: true },
  { name: 'answer', label: 'Nội dung (hỗ trợ **chữ đậm** và dòng bắt đầu bằng - hoặc •)', type: 'textarea', required: true },
  { name: 'image_url', label: 'Ảnh minh họa', render: (values, set) => <FaqMediaField kind="image" token={token} values={values} set={set} /> },
  { name: 'video_url', label: 'Video hướng dẫn', render: (values, set) => <FaqMediaField kind="video" token={token} values={values} set={set} /> },
  { name: 'is_published', label: 'Hiển thị cho người dùng', type: 'select', options: [{ value: 'true', label: 'Có' }, { value: 'false', label: 'Ẩn' }] },
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
        <FormSheet wide title={edit === 'new' ? 'Thêm hướng dẫn' : 'Sửa hướng dẫn'} fields={faqFields(session.token, list.data ?? [])}
          initial={edit === 'new' ? { audience: 'student', is_published: 'true' } : { audience: edit.audience, category: edit.category, question: edit.question, answer: edit.answer, image_url: edit.image_url ?? '', video_url: edit.video_url ?? '', is_published: String(edit.is_published ?? true) }}
          onClose={() => setEdit(null)}
          onSubmit={async (v) => {
            if (!String(v.category ?? '').trim()) throw new Error('Hãy chọn nhóm hoặc gõ tên nhóm mới.');
            // thứ tự hiển thị tự động: thêm mới thì máy chủ xếp cuối nhóm; sửa thì giữ thứ tự cũ (không gửi position)
            await api.saveFaq(session.token, edit === 'new' ? null : edit.id, { audience: v.audience as FaqItem['audience'], category: String(v.category).trim(), question: String(v.question).trim(), answer: String(v.answer).trim(),
              image_url: String(v.image_url ?? '').trim() || null, video_url: String(v.video_url ?? '').trim() || null, is_published: v.is_published !== 'false' });
            setEdit(null); list.reload();
          }} />
      ) : null}
      <ConfirmSheet open={Boolean(remove)} title="Xóa mục này?" message={remove?.question ?? ''} confirmLabel="Xóa" tone="son" busy={busy} onCancel={() => setRemove(null)}
        onConfirm={async () => { const i = remove!; if (await run(() => api.deleteFaq(session.token, i.id), 'Đã xóa')) { setRemove(null); list.reload(); } }} />
    </Page>
  );
};

// ---------------------------------------------------------------------- nhật ký
type LogPart = 'audit' | 'logins';

const AuditTable: React.FC<{ session: Session }> = ({ session }) => {
  const [query, setQuery] = useState('');
  const q = useDebounced(query);
  const [ok, setOk] = useState('');
  const [students, setStudents] = useState('');
  // lọc cụ thể từng cột (18/11/2026): ngày, người thực hiện, thao tác, trường
  const [col, setCol] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const size = usePageSize();
  const root = session.user.role === 'root_admin';
  const data = useLoad(() => api.auditLog(session.token, { q, success: ok, students: students || undefined, date: col.date, actor: col.actor, label: col.label, school_id: col.school, page, limit: size }), [session.token, q, ok, students, col, page, size], session.expired);
  const facet = (key: string, field: string, label: string, all: string): SearchFilter => ({ key, label, value: col[key] ?? '', options: [{ value: '', label: all }],
    suggest: (term) => api.logFacets(session.token, 'audit', field, term, students || undefined), onChange: (v) => { setCol((old) => ({ ...old, [key]: v })); setPage(1); } });
  const f_date = facet('date', 'date', 'Thời điểm', 'Mọi ngày');
  const f_actor = facet('actor', 'actor', 'Người thực hiện', 'Mọi người');
  const f_action = facet('label', 'action', 'Thao tác', 'Mọi thao tác');
  const f_school = facet('school', 'school', 'Trường', 'Mọi trường');
  const f_ok: SearchFilter = { key: 'ok', label: 'Kết quả', value: ok, options: [{ value: '', label: 'Tất cả' }, { value: 'true', label: 'Thành công' }, { value: 'false', label: 'Thất bại' }], onChange: (v) => { setOk(v); setPage(1); } };
  const f_students: SearchFilter = { key: 'students', label: 'Vai trò thực hiện', value: students, options: [{ value: '', label: 'Giáo viên và quản trị' }, { value: 'true', label: 'Cả học sinh' }], onChange: (v) => { setStudents(v); setPage(1); }, testID: 'audit-students' };
  return (
    <View style={{ gap: 12 }}>
      <SearchFilterBar placeholder="Tìm theo người thực hiện hoặc thao tác" value={query} onChange={(v) => { setQuery(v); setPage(1); }} searchId="audit-search"
        filters={[f_date, f_actor, f_students, f_action, f_ok, ...(root ? [f_school] : [])]} />
      <ErrorNote message={data.error} />
      {data.loading && !data.data ? <Spinner /> : null}
      {data.data ? (
        <>
          <DataTable<AuditItem> paginate={false} rows={data.data.items} rowKey={(i) => i.id} empty="Chưa có thao tác nào được ghi lại."
            columns={[
              { key: 'time', filter: f_date, label: 'Thời điểm', render: (i) => <Txt size={13}>{when(i.created_at)}</Txt> },
              { key: 'who', filter: f_actor, label: 'Người thực hiện', flex: 1.3, render: (i) => <Cell main={i.actor_name} sub={ROLE_TEXT[i.actor_role] ?? i.actor_role} /> },
              // chỉ nhãn dễ đọc, không hiện đường dẫn kỹ thuật (POST /api/…) bên dưới
              { key: 'what', filter: f_action, label: 'Thao tác', flex: 2, render: (i) => <Cell main={i.label} /> },
              { key: 'res', filter: f_ok, label: 'Kết quả', render: (i) => <StatusChip kind={i.success ? 'on' : 'off'} text={i.success ? 'Thành công' : 'Thất bại'} /> },
              ...(root ? [{ key: 'school', filter: f_school, label: 'Trường', render: (i: AuditItem) => <Txt size={13}>{i.school_name ?? '—'}</Txt> }] : []),
            ]} />
          <Pager page={data.data.page} limit={data.data.limit} total={data.data.total} onPage={setPage} />
        </>
      ) : null}
    </View>
  );
};

const REASON: Record<string, string> = { success: 'Thành công', credentials: 'Sai mật khẩu', locked: 'Tài khoản bị khóa', deleted: 'Tài khoản đã xóa', portal: 'Sai cổng đăng nhập', rate_limit: 'Bị khóa tạm', two_factor: 'Sai mã hai lớp' };
const PORTAL_TEXT: Record<string, string> = { root_admin: 'Quản trị tổng', school_admin: 'Quản trị trường', teacher: 'Giáo viên', student: 'Học sinh', app: 'Học sinh / giáo viên', portal: 'Cổng chung' };
const LoginTable: React.FC<{ session: Session }> = ({ session }) => {
  const [query, setQuery] = useState('');
  const q = useDebounced(query);
  const [col, setCol] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const size = usePageSize();
  const root = session.user.role === 'root_admin';
  const data = useLoad(() => api.loginLog(session.token, { q, date: col.date, username: col.username, portal: col.portal, reason: col.reason, device: col.device, school_id: col.school, page, limit: size }), [session.token, q, col, page, size], session.expired);
  const facet = (key: string, label: string, all: string, text?: Record<string, string>): SearchFilter => ({ key, label, value: col[key] ?? '', options: [{ value: '', label: all }],
    suggest: (term) => api.logFacets(session.token, 'login', key, term).then((rows) => rows.map((r) => ({ value: r.value, label: text?.[r.label] ?? r.label }))),
    onChange: (v) => { setCol((old) => ({ ...old, [key]: v })); setPage(1); } });
  const f_date = facet('date', 'Thời điểm', 'Mọi ngày');
  const f_user = facet('username', 'Tài khoản', 'Mọi tài khoản');
  const f_portal = facet('portal', 'Cổng', 'Mọi cổng', PORTAL_TEXT);
  const f_reason = facet('reason', 'Kết quả', 'Tất cả', REASON);
  const f_device = facet('device', 'Thiết bị', 'Mọi thiết bị');
  const f_school = facet('school', 'Trường', 'Mọi trường');
  return (
    <View style={{ gap: 12 }}>
      <SearchFilterBar placeholder="Tìm theo tên đăng nhập" value={query} onChange={(v) => { setQuery(v); setPage(1); }} searchId="login-search"
        filters={[f_date, f_user, f_portal, f_reason, f_device, ...(root ? [f_school] : [])]} />
      <ErrorNote message={data.error} />
      {data.loading && !data.data ? <Spinner /> : null}
      {data.data ? (
        <>
          {/* 18/11/2026: không hiện địa chỉ IP (người dùng chọn chỉ bỏ khỏi giao diện; máy chủ vẫn lưu để điều tra sự cố) */}
          <DataTable<LoginItem> paginate={false} rows={data.data.items} rowKey={(i) => i.id} empty="Chưa có lượt đăng nhập nào."
            columns={[
              { key: 'time', filter: f_date, label: 'Thời điểm', render: (i) => <Txt size={13}>{when(i.created_at)}</Txt> },
              { key: 'user', filter: f_user, label: 'Tài khoản', flex: 1.2, render: (i) => <Cell main={i.username} sub={i.school_name ?? undefined} /> },
              { key: 'portal', filter: f_portal, label: 'Cổng', render: (i) => <Txt size={13}>{PORTAL_TEXT[i.portal] ?? i.portal}</Txt> },
              { key: 'res', filter: f_reason, label: 'Kết quả', render: (i) => <StatusChip kind={i.success ? 'on' : 'off'} text={REASON[i.reason] ?? i.reason} /> },
              { key: 'device', filter: f_device, label: 'Thiết bị', flex: 1.2, render: (i) => <Txt size={13}>{i.device}</Txt> },
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
      {/* 18/11/2026: bỏ tab Lỗi hệ thống khỏi giao diện; lỗi vẫn được ghi ngầm (hk_error_log) để kiểm tra khi cần */}
      <PageHeader title="Nhật ký" subtitle={root ? 'Thao tác của quản trị viên và lịch sử đăng nhập có thiết bị' : 'Ai đã làm gì trong trường và lịch sử đăng nhập của người dùng trong trường'} />
      <Segmented<LogPart> label="Loại nhật ký" value={part} onChange={setPart} options={[{ value: 'audit', label: 'Thao tác' }, { value: 'logins', label: 'Đăng nhập' }]} />
      {part === 'audit' ? <AuditTable session={session} /> : <LoginTable session={session} />}
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

