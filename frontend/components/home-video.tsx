/** Video giới thiệu: khung màu logo phóng lớn theo cuộn/kéo; bấm mở một trình phát riêng trên nền tối. */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated, Image, Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions,
  type ViewInstance, type ViewStyle,
} from 'react-native';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { Play, X } from 'lucide-react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useScrollY } from '@/components/motion';
import { Btn, Txt } from '@/components/ui';
import { useReduceMotion } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';

const SOURCE = require('../assets/gioi-thieu-dong-a.mp4');
const POSTER = require('../assets/gioi-thieu-dong-a-poster.jpg');
const WEB = Platform.OS === 'web';
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const clipped = { extrapolate: 'clamp' } as const;

/** Web trả Promise từ play(): đóng/đổi trạng thái ngay khi tải có thể hủy yêu cầu này. */
function playVideo(player: VideoPlayer, container: ViewInstance | null) {
  if (WEB) {
    const video = (container as unknown as HTMLElement | null)?.querySelector('video');
    // Trình duyệt có thể từ chối autoplay; nút phát gốc và trạng thái lỗi của player vẫn hoạt động.
    if (video) void video.play().catch(() => undefined);
  } else player.play();
}

/** Họa tiết cờ, mặt trời, núi và sóng lấy cảm hứng từ chính logo; không dùng hình trang mẫu. */
function LogoBackdrop() {
  const { c } = useTheme();
  return (
    <Svg width="100%" height="100%" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" accessibilityElementsHidden>
      <Rect width="1440" height="900" fill={c.logoPaper} />
      {Array.from({ length: 10 }, (_, i) => <Rect key={i} x={i * 160} width="80" height="900" fill={c.logoGold} opacity="0.09" />)}
      <Circle cx="150" cy="260" r="112" fill={c.logoGold} opacity="0.55" />
      <Circle cx="150" cy="260" r="132" stroke={c.logoGold} strokeWidth="2" fill="none" opacity="0.4" />
      <Path d="M1100 0H1440V280C1360 200 1310 237 1230 155S1130 70 1100 0Z" fill={c.logoRed} />
      <Path d="M1180 0C1230 85 1310 155 1440 174" stroke={c.logoGold} strokeWidth="8" fill="none" />
      <Path d="M1060 610L1190 410 1300 570 1370 480 1490 660V900H980Z" fill={c.logoInk} opacity="0.12" />
      <Path d="M0 790C200 630 340 890 600 780S1050 660 1440 760V900H0Z" fill={c.logoInk} />
      <Path d="M-60 860C170 700 380 930 670 815S1100 760 1500 820" stroke={c.logoGold} strokeWidth="10" fill="none" />
      <Path d="M0 910C240 790 400 970 720 868S1120 820 1440 880" stroke={c.logoPaper} strokeWidth="3" fill="none" opacity="0.5" />
    </Svg>
  );
}

/** Chỉ gắn khung phát khi hộp thoại mở; player được dừng trước khi đóng để âm thanh ngắt ngay. */
function DetailVideo({ player }: { player: VideoPlayer }) {
  const { c } = useTheme();
  const container = useRef<ViewInstance>(null);
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  useEffect(() => { player.currentTime = 0; playVideo(player, container.current); }, [player]);
  return (
    <View ref={container} style={{ width: '100%', height: '100%', backgroundColor: c.den }}>
      <VideoView player={player} style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]} contentFit="contain" nativeControls playsInline fullscreenOptions={{ enable: true }} accessibilityLabel="Video giới thiệu Hào Khí Đông A" />
      {status === 'error' && (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', gap: 16, padding: 20, backgroundColor: c.den }]}>
          <Txt color={c.trang} center accessibilityRole="alert">Không tải được video. Bạn thử lại giúp mình nhé.</Txt>
          <Btn title="Thử lại" onPress={() => {
            if (WEB) {
              (container.current as unknown as HTMLElement | null)?.querySelector('video')?.load();
              playVideo(player, container.current);
            } else void player.replaceAsync(SOURCE).then(() => player.play()).catch(() => undefined);
          }} />
        </View>
      )}
    </View>
  );
}

