/**
 * TM.SA-CONTENT.001–005 (quản trị tổng): chương trình lịch sử, ngân hàng câu hỏi dùng chung, kho sử liệu AI, thẻ danh tướng, luật EXP.
 * Mọi thay đổi được máy chủ đánh phiên bản và ghi lịch sử; xem docs/ADMIN_CONTENT.md. Các bảng sửa ngay trong một Sheet (không mở Sheet lồng nhau).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import * as api from '@/api/adminApi';
import { errorMessage } from '@/api/client';
import type { Session } from '@/components/auth';
import { useFail } from '@/components/provisioning';
import { Btn, Card, Chip, ConfirmSheet, EmptyState, Field, Inset, Segmented, Sheet, Spinner, Txt, useToast } from '@/components/ui';
import { LORE_LABEL, TIER_INFO } from '@/constants/game';
import { useTheme } from '@/hooks/use-theme';
import { formatDateTime } from '@/lib/format';
import type {
  AiSourceDetail, AiSourceHit, AiSourceRow, AiSourcesPage, BadgeMetric, BankQuestionBody, BankQuestionDetail, BankQuestionRow, BankQuestionsPage, BankQuestionStatus, BankQuestionType,
  CardKind, CardRarity, ContentHistoryRow, CurriculumData, CurriculumNode, ExpRulesConfig, ExpRulesData, HeroCardRow, HeroCardsData, NodeKind, PublishState, SourceKind, SourceStatus,
} from '@/types/api';
import { AdminSelect } from './AdminSelect';
import { Pager } from './SchoolManagement';

type Part = 'curriculum' | 'questions' | 'sources' | 'cards' | 'rules';
const PARTS: Array<{ value: Part; label: string }> = [
  { value: 'curriculum', label: 'Chương trình lịch sử' }, { value: 'questions', label: 'Ngân hàng câu hỏi' }, { value: 'sources', label: 'Kho sử liệu AI' },
  { value: 'cards', label: 'Thẻ danh tướng' }, { value: 'rules', label: 'Luật EXP và huy hiệu' },
];
const STATUS_TEXT: Record<string, string> = {
  draft: 'Bản nháp', published: 'Đã xuất bản', archived: 'Đã lưu trữ', hidden: 'Đang ẩn', pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Bị từ chối',
};
const ACTION_TEXT: Record<string, string> = {
  seed: 'Dữ liệu gốc', create: 'Tạo mới', update: 'Cập nhật', edit: 'Chỉnh sửa', publish: 'Xuất bản', unpublish: 'Gỡ xuất bản', archive: 'Lưu trữ', hide: 'Ẩn', delete: 'Xóa',
  restore_original: 'Khôi phục bản gốc', upload: 'Tải lên', approve: 'Duyệt', reject: 'Từ chối', reopen: 'Mở lại', save: 'Lưu luật',
};
const KIND_ORDER: NodeKind[] = ['campaign', 'chapter', 'lesson', 'stage', 'battle'];
const TYPE_TEXT: Record<BankQuestionType, string> = { mcq: 'Trắc nghiệm', tf: 'Đúng/sai', order: 'Sắp xếp', match: 'Nối cặp', map: 'Chọn địa danh' };
const LEVEL_TEXT: Record<string, string> = { NHAN_BIET: 'Nhận biết', THONG_HIEU: 'Thông hiểu', VAN_DUNG: 'Vận dụng' };
const METRIC_TEXT: Record<BadgeMetric, string> = { xp: 'EXP tích lũy', streak: 'Chuỗi ngày học', lessons_completed: 'Lượt học hoàn thành', questions_correct: 'Câu trả lời đúng', perfect_runs: 'Lượt học hoàn hảo' };
const ALL = 'all';

const lines = (text: string) => text.split('\n').map((s) => s.trim()).filter(Boolean);
const useDebounced = <T,>(value: T, ms = 300): T => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
};
const intText = (text: string) => (text.replace(/\D/g, '') === '' ? 0 : Number(text.replace(/\D/g, '')));

function StatusChip({ status }: { status: string }) {
  const { c } = useTheme();
  const tone = ['published', 'approved'].includes(status) ? [c.ngocNhat, c.ngocChu] : ['hidden', 'rejected'].includes(status) ? [c.sonNhat, c.sonChu] : status === 'archived' ? [c.dichNhat, c.muc2] : [c.vangNhat, c.vangChu];
  return <Chip text={STATUS_TEXT[status] ?? status} bg={tone[0]} fg={tone[1]} />;
}
function ErrorNote({ text }: { text: string | null }) {
  const { c } = useTheme();
  return text ? <Inset style={{ backgroundColor: c.sonNhat }}><Txt color={c.sonChu} accessibilityRole="alert">{text}</Txt></Inset> : null;
}
const Row = ({ children, gap = 8 }: { children: React.ReactNode; gap?: number }) => <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap }}>{children}</View>;
const Multi = ({ label, value, onChangeText, hint, rows = 4 }: { label: string; value: string; onChangeText: (v: string) => void; hint?: string; rows?: number }) => (
  <Field label={label} value={value} onChangeText={onChangeText} hint={hint} multiline numberOfLines={rows} inputStyle={{ minHeight: rows * 24 + 24, textAlignVertical: 'top' }} />
);

/** Lịch sử cập nhật nằm ngay trong Sheet đang mở (không mở Sheet khác chồng lên) */
function HistoryToggle({ session, entity, id }: { session: Session; entity: string; id: string | number }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ContentHistoryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    api.getContentHistory(session.token, entity, id).then(setRows).catch((e) => setError(errorMessage(e, 'Không tải được lịch sử.')));
  }, [open, session.token, entity, id]);
  return (
    <View style={{ gap: 8 }}>
      <Btn title={open ? 'Ẩn lịch sử cập nhật' : 'Xem lịch sử cập nhật'} tone="giay" size="sm" onPress={() => setOpen((v) => !v)} />
      {open && (error ? <ErrorNote text={error} /> : !rows ? <Spinner label="Đang tải lịch sử…" /> : rows.map((h) => (
        <Txt key={h.id} size={13} color={c.muc2}>v{h.version} · {ACTION_TEXT[h.action] ?? h.action} · {h.actor_name} · {formatDateTime(h.created_at)}</Txt>
      )))}
    </View>
  );
}

export function ContentManagement({ session }: { session: Session }) {
  const { c } = useTheme();
  const [part, setPart] = useState<Part>('curriculum');
  return (
    <View testID="content-management" style={{ gap: 16 }}>
      <Segmented label="Nhóm nội dung" value={part} onChange={setPart} options={PARTS} />
      <Inset><Txt size={13} color={c.muc2}>Chỉ quản trị tổng thấy mục này. Mỗi lần lưu tạo một phiên bản mới và ghi lịch sử; nội dung đã phát hành không bị xóa vật lý.</Txt></Inset>
      {part === 'curriculum' && <CurriculumPanel session={session} />}
      {part === 'questions' && <QuestionsPanel session={session} />}
      {part === 'sources' && <SourcesPanel session={session} />}
      {part === 'cards' && <CardsPanel session={session} />}
      {part === 'rules' && <RulesPanel session={session} />}
    </View>
  );
}

// ====================================================================== 001 chương trình lịch sử
type NodeDialog = { mode: 'create'; parent: CurriculumNode | null } | { mode: 'edit'; node: CurriculumNode };

