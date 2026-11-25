/**
 * Sảnh mở đầu trang học sinh Hào Khí Đông A (24/11/2026, làm lại giao diện 25/11/2026 theo trang chủ công khai):
 * mục **Trang chủ** của thanh đầu chung (`StudentWorkspace`), cuộn dọc nhiều phần bằng bộ hình minh họa riêng (HallMedia.ts):
 *   1. Màn mở đầu Hoàng thành Thăng Long (hoang-thanh-thang-long.png), Vua Trần & Trần Hưng Đạo, nút biển gỗ VÀO CHƠI, mây xoáy tiền cảnh.
 *   2. Giới thiệu “Muốn làm Trạng nguyên?” với ba thẻ học tập.
 *   3. Khu trưng bày 5 bậc danh hiệu Khoa bảng và 9 nhân vật lịch sử thời Trần (tự luân phiên & chọn tay).
 *   4. Bảng vàng trong khung Vua Trần & Trần Hưng Đạo (khung-bang-vang.png), API bảng xếp hạng thật (/api/game/leaderboard).
 *   5. Thư viện tranh & bản đồ minh họa (lưới tự đổi vị trí, chỉ xem).
 *   6. Hướng dẫn chơi nền tranh bàn kế trận Bạch Đằng (ban-ke-bach-dang.jpg) kèm nút Play mở hướng dẫn.
 *   7. Thang danh hiệu (dùng ở trang Chiến dịch) và chân trang.
 * Phần 2–5 dùng **nền giấy kem có hoa văn mờ, hai vòng vàng, dải mây vàng nối khối và tiêu đề hai màu** như các khối của trang chủ công khai
 * (người dùng 25/11/2026: "sử dụng background như trang chủ, cái nào màu tím đỏ thì đổi lại giống giao diện trang chủ"); không còn nền chuyển sắc
 * xanh – tím – đỏ hay sân khấu cam đỏ. Các phần của sảnh là menu sổ xuống của mục Trang chủ (`HALL_SECTIONS`).
 *
 * Danh hiệu là cách hiển thị tiến độ do máy chủ trả về (/api/saga/home) – không trao thưởng, không lưu gì ở giao diện:
 *   Học trò (bắt đầu) → Thái học sinh (xong Phần 1 · 1258) → Thám hoa (xong Phần 2 · 1285) → Bảng nhãn (xong Phần 3 · 1287–1288)
 *   → Trạng nguyên (đủ sao tối đa của cả ba phần).
 * Dữ kiện lịch sử (Wikipedia tiếng Việt): học vị Thái học sinh có từ khoa thi Nhâm Thìn (1232) đời Trần Thái Tông;
 * Tam khôi đặt lần đầu năm 1247 – Trạng nguyên Nguyễn Hiền (các nguồn chép 12 hoặc 13 tuổi), Bảng nhãn Lê Văn Hưu (soạn Đại Việt sử ký, xong 1272),
 * Thám hoa Đặng Ma La.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, Platform, Pressable, ScrollView, View, useWindowDimensions, type ImageSourcePropType, type ScrollViewInstance } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { ArrowUp, Award, BookOpen, Check, Lock, Play, Puzzle, Swords } from 'lucide-react-native';
import * as game from '@/api/gameApi';
import { PatternOverlay } from '@/components/art';
import type { Session } from '@/components/auth';
import { HALL_ART, HALL_CHARACTERS, HALL_RANK_ART, type HallCharacter } from '@/components/portal/HallMedia';
import { LoadState, num, useLoad } from '@/components/portal/SagaKit';
import { DrumSun, RANK_LOOK } from '@/components/portal/StudentArt';
import { HOME_LOOK } from '@/components/portal/StudentWorkspace';
import { CloudPair, SectionCloud } from '@/components/section-cloud';
import { SectionHeading } from '@/components/section-heading';
import { Sheet, Txt } from '@/components/ui';
import { PALETTES } from '@/constants/theme';
import { ThemeContext } from '@/hooks/use-theme';
import { RANKS, scholarRank, type RankState } from '@/lib/scholar-rank';
import type { Board } from '@/types/gamification';
import type { SagaHome } from '@/types/saga';

/** Màu riêng của sảnh (thang danh hiệu, nút biển gỗ, bảng vàng); nền và chữ các phần của sảnh lấy theo trang chủ công khai (`HOME_LOOK`) */
export const HALL = {
  red: '#b8261b',
  redDeep: '#8f1f17',
  gold: '#e3b244',
  goldBright: '#ffc75f',
  goldHover: '#f9f871',
  goldSoft: '#f6dc97',
  paper: '#fffaf0',
  paperLine: '#ecd9b4',
  ink: '#2b1d16',
  muted: '#5f5246',
};

export { RANKS, scholarRank, type RankState };

export type HallSectionKey = 'hero' | 'about' | 'characters' | 'board' | 'gallery' | 'tutorial';

// ---------------------------------------------------------------------- tiện ích chung
function useCalm(): boolean {
  const [calm, setCalm] = useState(true);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().then((r) => { if (live) setCalm(r); }).catch(() => undefined);
    return () => { live = false; };
  }, []);
  return calm;
}

/** Nhún nhẹ lên xuống (nhân vật trang trí); đứng yên khi bật giảm chuyển động */
const Bob: React.FC<{ children: React.ReactNode; delay?: number; range?: number }> = ({ children, delay = 0, range = 6 }) => {
  const calm = useCalm();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (calm) { v.setValue(0); return undefined; }
    const a = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(v, { toValue: 1, duration: 950, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      Animated.timing(v, { toValue: 0, duration: 950, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
    ]));
    a.start();
    return () => a.stop();
  }, [calm, delay, v]);
  return <Animated.View style={{ transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -range] }) }] }}>{children}</Animated.View>;
};

const Progress: React.FC<{ done: number; total: number; label: string; light?: boolean }> = ({ done, total, label, light = false }) => {
  const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((done / total) * 100))) : 0;
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: pct }}
      style={{ height: 10, borderRadius: 5, backgroundColor: light ? 'rgba(255,255,255,0.25)' : '#efe1c4', overflow: 'hidden', alignSelf: 'stretch' }}>
      <View style={{ width: `${pct}%`, height: '100%', borderRadius: 5, backgroundColor: HALL.gold }} />
    </View>
  );
};

/** Tiêu đề phần dùng lại ở Lộ trình & Thang danh hiệu */
export const HallTitle: React.FC<{ eyebrow: string; ink: string; red: string; sub?: string; center?: boolean }> = ({ eyebrow, ink, red, sub, center = false }) => {
  const { width } = useWindowDimensions();
  const size = width < 600 ? 24 : 30;
  return (
    <View style={{ gap: 6, alignItems: center ? 'center' : 'flex-start' }}>
      <Txt f="bold" size={12} color={HALL.red} style={{ letterSpacing: 1.8 }}>{eyebrow}</Txt>
      <Txt f="heavy" size={size} color={HALL.ink} center={center} accessibilityRole="header" style={{ lineHeight: size + 9 }}>
        {ink} <Txt f="serifItalic" size={size + 2} color={HALL.red}>{red}</Txt>
      </Txt>
      {sub ? <Txt size={15} color={HALL.muted} center={center} style={{ lineHeight: 23, maxWidth: 720 }}>{sub}</Txt> : null}
    </View>
  );
};

// ---------------------------------------------------------------------- 0. Các phần của sảnh (menu sổ xuống của Trang chủ) và nền giấy như trang chủ công khai
/** Các phần của sảnh theo thứ tự trên trang; là menu sổ xuống của mục Trang chủ trên thanh đầu (25/11/2026) */
export const HALL_SECTIONS: ReadonlyArray<{ id: HallSectionKey; label: string }> = [
  { id: 'about', label: 'Giới thiệu' },
  { id: 'characters', label: 'Nhân vật' },
  { id: 'board', label: 'Bảng vàng' },
  { id: 'gallery', label: 'Thư viện' },
  { id: 'tutorial', label: 'Hướng dẫn' },
];
const HALL_ORDER: ReadonlyArray<HallSectionKey> = ['hero', 'about', 'characters', 'board', 'gallery', 'tutorial'];

/** Thẻ giấy mờ như các khối của trang chủ công khai (`PAPER_CARD` trong `components/home.tsx`) */
const PAPER_CARD = { backgroundColor: 'rgba(255, 255, 255, 0.74)', borderWidth: 1, borderColor: HOME_LOOK.line, boxShadow: '0 10px 30px rgba(35, 56, 47, 0.10)' } as object;
/** Nền ô ảnh nhân vật / tranh danh hiệu trên nền giấy */
const TILE = '#f3e7cf';
/** Màu nút đen của trang chủ công khai ("Vào học ngay", nút lên đầu trang) */
const L_DEN = PALETTES.light.den;

