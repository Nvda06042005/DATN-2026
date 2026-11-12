const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

const libPath = path.join(__dirname, '../lib/learning-path.ts');
const compiled = ts.transpileModule(fs.readFileSync(libPath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loaded = { exports: {} };
new vm.Script(`(function(module,exports){${compiled}\n})`).runInThisContext()(loaded, loaded.exports);
const lp = loaded.exports;

function relativeLuminance(hex) {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(n.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hexA, hexB) {
  const la = relativeLuminance(hexA);
  const lb = relativeLuminance(hexB);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function samplePath() {
  return {
    parts: [
      {
        no: 1,
        campaign: { id: 1, title: 'Kháng chiến lần I', year_label: '1258', summary: 'Vườn không nhà trống.' },
        journey: { id: 1, title: 'Lần I', from_class: false },
        totals: { nodes: 6, done: 6 },
        gates: [
          {
            id: 11,
            no: 1,
            title: 'Bình Lệ Nguyên',
            summary: 'Mở đầu',
            done: 6,
            state: 'done',
            nodes: Array.from({ length: 6 }, (_, i) => ({
              id: 100 + i,
              position: i + 1,
              kind: i === 4 ? 'chest' : i === 5 ? 'gate_test' : 'lesson',
              kind_label: i === 4 ? 'Rương' : 'Bài học',
              title: `Bài ${i + 1}`,
              icon: null,
              state: 'done',
              stars: 3,
              best_percent: 100,
              reward_points: 50,
              lock_reason: null,
              steps: { done: 1, total: 1 },
            })),
          },
        ],
      },
      {
        no: 2,
        campaign: { id: 2, title: 'Kháng chiến lần II', year_label: '1285', summary: null },
        journey: { id: 2, title: 'Lần II', from_class: false },
        totals: { nodes: 8, done: 2 },
        gates: [
          {
            id: 21,
            no: 1,
            title: 'Từ Bình Than đến Diên Hồng',
            summary: 'Chuẩn bị kháng chiến',
            done: 2,
            state: 'current',
            nodes: [1, 2, 3, 4].map((n) => ({
              id: 200 + n,
              position: n,
              kind: n === 4 ? 'gate_test' : 'lesson',
              kind_label: 'Bài học',
              title: `Cửa 1 - Bài ${n}`,
              icon: null,
              state: n <= 2 ? 'done' : n === 3 ? 'available' : 'locked',
              stars: n <= 2 ? 3 : 0,
              best_percent: n <= 2 ? 100 : 0,
              reward_points: 50,
              lock_reason: n === 4 ? 'Làm bài trước' : null,
              steps: { done: n <= 2 ? 1 : 0, total: 2 },
            })),
          },
          {
            id: 22,
            no: 2,
            title: 'Hàm Tử – Chương Dương',
            summary: 'Tổng phản công',
            done: 0,
            state: 'locked',
            nodes: [5, 6, 7, 8].map((n) => ({
              id: 200 + n,
              position: n,
              kind: n === 8 ? 'final' : 'battle',
              kind_label: 'Trận đánh',
              title: `Cửa 2 - Bài ${n}`,
              icon: null,
              state: 'locked',
              stars: 0,
              best_percent: 0,
              reward_points: 80,
              lock_reason: 'Qua cửa 1 trước',
              steps: { done: 0, total: 1 },
            })),
          },
        ],
      },
      {
        no: 3,
        campaign: { id: 3, title: 'Kháng chiến lần III', year_label: '1288', summary: 'Bạch Đằng giang.' },
        journey: { id: 3, title: 'Lần III', from_class: false },
        totals: { nodes: 2, done: 0 },
        gates: [
          {
            id: 31,
            no: 1,
            title: 'Vân Đồn',
            summary: 'Cắt lương',
            done: 0,
            state: 'current',
            nodes: [
              { id: 301, position: 1, kind: 'lesson', kind_label: 'Bài học', title: 'Trận Vân Đồn', icon: null, state: 'available', stars: 0, best_percent: 0, reward_points: 50, lock_reason: null, steps: { done: 0, total: 2 } },
              { id: 302, position: 2, kind: 'final', kind_label: 'Quyết chiến', title: 'Bạch Đằng', icon: null, state: 'locked', stars: 0, best_percent: 0, reward_points: 100, lock_reason: 'Học trước', steps: { done: 0, total: 1 } },
            ],
          },
        ],
      },
    ],
    current: { part_no: 2, gate_no: 1, gate_title: 'Từ Bình Than đến Diên Hồng', node_id: 203 },
  };
}

test('bảng màu theo từng Cửa đạt tương phản chữ trắng WCAG AA (>= 4.5:1) và xoay vòng không lỗi', () => {
  assert.ok(lp.UNIT_THEMES.length >= 6);
  for (const theme of lp.UNIT_THEMES) {
    const ratio = contrastRatio(theme.bg, '#ffffff');
    assert.ok(ratio >= 4.5, `Màu ${theme.id} (${theme.bg}) có tương phản ${ratio.toFixed(2)} < 4.5`);
  }
  assert.equal(lp.unitTheme(0).id, 'ngoc');
  assert.equal(lp.unitTheme(1).id, 'hongMai');
  assert.equal(lp.unitTheme(6).id, 'ngoc');
});

test('phân loại 3 trạng thái Phần giống Duolingo: Đã hoàn thành / Đang học / Nhảy tới Phần sau', () => {
  const path = samplePath();
  const focus = lp.defaultFocusPartNo(path);
  assert.equal(focus, 2);
  assert.equal(lp.classifySection(path.parts[0], focus), 'completed');
  assert.equal(lp.classifySection(path.parts[1], focus), 'active');
  assert.equal(lp.classifySection(path.parts[2], focus), 'upcoming');
  assert.equal(lp.sectionPercent(path.parts[1]), 25);
  assert.equal(lp.sectionSummary(path.parts[1]), 'Chuẩn bị kháng chiến');
  assert.equal(lp.resolveSelectedPartNo(path, null), 2);
  assert.equal(lp.resolveSelectedPartNo(path, 3), 3);
});

test('xếp đường S-curve, đặt linh vật ở hốc trống đối diện và không chồng lấn nút tròn cùng hàng', () => {
  const path = samplePath();
  const { items, height } = lp.layoutPartPath(path.parts[1], path.parts[2]);
  assert.ok(height > 0);
  const dividers = items.filter((i) => i.type === 'divider');
  const nodes = items.filter((i) => i.type === 'node');
  const mascots = items.filter((i) => i.type === 'mascot');
  const next = items.find((i) => i.type === 'next_section');
  assert.equal(dividers.length, 2);
  assert.equal(dividers[0].showRule, false);
  assert.equal(dividers[1].showRule, true);
  assert.equal(nodes.length, 8);
  assert.ok(mascots.length >= 2);
  assert.equal(next.nextPart.no, 3);

  // Linh vật không được đè lên vòng tròn nút ở các hàng lân cận
  for (const m of mascots) {
    const mLeft = m.offsetX - lp.MASCOT_SIZE / 2;
    const mRight = m.offsetX + lp.MASCOT_SIZE / 2;
    const mTop = m.top;
    const mBottom = m.top + lp.MASCOT_SIZE;
    for (const n of nodes) {
      const nTop = n.top + 12;
      const nBottom = nTop + lp.CIRCLE;
      const vOverlap = mTop < nBottom && mBottom > nTop;
      if (!vOverlap) continue;
      const nLeft = n.x - lp.CIRCLE / 2;
      const nRight = n.x + lp.CIRCLE / 2;
      const hOverlap = mLeft < nRight && mRight > nLeft;
      assert.equal(hOverlap, false, `Linh vật tại y=${m.top} x=[${mLeft},${mRight}] đè nút ${n.node.id} x=[${nLeft},${nRight}]`);
    }
  }

  // Cuộn qua ranh giới Cửa -> băng tiêu đề chuyển sang Cửa 2 và đổi màu
  const firstActive = lp.activeGateItem(items, 0);
  const secondActive = lp.activeGateItem(items, dividers[1].top + 10);
  assert.equal(firstActive.gate.no, 1);
  assert.equal(secondActive.gate.no, 2);
  assert.notEqual(lp.unitTheme(firstActive.unitIndex).bg, lp.unitTheme(secondActive.unitIndex).bg);

  // Nút cuộn nhanh ↑ / ↓ xuất hiện đúng hướng khi nút hiện tại trôi khỏi màn hình
  assert.equal(lp.scrollButtonDirection(500, 0, 400), 'down');
  assert.equal(lp.scrollButtonDirection(100, 300, 400), 'up');
  assert.equal(lp.scrollButtonDirection(200, 100, 500), null);
});

test('cấu trúc giao diện giữ đủ nút chuyển Phần ←, Hướng dẫn, Học tiếp và nút trên đường', () => {
  const pathSrc = fs.readFileSync(path.join(__dirname, '../components/portal/LearningPath.tsx'), 'utf8');
  const secSrc = fs.readFileSync(path.join(__dirname, '../components/portal/LearningSections.tsx'), 'utf8');
  const popSrc = fs.readFileSync(path.join(__dirname, '../components/portal/PathNodePopover.tsx'), 'utf8');

  assert.match(pathSrc, /testID="path-banner"/);
  assert.match(pathSrc, /testID="path-sections-back"/);
  assert.match(pathSrc, /testID="path-guide"/);
  assert.match(pathSrc, /testID="path-continue"/);
  assert.match(pathSrc, /testID="path-jump-scroll"/);
  assert.match(pathSrc, /testID=\{`path-node-\$\{node\.id\}`\}/);
  assert.match(pathSrc, /<TreasureChestArt/);

  assert.match(secSrc, /testID="sections-back"/);
  assert.match(secSrc, /testID=\{`section-review-\$\{part\.no\}`\}/);
  assert.match(secSrc, /testID=\{`section-continue-\$\{part\.no\}`\}/);
  assert.match(secSrc, /testID=\{`section-jump-\$\{part\.no\}`\}/);

  assert.match(popSrc, /testID="node-start"/);
  assert.match(popSrc, /testID="node-stage"/);
});
