import React from 'react';
import { View } from 'react-native';
import { previewRegistrationCode } from '@/api/adminApi';
import { ErrorNote, useLoad } from './kit';
import { Btn, Field } from '@/components/ui';

export const RegistrationCode: React.FC<{token:string;kind:'teacher'|'student'|'class'}>=({token,kind})=>{
  const {data,error,loading,reload}=useLoad(()=>previewRegistrationCode(token,kind),[token,kind]);
  return <View style={{gap:8}}><Field label={kind==='teacher'?'Mã giáo viên':kind==='student'?'Mã học sinh':'Mã lớp'} value={data?.code??''} editable={false} placeholder={loading?'…':''} testID={`registration-code-${kind}`} />
    {error?<><ErrorNote message={error}/><Btn title="Thử lại" tone="giay" size="sm" onPress={reload}/></>:null}</View>;
};
