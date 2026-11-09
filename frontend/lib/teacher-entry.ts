import type { TeacherDraftRow, TeacherImportSpec } from '@/api/adminApi';
export type TeacherEntryRow={full_name:string;gender:string;phone:string;email:string;birth_date:string};
export const blankTeacherRow=():TeacherEntryRow=>({full_name:'',gender:'',phone:'',email:'',birth_date:''});
export const hasTeacherInput=(row:TeacherEntryRow)=>Object.values(row).some(value=>value.trim());
export function teacherRowError(row:TeacherEntryRow,today:string):string|null {
  if(row.full_name.trim().length<2) return 'Nhập họ và tên.';
  if(!/^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(row.email.trim())) return 'Nhập email hợp lệ.';
  if(!/^\d{4}-\d{2}-\d{2}$/.test(row.birth_date)||!Number.isFinite(Date.parse(row.birth_date))||new Date(row.birth_date).toISOString().slice(0,10)!==row.birth_date||row.birth_date<'1940-01-01'||row.birth_date>today) return 'Chọn ngày sinh hợp lệ.';
  if(row.phone.trim()&&!/^[0-9+() .-]{8,20}$/.test(row.phone.trim())) return 'Số điện thoại không hợp lệ.';
  return null;
}
export function numberedTeacherRows(rows:TeacherEntryRow[],spec:TeacherImportSpec,today:string){
  let count=0;
  return rows.map(row=>{
    if(teacherRowError(row,today)) return {stt:null,code:''};
    const stt=++count,born=row.birth_date;
    return {stt,code:`${spec.prefix}${born.slice(8,10)}${born.slice(5,7)}${born.slice(0,4)}${String(spec.next_serial+stt-1).padStart(3,'0')}`};
  });
}
export function teacherDraft(row:TeacherEntryRow):TeacherDraftRow {
  return {full_name:row.full_name.trim(),email:row.email.trim(),phone:row.phone.trim()||undefined,gender:row.gender==='male'||row.gender==='female'?row.gender:undefined,birth_date:row.birth_date};
}
