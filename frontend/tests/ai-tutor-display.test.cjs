/**
 * Hiển thị câu trả lời của trợ lý AI (đánh giá 14/11/2026): chữ nghiêng *…* giữa câu không còn lộ dấu *; **đậm** và `mã` hiện đậm;
 * hồ sơ học tập (độ hiểu bài) chỉ hiện khi máy chủ gửi kèm (máy chủ chỉ gửi cho học sinh).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const src = fs.readFileSync(path.join(__dirname, '..', 'components', 'portal', 'TieuTuong.tsx'), 'utf8');

test('bộ tách định dạng: đậm, nghiêng giữa câu, mã; dấu ** lẻ bị bỏ', () => {
  const m = /cleaned\.split\((\/.+\/g)\)/.exec(src);
  assert.ok(m, 'renderFormattedInline phải tách theo một biểu thức chính quy');
  const re = eval(m[1]);
  const parts = "về hỏi kế sách: *'Nên đánh hay nên hòa?'*. (Độ hiểu bài: `30%` ➔ **`32%`** — *Cần củng cố*). Hô **'ĐÁNH!'** rung".split(re).filter(Boolean);
  assert.deepEqual(parts, ['về hỏi kế sách: ', "*'Nên đánh hay nên hòa?'*", '. (Độ hiểu bài: ', '`30%`', ' ➔ ', '**`32%`**', ' — ', '*Cần củng cố*', '). Hô ', "**'ĐÁNH!'**", ' rung']);
  // gạch đầu dòng "* mục" không bị coi là chữ nghiêng
  assert.deepEqual('* mục một'.split(re).filter(Boolean), ['* mục một']);
  assert.match(src, /style=\{\{ fontStyle: 'italic' \}\}/);
  assert.match(src, /part\.replace\(\/\\\*\\\*\/g, ''\)/);
});

// Gemma 4 trên GPU máy giáo viên (27/11/2026, người dùng chọn "hiện thu gọn dưới câu trả lời"): phần suy nghĩ đóng sẵn, nằm dưới câu trả lời,
// có ở cả trang Tiểu Tướng (giáo viên) lẫn Hỏi Tiểu Tướng của học sinh; hỏi AI chờ tới 120 giây (Gemma suy nghĩ lâu hơn API cũ)
test('phần suy nghĩ của Gemma: thu gọn dưới câu trả lời, có ở cả hai trang hỏi đáp', () => {
  const saga = fs.readFileSync(path.join(__dirname, '..', 'components', 'portal', 'SagaAsk.tsx'), 'utf8');
  const api = fs.readFileSync(path.join(__dirname, '..', 'api', 'aiApi.ts'), 'utf8');
  const note = src.slice(src.indexOf('export const ThinkingNote'), src.indexOf('export function useWaited'));
  assert.match(note, /useState\(false\)/, 'mặc định thu gọn');
  assert.match(note, /if \(!msg\.thinking\)|!msg\.thinking/, 'không có suy nghĩ thì không hiện gì');
  assert.match(note, /đã suy nghĩ \$\{secs\} giây/);
  assert.match(note, /accessibilityState=\{\{ expanded: open \}\}/);
  for (const file of [src, saga]) {
    const bubble = file.indexOf('<ThinkingNote');
    assert.ok(bubble > 0, 'bong bóng trả lời phải có ThinkingNote');
    assert.ok(file.lastIndexOf('<MarkdownText', bubble) > 0 && file.lastIndexOf('<MarkdownText', bubble) < bubble, 'ThinkingNote nằm sau câu trả lời');
  }
  assert.match(saga, /useWaited\(busy\)/);
  assert.match(api, /aiAsk = [^\n]*timeoutMs: 120_000/);
});
