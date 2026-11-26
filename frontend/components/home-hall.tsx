/**
 * Các khối trang chủ lấy từ sảnh của nhánh feat/giao_dien_hs_than_thien (27/11/2026, người dùng gửi ảnh từng khối và chỗ đặt):
 *  - TrangNguyenSection: "Muốn làm Trạng nguyên?" – ba cách học (ảnh feature-*.png), đặt dưới "Chín màn chiến dịch".
 *  - TranShowcase: nền chuyển sắc xanh – tím – đỏ, hai thẻ "Bậc danh hiệu (5)" / "Nhân vật thời Trần (9)". Dưới "Nơi học sinh khám phá lịch sử"
 *    mở sẵn thẻ Bậc danh hiệu; ở "Các vị vua thời Trần" mở sẵn thẻ Nhân vật (thay lưới ảnh tượng cũ).
 *  - BoardStage: sân khấu Bảng vàng. Trang chủ chưa đăng nhập nên bảng là VÍ DỤ (biệt danh minh họa), kèm nút vào học để xem bảng thật của lớp.
 * Chữ: điều kiện danh hiệu theo luật hiện tại (Khoa bảng theo khối 6 – 9, RANK_NAMES trong backend/src/saga/saga.service.ts); tiểu sử nhân vật lấy HERO_PROFILE
 * (đã đối chiếu Wikipedia tiếng Việt). Không dùng lời giới thiệu cũ của nhánh vì có chỗ sai (Hội nghị Diên Hồng do Thượng hoàng Thánh Tông triệu tập
 * đầu năm 1285, không phải Trần Nhân Tông năm 1284) và có câu trích chưa tìm được nguồn.
 * Ảnh nặng (chibi, tranh danh hiệu, khung Bảng vàng) chỉ nạp khi khối sắp vào màn hình.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Platform, Pressable, View, useWindowDimensions, type ImageSourcePropType, type ViewInstance, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { HALL_ART, HALL_RANK_ART } from '@/components/portal/HallMedia';
import { DrumSun, StageBackdrop } from '@/components/portal/StudentArt';
import { Txt } from '@/components/ui';
import { HERO_PROFILE } from '@/constants/heroes';
import { useBob, useReduceMotion } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';

const WEB = Platform.OS === 'web';

/** Màu của sảnh nhánh giao diện học sinh thân thiện (chữ trên các nền này đã đo tương phản; vàng đồng chỉ làm nền cho chữ tối) */
const HALL = {
  ribbon: '#cca574',
  ribbonOn: '#dfb377',
  ribbonInk: '#24333c',
  gold: '#ffc75f',
  goldSoft: '#f6dc97',
  board: '#2d4048',
  plaque: 'rgba(58, 20, 13, 0.82)',
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
/** Chín nhân vật như ảnh chibi của nhánh; chữ lấy từ HERO_PROFILE (Wikipedia tiếng Việt), chỉ giữ câu trích đã có nguồn trong dữ liệu trang chủ */
const CAST: ReadonlyArray<CastMember> = [
  { key: 'tran-hung-dao', name: 'Trần Hưng Đạo', short: 'Trần Hưng Đạo', title: P.tran_hung_dao.rank, era: '? – 1300', image: HALL_ART.tranHungDao, backdrop: '#23324a', bio: P.tran_hung_dao.summary, deed: P.tran_hung_dao.deeds[1] },
  { key: 'tran-thai-tong', name: 'Vua Trần Thái Tông', short: 'Vua Trần', title: P.tran_thai_tong.rank, era: P.tran_thai_tong.years, image: HALL_ART.vuaTran, backdrop: '#5c3c12', bio: P.tran_thai_tong.summary, deed: P.tran_thai_tong.deeds[1] },
  { key: 'tran-nhan-tong', name: 'Vua Trần Nhân Tông', short: 'Trần Nhân Tông', title: P.tran_nhan_tong.rank, era: P.tran_nhan_tong.years, image: HALL_ART.tranNhanTong, backdrop: '#6b1d24', bio: P.tran_nhan_tong.summary, deed: P.tran_nhan_tong.deeds[1] },
  { key: 'tran-thu-do', name: 'Trần Thủ Độ', short: 'Trần Thủ Độ', title: P.tran_thu_do.rank, era: P.tran_thu_do.years, image: HALL_ART.tranThuDo, backdrop: '#3f1e3a', bio: P.tran_thu_do.summary, deed: P.tran_thu_do.deeds[1], quote: '“Đầu thần chưa rơi xuống đất, bệ hạ đừng lo gì khác.” (1258)' },
  { key: 'tran-quang-khai', name: 'Trần Quang Khải', short: 'Trần Quang Khải', title: P.tran_quang_khai.rank, era: P.tran_quang_khai.years, image: HALL_ART.tranQuangKhai, backdrop: '#163c42', bio: P.tran_quang_khai.summary, deed: P.tran_quang_khai.deeds[0], quote: '“Đoạt sáo Chương Dương độ, Cầm hồ Hàm Tử quan.” (Tụng giá hoàn kinh sư)' },
  { key: 'tran-khanh-du', name: 'Trần Khánh Dư', short: 'Trần Khánh Dư', title: P.tran_khanh_du.rank, era: '1240? – 1339', image: HALL_ART.tranKhanhDu, backdrop: '#263f24', bio: P.tran_khanh_du.summary, deed: P.tran_khanh_du.deeds[1] },
  { key: 'tran-nhat-duat', name: 'Trần Nhật Duật', short: 'Trần Nhật Duật', title: P.tran_nhat_duat.rank, era: P.tran_nhat_duat.years, image: HALL_ART.tranNhatDuat, backdrop: '#541b21', bio: P.tran_nhat_duat.summary, deed: P.tran_nhat_duat.deeds[1] },
  { key: 'yet-kieu', name: 'Yết Kiêu', short: 'Yết Kiêu', title: P.yet_kieu.rank, era: P.yet_kieu.years, image: HALL_ART.yetKieu, backdrop: '#1a2748', bio: P.yet_kieu.summary, deed: P.yet_kieu.deeds[0] },
  {
    key: 'quan-nguyen', name: 'Quân Mông Cổ – Nguyên', short: 'Quân Nguyên', title: 'Các đạo quân xâm lược phương Bắc', era: '1258 · 1285 · 1287 – 1288', image: HALL_ART.tuongNguyenMong, backdrop: '#4a2318',
    bio: 'Năm 1258 là quân Mông Cổ do Ngột Lương Hợp Thai chỉ huy; năm 1285 và 1287 – 1288 là quân Nguyên với các tướng Thoát Hoan, Toa Đô, Ô Mã Nhi. Cả ba lần tiến đánh Đại Việt đều phải rút về nước.',
    deed: 'Thua ở Đông Bộ Đầu (1258); Hàm Tử, Chương Dương, Tây Kết (1285); Vân Đồn và Bạch Đằng (1287 – 1288).',
  },
];

/** Hình thoi nhỏ đầu ruy-băng tên */
const Diamond: React.FC = () => (
  <View style={{ width: 22, height: 22, borderWidth: 2.5, borderColor: HALL.ribbonInk, transform: [{ rotate: '45deg' }], alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ width: 8, height: 8, backgroundColor: HALL.ribbonInk }} />
  </View>
);

/** Ruy-băng vàng đồng mang tên bậc / nhân vật */
const Ribbon: React.FC<{ title: string; sub?: string; wide: boolean; minWidth: number }> = ({ title, sub, wide, minWidth }) => (
  <View style={{
    alignSelf: 'flex-start', minWidth: wide ? minWidth : '100%', maxWidth: '100%', backgroundColor: HALL.ribbon, borderRadius: 4, paddingVertical: 12, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', gap: 14, ...(WEB ? { boxShadow: '3px 4px 12px rgba(0,0,0,0.32)' } : null),
  } as ViewStyle}>
    <Diamond />
    <View style={{ flex: 1, minWidth: 0 }}>
      <Txt f="heavy" size={wide ? 25 : 21} color={HALL.ribbonInk} accessibilityRole="header">{title}</Txt>
      {sub ? <Txt f="semibold" size={13} color="#3a2f22" style={{ lineHeight: 18 }}>{sub}</Txt> : null}
    </View>
  </View>
);

/** Thẻ nhỏ trong khay chọn: ảnh mờ bớt khi chưa chọn (chữ giữ nguyên độ đậm để dễ đọc) */
const Thumb: React.FC<{ label: string; selected: boolean; onPress: () => void; testID: string; a11y: string; children: React.ReactNode; boxStyle: ViewStyle; small: boolean }> = ({ label, selected, onPress, testID, a11y, children, boxStyle, small }) => (
  <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={a11y}
    style={({ pressed }) => ({ flex: 1, minWidth: 0, alignItems: 'center', gap: 7, transform: [{ scale: selected ? 1.04 : pressed ? 0.98 : 1 }] })}>
    <View style={[{ width: '100%', borderRadius: 12, overflow: 'hidden', borderWidth: selected ? 2.5 : 1, borderColor: selected ? '#ffffff' : 'rgba(255,255,255,0.3)', opacity: selected ? 1 : 0.66 }, boxStyle]}>
      {children}
    </View>
    <View style={{ width: '100%', minHeight: 26, paddingHorizontal: 4, paddingVertical: 5, borderRadius: 12, backgroundColor: selected ? HALL.ribbonOn : 'rgba(214, 178, 132, 0.92)', alignItems: 'center', justifyContent: 'center' }}>
      <Txt f={selected ? 'heavy' : 'bold'} size={small ? 10.5 : 11.5} color={HALL.ribbonInk} numberOfLines={2} center style={{ lineHeight: small ? 13 : 15 }}>{label}</Txt>
    </View>
    <View style={{ width: 7, height: 7, borderRadius: 4, borderWidth: 1.5, borderColor: selected ? '#ffffff' : 'rgba(255,255,255,0.65)', backgroundColor: selected ? '#ffffff' : 'transparent' }} />
  </Pressable>
);

/** Nhân vật đứng trong thẻ lớn, nhún nhẹ (đứng yên khi bật giảm chuyển động) */
const CastFigure: React.FC<{ source: ImageSourcePropType; label: string; w: number; h: number }> = ({ source, label, w, h }) => (
  <Animated.View style={useBob(true, 5)}>
    <Image source={source} style={{ width: w, height: h, marginBottom: 8 }} resizeMode="contain" accessibilityLabel={`${label} (tranh minh họa)`} />
  </Animated.View>
);

type ShowcaseMode = 'ranks' | 'heroes';

/**
 * Khu trưng bày "Bậc danh hiệu (5)" / "Nhân vật thời Trần (9)" như sảnh của nhánh: thẻ ảnh lớn bên trái, ruy-băng tên + khung mô tả + khay chọn bên phải.
 * Tự chuyển sau mỗi 6 giây khi đang trong màn hình; dừng khi người xem bấm chọn hoặc bật giảm chuyển động. `framed` = thẻ bo góc nằm trong một khối nền giấy.
 */
export const TranShowcase: React.FC<{ initial: ShowcaseMode; framed?: boolean }> = ({ initial, framed = false }) => {
  const { width } = useWindowDimensions();
  const reduce = useReduceMotion();
  const [ref, seen] = useSeen();
  const wide = width >= 940;
  const oneRow = width >= 1120;
  /** Màn hẹp: tên thẻ rút gọn để hai thẻ vừa một hàng */
  const tight = width < 480;
  const [mode, setMode] = useState<ShowcaseMode>(initial);
  const [rankIdx, setRankIdx] = useState(RANKS.length - 1);
  const [heroIdx, setHeroIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (reduce || paused || !seen) return undefined;
    const t = setInterval(() => {
      if (mode === 'ranks') setRankIdx((i) => (i + 1) % RANKS.length);
      else setHeroIdx((i) => (i + 1) % CAST.length);
    }, 6000);
    return () => clearInterval(t);
  }, [reduce, paused, mode, seen]);

  const rank = RANKS[rankIdx] ?? RANKS[0];
  const hero = CAST[heroIdx] ?? CAST[0];
  const bg = (WEB ? { backgroundImage: 'linear-gradient(125deg, #061636 0%, #3a0f44 50%, #7d0a1e 100%)' } : { backgroundColor: '#2c103b' }) as ViewStyle;
  const shadow = (WEB ? { boxShadow: '0 18px 40px rgba(0,0,0,0.46)' } : null) as ViewStyle | null;
  const panel = { backgroundColor: 'rgba(1, 1, 1, 0.52)', borderRadius: 20, padding: wide ? 22 : 16, gap: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' } as const;
  const pickMode = (m: ShowcaseMode): void => { setMode(m); setPaused(false); };

  const tabs = (
    <View accessibilityRole="tablist" style={{ alignSelf: 'center', flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 999, padding: 5, gap: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' }}>
      {([
        { id: 'ranks' as const, label: `${tight ? 'DANH HIỆU' : 'BẬC DANH HIỆU'} (${RANKS.length})`, full: `Bậc danh hiệu, ${RANKS.length} bậc` },
        { id: 'heroes' as const, label: `${tight ? 'NHÂN VẬT' : 'NHÂN VẬT THỜI TRẦN'} (${CAST.length})`, full: `Nhân vật thời Trần, ${CAST.length} nhân vật` },
      ]).map((tab) => {
        const on = mode === tab.id;
        return (
          <Pressable key={tab.id} testID={`home-showcase-tab-${tab.id}`} accessibilityRole="tab" accessibilityLabel={tab.full} accessibilityState={{ selected: on }} onPress={() => pickMode(tab.id)}
            style={({ pressed }) => ({ paddingHorizontal: wide ? 22 : 14, minHeight: 44, borderRadius: 999, justifyContent: 'center', alignItems: 'center', backgroundColor: on ? HALL.ribbon : pressed ? 'rgba(255,255,255,0.16)' : 'transparent' })}>
            <Txt f="heavy" size={wide ? 13 : 11.5} color={on ? HALL.ribbonInk : '#ffffff'} style={{ letterSpacing: 0.8 }}>{tab.label}</Txt>
          </Pressable>
        );
      })}
    </View>
  );

  const ranksView = (
    <View testID="home-showcase-ranks-view" style={{ flexDirection: wide ? 'row' : 'column', gap: wide ? 40 : 22, alignItems: wide ? 'center' : 'stretch' }}>
      <View style={[{ width: wide ? 360 : '100%', maxWidth: wide ? 380 : 300, alignSelf: 'center', aspectRatio: 682 / 1024, borderRadius: 22, overflow: 'hidden', backgroundColor: '#23182a' }, shadow]}>
        {seen ? <Image source={HALL_RANK_ART[rankIdx] ?? HALL_ART.rankHocTro} style={{ width: '100%', height: '100%' }} resizeMode="cover" accessibilityLabel={`Tranh minh họa bậc ${rank.name}`} /> : null}
      </View>
      <View style={{ flex: wide ? 1 : undefined, gap: 18, minWidth: 0 }}>
        <Ribbon title={rank.name} wide={wide} minWidth={290} />
        <View style={panel}>
          <Txt size={15.5} color="#ffffff" style={{ lineHeight: 26 }}>{rank.note}</Txt>
          <Txt size={14.5} color={HALL.goldSoft} style={{ lineHeight: 22 }}>
            <Txt f="heavy" size={14.5} color={HALL.gold}>Điều kiện trong trò chơi: </Txt>{rank.need}
          </Txt>
        </View>
        <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: 20, padding: wide ? 16 : 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', flexDirection: 'row', gap: wide ? 12 : 6, alignItems: 'flex-start' }}>
          {RANKS.map((rk, i) => (
            <Thumb key={rk.key} testID={`home-rank-${rk.key}`} label={rk.name} selected={i === rankIdx} small={!wide} a11y={`Xem bậc ${rk.name}`}
              onPress={() => { setRankIdx(i); setPaused(true); }} boxStyle={{ aspectRatio: 1, backgroundColor: '#2c1f2e' }}>
              {seen ? <Image source={HALL_RANK_ART[i] ?? HALL_ART.rankHocTro} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : null}
            </Thumb>
          ))}
        </View>
      </View>
    </View>
  );

  const heroCard = (ch: CastMember, i: number) => (
    <Thumb key={ch.key} testID={`home-cast-${ch.key}`} label={ch.short} selected={i === heroIdx} small={!oneRow} a11y={`Xem nhân vật ${ch.name}`}
      onPress={() => { setHeroIdx(i); setPaused(true); }} boxStyle={{ height: oneRow ? 86 : 82, backgroundColor: ch.backdrop, alignItems: 'center', justifyContent: 'flex-end' }}>
      {seen ? <Image source={ch.image} style={{ width: 66, height: 80 }} resizeMode="contain" /> : null}
    </Thumb>
  );

  const heroesView = (
    <View testID="home-showcase-heroes-view" style={{ gap: 24 }}>
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: wide ? 34 : 20, alignItems: wide ? 'center' : 'stretch' }}>
        <View style={[{ width: wide ? 340 : '100%', maxWidth: 400, alignSelf: 'center', height: wide ? 370 : 320, borderRadius: 20, overflow: 'hidden', backgroundColor: hero.backdrop, borderWidth: 3, borderColor: 'rgba(227, 178, 68, 0.72)', alignItems: 'center', justifyContent: 'flex-end' }, shadow]}>
          <DrumSun size={280} color="#ffffff" opacity={0.14} style={{ position: 'absolute', top: -60, right: -60 }} />
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 68, backgroundColor: 'rgba(0,0,0,0.28)' }} />
          <View style={{ position: 'absolute', top: 14, left: 14, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, backgroundColor: 'rgba(5,22,43,0.78)', borderWidth: 1, borderColor: 'rgba(255,199,95,0.45)' }}>
            <Txt f="bold" size={12} color={HALL.gold}>{hero.era}</Txt>
          </View>
          {seen ? <CastFigure source={hero.image} label={hero.name} w={wide ? 250 : 205} h={wide ? 330 : 280} /> : null}
        </View>
        <View style={{ flex: wide ? 1 : undefined, gap: 16, minWidth: 0 }}>
          <Ribbon title={hero.name} sub={hero.title} wide={wide} minWidth={340} />
          <View style={[panel, { gap: 12 }]}>
            <Txt size={15.5} color="#ffffff" style={{ lineHeight: 26 }}>{hero.bio}</Txt>
            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.14)' }} />
            <Txt size={14.5} color={HALL.goldSoft} style={{ lineHeight: 23 }}>
              <Txt f="heavy" size={14.5} color={HALL.gold}>Chiến công nổi bật: </Txt>{hero.deed}
            </Txt>
            {hero.quote ? <Txt f="serifItalic" size={15.5} color="#e2e8f0" style={{ lineHeight: 24 }}>{hero.quote}</Txt> : null}
          </View>
        </View>
      </View>
      <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.18)', borderRadius: 18, padding: oneRow ? 14 : 12, gap: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' }}>
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
    <View ref={ref} testID={`home-showcase-${initial}`} style={[
      { width: '100%', overflow: 'hidden', paddingHorizontal: framed ? (wide ? 32 : 14) : (wide ? 36 : 16) },
      framed ? { borderRadius: 28, paddingTop: wide ? 40 : 26, paddingBottom: wide ? 44 : 28 } : { paddingTop: wide ? 118 : 86, paddingBottom: wide ? 64 : 44 },
      bg,
    ]}>
      <View style={{ maxWidth: 1180, width: '100%', alignSelf: 'center', gap: 26 }}>
        {tabs}
        {mode === 'ranks' ? ranksView : heroesView}
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------- 3. Sân khấu Bảng vàng (ví dụ)
type Period = 'week' | 'month' | 'all';
const PERIOD_TEXT: Record<Period, string> = { week: 'tuần này', month: 'tháng này', all: 'từ trước tới nay' };
/** Biệt danh minh họa (không phải học sinh thật); bảng thật chỉ hiện sau khi đăng nhập, theo lớp hoặc trường của em */
const SAMPLE: Record<Period, ReadonlyArray<[string, number]>> = {
  week: [['Sóng Bạch Đằng', 1240], ['Cờ Lau Vạn Thắng', 1185], ['Hịch Tướng Sĩ', 1120], ['Cọc Gỗ Lim', 1045], ['Thuyền Rồng', 980], ['Lá Cờ Sát Thát', 930], ['Rồng Con', 875], ['Mũi Tên Đỏ', 820], ['Trống Đồng', 760], ['Hoa Sen Vàng', 705]],
  month: [['Hịch Tướng Sĩ', 4630], ['Sóng Bạch Đằng', 4410], ['Lá Cờ Sát Thát', 4120], ['Cờ Lau Vạn Thắng', 3980], ['Rồng Con', 3655], ['Cọc Gỗ Lim', 3420], ['Trống Đồng', 3190], ['Thuyền Rồng', 2975], ['Hoa Sen Vàng', 2730], ['Mũi Tên Đỏ', 2560]],
  all: [['Lá Cờ Sát Thát', 15840], ['Hịch Tướng Sĩ', 15210], ['Sóng Bạch Đằng', 14630], ['Rồng Con', 13870], ['Cờ Lau Vạn Thắng', 13120], ['Trống Đồng', 12405], ['Cọc Gỗ Lim', 11950], ['Hoa Sen Vàng', 11280], ['Thuyền Rồng', 10640], ['Mũi Tên Đỏ', 9915]],
};
const TOP_BADGE = ['#f54545', '#ff8547', '#ffac38'];
const num = (n: number): string => n.toLocaleString('vi-VN');