/** Hai vòng tròn vàng mảnh ở hai góc nền (như `GoldRings` của trang chủ công khai) */
const Rings: React.FC = () => (
  <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
    <View style={{ position: 'absolute', width: 440, height: 440, borderRadius: 220, borderWidth: 1, borderColor: HOME_LOOK.gold, opacity: 0.3, right: -260, top: 40 }} />
    <View style={{ position: 'absolute', width: 300, height: 300, borderRadius: 150, borderWidth: 1, borderColor: HOME_LOOK.gold, opacity: 0.3, left: -190, bottom: 60 }} />
  </View>
);

/** Khối nền giấy kem có hoa văn mờ và hai vòng vàng – nền chung các phần của sảnh, giống các khối của trang chủ công khai */
const PaperBand: React.FC<{ testID: string; children: React.ReactNode }> = ({ testID, children }) => {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  return (
    <View testID={testID} style={{ width: '100%', backgroundColor: HOME_LOOK.paper, overflow: 'hidden', paddingTop: wide ? 88 : 60, paddingBottom: wide ? 96 : 64, paddingHorizontal: wide ? 32 : 16 }}>
      <PatternOverlay opacity={0.075} />
      <Rings />
      {children}
    </View>
  );
};

/** Khung tên: chữ đậm màu mực, dòng phụ nghiêng đỏ, gờ trái đỏ son */
const NamePlate: React.FC<{ name: string; sub?: string; wide: boolean }> = ({ name, sub, wide }) => (
  <View style={[{ alignSelf: 'stretch', borderRadius: 18, paddingVertical: 14, paddingHorizontal: 20, gap: 2 }, PAPER_CARD, { borderLeftWidth: 5, borderLeftColor: HOME_LOOK.red }]}>
    <Txt f="heavy" size={wide ? 26 : 21} color={HOME_LOOK.ink} accessibilityRole="header">{name}</Txt>
    {sub ? <Txt f="serifItalic" size={16} color={HOME_LOOK.red}>{sub}</Txt> : null}
  </View>
);

// ---------------------------------------------------------------------- 1. Màn mở đầu Hoàng thành Thăng Long & nút biển gỗ VÀO TRẬN
/** Biển gỗ sơn son viền vàng hai trục cuốn rồng kiểu bảng lệnh cổ */
export const ScrollButton: React.FC<{ title: string; sub?: string; label: string; onPress: () => void; testID?: string; large?: boolean }> = ({ title, sub, label, onPress, testID, large = false }) => {
  const [hovered, setHovered] = useState(false);
  const rodH = large ? 104 : 84;
  const rod = (
    <View style={{ width: large ? 22 : 16, height: rodH, alignItems: 'center', justifyContent: 'space-between', zIndex: 2 }}>
      <View style={{ width: large ? 20 : 15, height: 10, borderRadius: 5, backgroundColor: '#f5b938', borderWidth: 2, borderColor: '#7a3f07' }} />
      <View style={{ width: large ? 18 : 14, flex: 1, marginVertical: -2, borderRadius: 4, backgroundColor: '#a32a18', borderWidth: 2.5, borderColor: '#f5b938' }} />
      <View style={{ width: large ? 20 : 15, height: 10, borderRadius: 5, backgroundColor: '#f5b938', borderWidth: 2, borderColor: '#7a3f07' }} />
    </View>
  );
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} testID={testID}
      onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', alignSelf: 'center',
        transform: [{ translateY: pressed ? 3 : hovered ? -2 : 0 }, { scale: pressed ? 0.98 : 1 }],
        cursor: 'pointer',
      } as object)}>
      {rod}
      <View style={{
        minHeight: large ? 86 : 68, minWidth: large ? 248 : 200, paddingHorizontal: large ? 34 : 26, paddingVertical: 10, marginHorizontal: -6,
        backgroundColor: hovered ? '#6b2f10' : '#58240c',
        borderWidth: 4, borderColor: hovered ? '#facc15' : '#f59e0b',
        alignItems: 'center', justifyContent: 'center',
        boxShadow: hovered ? '4px 4px 0 #f59e0b, 0 12px 24px rgba(0,0,0,0.35)' : '4px 4px 0 #5c2308, 0 10px 20px rgba(0,0,0,0.3)',
      } as object}>
        <View style={{ position: 'absolute', left: 4, right: 4, top: 4, bottom: 4, borderWidth: 1.5, borderColor: 'rgba(255,214,102,0.55)', pointerEvents: 'none' } as object} />
        <Txt f="heavy" size={large ? 32 : 24} color={hovered ? HALL.goldHover : HALL.goldBright} style={{ letterSpacing: 3, textShadowColor: 'rgba(0,0,0,0.65)', textShadowOffset: { width: 1, height: 2 }, textShadowRadius: 2 }}>
          {title}
        </Txt>
        {sub ? <Txt f="bold" size={12} color="#ffe7b3" numberOfLines={1} style={{ maxWidth: 240, marginTop: 2 }}>{sub}</Txt> : null}
      </View>
      {rod}
    </Pressable>
  );
};

/** Nền trời xanh, mây trắng, tán cây hai bên và sân gạch vàng có viền chữ Vạn cố định đáy dưới chân Hoàng thành */
const GROUND_H = 112;
const CARPET_H = 36;
const FLOOR_TOTAL = GROUND_H + CARPET_H;

const HeroSkyAndGround: React.FC = () => (
  <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
    {/* Trời xanh, mây bồng bềnh và tán cây phía trên đường chân trời */}
    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: FLOOR_TOTAL }}>
      <Svg width="100%" height="100%" viewBox="0 0 1440 500" preserveAspectRatio="xMidYMax slice">
        <Rect width="1440" height="500" fill="#8fd3ec" />
        <Rect y="0" width="1440" height="200" fill="#7fc8e5" opacity="0.55" />
        <Path d="M0 155 Q85 90 170 130 Q255 62 355 115 Q445 72 530 128 Q620 76 720 124 Q825 70 935 120 Q1040 66 1150 118 Q1255 70 1355 122 Q1405 96 1440 114 L1440 420 L0 420 Z" fill="#cbeaf7" />
        <Path d="M0 245 Q95 190 205 225 Q310 170 430 215 Q540 175 660 222 Q780 170 915 218 Q1040 175 1170 220 Q1300 178 1440 218 L1440 500 L0 500 Z" fill="#e6f6fc" />
        <Circle cx="45" cy="400" r="108" fill="#2c6334" />
        <Circle cx="135" cy="435" r="98" fill="#23542b" />
        <Circle cx="215" cy="468" r="82" fill="#35733e" />
        <Circle cx="1395" cy="400" r="108" fill="#2c6334" />
        <Circle cx="1305" cy="435" r="98" fill="#23542b" />
        <Circle cx="1225" cy="468" r="82" fill="#35733e" />
      </Svg>
    </View>
    {/* Sân gạch vàng hoàng cung + viền thảm chữ Vạn cố định chiều cao để Hoàng thành luôn chạm đúng chân tường */}
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: FLOOR_TOTAL }}>
      <Svg width="100%" height="100%" viewBox="0 0 1440 148" preserveAspectRatio="none">
        <Rect y="0" width="1440" height="112" fill="#e7b64c" />
        <Rect y="0" width="1440" height="7" fill="#462d1b" />
        {[34, 66, 96].map((y) => <Rect key={y} y={y} width="1440" height="3" fill="#c78d2c" opacity="0.65" />)}
        {Array.from({ length: 18 }, (_, i) => (
          <Rect key={i} x={i * 84 + 12} y="7" width="3" height="105" fill="#c78d2c" opacity="0.45" />
        ))}
        <Rect y="112" width="1440" height="36" fill="#b8261b" />
        <Rect y="112" width="1440" height="5" fill="#f3c552" />
        {Array.from({ length: 24 }, (_, i) => (
          <Path key={i} d={`M${i * 60 + 10} 123 H${i * 60 + 48} V138 H${i * 60 + 22} V130 H${i * 60 + 36}`} fill="none" stroke="#f3c552" strokeWidth="3.2" opacity="0.88" />
        ))}
      </Svg>
    </View>
  </View>
);

/** Mây xoáy màu xanh ngọc viền kem ở hai góc dưới tiền cảnh */
const CornerClouds: React.FC<{ compact: boolean }> = ({ compact }) => {
  const w = compact ? 160 : 320;
  const h = compact ? 105 : 195;
  const cloudSvg = (flip: boolean) => (
    <Svg width={w} height={h} viewBox="0 0 320 195" style={flip ? { transform: [{ scaleX: -1 }] } : undefined}>
      <Path d="M0 195 L0 48 Q42 14 96 42 Q144 64 148 118 Q195 94 236 128 Q272 152 292 195 Z" fill="#2c7fa1" stroke="#f2e2b8" strokeWidth="10" />
      <Path d="M40 94 C64 68 106 80 100 112 C94 138 62 134 66 112 C69 98 84 102 82 112" fill="none" stroke="#f2e2b8" strokeWidth="8" strokeLinecap="round" />
      <Path d="M168 156 C188 134 222 144 216 168 C212 184 188 182 190 168" fill="none" stroke="#f2e2b8" strokeWidth="7" strokeLinecap="round" />
    </Svg>
  );
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', zIndex: 6 }}>
      {cloudSvg(false)}
      {cloudSvg(true)}
    </View>
  );
};