function CurriculumPanel({ session }: { session: Session }) {
  const { c } = useTheme();
  const fail = useFail(session);
  const toast = useToast();
  const [data, setData] = useState<CurriculumData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<NodeDialog | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const load = useCallback(() => api.getCurriculum(session.token).then((v) => { setData(v); setError(null); }).catch((e) => { setError(errorMessage(e, 'Không tải được chương trình.')); fail(e); }), [session.token, fail]);
  useEffect(() => { void load(); }, [load]);
  const kids = useMemo(() => {
    const map = new Map<number | null, CurriculumNode[]>();
    for (const n of data?.nodes ?? []) map.set(n.parent_id, [...(map.get(n.parent_id) ?? []), n]);
    return map;
  }, [data]);
  const setStatus = async (n: CurriculumNode, status: PublishState) => {
    setBusy(n.id);
    try {
      await api.updateNode(session.token, n.id, { status });
      toast(status === 'published' ? 'Đã xuất bản' : status === 'archived' ? 'Đã lưu trữ' : 'Đã gỡ xuất bản');
      await load();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };
  const render = (n: CurriculumNode, depth: number): React.ReactNode => (
    <View key={n.id} style={{ gap: 10 }}>
      <Card pad={14} style={{ gap: 8, marginLeft: depth * 18, borderLeftWidth: 3, borderLeftColor: n.status === 'published' ? c.ngocChu : n.status === 'archived' ? c.muc3 : c.vangChu }}>
        <Row><Chip text={data?.kinds.find((k) => k.id === n.kind)?.label ?? n.kind} bg={c.adminTint} fg={c.son} /><StatusChip status={n.status} /><Txt size={12} color={c.muc3}>{n.code} · v{n.version}</Txt></Row>
        <Txt f="bold" size={16}>{n.title}</Txt>
        {!!n.period && <Txt size={13} color={c.muc2}>{n.period}</Txt>}
        {!!n.summary && <Txt size={13} color={c.muc2} numberOfLines={3}>{n.summary}</Txt>}
        <Row>
          <Btn title="Sửa" tone="giay" size="sm" label={`Sửa ${n.title}`} onPress={() => setDialog({ mode: 'edit', node: n })} />
          {n.kind !== 'battle' && <Btn title="Thêm mục con" tone="giay" size="sm" label={`Thêm mục con cho ${n.title}`} onPress={() => setDialog({ mode: 'create', parent: n })} />}
          <Btn title={n.status === 'published' ? 'Gỡ xuất bản' : 'Xuất bản'} tone={n.status === 'published' ? 'giay' : 'son'} size="sm" loading={busy === n.id} label={`${n.status === 'published' ? 'Gỡ xuất bản' : 'Xuất bản'} ${n.title}`} onPress={() => setStatus(n, n.status === 'published' ? 'draft' : 'published')} />
          {n.status !== 'archived' && <Btn title="Lưu trữ" tone="giay" size="sm" loading={busy === n.id} label={`Lưu trữ ${n.title}`} onPress={() => setStatus(n, 'archived')} />}
        </Row>
      </Card>
      {(kids.get(n.id) ?? []).map((k) => render(k, depth + 1))}
    </View>
  );
  return (
    <View style={{ gap: 14 }}>
      <Card pad={18} style={{ gap: 10 }}>
        <Txt f="bold" size={19}>Cấu trúc chương trình</Txt>
        <Txt size={13} color={c.muc3}>Cuộc kháng chiến › Chương › Bài › Ải › Trận đánh. Dữ liệu gốc là 3 cuộc kháng chiến và 9 ải mà game đang dùng. Cấu trúc này là dữ liệu quản trị; màn chơi của học sinh vẫn đọc nội dung trong mã nguồn của game.</Txt>
        <Row><Btn title="Thêm cuộc kháng chiến" tone="son" onPress={() => setDialog({ mode: 'create', parent: null })} /></Row>
      </Card>
      <ErrorNote text={error} />
      {!data && !error ? <Spinner label="Đang tải chương trình…" /> : data && !data.nodes.length ? <EmptyState title="Chưa có nội dung" /> : (kids.get(null) ?? []).map((n) => render(n, 0))}
      {dialog && data && <NodeSheet key={dialog.mode === 'edit' ? dialog.node.id : `new-${dialog.parent?.id ?? 0}`} session={session} dialog={dialog} data={data} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); void load(); }} />}
    </View>
  );
}

