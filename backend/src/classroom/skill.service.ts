/**
 * Kỹ năng nhân vật (Sprint 7, HK.HS.072, HK.GV.063): mỗi lớp nhân vật có hai kỹ năng, tiêu tốn điểm hành động (hồi đầy mỗi ngày, tăng theo cấp). Chỉ dùng khi học sinh thuộc một lớp học.
 *  - Tướng quân: "Xung phong" (thưởng tốc độ của câu đúng kế tiếp nhân đôi), "Hộ giáp" (bỏ qua một lần mất tim).
 *  - Quân sư: "Mưu kế" (loại bớt đáp án sai ở câu trắc nghiệm đang làm, không tốn gợi ý), "Trận đồ" (xem mục lịch sử liên quan đến câu đang làm).
 *  - Lương y: "Thuốc quý" (hồi một tim cho bản thân), "Hồi sinh" (hồi một tim cho bạn cùng lớp).
 * Lớp có thể bật "duyệt kỹ năng": kỹ năng hồi tim chờ giáo viên chấp nhận (từ chối thì hoàn lại điểm hành động); các kỹ năng dùng trong lúc làm bài có hiệu lực ngay.
 */
import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { DatabaseService, Q, UserRow } from '../database/database.service';
import { notFound } from '../content/access';
import { GameService } from '../game/game.service';
import { PlayService } from '../student/play.service';
import { ClassroomService } from './classroom.service';
import { notify } from './notify';

const NEEDS_APPROVAL = ['thuoc_quy', 'hoi_sinh'];
interface SkillDef { code: string; name: string; description: string; cost: number }
export interface UseInput { skill?: string; target_id?: number; attempt_id?: number; class_id?: number }

@Injectable()
export class SkillService {
  constructor(private readonly db: DatabaseService, private readonly game: GameService, private readonly play: PlayService, private readonly rooms: ClassroomService) {}

  private async myClasses(q: Q, userId: number) {
    return q<{ id: number; name: string; school_id: number; skill_approval: boolean }>(
      `SELECT c.id, c.name, c.school_id, COALESCE(cs.skill_approval, false) AS skill_approval FROM app_class_members m JOIN app_classes c ON c.id = m.class_id AND c.is_active
       LEFT JOIN hk_class_settings cs ON cs.class_id = c.id WHERE m.user_id = $1 ORDER BY c.school_year DESC, c.name`, [userId]);
  }

  private async defs(q: Q, classId: number | null): Promise<SkillDef[]> {
    if (!classId) return [];
    const row = (await q<{ skills: SkillDef[] }>('SELECT skills FROM hk_character_classes WHERE id = $1', [classId]))[0];
    return row?.skills ?? [];
  }

  /** Kỹ năng, điểm hành động, hiệu ứng đang chờ và bạn cùng lớp có thể hồi tim (HK.HS.072) */
  async mine(user: UserRow) {
    return this.db.tx(async (q) => {
      const p = await this.game.refreshAp(q, user);
      const classes = await this.myClasses(q, user.id);
      const skills = (await this.defs(q, p.class_id)).map((s) => ({ ...s, needs_approval: NEEDS_APPROVAL.includes(s.code) && classes.some((c) => c.skill_approval), in_quiz: ['muu_ke', 'tran_do'].includes(s.code), targets_friend: s.code === 'hoi_sinh', usable: classes.length > 0 && p.ap >= s.cost }));
      const mates = await q<{ id: number; name: string; hearts: number }>(
        `SELECT DISTINCT u.id, COALESCE(NULLIF(u.nickname, ''), u.full_name) AS name, COALESCE(pl.hearts, 5) AS hearts FROM app_class_members m JOIN app_class_members o ON o.class_id = m.class_id AND o.user_id <> m.user_id
         JOIN app_users u ON u.id = o.user_id AND u.role = 'student' LEFT JOIN hk_players pl ON pl.user_id = u.id WHERE m.user_id = $1 ORDER BY name`, [user.id]);
      const pending = await q('SELECT s.id::int AS id, s.skill, s.status, s.created_at, u.full_name AS target_name FROM hk_skill_uses s LEFT JOIN app_users u ON u.id = s.target_user_id WHERE s.user_id = $1 ORDER BY s.id DESC LIMIT 8', [user.id]);
      return { ap: { current: p.ap, max: this.game.apMax(p.level) }, buffs: p.buffs ?? {}, in_class: classes.length > 0, skills, classmates: mates, recent: pending };
    });
  }

  private async spend(q: Q, user: UserRow, cost: number): Promise<void> {
    const rows = await q('UPDATE hk_players SET ap = ap - $2, updated_at = now() WHERE user_id = $1 AND ap >= $2 RETURNING ap', [user.id, cost]);
    if (!rows.length) throw new ConflictException('Em không đủ điểm hành động hôm nay; điểm sẽ hồi đầy vào ngày mai');
  }

