/**
 * Thống kê lớp học cho giáo viên và quản trị trường (Sprint 10): bảng điều khiển lớp (HK.GV.066), hồ sơ học tập một học sinh (HK.GV.067, HK.QT.033), báo cáo theo chủ đề (HK.GV.068),
 * học sinh cần hỗ trợ (HK.GV.069), so sánh và xếp hạng lớp / khối / giáo viên (HK.GV.070, HK.QT.008, HK.QT.047), xuất Excel / PDF (HK.GV.071, HK.QT.048) và nhận xét qua email (HK.GV.072).
 * Số liệu do máy chủ tính theo phạm vi của người dùng; học sinh ngoài lớp của giáo viên không bao giờ hiện ra. Danh sách "cần hỗ trợ" chỉ là gợi ý theo quy tắc, giáo viên quyết định.
 * 14/11/2026: "Lớp và học sinh" và "Kết quả" thành dashboard một trang (chỉ số, biểu đồ, đồng hồ, thẻ, bảng) cùng kiểu trang Tổng quan; xuất báo cáo theo bố cục chính thức.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { Activity, CircleCheck, Clock, GraduationCap, Mail, Route, School, Trophy, UserRound, Users } from 'lucide-react-native';
import * as api from '@/api/analyticsApi';
import { AdminSelect } from '@/components/admin/AdminSelect';
import { DashboardGauge } from '@/components/admin/DashboardGauge';
import { DashboardMetric as Metric } from '@/components/admin/DashboardMetric';
import { BLUE, GOLD, PURPLE } from '@/components/admin/DashboardPanels';
import { Cell, DataTable, ErrorNote, StatusChip, useAction, useLoad } from '@/components/admin/kit';
import { BarRow, CardRow, Panel, ReportActions, ReportShell, SlowNote, usePeriodPicker } from '@/components/admin/ReportKit';
import { dateText, grade, Pill } from '@/components/admin/SystemDashboard';
import { TrendChart, type TrendPoint } from '@/components/admin/TrendChart';
import type { Session } from '@/components/auth';
import { ago, fmtPct, shortDay, StatGrid, StatTile, TopicBars, TypeBars } from '@/components/charts';
import { Bar, Btn, Card, Chip, EmptyState, Field, InfoNote, Sheet, Spinner, ToggleRow, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { fmt } from '@/lib/format';
import type { ResultClass, ResultGroup, StudentStat } from '@/types/analytics';
import { TOPIC_TYPE_LABEL } from '@/types/analytics';
import type { YearItem } from '@/types/api';

const fileName = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
/** Đồng hồ nửa vòng: mốc tốt / khá và chữ của ba mức */
const gaugeOf = (id: string, label: string, value: number | null, good: number, ok: number, texts: [string, string, string], hint: string) => (
  <DashboardGauge key={id} id={id} label={label} value={value} level={grade(value, good, ok)} levelText={value == null ? 'Chưa có' : value >= good ? texts[0] : value >= ok ? texts[1] : texts[2]} hint={hint} />
);
const GOODNESS: [string, string, string] = ['Tốt', 'Khá', 'Cần ôn tập'];
const ACTIVITY: [string, string, string] = ['Sôi nổi', 'Khá', 'Cần thúc đẩy'];
/** Trung bình theo sĩ số các lớp có số liệu (tổng hợp toàn trường) */
const weighted = (rows: ResultClass[], pick: (r: ResultClass) => number | null): number | null => {
  const has = rows.filter((r) => pick(r) != null && r.students > 0);
  const total = has.reduce((n, r) => n + r.students, 0);
  return total ? Math.round(has.reduce((n, r) => n + (pick(r) as number) * r.students, 0) / total) : null;
};

// ---------------------------------------------------------------------- kết quả: so sánh và xếp hạng lớp / khối / giáo viên (HK.GV.070, HK.QT.008, HK.QT.047)
const BY_LABEL = { class: 'Theo lớp', grade: 'Theo khối', teacher: 'Theo giáo viên' } as const;
const BY_NOUN = { class: 'Lớp', grade: 'Khối', teacher: 'Giáo viên' } as const;
type By = keyof typeof BY_LABEL;

