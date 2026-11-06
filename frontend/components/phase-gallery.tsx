import { Pressable, ScrollView } from 'react-native';
import type { PhaseGalleryProps } from './phase-gallery.types';
/** Native fallback keeps every campaign reachable with a normal horizontal swipe. */
export function PhaseGallery({ items, wide, onSelect }: PhaseGalleryProps) {
  return <ScrollView horizontal accessibilityLabel="Chín màn chiến dịch" showsHorizontalScrollIndicator contentContainerStyle={{ padding: 20, gap: 18 }}>{items.map(item => <Pressable key={item.id} testID={`phase-card-${item.id}`} accessibilityRole="button" accessibilityLabel={`Đọc chi tiết ${item.title}`} onPress={() => onSelect(item.id)} style={{ width: wide ? 300 : 250, height: 390 }}>{item.content}</Pressable>)}</ScrollView>;
}
