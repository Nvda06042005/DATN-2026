/**
 * Gắn cửa học với trận đánh trên bản đồ hành quân của lớp (HK.GV.083, ver0.2 Sprint 7).
 * Với mỗi lớp, giáo viên chọn: cửa nào phải hoàn thành thì học sinh của lớp mới được ra trận, độ khó của trận (thay độ khó gốc của màn chơi)
 * và bật / tắt câu hỏi kích hoạt tuyệt kỹ. Học sinh thuộc nhiều lớp thì áp dụng cách chặt nhất: phải xong cửa của mọi lớp, lấy độ khó cao nhất,
 * câu hỏi tuyệt kỹ chỉ tắt khi mọi lớp đều tắt. Luật lớp về bật / tắt game và thời gian chơi mỗi ngày nằm ở WarGate.
 */
import { BadRequestException, Injectable } from '@nestjs/common';
import { ClassroomService } from '../classroom/classroom.service';
import { DatabaseService, Q, UserRow } from '../database/database.service';

export interface StudentLink { stage_id: number; gate_ids: number[]; gate_title: string | null; gate_done: boolean; difficulty: number | null; skill_questions: boolean; class_names: string[] }

@Injectable()
export class WarClassService {
  constructor(private readonly db: DatabaseService, private readonly classes: ClassroomService) {}

  // ---------------------------------------------------------------------- phía học sinh
  /** Cửa đã hoàn thành: mọi nút của cửa đều xong (cửa chưa có nút nào coi như xong) */
  private async gateDone(q: Q, userId: number, gateId: number): Promise<boolean> {
    const r = (await q<{ open: string }>(
      `SELECT count(*) AS open FROM hk_nodes n LEFT JOIN hk_node_progress p ON p.node_id = n.id AND p.user_id = $1 WHERE n.gate_id = $2 AND p.completed_at IS NULL`, [userId, gateId]))[0];
    return Number(r.open) === 0;
  }

  /** Cấu hình của các lớp mà học sinh đang học áp lên từng màn chơi */
  async linksFor(q: Q, userId: number, stageIds?: number[]): Promise<Map<number, StudentLink>> {
    const rows = await q<{ stage_id: number; gate_id: number | null; difficulty: number | null; skill_questions: boolean; gate_title: string | null; class_name: string }>(
      `SELECT l.stage_id, l.gate_id, l.difficulty, l.skill_questions, g.title AS gate_title, c.name AS class_name
       FROM hk_class_battle_links l JOIN app_class_members m ON m.class_id = l.class_id AND m.user_id = $1 JOIN app_classes c ON c.id = l.class_id AND c.is_active
       LEFT JOIN hk_gates g ON g.id = l.gate_id WHERE ($2::int[] IS NULL OR l.stage_id = ANY($2)) ORDER BY l.stage_id, l.id`, [userId, stageIds ?? null]);
    const done = new Map<number, boolean>();
    const out = new Map<number, StudentLink>();
    for (const r of rows) {
      if (r.gate_id !== null && !done.has(r.gate_id)) done.set(r.gate_id, await this.gateDone(q, userId, r.gate_id));
      const cur = out.get(r.stage_id);
      const gateOk = r.gate_id === null || done.get(r.gate_id) === true;
      if (!cur) {
        out.set(r.stage_id, { stage_id: r.stage_id, gate_ids: r.gate_id === null ? [] : [r.gate_id], gate_title: r.gate_title, gate_done: gateOk, difficulty: r.difficulty, skill_questions: r.skill_questions, class_names: [r.class_name] });
        continue;
      }
      if (r.gate_id !== null) cur.gate_ids.push(r.gate_id);
      // chưa xong cửa của lớp nào thì báo cửa đó
      if (!gateOk && cur.gate_done) { cur.gate_done = false; cur.gate_title = r.gate_title; }
      if (r.difficulty !== null) cur.difficulty = Math.max(cur.difficulty ?? 0, r.difficulty);
      cur.skill_questions = cur.skill_questions || r.skill_questions;
      cur.class_names.push(r.class_name);
    }
    return out;
  }

  /** Lý do trận đang khóa vì cửa lớp gắn chưa xong, hoặc null */
  lockReason(link: StudentLink | undefined): string | null {
    return link && !link.gate_done ? `Hãy hoàn thành cửa "${link.gate_title ?? 'đã gắn'}" mà giáo viên gắn với trận này để ra trận.` : null;
  }

