import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import * as api from '@/api/adminApi';
import { ApiError, errorMessage } from '@/api/client';
import { ErrorNote, useDebounced } from '@/components/admin/kit';
import { SchoolSelect } from '@/components/admin/SchoolSelect';
import type { Session } from '@/components/auth';
import { Btn, Field, Inset, Sheet, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { Account, CreatedAccount } from '@/types/api';

/** Tra cứu dữ liệu đã lưu; không lưu họ tên/email vào localStorage hay lấy từ danh mục trường công khai. */
function AccountSuggestField({ token, kind, value, schoolId, onChange, onSelect, onExpired }: {
  token: string; kind: 'full_name' | 'email'; value: string; schoolId: string;
  onChange: (value: string) => void; onSelect: (account: Account) => void; onExpired: () => void;
}) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const [browse, setBrowse] = useState(false);
  const [page, setPage] = useState(1);
  const [highlight, setHighlight] = useState(-1);
  const query = browse ? '' : value.trim();
  const search = useDebounced(query, 250);
  const key = `${schoolId}:${search}`;
  const [result, setResult] = useState<{ key: string; items: Account[]; total: number }>({ key: '', items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (blurTimer.current) clearTimeout(blurTimer.current); }, []);
  useEffect(() => { setPage(1); setHighlight(-1); }, [query, schoolId]);
  useEffect(() => {
    if (!open || query !== search) return;
    let live = true;
    setLoading(true); setError(null);
    api.listUsers(token, { role: 'school_admin', q: search, school_id: schoolId ? Number(schoolId) : undefined, page, limit: 20 }).then(data => {
      if (!live) return;
      setResult(old => ({ key, total: data.total, items: page === 1 || old.key !== key ? data.items : [...new Map([...old.items, ...data.items].map(item => [item.id, item])).values()] }));
    }).catch(e => { if (live) { setError(errorMessage(e)); if (e instanceof ApiError && e.status === 401) onExpired(); } }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [token, open, query, search, key, schoolId, page, onExpired, retry]);
  const items = result.key === key && query === search && !error ? result.items : [];
  const choose = (account: Account) => { setOpen(false); setBrowse(false); onSelect(account); };
  const keepOpen = () => { if (blurTimer.current) clearTimeout(blurTimer.current); setOpen(true); };
  const show = () => { keepOpen(); setPage(1); };
  const label = kind === 'email' ? 'Email *' : 'Họ và tên *';
  return <View style={{ gap: 6, flexGrow: 1, flexBasis: 240, minWidth: 0 }}>
    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-end' }}>
      <Field label={label} nativeID={`field-${kind}`} value={value} style={{ flex: 1, minWidth: 0 }} autoCapitalize={kind === 'email' ? 'none' : 'words'} keyboardType={kind === 'email' ? 'email-address' : 'default'}
        accessibilityRole="combobox" accessibilityState={{ expanded: open }}
        onFocus={show} onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 180); }}
        onChangeText={text => { setBrowse(false); show(); onChange(text); }}
        onKeyPress={event => {
          const pressed = event.nativeEvent.key;
          if (pressed === 'Escape') setOpen(false);
          if (pressed === 'ArrowDown') { setOpen(true); setHighlight(n => Math.min(n + 1, items.length - 1)); }
          if (pressed === 'ArrowUp') setHighlight(n => Math.max(0, n - 1));
          if (pressed === 'Enter' && open && highlight >= 0 && items[highlight]) choose(items[highlight]);
        }} />
      <Btn icon={ChevronDown} label={`Mở danh sách ${kind === 'email' ? 'email' : 'họ tên'}`} tone="giay" size="sm" style={{ alignSelf: 'flex-end' }} testID={`admin-suggest-toggle-${kind}`} onPress={() => { setBrowse(true); show(); }} />
    </View>
    {open && <View style={{ borderWidth: 1, borderColor: c.adminLine, borderRadius: 7, backgroundColor: c.the }} testID={`admin-suggest-${kind}`}>
      <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 210 }} accessibilityRole="list">
        {items.map((account, i) => <Pressable key={account.id} accessibilityRole="button" accessibilityLabel={`Chọn ${account.full_name}, ${account.email ?? ''}, ${account.school_name ?? ''}`}
          testID={`admin-suggest-${kind}-${account.id}`} onPress={() => choose(account)}
          style={({ pressed }) => ({ minHeight: 64, padding: 10, gap: 3, borderBottomWidth: 1, borderBottomColor: c.adminLine, backgroundColor: pressed || i === highlight ? c.adminCanvas : c.the })}>
          <Txt f="semibold" size={13}>{kind === 'email' ? account.email : account.full_name}</Txt>
          <Txt size={12} color={c.muc2}>{kind === 'email' ? account.full_name : account.email}</Txt>
          <Txt size={11} color={c.muc3}>{account.school_name} · {account.school_code}{!account.is_active ? ' · Đã khóa' : ''}</Txt>
        </Pressable>)}
        {loading || query !== search ? <Txt size={12} color={c.muc3} style={{ padding: 10 }}>Đang tìm quản trị viên trường…</Txt> : null}
        {error ? <View style={{ padding: 10, gap: 6 }}><Txt size={12} color={c.sonChu}>{error}</Txt><Btn title="Thử lại" tone="ghost" size="sm" onPress={() => { keepOpen(); setRetry(n => n + 1); }} /></View> : null}
        {!loading && query === search && !error && !items.length ? <Txt size={12} color={c.muc3} style={{ padding: 10 }}>Chưa có người phù hợp. Bạn có thể nhập thông tin để tạo tài khoản mới.</Txt> : null}
        {items.length > 0 && items.length < result.total && <Btn title="Xem thêm người" tone="ghost" size="sm" loading={loading} onPress={() => { keepOpen(); setPage(n => n + 1); }} testID={`admin-suggest-more-${kind}`} />}
      </ScrollView>
    </View>}
  </View>;
}

