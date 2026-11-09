import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import * as api from '@/api/adminApi';
import { useDebounced } from '@/components/admin/kit';
import { SchoolEmblem } from '@/components/school-brand';
import { Btn, Field, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { ApiError, errorMessage } from '@/api/client';
import type { SchoolItem } from '@/types/api';

/** Tìm trực tiếp trong các trường đã tạo, không giới hạn ở 200 trường đầu tiên. */
export function SchoolSelect({ token, value, onChange, onExpired }: { token: string; value: string; onChange: (value: string) => void; onExpired?: () => void }) {
  const { c } = useTheme();
  const [query, setQuery] = useState('');
  const search = useDebounced(query, 250);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<SchoolItem[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<SchoolItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [retry, setRetry] = useState(0);
  const [resultKey, setResultKey] = useState('');
  const key = search;
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (blurTimer.current) clearTimeout(blurTimer.current); }, []);
  // Họ tên/email có thể chọn trước: tải đúng trường theo id, kể cả trường ngoài trang kết quả hiện tại.
  useEffect(() => {
    if (selected && value === String(selected.id)) return undefined;
    if (!value) { setSelected(null); return; }
    let live = true;
    setError(null);
    api.getSchool(token, Number(value)).then(school => { if (live) setSelected({ ...school, users: 0, admins: school.counts.admins, teachers: school.counts.teachers, students: school.counts.students, classes: school.counts.classes }); })
      .catch(e => { if (live) { setError(errorMessage(e)); if (e instanceof ApiError && e.status === 401) onExpired?.(); } });
    return () => { live = false; };
  }, [token, value, selected, onExpired, retry]);
  useEffect(() => {
    if (!open || query.trim() !== search.trim()) return;
    let live = true;
    setLoading(true); setError(null);
    api.listSchools(token, { q: search, active: 'true', page, limit: 30 }).then(result => {
      if (!live) return;
      setItems(old => page === 1 ? result.items : [...new Map([...old, ...result.items].map(item => [item.id, item])).values()]); setResultKey(key);
      setTotal(result.total);
    }).catch(e => { if (live) { setError(errorMessage(e)); if (e instanceof ApiError && e.status === 401) onExpired?.(); } }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [token, search, page, open, query, key, onExpired, retry]);
  const show = () => { if (blurTimer.current) clearTimeout(blurTimer.current); setQuery(''); setPage(1); setOpen(true); };
  const visibleItems = resultKey === key && query.trim() === search.trim() && !error ? items : [];
  return <View style={{ gap: 8 }}>
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
      <Field label="Trường *" nativeID="field-school-search" value={open ? query : selected && value === String(selected.id) ? `${selected.name} (${selected.school_code})` : ''} placeholder="Chọn hoặc gõ tên trường" style={{ flex: 1, minWidth: 0 }} accessibilityRole="combobox" accessibilityState={{ expanded: open }}
        onFocus={show} onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 180); }}
        onChangeText={text => { setQuery(text); setPage(1); setOpen(true); setSelected(null); onChange(''); }} onKeyPress={e => { if (e.nativeEvent.key === 'Escape') setOpen(false); }} />
      <Btn icon={ChevronDown} label="Mở danh sách trường" tone="giay" size="sm" style={{ alignSelf: 'flex-end' }} testID="existing-school-toggle" onPress={show} />
    </View>
    {error && <Txt size={12} color={c.son}>{error}</Txt>}
    {open && <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 230, borderWidth: 1, borderColor: c.adminLine, borderRadius: 7 }} testID="existing-school-list">
      {visibleItems.map(item => <Pressable key={item.id} testID={`existing-school-${item.id}`} accessibilityRole="button" accessibilityLabel={`Chọn ${item.name}, mã ${item.school_code}`} onPress={() => { setSelected(item); setOpen(false); onChange(String(item.id)); }} style={{ minHeight: 52, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: c.adminLine }}>
        <SchoolEmblem name={item.name} code={item.school_code} logoUrl={item.logo_url} size={30} />
        <View style={{ flex: 1, gap: 3 }}><Txt f="semibold" size={13}>{item.name}</Txt><Txt size={11} color={c.muc3}>{item.school_code} · {[item.region, item.city].filter(Boolean).join(' · ')}</Txt></View>
      </Pressable>)}
      {loading || query.trim() !== search.trim() ? <Txt size={12} color={c.muc3} style={{ padding: 12 }}>Đang tìm trường…</Txt> : null}
      {!loading && !error && query.trim() === search.trim() && !visibleItems.length && <Txt size={12} color={c.muc3} style={{ padding: 12 }}>Không tìm thấy trường đã tạo phù hợp.</Txt>}
      {error && <Btn title="Thử lại" tone="ghost" size="sm" onPress={() => { if (blurTimer.current) clearTimeout(blurTimer.current); setRetry(n => n + 1); }} />}
      {visibleItems.length > 0 && visibleItems.length < total && <Btn title="Xem thêm trường" tone="ghost" size="sm" onPress={() => { if (blurTimer.current) clearTimeout(blurTimer.current); setPage(n => n + 1); }} loading={loading} testID="existing-school-more" />}
    </ScrollView>}
    {selected && <Txt size={12} color={c.ngocChu}>Đã chọn: {selected.name}</Txt>}
  </View>;
}
