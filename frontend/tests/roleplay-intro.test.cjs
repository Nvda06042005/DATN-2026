const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.join(__dirname, '..');
function load(file, requireStub = () => { throw Error('Unexpected runtime dependency'); }) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 } }).outputText;
  vm.runInNewContext(code, { exports, require: requireStub });
  return exports;
}
const story = load('lib/roleplay-story.ts');
const stage = (state, explore, battle = 'locked', hasBattle = true) => ({ state, has_battle: hasBattle, steps: { explore, battle } });

test('intro cannot unlock a stage; entry and battle replay require the server stage permissions', () => {
  for (const status of ['locked','none']) assert.equal(story.canExploreStage(stage('ready',status)),false);
  assert.equal(story.canExploreStage(stage('locked','ready')),false);
  assert.equal(story.canExploreStage(stage('learning','ready')),true);
  assert.equal(story.canExploreStage(stage('done','done')),true);
  assert.equal(story.canReplayBattle(stage('locked','done','done')),false);
  assert.equal(story.canReplayBattle(stage('ready','done','ready')),false);
  assert.equal(story.canReplayBattle(stage('done','done','done',false)),false);
  assert.equal(story.canReplayBattle(stage('done','done','done')),true);
});

test('historical opening has its prior context, distinguishes the three campaigns and supplies source notes', () => {
  const chapters = story.ROLEPLAY_CHAPTERS;
  assert.equal(chapters[0].id,'foundation');
  assert.equal(chapters[0].year,1206);
  assert.equal(chapters[1].id,'west');
  assert.deepEqual(Array.from(chapters.slice(0,5),c=>c.year),[1206,1219,1223,1238,1240]);
  assert.match(chapters.find(c=>c.id==='warning').time,/1257/);
  assert.match(chapters.find(c=>c.id==='first').body,/Trần Thái Tông/);
  const later = chapters.find(c=>c.id==='later');
  assert.match(later.time,/1285.*1287–1288/);
  assert.match(later.body,/Vua đương triều là Trần Nhân Tông/);
  assert.match(later.body,/Thượng hoàng Trần Thánh Tông/);
  assert.ok(chapters.every(c=>c.source && c.question));
  assert.match(chapters[chapters.length-1].source,/hư cấu/);
});

test('voxel texture generation is deterministic, registers all animation frames and stays within the canvas', () => {
  class Context {
    constructor(w,h){this.w=w;this.h=h;this.tx=0;this.ty=0;this.stack=[];}
    check(x,y){assert.ok(Number.isFinite(x)&&Number.isFinite(y));assert.ok(x>=0&&x<=this.w,`x=${x}, canvas=${this.w}`);assert.ok(y>=0&&y<=this.h,`y=${y}, canvas=${this.h}`);}
    fillRect(x,y,w,h){assert.ok(w>=0&&h>=0);this.check(x+this.tx,y+this.ty);this.check(x+this.tx+w,y+this.ty+h);}
    beginPath(){} closePath(){} fill(){} moveTo(x,y){this.check(x+this.tx,y+this.ty);} lineTo(x,y){this.moveTo(x,y);}
    save(){this.stack.push([this.tx,this.ty]);} restore(){[this.tx,this.ty]=this.stack.pop();} translate(x,y){this.tx+=x;this.ty+=y;}
  }
  const store = new Map();
  const textures = { exists:key=>store.has(key), createCanvas(key,w,h){assert.ok(!store.has(key));const frames=[];const ctx=new Context(w,h);const item={frames,getContext:()=>ctx,add(name,_,x,y,fw,fh){ctx.check(x,y);ctx.check(x+fw,y+fh);frames.push(name);},refresh(){}};store.set(key,item);return item;} };
  const voxel = load('game/voxel.ts', name => {assert.equal(name,'./pixel');return {TILE:16};});
  voxel.makeVoxelWorld({textures});
  voxel.makeVoxelWorld({textures});
  assert.equal(store.get('voxel-tiles').frames.length,9);
  for(const hat of ['band','helmet','crown','non','cap','scarf','bun']) {
    voxel.makeVoxelChar({textures},`test-${hat}`,{skin:'#ecc6a0',hair:'#222222',robe:'#b64d3d',trim:'#e4c778',belt:'#454444',hat,hatColor:'#bb9955',beard:'#333333'});
    assert.equal(store.get(`test-${hat}`).frames.length,9);
  }
});
