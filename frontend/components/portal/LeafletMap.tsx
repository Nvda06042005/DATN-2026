/** Bản dành cho điện thoại: chưa có bản đồ tương tác, hiện danh sách địa danh (bản web có bản đồ Leaflet trong LeafletMap.web.tsx). */
import React from 'react';
import { Pressable, View } from 'react-native';
import { Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';

export type MapTone = 'son' | 'ngoc' | 'thuy' | 'dong';
export interface MapMarker { id: string; lat: number; lng: number; label: string; tone?: MapTone }
export interface MapCircle { lat: number; lng: number; radiusKm: number; tone?: MapTone }
export interface MapLine { from: [number, number]; to: [number, number]; tone?: MapTone }

export const LeafletMap: React.FC<{
  markers: MapMarker[]; circles?: MapCircle[]; lines?: MapLine[]; onMarkerPress?: (id: string) => void; onMapPress?: (lat: number, lng: number) => void;
  height?: number; label: string; center?: [number, number]; zoom?: number; fit?: Array<[number, number]>;
}> = ({ markers, onMarkerPress, label }) => {
  const { c } = useTheme();
  return (
    <View style={{ gap: 6 }} accessibilityLabel={label}>
      <Txt size={13} color={c.muc2}>Bản đồ tương tác chỉ có trên bản web. Danh sách địa danh:</Txt>
      {markers.map((m) => (
        <Pressable key={m.id} accessibilityRole="button" disabled={!onMarkerPress} onPress={() => onMarkerPress?.(m.id)} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Txt f="semibold" size={14}>{m.label}</Txt>
        </Pressable>
      ))}
    </View>
  );
};
