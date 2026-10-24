import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { AiService } from './ai/ai.service';
import { config } from './config';
import { DatabaseService } from './database/database.service';

@Controller()
export class AppController {
  constructor(
    private readonly db: DatabaseService,
    private readonly ai: AiService,
  ) {}

  @Get()
  root() {
    return { project: 'Hào Khí Đông A – backend NestJS', status: 'online', version: '2.0.0' };
  }

  @Get('health')
  async health() {
    return { status: 'healthy', ai_engine: (await this.ai.health()) ? 'operational' : 'unavailable', dataset_grounded: true };
  }

  /** Kiểm tra kết nối PostgreSQL (Supabase); migration chạy khi khởi động */
  @Get('database/health')
  async databaseHealth() {
    if (!config.databaseUrl) throw new ServiceUnavailableException('DATABASE_URL is not configured');
    try {
      if (!(await this.db.ping())) throw new Error('unexpected');
      return { status: 'connected', database: 'postgresql' };
    } catch {
      throw new ServiceUnavailableException('Database unavailable. Check connection settings on Render and Supabase.');
    }
  }
}
