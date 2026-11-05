// HK.GV.088 (câu "Bình chọn" không có đáp án đúng), HK.GV.092 (video tải lên), HK.GV.093 (nhạc chờ là tệp tải lên).
// Các thành phần dùng React Native nên không nạp được trong Node: đọc thẳng mã nguồn và kiểm tra các mắt xích nối nhau; hằng số giới hạn được đối chiếu với máy chủ.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');
const studio = read('components', 'admin', 'QuizStudio.tsx');
const host = read('components', 'admin', 'LiveHost.tsx');
const manager = read('components', 'admin', 'LiveManager.tsx');
const play = read('components', 'portal', 'LivePlay.tsx');
const kit = read('components', 'portal', 'LiveKit.tsx');
const media = read('components', 'portal', 'Media.tsx');
const theme = read('components', 'portal', 'LiveTheme.tsx');
const types = read('types', 'learning.ts') + read('types', 'live.ts') + read('types', 'studio.ts');
const server = (...p) => { const f = path.join(__dirname, '..', '..', 'backend', 'src', ...p); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null; };

test('kiểu dữ liệu có loại "poll" ở câu hỏi, trình soạn và kết quả thi đấu', () => {
  assert.match(types, /export type QType = 'single' \| 'multiple' \| 'truefalse' \| 'fill' \| 'order' \| 'map' \| 'poll'/);
  assert.match(types, /export type StudioQType = 'single' \| 'multiple' \| 'truefalse' \| 'poll'/);
  assert.match(types, /poll\?: boolean; prompt: string; explanation: string \| null; answer_key: QData; skipped: boolean; last: boolean;/);
  assert.match(types, /music_url\?: string/);
  assert.match(types, /videos: UploadedFile\[\]; audios: UploadedFile\[\]/);
});

test('trình soạn Quiz: chọn "Bình chọn", không có dấu đáp án đúng, không tính điểm, báo thiếu hai lựa chọn đầu', () => {
  assert.match(studio, /\{ value: 'poll', label: 'Bình chọn' \}/);
  assert.match(studio, /correct: t === 'poll' \? \[\] :/);
  assert.match(studio, /\{cur\.qtype === 'poll' \? null : \(\s*<Pressable accessibilityRole=\{cur\.qtype === 'single' \? 'radio' : 'checkbox'\}/);
  assert.match(studio, /Câu bình chọn không có đáp án đúng nên không tính điểm/);
  assert.match(read('types', 'studio.ts'), /if \(q\.qtype === 'poll'\) return null; \/\/ bình chọn không có đáp án đúng/);
});

test('video tải lên: tab trong hộp chèn phương tiện, giới hạn khớp máy chủ (8 MB / 5 video), phát bằng thẻ video có đường dẫn tới máy chủ', () => {
  assert.match(studio, /\{ value: 'video' as const, label: 'Tải video lên' \}/);
  assert.match(studio, /testID="media-video-upload"/);
  assert.match(studio, /video: \{ max: 8 \* 1024 \* 1024, types: \['video\/mp4', 'video\/webm'\]/);
  assert.match(media, /url\.startsWith\('\/api\/content\/media\/'\)/);
  assert.match(media, /\{ src: mediaUri\(video\), controls: true/);
  const limits = server('content', 'studio.service.ts');
  if (limits) {
    assert.match(limits, /video: \{ maxBytes: 8 \* 1024 \* 1024, files: 5,/);
    assert.match(limits, /audio: \{ maxBytes: 4 \* 1024 \* 1024, files: 5,/);
  }
});

test('nhạc chờ là tệp tải lên: chọn / tải lên ở giao diện Quiz, giới hạn 4 MB, phát lặp khi giáo viên bấm bật', () => {
  assert.match(studio, /audio: \{ max: 4 \* 1024 \* 1024, types: \['audio\/mpeg', 'audio\/ogg'\]/);
  assert.match(studio, /testID="studio-music-upload"/);
  assert.match(studio, /set\(\{ theme: \{ bg: payload!\.theme\.bg, music: 'upload', music_url: res\.url \} \}\)/);
  assert.match(theme, /track !== 'upload' \|\| !url/);
  assert.match(theme, /el\.loop = true/);
  assert.match(host, /useLobbyMusic\(room\?\.theme\.music, music && room\?\.state === 'lobby', room\?\.theme\.music_url\)/);
  // hook của trình soạn phải nằm trước lệnh return sớm để thứ tự hook không đổi giữa các lần dựng
  assert.ok(studio.indexOf('const files = useLoad<MediaLibrary>') < studio.indexOf('if (!payload) return <Page>'));
});

test('thi đấu: học sinh bấm chọn một lần, kết quả hiện số lượt chọn không tô đúng/sai; giáo viên thấy lượt bình chọn; báo cáo không tính tỉ lệ đúng', () => {
  assert.match(play, /const instant = q\.qtype === 'single' \|\| q\.qtype === 'truefalse' \|\| q\.qtype === 'poll';/);
  assert.match(play, /tone === 'voted' \? 'Cảm ơn em đã bình chọn!'/);
  assert.match(play, /\{r\.poll \? null : <Txt f="semibold" size=\{15\} color=\{c\.ngocChu\}>Đáp án đúng:/);
  assert.match(play, /Kết quả bình chọn: \{it\.votes\.map/);
  assert.match(kit, /revealed=\{!poll\}/);
  assert.match(host, /lượt bình chọn · không có đáp án đúng/);
  assert.match(host, /poll=\{r\.poll\} big/);
  assert.match(manager, /Bình chọn \(không có đáp án đúng\):/);
});

test('trình soạn Quiz: không có hook nào khai báo sau lệnh return sớm (lỗi React #310 làm sập trình soạn khi mở bản nháp)', () => {
  const at = studio.indexOf('if (!payload) return <Page>');
  assert.ok(at > 0, 'không thấy lệnh return sớm');
  const after = studio.slice(at + 1);
  const hooks = [...after.matchAll(/\buse(?:State|Effect|Memo|Callback|Ref|Load|Toast|Theme|Debounced)\s*[<(]/g)].map((m) => m[0]);
  assert.deepEqual(hooks, [], `hook khai báo sau return sớm: ${hooks.join(', ')}`);
});
