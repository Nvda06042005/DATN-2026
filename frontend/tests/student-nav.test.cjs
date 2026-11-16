// 15/11/2026: trang học sinh được xây dựng lại thành Hành trình Đông A (chọn cuộc kháng chiến → bản đồ → học → luyện tập → nhập vai → trận đánh → tổng kết).
// Giao diện cũ (StudentNav, lộ trình học, bản đồ nhiệm vụ, lớp học, thẻ tướng…) đã xóa và không được nối lại; API và dữ liệu học sinh giữ nguyên.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
const exists = (...p) => fs.existsSync(path.join(root, ...p));
const walk = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : []));

test('trang học sinh: khung Hành trình Đông A với năm mục, mục đang mở nằm trên URL, giữ chế độ sáng / tối', () => {
  const app = read('components', 'portal', 'StudentApp.tsx');
  assert.match(read('app', 'hoc-sinh.tsx'), /<StudentApp session=\{session\} \/>/);
  assert.match(app, /usePortalTab<SagaTab>\('chien-dich', TABS\)/);
  for (const [id, label] of [['chien-dich', 'Chiến dịch'], ['nhap-vai', 'Nhập vai'], ['cau-hoi', 'Câu hỏi'], ['tu-lieu', 'Tư liệu'], ['bo-the', 'Bộ thẻ']]) assert.ok(app.includes(`{ id: '${id}', label: '${label}'`), id);
  assert.ok((app.match(/\{ id: '[a-z-]+', label: '/g) ?? []).length <= 5, 'thanh điều hướng không quá năm mục');
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
  assert.match(app, /ThemeContext\.Provider/);
  // tài khoản: hồ sơ, đổi mật khẩu, đăng xuất, trợ giúp, khảo sát; âm thanh chỉ bật khi người dùng tự bật
  for (const text of ['Hồ sơ cá nhân', 'Đổi mật khẩu', 'Đăng xuất', 'Trợ giúp', 'Khảo sát', 'session.changePassword()', 'session.logout()']) assert.ok(app.includes(text), text);
  assert.match(read('lib', 'saga-sound.ts'), /let enabled = false;/);
  // không còn nối tới giao diện cũ
  for (const old of ['StudentNav', 'LearningPath', 'QuestMap', 'ClassTab', 'LiveTab', 'WarPlay', 'GameTabs', 'AiHubDashboard', 'đang được xây dựng lại']) assert.doesNotMatch(app, new RegExp(old), old);
});

test('đã xóa các tệp giao diện cũ của học sinh; giữ phần dùng chung; có đủ tệp của Hành trình Đông A', () => {
  const gone = ['BattleKit', 'Celebrations', 'ClassTab', 'DemoActivityPlayer', 'DuolingoRightPanel', 'GameTabs', 'LearnerHome', 'LearningPath', 'LearningSections', 'LessonSteps', 'LivePlay', 'LiveTab', 'MiniGames', 'PathNodePopover', 'Progress', 'QuestMap', 'StudentNav', 'StudyPlan', 'WarCards', 'WarPlay'];
  for (const f of gone) assert.ok(!exists('components', 'portal', `${f}.tsx`), f);
  for (const f of ['learning-path.ts', 'learning-path-demo.ts']) assert.ok(!exists('lib', f), f);
  const kept = ['TieuTuong', 'QuizPlayer', 'LiveKit', 'LessonReader', 'Library', 'NoticeCenter', 'HelpCenter', 'SurveyCenter', 'Media', 'LiveTheme', 'MapGraph', 'GameKit', 'LessonCelebrationView', 'PathArt', 'SandTableView', 'TeacherApp'];
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
  const api = read('api', 'sagaApi.ts');
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
