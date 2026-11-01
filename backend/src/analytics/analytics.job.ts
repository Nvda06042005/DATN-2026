/**
 * Việc nền của gợi ý học tập (Sprint 10, HK.SYS.012): mỗi giờ tính lại gợi ý cho học sinh còn hoạt động mà gợi ý đã cũ hơn số giờ cấu hình (HK.AD.063).
 * Gợi ý cũng được tính lười khi học sinh mở màn nên kết quả đúng kể cả khi máy chủ ngủ (gói miễn phí). Tắt bằng ANALYTICS_JOB=off (kiểm thử).
 */
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RecoService } from './reco.service';

@Injectable()
export class AnalyticsJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('AnalyticsJob');
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly db: DatabaseService, private readonly reco: RecoService) {}

  onModuleInit(): void {
    if (process.env.ANALYTICS_JOB === 'off' || !this.db.ready) return;
    this.timer = setInterval(() => void this.run(), 60 * 60_000);
    this.timer.unref?.();
  }

  onModuleDestroy(): void { if (this.timer) clearInterval(this.timer); }

  async run(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try { return await this.reco.refreshStale(200); } catch (e) { this.logger.warn(`Việc chạy nền lỗi: ${(e as Error).message}`); return 0; } finally { this.running = false; }
  }
}
