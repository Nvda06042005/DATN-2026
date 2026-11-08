import React from 'react';
import { View } from 'react-native';
import { previewRegistrationCode } from '@/api/adminApi';
import { ErrorNote, useLoad } from './kit';
import { Btn, Field } from '@/components/ui';

/** `showSerial`: thêm ô Số thứ tự chỉ đọc ngay trước mã, như hai cột đầu của file Excel (biểu mẫu thêm giáo viên và học sinh). */
export const RegistrationCode: React.FC<{token:string;kind:'teacher'|'student'|'class';birthDate?:string;schoolId?:number;userId?:number;showSerial?:boolean}>=({token,kind,birthDate,schoolId,userId,showSerial})=>{
  const {data,error,loading,reload}=useLoad(()=>previewRegistrationCode(token,kind,{birth_date:birthDate,school_id:schoolId,user_id:userId}),[token,kind,birthDate,schoolId,userId]);
  const code=<Field label={kind==='teacher'?'Mã giáo viên':kind==='student'?'Mã học sinh':'Mã lớp'} value={loading||error?'':data?.code??''} editable={false} placeholder={loading?'…':kind==='class'?'':'Chọn ngày sinh để hiện mã'} testID={`registration-code-${kind}`} />;
  const serial=!loading&&!error&&data?.code&&data.serial?String(data.serial):'';
  return <View style={{gap:8}}>{showSerial
    ?<View style={{flexDirection:'row',flexWrap:'wrap',gap:12}}><View style={{flexGrow:1,flexBasis:240}}><Field label="Số thứ tự" value={serial} editable={false} testID={`registration-serial-${kind}`} /></View><View style={{flexGrow:1,flexBasis:240}}>{code}</View></View>
    :code}
    {error?<><ErrorNote message={error}/><Btn title="Thử lại" tone="giay" size="sm" onPress={reload}/></>:null}</View>;
};
