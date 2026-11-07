// Tiêu đề trang quản trị viết hai nửa đều nhau như tiêu đề ở trang chủ (nửa đầu đậm mực, nửa sau nghiêng đỏ): "Trường | học", "Thống kê | hệ thống".
// Phần chia chạy thật cho mọi tiêu đề cố định của các trang quản trị và vài tiêu đề lấy từ dữ liệu (tên lớp, tên phòng thi, lời chào).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const compiled = ts.transpileModule(fs.readFileSync(path.join(root, 'lib', 'title-split.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new vm.Script(`(function(module,exports){${compiled}\n})`).runInThisContext()(mod, mod.exports);
const { splitTitle } = mod.exports;

test('hai chữ thì mỗi chữ một nửa: "Trường | học", "Bài | học", "Nhật | ký"', () => {
  assert.deepEqual(splitTitle('Trường học'), ['Trường', 'học']);
  assert.deepEqual(splitTitle('Bài học'), ['Bài', 'học']);
  assert.deepEqual(splitTitle('Nhật ký'), ['Nhật', 'ký']);
  assert.deepEqual(splitTitle('Lớp 6A1'), ['Lớp', '6A1']);
});

test('bốn chữ chia hai chữ một nửa: "Thống kê | hệ thống", "Ngân hàng | câu hỏi", "Yêu cầu | hỗ trợ"', () => {
  assert.deepEqual(splitTitle('Thống kê hệ thống'), ['Thống kê', 'hệ thống']);
  assert.deepEqual(splitTitle('Ngân hàng câu hỏi'), ['Ngân hàng', 'câu hỏi']);
  assert.deepEqual(splitTitle('Yêu cầu hỗ trợ'), ['Yêu cầu', 'hỗ trợ']);
  assert.deepEqual(splitTitle('Thi đấu trực tiếp'), ['Thi đấu', 'trực tiếp']);
  assert.deepEqual(splitTitle('AI Tutor “Tiểu Tướng”'), ['AI Tutor', '“Tiểu Tướng”']);
});

test('số chữ lẻ: nửa đầu lấy phần lớn hơn (danh từ chính đứng đầu), không cắt đôi từ ghép', () => {
  assert.deepEqual(splitTitle('Khảo sát trải nghiệm'), ['Khảo sát', 'trải nghiệm']);
  assert.deepEqual(splitTitle('Thống kê lớp'), ['Thống kê', 'lớp']);
  assert.deepEqual(splitTitle('Trợ lý AI'), ['Trợ lý', 'AI']);
  assert.deepEqual(splitTitle('Kho dữ liệu lịch sử'), ['Kho dữ liệu', 'lịch sử']);
});

test('có từ nối (và, của, trong, toàn…) thì chia ngay trước từ nối', () => {
  assert.deepEqual(splitTitle('Báo cáo của trường'), ['Báo cáo', 'của trường']);
  assert.deepEqual(splitTitle('Trò chơi hóa của trường'), ['Trò chơi hóa', 'của trường']);
  assert.deepEqual(splitTitle('Trò chơi hóa trong lớp'), ['Trò chơi hóa', 'trong lớp']);
  assert.deepEqual(splitTitle('Trường và năm học'), ['Trường', 'và năm học']);
  assert.deepEqual(splitTitle('Người dùng toàn hệ thống'), ['Người dùng', 'toàn hệ thống']);
  assert.deepEqual(splitTitle('Mô phỏng trận đánh và mini-game'), ['Mô phỏng trận đánh', 'và mini-game']);
  assert.deepEqual(splitTitle('Hướng dẫn và câu hỏi thường gặp'), ['Hướng dẫn', 'và câu hỏi thường gặp']);
});

test('từ đầu là từ mượn còn từ sau là tiếng Việt thì chia sau từ đầu; tiêu đề từ dữ liệu có dấu phẩy hoặc hai chấm chia sau dấu đó', () => {
  assert.deepEqual(splitTitle('Game thẻ tướng'), ['Game', 'thẻ tướng']);
  assert.deepEqual(splitTitle('Quiz Kahoot'), ['Quiz', 'Kahoot']);
  // tiếng Việt viết không dấu không bị nhận nhầm là từ mượn
  assert.deepEqual(splitTitle('Thi đấu trực tiếp'), ['Thi đấu', 'trực tiếp']);
  assert.deepEqual(splitTitle('Kho dữ liệu lịch sử'), ['Kho dữ liệu', 'lịch sử']);
  assert.deepEqual(splitTitle('Xin chào, Nguyễn Văn A'), ['Xin chào,', 'Nguyễn Văn A']);
  assert.deepEqual(splitTitle('Báo cáo: Ôn tập chương 2'), ['Báo cáo:', 'Ôn tập chương 2']);
});

test('một chữ thì không có nửa sau; chuỗi rỗng và khoảng trắng thừa không gây lỗi', () => {
  assert.deepEqual(splitTitle('Bộ đề'), ['Bộ', 'đề']);
  assert.deepEqual(splitTitle('Thông'), ['Thông', '']);
  assert.deepEqual(splitTitle('  Nhật   ký  '), ['Nhật', 'ký']);
  assert.deepEqual(splitTitle(''), ['', '']);
});
