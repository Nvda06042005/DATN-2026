/**
 * Hiệu ứng chuyển động của trang chủ.
 * - Theo cuộn chuột (chỉ web): `FxProvider` đo vị trí các khối mỗi khung hình khi cuộn; `Reveal` hiện dần khi lướt tới (trồi lên, phóng nhẹ) và mờ dần khi lướt qua,
 *   `useScrollY` cho các hiệu ứng lệch tầng (parallax) ở hero, `CountUp` đếm số khi hiện ra.
 * - Chạy nền: `useLoop` (nhấp nhô qua lại), `useDrift` (trôi liên tục) – chỉ chạy khi cảnh đang nằm trong màn hình (`useOnScreen`) để không tốn máy.
 * - Rê chuột: `Lift` nhấc thẻ lên và dựng thẳng khi trỏ vào.
 * Tắt hết khi người dùng bật "Giảm chuyển động"; trên điện thoại (không có chuột) khối hiện sẵn, không mờ.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, View, type StyleProp, type ViewInstance, type ViewStyle } from 'react-native';
import { useReduceMotion } from '@/hooks/use-motion';

const WEB = Platform.OS === 'web' && typeof window !== 'undefined';
const NATIVE = Platform.OS !== 'web';

interface FxItem {
  el: () => HTMLElement | null;
  /** Trị -1 (đang chờ hiện) … 0 (hiện đủ) … 1 (đã lướt qua, mờ hẳn) */
  progress?: Animated.Value;
  /** Độ trễ tính bằng điểm ảnh: khối xuất hiện muộn hơn khi trượt lên (để các khối cùng hàng lần lượt hiện) */
  delay?: number;
  visible?: (on: boolean) => void;
  /** Biên dung sai theo chiều cao màn hình: dương = tính là đang hiện cả khi còn ở ngoài một chút, âm = phải vào sâu trong màn hình mới tính */
  margin?: number;
  last?: boolean;
}

interface FxApi {
  scrollY: Animated.Value;
  register: (item: FxItem) => () => void;
}

const FxContext = createContext<FxApi | null>(null);

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

/** Vị trí cuộn của trang (0 khi không có provider) */
export const useScrollY = () => useContext(FxContext)?.scrollY ?? null;

