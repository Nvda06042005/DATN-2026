/**
 * Ver0.2 Sprint 8, thi đấu trực tiếp nâng cao (HK.GV.090, 095–101; HK.HS.139–142; HK.SYS.023): khóa phòng (tay và tự động), duyệt học sinh vào muộn, vào lại khi mất kết nối,
 * loại người chơi, tên theo hồ sơ, một tài khoản một thiết bị, chống tra cứu (ẩn nội dung trên thiết bị, xáo đáp án, cảnh báo chuyển tab), loại điểm và chế độ Đánh trùm cả lớp.
 * HTTP và WebSocket thật trên PostgreSQL tạm.
 */
import { io, Socket } from 'socket.io-client';
import { call, hasPostgres, Started, startApp } from './harness';
import { bootstrap, Fixture } from './fixture';
import type { DatabaseService } from '../src/database/database.service';
import type { LiveService } from '../src/live/live.service';

let s: Started, f: Fixture, db: DatabaseService, live: LiveService;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const api = (method: string, path: string, body?: unknown, token = f.T1.token) => call(s.base, method, path, body, token);
const as = (who: { token: string }) => (method: string, path: string, body?: unknown) => call(s.base, method, path, body, who.token);
const sockets: Socket[] = [];

async function connect(token: string): Promise<Socket> {
  const sock = io(s.base, { path: '/api/live/ws', auth: { token }, transports: ['websocket'], forceNew: true, reconnection: false });
  await new Promise<void>((resolve, reject) => { sock.on('connect', () => resolve()); sock.on('connect_error', (e) => { sock.close(); reject(e); }); });
  sockets.push(sock);
  return sock;
}
const emit = (c: Socket, event: string, body: unknown) => new Promise<any>((resolve) => c.emit(event, body, resolve));

const RIGHT = [{ choice: 'a' }, { choices: ['a', 'c'] }, { value: true }];
const WRONG = [{ choice: 'b' }, { choices: ['b'] }, { value: false }];

