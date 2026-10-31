/**
 * Sprint 3 + phần làm bài của Sprint 4 (HK.HS.017–050, HK.GV.018–021, HK.AD.043–044, HK.SYS.007/014): kho lịch sử cho học sinh,
 * bài học, hành trình mẫu và nút, bản đồ nhiệm vụ, mở khóa nút và tư liệu, làm bài có đồng hồ chấm ở máy chủ, luyện câu sai, lịch sử làm bài.
 * HTTP thật trên PostgreSQL tạm.
 */
import { call, hasPostgres, Started, startApp } from './harness';
import { bootstrap, Fixture, publish } from './fixture';
import type { DatabaseService } from '../src/database/database.service';

let s: Started, f: Fixture, db: DatabaseService;
const api = (method: string, path: string, body?: unknown, token = f.S1.token) => call(s.base, method, path, body, token);
const root = (method: string, path: string, body?: unknown) => api(method, path, body, f.root);
const hist = async (entity: string, body: Record<string, unknown>) => {
  const res = await root('POST', `/api/admin/history/${entity}`, body);
  if (res.status !== 201) throw new Error(`Không tạo được ${entity}: ${JSON.stringify(res.body)}`);
  return res.body.id as number;
};
const opts = (...texts: string[]) => texts.map((text, i) => ({ id: String.fromCharCode(97 + i), text }));

/** Câu trả lời đúng / sai cho từng dạng câu hỏi dùng trong bài kiểm thử */
function answerFor(question: any, right: boolean): unknown {
  switch (question.qtype) {
    case 'single': return { choice: right ? 'b' : 'a' };
    case 'multiple': return { choices: right ? ['a', 'c'] : ['a'] };
    case 'truefalse': return { value: right };
    case 'fill': return { blanks: [right ? '1288' : '1300'] };
    case 'order': return { order: right ? ['a', 'b', 'c'] : ['c', 'b', 'a'] };
    default: throw new Error(`Dạng ${question.qtype} chưa hỗ trợ trong bài kiểm thử`);
  }
}

/** Làm hết một lượt: mỗi câu đúng hay sai theo `plan` (mặc định tất cả đúng) */
async function playAttempt(token: string, start: any, plan: (index: number) => boolean = () => true) {
  let state = start;
  let last: any = null;
  const results: any[] = [];
  for (let i = 0; i < state.total; i++) {
    if (state.waiting_next) state = (await api('POST', `/api/play/attempts/${state.id}/next`, undefined, token)).body;
    const question = state.current.question;
    last = (await api('POST', `/api/play/attempts/${state.id}/answer`, { question_id: question.id, answer: answerFor(question, plan(i)) }, token)).body;
    results.push(last.result);
    if (last.finished) break;
    state = { ...state, waiting_next: true, current: undefined };
  }
  return { last, results };
}

