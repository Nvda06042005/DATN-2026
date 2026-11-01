/**
 * Bản đồ hành quân kiểu Classcraft (HK.HS.113–116, 124; HK.AD.081, 082; HK.SYS.021): mỗi cuộc kháng chiến có một bản đồ gồm các điểm đến nối bằng đường hành quân;
 * nhân vật đi theo đường nối, không đi tắt qua điểm chưa mở; đến nơi thì mở sự kiện theo loại điểm (hội thoại cốt truyện, thẻ / mảnh thẻ, câu hỏi thử thách, tư liệu, rương, trận đánh).
 * Điểm mở khi nằm cạnh một điểm đã đi qua. Điểm trận đánh chỉ mở khi học sinh đã học tới nút trận đánh tương ứng trong hành trình (đồng bộ học → game, HK.SYS.021:
 * tính từ tiến độ học mỗi lần xem nên không cần job; Binh thư của việc học đã được cộng khi hoàn thành nút). Vị trí và các điểm đã tới được lưu cho lần đăng nhập sau.
 */
import { BadRequestException, ConflictException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { notFound } from '../content/access';
import { grade, publicView, QuestionCore } from '../content/questions';
import { DatabaseService, Q, UserRow } from '../database/database.service';
import { GameService } from '../game/game.service';
import { activeJourneys, nodesWithState } from '../student/progress';
import { WarGate } from './war-gate';

const KINDS = ['start', 'story', 'card', 'quiz', 'source', 'battle', 'chest'];
interface Point { id: number; map_id: number; code: string; name: string; description: string | null; x: number; y: number; kind: string; payload: Record<string, any>; sort_order: number }
interface Dialog { id: number; point_id: number | null; title: string; lines: Array<Record<string, any>>; source_ids: number[]; status: string }

@Injectable()
export class WarMarchService {
  constructor(private readonly db: DatabaseService, private readonly game: GameService, private readonly gate: WarGate) {}

  /** Trạng thái học của từng trận đánh trong hành trình đang học: có nút thì xét nút đã mở chưa */
  private async battleStates(q: Q, user: UserRow): Promise<Map<number, string>> {
    const out = new Map<number, string>();
    for (const j of await activeJourneys(q, user.id)) for (const n of await nodesWithState(q, user.id, j.journey_id)) if (n.battle_id) out.set(n.battle_id, n.state);
    return out;
  }

  async list(user: UserRow) {
    return this.db.query(
      `SELECT m.id, m.campaign_id, m.title, c.title AS campaign_title, c.year_label,
              (SELECT count(*)::int FROM hk_march_points p WHERE p.map_id = m.id) AS points,
              (SELECT count(*)::int FROM hk_march_visits v JOIN hk_march_points p ON p.id = v.point_id WHERE p.map_id = m.id AND v.user_id = $1) AS visited
       FROM hk_march_maps m JOIN hist_campaigns c ON c.id = m.campaign_id WHERE m.status = 'published' AND c.status = 'published' ORDER BY c.sort_order, c.id`, [user.id]);
  }

  /** Điểm đến, đường nối và trạng thái từng điểm của một bản đồ (HK.HS.113) */
  async map(user: UserRow, campaignId: number) {
    return this.db.tx(async (q) => {
      const map = (await q<{ id: number; campaign_id: number; title: string; background_url: string | null }>("SELECT id, campaign_id, title, background_url FROM hk_march_maps WHERE campaign_id = $1 AND status = 'published'", [campaignId]))[0];
      if (!map) throw notFound('bản đồ hành quân');
      const campaign = (await q<{ id: number; title: string; year_label: string }>('SELECT id, title, year_label FROM hist_campaigns WHERE id = $1', [campaignId]))[0];
      const points = await q<Point>('SELECT id, map_id, code, name, description, x::float8 AS x, y::float8 AS y, kind, payload, sort_order FROM hk_march_points WHERE map_id = $1 ORDER BY sort_order, id', [map.id]);
      const edges = await q<{ from_point: number; to_point: number }>('SELECT from_point, to_point FROM hk_march_edges WHERE map_id = $1', [map.id]);
      const start = points.find((p) => p.kind === 'start') ?? points[0];
      // Điểm xuất phát luôn đã tới; vị trí được lưu cho lần đăng nhập sau
      if (start) {
        await q('INSERT INTO hk_march_visits (user_id, point_id, done_at) VALUES ($1, $2, now()) ON CONFLICT DO NOTHING', [user.id, start.id]);
        await q('INSERT INTO hk_march_state (user_id, map_id, point_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [user.id, map.id, start.id]);
      }
      const visits = new Map((await q<{ point_id: number; done_at: string | null }>('SELECT v.point_id, v.done_at FROM hk_march_visits v JOIN hk_march_points p ON p.id = v.point_id WHERE v.user_id = $1 AND p.map_id = $2', [user.id, map.id])).map((v) => [v.point_id, v]));
      const current = (await q<{ point_id: number | null }>('SELECT point_id FROM hk_march_state WHERE user_id = $1 AND map_id = $2', [user.id, map.id]))[0]?.point_id ?? start?.id ?? null;
      const stages = new Map((await q<{ id: number; battle_id: number; title: string; status: string; best_stars: number | null }>(
        'SELECT s.id, s.battle_id, s.title, s.status, sp.best_stars FROM hk_stages s LEFT JOIN hk_stage_progress sp ON sp.stage_id = s.id AND sp.user_id = $1', [user.id])).map((s) => [s.id, s]));
      const battles = await this.battleStates(q, user);
      const dialogs = new Set((await q<{ point_id: number }>("SELECT point_id FROM hk_dialogs WHERE status = 'published' AND point_id = ANY($1)", [points.map((p) => p.id)])).map((d) => d.point_id));
      const near = (id: number) => edges.some((e) => (e.from_point === id && visits.has(e.to_point)) || (e.to_point === id && visits.has(e.from_point)));
      const out = points.map((p) => {
        let locked: string | null = null;
        const stage = p.kind === 'battle' ? stages.get(Number(p.payload.stage_id)) : undefined;
        if (p.kind === 'battle') {
          if (!stage || stage.status !== 'published') locked = 'Trận đánh này chưa được mở.';
          else if (battles.get(stage.battle_id) === 'locked') locked = 'Hãy học xong cửa dẫn tới trận này để ra trận.';
        }
        const visited = visits.has(p.id);
        const state = p.id === current ? 'current' : visited ? 'visited' : near(p.id) && !locked ? 'open' : 'locked';
        return {
          id: p.id, code: p.code, name: p.name, description: p.description, x: p.x, y: p.y, kind: p.kind, state, done: Boolean(visits.get(p.id)?.done_at),
          locked_reason: state === 'locked' ? locked ?? 'Hãy đi qua điểm liền trước để mở điểm này.' : null, has_dialog: dialogs.has(p.id),
          stage_id: stage ? stage.id : null, stars: stage?.best_stars ?? null,
        };
      });
      return {
        map: { id: map.id, title: map.title, background_url: map.background_url, campaign }, points: out, edges: edges.map((e) => ({ from: e.from_point, to: e.to_point })), current_point_id: current,
        progress: { visited: out.filter((p) => p.state === 'visited' || p.state === 'current').length, total: out.length }, war: await this.gate.status(q, user),
      };
    });
  }

  /** Đường đi ngắn nhất từ điểm đang đứng tới đích chỉ qua các điểm đã đi (cộng đích) */
  private pathTo(edges: Array<{ from_point: number; to_point: number }>, visited: Set<number>, from: number, to: number): number[] | null {
    const allowed = new Set([...visited, to]);
    const prev = new Map<number, number>([[from, from]]);
    const queue = [from];
    while (queue.length) {
      const cur = queue.shift()!;
      if (cur === to) break;
      for (const e of edges) {
        const next = e.from_point === cur ? e.to_point : e.to_point === cur ? e.from_point : null;
        if (next !== null && allowed.has(next) && !prev.has(next)) { prev.set(next, cur); queue.push(next); }
      }
    }
    if (!prev.has(to)) return null;
    const path = [to];
    while (path[0] !== from) path.unshift(prev.get(path[0])!);
    return path;
  }

  /** Di chuyển (HK.HS.114) và kích hoạt sự kiện của điểm đến (HK.HS.115) */
  async move(user: UserRow, pointId: number) {
    return this.db.tx(async (q) => {
      await this.gate.assertOpen(q, user);
      const p = (await q<Point>('SELECT id, map_id, code, name, description, x::float8 AS x, y::float8 AS y, kind, payload, sort_order FROM hk_march_points WHERE id = $1', [pointId]))[0];
      if (!p) throw notFound('điểm đến');
      const map = (await q<{ id: number; status: string }>('SELECT id, status FROM hk_march_maps WHERE id = $1', [p.map_id]))[0];
      if (!map || map.status !== 'published') throw notFound('điểm đến');
      const edges = await q<{ from_point: number; to_point: number }>('SELECT from_point, to_point FROM hk_march_edges WHERE map_id = $1', [map.id]);
      const visited = new Set((await q<{ point_id: number }>('SELECT v.point_id FROM hk_march_visits v JOIN hk_march_points x ON x.id = v.point_id WHERE v.user_id = $1 AND x.map_id = $2', [user.id, map.id])).map((v) => v.point_id));
      const st = (await q<{ point_id: number | null; updated_at: string }>('SELECT point_id, updated_at FROM hk_march_state WHERE user_id = $1 AND map_id = $2 FOR UPDATE', [user.id, map.id]))[0];
      if (!st?.point_id) throw new ConflictException('Hãy mở bản đồ trước khi đi');
      const first = !visited.has(p.id);
      if (first) {
        const adjacent = edges.some((e) => (e.from_point === p.id && visited.has(e.to_point)) || (e.to_point === p.id && visited.has(e.from_point)));
        if (!adjacent) throw new ConflictException('Em chưa đi tới điểm này được: hãy đi qua điểm liền trước.');
        if (p.kind === 'battle') {
          const stage = (await q<{ battle_id: number; status: string }>('SELECT battle_id, status FROM hk_stages WHERE id = $1', [Number(p.payload.stage_id)]))[0];
          if (!stage || stage.status !== 'published') throw new ConflictException('Trận đánh này chưa được mở.');
          if ((await this.battleStates(q, user)).get(stage.battle_id) === 'locked') throw new ConflictException('Hãy học xong cửa dẫn tới trận này để ra trận.');
        }
      }
      const path = this.pathTo(edges, visited, st.point_id, p.id);
      if (!path) throw new ConflictException('Không có đường đi tới điểm này qua những nơi em đã tới.');
      await q('INSERT INTO hk_march_visits (user_id, point_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [user.id, p.id]);
      await q('UPDATE hk_march_state SET point_id = $3, updated_at = now() WHERE user_id = $1 AND map_id = $2', [user.id, map.id, p.id]);
      await this.gate.addPlay(q, user, Date.now() - new Date(st.updated_at).getTime());
      return { path, point: { id: p.id, name: p.name, kind: p.kind }, event: await this.event(q, user, p, first) };
    });
  }

  /** Sự kiện theo loại điểm; phần thưởng nhận một lần (khóa theo điểm) nên đi lại không nhận trùng */
  private async event(q: Q, user: UserRow, p: Point, first: boolean): Promise<Record<string, unknown> | null> {
    const visit = (await q<{ done_at: string | null }>('SELECT done_at FROM hk_march_visits WHERE user_id = $1 AND point_id = $2', [user.id, p.id]))[0];
    const done = Boolean(visit?.done_at);
    const finish = () => q('UPDATE hk_march_visits SET done_at = COALESCE(done_at, now()) WHERE user_id = $1 AND point_id = $2', [user.id, p.id]);
    const pay = p.payload;
    if (p.kind === 'story') {
      const d = (await q<Dialog>("SELECT id, point_id, title, lines, source_ids, status FROM hk_dialogs WHERE point_id = $1 AND status = 'published' ORDER BY id DESC LIMIT 1", [p.id]))[0];
      await finish();
      if (!d) return { kind: 'story', dialog: null };
      await q('INSERT INTO hk_dialog_log (user_id, dialog_id) VALUES ($1, $2) ON CONFLICT (user_id, dialog_id) DO UPDATE SET seen_at = now()', [user.id, d.id]);
      return { kind: 'story', dialog: await this.dialogView(q, d) };
    }
    if (p.kind === 'card') {
      if (done) return { kind: 'card', done: true };
      const card = (await q<{ id: number; name: string }>('SELECT id, name FROM hk_cards WHERE code = $1', [String(pay.card_code ?? '')]))[0];
      if (!card) { await finish(); return { kind: 'card', done: true }; }
      const qty = Math.max(1, Math.min(20, Number(pay.qty ?? 1)));
      const res = await this.game.addFragments(q, user.id, card.id, qty);
      await finish();
      return { kind: 'card', done: false, card: { id: card.id, name: card.name }, qty, merged: res.merged, fragments: res.fragments };
    }
    if (p.kind === 'quiz') return { kind: 'quiz', done, question: done ? null : await this.question(q, user, p) };
    if (p.kind === 'source') {
      const s = (await q<{ id: number; title: string }>("SELECT id, title FROM hist_sources WHERE id = $1 AND status = 'published'", [Number(pay.source_id)]))[0];
      if (!s) { await finish(); return { kind: 'source', source: null }; }
      await q('INSERT INTO hk_unlocked_sources (user_id, source_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [user.id, s.id]);
      await finish();
      return { kind: 'source', source: s };
    }
    if (p.kind === 'chest') {
      if (done) return { kind: 'chest', done: true };
      const rewards = await this.reward(q, user, p, pay, 'chest');
      await finish();
      return { kind: 'chest', done: false, rewards };
    }
    if (p.kind === 'battle') return { kind: 'battle', stage_id: Number(pay.stage_id) || null, first };
    return null;
  }

  private async reward(q: Q, user: UserRow, p: Point, pay: Record<string, any>, reason: 'chest' | 'node') {
    const out = { gold: 0, binh_thu: 0, fragments: [] as Array<{ card: string; qty: number; merged: boolean }> };
    const gold = Math.max(0, Math.min(1000, Number(pay.gold ?? 0))), bt = Math.max(0, Math.min(1000, Number(pay.binh_thu ?? 0)));
    if (gold && (await this.game.addGold(q, user, gold, 'node', `march:${p.id}`))) out.gold = gold;
    if (bt && (await this.game.addBinhThu(q, user, bt, reason, `march:${p.id}`))) out.binh_thu = bt;
    for (const f of (Array.isArray(pay.fragments) ? pay.fragments : []) as Array<{ card_code: string; qty: number }>) {
      const c = (await q<{ id: number; name: string }>('SELECT id, name FROM hk_cards WHERE code = $1', [String(f.card_code)]))[0];
      if (c) { const r = await this.game.addFragments(q, user.id, c.id, Math.max(1, Math.min(20, Number(f.qty ?? 1)))); out.fragments.push({ card: c.name, qty: Number(f.qty ?? 1), merged: r.merged }); }
    }
    return out;
  }

  private async dialogView(q: Q, d: Dialog) {
    const sources = d.source_ids.length ? await q<{ id: number; title: string }>("SELECT id, title FROM hist_sources WHERE id = ANY($1) AND status = 'published' ORDER BY title", [d.source_ids]) : [];
    const figures = new Map<number, { name: string; image_url: string | null }>();
    for (const l of d.lines) if (l.figure_id && !figures.has(Number(l.figure_id))) {
      const f = (await q<{ id: number; name: string; image_url: string | null }>("SELECT id, name, image_url FROM hist_figures WHERE id = $1 AND status = 'published'", [Number(l.figure_id)]))[0];
      if (f) figures.set(f.id, f);
    }
    return { id: d.id, title: d.title, lines: d.lines.map((l) => ({ speaker: l.speaker, text: l.text, choices: l.choices ?? null, figure: l.figure_id ? figures.get(Number(l.figure_id)) ?? null : null })), sources };
  }

  // ---------------------------------------------------------------------- thử thách câu hỏi tại điểm
  private async question(q: Q, user: UserRow, p: Point) {
    const rows = await q<QuestionCore>(
      'SELECT t.id, t.qtype, t.prompt, t.image_url, t.explanation, t.difficulty, t.data FROM hk_quiz_questions k JOIN hk_questions t ON t.id = k.question_id WHERE k.quiz_id = $1 ORDER BY k.position, t.id', [Number(p.payload.quiz_id)]);
    if (!rows.length) return null;
    const pick = rows[(user.id + p.id) % rows.length];
    return publicView(pick, user.id * 31 + p.id, true);
  }

  async answerQuiz(user: UserRow, pointId: number, answer: unknown) {
    return this.db.tx(async (q) => {
      await this.gate.assertOpen(q, user);
      const p = (await q<Point>("SELECT p.id, p.map_id, p.code, p.name, p.description, p.x::float8 AS x, p.y::float8 AS y, p.kind, p.payload, p.sort_order FROM hk_march_points p JOIN hk_march_maps m ON m.id = p.map_id WHERE p.id = $1 AND m.status = 'published'", [pointId]))[0];
      if (!p || p.kind !== 'quiz') throw notFound('thử thách');
      if (!(await q('SELECT 1 FROM hk_march_visits WHERE user_id = $1 AND point_id = $2', [user.id, p.id])).length) throw new ConflictException('Hãy đi tới điểm này trước');
      const rows = await q<QuestionCore>('SELECT t.id, t.qtype, t.prompt, t.image_url, t.explanation, t.difficulty, t.data FROM hk_quiz_questions k JOIN hk_questions t ON t.id = k.question_id WHERE k.quiz_id = $1 ORDER BY k.position, t.id', [Number(p.payload.quiz_id)]);
      if (!rows.length) throw new ConflictException('Thử thách này chưa có câu hỏi');
      const pick = rows[(user.id + p.id) % rows.length];
      const g = grade(pick, answer);
      let rewards = null;
      const already = Boolean((await q<{ done_at: string | null }>('SELECT done_at FROM hk_march_visits WHERE user_id = $1 AND point_id = $2', [user.id, p.id]))[0]?.done_at);
      if (g.correct && !already) {
        rewards = await this.reward(q, user, p, { gold: p.payload.gold ?? 5, binh_thu: p.payload.binh_thu ?? 2 }, 'node');
        await q('UPDATE hk_march_visits SET done_at = now() WHERE user_id = $1 AND point_id = $2', [user.id, p.id]);
      }
      return { correct: g.correct, explanation: pick.explanation, detail: g.detail, rewards, done: g.correct || already };
    });
  }

  /** Nhật ký hành quân (HK.HS.116): các đoạn hội thoại đã xem, xem lại được */
  async log(user: UserRow) {
    const rows = await this.db.query<{ id: number; title: string; lines: Dialog['lines']; source_ids: number[]; point_name: string | null; seen_at: string }>(
      `SELECT d.id, d.title, d.lines, d.source_ids, p.name AS point_name, l.seen_at FROM hk_dialog_log l JOIN hk_dialogs d ON d.id = l.dialog_id LEFT JOIN hk_march_points p ON p.id = d.point_id
       WHERE l.user_id = $1 AND d.status = 'published' ORDER BY l.seen_at DESC LIMIT 100`, [user.id]);
    return this.db.tx(async (q) => {
      const out = [];
      for (const r of rows) out.push({ ...(await this.dialogView(q, { id: r.id, point_id: null, title: r.title, lines: r.lines, source_ids: r.source_ids, status: 'published' })), point_name: r.point_name, seen_at: r.seen_at });
      return out;
    });
  }

  // ---------------------------------------------------------------------- quản trị bản đồ (HK.AD.081) và hội thoại (HK.AD.082)
  async adminMaps() {
    return this.db.query(
      `SELECT m.id, m.campaign_id, m.title, m.background_url, m.status, c.title AS campaign_title, (SELECT count(*)::int FROM hk_march_points p WHERE p.map_id = m.id) AS points,
              (SELECT count(DISTINCT v.user_id)::int FROM hk_march_visits v JOIN hk_march_points p ON p.id = v.point_id WHERE p.map_id = m.id) AS players
       FROM hk_march_maps m JOIN hist_campaigns c ON c.id = m.campaign_id ORDER BY c.sort_order, c.id`);
  }

  async adminMap(id: number): Promise<Record<string, any>> {
    const map = (await this.db.query<Record<string, any>>('SELECT m.id, m.campaign_id, m.title, m.background_url, m.status, c.title AS campaign_title FROM hk_march_maps m JOIN hist_campaigns c ON c.id = m.campaign_id WHERE m.id = $1', [id]))[0];
    if (!map) throw notFound('bản đồ hành quân');
    const points = await this.db.query<Point & { dialog_id: number | null }>(
      `SELECT p.id, p.code, p.name, p.description, p.x::float8 AS x, p.y::float8 AS y, p.kind, p.payload, p.sort_order,
              (SELECT d.id FROM hk_dialogs d WHERE d.point_id = p.id ORDER BY d.id DESC LIMIT 1) AS dialog_id FROM hk_march_points p WHERE p.map_id = $1 ORDER BY p.sort_order, p.id`, [id]);
    const edges = await this.db.query<{ from_code: string; to_code: string }>(
      'SELECT a.code AS from_code, b.code AS to_code FROM hk_march_edges e JOIN hk_march_points a ON a.id = e.from_point JOIN hk_march_points b ON b.id = e.to_point WHERE e.map_id = $1', [id]);
    return { ...map, points, edges, problems: await this.mapProblems(this.db.query.bind(this.db) as Q, id) };
  }

  async createMap(body: Record<string, any>) {
    const title = String(body.title ?? '').trim();
    if (title.length < 2 || title.length > 160) throw new BadRequestException('Tên bản đồ từ 2 đến 160 ký tự');
    if (!(await this.db.query('SELECT 1 FROM hist_campaigns WHERE id = $1', [Number(body.campaign_id)])).length) throw new BadRequestException('Cuộc kháng chiến không tồn tại');
    try {
      const id = (await this.db.query<{ id: number }>('INSERT INTO hk_march_maps (campaign_id, title, background_url) VALUES ($1, $2, $3) RETURNING id', [Number(body.campaign_id), title, this.url(body.background_url)]))[0].id;
      return this.adminMap(id);
    } catch (e) { if ((e as { code?: string }).code === '23505') throw new ConflictException('Cuộc kháng chiến này đã có bản đồ hành quân'); throw e; }
  }

  private url(v: unknown): string | null {
    const s = String(v ?? '').trim();
    if (!s) return null;
    if (!/^https:\/\/[^\s]+$/.test(s) || s.length > 500) throw new BadRequestException('Ảnh nền phải là liên kết https');
    return s;
  }

  async updateMap(id: number, body: Record<string, any>) {
    const cur = await this.adminMap(id);
    const title = body.title === undefined ? cur.title : String(body.title).trim();
    if (title.length < 2 || title.length > 160) throw new BadRequestException('Tên bản đồ từ 2 đến 160 ký tự');
    await this.db.query('UPDATE hk_march_maps SET title = $2, background_url = $3, updated_at = now() WHERE id = $1', [id, title, body.background_url === undefined ? cur.background_url : this.url(body.background_url)]);
    return this.adminMap(id);
  }

  /** Lưu toàn bộ điểm và đường nối theo mã điểm; điểm cũ giữ nguyên mã thì giữ nguyên tiến độ học sinh */
  async saveLayout(id: number, body: { points?: Array<Record<string, any>>; edges?: Array<{ from: string; to: string }> }) {
    const points = body.points ?? [], edges = body.edges ?? [];
    if (!points.length || points.length > 40) throw new BadRequestException('Bản đồ có từ 1 đến 40 điểm');
    const codes = new Set<string>();
    for (const [i, p] of points.entries()) {
      const label = `Điểm ${i + 1}`;
      if (!/^[a-z0-9_-]{2,40}$/.test(String(p.code))) throw new BadRequestException(`${label}: mã gồm chữ thường, số, gạch ngang (2–40 ký tự)`);
      if (codes.has(p.code)) throw new BadRequestException(`${label}: trùng mã ${p.code}`);
      codes.add(p.code);
      const name = String(p.name ?? '').trim();
      if (name.length < 2 || name.length > 80) throw new BadRequestException(`${label}: tên từ 2 đến 80 ký tự`);
      if (!KINDS.includes(p.kind)) throw new BadRequestException(`${label}: loại điểm thuộc ${KINDS.join(', ')}`);
      if (!(Number(p.x) >= 0 && Number(p.x) <= 100 && Number(p.y) >= 0 && Number(p.y) <= 100)) throw new BadRequestException(`${label}: vị trí x, y từ 0 đến 100 (phần trăm bản đồ)`);
      if (String(p.description ?? '').length > 400) throw new BadRequestException(`${label}: mô tả tối đa 400 ký tự`);
    }
    if (points.filter((p) => p.kind === 'start').length !== 1) throw new BadRequestException('Bản đồ cần đúng một điểm xuất phát');
    for (const e of edges) if (!codes.has(e.from) || !codes.has(e.to) || e.from === e.to) throw new BadRequestException('Đường nối phải nối hai điểm khác nhau của bản đồ');
    // đồ thị liên thông từ điểm xuất phát
    const start = points.find((p) => p.kind === 'start')!.code;
    const seen = new Set([start]);
    for (let grew = true; grew;) { grew = false; for (const e of edges) { if (seen.has(e.from) !== seen.has(e.to)) { seen.add(e.from); seen.add(e.to); grew = true; } } }
    if (seen.size !== codes.size) throw new UnprocessableEntityException('Có điểm không nối được tới điểm xuất phát qua đường hành quân');
    await this.db.tx(async (q) => {
      if (!(await q('SELECT 1 FROM hk_march_maps WHERE id = $1 FOR UPDATE', [id])).length) throw notFound('bản đồ hành quân');
      for (const p of points) {
        const pay = p.payload ?? {};
        if (typeof pay !== 'object' || Array.isArray(pay)) throw new BadRequestException(`Điểm ${p.code}: dữ liệu sự kiện phải là đối tượng`);
        if (p.kind === 'card' && !(await q('SELECT 1 FROM hk_cards WHERE code = $1', [String(pay.card_code)])).length) throw new BadRequestException(`Điểm ${p.code}: không có thẻ mã "${pay.card_code}"`);
        if (p.kind === 'battle' && !(await q('SELECT 1 FROM hk_stages WHERE id = $1', [Number(pay.stage_id)])).length) throw new BadRequestException(`Điểm ${p.code}: không có màn chơi #${pay.stage_id}`);
        if (p.kind === 'quiz' && !(await q('SELECT 1 FROM hk_quizzes WHERE id = $1', [Number(pay.quiz_id)])).length) throw new BadRequestException(`Điểm ${p.code}: không có bộ câu hỏi #${pay.quiz_id}`);
        if (p.kind === 'source' && !(await q('SELECT 1 FROM hist_sources WHERE id = $1', [Number(pay.source_id)])).length) throw new BadRequestException(`Điểm ${p.code}: không có tư liệu #${pay.source_id}`);
      }
      const existing = await q<{ id: number; code: string }>('SELECT id, code FROM hk_march_points WHERE map_id = $1', [id]);
      for (const old of existing.filter((e) => !codes.has(e.code))) await q('DELETE FROM hk_march_points WHERE id = $1', [old.id]);
      await q('DELETE FROM hk_march_edges WHERE map_id = $1', [id]);
      for (const [i, p] of points.entries()) {
        await q(
          `INSERT INTO hk_march_points (map_id, code, name, description, x, y, kind, payload, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (map_id, code) DO UPDATE SET name = $3, description = $4, x = $5, y = $6, kind = $7, payload = $8, sort_order = $9`,
          [id, p.code, String(p.name).trim(), String(p.description ?? '').trim() || null, Number(p.x), Number(p.y), p.kind, JSON.stringify(p.payload ?? {}), i]);
      }
      const ids = new Map((await q<{ id: number; code: string }>('SELECT id, code FROM hk_march_points WHERE map_id = $1', [id])).map((r) => [r.code, r.id]));
      for (const e of edges) await q('INSERT INTO hk_march_edges (map_id, from_point, to_point) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [id, ids.get(e.from), ids.get(e.to)]);
      await q('UPDATE hk_march_maps SET updated_at = now() WHERE id = $1', [id]);
    });
    return this.adminMap(id);
  }

  private async mapProblems(q: Q, id: number): Promise<string[]> {
    const out: string[] = [];
    const points = await q<Point>('SELECT id, code, name, kind, payload FROM hk_march_points WHERE map_id = $1', [id]);
    if (!points.length) out.push('Bản đồ chưa có điểm nào');
    for (const p of points) {
      if (p.kind === 'battle') {
        const s = (await q<{ status: string }>('SELECT status FROM hk_stages WHERE id = $1', [Number(p.payload.stage_id)]))[0];
        if (!s || s.status !== 'published') out.push(`Điểm "${p.name}": màn chơi trận đánh chưa phát hành`);
      }
      if (p.kind === 'story' && !(await q("SELECT 1 FROM hk_dialogs WHERE point_id = $1 AND status = 'published'", [p.id])).length) out.push(`Điểm "${p.name}": chưa có hội thoại đã phát hành`);
    }
    return out;
  }

  async setMapStatus(id: number, status: string) {
    if (!['draft', 'published'].includes(status)) throw new BadRequestException('Trạng thái là bản nháp hoặc đã phát hành');
    if (status === 'published') {
      const problems = await this.mapProblems(this.db.query.bind(this.db) as Q, id);
      if (problems.length) throw new ConflictException(`Chưa phát hành được: ${problems.join('; ')}`);
      const campaign = (await this.db.query<{ status: string }>('SELECT c.status FROM hk_march_maps m JOIN hist_campaigns c ON c.id = m.campaign_id WHERE m.id = $1', [id]))[0];
      if (!campaign) throw notFound('bản đồ hành quân');
      if (campaign.status !== 'published') throw new ConflictException('Cuộc kháng chiến của bản đồ chưa công bố trong kho lịch sử');
    }
    await this.db.query("UPDATE hk_march_maps SET status = $2, published_at = CASE WHEN $2 = 'published' THEN now() END, updated_at = now() WHERE id = $1", [id, status]);
    return this.adminMap(id);
  }

  async deleteMap(id: number) {
    const players = Number((await this.db.query<{ n: string }>('SELECT count(DISTINCT v.user_id) AS n FROM hk_march_visits v JOIN hk_march_points p ON p.id = v.point_id WHERE p.map_id = $1', [id]))[0].n);
    if (players) throw new ConflictException(`Đã có ${players} học sinh hành quân trên bản đồ này; hãy gỡ phát hành thay vì xóa`);
    await this.db.query('DELETE FROM hk_march_maps WHERE id = $1', [id]);
  }

  // ---- hội thoại
  async adminDialogs() {
    return this.db.query('SELECT d.id, d.title, d.status, d.point_id, p.name AS point_name, jsonb_array_length(d.lines)::int AS lines, cardinality(d.source_ids)::int AS sources FROM hk_dialogs d LEFT JOIN hk_march_points p ON p.id = d.point_id ORDER BY d.id');
  }

  async adminDialog(id: number) {
    const d = (await this.db.query<Dialog>('SELECT id, point_id, title, lines, source_ids, status FROM hk_dialogs WHERE id = $1', [id]))[0];
    if (!d) throw notFound('hội thoại');
    return d;
  }

  private async dialogBody(q: Q, body: Record<string, any>, cur?: Dialog) {
    const title = String(body.title ?? cur?.title ?? '').trim();
    if (title.length < 2 || title.length > 160) throw new BadRequestException('Tên hội thoại từ 2 đến 160 ký tự');
    const lines = (body.lines ?? cur?.lines) as Array<Record<string, any>>;
    if (!Array.isArray(lines) || !lines.length || lines.length > 30) throw new BadRequestException('Hội thoại có từ 1 đến 30 câu');
    const clean = lines.map((l, i) => {
      const speaker = String(l.speaker ?? '').trim(), text = String(l.text ?? '').trim();
      if (!speaker || speaker.length > 60 || !text || text.length > 400) throw new BadRequestException(`Câu ${i + 1}: cần nhân vật nói (≤60 ký tự) và lời thoại (≤400 ký tự)`);
      const choices = Array.isArray(l.choices) ? l.choices.slice(0, 3).map((c: Record<string, any>) => ({ text: String(c.text ?? '').trim().slice(0, 120), reply: String(c.reply ?? '').trim().slice(0, 300) })).filter((c: { text: string }) => c.text) : [];
      return { speaker, text, ...(l.figure_id ? { figure_id: Number(l.figure_id) } : {}), ...(choices.length ? { choices } : {}) };
    });
    const sources = [...new Set(((body.source_ids ?? cur?.source_ids ?? []) as unknown[]).map(Number))];
    if (sources.some((s) => !Number.isInteger(s))) throw new BadRequestException('Tư liệu nguồn không hợp lệ');
    if (sources.length && (await q('SELECT 1 FROM hist_sources WHERE id = ANY($1) HAVING count(*) = $2', [sources, sources.length])).length === 0) throw new BadRequestException('Có tư liệu nguồn không tồn tại');
    const pointId = body.point_id === undefined ? cur?.point_id ?? null : body.point_id === null || body.point_id === '' ? null : Number(body.point_id);
    if (pointId !== null && !(await q("SELECT 1 FROM hk_march_points WHERE id = $1 AND kind = 'story'", [pointId])).length) throw new BadRequestException('Hội thoại chỉ gắn với điểm loại "hội thoại"');
    return { title, lines: clean, sources, pointId };
  }

  async createDialog(body: Record<string, any>) {
    const id = await this.db.tx(async (q) => {
      const d = await this.dialogBody(q, body);
      return (await q<{ id: number }>('INSERT INTO hk_dialogs (point_id, title, lines, source_ids) VALUES ($1, $2, $3, $4) RETURNING id', [d.pointId, d.title, JSON.stringify(d.lines), d.sources]))[0].id;
    });
    return this.adminDialog(id);
  }

  async updateDialog(id: number, body: Record<string, any>) {
    const cur = await this.adminDialog(id);
    await this.db.tx(async (q) => {
      const d = await this.dialogBody(q, body, cur);
      await q("UPDATE hk_dialogs SET point_id = $2, title = $3, lines = $4, source_ids = $5, status = CASE WHEN status = 'published' THEN 'draft' ELSE status END, updated_at = now() WHERE id = $1", [id, d.pointId, d.title, JSON.stringify(d.lines), d.sources]);
    });
    return this.adminDialog(id);
  }

  /** Phát hành cần gắn tư liệu nguồn đã công bố để kiểm chứng lời thoại */
  async setDialogStatus(id: number, status: string) {
    const d = await this.adminDialog(id);
    if (!['draft', 'published'].includes(status)) throw new BadRequestException('Trạng thái là bản nháp hoặc đã phát hành');
    if (status === 'published') {
      if (!d.source_ids.length) throw new ConflictException('Hãy gắn ít nhất một tư liệu nguồn để kiểm chứng lời thoại trước khi phát hành');
      const ok = Number((await this.db.query<{ n: string }>("SELECT count(*) AS n FROM hist_sources WHERE id = ANY($1) AND status = 'published'", [d.source_ids]))[0].n);
      if (ok !== d.source_ids.length) throw new ConflictException('Mọi tư liệu nguồn phải đã được công bố trong kho lịch sử');
    }
    await this.db.query('UPDATE hk_dialogs SET status = $2, updated_at = now() WHERE id = $1', [id, status]);
    return this.adminDialog(id);
  }

  async deleteDialog(id: number) {
    await this.adminDialog(id);
    await this.db.query('DELETE FROM hk_dialogs WHERE id = $1', [id]);
  }
}
