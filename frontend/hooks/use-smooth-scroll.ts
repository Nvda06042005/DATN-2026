import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * Cuộn mượt khi lăn chuột trên web (kiểu thư viện Lenis): mỗi cú lăn chỉ dời đích cuộn, vị trí thật đuổi theo đích bằng
 * nội suy theo từng khung hình nên trang trượt êm thay vì nhảy từng nấc. Kéo thanh cuộn, phím mũi tên, cuộn bằng cảm ứng
 * và liên kết neo vẫn do trình duyệt xử lý; mỗi lần cuộn ngoài tầm kiểm soát này, đích được đồng bộ lại theo vị trí thật.
 * `getNode` trả về phần tử DOM đang cuộn (ScrollView của react-native-web: `getScrollableNode()`).
 */
export function useSmoothScroll(getNode: () => HTMLElement | null, enabled: boolean, ease = 0.11) {
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return undefined;
    const el = getNode();
    if (!el) return undefined;

    let target = el.scrollTop;
    let current = el.scrollTop;
    let raf = 0;
    let running = false;
    const limit = () => Math.max(0, el.scrollHeight - el.clientHeight);

    const tick = () => {
      const diff = target - current;
      if (Math.abs(diff) < 0.4) {
        current = target;
        el.scrollTop = current;
        running = false;
        return;
      }
      current += diff * ease;
      el.scrollTop = current;
      raf = requestAnimationFrame(tick);
    };

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey || e.defaultPrevented) return; // thu phóng
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // lăn ngang
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 36 : e.deltaMode === 2 ? el.clientHeight : 1;
      if (!running) {
        current = el.scrollTop;
        target = current;
      }
      target = Math.min(limit(), Math.max(0, target + e.deltaY * unit));
      if (!running) {
        running = true;
        raf = requestAnimationFrame(tick);
      }
    };

    const onScroll = () => {
      if (running) return;
      current = el.scrollTop;
      target = current;
    };
    const interrupt = () => {
      cancelAnimationFrame(raf);
      running = false;
      current = target = el.scrollTop;
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('pointerdown', interrupt, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('pointerdown', interrupt);
    };
  }, [getNode, enabled, ease]);
}
