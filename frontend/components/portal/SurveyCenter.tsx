/**
 * Khảo sát trải nghiệm dành cho học sinh và giáo viên (Sprint 12, HK.HS.109, HK.GV.079): danh sách khảo sát được gửi tới mình và biểu mẫu trả lời đủ năm loại câu hỏi
 * (thang 1–5, mức độ giới thiệu 0–10, chọn một, chọn nhiều, ý kiến). Trả lời ẩn danh và chỉ một lần; máy chủ kiểm tra lại mọi câu trả lời.
 */
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { CheckSquare, ClipboardList, Circle, CircleDot, Send, Square } from 'lucide-react-native';
import * as api from '@/api/platformApi';
import { ErrorNote, Page, PageHeader, useAction, useLoad } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { Btn, Card, Chip, EmptyState, Field, InfoNote, Sheet, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { Question } from '@/types/platform';

const LIKERT = ['Rất không đồng ý', 'Không đồng ý', 'Bình thường', 'Đồng ý', 'Rất đồng ý'];
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : null);

const Scale: React.FC<{ q: Question; value: number | undefined; onChange: (n: number) => void }> = ({ q, value, onChange }) => {
  const { c } = useTheme();
  const [lo, hi] = q.type === 'likert5' ? [1, 5] : [0, 10];
  const nums = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  return (
    <View style={{ gap: 6 }}>
      <View accessibilityRole="radiogroup" accessibilityLabel={q.text} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {nums.map((n) => {
          const on = value === n;
          return (
            <Pressable key={n} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={q.type === 'likert5' ? `${n} trên 5: ${LIKERT[n - 1]}` : `${n} trên 10`} onPress={() => onChange(n)} testID={`${q.id}-${n}`}
              style={{ minWidth: 48, minHeight: 48, paddingHorizontal: 10, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center', borderColor: on ? c.ngoc : c.vien, backgroundColor: on ? c.ngocNhat : c.the }}>
              <Txt f="bold" size={16} color={on ? c.ngocChu : c.muc}>{n}</Txt>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <Txt size={12} color={c.muc3}>{q.type === 'likert5' ? LIKERT[0] : '0 = chắc chắn không'}</Txt>
        <Txt size={12} color={c.muc3} style={{ textAlign: 'right' }}>{q.type === 'likert5' ? LIKERT[4] : '10 = chắc chắn có'}</Txt>
      </View>
    </View>
  );
};

const Choices: React.FC<{ q: Question; value: unknown; onChange: (v: unknown) => void }> = ({ q, value, onChange }) => {
  const { c } = useTheme();
  const multi = q.type === 'multi';
  const chosen = multi ? ((value as string[] | undefined) ?? []) : value === undefined ? [] : [value as string];
  return (
    <View accessibilityRole={multi ? undefined : 'radiogroup'} accessibilityLabel={q.text} style={{ gap: 8 }}>
      {q.options!.map((o) => {
        const on = chosen.includes(o);
        const Icon = multi ? (on ? CheckSquare : Square) : on ? CircleDot : Circle;
        return (
          <Pressable key={o} accessibilityRole={multi ? 'checkbox' : 'radio'} accessibilityState={multi ? { checked: on } : { selected: on, checked: on }} onPress={() => onChange(multi ? (on ? chosen.filter((x) => x !== o) : [...chosen, o]) : o)}
            style={{ minHeight: 48, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 2, borderColor: on ? c.ngoc : c.vien, backgroundColor: on ? c.ngocNhat : c.the }}>
            <Icon size={20} color={on ? c.ngocChu : c.muc2} />
            <Txt size={15} style={{ flex: 1 }} color={on ? c.ngocChu : c.muc}>{o}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
};

const SurveySheet: React.FC<{ session: Session; id: number; onClose: () => void; onDone: () => void }> = ({ session, id, onClose, onDone }) => {
  const { c } = useTheme();
  const form = useLoad(() => api.surveyForm(session.token, id), [session.token, id], session.expired);
  const { busy, run } = useAction(session.expired);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const f = form.data;
  const submit = async () => {
    const missing = f?.questions.find((q) => q.required && (answers[q.id] === undefined || answers[q.id] === '' || (Array.isArray(answers[q.id]) && !(answers[q.id] as unknown[]).length)));
    if (missing) { setError(`Em / thầy cô chưa trả lời câu bắt buộc: ${missing.text}`); return; }
    setError(null);
    if (await run(() => api.respondSurvey(session.token, id, answers))) { setSent(true); onDone(); }
  };
  return (
    <Sheet open onClose={onClose} title={f?.title ?? 'Khảo sát'} subtitle={f?.closes_at ? `Hạn trả lời: ${day(f.closes_at)}` : 'Khảo sát ẩn danh'} wide
      footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}><Btn title={sent || f?.answered ? 'Đóng' : 'Để sau'} tone="giay" onPress={onClose} />{f && !f.answered && !sent ? <Btn icon={Send} title="Gửi câu trả lời" tone="ngoc" loading={busy} onPress={submit} testID="survey-submit" /> : null}</View>}>
      <ErrorNote message={form.error ?? error} />
      {form.loading && !f ? <Spinner /> : null}
      {f && (f.answered || sent) ? <EmptyState mood="happy" title="Cảm ơn bạn đã trả lời!" text="Câu trả lời của bạn được lưu ẩn danh và giúp nhà trường cải thiện ứng dụng." /> : null}
      {f && !f.answered && !sent ? (
        <View style={{ gap: 16 }}>
          {f.description ? <InfoNote><Txt size={14}>{f.description}</Txt></InfoNote> : null}
          {f.questions.map((q, i) => (
            <View key={q.id} style={{ gap: 8 }}>
              <Txt f="bold" size={15}>{i + 1}. {q.text}{q.required ? <Txt f="bold" size={15} color={c.son}> *</Txt> : null}</Txt>
              {q.type === 'likert5' || q.type === 'nps' ? <Scale q={q} value={answers[q.id] as number | undefined} onChange={(n) => setAnswers({ ...answers, [q.id]: n })} /> : null}
              {q.type === 'single' || q.type === 'multi' ? <Choices q={q} value={answers[q.id]} onChange={(v) => setAnswers({ ...answers, [q.id]: v })} /> : null}
              {q.type === 'text' ? <Field label="Ý kiến của bạn" value={String(answers[q.id] ?? '')} onChangeText={(v) => setAnswers({ ...answers, [q.id]: v })} multiline numberOfLines={3} maxLength={1000} inputStyle={{ minHeight: 80, textAlignVertical: 'top' }} nativeID={`survey-${q.id}`} /> : null}
            </View>
          ))}
          <Txt size={12} color={c.muc3}>Dấu * là câu bắt buộc. Khảo sát ẩn danh: người quản lý chỉ thấy số liệu tổng hợp, không thấy bạn đã chọn gì.</Txt>
        </View>
      ) : null}
    </Sheet>
  );
};

export const SurveyCenter: React.FC<{ session: Session; refreshKey?: number }> = ({ session, refreshKey = 0 }) => {
  const { c } = useTheme();
  const list = useLoad(() => api.mySurveys(session.token), [session.token, refreshKey], session.expired);
  const [open, setOpen] = useState<number | null>(null);
  return (
    <View style={{ gap: 12 }}>
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner /> : null}
      {list.data && !list.data.length ? <EmptyState mood="happy" title="Chưa có khảo sát nào" text="Khi trường gửi khảo sát trải nghiệm, bạn sẽ thấy ở đây và nhận thông báo." /> : null}
      {list.data?.map((s) => (
        <Card key={s.id} pad={14} style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip icon={ClipboardList} text={s.answered ? 'Đã trả lời' : s.phase === 'closed' ? 'Đã đóng' : 'Chưa trả lời'} bg={s.answered ? c.ngocNhat : c.vangNhat} fg={s.answered ? c.ngocChu : c.vangChu} />
            <Txt size={12} color={c.muc3}>{s.questions} câu{day(s.closes_at) ? ` · hạn ${day(s.closes_at)}` : ''}</Txt>
          </View>
          <Txt f="bold" size={16} accessibilityRole="header">{s.title}</Txt>
          {s.description ? <Txt size={14} color={c.muc2}>{s.description}</Txt> : null}
          {!s.answered && s.phase === 'open' ? <View style={{ flexDirection: 'row' }}><Btn title="Trả lời khảo sát" tone="ngoc" onPress={() => setOpen(s.id)} testID={`survey-open-${s.id}`} /></View> : null}
        </Card>
      ))}
      {open !== null ? <SurveySheet session={session} id={open} onClose={() => setOpen(null)} onDone={() => list.reload()} /> : null}
    </View>
  );
};

/** Trang Khảo sát trong khung giáo viên */
export const SurveyPage: React.FC<{ session: Session }> = ({ session }) => (
  <Page>
    <PageHeader title="Khảo sát trải nghiệm" subtitle="Khảo sát do nhà trường gửi tới thầy cô; trả lời ẩn danh và chỉ một lần" />
    <SurveyCenter session={session} />
  </Page>
);
