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
