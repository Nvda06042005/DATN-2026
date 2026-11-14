import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query, StreamableFile, UseGuards } from '@nestjs/common';
import { vnDayLabel, XLSX_MIME } from '../admin/excel';
import { AuthGuard, CurrentUser, Roles } from '../auth/auth.guard';
import { UserRow } from '../database/database.service';
import { AnalyticsService, Period } from './analytics.service';
import { ReportCol, ReportHead, ReportSection, reportPdf, reportXlsx } from './export';
import { FeedbackService } from './feedback.service';
import { RecoService } from './reco.service';
import { TOPIC_LABEL } from './topics';

type Json = Record<string, any>;
const STAFF = ['teacher', 'school_admin', 'root_admin'] as const;
const period = (q: Json): Period => ({ from: typeof q.from === 'string' ? q.from : undefined, to: typeof q.to === 'string' ? q.to : undefined });
const when = (iso: string | null): string => (iso ? new Date(iso).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'chưa lần nào');
const fileFormat = (q: Json): 'xlsx' | 'pdf' => {
  const format = q.format === 'pdf' ? 'pdf' : q.format === 'xlsx' || q.format === undefined ? 'xlsx' : null;
  if (!format) throw new BadRequestException('Định dạng là xlsx hoặc pdf');
  return format;
};
const dmy = (d: string): string => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const rangeText = (p: Period): string => (p.from || p.to ? `${p.from ? dmy(p.from) : '…'} – ${p.to ? dmy(p.to) : 'nay'}` : 'Toàn bộ thời gian');
const pctText = (v: number | null | undefined): string => (v === null || v === undefined ? '–' : `${v}%`);
const SUMMARY_COLS: ReportCol[] = [{ header: 'Chỉ số', key: 'k', width: 38 }, { header: 'Giá trị', key: 'v', width: 16, center: true }, { header: 'Ghi chú', key: 'n', width: 46 }];
const KIND_LABEL: Record<string, string> = { ...TOPIC_LABEL, term: 'Thuật ngữ', lesson: 'Bài học' };

/**
 * /api/analytics – gợi ý học tập và báo cáo (Sprint 10). Học sinh: gợi ý "nên học gì hôm nay", điểm mạnh / yếu, luyện tập cá nhân hóa, lộ trình ôn tập.
 * Giáo viên và quản trị trường: bảng điều khiển lớp, hồ sơ học sinh, báo cáo chủ đề, học sinh cần hỗ trợ, so sánh, xuất file, nhận xét qua email.
 * Quản trị trường: tổng quan, mức độ sử dụng, kết quả theo khối / lớp / giáo viên, AI. Quản trị tổng: thống kê hệ thống. Thuật toán gợi ý chỉ chạy nội bộ theo lịch nền.
 */
