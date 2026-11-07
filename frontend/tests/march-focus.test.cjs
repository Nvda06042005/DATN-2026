// HK.HS.124 – nút "Ra trận" của nút trận đánh trong lộ trình học đưa học sinh tới đúng điểm trận đánh trên bản đồ hành quân.
// Các thành phần dùng React Native nên không nạp được trong Node: đọc thẳng mã nguồn và kiểm tra các mắt xích nối nhau (chi tiết nút → ứng dụng học sinh → bản đồ hành quân).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');
const quest = read('components', 'portal', 'QuestMap.tsx');
const app = read('components', 'portal', 'StudentApp.tsx');
const play = read('components', 'portal', 'WarPlay.tsx');
const types = read('types', 'learning.ts');

test('chi tiết nút trận đánh mang điểm trận trên bản đồ và nút "Ra trận" chuyển điểm đó đi tiếp', () => {
  assert.match(types, /march\?: \{ campaign_id: number; point_id: number \} \| null/);
  assert.match(quest, /onStage: \(stageId: number, march\?: \{ campaign_id: number; point_id: number \} \| null\) => void/);
  assert.match(quest, /actions\.onStage\(d\.stage_id!, d\.march\)/);
});

test('ứng dụng học sinh: có điểm trên bản đồ và game đang mở thì sang bản đồ hành quân, không thì mở màn giới thiệu; rời tab Chiến dịch thì bỏ điểm đã chọn', () => {
  assert.match(app, /onStage: \(id, march\) => \{\s*if \(march && warOn\) \{ setMarchFocus\(march\); setHomeMode\('march'\); setCampaignId\(null\); setFocusNode\(null\); setTab\('home', \{ march_campaign: String\(march.campaign_id\), march_point: String\(march.point_id\)/);
  assert.match(app, /campaign_id: positive\(params.march_campaign\)!, point_id: positive\(params.march_point\)!/);
  assert.match(app, /if \(tab !== 'home'\) setMarchFocus\(null\)/);
  assert.match(app, /<MarchTab [^>]*focus=\{marchFocus\} onFocusDone=\{\(\) => setMarchFocus\(null\)\}/);
});

test('bản đồ hành quân: mở đúng bản đồ của cuộc kháng chiến, cuộn tới và viền nổi điểm trận, có nút "Ra trận tại …" và bỏ chọn khi đã tới hoặc quay lại', () => {
  assert.match(play, /useState<number \| null>\(focus\?\.campaign_id \?\? null\)/);
  assert.match(play, /useEffect\(\(\) => \{ if \(focus\) setCampaign\(focus\.campaign_id\); \}, \[focus\]\)/);
  assert.match(play, /focusPointId=\{focus && focus\.campaign_id === campaign \? focus\.point_id : null\}/);
  assert.match(play, /const target = focusPointId \?/);
  assert.match(play, /hscroll\.current\?\.scrollTo\(\{ x: Math\.max\(0, \(target\.x \/ 100\) \* w - room \/ 2\)/);
  assert.match(play, /testID="march-focus-go"/);
  assert.match(play, /if \(target\?\.id === p\.id\) onFocusDone\?\.\(\)/);
  assert.match(play, /onBack=\{\(\) => \{ setCampaign\(null\); onFocusDone\?\.\(\); \}\}/);
});
