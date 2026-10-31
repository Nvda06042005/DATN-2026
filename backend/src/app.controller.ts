import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
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
    return { status: 'healthy' };
  }

  /** Kiểm tra kết nối PostgreSQL (Supabase); migration chạy khi khởi động */
  @Get('database/health')
  async databaseHealth() {
    if (!config.databaseUrl) throw new ServiceUnavailableException('DATABASE_URL is not configured');
    try {
      if (!(await this.db.ping())) throw new Error('unexpected');
      const rows = await this.db.query<{ version: number | null }>('SELECT max(version) AS version FROM public.app_schema_migrations');
      return { status: 'connected', database: 'postgresql', schema_version: Number(rows[0]?.version ?? 0) };
    } catch {
      throw new ServiceUnavailableException('Database unavailable. Check connection settings on Render and Supabase.');
    }
  }
}
