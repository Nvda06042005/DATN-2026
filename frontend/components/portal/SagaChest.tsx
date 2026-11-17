/**
 * Màn mở hòm báu (17/11/2026, kiểu mở rương của game): hòm rung chờ chạm → chạm thì rung mạnh và gọi máy chủ → lóe sáng → tia sáng xoay theo màu độ hiếm
 * → bảng tên độ hiếm (Thường / Hiếm / Sử thi / Huyền thoại) → từng phần thưởng bật ra (vàng đếm lên, điểm kinh nghiệm, Khiên giữ chuỗi, khung / danh hiệu
 * mới mở khóa) → gợi ý món sắp mở khóa. Kết quả do máy chủ tung và cố định theo học sinh + hòm; tỉ lệ được công bố ngay trên màn. Không dùng pháo giấy;
 * bật "giảm chuyển động" thì hiện thẳng kết quả.
 */
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Modal, Platform, Pressable, View } from 'react-native';
import { Coins, Shield, Sparkles, Star, X, Zap } from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import type { Session } from '@/components/auth';
import { FramedAvatar, TitleBadge } from '@/components/portal/SagaLook';
import { ChestArt } from '@/components/portal/SagaRail';
import { Btn, Txt } from '@/components/ui';
import type { ChestOpen, LookItem, SagaChest } from '@/types/saga';

type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
const RARITY: Record<Rarity, { label: string; color: string; glow: string; rays: string[]; text: string }> = {
  common: { label: 'THƯỜNG', color: '#94a3b8', glow: '#cbd5e1', rays: ['#e2e8f0', '#94a3b8'], text: '#ffffff' },
  rare: { label: 'HIẾM', color: '#0ea5e9', glow: '#38bdf8', rays: ['#bae6fd', '#0284c7'], text: '#ffffff' },
  epic: { label: 'SỬ THI', color: '#a855f7', glow: '#d946ef', rays: ['#f5d0fe', '#9333ea'], text: '#ffffff' },
  legendary: { label: 'HUYỀN THOẠI', color: '#f59e0b', glow: '#fde047', rays: ['#fef08a', '#f59e0b', '#dc2626'], text: '#3b2300' },
};
const RARITY_NAME: Record<Rarity, string> = { common: 'Thường', rare: 'Hiếm', epic: 'Sử thi', legendary: 'Huyền thoại' };
const web = Platform.OS === 'web';

type Phase = 'idle' | 'shaking' | 'reveal';

/** Số đếm lên dần (vàng) */
const CountUp: React.FC<{ to: number; duration?: number; run: boolean }> = ({ to, duration = 900, run }) => {
  const [n, setN] = useState(run ? 0 : to);
  useEffect(() => {
    if (!run) { setN(to); return undefined; }
    let raf = 0;
    const start = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      setN(Math.round(to * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration, run]);
  return <>{n}</>;
};

/** Một phần thưởng bật ra (phóng to từ 0, nảy nhẹ) sau `delay` mili giây */
const PopIn: React.FC<{ delay: number; motion: boolean; children: React.ReactNode; testID?: string }> = ({ delay, motion, children, testID }) => {
  const v = useRef(new Animated.Value(motion ? 0 : 1)).current;
  useEffect(() => {
    if (!motion) return undefined;
    const a = Animated.sequence([Animated.delay(delay), Animated.spring(v, { toValue: 1, friction: 5, tension: 120, useNativeDriver: false })]);
    a.start();
    return () => a.stop();
  }, [delay, motion, v]);
  return <Animated.View testID={testID} style={{ opacity: v.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }), transform: [{ scale: v }] }}>{children}</Animated.View>;
};

