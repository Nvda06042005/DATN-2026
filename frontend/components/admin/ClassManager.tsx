/**
 * Quản lý lớp của giáo viên (HK.GV.007–017): danh sách lớp phụ trách (sĩ số, hành trình đang chạy, tiến độ trung bình), tạo lớp, sửa tên – mô tả – ảnh bìa,
 * mã tham gia và đóng/mở tham gia, lưu trữ hoặc xóa lớp tự tạo; trong từng lớp: học sinh, đội, luật lớp, thưởng/phạt, bài tập, tiến độ, thông báo.
 */
import React, { useState } from 'react';
import { Image, View } from 'react-native';
import { Archive, ArrowLeft, KeyRound, Pencil, Plus, RotateCcw, Trash2, UserPlus } from 'lucide-react-native';
import * as api from '@/api/classroomApi';
import { ClassBattleLinks } from '@/components/admin/ClassBattleLinks';
import { ClassStudents, ClassTeams } from '@/components/admin/ClassPeople';
import { ClassNotices, ClassRewards, ClassRules } from '@/components/admin/ClassRewards';
import { ClassAssignments, ClassProgress } from '@/components/admin/ClassWork';
import { ErrorNote, FormSheet, Page, PageHeader, StatusChip, useAction, useLoad } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { Bar, Btn, Card, Chip, ConfirmSheet, EmptyState, Segmented, Spinner, ToggleRow, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { ClassDetail, ClassRow } from '@/types/classroom';
import { TeacherChangeForm } from './ClassTeacherChange';

type Section = 'students' | 'teams' | 'rules' | 'battle' | 'rewards' | 'assignments' | 'progress' | 'notices';
const SECTIONS: Array<{ value: Section; label: string }> = [
  { value: 'students', label: 'Học sinh' }, { value: 'teams', label: 'Đội' }, { value: 'rules', label: 'Luật lớp' }, { value: 'battle', label: 'Trận đánh' }, { value: 'rewards', label: 'Thưởng/phạt' },
  { value: 'assignments', label: 'Bài tập' }, { value: 'progress', label: 'Tiến độ' }, { value: 'notices', label: 'Thông báo' },
];
const GRADES = [6, 7, 8, 9].map((g) => ({ value: String(g), label: `Khối ${g}` }));

const ClassView: React.FC<{ session: Session; id: number; onBack: () => void; onChanged: () => void }> = ({ session, id, onBack, onChanged }) => {
  const { c } = useTheme();
  const { token } = session;
  const detail = useLoad(() => api.classDetail(token, id), [token, id], session.expired);
  const { busy, run } = useAction(session.expired);
  const [section, setSection] = useState<Section>('students');
  const [meta, setMeta] = useState(false);
  const [code, setCode] = useState(false);
  const [archive, setArchive] = useState(false);
  const [remove, setRemove] = useState(false);
  const [teacherChange,setTeacherChange]=useState(false);
  const cls = detail.data;
  const apply = (next: ClassDetail) => { detail.setData(next); onChanged(); };
  const refresh = () => { detail.reload(); onChanged(); };
  return (
    <Page>
      <Btn icon={ArrowLeft} title="Danh sách lớp" tone="giay" size="sm" onPress={onBack} />
      <ErrorNote message={detail.error} />
      {teacherChange?<TeacherChangeForm session={session} classId={id} onClose={()=>setTeacherChange(false)}/>:null}
      {detail.loading && !cls ? <Spinner /> : null}
      {cls ? (
        <>
          <PageHeader title={`Lớp ${cls.name}`} subtitle={`Khối ${cls.grade ?? '?'} · ${cls.school_year} · ${cls.students} học sinh${cls.teachers.length ? ` · GV: ${cls.teachers.map((t) => t.full_name).join(', ')}` : ''}`}
            actions={<>
              <Btn title="Đề nghị đổi giáo viên" tone="giay" size="sm" testID="teacher-change-open" disabled={!cls.is_active||cls.year_status==='ended'} onPress={()=>setTeacherChange(true)}/>
              <Btn icon={Pencil} title="Sửa thông tin" tone="giay" size="sm" onPress={() => setMeta(true)} disabled={!cls.is_active} />
              {cls.own ? <Btn icon={cls.is_active ? Archive : RotateCcw} title={cls.is_active ? 'Lưu trữ' : 'Khôi phục'} tone="giay" size="sm" onPress={() => setArchive(true)} /> : null}
              {cls.own ? <Btn icon={Trash2} title="Xóa lớp" tone="giay" size="sm" onPress={() => setRemove(true)} /> : null}
            </>} />
          {cls.cover_url ? <Image source={{ uri: cls.cover_url }} accessibilityLabel={`Ảnh bìa lớp ${cls.name}`} resizeMode="cover" style={{ width: '100%', height: 120, borderRadius: 8, backgroundColor: c.dichNhat }} /> : null}
          {cls.description ? <Txt size={14} color={c.muc2}>{cls.description}</Txt> : null}
          {!cls.is_active ? <StatusChip kind="warn" text="Lớp đã lưu trữ: chỉ xem, không thêm hay giao bài" /> : null}
          <Card flat pad={14} style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <View style={{ flex: 1, minWidth: 200 }}>
                <Txt size={12} color={c.muc3}>Mã tham gia lớp (đọc cho học sinh nhập)</Txt>
                <Txt f="bold" size={28} selectable style={{ letterSpacing: 6 }} testID="class-code">{cls.join_code}</Txt>
              </View>
              <Btn icon={KeyRound} title="Tạo mã mới" tone="giay" size="sm" onPress={() => setCode(true)} disabled={!cls.is_active} />
            </View>
            <ToggleRow icon={UserPlus} label="Cho học sinh tự tham gia bằng mã" desc={cls.join_open ? 'Đang mở: học sinh nhập mã là vào lớp' : 'Đang đóng: học sinh không thể vào lớp bằng mã'} checked={cls.join_open}
              onChange={async (open) => { const next = await run(() => api.setJoinOpen(token, id, open), open ? 'Đã mở tham gia' : 'Đã đóng tham gia'); if (next) apply(next); }} />
          </Card>
          <Segmented label="Mục quản lý lớp" options={SECTIONS.map((s) => ({ ...s, label: s.value === 'students' && cls.pending_leaves ? `${s.label} (${cls.pending_leaves} xin rời)` : s.value === 'rewards' && cls.pending_skills ? `${s.label} (${cls.pending_skills} chờ duyệt)` : s.label }))} value={section} onChange={setSection} />
          {section === 'students' ? <ClassStudents session={session} cls={cls} onChanged={refresh} /> : null}
          {section === 'teams' ? <ClassTeams session={session} cls={cls} onChanged={refresh} /> : null}
          {section === 'rules' ? <ClassRules session={session} cls={cls} onChanged={refresh} /> : null}
          {section === 'battle' ? <ClassBattleLinks session={session} cls={cls} /> : null}
          {section === 'rewards' ? <ClassRewards session={session} cls={cls} onChanged={refresh} /> : null}
          {section === 'assignments' ? <ClassAssignments session={session} cls={cls} /> : null}
          {section === 'progress' ? <ClassProgress session={session} cls={cls} /> : null}
          {section === 'notices' ? <ClassNotices session={session} cls={cls} /> : null}
        </>
      ) : null}
      {meta && cls ? (
        <FormSheet title="Thông tin lớp" fields={[{ name: 'name', label: 'Tên lớp', required: true, readOnly: !cls.own, hint: cls.own ? undefined : 'Tên lớp do nhà trường đặt; giáo viên sửa mô tả và ảnh bìa' },
          { name: 'description', label: 'Mô tả', type: 'textarea' }, { name: 'cover_url', label: 'Ảnh bìa (liên kết https)', placeholder: 'https://…' }]}
          initial={{ name: cls.name, description: cls.description ?? '', cover_url: cls.cover_url ?? '' }} onClose={() => setMeta(false)}
          onSubmit={async (v) => { apply(await api.updateClass(token, id, { ...(cls.own ? { name: String(v.name).trim() } : {}), description: String(v.description).trim() || null, cover_url: String(v.cover_url).trim() || null })); setMeta(false); }} />
      ) : null}
      <ConfirmSheet open={code} title="Tạo mã tham gia mới?" message="Mã cũ sẽ không còn dùng được. Học sinh đã trong lớp không bị ảnh hưởng." confirmLabel="Tạo mã mới" busy={busy} onCancel={() => setCode(false)}
        onConfirm={async () => { const next = await run(() => api.regenerateCode(token, id), 'Đã tạo mã mới'); setCode(false); if (next) apply(next); }} />
      <ConfirmSheet open={archive} title={cls?.is_active ? 'Lưu trữ lớp?' : 'Khôi phục lớp?'} message={cls?.is_active ? 'Lớp lưu trữ chỉ để xem: không thêm học sinh, không giao bài, học sinh không vào lớp bằng mã.' : 'Lớp sẽ hoạt động trở lại.'} confirmLabel={cls?.is_active ? 'Lưu trữ' : 'Khôi phục'} tone="dong" busy={busy} onCancel={() => setArchive(false)}
        onConfirm={async () => { const next = await run(() => api.archiveClass(token, id, !cls?.is_active), cls?.is_active ? 'Đã lưu trữ lớp' : 'Đã khôi phục lớp'); setArchive(false); if (next) apply(next); }} />
      <ConfirmSheet open={remove} title="Xóa lớp?" message="Chỉ xóa được lớp do bạn tạo và chưa có dữ liệu học (hành trình, bài tập, thưởng/phạt). Nếu đã có dữ liệu, hãy lưu trữ lớp." confirmLabel="Xóa lớp" busy={busy} onCancel={() => setRemove(false)}
        onConfirm={async () => { const ok = await run(async () => { await api.deleteClass(token, id); return true; }, 'Đã xóa lớp'); setRemove(false); if (ok) { onChanged(); onBack(); } }} />
    </Page>
  );
};

const ClassCard: React.FC<{ row: ClassRow; onPress: () => void }> = ({ row, onPress }) => {
  const { c } = useTheme();
  return (
    <Card flat pad={0} style={{ flexGrow: 1, flexBasis: 300, minWidth: 260, overflow: 'hidden' }}>
      <View style={{ padding: 14, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Txt f="displayHeavy" size={22} style={{ flex: 1 }}>{row.name}</Txt>
          <Chip text={`Khối ${row.grade ?? '?'}`} bg={c.thuyNhat} fg={c.thuyChu} />
          {!row.is_active ? <Chip text="Đã lưu trữ" bg={c.vangNhat} fg={c.vangChu} /> : null}
        </View>
        <Txt size={13} color={c.muc2}>{row.school_year} · {row.students} học sinh · {row.teams} đội{row.own ? ' · lớp tôi tạo' : ''}</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Txt size={12} color={c.muc3}>Mã lớp</Txt>
          <Txt f="bold" size={20} style={{ letterSpacing: 4 }}>{row.join_code}</Txt>
          {!row.join_open ? <Chip text="Đóng tham gia" bg={c.sonNhat} fg={c.sonChu} /> : null}
        </View>
        {row.journeys.length ? (
          <View style={{ gap: 4 }}>
            {row.journeys.slice(0, 2).map((j) => <View key={j.id} style={{ gap: 2 }}><Txt size={13} numberOfLines={1}>{j.title}</Txt><Bar value={j.percent} max={100} label={`${j.title}: ${j.percent}%`} height={8} /></View>)}
            <Txt size={12} color={c.muc3}>Tiến độ trung bình {row.avg_progress ?? 0}%</Txt>
          </View>
        ) : <Txt size={13} color={c.muc3}>Chưa giao hành trình nào đang chạy</Txt>}
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {row.pending_leaves ? <StatusChip kind="warn" text={`${row.pending_leaves} xin rời lớp`} /> : null}
          {row.pending_skills ? <StatusChip kind="warn" text={`${row.pending_skills} chờ duyệt kỹ năng`} /> : null}
        </View>
        <Btn title="Quản lý lớp" tone="son" size="sm" onPress={onPress} testID={`class-open-${row.id}`} />
      </View>
    </Card>
  );
};

export const ClassManager: React.FC<{ session: Session }> = ({ session }) => {
  const list = useLoad(() => api.teacherClasses(session.token), [session.token], session.expired);
  const [open, setOpen] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  if (open !== null) return <ClassView session={session} id={open} onBack={() => setOpen(null)} onChanged={list.reload} />;
  return (
    <Page>
      <PageHeader title={`Xin chào, ${session.user.nickname || session.user.full_name}`} subtitle="Các lớp bạn phụ trách: thêm học sinh, chia đội, thưởng/phạt, giao bài tập và theo dõi tiến độ."
        actions={<Btn icon={Plus} title="Tạo lớp" tone="son" size="sm" onPress={() => setCreating(true)} testID="class-create" />} />
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner /> : null}
      {list.data && !list.data.length ? <EmptyState mood="thinking" title="Bạn chưa phụ trách lớp nào" text="Bấm “Tạo lớp” để tạo lớp trong năm học đang hoạt động, hoặc nhờ quản trị viên trường phân công lớp." /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        {(list.data ?? []).map((row) => <ClassCard key={row.id} row={row} onPress={() => setOpen(row.id)} />)}
      </View>
      {creating ? (
        <FormSheet title="Tạo lớp" subtitle="Lớp được tạo trong năm học đang hoạt động của trường, bạn là giáo viên phụ trách."
          fields={[{ name: 'name', label: 'Tên lớp', required: true, placeholder: '7A1' }, { name: 'grade', label: 'Khối', type: 'select', options: GRADES }, { name: 'description', label: 'Mô tả (tùy chọn)', type: 'textarea' }]}
          initial={{ grade: '7' }} onClose={() => setCreating(false)}
          onSubmit={async (v) => { const made = await api.createClass(session.token, { name: String(v.name).trim(), grade: Number(v.grade), description: String(v.description).trim() || null }); setCreating(false); list.reload(); setOpen(made.id); }} />
      ) : null}
    </Page>
  );
};
