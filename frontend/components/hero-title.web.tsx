import { useEffect, useRef, useState } from 'react';
import MetallicPaint from '@/components/react-bits/metallic-paint.web';
import { FONT } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';
import { BrandWordmark, brandMaskSvg } from '@/components/brand-wordmark';
import { BRAND_CORE_WIDTH, BRAND_HEIGHT } from '@/constants/brand';

type Mask = { canvas: HTMLCanvasElement; width: number; height: number; padding: number };

/** Match the actual DOM font, tracking and baseline instead of scaling a separate text image. */
function MetallicWord({ text, family, tint, tracking, enabled, testID = 'hero-title-word' }: {
  text: string; family: string; tint: string; tracking: number; enabled: boolean; testID?: string;
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
    <span data-testid={testID} style={{ position: 'relative', display: 'inline-block', fontFamily: family, letterSpacing: tracking, color: tint, whiteSpace: 'pre' }}>
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

function MetallicBrand({ height, tint, enabled, testID }: { height: number; tint: string; enabled: boolean; testID: string }) {
  const width = height * BRAND_CORE_WIDTH / BRAND_HEIGHT;
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
    if (!enabled) { setCanvas(null); return undefined; }
    let active = true;
    const image = new Image();
    image.onload = () => {
      if (!active) return;
      const mask = document.createElement('canvas');
      mask.width = Math.ceil((width + 24) * 2); mask.height = (height + 24) * 2;
      const ctx = mask.getContext('2d');
      if (!ctx) return;
      ctx.scale(2, 2); ctx.drawImage(image, 12, 12, width, height); setCanvas(mask);
    };
    image.src = `data:image/svg+xml,${encodeURIComponent(brandMaskSvg(tint))}`;
    return () => { active = false; };
  }, [enabled, height, tint, width]);
  return (
    <span data-testid={testID} style={{ position: 'relative', display: 'inline-block', width, height, verticalAlign: '-0.13em', color: tint }}>
      <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}>Đông A</span>
      <BrandWordmark height={height} color={tint} edu={false} />
      {enabled && canvas && <MetallicPaint sourceCanvas={canvas} color={tint} density={1.8} softness={0.4} dispersion={0.02} distortion={0.05} edgeBend={0.5} speed={0.32} scale={1} mouseTilt={0.15} intro={false} dpr={2} onReady={() => setReady(true)} onError={() => setReady(false)} style={{ position: 'absolute', left: -12, top: -12, width: width + 24, height: height + 24, pointerEvents: 'none', opacity: ready ? 0.7 : 0 }} />}
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
      <MetallicBrand height={wide ? 106 : 58} tint={c.sonSang} enabled={wide && !reduce} testID="hero-title-brand" />
    </h1>
  );
}

/** Lời mời cuối trang dùng cùng ánh kim với tiêu đề bìa; màn hẹp giữ chữ thật để xuống dòng tự nhiên. */
export function ClosingTitle({ wide }: { wide: boolean }) {
  const { c } = useTheme();
  const reduce = useReduceMotion();
  const enabled = wide && !reduce;
  return (
    <h2 data-testid="closing-title" style={{ margin: 0, maxWidth: '100%', textAlign: 'center', fontFamily: FONT.heavy, fontWeight: 400, fontSize: wide ? 64 : 36, lineHeight: wide ? '70px' : '42px', letterSpacing: wide ? -2 : -1, color: c.trang, textShadow: `0 4px 22px ${c.den}` }}>
      {wide ? <MetallicWord text="Cùng cả lớp ra trận" family={FONT.heavy} tint={c.trang} tracking={-2} enabled={enabled} testID="closing-title-word" /> : 'Cùng cả lớp ra trận'}
      <br />
      {wide ? <MetallicWord text="với" family={FONT.heavy} tint={c.trang} tracking={-2} enabled={enabled} testID="closing-title-word" /> : 'với'}
      {' '}
      <MetallicBrand height={wide ? 70 : 42} tint={c.sonSang} enabled={enabled} testID="closing-title-accent" />
      {wide ? <MetallicWord text="!" family={FONT.heavy} tint={c.trang} tracking={-2} enabled={enabled} testID="closing-title-word" /> : '!'}
    </h2>
  );
}