/** Dashboard "Kết quả" của Thống kê trường: chỉ số toàn trường, biểu đồ so sánh, đồng hồ, nhóm cao nhất / cần quan tâm, bảng xếp hạng và chi tiết từng lớp */
export const ResultsDashboard: React.FC<{ session: Session; years?: YearItem[] | null; schoolName?: string }> = ({ session, years, schoolName }) => {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 1240;
  const { token, expired } = session;
  const [by, setBy] = useState<By>('class');
  const [refresh, setRefresh] = useState(0);
  const pick = usePeriodPicker(years, 'results');
  const p = pick.period;
  const data = useLoad(() => (pick.ready ? api.results(token, by, p) : Promise.resolve(null)), [token, by, p.from, p.to, refresh, pick.ready], expired);
  const r = data.data;
  const groups = r?.groups ?? [];
  const classes = r?.classes ?? [];
  const students = classes.reduce((n, x) => n + x.students, 0), active = classes.reduce((n, x) => n + x.active_students, 0);
  const participation = students ? Math.round((active / students) * 100) : null;
  const avgScore = weighted(classes, (x) => x.avg_percent), avgProgress = weighted(classes, (x) => x.avg_progress), accuracy = weighted(classes, (x) => x.accuracy);
  const scored = groups.filter((g) => g.avg_percent != null);
  const top = scored[0], low = scored.length > 1 ? scored[scored.length - 1] : null;
  const noun = BY_NOUN[by];
  const chartRows = groups.slice(0, wide ? 10 : 8);
  return (
    <ReportShell testID="results-dashboard" title="Kết quả học tập" subtitle={`${schoolName ? `${schoolName} · ` : ''}${pick.label} · Xếp hạng theo điểm trung bình, sau đó theo tiến độ`}
      actions={<ReportActions idPrefix="results" filename={`bao-cao-ket-qua-theo-${fileName(noun)}`} excel={() => api.exportResults(token, by, 'xlsx', p)} pdf={() => api.exportResults(token, by, 'pdf', p)} onRefresh={() => setRefresh((n) => n + 1)} busy={data.loading} />}
      filters={<View style={{ gap: 8 }}>
        <View accessibilityRole="tablist" accessibilityLabel="Nhóm kết quả" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          <Txt size={12} f="semibold" color={c.muc2}>So sánh:</Txt>
          {(Object.keys(BY_LABEL) as By[]).map((v) => <Pill key={v} testID={`results-by-${v}`} label={BY_LABEL[v]} on={by === v} onPress={() => setBy(v)} />)}
        </View>
        {pick.bar}
      </View>}>
      <ErrorNote message={data.error} />
      <SlowNote loading={data.loading && !r} onRetry={() => setRefresh((n) => n + 1)} />
      {data.loading && !r ? <Spinner label="Đang tải kết quả học tập…" /> : null}
      {r ? <>
        <View testID="results-metrics" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Metric compact label="Số lớp" value={classes.length} hint="" icon={School} color={c.son} background={c.sonNhat} />
          <Metric compact label="Học sinh" value={students} hint={`${fmt(active)} có học`} icon={GraduationCap} color={c.thuyChu} background={c.thuyNhat} />
          <Metric compact label="Tham gia" value={fmtPct(participation)} hint="học sinh" icon={Activity} color={c.ngocChu} background={c.ngocNhat} />
          <Metric compact label="Điểm trung bình" value={fmtPct(avgScore)} hint="toàn trường" icon={Trophy} color={c.vangChu} background={c.vangNhat} />
          <Metric compact label="Tiến độ hành trình" value={fmtPct(avgProgress)} hint="trung bình" icon={Route} color={c.thongChu} background={c.thongNhat} />
          <Metric compact label="Tỉ lệ đúng" value={fmtPct(accuracy)} hint="câu trả lời" icon={CircleCheck} color={c.son} background={c.sonNhat} />
        </View>
        <View style={{ flexDirection: wide ? 'row' : 'column', gap: 8 }}>
          <Panel title={`So sánh ${BY_LABEL[by].toLowerCase()}`} note={groups.length > chartRows.length ? `${chartRows.length}/${groups.length} nhóm đầu bảng xếp hạng` : `${groups.length} nhóm`} style={{ flex: wide ? 2.2 : undefined }} testID="results-compare">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {[['Điểm TB', BLUE], ['Tiến độ', PURPLE], ['Tham gia', GOLD]].map(([l, col]) => <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: col }} /><Txt size={11} color={c.muc2}>{l}</Txt></View>)}
            </View>
            {!chartRows.length ? <Txt size={13} color={c.muc3}>Chưa có lớp đang hoạt động để so sánh.</Txt> : chartRows.map((g) => (
              <View key={g.key} style={{ flexDirection: wide ? 'row' : 'column', gap: wide ? 12 : 4, alignItems: wide ? 'center' : 'stretch', paddingVertical: 3, borderTopWidth: 1, borderTopColor: c.adminLine }}>
                <View style={{ width: wide ? 170 : undefined, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: g.rank <= 3 ? c.vangNhat : c.adminCanvas }}><Txt f="bold" size={11} color={g.rank <= 3 ? c.vangChu : c.muc2}>{g.rank}</Txt></View>
                  <View style={{ flex: 1, minWidth: 0 }}><Txt f="semibold" size={13} numberOfLines={1}>{g.label}</Txt><Txt size={10} color={c.muc3} numberOfLines={1}>{g.classes} lớp · {g.students} học sinh</Txt></View>
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <BarRow label="Điểm TB" value={g.avg_percent} color={BLUE} />
                  <BarRow label="Tiến độ" value={g.avg_progress} color={PURPLE} />
                  <BarRow label="Tham gia" value={g.participation} color={GOLD} />
                </View>
              </View>
            ))}
          </Panel>
          <View style={{ flex: wide ? 1.3 : undefined, gap: 8 }}>
            <Panel title="Chỉ số toàn trường" note="trung bình theo sĩ số" testID="results-gauges">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {gaugeOf('results-gauge-participation', 'Tham gia', participation, 70, 40, ACTIVITY, `${fmt(active)} / ${fmt(students)} học sinh`)}
                {gaugeOf('results-gauge-score', 'Điểm TB', avgScore, 70, 50, GOODNESS, 'các bài làm')}
                {gaugeOf('results-gauge-accuracy', 'Tỉ lệ đúng', accuracy, 75, 55, GOODNESS, 'câu trả lời')}
              </View>
            </Panel>
            <Panel title="Nổi bật" note={pick.label.split(' (')[0]} testID="results-highlights">
              <Highlight tone="good" title={`${noun} có điểm cao nhất`} g={top} />
              <Highlight tone="low" title={`${noun} cần quan tâm`} g={low} />
              <Txt size={11} color={c.muc3}>Hạng chỉ để tham khảo, so sánh cùng khoảng thời gian; nhóm chưa có bài làm xếp cuối.</Txt>
            </Panel>
          </View>
        </View>
        <Panel title={`Bảng xếp hạng ${BY_LABEL[by].toLowerCase()}`} note={`${groups.length} ${noun.toLowerCase()}`} testID="results-table">
          <DataTable<ResultGroup> rows={groups} rowKey={(g) => g.key} empty="Chưa có dữ liệu để so sánh."
            columns={[
              { key: 'rank', label: 'Hạng', width: 64, render: (g) => <Txt f="bold" size={15} color={g.rank <= 3 ? c.vangChu : c.muc}>{g.rank}</Txt> },
              { key: 'label', label: noun, width: 220, grow: 2, render: (g) => <Cell main={g.label} sub={`${g.classes} lớp · ${g.students} học sinh`} /> },
              { key: 'part', label: 'Tham gia', width: 110, render: (g) => <Txt size={14}>{fmtPct(g.participation)}</Txt> },
              { key: 'prog', label: 'Tiến độ TB', width: 110, render: (g) => <Txt size={14}>{fmtPct(g.avg_progress)}</Txt> },
              { key: 'avg', label: 'Điểm TB', width: 160, grow: 1, render: (g) => <View style={{ gap: 4 }}><Txt f="bold" size={14}>{fmtPct(g.avg_percent)}</Txt><Bar value={g.avg_percent ?? 0} max={100} fill={BLUE} height={6} label={`${g.label}: điểm trung bình ${fmtPct(g.avg_percent)}`} /></View> },
              { key: 'acc', label: 'Tỉ lệ đúng', width: 110, render: (g) => <Txt size={14}>{fmtPct(g.accuracy)}</Txt> },
            ]} />
        </Panel>
        {by !== 'class' ? (
          <Panel title="Chi tiết từng lớp" note={`${classes.length} lớp`} testID="results-classes">
            <DataTable<ResultClass> rows={classes} rowKey={(x) => x.class_id} empty="Chưa có lớp."
              columns={[
                { key: 'name', label: 'Lớp', width: 120, render: (x) => <Cell main={x.class_name} sub={x.grade ? `Khối ${x.grade}` : null} /> },
                { key: 'teachers', label: 'Giáo viên phụ trách', width: 220, grow: 2, render: (x) => <Txt size={14} numberOfLines={2}>{x.teachers || 'Chưa phân công'}</Txt> },
                { key: 'students', label: 'Học sinh', width: 90, render: (x) => <Txt size={14}>{x.students}</Txt> },
                { key: 'part', label: 'Tham gia', width: 100, render: (x) => <Txt size={14}>{fmtPct(x.participation)}</Txt> },
                { key: 'prog', label: 'Tiến độ TB', width: 100, render: (x) => <Txt size={14}>{fmtPct(x.avg_progress)}</Txt> },
                { key: 'avg', label: 'Điểm TB', width: 100, render: (x) => <Txt f="bold" size={14}>{fmtPct(x.avg_percent)}</Txt> },
                { key: 'acc', label: 'Tỉ lệ đúng', width: 100, render: (x) => <Txt size={14}>{fmtPct(x.accuracy)}</Txt> },
              ]} />
          </Panel>
        ) : null}
      </> : null}
    </ReportShell>
  );
};

