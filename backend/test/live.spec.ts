/**
 * Thi đấu cả lớp thời gian thực qua WebSocket /api/live/ws và lịch sử trận của giáo viên.
 * Lớp 7B9/7C9 riêng; backend NestJS thật + PostgreSQL tạm, dịch vụ AI giả.
 */
import { adminLogin, call, hasPostgres, LiveClient, makeUser, Started, startApp } from './harness';
import type { ContentService } from '../src/student/content.service';
import type { LiveHub } from '../src/live/live.hub';

type Msg = Record<string, any>;
let s: Started;
let hub: LiveHub;
let content: ContentService;
let ADMIN: string;
let T: string;
let T2: string;
let A: string;
let B: string;
let C: string;
let X: string;
let b: { id: number };
const clients: LiveClient[] = [];

const roomIn = (phase: string) => (m: Msg) => m.type === 'room' && m.room && m.room.phase === phase;
const stateIn = (phase: string) => (m: Msg) => m.type === 'state' && m.state && m.state.phase === phase;
const error = (code: string) => (m: Msg) => m.type === 'error' && m.code === code;
const rightKey = (q: Msg) => content.questions.get(q.id)!.answer;
const wrongKey = (q: Msg) => q.options.find((o: Msg) => o.key !== rightKey(q)).key;
const progress = async (token: string) => (await call(s.base, 'GET', '/api/student/progress', undefined, token)).body;

/** Mở kết nối, đăng nhập bằng tin nhắn đầu tiên và kiểm tra tin chào (room cho giáo viên, state cho học sinh) */
async function connect(token: string, expectType: string): Promise<[LiveClient, Msg]> {
  const client = new LiveClient(s.ws);
  clients.push(client);
  await client.send({ type: 'auth', token });
  const hello = await client.until(() => true);
  expect(hello.type).toBe(expectType);
  return [client, hello];
}

async function openRoom(host: LiveClient, count = 5, scope = 'all'): Promise<Msg> {
  await host.send({ type: 'create', title: 'Ôn tập Bài 14', count, scope });
  return (await host.until(roomIn('lobby'))).room;
}

async function waitProgress(token: string, check: (p: Msg) => boolean): Promise<Msg> {
  const deadline = Date.now() + 5000;
  for (;;) {
    await hub.settle();
    const p = await progress(token);
    if (check(p)) return p;
    if (Date.now() > deadline) throw new Error(`Tiến độ chưa được ghi: ${JSON.stringify(p)}`);
    await new Promise((r) => setTimeout(r, 50));
  }
}

