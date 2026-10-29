import { useEffect, useRef, useState } from 'react';
import MetallicPaint from '@/components/react-bits/metallic-paint.web';
import { FONT } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';

type Mask = { canvas: HTMLCanvasElement; width: number; height: number; padding: number };

/** Match the actual DOM font, tracking and baseline instead of scaling a separate text image. */
function MetallicWord({ text, family, tint, tracking, enabled }: {
  text: string; family: string; tint: string; tracking: number; enabled: boolean;
}) {
  const source = useRef<HTMLSpanElement>(null);
  const baseline = useRef<HTMLSpanElement>(null);
  const [mask, setMask] = useState<Mask | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled) { setReady(false); setMask(null); return; }
    const element = source.current;
    const marker = baseline.current;
    if (!element || !marker) return;
    let active = true;
    let frame = 0;
    let previous = '';
    const rebuild = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!active) return;
        const style = getComputedStyle(element);
        const width = parseFloat(style.width) || element.offsetWidth;
        const height = parseFloat(style.height) || element.offsetHeight;
        if (!width || !height) return;
        const rect = element.getBoundingClientRect();
        const textBaseline = (marker.getBoundingClientRect().top - rect.top) / (rect.height / height || 1);
        const signature = [width, height, textBaseline, style.fontFamily, style.fontSize, style.letterSpacing].join(':');
        if (previous === signature) return;
        previous = signature;
        const padding = 12;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil((width + padding * 2) * ratio);
        canvas.height = Math.ceil((height + padding * 2) * ratio);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.scale(ratio, ratio);
        ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = tint;
        ctx.letterSpacing = style.letterSpacing;
        ctx.fillText(text, padding, padding + textBaseline);
        setReady(false);
        setMask({ canvas, width: width + padding * 2, height: height + padding * 2, padding });
      });
    };
    const observer = new ResizeObserver(rebuild);
    observer.observe(element);
    void document.fonts.ready.then(() => { if (active) rebuild(); });
    return () => { active = false; cancelAnimationFrame(frame); observer.disconnect(); };
  }, [enabled, text, family, tint, tracking]);

  return (
    <span data-testid="hero-title-word" style={{ position: 'relative', display: 'inline-block', fontFamily: family, letterSpacing: tracking, color: tint, whiteSpace: 'pre' }}>
      <span ref={source} style={{ display: 'inline-block' }}>
        {text}<span ref={baseline} aria-hidden="true" style={{ display: 'inline-block', width: 0, height: 0, verticalAlign: 'baseline' }} />
      </span>
      {enabled && mask && (
        <MetallicPaint
          sourceCanvas={mask.canvas}
          color={tint}
          density={1.8}
          softness={0.4}
          dispersion={0.02}
          distortion={0.05}
          edgeBend={0.5}
          speed={0.32}
          scale={1}
          mouseTilt={0.15}
          intro={false}
          dpr={2}
          onReady={() => setReady(true)}
          onError={() => setReady(false)}
          style={{ position: 'absolute', left: -mask.padding, top: -mask.padding, width: mask.width, height: mask.height, pointerEvents: 'none', opacity: ready ? 0.7 : 0, textShadow: 'none' }}
        />
      )}
    </span>
  );
}

export function HeroTitle({ wide }: { wide: boolean }) {
  const { c } = useTheme();
  const reduce = useReduceMotion();
  return (
    <h1 data-testid="hero-title" style={{ margin: 0, maxWidth: '100%', textAlign: 'center', fontFamily: FONT.heavy, fontWeight: 400, fontSize: wide ? 96 : 50, lineHeight: wide ? '108px' : '58px', textShadow: `0 4px 22px ${c.den}` }}>
      <MetallicWord text="Hào Khí" family={FONT.heavy} tint={c.trang} tracking={wide ? -3.6 : -1.8} enabled={wide && !reduce} />
      {' '}
      <MetallicWord text="Đông A" family={FONT.serifItalic} tint={c.sonSang} tracking={wide ? -2 : -1} enabled={wide && !reduce} />
    </h1>
  );
}
