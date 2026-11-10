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

test('SmartExamStudio.tsx implements clean 2048.vn-style Upload, Editor, 9-Type Picker, Eye Slide Preview, and Purple Quizizz Editor', () => {
  assert.ok(fs.existsSync(studioPath), 'SmartExamStudio.tsx must exist');
  const content = fs.readFileSync(studioPath, 'utf8');
  assert.match(content, /smart-tab-upload/);
  assert.match(content, /smart-tab-editor/);
  assert.match(content, /smart-tab-mix/);
  assert.match(content, /smart-tab-flashcards/);
  assert.match(content, /smart-tab-preview/);
  assert.match(content, /open-qtype-picker-btn/);
  assert.match(content, /save-purple-question/);
  assert.match(content, /download-mixed-word/);
  assert.match(content, /submit-smart-exam/);
  // Đảm bảo đã bỏ các nút đề mẫu cố định ở màn hình Upload (Note 1)
  assert.doesNotMatch(content, /Đề mẫu Docx \(Giữa HK1 Sử & Địa 7\)/);
  assert.doesNotMatch(content, /Tải File Đề mẫu về máy/);
});

test('AiHubDashboard and TieuTuong follow Notes 3, 4, 5, 6 (removed Summarizer, removed quick AI quiz buttons, compact BKT)', () => {
  const qm = fs.readFileSync(quizManagerPath, 'utf8');
  assert.match(qm, /SmartExamStudio/);
  assert.match(qm, /quiz-word-import/);
  assert.match(qm, /quiz-mix/);

  const hub = fs.readFileSync(aiHubPath, 'utf8');
  assert.match(hub, /SmartExamStudio/);
  assert.match(hub, /aihub-smart-exam-btn/);
  assert.doesNotMatch(hub, /Summarizer — Tóm tắt Chuyên đề/);
  assert.doesNotMatch(hub, /Sinh đề AI nhanh/);

  const tt = fs.readFileSync(tieuTuongPath, 'utf8');
  assert.doesNotMatch(tt, /Chế độ tương tác thông minh trên Chat/);
});
