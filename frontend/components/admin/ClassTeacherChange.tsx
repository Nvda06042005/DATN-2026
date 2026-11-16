import React,{useState} from 'react';
import {View} from 'react-native';
import * as rooms from '@/api/classroomApi';
import * as admin from '@/api/adminApi';
import type {Session} from '@/components/auth';
import type {TeacherChangeRequest} from '@/types/api';
import {Btn,Card,ConfirmSheet,Field,Sheet,Spinner,ToggleRow,Txt} from '@/components/ui';
import {ErrorNote,useAction,useLoad} from './kit';
import {AdminSelect} from './AdminSelect';
import * as authApi from '@/api/authApi';
import {FileSignature} from 'lucide-react-native';
import {useTheme} from '@/hooks/use-theme';

/**
 * Đơn đề nghị thay đổi giáo viên phụ trách lớp (yêu cầu 16/11/2026: "làm theo cách viết đơn xin đổi giáo viên … trường hợp sinh đẻ, tai nạn…").
 * Bố cục theo đơn hành chính thông dụng: Quốc hiệu – Tiêu ngữ, địa danh và ngày, tên đơn, Kính gửi Ban Giám hiệu, thông tin người làm đơn và lớp đang phụ trách,
 * lý do và trình bày cụ thể, thời gian, giấy tờ kèm theo, đề xuất giáo viên tiếp nhận, cam kết bàn giao, lời kết và chữ ký. Đơn gửi quản trị trường duyệt;
 * duyệt xong phân công mới có hiệu lực (một lớp chỉ một giáo viên phụ trách mỗi học kỳ).
 */
const CHANGE_REASONS: Array<{ value: string; label: string; docs: string }> = [
  { value: 'Nghỉ sinh con (chế độ thai sản)', label: 'Nghỉ sinh con (thai sản)', docs: 'Ví dụ: giấy ra viện, giấy chứng sinh hoặc giấy tờ xác nhận thời gian nghỉ thai sản' },
  { value: 'Bị tai nạn, cần điều trị', label: 'Tai nạn', docs: 'Ví dụ: giấy ra viện, giấy xác nhận điều trị của cơ sở y tế' },
  { value: 'Ốm đau phải điều trị dài ngày', label: 'Ốm đau dài ngày', docs: 'Ví dụ: giấy xác nhận của cơ sở y tế, giấy chứng nhận nghỉ việc hưởng bảo hiểm xã hội' },
  { value: 'Được cử đi công tác, học tập dài ngày', label: 'Công tác, học tập dài ngày', docs: 'Ví dụ: quyết định cử đi công tác hoặc học tập' },
  { value: 'Hoàn cảnh gia đình đặc biệt', label: 'Hoàn cảnh gia đình', docs: 'Giấy tờ liên quan (nếu có)' },
  { value: 'Lý do khác', label: 'Lý do khác', docs: 'Giấy tờ liên quan (nếu có)' },
];
const DMY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

const Line: React.FC<{ label: string; value: string }> = ({ label, value }) => <Txt size={14}><Txt f="semibold" size={14}>{label}: </Txt>{value}</Txt>;

