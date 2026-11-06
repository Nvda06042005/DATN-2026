import type { ReactNode } from 'react';
import { View } from 'react-native';
import { BookOpen, Brain, GraduationCap, Swords, Trophy } from 'lucide-react-native';
import { Card, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { fmt } from '@/lib/format';
import type { AiUsage, ContentRow, ContentStats, Usage } from '@/types/analytics';

/**
 * Các thẻ nhỏ của trang "Thống kê hệ thống" (một màn hình, không cuộn). Dữ liệu do SystemDashboard tải; thẻ chỉ trình bày.
 * Mỗi thẻ cao vừa nội dung (dưới 210 px) để cả trang nằm gọn trong cửa sổ khoảng 1536 × 730.
 */
export const BLUE = '#3474d9', PURPLE = '#aa42ad', GOLD = '#b77c18', GREEN = '#258575', RED = '#bd342b';
const cardStyle = { flex: 1, minWidth: 0, borderRadius: 12, gap: 7 } as const;
const percentOf = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

const ROLES = [
  { key: 'student', label: 'Học sinh', color: BLUE },
  { key: 'teacher', label: 'Giáo viên', color: PURPLE },
  { key: 'school_admin', label: 'Quản trị trường', color: GOLD },
  { key: 'root_admin', label: 'Quản trị tổng', color: RED },
];

function Title({ title, note, right }: { title: string; note?: string; right?: ReactNode }) {
  const { c } = useTheme();
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', columnGap: 8 }}>
    <Txt f="bold" size={14} accessibilityRole="header" style={{ flexShrink: 0 }}>{title}</Txt>
    {right ?? (note ? <Txt size={11} color={c.muc3} numberOfLines={1}>{note}</Txt> : null)}
  </View>;
}

function Waiting({ text }: { text: string }) {
  const { c } = useTheme();
  return <Txt size={12} color={c.muc3}>{text}</Txt>;
}

/** Cơ cấu tài khoản đang hoạt động theo vai trò: thanh chồng và bốn dòng số liệu. */
export function RolesCard({ roles, newUsers }: { roles: Record<string, number>; newUsers: number }) {
  const { c } = useTheme();
  const total = Object.values(roles).reduce((sum, n) => sum + n, 0);
  return <Card flat pad={12} style={cardStyle} testID="dashboard-roles">
    <Title title="Cơ cấu người dùng" note={`${fmt(total)} tài khoản`} />
    <View style={{ height: 8, borderRadius: 4, overflow: 'hidden', flexDirection: 'row', backgroundColor: c.adminLine }}>
      {ROLES.map((role) => (roles[role.key] ?? 0) > 0 ? <View key={role.key} style={{ flex: roles[role.key], backgroundColor: role.color }} /> : null)}
    </View>
    {ROLES.map((role) => <View key={role.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: role.color }} />
      <Txt size={12} color={c.muc2} style={{ flex: 1 }}>{role.label}</Txt>
      <Txt f="bold" size={13}>{fmt(roles[role.key] ?? 0)}</Txt>
      <Txt size={11} color={c.muc3} style={{ width: 34, textAlign: 'right' }}>{percentOf(roles[role.key] ?? 0, total)}%</Txt>
    </View>)}
    <Txt size={11} color={c.muc3}>Tài khoản mới 30 ngày: <Txt f="bold" size={11} color={c.muc2}>+{fmt(newUsers)}</Txt></Txt>
  </Card>;
}

const STATUSES = [
  { key: 'published' as const, label: 'Đã xuất bản', short: 'Xuất bản', color: GREEN },
  { key: 'verified' as const, label: 'Đã kiểm duyệt', short: 'Kiểm duyệt', color: BLUE },
  { key: 'draft' as const, label: 'Bản nháp', short: 'Nháp', color: GOLD },
];
const sumRows = (rows: ContentRow[]) => rows.reduce((a, r) => ({ total: a.total + r.total, draft: a.draft + r.draft, verified: a.verified + r.verified, published: a.published + r.published }), { total: 0, draft: 0, verified: 0, published: 0 });

/** Tỉ lệ nội dung đã xuất bản trên toàn kho (dùng cho đồng hồ). */
export const contentTotals = (d: ContentStats) => sumRows([...d.history, ...d.learning]);

/** Nội dung theo trạng thái: kho lịch sử và nội dung học tập, kèm số câu hỏi, bộ đề và tư liệu AI. */
export function ContentCard({ d }: { d: ContentStats | null }) {
  const { c } = useTheme();
  const groups = d ? [{ label: 'Kho lịch sử', sum: sumRows(d.history) }, { label: 'Nội dung học tập', sum: sumRows(d.learning) }] : [];
  return <Card flat pad={12} style={cardStyle} testID="dashboard-content">
    <Title title="Nội dung" right={<View style={{ flexDirection: 'row', gap: 9 }}>{STATUSES.map((s) => <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: s.color }} /><Txt size={10} color={c.muc3}>{s.short}</Txt></View>)}</View>} />
    {!d ? <Waiting text="Đang tải thống kê nội dung…" /> : <>
      {groups.map(({ label, sum }) => <View key={label} accessible accessibilityLabel={`${label}: tổng ${sum.total}, ${sum.published} đã xuất bản, ${sum.verified} đã kiểm duyệt, ${sum.draft} bản nháp`} style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Txt f="semibold" size={12}>{label}</Txt><Txt f="bold" size={12}>{fmt(sum.total)}</Txt></View>
        <View style={{ flexDirection: 'row', height: 7, borderRadius: 4, backgroundColor: c.adminLine, overflow: 'hidden' }}>
          {STATUSES.map((s) => sum[s.key] > 0 ? <View key={s.key} style={{ width: `${(100 * sum[s.key]) / Math.max(1, sum.total)}%`, backgroundColor: s.color }} /> : null)}
        </View>
        <Txt size={10} color={c.muc3}>{STATUSES.map((s) => `${fmt(sum[s.key])} ${s.label.toLowerCase()}`).join(' · ')}</Txt>
      </View>)}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 2, borderTopWidth: 1, borderTopColor: c.adminLine, paddingTop: 8 }}>
        {[['Câu hỏi', d.questions.total], ['Bộ đề', d.quizzes], ['Tư liệu AI', d.ai_chunks]].map(([label, value]) => <Txt key={label} size={11} color={c.muc3}>{label}: <Txt f="bold" size={11} color={c.muc2}>{fmt(Number(value))}</Txt></Txt>)}
      </View>
    </>}
  </Card>;
}

