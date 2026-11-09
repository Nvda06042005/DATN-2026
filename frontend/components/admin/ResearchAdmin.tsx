/**
 * Nghiên cứu hiệu quả trò chơi hóa và AI cho quản trị tổng (Sprint 12): quản lý mẫu khảo sát dùng chung (HK.AD.070), thiết lập nhóm thử nghiệm và gán lớp (HK.AD.078),
 * báo cáo so sánh các nhóm có kiểm định thống kê (HK.AD.079) và xuất dữ liệu học tập ẩn danh dạng CSV (HK.AD.077). Dữ liệu xuất ra không có tên hay tài khoản.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { Pencil, Plus, Trash2 } from 'lucide-react-native';
import * as api from '@/api/platformApi';
import { AdminSelect } from '@/components/admin/AdminSelect';
import { Cell, DataTable, DownloadButton, ErrorNote, FilterBar, FilterBox, FormSheet, Page, PageHeader, StatusChip, useAction, useLoad } from '@/components/admin/kit';
import { QuestionEditor } from '@/components/admin/PlatformComms';
import type { Session } from '@/components/auth';
import { StatGrid, StatTile } from '@/components/charts';
import { Bar, Btn, Card, Chip, ConfirmSheet, Field, InfoNote, Segmented, Sheet, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { Comparison, ExperimentClass, ExperimentGroup, Question, SurveyTemplate } from '@/types/platform';

type Part = 'templates' | 'groups' | 'compare' | 'export';
const AUDIENCE_TEXT = { student: 'Học sinh', teacher: 'Giáo viên', both: 'Học sinh và giáo viên' } as const;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const fmt = (v: number | null | undefined, digits = 1): string => (v === null || v === undefined ? '–' : v.toLocaleString('vi-VN', { maximumFractionDigits: digits }));

// ---------------------------------------------------------------------- mẫu khảo sát (HK.AD.070)
const TemplateSheet: React.FC<{ session: Session; tpl: SurveyTemplate | null; onClose: () => void; onSaved: () => void }> = ({ session, tpl, onClose, onSaved }) => {
  const { busy, run } = useAction(session.expired);
  const [title, setTitle] = useState(tpl?.title ?? '');
  const [description, setDescription] = useState(tpl?.description ?? '');
  const [audience, setAudience] = useState<'student' | 'teacher' | 'both'>(tpl?.audience ?? 'student');
  const [active, setActive] = useState(tpl?.is_active ?? true);
  const [questions, setQuestions] = useState<Question[]>(tpl?.questions.map((q) => ({ ...q })) ?? [{ id: 'q1', type: 'likert5', text: '', required: true }]);
  const ready = title.trim().length >= 3 && questions.length > 0 && questions.every((q) => q.text.trim().length >= 3 && (q.type !== 'single' && q.type !== 'multi' ? true : (q.options ?? []).filter((o) => o.trim()).length >= 2));
  const save = async () => {
    const out = await run(() => api.saveSurveyTemplate(session.token, tpl?.id || null, {
      title: title.trim(), description: description.trim() || null, audience, is_active: active,
      questions: questions.map((q, i) => ({ ...q, id: `q${i + 1}`, text: q.text.trim(), options: q.options?.map((o) => o.trim()).filter(Boolean) })),
    }), 'Đã lưu mẫu khảo sát');
    if (out) { onSaved(); onClose(); }
  };
  return (
    <Sheet open onClose={onClose} wide title={tpl ? 'Sửa mẫu khảo sát' : 'Thêm mẫu khảo sát'} subtitle="Khảo sát đã gửi giữ bản chụp câu hỏi nên sửa mẫu không làm đổi khảo sát cũ"
      footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}><Btn title="Hủy" tone="giay" onPress={onClose} /><Btn title="Lưu mẫu" tone="son" loading={busy} disabled={!ready} onPress={save} testID="tpl-survey-save" /></View>}>
      <View style={{ gap: 14 }}>
        <Field label="Tiêu đề" value={title} onChangeText={setTitle} maxLength={160} nativeID="stpl-title" />
        <Field label="Giới thiệu ngắn" value={description} onChangeText={setDescription} multiline numberOfLines={2} maxLength={600} inputStyle={{ minHeight: 60, textAlignVertical: 'top' }} />
        <Segmented<'student' | 'teacher' | 'both'> label="Đối tượng" value={audience} onChange={setAudience} options={[{ value: 'student', label: 'Học sinh' }, { value: 'teacher', label: 'Giáo viên' }, { value: 'both', label: 'Cả hai' }]} />
        <Segmented<'on' | 'off'> label="Cho trường dùng" value={active ? 'on' : 'off'} onChange={(v) => setActive(v === 'on')} options={[{ value: 'on', label: 'Đang dùng' }, { value: 'off', label: 'Tạm ẩn' }]} />
        <Txt f="bold" size={15} accessibilityRole="header">Câu hỏi ({questions.length}/30)</Txt>
        {questions.map((q, i) => <QuestionEditor key={i} q={q} index={i} onChange={(nq) => setQuestions(questions.map((x, j) => (j === i ? nq : x)))} onRemove={() => setQuestions(questions.filter((_, j) => j !== i))} />)}
        <View style={{ flexDirection: 'row' }}><Btn icon={Plus} title="Thêm câu hỏi" tone="giay" size="sm" disabled={questions.length >= 30} onPress={() => setQuestions([...questions, { id: `q${questions.length + 1}`, type: 'likert5', text: '', required: true }])} /></View>
      </View>
    </Sheet>
  );
};

const Templates: React.FC<{ session: Session }> = ({ session }) => {
  const list = useLoad(() => api.surveyTemplates(session.token), [session.token], session.expired);
  const { busy, run } = useAction(session.expired);
  const [edit, setEdit] = useState<SurveyTemplate | 'new' | null>(null);
  const [remove, setRemove] = useState<SurveyTemplate | null>(null);
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row' }}><Btn icon={Plus} title="Thêm mẫu" tone="son" onPress={() => setEdit('new')} testID="stpl-new" /></View>
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner /> : null}
      {list.data ? (
        <DataTable<SurveyTemplate> rows={list.data} rowKey={(t) => t.id} empty="Chưa có mẫu nào." onRowPress={(r) => setEdit(r.can_edit ? r : {...r,id:0})}
          columns={[
            { key: 't', label: 'Mẫu', flex: 3, render: (t) => <Cell main={t.title} sub={t.description} /> },
            { key: 'a', label: 'Đối tượng', render: (t) => <Txt size={13}>{AUDIENCE_TEXT[t.audience]}</Txt> },
            { key: 'q', label: 'Số câu', render: (t) => <Txt size={13}>{t.questions.length}</Txt> },
            { key: 's', label: 'Trạng thái', render: (t) => <StatusChip kind={t.is_active ? 'on' : 'muted'} text={t.is_active ? 'Đang dùng' : 'Tạm ẩn'} /> },
          ]}
          actions={(t) => t.can_edit ? <><Btn icon={Pencil} label={`Sửa mẫu ${t.title}`} tone="giay" size="sm" onPress={() => setEdit(t)} /><Btn icon={Trash2} label={`Xóa mẫu ${t.title}`} tone="giay" size="sm" onPress={() => setRemove(t)} /></> : <Btn icon={Plus} title="Tạo bản riêng" tone="giay" size="sm" onPress={()=>setEdit({...t,id:0})} />} actionsWidth={110} />
      ) : null}
      {edit ? <TemplateSheet session={session} tpl={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={() => list.reload()} /> : null}
      <ConfirmSheet open={Boolean(remove)} title="Xóa mẫu khảo sát?" message={`Mẫu “${remove?.title}” sẽ bị xóa; các khảo sát đã tạo từ mẫu này không bị ảnh hưởng.`} confirmLabel="Xóa" tone="son" busy={busy} onCancel={() => setRemove(null)}
        onConfirm={async () => { const t = remove!; if (await run(() => api.deleteSurveyTemplate(session.token, t.id), 'Đã xóa mẫu')) { setRemove(null); list.reload(); } }} />
    </View>
  );
};

// ---------------------------------------------------------------------- nhóm thử nghiệm (HK.AD.078)
const GROUP_FIELDS = [
  { name: 'name', label: 'Tên nhóm', required: true },
  { name: 'description', label: 'Mô tả (không bắt buộc)', type: 'textarea' as const },
  { name: 'gamification', label: 'Trò chơi hóa (cửa hàng, xếp hạng, thẻ, huy hiệu, nhiệm vụ, game thẻ tướng)', type: 'select' as const, options: [{ value: 'true', label: 'Có' }, { value: 'false', label: 'Không' }] },
  { name: 'ai', label: 'AI (Tiểu Tướng và gợi ý học tập)', type: 'select' as const, options: [{ value: 'true', label: 'Có' }, { value: 'false', label: 'Không' }] },
];

const Groups: React.FC<{ session: Session }> = ({ session }) => {
  const { c } = useTheme();
  const groups = useLoad(() => api.experimentGroups(session.token), [session.token], session.expired);
  const classes = useLoad(() => api.experimentClasses(session.token), [session.token], session.expired);
  const { busy, run } = useAction(session.expired);
  const [edit, setEdit] = useState<ExperimentGroup | 'new' | null>(null);
  const [remove, setRemove] = useState<ExperimentGroup | null>(null);
  const [assign, setAssign] = useState<ExperimentClass | null>(null);
  const reload = () => { groups.reload(); classes.reload(); };
  return (
    <View style={{ gap: 14 }}>
      <InfoNote><Txt size={14}>Lớp thuộc nhóm “không trò chơi hóa” thì học sinh không thấy cửa hàng, xếp hạng, thẻ, huy hiệu, nhiệm vụ, quà và game thẻ tướng; lớp thuộc nhóm “không AI” thì không dùng được Tiểu Tướng và gợi ý học tập. Học và làm bài vẫn bình thường và điểm vẫn được ghi để so sánh. Nên gán lớp ngẫu nhiên và xin phép nhà trường, phụ huynh trước khi thử nghiệm.</Txt></InfoNote>
      <View style={{ flexDirection: 'row' }}><Btn icon={Plus} title="Thêm nhóm" tone="son" onPress={() => setEdit('new')} testID="group-new" /></View>
      <ErrorNote message={groups.error ?? classes.error} />
      {groups.loading && !groups.data ? <Spinner /> : null}
      {groups.data ? (
        <DataTable<ExperimentGroup> rows={groups.data} rowKey={(g) => g.id} empty="Chưa có nhóm nào. Thêm nhóm “Đối chứng” (không trò chơi hóa, không AI) và nhóm “Thử nghiệm”." onRowPress={(g)=>{if(g.can_edit)setEdit(g);}}
          columns={[
            { key: 'n', label: 'Nhóm', flex: 2, render: (g) => <Cell main={g.name} sub={g.description} /> },
            { key: 'g', label: 'Trò chơi hóa', render: (g) => <StatusChip kind={g.gamification ? 'on' : 'muted'} text={g.gamification ? 'Có' : 'Không'} /> },
            { key: 'a', label: 'AI', render: (g) => <StatusChip kind={g.ai ? 'on' : 'muted'} text={g.ai ? 'Có' : 'Không'} /> },
            { key: 'c', label: 'Lớp / học sinh', render: (g) => <Txt size={13}>{g.classes} lớp · {g.students} học sinh</Txt> },
          ]}
          actions={(g) => g.can_edit ? <><Btn icon={Pencil} label={`Sửa nhóm ${g.name}`} tone="giay" size="sm" onPress={() => setEdit(g)} /><Btn icon={Trash2} label={`Xóa nhóm ${g.name}`} tone="giay" size="sm" onPress={() => setRemove(g)} /></> : null} actionsWidth={110} />
      ) : null}
      <Txt f="bold" size={16} accessibilityRole="header">Gán lớp vào nhóm</Txt>
      {classes.data ? (
        <DataTable<ExperimentClass> rows={classes.data} rowKey={(x) => x.id} empty="Chưa có lớp nào đang hoạt động." onRowPress={setAssign}
          columns={[
            { key: 's', label: 'Trường', flex: 1.5, render: (x) => <Txt size={13}>{x.school_name}</Txt> },
            { key: 'c', label: 'Lớp', render: (x) => <Cell main={x.name} sub={`${x.students} học sinh`} /> },
            { key: 'g', label: 'Nhóm', flex: 1.4, render: (x) => (x.group_name ? <Chip text={x.group_name} bg={c.thuyNhat} fg={c.thuyChu} /> : <Txt size={13} color={c.muc3}>Chưa gán</Txt>) },
          ]} actions={(x) => <Btn title="Gán nhóm" tone="giay" size="sm" onPress={() => setAssign(x)} testID={`assign-${x.id}`} />} actionsWidth={110} />
      ) : null}
      {edit ? (
        <FormSheet title={edit === 'new' ? 'Thêm nhóm thử nghiệm' : 'Sửa nhóm thử nghiệm'} fields={GROUP_FIELDS} onClose={() => setEdit(null)}
          initial={edit === 'new' ? { gamification: 'true', ai: 'true' } : { name: edit.name, description: edit.description ?? '', gamification: String(edit.gamification), ai: String(edit.ai) }}
          onSubmit={async (v) => { await api.saveExperimentGroup(session.token, edit === 'new' ? null : edit.id, { name: String(v.name).trim(), description: String(v.description).trim() || null, gamification: v.gamification === 'true', ai: v.ai === 'true' }); setEdit(null); reload(); }} />
      ) : null}
      {assign ? (
        <Sheet open onClose={() => setAssign(null)} title={`Gán nhóm cho lớp ${assign.name}`} subtitle={assign.school_name}>
          <View style={{ gap: 8 }}>
            {[{ id: null as number | null, name: 'Không thuộc nhóm nào' }, ...(groups.data ?? [])].map((g) => (
              <Btn key={g.id ?? 'none'} title={g.name} tone={assign.group_id === g.id ? 'son' : 'giay'} loading={busy} onPress={async () => { if (await run(() => api.assignClass(session.token, assign.id, g.id), 'Đã cập nhật nhóm của lớp')) { setAssign(null); reload(); } }} testID={`assign-group-${g.id ?? 'none'}`} />
            ))}
          </View>
        </Sheet>
      ) : null}
      <ConfirmSheet open={Boolean(remove)} title="Xóa nhóm?" message={`Nhóm “${remove?.name}” sẽ bị xóa; ${remove?.classes ?? 0} lớp đang thuộc nhóm trở về bình thường (có đầy đủ trò chơi hóa và AI).`} confirmLabel="Xóa nhóm" tone="son" busy={busy} onCancel={() => setRemove(null)}
        onConfirm={async () => { const g = remove!; if (await run(() => api.deleteExperimentGroup(session.token, g.id), 'Đã xóa nhóm')) { setRemove(null); reload(); } }} />
    </View>
  );
};

// ---------------------------------------------------------------------- báo cáo so sánh (HK.AD.079)
const Compare: React.FC<{ session: Session }> = ({ session }) => {
  const { c } = useTheme();
  const groups = useLoad(() => api.experimentGroups(session.token), [session.token], session.expired);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [control, setControl] = useState(0);
  const bad = (from && !DATE.test(from)) || (to && !DATE.test(to));
  const data = useLoad<Comparison | null>(() => (bad ? Promise.resolve(null) : api.researchCompare(session.token, { from: from || undefined, to: to || undefined, control: control || undefined })), [session.token, from, to, control, bad], session.expired);
  const d = data.data;
  const unit = (k: string): string => d?.metrics.find((m) => m.key === k)?.unit ?? '';
  return (
    <View style={{ gap: 14 }}>
      <FilterBar>
        <FilterBox><AdminSelect<number> label="Nhóm đối chứng" value={control} onChange={setControl} options={[{ value: 0, label: 'Tự chọn (nhóm không trò chơi hóa và không AI)' }, ...(groups.data ?? []).map((g) => ({ value: g.id, label: g.name }))] } testID="compare-control" /></FilterBox>
        <FilterBox><Field label="Từ ngày" value={from} onChangeText={setFrom} placeholder="VD: 2026-09-05" autoCapitalize="none" error={from && !DATE.test(from) ? 'Dạng năm-tháng-ngày' : null} nativeID="compare-from" /></FilterBox>
        <FilterBox><Field label="Đến ngày" value={to} onChangeText={setTo} placeholder="VD: 2026-12-31" autoCapitalize="none" error={to && !DATE.test(to) ? 'Dạng năm-tháng-ngày' : null} nativeID="compare-to" /></FilterBox>
      </FilterBar>
      <ErrorNote message={data.error} />
      {data.loading && !d ? <Spinner /> : null}
      {d && !d.groups.length ? <InfoNote><Txt size={14}>Chưa có nhóm nào. Hãy tạo nhóm và gán lớp ở mục “Nhóm thử nghiệm”.</Txt></InfoNote> : null}
      {d?.groups.length ? (
        <>
          <StatGrid>{d.groups.map((g) => <StatTile key={g.id} label={g.name + (g.is_control ? ' (đối chứng)' : '')} value={`${g.students} học sinh`} hint={`${g.gamification ? 'Có' : 'Không'} trò chơi hóa · ${g.ai ? 'Có' : 'Không'} AI`} tone={g.is_control ? 'vang' : 'thuy'} />)}</StatGrid>
          {d.metrics.map((m) => {
            const max = Math.max(1, ...d.groups.map((g) => (g.metrics[m.key]?.mean ?? 0)));
            return (
              <Card key={m.key} pad={14} style={{ gap: 12 }}>
                <Txt f="bold" size={16} accessibilityRole="header">{m.label} <Txt size={13} color={c.muc3}>({unit(m.key)})</Txt></Txt>
                {d.groups.map((g) => {
                  const s = g.metrics[m.key], w = g.vs_control?.[m.key] ?? null;
                  return (
                    <View key={g.id} style={{ gap: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Txt f="semibold" size={14} style={{ flex: 1, minWidth: 140 }}>{g.name}</Txt>
                        <Txt size={13}>TB <Txt f="bold" size={13}>{fmt(m.key === 'participation' && s?.mean !== null && s?.mean !== undefined ? s.mean * 100 : s?.mean)}{m.key === 'participation' ? '%' : ''}</Txt> · độ lệch {fmt(s?.sd)} · n = {s?.n ?? 0}</Txt>
                      </View>
                      <Bar value={s?.mean ?? 0} max={max} fill={g.is_control ? c.vang : c.thuy} height={10} label={`${g.name}: trung bình ${fmt(s?.mean)}`} />
                      {w ? (
                        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <Txt size={13}>So với đối chứng: <Txt f="bold" size={13}>{w.diff >= 0 ? '+' : ''}{fmt(m.key === 'participation' ? w.diff * 100 : w.diff)}{m.key === 'participation' ? ' điểm %' : ''}</Txt> · p = {w.p === null ? 'chưa tính được' : fmt(w.p, 4)} · d = {fmt(w.cohen_d, 2)}</Txt>
                          {w.p !== null ? <StatusChip kind={w.p < 0.05 ? 'on' : 'muted'} text={w.p < 0.05 ? 'Khác biệt có ý nghĩa thống kê' : 'Chưa đủ bằng chứng khác biệt'} /> : null}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </Card>
            );
          })}
          <InfoNote><View style={{ gap: 4 }}>{d.notes.map((n, i) => <Txt key={i} size={13}>• {n}</Txt>)}</View></InfoNote>
        </>
      ) : null}
    </View>
  );
};

// ---------------------------------------------------------------------- xuất dữ liệu (HK.AD.077)
const Export: React.FC<{ session: Session }> = ({ session }) => {
  const groups = useLoad(() => api.experimentGroups(session.token), [session.token], session.expired);
  const dict = useLoad(() => api.researchDictionary(session.token), [session.token], session.expired);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [group, setGroup] = useState(0);
  const bad = (from && !DATE.test(from)) || (to && !DATE.test(to));
  return (
    <View style={{ gap: 14 }}>
      <InfoNote><Txt size={14}>Tệp CSV chỉ gồm học sinh thuộc lớp đã gán nhóm; mỗi dòng một học sinh với mã ẩn danh. Không có tên, tên đăng nhập, email, mã học sinh hay tên trường. Cần được nhà trường và phụ huynh đồng ý trước khi dùng dữ liệu cho nghiên cứu.</Txt></InfoNote>
      <FilterBar>
        <FilterBox><AdminSelect<number> label="Nhóm" value={group} onChange={setGroup} options={[{ value: 0, label: 'Tất cả nhóm' }, ...(groups.data ?? []).map((g) => ({ value: g.id, label: g.name }))]} /></FilterBox>
        <FilterBox><Field label="Từ ngày" value={from} onChangeText={setFrom} placeholder="VD: 2026-09-05" autoCapitalize="none" error={from && !DATE.test(from) ? 'Dạng năm-tháng-ngày' : null} nativeID="export-from" /></FilterBox>
        <FilterBox><Field label="Đến ngày" value={to} onChangeText={setTo} placeholder="VD: 2026-12-31" autoCapitalize="none" error={to && !DATE.test(to) ? 'Dạng năm-tháng-ngày' : null} nativeID="export-to" /></FilterBox>
      </FilterBar>
      <View style={{ flexDirection: 'row' }}>
        {bad ? <Txt size={14}>Nhập ngày đúng dạng năm-tháng-ngày để xuất.</Txt>
          : <DownloadButton title="Tải CSV dữ liệu nghiên cứu" fetchBlob={() => api.researchExport(session.token, { from: from || undefined, to: to || undefined, group_id: group || undefined })} filename="du-lieu-nghien-cuu.csv" tone="son" />}
      </View>
      <Txt f="bold" size={16} accessibilityRole="header">Các cột trong tệp</Txt>
      <ErrorNote message={dict.error} />
      {dict.data ? <DataTable rows={dict.data} rowKey={(r) => r.column} empty="" columns={[{ key: 'c', label: 'Cột', render: (r) => <Txt f="semibold" size={13}>{r.column}</Txt> }, { key: 'm', label: 'Ý nghĩa', flex: 4, render: (r) => <Txt size={13}>{r.meaning}</Txt> }]} /> : null}
    </View>
  );
};

export const ResearchAdmin: React.FC<{ session: Session }> = ({ session }) => {
  const [part, setPart] = useState<Part>('groups');
  return (
    <Page>
      <PageHeader title="Nghiên cứu" subtitle="Mẫu khảo sát, nhóm thử nghiệm, so sánh kết quả và xuất dữ liệu ẩn danh để đánh giá hiệu quả trò chơi hóa và AI" />
      <Segmented<Part> label="Nghiên cứu" value={part} onChange={setPart} options={[{ value: 'groups', label: 'Nhóm thử nghiệm' }, { value: 'compare', label: 'So sánh nhóm' }, { value: 'export', label: 'Xuất dữ liệu' }, { value: 'templates', label: 'Mẫu khảo sát' }]} />
      {part === 'groups' ? <Groups session={session} /> : part === 'compare' ? <Compare session={session} /> : part === 'export' ? <Export session={session} /> : <Templates session={session} />}
    </Page>
  );
};