export const HallHero: React.FC<{ onPlay: () => void }> = ({ onPlay }) => {
  const { width, height } = useWindowDimensions();
  const compact = width < 820;
  // Chiếm trọn chiều cao màn hình ngay dưới thanh điều hướng (64px) để ở zoom 100% không lộ phần "Muốn làm Trạng nguyên?" bên dưới
  const heroH = compact ? Math.max(580, height - 64) : Math.max(620, height - 64);
  const citadelW = Math.min(width * (compact ? 0.96 : 0.86), 1120);
  const citadelH = citadelW * (341 / 1024);
  const charH = compact ? 215 : Math.min(350, Math.max(275, heroH * 0.45));
  const charW = charH * (682 / 1024);

  return (
    <View testID="hall-hero" style={{ width: '100%', height: heroH, overflow: 'hidden', backgroundColor: '#8fd3ec', position: 'relative' }}>
      <HeroSkyAndGround />

      {/* Hoàng thành Thăng Long đứng sừng sững ngay trên mép sân gạch vàng */}
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: FLOOR_TOTAL - 8, alignItems: 'center', zIndex: 2 }}>
        <Image source={HALL_ART.citadel} style={{ width: citadelW, height: citadelH }} resizeMode="contain" accessibilityLabel="Hoàng thành Thăng Long" />
      </View>

      {/* Lớp nhân vật bên trái + Biển nút VÀO CHƠI bên phải */}
      <View style={{
        flex: 1, zIndex: 4, maxWidth: 1260, width: '100%', alignSelf: 'center',
        paddingHorizontal: compact ? 16 : 44, paddingTop: compact ? 20 : 28, paddingBottom: compact ? 58 : 54,
        justifyContent: 'flex-end',
      }}>
        {/* Bố cục chính: trái là Vua Trần & Trần Hưng Đạo, phải là nút VÀO CHƠI */}
        {compact ? (
          <View style={{ alignItems: 'center', gap: 16, marginTop: 'auto' }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' }}>
              <Bob><Image source={HALL_ART.vuaTran} style={{ width: charW, height: charH, marginRight: -16 }} resizeMode="contain" accessibilityLabel="Vua Trần" /></Bob>
              <Bob delay={420}><Image source={HALL_ART.tranHungDao} style={{ width: charW, height: charH }} resizeMode="contain" accessibilityLabel="Trần Hưng Đạo" /></Bob>
            </View>
            <ScrollButton title="VÀO CHƠI" onPress={onPlay} testID="hall-play" label="Vào chơi Hành trình Đông A" />
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 'auto', paddingHorizontal: 18 }}>
            {/* Hai vị anh hùng đứng bên trái sân thành */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginLeft: 32 }}>
              <Bob><Image source={HALL_ART.vuaTran} style={{ width: charW, height: charH, marginRight: -26 }} resizeMode="contain" accessibilityLabel="Vua Trần" /></Bob>
              <Bob delay={450}><Image source={HALL_ART.tranHungDao} style={{ width: charW * 1.03, height: charH * 1.03 }} resizeMode="contain" accessibilityLabel="Trần Hưng Đạo" /></Bob>
            </View>
            {/* Biển nút VÀO CHƠI nổi bật bên phải */}
            <View style={{ alignItems: 'center', marginBottom: 82, marginRight: 28 }}>
              <ScrollButton large title="VÀO CHƠI" onPress={onPlay} testID="hall-play" label="Vào chơi Hành trình Đông A" />
            </View>
          </View>
        )}
      </View>

      <CornerClouds compact={compact} />
    </View>
  );
};

// ---------------------------------------------------------------------- 2. Giới thiệu “Muốn làm Trạng nguyên?” (nền giấy, tiêu đề và thẻ giấy như trang chủ công khai)
const FEATURES: ReadonlyArray<{ image: ImageSourcePropType; title: string; text: string }> = [
  { image: HALL_ART.featureGame, title: 'Học qua trò chơi', text: 'Kết hợp học sử và vượt 13 chặng khám phá, mở hòm báu, tích sao để thăng bậc Khoa bảng từ Học trò tới Trạng nguyên.' },
  { image: HALL_ART.featureMap, title: 'Nhập vai và bản đồ', text: 'Trải nghiệm thế giới 3D, nhận quân lệnh, dàn trận cọc Bạch Đằng và đối chiếu trực tiếp trên bản đồ lịch sử.' },
  { image: HALL_ART.featureAi, title: 'Hỏi Tiểu Tướng', text: 'Trợ lý AI giải đáp sử liệu, gợi ý lộ trình học và thẻ ghi nhớ để em ôn lại mọi lúc.' },
];

export const HallSteps: React.FC = () => {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  return (
    <PaperBand testID="hall-intro">
      <View style={{ maxWidth: 1120, width: '100%', alignSelf: 'center', alignItems: 'center', gap: wide ? 40 : 28 }}>
        <SectionHeading eyebrow="Hào Khí Đông A" title="Muốn làm" accent="Trạng nguyên?" wide={wide} testID="hall-intro-heading"
          description="Học hết mình, chinh phục sử Trần: mỗi giờ học Lịch sử trở nên sống động và đáng nhớ qua hành trình ba lần kháng chiến chống quân Mông – Nguyên thời Trần." />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: wide ? 24 : 16, width: '100%' }}>
          {FEATURES.map(({ image, title, text }) => (
            <View key={title} style={[{ flexGrow: 1, flexBasis: 280, maxWidth: 360, alignItems: 'center', gap: 12, borderRadius: 28, paddingVertical: 24, paddingHorizontal: 22 }, PAPER_CARD]}>
              <Image source={image} style={{ width: 148, height: 118 }} resizeMode="contain" accessibilityLabel={title} />
              <Txt f="heavy" size={19} color={HOME_LOOK.ink} center>{title}</Txt>
              <Txt f="medium" size={15} color={HOME_LOOK.soft} center style={{ lineHeight: 23 }}>{text}</Txt>
            </View>
          ))}
        </View>
      </View>
    </PaperBand>
  );
};

// ---------------------------------------------------------------------- 3. Khu trưng bày Danh hiệu Khoa bảng (5 bậc) & Nhân vật lịch sử thời Trần (9 nhân vật)
// 25/11/2026: bỏ nền chuyển sắc xanh – tím – đỏ, dùng nền giấy, thẻ giấy và tiêu đề như khối "Các vị vua thời Trần" của trang chủ công khai
type ShowcaseMode = 'ranks' | 'heroes';