export const TeacherChangeForm: React.FC<{ session: Session; classId: number; onClose: () => void }> = ({ session, classId, onClose }) => {
  const { c } = useTheme();
  const info = useLoad(() => rooms.teacherChangeOptions(session.token, classId), [session.token, classId], session.expired);
  const profile = useLoad(() => authApi.getProfile(session.token), [session.token], session.expired);
  const action = useAction(session.expired);
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [docs, setDocs] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [pledge, setPledge] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const pending = info.data?.requests.find((r) => r.status === 'pending' && r.semester === info.data?.semester);
  if (!info.data || pending) {
    return (
      <Sheet open onClose={onClose} title="Đơn đề nghị thay đổi giáo viên phụ trách lớp">
        <ErrorNote message={info.error} />{!info.data && !info.error ? <Spinner /> : null}
        {pending ? <><Txt f="bold">{pending.class_name} · Học kỳ {pending.semester}</Txt><Txt>{pending.from_teacher_name} → {pending.to_teacher_name}</Txt><Txt>Đơn đang chờ quản trị trường duyệt. Phân công hiện tại giữ nguyên cho tới khi được duyệt.</Txt>
          {pending.requested_by === session.user.id ? <Btn title="Rút đơn" tone="giay" loading={action.busy} testID="teacher-change-cancel" onPress={async () => { if (await action.run(() => rooms.cancelTeacherChange(session.token, pending.id), 'Đã rút đơn')) onClose(); }} /> : null}</> : null}
      </Sheet>
    );
  }
  const data = info.data;
  const now = new Date();
  const school = profile.data?.school?.name ?? 'nhà trường';
  const place = profile.data?.school?.city ?? '';
  const picked = CHANGE_REASONS.find((r) => r.value === reason);
  const candidate = data.candidates.find((t) => String(t.id) === teacherId);
  const submit = async (): Promise<void> => {
    setProblem(null);
    if (!reason) { setProblem('Hãy chọn lý do.'); return; }
    if (detail.trim().length < 10) { setProblem('Hãy trình bày cụ thể lý do (ít nhất 10 ký tự).'); return; }
    if (from && !DMY.test(from.trim())) { setProblem('Ngày bắt đầu ghi theo dạng ngày/tháng/năm, ví dụ 05/01/2027.'); return; }
    if (to && !DMY.test(to.trim())) { setProblem('Ngày kết thúc ghi theo dạng ngày/tháng/năm.'); return; }
    if (!teacherId) { setProblem('Hãy chọn giáo viên đề xuất tiếp nhận lớp.'); return; }
    if (!pledge) { setProblem('Hãy xác nhận cam kết bàn giao lớp.'); return; }
    const lines = [
      'ĐƠN ĐỀ NGHỊ THAY ĐỔI GIÁO VIÊN PHỤ TRÁCH LỚP',
      `Kính gửi: Ban Giám hiệu ${school}`,
      `Người làm đơn: ${session.user.full_name}${session.user.user_code ? ` (mã ${session.user.user_code})` : ''}, giáo viên phụ trách lớp ${data.class_name}, học kỳ ${data.semester}.`,
      `Lý do: ${reason}.`,
      `Trình bày: ${detail.trim().slice(0, 420)}`,
      from || to ? `Thời gian: ${from ? `từ ngày ${from.trim()}` : ''}${to ? ` đến ngày ${to.trim()}` : ''}.` : '',
      docs.trim() ? `Giấy tờ kèm theo: ${docs.trim().slice(0, 160)}.` : '',
      `Đề xuất giáo viên tiếp nhận lớp: ${candidate?.full_name ?? ''}.`,
      'Tôi cam kết bàn giao đầy đủ hồ sơ, sổ sách và tình hình học tập của lớp cho giáo viên tiếp nhận, và chịu trách nhiệm về nội dung đơn.',
    ].filter(Boolean);
    if (await action.run(() => rooms.requestTeacherChange(session.token, classId, Number(teacherId), lines.join('\n').slice(0, 1000)), 'Đã gửi đơn tới quản trị trường')) onClose();
  };
  return (
    <Sheet open wide onClose={onClose} title="Đơn đề nghị thay đổi giáo viên phụ trách lớp" subtitle={`${data.class_name} · Quản trị trường duyệt trước khi thay đổi phân công`}
      footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}><Btn title="Hủy" tone="giay" onPress={onClose} /><Btn title="Gửi đơn" tone="son" loading={action.busy} onPress={() => { void submit(); }} testID="teacher-change-submit" /></View>}>
      <Card flat pad={20} style={{ gap: 12, borderRadius: 8 }} testID="teacher-change-letter">
        <View style={{ alignItems: 'center', gap: 2 }}>
          <Txt f="bold" size={14} center>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</Txt>
          <Txt f="bold" size={14} center style={{ textDecorationLine: 'underline' }}>Độc lập – Tự do – Hạnh phúc</Txt>
        </View>
        <Txt size={13} color={c.muc2} style={{ alignSelf: 'flex-end', fontStyle: 'italic' }}>{place ? `${place}, ` : ''}ngày {now.getDate()} tháng {now.getMonth() + 1} năm {now.getFullYear()}</Txt>
        <Txt f="bold" size={17} center>ĐƠN ĐỀ NGHỊ THAY ĐỔI GIÁO VIÊN PHỤ TRÁCH LỚP</Txt>
        <Txt size={14} center><Txt f="semibold" size={14}>Kính gửi: </Txt>Ban Giám hiệu {school}</Txt>
        <View style={{ gap: 4 }}>
          <Line label="Tôi tên là" value={session.user.full_name} />
          {session.user.user_code ? <Line label="Mã giáo viên" value={session.user.user_code} /> : null}
          <Line label="Hiện đang phụ trách lớp" value={`${data.class_name}, học kỳ ${data.semester}`} />
        </View>
        <Txt size={14}>Nay tôi làm đơn này kính đề nghị Ban Giám hiệu xem xét cho tôi được thay đổi giáo viên phụ trách lớp nêu trên với lý do sau:</Txt>
        <AdminSelect label="Lý do *" value={reason} onChange={setReason} testID="teacher-change-reason" options={[{ value: '', label: 'Chọn lý do' }, ...CHANGE_REASONS.map((r) => ({ value: r.value, label: r.label }))]} />
        <Field label="Trình bày cụ thể *" value={detail} onChangeText={setDetail} multiline numberOfLines={4} maxLength={420} placeholder="Ví dụ: Tôi dự kiến sinh con vào tháng 01/2027 nên không thể tiếp tục phụ trách lớp trong thời gian nghỉ…" testID="teacher-change-detail" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          <View style={{ flexGrow: 1, flexBasis: 200 }}><Field label="Từ ngày (dự kiến)" value={from} onChangeText={setFrom} placeholder="dd/mm/yyyy" testID="teacher-change-from" /></View>
          <View style={{ flexGrow: 1, flexBasis: 200 }}><Field label="Đến ngày (dự kiến)" value={to} onChangeText={setTo} placeholder="dd/mm/yyyy" testID="teacher-change-to" /></View>
        </View>
        <Field label="Giấy tờ kèm theo" value={docs} onChangeText={setDocs} maxLength={160} hint={picked?.docs ?? 'Ghi các giấy tờ nộp kèm đơn cho nhà trường (nếu có).'} testID="teacher-change-docs" />
        <AdminSelect label="Đề xuất giáo viên tiếp nhận lớp *" value={teacherId} onChange={setTeacherId} testID="teacher-change-teacher"
          options={[{ value: '', label: 'Chọn giáo viên' }, ...data.candidates.map((t) => ({ value: String(t.id), label: `${t.full_name}${t.user_code ? ` · ${t.user_code}` : ''}` }))]} />
        <ToggleRow icon={FileSignature} checked={pledge} onChange={setPledge} label="Tôi cam kết bàn giao lớp" desc="Bàn giao đầy đủ hồ sơ, sổ sách và tình hình học tập của lớp cho giáo viên tiếp nhận; chịu trách nhiệm về nội dung đơn." />
        <Txt size={14}>Kính mong Ban Giám hiệu xem xét, chấp thuận. Tôi xin chân thành cảm ơn!</Txt>
        <View style={{ alignSelf: 'flex-end', alignItems: 'center', gap: 2, minWidth: 200 }}>
          <Txt f="bold" size={14}>Người làm đơn</Txt>
          <Txt size={12} color={c.muc3} style={{ fontStyle: 'italic' }}>(Ký và ghi rõ họ tên)</Txt>
          <Txt f="semibold" size={15} style={{ marginTop: 18 }}>{session.user.full_name}</Txt>
        </View>
        <ErrorNote message={problem} />
      </Card>
    </Sheet>
  );
};