(hasPostgres() ? describe : describe.skip)('thi đấu cả lớp', () => {
  beforeAll(async () => {
    s = await startApp('live_test');
    const { LiveHub: Hub } = await import('../src/live/live.hub');
    const { ContentService: Content } = await import('../src/student/content.service');
    hub = s.moduleRef.get(Hub);
    content = s.moduleRef.get(Content);
    ADMIN = await adminLogin(s.base);
    [T] = await makeUser(s.base, ADMIN, 'Lê Văn Sử', 'teacher', '7B9', 'giaovien9');
    [T2] = await makeUser(s.base, ADMIN, 'Phạm Thị Chưa Lớp', 'teacher', null, 'giaovien8');
    [A] = await makeUser(s.base, ADMIN, 'Trần Minh An', 'student', '7B9', 'hocsinh9');
    [B, b] = await makeUser(s.base, ADMIN, 'Vũ Thu Bình', 'student', '7B9', 'hocsinh8');
    [C] = await makeUser(s.base, ADMIN, 'Hoàng Gia Cường', 'student', '7B9', 'hocsinh7');
    [X] = await makeUser(s.base, ADMIN, 'Ngô Lớp Khác', 'student', '7C9', 'hocsinh6');
  });

  afterEach(() => {
    hub.questionMs = 20_000;
    for (const c of clients.splice(0)) c.close();
  });

  afterAll(async () => {
    await hub?.settle();
    await s?.close();
  });

  test('01 trận đầy đủ: chấm điểm, lưu lịch sử và tiến độ', async () => {
    const [beforeA, beforeB] = [await progress(A), await progress(B)];
    const [host, hello] = await connect(T, 'room');
    expect(hello.room).toBeNull();
    const room = await openRoom(host);
    const pin = room.pin;
    expect(pin).toMatch(/^\d{6}$/);
    expect(room.total).toBe(5);

    const [a] = await connect(A, 'state');
    const [bb] = await connect(B, 'state');
    await a.send({ type: 'join', pin });
    expect((await a.until(stateIn('lobby'))).state.me.name).toBe('Trần Minh An');
    await bb.send({ type: 'join', pin });
    await bb.until(stateIn('lobby'));
    const lobby = (await host.until((m) => roomIn('lobby')(m) && m.room.players.length === 2)).room;
    expect(new Set(lobby.players.map((p: Msg) => p.name))).toEqual(new Set(['Trần Minh An', 'Vũ Thu Bình']));

    await host.send({ type: 'start' });
    for (let i = 0; i < 5; i += 1) {
      const qa = (await a.until((m) => stateIn('question')(m) && m.state.index === i)).state.question;
      const qb = (await bb.until((m) => stateIn('question')(m) && m.state.index === i)).state.question;
      expect(qa.id).toBe(qb.id);
      // Không gửi đáp án xuống máy học sinh trước khi công bố
      expect(qa).not.toHaveProperty('answer');
      expect(qa.options.every((o: Msg) => Object.keys(o).sort().join() === 'key,text')).toBe(true);
      expect(['mcq', 'tf']).toContain(content.questions.get(qa.id)!.type);

      await a.send({ type: 'answer', question_id: qa.id, choice: rightKey(qa) });
      const mine = (await a.until((m) => stateIn('question')(m) && m.state.me.answered)).state.me;
      expect(mine.choice).toBe(rightKey(qa));
      await a.send({ type: 'answer', question_id: qa.id, choice: rightKey(qa) });
      await a.until(error('bad_phase')); // mỗi câu chỉ trả lời một lần
      await bb.send({ type: 'answer', question_id: qb.id, choice: wrongKey(qb) });

      // Cả lớp đã trả lời: server công bố đáp án ngay
      const revealed = (await host.until(roomIn('reveal'))).room;
      expect(revealed.answered).toBe(2);
      expect(revealed.reveal.counts.reduce((x: number, y: number) => x + y, 0)).toBe(2);
      const ra = (await a.until(stateIn('reveal'))).state;
      const rb = (await bb.until(stateIn('reveal'))).state;
      expect(ra.me.last_correct).toBe(true);
      expect(ra.me.last_gain).toBeGreaterThanOrEqual(500);
      expect(rb.me.last_correct).toBe(false);
      expect(rb.me.last_gain).toBe(0);
      expect(ra.me.rank).toBe(1);

      await host.send({ type: 'next' });
      expect((await a.until(stateIn('scoreboard'))).state.top[0].name).toBe('Trần Minh An');
      await host.send({ type: 'next' });
    }

    const podium = (await host.until(roomIn('podium'))).room;
    expect(podium.players.map((p: Msg) => p.name)).toEqual(['Trần Minh An', 'Vũ Thu Bình']);
    expect([podium.players[0].correct, podium.players[0].streak]).toEqual([5, 5]);
    expect((await bb.until(stateIn('podium'))).state.me.rank).toBe(2);
    const saved = (await host.until((m) => m.type === 'room' && m.room && m.room.session_id)).room;

    const history = await call(s.base, 'GET', '/api/teacher/live-sessions', undefined, T);
    expect(history.status).toBe(200);
    const session = history.body[0];
    expect(session.id).toBe(saved.session_id);
    expect([session.title, session.class_name, session.question_count, session.player_count]).toEqual(['Ôn tập Bài 14', '7B9', 5, 2]);
    expect(session.results.map((r: Msg) => [r.full_name, r.rank, r.correct, r.answered])).toEqual([
      ['Trần Minh An', 1, 5, 5],
      ['Vũ Thu Bình', 2, 0, 5],
    ]);
    expect(session.questions).toHaveLength(5);
    expect(session.questions.every((q: Msg) => q.answered === 2 && q.correct === 1)).toBe(true);
    expect(session.accuracy).toBe(0.5);
    // Học sinh không xem được lịch sử của giáo viên
    expect((await call(s.base, 'GET', '/api/teacher/live-sessions', undefined, A)).status).toBe(403);

    // Mỗi câu trả lời trong trận được ghi vào tiến độ thật như khi luyện tập
    const pa = await waitProgress(A, (p) => p.lessons_completed === beforeA.lessons_completed + 1 && p.questions_answered === beforeA.questions_answered + 5);
    expect(pa.questions_correct).toBe(beforeA.questions_correct + 5);
    expect(pa.perfect_runs).toBe(beforeA.perfect_runs + 1);
    expect(pa.xp).toBeGreaterThan(beforeA.xp);
    expect(pa.gems).toBeGreaterThan(beforeA.gems);
    const pb = await waitProgress(B, (p) => p.lessons_completed === beforeB.lessons_completed + 1 && p.questions_answered === beforeB.questions_answered + 5);
    expect(pb.questions_correct).toBe(beforeB.questions_correct);
    expect(pb.gems).toBe(beforeB.gems);

    await host.send({ type: 'close' });
    expect((await host.until((m) => m.type === 'room' && m.closed)).room).toBeNull();
    expect((await a.until((m) => m.type === 'closed')).reason).toBe('host_closed');
  });

  test('02 quyền, mã PIN và quản lý phòng', async () => {
    const bad = new LiveClient(s.ws);
    clients.push(bad);
    await bad.send({ type: 'auth', token: 'khong-hop-le' });
    expect((await bad.until(() => true)).code).toBe('auth');
    expect(await bad.closed()).toBe(4401);
    const admin = new LiveClient(s.ws);
    clients.push(admin);
    await admin.send({ type: 'auth', token: ADMIN });
    expect((await admin.until(() => true)).code).toBe('role');
    expect(await admin.closed()).toBe(4403);

    const [lone] = await connect(T2, 'room');
    await lone.send({ type: 'create', count: 5 });
    await lone.until(error('no_class'));

    const [host] = await connect(T, 'room');
    const pin = (await openRoom(host)).pin;
    await host.send({ type: 'start' });
    await host.until(error('no_players'));

    const [other] = await connect(X, 'state');
    await other.send({ type: 'join', pin });
    await other.until(error('not_found')); // phòng của lớp khác: không cho vào, không lộ là phòng có tồn tại
    await other.send({ type: 'start' });
    await other.until(error('bad_request'));

    const [a] = await connect(A, 'state');
    await a.send({ type: 'join', pin: pin !== '000000' ? '000000' : '111111' });
    await a.until(error('not_found'));
    await a.send({ type: 'answer', question_id: 'x', choice: 0 });
    await a.until(error('no_room'));
    await a.send({ type: 'join', pin });
    await a.until(stateIn('lobby'));
    const [bb] = await connect(B, 'state');
    await bb.send({ type: 'join', pin });
    await bb.until(stateIn('lobby'));

    await host.send({ type: 'lock', locked: true });
    await host.until((m) => roomIn('lobby')(m) && m.room.locked);
    const [c] = await connect(C, 'state');
    await c.send({ type: 'join', pin });
    await c.until(error('locked'));

    await host.send({ type: 'kick', player_id: b.id });
    await bb.until((m) => m.type === 'kicked');
    await host.until((m) => roomIn('lobby')(m) && m.room.players.length === 1);
    await host.send({ type: 'lock', locked: false });
    await bb.send({ type: 'join', pin });
    await bb.until(error('banned'));

    await host.send({ type: 'start' });
    const q = (await a.until(stateIn('question'))).state.question;
    await a.send({ type: 'answer', question_id: q.id, choice: 'không-có' });
    await a.until(error('bad_choice'));
    await a.send({ type: 'answer', question_id: 'cau-cu', choice: rightKey(q) });
    await a.until(error('bad_phase'));
    await host.send({ type: 'close' });
    await a.until((m) => m.type === 'closed');

    // Dò PIN: sai quá 8 lần trong một phút thì tạm khóa (lần sai đầu tiên đã tính ở trên)
    for (let i = 0; i < 7; i += 1) {
      await other.send({ type: 'join', pin: '123' });
      await other.until(error('not_found'));
    }
    await other.send({ type: 'join', pin: '123' });
    await other.until(error('too_many'));
  });

  test('03 hết giờ tự công bố đáp án; mất kết nối thì vào lại đúng phòng', async () => {
    hub.questionMs = 1000;
    const [host] = await connect(T, 'room');
    const pin = (await openRoom(host)).pin;
    const [c] = await connect(C, 'state');
    await c.send({ type: 'join', pin });
    await c.until(stateIn('lobby'));
    await host.send({ type: 'start' });
    await c.until(stateIn('question'));
    c.close(); // học sinh mất mạng giữa câu hỏi
    await host.until((m) => m.type === 'room' && m.room && m.room.players.length && !m.room.players[0].connected);

    const [again, hello] = await connect(C, 'state'); // nối lại: tự vào đúng phòng, không cần nhập PIN
    expect(hello.state).not.toBeNull();
    expect(hello.state.pin).toBe(pin);
    const revealed = hello.state.phase === 'reveal' ? hello.state : (await again.until(stateIn('reveal'), 4000)).state;
    expect(revealed.me.last_correct).toBeNull();
    expect(revealed.reveal).toHaveProperty('key');

    // Giáo viên tải lại trang: vào lại phòng đang mở, kết nối cũ nhận "replaced"
    const [host2, hello2] = await connect(T, 'room');
    expect(hello2.room.pin).toBe(pin);
    await host.until((m) => m.type === 'replaced');
    await host2.send({ type: 'close' });
    await again.until((m) => m.type === 'closed');
  });

  test('04 điểm thưởng theo tốc độ và chuỗi câu đúng', async () => {
    const { pointsFor } = await import('../src/live/live.hub');
    expect(pointsFor(false, 100, 3, 20_000)).toBe(0);
    expect(pointsFor(true, 0, 0, 20_000)).toBe(1000);
    expect(pointsFor(true, 20_000, 0, 20_000)).toBe(500);
    expect(pointsFor(true, 10_000, 2, 20_000)).toBe(950);
    expect(pointsFor(true, 0, 9, 20_000)).toBe(1500);
  });
});
