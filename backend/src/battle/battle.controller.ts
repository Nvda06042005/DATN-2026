import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser, Roles } from '../auth/auth.guard';
import { UserRow } from '../database/database.service';
import { BattleService, MinigameInput, ScenarioInput } from './battle.service';
import { MiniKind } from './engine';

/** Mẫu kịch bản để người soạn sửa lại (HK.AD.046): một bước quyết định và một bước bố trí lực lượng, kèm hoạt ảnh hai khung */
const SCENARIO_TEMPLATE = {
  intro: { situation: 'Mô tả tình hình trước trận: bối cảnh, thời điểm, đối phương.', forces: 'Lực lượng hai bên (chỉ ghi số liệu đã được tư liệu xác nhận).', objective: 'Nhiệm vụ của người chỉ huy trong trận này.' },
  map: { center: [21.03, 105.85], zoom: 9 },
  steps: [
    {
      id: 'b1', type: 'decision', title: 'Quyết định đầu tiên', situation: 'Tình huống cần người chơi lựa chọn.',
      options: [
        { id: 'a', text: 'Phương án đúng theo lịch sử', score: 25, feedback: 'Giải thích vì sao đúng, đối chiếu diễn biến thật.', consequence: 'Hệ quả của lựa chọn này.' },
        { id: 'b', text: 'Phương án chưa phù hợp', score: 0, feedback: 'Vì sao chưa phù hợp, lịch sử thật đã làm gì.', consequence: 'Hệ quả của lựa chọn này.' },
      ],
    },
    {
      id: 'b2', type: 'placement', title: 'Bố trí lực lượng', situation: 'Đặt các lực lượng vào đúng khu vực trên bản đồ.', score: 25,
      pieces: [{ id: 'p1', label: 'Lực lượng 1' }],
      zones: [{ id: 'z1', label: 'Khu vực đúng', lat: 21.03, lng: 105.85, radius_km: 15 }, { id: 'z2', label: 'Khu vực sai', lat: 20.2, lng: 106.3, radius_km: 15 }],
      accept: { p1: ['z1'] }, feedback_ok: 'Bố trí hợp lý so với lịch sử.', feedback_bad: 'Bố trí chưa hợp lý; lịch sử thật đặt lực lượng này ở khu vực khác.',
    },
  ],
  animation: {
    title: 'Diễn biến trận đánh',
    frames: [
      { label: 'Trước trận', text: 'Vị trí hai bên.', units: [{ id: 'u1', side: 'tran', label: 'Quân Trần', lat: 21.0, lng: 105.8 }, { id: 'u2', side: 'dich', label: 'Quân đối phương', lat: 21.2, lng: 106.0 }] },
      { label: 'Trong trận', text: 'Hai bên giao chiến.', units: [{ id: 'u1', side: 'tran', label: 'Quân Trần', lat: 21.1, lng: 105.9 }, { id: 'u2', side: 'dich', label: 'Quân đối phương', lat: 21.15, lng: 105.95 }] },
    ],
  },
  pass_percent: 60,
  bonus_points: 150,
};

/**
 * /api/battle – mô phỏng trận đánh theo lượt và mini-game (Sprint 6). Học sinh chơi; giáo viên, quản trị viên trường và quản trị tổng chơi thử (xem trước);
 * quản trị tổng soạn kịch bản (JSON) và tham số mini-game. Đường dẫn tĩnh khai báo trước đường dẫn có :id.
 */
@Controller('battle')
@UseGuards(AuthGuard)
export class BattleController {
  constructor(private readonly battle: BattleService) {}

