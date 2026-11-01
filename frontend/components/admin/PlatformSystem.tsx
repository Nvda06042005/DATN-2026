/**
 * Quản trị hệ thống cho quản trị tổng (Sprint 11): cấu hình chung và giới hạn tần suất (HK.AD.065, HK.SYS.018), bật / tắt tính năng (HK.AD.071), mẫu thư (HK.AD.068),
 * giới hạn theo trường (HK.AD.017), ma trận phân quyền (HK.AD.026), giám sát tình trạng (HK.AD.010) và sao lưu / phục hồi (HK.AD.072, HK.SYS.019).
 * Quản trị tổng cấp 2 chỉ xem các mục cấu hình hệ thống; máy chủ kiểm tra lại quyền ở mọi thao tác.
 */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Database, Plus, RefreshCw, RotateCcw, Save, Trash2 } from 'lucide-react-native';
import * as admin from '@/api/adminApi';
import * as api from '@/api/platformApi';
import { AdminSelect } from '@/components/admin/AdminSelect';
import { Cell, DataTable, DownloadButton, ErrorNote, FilterBar, FilterBox, Page, PageHeader, StatusChip, useAction, useLoad } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { StatGrid, StatTile } from '@/components/charts';
import { Btn, Card, Chip, ConfirmSheet, Field, InfoNote, Segmented, Sheet, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { BackupItem, MessageTemplate, Role } from '@/types/platform';

type Part = 'general' | 'flags' | 'templates' | 'limits' | 'rbac' | 'health' | 'backup';
const PARTS: Array<{ value: Part; label: string }> = [
  { value: 'general', label: 'Cấu hình chung' }, { value: 'flags', label: 'Tính năng' }, { value: 'templates', label: 'Mẫu thư' }, { value: 'limits', label: 'Giới hạn trường' },
  { value: 'rbac', label: 'Phân quyền' }, { value: 'health', label: 'Giám sát' }, { value: 'backup', label: 'Sao lưu' },
];
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }) : '—');
const ROLE_TEXT: Record<Role, string> = { student: 'Học sinh', teacher: 'Giáo viên', school_admin: 'QTV trường', root_admin: 'QTV tổng' };
const bytes = (n: number): string => (n >= 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const duration = (s: number): string => (s >= 86_400 ? `${Math.floor(s / 86_400)} ngày ${Math.floor((s % 86_400) / 3600)} giờ` : s >= 3600 ? `${Math.floor(s / 3600)} giờ ${Math.floor((s % 3600) / 60)} phút` : `${Math.floor(s / 60)} phút`);

const LevelNote: React.FC<{ session: Session }> = ({ session }) => (session.user.admin_level === 1 ? null : <InfoNote><Txt size={14}>Tài khoản quản trị tổng cấp 2 chỉ được xem phần này; chỉ cấp 1 được thay đổi cấu hình hệ thống.</Txt></InfoNote>);

// ---------------------------------------------------------------------- cấu hình chung
const General: React.FC<{ session: Session }> = ({ session }) => {
  const cfg = useLoad(() => api.settings(session.token), [session.token], session.expired);
  const { busy, run } = useAction(session.expired);
  const [f, setF] = useState<Record<string, string>>({});
  const [backupOn, setBackupOn] = useState(true);
  const can = session.user.admin_level === 1;
  useEffect(() => {
    const d = cfg.data;
    if (d) { setF({ system_name: d.system_name, logo_url: d.logo_url ?? '', mail_from: d.mail_from ?? '', timezone: d.timezone, rate_ip_per_min: d.rate_ip_per_min?.toString() ?? '', rate_user_per_min: d.rate_user_per_min?.toString() ?? '', rate_ai_per_min: d.rate_ai_per_min?.toString() ?? '', backup_hour: String(d.backup_hour), backup_keep: String(d.backup_keep) }); setBackupOn(d.backup_enabled); }
  }, [cfg.data]);
  const num = (v: string): number | null => (v.trim() === '' ? null : Number(v));
  const save = async () => {
    const out = await run(() => api.saveSettings(session.token, {
      system_name: f.system_name, logo_url: f.logo_url.trim() || null, mail_from: f.mail_from.trim() || null, timezone: f.timezone, rate_ip_per_min: num(f.rate_ip_per_min), rate_user_per_min: num(f.rate_user_per_min), rate_ai_per_min: num(f.rate_ai_per_min),
      backup_enabled: backupOn, backup_hour: Number(f.backup_hour), backup_keep: Number(f.backup_keep),
    }), 'Đã lưu cấu hình');
    if (out) cfg.setData(out);
  };
  const field = (key: string, label: string, extra: Partial<React.ComponentProps<typeof Field>> = {}) => (
    <View style={{ flexGrow: 1, flexBasis: 260, minWidth: 220 }}><Field label={label} value={f[key] ?? ''} onChangeText={(v) => setF({ ...f, [key]: v })} editable={can} nativeID={`cfg-${key}`} {...extra} /></View>
  );
  return (
    <View style={{ gap: 14 }}>
      <LevelNote session={session} />
      <ErrorNote message={cfg.error} />
      {cfg.loading && !cfg.data ? <Spinner /> : null}
      {cfg.data ? (
        <>
          <Card pad={14} style={{ gap: 12 }}>
            <Txt f="bold" size={16} accessibilityRole="header">Thông tin chung</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {field('system_name', 'Tên hệ thống')}
              {field('logo_url', 'Logo (liên kết https, không bắt buộc)', { autoCapitalize: 'none' })}
              {field('mail_from', 'Địa chỉ gửi thư (trống = dùng biến môi trường MAIL_FROM)', { autoCapitalize: 'none', placeholder: 'Đông A EDU <no-reply@ten-mien.vn>' })}
              {field('timezone', 'Múi giờ (IANA)', { autoCapitalize: 'none', hint: 'Dùng cho giờ nhắc học và giờ sao lưu. Ngôn ngữ hiện chỉ có tiếng Việt.' })}
            </View>
          </Card>
          <Card pad={14} style={{ gap: 12 }}>
            <Txt f="bold" size={16} accessibilityRole="header">Giới hạn tần suất gọi API (mỗi phút)</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {field('rate_ip_per_min', 'Theo địa chỉ IP (10–100000)', { keyboardType: 'numeric', placeholder: 'Mặc định 600' })}
              {field('rate_user_per_min', 'Theo người dùng (10–100000)', { keyboardType: 'numeric', placeholder: 'Mặc định 300' })}
              {field('rate_ai_per_min', 'Câu hỏi AI mỗi người (1–1000)', { keyboardType: 'numeric', placeholder: 'Mặc định 20' })}
            </View>
            <Txt size={12}>Để trống để dùng mặc định của máy chủ. Vượt giới hạn, người dùng nhận mã 429 kèm số giây phải chờ.</Txt>
          </Card>
          <Card pad={14} style={{ gap: 12 }}>
            <Txt f="bold" size={16} accessibilityRole="header">Sao lưu tự động hằng ngày</Txt>
            <Segmented<'on' | 'off'> label="Sao lưu tự động" value={backupOn ? 'on' : 'off'} onChange={(v) => can && setBackupOn(v === 'on')} options={[{ value: 'on', label: 'Bật' }, { value: 'off', label: 'Tắt' }]} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {field('backup_hour', 'Giờ sao lưu (0–23, theo múi giờ hệ thống)', { keyboardType: 'numeric' })}
              {field('backup_keep', 'Số bản tự động giữ lại (1–30)', { keyboardType: 'numeric' })}
            </View>
          </Card>
          {can ? <View style={{ flexDirection: 'row' }}><Btn icon={Save} title="Lưu cấu hình" tone="son" loading={busy} onPress={save} testID="cfg-save" /></View> : null}
        </>
      ) : null}
    </View>
  );
};

// ---------------------------------------------------------------------- cờ tính năng
const Flags: React.FC<{ session: Session }> = ({ session }) => {
  const { c } = useTheme();
  const list = useLoad(() => api.flags(session.token), [session.token], session.expired);
  const { busy, run } = useAction(session.expired);
  const can = session.user.admin_level === 1;
  return (
    <View style={{ gap: 12 }}>
      <LevelNote session={session} />
      <InfoNote><Txt size={14}>Tắt một tính năng là tắt ngay cho mọi học sinh và giáo viên (máy chủ trả lời “đang tạm tắt”); dữ liệu không bị mất, bật lại là dùng tiếp.</Txt></InfoNote>
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner /> : null}
      {list.data?.map((fl) => (
        <Card key={fl.key} flat pad={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <View style={{ flex: 1, minWidth: 220 }}>
            <Txt f="bold" size={15}>{fl.label}</Txt>
            <Txt size={13} color={c.muc2}>{fl.description}</Txt>
          </View>
          <StatusChip kind={fl.enabled ? 'on' : 'off'} text={fl.enabled ? 'Đang bật' : 'Đang tắt'} />
          {can ? <Btn title={fl.enabled ? 'Tắt' : 'Bật'} tone={fl.enabled ? 'giay' : 'ngoc'} size="sm" loading={busy} onPress={async () => { if (await run(() => api.setFlag(session.token, fl.key, !fl.enabled), fl.enabled ? `Đã tắt “${fl.label}”` : `Đã bật “${fl.label}”`)) list.reload(); }} testID={`flag-${fl.key}`} /> : null}
        </Card>
      ))}
    </View>
  );
};

// ---------------------------------------------------------------------- mẫu thư
const TemplateSheet: React.FC<{ session: Session; tpl: MessageTemplate; onClose: () => void; onSaved: () => void }> = ({ session, tpl, onClose, onSaved }) => {
  const { c } = useTheme();
  const { busy, run } = useAction(session.expired);
  const [subject, setSubject] = useState(tpl.subject);
  const [body, setBody] = useState(tpl.body);
  const save = async () => { if (await run(() => api.saveTemplate(session.token, tpl.key, { subject, body }), 'Đã lưu mẫu')) { onSaved(); onClose(); } };
  const reset = async () => { if (await run(() => api.resetTemplate(session.token, tpl.key), 'Đã quay về mẫu mặc định')) { onSaved(); onClose(); } };
  return (
    <Sheet open onClose={onClose} wide title={`Mẫu: ${tpl.label}`} subtitle={tpl.description}
      footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
        {tpl.customized ? <Btn icon={RotateCcw} title="Về mặc định" tone="giay" loading={busy} onPress={reset} /> : null}
        <Btn title="Hủy" tone="giay" onPress={onClose} /><Btn icon={Save} title="Lưu mẫu" tone="son" loading={busy} onPress={save} testID="tpl-save" /></View>}>
      <View style={{ gap: 12 }}>
        {tpl.subject_editable ? <Field label="Tiêu đề thư" value={subject} onChangeText={setSubject} maxLength={160} nativeID="tpl-subject" /> : <InfoNote><Txt size={13}>Tiêu đề thư tài khoản do chức năng tạo tài khoản đặt nên chỉ chỉnh được nội dung.</Txt></InfoNote>}
        <Field label="Nội dung" value={body} onChangeText={setBody} multiline numberOfLines={9} maxLength={3000} inputStyle={{ minHeight: 190, textAlignVertical: 'top' }} nativeID="tpl-body" />
        <View style={{ gap: 6 }}>
          <Txt f="bold" size={14}>Chỗ trống có thể dùng</Txt>
          {tpl.vars.map((v) => <Txt key={v.name} size={13} color={c.muc2}><Txt f="bold" size={13}>{`{{${v.name}}}`}</Txt> – {v.hint}</Txt>)}
        </View>
      </View>
    </Sheet>
  );
};

