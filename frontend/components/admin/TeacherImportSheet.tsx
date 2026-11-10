import React from 'react';
import {Linking,View} from 'react-native';
import * as api from '@/api/adminApi';
import type {Session} from '@/components/auth';
import {Btn,Sheet,Spinner} from '@/components/ui';
import {ErrorNote,ImportSheet,useLoad} from './kit';

export const TeacherImportSheet:React.FC<{session:Session;onClose:()=>void;onDone:()=>void;kind?:'teachers'|'students';yearId?:number}>=({session,onClose,onDone,kind='teachers',yearId})=>{
  const {token}=session;
  const student=kind==='students',title=student?'Nhập danh sách học sinh':'Nhập danh sách giáo viên';
  const {data:spec,error,reload}=useLoad(()=>student?api.studentImportSpec(token):api.teacherImportSpec(token),[token,kind],session.expired);
  if(!spec) return <Sheet open title={title} onClose={onClose}>{error?<><ErrorNote message={error}/><Btn title="Thử lại" onPress={reload}/></>:<Spinner label="Đang tải file mẫu của trường…"/>}</Sheet>;
  return <ImportSheet title={title} hint="Mẫu .xlsx không macro, dùng lịch Đông A để chọn tháng, năm và ngày sinh. Cài lịch một lần trên Microsoft Excel Windows; dòng đủ thông tin sẽ tính STT/mã rồi sang Họ tên dòng tiếp theo." acceptMacro
    extra={<View><Btn title="Cài lịch Đông A" tone="giay" size="sm" onPress={()=>Linking.openURL('https://datn-2026-indol.vercel.app/office-calendar/install.html')}/></View>}
    expectedFilename={spec.filename} legacyFilename={spec.legacy_filename} template={{filename:spec.filename,fetchBlob:()=>api.downloadFile(token,`/api/admin/${kind}/template`)}}
    run={(file,commit)=>api.importMembers(token,kind,file,{commit,year_id:student?yearId:undefined})} onClose={onClose} onDone={onDone}/>;
};
