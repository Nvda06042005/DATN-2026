/**
 * Nhận xét học tập gửi email (Sprint 10, HK.GV.072): hệ thống dựng bản nháp nhận xét từ số liệu thật của học sinh (tiến độ, tỉ lệ đúng, chủ đề mạnh và yếu);
 * giáo viên đọc, sửa rồi chọn gửi cho học sinh và / hoặc phụ huynh (nếu hồ sơ có email). Thư đi qua hàng đợi email của hệ thống; mỗi lần gửi được ghi lại.
 * Mỗi học sinh nhận tối đa 5 thư nhận xét trong 24 giờ để tránh gửi nhầm lặp.
 */
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { MailService } from '../admin/mail.service';
import { DatabaseService, UserRow } from '../database/database.service';
import { AnalyticsService } from './analytics.service';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

@Injectable()
export class FeedbackService {
  constructor(private readonly db: DatabaseService, private readonly analytics: AnalyticsService, private readonly mail: MailService) {}

  async draft(user: UserRow, studentId: number) {
    const p = await this.analytics.studentProfile(user, studentId);
    const s = p.stats;
    const strong = p.topics.strong.map((t: { name: string }) => t.name);
    const weak = p.topics.weak.slice(0, 3).map((t: { name: string; percent: number }) => `${t.name} (${t.percent}%)`);
    const first = p.student.full_name.split(' ').slice(-1)[0];
    const lines = [
      `Kính gửi gia đình và em ${p.student.full_name},`,
      '',
      `Dưới đây là nhận xét học tập môn Lịch sử trên nền tảng Hào Khí Đông A của em ${first}:`,
      `• Tiến độ hành trình: ${s.progress ?? 0}% (${s.nodes_done}/${s.nodes_total} nút).`,
      s.avg_percent !== null ? `• Điểm trung bình các bài làm: ${s.avg_percent}%${s.accuracy !== null ? `, tỉ lệ trả lời đúng ${s.accuracy}% trên ${s.answered} câu` : ''}.` : '• Em chưa có bài làm nào được tính điểm.',
      `• Học ${s.active_days} ngày, khoảng ${s.study_minutes} phút; chuỗi ngày học hiện tại: ${s.streak}.`,
      strong.length ? `• Điểm mạnh: ${strong.join(', ')}.` : '',
      weak.length ? `• Cần ôn thêm: ${weak.join(', ')}. Em có thể dùng mục "Gợi ý học tập" để luyện đúng chủ đề này.` : '• Chưa có chủ đề nào cần ôn gấp.',
      '',
      'Thầy cô mong em tiếp tục duy trì việc học đều đặn mỗi ngày.',
      'Trân trọng,',
      user.full_name,
    ].filter((l, i, all) => !(l === '' && all[i - 1] === ''));
    return { subject: `Nhận xét học tập môn Lịch sử – ${p.student.full_name}`, body: lines.join('\n'), student: { id: p.student.id, full_name: p.student.full_name, has_email: Boolean(p.student.email) } };
  }

  async send(user: UserRow, studentId: number, body: { subject?: string; body?: string; to?: string[] }) {
    const subject = String(body.subject ?? '').trim(), text = String(body.body ?? '').trim();
    if (subject.length < 5 || subject.length > 150) throw new BadRequestException('Tiêu đề từ 5 đến 150 ký tự');
    if (text.length < 20 || text.length > 3000) throw new BadRequestException('Nội dung nhận xét từ 20 đến 3000 ký tự');
    const to = [...new Set((body.to ?? []).map(String))];
    // "Email phụ huynh" đã bỏ hẳn (13/11/2026, migration 062): thư nhận xét chỉ gửi cho học sinh
    if (!to.length || to.some((t) => t !== 'student')) throw new BadRequestException('Thư nhận xét chỉ gửi cho học sinh (student)');
    await this.analytics.studentProfile(user, studentId); // kiểm tra quyền xem học sinh này
    const st = (await this.db.query<{ id: number; full_name: string; email: string | null; school_id: number | null }>('SELECT id, full_name, email, school_id FROM app_users WHERE id = $1', [studentId]))[0];
    const targets = [{ kind: 'student' as const, email: st.email?.trim() ?? '' }];
    for (const t of targets) if (!EMAIL.test(t.email)) throw new BadRequestException('Học sinh chưa có email trong hồ sơ');
    const recent = Number((await this.db.query<{ n: string }>("SELECT count(*) AS n FROM hk_feedback_mails WHERE student_id = $1 AND created_at >= now() - interval '24 hours'", [studentId]))[0].n);
    if (recent + targets.length > 5) throw new ConflictException('Học sinh này đã nhận nhiều thư nhận xét trong 24 giờ qua; hãy thử lại vào ngày mai');
    await this.db.tx(async (q) => {
      for (const t of targets) {
        await this.mail.enqueue(q, { school_id: st.school_id, user_id: studentId, batch_id: null, kind: 'feedback', to: t.email, subject, payload: { type: 'note', text } });
        await q('INSERT INTO hk_feedback_mails (teacher_id, student_id, school_id, recipient, to_email, subject, body) VALUES ($1, $2, $3, $4, $5, $6, $7)', [user.id, studentId, st.school_id, t.kind, t.email, subject, text]);
      }
    });
    return { queued: targets.length, recipients: targets.map((t) => t.kind) };
  }

  async history(user: UserRow, studentId: number) {
    await this.analytics.studentProfile(user, studentId);
    return this.db.query('SELECT f.id::int AS id, f.recipient, f.subject, f.created_at, u.full_name AS teacher FROM hk_feedback_mails f LEFT JOIN app_users u ON u.id = f.teacher_id WHERE f.student_id = $1 ORDER BY f.id DESC LIMIT 20', [studentId]);
  }
}
