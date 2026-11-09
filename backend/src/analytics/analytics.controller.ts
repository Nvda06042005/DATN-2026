import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query, StreamableFile, UseGuards } from '@nestjs/common';
import { XLSX_MIME } from '../admin/excel';
import { AuthGuard, CurrentUser, Roles } from '../auth/auth.guard';
import { UserRow } from '../database/database.service';
import { AnalyticsService, Period } from './analytics.service';
import { toPdf, toXlsx, Section } from './export';
import { FeedbackService } from './feedback.service';
import { RecoService } from './reco.service';

type Json = Record<string, any>;
const STAFF = ['teacher', 'school_admin', 'root_admin'] as const;
const period = (q: Json): Period => ({ from: typeof q.from === 'string' ? q.from : undefined, to: typeof q.to === 'string' ? q.to : undefined });
const when = (iso: string | null): string => (iso ? new Date(iso).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'chưa lần nào');

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
  @Get('classes/:id/export') @Roles(...STAFF)
  async exportClass(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Query() q: Json) {
    const format = q.format === 'pdf' ? 'pdf' : q.format === 'xlsx' || q.format === undefined ? 'xlsx' : null;
    if (!format) throw new BadRequestException('Định dạng là xlsx hoặc pdf');
    const p = period(q);
    const { info, dash, topics, assignments } = await this.analytics.exportRows(user, id, p);
    const range = p.from || p.to ? `${p.from ?? '…'} đến ${p.to ?? '…'}` : 'toàn bộ thời gian';
    const sections: Section[] = [
      { title: 'Tổng quan', cols: [{ header: 'Chỉ số', key: 'k', width: 34 }, { header: 'Giá trị', key: 'v', width: 20, right: true }], rows: [
        { k: 'Số học sinh', v: dash.students }, { k: 'Tiến độ trung bình (%)', v: dash.avg_progress ?? '' }, { k: 'Tỉ lệ hoàn thành hành trình (%)', v: dash.completion_rate ?? '' }, { k: 'Điểm trung bình các bài làm (%)', v: dash.avg_percent ?? '' },
        { k: 'Tỉ lệ trả lời đúng (%)', v: dash.accuracy ?? '' }, { k: 'Học sinh hoạt động trong 7 ngày', v: dash.active_week }, { k: 'Học sinh giữ chuỗi từ 3 ngày', v: dash.streak_holders }] },
      { title: 'Học sinh', cols: [
        { header: 'Họ và tên', key: 'full_name', width: 26 }, { header: 'Mã học sinh', key: 'user_code', width: 14 }, { header: 'Tiến độ (%)', key: 'progress', width: 12, right: true }, { header: 'Điểm TB (%)', key: 'avg_percent', width: 12, right: true },
        { header: 'Tỉ lệ đúng (%)', key: 'accuracy', width: 14, right: true }, { header: 'Số bài làm', key: 'attempts', width: 11, right: true }, { header: 'Phút học', key: 'study_minutes', width: 10, right: true },
        { header: 'Ngày học', key: 'active_days', width: 10, right: true }, { header: 'Hoạt động gần nhất', key: 'last', width: 18 }], rows: dash.roster.map((r) => ({ ...r, last: when(r.last_active_at) })) },
      { title: 'Chủ đề cần ôn', cols: [{ header: 'Loại', key: 'type', width: 16 }, { header: 'Chủ đề', key: 'name', width: 36 }, { header: 'Số câu', key: 'answered', width: 10, right: true }, { header: 'Đúng (%)', key: 'percent', width: 10, right: true }], rows: topics.weak as unknown as Array<Record<string, unknown>> },
      { title: 'Bài tập', cols: [{ header: 'Bài tập', key: 'title', width: 34 }, { header: 'Loại', key: 'kind', width: 12 }, { header: 'Hạn nộp', key: 'due', width: 16 }, { header: 'Đã nộp', key: 'submitted', width: 10, right: true }, { header: 'Điểm TB (%)', key: 'avg_percent', width: 12, right: true }],
        rows: (assignments as Json[]).map((a) => ({ ...a, due: when(a.due_at) })) },
    ];
    const title = `Báo cáo lớp ${info.name}`;
    const subtitle = `${info.school_name} · ${info.teachers ?? ''} · Khoảng thời gian: ${range}`;
    const file = `bao-cao-lop-${info.name.replace(/[^\p{L}\p{N}]+/gu, '-')}`;
    return format === 'pdf'
      ? new StreamableFile(await toPdf(title, subtitle, sections), { type: 'application/pdf', disposition: `attachment; filename="${file}.pdf"` })
      : new StreamableFile(await toXlsx(title, sections), { type: XLSX_MIME, disposition: `attachment; filename="${file}.xlsx"` });
  }

  @Get('export') @Roles('school_admin', 'root_admin')
  async exportResults(@CurrentUser() user: UserRow, @Query() q: Json) {
    const format = q.format === 'pdf' ? 'pdf' : q.format === 'xlsx' || q.format === undefined ? 'xlsx' : null;
    if (!format) throw new BadRequestException('Định dạng là xlsx hoặc pdf');
    const p = period(q);
    const r = await this.analytics.results(user, (q.by ?? 'class') as 'class', p);
    const label = { class: 'lớp', grade: 'khối', teacher: 'giáo viên' }[r.by];
    const sections: Section[] = [
      { title: `Kết quả theo ${label}`, cols: [
        { header: 'Hạng', key: 'rank', width: 7, right: true }, { header: label[0].toUpperCase() + label.slice(1), key: 'label', width: 32 }, { header: 'Số lớp', key: 'classes', width: 9, right: true }, { header: 'Học sinh', key: 'students', width: 10, right: true },
        { header: 'Tham gia (%)', key: 'participation', width: 13, right: true }, { header: 'Tiến độ TB (%)', key: 'avg_progress', width: 14, right: true }, { header: 'Điểm TB (%)', key: 'avg_percent', width: 12, right: true }, { header: 'Tỉ lệ đúng (%)', key: 'accuracy', width: 13, right: true }], rows: r.groups },
      { title: 'Chi tiết từng lớp', cols: [
        { header: 'Lớp', key: 'class_name', width: 14 }, { header: 'Khối', key: 'grade', width: 7, right: true }, { header: 'Giáo viên', key: 'teachers', width: 30 }, { header: 'Học sinh', key: 'students', width: 10, right: true },
        { header: 'Tham gia (%)', key: 'participation', width: 13, right: true }, { header: 'Tiến độ TB (%)', key: 'avg_progress', width: 14, right: true }, { header: 'Điểm TB (%)', key: 'avg_percent', width: 12, right: true }], rows: r.classes },
    ];
    const range = p.from || p.to ? `${p.from ?? '…'} đến ${p.to ?? '…'}` : 'toàn bộ thời gian';
    const title = `Báo cáo kết quả theo ${label}`;
    return format === 'pdf'
      ? new StreamableFile(await toPdf(title, `Khoảng thời gian: ${range}`, sections), { type: 'application/pdf', disposition: 'attachment; filename="bao-cao-ket-qua.pdf"' })
      : new StreamableFile(await toXlsx(title, sections), { type: XLSX_MIME, disposition: 'attachment; filename="bao-cao-ket-qua.xlsx"' });
  }

  // ---------------------------------------------------------------------- quản trị trường và quản trị tổng
  @Get('school/overview') @Roles('school_admin') schoolOverview(@CurrentUser() user: UserRow) { return this.analytics.schoolOverview(user); }
  @Get('usage') @Roles('school_admin', 'root_admin') usage(@CurrentUser() user: UserRow, @Query() q: Json) { return this.analytics.usage(user, String(q.granularity ?? 'day'), q.days ? Number(q.days) : undefined); }
  @Get('ai') @Roles('school_admin', 'root_admin') ai(@CurrentUser() user: UserRow, @Query() q: Json) { return this.analytics.aiUsage(user, q.days ? Number(q.days) : undefined); }
  @Get('system/overview') @Roles('root_admin') systemOverview() { return this.analytics.systemOverview(); }
  @Get('system/content') @Roles('root_admin') content() { return this.analytics.contentStats(); }
}
