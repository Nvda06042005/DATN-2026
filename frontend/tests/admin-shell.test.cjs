// Khung chung của cổng quản trị tổng, quản trị trường và giáo viên (AdminWorkspace): cùng ngôn ngữ thiết kế với trang chủ, có dòng bản quyền như trang đăng nhập,
// không còn thanh "Quản trị tổng · Toàn hệ thống". Thành phần React Native không nạp được trong Node nên kiểm tra mã nguồn.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');
const shell = read('components', 'admin', 'AdminWorkspace.tsx');
const kit = read('components', 'admin', 'kit.tsx');

test('đã xóa thanh vai trò và phạm vi ("Quản trị tổng · Toàn hệ thống", "Bạn quản lý mọi trường")', () => {
  for (const gone of ['admin-scope', 'Toàn hệ thống', 'Bạn quản lý mọi trường', 'Bạn chỉ truy cập dữ liệu của trường này', 'ShieldCheck', 'schoolCount']) {
    assert.ok(!shell.includes(gone), `AdminWorkspace còn ${gone}`);
  }
  assert.ok(!read('components', 'admin', 'RootAdmin.tsx').includes('schoolCount'));
});

test('tên trường (quản trị trường, giáo viên) chuyển lên đường dẫn trang ở thanh đầu để không mất thông tin', () => {
  assert.match(shell, /const trail = \[schoolName, `\$\{session\.user\.role === 'teacher' \? 'Giáo viên' : 'Quản trị'\} \/ \$\{label\}`\]\.filter\(Boolean\)\.join\(' · '\);/);
  assert.match(shell, /numberOfLines=\{1\} style=\{\{ flex: 1 \}\}>\{trail\}<\/Txt>/);
});

test('cùng ngôn ngữ thiết kế với trang chủ: nền giấy dó có hoa văn, thanh đầu viên thuốc nổi, nút Đăng xuất tối bo tròn', () => {
  assert.match(shell, /backgroundColor: c\.logoPaper \}, WRAP_PRETTY\]\}>\s*<PatternOverlay opacity=\{0\.075\} \/>/);
  assert.match(shell, /testID="admin-topbar" style=\{\[\{[^\]]*borderRadius: 999, borderWidth: 1, borderColor: c\.bienXanh, backgroundColor: c\.kinhDac/);
  assert.match(shell, /backdropFilter: 'blur\(10px\)'/);
  assert.match(shell, /testID="admin-logout"[^\n]*backgroundColor: pressed \? c\.logoInk : c\.den[^\n]*borderRadius: 999|borderRadius: 999, backgroundColor: pressed \? c\.logoInk : c\.den/);
  // thanh bên bo góc nổi trên máy tính, ngăn kéo toàn chiều cao trên điện thoại; không lộ thanh cuộn ở mép bo
  assert.match(shell, /wide \? \{ width: 232, marginLeft: 16, marginBottom: 12, borderRadius: 20, overflow: 'hidden' \} : \{ width: 260, height: '100%' \}/);
  assert.match(shell, /<ScrollView showsVerticalScrollIndicator=\{false\}/);
});

test('dòng bản quyền giống trang đăng nhập nằm ở chân khung, ngoài vùng cuộn', () => {
  assert.match(shell, /<Txt testID="admin-copyright" f="body" size=\{11\} color=\{c\.muc3\} center[^>]*>© 2026 · Bản quyền thuộc quản lý Đông A<\/Txt>/);
  assert.ok(read('components', 'login-layout.tsx').includes('© 2026 · Bản quyền thuộc quản lý Đông A'), 'chữ ở trang đăng nhập đã đổi: cập nhật lại cho khớp');
  assert.ok(shell.indexOf('{children}') < shell.indexOf('admin-copyright'));
});

