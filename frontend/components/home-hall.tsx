/**
 * Các khối trang chủ lấy từ sảnh của nhánh feat/giao_dien_hs_than_thien (27/11/2026, người dùng gửi ảnh từng khối và chỗ đặt):
 *  - TrangNguyenSection: "Muốn làm Trạng nguyên?" – ba cách học (ảnh feature-*.png), đặt dưới "Chín màn chiến dịch".
 *  - TranShowcase: hai thẻ "Bậc danh hiệu (5)" / "Nhân vật thời Trần (9)" dưới "Nơi học sinh khám phá lịch sử" (mục "Danh tướng" của thanh điều hướng
 *    cuộn tới đây và mở thẻ Nhân vật – openShowcaseTab). Khối "Các vị vua thời Trần" cũ đã xóa theo yêu cầu.
 *  - BoardStage: sân khấu Bảng vàng có rèm khép / mở. Trang chủ chưa đăng nhập nên bảng là VÍ DỤ (biệt danh minh họa), kèm nút vào học.
 *  - GallerySection: "THƯ VIỆN – Sống động & sáng tạo", 10 tranh tự đổi chỗ, đặt sau "Lời ông cha còn vang mãi".
 * Màu (yêu cầu "tông màu giống logo"): xanh mực, đỏ cờ, vàng mặt trời, giấy kem của logo (LOGO dưới đây = logoInk / logoRed / logoGold / logoPaper
 * trong constants/theme.ts và các sắc đậm nhạt của chúng). Chữ: điều kiện danh hiệu theo luật hiện tại (Khoa bảng theo khối 6 – 9, RANK_NAMES trong
 * backend/src/saga/saga.service.ts); tiểu sử nhân vật lấy HERO_PROFILE (đã đối chiếu Wikipedia tiếng Việt), không dùng lời giới thiệu cũ của nhánh
 * (Hội nghị Diên Hồng do Thượng hoàng Thánh Tông triệu tập đầu năm 1285, không phải Trần Nhân Tông năm 1284; vài câu trích chưa tìm được nguồn).
 * Hiệu ứng: nhân vật / bậc vừa chọn hiện ra (mờ → rõ, nổi lên), hoa văn trống đồng xoay chậm, quầng sáng và đốm sao lấp lánh; rèm Bảng vàng mở khi khối
 * vào màn hình, khép rồi mở lại khi đổi Tuần / Tháng / Từ đầu; đèn lồng đung đưa. Tất cả đứng yên khi bật giảm chuyển động, vòng lặp dừng khi khối ra khỏi màn hình.
 * Ảnh nặng (chibi, tranh danh hiệu, khung Bảng vàng) chỉ nạp khi khối sắp vào màn hình.
 */
import React, { useEffect, useId, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, Pressable, StyleSheet, View, useWindowDimensions, type ImageSourcePropType, type ViewInstance, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { useOnScreen } from '@/components/motion';
import { HALL_ART, HALL_RANK_ART } from '@/components/portal/HallMedia';
import { DrumSun } from '@/components/portal/StudentArt';
import { Txt } from '@/components/ui';
import { HERO_PROFILE } from '@/constants/heroes';
import { useBob, useReduceMotion } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';

const WEB = Platform.OS === 'web';
const NATIVE = !WEB;

/** Tông màu của logo Đông A: xanh mực (đồi, sóng), đỏ cờ, vàng mặt trời, giấy kem – chữ trên các nền này đã đo tương phản */
const LOGO = {
  ink: '#23382f', inkDeep: '#152620', inkSoft: '#2f4a3f',
  red: '#b53520', redDeep: '#7a2414', redSoft: '#cf5033',
  gold: '#dfb66f', goldLight: '#f1dcae', goldDeep: '#a8823f',
  paper: '#faf4e7',
};

/** Chỉ nạp ảnh khi khối sắp vào màn hình (web, sớm 600 px); ứng dụng gốc hoặc trình duyệt thiếu IntersectionObserver thì nạp ngay */
function useSeen(): [React.RefObject<ViewInstance | null>, boolean] {
  const ref = useRef<ViewInstance>(null);
  const [seen, setSeen] = useState(!WEB);
  useEffect(() => {
    if (seen) return undefined;
    const el = ref.current as unknown as Element | null;
    if (!el || typeof IntersectionObserver === 'undefined') { setSeen(true); return undefined; }
    const io = new IntersectionObserver((list) => { if (list.some((e) => e.isIntersecting)) { setSeen(true); io.disconnect(); } }, { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen];
}

/** Giá trị 0 → 1 mỗi lần `key` đổi (nhân vật / bậc vừa chọn hiện ra); lần hiển thị đầu và khi bật giảm chuyển động thì hiện ngay */
function useEnter(key: string): Animated.Value {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return undefined; }
    if (reduce) { v.setValue(1); return undefined; }
    v.setValue(0);
    const a = Animated.timing(v, { toValue: 1, duration: 560, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE });
    a.start();
    return () => a.stop();
  }, [key, reduce, v]);
  return v;
}

/** Vòng lặp 0 → 1 đều đặn (xoay, nhấp nháy, đung đưa), chỉ chạy khi `live` */
function useCycle(live: boolean, ms: number): Animated.Value {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!live) { v.stopAnimation(); return undefined; }
    const a = Animated.loop(Animated.timing(v, { toValue: 1, duration: ms, easing: Easing.linear, useNativeDriver: NATIVE }));
    a.start();
    return () => a.stop();
  }, [live, ms, v]);
  return v;
}

// ---------------------------------------------------------------------- 1. Muốn làm Trạng nguyên?
const FEATURES: ReadonlyArray<{ image: ImageSourcePropType; title: string; text: string }> = [
  { image: HALL_ART.featureGame, title: 'HỌC QUA TRÒ CHƠI', text: 'Vượt các chặng của chiến dịch Khối 6 – 9, mở hòm báu, tích sao để thăng bậc Khoa bảng từ Học trò tới Trạng nguyên.' },
  { image: HALL_ART.featureMap, title: 'NHẬP VAI & BẢN ĐỒ', text: 'Trải nghiệm thế giới 3D, nhận quân lệnh, dàn trận cọc Bạch Đằng và đối chiếu trên bản đồ lịch sử.' },
  { image: HALL_ART.featureAi, title: 'ÔN TẬP & TRỢ LÝ AI', text: 'Chấm điểm tức thì, luyện lại câu hay sai, thi đấu cùng lớp và hỏi đáp sử liệu cùng Tiểu Tướng mọi lúc.' },
];

