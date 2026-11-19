// 15/11/2026: trang học sinh được xây dựng lại thành Hành trình Đông A (chọn cuộc kháng chiến → bản đồ → học → luyện tập → nhập vai → trận đánh → tổng kết).
// 20/11/2026: StudentWorkspace có giao diện game riêng; các luồng điều hướng, kiểm tra lớp, API và máy chủ chấm điểm giữ nguyên.
// Giao diện cũ (StudentNav, lộ trình học, bản đồ nhiệm vụ, lớp học, thẻ tướng…) đã xóa và không được nối lại; API và dữ liệu học sinh giữ nguyên.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
const exists = (...p) => fs.existsSync(path.join(root, ...p));
const walk = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : []));

test('trang học sinh: khung game riêng giữ các mục học tập, điều hướng URL, quyền theo lớp và quản lý phiên', () => {
  const app = read('components', 'portal', 'StudentApp.tsx');
  assert.match(read('app', 'hoc-sinh.tsx'), /<StudentApp session=\{session\} \/>/);
  assert.match(app, /usePortalTab<SagaTab>\('chien-dich', TABS\)/);
  for (const [id, label] of [['chien-dich', 'Chiến dịch'], ['nhap-vai', 'Nhập vai'], ['cau-hoi', 'Câu hỏi ôn tập'], ['tu-lieu', 'Tư liệu'], ['bo-the', 'Bộ thẻ'], ['hoi', 'Hỏi Tiểu Tướng'], ['tro-giup', 'Trợ giúp']]) assert.ok(app.includes(`{ id: '${id}', label: '${label}'`), id);
  // 16/11/2026: xóa hẳn mục Khảo sát của trang học sinh; logo ở thanh đầu từng bỏ rồi khôi phục cùng ngày ("khôi phục header cho trang học sinh"), nút loa bỏ hẳn
  for (const gone of ["'khao-sat'", "label: 'Khảo sát'", '<SurveyCenter', 'ClipboardList']) assert.ok(!app.includes(gone), gone);
  assert.doesNotMatch(read('components', 'portal', 'SagaKit.tsx'), /'khao-sat'/);
  assert.match(read('components', 'admin', 'AdminWorkspace.tsx'), /\n {8}<View style=\{\{ flexShrink: 1 \}\}><BrandLogo /);
  assert.doesNotMatch(read('components', 'admin', 'AdminWorkspace.tsx'), /role !== 'student' \? <View style=\{\{ flexShrink: 1 \}\}><BrandLogo/);
  for (const gone of ['sound-toggle', 'Volume2', 'VolumeX']) assert.ok(!app.includes(gone), gone);
  assert.match(app, /useEffect\(\(\) => \{ if \(soundEnabled\(\)\) setSound\(false\); \}, \[\]\);/);
  // Chỉ học sinh dùng bảng màu và nút game; không đổi ThemeContext toàn ứng dụng hay khung của giáo viên / quản trị.
  assert.match(app, /<AdminUiContext\.Provider value=\{false\}>/);
  assert.match(app, /<ThemeContext\.Provider value=\{\{ c: STUDENT_PALETTE, dark: false \}\}>/);
  assert.match(app, /<StudentWorkspace session=\{session\} nav=\{navItems\} active=\{route\.tab === 'lop-hoc' \? 'chien-dich' : route\.tab\} onSelect=\{pick\}/);
  for (const gone of ['RoundIcon', 'student-hud', 'ask-tieu-tuong', 'account-menu', 'PALETTES.dark']) assert.ok(!app.includes(gone), gone);
  // bước của chặng: học, luyện tập, nhập vai, trận đánh, tổng kết
  assert.match(app, /const STEPS: readonly SagaStep\[\] = \['hoc', 'luyen', 'kham-pha', 'tran', 'tong-ket'\];/);
  for (const screen of ['HomeScreen', 'CampaignScreen', 'LessonScreen', 'PracticeScreen', 'ExploreScreen', 'BattleScreen', 'SummaryScreen', 'ReviewScreen', 'CollectionScreen', 'ArchiveScreen', 'RolePlayScreen']) assert.ok(app.includes(`<${screen} `), screen);
  assert.match(app, /saga\.home\(session\.token\)/);
  // mỗi lần điều hướng là một màn mới chồng lên màn cũ: màn không còn được xem phải gỡ hết nội dung (game Phaser, đồng hồ, phím tắt, hộp thoại)
  assert.match(app, /const focused = useIsFocused\(\);/);
  assert.match(app, /if \(!focused\) return <View style=\{\{ flex: 1 \}\} testID="student-app-hidden" \/>;/);
  // ba kiểu điều hướng: thêm bước lịch sử, thay bước hiện tại (bước chơi vừa xong), đổi ngay trên màn (mở / đóng bảng chặng)
  assert.match(app, /if \(mode === 'params'\) \{ router\.setParams\(/);
  assert.match(app, /router\.replace\(\{ pathname, params:/);
  // màn "Lên cấp" không chen ngang bước đang chơi và không chồng lên màn nhận thưởng
  assert.match(app, /const midStep = route\.v !== null && route\.v !== 'tong-ket';/);
  assert.match(app, /\{levelUp && !reward \? \(/);
  assert.match(app, /platform\.prefs\(session\.token\)/);
  const shell = read('components', 'portal', 'StudentWorkspace.tsx');
  for (const text of ['Hồ sơ cá nhân', 'Đổi mật khẩu', 'Đăng xuất', 'session.changePassword()', 'session.logout()', 'Không gian học sinh', '<BrandLogo ', 'testID="student-tabs"', 'accessibilityRole="tablist"', 'accessibilityRole="tab"']) assert.ok(shell.includes(text), text);
  // 20/11/2026 (người dùng chọn "Bỏ menu trái, trang cuộn dọc"): không còn menu trái / ngăn kéo menu – các mục là dải nút ngay dưới thanh trên cùng
  for (const gone of ['student-sidebar', 'student-menu-toggle', '<Modal', 'setMenu(']) assert.ok(!shell.includes(gone), gone);
  assert.match(shell, /authApi\.getProfile\(session\.token\)/);
  assert.match(shell, /authApi\.updateProfile\(session\.token, patch\)/);
  assert.match(shell, /authApi\.uploadAvatar\(session\.token, img\)/);
  // giao diện sáng như các cổng quản trị: bảng Cài đặt không còn chọn sáng / tối; âm thanh trò chơi chỉ bật khi người dùng tự bật
  assert.doesNotMatch(read('components', 'portal', 'NoticeCenter.tsx'), /label: 'Tối'/);
  assert.match(read('lib', 'saga-sound.ts'), /let enabled = false;/);
  // không còn nối tới giao diện cũ
  for (const old of ['StudentNav', 'LearningPath', 'QuestMap', 'ClassTab', 'LiveTab', 'WarPlay', 'GameTabs', 'AiHubDashboard', 'đang được xây dựng lại']) assert.doesNotMatch(app, new RegExp(old), old);
});

test('đã xóa các tệp giao diện cũ của học sinh; giữ phần dùng chung; có đủ tệp của Hành trình Đông A', () => {
  const gone = ['BattleKit', 'Celebrations', 'ClassTab', 'DemoActivityPlayer', 'DuolingoRightPanel', 'GameTabs', 'LearnerHome', 'LearningPath', 'LearningSections', 'LessonSteps', 'LivePlay', 'LiveTab', 'MiniGames', 'PathNodePopover', 'Progress', 'QuestMap', 'StudentNav', 'StudyPlan', 'WarCards', 'WarPlay'];
  for (const f of gone) assert.ok(!exists('components', 'portal', `${f}.tsx`), f);
  for (const f of ['learning-path.ts', 'learning-path-demo.ts']) assert.ok(!exists('lib', f), f);
  const kept = ['TieuTuong', 'QuizPlayer', 'LiveKit', 'LessonReader', 'Library', 'NoticeCenter', 'HelpCenter', 'Media', 'LiveTheme', 'MapGraph', 'GameKit', 'LessonCelebrationView', 'PathArt', 'SandTableView', 'TeacherApp'];
  for (const f of kept) assert.ok(exists('components', 'portal', `${f}.tsx`), f);
  for (const f of ['SagaKit', 'SagaHome', 'SagaLearn', 'SagaPlay', 'SagaExtras', 'GameViewport', 'GameViewport.web']) assert.ok(exists('components', 'portal', `${f}.tsx`), f);
  for (const f of ['index.ts', 'bridge.ts', 'pixel.ts', 'explore-scene.ts', 'tactics-scene.ts', 'bachdang-scene.ts']) assert.ok(exists('game', f), f);
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
  for (const f of ['SagaLearn', 'SagaPlay', 'SagaExtras']) {
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

test('các màn Hành trình dùng thành phần hiện tại, giữ bản đồ lịch sử, thành tích máy chủ và các luồng vào lớp', () => {
  const kit = read('components', 'portal', 'SagaKit.tsx');
  assert.match(kit, /import \{ ErrorNote \} from '@\/components\/admin\/kit';/);
  for (const gone of ['GameBtn', 'Chunky', 'SkyBg', 'Sunburst', 'Confetti', 'RoundIcon', 'TieuTuongArt', 'CampaignArt']) assert.doesNotMatch(kit, new RegExp(`export (const|function) ${gone}(?![A-Za-z])`), gone);
  assert.doesNotMatch(kit, /LinearGradient/);
  for (const f of ['SagaHome', 'SagaLearn', 'SagaPlay', 'SagaExtras']) {
    const text = read('components', 'portal', `${f}.tsx`);
    assert.match(text, /from '@\/components\/ui';/, f);
    assert.match(text, /<SagaHeader /, f);
    assert.doesNotMatch(text, /GameBtn|Chunky|SkyBg|Sunburst|Confetti|LinearGradient|tone="(green|yellow|purple|navy|white|blue|orange|red)"/, f);
  }
  // 16/11/2026 đợt 5: Chiến dịch mở danh sách lớp trước (không còn menu Lớp học riêng), vào lớp rồi mới tới ba phần; trang bản đồ + bảng chặng cũ đã xóa
  // đợt 7: trang bản đồ = ba phần nối nhau khi cuộn, mỗi phần một bản đồ gốc kiểu sa bàn; Rồng Con đi trên bản đồ tới chặng đang học;
  // bỏ lộ trình uốn lượn, thẻ phần có ảnh thu nhỏ "Bản đồ bên dưới" và dòng ghi nguồn dưới bản đồ (ghi công ở trang Thông tin hình ảnh)
  const home = read('components', 'portal', 'SagaHome.tsx');
  for (const id of ['home-units', 'map-caption', 'map-mascot', 'unit-continue', 'my-class']) assert.ok(home.includes(`testID="${id}"`), id);
  // 17/11/2026: hòm báu trên bản đồ (máy chủ mở, thưởng một lần) và cột bên phải kiểu Duolingo (chỉ số, cấp độ, giải đấu tuần, nhiệm vụ hằng ngày có hòm báu)
  assert.match(home, /testID=\{`map-chest-\$\{box\.key\}`\}/);
  assert.match(home, /open=\{\(\) => saga\.openChest\(session\.token, opening\.box\.key\)\}/);
  // 17/11/2026: hòm báu bí ẩn – màn mở rương kiểu game (chạm để mở, lóe sáng, tia sáng theo độ hiếm, phần thưởng bật ra, số vàng đếm lên, công bố tỉ lệ)
  const opening = read('components', 'portal', 'SagaChest.tsx');
  for (const id of ['chest-opening', 'chest-tap', 'chest-rarity', 'chest-claim', 'chest-odds', 'chest-loot-gold', 'chest-loot-xp', 'chest-loot-freeze', 'chest-next']) assert.ok(opening.includes(`testID="${id}"`), id);
  for (const t of ['THƯỜNG', 'HIẾM', 'SỬ THI', 'HUYỀN THOẠI', 'Chạm vào hòm để mở!', 'Khiên giữ chuỗi']) assert.ok(opening.includes(t), t);
  assert.match(opening, /AccessibilityInfo\.isReduceMotionEnabled\(\)/);
  assert.doesNotMatch(opening, /[Cc]onfetti/);
  assert.match(home, /<Bounce><ChestArt /);
  assert.match(home, /<SagaRail session=\{session\} nav=\{nav\} wide=\{wide\} \/>/);
  assert.match(read('lib', 'saga-api.ts'), /export const openChest = /);
  const rail = read('components', 'portal', 'SagaRail.tsx');
  for (const id of ['saga-rail', 'home-metrics', 'home-level', 'rail-league', 'rail-league-open', 'rail-quests', 'rail-quests-open', 'home-review', 'home-exams', 'league-sheet', 'quests-sheet']) assert.ok(rail.includes(`testID="${id}"`), id);
  assert.match(rail, /game\.leagueView\(t\)/);
  assert.match(rail, /game\.gameQuests\(t\)/);
  for (const t of ['VÙNG LÊN HẠNG', 'VÙNG XUỐNG HẠNG', 'Nhiệm vụ hằng ngày', 'Nhiệm vụ tuần', 'XEM TẤT CẢ', 'XEM BẢNG']) assert.ok(rail.includes(t), t);
  assert.doesNotMatch(rail, /duolingo\.com|\.png'\)|require\(/i);
  // 17/11/2026: khung ảnh đại diện (vòng màu xoay, quầng sáng, tia lấp lánh) và danh hiệu (viền nhấp nháy) nhận từ hòm báu, kiểu quà sự kiện của game
  const look = read('components', 'portal', 'SagaLook.tsx');
  for (const name of ['FramedAvatar', 'TitleBadge', 'WardrobeSheet']) assert.match(look, new RegExp(`export const ${name}: React\.FC`), name);
  assert.match(look, /AccessibilityInfo\.isReduceMotionEnabled\(\)/);
  assert.match(look, /saga\.equipLook\(session\.token, body\)/);
  for (const code of ['dong-bo-dau', 'chuong-duong', 'bach-dang']) assert.ok(look.includes(`'${code}'`), code);
  assert.match(read('components', 'portal', 'StudentApp.tsx'), /avatar=\{home\.data\?\.look\?\.frame \|\| home\.data\?\.look\?\.avatar \? <FramedAvatar /);
  assert.match(read('components', 'portal', 'StudentApp.tsx'), /roleLine=\{home\.data\?\.look\?\.title \? <TitleBadge /);
  assert.match(read('components', 'portal', 'StudentWorkspace.tsx'), /\{avatar \?\? <Avatar name=\{session\.user\.full_name\}/);
  assert.match(rail, /testID="rail-profile"/);
  assert.match(rail, /<WardrobeSheet session=\{session\}/);
  assert.match(opening, /testID=\{`chest-unlock-\$\{u\.code\}`\}/);
  // ảnh đại diện có sẵn theo nhân vật (Rồng Con, danh tướng) chọn ở Hồ sơ cá nhân như ô "Set your status"; ảnh ở hồ sơ mang khung / danh hiệu từ hòm báu
  for (const name of ['CharacterAvatar', 'AvatarPicker', 'ProfileLook']) assert.match(look, new RegExp(`export const ${name}: React\.FC`), name);
  for (const code of ['rong-con-vui', 'rong-con-ra-tran', 'tran-hung-dao', 'tran-quoc-toan']) assert.ok(look.includes(`'${code}'`), code);
  assert.match(look, /saga\.equipLook\(session\.token, \{ avatar \}\)/);
  const student = read('components', 'portal', 'StudentApp.tsx');
  assert.match(student, /profileAvatar=\{<FramedAvatar /);
  assert.match(student, /profileExtra=\{<ProfileLook session=\{session\} onChanged=\{home\.reload\} \/>\}/);
  assert.match(read('components', 'profile.tsx'), /\{avatar \?\? <Avatar name=\{user\.full_name\} uri=\{user\.avatar_url\} size=\{56\} \/>\}/);
  assert.match(read('components', 'portal', 'StudentWorkspace.tsx'), /avatar=\{profileAvatar\} extra=\{profileExtra\}/);
  for (const gone of ['unit-path', 'unit-map-toggle', 'join-class', 'join-code', 'join-submit']) assert.ok(!home.includes(`testID="${gone}"`), gone);
  assert.doesNotMatch(home, /testID="stage-table"|<DataTable columns=\{columns\} rows=\{view\.stages\}|testID="home-path"|'Kéo bản đồ ra'|const ClassStrip|mapOpen|const UnitPath|Bản đồ bên dưới|Vị trí các chặng do nhóm phát triển đánh dấu/);
  assert.match(home, /testID=\{`saga-part-\$\{no\}`\}/);
  assert.match(home, /testID=\{`unit-map-\$\{no\}`\}/);
  assert.match(home, /const p1 = useLoad<CampaignView>\(session, \(t\) => saga\.campaign\(t, 1\), \[\]\);/);
  assert.match(home, /AccessibilityInfo\.isReduceMotionEnabled\(\)/);
  // đợt 8: bản đồ không có thanh cuộn riêng ở cỡ mặc định (chỉ cuộn khi bấm phóng to); thẻ phần ở trang Chiến dịch không còn ảnh thu nhỏ bản đồ
  assert.match(home, /const zi = chosen \?\? 0;/);
  assert.match(home, /const viewH = baseH;/);
  assert.doesNotMatch(home, /Math\.min\(ch, maxH\)|path-map-|const thumb = /);
  assert.match(home, /testID=\{`path-go-\$\{camp\.campaign_no\}`\}/);
  assert.match(home, /\{st\.order\}\. \{st\.title\}/);
  assert.match(read('components', 'portal', 'StudentApp.tsx'), /<CampaignScreen key="campaign" /);
  assert.match(read('constants', 'map-credits.ts'), /Chongquannguyenlan1\.svg/);
  // học sinh chưa vào lớp: chỉ có Chiến dịch (danh sách lớp, đăng ký bằng mã), Tin nhắn, Trợ giúp
  const app = read('components', 'portal', 'StudentApp.tsx');
  assert.match(app, /const BEFORE_CLASS: readonly SagaTab\[\] = \['chien-dich', 'tin-nhan', 'tro-giup'\];/);
  assert.match(app, /NAV\.filter\(\(it\) => !gated \|\| BEFORE_CLASS\.includes\(it\.id\)\)/);
  assert.doesNotMatch(app, /\{ id: 'lop-hoc', label: 'Lớp học'/);
  assert.match(app, /: inClass \? <HomeScreen session=\{session\} nav=\{nav\} loading=\{home\.loading\} error=\{home\.error\} cls=\{cls\} onLeave=\{\(\) => enter\(null\)\} \/> : catalog/);
  assert.doesNotMatch(app, /sessionStorage\?\.setItem\(ENTER_KEY, JSON\.stringify\(\{[^}]*token/);
  const classes = read('components', 'portal', 'StudentClasses.tsx');
  for (const id of ['catalog', 'enrol-page', 'enrol-code', 'enrol-submit', 'enrol-enter', 'inbox-list', 'inbox-view', 'inbox-class-code', 'inbox-join']) assert.ok(classes.includes(`testID="${id}"`), id);
  assert.match(classes, /authApi\.joinClass\(session\.token, code\.trim\(\), k\.id\)/);
  assert.match(classes, /onPress=\{\(\) => \(k\.mine \? onEnter\(k\) : setOpenId\(k\.id\)\)\}/);
  assert.match(read('components', 'portal', 'SagaExtras.tsx'), /<DataTable columns=\{boardColumns\}/);
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

test('20/11/2026: sảnh học sinh cuộn dọc – mở đầu VÀO TRẬN, giới thiệu, thang danh hiệu thời Trần, bảng vàng, thư viện tranh; hình tự vẽ, số liệu từ máy chủ', () => {
  const home = read('components', 'portal', 'SagaHome.tsx');
  const hall = read('components', 'portal', 'StudentHall.tsx');
  const art = read('components', 'portal', 'StudentArt.tsx');
  const rank = read('lib', 'scholar-rank.ts');
  // thứ tự người dùng chọn: màn mở đầu → giới thiệu → thang danh hiệu → bảng xếp hạng → thư viện tranh
  const order = ['<HallHero ', '<HallSteps ', '<RankLadder ', '<HallBoard ', '<HallGallery '].map((t) => home.indexOf(t));
  assert.ok(order.every((at, k) => at > 0 && (k === 0 || at > order[k - 1])), String(order));
  for (const id of ['hall-hero', 'hall-play', 'hall-map', 'hall-rank', 'hall-intro', 'rank-ladder', 'rank-detail', 'hall-board', 'board-podium', 'board-list', 'hall-gallery', 'gallery-view']) assert.ok(hall.includes(`testID="${id}"`), id);
  // VÀO TRẬN mở chặng tiếp theo do máy chủ chọn; danh hiệu tính từ tiến độ máy chủ trả về; bảng vàng dùng API bảng xếp hạng sẵn có (lớp / trường)
  assert.match(home, /nav\.go\('chien-dich', next \? \{ c: next\.campaign_no, s: next\.stage_id, v: null \} : \{ c: 1, s: null, v: null \}\)/);
  assert.match(home, /scholarRank\(home\?\.campaigns\)/);
  assert.match(hall, /game\.leaderboard\(t, scope === 'class' \? \{ scope, period, class_id: classId \?\? undefined \} : \{ scope \}\)/);
  for (const f of [hall, art, rank]) assert.doesNotMatch(f, /localStorage|sessionStorage|awardXp|addGold|saga\.act|apiRequest/);
  // hình vẽ SVG tự làm: không tải ảnh ngoài; không dùng tên trang mẫu trên giao diện; áo Trạng nguyên đỏ son, không vàng hoàng bào
  assert.doesNotMatch(art, /require\(|uri:|https?:\/\//);
  for (const f of [hall, art, rank]) assert.doesNotMatch(f.replace(/\/\*[\s\S]*?\*\//g, ''), /VL[- ]?LEGEND/i);
  assert.match(art, /\{ robe: '#b8261b', [^\n]*flower: true \}/);
  for (const t of ['Học trò', 'Thái học sinh', 'Thám hoa', 'Bảng nhãn', 'Trạng nguyên', '1232', '1247', 'Lê Văn Hưu', 'Nguyễn Hiền', 'Đặng Ma La', '12 hoặc 13 tuổi']) assert.ok(rank.includes(t), t);
  assert.match(hall, /Nguồn: Wikipedia tiếng Việt/);
  assert.match(hall, /Thời xưa chỉ nam giới được dự thi/);
  // nhân vật trang trí đứng yên khi bật giảm chuyển động; nút đủ vùng chạm 44; tranh còn khóa không bấm được
  assert.match(hall, /AccessibilityInfo\.isReduceMotionEnabled\(\)/);
  assert.match(hall, /minHeight: 44, paddingHorizontal: 16, borderRadius: 22/);
  assert.match(hall, /p\.locked \? <View testID=\{`gallery-\$\{p\.key\}`\} accessible/);
  // bản đồ trong thư viện tranh là ảnh gốc Wikipedia đã đóng gói (mapSource), không phải ảnh mới
  assert.match(hall, /mapSource\(\{ image_key: `ban-do-khang-chien-\$\{p\.n\}`, image_url: null \}\)/);
});

test('thang danh hiệu: phần xong liên tiếp từ Phần 1, đủ sao cả ba phần mới là Trạng nguyên, kèm tiến độ tới bậc sau', () => {
  const ts = require('typescript');
  const vm = require('node:vm');
  const compiled = ts.transpileModule(read('lib', 'scholar-rank.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const loaded = { exports: {} };
  new vm.Script(`(function(module,exports){${compiled}\n})`).runInThisContext()(loaded, loaded.exports);
  const { scholarRank, RANKS } = loaded.exports;
  const camp = (n, done, stages, stars, max) => ({ campaign_no: n, stages, done, stars, max_stars: max, completed: stages > 0 && done >= stages });
  assert.deepEqual(RANKS.map((r) => r.name), ['Học trò', 'Thái học sinh', 'Thám hoa', 'Bảng nhãn', 'Trạng nguyên']);
  assert.deepEqual(scholarRank(null), { level: 0, next: null });
  assert.deepEqual(scholarRank([camp(1, 2, 5, 4, 15), camp(2, 0, 4, 0, 12), camp(3, 0, 4, 0, 12)]), { level: 0, next: { done: 2, total: 5, unit: 'chặng' } });
  // thứ tự trả về không quan trọng; xong Phần 1 thì là Thái học sinh và đang tới Phần 2
  assert.deepEqual(scholarRank([camp(2, 1, 4, 2, 12), camp(1, 5, 5, 9, 15), camp(3, 0, 4, 0, 12)]), { level: 1, next: { done: 1, total: 4, unit: 'chặng' } });
  // xong Phần 2 mà chưa xong Phần 1 (dữ liệu bất thường) không được nhảy bậc
  assert.equal(scholarRank([camp(1, 4, 5, 9, 15), camp(2, 4, 4, 12, 12), camp(3, 0, 4, 0, 12)]).level, 0);
  assert.deepEqual(scholarRank([camp(1, 5, 5, 9, 15), camp(2, 4, 4, 10, 12), camp(3, 4, 4, 8, 12)]), { level: 3, next: { done: 27, total: 39, unit: 'sao' } });
  assert.deepEqual(scholarRank([camp(1, 5, 5, 15, 15), camp(2, 4, 4, 12, 12), camp(3, 4, 4, 12, 12)]), { level: 4, next: null });
  // phần chưa có chặng nào (chưa có nội dung) không tính là đã xong
  assert.equal(scholarRank([camp(1, 0, 0, 0, 0), camp(2, 0, 0, 0, 0), camp(3, 0, 0, 0, 0)]).level, 0);
});
