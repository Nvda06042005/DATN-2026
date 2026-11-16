/**
 * Âm thanh của Hành trình Đông A: các tiếng ngắn tổng hợp bằng Web Audio (không dùng tệp âm thanh). Mặc định TẮT; chỉ phát sau khi người dùng tự bật
 * bằng nút âm thanh (lựa chọn được nhớ trên trình duyệt). Trên điện thoại (không có Web Audio) các hàm này không làm gì.
 */
type Tone = 'tap' | 'right' | 'wrong' | 'hit' | 'win' | 'lose' | 'reward' | 'step';
const KEY = 'donga_saga_sound';
let enabled = false;
let ctx: AudioContext | null = null;

const storage = (): Storage | null => { try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; } };

export function soundEnabled(): boolean {
  if (!enabled) enabled = storage()?.getItem(KEY) === '1';
  return enabled;
}

/** Gọi từ thao tác bấm của người dùng: trình duyệt chỉ cho mở âm thanh sau một cử chỉ */
export function setSound(on: boolean): void {
  enabled = on;
  try { storage()?.setItem(KEY, on ? '1' : '0'); } catch { /* chế độ riêng tư: bỏ qua việc ghi nhớ */ }
  if (on) { open(); play('tap'); }
}

function open(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

const NOTES: Record<Tone, Array<[number, number, number, OscillatorType?]>> = {
  // [tần số Hz, bắt đầu (giây), độ dài (giây), dạng sóng]
  tap: [[520, 0, 0.05, 'triangle']],
  step: [[330, 0, 0.04, 'triangle']],
  right: [[660, 0, 0.09, 'triangle'], [880, 0.09, 0.14, 'triangle']],
  wrong: [[220, 0, 0.12, 'sawtooth'], [165, 0.11, 0.18, 'sawtooth']],
  hit: [[140, 0, 0.08, 'square'], [90, 0.05, 0.1, 'square']],
  reward: [[523, 0, 0.09, 'triangle'], [659, 0.09, 0.09, 'triangle'], [784, 0.18, 0.09, 'triangle'], [1047, 0.27, 0.22, 'triangle']],
  win: [[392, 0, 0.12, 'triangle'], [523, 0.12, 0.12, 'triangle'], [659, 0.24, 0.12, 'triangle'], [784, 0.36, 0.3, 'triangle']],
  lose: [[330, 0, 0.16, 'sine'], [262, 0.16, 0.16, 'sine'], [196, 0.32, 0.3, 'sine']],
};

export function play(tone: Tone): void {
  if (!soundEnabled()) return;
  const audio = open();
  if (!audio) return;
  const now = audio.currentTime;
  for (const [freq, at, len, wave] of NOTES[tone]) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = wave ?? 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now + at);
    gain.gain.exponentialRampToValueAtTime(0.09, now + at + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + at + len);
    osc.connect(gain).connect(audio.destination);
    osc.start(now + at);
    osc.stop(now + at + len + 0.02);
  }
}