  private async heal(q: Q, target: UserRow): Promise<void> {
    const p = await this.game.fresh(q, target);
    if (!(await this.game.heartsEnabled(q, target.id))) throw new ConflictException('Lớp đang tắt cơ chế tim nên không cần hồi tim');
    if (p.hearts >= (await this.game.heartsMax(q, target.id))) throw new ConflictException(`${target.nickname || target.full_name} đã đầy tim`);
    await this.game.gainHearts(q, target, 1);
  }

  async use(user: UserRow, body: UseInput) {
    const code = String(body.skill ?? '');
    const prep = await this.db.tx(async (q) => {
      const p = await this.game.refreshAp(q, user);
      if (!p.class_id) throw new ConflictException('Em cần chọn lớp nhân vật trước');
      const skill = (await this.defs(q, p.class_id)).find((s) => s.code === code);
      if (!skill) throw new BadRequestException('Lớp nhân vật của em không có kỹ năng này');
      const classes = await this.myClasses(q, user.id);
      if (!classes.length) throw new ConflictException('Kỹ năng chỉ dùng được khi em thuộc một lớp học');
      if (p.ap < skill.cost) throw new ConflictException(`Cần ${skill.cost} điểm hành động, em còn ${p.ap}`);
      return { skill, p, classes };
    });
    const { skill, classes } = prep;

    // Kỹ năng dùng trong lúc làm bài: có hiệu lực ngay
    if (code === 'muu_ke' || code === 'tran_do') {
      if (!body.attempt_id) throw new BadRequestException('Hãy dùng kỹ năng này khi đang làm một câu hỏi');
      const effect = code === 'muu_ke' ? await this.play.hint(user, Number(body.attempt_id), { free: true }) : { links: await this.play.currentLinks(user, Number(body.attempt_id)) };
      await this.db.tx((q) => this.spend(q, user, skill.cost));
      return { skill: code, status: 'done', message: code === 'muu_ke' ? 'Đã loại bớt đáp án sai' : 'Đã mở các mục lịch sử liên quan đến câu hỏi', ...effect, ap: await this.apLeft(user) };
    }

    return this.db.tx(async (q) => {
      if (code === 'xung_phong' || code === 'ho_giap') {
        const row = (await q<{ buffs: Record<string, number> }>('SELECT buffs FROM hk_players WHERE user_id = $1 FOR UPDATE', [user.id]))[0];
        if (row.buffs?.[code]) throw new ConflictException('Hiệu ứng này đang chờ được dùng');
        await this.spend(q, user, skill.cost);
        await q('UPDATE hk_players SET buffs = $2 WHERE user_id = $1', [user.id, JSON.stringify({ ...(row.buffs ?? {}), [code]: 1 })]);
        await q('INSERT INTO hk_skill_uses (user_id, class_id, skill, cost, status) VALUES ($1, $2, $3, $4, $5)', [user.id, classes[0].id, code, skill.cost, 'done']);
        return { skill: code, status: 'done', message: code === 'xung_phong' ? 'Thưởng tốc độ của câu đúng kế tiếp sẽ được nhân đôi' : 'Lần mất tim kế tiếp sẽ được bỏ qua', ap: await this.apLeftIn(q, user) };
      }
      if (code === 'thuoc_quy' || code === 'hoi_sinh') {
        let target = user;
        let cls = classes[0];
        if (code === 'hoi_sinh') {
          if (!body.target_id || body.target_id === user.id) throw new BadRequestException('Hãy chọn một bạn cùng lớp để hồi tim');
          const t = (await q<UserRow & { class_id: number }>(
            `SELECT u.*, o.class_id FROM app_users u JOIN app_class_members o ON o.user_id = u.id JOIN app_class_members m ON m.class_id = o.class_id AND m.user_id = $2 WHERE u.id = $1 AND u.role = 'student' LIMIT 1`, [body.target_id, user.id]))[0];
          if (!t) throw new ForbiddenException('Chỉ hồi tim được cho bạn cùng lớp');
          target = t;
          cls = classes.find((c) => c.id === t.class_id) ?? classes[0];
        }
        if (cls.skill_approval) {
          await this.spend(q, user, skill.cost);
          const req = (await q<{ id: number }>("INSERT INTO hk_skill_uses (user_id, class_id, skill, target_user_id, cost, status) VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING id::int AS id", [user.id, cls.id, code, code === 'hoi_sinh' ? target.id : null, skill.cost]))[0];
          const teachers = (await q<{ teacher_id: number }>('SELECT teacher_id FROM app_current_class_teachers WHERE class_id = $1', [cls.id])).map((r) => r.teacher_id);
          await notify(q, teachers, { kind: 'skill', title: 'Học sinh xin dùng kỹ năng', body: `${user.nickname || user.full_name} xin dùng "${skill.name}"${code === 'hoi_sinh' ? ` cho ${target.nickname || target.full_name}` : ''}`, class_id: cls.id, ref: { request_id: req.id }, by: user.id, school_id: cls.school_id });
          return { skill: code, status: 'pending', message: 'Đã gửi giáo viên duyệt; điểm hành động được hoàn lại nếu bị từ chối', ap: await this.apLeftIn(q, user) };
        }
        await this.heal(q, target);
        await this.spend(q, user, skill.cost);
        await q("INSERT INTO hk_skill_uses (user_id, class_id, skill, target_user_id, cost, status) VALUES ($1, $2, $3, $4, $5, 'done')", [user.id, cls.id, code, code === 'hoi_sinh' ? target.id : null, skill.cost]);
        if (target.id !== user.id) await notify(q, [target.id], { kind: 'skill', title: 'Bạn đã hồi tim cho em', body: `${user.nickname || user.full_name} dùng "${skill.name}": +1 tim`, class_id: cls.id, by: user.id, school_id: cls.school_id });
        return { skill: code, status: 'done', message: '+1 tim', ap: await this.apLeftIn(q, user) };
      }
      throw new BadRequestException('Kỹ năng này chưa có hiệu ứng');
    });
  }

