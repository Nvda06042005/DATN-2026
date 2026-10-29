/**
 * Hàng đợi email trên PostgreSQL (bảng app_email_outbox): tiến trình nền khóa từng lô bằng FOR UPDATE SKIP LOCKED, gửi qua
 * SMTP (Nodemailer), lỗi thì thử lại có giãn cách. Không cần Redis: thư được ghi trong cùng giao dịch tạo tài khoản nên không
 * mất thư khi máy chủ khởi động lại. Nội dung có mật khẩu mặc định được mã hóa AES-256-GCM và xóa ngay khi gửi xong.
 * Chưa cấu hình SMTP thì thư nằm chờ; quản trị tải danh sách tài khoản (CSV) để phát tay.
 */
import { HttpException, Injectable, Logger, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { createTransport, Transporter } from 'nodemailer';
import { config } from '../config';
import { DatabaseService, Q } from '../database/database.service';

export type MailKind = 'bulk' | 'delta' | 'class';

/** Dữ liệu dựng thư: thông tin đăng nhập (bulk, delta) hoặc kết quả duyệt lớp */
export type MailPayload =
  | { type: 'account'; full_name: string; username: string; password: string; role: 'teacher' | 'student'; school: string }
  | { type: 'class'; full_name: string; class_name: string; class_code: string; school_year: string; approved: boolean; note: string | null };

/** Giãn cách giữa các lần thử lại (phút) */
const BACKOFF_MIN = [1, 5, 15, 60];
const MAX_ATTEMPTS = 5;
const BATCH = 20;

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

@Injectable()
export class MailService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Mail');
  private transport: Transporter | null = null;
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private nextTestAt = 0;
  /** Khóa mã hóa nội dung thư, suy ra từ AUTH_SECRET_KEY (không cần thêm biến bí mật) */
  private readonly key = createHash('sha256').update(`dong-a-outbox:${config.authSecret}`).digest();
  /** Thư đã "gửi" khi MAIL_TRANSPORT=json (kiểm thử, chạy thử trên máy) */
  readonly sent: Array<{ to: string; subject: string; text: string }> = [];

  constructor(private readonly db: DatabaseService) {}

  get configured(): boolean {
    return this.transport !== null;
  }

  get workerEnabled(): boolean {
    return this.configured && config.mailWorker;
  }

  get testRecipient(): string | null {
    return this.configured ? config.mailFrom : null;
  }

  async onModuleInit(): Promise<void> {
    // Cổng 2525 dùng STARTTLS; không gửi thông tin đăng nhập qua kết nối không mã hóa.
    const smtpOptions = { requireTLS: true, connectionTimeout: 20_000, greetingTimeout: 15_000, socketTimeout: 60_000 };
    if (config.mailTransport === 'json') this.transport = createTransport({ jsonTransport: true });
    else if (config.smtpUrl) this.transport = createTransport({ url: config.smtpUrl, ...smtpOptions });
    else if (config.smtpHost) {
      this.transport = createTransport({
        ...smtpOptions,
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpPort === 465,
        auth: config.smtpUser ? { user: config.smtpUser, pass: config.smtpPass } : undefined,
      });
    }
    if (!this.transport) {
      this.logger.warn('Chưa cấu hình SMTP – thư tài khoản nằm trong hàng đợi, tải danh sách CSV ở trang quản trị để phát tay');
      return;
    }
    if (config.mailTransport !== 'json') {
      try {
        // verify chỉ kiểm tra DNS/TCP/TLS và xác thực, không gửi email hay lấy thư khỏi hàng đợi.
        await this.transport.verify();
        this.logger.log('SMTP: kết nối TLS và xác thực thành công');
      } catch (exc) {
        const code = String((exc as { code?: string })?.code ?? 'UNKNOWN');
        // Không ghi lỗi thô vì có thể chứa thông tin máy chủ hoặc tài khoản SMTP.
        this.logger.warn(`SMTP chưa xác thực được (${/^[A-Z0-9_]+$/.test(code) ? code : 'UNKNOWN'}); kiểm tra cấu hình gửi thư trên Render`);
      }
    }
    if (config.mailWorker) this.timer = setInterval(() => void this.tick().catch(() => undefined), 4000);
  }

  /** Gửi ngay sau khi xếp thư (không chờ lượt 4 giây kế tiếp) */
  kick(): void {
    if (this.transport && config.mailWorker) void this.tick().catch(() => undefined);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.transport?.close();
  }

  /** Chỉ route quản trị tổng gọi: gửi về chính MAIL_FROM, độc lập với hàng đợi tài khoản. */
  async sendTest(): Promise<{ accepted: true; recipient: string }> {
    if (!this.transport || !config.mailFrom) throw new ServiceUnavailableException('Máy chủ chưa cấu hình gửi thư.');
    if (Date.now() < this.nextTestAt) throw new HttpException('Vui lòng chờ 60 giây giữa các lần gửi thư kiểm tra.', 429);
    this.nextTestAt = Date.now() + 60_000;
    const subject = '[Đông A EDU] Kiểm tra gửi email';
    const text = `Đây là thư kiểm tra cấu hình gửi email của Đông A EDU, được yêu cầu từ cổng quản trị tổng.\nWebsite: ${config.appUrl}\nNếu bạn nhận được thư này, đường gửi email từ backend đến hộp thư đã hoạt động.`;
    try {
      await this.transport.sendMail({ from: config.mailFrom, to: config.mailFrom, subject, text, html: `<p>${escapeHtml(text).replace(/\n/g, '</p><p>')}</p>` });
      if (config.mailTransport === 'json') this.sent.push({ to: config.mailFrom, subject, text });
      this.logger.log('SMTP: máy chủ thư đã nhận thư kiểm tra');
      return { accepted: true, recipient: config.mailFrom };
    } catch (exc) {
      const code = String((exc as { code?: string })?.code ?? 'UNKNOWN');
      this.logger.warn(`Gửi thư kiểm tra thất bại (${/^[A-Z0-9_]+$/.test(code) ? code : 'UNKNOWN'})`);
      throw new ServiceUnavailableException('Không gửi được thư kiểm tra. Kiểm tra trạng thái SMTP trên máy chủ.');
    }
  }

  /** Thư đặt lại mật khẩu gửi thẳng, không qua hàng đợi: liên kết chứa mã dùng một lần nên không lưu ở bảng thư */
  async sendPasswordReset(to: string, fullName: string, link: string, minutes: number): Promise<void> {
    if (!this.transport) throw new ServiceUnavailableException('Máy chủ chưa cấu hình gửi thư.');
    const subject = '[Đông A EDU] Đặt lại mật khẩu';
    const lines = [
      `Chào ${fullName},`,
      '',
      'Đông A EDU nhận được yêu cầu đặt lại mật khẩu cho tài khoản quản trị của bạn.',
      `Mở liên kết sau để đặt mật khẩu mới (hiệu lực ${minutes} phút, chỉ dùng được một lần):`,
      link,
      '',
      'Nếu không phải bạn yêu cầu, hãy bỏ qua thư này: mật khẩu hiện tại vẫn giữ nguyên.',
    ];
    const html = lines.map((l) => (l === link ? `<p><a href="${escapeHtml(l)}">${escapeHtml(l)}</a></p>` : l ? `<p>${escapeHtml(l)}</p>` : '')).join('');
    await this.transport.sendMail({ from: config.mailFrom, to, subject, text: lines.join('\n'), html });
    if (config.mailTransport === 'json') this.sent.push({ to, subject, text: lines.join('\n') });
  }

  encrypt(payload: MailPayload): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const body = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
  }

  decrypt(text: string | null): MailPayload | null {
    if (!text) return null;
    try {
      const raw = Buffer.from(text, 'base64');
      const decipher = createDecipheriv('aes-256-gcm', this.key, raw.subarray(0, 12));
      decipher.setAuthTag(raw.subarray(12, 28));
      return JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8')) as MailPayload;
    } catch {
      return null;
    }
  }

  /** Ghi thư vào hàng đợi (trong giao dịch của người gọi, cùng phạm vi trường) */
  async enqueue(q: Q, e: { school_id: number; user_id: number; batch_id: number | null; kind: MailKind; to: string; subject: string; payload: MailPayload }): Promise<void> {
    await q(
      'INSERT INTO app_email_outbox (school_id, user_id, batch_id, kind, to_email, subject, body_encrypted) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [e.school_id, e.user_id, e.batch_id, e.kind, e.to, e.subject, this.encrypt(e.payload)],
    );
  }

  render(payload: MailPayload): { text: string; html: string } {
    const login = `${config.appUrl}/portal`;
    if (payload.type === 'account') {
      const lines = [
        `Chào ${payload.full_name},`,
        '',
        `${payload.school} đã cấp cho bạn tài khoản ${payload.role === 'teacher' ? 'giáo viên' : 'học sinh'} trên Đông A EDU.`,
        `Tên đăng nhập: ${payload.username}`,
        `Mật khẩu mặc định: ${payload.password}`,
        `Đăng nhập tại: ${login}`,
        '',
        'Lần đăng nhập đầu tiên, hệ thống sẽ yêu cầu bạn đặt mật khẩu mới. Không chia sẻ mật khẩu cho người khác.',
      ];
      return { text: lines.join('\n'), html: lines.map((l) => (l ? `<p>${escapeHtml(l)}</p>` : '')).join('') };
    }
    const lines = [
      `Chào ${payload.full_name},`,
      '',
      payload.approved
        ? `Yêu cầu mở lớp "${payload.class_name}" (mã ${payload.class_code}, năm học ${payload.school_year}) đã được duyệt. Bạn có thể gửi mã lớp và mật khẩu lớp cho học sinh.`
        : `Yêu cầu mở lớp "${payload.class_name}" (mã ${payload.class_code}, năm học ${payload.school_year}) chưa được duyệt.`,
      payload.note ? `Ghi chú của quản trị: ${payload.note}` : '',
      `Xem chi tiết tại: ${config.appUrl}/giao-vien`,
    ].filter((l, i) => l !== '' || i === 1);
    return { text: lines.join('\n'), html: lines.map((l) => (l ? `<p>${escapeHtml(l)}</p>` : '')).join('') };
  }

  /** Xử lý một lô thư đến hạn; trả về số thư gửi thành công */
  async tick(): Promise<number> {
    if (!this.transport || this.running || !this.db.ready) return 0;
    this.running = true;
    let sent = 0;
    try {
      const jobs = await this.db.query<{ id: number; kind: MailKind; to_email: string; subject: string; body_encrypted: string | null; attempts: number; user_id: number | null }>(
        `UPDATE app_email_outbox SET status = 'sending', locked_at = now(), attempts = attempts + 1
         WHERE id IN (
           SELECT id FROM app_email_outbox
           WHERE (status = 'queued' AND next_attempt_at <= now()) OR (status = 'sending' AND locked_at < now() - interval '10 minutes')
           ORDER BY id LIMIT ${BATCH} FOR UPDATE SKIP LOCKED)
         RETURNING id, kind, to_email, subject, body_encrypted, attempts, user_id`,
      );
      for (const job of jobs) {
        const payload = this.decrypt(job.body_encrypted);
        if (!payload) {
          await this.db.query("UPDATE app_email_outbox SET status = 'failed', last_error = $2, body_encrypted = NULL WHERE id = $1", [job.id, 'Không giải mã được nội dung (khóa máy chủ đã đổi)']);
          continue;
        }
        if (payload.type === 'account' && job.user_id) {
          // Người dùng đã đổi mật khẩu hoặc tài khoản vào thùng rác: mật khẩu mặc định không còn dùng được, không gửi nữa
          const u = await this.db.query<{ must_change_password: number; deleted_at: Date | null }>('SELECT must_change_password, deleted_at FROM app_users WHERE id = $1', [job.user_id]);
          if (!u.length || !u[0].must_change_password || u[0].deleted_at) {
            await this.db.query("UPDATE app_email_outbox SET status = 'cancelled', body_encrypted = NULL, locked_at = NULL WHERE id = $1", [job.id]);
            continue;
          }
        }
        const { text, html } = this.render(payload);
        try {
          await this.transport.sendMail({ from: config.mailFrom, to: job.to_email, subject: job.subject, text, html });
          if (config.mailTransport === 'json') this.sent.push({ to: job.to_email, subject: job.subject, text });
          await this.db.query("UPDATE app_email_outbox SET status = 'sent', sent_at = now(), body_encrypted = NULL, last_error = NULL, locked_at = NULL WHERE id = $1", [job.id]);
          sent += 1;
        } catch (exc) {
          const final = job.attempts >= MAX_ATTEMPTS;
          const wait = BACKOFF_MIN[Math.min(BACKOFF_MIN.length - 1, job.attempts - 1)];
          await this.db.query(
            `UPDATE app_email_outbox SET status = $2, last_error = $3, locked_at = NULL, next_attempt_at = now() + ($4 || ' minutes')::interval${final ? ', body_encrypted = NULL' : ''} WHERE id = $1`,
            [job.id, final ? 'failed' : 'queued', String((exc as Error)?.message ?? 'SMTP lỗi').slice(0, 300), String(wait)],
          );
        }
      }
    } finally {
      this.running = false;
    }
    return sent;
  }
}
