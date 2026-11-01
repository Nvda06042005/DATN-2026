/**
 * Sprint 8, thi đấu trực tiếp (HK.HS.079–085, HK.GV.051–058, HK.SYS.016): phòng thi từ bộ đề với mã PIN và mã QR, vào phòng bằng PIN, biệt danh và hình đại diện,
 * điều khiển trận (bắt đầu, câu tiếp, tạm dừng, bỏ qua, kết thúc sớm), chấm điểm theo độ đúng và tốc độ, bảng điểm sau mỗi câu, bục vinh quang, điểm cộng vào tài khoản,
 * thi theo đội, báo cáo và xuất Excel/PDF. Dùng WebSocket (Socket.IO) thật trên PostgreSQL tạm.
 */
import { io, Socket } from 'socket.io-client';
import * as ExcelJS from 'exceljs';
import { call, download, hasPostgres, Started, startApp } from './harness';
import { bootstrap, Fixture, publishSeed } from './fixture';
import type { DatabaseService } from '../src/database/database.service';
import type { LiveService } from '../src/live/live.service';

let s: Started, f: Fixture, db: DatabaseService, live: LiveService;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const api = (method: string, path: string, body?: unknown, token = f.T1.token) => call(s.base, method, path, body, token);
const as = (who: { token: string }) => (method: string, path: string, body?: unknown) => call(s.base, method, path, body, who.token);
const clients: Client[] = [];

interface Client { sock: Socket; states: any[]; answered: any[] }
async function connect(token: string): Promise<Client> {
  const sock = io(s.base, { path: '/api/live/ws', auth: { token }, transports: ['websocket'], forceNew: true, reconnection: false });
  const c: Client = { sock, states: [], answered: [] };
  sock.on('live:state', (v) => c.states.push(v));
  sock.on('live:answered', (v) => c.answered.push(v));
  await new Promise<void>((resolve, reject) => { sock.on('connect', () => resolve()); sock.on('connect_error', (e) => { sock.close(); reject(e); }); });
  clients.push(c);
  return c;
}
const emit = (c: Client, event: string, body: unknown) => new Promise<any>((resolve) => c.sock.emit(event, body, resolve));
const last = (c: Client) => c.states[c.states.length - 1];
async function until<T>(fn: () => T | undefined | false | null, what: string, ms = 5000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = fn();
    if (v) return v as T;
    if (Date.now() > end) throw new Error(`Hết giờ chờ: ${what}`);
    await sleep(25);
  }
}

/** Câu trả lời đúng/sai tính từ bản chụp câu hỏi của phòng (học sinh không có dữ liệu này) */
async function answerFor(roomId: number, index: number, right: boolean): Promise<unknown> {
  const plan = (await db.query<{ plan: any[] }>('SELECT plan FROM hk_live_rooms WHERE id = $1', [roomId]))[0].plan;
  const { qtype, data } = plan[index].snap;
  switch (qtype) {
    case 'single': return { choice: right ? data.correct : data.options.find((o: any) => o.id !== data.correct).id };
    case 'multiple': return { choices: right ? data.correct : [data.options.find((o: any) => !data.correct.includes(o.id)).id] };
    case 'truefalse': return { value: right ? data.correct : !data.correct };
    case 'fill': return { blanks: data.blanks.map((b: any) => (right ? b.accept[0] : 'sai')) };
    case 'order': return { order: right ? data.items.map((i: any) => i.id) : [...data.items.map((i: any) => i.id)].reverse() };
    default: return { placements: Object.fromEntries(data.targets.map((t: any) => [t.id, right ? { lat: t.lat, lng: t.lng } : { lat: 10, lng: 106 }])) };
  }
}

