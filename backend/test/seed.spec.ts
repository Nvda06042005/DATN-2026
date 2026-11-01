/**
 * Nội dung học mẫu của migration 019 chạy trọn vẹn: sau khi quản trị tổng công bố kho lịch sử và bài học, ba hành trình mẫu phát hành được
 * và một học sinh hoàn thành cả ba cuộc kháng chiến (mọi dạng câu hỏi – kể cả sắp xếp và kéo thả bản đồ – chấm đúng trên đề đã xáo trộn).
 */
import { call, hasPostgres, Started, startApp } from './harness';
import { bootstrap, Fixture, publish } from './fixture';
import type { DatabaseService } from '../src/database/database.service';

let s: Started, f: Fixture, db: DatabaseService;
const api = (method: string, path: string, body?: unknown, token = f.S1.token) => call(s.base, method, path, body, token);
const keys = new Map<number, { qtype: string; data: any }>();

/** Đáp án đúng tính từ dữ liệu gốc trong cơ sở dữ liệu (học sinh không có dữ liệu này) */
function solve(questionId: number): unknown {
  const { qtype, data } = keys.get(questionId)!;
  switch (qtype) {
    case 'single': return { choice: data.correct };
    case 'multiple': return { choices: data.correct };
    case 'truefalse': return { value: data.correct };
    case 'fill': return { blanks: data.blanks.map((b: any) => b.accept[0]) };
    case 'order': return { order: data.items.map((i: any) => i.id) };
    default: return { placements: Object.fromEntries(data.targets.map((t: any) => [t.id, { lat: t.lat, lng: t.lng }])) };
  }
}

async function playQuiz(start: any) {
  let state = start;
  let last: any;
  for (;;) {
    if (state.waiting_next) state = (await api('POST', `/api/play/attempts/${state.id}/next`)).body;
    const q = state.current.question;
    last = (await api('POST', `/api/play/attempts/${state.id}/answer`, { question_id: q.id, answer: solve(q.id) })).body;
    expect([q.prompt, last.result.correct]).toEqual([q.prompt, true]);
    if (last.finished) return last.summary;
    state = { ...state, waiting_next: true };
  }
}

