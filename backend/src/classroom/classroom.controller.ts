import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Put, Query, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard, CurrentUser, Roles } from '../auth/auth.guard';
import { UploadedXlsx, XLSX_MIME, XLSX_UPLOAD } from '../admin/excel';
import { UserRow } from '../database/database.service';
import { AssignmentService } from './assignment.service';
import { ClassroomService, RANDOM_EVENTS } from './classroom.service';
import { SkillService } from './skill.service';

type Json = Record<string, any>;
const STAFF = ['teacher', 'school_admin'] as const;

/**
 * /api/classroom – lớp học (Sprint 7): giáo viên quản lý lớp, học sinh, đội, luật lớp, thưởng/phạt, bài tập, kỹ năng; học sinh xem "Lớp học của tôi", đội, bài tập, thông báo.
 * Đường dẫn tĩnh khai báo trước đường dẫn có :id.
 */
@Controller('classroom')
@UseGuards(AuthGuard)
export class ClassroomController {
  constructor(private readonly rooms: ClassroomService, private readonly assignments: AssignmentService, private readonly skills: SkillService) {}

  // ------------------------------------------------------------------ giáo viên: lớp (HK.GV.007–011)
  @Get('classes') @Roles(...STAFF) classes(@CurrentUser() user: UserRow) { return this.rooms.myClasses(user); }
  @Post('classes') @Roles('teacher') create(@CurrentUser() user: UserRow, @Body() body: Json) { return this.rooms.createClass(user, body as never); }
  @Get('students-template') @Roles(...STAFF) async template() { return new StreamableFile(await this.rooms.studentTemplate(), { type: XLSX_MIME, disposition: 'attachment; filename="mau-them-hoc-sinh.xlsx"' }); }
  @Get('random-events') @Roles(...STAFF) randomEvents() { return RANDOM_EVENTS.map((e) => ({ id: e.id, label: e.label })); }
  @Get('classes/:id') @Roles(...STAFF) detail(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.rooms.classDetail(user, id); }
  @Patch('classes/:id') @Roles(...STAFF) update(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.rooms.updateClass(user, id, body); }
  @Post('classes/:id/archive') @Roles(...STAFF) @HttpCode(200) archive(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.rooms.archive(user, id, body.archived !== false); }
  @Delete('classes/:id') @Roles(...STAFF) @HttpCode(204) async remove(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { await this.rooms.removeClass(user, id); }
  @Post('classes/:id/regenerate-code') @Roles(...STAFF) @HttpCode(200) regenerate(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.rooms.regenerateCode(user, id); }
  @Post('classes/:id/join') @Roles(...STAFF) @HttpCode(200) join(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.rooms.setJoinOpen(user, id, body.open === true); }

  // ------------------------------------------------------------------ giáo viên: học sinh (HK.GV.012–015)
  @Get('classes/:id/student-pool') @Roles(...STAFF) pool(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Query('q') q?: string) { return this.rooms.searchStudents(user, id, q ?? ''); }
  @Get('classes/:id/students') @Roles(...STAFF) students(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Query('q') q?: string) { return this.rooms.students(user, id, q); }
  @Post('classes/:id/students') @Roles(...STAFF) @HttpCode(200) addStudents(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.rooms.addStudents(user, id, body.student_ids); }
  @Post('classes/:id/students/import') @Roles(...STAFF) @HttpCode(200) @UseInterceptors(XLSX_UPLOAD)
  importStudents(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @UploadedFile() file: UploadedXlsx | undefined) { return this.rooms.importStudents(user, id, file); }
  @Delete('classes/:id/students/:userId') @Roles(...STAFF) @HttpCode(204)
  async removeStudent(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Param('userId', ParseIntPipe) userId: number) { await this.rooms.removeStudent(user, id, userId); }

  // ------------------------------------------------------------------ đội, rời lớp, thông báo
  @Get('classes/:id/teams') @Roles(...STAFF) teams(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.rooms.teams(user, id); }
  @Post('classes/:id/teams/auto') @Roles(...STAFF) @HttpCode(200) autoTeams(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.rooms.autoTeams(user, id, Number(body.size ?? 5)); }
  @Put('classes/:id/teams') @Roles(...STAFF) setTeams(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.rooms.setTeams(user, id, body.teams); }
  @Get('classes/:id/leave-requests') @Roles(...STAFF) leaves(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.rooms.leaveRequests(user, id); }
  @Post('leave-requests/:rid/decide') @Roles(...STAFF) @HttpCode(200) decide(@CurrentUser() user: UserRow, @Param('rid', ParseIntPipe) rid: number, @Body() body: Json) { return this.rooms.decideLeave(user, rid, body.approve === true); }
  @Post('classes/:id/announcements') @Roles(...STAFF) announce(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.rooms.announce(user, id, body as never); }
  @Get('classes/:id/announcements') @Roles(...STAFF) announcements(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.rooms.announcements(user, id); }

  // ------------------------------------------------------------------ luật lớp, thưởng/phạt, sự kiện, hộp quà, huy hiệu, bảng xếp hạng, tiến độ (HK.GV.028, 059–065)
  @Get('classes/:id/rules') @Roles(...STAFF) rules(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.rooms.rules(user, id); }
  @Put('classes/:id/rules') @Roles(...STAFF) setRules(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.rooms.setRules(user, id, body); }
  @Post('classes/:id/adjust') @Roles(...STAFF) @HttpCode(200) adjust(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.rooms.adjust(user, id, body); }
  @Get('classes/:id/history') @Roles(...STAFF) history(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.rooms.history(user, id); }
  @Post('classes/:id/random-event') @Roles(...STAFF) @HttpCode(200) randomEvent(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.rooms.randomEvent(user, id, body); }
  @Get('classes/:id/goals') @Roles(...STAFF) goals(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.rooms.goals(user, id); }
  @Post('classes/:id/goals') @Roles(...STAFF) createGoal(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.rooms.createGoal(user, id, body as never); }
  @Post('goals/:gid/open') @Roles(...STAFF) @HttpCode(200) openGoal(@CurrentUser() user: UserRow, @Param('gid', ParseIntPipe) gid: number) { return this.rooms.openGoal(user, gid); }
  @Delete('goals/:gid') @Roles(...STAFF) @HttpCode(204) async deleteGoal(@CurrentUser() user: UserRow, @Param('gid', ParseIntPipe) gid: number) { await this.rooms.deleteGoal(user, gid); }
  @Post('classes/:id/badges/:badgeId/award') @Roles(...STAFF) @HttpCode(200)
  award(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Param('badgeId', ParseIntPipe) badgeId: number, @Body() body: Json) { return this.rooms.awardBadge(user, id, badgeId, body); }
  @Get('classes/:id/board') @Roles(...STAFF) board(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Query('period') period?: string) { return this.rooms.classBoard(user, id, period); }
  @Get('classes/:id/progress') @Roles(...STAFF) progress(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Query('journey_id') journeyId?: string) { return this.rooms.journeyProgress(user, id, journeyId ? Number(journeyId) : undefined); }

  // ------------------------------------------------------------------ giáo viên: bài tập (HK.GV.045–050)
  @Get('classes/:id/assignments') @Roles(...STAFF) assignmentList(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.assignments.list(user, id); }
  @Post('classes/:id/assignments') @Roles(...STAFF) createAssignment(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: Json) { return this.assignments.create(user, id, body); }
  @Get('assignments/:aid') @Roles(...STAFF) assignmentDetail(@CurrentUser() user: UserRow, @Param('aid', ParseIntPipe) aid: number) { return this.assignments.detail(user, aid); }
  @Put('assignments/:aid') @Roles(...STAFF) updateAssignment(@CurrentUser() user: UserRow, @Param('aid', ParseIntPipe) aid: number, @Body() body: Json) { return this.assignments.update(user, aid, body); }
  @Post('assignments/:aid/revoke') @Roles(...STAFF) @HttpCode(200) revoke(@CurrentUser() user: UserRow, @Param('aid', ParseIntPipe) aid: number) { return this.assignments.revoke(user, aid); }
  @Post('assignments/:aid/grade') @Roles(...STAFF) @HttpCode(200) grade(@CurrentUser() user: UserRow, @Param('aid', ParseIntPipe) aid: number, @Body() body: Json) { return this.assignments.grade(user, aid, body as never); }
  @Post('assignments/:aid/remind') @Roles(...STAFF) @HttpCode(200) remind(@CurrentUser() user: UserRow, @Param('aid', ParseIntPipe) aid: number) { return this.assignments.remind(user, aid); }

  // ------------------------------------------------------------------ giáo viên: duyệt kỹ năng (HK.GV.063)
  @Get('classes/:id/skill-requests') @Roles(...STAFF) skillRequests(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.skills.requests(user, id); }
  @Post('skill-requests/:sid/decide') @Roles(...STAFF) @HttpCode(200) decideSkill(@CurrentUser() user: UserRow, @Param('sid', ParseIntPipe) sid: number, @Body() body: Json) { return this.skills.decide(user, sid, body.approve === true); }

  // ------------------------------------------------------------------ học sinh
  @Get('my-classes') @Roles('student') myClasses(@CurrentUser() user: UserRow) { return this.rooms.myClassList(user); }
  @Get('my-classes/:id') @Roles('student') myClass(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.rooms.myClassDetail(user, id); }
  @Get('my-classes/:id/team-board') @Roles('student') teamBoard(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Query('period') period?: string) { return this.rooms.teamBoard(user, id, period); }
  @Post('leave-requests') @Roles('student') @HttpCode(200) leave(@CurrentUser() user: UserRow, @Body() body: Json) { return this.rooms.requestLeave(user, Number(body.class_id), body.reason); }
  @Get('my-assignments') @Roles('student') myAssignments(@CurrentUser() user: UserRow) { return this.assignments.mine(user); }
  @Get('my-assignments/:aid') @Roles('student') myAssignment(@CurrentUser() user: UserRow, @Param('aid', ParseIntPipe) aid: number) { return this.assignments.mineDetail(user, aid); }
  @Post('my-assignments/:aid/start') @Roles('student') @HttpCode(200) startAssignment(@CurrentUser() user: UserRow, @Param('aid', ParseIntPipe) aid: number) { return this.assignments.start(user, aid); }
  @Post('my-assignments/:aid/lesson/progress') @Roles('student') @HttpCode(200) lessonProgress(@CurrentUser() user: UserRow, @Param('aid', ParseIntPipe) aid: number, @Body() body: Json) { return this.assignments.lessonProgress(user, aid, Number(body.read_percent)); }
  @Post('my-assignments/:aid/lesson/complete') @Roles('student') @HttpCode(200) lessonComplete(@CurrentUser() user: UserRow, @Param('aid', ParseIntPipe) aid: number, @Body() body: Json) { return this.assignments.lessonComplete(user, aid, body.answers ?? []); }

  // ------------------------------------------------------------------ học sinh: kỹ năng nhân vật (HK.HS.072)
  @Get('skills') @Roles('student') mySkills(@CurrentUser() user: UserRow) { return this.skills.mine(user); }
  @Post('skills/use') @Roles('student') @HttpCode(200) useSkill(@CurrentUser() user: UserRow, @Body() body: Json) { return this.skills.use(user, body as never); }

  // ------------------------------------------------------------------ thông báo (mọi vai trò)
  @Get('notifications') @Roles('student', 'teacher', 'school_admin', 'root_admin') notifications(@CurrentUser() user: UserRow, @Query('unread') unread?: string) { return this.rooms.notifications(user, unread === 'true'); }
  @Post('notifications/read') @Roles('student', 'teacher', 'school_admin', 'root_admin') @HttpCode(200) read(@CurrentUser() user: UserRow, @Body() body: Json) { return this.rooms.markRead(user, body.ids); }
}
