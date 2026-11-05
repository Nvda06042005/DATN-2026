/**
 * Học sinh và đội trong lớp của giáo viên (HK.GV.012–017): xem học sinh kèm nhân vật, tìm kiếm, thêm từ danh sách trường hoặc file Excel, xóa khỏi lớp,
 * duyệt yêu cầu rời lớp, chia đội ngẫu nhiên (4–6 người) hoặc thủ công.
 */
import React, { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { CheckSquare, FileUp, Shuffle, Square, Trash2, UserPlus, Users } from 'lucide-react-native';
import * as api from '@/api/classroomApi';
import { errorMessage } from '@/api/client';
import { AdminSelect } from '@/components/admin/AdminSelect';
import { Cell, DataTable, DownloadButton, ErrorNote, FilterBar, FilterBox, StatusChip, pickFile, useAction, useDebounced, useLoad } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { iconOf } from '@/components/portal/GameKit';
import { Btn, Card, Chip, ConfirmSheet, EmptyState, Field, Inset, Segmented, Sheet, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { ClassDetail, ClassStudent, TeamRow } from '@/types/classroom';

const dateText = (iso: string | null) => (iso ? new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }) : 'chưa học');

/** Danh sách chọn nhiều có nút chọn tất cả (dùng cho thêm học sinh, thưởng/phạt, huy hiệu, bài tập) */
export const Checklist: React.FC<{ items: Array<{ id: number; label: string; sub?: string | null }>; value: number[]; onChange: (ids: number[]) => void; empty?: string }> = ({ items, value, onChange, empty = 'Không có mục nào.' }) => {
  const { c } = useTheme();
  const all = items.length > 0 && items.every((i) => value.includes(i.id));
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Txt size={13} color={c.muc3}>Đã chọn {value.length}/{items.length}</Txt>
        {items.length ? <Btn title={all ? 'Bỏ chọn tất cả' : 'Chọn tất cả'} tone="giay" size="sm" onPress={() => onChange(all ? [] : items.map((i) => i.id))} /> : null}
      </View>
      <View style={{ borderWidth: 1, borderColor: c.adminLine, borderRadius: 5, backgroundColor: c.the }}>
        {items.length === 0 ? <Txt size={13} color={c.muc3} style={{ padding: 12 }}>{empty}</Txt> : null}
        {items.map((i) => {
          const on = value.includes(i.id);
          return (
            <Pressable key={i.id} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => onChange(on ? value.filter((x) => x !== i.id) : [...value, i.id])}
              style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: pressed ? c.adminCanvas : c.the })}>
              {on ? <CheckSquare size={18} color={c.son} /> : <Square size={18} color={c.muc3} />}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt size={14} numberOfLines={1}>{i.label}</Txt>
                {i.sub ? <Txt size={12} color={c.muc3} numberOfLines={1}>{i.sub}</Txt> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------- học sinh
const AddStudents: React.FC<{ session: Session; cls: ClassDetail; onClose: () => void; onDone: () => void }> = ({ session, cls, onClose, onDone }) => {
  const [q, setQ] = useState('');
  const term = useDebounced(q.trim(), 300);
  const pool = useLoad(() => api.studentPool(session.token, cls.id, term), [session.token, cls.id, term], session.expired);
  const [picked, setPicked] = useState<number[]>([]);
  const { busy, run } = useAction(session.expired);
  return (
    <Sheet open onClose={onClose} title="Thêm học sinh vào lớp" subtitle="Chọn trong danh sách học sinh của trường chưa thuộc lớp này" wide
      footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}><Btn title="Hủy" tone="giay" onPress={onClose} disabled={busy} />
        <Btn title={`Thêm ${picked.length} học sinh`} tone="son" disabled={!picked.length} loading={busy} testID="class-add-submit"
          onPress={async () => { const res = await run(() => api.addStudents(session.token, cls.id, picked), 'Đã thêm học sinh vào lớp'); if (res) { onDone(); onClose(); } }} /></View>}>
      <Field label="Tìm theo tên, mã học sinh hoặc biệt danh" value={q} onChangeText={setQ} />
      <ErrorNote message={pool.error} />
      {pool.loading && !pool.data ? <Spinner /> : null}
      <Checklist items={(pool.data ?? []).map((s) => ({ id: s.id, label: s.full_name, sub: [s.user_code, s.nickname, s.grade ? `khối ${s.grade}` : null].filter(Boolean).join(' · ') }))}
        value={picked} onChange={setPicked} empty="Không còn học sinh nào phù hợp (học sinh đã trong lớp không hiện ở đây)." />
    </Sheet>
  );
};

