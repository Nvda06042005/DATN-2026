// 15/11/2026: xóa toàn bộ giao diện cũ của trang học sinh để xây dựng lại từ đầu (StudentNav, lộ trình học, bản đồ nhiệm vụ, lớp học, thi đấu, thẻ tướng…).
// Trang học sinh chỉ còn khung: thanh trên cùng và thông báo đang xây dựng lại. API và dữ liệu học sinh giữ nguyên; phần dùng chung với giáo viên / quản trị giữ.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');
const exists = (...p) => fs.existsSync(path.join(__dirname, '..', ...p));

test('trang học sinh chỉ còn khung: thanh trên cùng (hồ sơ, đổi mật khẩu, đăng xuất), giữ chế độ sáng / tối, thông báo đang xây dựng lại', () => {
  const app = read('components', 'portal', 'StudentApp.tsx');
  assert.match(app, /<TopBar session=\{session\} subtitle="Học lịch sử cùng Hào Khí Đông A" \/>/);
  assert.match(app, /title="Trang học sinh đang được xây dựng lại"/);
  assert.match(app, /platform\.prefs\(session\.token\)/);
  assert.match(read('app', 'hoc-sinh.tsx'), /<StudentApp session=\{session\} \/>/);
  // không còn nối tới giao diện cũ
  for (const old of ['StudentNav', 'LearningPath', 'QuestMap', 'ClassTab', 'LiveTab', 'WarPlay', 'GameTabs', 'AiHubDashboard']) assert.doesNotMatch(app, new RegExp(old), old);
});

test('đã xóa các tệp chỉ trang học sinh dùng; giữ phần dùng chung với giáo viên / quản trị', () => {
  const gone = ['BattleKit', 'Celebrations', 'ClassTab', 'DemoActivityPlayer', 'DuolingoRightPanel', 'GameTabs', 'LearnerHome', 'LearningPath', 'LearningSections', 'LessonSteps', 'LivePlay', 'LiveTab', 'MiniGames', 'PathNodePopover', 'Progress', 'QuestMap', 'StudentNav', 'StudyPlan', 'WarCards', 'WarPlay'];
  for (const f of gone) assert.ok(!exists('components', 'portal', `${f}.tsx`), f);
  for (const f of ['learning-path.ts', 'learning-path-demo.ts']) assert.ok(!exists('lib', f), f);
  const kept = ['TieuTuong', 'QuizPlayer', 'LiveKit', 'LessonReader', 'Library', 'NoticeCenter', 'HelpCenter', 'SurveyCenter', 'Media', 'LiveTheme', 'MapGraph', 'GameKit', 'LessonCelebrationView', 'PathArt', 'SandTableView', 'TeacherApp'];
  for (const f of kept) assert.ok(exists('components', 'portal', `${f}.tsx`), f);
});

test('trang giáo viên ẩn Hành trình học, Bộ đề và bỏ Trò chơi hóa', () => {
  const teacher = read('components', 'portal', 'TeacherApp.tsx');
  const hiddenTeacher = [...teacher.slice(teacher.indexOf('TEMP_HIDDEN_TEACHER_TABS: Tab[] = ['), teacher.indexOf('];', teacher.indexOf('TEMP_HIDDEN_TEACHER_TABS: Tab[] = ['))).matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
  assert.deepEqual(hiddenTeacher, ['journeys', 'quizzes']);
  assert.match(teacher, /const VISIBLE_NAV = NAV\.filter\(\(it\) => !TEMP_HIDDEN_TEACHER_TABS\.includes\(it\.id\)\);/);
  assert.match(teacher, /nav=\{VISIBLE_NAV\}/);
  assert.ok(!teacher.includes('TeacherGame') && !teacher.includes('Trò chơi hóa'), 'TeacherApp không còn mục Trò chơi hóa');
});
