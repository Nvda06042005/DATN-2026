import { useMemo, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { Activity, BookOpen, Building2, GraduationCap, RefreshCw, Swords, Trophy, UserRound, Users } from 'lucide-react-native';
import * as api from '@/api/analyticsApi';
import { ErrorNote, useLoad } from '@/components/admin/kit';
import { TrendChart, type TrendPoint } from '@/components/admin/TrendChart';
import type { Session } from '@/components/auth';
import { shortDay } from '@/components/charts';
import { Btn, Card, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { alignActivity, rollingAverage } from '@/lib/dashboard-trend';
import { fmt } from '@/lib/format';
import type { IconType } from '@/types/game';

const BLUE = '#3474d9', PURPLE = '#aa42ad';
const dateText = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;
const ROLES = [
  { key: 'student', label: 'Học sinh', color: BLUE },
  { key: 'teacher', label: 'Giáo viên', color: PURPLE },
  { key: 'school_admin', label: 'Quản trị trường', color: '#b77c18' },
  { key: 'root_admin', label: 'Quản trị tổng', color: '#bd342b' },
];

function Metric({ label, value, hint, icon: Icon, color, background }: {
  label: string; value: number; hint: string; icon: IconType; color: string; background: string;
}) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  return <Card flat pad={18} style={{ flexGrow: 1, flexBasis: width < 650 ? '45%' : 190, minWidth: 130, borderRadius: 12, gap: 16 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <Txt size={12} f="semibold" color={c.muc2} style={{ flex: 1 }}>{label}</Txt>
      <View style={{ width: 37, height: 37, borderRadius: 10, backgroundColor: background, alignItems: 'center', justifyContent: 'center' }}><Icon size={19} color={color} /></View>
    </View>
    <View accessible accessibilityLabel={`${label}: ${fmt(value)}. ${hint}`} style={{ gap: 3 }}>
      <Txt size={31} f="displayHeavy" color={c.muc}>{fmt(value)}</Txt>
      <Txt size={11} color={c.muc3}>{hint}</Txt>
    </View>
  </Card>;
}

/** Dashboard quản lý tổng: số thực từ API, biểu đồ ngày theo lịch của máy chủ. */
export function SystemDashboard({ session }: { session: Session }) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 1250;
  const [days, setDays] = useState<7 | 14 | 30>(30);
  const overview = useLoad(() => api.systemOverview(session.token), [session.token], session.expired);
  const usage = useLoad(() => api.usage(session.token, 'day', 30), [session.token], session.expired);
  const d = overview.data;
  const trend = useMemo(() => {
    const source = d?.series ?? [];
    const average = rollingAverage(source.map(p => p.users));
    return source.map((p, i): TrendPoint => ({ key: p.day, label: shortDay(p.day), detail: dateText(p.day), values: { users: p.users, average: average[i] } }));
  }, [d]);
  const activities = useMemo(() => {
    const source = d?.series ?? [];
    const aligned = alignActivity(source.map(p => p.day), usage.data?.items ?? []);
    return source.map((p, i): TrendPoint => ({ key: p.day, label: shortDay(p.day), detail: dateText(p.day), values: { lessons: aligned[i]?.lessons ?? 0, quizzes: aligned[i]?.quizzes ?? 0 } }));
  }, [d, usage.data]);
  const shown = trend.slice(-days), shownActivities = activities.slice(-days);
  const roles = d?.users_by_role ?? {};
  const totalUsers = Object.values(roles).reduce((sum, n) => sum + n, 0);
  const refresh = () => { overview.reload(); usage.reload(); };
  const totals = (usage.data?.items ?? []).filter(p => shown.some(day => day.key === p.bucket)).reduce((sum, p) => ({
    lessons: sum.lessons + p.lessons, quizzes: sum.quizzes + p.quizzes, battles: sum.battles + p.battles, rooms: sum.rooms + p.rooms,
  }), { lessons: 0, quizzes: 0, battles: 0, rooms: 0 });
  return <View testID="system-dashboard" style={{ gap: 18 }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <View style={{ gap: 4 }}>
        <Txt f="bold" size={11} color={c.son} upper style={{ letterSpacing: 1 }}>Tổng quan nền tảng</Txt>
        <Txt size={12} color={c.muc3}>{d?.as_of ? `Số liệu đến ${dateText(d.as_of)} · Giờ Việt Nam` : 'Trường học, người dùng và hoạt động học tập'}</Txt>
      </View>
      <Btn title="Làm mới" icon={RefreshCw} tone="giay" size="sm" onPress={refresh} loading={overview.loading || usage.loading} testID="dashboard-refresh" />
    </View>
    <ErrorNote message={overview.error} />
    {overview.loading && !d ? <Spinner label="Đang tải dashboard…" /> : null}
    {d && <>
      <View testID="dashboard-metrics" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        <Metric label="Trường đang hoạt động" value={d.schools} hint={`${fmt(d.schools_total)} trường trên hệ thống`} icon={Building2} color={c.son} background={c.sonNhat} />
        <Metric label="Học sinh" value={roles.student ?? 0} hint="Tài khoản đang hoạt động" icon={GraduationCap} color={c.thuyChu} background={c.thuyNhat} />
        <Metric label="Giáo viên" value={roles.teacher ?? 0} hint="Tài khoản đang hoạt động" icon={UserRound} color={c.thongChu} background={c.thongNhat} />
        <Metric label="Người dùng hoạt động" value={d.mau} hint="Trong 30 ngày gần nhất" icon={Activity} color={c.ngocChu} background={c.ngocNhat} />
      </View>
      <Card flat pad={14} style={{ borderRadius: 12 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20, justifyContent: 'space-between' }}>
          {[['Hoạt động hôm nay', `${fmt(d.dau)} người`], ['Hoạt động 7 ngày', `${fmt(d.wau)} người`], ['Tài khoản mới 30 ngày', fmt(d.new_users_30d)]].map(([label, value]) => <View key={label} style={{ flexGrow: 1, flexBasis: 170, gap: 3 }}><Txt size={11} color={c.muc3}>{label}</Txt><Txt f="bold" size={16}>{value}</Txt></View>)}
        </View>
      </Card>
      <View style={{ flexDirection: width < 600 ? 'column' : 'row', gap: 8, alignItems: width < 600 ? 'stretch' : 'center' }}>
        <Txt f="semibold" size={13} style={{ marginRight: 'auto' }}>Xu hướng hoạt động</Txt>
        <View style={{ flexDirection: 'row', gap: 8 }}>
        {([7, 14, 30] as const).map(n => <Pressable key={n} testID={`dashboard-range-${n}`} accessibilityRole="button" accessibilityLabel={`${n} ngày`} accessibilityState={{ selected: days === n }} onPress={() => setDays(n)}
          style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 7, borderWidth: 1, borderColor: days === n ? c.son : c.adminLine, backgroundColor: days === n ? c.sonNhat : c.the }}><Txt f={days === n ? 'bold' : 'medium'} size={12} color={days === n ? c.son : c.muc2}>{n} ngày</Txt></Pressable>)}
        </View>
      </View>
      <View style={{ flexDirection: wide ? 'row' : 'column', alignItems: 'stretch', gap: 16 }}>
        <Card flat pad={width < 600 ? 14 : 20} style={{ flex: wide ? 2.2 : undefined, minWidth: 0, borderRadius: 12, gap: 14 }}>
          <View style={{ gap: 4 }}><Txt f="bold" size={16}>Người dùng hoạt động</Txt><Txt size={11} color={c.muc3}>{shown.length ? `${dateText(shown[0].key)} – ${dateText(shown.at(-1)!.key)}` : `${days} ngày gần nhất`}</Txt></View>
          <TrendChart id="dashboard-users-trend" data={shown} unit="người" summary="Người dùng hoạt động theo ngày và trung bình trượt 7 ngày" series={[{ key: 'users', label: 'Hoạt động mỗi ngày', color: BLUE }, { key: 'average', label: 'Trung bình 7 ngày', color: PURPLE, dashed: true }]} />
        </Card>
        <Card flat pad={20} style={{ flex: wide ? 1 : undefined, minWidth: 0, borderRadius: 12, gap: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Users size={18} color={c.muc3} /><Txt f="bold" size={16}>Cơ cấu người dùng</Txt></View>
          <View style={{ gap: 3 }}><Txt f="displayHeavy" size={32}>{fmt(totalUsers)}</Txt><Txt size={12} color={c.muc3}>tài khoản đang hoạt động</Txt></View>
          <View style={{ height: 9, borderRadius: 5, overflow: 'hidden', flexDirection: 'row', backgroundColor: c.adminLine }}>
            {ROLES.map(role => (roles[role.key] ?? 0) > 0 ? <View key={role.key} style={{ flex: roles[role.key], backgroundColor: role.color }} /> : null)}
          </View>
          {ROLES.map(role => <View key={role.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: role.color }} />
            <Txt size={12} color={c.muc2} style={{ flex: 1 }}>{role.label}</Txt>
            <Txt f="bold" size={13}>{fmt(roles[role.key] ?? 0)}</Txt>
            <Txt size={11} color={c.muc3} style={{ width: 36, textAlign: 'right' }}>{totalUsers ? Math.round(((roles[role.key] ?? 0) / totalUsers) * 100) : 0}%</Txt>
          </View>)}
        </Card>
      </View>
      <View style={{ flexDirection: wide ? 'row' : 'column', alignItems: 'stretch', gap: 16 }}>
        <Card flat pad={width < 600 ? 14 : 20} style={{ flex: wide ? 2.2 : undefined, minWidth: 0, borderRadius: 12, gap: 14 }}>
          <View style={{ gap: 4 }}><Txt f="bold" size={16}>Nhịp học tập</Txt><Txt size={11} color={c.muc3}>Bài học hoàn thành và lượt làm quiz trong {days} ngày</Txt></View>
          <ErrorNote message={usage.error} />
          {usage.loading && !usage.data ? <Spinner /> : usage.data ? <TrendChart id="dashboard-learning-trend" data={shownActivities} unit="lượt" summary="Bài học hoàn thành và quiz theo ngày" series={[{ key: 'lessons', label: 'Bài học hoàn thành', color: BLUE }, { key: 'quizzes', label: 'Lượt làm quiz', color: PURPLE, dashed: true }]} /> : null}
        </Card>
        <Card flat pad={20} style={{ flex: wide ? 1 : undefined, minWidth: 0, borderRadius: 12, gap: 20 }}>
          <View style={{ gap: 4 }}><Txt f="bold" size={16}>Hoạt động trong kỳ</Txt><Txt size={11} color={c.muc3}>{days} ngày đang chọn</Txt></View>
          {usage.error && !usage.data ? <Txt size={12} color={c.muc3}>Chưa tải được số liệu hoạt động.</Txt> : !usage.data ? <Spinner /> : <>
            {[{ label: 'Bài học hoàn thành', value: totals.lessons, icon: BookOpen, color: c.thuyChu, bg: c.thuyNhat }, { label: 'Lượt làm quiz', value: totals.quizzes, icon: GraduationCap, color: c.thongChu, bg: c.thongNhat }, { label: 'Trận đánh, mini-game', value: totals.battles, icon: Swords, color: c.son, bg: c.sonNhat }, { label: 'Phòng thi đấu', value: totals.rooms, icon: Trophy, color: c.vangChu, bg: c.vangNhat }].map(item => <View key={item.label} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: item.bg, alignItems: 'center', justifyContent: 'center' }}><item.icon size={18} color={item.color} /></View>
              <Txt size={12} color={c.muc2} style={{ flex: 1 }}>{item.label}</Txt><Txt f="bold" size={20}>{fmt(item.value)}</Txt>
            </View>)}
          </>}
        </Card>
      </View>
    </>}
  </View>;
}
