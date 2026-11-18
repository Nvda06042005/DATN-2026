import { Controller, Get, Query, ServiceUnavailableException } from '@nestjs/common';
import { AiTutorService } from './ai/ai-tutor.service';
import { keepAliveState } from './platform/keep-alive';
import { engineHealth } from './ai/python-runtime';
import { config } from './config';
import { DatabaseService } from './database/database.service';

@Controller()
export class AppController {
  constructor(private readonly db: DatabaseService, private readonly tutor: AiTutorService) {}

  @Get()
  root() {
    return { project: 'Hào Khí Đông A – backend NestJS', status: 'online', version: '3.0.0' };
  }

  @Get('health')
  health(@Query('warm') warm?: string) {
    const commit = process.env.RENDER_GIT_COMMIT;
    // `?warm=ai` (lịch keep-alive của GitHub Actions, 17/11/2026): nạp lại mô hình AI Python nếu đang tắt – không chờ, không cần đăng nhập
    const warming = warm === 'ai' ? this.tutor.warm() : false;
    // ai_engine: trợ lý AI đang dùng mô hình Python (mode "python") hay chế độ dự phòng, kèm lý do và bộ nhớ (python-runtime.ts)
    return { status: 'healthy', commit: /^[a-f0-9]{40}$/.test(commit ?? '') ? commit : null, ai_engine: engineHealth(), keep_alive: keepAliveState(), ...(warm === 'ai' ? { warming } : {}) };
  }

  /** Kiểm tra kết nối PostgreSQL (Supabase); migration chạy khi khởi động */
  @Get('database/health')
  async databaseHealth() {
    if (!config.databaseUrl) throw new ServiceUnavailableException('DATABASE_URL is not configured');
    try {
      if (!(await this.db.ping())) throw new Error('unexpected');
      const rows = await this.db.query<{ version: number | null }>('SELECT max(version) AS version FROM public.app_schema_migrations');
      const retention = await this.db.query<{ retention: { enabled: boolean; retention_years: number; database_schedule: boolean; backend_fallback: boolean } }>('SELECT public.app_deleted_records_status() AS retention');
      return { status: 'connected', database: 'postgresql', schema_version: Number(rows[0]?.version ?? 0), deletion_archive: retention[0]?.retention };
    } catch {
      throw new ServiceUnavailableException('Database unavailable. Check connection settings on Render and Supabase.');
    }
  }
}
