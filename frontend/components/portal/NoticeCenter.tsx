/**
 * Chuông thông báo và cài đặt cá nhân (Sprint 11): danh sách thông báo có số chưa đọc theo nhóm Hệ thống / Lớp học / Thành tích, đánh dấu đã đọc và xóa (HK.HS.106–107, HK.GV.077–078, HK.QT.053),
 * cài đặt giao diện sáng / tối lưu theo tài khoản (HK.HS.016) và nhắc học qua thông báo trên web hoặc email (HK.HS.015). Dùng chung cho mọi vai trò; máy chủ quyết định mọi dữ liệu.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Bell, Minus, Plus, Settings, Trash2 } from 'lucide-react-native';
import * as api from '@/api/platformApi';
import { ErrorNote, useAction, useLoad } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { Btn, Card, Chip, EmptyState, InfoNote, Segmented, Sheet, Spinner, ToggleRow, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { CATEGORY_TEXT, type NoticeCategory, type NoticeItem, type Prefs } from '@/types/platform';

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }) : '—');

// ---------------------------------------------------------------------- chuông thông báo
export const NoticeBell: React.FC<{ session: Session; refreshKey?: number; onGo?: (n: NoticeItem) => void }> = ({ session, refreshKey = 0, onGo }) => {
  const { c } = useTheme();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const poll = useCallback(() => { api.notices(session.token, { unread: true }).then((d) => setUnread(d.unread)).catch(() => undefined); }, [session.token]);
  useEffect(() => {
    poll();
    const timer = setInterval(poll, 60_000);
    return () => clearInterval(timer);
  }, [poll, refreshKey]);
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={unread ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'} onPress={() => setOpen(true)} testID="notice-bell"
        style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Bell size={22} color={unread ? c.son : c.muc2} />
        {unread ? <View style={{ position: 'absolute', top: 4, right: 2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: c.son, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}><Txt f="bold" size={11} color="#ffffff">{unread > 99 ? '99+' : unread}</Txt></View> : null}
      </Pressable>
      {open ? <NoticeSheet session={session} onClose={() => { setOpen(false); poll(); }} onGo={onGo} /> : null}
    </>
  );
};

const NoticeSheet: React.FC<{ session: Session; onClose: () => void; onGo?: (n: NoticeItem) => void }> = ({ session, onClose, onGo }) => {
  const { c } = useTheme();
  const [category, setCategory] = useState<'all' | NoticeCategory>('all');
  const list = useLoad(() => api.notices(session.token, { category: category === 'all' ? undefined : category }), [session.token, category], session.expired);
  const { busy, run } = useAction(session.expired);
  const items = list.data?.items ?? [];
  const by = list.data?.unread_by_category;
  const open = async (n: NoticeItem) => {
    if (!n.read_at) { await api.readNotices(session.token, [n.id]).catch(() => undefined); list.reload(); }
    if (onGo) { onClose(); onGo(n); }
  };
  const label = (key: 'all' | NoticeCategory, text: string) => { const n = key === 'all' ? by?.total : by?.[key]; return n ? `${text} (${n})` : text; };
  return (
    <Sheet open onClose={onClose} title="Thông báo" subtitle={list.data ? `${list.data.unread} chưa đọc` : undefined} wide
      footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
        <Btn title="Đánh dấu đã đọc tất cả" tone="giay" disabled={!list.data?.unread} loading={busy} onPress={async () => { if (await run(() => api.readNotices(session.token))) list.reload(); }} testID="notice-read-all" />
        <Btn title="Xóa thông báo đã đọc" tone="giay" loading={busy} onPress={async () => { if (await run(() => api.deleteNotices(session.token), 'Đã xóa các thông báo đã đọc')) list.reload(); }} testID="notice-delete-read" />
        <Btn title="Đóng" tone="ngoc" onPress={onClose} /></View>}>
      <Segmented<'all' | NoticeCategory> label="Nhóm thông báo" value={category} onChange={setCategory}
        options={[{ value: 'all', label: label('all', 'Tất cả') }, { value: 'system', label: label('system', CATEGORY_TEXT.system) }, { value: 'class', label: label('class', CATEGORY_TEXT.class) }, { value: 'achievement', label: label('achievement', CATEGORY_TEXT.achievement) }]} />
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner /> : null}
      {list.data && !items.length ? <EmptyState mood="thinking" title="Chưa có thông báo nào" text="Thông báo của lớp, hệ thống và thành tích sẽ hiện ở đây." /> : null}
      <View style={{ gap: 8, marginTop: 10 }}>
        {items.map((n) => (
          <View key={n.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, borderRadius: 12, borderWidth: 2, borderColor: n.read_at ? c.vien : c.thuy, backgroundColor: n.read_at ? c.the : c.thuyNhat }}>
            <Pressable accessibilityRole="button" accessibilityLabel={`${n.title}${n.read_at ? '' : ', chưa đọc'}`} onPress={() => open(n)} style={{ flex: 1, gap: 4, padding: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {!n.read_at ? <Chip text="Mới" bg={c.son} fg="#ffffff" /> : null}
                <Chip text={CATEGORY_TEXT[n.category]} bg={c.the2} fg={c.muc2} />
                {n.class_name ? <Chip text={n.class_name} bg={c.dichNhat} fg={c.dich} /> : null}
                <Txt size={12} color={c.muc3}>{when(n.created_at)}</Txt>
              </View>
              <Txt f="bold" size={15}>{n.title}</Txt>
              <Txt size={14} color={c.muc2}>{n.body}</Txt>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Xóa thông báo ${n.title}`} onPress={async () => { if (await run(() => api.deleteNotices(session.token, [n.id]))) list.reload(); }}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }} testID={`notice-delete-${n.id}`}>
              <Trash2 size={18} color={c.muc3} />
            </Pressable>
          </View>
        ))}
      </View>
    </Sheet>
  );
};

// ---------------------------------------------------------------------- cài đặt cá nhân (HK.HS.015, HK.HS.016)
export const SettingsButton: React.FC<{ session: Session; prefs: Prefs | null; onSaved: (p: Prefs) => void }> = ({ session, prefs, onSaved }) => {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel="Cài đặt giao diện và nhắc học" onPress={() => setOpen(true)} testID="settings-open" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Settings size={22} color={c.muc2} />
      </Pressable>
      {open ? <SettingsSheet session={session} initial={prefs} onClose={() => setOpen(false)} onSaved={onSaved} /> : null}
    </>
  );
};

const SettingsSheet: React.FC<{ session: Session; initial: Prefs | null; onClose: () => void; onSaved: (p: Prefs) => void }> = ({ session, initial, onClose, onSaved }) => {
  const { c } = useTheme();
  const loaded = useLoad(() => (initial ? Promise.resolve(initial) : api.prefs(session.token)), [session.token], session.expired);
  const { busy, run } = useAction(session.expired);
  const [draft, setDraft] = useState<Prefs | null>(null);
  const p = draft ?? loaded.data;
  const set = (patch: Partial<Prefs>) => p && setDraft({ ...p, ...patch });
  const save = async () => {
    if (!p) return;
    const out = await run(() => api.savePrefs(session.token, { theme: p.theme, reminder_enabled: p.reminder_enabled, reminder_hour: p.reminder_hour, reminder_channel: p.reminder_channel }), 'Đã lưu cài đặt');
    if (out) { onSaved(out); onClose(); }
  };
  return (
    <Sheet open onClose={onClose} title="Cài đặt" subtitle="Lưu theo tài khoản, dùng được trên mọi thiết bị"
      footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}><Btn title="Hủy" tone="giay" onPress={onClose} /><Btn title="Lưu" tone="ngoc" loading={busy} disabled={!p} onPress={save} testID="settings-save" /></View>}>
      <ErrorNote message={loaded.error} />
      {!p ? <Spinner /> : (
        <View style={{ gap: 16 }}>
          <View style={{ gap: 6 }}>
            <Txt f="bold" size={15} accessibilityRole="header">Giao diện</Txt>
            <Segmented<Prefs['theme']> label="Giao diện" value={p.theme} onChange={(theme) => set({ theme })} options={[{ value: 'light', label: 'Sáng' }, { value: 'dark', label: 'Tối' }, { value: 'system', label: 'Theo thiết bị' }]} />
            <Txt size={12} color={c.muc3}>Giao diện tối áp dụng cho trang học sinh; trang giáo viên và quản trị luôn dùng giao diện sáng.</Txt>
          </View>
          {p.can_remind ? (
            <View style={{ gap: 10 }}>
              <Txt f="bold" size={15} accessibilityRole="header">Nhắc học</Txt>
              <ToggleRow icon={Bell} checked={p.reminder_enabled} onChange={(v) => set({ reminder_enabled: v })} label="Nhắc em học mỗi ngày" desc="Chỉ nhắc khi hôm nay em chưa học bài nào" />
              {p.reminder_enabled ? (
                <Card flat pad={12} style={{ gap: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Txt size={14} style={{ flex: 1 }}>Giờ nhắc</Txt>
                    <Btn icon={Minus} label="Giảm một giờ" tone="giay" size="sm" onPress={() => set({ reminder_hour: (p.reminder_hour + 23) % 24 })} testID="reminder-hour-down" />
                    <Txt f="displayHeavy" size={22} style={{ minWidth: 70, textAlign: 'center' }}>{String(p.reminder_hour).padStart(2, '0')}:00</Txt>
                    <Btn icon={Plus} label="Tăng một giờ" tone="giay" size="sm" onPress={() => set({ reminder_hour: (p.reminder_hour + 1) % 24 })} testID="reminder-hour-up" />
                  </View>
                  <Segmented<Prefs['reminder_channel']> label="Cách nhận nhắc" value={p.reminder_channel} onChange={(reminder_channel) => set({ reminder_channel })}
                    options={[{ value: 'web', label: 'Thông báo' }, { value: 'email', label: 'Email' }, { value: 'both', label: 'Cả hai' }]} />
                  {p.reminder_channel !== 'web' && !p.has_email ? <InfoNote><Txt size={13}>Hồ sơ của em chưa có email nên chưa nhận được thư; hãy chọn “Thông báo” hoặc nhờ giáo viên cập nhật email.</Txt></InfoNote> : null}
                </Card>
              ) : null}
            </View>
          ) : null}
        </View>
      )}
    </Sheet>
  );
};