export const FxProvider: React.FC<{ scrollY: Animated.Value; children: React.ReactNode }> = ({ scrollY, children }) => {
  const items = useRef(new Set<FxItem>());
  const raf = useRef(0);

  const run = useCallback(() => {
    raf.current = 0;
    if (!WEB) return;
    const vh = window.innerHeight || 800;
    const list = [...items.current];
    // đọc hết kích thước trước rồi mới ghi để trình duyệt không phải tính lại bố cục nhiều lần
    const rects = list.map((it) => {
      const el = it.el();
      return el && typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : null;
    });
    list.forEach((it, i) => {
      const r = rects[i];
      if (!r) return;
      if (it.progress) {
        const rise = vh * 0.22;
        const enter = clamp((r.top + (it.delay ?? 0) - (vh * 0.95 - rise)) / rise);
        const fadeFrom = vh * 0.4;
        const exit = clamp((fadeFrom - r.bottom) / (fadeFrom - 80));
        it.progress.setValue(exit > 0 ? exit : -enter);
      }
      if (it.visible) {
        const m = it.margin ?? 0.25;
        const on = r.bottom > -vh * m && r.top < vh * (1 + m);
        if (on !== it.last) {
          it.last = on;
          it.visible(on);
        }
      }
    });
  }, []);

  const schedule = useCallback(() => {
    if (WEB && !raf.current) raf.current = requestAnimationFrame(run);
  }, [run]);

  useEffect(() => {
    if (!WEB) return undefined;
    const id = scrollY.addListener(schedule);
    window.addEventListener('resize', schedule);
    // bố cục có thể đổi mà không có cuộn (đổi tab, tải phông chữ): đo lại thưa
    const timer = setInterval(schedule, 700);
    schedule();
    return () => {
      scrollY.removeListener(id);
      window.removeEventListener('resize', schedule);
      clearInterval(timer);
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
  }, [scrollY, schedule]);

  const api = useMemo<FxApi>(
    () => ({
      scrollY,
      register: (item) => {
        items.current.add(item);
        schedule();
        return () => {
          items.current.delete(item);
        };
      },
    }),
    [scrollY, schedule],
  );
  return <FxContext.Provider value={api}>{children}</FxContext.Provider>;
};

/**
 * Bọc một khối: hiện dần khi lướt tới (trồi lên, phóng nhẹ, tùy chọn trượt từ bên) và mờ dần khi lướt qua phía trên.
 * `style` áp cho lớp bọc (chiều rộng, flex…); khối con nên rộng 100%.
 */
export const Reveal: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle>; delay?: number; from?: 'up' | 'left' | 'right' | 'scale' }> = ({
  children, style, delay = 0, from = 'up',
}) => {
  const fx = useContext(FxContext);
  const reduce = useReduceMotion();
  const ref = useRef<ViewInstance>(null);
  const p = useRef(new Animated.Value(0)).current;
  const live = !!fx && WEB && !reduce;
  useEffect(() => {
    if (!live || !fx) return undefined;
    return fx.register({ el: () => ref.current as unknown as HTMLElement | null, progress: p, delay });
  }, [live, fx, p, delay]);
  if (!live) return <View style={style}>{children}</View>;
  const rise = from === 'scale' ? 0 : 54;
  const side = from === 'left' ? -70 : from === 'right' ? 70 : 0;
  const clampOpt = { extrapolate: 'clamp' } as const;
  return (
    <Animated.View
      ref={ref}
      style={[
        style,
        {
          opacity: p.interpolate({ inputRange: [-1, -0.15, 0, 1], outputRange: [0, 0.9, 1, 0.1], ...clampOpt }),
          transform: [
            { translateY: p.interpolate({ inputRange: [-1, 0, 1], outputRange: [rise, 0, -34], ...clampOpt }) },
            { translateX: p.interpolate({ inputRange: [-1, 0, 1], outputRange: [side, 0, 0], ...clampOpt }) },
            { scale: p.interpolate({ inputRange: [-1, 0, 1], outputRange: [from === 'scale' ? 0.88 : 0.95, 1, 0.97], ...clampOpt }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

/** Cho biết cảnh có đang nằm trong màn hình không (không có provider hoặc không phải web: luôn true). Gắn `ref` vào khung của cảnh. */
export function useOnScreen(): [React.RefObject<ViewInstance | null>, boolean] {
  const fx = useContext(FxContext);
  const ref = useRef<ViewInstance>(null);
  const [on, setOn] = useState(true);
  useEffect(() => {
    if (!fx || !WEB) return undefined;
    return fx.register({ el: () => ref.current as unknown as HTMLElement | null, visible: setOn });
  }, [fx]);
  return [ref, on];
}

/**
 * Vòng lặp qua lại êm (giá trị 0 → 1 → 0, nhịp sin). Dùng `value.interpolate({ inputRange: [0, 1], outputRange: [-a, a] })` để có dao động quanh 0.
 * Không chạy (giữ ở giữa = 0,5) khi `live` sai hoặc bật giảm chuyển động.
 */
export function useLoop(live: boolean, period: number, delay = 0): Animated.Value {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    if (!live || reduce) {
      v.setValue(0.5);
      return undefined;
    }
    v.setValue(0);
    const step = (toValue: number) => Animated.timing(v, { toValue, duration: period / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE });
    const loop = Animated.loop(Animated.sequence([step(1), step(0)]));
    const timer = setTimeout(() => loop.start(), delay);
    return () => {
      clearTimeout(timer);
      loop.stop();
    };
  }, [live, reduce, period, delay, v]);
  return v;
}

/** Trôi liên tục 0 → 1 rồi quay lại 0 (chim bay ngang, khói bốc lên) */
export function useDrift(live: boolean, period: number, delay = 0): Animated.Value {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    v.setValue(0);
    if (!live || reduce) return undefined;
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: period, easing: Easing.linear, useNativeDriver: NATIVE }));
    const timer = setTimeout(() => loop.start(), delay);
    return () => {
      clearTimeout(timer);
      loop.stop();
    };
  }, [live, reduce, period, delay, v]);
  return v;
}

/** Rê chuột vào thì thẻ nhấc lên, phóng nhẹ và dựng thẳng (`tilt` là góc nghiêng lúc nghỉ, độ). Trên điện thoại không có chuột nên đứng yên ở góc `tilt`. */
export const Lift: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle>; tilt?: number; fill?: boolean }> = ({ children, style, tilt = 0, fill = false }) => {
  const reduce = useReduceMotion();
  const h = useRef(new Animated.Value(0)).current;
  const to = (v: number) => {
    if (reduce) return;
    Animated.spring(h, { toValue: v, speed: 18, bounciness: 7, useNativeDriver: NATIVE }).start();
  };
  return (
    <Pressable focusable={false} accessible={false} onHoverIn={() => to(1)} onHoverOut={() => to(0)} style={style}>
      <Animated.View
        style={{
          flex: fill ? 1 : undefined,
          transform: [
            { translateY: h.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) },
            { rotate: h.interpolate({ inputRange: [0, 1], outputRange: [`${tilt}deg`, '0deg'] }) },
            { scale: h.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }) },
          ],
        }}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
};

/** Số đếm từ 0 lên `value` khi lần đầu hiện ra trong màn hình; `render` vẽ chữ từ số hiện tại */
export const CountUp: React.FC<{ value: number; render: (n: number) => React.ReactNode }> = ({ value, render }) => {
  const reduce = useReduceMotion();
  const fx = useContext(FxContext);
  const ref = useRef<ViewInstance>(null);
  const [n, setN] = useState(WEB && fx && !reduce ? 0 : value);
  const started = useRef(false);
  useEffect(() => {
    if (!fx || !WEB || reduce) {
      setN(value);
      return undefined;
    }
    let anim: Animated.CompositeAnimation | null = null;
    const v = new Animated.Value(0);
    const id = v.addListener(({ value: x }) => setN(Math.round(x)));
    const off = fx.register({
      el: () => ref.current as unknown as HTMLElement | null,
      margin: -0.15,
      visible: (on) => {
        if (!on || started.current) return;
        started.current = true;
        anim = Animated.timing(v, { toValue: value, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: false });
        anim.start();
      },
    });
    return () => {
      off();
      anim?.stop();
      v.removeListener(id);
    };
  }, [fx, reduce, value]);
  return <View ref={ref}>{render(n)}</View>;
};
