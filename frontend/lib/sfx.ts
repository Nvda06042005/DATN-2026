/**
 * Âm thanh giao diện của trang chủ, tổng hợp bằng Web Audio (không dùng tệp âm thanh) theo các nút chỉnh của Sound Lab (React Bits):
 * cao độ (pitch), âm sắc (tone), độ dài (length) và độ vang (space). Hiện có "whoosh" mềm khi lướt qua đám mây và "pop" bật/tắt.
 * Quy tắc: chỉ phát sau khi người dùng đã bấm hoặc gõ phím một lần (trình duyệt cấm tự phát), nhỏ tiếng, cách nhau tối thiểu 0,65 giây,
 * có nút tắt/bật ở thanh điều hướng và nhớ lựa chọn; không phát khi bật "Giảm chuyển động". Chỉ chạy trên web.
 */
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { readHomeSound, saveHomeSound } from '@/lib/storage';

const WEB = Platform.OS === 'web' && typeof window !== 'undefined';
const COOLDOWN_MS = 650;

type Ctx = AudioContext;
let ctx: Ctx | null = null;
let master: GainNode | null = null;
let reverb: ConvolverNode | null = null;
let noise: AudioBuffer | null = null;
let last = 0;
let on = readHomeSound() ?? true;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

/** Tạo bộ phát khi lần đầu có thao tác của người dùng (bấm, chạm hoặc gõ phím) */
const start = () => {
  if (!WEB || ctx) {
    void ctx?.resume();
    return;
  }
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);
  // nhiễu trắng 1 giây dùng chung cho mọi tiếng gió
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // độ vang: xung đáp ngắn tắt dần (0,7 giây)
  const len = Math.floor(ctx.sampleRate * 0.7);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  reverb = ctx.createConvolver();
  reverb.buffer = ir;
  reverb.connect(master);
  void ctx.resume();
};

if (WEB) {
  const unlock = () => {
    start();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
}

export interface Whoosh {
  /** up: tiếng gió đi lên (cao dần), down: đi xuống (thấp dần) */
  dir?: 'up' | 'down';
  /** tần số giữa của dải gió, Hz */
  pitch?: number;
  /** độ sắc của dải gió (Q): càng lớn càng "huýt" */
  tone?: number;
  /** thời lượng, giây */
  length?: number;
  /** độ vang 0 – 1 */
  space?: number;
  /** âm lượng đỉnh 0 – 1 */
  gain?: number;
}

/** Tiếng gió mềm: nhiễu đi qua bộ lọc dải quét từ thấp lên cao (hoặc ngược lại), vào nhanh, tắt êm, kèm chút vang */
export const playWhoosh = ({ dir = 'down', pitch = 600, tone = 1.1, length = 0.8, space = 0.4, gain = 0.07 }: Whoosh = {}) => {
  if (!WEB || !on || !ctx || !master || !reverb || !noise || ctx.state !== 'running') return;
  const now = performance.now();
  if (now - last < COOLDOWN_MS || document.visibilityState !== 'visible') return;
  last = now;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = tone;
  const from = dir === 'up' ? pitch * 0.45 : pitch * 1.7;
  const to = dir === 'up' ? pitch * 1.7 : pitch * 0.45;
  band.frequency.setValueAtTime(from, t);
  band.frequency.exponentialRampToValueAtTime(to, t + length);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + length * 0.35);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + length);
  const wet = ctx.createGain();
  wet.gain.value = space;
  src.connect(band);
  band.connect(amp);
  amp.connect(master);
  amp.connect(wet);
  wet.connect(reverb);
  src.start(t);
  src.stop(t + length + 0.05);
};

/** Tiếng "pop" ngắn khi bật âm thanh: hai nốt sin liền nhau, lên cao */
const playPop = () => {
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  [660, 990].forEach((f, i) => {
    const o = ctx!.createOscillator();
    const g = ctx!.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t + i * 0.07);
    g.gain.exponentialRampToValueAtTime(0.06, t + i * 0.07 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.07 + 0.16);
    o.connect(g);
    g.connect(master!);
    o.start(t + i * 0.07);
    o.stop(t + i * 0.07 + 0.2);
  });
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** Trạng thái bật/tắt âm thanh hiệu ứng và hàm đảo trạng thái (bấm nút là thao tác của người dùng nên bật được âm thanh ngay) */
export const useSound = (): [boolean, () => void] => {
  const value = useSyncExternalStore(subscribe, () => on, () => on);
  const toggle = () => {
    on = !on;
    saveHomeSound(on);
    emit();
    if (on) {
      start();
      playPop();
    }
  };
  return [value, toggle];
};
