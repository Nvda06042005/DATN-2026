/**
 * Quản trị trò chơi hóa (Sprint 5): danh mục dùng chung do quản trị tổng quản lý (cấp độ, lớp nhân vật và kỹ năng, huy hiệu, thẻ, cửa hàng, nhiệm vụ mẫu – HK.AD.048–054),
 * cấu hình mặc định (HK.AD.066), cấu hình bảng xếp hạng trường (HK.QT.044), sự kiện – giải đấu cấp trường (HK.QT.045), huy hiệu riêng của trường (HK.QT.046),
 * cơ chế tim theo lớp và trao huy hiệu của trường cho học sinh (giáo viên, quản trị viên trường).
 * Giao diện chỉ mô tả và gửi giá trị; máy chủ kiểm tra mọi giới hạn.
 */
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Award, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import * as api from '@/api/gameApi';
import * as admin from '@/api/adminApi';
import * as learning from '@/api/learningApi';
import { AdminSelect } from '@/components/admin/AdminSelect';
import { Cell, DataTable, ErrorNote, FormSheet, Page, PageHeader, StatusChip, fromVn, toVn, useAction, useLoad, type FieldDef } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { Btn, Card, ConfirmSheet, Field, Segmented, Sheet, Spinner, Txt, useToast } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { CatalogField, CatalogSpec, SchoolContest } from '@/types/gamification';

type Row = Record<string, any>;
const dateTime = (iso: string) => new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });

const InfoSheet: React.FC<{ title: string; lines: string[]; onClose: () => void }> = ({ title, lines, onClose }) => (
  <Sheet open onClose={onClose} title={title} footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}><Btn title="Đóng" tone="giay" onPress={onClose} /></View>}>
    {lines.map((line, i) => <Txt key={i} size={14}>{line}</Txt>)}
  </Sheet>
);

// ---------------------------------------------------------------------- danh mục tổng quát
const fieldDef = (f: CatalogField, editing: boolean, refs: { figure: Array<{ value: string; label: string }>; campaign: Array<{ value: string; label: string }> }): FieldDef => {
  const base = { name: f.name, label: f.label, required: f.required, hint: f.hint, readOnly: editing && f.createOnly };
  switch (f.type) {
    case 'textarea': return { ...base, type: 'textarea' };
    case 'int': return { ...base, type: 'number', hint: f.hint ?? (f.min !== undefined ? `Từ ${f.min} đến ${f.max}` : undefined) };
    case 'bool': return { ...base, type: 'select', options: [{ value: '1', label: 'Có' }, { value: '0', label: 'Không' }] };
    case 'enum': return { ...base, type: 'select', options: f.options ?? [] };
    case 'color': return { ...base, type: 'text', placeholder: '#b91c1c' };
    case 'url': return { ...base, type: 'text', placeholder: 'https://…' };
    case 'ref': return { ...base, type: 'select', options: [{ value: '', label: 'Không gắn' }, ...(f.ref === 'figure' ? refs.figure : refs.campaign)] };
    default: return { ...base, type: 'text' };
  }
};

const toBody = (spec: CatalogSpec, values: Record<string, string | string[]>): Record<string, unknown> => {
  const body: Record<string, unknown> = {};
  for (const f of spec.fields) {
    if (!(f.name in values)) continue;
    const raw = String(values[f.name] ?? '').trim();
    if (f.type === 'int') { if (raw !== '') body[f.name] = Number(raw); } else if (f.type === 'bool') body[f.name] = raw !== '0';
    else if (f.type === 'ref') body[f.name] = raw ? Number(raw) : null;
    else body[f.name] = raw;
  }
  return body;
};

const cellText = (f: CatalogField | undefined, value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—';
  if (f?.type === 'bool') return value ? 'Có' : 'Không';
  if (f?.type === 'enum') return f.options?.find((o) => o.value === String(value))?.label ?? String(value);
  return String(value);
};

