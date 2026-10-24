import { Platform } from 'react-native';
import type { LiveKey } from '@/types/api';

export const formatPin = (pin: string) => (pin.length === 6 ? `${pin.slice(0, 3)} ${pin.slice(3)}` : pin);

export const initialsOf = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return ((parts[parts.length - 1]?.[0] ?? '') + (parts.length > 1 ? parts[0][0] : '')).toUpperCase();
};

export const avatarColor = (seed: string) => {
  const colors = ['#b91c1c', '#0369a1', '#d97706', '#0f766e', '#7e22ce', '#c2410c', '#9f1239', '#2b70c9'];
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return colors[h % colors.length];
};

const pad = (n: number) => String(n).padStart(2, '0');

/** "24/10/26 08:30" (không phụ thuộc bộ dữ liệu ngôn ngữ của máy) */
export const formatDateTime = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Tỷ lệ 0..1 -> "85%" (chưa có dữ liệu -> "—") */
export const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${Math.round(v * 100)}%`);

/** "Nguyễn Văn Long" -> "Văn Long" */
export const shortName = (n: string) => n.trim().split(/\s+/).slice(-2).join(' ');

/** Bỏ tiền tố "A. ", "B. "... khỏi đáp án để hiển thị trên ô màu Kahoot */
export const stripOptionPrefix = (text: string) => text.replace(/^[A-D][.)]\s*/, '');

/** 12345 -> "12.345" */
export const fmt = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export const fmtClock = (sec: number) => {
  const s = Math.max(0, Math.ceil(sec));
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
};

/** So khớp khóa đáp án kể cả kiểu (true khác 1) – giống cách server chấm */
export const sameLiveKey = (a: LiveKey | null | undefined, b: LiveKey | null | undefined) =>
  a !== null && a !== undefined && b !== null && b !== undefined && typeof a === typeof b && a === b;

/** Địa chỉ trang web của một cổng (in phiếu tài khoản, link vào phòng thi đấu); chỉ có khi chạy trên web */
export const webHref = (path: string) => {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !/^https?:$/.test(window.location.protocol)) return null;
  return `${window.location.origin}${path}`;
};
