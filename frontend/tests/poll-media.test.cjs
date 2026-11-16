// 16/11/2026: trình soạn "Quiz (Kahoot-style)" đã xóa hẳn; giữ phần bình chọn và phương tiện của phòng thi đấu trực tiếp.
// HK.GV.088 (câu "Bình chọn" không có đáp án đúng), HK.GV.092 (video tải lên), HK.GV.093 (nhạc chờ là tệp tải lên).
// Các thành phần dùng React Native nên không nạp được trong Node: đọc thẳng mã nguồn và kiểm tra các mắt xích nối nhau; hằng số giới hạn được đối chiếu với máy chủ.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');
const host = read('components', 'admin', 'LiveHost.tsx');
const manager = read('components', 'admin', 'LiveManager.tsx');
const kit = read('components', 'portal', 'LiveKit.tsx');
const media = read('components', 'portal', 'Media.tsx');
const theme = read('components', 'portal', 'LiveTheme.tsx');
const types = read('types', 'learning.ts') + read('types', 'live.ts') + read('types', 'media.ts');
const server = (...p) => { const f = path.join(__dirname, '..', '..', 'backend', 'src', ...p); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null; };

test('kiểu dữ liệu có loại "poll" ở câu hỏi, trình soạn và kết quả thi đấu', () => {
  assert.match(types, /export type QType = 'single' \| 'multiple' \| 'truefalse' \| 'fill' \| 'order' \| 'map' \| 'poll'/);
  assert.match(types, /poll\?: boolean; prompt: string; explanation: string \| null; answer_key: QData; skipped: boolean; last: boolean;/);
  assert.match(types, /music_url\?: string/);
  assert.match(types, /videos: UploadedFile\[\]; audios: UploadedFile\[\]/);
});

test('video tải lên: giới hạn ở máy chủ (8 MB / 5 video), phát bằng thẻ video có đường dẫn tới máy chủ', () => {
  assert.match(media, /url\.startsWith\('\/api\/content\/media\/'\)/);
  assert.match(media, /\{ src: mediaUri\(video\), controls: true/);
  const limits = server('content', 'studio.service.ts');
  if (limits) {
    assert.match(limits, /video: \{ maxBytes: 8 \* 1024 \* 1024, files: 5,/);
    assert.match(limits, /audio: \{ maxBytes: 4 \* 1024 \* 1024, files: 5,/);
  }
});

test('nhạc chờ là tệp tải lên: phát lặp khi giáo viên bấm bật ở phòng thi', () => {
  assert.match(theme, /track !== 'upload' \|\| !url/);
  assert.match(theme, /el\.loop = true/);
  assert.match(host, /useLobbyMusic\(room\?\.theme\.music, music && room\?\.state === 'lobby', room\?\.theme\.music_url\)/);
});

// màn hình thi đấu phía học sinh (LivePlay.tsx) đã xóa cùng giao diện trang học sinh ngày 15/11/2026; giữ phần giáo viên
test('thi đấu: kết quả bình chọn không tô đúng/sai; giáo viên thấy lượt bình chọn; báo cáo không tính tỉ lệ đúng', () => {
  assert.match(kit, /revealed=\{!poll\}/);
  assert.match(host, /lượt bình chọn · không có đáp án đúng/);
  assert.match(host, /poll=\{r\.poll\} big/);
  assert.match(manager, /Bình chọn \(không có đáp án đúng\):/);
});

