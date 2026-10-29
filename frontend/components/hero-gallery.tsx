/**
 * Thư viện danh tướng: ảnh tượng, phù điêu và tư liệu có nguồn. Lưới và khung chi tiết
 * hiển thị ngay, không trượt/hiện dần/nhấc thẻ; khung chi tiết không dính khi cuộn.
 * Điện thoại: lưới hai cột, khung mở ngay dưới hàng vừa bấm.
 * Màu theo bảng màu logo như các khối phía trên (nền giấy kem, chữ mực xanh, đỏ cờ làm điểm nhấn). Dữ liệu: HEROES (tên, danh hiệu, nhãn nguồn) và HERO_PROFILE (sơ yếu lý lịch theo Wikipedia) trong constants/heroes.ts.
 */
import React, { useState } from 'react';
import { Pressable, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowUpRight } from 'lucide-react-native';
import { LoreChip } from '@/components/game/quiz';
import { HeroPhoto, HeroPhotoCredit } from '@/components/hero-photo';
import { Txt } from '@/components/ui';
import { TIER_INFO } from '@/constants/game';
import { HEROES, HERO_PROFILE } from '@/constants/heroes';
import { useTheme } from '@/hooks/use-theme';
import type { HeroDef } from '@/types/game';

const MAX_W = 1120;
const DEFAULT_ID = 'tran_hung_dao';
const INK_SOFT = 'rgba(35, 56, 47, 0.78)';
const INK_LINE = 'rgba(35, 56, 47, 0.16)';

const rows = <T,>(list: T[], n: number) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));