/** Quản lý một hoặc nhiều danh mục: bảng, thêm, sửa, xóa (máy chủ chặn xóa mục đang được dùng và gợi ý tắt "Đang dùng") */
export const GameCatalog: React.FC<{ session: Session; entities?: string[]; hideFields?: string[]; intro?: string }> = ({ session, entities, hideFields = [], intro }) => {
  const { token } = session;
  const specs =useLoad(() => api.adminSpecs(token), [token], session.expired);
  const all = (specs.data?.entities ?? []).filter((s) => !entities || entities.includes(s.entity));
  const [entity, setEntity] = useState<string>(entities?.[0] ?? 'levels');
  const spec = all.find((s) => s.entity === entity) ?? all[0];
  const list = useLoad(() => (spec ? api.adminList(token, spec.entity) : Promise.resolve([] as Row[])), [token, spec?.entity], session.expired);
  const needFigures = spec?.fields.some((f) => f.ref === 'figure'), needCampaigns = spec?.fields.some((f) => f.ref === 'campaign');
  const figures = useLoad(async () => (needFigures ? (await learning.historyOptions(token, 'figure')).map((o) => ({ value: String(o.id), label: o.label })) : []), [token, needFigures], session.expired);
  const campaigns = useLoad(async () => (needCampaigns ? (await learning.historyOptions(token, 'campaign')).map((o) => ({ value: String(o.id), label: o.label })) : []), [token, needCampaigns], session.expired);
  const [form, setForm] = useState<{ row?: Row } | null>(null);
  const [remove, setRemove] = useState<Row | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  if (specs.loading && !specs.data) return <Spinner />;
  if (!spec) return <ErrorNote message={specs.error ?? 'Không có danh mục phù hợp.'} />;
  const fields = spec.fields.filter((f) => !hideFields.includes(f.name));
  const refs = { figure: figures.data ?? [], campaign: campaigns.data ?? [] };
  const byName = Object.fromEntries(spec.fields.map((f) => [f.name, f]));
  const active = byName.is_active ? true : false;
  const initial = (row?: Row): Record<string, string> => Object.fromEntries(fields.map((f) => {
    const v = row ? row[f.name] : f.type === 'bool' ? true : undefined;
    return [f.name, f.type === 'bool' ? (v === false ? '0' : '1') : v === null || v === undefined ? '' : String(v)];
  }));
  const save = async (values: Record<string, string | string[]>) => {
    const body = toBody({ ...spec, fields }, values);
    if (form?.row) await api.adminUpdate(token, spec.entity, form.row[spec.pk], body);
    else await api.adminCreate(token, spec.entity, body);
    setForm(null);
    list.reload();
  };
  return (
    <View style={{ gap: 14 }}>
      {intro ? <Txt size={14}>{intro}</Txt> : null}
      {all.length > 1 ? <Segmented<string> label="Danh mục" value={spec.entity} onChange={setEntity} options={all.map((s) => ({ value: s.entity, label: s.label }))} /> : null}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Txt f="bold" size={16}>{spec.plural}</Txt>
        <Btn icon={Plus} title={`Thêm ${spec.label.toLowerCase()}`} tone="son" onPress={() => setForm({})} testID="game-catalog-add" />
      </View>
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner /> : null}
      <DataTable<Row> rows={list.data ?? []} rowKey={(r) => r[spec.pk]} empty={`Chưa có ${spec.label.toLowerCase()} nào`}
        columns={[
          ...spec.summary.map((key, i) => ({ key, label: byName[key]?.label ?? key, flex: i === 0 ? 2 : 1, render: (r: Row) => (i === 0 ? <Cell main={cellText(byName[key], r[key])} sub={spec.entity === 'badges' ? (r.scope === 'school' ? 'Huy hiệu của trường' : 'Huy hiệu hệ thống') : undefined} /> : <Txt size={13}>{cellText(byName[key], r[key])}</Txt>) })),
          ...(active ? [{ key: 'is_active', label: 'Trạng thái', render: (r: Row) => <StatusChip kind={r.is_active ? 'on' : 'muted'} text={r.is_active ? 'Đang dùng' : 'Đã tắt'} /> }] : []),
        ]}
        actions={(r) => (<><Btn icon={Pencil} label={`Sửa ${r[spec.summary[0]]}`} tone="giay" size="sm" onPress={() => setForm({ row: r })} /><Btn icon={Trash2} label={`Xóa ${r[spec.summary[0]]}`} tone="giay" size="sm" onPress={() => { setRemoveError(null); setRemove(r); }} /></>)} />
      {form ? <FormSheet title={form.row ? `Sửa ${spec.label.toLowerCase()}` : `Thêm ${spec.label.toLowerCase()}`} wide fields={fields.map((f) => fieldDef(f, Boolean(form.row), refs))} initial={initial(form.row)} onSubmit={save} onClose={() => setForm(null)} /> : null}
      <ConfirmSheet open={Boolean(remove)} title={`Xóa “${remove?.[spec.summary[0]] ?? ''}”?`} message={removeError ?? 'Mục chưa được dùng mới xóa được. Nếu đã có học sinh dùng, hãy chọn “Đang dùng: Không” để ẩn.'} confirmLabel="Xóa" onCancel={() => setRemove(null)}
        onConfirm={async () => { if (!remove) return; try { await api.adminDelete(token, spec.entity, remove[spec.pk]); setRemove(null); list.reload(); } catch (e) { setRemoveError(errorMessage(e)); } }} />
    </View>
  );
};

