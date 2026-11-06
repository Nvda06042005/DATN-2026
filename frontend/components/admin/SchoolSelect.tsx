import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import * as api from '@/api/adminApi';
import { useDebounced } from '@/components/admin/kit';
import { SchoolEmblem } from '@/components/school-brand';
import { Btn, Field, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/api/client';
import type { SchoolItem } from '@/types/api';

/** Tìm trực tiếp trong các trường đã tạo, không giới hạn ở 200 trường đầu tiên. */
export function SchoolSelect({ token, value, onChange }: { token: string; value: string; onChange: (value: string) => void }) {
  const { c } = useTheme();
  const [query, setQuery] = useState('');
  const search = useDebounced(query, 250);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<SchoolItem[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<SchoolItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (selected && value === String(selected.id)) return undefined;
    let live = true;
    setLoading(true); setError(null);
    api.listSchools(token, { q: search, active: 'true', page, limit: 30 }).then(result => {
      if (!live) return;
      setItems(old => page === 1 ? result.items : [...new Map([...old, ...result.items].map(item => [item.id, item])).values()]);
      setTotal(result.total);
    }).catch(e => { if (live) setError(errorMessage(e)); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [token, search, page, selected, value]);
  return <View style={{ gap: 8 }}>
    <Field label="Trường *" nativeID="field-school-search" value={query} placeholder="Gõ tên, chữ viết tắt hoặc mã trường" onChangeText={text => { setQuery(text); setPage(1); setSelected(null); onChange(''); }} />
    {error && <Txt size={12} color={c.son}>{error}</Txt>}
    {loading && <Txt size={12} color={c.muc3}>Đang tìm trường…</Txt>}
    {!selected && <ScrollView nestedScrollEnabled style={{ maxHeight: 230, borderWidth: 1, borderColor: c.adminLine, borderRadius: 7 }}>
      {items.map(item => <Pressable key={item.id} testID={`existing-school-${item.id}`} accessibilityRole="button" accessibilityLabel={`Chọn ${item.name}, mã ${item.school_code}`} onPress={() => { setSelected(item); setQuery(`${item.name} (${item.school_code})`); onChange(String(item.id)); }} style={{ minHeight: 52, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: c.adminLine }}>
        <SchoolEmblem name={item.name} code={item.school_code} logoUrl={item.logo_url} size={30} />
        <View style={{ flex: 1, gap: 3 }}><Txt f="semibold" size={13}>{item.name}</Txt><Txt size={11} color={c.muc3}>{item.school_code} · {[item.region, item.city].filter(Boolean).join(' · ')}</Txt></View>
      </Pressable>)}
      {!loading && !items.length && <Txt size={12} color={c.muc3} style={{ padding: 12 }}>Không tìm thấy trường đã tạo phù hợp.</Txt>}
      {items.length < total && <Btn title="Xem thêm trường" tone="ghost" size="sm" onPress={() => setPage(n => n + 1)} loading={loading} testID="existing-school-more" />}
    </ScrollView>}
    {selected && <Txt size={12} color={c.ngocChu}>Đã chọn: {selected.name}</Txt>}
  </View>;
}
