const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

test('analyticsApi & types expose student AI profile and actionable BKT metadata', () => {
  const analyticsTypes = read('types/analytics.ts');
  const analyticsApi = read('api/analyticsApi.ts');
  const aiTypes = read('types/ai.ts');

  assert.match(analyticsTypes, /export interface StudentAiProfile\b/);
  assert.match(analyticsApi, /meProfile\s*=.*\/me\/profile/);
  assert.match(aiTypes, /export interface BktProfileSummary\b/);
  assert.match(aiTypes, /action_kind\?:/);
  assert.match(aiTypes, /profile_summary\?:/);
});

test('AiHubDashboard renders AI profile diagnostic strip and actionable Luyện ngay / Học ngay controls', () => {
  const hub = read('components/ai/AiHubDashboard.tsx');
  assert.match(hub, /onStartPractice\?:/);
  assert.match(hub, /onGoLearn\?:/);
  assert.match(hub, /Hồ sơ AI đang đọc từ tiến độ của em/);
  assert.match(hub, /Chưa có lượt làm quiz\/bài học/);
  assert.match(hub, /title="Luyện ngay"/);
  assert.match(hub, /title="Học ngay"/);
});

test('StudentApp wires AiHubDashboard practice and map jump callbacks', () => {
  const app = read('components/portal/StudentApp.tsx');
  assert.match(app, /import \* as analyticsApi from '@\/api\/analyticsApi'/);
  assert.match(app, /handleAiStartPractice/);
  assert.match(app, /analyticsApi\.personalPractice/);
  assert.match(app, /onStartPractice=\{handleAiStartPractice\}/);
  assert.match(app, /onGoLearn=/);
});

test('PersonalizedRoadmapView and personalized-roadmap engine implement 4-step wizard, landing recreate flow, and AI/BKT rebalance', () => {
  const ts = require('typescript');
  const roadmapSrc = read('lib/personalized-roadmap.ts');
  const transpiled = ts.transpileModule(roadmapSrc, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;

  const mod = { exports: {} };
  const fn = new Function('exports', 'require', 'module', transpiled);
  fn(mod.exports, require, mod);
  const {
    createDefaultWizardConfig,
    computePillarWeights,
    generatePersonalizedRoadmap,
    getRoadmapStats,
    toggleRoadmapTaskDone,
    toggleRoadmapTaskPin,
    rebalanceRoadmapWithAiBkt,
  } = mod.exports;

  const cfg = createDefaultWizardConfig();
  assert.equal(cfg.durationDays, 14);
  assert.equal(cfg.dailyMinutes, 30);

  const weights = computePillarWeights({
    ...cfg,
    selfRatings: { KC1: 5, KC2: 2, KC3: 1, NV_NT: 4 },
  });
  assert.equal(weights.KC1 + weights.KC2 + weights.KC3 + weights.NV_NT, 100);
  assert.ok(weights.KC3 > weights.KC1, 'Weaker pillar KC3 should receive a higher weight than strong pillar KC1');

  const bktSample = {
    student_id: 'hs-1',
    total_units: 81,
    weak_count: 2,
    recommendations: [
      {
        unit_id: 'Tran_KC3_BachDang',
        topic: 'Chiến thắng Bạch Đằng 1288',
        current_mastery: 0.25,
        target_mastery: 0.85,
        priority: 'high',
        reason: 'Cần củng cố mốc 9/4/1288',
        action_kind: 'practice',
        topic_type: 'battle',
        topic_id: 3,
      },
    ],
    profile_summary: {
      has_activity: true,
      attempts_count: 5,
      avg_quiz_pct: 62,
      wrong_answers_count: 4,
      due_flashcards_count: 3,
      completed_nodes_count: 4,
      total_nodes_count: 10,
      weak_topics_count: 2,
      next_available_node: { id: 5, title: 'Chiến thắng Bạch Đằng', topic_type: 'battle', topic_id: 3 },
    },
  };

  const plan = generatePersonalizedRoadmap(cfg, bktSample, new Date('2026-11-12T08:00:00Z'));
  assert.equal(plan.days.length, 14);
  assert.ok(plan.days[0].tasks.length >= 2);

  const firstDay = plan.days[0];
  const firstTask = firstDay.tasks[0];
  const toggled = toggleRoadmapTaskDone(plan, firstDay.date, firstTask.id);
  const statsAfterDone = getRoadmapStats(toggled);
  assert.equal(statsAfterDone.doneTasks, 1);

  const pinned = toggleRoadmapTaskPin(toggled, firstDay.date, firstTask.id);
  assert.equal(pinned.days[0].tasks[0].pinned, true);

  const rebalanced = rebalanceRoadmapWithAiBkt(pinned, bktSample);
  assert.ok(rebalanced.lastAiChangeNotes.length >= 1);
  assert.equal(rebalanced.days[0].tasks[0].status, 'done');
  assert.equal(rebalanced.days[0].tasks[0].pinned, true);

  const viewSrc = read('components/ai/PersonalizedRoadmapView.tsx');
  assert.match(viewSrc, /Bắt đầu lập lộ trình/);
  assert.match(viewSrc, /roadmap-recreate-btn/);
  assert.match(viewSrc, /setStage\('landing'\)/);
  assert.match(viewSrc, /Cập nhật bằng AI/);
  assert.match(viewSrc, /Phân bổ luyện tập/);
});

test('TeacherApp removes Mở Sa bàn 3D and AiTeacher synchronizes with AI Hub design', () => {
  const teacherApp = read('components/portal/TeacherApp.tsx');
  assert.doesNotMatch(teacherApp, /Mở Sa bàn 3D/);
  assert.doesNotMatch(teacherApp, /SandPresenter/);
  assert.doesNotMatch(teacherApp, /sand-open/);

  const aiTeacher = read('components/admin/AiTeacher.tsx');
  assert.match(aiTeacher, /Trợ lý AI Giảng dạy Đông A/);
  assert.match(aiTeacher, /teacher-ai-ask-card/);
  assert.match(aiTeacher, /teacher-ai-smart-exam-card/);
  assert.match(aiTeacher, /teacher-ai-authoring-card/);
  assert.match(aiTeacher, /SmartExamStudio/);

  const tt = read('components/portal/TieuTuong.tsx');
  assert.match(tt, /Nội dung tra cứu của thầy cô/);
});
