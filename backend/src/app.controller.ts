import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { engineHealth } from './ai/python-runtime';
import { config } from './config';
import { DatabaseService } from './database/database.service';

@Controller()
export class AppController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  root() {
    return { project: 'Hào Khí Đông A – backend NestJS', status: 'online', version: '3.0.0' };
  }

  @Get('health')
  health() {
    const commit = process.env.RENDER_GIT_COMMIT;
    // ai_engine: trợ lý AI đang dùng mô hình Python (mode "python") hay chế độ dự phòng, kèm lý do và bộ nhớ (python-runtime.ts)
    return { status: 'healthy', commit: /^[a-f0-9]{40}$/.test(commit ?? '') ? commit : null, ai_engine: engineHealth() };
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
