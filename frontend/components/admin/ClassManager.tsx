/**
 * Lớp học của giáo viên: các lớp quản trị trường phân công (sĩ số, mã tham gia), sửa mô tả – ảnh bìa, mã tham gia và đóng/mở tham gia, đơn đổi giáo viên;
 * trong lớp chỉ còn danh sách học sinh (tìm, duyệt xin rời lớp). 16/11/2026: theo yêu cầu đã bỏ các mục Đội, Luật lớp, Trận đánh, Thưởng/phạt, Bài tập, Tiến độ,
 * Thông báo và việc giáo viên tự thêm / nhập học sinh (quản trị trường xếp lớp, học sinh vào bằng mã); chưa được phân công thì trang trống.
 */
import React, { useState } from 'react';
import { Image, View } from 'react-native';
import { Archive, ArrowLeft, KeyRound, Pencil, RotateCcw, Trash2, UserPlus } from 'lucide-react-native';
import * as api from '@/api/classroomApi';
import { ClassStudents } from '@/components/admin/ClassPeople';
import { ErrorNote, FormSheet, Page, PageHeader, StatusChip, useAction, useLoad } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { Btn, Card, Chip, ConfirmSheet, Spinner, ToggleRow, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { ClassDetail, ClassRow } from '@/types/classroom';
import { TeacherChangeForm } from './ClassTeacherChange';

const ClassView: React.FC<{ session: Session; id: number; onBack: () => void; onChanged: () => void }> = ({ session, id, onBack, onChanged }) => {
  const { c } = useTheme();
  const { token } = session;
  const detail = useLoad(() => api.classDetail(token, id), [token, id], session.expired);
  const { busy, run } = useAction(session.expired);
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
                <Txt f="bold" size={(cls.join_code?.length ?? 0) > 8 ? 18 : 28} selectable style={{ letterSpacing: (cls.join_code?.length ?? 0) > 8 ? 0.5 : 6 }} testID="class-code">{cls.join_code}</Txt>
              </View>
              <Btn icon={KeyRound} title="Tạo mã mới" tone="giay" size="sm" onPress={() => setCode(true)} disabled={!cls.is_active} />
            </View>
            <ToggleRow icon={UserPlus} label="Cho học sinh tự tham gia bằng mã" desc={cls.join_open ? 'Đang mở: học sinh nhập mã là vào lớp' : 'Đang đóng: học sinh không thể vào lớp bằng mã'} checked={cls.join_open}
              onChange={async (open) => { const next = await run(() => api.setJoinOpen(token, id, open), open ? 'Đã mở tham gia' : 'Đã đóng tham gia'); if (next) apply(next); }} />
          </Card>
          <Txt f="bold" size={16} accessibilityRole="header">Học sinh{cls.pending_leaves ? ` (${cls.pending_leaves} xin rời lớp)` : ''}</Txt>
          <ClassStudents session={session} cls={cls} onChanged={refresh} />
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
        <Txt size={13} color={c.muc2}>{row.school_year} · {row.students} học sinh</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Txt size={12} color={c.muc3}>Mã lớp</Txt>
          <Txt f="bold" size={(row.join_code?.length ?? 0) > 8 ? 14 : 20} style={{ letterSpacing: (row.join_code?.length ?? 0) > 8 ? 0 : 4 }}>{row.join_code}</Txt>
          {!row.join_open ? <Chip text="Đóng tham gia" bg={c.sonNhat} fg={c.sonChu} /> : null}
        </View>
        {row.pending_leaves ? <StatusChip kind="warn" text={`${row.pending_leaves} xin rời lớp`} /> : null}
        <Btn title="Xem lớp" tone="son" size="sm" onPress={onPress} testID={`class-open-${row.id}`} />
      </View>
    </Card>
  );
};

export const ClassManager: React.FC<{ session: Session }> = ({ session }) => {
  const list = useLoad(() => api.teacherClasses(session.token), [session.token], session.expired);
  const [open, setOpen] = useState<number | null>(null);
  if (open !== null) return <ClassView session={session} id={open} onBack={() => setOpen(null)} onChanged={list.reload} />;
  return (
    <Page>
      {/* 16/11/2026: lớp do quản trị trường tạo và phân công (một lớp một giáo viên); giáo viên không tự tạo lớp */}
      <PageHeader title={`Xin chào, ${session.user.nickname || session.user.full_name}`} subtitle={list.data && !list.data.length ? 'Chưa có lớp nào được phân công.' : 'Các lớp quản trị trường phân công cho bạn và mã tham gia để học sinh vào lớp.'} />
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        {(list.data ?? []).map((row) => <ClassCard key={row.id} row={row} onPress={() => setOpen(row.id)} />)}
      </View>
    </Page>
  );
};
