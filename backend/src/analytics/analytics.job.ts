/**
 * Tính nội bộ sau khi khởi động và mỗi giờ, theo một bộ quy tắc chung toàn hệ thống.
 * Không có API tính lười hoặc nút tính lại từ giao diện. Tắt bằng ANALYTICS_JOB=off (kiểm thử).
 */
import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RecoService } from './reco.service';

@Injectable()
export class AnalyticsJob implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('AnalyticsJob');
  private timer: NodeJS.Timeout | null = null;
  private startup: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly db: DatabaseService, private readonly reco: RecoService) {}

  onApplicationBootstrap(): void {
    // Nest khởi tạo các provider cùng module song song. Đợi mọi onModuleInit
    // (gồm migration/database) hoàn tất rồi mới kiểm tra ready và lên lịch.
    if (process.env.ANALYTICS_JOB === 'off' || !this.db.ready) return;
    this.startup = setTimeout(() => void this.run(), 10_000);
    this.startup.unref?.();
    this.timer = setInterval(() => void this.run(), 60 * 60_000);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.startup) clearTimeout(this.startup);
  }

  async run(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try { return await this.reco.refreshStale(200); } catch (e) { this.logger.warn(`Việc chạy nền lỗi: ${(e as Error).message}`); return 0; } finally { this.running = false; }
  }
}
