/**
 * Quản trị mô phỏng trận đánh và mini-game (Sprint 6, HK.AD.046–047): danh sách và soạn kịch bản trận đánh dạng JSON (có mẫu, nút kiểm tra cấu trúc, chơi thử,
 * phát hành khi hồ sơ trận đánh đã công bố) và tham số các mini-game (ghép thẻ, sắp xếp dòng thời gian, ô chữ) bằng bảng nhập từng dòng.
 * Máy chủ kiểm tra mọi giới hạn và trả lỗi tiếng Việt chỉ rõ vị trí.
 */
import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import { Pencil, Play, Plus, Trash2 } from 'lucide-react-native';
import * as api from '@/api/battleApi';
import { errorMessage } from '@/api/client';
import { AdminSelect } from '@/components/admin/AdminSelect';
import { useCampaignOptions } from '@/components/admin/ContentKit';
import { Cell, DataTable, ErrorNote, FormSheet, Page, PageHeader, StatusChip, useAction, useLoad, type FieldDef } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { BattleScreen } from '@/components/portal/BattleKit';
import { Overlay } from '@/components/portal/LessonReader';
import { MiniScreen } from '@/components/portal/MiniGames';
import { Btn, ConfirmSheet, Field, Segmented, Spinner, Txt } from '@/components/ui';
import { FONT } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { AdminMinigame, AdminScenario, MiniKind } from '@/types/battle';
import { DIFFICULTY_LABEL, MINI_TEXT } from '@/types/battle';

type Values = Record<string, string | string[]>;
const when = (iso: string) => new Date(iso).toLocaleDateString('vi-VN');

// ---------------------------------------------------------------------- kịch bản (HK.AD.046)
const ContentEditor: React.FC<{ session: Session; values: Values; set: (name: string, value: string | string[]) => void }> = ({ session, values, set }) => {
  const { c } = useTheme();
  const { run } = useAction(session.expired);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const text = String(values.content ?? '');
  const check = async () => {
    try {
      const res = await api.validateScenario(session.token, JSON.parse(text));
      setMessage({ ok: true, text: `Kịch bản hợp lệ: ${res.steps} bước, tối đa ${res.max_score} điểm${res.has_animation ? ', có hoạt ảnh' : ', chưa có hoạt ảnh'}.` });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof SyntaxError ? `Chưa phải JSON hợp lệ: ${e.message}` : errorMessage(e) });
    }
  };
  const template = async () => {
    const t = await run(() => api.scenarioTemplate(session.token));
    if (t) { set('content', JSON.stringify(t, null, 2)); setMessage(null); }
  };
  return (
    <View style={{ gap: 8 }}>
      <Txt f="bold" size={14} color={c.muc2}>Nội dung kịch bản (JSON) *</Txt>
      <Txt size={13} color={c.muc3}>Gồm intro (tình hình, lực lượng, nhiệm vụ), map, steps (quyết định “decision” với các lựa chọn có điểm và phản hồi lịch sử; bố trí “placement” với khu vực chấp nhận), animation (các khung vị trí hai bên), pass_percent và bonus_points.</Txt>
      <TextInput value={text} onChangeText={(v) => { set('content', v); setMessage(null); }} multiline autoCapitalize="none" autoCorrect={false} spellCheck={false} accessibilityLabel="Nội dung kịch bản JSON" testID="scenario-content"
        style={{ minHeight: 320, maxHeight: 520, borderWidth: 1, borderColor: c.adminLine, borderRadius: 5, padding: 10, backgroundColor: c.the, color: c.muc, fontFamily: FONT.body, fontSize: 13, textAlignVertical: 'top' } as never} />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn title="Dùng kịch bản mẫu" tone="giay" size="sm" onPress={template} />
        <Btn title="Kiểm tra cấu trúc" tone="giay" size="sm" onPress={check} testID="scenario-validate" />
      </View>
      {message ? <Txt f="semibold" size={13} color={message.ok ? c.mocChu : c.sonChu} accessibilityRole={message.ok ? undefined : 'alert'}>{message.text}</Txt> : null}
    </View>
  );
};

