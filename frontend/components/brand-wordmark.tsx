import { useId } from 'react';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { BRAND_CORE_INK, BRAND_CORE_WIDTH, BRAND_HEIGHT, BRAND_INK, BRAND_SWASH, BRAND_WIDTH } from '@/constants/brand';
import { useTheme } from '@/hooks/use-theme';

/** Original logo outlines, including the custom Đ, ô and swept A; no substitute typeface. */
export function BrandWordmark({ height = 28, color, edu = true, testID }: { height?: number; color?: string; edu?: boolean; testID?: string }) {
  const { c } = useTheme();
  const id = `brand-swash-${useId().replace(/:/g, '')}`;
  const width = edu ? BRAND_WIDTH : BRAND_CORE_WIDTH;
  return (
    <Svg testID={testID ?? 'brand-wordmark'} width={height * width / BRAND_HEIGHT} height={height} viewBox={`0 0 ${width} ${BRAND_HEIGHT}`} accessibilityElementsHidden aria-hidden>
      <Defs><LinearGradient id={id} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={c.logoRed} /><Stop offset="1" stopColor={c.sonSang} /></LinearGradient></Defs>
      <Path d={edu ? BRAND_INK : BRAND_CORE_INK} fill={color ?? c.logoInk} fillRule="evenodd" />
      <Path d={BRAND_SWASH} fill={`url(#${id})`} fillRule="evenodd" />
    </Svg>
  );
}

/** Same vector as the visible mark, used as a clean alpha mask by Metallic Paint. */
export function brandMaskSvg(color: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BRAND_CORE_WIDTH} ${BRAND_HEIGHT}" width="${BRAND_CORE_WIDTH}" height="${BRAND_HEIGHT}"><path fill="${color}" fill-rule="evenodd" d="${BRAND_CORE_INK}"/><path fill="${color}" fill-rule="evenodd" d="${BRAND_SWASH}"/></svg>`;
}
