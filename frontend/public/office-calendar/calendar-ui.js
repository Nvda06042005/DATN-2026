(function(){
  'use strict';
  const C=window.DongACalendar,$=id=>document.getElementById(id),max=C.today(),now=C.parse(max);
  let year=now.year,month=now.month,mode='days',yearStart=year-2,chosen='',bridge=null,target=null,busy=false,refreshing=false,refreshAgain=false;
  function status(text,type=''){$('status').textContent=text;$('status').className=type;}
  function render(){
    $('month').textContent=`Tháng ${month}`;$('year').textContent=String(year);$('weekdays').hidden=mode!=='days';
    $('period').hidden=mode!=='years';$('period').textContent=`${yearStart} – ${yearStart+11}`;
    $('choices').className=mode==='days'?'days':'choices';$('choices').setAttribute('aria-label',mode==='days'?'Chọn ngày':mode==='months'?'Chọn tháng':'Chọn năm');$('choices').replaceChildren();
    const values=mode==='days'?C.monthGrid(year,month):mode==='months'?Array.from({length:12},(_,i)=>i+1):Array.from({length:12},(_,i)=>yearStart+i);
    for(const value of values){const b=document.createElement('button');b.type='button';
      if(mode==='days'){const iso=C.iso(value.year,value.month,value.day);b.textContent=String(value.day);b.dataset.date=iso;b.setAttribute('aria-label',`${value.day}/${value.month}/${value.year}`);b.disabled=busy||!target||!C.valid(iso,max);b.className=[value.current?'':'outside',iso===chosen?'selected':'',iso===max?'today':''].filter(Boolean).join(' ');b.onclick=()=>pickDate(iso);}
      else if(mode==='months'){b.textContent=`Tháng ${value}`;b.disabled=year===now.year&&value>now.month;b.className=value===month?'selected':'';b.onclick=()=>{month=value;mode='days';render();};}
      else{b.textContent=String(value);b.disabled=value<C.MIN_YEAR||value>now.year;b.className=value===year?'selected':'';b.onclick=()=>{year=value;if(year===now.year)month=Math.min(month,now.month);mode='months';render();};}
      $('choices').append(b);
    }
    const limit=mode==='years'?{min:yearStart<=C.MIN_YEAR,max:yearStart+11>=now.year}:mode==='months'?{min:year<=C.MIN_YEAR,max:year>=now.year}:{min:year===C.MIN_YEAR&&month===1,max:year===now.year&&month>=now.month};
    $('previous').disabled=limit.min;$('next').disabled=limit.max;
  }
  function navigate(delta){if(mode==='years')yearStart+=delta*12;else if(mode==='months'){year+=delta;if(year===now.year)month=Math.min(month,now.month);}else{month+=delta;if(month<1){month=12;year--;}if(month>12){month=1;year++;}}render();}
  $('month').onclick=()=>{mode=mode==='months'?'days':'months';render();};$('year').onclick=()=>{mode=mode==='years'?'days':'years';yearStart=year-2;render();};$('previous').onclick=()=>navigate(-1);$('next').onclick=()=>navigate(1);
  async function refresh(){if(!bridge)return;if(refreshing){refreshAgain=true;return;}refreshing=true;
    do{refreshAgain=false;try{const previous=target;target=await bridge.selection();$('target').textContent=`${target.kind==='teachers'?'Giáo viên':'Học sinh'} · Ngày sinh ${target.cell}`;const birth=C.parse(target.birth);chosen=birth&&C.valid(target.birth,max)?C.iso(birth.year,birth.month,birth.day):'';if(chosen&&(!previous||previous.row!==target.row||previous.sheetId!==target.sheetId)){year=birth.year;month=birth.month;mode='days';}}
    catch(error){target=null;$('target').textContent=error.message;}render();}while(refreshAgain);refreshing=false;
  }
  async function pickDate(value){if(!bridge||!target||busy)return;busy=true;render();try{const result=await bridge.writeDate(value,target);chosen=value;status(result.done?`Đã tính STT/mã.${result.next?` Tiếp tục nhập Họ tên tại ${result.next}.`:''}`:'Đã ghi ngày sinh. Điền đủ Họ tên'+(target.kind==='teachers'?' và Email':'')+' để hiện STT/mã.',result.done?'success':'');await refresh();}catch(error){status(error.message,'error');await refresh();}finally{busy=false;render();}}
  let connecting=false;
  async function connect(){if(connecting||bridge)return;connecting=true;try{
    if(!window.Office)throw Error('Chưa tải được kết nối Office. Kiểm tra Internet rồi mở lại lịch trong Excel.');
    const info=await Office.onReady();if(info.host!==Office.HostType.Excel)throw Error('Hãy mở lịch này trong Microsoft Excel trên máy tính.');
    if(!Office.context.requirements.isSetSupported('ExcelApi','1.7'))throw Error('Bản Excel này chưa hỗ trợ lịch Đông A. Cần Excel có ExcelApi 1.7 trở lên.');
    bridge=window.DongAExcelBridge.create(window.Excel,event=>{if(event.error)status(event.error,'error');else if(event.message)status(event.message,event.success?'success':'');if(event.selectionChanged)refresh();});
    await bridge.start();status('Bấm tháng hoặc năm để chọn nhanh. Chọn ngày sẽ ghi vào dòng đang nhập.');$('reconnect').hidden=true;await refresh();
  }catch(error){bridge=null;status(error.message,'error');$('target').textContent='Chưa kết nối Excel';$('reconnect').hidden=false;}finally{connecting=false;render();}}
  $('reconnect').onclick=connect;render();connect();
})();
