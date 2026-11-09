import React,{useState} from 'react';
import {Grid2X2} from 'lucide-react-native';
import * as api from '@/api/adminApi';
import type {Session} from '@/components/auth';
import {Btn,Sheet,Spinner} from '@/components/ui';
import {ErrorNote,ImportSheet,useLoad} from './kit';
import {TeacherEntrySheet} from './TeacherEntrySheet';

export const TeacherImportSheet:React.FC<{session:Session;onClose:()=>void;onDone:()=>void}>=({session,onClose,onDone})=>{
  const {token}=session;
  const {data:spec,error,reload}=useLoad(()=>api.teacherImportSpec(token),[token],session.expired);
  const [entry,setEntry]=useState(false);
  if(!spec) return <Sheet open title="Nhập danh sách giáo viên" onClose={onClose}>{error?<><ErrorNote message={error}/><Btn title="Thử lại" onPress={reload}/></>:<Spinner label="Đang tải file mẫu của trường…"/>}</Sheet>;
  if(entry) return <TeacherEntrySheet token={token} spec={spec} onClose={()=>setEntry(false)}/>;
  return <ImportSheet title="Nhập danh sách giáo viên" hint="Chỉ nhận đúng file mẫu của trường. Nhập trên bảng để chọn ngày sinh và tự sinh mã."
    expectedFilename={spec.filename} template={{filename:spec.filename,fetchBlob:()=>api.downloadFile(token,'/api/admin/teachers/template')}}
    actions={<Btn title="Nhập trên bảng" icon={Grid2X2} tone="son" size="sm" testID="teacher-entry-open" onPress={()=>setEntry(true)}/>}
    run={(file,commit)=>api.importMembers(token,'teachers',file,{commit})} onClose={onClose} onDone={onDone}/>;
};