function NodeSheet({ session, dialog, data, onClose, onSaved }: { session: Session; dialog: NodeDialog; data: CurriculumData; onClose: () => void; onSaved: () => void }) {
  const editing = dialog.mode === 'edit';
  const node = dialog.mode === 'edit' ? dialog.node : null;
  const parent = dialog.mode === 'create' ? dialog.parent : null;
  const kinds = data.kinds.filter((k) => (parent ? KIND_ORDER.indexOf(k.id) > KIND_ORDER.indexOf(parent.kind) : k.id === 'campaign'));
  const [kind, setKind] = useState<NodeKind>(kinds[0]?.id ?? 'campaign');
  const [code, setCode] = useState(''), [title, setTitle] = useState(node?.title ?? ''), [period, setPeriod] = useState(node?.period ?? '');
  const [summary, setSummary] = useState(node?.summary ?? ''), [order, setOrder] = useState(String(node?.sort_order ?? 0));
  const [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = { title, period: period || null, summary, sort_order: intText(order) };
      if (node) await api.updateNode(session.token, node.id, body);
      else await api.createNode(session.token, { ...body, kind, code: code.trim(), parent_id: parent?.id ?? null });
      onSaved();
    } catch (e) {
      setError(errorMessage(e, 'Không lưu được nội dung.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open onClose={busy ? () => undefined : onClose} title={editing ? 'Sửa nội dung chương trình' : parent ? `Thêm mục con cho “${parent.title}”` : 'Thêm cuộc kháng chiến'} subtitle={node ? `${node.code} · phiên bản ${node.version}` : undefined}
      footer={<Row gap={10}><Btn title="Hủy" tone="giay" onPress={onClose} disabled={busy} /><Btn title={editing ? 'Lưu phiên bản mới' : 'Tạo bản nháp'} tone="son" onPress={save} loading={busy} /></Row>}>
      <ErrorNote text={error} />
      {!editing && <>
        {kinds.length > 1 && <Segmented label="Loại nội dung" value={kind} onChange={setKind} options={kinds.map((k) => ({ value: k.id, label: k.label }))} />}
        <Field label="Mã nội dung *" value={code} onChangeText={setCode} autoCapitalize="characters" hint="Chữ, số, dấu chấm, gạch; duy nhất. Ví dụ KC1.C1" />
      </>}
      <Field label="Tiêu đề *" value={title} onChangeText={setTitle} />
      <Field label="Thời gian" value={period} onChangeText={setPeriod} placeholder="Ví dụ 17/1/1258" />
      <Multi label="Tóm tắt nội dung" value={summary} onChangeText={setSummary} hint="Đối chiếu sử liệu trước khi xuất bản." />
      <Field label="Thứ tự hiển thị" value={order} onChangeText={setOrder} keyboardType="number-pad" />
      {node && <HistoryToggle session={session} entity="curriculum" id={node.id} />}
    </Sheet>
  );
}

// ====================================================================== 002 ngân hàng câu hỏi
interface QForm { unit_id: string; type: BankQuestionType; level: string; prompt: string; explanation: string; source: string; hint: string; options: string; answer: string; tf: 'true' | 'false'; items: string; left: string; right: string }
const emptyForm = (unit: string): QForm => ({ unit_id: unit, type: 'mcq', level: 'THONG_HIEU', prompt: '', explanation: '', source: '', hint: '', options: '', answer: '0', tf: 'true', items: '', left: '', right: '' });
const toForm = (q: BankQuestionBody): QForm => ({
  unit_id: q.unit_id, type: q.type, level: q.level ?? 'THONG_HIEU', prompt: q.prompt, explanation: q.explanation, source: q.source ?? '', hint: q.hint ?? '',
  options: (q.options ?? []).join('\n'), answer: q.type === 'mcq' || q.type === 'map' ? String(q.type === 'map' ? (q.options ?? []).indexOf(String(q.answer)) : q.answer ?? 0) : '0',
  tf: q.answer === false ? 'false' : 'true', items: (q.items ?? []).join('\n'), left: (q.left ?? []).join('\n'), right: (q.right ?? []).join('\n'),
});
const toBody = (f: QForm): BankQuestionBody => {
  const body: BankQuestionBody = { unit_id: f.unit_id, type: f.type, level: f.level, prompt: f.prompt.trim(), explanation: f.explanation.trim(), source: f.source.trim() || null, hint: f.hint.trim() || null };
  if (f.type === 'mcq' || f.type === 'map') body.options = lines(f.options);
  if (f.type === 'mcq') body.answer = Number(f.answer);
  if (f.type === 'map') body.answer = lines(f.options)[Number(f.answer)] ?? '';
  if (f.type === 'tf') body.answer = f.tf === 'true';
  if (f.type === 'order') body.items = lines(f.items);
  if (f.type === 'match') [body.left, body.right] = [lines(f.left), lines(f.right)];
  return body;
};

function QuestionsPanel({ session }: { session: Session }) {
  const { c } = useTheme();
  const fail = useFail(session);
  const toast = useToast();
  const [q, setQ] = useState(''), [unit, setUnit] = useState(ALL), [type, setType] = useState(ALL), [status, setStatus] = useState(ALL);
  const query = useDebounced(q.trim());
  const [data, setData] = useState<BankQuestionsPage | null>(null), [busy, setBusy] = useState(true), [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const serial = useRef(0);
  const load = useCallback(async (page = 1) => {
    const key = ++serial.current;
    setBusy(true);
    try {
      const v = await api.getBankQuestions(session.token, { q: query || undefined, unit_id: unit === ALL ? undefined : unit, type: type === ALL ? undefined : type, status: status === ALL ? undefined : status, page, limit: 20 });
      if (key === serial.current) { setData(v); setError(null); }
    } catch (e) {
      if (key === serial.current) { setError(errorMessage(e, 'Không tải được ngân hàng câu hỏi.')); fail(e); }
    } finally {
      if (key === serial.current) setBusy(false);
    }
  }, [session.token, query, unit, type, status, fail]);
  useEffect(() => { void load(); }, [load]);
  const quick = async (row: BankQuestionRow, next: BankQuestionStatus) => {
    try {
      await api.setBankQuestionStatus(session.token, row.id, next);
      toast(next === 'hidden' ? 'Đã ẩn câu hỏi, học sinh không còn nhận được câu này' : 'Đã xuất bản câu hỏi');
      await load(data?.page ?? 1);
    } catch (e) {
      fail(e);
    }
  };
  const counts = data?.counts;
  return (
    <View style={{ gap: 14 }}>
      <Card pad={18} style={{ gap: 12 }}>
        <Row><Txt f="bold" size={19} style={{ flexShrink: 1 }}>Ngân hàng câu hỏi dùng chung</Txt><Btn title="Thêm câu hỏi" tone="son" size="sm" onPress={() => setEditing('new')} /></Row>
        <Txt size={13} color={c.muc3}>Gồm câu gốc của game và câu quản trị thêm. Ẩn hoặc xuất bản có hiệu lực ngay với học sinh; sửa câu gốc tạo bản nháp, học sinh vẫn thấy bản gốc cho tới khi bạn xuất bản.</Txt>
        {counts && <Row><Chip text={`${counts.all} câu`} bg={c.adminTint} fg={c.son} /><Chip text={`${counts.published} xuất bản`} bg={c.ngocNhat} fg={c.ngocChu} /><Chip text={`${counts.draft} nháp`} bg={c.vangNhat} fg={c.vangChu} /><Chip text={`${counts.hidden} đang ẩn`} bg={c.sonNhat} fg={c.sonChu} /><Chip text={`${counts.edited} câu gốc đã sửa`} bg={c.thuyNhat} fg={c.thuyChu} /><Chip text={`${counts.added} câu mới`} bg={c.thuyNhat} fg={c.thuyChu} /></Row>}
        <Row gap={12}>
          <Field label="Tìm câu hỏi" value={q} onChangeText={setQ} placeholder="Nội dung, mã câu hoặc chủ đề" style={{ flexGrow: 2, flexBasis: 220 }} />
          <View style={{ flexGrow: 1, flexBasis: 200 }}><AdminSelect label="Chủ đề" value={unit} onChange={setUnit} options={[{ value: ALL, label: 'Tất cả chủ đề' }, ...(data?.facets.units ?? []).map((u) => ({ value: u.unit_id, label: u.topic }))]} /></View>
          <View style={{ flexGrow: 1, flexBasis: 150 }}><AdminSelect label="Dạng câu" value={type} onChange={setType} options={[{ value: ALL, label: 'Tất cả dạng' }, ...(Object.keys(TYPE_TEXT) as BankQuestionType[]).map((t) => ({ value: t, label: TYPE_TEXT[t] }))]} /></View>
          <View style={{ flexGrow: 1, flexBasis: 150 }}><AdminSelect label="Trạng thái" value={status} onChange={setStatus} options={[{ value: ALL, label: 'Tất cả' }, { value: 'published', label: 'Đã xuất bản' }, { value: 'draft', label: 'Bản nháp' }, { value: 'hidden', label: 'Đang ẩn' }]} /></View>
        </Row>
      </Card>
      <ErrorNote text={error} />
      {!data && busy ? <Spinner label="Đang tải câu hỏi…" /> : !data?.items.length ? <EmptyState title="Không có câu hỏi phù hợp" text="Thay đổi bộ lọc hoặc thêm câu hỏi mới." /> : data.items.map((row) => (
        <Card key={row.id} pad={14} style={{ gap: 8 }}>
          <Row><Chip text={TYPE_TEXT[row.type]} bg={c.adminTint} fg={c.son} /><Chip text={LEVEL_TEXT[row.level] ?? row.level} bg={c.dichNhat} fg={c.muc2} /><StatusChip status={row.status} />
            {row.origin === 'admin' ? <Chip text="Câu mới" bg={c.thuyNhat} fg={c.thuyChu} /> : row.edited ? <Chip text={row.live && row.status === 'draft' ? 'Có bản nháp chỉnh sửa' : 'Đã chỉnh sửa'} bg={c.thuyNhat} fg={c.thuyChu} /> : null}</Row>
          <Txt size={15} numberOfLines={3}>{row.prompt}</Txt>
          <Txt size={12} color={c.muc3}>{row.topic} · {row.id} · v{row.version}{row.source ? ` · ${row.source}` : ''}</Txt>
          <Row>
            <Btn title="Xem / sửa" tone="giay" size="sm" label={`Xem và sửa câu ${row.id}`} onPress={() => setEditing(row.id)} />
            {row.status === 'published' || (row.live && row.status !== 'hidden') ? <Btn title="Ẩn" tone="giay" size="sm" label={`Ẩn câu ${row.id}`} onPress={() => quick(row, 'hidden')} /> : <Btn title="Xuất bản" tone="son" size="sm" label={`Xuất bản câu ${row.id}`} onPress={() => quick(row, 'published')} />}
          </Row>
        </Card>
      ))}
      {data && <Pager {...data} busy={busy} onPage={load} />}
      {editing && data && <QuestionSheet session={session} id={editing} units={data.facets.units} places={data.facets.places} onClose={() => setEditing(null)} onChanged={() => load(data.page)} />}
    </View>
  );
}

function QuestionSheet({ session, id, units, places, onClose, onChanged }: { session: Session; id: string | 'new'; units: Array<{ unit_id: string; topic: string }>; places: Record<string, string>; onClose: () => void; onChanged: () => void }) {
  const { c } = useTheme();
  const toast = useToast();
  const [detail, setDetail] = useState<BankQuestionDetail | null>(null);
  const [form, setForm] = useState<QForm | null>(id === 'new' ? emptyForm(units[0]?.unit_id ?? '') : null);
  const [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false), [confirm, setConfirm] = useState<'restore' | 'delete' | null>(null);
  const load = useCallback(() => api.getBankQuestion(session.token, id).then((d) => { setDetail(d); setForm(toForm(d.question)); }).catch((e) => setError(errorMessage(e, 'Không tải được câu hỏi.'))), [session.token, id]);
  useEffect(() => { if (id !== 'new') void load(); }, [id, load]);
  const set = <K extends keyof QForm>(key: K, value: QForm[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));
  const run = async (task: () => Promise<unknown>, done: string, close = false) => {
    setBusy(true);
    setError(null);
    try {
      await task();
      toast(done);
      onChanged();
      if (close) onClose();
      else if (id !== 'new') await load();
    } catch (e) {
      setError(errorMessage(e, 'Thao tác không thành công.'));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };
  const save = () => form && run(() => (id === 'new' ? api.createBankQuestion(session.token, toBody(form)) : api.updateBankQuestion(session.token, id, toBody(form))), id === 'new' ? 'Đã tạo câu hỏi ở dạng bản nháp' : 'Đã lưu phiên bản mới', id === 'new');
  const optionCount = form ? lines(form.options).length : 0;
  const answerOptions = form ? lines(form.options).map((text, i) => ({ value: String(i), label: `${i + 1}. ${text.slice(0, 50)}` })) : [];
  return (
    <Sheet open onClose={busy ? () => undefined : onClose} title={id === 'new' ? 'Thêm câu hỏi' : 'Xem và sửa câu hỏi'} subtitle={detail ? `${detail.id} · ${detail.origin === 'file' ? 'câu gốc của game' : 'câu quản trị thêm'} · phiên bản ${detail.version}` : undefined}
      footer={<Row gap={10}><Btn title="Đóng" tone="giay" onPress={onClose} disabled={busy} /><Btn title={id === 'new' ? 'Tạo bản nháp' : 'Lưu phiên bản mới'} tone="son" onPress={save} loading={busy} disabled={!form} /></Row>}>
      <ErrorNote text={error} />
      {!form ? (error ? null : <Spinner label="Đang tải câu hỏi…" />) : <>
        {detail && <Row><StatusChip status={detail.status} />{detail.original && detail.status === 'draft' && <Txt size={12} color={c.muc3}>Học sinh đang thấy bản gốc</Txt>}</Row>}
        <AdminSelect label="Chủ đề (cụm tri thức)" value={form.unit_id} onChange={(v) => set('unit_id', v)} options={units.map((u) => ({ value: u.unit_id, label: u.topic }))} />
        <Segmented label="Dạng câu hỏi" value={form.type} onChange={(v) => set('type', v)} options={(Object.keys(TYPE_TEXT) as BankQuestionType[]).map((t) => ({ value: t, label: TYPE_TEXT[t] }))} />
        <Segmented label="Mức độ" value={form.level} onChange={(v) => set('level', v)} options={Object.entries(LEVEL_TEXT).map(([value, label]) => ({ value, label }))} />
        <Multi label="Nội dung câu hỏi *" value={form.prompt} onChangeText={(v) => set('prompt', v)} rows={3} />
        {(form.type === 'mcq' || form.type === 'map') && <Multi label={form.type === 'mcq' ? 'Các lựa chọn (mỗi dòng một lựa chọn, 2–5 dòng) *' : 'Mã địa danh (mỗi dòng một mã, 2–5 dòng) *'} value={form.options} onChangeText={(v) => set('options', v)} hint={form.type === 'map' ? `Mã hợp lệ: ${Object.entries(places).map(([k, v]) => `${k} (${v})`).join(', ')}` : undefined} />}
        {(form.type === 'mcq' || form.type === 'map') && <AdminSelect label="Đáp án đúng" value={form.answer} onChange={(v) => set('answer', v)} options={optionCount ? answerOptions : [{ value: '0', label: 'Nhập các lựa chọn trước' }]} />}
        {form.type === 'tf' && <Segmented label="Đáp án đúng" value={form.tf} onChange={(v) => set('tf', v)} options={[{ value: 'true', label: 'Đúng' }, { value: 'false', label: 'Sai' }]} />}
        {form.type === 'order' && <Multi label="Các mục theo THỨ TỰ ĐÚNG (mỗi dòng một mục, 3–6 dòng) *" value={form.items} onChangeText={(v) => set('items', v)} hint="Học sinh nhận các mục đã xáo trộn." />}
        {form.type === 'match' && <><Multi label="Vế trái (mỗi dòng một vế, 3–5 dòng) *" value={form.left} onChangeText={(v) => set('left', v)} /><Multi label="Vế phải, cùng thứ tự với vế trái *" value={form.right} onChangeText={(v) => set('right', v)} hint="Dòng thứ n bên phải là đáp án của dòng thứ n bên trái." /></>}
        <Multi label="Giải thích đáp án *" value={form.explanation} onChangeText={(v) => set('explanation', v)} rows={3} />
        <Field label="Nguồn tham chiếu" value={form.source} onChangeText={(v) => set('source', v)} placeholder="Sách giáo khoa, Đại Việt sử ký toàn thư…" />
        <Field label="Gợi ý (không bắt buộc)" value={form.hint} onChangeText={(v) => set('hint', v)} />
        {detail && <Row>
          {detail.status !== 'published' && <Btn title="Xuất bản" tone="son" size="sm" disabled={busy} onPress={() => run(() => api.setBankQuestionStatus(session.token, id, 'published'), 'Đã xuất bản, học sinh nhận được câu này')} />}
          {detail.status === 'published' && <Btn title="Ẩn câu hỏi" tone="giay" size="sm" disabled={busy} onPress={() => run(() => api.setBankQuestionStatus(session.token, id, 'hidden'), 'Đã ẩn câu hỏi')} />}
          {detail.origin === 'file' && detail.status !== 'published' || (detail.origin === 'file' && detail.version > 1) ? <Btn title="Khôi phục bản gốc" tone="giay" size="sm" disabled={busy} onPress={() => setConfirm('restore')} /> : null}
          {detail.origin === 'admin' && detail.status !== 'published' && <Btn title="Xóa câu hỏi" tone="giay" size="sm" disabled={busy} onPress={() => setConfirm('delete')} />}
        </Row>}
        {detail && <HistoryToggle session={session} entity="question" id={detail.id} />}
      </>}
      <ConfirmSheet open={confirm !== null} title={confirm === 'restore' ? 'Khôi phục bản gốc?' : 'Xóa câu hỏi?'} message={confirm === 'restore' ? 'Bản chỉnh sửa bị bỏ, câu hỏi quay lại nội dung gốc của game. Lịch sử vẫn được giữ.' : 'Câu hỏi nháp hoặc đang ẩn sẽ bị xóa. Lịch sử cập nhật vẫn được giữ.'} confirmLabel={confirm === 'restore' ? 'Khôi phục' : 'Xóa'} busy={busy} onCancel={() => setConfirm(null)}
        onConfirm={() => run(() => api.removeBankQuestion(session.token, id), confirm === 'restore' ? 'Đã khôi phục bản gốc' : 'Đã xóa câu hỏi', true)} />
    </Sheet>
  );
}

// ====================================================================== 003 kho sử liệu AI
const SOURCE_KIND_TEXT: Record<SourceKind, string> = { chinh_su: 'Chính sử', giai_thoai: 'Giai thoại', tham_khao: 'Tham khảo' };
const pickTextFile = (): Promise<{ name: string; text: string } | null> => new Promise((resolve) => {
  if (Platform.OS !== 'web') { resolve(null); return; }
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.txt,.md,text/plain,text/markdown';
  input.onchange = async () => { const f = input.files?.[0]; resolve(f ? { name: f.name, text: await f.text() } : null); };
  input.click();
});

function SourcesPanel({ session }: { session: Session }) {
  const { c } = useTheme();
  const fail = useFail(session);
  const toast = useToast();
  const [status, setStatus] = useState<SourceStatus | typeof ALL>(ALL);
  const [data, setData] = useState<AiSourcesPage | null>(null), [busy, setBusy] = useState(true), [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', citation: '', kind: 'chinh_su' as SourceKind, unit_id: ALL, content: '', file_name: '' });
  const [formError, setFormError] = useState<string | null>(null), [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState<{ kind: 'view'; id: number } | { kind: 'review'; row: AiSourceRow; decision: 'reject' | 'archive' } | null>(null);
  const [term, setTerm] = useState(''), [hits, setHits] = useState<AiSourceHit[] | null>(null), [searching, setSearching] = useState(false);
  const load = useCallback(async (page = 1) => {
    setBusy(true);
    try { setData(await api.getAiSources(session.token, { status: status === ALL ? undefined : status, page, limit: 20 })); setError(null); } catch (e) { setError(errorMessage(e, 'Không tải được kho sử liệu.')); fail(e); } finally { setBusy(false); }
  }, [session.token, status, fail]);
  useEffect(() => { void load(); }, [load]);
  const submit = async () => {
    setSaving(true);
    setFormError(null);
    try {
      await api.createAiSource(session.token, { title: form.title.trim(), citation: form.citation.trim(), kind: form.kind, unit_id: form.unit_id === ALL ? null : form.unit_id, file_name: form.file_name || null, content: form.content });
      setForm({ title: '', citation: '', kind: form.kind, unit_id: ALL, content: '', file_name: '' });
      toast('Đã tải lên. Tư liệu chờ duyệt, chưa dùng cho trợ lý AI.');
      await load();
    } catch (e) { setFormError(errorMessage(e, 'Không tải lên được tư liệu.')); } finally { setSaving(false); }
  };
  const review = async (row: AiSourceRow, decision: 'approve' | 'reopen') => {
    try { await api.reviewAiSource(session.token, row.id, decision); toast(decision === 'approve' ? 'Đã duyệt, tư liệu vào phạm vi tìm kiếm' : 'Đã chuyển về chờ duyệt'); await load(data?.page ?? 1); } catch (e) { fail(e); }
  };
  const search = async () => {
    setSearching(true);
    try { setHits(await api.searchAiSources(session.token, term.trim())); } catch (e) { fail(e); } finally { setSearching(false); }
  };
  const counts = data?.counts;
  return (
    <View style={{ gap: 14 }}>
      <Card pad={18} style={{ gap: 12 }}>
        <Txt f="bold" size={19}>Tải lên tư liệu</Txt>
        <Txt size={13} color={c.muc3}>Tư liệu mới ở trạng thái “Chờ duyệt” và chỉ được đưa vào tìm kiếm sau khi duyệt. Cần ghi rõ nguồn trích dẫn; giai thoại phải được đánh dấu riêng với chính sử.</Txt>
        <ErrorNote text={formError} />
        <Field label="Tiêu đề *" value={form.title} onChangeText={(v) => setForm((f) => ({ ...f, title: v }))} />
        <Field label="Nguồn trích dẫn *" value={form.citation} onChangeText={(v) => setForm((f) => ({ ...f, citation: v }))} placeholder="Tên sách, tác giả, trang hoặc đường dẫn" />
        <Segmented label="Loại tư liệu" value={form.kind} onChange={(v) => setForm((f) => ({ ...f, kind: v }))} options={(Object.keys(SOURCE_KIND_TEXT) as SourceKind[]).map((k) => ({ value: k, label: SOURCE_KIND_TEXT[k] }))} />
        <AdminSelect label="Chủ đề liên quan" value={form.unit_id} onChange={(v) => setForm((f) => ({ ...f, unit_id: v }))} options={[{ value: ALL, label: 'Không gắn chủ đề' }, ...(data?.units ?? []).map((u) => ({ value: u.unit_id, label: u.topic }))]} />
        <Multi label="Nội dung văn bản *" value={form.content} onChangeText={(v) => setForm((f) => ({ ...f, content: v }))} rows={6} hint={`${form.content.length.toLocaleString('vi-VN')} / 200.000 ký tự`} />
        <Row>
          {Platform.OS === 'web' && <Btn title="Chọn tệp .txt hoặc .md" tone="giay" onPress={async () => { const file = await pickTextFile(); if (file) setForm((f) => ({ ...f, content: file.text, file_name: file.name, title: f.title || file.name.replace(/\.[^.]+$/, '') })); }} />}
          <Btn title="Tải lên và chờ duyệt" tone="son" onPress={submit} loading={saving} />
          {!!form.file_name && <Txt size={12} color={c.muc3}>Tệp: {form.file_name}</Txt>}
        </Row>
      </Card>
      <Card pad={18} style={{ gap: 10 }}>
        <Txt f="bold" size={17}>Thử tìm trong tư liệu đã duyệt</Txt>
        <Row gap={10}><Field label="Từ khóa" value={term} onChangeText={setTerm} placeholder="Ví dụ: cọc ngầm Bạch Đằng" style={{ flexGrow: 1, flexBasis: 220 }} /><Btn title="Tìm" tone="giay" onPress={search} loading={searching} disabled={term.trim().length < 2} /></Row>
        {hits && (!hits.length ? <Txt size={13} color={c.muc3}>Không có tư liệu đã duyệt nào khớp. Tư liệu chờ duyệt, bị từ chối hoặc lưu trữ không xuất hiện ở đây.</Txt> : hits.map((h) => (
          <Inset key={h.id} style={{ gap: 4 }}><Txt f="bold" size={14}>{h.title}</Txt><Txt size={13}>{h.excerpt}</Txt><Txt size={12} color={c.muc3}>Nguồn: {h.citation} · {SOURCE_KIND_TEXT[h.kind]}</Txt></Inset>
        )))}
      </Card>
      <Segmented label="Lọc theo trạng thái" value={status} onChange={setStatus} options={[{ value: ALL, label: 'Tất cả' }, { value: 'pending', label: `Chờ duyệt${counts ? ` (${counts.pending})` : ''}` }, { value: 'approved', label: `Đã duyệt${counts ? ` (${counts.approved})` : ''}` }, { value: 'rejected', label: `Từ chối${counts ? ` (${counts.rejected})` : ''}` }, { value: 'archived', label: `Lưu trữ${counts ? ` (${counts.archived})` : ''}` }]} />
      <ErrorNote text={error} />
      {!data && busy ? <Spinner label="Đang tải tư liệu…" /> : !data?.items.length ? <EmptyState title="Chưa có tư liệu" text="Tải lên tư liệu đầu tiên ở trên." /> : data.items.map((row) => (
        <Card key={row.id} pad={14} style={{ gap: 8 }}>
          <Row><StatusChip status={row.status} /><Chip text={SOURCE_KIND_TEXT[row.kind]} bg={row.kind === 'giai_thoai' ? c.hoaNhat : c.adminTint} fg={row.kind === 'giai_thoai' ? c.hoaChu : c.son} /><Txt size={12} color={c.muc3}>v{row.version} · {row.content_length.toLocaleString('vi-VN')} ký tự · {formatDateTime(row.created_at)}</Txt></Row>
          <Txt f="bold" size={16}>{row.title}</Txt>
          <Txt size={13} color={c.muc2}>Nguồn: {row.citation}</Txt>
          {!!row.review_note && <Txt size={13} color={c.muc3}>Ghi chú duyệt: {row.review_note}</Txt>}
          <Row>
            <Btn title="Xem nội dung" tone="giay" size="sm" label={`Xem nội dung ${row.title}`} onPress={() => setDialog({ kind: 'view', id: row.id })} />
            {row.status === 'pending' && <><Btn title="Duyệt" tone="son" size="sm" label={`Duyệt ${row.title}`} onPress={() => review(row, 'approve')} /><Btn title="Từ chối" tone="giay" size="sm" label={`Từ chối ${row.title}`} onPress={() => setDialog({ kind: 'review', row, decision: 'reject' })} /></>}
            {row.status === 'approved' && <Btn title="Lưu trữ" tone="giay" size="sm" label={`Lưu trữ ${row.title}`} onPress={() => setDialog({ kind: 'review', row, decision: 'archive' })} />}
            {(row.status === 'rejected' || row.status === 'archived') && <Btn title="Mở lại để duyệt" tone="giay" size="sm" label={`Mở lại ${row.title}`} onPress={() => review(row, 'reopen')} />}
          </Row>
        </Card>
      ))}
      {data && <Pager {...data} busy={busy} onPage={load} />}
      {dialog?.kind === 'view' && <SourceViewSheet session={session} id={dialog.id} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'review' && <SourceReviewSheet session={session} row={dialog.row} decision={dialog.decision} onClose={() => setDialog(null)} onDone={() => { setDialog(null); void load(data?.page ?? 1); }} />}
    </View>
  );
}

function SourceViewSheet({ session, id, onClose }: { session: Session; id: number; onClose: () => void }) {
  const { c } = useTheme();
  const [doc, setDoc] = useState<AiSourceDetail | null>(null), [error, setError] = useState<string | null>(null);
  useEffect(() => { api.getAiSource(session.token, id).then(setDoc).catch((e) => setError(errorMessage(e, 'Không tải được tư liệu.'))); }, [session.token, id]);
  return (
    <Sheet open onClose={onClose} title={doc?.title ?? 'Tư liệu'} subtitle={doc ? `${STATUS_TEXT[doc.status]} · phiên bản ${doc.version}` : undefined}>
      <ErrorNote text={error} />
      {!doc && !error ? <Spinner /> : doc && <>
        <Txt size={13} color={c.muc2}>Nguồn: {doc.citation}</Txt>
        <Txt size={14} selectable>{doc.content.length > 8000 ? `${doc.content.slice(0, 8000)}…\n\n(Hiển thị 8.000 ký tự đầu trên tổng ${doc.content.length.toLocaleString('vi-VN')} ký tự.)` : doc.content}</Txt>
        <HistoryToggle session={session} entity="ai_source" id={doc.id} />
      </>}
    </Sheet>
  );
}

function SourceReviewSheet({ session, row, decision, onClose, onDone }: { session: Session; row: AiSourceRow; decision: 'reject' | 'archive'; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const go = async () => {
    setBusy(true);
    try { await api.reviewAiSource(session.token, row.id, decision, note); onDone(); } catch (e) { setError(errorMessage(e, 'Không cập nhật được.')); } finally { setBusy(false); }
  };
  return (
    <Sheet open onClose={busy ? () => undefined : onClose} title={decision === 'reject' ? 'Từ chối tư liệu' : 'Lưu trữ tư liệu'} subtitle={row.title}
      footer={<Row gap={10}><Btn title="Hủy" tone="giay" onPress={onClose} disabled={busy} /><Btn title={decision === 'reject' ? 'Từ chối' : 'Lưu trữ'} tone="son" onPress={go} loading={busy} disabled={decision === 'reject' && note.trim().length < 3} /></Row>}>
      <ErrorNote text={error} />
      <Multi label={decision === 'reject' ? 'Lý do từ chối *' : 'Ghi chú (không bắt buộc)'} value={note} onChangeText={setNote} rows={3} />
    </Sheet>
  );
}

// ====================================================================== 004 thẻ danh tướng
const RARITIES: CardRarity[] = ['hiem', 'su_thi', 'huyen_thoai', 'tiet_che'];
const CARD_KINDS: CardKind[] = ['chinh_su', 'giai_thoai', 'sang_tao', 'dan_gian'];

function CardsPanel({ session }: { session: Session }) {
  const { c } = useTheme();
  const fail = useFail(session);
  const toast = useToast();
  const [kind, setKind] = useState<CardKind | typeof ALL>(ALL), [status, setStatus] = useState<PublishState | typeof ALL>(ALL), [q, setQ] = useState('');
  const query = useDebounced(q.trim());
  const [data, setData] = useState<HeroCardsData | null>(null), [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<HeroCardRow | 'new' | null>(null);
  const load = useCallback(() => api.getHeroCards(session.token, { kind: kind === ALL ? undefined : kind, status: status === ALL ? undefined : status, q: query || undefined }).then((v) => { setData(v); setError(null); }).catch((e) => { setError(errorMessage(e, 'Không tải được danh mục thẻ.')); fail(e); }), [session.token, kind, status, query, fail]);
  useEffect(() => { void load(); }, [load]);
  const setState = async (card: HeroCardRow, next: PublishState) => {
    try { await api.updateHeroCard(session.token, card.code, { status: next }); toast(next === 'published' ? 'Đã xuất bản thẻ' : next === 'archived' ? 'Đã lưu trữ thẻ' : 'Đã gỡ xuất bản'); await load(); } catch (e) { fail(e); }
  };
  return (
    <View style={{ gap: 14 }}>
      <Card pad={18} style={{ gap: 12 }}>
        <Row><Txt f="bold" size={19} style={{ flexShrink: 1 }}>Danh mục thẻ danh tướng</Txt><Btn title="Thêm thẻ" tone="son" size="sm" onPress={() => setEditing('new')} /></Row>
        <Txt size={13} color={c.muc3}>Quản lý thông tin, nguồn sử liệu, độ hiếm và điều kiện nhận. Chỉ số chiến đấu và hình ảnh của thẻ vẫn nằm trong mã nguồn của game; thẻ thêm mới ở đây chưa chơi được cho tới khi game được bổ sung dữ liệu tương ứng.</Txt>
        {data && <Row><Chip text={`${data.counts.all} thẻ`} bg={c.adminTint} fg={c.son} /><Chip text={`${data.counts.chinh_su} chính sử`} bg={c.ngocNhat} fg={c.ngocChu} /><Chip text={`${data.counts.giai_thoai} giai thoại`} bg={c.hoaNhat} fg={c.hoaChu} /><Chip text={`${data.counts.published} đã xuất bản`} bg={c.thuyNhat} fg={c.thuyChu} /></Row>}
        <Segmented label="Loại nội dung" value={kind} onChange={setKind} options={[{ value: ALL, label: 'Tất cả' }, ...CARD_KINDS.map((k) => ({ value: k, label: LORE_LABEL[k] }))]} />
        <Row gap={12}><Field label="Tìm thẻ" value={q} onChangeText={setQ} placeholder="Tên hoặc danh hiệu" style={{ flexGrow: 2, flexBasis: 220 }} /><View style={{ flexGrow: 1, flexBasis: 170 }}><AdminSelect label="Trạng thái" value={status} onChange={setStatus} options={[{ value: ALL, label: 'Tất cả' }, { value: 'published', label: 'Đã xuất bản' }, { value: 'draft', label: 'Bản nháp' }, { value: 'archived', label: 'Đã lưu trữ' }]} /></View></Row>
      </Card>
      <ErrorNote text={error} />
      {!data && !error ? <Spinner label="Đang tải thẻ…" /> : !data?.items.length ? <EmptyState title="Không có thẻ phù hợp" /> : data.items.map((card) => (
        <Card key={card.code} pad={14} style={{ gap: 8 }}>
          <Row><StatusChip status={card.status} /><Chip text={`${'★'.repeat(TIER_INFO[card.rarity].stars)} ${TIER_INFO[card.rarity].name}`} bg={c.vangNhat} fg={c.vangChu} /><Chip text={LORE_LABEL[card.kind]} bg={card.kind === 'chinh_su' ? c.ngocNhat : c.hoaNhat} fg={card.kind === 'chinh_su' ? c.ngocChu : c.hoaChu} /><Txt size={12} color={c.muc3}>{card.code} · v{card.version}</Txt></Row>
          <Txt f="bold" size={16}>{card.name}{card.title ? ` — ${card.title}` : ''}</Txt>
          {!!card.summary && <Txt size={13} color={c.muc2} numberOfLines={3}>{card.summary}</Txt>}
          <Txt size={13}>Điều kiện nhận: {card.unlock_condition}</Txt>
          <Txt size={12} color={c.muc3}>Nguồn: {card.source}</Txt>
          <Row>
            <Btn title="Sửa" tone="giay" size="sm" label={`Sửa thẻ ${card.name}`} onPress={() => setEditing(card)} />
            <Btn title={card.status === 'published' ? 'Gỡ xuất bản' : 'Xuất bản'} tone={card.status === 'published' ? 'giay' : 'son'} size="sm" label={`${card.status === 'published' ? 'Gỡ xuất bản' : 'Xuất bản'} thẻ ${card.name}`} onPress={() => setState(card, card.status === 'published' ? 'draft' : 'published')} />
            {card.status !== 'archived' && <Btn title="Lưu trữ" tone="giay" size="sm" label={`Lưu trữ thẻ ${card.name}`} onPress={() => setState(card, 'archived')} />}
          </Row>
        </Card>
      ))}
      {editing && <CardSheet session={session} card={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load(); }} />}
    </View>
  );
}

function CardSheet({ session, card, onClose, onSaved }: { session: Session; card: HeroCardRow | null; onClose: () => void; onSaved: () => void }) {
  const { c } = useTheme();
  const [f, setF] = useState({ code: card?.code ?? '', name: card?.name ?? '', title: card?.title ?? '', role: card?.role ?? '', rarity: card?.rarity ?? ('hiem' as CardRarity), kind: card?.kind ?? ('chinh_su' as CardKind), summary: card?.summary ?? '', source: card?.source ?? '', unlock_condition: card?.unlock_condition ?? '' });
  const [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(key: K, value: (typeof f)[K]) => setF((v) => ({ ...v, [key]: value }));
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = { name: f.name, title: f.title || null, role: f.role || null, rarity: f.rarity, kind: f.kind, summary: f.summary, source: f.source, unlock_condition: f.unlock_condition };
      if (card) await api.updateHeroCard(session.token, card.code, body);
      else await api.createHeroCard(session.token, { ...body, code: f.code.trim() });
      onSaved();
    } catch (e) { setError(errorMessage(e, 'Không lưu được thẻ.')); } finally { setBusy(false); }
  };
  return (
    <Sheet open onClose={busy ? () => undefined : onClose} title={card ? `Sửa thẻ ${card.name}` : 'Thêm thẻ danh tướng'} subtitle={card ? `${card.code} · phiên bản ${card.version}` : undefined}
      footer={<Row gap={10}><Btn title="Hủy" tone="giay" onPress={onClose} disabled={busy} /><Btn title={card ? 'Lưu phiên bản mới' : 'Tạo bản nháp'} tone="son" onPress={save} loading={busy} /></Row>}>
      <ErrorNote text={error} />
      {!card && <Field label="Mã thẻ *" value={f.code} onChangeText={(v) => set('code', v.toLowerCase())} autoCapitalize="none" hint="Chữ thường, số, gạch dưới. Ví dụ tran_khanh_du" />}
      <Field label="Tên *" value={f.name} onChangeText={(v) => set('name', v)} />
      <Field label="Danh hiệu" value={f.title} onChangeText={(v) => set('title', v)} />
      <Field label="Vai trò" value={f.role} onChangeText={(v) => set('role', v)} />
      <Segmented label="Độ hiếm" value={f.rarity} onChange={(v) => set('rarity', v)} options={RARITIES.map((r) => ({ value: r, label: `${'★'.repeat(TIER_INFO[r].stars)} ${TIER_INFO[r].name}` }))} />
      <Segmented label="Loại nội dung" value={f.kind} onChange={(v) => set('kind', v)} options={CARD_KINDS.map((k) => ({ value: k, label: LORE_LABEL[k] }))} />
      {f.kind !== 'chinh_su' && <Inset style={{ backgroundColor: c.hoaNhat }}><Txt size={13} color={c.hoaChu}>Nội dung này không phải chính sử: cần ghi rõ nguồn và không trình bày như sự kiện đã được sử sách xác nhận.</Txt></Inset>}
      <Multi label="Mô tả" value={f.summary} onChangeText={(v) => set('summary', v)} rows={4} />
      <Field label="Nguồn sử liệu *" value={f.source} onChangeText={(v) => set('source', v)} />
      <Field label="Điều kiện nhận *" value={f.unlock_condition} onChangeText={(v) => set('unlock_condition', v)} />
      {card && <HistoryToggle session={session} entity="hero_card" id={card.code} />}
    </Sheet>
  );
}

// ====================================================================== 005 luật EXP và huy hiệu
function RulesPanel({ session }: { session: Session }) {
  const { c } = useTheme();
  const fail = useFail(session);
  const toast = useToast();
  const [data, setData] = useState<ExpRulesData | null>(null), [error, setError] = useState<string | null>(null);
  const [cfg, setCfg] = useState<ExpRulesConfig | null>(null), [note, setNote] = useState(''), [saving, setSaving] = useState(false), [confirm, setConfirm] = useState(false);
  const load = useCallback(() => api.getExpRules(session.token).then((v) => { setData(v); setCfg(v.active.config); setError(null); }).catch((e) => { setError(errorMessage(e, 'Không tải được luật EXP.')); fail(e); }), [session.token, fail]);
  useEffect(() => { void load(); }, [load]);
  const dirty = Boolean(data && cfg && JSON.stringify(data.active.config) !== JSON.stringify(cfg));
  const num = (key: 'xp_correct' | 'xp_wrong' | 'gems_correct' | 'gems_weak' | 'daily_gem_cap', label: string, hint?: string) => cfg && <Field key={key} label={label} hint={hint} value={String(cfg[key])} keyboardType="number-pad" onChangeText={(t) => setCfg({ ...cfg, [key]: intText(t) })} style={{ flexGrow: 1, flexBasis: 180 }} />;
  const save = async () => {
    if (!cfg) return;
    setSaving(true);
    setError(null);
    try {
      const out = await api.saveExpRules(session.token, cfg, note.trim() || undefined);
      toast(`Đã lưu luật phiên bản ${out.version}. Áp dụng cho câu trả lời từ bây giờ.`);
      setNote('');
      await load();
    } catch (e) { setError(errorMessage(e, 'Không lưu được luật.')); } finally { setSaving(false); setConfirm(false); }
  };
  const levels = cfg?.levels ?? [];
  return (
    <View style={{ gap: 14 }}>
      <Card pad={18} style={{ gap: 10 }}>
        <Txt f="bold" size={19}>Luật EXP, cấp bậc và huy hiệu</Txt>
        <Txt size={13} color={c.muc3}>Đang dùng phiên bản {data?.active.version ?? '…'}{data?.active.since ? ` (từ ${formatDateTime(data.active.since)})` : ''}. Mỗi lần lưu là một phiên bản mới; điểm, cấp và huy hiệu đã ghi nhận không bị tính lại.</Txt>
        <Inset><Txt size={13} color={c.muc2}>Có hiệu lực ngay: EXP và Ấn Tín cho mỗi câu trả lời, trần Ấn Tín mỗi ngày, ngưỡng câu yếu. Mốc cấp bậc và huy hiệu được lưu và có phiên bản; màn chơi của học sinh hiện vẫn tính cấp theo công thức cũ và chưa trao huy hiệu theo cấu hình này.</Txt></Inset>
      </Card>
      <ErrorNote text={error} />
      {!cfg ? (error ? null : <Spinner label="Đang tải luật…" />) : <>
        <Card pad={18} style={{ gap: 12 }}>
          <Txt f="bold" size={17}>Thưởng khi trả lời</Txt>
          <Txt size={13} color={c.muc3}>EXP khi trả lời sai không được lớn hơn EXP khi trả lời đúng; trần Ấn Tín mỗi ngày phải đủ cho ít nhất một câu đúng.</Txt>
          <Row gap={12}>{num('xp_correct', 'EXP khi trả lời đúng')}{num('xp_wrong', 'EXP khi trả lời sai')}</Row>
          <Row gap={12}>{num('gems_correct', 'Ấn Tín khi đúng')}{num('gems_weak', 'Ấn Tín khi đúng ở chủ đề còn yếu')}{num('daily_gem_cap', 'Trần Ấn Tín mỗi ngày')}</Row>
          <Field label="Ngưỡng chủ đề còn yếu (%)" hint="Mức nắm vững dưới ngưỡng này được thưởng thêm" value={String(Math.round(cfg.weak_threshold * 100))} keyboardType="number-pad" onChangeText={(t) => setCfg({ ...cfg, weak_threshold: Math.min(100, intText(t)) / 100 })} />
        </Card>
        <Card pad={18} style={{ gap: 12 }}>
          <Txt f="bold" size={17}>Cấp bậc theo mốc EXP</Txt>
          {levels.map((l, i) => (
            <Row key={l.level} gap={10}>
              <Txt f="bold" size={14} style={{ width: 52 }}>Cấp {l.level}</Txt>
              <Field label={`Tên cấp ${l.level}`} value={l.name} onChangeText={(t) => setCfg({ ...cfg, levels: levels.map((x, j) => (j === i ? { ...x, name: t } : x)) })} style={{ flexGrow: 2, flexBasis: 160 }} />
              <Field label="Từ EXP" value={String(l.min_xp)} keyboardType="number-pad" editable={i > 0} onChangeText={(t) => setCfg({ ...cfg, levels: levels.map((x, j) => (j === i ? { ...x, min_xp: intText(t) } : x)) })} style={{ flexGrow: 1, flexBasis: 110 }} />
            </Row>
          ))}
          <Row><Btn title="Thêm cấp" tone="giay" size="sm" onPress={() => setCfg({ ...cfg, levels: [...levels, { level: levels.length + 1, name: `Cấp ${levels.length + 1}`, min_xp: (levels[levels.length - 1]?.min_xp ?? 0) + 500 }] })} /><Btn title="Bỏ cấp cuối" tone="giay" size="sm" disabled={levels.length <= 2} onPress={() => setCfg({ ...cfg, levels: levels.slice(0, -1) })} /></Row>
        </Card>
        <Card pad={18} style={{ gap: 12 }}>
          <Txt f="bold" size={17}>Huy hiệu và điều kiện cộng thưởng</Txt>
          {!cfg.badges.length && <Txt size={13} color={c.muc3}>Chưa có huy hiệu nào.</Txt>}
          {cfg.badges.map((b, i) => {
            const patch = (p: Partial<typeof b>) => setCfg({ ...cfg, badges: cfg.badges.map((x, j) => (j === i ? { ...x, ...p } : x)) });
            return (
              <Inset key={i} style={{ gap: 10 }}>
                <Row gap={10}><Field label="Mã huy hiệu" value={b.code} autoCapitalize="none" onChangeText={(t) => patch({ code: t.toLowerCase() })} style={{ flexGrow: 1, flexBasis: 150 }} /><Field label="Tên huy hiệu" value={b.name} onChangeText={(t) => patch({ name: t })} style={{ flexGrow: 2, flexBasis: 180 }} /></Row>
                <Row gap={10}>
                  <View style={{ flexGrow: 2, flexBasis: 200 }}><AdminSelect label="Điều kiện" value={b.metric} onChange={(v) => patch({ metric: v })} options={(data?.metrics ?? []).map((m) => ({ value: m, label: METRIC_TEXT[m] }))} /></View>
                  <Field label="Đạt tối thiểu" value={String(b.threshold)} keyboardType="number-pad" onChangeText={(t) => patch({ threshold: intText(t) })} style={{ flexGrow: 1, flexBasis: 110 }} />
                  <Field label="Thưởng EXP" value={String(b.reward_xp)} keyboardType="number-pad" onChangeText={(t) => patch({ reward_xp: intText(t) })} style={{ flexGrow: 1, flexBasis: 100 }} />
                  <Field label="Thưởng Ấn Tín" value={String(b.reward_gems)} keyboardType="number-pad" onChangeText={(t) => patch({ reward_gems: intText(t) })} style={{ flexGrow: 1, flexBasis: 100 }} />
                </Row>
                <Row><Btn title="Xóa huy hiệu" tone="giay" size="sm" label={`Xóa huy hiệu ${b.name || b.code}`} onPress={() => setCfg({ ...cfg, badges: cfg.badges.filter((_, j) => j !== i) })} /></Row>
              </Inset>
            );
          })}
          <Row><Btn title="Thêm huy hiệu" tone="giay" size="sm" onPress={() => setCfg({ ...cfg, badges: [...cfg.badges, { code: '', name: '', metric: 'xp', threshold: 100, reward_xp: 0, reward_gems: 0 }] })} /></Row>
        </Card>
        <Card pad={18} style={{ gap: 12 }}>
          <Field label="Ghi chú phiên bản" value={note} onChangeText={setNote} placeholder="Lý do thay đổi (không bắt buộc)" />
          <Row><Btn title="Lưu thành phiên bản mới" tone="son" disabled={!dirty} loading={saving} onPress={() => setConfirm(true)} />{dirty && <Btn title="Hoàn tác chỉnh sửa" tone="giay" onPress={() => setCfg(data!.active.config)} />}</Row>
        </Card>
        <Card pad={18} style={{ gap: 10 }}>
          <Txt f="bold" size={17}>Các phiên bản</Txt>
          {data?.versions.map((v) => (
            <Row key={v.version} gap={10}>
              <Chip text={`v${v.version}${v.is_active ? ' · đang dùng' : ''}`} bg={v.is_active ? c.ngocNhat : c.dichNhat} fg={v.is_active ? c.ngocChu : c.muc2} />
              <Txt size={13} color={c.muc2} style={{ flexShrink: 1 }}>{formatDateTime(v.created_at)}{v.created_by_name ? ` · ${v.created_by_name}` : ''}{v.note ? ` · ${v.note}` : ''}</Txt>
              {!v.is_active && <Btn title="Nạp vào biểu mẫu" tone="giay" size="sm" label={`Nạp phiên bản ${v.version} vào biểu mẫu`} onPress={async () => { try { setCfg((await api.getExpRuleVersion(session.token, v.version)).config); toast(`Đã nạp phiên bản ${v.version}. Bấm lưu để áp dụng như phiên bản mới.`); } catch (e) { fail(e); } }} />}
            </Row>
          ))}
        </Card>
      </>}
      <ConfirmSheet open={confirm} title="Lưu luật mới?" message="Luật mới áp dụng cho các câu trả lời từ thời điểm này. Điểm, cấp và huy hiệu học sinh đã có không bị thay đổi." confirmLabel="Lưu phiên bản mới" busy={saving} onCancel={() => setConfirm(false)} onConfirm={save} />
    </View>
  );
}