  // ---------------------------------------------------------------------- phía giáo viên
  /** Cửa của các hành trình đã giao cho lớp (và hành trình mặc định), màn chơi đã phát hành và cấu hình hiện có của lớp */
  async options(user: UserRow, classId: number) {
    const q = this.db.query.bind(this.db) as Q;
    const cls = await this.classes.mine(q, user, classId);
    const gates = await q<{ id: number; title: string; position: number; journey_title: string; campaign_title: string | null }>(
      `SELECT g.id, g.title, g.position, j.title AS journey_title, c.title AS campaign_title
       FROM hk_gates g JOIN hk_journeys j ON j.id = g.journey_id LEFT JOIN hist_campaigns c ON c.id = j.campaign_id
       WHERE j.status = 'published' AND (j.is_default OR EXISTS (SELECT 1 FROM hk_class_journeys cj WHERE cj.journey_id = j.id AND cj.class_id = $1))
       ORDER BY c.sort_order NULLS LAST, j.id, g.position`, [classId]);
    const stages = await q<{ id: number; title: string; difficulty: number; battle_name: string; year: number | null; has_quiz: boolean; point_name: string | null; map_title: string | null }>(
      `SELECT s.id, s.title, s.difficulty, b.name AS battle_name, b.year, (s.quiz_id IS NOT NULL) AS has_quiz, p.name AS point_name, m.title AS map_title
       FROM hk_stages s JOIN hist_battles b ON b.id = s.battle_id LEFT JOIN hk_march_points p ON p.kind = 'battle' AND (p.payload->>'stage_id')::int = s.id
       LEFT JOIN hk_march_maps m ON m.id = p.map_id WHERE s.status = 'published' ORDER BY b.year NULLS LAST, s.id`);
    const links = await q<{ stage_id: number; gate_id: number | null; difficulty: number | null; skill_questions: boolean }>(
      'SELECT stage_id, gate_id, difficulty, skill_questions FROM hk_class_battle_links WHERE class_id = $1 ORDER BY id', [classId]);
    return { class: { id: cls.id, name: cls.name }, gates, stages, links };
  }

  async save(user: UserRow, classId: number, body: { links?: unknown }) {
    if (!Array.isArray(body.links) || body.links.length > 30) throw new BadRequestException('Danh sách gắn trận tối đa 30 mục');
    await this.db.tx(async (q) => {
      await this.classes.mine(q, user, classId, true);
      const seen = new Set<number>();
      const rows: Array<{ stage: number; gate: number | null; difficulty: number | null; skill: boolean }> = [];
      for (const [i, raw] of (body.links as Array<Record<string, unknown>>).entries()) {
        const stage = Number(raw?.stage_id);
        if (!Number.isInteger(stage) || seen.has(stage)) throw new BadRequestException(`Mục ${i + 1}: màn chơi không hợp lệ hoặc bị trùng`);
        seen.add(stage);
        if (!(await q("SELECT 1 FROM hk_stages WHERE id = $1 AND status = 'published'", [stage])).length) throw new BadRequestException(`Mục ${i + 1}: màn chơi chưa được phát hành`);
        const gate = raw.gate_id === undefined || raw.gate_id === null || raw.gate_id === '' ? null : Number(raw.gate_id);
        if (gate !== null) {
          const ok = Number.isInteger(gate) && (await q(
            `SELECT 1 FROM hk_gates g JOIN hk_journeys j ON j.id = g.journey_id WHERE g.id = $1 AND j.status = 'published' AND (j.is_default OR EXISTS (SELECT 1 FROM hk_class_journeys cj WHERE cj.journey_id = j.id AND cj.class_id = $2))`, [gate, classId])).length > 0;
          if (!ok) throw new BadRequestException(`Mục ${i + 1}: cửa phải thuộc hành trình đã giao cho lớp`);
        }
        const difficulty = raw.difficulty === undefined || raw.difficulty === null || raw.difficulty === '' ? null : Number(raw.difficulty);
        if (difficulty !== null && ![1, 2, 3].includes(difficulty)) throw new BadRequestException(`Mục ${i + 1}: độ khó từ 1 đến 3`);
        rows.push({ stage, gate, difficulty, skill: raw.skill_questions !== false });
      }
      await q('DELETE FROM hk_class_battle_links WHERE class_id = $1', [classId]);
      for (const r of rows) {
        await q('INSERT INTO hk_class_battle_links (class_id, stage_id, gate_id, difficulty, skill_questions, created_by) VALUES ($1, $2, $3, $4, $5, $6)', [classId, r.stage, r.gate, r.difficulty, r.skill, user.id]);
      }
    });
    return this.options(user, classId);
  }
}
