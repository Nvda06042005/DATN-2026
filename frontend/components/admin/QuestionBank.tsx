/**
 * Ngân hàng câu hỏi (HK.GV.030–039, HK.QT.041, HK.AD.045): xem theo kho (của tôi / của trường / hệ thống) và theo chủ đề, tìm kiếm và lọc,
 * tạo – sửa sáu dạng câu hỏi, lịch sử chỉnh sửa, xóa khi chưa dùng, nhập/xuất Excel, gắn dữ liệu lịch sử, sao chép về kho riêng, gửi duyệt.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { ArrowDown, ArrowUp, Copy, FileUp, History, Pencil, Plus, Send, Trash2 } from 'lucide-react-native';
import * as api from '@/api/learningApi';
import { AdminSelect } from '@/components/admin/AdminSelect';
import { MapPicker } from '@/components/admin/MapPicker';
import { DIFFICULTY_TEXT, LinksEditor, ScopeChip, useCampaignOptions } from '@/components/admin/ContentKit';
import { Cell, DataTable, DownloadButton, ErrorNote, FilterBar, FilterBox, ImportSheet, Page, PageHeader, Pager, StatusChip, useAction, useDebounced, useLoad, usePageSize } from '@/components/admin/kit';
import { dateText } from '@/components/admin/AccountSheet';
import type { Session } from '@/components/auth';
import { keyLines } from '@/components/portal/QuizPlayer';
import { Btn, Card, ConfirmSheet, Field, Inset, Segmented, Sheet, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { HistoryLink, QData, QMapTarget, QOption, QType, QuestionDetail, QuestionInput, QuestionItem, QuestionVersion } from '@/types/learning';
import { QTYPE_TEXT } from '@/types/learning';

const letter = (i: number) => String.fromCharCode(97 + i);

interface FormState {
  qtype: QType; prompt: string; image_url: string; explanation: string; difficulty: string; campaign_id: string;
  options: string[]; correct: string[]; tf: boolean; blanks: string[]; items: string[]; targets: Array<{ label: string; lat: string; lng: string; radius: string }>; links: HistoryLink[];
}

const blank = (): FormState => ({
  qtype: 'single', prompt: '', image_url: '', explanation: '', difficulty: '2', campaign_id: '', options: ['', '', ''], correct: ['a'], tf: true,
  blanks: [''], items: ['', '', ''], targets: [{ label: '', lat: '', lng: '', radius: '40' }], links: [],
});

const fromDetail = (d: QuestionDetail): FormState => {
  const s = blank();
  s.qtype = d.qtype; s.prompt = d.prompt; s.image_url = d.image_url ?? ''; s.explanation = d.explanation ?? ''; s.difficulty = String(d.difficulty);
  s.campaign_id = d.campaign_id ? String(d.campaign_id) : ''; s.links = d.links;
  const data = d.data;
  if (d.qtype === 'single' || d.qtype === 'multiple') {
    s.options = (data.options ?? []).map((o) => o.text);
    s.correct = d.qtype === 'single' ? [String(data.correct)] : ((data.correct as string[]) ?? []);
  }
  if (d.qtype === 'truefalse') s.tf = Boolean(data.correct);
  if (d.qtype === 'fill') s.blanks = (data.blanks ?? []).map((b) => b.accept.join(' | '));
  if (d.qtype === 'order') s.items = (data.items ?? []).map((i) => i.text);
  if (d.qtype === 'map') s.targets = (data.targets ?? []).map((t) => ({ label: t.label, lat: String(t.lat), lng: String(t.lng), radius: String(t.radius_km) }));
  return s;
};

const toInput = (s: FormState): QuestionInput => {
  let data: QData;
  if (s.qtype === 'single' || s.qtype === 'multiple') {
    const options: QOption[] = s.options.map((text, i) => ({ id: letter(i), text: text.trim() }));
    data = { options, correct: s.qtype === 'single' ? (s.correct[0] ?? '') : s.correct };
  } else if (s.qtype === 'truefalse') data = { correct: s.tf };
  else if (s.qtype === 'fill') data = { blanks: s.blanks.map((b) => ({ accept: b.split('|').map((x) => x.trim()).filter(Boolean) })) };
  else if (s.qtype === 'order') data = { items: s.items.map((text, i) => ({ id: letter(i), text: text.trim() })) };
  else data = { targets: s.targets.map((t, i): QMapTarget => ({ id: letter(i), label: t.label.trim(), lat: Number(t.lat), lng: Number(t.lng), radius_km: Number(t.radius) || 40 })) };
  return {
    qtype: s.qtype, prompt: s.prompt, image_url: s.image_url.trim() || null, explanation: s.explanation.trim() || null, difficulty: Number(s.difficulty),
    campaign_id: s.campaign_id ? Number(s.campaign_id) : null, data, links: s.links.map((l) => ({ ref_type: l.ref_type, ref_id: l.ref_id })),
  };
};

const Row: React.FC<{ children: React.ReactNode }> = ({ children }) => <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>{children}</View>;

// ---------------------------------------------------------------------- biểu mẫu tạo / sửa
const QuestionForm: React.FC<{ session: Session; initial?: QuestionDetail; onClose: () => void; onSaved: (q: QuestionDetail) => void }> = ({ session, initial, onClose, onSaved }) => {
  const { c } = useTheme();
  const [s, setS] = useState<FormState>(() => (initial ? fromDetail(initial) : blank()));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(0);
  const campaigns = useCampaignOptions(session);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setS((x) => ({ ...x, [key]: value }));
  const markers = (s.prompt.match(/_{3,}/g) ?? []).length;

  // Số đáp án điền khuyết luôn khớp số chỗ trống "____" trong đề
  useEffect(() => {
    if (s.qtype !== 'fill') return;
    setS((x) => (x.blanks.length === Math.max(1, markers) ? x : { ...x, blanks: Array.from({ length: Math.max(1, markers) }, (_, i) => x.blanks[i] ?? '') }));
  }, [markers, s.qtype]);

  const move = (list: string[], i: number, d: number) => { const next = [...list]; const j = i + d; if (j < 0 || j >= next.length) return next; [next[i], next[j]] = [next[j], next[i]]; return next; };
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = toInput(s);
      onSaved(initial ? await api.updateQuestion(session.token, initial.id, body) : await api.createQuestion(session.token, body));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa lưu được câu hỏi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title={initial ? 'Sửa câu hỏi' : 'Tạo câu hỏi'} subtitle={initial ? `Phiên bản hiện tại ${initial.version_no}; mỗi lần lưu thay đổi tạo một phiên bản mới` : undefined} wide
      footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}><Btn title="Hủy" tone="giay" onPress={onClose} disabled={busy} /><Btn title="Lưu câu hỏi" tone="son" onPress={submit} loading={busy} testID="question-save" /></View>}>
      <ErrorNote message={error} />
      <AdminSelect label="Dạng câu hỏi" value={s.qtype} options={Object.entries(QTYPE_TEXT).map(([value, label]) => ({ value: value as QType, label }))} onChange={(v) => set('qtype', v)} testID="question-type" />
      <Field label="Đề bài *" value={s.prompt} onChangeText={(v) => set('prompt', v)} multiline numberOfLines={3} inputStyle={{ minHeight: 80, textAlignVertical: 'top' }}
        hint={s.qtype === 'fill' ? 'Đánh dấu mỗi chỗ trống bằng ____ (bốn gạch dưới)' : undefined} nativeID="question-prompt" />

      {s.qtype === 'single' || s.qtype === 'multiple' ? (
        <View style={{ gap: 8 }}>
          <Txt f="bold" size={14} color={c.muc2}>Các lựa chọn ({s.qtype === 'single' ? 'chọn một đáp án đúng' : 'chọn từ 2 đáp án đúng, không chọn tất cả'})</Txt>
          {s.options.map((text, i) => {
            const id = letter(i), on = s.correct.includes(id);
            return (
              <Row key={i}>
                <View style={{ width: 72 }}><Btn title={on ? 'Đúng' : 'Sai'} tone={on ? 'ngoc' : 'giay'} size="sm" full label={`Đáp án ${i + 1}: ${on ? 'đúng' : 'sai'}`} onPress={() => set('correct', s.qtype === 'single' ? [id] : on ? s.correct.filter((x) => x !== id) : [...s.correct, id])} /></View>
                <View style={{ flex: 1 }}><Field label={`Lựa chọn ${i + 1}`} value={text} onChangeText={(v) => set('options', s.options.map((x, j) => (j === i ? v : x)))} /></View>
                <Btn icon={Trash2} label={`Xóa lựa chọn ${i + 1}`} tone="giay" size="sm" disabled={s.options.length <= 2} onPress={() => { set('options', s.options.filter((_, j) => j !== i)); set('correct', s.correct.filter((x) => x !== id).map((x) => (x > id ? letter(x.charCodeAt(0) - 98) : x))); }} />
              </Row>
            );
          })}
          <Btn icon={Plus} title="Thêm lựa chọn" tone="giay" size="sm" disabled={s.options.length >= (s.qtype === 'single' ? 6 : 8)} onPress={() => set('options', [...s.options, ''])} />
        </View>
      ) : null}

      {s.qtype === 'truefalse' ? <Segmented<string> label="Đáp án đúng" value={s.tf ? 'true' : 'false'} onChange={(v) => set('tf', v === 'true')} options={[{ value: 'true', label: 'Đúng' }, { value: 'false', label: 'Sai' }]} /> : null}

      {s.qtype === 'fill' ? (
        <View style={{ gap: 8 }}>
          <Txt size={13} color={c.muc3}>Đề đang có {markers} chỗ trống. Với mỗi chỗ trống, ghi các cách viết được chấp nhận, cách nhau dấu | (không phân biệt hoa thường; vẫn phân biệt dấu tiếng Việt).</Txt>
          {s.blanks.map((b, i) => <Field key={i} label={`Chỗ trống ${i + 1}`} value={b} onChangeText={(v) => set('blanks', s.blanks.map((x, j) => (j === i ? v : x)))} placeholder="vd: Bạch Đằng | Bạch Đằng giang" />)}
        </View>
      ) : null}

      {s.qtype === 'order' ? (
        <View style={{ gap: 8 }}>
          <Txt size={13} color={c.muc3}>Nhập các mục theo ĐÚNG thứ tự; học sinh sẽ thấy bản đã xáo trộn.</Txt>
          {s.items.map((text, i) => (
            <Row key={i}>
              <View style={{ flex: 1 }}><Field label={`Mục ${i + 1}`} value={text} onChangeText={(v) => set('items', s.items.map((x, j) => (j === i ? v : x)))} /></View>
              <Btn icon={ArrowUp} label="Đưa lên" tone="giay" size="sm" disabled={i === 0} onPress={() => set('items', move(s.items, i, -1))} />
              <Btn icon={ArrowDown} label="Đưa xuống" tone="giay" size="sm" disabled={i === s.items.length - 1} onPress={() => set('items', move(s.items, i, 1))} />
              <Btn icon={Trash2} label={`Xóa mục ${i + 1}`} tone="giay" size="sm" disabled={s.items.length <= 3} onPress={() => set('items', s.items.filter((_, j) => j !== i))} />
            </Row>
          ))}
          <Btn icon={Plus} title="Thêm mục" tone="giay" size="sm" disabled={s.items.length >= 8} onPress={() => set('items', [...s.items, ''])} />
        </View>
      ) : null}

      {s.qtype === 'map' ? (
        <View style={{ gap: 10 }}>
          <Txt size={13} color={c.muc3}>Học sinh kéo từng địa danh lên bản đồ; đúng khi nằm trong bán kính cho phép quanh vị trí chuẩn. Chọn một địa danh rồi bấm lên bản đồ để đặt vị trí chuẩn.</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {s.targets.map((t, i) => <Btn key={i} title={t.label || `Địa danh ${i + 1}`} tone={i === active ? 'son' : 'giay'} size="sm" onPress={() => setActive(i)} />)}
            <Btn icon={Plus} title="Thêm địa danh" tone="giay" size="sm" disabled={s.targets.length >= 5} onPress={() => { set('targets', [...s.targets, { label: '', lat: '', lng: '', radius: '40' }]); setActive(s.targets.length); }} />
          </View>
          {s.targets[active] ? (
            <Inset style={{ gap: 8 }}>
              <Field label="Tên địa danh" value={s.targets[active].label} onChangeText={(v) => set('targets', s.targets.map((x, j) => (j === active ? { ...x, label: v } : x)))} />
              <MapPicker lat={s.targets[active].lat ? Number(s.targets[active].lat) : null} lng={s.targets[active].lng ? Number(s.targets[active].lng) : null}
                onPick={(lat, lng) => set('targets', s.targets.map((x, j) => (j === active ? { ...x, lat: String(Math.round(lat * 1e4) / 1e4), lng: String(Math.round(lng * 1e4) / 1e4) } : x)))} />
              <Row>
                <View style={{ flex: 1 }}><Field label="Vĩ độ" value={s.targets[active].lat} onChangeText={(v) => set('targets', s.targets.map((x, j) => (j === active ? { ...x, lat: v } : x)))} keyboardType="numeric" /></View>
                <View style={{ flex: 1 }}><Field label="Kinh độ" value={s.targets[active].lng} onChangeText={(v) => set('targets', s.targets.map((x, j) => (j === active ? { ...x, lng: v } : x)))} keyboardType="numeric" /></View>
                <View style={{ flex: 1 }}><Field label="Bán kính cho phép (km)" value={s.targets[active].radius} onChangeText={(v) => set('targets', s.targets.map((x, j) => (j === active ? { ...x, radius: v } : x)))} keyboardType="numeric" /></View>
              </Row>
              <Btn icon={Trash2} title="Xóa địa danh này" tone="giay" size="sm" disabled={s.targets.length <= 1} onPress={() => { set('targets', s.targets.filter((_, j) => j !== active)); setActive(0); }} />
            </Inset>
          ) : null}
        </View>
      ) : null}

      <Field label="Giải thích (hiện sau khi trả lời)" value={s.explanation} onChangeText={(v) => set('explanation', v)} multiline numberOfLines={3} inputStyle={{ minHeight: 70, textAlignVertical: 'top' }} />
      <Field label="Hình minh họa (liên kết https)" value={s.image_url} onChangeText={(v) => set('image_url', v)} autoCapitalize="none" />
      <FilterBar>
        <FilterBox><AdminSelect label="Độ khó" value={s.difficulty} options={[{ value: '1', label: 'Dễ' }, { value: '2', label: 'Vừa' }, { value: '3', label: 'Khó' }]} onChange={(v) => set('difficulty', v)} /></FilterBox>
        <FilterBox flex={2}><AdminSelect label="Chủ đề (cuộc kháng chiến)" value={s.campaign_id} options={campaigns} onChange={(v) => set('campaign_id', v)} /></FilterBox>
      </FilterBar>
      <LinksEditor session={session} value={s.links} onChange={(v) => set('links', v)} />
    </Sheet>
  );
};

// ---------------------------------------------------------------------- chi tiết một câu hỏi
const QuestionDetailSheet: React.FC<{ session: Session; id: number; onClose: () => void; onChanged: () => void }> = ({ session, id, onClose, onChanged }) => {
  const { c } = useTheme();
  const role = session.user.role;
  const detail = useLoad(() => api.getQuestion(session.token, id), [session.token, id], session.expired);
  const { busy, run } = useAction(session.expired);
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [versions, setVersions] = useState<QuestionVersion[] | null>(null);
  const d = detail.data;
  const shareTarget = role === 'teacher' && d?.scope === 'teacher' ? 'school' : role === 'school_admin' && d?.scope === 'school' ? 'system' : null;
  const shared = d?.shares.find((x) => x.target === shareTarget);
  return (
    <Sheet open onClose={onClose} title="Câu hỏi" subtitle={d ? `${QTYPE_TEXT[d.qtype]} · phiên bản ${d.version_no}` : undefined} wide>
      <ErrorNote message={detail.error} />
      {detail.loading && !d ? <Spinner /> : null}
      {d ? (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <ScopeChip scope={d.scope} />
            <StatusChip kind="muted" text={DIFFICULTY_TEXT[d.difficulty]} />
            {d.owner_name ? <StatusChip kind="muted" text={`Soạn bởi ${d.owner_name}`} /> : null}
            {d.shares.map((x) => <StatusChip key={x.target} kind={x.status === 'approved' ? 'on' : x.status === 'pending' ? 'warn' : 'off'} text={`${x.target === 'school' ? 'Gửi trường' : 'Gửi hệ thống'}: ${x.status === 'approved' ? 'đã duyệt' : x.status === 'pending' ? 'chờ duyệt' : 'bị từ chối'}`} />)}
          </View>
          <Txt f="semibold" size={17}>{d.prompt}</Txt>
          <Card flat pad={12} style={{ gap: 4 }}><Txt f="bold" size={13} color={c.muc2}>Đáp án</Txt>{keyLines(d.qtype, d.data).map((l, i) => <Txt key={i} size={14}>{l}</Txt>)}</Card>
          {d.explanation ? <Txt size={14}><Txt f="bold" size={14}>Giải thích: </Txt>{d.explanation}</Txt> : null}
          {d.links.length ? <Txt size={13} color={c.muc2}>Gắn với: {d.links.map((l) => l.label ?? l.ref_id).join(', ')}</Txt> : null}
          <Txt size={13} color={c.muc3}>Đang dùng trong {d.used_in.length} bộ đề{d.used_in.length ? `: ${d.used_in.map((z) => z.title).join(', ')}` : ''}{d.answered ? ` · ${d.answered} lượt trả lời của học sinh` : ''}</Txt>
          {shared?.review_note ? <Inset style={{ backgroundColor: c.sonNhat }}><Txt size={13} color={c.sonChu}>Lý do từ chối: {shared.review_note}</Txt></Inset> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {d.can_edit ? <Btn icon={Pencil} title="Sửa" tone="son" size="sm" onPress={() => setEditing(true)} testID="question-edit" /> : null}
            {!d.can_edit && role === 'teacher' ? <Btn icon={Copy} title="Sao chép về kho của tôi" tone="giay" size="sm" loading={busy} onPress={async () => { if (await run(() => api.copyQuestion(session.token, d.id), 'Đã sao chép về kho của bạn')) { onChanged(); onClose(); } }} /> : null}
            {shareTarget ? <Btn icon={Send} title={shareTarget === 'school' ? 'Gửi vào kho của trường' : 'Đề xuất lên kho hệ thống'} tone="giay" size="sm" loading={busy} disabled={shared?.status === 'pending'}
              onPress={async () => { if (await run(() => api.requestShare(session.token, 'question', d.id, shareTarget), 'Đã gửi đi duyệt')) detail.reload(); }} /> : null}
            <Btn icon={History} title="Lịch sử chỉnh sửa" tone="giay" size="sm" onPress={async () => setVersions(await api.questionVersions(session.token, d.id).catch(() => []))} />
            {d.can_edit ? <Btn icon={Trash2} title="Xóa" tone="giay" size="sm" onPress={() => setRemoving(true)} /> : null}
          </View>
          {versions ? (
            <View style={{ gap: 6 }}>
              <Txt f="bold" size={14}>Lịch sử chỉnh sửa</Txt>
              {versions.map((v) => <Txt key={v.version_no} size={13} color={c.muc2}>Phiên bản {v.version_no} · {dateText(v.created_at)}{v.changed_by_name ? ` · ${v.changed_by_name}` : ''}</Txt>)}
            </View>
          ) : null}
        </View>
      ) : null}
      {editing && d ? <QuestionForm session={session} initial={d} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); detail.reload(); onChanged(); }} /> : null}
      <ConfirmSheet open={removing} title="Xóa câu hỏi?" message="Câu hỏi bị xóa vĩnh viễn. Hệ thống chỉ cho xóa câu hỏi chưa nằm trong bộ đề và chưa có học sinh trả lời." confirmLabel="Xóa" busy={busy}
        onCancel={() => setRemoving(false)} onConfirm={async () => { if (d) { const ok = await run(async () => { await api.deleteQuestion(session.token, d.id); return true; }, 'Đã xóa câu hỏi'); setRemoving(false); if (ok) { onChanged(); onClose(); } } }} />
    </Sheet>
  );
};

// ---------------------------------------------------------------------- danh sách
export const QuestionBank: React.FC<{ session: Session }> = ({ session }) => {
  const role = session.user.role;
  const [store, setStore] = useState(role === 'school_admin' ? 'school' : 'all');
  const [q, setQ] = useState('');
  const [qtype, setQtype] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [campaign, setCampaign] = useState('');
  const [page, setPage] = useState(1);
  const size = usePageSize();
  const [open, setOpen] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const term = useDebounced(q.trim(), 300);
  const campaigns = useCampaignOptions(session);
  const filters = useMemo(() => ({ store, q: term, qtype, difficulty, campaign_id: campaign }), [store, term, qtype, difficulty, campaign]);
  const list = useLoad(() => api.listQuestions(session.token, { ...filters, page, limit: size }), [session.token, filters, page, size], session.expired);
  const canWrite = role === 'teacher' || role === 'school_admin' || role === 'root_admin';
  const storeOptions = role === 'root_admin'
    ? [{ value: 'all', label: 'Kho hệ thống và đề xuất' }, { value: 'system', label: 'Kho hệ thống' }, { value: 'school', label: 'Kho của các trường' }]
    : [{ value: 'all', label: 'Tất cả kho' }, ...(role === 'teacher' ? [{ value: 'mine', label: 'Của tôi' }] : []), { value: 'school', label: 'Kho của trường' }, { value: 'system', label: 'Kho hệ thống' }];
  return (
    <Page>
      <PageHeader title="Ngân hàng câu hỏi" subtitle={role === 'root_admin' ? 'Kho câu hỏi của hệ thống dùng chung cho mọi trường.' : role === 'school_admin' ? 'Kho câu hỏi chung của trường và kho hệ thống. Duyệt câu giáo viên gửi ở mục Duyệt nội dung.' : 'Câu hỏi của bạn, kho của trường và kho hệ thống.'}
        actions={<>
          {canWrite ? <Btn icon={Plus} title="Tạo câu hỏi" tone="son" size="sm" onPress={() => setCreating(true)} testID="question-create" /> : null}
          {canWrite ? <Btn icon={FileUp} title="Nhập từ Excel" tone="giay" size="sm" onPress={() => setImporting(true)} /> : null}
          <DownloadButton title="Xuất Excel" fetchBlob={() => api.exportQuestions(session.token, filters)} filename="cau-hoi.xlsx" />
        </>} />
      <FilterBar>
        <FilterBox><AdminSelect label="Kho" value={store} options={storeOptions} onChange={(v) => { setStore(v); setPage(1); }} testID="question-store" /></FilterBox>
        <FilterBox><AdminSelect label="Dạng câu hỏi" value={qtype} options={[{ value: '', label: 'Mọi dạng' }, ...Object.entries(QTYPE_TEXT).map(([value, label]) => ({ value, label }))]} onChange={(v) => { setQtype(v); setPage(1); }} /></FilterBox>
        <FilterBox><AdminSelect label="Độ khó" value={difficulty} options={[{ value: '', label: 'Mọi độ khó' }, { value: '1', label: 'Dễ' }, { value: '2', label: 'Vừa' }, { value: '3', label: 'Khó' }]} onChange={(v) => { setDifficulty(v); setPage(1); }} /></FilterBox>
        <FilterBox><AdminSelect label="Chủ đề" value={campaign} options={[{ value: '', label: 'Mọi chủ đề' }, ...campaigns.slice(1)]} onChange={(v) => { setCampaign(v); setPage(1); }} /></FilterBox>
        <FilterBox flex={2}><Field label="Tìm kiếm (không cần dấu)" value={q} onChangeText={(v) => { setQ(v); setPage(1); }} placeholder="Nội dung câu hỏi, lựa chọn…" nativeID="question-search" /></FilterBox>
      </FilterBar>
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner /> : null}
      {list.data ? (
        <>
          <DataTable<QuestionItem> rows={list.data.items} rowKey={(r) => r.id} onRowPress={(r) => setOpen(r.id)} empty="Chưa có câu hỏi nào phù hợp"
            columns={[
              { key: 'prompt', label: 'Câu hỏi', flex: 4, render: (r) => <Cell main={r.prompt} sub={`${r.qtype_label}${r.campaign_title ? ` · ${r.campaign_title}` : ' · chưa gắn chủ đề'}`} /> },
              { key: 'scope', label: 'Kho', flex: 1.2, render: (r) => <ScopeChip scope={r.scope} /> },
              { key: 'diff', label: 'Độ khó', flex: 0.8, render: (r) => <Txt size={13}>{DIFFICULTY_TEXT[r.difficulty]}</Txt> },
              { key: 'used', label: 'Bộ đề', flex: 0.7, render: (r) => <Txt size={13}>{r.used_in}</Txt> },
              { key: 'owner', label: 'Người soạn', flex: 1.4, hideOnCard: true, render: (r) => <Cell main={r.owner_name ?? '—'} sub={dateText(r.updated_at)} /> },
            ]} />
          <Pager page={page} limit={size} total={list.data.total} onPage={setPage} />
        </>
      ) : null}
      {open !== null ? <QuestionDetailSheet session={session} id={open} onClose={() => setOpen(null)} onChanged={list.reload} /> : null}
      {creating ? <QuestionForm session={session} onClose={() => setCreating(false)} onSaved={(d) => { setCreating(false); list.reload(); setOpen(d.id); }} /> : null}
      {importing ? (
        <ImportSheet title="Nhập câu hỏi từ Excel" hint="Mỗi dòng là một câu hỏi: dạng Một đáp án, Nhiều đáp án, Đúng/sai, Điền khuyết hoặc Sắp xếp. Dạng kéo thả bản đồ tạo trên giao diện. Hệ thống báo lỗi từng dòng trước khi lưu."
          template={{ fetchBlob: () => api.questionTemplate(session.token), filename: 'mau-cau-hoi.xlsx' }}
          run={async (file, commit) => { const r = await api.importQuestions(session.token, file, commit); return { ...r, rows: r.rows.map((x) => ({ row: x.row, status: x.status === 'created' ? 'ok' as const : x.status, errors: x.errors, full_name: x.prompt.slice(0, 50) })) } as never; }}
          onClose={() => setImporting(false)} onDone={list.reload} />
      ) : null}
    </Page>
  );
};
