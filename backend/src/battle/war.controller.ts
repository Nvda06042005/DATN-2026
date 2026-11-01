import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser, Roles } from '../auth/auth.guard';
import { DatabaseService, UserRow } from '../database/database.service';
import { WarCardsService } from './war-cards.service';
import { WarGate } from './war-gate';
import { WarMarchService } from './war-march.service';
import { WarService } from './war.service';

type Json = Record<string, any>;
const PLAYERS = ['student', 'teacher', 'school_admin', 'root_admin'] as const;

/**
 * /api/war – game mô phỏng trận đánh bằng thẻ tướng (Sprint 6 theo ver0.2): thẻ tướng, đội hình, bản đồ hành quân, màn chơi và trận đánh do máy chủ xử lý.
 * Học sinh chơi; giáo viên và quản trị chơi thử (xem trước); quản trị tổng soạn thẻ, chiêu thức, bản đồ, hội thoại, màn chơi, chỉ huy, tài nguyên; quản trị trường đặt giờ chơi.
 */
@Controller('war')
@UseGuards(AuthGuard)
export class WarController {
  constructor(private readonly cards: WarCardsService, private readonly march: WarMarchService, private readonly war: WarService, private readonly gate: WarGate, private readonly db: DatabaseService) {}

  @Get('status') @Roles('student') status(@CurrentUser() user: UserRow) { return this.db.tx((q) => this.gate.status(q, user)); }

  // ------------------------------------------------------------------ thẻ tướng, đội hình, sổ tay
  @Get('cards') @Roles('student') collection(@CurrentUser() user: UserRow) { return this.cards.collection(user); }
  @Get('cards/:id') @Roles('student') card(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.cards.detail(user, id); }
  @Post('cards/:id/upgrade') @Roles('student') @HttpCode(200) upgrade(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.cards.upgrade(user, id, body.kind === 'star' ? 'star' : 'level'); }
  @Get('formations') @Roles('student') formations(@CurrentUser() user: UserRow) { return this.cards.formations(user); }
  @Put('formations/:slot') @Roles('student') saveFormation(@CurrentUser() user: UserRow, @Param('slot', ParseIntPipe) slot: number, @Body() body: Json) { return this.cards.saveFormation(user, slot, body); }
  @Get('commanders') @Roles('student') commanders(@CurrentUser() user: UserRow) { return this.cards.commanders(user); }

  // ------------------------------------------------------------------ bản đồ hành quân
  @Get('march') @Roles('student') marchList(@CurrentUser() user: UserRow) { return this.march.list(user); }
  @Get('march/log') @Roles('student') marchLog(@CurrentUser() user: UserRow) { return this.march.log(user); }
  @Post('march/move') @Roles('student') @HttpCode(200) move(@CurrentUser() user: UserRow, @Body() body: Json) { return this.march.move(user, Number(body.point_id)); }
  @Post('march/points/:id/answer') @Roles('student') @HttpCode(200) answerPoint(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.march.answerQuiz(user, id, body.answer); }
  @Get('march/:campaignId') @Roles('student') marchMap(@CurrentUser() user: UserRow, @Param('campaignId', ParseIntPipe) id: number) { return this.march.map(user, id); }

  // ------------------------------------------------------------------ màn chơi và trận đánh
  @Get('stages') @Roles('student') stages(@CurrentUser() user: UserRow) { return this.war.stages(user); }
  @Get('stages/:id') @Roles(...PLAYERS) intro(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.war.intro(user, id); }
  @Post('stages/:id/start') @Roles('student') @HttpCode(200) start(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.war.start(user, id, body); }
  @Post('stages/:id/preview') @Roles('teacher', 'school_admin', 'root_admin') @HttpCode(200) preview(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.war.preview(user, id); }
  @Post('stages/:id/skip') @Roles('student') @HttpCode(200) skip(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.war.skip(user, id); }
  @Get('stages/:id/truth') @Roles(...PLAYERS) truth(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.war.truth(user, id); }
  @Get('battles/:id') @Roles(...PLAYERS) battle(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.war.battle(user, id); }
  @Post('battles/:id/act') @Roles(...PLAYERS) @HttpCode(200) act(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.war.act(user, id, body as never); }
  @Post('battles/:id/answer') @Roles(...PLAYERS) @HttpCode(200) answer(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.war.answer(user, id, body.answer); }

  // ------------------------------------------------------------------ giờ chơi của trường (HK.QT.056)
  @Get('school-war') @Roles('school_admin', 'root_admin') schoolWar(@CurrentUser() user: UserRow, @Query('school_id') schoolId?: string) { return this.war.schoolWar(this.school(user, schoolId)); }
  @Put('school-war') @Roles('school_admin', 'root_admin') updateSchoolWar(@CurrentUser() user: UserRow, @Body() body: Json, @Query('school_id') schoolId?: string) { return this.war.updateSchoolWar(user, this.school(user, schoolId), body); }
  private school(user: UserRow, raw?: string): number {
    const id = user.role === 'school_admin' ? user.school_id : Number(raw);
    if (!id || !Number.isInteger(id)) throw new BadRequestException('Hãy chỉ rõ school_id');
    return id;
  }

