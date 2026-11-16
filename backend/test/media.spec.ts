/**
 * Ảnh, video, nhạc tải lên và kho ảnh (HK.GV.092–093), giao diện bộ đề. Trình soạn "Quiz (Kahoot-style)" (/api/content/studio) đã xóa hẳn theo yêu cầu
 * 16/11/2026 nên các bài kiểm thử của trình soạn bỏ cùng. HTTP thật trên PostgreSQL tạm.
 */
import { call, hasPostgres, Started, startApp } from './harness';
import { bootstrap, Fixture } from './fixture';
import type { DatabaseService } from '../src/database/database.service';

let s: Started, f: Fixture, db: DatabaseService;
const t1 = (method: string, path: string, body?: unknown) => call(s.base, method, path, body, f.T1.token);
const as = (who: { token: string }) => (method: string, path: string, body?: unknown) => call(s.base, method, path, body, who.token);

/** Ảnh PNG 1×1 hợp lệ */
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

(hasPostgres() ? describe : describe.skip)('Ảnh, video, nhạc tải lên và giao diện bộ đề', () => {

  beforeAll(async () => {
    s = await startApp('studio_test');
    db = s.moduleRef.get((await import('../src/database/database.service')).DatabaseService);
    const rootToken = (await call(s.base, 'POST', '/api/auth/login', { username: 'admin', password: 'admin@123', portal: 'root_admin' })).body.token;
    f = await bootstrap(s, rootToken);
  });
  afterAll(async () => { await s?.close(); });

  test('HK.GV.093 giao diện Quiz chỉ nhận nền và nhạc có trong danh sách', async () => {
    const qid = (await t1('POST', '/api/content/questions', { qtype: 'truefalse', prompt: 'Câu hỏi để thử giao diện bộ đề.', data: { correct: true } })).body.id;
    expect((await t1('POST', '/api/content/quizzes', { title: 'Giao diện lạ', theme: { bg: 'khong-co' }, items: [{ question_id: qid }] })).status).toBe(400);
    expect((await t1('POST', '/api/content/quizzes', { title: 'Nhạc lạ', theme: { music: 'rock' }, items: [{ question_id: qid }] })).status).toBe(400);
    expect((await t1('POST', '/api/content/quizzes', { title: 'Ảnh bìa lạ', cover_url: 'javascript:alert(1)', items: [{ question_id: qid }] })).status).toBe(400);
    expect((await t1('POST', '/api/content/quizzes', { title: 'Loại điểm lạ', items: [{ question_id: qid, score_mode: 'triple' }] })).status).toBe(422);
  });

  // ------------------------------------------------------------------ HK.GV.085/092 ảnh tải lên
  test('HK.GV.092 tải ảnh lên: xác định loại bằng nội dung thật, giới hạn kích thước, phục vụ công khai theo mã ngẫu nhiên', async () => {
    expect((await as(f.S1)('POST', '/api/content/media', { data: PNG })).status).toBe(403);
    const up = await t1('POST', '/api/content/media', { name: 'tranh.png', data: `data:image/png;base64,${PNG}` });
    expect(up.status).toBe(200);
    expect(up.body.url).toMatch(/^\/api\/content\/media\/[0-9a-f]{32}$/);
    expect(up.body).toMatchObject({ mime: 'image/png', name: 'tranh.png' });
    const file = await fetch(`${s.base}${up.body.url}`);
    expect(file.status).toBe(200);
    expect(file.headers.get('content-type')).toBe('image/png');
    expect(file.headers.get('cache-control')).toMatch(/immutable/);
    expect(Buffer.from(await file.arrayBuffer()).equals(Buffer.from(PNG, 'base64'))).toBe(true);
    expect((await fetch(`${s.base}/api/content/media/${'0'.repeat(32)}`)).status).toBe(404);
    expect((await fetch(`${s.base}/api/content/media/khong-hop-le`)).status).toBe(404);
    // không phải ảnh (đổi đuôi / loại khai báo cũng không qua), rỗng, quá lớn
    expect((await t1('POST', '/api/content/media', { data: Buffer.from('<svg onload=alert(1)>').toString('base64') })).status).toBe(400);
    expect((await t1('POST', '/api/content/media', { data: '' })).status).toBe(400);
    expect((await t1('POST', '/api/content/media', { data: '%%%' })).status).toBe(400);
    const big = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(1_650_000)]).toString('base64');
    const huge = await t1('POST', '/api/content/media', { data: big });
    expect(huge.status).toBe(400);
    expect(huge.body.detail).toMatch(/1,5 MB/);
    // dùng ảnh đã tải làm ảnh câu hỏi và ảnh bìa; liên kết lạ bị từ chối
    const withImage = await t1('POST', '/api/content/questions', { qtype: 'truefalse', prompt: 'Bức tranh này vẽ trận Bạch Đằng.', image_url: up.body.url, video_url: 'https://www.youtube.com/watch?v=abcdefghijk', data: { correct: true } });
    expect(withImage.status).toBe(201);
    expect(withImage.body).toMatchObject({ image_url: up.body.url, video_url: 'https://www.youtube.com/watch?v=abcdefghijk' });
    expect((await t1('POST', '/api/content/questions', { qtype: 'truefalse', prompt: 'Ảnh lạ', image_url: '/api/content/media/abc', data: { correct: true } })).status).toBe(400);
    expect((await t1('POST', '/api/content/questions', { qtype: 'truefalse', prompt: 'Video lạ', video_url: 'http://example.com/v.mp4', data: { correct: true } })).status).toBe(400);
    expect((await t1('POST', '/api/content/quizzes', { title: 'Có ảnh bìa tải lên', cover_url: up.body.url, items: [{ question_id: withImage.body.id }] })).status).toBe(201);
  });

  test('HK.GV.092 kho ảnh: ảnh tôi đã tải lên và ảnh sử liệu đã công bố; tìm theo tên', async () => {
    const lib = await t1('GET', '/api/content/media-library');
    expect(lib.status).toBe(200);
    expect(lib.body.uploads).toHaveLength(1);
    expect(lib.body.uploads[0].url).toMatch(/^\/api\/content\/media\//);
    expect((await as(f.T2)('GET', '/api/content/media-library')).body.uploads).toHaveLength(0); // ảnh của người khác không hiện
    await db.query("INSERT INTO hist_sources (slug, title, kind, attachment_url, status) VALUES ('tranh-bach-dang', 'Tranh trận Bạch Đằng', 'hinh_anh', 'https://upload.wikimedia.org/bach-dang.jpg', 'published'), ('tranh-nhap', 'Tranh còn nháp', 'hinh_anh', 'https://upload.wikimedia.org/nhap.jpg', 'draft')");
    const found = await t1('GET', `/api/content/media-library?q=${encodeURIComponent('bạch đằng')}`);
    expect(found.body.library.map((x: any) => x.title)).toEqual(['Tranh trận Bạch Đằng']);
    expect(found.body.library[0]).toMatchObject({ kind: 'source', url: 'https://upload.wikimedia.org/bach-dang.jpg' });
    expect((await t1('GET', '/api/content/media-library?q=nhap')).body.library).toHaveLength(0); // bản nháp không hiện
  });

  // ------------------------------------------------------------------ HK.GV.092 video tải lên, HK.GV.093 tệp nhạc tải lên
  describe('video và nhạc tải lên', () => {
    const MP4 = (n: number) => Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom'), Buffer.alloc(n)]);
    const WEBM = (n: number) => Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f]), Buffer.from('webm'), Buffer.alloc(n)]);
    const MP3 = (n: number) => Buffer.concat([Buffer.from('ID3'), Buffer.from([3, 0, 0, 0, 0, 0, 0]), Buffer.alloc(n, 0x55)]);
    const OGG = (n: number) => Buffer.concat([Buffer.from('OggS'), Buffer.alloc(n)]);
    const up = (buf: Buffer, name = 'tep') => t1('POST', '/api/content/media', { name, data: buf.toString('base64') });
    let video: { url: string; token: string }, music: { url: string; token: string };

    test('nhận MP4, WebM, MP3, OGG theo nội dung thật; phục vụ đúng loại; từ chối tệp giả và tệp quá lớn', async () => {
      const a = await up(MP4(2000), 'bai-giang.mp4');
      expect(a.status).toBe(200);
      expect(a.body).toMatchObject({ mime: 'video/mp4', kind: 'video', name: 'bai-giang.mp4' });
      video = a.body;
      expect((await up(WEBM(500))).body).toMatchObject({ mime: 'video/webm', kind: 'video' });
      const m = await up(MP3(3000), 'nhac-cho.mp3');
      expect(m.body).toMatchObject({ mime: 'audio/mpeg', kind: 'audio' });
      music = m.body;
      expect((await up(OGG(800))).body).toMatchObject({ mime: 'audio/ogg', kind: 'audio' });
      const file = await fetch(`${s.base}${video.url}`);
      expect(file.status).toBe(200);
      expect(file.headers.get('content-type')).toBe('video/mp4');
      expect(file.headers.get('accept-ranges')).toBe('bytes');
      expect(Buffer.from(await file.arrayBuffer()).equals(MP4(2000))).toBe(true);
      // không phải video / nhạc thật: đổi đuôi hay khai báo loại đều không qua
      expect((await up(Buffer.from('MZ này là tệp chạy được, không phải video'.padEnd(100, 'x')), 'virus.mp4')).status).toBe(400);
      expect((await up(Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(100)]), 'mkv.webm')).status).toBe(400); // EBML nhưng không phải WebM
      expect((await up(Buffer.from('<html><script>alert(1)</script></html>'), 'trang.mp3')).status).toBe(400);
      // quá lớn: nhạc tối đa 4 MB, video tối đa 8 MB
      const bigAudio = await up(MP3(4_500_000));
      expect(bigAudio.status).toBe(400);
      expect(bigAudio.body.detail).toMatch(/4 MB/);
      const bigVideo = await up(MP4(8_500_000));
      expect(bigVideo.status).toBe(400);
      expect(bigVideo.body.detail).toMatch(/8 MB/);
      expect((await as(f.S1)('POST', '/api/content/media', { data: MP3(10).toString('base64') })).status).toBe(403);
    });

    test('phát có tua: trả lời yêu cầu Range (206 / 416), đúng đoạn byte', async () => {
      const whole = MP4(2000);
      const get = (range?: string) => fetch(`${s.base}${video.url}`, { headers: range ? { Range: range } : {} });
      const a = await get('bytes=0-9');
      expect(a.status).toBe(206);
      expect(a.headers.get('content-range')).toBe(`bytes 0-9/${whole.length}`);
      expect(a.headers.get('content-length')).toBe('10');
      expect(Buffer.from(await a.arrayBuffer()).equals(whole.subarray(0, 10))).toBe(true);
      const b = await get('bytes=2000-');
      expect(b.status).toBe(206);
      expect(Buffer.from(await b.arrayBuffer()).equals(whole.subarray(2000))).toBe(true);
      const c = await get('bytes=-5');
      expect(c.status).toBe(206);
      expect(c.headers.get('content-range')).toBe(`bytes ${whole.length - 5}-${whole.length - 1}/${whole.length}`);
      expect(Buffer.from(await c.arrayBuffer()).equals(whole.subarray(whole.length - 5))).toBe(true);
      const d = await get(`bytes=5-${whole.length + 500}`); // quá cuối tệp: cắt cho vừa
      expect(d.status).toBe(206);
      expect(d.headers.get('content-range')).toBe(`bytes 5-${whole.length - 1}/${whole.length}`);
      const e = await get(`bytes=${whole.length + 10}-`);
      expect(e.status).toBe(416);
      expect(e.headers.get('content-range')).toBe(`bytes */${whole.length}`);
      expect((await get('bytes=9-3')).status).toBe(416);
      expect((await get('chunks=1-2')).status).toBe(200); // không phải đơn vị byte: bỏ qua, trả cả tệp
      expect((await get()).status).toBe(200);
    });

    test('video và nhạc dùng được ở câu hỏi và Quiz; liên kết lạ vẫn bị từ chối; kho tệp liệt kê theo loại', async () => {
      const q = await t1('POST', '/api/content/questions', { qtype: 'truefalse', prompt: 'Đoạn video này kể về trận Bạch Đằng.', video_url: video.url, data: { correct: true } });
      expect(q.status).toBe(201);
      expect(q.body.video_url).toBe(video.url);
      expect((await t1('POST', '/api/content/questions', { qtype: 'truefalse', prompt: 'Video ngoài', video_url: '/api/content/media/abc', data: { correct: true } })).status).toBe(400);
      const withMusic = await t1('POST', '/api/content/quizzes', { title: 'Quiz có nhạc riêng', theme: { bg: 'bach-dang', music: 'upload', music_url: music.url }, items: [{ question_id: q.body.id }] });
      expect(withMusic.status).toBe(201);
      expect(withMusic.body.theme).toEqual({ bg: 'bach-dang', music: 'upload', music_url: music.url });
      const bad = (theme: Record<string, unknown>) => t1('POST', '/api/content/quizzes', { title: 'Nhạc không hợp lệ', theme, items: [{ question_id: q.body.id }] });
      expect((await bad({ music: 'upload' })).status).toBe(400); // thiếu tệp
      expect((await bad({ music: 'upload', music_url: 'https://example.com/nhac.mp3' })).status).toBe(400); // phải là tệp đã tải lên
      expect((await bad({ music: 'upload', music_url: video.url })).status).toBe(400); // không phải nhạc
      expect((await bad({ music: 'upload', music_url: `/api/content/media/${'1'.repeat(32)}` })).status).toBe(400); // không có tệp
      const lib = (await t1('GET', '/api/content/media-library')).body;
      expect(lib.videos.map((v: any) => v.url)).toContain(video.url);
      expect(lib.audios.map((v: any) => v.url)).toContain(music.url);
      expect(lib.uploads.every((u: any) => u.mime.startsWith('image/'))).toBe(true);
      expect((await as(f.T2)('GET', '/api/content/media-library')).body.videos).toHaveLength(0);
    });

    test('hạn mức theo loại: tối đa 5 video mỗi giáo viên; xóa tệp của mình khi không còn dùng thì tải thêm được', async () => {
      // đã có 2 video (mp4, webm); tải thêm cho đủ 5
      for (let i = 0; i < 3; i++) expect((await up(MP4(100 + i), `v${i}.mp4`)).status).toBe(200);
      const over = await up(MP4(999));
      expect(over.status).toBe(409);
      expect(over.body.detail).toMatch(/tối đa 5 video/);
      expect((await up(MP3(50))).status).toBe(200); // hạn mức nhạc tính riêng
      // đang dùng ở một câu hỏi thì không xóa được; người khác không xóa được
      expect((await as(f.T2)('DELETE', `/api/content/media/${video.token}`)).status).toBe(404);
      const used = await t1('DELETE', `/api/content/media/${video.token}`);
      expect(used.status).toBe(409);
      expect(used.body.detail).toMatch(/đang được dùng/);
      const spare = (await t1('GET', '/api/content/media-library')).body.videos.find((v: any) => v.name === 'v0.mp4');
      expect((await t1('DELETE', `/api/content/media/${spare.token}`)).body).toEqual({ deleted: true });
      expect((await fetch(`${s.base}${spare.url}`)).status).toBe(404);
      expect((await up(MP4(999))).status).toBe(200); // còn chỗ trống
      expect((await t1('DELETE', `/api/content/media/${'0'.repeat(32)}`)).status).toBe(404);
    });
  });
});

