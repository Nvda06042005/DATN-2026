export const formatPin = (pin: string) => (pin.length === 6 ? `${pin.slice(0, 3)} ${pin.slice(3)}` : pin);

export const initialsOf = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return ((parts[parts.length - 1]?.[0] ?? '') + (parts.length > 1 ? parts[0][0] : '')).toUpperCase();
};

export const avatarColor = (seed: string) => {
  const colors = ['#b91c1c', '#0369a1', '#d97706', '#0f766e', '#7e22ce', '#c2410c', '#b91c1c', '#2b70c9'];
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return colors[h % colors.length];
};

export const formatDateTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '—');

/** Tỷ lệ 0..1 -> "85%" (chưa có dữ liệu -> "—") */
export const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${Math.round(v * 100)}%`);

/** "Nguyễn Văn Long" -> "Văn Long" */
export const shortName = (n: string) => n.trim().split(/\s+/).slice(-2).join(' ');

/** Bỏ tiền tố "A. ", "B. "... khỏi đáp án để hiển thị trên ô màu Kahoot */
export const stripOptionPrefix = (text: string) => text.replace(/^[A-D][.)]\s*/, '');

export const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN');

export const fmtClock = (sec: number) => {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
