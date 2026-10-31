/**
 * Kho dữ liệu lịch sử của quản trị tổng (HK.AD.028–042): cuộc kháng chiến, nhân vật, sự kiện, địa điểm (chọn tọa độ trên bản đồ), trận đánh,
 * tư liệu gốc, thuật ngữ; dòng thời gian; kiểm chứng và công bố; lịch sử chỉnh sửa (so sánh, khôi phục); nhập/xuất Excel và JSON.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ArrowDown, ArrowUp, CheckCircle2, History, Pencil, Plus, Trash2 } from 'lucide-react-native';
import * as api from '@/api/adminApi';
import { AdminSelect } from '@/components/admin/AdminSelect';
import { MapPicker } from '@/components/admin/MapPicker';
import { Cell, DataTable, DownloadButton, ErrorNote, FilterBar, FilterBox, FormSheet, ImportSheet, Page, PageHeader, StatusChip, useAction, useDebounced, useLoad, type FieldDef } from '@/components/admin/kit';
import { dateText } from '@/components/admin/AccountSheet';
import type { Session } from '@/components/auth';
import { Btn, Card, ConfirmSheet, Field, Inset, Sheet, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { HistoryEntity, HistoryField, HistoryRecord, HistorySpec, HistoryStatus } from '@/types/api';

type Tab = HistoryEntity | 'timeline' | 'exchange';
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'campaign', label: 'Cuộc kháng chiến' }, { id: 'figure', label: 'Nhân vật' }, { id: 'event', label: 'Sự kiện' }, { id: 'place', label: 'Địa điểm' },
  { id: 'battle', label: 'Trận đánh' }, { id: 'source', label: 'Tư liệu gốc' }, { id: 'term', label: 'Thuật ngữ' }, { id: 'timeline', label: 'Dòng thời gian' }, { id: 'exchange', label: 'Nhập / xuất' },
];
const STATUS_TEXT: Record<HistoryStatus, string> = { draft: 'Nháp', verified: 'Đã kiểm chứng', published: 'Công bố' };
const STATUS_KIND = { draft: 'muted', verified: 'warn', published: 'on' } as const;
const ENUM_TEXT: Record<string, string> = {
  king: 'Vua', general: 'Tướng lĩnh', official: 'Quan lại', other: 'Nhân vật khác',
  su_lieu: 'Sử liệu', tho_van: 'Thơ văn', hich: 'Hịch', hinh_anh: 'Hình ảnh', ban_do_co: 'Bản đồ cổ',
};
const NEXT: Record<HistoryStatus, HistoryStatus | null> = { draft: 'verified', verified: 'published', published: null };
const PREV: Record<HistoryStatus, HistoryStatus | null> = { draft: null, verified: 'draft', published: 'verified' };

const SUMMARY: Record<HistoryEntity, (r: HistoryRecord) => { main: string; sub?: string | null }> = {
  campaign: (r) => ({ main: String(r.title), sub: `Năm ${r.year_label}` }),
  place: (r) => ({ main: String(r.name), sub: [r.old_name && `xưa: ${r.old_name}`, r.province, r.lat != null ? `${r.lat}, ${r.lng}` : 'chưa có tọa độ'].filter(Boolean).join(' · ') }),
  figure: (r) => ({ main: String(r.name), sub: [ENUM_TEXT[String(r.figure_group)], r.honorific].filter(Boolean).join(' · ') }),
  event: (r) => ({ main: String(r.name), sub: [r.date_text ?? r.year_from, r.ref_labels.campaign_id].filter(Boolean).join(' · ') }),
  battle: (r) => ({ main: String(r.name), sub: [r.date_text ?? r.year, r.ref_labels.place_id].filter(Boolean).join(' · ') }),
  source: (r) => ({ main: String(r.title), sub: [ENUM_TEXT[String(r.kind)], r.citation].filter(Boolean).join(' · ') }),
  term: (r) => ({ main: String(r.term), sub: String(r.definition ?? '').slice(0, 90) }),
};

export const HistoryManager: React.FC<{ session: Session }> = ({ session }) => {
  const { c } = useTheme();
  const [tab, setTab] = useState<Tab>('campaign');
  const { data: specs } = useLoad(() => api.historySpecs(session.token), [session.token], session.expired);
  const { data: overview, reload: reloadOverview } = useLoad(() => api.historyOverview(session.token), [session.token], session.expired);
  const spec = specs?.find((s) => s.entity === tab);
  return (
    <Page>
      <PageHeader title="Kho dữ liệu lịch sử" subtitle="Nội dung có vòng đời Nháp → Đã kiểm chứng → Công bố. Chỉ nội dung Công bố được học sinh thấy và được AI dùng." />
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {TABS.map((t) => {
          const count = overview && t.id in overview ? overview[t.id as HistoryEntity] : null;
          const on = t.id === tab;
          return (
            <Pressable key={t.id} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => setTab(t.id)} testID={`history-tab-${t.id}`}
              style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 5, borderWidth: 1, borderColor: on ? c.son : c.adminLine, backgroundColor: on ? c.son : c.the, justifyContent: 'center' }}>
              <Txt f="semibold" size={13} color={on ? c.trang : c.muc}>{t.label}{count ? ` · ${count.total}` : ''}</Txt>
            </Pressable>
          );
        })}
      </View>
      {!specs ? <Spinner label="Đang tải…" /> : tab === 'timeline' ? <TimelinePanel session={session} /> : tab === 'exchange' ? <ExchangePanel session={session} onDone={reloadOverview} /> : spec ? <EntityPanel key={tab} session={session} spec={spec} specs={specs} onChanged={reloadOverview} /> : null}
    </Page>
  );
};

// ---------------------------------------------------------------------- danh sách từng loại
const EntityPanel: React.FC<{ session: Session; spec: HistorySpec; specs: HistorySpec[]; onChanged: () => void }> = ({ session, spec, specs, onChanged }) => {
  const { token } = session;
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [campaign, setCampaign] = useState('');
  const [group, setGroup] = useState('');
  const dq = useDebounced(q);
  const e = spec.entity;
  const { data, error, loading, reload } = useLoad(() => api.historyList(token, e, { q: dq, status, campaign_id: campaign ? Number(campaign) : undefined, figure_group: group, limit: 200 }), [token, e, dq, status, campaign, group], session.expired);
  const { data: campaigns } = useLoad(() => api.historyList(token, 'campaign', { limit: 50 }), [token], session.expired);
  const [open, setOpen] = useState<number | null>(null);
  const [form, setForm] = useState<{ record: HistoryRecord | null } | null>(null);
  const changed = () => { reload(); onChanged(); };
  const campaignOptions = [{ value: '', label: 'Mọi cuộc kháng chiến' }, ...(campaigns?.items ?? []).map((x) => ({ value: String(x.id), label: String(x.title) }))];
  const hasCampaign = ['figure', 'event', 'battle', 'source'].includes(e);
  return (
    <>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <Txt f="bold" size={18}>{spec.plural}{data ? ` (${data.total})` : ''}</Txt>
        <Btn title={`Thêm ${spec.label.toLowerCase()}`} icon={Plus} tone="son" onPress={() => setForm({ record: null })} testID="history-add" />
      </View>
      <FilterBar>
        <FilterBox flex={2}><Field label="Tìm kiếm (không cần dấu)" value={q} onChangeText={setQ} autoCapitalize="none" /></FilterBox>
        <FilterBox><AdminSelect label="Trạng thái" value={status} options={[{ value: '', label: 'Mọi trạng thái' }, ...(Object.keys(STATUS_TEXT) as HistoryStatus[]).map((s) => ({ value: s, label: `${STATUS_TEXT[s]}${data ? ` (${data.status_counts[s]})` : ''}` }))]} onChange={(v) => setStatus(String(v))} /></FilterBox>
        {hasCampaign ? <FilterBox><AdminSelect label="Cuộc kháng chiến" value={campaign} options={campaignOptions} onChange={(v) => setCampaign(String(v))} /></FilterBox> : null}
        {e === 'figure' ? <FilterBox><AdminSelect label="Nhóm" value={group} options={[{ value: '', label: 'Mọi nhóm' }, ...['king', 'general', 'official', 'other'].map((g) => ({ value: g, label: ENUM_TEXT[g] }))]} onChange={(v) => setGroup(String(v))} /></FilterBox> : null}
      </FilterBar>
      <ErrorNote message={error} />
      {loading && !data ? <Spinner label="Đang tải…" /> : null}
      {data ? (
        <DataTable rows={data.items} rowKey={(r) => r.id} empty={`Chưa có ${spec.label.toLowerCase()} nào khớp bộ lọc.`} onRowPress={(r) => setOpen(r.id)}
          columns={[
            { key: 'main', label: spec.label, flex: 3, render: (r) => <Cell main={SUMMARY[e](r).main} sub={SUMMARY[e](r).sub} /> },
            { key: 'status', label: 'Trạng thái', render: (r) => <StatusChip kind={STATUS_KIND[r.status]} text={STATUS_TEXT[r.status]} /> },
            { key: 'ver', label: 'Phiên bản', render: (r) => <Txt size={13}>v{r.version_no} · {dateText(r.updated_at)}</Txt> },
          ]} />
      ) : null}
      {open ? <RecordSheet session={session} spec={spec} specs={specs} id={open} onClose={() => setOpen(null)} onChanged={changed} onEdit={(record) => setForm({ record })} /> : null}
      {form ? <RecordForm session={session} spec={spec} specs={specs} record={form.record} onClose={() => setForm(null)} onSaved={() => { setForm(null); changed(); }} /> : null}
    </>
  );
};

// ---------------------------------------------------------------------- biểu mẫu thêm/sửa
function toFieldDef(f: HistoryField, refOptions: Record<string, Array<{ value: string; label: string }>>): FieldDef {
  const base = { name: f.name, label: f.label, required: f.required };
  if (f.type === 'enum') return { ...base, type: 'select', options: (f.values ?? []).map((v) => ({ value: v, label: ENUM_TEXT[v] ?? v })) };
  if (f.type === 'ref') return { ...base, type: 'select', options: [{ value: '', label: 'Chưa chọn' }, ...(refOptions[f.ref as string] ?? [])] };
  if (f.type === 'int' || f.type === 'num') return { ...base, type: 'number' };
  if (f.type === 'text' && (f.max ?? 0) > 400) return { ...base, type: 'textarea' };
  if (f.type === 'url') return { ...base, hint: 'Liên kết bắt đầu bằng https://' };
  if (f.type === 'key') return { ...base, hint: 'Chữ thường, số, gạch dưới (vd: bach_dang)' };
  return base;
}

const RecordForm: React.FC<{ session: Session; spec: HistorySpec; specs: HistorySpec[]; record: HistoryRecord | null; onClose: () => void; onSaved: () => void }> = ({ session, spec, specs, record, onClose, onSaved }) => {
  const { token } = session;
  const needed = useMemo(() => [...new Set([...spec.fields.filter((f) => f.type === 'ref').map((f) => f.ref as HistoryEntity), ...spec.links])], [spec]);
  const { data: options, error } = useLoad(async () => {
    const out: Record<string, Array<{ value: string; label: string }>> = {};
    for (const type of needed) {
      const label = specs.find((s) => s.entity === type)?.main ?? 'name';
      out[type] = (await api.historyList(token, type, { limit: 200 })).items.map((r) => ({ value: String(r.id), label: String(r[label]) }));
    }
    return out;
  }, [token, needed.join(',')], session.expired);
  const [note, setNote] = useState('');
  if (!options) return error ? <Sheet open onClose={onClose} title="Không tải được danh sách liên kết"><ErrorNote message={error} /></Sheet> : <Sheet open onClose={onClose} title={record ? 'Sửa' : 'Thêm'}><Spinner label="Đang tải…" /></Sheet>;

  const fields: FieldDef[] = spec.fields.map((f) => toFieldDef(f, options));
  if (spec.entity === 'place') {
    const at = fields.findIndex((f) => f.name === 'lng');
    fields.splice(at + 1, 0, {
      name: 'map', label: 'Bản đồ', render: (values, set) => (
        <View style={{ gap: 6 }}>
          <Txt f="bold" size={14}>Chọn tọa độ trên bản đồ</Txt>
          <MapPicker lat={values.lat !== '' && !Number.isNaN(Number(values.lat)) ? Number(values.lat) : null} lng={values.lng !== '' && !Number.isNaN(Number(values.lng)) ? Number(values.lng) : null}
            onPick={(la, ln) => { set('lat', String(la)); set('lng', String(ln)); }} />
        </View>
      ),
    });
  }
  for (const type of spec.links) fields.push({ name: `links_${type}`, label: `Liên kết: ${specs.find((s) => s.entity === type)?.plural ?? type}`, type: 'multi', options: options[type] ?? [] });
  const initial = Object.fromEntries([
    ...spec.fields.map((f) => [f.name, record?.[f.name] == null ? (f.type === 'enum' ? (f.values?.[0] ?? '') : '') : String(record[f.name])]),
    ...spec.links.map((type) => [`links_${type}`, (record?.links?.[type] ?? []).map(String)]),
  ]);
  return (
    <FormSheet title={record ? `Sửa ${spec.label.toLowerCase()}` : `Thêm ${spec.label.toLowerCase()}`} wide initial={initial} fields={fields} onClose={onClose}
      subtitle={record && record.status !== 'draft' ? 'Sửa nội dung sẽ đưa bản ghi về Nháp để kiểm chứng lại.' : 'Bản ghi mới ở trạng thái Nháp.'}
      footerExtra={record ? <View style={{ flex: 1, minWidth: 180 }}><Field label="Ghi chú thay đổi (không bắt buộc)" value={note} onChangeText={setNote} /></View> : null}
      onSubmit={async (v) => {
        const body: Record<string, unknown> = {};
        for (const f of spec.fields) {
          const raw = String(v[f.name] ?? '').trim();
          body[f.name] = raw === '' ? null : f.type === 'int' || f.type === 'num' || f.type === 'ref' ? Number(raw) : raw;
        }
        const links: Record<string, number[]> = {};
        for (const type of spec.links) links[type] = (v[`links_${type}`] as string[]).map(Number);
        body.links = links;
        if (record) await api.historyUpdate(token, spec.entity, record.id, { ...body, note: note || undefined });
        else await api.historyCreate(token, spec.entity, body);
        onSaved();
      }} />
  );
};

// ---------------------------------------------------------------------- chi tiết, vòng đời, phiên bản
const RecordSheet: React.FC<{ session: Session; spec: HistorySpec; specs: HistorySpec[]; id: number; onClose: () => void; onChanged: () => void; onEdit: (r: HistoryRecord) => void }> = ({ session, spec, specs, id, onClose, onChanged, onEdit }) => {
  const { c } = useTheme();
  const { token } = session;
  const { data: r, error, reload } = useLoad(() => api.historyGet(token, spec.entity, id), [token, spec.entity, id], session.expired);
  const { busy, run } = useAction(session.expired);
  const [removing, setRemoving] = useState(false);
  const [versions, setVersions] = useState(false);
  const refresh = () => { reload(); onChanged(); };
  const move = async (status: HistoryStatus) => { if (await run(() => api.historyStatus(token, spec.entity, id, status), `Đã chuyển sang “${STATUS_TEXT[status]}”`)) refresh(); };
  const next = r ? NEXT[r.status] : null, prev = r ? PREV[r.status] : null;
  return (
    <>
      <Sheet open onClose={onClose} wide title={r ? SUMMARY[spec.entity](r).main : spec.label} subtitle={r ? `${spec.label} · ${r.slug}` : undefined}>
        <ErrorNote message={error} />
        {!r && !error ? <Spinner label="Đang tải…" /> : null}
        {r ? (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <StatusChip kind={STATUS_KIND[r.status]} text={STATUS_TEXT[r.status]} />
              <StatusChip kind="muted" text={`Phiên bản ${r.version_no}`} />
              {r.verified_at ? <Txt size={12} color={c.muc3}>Kiểm chứng: {dateText(r.verified_at)}</Txt> : null}
              {r.published_at ? <Txt size={12} color={c.muc3}>Công bố: {dateText(r.published_at)}</Txt> : null}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {next ? <Btn title={next === 'verified' ? 'Đánh dấu đã kiểm chứng' : 'Công bố'} icon={CheckCircle2} tone="son" size="sm" loading={busy} onPress={() => move(next)} testID="history-advance" /> : null}
              {prev ? <Btn title={prev === 'draft' ? 'Đưa về Nháp' : 'Hủy công bố'} tone="giay" size="sm" loading={busy} onPress={() => move(prev)} testID="history-back" /> : null}
              <Btn title="Sửa" icon={Pencil} tone="giay" size="sm" onPress={() => { onClose(); onEdit(r); }} />
              <Btn title="Lịch sử chỉnh sửa" icon={History} tone="giay" size="sm" onPress={() => setVersions(true)} />
              <Btn title="Xóa" icon={Trash2} tone="giay" size="sm" onPress={() => setRemoving(true)} />
            </View>
            {r.status === 'published' ? <Txt size={13} color={c.muc3}>Đang công bố: sửa nội dung sẽ đưa bản ghi về Nháp và ẩn khỏi học sinh/AI cho đến khi kiểm chứng lại.</Txt> : null}
            <View style={{ gap: 10 }}>
              {spec.fields.map((f) => {
                const raw = r[f.name];
                const value = f.type === 'ref' ? r.ref_labels[f.name] : f.type === 'enum' ? ENUM_TEXT[String(raw)] ?? raw : raw;
                return (
                  <View key={f.name} style={{ gap: 2 }}>
                    <Txt f="bold" size={12} color={c.muc3}>{f.label}</Txt>
                    <Txt size={14} selectable style={{ fontFamily: undefined }}>{value === null || value === undefined || value === '' ? 'Chưa có' : String(value)}</Txt>
                  </View>
                );
              })}
            </View>
            {spec.links.map((type) => {
              const items = r.link_items?.[type] ?? [];
              return items.length ? (
                <View key={type} style={{ gap: 4 }}>
                  <Txt f="bold" size={13} color={c.muc2}>{specs.find((s) => s.entity === type)?.plural}</Txt>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{items.map((x) => <StatusChip key={x.id} kind={STATUS_KIND[x.status]} text={x.label} />)}</View>
                </View>
              ) : null;
            })}
          </>
        ) : null}
      </Sheet>
      <ConfirmSheet open={removing} title={`Xóa ${spec.label.toLowerCase()}`} busy={busy} confirmLabel="Xóa" onCancel={() => setRemoving(false)}
        message="Xóa bản ghi này? Không xóa được khi còn liên kết với bản ghi khác hoặc đang công bố; lịch sử phiên bản vẫn được lưu."
        onConfirm={async () => { const ok = await run(() => api.historyDelete(token, spec.entity, id).then(() => true), 'Đã xóa'); setRemoving(false); if (ok) { onChanged(); onClose(); } }} />
      {versions ? <VersionsSheet session={session} spec={spec} id={id} onClose={() => setVersions(false)} onRestored={() => { refresh(); }} /> : null}
    </>
  );
};

const VersionsSheet: React.FC<{ session: Session; spec: HistorySpec; id: number; onClose: () => void; onRestored: () => void }> = ({ session, spec, id, onClose, onRestored }) => {
  const { c } = useTheme();
  const { token } = session;
  const { data, error, reload } = useLoad(() => api.historyVersions(token, spec.entity, id), [token, id], session.expired);
  const { busy, run } = useAction(session.expired);
  const [pair, setPair] = useState<number[]>([]);
  const [restoring, setRestoring] = useState<number | null>(null);
  const { data: diff } = useLoad(async () => (pair.length === 2 ? api.historyDiff(token, spec.entity, id, Math.min(...pair), Math.max(...pair)) : null), [pair.join(',')], session.expired);
  const toggle = (n: number) => setPair((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p.slice(-1), n]));
  const ACTION: Record<string, string> = { create: 'Tạo', update: 'Sửa', status: 'Đổi trạng thái', restore: 'Khôi phục', import: 'Nhập từ file', reorder: 'Đổi thứ tự' };
  const show = (v: unknown) => (Array.isArray(v) ? v.join(', ') || '—' : v === null || v === undefined || v === '' ? '—' : String(v));
  return (
    <Sheet open onClose={onClose} wide title="Lịch sử chỉnh sửa" subtitle="Chọn hai phiên bản để so sánh; khôi phục đưa nội dung về Nháp">
      <ErrorNote message={error} />
      {!data && !error ? <Spinner label="Đang tải…" /> : null}
      {data?.map((v) => (
        <Card key={v.id} flat pad={12} style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <Txt f="bold" size={14}>v{v.version_no} · {ACTION[v.action] ?? v.action}</Txt>
            <StatusChip kind={STATUS_KIND[v.status] ?? 'muted'} text={STATUS_TEXT[v.status] ?? v.status} />
            <Txt size={12} color={c.muc3}>{dateText(v.created_at)} · {v.changed_by ?? 'Hệ thống'}</Txt>
          </View>
          {v.note ? <Txt size={13} color={c.muc2}>{v.note}</Txt> : null}
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Btn title={pair.includes(v.version_no) ? 'Bỏ chọn so sánh' : 'Chọn để so sánh'} tone="giay" size="sm" selected={pair.includes(v.version_no)} onPress={() => toggle(v.version_no)} />
            {v.version_no !== data[0].version_no ? <Btn title="Khôi phục bản này" tone="giay" size="sm" onPress={() => setRestoring(v.version_no)} /> : null}
          </View>
        </Card>
      ))}
      {diff ? (
        <Inset style={{ gap: 8 }}>
          <Txt f="bold" size={14}>So sánh v{diff.from} → v{diff.to}</Txt>
          {diff.changes.length === 0 ? <Txt size={13} color={c.muc2}>Hai phiên bản giống nhau.</Txt> : diff.changes.map((x) => (
            <View key={x.field} style={{ gap: 2 }}>
              <Txt f="bold" size={12} color={c.muc3}>{x.label}</Txt>
              <Txt size={13} color={c.sonChu}>− {show(x.from)}</Txt>
              <Txt size={13} color={c.mocChu}>+ {show(x.to)}</Txt>
            </View>
          ))}
        </Inset>
      ) : null}
      <ConfirmSheet open={restoring !== null} title="Khôi phục phiên bản" confirmLabel="Khôi phục" busy={busy} onCancel={() => setRestoring(null)}
        message={`Đưa nội dung về phiên bản ${restoring}? Bản ghi sẽ quay về Nháp và cần kiểm chứng lại; phiên bản hiện tại vẫn được giữ trong lịch sử.`}
        onConfirm={async () => { if (restoring && (await run(() => api.historyRestore(token, spec.entity, id, restoring), 'Đã khôi phục'))) { setRestoring(null); reload(); onRestored(); } }} />
    </Sheet>
  );
};

// ---------------------------------------------------------------------- dòng thời gian (HK.AD.037)
const TimelinePanel: React.FC<{ session: Session }> = ({ session }) => {
  const { c } = useTheme();
  const { token } = session;
  const [campaignId, setCampaignId] = useState('');
  const { data, error, loading, reload } = useLoad(() => api.historyTimeline(token), [token], session.expired);
  const { busy, run } = useAction(session.expired);
  const current = data?.campaigns.find((x) => String(x.id) === (campaignId || String(data.campaigns[0]?.id)));
  const swap = async (index: number, delta: number) => {
    if (!current) return;
    const ids = current.events.map((e) => e.id);
    const to = index + delta;
    if (to < 0 || to >= ids.length) return;
    [ids[index], ids[to]] = [ids[to], ids[index]];
    if (await run(() => api.historyReorder(token, current.id, ids), 'Đã lưu thứ tự')) reload();
  };
  return (
    <>
      <Txt size={14} color={c.muc2}>Sắp xếp các mốc (sự kiện) của từng cuộc kháng chiến bằng nút mũi tên; mỗi lần đổi thứ tự được lưu thành một phiên bản của sự kiện.</Txt>
      <ErrorNote message={error} />
      {loading && !data ? <Spinner label="Đang tải…" /> : null}
      {data ? (
        <>
          <FilterBar><FilterBox><AdminSelect label="Cuộc kháng chiến" value={String(current?.id ?? '')} options={data.campaigns.map((x) => ({ value: String(x.id), label: `${x.title} (${x.year_label})` }))} onChange={(v) => setCampaignId(String(v))} /></FilterBox></FilterBar>
          {current?.events.length ? current.events.map((e, i) => (
            <Card key={e.id} flat pad={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.thuyNhat, alignItems: 'center', justifyContent: 'center' }}><Txt f="bold" size={13} color={c.thuyChu}>{i + 1}</Txt></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt f="semibold" size={14}>{e.name}</Txt>
                <Txt size={12} color={c.muc3}>{[e.date_text ?? e.year_from, e.place_name, e.battles ? `${e.battles} trận đánh` : null].filter(Boolean).join(' · ')}</Txt>
              </View>
              <StatusChip kind={STATUS_KIND[e.status]} text={STATUS_TEXT[e.status]} />
              <Btn icon={ArrowUp} label={`Chuyển ${e.name} lên`} tone="giay" size="sm" disabled={busy || i === 0} onPress={() => swap(i, -1)} />
              <Btn icon={ArrowDown} label={`Chuyển ${e.name} xuống`} tone="giay" size="sm" disabled={busy || i === current.events.length - 1} onPress={() => swap(i, 1)} />
            </Card>
          )) : <Txt size={14} color={c.muc3}>Cuộc kháng chiến này chưa có sự kiện nào.</Txt>}
          {data.unassigned.length ? <Inset><Txt size={13} color={c.muc2}>{data.unassigned.length} sự kiện chưa gắn cuộc kháng chiến nên chưa nằm trên dòng thời gian nào.</Txt></Inset> : null}
        </>
      ) : null}
    </>
  );
};

// ---------------------------------------------------------------------- nhập / xuất (HK.AD.041)
const ExchangePanel: React.FC<{ session: Session; onDone: () => void }> = ({ session, onDone }) => {
  const { c } = useTheme();
  const { token } = session;
  const [importing, setImporting] = useState(false);
  return (
    <>
      <Card flat pad={16} style={{ gap: 10 }}>
        <Txt f="bold" size={16}>Xuất dữ liệu (sao lưu nội dung)</Txt>
        <Txt size={14} color={c.muc2}>Toàn bộ kho: cuộc kháng chiến, địa điểm, nhân vật, tư liệu, thuật ngữ, sự kiện, trận đánh cùng liên kết. Tham chiếu dùng mã định danh (slug) nên nhập lại được vào hệ thống khác.</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <DownloadButton title="Xuất JSON" fetchBlob={() => api.downloadFile(token, '/api/admin/history/export?format=json')} filename="kho-lich-su.json" />
          <DownloadButton title="Xuất Excel" fetchBlob={() => api.downloadFile(token, '/api/admin/history/export?format=xlsx')} filename="kho-lich-su.xlsx" />
        </View>
      </Card>
      <Card flat pad={16} style={{ gap: 10 }}>
        <Txt f="bold" size={16}>Nhập hàng loạt</Txt>
        <Txt size={14} color={c.muc2}>Nhận file Excel hoặc JSON theo mẫu. Bản ghi trùng mã định danh được cập nhật, bản ghi mới được tạo; mọi bản ghi nhập vào đều ở trạng thái Nháp và cần kiểm chứng, công bố lại.</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <DownloadButton title="Tải file Excel mẫu" fetchBlob={() => api.downloadFile(token, '/api/admin/history/template')} filename="mau-kho-lich-su.xlsx" />
          <Btn title="Nhập từ file…" tone="son" size="sm" onPress={() => setImporting(true)} testID="history-import" />
        </View>
      </Card>
      {importing ? (
        <ImportSheet title="Nhập kho dữ liệu lịch sử" hint="Chọn file .xlsx hoặc .json. Hệ thống kiểm tra từng bản ghi trước khi lưu."
          types={['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/json']}
          run={(file, commit) => api.historyImport(token, file, commit)} onClose={() => setImporting(false)} onDone={onDone} />
      ) : null}
    </>
  );
};
