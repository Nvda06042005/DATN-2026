/**
 * Thống kê lớp học cho giáo viên và quản trị trường (Sprint 10): bảng điều khiển lớp (HK.GV.066), hồ sơ học tập một học sinh (HK.GV.067, HK.QT.033), báo cáo theo chủ đề (HK.GV.068),
 * học sinh cần hỗ trợ (HK.GV.069), so sánh và xếp hạng lớp / khối / giáo viên (HK.GV.070, HK.QT.008, HK.QT.047), xuất Excel / PDF (HK.GV.071, HK.QT.048) và nhận xét qua email (HK.GV.072).
 * Số liệu do máy chủ tính theo phạm vi của người dùng; học sinh ngoài lớp của giáo viên không bao giờ hiện ra. Danh sách "cần hỗ trợ" chỉ là gợi ý theo quy tắc, giáo viên quyết định.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { Mail, UserRound, Users } from 'lucide-react-native';
import * as api from '@/api/analyticsApi';
import { AdminSelect } from '@/components/admin/AdminSelect';
import { Cell, DataTable, DownloadButton, ErrorNote, FilterBar, FilterBox, Page, PageHeader, StatusChip, useAction, useLoad } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { ago, ColumnChart, Distribution, fmtPct, shortDay, StatGrid, StatTile, TopicBars, TypeBars } from '@/components/charts';
import { Bar, Btn, Card, Chip, EmptyState, Field, InfoNote, Segmented, Sheet, Spinner, ToggleRow, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { ClassDashboard, ResultGroup, StudentStat, SupportItem } from '@/types/analytics';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
type Part = 'overview' | 'students' | 'topics' | 'support' | 'compare';
const PARTS: Array<{ value: Part; label: string }> = [
  { value: 'overview', label: 'Tổng quan' }, { value: 'students', label: 'Học sinh' }, { value: 'topics', label: 'Chủ đề' }, { value: 'support', label: 'Cần hỗ trợ' }, { value: 'compare', label: 'So sánh' },
];

/** Khoảng thời gian lọc (YYYY-MM-DD); giá trị chưa đủ định dạng bị bỏ qua và báo lỗi nhẹ bên dưới ô */
export function usePeriod() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const period: api.Period = { from: DATE.test(from) ? from : undefined, to: DATE.test(to) ? to : undefined };
  const bar = (
    <FilterBar>
      <FilterBox><Field label="Từ ngày" value={from} onChangeText={setFrom} placeholder="VD: 2026-09-05" autoCapitalize="none" keyboardType="numbers-and-punctuation" error={from && !DATE.test(from) ? 'Nhập dạng năm-tháng-ngày, ví dụ 2026-09-05' : null} nativeID="period-from" /></FilterBox>
      <FilterBox><Field label="Đến ngày" value={to} onChangeText={setTo} placeholder="VD: 2026-12-31" autoCapitalize="none" keyboardType="numbers-and-punctuation" error={to && !DATE.test(to) ? 'Nhập dạng năm-tháng-ngày, ví dụ 2026-12-31' : null} nativeID="period-to" /></FilterBox>
      {from || to ? <Btn title="Bỏ lọc" tone="giay" size="sm" onPress={() => { setFrom(''); setTo(''); }} /> : null}
    </FilterBar>
  );
  return { period, bar };
}

// ---------------------------------------------------------------------- bảng so sánh và xếp hạng (HK.GV.070, HK.QT.008, HK.QT.047)
const CompareRow: React.FC<{ label: string; value: number | null; fill: string; group: string }> = ({ label, value, fill, group }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Txt size={12} color={c.muc3} style={{ width: 74 }}>{label}</Txt>
      <Bar value={value ?? 0} max={100} fill={fill} height={10} label={`${group}, ${label}: ${fmtPct(value)}`} style={{ flex: 1 }} />
      <Txt f="bold" size={13} style={{ width: 44, textAlign: 'right' }}>{fmtPct(value)}</Txt>
    </View>
  );
};

