const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const parserPath = path.join(__dirname, '..', 'utils', 'docxQuizParser.ts');
const studioPath = path.join(__dirname, '..', 'components', 'admin', 'SmartExamStudio.tsx');
const quizManagerPath = path.join(__dirname, '..', 'components', 'admin', 'QuizManager.tsx');
const aiHubPath = path.join(__dirname, '..', 'components', 'ai', 'AiHubDashboard.tsx');
const tieuTuongPath = path.join(__dirname, '..', 'components', 'portal', 'TieuTuong.tsx');

test('docxQuizParser.ts supports dynamic .docx XML parsing, inline & table answers, and 9 question types', () => {
  assert.ok(fs.existsSync(parserPath), 'docxQuizParser.ts must exist');
  const content = fs.readFileSync(parserPath, 'utf8');
  assert.match(content, /extractXmlFromDocxBuffer/);
  assert.match(content, /convertDocxXmlToText/);
  assert.match(content, /parseExamDocumentText/);
  assert.match(content, /createBlankQuestion/);
  assert.match(content, /generateMixedExamVariants/);
  assert.match(content, /buildPrintableWordHtml/);
  assert.match(content, /title_group/);
  assert.match(content, /drag_drop/);
  assert.match(content, /dropdown/);
});

test('SmartExamStudio.tsx implements clean 2048.vn-style Upload, Editor, 9-Type Picker, Eye Slide Preview, and Teacher Publish to Library workflow', () => {
  assert.ok(fs.existsSync(studioPath), 'SmartExamStudio.tsx must exist');
  const content = fs.readFileSync(studioPath, 'utf8');
  assert.match(content, /smart-tab-upload/);
  assert.match(content, /smart-tab-editor/);
  assert.match(content, /smart-tab-mix/);
  assert.doesNotMatch(content, /smart-tab-flashcards/);
  assert.doesNotMatch(content, /smart-tab-preview/);
  assert.match(content, /smart-publish-library-btn/);
  assert.match(content, /editor-save-draft-btn/);
  assert.match(content, /editor-publish-btn/);
  assert.match(content, /open-qtype-picker-btn/);
  assert.match(content, /save-purple-question/);
  assert.match(content, /download-mixed-word/);
  assert.match(content, /submit-smart-exam/);
  // Đảm bảo đã bỏ các nút đề mẫu cố định ở màn hình Upload (Note 1)
  assert.doesNotMatch(content, /Đề mẫu Docx \(Giữa HK1 Sử & Địa 7\)/);
  assert.doesNotMatch(content, /Tải File Đề mẫu về máy/);
});

test('teacher-library.ts & TeacherLibraryView.tsx support Folders, Created by Me, Collections, and Publish toggles', () => {
  const ts = require('typescript');
  const libSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'teacher-library.ts'), 'utf8');
  const transpiled = ts.transpileModule(libSrc, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;

  const mod = { exports: {} };
  new Function('exports', 'require', 'module', transpiled)(mod.exports, require, mod);
  const {
    createInitialTeacherLibraryState,
    upsertExamInState,
    toggleExamPublishedInState,
    createFolderInState,
    createCollectionInState,
    duplicateExamInState,
    deleteExamInState,
  } = mod.exports;

  let state = createInitialTeacherLibraryState();
  assert.equal(state.folders.length, 1);
  assert.equal(state.folders[0].name, 'Ngân hàng đề thi');

  state = createFolderInState(state, 'Lớp 7A1 - Sử');
  assert.equal(state.folders.length, 2);

  state = createCollectionInState(state, 'Ôn thi Học kỳ 1');
  assert.equal(state.collections.length, 1);

  const res = upsertExamInState(state, {
    title: 'quiz_word_sample_ex2',
    published: true,
    durationMinutes: 45,
    questions: [],
    authorName: 'Nguyễn Đức Anh',
  });
  state = res.state;
  assert.equal(state.exams.length, 1);
  assert.equal(state.exams[0].published, true);

  state = toggleExamPublishedInState(state, res.saved.id);
  assert.equal(state.exams[0].published, false);

  state = duplicateExamInState(state, res.saved.id);
  assert.equal(state.exams.length, 2);

  state = deleteExamInState(state, res.saved.id);
  assert.equal(state.exams.length, 1);

  const viewSrc = fs.readFileSync(path.join(__dirname, '..', 'components', 'admin', 'TeacherLibraryView.tsx'), 'utf8');
  assert.match(viewSrc, /library-nav-\$\{item\.id\}/);
  assert.match(viewSrc, /library-filter-\$\{pill\.id\}/);
  assert.match(viewSrc, /id: 'folders'/);
  assert.match(viewSrc, /id: 'created_by_me'/);
  assert.match(viewSrc, /Switch/);

  const teacherApp = fs.readFileSync(path.join(__dirname, '..', 'components', 'portal', 'TeacherApp.tsx'), 'utf8');
  assert.match(teacherApp, /TeacherLibraryView/);
  assert.match(teacherApp, /Thư viện học liệu/);
});

test('AiHubDashboard and TieuTuong follow Notes 3, 4, 5, 6 and student role logic (no Word exam authoring in student hub, uses PersonalizedRoadmapView)', () => {
  const qm = fs.readFileSync(quizManagerPath, 'utf8');
  assert.match(qm, /SmartExamStudio/);
  assert.match(qm, /quiz-word-import/);
  assert.match(qm, /quiz-mix/);

  const hub = fs.readFileSync(aiHubPath, 'utf8');
  assert.doesNotMatch(hub, /SmartExamStudio/);
  assert.doesNotMatch(hub, /Số hóa Đề Word/);
  assert.match(hub, /PersonalizedRoadmapView/);
  assert.match(hub, /aihub-roadmap-btn/);
  assert.doesNotMatch(hub, /Summarizer — Tóm tắt Chuyên đề/);
  assert.doesNotMatch(hub, /Sinh đề AI nhanh/);

  const tt = fs.readFileSync(tieuTuongPath, 'utf8');
  assert.doesNotMatch(tt, /Chế độ tương tác thông minh trên Chat/);
});
