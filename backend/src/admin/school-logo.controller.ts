import { Controller, Get, Header, Headers, NotFoundException, Param, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { DatabaseService } from '../database/database.service';

/** Chỉ ảnh nhận diện công khai; không cung cấp SQL, nguồn ngoài hay dữ liệu tài khoản. */
@Controller('school-logos')
export class SchoolLogoController {
  constructor(private readonly db: DatabaseService) {}

  @Get(':file')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Content-Security-Policy', "default-src 'none'")
  async image(@Param('file') file: string, @Headers('if-none-match') match: string | undefined, @Res({ passthrough: true }) res: Response) {
    const parsed = /^([a-f0-9]{64})\.webp$/.exec(file);
    if (!parsed) throw new NotFoundException('Không tìm thấy logo');
    const row = (await this.db.query<{ image_data: Buffer }>('SELECT image_data FROM public.app_school_logo_assets WHERE sha256 = $1', [parsed[1]]))[0];
    if (!row) throw new NotFoundException('Không tìm thấy logo');
    const etag = `"${parsed[1]}"`;
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    if (match?.split(',').some(value => value.trim().replace(/^W\//, '') === etag || value.trim() === '*')) {
      res.status(304); return;
    }
    return new StreamableFile(row.image_data, { type: 'image/webp', length: row.image_data.length });
  }
}
