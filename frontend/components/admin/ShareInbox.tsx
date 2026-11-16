/**
 * Chia sẻ và duyệt nội dung (HK.GV.029, 039, HK.QT.041, HK.AD.045): giáo viên theo dõi nội dung đã gửi; quản trị viên trường duyệt hoặc từ chối nội dung giáo viên chia sẻ
 * vào kho chung của trường; quản trị tổng duyệt nội dung các trường đề xuất lên kho hệ thống. Từ chối phải ghi lý do.
 * 16/11/2026: trang "Nội dung đã gửi" của giáo viên là hộp thư như Gmail (`SentMailbox`): chọn người nhận cùng trường (quản trị trường, giáo viên, học sinh),
 * người nhận được thông báo (migration 070); người duyệt thấy tiêu đề và lời nhắn của thư.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, TextInput, useWindowDimensions, View } from 'react-native';
import { ArrowLeft, Check, Mail, UserPlus, CheckCircle2, CircleHelp, Clock3, Forward, Inbox, ListChecks, Paperclip, PenSquare, Route, Send, Trash2, Undo2, X, XCircle } from 'lucide-react-native';
import * as api from '@/api/learningApi';
import { Cell, DataTable, ErrorNote, Page, PageHeader, SearchFilterBar, StatusChip, useAction, useLoad, usePaged, type SearchFilter, useDebounced } from '@/components/admin/kit';
import { AdminSelect } from '@/components/admin/AdminSelect';
import { QuestionPicker } from '@/components/admin/ContentKit';
import { FONT } from '@/constants/theme';
import { ExamReview } from '@/components/admin/LibraryExams';
import { Checklist } from '@/components/admin/ClassPeople';
import { dateText } from '@/components/admin/AccountSheet';
import type { Session } from '@/components/auth';
import { Avatar, Btn, Card, Field, Segmented, Sheet, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { QData, QType, Recipient, ShareDetail, ShareItem } from '@/types/learning';
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
          {d.subject ? <Txt f="bold" size={16}>{d.subject}</Txt> : null}
          {d.message ? <Card flat pad={12}><Txt size={14} style={{ lineHeight: 22 }} selectable>{d.message}</Txt></Card> : null}
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


// ---------------------------------------------------------------------- giáo viên: hộp thư "Nội dung đã gửi" (16/11/2026)
/**
 * Hộp thư đã gửi của giáo viên (cấu trúc Gmail): thư mục Tất cả / Chờ duyệt / Đã duyệt / Bị từ chối, danh sách thư, khung đọc thư.
 * Soạn thư (đợt 2, migration 070): chọn người nhận trong danh sách cùng trường – quản trị viên trường, giáo viên, học sinh (chọn từng người) –,
 * tiêu đề, nội dung, đính kèm câu hỏi / bộ đề / hành trình (cần có quản trị viên trường trong người nhận để duyệt vào kho chung).
 * Mọi người nhận được thông báo ở chuông / mục Thông báo; người gửi thấy ai đã đọc. Yêu cầu duyệt gửi trước đó (không có thư) vẫn hiện trong danh sách.
 */
