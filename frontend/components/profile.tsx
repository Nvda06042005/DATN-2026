/**
 * Hồ sơ cá nhân dùng chung cho bốn vai trò (HK.HS.009/010, HK.GV.005/006, HK.QT.005, HK.AD.005): xem thông tin, trường, lớp và
 * tự sửa các trường vai trò được phép (máy chủ quyết định danh sách `editable`, mọi trường khác chỉ đọc).
 * `ProfileForm` không biết token: nhận hàm tải/lưu để dùng được cả trong Sheet của giáo viên, quản trị và hồ sơ của học sinh.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { ImagePlus, Trash2 } from 'lucide-react-native';
import { errorMessage, type PickedFile } from '@/api/client';
import { pickFile } from '@/components/admin/kit';
import { Avatar, Btn, Field, Inset, Segmented, Sheet, Spinner, Txt, useToast } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { AVATAR_MAX, AVATAR_ONLY_IMAGES, AVATAR_TYPES, isAvatarImage } from '@/lib/avatar';
import type { AuthUser, ProfileData, ProfilePatch } from '@/types/api';

type Editable = ProfileData['editable'][number];
const LABEL: Record<Editable, { label: string; hint?: string; multiline?: boolean }> = {
  full_name: { label: 'Họ và tên' },
  nickname: { label: 'Biệt danh', hint: '2–24 ký tự; bảng xếp hạng chỉ hiện biệt danh của học sinh.' },
  email: { label: 'Email', hint: 'Dùng để nhận mã xác thực khi quên mật khẩu.' },
  phone: { label: 'Số điện thoại' },
  avatar_url: { label: 'Ảnh đại diện' },
  bio: { label: 'Giới thiệu ngắn', hint: 'Tối đa 300 ký tự.', multiline: true },
};
const ROLE_TEXT: Record<AuthUser['role'], string> = { student: 'Học sinh', teacher: 'Giáo viên', school_admin: 'Quản trị viên trường học', root_admin: 'Quản trị viên tổng' };

async function readAvatar(picked: PickedFile): Promise<{ data: string }> {
  if (!isAvatarImage(picked.mimeType, picked.name)) throw new Error(AVATAR_ONLY_IMAGES);
  const blob: Blob = (picked.file as Blob | undefined) ?? (await (await fetch(picked.uri)).blob());
  if (blob.size > AVATAR_MAX) throw new Error('Ảnh đại diện tối đa 1,5 MB. Hãy chọn ảnh nhỏ hơn.');
  const data = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Không đọc được ảnh.'));
    r.readAsDataURL(blob);
  });
  return { data };
}

export const ProfileForm: React.FC<{ load: () => Promise<ProfileData>; save: (patch: ProfilePatch) => Promise<ProfileData>; upload?: (img: { data: string }) => Promise<ProfileData>; onSaved?: (user: AuthUser) => void }> = ({ load, save, upload, onSaved }) => {
  const { c } = useTheme();
  const toast = useToast();
  const [data, setData] = useState<ProfileData | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const apply = useCallback((p: ProfileData) => {
    setData(p);
    setForm(Object.fromEntries(p.editable.map((k) => [k, (p.user[k] as string | null) ?? ''])));
  }, []);
  useEffect(() => {
    load().then(apply).catch((e) => setError(errorMessage(e, 'Không tải được hồ sơ.')));
  }, [load, apply]);

  if (!data) return error ? <Inset style={{ backgroundColor: c.sonNhat }}><Txt color={c.sonChu} accessibilityRole="alert">{error}</Txt></Inset> : <Spinner label="Đang tải hồ sơ…" />;
  const { user, school, classes, editable } = data;
  // đổi hoặc xóa ảnh có hiệu lực ngay (không cần bấm Lưu hồ sơ) và giữ nguyên các ô chữ đang gõ dở
  const changeAvatar = async (action: () => Promise<ProfileData | null>) => {
    setAvatarBusy(true);
    setAvatarError(null);
    try {
      const next = await action();
      if (next) {
        setData(next);
        onSaved?.(next.user);
        toast(next.user.avatar_url ? 'Đã cập nhật ảnh đại diện' : 'Đã xóa ảnh đại diện');
      }
    } catch (e) {
      setAvatarError(errorMessage(e, 'Chưa đổi được ảnh đại diện.'));
    } finally {
      setAvatarBusy(false);
    }
  };
  const pickAvatar = () => changeAvatar(async () => {
    const picked = await pickFile(AVATAR_TYPES);
    return picked && upload ? upload(await readAvatar(picked)) : null;
  });
  const removeAvatar = () => changeAvatar(() => save({ avatar_url: null }));
  const textFields = editable.filter((k) => k !== 'avatar_url');
  const dirty = textFields.some((k) => (form[k] ?? '') !== ((user[k] as string | null) ?? ''));
  const info = (label: string, value: string | null | undefined) => (
    <View key={label} style={{ gap: 1, flexGrow: 1, flexBasis: 170, minWidth: 0 }}>
      <Txt f="bold" size={12} color={c.muc3}>{label}</Txt>
      <Txt size={14} selectable>{value || 'Chưa có'}</Txt>
    </View>
  );
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const patch: ProfilePatch = {};
      for (const k of textFields) if ((form[k] ?? '') !== ((user[k] as string | null) ?? '')) patch[k] = form[k].trim() === '' ? null : form[k].trim();
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
  const avatarEditable = editable.includes('avatar_url') && Boolean(upload);
  return (
    <View testID="profile-form" style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar name={user.full_name} uri={user.avatar_url} size={56} />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt f="bold" size={17} numberOfLines={1}>{user.nickname || user.full_name}</Txt>
          <Txt size={12} color={c.muc2}>{ROLE_TEXT[user.role]}{user.subject ? ` · ${user.subject}` : ''}</Txt>
          {avatarEditable ? (
            <View testID="avatar-editor" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
              <Btn title={user.avatar_url ? 'Đổi ảnh' : 'Chọn ảnh'} label="Ảnh đại diện: chọn ảnh từ máy" icon={ImagePlus} tone="giay" size="sm" loading={avatarBusy} onPress={pickAvatar} testID="avatar-pick" />
              {user.avatar_url ? <Btn title="Xóa ảnh" icon={Trash2} tone="giay" size="sm" disabled={avatarBusy} onPress={removeAvatar} testID="avatar-remove" /> : null}
            </View>
          ) : null}
        </View>
      </View>
      {avatarEditable ? <Txt size={11} color={c.muc3}>Chỉ nhận ảnh PNG, JPG, WEBP hoặc GIF, tối đa 1,5 MB. Không nhận tệp Word, Excel, PowerPoint, PDF hay tệp khác.</Txt> : null}
      {avatarError ? <Txt size={13} f="semibold" color={c.sonChu} accessibilityRole="alert" testID="avatar-error">{avatarError}</Txt> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 8 }}>
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
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {textFields.map((k) => {
          const meta = LABEL[k];
          return (
            <View key={k} style={{ flexGrow: 1, flexBasis: meta.multiline ? '100%' : 220, minWidth: 0 }}>
              <Field label={meta.label} hint={meta.hint} value={form[k] ?? ''} onChangeText={(v) => setForm((f) => ({ ...f, [k]: v }))} autoCapitalize={k === 'email' ? 'none' : 'sentences'}
                keyboardType={k === 'phone' ? 'phone-pad' : k === 'email' ? 'email-address' : 'default'} multiline={meta.multiline} numberOfLines={meta.multiline ? 3 : 1} inputStyle={meta.multiline ? { minHeight: 72, textAlignVertical: 'top' } : undefined} />
            </View>
          );
        })}
      </View>
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

/** Hồ sơ trong một Sheet riêng (giáo viên, quản trị). Có phần bảo mật (quản trị) thì chia hai tab để hộp thấp và gọn; cả hai tab luôn được giữ nguyên nội dung đang gõ */
export const ProfileSheet: React.FC<{ onClose: () => void; load: () => Promise<ProfileData>; save: (patch: ProfilePatch) => Promise<ProfileData>; upload?: (img: { data: string }) => Promise<ProfileData>; onSaved?: (user: AuthUser) => void; children?: React.ReactNode }> = ({ onClose, load, save, upload, onSaved, children }) => {
  const [tab, setTab] = useState<'info' | 'security'>('info');
  return (
    <Sheet open onClose={onClose} title="Hồ sơ cá nhân" subtitle="Xem và cập nhật thông tin của bạn" panelStyle={{ maxWidth: 520 }}>
      <View style={{ gap: 14 }}>
        {children ? <Segmented<'info' | 'security'> label="Mục hồ sơ" value={tab} onChange={setTab} options={[{ value: 'info', label: 'Thông tin' }, { value: 'security', label: 'Đăng nhập và bảo mật' }]} /> : null}
        <View style={{ display: tab === 'info' ? 'flex' : 'none' }}><ProfileForm load={load} save={save} upload={upload} onSaved={onSaved} /></View>
        {children ? <View style={{ display: tab === 'security' ? 'flex' : 'none' }}>{children}</View> : null}
      </View>
    </Sheet>
  );
};