export function CreateSchoolAdminSheet({ session, onClose, onCreated, onExisting }: {
  session: Session; onClose: () => void; onCreated: (account: CreatedAccount) => void; onExisting: (id: number) => void;
}) {
  const { c } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [selected, setSelected] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const choose = (account: Account) => {
    setSelected(account); setName(account.full_name); setEmail(account.email ?? ''); setPhone(account.phone ?? ''); setSchoolId(String(account.school_id ?? '')); setError(null);
  };
  const clear = () => { setSelected(null); setName(''); setEmail(''); setPhone(''); setSchoolId(''); setError(null); };
  const submit = async () => {
    if (selected) { onExisting(selected.id); return; }
    if (!name.trim() || !email.trim()) { setError('Hãy điền họ tên và email của quản trị viên trường.'); return; }
    if (!Number.isInteger(Number(schoolId)) || Number(schoolId) < 1) { setError('Hãy chọn trường cho tài khoản quản trị.'); return; }
    setBusy(true); setError(null);
    try {
      onCreated(await api.createAdminAccount(session.token, { full_name: name.trim(), role: 'school_admin', email: email.trim(), phone: phone.trim() || undefined, school_id: Number(schoolId) }));
    } catch (e) { setError(errorMessage(e)); if (e instanceof ApiError && e.status === 401) session.expired(); }
    finally { setBusy(false); }
  };
  return <Sheet open onClose={onClose} title="Tạo tài khoản quản trị" subtitle="Mật khẩu tạm được gửi vào email; người dùng phải đổi ở lần đăng nhập đầu tiên" panelStyle={{ maxWidth: 720 }}
    footer={<View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10 }}><Btn title="Hủy" tone="giay" disabled={busy} onPress={onClose} /><Btn title={selected ? 'Mở hồ sơ tài khoản' : 'Tạo tài khoản'} tone="son" loading={busy} onPress={submit} testID="form-submit" /></View>}>
    <ErrorNote message={error} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      <AccountSuggestField token={session.token} kind="full_name" value={name} schoolId={schoolId} onChange={text => { setSelected(null); setName(text); }} onSelect={choose} onExpired={session.expired} />
      <Field label="Loại tài khoản" value="Quản trị viên trường" editable={false} style={{ flexGrow: 1, flexBasis: 240, minWidth: 0 }} />
    </View>
    <SchoolSelect token={session.token} value={schoolId} onChange={id => { if (selected && id !== schoolId) { setSelected(null); setName(''); setEmail(''); setPhone(''); } setSchoolId(id); }} onExpired={session.expired} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      <AccountSuggestField token={session.token} kind="email" value={email} schoolId={schoolId} onChange={text => { setSelected(null); setEmail(text); }} onSelect={choose} onExpired={session.expired} />
      <Field label="Số điện thoại" nativeID="field-phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={{ flexGrow: 1, flexBasis: 240, minWidth: 0 }} />
    </View>
    {selected && <View testID="admin-existing-account"><Inset style={{ gap: 8 }}>
      <Txt size={13} color={c.muc2}>Người này đã có tài khoản tại {selected.school_name}. Mở hồ sơ để xem hoặc chỉnh sửa thông tin.</Txt>
      <Btn title="Nhập người mới" tone="ghost" size="sm" onPress={clear} testID="admin-new-person" />
    </Inset></View>}
  </Sheet>;
}