export const ChestOpening: React.FC<{
  session: Session; chest: SagaChest; look?: { avatar?: string | null } | null; open: () => Promise<ChestOpen>; onClose: (opened: boolean) => void;
}> = ({ session, chest, look, open, onClose }) => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<ChestOpen | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [motion, setMotion] = useState(true);
  const wiggle = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const rays = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const banner = useRef(new Animated.Value(0)).current;
  const loop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then((r) => setMotion(!r)).catch(() => undefined); }, []);

  // rung nhẹ chờ chạm; rung mạnh khi đang mở
  useEffect(() => {
    loop.current?.stop();
    if (!motion || phase === 'reveal') { wiggle.setValue(0); return undefined; }
    const amp = phase === 'shaking' ? 1 : 0.35;
    const step = phase === 'shaking' ? 60 : 140;
    loop.current = Animated.loop(Animated.sequence([
      Animated.timing(wiggle, { toValue: amp, duration: step, easing: Easing.linear, useNativeDriver: false }),
      Animated.timing(wiggle, { toValue: -amp, duration: step * 2, easing: Easing.linear, useNativeDriver: false }),
      Animated.timing(wiggle, { toValue: 0, duration: step, easing: Easing.linear, useNativeDriver: false }),
      Animated.delay(phase === 'shaking' ? 0 : 700),
    ]));
    loop.current.start();
    return () => loop.current?.stop();
  }, [phase, motion, wiggle]);

  // tia sáng xoay mãi sau khi mở
  useEffect(() => {
    if (phase !== 'reveal' || !motion) return undefined;
    const a = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 9000, easing: Easing.linear, useNativeDriver: false }));
    a.start();
    return () => a.stop();
  }, [phase, motion, spin]);

  const start = async (): Promise<void> => {
    if (phase !== 'idle') return;
    setProblem(null);
    setPhase('shaking');
    const minShake = new Promise((r) => setTimeout(r, motion ? 1100 : 0));
    try {
      const [r] = await Promise.all([open(), minShake]);
      setResult(r);
      setPhase('reveal');
      if (motion) {
        flash.setValue(1); rays.setValue(0); banner.setValue(0);
        Animated.parallel([
          Animated.timing(flash, { toValue: 0, duration: 650, easing: Easing.out(Easing.quad), useNativeDriver: false }),
          Animated.timing(rays, { toValue: 1, duration: 700, easing: Easing.out(Easing.back(1.4)), useNativeDriver: false }),
          Animated.sequence([Animated.delay(250), Animated.spring(banner, { toValue: 1, friction: 4, tension: 90, useNativeDriver: false })]),
        ]).start();
      } else { rays.setValue(1); banner.setValue(1); }
    } catch (e) {
      setProblem(errorMessage(e));
      setPhase('idle');
    }
  };

  const rarity = (result?.rarity ?? 'common') as Rarity;
  const r = RARITY[rarity];
  const odds = result?.odds ?? chest.odds ?? [];
  let delay = 700;
  const next = () => { delay += 260; return delay; };
  const rewards: React.ReactNode[] = [];
  if (result) {
    if (result.gold) rewards.push(
      <PopIn key="gold" delay={next()} motion={motion} testID="chest-loot-gold">
        <View style={{ alignItems: 'center', gap: 4, minWidth: 92 }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#fef3c7', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#f59e0b' }}><Coins size={30} color="#b45309" /></View>
          <Txt f="heavy" size={22} color="#fde047">+<CountUp to={result.gold} run={motion} /></Txt>
          <Txt f="bold" size={12} color="#ffffff">vàng</Txt>
        </View>
      </PopIn>);
    if (result.xp) rewards.push(
      <PopIn key="xp" delay={next()} motion={motion} testID="chest-loot-xp">
        <View style={{ alignItems: 'center', gap: 4, minWidth: 92 }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#16a34a' }}><Zap size={30} color="#15803d" /></View>
          <Txt f="heavy" size={22} color="#86efac">+<CountUp to={result.xp} run={motion} /></Txt>
          <Txt f="bold" size={12} color="#ffffff">điểm kinh nghiệm</Txt>
        </View>
      </PopIn>);
    if (result.freeze) rewards.push(
      <PopIn key="freeze" delay={next()} motion={motion} testID="chest-loot-freeze">
        <View style={{ alignItems: 'center', gap: 4, minWidth: 92 }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#e0f2fe', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#0284c7' }}><Shield size={30} color="#0369a1" /></View>
          <Txt f="heavy" size={22} color="#7dd3fc">+1</Txt>
          <Txt f="bold" size={12} color="#ffffff" center>Khiên giữ chuỗi</Txt>
        </View>
      </PopIn>);
  }
  const unlocked = result?.unlocked ?? [];

  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => onClose(Boolean(result))}>
      <View style={{ flex: 1, backgroundColor: 'rgba(10,8,6,0.88)', alignItems: 'center', justifyContent: 'center', padding: 16 }} testID="chest-opening"
        accessibilityViewIsModal>
        <Pressable onPress={() => onClose(Boolean(result))} accessibilityRole="button" accessibilityLabel="Đóng" testID="chest-close"
          style={{ position: 'absolute', right: 16, top: 16, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' }}>
          <X size={22} color="#ffffff" />
        </Pressable>
        <View style={{ width: '100%', maxWidth: 520, alignItems: 'center', gap: 14 }}>
          <Txt f="heavy" size={13} color="#fde68a" style={{ letterSpacing: 2 }}>{chest.kind === 'part' ? 'HÒM BÁU LỚN · CUỐI PHẦN' : 'HÒM BÁU BÍ ẨN'}</Txt>
          {/* sân khấu: tia sáng, quầng sáng, hòm */}
          <View style={{ width: 260, height: 230, alignItems: 'center', justifyContent: 'center' }}>
            {phase === 'reveal' ? (
              <Animated.View pointerEvents="none" style={{ position: 'absolute', width: 340, height: 340, borderRadius: 170, opacity: rays.interpolate({ inputRange: [0, 1], outputRange: [0, 0.9] }),
                transform: [{ scale: rays.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }, { rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
                ...(web ? { backgroundImage: `repeating-conic-gradient(${r.rays[0]}55 0deg 10deg, transparent 10deg 22deg)`, WebkitMaskImage: 'radial-gradient(circle, #000 35%, transparent 70%)', maskImage: 'radial-gradient(circle, #000 35%, transparent 70%)' } as object : { backgroundColor: `${r.glow}33` }) }} />
            ) : null}
            <Animated.View pointerEvents="none" style={{ position: 'absolute', width: 170, height: 170, borderRadius: 85, opacity: phase === 'reveal' ? 0.9 : 0.45,
              ...(web ? { boxShadow: `0 0 70px 30px ${phase === 'reveal' ? r.glow : '#fde68a'}` } as object : { backgroundColor: `${r.glow}55` }) }} />
            <Pressable onPress={() => { void start(); }} disabled={phase !== 'idle'} accessibilityRole="button" testID="chest-tap"
              accessibilityLabel={phase === 'idle' ? 'Chạm để mở hòm báu' : phase === 'shaking' ? 'Đang mở hòm báu' : `Đã mở: hòm ${RARITY_NAME[rarity]}`}>
              <Animated.View style={{ transform: [{ rotate: wiggle.interpolate({ inputRange: [-1, 1], outputRange: ['-12deg', '12deg'] }) },
                { scale: phase === 'shaking' ? 1.08 : phase === 'reveal' ? rays.interpolate({ inputRange: [0, 1], outputRange: [1.25, 1] }) : 1 }] }}>
                <ChestArt size={chest.kind === 'part' ? 170 : 150} state={phase === 'reveal' ? 'opened' : 'ready'} />
              </Animated.View>
            </Pressable>
            {phase === 'reveal' && motion ? [0, 1, 2, 3, 4, 5].map((i) => (
              <View key={i} pointerEvents="none" style={{ position: 'absolute', left: [20, 210, 36, 214, 112, 160][i], top: [24, 34, 150, 140, 0, 6][i] }}>
                <PopIn delay={300 + i * 90} motion={motion}><Sparkles size={[22, 18, 16, 20, 14, 18][i]} color={r.glow} fill="#fef9c3" /></PopIn>
              </View>
            )) : null}
            {phase === 'reveal' ? <Animated.View pointerEvents="none" style={{ position: 'absolute', left: -400, right: -400, top: -400, bottom: -400, backgroundColor: '#ffffff', opacity: flash }} /> : null}
          </View>

          {phase !== 'reveal' ? (
            <View style={{ alignItems: 'center', gap: 8 }}>
              <Txt f="heavy" size={22} color="#ffffff" center>{phase === 'idle' ? 'Chạm vào hòm để mở!' : 'Đang mở…'}</Txt>
              <Txt size={13} color="#e7e5e4" center>Có thể là Thường, Hiếm, Sử thi hay Huyền thoại – phần thưởng lên tới {chest.max_gold ?? 100} vàng.</Txt>
              {problem ? <Txt f="semibold" size={13} color="#fca5a5" center accessibilityRole="alert">{problem}</Txt> : null}
            </View>
          ) : result ? (
            <View style={{ alignItems: 'center', gap: 14, alignSelf: 'stretch' }} accessibilityLiveRegion="polite">
              <Animated.View style={{ transform: [{ scale: banner.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }], opacity: banner }}>
                <View testID="chest-rarity" style={{ paddingHorizontal: 22, paddingVertical: 6, borderRadius: 999, borderWidth: 2, borderColor: '#ffffff',
                  ...(web ? { backgroundImage: `linear-gradient(110deg, ${r.rays.join(', ')})`, boxShadow: `0 0 24px 4px ${r.glow}` } as object : { backgroundColor: r.color }) }}>
                  <Txt f="heavy" size={20} color={r.text} style={{ letterSpacing: 2 }}>{r.label}!</Txt>
                </View>
              </Animated.View>
              {!result.first ? <Txt size={13} color="#e7e5e4" center>Hòm này em đã mở trước đó.</Txt> : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>{rewards}</View>
              {result.freeze_as_gold ? <Txt size={12} color="#e7e5e4" center>Em đã đủ Khiên giữ chuỗi nên khiên được đổi thành {result.freeze_as_gold} vàng.</Txt> : null}
              {unlocked.map((u: LookItem & { kind: 'frame' | 'title'; equipped: boolean }) => (
                <PopIn key={u.code} delay={next()} motion={motion} testID={`chest-unlock-${u.code}`}>
                  <View style={{ alignItems: 'center', gap: 8, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', backgroundColor: 'rgba(255,255,255,0.08)', padding: 14, minWidth: 260 }}>
                    <Txt f="heavy" size={12} color="#fde68a" style={{ letterSpacing: 1 }}>{u.kind === 'frame' ? 'MỞ KHÓA KHUNG ẢNH ĐẠI DIỆN' : 'MỞ KHÓA DANH HIỆU'}</Txt>
                    {u.kind === 'frame' ? <FramedAvatar name={session.user.full_name} uri={session.user.avatar_url} size={72} frame={u} preset={look?.avatar} /> : <TitleBadge title={u} size="md" center />}
                    <Txt f="bold" size={15} color="#ffffff">{u.name}</Txt>
                    <Txt size={12} color="#e7e5e4" center>{u.equipped ? 'Đã tự trang bị – xem ở thanh đầu trang.' : 'Vào Kho trang phục để trang bị.'}</Txt>
                  </View>
                </PopIn>
              ))}
              {result.next ? (
                <PopIn delay={next()} motion={motion} testID="chest-next">
                  <View style={{ alignItems: 'center', gap: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Star size={14} color="#fde68a" fill="#fde68a" /><Txt f="bold" size={13} color="#ffffff">Còn {result.next.left} hòm nữa để mở danh hiệu “{result.next.name}”</Txt></View>
                    <View style={{ width: 240, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.2)', overflow: 'hidden' }}>
                      <View style={{ width: `${Math.round(((result.opened ?? 0) / Math.max(1, result.total ?? 13)) * 100)}%`, height: 8, borderRadius: 4, backgroundColor: '#fde68a' }} />
                    </View>
                    <Txt size={11} color="#d6d3d1">Đã mở {result.opened}/{result.total} hòm báu trên bản đồ</Txt>
                  </View>
                </PopIn>
              ) : null}
              <Btn title="Nhận thưởng" tone="son" full onPress={() => onClose(true)} testID="chest-claim" />
            </View>
          ) : null}
          {odds.length ? (
            <Txt size={11} color="#a8a29e" center testID="chest-odds">Tỉ lệ: {odds.map((o) => `${RARITY_NAME[o.rarity as Rarity]} ${o.percent}%`).join(' · ')}. Hòm chỉ nhận được khi học xong chặng.</Txt>
          ) : null}
        </View>
      </View>
    </Modal>
  );
};