export const TrangNguyenSection: React.FC<{ wide: boolean }> = ({ wide }) => {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 640;
  const [ref, seen] = useSeen();
  const big = compact ? 25 : 35;
  return (
    <View ref={ref} testID="home-trang-nguyen" style={{ width: '100%', backgroundColor: c.logoPaper, paddingTop: wide ? 72 : 48, paddingBottom: wide ? 104 : 76, paddingHorizontal: 16 }}>
      <View style={{ maxWidth: 1120, width: '100%', alignSelf: 'center', alignItems: 'center', gap: 18 }}>
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Txt f="heavy" size={big} color="#24292f" center accessibilityRole="header" style={{ letterSpacing: 0.8, lineHeight: compact ? 34 : 44 }}>
            MUỐN LÀM <Txt f="heavy" size={big} color="#c9482f">{'“ TRẠNG NGUYÊN ”'}</Txt>{' ?'}
          </Txt>
          <Txt f="serifItalic" size={17} color="#57606a" center>“ Học hết mình, chinh phục sử Trần ”</Txt>
          <View style={{ width: 48, height: 3.5, borderRadius: 2, backgroundColor: '#1890ff', marginTop: 4 }} />
        </View>
        <Txt size={compact ? 16 : 19} color="#333b44" center style={{ maxWidth: 820, lineHeight: compact ? 25 : 30 }}>
          <Txt f="heavy" size={compact ? 16 : 19} color="#b5402c">HÀO KHÍ ĐÔNG A</Txt> giúp mỗi giờ học Lịch sử trở nên sống động và đáng nhớ thông qua hành trình ba lần kháng chiến chống quân Mông – Nguyên thời Trần.
        </Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: compact ? 20 : 32, marginTop: 18, width: '100%' }}>
          {FEATURES.map(({ image, title, text }) => (
            <View key={title} style={{ flexGrow: 1, flexBasis: 260, maxWidth: 340, alignItems: 'center', gap: 12, paddingHorizontal: 10 }}>
              <View style={{ width: 148, height: 118 }}>
                {seen ? <Image source={image} style={{ width: 148, height: 118 }} resizeMode="contain" accessibilityLabel={`Minh họa ${title.toLowerCase()}`} /> : null}
              </View>
              <Txt f="heavy" size={18} color="#00727c" center style={{ letterSpacing: 0.6 }}>{title}</Txt>
              <Txt size={14} color="#4b5563" center style={{ lineHeight: 22 }}>{text}</Txt>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------- 2. Bậc danh hiệu (5) & Nhân vật thời Trần (9)
/** Năm bậc Khoa bảng theo luật hiện tại; dữ kiện khoa cử theo Wikipedia tiếng Việt (Thái học sinh 1232; Tam khôi 1247) */
const RANKS: ReadonlyArray<{ key: string; name: string; need: string; note: string }> = [
  { key: 'hoc-tro', name: 'Học trò', need: 'Bắt đầu hành trình', note: 'Người theo đèn sách, chuẩn bị lều chõng đi thi. Mọi bạn bắt đầu hành trình từ đây.' },
  { key: 'thai-hoc-sinh', name: 'Thái học sinh', need: 'Hoàn thành chiến dịch Khối 6', note: 'Học vị thời Trần cấp cho người đỗ kỳ thi Hội, có từ khoa thi Nhâm Thìn (1232) đời Trần Thái Tông.' },
  { key: 'tham-hoa', name: 'Thám hoa', need: 'Hoàn thành chiến dịch Khối 7', note: 'Người đỗ thứ ba trong Tam khôi. Tam khôi được đặt lần đầu năm 1247 thời Trần; Thám hoa khoa thi ấy là Đặng Ma La.' },
  { key: 'bang-nhan', name: 'Bảng nhãn', need: 'Hoàn thành chiến dịch Khối 8', note: 'Người đỗ thứ hai trong Tam khôi. Bảng nhãn khoa 1247 là Lê Văn Hưu – người về sau soạn bộ Đại Việt sử ký, hoàn thành năm 1272.' },
  { key: 'trang-nguyen', name: 'Trạng nguyên', need: 'Hoàn thành chiến dịch Khối 9 và đạt đủ sao ở cả bốn khối', note: 'Người đỗ đầu trong Tam khôi. Trạng nguyên khoa 1247 là Nguyễn Hiền, được coi là trạng nguyên trẻ nhất lịch sử khoa cử Việt Nam (các nguồn chép 12 hoặc 13 tuổi).' },
];

interface CastMember { key: string; name: string; short: string; title: string; era: string; image: ImageSourcePropType; backdrop: string; bio: string; deed: string; quote?: string }
const P = HERO_PROFILE;
/** Chín nhân vật như ảnh chibi của nhánh; chữ lấy từ HERO_PROFILE (Wikipedia tiếng Việt), chỉ giữ câu trích đã có nguồn trong dữ liệu trang chủ; nền thẻ theo tông logo */
const CAST: ReadonlyArray<CastMember> = [
  { key: 'tran-hung-dao', name: 'Trần Hưng Đạo', short: 'Trần Hưng Đạo', title: P.tran_hung_dao.rank, era: '? – 1300', image: HALL_ART.tranHungDao, backdrop: '#2c4438', bio: P.tran_hung_dao.summary, deed: P.tran_hung_dao.deeds[1] },
  { key: 'tran-thai-tong', name: 'Vua Trần Thái Tông', short: 'Vua Trần', title: P.tran_thai_tong.rank, era: P.tran_thai_tong.years, image: HALL_ART.vuaTran, backdrop: '#5a4220', bio: P.tran_thai_tong.summary, deed: P.tran_thai_tong.deeds[1] },
  { key: 'tran-nhan-tong', name: 'Vua Trần Nhân Tông', short: 'Trần Nhân Tông', title: P.tran_nhan_tong.rank, era: P.tran_nhan_tong.years, image: HALL_ART.tranNhanTong, backdrop: '#6a2418', bio: P.tran_nhan_tong.summary, deed: P.tran_nhan_tong.deeds[1] },
  { key: 'tran-thu-do', name: 'Trần Thủ Độ', short: 'Trần Thủ Độ', title: P.tran_thu_do.rank, era: P.tran_thu_do.years, image: HALL_ART.tranThuDo, backdrop: '#3d3426', bio: P.tran_thu_do.summary, deed: P.tran_thu_do.deeds[1], quote: '“Đầu thần chưa rơi xuống đất, bệ hạ đừng lo gì khác.” (1258)' },
  { key: 'tran-quang-khai', name: 'Trần Quang Khải', short: 'Trần Quang Khải', title: P.tran_quang_khai.rank, era: P.tran_quang_khai.years, image: HALL_ART.tranQuangKhai, backdrop: '#244036', bio: P.tran_quang_khai.summary, deed: P.tran_quang_khai.deeds[0], quote: '“Đoạt sáo Chương Dương độ, Cầm hồ Hàm Tử quan.” (Tụng giá hoàn kinh sư)' },
  { key: 'tran-khanh-du', name: 'Trần Khánh Dư', short: 'Trần Khánh Dư', title: P.tran_khanh_du.rank, era: '1240? – 1339', image: HALL_ART.tranKhanhDu, backdrop: '#2f4a3f', bio: P.tran_khanh_du.summary, deed: P.tran_khanh_du.deeds[1] },
  { key: 'tran-nhat-duat', name: 'Trần Nhật Duật', short: 'Trần Nhật Duật', title: P.tran_nhat_duat.rank, era: P.tran_nhat_duat.years, image: HALL_ART.tranNhatDuat, backdrop: '#5e2416', bio: P.tran_nhat_duat.summary, deed: P.tran_nhat_duat.deeds[1] },
  { key: 'yet-kieu', name: 'Yết Kiêu', short: 'Yết Kiêu', title: P.yet_kieu.rank, era: P.yet_kieu.years, image: HALL_ART.yetKieu, backdrop: '#1f3a37', bio: P.yet_kieu.summary, deed: P.yet_kieu.deeds[0] },
  {
    key: 'quan-nguyen', name: 'Quân Mông Cổ – Nguyên', short: 'Quân Nguyên', title: 'Các đạo quân xâm lược phương Bắc', era: '1258 · 1285 · 1287 – 1288', image: HALL_ART.tuongNguyenMong, backdrop: '#4a2a1c',
    bio: 'Năm 1258 là quân Mông Cổ do Ngột Lương Hợp Thai chỉ huy; năm 1285 và 1287 – 1288 là quân Nguyên với các tướng Thoát Hoan, Toa Đô, Ô Mã Nhi. Cả ba lần tiến đánh Đại Việt đều phải rút về nước.',
    deed: 'Thua ở Đông Bộ Đầu (1258); Hàm Tử, Chương Dương, Tây Kết (1285); Vân Đồn và Bạch Đằng (1287 – 1288).',
  },
];

type ShowcaseMode = 'ranks' | 'heroes';
const tabListeners = new Set<(mode: ShowcaseMode) => void>();
/** Thanh điều hướng / chân trang gọi trước khi cuộn tới "danh-tuong": mở sẵn thẻ cần xem (Danh tướng → Nhân vật thời Trần) */
export function openShowcaseTab(mode: ShowcaseMode): void {
  tabListeners.forEach((fn) => fn(mode));
}

/** Hình thoi nhỏ đầu ruy-băng tên */
const Diamond: React.FC = () => (
  <View style={{ width: 22, height: 22, borderWidth: 2.5, borderColor: LOGO.ink, transform: [{ rotate: '45deg' }], alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ width: 8, height: 8, backgroundColor: LOGO.ink }} />
  </View>
);

/** Ruy-băng vàng mặt trời mang tên bậc / nhân vật */
const Ribbon: React.FC<{ title: string; sub?: string; wide: boolean; minWidth: number }> = ({ title, sub, wide, minWidth }) => (
  <View style={{
    alignSelf: 'flex-start', minWidth: wide ? minWidth : '100%', maxWidth: '100%', backgroundColor: LOGO.gold, borderRadius: 4, paddingVertical: 12, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', gap: 14, borderLeftWidth: 6, borderLeftColor: LOGO.red, ...(WEB ? { boxShadow: '3px 4px 12px rgba(0,0,0,0.32)' } : null),
  } as ViewStyle}>
    <Diamond />
    <View style={{ flex: 1, minWidth: 0 }}>
      <Txt f="heavy" size={wide ? 25 : 21} color={LOGO.ink} accessibilityRole="header">{title}</Txt>
      {sub ? <Txt f="semibold" size={13} color="#3a2f22" style={{ lineHeight: 18 }}>{sub}</Txt> : null}
    </View>
  </View>
);

/** Thẻ nhỏ trong khay chọn: ảnh mờ bớt khi chưa chọn (chữ giữ nguyên độ đậm để dễ đọc) */
const Thumb: React.FC<{ label: string; selected: boolean; onPress: () => void; testID: string; a11y: string; children: React.ReactNode; boxStyle: ViewStyle; small: boolean }> = ({ label, selected, onPress, testID, a11y, children, boxStyle, small }) => (
  <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={a11y}
    style={({ pressed }) => ({ flex: 1, minWidth: 0, alignItems: 'center', gap: 7, transform: [{ scale: selected ? 1.04 : pressed ? 0.98 : 1 }] })}>
    <View style={[{ width: '100%', borderRadius: 12, overflow: 'hidden', borderWidth: selected ? 2.5 : 1, borderColor: selected ? LOGO.gold : 'rgba(250,244,231,0.3)', opacity: selected ? 1 : 0.66 }, boxStyle]}>
      {children}
    </View>
    <View style={{ width: '100%', minHeight: 26, paddingHorizontal: 4, paddingVertical: 5, borderRadius: 12, backgroundColor: selected ? LOGO.gold : 'rgba(241, 220, 174, 0.9)', alignItems: 'center', justifyContent: 'center' }}>
      <Txt f={selected ? 'heavy' : 'bold'} size={small ? 10.5 : 11.5} color={LOGO.ink} numberOfLines={2} center style={{ lineHeight: small ? 13 : 15 }}>{label}</Txt>
    </View>
    <View style={{ width: 7, height: 7, borderRadius: 4, borderWidth: 1.5, borderColor: selected ? LOGO.gold : 'rgba(250,244,231,0.65)', backgroundColor: selected ? LOGO.gold : 'transparent' }} />
  </Pressable>
);

/** Nhân vật đứng trong thẻ lớn, nhún nhẹ (đứng yên khi bật giảm chuyển động) */
const CastFigure: React.FC<{ source: ImageSourcePropType; label: string; w: number; h: number }> = ({ source, label, w, h }) => (
  <Animated.View style={useBob(true, 5)}>
    <Image source={source} style={{ width: w, height: h, marginBottom: 8 }} resizeMode="contain" accessibilityLabel={`${label} (tranh minh họa)`} />
  </Animated.View>
);

/** Đốm sao bốn cánh lấp lánh quanh nhân vật */
const Sparkle: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <Svg width={size} height={size} viewBox="0 0 18 18">
    <Path d="M9 0 L10.8 7.2 L18 9 L10.8 10.8 L9 18 L7.2 10.8 L0 9 L7.2 7.2 Z" fill={color} />
  </Svg>
);

/**
 * Khu trưng bày "Bậc danh hiệu (5)" / "Nhân vật thời Trần (9)" như sảnh của nhánh nhưng theo tông logo: nền xanh mực có quầng mặt trời vàng, ruy-băng vàng
 * viền đỏ cờ, khay chọn kem. Tự chuyển sau mỗi 6 giây khi đang trong màn hình; dừng khi người xem bấm chọn hoặc bật giảm chuyển động.
 */
export const TranShowcase: React.FC<{ initial: ShowcaseMode }> = ({ initial }) => {
  const { width } = useWindowDimensions();
  const reduce = useReduceMotion();
  const [ref, seen] = useSeen();
  const [screenRef, onScreen] = useOnScreen();
  const wide = width >= 940;
  const oneRow = width >= 1120;
  /** Màn hẹp: tên thẻ rút gọn để hai thẻ vừa một hàng */
  const tight = width < 480;
  const [mode, setMode] = useState<ShowcaseMode>(initial);
  const [rankIdx, setRankIdx] = useState(RANKS.length - 1);
  const [heroIdx, setHeroIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const fn = (m: ShowcaseMode): void => { setMode(m); setPaused(false); };
    tabListeners.add(fn);
    return () => { tabListeners.delete(fn); };
  }, []);
  const live = seen && onScreen && !reduce;
  useEffect(() => {
    if (!live || paused) return undefined;
    const t = setInterval(() => {
      if (mode === 'ranks') setRankIdx((i) => (i + 1) % RANKS.length);
      else setHeroIdx((i) => (i + 1) % CAST.length);
    }, 6000);
    return () => clearInterval(t);
  }, [live, paused, mode]);
  const spin = useCycle(live && mode === 'heroes', 60000);
  const twinkle = useCycle(live, 2800);
  const enterHero = useEnter(`${mode}-${heroIdx}`);
  const enterRank = useEnter(`${mode}-${rankIdx}`);

  const rank = RANKS[rankIdx] ?? RANKS[0];
  const hero = CAST[heroIdx] ?? CAST[0];
  const bg = (WEB
    ? { backgroundImage: 'radial-gradient(circle at 86% 14%, rgba(223,182,111,0.30) 0%, rgba(223,182,111,0) 30%), linear-gradient(160deg, #152620 0%, #23382f 55%, #3b2d1f 82%, #7a2414 100%)' }
    : { backgroundColor: LOGO.ink }) as ViewStyle;
  const shadow = (WEB ? { boxShadow: '0 18px 40px rgba(0,0,0,0.46)' } : null) as ViewStyle | null;
  const panel = { backgroundColor: 'rgba(12, 22, 18, 0.58)', borderRadius: 20, padding: wide ? 22 : 16, gap: 10, borderWidth: 1, borderColor: 'rgba(223,182,111,0.28)' } as const;
  const pickMode = (m: ShowcaseMode): void => { setMode(m); setPaused(false); };
  /** Phần hiện ra khi đổi: mờ → rõ và trượt nhẹ */
  const rise = (v: Animated.Value, dy: number, from = 0.25) => ({ opacity: v.interpolate({ inputRange: [0, 1], outputRange: [from, 1] }), transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [dy, 0] }) }] });
  const glow = (WEB
    ? { backgroundImage: 'radial-gradient(circle, rgba(241,220,174,0.55) 0%, rgba(241,220,174,0.18) 42%, rgba(241,220,174,0) 68%)' }
    : { backgroundColor: 'rgba(241,220,174,0.18)' }) as ViewStyle;

  const tabs = (
    <View accessibilityRole="tablist" style={{ alignSelf: 'center', flexDirection: 'row', backgroundColor: 'rgba(250,244,231,0.1)', borderRadius: 999, padding: 5, gap: 6, borderWidth: 1, borderColor: 'rgba(223,182,111,0.4)' }}>
      {([
        { id: 'ranks' as const, label: `${tight ? 'DANH HIỆU' : 'BẬC DANH HIỆU'} (${RANKS.length})`, full: `Bậc danh hiệu, ${RANKS.length} bậc` },
        { id: 'heroes' as const, label: `${tight ? 'NHÂN VẬT' : 'NHÂN VẬT THỜI TRẦN'} (${CAST.length})`, full: `Nhân vật thời Trần, ${CAST.length} nhân vật` },
      ]).map((tab) => {
        const on = mode === tab.id;
        return (
          <Pressable key={tab.id} testID={`home-showcase-tab-${tab.id}`} accessibilityRole="tab" accessibilityLabel={tab.full} accessibilityState={{ selected: on }} onPress={() => pickMode(tab.id)}
            style={({ pressed }) => ({ paddingHorizontal: wide ? 22 : 14, minHeight: 44, borderRadius: 999, justifyContent: 'center', alignItems: 'center', backgroundColor: on ? LOGO.gold : pressed ? 'rgba(250,244,231,0.16)' : 'transparent' })}>
            <Txt f="heavy" size={wide ? 13 : 11.5} color={on ? LOGO.ink : LOGO.paper} style={{ letterSpacing: 0.8 }}>{tab.label}</Txt>
          </Pressable>
        );
      })}
    </View>
  );

  const ranksView = (
    <View testID="home-showcase-ranks-view" style={{ flexDirection: wide ? 'row' : 'column', gap: wide ? 40 : 22, alignItems: wide ? 'center' : 'stretch' }}>
      <View style={[{ width: wide ? 360 : '100%', maxWidth: wide ? 380 : 300, alignSelf: 'center', aspectRatio: 682 / 1024, borderRadius: 22, overflow: 'hidden', backgroundColor: LOGO.inkDeep, borderWidth: 3, borderColor: LOGO.gold }, shadow]}>
        {seen ? (
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: enterRank.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }), transform: [{ scale: enterRank.interpolate({ inputRange: [0, 1], outputRange: [1.05, 1] }) }] }]}>
            <Image source={HALL_RANK_ART[rankIdx] ?? HALL_ART.rankHocTro} style={{ width: '100%', height: '100%' }} resizeMode="cover" accessibilityLabel={`Tranh minh họa bậc ${rank.name}`} />
          </Animated.View>
        ) : null}
      </View>
      <Animated.View style={[{ flex: wide ? 1 : undefined, gap: 18, minWidth: 0 }, rise(enterRank, 10, 0.4)]}>
        <Ribbon title={rank.name} wide={wide} minWidth={290} />
        <View style={panel}>
          <Txt size={15.5} color={LOGO.paper} style={{ lineHeight: 26 }}>{rank.note}</Txt>
          <Txt size={14.5} color={LOGO.goldLight} style={{ lineHeight: 22 }}>
            <Txt f="heavy" size={14.5} color={LOGO.gold}>Điều kiện trong trò chơi: </Txt>{rank.need}
          </Txt>
        </View>
        <View style={{ backgroundColor: 'rgba(250,244,231,0.1)', borderRadius: 20, padding: wide ? 16 : 10, borderWidth: 1, borderColor: 'rgba(223,182,111,0.3)', flexDirection: 'row', gap: wide ? 12 : 6, alignItems: 'flex-start' }}>
          {RANKS.map((rk, i) => (
            <Thumb key={rk.key} testID={`home-rank-${rk.key}`} label={rk.name} selected={i === rankIdx} small={!wide} a11y={`Xem bậc ${rk.name}`}
              onPress={() => { setRankIdx(i); setPaused(true); }} boxStyle={{ aspectRatio: 1, backgroundColor: LOGO.inkDeep }}>
              {seen ? <Image source={HALL_RANK_ART[i] ?? HALL_ART.rankHocTro} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : null}
            </Thumb>
          ))}
        </View>
      </Animated.View>
    </View>
  );

  const heroCard = (ch: CastMember, i: number) => (
    <Thumb key={ch.key} testID={`home-cast-${ch.key}`} label={ch.short} selected={i === heroIdx} small={!oneRow} a11y={`Xem nhân vật ${ch.name}`}
      onPress={() => { setHeroIdx(i); setPaused(true); }} boxStyle={{ height: oneRow ? 86 : 82, backgroundColor: ch.backdrop, alignItems: 'center', justifyContent: 'flex-end' }}>
      {seen ? <Image source={ch.image} style={{ width: 66, height: 80 }} resizeMode="contain" /> : null}
    </Thumb>
  );

  const cardH = wide ? 370 : 320;
  const heroesView = (
    <View testID="home-showcase-heroes-view" style={{ gap: 24 }}>
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: wide ? 34 : 20, alignItems: wide ? 'center' : 'stretch' }}>
        <View testID="home-cast-stage" style={[{ width: wide ? 340 : '100%', maxWidth: 400, alignSelf: 'center', height: cardH, borderRadius: 20, overflow: 'hidden', backgroundColor: hero.backdrop, borderWidth: 3, borderColor: LOGO.gold, alignItems: 'center', justifyContent: 'flex-end' }, shadow]}>
          {/* hoa văn trống đồng xoay chậm, quầng sáng thở nhẹ sau lưng nhân vật */}
          <Animated.View pointerEvents="none" style={{ position: 'absolute', top: -60, right: -60, transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
            <DrumSun size={280} color={LOGO.goldLight} opacity={0.16} />
          </Animated.View>
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', alignSelf: 'center', bottom: 24, width: 290, height: 290, borderRadius: 145 }, glow, { opacity: twinkle.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 1, 0.5] }) }]} />
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 64, backgroundColor: 'rgba(0,0,0,0.28)' }} />
          <View style={{ position: 'absolute', top: 14, left: 14, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, backgroundColor: 'rgba(21,38,32,0.86)', borderWidth: 1, borderColor: 'rgba(223,182,111,0.6)' }}>
            <Txt f="bold" size={12} color={LOGO.gold}>{hero.era}</Txt>
          </View>
          {[
            { style: { left: '16%', top: '30%' }, size: 16, range: [0.15, 1, 0.15] },
            { style: { right: '15%', top: '42%' }, size: 12, range: [1, 0.15, 1] },
            { style: { left: '24%', bottom: '24%' }, size: 10, range: [0.5, 0.9, 0.2] },
          ].map((s, k) => (
            <Animated.View key={k} pointerEvents="none" style={[{ position: 'absolute' }, s.style as ViewStyle, { opacity: reduce ? 0.6 : twinkle.interpolate({ inputRange: [0, 0.5, 1], outputRange: s.range }) }]}>
              <Sparkle size={s.size} color={LOGO.goldLight} />
            </Animated.View>
          ))}
          {seen ? (
            <Animated.View style={{ opacity: enterHero, transform: [{ translateY: enterHero.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) }, { scale: enterHero.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }] }}>
              <CastFigure source={hero.image} label={hero.name} w={wide ? 250 : 205} h={wide ? 330 : 280} />
            </Animated.View>
          ) : null}
        </View>
        <Animated.View style={[{ flex: wide ? 1 : undefined, gap: 16, minWidth: 0 }, rise(enterHero, 12, 0.35)]}>
          <Ribbon title={hero.name} sub={hero.title} wide={wide} minWidth={340} />
          <View style={[panel, { gap: 12 }]}>
            <Txt size={15.5} color={LOGO.paper} style={{ lineHeight: 26 }}>{hero.bio}</Txt>
            <View style={{ height: 1, backgroundColor: 'rgba(223,182,111,0.25)' }} />
            <Txt size={14.5} color={LOGO.goldLight} style={{ lineHeight: 23 }}>
              <Txt f="heavy" size={14.5} color={LOGO.gold}>Chiến công nổi bật: </Txt>{hero.deed}
            </Txt>
            {hero.quote ? <Txt f="serifItalic" size={15.5} color="#eef1e8" style={{ lineHeight: 24 }}>{hero.quote}</Txt> : null}
          </View>
        </Animated.View>
      </View>
      <View style={{ backgroundColor: 'rgba(250,244,231,0.1)', borderRadius: 18, padding: oneRow ? 14 : 12, gap: 12, borderWidth: 1, borderColor: 'rgba(223,182,111,0.3)' }}>
        {oneRow ? (
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>{CAST.map(heroCard)}</View>
        ) : (
          <View style={{ gap: 12, maxWidth: 460, width: '100%', alignSelf: 'center' }}>
            {[0, 3, 6].map((start) => (
              <View key={start} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                {CAST.slice(start, start + 3).map((ch, k) => heroCard(ch, start + k))}
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );

  return (
    <View ref={ref} testID="home-showcase" style={[{ width: '100%', overflow: 'hidden', paddingHorizontal: wide ? 36 : 16, paddingTop: wide ? 118 : 86, paddingBottom: wide ? 64 : 44 }, bg]}>
      <View ref={screenRef} style={{ maxWidth: 1180, width: '100%', alignSelf: 'center', gap: 26 }}>
        {tabs}
        {mode === 'ranks' ? ranksView : heroesView}
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------- 3. Sân khấu Bảng vàng (ví dụ) có rèm khép / mở
type Period = 'week' | 'month' | 'all';
const PERIOD_TEXT: Record<Period, string> = { week: 'tuần này', month: 'tháng này', all: 'từ trước tới nay' };
/** Biệt danh minh họa (không phải học sinh thật); bảng thật chỉ hiện sau khi đăng nhập, theo lớp hoặc trường của em */
const SAMPLE: Record<Period, ReadonlyArray<[string, number]>> = {
  week: [['Sóng Bạch Đằng', 1240], ['Cờ Lau Vạn Thắng', 1185], ['Hịch Tướng Sĩ', 1120], ['Cọc Gỗ Lim', 1045], ['Thuyền Rồng', 980], ['Lá Cờ Sát Thát', 930], ['Rồng Con', 875], ['Mũi Tên Đỏ', 820], ['Trống Đồng', 760], ['Hoa Sen Vàng', 705]],
  month: [['Hịch Tướng Sĩ', 4630], ['Sóng Bạch Đằng', 4410], ['Lá Cờ Sát Thát', 4120], ['Cờ Lau Vạn Thắng', 3980], ['Rồng Con', 3655], ['Cọc Gỗ Lim', 3420], ['Trống Đồng', 3190], ['Thuyền Rồng', 2975], ['Hoa Sen Vàng', 2730], ['Mũi Tên Đỏ', 2560]],
  all: [['Lá Cờ Sát Thát', 15840], ['Hịch Tướng Sĩ', 15210], ['Sóng Bạch Đằng', 14630], ['Rồng Con', 13870], ['Cờ Lau Vạn Thắng', 13120], ['Trống Đồng', 12405], ['Cọc Gỗ Lim', 11950], ['Hoa Sen Vàng', 11280], ['Thuyền Rồng', 10640], ['Mũi Tên Đỏ', 9915]],
};
/** Ba hạng đầu: vàng, bạc giấy, đồng (theo tông logo); các hạng sau xanh lá nhạt – chữ số màu mực */
const TOP_BADGE = [LOGO.gold, '#e3dccb', '#c98d52'];
const num = (n: number): string => n.toLocaleString('vi-VN');

/** Tường sân khấu xanh mực, đốm vàng và quầng đèn rọi giữa sân khấu */
const StageWall: React.FC = () => {
  const id = useId().replace(/:/g, '');
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox="0 0 1200 600" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={`w${id}`} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={LOGO.inkDeep} /><Stop offset="1" stopColor={LOGO.ink} /></LinearGradient>
          <RadialGradient id={`l${id}`} cx="50%" cy="22%" r="62%"><Stop offset="0" stopColor={LOGO.goldLight} stopOpacity="0.3" /><Stop offset="1" stopColor={LOGO.goldLight} stopOpacity="0" /></RadialGradient>
        </Defs>
        <Rect width={1200} height={600} fill={`url(#w${id})`} />
        <Rect width={1200} height={600} fill={`url(#l${id})`} />
        {Array.from({ length: 48 }, (_, i) => <Circle key={i} cx={(i * 97) % 1200} cy={((i * 53) % 500) + 60} r={1.6} fill={LOGO.gold} opacity={0.32} />)}
      </Svg>
    </View>
  );
};

/** Một tấm rèm đỏ cờ có nếp gấp và tua vàng ở chân, co giãn theo bề ngang (nếp dồn lại khi mở); viền vàng ở mép gặp nhau là dải 4 px không giãn theo rèm */
const CurtainCloth: React.FC<{ edge: 'left' | 'right' }> = ({ edge }) => {
  const id = useId().replace(/:/g, '');
  return (
    <View style={{ flex: 1 }}>
    <Svg width="100%" height="100%" viewBox="0 0 120 600" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id={`f${id}`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#6a1f12" />
          <Stop offset="0.3" stopColor={LOGO.red} />
          <Stop offset="0.55" stopColor={LOGO.redSoft} />
          <Stop offset="0.8" stopColor="#962a18" />
          <Stop offset="1" stopColor="#6a1f12" />
        </LinearGradient>
      </Defs>
      {Array.from({ length: 6 }, (_, i) => <Rect key={i} x={i * 20} y={0} width={20.5} height={600} fill={`url(#f${id})`} />)}
      <Rect x={0} y={584} width={120} height={16} fill={LOGO.gold} />
      {Array.from({ length: 12 }, (_, i) => <Path key={i} d={`M${i * 10} 584 L${i * 10 + 5} 596 L${i * 10 + 10} 584 Z`} fill={LOGO.goldDeep} />)}
    </Svg>
    <View style={{ position: 'absolute', top: 0, bottom: 0, width: 4, backgroundColor: LOGO.gold, opacity: 0.9, ...(edge === 'left' ? { right: 0 } : { left: 0 }) }} />
    </View>
  );
};

/** Diềm sân khấu: dải đỏ cờ có vòm lượn và viền vàng */
const Valance: React.FC = () => (
  <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 52 }}>
    <Svg width="100%" height="100%" viewBox="0 0 1200 52" preserveAspectRatio="none">
      <Rect width={1200} height={26} fill={LOGO.redDeep} />
      <Path d={Array.from({ length: 24 }, (_, i) => `M${i * 50} 26 Q${i * 50 + 25} 52 ${i * 50 + 50} 26`).join(' ')} fill={LOGO.red} />
      <Rect y={24} width={1200} height={4} fill={LOGO.gold} />
    </Svg>
  </View>
);

/** Đèn lồng vàng tua đỏ treo dưới diềm, đung đưa nhẹ */
const Lantern: React.FC<{ swing: Animated.Value; x: `${number}%`; drop: number; phase: number }> = ({ swing, x, drop, phase }) => (
  <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 20, left: x, width: 40, marginLeft: -20, height: drop + 70, alignItems: 'center',
    transform: [{ rotate: swing.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: phase ? ['3deg', '0deg', '-3deg', '0deg', '3deg'] : ['-3deg', '0deg', '3deg', '0deg', '-3deg'] }) }] }}>
    <Svg width={40} height={drop + 70} viewBox={`0 0 40 ${drop + 70}`}>
      <Path d={`M20 0 V${drop}`} stroke="#3b2a1c" strokeWidth={2} />
      <Rect x={13} y={drop} width={14} height={5} rx={1.5} fill={LOGO.goldDeep} />
      <Ellipse cx={20} cy={drop + 24} rx={17} ry={20} fill={LOGO.gold} />
      <Path d={`M9 ${drop + 12} Q4 ${drop + 24} 9 ${drop + 36} M31 ${drop + 12} Q36 ${drop + 24} 31 ${drop + 36} M20 ${drop + 4} V${drop + 44}`} stroke={LOGO.goldDeep} strokeWidth={1.4} fill="none" />
      <Rect x={10} y={drop + 22} width={20} height={4} fill={LOGO.red} opacity={0.85} />
      <Rect x={13} y={drop + 43} width={14} height={5} rx={1.5} fill={LOGO.goldDeep} />
      <Path d={`M20 ${drop + 48} V${drop + 68}`} stroke={LOGO.red} strokeWidth={4} />
    </Svg>
  </Animated.View>
);