// ---------------------------------------------------------------------- cấu hình mặc định (quản trị tổng)
const GROUPS: Array<[string, string]> = [['hearts', 'Cơ chế tim'], ['daily_goal', 'Mục tiêu ngày'], ['gold', 'Vàng thưởng'], ['binh_thu', 'Binh thư (nâng cấp thẻ tướng)'], ['streak', 'Chuỗi ngày'], ['cards', 'Thẻ nhân vật'], ['war', 'Game trận đánh bằng thẻ tướng'], ['gift', 'Quà hằng ngày'], ['league', 'Giải đấu tuần'], ['', 'Khác']];
const getPath = (obj: Row, path: string): unknown => path.split('.').reduce<any>((cur, k) => (cur === undefined || cur === null ? undefined : cur[k]), obj);
const setPath = (obj: Row, path: string, value: unknown) => { const keys = path.split('.'); let cur = obj; for (const k of keys.slice(0, -1)) cur = cur[k] ??= {}; cur[keys[keys.length - 1]] = value; };

export const GameSettings: React.FC<{ session: Session }> = ({ session }) => {
  const { c } = useTheme();
  const { run, busy } = useAction(session.expired);
  const settings = useLoad(() => api.adminSettings(session.token), [session.token], session.expired);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [gift, setGift] = useState<string | null>(null);
  const view = settings.data;
  const rules = useMemo(() => Object.entries(view?.rules ?? {}), [view]);
  if (!view) return settings.error ? <ErrorNote message={settings.error} /> : <Spinner />;
  const current = (path: string): string => {
    if (path in draft) return draft[path];
    const v = getPath(view.values, path);
    return typeof v === 'boolean' ? (v ? '1' : '0') : v === undefined ? '' : String(v);
  };
  const giftText = gift ?? (view.values.gift?.gold ?? []).join(', ');
  const save = async () => {
    const patch: Row = {};
    for (const [path, text] of Object.entries(draft)) {
      const rule = view.rules[path];
      setPath(patch, path, rule?.bool ? text === '1' : Number(text));
    }
    if (gift !== null) setPath(patch, 'gift.gold', gift.split(/[,\s]+/).filter(Boolean).map(Number));
    if (!Object.keys(patch).length) return;
    const res = await run(() => api.updateAdminSettings(session.token, patch), 'Đã lưu cấu hình trò chơi hóa');
    if (res) { setDraft({}); setGift(null); settings.reload(); }
  };
  const reset = () => { const d: Record<string, string> = {}; for (const [path, rule] of rules) { const v = getPath(view.defaults, path); d[path] = rule.bool ? (v ? '1' : '0') : String(v ?? ''); } setDraft(d); setGift((view.defaults.gift?.gold ?? []).join(', ')); };
  return (
    <View style={{ gap: 14 }}>
      <Txt size={14}>Các giá trị mặc định này áp dụng cho toàn hệ thống. Thay đổi có hiệu lực ngay với lượt học tiếp theo; điểm và vàng đã ghi không bị tính lại.</Txt>
      {GROUPS.map(([prefix, title]) => {
        const list = rules.filter(([path]) => (prefix ? path.startsWith(`${prefix}.`) : !GROUPS.some(([p]) => p && path.startsWith(`${p}.`))));
        if (!list.length && prefix !== 'gift') return null;
        return (
          <Card key={title} flat pad={14} style={{ gap: 10 }}>
            <Txt f="bold" size={16}>{title}</Txt>
            {list.map(([path, rule]) => rule.bool
              ? <AdminSelect key={path} label={rule.label} value={current(path)} options={[{ value: '1', label: 'Bật' }, { value: '0', label: 'Tắt' }]} onChange={(v) => setDraft((d) => ({ ...d, [path]: v }))} />
              : <Field key={path} label={rule.label} value={current(path)} onChangeText={(v) => setDraft((d) => ({ ...d, [path]: v }))} keyboardType="numeric"
                hint={rule.oneOf ? `Chỉ nhận ${rule.oneOf.join(', ')}` : rule.min !== undefined ? `Từ ${rule.min} đến ${rule.max}${rule.int ? ' (số nguyên)' : ''}` : undefined} />)}
            {prefix === 'gift' ? <Field label="Vàng của 7 ngày liên tiếp (cách nhau bằng dấu phẩy)" value={giftText} onChangeText={setGift} hint="Đúng 7 số, mỗi số từ 0 đến 1000" /> : null}
          </Card>
        );
      })}
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        <Btn title="Lưu cấu hình" tone="son" loading={busy} disabled={!Object.keys(draft).length && gift === null} onPress={save} testID="game-settings-save" />
        <Btn title="Đặt về mặc định ban đầu" tone="giay" onPress={reset} />
      </View>
      <Txt size={12} color={c.muc3}>“Đặt về mặc định” chỉ điền lại các ô; bấm “Lưu cấu hình” để áp dụng.</Txt>
    </View>
  );
};

