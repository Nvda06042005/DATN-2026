/**
 * Chia sẻ và duyệt nội dung (HK.GV.029, 039, HK.QT.041, HK.AD.045): giáo viên theo dõi nội dung đã gửi; quản trị viên trường duyệt hoặc từ chối nội dung giáo viên chia sẻ
 * vào kho chung của trường; quản trị tổng duyệt nội dung các trường đề xuất lên kho hệ thống. Từ chối phải ghi lý do.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { Check, Trash2, X } from 'lucide-react-native';
import * as api from '@/api/learningApi';
import { Cell, DataTable, ErrorNote, Page, PageHeader, SearchFilterBar, StatusChip, useAction, useLoad, type SearchFilter } from '@/components/admin/kit';
import { dateText } from '@/components/admin/AccountSheet';
import type { Session } from '@/components/auth';
import { Btn, Card, Field, Sheet, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { QData, QType, ShareDetail, ShareItem } from '@/types/learning';
import { keyLines } from '@/components/portal/QuizPlayer';
import { NODE_KIND_TEXT, QTYPE_TEXT } from '@/types/learning';

const STATUS_TEXT = { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Bị từ chối' } as const;
const STATUS_KIND = { pending: 'warn', approved: 'on', rejected: 'off' } as const;

const Preview: React.FC<{ share: ShareDetail }> = ({ share }) => {
  const { c } = useTheme();
  const x = share.content as Record<string, any> | null;
  if (!x) return <Txt size={14} color={c.muc3}>Nội dung gốc không còn.</Txt>;
  if (share.entity === 'question') {
    return (
      <Card flat pad={12} style={{ gap: 6 }}>
        <Txt f="bold" size={13} color={c.muc2}>{QTYPE_TEXT[x.qtype as QType]} · độ khó {x.difficulty}</Txt>
        <Txt f="semibold" size={16}>{x.prompt}</Txt>
        {keyLines(x.qtype as QType, x.data as QData).map((l, i) => <Txt key={i} size={14}>• {l}</Txt>)}
        {x.explanation ? <Txt size={13} color={c.muc2}>Giải thích: {x.explanation}</Txt> : null}
      </Card>
    );
  }
  if (share.entity === 'quiz') {
    return (
      <Card flat pad={12} style={{ gap: 6 }}>
        <Txt f="semibold" size={16}>{x.title}</Txt>
        {x.description ? <Txt size={14}>{x.description}</Txt> : null}
        <Txt size={13} color={c.muc2}>{x.seconds_per_question}s mỗi câu · đạt từ {x.pass_percent}%</Txt>
        {(x.items as Array<Record<string, any>>).map((i, n) => <Txt key={n} size={14}>{n + 1}. {i.prompt} <Txt size={12} color={c.muc3}>({QTYPE_TEXT[i.qtype as QType]}, {i.points} điểm)</Txt></Txt>)}
      </Card>
    );
  }
  return (
    <Card flat pad={12} style={{ gap: 6 }}>
      <Txt f="semibold" size={16}>{x.title}</Txt>
      {x.description ? <Txt size={14}>{x.description}</Txt> : null}
      {(x.nodes as Array<Record<string, any>>).map((n) => <Txt key={n.position} size={14}>{n.position}. [{NODE_KIND_TEXT[n.kind as keyof typeof NODE_KIND_TEXT]}] {n.title}{n.objective ? ` – ${n.objective}` : ''}</Txt>)}
    </Card>
  );
};

const ReviewSheet: React.FC<{ session: Session; id: number; onClose: () => void; onDone: () => void }> = ({ session, id, onClose, onDone }) => {
  const { c } = useTheme();
  const detail = useLoad(() => api.getShare(session.token, id), [session.token, id], session.expired);
  const { busy, run } = useAction(session.expired);
  const [note, setNote] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const d = detail.data;
  const decide = async (approve: boolean) => {
    const res = await run(() => api.reviewShare(session.token, id, approve, note), approve ? 'Đã duyệt: nội dung đã vào kho đích' : 'Đã từ chối');
    if (res) { onDone(); onClose(); }
  };
  return (
    <Sheet open onClose={onClose} title={d ? `Duyệt ${d.entity_label}` : 'Duyệt nội dung'} subtitle={d ? `Gửi bởi ${d.requester ?? 'không rõ'}${d.school_name ? ` · ${d.school_name}` : ''} · ${dateText(d.created_at)}` : undefined} wide>
      <ErrorNote message={detail.error} />
      {detail.loading && !d ? <Spinner /> : null}
      {d ? (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <StatusChip kind={STATUS_KIND[d.status]} text={STATUS_TEXT[d.status]} />
            <StatusChip kind="info" text={d.target === 'school' ? 'Vào kho của trường' : 'Lên kho hệ thống'} />
          </View>
          <Preview share={d} />
          {d.review_note ? <Txt size={14} color={c.muc2}>Ghi chú của người duyệt: {d.review_note}</Txt> : null}
          {d.can_review ? (
            rejecting ? (
              <View style={{ gap: 8 }}>
                <Field label="Lý do từ chối * (người gửi sẽ thấy)" value={note} onChangeText={setNote} multiline numberOfLines={3} inputStyle={{ minHeight: 70, textAlignVertical: 'top' }} maxLength={300} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Btn title="Quay lại" tone="giay" size="sm" onPress={() => setRejecting(false)} />
                  <Btn icon={X} title="Gửi lời từ chối" tone="son" size="sm" loading={busy} disabled={note.trim().length < 3} onPress={() => decide(false)} testID="share-reject-confirm" />
                </View>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                <Field label="Ghi chú cho người gửi (tùy chọn)" value={note} onChangeText={setNote} maxLength={300} />
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  <Btn icon={Check} title="Duyệt" tone="ngoc" loading={busy} onPress={() => decide(true)} testID="share-approve" />
                  <Btn icon={X} title="Từ chối…" tone="giay" onPress={() => setRejecting(true)} testID="share-reject" />
                </View>
                <Txt size={12} color={c.muc3}>Khi duyệt, hệ thống sao nội dung vào kho đích; bản của người gửi vẫn giữ nguyên để họ tiếp tục sửa.</Txt>
              </View>
            )
          ) : null}
        </View>
      ) : null}
    </Sheet>
  );
};

export const ShareInbox: React.FC<{ session: Session }> = ({ session }) => {
  const role = session.user.role;
  const reviewer = role !== 'teacher';
  const [status, setStatus] = useState(reviewer ? 'pending' : '');
  const [entity, setEntity] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const list = useLoad(() => api.listShares(session.token, { status, entity }), [session.token, status, entity], session.expired);
  const { busy, run } = useAction(session.expired);
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const rows = (list.data ?? []).filter((r) => !term || `${r.title} ${r.requester ?? ''} ${r.school_name ?? ''}`.toLowerCase().includes(term));
  const f_status: SearchFilter = { key: 'status', label: 'Trạng thái', value: status, options: [{ value: '', label: 'Tất cả' }, { value: 'pending', label: 'Chờ duyệt' }, { value: 'approved', label: 'Đã duyệt' }, { value: 'rejected', label: 'Bị từ chối' }], onChange: setStatus };
  const f_entity: SearchFilter = { key: 'entity', label: 'Loại nội dung', value: entity, options: [{ value: '', label: 'Tất cả' }, { value: 'question', label: 'Câu hỏi' }, { value: 'quiz', label: 'Bộ đề' }, { value: 'journey', label: 'Hành trình' }], onChange: setEntity };
  return (
    <Page>
      <PageHeader title={reviewer ? 'Duyệt nội dung' : 'Nội dung đã gửi'}
        subtitle={role === 'root_admin' ? 'Câu hỏi, bộ đề, hành trình do các trường đề xuất lên kho hệ thống.' : role === 'school_admin' ? 'Câu hỏi, bộ đề, hành trình giáo viên chia sẻ vào kho chung của trường, và nội dung trường đã đề xuất lên hệ thống.' : 'Theo dõi câu hỏi, bộ đề, hành trình đã gửi vào kho chung của trường. Có thể rút lại khi còn chờ duyệt.'} />
      <SearchFilterBar placeholder="Tìm theo tên nội dung hoặc người gửi" value={q} onChange={setQ} searchId="share-search" filters={[f_status, f_entity]} />
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner /> : null}
      {list.data ? (
        <DataTable<ShareItem> rows={rows} rowKey={(r) => r.id} onRowPress={(r) => setOpen(r.id)} empty={status === 'pending' ? 'Không có nội dung nào chờ duyệt' : 'Chưa có nội dung nào'}
          columns={[
            { key: 'title', label: 'Nội dung', flex: 3, render: (r) => <Cell main={r.title} /> },
            { key: 'entity', filter: f_entity, label: 'Loại', flex: 1, render: (r) => <Txt size={13}>{r.entity_label}</Txt> },
            { key: 'target', label: 'Gửi tới', flex: 1.2, render: (r) => <Txt size={13}>{r.target === 'school' ? 'Kho của trường' : 'Kho hệ thống'}</Txt> },
            { key: 'who', label: 'Người gửi', flex: 1.5, render: (r) => <Cell main={r.requester ?? '—'} sub={r.school_name} /> },
            { key: 'status', filter: f_status, label: 'Trạng thái', flex: 1.2, render: (r) => <StatusChip kind={STATUS_KIND[r.status]} text={STATUS_TEXT[r.status]} /> },
            { key: 'time', label: 'Ngày gửi', flex: 1, hideOnCard: true, render: (r) => <Txt size={13}>{dateText(r.created_at)}</Txt> },
          ]}
          actions={role === 'teacher' || role === 'school_admin' ? (r) => (r.status === 'pending' && r.requested_by === session.user.id
            ? <Btn icon={Trash2} label={`Rút lại ${r.title}`} title="Rút lại" tone="giay" size="sm" disabled={busy} onPress={async () => { if (await run(async () => { await api.withdrawShare(session.token, r.id); return true; }, 'Đã rút lại')) list.reload(); }} /> : null) : undefined} />
      ) : null}
      {open !== null ? <ReviewSheet session={session} id={open} onClose={() => setOpen(null)} onDone={list.reload} /> : null}
    </Page>
  );
};
