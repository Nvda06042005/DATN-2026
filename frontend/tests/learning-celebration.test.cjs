const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

const libPath = path.join(__dirname, '../lib/learning-celebration.ts');
const compiled = ts.transpileModule(fs.readFileSync(libPath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loaded = { exports: {} };
new vm.Script(`(function(module,exports){${compiled}\n})`).runInThisContext()(loaded, loaded.exports);
const lc = loaded.exports;

const q = (id, title, progress, target, rewardGold = 10, rewardXp = 20, completedAt = null) => ({
  id,
  title,
  metric: 'xp_earned',
  target,
  progress,
  reward_xp: rewardXp,
  reward_gold: rewardGold,
  completed_at: completedAt,
  period: 'daily',
});

test('computeQuestDeltas detects newly completed vs already done vs advancing quests', () => {
  const before = [
    q(1, 'Kiếm 50 XP', 50, 50, 10, 20, '2026-11-12T08:00:00Z'),
    q(2, 'Hoàn thành 1 nút', 0, 1, 5, 20, null),
    q(3, 'Trả lời đúng 10 câu', 4, 10, 10, 30, null),
  ];
  const after = [
    q(1, 'Kiếm 50 XP', 50, 50, 10, 20, '2026-11-12T08:00:00Z'),
    q(2, 'Hoàn thành 1 nút', 1, 1, 5, 20, '2026-11-12T11:45:00Z'),
    q(3, 'Trả lời đúng 10 câu', 7, 10, 10, 30, null),
  ];
  const deltas = lc.computeQuestDeltas(before, after);
  assert.equal(deltas.length, 3);
  assert.equal(deltas[0].alreadyDone, true);
  assert.equal(deltas[0].justCompleted, false);
  assert.equal(deltas[1].prevProgress, 0);
  assert.equal(deltas[1].nextProgress, 1);
  assert.equal(deltas[1].justCompleted, true);
  assert.equal(deltas[2].prevProgress, 4);
  assert.equal(deltas[2].nextProgress, 7);
  assert.equal(deltas[2].justCompleted, false);
});

test('buildCelebrationSteps includes summary, quests, and chest when newly completed quest or gold earned', () => {
  const deltas = lc.computeQuestDeltas(
    [q(1, 'Nhiệm vụ 1', 0, 1, 9, 20, null)],
    [q(1, 'Nhiệm vụ 1', 1, 1, 9, 20, '2026-11-12T11:45:00Z')],
  );
  const rewards = lc.summarizeEarnedRewards({ questDeltas: deltas });
  assert.equal(rewards.totalGold, 9);
  assert.equal(rewards.questBonusXp, 20);
  assert.equal(rewards.hasChestReward, true);
  assert.deepEqual(lc.buildCelebrationSteps({ questDeltas: deltas, rewards }), ['summary', 'quests', 'chest']);
  assert.equal(lc.chestPrimaryHeadline(rewards), '+9 vàng');
  assert.equal(lc.questsStepHeadline(deltas), 'Hoàn thành tất cả nhiệm vụ hôm nay!');
});

test('buildCelebrationSteps omits chest step when no rewards and skips summary for chest node', () => {
  const deltas = lc.computeQuestDeltas(
    [q(1, 'Kiếm 50 XP', 20, 50, 10, 0, null)],
    [q(1, 'Kiếm 50 XP', 40, 50, 10, 0, null)],
  );
  const noRewards = lc.summarizeEarnedRewards({ questDeltas: deltas });
  assert.equal(noRewards.hasChestReward, false);
  assert.deepEqual(lc.buildCelebrationSteps({ questDeltas: deltas, rewards: noRewards }), ['summary', 'quests']);

  const chestNodeReward = lc.summarizeEarnedRewards({
    nodeResult: {
      first_completion: true,
      passed: true,
      stars: 3,
      percent: 100,
      points_awarded: 0,
      unlocked_sources: [],
      rewards: { gold: 0, card: false, badge: null, binh_thu: 2, fragments: [{ card: 'Trần Quốc Toản', qty: 2, merged: false }] },
      next_node: null,
      journey_completed: false,
    },
  });
  assert.deepEqual(
    lc.buildCelebrationSteps({ skipSummary: true, questDeltas: deltas, rewards: chestNodeReward }),
    ['quests', 'chest'],
  );
  assert.equal(lc.chestPrimaryHeadline(chestNodeReward), '+2 Binh thư');
});

test('accuracyTagFor and monthlyChallengeInfo format labels accurately', () => {
  assert.equal(lc.accuracyTagFor(95, true), 'TUYỆT VỜI!');
  assert.equal(lc.accuracyTagFor(80, true), 'RẤT TỐT!');
  assert.equal(lc.accuracyTagFor(60, true), 'HOÀN THÀNH!');
  assert.equal(lc.accuracyTagFor(40, false), 'CỐ GẮNG NHÉ!');

  // 2026-11-12T12:00:00+07:00 -> November has 30 days -> 30 - 12 + 1 = 19 days left
  const nov = lc.monthlyChallengeInfo(7, new Date('2026-11-12T12:00:00+07:00').getTime());
  assert.equal(nov.monthLabel, 'THÁNG 11');
  assert.equal(nov.daysLeft, 19);
  assert.equal(nov.done, 7);
});