type Folder = 'all' | 'pending' | 'approved' | 'rejected';
const FOLDERS: Array<{ id: Folder; label: string; icon: typeof Inbox }> = [
  { id: 'all', label: 'Tất cả thư đã gửi', icon: Inbox },
  { id: 'pending', label: 'Chờ duyệt', icon: Clock3 },
  { id: 'approved', label: 'Đã duyệt', icon: CheckCircle2 },
  { id: 'rejected', label: 'Bị từ chối', icon: XCircle },
];
const ENTITY_ICON = { question: CircleHelp, quiz: ListChecks, journey: Route } as const;
const ENTITY_NAME = { question: 'Câu hỏi', quiz: 'Bộ đề', journey: 'Hành trình' } as const;
type ShareEntityKind = 'question' | 'quiz' | 'journey';
type RoleKey = 'school_admin' | 'teacher' | 'student';
const ROLE_TABS: Array<{ value: RoleKey; label: string }> = [{ value: 'school_admin', label: 'Quản trị trường' }, { value: 'teacher', label: 'Giáo viên' }, { value: 'student', label: 'Học sinh' }];
const autoSubject = (label: string, title: string) => `Đề nghị duyệt ${label}: ${title}`.slice(0, 150);
const subjectOf = (r: ShareItem) => r.subject ?? autoSubject(r.entity_label, r.title);
/** Giờ:phút nếu là hôm nay, ngày/tháng nếu cùng năm, đủ ngày nếu khác năm (như danh sách thư của Gmail) */
const mailDate = (iso: string) => {
  const d = new Date(iso), now = new Date();
  const opt = { timeZone: 'Asia/Ho_Chi_Minh' } as const;
  if (d.toLocaleDateString('vi-VN', opt) === now.toLocaleDateString('vi-VN', opt)) return d.toLocaleTimeString('vi-VN', { ...opt, hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('vi-VN', { ...opt, day: '2-digit', month: '2-digit', ...(d.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }) });
};
const fullDate = (iso: string) => new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Một dòng trong hộp thư: thư (migration 070) hoặc yêu cầu duyệt gửi trước đó */
interface MailItem {
  key: string; kind: 'message' | 'share'; id: number; subject: string; to: string; snippet: string; date: string;
  status: ShareItem['status'] | null; attach: { entity: ShareEntityKind; title: string } | null; read: string | null;
}

const MailRow: React.FC<{ r: MailItem; active: boolean; onPress: () => void }> = ({ r, active, onPress }) => {
  const { c } = useTheme();
  const Icon = r.attach ? ENTITY_ICON[r.attach.entity] : Mail;
  const tint = r.status === 'approved' ? [c.mocNhat, c.mocChu] : r.status === 'rejected' ? [c.sonNhat, c.sonChu] : r.status === 'pending' ? [c.vangNhat, c.vangChu] : [c.thuyNhat, c.thuyChu];
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={`${r.subject}, gửi ${r.to}, ${mailDate(r.date)}${r.status ? `, ${STATUS_TEXT[r.status]}` : ''}`} testID={`mail-row-${r.key}`}
      style={({ pressed }) => ({
        flexDirection: 'row', gap: 12, paddingVertical: 12, paddingHorizontal: 14, minHeight: 72, borderBottomWidth: 1, borderBottomColor: c.adminLine,
        backgroundColor: active ? c.adminTint : pressed ? c.adminCanvas : c.the, borderLeftWidth: 3, borderLeftColor: active ? c.logoRed : 'transparent',
      })}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: tint[0], alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
        <Icon size={18} color={tint[1]} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Txt f="bold" size={14} numberOfLines={1} style={{ flex: 1 }}>Đến: {r.to}</Txt>
          <Txt size={12} color={c.muc3}>{mailDate(r.date)}</Txt>
        </View>
        <Txt f="semibold" size={14} numberOfLines={1}>{r.subject}</Txt>
        <Txt size={13} color={c.muc3} numberOfLines={1}>{r.snippet}</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
          {r.status ? <StatusChip kind={STATUS_KIND[r.status]} text={STATUS_TEXT[r.status]} /> : null}
          {r.read ? <Txt size={12} color={c.muc2}>{r.read}</Txt> : null}
          {r.attach ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 }}>
              <Paperclip size={13} color={c.muc3} />
              <Txt size={12} color={c.muc2} numberOfLines={1} style={{ flexShrink: 1 }}>{ENTITY_NAME[r.attach.entity]}: {r.attach.title}</Txt>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
};

