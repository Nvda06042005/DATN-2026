// 15/11/2026: trang học sinh được xây dựng lại thành Hành trình Đông A; 25/11/2026: chuyển sang hướng "Binh thư Sát Thát" theo bản vẽ người dùng gửi
// (Doanh trại · Chiến dịch theo khối 6–9 · Binh thư · Tiểu Tướng · Bảng vàng; mỗi chặng 5 bước Quân lệnh → Thám sử → Hội đồng quân sự → Xuất trận → Sử quan).
// Người dùng chọn: giữ thế giới khối 3D làm phần thêm, bỏ sảnh mở đầu, máy tính dùng thanh đầu chữ + bố cục rộng (điện thoại: thanh 5 mục dưới đáy).
// Giao diện cũ (StudentNav, lộ trình học, sảnh mở đầu, cột phải SagaRail…) đã xóa và không được nối lại; API và dữ liệu học sinh giữ nguyên.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
const exists = (...p) => fs.existsSync(path.join(root, ...p));
const walk = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : []));
const code = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('trang học sinh "Binh thư Sát Thát": năm mục chính, URL và đường dẫn cũ, quyền theo lớp, giao diện màu, quản lý phiên', () => {
  const app = read('components', 'portal', 'StudentApp.tsx');
  assert.match(read('app', 'hoc-sinh.tsx'), /<StudentApp session=\{session\} \/>/);
  assert.match(app, /usePortalTab<SagaTab>\(embed \? 'chien-dich' : 'doanh-trai', TABS\)/);
  for (const [id, label] of [['doanh-trai', 'Doanh trại'], ['chien-dich', 'Chiến dịch'], ['binh-thu', 'Binh thư'], ['tieu-tuong', 'Tiểu Tướng'], ['bang-vang', 'Bảng vàng']]) assert.ok(app.includes(`{ id: '${id}', label: '${label}' }`), id);
  assert.match(app, /const TABS: readonly SagaTab\[\] = \['doanh-trai', 'chien-dich', 'binh-thu', 'tieu-tuong', 'bang-vang', 'ho-so', 'cua-hang', 'giao-dien', 'luyen-binh', 'tro-giup', 'lop-hoc', 'nhap-vai'\];/);
  assert.match(app, /const STEPS: readonly SagaStep\[\] = \['quan-lenh', 'tham-su', 'hoi-dong', 'xuat-tran', 'su-quan', 'kham-pha'\];/);
  // đường dẫn cũ (sảnh trang-chu, hoi, bước hoc/luyen/tran/tong-ket, c = cuộc kháng chiến 1–3) chuyển sang mục mới bằng replace
  assert.match(app, /const LEGACY_TAB: Record<string, SagaTab> = \{ 'trang-chu': 'doanh-trai', hoi: 'tieu-tuong', ai: 'tieu-tuong' \};/);
  assert.match(app, /const LEGACY_STEP: Record<string, SagaStep> = \{ hoc: 'tham-su', luyen: 'hoi-dong', tran: 'xuat-tran', 'tong-ket': 'su-quan' \};/);
  assert.match(app, /c: String\(rawC! \+ 5\)/);
  // c là khối 6–9
  assert.match(app, /c: cNo && cNo >= 6 && cNo <= 9 \? cNo : null/);
  // 25/11/2026: bỏ hẳn sảnh mở đầu và năm mục cũ (Câu hỏi ôn tập, Kỳ thi, Tư liệu, Bộ thẻ, Tin nhắn); không còn Khảo sát, nút loa
  for (const gone of ["'trang-chu', 'chien-dich'", 'HallLandingScreen', 'HALL_SECTIONS', 'pendingSection', "'cau-hoi'", "'ky-thi'", "'tu-lieu'", "'bo-the'", "'tin-nhan'", 'StudentExams', 'StudentInbox', 'SagaExtras', "'khao-sat'", '<SurveyCenter', 'sound-toggle', 'Volume2']) assert.ok(!app.includes(gone), gone);
  assert.doesNotMatch(read('components', 'portal', 'SagaKit.tsx'), /'cau-hoi'|'ky-thi'|'tu-lieu'|'bo-the'|'tin-nhan'|'khao-sat'|'trang-chu'/);
  assert.match(app, /useEffect\(\(\) => \{ if \(soundEnabled\(\)\) setSound\(false\); \}, \[\]\);/);
  // chưa vào lớp: chỉ danh sách lớp (đăng ký bằng mã), Hồ sơ, Giao diện, Trợ giúp; lớp đã chọn nhớ theo thẻ trình duyệt, không lưu token
  assert.match(app, /const BEFORE_CLASS: readonly SagaTab\[\] = \['lop-hoc', 'ho-so', 'giao-dien', 'tro-giup'\];/);
  assert.match(app, /const needClass = \(gated \|\| !inClass\) && !BEFORE_CLASS\.includes\(route\.tab\);/);
  assert.match(app, /const body = needClass \|\| route\.tab === 'lop-hoc' \? catalog/);
  assert.doesNotMatch(app, /sessionStorage\?\.setItem\(ENTER_KEY, JSON\.stringify\(\{[^}]*token/);
  // 26/11/2026 (người dùng chọn "Lớp học trước, rồi Doanh trại"): không tự vào lớp; đăng nhập lại (token mới → dấu khác) mở trang Lớp học trước,
  // tải lại trang giữ lớp đang vào; lớp ghi sẵn của ứng dụng gốc (không có dấu) vẫn nhận; vào lớp xong giữ đường dẫn tới thẳng mục / chặng
  assert.doesNotMatch(app, /const first = myClasses\.data\.find|leftClass/);
  assert.match(app, /JSON\.stringify\(\{ user, classId, login \}\)/);
  assert.match(app, /v\.login === undefined \|\| v\.login === login/);
  assert.match(app, /const afterEnter = \(\): void => \{ if \(route\.tab === 'lop-hoc'\) pick\('doanh-trai'\); \};/);
  assert.match(read('components', 'portal', 'SagaHome.tsx'), /onPress=\{\(\) => nav\.go\('lop-hoc'\)\} accessibilityRole="link" accessibilityLabel="Đổi lớp: mở trang Lớp học"/);
  // các màn của từng mục / bước
  for (const screen of ['HomeScreen', 'CampaignScreen', 'OrderScreen', 'ThamSuScreen', 'HoiDongScreen', 'ExploreScreen', 'BattleScreen', 'SuQuanScreen', 'BinhThuScreen', 'AskScreen', 'BoardScreen', 'ProfileScreen', 'ShopScreen', 'ThemeScreen', 'LuyenBinhScreen', 'RolePlayScreen', 'HelpPage']) assert.ok(app.includes(`<${screen} `), screen);
  assert.match(app, /saga\.home\(session\.token\)/);
  // một màn chơi chạy tại một thời điểm: màn ẩn dưới màn khác gỡ hết nội dung
  assert.match(app, /const focused = useIsFocused\(\);/);
  assert.match(app, /if \(!focused\) return <View style=\{\{ flex: 1 \}\} testID="student-app-hidden" \/>;/);
  assert.match(app, /if \(mode === 'params'\) \{ router\.setParams\(/);
  assert.match(app, /router\.replace\(\{ pathname, params:/);
  // màn "Lên cấp" / chúc mừng không chen ngang bước đang chơi và không chồng lên màn nhận thưởng; mốc chuỗi ngày báo bằng thông báo ngắn
  assert.match(app, /const midStep = route\.v !== null && route\.v !== 'su-quan' && route\.v !== 'quan-lenh';/);
  assert.match(app, /\{levelUp && !reward \? \(/);
  assert.match(app, /Chuỗi \$\{String\(pl\.milestone\)\} ngày!/);
  assert.match(app, /platform\.prefs\(session\.token\)/);
  // giao diện màu chỉ trong trang học sinh: bảng màu dùng chung theo giao diện đang dùng, không đổi ThemeContext của các cổng khác
  assert.match(app, /<AdminUiContext\.Provider value=\{false\}>/);
  assert.match(app, /<ThemeContext\.Provider value=\{\{ c: palette, dark: bt\.dark \}\}>/);
  assert.match(app, /<BtProvider value=\{bt\}>/);
  assert.match(app, /const bt = themeOf\(picked \?\? serverTheme \?\? stored\);/);
  // Tài khoản (họ tên, ảnh, mật khẩu, đăng xuất) mở từ Hồ sơ
  for (const text of ['<ProfileSheet ', 'session.changePassword()', 'session.logout()', 'authApi.getProfile(session.token)', 'authApi.updateProfile(session.token, patch)', 'authApi.uploadAvatar(session.token, img)']) assert.ok(app.includes(text), text);
  // khung: điện thoại có thanh 5 mục dưới đáy (biểu tượng + chữ), máy tính có thanh đầu chữ; không menu trái, không ngăn kéo menu
  const shell = read('components', 'portal', 'StudentWorkspace.tsx');
  for (const text of ['testID="student-tabbar"', 'testID={`student-tab-${it.id}`}', 'testID="student-topbar"', 'testID="student-tabs"', 'testID={`student-nav-${it.id}`}', 'testID="student-profile-open"', 'testID="student-logout"', 'role="navigation"', 'accessibilityRole="link"', '<BrandLogo ', "aria-current={on ? 'page' : undefined}"]) assert.ok(shell.includes(text), text);
  for (const gone of ['student-sidebar', 'student-menu-toggle', '<Modal', 'setMenu(', 'homeMenu', 'student-home-menu']) assert.ok(!shell.includes(gone), gone);
  assert.match(shell, /const ICONS: Record<string, IconType> = \{ 'doanh-trai': House, 'chien-dich': Flag, 'binh-thu': Layers, 'tieu-tuong': MessageSquareText, 'bang-vang': Trophy \};/);
  assert.match(app, /const NO_TABBAR: readonly SagaTab\[\] = \['ho-so', 'cua-hang', 'giao-dien', 'luyen-binh'\];/);
  assert.match(app, /const tabBar = !needClass && route\.v === null && !NO_TABBAR\.includes\(route\.tab\) && navItems\.length > 0;/);
  // trang Lớp học trước khi vào lớp: điện thoại có thanh gọn (logo, Hồ sơ, Đăng xuất) để không bị kẹt
  assert.match(app, /phoneBar=\{needClass\}/);
  assert.ok(shell.includes('testID="student-phonebar"'), 'student-phonebar');
  assert.match(read('components', 'portal', 'StudentDesign.tsx'), /paddingBottom: phone && tabBar \? 108 : 40/);
  assert.doesNotMatch(read('components', 'portal', 'NoticeCenter.tsx'), /label: 'Tối'/);
  assert.match(read('lib', 'saga-sound.ts'), /let enabled = false;/);
  for (const old of ['StudentNav', 'LearningPath', 'QuestMap', 'ClassTab', 'LiveTab', 'WarPlay', 'GameTabs', 'AiHubDashboard', 'đang được xây dựng lại', 'SagaRail', 'StudentHall']) assert.doesNotMatch(app, new RegExp(old), old);
});

test('đã xóa các tệp giao diện cũ của học sinh; giữ phần dùng chung; có đủ tệp của "Binh thư Sát Thát"', () => {
  const gone = ['BattleKit', 'Celebrations', 'ClassTab', 'DemoActivityPlayer', 'DuolingoRightPanel', 'GameTabs', 'LearnerHome', 'LearningPath', 'LearningSections', 'LessonSteps', 'LivePlay', 'LiveTab', 'MiniGames', 'PathNodePopover', 'Progress', 'QuestMap', 'StudentNav', 'StudyPlan', 'WarCards', 'WarPlay', 'SagaExtras', 'StudentHall', 'SagaRail'];
  for (const f of gone) assert.ok(!exists('components', 'portal', `${f}.tsx`), f);
  for (const f of ['learning-path.ts', 'learning-path-demo.ts', 'scholar-rank.ts']) assert.ok(!exists('lib', f), f);
  const kept = ['TieuTuong', 'QuizPlayer', 'LiveKit', 'LessonReader', 'Library', 'NoticeCenter', 'HelpCenter', 'Media', 'LiveTheme', 'MapGraph', 'GameKit', 'LessonCelebrationView', 'PathArt', 'SandTableView', 'TeacherApp', 'StudentClasses', 'StudentArt'];
  for (const f of kept) assert.ok(exists('components', 'portal', `${f}.tsx`), f);
  for (const f of ['SagaKit', 'SagaHome', 'SagaLearn', 'SagaPlay', 'SagaLook', 'SagaChest', 'SagaAsk', 'StudentDesign', 'StudentWorkspace', 'GameViewport', 'GameViewport.web']) assert.ok(exists('components', 'portal', `${f}.tsx`), f);
  // 21/11/2026: bước nhập vai là thế giới khối 3D (world3d.ts); cảnh nhập vai 2D (explore-scene.ts) đã xóa theo yêu cầu
  for (const f of ['index.ts', 'bridge.ts', 'pixel.ts', 'world3d.ts', 'tactics-scene.ts', 'bachdang-scene.ts']) assert.ok(exists('game', f), f);
  assert.ok(!exists('game', 'explore-scene.ts'), 'explore-scene.ts');
});

test('Doanh trại, Chiến dịch theo khối, Quân lệnh, Bảng vàng: số liệu và phần thưởng từ máy chủ, hòm báu, bản đồ gốc giữ làm kiểu xem', () => {
  const home = read('components', 'portal', 'SagaHome.tsx');
  for (const name of ['HomeScreen', 'CampaignScreen', 'OrderScreen', 'BoardScreen', 'RolePlayScreen']) assert.match(home, new RegExp(`export const ${name}: React\\.FC`), name);
  // Doanh trại: chặng đang học với 5 vạch bước và nút đi tiếp, nhiệm vụ hôm nay, gợi ý Luyện binh riêng của Tiểu Tướng, chiến dịch của khối, chuỗi ngày
  for (const id of ['home-greet', 'home-stats', 'home-next', 'home-continue', 'home-quests', 'home-suggest', 'home-grade', 'home-streak-card']) assert.ok(home.includes(`testID="${id}"`), id);
  assert.match(home, /<StepDots states=\{stepDots\(next\.steps\)\}/);
  assert.match(home, /nav\.go\('luyen-binh'\)/);
  // Chiến dịch: bốn tab khối, dải tối của khối, danh sách chặng có hòm báu xen giữa; khối cao hơn lớp em vẫn xem trước được
  for (const id of ['grade-tab', 'grade-header', 'grade-stages', 'campaign-view', 'campaign-world', 'campaign-roleplay']) assert.ok(home.includes(`testID="${id}"`), id);
  assert.match(home, /const data = useLoad<GradeView>\(session, \(tk\) => saga\.grade\(tk, g\), \[g\]\);/);
  assert.match(home, /testID=\{`stage-\$\{st\.code\}`\}/);
  assert.match(home, /testID=\{`chest-\$\{box\.key\}`\}/);
  assert.match(home, /v\.chests\.filter\(\(c\) => c\.after === i \+ 1\)/);
  assert.match(home, /Em vẫn xem trước được các chặng\./);
  // hòm báu: máy chủ mở, thưởng một lần; màn mở rương kiểu game, công bố tỉ lệ, không pháo giấy, tôn trọng giảm chuyển động
  assert.match(home, /open=\{\(\) => saga\.openChest\(session\.token, opening\.box\.key\)\}/);
  const opening = read('components', 'portal', 'SagaChest.tsx');
  for (const id of ['chest-opening', 'chest-tap', 'chest-rarity', 'chest-claim', 'chest-odds', 'chest-loot-gold', 'chest-loot-xp', 'chest-loot-freeze', 'chest-next']) assert.ok(opening.includes(`testID="${id}"`), id);
  for (const t of ['THƯỜNG', 'HIẾM', 'SỬ THI', 'HUYỀN THOẠI', 'Chạm vào hòm để mở!']) assert.ok(opening.includes(t), t);
  assert.match(opening, /export const ChestArt: React\.FC/);
  assert.match(opening, /AccessibilityInfo\.isReduceMotionEnabled\(\)/);
  assert.doesNotMatch(opening, /[Cc]onfetti/);
  // bản đồ gốc Wikipedia kiểu sa bàn (Khối 6–8) giữ làm kiểu xem "Bản đồ gốc": vị trí theo tỉ lệ, Rồng Con, phóng to, hòm báu
  for (const id of ['saga-map', 'map-mascot', 'map-zoom-in']) assert.ok(home.includes(`testID="${id}"`), id);
  assert.match(home, /testID=\{`unit-map-\$\{no\}`\}/);
  assert.match(home, /testID=\{`map-chest-\$\{box\.key\}`\}/);
  assert.match(home, /<Bounce><ChestArt /);
  assert.match(home, /const data = useLoad<CampaignView>\(session, \(tk\) => saga\.campaign\(tk, no\), \[no\]\);/);
  assert.match(home, /\{st\.order\}\. \{st\.title\}/);
  assert.match(read('constants', 'map-credits.ts'), /Chongquannguyenlan1\.svg/);
  // Quân lệnh: lời dẫn của trò chơi (ghi rõ không phải trích dẫn lịch sử), năm bước, khám phá 3D là phần thêm, phần thưởng lần đầu
  for (const id of ['order-text', 'order-objectives', 'order-steps', 'step-world', 'order-rewards', 'stage-cta']) assert.ok(home.includes(`testID="${id}"`), id);
  assert.match(home, /Lời dẫn của trò chơi, không phải trích dẫn lịch sử\./);
  assert.match(home, /Khám phá thêm \(3D, không bắt buộc\)/);
  assert.match(home, /d\.order_text \? \(/);
  // Bảng vàng: giải đấu tuần, lớp / toàn trường, so với tuần trước (▲ ▼ do máy chủ tính), Khoa bảng, huy hiệu
  for (const id of ['board-league', 'board-card', 'board-scope', 'board-compare', 'board-podium', 'board-list', 'board-khoa-bang', 'board-badges']) assert.ok(home.includes(`testID="${id}"`), id);
  assert.match(home, /game\.leaderboard\(tk, scope === 'class' \? \{ scope, period: 'week', class_id: classId \?\? undefined \} : \{ scope, period: 'week' \}\)/);
  assert.match(home, /const showDelta = compare && Boolean\(data\?\.compare\);/);
  assert.match(home, /game\.leagueView\(tk\)/);
  assert.match(home, /game\.gameBadges\(tk\)/);
  assert.doesNotMatch(code(home), /localStorage|sessionStorage|awardXp|addGold|duolingo/i);
  // danh sách lớp (StudentClasses) giữ luồng đăng ký bằng mã
  const classes = read('components', 'portal', 'StudentClasses.tsx');
  for (const id of ['catalog', 'enrol-page', 'enrol-code', 'enrol-submit', 'enrol-enter']) assert.ok(classes.includes(`testID="${id}"`), id);
  assert.match(classes, /authApi\.joinClass\(session\.token, code\.trim\(\), k\.id\)/);
});

test('năm bước của chặng: Thám sử nhặt thẻ có nguồn, Hội đồng quân sự có Gợi ý chiến thuật, Sử quan so sánh với lịch sử; Luyện binh riêng; sổ Binh thư', () => {
  const learn = read('components', 'portal', 'SagaLearn.tsx');
  for (const name of ['ThamSuScreen', 'HoiDongScreen', 'SuQuanScreen', 'LuyenBinhScreen', 'BinhThuScreen', 'ItemBody', 'Feedback']) assert.match(learn, new RegExp(`export const ${name}: React\\.FC`), name);
  // Thám sử: cảnh bản đồ có điểm sáng + danh sách thẻ (trợ năng); nhận thẻ do máy chủ ghi; đủ thẻ thì mở Hội đồng
  for (const id of ['lore-scene', 'lore-list', 'lore-sheet', 'lore-collect', 'lore-ask', 'lore-count', 'lesson-done', 'lesson-to-practice']) assert.ok(learn.includes(`testID="${id}"`), id);
  assert.match(learn, /testID=\{`lore-spot-\$\{c\.id\}`\}/);
  assert.match(learn, /await saga\.collectLore\(session\.token, stageId, card\.id\)/);
  assert.match(learn, /\{card\.source \? <SourceLine source=\{card\.source\} \/> : null\}/);
  // Hội đồng quân sự: máy chủ chấm; Gợi ý chiến thuật gửi lệnh "hint" và chỉ gạch phương án máy chủ trả về
  assert.match(learn, /\{ type: 'hint', item_id: item\.id \}/);
  assert.match(learn, /const removed = new Set\(item\.removed \?\? \[\]\);/);
  for (const id of ['practice-hint', 'practice-buy-hint', 'practice-result', 'practice-to-battle', 'practice-to-lesson', 'practice-retry']) assert.ok(learn.includes(`testID="${id}"`), id);
  // Sử quan: bảng "Em và lịch sử", nhận xét của Tiểu Tướng, diễn biến có nguồn, phần sáng tạo được ghi rõ, phần thưởng một lần
  for (const id of ['summary-stars', 'summary-compare', 'summary-comment', 'summary-debrief', 'summary-rewards', 'summary-next', 'reward-overlay', 'reward-claim']) assert.ok(learn.includes(`testID="${id}"`), id);
  assert.match(learn, /Phần sáng tạo trong trò chơi: \{sum\.debrief\.fiction\}/);
  // Luyện binh riêng: lượt ôn tính giờ, đồng hồ do máy chủ giữ (báo "ready" khi mở câu)
  for (const id of ['review-suggest', 'review-start', 'review-timer', 'review-result']) assert.ok(learn.includes(`testID="${id}"`), id);
  assert.match(learn, /else void act\(\{ type: 'ready' \}\);/);
  // Binh thư: ba ngăn Nhân vật / Kế sách / Địa danh, thẻ danh tướng; tranh nhân vật ghi rõ là minh họa cách điệu
  for (const id of ['binh-thu-tab', 'binh-thu-heroes', 'binh-thu-card', 'hero-detail']) assert.ok(learn.includes(`testID="${id}"`), id);
  assert.match(learn, /saga\.lore\(tk\)/);
  assert.match(learn, /saga\.cards\(tk\)/);
  assert.match(learn, /Tranh nhân vật là hình minh họa cách điệu, không phải chân dung lịch sử\./);
  // trận hội đồng (Diên Hồng, Vườn không nhà trống, Vạn Kiếp, Khối 9): phương án chưa chọn không lộ điểm; Sử quan đối chiếu với lịch sử
  const play = read('components', 'portal', 'SagaPlay.tsx');
  assert.match(play, /const CouncilHost: React\.FC<HostProps<CouncilView>>/);
  for (const id of ['saga-council', 'council-band', 'council-dialogue', 'council-options', 'council-decide', 'council-result', 'council-summary']) assert.ok(play.includes(`testID="${id}"`), id);
  assert.match(play, /\{ type: 'play', option: pick \}/);
  // Tiểu Tướng: hỏi đáp kèm nguồn, câu hỏi tiếp, nói thay gõ khi trình duyệt hỗ trợ, Trung tâm AI
  const ask = read('components', 'portal', 'SagaAsk.tsx');
  for (const id of ['saga-ask', 'ask-chat', 'ask-input', 'ask-send', 'ask-open-hub', 'saga-ai-hub']) assert.ok(ask.includes(`testID="${id}"`), id);
  assert.match(ask, /ai\.aiAsk\(session\.token, \{ question, conversation_id: conversation \?\? undefined, mode: 'tutor' \}\)/);
  assert.match(ask, /export function askTieuTuong\(question: string\): void/);
  assert.match(ask, /r\.lang = 'vi-VN'/);
});

test('Hồ sơ, Chợ phiên Thăng Long, Giao diện: vàng chỉ đổi đồ trang trí, mua qua máy chủ, món đẹp nhất chỉ mở bằng thành tích', () => {
  const look = read('components', 'portal', 'SagaLook.tsx');
  for (const name of ['ProfileScreen', 'ShopScreen', 'ThemeScreen', 'ThemePreview', 'FramedAvatar', 'FlagMark', 'TitleBadge', 'AvatarPicker', 'CharacterAvatar']) assert.match(look, new RegExp(`export const ${name}: React\\.FC`), name);
  // Hồ sơ: ảnh có khung + cờ hiệu, 4 chỉ số, chuỗi ngày và mốc, bảng "Cách kiếm", thang Khoa bảng, danh hiệu; nút sang Chợ phiên, Giao diện, Tài khoản
  for (const id of ['profile-hero', 'profile-stats', 'profile-streak', 'profile-milestones', 'profile-level', 'profile-earn', 'profile-khoa-bang', 'profile-look', 'profile-titles', 'profile-shop', 'profile-theme', 'profile-account', 'profile-classes', 'profile-help', 'profile-logout']) assert.ok(look.includes(`testID="${id}"`), id);
  for (const t of ['Trả lời đúng 1 câu (lần đầu)', 'Mỗi sao trong trận (lần đầu đạt)', 'Xong 1 chặng lần đầu', 'Xong chiến dịch Khối 6', 'Xong Khối 9 và đủ sao cả bốn khối']) assert.ok(look.includes(t), t);
  // Chợ phiên: mua bằng vàng qua máy chủ (sổ cái), mua xong tự trang bị; vật phẩm có giới hạn tuần; món thành tích không có nút mua
  assert.match(look, /saga\.buy\(session\.token, it\.kind, it\.code\)/);
  assert.match(look, /saga\.equipLook\(session\.token, \{ \[kind\]: code \}\)/);
  for (const id of ['saga-shop', 'shop-tab', 'shop-preview', 'shop-confirm', 'shop-cancel', 'gold-balance']) assert.ok(look.includes(`testID="${id}"`), id);
  assert.match(look, /Chỉ mở bằng thành tích: \{slot\.need\}/);
  assert.match(look, /không mua được KN, sao hay đáp án/);
  for (const code of ['go-moc', 'dong-co', 'lua-dong-a', 'rong-thoi-tran', 'hoa-sen-vang', 'sat-that', 'thuyen-chien', 'pha-cuong-dich', 'rong-cuon', 'coc-bach-dang', 'an-dong-a']) assert.ok(look.includes(`'${code}'`), code);
  // Giao diện: xem thử trên khung điện thoại, đổi xong cả trang đổi màu ngay
  for (const id of ['saga-theme', 'theme-preview-card', 'theme-apply', 'theme-buy']) assert.ok(look.includes(`testID="${id}"`), id);
  assert.match(look, /nav\.setTheme\?\.\(code\)/);
  assert.match(look, /AccessibilityInfo\.isReduceMotionEnabled\(\)/);
  assert.doesNotMatch(code(look), /localStorage|sessionStorage|awardXp|addGold/);
});

test('bốn giao diện màu của học sinh: chữ trên nền đạt tương phản ít nhất 4,5:1 (WCAG AA)', () => {
  const ts = require('typescript');
  const vm = require('node:vm');
  const src = read('components', 'portal', 'StudentDesign.tsx');
  const compiled = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
  const stub = { createContext: (v) => ({ Provider: null, v }), useContext: () => null, PALETTES: { light: {}, dark: {} } };
  const fakeRequire = () => new Proxy(stub, { get: (o, k) => (k in o ? o[k] : () => null) });
  const loaded = { exports: {} };
  new vm.Script(`(function(module,exports,require){${compiled}\n})`).runInThisContext()(loaded, loaded.exports, fakeRequire);
  const themes = loaded.exports.BT_THEMES;
  assert.deepEqual(Object.keys(themes), ['thang-long', 'bach-dang', 'dem-dong-bo-dau', 'hoang-thanh']);
  const lum = (hex) => {
    const n = hex.replace('#', '');
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const pairs = [['ink', 'bg'], ['ink', 'card'], ['soft', 'card'], ['muted', 'card'], ['muted', 'bg'], ['muted', 'card2'], ['accent', 'bg'], ['accent', 'card'], ['onAccent', 'accent'],
    ['onHero', 'hero'], ['onHeroMuted', 'hero'], ['gold', 'hero'], ['onNight', 'night'], ['onNightMuted', 'night'], ['gold', 'night'], ['goldInk', 'goldSoft'], ['goldInk', 'card'],
    ['green', 'greenSoft'], ['danger', 'dangerSoft'], ['teal', 'tealSoft'], ['teal', 'card']];
  for (const [code, t] of Object.entries(themes)) {
    for (const [fg, bg] of pairs) assert.ok(ratio(t[fg], t[bg]) >= 4.5, `${code}: ${fg} ${t[fg]} trên ${bg} ${t[bg]} = ${ratio(t[fg], t[bg]).toFixed(2)}`);
  }
});

test('Phaser chỉ nạp động từ GameViewport bản web: một khung một game, hủy khi rời màn, không vào bản điện thoại và không nằm trong gói của trang khác', () => {
  const web = read('components', 'portal', 'GameViewport.web.tsx');
  assert.match(web, /import\('@\/game'\)\.then\(\(\{ createGame \}\) =>/);
  assert.match(web, /game\?\.destroy\(\);/);
  assert.doesNotMatch(web, /from 'phaser'/);
  const native = read('components', 'portal', 'GameViewport.tsx');
  assert.doesNotMatch(native, /phaser|import\('@\/game'\)|from '@\/game'/);
  assert.match(read('game', 'index.ts'), /game\.destroy\(true\);/);
  // trang cuộn bên trong một khung nên Phaser phải đo lại vị trí canvas trước mỗi thao tác chuột / chạm; giảm chuyển động thì cảnh không rung, không chớp
  assert.match(read('game', 'index.ts'), /game\.scale\.updateBounds\(\)/);
  assert.match(web, /bridge\.set\('game:calm', reduce\)/);
  // ngoài thư mục game/, không tệp nào nhập Phaser hay nhập tĩnh cảnh game (chỉ được nhập kiểu và cầu nối không phụ thuộc Phaser)
  for (const file of [...walk('components'), ...walk('app'), ...walk('lib'), ...walk('hooks'), ...walk('api')]) {
    const text = read(file);
    assert.doesNotMatch(text, /from ['"]phaser['"]/, file);
    assert.doesNotMatch(text, /from ['"]@\/game(\/(index|pixel|explore-scene|tactics-scene|bachdang-scene))?['"]/, file);
  }
  assert.doesNotMatch(read('game', 'bridge.ts'), /^import /m); // cầu nối không nhập gì nên giao diện dùng được mà không kéo theo Phaser
});

test('giao diện không giữ đáp án và không tự quyết định điểm: mọi lệnh gửi máy chủ kèm mã lệnh và số thứ tự', () => {
  const api = read('lib', 'saga-api.ts');
  assert.match(api, /body: \{ action_id: actionId, seq, action \}/);
  assert.match(api, /if \(\(e as \{ status\?: number \}\)\.status !== 0\) throw e;/); // chỉ gửi lại khi mạng lỗi, luôn cùng một mã lệnh
  const types = read('types', 'saga.ts');
  const item = types.slice(types.indexOf('export type PracticeItem ='), types.indexOf('export interface AnswerOutcome'));
  assert.doesNotMatch(item, /correct|feedback|score: 0 \| 1 \| 2/);
  // các màn chơi chỉ lấy điểm, sao, thưởng từ phản hồi của máy chủ
  for (const f of ['SagaLearn', 'SagaPlay']) {
    const text = read('components', 'portal', `${f}.tsx`);
    assert.match(text, /saga\.act</, f);
    assert.doesNotMatch(text, /awardXp|addGold|localStorage/, f);
  }
  // bản đồ: vị trí chặng theo tỉ lệ trên ảnh, ảnh nền do máy chủ cấu hình
  const home = read('components', 'portal', 'SagaHome.tsx');
  assert.match(home, /st\.map_x \* cw, st\.map_y \* ch/);
  assert.match(home, /source=\{mapSource\(map\)\}/);
});

test('trang giáo viên ẩn Hành trình học, Bộ đề và bỏ Trò chơi hóa', () => {
  const teacher = read('components', 'portal', 'TeacherApp.tsx');
  const hiddenTeacher = [...teacher.slice(teacher.indexOf('TEMP_HIDDEN_TEACHER_TABS: Tab[] = ['), teacher.indexOf('];', teacher.indexOf('TEMP_HIDDEN_TEACHER_TABS: Tab[] = ['))).matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
  assert.deepEqual(hiddenTeacher, ['journeys', 'quizzes']);
  assert.match(teacher, /const VISIBLE_NAV = NAV\.filter\(\(it\) => !TEMP_HIDDEN_TEACHER_TABS\.includes\(it\.id\)\);/);
  assert.match(teacher, /nav=\{VISIBLE_NAV\}/);
  assert.ok(!teacher.includes('TeacherGame') && !teacher.includes('Trò chơi hóa'), 'TeacherApp không còn mục Trò chơi hóa');
});

test('16/11/2026: giáo viên không còn Khảo sát, trình soạn Quiz (Kahoot-style), Soạn đề bằng AI và nút Tạo lớp; hộp "+ Tạo" chỉ còn Câu hỏi và Phòng thi đấu', () => {
  const teacher = read('components', 'portal', 'TeacherApp.tsx');
  for (const gone of ["'surveys'", 'SurveyPage', '<QuizStudio', 'AiQuizModal', "'studio'", "title: 'Quiz (Kahoot-style)'", "title: 'Soạn đề bằng AI'"]) assert.ok(!teacher.includes(gone), gone);
  // đợt 2 (16/11/2026): bỏ hẳn nút "+ Tạo" ở thanh đầu
  assert.ok(!teacher.includes('CreateMenu') && !teacher.includes('testID="create-menu"'), 'không còn nút + Tạo');
  for (const f of [['components', 'admin', 'QuizStudio.tsx'], ['components', 'admin', 'AiQuizModal.tsx'], ['components', 'portal', 'SurveyCenter.tsx'], ['types', 'studio.ts']]) assert.ok(!exists(...f), f.join('/'));
  assert.doesNotMatch(read('components', 'admin', 'AiTeacher.tsx'), /AiQuizModal|Soạn đề AI theo ma trận Bloom/);
  assert.doesNotMatch(read('api', 'platformApi.ts'), /surveys|survey-templates/);
  assert.doesNotMatch(read('api', 'learningApi.ts'), /\/api\/content\/studio/);
  const classes = read('components', 'admin', 'ClassManager.tsx');
  assert.ok(!classes.includes('testID="class-create"') && !classes.includes('<FormSheet title="Tạo lớp"'), 'giáo viên không tự tạo lớp');
  assert.doesNotMatch(read('api', 'classroomApi.ts'), /export const createClass/);
  // đợt 2: trong lớp chỉ còn danh sách học sinh; không còn Đội, Luật lớp, Trận đánh, Thưởng/phạt, Bài tập, Tiến độ, Thông báo; không tự thêm / nhập học sinh
  for (const gone of ['ClassTeams', 'ClassRules', 'ClassBattleLinks', 'ClassRewards', 'ClassAssignments', 'ClassProgress', 'ClassNotices', 'Segmented label="Mục quản lý lớp"', '<EmptyState']) assert.ok(!classes.includes(gone), gone);
  const people = read('components', 'admin', 'ClassPeople.tsx');
  for (const gone of ['title="Thêm học sinh"', 'title="Nhập từ Excel"', 'const AddStudents', 'const ImportStudents']) assert.ok(!people.includes(gone), gone);
});

test('16/11/2026: tạo phòng thi đấu ở trang riêng (không còn hộp thoại), câu hỏi lấy từ ngân hàng câu hỏi hoặc bộ đề trong thư viện học liệu; phòng chờ chỉ hiện mã PIN, không còn mã QR', () => {
  const live = read('components', 'admin', 'LiveManager.tsx');
  assert.match(live, /const CreateRoomPage: React\.FC</);
  assert.match(live, /if \(screen\.kind === 'create'\) return <CreateRoomPage /);
  assert.doesNotMatch(live, /<FormSheet title="Tạo phòng thi đấu"/);
  for (const t of ["label=\"Lớp *\"", "label=\"Tên phòng\"", 'Chọn từ ngân hàng câu hỏi', 'Bộ đề trong thư viện học liệu', '<QuestionPicker ', 'label="Khóa phòng"', 'label="Tên hiển thị"', 'label="Câu hỏi trên thiết bị học sinh"', 'label="Xáo thứ tự đáp án theo thiết bị"', 'label="Cảnh báo chuyển tab"']) assert.ok(live.includes(t), t);
  assert.match(live, /learning\.createQuiz\(session\.token, \{ title: name, items: usable\.map/);
  const host = read('components', 'admin', 'LiveHost.tsx');
  assert.match(host, /testID="live-pin-display"/);
  assert.doesNotMatch(host, /join\.qr|quét mã QR|<Image /);
});