export function HomeVideo({ wide, onImmersiveChange }: { wide: boolean; onImmersiveChange: (on: boolean) => void }) {
  const { c } = useTheme();
  const { width, height } = useWindowDimensions();
  const reduce = useReduceMotion();
  const scrollY = useScrollY();
  const section = useRef<ViewInstance>(null);
  const trigger = useRef<ViewInstance>(null);
  const preview = useRef<ViewInstance>(null);
  const closeButton = useRef<ViewInstance>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const dragging = useRef(false);
  const pin = WEB && wide && !reduce;
  const travel = height * 1.1;
  const initialWidth = Math.min(960, width * (wide ? 0.62 : 0.9));
  const player = useVideoPlayer(SOURCE, (p) => { p.loop = true; p.muted = true; });
  const detailPlayer = useVideoPlayer(SOURCE);
  const { status: previewStatus } = useEvent(player, 'statusChange', { status: player.status });

  useEffect(() => {
    if (previewStatus === 'readyToPlay') setReady(true);
    if (WEB && visible && !open && !reduce && previewStatus === 'readyToPlay') playVideo(player, preview.current);
    else player.pause();
  }, [player, visible, open, reduce, previewStatus]);

  useEffect(() => {
    if (!WEB) { setVisible(true); return undefined; }
    const el = section.current as unknown as HTMLElement | null;
    if (!el) return undefined;
    let raf = 0;
    let wasImmersive = false;
    const measure = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      progress.setValue(pin ? clamp(-r.top / travel) : 0);
      setVisible(r.bottom > 0 && r.top < height);
      const immersive = pin && r.top <= 80 && r.bottom >= height;
      if (immersive !== wasImmersive) { wasImmersive = immersive; onImmersiveChange(immersive); }
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(measure); };
    const id = scrollY?.addListener(schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(el);
    measure();
    return () => {
      if (id) scrollY?.removeListener(id);
      observer.disconnect();
      cancelAnimationFrame(raf);
      onImmersiveChange(false);
    };
  }, [scrollY, pin, height, travel, progress, onImmersiveChange]);

  // Kéo trên khung cũng cuộn được như kéo thanh cuộn; ngưỡng 8px phân biệt thao tác kéo với bấm xem.
  useEffect(() => {
    if (!pin) return undefined;
    const button = trigger.current as unknown as HTMLElement | null;
    let scroller = section.current as unknown as HTMLElement | null;
    while (scroller && scroller.scrollHeight <= scroller.clientHeight) scroller = scroller.parentElement;
    if (!button || !scroller) return undefined;
    let startY = 0, startScroll = 0;
    let pointer: number | null = null;
    let reset: ReturnType<typeof setTimeout>;
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      clearTimeout(reset);
      dragging.current = false;
      pointer = e.pointerId;
      startY = e.clientY;
      startScroll = scroller.scrollTop;
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      const delta = startY - e.clientY;
      if (Math.abs(delta) > 8) dragging.current = true;
      if (dragging.current) {
        button.setPointerCapture(e.pointerId);
        scroller.scrollTop = startScroll + delta * 2;
        e.preventDefault();
      }
    };
    const end = () => { pointer = null; reset = setTimeout(() => { dragging.current = false; }, 0); };
    button.addEventListener('pointerdown', down);
    button.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      button.removeEventListener('pointerdown', down);
      button.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      clearTimeout(reset);
    };
  }, [pin]);

  const close = useCallback(() => {
    detailPlayer.pause();
    setOpen(false);
    if (WEB) requestAnimationFrame(() => (trigger.current as unknown as HTMLElement | null)?.focus());
  }, [detailPlayer]);
  const frameStyle = pin ? {
    width: progress.interpolate({ inputRange: [0, 1], outputRange: [initialWidth, width], ...clipped }),
    height: progress.interpolate({ inputRange: [0, 1], outputRange: [initialWidth * 9 / 16, height], ...clipped }),
    borderWidth: progress.interpolate({ inputRange: [0, 0.9, 1], outputRange: [14, 2, 0], ...clipped }),
    borderRadius: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0], ...clipped }),
  } : { width: initialWidth, height: initialWidth * 9 / 16, borderWidth: wide ? 14 : 8, borderRadius: 8 };
  const playerWidth = Math.min(1200, width - (wide ? 80 : 24), (height - 120) * 16 / 9);

  return (
    <View ref={section} id="video-gioi-thieu" testID="home-video-section" style={{ height: pin ? height + travel + height * 0.35 : undefined, backgroundColor: c.logoPaper }}>
      <View testID="home-video-stage" style={[
        { width: '100%', height: pin ? height : undefined, minHeight: pin ? undefined : Math.max(380, initialWidth * 9 / 16 + 150), alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
        pin ? { position: 'sticky', top: 0 } as unknown as ViewStyle : null,
      ]}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: progress.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 0.6, 0], ...clipped }) }]}>
          <LogoBackdrop />
        </Animated.View>
        <Animated.View testID="home-video-frame" style={[{ borderColor: c.logoGold, overflow: 'hidden', backgroundColor: c.logoInk, boxShadow: `0 24px 70px ${c.bong}` }, frameStyle]}>
          <View ref={preview} pointerEvents="none" style={StyleSheet.absoluteFill}>
            <VideoView player={player} style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]} contentFit="cover" nativeControls={false} playsInline fullscreenOptions={{ enable: false }} surfaceType="textureView" onFirstFrameRender={() => setReady(true)} />
            {!ready && <Image testID="home-video-poster" source={POSTER} resizeMode="cover" style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]} />}
          </View>
          <Pressable
            ref={trigger}
            accessibilityRole="button"
            accessibilityLabel="Xem video giới thiệu Hào Khí Đông A"
            testID="home-video-open"
            onPress={() => {
              if (dragging.current) { dragging.current = false; return; }
              setOpen(true);
            }}
            style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}
          >
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: c.logoInk, opacity: 0.26 }]} />
            <View style={{ width: wide ? 104 : 76, height: wide ? 104 : 76, borderWidth: 3, borderColor: c.trang, borderRadius: 60, justifyContent: 'center', alignItems: 'center' }}>
              <Play size={wide ? 42 : 30} color={c.trang} fill={c.trang} style={{ marginLeft: 5 }} />
            </View>
          </Pressable>
        </Animated.View>
      </View>
      <Modal visible={open} transparent animationType={reduce ? 'none' : 'fade'} onRequestClose={close} onShow={() => { if (WEB) (closeButton.current as unknown as HTMLElement | null)?.focus(); }} statusBarTranslucent>
        <View accessibilityViewIsModal role="dialog" aria-modal aria-label="Video giới thiệu Hào Khí Đông A" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Pressable testID="home-video-backdrop" accessibilityRole="button" accessibilityLabel="Đóng video" onPress={close} style={[StyleSheet.absoluteFill, { backgroundColor: c.den, opacity: 0.96 }]} />
          <View style={{ width: playerWidth, height: playerWidth * 9 / 16 }}>
            {open && <DetailVideo player={detailPlayer} />}
          </View>
          <Pressable ref={closeButton} accessibilityRole="button" accessibilityLabel="Đóng trình phát video" testID="home-video-close" onPress={close} style={{ position: 'absolute', right: 16, top: 16, width: 52, height: 52, justifyContent: 'center', alignItems: 'center', borderRadius: 26, borderWidth: 1, borderColor: c.logoGold }}>
            <X size={28} color={c.trang} />
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}