const Templates: React.FC<{ session: Session }> = ({ session }) => {
  const list = useLoad(() => api.templates(session.token), [session.token], session.expired);
  const [open, setOpen] = useState<MessageTemplate | null>(null);
  return (
    <View style={{ gap: 12 }}>
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner /> : null}
      {list.data ? (
        <DataTable<MessageTemplate> rows={list.data} rowKey={(t) => t.key} empty="Không có mẫu." onRowPress={setOpen}
          columns={[
            { key: 'label', label: 'Mẫu', flex: 1.4, render: (t) => <Cell main={t.label} sub={t.description} /> },
            { key: 'subject', label: 'Tiêu đề', flex: 1.6, render: (t) => <Txt size={13}>{t.subject}</Txt> },
            { key: 'state', label: 'Trạng thái', render: (t) => <StatusChip kind={t.customized ? 'info' : 'muted'} text={t.customized ? 'Đã chỉnh' : 'Mặc định'} /> },
          ]} actions={(t) => <Btn title="Sửa" tone="giay" size="sm" onPress={() => setOpen(t)} testID={`tpl-${t.key}`} />} actionsWidth={90} />
      ) : null}
      {open ? <TemplateSheet session={session} tpl={open} onClose={() => setOpen(null)} onSaved={() => list.reload()} /> : null}
    </View>
  );
};

