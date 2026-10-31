import { Controller, Get, ServiceUnavailableException, StreamableFile } from '@nestjs/common';
import { AiService } from './ai/ai.service';
import { config } from './config';
import { DatabaseService } from './database/database.service';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
/** File mẫu dùng lại trong 10 phút (dịch vụ AI gói miễn phí khởi động chậm) */
const TEMPLATE_TTL_MS = 10 * 60_000;

@Controller()
export class AppController {
  private template: { at: number; file: Buffer } | null = null;

  constructor(
    private readonly db: DatabaseService,
    private readonly ai: AiService,
  ) {}

  /** File Excel mẫu công khai (không cần đăng nhập): nhà trường tải về, điền rồi gửi quản trị trường/giáo viên nhập */
  @Get('public/excel-template')
  async excelTemplate() {
    if (!this.template || Date.now() - this.template.at > TEMPLATE_TTL_MS) this.template = { at: Date.now(), file: await this.ai.excelTemplate() };
    return new StreamableFile(this.template.file, { type: XLSX_MIME, disposition: 'attachment; filename="mau-tai-khoan-dong-a.xlsx"' });
  }

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
      const rows = await this.db.query<{version:number|null}>('SELECT max(version) AS version FROM public.app_schema_migrations');
      return { status: 'connected', database: 'postgresql', schema_version: Number(rows[0]?.version ?? 0) };
    } catch {
      throw new ServiceUnavailableException('Database unavailable. Check connection settings on Render and Supabase.');
    }
  }
}