@Controller('analytics')
@UseGuards(AuthGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService, private readonly reco: RecoService, private readonly feedback: FeedbackService) {}

  // ---------------------------------------------------------------------- học sinh
  @Get('me/strengths') @Roles('student') strengths(@CurrentUser() user: UserRow) { return this.analytics.strengths(user); }
  @Get('me/profile') @Roles('student') profile(@CurrentUser() user: UserRow) { return this.analytics.studentAiProfile(user); }
  @Post('me/practice') @Roles('student') @HttpCode(200) practice(@CurrentUser() user: UserRow, @Body() body: Json) { return this.reco.practice(user, body); }
  @Get('me/exam-plan') @Roles('student') examPlan(@CurrentUser() user: UserRow) { return this.reco.examPlan(user); }

  // ---------------------------------------------------------------------- lớp
  @Get('classes') @Roles(...STAFF) classes(@CurrentUser() user: UserRow) { return this.analytics.classes(user); }
  @Get('classes/:id/dashboard') @Roles(...STAFF) dashboard(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Query() q: Json) { return this.analytics.dashboard(user, id, { ...period(q), days: q.days ? Number(q.days) : undefined }); }
  @Get('classes/:id/topics') @Roles(...STAFF) topics(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Query() q: Json) { return this.analytics.classTopics(user, id, period(q)); }
  @Get('classes/:id/support') @Roles(...STAFF) support(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.analytics.support(user, id); }
  @Get('results') @Roles(...STAFF) results(@CurrentUser() user: UserRow, @Query() q: Json) { return this.analytics.results(user, (q.by ?? 'class') as 'class', period(q)); }
  @Get('students/:id') @Roles(...STAFF) student(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.analytics.studentProfile(user, id); }
  @Get('students/:id/feedback-draft') @Roles(...STAFF) draft(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.feedback.draft(user, id); }
  @Get('students/:id/feedback') @Roles(...STAFF) feedbackHistory(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.feedback.history(user, id); }
  @Post('students/:id/feedback') @Roles(...STAFF) @HttpCode(200) sendFeedback(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.feedback.send(user, id, body); }

  // ---------------------------------------------------------------------- xuất báo cáo (HK.GV.071, HK.QT.048)
  // Bố cục chính thức như file xuất của menu Giáo viên, Học sinh, Lớp học (yêu cầu 14/11/2026): logo, phần đầu nhà trường, quốc hiệu, tiêu đề, Ngày xuất,
  // Khoảng thời gian, bảng có STT, chỗ ký của người lập báo cáo (reportXlsx / reportPdf trong export.ts).
  private async send(format: 'xlsx' | 'pdf', file: string, head: ReportHead, sections: ReportSection[]) {
    return format === 'pdf'
      ? new StreamableFile(await reportPdf(head, sections), { type: 'application/pdf', disposition: `attachment; filename="${file}.pdf"` })
      : new StreamableFile(await reportXlsx(head, sections), { type: XLSX_MIME, disposition: `attachment; filename="${file}.xlsx"` });
  }

  @Get('classes/:id/export') @Roles(...STAFF)
  async exportClass(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Query() q: Json) {
    const format = fileFormat(q);
    const p = period(q);
    const { info, dash, topics, assignments } = await this.analytics.exportRows(user, id, p);
    const support = await this.analytics.support(user, id);
    const school = await this.analytics.reportSchool(info.school_id);
    const now = new Date();
    const head: ReportHead = {
      identity: `Báo cáo thống kê lớp · ${info.school_name}${school?.code ? ` · Mã trường ${school.code}` : ''}`, school, now,
      title: `Báo cáo thống kê lớp ${info.name}`, subtitle: [info.year_label ? `Năm học ${info.year_label}` : null, info.grade ? `Khối ${info.grade}` : null].filter(Boolean).join(' · ') || null,
      meta: [{ label: 'Ngày xuất', value: vnDayLabel(now) }, { label: 'Khoảng thời gian', value: rangeText(p) }, { label: 'Giáo viên phụ trách', value: info.teachers || 'Chưa phân công' }, { label: 'Sĩ số', value: `${dash.students} học sinh` }],
      signer: user.full_name,
    };
    const sections: ReportSection[] = [
      { title: 'Tổng quan', cols: SUMMARY_COLS, rows: [
        { k: 'Sĩ số', v: `${dash.students} học sinh`, n: '' },
        { k: 'Học sinh hoạt động trong 7 ngày', v: `${dash.active_week} / ${dash.students}`, n: `Tham gia ${pctText(dash.participation)}` },
        { k: 'Tiến độ hành trình trung bình', v: pctText(dash.avg_progress), n: `${pctText(dash.completion_rate)} học sinh đã hoàn thành hành trình` },
        { k: 'Điểm trung bình các bài làm', v: pctText(dash.avg_percent), n: 'Trung bình điểm phần trăm của các bài đã làm' },
        { k: 'Tỉ lệ trả lời đúng', v: pctText(dash.accuracy), n: 'Trên tổng số câu đã trả lời' },
        { k: 'Học sinh giữ chuỗi học từ 3 ngày', v: String(dash.streak_holders), n: '' },
        { k: 'Tổng thời gian học', v: `${dash.study_minutes} phút`, n: '' },
        { k: 'Học sinh theo mức tiến độ', v: '', n: dash.distribution.map((d) => `${d.label}: ${d.count}`).join(' · ') },
        { k: 'Học sinh cần hỗ trợ', v: String(support.items.length), n: 'Theo quy tắc: không hoạt động, tỉ lệ đúng thấp, tiến độ chậm' },
      ] },
      { title: 'Học sinh', cols: [
        { header: 'Họ và tên', key: 'full_name', width: 26 }, { header: 'Mã học sinh', key: 'user_code', width: 22 }, { header: 'Tiến độ', key: 'progress', width: 10, pct: true }, { header: 'Điểm TB', key: 'avg_percent', width: 10, pct: true },
        { header: 'Tỉ lệ đúng', key: 'accuracy', width: 10, pct: true }, { header: 'Số bài làm', key: 'attempts', width: 10, center: true }, { header: 'Phút học', key: 'study_minutes', width: 10, center: true },
        { header: 'Ngày học', key: 'active_days', width: 10, center: true }, { header: 'Hoạt động gần nhất', key: 'last', width: 16, center: true }], rows: dash.roster.map((r) => ({ ...r, last: when(r.last_active_at) })), empty: 'Lớp chưa có học sinh.' },
      { title: 'Học sinh cần hỗ trợ', note: support.note, cols: [
        { header: 'Họ và tên', key: 'full_name', width: 24 }, { header: 'Mức', key: 'level', width: 14, center: true }, { header: 'Lý do', key: 'reasons', width: 44 }, { header: 'Gợi ý', key: 'suggestion', width: 40 }],
        rows: support.items.map((x) => ({ ...x, level: x.severity >= 3 ? 'Cần hỗ trợ gấp' : x.severity === 2 ? 'Nên hỏi thăm' : 'Theo dõi', reasons: x.reasons.join('; ') })), empty: 'Chưa có học sinh nào cần lưu ý.' },
      { title: 'Chủ đề cần ôn', note: `Chủ đề có tỉ lệ đúng của cả lớp dưới ${topics.weak_threshold}%.`, cols: [
        { header: 'Loại', key: 'type', width: 18 }, { header: 'Chủ đề', key: 'name', width: 44 }, { header: 'Số câu đã trả lời', key: 'answered', width: 14, center: true }, { header: 'Tỉ lệ đúng', key: 'percent', width: 12, pct: true }],
        rows: topics.weak.map((t) => ({ ...t, type: TOPIC_LABEL[t.type] ?? t.type })), empty: 'Chưa có chủ đề nào dưới ngưỡng.' },
      { title: 'Bài tập', cols: [
        { header: 'Bài tập', key: 'title', width: 40 }, { header: 'Loại', key: 'kind', width: 12, center: true }, { header: 'Hạn nộp', key: 'due', width: 16, center: true }, { header: 'Đã nộp', key: 'submitted', width: 10, center: true }, { header: 'Điểm TB', key: 'avg_percent', width: 12, pct: true }],
        rows: (assignments as Json[]).map((a) => ({ ...a, due: when(a.due_at) })), empty: 'Chưa có bài tập trong khoảng thời gian này.' },
    ];
    return this.send(format, `bao-cao-lop-${info.name.replace(/[^\p{L}\p{N}]+/gu, '-')}`, head, sections);
  }

  @Get('export') @Roles('school_admin', 'root_admin')
  async exportResults(@CurrentUser() user: UserRow, @Query() q: Json) {
    const format = fileFormat(q);
    const p = period(q);
    const r = await this.analytics.results(user, (q.by ?? 'class') as 'class', p);
    const school = user.role === 'school_admin' ? await this.analytics.reportSchool(user.school_id) : null;
    const label = { class: 'lớp', grade: 'khối', teacher: 'giáo viên' }[r.by];
    const Label = label[0].toUpperCase() + label.slice(1);
    const now = new Date();
    // tổng hợp toàn trường: trung bình theo sĩ số các lớp có số liệu
    const students = r.classes.reduce((n, c) => n + c.students, 0), active = r.classes.reduce((n, c) => n + c.active_students, 0);
    const weighted = (pick: (c: (typeof r.classes)[number]) => number | null) => {
      const rows = r.classes.filter((c) => pick(c) !== null && c.students > 0);
      const total = rows.reduce((n, c) => n + c.students, 0);
      return total ? Math.round(rows.reduce((n, c) => n + (pick(c) as number) * c.students, 0) / total) : null;
    };
    const scored = r.groups.filter((g) => g.avg_percent !== null);
    const head: ReportHead = {
      identity: `Báo cáo kết quả học tập${school ? ` · ${school.name}${school.code ? ` · Mã trường ${school.code}` : ''}` : ' · Toàn hệ thống'}`, school, now,
      title: `Báo cáo kết quả học tập theo ${label}`,
      meta: [{ label: 'Ngày xuất', value: vnDayLabel(now) }, { label: 'Khoảng thời gian', value: rangeText(p) }, { label: 'Số lớp', value: String(r.classes.length) }, { label: 'Số học sinh', value: String(students) }],
      signer: user.full_name,
    };
    const sections: ReportSection[] = [
      { title: 'Tổng hợp', cols: SUMMARY_COLS, rows: [
        { k: 'Số lớp', v: String(r.classes.length), n: '' },
        { k: 'Số học sinh', v: String(students), n: `${active} học sinh có làm bài hoặc học trong kỳ` },
        { k: 'Tỉ lệ tham gia', v: pctText(students ? Math.round((active / students) * 100) : null), n: '' },
        { k: 'Điểm trung bình', v: pctText(weighted((c) => c.avg_percent)), n: 'Trung bình theo sĩ số các lớp có bài làm' },
        { k: 'Tiến độ hành trình trung bình', v: pctText(weighted((c) => c.avg_progress)), n: '' },
        { k: `${Label} có điểm cao nhất`, v: scored[0] ? pctText(scored[0].avg_percent) : '–', n: scored[0]?.label ?? 'Chưa có bài làm' },
        { k: `${Label} cần quan tâm`, v: scored.length > 1 ? pctText(scored[scored.length - 1].avg_percent) : '–', n: scored.length > 1 ? scored[scored.length - 1].label : '' },
      ] },
      { title: `Kết quả theo ${label}`, note: 'Xếp hạng theo điểm trung bình các bài làm, sau đó theo tiến độ; chỉ để tham khảo và so sánh cùng khoảng thời gian.', cols: [
        { header: 'Hạng', key: 'rank', width: 7, center: true }, { header: Label, key: 'label', width: 30 }, { header: 'Số lớp', key: 'classes', width: 9, center: true }, { header: 'Học sinh', key: 'students', width: 10, center: true },
        { header: 'Tham gia', key: 'participation', width: 11, pct: true }, { header: 'Tiến độ TB', key: 'avg_progress', width: 11, pct: true }, { header: 'Điểm TB', key: 'avg_percent', width: 11, pct: true }, { header: 'Tỉ lệ đúng', key: 'accuracy', width: 11, pct: true }], rows: r.groups },
      { title: 'Chi tiết từng lớp', cols: [
        { header: 'Lớp', key: 'class_name', width: 14, center: true }, { header: 'Khối', key: 'grade', width: 8, center: true }, { header: 'Giáo viên phụ trách', key: 'teachers', width: 30 }, { header: 'Học sinh', key: 'students', width: 10, center: true },
        { header: 'Tham gia', key: 'participation', width: 11, pct: true }, { header: 'Tiến độ TB', key: 'avg_progress', width: 11, pct: true }, { header: 'Điểm TB', key: 'avg_percent', width: 11, pct: true }, { header: 'Tỉ lệ đúng', key: 'accuracy', width: 11, pct: true }],
        rows: r.classes.map((c) => ({ ...c, teachers: c.teachers || 'Chưa phân công' })) },
    ];
    return this.send(format, `bao-cao-ket-qua-theo-${{ class: 'lop', grade: 'khoi', teacher: 'giao-vien' }[r.by]}`, head, sections);
  }

  /** Báo cáo sử dụng và trợ lý AI (tab "Sử dụng và AI"): tổng hợp, từng ngày (đủ mọi ngày trong kỳ), tư liệu được hỏi nhiều; AI chỉ thống kê số lượng và chủ đề */
  @Get('usage/export') @Roles('school_admin', 'root_admin')
  async exportUsage(@CurrentUser() user: UserRow, @Query() q: Json) {
    const format = fileFormat(q);
    const days = [7, 30, 90].includes(Number(q.days)) ? Number(q.days) : 30;
    const usage = await this.analytics.usage(user, 'day', days);
    const ai = (await this.analytics.aiUsage(user, days)) as Json;
    const school = user.role === 'school_admin' ? await this.analytics.reportSchool(user.school_id) : null;
    const now = new Date();
    const today = now.getTime() + 7 * 3_600_000;
    const calendar = Array.from({ length: days }, (_, i) => new Date(today - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10));
    const byDay = new Map(usage.items.map((i) => [i.bucket, i]));
    const aiByDay = new Map((ai.series as Array<{ day: string; questions: number }>).map((x) => [x.day, x.questions]));
    const range = `${days} ngày gần nhất (${dmy(calendar[0])} – ${dmy(calendar[calendar.length - 1])})`;
    const answered = ai.answers - ai.refused;
    const head: ReportHead = {
      identity: `Báo cáo sử dụng và trợ lý AI${school ? ` · ${school.name}${school.code ? ` · Mã trường ${school.code}` : ''}` : ' · Toàn hệ thống'}`, school, now,
      title: 'Báo cáo sử dụng học tập và trợ lý AI',
      meta: [{ label: 'Ngày xuất', value: vnDayLabel(now) }, { label: 'Khoảng thời gian', value: range }],
      signer: user.full_name,
    };
    const sections: ReportSection[] = [
      { title: 'Tổng hợp', note: 'Trợ lý AI chỉ được thống kê số lượng và chủ đề; nội dung câu hỏi của từng học sinh không có trong báo cáo.', cols: SUMMARY_COLS, rows: [
        { k: 'Bài học hoàn thành', v: String(usage.totals.lessons), n: '' },
        { k: 'Lượt làm quiz', v: String(usage.totals.quizzes), n: '' },
        { k: 'Trận đánh, mini-game', v: String(usage.totals.battles), n: '' },
        { k: 'Phòng thi đấu đã mở', v: String(usage.totals.rooms), n: '' },
        { k: 'Ngày có người học hoạt động', v: `${calendar.filter((d) => (byDay.get(d)?.users ?? 0) > 0).length} / ${days}`, n: '' },
        { k: 'Câu hỏi gửi Tiểu Tướng', v: String(ai.questions), n: `${ai.users} học sinh, giáo viên đã hỏi` },
        { k: 'Tiểu Tướng trả lời được', v: ai.answers ? pctText(Math.round((answered / ai.answers) * 100)) : '–', n: `${answered} / ${ai.answers} câu trả lời; ${ai.refused} câu ngoài phạm vi bị từ chối` },
        { k: 'Câu trả lời bị báo sai', v: String(ai.reported), n: '' },
        ...(ai.quota ? [{ k: 'Hạn mức câu hỏi hôm nay của trường', v: `${ai.quota.used_today} / ${ai.quota.limit}`, n: `còn ${ai.quota.remaining} lượt` }] : []),
      ] },
      { title: 'Theo ngày', cols: [
        { header: 'Ngày', key: 'day', width: 22, center: true }, { header: 'Người học hoạt động', key: 'users', width: 13, center: true }, { header: 'Bài học', key: 'lessons', width: 10, center: true }, { header: 'Quiz', key: 'quizzes', width: 10, center: true },
        { header: 'Trận đánh, mini-game', key: 'battles', width: 13, center: true }, { header: 'Phòng thi đấu', key: 'rooms', width: 11, center: true }, { header: 'Câu hỏi Tiểu Tướng', key: 'ai', width: 13, center: true }],
        rows: calendar.map((d) => { const u = byDay.get(d); return { day: vnDayLabel(new Date(`${d}T05:00:00Z`)), users: u?.users ?? 0, lessons: u?.lessons ?? 0, quizzes: u?.quizzes ?? 0, battles: u?.battles ?? 0, rooms: u?.rooms ?? 0, ai: aiByDay.get(d) ?? 0 }; }) },
      { title: 'Tư liệu được hỏi nhiều', cols: [{ header: 'Tư liệu', key: 'title', width: 50 }, { header: 'Loại', key: 'kind', width: 18, center: true }, { header: 'Lượt hỏi', key: 'asked', width: 12, center: true }],
        rows: (ai.topics as Array<{ kind: string; title: string; asked: number }>).map((t) => ({ ...t, kind: KIND_LABEL[t.kind] ?? t.kind })), empty: 'Chưa có câu hỏi nào được trả lời bằng tư liệu.' },
    ];
    return this.send(format, `bao-cao-su-dung-va-ai-${days}-ngay`, head, sections);
  }

  // ---------------------------------------------------------------------- quản trị trường và quản trị tổng
  @Get('school/overview') @Roles('school_admin') schoolOverview(@CurrentUser() user: UserRow) { return this.analytics.schoolOverview(user); }
  @Get('usage') @Roles('school_admin', 'root_admin') usage(@CurrentUser() user: UserRow, @Query() q: Json) { return this.analytics.usage(user, String(q.granularity ?? 'day'), q.days ? Number(q.days) : undefined); }
  @Get('ai') @Roles('school_admin', 'root_admin') ai(@CurrentUser() user: UserRow, @Query() q: Json) { return this.analytics.aiUsage(user, q.days ? Number(q.days) : undefined); }
  @Get('system/overview') @Roles('root_admin') systemOverview() { return this.analytics.systemOverview(); }
  @Get('system/content') @Roles('root_admin') content() { return this.analytics.contentStats(); }
}