const ScenarioPanel: React.FC<{ session: Session }> = ({ session }) => {
  const { token } = session;
  const { run, busy } = useAction(session.expired);
  const list = useLoad(() => api.adminScenarios(token), [token], session.expired);
  const options = useLoad(() => api.battleOptions(token), [token], session.expired);
  const [form, setForm] = useState<{ row?: AdminScenario; content?: string } | null>(null);
  const [remove, setRemove] = useState<AdminScenario | null>(null);
  const [preview, setPreview] = useState<AdminScenario | null>(null);
  const edit = async (row: AdminScenario) => {
    const full = await run(() => api.adminScenario(token, row.id));
    if (full) setForm({ row: full, content: JSON.stringify(full.content, null, 2) });
  };
  const toggle = async (row: AdminScenario) => {
    if (await run(() => api.setScenarioStatus(token, row.id, row.status === 'published' ? 'draft' : 'published'), row.status === 'published' ? 'Đã chuyển về Nháp' : 'Đã phát hành kịch bản')) list.reload();
  };
  const fields = (row?: AdminScenario): FieldDef[] => [
    ...(row ? [] : [{ name: 'battle_id', label: 'Trận đánh trong kho lịch sử', type: 'select' as const, required: true, options: [{ value: '', label: 'Chọn trận đánh…' }, ...(options.data ?? []).filter((o) => !o.scenario_id).map((o) => ({ value: String(o.id), label: `${o.name}${o.year ? ` (${o.year})` : ''}${o.status === 'published' ? '' : ' – hồ sơ còn Nháp'}` }))] }]),
    { name: 'title', label: 'Tên kịch bản', required: true },
    { name: 'difficulty', label: 'Độ khó', type: 'select', options: [1, 2, 3].map((d) => ({ value: String(d), label: DIFFICULTY_LABEL[d] })) },
    { name: 'summary', label: 'Tóm tắt hiện ở danh sách', type: 'textarea' },
    { name: 'content', label: 'Nội dung kịch bản', render: (values, set) => <ContentEditor session={session} values={values} set={set} /> },
  ];
  const save = async (v: Values) => {
    let content: unknown;
    try { content = JSON.parse(String(v.content ?? '')); } catch (e) { throw new Error(`Nội dung chưa phải JSON hợp lệ: ${(e as Error).message}`); }
    const body = { title: String(v.title).trim(), difficulty: Number(v.difficulty || 2), summary: String(v.summary ?? '').trim() || null, content };
    if (form?.row) await api.updateScenario(token, form.row.id, body); else await api.createScenario(token, { ...body, battle_id: Number(v.battle_id) });
    setForm(null);
    list.reload(); options.reload();
  };
  if (preview) return <Overlay title={`Chơi thử: ${preview.title}`} onBack={() => setPreview(null)}><BattleScreen session={session} scenarioId={preview.id} preview onClose={() => setPreview(null)} onOpenLink={() => undefined} /></Overlay>;
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Txt size={14} style={{ flex: 1, minWidth: 240 }}>Mỗi trận đánh trong kho lịch sử có một kịch bản. Chỉ phát hành được khi hồ sơ trận đánh đã công bố; kịch bản phát hành mới hiện cho học sinh.</Txt>
        <Btn icon={Plus} title="Thêm kịch bản" tone="son" onPress={() => setForm({ content: '' })} testID="scenario-add" />
      </View>
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner /> : null}
      <DataTable<AdminScenario> rows={list.data ?? []} rowKey={(r) => r.id} empty="Chưa có kịch bản nào"
        columns={[
          { key: 'title', label: 'Kịch bản', flex: 2, render: (r) => <Cell main={r.title} sub={`${r.battle_name}${r.campaign_title ? ` · ${r.campaign_title}` : ''}`} /> },
          { key: 'steps', label: 'Bước', render: (r) => <Txt size={13}>{r.steps ?? '—'}</Txt> },
          { key: 'plays', label: 'Lượt chơi', render: (r) => <Txt size={13}>{r.plays}</Txt> },
          { key: 'status', label: 'Trạng thái', render: (r) => <StatusChip kind={r.status === 'published' ? 'on' : 'muted'} text={r.status === 'published' ? 'Đã phát hành' : 'Nháp'} /> },
          { key: 'battle', label: 'Hồ sơ trận đánh', hideOnCard: true, render: (r) => <StatusChip kind={r.battle_status === 'published' ? 'on' : 'warn'} text={r.battle_status === 'published' ? 'Đã công bố' : 'Chưa công bố'} /> },
        ]}
        actions={(r) => (<>
          <Btn icon={Play} label={`Chơi thử ${r.title}`} tone="giay" size="sm" onPress={() => setPreview(r)} />
          <Btn icon={Pencil} label={`Sửa ${r.title}`} tone="giay" size="sm" disabled={busy} onPress={() => edit(r)} />
          <Btn title={r.status === 'published' ? 'Gỡ' : 'Phát hành'} tone="giay" size="sm" disabled={busy} onPress={() => toggle(r)} />
          <Btn icon={Trash2} label={`Xóa ${r.title}`} tone="giay" size="sm" onPress={() => setRemove(r)} />
        </>)} />
      {form ? (
        <FormSheet wide title={form.row ? 'Sửa kịch bản' : 'Thêm kịch bản'} subtitle={form.row?.battle_name} fields={fields(form.row)} onClose={() => setForm(null)} onSubmit={save}
          initial={form.row ? { title: form.row.title, difficulty: String(form.row.difficulty), summary: form.row.summary ?? '', content: form.content ?? '' } : { difficulty: '2', content: form.content ?? '' }} />
      ) : null}
      <ConfirmSheet open={Boolean(remove)} title={`Xóa kịch bản “${remove?.title ?? ''}”?`} message="Kịch bản đã có lượt chơi không xóa được; hãy gỡ về Nháp thay vì xóa." confirmLabel="Xóa" onCancel={() => setRemove(null)}
        onConfirm={async () => { if (!remove) return; if (await run(() => api.deleteScenario(token, remove.id).then(() => true), 'Đã xóa kịch bản')) { setRemove(null); list.reload(); options.reload(); } }} />
    </View>
  );
};

