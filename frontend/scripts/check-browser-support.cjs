#!/usr/bin/env node
/**
 * Kiểm tra bản build web (dist/) còn chạy được trên trình duyệt cũ (17/11/2026, sau lỗi "máy tôi chạy được, máy người khác thiếu chức năng").
 * Mức hỗ trợ: Chrome 80+ (gồm Windows 7/8.1 – Chrome 109), Safari 14.1+ (iOS 14.5+), Firefox 75+.
 *  1. Cú pháp: mọi tệp JavaScript phải phân tích được ở mức ES2022 và không dùng cú pháp Safari 15 chưa hiểu (khối `static {}`, tên riêng `#x`,
 *     regex nhìn lùi `(?<=` / `(?<!`, cờ regex `d` / `v`). Cú pháp không vá được bằng polyfill: gặp là cả trang trắng trên máy cũ.
 *  2. Hàm mới: bản build gọi hàm mới hơn mức hỗ trợ thì hàm đó phải có trong `lib/polyfills.ts`; hàm không vá được thì phải gỡ / thay.
 * Chạy: `npm run check:browsers` (sau `npm run build`). CI chạy bước này ở job Frontend.
 */
const fs = require('node:fs');
const path = require('node:path');
const acorn = require('acorn');

const root = path.resolve(process.argv[2] || 'dist');
const polyfills = fs.readFileSync(path.join(__dirname, '..', 'lib', 'polyfills.ts'), 'utf8');

/** Hàm mới hơn mức hỗ trợ: [mẫu tìm trong bản build, tên trong polyfills.ts (null = không vá được), có từ] */
const MODERN = [
  [/\.toSpliced\(/, "'toSpliced'", 'Chrome 110 / Safari 16'],
  [/\.toSorted\(/, "'toSorted'", 'Chrome 110 / Safari 16'],
  [/\.toReversed\(/, "'toReversed'", 'Chrome 110 / Safari 16'],
  [/\.findLastIndex\(/, "'findLastIndex'", 'Chrome 97 / Safari 15.4'],
  [/\.findLast\(/, "'findLast'", 'Chrome 97 / Safari 15.4'],
  [/\.at\(-/, "'at'", 'Chrome 92 / Safari 15.4'],
  [/Object\.hasOwn\(/, "'hasOwn'", 'Chrome 93 / Safari 15.4'],
  [/\.replaceAll\(/, "'replaceAll'", 'Chrome 85 / Safari 13.1'],
  [/\brequestIdleCallback\b/, 'requestIdleCallback', 'Chrome 47 / Safari: chưa có'],
  [/crypto\.randomUUID\b/, "'randomUUID'", 'Chrome 92 / Safari 15.4'],
  [/Promise\.withResolvers\b/, "'withResolvers'", 'Chrome 119 / Safari 17.4'],
  [/\bstructuredClone\(/, null, 'Chrome 98 / Safari 15.4'],
  [/Object\.groupBy\(|Map\.groupBy\(/, null, 'Chrome 117 / Safari 17.4'],
  [/Array\.fromAsync\(/, null, 'Chrome 121 / Safari 16.4'],
  [/AbortSignal\.(timeout|any)\(/, null, 'Chrome 103–116 / Safari 16–17.4'],
  [/Intl\.Segmenter\b/, null, 'Chrome 87 / Safari 14.1 (chỉ cảnh báo nếu có kiểm tra trước)'],
  [/\.(isWellFormed|toWellFormed)\(/, null, 'Chrome 111 / Safari 16.4'],
  [/\.(symmetricDifference|isSubsetOf|isSupersetOf|isDisjointFrom)\(/, null, 'Chrome 122 / Safari 17'],
];

function* jsFiles(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* jsFiles(p);
    else if (e.name.endsWith('.js')) yield p;
  }
}

if (!fs.existsSync(root)) {
  console.error(`Không thấy thư mục bản build: ${root}. Chạy "npm run build" trước.`);
  process.exit(1);
}
const problems = [];
const files = [...jsFiles(root)];
for (const file of files) {
  const rel = path.relative(root, file);
  const src = fs.readFileSync(file, 'utf8');
  const at = (pos) => src.slice(Math.max(0, pos - 60), pos + 40).replace(/\s+/g, ' ');
  try {
    acorn.parse(src, {
      ecmaVersion: 2022, sourceType: 'script', allowHashBang: true, allowReturnOutsideFunction: true,
      onToken: (t) => {
        if (t.type.label === 'privateId') problems.push(`${rel}: tên riêng #${t.value} (Safari 15) …${at(t.start)}…`);
        if (t.type.label === 'regexp' && /\(\?<[=!]/.test(t.value.pattern)) problems.push(`${rel}: regex nhìn lùi (Safari 16.4) …${at(t.start)}…`);
        if (t.type.label === 'regexp' && /[dv]/.test(t.value.flags)) problems.push(`${rel}: cờ regex ${t.value.flags} (Safari 15) …${at(t.start)}…`);
      },
    });
  } catch (e) {
    problems.push(`${rel}: cú pháp mới hơn ES2022 – ${e.message} …${at(e.pos ?? 0)}…`);
    continue;
  }
  for (const m of src.matchAll(/\bstatic\s*\{/g)) problems.push(`${rel}: khối static {} (Safari 16.4) …${at(m.index)}…`);
  for (const [re, name, since] of MODERN) {
    const m = src.match(re);
    if (!m) continue;
    if (name && polyfills.includes(name)) continue;
    problems.push(`${rel}: dùng ${m[0]} (có từ ${since}) – ${name ? `thêm ${name} vào lib/polyfills.ts` : 'không vá được bằng polyfill: gỡ hoặc thay'}`);
  }
}

if (problems.length) {
  console.error(`Bản build có ${problems.length} chỗ không chạy được trên trình duyệt cũ (Chrome 80+, Safari 14.1+):`);
  for (const p of problems.slice(0, 40)) console.error(' - ' + p);
  process.exit(1);
}
console.log(`Đã kiểm tra ${files.length} tệp JavaScript: chạy được trên Chrome 80+ (Windows 7/8.1), Safari 14.1+ (iOS 14.5+), Firefox 75+.`);
