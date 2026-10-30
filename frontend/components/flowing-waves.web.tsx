import { useEffect, useRef } from 'react';
import { useWindowDimensions } from 'react-native';
import { useReduceMotion } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';
import { RIBBON_DOTS, RIBBON_HEIGHT, RIBBON_LINES, RIBBON_WIDTH, ribbonDot, ribbonPath, ribbonY } from '@/lib/flowing-waves';

/** Independently drawn waves and drifting particles; no site assets or source code are copied. */
export function FlowingWaves() {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const reduce = useReduceMotion();
  const canvas = useRef<HTMLCanvasElement>(null);
  const moving = width >= 900 && !reduce;
  useEffect(() => {
    if (!moving || !canvas.current) return undefined;
    const element = canvas.current, ctx = element.getContext('2d');
    if (!ctx) return undefined;
    let frame = 0, last = 0, painted = 0, phase = 0, visible = false, alive = true;
    const draw = () => {
      const w = element.width, h = element.height;
      ctx.setTransform(w / RIBBON_WIDTH, 0, 0, h / RIBBON_HEIGHT, 0, 0);
      ctx.clearRect(0, 0, RIBBON_WIDTH, RIBBON_HEIGHT);
      for (let line = 0; line < RIBBON_LINES; line++) {
        ctx.beginPath();
        for (let i = 0; i <= 80; i++) {
          const x = i * RIBBON_WIDTH / 80, y = ribbonY(x, phase, line);
          if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.strokeStyle = line === RIBBON_LINES - 1 ? c.logoRed : line % 2 ? c.logoGold : c.logoInk;
        ctx.lineWidth = line === RIBBON_LINES - 1 ? 1.15 : 0.75;
        ctx.globalAlpha = line === RIBBON_LINES - 1 ? 1 : 0.3 + line * 0.07;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.stroke();
      }
      for (let i = 0; i < RIBBON_DOTS; i++) {
        const dot = ribbonDot(i, phase);
        ctx.beginPath(); ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
        ctx.fillStyle = i % 3 ? c.logoRed : c.logoGold; ctx.globalAlpha = dot.opacity; ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    const tick = (now: number) => {
      frame = 0;
      if (!alive || !visible || document.hidden) { last = 0; return; }
      if (now - painted >= 1000 / 30) {
        phase += last ? Math.min(0.05, (now - last) / 1000) : 0;
        last = now; painted = now; draw();
      }
      frame = requestAnimationFrame(tick);
    };
    const wake = () => { if (alive && visible && !document.hidden && !frame) { last = 0; frame = requestAnimationFrame(tick); } };
    const resize = () => {
      const rect = element.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      element.width = Math.max(1, Math.min(1600, Math.round(rect.width * dpr)));
      element.height = Math.max(1, Math.round(rect.height * dpr)); draw();
    };
    const observer = new IntersectionObserver(entries => { visible = entries.some(entry => entry.isIntersecting); if (visible) wake(); });
    const sizes = new ResizeObserver(resize);
    sizes.observe(element); observer.observe(element); document.addEventListener('visibilitychange', wake); resize();
    return () => { alive = false; cancelAnimationFrame(frame); sizes.disconnect(); observer.disconnect(); document.removeEventListener('visibilitychange', wake); };
  }, [moving, c.logoRed, c.logoGold, c.logoInk]);
  return <div data-testid="flowing-waves" aria-hidden="true" style={{ position: 'absolute', inset: 0, opacity: 0.2, overflow: 'hidden', pointerEvents: 'none' }}>
    {moving ? <canvas ref={canvas} data-testid="flowing-waves-canvas" style={{ width: '100%', height: '100%', display: 'block' }} /> : <svg data-testid="flowing-waves-static" width="100%" height="100%" viewBox={`0 0 ${RIBBON_WIDTH} ${RIBBON_HEIGHT}`} preserveAspectRatio="none">
      {Array.from({ length: RIBBON_LINES }, (_, i) => <path key={i} d={ribbonPath(0, i)} fill="none" stroke={i === RIBBON_LINES - 1 ? c.logoRed : i % 2 ? c.logoGold : c.logoInk} strokeWidth={i === RIBBON_LINES - 1 ? 1.15 : 0.75} opacity={i === RIBBON_LINES - 1 ? 1 : 0.3 + i * 0.07} />)}
      {Array.from({ length: RIBBON_DOTS }, (_, i) => { const dot = ribbonDot(i, 0); return <circle key={i} cx={dot.x} cy={dot.y} r={dot.radius} fill={i % 3 ? c.logoRed : c.logoGold} opacity={dot.opacity} />; })}
    </svg>}
  </div>;
}