const BY_LABEL = { class: 'Theo lớp', grade: 'Theo khối', teacher: 'Theo giáo viên' } as const;
/** `shared`: dùng khoảng thời gian của màn hình cha (không hiện thêm thanh lọc) */
export const ResultsPanel: React.FC<{ session: Session; by: Array<'class' | 'grade' | 'teacher'>; exportable?: boolean; shared?: api.Period }> = ({ session, by, exportable, shared }) => {
  const { c } = useTheme();
  const { token } = session;
  const [kind, setKind] = useState<'class' | 'grade' | 'teacher'>(by[0]);
  const own = usePeriod();
  const period = shared ?? own.period, bar = shared ? null : own.bar;
  const data = useLoad(() => api.results(token, kind, period), [token, kind, period.from, period.to], session.expired);
  return (
    <View style={{ gap: 12 }}>
      {by.length > 1 ? <Segmented<'class' | 'grade' | 'teacher'> label="Nhóm kết quả" value={kind} onChange={setKind} options={by.map((v) => ({ value: v, label: BY_LABEL[v] }))} /> : null}
      {bar}
      {exportable ? (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <DownloadButton title="Xuất Excel" fetchBlob={() => api.exportResults(token, kind, 'xlsx', period)} filename="bao-cao-ket-qua.xlsx" />
          <DownloadButton title="Xuất PDF" fetchBlob={() => api.exportResults(token, kind, 'pdf', period)} filename="bao-cao-ket-qua.pdf" />
        </View>
      ) : null}
      <ErrorNote message={data.error} />
      {data.loading && !data.data ? <Spinner /> : null}
      {data.data ? (
        <DataTable<ResultGroup> rows={data.data.groups} rowKey={(g) => g.key} empty="Chưa có dữ liệu để so sánh."
          columns={[
            { key: 'rank', label: 'Hạng', flex: 0.5, render: (g) => <Txt f="bold" size={15}>{g.rank}</Txt> },
            { key: 'label', label: BY_LABEL[kind].replace('Theo ', '').replace(/^./, (x) => x.toUpperCase()), flex: 2, render: (g) => <Cell main={g.label} sub={`${g.classes} lớp · ${g.students} học sinh`} /> },
            { key: 'part', label: 'Tham gia', render: (g) => <Txt size={14}>{fmtPct(g.participation)}</Txt> },
            { key: 'prog', label: 'Tiến độ TB', render: (g) => <Txt size={14}>{fmtPct(g.avg_progress)}</Txt> },
            { key: 'avg', label: 'Điểm TB', render: (g) => <Txt f="bold" size={14}>{fmtPct(g.avg_percent)}</Txt> },
            { key: 'acc', label: 'Tỉ lệ đúng', render: (g) => <Txt size={14}>{fmtPct(g.accuracy)}</Txt> },
          ]} />
      ) : null}
      {data.data && data.data.groups.length > 1 ? (
        <Card pad={14} style={{ gap: 14 }}>
          <Txt f="bold" size={16} accessibilityRole="header">Biểu đồ so sánh</Txt>
          {data.data.groups.map((g) => (
            <View key={g.key} style={{ gap: 6 }}>
              <Txt f="semibold" size={14}>{g.rank}. {g.label}</Txt>
              <CompareRow label="Điểm TB" value={g.avg_percent} fill={c.ngoc} group={g.label} />
              <CompareRow label="Tiến độ" value={g.avg_progress} fill={c.thuy} group={g.label} />
              <CompareRow label="Tham gia" value={g.participation} fill={c.dong} group={g.label} />
            </View>
          ))}
        </Card>
      ) : null}
      <Txt size={12} color={c.muc3}>Xếp hạng theo điểm trung bình các bài làm, sau đó theo tiến độ. Hạng chỉ để tham khảo và so sánh cùng khoảng thời gian.</Txt>
    </View>
  );
};