// ---------------------------------------------------------------------- mini-game (HK.AD.047)
interface RowColumn { key: string; label: string; flex?: number; numeric?: boolean; placeholder?: string }
const RowsEditor: React.FC<{ label: string; hint?: string; rows: Array<Record<string, string>>; columns: RowColumn[]; min: number; max: number; onChange: (rows: Array<Record<string, string>>) => void }> = ({ label, hint, rows, columns, min, max, onChange }) => {
  const { c } = useTheme();
  const update = (i: number, key: string, value: string) => onChange(rows.map((r, j) => (j === i ? { ...r, [key]: value } : r)));
  return (
    <View style={{ gap: 8 }}>
      <Txt f="bold" size={14} color={c.muc2}>{label}</Txt>
      {hint ? <Txt size={13} color={c.muc3}>{hint}</Txt> : null}
      {rows.map((row, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <Txt f="bold" size={13} color={c.muc3} style={{ width: 22, paddingBottom: 12 }}>{i + 1}.</Txt>
          {columns.map((col) => (
            <View key={col.key} style={{ flexGrow: col.flex ?? 1, flexBasis: col.numeric ? 120 : 180, minWidth: col.numeric ? 100 : 160 }}>
              <Field label={col.label} value={row[col.key] ?? ''} onChangeText={(v) => update(i, col.key, v)} placeholder={col.placeholder} keyboardType={col.numeric ? 'numeric' : 'default'} />
            </View>
          ))}
          <Btn icon={Trash2} label={`Xóa dòng ${i + 1}`} tone="giay" size="sm" disabled={rows.length <= min} onPress={() => onChange(rows.filter((_, j) => j !== i))} />
        </View>
      ))}
      <Btn icon={Plus} title="Thêm dòng" tone="giay" size="sm" disabled={rows.length >= max} onPress={() => onChange([...rows, Object.fromEntries(columns.map((col) => [col.key, '']))])} />
    </View>
  );
};

/** Trạng thái soạn tham số nằm trong một ô duy nhất `params` (chuỗi JSON: nhãn nhóm thẻ và các dòng) để biểu mẫu giữ và khôi phục được giá trị ban đầu */
interface Draft { left_label: string; right_label: string; rows: Array<Record<string, string>> }
const readDraft = (raw: string | string[] | undefined): Draft => { try { const v = JSON.parse(String(raw ?? '{}')); return { left_label: v.left_label ?? '', right_label: v.right_label ?? '', rows: Array.isArray(v.rows) ? v.rows : [] }; } catch { return { left_label: '', right_label: '', rows: [] }; } };