// ---------------------------------------------------------------------- giới hạn theo trường
const Limits: React.FC<{ session: Session }> = ({ session }) => {
  const schools = useLoad(() => admin.listSchools(session.token, { limit: 100 }), [session.token], session.expired);
  const [schoolId, setSchoolId] = useState<number | null>(null);
  const id = schoolId ?? schools.data?.items[0]?.id ?? null;
  const lim = useLoad(() => (id ? api.schoolLimits(session.token, id) : Promise.resolve(null)), [session.token, id], session.expired);
  const { busy, run } = useAction(session.expired);
  const [f, setF] = useState({ max_students: '', ai_daily_per_school: '', ai_daily_per_user: '' });
  const [aiOn, setAiOn] = useState(true);
  useEffect(() => { const d = lim.data; if (d) { setF({ max_students: d.max_students?.toString() ?? '', ai_daily_per_school: d.ai_daily_per_school?.toString() ?? '', ai_daily_per_user: d.ai_daily_per_user?.toString() ?? '' }); setAiOn(d.ai_enabled); } }, [lim.data]);
  const num = (v: string): number | null => (v.trim() === '' ? null : Number(v));
  const save = async () => { if (!id) return; const out = await run(() => api.saveSchoolLimits(session.token, id, { max_students: num(f.max_students), ai_enabled: aiOn, ai_daily_per_school: num(f.ai_daily_per_school), ai_daily_per_user: num(f.ai_daily_per_user) }), 'Đã lưu giới hạn của trường'); if (out) lim.setData(out); };
  return (
    <View style={{ gap: 12 }}>
      <ErrorNote message={schools.error ?? lim.error} />
      <FilterBar><FilterBox flex={2}><AdminSelect<number> label="Trường" value={id ?? 0} options={(schools.data?.items ?? []).map((s) => ({ value: s.id, label: s.name }))} onChange={setSchoolId} testID="limits-school" /></FilterBox></FilterBar>
      {lim.loading && !lim.data ? <Spinner /> : null}
      {lim.data ? (
        <Card pad={14} style={{ gap: 12 }}>
          <Txt size={14}>Trường đang có <Txt f="bold" size={14}>{lim.data.students}</Txt> học sinh.</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <View style={{ flexGrow: 1, flexBasis: 240 }}><Field label="Số học sinh tối đa (trống = không giới hạn)" value={f.max_students} onChangeText={(v) => setF({ ...f, max_students: v })} keyboardType="numeric" nativeID="lim-max" /></View>
            <View style={{ flexGrow: 1, flexBasis: 240 }}><Field label={`Hạn mức AI của trường mỗi ngày (mặc định ${lim.data.ai_daily_per_school_default ?? '–'})`} value={f.ai_daily_per_school} onChangeText={(v) => setF({ ...f, ai_daily_per_school: v })} keyboardType="numeric" /></View>
            <View style={{ flexGrow: 1, flexBasis: 240 }}><Field label={`Hạn mức AI mỗi người mỗi ngày (mặc định ${lim.data.ai_daily_per_user_default ?? '–'})`} value={f.ai_daily_per_user} onChangeText={(v) => setF({ ...f, ai_daily_per_user: v })} keyboardType="numeric" /></View>
          </View>
          <Segmented<'on' | 'off'> label="AI Tutor cho trường này" value={aiOn ? 'on' : 'off'} onChange={(v) => setAiOn(v === 'on')} options={[{ value: 'on', label: 'Bật AI' }, { value: 'off', label: 'Tắt AI' }]} />
          <View style={{ flexDirection: 'row' }}><Btn icon={Save} title="Lưu giới hạn" tone="son" loading={busy} onPress={save} testID="lim-save" /></View>
        </Card>
      ) : null}
    </View>
  );
};

