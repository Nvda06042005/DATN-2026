import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { FileSpreadsheet, RefreshCw } from 'lucide-react-native';
import * as api from '@/api/adminApi';
import { errorMessage } from '@/api/client';
import type { Session } from '@/components/auth';
import { useFail } from '@/components/provisioning';
import { Bar, Btn, Card, Chip, EmptyState, Inset, Spinner, Txt, useToast } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { fmt, formatDateTime, pct } from '@/lib/format';
import type { AdminOverview, DashboardReport, ReportFilters, SchoolStat } from '@/types/api';
import { AdminSelect } from './AdminSelect';

export function ReportsDashboard({session,schools,reloadKey,overview,onNavigate}:{session:Session;schools:SchoolStat[];reloadKey:number;overview:AdminOverview|null;onNavigate:(t:'classes'|'import'|'mail'|'trash')=>void}) {
  const {c}=useTheme(),fail=useFail(session),toast=useToast(),system=session.user.role==='root_admin';
  const [filters,setFilters]=useState<ReportFilters>({}),[data,setData]=useState<DashboardReport|null>(null),[busy,setBusy]=useState(true),[exporting,setExporting]=useState(false),[error,setError]=useState<string|null>(null),[definitions,setDefinitions]=useState(false),[page,setPage]=useState(1);const serial=useRef(0);
  const load=useCallback(async()=>{const id=++serial.current;setBusy(true);setError(null);try{const r=await api.getDashboard(session.token,filters);if(id===serial.current){setData(r);setPage(1);}}catch(e){if(id===serial.current){setError(errorMessage(e,'Không tải được thống kê.'));fail(e);}}finally{if(id===serial.current)setBusy(false);}},[session.token,filters,fail]);
  useEffect(()=>{void load();return()=>{serial.current++;};},[load,reloadKey]);
  const exportFile=async()=>{if(!data||Platform.OS!=='web')return;setExporting(true);try{const blob=await api.exportDashboard(session.token,data.filters),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`thong-ke-dong-a-${data.generated_at.slice(0,10)}.xlsx`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('Đã tải Excel với toàn bộ dữ liệu khớp bộ lọc.');}catch(e){fail(e);}finally{setExporting(false);}};
  const select=(label:string,key:'region'|'city'|'school_year'|'active',options:Array<{value:string;label:string}>)=><View style={{flexGrow:1,flexBasis:175}}><AdminSelect label={label} value={filters[key]??'all'} onChange={v=>setFilters(f=>({...f,[key]:v==='all'?undefined:v}))} options={[{value:'all',label:'Tất cả'},...options]}/></View>;
  const gradeTotals=useMemo(()=>[6,7,8,9].map(grade=>({grade,schools:new Set(data?.grades.filter(g=>g.grade===grade).map(g=>g.school_id)).size,classes:(data?.grades??[]).filter(g=>g.grade===grade).reduce((n,g)=>n+g.classes,0),students:(data?.grades??[]).filter(g=>g.grade===grade).reduce((n,g)=>n+g.students,0)})),[data]);
  const classTotals=useMemo(()=>{const m=new Map<string,{grade:number|null;year:string;classes:number;active:number}>();for(const row of data?.class_breakdown??[]){const key=row.grade+':'+row.school_year,v=m.get(key)??{grade:row.grade,year:row.school_year,classes:0,active:0};v.classes+=row.classes;v.active+=row.active_classes;m.set(key,v);}return [...m.values()].sort((a,b)=>b.year.localeCompare(a.year)||(a.grade??99)-(b.grade??99));},[data]);
  const stat=(label:string,value:string|number,detail:string)=><Card key={label} pad={18} style={{flexGrow:1,flexBasis:170,gap:8}}><Txt f="bold" size={12} color={c.muc3}>{label}</Txt><Txt f="heavy" size={30}>{typeof value==='number'?fmt(value):value}</Txt><Txt size={12} color={c.muc2}>{detail}</Txt></Card>;
  const score=(v:number|null)=>v===null?'—':v.toLocaleString('vi-VN',{minimumFractionDigits:1,maximumFractionDigits:2});
  const s=data?.summary,perPage=8,rows=data?.per_school.slice((page-1)*perPage,page*perPage)??[];
  return <View testID="reports-dashboard" style={{gap:20}}>
    <Card pad={20} style={{gap:16}}><Txt f="bold" size={19}>Bộ lọc thống kê</Txt><Txt size={13} color={c.muc3}>{system?'Chọn phạm vi trường để xem thống kê tổng hợp và so sánh.':'Tất cả số liệu và file Excel chỉ thuộc trường được gán cho bạn.'}</Txt>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:12,alignItems:'flex-end'}}>
        {system&&<View style={{flexGrow:2,flexBasis:240}}><AdminSelect label="Trường thống kê" value={filters.school_id??0} onChange={id=>setFilters(f=>({...f,school_id:id||undefined}))} options={[{value:0,label:'Toàn bộ trường'},...schools.map(x=>({value:x.id,label:`${x.school_code} · ${x.name}`}))]}/></View>}
        {select('Năm học thống kê','school_year',(data?.facets.school_years??[]).map(v=>({value:v,label:v})))}
        {select('Trạng thái trường','active',[{value:'true',label:'Đang hoạt động'},{value:'false',label:'Tạm ngưng'}])}
        {select('Khu vực thống kê','region',(data?.facets.regions??[]).map(v=>({value:v,label:v})))}
        {select('Tỉnh / thành thống kê','city',(data?.facets.cities??[]).map(v=>({value:v,label:v})))}
        <Btn title="Xóa bộ lọc thống kê" tone="giay" onPress={()=>setFilters({})}/>
      </View>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:10,alignItems:'center'}}><Btn title="Cập nhật số liệu" tone="giay" icon={RefreshCw} loading={busy} onPress={load}/><Btn title="Xuất Excel" testID="report-export" icon={FileSpreadsheet} tone="son" disabled={!data||busy||!!error||Platform.OS!=='web'} loading={exporting} onPress={exportFile}/>{data&&<Txt size={12} color={c.muc3}>Cập nhật {formatDateTime(data.generated_at)}</Txt>}</View>
      {Platform.OS!=='web'&&<Txt size={12} color={c.muc3}>Mở phiên bản web để tải file Excel.</Txt>}
      <Txt size={12} color={c.muc3}>Excel bao gồm toàn bộ trường khớp bộ lọc, số liệu khối/lớp và chú thích cách tính.</Txt>
    </Card>
    {busy?<Spinner label="Đang tổng hợp thống kê…"/>:error?<Inset style={{backgroundColor:c.sonNhat}}><Txt color={c.sonChu} accessibilityRole="alert">{error}</Txt></Inset>:data&&s&&<>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:12}}>
        {stat('Trường',s.schools,`${s.active_schools} hoạt động · ${s.inactive_schools} tạm ngưng`)}
        {stat('Khối trong các trường',s.grades,'Đếm từng cặp trường–khối, từ khối 6 đến 9')}
        {stat('Lớp',s.classes,`${s.active_classes} hoạt động · ${s.approved_classes} đã duyệt`)}
        {stat('Giáo viên',s.teachers,`${s.active_teachers} tài khoản hoạt động`)}
        {stat('Học sinh',s.students,`${s.active_students} tài khoản hoạt động`)}
      </View>
      <Card pad={20} style={{gap:14}}><Txt f="bold" size={19} accessibilityRole="header">Cấp học và phân lớp</Txt>
        {data.education_levels.map(l=><Txt key={l.level} size={14}>Chương trình {l.level}: {l.schools} trường · {l.classes} lớp · {l.students} học sinh</Txt>)}
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}><Chip text={`GV có lớp đang dạy: ${s.assigned_teachers}`} bg={c.ngocNhat} fg={c.ngocChu}/><Chip text={`GV chưa có lớp đang dạy: ${s.unassigned_teachers}`} bg={c.dongNhat} fg={c.dongChu}/><Chip text={`HS đã vào lớp: ${s.joined_students}`} bg={c.ngocNhat} fg={c.ngocChu}/><Chip text={`HS chưa vào lớp: ${s.unjoined_students}`} bg={c.dongNhat} fg={c.dongChu}/></View>
        <Txt size={12} color={c.muc3}>Lớp đang dạy/đã tham gia được tính khi đã duyệt và đang hoạt động. Mỗi người chỉ tính một lần dù có nhiều lớp.</Txt>
        {data.unassigned_people>0&&<Inset><Txt size={13}>Có {data.unassigned_people} giáo viên/học sinh chưa gán trường: vẫn tính vào tổng nhân sự và học tập, chưa đưa vào so sánh theo trường.</Txt></Inset>}
      </Card>
      <View style={{gap:12}}><Txt f="bold" size={20} accessibilityRole="header">Học tập và tham gia trò chơi</Txt><Txt size={13} color={c.muc3}>Tiến độ tích lũy của nhóm học sinh đang được lọc. Hoàn thành nghĩa là đã hoàn thành ít nhất một lượt học hoặc trận.</Txt>
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:12}}>{stat('Hoàn thành lượt học',pct(s.completion_rate),`${s.completed_students}/${s.students} học sinh`)}{stat('Điểm luyện tập TB /10',score(s.average_score),`${s.score_students} học sinh đã trả lời`)}{stat('Tham gia luyện tập / game',pct(s.game_participation_rate),`${s.learning_students}/${s.students} học sinh`)}{stat('Lượt học / trận đã hoàn thành',s.completed_sessions,`${s.correct}/${s.answers} câu trả lời đúng`)}</View>
      </View>
      <View style={{gap:12}}><Txt f="bold" size={20} accessibilityRole="header">Thi đấu {system?'theo trường':'trong trường'}</Txt><View style={{flexDirection:'row',flexWrap:'wrap',gap:12}}>{stat('Trận đã kết thúc',s.competitions,'Chỉ tính trận đã lưu kết quả')}{stat('Lượt tham gia',s.participations,`${s.unique_participants} học sinh khác nhau`)}{stat('Trả lời đúng khi thi đấu',pct(s.competition_accuracy),`${s.competition_correct}/${s.competition_answers} câu đã trả lời`)}</View>
        {(data.excluded_legacy_competitions>0||s.legacy_competitions>0)&&<Inset><Txt size={13}>{data.excluded_legacy_competitions>0?`${data.excluded_legacy_competitions} trận chưa rõ năm học đã được loại khỏi bộ lọc năm.`:`Có ${s.legacy_competitions} trận chưa xác định năm học; vẫn tính khi xem tất cả năm.`}</Txt></Inset>}
      </View>
      <Card pad={20} style={{gap:16}}><Txt f="bold" size={19} accessibilityRole="header">Khối và lớp theo năm học</Txt><View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}>{gradeTotals.map(g=><Inset key={g.grade} style={{flexGrow:1,flexBasis:180,gap:4}}><Txt f="bold">Khối {g.grade}</Txt><Txt size={13}>{g.schools} trường · {g.classes} lớp · {g.students} học sinh</Txt></Inset>)}</View>
        {classTotals.length?classTotals.map(g=><View key={g.year+':'+g.grade} style={{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',gap:8,borderTopWidth:1,borderTopColor:c.adminLine,paddingTop:12}}><Txt f="bold" size={13}>{g.year} · {g.grade?`Khối ${g.grade}`:'Chưa rõ khối'}</Txt><Txt size={13}>{g.classes} lớp · {g.active} hoạt động</Txt></View>):<Txt size={13} color={c.muc3}>Chưa có lớp trong bộ lọc này.</Txt>}
      </Card>
      <View style={{gap:12}}><Txt f="bold" size={20} accessibilityRole="header">{system?'So sánh giữa các trường':'Số liệu trường của bạn'}</Txt>
        {!rows.length?<EmptyState title="Chưa có dữ liệu phù hợp" text="Thay đổi bộ lọc hoặc thêm trường, lớp và tài khoản."/>:rows.map(r=><View key={r.id} testID={`report-school-${r.id}`}><Card pad={20} style={{gap:14}}>
          <View style={{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',gap:8}}><View style={{flexShrink:1,gap:4}}><Txt f="bold" size={18}>{r.name}</Txt><Txt size={12} color={c.muc3}>Mã {r.school_code} · {[r.region,r.city].filter(Boolean).join(' · ')||'Chưa có địa bàn'}</Txt></View><Chip text={r.is_active?'Đang hoạt động':'Tạm ngưng'} bg={r.is_active?c.ngocNhat:c.sonNhat} fg={r.is_active?c.ngocChu:c.sonChu}/></View>
          <Txt size={13}>{r.grades} khối · {r.classes} lớp · {r.teachers} giáo viên · {r.students} học sinh</Txt>
          <View style={{gap:7}}><Txt size={13}>Hoàn thành lượt học: {pct(r.completion_rate)} · Điểm luyện tập TB: {score(r.average_score)}/10</Txt><Bar value={r.completion_rate??0} max={1} fill={c.son} height={8} label={`Tỷ lệ hoàn thành lượt học của ${r.name}: ${pct(r.completion_rate)}`}/><Txt size={13}>Tham gia luyện tập/game: {pct(r.game_participation_rate)} · {r.completed_sessions} lượt hoàn thành</Txt></View>
          <Txt size={13}>Thi đấu: {r.competitions} trận · {r.participations} lượt tham gia · đúng {pct(r.competition_accuracy)}</Txt>
        </Card></View>)}
        {data.per_school.length>perPage&&<View style={{flexDirection:'row',flexWrap:'wrap',gap:10,justifyContent:'space-between',alignItems:'center'}}><Txt size={13}>Trang {page}/{Math.ceil(data.per_school.length/perPage)} · {data.per_school.length} trường</Txt><View style={{flexDirection:'row',gap:8}}><Btn title="Trường trang trước" tone="giay" size="sm" disabled={page<=1} onPress={()=>setPage(p=>p-1)}/><Btn title="Trường trang sau" tone="giay" size="sm" disabled={page*perPage>=data.per_school.length} onPress={()=>setPage(p=>p+1)}/></View></View>}
      </View>
      <Card pad={20} style={{gap:12}}><Btn title={definitions?'Ẩn cách tính thống kê':'Xem cách tính thống kê'} tone="giay" onPress={()=>setDefinitions(v=>!v)}/>{definitions&&data.definitions.map((d,i)=><Txt key={i} size={13} color={c.muc2}>{i+1}. {d}</Txt>)}</Card>
    </>}
    {overview&&<Card pad={20} style={{gap:12}}><Txt f="bold" size={18}>Công việc cần xử lý</Txt><View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}>{([{id:'classes',label:'Lớp chờ duyệt',n:overview.pending_classes},{id:'import',label:'Dòng nhập thiếu thông tin',n:overview.incomplete},{id:'mail',label:'Thư chờ / lỗi',n:overview.outbox.queued+overview.outbox.sending+overview.outbox.failed},{id:'trash',label:'Tài khoản trong thùng rác',n:overview.trash}] as const).map(x=><Btn key={x.id} title={`${x.label}: ${x.n}`} tone="giay" onPress={()=>onNavigate(x.id)}/>)}</View></Card>}
  </View>;
}