/** Tham số theo dạng mini-game, chuyển giữa dạng bảng nhập và JSON mà máy chủ lưu */
const toForm = (kind: MiniKind, params: any): string => {
  if (kind === 'match') return JSON.stringify({ left_label: params?.left_label ?? 'Nhân vật', right_label: params?.right_label ?? 'Sự kiện', rows: (params?.pairs ?? [{}, {}, {}]).map((p: any) => ({ left: p.left ?? '', right: p.right ?? '' })) });
  if (kind === 'timeline') return JSON.stringify({ rows: (params?.items ?? [{}, {}, {}]).map((i: any) => ({ text: i.text ?? '', when: i.when ?? '', key: i.key === undefined ? '' : String(i.key) })) });
  return JSON.stringify({ rows: (params?.words ?? [{}, {}, {}]).map((w: any) => ({ answer: w.answer ?? '', clue: w.clue ?? '' })) });
};
const toParams = (kind: MiniKind, v: Values): unknown => {
  const draft = readDraft(v.params);
  const rows = draft.rows.filter((r) => Object.values(r).some((x) => String(x).trim()));
  if (kind === 'match') return { left_label: draft.left_label.trim(), right_label: draft.right_label.trim(), pairs: rows.map((r, i) => ({ id: `p${i + 1}`, left: r.left, right: r.right })) };
  if (kind === 'timeline') return { items: rows.map((r, i) => ({ id: `e${i + 1}`, text: r.text, when: r.when, key: Number(r.key) })) };
  return { words: rows.map((r, i) => ({ id: `w${i + 1}`, answer: r.answer, clue: r.clue })) };
};

const ParamsEditor: React.FC<{ session: Session; kind: MiniKind; values: Values; set: (name: string, value: string | string[]) => void }> = ({ session, kind, values, set }) => {
  const { c } = useTheme();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const draft = readDraft(values.params);
  const rows = draft.rows;
  const put = (patch: Partial<Draft>) => set('params', JSON.stringify({ ...draft, ...patch }));
  const check = async () => {
    try {
      const res = await api.validateMinigame(session.token, kind, toParams(kind, values));
      setMessage({ ok: true, text: res.layout ? `Hợp lệ. Ô chữ xếp được trong lưới ${res.layout.rows} hàng × ${res.layout.cols} cột.` : 'Tham số hợp lệ.' });
    } catch (e) { setMessage({ ok: false, text: errorMessage(e) }); }
  };
  return (
    <View style={{ gap: 10 }}>
      {kind === 'match' ? (
        <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
          <View style={{ flex: 1, minWidth: 200 }}><Field label="Tên nhóm thẻ bên trái" value={draft.left_label} onChangeText={(v) => put({ left_label: v })} /></View>
          <View style={{ flex: 1, minWidth: 200 }}><Field label="Tên nhóm thẻ bên phải" value={draft.right_label} onChangeText={(v) => put({ right_label: v })} /></View>
        </View>
      ) : null}
      {kind === 'match' ? <RowsEditor label="Các cặp thẻ (3–10 cặp)" hint="Mỗi thẻ chỉ xuất hiện trong một cặp." rows={rows} min={3} max={10} columns={[{ key: 'left', label: 'Thẻ bên trái' }, { key: 'right', label: 'Thẻ bên phải' }]} onChange={(r) => put({ rows: r })} /> : null}
      {kind === 'timeline' ? <RowsEditor label="Các sự kiện (3–10 sự kiện)" hint="Mốc sắp xếp là số tăng dần theo thời gian, ví dụ 12580128 cho 28/1/1258 (năm, tháng, ngày); không trùng nhau." rows={rows} min={3} max={10}
        columns={[{ key: 'text', label: 'Sự kiện', flex: 2 }, { key: 'when', label: 'Thời gian hiển thị', placeholder: '28/1/1258' }, { key: 'key', label: 'Mốc sắp xếp', numeric: true, placeholder: '12580128' }]} onChange={(r) => put({ rows: r })} /> : null}
      {kind === 'crossword' ? <RowsEditor label="Các từ của ô chữ (3–8 từ)" hint="Đáp án 3–14 chữ cái, tự bỏ dấu và khoảng trắng; các từ cần có chữ cái chung để xếp giao nhau. Gợi ý nên lấy từ nội dung bài học." rows={rows} min={3} max={8}
        columns={[{ key: 'answer', label: 'Đáp án' }, { key: 'clue', label: 'Gợi ý', flex: 2 }]} onChange={(r) => put({ rows: r })} /> : null}
      <View style={{ flexDirection: 'row', gap: 8 }}><Btn title="Kiểm tra tham số" tone="giay" size="sm" onPress={check} testID="minigame-validate" /></View>
      {message ? <Txt f="semibold" size={13} color={message.ok ? c.mocChu : c.sonChu} accessibilityRole={message.ok ? undefined : 'alert'}>{message.text}</Txt> : null}
    </View>
  );
};

