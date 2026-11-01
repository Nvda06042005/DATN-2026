/**
 * Quản lý bài học (HK.AD.044): quản trị tổng soạn bài bằng các khối nội dung (văn bản, hình, video, bản đồ), gắn với dữ liệu lịch sử,
 * chọn câu kiểm tra nhanh cuối bài, công bố hoặc gỡ về nháp. Bài học đã công bố mới chọn được vào nút hành trình của giáo viên.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { ArrowDown, ArrowUp, Eye, EyeOff, Image as ImageIcon, MapPin, Pencil, Plus, Trash2, Type, Video } from 'lucide-react-native';
import * as api from '@/api/learningApi';
import { AdminSelect } from '@/components/admin/AdminSelect';
import { MapPicker } from '@/components/admin/MapPicker';
import { LinksEditor, QuestionPicker, useCampaignOptions } from '@/components/admin/ContentKit';
import { Cell, DataTable, ErrorNote, FilterBar, FilterBox, Page, PageHeader, StatusChip, useAction, useDebounced, useLoad } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { Btn, Card, ConfirmSheet, Field, Sheet, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { HistoryLink, LessonBlock, LessonDetail, LessonItem } from '@/types/learning';

const BLOCK_TEXT = { text: 'Văn bản', image: 'Hình ảnh', video: 'Video', map: 'Bản đồ' } as const;
const BLOCK_ICON = { text: Type, image: ImageIcon, video: Video, map: MapPin } as const;

const LessonForm: React.FC<{ session: Session; initial?: LessonDetail; onClose: () => void; onSaved: (l: LessonDetail) => void }> = ({ session, initial, onClose, onSaved }) => {
  const { c } = useTheme();
  const campaigns = useCampaignOptions(session);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [summary, setSummary] = useState(initial?.summary ?? '');
  const [campaign, setCampaign] = useState(initial?.campaign_id ? String(initial.campaign_id) : '');
  const [minutes, setMinutes] = useState(initial ? String(initial.read_minutes) : '');
  const [blocks, setBlocks] = useState<LessonBlock[]>(initial?.blocks ?? [{ type: 'text', heading: '', text: '' }]);
  const [links, setLinks] = useState<HistoryLink[]>(initial?.links ?? []);
  const [checks, setChecks] = useState<Array<{ id: number; prompt: string }>>((initial?.checks ?? []).map((k) => ({ id: k.question_id, prompt: k.prompt })));
  const [active, setActive] = useState(0);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const patch = (i: number, p: Partial<LessonBlock>) => setBlocks((b) => b.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const move = (i: number, d: number) => setBlocks((b) => { const n = [...b]; const j = i + d; if (j < 0 || j >= n.length) return n; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const clean = blocks.map((b) => (b.type === 'map' ? { type: b.type, label: b.label, lat: Number(b.lat), lng: Number(b.lng), zoom: Number(b.zoom) || 7, caption: b.caption || undefined } : b.type === 'text' ? { type: b.type, heading: b.heading || undefined, text: b.text } : { type: b.type, url: b.url, caption: b.caption || undefined }));
      const body = {
        title, summary: summary.trim() || null, campaign_id: campaign ? Number(campaign) : null, blocks: clean as LessonBlock[], ...(minutes.trim() ? { read_minutes: Number(minutes) } : {}),
        links: links.map((l) => ({ ref_type: l.ref_type, ref_id: l.ref_id })), check_question_ids: checks.map((k) => k.id),
      };
      onSaved(initial ? await api.updateLesson(session.token, initial.id, body) : await api.createLesson(session.token, body));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa lưu được bài học.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open onClose={onClose} title={initial ? 'Sửa bài học' : 'Tạo bài học'} wide
      footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}><Btn title="Hủy" tone="giay" onPress={onClose} disabled={busy} /><Btn title="Lưu bài học" tone="son" onPress={submit} loading={busy} testID="lesson-save" /></View>}>
      <ErrorNote message={error} />
      <Field label="Tên bài học *" value={title} onChangeText={setTitle} nativeID="lesson-title" />
      <Field label="Tóm tắt" value={summary} onChangeText={setSummary} multiline numberOfLines={2} inputStyle={{ minHeight: 60, textAlignVertical: 'top' }} />
      <FilterBar>
        <FilterBox flex={2}><AdminSelect label="Cuộc kháng chiến" value={campaign} options={campaigns} onChange={setCampaign} /></FilterBox>
        <FilterBox><Field label="Thời lượng đọc (phút)" value={minutes} onChangeText={setMinutes} keyboardType="numeric" hint="Để trống: hệ thống tự ước tính" /></FilterBox>
      </FilterBar>
      <Txt f="bold" size={15}>Nội dung bài học</Txt>
      {blocks.map((b, i) => {
        const Icon = BLOCK_ICON[b.type];
        return (
          <Card key={i} flat pad={12} style={{ gap: 8, borderColor: i === active ? c.son : undefined }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Icon size={16} color={c.muc2} /><Txt f="bold" size={13} style={{ flex: 1 }}>Khối {i + 1}: {BLOCK_TEXT[b.type]}</Txt>
              <Btn icon={ArrowUp} label="Đưa lên" tone="giay" size="sm" disabled={i === 0} onPress={() => { move(i, -1); setActive(Math.max(0, i - 1)); }} />
              <Btn icon={ArrowDown} label="Đưa xuống" tone="giay" size="sm" disabled={i === blocks.length - 1} onPress={() => { move(i, 1); setActive(i + 1); }} />
              <Btn icon={Trash2} label={`Xóa khối ${i + 1}`} tone="giay" size="sm" disabled={blocks.length <= 1} onPress={() => setBlocks((x) => x.filter((_, j) => j !== i))} />
            </View>
            {b.type === 'text' ? (
              <>
                <Field label="Tiêu đề đoạn (tùy chọn)" value={b.heading ?? ''} onChangeText={(v) => patch(i, { heading: v })} />
                <Field label="Nội dung *" value={b.text ?? ''} onChangeText={(v) => patch(i, { text: v })} multiline numberOfLines={5} inputStyle={{ minHeight: 120, textAlignVertical: 'top' }} />
              </>
            ) : null}
            {b.type === 'image' || b.type === 'video' ? (
              <>
                <Field label={b.type === 'image' ? 'Liên kết ảnh (https) *' : 'Liên kết video (https) *'} value={b.url ?? ''} onChangeText={(v) => patch(i, { url: v })} autoCapitalize="none" />
                <Field label="Chú thích" value={b.caption ?? ''} onChangeText={(v) => patch(i, { caption: v })} />
              </>
            ) : null}
            {b.type === 'map' ? (
              <>
                <Field label="Tên địa danh *" value={b.label ?? ''} onChangeText={(v) => patch(i, { label: v })} />
                <MapPicker lat={b.lat !== undefined && b.lat !== null && String(b.lat) !== '' ? Number(b.lat) : null} lng={b.lng !== undefined && b.lng !== null && String(b.lng) !== '' ? Number(b.lng) : null} onPick={(lat, lng) => patch(i, { lat, lng })} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}><Field label="Vĩ độ" value={String(b.lat ?? '')} onChangeText={(v) => patch(i, { lat: v as never })} keyboardType="numeric" /></View>
                  <View style={{ flex: 1 }}><Field label="Kinh độ" value={String(b.lng ?? '')} onChangeText={(v) => patch(i, { lng: v as never })} keyboardType="numeric" /></View>
                  <View style={{ flex: 1 }}><Field label="Phóng to (4–12)" value={String(b.zoom ?? 7)} onChangeText={(v) => patch(i, { zoom: v as never })} keyboardType="numeric" /></View>
                </View>
                <Field label="Chú thích" value={b.caption ?? ''} onChangeText={(v) => patch(i, { caption: v })} />
              </>
            ) : null}
          </Card>
        );
      })}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(Object.keys(BLOCK_TEXT) as Array<keyof typeof BLOCK_TEXT>).map((type) => (
          <Btn key={type} icon={Plus} title={`Thêm ${BLOCK_TEXT[type].toLowerCase()}`} tone="giay" size="sm" disabled={blocks.length >= 30}
            onPress={() => { setBlocks((x) => [...x, type === 'text' ? { type, heading: '', text: '' } : type === 'map' ? { type, label: '', lat: undefined, lng: undefined, zoom: 7 } : { type, url: '' }]); setActive(blocks.length); }} />
        ))}
      </View>
      <View style={{ gap: 8 }}>
        <Txt f="bold" size={15}>Câu kiểm tra nhanh cuối bài (tối đa 3, lấy từ kho hệ thống)</Txt>
        {checks.map((k, i) => (
          <View key={k.id} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Txt size={14} style={{ flex: 1 }}>{i + 1}. {k.prompt}</Txt>
            <Btn icon={Trash2} label={`Gỡ câu ${i + 1}`} tone="giay" size="sm" onPress={() => setChecks((x) => x.filter((y) => y.id !== k.id))} />
          </View>
        ))}
        <Btn icon={Plus} title="Chọn câu kiểm tra" tone="giay" size="sm" disabled={checks.length >= 3} onPress={() => setPicking(true)} />
      </View>
      <LinksEditor session={session} value={links} onChange={setLinks} allowTerm />
      {picking ? <QuestionPicker session={session} title="Chọn câu kiểm tra nhanh" scopeFilter="system" exclude={checks.map((k) => k.id)} onClose={() => setPicking(false)}
        onPick={(items) => { setChecks((x) => [...x, ...items.map((i) => ({ id: i.id, prompt: i.prompt }))].slice(0, 3)); setPicking(false); }} /> : null}
    </Sheet>
  );
};

export const LessonManager: React.FC<{ session: Session }> = ({ session }) => {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [campaign, setCampaign] = useState('');
  const [form, setForm] = useState<{ lesson?: LessonDetail } | null>(null);
  const [removing, setRemoving] = useState<LessonItem | null>(null);
  const term = useDebounced(q.trim(), 300);
  const campaigns = useCampaignOptions(session);
  const list = useLoad(() => api.listLessons(session.token, { q: term, status, campaign_id: campaign }), [session.token, term, status, campaign], session.expired);
  const { busy, run } = useAction(session.expired);
  const edit = async (l: LessonItem) => { const d = await run(() => api.getLesson(session.token, l.id)); if (d) setForm({ lesson: d }); };
  return (
    <Page>
      <PageHeader title="Bài học" subtitle="Bài học gắn với nút trên bản đồ hành trình. Chỉ bài đã công bố mới chọn được vào hành trình của giáo viên và được học sinh đọc."
        actions={<Btn icon={Plus} title="Tạo bài học" tone="son" size="sm" onPress={() => setForm({})} testID="lesson-create" />} />
      <FilterBar>
        <FilterBox><AdminSelect label="Trạng thái" value={status} options={[{ value: '', label: 'Tất cả' }, { value: 'draft', label: 'Bản nháp' }, { value: 'published', label: 'Đã công bố' }]} onChange={setStatus} /></FilterBox>
        <FilterBox><AdminSelect label="Cuộc kháng chiến" value={campaign} options={[{ value: '', label: 'Tất cả' }, ...campaigns.slice(1)]} onChange={setCampaign} /></FilterBox>
        <FilterBox flex={2}><Field label="Tìm bài học" value={q} onChangeText={setQ} /></FilterBox>
      </FilterBar>
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner /> : null}
      {list.data ? (
        <DataTable<LessonItem> rows={list.data} rowKey={(r) => r.id} onRowPress={edit} empty="Chưa có bài học nào"
          columns={[
            { key: 'title', label: 'Bài học', flex: 3, render: (r) => <Cell main={r.title} sub={r.campaign_title ?? 'Chưa gắn cuộc kháng chiến'} /> },
            { key: 'status', label: 'Trạng thái', flex: 1.2, render: (r) => <StatusChip kind={r.status === 'published' ? 'on' : 'muted'} text={r.status === 'published' ? 'Đã công bố' : 'Bản nháp'} /> },
            { key: 'time', label: 'Thời lượng', flex: 0.8, render: (r) => <Txt size={13}>{r.read_minutes} phút</Txt> },
            { key: 'checks', label: 'Câu kiểm tra', flex: 0.9, render: (r) => <Txt size={13}>{r.checks}</Txt> },
            { key: 'used', label: 'Dùng ở nút', flex: 0.9, render: (r) => <Txt size={13}>{r.used_in}</Txt> },
          ]}
          actions={(r) => (
            <>
              <Btn icon={r.status === 'published' ? EyeOff : Eye} label={r.status === 'published' ? `Gỡ công bố ${r.title}` : `Công bố ${r.title}`} tone="giay" size="sm" disabled={busy}
                onPress={async () => { if (await run(() => api.setLessonStatus(session.token, r.id, r.status === 'published' ? 'draft' : 'published'), r.status === 'published' ? 'Đã gỡ về bản nháp' : 'Đã công bố bài học')) list.reload(); }} />
              <Btn icon={Pencil} label={`Sửa ${r.title}`} tone="giay" size="sm" onPress={() => edit(r)} />
              <Btn icon={Trash2} label={`Xóa ${r.title}`} tone="giay" size="sm" onPress={() => setRemoving(r)} />
            </>
          )} />
      ) : null}
      {form ? <LessonForm session={session} initial={form.lesson} onClose={() => setForm(null)} onSaved={() => { setForm(null); list.reload(); }} /> : null}
      <ConfirmSheet open={!!removing} title="Xóa bài học?" message={`Xóa bài “${removing?.title ?? ''}”. Chỉ xóa được bài chưa nằm trong hành trình nào.`} confirmLabel="Xóa" busy={busy}
        onCancel={() => setRemoving(null)} onConfirm={async () => { if (removing) { const ok = await run(async () => { await api.deleteLesson(session.token, removing.id); return true; }, 'Đã xóa bài học'); setRemoving(null); if (ok) list.reload(); } }} />
    </Page>
  );
};
