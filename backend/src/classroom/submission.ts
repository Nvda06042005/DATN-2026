/**
 * Ghi nhận bài nộp của học sinh cho bài tập (HK.HS.101, HK.GV.048): gọi khi một lượt làm bài, lượt chơi mini-game hoặc bài học gắn với bài tập hoàn thành.
 * Không phụ thuộc dịch vụ nào ngoài GameService nên PlayService, BattleService và AssignmentService cùng dùng được mà không vòng lặp phụ thuộc.
 */
import { Q, UserRow } from '../database/database.service';
import { GameService } from '../game/game.service';
import { notify } from './notify';

export interface SubmissionResult { first: boolean; on_time: boolean; bonus: number }

export async function recordSubmission(q: Q, game: GameService, user: UserRow, assignmentId: number, percent: number): Promise<SubmissionResult | null> {
  const a = (await q<{ id: number; class_id: number; title: string; due_at: Date; bonus_points: number; status: string }>('SELECT id, class_id, title, due_at, bonus_points, status FROM hk_assignments WHERE id = $1', [assignmentId]))[0];
  if (!a || a.status !== 'active') return null;
  const now = game.clock.now();
  const onTime = now.getTime() <= new Date(a.due_at).getTime();
  const prior = (await q<{ submitted_at: Date | null }>('SELECT submitted_at FROM hk_submissions WHERE assignment_id = $1 AND user_id = $2 FOR UPDATE', [assignmentId, user.id]))[0];
  const first = !prior?.submitted_at;
  await q(
    `INSERT INTO hk_submissions (assignment_id, user_id, attempts, best_percent, submitted_at, on_time, last_at) VALUES ($1, $2, 1, $3, $4, $5, $4)
     ON CONFLICT (assignment_id, user_id) DO UPDATE SET attempts = hk_submissions.attempts + 1, best_percent = GREATEST(hk_submissions.best_percent, $3),
       submitted_at = COALESCE(hk_submissions.submitted_at, $4), on_time = COALESCE(hk_submissions.on_time, $5), last_at = $4`,
    [assignmentId, user.id, Math.max(0, Math.min(100, Math.round(percent))), now, onTime]);
  let bonus = 0;
  // Điểm thưởng của bài tập: một lần, chỉ khi nộp đúng hạn
  if (first && onTime && a.bonus_points > 0 && (await game.awardXp(q, user, a.bonus_points, 'assignment', `assignment:${a.id}`))) {
    bonus = a.bonus_points;
    await notify(q, [user.id], { kind: 'assignment', title: 'Em nhận điểm thưởng bài tập', body: `${a.title}: +${bonus} điểm vì nộp đúng hạn`, class_id: a.class_id, school_id: user.school_id });
  }
  return { first, on_time: onTime, bonus };
}
