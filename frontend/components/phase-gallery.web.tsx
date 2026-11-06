import { useEffect, useMemo, useRef, useState } from 'react';
import { animate, motionValue, type AnimationPlaybackControls } from 'motion';
import { useReduceMotion } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';
import type { PhaseGalleryProps } from './phase-gallery.types';

/** Original cylinder arrangement inspired by Motion's public Barrel demo, using only free Motion APIs. */
export function PhaseGallery({ items, wide, paused, onSelect }: PhaseGalleryProps) {
  const { c } = useTheme();
  const reduce = useReduceMotion();
  const host = useRef<HTMLDivElement>(null), ring = useRef<HTMLDivElement>(null);
  const cards = useRef<Array<HTMLButtonElement | null>>([]);
  const rotation = useMemo(() => motionValue(0), []);
  const animation = useRef<AnimationPlaybackControls | null>(null);
  const [current, setCurrent] = useState(0), [hover, setHover] = useState(false), [focus, setFocus] = useState(false);
  const dragging = useRef(false);
  const pointer = useRef<{ id: number; x: number; angle: number; last: number; time: number; velocity: number } | null>(null);
  const step = 360 / items.length, cardWidth = wide ? 300 : 240, cardHeight = wide ? 390 : 350;
  const radius = (cardWidth + 22) / (2 * Math.sin(Math.PI / items.length));

  useEffect(() => {
    if (reduce) return undefined;
    const render = (angle: number) => {
      if (ring.current) ring.current.style.transform = `translateZ(${-radius}px) rotateY(${angle}deg)`;
      const selected = ((Math.round(-angle / step) % items.length) + items.length) % items.length;
      setCurrent(previous => previous === selected ? previous : selected);
      cards.current.forEach((card, i) => {
        if (!card) return;
        const front = Math.cos((i * step + angle) * Math.PI / 180);
        card.style.opacity = String(front <= 0 ? 0 : 0.58 + front * 0.42);
        card.setAttribute('aria-hidden', front <= 0 ? 'true' : 'false');
        card.tabIndex = i === selected ? 0 : -1;
      });
    };
    render(rotation.get());
    return rotation.on('change', render);
  }, [rotation, radius, step, items.length, reduce]);

  useEffect(() => {
    if (reduce || paused) { animation.current?.stop(); return undefined; }
    if (hover || focus) return undefined;
    const element = host.current;
    if (!element) return undefined;
    let visible = false, raf = 0, last = 0;
    const frame = (time: number) => {
      raf = 0;
      if (!visible || document.hidden) { last = 0; return; }
      if (last && !pointer.current) rotation.set(rotation.get() - Math.min(50, time - last) * 0.003);
      last = time; raf = requestAnimationFrame(frame);
    };
    const wake = () => { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame); };
    const observer = new IntersectionObserver(entries => { visible = entries.some(entry => entry.isIntersecting); last = 0; wake(); });
    observer.observe(element); document.addEventListener('visibilitychange', wake);
    return () => { observer.disconnect(); cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', wake); };
  }, [rotation, reduce, paused, hover, focus]);

  useEffect(() => () => animation.current?.stop(), []);
  const move = (index: number) => {
    animation.current?.stop();
    const normalized = ((index % items.length) + items.length) % items.length;
    const front = -normalized * step;
    const target = front + Math.round((rotation.get() - front) / 360) * 360;
    animation.current = animate(rotation, target, { type: 'spring', stiffness: 105, damping: 26 });
  };
  if (reduce) return <div data-testid="phase-gallery-flat" aria-label="Chín màn chiến dịch" style={{ display: 'flex', gap: 18, padding: 20, overflowX: 'auto', width: '100%', boxSizing: 'border-box' }}>{items.map(item => <button type="button" data-testid={`phase-card-${item.id}`} key={item.id} onClick={() => onSelect(item.id)} style={{ flex: `0 0 ${cardWidth}px`, height: cardHeight, padding: 0, border: 0, borderRadius: 28, background: 'transparent', textAlign: 'left', color: 'inherit', cursor: 'pointer' }}>{item.content}</button>)}</div>;
  return (
    <div ref={host} data-testid="phase-gallery-barrel" role="region" aria-label="Gallery chín màn chiến dịch, dùng phím trái phải hoặc kéo để xoay" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onFocusCapture={() => setFocus(true)} onBlurCapture={event => setFocus(event.currentTarget.contains(event.relatedTarget as Node | null))} onKeyDown={event => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); move(current + (event.key === 'ArrowRight' ? 1 : -1)); } }} style={{ width: '100%', position: 'relative' }}>
      <div data-testid="phase-gallery-stage" onPointerDown={event => { if (event.button !== 0 || paused) return; animation.current?.stop(); dragging.current = false; pointer.current = { id: event.pointerId, x: event.clientX, angle: rotation.get(), last: event.clientX, time: performance.now(), velocity: 0 }; }} onPointerMove={event => {
        const p = pointer.current; if (!p || p.id !== event.pointerId) return;
        if (Math.abs(event.clientX - p.x) > 7) dragging.current = true;
        if (!dragging.current) return;
        event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault();
        const now = performance.now(); p.velocity = (event.clientX - p.last) / Math.max(1, now - p.time); p.last = event.clientX; p.time = now;
        rotation.set(p.angle + (event.clientX - p.x) * 0.12);
      }} onPointerUp={() => { const p = pointer.current; pointer.current = null; if (p && dragging.current) { animation.current = animate(rotation, rotation.get() + Math.max(-65, Math.min(65, p.velocity * 35)), { type: 'spring', stiffness: 45, damping: 24 }); setTimeout(() => { dragging.current = false; }, 0); } }} onPointerCancel={() => { pointer.current = null; dragging.current = false; }} onClickCapture={event => { if (dragging.current) { event.preventDefault(); event.stopPropagation(); } }} style={{ height: cardHeight + 44, width: '100%', overflow: 'hidden', perspective: '1400px', touchAction: 'pan-y', cursor: 'grab' }}>
        <div ref={ring} data-testid="phase-gallery-ring" style={{ position: 'absolute', left: '50%', top: '50%', transformStyle: 'preserve-3d', transform: `translateZ(${-radius}px)` }}>
          {items.map((item, i) => <button type="button" key={item.id} ref={element => { cards.current[i] = element; }} data-testid={`phase-card-${item.id}`} aria-label={`Màn ${i + 1}: ${item.title}. Mở cửa sổ đọc chi tiết`} onClick={() => onSelect(item.id)} style={{ position: 'absolute', left: -cardWidth / 2, top: -cardHeight / 2, width: cardWidth, height: cardHeight, transform: `rotateY(${i * step}deg) translateZ(${radius}px)`, backfaceVisibility: 'hidden', transformStyle: 'preserve-3d', padding: 0, border: 0, borderRadius: 28, background: 'transparent', textAlign: 'left', color: 'inherit', cursor: 'pointer', outlineOffset: 4 }}>{item.content}</button>)}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '4px 12px 12px', position: 'relative' }}>
        <button type="button" data-testid="phase-previous" aria-label="Màn trước" onClick={() => move(current - 1)} style={{ width: 44, height: 44, borderRadius: 22, border: `1px solid ${c.logoGold}`, color: c.logoInk, background: c.logoPaper, cursor: 'pointer', fontSize: 24 }}>‹</button>
        <div style={{ display: 'flex', minWidth: 0, maxWidth: wide ? 396 : 180, overflowX: 'auto' }}>{items.map((item, i) => <button key={item.id} type="button" data-testid={`phase-dot-${i + 1}`} aria-label={`Xoay đến màn ${i + 1}: ${item.title}`} aria-current={i === current ? 'true' : undefined} onClick={() => move(i)} style={{ flex: '0 0 44px', width: 44, height: 44, border: 0, padding: 0, background: 'transparent', cursor: 'pointer' }}><span style={{ display: 'block', width: i === current ? 16 : 7, height: 7, borderRadius: 7, margin: 'auto', background: i === current ? c.logoRed : c.logoGold }} /></button>)}</div>
        <button type="button" data-testid="phase-next" aria-label="Màn tiếp theo" onClick={() => move(current + 1)} style={{ width: 44, height: 44, borderRadius: 22, border: `1px solid ${c.logoGold}`, color: c.logoInk, background: c.logoPaper, cursor: 'pointer', fontSize: 24 }}>›</button>
      </div>
    </div>
  );
}
