import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Put, Query, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { UploadedXlsx, XLSX_MIME, XLSX_UPLOAD } from '../admin/excel';
import { AuthGuard, CurrentUser, Roles } from '../auth/auth.guard';
import { UserRow } from '../database/database.service';
import { HistoryService, Status } from './history.service';

/** Tên số nhiều trong đường dẫn -> loại dữ liệu; chấp nhận cả tên số ít */
const ENTITY_PATH: Record<string, string> = {
  campaigns: 'campaign', figures: 'figure', events: 'event', places: 'place', battles: 'battle', sources: 'source', terms: 'term',
  campaign: 'campaign', figure: 'figure', event: 'event', place: 'place', battle: 'battle', source: 'source', term: 'term',
};
const entityOf = (path: string): string => ENTITY_PATH[path] ?? path;

class ListQuery {
  @IsOptional() @IsString() @MaxLength(80) q?: string;
  @IsOptional() @IsIn(['draft', 'verified', 'published']) status?: Status;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) campaign_id?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) place_id?: number;
  @IsOptional() @IsIn(['king', 'general', 'official', 'other']) figure_group?: string;
  @IsOptional() @IsIn(['su_lieu', 'tho_van', 'hich', 'hinh_anh', 'ban_do_co']) kind?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
}

class StatusDto {
  @IsIn(['draft', 'verified', 'published']) status: Status;
  @IsOptional() @IsString() @MaxLength(300) note?: string | null;
}

class RestoreDto {
  @Type(() => Number) @IsInt() @Min(1) version: number;
}

class DiffQuery {
  @Type(() => Number) @IsInt() @Min(1) from: number;
  @Type(() => Number) @IsInt() @Min(1) to: number;
}

class TimelineQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) campaign_id?: number;
}

class OrderDto {
  @IsArray() @ArrayMaxSize(500) @IsInt({ each: true }) event_ids: number[];
}

class ImportQuery {
  @IsOptional() @IsIn(['true', 'false']) commit?: 'true' | 'false';
}

class ExportQuery {
  @IsOptional() @IsIn(['json', 'xlsx']) format?: 'json' | 'xlsx';
}

/**
 * /api/admin/history – kho dữ liệu lịch sử (HK.AD.028–042). Chỉ quản trị tổng. Đường dẫn tĩnh (specs, timeline, export, import) khai báo trước
 * đường dẫn theo loại (:entity) để không bị bắt nhầm.
 */
@Controller('admin/history')
@UseGuards(AuthGuard)
@Roles('root_admin')
export class HistoryController {
  constructor(private readonly history: HistoryService) {}

  @Get('specs')
  specs() { return this.history.specs(); }

  @Get('overview')
  overview() { return this.history.overview(); }

  @Get('timeline')
  timeline(@Query() query: TimelineQuery) { return this.history.timeline(query.campaign_id); }

  @Put('timeline/:campaignId/order')
  reorder(@CurrentUser() user: UserRow, @Param('campaignId', ParseIntPipe) campaignId: number, @Body() body: OrderDto) { return this.history.reorderTimeline(user, campaignId, body.event_ids); }

  @Get('export')
  async export(@Query() query: ExportQuery) {
    if (query.format === 'xlsx') return new StreamableFile(await this.history.exportXlsx(), { type: XLSX_MIME, disposition: 'attachment; filename="kho-lich-su.xlsx"' });
    return new StreamableFile(Buffer.from(JSON.stringify(await this.history.exportJson(), null, 2), 'utf8'), { type: 'application/json; charset=utf-8', disposition: 'attachment; filename="kho-lich-su.json"' });
  }

  @Get('template')
  async template() { return new StreamableFile(await this.history.templateXlsx(), { type: XLSX_MIME, disposition: 'attachment; filename="mau-kho-lich-su.xlsx"' }); }

  @Post('import')
  @HttpCode(200)
  @UseInterceptors(XLSX_UPLOAD)
  importFile(@CurrentUser() user: UserRow, @Query() query: ImportQuery, @UploadedFile() file: UploadedXlsx | undefined) { return this.history.importDoc(user, file, query.commit === 'true'); }

  @Get(':entity')
  list(@Param('entity') entity: string, @Query() query: ListQuery) { return this.history.list(entityOf(entity), query); }

  @Post(':entity')
  create(@CurrentUser() user: UserRow, @Param('entity') entity: string, @Body() body: Record<string, unknown>) { return this.history.create(user, entityOf(entity), body); }

  @Get(':entity/:id')
  get(@Param('entity') entity: string, @Param('id', ParseIntPipe) id: number) { return this.history.get(entityOf(entity), id); }

  @Patch(':entity/:id')
  update(@CurrentUser() user: UserRow, @Param('entity') entity: string, @Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>) { return this.history.update(user, entityOf(entity), id, body); }

  @Delete(':entity/:id')
  @HttpCode(204)
  async remove(@Param('entity') entity: string, @Param('id', ParseIntPipe) id: number) { await this.history.remove(entityOf(entity), id); }

  @Post(':entity/:id/status')
  @HttpCode(200)
  status(@CurrentUser() user: UserRow, @Param('entity') entity: string, @Param('id', ParseIntPipe) id: number, @Body() body: StatusDto) { return this.history.setStatus(user, entityOf(entity), id, body.status, body.note); }

  @Get(':entity/:id/versions')
  versions(@Param('entity') entity: string, @Param('id', ParseIntPipe) id: number) { return this.history.versions(entityOf(entity), id); }

  @Get(':entity/:id/diff')
  diff(@Param('entity') entity: string, @Param('id', ParseIntPipe) id: number, @Query() query: DiffQuery) { return this.history.diff(entityOf(entity), id, query.from, query.to); }

  @Get(':entity/:id/versions/:no')
  version(@Param('entity') entity: string, @Param('id', ParseIntPipe) id: number, @Param('no', ParseIntPipe) no: number) { return this.history.version(entityOf(entity), id, no); }

  @Post(':entity/:id/restore')
  @HttpCode(200)
  restore(@CurrentUser() user: UserRow, @Param('entity') entity: string, @Param('id', ParseIntPipe) id: number, @Body() body: RestoreDto) { return this.history.restore(user, entityOf(entity), id, body.version); }
}