const ImportStudents: React.FC<{ session: Session; cls: ClassDetail; onClose: () => void; onDone: () => void }> = ({ session, cls, onClose, onDone }) => {
  const { c } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ added: number; skipped: number; errors: Array<{ row: number; code: string; message: string }> } | null>(null);
  const choose = async () => {
    setError(null);
    try {
      const file = await pickFile(['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
      if (!file) return;
      setBusy(true);
      setResult(await api.importStudents(session.token, cls.id, file));
      onDone();
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Sheet open onClose={onClose} title="Thêm học sinh bằng file Excel" subtitle="Mỗi dòng là mã học sinh của trường" wide footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}><Btn title="Đóng" tone="giay" onPress={onClose} /></View>}>
      <Txt size={14} color={c.muc2}>Tải file mẫu, điền mã học sinh (một mã mỗi dòng) rồi chọn file. Học sinh đã trong lớp hoặc mã không có trong trường sẽ được bỏ qua và báo lại từng dòng.</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <DownloadButton title="Tải file mẫu" fetchBlob={() => api.studentsTemplate(session.token)} filename="mau-them-hoc-sinh.xlsx" />
        <Btn icon={FileUp} title="Chọn file Excel" tone="son" size="sm" loading={busy} onPress={choose} testID="class-import-choose" />
      </View>
      <ErrorNote message={error} />
      {result ? (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}><StatusChip kind="on" text={`${result.added} đã thêm`} /><StatusChip kind="muted" text={`${result.skipped} đã có trong lớp`} />{result.errors.length ? <StatusChip kind="off" text={`${result.errors.length} dòng lỗi`} /> : null}</View>
          {result.errors.map((e) => <Inset key={`${e.row}-${e.code}`} style={{ backgroundColor: c.sonNhat }}><Txt size={13} color={c.sonChu}>Dòng {e.row} · {e.code}: {e.message}</Txt></Inset>)}
        </View>
      ) : null}
    </Sheet>
  );
};

