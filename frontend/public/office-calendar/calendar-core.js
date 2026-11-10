/* Đông A calendar: pure date/template rules shared by the Excel host and tests. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.DongACalendar=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const DAY=86400000,BASE=Date.UTC(1899,11,30),FIRST_ROW=12,LAST_ROW=1011,MIN_YEAR=1940;
  const normalize=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').replace(/\*/g,'').trim().toLowerCase().replace(/\s+/g,' ');
  function today(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`;}
  function iso(year,month,day){return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;}
  function parse(value){
    if(typeof value==='number'&&Number.isInteger(value)){const d=new Date(BASE+value*DAY);return Number.isFinite(d.getTime())?{year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate()}:null;}
    if(typeof value!=='string')return null;
    let m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim()),p;
    if(m)p={year:+m[1],month:+m[2],day:+m[3]};else if((m=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim())))p={year:+m[3],month:+m[2],day:+m[1]};
    if(!p)return null;const d=new Date(Date.UTC(p.year,p.month-1,p.day));return d.getUTCFullYear()===p.year&&d.getUTCMonth()+1===p.month&&d.getUTCDate()===p.day?p:null;
  }
  function valid(value,max=today()){const p=parse(value);return !!p&&p.year>=MIN_YEAR&&iso(p.year,p.month,p.day)<=max;}
  function serial(value){const p=parse(value);if(!p)throw Error('Ngày không hợp lệ');return Math.round((Date.UTC(p.year,p.month-1,p.day)-BASE)/DAY);}
  function templateKind(headers){const h=headers.map(normalize);if(h.length!==7||h[0]!=='so thu tu'||h[2]!=='ho va ten'||h[3]!=='gioi tinh'||h[4]!=='sdt'||h[5]!=='email'||h[6]!=='ngay thang nam sinh')return null;return h[1]==='ma giao vien'?'teachers':h[1]==='ma hoc sinh'?'students':null;}
  function target(address){const a=String(address).split('!').pop().replace(/\$/g,''),m=/^([C-G])(\d+)$/.exec(a);if(!m||+m[2]<FIRST_ROW||+m[2]>LAST_ROW)return null;return {row:+m[2],cell:`G${+m[2]}`};}
  function changedBirthday(address){const t=target(address);return t&&/^\$?G\$?\d+$/.test(String(address).split('!').pop())?t:null;}
  function complete(values,kind,max=today()){return !!String(values[2]??'').trim()&&(kind==='students'||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(values[5]??'').trim()))&&valid(values[6],max);}
  function monthGrid(year,month){const offset=(new Date(Date.UTC(year,month-1,1)).getUTCDay()+6)%7;return Array.from({length:42},(_,i)=>{const d=new Date(Date.UTC(year,month-1,1-offset+i));return {year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate(),current:d.getUTCMonth()+1===month};});}
  return {FIRST_ROW,LAST_ROW,MIN_YEAR,today,iso,parse,valid,serial,templateKind,target,changedBirthday,complete,monthGrid};
});