export const TeacherChangeReview:React.FC<{session:Session;requests:TeacherChangeRequest[];loading:boolean;error:string|null;onReload:()=>void;onClose:()=>void}>=({session,requests,loading,error,onReload,onClose})=>{
  const [choice,setChoice]=useState<{request:TeacherChangeRequest;decision:'approved'|'rejected'}|null>(null);
  const {run,busy}=useAction(session.expired);
  return <><Sheet open wide onClose={onClose} title="Duyệt đề nghị đổi giáo viên" footer={<Btn title="Làm mới" tone="giay" onPress={onReload}/>}>
    <ErrorNote message={error}/>{loading?<Spinner/>:null}
    {!loading&&!requests.length?<Txt>Chưa có đề nghị đang chờ duyệt.</Txt>:null}
    {requests.map(r=><Card key={r.id} flat pad={16} style={{gap:10}}><Txt f="bold">{r.class_name} · Học kỳ {r.semester}</Txt><Txt>{r.from_teacher_name??'Giáo viên cũ'} → {r.to_teacher_name??'Tài khoản không còn'}</Txt>{r.note?<Txt size={14} style={{lineHeight:22}}>{r.note}</Txt>:null}
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}><Btn title="Duyệt thay đổi" tone="son" testID={`teacher-change-approve-${r.id}`} onPress={()=>setChoice({request:r,decision:'approved'})}/><Btn title="Từ chối" tone="giay" onPress={()=>setChoice({request:r,decision:'rejected'})}/></View></Card>)}
  </Sheet>
  {choice?<ConfirmSheet open title={choice.decision==='approved'?'Duyệt thay đổi giáo viên':'Từ chối đề nghị'} message={`${choice.request.class_name} · Học kỳ ${choice.request.semester}: ${choice.request.from_teacher_name} → ${choice.request.to_teacher_name}. ${choice.decision==='approved'?'Phân công mới có hiệu lực ngay sau khi duyệt.':'Phân công hiện tại được giữ nguyên.'}`} confirmLabel={choice.decision==='approved'?'Xác nhận duyệt':'Xác nhận từ chối'} busy={busy} onCancel={()=>setChoice(null)} onConfirm={async()=>{if(await run(()=>admin.decideTeacherChange(session.token,choice.request.id,choice.decision),'Đã xử lý đề nghị')){setChoice(null);onReload();}}}/>:null}</>;
};
