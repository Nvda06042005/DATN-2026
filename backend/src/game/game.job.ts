/**
 * Việc chạy nền của trò chơi hóa (HK.SYS.003, 004, 006): bù chuỗi ngày và tim cho người chơi sau nửa đêm, chốt giải đấu tuần, trao thưởng sự kiện đã kết thúc.
 * Các quy tắc đều tính lười khi người chơi dùng ứng dụng nên kết quả đúng kể cả khi máy chủ ngủ (gói miễn phí); việc chạy nền chỉ dọn cho những người không vào app.
 * Tắt bằng GAME_JOB=off (kiểm thử).
 */
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { BoardService } from './board.service';
import { GameService } from './game.service';

@Injectable()
export class GameJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('GameJob');
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly db: DatabaseService, private readonly game: GameService, private readonly board: BoardService) {}

  onModuleInit(): void {
    if (process.env.GAME_JOB === 'off' || !this.db.ready) return;
    this.timer = setInterval(() => void this.run(), 10 * 60_000);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async run(): Promise<{ streaks: number; weeks: number; contests: number }> {
    if (this.running) return { streaks: 0, weeks: 0, contests: 0 };
    this.running = true;
    try {
      const schools = await this.db.query<{ id:number; school_id:number | null }>(`SELECT DISTINCT ON (coalesce(school_id,-id)) id,school_id FROM app_users
        WHERE role<>'root_admin' AND deleted_at IS NULL ORDER BY coalesce(school_id,-id),id`);
      const totals = {streaks:0,weeks:0,contests:0};
      for (const user of schools) await this.db.withWorkspace({...user,role:'student'},async()=>{
        totals.streaks += await this.game.settleAll();
        totals.weeks += await this.db.tx((q)=>this.board.settleLeagues(q));
        totals.contests += await this.board.settleContests();
      });
      return totals;
    } catch (e) {
      this.logger.warn(`Việc chạy nền lỗi: ${(e as Error).message}`);
      return { streaks: 0, weeks: 0, contests: 0 };
    } finally {
      this.running = false;
    }
  }
}