export const ClassStudents: React.FC<{ session: Session; cls: ClassDetail; onChanged: () => void }> = ({ session, cls, onChanged }) => {
  const { c } = useTheme();
  const [q, setQ] = useState('');
  const term = useDebounced(q.trim(), 300);
  const [tick, setTick] = useState(0);
  const list = useLoad(() => api.classStudents(session.token, cls.id, term), [session.token, cls.id, term, tick], session.expired);
  const leaves = useLoad(() => api.leaveRequests(session.token, cls.id), [session.token, cls.id, tick], session.expired);
  const { busy, run } = useAction(session.expired);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [removing, setRemoving] = useState<ClassStudent | null>(null);
  const refresh = () => { setTick((t) => t + 1); onChanged(); };
  const pending = (leaves.data ?? []).filter((r) => r.status === 'pending');
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Btn icon={UserPlus} title="Thêm học sinh" tone="son" size="sm" onPress={() => setAdding(true)} testID="class-add-students" disabled={!cls.is_active} />
        <Btn icon={FileUp} title="Thêm bằng Excel" tone="giay" size="sm" onPress={() => setImporting(true)} disabled={!cls.is_active} />
      </View>
      {pending.length ? (
        <Card flat pad={12} style={{ gap: 8, borderColor: c.vang }}>
          <Txt f="bold" size={15}>Yêu cầu rời lớp ({pending.length})</Txt>
          {pending.map((r) => (
            <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <View style={{ flex: 1, minWidth: 180 }}><Txt f="semibold" size={14}>{r.full_name}{r.user_code ? ` · ${r.user_code}` : ''}</Txt><Txt size={13} color={c.muc2}>{r.reason || 'Không ghi lý do'} · {dateText(r.created_at)}</Txt></View>
              <Btn title="Đồng ý" tone="ngoc" size="sm" loading={busy} onPress={async () => { if (await run(() => api.decideLeave(session.token, r.id, true), 'Đã cho học sinh rời lớp')) refresh(); }} />
              <Btn title="Từ chối" tone="giay" size="sm" loading={busy} onPress={async () => { if (await run(() => api.decideLeave(session.token, r.id, false), 'Đã từ chối yêu cầu')) refresh(); }} />
            </View>
          ))}
        </Card>
      ) : null}
      <FilterBar><FilterBox flex={2}><Field label="Tìm học sinh (tên, mã, biệt danh)" value={q} onChangeText={setQ} /></FilterBox></FilterBar>
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner /> : null}
      {list.data ? (
        <DataTable<ClassStudent> rows={list.data} rowKey={(s) => s.id} empty={term ? 'Không tìm thấy học sinh nào' : 'Lớp chưa có học sinh. Bấm “Thêm học sinh” hoặc đọc mã lớp cho học sinh tự nhập.'}
          columns={[
            { key: 'name', label: 'Học sinh', flex: 2.2, render: (s) => <Cell main={s.full_name} sub={[s.user_code, s.nickname ? `biệt danh ${s.nickname}` : null].filter(Boolean).join(' · ')} /> },
            { key: 'char', label: 'Nhân vật', flex: 1.6, render: (s) => (s.character_name ? <Cell main={s.character_name} sub={`Cấp ${s.level}`} /> : <Txt size={13} color={c.muc3}>Chưa chọn nhân vật</Txt>) },
            { key: 'stat', label: 'Điểm · vàng · tim', flex: 1.6, render: (s) => <Txt size={13}>{s.xp} điểm · {s.gold} vàng · {s.hearts}/{s.hearts_max} tim</Txt> },
            { key: 'team', label: 'Đội', flex: 1, render: (s) => <Txt size={13}>{s.team_name ?? '—'}</Txt> },
            { key: 'last', label: 'Học gần nhất', flex: 1.2, hideOnCard: true, render: (s) => <Txt size={13} color={c.muc2}>{dateText(s.last_active)}</Txt> },
          ]}
          actions={(s) => <Btn icon={Trash2} label={`Xóa ${s.full_name} khỏi lớp`} tone="giay" size="sm" onPress={() => setRemoving(s)} />} />
      ) : null}
      {adding ? <AddStudents session={session} cls={cls} onClose={() => setAdding(false)} onDone={refresh} /> : null}
      {importing ? <ImportStudents session={session} cls={cls} onClose={() => setImporting(false)} onDone={refresh} /> : null}
      <ConfirmSheet open={!!removing} title="Xóa học sinh khỏi lớp?" message={`“${removing?.full_name ?? ''}” sẽ rời lớp này và rời đội. Dữ liệu học của học sinh vẫn được giữ nguyên.`} confirmLabel="Xóa khỏi lớp" busy={busy}
        onCancel={() => setRemoving(null)} onConfirm={async () => { if (removing) { const ok = await run(async () => { await api.removeStudent(session.token, cls.id, removing.id); return true; }, 'Đã xóa khỏi lớp'); setRemoving(null); if (ok) refresh(); } }} />
    </View>
  );
};

// ---------------------------------------------------------------------- đội (HK.GV.016)
interface Draft { name: string; icon: string; ids: number[] }

