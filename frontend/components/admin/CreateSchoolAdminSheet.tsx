/**
 * Tạo tài khoản quản trị viên trường (mục Người dùng, và nút "Thêm quản trị viên trường" sau khi thêm trường).
 * 18/11/2026: họ tên và email tự nhập (không danh sách thả xuống tài khoản đã có; email trùng thì máy chủ báo lỗi), họ tên viết hoa chữ cái đầu mỗi từ,
 * không còn ghi chú quy ước tên đăng nhập / mật khẩu; tên đăng nhập và mật khẩu theo quy ước được gửi vào email.
 */
import { useState } from 'react';
import { Platform, View } from 'react-native';
import * as api from '@/api/adminApi';
import { ApiError, errorMessage } from '@/api/client';
import { CalendarInput, ErrorNote } from '@/components/admin/kit';
import { SchoolSelect } from '@/components/admin/SchoolSelect';
import type { Session } from '@/components/auth';
import { Btn, Field, PhoneField, Sheet } from '@/components/ui';
import { nameCaseError, properName } from '@/lib/person-name';
import { todayVn } from '@/lib/school-terms';
import type { CreatedAccount } from '@/types/api';

export function CreateSchoolAdminSheet({ session, onClose, onCreated, initialSchoolId }: {
  session: Session; onClose: () => void; onCreated: (account: CreatedAccount) => void;
  /** Giữ cho nơi gọi cũ (mở hồ sơ tài khoản đã có); hộp không còn gợi ý tài khoản đã có nên không dùng */
  onExisting?: (id: number) => void;
  /** Chọn sẵn trường (ví dụ trường vừa thêm ở trang Trường học, 18/11/2026) */
  initialSchoolId?: number;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [birth, setBirth] = useState('');
  const [schoolId, setSchoolId] = useState(initialSchoolId ? String(initialSchoolId) : '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);
  const nameError = nameTouched ? nameCaseError(name) : null;
  const submit = async () => {
    if (!name.trim() || !email.trim()) { setError('Hãy điền họ tên và email của quản trị viên trường.'); return; }
    if (nameCaseError(name)) { setNameTouched(true); setError(nameCaseError(name)); return; }
    if (!Number.isInteger(Number(schoolId)) || Number(schoolId) < 1) { setError('Hãy chọn trường cho tài khoản quản trị.'); return; }
    if (!/^\d{10}$/.test(phone)) { setError('Số điện thoại của quản trị viên gồm đúng 10 chữ số (4 số cuối dùng để ghép tên đăng nhập).'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birth)) { setError('Hãy chọn ngày tháng năm sinh của quản trị viên: dùng để ghép mật khẩu.'); return; }
    setBusy(true); setError(null);
    try {
      onCreated(await api.createAdminAccount(session.token, { full_name: name.trim(), role: 'school_admin', email: email.trim(), phone, birth_date: birth, school_id: Number(schoolId) }));
    } catch (e) { setError(errorMessage(e)); if (e instanceof ApiError && e.status === 401) session.expired(); }
    finally { setBusy(false); }
  };
  return <Sheet open onClose={onClose} title="Tạo tài khoản quản trị" subtitle="Tên đăng nhập và mật khẩu được gửi vào email; người dùng phải đổi mật khẩu ở lần đăng nhập đầu tiên" panelStyle={{ maxWidth: 720 }}
    footer={<View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10 }}><Btn title="Hủy" tone="giay" disabled={busy} onPress={onClose} /><Btn title="Tạo tài khoản" tone="son" loading={busy} onPress={submit} testID="form-submit" /></View>}>
    <ErrorNote message={error} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      <View style={{ flexGrow: 1, flexBasis: 240, minWidth: 0, gap: 6 }}>
        <Field label="Họ và tên *" nativeID="field-full_name" value={name} autoCapitalize="words" placeholder="Ví dụ Nguyễn Vũ Đức Anh" error={nameError}
          onChangeText={setName} onBlur={() => setNameTouched(true)} />
        {nameError ? <Btn title={`Dùng “${properName(name)}”`} tone="ghost" size="sm" onPress={() => { setName(properName(name)); setError(null); }} testID="admin-name-fix" /> : null}
      </View>
      <Field label="Loại tài khoản" value="Quản trị viên trường" editable={false} style={{ flexGrow: 1, flexBasis: 240, minWidth: 0 }} />
    </View>
    <SchoolSelect token={session.token} value={schoolId} onChange={setSchoolId} onExpired={session.expired} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      <Field label="Email *" nativeID="field-email" value={email} autoCapitalize="none" keyboardType="email-address" placeholder="ten@truong.edu.vn" style={{ flexGrow: 1, flexBasis: 240, minWidth: 0 }}
        onChangeText={setEmail} />
      <PhoneField label="Số điện thoại *" nativeID="field-phone" value={phone} onChange={setPhone} style={{ flexGrow: 1, flexBasis: 240, minWidth: 0 }} />
    </View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      <View style={{ flexGrow: 1, flexBasis: 240, minWidth: 0 }}>
        {Platform.OS === 'web'
          ? <CalendarInput def={{ name: 'birth_date', label: 'Ngày tháng năm sinh', type: 'date', calendar: true, min: '1930-01-01', max: todayVn(), required: true }} label="Ngày tháng năm sinh *" value={birth} error={null} onChange={setBirth} />
          : <Field label="Ngày tháng năm sinh * (YYYY-MM-DD)" nativeID="field-birth_date" value={birth} onChangeText={setBirth} placeholder="2005-04-06" />}
      </View>
    </View>
  </Sheet>;
}