export const RootGame: React.FC<{ session: Session }> = ({ session }) => {
  const [view, setView] = useState<'settings' | 'catalog'>('settings');
  return (
    <Page>
      <PageHeader title="Trò chơi hóa" subtitle="Cấu hình mặc định và các danh mục dùng chung: cấp độ, lớp nhân vật, huy hiệu, thẻ, cửa hàng, nhiệm vụ mẫu." />
      <Segmented<'settings' | 'catalog'> label="Mục quản trị" value={view} onChange={setView} options={[{ value: 'settings', label: 'Cấu hình mặc định' }, { value: 'catalog', label: 'Danh mục' }]} />
      {view === 'settings' ? <GameSettings session={session} /> : <GameCatalog session={session} entities={['levels', 'classes', 'badges', 'cards', 'items', 'quests']} />}
    </Page>
  );
};

// ---------------------------------------------------------------------- lớp học: tim và huy hiệu của trường
const AwardForm: React.FC<{ session: Session; classId: number; className: string; onClose: () => void }> = ({ session, classId, className, onClose }) => {
  const toast = useToast();
  const students = useLoad(() => api.classStudents(session.token, classId), [session.token, classId], session.expired);
  const badges = useLoad(() => api.schoolBadges(session.token), [session.token], session.expired);
  if (!students.data || !badges.data) return students.error || badges.error ? <ErrorNote message={students.error ?? badges.error} /> : <Spinner />;
  if (!badges.data.length) return <InfoSheet title="Chưa có huy hiệu của trường" lines={['Quản trị viên trường cần tạo huy hiệu ở mục Trò chơi hóa trước khi giáo viên trao cho học sinh.']} onClose={onClose} />;
  return (
    <FormSheet title="Trao huy hiệu" subtitle={className} submitLabel="Trao huy hiệu"
      fields={[
        { name: 'badge', label: 'Huy hiệu', type: 'select', required: true, options: badges.data.map((b) => ({ value: String(b.id), label: b.name })) },
        { name: 'students', label: 'Học sinh nhận huy hiệu', type: 'multi', required: true, options: students.data.map((s) => ({ value: String(s.id), label: `${s.full_name}${s.user_code ? ` (${s.user_code})` : ''}` })) },
      ]}
      initial={{ badge: String(badges.data[0].id) }}
      onSubmit={async (v) => { const res = await api.awardBadge(session.token, Number(v.badge), (v.students as string[]).map(Number)); toast(`Đã trao ${res.awarded} học sinh${res.already ? `, ${res.already} bạn đã có` : ''}`); onClose(); }}
      onClose={onClose} />
  );
};

