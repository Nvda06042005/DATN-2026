/**
 * Hành trình học – bản đồ nhiệm vụ (HK.GV.018–021, HK.QT.042, HK.AD.043): thư viện hành trình mẫu của hệ thống / trường / giáo viên, tạo trống hoặc từ mẫu,
 * thêm – sửa – xóa nút (bài học, câu hỏi, trận đánh, tư liệu, Quyết chiến), tư liệu mở khóa theo nút, thứ tự nút, phát hành, đặt mặc định,
 * giao cho lớp (giáo viên), gửi duyệt. Nút mở theo thứ tự; nhánh rẽ và xếp lịch thuộc Sprint 7.
 */
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { ArrowDown, ArrowLeft, ArrowUp, Copy, Eye, Pencil, Plus, Rocket, Send, Star, Trash2, Users } from 'lucide-react-native';
import * as api from '@/api/learningApi';
import { AdminSelect } from '@/components/admin/AdminSelect';
import { ScopeChip, useCampaignOptions } from '@/components/admin/ContentKit';
import { Cell, DataTable, ErrorNote, FilterBar, FilterBox, FormSheet, Page, PageHeader, StatusChip, useAction, useDebounced, useLoad, valuesToIds, idsToValues, type FieldDef } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { Btn, Card, ConfirmSheet, Field, Inset, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { JourneyDetail, JourneyItem, JourneyNode } from '@/types/learning';
import { NODE_ICONS, NODE_KIND_TEXT } from '@/types/learning';

const ICON_TEXT: Record<string, string> = { book: 'Sách', quiz: 'Dấu hỏi', sword: 'Gươm', scroll: 'Cuộn tư liệu', flag: 'Cờ', star: 'Sao', castle: 'Thành', ship: 'Thuyền', horse: 'Ngựa', map: 'Bản đồ', crown: 'Vương miện' };

// ---------------------------------------------------------------------- biểu mẫu nút
const NodeForm: React.FC<{ session: Session; journey: JourneyDetail; node?: JourneyNode; onClose: () => void; onSaved: (j: JourneyDetail) => void }> = ({ session, journey, node, onClose, onSaved }) => {
  const { token } = session;
  const lessons = useLoad(() => api.listLessons(token, { campaign_id: journey.campaign_id }), [token, journey.campaign_id], session.expired);
  const quizzes = useLoad(() => api.listQuizzes(token, { limit: 100 }), [token], session.expired);
  const battles = useLoad(() => api.historyOptions(token, 'battle'), [token], session.expired);
  const sources = useLoad(() => api.historyOptions(token, 'source'), [token], session.expired);
  const system = journey.scope === 'system';
  const quizOptions = (quizzes.data?.items ?? []).filter((z) => (system ? z.scope === 'system' : true)).map((z) => ({ value: String(z.id), label: `${z.title} (${z.question_count} câu)` }));
  const fields: FieldDef[] = [
    ...(node ? [] : [{ name: 'kind', label: 'Loại nút', type: 'select' as const, required: true, options: (Object.keys(NODE_KIND_TEXT) as Array<keyof typeof NODE_KIND_TEXT>).map((value) => ({ value, label: NODE_KIND_TEXT[value] })) }]),
    { name: 'lesson_id', label: 'Bài học', type: 'select', required: true, options: [{ value: '', label: '— Chọn bài học —' }, ...(lessons.data ?? []).map((l) => ({ value: String(l.id), label: `${l.title}${l.status === 'draft' ? ' (nháp)' : ''}` }))], when: (v) => (node?.kind ?? v.kind) === 'lesson' },
    { name: 'quiz_id', label: 'Bộ câu hỏi', type: 'select', required: true, options: [{ value: '', label: '— Chọn bộ đề —' }, ...quizOptions], when: (v) => ['quiz', 'final'].includes(String(node?.kind ?? v.kind)) },
    { name: 'battle_id', label: 'Trận đánh', type: 'select', required: true, options: [{ value: '', label: '— Chọn trận đánh —' }, ...(battles.data ?? []).map((b) => ({ value: String(b.id), label: `${b.label}${b.status !== 'published' ? ' (chưa công bố)' : ''}` }))], when: (v) => (node?.kind ?? v.kind) === 'battle' },
    { name: 'battle_quiz_id', label: 'Bộ câu hỏi sau trận đánh (tùy chọn)', type: 'select', options: [{ value: '', label: '— Không có bộ câu hỏi —' }, ...quizOptions], when: (v) => (node?.kind ?? v.kind) === 'battle' },
    { name: 'source_id', label: 'Tư liệu', type: 'select', required: true, options: [{ value: '', label: '— Chọn tư liệu —' }, ...(sources.data ?? []).map((b) => ({ value: String(b.id), label: `${b.label}${b.status !== 'published' ? ' (chưa công bố)' : ''}` }))], when: (v) => (node?.kind ?? v.kind) === 'source' },
    { name: 'title', label: 'Tên nút', hint: 'Để trống sẽ lấy tên của nội dung được chọn' },
    { name: 'icon', label: 'Biểu tượng', type: 'select', options: NODE_ICONS.map((value) => ({ value, label: ICON_TEXT[value] })) },
    { name: 'objective', label: 'Mục tiêu học tập', type: 'textarea' },
    { name: 'reward_points', label: 'Điểm thưởng khi hoàn thành (0–1000)', type: 'number' },
    { name: 'pass_percent', label: 'Điểm đạt (%) – để trống dùng điểm đạt của bộ đề', type: 'number', when: (v) => ['quiz', 'final', 'battle'].includes(String(node?.kind ?? v.kind)) },
    { name: 'unlock_source_ids', label: 'Tư liệu được mở khóa khi hoàn thành nút', type: 'multi', options: (sources.data ?? []).map((b) => ({ value: String(b.id), label: b.label })) },
  ];
  const initial: Record<string, string | string[]> = node ? {
    lesson_id: String(node.lesson_id ?? ''), quiz_id: node.kind === 'battle' ? '' : String(node.quiz_id ?? ''), battle_quiz_id: node.kind === 'battle' ? String(node.quiz_id ?? '') : '', battle_id: String(node.battle_id ?? ''), source_id: String(node.source_id ?? ''),
    kind: node.kind, title: node.title, icon: node.icon ?? 'star', objective: node.objective ?? '', reward_points: String(node.reward_points), pass_percent: node.pass_percent ? String(node.pass_percent) : '', unlock_source_ids: idsToValues(node.unlocks.map((u) => u.id)),
  } : { kind: 'lesson', icon: 'book', reward_points: '50', lesson_id: '', quiz_id: '', battle_id: '', source_id: '', battle_quiz_id: '', unlock_source_ids: [] as string[] };
  return (
    <FormSheet title={node ? 'Sửa nút' : 'Thêm nút vào bản đồ'} subtitle={journey.title} fields={fields} initial={initial} wide
      onClose={onClose}
      onSubmit={async (v) => {
        const kind = (node?.kind ?? String(v.kind)) as JourneyNode['kind'];
        const num = (x: unknown) => (String(x ?? '').trim() ? Number(x) : null);
        const body = {
          ...(node ? {} : { kind }), title: String(v.title ?? '').trim() || undefined, icon: String(v.icon || ''), objective: String(v.objective ?? '').trim() || null, reward_points: num(v.reward_points) ?? 50,
          lesson_id: kind === 'lesson' ? num(v.lesson_id) : undefined, quiz_id: kind === 'battle' ? num(v.battle_quiz_id) : kind === 'quiz' || kind === 'final' ? num(v.quiz_id) : undefined,
          battle_id: kind === 'battle' ? num(v.battle_id) : undefined, source_id: kind === 'source' ? num(v.source_id) : undefined,
          pass_percent: ['quiz', 'final', 'battle'].includes(kind) ? num(v.pass_percent) : undefined, unlock_source_ids: valuesToIds(v.unlock_source_ids),
        };
        onSaved(node ? await api.updateNode(token, node.id, body) : await api.addNode(token, journey.id, body));
      }} />
  );
};

// ---------------------------------------------------------------------- chi tiết một hành trình
const JourneyEditor: React.FC<{ session: Session; id: number; onBack: () => void; onChanged: () => void; onPreview?: (j: JourneyDetail) => void }> = ({ session, id, onBack, onChanged, onPreview }) => {
  const { c } = useTheme();
  const { token } = session;
  const role = session.user.role;
  const detail = useLoad(() => api.getJourney(token, id), [token, id], session.expired);
  const classes = useLoad(() => (role === 'teacher' ? api.myClasses(token) : Promise.resolve([])), [token, role], session.expired);
  const { busy, run } = useAction(session.expired);
  const [nodeForm, setNodeForm] = useState<{ node?: JourneyNode } | null>(null);
  const [meta, setMeta] = useState(false);
  const [assign, setAssign] = useState(false);
  const [removing, setRemoving] = useState<JourneyNode | null>(null);
  const [deleting, setDeleting] = useState(false);
  const j = detail.data;
  const apply = (next: JourneyDetail) => { detail.setData(next); onChanged(); };
  const campaigns = useCampaignOptions(session);
  const move = async (index: number, delta: number) => {
    if (!j) return;
    const ids = j.nodes.map((n) => n.id);
    const to = index + delta;
    if (to < 0 || to >= ids.length) return;
    [ids[index], ids[to]] = [ids[to], ids[index]];
    const next = await run(() => api.reorderNodes(token, j.id, ids));
    if (next) apply(next);
  };
  const shareTarget = role === 'teacher' && j?.scope === 'teacher' ? 'school' : role === 'school_admin' && j?.scope === 'school' ? 'system' : null;
  const shared = j?.shares.find((x) => x.target === shareTarget);
  const nodeWarn = (n: JourneyNode) => [
    n.kind === 'lesson' && n.lesson_status !== 'published' ? 'bài học chưa công bố' : '', n.kind === 'source' && n.source_status !== 'published' ? 'tư liệu chưa công bố' : '',
    n.kind === 'battle' && n.battle_status !== 'published' ? 'trận đánh chưa công bố' : '', n.quiz_id && !n.quiz_questions ? 'bộ câu hỏi rỗng' : '',
  ].filter(Boolean).join(', ');

  return (
    <Page>
      <Btn icon={ArrowLeft} title="Thư viện hành trình" tone="giay" size="sm" onPress={onBack} />
      <ErrorNote message={detail.error} />
      {detail.loading && !j ? <Spinner /> : null}
      {j ? (
        <>
          <PageHeader title={j.title} subtitle={`${j.campaign_title}${j.owner_name ? ` · soạn bởi ${j.owner_name}` : ''}`}
            actions={<>
              {onPreview ? <Btn icon={Eye} title="Xem trước" tone="giay" size="sm" onPress={() => onPreview(j)} /> : null}
              {j.can_edit ? <Btn icon={Pencil} title="Sửa thông tin" tone="giay" size="sm" onPress={() => setMeta(true)} /> : null}
              {role !== 'school_admin' || j.scope === 'school' || j.scope === 'system' ? <Btn icon={Copy} title="Nhân bản" tone="giay" size="sm" loading={busy} onPress={async () => { const copy = await run(() => api.duplicateJourney(token, j.id), 'Đã nhân bản; bản sao nằm trong kho của bạn'); if (copy) { onChanged(); onBack(); } }} /> : null}
            </>} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <ScopeChip scope={j.scope} />
            <StatusChip kind={j.status === 'published' ? 'on' : 'muted'} text={j.status === 'published' ? 'Đã phát hành' : 'Bản nháp'} />
            {j.is_default ? <StatusChip kind="info" text="Hành trình mặc định" /> : null}
            {j.shares.map((x) => <StatusChip key={x.target} kind={x.status === 'approved' ? 'on' : x.status === 'pending' ? 'warn' : 'off'} text={`${x.target === 'school' ? 'Gửi trường' : 'Gửi hệ thống'}: ${x.status === 'approved' ? 'đã duyệt' : x.status === 'pending' ? 'chờ duyệt' : 'bị từ chối'}`} />)}
          </View>
          {j.description ? <Txt size={14} color={c.muc2}>{j.description}</Txt> : null}
          {shared?.review_note ? <Inset style={{ backgroundColor: c.sonNhat }}><Txt size={13} color={c.sonChu}>Lý do từ chối: {shared.review_note}</Txt></Inset> : null}
          {j.problems.length && j.can_edit ? (
            <Inset style={{ backgroundColor: c.vangNhat, gap: 4 }}>
              <Txt f="bold" size={14} color={c.vangChu}>Chưa đủ điều kiện để phát hành / giao cho lớp:</Txt>
              {j.problems.map((p) => <Txt key={p} size={13} color={c.vangChu}>• {p}</Txt>)}
            </Inset>
          ) : null}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {j.can_edit ? <Btn icon={Plus} title="Thêm nút" tone="son" size="sm" onPress={() => setNodeForm({})} testID="journey-add-node" /> : null}
            {j.can_edit && role !== 'teacher' ? <Btn icon={Rocket} title={j.status === 'published' ? 'Gỡ phát hành' : 'Phát hành'} tone={j.status === 'published' ? 'giay' : 'ngoc'} size="sm" loading={busy} disabled={j.is_default && j.status === 'published'}
              onPress={async () => { const next = await run(() => api.setJourneyStatus(token, j.id, j.status === 'published' ? 'draft' : 'published'), j.status === 'published' ? 'Đã gỡ phát hành' : 'Đã phát hành'); if (next) apply(next); }} testID="journey-publish" /> : null}
            {role === 'root_admin' && j.scope === 'system' ? <Btn icon={Star} title={j.is_default ? 'Bỏ mặc định' : 'Đặt làm mặc định'} tone="giay" size="sm" loading={busy} disabled={!j.is_default && j.status !== 'published'}
              onPress={async () => { const next = await run(() => api.setJourneyDefault(token, j.id, !j.is_default), j.is_default ? 'Đã bỏ mặc định' : 'Đã đặt làm hành trình mặc định'); if (next) apply(next); }} testID="journey-default" /> : null}
            {role === 'teacher' && j.can_edit ? <Btn icon={Users} title="Giao cho lớp" tone="ngoc" size="sm" onPress={() => setAssign(true)} testID="journey-assign" /> : null}
            {shareTarget ? <Btn icon={Send} title={shareTarget === 'school' ? 'Gửi vào kho của trường' : 'Đề xuất lên kho hệ thống'} tone="giay" size="sm" loading={busy} disabled={shared?.status === 'pending'}
              onPress={async () => { if (await run(() => api.requestShare(token, 'journey', j.id, shareTarget), 'Đã gửi đi duyệt')) detail.reload(); }} /> : null}
            {j.can_edit ? <Btn icon={Trash2} title="Xóa hành trình" tone="giay" size="sm" onPress={() => setDeleting(true)} /> : null}
          </View>

          {role === 'teacher' && j.classes.length ? (
            <Card flat pad={12} style={{ gap: 6 }}>
              <Txt f="bold" size={14}>Đang giao cho lớp</Txt>
              {j.classes.map((k) => (
                <View key={k.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Txt size={14} style={{ flex: 1 }}>{k.name} · {k.school_year} · {k.students} học sinh</Txt>
                  <Btn title="Hủy giao" tone="giay" size="sm" onPress={async () => { const next = await run(() => api.unassignJourney(token, j.id, k.id), 'Đã hủy giao'); if (next) apply(next); }} />
                </View>
              ))}
            </Card>
          ) : null}

          <Txt f="bold" size={16}>Các nút trên bản đồ ({j.nodes.length})</Txt>
          <DataTable<JourneyNode> rows={j.nodes} rowKey={(n) => n.id} empty="Hành trình chưa có nút nào. Bấm “Thêm nút” để bắt đầu." onRowPress={j.can_edit ? (n) => setNodeForm({ node: n }) : undefined}
            columns={[
              { key: 'pos', label: '#', flex: 0.3, render: (n) => <Txt f="bold" size={14}>{n.position}</Txt> },
              { key: 'title', label: 'Nút', flex: 3, render: (n) => <Cell main={n.title} sub={[n.kind_label, n.lesson_title && n.lesson_title !== n.title ? n.lesson_title : null, n.quiz_title ? `${n.quiz_title} (${n.quiz_questions ?? 0} câu)` : null, n.battle_name, n.source_title && n.source_title !== n.title ? n.source_title : null].filter(Boolean).join(' · ')} /> },
              { key: 'rule', label: 'Điều kiện / thưởng', flex: 1.5, render: (n) => <Txt size={13}>+{n.reward_points} điểm{n.pass_percent ? ` · đạt ${n.pass_percent}%` : ''}</Txt> },
              { key: 'unlock', label: 'Mở khóa', flex: 1.5, hideOnCard: !j.nodes.some((n) => n.unlocks.length), render: (n) => <Txt size={13}>{n.unlocks.map((u) => u.title).join(', ') || '—'}</Txt> },
              { key: 'state', label: 'Trạng thái', flex: 1.3, render: (n) => (nodeWarn(n) ? <StatusChip kind="warn" text={nodeWarn(n)} /> : <StatusChip kind="on" text={n.completed ? `${n.completed} học sinh đã xong` : 'Sẵn sàng'} />) },
            ]}
            actions={j.can_edit ? (n) => (
              <>
                <Btn icon={ArrowUp} label={`Đưa nút ${n.position} lên`} tone="giay" size="sm" disabled={n.position === 1 || busy} onPress={() => move(n.position - 1, -1)} />
                <Btn icon={ArrowDown} label={`Đưa nút ${n.position} xuống`} tone="giay" size="sm" disabled={n.position === j.nodes.length || n.kind === 'final' || busy} onPress={() => move(n.position - 1, 1)} />
                <Btn icon={Trash2} label={`Xóa nút ${n.position}`} tone="giay" size="sm" onPress={() => setRemoving(n)} />
              </>
            ) : undefined} />
        </>
      ) : null}
      {nodeForm && j ? <NodeForm session={session} journey={j} node={nodeForm.node} onClose={() => setNodeForm(null)} onSaved={(next) => { setNodeForm(null); apply(next); }} /> : null}
      {meta && j ? (
        <FormSheet title="Thông tin hành trình" fields={[
          { name: 'title', label: 'Tên hành trình', required: true }, { name: 'description', label: 'Mô tả', type: 'textarea' },
          { name: 'campaign_id', label: 'Cuộc kháng chiến', type: 'select', options: campaigns.slice(1), readOnly: j.nodes.length > 0, hint: j.nodes.length ? 'Không đổi được khi đã có nút' : undefined },
          { name: 'background_url', label: 'Ảnh nền bản đồ (liên kết https)' },
        ]} initial={{ title: j.title, description: j.description ?? '', campaign_id: String(j.campaign_id), background_url: j.background_url ?? '' }}
          onClose={() => setMeta(false)} onSubmit={async (v) => { apply(await api.updateJourney(token, j.id, { title: v.title, description: String(v.description).trim() || null, campaign_id: Number(v.campaign_id), background_url: String(v.background_url).trim() || null })); setMeta(false); }} />
      ) : null}
      {assign && j ? (
        <FormSheet title="Giao hành trình cho lớp" subtitle="Học sinh trong lớp sẽ học theo hành trình này thay cho hành trình mặc định của hệ thống. Hành trình tự phát hành khi giao."
          fields={[{ name: 'class_ids', label: 'Lớp phụ trách', type: 'multi', required: true, options: (classes.data ?? []).map((k) => ({ value: String(k.id), label: `${k.name} · ${k.school_year} · ${k.students} học sinh` })) }]}
          initial={{ class_ids: idsToValues(j.classes.map((k) => k.id)) }} submitLabel="Giao" onClose={() => setAssign(false)}
          onSubmit={async (v) => { apply(await api.assignJourney(token, j.id, valuesToIds(v.class_ids))); setAssign(false); }} />
      ) : null}
      <ConfirmSheet open={!!removing} title="Xóa nút?" message={`Xóa nút “${removing?.title ?? ''}”. Chỉ xóa được nút chưa có học sinh hoàn thành.`} confirmLabel="Xóa nút" busy={busy}
        onCancel={() => setRemoving(null)} onConfirm={async () => { if (removing) { const next = await run(() => api.removeNode(token, removing.id), 'Đã xóa nút'); setRemoving(null); if (next) apply(next); } }} />
      <ConfirmSheet open={deleting} title="Xóa hành trình?" message="Hành trình bị xóa vĩnh viễn. Hệ thống chỉ cho xóa hành trình chưa giao cho lớp và chưa có học sinh học." confirmLabel="Xóa" busy={busy}
        onCancel={() => setDeleting(false)} onConfirm={async () => { const ok = await run(async () => { await api.deleteJourney(token, id); return true; }, 'Đã xóa hành trình'); setDeleting(false); if (ok) { onChanged(); onBack(); } }} />
    </Page>
  );
};

// ---------------------------------------------------------------------- thư viện
export const JourneyManager: React.FC<{ session: Session; onPreview?: (j: JourneyDetail) => void }> = ({ session, onPreview }) => {
  const role = session.user.role;
  const [store, setStore] = useState('all');
  const [q, setQ] = useState('');
  const [campaign, setCampaign] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const term = useDebounced(q.trim(), 300);
  const campaigns = useCampaignOptions(session);
  const list = useLoad(() => api.listJourneys(session.token, { store, q: term, campaign_id: campaign }), [session.token, store, term, campaign], session.expired);
  const templates = useMemo(() => (list.data ?? []).filter((x) => x.node_count > 0), [list.data]);
  if (open !== null) return <JourneyEditor session={session} id={open} onBack={() => setOpen(null)} onChanged={list.reload} onPreview={onPreview} />;
  const title = role === 'teacher' ? 'Hành trình học' : role === 'school_admin' ? 'Hành trình mẫu của trường' : 'Hành trình mẫu của hệ thống';
  return (
    <Page>
      <PageHeader title={title} subtitle={role === 'teacher' ? 'Xem hành trình mẫu của hệ thống và của trường, tạo hành trình riêng cho lớp (từ mẫu hoặc trống), rồi giao cho lớp.' : role === 'school_admin' ? 'Xem, sửa, xóa hành trình mẫu dùng chung trong trường; duyệt hành trình giáo viên chia sẻ ở mục Duyệt nội dung.' : 'Hành trình mẫu cho ba cuộc kháng chiến. Học sinh chưa được giáo viên giao hành trình sẽ học theo hành trình mặc định đã phát hành.'}
        actions={<Btn icon={Plus} title="Tạo hành trình" tone="son" size="sm" onPress={() => setCreating(true)} testID="journey-create" />} />
      <FilterBar>
        <FilterBox><AdminSelect label="Kho" value={store} onChange={setStore}
          options={role === 'root_admin' ? [{ value: 'all', label: 'Hệ thống và đề xuất' }, { value: 'system', label: 'Kho hệ thống' }, { value: 'school', label: 'Kho của các trường' }]
            : [{ value: 'all', label: 'Tất cả' }, { value: 'mine', label: role === 'teacher' ? 'Của tôi' : 'Soạn bởi tôi' }, { value: 'school', label: 'Kho của trường' }, { value: 'system', label: 'Kho hệ thống' }]} /></FilterBox>
        <FilterBox><AdminSelect label="Cuộc kháng chiến" value={campaign} options={[{ value: '', label: 'Tất cả' }, ...campaigns.slice(1)]} onChange={setCampaign} /></FilterBox>
        <FilterBox flex={2}><Field label="Tìm hành trình" value={q} onChangeText={setQ} /></FilterBox>
      </FilterBar>
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner /> : null}
      {list.data ? (
        <DataTable<JourneyItem> rows={list.data} rowKey={(r) => r.id} onRowPress={(r) => setOpen(r.id)} empty="Chưa có hành trình nào"
          columns={[
            { key: 'title', label: 'Hành trình', flex: 3, render: (r) => <Cell main={r.title} sub={r.campaign_title} /> },
            { key: 'scope', label: 'Kho', flex: 1.2, render: (r) => <ScopeChip scope={r.scope} /> },
            { key: 'status', label: 'Trạng thái', flex: 1.2, render: (r) => <StatusChip kind={r.is_default ? 'info' : r.status === 'published' ? 'on' : 'muted'} text={r.is_default ? 'Mặc định' : r.status === 'published' ? 'Đã phát hành' : 'Nháp'} /> },
            { key: 'nodes', label: 'Số nút', flex: 0.7, render: (r) => <Txt size={13}>{r.node_count}</Txt> },
            { key: 'use', label: 'Đang dùng', flex: 1.2, render: (r) => <Txt size={13}>{r.classes} lớp · {r.learners} học sinh</Txt> },
            { key: 'owner', label: 'Người soạn', flex: 1.2, hideOnCard: true, render: (r) => <Txt size={13}>{r.owner_name ?? '—'}</Txt> },
          ]} />
      ) : null}
      {creating ? (
        <FormSheet title="Tạo hành trình" subtitle="Chọn cuộc kháng chiến, có thể bắt đầu từ một hành trình mẫu để sao các nút sang."
          fields={[
            { name: 'title', label: 'Tên hành trình', required: true }, { name: 'description', label: 'Mô tả', type: 'textarea' },
            { name: 'campaign_id', label: 'Cuộc kháng chiến', type: 'select', required: true, options: [{ value: '', label: '— Chọn cuộc kháng chiến —' }, ...campaigns.slice(1)] },
            { name: 'template_id', label: 'Tạo từ hành trình mẫu (tùy chọn)', type: 'select', options: [{ value: '', label: 'Tạo trống' }, ...templates.map((t) => ({ value: String(t.id), label: `${t.title} (${t.campaign_title}, ${t.node_count} nút)` }))],
              hint: 'Chỉ chọn mẫu cùng cuộc kháng chiến với hành trình mới.' },
            { name: 'background_url', label: 'Ảnh nền bản đồ (liên kết https, tùy chọn)' },
          ]}
          onClose={() => setCreating(false)}
          onSubmit={async (v) => {
            const made = await api.createJourney(session.token, { title: v.title, description: String(v.description).trim() || null, campaign_id: Number(v.campaign_id), template_id: v.template_id ? Number(v.template_id) : null, background_url: String(v.background_url).trim() || null });
            setCreating(false);
            list.reload();
            setOpen(made.id);
          }} />
      ) : null}
    </Page>
  );
};
