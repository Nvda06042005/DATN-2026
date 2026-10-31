/**
 * TM.SA-CONTENT.006 (quản trị tổng): sức khỏe hệ thống và nhật ký hợp nhất (đăng nhập, thao tác, lỗi nhập Excel, lỗi gửi thư).
 * Chỉ đọc dữ liệu có sẵn; không hiện mật khẩu, token, nội dung thư hay địa chỉ email.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import * as api from '@/api/adminApi';
import { errorMessage } from '@/api/client';
import type { Session } from '@/components/auth';
import { useFail } from '@/components/provisioning';
import { Btn, Card, Chip, EmptyState, Field, Inset, Segmented, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { formatDateTime } from '@/lib/format';
import type { EventKind, EventLevel, SystemEventsPage, SystemHealth } from '@/types/api';
import { AdminSelect } from './AdminSelect';
import { Pager } from './SchoolManagement';

const KIND_TEXT: Record<EventKind, string> = { login: 'Đăng nhập', audit: 'Thao tác', import: 'Lỗi nhập Excel', mail: 'Lỗi gửi thư' };
const LEVEL_TEXT: Record<EventLevel, string> = { info: 'Thông tin', warn: 'Cần chú ý', error: 'Lỗi' };
const ALL = 'all';
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const uptime = (s: number) => (s >= 86400 ? `${Math.floor(s / 86400)} ngày ${Math.floor((s % 86400) / 3600)} giờ` : s >= 3600 ? `${Math.floor(s / 3600)} giờ ${Math.floor((s % 3600) / 60)} phút` : `${Math.floor(s / 60)} phút`);

function Tile({ title, state, lines }: { title: string; state: 'ok' | 'warn' | 'error'; lines: string[] }) {
  const { c } = useTheme();
  const tone = state === 'ok' ? [c.ngocNhat, c.ngocChu, 'Bình thường'] : state === 'warn' ? [c.vangNhat, c.vangChu, 'Cần chú ý'] : [c.sonNhat, c.sonChu, 'Có lỗi'];
  return (
    <Card pad={16} style={{ gap: 8, flexGrow: 1, flexBasis: 240 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}><Txt f="bold" size={16}>{title}</Txt><Chip text={tone[2]} bg={tone[0]} fg={tone[1]} /></View>
      {lines.map((l) => <Txt key={l} size={13} color={c.muc2}>{l}</Txt>)}
    </Card>
  );
}

export function SystemLogs({ session }: { session: Session }) {
  const { c } = useTheme();
  const fail = useFail(session);
  const [health, setHealth] = useState<SystemHealth | null>(null), [healthError, setHealthError] = useState<string | null>(null), [checking, setChecking] = useState(false);
  const [from, setFrom] = useState(''), [to, setTo] = useState(''), [school, setSchool] = useState(ALL), [kind, setKind] = useState<EventKind | typeof ALL>(ALL), [level, setLevel] = useState<EventLevel | typeof ALL>(ALL);
  const [data, setData] = useState<SystemEventsPage | null>(null), [busy, setBusy] = useState(true), [error, setError] = useState<string | null>(null);
  const serial = useRef(0);
  const badDate = (from && !DAY.test(from)) || (to && !DAY.test(to));
  const checkHealth = useCallback(async () => {
    setChecking(true);
    try { setHealth(await api.getSystemHealth(session.token)); setHealthError(null); } catch (e) { setHealthError(errorMessage(e, 'Không kiểm tra được sức khỏe hệ thống.')); fail(e); } finally { setChecking(false); }
  }, [session.token, fail]);
  const load = useCallback(async (page = 1) => {
    if (badDate) return;
    const key = ++serial.current;
    setBusy(true);
    try {
      const v = await api.getSystemEvents(session.token, { from: from || undefined, to: to || undefined, school_id: school === ALL ? undefined : Number(school), kind: kind === ALL ? undefined : kind, level: level === ALL ? undefined : level, page, limit: 30 });
      if (key === serial.current) { setData(v); setError(null); }
    } catch (e) {
      if (key === serial.current) { setError(errorMessage(e, 'Không tải được nhật ký.')); fail(e); }
    } finally {
      if (key === serial.current) setBusy(false);
    }
  }, [session.token, from, to, school, kind, level, badDate, fail]);
  useEffect(() => { void checkHealth(); }, [checkHealth]);
  useEffect(() => { void load(); }, [load]);
  const h = health;
  const levelTone = (l: EventLevel) => (l === 'error' ? [c.sonNhat, c.sonChu] : l === 'warn' ? [c.vangNhat, c.vangChu] : [c.dichNhat, c.muc2]);
  return (
    <View testID="system-logs" style={{ gap: 16 }}>
      <Card pad={18} style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <View style={{ flexShrink: 1 }}><Txt f="bold" size={19}>Sức khỏe hệ thống</Txt><Txt size={13} color={c.muc3}>{h ? `Kiểm tra lúc ${formatDateTime(h.generated_at)}` : 'Đang kiểm tra các dịch vụ…'}</Txt></View>
          <Btn title="Kiểm tra lại" tone="giay" size="sm" loading={checking} onPress={checkHealth} />
        </View>
        {healthError && <Inset style={{ backgroundColor: c.sonNhat }}><Txt color={c.sonChu} accessibilityRole="alert">{healthError}</Txt></Inset>}
        {!h && !healthError ? <Spinner label="Đang kiểm tra…" /> : h && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <Tile title="Máy chủ API" state={h.api.status === 'ok' ? 'ok' : 'error'} lines={[`Chạy liên tục ${uptime(h.api.uptime_seconds)}`, `Phản hồi kiểm tra ${h.api.response_ms} ms`]} />
            <Tile title="Cơ sở dữ liệu" state={h.database.status === 'ok' ? (h.database.school_scope_rls ? 'ok' : 'warn') : 'error'} lines={[`Phiên bản schema ${h.database.schema_version} (${h.database.migrations} migration)`, h.database.school_scope_rls ? 'Đã bật cách ly dữ liệu theo trường (RLS)' : 'Chưa bật được RLS theo trường', h.database.pgvector ? 'Có pgvector' : 'Không có pgvector, đối chiếu dòng thiếu tính trong ứng dụng']} />
            <Tile title="Dịch vụ AI" state={h.ai.status === 'ok' ? 'ok' : 'error'} lines={h.ai.status === 'ok' ? [`Phản hồi ${h.ai.latency_ms} ms`] : ['Không phản hồi. Trên gói miễn phí dịch vụ có thể đang khởi động lại; trò chơi vẫn dùng ngân hàng câu hỏi có sẵn.']} />
            <Tile title="Gửi thư" state={h.mail.failed > 0 ? 'error' : h.mail.configured ? 'ok' : 'warn'} lines={[h.mail.configured ? (h.mail.worker ? 'Đã cấu hình, đang tự gửi' : 'Đã cấu hình, tự gửi đang tắt') : 'Chưa cấu hình gửi thư', `${h.mail.queued} đang chờ · ${h.mail.failed} thất bại · ${h.mail.sent_24h} đã gửi trong 24 giờ`]} />
            <Tile title="Nhập Excel (24 giờ)" state={h.imports.error_rows_24h > 0 ? 'warn' : 'ok'} lines={[`${h.imports.batches_24h} lần nhập · ${h.imports.error_rows_24h} dòng lỗi`, `${h.imports.open_incomplete} dòng thiếu thông tin chờ bổ sung`]} />
            <Tile title="Đăng nhập (24 giờ)" state={h.logins.locked_24h > 0 ? 'warn' : 'ok'} lines={[`${h.logins.failed_24h} lần thất bại`, `${h.logins.locked_24h} lần bị giới hạn do thử quá nhiều`]} />
          </View>
        )}
      </Card>
      <Card pad={18} style={{ gap: 12 }}>
        <Txt f="bold" size={19}>Nhật ký sự kiện</Txt>
        <Txt size={13} color={c.muc3}>Gộp đăng nhập, thao tác quản trị, lỗi nhập Excel và lỗi gửi thư. Ngày tính theo giờ Việt Nam.</Txt>
        <Segmented label="Loại sự kiện" value={kind} onChange={setKind} options={[{ value: ALL, label: 'Tất cả' }, ...(Object.keys(KIND_TEXT) as EventKind[]).map((k) => ({ value: k, label: `${KIND_TEXT[k]}${data ? ` (${data.counts[k]})` : ''}` }))]} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <Field label="Từ ngày" value={from} onChangeText={setFrom} placeholder="2026-10-01" autoCapitalize="none" style={{ flexGrow: 1, flexBasis: 140 }} />
          <Field label="Đến ngày" value={to} onChangeText={setTo} placeholder="2026-10-31" autoCapitalize="none" style={{ flexGrow: 1, flexBasis: 140 }} />
          <View style={{ flexGrow: 2, flexBasis: 200 }}><AdminSelect label="Trường" value={school} onChange={setSchool} options={[{ value: ALL, label: 'Tất cả trường' }, ...(data?.schools ?? []).map((s) => ({ value: String(s.id), label: s.name }))]} /></View>
          <View style={{ flexGrow: 1, flexBasis: 150 }}><AdminSelect label="Mức độ" value={level} onChange={setLevel} options={[{ value: ALL, label: 'Tất cả mức' }, ...(Object.keys(LEVEL_TEXT) as EventLevel[]).map((l) => ({ value: l, label: LEVEL_TEXT[l] }))]} /></View>
        </View>
        {badDate && <Txt size={13} color={c.sonChu} accessibilityRole="alert">Ngày cần có dạng năm-tháng-ngày, ví dụ 2026-10-31.</Txt>}
      </Card>
      {error && <Txt color={c.sonChu} accessibilityRole="alert">{error}</Txt>}
      {!data && busy ? <Spinner label="Đang tải nhật ký…" /> : !data?.items.length ? <EmptyState title="Không có sự kiện phù hợp" text="Mở rộng khoảng thời gian hoặc bỏ bớt bộ lọc." /> : data.items.map((e, i) => (
        <Card key={`${e.created_at}-${i}`} pad={14} style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <Chip text={LEVEL_TEXT[e.level]} bg={levelTone(e.level)[0]} fg={levelTone(e.level)[1]} /><Chip text={KIND_TEXT[e.kind]} bg={c.adminTint} fg={c.son} />
            <Txt size={12} color={c.muc3}>{formatDateTime(e.created_at)}</Txt>
          </View>
          <Txt f="semibold" size={14}>{e.title}</Txt>
          {!!e.detail && <Txt size={13} color={c.muc2}>{e.detail}</Txt>}
          <Txt size={12} color={c.muc3}>{[e.actor, e.school_name].filter(Boolean).join(' · ') || 'Hệ thống'}</Txt>
        </Card>
      ))}
      {data && <Pager page={data.page} total={data.total} limit={data.limit} busy={busy} onPage={load} />}
    </View>
  );
}
