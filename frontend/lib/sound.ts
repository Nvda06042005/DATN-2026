import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** Phản hồi khi trả lời: rung nhẹ trên điện thoại, âm báo ngắn (WebAudio) trên web. Mặc định tắt trong cài đặt game. */
export const playTone = (kind: 'ok' | 'bad' | 'win') => {
  if (Platform.OS !== 'web') {
    const type = kind === 'bad' ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success;
    Haptics.notificationAsync(type).catch(() => undefined);
    return;
  }
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const notes = kind === 'ok' ? [660, 880] : kind === 'win' ? [523, 659, 784, 1046] : [220, 170];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = kind === 'bad' ? 'triangle' : 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.12);
      g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + i * 0.12 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.12 + 0.18);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.12);
      o.stop(ctx.currentTime + i * 0.12 + 0.2);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch {
    // Trình duyệt chặn âm thanh: bỏ qua
  }
};