const Highlight: React.FC<{ tone: 'good' | 'low'; title: string; g: ResultGroup | null | undefined }> = ({ tone, title, g }) => {
  const { c } = useTheme();
  const [bg, fg] = tone === 'good' ? [c.mocNhat, c.mocChu] : [c.vangNhat, c.vangChu];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, backgroundColor: c.adminCanvas }}>
      <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}><Trophy size={17} color={fg} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt size={11} f="semibold" color={c.muc2}>{title}</Txt>
        <Txt f="bold" size={14} numberOfLines={1}>{g ? g.label : 'Chưa đủ số liệu'}</Txt>
      </View>
      {g ? <View style={{ alignItems: 'flex-end' }}><Txt f="displayHeavy" size={20}>{fmtPct(g.avg_percent)}</Txt><Txt size={10} color={c.muc3}>điểm TB</Txt></View> : null}
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
  const d = draft.data;
  const s = subject ?? d?.subject ?? '', b = body ?? d?.body ?? '';
  // thư nhận xét chỉ gửi cho học sinh: "Email phụ huynh" đã bỏ hẳn (13/11/2026)
  const to = toStudent && d?.student.has_email ? ['student' as const] : [];
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

// ---------------------------------------------------------------------- dashboard một lớp (HK.GV.066–071, HK.QT.033)
const SEVERITY = (n: number) => (n >= 3 ? { kind: 'off' as const, text: 'Cần hỗ trợ gấp' } : n === 2 ? { kind: 'warn' as const, text: 'Nên hỏi thăm' } : { kind: 'info' as const, text: 'Theo dõi' });
/** Mức tiến độ là thang tăng dần: một màu, nhạt → đậm */
const DIST_OPACITY = [0.3, 0.5, 0.75, 1];

