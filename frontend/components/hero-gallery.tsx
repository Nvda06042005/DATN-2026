/**
 * Thư viện danh tướng nhà Trần của trang chủ (kiểu lưới biểu tượng kèm khung chi tiết): bên trái là lưới thẻ có tranh minh họa, bên phải là
 * khung sơ yếu lý lịch tóm tắt của người đang chọn (khung dính theo khi cuộn). Điện thoại: lưới hai cột, khung mở ngay dưới hàng vừa bấm.
 * Dữ liệu: HEROES (tên, danh hiệu, nhãn nguồn) và HERO_PROFILE (sơ yếu lý lịch theo Wikipedia) trong constants/heroes.ts.
 */
import React, { useState } from 'react';
import { Animated, Platform, Pressable, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowUpRight } from 'lucide-react-native';
import { LoreChip } from '@/components/game/quiz';
import { HeroPortrait } from '@/components/hero-portrait';
import { Lift, Reveal } from '@/components/motion';
import { Txt } from '@/components/ui';
import { ELEMENTS, TIER_INFO } from '@/constants/game';
import { HEROES, HERO_PROFILE } from '@/constants/heroes';
import { usePopIn } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';
import type { HeroDef } from '@/types/game';

const MAX_W = 1120;
const DEFAULT_ID = 'tran_hung_dao';
/** Khung chi tiết dính theo khi cuộn (chỉ web) */
const STICKY = (Platform.OS === 'web' ? { position: 'sticky', top: 84 } : null) as unknown as ViewStyle;

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

  const tile = (h: HeroDef, i: number) => (
    <Reveal key={h.id} delay={(i % cols) * 70} style={{ width: tileW }}>
      <Tile hero={h} w={tileW} active={h.id === current} onPress={() => setSel(!wide && h.id === current ? null : h.id)} />
    </Reveal>
  );

  if (!wide) {
    return (
      <View style={{ gap: 12 }}>
        {rows(HEROES, cols).map((row, r) => (
          <View key={r} style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>{row.map((h, i) => tile(h, r * cols + i))}</View>
            {hero && row.some((h) => h.id === hero.id) && <Detail hero={hero} wide={false} />}
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 28 }}>
      <View style={{ width: gridW, flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{HEROES.map(tile)}</View>
      <View style={[{ width: panelW }, STICKY]}>{hero && <Detail hero={hero} wide />}</View>
    </View>
  );
};

/** Một thẻ trong lưới: tranh minh họa, tên và danh hiệu; thẻ đang chọn viền vàng */
const Tile: React.FC<{ hero: HeroDef; w: number; active: boolean; onPress: () => void }> = ({ hero, w, active, onPress }) => {
  const { c } = useTheme();
  const el = ELEMENTS[hero.element];
  const art = Math.min(150, w - 24);
  const h = Math.round(art * 1.2) + 74;
  return (
    <Lift style={{ width: w, height: h }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${hero.name}, ${hero.title}`}
        accessibilityState={{ selected: active }}
        testID={`hero-tile-${hero.id}`}
        style={({ pressed }) => ({
          width: w, height: h, alignItems: 'center', paddingTop: 12, paddingBottom: 12, paddingHorizontal: 8, borderRadius: 26, borderWidth: 1.5,
          borderColor: active ? c.logoGold : 'rgba(250,244,231,0.09)',
          backgroundColor: active ? 'rgba(223,182,111,0.12)' : 'rgba(250,244,231,0.04)',
          opacity: pressed ? 0.9 : 1,
        })}
      >
        <HeroPortrait id={hero.id} size={art} accent={c[el.fill]} />
        <Txt f="bold" size={14.5} color={c.logoPaper} center style={{ marginTop: 2, lineHeight: 19 }}>
          {hero.name}
        </Txt>
        <Txt size={12} color="rgba(250,244,231,0.66)" center numberOfLines={2} style={{ lineHeight: 16, minHeight: 32 }}>
          {hero.title}
        </Txt>
      </Pressable>
    </Lift>
  );
};

/** Khung sơ yếu lý lịch: tranh lớn, tên, danh hiệu, tóm tắt, bảng thông tin, công trạng và liên kết vào game */
const Detail: React.FC<{ hero: HeroDef; wide: boolean }> = ({ hero, wide }) => {
  const { c } = useTheme();
  const router = useRouter();
  const pop = usePopIn(hero.id);
  const p = HERO_PROFILE[hero.id];
  const el = ELEMENTS[hero.element];
  const soft = 'rgba(250,244,231,0.74)';
  if (!p) return null;
  const row = (label: string, text: string) => (
    <Txt size={13.5} color={c.logoPaper} style={{ lineHeight: 20 }}>
      <Txt f="bold" size={13.5} color={c.logoGold}>
        {label}:{' '}
      </Txt>
      {text}
    </Txt>
  );
  return (
    <View
      accessibilityLiveRegion="polite"
      testID="hero-detail"
      style={{ borderRadius: 30, padding: wide ? 20 : 16, backgroundColor: 'rgba(250,244,231,0.05)', borderWidth: 1, borderColor: 'rgba(223,182,111,0.28)' }}
    >
      <Animated.View style={[{ gap: 10 }, pop]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <HeroPortrait id={hero.id} size={wide ? 168 : 128} accent={c[el.fill]} />
          <View style={{ flex: 1, gap: 6, alignItems: 'flex-start' }}>
            <Txt f="heavy" size={wide ? 28 : 24} color={c.logoPaper} accessibilityRole="header" style={{ lineHeight: wide ? 32 : 28, letterSpacing: -0.6 }}>
              {hero.name}
            </Txt>
            <Txt f="bold" size={11.5} color={c.logoGold} upper style={{ letterSpacing: 1.4, lineHeight: 16 }}>
              {hero.title}
            </Txt>
            <LoreChip lore={hero.lore} />
          </View>
        </View>
        <Txt size={14.5} color={soft} style={{ lineHeight: 22 }}>
          {p.summary}
        </Txt>
        <View style={{ borderRadius: 20, padding: 14, gap: 6, backgroundColor: 'rgba(0,0,0,0.18)', borderWidth: 1, borderColor: 'rgba(250,244,231,0.1)' }}>
          {row('Sinh – mất', p.years)}
          {row('Chức tước', p.rank)}
          {row('Xuất thân', p.origin)}
          {row('Tham gia', p.wars)}
          <Txt f="bold" size={13.5} color={c.logoGold} style={{ marginTop: 4 }}>
            Công trạng:
          </Txt>
          {p.deeds.map((d) => (
            <View key={d} style={{ flexDirection: 'row', gap: 8 }}>
              <Txt size={13.5} color={c.logoGold} style={{ lineHeight: 20 }}>
                •
              </Txt>
              <Txt size={13.5} color={c.logoPaper} style={{ flex: 1, lineHeight: 20 }}>
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
          <Txt f="bold" size={15} color={c.logoGold}>
            Chơi cùng {hero.name} trong game
          </Txt>
          <ArrowUpRight size={18} color={c.logoGold} strokeWidth={2.2} />
        </Pressable>
        <Txt size={12} color="rgba(250,244,231,0.5)" style={{ lineHeight: 17 }}>
          Tranh minh họa cách điệu, không phải chân dung đương thời (không còn chân dung của các nhân vật này). Nội dung theo Wikipedia tiếng Việt.
        </Txt>
      </Animated.View>
    </View>
  );
};