/** Biểu tượng đội: đúng danh sách máy chủ chấp nhận (TEAM_ICONS ở classroom.service.ts) */
export const TEAM_ICONS = ['shield', 'swords', 'flag', 'crown', 'star', 'flame', 'heart', 'award', 'gem', 'lightbulb', 'target', 'trophy'] as const;
const TEAM_ICON_LABEL: Record<string, string> = { shield: 'Khiên', swords: 'Kiếm', flag: 'Cờ', crown: 'Vương miện', star: 'Sao', flame: 'Lửa', heart: 'Trái tim', award: 'Huy chương', gem: 'Ngọc', lightbulb: 'Bóng đèn', target: 'Mục tiêu', trophy: 'Cúp' };
const defaultIcon = (i: number): string => TEAM_ICONS[i % TEAM_ICONS.length];

/** Kéo thả trên web (HK.GV.016): ô học sinh kéo được, khối đội và ô "chưa có đội" nhận học sinh thả vào. Cảm ứng và bàn phím dùng ô chọn đội cho từng học sinh bên dưới */
const DragStudent: React.FC<{ id: number; children: React.ReactNode }> = ({ id, children }) => {
  if (Platform.OS !== 'web') return <>{children}</>;
  return React.createElement('div', {
    draggable: true, 'data-testid': `team-drag-${id}`, style: { cursor: 'grab' },
    onDragStart: (e: React.DragEvent) => { e.dataTransfer.setData('text/plain', String(id)); e.dataTransfer.effectAllowed = 'move'; },
  }, children);
};
const DropTeam: React.FC<{ testID: string; onDrop: (id: number) => void; children: React.ReactNode }> = ({ testID, onDrop, children }) => {
  if (Platform.OS !== 'web') return <>{children}</>;
  return React.createElement('div', {
    'data-testid': testID, onDragOver: (e: React.DragEvent) => e.preventDefault(),
    onDrop: (e: React.DragEvent) => { e.preventDefault(); const id = Number(e.dataTransfer.getData('text/plain')); if (Number.isInteger(id) && id > 0) onDrop(id); },
  }, children);
};