  // ------------------------------------------------------------------ quản trị tổng
  @Get('admin/cards') @Roles('root_admin') adminCards() { return this.cards.adminCards(); }
  @Get('admin/cards/:id') @Roles('root_admin') adminCard(@Param('id', ParseIntPipe) id: number) { return this.cards.adminCard(id); }
  @Put('admin/cards/:id') @Roles('root_admin') updateCard(@Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.cards.updateCardWar(id, body); }
  @Put('admin/cards/:id/moves/:slot') @Roles('root_admin') upsertMove(@Param('id', ParseIntPipe) id: number, @Param('slot') slot: string, @Body() body: Json) { return this.cards.upsertMove(id, slot, body); }
  @Delete('admin/cards/:id/moves/:slot') @Roles('root_admin') deleteMove(@Param('id', ParseIntPipe) id: number, @Param('slot') slot: string) { return this.cards.deleteMove(id, slot); }

  @Get('admin/maps') @Roles('root_admin') adminMaps() { return this.march.adminMaps(); }
  @Post('admin/maps') @Roles('root_admin') createMap(@Body() body: Json) { return this.march.createMap(body); }
  @Get('admin/maps/:id') @Roles('root_admin') adminMap(@Param('id', ParseIntPipe) id: number) { return this.march.adminMap(id); }
  @Put('admin/maps/:id') @Roles('root_admin') updateMap(@Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.march.updateMap(id, body); }
  @Put('admin/maps/:id/layout') @Roles('root_admin') layout(@Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.march.saveLayout(id, body); }
  @Post('admin/maps/:id/status') @Roles('root_admin') @HttpCode(200) mapStatus(@Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.march.setMapStatus(id, body.status); }
  @Delete('admin/maps/:id') @Roles('root_admin') @HttpCode(204) async deleteMap(@Param('id', ParseIntPipe) id: number) { await this.march.deleteMap(id); }

  @Get('admin/dialogs') @Roles('root_admin') adminDialogs() { return this.march.adminDialogs(); }
  @Post('admin/dialogs') @Roles('root_admin') createDialog(@Body() body: Json) { return this.march.createDialog(body); }
  @Get('admin/dialogs/:id') @Roles('root_admin') adminDialog(@Param('id', ParseIntPipe) id: number) { return this.march.adminDialog(id); }
  @Put('admin/dialogs/:id') @Roles('root_admin') updateDialog(@Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.march.updateDialog(id, body); }
  @Post('admin/dialogs/:id/status') @Roles('root_admin') @HttpCode(200) dialogStatus(@Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.march.setDialogStatus(id, body.status); }
  @Delete('admin/dialogs/:id') @Roles('root_admin') @HttpCode(204) async deleteDialog(@Param('id', ParseIntPipe) id: number) { await this.march.deleteDialog(id); }

  @Get('admin/options') @Roles('root_admin') options() { return this.war.battleOptions(); }
  @Get('admin/stages') @Roles('root_admin') adminStages() { return this.war.adminStages(); }
  @Post('admin/stages') @Roles('root_admin') createStage(@CurrentUser() user: UserRow, @Body() body: Json) { return this.war.createStage(user, body); }
  @Get('admin/stages/:id') @Roles('root_admin') adminStage(@Param('id', ParseIntPipe) id: number) { return this.war.adminStage(id); }
  @Put('admin/stages/:id') @Roles('root_admin') updateStage(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.war.updateStage(user, id, body); }
  @Post('admin/stages/:id/status') @Roles('root_admin') @HttpCode(200) stageStatus(@Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.war.setStageStatus(id, body.status); }
  @Post('admin/stages/:id/balance') @Roles('root_admin') @HttpCode(200) balance(@Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.war.balance(id, body); }
  @Delete('admin/stages/:id') @Roles('root_admin') @HttpCode(204) async deleteStage(@Param('id', ParseIntPipe) id: number) { await this.war.deleteStage(id); }

  @Get('admin/commanders') @Roles('root_admin') adminCommanders() { return this.war.adminCommanders(); }
  @Post('admin/commanders') @Roles('root_admin') createCommander(@Body() body: Json) { return this.war.createCommander(body); }
  @Put('admin/commanders/:id') @Roles('root_admin') updateCommander(@Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.war.updateCommander(id, body); }
  @Delete('admin/commanders/:id') @Roles('root_admin') @HttpCode(204) async deleteCommander(@Param('id', ParseIntPipe) id: number) { await this.war.deleteCommander(id); }

  @Get('admin/assets') @Roles('root_admin') assets() { return this.war.assets(); }
  @Post('admin/assets') @Roles('root_admin') addAsset(@CurrentUser() user: UserRow, @Body() body: Json) { return this.war.addAsset(user, body); }
  @Delete('admin/assets/:id') @Roles('root_admin') @HttpCode(204) async deleteAsset(@Param('id', ParseIntPipe) id: number) { await this.war.deleteAsset(id); }
}
