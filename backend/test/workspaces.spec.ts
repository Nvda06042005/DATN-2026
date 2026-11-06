import { call, hasPostgres, Started, startApp } from './harness';
import { bootstrap, Fixture } from './fixture';
import type { DatabaseService } from '../src/database/database.service';

let s: Started, f: Fixture, db: DatabaseService;
const api = (who: {token:string}, method:string, path:string, body?:unknown) => call(s.base,method,path,body,who.token);
const a = (method:string,path:string,body?:unknown) => api(f.A,method,path,body);
const b = (method:string,path:string,body?:unknown) => api(f.B,method,path,body);
const root = (method:string,path:string,body?:unknown) => call(s.base,method,path,body,f.root);
const ok = (res: {status:number;body:any}, status=200) => { expect({status:res.status,detail:res.body?.detail}).toEqual({status,detail:undefined}); return res.body; };

(hasPostgres()?describe:describe.skip)('School workspaces – quyền thật trên hai trường',()=>{
 beforeAll(async()=>{
   s=await startApp('workspaces_test');
   db=s.moduleRef.get((await import('../src/database/database.service')).DatabaseService);
   const token=(await call(s.base,'POST','/api/auth/login',{username:'admin',password:'admin@123',portal:'root_admin'})).body.token;
   f=await bootstrap(s,token,true);
 });
 afterAll(async()=>{await s?.close();});

 test('tất cả màn đã chuyển có API hoạt động cho quản trị trường, không cấp cho giáo viên',async()=>{
   for(const path of ['/api/admin/history/overview','/api/content/lessons','/api/content/questions','/api/content/quizzes','/api/content/journeys',
    '/api/battle/admin/scenarios','/api/battle/admin/minigames','/api/war/admin/stages','/api/war/admin/maps','/api/war/admin/commanders','/api/war/admin/assets',
    '/api/game/admin/settings','/api/game/admin/levels','/api/game/admin/classes','/api/ai/status','/api/ai/admin/settings','/api/ai/admin/sources','/api/ai/admin/logs',
    '/api/ai/admin/reports','/api/ai/admin/limits','/api/platform/experiments/groups','/api/platform/experiments/classes','/api/platform/research/compare']){
     const res=await a('GET',path); expect([path,res.status,res.body?.detail]).toEqual([path,200,undefined]);
   }
   expect((await api(f.T1,'GET','/api/admin/history/overview')).status).toBe(403);
   expect((await api(f.T1,'PUT','/api/ai/admin/settings',{})).status).toBe(403);
 });

 test('kho lịch sử tạo/sửa/phiên bản trong trường, mẫu hệ thống chỉ đọc',async()=>{
   const shared=ok(await a('GET','/api/admin/history/terms?limit=100')).items[0];
   expect((await a('PATCH',`/api/admin/history/terms/${shared.id}`,{term:'Không được sửa mẫu'})).status).toBe(403);
   const own=ok(await a('POST','/api/admin/history/terms',{term:'Thuật ngữ riêng A',definition:'Nội dung thuộc trường A.'}),201);
   const id=own.id;
   ok(await a('PATCH',`/api/admin/history/terms/${id}`,{definition:'Nội dung đã sửa thuộc trường A.'}));
   expect(ok(await a('GET',`/api/admin/history/terms/${id}/versions`)).length).toBe(2);
   expect((await b('GET',`/api/admin/history/terms/${id}`)).status).toBe(404);
   expect((await b('PATCH',`/api/admin/history/terms/${id}`,{definition:'Trường B không được sửa'})).status).toBe(404);
   expect(ok(await b('GET','/api/admin/history/terms?limit=100')).items.some((r:any)=>r.id===id)).toBe(false);
   ok(await a('DELETE',`/api/admin/history/terms/${id}`),204);
 });

 test('bài học và câu hỏi do trường soạn, học sinh chỉ thấy phần đã công bố, trường khác không thấy',async()=>{
   const lesson=ok(await a('POST','/api/content/lessons',{title:'Bài học của trường A',blocks:[{type:'text',text:'Nội dung lịch sử được nhà trường biên soạn.'}]}),201);
   expect(lesson.school_id).toBe(f.A.schoolId);
   ok(await a('PUT',`/api/content/lessons/${lesson.id}`,{title:'Bài học A đã chỉnh sửa'}));
   expect((await b('GET',`/api/content/lessons/${lesson.id}`)).status).toBe(404);
   expect((await api(f.T1,'GET',`/api/content/lessons/${lesson.id}`)).status).toBe(404);
   ok(await a('PATCH',`/api/content/lessons/${lesson.id}/status`,{status:'published'}));
   ok(await api(f.T1,'GET',`/api/content/lessons/${lesson.id}`));
   const question=ok(await a('POST','/api/content/questions',{qtype:'truefalse',prompt:'Đây là câu hỏi của trường A?',data:{correct:true}}),201);
   expect(question.scope).toBe('school');
   expect((await b('GET',`/api/content/questions/${question.id}`)).status).toBe(404);
   ok(await a('PUT',`/api/content/questions/${question.id}`,{prompt:'Câu hỏi A được cập nhật?'}));
 });

 test('cấu hình game và AI cách ly cả cache và các yêu cầu đồng thời',async()=>{
   const original=ok(await root('GET','/api/game/admin/settings'));
   ok(await a('PUT','/api/game/admin/settings',{practice_correct_xp:37,hearts:{max:7}}));
   ok(await b('PUT','/api/game/admin/settings',{practice_correct_xp:19}));
   const rows=await Promise.all(Array.from({length:8},(_,i)=> (i%2?a:b)('GET','/api/game/admin/settings')));
   rows.forEach((r,i)=>expect(ok(r).values.practice_correct_xp).toBe(i%2?37:19));
   expect(ok(await root('GET','/api/game/admin/settings'))).toEqual(original);
   ok(await a('PUT','/api/ai/admin/settings',{daily_per_user:17}));
   ok(await b('PUT','/api/ai/admin/settings',{daily_per_user:29}));
   expect(ok(await a('GET','/api/ai/admin/settings')).daily_per_user).toBe(17);
   expect(ok(await b('GET','/api/ai/admin/settings')).daily_per_user).toBe(29);
   expect(ok(await api(f.S1,'GET','/api/game/config')).hearts.max).toBe(7);
 });

 test('nút hành trình thuộc trường đang soạn dù tham chiếu quiz mẫu chung',async()=>{
   const campaign=(await db.query<any>('SELECT id FROM hist_campaigns WHERE school_id IS NULL ORDER BY id LIMIT 1'))[0];
   const quiz=(await db.query<any>("SELECT id FROM hk_quizzes WHERE scope='system' ORDER BY id LIMIT 1"))[0];
   const journey=ok(await a('POST','/api/content/journeys',{title:'Hành trình riêng của trường A',campaign_id:campaign.id}),201);
   const updated=ok(await a('POST',`/api/content/journeys/${journey.id}/nodes`,{kind:'quiz',quiz_id:quiz.id,title:'Nút dùng quiz mẫu'}),201);
   expect(updated.nodes).toHaveLength(1);
   expect(updated.nodes[0].quiz_id).toBe(quiz.id);
   expect((await b('GET',`/api/content/journeys/${journey.id}`)).status).toBe(404);
   expect((await b('PUT',`/api/content/nodes/${updated.nodes[0].id}`,{title:'Không được sửa chéo'})).status).toBe(404);
   const copy=ok(await a('POST',`/api/content/journeys/${journey.id}/duplicate`),201);
   expect(copy.nodes.map((n:any)=>n.quiz_id)).toEqual([quiz.id]);
 });

 test('danh mục game và mini-game riêng có thể dùng cùng mã ở hai trường',async()=>{
   const body={code:'school-card',name:'Thẻ riêng',rarity:'common',drop_weight:10,description:'Thẻ của trường'};
   const ca=ok(await a('POST','/api/game/admin/cards',body),201);
   const cb=ok(await b('POST','/api/game/admin/cards',body),201);
   expect(ca.id).not.toBe(cb.id);
   expect((await b('PUT',`/api/game/admin/cards/${ca.id}`,{name:'Không cho sửa'})).status).toBe(404);
   expect(ok(await b('GET','/api/game/admin/cards')).some((r:any)=>r.id===ca.id)).toBe(false);
   const seed=(await db.query<any>('SELECT kind,title,params,seconds,points,description FROM hk_minigames WHERE school_id IS NULL LIMIT 1'))[0];
   const mini=ok(await a('POST','/api/battle/admin/minigames',{...seed,title:'Mini-game trường A'}),201);
   expect((await b('GET',`/api/battle/admin/minigames/${mini.id}`)).status).toBe(404);
   ok(await a('PUT',`/api/battle/admin/minigames/${mini.id}`,{title:'Mini-game A đã sửa'}));
 });

 test('nghiên cứu, nhóm thử nghiệm và mẫu khảo sát chỉ thuộc trường đang quản lý',async()=>{
   const group=ok(await a('POST','/api/platform/experiments/groups',{name:'Nhóm riêng',gamification:true,ai:true}));
   ok(await b('POST','/api/platform/experiments/groups',{name:'Nhóm riêng',gamification:false,ai:false}));
   expect(ok(await b('GET','/api/platform/experiments/groups')).some((r:any)=>r.id===group.id)).toBe(false);
   expect((await b('PUT',`/api/platform/experiments/classes/${f.class7a.id}`,{group_id:group.id})).status).toBe(404);
   ok(await a('PUT',`/api/platform/experiments/classes/${f.class7a.id}`,{group_id:group.id}));
   const response=await fetch(s.base+'/api/platform/research/export',{headers:{Authorization:`Bearer ${f.B.token}`}});
   expect(response.status).toBe(200);
   expect(await response.text()).not.toContain('HS8001');
   const template=ok(await a('POST','/api/platform/survey-templates',{title:'Mẫu khảo sát trường A',audience:'student',questions:[{id:'q1',type:'text',text:'Em học được điều gì?',required:true}]}));
   expect(ok(await b('GET','/api/platform/survey-templates')).some((r:any)=>r.id===template.id)).toBe(false);
   ok(await a('PUT',`/api/platform/survey-templates/${template.id}`,{is_active:false}));
   expect(ok(await a('GET','/api/platform/survey-templates')).some((r:any)=>r.id===template.id&&!r.is_active)).toBe(true);
 });

 test('màn chơi, bản đồ, chỉ huy và hội thoại quản lý được trong trường; chặn sửa ở trường khác',async()=>{
   const scenarioSeed=(await db.query<any>('SELECT * FROM hk_scenarios WHERE school_id IS NULL LIMIT 1'))[0];
   const scenario=ok(await a('POST','/api/battle/admin/scenarios',{...scenarioSeed,title:'Kịch bản trường A'}),201);
   await db.query("UPDATE hist_battles SET status='published' WHERE id=$1",[scenario.battle_id]);
   ok(await a('POST',`/api/battle/admin/scenarios/${scenario.id}/status`,{status:'published'}));
   expect(ok(await api(f.S1,'GET','/api/battle/list')).battles.some((r:any)=>r.id===scenario.id)).toBe(true);
   expect((await b('GET',`/api/battle/admin/scenarios/${scenario.id}`)).status).toBe(404);
   const seed=(await db.query<any>('SELECT * FROM hk_stages WHERE school_id IS NULL LIMIT 1'))[0];
   const stage=ok(await a('POST','/api/war/admin/stages',{...seed,title:'Màn chơi riêng trường A'}),201);
   ok(await a('PUT',`/api/war/admin/stages/${stage.id}`,{title:'Màn chơi A cập nhật'}));
   expect((await b('GET',`/api/war/admin/stages/${stage.id}`)).status).toBe(404);
   expect((await b('DELETE',`/api/war/admin/stages/${stage.id}`)).status).toBe(404);
   const campaign=(await db.query<any>('SELECT campaign_id FROM hist_battles WHERE id=$1',[seed.battle_id]))[0].campaign_id;
   const map=ok(await a('POST','/api/war/admin/maps',{campaign_id:campaign,title:'Bản đồ trường A'}),201);
   ok(await a('PUT',`/api/war/admin/maps/${map.id}`,{title:'Bản đồ A đã sửa'}));
   expect((await b('GET',`/api/war/admin/maps/${map.id}`)).status).toBe(404);
   const cmd=ok(await a('POST','/api/war/admin/commanders',{code:'commander-a',name:'Chỉ huy trường A'}),201);
   expect((await b('PUT',`/api/war/admin/commanders/${cmd.id}`,{name:'Không được sửa'})).status).toBe(404);
   const dialog=ok(await a('POST','/api/war/admin/dialogs',{title:'Hội thoại trường A',lines:[{speaker:'Thầy giáo',text:'Cùng tìm hiểu lịch sử nhà Trần.'}]}),201);
   ok(await a('PUT',`/api/war/admin/dialogs/${dialog.id}`,{title:'Hội thoại A đã sửa'}));
   expect((await b('GET',`/api/war/admin/dialogs/${dialog.id}`)).status).toBe(404);
 });

 test('tài liệu AI, chỉ mục và cache RAG không trộn hai trường',async()=>{
   const doc=ok(await a('POST','/api/ai/admin/docs',{title:'Tài liệu nội bộ A',text:'Văn bản nội bộ chỉ thuộc trường A. Từ khóa riêng bach-dang-truong-a cần được giữ trong phạm vi trường học.'}));
   expect(ok(await b('GET','/api/ai/admin/sources')).docs.some((r:any)=>r.id===doc.id)).toBe(false);
   expect((await b('DELETE',`/api/ai/admin/docs/${doc.id}`)).status).toBe(404);
   const {AiRetrievalService}=await import('../src/ai/ai-retrieval.service');
   const retrieval=s.moduleRef.get(AiRetrievalService);
   const ua=(await db.getById(f.A.id))!, ub=(await db.getById(f.B.id))!;
   const hitsA=await db.withWorkspace(ua,()=>retrieval.search('bach-dang-truong-a nội bộ',12));
   const hitsB=await db.withWorkspace(ub,()=>retrieval.search('bach-dang-truong-a nội bộ',12));
   expect(hitsA.some(r=>r.kind==='doc'&&r.sourceId===doc.id)).toBe(true);
   expect(hitsB.some(r=>r.kind==='doc'&&r.sourceId===doc.id)).toBe(false);
   const synced=ok(await a('POST','/api/ai/admin/reindex',{}));expect(synced.error).toBeNull();
   expect((await a('PUT','/api/ai/admin/settings',{base_url:'http://127.0.0.1:8080'})).status).toBe(400);
   expect((await db.query<any>('SELECT api_key_enc FROM hk_ai_settings WHERE school_id=$1',[f.A.schoolId]))[0].api_key_enc).toBeNull();
 });

 test('RLS và FK chặn truy vấn thiếu WHERE, giả school_id, tham chiếu chéo và thay đổi mẫu chung',async()=>{
   const ua=(await db.getById(f.A.id))!,ub=(await db.getById(f.B.id))!;
   const made=await db.withWorkspace(ub,()=>db.query<any>("INSERT INTO hist_terms(slug,term,definition) VALUES('private-b','Chỉ trường B','Tư liệu nội bộ B') RETURNING id"));
   const foreignQuestion=await db.withWorkspace(ub,()=>db.query<any>("INSERT INTO hk_questions(scope,school_id,owner_id,qtype,prompt,data) VALUES('school',$1,$2,'truefalse','Câu hỏi trường B?', $3) RETURNING id",[f.B.schoolId,f.B.id,JSON.stringify({correct:true})]));
   await db.withWorkspace(ua,async()=>{
     expect((await db.query<any>('SELECT id FROM hist_terms')).some(r=>r.id===made[0].id)).toBe(false);
     await expect(db.query("INSERT INTO hist_terms(school_id,slug,term,definition) VALUES($1,'forged','Giả trường','Không hợp lệ')",[f.B.schoolId])).rejects.toMatchObject({code:'42501'});
     const lesson=(await db.query<any>("SELECT id FROM hk_lessons WHERE school_id=$1 LIMIT 1",[f.A.schoolId]))[0];
     await expect(db.query('INSERT INTO hk_lesson_checks(lesson_id,question_id,position) VALUES($1,$2,1)',[lesson.id,foreignQuestion[0].id])).rejects.toMatchObject({code:'42501'});
     await expect(db.scoped(f.B.schoolId,async q=>q('SELECT 1'))).rejects.toBeDefined();
     expect(await db.query('UPDATE hist_terms SET definition=\'Không được sửa\' WHERE school_id IS NULL RETURNING id')).toEqual([]);
   });
 });
});