const MinigamePanel: React.FC<{ session: Session }> = ({ session }) => {
  const { token } = session;
  const { run, busy } = useAction(session.expired);
  const list = useLoad(() => api.adminMinigames(token), [token], session.expired);
  const campaigns = useCampaignOptions(session);
  const [kind, setKind] = useState<MiniKind | null>(null);
  const [form, setForm] = useState<{ kind: MiniKind; row?: AdminMinigame } | null>(null);
  const [remove, setRemove] = useState<AdminMinigame | null>(null);
  const [preview, setPreview] = useState<AdminMinigame | null>(null);
  const edit = async (row: AdminMinigame) => {
    const full = await run(() => api.adminMinigame(token, row.id));
    if (full) setForm({ kind: full.kind, row: full });
  };
  const toggle = async (row: AdminMinigame) => {
    if (await run(() => api.setMinigameStatus(token, row.id, row.status === 'published' ? 'draft' : 'published'), row.status === 'published' ? 'Đã chuyển về Nháp' : 'Đã phát hành mini-game')) list.reload();
  };
  const fields = (k: MiniKind): FieldDef[] => [
    { name: 'title', label: 'Tên mini-game', required: true },
    { name: 'description', label: 'Mô tả', type: 'textarea' },
    { name: 'campaign_id', label: 'Cuộc kháng chiến liên quan', type: 'select', options: campaigns },
    { name: 'seconds', label: 'Thời gian tối đa (giây)', type: 'number', required: true, hint: 'Từ 10 đến 1800 giây' },
    { name: 'points', label: 'Điểm tối đa', type: 'number', required: true, hint: 'Từ 0 đến 1000' },
    { name: 'params', label: 'Tham số', render: (values, set) => <ParamsEditor session={session} kind={k} values={values} set={set} /> },
  ];
  const save = async (v: Values) => {
    const body = { kind: form!.kind, title: String(v.title).trim(), description: String(v.description ?? '').trim() || null, campaign_id: v.campaign_id ? Number(v.campaign_id) : null, seconds: Number(v.seconds), points: Number(v.points), params: toParams(form!.kind, v) };
    if (form?.row) await api.updateMinigame(token, form.row.id, body); else await api.createMinigame(token, body);
    setForm(null);
    list.reload();
  };
  if (preview) return <Overlay title={`Chơi thử: ${preview.title}`} onBack={() => setPreview(null)}><MiniScreen session={session} id={preview.id} preview onClose={() => setPreview(null)} /></Overlay>;
  const rows = (list.data ?? []).filter((m) => !kind || m.kind === kind);
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Txt size={14} style={{ flex: 1, minWidth: 240 }}>Ba dạng mini-game: ghép thẻ trong thời gian giới hạn, sắp xếp dòng thời gian, ô chữ. Học sinh chỉ thấy mini-game đã phát hành.</Txt>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {(['match', 'timeline', 'crossword'] as MiniKind[]).map((k) => <Btn key={k} icon={Plus} title={`Thêm: ${MINI_TEXT[k]}`} tone="son" size="sm" onPress={() => setForm({ kind: k })} testID={`minigame-add-${k}`} />)}
        </View>
      </View>
      <AdminSelect label="Lọc theo dạng" value={kind ?? ''} options={[{ value: '', label: 'Tất cả' }, ...(['match', 'timeline', 'crossword'] as MiniKind[]).map((k) => ({ value: k as string, label: MINI_TEXT[k] }))]} onChange={(v) => setKind((v || null) as MiniKind | null)} />
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner /> : null}
      <DataTable<AdminMinigame> rows={rows} rowKey={(r) => r.id} empty="Chưa có mini-game nào"
        columns={[
          { key: 'title', label: 'Mini-game', flex: 2, render: (r) => <Cell main={r.title} sub={`${MINI_TEXT[r.kind]}${r.campaign_title ? ` · ${r.campaign_title}` : ''}`} /> },
          { key: 'seconds', label: 'Thời gian', render: (r) => <Txt size={13}>{r.seconds} giây</Txt> },
          { key: 'points', label: 'Điểm', render: (r) => <Txt size={13}>{r.points}</Txt> },
          { key: 'plays', label: 'Lượt chơi', render: (r) => <Txt size={13}>{r.plays ?? 0}</Txt> },
          { key: 'status', label: 'Trạng thái', render: (r) => <StatusChip kind={r.status === 'published' ? 'on' : 'muted'} text={r.status === 'published' ? 'Đã phát hành' : 'Nháp'} /> },
          { key: 'updated', label: 'Cập nhật', hideOnCard: true, render: (r) => <Txt size={13}>{when(r.updated_at)}</Txt> },
        ]}
        actions={(r) => (<>
          <Btn icon={Play} label={`Chơi thử ${r.title}`} tone="giay" size="sm" onPress={() => setPreview(r)} />
          <Btn icon={Pencil} label={`Sửa ${r.title}`} tone="giay" size="sm" disabled={busy} onPress={() => edit(r)} />
          <Btn title={r.status === 'published' ? 'Gỡ' : 'Phát hành'} tone="giay" size="sm" disabled={busy} onPress={() => toggle(r)} />
          <Btn icon={Trash2} label={`Xóa ${r.title}`} tone="giay" size="sm" onPress={() => setRemove(r)} />
        </>)} />
      {form ? (
        <FormSheet wide title={`${form.row ? 'Sửa' : 'Thêm'} mini-game: ${MINI_TEXT[form.kind]}`} fields={fields(form.kind)} onClose={() => setForm(null)} onSubmit={save}
          initial={{ title: form.row?.title ?? '', description: form.row?.description ?? '', campaign_id: form.row?.campaign_id ? String(form.row.campaign_id) : '', seconds: String(form.row?.seconds ?? (form.kind === 'crossword' ? 300 : 120)), points: String(form.row?.points ?? 100), params: toForm(form.kind, form.row?.params) }} />
      ) : null}
      <ConfirmSheet open={Boolean(remove)} title={`Xóa mini-game “${remove?.title ?? ''}”?`} message="Mini-game đã có lượt chơi không xóa được; hãy gỡ về Nháp thay vì xóa." confirmLabel="Xóa" onCancel={() => setRemove(null)}
        onConfirm={async () => { if (!remove) return; if (await run(() => api.deleteMinigame(token, remove.id).then(() => true), 'Đã xóa mini-game')) { setRemove(null); list.reload(); } }} />
    </View>
  );
};

export const BattleAdmin: React.FC<{ session: Session }> = ({ session }) => {
  const [view, setView] = useState<'scenarios' | 'minigames'>('scenarios');
  return (
    <Page>
      <PageHeader title="Mô phỏng trận đánh và mini-game" subtitle="Kịch bản trận đánh theo lượt (JSON) và các mini-game lịch sử. Nội dung khởi tạo ở trạng thái Nháp, chờ giáo viên Lịch sử duyệt." />
      <Segmented<'scenarios' | 'minigames'> label="Mục quản trị" value={view} onChange={setView} options={[{ value: 'scenarios', label: 'Kịch bản trận đánh' }, { value: 'minigames', label: 'Mini-game' }]} />
      {view === 'scenarios' ? <ScenarioPanel session={session} /> : <MinigamePanel session={session} />}
    </Page>
  );
};