  private async apLeftIn(q: Q, user: UserRow) {
    const p = (await q<{ ap: number; level: number }>('SELECT ap, level FROM hk_players WHERE user_id = $1', [user.id]))[0];
    return { current: p.ap, max: this.game.apMax(p.level) };
  }

  private apLeft(user: UserRow) { return this.db.tx((q) => this.apLeftIn(q, user)); }

  // ------------------------------------------------------------------ giáo viên duyệt (HK.GV.063)
  async requests(user: UserRow, classId: number) {
    await this.rooms.mine(this.db.query.bind(this.db) as Q, user, classId);
    return this.db.query(
      `SELECT s.id::int AS id, s.skill, s.status, s.cost, s.created_at, s.decided_at, u.full_name AS user_name, t.full_name AS target_name
       FROM hk_skill_uses s JOIN app_users u ON u.id = s.user_id LEFT JOIN app_users t ON t.id = s.target_user_id
       WHERE s.class_id = $1 AND s.status <> 'done' OR (s.class_id = $1 AND s.decided_by IS NOT NULL) ORDER BY (s.status = 'pending') DESC, s.id DESC LIMIT 40`, [classId]);
  }

  async decide(user: UserRow, id: number, approve: boolean) {
    const req = (await this.db.query<{ id: number; class_id: number; user_id: number; target_user_id: number | null; skill: string; cost: number; status: string }>(
      'SELECT id::int AS id, class_id, user_id, target_user_id, skill, cost, status FROM hk_skill_uses WHERE id = $1', [id]))[0];
    if (!req) throw notFound('yêu cầu dùng kỹ năng');
    const cls = await this.rooms.mine(this.db.query.bind(this.db) as Q, user, req.class_id, true);
    return this.db.tx(async (q) => {
      const cur = (await q<{ status: string }>('SELECT status FROM hk_skill_uses WHERE id = $1 FOR UPDATE', [id]))[0];
      if (cur.status !== 'pending') throw new ConflictException('Yêu cầu này đã được xử lý');
      const student = (await q<UserRow>('SELECT * FROM app_users WHERE id = $1', [req.user_id]))[0];
      let note: string | null = null;
      if (approve) {
        const target = req.target_user_id ? (await q<UserRow>('SELECT * FROM app_users WHERE id = $1', [req.target_user_id]))[0] : student;
        try { await this.heal(q, target); } catch (e) { note = e instanceof Error ? e.message : null; }
      } else {
        await q('UPDATE hk_players SET ap = LEAST(ap + $2, $3), updated_at = now() WHERE user_id = $1', [req.user_id, req.cost, this.game.apMax((await q<{ level: number }>('SELECT level FROM hk_players WHERE user_id = $1', [req.user_id]))[0].level)]);
      }
      await q('UPDATE hk_skill_uses SET status = $2, decided_by = $3, decided_at = now(), note = $4 WHERE id = $1', [id, approve ? 'done' : 'rejected', user.id, note]);
      await notify(q, [req.user_id], { kind: 'skill', title: approve ? 'Giáo viên đồng ý cho em dùng kỹ năng' : 'Giáo viên chưa đồng ý cho dùng kỹ năng', body: `${approve ? (note ?? '+1 tim') : 'Điểm hành động đã được hoàn lại.'}`, class_id: req.class_id, by: user.id, school_id: cls.school_id });
      return { id, status: approve ? 'done' : 'rejected', note };
    });
  }
}
