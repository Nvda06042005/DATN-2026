import { Logger } from '@nestjs/common';
import { createServer as createHttpServer } from 'http';
import { AddressInfo, createServer, Socket } from 'net';
import { MailService } from '../src/admin/mail.service';
import { config } from '../src/config';
import type { DatabaseService } from '../src/database/database.service';

describe('Kiểm tra SMTP trước khi gửi thư', () => {
  test('chưa cấu hình SMTP thì không gửi thư kiểm tra hoặc truy cập hàng đợi', async () => {
    const query = jest.fn();
    const mail = new MailService({ ready: true, query } as unknown as DatabaseService);
    await expect(mail.sendTest()).rejects.toMatchObject({ status: 503 });
    expect(mail.testRecipient).toBeNull();
    expect(mail.workerEnabled).toBe(false);
    expect(query).not.toHaveBeenCalled();
  });

  test('gửi kiểm tra về chính người gửi, giới hạn 60 giây và không lấy thư tài khoản khỏi hàng đợi', async () => {
    const saved = { ...config };
    Object.assign(config, { mailTransport: 'json', mailWorker: false, mailFrom: 'Đông A EDU <sender@example.test>' });
    const query = jest.fn();
    const mail = new MailService({ ready: true, query } as unknown as DatabaseService);
    try {
      await mail.onModuleInit();
      expect(mail.testRecipient).toBe('Đông A EDU <sender@example.test>');
      expect(mail.workerEnabled).toBe(false);
      await expect(mail.sendTest()).resolves.toEqual({ accepted: true, recipient: 'Đông A EDU <sender@example.test>' });
      expect(mail.sent).toHaveLength(1);
      expect(mail.sent[0]).toMatchObject({ to: 'Đông A EDU <sender@example.test>', subject: '[Đông A EDU] Kiểm tra gửi email' });
      expect(mail.sent[0].text).toContain('cấu hình gửi email');
      await expect(mail.sendTest()).rejects.toMatchObject({ status: 429 });
      expect(mail.sent).toHaveLength(1);
      expect(query).not.toHaveBeenCalled();
    } finally {
      mail.onModuleDestroy();
      Object.assign(config, saved);
    }
  });

  test('lỗi gửi kiểm tra không lộ phản hồi SMTP thô hoặc bí mật', async () => {
    const query = jest.fn();
    const mail = new MailService({ ready: true, query } as unknown as DatabaseService);
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    Object.assign(mail, { transport: { sendMail: jest.fn().mockRejectedValue(Object.assign(new Error('dummy-private-key SMTP response'), { code: 'EAUTH' })), close: jest.fn() } });
    try {
      await expect(mail.sendTest()).rejects.toMatchObject({ status: 503, message: 'Không gửi được thư kiểm tra. Kiểm tra trạng thái SMTP trên máy chủ.' });
      expect(warn).toHaveBeenCalledWith('Gửi thư kiểm tra thất bại (EAUTH)');
      expect(JSON.stringify(warn.mock.calls)).not.toContain('dummy-private-key');
      expect(query).not.toHaveBeenCalled();
    } finally {
      mail.onModuleDestroy();
      warn.mockRestore();
    }
  });

  describe('cầu gửi thư qua HTTPS (Apps Script) cho nơi chặn cổng SMTP', () => {
    const SECRET = 'relay-test-secret-0123456789';
    type Hit = { secret?: string; action?: string; to?: string; subject?: string; text?: string; html?: string; name?: string };
    let hits: Hit[];
    let respond: (hit: Hit) => string;
    let server: ReturnType<typeof createHttpServer>;
    let saved: typeof config;
    let warn: jest.SpyInstance;

    beforeEach(async () => {
      hits = [];
      respond = (hit) => JSON.stringify(hit.secret === SECRET ? { ok: true } : { ok: false, error: 'unauthorized' });
      server = createHttpServer((req, res) => {
        let raw = '';
        req.on('data', (chunk) => (raw += chunk));
        req.on('end', () => {
          const hit = JSON.parse(raw) as Hit;
          hits.push(hit);
          res.writeHead(200, { 'Content-Type': 'application/json' }).end(respond(hit));
        });
      });
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      saved = { ...config };
      warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      Object.assign(config, {
        mailTransport: '', mailWorker: false, smtpUrl: '', smtpHost: '', mailFrom: 'Đông A EDU <sender@example.test>',
        mailRelayUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}/exec`, mailRelaySecret: SECRET,
      });
    });

    afterEach(async () => {
      Object.assign(config, saved);
      warn.mockRestore();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    test('xác thực khi khởi động không gửi thư; thư đặt lại mật khẩu và thư kiểm tra đi qua cầu với đúng nội dung', async () => {
      const mail = new MailService({ ready: true, query: jest.fn() } as unknown as DatabaseService);
      await mail.onModuleInit();
      expect(mail.configured).toBe(true);
      expect(hits).toEqual([{ secret: SECRET, action: 'verify' }]);

      await mail.sendPasswordReset('quan.tri@example.test', 'Quản Trị', 'https://site.test/admin?reset=abc123', 30);
      expect(hits).toHaveLength(2);
      expect(hits[1]).toMatchObject({ secret: SECRET, to: 'quan.tri@example.test', subject: '[Đông A EDU] Đặt lại mật khẩu', name: 'Đông A EDU' });
      expect(hits[1].text).toContain('https://site.test/admin?reset=abc123');
      expect(hits[1].html).toContain('<a href="https://site.test/admin?reset=abc123">');

      // Thư kiểm tra gửi về "Tên <địa chỉ>": cầu nhận địa chỉ trần
      await mail.sendTest();
      expect(hits[2]).toMatchObject({ to: 'sender@example.test', subject: '[Đông A EDU] Kiểm tra gửi email' });
      mail.onModuleDestroy();
    });

    test('sai khóa hoặc phản hồi không phải JSON: lỗi chỉ mang mã, không lộ khóa hay phản hồi thô', async () => {
      const mail = new MailService({ ready: true, query: jest.fn() } as unknown as DatabaseService);
      respond = () => JSON.stringify({ ok: false, error: 'unauthorized' });
      await mail.onModuleInit();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('Cầu gửi thư chưa xác thực được (ERELAYAUTH)'));
      await expect(mail.sendPasswordReset('quan.tri@example.test', 'Quản Trị', 'https://site.test/x', 30)).rejects.toMatchObject({ code: 'ERELAYAUTH' });

      respond = () => '<html>Trang lỗi của Google</html>';
      await expect(mail.sendPasswordReset('quan.tri@example.test', 'Quản Trị', 'https://site.test/x', 30)).rejects.toMatchObject({ code: 'ERELAYRESPONSE' });

      respond = () => JSON.stringify({ ok: false, error: 'Service invoked too many times for one day: email.' });
      await expect(mail.sendPasswordReset('quan.tri@example.test', 'Quản Trị', 'https://site.test/x', 30)).rejects.toMatchObject({ code: 'ERELAYSEND' });
      await expect(mail.sendPasswordReset('không-phải-email', 'Quản Trị', 'https://site.test/x', 30)).rejects.toMatchObject({ code: 'ERELAYRECIPIENT' });
      expect(JSON.stringify(warn.mock.calls)).not.toContain(SECRET);
      mail.onModuleDestroy();
    });

    test('thiếu địa chỉ hoặc khóa thì không dùng cầu (rơi về SMTP, chưa cấu hình thì không gửi)', async () => {
      Object.assign(config, { mailRelaySecret: '' });
      const mail = new MailService({ ready: true, query: jest.fn() } as unknown as DatabaseService);
      await mail.onModuleInit();
      expect(mail.configured).toBe(false);
      expect(hits).toEqual([]);
    });
  });

  test.each(['host', 'url'])('từ chối máy chủ không nâng cấp TLS (%s), không truyền mật khẩu hay gửi thư', async (mode) => {
    const commands: string[] = [];
    const sockets = new Set<Socket>();
    const server = createServer((socket) => {
      sockets.add(socket);
      socket.on('error', () => undefined);
      socket.on('close', () => sockets.delete(socket));
      socket.write('220 smtp-test ESMTP\r\n');
      let pending = '';
      socket.on('data', (data) => {
        pending += data.toString('utf8');
        let end: number;
        while ((end = pending.indexOf('\r\n')) !== -1) {
          const line = pending.slice(0, end);
          pending = pending.slice(end + 2);
          commands.push(line);
          if (line.startsWith('EHLO')) socket.write('250-smtp-test\r\n250 AUTH PLAIN LOGIN\r\n');
          else if (line === 'STARTTLS') socket.write('502 TLS unavailable\r\n');
          else if (line === 'QUIT') socket.end('221 Bye\r\n');
          else socket.write('500 Unexpected command\r\n');
        }
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;
    const saved = { ...config };
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const query = jest.fn();
    const mail = new MailService({ ready: true, query } as unknown as DatabaseService);
    Object.assign(config, {
      mailTransport: '', mailWorker: false,
      smtpUrl: mode === 'url' ? `smtp://smtp-test-user:dummy-test-key@127.0.0.1:${port}` : '',
      smtpHost: '127.0.0.1', smtpPort: port, smtpUser: 'smtp-test-user', smtpPass: 'dummy-test-key',
    });
    try {
      await mail.onModuleInit();
      expect(commands).toContain('STARTTLS');
      expect(commands.some((line) => /^(AUTH|MAIL|RCPT|DATA)\b/.test(line))).toBe(false);
      expect(query).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('SMTP chưa xác thực được (ETLS)'));
      expect(JSON.stringify(warn.mock.calls)).not.toMatch(/dummy-test-key|smtp-test-user/);
    } finally {
      mail.onModuleDestroy();
      Object.assign(config, saved);
      warn.mockRestore();
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
