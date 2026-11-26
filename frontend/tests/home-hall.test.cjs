/**
 * Trang chủ 27/11/2026 (người dùng gửi ảnh 7 chỗ sửa): các khối lấy từ sảnh nhánh feat/giao_dien_hs_than_thien nằm đúng chỗ,
 * bản đồ minh họa chỉ ở trang chủ (trang học sinh giữ bản đồ gốc Wikipedia), Bảng vàng trên trang công khai là ví dụ (không gọi API xếp hạng),
 * nhân vật dùng tiểu sử đã đối chiếu (HERO_PROFILE) và lưới ảnh tượng cũ đã xóa.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
const exists = (...p) => fs.existsSync(path.join(root, ...p));

test('thứ tự khối trang chủ: Chín màn → Muốn làm Trạng nguyên → video → Khám phá → Bậc danh hiệu → Bảng vàng → Ba lần kháng chiến', () => {
  const home = read('components', 'home.tsx');
  const body = home.slice(home.indexOf('export const HomeSections'));
  const order = ['<PhaseCampaignGallery', '<TrangNguyenSection', '<HomeVideo', '<ShowcaseSection', '<TranShowcase initial="ranks"', '<BoardStage', '<ExplorerSection', '<CastSection', '<QuotesSection', '<ClosingSection'];
  let at = -1;
  for (const tag of order) {
    const i = body.indexOf(tag);
    assert.ok(i > at, `${tag} phải nằm sau khối trước`);
    at = i;
  }
  // "Các vị vua thời Trần" giữ tiêu đề, ảnh là khu Nhân vật thời Trần
  assert.match(home, /title="Các vị vua" accent="thời Trần"[^\n]*\n\s*<TranShowcase initial="heroes" framed \/>/);
  assert.ok(!home.includes('HeroGallery'), 'không còn lưới ảnh tượng');
  for (const f of [['components', 'hero-gallery.tsx'], ['components', 'hero-photo.tsx'], ['components', 'lore-chip.tsx'], ['constants', 'hero-photos.ts'], ['assets', 'hero-photos']]) assert.ok(!exists(...f), `${f.join('/')} đã xóa`);
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
  assert.ok(!/Diên Hồng \(1284\)|Diên Hồng năm 1284(?! –)/.test(hall.slice(hall.indexOf('const CAST'))), 'dữ liệu nhân vật không ghi Hội nghị Diên Hồng năm 1284');
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