// ---------------------------------------------------------------------- phân quyền
const Rbac: React.FC<{ session: Session }> = ({ session }) => {
  const { c } = useTheme();
  const m = useLoad(() => api.rbac(session.token), [session.token], session.expired);
  const { busy, run } = useAction(session.expired);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const can = session.user.admin_level === 1;
  const key = (f: string, r: Role) => `${f}:${r}`;
  const changes = Object.entries(pending).map(([k, allowed]) => ({ feature_key: k.split(':')[0], role: k.split(':')[1], allowed }));
  const save = async () => { const out = await run(() => api.saveRbac(session.token, changes), 'Đã lưu phân quyền'); if (out) { m.setData(out); setPending({}); } };
  return (
    <View style={{ gap: 12 }}>
      <LevelNote session={session} />
      <InfoNote><Txt size={14}>Ma trận theo đặc tả (38 nhóm chức năng). Các dòng có chấm “Đã nối” được máy chủ kiểm tra thật và có thể tắt quyền của từng vai trò; các dòng còn lại là quyền cố định trong mã nguồn (chỉ xem). Chỉ thu hẹp hoặc khôi phục được, không cấp thêm quyền ngoài đặc tả.</Txt></InfoNote>
      <ErrorNote message={m.error} />
      {m.loading && !m.data ? <Spinner /> : null}
      {m.data ? (
        <Card flat pad={0} style={{ overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: c.adminCanvas, gap: 6 }}>
            <Txt f="bold" size={12} style={{ flex: 1 }}>Nhóm chức năng</Txt>
            {m.data.roles.map((r) => <Txt key={r} f="bold" size={12} style={{ width: 74, textAlign: 'center' }}>{ROLE_TEXT[r]}</Txt>)}
          </View>
          {m.data.features.map((f, i) => (
            <View key={f.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, minHeight: 48, borderTopWidth: i ? 1 : 0, borderTopColor: c.adminLine, backgroundColor: f.enforced ? c.the : c.adminCanvas }}>
              <View style={{ flex: 1, paddingVertical: 6 }}>
                <Txt size={13} f={f.enforced ? 'semibold' : 'body'}>{f.position}. {f.label}</Txt>
                {f.enforced ? <Txt size={11} color={c.ngocChu}>Đã nối vào kiểm tra của máy chủ</Txt> : f.note ? <Txt size={11} color={c.muc3}>{f.note}</Txt> : null}
              </View>
              {m.data!.roles.map((r) => {
                const cell = f.cells[r];
                const value = pending[key(f.key, r)] ?? cell.allowed;
                const editable = can && cell.editable;
                return (
                  <View key={r} style={{ width: 74, alignItems: 'center' }}>
                    {editable ? (
                      <Btn title={value ? 'Có' : 'Không'} label={`${f.label} cho ${ROLE_TEXT[r]}: ${value ? 'được phép' : 'không được phép'}. Bấm để đổi`} tone={value ? 'ngoc' : 'giay'} size="sm" onPress={() => setPending({ ...pending, [key(f.key, r)]: !value })} testID={`rbac-${f.key}-${r}`} />
                    ) : <Txt size={13} color={value ? c.ngocChu : c.muc3} accessibilityLabel={`${f.label} cho ${ROLE_TEXT[r]}: ${value ? 'được phép' : 'không được phép'}`}>{value ? '✔' : '–'}</Txt>}
                  </View>
                );
              })}
            </View>
          ))}
        </Card>
      ) : null}
      {can && changes.length ? <View style={{ flexDirection: 'row', gap: 8 }}><Btn icon={Save} title={`Lưu ${changes.length} thay đổi`} tone="son" loading={busy} onPress={save} testID="rbac-save" /><Btn title="Bỏ thay đổi" tone="giay" onPress={() => setPending({})} /></View> : null}
    </View>
  );
};

