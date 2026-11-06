/**
 * Giao diện của Quiz (HK.GV.093): nền theo chủ đề lịch sử và nhạc chờ ở phòng chờ.
 * Nền chỉ là màu và hoa văn vẽ bằng khung (không cần tệp ảnh); nhạc chờ là giai điệu ngũ cung ngắn do trình duyệt tự phát (Web Audio),
 * chỉ bật khi giáo viên bấm nút nên không vi phạm quy tắc tự phát âm thanh của trình duyệt, và tắt được bất cứ lúc nào.
 */
import React, { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';
import { mediaUri } from '@/components/portal/Media';
import type { LiveTheme } from '@/types/live';

export interface ThemeSpec { id: string; label: string; bg: string | null; accent: string | null }
export const LIVE_BACKGROUNDS: ThemeSpec[] = [
  { id: 'default', label: 'Mặc định', bg: null, accent: null },
  { id: 'bach-dang', label: 'Bạch Đằng', bg: '#0f3d4c', accent: '#38bdf8' },
  { id: 'thang-long', label: 'Thăng Long', bg: '#6b1a1a', accent: '#f2c14e' },
  { id: 'chuong-duong', label: 'Chương Dương', bg: '#1f4d34', accent: '#a3e635' },
  { id: 'dong-bo-dau', label: 'Đông Bộ Đầu', bg: '#4a3a1a', accent: '#fbbf24' },
];
export const LIVE_MUSIC: Array<{ id: string; label: string }> = [
  { id: 'none', label: 'Không có nhạc' }, { id: 'trong-tran', label: 'Trống trận' }, { id: 'song-nuoc', label: 'Sóng nước' }, { id: 'hao-khi', label: 'Hào khí' },
];

export const themeOf = (theme: LiveTheme | Record<string, unknown> | null | undefined): ThemeSpec => LIVE_BACKGROUNDS.find((b) => b.id === (theme as LiveTheme | undefined)?.bg) ?? LIVE_BACKGROUNDS[0];

/** Khung nền theo giao diện: nền màu quanh nội dung và hai vệt hoa văn góc; giao diện mặc định không thêm gì */
export const ThemeFrame: React.FC<{ theme: LiveTheme | Record<string, unknown> | null | undefined; children: React.ReactNode }> = ({ theme, children }) => {
  const spec = themeOf(theme);
  if (!spec.bg) return <>{children}</>;
  return (
    <View style={{ backgroundColor: spec.bg, borderRadius: 20, padding: 14, gap: 14, overflow: 'hidden' }}>
      <View pointerEvents="none" style={{ position: 'absolute', top: -60, right: -60, width: 180, height: 180, borderRadius: 90, backgroundColor: `${spec.accent}33` }} />
      <View pointerEvents="none" style={{ position: 'absolute', bottom: -70, left: -50, width: 200, height: 200, borderRadius: 100, backgroundColor: `${spec.accent}22` }} />
      {children}
    </View>
  );
};

// ---------------------------------------------------------------------- nhạc chờ
/** [tần số Hz, số phách]; 0 là nghỉ. Âm ngũ cung (Đô – Rê – Mi – Sol – La) cho cảm giác dân tộc */
const TRACKS: Record<string, { tempo: number; wave: OscillatorType; notes: Array<[number, number]> }> = {
  'trong-tran': { tempo: 92, wave: 'triangle', notes: [[196, 1], [0, 0.5], [196, 0.5], [262, 1], [0, 1], [196, 1], [294, 1], [262, 1], [0, 1]] },
  'song-nuoc': { tempo: 70, wave: 'sine', notes: [[262, 1], [294, 1], [330, 1], [392, 2], [330, 1], [294, 1], [262, 2], [220, 2]] },
  'hao-khi': { tempo: 110, wave: 'square', notes: [[330, 1], [392, 1], [440, 2], [392, 1], [330, 1], [294, 2], [262, 1], [294, 1], [330, 2], [0, 1]] },
};

/** Phát vòng lặp nhạc chờ khi `on`; dừng và dọn dẹp khi tắt hoặc rời màn hình. Chỉ chạy trên web */
export function useLobbyMusic(track: string | undefined, on: boolean, url?: string | null): void {
  const ctx = useRef<AudioContext | null>(null);
  // Nhạc chờ là tệp giáo viên tải lên (HK.GV.093): phát lặp bằng thẻ audio, chỉ khi giáo viên bấm bật
  useEffect(() => {
    if (!on || track !== 'upload' || !url || Platform.OS !== 'web' || typeof Audio === 'undefined') return undefined;
    const el = new Audio(mediaUri(url));
    el.loop = true;
    el.volume = 0.5;
    void el.play().catch(() => undefined);
    return () => { el.pause(); el.removeAttribute('src'); el.load(); };
  }, [track, on, url]);
  useEffect(() => {
    const spec = track ? TRACKS[track] : undefined;
    if (!on || !spec || Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const Ctor: typeof AudioContext | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return undefined;
    const audio = new Ctor();
    ctx.current = audio;
    const master = audio.createGain();
    master.gain.value = 0.05;
    master.connect(audio.destination);
    const beat = 60 / spec.tempo;
    const total = spec.notes.reduce((n, [, b]) => n + b, 0) * beat;
    const schedule = (from: number) => {
      let t = from;
      for (const [freq, beats] of spec.notes) {
        if (freq > 0) {
          const osc = audio.createOscillator();
          const env = audio.createGain();
          osc.type = spec.wave;
          osc.frequency.value = freq;
          env.gain.setValueAtTime(0.0001, t);
          env.gain.exponentialRampToValueAtTime(1, t + 0.02);
          env.gain.exponentialRampToValueAtTime(0.0001, t + beats * beat * 0.95);
          osc.connect(env).connect(master);
          osc.start(t);
          osc.stop(t + beats * beat);
        }
        t += beats * beat;
      }
    };
    let next = audio.currentTime + 0.05;
    schedule(next);
    const timer = setInterval(() => {
      next += total;
      schedule(next);
    }, total * 1000);
    return () => {
      clearInterval(timer);
      void audio.close().catch(() => undefined);
      ctx.current = null;
    };
  }, [track, on]);
}