(hasPostgres() ? describe : describe.skip)('Ver0.2 Sprint 8 – thi đấu trực tiếp nâng cao', () => {
  let classId: number, quizId: number;
  const make = async (extra: Record<string, unknown> = {}) => {
    const res = await api('POST', '/api/live/rooms', { class_id: classId, quiz_id: quizId, ...extra });
    expect(res.status).toBe(201);
    return res.body as any;
  };
  const cmd = (id: number, action: string) => api('POST', `/api/live/rooms/${id}/command`, { action });
  const host = async (id: number) => (await api('GET', `/api/live/rooms/${id}`)).body;
  const state = async (who: { token: string }, id: number) => (await as(who)('GET', `/api/live/rooms/${id}/state`)).body;
  const join = (who: { token: string }, pin: string, extra: Record<string, unknown> = {}) => as(who)('POST', '/api/live/join', { pin, ...extra });
  const answer = (who: { token: string }, id: number, index: number, right: boolean) => as(who)('POST', `/api/live/rooms/${id}/answer`, { q_index: index, answer: (right ? RIGHT : WRONG)[index] });
  const end = async (id: number) => cmd(id, 'end');

  beforeAll(async () => {
    s = await startApp('live_v2_test');
    db = s.moduleRef.get((await import('../src/database/database.service')).DatabaseService);
    live = s.moduleRef.get((await import('../src/live/live.service')).LiveService);
    const rootToken = (await call(s.base, 'POST', '/api/auth/login', { username: 'admin', password: 'admin@123', portal: 'root_admin' })).body.token;
    f = await bootstrap(s, rootToken);
    classId = f.class7a.id;
    // Quiz ba câu soạn bằng trình soạn: một đáp án (tiêu chuẩn), nhiều đáp án (gấp đôi), đúng / sai (không tính điểm)
    const d = (await api('POST', '/api/content/studio', {})).body;
    const q = (over: Record<string, unknown>) => ({ qtype: 'single', prompt: 'Câu hỏi thử nghiệm', options: ['Đáp án A', 'Đáp án B', 'Đáp án C', ''], correct: [0], tf: true, seconds: 20, score_mode: 'standard', ...over });
    await api('PUT', `/api/content/studio/${d.id}`, {
      title: 'Quiz thi đấu nâng cao', theme: { bg: 'thang-long', music: 'hao-khi' }, questions: [
        q({ prompt: 'Câu 1 – một đáp án' }), q({ prompt: 'Câu 2 – nhiều đáp án', qtype: 'multiple', options: ['Một', 'Hai', 'Ba', 'Bốn'], correct: [0, 2], score_mode: 'double' }),
        q({ prompt: 'Câu 3 – đúng hay sai', qtype: 'truefalse', score_mode: 'none' }),
      ],
    });
    const committed = await api('POST', `/api/content/studio/${d.id}/commit`);
    expect(committed.status).toBe(200);
    quizId = committed.body.quiz.id;
  });
  afterAll(async () => {
    for (const c of sockets) c.close();
    await s?.close();
  });
  afterEach(async () => {
    (live as unknown as { attempts: Map<number, number[]> }).attempts.clear(); // giới hạn nhập mã PIN (20 lần / phút) không cản các bài kiểm thử chạy liên tiếp
    for (const r of (await api('GET', '/api/live/rooms')).body.filter((x: any) => x.state !== 'ended')) await end(r.id);
  });

  test('HK.GV.096 mặc định tự khóa phòng khi bắt đầu; người mới thấy "Phòng đã khóa" và xin vào, giáo viên từ chối thì không xin lại', async () => {
    const r = await make();
    expect(r.room).toMatchObject({ auto_lock_seconds: 0, locked: false, profile_names: true, hide_on_device: true, shuffle_device: true, tab_alert: true, theme: { bg: 'thang-long', music: 'hao-khi' } });
    expect((await join(f.S1, r.room.pin)).status).toBe(200);
    expect((await cmd(r.room.id, 'start')).body.room.locked).toBe(true);
    const look = (await as(f.S2)('GET', `/api/live/lookup/${r.room.pin}`)).body;
    expect(look).toMatchObject({ locked: true, request: null });
    const refused = await join(f.S2, r.room.pin);
    expect(refused.status).toBe(409);
    expect(refused.body.detail).toMatch(/Phòng đã khóa/);
    expect((await as(f.S2)('POST', '/api/live/request', { pin: r.room.pin })).body).toMatchObject({ status: 'pending' });
    expect((await as(f.S2)('POST', '/api/live/request', { pin: r.room.pin })).body).toMatchObject({ status: 'pending' }); // xin lại chỉ giữ một yêu cầu
    expect((await as(f.S3)('POST', '/api/live/request', { pin: r.room.pin })).status).toBe(404); // ngoài lớp
    expect((await as(f.S1)('POST', '/api/live/request', { pin: r.room.pin })).status).toBe(409); // đã ở trong phòng
    const h = await host(r.room.id);
    expect(h.requests).toHaveLength(1);
    expect(h.requests[0]).toMatchObject({ full_name: expect.any(String) });
    expect((await api('POST', `/api/live/rooms/${r.room.id}/requests/${h.requests[0].id}`, { approve: false }, f.T2.token)).status).toBe(404);
    expect((await api('POST', `/api/live/rooms/${r.room.id}/requests/${h.requests[0].id}`, { approve: false })).body.requests).toHaveLength(0);
    expect((await api('POST', `/api/live/rooms/${r.room.id}/requests/${h.requests[0].id}`, { approve: false })).status).toBe(409); // đã xử lý
    expect((await join(f.S2, r.room.pin)).status).toBe(409);
    expect((await as(f.S2)('POST', '/api/live/request', { pin: r.room.pin })).body.status).toBe('rejected');
    expect((await as(f.S2)('GET', `/api/live/lookup/${r.room.pin}`)).body.request).toEqual({ status: 'rejected' });
    expect((await db.query<any>("SELECT count(*)::int AS n FROM hk_live_events WHERE room_id = $1 AND kind IN ('lock', 'request', 'reject')", [r.room.id]))[0].n).toBe(3);
  });

  test('HK.GV.095 khóa / mở khóa bằng tay, không tự khóa, và tự khóa sau N giây', async () => {
    const r = await make({ auto_lock_seconds: null });
    expect((await join(f.S1, r.room.pin)).status).toBe(200);
    expect((await cmd(r.room.id, 'start')).body.room.locked).toBe(false); // không tự khóa
    expect((await cmd(r.room.id, 'lock')).body.room.locked).toBe(true);
    expect((await join(f.S2, r.room.pin)).status).toBe(409);
    expect((await cmd(r.room.id, 'unlock')).body.room.locked).toBe(false);
    const j = await join(f.S2, r.room.pin);
    expect(j.status).toBe(200);
    expect(j.body.state.me.joined_q).toBe(0); // vào khi câu 1 đang diễn ra → làm từ câu hiện tại
    expect((await cmd(r.room.id, 'lock')).status).toBe(200);
    expect((await api('POST', `/api/live/rooms/${r.room.id}/command`, { action: 'lock' }, f.T2.token)).status).toBe(404);
    await end(r.room.id);
    expect((await cmd(r.room.id, 'lock')).status).toBe(409); // trận đã kết thúc

    const timed = await make({ auto_lock_seconds: 1 });
    expect((await join(f.S1, timed.room.pin)).status).toBe(200);
    expect((await cmd(timed.room.id, 'start')).body.room.locked).toBe(false);
    await sleep(1300);
    expect((await host(timed.room.id)).room.locked).toBe(true);
    expect((await join(f.S2, timed.room.pin)).status).toBe(409);
    expect((await api('POST', '/api/live/rooms', { class_id: classId, quiz_id: quizId, auto_lock_seconds: 9999 })).status).toBe(400);
  });

  test('HK.GV.097 + HK.HS.141 duyệt học sinh xin vào muộn: làm từ câu hiện tại, không xem lại câu đã qua', async () => {
    const r = await make();
    await join(f.S1, r.room.pin);
    await cmd(r.room.id, 'start');
    await answer(f.S1, r.room.id, 0, true);
    await cmd(r.room.id, 'next'); // kết quả câu 1
    await as(f.S2)('POST', '/api/live/request', { pin: r.room.pin });
    const req = (await host(r.room.id)).requests[0];
    expect((await api('POST', `/api/live/rooms/${r.room.id}/requests/${req.id}`, { approve: true })).status).toBe(200);
    expect((await as(f.S2)('GET', `/api/live/lookup/${r.room.pin}`)).body.request).toEqual({ status: 'approved' });
    const j = await join(f.S2, r.room.pin);
    expect(j.status).toBe(200);
    expect(j.body.state.me.joined_q).toBe(1); // đang xem kết quả câu 1 → vào từ câu 2
    await cmd(r.room.id, 'next'); // câu 2
    expect((await answer(f.S2, r.room.id, 1, true)).status).toBe(200);
    expect((await answer(f.S2, r.room.id, 0, true)).status).toBe(409); // câu 1 đã qua
    await end(r.room.id);
    const review = (await as(f.S2)('GET', `/api/live/my/${r.room.id}`)).body;
    expect(review.items.map((i: any) => i.index)).toEqual([1]);
    const report = (await api('GET', `/api/live/rooms/${r.room.id}/report`)).body;
    expect(report.players.find((p: any) => p.joined_q === 1)).toBeTruthy();
    expect(report.questions[0].none).toBe(0); // câu 1: chỉ tính người đã có mặt
  });

  test('HK.HS.140 vào lại khi mất kết nối dù phòng đã khóa; HK.GV.098 một tài khoản chỉ một thiết bị', async () => {
    const r = await make();
    const first = await join(f.S1, r.room.pin, { device_id: 'may-A' });
    expect(first.status).toBe(200);
    await cmd(r.room.id, 'start');
    await answer(f.S1, r.room.id, 0, true);
    const score = (await state(f.S1, r.room.id)).me.score;
    expect(score).toBeGreaterThan(0);
    const again = await join(f.S1, r.room.pin, { device_id: 'may-A' }); // phòng đã khóa nhưng đã có trong phòng
    expect(again.status).toBe(200);
    expect(again.body.state.me).toMatchObject({ score, answered: true, joined_q: 0 }); // giữ điểm, tiếp tục từ câu hiện tại
    await live.setOnline(r.room.id, f.S1.id, true);
    const other = await join(f.S1, r.room.pin, { device_id: 'may-B' });
    expect(other.status).toBe(409);
    expect(other.body.detail).toMatch(/thiết bị khác/);
    expect((await join(f.S1, r.room.pin, { device_id: 'may-A' })).status).toBe(200);
    await live.setOnline(r.room.id, f.S1.id, false);
    expect((await join(f.S1, r.room.pin, { device_id: 'may-B' })).status).toBe(200); // thiết bị cũ đã ngắt → chuyển sang thiết bị mới
    expect((await db.query<any>('SELECT device_id FROM hk_live_players WHERE room_id = $1', [r.room.id]))[0].device_id).toBe('may-B');
  });

  test('HK.GV.099 loại người chơi: không vào lại, không còn trong bảng điểm, điểm bị loại bỏ; có trong báo cáo', async () => {
    const r = await make();
    await join(f.S1, r.room.pin);
    await join(f.S2, r.room.pin);
    await cmd(r.room.id, 'start');
    await answer(f.S1, r.room.id, 0, true);
    await answer(f.S2, r.room.id, 0, true);
    const players = (await host(r.room.id)).players;
    const s1 = players.find((p: any) => p.nickname);
    expect((await api('POST', `/api/live/rooms/${r.room.id}/kick`, { player_id: s1.id }, f.T2.token)).status).toBe(404);
    expect((await api('POST', `/api/live/rooms/${r.room.id}/kick`, { player_id: 999999 })).status).toBe(404);
    const kicked = await api('POST', `/api/live/rooms/${r.room.id}/kick`, { player_id: s1.id });
    expect(kicked.status).toBe(200);
    expect(kicked.body.player_count).toBe(1);
    expect(kicked.body.answered.count).toBe(1); // đáp án của người bị loại không còn tính
    expect((await api('POST', `/api/live/rooms/${r.room.id}/kick`, { player_id: s1.id })).status).toBe(409);
    const who = (await db.query<any>('SELECT user_id FROM hk_live_players WHERE id = $1', [s1.id]))[0].user_id === f.S1.id ? f.S1 : f.S2;
    expect((await as(who)('GET', `/api/live/rooms/${r.room.id}/state`)).status).toBe(404);
    expect((await join(who, r.room.pin)).status).toBe(403);
    expect((await as(who)('GET', `/api/live/lookup/${r.room.pin}`)).status).toBe(403);
    expect((await as(who)('POST', '/api/live/request', { pin: r.room.pin })).status).toBe(403);
    expect((await answer(who, r.room.id, 0, true)).status).toBe(403);
    expect((await as(who)('GET', '/api/live/open')).body.map((x: any) => x.id)).not.toContain(r.room.id);
    await end(r.room.id);
    const report = (await api('GET', `/api/live/rooms/${r.room.id}/report`)).body;
    expect(report.players).toHaveLength(1);
    expect(report.removed).toHaveLength(1);
  });

  test('HK.GV.098 tên hiển thị lấy theo hồ sơ; phòng tắt tùy chọn này thì tự chọn biệt danh', async () => {
    const r = await make();
    const name = (await db.query<any>('SELECT full_name FROM app_users WHERE id = $1', [f.S1.id]))[0].full_name as string;
    const j = await join(f.S1, r.room.pin, { nickname: 'Tên bừa bãi' });
    expect(j.status).toBe(200);
    expect(j.body.state.me.nickname).not.toBe('Tên bừa bãi');
    expect(name.endsWith(j.body.state.me.nickname) || name === j.body.state.me.nickname).toBe(true);
    expect(j.body.state.me.nickname.length).toBeLessThanOrEqual(20);
    expect((await as(f.S1)('POST', `/api/live/rooms/${r.room.id}/profile`, { nickname: 'Đổi tên' })).status).toBe(409);
    expect((await as(f.S1)('POST', `/api/live/rooms/${r.room.id}/profile`, { avatar: 'crown' })).body.me.avatar).toBe('crown');
    expect((await as(f.S1)('GET', `/api/live/lookup/${r.room.pin}`)).body).toMatchObject({ profile_names: true, mine: { nickname: j.body.state.me.nickname } });
    const free = await make({ profile_names: false });
    expect((await join(f.S1, free.room.pin, { nickname: 'Cơn Lốc' })).body.state.me.nickname).toBe('Cơn Lốc');
  });

  test('HK.GV.100 + HK.HS.139 ẩn nội dung câu hỏi trên thiết bị học sinh (chỉ nút hình – màu); bật hiện đầy đủ khi học từ xa; xáo đáp án theo thiết bị', async () => {
    const r = await make();
    await join(f.S1, r.room.pin);
    await join(f.S2, r.room.pin);
    expect((await api('PUT', `/api/live/rooms/${r.room.id}/settings`, { auto_lock_seconds: null })).status).toBe(200); // phòng chờ: đổi được
    await cmd(r.room.id, 'start');
    expect((await api('PUT', `/api/live/rooms/${r.room.id}/settings`, { auto_lock_seconds: 5 })).status).toBe(409); // đã bắt đầu
    expect((await api('PUT', `/api/live/rooms/${r.room.id}/settings`, { hide_on_device: false }, f.T2.token)).status).toBe(404);
    const onProjector = (await host(r.room.id)).question.view;
    expect(onProjector).toMatchObject({ prompt: 'Câu 1 – một đáp án' });
    expect(onProjector.options.map((o: any) => [o.text, o.shape])).toEqual([['Đáp án A', 0], ['Đáp án B', 1], ['Đáp án C', 2]]);
    const hidden = (await state(f.S1, r.room.id)).question;
    expect(hidden.view).toEqual({ id: expect.any(Number), qtype: 'single', hidden: true, options: [{ id: 'a', shape: 0 }, { id: 'b', shape: 1 }, { id: 'c', shape: 2 }] });
    expect(JSON.stringify(hidden)).not.toMatch(/Câu 1|Đáp án A|image_url/);
    // câu nhiều đáp án và đúng / sai cũng ẩn; chọn đúng nút vẫn được chấm điểm
    expect((await answer(f.S1, r.room.id, 0, true)).status).toBe(200);
    await cmd(r.room.id, 'next');
    await cmd(r.room.id, 'next');
    expect((await state(f.S1, r.room.id)).question.view).toMatchObject({ hidden: true, qtype: 'multiple' });
    await cmd(r.room.id, 'next');
    await cmd(r.room.id, 'next');
    expect((await state(f.S1, r.room.id)).question.view).toEqual({ id: expect.any(Number), qtype: 'truefalse', hidden: true, options: [{ id: 'true', shape: 0 }, { id: 'false', shape: 1 }] });
    // giáo viên bật hiện đầy đủ: thiết bị thấy nội dung; vị trí hình – màu của mỗi đáp án giữ nguyên dù thứ tự hiển thị được xáo
    expect((await api('PUT', `/api/live/rooms/${r.room.id}/settings`, { hide_on_device: false })).body.room.hide_on_device).toBe(false);
    const full = (await state(f.S1, r.room.id)).question.view;
    expect(full.hidden).toBeUndefined();
    expect(full.prompt).toBe('Câu 3 – đúng hay sai');
    await end(r.room.id);

    const open = await make({ hide_on_device: false, shuffle_device: true });
    await join(f.S1, open.room.pin);
    await join(f.S2, open.room.pin);
    await cmd(open.room.id, 'start');
    for (const who of [f.S1, f.S2]) {
      const opts = (await state(who, open.room.id)).question.view.options;
      expect(opts).toHaveLength(3);
      for (const o of opts) expect(o.shape).toBe(['Đáp án A', 'Đáp án B', 'Đáp án C'].indexOf(o.text));
    }
    await api('PUT', `/api/live/rooms/${open.room.id}/settings`, { shuffle_device: false });
    expect((await state(f.S1, open.room.id)).question.view.options.map((o: any) => o.shape)).toEqual([0, 1, 2]);
  });

  test('HK.SYS.023 ghi nhận chuyển tab khi đang trả lời và báo cho giáo viên; giáo viên tắt cảnh báo thì bỏ qua', async () => {
    const r = await make();
    await join(f.S1, r.room.pin);
    expect((await as(f.S1)('POST', `/api/live/rooms/${r.room.id}/blur`, { q_index: 0 })).body).toEqual({ recorded: false }); // chưa có câu hỏi
    await cmd(r.room.id, 'start');
    expect((await as(f.S1)('POST', `/api/live/rooms/${r.room.id}/blur`, { q_index: 0 })).body).toEqual({ recorded: true });
    expect((await as(f.S1)('POST', `/api/live/rooms/${r.room.id}/blur`, { q_index: 0 })).body).toEqual({ recorded: false }); // trùng trong 2 giây
    expect((await as(f.S1)('POST', `/api/live/rooms/${r.room.id}/blur`, { q_index: 5 })).body).toEqual({ recorded: false }); // sai câu
    expect((await as(f.S2)('POST', `/api/live/rooms/${r.room.id}/blur`, { q_index: 0 })).status).toBe(403); // chưa vào phòng
    const h = await host(r.room.id);
    expect(h.alerts).toHaveLength(1);
    expect(h.alerts[0]).toMatchObject({ count: 1 });
    expect(h.players[0].tab_switches).toBe(1);
    expect((await state(f.S1, r.room.id)).alerts).toBeUndefined(); // học sinh không thấy cảnh báo
    await api('PUT', `/api/live/rooms/${r.room.id}/settings`, { tab_alert: false });
    await sleep(2100);
    expect((await as(f.S1)('POST', `/api/live/rooms/${r.room.id}/blur`, { q_index: 0 })).body).toEqual({ recorded: false });
    await end(r.room.id);
    expect((await api('GET', `/api/live/rooms/${r.room.id}/report`)).body.players[0].tab_switches).toBe(1);
  });

  test('HK.GV.090 loại điểm của câu: tiêu chuẩn 1000, gấp đôi 2000, không tính điểm; điểm giảm dần theo thời gian', async () => {
    const r = await make();
    expect((await db.query<any>('SELECT plan FROM hk_live_rooms WHERE id = $1', [r.room.id]))[0].plan.map((p: any) => [p.points, p.seconds])).toEqual([[1000, 20], [2000, 20], [0, 20]]);
    await join(f.S1, r.room.pin);
    await cmd(r.room.id, 'start');
    expect((await host(r.room.id)).question.points_max).toBe(1000);
    await answer(f.S1, r.room.id, 0, true);
    const a = (await state(f.S1, r.room.id)).me.score;
    expect(a).toBeGreaterThan(900);
    expect(a).toBeLessThanOrEqual(1000);
    await cmd(r.room.id, 'next');
    await cmd(r.room.id, 'next');
    await answer(f.S1, r.room.id, 1, true);
    const b = (await state(f.S1, r.room.id)).me.score - a;
    expect(b).toBeGreaterThan(1800);
    expect(b).toBeLessThanOrEqual(2000);
    await cmd(r.room.id, 'next');
    await cmd(r.room.id, 'next');
    await answer(f.S1, r.room.id, 2, true);
    expect((await state(f.S1, r.room.id)).me.score).toBe(a + b); // câu không tính điểm
    expect((await state(f.S1, r.room.id)).me.correct_count).toBe(3);
  });

  test('HK.GV.101 + HK.HS.142 Đánh trùm cả lớp: máu trùm theo sĩ số, sát thương theo tốc độ, trùm gục thì cả lớp thắng và được thưởng', async () => {
    expect((await api('POST', '/api/live/rooms', { class_id: classId, quiz_id: quizId, mode: 'boss' })).status).toBe(400);
    expect((await api('POST', '/api/live/rooms', { class_id: classId, quiz_id: quizId, mode: 'boss', boss: 'quai-vat' })).status).toBe(400);
    expect((await api('GET', '/api/live/bosses')).body.map((b: any) => b.key)).toEqual(['ngot-luong-hop-thai', 'thoat-hoan', 'o-ma-nhi', 'toa-do', 'truong-van-ho']);
    const r = await make({ mode: 'boss', boss: 'thoat-hoan' });
    expect(r.boss).toMatchObject({ name: 'Thoát Hoan', max_hp: null, outcome: null });
    expect(r.room.mode).toBe('boss');
    await join(f.S1, r.room.pin);
    await join(f.S2, r.room.pin);
    const started = (await cmd(r.room.id, 'start')).body;
    expect(started.boss).toMatchObject({ max_hp: 144, hp: 144, class_max_hp: 3, class_hp: 3 }); // 2 người × 3 câu × 24
    await answer(f.S1, r.room.id, 0, true);
    await answer(f.S2, r.room.id, 0, true);
    const q1 = (await cmd(r.room.id, 'next')).body;
    expect(q1.results.boss_hit.damage).toBeGreaterThanOrEqual(2 * 20);
    expect(q1.results.boss_hit.damage).toBeLessThanOrEqual(2 * 40);
    expect(q1.results.boss_hit.wrong).toBe(0);
    expect(q1.boss.hp).toBe(144 - q1.results.boss_hit.damage);
    expect(q1.results.last).toBe(false);
    const mine = await state(f.S1, r.room.id);
    expect(mine.me.last.damage).toBeGreaterThanOrEqual(20);
    expect(mine.boss.hp).toBe(q1.boss.hp);
    await cmd(r.room.id, 'next');
    await answer(f.S1, r.room.id, 1, true);
    await answer(f.S2, r.room.id, 1, true);
    const q2 = (await cmd(r.room.id, 'next')).body;
    expect(q2.boss.hp).toBe(0);
    expect(q2.boss.outcome).toBe('win');
    expect(q2.results.last).toBe(true); // trùm đã gục: không cần chơi hết các câu còn lại
    const done = (await cmd(r.room.id, 'next')).body;
    expect(done.room.state).toBe('ended');
    expect(done.final.ended_early).toBe(true);
    expect(done.boss.outcome).toBe('win');
    expect(done.final.ranking.every((p: any) => p.xp_awarded >= 25)).toBe(true); // thưởng chiến thắng
    expect((await as(f.S1)('GET', `/api/live/my/${r.room.id}`)).body.boss).toEqual({ name: 'Thoát Hoan', outcome: 'win' });
    expect((await api('GET', `/api/live/rooms/${r.room.id}/report`)).body.boss).toMatchObject({ name: 'Thoát Hoan', hp: 0, outcome: 'win' });
  });

  test('Đánh trùm: cả lớp trả lời sai hoặc bỏ trống làm hết máu cả lớp thì thua, không được thưởng chiến thắng', async () => {
    const r = await make({ mode: 'boss', boss: 'o-ma-nhi' });
    await join(f.S1, r.room.pin);
    await join(f.S2, r.room.pin);
    await cmd(r.room.id, 'start');
    await answer(f.S1, r.room.id, 0, false);
    await answer(f.S2, r.room.id, 0, false);
    const q1 = (await cmd(r.room.id, 'next')).body;
    expect(q1.results.boss_hit).toMatchObject({ damage: 0, wrong: 2, class_hp: 1 });
    expect(q1.boss.outcome).toBeNull();
    await cmd(r.room.id, 'next');
    await live.setOnline(r.room.id, f.S1.id, true); // người đang trực tuyến mà bỏ trống cũng làm cả lớp mất máu
    await answer(f.S2, r.room.id, 1, false);
    const q2 = (await cmd(r.room.id, 'next')).body;
    expect(q2.results.boss_hit.wrong).toBe(2);
    expect(q2.boss).toMatchObject({ class_hp: 0, outcome: 'lose' });
    const done = (await cmd(r.room.id, 'next')).body;
    expect(done.room.state).toBe('ended');
    expect(done.boss.outcome).toBe('lose');
    expect(done.final.ranking.every((p: any) => p.xp_awarded === 0)).toBe(true);
  });

  test('HK.SYS.023 WebSocket: phòng đã khóa từ chối kết nối mới; người đã trong phòng nối lại được; hai thiết bị bị chặn; người bị loại nhận live:kicked', async () => {
    const r = await make();
    await join(f.S1, r.room.pin);
    await cmd(r.room.id, 'start'); // tự khóa
    const outsider = await connect(f.S2.token);
    const denied = await emit(outsider, 'room:subscribe', { room_id: r.room.id, device_id: 'x' });
    expect(denied).toMatchObject({ ok: false, status: 404 });
    expect(denied.error).toMatch(/Phòng đã khóa/);
    const phone = await connect(f.S1.token);
    expect((await emit(phone, 'room:subscribe', { room_id: r.room.id, device_id: 'dien-thoai' })).ok).toBe(true); // đã trong phòng: nối lại được dù phòng khóa
    const laptop = await connect(f.S1.token);
    const second = await emit(laptop, 'room:subscribe', { room_id: r.room.id, device_id: 'may-tinh' });
    expect(second).toMatchObject({ ok: false, status: 409 });
    expect(second.error).toMatch(/thiết bị khác/);
    expect((await emit(laptop, 'room:subscribe', { room_id: r.room.id, device_id: 'dien-thoai' })).ok).toBe(true); // cùng thiết bị (tab thứ hai) thì được
    // chuyển tab qua WebSocket
    expect((await emit(phone, 'player:blur', { room_id: r.room.id, q_index: 0 })).data).toEqual({ recorded: true });
    // bị loại: nhận sự kiện và bị đưa ra khỏi kênh
    const kicked = new Promise<any>((resolve) => phone.once('live:kicked', resolve));
    const pid = (await host(r.room.id)).players[0].id;
    expect((await api('POST', `/api/live/rooms/${r.room.id}/kick`, { player_id: pid })).status).toBe(200);
    expect(await Promise.race([kicked, sleep(3000).then(() => null)])).toEqual({ room_id: r.room.id });
    const rejoin = await emit(await connect(f.S1.token), 'room:subscribe', { room_id: r.room.id, device_id: 'dien-thoai' });
    expect(rejoin).toMatchObject({ ok: false });
    expect(rejoin.error).toMatch(/bị giáo viên loại/);
  });
});
