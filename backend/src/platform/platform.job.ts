/**
 * Việc nền của nhóm nền tảng (Sprint 11, HK.SYS.017, HK.SYS.019): mỗi phút gửi các thông báo đã đến giờ hẹn; mỗi 5 phút tạo thông báo tự động (nhắc học, bài tập sắp
 * hết hạn, lên cấp, huy hiệu); mỗi giờ kiểm tra sao lưu hằng ngày và dọn dữ liệu cũ. Mỗi lượt ghi nhịp chạy để trang giám sát biết việc nền còn sống.
 * Máy chủ miễn phí có thể "ngủ": các việc đều có khóa chống trùng nên chạy bù khi thức dậy không gửi lặp. Tắt bằng PLATFORM_JOB=off (kiểm thử).
 */
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { BackupService } from './backup.service';
import { ErrorLog } from './error-log';
import { NoticeService } from './notice.service';
import { SurveyService } from './survey.service';
import { SystemService } from './system.service';

@Injectable()
export class PlatformJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('PlatformJob');
  private timer: NodeJS.Timeout | null = null;
  private ticks = 0;
  private running = false;

  constructor(private readonly db: DatabaseService, private readonly notices: NoticeService, private readonly backups: BackupService, private readonly system: SystemService, private readonly surveys: SurveyService) {}

  onModuleInit(): void {
    if (process.env.PLATFORM_JOB === 'off' || !this.db.ready) return;
    this.timer = setInterval(() => void this.tick(), 60_000);
    this.timer.unref?.();
  }

  onModuleDestroy(): void { if (this.timer) clearInterval(this.timer); }

  private async step(job: string, fn: () => Promise<unknown>): Promise<void> {
    try { await fn(); await this.system.beat(job, true); } catch (e) {
      const message = (e as Error).message;
      this.logger.warn(`Việc ${job} lỗi: ${message}`);
      ErrorLog.report('job', `Việc ${job}: ${message}`);
      await this.system.beat(job, false, message);
    }
  }

  /** Một nhịp 1 phút; `force` cho kiểm thử chạy cả các việc 5 phút và hằng giờ */
  async tick(force: { automatic?: boolean; hourly?: boolean } = {}): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      this.ticks += 1;
      await this.step('broadcasts', () => this.notices.dispatchDue());
      await this.step('surveys', () => this.surveys.dispatchDue());
      if (force.automatic || this.ticks % 5 === 0) await this.step('notices_auto', () => this.notices.automatic());
      if (force.hourly || this.ticks % 60 === 1) {
        await this.step('backup', () => this.backups.autoIfDue());
        await this.step('retention', async () => {
          await this.db.query("DELETE FROM hk_error_log WHERE created_at < now() - interval '90 days'");
          await this.db.query('DELETE FROM hk_two_factor_codes WHERE expires_at < now() - interval \'1 day\'');
        });
      }
    } finally {
      this.running = false;
    }
  }
}