test('tiêu đề trang quản trị: hai nửa đều nhau như trang chủ (nửa đầu đậm mực, nửa sau nghiêng đỏ), chia theo cụm từ; mọi trang dùng chung PageHeader', () => {
  const header = kit.slice(kit.indexOf('export const PageHeader'), kit.indexOf('export const Page:'));
  assert.match(header, /const \[head, tail\] = splitTitle\(title\);/);
  assert.match(header, /<Txt f="displayHeavy" size=\{26\} color=\{c\.logoInk\} accessibilityRole="header" style=\{\[\{ lineHeight: 34 \}, WRAP_BALANCE\]\}>\{head\}\{tail \? ' ' : ''\}\{tail \? <Txt f="serifItalic" size=\{26\} color=\{c\.logoRed\} style=\{\{ lineHeight: 34 \}\}>\{tail\}<\/Txt> : null\}<\/Txt>/);
  assert.ok(!header.includes('words[words.length - 1]'), 'không còn tách riêng chữ cuối');
  // trang Thống kê hệ thống có tiêu đề riêng, cùng kiểu: "Thống kê | hệ thống"
  const dash = read('components', 'admin', 'SystemDashboard.tsx');
  assert.match(dash, /accessibilityRole="header" style=\{\{ lineHeight: 28 \}\}>Thống kê <Txt f="serifItalic" size=\{22\} color=\{c\.logoRed\} style=\{\{ lineHeight: 28 \}\}>hệ thống<\/Txt><\/Txt>/);
  // chữ phải xuống dòng thì chia đều hai dòng, không để lẻ một từ (web)
  assert.match(kit, /export const WRAP_BALANCE = \(Platform\.OS === 'web' \? \{ textWrap: 'balance' \} : null\) as object;/);
  assert.match(kit, /<Txt f="semibold" size=\{14\} numberOfLines=\{2\} style=\{WRAP_BALANCE\}>\{main\}<\/Txt>/);
  // khung quản trị đặt text-wrap: pretty ở gốc (thuộc tính được kế thừa) để mọi đoạn chữ không còn dòng cuối chỉ có một từ lẻ
  assert.match(shell, /const WRAP_PRETTY = \(Platform\.OS === 'web' \? \{ textWrap: 'pretty' \} : null\)/);
  assert.match(shell, /testID="admin-workspace" style=\{\[\{ flex: 1, backgroundColor: c\.logoPaper \}, WRAP_PRETTY\]\}/);
});

