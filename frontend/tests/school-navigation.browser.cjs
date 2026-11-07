// API giả lập: không dùng tài khoản thật, không gửi thư; chạy trên bản web export đang phục vụ local.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const base = process.env.QA_URL || 'http://127.0.0.1:8765', out = process.env.QA_ARTIFACT_DIR || path.join(require('node:os').tmpdir(), 'dong-a-school-navigation-qa'); fs.mkdirSync(out, {recursive:true});
const slug = 'donga_00000001_giongoto_2', old = 'donga_00000001_tencu_2';
const school = { id:42, school_code:'00000001', slug, name:'THCS Giồng Ông Tố', region:'Quận 2', city:'TP.HCM', is_active:true, logo_url:null, link:{slug,path:'/'+slug,url:base+'/'+slug} };
const draft = { id:70, quiz_id:null, updated_at:'2026-11-07T00:00:00Z', payload:{title:'Quiz kiểm thử',description:'',cover_url:null,campaign_id:null,theme:{bg:'default',music:'none'},shuffle_questions:false,shuffle_options:false,questions:[{uid:'testq',question_id:null,qtype:'single',prompt:'Câu hỏi kiểm thử',options:['Một','Hai','',''],correct:[0],tf:true,seconds:20,score_mode:'standard',image_url:null,video_url:null,explanation:''}]} };
const user = role => ({ id:role==='root_admin'?1:2, username:'fixture-'+role, full_name:'Nguyễn Kiểm Thử', role, admin_level:1, email:'fixture@example.invalid', school_id:role==='root_admin'?null:42, school_code:role==='root_admin'?null:'00000001', must_change_password:false, profile_confirmed_at:'2026-11-01', is_active:true });
(async()=>{ const browser = await chromium.launch({executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}); const results=[];
try { for (const width of [1440,390]) for(const role of ['root_admin','school_admin','teacher','student']) {
 const ctx=await browser.newContext({viewport:{width,height:900}}); const errors=[],calls=[]; let active = user(role), logged = role==='root_admin', changed=false;
 if(role==='root_admin') await ctx.addInitScript(()=>localStorage.setItem('donga_token_root_admin','fixture-root_admin'));
 await ctx.route('**/api/**',async route=>{ const req=route.request(),u=new URL(req.url()),p=u.pathname;calls.push({path:p,method:req.method(),body:req.postData(),token:req.headers().authorization});let data=[],status=200;
 if(p==='/api/auth/me'){const token=req.headers().authorization; if(!logged||token?.includes('wrong-school')){status=401;data={detail:'Phiên không hợp lệ'};}else data=active;}
 else if(p.startsWith('/api/auth/school-link/')) data={...school};
 else if(p==='/api/auth/login'){const b=req.postDataJSON();assert.equal(b.portal,role);assert.equal(b.school_code,'00000001');logged=true;active={...user(role),must_change_password:true};data={token:'fixture-'+role,user:active};}
 else if(p==='/api/auth/change-password'){changed=true;active={...active,must_change_password:false};data={token:'changed-'+role,user:active};}
 else if(p==='/api/auth/logout'){logged=false;data={ok:true};}
 else if(p==='/api/auth/profile')data={user:active,school:role==='root_admin'?null:school,classes:[],editable:[]};
 else if(p==='/api/platform/config')data={flags:{},features:{},system_name:'Đông A edu'};
 else if(p==='/api/platform/preferences')data={theme:'light'};
 else if(p==='/api/admin/school')data={...school,counts:{admins:1,teachers:1,students:1,classes:0},admins:[],current_year:null};
 else if(p==='/api/admin/schools')data={items:[school],total:1,page:1,limit:30,facets:{cities:[],regions:[]}};
 else if(p==='/api/admin/users'||p==='/api/admin/teachers'||p==='/api/admin/students')data={items:[],total:0,page:1,limit:30};
 else if(p==='/api/admin/school-years')data=[];
 else if(p==='/api/content/history-options')data=[];
 else if(p==='/api/content/questions')data={items:[],total:0,page:1,limit:30};
 else if(p==='/api/content/studio'&&req.method()==='POST')data=draft;
 else if(p==='/api/content/studio/70')data=req.method()==='PUT'?{id:70,updated_at:draft.updated_at}:draft;
 else if(p==='/api/analytics/system/overview')data={schools:1,schools_total:1,users_by_role:{},series:[],dau:0,wau:0,mau:0,new_users_30d:0};
 else if(p==='/api/analytics/system/content')data={history:[],learning:[],questions:{total:0,by_scope:{}},quizzes:0,ai_chunks:0};
 else if(p==='/api/analytics/usage')data={items:[],totals:{lessons:0,quizzes:0,battles:0,rooms:0}};
 else if(p==='/api/analytics/ai')data={series:[],topics:[],price:{},questions:0,answers:0};
 else if(p==='/api/game/me')data={has_character:true,user:{id:2,name:'Kiểm thử'},class:null,appearance:{outfit:null,weapon:null,banner:null},hearts:{current:5,max:5,enabled:true,next_in_ms:null},level:{level:1,title:'Tân binh',progress:0,next_xp:100},xp:0,gold:0,pending_drops:0,streak:{current:0},daily:{xp:0,goal:50},league:{tier:1,name:'Đồng'},gift:{available:false},hints:0};
 else if(p==='/api/play/path')data={parts:[],current:null};
 else if(p==='/api/play/menu-dots')data={practice:0,live:0};
 else if(p==='/api/game/league')data={entries:[],league:null};
 else if(p==='/api/game/quests')data={daily:[],weekly:[]};
 else if(/notifications/.test(p))data={items:[],unread:0,total:0};
 else if(p==='/api/learn/library')data={figures:[],events:[],places:[],battles:[]};
 else if(p==='/api/play/practice')data=[];
 await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)}).catch(()=>{});
 });
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errors.push(m.text());});
 const visible=id=>page.locator(`[data-testid="${id}"]:visible`);
 const nav=async id=>{if(role!=='student'&&width<1000)await visible('admin-menu-toggle').click();if(role==='student'&&width<900&&!['learn','practice','ranking','quests','ai'].includes(id))await visible('student-tab-more').click();await visible((role==='student'?'student-tab-':'admin-nav-')+id).click();};
 const activeTab=async id=>{await page.waitForURL(u=>u.searchParams.get('tab')===id); if((role!=='student'&&width<1000)||(role==='student'&&width<900&&!['learn','practice','ranking','quests','ai'].includes(id)))return;await visible((role==='student'?'student-tab-':'admin-nav-')+id).waitFor();};
 try {
 if(role!=='root_admin') {
  await page.goto(base+'/'+old+(role==='school_admin'?'':`?role=${role}`),{waitUntil:'domcontentloaded'});
  await page.getByTestId('login-role-'+role).waitFor();assert.equal(await page.getByTestId('login-role-'+role).getAttribute('aria-checked'),'true');
  await page.locator('#login-username').fill('fixture');await page.locator('#login-password').fill('Fixture-only-123');await page.getByTestId('login-submit').click();
  await page.locator('#cp-current').waitFor();assert.ok(page.url().includes('/'+slug));assert.ok(!page.url().includes('school-manager-admin'));
  await page.getByText('THCS Giồng Ông Tố · Bắt buộc ở lần đăng nhập đầu tiên',{exact:true}).waitFor();
  await page.getByText('Từ 6 ký tự, có chữ không dấu, số và ký tự đặc biệt (@, #, !), không có khoảng trắng.',{exact:true}).waitFor();
  await page.locator('#cp-current').fill('Fixture-only-123');
  await page.locator('#cp-new').fill('Newfixture456');await page.locator('#cp-confirm').fill('Newfixture456');await page.getByTestId('cp-submit').click();
  await page.getByRole('alert').filter({hasText:'Mật khẩu cần ít nhất 6 ký tự'}).waitFor();
  assert.equal(calls.filter(c=>c.path==='/api/auth/change-password').length,0);
  for(const invalid of ['mật1!x','ab1 !cd']){
   await page.locator('#cp-new').fill(invalid);await page.locator('#cp-confirm').fill(invalid);await page.getByTestId('cp-submit').click();
   await page.getByRole('alert').filter({hasText:'không có khoảng trắng'}).waitFor();assert.equal(await page.locator('#cp-new').inputValue(),invalid);assert.equal(calls.filter(c=>c.path==='/api/auth/change-password').length,0);
  }
  await page.screenshot({path:`${out}/${width}-${role}-password-policy.png`});
  await page.locator('#cp-current').fill('Fixture-only-123');await page.locator('#cp-new').fill('new1!x');await page.locator('#cp-confirm').fill('new1!x');await page.getByTestId('cp-submit').click();
 } else await page.goto(base+'/admin',{waitUntil:'domcontentloaded'});
 const first=role==='student'?'practice':role==='teacher'?'questions':role==='school_admin'?'teachers':'schools';
 const second=role==='student'?'sources':role==='teacher'?'shares':role==='school_admin'?'students':'users';
 await nav(first);await activeTab(first);await nav(second);await activeTab(second);
 await page.goBack();await activeTab(first);assert.ok(await page.locator('input#login-username').count()===0);
 await page.goForward();await activeTab(second);await page.reload();await activeTab(second);assert.ok(await page.locator('input#login-username').count()===0);
 assert.equal(page.url().includes('school-manager-admin'),false);
 if(role==='teacher') { if(width<1000)await visible('admin-menu-toggle').click(); for(const id of ['journeys','quizzes','game'])assert.equal(await page.getByTestId('admin-nav-'+id).count(),0);if(width<1000)await visible('admin-menu-toggle').click();await visible('create-menu').click();assert.equal(await page.getByTestId('create-journey').count(),0);assert.equal(await page.getByTestId('create-quizset').count(),0);await page.getByTestId('create-quiz').click();await visible('studio-save').waitFor();assert.equal(new URL(page.url()).searchParams.get('draft'),'70');await page.reload();await visible('studio-save').waitFor();await page.goBack();await activeTab(second); }
 if(role==='student') {if(width<900)await page.getByTestId('student-tab-more').click();for(const id of ['collection','study','timeline','map','battles'])assert.equal(await page.getByTestId('student-tab-'+id).count(),0);if(width<900)await page.getByRole('button',{name:'Đóng',exact:true}).first().click();}
 if(role==='school_admin'){await page.goto(base+'/school-manager-admin?tab=teachers');await page.waitForURL(u=>u.pathname==='/'+slug&&u.searchParams.get('role')==='school_admin');await activeTab('teachers');}
 if(role==='teacher'||role==='student') {
  await page.goto(base+(role==='teacher'?'/giao-vien':'/hoc-sinh'));await nav(first);await activeTab(first);await nav(second);await activeTab(second);await page.goBack();await activeTab(first);
 }
 // Đăng xuất rồi Back không được khôi phục màn làm việc đã nằm trong bộ nhớ của Expo Stack.
 if(role==='student')await page.getByRole('button',{name:'Đăng xuất',exact:true}).filter({visible:true}).click();
 else await visible('admin-logout').click();
 const loginInput=role==='root_admin'?'#admin-username:visible':'#login-username:visible';
 await page.locator(loginInput).waitFor();await page.goBack();await page.locator(loginInput).waitFor();
 await page.screenshot({path:`${out}/${width}-${role}.png`});
 assert.deepEqual(errors,[]);results.push({width,role,changedPassword:changed,backForwardAndReload:true});
 }catch(e){await page.screenshot({path:`${out}/${width}-${role}-failure.png`});fs.writeFileSync(out+'/failure-calls.json',JSON.stringify({calls,errors},null,2));throw e;}finally{await ctx.close();}
 }
 // Phiên hợp lệ của trường 1 không được nhận khi mở đường dẫn riêng của trường 2.
 { const ctx=await browser.newContext();await ctx.addInitScript(()=>localStorage.setItem('donga_token_school_admin','fixture-school-one'));
   await ctx.route('**/api/**',async r=>{const p=new URL(r.request().url()).pathname;let data={};if(p.startsWith('/api/auth/school-link/'))data={...school,school_code:'00000002',slug:'donga_00000002_truongkhac',name:'THCS Trường Khác'};else if(p==='/api/auth/me')data=user('school_admin');await r.fulfill({json:data});});
   const p=await ctx.newPage();await p.goto(base+'/donga_00000002_truongkhac');await p.locator('#login-username:visible').waitFor();assert.equal(await p.getByTestId('admin-workspace').count(),0);assert.equal(await p.evaluate(()=>localStorage.getItem('donga_token_school_admin')),'fixture-school-one');results.push({crossSchoolSessionRejected:true});await ctx.close(); }
 // Hai form đặt lại mật khẩu dùng cùng chính sách; OTP/email hoàn toàn giả lập.
 for(const width of [1440,390]) for(const root of [true,false]) {
  const ctx=await browser.newContext({viewport:{width,height:900}}),resets=[];
  await ctx.route('**/api/**',async route=>{
   const p=new URL(route.request().url()).pathname;
   if(p==='/api/auth/reset-password')resets.push(route.request().postDataJSON());
   await route.fulfill({json:p.startsWith('/api/auth/school-link/')?school:p==='/api/platform/config'?{flags:{},features:{}}:{ok:true}});
  });
  const page=await ctx.newPage();
  await page.goto(base+(root?'/admin':'/'+slug));
  await page.getByTestId('forgot-open').click();
  await page.locator(root?'#admin-forgot':'#forgot-identifier').fill('fixture@example.invalid');await page.getByTestId('forgot-submit').click();
  await page.locator(root?'#admin-otp':'#forgot-otp').fill('123456');
  await page.getByText('Từ 6 ký tự, có chữ không dấu, số và ký tự đặc biệt (@, #, !), không có khoảng trắng.',{exact:true}).waitFor();
  const next=page.locator(root?'#admin-new-password':'#forgot-new'),confirm=page.locator(root?'#admin-confirm-password':'#forgot-confirm'),submit=page.getByTestId(root?'reset-submit':'forgot-submit');
  await next.fill('Newfixture456');await confirm.fill('Newfixture456');await submit.click();
  await page.getByRole('alert').filter({hasText:'Mật khẩu cần ít nhất 6 ký tự'}).waitFor();assert.equal(resets.length,0);
  for(const invalid of ['mật1!x','ab1 !cd']){
   await next.fill(invalid);await confirm.fill(invalid);await submit.click();await page.getByRole('alert').filter({hasText:'không có khoảng trắng'}).waitFor();assert.equal(await next.inputValue(),invalid);assert.equal(resets.length,0);
  }
  await page.screenshot({path:`${out}/${width}-${root?'admin':'school'}-reset-policy.png`});
  await next.fill('mat1!x');await confirm.fill('mat1!x');await submit.click();
  await page.locator(root?'#admin-username':'#login-username').waitFor();
  assert.equal(resets.length,1);assert.equal(resets[0].new_password,'mat1!x');
  results.push({width,passwordReset:root?'root_admin':'school',weakBlocked:true,accentsAndSpacesRejected:true,asciiPasswordSubmitted:true});await ctx.close();
 }
 fs.writeFileSync(out+'/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