export const HeroGallery: React.FC<{ wide: boolean }> = ({ wide }) => {
  const { width } = useWindowDimensions();
  const [sel, setSel] = useState<string | null>(wide ? DEFAULT_ID : null);
  const current = sel ?? (wide ? DEFAULT_ID : null);
  const inner = Math.min(width, MAX_W) - 32;
  const panelW = inner >= 900 ? 440 : 360;
  const gridW = wide ? inner - panelW - 28 : inner;
  const cols = wide ? Math.max(2, Math.floor((gridW + 12) / (138 + 12))) : 2;
  const tileW = Math.floor((gridW - (cols - 1) * 12) / cols);
  const hero = HEROES.find((h) => h.id === current) ?? null;

  const tile = (h: HeroDef) => (
    <View key={h.id} style={{ width: tileW }}>
      <Tile hero={h} w={tileW} active={h.id === current} onPress={() => setSel(!wide && h.id === current ? null : h.id)} />
    </View>
  );

  if (!wide) {
    return (
      <View style={{ gap: 12 }}>
        {rows(HEROES, cols).map((row, r) => (
          <View key={r} style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>{row.map(tile)}</View>
            {hero && row.some((h) => h.id === hero.id) && <Detail hero={hero} wide={false} />}
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 28 }}>
      <View style={{ width: gridW, flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{HEROES.map(tile)}</View>
      <View style={{ width: panelW }}>{hero && <Detail hero={hero} wide />}</View>
    </View>
  );
};

/** Thẻ ảnh tư liệu cố định; thẻ đang chọn có viền đỏ theo logo. */
const Tile: React.FC<{ hero: HeroDef; w: number; active: boolean; onPress: () => void }> = ({ hero, w, active, onPress }) => {
  const { c } = useTheme();
  const art = Math.min(150, w - 24);
  const h = Math.round(art * 1.2) + 74;
  return (
    <View style={{ width: w, height: h }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${hero.name}, ${hero.title}`}
        accessibilityState={{ selected: active }}
        aria-pressed={active}
        testID={`hero-tile-${hero.id}`}
        style={({ pressed }) => ({
          width: w, height: h, alignItems: 'center', paddingTop: 12, paddingBottom: 12, paddingHorizontal: 8, borderRadius: 26, borderWidth: 1.5,
          borderColor: active ? c.logoRed : INK_LINE,
          backgroundColor: active ? 'rgba(181, 53, 32, 0.08)' : 'rgba(255, 255, 255, 0.7)',
          opacity: pressed ? 0.9 : 1,
        })}
      >
        <HeroPhoto id={hero.id} size={art} />
        <Txt f="bold" size={14.5} color={c.logoInk} center style={{ marginTop: 2, lineHeight: 19 }}>
          {hero.name}
        </Txt>
        <Txt size={12} color={INK_SOFT} center numberOfLines={2} style={{ lineHeight: 16, minHeight: 32 }}>
          {hero.title}
        </Txt>
      </Pressable>
    </View>
  );
};

/** Khung chi tiết: ảnh lớn có chú thích/nguồn, thông tin nhân vật và liên kết vào game. */
const Detail: React.FC<{ hero: HeroDef; wide: boolean }> = ({ hero, wide }) => {
  const { c } = useTheme();
  const router = useRouter();
  const p = HERO_PROFILE[hero.id];
  const soft = INK_SOFT;
  if (!p) return null;
  const row = (label: string, text: string) => (
    <Txt size={13.5} color={c.logoInk} style={{ lineHeight: 20 }}>
      <Txt f="bold" size={13.5} color={c.logoRed}>
        {label}:{' '}
      </Txt>
      {text}
    </Txt>
  );
  return (
    <View
      accessibilityLiveRegion="polite"
      testID="hero-detail"
      style={{ borderRadius: 30, padding: wide ? 20 : 16, backgroundColor: 'rgba(255, 255, 255, 0.78)', borderWidth: 1, borderColor: INK_LINE, boxShadow: '0 10px 30px rgba(35, 56, 47, 0.10)' } as unknown as ViewStyle}
    >
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <HeroPhoto id={hero.id} size={wide ? 168 : 128} />
          <View style={{ flex: 1, gap: 6, alignItems: 'flex-start' }}>
            <Txt f="heavy" size={wide ? 28 : 24} color={c.logoInk} accessibilityRole="header" style={{ lineHeight: wide ? 32 : 28, letterSpacing: -0.6 }}>
              {hero.name}
            </Txt>
            <Txt f="bold" size={11.5} color={c.logoRed} upper style={{ letterSpacing: 1.4, lineHeight: 16 }}>
              {hero.title}
            </Txt>
            <LoreChip lore={hero.lore} />
          </View>
        </View>
        <Txt size={14.5} color={soft} style={{ lineHeight: 22 }}>
          {p.summary}
        </Txt>
        <View style={{ borderRadius: 20, padding: 14, gap: 6, backgroundColor: 'rgba(35, 56, 47, 0.05)', borderWidth: 1, borderColor: INK_LINE }}>
          {row('Sinh – mất', p.years)}
          {row('Chức tước', p.rank)}
          {row('Xuất thân', p.origin)}
          {row('Tham gia', p.wars)}
          <Txt f="bold" size={13.5} color={c.logoRed} style={{ marginTop: 4 }}>
            Công trạng:
          </Txt>
          {p.deeds.map((d) => (
            <View key={d} style={{ flexDirection: 'row', gap: 8 }}>
              <Txt size={13.5} color={c.logoRed} style={{ lineHeight: 20 }}>
                •
              </Txt>
              <Txt size={13.5} color={c.logoInk} style={{ flex: 1, lineHeight: 20 }}>
                {d}
              </Txt>
            </View>
          ))}
          {row('Trong game', `${TIER_INFO[hero.tier].name} · ${hero.role}`)}
        </View>
        <Pressable
          onPress={() => router.push('/portal')}
          accessibilityRole="link"
          accessibilityLabel={`Chơi cùng ${hero.name} trong game`}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, opacity: pressed ? 0.75 : 1 })}
        >
          <Txt f="bold" size={15} color={c.logoRed}>
            Chơi cùng {hero.name} trong game
          </Txt>
          <ArrowUpRight size={18} color={c.logoRed} strokeWidth={2.2} />
        </Pressable>
        <HeroPhotoCredit id={hero.id} />
      </View>
    </View>
  );
};
