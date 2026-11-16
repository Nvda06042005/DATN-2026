/**
 * Nâng cấp Bài học, Ngân hàng câu hỏi, Bộ đề (14/11/2026), học từ các nền tảng giáo dục trong và ngoài nước:
 * mức độ nhận thức (Công văn 7991), tỉ lệ đúng và phân tích phương án (Moodle, Wayground), tạo đề theo ma trận (MobiEdu, McMix),
 * thống kê bộ đề, mục tiêu bài học và xem trước như học sinh (Nearpod).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');

test('ngân hàng câu hỏi: mức độ Biết/Hiểu/Vận dụng ở biểu mẫu, bộ lọc và cột; cột tỉ lệ đúng; thống kê từng phương án trong chi tiết', () => {
  const bank = read('components', 'admin', 'QuestionBank.tsx');
  assert.match(bank, /const LEVEL_OPTIONS = \[\{ value: '1', label: 'Biết' \}, \{ value: '2', label: 'Hiểu' \}, \{ value: '3', label: 'Vận dụng' \}\];/);
  assert.match(bank, /<AdminSelect label="Mức độ nhận thức" value=\{s\.level\} options=\{\[\{ value: '', label: 'Theo độ khó' \}, \.\.\.LEVEL_OPTIONS\]\}/);
  assert.match(bank, /\.\.\.\(s\.level \? \{ cognitive_level: Number\(s\.level\) \} : \{\}\)/);
  assert.match(bank, /filters=\{\[f_qtype, f_campaign, f_store, f_level, f_difficulty, f_rate, f_used, f_owner\]\}/);
  assert.match(bank, /\{ key: 'level', filter: f_level, label: 'Mức độ'/);
  assert.match(bank, /\{ key: 'rate', filter: f_rate, label: 'Tỉ lệ đúng'/);
  assert.match(bank, /\{d\.stats \? <QuestionStatsCard stats=\{d\.stats\} \/> : null\}/);
  assert.match(bank, /testID="question-stats"/);
  assert.match(bank, /lượt làm thử của giáo viên không tính/);
  assert.match(read('types', 'learning.ts'), /export const LEVEL_TEXT: Record<number, string> = \{ 1: 'Biết', 2: 'Hiểu', 3: 'Vận dụng' \};/);
});

test('bộ đề: nút Tạo đề theo ma trận, ô số câu theo chủ đề × mức độ có số câu sẵn có, gợi ý tỉ lệ Công văn 7991; bảng ma trận và thống kê kết quả trong chi tiết', () => {
  const quiz = read('components', 'admin', 'QuizManager.tsx');
  assert.match(quiz, /<Btn icon=\{Table2\} title="Tạo đề theo ma trận" tone="thuy" size="sm" onPress=\{\(\) => setMatrix\(true\)\} testID="quiz-matrix-open" \/>/);
  assert.match(quiz, /api\.quizMatrixStock\(session\.token, store\)/);
  assert.match(quiz, /api\.createQuizFromMatrix\(session\.token, \{ title, store, cells,/);
  assert.match(quiz, /label=\{`\$\{LEVEL_TEXT\[l\]\} \(có \$\{have\}\)`\}/);
  assert.match(quiz, /Gợi ý theo Công văn 7991\/BGDĐT-GDTrH: khoảng 70% Biết \+ Hiểu và 30% Vận dụng/);
  assert.match(quiz, /disabled=\{!total \|\| !title\.trim\(\) \|\| over\.length > 0\}/);
  assert.match(quiz, /\{d\.items\.length \? <QuizMatrixTable items=\{d\.items\} \/> : null\}/);
  assert.match(quiz, /api\.quizStats\(session\.token, id\)/);
  assert.match(quiz, /\{showStats \? <QuizStatsPanel session=\{session\} id=\{d\.id\} \/> : null\}/);
  assert.match(quiz, /Tỉ lệ đúng từng câu \(câu nhiều học sinh sai nhất ở trên\)/);
  const api = read('api', 'learningApi.ts');
  assert.match(api, /`\/api\/content\/quizzes\/matrix\$\{qs\(\{ store \}\)\}`/);
  assert.match(api, /'\/api\/content\/quizzes\/matrix', \{ token, body \}/);
  assert.match(api, /`\/api\/content\/quizzes\/\$\{id\}\/stats`/);
});

// Trang Bài học của quản trị trường đã xóa (14/11/2026); mục tiêu bài học vẫn hiện cho học sinh ở đầu bài
test('bài học: học sinh thấy mục tiêu ở đầu bài', () => {
  const reader = read('components', 'portal', 'LessonReader.tsx');
  assert.match(reader, /export const LessonObjectives: React\.FC<\{ text: string \| null \| undefined \}>/);
  assert.match(reader, /<LessonObjectives text=\{data\.objectives\} \/>/);
});

test('ngân hàng câu hỏi (16/11/2026): cột nào cũng có bộ lọc, xuất PDF, mẫu nhập theo bố cục file danh sách lớp của trường', () => {
  const bank = read('components', 'admin', 'QuestionBank.tsx');
  const table = bank.slice(bank.indexOf('<DataTable<QuestionItem> paginate={false}'), bank.indexOf('<Pager page={page}'));
  const columns = table.match(/\{ key: '[a-z]+'[^\n]*/g) ?? [];
  assert.ok(columns.length >= 9, 'đủ các cột của bảng');
  for (const col of columns) assert.match(col, /filter: f_[a-z]+/, col.slice(0, 40));
  assert.match(bank, /<DownloadButton title="Xuất PDF" fetchBlob=\{\(\) => api\.exportQuestions\(session\.token, filters\)\} filename="ngan-hang-cau-hoi\.pdf" \/>/);
  assert.doesNotMatch(bank, /Xuất Excel|["']cau-hoi\.xlsx|pptx/);
  assert.match(bank, /filename: 'mau-ngan-hang-cau-hoi\.xlsx'/);
  assert.match(bank, /Chỉ nhận file mẫu của trường mình/);
});

