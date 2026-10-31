/**
 * Hồ sơ cá nhân dùng chung cho bốn vai trò (HK.HS.009/010, HK.GV.005/006, HK.QT.005, HK.AD.005): xem thông tin, trường, lớp và
 * tự sửa các trường vai trò được phép (máy chủ quyết định danh sách `editable`, mọi trường khác chỉ đọc).
 * `ProfileForm` không biết token: nhận hàm tải/lưu để dùng được cả trong Sheet của giáo viên, quản trị và hồ sơ của học sinh.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { errorMessage } from '@/api/client';
import { Avatar, Btn, Field, Inset, Sheet, Spinner, Txt, useToast } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { AuthUser, ProfileData, ProfilePatch } from '@/types/api';

type Editable = ProfileData['editable'][number];
const LABEL: Record<Editable, { label: string; hint?: string; multiline?: boolean }> = {
  full_name: { label: 'Họ và tên' },
  nickname: { label: 'Biệt danh', hint: '2–24 ký tự; bảng xếp hạng chỉ hiện biệt danh của học sinh.' },
  email: { label: 'Email', hint: 'Dùng để nhận mã xác thực khi quên mật khẩu.' },
  phone: { label: 'Số điện thoại' },
  avatar_url: { label: 'Ảnh đại diện (liên kết https)', hint: 'Dán địa chỉ ảnh bắt đầu bằng https://' },
  bio: { label: 'Giới thiệu ngắn', hint: 'Tối đa 300 ký tự.', multiline: true },
};
const ROLE_TEXT: Record<AuthUser['role'], string> = { student: 'Học sinh', teacher: 'Giáo viên', school_admin: 'Quản trị viên trường học', root_admin: 'Quản trị viên tổng' };

export const ProfileForm: React.FC<{ load: () => Promise<ProfileData>; save: (patch: ProfilePatch) => Promise<ProfileData>; onSaved?: (user: AuthUser) => void }> = ({ load, save, onSaved }) => {
  const { c } = useTheme();
  const toast = useToast();
  const [data, setData] = useState<ProfileData | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const apply = useCallback((p: ProfileData) => {
    setData(p);
    setForm(Object.fromEntries(p.editable.map((k) => [k, (p.user[k] as string | null) ?? ''])));
  }, []);
  useEffect(() => {
    load().then(apply).catch((e) => setError(errorMessage(e, 'Không tải được hồ sơ.')));
  }, [load, apply]);

  if (!data) return error ? <Inset style={{ backgroundColor: c.sonNhat }}><Txt color={c.sonChu} accessibilityRole="alert">{error}</Txt></Inset> : <Spinner label="Đang tải hồ sơ…" />;
  const { user, school, classes, editable } = data;
  const dirty = editable.some((k) => (form[k] ?? '') !== ((user[k] as string | null) ?? ''));
  const info = (label: string, value: string | null | undefined) => (
    <View key={label} style={{ gap: 2, flexGrow: 1, flexBasis: 200 }}>
      <Txt f="bold" size={12} color={c.muc3}>{label}</Txt>
      <Txt size={14} selectable>{value || 'Chưa có'}</Txt>
    </View>
  );
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const patch: ProfilePatch = {};
      for (const k of editable) if ((form[k] ?? '') !== ((user[k] as string | null) ?? '')) patch[k] = form[k].trim() === '' ? null : form[k].trim();
      const next = await save(patch);
      apply(next);
      onSaved?.(next.user);
      toast('Đã lưu hồ sơ');
    } catch (e) {
      setError(errorMessage(e, 'Không lưu được hồ sơ.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View testID="profile-form" style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {user.avatar_url ? <Image source={{ uri: user.avatar_url }} accessibilityLabel="Ảnh đại diện" style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.dichNhat }} /> : <Avatar name={user.full_name} size={64} />}
        <View style={{ flex: 1 }}>
          <Txt f="bold" size={18}>{user.nickname || user.full_name}</Txt>
          <Txt size={13} color={c.muc2}>{ROLE_TEXT[user.role]}{user.subject ? ` · ${user.subject}` : ''}</Txt>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {info('Tên đăng nhập', user.username)}
        {user.user_code ? info('Mã người dùng', user.user_code) : null}
        {!editable.includes('full_name') ? info('Họ và tên', user.full_name) : null}
        {!editable.includes('email') ? info('Email', user.email) : null}
        {!editable.includes('phone') && user.role !== 'student' ? info('Số điện thoại', user.phone) : null}
        {school ? info('Trường', `${school.name} (${school.school_code})`) : null}
        {user.role === 'student' && user.grade ? info('Khối', `Khối ${user.grade}`) : null}
        {classes.length ? info(user.role === 'teacher' ? 'Lớp phụ trách' : 'Lớp đã tham gia', classes.map((k) => `${k.class_code} (${k.school_year})`).join(', ')) : null}
      </View>
      {error ? <Inset style={{ backgroundColor: c.sonNhat }}><Txt color={c.sonChu} accessibilityRole="alert">{error}</Txt></Inset> : null}
      {editable.map((k) => {
        const meta = LABEL[k];
        return (
          <Field key={k} label={meta.label} hint={meta.hint} value={form[k] ?? ''} onChangeText={(v) => setForm((f) => ({ ...f, [k]: v }))} autoCapitalize={k === 'email' || k === 'avatar_url' ? 'none' : 'sentences'}
            keyboardType={k === 'phone' ? 'phone-pad' : k === 'email' ? 'email-address' : 'default'} multiline={meta.multiline} numberOfLines={meta.multiline ? 3 : 1} inputStyle={meta.multiline ? { minHeight: 84, textAlignVertical: 'top' } : undefined} />
        );
      })}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Btn title="Lưu hồ sơ" tone="ngoc" loading={busy} disabled={!dirty} onPress={submit} testID="profile-save" />
        {dirty && <Btn title="Hoàn tác" tone="giay" disabled={busy} onPress={() => apply(data)} />}
      </View>
      {(user.role === 'student' || user.role === 'teacher') && (
        <Txt size={12} color={c.muc3}>Họ tên, lớp và các thông tin do nhà trường quản lý chỉ quản trị viên sửa được.</Txt>
      )}
    </View>
  );
};

/** Hồ sơ trong một Sheet riêng (giáo viên, quản trị) */
export const ProfileSheet: React.FC<{ onClose: () => void; load: () => Promise<ProfileData>; save: (patch: ProfilePatch) => Promise<ProfileData>; onSaved?: (user: AuthUser) => void }> = ({ onClose, load, save, onSaved }) => (
  <Sheet open onClose={onClose} title="Hồ sơ cá nhân" subtitle="Xem và cập nhật thông tin của bạn">
    <ProfileForm load={load} save={save} onSaved={onSaved} />
  </Sheet>
);