// ---------------------------------------------------------------------- gửi nhận xét (HK.GV.072)
const FeedbackSheet: React.FC<{ session: Session; studentId: number; onClose: () => void }> = ({ session, studentId, onClose }) => {
  const { c } = useTheme();
  const { token } = session;
  const draft = useLoad(() => api.feedbackDraft(token, studentId), [token, studentId], session.expired);
  const history = useLoad(() => api.feedbackHistory(token, studentId), [token, studentId], session.expired);
  const { busy, run } = useAction(session.expired);
  const [subject, setSubject] = useState<string | null>(null);
  const [body, setBody] = useState<string | null>(null);
  const [toStudent, setToStudent] = useState(true);
  const [toParent, setToParent] = useState(false);
  const d = draft.data;
  const s = subject ?? d?.subject ?? '', b = body ?? d?.body ?? '';
  const to = [...(toStudent ? ['student' as const] : []), ...(toParent ? ['parent' as const] : [])];
  const send = async () => {
    const res = await run(() => api.sendFeedback(token, studentId, { subject: s, body: b, to }), 'Đã đưa thư vào hàng đợi gửi');
    if (res) { history.reload(); onClose(); }
  };
  return (
    <Sheet open onClose={onClose} title="Gửi nhận xét học tập" subtitle={d?.student.full_name} wide
      footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}><Btn title="Đóng" tone="giay" onPress={onClose} /><Btn icon={Mail} title="Gửi nhận xét" tone="son" loading={busy} disabled={!to.length || !d} onPress={send} testID="feedback-send" /></View>}>
      <View style={{ gap: 12 }}>
        <ErrorNote message={draft.error} />
        {draft.loading && !d ? <Spinner label="Đang soạn bản nháp từ số liệu…" /> : null}
        {d ? (
          <>
            <InfoNote><Txt size={13}>Bản nháp được dựng từ số liệu thật của học sinh. Thầy cô đọc và sửa lại trước khi gửi; thư đi qua hàng đợi email của hệ thống, mỗi học sinh nhận tối đa 5 thư trong 24 giờ.</Txt></InfoNote>
            <Field label="Tiêu đề" value={s} onChangeText={setSubject} maxLength={150} nativeID="fb-subject" />
            <Field label="Nội dung nhận xét" value={b} onChangeText={setBody} multiline numberOfLines={10} maxLength={3000} inputStyle={{ minHeight: 200, textAlignVertical: 'top' }} nativeID="fb-body" />
            <ToggleRow icon={UserRound} checked={toStudent && d.student.has_email} onChange={(v) => d.student.has_email && setToStudent(v)} label="Gửi cho học sinh" desc={d.student.has_email ? 'Email trong hồ sơ học sinh' : 'Hồ sơ chưa có email'} />
            <ToggleRow icon={Users} checked={toParent && d.student.has_parent_email} onChange={(v) => d.student.has_parent_email && setToParent(v)} label="Gửi cho phụ huynh" desc={d.student.has_parent_email ? 'Email phụ huynh trong hồ sơ' : 'Hồ sơ chưa có email phụ huynh'} />
          </>
        ) : null}
        {history.data?.length ? (
          <View style={{ gap: 4 }}>
            <Txt f="bold" size={13}>Đã gửi gần đây</Txt>
            {history.data.map((h) => <Txt key={h.id} size={13} color={c.muc3}>{new Date(h.created_at).toLocaleDateString('vi-VN')} · {h.recipient === 'parent' ? 'Phụ huynh' : 'Học sinh'} · {h.subject}{h.teacher ? ` · ${h.teacher}` : ''}</Txt>)}
          </View>
        ) : null}
      </View>
    </Sheet>
  );
};