test('nội dung đã gửi (16/11/2026): giáo viên dùng hộp thư như Gmail; người duyệt thấy tiêu đề và lời nhắn', () => {
  const box = read('components', 'admin', 'ShareInbox.tsx');
  assert.match(box, /export const ShareInbox: React\.FC<\{ session: Session \}> = \(\{ session \}\) => \(session\.user\.role === 'teacher' \? <SentMailbox session=\{session\} \/> : <ReviewInbox session=\{session\} \/>\);/);
  for (const id of ['mail-list', 'mail-view', 'mail-reply', 'mail-withdraw', 'mail-resend', 'share-compose', 'compose-sheet', 'compose-subject', 'compose-message', 'compose-send', 'compose-discard']) assert.ok(box.includes(`testID="${id}"`), id);
  for (const label of ['Tất cả thư đã gửi', 'Chờ duyệt', 'Đã duyệt', 'Bị từ chối']) assert.ok(box.includes(`label: '${label}'`), label);
  assert.match(box, /<Txt f="bold" size=\{14\} color=\{c\.muc2\} style=\{\{ width: 72 \}\}>Đến<\/Txt>/);
  assert.match(box, /api\.requestShare\(session\.token, entity, attached\.id, 'school', \{ subject: subject\.trim\(\) \|\| fallback, message: message\.trim\(\) \|\| undefined \}\)/);
  assert.match(box, /\{d\.subject \? <Txt f="bold" size=\{16\}>\{d\.subject\}<\/Txt> : null\}/);
  assert.match(read('api', 'learningApi.ts'), /mail\?: \{ subject\?: string; message\?: string \}\) =>\r?\n {2}apiRequest<ShareItem>\('\/api\/content\/shares', \{ token, body: \{ entity, entity_id: entityId, target, \.\.\.mail \} \}\);/);
});
