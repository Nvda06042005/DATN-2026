import React,{useState} from 'react';
import {View} from 'react-native';
import * as rooms from '@/api/classroomApi';
import * as admin from '@/api/adminApi';
import type {Session} from '@/components/auth';
import type {TeacherChangeRequest} from '@/types/api';
import {Btn,Card,ConfirmSheet,Sheet,Spinner,Txt} from '@/components/ui';
import {ErrorNote,FormSheet,useAction,useLoad} from './kit';

export const TeacherChangeForm:React.FC<{session:Session;classId:number;onClose:()=>void}>=({session,classId,onClose})=>{
  const info=useLoad(()=>rooms.teacherChangeOptions(session.token,classId),[session.token,classId],session.expired);
  const action=useAction(session.expired);
  const pending=info.data?.requests.find(r=>r.status==='pending'&&r.semester===info.data?.semester);
  if(!info.data || pending)return <Sheet open onClose={onClose} title="Đề nghị đổi giáo viên phụ trách lớp">
    <ErrorNote message={info.error}/>{!info.data&&!info.error?<Spinner/>:null}
    {pending?<><Txt f="bold">{pending.class_name} · Học kỳ {pending.semester}</Txt><Txt>{pending.from_teacher_name} → {pending.to_teacher_name}</Txt><Txt>Đang chờ quản trị trường duyệt. Phân công hiện tại vẫn giữ nguyên.</Txt>{pending.note?<Txt>{pending.note}</Txt>:null}
      {pending.requested_by===session.user.id?<Btn title="Hủy đề nghị" tone="giay" loading={action.busy} testID="teacher-change-cancel" onPress={async()=>{if(await action.run(()=>rooms.cancelTeacherChange(session.token,pending.id),'Đã hủy đề nghị'))info.reload();}}/>:null}</>:null}
  </Sheet>;
  const data=info.data;
  return <FormSheet title="Đề nghị đổi giáo viên phụ trách lớp" subtitle={`${data.class_name} · Quản trị trường duyệt trước khi thay đổi phân công`} submitLabel="Gửi đề nghị" onClose={onClose}
    fields={[{name:'semester',label:'Học kỳ',readOnly:true},{name:'current_teacher',label:'Giáo viên đang phụ trách lớp',readOnly:true},
      {name:'teacher_id',label:'Giáo viên tiếp nhận lớp',type:'select',required:true,options:[{value:'',label:'Chọn giáo viên'},...data.candidates.map(t=>({value:String(t.id),label:`${t.full_name}${t.user_code?` · ${t.user_code}`:''}`}))]},
      {name:'note',label:'Nội dung đề nghị',type:'textarea'}]}
    initial={{semester:`Học kỳ ${data.semester}`,current_teacher:data.teacher_name}}
    onSubmit={async v=>{await rooms.requestTeacherChange(session.token,classId,Number(v.teacher_id),String(v.note??''));onClose();}}/>;
};

export const TeacherChangeReview:React.FC<{session:Session;requests:TeacherChangeRequest[];loading:boolean;error:string|null;onReload:()=>void;onClose:()=>void}>=({session,requests,loading,error,onReload,onClose})=>{
  const [choice,setChoice]=useState<{request:TeacherChangeRequest;decision:'approved'|'rejected'}|null>(null);
  const {run,busy}=useAction(session.expired);
  return <><Sheet open wide onClose={onClose} title="Duyệt đề nghị đổi giáo viên" footer={<Btn title="Làm mới" tone="giay" onPress={onReload}/>}>
    <ErrorNote message={error}/>{loading?<Spinner/>:null}
    {!loading&&!requests.length?<Txt>Chưa có đề nghị đang chờ duyệt.</Txt>:null}
    {requests.map(r=><Card key={r.id} flat pad={16} style={{gap:10}}><Txt f="bold">{r.class_name} · Học kỳ {r.semester}</Txt><Txt>{r.from_teacher_name??'Giáo viên cũ'} → {r.to_teacher_name??'Tài khoản không còn'}</Txt>{r.note?<Txt>{r.note}</Txt>:null}
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}><Btn title="Duyệt thay đổi" tone="son" testID={`teacher-change-approve-${r.id}`} onPress={()=>setChoice({request:r,decision:'approved'})}/><Btn title="Từ chối" tone="giay" onPress={()=>setChoice({request:r,decision:'rejected'})}/></View></Card>)}
  </Sheet>
  {choice?<ConfirmSheet open title={choice.decision==='approved'?'Duyệt thay đổi giáo viên':'Từ chối đề nghị'} message={`${choice.request.class_name} · Học kỳ ${choice.request.semester}: ${choice.request.from_teacher_name} → ${choice.request.to_teacher_name}. ${choice.decision==='approved'?'Phân công mới có hiệu lực ngay sau khi duyệt.':'Phân công hiện tại được giữ nguyên.'}`} confirmLabel={choice.decision==='approved'?'Xác nhận duyệt':'Xác nhận từ chối'} busy={busy} onCancel={()=>setChoice(null)} onConfirm={async()=>{if(await run(()=>admin.decideTeacherChange(session.token,choice.request.id,choice.decision),'Đã xử lý đề nghị')){setChoice(null);onReload();}}}/>:null}</>;
};