(hasPostgres() ? describe : describe.skip)('Nội dung học mẫu (migration 019)', () => {
  beforeAll(async () => {
    s = await startApp('seed_test');
    db = s.moduleRef.get((await import('../src/database/database.service')).DatabaseService);
    const root = (await call(s.base, 'POST', '/api/auth/login', { username: 'admin', password: 'admin@123', portal: 'root_admin' })).body.token;
    f = await bootstrap(s, root, true);
    for (const row of await db.query<{ id: number; qtype: string; data: any }>('SELECT id, qtype, data FROM hk_questions')) keys.set(row.id, row);
  });
  afterAll(async () => { await s?.close(); });

  test('mọi thứ ở trạng thái Nháp: học sinh chưa thấy gì và hành trình chưa phát hành được', async () => {
    const home = await api('GET', '/api/play/home');
    expect(home.body.campaigns).toEqual([]);
    expect((await api('GET', '/api/learn/figures')).body).toEqual([]);
    const list = await api('GET', '/api/content/journeys?store=system', undefined, f.root);
    expect(list.body.map((j: any) => j.status)).toEqual(['draft', 'draft', 'draft']);
    const refused = await api('PATCH', `/api/content/journeys/${list.body[0].id}/status`, { status: 'published' }, f.root);
    expect(refused.status).toBe(422);
    expect(refused.body.detail).toContain('chưa công bố');
    expect((await api('GET', '/api/content/lessons', undefined, f.T1.token)).body).toEqual([]);
    expect((await api('GET', '/api/content/questions?store=system', undefined, f.T1.token)).body.total).toBe(27); // câu hỏi mẫu dùng được ngay để soạn bộ đề
  });

  test('công bố kho lịch sử và bài học, phát hành ba hành trình mẫu, đặt mặc định', async () => {
    for (const entity of ['campaigns', 'places', 'figures', 'sources', 'terms', 'events', 'battles']) {
      const items = (await api('GET', `/api/admin/history/${entity}?limit=100`, undefined, f.root)).body.items;
      for (const item of items) await publish(s.base, f.root, entity, item.id);
    }
    for (const lesson of (await api('GET', '/api/content/lessons', undefined, f.root)).body) {
      expect((await api('PATCH', `/api/content/lessons/${lesson.id}/status`, { status: 'published' }, f.root)).body.status).toBe('published');
    }
    for (const journey of (await api('GET', '/api/content/journeys?store=system', undefined, f.root)).body) {
      expect((await api('PATCH', `/api/content/journeys/${journey.id}/status`, { status: 'published' }, f.root)).status).toBe(200);
      expect((await api('PATCH', `/api/content/journeys/${journey.id}/default`, { value: true }, f.root)).body.is_default).toBe(true);
    }
    const home = await api('GET', '/api/play/home');
    expect(home.body.campaigns.map((c: any) => [c.nodes, c.percent])).toEqual([[9, 0], [11, 0], [9, 0]]);
    expect(home.body.campaigns.every((c: any) => c.journey?.title)).toBe(true);
  });

  test('học sinh hoàn thành cả ba hành trình mẫu: bài học, trận đánh, câu hỏi, tư liệu, Quyết chiến', async () => {
    const home = (await api('GET', '/api/play/home')).body;
    for (const campaign of home.campaigns) {
      const map = (await api('GET', `/api/play/campaigns/${campaign.id}/map`)).body;
      for (let step = 0; step < map.nodes.length; step++) {
        const current = (await api('GET', `/api/play/campaigns/${campaign.id}/map`)).body.nodes.find((n: any) => n.state === 'available');
        expect(current).toBeTruthy();
        const detail = (await api('GET', `/api/play/nodes/${current.id}`)).body;
        if (current.kind === 'lesson') {
          const lesson = (await api('GET', `/api/play/nodes/${current.id}/lesson`)).body;
          expect(lesson.blocks.length).toBeGreaterThanOrEqual(3);
          await api('POST', `/api/play/nodes/${current.id}/lesson/progress`, { read_percent: 100 });
          const done = await api('POST', `/api/play/nodes/${current.id}/lesson/complete`, { answers: lesson.checks.map((c: any) => ({ question_id: c.id, answer: solve(c.id) })) });
          expect(done.body.completed).toBe(true);
        } else if (detail.needs_quiz) {
          const summary = await playQuiz((await api('POST', `/api/play/nodes/${current.id}/attempts`)).body);
          expect(summary).toMatchObject({ percent: 100, passed: true, stars: 3 });
        } else {
          expect((await api('POST', `/api/play/nodes/${current.id}/complete`)).body.first_completion).toBe(true);
        }
      }
      const after = (await api('GET', `/api/play/campaigns/${campaign.id}/map`)).body;
      expect(after.nodes.every((n: any) => n.state === 'done')).toBe(true);
      expect(after.totals.percent).toBe(100);
    }
    const finished = (await api('GET', '/api/play/home')).body;
    expect(finished.campaigns.every((c: any) => c.completed)).toBe(true);
    expect(finished.points).toBeGreaterThan(1500);
    // Tư liệu mở khóa theo nút: Hịch tướng sĩ mở sau bài ôn tập Lần II, "Tụng giá hoàn kinh sư" mở khi hoàn thành nút tư liệu
    const sources = (await api('GET', '/api/learn/sources')).body;
    expect(sources.length).toBeGreaterThanOrEqual(2);
    expect(sources.every((x: any) => x.locked === false)).toBe(true);
    // Học sinh khác chưa học: tiến độ tách riêng, tư liệu vẫn khóa
    const other = (await api('GET', '/api/learn/sources', undefined, f.S2.token)).body;
    expect(other.filter((x: any) => x.locked).length).toBeGreaterThanOrEqual(2);
    expect((await api('GET', '/api/play/home', undefined, f.S2.token)).body.campaigns.every((c: any) => c.percent === 0)).toBe(true);
  });
});
