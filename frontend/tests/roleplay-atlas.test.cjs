const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),ts=require('typescript');
const root=path.join(__dirname,'..');
function load(file,requireStub=()=>{throw Error('Unexpected dependency');}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2019}}).outputText,{exports,require:requireStub});return exports;}
const atlas=load('lib/roleplay-atlas.ts'),story=load('lib/roleplay-story.ts'),{advanceAtlas}=load('lib/atlas-playback.ts');

test('authentic relief crop and geographic markers share the exact same coordinate system',()=>{
  const meta=JSON.parse(fs.readFileSync(path.join(root,'assets/roleplay-atlas/relief-metadata.json'),'utf8')),bounds=atlas.ATLAS_BOUNDS;
  for(const key of ['west','east','north','south']) assert.equal(meta.bounds[key],bounds[key]);
  assert.deepEqual(Array.from(atlas.geoPoint([bounds.west,bounds.north])),[0,0]);
  assert.deepEqual(Array.from(atlas.geoPoint([bounds.east,bounds.south])),[bounds.width,bounds.height]);
  const image=fs.readFileSync(path.join(root,'assets/roleplay-atlas/eurasia-relief.webp'));
  assert.equal(crypto.createHash('sha256').update(image).digest('hex'),meta.output_sha256);
  const moscow=atlas.geoPoint(atlas.findAtlasPlace('moscow').at),kyiv=atlas.geoPoint(atlas.findAtlasPlace('kyiv').at),mongolia=atlas.geoPoint(atlas.findAtlasPlace('mongolia').at);
  assert.ok(moscow[0]<mongolia[0]&&moscow[1]<mongolia[1]);assert.ok(kyiv[0]<moscow[0]&&kyiv[1]>moscow[1]);
});

test('each narrative camera contains its primary location and all routes stay inside the real map',()=>{
  for(const chapter of story.ROLEPLAY_CHAPTERS){const [x,y,w,h]=atlas.ATLAS_CAMERA[chapter.id];const place=atlas.findAtlasPlace(chapter.places[0]);assert.ok(place,chapter.id);const [px,py]=atlas.geoPoint(place.at);assert.ok(px>=x&&px<=x+w&&py>=y&&py<=y+h,chapter.id);}
  for(const route of Object.values(atlas.ATLAS_ROUTES)) for(const point of route){const [x,y]=atlas.geoPoint(point);assert.ok(x>=0&&x<=1400&&y>=0&&y<=650);}
  const route=atlas.ATLAS_ROUTES.kalka;
  assert.deepEqual(Array.from(atlas.routePosition(route,-2)),Array.from(atlas.geoPoint(route[0])));
  assert.deepEqual(Array.from(atlas.routePosition(route,3)),Array.from(atlas.geoPoint(route.at(-1)))) ;
  assert.match(atlas.findAtlasPlace('kalka').name,/ước lệ/);
});

test('playback pauses without consuming time, advances one scene and stops at the final mission',()=>{
  const durations=story.ROLEPLAY_CHAPTERS.map(ch=>ch.duration),paused={index:0,elapsed:7,playing:false};assert.equal(advanceAtlas(paused,1,durations),paused);
  const next=advanceAtlas({index:0,elapsed:durations[0]-.1,playing:true},.2,durations);assert.equal(next.index,1);assert.equal(next.elapsed,0);
  const last=advanceAtlas({index:durations.length-2,elapsed:durations.at(-2)-.1,playing:true},.2,durations);assert.equal(last.index,durations.length-1);assert.equal(last.playing,false);
  assert.equal(advanceAtlas({index:0,elapsed:0,playing:true},3600,durations).elapsed,.25);
});

test('timeline corrects the transcribed dates and keeps later campaigns under the correct generation',()=>{
  const first=story.ROLEPLAY_CHAPTERS.slice(0,5);assert.deepEqual(Array.from(first,c=>c.year),[1206,1219,1223,1238,1240]);
  assert.match(first[2].body,/Rus’.*Cuman/);assert.match(first[3].body,/mất năm 1227/);assert.match(first[3].body,/Batu/);
  assert.ok(story.ROLEPLAY_CHAPTERS.every(c=>c.sources.length&&c.source));
  assert.doesNotMatch(story.ROLEPLAY_CHAPTERS.map(c=>c.body).join(' '),/năm 2006|năm 1233|cỏ không mọc/);
  const lobby=fs.readFileSync(path.join(root,'components/portal/RolePlayLobby.tsx'),'utf8'),entry=fs.readFileSync(path.join(root,'game/index.ts'),'utf8');
  assert.doesNotMatch(lobby,/RolePlayWorld/);assert.doesNotMatch(entry,/createHistoricalGame|from '.\/historical-game'/);
  assert.match(entry,/bridge\.set\('game:renderer', '2d'\)/);
  assert.equal(fs.existsSync(path.join(root,'app/atlas-preview.tsx')),false,'local-only preview must not be exported');
});

test('2D figures have complete walking frames and all server sprite/item keys exist without voxel textures',()=>{
  const art=load('game/cartographic-art.ts'),{LOOKS}=load('game/pixel.ts'),store=new Map();
  const noop=()=>{},context=new Proxy({createLinearGradient:()=>({addColorStop:noop}),createRadialGradient:()=>({addColorStop:noop})},{get:(obj,key)=>key in obj?obj[key]:noop});
  const textures={exists:key=>store.has(key),createCanvas(key,width,height){assert.ok(!store.has(key));const frames=[];const item={width,height,frames,getContext:()=>context,refresh:noop,add(name,_,x,y,w,h){assert.ok(x>=0&&y>=0&&x+w<=width&&y+h<=height,`${key}:${name}`);frames.push(name);}};store.set(key,item);return item;}};
  art.makeMapChar({textures},'ch_player',LOOKS.player);assert.equal(store.get('ch_player').frames.length,9);
  art.makeMapUnits({textures},LOOKS);art.makeMapProps({textures});
  for(const sprite of ['bo','cung','tuong','vua','ky','voi','thuyen','thuyen_nhe','luong','e_bo','e_cung','e_tuong','e_ky','e_thuyen','e_luong'])assert.ok(store.has(`map_u_${sprite}`),sprite);
  for(const item of ['plank','rice','flag','scroll','token','torch','horn','stake'])assert.ok(store.has(`map_it_${item}`),item);
  assert.ok([...store.keys()].every(key=>!key.includes('voxel')));
});
