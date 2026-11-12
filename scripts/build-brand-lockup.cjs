#!/usr/bin/env node
/**
 * Dựng backend/assets/brand/dong-a-edu-lockup.png: logo ngang giống thanh đầu trang (biểu tượng chiến binh cầm cờ + chữ "Đông A edu" gốc),
 * dùng đầu các file Excel (mẫu nhập và danh sách giáo viên). Excel không nhúng được phông chữ riêng, nên chữ của logo được vẽ sẵn thành ảnh.
 *
 * Nguồn: frontend/assets/logo-mark.png (biểu tượng) và đường nét chữ ở frontend/constants/brand.ts (vẽ từ logo.jpg của chủ dự án, không dùng phông thay thế).
 * Màu và tỉ lệ lấy theo components/art.tsx (BrandLogo) và constants/theme.ts (logoInk, logoRed, sonSang).
 *
 * Chạy: node scripts/build-brand-lockup.cjs   (cần Chrome; đặt CHROME nếu không ở đường dẫn mặc định)
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const ts = require(path.join(root, 'frontend', 'node_modules', 'typescript'));
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
const load = (file) => {
  const m = { exports: {} };
  new Function('module', 'exports', ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(m, m.exports);
  return m.exports;
};
const brand = load('frontend/constants/brand.ts');

// kích thước hiển thị (px) khi mở trong Excel; ảnh vẽ ở SCALE lần để nét trên màn hình độ phân giải cao
const SCALE = 3;
const MARK = 56;                       // biểu tượng vuông bo góc (thanh đầu trang: 44 px, bo 12)
const GAP = 13;
const WORD_H = 36;                     // chữ (thanh đầu trang: cao 28 px)
const WORD_W = Math.round((WORD_H * brand.BRAND_WIDTH) / brand.BRAND_HEIGHT);
const W = MARK + GAP + WORD_W;
const H = MARK;
const INK = '#23382f', RED = '#b53520', RED_LIGHT = '#ff6a5a';

const mark = `data:image/png;base64,${fs.readFileSync(path.join(root, 'frontend', 'assets', 'logo-mark.png')).toString('base64')}`;
const html = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:transparent}body{width:${W}px;height:${H}px;display:flex;align-items:center;gap:${GAP}px}
img{width:${MARK}px;height:${MARK}px;border-radius:${Math.round((MARK * 12) / 44)}px;display:block}svg{display:block}</style>
<img src="${mark}"><svg width="${WORD_W}" height="${WORD_H}" viewBox="0 0 ${brand.BRAND_WIDTH} ${brand.BRAND_HEIGHT}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${RED}"/><stop offset="1" stop-color="${RED_LIGHT}"/></linearGradient></defs>
<path d="${brand.BRAND_INK}" fill="${INK}" fill-rule="evenodd"/><path d="${brand.BRAND_SWASH}" fill="url(#g)" fill-rule="evenodd"/></svg>`;

const tmp = fs.mkdtempSync(path.join(process.env.TEMP || os.tmpdir(), 'lockup-'));
const page = path.join(tmp, 'lockup.html');
fs.writeFileSync(page, html);
const outFile = path.join(root, 'backend', 'assets', 'brand', 'dong-a-edu-lockup.png');
fs.mkdirSync(path.dirname(outFile), { recursive: true });
const chrome = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const shot = path.join(tmp, 'lockup.png');
const r = spawnSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000', `--force-device-scale-factor=${SCALE}`, `--window-size=${W},${H}`, `--user-data-dir=${path.join(tmp, 'profile')}`, `--screenshot=${shot}`, `file:///${page.replace(/\\/g, '/')}`], { encoding: 'utf8', timeout: 60000, windowsHide: true });
if (!fs.existsSync(shot)) { console.error('Không chụp được ảnh logo', r.stderr); process.exit(1); }
fs.copyFileSync(shot, outFile);
const png = fs.readFileSync(outFile);
console.log(`đã ghi ${path.relative(root, outFile)}: ${png.readUInt32BE(16)}x${png.readUInt32BE(20)} px, ${png.length} byte; hiển thị ${W}x${H} px`);
fs.rmSync(tmp, { recursive: true, force: true });