export const ClassGamePanel: React.FC<{ session: Session }> = ({ session }) => {
  const { run } = useAction(session.expired);
  const classes = useLoad(() => api.classGameSettings(session.token), [session.token], session.expired);
  const [award, setAward] = useState<{ id: number; name: string } | null>(null);
  const toggle = async (id: number, enabled: boolean) => { if (await run(() => api.setClassHearts(session.token, id, enabled), enabled ? 'Đã bật cơ chế tim' : 'Đã tắt cơ chế tim cho lớp')) classes.reload(); };
  return (
    <View style={{ gap: 12 }}>
      <Txt size={14}>Tắt cơ chế tim cho lớp để học sinh làm bài không bị giới hạn lượt. Huy hiệu của trường do giáo viên hoặc nhà trường trao tay cho học sinh.</Txt>
      <ErrorNote message={classes.error} />
      {classes.loading && !classes.data ? <Spinner /> : null}
      <DataTable<NonNullable<typeof classes.data>[number]> rows={classes.data ?? []} rowKey={(r) => r.id} empty="Chưa có lớp nào"
        columns={[
          { key: 'name', label: 'Lớp', flex: 2, render: (r) => <Cell main={r.name} sub={`${r.school_year}${r.grade ? ` · khối ${r.grade}` : ''}`} /> },
          { key: 'students', label: 'Học sinh', render: (r) => <Txt size={13}>{r.students}</Txt> },
          { key: 'hearts', label: 'Cơ chế tim', render: (r) => <StatusChip kind={r.hearts_enabled ? 'on' : 'muted'} text={r.hearts_enabled ? 'Đang bật' : 'Đã tắt'} /> },
        ]}
        actions={(r) => (<><Btn title={r.hearts_enabled ? 'Tắt tim' : 'Bật tim'} tone="giay" size="sm" onPress={() => toggle(r.id, !r.hearts_enabled)} /><Btn icon={Award} label={`Trao huy hiệu cho lớp ${r.name}`} title="Huy hiệu" tone="giay" size="sm" onPress={() => setAward({ id: r.id, name: r.name })} /></>)} />
      {award ? <AwardForm session={session} classId={award.id} className={award.name} onClose={() => setAward(null)} /> : null}
    </View>
  );
};

export const TeacherGame: React.FC<{ session: Session }> = ({ session }) => (
  <Page>
    <PageHeader title="Trò chơi hóa trong lớp" subtitle="Cơ chế tim theo lớp và trao huy hiệu của trường." />
    <ClassGamePanel session={session} />
  </Page>
);

// ---------------------------------------------------------------------- cấp trường
const REWARD_FIELDS: Array<[string, string]> = [['first', 'Thưởng hạng nhất (vàng)'], ['second', 'Thưởng hạng nhì (vàng)'], ['third', 'Thưởng hạng ba (vàng)'], ['participation', 'Thưởng tham gia (vàng)']];

