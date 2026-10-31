/**
 * Bản đồ tương tác dùng chung (Leaflet + OpenStreetMap, chỉ chạy trên web): bản đồ địa danh (HK.HS.027), khối bản đồ trong bài học,
 * câu hỏi kéo thả địa danh (HK.HS.044) và lời giải của câu đó. Điểm đánh dấu có nhãn thường trực để không chỉ dựa vào màu.
 */
import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { MapCircle, MapLine, MapMarker } from '@/components/portal/LeafletMap';

const COLOR = { son: '#b91c1c', ngoc: '#3f9a00', thuy: '#0369a1', dong: '#c97500' } as const;
const FILL = { son: '#fee2e2', ngoc: '#e7f8d6', thuy: '#e0f2fe', dong: '#fff0d4' } as const;

export const LeafletMap: React.FC<{
  markers: MapMarker[]; circles?: MapCircle[]; lines?: MapLine[]; onMarkerPress?: (id: string) => void; onMapPress?: (lat: number, lng: number) => void;
  height?: number; label: string; center?: [number, number]; zoom?: number;
}> = ({ markers, circles = [], lines = [], onMarkerPress, onMapPress, height = 320, label, center = [16.2, 106.2], zoom = 5 }) => {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const fitted = useRef('');
  const press = useRef(onMapPress);
  const markerPress = useRef(onMarkerPress);
  press.current = onMapPress;
  markerPress.current = onMarkerPress;

  useEffect(() => {
    if (!host.current) return undefined;
    const instance = L.map(host.current, { scrollWheelZoom: false, minZoom: 4, maxZoom: 14 }).setView(center, zoom);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; Đóng góp của OpenStreetMap' }).addTo(instance);
    instance.on('click', (event: L.LeafletMouseEvent) => press.current?.(Math.round(event.latlng.lat * 1e4) / 1e4, Math.round(event.latlng.lng * 1e4) / 1e4));
    layer.current = L.layerGroup().addTo(instance);
    map.current = instance;
    return () => { instance.remove(); map.current = null; layer.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const group = layer.current;
    const instance = map.current;
    if (!group || !instance) return;
    group.clearLayers();
    for (const c of circles) L.circle([c.lat, c.lng], { radius: c.radiusKm * 1000, color: COLOR[c.tone ?? 'ngoc'], weight: 2, fillColor: FILL[c.tone ?? 'ngoc'], fillOpacity: 0.35 }).addTo(group);
    for (const l of lines) L.polyline([l.from, l.to], { color: COLOR[l.tone ?? 'son'], weight: 2, dashArray: '6 6' }).addTo(group);
    for (const m of markers) {
      const tone = m.tone ?? 'son';
      const dot = L.circleMarker([m.lat, m.lng], { radius: 9, color: COLOR[tone], weight: 3, fillColor: FILL[tone], fillOpacity: 0.95 }).addTo(group);
      dot.bindTooltip(m.label, { permanent: true, direction: 'top', offset: [0, -8] });
      if (markerPress.current) dot.on('click', (e: L.LeafletMouseEvent) => { L.DomEvent.stopPropagation(e); markerPress.current?.(m.id); });
    }
    const signature = markers.map((m) => m.id).join('|');
    if (markers.length && signature !== fitted.current) {
      fitted.current = signature;
      if (markers.length === 1) instance.setView([markers[0].lat, markers[0].lng], Math.max(zoom, 8));
      else instance.fitBounds(L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number])), { padding: [36, 36], maxZoom: 10 });
    }
  }, [markers, circles, lines, zoom]);

  return <div ref={host} role="application" aria-label={label} style={{ height, width: '100%', borderRadius: 14, border: '2px solid #efe0bf', overflow: 'hidden' }} />;
};