  // ------------------------------------------------------------------ người chơi
  @Get('list') @Roles('student', 'teacher', 'school_admin', 'root_admin') list(@CurrentUser() user: UserRow) { return this.battle.list(user); }
  @Get('scenarios/:id') @Roles('student', 'teacher', 'school_admin', 'root_admin') intro(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.battle.intro(user, id); }
  @Get('scenarios/:id/animation') @Roles('student', 'teacher', 'school_admin', 'root_admin') animation(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.battle.animation(user, id); }
  @Post('scenarios/:id/start') @Roles('student', 'teacher', 'school_admin', 'root_admin') @HttpCode(200)
  startScenario(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>) { return this.battle.startScenario(user, id, { restart: body.restart === true, preview: body.preview === true }); }
  @Post('minigames/:id/start') @Roles('student', 'teacher', 'school_admin', 'root_admin') @HttpCode(200)
  startMinigame(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>) { return this.battle.startMinigame(user, id, { restart: body.restart === true, preview: body.preview === true }); }

  @Get('runs/:id') @Roles('student', 'teacher', 'school_admin', 'root_admin') run(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.battle.run(user, id); }
  @Post('runs/:id/answer') @Roles('student', 'teacher', 'school_admin', 'root_admin') @HttpCode(200)
  answer(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>) { return this.battle.answer(user, id, body); }
  @Post('runs/:id/finish') @Roles('student', 'teacher', 'school_admin', 'root_admin') @HttpCode(200)
  finish(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.battle.finish(user, id); }

  // ------------------------------------------------------------------ quản trị tổng: kịch bản (HK.AD.046)
  @Get('admin/scenarios') @Roles('root_admin') adminScenarios() { return this.battle.adminScenarios(); }
  @Get('admin/battles') @Roles('root_admin') battleOptions() { return this.battle.battleOptions(); }
  @Get('admin/scenario-template') @Roles('root_admin') template() { return SCENARIO_TEMPLATE; }
  @Post('admin/scenarios/validate') @Roles('root_admin') @HttpCode(200) validateScenario(@Body() body: Record<string, unknown>) { return this.battle.validateScenario(body.content); }
  @Get('admin/scenarios/:id') @Roles('root_admin') adminScenario(@Param('id', ParseIntPipe) id: number) { return this.battle.adminScenario(id); }
  @Post('admin/scenarios') @Roles('root_admin') createScenario(@CurrentUser() user: UserRow, @Body() body: ScenarioInput) { return this.battle.createScenario(user, body); }
  @Put('admin/scenarios/:id') @Roles('root_admin') updateScenario(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: ScenarioInput) { return this.battle.updateScenario(user, id, body); }
  @Post('admin/scenarios/:id/status') @Roles('root_admin') @HttpCode(200) scenarioStatus(@Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>) { return this.battle.setScenarioStatus(id, String(body.status)); }
  @Delete('admin/scenarios/:id') @Roles('root_admin') @HttpCode(204) async deleteScenario(@Param('id', ParseIntPipe) id: number) { await this.battle.deleteScenario(id); }

  // ------------------------------------------------------------------ quản trị tổng: mini-game (HK.AD.047)
  @Get('admin/minigames') @Roles('root_admin') adminMinigames() { return this.battle.adminMinigames(); }
  @Post('admin/minigames/validate') @Roles('root_admin') @HttpCode(200) validateMinigame(@Body() body: Record<string, unknown>) { return this.battle.validateMinigame(body.kind as MiniKind, body.params); }
  @Get('admin/minigames/:id') @Roles('root_admin') adminMinigame(@Param('id', ParseIntPipe) id: number) { return this.battle.adminMinigame(id); }
  @Post('admin/minigames') @Roles('root_admin') createMinigame(@CurrentUser() user: UserRow, @Body() body: MinigameInput) { return this.battle.createMinigame(user, body); }
  @Put('admin/minigames/:id') @Roles('root_admin') updateMinigame(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: MinigameInput) { return this.battle.updateMinigame(user, id, body); }
  @Post('admin/minigames/:id/status') @Roles('root_admin') @HttpCode(200) minigameStatus(@Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>) { return this.battle.setMinigameStatus(id, String(body.status)); }
  @Delete('admin/minigames/:id') @Roles('root_admin') @HttpCode(204) async deleteMinigame(@Param('id', ParseIntPipe) id: number) { await this.battle.deleteMinigame(id); }
}
