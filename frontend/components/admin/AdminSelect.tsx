import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { Sheet, Txt } from '@/components/ui';
import { FONT } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function AdminSelect<T extends string | number>({ label, value, options, onChange, testID }: {
  label: string; value: T; options: Array<{ value: T; label: string }>; onChange: (value: T) => void; testID?: string;
}) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  return <View style={{ gap: 6, minWidth: 0 }}>
    <Txt f="bold" size={14} color={c.muc2}>{label}</Txt>
    {Platform.OS === 'web' ? <select data-testid={testID} aria-label={label} value={String(value)} onChange={event => { const option = options.find(item => String(item.value) === event.target.value); if (option) onChange(option.value); }} style={{ height: 44, width: '100%', minWidth: 0, border: `1px solid ${c.adminLine}`, borderRadius: 5, background: c.the, color: c.muc, padding: '0 12px', fontFamily: FONT.body, fontSize: 14 }}>
      {options.map(option => <option key={option.value} value={String(option.value)}>{option.label}</option>)}
    </select> : <>
      <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={() => setOpen(true)} style={{ minHeight: 44, borderWidth: 1, borderColor: c.adminLine, borderRadius: 5, backgroundColor: c.the, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}><Txt size={14}>{options.find(item => item.value === value)?.label}</Txt><ChevronDown size={16} color={c.muc2} /></Pressable>
      <Sheet open={open} onClose={() => setOpen(false)} title={label}>{options.map(option => <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: option.value === value }} onPress={() => { onChange(option.value); setOpen(false); }} style={{ minHeight: 48, padding: 12, backgroundColor: option.value === value ? c.sonNhat : c.the }}><Txt size={14}>{option.label}</Txt></Pressable>)}</Sheet>
    </>}
  </View>;
}