/** Nội dung đính kèm và kết quả duyệt (phản hồi của quản trị trường) */
const AttachmentBlock: React.FC<{ d: ShareDetail }> = ({ d }) => {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const Icon = ENTITY_ICON[d.entity];
  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 8 }}>
        <Txt f="bold" size={13} color={c.muc2}>1 nội dung đính kèm · {STATUS_TEXT[d.status]}</Txt>
        <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${open ? 'Thu gọn' : 'Xem'} ${d.entity_label} đính kèm`}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, minHeight: 56, borderRadius: 10, borderWidth: 1, borderColor: c.adminLine, backgroundColor: pressed ? c.adminCanvas : c.the, maxWidth: 520 })}>
          <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: c.adminTint, alignItems: 'center', justifyContent: 'center' }}><Icon size={18} color={c.logoRed} /></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt f="semibold" size={14} numberOfLines={2}>{d.title}</Txt>
            <Txt size={12} color={c.muc3}>{ENTITY_NAME[d.entity]} · {open ? 'bấm để thu gọn' : 'bấm để xem nội dung'}</Txt>
          </View>
        </Pressable>
        {open ? <Preview share={d} /> : null}
      </View>
      {d.status !== 'pending' ? (
        <View style={{ borderLeftWidth: 3, borderLeftColor: d.status === 'approved' ? c.mocChu : c.sonChu, paddingLeft: 14, paddingVertical: 4, gap: 4 }} testID="mail-reply">
          <Txt f="bold" size={14}>{d.reviewer ?? 'Quản trị viên trường'} đã trả lời{d.reviewed_at ? <Txt size={12} color={c.muc3}>  ·  {fullDate(d.reviewed_at)}</Txt> : null}</Txt>
          <Txt size={14} style={{ lineHeight: 22 }}>{d.status === 'approved' ? 'Đã duyệt: nội dung đã được sao vào kho chung của trường.' : 'Từ chối duyệt.'}</Txt>
          {d.review_note ? <Txt size={14} color={c.muc2} style={{ lineHeight: 22 }}>{d.status === 'rejected' ? 'Lý do: ' : 'Ghi chú: '}{d.review_note}</Txt> : null}
        </View>
      ) : null}
    </View>
  );
};

const Sender: React.FC<{ session: Session; to: React.ReactNode; date: string }> = ({ session, to, date }) => {
  const { c } = useTheme();
  const me = session.user;
  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
      <Avatar name={me.full_name} size={40} uri={(me as { avatar_url?: string | null }).avatar_url ?? null} />
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Txt f="bold" size={14}>{me.full_name}{me.user_code ? <Txt size={13} color={c.muc3}>  ·  {me.user_code}</Txt> : null}</Txt>
        {to}
      </View>
      <Txt size={12} color={c.muc3} style={{ textAlign: 'right' }}>{fullDate(date)}</Txt>
    </View>
  );
};

/** Khung đọc một thư (migration 070): người nhận (đã đọc / chưa đọc), nội dung, đính kèm */
const MessageView: React.FC<{ session: Session; id: number; onBack?: () => void }> = ({ session, id, onBack }) => {
  const { c } = useTheme();
  const detail = useLoad(() => api.getMessage(session.token, id), [session.token, id], session.expired);
  const d = detail.data;
  if (detail.loading && !d) return <Spinner />;
  if (!d) return <ErrorNote message={detail.error} />;
  const read = d.recipients.filter((r) => r.read_at).length;
  return (
    <View style={{ gap: 16 }} testID="mail-view">
      {onBack ? <Btn icon={ArrowLeft} title="Hộp thư" tone="ghost" size="sm" onPress={onBack} style={{ marginLeft: -10, alignSelf: 'flex-start' }} /> : null}
      <Txt f="bold" size={20} accessibilityRole="header" style={{ lineHeight: 28 }}>{d.subject}</Txt>
      <Sender session={session} date={d.created_at} to={
        <View style={{ gap: 6 }}>
          <Txt size={13} color={c.muc2}>đến {d.recipients.length} người · {read} đã đọc</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }} testID="mail-recipients">
            {d.recipients.map((r) => (
              <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: r.read_at ? c.mocNhat : c.adminCanvas }}>
                {r.read_at ? <Check size={12} color={c.mocChu} /> : null}
                <Txt size={12} f="semibold" color={r.read_at ? c.mocChu : c.muc}>{r.full_name}</Txt>
                <Txt size={11} color={c.muc3}>· {r.role_label}</Txt>
              </View>
            ))}
          </View>
        </View>
      } />
      <View style={{ borderTopWidth: 1, borderTopColor: c.adminLine, paddingTop: 16 }}>
        {d.body ? <Txt size={15} style={{ lineHeight: 24 }} selectable>{d.body}</Txt> : <Txt size={14} color={c.muc3} style={{ fontStyle: 'italic' }}>(Thư không có nội dung)</Txt>}
      </View>
      {d.share ? <AttachmentBlock d={d.share} /> : null}
    </View>
  );
};

/** Khung đọc yêu cầu duyệt gửi trước khi có thư (giữ để xem lại, rút lại, gửi lại) */
const ShareView: React.FC<{ session: Session; id: number; onChanged: () => void; onResend: (r: ShareItem) => void; onBack?: () => void }> = ({ session, id, onChanged, onResend, onBack }) => {
  const { c } = useTheme();
  const detail = useLoad(() => api.getShare(session.token, id), [session.token, id], session.expired);
  const { busy, run } = useAction(session.expired);
  const d = detail.data;
  if (detail.loading && !d) return <Spinner />;
  if (!d) return <ErrorNote message={detail.error} />;
  return (
    <View style={{ gap: 16 }} testID="mail-view">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {onBack ? <Btn icon={ArrowLeft} title="Hộp thư" tone="ghost" size="sm" onPress={onBack} style={{ marginLeft: -10 }} /> : null}
        <View style={{ flex: 1 }} />
        {d.status === 'pending' ? (
          <Btn icon={Undo2} title="Rút lại" tone="giay" size="sm" loading={busy} testID="mail-withdraw"
            onPress={async () => { if (await run(async () => { await api.withdrawShare(session.token, d.id); return true; }, 'Đã rút lại')) onChanged(); }} />
        ) : null}
        {d.status === 'rejected' ? <Btn icon={Forward} title="Sửa rồi gửi lại" tone="son" size="sm" onPress={() => onResend(d)} testID="mail-resend" /> : null}
      </View>
      <Txt f="bold" size={20} accessibilityRole="header" style={{ lineHeight: 28 }}>{subjectOf(d)}</Txt>
      <Sender session={session} date={d.created_at} to={<Txt size={13} color={c.muc2}>đến Ban Giám hiệu (quản trị viên trường){d.school_name ? ` · ${d.school_name}` : ''}</Txt>} />
      <View style={{ borderTopWidth: 1, borderTopColor: c.adminLine, paddingTop: 16 }}>
        {d.message ? <Txt size={15} style={{ lineHeight: 24 }} selectable>{d.message}</Txt> : <Txt size={14} color={c.muc3} style={{ fontStyle: 'italic' }}>(Thư không có nội dung)</Txt>}
      </View>
      <AttachmentBlock d={d} />
    </View>
  );
};

/** Chọn người nhận cùng trường: quản trị viên trường, giáo viên, học sinh (tìm theo tên / mã, chọn từng người hoặc cả danh sách đang hiện) */
const RecipientPicker: React.FC<{ session: Session; value: Recipient[]; onClose: () => void; onDone: (list: Recipient[]) => void }> = ({ session, value, onClose, onDone }) => {
  const { c } = useTheme();
  const [role, setRole] = useState<RoleKey>('school_admin');
  const [q, setQ] = useState('');
  const term = useDebounced(q.trim(), 300);
  const list = useLoad(() => api.messageRecipients(session.token, { role, q: term }), [session.token, role, term], session.expired);
  const [picked, setPicked] = useState<Recipient[]>(value);
  const rows = list.data ?? [];
  const ids = picked.map((p) => p.id);
  return (
    <Sheet open onClose={onClose} title="Chọn người nhận" wide
      footer={<View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><Txt size={13} color={c.muc2} style={{ flex: 1 }}>Đã chọn {picked.length} người</Txt><Btn title="Hủy" tone="giay" onPress={onClose} /><Btn icon={Check} title="Xong" tone="son" onPress={() => onDone(picked)} testID="recipients-done" /></View>}>
      <View style={{ gap: 12 }} testID="recipient-picker">
        <Segmented<RoleKey> label="Nhóm người nhận" value={role} onChange={setRole} options={ROLE_TABS} />
        <Field label="Tìm theo họ tên hoặc mã" value={q} onChangeText={setQ} testID="recipient-search" />
        <ErrorNote message={list.error} />
        {list.loading && !list.data ? <Spinner /> : null}
        {list.data ? (
          <Checklist items={rows.map((r) => ({ id: r.id, label: r.full_name, sub: [r.user_code, r.classes ? `Lớp ${r.classes}` : null].filter(Boolean).join(' · ') || r.role_label }))}
            value={ids.filter((id) => rows.some((r) => r.id === id))}
            onChange={(next) => setPicked((old) => [...old.filter((p) => !rows.some((r) => r.id === p.id)), ...rows.filter((r) => next.includes(r.id))])}
            empty="Không có ai phù hợp" />
        ) : null}
      </View>
    </Sheet>
  );
};

type Draft = { entity?: ShareEntityKind; id?: number; title?: string; subject?: string | null; message?: string | null };

/** Thư mới theo cấu trúc Gmail: Đến (chọn người nhận), Tiêu đề, nội dung, đính kèm; chân hộp: Gửi, Hủy */
const ComposeSheet: React.FC<{ session: Session; initial?: Draft | null; onClose: () => void; onSent: (id: number) => void }> = ({ session, initial, onClose, onSent }) => {
  const { c } = useTheme();
  const [to, setTo] = useState<Recipient[]>([]);
  const [choosing, setChoosing] = useState(false);
  const [entity, setEntity] = useState<ShareEntityKind>(initial?.entity ?? 'question');
  const [attached, setAttached] = useState<{ id: number; title: string } | null>(initial?.id && initial.title ? { id: initial.id, title: initial.title } : null);
  const [withAttachment, setWithAttachment] = useState(Boolean(initial?.id));
  const [subject, setSubject] = useState(initial?.subject ?? '');
  const [message, setMessage] = useState(initial?.message ?? '');
  const [picking, setPicking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const { busy, run } = useAction(session.expired);
  const quizzes = useLoad(() => (withAttachment && entity === 'quiz' ? api.listQuizzes(session.token, { store: 'mine', limit: 100 }) : Promise.resolve(null)), [session.token, entity, withAttachment], session.expired);
  const journeys = useLoad(() => (withAttachment && entity === 'journey' ? api.listJourneys(session.token, { store: 'mine' }) : Promise.resolve(null)), [session.token, entity, withAttachment], session.expired);
  const label = { question: 'câu hỏi', quiz: 'bộ đề', journey: 'hành trình' }[entity];
  const send = async () => {
    setProblem(null);
    if (!to.length) { setProblem('Hãy chọn người nhận.'); return; }
    if (!subject.trim()) { setProblem('Hãy nhập tiêu đề.'); return; }
    if (withAttachment && !attached) { setProblem(`Hãy chọn ${label} đính kèm hoặc bỏ đính kèm.`); return; }
    const res = await run(() => api.sendMessage(session.token, { recipient_ids: to.map((r) => r.id), subject: subject.trim(), body: message.trim() || undefined, ...(withAttachment && attached ? { entity, entity_id: attached.id } : {}) }), 'Đã gửi thư');
    if (res) onSent(res.id);
  };
  const line = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, borderBottomWidth: 1, borderBottomColor: c.adminLine, paddingVertical: 10, minHeight: 48 };
  const list = (entity === 'quiz' ? (quizzes.data?.items ?? []) : (journeys.data ?? [])) as Array<{ id: number; title: string }>;
  return (
    <Sheet open onClose={onClose} title="Thư mới" icon={<PenSquare size={20} color={c.logoRed} />} wide
      footer={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Btn icon={Send} title="Gửi" tone="son" loading={busy} onPress={() => { void send(); }} testID="compose-send" />
          <Btn icon={Paperclip} title={withAttachment ? 'Bỏ đính kèm' : 'Đính kèm'} tone="giay" onPress={() => { setWithAttachment((v) => !v); setAttached(null); }} testID="compose-attach-toggle" />
          <View style={{ flex: 1 }} />
          <Btn icon={Trash2} label="Hủy thư nháp" title="Hủy" tone="ghost" onPress={onClose} testID="compose-discard" />
        </View>
      }>
      <View style={{ gap: 4 }} testID="compose-sheet">
        <View style={[line, { alignItems: 'flex-start' }]}>
          <Txt f="bold" size={14} color={c.muc2} style={{ width: 72, paddingTop: 6 }}>Đến</Txt>
          <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }} testID="compose-to">
            {to.map((r) => (
              <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 10, paddingRight: 4, paddingVertical: 2, borderRadius: 999, backgroundColor: c.adminTint }}>
                <Txt size={13} f="semibold">{r.full_name}</Txt>
                <Txt size={11} color={c.muc3}>· {r.role_label}</Txt>
                <Btn icon={X} label={`Bỏ ${r.full_name}`} tone="ghost" size="sm" onPress={() => setTo((old) => old.filter((x) => x.id !== r.id))} />
              </View>
            ))}
            <Btn icon={UserPlus} title={to.length ? 'Thêm' : 'Chọn người nhận'} tone="giay" size="sm" onPress={() => setChoosing(true)} testID="compose-pick-recipients" />
          </View>
        </View>
        <View style={line}>
          <Txt f="bold" size={14} color={c.muc2} style={{ width: 72 }}>Tiêu đề</Txt>
          <TextInput value={subject} onChangeText={setSubject} maxLength={150} accessibilityLabel="Tiêu đề" testID="compose-subject"
            style={[{ flex: 1, fontSize: 15, color: c.muc, paddingVertical: 6, fontFamily: FONT.semibold }, { outlineStyle: 'none' } as object]} />
        </View>
        <TextInput value={message} onChangeText={setMessage} multiline maxLength={2000} accessibilityLabel="Nội dung thư" testID="compose-message"
          style={[{ minHeight: 200, fontSize: 15, lineHeight: 24, color: c.muc, paddingVertical: 12, textAlignVertical: 'top', fontFamily: FONT.body }, { outlineStyle: 'none' } as object]} />
        <Txt size={12} color={c.muc3} style={{ textAlign: 'right' }}>{message.length}/2000</Txt>
        {withAttachment ? (
          <View style={{ gap: 10, borderTopWidth: 1, borderTopColor: c.adminLine, paddingTop: 12 }}>
            <Segmented<ShareEntityKind> label="Loại nội dung đính kèm" value={entity} onChange={(v) => { setEntity(v); setAttached(null); }}
              options={[{ value: 'question', label: 'Câu hỏi' }, { value: 'quiz', label: 'Bộ đề' }, { value: 'journey', label: 'Hành trình' }]} />
            {entity === 'question' ? (
              attached ? null : <Btn icon={Paperclip} title="Chọn câu hỏi trong kho riêng" tone="giay" size="sm" onPress={() => setPicking(true)} testID="compose-pick-question" style={{ alignSelf: 'flex-start' }} />
            ) : (
              <AdminSelect label={entity === 'quiz' ? 'Bộ đề của tôi' : 'Hành trình của tôi'} value={attached ? String(attached.id) : ''} testID="compose-pick"
                onChange={(v) => { const hit = list.find((x) => String(x.id) === v); setAttached(hit ? { id: hit.id, title: hit.title } : null); }}
                options={[{ value: '', label: `— Chọn ${label} —` }, ...list.map((x) => ({ value: String(x.id), label: x.title }))]} />
            )}
            {attached ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: c.adminLine, backgroundColor: c.adminCanvas, maxWidth: 560 }} testID="compose-attachment">
                <Paperclip size={16} color={c.muc2} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt f="semibold" size={14} numberOfLines={2}>{attached.title}</Txt>
                  <Txt size={12} color={c.muc3}>{ENTITY_NAME[entity]}</Txt>
                </View>
                <Btn icon={X} label={`Bỏ đính kèm ${attached.title}`} tone="ghost" size="sm" onPress={() => setAttached(null)} />
              </View>
            ) : null}
          </View>
        ) : null}
        <ErrorNote message={problem} />
      </View>
      {choosing ? <RecipientPicker session={session} value={to} onClose={() => setChoosing(false)} onDone={(list) => { setTo(list); setChoosing(false); }} /> : null}
      {picking ? (
        <QuestionPicker session={session} title="Đính kèm câu hỏi trong kho riêng" scopeFilter="mine" multi={false} exclude={[]} onClose={() => setPicking(false)}
          onPick={(items) => { const q = items[0]; if (q) { setEntity('question'); setAttached({ id: q.id, title: q.prompt.slice(0, 120) }); } setPicking(false); }} />
      ) : null}
    </Sheet>
  );
};

const SentMailbox: React.FC<{ session: Session }> = ({ session }) => {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 1180;
  const messages = useLoad(() => api.sentMessages(session.token), [session.token], session.expired);
  const shares = useLoad(() => api.listShares(session.token, {}), [session.token], session.expired);
  const [folder, setFolder] = useState<Folder>('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [compose, setCompose] = useState<Draft | null | false>(false);
  const linked = new Set((messages.data ?? []).map((m) => m.share_id).filter((n): n is number => typeof n === 'number'));
  const all: MailItem[] = useMemo(() => [
    ...(messages.data ?? []).map((m): MailItem => ({
      key: `m${m.id}`, kind: 'message', id: m.id, subject: m.subject, to: m.names ? `${m.names}${m.recipients > 4 ? ` và ${m.recipients - 4} người khác` : ''}` : `${m.recipients} người`,
      snippet: (m.body ?? 'Thư không có nội dung').replace(/\s+/g, ' '), date: m.created_at, status: m.share_status ?? null,
      attach: m.entity ? { entity: m.entity, title: ENTITY_NAME[m.entity] } : null, read: `${m.read}/${m.recipients} đã đọc`,
    })),
    ...(shares.data ?? []).filter((s) => !linked.has(s.id)).map((s): MailItem => ({
      key: `s${s.id}`, kind: 'share', id: s.id, subject: subjectOf(s), to: 'Ban Giám hiệu', snippet: (s.message ?? (s.review_note ? `Phản hồi: ${s.review_note}` : 'Không có nội dung')).replace(/\s+/g, ' '),
      date: s.created_at, status: s.status, attach: { entity: s.entity, title: s.title }, read: null,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date)), [messages.data, shares.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const term = q.trim().toLowerCase();
  const rows = all.filter((r) => (folder === 'all' || r.status === folder) && (!term || `${r.subject} ${r.to} ${r.snippet} ${r.attach?.title ?? ''}`.toLowerCase().includes(term)));
  const { shown, pager } = usePaged(rows, `${folder}|${term}`);
  const count = (f: Folder) => (f === 'all' ? all.length : all.filter((r) => r.status === f).length);
  const selected = open ?? (wide ? shown[0]?.key ?? null : null);
  const current = all.find((r) => r.key === selected) ?? null;
  const reload = () => { setOpen(null); messages.reload(); shares.reload(); };
  const view = current ? (current.kind === 'message'
    ? <MessageView key={current.key} session={session} id={current.id} onBack={wide ? undefined : () => setOpen(null)} />
    : <ShareView key={current.key} session={session} id={current.id} onChanged={reload} onBack={wide ? undefined : () => setOpen(null)}
      onResend={(r) => setCompose({ entity: r.entity, id: r.entity_id, title: r.title, subject: r.subject, message: r.message })} />) : null;
  const loading = (messages.loading && !messages.data) || (shares.loading && !shares.data);
  return (
    <Page>
      <PageHeader title="Nội dung đã gửi" actions={<Btn icon={PenSquare} title="Soạn thư" tone="son" size="sm" onPress={() => setCompose(null)} testID="share-compose" />} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="tablist">
        {FOLDERS.map((f) => {
          const on = folder === f.id;
          return (
            <Pressable key={f.id} onPress={() => { setFolder(f.id); setOpen(null); }} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={`${f.label}: ${count(f.id)} thư`} testID={`mail-folder-${f.id}`}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1,
                borderColor: on ? c.logoRed : c.adminLine, backgroundColor: on ? c.adminTint : pressed ? c.adminCanvas : c.the })}>
              <f.icon size={16} color={on ? c.logoRed : c.muc2} />
              <Txt f={on ? 'bold' : 'semibold'} size={14} color={on ? c.logoRed : c.muc}>{f.label}</Txt>
              <Txt f="bold" size={12} color={on ? c.logoRed : c.muc3}>{count(f.id)}</Txt>
            </Pressable>
          );
        })}
      </View>
      <SearchFilterBar placeholder="Tìm trong thư đã gửi" value={q} onChange={setQ} searchId="share-search" filters={[]} />
      <ErrorNote message={messages.error ?? shares.error} />
      {loading ? <Spinner /> : (
        <View style={{ flexDirection: wide ? 'row' : 'column', gap: 16, alignItems: 'flex-start' }}>
          <View style={{ width: wide ? 420 : '100%', gap: 10 }}>
            <Card flat pad={0} style={{ borderRadius: 12, overflow: 'hidden' }} testID="mail-list">
              {shown.length ? shown.map((r) => <MailRow key={r.key} r={r} active={wide && r.key === selected} onPress={() => setOpen(r.key)} />) : (
                <View style={{ padding: 24, alignItems: 'center', gap: 8 }}>
                  <Inbox size={28} color={c.muc3} />
                  <Txt size={14} color={c.muc2} center>{all.length ? 'Không có thư nào khớp bộ lọc' : 'Chưa gửi thư nào.'}</Txt>
                </View>
              )}
            </Card>
            {pager}
          </View>
          {wide ? <Card flat pad={20} style={{ flex: 1, minWidth: 0, borderRadius: 12 }}>{view ?? <Txt size={14} color={c.muc3}>Chọn một thư để đọc.</Txt>}</Card> : null}
        </View>
      )}
      {!wide && view ? <Sheet open onClose={() => setOpen(null)} title="Thư đã gửi" wide>{view}</Sheet> : null}
      {compose !== false ? (
        <ComposeSheet session={session} initial={compose} onClose={() => setCompose(false)}
          onSent={(id) => { setCompose(false); setFolder('all'); messages.reload(); shares.reload(); setOpen(`m${id}`); }} />
      ) : null}
    </Page>
  );
};

/** Giáo viên: hộp thư đã gửi; quản trị trường / quản trị tổng: bảng duyệt nội dung */
export const ShareInbox: React.FC<{ session: Session }> = ({ session }) => (session.user.role === 'teacher' ? <SentMailbox session={session} /> : session.user.role === 'school_admin' ? <SchoolReview session={session} /> : <ReviewInbox session={session} />);

/** Quản trị trường: Duyệt nội dung gồm nội dung giáo viên chia sẻ và đề kiểm tra giữa kỳ / cuối kỳ (16/11/2026) */
const SchoolReview: React.FC<{ session: Session }> = ({ session }) => {
  const [view, setView] = useState<'shares' | 'exams'>('shares');
  const switcher = <Segmented<'shares' | 'exams'> label="Loại cần duyệt" value={view} onChange={setView} options={[{ value: 'shares', label: 'Nội dung chia sẻ' }, { value: 'exams', label: 'Đề kiểm tra' }]} />;
  return view === 'exams' ? <ExamReview session={session} switcher={switcher} /> : <ReviewInbox session={session} switcher={switcher} />;
};

const ReviewInbox: React.FC<{ session: Session; switcher?: React.ReactNode }> = ({ session, switcher }) => {
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
      {switcher}
      <SearchFilterBar placeholder="Tìm theo tên nội dung hoặc người gửi" value={q} onChange={setQ} searchId="share-search" filters={[f_status, f_entity]} />
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner /> : null}
      {list.data ? (
        <DataTable<ShareItem> rows={rows} rowKey={(r) => r.id} onRowPress={(r) => setOpen(r.id)} empty={status === 'pending' ? 'Không có nội dung nào chờ duyệt' : 'Chưa có nội dung nào'}
          columns={[
            { key: 'title', label: 'Nội dung', flex: 3, render: (r) => <Cell main={r.title} sub={r.subject ?? undefined} /> },
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
