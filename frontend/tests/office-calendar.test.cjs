const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'../public/office-calendar'),C=require(path.join(root,'calendar-core.js')),Bridge=require(path.join(root,'excel-bridge.js'));
const headers=kind=>['Số thứ tự',kind==='teachers'?'Mã giáo viên':'Mã học sinh','Họ và tên *','Giới tính','SĐT',kind==='teachers'?'Email *':'Email','Ngày tháng năm sinh *'];
function fixture(kind='teachers'){
  const state={address:'Giáo viên!G12',active:'s1',calculations:0,messages:[],rows:{12:['','','Fixture','Nữ','0901234567',kind==='teachers'?'fixture@example.invalid':'','']},writes:[],handlers:{},hook:null};
  function getRow(n){return state.rows[n]??(state.rows[n]=['','','','','','','']);}
  function range(address){const row=+(/\d+/.exec(address)?.[0]||0),r={load(){return r;},select(){state.address=`Giáo viên!${address}`;},get address(){return state.address;},get values(){return address==='A11:G11'?[headers(kind)]:[getRow(row)];},set values(value){getRow(row)[6]=value[0][0];state.writes.push({address,value:value[0][0]});},get formulas(){return [['=IF(C12="","",1)','=IF(C12="","","CODE")']];},set numberFormat(value){state.format=value;}};return r;}
  const sheet={get id(){return state.active;},load(){},getRange:range,onChanged:{add(fn){state.handlers.change=fn;}},onSelectionChanged:{add(fn){state.handlers.selection=fn;}}};
  const sheets={items:[sheet],load(){},getActiveWorksheet:()=>sheet,onActivated:{add(fn){state.handlers.activated=fn;}}};
  const ctx={sync:async()=>{if(state.hook){const fn=state.hook;state.hook=null;fn();}},workbook:{worksheets:sheets,getSelectedRange:()=>range('selected'),application:{calculate(){state.calculations++;}}}};
  const api={run:fn=>fn(ctx)},bridge=Bridge.create(api,e=>state.messages.push(e));return {state,bridge};
}
test('ngày nhuận, ngày Excel, cận ngày sinh và lưới lịch qua năm',()=>{
  assert.equal(C.serial('1985-03-15'),31121);assert.deepEqual(C.parse(31121),{year:1985,month:3,day:15});
  assert.equal(C.valid('2000-02-29','2026-11-10'),true);assert.equal(C.valid('2001-02-29','2026-11-10'),false);
  assert.equal(C.valid('1939-12-31','2026-11-10'),false);assert.equal(C.valid('2026-11-11','2026-11-10'),false);
  const grid=C.monthGrid(2024,1);assert.equal(grid.length,42);assert.deepEqual(grid[0],{year:2024,month:1,day:1,current:true});assert.equal(grid[41].month,2);
});
test('chỉ nhận đúng mẫu, một ô trong dòng nhập; từ chối ví dụ, ngoài bảng và nhiều ô',()=>{
  assert.equal(C.templateKind(headers('teachers')),'teachers');assert.equal(C.templateKind(headers('students')),'students');assert.equal(C.templateKind(['A','B','C']),null);
  for(const address of ['G8','J19','C12:G12','G1012','A12','G0'])assert.equal(C.target(address),null);
  assert.deepEqual(C.target("'Học sinh'!$G$12"),{row:12,cell:'G12'});assert.equal(C.changedBirthday('C12'),null);
});
test('chọn ngày giáo viên ghi đúng G, tính công thức, chọn C dòng sau và không ghi STT/mã',async()=>{
  const {bridge,state}=fixture();const selected=await bridge.selection();assert.equal(selected.cell,'G12');
  const r=await bridge.writeDate('1985-03-15',selected);assert.deepEqual(r,{done:true,row:12,next:'C13'});
  assert.deepEqual(state.writes,[{address:'G12',value:31121}]);assert.deepEqual(state.format,[['dd/mm/yyyy']]);assert.equal(state.address,'Giáo viên!C13');assert.equal(state.calculations,1);
});
test('học sinh không cần email; giáo viên thiếu email hoặc dòng thiếu họ tên không tự chuyển',async()=>{
  for(const kind of ['students','teachers']){const {bridge,state}=fixture(kind);state.rows[12][5]='';const r=await bridge.writeDate('2013-04-02',await bridge.selection());assert.equal(r.done,kind==='students');assert.equal(state.address,kind==='students'?'Giáo viên!C13':'Giáo viên!G12');}
  const {bridge,state}=fixture('students');state.rows[12][2]='';assert.equal((await bridge.writeDate('2013-04-02',await bridge.selection())).done,false);
});
test('không ghi khi người dùng đổi dòng hoặc chọn ngoài bảng trong lúc chọn ngày',async()=>{
  const {bridge,state}=fixture();const selected=await bridge.selection();state.address='Giáo viên!G13';await assert.rejects(bridge.writeDate('1985-03-15',selected),/đã đổi/);assert.deepEqual(state.writes,[]);
  state.address='Giáo viên!J19';await assert.rejects(bridge.writeDate('1985-03-15',selected),/đã đổi/);assert.deepEqual(state.writes,[]);
});
test('gõ ngày G rồi Enter có thể chọn C tiếp, không xử lý thay đổi từ người cộng tác hoặc ngoài mẫu',async()=>{
  const {bridge,state}=fixture();await bridge.start();state.rows[12][6]=31120;state.address='Giáo viên!G13';await state.handlers.change({address:'G12',source:'Local',changeType:'RangeEdited',worksheetId:'s1'});
  // Event callback enqueues work; selection waits for its completion.
  await bridge.selection();assert.equal(state.address,'Giáo viên!C13');assert.equal(state.writes.length,0);
  state.address='Giáo viên!G13';await state.handlers.change({address:'G12',source:'Remote',changeType:'RangeEdited',worksheetId:'s1'});await bridge.selection();assert.equal(state.address,'Giáo viên!G13');
  state.address='Giáo viên!G12';await state.handlers.change({address:'F12',source:'Local',changeType:'RangeEdited',worksheetId:'s1'});await bridge.selection();assert.equal(state.address,'Giáo viên!G12');
});
test('dòng cuối không chọn ô ngoài vùng nhập; ngày tương lai không được ghi',async()=>{
  const {bridge,state}=fixture();state.rows[1011]=state.rows[12];state.address='Giáo viên!G1011';assert.equal((await bridge.writeDate('1985-03-15',await bridge.selection())).next,null);assert.equal(state.address,'Giáo viên!G1011');
  await assert.rejects(bridge.writeDate('2999-01-01',await bridge.selection()),/ngày sinh/);assert.equal(state.writes.length,1);
});
test('đổi worksheet sau khi mở lịch thì từ chối ghi ngày',async()=>{
  const {bridge,state}=fixture();const selected=await bridge.selection();state.active='other-sheet';await assert.rejects(bridge.writeDate('1985-03-15',selected),/đã đổi/);assert.deepEqual(state.writes,[]);
});
test('gói cài có manifest đúng ID; chỉ đăng ký riêng tiện ích, không tắt bảo vệ Office',async()=>{
  const {calendarPackage}=await import('../../scripts/calendar-package.mjs');const zip=calendarPackage(root),files={};let i=0;
  while(zip.readUInt32LE(i)===0x04034b50){const length=zip.readUInt32LE(i+18),nameLen=zip.readUInt16LE(i+26),extraLen=zip.readUInt16LE(i+28),start=i+30+nameLen+extraLen;files[zip.subarray(i+30,i+30+nameLen).toString()]=zip.subarray(start,start+length).toString();i=start+length;}
  assert.deepEqual(Object.keys(files),['manifest.xml','Install-DongACalendar.ps1','HUONG-DAN.txt']);assert.match(files['manifest.xml'],/bc75b058-92b8-4dd1-84fb-8792db3f7e72/);assert.match(files['manifest.xml'],/xsi:type="ContentApp"/);assert.match(files['manifest.xml'],/<Permissions>ReadWriteDocument<\/Permissions>/);
  assert.doesNotMatch(files['Install-DongACalendar.ps1'],/ExecutionPolicy|DisableSecurity|DisableAllActiveX|Trusted Locations|Bypass|EnableUnsafe/i);
  assert.match(files['Install-DongACalendar.ps1'],/DeleteValue\(\$addinId,\$false\)/);assert.doesNotMatch(files['manifest.xml'],/localhost|Vertex42|wa102957665/i);
});