export const HallCharacters: React.FC<{ rank?: RankState }> = ({ rank }) => {
  const { width } = useWindowDimensions();
  const wide = width >= 940;
  const oneRow = width >= 1120;
  const calm = useCalm();
  const [mode, setMode] = useState<ShowcaseMode>('ranks');
  const [rankIdx, setRankIdx] = useState(rank?.level ?? 0);
  const [heroIdx, setHeroIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (rank) setRankIdx(rank.level);
  }, [rank?.level]);

  // Tự chuyển luân phiên sau mỗi 6 giây; dừng khi người dùng bấm chọn hoặc bật giảm chuyển động
  useEffect(() => {
    if (calm || paused) return undefined;
    const t = setInterval(() => {
      if (mode === 'ranks') setRankIdx((i) => (i + 1) % RANKS.length);
      else setHeroIdx((i) => (i + 1) % HALL_CHARACTERS.length);
    }, 6000);
    return () => clearInterval(t);
  }, [calm, paused, mode]);

  const activeRank = RANKS[rankIdx] ?? RANKS[0];
  const activeRankArt = HALL_RANK_ART[rankIdx] ?? HALL_ART.rankHocTro;
  const activeHero: HallCharacter = HALL_CHARACTERS[heroIdx] ?? HALL_CHARACTERS[0];
  const curLevel = rank?.level ?? 0;
  const reached = rankIdx <= curLevel;
  const aiming = rankIdx === curLevel + 1;

  const pickRank = (i: number) => { setRankIdx(i); setPaused(true); };
  const pickHero = (i: number) => { setHeroIdx(i); setPaused(true); };
  const switchMode = (next: ShowcaseMode) => { setMode(next); setPaused(false); };
  const ring = (sel: boolean) => ({ borderWidth: sel ? 3 : 1, borderColor: sel ? HOME_LOOK.red : HOME_LOOK.line });

  const renderHeroCard = (ch: HallCharacter, i: number) => {
    const sel = i === heroIdx;
    return (
      <Pressable key={ch.key} testID={`hall-char-${ch.key}`} onPress={() => pickHero(i)} accessibilityRole="button" accessibilityState={{ selected: sel }} accessibilityLabel={`Xem nhân vật ${ch.name}`}
        style={({ pressed }) => ({ flex: 1, minWidth: 0, alignItems: 'center', gap: 6, opacity: pressed ? 0.85 : 1, transform: [{ translateY: sel ? -3 : 0 }] })}>
        <View style={{ width: '100%', maxWidth: oneRow ? 106 : 112, height: oneRow ? 86 : 82, borderRadius: 14, overflow: 'hidden', backgroundColor: TILE, alignItems: 'center', justifyContent: 'flex-end', ...ring(sel) }}>
          <Image source={ch.image} style={{ width: 66, height: 80 }} resizeMode="contain" />
        </View>
        <Txt f={sel ? 'heavy' : 'bold'} size={12} color={sel ? HOME_LOOK.red : HOME_LOOK.ink} numberOfLines={1} center>{ch.shortName}</Txt>
      </Pressable>
    );
  };

  return (
    <PaperBand testID="hall-characters">
      <View style={{ maxWidth: 1180, width: '100%', alignSelf: 'center', gap: wide ? 32 : 24 }}>
        <SectionHeading eyebrow="Gương mặt lịch sử" title="Khoa bảng và" accent="nhân vật thời Trần" wide={wide} testID="hall-characters-heading" />
        {/* Chuyển giữa 5 bậc Danh hiệu Khoa bảng và 9 Nhân vật lịch sử thời Trần */}
        <View style={{ alignItems: 'center' }}>
          <View accessibilityRole="tablist" style={[{ flexDirection: 'row', borderRadius: 999, padding: 5, gap: 6 }, PAPER_CARD]}>
            {([
              { id: 'ranks' as const, label: 'Bậc danh hiệu (5)' },
              { id: 'heroes' as const, label: 'Nhân vật thời Trần (9)' },
            ]).map((tab) => {
              const on = mode === tab.id;
              return (
                <Pressable key={tab.id} testID={`hall-mode-${tab.id}`} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => switchMode(tab.id)}
                  style={({ pressed }) => ({ paddingHorizontal: wide ? 22 : 14, minHeight: 44, borderRadius: 999, justifyContent: 'center', alignItems: 'center', backgroundColor: on ? HOME_LOOK.red : pressed ? HOME_LOOK.paper : 'transparent' })}>
                  <Txt f="bold" size={wide ? 14.5 : 13} color={on ? '#ffffff' : HOME_LOOK.ink}>{tab.label}</Txt>
                </Pressable>
              );
            })}
          </View>
        </View>

        {mode === 'ranks' ? (
          <View style={{ flexDirection: wide ? 'row' : 'column', gap: wide ? 40 : 22, alignItems: wide ? 'center' : 'stretch' }}>
            {/* Tranh dọc lớn của bậc đang xem */}
            <View style={{
              width: wide ? 360 : '100%', maxWidth: 380, alignSelf: 'center', aspectRatio: 682 / 1024, borderRadius: 28, overflow: 'hidden',
              backgroundColor: TILE, borderWidth: 1, borderColor: HOME_LOOK.line, position: 'relative', boxShadow: '0 18px 40px rgba(35, 56, 47, 0.16)',
            } as object}>
              <Image source={activeRankArt} style={{ width: '100%', height: '100%' }} resizeMode="cover" accessibilityLabel={`Minh họa bậc ${activeRank.name}`} />
              {rank && rankIdx === curLevel ? (
                <View style={{ position: 'absolute', top: 14, left: 14, backgroundColor: HOME_LOOK.red, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1.5, borderColor: '#fff3cf' }}>
                  <Txt f="heavy" size={11} color="#fff3cf" style={{ letterSpacing: 0.8 }}>EM Ở ĐÂY</Txt>
                </View>
              ) : null}
            </View>

            <View style={{ flex: 1, gap: 16, minWidth: 0 }}>
              <NamePlate name={activeRank.name} sub={`Bậc ${rankIdx + 1} / ${RANKS.length} · khoa cử thời Trần`} wide={wide} />
              <View style={[{ borderRadius: 22, padding: wide ? 22 : 16, gap: 10 }, PAPER_CARD]}>
                <Txt f="medium" size={15.5} color={HOME_LOOK.ink} style={{ lineHeight: 26 }}>{activeRank.note}</Txt>
                <Txt size={14.5} color={HOME_LOOK.soft} style={{ lineHeight: 22 }}>
                  <Txt f="heavy" size={14.5} color={HOME_LOOK.red}>Điều kiện trong trò chơi: </Txt>{activeRank.need}
                </Txt>
                {rank ? (
                  reached ? (
                    <Txt f="bold" size={13.5} color="#145a4c">{rankIdx === curLevel ? 'Đây là danh hiệu hiện tại của em.' : 'Em đã đạt danh hiệu này.'}</Txt>
                  ) : aiming && rank.next ? (
                    <View style={{ gap: 6, marginTop: 2 }}>
                      <Txt f="bold" size={13.5} color={HOME_LOOK.red}>Tiến độ: {rank.next.done}/{rank.next.total} {rank.next.unit}</Txt>
                      <Progress done={rank.next.done} total={rank.next.total} label={`Tiến độ tới danh hiệu ${activeRank.name}`} />
                    </View>
                  ) : (
                    <Txt size={13} color={HOME_LOOK.soft}>Đạt danh hiệu {RANKS[rankIdx - 1]?.name ?? ''} trước để mở bậc này.</Txt>
                  )
                ) : null}
              </View>

              {/* Khay chọn 5 bậc */}
              <View style={[{ borderRadius: 22, padding: wide ? 16 : 12 }, PAPER_CARD]}>
                <View style={{ flexDirection: 'row', gap: wide ? 12 : 8, alignItems: 'flex-start' }}>
                  {RANKS.map((rk, i) => {
                    const sel = i === rankIdx;
                    const thumb = HALL_RANK_ART[i] ?? HALL_ART.rankHocTro;
                    return (
                      <Pressable key={rk.key} testID={`hall-rank-${rk.key}`} onPress={() => pickRank(i)} accessibilityRole="button" accessibilityState={{ selected: sel }} accessibilityLabel={`Xem bậc ${rk.name}`}
                        style={({ pressed }) => ({ flex: 1, minWidth: 0, alignItems: 'center', gap: 8, opacity: pressed ? 0.85 : 1, transform: [{ translateY: sel ? -3 : 0 }] })}>
                        <View style={{ width: '100%', aspectRatio: 1, borderRadius: 14, overflow: 'hidden', backgroundColor: TILE, ...ring(sel) }}>
                          <Image source={thumb} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                        </View>
                        <Txt f={sel ? 'heavy' : 'bold'} size={wide ? 12.5 : 11} color={sel ? HOME_LOOK.red : HOME_LOOK.ink} numberOfLines={1} center>{rk.name}</Txt>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View style={{ gap: 24 }}>
            <View style={{ flexDirection: wide ? 'row' : 'column', gap: wide ? 34 : 20, alignItems: wide ? 'center' : 'stretch' }}>
              <View style={{
                width: wide ? 340 : '100%', maxWidth: 400, alignSelf: 'center', height: wide ? 370 : 320, borderRadius: 28, overflow: 'hidden',
                backgroundColor: TILE, borderWidth: 1, borderColor: HOME_LOOK.line, alignItems: 'center', justifyContent: 'flex-end', position: 'relative',
                boxShadow: '0 18px 40px rgba(35, 56, 47, 0.16)',
              } as object}>
                <DrumSun size={280} color={HOME_LOOK.gold} opacity={0.45} style={{ position: 'absolute', top: -60, right: -60 }} />
                <View style={{ position: 'absolute', top: 14, left: 14, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, backgroundColor: '#ffffff', borderWidth: 1, borderColor: HOME_LOOK.line }}>
                  <Txt f="bold" size={12} color={HOME_LOOK.red}>{activeHero.era}</Txt>
                </View>
                <Bob range={5}>
                  <Image source={activeHero.image} style={{ width: wide ? 250 : 205, height: wide ? 330 : 280, marginBottom: 8 }} resizeMode="contain" accessibilityLabel={activeHero.name} />
                </Bob>
              </View>

              <View style={{ flex: 1, gap: 16, minWidth: 0 }}>
                <NamePlate name={activeHero.name} sub={activeHero.title} wide={wide} />
                <View style={[{ borderRadius: 22, padding: wide ? 24 : 18, gap: 12 }, PAPER_CARD]}>
                  <Txt f="medium" size={15.5} color={HOME_LOOK.ink} style={{ lineHeight: 26 }}>{activeHero.bio}</Txt>
                  <View style={{ height: 1, backgroundColor: HOME_LOOK.line }} />
                  <Txt size={14.5} color={HOME_LOOK.soft} style={{ lineHeight: 23 }}>
                    <Txt f="heavy" size={14.5} color={HOME_LOOK.red}>Chiến công nổi bật: </Txt>{activeHero.deed}
                  </Txt>
                  <Txt f="serifItalic" size={16} color={HOME_LOOK.ink} style={{ lineHeight: 25 }}>{activeHero.quote}</Txt>
                </View>
              </View>
            </View>

            <View style={[{ borderRadius: 22, padding: oneRow ? 14 : 12, gap: 12 }, PAPER_CARD]}>
              {oneRow ? (
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                  {HALL_CHARACTERS.map((ch, i) => renderHeroCard(ch, i))}
                </View>
              ) : (
                <View style={{ gap: 12, maxWidth: 460, width: '100%', alignSelf: 'center' }}>
                  {[0, 3, 6].map((start) => (
                    <View key={start} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                      {HALL_CHARACTERS.slice(start, start + 3).map((ch, offset) => renderHeroCard(ch, start + offset))}
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}
      </View>
    </PaperBand>
  );
};

// ---------------------------------------------------------------------- 4. Bảng vàng (khung khung-bang-vang.png) trên nền giấy như trang chủ công khai (25/11/2026: bỏ sân khấu cam đỏ)
type Scope = 'class' | 'school';
type Period = 'week' | 'month' | 'all';
const PERIOD_TEXT: Record<string, string> = { week: 'tuần này', month: 'tháng này', all: 'từ trước tới nay' };

/** Bảng chữ sẫm màu mực của trang chủ đặt trong khung gỗ */
const STAGE = { panel: HOME_LOOK.ink, line: 'rgba(255,255,255,0.16)' };
const TOP_BADGE = ['#f54545', '#ff8547', '#ffac38'];

const Pill: React.FC<{ on: boolean; label: string; onPress: () => void; testID: string }> = ({ on, label, onPress, testID }) => (
  <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={label} onPress={onPress} testID={testID}
    style={({ pressed }) => ({
      minHeight: 44, paddingHorizontal: 16, borderRadius: 22, justifyContent: 'center',
      backgroundColor: on ? HOME_LOOK.red : pressed ? HOME_LOOK.paper : '#ffffff', borderWidth: 1, borderColor: on ? HOME_LOOK.red : HOME_LOOK.line,
    })}>
    <Txt f="bold" size={14} color={on ? '#ffffff' : HOME_LOOK.ink}>{label}</Txt>
  </Pressable>
);

export const HallBoard: React.FC<{ session: Session; classId: number | null; className?: string | null }> = ({ session, classId, className }) => {
  const { width } = useWindowDimensions();
  const wideFrame = width >= 860;
  const [picked, setScope] = useState<Scope | null>(null);
  const scope: Scope = picked ?? (classId ? 'class' : 'school');
  const [period, setPeriod] = useState<Period>('week');
  const board = useLoad<Board>(session, (t) => game.leaderboard(t, scope === 'class' ? { scope, period, class_id: classId ?? undefined } : { scope }), [scope, period, classId]);
  const data = board.data && board.data.scope === scope ? board.data : null;
  const entries = data?.entries ?? [];
  const ranked = entries.slice(0, 10);
  const meBelow = entries.slice(10).find((e) => e.me) ?? null;
  const shownPeriod = PERIOD_TEXT[data?.period ?? period] ?? '';

  const row = (e: Board['entries'][number], key: string, i: number) => {
    const topColor = e.rank >= 1 && e.rank <= 3 ? TOP_BADGE[e.rank - 1] : null;
    const badgeBg = topColor ?? '#8eb9f5';
    const nameColor = e.me ? '#ffe7a6' : topColor ?? '#ffffff';
    return (
      <View key={key} accessible accessibilityLabel={`Hạng ${e.rank}: ${e.name}, ${num(e.xp)} điểm`}
        style={{
          minHeight: wideFrame ? 38 : 46, flexDirection: 'row', alignItems: 'center', gap: 12,
          paddingHorizontal: 14, borderTopWidth: i ? 1 : 0, borderTopColor: STAGE.line,
          backgroundColor: e.me ? 'rgba(255, 199, 95, 0.18)' : 'transparent',
        }}>
        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: badgeBg, alignItems: 'center', justifyContent: 'center' }}>
          <Txt f="heavy" size={12} color="#ffffff">{e.rank}</Txt>
        </View>
        <Txt f={topColor || e.me ? 'heavy' : 'semibold'} size={wideFrame ? 14 : 15} color={nameColor} numberOfLines={1} style={{ flex: 1 }}>
          {e.name}{e.me && e.name !== 'Em' ? ' (em)' : ''}
        </Txt>
        <Txt f="heavy" size={wideFrame ? 15 : 16} color={HALL.goldBright}>{num(e.xp)}pt</Txt>
      </View>
    );
  };

  const boardContent = !data ? (
    <View style={{ padding: 16 }}><LoadState loading={board.loading} error={board.error} onRetry={board.reload} /></View>
  ) : data.disabled ? (
    <View style={{ padding: 20 }}><Txt f="semibold" size={15} color="#ffffff" center>{data.message ?? 'Bảng xếp hạng đang tắt.'}</Txt></View>
  ) : (
    <View testID="board-list" style={{ flex: 1 }}>
      {/* Khung đánh dấu top 3 Tam khôi cho trợ năng & kiểm thử */}
      <View testID="board-podium" style={{ flex: 1 }}>
        {ranked.map((e, i) => row(e, `r${i}`, i))}
        {meBelow ? row(meBelow, 'me', ranked.length) : null}
        {!entries.length ? (
          <View style={{ padding: 24, alignItems: 'center', gap: 6 }}>
            <Txt f="bold" size={15} color={HALL.goldSoft} center>Chưa có bạn nào ghi điểm {shownPeriod}.</Txt>
            <Txt size={13} color="#d6e2e8" center>Hoàn thành một chặng để trở thành người đầu tiên ghi danh lên Bảng vàng!</Txt>
          </View>
        ) : null}
      </View>
      {scope === 'school' ? (
        <Txt size={11} color="#cbd5e1" center style={{ paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: STAGE.line }}>
          Bảng toàn trường chỉ hiện biệt danh của các bạn; bạn chưa đặt biệt danh được ẩn tên.
        </Txt>
      ) : null}
    </View>
  );

  // Kích thước khung khung-bang-vang.png (1024x445) đủ rộng để chứa gọn Top 10
  const frameW = Math.min(width - 64, 1140);
  const frameH = Math.max(460, frameW * (445 / 1024));
  const label = data?.label ?? (scope === 'class' ? `Lớp ${className ?? ''}` : 'Toàn trường');

  return (
    <PaperBand testID="hall-board">
      <View style={{ maxWidth: 1240, width: '100%', alignSelf: 'center', gap: 22 }}>
        <SectionHeading eyebrow="Bảng vàng" title="Ghi danh" accent="Top 10" description={`${label} · ${shownPeriod}`} wide={wideFrame} testID="hall-board-heading" />

        {/* Bộ lọc Lớp / Trường & Tuần / Tháng / Từ đầu */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
          {classId ? <Pill on={scope === 'class'} label={className ? `Lớp ${className}` : 'Lớp của em'} onPress={() => setScope('class')} testID="board-scope-class" /> : null}
          <Pill on={scope === 'school'} label="Toàn trường" onPress={() => setScope('school')} testID="board-scope-school" />
          {scope === 'class' ? (['week', 'month', 'all'] as Period[]).map((p) => (
            <Pill key={p} on={period === p} label={p === 'week' ? 'Tuần' : p === 'month' ? 'Tháng' : 'Từ đầu'} onPress={() => setPeriod(p)} testID={`board-period-${p}`} />
          )) : null}
        </View>

        {/* Khung bảng gỗ Vua Trần & Trần Hưng Đạo (màn rộng); màn hẹp chỉ còn bảng chữ viền vàng */}
        {wideFrame ? (
          <View style={{ width: frameW, height: frameH, alignSelf: 'center', position: 'relative' }}>
            <Image source={HALL_ART.boardFrame} style={{ width: '100%', height: '100%' }} resizeMode="stretch" accessibilityLabel="Khung Bảng vàng có Vua Trần và Trần Hưng Đạo" />
            {/* Chữ trong biển gỗ trên đỉnh khung */}
            <View pointerEvents="none" style={{ position: 'absolute', left: '31%', right: '31%', top: '5.5%', height: '13%', alignItems: 'center', justifyContent: 'center' }}>
              <Txt f="heavy" size={17} color={HALL.goldBright} style={{ letterSpacing: 2.5 }} numberOfLines={1}>TOP 10 GHI DANH</Txt>
            </View>
            {/* Bảng chữ đặt lọt lòng trong phần giấy giữa khung (left 18%..82%, top 21.5%..84.5%) */}
            <View style={{
              position: 'absolute', left: '18.2%', right: '18.2%', top: '21.5%', bottom: '15.2%',
              backgroundColor: STAGE.panel, borderRadius: 10, borderWidth: 2, borderColor: '#5c3c1e', overflow: 'hidden',
            }}>
              <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, justifyContent: entries.length ? 'flex-start' : 'center' }}>
                {boardContent}
              </ScrollView>
            </View>
          </View>
        ) : (
          <View style={{ backgroundColor: STAGE.panel, borderRadius: 20, borderWidth: 3, borderColor: HOME_LOOK.gold, overflow: 'hidden', boxShadow: '0 10px 30px rgba(35, 56, 47, 0.16)' } as object}>
            <View style={{ paddingVertical: 10, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: STAGE.line }}>
              <Txt f="heavy" size={15} color={HALL.goldBright} style={{ letterSpacing: 2 }}>TOP 10 GHI DANH</Txt>
            </View>
            {boardContent}
          </View>
        )}
      </View>
    </PaperBand>
  );
};

// ---------------------------------------------------------------------- 5. Thư viện tranh & bản đồ (chỉ xem ảnh, không bấm mở chi tiết, 10 thẻ tự trượt đổi vị trí) trên nền giấy như trang chủ công khai
type Picture = { key: string; title: string; src: typeof HALL_ART[keyof typeof HALL_ART]; bg?: string };

const shuffleSlots = (prev: number[]): number[] => {
  const next = [...prev];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  // Bảo đảm mỗi lượt xáo đều có dịch chuyển rõ ràng
  if (next.every((v, idx) => v === prev[idx]) && next.length > 1) {
    next.push(next.shift()!);
  }
  return next;
};

export const HallGallery: React.FC<{ level: number; home: SagaHome }> = ({ level: _level, home: _home }) => {
  const { width } = useWindowDimensions();
  const wide = width >= 960;
  const calm = useCalm();
  const [gridW, setGridW] = useState(0);

  const pictures = useMemo<Picture[]>(() => [
    { key: 'bach-dang-plan', title: 'Bàn kế trận Bạch Đằng', src: HALL_ART.bachDangPlan },
    { key: 'citadel', title: 'Hoàng thành Thăng Long', src: HALL_ART.citadel, bg: '#bfe8f7' },
    { key: 'board-frame', title: 'Bảng vàng Vương triều Trần', src: HALL_ART.boardFrame, bg: '#fbe7c6' },
    { key: 'scene-river', title: 'Ra quân giữ sông nước', src: HALL_ART.sceneRiver },
    { key: 'scene-march', title: 'Hành quân qua núi non', src: HALL_ART.sceneMarch },
    { key: 'map-1', title: 'Bản đồ Kháng chiến lần 1 · 1258', src: HALL_ART.map1 },
    { key: 'map-2', title: 'Bản đồ Kháng chiến lần 2 · 1285', src: HALL_ART.map2 },
    { key: 'map-3', title: 'Bản đồ Kháng chiến lần 3 · 1287–1288', src: HALL_ART.map3 },
    { key: 'scene-fleet', title: 'Thủy quân nhà Trần', src: HALL_ART.sceneFleet },
    { key: 'scene-bach-dang', title: 'Đại thắng Bạch Đằng', src: HALL_ART.sceneBachDang },
  ], []);

  const [slots, setSlots] = useState<number[]>(() => pictures.map((_, i) => i));

  useEffect(() => {
    if (calm) return undefined;
    const t = setInterval(() => setSlots((prev) => shuffleSlots(prev)), 3200);
    return () => clearInterval(t);
  }, [calm]);

  const cols = width >= 960 ? 5 : width >= 540 ? 2 : 1;
  const gap = wide ? 14 : 10;
  const fallbackW = Math.max(260, Math.min(width - (wide ? 64 : 32), 1260));
  const usableW = gridW > 0 ? gridW : fallbackW;
  const cardW = (usableW - gap * (cols - 1)) / cols;
  const cardH = Math.round(cardW / 1.62);
  const rows = Math.ceil(pictures.length / cols);
  const totalH = rows * cardH + Math.max(0, rows - 1) * gap;

  const renderArt = (p: Picture) => (
    <View style={{ width: '100%', height: '100%', backgroundColor: p.bg ?? '#1c1815', alignItems: 'center', justifyContent: 'center', padding: p.bg ? 6 : 0 }}>
      <Image source={p.src} style={{ width: '100%', height: '100%' }} resizeMode={p.bg ? 'contain' : 'cover'} accessibilityLabel={p.title} />
    </View>
  );

  return (
    <PaperBand testID="hall-gallery">
      <View style={{ maxWidth: 1260, width: '100%', alignSelf: 'center', gap: wide ? 34 : 24 }}>
        <SectionHeading eyebrow="Thư viện" title="Tranh và" accent="bản đồ" wide={wide} testID="hall-gallery-heading"
          description="Sống động và sáng tạo: cảnh ra quân, thủy chiến và bản đồ minh họa ba lần kháng chiến (bản đồ gốc Wikipedia ở trang Chiến dịch)." />

        {/* Lưới 10 thẻ ảnh (5 × 2), chỉ xem – không bấm mở chi tiết, trượt mượt đổi vị trí liên tục */}
        <View
          onLayout={(e) => {
            const w = Math.round(e.nativeEvent.layout.width);
            if (w > 0 && Math.abs(w - gridW) > 1) setGridW(w);
          }}
          style={{ width: '100%', height: totalH, position: 'relative' }}
        >
          {pictures.map((p, i) => {
            const slot = slots[i] ?? i;
            const col = slot % cols;
            const row = Math.floor(slot / cols);
            const x = col * (cardW + gap);
            const y = row * (cardH + gap);
            const posStyle = Platform.OS === 'web'
              ? ({
                position: 'absolute', left: 0, top: 0, width: cardW, height: cardH,
                transform: [{ translateX: x }, { translateY: y }],
                transitionProperty: 'transform',
                transitionDuration: calm || gridW === 0 ? '0ms' : '950ms',
                transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
                willChange: 'transform',
              } as object)
              : { position: 'absolute' as const, left: x, top: y, width: cardW, height: cardH };
            return (
              <View key={p.key} style={posStyle}>
                <View testID={`gallery-${p.key}`} accessible accessibilityLabel={p.title}
                  style={{
                    width: '100%', height: '100%', borderRadius: 16, overflow: 'hidden', backgroundColor: TILE, borderWidth: 1, borderColor: HOME_LOOK.line,
                    boxShadow: '0 10px 24px rgba(35, 56, 47, 0.12)',
                  } as object}>
                  {renderArt(p)}
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </PaperBand>
  );
};

// ---------------------------------------------------------------------- 6. Hướng dẫn cách chơi (nền tranh Bạch Đằng phủ màu mực như khối cuối trang chủ công khai + nút Play tròn lớn)
const GUIDE_STEPS = [
  { icon: BookOpen, title: '1. Đọc thẻ kiến thức ngắn', desc: 'Mỗi chặng mở đầu bằng thẻ sử liệu súc tích: ai, ở đâu, khi nào, diễn biến và ý nghĩa lịch sử.' },
  { icon: Puzzle, title: '2. Vượt minigame luyện tập', desc: 'Trắc nghiệm, ghép cặp nhân vật – sự kiện, sắp xếp dòng thời gian và chấm điểm trên bản đồ gốc.' },
  { icon: Swords, title: '3. Nhập vai 3D & Trận đánh', desc: 'Đi vào thế giới khối 3D nhận quân lệnh, đóng cọc Bạch Đằng và đánh bại đội quân xâm lược.' },
  { icon: Award, title: '4. Mở hòm báu & Lên bảng vàng', desc: 'Tích lũy sao, vàng, thẻ tướng để thăng bậc Khoa bảng và ghi danh Top 10 lớp / toàn trường.' },
];

export const HallTutorial: React.FC<{ onPlay: () => void }> = ({ onPlay }) => {
  const { width } = useWindowDimensions();
  const compact = width < 640;
  const [open, setOpen] = useState(false);
  const size = compact ? 30 : 42;

  return (
    <View testID="hall-tutorial" style={{ width: '100%', minHeight: compact ? 340 : 420, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', position: 'relative', backgroundColor: HOME_LOOK.ink }}>
      <Image source={HALL_ART.bachDangPlan} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, width: '100%', height: '100%' }} resizeMode="cover" accessibilityLabel="Bối cảnh họp bàn kế trận Bạch Đằng" />
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(20, 31, 26, 0.74)' }} />

      <View style={{ paddingHorizontal: 20, paddingTop: 72, paddingBottom: 52, alignItems: 'center', gap: 14, maxWidth: 760 }}>
        <Txt f="bold" size={12.5} color={HOME_LOOK.gold} center style={{ letterSpacing: 1.6 }}>HƯỚNG DẪN</Txt>
        <Txt f="heavy" size={size} color="#ffffff" center accessibilityRole="header" style={{ lineHeight: size + 9, letterSpacing: -1 }}>
          Hướng dẫn <Txt f="serifItalic" size={size} color={HOME_LOOK.gold} style={{ letterSpacing: -0.5 }}>cách chơi</Txt>
        </Txt>
        <Txt f="medium" size={16} color="rgba(250, 244, 231, 0.88)" center style={{ lineHeight: 24 }}>
          Xem nhanh lộ trình 4 bước giúp em chinh phục trọn vẹn 13 chặng sử Trần và ghi danh Bảng vàng
        </Txt>

        <Pressable testID="hall-tutorial-play" accessibilityRole="button" accessibilityLabel="Mở hướng dẫn cách chơi Hành trình Đông A" onPress={() => setOpen(true)}
          style={({ pressed }) => ({
            marginTop: 8, width: compact ? 88 : 108, height: compact ? 88 : 108, borderRadius: 54,
            borderWidth: 2, borderColor: HOME_LOOK.gold,
            backgroundColor: pressed ? 'rgba(223, 182, 111, 0.28)' : 'rgba(223, 182, 111, 0.12)',
            alignItems: 'center', justifyContent: 'center',
            transform: [{ scale: pressed ? 0.95 : 1 }],
          })}>
          <Play size={compact ? 34 : 42} color="#ffffff" fill="#ffffff" style={{ marginLeft: 5 }} />
        </Pressable>
      </View>

      {open ? (
        <Sheet open wide onClose={() => setOpen(false)} title="Hướng dẫn Hành trình Đông A" subtitle="4 bước chinh phục ba lần kháng chiến chống quân Mông – Nguyên">
          <View style={{ gap: 14 }} testID="hall-tutorial-sheet">
            <Image source={HALL_ART.bachDangPlan} style={{ width: '100%', height: 210, borderRadius: 14 }} resizeMode="cover" />
            <View style={{ gap: 10 }}>
              {GUIDE_STEPS.map(({ icon: Icon, title, desc }) => (
                <View key={title} style={{ flexDirection: 'row', gap: 12, padding: 12, borderRadius: 14, backgroundColor: HOME_LOOK.paper, borderWidth: 1, borderColor: HOME_LOOK.line }}>
                  <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: HOME_LOOK.red, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={20} color="#ffffff" />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt f="heavy" size={15} color={HOME_LOOK.ink}>{title}</Txt>
                    <Txt size={13} color={HOME_LOOK.soft} style={{ lineHeight: 20 }}>{desc}</Txt>
                  </View>
                </View>
              ))}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Bắt đầu vào chơi ngay" onPress={() => { setOpen(false); onPlay(); }}
              style={({ pressed }) => ({ minHeight: 48, borderRadius: 999, backgroundColor: pressed ? '#000000' : L_DEN, alignItems: 'center', justifyContent: 'center' })}>
              <Txt f="bold" size={15} color="#ffffff">Bắt đầu vào chơi ngay</Txt>
            </Pressable>
          </View>
        </Sheet>
      ) : null}
    </View>
  );
};

// ---------------------------------------------------------------------- 7. Thang danh hiệu khoa cử 5 bậc thời Trần (dùng bộ 5 tranh minh họa Khoa bảng)
const RankCard: React.FC<{ i: number; rank: RankState; selected: boolean; onPress: () => void; fixed: boolean }> = ({ i, rank, selected, onPress, fixed }) => {
  const r = RANKS[i], L = RANK_LOOK[i];
  const art = HALL_RANK_ART[i] ?? HALL_ART.rankHocTro;
  const current = i === rank.level;
  const state = i <= rank.level ? 'done' : i === rank.level + 1 ? 'next' : 'locked';
  const status = current ? 'Em đang ở bậc này' : state === 'done' ? 'Đã đạt' : state === 'next' && rank.next ? `Đang tới: ${rank.next.done}/${rank.next.total} ${rank.next.unit}` : 'Chưa mở';
  return (
    <Pressable testID={`rank-card-${r.key}`} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }}
      accessibilityLabel={`Bậc ${i + 1}: ${r.name}. ${r.need}. ${status}`}
      style={({ pressed }) => ({
        flex: fixed ? 1 : undefined, width: fixed ? undefined : 204, borderRadius: 20, overflow: 'hidden', backgroundColor: '#ffffff',
        borderWidth: current || selected ? 3 : 2, borderBottomWidth: 6, borderColor: current ? HALL.gold : selected ? HALL.red : HALL.paperLine,
        transform: [{ translateY: pressed ? 2 : selected ? -3 : 0 }],
        boxShadow: selected ? '0 12px 24px rgba(184, 38, 27, 0.16)' : '0 6px 14px rgba(43, 29, 22, 0.08)',
      } as object)}>
      <View style={{ backgroundColor: L.soft, aspectRatio: 0.72, width: '100%', overflow: 'hidden', position: 'relative' }}>
        <Image source={art} style={{ width: '100%', height: '100%', opacity: state === 'locked' ? 0.86 : 1 }} resizeMode="cover" accessibilityLabel={`Minh họa bậc ${r.name}`} />
        {current ? (
          <View style={{ position: 'absolute', top: 10, left: 10, backgroundColor: HALL.red, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1.5, borderColor: '#fff3cf' }}>
            <Txt f="heavy" size={10} color="#fff3cf" style={{ letterSpacing: 0.6 }}>EM Ở ĐÂY</Txt>
          </View>
        ) : (
          <View style={{ position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(20, 14, 10, 0.68)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Txt f="bold" size={10} color="#fff3cf" style={{ letterSpacing: 0.6 }}>BẬC {i + 1}</Txt>
          </View>
        )}
        {state === 'locked' ? <View style={{ position: 'absolute', top: 10, right: 10, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(43,29,22,0.72)', alignItems: 'center', justifyContent: 'center' }}><Lock size={14} color="#fff3cf" /></View> : null}
        {state === 'done' && !current ? <View style={{ position: 'absolute', top: 10, right: 10, width: 28, height: 28, borderRadius: 14, backgroundColor: '#1d7a68', alignItems: 'center', justifyContent: 'center' }}><Check size={15} color="#ffffff" /></View> : null}
      </View>
      <View style={{ padding: 12, gap: 3 }}>
        <Txt f="bold" size={11} color={HALL.muted} style={{ letterSpacing: 1 }}>BẬC {i + 1}</Txt>
        <Txt f="heavy" size={17} color={HALL.ink} numberOfLines={1}>{r.name}</Txt>
        <Txt size={12.5} color={HALL.muted} numberOfLines={2} style={{ minHeight: 34 }}>{r.need}</Txt>
        <Txt f="bold" size={12} color={current ? HALL.red : state === 'done' ? '#145a4c' : HALL.muted} style={{ marginTop: 2 }}>{status}</Txt>
      </View>
    </Pressable>
  );
};

export const RankLadder: React.FC<{ rank: RankState; onPlay?: () => void; centerHeader?: boolean }> = ({ rank, onPlay, centerHeader = false }) => {
  const { width } = useWindowDimensions();
  const [sel, setSel] = useState(rank.level);
  useEffect(() => setSel(rank.level), [rank.level]);
  const fixed = width >= 960, wide = width >= 760;
  const r = RANKS[sel], L = RANK_LOOK[sel];
  const art = HALL_RANK_ART[sel] ?? HALL_ART.rankHocTro;
  const cards = RANKS.map((_, i) => <RankCard key={i} i={i} rank={rank} selected={i === sel} onPress={() => setSel(i)} fixed={fixed} />);
  const reached = sel <= rank.level, aiming = sel === rank.level + 1;
  return (
    <View style={{ gap: 20 }} testID="rank-ladder">
      <HallTitle center={centerHeader} eyebrow="THANG DANH HIỆU KHOA BẢNG" ink="Từ Học trò đến" red="Trạng nguyên"
        sub="Năm bậc lấy cảm hứng từ khoa cử thời Trần. Xong mỗi phần của hành trình, danh hiệu của em lên một bậc; đạt đủ sao ở cả ba phần thì đỗ Trạng nguyên. Bấm từng bậc để khám phá." />
      {fixed ? <View style={{ flexDirection: 'row', gap: 14 }}>{cards}</View>
        : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 6 }}>{cards}</ScrollView>}
      <View testID="rank-detail" style={{ flexDirection: wide ? 'row' : 'column', borderRadius: 24, overflow: 'hidden', backgroundColor: '#ffffff', borderWidth: 2, borderBottomWidth: 6, borderColor: HALL.paperLine, boxShadow: '0 10px 26px rgba(43,29,22,0.08)' } as object}>
        <View style={{ backgroundColor: L.soft, width: wide ? 260 : '100%', maxWidth: wide ? 260 : 300, alignSelf: 'center', aspectRatio: 682 / 1024, overflow: 'hidden' }}>
          <Image source={art} style={{ width: '100%', height: '100%' }} resizeMode="cover" accessibilityLabel={`Tranh danh hiệu ${r.name}`} />
        </View>
        <View style={{ flex: 1, padding: wide ? 28 : 18, gap: 12, justifyContent: 'center' }}>
          <View style={{ alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, backgroundColor: '#fdece8', borderWidth: 1, borderColor: '#f5c6bc' }}>
            <Txt f="heavy" size={12} color={HALL.red} style={{ letterSpacing: 1.4 }}>BẬC {sel + 1} / {RANKS.length} · KHOA CỬ THỜI TRẦN</Txt>
          </View>
          <Txt f="heavy" size={wide ? 30 : 25} color={HALL.ink} accessibilityRole="header">{r.name}</Txt>
          <Txt f="serif" size={18} color={HALL.ink} style={{ lineHeight: 28 }}>{r.note}</Txt>
          <View style={{ backgroundColor: HALL.paper, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1.5, borderColor: HALL.paperLine }}>
            <Txt f="bold" size={14} color={HALL.ink}>Điều kiện trong trò chơi: <Txt f="heavy" size={14} color={HALL.red}>{r.need}</Txt></Txt>
          </View>
          {reached ? <Txt f="bold" size={14} color="#145a4c">{sel === rank.level ? 'Đây là danh hiệu hiện tại của em.' : 'Em đã đạt danh hiệu này.'}</Txt>
            : aiming && rank.next ? (
              <View style={{ gap: 6 }}>
                <Txt f="bold" size={14} color={HALL.red}>Em đã có {rank.next.done}/{rank.next.total} {rank.next.unit}.</Txt>
                <Progress done={rank.next.done} total={rank.next.total} label={`Tiến độ tới danh hiệu ${r.name}`} />
              </View>
            ) : <Txt f="semibold" size={14} color={HALL.muted}>Đạt danh hiệu {RANKS[sel - 1]?.name ?? ''} trước để mở bậc này.</Txt>}
          {onPlay ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Vào chơi để thăng bậc danh hiệu" onPress={onPlay}
              style={({ pressed }) => ({
                alignSelf: 'flex-start', marginTop: 4, minHeight: 46, paddingHorizontal: 22, borderRadius: 14,
                backgroundColor: pressed ? HALL.redDeep : HALL.red, borderWidth: 2, borderBottomWidth: 4, borderColor: '#7a1710',
                alignItems: 'center', justifyContent: 'center',
              })}>
              <Txt f="heavy" size={14} color="#fff3cf" style={{ letterSpacing: 1 }}>VÀO CHƠI CHINH PHỤC</Txt>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------- 8. Chân trang gọn (màu mực của trang chủ công khai)
export const HallFooter: React.FC = () => (
  <View testID="hall-footer" style={{ width: '100%', backgroundColor: HOME_LOOK.ink, paddingVertical: 22, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }}>
    <Txt size={13} color="rgba(250, 244, 231, 0.82)" center>
      © 2026 · Bản quyền thuộc quản lý Đông A
    </Txt>
  </View>
);

/**
 * Sảnh mở đầu (mục Trang chủ): nằm trong khung `StudentWorkspace` như mọi mục khác (thanh đầu chung, 25/11/2026).
 * Bảng màu của trang chủ công khai (`PALETTES.light`) áp cho cả sảnh để tiêu đề, dải mây vàng và hoa văn nền giống hệt trang chủ.
 * `jump` = phần cần cuộn tới (bấm ở menu sổ xuống của Trang chủ; `n` tăng mỗi lần bấm), `onSection` báo phần đang xem cho thanh đầu.
 */
export const HallLandingScreen: React.FC<{
  session: Session;
  home: SagaHome | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  classId: number | null;
  className?: string | null;
  onPlay: () => void;
  jump?: { key: HallSectionKey; n: number } | null;
  onSection?: (key: HallSectionKey) => void;
}> = ({ session, home, loading, error, onRetry, classId, className, onPlay, jump = null, onSection }) => {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const scroller = useRef<ScrollViewInstance>(null);
  // Vị trí các phần đo lại mỗi lần cần (không chỉ lúc dựng): phía trên còn đổi chiều cao sau đó (bảng vàng tải xong, bậc danh hiệu tự đổi)
  const content = useRef<ComponentRef<typeof View>>(null);
  const boxes = useRef<Partial<Record<HallSectionKey, ComponentRef<typeof View> | null>>>({});
  const sectionY = useRef<Partial<Record<HallSectionKey, number>>>({});
  const want = useRef<HallSectionKey | null>(null);
  const current = useRef<HallSectionKey>('hero');
  const measuredAt = useRef(0);
  const recheck = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showTop, setShowTop] = useState(false);
  const rank = useMemo(() => scholarRank(home?.campaigns), [home]);
  useEffect(() => () => { if (recheck.current) clearTimeout(recheck.current); }, []);

  const measure = useCallback((key: HallSectionKey, done?: (y: number) => void): void => {
    const box = boxes.current[key], base = content.current;
    if (!box || !base) return;
    box.measureLayout(base, (_x, y) => { sectionY.current[key] = y; done?.(y); }, () => undefined);
  }, []);
  const scrollTo = useCallback((key: HallSectionKey): void => {
    if (key === 'hero') { scroller.current?.scrollTo({ y: 0, animated: true }); return; }
    if (!boxes.current[key]) { want.current = key; return; } // phần chưa dựng xong: cuộn khi dựng
    want.current = null;
    measure(key, (y) => {
      scroller.current?.scrollTo({ y: Math.max(0, y), animated: true });
      // cuộn xong đo lại một lần: phần phía trên vừa đổi chiều cao thì chỉnh cho khớp
      if (recheck.current) clearTimeout(recheck.current);
      recheck.current = setTimeout(() => measure(key, (y2) => { if (Math.abs(y2 - y) > 6) scroller.current?.scrollTo({ y: Math.max(0, y2), animated: false }); }), 900);
    });
  }, [measure]);
  const jumpKey = jump?.key ?? null, jumpN = jump?.n ?? 0;
  useEffect(() => { if (jumpKey) scrollTo(jumpKey); }, [jumpKey, jumpN, scrollTo]);
  const hold = (key: HallSectionKey) => ({
    ref: (el: ComponentRef<typeof View> | null) => { boxes.current[key] = el; },
    onLayout: () => { if (want.current === key) scrollTo(key); else measure(key); },
  });
  const handleScroll = (y: number) => {
    setShowTop(y > 420);
    if (Date.now() - measuredAt.current > 400) { measuredAt.current = Date.now(); HALL_ORDER.forEach((k) => measure(k)); }
    let now: HallSectionKey = 'hero';
    for (const k of HALL_ORDER) {
      const sy = sectionY.current[k];
      if (sy !== undefined && y + 140 >= sy) now = k;
    }
    if (now !== current.current) { current.current = now; onSection?.(now); }
  };

  return (
    <ThemeContext.Provider value={{ c: PALETTES.light, dark: false }}>
      <View testID="hall-landing" style={{ flex: 1, backgroundColor: HOME_LOOK.paper }}>
        <ScrollView ref={scroller} style={{ flex: 1 }} scrollEventThrottle={64} onScroll={(e) => handleScroll(e.nativeEvent.contentOffset.y)} keyboardShouldPersistTaps="handled">
          <View ref={content}>
          {!home ? (
            <View style={{ maxWidth: 1120, width: '100%', alignSelf: 'center', padding: 32 }}>
              <LoadState loading={loading} error={error} onRetry={onRetry} />
            </View>
          ) : (
            <>
              <View {...hold('hero')}><HallHero onPlay={onPlay} /></View>
              <SectionCloud color={HOME_LOOK.paper} rim wide={wide} direction="up" variant={1} />
              <View {...hold('about')}><HallSteps /></View>
              <CloudPair upper={HOME_LOOK.paper} lower={HOME_LOOK.paper} wide={wide} variant={1} />
              <View {...hold('characters')}><HallCharacters rank={rank} /></View>
              <CloudPair upper={HOME_LOOK.paper} lower={HOME_LOOK.paper} wide={wide} variant={0} />
              <View {...hold('board')}><HallBoard session={session} classId={classId} className={className} /></View>
              <CloudPair upper={HOME_LOOK.paper} lower={HOME_LOOK.paper} wide={wide} variant={2} />
              <View {...hold('gallery')}><HallGallery level={rank.level} home={home} /></View>
              <SectionCloud color={HOME_LOOK.paper} rim wide={wide} variant={2} />
              <View {...hold('tutorial')}><HallTutorial onPlay={onPlay} /></View>
              <HallFooter />
            </>
          )}
          </View>
        </ScrollView>
        {showTop ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Lên đầu trang" onPress={() => scrollTo('hero')} testID="hall-back-top"
            style={({ pressed }) => ({
              position: 'absolute', right: 20, bottom: 20, width: 52, height: 52, borderRadius: 26,
              backgroundColor: L_DEN, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.28)', alignItems: 'center', justifyContent: 'center',
              opacity: pressed ? 0.8 : 1, boxShadow: '0 1px 2px rgba(14, 17, 22, 0.12), 0 8px 24px rgba(14, 17, 22, 0.18)',
            } as object)}>
            <ArrowUp size={19} color="#ffffff" strokeWidth={2} />
          </Pressable>
        ) : null}
      </View>
    </ThemeContext.Provider>
  );
};