(hasPostgres() ? describe : describe.skip)('Sprint 8 – thi đấu trực tiếp', () => {
  let classId: number, quizId: number;
  const room = async (mode: 'solo' | 'team' = 'solo', token = f.T1.token) => (await api('POST', '/api/live/rooms', { class_id: classId, quiz_id: quizId, mode }, token));
  const end = async (id: number) => api('POST', `/api/live/rooms/${id}/command`, { action: 'end' });

  beforeAll(async () => {
    s = await startApp('live_test');
    db = s.moduleRef.get((await import('../src/database/database.service')).DatabaseService);
    live = s.moduleRef.get((await import('../src/live/live.service')).LiveService);
    const rootToken = (await call(s.base, 'POST', '/api/auth/login', { username: 'admin', password: 'admin@123', portal: 'root_admin' })).body.token;
    f = await bootstrap(s, rootToken, true);
    await publishSeed(s.base, f.root);
    classId = f.class7a.id;
    quizId = (await db.query<{ id: number }>("SELECT z.id FROM hk_quizzes z WHERE z.scope = 'system' AND (SELECT count(*) FROM hk_quiz_questions k WHERE k.quiz_id = z.id) >= 4 ORDER BY z.id LIMIT 1"))[0].id;
  });
  afterAll(async () => {
    for (const c of clients) c.sock.close();
    await s?.close();
  });

  // ------------------------------------------------------------------ HK.GV.051
  test('HK.GV.051 tạo phòng thi từ bộ đề: mã PIN 6 số, mã QR, bản chụp câu hỏi; kiểm tra lớp, bộ đề, chế độ và quyền', async () => {
    expect((await room('solo', f.S1.token)).status).toBe(403); // học sinh không tổ chức thi
    expect((await room('solo', f.T2.token)).status).toBe(404); // giáo viên không phụ trách lớp 7A1
    expect((await api('POST', '/api/live/rooms', { class_id: classId, quiz_id: 987654 })).status).toBe(404);
    expect((await api('POST', '/api/live/rooms', { class_id: classId, quiz_id: quizId, mode: 'nhom' })).status).toBe(400);
    expect((await api('POST', '/api/live/rooms', { class_id: 'abc', quiz_id: quizId })).status).toBe(400);
    expect((await room('team')).status).toBe(409); // lớp chưa chia đội
    const made = await room();
    expect(made.status).toBe(201);
    const v = made.body;
    expect(v.room).toMatchObject({ mode: 'solo', state: 'lobby', q_index: -1, class_name: '7A1', class_id: classId });
    expect(v.room.pin).toMatch(/^\d{6}$/);
    expect(v.join_url).toMatch(new RegExp(`/hoc-sinh\\?pin=${v.room.pin}$`));
    expect(v.qr).toMatch(/^data:image\/png;base64,/);
    expect(v.room.total).toBeGreaterThanOrEqual(3);
    expect(v.player_count).toBe(0);
    const row = (await db.query<any>('SELECT total, jsonb_array_length(plan) AS n, host_id FROM hk_live_rooms WHERE id = $1', [v.room.id]))[0];
    expect(row).toMatchObject({ total: v.room.total, n: v.room.total, host_id: f.T1.id });
    expect((await api('GET', `/api/live/rooms/${v.room.id}`, undefined, f.T2.token)).status).toBe(404); // chỉ giáo viên chủ phòng
    expect((await api('GET', '/api/live/rooms')).body.map((x: any) => x.id)).toContain(v.room.id);
    // mỗi giáo viên tối đa 5 phòng chưa kết thúc
    const extra: number[] = [];
    for (let i = 0; i < 4; i++) extra.push((await room()).body.room.id);
    expect((await room()).status).toBe(409);
    for (const id of [v.room.id, ...extra]) await end(id);
    expect((await room()).status).toBe(201); // dọn rồi lại tạo được; PIN của phòng đã kết thúc dùng lại được
    for (const r of (await api('GET', '/api/live/rooms')).body.filter((x: any) => x.state !== 'ended')) await end(r.id);
  });

  // ------------------------------------------------------------------ HK.HS.079–080
  test('HK.HS.079/080 vào phòng bằng PIN: chỉ học sinh của lớp, biệt danh không trùng, hình đại diện hợp lệ, vào lại giữ nguyên; đổi biệt danh ở phòng chờ', async () => {
    const r = (await room()).body;
    const pin = r.room.pin;
    expect((await as(f.S1)('GET', '/api/live/lookup/12345')).status).toBe(400);
    expect((await as(f.S1)('GET', `/api/live/lookup/${pin === '000000' ? '000001' : '000000'}`)).status).toBe(404);
    expect((await as(f.S3)('GET', `/api/live/lookup/${pin}`)).status).toBe(404); // S3 chưa thuộc lớp
    expect((await as(f.S3)('POST', '/api/live/join', { pin })).status).toBe(404);
    expect((await api('GET', `/api/live/lookup/${pin}`)).status).toBe(403); // giáo viên không vào với tư cách học sinh
    const look = (await as(f.S1)('GET', `/api/live/lookup/${pin}`)).body;
    expect(look).toMatchObject({ room_id: r.room.id, class_name: '7A1', mode: 'solo', state: 'lobby', mine: null });
    expect(look.suggested.length).toBeGreaterThanOrEqual(2);
    expect(look.avatars).toContain('crown');
    expect((await as(f.S1)('POST', '/api/live/join', { pin, nickname: 'a' })).status).toBe(400);
    expect((await as(f.S1)('POST', '/api/live/join', { pin, nickname: '<b>x</b>' })).status).toBe(400);
    expect((await as(f.S1)('POST', '/api/live/join', { pin, nickname: 'Cơn Lốc', avatar: 'khong-co' })).status).toBe(400);
    const j1 = await as(f.S1)('POST', '/api/live/join', { pin, nickname: 'Cơn Lốc', avatar: 'crown' });
    expect(j1.status).toBe(200);
    expect(j1.body.state.me).toMatchObject({ nickname: 'Cơn Lốc', avatar: 'crown', score: 0 });
    expect((await as(f.S2)('POST', '/api/live/join', { pin, nickname: 'cơn lốc' })).status).toBe(409); // trùng (không phân biệt hoa thường)
    const j2 = await as(f.S2)('POST', '/api/live/join', { pin });
    expect(j2.status).toBe(200);
    expect(j2.body.state.me.nickname.length).toBeGreaterThanOrEqual(2); // biệt danh gợi ý từ tên
    const again = await as(f.S1)('POST', '/api/live/join', { pin, nickname: 'Cơn Lốc' });
    expect(again.body.player_id).toBe(j1.body.player_id); // vào lại là cùng người chơi
    expect((await as(f.S1)('POST', `/api/live/rooms/${r.room.id}/profile`, { nickname: 'Tướng Sĩ', avatar: 'swords' })).body.me).toMatchObject({ nickname: 'Tướng Sĩ', avatar: 'swords' });
    expect((await as(f.S1)('POST', `/api/live/rooms/${r.room.id}/profile`, { nickname: j2.body.state.me.nickname })).status).toBe(409);
    const open = (await as(f.S1)('GET', '/api/live/open')).body;
    expect(open.find((x: any) => x.id === r.room.id)).toMatchObject({ title: r.room.title, class_name: '7A1', players: 2, joined: true });
    expect(JSON.stringify(open)).not.toContain(pin); // phòng đang mở không lộ PIN
    expect((await as(f.S3)('GET', '/api/live/open')).body).toEqual([]);
    const state = (await api('GET', `/api/live/rooms/${r.room.id}`)).body;
    expect(state.player_count).toBe(2);
    expect(state.players.map((p: any) => p.nickname)).toEqual(expect.arrayContaining(['Tướng Sĩ']));
    await api('POST', `/api/live/rooms/${r.room.id}/command`, { action: 'start' });
    expect((await as(f.S1)('POST', `/api/live/rooms/${r.room.id}/profile`, { nickname: 'Muộn Rồi' })).status).toBe(409); // trận đã bắt đầu
    await end(r.room.id);
    expect((await as(f.S1)('POST', '/api/live/join', { pin })).status).toBe(404); // phòng đã kết thúc không vào được nữa
  });

  // ------------------------------------------------------------------ HK.HS.081–084, HK.GV.052–056, HK.SYS.016
  let finished: { id: number };
  test('HK.SYS.016 + HK.HS.081–083 + HK.GV.052–055 trận trực tiếp qua WebSocket: phòng chờ, câu hỏi đồng bộ, chốt câu khi mọi người đã trả lời, bảng điểm, tạm dừng, bỏ qua, kết thúc sớm, bục vinh quang', async () => {
    await api('POST', `/api/classroom/classes/${classId}/students`, { student_ids: [f.S3.id] });
    const r = (await room()).body;
    const id = r.room.id, pin = r.room.pin;
    await expect(connect('token-sai')).rejects.toBeTruthy(); // kết nối không có phiên hợp lệ bị từ chối
    const host = await connect(f.T1.token);
    const p1 = await connect(f.S1.token), p2 = await connect(f.S2.token), p3 = await connect(f.S3.token);
    expect((await emit(p1, 'room:subscribe', { room_id: id })).ok).toBe(false); // chưa vào phòng bằng PIN
    const other = await connect(f.T2.token);
    expect((await emit(other, 'room:subscribe', { room_id: id })).ok).toBe(false); // giáo viên khác không xem được
    const hv = await emit(host, 'room:subscribe', { room_id: id });
    expect(hv.ok).toBe(true);
    expect(hv.data).toMatchObject({ role: 'host', room: { state: 'lobby', pin }, player_count: 0 });
    // phòng chờ cập nhật theo thời gian thực: người vào thì giáo viên thấy ngay
    await as(f.S1)('POST', '/api/live/join', { pin, nickname: 'Cơn Lốc', avatar: 'crown' });
    await as(f.S2)('POST', '/api/live/join', { pin, nickname: 'Sóng Dữ', avatar: 'flame' });
    expect((await emit(p1, 'room:subscribe', { room_id: id })).data.me).toMatchObject({ nickname: 'Cơn Lốc' });
    await emit(p2, 'room:subscribe', { room_id: id });
    await until(() => last(host)?.player_count === 2 && last(host).players.filter((p: any) => p.online).length === 2, 'giáo viên thấy 2 người trực tuyến');
    expect(last(host).players.map((p: any) => p.nickname).sort()).toEqual(['Cơn Lốc', 'Sóng Dữ']);
    expect((await emit(p1, 'host:command', { room_id: id, action: 'start' })).ok).toBe(false); // học sinh không điều khiển trận
    expect((await emit(host, 'host:command', { room_id: id, action: 'nhay-vot' })).ok).toBe(false);
    expect((await emit(host, 'host:command', { room_id: id, action: 'next' })).ok).toBe(false); // chưa bắt đầu
    expect((await emit(p1, 'player:answer', { room_id: id, answer: { choice: 'a' } })).ok).toBe(false); // phòng chờ chưa có câu hỏi

    // bắt đầu: mọi màn hình cùng thấy câu 1; đáp án đúng không được gửi cho học sinh
    const started = await emit(host, 'host:command', { room_id: id, action: 'start' });
    expect(started.ok).toBe(true);
    await until(() => last(p1)?.room.state === 'question' && last(p2)?.room.state === 'question' && last(host).room.state === 'question', 'cả phòng sang câu 1');
    const q0 = last(p1).question;
    expect(q0).toMatchObject({ index: 0, paused: false });
    expect(q0.deadline).toBeGreaterThan(Date.now() - 2000);
    expect(q0.remaining_ms).toBeGreaterThan(1000);
    expect(JSON.stringify(last(p1))).not.toMatch(/"correct"|answer_key|explanation/); // không lộ đáp án trong lúc làm
    expect(last(p1).me).toMatchObject({ answered: false, score: 0, last: null });
    expect(last(host).answered).toMatchObject({ count: 0, online: 2 });
    expect(last(p1).server_now).toBeGreaterThan(0);

    // S1 trả lời đúng, S2 sai, S3 chưa vào phòng nên không được trả lời
    expect((await emit(p3, 'player:answer', { room_id: id, answer: await answerFor(id, 0, true) })).ok).toBe(false);
    expect((await emit(p1, 'player:answer', { room_id: id, q_index: 5, answer: await answerFor(id, 0, true) })).ok).toBe(false); // sai chỉ số câu
    const a1 = await emit(p1, 'player:answer', { room_id: id, q_index: 0, answer: await answerFor(id, 0, true) });
    expect(a1).toMatchObject({ ok: true, data: { received: true, q_index: 0 } });
    expect(JSON.stringify(a1)).not.toMatch(/correct|points/); // không báo đúng/sai cho đến khi hết câu
    await until(() => host.answered.some((x) => x.count === 1), 'giáo viên thấy 1 người đã trả lời');
    expect((await emit(p1, 'player:answer', { room_id: id, answer: await answerFor(id, 0, true) })).ok).toBe(false); // không trả lời hai lần
    expect(last(host).room.state).toBe('question');
    expect((await emit(p2, 'player:answer', { room_id: id, answer: await answerFor(id, 0, false) })).ok).toBe(true);
    // mọi người đang trực tuyến đã trả lời: máy chủ chốt câu, không cần giáo viên bấm
    await until(() => last(host).room.state === 'results' && last(p1).room.state === 'results' && last(p2).room.state === 'results', 'tự chốt câu 1');
    const res = last(host).results;
    expect(res).toMatchObject({ index: 0, skipped: false, stats: { correct: 1, wrong: 1, none: 0 }, last: false });
    expect(res.answer_key).toBeTruthy();
    if (res.options) expect(res.options.reduce((n: number, o: any) => n + o.count, 0)).toBeGreaterThanOrEqual(1);
    expect(res.top.map((t: any) => [t.nickname, t.rank])).toEqual([['Cơn Lốc', 1], ['Sóng Dữ', 2]]);
    const max = (await db.query<any>('SELECT plan->0->>\'points\' AS p FROM hk_live_rooms WHERE id = $1', [id]))[0].p;
    const s1 = last(p1).me;
    expect(s1.score).toBeGreaterThanOrEqual(Math.round(Number(max) / 2));
    expect(s1.score).toBeLessThanOrEqual(Number(max));
    expect(s1).toMatchObject({ rank: 1, answered: true, last: { correct: true, points: s1.score } });
    expect(last(p2).me).toMatchObject({ score: 0, rank: 2, last: { correct: false, points: 0 } });
    expect((await emit(p2, 'player:answer', { room_id: id, answer: await answerFor(id, 0, true) })).ok).toBe(false); // hết câu thì không nhận nữa

    // câu 2: tạm dừng, không nhận đáp án, tiếp tục
    expect((await emit(host, 'host:command', { room_id: id, action: 'next' })).ok).toBe(true);
    await until(() => last(p1).room.state === 'question' && last(p1).question.index === 1, 'sang câu 2');
    expect((await emit(host, 'host:command', { room_id: id, action: 'pause' })).ok).toBe(true);
    await until(() => last(p1).question?.paused === true, 'tạm dừng');
    const frozen = last(p1).question.remaining_ms;
    expect(frozen).toBeGreaterThan(0);
    expect((await emit(host, 'host:command', { room_id: id, action: 'pause' })).ok).toBe(false);
    expect((await emit(p1, 'player:answer', { room_id: id, answer: await answerFor(id, 1, true) })).ok).toBe(false); // đang tạm dừng
    await sleep(300);
    expect((await emit(host, 'host:command', { room_id: id, action: 'resume' })).ok).toBe(true);
    await until(() => last(p1).question?.paused === false, 'tiếp tục');
    expect(last(p1).question.remaining_ms).toBeLessThanOrEqual(frozen); // thời gian tạm dừng không bị mất oan
    expect(last(p1).question.remaining_ms).toBeGreaterThan(frozen - 2000);
    // S1 trả lời đúng rồi giáo viên bỏ qua câu: điểm của câu này bị thu hồi
    const before = (await db.query<any>('SELECT score FROM hk_live_players WHERE room_id = $1 AND user_id = $2', [id, f.S1.id]))[0].score;
    expect((await emit(p1, 'player:answer', { room_id: id, answer: await answerFor(id, 1, true) })).ok).toBe(true);
    expect((await db.query<any>('SELECT score FROM hk_live_players WHERE room_id = $1 AND user_id = $2', [id, f.S1.id]))[0].score).toBeGreaterThan(before);
    expect((await emit(host, 'host:command', { room_id: id, action: 'skip' })).ok).toBe(true);
    await until(() => last(p1).room.state === 'results' && last(p1).results.index === 1, 'kết quả câu 2 (bỏ qua)');
    expect(last(host).results).toMatchObject({ skipped: true, options: null });
    expect(last(p1).me.score).toBe(before);
    expect(last(p1).me.last).toMatchObject({ correct: false, points: 0 });
    expect((await emit(host, 'host:command', { room_id: id, action: 'skip' })).ok).toBe(false); // hết câu để bỏ qua

    // câu 3: S3 vào muộn (phòng đã chạy) vẫn trả lời được; hết giờ thì máy chủ tự chốt
    await as(f.S3)('POST', '/api/live/join', { pin, nickname: 'Vào Muộn' });
    await emit(p3, 'room:subscribe', { room_id: id });
    expect((await emit(host, 'host:command', { room_id: id, action: 'next' })).ok).toBe(true);
    await until(() => last(p3)?.room.state === 'question' && last(p3).question.index === 2, 'câu 3 tới người vào muộn');
    expect((await emit(p3, 'player:answer', { room_id: id, answer: await answerFor(id, 2, true) })).ok).toBe(true);
    expect((await emit(p1, 'player:answer', { room_id: id, answer: await answerFor(id, 2, true) })).ok).toBe(true);
    expect(last(host).room.state).toBe('question'); // S2 còn chưa trả lời nên chưa chốt
    await db.query("UPDATE hk_live_rooms SET deadline = now() + interval '400 milliseconds' WHERE id = $1", [id]);
    live.armTimer((await db.query<any>('SELECT * FROM hk_live_rooms WHERE id = $1', [id]))[0]);
    await until(() => last(host).room.state === 'results' && last(host).results.index === 2, 'hết giờ máy chủ tự chốt câu 3', 4000);
    expect(last(host).results.stats).toMatchObject({ correct: 2, wrong: 0, none: 1 }); // S2 không trả lời
    expect(last(p1).results.top.length).toBe(3);

    // kết thúc sớm: bục vinh quang, điểm cộng vào tài khoản
    const xpBefore = (await as(f.S1)('GET', '/api/game/me')).body.xp;
    expect((await emit(host, 'host:command', { room_id: id, action: 'end' })).ok).toBe(true);
    await until(() => last(p1).room.state === 'ended' && last(p2).room.state === 'ended' && last(host).room.state === 'ended', 'bục vinh quang');
    const fin = last(host).final;
    expect(fin.ended_early).toBe(true);
    expect(fin.podium.map((p: any) => p.rank)).toEqual([1, 2, 3]);
    expect(fin.podium[0].nickname).toBe('Cơn Lốc');
    expect(fin.ranking).toHaveLength(3);
    expect(fin.played).toBe(3);
    const mine = last(p1).me;
    expect(mine.rank).toBe(1);
    expect(mine.xp_awarded).toBeGreaterThan(20); // điểm trận quy đổi + thưởng hạng nhất
    expect((await as(f.S1)('GET', '/api/game/me')).body.xp - xpBefore).toBe(mine.xp_awarded);
    expect(Number((await db.query<any>("SELECT count(*) AS n FROM hk_points WHERE reason = 'live' AND ref_key = $1 AND user_id = $2", [`live:${id}`, f.S1.id]))[0].n)).toBe(1);
    expect(last(p2).me.xp_awarded).toBe(0); // S2 không ghi được điểm nào
    expect((await emit(host, 'host:command', { room_id: id, action: 'end' })).ok).toBe(false); // trận đã kết thúc
    expect((await api('POST', `/api/live/rooms/${id}/command`, { action: 'next' })).status).toBe(409);
    expect((await as(f.S1)('GET', '/api/game/me')).body.xp - xpBefore).toBe(mine.xp_awarded); // không cộng lần hai
    finished = { id };
    for (const c of [host, p1, p2, p3, other]) c.sock.close();
  });

  // ------------------------------------------------------------------ HK.GV.056–057, HK.HS.084
  test('HK.GV.056/057 báo cáo trận: điểm từng học sinh, tỉ lệ đúng từng câu, câu khó nhất, lịch sử phòng; xuất Excel và PDF', async () => {
    const id = finished.id;
    expect((await api('GET', `/api/live/rooms/${id}/report`, undefined, f.T2.token)).status).toBe(404);
    expect((await as(f.S1)('GET', `/api/live/rooms/${id}/report`)).status).toBe(403);
    const rep = (await api('GET', `/api/live/rooms/${id}/report`)).body;
    expect(rep.room).toMatchObject({ id, state: 'ended', class_name: '7A1', mode: 'solo', ended_early: true, played: 3 });
    expect(rep.summary).toMatchObject({ players: 3, skipped: 1 });
    expect(rep.questions.map((x: any) => [x.number, x.skipped])).toEqual([[1, false], [2, true], [3, false]]);
    expect(rep.questions[0]).toMatchObject({ answered: 2, correct: 1, wrong: 1, correct_rate: 50 });
    expect(rep.questions[1]).toMatchObject({ skipped: true, answered: 0, correct_rate: null });
    expect(rep.questions[2]).toMatchObject({ answered: 2, correct: 2, none: 1, correct_rate: 100 });
    expect(rep.hardest).toMatchObject({ number: 1, correct_rate: 50 }); // câu bị bỏ qua không tính là khó nhất
    expect(rep.players.map((p: any) => [p.rank, p.full_name])[0]).toEqual([1, 'Phạm Minh Một']);
    expect(rep.players[0]).toMatchObject({ nickname: 'Cơn Lốc', correct_count: 2, answered_count: 2, accuracy: 100 });
    expect(rep.players.find((p: any) => p.full_name === 'Hoàng Thị Hai')).toMatchObject({ score: 0, correct_count: 0, answered_count: 1, accuracy: 0 });
    const hist = (await api('GET', `/api/live/rooms?class_id=${classId}`)).body.find((x: any) => x.id === id);
    expect(hist).toMatchObject({ state: 'ended', players: 3, class_name: '7A1', pin: null });
    // xuất file
    const xlsx = await download(s.base, `/api/live/rooms/${id}/export?format=xlsx`, f.T1.token);
    expect(xlsx.status).toBe(200);
    expect(xlsx.type).toMatch(/spreadsheetml/);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(xlsx.buffer as never);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Tổng quan', 'Học sinh', 'Câu hỏi']);
    expect(wb.getWorksheet('Học sinh')!.rowCount).toBe(4);
    expect(String(wb.getWorksheet('Học sinh')!.getRow(2).getCell(2).value)).toBe('Phạm Minh Một');
    const pdf = await download(s.base, `/api/live/rooms/${id}/export?format=pdf`, f.T1.token);
    expect(pdf.status).toBe(200);
    expect(pdf.type).toMatch(/pdf/);
    expect(pdf.buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.buffer.length).toBeGreaterThan(3000);
    expect((await download(s.base, `/api/live/rooms/${id}/export?format=doc`, f.T1.token)).status).toBe(404);
    expect((await download(s.base, `/api/live/rooms/${id}/export?format=pdf`, f.T2.token)).status).toBe(404);
    // công thức Excel được làm sạch
    await db.query("UPDATE hk_live_players SET nickname = '=HYPERLINK(1)' WHERE room_id = $1 AND user_id = $2", [id, f.S2.id]);
    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.load((await download(s.base, `/api/live/rooms/${id}/export?format=xlsx`, f.T1.token)).buffer as never);
    expect(wb2.getWorksheet('Học sinh')!.getRows(2, 3)!.map((r) => String(r.getCell(4).value)).some((v) => v.startsWith("'="))).toBe(true);
  });

  test('HK.HS.084 xem lại kết quả cá nhân: từng câu đúng/sai, đáp án, tỉ lệ đúng của cả lớp; chỉ trận đã kết thúc của chính mình', async () => {
    const id = finished.id;
    const my = (await as(f.S1)('GET', '/api/live/my')).body;
    expect(my[0]).toMatchObject({ id, rank: 1, players: 3, class_name: '7A1', correct_count: 2, answered_count: 2 });
    expect(my[0].xp_awarded).toBeGreaterThan(20);
    const rev = (await as(f.S1)('GET', `/api/live/my/${id}`)).body;
    expect(rev.summary).toMatchObject({ rank: 1, players: 3, correct_count: 2 });
    expect(rev.items.map((x: any) => [x.index, x.skipped, x.answered, x.correct])).toEqual([[0, false, true, true], [1, true, false, false], [2, false, true, true]]);
    expect(rev.items[0]).toMatchObject({ class_correct_rate: 50 });
    expect(rev.items[0].answer_key).toBeTruthy();
    const rev2 = (await as(f.S2)('GET', `/api/live/my/${id}`)).body;
    expect(rev2.items[0]).toMatchObject({ answered: true, correct: false, points: 0 });
    expect(rev2.items[2]).toMatchObject({ answered: false, correct: false });
    expect((await as(f.S3)('GET', `/api/live/my/${id}`)).status).toBe(200); // S3 đã vào muộn nên có trận này
    expect((await call(s.base, 'GET', `/api/live/my/${id}`)).status).toBe(401);
    // trận chưa kết thúc chưa xem lại được; người không tham gia không xem được
    const r = (await room()).body;
    await as(f.S1)('POST', '/api/live/join', { pin: r.room.pin });
    expect((await as(f.S1)('GET', `/api/live/my/${r.room.id}`)).status).toBe(409);
    expect((await as(f.S2)('GET', `/api/live/my/${r.room.id}`)).status).toBe(404);
    await end(r.room.id);
  });

  // ------------------------------------------------------------------ đồng hồ và khôi phục
  test('HK.SYS.016 đồng hồ phía máy chủ: hết giờ tự chốt câu kể cả khi không ai tương tác; khởi động lại máy chủ nối lại trận đang diễn ra', async () => {
    const r = (await room()).body;
    const id = r.room.id;
    await as(f.S1)('POST', '/api/live/join', { pin: r.room.pin, nickname: 'Chờ Giờ' });
    await api('POST', `/api/live/rooms/${id}/command`, { action: 'start' });
    // đường "lười": hết giờ mà chưa có tín hiệu nào, chỉ cần có người đọc trạng thái là trận được chốt
    await db.query("UPDATE hk_live_rooms SET deadline = now() - interval '1 second' WHERE id = $1", [id]);
    const st = (await as(f.S1)('GET', `/api/live/rooms/${id}/state`)).body;
    expect(st.room.state).toBe('results');
    expect(st.results.stats).toMatchObject({ correct: 0, wrong: 0, none: 1 });
    // câu tiếp rồi "khởi động lại": mọi người chơi bị đánh dấu ngoại tuyến, trận hết giờ trong lúc máy chủ tắt được chốt khi bật lại
    await api('POST', `/api/live/rooms/${id}/command`, { action: 'next' });
    await db.query("UPDATE hk_live_players SET online = true WHERE room_id = $1", [id]);
    await db.query("UPDATE hk_live_rooms SET deadline = now() - interval '1 second' WHERE id = $1", [id]);
    live.onModuleInit();
    await sleep(500);
    const after = (await db.query<any>('SELECT state FROM hk_live_rooms WHERE id = $1', [id]))[0];
    expect(after.state).toBe('results');
    expect((await db.query<any>('SELECT online FROM hk_live_players WHERE room_id = $1', [id]))[0].online).toBe(false);
    // lệnh sai trạng thái và quyền
    expect((await as(f.S1)('POST', `/api/live/rooms/${id}/command`, { action: 'end' })).status).toBe(403);
    expect((await api('POST', `/api/live/rooms/${id}/command`, { action: 'resume' })).status).toBe(409);
    expect((await api('POST', `/api/live/rooms/${id}/command`, { action: 'pause' })).status).toBe(409); // đang ở màn hình kết quả
    await end(id);
    expect((await as(f.S1)('GET', `/api/live/rooms/${id}/state`)).body.final.podium).toHaveLength(1);
  });

  test('HK.SYS.016 trả lời đồng thời: ba học sinh gửi đáp án cùng lúc, mỗi người được tính đúng một lần và trận chốt câu đúng một lần', async () => {
    await api('PUT', `/api/classroom/classes/${classId}/teams`, { teams: [] });
    const r = (await room()).body;
    const id = r.room.id;
    const host = await connect(f.T1.token);
    await emit(host, 'room:subscribe', { room_id: id });
    const players = [] as Array<{ c: Client; who: { token: string; id: number } }>;
    for (const [who, name] of [[f.S1, 'Song Song Một'], [f.S2, 'Song Song Hai'], [f.S3, 'Song Song Ba']] as const) {
      await as(who)('POST', '/api/live/join', { pin: r.room.pin, nickname: name });
      const c = await connect(who.token);
      await emit(c, 'room:subscribe', { room_id: id });
      players.push({ c, who });
    }
    await emit(host, 'host:command', { room_id: id, action: 'start' });
    await until(() => players.every((p) => last(p.c)?.room.state === 'question'), 'cả ba thấy câu 1');
    const right = await answerFor(id, 0, true);
    const acks = await Promise.all(players.map((p) => emit(p.c, 'player:answer', { room_id: id, q_index: 0, answer: right })));
    expect(acks.map((a) => a.ok)).toEqual([true, true, true]);
    await until(() => last(host).room.state === 'results', 'chốt câu sau khi cả ba trả lời');
    const rows = await db.query<any>('SELECT player_id, points FROM hk_live_answers WHERE room_id = $1 AND q_index = 0 ORDER BY player_id', [id]);
    expect(rows).toHaveLength(3);
    expect(rows.every((x: any) => x.points > 0)).toBe(true);
    expect(last(host).results.stats).toMatchObject({ correct: 3, wrong: 0, none: 0 });
    const scores = await db.query<any>('SELECT score, answered_count FROM hk_live_players WHERE room_id = $1', [id]);
    expect(scores.every((x: any) => x.answered_count === 1 && x.score > 0)).toBe(true);
    await end(id);
    for (const c of [host, ...players.map((p) => p.c)]) c.sock.close();
  });

  // ------------------------------------------------------------------ HK.HS.085, HK.GV.058
  test('HK.HS.085 + HK.GV.058 thi theo đội: học sinh vào đúng đội của lớp, điểm đội là trung bình thành viên, bảng xếp hạng đội', async () => {
    const teams = (await api('PUT', `/api/classroom/classes/${classId}/teams`, { teams: [{ name: 'Đội Sóng', member_ids: [f.S1.id, f.S3.id] }, { name: 'Đội Núi', member_ids: [f.S2.id] }] })).body;
    expect(teams).toHaveLength(2);
    const r = (await room('team')).body;
    expect(r.room.mode).toBe('team');
    const id = r.room.id;
    for (const [who, name] of [[f.S1, 'Sóng Một'], [f.S2, 'Núi Hai'], [f.S3, 'Sóng Ba']] as const) {
      const j = await as(who)('POST', '/api/live/join', { pin: r.room.pin, nickname: name });
      expect(j.body.state.me.team_name).toBe(who === f.S2 ? 'Đội Núi' : 'Đội Sóng');
    }
    await api('POST', `/api/live/rooms/${id}/command`, { action: 'start' });
    for (const [who, right] of [[f.S1, true], [f.S2, true], [f.S3, false]] as const) {
      expect((await as(who)('POST', `/api/live/rooms/${id}/answer`, { q_index: 0, answer: await answerFor(id, 0, right) })).status).toBe(200); // đường HTTP dự phòng
    }
    await sleep(150);
    expect((await api('GET', `/api/live/rooms/${id}/state`)).body.room.state).toBe('question'); // người chơi qua HTTP không trực tuyến nên chưa tự chốt
    expect((await api('POST', `/api/live/rooms/${id}/command`, { action: 'next' })).body.room.state).toBe('results');
    const view = (await api('GET', `/api/live/rooms/${id}`)).body;
    expect(view.results.teams).toHaveLength(2);
    await api('POST', `/api/live/rooms/${id}/command`, { action: 'end' });
    const fin = (await api('GET', `/api/live/rooms/${id}`)).body.final;
    const players = Object.fromEntries(fin.ranking.map((p: any) => [p.nickname, p.score]));
    expect(players['Sóng Ba']).toBe(0);
    // đội Sóng có S1 (đúng) và S3 (sai): điểm đội = trung bình = nửa điểm của S1; đội Núi chỉ có S2 nên xếp trên dù S1 có thể cao hơn S2
    expect(fin.teams.map((t: any) => t.name)).toEqual(players['Núi Hai'] > Math.round(players['Sóng Một'] / 2) ? ['Đội Núi', 'Đội Sóng'] : ['Đội Sóng', 'Đội Núi']);
    expect(fin.teams.find((t: any) => t.name === 'Đội Sóng')).toMatchObject({ members: 2, score: Math.round(players['Sóng Một'] / 2), total: players['Sóng Một'] });
    expect(fin.teams.find((t: any) => t.name === 'Đội Núi')).toMatchObject({ members: 1, score: players['Núi Hai'] });
    const rep = (await api('GET', `/api/live/rooms/${id}/report`)).body;
    expect(rep.teams).toHaveLength(2);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await download(s.base, `/api/live/rooms/${id}/export?format=xlsx`, f.T1.token)).buffer as never);
    expect(wb.worksheets.map((w) => w.name)).toContain('Đội');
    // học sinh chưa có đội vẫn vào được nhưng không nằm trong bảng đội
    await api('PUT', `/api/classroom/classes/${classId}/teams`, { teams: [{ name: 'Đội Sóng', member_ids: [f.S1.id] }, { name: 'Đội Núi', member_ids: [f.S2.id] }] });
    const r2 = (await room('team')).body;
    const lone = await as(f.S3)('POST', '/api/live/join', { pin: r2.room.pin, nickname: 'Lẻ Đội' });
    expect(lone.body.state.me.team_name).toBeNull();
    await end(r2.room.id);
  });
});
