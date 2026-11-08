/**
 * Năm học của trường (HK.QT.012) kèm hai học kỳ: bảng năm học có cột Học kỳ 1, Học kỳ 2 và trạng thái theo thời gian ("Đang học kỳ 1 · tuần 10/20"),
 * lời khuyên theo thời điểm hiện tại (tạo năm học mới, đặt học kỳ, kết thúc năm học đã hết hạn) và biểu mẫu tự điền ngày theo khung kế hoạch của Bộ GD&ĐT (xem lib/school-terms.ts).
 */
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Lightbulb, Plus } from 'lucide-react-native';
import * as api from '@/api/adminApi';
import { dateText } from '@/components/admin/AccountSheet';
import { Cell, DataTable, FormSheet, PageHeader, StatusChip, useAction, YEAR_TEXT, type FieldDef } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { Btn, ConfirmSheet, Inset, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { calendarWeeks, checkTerms, fmtDay, hasTerms, isYearLabel, labelForDate, phaseOf, phaseText, suggestTerms, TERM_FRAMEWORK, TERM_KEYS, todayVn, yearAdvice, type SuggestedYear } from '@/lib/school-terms';
import type { YearItem } from '@/types/api';

const YEAR_KIND = { planned: 'info', active: 'on', ended: 'muted' } as const;
type Values = Record<string, string | string[]>;
const DATE_KEYS = ['starts_on', 'ends_on', ...TERM_KEYS] as const;
const str = (values: Values, key: string): string => String(values[key] ?? '').trim();

/** Ô gợi ý ở biểu mẫu: nêu căn cứ của Bộ GD&ĐT và nút điền ngày theo tên năm học; thêm mới thì tự điền lại khi đổi tên năm học và các ô ngày chưa bị sửa */
const TermsAssist: React.FC<{ values: Values; set: (name: string, value: string | string[]) => void; creating: boolean }> = ({ values, set, creating }) => {
  const { c } = useTheme();
  const label = str(values, 'label');
  const suggestion = isYearLabel(label) ? suggestTerms(label, creating ? undefined : { starts_on: str(values, 'starts_on'), ends_on: str(values, 'ends_on') }) : null;
  const last = useRef<SuggestedYear | null>(null);
  const apply = (s: SuggestedYear) => {
    if (creating) { set('starts_on', s.starts_on); set('ends_on', s.ends_on); }
    for (const key of TERM_KEYS) set(key, s[key]);
  };
  useEffect(() => {
    if (!creating || !suggestion) return;
    const prev = last.current;
    const untouched = DATE_KEYS.every((key) => !str(values, key) || (prev !== null && str(values, key) === prev[key]));
    if (untouched) apply(suggestion);
    last.current = suggestion;
  }, [label]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Inset style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Lightbulb size={16} color={c.vangChu} /><Txt f="bold" size={14}>Học kỳ 1 và học kỳ 2</Txt></View>
      <Txt size={13} color={c.muc2}>{TERM_FRAMEWORK.note}</Txt>
      {suggestion ? <Txt size={13}>Gợi ý cho năm học {label}: học kỳ 1 từ {fmtDay(suggestion.term1_starts_on)} đến {fmtDay(suggestion.term1_ends_on)}, học kỳ 2 từ {fmtDay(suggestion.term2_starts_on)} đến {fmtDay(suggestion.term2_ends_on)}.</Txt> : <Txt size={13} color={c.muc3}>Nhập tên năm học dạng 2026-2027 để nhận gợi ý ngày.</Txt>}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn title="Điền theo gợi ý" tone="giay" size="sm" disabled={!suggestion} onPress={() => suggestion && apply(suggestion)} testID="terms-suggest" />
        <Btn title="Xóa học kỳ" tone="giay" size="sm" onPress={() => TERM_KEYS.forEach((key) => set(key, ''))} testID="terms-clear" />
      </View>
    </Inset>
  );
};

/** Kết quả kiểm tra ngay khi nhập: số tuần của từng học kỳ, lỗi chặn (đỏ) và cảnh báo lệch khung của Bộ (vàng) */
const TermsCheck: React.FC<{ values: Values }> = ({ values }) => {
  const { c } = useTheme();
  const v = { starts_on: str(values, 'starts_on'), ends_on: str(values, 'ends_on'), term1_starts_on: str(values, 'term1_starts_on'), term1_ends_on: str(values, 'term1_ends_on'), term2_starts_on: str(values, 'term2_starts_on'), term2_ends_on: str(values, 'term2_ends_on') };
  if (!TERM_KEYS.some((key) => v[key])) return <Txt size={13} color={c.muc3}>Chưa đặt học kỳ: có thể để trống rồi đặt sau.</Txt>;
  const check = checkTerms(v);
  return (
    <View style={{ gap: 4 }} testID="terms-check">
      {check.error ? <Txt size={13} f="semibold" color={c.sonChu}>{check.error}</Txt> : (
        <Txt size={13} color={c.muc2}>Học kỳ 1: {calendarWeeks(v.term1_starts_on, v.term1_ends_on)} tuần · Học kỳ 2: {calendarWeeks(v.term2_starts_on, v.term2_ends_on)} tuần theo lịch (khung của Bộ cần {TERM_FRAMEWORK.term1Weeks} + {TERM_FRAMEWORK.term2Weeks} = 35 tuần thực học, chưa trừ nghỉ lễ, Tết).</Txt>
      )}
      {check.warnings.map((w) => <Txt key={w} size={13} color={c.vangChu}>{w}</Txt>)}
    </View>
  );
};

export const SchoolYears: React.FC<{ session: Session; years: YearItem[]; onSelect: (id: string) => void; onChanged: () => void }> = ({ session, years, onSelect, onChanged }) => {
  const { c } = useTheme();
  const { token } = session;
  const today = todayVn();
  const [form, setForm] = useState<{ year: YearItem | null; initial: Values } | null>(null);
  const [confirm, setConfirm] = useState<{ year: YearItem; action: 'activate' | 'end' } | null>(null);
  const { busy, run } = useAction(session.expired);
  const advice = yearAdvice(years, today);

  const open = (year: YearItem | null, label?: string) => {
    const suggestion = suggestTerms(label ?? year?.label ?? labelForDate(today), year ? { starts_on: year.starts_on, ends_on: year.ends_on } : undefined);
    const base: Values = year ? { label: year.label, starts_on: year.starts_on, ends_on: year.ends_on } : { label: label ?? labelForDate(today), starts_on: suggestion?.starts_on ?? '', ends_on: suggestion?.ends_on ?? '' };
    const terms = year && hasTerms(year) ? year : suggestion;
    for (const key of TERM_KEYS) base[key] = terms?.[key] ?? '';
    setForm({ year, initial: base });
  };

  const termCell = (y: YearItem, term: 1 | 2) => {
    const a = y[`term${term}_starts_on`], b = y[`term${term}_ends_on`];
    if (!a || !b) return <Txt size={13} color={c.muc3}>Chưa đặt</Txt>;
    const p = y.status === 'ended' ? null : phaseOf(y, today);
    const current = p?.kind === 'term' && p.term === term;
    return <View style={{ gap: 2 }}><Txt f={current ? 'bold' : 'semibold'} size={13} color={current ? c.son : c.muc}>{fmtDay(a)} → {fmtDay(b)}</Txt><Txt size={12} color={current ? c.son : c.muc3}>{calendarWeeks(a, b)} tuần{current ? ' · đang diễn ra' : ''}</Txt></View>;
  };

  const fields: FieldDef[] = [
    { name: 'label', label: 'Năm học', required: true, placeholder: '2026-2027', hint: form?.year && form.year.classes ? 'Năm học đã có lớp nên chỉ sửa được ngày.' : undefined },
    { name: 'starts_on', label: 'Ngày bắt đầu năm học', type: 'date', required: true, hint: 'Khai giảng 5/9' },
    { name: 'ends_on', label: 'Ngày kết thúc năm học', type: 'date', required: true, hint: 'Kết thúc trước 31/5' },
    { name: 'terms_assist', label: 'Học kỳ', render: (values, set) => <TermsAssist values={values} set={set} creating={!form?.year} /> },
    { name: 'term1_starts_on', label: 'Học kỳ 1: bắt đầu', type: 'date' },
    { name: 'term1_ends_on', label: 'Học kỳ 1: kết thúc', type: 'date' },
    { name: 'term2_starts_on', label: 'Học kỳ 2: bắt đầu', type: 'date' },
    { name: 'term2_ends_on', label: 'Học kỳ 2: kết thúc', type: 'date' },
    { name: 'terms_check', label: 'Kiểm tra', render: (values) => <TermsCheck values={values} /> },
  ];

  return (
    <>
      <PageHeader title="Năm học" actions={<Btn title="Thêm năm học" icon={Plus} tone="son" size="sm" onPress={() => open(null)} testID="year-add" />} />
      {advice.map((a) => {
        const key = a.kind === 'create' ? `create-${a.label}` : `${a.kind}-${a.year.id}`;
        const s = a.kind === 'create' ? suggestTerms(a.label) : a.kind === 'terms' ? suggestTerms(a.year.label, a.year) : null;
        const text = a.kind === 'end'
          ? `Năm học ${a.year.label} đã qua ngày kết thúc (${fmtDay(a.year.ends_on)}). Hãy kết thúc năm học để chốt dữ liệu rồi mở năm học mới.`
          : a.kind === 'terms'
            ? `Năm học ${a.year.label} chưa có học kỳ 1 và học kỳ 2. Gợi ý theo khung của Bộ GD&ĐT: học kỳ 1 ${fmtDay(s?.term1_starts_on)} → ${fmtDay(s?.term1_ends_on)}, học kỳ 2 ${fmtDay(s?.term2_starts_on)} → ${fmtDay(s?.term2_ends_on)}.`
            : `Chưa có năm học ${a.label}. Gợi ý theo khung của Bộ GD&ĐT: năm học ${fmtDay(s?.starts_on)} → ${fmtDay(s?.ends_on)}, học kỳ 1 ${fmtDay(s?.term1_starts_on)} → ${fmtDay(s?.term1_ends_on)}, học kỳ 2 ${fmtDay(s?.term2_starts_on)} → ${fmtDay(s?.term2_ends_on)}.`;
        const title = a.kind === 'end' ? 'Kết thúc năm học' : a.kind === 'terms' ? 'Đặt học kỳ theo gợi ý' : `Tạo năm học ${a.label}`;
        const onPress = () => (a.kind === 'end' ? setConfirm({ year: a.year, action: 'end' }) : a.kind === 'terms' ? open(a.year) : open(null, a.label));
        return (
          <Inset key={key} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}><Lightbulb size={18} color={c.vangChu} /><Txt size={14} style={{ flex: 1 }}>{text}</Txt></View>
            <View style={{ flexDirection: 'row' }}><Btn title={title} tone={a.kind === 'end' ? 'giay' : 'son'} size="sm" onPress={onPress} testID={`year-advice-${a.kind}`} /></View>
          </Inset>
        );
      })}
      <DataTable rows={years} rowKey={(y) => y.id} empty="Chưa có năm học nào. Hãy thêm năm học đầu tiên." onRowPress={(y) => onSelect(String(y.id))}
        columns={[
          { key: 'label', label: 'Năm học', flex: 1.3, render: (y) => <Cell main={y.label} sub={`${fmtDay(y.starts_on)} → ${fmtDay(y.ends_on)}`} /> },
          { key: 'term1', label: 'Học kỳ 1', flex: 1.4, render: (y) => termCell(y, 1) },
          { key: 'term2', label: 'Học kỳ 2', flex: 1.4, render: (y) => termCell(y, 2) },
          { key: 'status', label: 'Trạng thái', flex: 1.3, render: (y) => {
            const text = y.status === 'ended' ? null : phaseText(y, today);
            return <View style={{ gap: 4, alignItems: 'flex-start' }}><StatusChip kind={YEAR_KIND[y.status]} text={YEAR_TEXT[y.status]} />{text ? <Txt size={12} color={c.muc2}>{text}</Txt> : null}</View>;
          } },
          { key: 'classes', label: 'Số lớp', flex: 0.6, render: (y) => <Txt size={14}>{y.classes ?? 0}</Txt> },
          { key: 'ended', label: 'Kết thúc lúc', flex: 1, hideOnCard: true, render: (y) => <Txt size={13} color={c.muc2}>{y.ended_at ? dateText(y.ended_at) : '—'}</Txt> },
        ]}
        actions={(y) => (<>
          {y.status !== 'ended' ? <Btn title="Sửa" tone="giay" size="sm" onPress={() => open(y)} /> : null}
          {y.status === 'planned' ? <Btn title="Kích hoạt" tone="giay" size="sm" onPress={() => setConfirm({ year: y, action: 'activate' })} /> : null}
          {y.status === 'active' ? <Btn title="Kết thúc" tone="giay" size="sm" onPress={() => setConfirm({ year: y, action: 'end' })} /> : null}
        </>)} />

      {form ? (
        <FormSheet key={`${form.year?.id ?? 'new'}-${form.initial.label}`} title={form.year ? `Sửa năm học ${form.year.label}` : 'Thêm năm học'} subtitle="Năm học gồm hai năm liên tiếp, ví dụ 2026-2027; chia thành học kỳ 1 và học kỳ 2" submitLabel={form.year ? 'Lưu' : 'Thêm năm học'} wide
          fields={fields} initial={form.initial} onClose={() => setForm(null)}
          onSubmit={async (v) => {
            const terms = Object.fromEntries(TERM_KEYS.map((key) => [key, str(v, key) || null])) as Record<(typeof TERM_KEYS)[number], string | null>;
            const body = { label: str(v, 'label'), starts_on: str(v, 'starts_on'), ends_on: str(v, 'ends_on'), ...terms };
            const check = checkTerms(body);
            if (check.error) throw new Error(check.error);
            if (form.year) await api.updateYear(token, form.year.id, form.year.classes ? { starts_on: body.starts_on, ends_on: body.ends_on, ...terms } : body);
            else await api.createYear(token, body);
            setForm(null);
            onChanged();
          }} />
      ) : null}
      <ConfirmSheet open={!!confirm} busy={busy} onCancel={() => setConfirm(null)} confirmLabel={confirm?.action === 'activate' ? 'Kích hoạt' : 'Kết thúc năm học'}
        title={confirm?.action === 'activate' ? 'Kích hoạt năm học' : 'Kết thúc năm học'}
        message={confirm?.action === 'activate' ? `Đặt ${confirm?.year.label} làm năm học đang hoạt động? Mỗi trường chỉ có một năm học đang hoạt động.` : `Kết thúc năm học ${confirm?.year.label}? Sau đó không sửa được lớp, học sinh trong lớp và khối của năm học này; không thể hoàn tác.`}
        onConfirm={async () => { if (confirm && (await run(() => (confirm.action === 'activate' ? api.activateYear(token, confirm.year.id) : api.endYear(token, confirm.year.id)), 'Đã cập nhật năm học'))) { setConfirm(null); onChanged(); } }} />
    </>
  );
};