const TeamEditor: React.FC<{ session: Session; cls: ClassDetail; students: ClassStudent[]; teams: TeamRow[]; onClose: () => void; onDone: () => void }> = ({ session, cls, students, teams, onClose, onDone }) => {
  const { c } = useTheme();
  const [drafts, setDrafts] = useState<Draft[]>(() => (teams.length
    ? teams.map((t, i) => ({ name: t.name, icon: (TEAM_ICONS as readonly string[]).includes(t.icon) ? t.icon : defaultIcon(i), ids: t.members.map((m) => m.id) }))
    : [{ name: 'Đội 1', icon: defaultIcon(0), ids: [] }, { name: 'Đội 2', icon: defaultIcon(1), ids: [] }]));
  const [error, setError] = useState<string | null>(null);
  const { busy, run } = useAction(session.expired);
  const teamOf = (id: number) => drafts.findIndex((d) => d.ids.includes(id));
  const assign = (id: number, index: number) => setDrafts((ds) => ds.map((d, i) => ({ ...d, ids: d.ids.filter((x) => x !== id).concat(i === index ? [id] : []) })));
  const options = [{ value: '-1', label: '— Chưa chia đội —' }, ...drafts.map((d, i) => ({ value: String(i), label: d.name || `Đội ${i + 1}` }))];
  const save = async () => {
    setError(null);
    const res = await run(() => api.setTeams(session.token, cls.id, drafts.filter((d) => d.ids.length).map((d) => ({ name: d.name, icon: d.icon, member_ids: d.ids }))), 'Đã lưu các đội');
    if (res) { onDone(); onClose(); } else setError('Chưa lưu được; kiểm tra tên đội (2–40 ký tự, không trùng).');
  };
  return (
    <Sheet open onClose={onClose} title="Chia đội thủ công" subtitle="Đặt tên và chọn biểu tượng cho đội, rồi kéo học sinh vào đội (hoặc chọn đội ở danh sách); đội trống sẽ bị bỏ" wide
      footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}><Btn title="Hủy" tone="giay" onPress={onClose} disabled={busy} /><Btn title="Lưu các đội" tone="son" loading={busy} onPress={save} testID="team-save" /></View>}>
      <ErrorNote message={error} />
      <View style={{ gap: 8 }}>
        {drafts.map((d, i) => (
          <DropTeam key={i} testID={`team-drop-${i}`} onDrop={(id) => assign(id, i)}>
            <View style={{ gap: 8, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: c.adminLine, backgroundColor: c.the }}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
                <Field label={`Tên đội ${i + 1} (${d.ids.length} học sinh)`} value={d.name} onChangeText={(v) => setDrafts((ds) => ds.map((x, j) => (j === i ? { ...x, name: v } : x)))} style={{ flex: 1 }} />
                <Btn icon={Trash2} label={`Xóa đội ${i + 1}`} tone="giay" size="sm" onPress={() => setDrafts((ds) => ds.filter((_, j) => j !== i))} />
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }} accessibilityLabel={`Biểu tượng của đội ${i + 1}`}>
                {TEAM_ICONS.map((name) => {
                  const on = d.icon === name, Icon = iconOf(name);
                  return (
                    <Pressable key={name} testID={`team-icon-${i}-${name}`} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`Biểu tượng ${TEAM_ICON_LABEL[name]}${on ? ', đang chọn' : ''}`}
                      onPress={() => setDrafts((ds) => ds.map((x, j) => (j === i ? { ...x, icon: name } : x)))}
                      style={{ width: 36, height: 36, borderRadius: 8, borderWidth: on ? 2 : 1, borderColor: on ? c.ngoc : c.adminLine, backgroundColor: on ? c.ngocNhat : c.the, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={18} color={on ? c.ngocChu : c.muc2} />
                    </Pressable>
                  );
                })}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, minHeight: 32 }}>
                {d.ids.map((id) => { const s = students.find((x) => x.id === id); return s ? <DragStudent key={id} id={id}><Chip text={s.full_name} bg={c.thuyNhat} fg={c.thuyChu} /></DragStudent> : null; })}
                {!d.ids.length ? <Txt size={13} color={c.muc3}>{Platform.OS === 'web' ? 'Kéo học sinh vào đây hoặc chọn đội ở danh sách bên dưới.' : 'Chọn đội cho học sinh ở danh sách bên dưới.'}</Txt> : null}
              </View>
              {d.ids.length > 6 ? <Txt size={12} color={c.vangChu}>Nên 4–6 học sinh mỗi đội (tối đa 8).</Txt> : null}
            </View>
          </DropTeam>
        ))}
        {drafts.length < 12 ? <Btn icon={Users} title="Thêm đội" tone="giay" size="sm" onPress={() => setDrafts((ds) => [...ds, { name: `Đội ${ds.length + 1}`, icon: defaultIcon(ds.length), ids: [] }])} /> : null}
      </View>
      <DropTeam testID="team-drop-free" onDrop={(id) => assign(id, -1)}>
        <View style={{ gap: 6, padding: 10, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: c.adminLine }}>
          <Txt f="bold" size={14} color={c.muc2}>Chưa có đội ({students.filter((s) => teamOf(s.id) < 0).length})</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {students.filter((s) => teamOf(s.id) < 0).map((s) => <DragStudent key={s.id} id={s.id}><Chip text={s.full_name} bg={c.the2} fg={c.muc2} /></DragStudent>)}
          </View>
        </View>
      </DropTeam>
      <Txt f="bold" size={14} color={c.muc2}>Chọn đội cho từng học sinh</Txt>
      {students.map((s) => (
        <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Txt size={14} style={{ flex: 1, minWidth: 140 }} numberOfLines={1}>{s.full_name}</Txt>
          <View style={{ width: 200 }}><AdminSelect label="" value={String(teamOf(s.id))} options={options} onChange={(v) => assign(s.id, Number(v))} /></View>
        </View>
      ))}
    </Sheet>
  );
};

