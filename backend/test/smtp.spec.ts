import { Logger } from '@nestjs/common';
import { AddressInfo, createServer, Socket } from 'net';
import { MailService } from '../src/admin/mail.service';
import { config } from '../src/config';
import type { DatabaseService } from '../src/database/database.service';

describe('Kiểm tra SMTP trước khi gửi thư', () => {
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