/**
 * Sân khấu Bảng vàng như sảnh của nhánh (rèm đỏ, đèn lồng, khung gỗ khung-bang-vang.png có Vua Trần và Trần Hưng Đạo). Trang chủ chưa có phiên đăng nhập
 * nên không gọi API xếp hạng (không lộ tên học sinh): bảng là ví dụ ghi rõ, ba nút Tuần / Tháng / Từ đầu đổi dữ liệu ví dụ, nút cuối mở trang đăng nhập.
 */
export const BoardStage: React.FC<{ wide: boolean }> = ({ wide }) => {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [ref, seen] = useSeen();
  const [period, setPeriod] = useState<Period>('week');
  const wideFrame = width >= 860;
  const compact = width < 640;
  const rows = SAMPLE[period];
  // Khung gỗ (ảnh 1024 × 445): phần giấy giữa khung nằm trong 18,2 % – 81,8 % bề ngang, 21,5 % – 84,8 % chiều cao.
  // Máy tính: cả 10 dòng nằm trong khung. Màn hẹp: khung theo đúng tỉ lệ, các dòng đầu nằm trong khung, phần còn lại xếp ngay dưới.
  const frameW = wideFrame ? Math.min(width - 48, 1140) : Math.min(width - (compact ? 28 : 48), 760);
  const frameH = wideFrame ? Math.max(460, frameW * (445 / 1024)) : frameW * (445 / 1024);
  const paperH = frameH * (1 - 0.215 - 0.152);
  const inside = wideFrame ? rows.length : Math.max(3, Math.min(rows.length, Math.floor(paperH / 30)));
  const insideH = Math.max(26, Math.floor(paperH / inside));

  const row = ([name, xp]: [string, number], i: number, h: number) => {
    const top = i < 3 ? TOP_BADGE[i] : null;
    const small = h < 34;
    return (
      <View key={name} accessible accessibilityLabel={`Hạng ${i + 1}: ${name}, ${num(xp)} điểm`}
        style={{ height: h, flexDirection: 'row', alignItems: 'center', gap: small ? 9 : 12, paddingHorizontal: small ? 10 : 14, borderTopWidth: i ? 1 : 0, borderTopColor: 'rgba(255,255,255,0.16)' }}>
        <View style={{ width: small ? 22 : 24, height: small ? 22 : 24, borderRadius: 12, backgroundColor: top ?? '#8eb9f5', alignItems: 'center', justifyContent: 'center' }}>
          <Txt f="heavy" size={small ? 11 : 12} color="#2a0f05">{i + 1}</Txt>
        </View>
        <Txt f={top ? 'heavy' : 'semibold'} size={small ? 13 : 15} color="#ffffff" numberOfLines={1} style={{ flex: 1 }}>{name}</Txt>
        <Txt f="heavy" size={small ? 13 : 15} color={HALL.gold}>{num(xp)} điểm</Txt>
      </View>
    );
  };
  const pill = (p: Period, label: string) => {
    const on = period === p;
    return (
      <Pressable key={p} testID={`home-board-${p}`} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`Ví dụ bảng ${PERIOD_TEXT[p]}`} onPress={() => setPeriod(p)}
        style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 18, borderRadius: 22, justifyContent: 'center', backgroundColor: on ? HALL.gold : pressed ? 'rgba(36,16,10,0.82)' : 'rgba(36,16,10,0.66)', borderWidth: 2, borderBottomWidth: on ? 4 : 2, borderColor: on ? '#b98a1e' : 'rgba(255,226,168,0.55)' })}>
        <Txt f="heavy" size={13} color={on ? '#3a1a08' : '#ffffff'}>{label}</Txt>
      </Pressable>
    );
  };

  return (
    <View ref={ref} testID="home-board-stage" style={{ width: '100%', overflow: 'hidden', backgroundColor: '#d9532e' }}>
      <StageBackdrop style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
      <View style={{ maxWidth: 1240, width: '100%', alignSelf: 'center', paddingHorizontal: compact ? 14 : 24, paddingTop: compact ? 64 : 76, paddingBottom: wide ? 132 : 100, gap: 18 }}>
        {/* Tên bảng trên biển gỗ sẫm để chữ vàng đủ tương phản trên tường cam */}
        <View style={{ alignSelf: 'center', alignItems: 'center', gap: 6, backgroundColor: HALL.plaque, borderRadius: 18, paddingHorizontal: compact ? 22 : 36, paddingVertical: 12, borderWidth: 1.5, borderColor: 'rgba(255,199,95,0.55)' }}>
          <Txt f="heavy" size={compact ? 26 : 34} color={HALL.gold} center accessibilityRole="header" style={{ letterSpacing: 5 }}>BẢNG VÀNG</Txt>
          <View style={{ width: compact ? 150 : 220, height: 3, borderRadius: 2, backgroundColor: HALL.gold }} />
          <Txt f="semibold" size={14} color="#fff3dc" center>Ví dụ minh họa · {PERIOD_TEXT[period]}</Txt>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
          {pill('week', 'Tuần')}{pill('month', 'Tháng')}{pill('all', 'Từ đầu')}
        </View>
        <View testID="home-board-list" style={{ gap: 12 }}>
          <View style={{ width: frameW, height: frameH, alignSelf: 'center' }}>
            {seen ? <Image source={HALL_ART.boardFrame} style={{ width: '100%', height: '100%' }} resizeMode="stretch" accessibilityLabel="Khung Bảng vàng có Vua Trần và Trần Hưng Đạo" /> : null}
            <View pointerEvents="none" style={{ position: 'absolute', left: '31%', right: '31%', top: '5.5%', height: '13%', alignItems: 'center', justifyContent: 'center' }}>
              <Txt f="heavy" size={wideFrame ? 17 : 10} color={HALL.gold} style={{ letterSpacing: wideFrame ? 2.5 : 1 }} numberOfLines={1}>TOP 10 GHI DANH</Txt>
            </View>
            <View style={{ position: 'absolute', left: '18.2%', right: '18.2%', top: '21.5%', bottom: '15.2%', backgroundColor: HALL.board, borderRadius: wideFrame ? 10 : 6, borderWidth: 2, borderColor: '#5c3c1e', overflow: 'hidden', justifyContent: 'center' }}>
              {rows.slice(0, inside).map((r, i) => row(r, i, insideH))}
            </View>
          </View>
          {inside < rows.length ? (
            <View style={{ backgroundColor: HALL.board, borderRadius: 16, borderWidth: 4, borderColor: '#c9a16b', overflow: 'hidden' }}>
              {rows.slice(inside).map((r, k) => row(r, inside + k, 44))}
            </View>
          ) : null}
        </View>
        <View style={{ alignItems: 'center', gap: 10 }}>
          <View style={{ backgroundColor: HALL.plaque, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, maxWidth: 640 }}>
            <Txt size={13.5} color="#fff3dc" center style={{ lineHeight: 20 }}>Biệt danh trong bảng là ví dụ. Đăng nhập để xem Bảng vàng thật của lớp em – bảng toàn trường chỉ hiện biệt danh.</Txt>
          </View>
          <Pressable testID="home-board-join" accessibilityRole="link" accessibilityLabel="Vào học để ghi danh lên Bảng vàng" onPress={() => router.push('/portal')}
            style={({ pressed }) => ({ minHeight: 48, paddingHorizontal: 22, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: pressed ? '#f9e07a' : HALL.gold, borderWidth: 2, borderBottomWidth: 4, borderColor: '#b98a1e' })}>
            <Txt f="heavy" size={15} color="#3a1a08">Vào học để ghi danh</Txt>
            <ArrowRight size={18} color="#3a1a08" strokeWidth={2.4} />
          </Pressable>
        </View>
      </View>
    </View>
  );
};
