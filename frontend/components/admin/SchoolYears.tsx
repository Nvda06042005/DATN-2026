/** Chọn năm; máy chủ áp dụng khung đã xác minh. Không cấu hình/gợi ý ngày ở giao diện. */
import React, { useState } from 'react';
import { View } from 'react-native';
import { Plus } from 'lucide-react-native';
import * as api from '@/api/adminApi';
import { dateText } from '@/components/admin/AccountSheet';
import { Cell, DataTable, ErrorNote, FormSheet, PageHeader, StatusChip, useAction, useLoad, YEAR_TEXT, type FieldDef } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { Btn, ConfirmSheet, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { fmtDay, labelForDate, phaseText, todayVn } from '@/lib/school-terms';
import type { YearItem } from '@/types/api';

const YEAR_KIND = { planned: 'info', active: 'on', ended: 'muted' } as const;
export const SchoolYears: React.FC<{ session: Session; years: YearItem[]; onSelect: (id: string) => void; onChanged: () => void }> = ({ session, years, onSelect, onChanged }) => {
  const { c } = useTheme();
  const { token } = session;
  const today = todayVn();
  const [form, setForm] = useState<{ year: YearItem | null; label: string } | null>(null);
  const [confirm, setConfirm] = useState<{ year: YearItem; action: 'activate' | 'end' } | null>(null);
  const { busy, run } = useAction(session.expired);
  const calendar = useLoad(() => api.schoolYearOptions(token), [token], session.expired);
  const available = (calendar.data?.items ?? []).filter(item => !years.some(y => y.label === item.label));
  const open = (year: YearItem | null) => setForm({ year, label: year?.label ?? available.find(item => item.label === labelForDate(today))?.label ?? available[0]?.label ?? '' });

  const termCell = (y: YearItem, term: 1 | 2) => {
    if (y.calendar_mode === 'national' && y.framework) {
      const weeks = term === 1 ? y.framework.term1_teaching_weeks : y.framework.term2_teaching_weeks;
      const deadline = term === 1 ? y.framework.term1_finish_before : y.framework.term2_finish_before;
      return <View style={{ gap: 3 }}><Txt f="semibold" size={14}>{weeks} tuần thực học</Txt><Txt size={12} color={c.muc2}>Kết thúc trước {fmtDay(deadline)}</Txt></View>;
    }
    const a = y[`term${term}_starts_on`], b = y[`term${term}_ends_on`];
    return a && b ? <Txt size={13}>{fmtDay(a)} → {fmtDay(b)}</Txt> : <Txt size={13} color={c.muc3}>Chưa có lịch riêng</Txt>;
  };
  const options = (calendar.data?.items ?? []).filter(item => item.label === form?.year?.label || !years.some(y => y.label === item.label));
  if (form?.year && !options.some(item => item.label === form.year!.label)) options.push({ label: form.year.label, framework: form.year.framework! });
  const fields: FieldDef[] = [
    { name: 'label', label: 'Năm học', type: 'select', required: true,
      options: (form?.year?.classes ? options.filter(item => item.label === form.year!.label) : options).map(item => ({ value: item.label, label: item.label })) },
    { name: 'year_plan', label: 'Học kỳ', render: values => {
      const f = calendar.data?.items.find(item => item.label === String(values.label))?.framework;
      if (!f) return null;
      return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }} testID="year-framework-preview">
        {([1, 2] as const).map(term => <View key={term} style={{ flexBasis: 220, flexGrow: 1, gap: 6, padding: 14, borderWidth: 1, borderColor: c.adminLine, borderRadius: 8 }}>
          <Txt f="bold" size={15}>Học kỳ {term}</Txt>
          <Txt size={14}>{term === 1 ? f.term1_teaching_weeks : f.term2_teaching_weeks} tuần thực học</Txt>
          <Txt size={13} color={c.muc2}>Kết thúc trước {fmtDay(term === 1 ? f.term1_finish_before : f.term2_finish_before)}</Txt>
        </View>)}
      </View>;
    } },
  ];

  return <>
    <PageHeader title="Năm học" actions={<Btn title="Thêm năm học" icon={Plus} tone="son" size="sm" disabled={calendar.loading || !available.length} onPress={() => open(null)} testID="year-add" />} />
    <ErrorNote message={calendar.error} />
    {calendar.error ? <Btn title="Thử lại" tone="giay" size="sm" onPress={calendar.reload} /> : null}
    <DataTable rows={years} rowKey={y => y.id} empty="Chưa có năm học nào. Hãy thêm năm học đầu tiên." onRowPress={y => onSelect(String(y.id))}
      columns={[
        { key: 'label', label: 'Năm học', flex: 1.3, render: y => <Cell main={y.label} sub={y.calendar_mode === 'national' && y.framework ? `Khai giảng ${fmtDay(y.framework.opening_on)} · kết thúc trước ${fmtDay(y.framework.year_finish_before)}` : `${fmtDay(y.starts_on)} → ${fmtDay(y.ends_on)}`} /> },
        { key: 'term1', label: 'Học kỳ 1', flex: 1.4, render: y => termCell(y, 1) },
        { key: 'term2', label: 'Học kỳ 2', flex: 1.4, render: y => termCell(y, 2) },
        { key: 'status', label: 'Trạng thái', flex: 1.3, render: y => <View style={{ gap: 4, alignItems: 'flex-start' }}><StatusChip kind={YEAR_KIND[y.status]} text={YEAR_TEXT[y.status]} />{y.status === 'active' ? <Txt size={12} color={c.muc2}>{phaseText(y, today)}</Txt> : null}</View> },
        { key: 'classes', label: 'Số lớp', flex: 0.6, render: y => <Txt size={14}>{y.classes ?? 0}</Txt> },
        { key: 'ended', label: 'Kết thúc lúc', flex: 1, hideOnCard: true, render: y => <Txt size={13} color={c.muc2}>{y.ended_at ? dateText(y.ended_at) : '—'}</Txt> },
      ]}
      actions={y => <>
        {y.status !== 'ended' ? <Btn title="Sửa" tone="giay" size="sm" onPress={() => open(y)} /> : null}
        {y.status === 'planned' ? <Btn title="Kích hoạt" tone="giay" size="sm" onPress={() => setConfirm({ year: y, action: 'activate' })} /> : null}
        {y.status === 'active' ? <Btn title="Kết thúc" tone="giay" size="sm" onPress={() => setConfirm({ year: y, action: 'end' })} /> : null}
      </>} />
    {form ? <FormSheet title={form.year ? `Sửa năm học ${form.year.label}` : 'Thêm năm học'} submitLabel={form.year ? 'Lưu' : 'Thêm năm học'}
      fields={fields} initial={{ label: form.label }} onClose={() => setForm(null)}
      onSubmit={async values => {
        const label = String(values.label);
        if (!calendar.data?.items.some(item => item.label === label)) throw new Error('Năm học chưa có khung thời gian đã xác minh');
        const body = { label, calendar_mode: 'national' as const };
        if (form.year) await api.updateYear(token, form.year.id, body); else await api.createYear(token, body);
        setForm(null); onChanged();
      }} /> : null}
    <ConfirmSheet open={!!confirm} busy={busy} onCancel={() => setConfirm(null)} confirmLabel={confirm?.action === 'activate' ? 'Kích hoạt' : 'Kết thúc năm học'}
      title={confirm?.action === 'activate' ? 'Kích hoạt năm học' : 'Kết thúc năm học'}
      message={confirm?.action === 'activate' ? `Đặt ${confirm?.year.label} làm năm học đang hoạt động? Mỗi trường chỉ có một năm học đang hoạt động.` : `Kết thúc năm học ${confirm?.year.label}? Sau đó không sửa được lớp, học sinh trong lớp và khối của năm học này; không thể hoàn tác.`}
      onConfirm={async () => { if (confirm && (await run(() => confirm.action === 'activate' ? api.activateYear(token, confirm.year.id) : api.endYear(token, confirm.year.id), 'Đã cập nhật năm học'))) { setConfirm(null); onChanged(); } }} />
  </>;
};
