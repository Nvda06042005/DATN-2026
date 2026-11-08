import React from 'react';
import { View } from 'react-native';
import { previewRegistrationCode } from '@/api/adminApi';
import { ErrorNote, useLoad } from './kit';
import { Btn, Field } from '@/components/ui';

export const RegistrationCode: React.FC<{token:string;kind:'teacher'|'student'|'class';birthDate?:string;schoolId?:number;userId?:number}>=({token,kind,birthDate,schoolId,userId})=>{
  const {data,error,loading,reload}=useLoad(()=>previewRegistrationCode(token,kind,{birth_date:birthDate,school_id:schoolId,user_id:userId}),[token,kind,birthDate,schoolId,userId]);
  return <View style={{gap:8}}><Field label={kind==='teacher'?'Mã giáo viên':kind==='student'?'Mã học sinh':'Mã lớp'} value={loading||error?'':data?.code??''} editable={false} placeholder={loading?'…':kind==='teacher'?'Chọn ngày sinh để hiện mã':''} testID={`registration-code-${kind}`} />
    {error?<><ErrorNote message={error}/><Btn title="Thử lại" tone="giay" size="sm" onPress={reload}/></>:null}</View>;
};
