/** Chọn tọa độ trực tiếp trên bản đồ (HK.AD.035): Leaflet + OpenStreetMap, chỉ chạy trên web. Bấm vào bản đồ để đặt hoặc dời điểm. */
import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export const MapPicker: React.FC<{ lat: number | null; lng: number | null; onPick: (lat: number, lng: number) => void }> = ({ lat, lng, onPick }) => {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.CircleMarker | null>(null);
  const pick = useRef(onPick);
  pick.current = onPick;

  useEffect(() => {
    if (!host.current) return undefined;
    const instance = L.map(host.current, { scrollWheelZoom: false }).setView(lat !== null && lng !== null ? [lat, lng] : [17.5, 106], lat !== null ? 11 : 5);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; Đóng góp của OpenStreetMap' }).addTo(instance);
    instance.on('click', (event: L.LeafletMouseEvent) => pick.current(Math.round(event.latlng.lat * 1e6) / 1e6, Math.round(event.latlng.lng * 1e6) / 1e6));
    map.current = instance;
    return () => { instance.remove(); map.current = null; marker.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    if (lat === null || lng === null || Number.isNaN(lat) || Number.isNaN(lng)) { marker.current?.remove(); marker.current = null; return; }
    if (!marker.current) marker.current = L.circleMarker([lat, lng], { radius: 9, color: '#b91c1c', weight: 3, fillColor: '#fee2e2', fillOpacity: 0.9 }).addTo(instance);
    else marker.current.setLatLng([lat, lng]);
    instance.panTo([lat, lng]);
  }, [lat, lng]);

  return <div ref={host} role="application" aria-label="Bản đồ chọn tọa độ: bấm để đặt điểm" style={{ height: 280, width: '100%', borderRadius: 5, border: '1px solid #e8e6eb', overflow: 'hidden' }} />;
};