export const ClassTeams: React.FC<{ session: Session; cls: ClassDetail; onChanged: () => void }> = ({ session, cls, onChanged }) => {
  const { c } = useTheme();
  const [tick, setTick] = useState(0);
  const teams = useLoad(() => api.classTeams(session.token, cls.id), [session.token, cls.id, tick], session.expired);
  const students = useLoad(() => api.classStudents(session.token, cls.id), [session.token, cls.id, tick], session.expired);
  const { busy, run } = useAction(session.expired);
  const [auto, setAuto] = useState(false);
  const [size, setSize] = useState(5);
  const [manual, setManual] = useState(false);
  const refresh = () => { setTick((t) => t + 1); onChanged(); };
  const free = (students.data ?? []).filter((s) => !s.team_id);
  return (
    <View style={{ gap: 14 }}>
      <Txt size={14} color={c.muc2}>Mỗi đội 4–6 học sinh. Đội dùng cho bảng xếp hạng đội, nhiệm vụ đội, bài tập theo đội và thưởng/phạt cả đội.</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Btn icon={Shuffle} title="Chia ngẫu nhiên" tone="son" size="sm" onPress={() => setAuto(true)} disabled={!cls.is_active || (students.data ?? []).length < 2} testID="team-auto" />
        <Btn icon={Users} title="Chia thủ công" tone="giay" size="sm" onPress={() => setManual(true)} disabled={!cls.is_active || !(students.data ?? []).length} testID="team-manual" />
      </View>
      <ErrorNote message={teams.error ?? students.error} />
      {teams.loading && !teams.data ? <Spinner /> : null}
      {teams.data && !teams.data.length ? <EmptyState mood="thinking" title="Lớp chưa chia đội" text="Chia đội để học sinh cùng thi đua và làm nhiệm vụ nhóm." /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {(teams.data ?? []).map((t) => (
          <Card key={t.id} flat pad={14} style={{ gap: 8, flexGrow: 1, flexBasis: 240, minWidth: 220 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>{React.createElement(iconOf(t.icon), { size: 20, color: c.ngocChu })}<Txt f="displayHeavy" size={18}>{t.name}</Txt></View>
              <Chip text={`${t.members.length} học sinh`} bg={c.thuyNhat} fg={c.thuyChu} />
            </View>
            {t.members.map((m) => <Txt key={m.id} size={14}>• {m.nickname || m.full_name}</Txt>)}
          </Card>
        ))}
      </View>
      {free.length && (teams.data ?? []).length ? <Inset style={{ backgroundColor: c.vangNhat }}><Txt size={13} color={c.vangChu}>{free.length} học sinh chưa có đội: {free.map((s) => s.full_name).join(', ')}</Txt></Inset> : null}
      <Sheet open={auto} onClose={() => setAuto(false)} title="Chia đội ngẫu nhiên" subtitle="Thay toàn bộ các đội hiện có"
        footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}><Btn title="Hủy" tone="giay" onPress={() => setAuto(false)} disabled={busy} />
          <Btn title="Chia đội" tone="son" loading={busy} testID="team-auto-go" onPress={async () => { if (await run(() => api.autoTeams(session.token, cls.id, size), 'Đã chia đội')) { setAuto(false); refresh(); } }} /></View>}>
        <Txt size={14}>Mỗi đội khoảng bao nhiêu học sinh?</Txt>
        <Segmented label="Số học sinh mỗi đội" options={[4, 5, 6].map((n) => ({ value: n, label: `${n} học sinh` }))} value={size} onChange={setSize} />
        <Txt size={13} color={c.muc3}>Lớp có {(students.data ?? []).length} học sinh; số đội được làm tròn để các đội đều nhau.</Txt>
      </Sheet>
      {manual && students.data ? <TeamEditor session={session} cls={cls} students={students.data} teams={teams.data ?? []} onClose={() => setManual(false)} onDone={refresh} /> : null}
    </View>
  );
};