const ContestSection: React.FC<{ session: Session }> = ({ session }) => {
  const { run } = useAction(session.expired);
  const contests = useLoad(() => api.adminContests(session.token), [session.token], session.expired);
  const classes = useLoad(() => admin.listClasses(session.token, { limit: 200 }), [session.token], session.expired);
  const badges = useLoad(() => api.schoolBadges(session.token), [session.token], session.expired);
  const [form, setForm] = useState<{ row?: SchoolContest } | null>(null);
  const [remove, setRemove] = useState<SchoolContest | null>(null);
  const [board, setBoard] = useState<{ title: string; entries: Array<{ rank: number; name: string; xp: number }> } | null>(null);
  const statusText = { upcoming: 'Sắp diễn ra', active: 'Đang diễn ra', ended: 'Đã kết thúc' } as const;
  const open = async (row: SchoolContest) => { const res = await run(() => api.contestBoard(session.token, row.id)); if (res) setBoard({ title: row.title, entries: res.entries }); };
  const submit = async (v: Record<string, string | string[]>) => {
    const starts = fromVn(String(v.starts_at)), ends = fromVn(String(v.ends_at));
    if (!starts || !ends) throw new Error('Nhập thời gian theo dạng 2026-11-10 07:00 (giờ Việt Nam).');
    const rewards = Object.fromEntries(REWARD_FIELDS.map(([k]) => [k, Number(v[`reward_${k}`] || 0)]));
    const body = { title: String(v.title).trim(), description: String(v.description ?? '').trim() || null, starts_at: starts, ends_at: ends, class_ids: (v.class_ids as string[]).map(Number), rewards, badge_id: v.badge_id ? Number(v.badge_id) : null };
    if (form?.row) await api.updateContest(session.token, form.row.id, body); else await api.createContest(session.token, body);
    setForm(null);
    contests.reload();
  };
  const initial = (row?: SchoolContest): Record<string, string | string[]> => ({
    title: row?.title ?? '', description: row?.description ?? '', starts_at: row ? toVn(row.starts_at) : '', ends_at: row ? toVn(row.ends_at) : '', class_ids: (row?.classes ?? []).map((c) => String(c.id)),
    badge_id: row?.badge_id ? String(row.badge_id) : '', ...Object.fromEntries(REWARD_FIELDS.map(([k]) => [`reward_${k}`, String(row?.rewards?.[k] ?? 0)])),
  });
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Txt size={14} style={{ flex: 1, minWidth: 240 }}>Sự kiện tính điểm học tập trong khoảng thời gian cho các lớp tham gia; khi kết thúc, vàng thưởng được trao một lần cho hạng nhất, nhì, ba và các bạn tham gia.</Txt>
        <Btn icon={Plus} title="Tạo sự kiện" tone="son" onPress={() => setForm({})} testID="contest-add" />
      </View>
      <ErrorNote message={contests.error} />
      {contests.loading && !contests.data ? <Spinner /> : null}
      <DataTable<SchoolContest> rows={contests.data ?? []} rowKey={(r) => r.id} empty="Chưa có sự kiện nào"
        columns={[
          { key: 'title', label: 'Sự kiện', flex: 2, render: (r) => <Cell main={r.title} sub={`${dateTime(r.starts_at)} → ${dateTime(r.ends_at)}`} /> },
          { key: 'classes', label: 'Lớp tham gia', render: (r) => <Txt size={13}>{r.classes.map((c) => c.name).join(', ') || '—'}</Txt> },
          { key: 'status', label: 'Trạng thái', render: (r) => <StatusChip kind={r.status === 'active' ? 'on' : r.status === 'upcoming' ? 'info' : 'muted'} text={r.settled_at ? 'Đã trao thưởng' : statusText[r.status]} /> },
        ]}
        actions={(r) => (<><Btn title="Bảng điểm" tone="giay" size="sm" onPress={() => open(r)} />{r.status === 'upcoming' ? <Btn icon={Pencil} label={`Sửa ${r.title}`} tone="giay" size="sm" onPress={() => setForm({ row: r })} /> : null}{!r.settled_at ? <Btn icon={Trash2} label={`Xóa ${r.title}`} tone="giay" size="sm" onPress={() => setRemove(r)} /> : null}</>)} />
      {form ? (
        <FormSheet wide title={form.row ? 'Sửa sự kiện' : 'Tạo sự kiện'} subtitle="Thời gian nhập theo giờ Việt Nam" initial={initial(form.row)} onClose={() => setForm(null)} onSubmit={submit}
          fields={[
            { name: 'title', label: 'Tên sự kiện', required: true },
            { name: 'description', label: 'Mô tả', type: 'textarea' },
            { name: 'starts_at', label: 'Bắt đầu (giờ Việt Nam)', required: true, placeholder: '2026-11-10 07:00' },
            { name: 'ends_at', label: 'Kết thúc (giờ Việt Nam)', required: true, placeholder: '2026-11-17 07:00' },
            { name: 'class_ids', label: 'Lớp tham gia', type: 'multi', required: true, options: (classes.data?.items ?? []).map((c) => ({ value: String(c.id), label: `${c.name} (${c.school_year})` })) },
            ...REWARD_FIELDS.map(([k, label]): FieldDef => ({ name: `reward_${k}`, label, type: 'number' })),
            { name: 'badge_id', label: 'Huy hiệu tặng người thắng', type: 'select', options: [{ value: '', label: 'Không tặng' }, ...(badges.data ?? []).map((b) => ({ value: String(b.id), label: b.name }))] },
          ]} />
      ) : null}
      <ConfirmSheet open={Boolean(remove)} title={`Xóa sự kiện “${remove?.title ?? ''}”?`} message="Sự kiện chưa kết thúc sẽ bị hủy; điểm học tập của học sinh không đổi." confirmLabel="Xóa" onCancel={() => setRemove(null)}
        onConfirm={async () => { if (!remove) return; if (await run(() => api.deleteContest(session.token, remove.id).then(() => true), 'Đã xóa sự kiện')) { setRemove(null); contests.reload(); } }} />
      {board ? <InfoSheet title={`Bảng điểm: ${board.title}`} lines={board.entries.length ? board.entries.slice(0, 30).map((e) => `${e.rank}. ${e.name}: ${e.xp} điểm`) : ['Chưa có học sinh ghi điểm.']} onClose={() => setBoard(null)} /> : null}
    </View>
  );
};