/**
 * Sân khấu Bảng vàng theo tông logo: tường xanh mực, diềm và rèm đỏ cờ viền vàng, đèn lồng vàng, khung gỗ khung-bang-vang.png có Vua Trần và Trần Hưng Đạo.
 * Rèm khép sẵn, mở ra khi sân khấu vào màn hình; bấm Tuần / Tháng / Từ đầu thì rèm khép lại rồi mở ra bảng mới. Trang chủ chưa có phiên đăng nhập nên không gọi
 * API xếp hạng (không lộ tên học sinh): bảng là ví dụ ghi rõ, nút cuối mở trang đăng nhập.
 */
export const BoardStage: React.FC<{ wide: boolean }> = ({ wide }) => {
  const router = useRouter();
  const reduce = useReduceMotion();
  const { width } = useWindowDimensions();
  const [ref, seen] = useSeen();
  const [screenRef, onScreen] = useOnScreen();
  const stageRef = useRef<ViewInstance>(null);
  const [period, setPeriod] = useState<Period>('week');
  const [shown, setShown] = useState<Period>('week');
  const [stageW, setStageW] = useState(width);
  const open = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  const opened = useRef(reduce);
  const swing = useCycle(seen && onScreen && !reduce, 3600);
  const wideFrame = width >= 860;
  const compact = width < 640;

  // Rèm mở khi sân khấu hiện ít nhất 35 % (không có IntersectionObserver hoặc bật giảm chuyển động thì mở sẵn)
  useEffect(() => {
    if (reduce) { open.setValue(1); opened.current = true; return undefined; }
    const el = stageRef.current as unknown as Element | null;
    const reveal = (): void => {
      opened.current = true;
      Animated.timing(open, { toValue: 1, duration: 1500, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    };
    if (!WEB || !el || typeof IntersectionObserver === 'undefined') { reveal(); return undefined; }
    const io = new IntersectionObserver((list) => { if (list.some((e) => e.isIntersecting)) { io.disconnect(); reveal(); } }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, [reduce, open]);

  /** Đổi Tuần / Tháng / Từ đầu: khép màn, thay bảng, mở màn */
  const pick = (p: Period): void => {
    if (p === period) return;
    setPeriod(p);
    if (reduce || !opened.current) { setShown(p); return; }
    open.stopAnimation();
    Animated.timing(open, { toValue: 0, duration: 450, easing: Easing.inOut(Easing.quad), useNativeDriver: false }).start(({ finished }) => {
      if (!finished) return;
      setShown(p);
      Animated.timing(open, { toValue: 1, duration: 950, delay: 150, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    });
  };

  const rows = SAMPLE[shown];
  // Khung gỗ (ảnh 1024 × 445): phần giấy giữa khung nằm trong 18,2 % – 81,8 % bề ngang, 21,5 % – 84,8 % chiều cao.
  // Máy tính: cả 10 dòng nằm trong khung. Màn hẹp: khung theo đúng tỉ lệ, các dòng đầu nằm trong khung, phần còn lại xếp ngay dưới.
  const frameW = wideFrame ? Math.min(width - 48, 1140) : Math.min(width - (compact ? 28 : 48), 760);
  const frameH = wideFrame ? Math.max(460, frameW * (445 / 1024)) : frameW * (445 / 1024);
  const paperH = frameH * (1 - 0.215 - 0.152);
  const inside = wideFrame ? rows.length : Math.max(3, Math.min(rows.length, Math.floor(paperH / 30)));
  const insideH = Math.max(26, Math.floor(paperH / inside));
  // Rèm: khép = mỗi tấm che nửa sân khấu; mở = dồn về hai bên thành vạt rèm, không che khung bảng
  const half = stageW / 2 + 4;
  const drape = Math.max(12, Math.min(120, (stageW - frameW) / 2 - 6));
  const curtainW = open.interpolate({ inputRange: [0, 1], outputRange: [half, drape] });

  const row = ([name, xp]: [string, number], i: number, h: number) => {
    const top = i < 3 ? TOP_BADGE[i] : null;
    const small = h < 34;
    return (
      <View key={name} accessible accessibilityLabel={`Hạng ${i + 1}: ${name}, ${num(xp)} điểm`}
        style={{ height: h, flexDirection: 'row', alignItems: 'center', gap: small ? 9 : 12, paddingHorizontal: small ? 10 : 14, borderTopWidth: i ? 1 : 0, borderTopColor: 'rgba(223,182,111,0.18)' }}>
        <View style={{ width: small ? 22 : 24, height: small ? 22 : 24, borderRadius: 12, backgroundColor: top ?? '#9fb3a6', alignItems: 'center', justifyContent: 'center' }}>
          <Txt f="heavy" size={small ? 11 : 12} color={LOGO.ink}>{i + 1}</Txt>
        </View>
        <Txt f={top ? 'heavy' : 'semibold'} size={small ? 13 : 15} color={LOGO.paper} numberOfLines={1} style={{ flex: 1 }}>{name}</Txt>
        <Txt f="heavy" size={small ? 13 : 15} color={LOGO.gold}>{num(xp)} điểm</Txt>
      </View>
    );
  };
  const pill = (p: Period, label: string) => {
    const on = period === p;
    return (
      <Pressable key={p} testID={`home-board-${p}`} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`Ví dụ bảng ${PERIOD_TEXT[p]}`} onPress={() => pick(p)}
        style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 18, borderRadius: 22, justifyContent: 'center', backgroundColor: on ? LOGO.gold : pressed ? 'rgba(250,244,231,0.18)' : 'rgba(250,244,231,0.08)', borderWidth: 2, borderBottomWidth: on ? 4 : 2, borderColor: on ? LOGO.goldDeep : 'rgba(223,182,111,0.5)' })}>
        <Txt f="heavy" size={13} color={on ? LOGO.ink : LOGO.paper}>{label}</Txt>
      </Pressable>
    );
  };

  return (
    <View ref={ref} testID="home-board-stage" style={{ width: '100%', overflow: 'hidden', backgroundColor: LOGO.inkDeep }}>
      <View style={{ alignItems: 'center', gap: 14, paddingTop: compact ? 52 : 64, paddingBottom: 20, paddingHorizontal: 14 }}>
        <View style={{ alignItems: 'center', gap: 6, backgroundColor: LOGO.ink, borderRadius: 18, paddingHorizontal: compact ? 22 : 36, paddingVertical: 12, borderWidth: 1.5, borderColor: LOGO.gold }}>
          <Txt f="heavy" size={compact ? 26 : 34} color={LOGO.gold} center accessibilityRole="header" style={{ letterSpacing: 5 }}>BẢNG VÀNG</Txt>
          <View style={{ width: compact ? 150 : 220, height: 3, borderRadius: 2, backgroundColor: LOGO.red }} />
          <Txt f="semibold" size={14} color={LOGO.paper} center>Ví dụ minh họa · {PERIOD_TEXT[period]}</Txt>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
          {pill('week', 'Tuần')}{pill('month', 'Tháng')}{pill('all', 'Từ đầu')}
        </View>
      </View>

      {/* Sân khấu: tường, khung bảng, rèm (khép / mở), diềm, đèn lồng, mép sàn */}
      <View ref={stageRef} testID="home-board-curtains" onLayout={(e) => setStageW(e.nativeEvent.layout.width)} style={{ width: '100%', overflow: 'hidden', paddingTop: 64, paddingBottom: 56 }}>
        <StageWall />
        {/* mốc đo "đang trong màn hình" để đèn lồng chỉ đung đưa khi sân khấu hiện */}
        <View ref={screenRef} pointerEvents="none" style={StyleSheet.absoluteFill} />
        <Animated.View testID="home-board-list" style={{ gap: 12, paddingHorizontal: compact ? 14 : 24, opacity: open.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }), transform: [{ scale: open.interpolate({ inputRange: [0, 1], outputRange: [0.965, 1] }) }] }}>
          <View style={{ width: frameW, height: frameH, alignSelf: 'center' }}>
            {seen ? <Image source={HALL_ART.boardFrame} style={{ width: '100%', height: '100%' }} resizeMode="stretch" accessibilityLabel="Khung Bảng vàng có Vua Trần và Trần Hưng Đạo" /> : null}
            <View pointerEvents="none" style={{ position: 'absolute', left: '31%', right: '31%', top: '5.5%', height: '13%', alignItems: 'center', justifyContent: 'center' }}>
              <Txt f="heavy" size={wideFrame ? 17 : 10} color={LOGO.goldLight} style={{ letterSpacing: wideFrame ? 2.5 : 1 }} numberOfLines={1}>TOP 10 GHI DANH</Txt>
            </View>
            <View style={{ position: 'absolute', left: '18.2%', right: '18.2%', top: '21.5%', bottom: '15.2%', backgroundColor: LOGO.inkDeep, borderRadius: wideFrame ? 10 : 6, borderWidth: 2, borderColor: '#5c3c1e', overflow: 'hidden', justifyContent: 'center' }}>
              {rows.slice(0, inside).map((r, i) => row(r, i, insideH))}
            </View>
          </View>
          {inside < rows.length ? (
            <View style={{ backgroundColor: LOGO.inkDeep, borderRadius: 16, borderWidth: 4, borderColor: LOGO.gold, overflow: 'hidden', alignSelf: 'center', width: frameW }}>
              {rows.slice(inside).map((r, k) => row(r, inside + k, 44))}
            </View>
          ) : null}
        </Animated.View>
        <Animated.View pointerEvents="none" testID="home-board-curtain-left" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', left: 0, top: 24, bottom: 40, width: curtainW }}>
          <CurtainCloth edge="left" />
        </Animated.View>
        <Animated.View pointerEvents="none" testID="home-board-curtain-right" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', right: 0, top: 24, bottom: 40, width: curtainW }}>
          <CurtainCloth edge="right" />
        </Animated.View>
        <Valance />
        {wideFrame ? (
          <>
            <Lantern swing={swing} x="4%" drop={26} phase={0} />
            <Lantern swing={swing} x="96%" drop={26} phase={1} />
          </>
        ) : null}
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 44, backgroundColor: '#3b2a1c', borderTopWidth: 3, borderTopColor: LOGO.gold }} />
      </View>

      <View style={{ alignItems: 'center', gap: 12, paddingTop: 22, paddingBottom: wide ? 132 : 100, paddingHorizontal: 14 }}>
        <View style={{ backgroundColor: 'rgba(250,244,231,0.08)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, maxWidth: 640, borderWidth: 1, borderColor: 'rgba(223,182,111,0.3)' }}>
          <Txt size={13.5} color={LOGO.paper} center style={{ lineHeight: 20 }}>Biệt danh trong bảng là ví dụ. Đăng nhập để xem Bảng vàng thật của lớp em – bảng toàn trường chỉ hiện biệt danh.</Txt>
        </View>
        <Pressable testID="home-board-join" accessibilityRole="link" accessibilityLabel="Vào học để ghi danh lên Bảng vàng" onPress={() => router.push('/portal')}
          style={({ pressed }) => ({ minHeight: 48, paddingHorizontal: 22, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: pressed ? LOGO.redDeep : LOGO.red, borderWidth: 2, borderBottomWidth: 4, borderColor: LOGO.gold })}>
          <Txt f="heavy" size={15} color={LOGO.paper}>Vào học để ghi danh</Txt>
          <ArrowRight size={18} color={LOGO.paper} strokeWidth={2.4} />
        </Pressable>
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------- 4. Thư viện tranh (ảnh 15 người dùng gửi lại: đặt sau "Lời ông cha còn vang mãi")
/** Mười tranh của bộ minh họa (bản đồ là tranh vẽ lại, không theo tỉ lệ); tranh nền trong suốt đặt trên nền màu riêng */
const PICTURES: ReadonlyArray<{ key: string; title: string; src: ImageSourcePropType; bg?: string }> = [
  { key: 'bach-dang-plan', title: 'Các tướng nhà Trần bàn kế trận Bạch Đằng (tranh minh họa)', src: HALL_ART.bachDangPlan },
  { key: 'citadel', title: 'Hoàng thành Thăng Long (tranh minh họa)', src: HALL_ART.citadel, bg: '#bfe8f7' },
  { key: 'board-frame', title: 'Khung Bảng vàng có Vua Trần và Trần Hưng Đạo', src: HALL_ART.boardFrame, bg: '#fbe7c6' },
  { key: 'scene-river', title: 'Quân nhà Trần ra quân giữ sông nước (tranh minh họa)', src: HALL_ART.sceneRiver },
  { key: 'scene-march', title: 'Quân nhà Trần hành quân qua núi non (tranh minh họa)', src: HALL_ART.sceneMarch },
  { key: 'map-1', title: 'Tranh bản đồ kháng chiến lần thứ nhất, 1258', src: HALL_ART.map1 },
  { key: 'map-2', title: 'Tranh bản đồ kháng chiến lần thứ hai, 1285', src: HALL_ART.map2 },
  { key: 'map-3', title: 'Tranh bản đồ kháng chiến lần thứ ba, 1287 – 1288', src: HALL_ART.map3 },
  { key: 'scene-fleet', title: 'Thủy quân nhà Trần (tranh minh họa)', src: HALL_ART.sceneFleet },
  { key: 'scene-bach-dang', title: 'Trận Bạch Đằng năm 1288 (tranh minh họa)', src: HALL_ART.sceneBachDang },
];

/** Xáo vị trí các tranh, bảo đảm mỗi lượt đều có tranh đổi chỗ */
const shuffleSlots = (prev: number[]): number[] => {
  const next = [...prev];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  if (next.every((v, k) => v === prev[k]) && next.length > 1) next.push(next.shift()!);
  return next;
};

/**
 * "THƯ VIỆN – Sống động & sáng tạo" như sảnh của nhánh: tiêu đề bên trái, lưới 10 tranh 5 × 2 bên phải (điện thoại: tiêu đề trên, lưới 2 cột).
 * Tranh tự trượt đổi chỗ mỗi 3,2 giây; dừng khi rê chuột lên lưới, khi khối ra khỏi màn hình hoặc bật giảm chuyển động. Chỉ để xem, không mở chi tiết.
 */
export const GallerySection: React.FC<{ wide: boolean }> = ({ wide }) => {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const reduce = useReduceMotion();
  const [ref, seen] = useSeen();
  const [screenRef, onScreen] = useOnScreen();
  const gridRef = useRef<ViewInstance>(null);
  const [hover, setHover] = useState(false);
  const [gridW, setGridW] = useState(0);
  const [slots, setSlots] = useState<number[]>(() => PICTURES.map((_, i) => i));
  const row = width >= 960;
  const cols = row ? 5 : 2;
  const live = seen && onScreen && !reduce && !hover;
  useEffect(() => {
    if (!live) return undefined;
    const t = setInterval(() => setSlots(shuffleSlots), 3200);
    return () => clearInterval(t);
  }, [live]);
  // rê chuột lên lưới thì dừng xáo để xem kỹ một tranh (web)
  useEffect(() => {
    const el = gridRef.current as unknown as HTMLElement | null;
    if (!WEB || !el?.addEventListener) return undefined;
    const enter = (): void => setHover(true);
    const leave = (): void => setHover(false);
    el.addEventListener('mouseenter', enter);
    el.addEventListener('mouseleave', leave);
    return () => { el.removeEventListener('mouseenter', enter); el.removeEventListener('mouseleave', leave); };
  }, []);

  const gap = row ? 14 : 10;
  const usableW = gridW > 0 ? gridW : Math.max(260, Math.min(width - (row ? 278 : 32), 1046));
  const cardW = (usableW - gap * (cols - 1)) / cols;
  const cardH = Math.round(cardW / 1.62);
  const rows = Math.ceil(PICTURES.length / cols);
  const totalH = rows * cardH + Math.max(0, rows - 1) * gap;

  return (
    <View ref={ref} testID="home-gallery" style={{ width: '100%', backgroundColor: c.logoPaper, paddingTop: row ? 92 : 64, paddingBottom: row ? 92 : 64, paddingHorizontal: row ? 32 : 16 }}>
      <View ref={screenRef} style={{ maxWidth: 1260, width: '100%', alignSelf: 'center', flexDirection: row ? 'row' : 'column', gap: row ? 24 : 18, alignItems: row ? 'center' : 'stretch' }}>
        <View style={{ width: row ? 184 : '100%', alignItems: 'center', gap: 8 }}>
          <Txt f="heavy" size={wide ? 30 : 25} color="#24292f" center accessibilityRole="header" style={{ letterSpacing: 1 }}>THƯ VIỆN</Txt>
          <Txt size={14} color="#57606a" center>Sống động & sáng tạo</Txt>
          <View style={{ width: 42, height: 3, borderRadius: 2, backgroundColor: '#1890ff', marginVertical: 2 }} />
        </View>
        <View ref={gridRef} testID="home-gallery-grid"
          onLayout={(e) => { const w = Math.round(e.nativeEvent.layout.width); if (w > 0 && Math.abs(w - gridW) > 1) setGridW(w); }}
          style={{ flex: row ? 1 : undefined, width: row ? undefined : '100%', height: totalH }}>
          {PICTURES.map((p, i) => {
            const slot = slots[i] ?? i;
            const x = (slot % cols) * (cardW + gap);
            const y = Math.floor(slot / cols) * (cardH + gap);
            const pos = (WEB
              ? { position: 'absolute', left: 0, top: 0, width: cardW, height: cardH, transform: [{ translateX: x }, { translateY: y }],
                transitionProperty: 'transform', transitionDuration: reduce || gridW === 0 ? '0ms' : '950ms', transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)' }
              : { position: 'absolute', left: x, top: y, width: cardW, height: cardH }) as ViewStyle;
            return (
              <View key={p.key} style={pos}>
                <View testID={`home-gallery-${p.key}`} accessible accessibilityRole="image" accessibilityLabel={p.title}
                  style={{ width: '100%', height: '100%', borderRadius: 8, overflow: 'hidden', backgroundColor: p.bg ?? '#1c1815', alignItems: 'center', justifyContent: 'center', padding: p.bg ? 6 : 0, ...(WEB ? { boxShadow: '0 6px 16px rgba(15,23,42,0.12)' } : null) } as ViewStyle}>
                  {seen ? <Image source={p.src} style={{ width: '100%', height: '100%' }} resizeMode={p.bg ? 'contain' : 'cover'} /> : null}
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
};
