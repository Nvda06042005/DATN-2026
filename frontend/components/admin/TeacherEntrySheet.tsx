import React,{useRef,useState} from 'react';
import {Platform,ScrollView,View,useWindowDimensions} from 'react-native';
import {Download,Plus,Trash2} from 'lucide-react-native';
import {teacherDraftWorkbook,type TeacherImportSpec} from '@/api/adminApi';
import {errorMessage} from '@/api/client';
import {Btn,Sheet,Txt,useToast} from '@/components/ui';
import {FONT} from '@/constants/theme';
import {useTheme} from '@/hooks/use-theme';
import {todayVn} from '@/lib/school-terms';
import {blankTeacherRow,hasTeacherInput,numberedTeacherRows,teacherDraft,teacherRowError,type TeacherEntryRow} from '@/lib/teacher-entry';
import {ErrorNote,saveBlob} from './kit';

const FIELDS=[{key:'full_name',label:'Họ và tên *',width:200},{key:'gender',label:'Giới tính',width:105},{key:'phone',label:'SĐT',width:135},{key:'email',label:'Email *',width:225},{key:'birth_date',label:'Ngày tháng năm sinh *',width:175}] as const;
type InputKey=typeof FIELDS[number]['key'];

export const TeacherEntrySheet:React.FC<{token:string;spec:TeacherImportSpec;onClose:()=>void}>=({token,spec,onClose})=>{
  const {c}=useTheme(),toast=useToast(),{width}=useWindowDimensions();
  const compact=width<680,today=todayVn();
  const [rows,setRows]=useState<TeacherEntryRow[]>([blankTeacherRow()]);
  const [error,setError]=useState<string|null>(null),[busy,setBusy]=useState(false);
  const refs=useRef<Record<string,HTMLInputElement|HTMLSelectElement|null>>({});
  const numbered=numberedTeacherRows(rows,spec,today);
  const focus=(index:number,key:InputKey)=>setTimeout(()=>refs.current[`${index}-${key}`]?.focus(),0);
  const update=(index:number,key:InputKey,value:string)=>{setRows(previous=>previous.map((row,i)=>i===index?{...row,[key]:value}:row));setError(null);};
  const enter=(index:number,key:InputKey)=>{
    const next=FIELDS.findIndex(field=>field.key===key)+1;
    if(next<FIELDS.length){focus(index,FIELDS[next].key);return;}
    const problem=teacherRowError(rows[index],today);
    if(problem){setError(`Dòng ${index+1}: ${problem}`);return;}
    if(index===rows.length-1){if(rows.length>=1000){setError('Tối đa 1000 giáo viên mỗi file.');return;}setRows(previous=>[...previous,blankTeacherRow()]);}
    focus(index+1,'full_name');
  };
  const download=async()=>{
    const selected=rows.map((row,index)=>({row,index})).filter(({row})=>hasTeacherInput(row));
    if(!selected.length){setError('Nhập ít nhất một giáo viên.');return;}
    const seen=new Set<string>();
    for(const {row,index} of selected){
      const problem=teacherRowError(row,today),email=row.email.trim().toLowerCase();
      if(problem||seen.has(email)){setError(`Dòng ${index+1}: ${problem||'Email trùng với dòng trước.'}`);return;}
      seen.add(email);
    }
    setBusy(true);setError(null);
    try{const blob=await teacherDraftWorkbook(token,selected.map(({row})=>teacherDraft(row)));if(!saveBlob(blob,spec.filename))throw Error('Tải file bằng trình duyệt web.');toast('Đã tải file Excel. Chọn file này để kiểm tra và nhập danh sách.');}
    catch(e){setError(errorMessage(e));}finally{setBusy(false);}
  };
  const input=(index:number,key:InputKey)=>{
    const shared={id:`teacher-entry-${key}-${index}`,'data-testid':`teacher-entry-${key}-${index}`,'aria-label':`${FIELDS.find(f=>f.key===key)!.label.replace(' *','')} dòng ${index+1}`,value:rows[index][key],disabled:busy,
      ref:(node:HTMLInputElement|HTMLSelectElement|null)=>{refs.current[`${index}-${key}`]=node;},
      onChange:(event:React.ChangeEvent<HTMLInputElement|HTMLSelectElement>)=>update(index,key,event.target.value),
      onKeyDown:(event:React.KeyboardEvent<HTMLInputElement|HTMLSelectElement>)=>{if(event.key==='Enter'){event.preventDefault();enter(index,key);}},
      style:{width:'100%',height:44,boxSizing:'border-box' as const,border:`1px solid ${c.vien}`,borderRadius:5,padding:'8px 10px',background:c.the,color:c.muc,fontFamily:FONT.body,fontSize:14}};
    if(key==='gender')return React.createElement('select',shared,React.createElement('option',{value:''},'Chưa chọn'),React.createElement('option',{value:'male'},'Nam'),React.createElement('option',{value:'female'},'Nữ'));
    return React.createElement('input',{...shared,type:key==='birth_date'?'date':key==='email'?'email':key==='phone'?'tel':'text',...(key==='birth_date'?{min:'1940-01-01',max:today,lang:'vi'}:{}),maxLength:key==='full_name'?80:key==='email'?254:undefined});
  };
  return <Sheet open wide panelStyle={compact?undefined:{maxWidth:1280}} title="Nhập danh sách giáo viên" subtitle={spec.school_name} onClose={onClose}
    footer={<View style={{flexDirection:'row',justifyContent:'flex-end',gap:10}}><Btn title="Quay lại" tone="giay" onPress={onClose} disabled={busy}/><Btn title="Tải Excel" icon={Download} tone="son" onPress={download} loading={busy} testID="teacher-entry-download"/></View>}>
    <Txt size={14} color={c.muc2}>Chọn ngày sinh trên lịch. Nhấn Enter ở cuối dòng để sang Họ và tên dòng tiếp theo; STT và mã tự sinh.</Txt>
    <ErrorNote message={error}/>
    {Platform.OS==='web'?<ScrollView horizontal={!compact}>
      <View style={{gap:compact?12:5,minWidth:compact?undefined:1160,flex:1}}>
        {!compact?<View style={{flexDirection:'row',gap:8,paddingBottom:6}}><View style={{width:40}}><Txt f="bold" size={13}>STT</Txt></View><View style={{width:170}}><Txt f="bold" size={13}>Mã giáo viên</Txt></View>{FIELDS.map(field=><View key={field.key} style={{width:field.width}}><Txt f="bold" size={13}>{field.label}</Txt></View>)}</View>:null}
        {rows.map((_row,index)=><View key={index} testID={`teacher-entry-row-${index}`} style={{flexDirection:compact?'column':'row',gap:8,...(compact?{padding:12,borderWidth:1,borderColor:c.vien,borderRadius:10}:{alignItems:'center'})}}>
          <View style={{width:compact?undefined:40}}><Txt size={13}>{compact?'STT: ':''}{numbered[index].stt??'—'}</Txt></View>
          <View style={{width:compact?undefined:170}}><Txt size={13} f="semibold" testID={`teacher-entry-code-${index}`}>{numbered[index].code||(compact?'Mã giáo viên: —':'—')}</Txt></View>
          {FIELDS.map(field=><View key={field.key} style={{width:compact?'100%':field.width,gap:5}}>{compact?<Txt size={13} f="semibold">{field.label}</Txt>:null}{input(index,field.key)}</View>)}
          <Btn title="" label={`Xóa dòng ${index+1}`} icon={Trash2} size="sm" tone="giay" disabled={busy} onPress={()=>setRows(previous=>previous.length===1?[blankTeacherRow()]:previous.filter((_,i)=>i!==index))}/>
        </View>)}
      </View>
    </ScrollView>:<Txt>Mở trên trình duyệt web để nhập bằng bảng có lịch.</Txt>}
    <Btn title="Thêm dòng" icon={Plus} tone="giay" size="sm" disabled={busy||rows.length>=1000} onPress={()=>{const index=rows.length;setRows(previous=>[...previous,blankTeacherRow()]);focus(index,'full_name');}} testID="teacher-entry-add-row"/>
  </Sheet>;
};
