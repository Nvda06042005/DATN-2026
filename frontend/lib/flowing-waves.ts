/** Original ribbon geometry inspired by the supplied wave/particle reference. */
export const RIBBON_WIDTH = 1440;
export const RIBBON_HEIGHT = 24;
export const RIBBON_LINES = 7;
export const RIBBON_DOTS = 20;

export function ribbonY(x: number, time: number, line: number) {
  const u = x / RIBBON_WIDTH;
  const ramp = Math.max(0, Math.min(1, (u - 0.08) / 0.8));
  const envelope = 0.08 + 0.92 * ramp * ramp * (3 - 2 * ramp);
  return 12 + (line - 3) * 0.55 + envelope * (
    Math.sin(u * Math.PI * 4.2 - time * 0.38 + line * 0.53) * 6.2 +
    Math.sin(u * Math.PI * 7 + time * 0.27 + line * 0.42) * 1.2
  );
}

export function ribbonPath(time: number, line: number) {
  return Array.from({ length: 81 }, (_, i) => {
    const x = i * RIBBON_WIDTH / 80;
    return `${i ? 'L' : 'M'}${x.toFixed(1)} ${ribbonY(x, time, line).toFixed(2)}`;
  }).join(' ');
}

export function ribbonDot(index: number, time: number) {
  return {
    x: ((index * 137.51 + 41 + time * (2 + index % 3)) % RIBBON_WIDTH),
    y: ((index * 7.91 + 2 + time * (0.32 + index % 4 * 0.1)) % RIBBON_HEIGHT),
    radius: index % 4 === 0 ? 0.9 : 0.55,
    opacity: 0.2 + (Math.sin(time * 0.5 + index * 1.7) + 1) * 0.18,
  };
}
