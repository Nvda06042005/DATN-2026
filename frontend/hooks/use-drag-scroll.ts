import { useEffect, useRef, type RefObject } from 'react';
import { Platform, type ViewInstance } from 'react-native';

/** Kéo chuột trên một cảnh để cuộn ScrollView; không chiếm thao tác cảm ứng hoặc nút con. */
export function useDragScroll(ref: RefObject<ViewInstance | null>, enabled: boolean) {
  const dragged = useRef(false);
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return undefined;
    const target = ref.current as unknown as HTMLElement | null;
    if (!target) return undefined;
    let scroller: HTMLElement | null = target;
    while (scroller && (!/auto|scroll/.test(getComputedStyle(scroller).overflowY) || scroller.scrollHeight <= scroller.clientHeight)) scroller = scroller.parentElement;
    if (!scroller) return undefined;
    const host = scroller;
    let startY = 0, startScroll = 0;
    let pointer: number | null = null;
    let reset: ReturnType<typeof setTimeout>;
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      const control = (e.target as Element).closest('a,input,select,textarea,button,[role="button"],[role="tab"],[role="link"]');
      if (control && control !== target) return;
      clearTimeout(reset);
      dragged.current = false;
      pointer = e.pointerId;
      startY = e.clientY;
      startScroll = host.scrollTop;
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      const delta = startY - e.clientY;
      if (Math.abs(delta) > 8) dragged.current = true;
      if (dragged.current) {
        target.setPointerCapture(e.pointerId);
        host.scrollTop = startScroll + delta * 2;
        e.preventDefault();
      }
    };
    const end = () => { pointer = null; reset = setTimeout(() => { dragged.current = false; }, 0); };
    target.addEventListener('pointerdown', down);
    target.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      target.removeEventListener('pointerdown', down);
      target.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      clearTimeout(reset);
    };
  }, [ref, enabled]);
  return dragged;
}
