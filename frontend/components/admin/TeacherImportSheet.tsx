import React from 'react';
import * as api from '@/api/adminApi';
import type {Session} from '@/components/auth';
import {Btn,Sheet,Spinner} from '@/components/ui';
import {ErrorNote,ImportSheet,useLoad} from './kit';

export const TeacherImportSheet:React.FC<{session:Session;onClose:()=>void;onDone:()=>void;kind?:'teachers'|'students';yearId?:number}>=({session,onClose,onDone,kind='teachers',yearId})=>{
  const {token}=session;
  const student=kind==='students',title=student?'Nhập danh sách học sinh':'Nhập danh sách giáo viên';
  const {data:spec,error,reload}=useLoad(()=>student?api.studentImportSpec(token):api.teacherImportSpec(token),[token,kind],session.expired);
  if(!spec) return <Sheet open title={title} onClose={onClose}>{error?<><ErrorNote message={error}/><Btn title="Thử lại" onPress={reload}/></>:<Spinner label="Đang tải file mẫu của trường…"/>}</Sheet>;
  return <ImportSheet title={title} hint="Chỉ nhận đúng file mẫu của trường. Chọn ngày sinh trong Excel để tự sinh mã." acceptMacro
    expectedFilename={spec.filename} legacyFilename={spec.legacy_filename} template={{filename:spec.filename,fetchBlob:()=>api.downloadFile(token,`/api/admin/${kind}/template`)}}
    run={(file,commit)=>api.importMembers(token,kind,file,{commit,year_id:student?yearId:undefined})} onClose={onClose} onDone={onDone}/>;
};