// ---------------------------------------------------------------------- hồ sơ một học sinh (HK.GV.067, HK.QT.033)
export const StudentProfileSheet: React.FC<{ session: Session; studentId: number; onClose: () => void }> = ({ session, studentId, onClose }) => {
  const { c } = useTheme();
  const { token } = session;
  const data = useLoad(() => api.studentProfile(token, studentId), [token, studentId], session.expired);
  const [mail, setMail] = useState(false);
  const p = data.data;
  const st = p?.stats;
  return (
    <Sheet open onClose={onClose} title={p?.student.full_name ?? 'Hồ sơ học sinh'} subtitle={p ? `${p.student.user_code ?? 'Chưa có mã'} · ${p.student.classes.map((x) => x.name).join(', ') || 'Chưa vào lớp'}` : undefined} wide
      footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}><Btn title="Đóng" tone="giay" onPress={onClose} />{p ? <Btn icon={Mail} title="Gửi nhận xét" tone="son" onPress={() => setMail(true)} testID="profile-mail" /> : null}</View>}>
      <View style={{ gap: 14 }}>
        <ErrorNote message={data.error} />
        {data.loading && !p ? <Spinner /> : null}
        {p && st ? (
          <>
            <StatGrid>
              <StatTile label="Tiến độ hành trình" value={fmtPct(st.progress)} hint={`${st.nodes_done}/${st.nodes_total} nút`} tone="thuy" />
              <StatTile label="Điểm trung bình" value={fmtPct(st.avg_percent)} hint={`${st.attempts} bài làm`} />
              <StatTile label="Trả lời đúng" value={fmtPct(st.accuracy)} hint={`${st.correct}/${st.answered} câu`} tone={st.accuracy !== null && st.accuracy < 60 ? 'son' : 'ngoc'} />
              <StatTile label="Chuỗi ngày học" value={st.streak} hint={`Cấp ${st.level} · ${st.xp} điểm`} tone="vang" />
              <StatTile label="Thời gian học" value={`${st.study_minutes} phút`} hint={`${st.active_days} ngày · gần nhất ${ago(st.last_active_at)}`} />
            </StatGrid>
            <Card flat pad={12} style={{ gap: 10 }}>
              <Txt f="bold" size={15} accessibilityRole="header">Hành trình đang học</Txt>
              {p.journeys.length ? p.journeys.map((j) => (
                <View key={j.journey_id} style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}><Txt f="semibold" size={14} style={{ flex: 1 }}>{j.title}</Txt><Txt size={13} color={c.muc2}>{j.done}/{j.total} nút</Txt></View>
                  <Bar value={j.done} max={j.total} fill={c.thuy} label={`${j.title}: ${j.done}/${j.total} nút`} />
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {j.nodes.filter((n) => n.state === 'available' || (n.state === 'done' && n.best_percent < 60)).map((n) => (
                      <StatusChip key={n.id} kind={n.state === 'available' ? 'info' : 'warn'} text={n.state === 'available' ? `Đang mở: ${n.title}` : `Làm chưa tốt: ${n.title} (${n.best_percent}%)`} />
                    ))}
                  </View>
                </View>
              )) : <Txt size={14} color={c.muc2}>Học sinh chưa được giao hành trình nào.</Txt>}
            </Card>
            <Card flat pad={12} style={{ gap: 10 }}>
              <Txt f="bold" size={15} accessibilityRole="header">Theo chủ đề</Txt>
              <TypeBars rows={p.topics.by_type} />
              <Txt f="semibold" size={14}>Cần ôn</Txt>
              <TopicBars rows={p.topics.weak} empty="Chưa có chủ đề nào dưới ngưỡng." />
              <Txt f="semibold" size={14}>Làm tốt</Txt>
              <TopicBars rows={p.topics.strong} empty="Chưa có chủ đề nào đạt mức mạnh." />
            </Card>
            <Card flat pad={12} style={{ gap: 8 }}>
              <Txt f="bold" size={15} accessibilityRole="header">Các bài làm gần đây</Txt>
              {p.attempts.length ? p.attempts.slice(0, 8).map((a) => (
                <View key={a.id} style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Txt size={14} style={{ flex: 1, minWidth: 160 }}>{a.title}</Txt>
                  <Chip text={`${a.percent}%`} bg={a.passed ? c.ngocNhat : c.sonNhat} fg={a.passed ? c.ngocChu : c.sonChu} />
                  <Txt size={12} color={c.muc3}>{a.correct_count} đúng · {a.wrong_count} sai · {new Date(a.finished_at).toLocaleDateString('vi-VN')}</Txt>
                </View>
              )) : <Txt size={14} color={c.muc2}>Chưa có bài làm nào.</Txt>}
            </Card>
            {p.battles.length || p.war.length ? (
              <Card flat pad={12} style={{ gap: 6 }}>
                <Txt f="bold" size={15} accessibilityRole="header">Trận đánh và mini-game</Txt>
                {p.battles.map((b, i) => <Txt key={i} size={14}>{b.title} · {b.percent}% · {b.stars}/3 sao</Txt>)}
                {p.war.map((w, i) => <Txt key={`w${i}`} size={14}>Màn thẻ tướng “{w.title}” · {w.best_stars}/3 sao · thắng {w.clears}/{w.attempts} lượt</Txt>)}
              </Card>
            ) : null}
            <Card flat pad={12} style={{ gap: 6 }}>
              <Txt f="bold" size={15} accessibilityRole="header">Hoạt động gần đây</Txt>
              {p.timeline.length ? p.timeline.slice(0, 12).map((e, i) => <Txt key={i} size={13} color={c.muc2}>{new Date(e.created_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' })} · {e.label}</Txt>) : <Txt size={14} color={c.muc2}>Chưa có hoạt động.</Txt>}
              <Txt size={12} color={c.muc3}>{p.badges.length ? `Huy hiệu: ${p.badges.slice(0, 6).map((b) => b.name).join(', ')}${p.badges.length > 6 ? ` và ${p.badges.length - 6} huy hiệu khác` : ''}` : 'Chưa có huy hiệu'} · {p.cards} thẻ · {p.ai_questions_30d} câu hỏi Tiểu Tướng trong 30 ngày (chỉ đếm, không đọc nội dung)</Txt>
            </Card>
          </>
        ) : null}
        {mail ? <FeedbackSheet session={session} studentId={studentId} onClose={() => setMail(false)} /> : null}
      </View>
    </Sheet>
  );
};

// ---------------------------------------------------------------------- các phần của một lớp
const Overview: React.FC<{ d: ClassDashboard }> = ({ d }) => (
  <View style={{ gap: 14 }}>
    <StatGrid>
      <StatTile label="Học sinh" value={d.students} />
      <StatTile label="Tiến độ trung bình" value={fmtPct(d.avg_progress)} hint={`${fmtPct(d.completion_rate)} đã hoàn thành`} tone="thuy" />
      <StatTile label="Điểm trung bình" value={fmtPct(d.avg_percent)} hint={`Trả lời đúng ${fmtPct(d.accuracy)}`} tone="ngoc" />
      <StatTile label="Hoạt động 7 ngày" value={`${d.active_week}/${d.students}`} hint={`Tham gia ${fmtPct(d.participation)}`} />
      <StatTile label="Đang giữ chuỗi từ 3 ngày" value={d.streak_holders} tone="vang" />
      <StatTile label="Tổng thời gian học" value={`${d.study_minutes} phút`} />
    </StatGrid>
    <Card pad={14} style={{ gap: 10 }}>
      <Txt f="bold" size={16} accessibilityRole="header">Hoạt động học tập theo ngày</Txt>
      <ColumnChart data={d.series.map((s) => ({ label: shortDay(s.day), values: { events: s.events } }))} series={[{ key: 'events', label: 'Lượt hoạt động' }]} unit="lượt hoạt động" summary="Biểu đồ số lượt hoạt động học tập của lớp theo ngày" />
    </Card>
    <Card pad={14} style={{ gap: 10 }}>
      <Txt f="bold" size={16} accessibilityRole="header">Học sinh theo mức tiến độ</Txt>
      <Distribution rows={d.distribution} />
    </Card>
  </View>
);

const Roster: React.FC<{ rows: StudentStat[]; onOpen: (id: number) => void }> = ({ rows, onOpen }) => {
  const { c } = useTheme();
  return (
    <DataTable<StudentStat> rows={rows} rowKey={(r) => r.id} empty="Lớp chưa có học sinh." onRowPress={(r) => onOpen(r.id)}
      columns={[
        { key: 'name', label: 'Học sinh', flex: 2, render: (r) => <Cell main={r.full_name} sub={r.user_code} /> },
        { key: 'progress', label: 'Tiến độ', flex: 1.4, render: (r) => <View style={{ gap: 4 }}><Txt size={13}>{fmtPct(r.progress)} · {r.nodes_done}/{r.nodes_total} nút</Txt><Bar value={r.progress ?? 0} max={100} fill={c.thuy} height={8} label={`Tiến độ ${r.full_name}: ${fmtPct(r.progress)}`} /></View> },
        { key: 'avg', label: 'Điểm TB', render: (r) => <Txt f="bold" size={14}>{fmtPct(r.avg_percent)}</Txt> },
        { key: 'acc', label: 'Tỉ lệ đúng', render: (r) => <Txt size={14}>{fmtPct(r.accuracy)}</Txt> },
        { key: 'att', label: 'Số bài', hideOnCard: true, render: (r) => <Txt size={14}>{r.attempts}</Txt> },
        { key: 'min', label: 'Phút học', hideOnCard: true, render: (r) => <Txt size={14}>{r.study_minutes}</Txt> },
        { key: 'last', label: 'Gần nhất', render: (r) => <Txt size={13} color={r.last_active_at ? undefined : c.sonChu}>{ago(r.last_active_at)}</Txt> },
      ]} />
  );
};

const Support: React.FC<{ session: Session; classId: number; onOpen: (id: number) => void; onMail: (id: number) => void }> = ({ session, classId, onOpen, onMail }) => {
  const { c } = useTheme();
  const data = useLoad(() => api.support(session.token, classId), [session.token, classId], session.expired);
  return (
    <View style={{ gap: 12 }}>
      <ErrorNote message={data.error} />
      {data.loading && !data.data ? <Spinner /> : null}
      {data.data ? <InfoNote><Txt size={13}>{data.data.note}</Txt></InfoNote> : null}
      {data.data && !data.data.items.length ? <EmptyState mood="happy" title="Chưa có học sinh nào cần lưu ý" text="Cả lớp đang học đều và đạt kết quả ổn." /> : null}
      {data.data?.items.map((s: SupportItem) => (
        <Card key={s.id} flat pad={14} style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Txt f="bold" size={16} style={{ flexShrink: 1 }}>{s.full_name}</Txt>
            <StatusChip kind={s.severity >= 3 ? 'off' : s.severity === 2 ? 'warn' : 'info'} text={s.severity >= 3 ? 'Cần hỗ trợ gấp' : s.severity === 2 ? 'Nên hỏi thăm' : 'Theo dõi'} />
            <Txt size={12} color={c.muc3}>Học gần nhất: {ago(s.last_active_at)}</Txt>
          </View>
          {s.reasons.map((r, i) => <Txt key={i} size={14}>• {r}</Txt>)}
          {s.weak_topics.length ? <Txt size={13} color={c.sonChu}>Chủ đề yếu: {s.weak_topics.map((t) => `${t.name} (${t.percent}%)`).join(', ')}</Txt> : null}
          <Txt size={13} color={c.muc2}>Gợi ý: {s.suggestion}</Txt>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Btn icon={UserRound} title="Xem hồ sơ" tone="giay" size="sm" onPress={() => onOpen(s.id)} testID={`support-open-${s.id}`} />
            <Btn icon={Mail} title="Gửi nhận xét" tone="thuy" size="sm" onPress={() => onMail(s.id)} />
          </View>
        </Card>
      ))}
    </View>
  );
};

const Topics: React.FC<{ session: Session; classId: number; period: api.Period }> = ({ session, classId, period }) => {
  const { c } = useTheme();
  const data = useLoad(() => api.classTopics(session.token, classId, period), [session.token, classId, period.from, period.to], session.expired);
  const d = data.data;
  return (
    <View style={{ gap: 12 }}>
      <ErrorNote message={data.error} />
      {data.loading && !d ? <Spinner /> : null}
      {d ? (
        <>
          <Card pad={14} style={{ gap: 10 }}><Txt f="bold" size={16} accessibilityRole="header">Tỉ lệ đúng theo loại chủ đề</Txt><TypeBars rows={d.by_type} /></Card>
          <Card pad={14} style={{ gap: 10 }}>
            <Txt f="bold" size={16} accessibilityRole="header">Chủ đề cả lớp cần ôn thêm</Txt>
            <TopicBars rows={d.weak} empty="Chưa có chủ đề nào dưới ngưỡng (hoặc chưa đủ câu trả lời)." />
            <Txt size={12} color={c.muc3}>Ngưỡng cần ôn: dưới {d.weak_threshold}%. Chủ đề chỉ được xếp loại khi cả lớp đã trả lời đủ số câu tối thiểu.</Txt>
          </Card>
        </>
      ) : null}
    </View>
  );
};

// ---------------------------------------------------------------------- màn hình thống kê lớp
export const ClassAnalytics: React.FC<{ session: Session }> = ({ session }) => {
  const { token } = session;
  const classes = useLoad(() => api.classes(token), [token], session.expired);
  const [classId, setClassId] = useState<number | null>(null);
  const [part, setPart] = useState<Part>('overview');
  const [profile, setProfile] = useState<number | null>(null);
  const [mail, setMail] = useState<number | null>(null);
  const { period, bar } = usePeriod();
  const list = (classes.data ?? []).filter((c) => c.is_active);
  const id = classId ?? list[0]?.id ?? null;
  const dash = useLoad(() => (id ? api.dashboard(token, id, period) : Promise.resolve(null)), [token, id, period.from, period.to], session.expired);
  const current = list.find((c) => c.id === id);

  return (
    <View style={{ gap: 14 }}>
      <ErrorNote message={classes.error} />
      {classes.loading && !classes.data ? <Spinner /> : null}
      {classes.data && !list.length ? <EmptyState mood="thinking" title="Chưa có lớp nào" text="Khi có lớp đang hoạt động, thống kê học tập sẽ hiện ở đây." /> : null}
      {list.length ? (
        <>
          <FilterBar>
            <FilterBox flex={2}>
              <AdminSelect<number> label="Lớp" value={id ?? 0} options={list.map((c) => ({ value: c.id, label: `${c.name}${c.school_name && list.some((o) => o.school_id !== c.school_id) ? ` – ${c.school_name}` : ''} (${c.students} học sinh)` }))} onChange={setClassId} testID="analytics-class" />
            </FilterBox>
          </FilterBar>
          {bar}
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {id ? <DownloadButton title="Xuất Excel" fetchBlob={() => api.exportClass(token, id, 'xlsx', period)} filename={`bao-cao-lop-${current?.name ?? id}.xlsx`} /> : null}
            {id ? <DownloadButton title="Xuất PDF" fetchBlob={() => api.exportClass(token, id, 'pdf', period)} filename={`bao-cao-lop-${current?.name ?? id}.pdf`} /> : null}
          </View>
          <Segmented<Part> label="Nội dung thống kê" value={part} onChange={setPart} options={PARTS} />
          <ErrorNote message={dash.error} />
          {dash.loading && !dash.data && part !== 'compare' ? <Spinner /> : null}
          {part === 'overview' && dash.data ? <Overview d={dash.data} /> : null}
          {part === 'students' && dash.data ? <Roster rows={dash.data.roster} onOpen={setProfile} /> : null}
          {part === 'topics' && id ? <Topics session={session} classId={id} period={period} /> : null}
          {part === 'support' && id ? <Support session={session} classId={id} onOpen={setProfile} onMail={setMail} /> : null}
          {part === 'compare' ? <ResultsPanel session={session} by={['class']} shared={period} /> : null}
        </>
      ) : null}
      {profile !== null ? <StudentProfileSheet session={session} studentId={profile} onClose={() => setProfile(null)} /> : null}
      {mail !== null ? <FeedbackSheet session={session} studentId={mail} onClose={() => setMail(null)} /> : null}
    </View>
  );
};

/** Trang "Thống kê lớp" của giáo viên */
export const TeacherAnalytics: React.FC<{ session: Session }> = ({ session }) => (
  <Page>
    <PageHeader title="Thống kê lớp" subtitle="Tiến độ, kết quả và những học sinh cần hỗ trợ trong các lớp thầy cô phụ trách" />
    <ClassAnalytics session={session} />
  </Page>
);