/** Hoạt động học tập trong kỳ: bốn số liệu, mỗi số có thanh so với số lớn nhất. */
export function UsageCard({ d, days }: { d: Usage | null; days: number }) {
  const { c } = useTheme();
  const rows = d ? [
    { label: 'Bài học hoàn thành', value: d.totals.lessons, icon: BookOpen, color: BLUE },
    { label: 'Lượt làm quiz', value: d.totals.quizzes, icon: GraduationCap, color: PURPLE },
    { label: 'Trận đánh, mini-game', value: d.totals.battles, icon: Swords, color: RED },
    { label: 'Phòng thi đấu', value: d.totals.rooms, icon: Trophy, color: GOLD },
  ] : [];
  const top = Math.max(1, ...rows.map((r) => r.value));
  return <Card flat pad={12} style={cardStyle} testID="dashboard-usage">
    <Title title="Sử dụng học tập" note={`${days} ngày gần nhất`} />
    {!d ? <Waiting text="Đang tải hoạt động học tập…" /> : rows.map(({ label, value, icon: Icon, color }) => <View key={label} accessible accessibilityLabel={`${label}: ${value}`} style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon size={15} color={color} /><Txt size={12} color={c.muc2} style={{ flex: 1 }}>{label}</Txt><Txt f="bold" size={13}>{fmt(value)}</Txt></View>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: c.adminLine }}><View style={{ width: `${(100 * value) / top}%`, height: 4, borderRadius: 2, backgroundColor: color }} /></View>
    </View>)}
  </Card>;
}

/** Trợ lý AI Tiểu Tướng: số câu hỏi, người dùng, token, chi phí ước tính và các tư liệu được hỏi nhiều (kiểu bảng xếp hạng). */
export function AiCard({ d, days, topN }: { d: AiUsage | null; days: number; topN: number }) {
  const { c } = useTheme();
  const priced = !!d && (d.price.price_in > 0 || d.price.price_out > 0);
  const stats = d ? [
    ['Câu hỏi', fmt(d.questions)],
    ['Người dùng AI', fmt(d.users)],
    ['Token đã dùng', fmt(d.tokens_in + d.tokens_out)],
    ['Chi phí ước tính', priced ? `${d.cost_usd.toLocaleString('vi-VN', { maximumFractionDigits: 4 })} USD` : 'Chưa có giá'],
  ] : [];
  const top = Math.max(1, ...(d?.topics ?? []).map((t) => t.asked));
  return <Card flat pad={12} style={cardStyle} testID="dashboard-ai">
    <Title title="Trợ lý AI Tiểu Tướng" note={`${days} ngày gần nhất`} right={<Brain size={15} color={PURPLE} />} />
    {!d ? <Waiting text="Đang tải thống kê AI…" /> : <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 6 }}>
        {stats.map(([label, value]) => <View key={label} style={{ flexBasis: '45%', flexGrow: 1, minWidth: 0 }}><Txt size={10} color={c.muc3} numberOfLines={1}>{label}</Txt><Txt f="bold" size={14} numberOfLines={1}>{value}</Txt></View>)}
      </View>
      <View style={{ borderTopWidth: 1, borderTopColor: c.adminLine, paddingTop: 8, gap: 6 }}>
        <Txt f="bold" size={11} color={c.muc3}>Tư liệu được hỏi nhiều</Txt>
        {!d.topics.length ? <Txt size={12} color={c.muc3}>Chưa có câu hỏi được trả lời bằng tư liệu.</Txt> : d.topics.slice(0, topN).map((topic, i) => <View key={`${topic.kind}-${topic.id}`} accessible accessibilityLabel={`Hạng ${i + 1}: ${topic.title}, ${topic.asked} lượt hỏi`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c.adminCanvas, alignItems: 'center', justifyContent: 'center' }}><Txt f="bold" size={11} color={c.muc2}>{i + 1}</Txt></View>
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <Txt size={12} numberOfLines={1}>{topic.title}</Txt>
            <View style={{ height: 3, borderRadius: 2, backgroundColor: c.adminLine }}><View style={{ width: `${(100 * topic.asked) / top}%`, height: 3, borderRadius: 2, backgroundColor: PURPLE }} /></View>
          </View>
          <Txt f="bold" size={12}>{fmt(topic.asked)}</Txt>
        </View>)}
      </View>
    </>}
  </Card>;
}