test('cột bảng đủ rộng để tên thường gặp không phải xuống dòng: "Thành phố Hồ Chí Minh", "Quản trị viên trường học"', () => {
  const admin = read('components', 'admin', 'RootAdmin.tsx');
  assert.match(admin, /key: 'city', filter: f_city, label: 'Tỉnh \/ thành', flex: 1\.4,/);
  assert.match(admin, /key: 'role', filter: f_role, label: 'Vai trò', flex: 1\.5,/);
  assert.match(read('components', 'admin', 'SystemDashboard.tsx'), /tài khoản\\nhoạt động 30 ngày` \}/);
  // ô số liệu gọn ở cửa sổ 1240–1400 px bỏ ô biểu tượng để nhãn không bị cắt thành "Hoạt động hôm …"
  assert.match(read('components', 'admin', 'DashboardMetric.tsx'), /const showIcon = width >= 1400 \|\| width < 1240;/);
});

test('thu nhỏ vừa đủ: trang hẹp lại, thanh tìm kiếm và khung lọc có giới hạn rộng, hộp nhập liệu hai cột, nút chuyển trang gọn, hộp hồ sơ chia tab', () => {
  // nội dung trang không trải hết màn hình lớn
  assert.match(kit, /gap: 16, maxWidth: 1120, width: '100%', alignSelf: 'center'/);
  // thanh tìm kiếm + Bộ lọc và khung lọc
  assert.match(kit, /accessibilityRole="search" style=\{\{ flex: 1, minWidth: 260, maxWidth: 520, minHeight: 44,/);
  assert.match(kit, /testID="filter-panel" style=\{\{ alignSelf: 'flex-start', width: '100%', maxWidth: 680,/);
  assert.match(kit, /maxWidth: flex > 1 \? 360 : 280/);
  // hộp nhập liệu: ô ngắn xếp hai cột, ô dài/tùy biến/chọn nhiều chiếm cả hàng; hộp rộng giới hạn 720 px
  assert.match(kit, /const full = Boolean\(f\.render\) \|\| f\.type === 'textarea' \|\| f\.type === 'multi';/);
  assert.match(kit, /flexBasis: full \? '100%' : 240/);
  assert.match(kit, /panelStyle=\{wide \? \{ maxWidth: 720 \} : undefined\}/);
  // nút chuyển trang gọn, nằm giữa
  assert.match(kit, /minWidth: 34, height: 34, paddingHorizontal: 10, borderRadius: 999/);
  assert.match(kit, /testID="pager"[^\n]*justifyContent: 'center'/);
  // hộp Hồ sơ cá nhân: hẹp 520 px, tab Thông tin / Đăng nhập và bảo mật khi có phần bảo mật, giữ cả hai tab trong bộ nhớ
  const profile = read('components', 'profile.tsx');
  assert.match(profile, /panelStyle=\{\{ maxWidth: 520 \}\}/);
  assert.match(profile, /label: 'Thông tin' \}, \{ value: 'security', label: 'Đăng nhập và bảo mật' \}/);
  assert.match(profile, /display: tab === 'info' \? 'flex' : 'none'/);
  assert.match(profile, /display: tab === 'security' \? 'flex' : 'none'/);
  assert.match(profile, /<Avatar name=\{user\.full_name\} uri=\{user\.avatar_url\} size=\{56\} \/>/);
});

test('bộ lọc kiểu Excel: nút mũi tên ở tiêu đề từng cột mở danh sách giá trị; thanh tìm kiếm chỉ còn ô tìm và nút Xóa lọc ở màn rộng', () => {
  // cột nhận bộ lọc, tiêu đề cột có nút, nút mở danh sách đặt ngay dưới nút bằng Modal (không bị bảng cắt)
  assert.match(kit, /Bộ lọc của cột: hiện nút mũi tên ở tiêu đề cột \(kiểu Excel\)/);
  assert.match(kit, /filter\?: SearchFilter;/);
  assert.match(kit, /\{col\.filter \? <ColumnFilter filter=\{col\.filter\} \/> : null\}/);
  assert.match(kit, /ref\.current\?\.measureInWindow\(\(x, y, w, h\) => setAnchor/);
  assert.match(kit, /<Modal transparent visible animationType="none" onRequestClose=\{close\}/);
  for (const id of ['col-filter-menu', 'col-filter-search', 'col-filter-${filter.key}-option-', 'testID={`col-filter-${filter.key}`}']) assert.ok(kit.includes(id), id);
  // chọn một giá trị rồi đóng; dòng đầu của mỗi danh sách là "Tất cả" (giá trị rỗng) để bỏ lọc; danh sách dài (hơn 8 giá trị) có ô tìm
  assert.match(kit, /filter\.onChange\(o\.value\); close\(\);/);
  assert.match(kit, /filter\.options\.length > 8/);
  // đang lọc: nút đỏ có phễu; bảng rỗng do lọc vẫn giữ tiêu đề để bỏ lọc được
  assert.match(kit, /backgroundColor: on \? c\.logoRed/);
  assert.match(kit, /const filterable = table && columns\.some\(\(col\) => col\.filter\);/);
  assert.match(kit, /if \(!rows\.length && !filterable\) return <EmptyState/);
  // màn rộng: không còn nút "Bộ lọc" và khung lọc trong thanh tìm kiếm; màn hẹp (danh sách thẻ không có tiêu đề cột) vẫn có
  assert.match(kit, /const inHeader = width >= TABLE_MIN_WIDTH;/);
  assert.match(kit, /\{filters\.length && !inHeader \? \(/);
  assert.match(kit, /\{!inHeader && open && filters\.length \? \(/);
  assert.match(kit, /Xóa lọc \(\{active\.length\}\)/);
  // sáu bảng dùng bộ lọc cột: trường, người dùng, yêu cầu hỗ trợ, nhật ký thao tác, nhật ký đăng nhập, lỗi hệ thống
  const admin = read('components', 'admin', 'RootAdmin.tsx');
  const ops = read('components', 'admin', 'PlatformOps.tsx');
  for (const [src, col, f] of [[admin, 'city', 'city'], [admin, 'status', 'active'], [admin, 'role', 'role'], [admin, 'school', 'school'], [ops, 'from', 'role'], [ops, 'status', 'status'], [ops, 'who', 'students'], [ops, 'res', 'ok'], [ops, 'src', 'source']]) {
    assert.ok(src.includes(`key: '${col}', filter: f_${f}, `), `${col} ← f_${f}`);
  }
});

test('menu quản trị tổng: Thống kê hệ thống đứng đầu rồi Trường học, Người dùng; các mục còn lại giữ nguyên thứ tự; mở trang là Thống kê', () => {
  const root = read('components', 'admin', 'RootAdmin.tsx');
  const ids = [...root.slice(root.indexOf('const NAV'), root.indexOf('type Tab')).matchAll(/id: '(\w+)'/g)].map((m) => m[1]);
  assert.deepEqual(ids, ['stats', 'schools', 'users', 'notices', 'logs', 'faq', 'support']);
  assert.match(root, /usePortalTab<Tab>\('stats', NAV\.map/);
});

test('thống kê hệ thống: một trang tổng quan vừa một màn hình, có đồng hồ nửa vòng; số liệu thực từ bốn API; cửa sổ nhỏ thì xếp chồng và cuộn', () => {
  const dash = read('components', 'admin', 'SystemDashboard.tsx');
  const panels = read('components', 'admin', 'DashboardPanels.tsx');
  const gauge = read('components', 'admin', 'DashboardGauge.tsx');
  assert.match(read('components', 'admin', 'AnalyticsAdmin.tsx'), /export const SystemStats: React\.FC<\{ session: Session \}> = \(\{ session \}\) => <SystemDashboard session=\{session\} \/>;/);
  // bốn nguồn dữ liệu, một khoảng thời gian chung
  for (const call of ['api.systemOverview(token)', 'api.systemContent(token)', "api.usage(token, 'day', days)", 'api.aiUsage(token, days)']) assert.ok(dash.includes(call), call);
  assert.match(dash, /\(\[7, 14, 30\] as const\)/);
  // hàng chỉ số + biểu đồ chuyển tab + ba đồng hồ + bốn thẻ; hàng biểu đồ co giãn theo chiều cao cửa sổ, tối đa 470 px
  for (const id of ['dashboard-metrics', 'dashboard-gauges', 'dashboard-gauge-${g.id}', 'dashboard-tab-${t.value}', 'dashboard-users-trend', 'dashboard-learning-trend', 'dashboard-ai-trend']) assert.ok(dash.includes(id), id);
  // sáu đồng hồ: ba đồng hồ đầu luôn hiện, ba đồng hồ sau chỉ hiện khi ô đủ cao (màn hình lớn)
  for (const id of ['activity', 'content', 'ai', 'schools', 'week', 'today']) assert.ok(dash.includes(`id: '${id}'`), id);
  assert.match(dash, /const moreGauges = wide && gaugeArea >= 360;/);
  assert.match(dash, /flexGrow: 1, flexShrink: 0, flexBasis: 236, maxHeight: 560/);
  assert.match(dash, /contentContainerStyle=\{\{ flexGrow: 1, padding: 10/);
  assert.match(dash, /flexDirection: wide \? 'row' : 'column'/);
  for (const card of ['RolesCard', 'ContentCard', 'UsageCard', 'AiCard']) assert.ok(dash.includes(`<${card} `), card);
  for (const id of ['dashboard-roles', 'dashboard-content', 'dashboard-usage', 'dashboard-ai']) assert.ok(panels.includes(`testID="${id}"`), id);
  // đồng hồ: cung xám nền, cung màu theo tỉ lệ, số lớn, nhãn mức có 5 ô
  assert.match(gauge, /export const gaugeArc = /);
  assert.match(gauge, /const PIPS = 5;/);
  assert.match(gauge, /strokeLinecap="round"/);
  // gauge hẹp (cửa sổ 1280 px) bỏ 5 ô nhỏ để nhãn mức ('Cần xuất bản', 'Thiếu tư liệu') không bị cắt thành 'Cần xuất…'
  assert.match(gauge, /\{width >= 130 \? <View style=\{\{ flexDirection: 'row', gap: 2 \}\}>\{Array\.from\(\{ length: PIPS \}/);
  // biểu đồ gọn: số liệu mốc đang chọn là một dòng phía trên, không phủ lên biểu đồ
  const trend = read('components', 'admin', 'TrendChart.tsx');
  assert.match(trend, /compact\?: boolean; chartHeight\?: number/);
  assert.match(trend, /\{point && !compact && <View pointerEvents="none"/);
});

test('quản trị trường học theo quản trị tổng: Thống kê trường đứng đầu menu và là trang mở đầu; Báo cáo giữ nguyên thứ tự còn lại', () => {
  const school = read('components', 'admin', 'SchoolAdmin.tsx');
  const ids = [...school.slice(school.indexOf('const NAV'), school.indexOf('type Tab')).matchAll(/id: '(\w+)'/g)].map((m) => m[1]);
  assert.deepEqual(ids, ['stats', 'school', 'teachers', 'students', 'classes', 'reports', 'review', 'history', 'journeys', 'lessons', 'questions', 'quizzes', 'game', 'battle', 'war', 'ai', 'research', 'notices', 'surveys', 'logs', 'help']);
  assert.match(school, /usePortalTab<Tab>\('stats', NAV\.map/);
  assert.match(school, /\{ id: 'stats' as const, label: 'Thống kê trường', icon: ChartColumn \}/);
  assert.match(school, /\{tab === 'stats' \? <SchoolDashboard session=\{session\} schoolName=\{school\?\.name\} \/>/);
});

test('trang Thống kê trường: cùng bố cục một màn hình với Thống kê hệ thống, số liệu từ bốn API có sẵn, tiêu đề hai nửa đều nhau', () => {
  const dash = read('components', 'admin', 'SchoolDashboard.tsx');
  const panels = read('components', 'admin', 'DashboardPanels.tsx');
  for (const call of ['api.schoolOverview(token)', "api.usage(token, 'day', days)", 'api.aiUsage(token, days)', "api.results(token, 'grade')"]) assert.ok(dash.includes(call), call);
  for (const id of ['school-metrics', 'school-gauges', 'school-gauge-${g.id}', 'school-tab-${t.value}', 'school-users-trend', 'school-learning-trend', 'school-ai-trend', 'school-range-${n}']) assert.ok(dash.includes(id), id);
  // sáu đồng hồ: ba đồng hồ đầu luôn hiện, ba đồng hồ sau chỉ hiện khi ô đủ cao
  for (const id of ['week', 'today', 'ai', 'participation', 'score', 'accuracy']) assert.ok(dash.includes(`id: '${id}'`), id);
  assert.match(dash, /const moreGauges = wide && gaugeArea >= 360;/);
  assert.match(dash, /flexGrow: 1, flexShrink: 0, flexBasis: 236, maxHeight: 560/);
  assert.match(dash, /const \[titleHead, titleTail\] = splitTitle\('Thống kê trường'\);/);
  // bốn thẻ: cơ cấu người dùng (chỉ giáo viên và học sinh), kết quả theo khối, sử dụng, trợ lý AI không có chi phí
  assert.match(dash, /<RolesCard key="roles" roles=\{\{ student: o\.students, teacher: o\.teachers \}\} only=\{\['student', 'teacher'\]\} \/>/);
  for (const card of ['ResultsCard', 'UsageCard', 'AiCard']) assert.ok(dash.includes(`<${card} `), card);
  assert.match(dash, /<AiCard key="ai" d=\{ai\.data\} days=\{days\} topN=\{height >= 860 \? 3 : 2\} money=\{false\} \/>/);
  assert.match(panels, /testID="school-results"/);
  assert.match(panels, /money \? \['Chi phí ước tính'/);
  assert.match(panels, /newUsers != null \?/);
});

test('quản trị trường học theo quản trị tổng: bộ lọc kiểu Excel ở tiêu đề cột cho giáo viên, học sinh, lớp học, câu hỏi, bộ đề, bài học, hành trình, duyệt nội dung và kho lịch sử', () => {
  const read2 = (f) => read('components', 'admin', f);
  const want = {
    'SchoolPeople.tsx': ["key: 'subject', filter: f_subject", "key: 'status', filter: f_active", "key: 'grade', filter: f_grade", "key: 'classes', filter: f_class"],
    'SchoolClasses.tsx': ["key: 'grade', filter: f_grade", "key: 'status', filter: f_active"],
    'QuestionBank.tsx': ["key: 'qtype', filter: f_qtype", "key: 'campaign', filter: f_campaign", "key: 'scope', filter: f_store", "key: 'diff', filter: f_difficulty"],
    'QuizManager.tsx': ["key: 'scope', filter: f_store"],
    'LessonManager.tsx': ["key: 'campaign', filter: f_campaign", "key: 'status', filter: f_status"],
    'JourneyManager.tsx': ["key: 'campaign', filter: f_campaign", "key: 'scope', filter: f_store"],
    'ShareInbox.tsx': ["key: 'entity', filter: f_entity", "key: 'status', filter: f_status"],
    'HistoryManager.tsx': ["filter: f_campaign", "filter: f_group", "key: 'status', filter: f_status"],
  };
  for (const [file, parts] of Object.entries(want)) {
    const src = read2(file);
    for (const part of parts) assert.ok(src.includes(part), `${file}: ${part}`);
    assert.ok(src.includes('<SearchFilterBar '), `${file} dùng thanh tìm kiếm chung`);
  }
  // giá trị tự do (Bộ môn): gõ chữ rồi chọn dòng "Lọc theo …"
  assert.match(read2('SchoolPeople.tsx'), /key: 'subject', label: 'Bộ môn', custom: true/);
  assert.match(kit, /custom\?: boolean;/);
  assert.match(kit, /col-filter-\$\{filter\.key\}-option-custom/);
  // năm học đặt cạnh ô tìm kiếm bằng ô chọn không nhãn, các trang chọn theo năm vẫn chọn được
  assert.match(read2('AdminSelect.tsx'), /bare\?: boolean;/);
  assert.match(read2('SchoolPeople.tsx'), /<AdminSelect bare label="Năm học \(để lọc lớp\)"/);
  assert.match(read2('SchoolClasses.tsx'), /<AdminSelect bare label="Năm học"/);
});