describe('kiểm tra chuỗi base64 của tệp tải lên', () => {
  // nhập muộn: nhập đầu tệp sẽ nạp cấu hình trước khi startApp đặt DATABASE_URL cho các bài chạy trên PostgreSQL ở trên
  const load = async () => (await import('../src/content/studio.service')).isBase64;

  test('nhận base64 chuẩn (có hoặc thiếu dấu =), từ chối ký tự lạ, dấu = thừa và chuỗi rỗng', async () => {
    const isBase64 = await load();
    expect(isBase64('QUJD')).toBe(true);
    expect(isBase64('QUI=')).toBe(true);
    expect(isBase64('QQ==')).toBe(true);
    expect(isBase64('QQ')).toBe(true); // thiếu dấu =
    expect(isBase64('ab+/AZ09')).toBe(true);
    for (const bad of ['', '=', '==', 'QQ===', 'QU-_', 'QU Q', 'QU\nQ', '%%%', 'QQ==x', '<svg onload=alert(1)>']) expect(isBase64(bad)).toBe(false);
  });

  test('chuỗi dài hàng chục MB vẫn kiểm tra nhanh và không tràn ngăn xếp (biểu thức chính quy từng gây lỗi 500 ngẫu nhiên)', async () => {
    const isBase64 = await load();
    const big = Buffer.alloc(30 * 1024 * 1024, 0x55).toString('base64'); // ~40 triệu ký tự
    const t0 = Date.now();
    expect(isBase64(big)).toBe(true);
    expect(isBase64(`${big}!`)).toBe(false);
    expect(Date.now() - t0).toBeLessThan(5000);
  });
});
