/**
 * Năm học của trường. Từ 18/11/2026 (yêu cầu người dùng) quản trị trường **tự nhập** năm học và ngày của năm học, hai học kỳ (chọn trên lịch);
 * bỏ việc tự lấy khung của Bộ / Sở (năm học cũ đã theo khung vẫn hiển thị như trước). Bảng có bộ lọc ở mọi cột, cột "Bắt đầu lúc" (lúc kích hoạt,
 * migration 076) và nút gạt trạng thái: gạt bật = kích hoạt, gạt tắt năm đang hoạt động = kết thúc (không hoàn tác).
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { Plus } from 'lucide-react-native';
import * as api from '@/api/adminApi';
import { dateText } from '@/components/admin/AccountSheet';
import { Cell, DataTable, distinctValues, FormSheet, PageHeader, YEAR_TEXT, type FieldDef, type SearchFilter } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { ConfirmSheet, Btn, Switch, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useAction } from '@/components/admin/kit';
import { fmtDay, phaseText, todayVn } from '@/lib/school-terms';
import type { YearItem } from '@/types/api';

const DATE_FIELDS = ['starts_on', 'ends_on', 'term1_starts_on', 'term1_ends_on', 'term2_starts_on', 'term2_ends_on'] as const;

export const SchoolYears: React.FC<{ session: Session; years: YearItem[]; onChanged: () => void }> = ({ session, years, onChanged }) => {
  const { c } = useTheme();
  const { token } = session;
  const today = todayVn();
  const [form, setForm] = useState<{ year: YearItem | null } | null>(null);
  const [confirm, setConfirm] = useState<{ year: YearItem; action: 'activate' | 'end' } | null>(null);
  const [col, setCol] = useState<Record<string, string>>({});
  const { busy, run } = useAction(session.expired);

  const termText = (y: YearItem, term: 1 | 2): string => {
    const a = y[`term${term}_starts_on`], b = y[`term${term}_ends_on`];
    if (a && b) return `${fmtDay(a)} → ${fmtDay(b)}`;
    if (y.calendar_mode === 'national' && y.framework) return `${term === 1 ? y.framework.term1_teaching_weeks : y.framework.term2_teaching_weeks} tuần thực học`;
    return 'Chưa có lịch';
  };
  // giá trị từng cột dạng chữ: dùng cho bộ lọc (danh sách giá trị thật của cột)
  const text: Record<string, (y: YearItem) => string> = {
    label: (y) => y.label,
    term1: (y) => termText(y, 1),
    term2: (y) => termText(y, 2),
    status: (y) => YEAR_TEXT[y.status],
    classes: (y) => String(y.classes ?? 0),
    activated: (y) => (y.activated_at ? dateText(y.activated_at) : '—'),
    ended: (y) => (y.ended_at ? dateText(y.ended_at) : '—'),
  };
  const filter = (key: string, label: string): SearchFilter => ({ key, label, value: col[key] ?? '', options: [{ value: '', label: 'Tất cả' }, ...distinctValues(years, text[key])], onChange: (v) => setCol((old) => ({ ...old, [key]: v })) });
  const rows = years.filter((y) => Object.entries(col).every(([k, v]) => !v || text[k](y) === v));

  const editing = form?.year ?? null;
  const fields: FieldDef[] = [
    { name: 'label', label: 'Năm học', required: true, placeholder: 'Ví dụ 2027-2028', readOnly: !!editing?.classes, hint: editing?.classes ? 'Năm học đã có lớp nên không đổi được tên.' : 'Hai năm liên tiếp, dạng 2027-2028.' },
    { name: 'starts_on', label: 'Ngày bắt đầu năm học', type: 'date', calendar: true, required: true, min: '2000-01-01' },
    { name: 'ends_on', label: 'Ngày kết thúc năm học', type: 'date', calendar: true, required: true, min: '2000-01-01' },
    { name: 'term1_starts_on', label: 'Học kỳ 1 – bắt đầu', type: 'date', calendar: true, required: true, min: '2000-01-01' },
    { name: 'term1_ends_on', label: 'Học kỳ 1 – kết thúc', type: 'date', calendar: true, required: true, min: '2000-01-01' },
    { name: 'term2_starts_on', label: 'Học kỳ 2 – bắt đầu', type: 'date', calendar: true, required: true, min: '2000-01-01' },
    { name: 'term2_ends_on', label: 'Học kỳ 2 – kết thúc', type: 'date', calendar: true, required: true, min: '2000-01-01' },
  ];
  const initial = editing ? { label: editing.label, ...Object.fromEntries(DATE_FIELDS.map((k) => [k, String(editing[k] ?? '')])) } : { label: '' };
  const f_label = filter('label', 'Năm học'), f_term1 = filter('term1', 'Học kỳ 1'), f_term2 = filter('term2', 'Học kỳ 2'), f_status = filter('status', 'Trạng thái'),
    f_classes = filter('classes', 'Số lớp'), f_activated = filter('activated', 'Bắt đầu lúc'), f_ended = filter('ended', 'Kết thúc lúc');

  return <>
    <PageHeader title="Năm học" actions={<Btn title="Thêm năm học" icon={Plus} tone="son" size="sm" onPress={() => setForm({ year: null })} testID="year-add" />} />
    <DataTable rows={rows} rowKey={y => y.id} empty="Chưa có năm học nào khớp. Hãy thêm năm học."
      columns={[
        { key: 'label', filter: f_label, label: 'Năm học', flex: 1.3, render: y => <Cell main={y.label} sub={`${fmtDay(y.starts_on)} → ${fmtDay(y.ends_on)}`} /> },
        { key: 'term1', filter: f_term1, label: 'Học kỳ 1', flex: 1.3, render: y => <Txt size={13}>{termText(y, 1)}</Txt> },
        { key: 'term2', filter: f_term2, label: 'Học kỳ 2', flex: 1.3, render: y => <Txt size={13}>{termText(y, 2)}</Txt> },
        { key: 'status', filter: f_status, label: 'Trạng thái', flex: 1.4, render: y => <View style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Switch value={y.status === 'active'} disabled={y.status === 'ended'} testID={`year-active-${y.id}`}
              label={y.status === 'active' ? `${y.label} đang hoạt động. Gạt để kết thúc năm học` : y.status === 'ended' ? `${y.label} đã kết thúc` : `${y.label} chưa bắt đầu. Gạt để kích hoạt`}
              onChange={() => setConfirm({ year: y, action: y.status === 'active' ? 'end' : 'activate' })} />
            <Txt size={13} color={y.status === 'active' ? c.mocChu : c.muc2}>{YEAR_TEXT[y.status]}</Txt>
          </View>
          {y.status === 'active' && phaseText(y, today) ? <Txt size={12} color={c.muc2}>{phaseText(y, today)}</Txt> : null}
        </View> },
        { key: 'classes', filter: f_classes, label: 'Số lớp', flex: 0.6, render: y => <Txt size={14}>{y.classes ?? 0}</Txt> },
        { key: 'activated', filter: f_activated, label: 'Bắt đầu lúc', flex: 1, hideOnCard: true, render: y => <Txt size={13} color={c.muc2}>{y.activated_at ? dateText(y.activated_at) : '—'}</Txt> },
        { key: 'ended', filter: f_ended, label: 'Kết thúc lúc', flex: 1, hideOnCard: true, render: y => <Txt size={13} color={c.muc2}>{y.ended_at ? dateText(y.ended_at) : '—'}</Txt> },
      ]}
      actions={y => (y.status !== 'ended' ? <Btn title="Sửa" tone="giay" size="sm" onPress={() => setForm({ year: y })} testID={`year-edit-${y.id}`} /> : null)} actionsWidth={80} />
    {form ? <FormSheet title={editing ? `Sửa năm học ${editing.label}` : 'Thêm năm học'} subtitle="Tự nhập năm học và chọn ngày trên lịch cho năm học, học kỳ 1, học kỳ 2." submitLabel={editing ? 'Lưu' : 'Thêm năm học'} wide
      fields={fields} initial={initial} onClose={() => setForm(null)}
      onSubmit={async values => {
        const label = String(values.label).trim();
        const m = /^(\d{4})-(\d{4})$/.exec(label);
        if (!m || Number(m[2]) !== Number(m[1]) + 1) throw new Error('Năm học là hai năm liên tiếp, dạng 2027-2028.');
        const body = { label, calendar_mode: 'manual' as const, ...Object.fromEntries(DATE_FIELDS.map((k) => [k, String(values[k] ?? '')])) } as Parameters<typeof api.createYear>[1];
        if (editing) await api.updateYear(token, editing.id, body); else await api.createYear(token, body);
        setForm(null); onChanged();
      }} /> : null}
    <ConfirmSheet open={!!confirm} busy={busy} onCancel={() => setConfirm(null)} confirmLabel={confirm?.action === 'activate' ? 'Kích hoạt' : 'Kết thúc năm học'}
      title={confirm?.action === 'activate' ? 'Kích hoạt năm học' : 'Kết thúc năm học'}
      message={confirm?.action === 'activate' ? `Đặt ${confirm?.year.label} làm năm học đang hoạt động? Mỗi trường chỉ có một năm học đang hoạt động; thời điểm kích hoạt được ghi là "Bắt đầu lúc".` : `Kết thúc năm học ${confirm?.year.label}? Sau đó không sửa được lớp, học sinh trong lớp và khối của năm học này; không thể hoàn tác.`}
      onConfirm={async () => { if (confirm && (await run(() => confirm.action === 'activate' ? api.activateYear(token, confirm.year.id) : api.endYear(token, confirm.year.id), 'Đã cập nhật năm học'))) { setConfirm(null); onChanged(); } }} />
  </>;
};
