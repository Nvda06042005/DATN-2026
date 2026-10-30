import { BadRequestException, Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { DatabaseService, Progress, UserRow } from '../database/database.service';
import { BankQuestion, ContentService, shuffle } from './content.service';
import * as prog from './progress';

const MAX_GAME_STATE_CHARS = 16_384;

/** Dữ liệu học tập thật theo tài khoản học sinh. XP và Ấn Tín chỉ được cộng ở đây khi server chấm câu trả lời. */
@Injectable()
export class StudentService {
  constructor(
    private readonly db: DatabaseService,
    private readonly content: ContentService,
    private readonly ai: AiService,
  ) {}

  /** Ghi các bộ đếm do server quản lý; game_state chỉ ghi qua PUT /student/game để không đè bản client vừa lưu */
  private save(userId: number, p: Progress): Promise<Progress> {
    const { game_state: _skip, ...counters } = p;
    return this.db.saveProgress(userId, counters);
  }

  private async ranking(user: UserRow): Promise<[number, number]> {
    const inClass = await this.db.studentsInClass(user.class_name, user.school_id);
    const classmates = inClass.length ? inClass : [user];
    const progress = await this.db.allProgress(true);
    const ranked = [...classmates].sort((a, b) => Number(progress.get(b.id)?.xp ?? 0) - Number(progress.get(a.id)?.xp ?? 0) || a.full_name.localeCompare(b.full_name));
    return [Math.max(1, ranked.findIndex((u) => u.id === user.id) + 1), ranked.length];
  }

  async progressOut(user: UserRow, p: Progress) {
    prog.rollDay(p);
    const [rank, size] = await this.ranking(user);
    return {
      xp: Number(p.xp), week_xp: Number(p.week_xp || 0), gems: Number(p.gems), streak: prog.effectiveStreak(p), freeze_available: prog.freezeAvailable(p),
      lessons_completed: Number(p.lessons_completed), perfect_runs: Number(p.perfect_runs), questions_answered: Number(p.questions_answered),
      questions_correct: Number(p.questions_correct), accuracy: prog.accuracy(p), ai_questions: Number(p.ai_questions), day_xp: Number(p.day_xp),
      day_lessons: Number(p.day_lessons), day_correct: Number(p.day_correct), day_ai_questions: Number(p.day_ai_questions), day_gems: Number(p.day_gems || 0),
      daily_gem_cap: prog.DAILY_GEM_CAP, class_name: user.class_name, class_rank: rank, class_size: size,
    };
  }

  async progress(user: UserRow) {
    return this.progressOut(user, await this.db.getProgress(user.id));
  }

  async getGame(user: UserRow) {
    const p = await this.db.getProgress(user.id);
    const state = prog.loadJson(p.game_state);
    return { state: Object.keys(state).length ? state : null, updated_at: p.updated_at };
  }

  async putGame(user: UserRow, state: Record<string, unknown>) {
    const text = JSON.stringify(state);
    if (text.length > MAX_GAME_STATE_CHARS) throw new PayloadTooLargeException('Dữ liệu game quá lớn (tối đa 16 KB)');
    const p = await this.db.saveProgress(user.id, { game_state: text });
    return { state, updated_at: p.updated_at };
  }

  /** Cụm tri thức đã làm nhưng còn yếu (P(L) < 0.6); chưa có thì lấy cụm chưa làm */
  weakUnits(bktState: Record<string, { attempts?: number; p_l?: number }>, limit = 3): string[] {
    const units = this.content.unitsWithQuestions();
    const tried = units
      .filter((u) => bktState[u]?.attempts && Number(bktState[u].p_l ?? 0.3) < prog.WEAK_THRESHOLD)
      .sort((a, b) => Number(bktState[a].p_l ?? 0.3) - Number(bktState[b].p_l ?? 0.3));
    if (tried.length) return tried.slice(0, limit);
    const untried = shuffle(units.filter((u) => !bktState[u]?.attempts));
    return untried.slice(0, limit).length ? untried.slice(0, limit) : units.slice(0, limit);
  }

  async questions(user: UserRow, q: { units?: string; count: number; mode: string; exclude?: string; types?: string; levels?: string }) {
    const csv = (v: string | undefined, limit = 40) => (v ?? '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, limit);
    let wanted = csv(q.units).filter((u) => this.content.byUnit.has(u));
    let note: string | null = null;
    if (q.mode === 'weak') {
      wanted = this.weakUnits(prog.loadJson((await this.db.getProgress(user.id)).bkt_state));
      note = 'Câu hỏi thuộc các cụm tri thức em cần củng cố';
    }
    const types = new Set(csv(q.types));
    const levels = new Set(csv(q.levels));
    const picked = this.content.pick(wanted.length ? wanted : null, q.count, new Set(csv(q.exclude, 200)), types.size ? types : null, levels.size ? levels : null);
    return { questions: picked.map((x) => this.content.serve(x)), mode: q.mode, units: wanted, note };
  }

  /** Câu hỏi do Quân Sư AI soạn từ kho tri thức (RAG); AI bận thì dùng ngân hàng câu hỏi */
  async aiQuestions(user: UserRow, unitId: string | null | undefined, count: number) {
    const unit = unitId && this.content.byUnit.has(unitId) ? unitId : this.weakUnits(prog.loadJson((await this.db.getProgress(user.id)).bkt_state), 1)[0];
    const topic = this.content.topicOf(unit);
    const served = [];
    for (const g of (await this.ai.generateQuestions(unit, topic, count)).slice(0, count)) {
      const q = this.content.rememberAi(unit, g.question, g.options, g.correct_index, g.explanation, g.source);
      if (q) served.push(this.content.serve(q));
    }
    let note: string | null = null;
    if (!served.length) {
      note = 'Quân Sư AI đang bận – dùng câu hỏi trong ngân hàng của game';
      served.push(...this.content.pick([unit], count, new Set()).map((q) => this.content.serve(q)));
    }
    return { questions: served, mode: 'ai', units: [unit], note };
  }

  /** Ghi một câu trả lời server đã chấm: BKT (dịch vụ AI), XP, Ấn Tín, thống kê câu, chuỗi ngày – dùng cho luyện tập và thi đấu lớp */
  async recordAnswer(user: UserRow, q: BankQuestion, correct: boolean) {
    const p = prog.rollDay(await this.db.getProgress(user.id));
    const state = prog.loadJson(p.bkt_state);
    const before = (state[q.unit_id] ?? {}) as { attempts?: number; p_l?: number };
    const weak = Boolean(before.attempts) && Number(before.p_l ?? 0.3) < prog.WEAK_THRESHOLD;
    const bkt = await this.ai.bktUpdate(state, q.unit_id, correct);

    p.questions_answered = Number(p.questions_answered) + 1;
    if (correct) {
      p.questions_correct = Number(p.questions_correct) + 1;
      p.day_correct = Number(p.day_correct) + 1;
    }
    const [xp, gems] = prog.awardAnswer(p, correct, weak);
    prog.touchStreak(p);
    if (!q.ai) {
      const stats = prog.loadJson(p.question_stats);
      const [attempts, wrong] = Array.isArray(stats[q.id]) ? stats[q.id] : [0, 0];
      stats[q.id] = [Number(attempts) + 1, Number(wrong) + (correct ? 0 : 1)];
      p.question_stats = JSON.stringify(stats);
    }
    if (bkt) p.bkt_state = JSON.stringify(bkt.state);
    const saved = await this.save(user.id, p);
    const pl = Number(before.p_l ?? 0.3);
    const mastery = bkt ?? { topic: this.content.topicOf(q.unit_id), old_p_l: pl, new_p_l: pl, p_l_delta: 0, mastery_status: 'Chưa cập nhật được mức nắm vững', attempts: Number(before.attempts ?? 0) };
    return { mastery, xp, gems, progress: saved };
  }

  async answer(user: UserRow, body: { question_id: string; choice?: unknown; order?: unknown[]; pairs?: Record<string, unknown> }) {
    const q = this.content.get(body.question_id);
    if (!q) throw new NotFoundException('Câu hỏi không tồn tại hoặc đã hết hạn');
    const [correct, reveal] = this.content.grade(q, body.choice, body.order, body.pairs);
    const { mastery, xp, gems, progress } = await this.recordAnswer(user, q, correct);
    return {
      question_id: q.id, unit_id: q.unit_id, topic: mastery.topic || this.content.topicOf(q.unit_id), correct, reveal, explanation: q.explanation, source: q.source ?? null,
      old_p_l: mastery.old_p_l, new_p_l: mastery.new_p_l, p_l_delta: mastery.p_l_delta, mastery_status: mastery.mastery_status, attempts: mastery.attempts,
      xp_gained: xp, gems_gained: gems, progress: await this.progressOut(user, progress),
    };
  }

  /** Ghi nhận hoàn thành một lượt học / trận đánh / trận thi đấu lớp */
  async recordSession(user: UserRow, correct: number, total: number) {
    const p = prog.rollDay(await this.db.getProgress(user.id));
    p.lessons_completed = Number(p.lessons_completed) + 1;
    p.day_lessons = Number(p.day_lessons) + 1;
    const perfect = total > 0 && correct === total;
    if (perfect) p.perfect_runs = Number(p.perfect_runs) + 1;
    prog.touchStreak(p);
    return { progress: await this.save(user.id, p), perfect };
  }

  async quizComplete(user: UserRow, correct: number, total: number) {
    if (correct > total) throw new BadRequestException('Số câu đúng không thể lớn hơn tổng số câu');
    const p = prog.rollDay(await this.db.getProgress(user.id));
    if (correct > Number(p.day_correct)) throw new BadRequestException('Số câu đúng chưa khớp với các câu server đã chấm hôm nay');
    const { progress, perfect } = await this.recordSession(user, correct, total);
    return { lessons_completed: Number(progress.lessons_completed), perfect, progress: await this.progressOut(user, progress) };
  }

  async aiQuestion(user: UserRow) {
    const p = prog.rollDay(await this.db.getProgress(user.id));
    p.ai_questions = Number(p.ai_questions) + 1;
    p.day_ai_questions = Number(p.day_ai_questions) + 1;
    prog.touchStreak(p);
    return this.progressOut(user, await this.save(user.id, p));
  }

  /** Tiêu Ấn Tín (chiêu mộ, tiến hóa, nâng cấp). Ấn Tín chỉ được cộng khi server chấm câu trả lời đúng. */
  async spendGems(user: UserRow, delta: number) {
    const p = await this.db.getProgress(user.id);
    const value = Number(p.gems) + delta;
    if (value < 0) throw new BadRequestException('Không đủ Ấn Tín');
    p.gems = value;
    return this.progressOut(user, await this.save(user.id, p));
  }

  async leaderboard(user: UserRow) {
    const inClass = await this.db.studentsInClass(user.class_name, user.school_id);
    const classmates = inClass.length ? inClass : [user];
    const progress = await this.db.allProgress(true);
    const week = prog.weekKey();
    return classmates
      .filter((u) => u.is_active || u.id === user.id)
      .map((u) => {
        const p = progress.get(u.id);
        return {
          id: u.id, full_name: u.full_name, xp: Number(p?.xp ?? 0), week_xp: p?.week_key === week ? Number(p?.week_xp ?? 0) : 0,
          streak: prog.effectiveStreak(p), is_me: u.id === user.id,
        };
      })
      .sort((a, b) => b.week_xp - a.week_xp || b.xp - a.xp || a.full_name.localeCompare(b.full_name));
  }

  async recommendations(user: UserRow, topK: number) {
    const recs = await this.ai.bktRecommend(prog.loadJson((await this.db.getProgress(user.id)).bkt_state), topK);
    return { recommendations: recs, total_recommendations: recs.length };
  }
}
