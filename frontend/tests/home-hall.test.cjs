/**
 * Trang chủ 27/11/2026 (người dùng gửi ảnh các chỗ sửa): các khối lấy từ sảnh nhánh feat/giao_dien_hs_than_thien nằm đúng chỗ, khối "Các vị vua thời Trần"
 * đã xóa và mục "Danh tướng" trỏ tới khu Bậc danh hiệu / Nhân vật thời Trần (mở sẵn thẻ Nhân vật), thứ tự menu trùng thứ tự trên trang,
 * khu trưng bày + Bảng vàng theo tông logo, rèm Bảng vàng khép / mở, bản đồ minh họa chỉ ở trang chủ, Bảng vàng công khai là ví dụ.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
const exists = (...p) => fs.existsSync(path.join(root, ...p));

test('thứ tự khối trang chủ và neo "danh-tuong"; khối Các vị vua thời Trần đã xóa', () => {
  const home = read('components', 'home.tsx');
  const body = home.slice(home.indexOf('export const HomeSections'));
  const order = ['<PhaseCampaignGallery', '<TrangNguyenSection', '<HomeVideo', '<ShowcaseSection', 'id="danh-tuong"', '<TranShowcase initial="ranks"', '<BoardStage', '<ExplorerSection', '<QuotesSection', '<ClosingSection'];
  let at = -1;
  for (const tag of order) {
    const i = body.indexOf(tag);
    assert.ok(i > at, `${tag} phải nằm sau khối trước`);
    at = i;
  }
  assert.match(body, /<View id="danh-tuong" onLayout=\{\(e\) => onSection\('danh-tuong', e\.nativeEvent\.layout\.y\)\} style=\{ANCHOR\}>/);
  assert.ok(!home.includes('CastSection') && !home.includes('title="Các vị vua"'), 'không còn khối Các vị vua thời Trần');
  assert.equal((body.match(/<TranShowcase /g) || []).length, 1, 'chỉ một khu trưng bày');
  assert.ok(!home.includes('HeroGallery'), 'không còn lưới ảnh tượng');
  for (const f of [['components', 'hero-gallery.tsx'], ['components', 'hero-photo.tsx'], ['components', 'lore-chip.tsx'], ['constants', 'hero-photos.ts'], ['assets', 'hero-photos']]) assert.ok(!exists(...f), `${f.join('/')} đã xóa`);
});

test('thanh điều hướng: thứ tự trùng trang, "Danh tướng" mở thẻ Nhân vật rồi cuộn tới khu trưng bày', () => {
  const home = read('components', 'home.tsx');
  const nav = home.slice(home.indexOf('export const NAV'), home.indexOf('] as const;', home.indexOf('export const NAV')));
  const ids = [...nav.matchAll(/id: '([a-z-]+)'/g)].map((m) => m[1]);
  assert.deepEqual(ids, ['kham-pha', 'danh-tuong', 'khang-chien', 'cach-hoat-dong', 'cau-hoi']);
  const foot = home.slice(home.indexOf('const FOOT_LINKS'), home.indexOf('];', home.indexOf('const FOOT_LINKS')));
  assert.deepEqual([...foot.matchAll(/id: '([a-z-]+)'/g)].map((m) => m[1]), ['home', 'kham-pha', 'danh-tuong', 'khang-chien', 'cach-hoat-dong', 'cau-hoi']);
  const index = read('app', 'index.tsx');
  assert.match(index, /import \{ openShowcaseTab \} from '@\/components\/home-hall';/);
  assert.match(index, /if \(id === 'danh-tuong'\) openShowcaseTab\('heroes'\);/);
  assert.match(read('components', 'home-hall.tsx'), /export function openShowcaseTab\(mode: ShowcaseMode\): void/);
});

test('khu trưng bày và Bảng vàng theo tông logo; rèm khép / mở; hiệu ứng đứng yên khi giảm chuyển động', () => {
  const hall = read('components', 'home-hall.tsx');
  for (const color of ["ink: '#23382f'", "red: '#b53520'", "gold: '#dfb66f'", "paper: '#faf4e7'"]) assert.ok(hall.includes(color), `có màu logo ${color}`);
  for (const old of ['#3a0f44', '#061636', '#d9532e', '#ee8a4a', 'StageBackdrop']) assert.ok(!hall.includes(old), `bỏ màu / phông cũ ${old}`);
  assert.match(hall, /testID="home-board-curtain-left"/);
  assert.match(hall, /testID="home-board-curtain-right"/);
  // đổi Tuần / Tháng / Từ đầu: khép (về 0) rồi mới thay bảng và mở (về 1)
  assert.match(hall, /Animated\.timing\(open, \{ toValue: 0,[^]*?setShown\(p\);\s*Animated\.timing\(open, \{ toValue: 1/);
  assert.match(hall, /if \(reduce\) \{ open\.setValue\(1\); opened\.current = true;/);
  assert.match(hall, /const live = seen && onScreen && !reduce;/);
  assert.match(hall, /testID="home-cast-stage"/);
});

test('bản đồ minh họa chỉ ở trang chủ; trang học sinh vẫn dùng bản đồ gốc Wikipedia', () => {
  const home = read('components', 'home.tsx');
  for (const n of [1, 2, 3]) {
    assert.match(home, new RegExp(`require\\('\\.\\./assets/ban-do-minh-hoa-${n}\\.jpg'\\)`));
    assert.ok(exists('assets', `ban-do-minh-hoa-${n}.jpg`));
    assert.match(read('components', 'portal', 'SagaKit.tsx'), new RegExp(`ban-do-khang-chien-${n}\\.webp`));
  }
  assert.ok(!/require\('\.\.\/assets\/ban-do-khang-chien-/.test(home), 'trang chủ không còn dùng bản đồ gốc');
  assert.match(home, /không theo tỉ lệ/);
});

test('Bảng vàng trên trang công khai là ví dụ, không gọi API xếp hạng; nhân vật dùng HERO_PROFILE', () => {
  const hall = read('components', 'home-hall.tsx');
  assert.ok(!/apiRequest|leaderboard|saga-api|game-api/.test(hall), 'không gọi API từ trang chủ');
  assert.match(hall, /Ví dụ minh họa/);
  assert.match(hall, /Biệt danh trong bảng là ví dụ/);
  assert.match(hall, /import \{ HERO_PROFILE \} from '@\/constants\/heroes'/);
  assert.ok(!/Diên Hồng \(1284\)/.test(hall.slice(hall.indexOf('const CAST'))), 'dữ liệu nhân vật không ghi Hội nghị Diên Hồng năm 1284');
  assert.match(hall, /Hoàn thành chiến dịch Khối 9 và đạt đủ sao ở cả bốn khối/);
  assert.ok(!read('components', 'portal', 'HallMedia.ts').includes('HALL_CHARACTERS'), 'bỏ danh sách nhân vật cũ không còn dùng');
});

test('nền khung video là tranh bàn kế trận Bạch Đằng; lời mời cuối trang là tranh pixel', () => {
  const video = read('components', 'home-video.tsx');
  assert.match(video, /HALL_ART\.bachDangPlan/);
  assert.ok(!video.includes('LogoBackdrop'));
  const home = read('components', 'home.tsx');
  assert.match(home, /require\('\.\.\/assets\/loi-moi-bach-dang\.jpg'\)/);
  assert.ok(exists('assets', 'loi-moi-bach-dang.jpg'));
  const closing = home.slice(home.indexOf('const ClosingSection'));
  assert.ok(!closing.slice(0, 1200).includes('FilmBackdrop'), 'lời mời cuối trang không còn ảnh bìa điện ảnh');
});
