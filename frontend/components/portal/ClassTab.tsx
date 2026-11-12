/**
 * Lớp học của học sinh (Sprint 7, HK.HS.071, 072, 076, 099–105): lớp đã tham gia (giáo viên, bạn cùng lớp kèm nhân vật và đội, đội của em và nhiệm vụ đội, hộp quà lớp,
 * thông báo của lớp, xin rời lớp), danh sách bài tập và vào làm bài, điểm – nhận xét của giáo viên, kỹ năng nhân vật (điểm hành động, hồi tim, hiệu ứng), xếp hạng đội
 * và chuông thông báo. Máy chủ quyết định mọi điểm, hạn nộp và lượt làm; giao diện chỉ hiển thị và gửi yêu cầu.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { BookOpen, Heart, LogIn, LogOut, Play, RotateCcw, Shield, Swords, Users, Zap } from 'lucide-react-native';
import * as authApi from '@/api/authApi';
import * as api from '@/api/classroomApi';
import { errorMessage } from '@/api/client';
import { ErrorNote, useAction, useLoad } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { Bar, Btn, Card, Chip, EmptyState, Field, InfoNote, Segmented, Sheet, Spinner, Txt, useToast } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { Hud } from '@/types/gamification';
import type { MyAssignment, MyAssignState, MyClassRow, TeamBoard } from '@/types/classroom';
import { teamLabel } from '@/types/classroom';

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }) : '—');

// Chuông thông báo (HK.HS.104) nay nằm ở NoticeCenter (Sprint 11) và dùng chung cho mọi vai trò
export { NoticeBell } from '@/components/portal/NoticeCenter';

// ---------------------------------------------------------------------- bảng xếp hạng đội (HK.HS.076)
export const TeamRanking: React.FC<{ session: Session; refreshKey: number }> = ({ session, refreshKey }) => {
  const { c } = useTheme();
  const classes = useLoad(() => api.myClasses(session.token), [session.token, refreshKey], session.expired);
  const [classId, setClassId] = useState<number | null>(null);
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('week');
  const id = classId ?? classes.data?.[0]?.id ?? null;
  const board = useLoad(() => (id ? api.teamBoard(session.token, id, period) : Promise.resolve(null as TeamBoard | null)), [session.token, id, period, refreshKey], session.expired);
  if (classes.data && !classes.data.length) return <EmptyState mood="thinking" title="Em chưa thuộc lớp nào" text="Tham gia lớp bằng mã ở mục Lớp học để xem bảng xếp hạng đội." />;
  const b = board.data;
  return (
    <View style={{ gap: 10 }}>
      {(classes.data?.length ?? 0) > 1 ? <Segmented label="Lớp" options={(classes.data ?? []).map((k) => ({ value: k.id, label: k.name }))} value={id ?? 0} onChange={setClassId} /> : null}
      <Segmented label="Khoảng thời gian" value={period} onChange={setPeriod} options={[{ value: 'week', label: 'Tuần này' }, { value: 'month', label: 'Tháng này' }, { value: 'all', label: 'Từ đầu' }]} />
      <ErrorNote message={board.error} />
      {board.loading && !b ? <Spinner /> : null}
      {b?.disabled ? <InfoNote>{b.message ?? 'Giáo viên đã tắt bảng xếp hạng của lớp này.'}</InfoNote> : null}
      {b && !b.disabled && !b.teams.length ? <EmptyState mood="thinking" title="Lớp chưa chia đội" text="Khi giáo viên chia đội, bảng xếp hạng đội sẽ hiện ở đây." /> : null}
      {b && !b.disabled ? b.teams.map((t) => (
        <View key={t.id} accessibilityLabel={`Hạng ${t.rank}, ${t.name}, ${t.xp} điểm${t.mine ? ', đội của em' : ''}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 12, borderRadius: 14, borderWidth: 2, borderColor: t.mine ? c.ngoc : c.vien, backgroundColor: t.mine ? c.ngocNhat : c.the }}>
          <Txt f="displayHeavy" size={20} style={{ width: 34 }}>{t.rank}</Txt>
          <View style={{ flex: 1 }}><Txt f="bold" size={15}>{t.name}{t.mine ? ' (đội của em)' : ''}</Txt><Txt size={12} color={c.muc3}>{t.members} thành viên</Txt></View>
          <Txt f="bold" size={16} color={c.dongChu}>{t.xp} điểm</Txt>
        </View>
      )) : null}
    </View>
  );
};

// ---------------------------------------------------------------------- lớp của em
const JoinClass: React.FC<{ session: Session; onJoined: () => void }> = ({ session, onJoined }) => {
  const toast = useToast();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const join = async () => {
    const clean = code.trim();
    if (clean.replace(/[^A-Za-z0-9]/g, '').length < 6) return setError('Hãy nhập mã tham gia lớp giáo viên đưa (6 ký tự hoặc dạng DongA…).');
    setBusy(true);
    setError(null);
    try { const cls = await authApi.joinClass(session.token, clean); toast(`Đã vào lớp ${cls.name}`); setCode(''); onJoined(); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Card flat pad={14} style={{ gap: 8 }}>
      <Txt f="bold" size={16}>Tham gia lớp bằng mã</Txt>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
        <Field label="Mã tham gia lớp" value={code} onChangeText={setCode} autoCapitalize="none" maxLength={80} placeholder="Ví dụ DongA6A5DucAnhHK12025-2026" error={error} style={{ flex: 1 }} editable={Boolean(session.user.school_id)} />
        <Btn icon={LogIn} title="Vào lớp" tone="ngoc" loading={busy} disabled={!session.user.school_id} onPress={join} testID="class-join" />
      </View>
    </Card>
  );
};

const LeaveSheet: React.FC<{ session: Session; classId: number; name: string; onClose: () => void; onDone: () => void }> = ({ session, classId, name, onClose, onDone }) => {
  const { busy, run } = useAction(session.expired);
  const [reason, setReason] = useState('');
  return (
    <Sheet open onClose={onClose} title={`Xin rời lớp ${name}`} subtitle="Giáo viên sẽ xem và trả lời; dữ liệu học của em vẫn được giữ nguyên"
      footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}><Btn title="Hủy" tone="giay" onPress={onClose} disabled={busy} />
        <Btn title="Gửi yêu cầu" tone="son" loading={busy} testID="leave-send" onPress={async () => { if (await run(() => api.requestLeave(session.token, classId, reason.trim() || undefined), 'Đã gửi yêu cầu cho giáo viên')) { onDone(); onClose(); } }} /></View>}>
      <Field label="Lý do (không bắt buộc)" value={reason} onChangeText={setReason} multiline numberOfLines={3} maxLength={300} inputStyle={{ minHeight: 80, textAlignVertical: 'top' }} />
    </Sheet>
  );
};

const ClassSheet: React.FC<{ session: Session; id: number; onClose: () => void; onChanged: () => void }> = ({ session, id, onClose, onChanged }) => {
  const { c } = useTheme();
  const detail = useLoad(() => api.myClassDetail(session.token, id), [session.token, id], session.expired);
  const [leave, setLeave] = useState(false);
  const d = detail.data;
  const team = d?.team;
  return (
    <Sheet open onClose={onClose} title={d ? `Lớp ${d.name}` : 'Lớp học'} subtitle={d ? `Khối ${d.grade ?? '?'} · ${d.school_year}` : undefined} wide footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}><Btn title="Đóng" tone="ngoc" onPress={onClose} /></View>}>
      <ErrorNote message={detail.error} />
      {detail.loading && !d ? <Spinner /> : null}
      {d ? (
        <View style={{ gap: 14 }}>
          {d.description ? <Txt size={14} color={c.muc2}>{d.description}</Txt> : null}
          <Txt size={14}>Giáo viên: {d.teachers.map((t) => t.full_name).join(', ') || '—'}</Txt>
          {d.journeys.length ? (
            <View style={{ gap: 6 }}>
              <Txt f="bold" size={15}>Hành trình đang học của lớp</Txt>
              {d.journeys.map((j) => <View key={j.journey_id} style={{ gap: 2 }}><Txt size={14}>{j.title} · {j.campaign_title}{j.state === 'upcoming' ? ` (bắt đầu ${when(j.starts_at)})` : ''}</Txt><Bar value={j.percent} max={100} height={8} label={`${j.title}: lớp hoàn thành ${j.percent}%`} /></View>)}
            </View>
          ) : null}
          {team ? (
            <Card flat pad={14} style={{ gap: 8, borderColor: c.ngoc }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Shield size={20} color={c.ngocChu} />
                <Txt f="displayHeavy" size={20} style={{ flex: 1 }}>{teamLabel(team.name)}</Txt>
                {team.rank ? <Chip text={`Hạng ${team.rank}/${team.teams} tuần này`} bg={c.vangNhat} fg={c.vangChu} /> : null}
              </View>
              <Txt size={13} color={c.muc2}>{team.xp_week} điểm của cả đội trong tuần</Txt>
              {team.quests.map((q) => (
                <View key={q.id} style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Txt size={14} style={{ flex: 1 }}>{q.title}</Txt><Chip text={q.done ? 'Hoàn thành' : `${q.progress}/${q.target}`} bg={q.done ? c.ngocNhat : c.dichNhat} fg={q.done ? c.ngocChu : c.dich} /></View>
                  <Bar value={q.progress} max={Math.max(1, q.target)} height={8} label={`${q.title}: ${q.progress} trên ${q.target}`} />
                </View>
              ))}
              {team.members.map((m) => <Txt key={m.id} size={14}>• {m.name} · cấp {m.level} · {m.xp} điểm tuần{m.goal_today ? ' · đã đạt mục tiêu ngày' : ''}</Txt>)}
            </Card>
          ) : <InfoNote>Em chưa thuộc đội nào trong lớp này. Giáo viên sẽ chia đội.</InfoNote>}
          {d.goals.length ? (
            <View style={{ gap: 6 }}>
              <Txt f="bold" size={15}>Hộp quà của lớp</Txt>
              {d.goals.map((g) => (
                <View key={g.id} style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Txt size={14} style={{ flex: 1 }}>{g.title}</Txt><Chip text={g.opened ? 'Đã mở' : g.reached ? 'Sẵn sàng mở' : `${g.progress}/${g.target_xp}`} bg={g.opened || g.reached ? c.ngocNhat : c.dichNhat} fg={g.opened || g.reached ? c.ngocChu : c.dich} /></View>
                  <Bar value={Math.min(g.progress, g.target_xp)} max={g.target_xp} height={8} label={`${g.title}: ${g.progress} trên ${g.target_xp} điểm`} />
                </View>
              ))}
            </View>
          ) : null}
          {d.announcements.length ? (
            <View style={{ gap: 6 }}>
              <Txt f="bold" size={15}>Thông báo của lớp</Txt>
              {d.announcements.map((a) => <Card key={a.id} flat pad={12} style={{ gap: 2 }}><Txt f="semibold" size={14}>{a.title}</Txt><Txt size={14} color={c.muc2}>{a.body}</Txt><Txt size={12} color={c.muc3}>{when(a.created_at)}</Txt></Card>)}
            </View>
          ) : null}
          <Txt f="bold" size={15}>Bạn cùng lớp ({d.members.length})</Txt>
          <View style={{ gap: 6 }}>
            {d.members.map((m) => (
              <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Txt size={14} f={m.me ? 'bold' : 'body'} style={{ flex: 1, minWidth: 140 }}>{m.name}{m.me ? ' (em)' : ''}</Txt>
                <Txt size={12} color={c.muc3}>{m.character_name ? `${m.character_name} · ` : ''}cấp {m.level}{m.team_name ? ` · ${teamLabel(m.team_name)}` : ''}</Txt>
              </View>
            ))}
          </View>
          {d.leave_pending
            ? <Chip text="Em đã xin rời lớp, đang chờ giáo viên" bg={c.vangNhat} fg={c.vangChu} />
            : <Btn icon={LogOut} title="Xin rời lớp" tone="giay" size="sm" onPress={() => setLeave(true)} testID="class-leave" />}
        </View>
      ) : null}
      {leave && d ? <LeaveSheet session={session} classId={id} name={d.name} onClose={() => setLeave(false)} onDone={() => { detail.reload(); onChanged(); }} /> : null}
    </Sheet>
  );
};

const ClassesSection: React.FC<{ session: Session; refreshKey: number; onChanged: () => void }> = ({ session, refreshKey, onChanged }) => {
  const { c } = useTheme();
  const list = useLoad(() => api.myClasses(session.token), [session.token, refreshKey], session.expired);
  const [open, setOpen] = useState<number | null>(null);
  return (
    <View style={{ gap: 12 }}>
      <JoinClass session={session} onJoined={() => { list.reload(); onChanged(); }} />
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner /> : null}
      {list.data && !list.data.length ? <EmptyState mood="thinking" title="Em chưa tham gia lớp nào" text="Nhập mã lớp 6 ký tự do giáo viên cung cấp để vào lớp. Một học sinh có thể thuộc nhiều lớp." /> : null}
      {(list.data ?? []).map((k: MyClassRow) => (
        <Pressable key={k.id} accessibilityRole="button" accessibilityLabel={`Lớp ${k.name}, ${k.members} học sinh`} onPress={() => setOpen(k.id)} testID={`my-class-${k.id}`}
          style={({ pressed }) => ({ gap: 6, padding: 14, borderRadius: 18, borderWidth: 2, borderColor: c.vien, backgroundColor: pressed ? c.the2 : c.the })}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Txt f="displayHeavy" size={22} style={{ flex: 1 }}>{k.name}</Txt>
            <Chip text={`Khối ${k.grade ?? '?'}`} bg={c.thuyNhat} fg={c.thuyChu} />
            {!k.is_active ? <Chip text="Đã lưu trữ" bg={c.vangNhat} fg={c.vangChu} /> : null}
          </View>
          <Txt size={13} color={c.muc2}>{k.school_year} · {k.members} học sinh{k.teachers.length ? ` · GV ${k.teachers.map((t) => t.full_name).join(', ')}` : ''}</Txt>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {k.team_name ? <Chip text={teamLabel(k.team_name)} bg={c.ngocNhat} fg={c.ngocChu} icon={Users} /> : null}
            {k.leave_pending ? <Chip text="Đã xin rời lớp" bg={c.vangNhat} fg={c.vangChu} /> : null}
            {k.journeys.map((j) => <Chip key={j.id} text={j.title} bg={c.dongNhat} fg={c.dongChu} />)}
          </View>
        </Pressable>
      ))}
      {open !== null ? <ClassSheet session={session} id={open} onClose={() => setOpen(null)} onChanged={() => { list.reload(); onChanged(); }} /> : null}
    </View>
  );
};

// ---------------------------------------------------------------------- bài tập (HK.HS.100–102)
const dueText = (a: MyAssignment): string => {
  const ms = new Date(a.due_at).getTime() - Date.now();
  if (ms <= 0) return `Đã hết hạn lúc ${when(a.due_at)}`;
  const hours = Math.floor(ms / 3_600_000);
  return `Hạn ${when(a.due_at)} · còn ${hours >= 48 ? `${Math.floor(hours / 24)} ngày` : hours >= 1 ? `${hours} giờ` : 'dưới 1 giờ'}`;
};

const AssignmentCard: React.FC<{ a: MyAssignment; onStart: (a: MyAssignment) => void }> = ({ a, onStart }) => {
  const { c } = useTheme();
  const tone: Record<MyAssignState, [string, string, string]> = {
    todo: ['Chưa làm', c.dichNhat, c.dich], doing: ['Đang làm', c.thuyNhat, c.thuyChu], submitted: ['Đã nộp', c.ngocNhat, c.ngocChu], late: ['Nộp muộn', c.vangNhat, c.vangChu], overdue: ['Quá hạn', c.sonNhat, c.sonChu], graded: ['Đã chấm', c.ngocNhat, c.ngocChu],
  };
  const [text, bg, fg] = tone[a.state];
  const overdue = new Date(a.due_at).getTime() < Date.now();
  const can = !overdue && (a.attempts_left > 0 || a.state === 'doing');
  const verb = a.kind === 'lesson' ? (a.attempts ? 'Đọc lại bài' : 'Đọc bài') : a.state === 'doing' ? 'Làm tiếp' : a.attempts ? 'Làm lại để tăng điểm' : 'Bắt đầu làm';
  return (
    <Card flat pad={14} style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Chip text={text} bg={bg} fg={fg} />
        <Chip text={a.kind_label} bg={c.dichNhat} fg={c.dich} />
        <Txt size={12} color={c.muc3}>Lớp {a.class_name}</Txt>
      </View>
      <Txt f="bold" size={17}>{a.title}</Txt>
      {a.description ? <Txt size={14} color={c.muc2}>{a.description}</Txt> : null}
      <Txt size={13} color={overdue && a.state !== 'graded' && !a.submitted_at ? c.sonChu : c.muc2}>{a.content_title} · {dueText(a)}</Txt>
      <Txt size={13} color={c.muc2}>Còn {a.attempts_left}/{a.max_attempts} lượt{a.best_percent !== null ? ` · điểm cao nhất ${a.best_percent}%` : ''}{a.bonus_points && !a.submitted_at ? ` · thưởng ${a.bonus_points} điểm nếu nộp đúng hạn` : ''}</Txt>
      {a.teacher_score !== null ? (
        <View style={{ gap: 2, padding: 10, borderRadius: 12, backgroundColor: c.ngocNhat }}>
          <Txt f="bold" size={15} color={c.ngocChu}>Giáo viên chấm: {a.teacher_score}/100 · {a.grade}</Txt>
          {a.feedback ? <Txt size={14} color={c.ngocChu}>Nhận xét: {a.feedback}</Txt> : null}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Btn icon={a.kind === 'lesson' ? BookOpen : a.attempts ? RotateCcw : Play} title={verb} tone="ngoc" size="sm" disabled={!can} onPress={() => onStart(a)} testID={`assignment-start-${a.id}`} />
      </View>
    </Card>
  );
};

const AssignmentsSection: React.FC<{ session: Session; refreshKey: number; onStart: (a: MyAssignment) => void }> = ({ session, refreshKey, onStart }) => {
  const { c } = useTheme();
  const list = useLoad(() => api.myAssignments(session.token), [session.token, refreshKey], session.expired);
  const rows = list.data ?? [];
  const groups: Array<{ title: string; items: MyAssignment[] }> = [
    { title: 'Cần làm', items: rows.filter((a) => a.state === 'todo' || a.state === 'doing') },
    { title: 'Quá hạn chưa nộp', items: rows.filter((a) => a.state === 'overdue') },
    { title: 'Đã nộp', items: rows.filter((a) => ['submitted', 'late', 'graded'].includes(a.state)) },
  ];
  return (
    <View style={{ gap: 12 }}>
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner /> : null}
      {list.data && !rows.length ? <EmptyState mood="thinking" title="Chưa có bài tập nào" text="Khi giáo viên giao bộ đề, mini-game hay bài học, bài tập sẽ hiện ở đây." /> : null}
      {groups.filter((g) => g.items.length).map((g) => (
        <View key={g.title} style={{ gap: 8 }}>
          <Txt f="bold" size={16} color={c.muc}>{g.title} ({g.items.length})</Txt>
          {g.items.map((a) => <AssignmentCard key={a.id} a={a} onStart={onStart} />)}
        </View>
      ))}
    </View>
  );
};

// ---------------------------------------------------------------------- kỹ năng nhân vật (HK.HS.072)
const SKILL_ICON: Record<string, typeof Zap> = { xung_phong: Swords, ho_giap: Shield, thuoc_quy: Heart, hoi_sinh: Heart, muu_ke: Zap, tran_do: BookOpen };
const BUFF_TEXT: Record<string, string> = { xung_phong: 'Xung phong: thưởng tốc độ câu đúng kế tiếp nhân đôi', ho_giap: 'Hộ giáp: bỏ qua một lần mất tim' };

const SkillsSection: React.FC<{ session: Session; hud: Hud | null; refreshKey: number; onChanged: () => void }> = ({ session, hud, refreshKey, onChanged }) => {
  const { c } = useTheme();
  const toast = useToast();
  const view = useLoad(() => api.mySkills(session.token), [session.token, refreshKey], session.expired);
  const { busy, run } = useAction(session.expired);
  const [picking, setPicking] = useState(false);
  const v = view.data;
  const cast = async (skill: string, targetId?: number) => {
    const res = await run(() => api.castSkill(session.token, { skill, target_id: targetId }));
    if (res) { toast(res.message); view.reload(); onChanged(); }
  };
  return (
    <View style={{ gap: 12 }}>
      <ErrorNote message={view.error} />
      {view.loading && !v ? <Spinner /> : null}
      {v ? (
        <>
          <Card flat pad={14} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Zap size={20} color={c.thuyChu} /><Txt f="bold" size={16}>Điểm hành động hôm nay: {v.ap.current}/{v.ap.max}</Txt></View>
            <Bar value={v.ap.current} max={Math.max(1, v.ap.max)} height={10} fill={c.thuy} label={`Điểm hành động ${v.ap.current} trên ${v.ap.max}`} />
            <Txt size={13} color={c.muc2}>Điểm hành động hồi đầy mỗi ngày và tăng khi em lên cấp. Kỹ năng chỉ dùng được khi em thuộc một lớp học.</Txt>
            {Object.keys(v.buffs).map((b) => <Chip key={b} text={BUFF_TEXT[b] ?? b} bg={c.vangNhat} fg={c.vangChu} />)}
          </Card>
          {!v.in_class ? <InfoNote>Em chưa thuộc lớp nào nên chưa dùng được kỹ năng. Vào mục “Lớp của em” để tham gia lớp bằng mã.</InfoNote> : null}
          {hud && !hud.has_character ? <InfoNote>Hãy chọn lớp nhân vật để có kỹ năng.</InfoNote> : null}
          {v.skills.map((k) => {
            const Icon = SKILL_ICON[k.code] ?? Zap;
            const enough = v.ap.current >= k.cost;
            return (
              <Card key={k.code} flat pad={14} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Icon size={20} color={c.dongChu} /><Txt f="bold" size={16} style={{ flex: 1 }}>{k.name}</Txt>
                  <Chip text={`${k.cost} điểm hành động`} bg={enough ? c.thuyNhat : c.dichNhat} fg={enough ? c.thuyChu : c.dich} />
                </View>
                <Txt size={14} color={c.muc2}>{k.description}{k.needs_approval ? ' (cần giáo viên duyệt)' : ''}</Txt>
                {k.in_quiz
                  ? <Txt size={13} color={c.muc3}>Dùng ngay trong lúc làm câu hỏi (nút kỹ năng hiện dưới câu hỏi).</Txt>
                  : <Btn title={k.targets_friend ? 'Chọn bạn để hồi tim' : 'Dùng kỹ năng'} tone="ngoc" size="sm" loading={busy} disabled={!v.in_class || !enough} onPress={() => (k.targets_friend ? setPicking(true) : cast(k.code))} testID={`skill-${k.code}`} />}
              </Card>
            );
          })}
          {v.recent.length ? (
            <View style={{ gap: 4 }}>
              <Txt f="bold" size={15}>Lần dùng gần đây</Txt>
              {v.recent.map((r) => <Txt key={r.id} size={13} color={c.muc2}>{when(r.created_at)} · {v.skills.find((k) => k.code === r.skill)?.name ?? r.skill}{r.target_name ? ` cho ${r.target_name}` : ''} · {r.status === 'pending' ? 'chờ giáo viên duyệt' : r.status === 'rejected' ? 'giáo viên từ chối' : 'đã dùng'}</Txt>)}
            </View>
          ) : null}
          <Sheet open={picking} onClose={() => setPicking(false)} title="Chọn bạn để hồi tim" subtitle="Chỉ hồi được cho bạn cùng lớp chưa đầy tim">
            {v.classmates.length === 0 ? <Txt size={14}>Em chưa có bạn cùng lớp nào.</Txt> : null}
            {v.classmates.map((m) => (
              <Btn key={m.id} title={`${m.name} · ${m.hearts} tim`} tone="giay" onPress={async () => { setPicking(false); await cast('hoi_sinh', m.id); }} />
            ))}
          </Sheet>
        </>
      ) : null}
    </View>
  );
};

// ---------------------------------------------------------------------- tab Lớp học
export type ClassSection = 'classes' | 'assignments' | 'skills' | 'teams';

export const ClassTab: React.FC<{ session: Session; hud: Hud | null; refreshKey: number; section?: ClassSection; onChanged: () => void; onStart: (a: MyAssignment) => void }> = ({ session, hud, refreshKey, section: first, onChanged, onStart }) => {
  const [section, setSection] = useState<ClassSection>(first ?? 'classes');
  useEffect(() => { if (first) setSection(first); }, [first]);
  return (
    <View style={{ gap: 14 }}>
      <Txt f="displayHeavy" size={24} accessibilityRole="header">Lớp học</Txt>
      <Segmented<ClassSection> label="Mục trong lớp học" value={section} onChange={setSection}
        options={[{ value: 'classes', label: 'Lớp của em' }, { value: 'assignments', label: 'Bài tập' }, { value: 'teams', label: 'Xếp hạng đội' }, { value: 'skills', label: 'Kỹ năng' }]} />
      {section === 'classes' ? <ClassesSection session={session} refreshKey={refreshKey} onChanged={onChanged} /> : null}
      {section === 'assignments' ? <AssignmentsSection session={session} refreshKey={refreshKey} onStart={onStart} /> : null}
      {section === 'teams' ? <TeamRanking session={session} refreshKey={refreshKey} /> : null}
      {section === 'skills' ? <SkillsSection session={session} hud={hud} refreshKey={refreshKey} onChanged={onChanged} /> : null}
    </View>
  );
};