const LeaderboardSection: React.FC<{ session: Session }> = ({ session }) => {
  const { run, busy } = useAction(session.expired);
  const cfg = useLoad(() => api.schoolGameSettings(session.token), [session.token], session.expired);
  if (!cfg.data) return cfg.error ? <ErrorNote message={cfg.error} /> : <Spinner />;
  const change = async (patch: Partial<typeof cfg.data>) => { const res = await run(() => api.updateSchoolGameSettings(session.token, patch), 'Đã lưu cấu hình bảng xếp hạng'); if (res) cfg.setData(res); };
  return (
    <Card flat pad={14} style={{ gap: 10 }}>
      <Txt size={14}>Bảng xếp hạng trường chỉ hiện biệt danh ẩn danh, không lộ họ tên thật. Bảng xếp hạng lớp luôn hiện cho học sinh trong lớp.</Txt>
      <AdminSelect label="Bảng xếp hạng trường" value={cfg.data.leaderboard_enabled ? '1' : '0'} options={[{ value: '1', label: 'Bật' }, { value: '0', label: 'Tắt' }]} onChange={(v) => change({ leaderboard_enabled: v === '1' })} />
      <AdminSelect label="Phạm vi" value={cfg.data.leaderboard_scope} options={[{ value: 'school', label: 'Toàn trường' }, { value: 'grade', label: 'Theo khối lớp của học sinh' }]} onChange={(v) => change({ leaderboard_scope: v as 'school' | 'grade' })} />
      <AdminSelect label="Kỳ xếp hạng mặc định" value={cfg.data.leaderboard_period} options={[{ value: 'week', label: 'Theo tuần' }, { value: 'month', label: 'Theo tháng' }]} onChange={(v) => change({ leaderboard_period: v as 'week' | 'month' })} />
      {busy ? <Spinner /> : null}
    </Card>
  );
};

export const SchoolGame: React.FC<{ session: Session }> = ({ session }) => {
  const [view, setView] = useState<'board' | 'contests' | 'badges' | 'classes'>('board');
  return (
    <Page>
      <PageHeader title="Trò chơi hóa của trường" subtitle="Bảng xếp hạng, sự kiện – giải đấu, huy hiệu riêng và cơ chế tim theo lớp." />
      <Segmented<'board' | 'contests' | 'badges' | 'classes'> label="Mục quản trị" value={view} onChange={setView}
        options={[{ value: 'board', label: 'Bảng xếp hạng' }, { value: 'contests', label: 'Sự kiện – giải đấu' }, { value: 'badges', label: 'Huy hiệu của trường' }, { value: 'classes', label: 'Lớp và huy hiệu' }]} />
      {view === 'board' ? <LeaderboardSection session={session} /> : view === 'contests' ? <ContestSection session={session} />
        : view === 'badges' ? <GameCatalog session={session} entities={['badges']} hideFields={['rule_type', 'rule_value', 'rule_campaign_id']} intro="Huy hiệu riêng của trường do giáo viên hoặc nhà trường trao tay cho học sinh; không có điều kiện tự trao." />
        : <ClassGamePanel session={session} />}
    </Page>
  );
};
