import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform } from 'react-native';

const NATIVE = Platform.OS !== 'web';

/** Giảm chuyển động: cài đặt của hệ điều hành hoặc của game (Hồ sơ > Cài đặt) */
export const ReduceMotionContext = createContext(false);

export const useReduceMotion = () => useContext(ReduceMotionContext);

/** Theo dõi cài đặt "Giảm chuyển động" của hệ điều hành / trình duyệt (dùng một lần ở gốc app) */
export function useSystemReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduce(v))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

/** Nhún nhẹ liên tục (Rồng Con, huy hiệu) */
export function useBob(enabled: boolean, distance = 6) {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!enabled || reduce) {
      v.setValue(0);
      return;
    }
    const step = (toValue: number) => Animated.timing(v, { toValue, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE });
    const loop = Animated.loop(Animated.sequence([step(1), step(0)]));
    loop.start();
    return () => loop.stop();
  }, [enabled, reduce, v]);
  return enabled ? { transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -distance] }) }] } : null;
}

/** Hiện ra (mờ -> rõ, phóng nhẹ) khi gắn vào màn hình và mỗi lần `trigger` đổi */
export function usePopIn(trigger: unknown = null) {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) {
      v.setValue(1);
      return;
    }
    v.setValue(0);
    const anim = Animated.timing(v, { toValue: 1, duration: 280, easing: Easing.out(Easing.back(1.4)), useNativeDriver: NATIVE });
    anim.start();
    return () => anim.stop();
  }, [trigger, reduce, v]);
  return { opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] };
}

/** Rung ngang mỗi lần `trigger` đổi sang giá trị khác null (trả lời sai, bị đánh trúng) */
export function useShake(trigger: unknown) {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (trigger === null || trigger === undefined || trigger === false || reduce) return;
    v.setValue(0);
    const anim = Animated.sequence(
      [8, -7, 5, -3, 0].map((toValue) => Animated.timing(v, { toValue, duration: 70, easing: Easing.linear, useNativeDriver: NATIVE })),
    );
    anim.start();
    return () => anim.stop();
  }, [trigger, reduce, v]);
  return { transform: [{ translateX: v }] };
}

/** Số nổi lên rồi mờ dần (+10 XP, -24 khí lực) */
export function useFloatUp(trigger: unknown) {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (trigger === null || trigger === undefined) return;
    v.setValue(0);
    const anim = Animated.timing(v, { toValue: 1, duration: reduce ? 1 : 1000, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE });
    anim.start();
    return () => anim.stop();
  }, [trigger, reduce, v]);
  return {
    opacity: v.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }),
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, reduce ? 0 : -28] }) }],
  };
}
