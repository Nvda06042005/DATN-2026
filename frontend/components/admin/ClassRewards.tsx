/**
 * Luật lớp, thưởng/phạt, sự kiện và thông báo của giáo viên (HK.GV.059–065): hành vi và mức thưởng/phạt, HP tối đa, bật/tắt tim – xếp hạng – duyệt kỹ năng,
 * thưởng/phạt điểm – vàng – tim cho học sinh hoặc đội kèm lý do, vòng quay vận mệnh đầu giờ, hộp quà lớp, huy hiệu của trường, duyệt kỹ năng, xếp hạng lớp và đội, thông báo.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { Gift, Heart, Plus, Send, Shield, Sparkles, Swords, Trash2, Trophy } from 'lucide-react-native';
import * as game from '@/api/gameApi';
import * as api from '@/api/classroomApi';
import { AdminSelect } from '@/components/admin/AdminSelect';
import { Checklist } from '@/components/admin/ClassPeople';
import { Cell, DataTable, ErrorNote, FormSheet, StatusChip, useAction, useLoad } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { Bar, Btn, Card, Chip, ConfirmSheet, EmptyState, Field, Inset, Segmented, Sheet, Spinner, ToggleRow, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { AdjustRow, ClassDetail, ClassRule, ClassSettings, GoalRow, RandomEventResult } from '@/types/classroom';
import { teamLabel } from '@/types/classroom';

const when = (iso: string) => new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
const signed = (n: number, unit: string) => (n ? `${n > 0 ? '+' : ''}${n} ${unit}` : '');
const effect = (x: { xp: number; gold: number; hp: number }) => [signed(x.xp, 'điểm'), signed(x.gold, 'vàng'), signed(x.hp, 'tim')].filter(Boolean).join(', ') || 'không đổi';

// ---------------------------------------------------------------------- luật lớp (HK.GV.060)
interface RuleDraft { id: string; label: string; xp: string; gold: string; hp: string }

const RulesForm: React.FC<{ session: Session; cls: ClassDetail; settings: ClassSettings; onSaved: (s: ClassSettings) => void }> = ({ session, cls, settings, onSaved }) => {
  const { c } = useTheme();
  const { busy, run } = useAction(session.expired);
  const [hearts, setHearts] = useState(settings.hearts_enabled);
  const [board, setBoard] = useState(settings.leaderboard_enabled);
  const [approval, setApproval] = useState(settings.skill_approval);
  const [warOn, setWarOn] = useState(settings.war_enabled);
  const [warMinutes, setWarMinutes] = useState(settings.war_minutes ? String(settings.war_minutes) : '');
  const [max, setMax] = useState(settings.hearts_max ? String(settings.hearts_max) : '');
  const [goal, setGoal] = useState(String(settings.team_goal_per_member));
  const [rules, setRules] = useState<RuleDraft[]>(settings.rules.map((r) => ({ id: r.id, label: r.label, xp: String(r.xp), gold: String(r.gold), hp: String(r.hp) })));
  const set = (i: number, patch: Partial<RuleDraft>) => setRules((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const save = async () => {
    const res = await run(() => api.saveRules(session.token, cls.id, {
      hearts_enabled: hearts, leaderboard_enabled: board, skill_approval: approval, hearts_max: max ? Number(max) : null, team_goal_per_member: Number(goal) || 100,
      war_enabled: warOn, war_minutes: warMinutes ? Number(warMinutes) : null,
      rules: rules.map((r) => ({ id: r.id, label: r.label.trim(), xp: Number(r.xp) || 0, gold: Number(r.gold) || 0, hp: Number(r.hp) || 0 })),
    }), 'Đã lưu luật lớp');
    if (res) onSaved(res);
  };
  return (
    <View style={{ gap: 14 }}>
      <Card flat pad={14} style={{ gap: 6 }}>
        <ToggleRow icon={Heart} label="Bật cơ chế tim" desc="Tắt thì học sinh trong lớp không bị mất tim khi trả lời sai" checked={hearts} onChange={setHearts} />
        <ToggleRow icon={Trophy} label="Hiện bảng xếp hạng lớp và đội" desc="Tắt thì học sinh thấy thông báo thay cho bảng xếp hạng" checked={board} onChange={setBoard} />
        <ToggleRow icon={Shield} label="Duyệt kỹ năng hồi tim" desc="Kỹ năng Thuốc quý và Hồi sinh chờ giáo viên đồng ý; điểm hành động hoàn lại nếu bị từ chối" checked={approval} onChange={setApproval} />
        <ToggleRow icon={Swords} label="Cho phép game trận đánh" desc="Tắt thì học sinh của lớp không chơi được bản đồ hành quân và đánh thẻ; học và làm bài vẫn bình thường" checked={warOn} onChange={setWarOn} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          <View style={{ flexGrow: 1, flexBasis: 200 }}><AdminSelect label="Thời gian chơi game trận đánh tối đa mỗi ngày" value={warMinutes} onChange={(v) => setWarMinutes(String(v))} testID="class-war-minutes" options={[{ value: '', label: 'Theo cấu hình của trường và hệ thống' }, ...[10, 15, 20, 30, 45, 60, 90, 120].map((m) => ({ value: String(m), label: `${m} phút mỗi ngày` }))]} /></View>
          <View style={{ flexGrow: 1, flexBasis: 200 }}><AdminSelect label="HP (tim) tối đa của lớp" value={max} onChange={setMax} options={[{ value: '', label: 'Theo mặc định chung' }, ...Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: `${i + 1} tim` }))]} /></View>
          <Field label="Mục tiêu điểm tuần mỗi người của đội" value={goal} onChangeText={setGoal} keyboardType="numeric" style={{ flexGrow: 1, flexBasis: 200 }} hint="Nhiệm vụ đội = số thành viên × mức này (10–2000)" />
        </View>
      </Card>
      <Txt f="bold" size={16}>Hành vi và mức thưởng/phạt</Txt>
      {settings.rules_default ? <Txt size={13} color={c.muc3}>Đang dùng danh sách hành vi mẫu; sửa rồi lưu để dùng danh sách riêng của lớp.</Txt> : null}
      {rules.map((r, i) => (
        <Card key={i} flat pad={12} style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
            <Field label={`Hành vi ${i + 1}`} value={r.label} onChangeText={(v) => set(i, { label: v })} style={{ flex: 1 }} />
            <Btn icon={Trash2} label={`Xóa hành vi ${i + 1}`} tone="giay" size="sm" onPress={() => setRules((rs) => rs.filter((_, j) => j !== i))} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Field label="Điểm" value={r.xp} onChangeText={(v) => set(i, { xp: v })} keyboardType="numbers-and-punctuation" style={{ flex: 1 }} />
            <Field label="Vàng" value={r.gold} onChangeText={(v) => set(i, { gold: v })} keyboardType="numbers-and-punctuation" style={{ flex: 1 }} />
            <Field label="Tim" value={r.hp} onChangeText={(v) => set(i, { hp: v })} keyboardType="numbers-and-punctuation" style={{ flex: 1 }} />
          </View>
        </Card>
      ))}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {rules.length < 20 ? <Btn icon={Plus} title="Thêm hành vi" tone="giay" size="sm" onPress={() => setRules((rs) => [...rs, { id: `h${rs.length + 1}-${Date.now() % 1000}`, label: '', xp: '5', gold: '0', hp: '0' }])} /> : null}
        <Btn title="Lưu luật lớp" tone="son" loading={busy} onPress={save} testID="class-rules-save" disabled={!cls.is_active} />
      </View>
    </View>
  );
};

export const ClassRules: React.FC<{ session: Session; cls: ClassDetail; onChanged: () => void }> = ({ session, cls, onChanged }) => {
  const rules = useLoad(() => api.classRules(session.token, cls.id), [session.token, cls.id], session.expired);
  return (
    <View style={{ gap: 12 }}>
      <ErrorNote message={rules.error} />
      {rules.loading && !rules.data ? <Spinner /> : null}
      {rules.data ? <RulesForm key={JSON.stringify(rules.data)} session={session} cls={cls} settings={rules.data} onSaved={(s) => { rules.setData(s); onChanged(); }} /> : null}
    </View>
  );
};

// ---------------------------------------------------------------------- thưởng/phạt (HK.GV.059)
const AdjustSheet: React.FC<{ session: Session; cls: ClassDetail; settings: ClassSettings; onClose: () => void; onDone: () => void }> = ({ session, cls, settings, onClose, onDone }) => {
  const students = useLoad(() => api.classStudents(session.token, cls.id), [session.token, cls.id], session.expired);
  const teams = useLoad(() => api.classTeams(session.token, cls.id), [session.token, cls.id], session.expired);
  const { busy, run } = useAction(session.expired);
  const [target, setTarget] = useState<'students' | 'teams'>('students');
  const [userIds, setUserIds] = useState<number[]>([]);
  const [teamIds, setTeamIds] = useState<number[]>([]);
  const [label, setLabel] = useState('');
  const [xp, setXp] = useState('0');
  const [gold, setGold] = useState('0');
  const [hp, setHp] = useState('0');
  const use = (r: ClassRule) => { setLabel(r.label); setXp(String(r.xp)); setGold(String(r.gold)); setHp(String(r.hp)); };
  return (
    <Sheet open onClose={onClose} title="Thưởng / phạt" subtitle="Điểm, vàng, tim thay đổi ngay và học sinh được thông báo kèm lý do" wide
      footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}><Btn title="Hủy" tone="giay" onPress={onClose} disabled={busy} />
        <Btn title="Áp dụng" tone="son" loading={busy} testID="adjust-submit" disabled={!(target === 'students' ? userIds.length : teamIds.length)}
          onPress={async () => {
            const res = await run(() => api.adjustClass(session.token, cls.id, { ...(target === 'students' ? { user_ids: userIds } : { team_ids: teamIds }), label: label.trim(), xp: Number(xp) || 0, gold: Number(gold) || 0, hp: Number(hp) || 0 }));
            if (res) { onDone(); onClose(); }
          }} /></View>}>
      <Txt f="bold" size={14}>Chọn nhanh một hành vi trong luật lớp</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {settings.rules.map((r) => <Btn key={r.id} title={`${r.label} (${effect(r)})`} tone="giay" size="sm" onPress={() => use(r)} />)}
      </View>
      <Field label="Lý do (hiện cho học sinh)" value={label} onChangeText={setLabel} placeholder="Ví dụ: Phát biểu xây dựng bài" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Field label="Điểm (+/−)" value={xp} onChangeText={setXp} keyboardType="numbers-and-punctuation" style={{ flex: 1 }} />
        <Field label="Vàng (+/−)" value={gold} onChangeText={setGold} keyboardType="numbers-and-punctuation" style={{ flex: 1 }} />
        <Field label="Tim (+/−)" value={hp} onChangeText={setHp} keyboardType="numbers-and-punctuation" style={{ flex: 1 }} />
      </View>
      <Txt size={13}>Số âm là phạt. Điểm và vàng không xuống dưới 0, tim giữ trong khoảng 0 đến HP tối đa, cấp độ không bị hạ.</Txt>
      <Segmented label="Đối tượng" options={[{ value: 'students', label: 'Học sinh' }, { value: 'teams', label: 'Cả đội' }]} value={target} onChange={setTarget} />
      {target === 'students'
        ? <Checklist items={(students.data ?? []).map((s) => ({ id: s.id, label: s.full_name, sub: s.team_name }))} value={userIds} onChange={setUserIds} empty="Lớp chưa có học sinh." />
        : <Checklist items={(teams.data ?? []).map((t) => ({ id: t.id, label: t.name, sub: `${t.members.length} học sinh` }))} value={teamIds} onChange={setTeamIds} empty="Lớp chưa chia đội." />}
    </Sheet>
  );
};

const GoalSection: React.FC<{ session: Session; cls: ClassDetail }> = ({ session, cls }) => {
  const { c } = useTheme();
  const goals = useLoad(() => api.classGoals(session.token, cls.id), [session.token, cls.id], session.expired);
  const { busy, run } = useAction(session.expired);
  const [form, setForm] = useState(false);
  const [removing, setRemoving] = useState<GoalRow | null>(null);
  return (
    <Card flat pad={14} style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <View style={{ flex: 1, minWidth: 200 }}><Txt f="bold" size={16}>Hộp quà của lớp</Txt><Txt size={13} color={c.muc2}>Cả lớp cùng đạt mục tiêu điểm (không tính điểm giáo viên thưởng) thì mở hộp quà cho mọi học sinh.</Txt></View>
        <Btn icon={Gift} title="Tạo hộp quà" tone="giay" size="sm" onPress={() => setForm(true)} testID="goal-create" disabled={!cls.is_active} />
      </View>
      <ErrorNote message={goals.error} />
      {(goals.data ?? []).map((g) => (
        <View key={g.id} style={{ gap: 6, borderTopWidth: 1, borderTopColor: c.adminLine, paddingTop: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Txt f="semibold" size={15} style={{ flex: 1, minWidth: 160 }}>{g.title}</Txt>
            {g.opened ? <StatusChip kind="muted" text="Đã mở" /> : g.reached ? <StatusChip kind="on" text="Sẵn sàng mở" /> : <StatusChip kind="info" text="Đang tích lũy" />}
          </View>
          <Bar value={Math.min(g.progress, g.target_xp)} max={g.target_xp} label={`${g.progress}/${g.target_xp} điểm`} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Txt size={13} color={c.muc2} style={{ flex: 1 }}>{g.progress}/{g.target_xp} điểm · thưởng {g.reward_gold} vàng{g.reward_xp ? ` + ${g.reward_xp} điểm` : ''} mỗi học sinh</Txt>
            {!g.opened ? <Btn title="Mở hộp quà" tone="ngoc" size="sm" loading={busy} disabled={!g.reached} onPress={async () => { if (await run(() => api.openGoal(session.token, g.id), 'Đã mở hộp quà cho cả lớp')) goals.reload(); }} testID="goal-open" /> : null}
            {!g.opened ? <Btn icon={Trash2} label={`Xóa ${g.title}`} tone="giay" size="sm" onPress={() => setRemoving(g)} /> : null}
          </View>
        </View>
      ))}
      {goals.data && !goals.data.length ? <Txt size={13} color={c.muc3}>Chưa có hộp quà nào.</Txt> : null}
      {form ? (
        <FormSheet title="Tạo hộp quà của lớp" fields={[{ name: 'title', label: 'Tên mục tiêu', required: true, placeholder: 'Cả lớp đạt 500 điểm trong tuần' }, { name: 'target_xp', label: 'Mục tiêu điểm của cả lớp (từ 10)', type: 'number', required: true },
          { name: 'reward_gold', label: 'Vàng thưởng mỗi học sinh', type: 'number' }, { name: 'reward_xp', label: 'Điểm thưởng mỗi học sinh', type: 'number' }]} initial={{ reward_gold: '20', reward_xp: '0' }} onClose={() => setForm(false)}
          onSubmit={async (v) => { await api.createGoal(session.token, cls.id, { title: String(v.title).trim(), target_xp: Number(v.target_xp), reward_gold: Number(v.reward_gold) || 0, reward_xp: Number(v.reward_xp) || 0 }); setForm(false); goals.reload(); }} />
      ) : null}
      <ConfirmSheet open={!!removing} title="Xóa hộp quà?" message={`Xóa “${removing?.title ?? ''}”.`} confirmLabel="Xóa" busy={busy} onCancel={() => setRemoving(null)}
        onConfirm={async () => { if (removing) { const ok = await run(async () => { await api.deleteGoal(session.token, removing.id); return true; }, 'Đã xóa'); setRemoving(null); if (ok) goals.reload(); } }} />
    </Card>
  );
};

const AwardBadge: React.FC<{ session: Session; cls: ClassDetail; onClose: () => void }> = ({ session, cls, onClose }) => {
  const badges = useLoad(() => game.schoolBadges(session.token), [session.token], session.expired);
  const students = useLoad(() => api.classStudents(session.token, cls.id), [session.token, cls.id], session.expired);
  const teams = useLoad(() => api.classTeams(session.token, cls.id), [session.token, cls.id], session.expired);
  const { busy, run } = useAction(session.expired);
  const [badge, setBadge] = useState('');
  const [userIds, setUserIds] = useState<number[]>([]);
  const [teamIds, setTeamIds] = useState<number[]>([]);
  return (
    <Sheet open onClose={onClose} title="Trao huy hiệu" subtitle="Huy hiệu riêng của trường, trao cho học sinh hoặc cả đội" wide
      footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}><Btn title="Đóng" tone="giay" onPress={onClose} disabled={busy} />
        <Btn title="Trao huy hiệu" tone="son" loading={busy} disabled={!badge || !(userIds.length || teamIds.length)} testID="badge-award"
          onPress={async () => { const res = await run(() => api.awardBadge(session.token, cls.id, Number(badge), { user_ids: userIds, team_ids: teamIds })); if (res) { onClose(); } }} /></View>}>
      {badges.data && !badges.data.length ? <Inset><Txt size={14}>Trường chưa có huy hiệu riêng. Quản trị viên trường tạo huy hiệu ở mục Trò chơi hóa.</Txt></Inset> : null}
      <AdminSelect label="Huy hiệu" value={badge} onChange={setBadge} options={[{ value: '', label: '— Chọn huy hiệu —' }, ...(badges.data ?? []).map((b) => ({ value: String(b.id), label: b.name }))]} />
      <Txt f="bold" size={14}>Học sinh</Txt>
      <Checklist items={(students.data ?? []).map((s) => ({ id: s.id, label: s.full_name, sub: s.team_name }))} value={userIds} onChange={setUserIds} />
      {(teams.data ?? []).length ? (<><Txt f="bold" size={14}>Hoặc cả đội</Txt><Checklist items={(teams.data ?? []).map((t) => ({ id: t.id, label: t.name }))} value={teamIds} onChange={setTeamIds} /></>) : null}
    </Sheet>
  );
};

const SpinWheel: React.FC<{ session: Session; cls: ClassDetail; onDone: () => void }> = ({ session, cls, onDone }) => {
  const { c } = useTheme();
  const teams = useLoad(() => api.classTeams(session.token, cls.id), [session.token, cls.id], session.expired);
  const events = useLoad(() => api.randomEvents(session.token), [session.token], session.expired);
  const { busy, run } = useAction(session.expired);
  const [target, setTarget] = useState<'class' | 'team'>('class');
  const [team, setTeam] = useState('');
  const [result, setResult] = useState<RandomEventResult | null>(null);
  return (
    <Card flat pad={14} style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}><Sparkles size={20} color={c.dongChu} /><Txt f="bold" size={16}>Vòng quay vận mệnh</Txt></View>
      <Txt size={13} color={c.muc2}>Máy chủ chọn ngẫu nhiên một sự kiện đầu giờ rồi áp dụng cho cả lớp hoặc một đội. {events.data ? `Có ${events.data.length} sự kiện: ${events.data.map((e) => e.label).join('; ')}.` : ''}</Txt>
      <Segmented label="Áp dụng cho" options={[{ value: 'class', label: 'Cả lớp' }, { value: 'team', label: 'Một đội' }]} value={target} onChange={setTarget} />
      {target === 'team' ? <AdminSelect label="Đội" value={team} onChange={setTeam} options={[{ value: '', label: '— Chọn đội —' }, ...(teams.data ?? []).map((t) => ({ value: String(t.id), label: t.name }))]} /> : null}
      <Btn icon={Sparkles} title="Quay!" tone="son" loading={busy} disabled={!cls.is_active || (target === 'team' && !team)} testID="spin-go"
        onPress={async () => { const res = await run(() => api.spinEvent(session.token, cls.id, target === 'team' ? { target, team_id: Number(team) } : { target })); if (res) { setResult(res); onDone(); } }} />
      {result ? (
        <Inset style={{ backgroundColor: c.vangNhat, gap: 4 }} >
          <Txt f="displayHeavy" size={18} color={c.vangChu} testID="spin-result">{result.event.label}</Txt>
          <Txt size={13} color={c.vangChu}>{result.scope} · {result.affected} học sinh{result.event.xp || result.event.gold || result.event.hp ? ` · ${effect(result.event)}` : ''}</Txt>
        </Inset>
      ) : null}
    </Card>
  );
};

const SkillRequests: React.FC<{ session: Session; cls: ClassDetail; onChanged: () => void }> = ({ session, cls, onChanged }) => {
  const { c } = useTheme();
  const list = useLoad(() => api.skillRequests(session.token, cls.id), [session.token, cls.id], session.expired);
  const { busy, run } = useAction(session.expired);
  const decide = async (id: number, approve: boolean) => { if (await run(() => api.decideSkill(session.token, id, approve), approve ? 'Đã đồng ý' : 'Đã từ chối; điểm hành động được hoàn lại')) { list.reload(); onChanged(); } };
  const NAME: Record<string, string> = { thuoc_quy: 'Thuốc quý', hoi_sinh: 'Hồi sinh' };
  const rows = list.data ?? [];
  if (!rows.length) return null;
  return (
    <Card flat pad={14} style={{ gap: 8 }}>
      <Txt f="bold" size={16}>Yêu cầu dùng kỹ năng</Txt>
      {rows.slice(0, 12).map((r) => (
        <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Txt size={14} style={{ flex: 1, minWidth: 200 }}>{r.user_name} xin dùng “{NAME[r.skill] ?? r.skill}”{r.target_name ? ` cho ${r.target_name}` : ''} · {when(r.created_at)}</Txt>
          {r.status === 'pending' ? (<><Btn title="Đồng ý" tone="ngoc" size="sm" loading={busy} onPress={() => decide(r.id, true)} /><Btn title="Từ chối" tone="giay" size="sm" loading={busy} onPress={() => decide(r.id, false)} /></>)
            : <Chip text={r.status === 'done' ? 'Đã đồng ý' : 'Đã từ chối'} bg={r.status === 'done' ? c.mocNhat : c.sonNhat} fg={r.status === 'done' ? c.mocChu : c.sonChu} />}
        </View>
      ))}
    </Card>
  );
};

const HistoryBoard: React.FC<{ session: Session; cls: ClassDetail; tick: number }> = ({ session, cls, tick }) => {
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('week');
  const history = useLoad(() => api.adjustHistory(session.token, cls.id), [session.token, cls.id, tick], session.expired);
  const board = useLoad(() => api.classBoard(session.token, cls.id, period), [session.token, cls.id, period, tick], session.expired);
  const KIND: Record<AdjustRow['kind'], string> = { reward: 'Thưởng', penalty: 'Phạt', event: 'Sự kiện', goal: 'Hộp quà' };
  return (
    <View style={{ gap: 12 }}>
      <Txt f="bold" size={16}>Xếp hạng lớp và đội</Txt>
      <Segmented label="Thời gian" options={[{ value: 'week', label: 'Tuần này' }, { value: 'month', label: 'Tháng này' }, { value: 'all', label: 'Từ đầu' }]} value={period} onChange={setPeriod} />
      {board.data ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          <View style={{ flexGrow: 2, flexBasis: 300, minWidth: 260 }}>
            <DataTable rows={board.data.students.slice(0, 15)} rowKey={(s) => s.id} empty="Chưa có học sinh"
              columns={[{ key: 'r', label: 'Hạng', flex: 0.5, render: (s) => <Txt f="bold" size={14}>{s.rank}</Txt> }, { key: 'n', label: 'Học sinh', flex: 2, render: (s) => <Cell main={s.nickname || s.full_name} sub={s.nickname ? s.full_name : null} /> }, { key: 'x', label: 'Điểm', flex: 1, render: (s) => <Txt size={14}>{s.xp}</Txt> }]} />
          </View>
          {board.data.teams.length ? (
            <View style={{ flexGrow: 1, flexBasis: 240, minWidth: 220 }}>
              <DataTable rows={board.data.teams} rowKey={(t) => t.id} empty="Chưa chia đội"
                columns={[{ key: 'r', label: 'Hạng', flex: 0.5, render: (t) => <Txt f="bold" size={14}>{t.rank}</Txt> }, { key: 'n', label: 'Đội', flex: 2, render: (t) => <Cell main={t.name} sub={`${t.members} học sinh`} /> }, { key: 'x', label: 'Điểm', flex: 1, render: (t) => <Txt size={14}>{t.xp}</Txt> }]} />
            </View>
          ) : null}
        </View>
      ) : <Spinner />}
      <Txt f="bold" size={16}>Lịch sử thưởng/phạt gần đây</Txt>
      {history.data && !history.data.length ? <EmptyState mood="thinking" title="Chưa có thưởng/phạt nào" /> : null}
      <DataTable rows={(history.data ?? []).slice(0, 30)} rowKey={(h) => h.id} empty=""
        columns={[
          { key: 'w', label: 'Thời gian', flex: 1, render: (h) => <Txt size={13}>{when(h.created_at)}</Txt> },
          { key: 's', label: 'Học sinh', flex: 1.5, render: (h) => <Cell main={h.full_name} sub={h.team_name ? teamLabel(h.team_name) : null} /> },
          { key: 'l', label: 'Lý do', flex: 2, render: (h) => <Cell main={h.label} sub={KIND[h.kind]} /> },
          { key: 'e', label: 'Kết quả', flex: 1.5, render: (h) => <Txt size={13}>{effect(h.applied ?? h)}</Txt> },
        ]} />
    </View>
  );
};

export const ClassRewards: React.FC<{ session: Session; cls: ClassDetail; onChanged: () => void }> = ({ session, cls, onChanged }) => {
  const rules = useLoad(() => api.classRules(session.token, cls.id), [session.token, cls.id], session.expired);
  const [adjust, setAdjust] = useState(false);
  const [badge, setBadge] = useState(false);
  const [tick, setTick] = useState(0);
  const done = () => { setTick((t) => t + 1); onChanged(); };
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Btn icon={Gift} title="Thưởng / phạt" tone="son" size="sm" onPress={() => setAdjust(true)} disabled={!rules.data || !cls.is_active} testID="class-adjust" />
        <Btn icon={Trophy} title="Trao huy hiệu" tone="giay" size="sm" onPress={() => setBadge(true)} disabled={!cls.is_active} />
      </View>
      <SpinWheel session={session} cls={cls} onDone={done} />
      <GoalSection session={session} cls={cls} />
      <SkillRequests session={session} cls={cls} onChanged={onChanged} />
      <HistoryBoard session={session} cls={cls} tick={tick} />
      {adjust && rules.data ? <AdjustSheet session={session} cls={cls} settings={rules.data} onClose={() => setAdjust(false)} onDone={done} /> : null}
      {badge ? <AwardBadge session={session} cls={cls} onClose={() => setBadge(false)} /> : null}
    </View>
  );
};

// ---------------------------------------------------------------------- thông báo của lớp
export const ClassNotices: React.FC<{ session: Session; cls: ClassDetail }> = ({ session, cls }) => {
  const { c } = useTheme();
  const sent = useLoad(() => api.announcements(session.token, cls.id), [session.token, cls.id], session.expired);
  const teams = useLoad(() => api.classTeams(session.token, cls.id), [session.token, cls.id], session.expired);
  const { busy, run } = useAction(session.expired);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [team, setTeam] = useState('');
  return (
    <View style={{ gap: 14 }}>
      <Card flat pad={14} style={{ gap: 10 }}>
        <Txt f="bold" size={16}>Gửi thông báo</Txt>
        <Field label="Tiêu đề" value={title} onChangeText={setTitle} />
        <Field label="Nội dung" value={body} onChangeText={setBody} multiline numberOfLines={4} inputStyle={{ minHeight: 96, textAlignVertical: 'top' }} />
        <AdminSelect label="Gửi cho" value={team} onChange={setTeam} options={[{ value: '', label: 'Cả lớp' }, ...(teams.data ?? []).map((t) => ({ value: String(t.id), label: teamLabel(t.name) }))]} />
        <Btn icon={Send} title="Gửi thông báo" tone="son" loading={busy} disabled={!title.trim() || !body.trim() || !cls.is_active} testID="announce-send"
          onPress={async () => { const res = await run(() => api.announce(session.token, cls.id, { title: title.trim(), body: body.trim(), team_id: team ? Number(team) : null }), 'Đã gửi thông báo'); if (res) { setTitle(''); setBody(''); sent.reload(); } }} />
      </Card>
      <Txt f="bold" size={16}>Đã gửi gần đây</Txt>
      {sent.data && !sent.data.length ? <Txt size={13} color={c.muc3}>Chưa gửi thông báo nào.</Txt> : null}
      {(sent.data ?? []).map((a, i) => (
        <Card key={i} flat pad={12} style={{ gap: 4 }}>
          <Txt f="semibold" size={15}>{a.title}</Txt>
          <Txt size={14} color={c.muc2}>{a.body}</Txt>
          <Txt size={12} color={c.muc3}>{when(a.created_at)} · {a.recipients} người nhận · {a.read} đã đọc</Txt>
        </Card>
      ))}
    </View>
  );
};