/**
 * "Lớp và học sinh" (Thống kê trường) và "Thống kê lớp" (giáo viên): chọn lớp và khoảng thời gian một lần cho cả trang.
 * Hàng chỉ số; biểu đồ hoạt động theo ngày và sáu đồng hồ; bốn thẻ (mức tiến độ, chủ đề cần ôn, học sinh cần hỗ trợ, so sánh các lớp); bảng học sinh bấm để mở hồ sơ.
 * `years`: năm học của trường để chọn nhanh học kỳ (quản trị trường); giáo viên không có thì chọn theo số ngày.
 */
export const ClassAnalytics: React.FC<{ session: Session; years?: YearItem[] | null; title?: string }> = ({ session, years = null, title = 'Lớp và học sinh' }) => {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 1240;
  const { token, expired } = session;
  const [refresh, setRefresh] = useState(0);
  const [classId, setClassId] = useState<number | null>(null);
  const [profile, setProfile] = useState<number | null>(null);
  const [mail, setMail] = useState<number | null>(null);
  const pick = usePeriodPicker(years, 'class-report');
  const p = pick.period;
  const classes = useLoad(() => api.classes(token), [token, refresh], expired);
  const list = (classes.data ?? []).filter((x) => x.is_active);
  const id = classId ?? list[0]?.id ?? null;
  const deps = [token, id, p.from, p.to, refresh, pick.ready];
  const dash = useLoad(() => (id && pick.ready ? api.dashboard(token, id, { ...p, days: 30 }) : Promise.resolve(null)), deps, expired);
  const topics = useLoad(() => (id && pick.ready ? api.classTopics(token, id, p) : Promise.resolve(null)), deps, expired);
  const support = useLoad(() => (id ? api.support(token, id) : Promise.resolve(null)), [token, id, refresh], expired);
  const compare = useLoad(() => (pick.ready ? api.results(token, 'class', p) : Promise.resolve(null)), [token, p.from, p.to, refresh, pick.ready], expired);
  const current = list.find((x) => x.id === id);
  const d = dash.data;
  const trend = useMemo(() => (d?.series ?? []).map((s): TrendPoint => ({ key: s.day, label: shortDay(s.day), detail: dateText(s.day), values: { events: s.events, students: s.students } })), [d]);
  const range = trend.length ? `${dateText(trend[0].key)} – ${dateText(trend[trend.length - 1].key)}` : '';
  const busy = classes.loading || dash.loading || topics.loading || support.loading || compare.loading;
  const reload = () => setRefresh((n) => n + 1);
  const share = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);
  const distTotal = d ? d.distribution.reduce((n, x) => n + x.count, 0) : 0;
  const compareRows = (compare.data?.groups ?? []).slice(0, 6);
  const currentRank = compare.data?.groups.find((g) => g.key === String(id));
  // năm học của lớp chỉ ghi thêm khi khoảng thời gian đang chọn chưa nói tới năm học đó
  const yearText = current?.year_label && !pick.label.includes(current.year_label) ? ` · Năm học ${current.year_label}` : '';
  const subtitle = `${current ? `${current.name}${current.teachers ? ` · ${current.teachers}` : ''}${yearText} · ` : ''}${pick.label}`;
  const errors = [...new Set([classes.error, dash.error, topics.error, support.error, compare.error].filter((m): m is string => !!m))];

  return (
    <ReportShell testID="class-dashboard" title={title} subtitle={subtitle}
      actions={<ReportActions idPrefix="class-report" filename={`bao-cao-lop-${fileName(current?.name ?? String(id ?? ''))}`} onRefresh={reload} busy={busy}
        excel={id ? () => api.exportClass(token, id, 'xlsx', p) : undefined} pdf={id ? () => api.exportClass(token, id, 'pdf', p) : undefined} />}
      filters={list.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexBasis: 300, flexGrow: 0, minWidth: 240 }}>
            <Txt size={12} f="semibold" color={c.muc2}>Lớp:</Txt>
            <View style={{ flex: 1 }}>
              <AdminSelect<number> bare compact label="Lớp" value={id ?? 0} testID="analytics-class" onChange={setClassId}
                options={list.map((x) => ({ value: x.id, label: `${x.name}${x.school_name && list.some((o) => o.school_id !== x.school_id) ? ` – ${x.school_name}` : ''} (${x.students} học sinh)` }))} />
            </View>
          </View>
          <View style={{ flex: 1, minWidth: 280 }}>{pick.bar}</View>
        </View>
      ) : null}>
      {errors.map((m) => <ErrorNote key={m} message={m} />)}
      <SlowNote loading={(classes.loading && !classes.data) || (dash.loading && !d)} onRetry={reload} />
      {classes.loading && !classes.data ? <Spinner label="Đang tải danh sách lớp…" /> : null}
      {classes.data && !list.length ? <EmptyState mood="thinking" title="Chưa có lớp nào" text="Khi có lớp đang hoạt động, thống kê học tập sẽ hiện ở đây." /> : null}
      {id && dash.loading && !d ? <Spinner label="Đang tải thống kê lớp…" /> : null}
      {d ? <>
        <View testID="class-metrics" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Metric compact label="Sĩ số" value={d.students} hint="học sinh" icon={Users} color={c.son} background={c.sonNhat} />
          <Metric compact label="Hoạt động 7 ngày" value={`${d.active_week}/${d.students}`} hint={`tham gia ${fmtPct(d.participation)}`} icon={Activity} color={c.ngocChu} background={c.ngocNhat} />
          <Metric compact label="Tiến độ TB" value={fmtPct(d.avg_progress)} hint={`${fmtPct(d.completion_rate)} hoàn thành`} icon={Route} color={c.thuyChu} background={c.thuyNhat} />
          <Metric compact label="Điểm TB" value={fmtPct(d.avg_percent)} hint="các bài làm" icon={Trophy} color={c.vangChu} background={c.vangNhat} />
          <Metric compact label="Tỉ lệ đúng" value={fmtPct(d.accuracy)} hint="câu trả lời" icon={CircleCheck} color={c.thongChu} background={c.thongNhat} />
          <Metric compact label="Thời gian học" value={d.study_minutes} hint="phút" icon={Clock} color={c.son} background={c.sonNhat} />
        </View>

        <View style={{ flexDirection: wide ? 'row' : 'column', gap: 8 }}>
          <Panel title="Hoạt động học tập theo ngày" note={range} style={{ flex: wide ? 2.2 : undefined }} testID="class-trend-card">
            <TrendChart compact chartHeight={236} id="class-trend" data={trend} unit="lượt" summary="Số lượt hoạt động học tập và số học sinh hoạt động của lớp theo ngày"
              series={[{ key: 'events', label: 'Lượt hoạt động', color: BLUE }, { key: 'students', label: 'Học sinh hoạt động', color: PURPLE, dashed: true }]} />
          </Panel>
          <Panel title="Chỉ số của lớp" note={pick.label.split(' (')[0]} style={{ flex: wide ? 1.3 : undefined }} testID="class-gauges">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {gaugeOf('class-gauge-participation', 'Tham gia 7 ngày', d.participation, 70, 40, ACTIVITY, `${d.active_week} / ${d.students} học sinh`)}
              {gaugeOf('class-gauge-progress', 'Tiến độ TB', d.avg_progress, 60, 30, ['Tốt', 'Khá', 'Còn chậm'], 'hành trình')}
              {gaugeOf('class-gauge-completion', 'Hoàn thành', d.completion_rate, 50, 20, ['Tốt', 'Khá', 'Còn ít'], 'học xong hành trình')}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {gaugeOf('class-gauge-score', 'Điểm TB', d.avg_percent, 70, 50, GOODNESS, 'các bài làm')}
              {gaugeOf('class-gauge-accuracy', 'Tỉ lệ đúng', d.accuracy, 75, 55, GOODNESS, 'câu trả lời')}
              {gaugeOf('class-gauge-streak', 'Giữ chuỗi', share(d.streak_holders, d.students), 40, 15, ['Đều đặn', 'Khá', 'Chưa đều'], `${d.streak_holders} em từ 3 ngày`)}
            </View>
          </Panel>
        </View>

        <CardRow wide={wide}>
          <Panel title="Mức tiến độ" note={`${distTotal} học sinh có hành trình`} testID="class-distribution">
            <View accessibilityLabel={d.distribution.map((x) => `${x.label}: ${x.count} học sinh`).join(', ')} style={{ height: 10, borderRadius: 5, overflow: 'hidden', flexDirection: 'row', gap: 2, backgroundColor: distTotal ? undefined : c.adminLine }}>
              {d.distribution.map((x, i) => x.count > 0 ? <View key={x.label} style={{ flex: x.count, backgroundColor: BLUE, opacity: DIST_OPACITY[i] ?? 1 }} /> : null)}
            </View>
            {d.distribution.map((x, i) => (
              <View key={x.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: BLUE, opacity: DIST_OPACITY[i] ?? 1 }} />
                <Txt size={12} color={c.muc2} style={{ flex: 1 }}>Tiến độ {x.label}</Txt>
                <Txt f="bold" size={13}>{x.count}</Txt>
                <Txt size={11} color={c.muc3} style={{ width: 36, textAlign: 'right' }}>{fmtPct(share(x.count, distTotal))}</Txt>
              </View>
            ))}
          </Panel>
          <Panel title="Chủ đề cần ôn" note={topics.data ? `dưới ${topics.data.weak_threshold}% đúng` : undefined} testID="class-topics">
            {!topics.data ? <Txt size={12} color={c.muc3}>{topics.loading ? 'Đang tải…' : 'Chưa có số liệu.'}</Txt>
              : !topics.data.weak.length ? <Txt size={12} color={c.muc3}>Chưa có chủ đề nào dưới ngưỡng (hoặc chưa đủ câu trả lời).</Txt>
              : topics.data.weak.slice(0, 4).map((t) => <BarRow key={`${t.type}-${t.id}`} label={t.name} sub={TOPIC_TYPE_LABEL[t.type]} value={t.percent} color={GOLD} />)}
            {topics.data && topics.data.weak.length > 4 ? <Txt size={11} color={c.muc3}>Và {topics.data.weak.length - 4} chủ đề khác (có trong file xuất).</Txt> : null}
          </Panel>
          <Panel title="Học sinh cần hỗ trợ" note={support.data ? `${support.data.items.length} em` : undefined} testID="class-support">
            {!support.data ? <Txt size={12} color={c.muc3}>{support.loading ? 'Đang tải…' : 'Chưa có số liệu.'}</Txt>
              : !support.data.items.length ? <Txt size={12} color={c.muc3}>Cả lớp đang học đều và đạt kết quả ổn.</Txt>
              : support.data.items.slice(0, 4).map((s) => (
                <Pressable key={s.id} onPress={() => setProfile(s.id)} testID={`support-open-${s.id}`} accessibilityRole="button" accessibilityLabel={`Xem hồ sơ ${s.full_name}: ${s.reasons.join('; ')}`}
                  style={({ pressed }) => ({ minHeight: 44, gap: 2, paddingVertical: 4, paddingHorizontal: 6, marginHorizontal: -6, borderRadius: 8, backgroundColor: pressed ? c.adminCanvas : 'transparent' })}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <UserRound size={14} color={c.muc3} />
                    <Txt f="semibold" size={13} numberOfLines={1} style={{ flex: 1 }}>{s.full_name}</Txt>
                    <StatusChip {...SEVERITY(s.severity)} />
                  </View>
                  <Txt size={11} color={c.muc3} numberOfLines={2}>{s.reasons.join('; ')}</Txt>
                </Pressable>
              ))}
            {support.data?.items.length ? <Txt size={11} color={c.muc3}>Bấm vào tên để xem hồ sơ và gửi nhận xét.</Txt> : null}
            {support.data && support.data.items.length > 4 ? <Txt size={11} color={c.muc3}>Và {support.data.items.length - 4} em khác (có trong file xuất).</Txt> : null}
          </Panel>
          <Panel title="So sánh các lớp" note={currentRank ? `lớp đang xem hạng ${currentRank.rank}/${compare.data!.groups.length}` : 'điểm trung bình'} testID="class-compare">
            {!compare.data ? <Txt size={12} color={c.muc3}>{compare.loading ? 'Đang tải…' : 'Chưa có số liệu.'}</Txt>
              : compareRows.map((g) => <BarRow key={g.key} label={`${g.rank}. ${g.label}`} sub={`${g.students} HS`} value={g.avg_percent} color={BLUE} highlight={g.key === String(id)} testID={`class-compare-${g.key}`} />)}
            {currentRank && !compareRows.some((g) => g.key === currentRank.key) ? <BarRow label={`${currentRank.rank}. ${currentRank.label}`} sub={`${currentRank.students} HS`} value={currentRank.avg_percent} color={BLUE} highlight /> : null}
          </Panel>
        </CardRow>

        <Panel title="Danh sách học sinh" note="Bấm vào một học sinh để xem hồ sơ và gửi nhận xét" testID="class-roster">
          <DataTable<StudentStat> rows={d.roster} rowKey={(r) => r.id} empty="Lớp chưa có học sinh." onRowPress={(r) => setProfile(r.id)}
            columns={[
              { key: 'name', label: 'Học sinh', width: 220, grow: 2, render: (r) => <Cell main={r.full_name} sub={r.user_code} /> },
              { key: 'progress', label: 'Tiến độ', width: 170, grow: 1, render: (r) => <View style={{ gap: 4 }}><Txt size={13}>{fmtPct(r.progress)} · {r.nodes_done}/{r.nodes_total} nút</Txt><Bar value={r.progress ?? 0} max={100} fill={c.thuy} height={6} label={`Tiến độ ${r.full_name}: ${fmtPct(r.progress)}`} /></View> },
              { key: 'avg', label: 'Điểm TB', width: 90, render: (r) => <Txt f="bold" size={14}>{fmtPct(r.avg_percent)}</Txt> },
              { key: 'acc', label: 'Tỉ lệ đúng', width: 100, render: (r) => <Txt size={14}>{fmtPct(r.accuracy)}</Txt> },
              { key: 'att', label: 'Số bài', width: 80, hideOnCard: true, render: (r) => <Txt size={14}>{r.attempts}</Txt> },
              { key: 'min', label: 'Phút học', width: 90, hideOnCard: true, render: (r) => <Txt size={14}>{r.study_minutes}</Txt> },
              { key: 'last', label: 'Gần nhất', width: 120, render: (r) => <Txt size={13} color={r.last_active_at ? undefined : c.sonChu}>{ago(r.last_active_at)}</Txt> },
              { key: 'mail', label: 'Nhận xét', width: 110, hideOnCard: true, render: (r) => <Btn icon={Mail} title="Gửi" tone="giay" size="sm" onPress={() => setMail(r.id)} label={`Gửi nhận xét cho ${r.full_name}`} /> },
            ]} />
          {support.data ? <Txt size={11} color={c.muc3}>{support.data.note}</Txt> : null}
        </Panel>
      </> : null}
      {profile !== null ? <StudentProfileSheet session={session} studentId={profile} onClose={() => setProfile(null)} /> : null}
      {mail !== null ? <FeedbackSheet session={session} studentId={mail} onClose={() => setMail(null)} /> : null}
    </ReportShell>
  );
};

/** Trang "Thống kê lớp" của giáo viên: cùng dashboard với tab "Lớp và học sinh" của quản trị trường, chỉ các lớp thầy cô phụ trách */
export const TeacherAnalytics: React.FC<{ session: Session }> = ({ session }) => <ClassAnalytics session={session} title="Thống kê lớp" />;
