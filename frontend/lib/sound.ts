/** Âm báo ngắn bằng WebAudio (mặc định tắt) */
export const playTone = (kind: 'ok' | 'bad' | 'win') => {
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
    window.setTimeout(() => ctx.close(), 1200);
  } catch {
    // Trình duyệt chặn âm thanh: bỏ qua
  }
};
