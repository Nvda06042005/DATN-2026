/**
 * Soạn và quản lý thông báo (Sprint 11: HK.GV.076, HK.QT.043, HK.AD.069): giáo viên gửi tới lớp mình phụ trách; quản trị trường gửi cả trường / khối / lớp;
 * quản trị tổng gửi toàn hệ thống hoặc theo trường và vai trò; đặt lịch gửi, sửa đợt chưa gửi, sửa chữ hoặc thu hồi đợt đã gửi.
 * Mục Khảo sát của quản trị trường đã bỏ theo yêu cầu 13/11/2026 (dữ liệu khảo sát vẫn giữ trong cơ sở dữ liệu).
 */
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Pencil, Plus, Send, Trash2 } from 'lucide-react-native';
import * as analytics from '@/api/analyticsApi';
import * as admin from '@/api/adminApi';
import * as api from '@/api/platformApi';
import { Cell, DataTable, ErrorNote, fromVn, Page, PageHeader, StatusChip, toVn, useAction, useLoad } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { Btn, ConfirmSheet, Field, InfoNote, Segmented, Sheet, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { Broadcast } from '@/types/platform';

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }) : '—');

/** Hàng chip chọn một hoặc nhiều giá trị */
function Chips<T extends string | number>({ label, options, value, onChange }: { label: string; options: Array<{ value: T; label: string }>; value: T[]; onChange: (v: T[]) => void }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Txt f="bold" size={14} color={c.muc2}>{label}</Txt>
      <View accessibilityLabel={label} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((o) => {
          const on = value.includes(o.value);
          return (
            <Pressable key={String(o.value)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => onChange(on ? value.filter((x) => x !== o.value) : [...value, o.value])}
              style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 5, borderWidth: 1, justifyContent: 'center', borderColor: on ? c.son : c.adminLine, backgroundColor: on ? c.adminTint : c.the }}>
              <Txt f="bold" size={14} color={on ? c.son : c.muc2}>{o.label}</Txt>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------- thông báo
const scopeText = (b: Broadcast): string => (b.scope === 'class' ? `Lớp ${(b.class_names ?? []).join(', ')}` : b.scope === 'grade' ? `Khối ${b.grades.join(', ')}` : b.scope === 'school' ? 'Cả trường' : b.school_ids.length ? `${b.school_ids.length} trường` : 'Toàn hệ thống');
const ROLE_OPTIONS = [{ value: 'student', label: 'Học sinh' }, { value: 'teacher', label: 'Giáo viên' }];

const Compose: React.FC<{ session: Session; editing: Broadcast | null; onClose: () => void; onSaved: () => void }> = ({ session, editing, onClose, onSaved }) => {
  const role = session.user.role;
  const sent = editing?.status === 'sent';
  const classes = useLoad(() => (role === 'root_admin' ? Promise.resolve([]) : analytics.classes(session.token)), [session.token, role], session.expired);
  const schools = useLoad(() => (role === 'root_admin' ? admin.listSchools(session.token, { limit: 100 }) : Promise.resolve(null)), [session.token, role], session.expired);
  const { busy, run } = useAction(session.expired);
  const [title, setTitle] = useState(editing?.title ?? '');
  const [body, setBody] = useState(editing?.body ?? '');
  const [scope, setScope] = useState<string>(editing?.scope ?? (role === 'teacher' ? 'class' : role === 'school_admin' ? 'school' : 'system'));
  const [classIds, setClassIds] = useState<number[]>(editing?.class_ids ?? []);
  const [grades, setGrades] = useState<number[]>(editing?.grades ?? []);
  const [schoolIds, setSchoolIds] = useState<number[]>(editing?.school_ids ?? []);
  const [roles, setRoles] = useState<string[]>(editing?.roles ?? []);
  const [at, setAt] = useState(editing?.status === 'scheduled' ? toVn(editing.send_at) : '');
  const [preview, setPreview] = useState<number | null>(null);
  const activeClasses = (classes.data ?? []).filter((c) => c.is_active);
  const payload = () => ({ title: title.trim(), body: body.trim(), scope, class_ids: classIds, grades, school_ids: schoolIds, roles, send_at: at.trim() ? fromVn(at) : null });
  const atInvalid = Boolean(at.trim()) && !fromVn(at);
  const ready = title.trim().length >= 2 && body.trim().length >= 1 && !atInvalid && (role !== 'teacher' || classIds.length > 0) && (scope !== 'class' || classIds.length > 0) && (scope !== 'grade' || grades.length > 0);
  const roleOptions = role === 'root_admin' ? [...ROLE_OPTIONS, { value: 'school_admin', label: 'Quản trị trường' }] : ROLE_OPTIONS;

  const save = async () => {
    const out = await run(() => (editing ? api.updateBroadcast(session.token, editing.id, sent ? { title: title.trim(), body: body.trim() } : payload()) : api.createBroadcast(session.token, payload())),
      editing ? 'Đã cập nhật thông báo' : at.trim() ? 'Đã đặt lịch gửi' : 'Đã gửi thông báo');
    if (out) { onSaved(); onClose(); }
  };
  const count = async () => { const r = await run(() => api.previewBroadcast(session.token, payload())); if (r) setPreview(r.recipients); };

  return (
    <Sheet open onClose={onClose} wide title={editing ? (sent ? 'Sửa thông báo đã gửi' : 'Sửa thông báo chưa gửi') : 'Soạn thông báo'} subtitle={sent ? 'Chỉ sửa được tiêu đề và nội dung; thông báo của người nhận cập nhật theo' : undefined}
      footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
        {!sent ? <Btn title="Xem số người nhận" tone="giay" loading={busy} onPress={count} testID="bc-preview" /> : null}
        <Btn title="Hủy" tone="giay" onPress={onClose} />
        <Btn icon={Send} title={editing ? 'Lưu' : at.trim() ? 'Đặt lịch gửi' : 'Gửi ngay'} tone="son" loading={busy} disabled={!ready} onPress={save} testID="bc-save" /></View>}>
      <View style={{ gap: 14 }}>
        <Field label="Tiêu đề" value={title} onChangeText={setTitle} maxLength={160} nativeID="bc-title" />
        <Field label="Nội dung" value={body} onChangeText={setBody} multiline numberOfLines={5} maxLength={1000} inputStyle={{ minHeight: 120, textAlignVertical: 'top' }} nativeID="bc-body" />
        {!sent ? (
          <>
            {role === 'school_admin' ? <Segmented<string> label="Phạm vi gửi" value={scope} onChange={setScope} options={[{ value: 'school', label: 'Cả trường' }, { value: 'grade', label: 'Theo khối' }, { value: 'class', label: 'Theo lớp' }]} /> : null}
            {scope === 'grade' ? <Chips<number> label="Khối nhận" options={[6, 7, 8, 9].map((g) => ({ value: g, label: `Khối ${g}` }))} value={grades} onChange={setGrades} /> : null}
            {scope === 'class' ? (
              classes.loading ? <Spinner /> : activeClasses.length
                ? <Chips<number> label={role === 'teacher' ? 'Lớp nhận (lớp thầy cô phụ trách)' : 'Lớp nhận'} options={activeClasses.map((c) => ({ value: c.id, label: c.name }))} value={classIds} onChange={setClassIds} />
                : <InfoNote><Txt size={14}>Chưa có lớp nào đang hoạt động để gửi.</Txt></InfoNote>
            ) : null}
            {role === 'root_admin' ? <Chips<number> label="Chỉ gửi tới các trường (bỏ trống = tất cả trường)" options={(schools.data?.items ?? []).map((s) => ({ value: s.id, label: s.name }))} value={schoolIds} onChange={setSchoolIds} /> : null}
            {role !== 'teacher' ? <Chips<string> label={role === 'root_admin' ? 'Vai trò nhận (bỏ trống = học sinh, giáo viên và quản trị trường)' : 'Vai trò nhận (bỏ trống = học sinh và giáo viên)'} options={roleOptions} value={roles} onChange={setRoles} /> : null}
            <Field label="Hẹn giờ gửi (giờ Việt Nam, dạng 2026-11-05 07:30; để trống = gửi ngay)" value={at} onChangeText={setAt} placeholder="VD: 2026-11-05 07:30" autoCapitalize="none" error={atInvalid ? 'Nhập đúng dạng năm-tháng-ngày giờ:phút' : null} nativeID="bc-at" />
            {preview !== null ? <InfoNote><Txt f="bold" size={14}>Sẽ gửi tới {preview} người.</Txt></InfoNote> : null}
          </>
        ) : <InfoNote><Txt size={14}>Đã gửi tới {editing?.recipients} người.</Txt></InfoNote>}
      </View>
    </Sheet>
  );
};

export const BroadcastManager: React.FC<{ session: Session }> = ({ session }) => {
  const list = useLoad(() => api.broadcasts(session.token), [session.token], session.expired);
  const { busy, run } = useAction(session.expired);
  const [compose, setCompose] = useState<Broadcast | 'new' | null>(null);
  const [remove, setRemove] = useState<Broadcast | null>(null);
  return (
    <Page>
      <PageHeader title="Thông báo" subtitle={session.user.role === 'teacher' ? 'Gửi thông báo tới các lớp thầy cô phụ trách, có thể hẹn giờ' : session.user.role === 'school_admin' ? 'Gửi thông báo tới cả trường, một khối hoặc một số lớp, có thể hẹn giờ' : 'Gửi thông báo tới toàn hệ thống hoặc theo trường và vai trò, có thể hẹn giờ'}
        actions={<Btn icon={Plus} title="Soạn thông báo" tone="son" onPress={() => setCompose('new')} testID="bc-new" />} />
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner /> : null}
      {list.data ? (
        <DataTable<Broadcast> rows={list.data} rowKey={(b) => b.id} empty="Chưa có thông báo nào. Bấm “Soạn thông báo” để bắt đầu." onRowPress={(b) => setCompose(b)}
          columns={[
            { key: 'title', label: 'Thông báo', flex: 2.4, render: (b) => <Cell main={b.title} sub={b.body} /> },
            { key: 'to', label: 'Gửi tới', flex: 1.3, render: (b) => <Txt size={14}>{scopeText(b)}</Txt> },
            { key: 'status', label: 'Trạng thái', flex: 1.5, render: (b) => (b.status === 'scheduled' ? <View style={{ gap: 4 }}><StatusChip kind="warn" text="Chờ gửi" /><Txt size={12}>{when(b.send_at)}</Txt></View>
              : <View style={{ gap: 4 }}><StatusChip kind="on" text="Đã gửi" /><Txt size={12}>{b.recipients} người · {b.read ?? 0} đã đọc · {when(b.sent_at)}</Txt></View>) },
            { key: 'by', label: 'Người gửi', hideOnCard: false, render: (b) => <Txt size={13}>{b.sender_name ?? '—'}</Txt> },
          ]}
          actions={(b) => <><Btn icon={Pencil} label={`Sửa thông báo ${b.title}`} tone="giay" size="sm" onPress={() => setCompose(b)} /><Btn icon={Trash2} label={b.status === 'sent' ? `Thu hồi thông báo ${b.title}` : `Hủy lịch gửi ${b.title}`} tone="giay" size="sm" onPress={() => setRemove(b)} testID={`bc-delete-${b.id}`} /></>} />
      ) : null}
      {compose ? <Compose session={session} editing={compose === 'new' ? null : compose} onClose={() => setCompose(null)} onSaved={() => list.reload()} /> : null}
      <ConfirmSheet open={Boolean(remove)} title={remove?.status === 'sent' ? 'Thu hồi thông báo?' : 'Hủy lịch gửi?'} message={remove?.status === 'sent' ? `Thông báo “${remove?.title}” sẽ bị xóa khỏi hộp thư của ${remove?.recipients} người đã nhận.` : `Thông báo “${remove?.title}” sẽ không được gửi nữa.`}
        confirmLabel={remove?.status === 'sent' ? 'Thu hồi' : 'Hủy lịch'} tone="son" busy={busy} onCancel={() => setRemove(null)} onConfirm={async () => { const b = remove!; if (await run(() => api.deleteBroadcast(session.token, b.id), b.status === 'sent' ? 'Đã thu hồi thông báo' : 'Đã hủy lịch gửi')) { setRemove(null); list.reload(); } }} />
    </Page>
  );
};