// ---------------------------------------------------------------------- giám sát
const Health: React.FC<{ session: Session }> = ({ session }) => {
  const { c } = useTheme();
  const h = useLoad(() => api.health(session.token), [session.token], session.expired);
  useEffect(() => { const t = setInterval(() => h.reload(), 30_000); return () => clearInterval(t); }, [h.reload]); // eslint-disable-line react-hooks/exhaustive-deps
  const d = h.data;
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Txt size={13} color={c.muc3}>{d ? `Cập nhật lúc ${when(d.checked_at)}; tự làm mới sau 30 giây` : ''}</Txt>
        <Btn icon={RefreshCw} title="Làm mới" tone="giay" size="sm" loading={h.loading} onPress={() => h.reload()} testID="health-refresh" />
      </View>
      <ErrorNote message={h.error} />
      {h.loading && !d ? <Spinner /> : null}
      {d ? (
        <>
          <StatGrid>
            <StatTile label="Cơ sở dữ liệu" value={d.database.ok ? 'Bình thường' : 'Lỗi'} hint={`${d.database.latency_ms} ms · schema ${d.database.schema_version ?? '–'}`} tone={d.database.ok ? 'ngoc' : 'son'} />
            <StatTile label="Máy chủ chạy được" value={duration(d.server.uptime_s)} hint={`${d.server.memory_mb} MB · ${d.server.node}${d.server.commit ? ` · ${d.server.commit.slice(0, 7)}` : ''}`} />
            <StatTile label="Người dùng hoạt động (15 phút)" value={d.active_users_15m} tone="thuy" />
            <StatTile label={`Yêu cầu (${d.requests.window_min} phút)`} value={d.requests.total} hint={`${d.requests.client_errors} lỗi 4xx · ${d.requests.server_errors} lỗi 5xx · ${d.requests.rate_limited} bị chặn`} tone={d.requests.server_errors ? 'son' : undefined} />
            <StatTile label="Lỗi trong 24 giờ" value={d.errors.day} hint={`${d.errors.hour} trong giờ qua`} tone={d.errors.hour ? 'vang' : 'ngoc'} />
            <StatTile label="Hàng đợi thư" value={d.mail.configured ? d.mail.queued : 'Chưa cấu hình'} hint={`${d.mail.sending} đang gửi · ${d.mail.failed_day} lỗi 24 giờ${d.mail.oldest_min ? ` · cũ nhất ${d.mail.oldest_min} phút` : ''} · ${d.mail.transport}`} tone={d.mail.failed_day ? 'son' : undefined} />
          </StatGrid>
          <Txt f="bold" size={15} accessibilityRole="header">Việc nền</Txt>
          <DataTable rows={d.jobs} rowKey={(j) => j.job} empty="Chưa có nhịp việc nền nào (việc chạy theo chu kỳ, vài phút đầu có thể trống)."
            columns={[
              { key: 'job', label: 'Việc', render: (j) => <Txt f="semibold" size={14}>{j.job}</Txt> },
              { key: 'ok', label: 'Kết quả', render: (j) => <StatusChip kind={j.last_ok ? 'on' : 'off'} text={j.last_ok ? 'Tốt' : 'Lỗi'} /> },
              { key: 'age', label: 'Chạy lần cuối', render: (j) => <Txt size={13}>{j.age_min < 1 ? 'Vừa xong' : `${j.age_min} phút trước`}</Txt> },
              { key: 'runs', label: 'Số lần', render: (j) => <Txt size={13}>{j.runs}</Txt> },
              { key: 'err', label: 'Ghi chú', flex: 2, render: (j) => <Txt size={12} color={c.sonChu}>{j.last_error ?? ''}</Txt> },
            ]} />
        </>
      ) : null}
    </View>
  );
};