(hasPostgres() ? describe : describe.skip)('Sprint 3 – học bài, bản đồ hành trình và làm bài', () => {
  const ids: Record<string, number> = {};
  let campaigns: Array<{ id: number; title: string }>;

  beforeAll(async () => {
    s = await startApp('sprint3_test');
    db = s.moduleRef.get((await import('../src/database/database.service')).DatabaseService);
    const rootToken = (await call(s.base, 'POST', '/api/auth/login', { username: 'admin', password: 'admin@123', portal: 'root_admin' })).body.token;
    f = await bootstrap(s, rootToken);

    // Kho lịch sử: 3 cuộc kháng chiến có sẵn + địa điểm, sự kiện, trận đánh, nhân vật, tư liệu, thuật ngữ
    campaigns = (await root('GET', '/api/admin/history/campaigns')).body.items;
    ids.c1 = campaigns[0].id;
    ids.place = await hist('places', { name: 'Bạch Đằng', old_name: 'Bạch Đằng giang', province: 'Quảng Ninh', lat: 20.95, lng: 106.8 });
    ids.place2 = await hist('places', { name: 'Chưa có tọa độ', province: 'Hà Nội' });
    ids.event = await hist('events', { name: 'Hội nghị Diên Hồng', year_from: 1284, date_text: 'Tháng 12 năm 1284', campaign_id: ids.c1, place_id: ids.place, description: 'Hội nghị bô lão bàn kế đánh giặc.' });
    ids.battle = await hist('battles', { name: 'Trận Bạch Đằng', year: 1288, campaign_id: ids.c1, place_id: ids.place, event_id: ids.event, context: 'Quân Nguyên rút lui.', course: 'Cắm cọc trên sông.', result: 'Đại thắng.' });
    ids.figure = await hist('figures', { name: 'Trần Hưng Đạo', figure_group: 'general', role_text: 'Quốc công Tiết chế', links: { campaign: [ids.c1], battle: [ids.battle] } });
    ids.draftFigure = await hist('figures', { name: 'Nhân vật nháp', figure_group: 'other' });
    ids.s1 = await hist('sources', { title: 'Hịch tướng sĩ', kind: 'hich', original_text: 'Ta thường tới bữa quên ăn...', translation: 'Ta thường đến bữa quên ăn', links: { figure: [ids.figure], campaign: [ids.c1] } });
    ids.s2 = await hist('sources', { title: 'Bình Ngô đại cáo trích', kind: 'tho_van', original_text: 'Nội dung nguyên văn', links: { battle: [ids.battle] } });
    ids.s3 = await hist('sources', { title: 'Tư liệu tự do', kind: 'su_lieu', original_text: 'Không thuộc nút nào', links: { campaign: [ids.c1] } });
    ids.term = await hist('terms', { term: 'Tiết chế', definition: 'Chức chỉ huy tối cao quân đội.' });
    for (const c of campaigns) await publish(s.base, rootToken, 'campaigns', c.id);
    for (const [entity, key] of [['places', 'place'], ['places', 'place2'], ['events', 'event'], ['battles', 'battle'], ['figures', 'figure'], ['sources', 's1'], ['sources', 's2'], ['sources', 's3'], ['terms', 'term']] as const) {
      await publish(s.base, rootToken, entity, ids[key]);
    }
  });
  afterAll(async () => { await s?.close(); });

  // ------------------------------------------------------------------ HK.HS.025–027, 031–036
  test('HK.HS.031–036 xem hồ sơ nhân vật, sự kiện, trận đánh, địa điểm, thuật ngữ và tìm kiếm — chỉ nội dung đã công bố', async () => {
    const figure = await api('GET', `/api/learn/figures/${ids.figure}`);
    expect(figure.body).toMatchObject({ name: 'Trần Hưng Đạo', figure_group: 'general' });
    expect(figure.body.battles.map((b: any) => b.name)).toEqual(['Trận Bạch Đằng']);
    expect(figure.body.campaigns).toHaveLength(1);
    expect(figure.body.sources[0]).toMatchObject({ title: 'Hịch tướng sĩ' });
    expect(figure.body).not.toHaveProperty('search_text');
    expect((await api('GET', `/api/learn/figures/${ids.draftFigure}`)).status).toBe(404);
    expect((await api('GET', '/api/learn/figures')).body.map((x: any) => x.name)).toEqual(['Trần Hưng Đạo']);
    expect((await api('GET', '/api/learn/figures?group=king')).body).toEqual([]);

    const event = await api('GET', `/api/learn/events/${ids.event}`);
    expect(event.body).toMatchObject({ name: 'Hội nghị Diên Hồng', place: { name: 'Bạch Đằng', lat: 20.95, lng: 106.8 }, campaign: { id: ids.c1 } });
    expect(event.body.battles.map((b: any) => b.name)).toEqual(['Trận Bạch Đằng']);

    const battle = await api('GET', `/api/learn/battles/${ids.battle}`);
    expect(battle.body).toMatchObject({ name: 'Trận Bạch Đằng', year: 1288, result: 'Đại thắng.', event: { name: 'Hội nghị Diên Hồng' } });
    expect(battle.body.figures.map((x: any) => x.name)).toEqual(['Trần Hưng Đạo']);

    const place = await api('GET', `/api/learn/places/${ids.place}`);
    expect(place.body).toMatchObject({ name: 'Bạch Đằng', old_name: 'Bạch Đằng giang', lat: 20.95, lng: 106.8 });
    expect(place.body.events).toHaveLength(1);
    expect(place.body.battles).toHaveLength(1);
    expect((await api('GET', '/api/learn/terms')).body).toEqual([{ id: ids.term, term: 'Tiết chế', definition: 'Chức chỉ huy tối cao quân đội.' }]);
    expect((await api('GET', '/api/learn/terms?q=tiet')).body).toHaveLength(1);

    const found = await api('GET', '/api/learn/search?q=bach%20dang');
    expect(found.body.map((r: any) => `${r.type}:${r.title}`).sort()).toEqual(['battle:Trận Bạch Đằng', 'place:Bạch Đằng']);
    expect((await api('GET', '/api/learn/search?q=nhan%20vat%20nhap')).body).toEqual([]); // bản nháp không lộ
    expect((await api('GET', '/api/learn/search?q=a')).status).toBe(400);
    expect((await api('GET', '/api/learn/figures', undefined, f.A.token)).status).toBe(403);
    expect((await call(s.base, 'GET', '/api/learn/figures')).status).toBe(401);
  });

  test('HK.HS.025–027 dòng thời gian có lọc và bản đồ tương tác', async () => {
    const timeline = await api('GET', '/api/learn/timeline');
    expect(timeline.body.map((x: any) => `${x.type}:${x.year}`)).toEqual(['event:1284', 'battle:1288']);
    expect(timeline.body[0]).toMatchObject({ name: 'Hội nghị Diên Hồng', place_name: 'Bạch Đằng', campaign_id: ids.c1 });
    expect((await api('GET', `/api/learn/timeline?campaign_id=${campaigns[1].id}`)).body).toEqual([]);
    expect((await api('GET', `/api/learn/timeline?campaign_id=${ids.c1}`)).body).toHaveLength(2);
    expect((await api('GET', `/api/learn/timeline?figure_id=${ids.figure}`)).body.map((x: any) => x.type)).toEqual(['battle']);
    expect((await api('GET', `/api/learn/timeline?place_id=${ids.place}&year_from=1285`)).body.map((x: any) => x.type)).toEqual(['battle']);
    expect((await api('GET', '/api/learn/timeline?year_from=900')).status).toBe(422);

    const map = await api('GET', '/api/learn/map');
    expect(map.body).toHaveLength(1); // địa điểm không có tọa độ không hiện trên bản đồ
    expect(map.body[0]).toMatchObject({ name: 'Bạch Đằng', lat: 20.95, lng: 106.8 });
    expect(map.body[0].items.map((i: any) => i.type).sort()).toEqual(['battle', 'event']);
    expect((await api('GET', `/api/learn/map?campaign_id=${campaigns[2].id}`)).body).toEqual([]);
    expect((await api('GET', '/api/learn/places')).body.map((p: any) => p.name)).toEqual(['Bạch Đằng', 'Chưa có tọa độ']);
  });

  // ------------------------------------------------------------------ HK.AD.044
  let lessonId: number;
  const questions: Record<string, number> = {};
  test('HK.AD.044 quản trị tổng soạn bài học (khối văn bản, hình, bản đồ), gắn dữ liệu lịch sử, câu kiểm tra nhanh; công bố rồi mới có người dùng', async () => {
    const qs: Record<string, any> = {
      single: { qtype: 'single', prompt: 'Ai chỉ huy toàn quân kháng chiến lần II và III?', data: { options: opts('Trần Quang Khải', 'Trần Hưng Đạo', 'Trần Nhật Duật'), correct: 'b' }, explanation: 'Trần Hưng Đạo được giao Tiết chế.' },
      truefalse: { qtype: 'truefalse', prompt: 'Hội nghị Diên Hồng họp để bàn việc đánh hay hòa.', data: { correct: true }, explanation: 'Các bô lão đều hô "Đánh!".' },
      fill: { qtype: 'fill', prompt: 'Trận Bạch Đằng diễn ra năm ____.', data: { blanks: [{ accept: ['1288'] }] }, explanation: 'Năm 1288.' },
      order: { qtype: 'order', prompt: 'Sắp xếp theo thời gian.', data: { items: opts('Diên Hồng', 'Hàm Tử', 'Bạch Đằng') } },
      multiple: { qtype: 'multiple', prompt: 'Chọn các chiến thắng.', data: { options: opts('Hàm Tử', 'Điện Biên Phủ', 'Chương Dương'), correct: ['a', 'c'] } },
    };
    for (const [key, body] of Object.entries(qs)) {
      const res = await root('POST', '/api/content/questions', { ...body, campaign_id: ids.c1, links: key === 'single' ? [{ ref_type: 'figure', ref_id: ids.figure }] : [] });
      expect([key, res.status]).toEqual([key, 201]);
      questions[key] = res.body.id;
    }

    const created = await root('POST', '/api/content/lessons', {
      title: 'Hội nghị Diên Hồng và quyết tâm đánh giặc', summary: 'Vì sao nhà Trần hỏi ý kiến các bô lão?', campaign_id: ids.c1,
      blocks: [
        { type: 'text', heading: 'Bối cảnh', text: 'Cuối năm 1284, quân Nguyên chuẩn bị tiến đánh Đại Việt lần thứ hai.' },
        { type: 'image', url: 'https://example.org/dien-hong.jpg', caption: 'Tranh minh họa' },
        { type: 'map', lat: 21.03, lng: 105.85, label: 'Thăng Long' },
      ],
      links: [{ ref_type: 'event', ref_id: ids.event }, { ref_type: 'term', ref_id: ids.term }, { ref_type: 'campaign', ref_id: ids.c1 }],
      check_question_ids: [questions.truefalse],
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ status: 'draft', campaign_id: ids.c1 });
    expect(created.body.links).toHaveLength(3);
    expect(created.body.checks.map((c: any) => c.question_id)).toEqual([questions.truefalse]);
    expect(created.body.read_minutes).toBeGreaterThanOrEqual(1);
    lessonId = created.body.id;

    for (const bad of [
      { title: 'A' }, { title: 'Bài lỗi', blocks: [{ type: 'image', url: 'http://x.vn/a.png' }] }, { title: 'Bài lỗi', blocks: [{ type: 'map', lat: 48, lng: 2, label: 'Paris' }] },
      { title: 'Bài lỗi', blocks: [{ type: 'script', text: 'x' }] }, { title: 'Bài lỗi', check_question_ids: [999999] }, { title: 'Bài lỗi', links: [{ ref_type: 'figure', ref_id: 999999 }] },
    ]) expect([JSON.stringify(bad), [400, 404, 422]]).toEqual([JSON.stringify(bad), expect.arrayContaining([(await root('POST', '/api/content/lessons', bad)).status])]);
    // Câu kiểm tra nhanh phải của kho hệ thống: câu riêng của giáo viên bị từ chối
    const teacherQ = await api('POST', '/api/content/questions', { qtype: 'truefalse', prompt: 'Câu riêng của giáo viên.', data: { correct: true } }, f.T1.token);
    expect((await root('PUT', `/api/content/lessons/${lessonId}`, { check_question_ids: [teacherQ.body.id] })).status).toBe(400);

    expect((await api('GET', '/api/content/lessons', undefined, f.T1.token)).body).toEqual([]); // giáo viên chỉ thấy bài đã công bố
    expect((await api('GET', `/api/content/lessons/${lessonId}`, undefined, f.T1.token)).status).toBe(404);
    expect((await api('POST', '/api/content/lessons', { title: 'Giáo viên tạo' }, f.T1.token)).status).toBe(403);
    expect((await root('PATCH', `/api/content/lessons/${lessonId}/status`, { status: 'published' })).body.status).toBe('published');
    expect((await api('GET', '/api/content/lessons', undefined, f.T1.token)).body.map((l: any) => l.id)).toEqual([lessonId]);
    const empty = (await root('POST', '/api/content/lessons', { title: 'Bài rỗng' })).body.id;
    expect((await root('PATCH', `/api/content/lessons/${empty}/status`, { status: 'published' })).status).toBe(422); // chưa có nội dung
    expect((await root('DELETE', `/api/content/lessons/${empty}`)).status).toBe(204);
  });

  // ------------------------------------------------------------------ HK.AD.043
  let journeyId: number;
  const nodes: Record<string, number> = {};
  test('HK.AD.043 quản trị tổng dựng hành trình mẫu: thêm nút, thứ tự, trận Quyết chiến luôn ở cuối, mở khóa tư liệu, điều kiện phát hành', async () => {
    const quizBattle = (await root('POST', '/api/content/quizzes', { title: 'Đề trận Bạch Đằng', seconds_per_question: 20, pass_percent: 60, items: [{ question_id: questions.single }, { question_id: questions.truefalse }] })).body.id;
    const quizFinal = (await root('POST', '/api/content/quizzes', {
      title: 'Quyết chiến lần II', seconds_per_question: 30, items: [questions.single, questions.truefalse, questions.fill, questions.order, questions.multiple].map((question_id) => ({ question_id })),
    })).body.id;
    ids.quizBattle = quizBattle;
    ids.quizFinal = quizFinal;

    const created = await root('POST', '/api/content/journeys', { title: 'Hành trình Lần I', description: 'Từ Diên Hồng đến Bạch Đằng', campaign_id: ids.c1 });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ scope: 'system', status: 'draft', is_default: false, nodes: [] });
    journeyId = created.body.id;

    const add = async (body: Record<string, unknown>) => (await root('POST', `/api/content/journeys/${journeyId}/nodes`, body));
    const final = await add({ kind: 'final', quiz_id: quizFinal, title: 'Quyết chiến Bạch Đằng', reward_points: 300 });
    expect(final.status).toBe(201);
    expect(final.body.nodes[0]).toMatchObject({ kind: 'final', pass_percent: 70, position: 1 });
    nodes.final = final.body.nodes[0].id;
    expect((await add({ kind: 'final', quiz_id: quizFinal })).status).toBe(409); // chỉ một trận Quyết chiến
    const lesson = await add({ kind: 'lesson', lesson_id: lessonId, reward_points: 50 });
    expect(lesson.body.nodes.map((n: any) => [n.kind, n.position])).toEqual([['lesson', 1], ['final', 2]]); // nút thường chèn trước Quyết chiến
    nodes.lesson = lesson.body.nodes[0].id;
    expect(lesson.body.nodes[0]).toMatchObject({ title: 'Hội nghị Diên Hồng và quyết tâm đánh giặc', icon: 'book', lesson_title: expect.any(String) });
    const battle = await add({ kind: 'battle', battle_id: ids.battle, quiz_id: quizBattle, unlock_source_ids: [ids.s2], reward_points: 80, title: 'Trận Bạch Đằng' });
    nodes.battle = battle.body.nodes[1].id;
    const source = await add({ kind: 'source', source_id: ids.s1, icon: 'scroll' });
    nodes.source = source.body.nodes.find((n: any) => n.kind === 'source').id;
    expect(source.body.nodes.map((n: any) => n.kind)).toEqual(['lesson', 'battle', 'source', 'final']);
    expect(source.body.nodes.map((n: any) => n.position)).toEqual([1, 2, 3, 4]);
    expect(source.body.nodes[1].unlocks).toEqual([{ id: ids.s2, title: 'Bình Ngô đại cáo trích' }]);

    for (const [name, body] of [
      ['thiếu nội dung', { kind: 'lesson' }], ['bài học không có', { kind: 'lesson', lesson_id: 999999 }], ['loại lạ', { kind: 'boss' }], ['biểu tượng lạ', { kind: 'source', source_id: ids.s3, icon: 'rocket' }],
      ['điểm thưởng', { kind: 'source', source_id: ids.s3, reward_points: 5000 }], ['bộ đề riêng giáo viên', { kind: 'quiz', quiz_id: 999999 }], ['tư liệu mở khóa lạ', { kind: 'source', source_id: ids.s3, unlock_source_ids: [999999] }],
    ] as Array<[string, any]>) expect([name, [400, 404, 422]]).toEqual([name, expect.arrayContaining([(await add(body)).status])]);

    // Chưa phát hành được khi nội dung còn nháp
    await db.query("UPDATE hist_battles SET status = 'draft' WHERE id = $1", [ids.battle]);
    const refused = await root('PATCH', `/api/content/journeys/${journeyId}/status`, { status: 'published' });
    expect(refused.status).toBe(422);
    expect(refused.body.detail).toContain('trận đánh chưa công bố');
    expect((await root('GET', `/api/content/journeys/${journeyId}`)).body.problems.length).toBeGreaterThan(0);
    await db.query("UPDATE hist_battles SET status = 'published' WHERE id = $1", [ids.battle]);
    expect((await root('PATCH', `/api/content/journeys/${journeyId}/status`, { status: 'published' })).body.status).toBe('published');

    // Sắp xếp lại: Quyết chiến phải ở cuối
    const order = [nodes.source, nodes.lesson, nodes.battle, nodes.final];
    expect((await root('PUT', `/api/content/journeys/${journeyId}/order`, { node_ids: [nodes.final, ...order.slice(0, 3)] })).status).toBe(400);
    expect((await root('PUT', `/api/content/journeys/${journeyId}/order`, { node_ids: order.slice(0, 3) })).status).toBe(400);
    const reordered = await root('PUT', `/api/content/journeys/${journeyId}/order`, { node_ids: order });
    expect(reordered.body.nodes.map((n: any) => n.kind)).toEqual(['source', 'lesson', 'battle', 'final']);
    await root('PUT', `/api/content/journeys/${journeyId}/order`, { node_ids: [nodes.lesson, nodes.battle, nodes.source, nodes.final] });

    // Đặt mặc định cho cuộc kháng chiến (cần đủ điều kiện, có Quyết chiến cuối)
    const def = await root('PATCH', `/api/content/journeys/${journeyId}/default`, { value: true });
    expect(def.body).toMatchObject({ is_default: true, status: 'published' });
    expect((await root('PATCH', `/api/content/journeys/${journeyId}/status`, { status: 'draft' })).status).toBe(409);
    expect((await root('DELETE', `/api/content/journeys/${journeyId}`)).status).toBe(409);
    expect((await api('PATCH', `/api/content/journeys/${journeyId}/default`, { value: false }, f.T1.token)).status).toBe(403);
  });

  // ------------------------------------------------------------------ HK.HS.017–022
  test('HK.HS.017/018 trang chủ: 3 cuộc kháng chiến, tiến độ, điểm, chuỗi ngày; chỉ học sinh dùng', async () => {
    const home = await api('GET', '/api/play/home');
    expect(home.body.learner.full_name).toBe('Phạm Minh Một');
    expect(home.body).toMatchObject({ points: 0, streak: 0 });
    expect(home.body.campaigns).toHaveLength(3);
    const first = home.body.campaigns[0];
    expect(first).toMatchObject({ id: ids.c1, nodes: 4, done: 0, percent: 0, completed: false, journey: { title: 'Hành trình Lần I', from_class: false } });
    expect(first.year_label).toBeTruthy();
    expect(first.places).toEqual(['Bạch Đằng']);
    expect(home.body.campaigns[1]).toMatchObject({ journey: null, nodes: 0, percent: 0 });
    expect(home.body.suggestions[0]).toMatchObject({ type: 'node', node_id: nodes.lesson, kind: 'lesson' });
    expect((await api('GET', '/api/play/home', undefined, f.T1.token)).status).toBe(403);
    expect((await api('GET', `/api/play/campaigns/${campaigns[1].id}/map`)).body).toMatchObject({ journey: null, nodes: [] });
    expect((await api('GET', '/api/play/campaigns/99999/map')).status).toBe(404);
  });

  test('HK.HS.019–021 bản đồ chiến dịch: nút mở theo thứ tự, nút khóa không bắt đầu được', async () => {
    const map = await api('GET', `/api/play/campaigns/${ids.c1}/map`);
    expect(map.body.journey).toMatchObject({ title: 'Hành trình Lần I', from_class: false });
    expect(map.body.nodes.map((n: any) => [n.kind, n.state])).toEqual([['lesson', 'available'], ['battle', 'locked'], ['source', 'locked'], ['final', 'locked']]);
    expect(map.body.current_node_id).toBe(nodes.lesson);
    expect(map.body.totals).toMatchObject({ nodes: 4, done: 0, max_stars: 12 });
    expect(map.body.nodes[0].content.lesson).toMatchObject({ id: lessonId });
    expect(map.body.nodes[1].content.quiz).toMatchObject({ questions: 2, total_seconds: 40 });
    expect(JSON.stringify(map.body)).not.toMatch(/"correct"/);

    const detail = await api('GET', `/api/play/nodes/${nodes.battle}`);
    expect(detail.body).toMatchObject({ state: 'locked', can_start: false, content: null, needs_quiz: true });
    expect(detail.body.hint).toContain('Hội nghị Diên Hồng');
    expect(detail.body.unlocks.map((u: any) => u.title)).toEqual(['Bình Ngô đại cáo trích']);
    expect((await api('POST', `/api/play/nodes/${nodes.battle}/attempts`)).status).toBe(409);
    expect((await api('POST', `/api/play/nodes/${nodes.source}/complete`)).status).toBe(409);
    expect((await api('GET', `/api/play/nodes/${nodes.battle}/lesson`)).status).toBe(409);
    const open = await api('GET', `/api/play/nodes/${nodes.lesson}`);
    expect(open.body).toMatchObject({ state: 'available', can_start: true, reward_points: 50, kind_label: 'Bài học' });
    expect(open.body.content.lesson).toMatchObject({ read_minutes: expect.any(Number) });
  });

  // ------------------------------------------------------------------ HK.HS.029–030, 037
  test('HK.HS.029/030/037 đọc bài học, đọc hết rồi trả lời đúng câu kiểm tra nhanh mới hoàn thành; ghi chú riêng', async () => {
    const lesson = await api('GET', `/api/play/nodes/${nodes.lesson}/lesson`);
    expect(lesson.body.blocks.map((b: any) => b.type)).toEqual(['text', 'image', 'map']);
    expect(lesson.body.progress).toMatchObject({ read_percent: 0, completed_at: null });
    expect(lesson.body.links.map((l: any) => l.ref_type).sort()).toEqual(['campaign', 'event', 'term']);
    expect(lesson.body.checks).toHaveLength(1);
    expect(JSON.stringify(lesson.body.checks)).not.toMatch(/correct|bô lão đều/);
    const check = lesson.body.checks[0];

    expect((await api('POST', `/api/play/nodes/${nodes.lesson}/lesson/complete`, { answers: [{ question_id: check.id, answer: { value: true } }] })).status).toBe(409); // chưa đọc hết
    expect((await api('POST', `/api/play/nodes/${nodes.lesson}/lesson/progress`, { read_percent: 60 })).body.read_percent).toBe(60);
    expect((await api('POST', `/api/play/nodes/${nodes.lesson}/lesson/progress`, { read_percent: 30 })).body.read_percent).toBe(60); // chỉ tăng
    expect((await api('POST', `/api/play/nodes/${nodes.lesson}/lesson/progress`, { read_percent: 150 })).status).toBe(422);
    expect((await api('POST', `/api/play/nodes/${nodes.lesson}/lesson/complete`, { answers: [{ question_id: check.id, answer: { value: true } }] })).status).toBe(409); // mới đọc 60%
    await api('POST', `/api/play/nodes/${nodes.lesson}/lesson/progress`, { read_percent: 100 });

    const wrong = await api('POST', `/api/play/nodes/${nodes.lesson}/lesson/complete`, { answers: [{ question_id: check.id, answer: { value: false } }] });
    expect(wrong.body).toMatchObject({ completed: false, node: null });
    expect(wrong.body.results[0]).toMatchObject({ correct: false, explanation: 'Các bô lão đều hô "Đánh!".' });
    expect(wrong.body.results[0]).not.toHaveProperty('answer_key');
    expect((await api('GET', `/api/play/campaigns/${ids.c1}/map`)).body.nodes[0].state).toBe('available');
    expect((await api('POST', `/api/play/nodes/${nodes.lesson}/lesson/complete`, { answers: [] })).body.completed).toBe(false); // bỏ trống coi là sai

    // Ghi chú riêng gắn với bài học
    expect((await api('PUT', `/api/play/notes/lesson/${lessonId}`, { body: '  Nhớ: ba lần hỏi ý kiến bô lão  ' })).body).toMatchObject({ body: 'Nhớ: ba lần hỏi ý kiến bô lão' });
    expect((await api('PUT', `/api/play/notes/lesson/${lessonId}`, { body: '   ' })).status).toBe(400);
    expect((await api('PUT', `/api/play/notes/lesson/99999`, { body: 'x' })).status).toBe(404);
    expect((await api('GET', `/api/play/nodes/${nodes.lesson}/lesson`)).body.note).toBe('Nhớ: ba lần hỏi ý kiến bô lão');
    expect((await api('GET', `/api/play/nodes/${nodes.lesson}/lesson`, undefined, f.S2.token)).body.note).toBeNull(); // ghi chú của người khác
    expect((await api('GET', '/api/play/notes')).body).toEqual([expect.objectContaining({ ref_type: 'lesson', ref_id: lessonId, title: 'Hội nghị Diên Hồng và quyết tâm đánh giặc' })]);

    const done = await api('POST', `/api/play/nodes/${nodes.lesson}/lesson/complete`, { answers: [{ question_id: check.id, answer: { value: true } }] });
    expect(done.body.completed).toBe(true);
    expect(done.body.node).toMatchObject({ first_completion: true, passed: true, stars: 2, points_awarded: 50 }); // sai lần đầu nên 2 sao
    expect(done.body.node.next_node).toMatchObject({ id: nodes.battle });
    const again = await api('POST', `/api/play/nodes/${nodes.lesson}/lesson/complete`, { answers: [{ question_id: check.id, answer: { value: true } }] });
    expect(again.body.node).toMatchObject({ first_completion: false, points_awarded: 0 }); // không thưởng lần nữa
    const map = await api('GET', `/api/play/campaigns/${ids.c1}/map`);
    expect(map.body.nodes.map((n: any) => n.state)).toEqual(['done', 'available', 'locked', 'locked']);
    expect(map.body.nodes[0]).toMatchObject({ stars: 2 });
    expect((await api('DELETE', `/api/play/notes/lesson/${lessonId}`)).status).toBe(204);
  });

  // ------------------------------------------------------------------ HK.HS.038–042
  test('HK.HS.038–042 tư liệu gốc: danh sách khóa/mở, lọc, chi tiết, yêu thích; mở khóa khi hoàn thành nút', async () => {
    const list = await api('GET', '/api/learn/sources');
    expect(list.body.map((r: any) => [r.title, r.locked])).toEqual([['Bình Ngô đại cáo trích', true], ['Hịch tướng sĩ', true], ['Tư liệu tự do', false]]);
    expect(list.body[0].unlock_node).toBe('Trận Bạch Đằng');
    expect((await api('GET', '/api/learn/sources?unlocked=true')).body.map((r: any) => r.title)).toEqual(['Tư liệu tự do']);
    expect((await api('GET', '/api/learn/sources?unlocked=false')).body).toHaveLength(2);
    expect((await api('GET', '/api/learn/sources?kind=hich')).body.map((r: any) => r.title)).toEqual(['Hịch tướng sĩ']);
    expect((await api('GET', `/api/learn/sources?figure_id=${ids.figure}`)).body.map((r: any) => r.title)).toEqual(['Hịch tướng sĩ']);
    expect((await api('GET', `/api/learn/sources?campaign_id=${ids.c1}&q=hich`)).body).toHaveLength(1);

    const locked = await api('GET', `/api/learn/sources/${ids.s2}`);
    expect(locked.body).toMatchObject({ locked: true, title: 'Bình Ngô đại cáo trích' });
    expect(locked.body.hint).toContain('Trận Bạch Đằng');
    expect(JSON.stringify(locked.body)).not.toContain('Nội dung nguyên văn'); // không lộ nội dung khi còn khóa
    expect((await api('GET', `/api/learn/search?q=binh%20ngo`)).body[0]).toMatchObject({ type: 'source', locked: true, snippet: null });
    const free = await api('GET', `/api/learn/sources/${ids.s3}`);
    expect(free.body).toMatchObject({ locked: false, original_text: 'Không thuộc nút nào', favorite: false });
    expect(free.body.campaigns).toHaveLength(1);
    expect((await api('PUT', `/api/play/favorites/${ids.s2}`)).status).toBe(409); // chưa mở khóa thì chưa yêu thích được
    expect((await api('PUT', `/api/play/favorites/${ids.s3}`)).body).toEqual({ source_id: ids.s3, favorite: true });
    expect((await api('GET', '/api/play/favorites')).body.map((r: any) => r.title)).toEqual(['Tư liệu tự do']);
    expect((await api('GET', `/api/learn/sources/${ids.s3}`)).body.favorite).toBe(true);
    expect((await api('GET', `/api/learn/sources?favorites=true`, undefined, f.S2.token)).body).toEqual([]);
    expect((await api('PUT', '/api/play/notes/source/' + ids.s3, { body: 'Đọc kỹ đoạn đầu' })).status).toBe(200);
    expect((await api('PUT', '/api/play/notes/source/' + ids.s1, { body: 'Chưa mở' })).status).toBe(409);
    expect((await api('DELETE', `/api/play/favorites/${ids.s3}`)).body.favorite).toBe(false);
    // Giáo viên thấy mọi tư liệu, không bị khóa
    expect((await api('GET', '/api/learn/sources', undefined, f.T1.token)).body.every((r: any) => r.locked === false)).toBe(true);
  });

  // ------------------------------------------------------------------ HK.HS.043–046, 022, SYS.007
  let battleAttempt: number;
  test('HK.HS.043–046/022 làm bài ở nút trận đánh: từng câu có đồng hồ, kết quả kèm giải thích và mục liên quan, sao, thưởng điểm, mở khóa tư liệu', async () => {
    const start = await api('POST', `/api/play/nodes/${nodes.battle}/attempts`);
    expect(start.status).toBe(200);
    expect(start.body).toMatchObject({ mode: 'node', status: 'active', total: 2, position: 0, node_id: nodes.battle, pass_percent: 60 });
    expect(start.body.current).toMatchObject({ index: 0, seconds: 20, points: 100 });
    expect(start.body.current.remaining_ms).toBeGreaterThan(15_000);
    expect(JSON.stringify(start.body)).not.toMatch(/"correct"|explanation|Các bô lão/);
    battleAttempt = start.body.id;
    // Mở lại lượt đang dở thay vì tạo lượt mới
    expect((await api('POST', `/api/play/nodes/${nodes.battle}/attempts`)).body.id).toBe(battleAttempt);
    expect((await api('GET', `/api/play/attempts/${battleAttempt}`)).body.current.question.id).toBe(start.body.current.question.id);

    const q = start.body.current.question;
    expect((await api('POST', `/api/play/attempts/${battleAttempt}/answer`, { question_id: 999999, answer: { choice: 'a' } })).status).toBe(409); // sai câu hiện tại
    const a1 = await api('POST', `/api/play/attempts/${battleAttempt}/answer`, { question_id: q.id, answer: answerFor(q, true) });
    expect(a1.body.result).toMatchObject({ correct: true, timed_out: false, base_points: 100 });
    expect(a1.body.result.bonus_points).toBeGreaterThan(40); // trả lời ngay nên gần mức thưởng tối đa 50
    expect(a1.body.result.explanation).toBeTruthy();
    expect(a1.body.result.answer_key).toBeTruthy();
    expect(a1.body).toMatchObject({ finished: false, attempt: { position: 1, total: 2 } });
    if (q.id === questions.single) expect(a1.body.result.links.map((l: any) => l.label)).toEqual(['Trần Hưng Đạo']); // mục lịch sử đã công bố gắn với câu hỏi
    expect((await api('POST', `/api/play/attempts/${battleAttempt}/answer`, { question_id: q.id, answer: answerFor(q, true) })).status).toBe(409); // không trả lời hai lần
    const waiting = await api('GET', `/api/play/attempts/${battleAttempt}`);
    expect(waiting.body).toMatchObject({ waiting_next: true, position: 1 });
    expect(waiting.body.current).toBeUndefined();
    const next = await api('POST', `/api/play/attempts/${battleAttempt}/next`);
    expect(next.body.current.index).toBe(1);
    expect((await api('POST', `/api/play/attempts/${battleAttempt}/next`)).body.current.index).toBe(1); // gọi lại không đổi câu
    const q2 = next.body.current.question;
    const a2 = await api('POST', `/api/play/attempts/${battleAttempt}/answer`, { question_id: q2.id, answer: answerFor(q2, true) });
    expect(a2.body.finished).toBe(true);
    expect(a2.body.summary).toMatchObject({ percent: 100, stars: 3, passed: true, correct: 2, wrong: 0, total: 2 });
    expect(a2.body.summary.node).toMatchObject({ title: 'Trận Bạch Đằng' });
    expect(a2.body.summary.bonus_points).toBeGreaterThan(80);

    const finalState = await api('GET', `/api/play/attempts/${battleAttempt}`);
    expect(finalState.body.status).toBe('done');
    expect((await api('POST', `/api/play/attempts/${battleAttempt}/answer`, { question_id: q.id, answer: {} })).status).toBe(409);
    const map = await api('GET', `/api/play/campaigns/${ids.c1}/map`);
    expect(map.body.nodes.map((n: any) => n.state)).toEqual(['done', 'done', 'available', 'locked']);
    expect(map.body.nodes[1]).toMatchObject({ stars: 3, best_percent: 100, attempts: 1 });

    // Hoàn thành nút → tư liệu mở khóa (HK.HS.041, SYS.007)
    expect((await api('GET', `/api/learn/sources/${ids.s2}`)).body).toMatchObject({ locked: false, original_text: 'Nội dung nguyên văn' });
    const sources = await api('GET', '/api/learn/sources');
    expect(sources.body.map((r: any) => [r.title, r.locked])).toEqual([['Bình Ngô đại cáo trích', false], ['Hịch tướng sĩ', true], ['Tư liệu tự do', false]]);
    const points = (await api('GET', '/api/play/home')).body.points;
    expect(points).toBeGreaterThan(50 + 80 + 100); // thưởng bài học + thưởng nút + điểm làm bài

    // Chơi lại không "cày" điểm: điểm chỉ tăng khi vượt kỷ lục cũ
    const replay = await api('POST', `/api/play/nodes/${nodes.battle}/attempts`);
    const second = await playAttempt(f.S1.token, replay.body);
    expect(second.last.summary.node_result).toMatchObject({ first_completion: false });
    expect(second.last.summary.node_result.points_awarded).toBeLessThanOrEqual(30); // chỉ phần vượt kỷ lục (thưởng tốc độ dao động nhẹ)
    expect((await api('GET', `/api/play/campaigns/${ids.c1}/map`)).body.nodes[1].attempts).toBe(2);
  });

  test('HK.HS.045 hết giờ: trả lời muộn bị tính sai (hết thời gian) và không được thưởng; đồng hồ do máy chủ giữ', async () => {
    const start = await api('POST', `/api/play/nodes/${nodes.source}/complete`);
    expect(start.body).toMatchObject({ first_completion: true, stars: 3, points_awarded: 50 });
    expect(start.body.unlocked_sources.map((x: any) => x.title)).toEqual(['Hịch tướng sĩ']);

    const run = await api('POST', `/api/play/nodes/${nodes.final}/attempts`);
    expect(run.body).toMatchObject({ total: 5, pass_percent: 70 });
    const q = run.body.current.question;
    await db.query("UPDATE hk_attempts SET served_at = now() - interval '90 seconds' WHERE id = $1", [run.body.id]);
    const late = await api('POST', `/api/play/attempts/${run.body.id}/answer`, { question_id: q.id, answer: answerFor(q, true) });
    expect(late.body.result).toMatchObject({ correct: false, timed_out: true, base_points: 0, bonus_points: 0 });
    expect(late.body.result.answer_key).toBeTruthy();
    const state = await api('GET', `/api/play/attempts/${run.body.id}`);
    expect(state.body).toMatchObject({ waiting_next: true, position: 1 });
    // Bỏ dở rồi quay lại sau giờ: câu đang làm tự tính hết giờ
    const resumed = await api('POST', `/api/play/attempts/${run.body.id}/next`);
    await db.query("UPDATE hk_attempts SET served_at = now() - interval '120 seconds' WHERE id = $1", [run.body.id]);
    const idle = await api('GET', `/api/play/attempts/${run.body.id}`);
    expect(idle.body).toMatchObject({ waiting_next: true, position: 2 });
    expect(resumed.body.current.index).toBe(1);
    const rows = await db.query<{ timed_out: boolean; correct: boolean }>('SELECT timed_out, correct FROM hk_attempt_answers WHERE attempt_id = $1 ORDER BY position', [run.body.id]);
    expect(rows).toEqual([{ timed_out: true, correct: false }, { timed_out: true, correct: false }]);
    expect((await api('GET', `/api/play/attempts/${run.body.id}`, undefined, f.S2.token)).status).toBe(404); // lượt của bạn khác
    expect((await api('POST', `/api/play/attempts/${run.body.id}/answer`, { question_id: q.id, answer: {} }, f.S3.token)).status).toBe(404);
    await db.query('DELETE FROM hk_attempts WHERE id = $1', [run.body.id]);
    await db.query("DELETE FROM hk_wrong_questions WHERE user_id = $1", [f.S1.id]);
  });

  test('HK.HS.046/050 trận Quyết chiến: dưới 70% chưa hoàn thành chiến dịch; xem lại từng câu; đạt thì hoàn thành', async () => {
    const fail = await api('POST', `/api/play/nodes/${nodes.final}/attempts`);
    const failed = await playAttempt(f.S1.token, fail.body, (i) => i < 3); // 3/5 = 60%
    expect(failed.last.summary).toMatchObject({ percent: 60, passed: false, stars: 0, correct: 3, wrong: 2, pass_percent: 70 });
    expect(failed.last.summary.node_result).toMatchObject({ passed: false, journey_completed: false, campaign_final: false });
    expect((await api('GET', `/api/play/campaigns/${ids.c1}/map`)).body.nodes[3]).toMatchObject({ state: 'available', best_percent: 60, stars: 0 });
    const review = await api('GET', `/api/play/attempts/${fail.body.id}/review`);
    expect(review.body.items).toHaveLength(5);
    expect(review.body.items.filter((i: any) => !i.correct)).toHaveLength(2);
    expect(review.body.items[4]).toMatchObject({ answer_key: expect.anything(), links: expect.any(Array) });
    expect(review.body.summary.percent).toBe(60);
    expect((await api('GET', `/api/play/attempts/${fail.body.id}/review`, undefined, f.S2.token)).status).toBe(404);

    const win = await api('POST', `/api/play/nodes/${nodes.final}/attempts`);
    const won = await playAttempt(f.S1.token, win.body);
    expect(won.last.summary).toMatchObject({ percent: 100, passed: true, stars: 3 });
    expect(won.last.summary.node_result).toMatchObject({ first_completion: true, journey_completed: true, campaign_final: true, next_node: null });
    expect(won.last.summary.node_result.points_awarded).toBeGreaterThan(300);
    const home = await api('GET', '/api/play/home');
    expect(home.body.campaigns[0]).toMatchObject({ completed: true, percent: 100, done: 4 });
    expect(home.body.campaigns[0].stars).toBeGreaterThanOrEqual(10);
    expect(home.body.streak).toBe(1);
    expect(home.body.suggestions.map((x: any) => x.type)).toContain('practice');
  });

  // ------------------------------------------------------------------ HK.HS.048–049, 023
  test('HK.HS.048 luyện lại các câu đã sai: làm đúng thì gỡ khỏi danh sách và cộng điểm luyện tập', async () => {
    const info = await api('GET', '/api/play/practice');
    expect(info.body.length).toBeGreaterThanOrEqual(2);
    expect(info.body[0]).toMatchObject({ wrong_count: expect.any(Number), prompt: expect.any(String) });
    const before = (await api('GET', '/api/play/home')).body.points;
    const start = await api('POST', '/api/play/practice/start');
    expect(start.body).toMatchObject({ mode: 'practice', total: info.body.length });
    expect((await api('POST', '/api/play/practice/start')).body.id).toBe(start.body.id);
    const practiced = await playAttempt(f.S1.token, start.body);
    expect(practiced.last.summary).toMatchObject({ percent: 100, stars: 0 });
    expect((await api('GET', '/api/play/practice')).body).toEqual([]);
    expect((await api('GET', '/api/play/home')).body.points).toBe(before + 10 * info.body.length);
    expect((await api('POST', '/api/play/practice/start')).status).toBe(409); // hết câu cần luyện
    expect((await api('GET', '/api/play/home')).body.suggestions.map((x: any) => x.type)).not.toContain('practice');
  });

  test('HK.HS.049/023 lịch sử làm bài và danh sách nhiệm vụ', async () => {
    const history = await api('GET', '/api/play/history');
    expect(history.body.total).toBe(5); // trận đánh x2, Quyết chiến x2 (còn lại sau khi xóa lượt thử), luyện tập x1
    expect(history.body.items[0]).toMatchObject({ mode: 'practice', percent: 100 });
    const node = history.body.items.find((i: any) => i.node_title === 'Quyết chiến Bạch Đằng' && i.percent === 60);
    expect(node).toMatchObject({ passed: false, correct_count: 3, wrong_count: 2, node_kind: 'final', campaign_title: campaigns[0].title });
    expect((await api('GET', '/api/play/history?limit=2&page=2')).body).toMatchObject({ total: 5, page: 2, limit: 2 });
    expect((await api('GET', '/api/play/history', undefined, f.S2.token)).body).toMatchObject({ total: 0, items: [] });

    const quests = await api('GET', '/api/play/quests');
    expect(quests.body.done).toHaveLength(4);
    expect(quests.body.doing).toEqual([]);
    expect(quests.body.done[0]).toMatchObject({ kind_label: 'Bài học', condition: expect.stringContaining('câu kiểm tra nhanh'), reward_points: 50 });
    const fresh = await api('GET', '/api/play/quests', undefined, f.S2.token);
    expect(fresh.body.doing).toHaveLength(1);
    expect(fresh.body.locked).toHaveLength(3);
    expect(fresh.body.locked[2]).toMatchObject({ kind: 'final', condition: 'Đạt từ 70% điểm ở bộ câu hỏi' });
  });

  // ------------------------------------------------------------------ HK.SYS.014
  test('HK.SYS.014 ghi nhận sự kiện học tập; sự kiện xem do trình duyệt báo chỉ nhận loại đã định', async () => {
    const counts = await db.query<{ event: string; n: string }>('SELECT event, count(*) AS n FROM hk_events WHERE user_id = $1 GROUP BY event', [f.S1.id]);
    const by = Object.fromEntries(counts.map((c) => [c.event, Number(c.n)]));
    expect(by.answer).toBeGreaterThanOrEqual(12);
    expect(by.node_complete).toBe(4);
    expect(by.attempt_start).toBeGreaterThanOrEqual(3);
    expect(by.attempt_finish).toBeGreaterThanOrEqual(3);
    expect(by.lesson_complete).toBeGreaterThanOrEqual(1);
    expect(by.view_lesson).toBeGreaterThanOrEqual(1);
    expect(by.view_source).toBeGreaterThanOrEqual(1);
    expect(by.view_figure).toBe(1);
    const sample = (await db.query<{ value: any; school_id: number }>("SELECT value, school_id FROM hk_events WHERE user_id = $1 AND event = 'answer' LIMIT 1", [f.S1.id]))[0];
    expect(sample.school_id).toBe(f.A.schoolId);
    expect(sample.value).toMatchObject({ correct: expect.any(Boolean), ms: expect.any(Number) });
    expect((await api('POST', '/api/play/events', { event: 'view_map', duration_ms: 4200 })).body).toEqual({ ok: true });
    expect((await api('POST', '/api/play/events', { event: 'delete_everything' })).status).toBe(400);
    expect((await api('POST', '/api/play/events', { event: 'view_map' }, f.T1.token)).status).toBe(403);
    expect((await db.query("SELECT 1 FROM hk_events WHERE user_id = $1 AND event = 'view_map' AND duration_ms = 4200", [f.S1.id])).length).toBe(1);
  });

  // ------------------------------------------------------------------ HK.GV.018–021
  let teacherJourney: number;
  test('HK.GV.018–021 giáo viên xem thư viện mẫu, tạo hành trình từ mẫu hoặc trống, thêm – sửa – xóa nút; không sửa mẫu của hệ thống', async () => {
    const library = await api('GET', '/api/content/journeys', undefined, f.T1.token);
    expect(library.body.map((j: any) => [j.title, j.scope, j.can_edit])).toEqual([['Hành trình Lần I', 'system', false]]);
    expect(library.body[0]).toMatchObject({ node_count: 4, campaign_title: campaigns[0].title });
    const detail = await api('GET', `/api/content/journeys/${journeyId}`, undefined, f.T1.token);
    expect(detail.body.nodes).toHaveLength(4); // xem trước nội dung từng nút
    expect(detail.body.nodes[0]).toMatchObject({ kind: 'lesson', lesson_title: expect.any(String) });
    expect((await api('PUT', `/api/content/journeys/${journeyId}`, { title: 'Sửa mẫu' }, f.T1.token)).status).toBe(403);
    expect((await api('POST', `/api/content/journeys/${journeyId}/nodes`, { kind: 'source', source_id: ids.s3 }, f.T1.token)).status).toBe(403);
    expect((await api('DELETE', `/api/content/nodes/${nodes.lesson}`, undefined, f.T1.token)).status).toBe(403);
    expect((await api('GET', `/api/content/journeys/${journeyId}`, undefined, f.TB.token)).status).toBe(200); // mẫu hệ thống đã phát hành mọi trường đều xem

    const blank = await api('POST', '/api/content/journeys', { title: 'Hành trình trống', campaign_id: ids.c1, description: 'Tự soạn' }, f.T1.token);
    expect(blank.body).toMatchObject({ scope: 'teacher', owner_id: f.T1.id, nodes: [], can_edit: true });
    expect((await api('POST', '/api/content/journeys', { title: 'X', campaign_id: ids.c1 }, f.T1.token)).status).toBe(400);
    expect((await api('POST', '/api/content/journeys', { title: 'Lỗi chiến dịch', campaign_id: 99999 }, f.T1.token)).status).toBe(400);
    expect((await api('POST', '/api/content/journeys', { title: 'Khác chiến dịch', campaign_id: campaigns[1].id, template_id: journeyId }, f.T1.token)).status).toBe(400);
    const fromTemplate = await api('POST', '/api/content/journeys', { title: 'Lần I của lớp 7A1', campaign_id: ids.c1, template_id: journeyId }, f.T1.token);
    expect(fromTemplate.body.nodes.map((n: any) => n.kind)).toEqual(['lesson', 'battle', 'source', 'final']);
    expect(fromTemplate.body).toMatchObject({ scope: 'teacher', copied_from: journeyId });
    expect(fromTemplate.body.nodes[1].unlocks).toHaveLength(1);
    teacherJourney = fromTemplate.body.id;
    const tNodes = fromTemplate.body.nodes;

    // Thêm – sửa – xóa nút
    const added = await api('POST', `/api/content/journeys/${teacherJourney}/nodes`, { kind: 'quiz', quiz_id: ids.quizBattle, title: 'Ôn tập nhanh', icon: 'star', objective: 'Nhớ các sự kiện chính', reward_points: 20 }, f.T1.token);
    expect(added.body.nodes.map((n: any) => n.kind)).toEqual(['lesson', 'battle', 'source', 'quiz', 'final']);
    const quizNode = added.body.nodes[3];
    expect(quizNode).toMatchObject({ title: 'Ôn tập nhanh', icon: 'star', objective: 'Nhớ các sự kiện chính', reward_points: 20, quiz_title: 'Đề trận Bạch Đằng' });
    // Bộ đề riêng của giáo viên dùng được trong hành trình của mình, không dùng được trong hành trình của người khác
    const ownQuestion = (await api('POST', '/api/content/questions', { qtype: 'truefalse', prompt: 'Câu riêng của thầy Sử.', data: { correct: true } }, f.T1.token)).body.id;
    const ownQuiz = (await api('POST', '/api/content/quizzes', { title: 'Đề riêng thầy Sử', items: [{ question_id: ownQuestion }] }, f.T1.token)).body.id;
    expect((await api('PUT', `/api/content/nodes/${quizNode.id}`, { quiz_id: ownQuiz, title: 'Ôn tập bằng đề riêng' }, f.T1.token)).body.nodes[3]).toMatchObject({ title: 'Ôn tập bằng đề riêng', quiz_id: ownQuiz });
    const t2Journey = (await api('POST', '/api/content/journeys', { title: 'Của cô Địa', campaign_id: ids.c1 }, f.T2.token)).body.id;
    expect((await api('POST', `/api/content/journeys/${t2Journey}/nodes`, { kind: 'quiz', quiz_id: ownQuiz }, f.T2.token)).status).toBe(400);
    expect((await api('PUT', `/api/content/journeys/${teacherJourney}`, { title: 'Hack' }, f.T2.token)).status).toBe(404); // hành trình riêng của người khác
    expect((await api('GET', `/api/content/journeys/${teacherJourney}`, undefined, f.T2.token)).status).toBe(404);
    const removed = await api('DELETE', `/api/content/nodes/${quizNode.id}`, undefined, f.T1.token);
    expect(removed.body.nodes.map((n: any) => [n.kind, n.position])).toEqual([['lesson', 1], ['battle', 2], ['source', 3], ['final', 4]]);
    expect((await api('PUT', `/api/content/journeys/${teacherJourney}`, { title: 'Lần I của lớp 7A1 (sửa)', campaign_id: campaigns[1].id }, f.T1.token)).status).toBe(409); // đã có nút thì không đổi chiến dịch
    expect((await api('PUT', `/api/content/journeys/${teacherJourney}`, { title: 'Lần I của lớp 7A1 (sửa)' }, f.T1.token)).body.title).toBe('Lần I của lớp 7A1 (sửa)');

    // Nhân bản và xóa
    const copy = await api('POST', `/api/content/journeys/${teacherJourney}/duplicate`, undefined, f.T1.token);
    expect(copy.body.title).toContain('(bản sao)');
    expect(copy.body.nodes).toHaveLength(4);
    expect((await api('DELETE', `/api/content/journeys/${copy.body.id}`, undefined, f.T1.token)).status).toBe(204);
    expect((await api('DELETE', `/api/content/journeys/${blank.body.id}`, undefined, f.T1.token)).status).toBe(204);
    void tNodes;
  });

  test('HK.GV.019 giao hành trình cho lớp mình phụ trách; học sinh trong lớp học theo hành trình của giáo viên, tiến độ tách riêng', async () => {
    const classes = await api('GET', '/api/content/my-classes', undefined, f.T1.token);
    expect(classes.body.map((c: any) => [c.name, c.students])).toEqual([['7A1', 2]]);
    expect((await api('GET', '/api/content/my-classes', undefined, f.A.token)).status).toBe(403);
    expect((await api('POST', `/api/content/journeys/${teacherJourney}/classes`, { class_ids: [f.class7b.id] }, f.T1.token)).status).toBe(403); // lớp của thầy khác
    expect((await api('POST', `/api/content/journeys/${teacherJourney}/classes`, { class_ids: [] }, f.T1.token)).status).toBe(400);
    expect((await api('POST', `/api/content/journeys/${teacherJourney}/classes`, { class_ids: [f.class7a.id] }, f.T2.token)).status).toBe(404);

    // Nội dung chưa đủ điều kiện (bài học chuyển lại nháp) thì chưa giao được
    await db.query("UPDATE hk_lessons SET status = 'draft' WHERE id = $1", [lessonId]);
    const blocked = await api('POST', `/api/content/journeys/${teacherJourney}/classes`, { class_ids: [f.class7a.id] }, f.T1.token);
    expect(blocked.status).toBe(422);
    await db.query("UPDATE hk_lessons SET status = 'published' WHERE id = $1", [lessonId]);

    const assigned = await api('POST', `/api/content/journeys/${teacherJourney}/classes`, { class_ids: [f.class7a.id] }, f.T1.token);
    expect(assigned.status).toBe(200);
    expect(assigned.body).toMatchObject({ status: 'published' });
    expect(assigned.body.classes.map((c: any) => c.name)).toEqual(['7A1']);
    expect((await api('POST', `/api/content/journeys/${teacherJourney}/classes`, { class_ids: [f.class7a.id] }, f.T1.token)).status).toBe(200); // giao lại không lỗi
    expect((await api('GET', '/api/content/my-classes', undefined, f.T1.token)).body[0].journeys.map((j: any) => j.title)).toEqual(['Lần I của lớp 7A1 (sửa)']);

    const mapS2 = await api('GET', `/api/play/campaigns/${ids.c1}/map`, undefined, f.S2.token);
    expect(mapS2.body.journey).toMatchObject({ title: 'Lần I của lớp 7A1 (sửa)', from_class: true });
    expect(mapS2.body.nodes.map((n: any) => n.state)).toEqual(['available', 'locked', 'locked', 'locked']);
    expect(mapS2.body.nodes[0].id).not.toBe(nodes.lesson);
    const mapS3 = await api('GET', `/api/play/campaigns/${ids.c1}/map`, undefined, f.S3.token);
    expect(mapS3.body.journey).toMatchObject({ title: 'Hành trình Lần I', from_class: false }); // học sinh chưa vào lớp học theo mẫu mặc định
    expect(mapS3.body.nodes[0].id).toBe(nodes.lesson);
    // Nút của hành trình không thuộc học sinh thì không truy cập được
    const teacherNode = mapS2.body.nodes[0].id;
    expect((await api('GET', `/api/play/nodes/${teacherNode}`, undefined, f.S3.token)).status).toBe(404);
    expect((await api('GET', `/api/play/nodes/${teacherNode}`, undefined, f.S2.token)).status).toBe(200);
    // Hành trình đã giao: bộ đề bị khóa, nút đã có học sinh hoàn thành không xóa được
    expect((await api('PUT', `/api/content/quizzes/${ids.quizBattle}`, { title: 'Đổi tên' }, f.root)).status).toBe(409);

    // S2 hoàn thành nút đầu, rồi nút bị bảo vệ
    const lesson = (await api('GET', `/api/play/nodes/${teacherNode}/lesson`, undefined, f.S2.token)).body;
    await api('POST', `/api/play/nodes/${teacherNode}/lesson/progress`, { read_percent: 100 }, f.S2.token);
    expect((await api('POST', `/api/play/nodes/${teacherNode}/lesson/complete`, { answers: [{ question_id: lesson.checks[0].id, answer: { value: true } }] }, f.S2.token)).body.completed).toBe(true);
    expect((await api('DELETE', `/api/content/nodes/${teacherNode}`, undefined, f.T1.token)).status).toBe(409);
    expect((await api('PUT', `/api/content/nodes/${teacherNode}`, { title: 'Chỉ đổi tên' }, f.T1.token)).status).toBe(200); // đổi tên được, nội dung giữ nguyên
    expect((await api('DELETE', `/api/content/journeys/${teacherJourney}`, undefined, f.T1.token)).status).toBe(409);
    expect((await api('DELETE', `/api/content/journeys/${teacherJourney}/classes/${f.class7a.id}`, undefined, f.T1.token)).body.classes).toEqual([]);
    expect((await api('GET', `/api/play/campaigns/${ids.c1}/map`, undefined, f.S2.token)).body.journey.title).toBe('Hành trình Lần I');
  });

  test('phân quyền: học sinh không dùng API giáo viên; giáo viên không dùng API học sinh; không có token bị từ chối', async () => {
    for (const [method, path] of [['GET', '/api/play/home'], ['GET', '/api/play/quests'], ['GET', '/api/play/practice'], ['POST', '/api/play/practice/start'], ['GET', '/api/play/notes']]) {
      expect([path, (await api(method, path, undefined, f.T1.token)).status]).toEqual([path, 403]);
      expect([path, (await api(method, path, undefined, f.A.token)).status]).toEqual([path, 403]);
      expect([path, (await call(s.base, method, path)).status]).toEqual([path, 401]);
    }
    expect((await api('GET', '/api/content/journeys', undefined, f.S1.token)).status).toBe(403);
    expect((await api('POST', `/api/play/quizzes/${ids.quizBattle}/preview`, undefined, f.S1.token)).status).toBe(403);
  });
});