// ---------------------------------------------------------------------- sao lưu
const Backups: React.FC<{ session: Session }> = ({ session }) => {
  const list = useLoad(() => api.backups(session.token), [session.token], session.expired);
  const { busy, run } = useAction(session.expired);
  const [label, setLabel] = useState('');
  const [restore, setRestore] = useState<BackupItem | null>(null);
  const [phrase, setPhrase] = useState('');
  const [remove, setRemove] = useState<BackupItem | null>(null);
  const can = session.user.admin_level === 1;
  const KIND = { manual: 'Thủ công', auto: 'Tự động', pre_restore: 'Trước khi phục hồi' } as const;
  return (
    <View style={{ gap: 12 }}>
      <LevelNote session={session} />
      <InfoNote><Txt size={14}>Bản sao lưu nằm trong cùng cơ sở dữ liệu nên chỉ bảo vệ khi thao tác nhầm; hãy tải về để cất nơi khác. Phục hồi sẽ ghi đè toàn bộ dữ liệu bằng bản đã chọn (có tạo bản an toàn trước đó) và có thể buộc mọi người đăng nhập lại.</Txt></InfoNote>
      <ErrorNote message={list.error} />
      {can ? (
        <Card flat pad={12} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
          <View style={{ flexGrow: 1, flexBasis: 240 }}><Field label="Ghi chú cho bản sao lưu (không bắt buộc)" value={label} onChangeText={setLabel} maxLength={120} nativeID="backup-label" /></View>
          <Btn icon={Plus} title="Sao lưu ngay" tone="son" loading={busy} onPress={async () => { if (await run(() => api.createBackup(session.token, label.trim() || undefined), 'Đã tạo bản sao lưu')) { setLabel(''); list.reload(); } }} testID="backup-create" />
        </Card>
      ) : null}
      {list.loading && !list.data ? <Spinner /> : null}
      {list.data ? (
        <>
          <Txt size={13}>{list.data.items.length} bản · tổng {bytes(list.data.total_bytes)}</Txt>
          <DataTable<BackupItem> rows={list.data.items} rowKey={(b) => b.id} empty="Chưa có bản sao lưu nào."
            columns={[
              { key: 'time', label: 'Thời điểm', flex: 1.3, render: (b) => <Cell main={when(b.created_at)} sub={b.label ?? undefined} /> },
              { key: 'kind', label: 'Loại', render: (b) => <Chip text={KIND[b.kind]} bg="#eef2ff" fg="#3730a3" /> },
              { key: 'size', label: 'Dung lượng', render: (b) => <Txt size={13}>{bytes(b.size_bytes)}</Txt> },
              { key: 'rows', label: 'Dữ liệu', render: (b) => <Txt size={13}>{b.table_count} bảng · {b.row_count.toLocaleString('vi-VN')} dòng</Txt> },
              { key: 'by', label: 'Người tạo', render: (b) => <Txt size={13}>{b.created_by_name ?? 'Hệ thống'}</Txt> },
            ]}
            actions={(b) => (
              <>
                <DownloadButton title="Tải" fetchBlob={() => api.downloadBackup(session.token, b.id)} filename={`sao-luu-${b.id}.json.gz`} />
                {can ? <Btn icon={Database} title="Phục hồi" tone="giay" size="sm" onPress={() => { setRestore(b); setPhrase(''); }} testID={`backup-restore-${b.id}`} /> : null}
                {can ? <Btn icon={Trash2} label={`Xóa bản sao lưu ${b.id}`} tone="giay" size="sm" onPress={() => setRemove(b)} /> : null}
              </>
            )} actionsWidth={250} />
        </>
      ) : null}
      {restore ? (
        <Sheet open onClose={() => setRestore(null)} title="Phục hồi dữ liệu" subtitle={`Bản ${when(restore.created_at)}`}
          footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}><Btn title="Hủy" tone="giay" onPress={() => setRestore(null)} /><Btn icon={Database} title="Phục hồi" tone="son" loading={busy} disabled={phrase.trim().toUpperCase() !== 'PHUC HOI'} testID="backup-restore-confirm"
            onPress={async () => { const r = await run(() => api.restoreBackup(session.token, restore.id, phrase), 'Đã phục hồi dữ liệu'); if (r) { setRestore(null); list.reload(); } }} /></View>}>
          <View style={{ gap: 12 }}>
            <InfoNote><Txt size={14}>Toàn bộ dữ liệu hiện tại ({'tài khoản, lớp, tiến độ, điểm, nội dung…'}) sẽ bị thay bằng dữ liệu của bản này. Hệ thống tự tạo một bản “trước khi phục hồi” để quay lại nếu cần.</Txt></InfoNote>
            <Field label='Gõ "PHUC HOI" để xác nhận' value={phrase} onChangeText={setPhrase} autoCapitalize="characters" nativeID="backup-phrase" />
          </View>
        </Sheet>
      ) : null}
      <ConfirmSheet open={Boolean(remove)} title="Xóa bản sao lưu?" message="Bản sao lưu này sẽ bị xóa vĩnh viễn." confirmLabel="Xóa" tone="son" busy={busy} onCancel={() => setRemove(null)}
        onConfirm={async () => { const b = remove!; if (await run(() => api.deleteBackup(session.token, b.id), 'Đã xóa bản sao lưu')) { setRemove(null); list.reload(); } }} />
    </View>
  );
};

export const SystemAdmin: React.FC<{ session: Session }> = ({ session }) => {
  const [part, setPart] = useState<Part>('general');
  return (
    <Page>
      <PageHeader title="Hệ thống" subtitle="Cấu hình chung, tính năng, mẫu thư, giới hạn trường, phân quyền, giám sát và sao lưu" />
      <Segmented<Part> label="Quản trị hệ thống" value={part} onChange={setPart} options={PARTS} />
      {part === 'general' ? <General session={session} /> : part === 'flags' ? <Flags session={session} /> : part === 'templates' ? <Templates session={session} /> : part === 'limits' ? <Limits session={session} />
        : part === 'rbac' ? <Rbac session={session} /> : part === 'health' ? <Health session={session} /> : <Backups session={session} />}
    </Page>
  );
};
