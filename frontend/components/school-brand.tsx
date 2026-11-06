/**
 * Nhận diện của một trường: huy hiệu tự tạo từ tên trường (khi chưa có logo riêng), tên + khu vực ở trang đăng nhập riêng,
 * và hộp đường dẫn riêng để quản trị tổng chép gửi cho trường.
 */
import React, { useState } from 'react';
import { Image, Linking, Platform, View } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import { Copy, ExternalLink } from 'lucide-react-native';
import { Btn, Inset, Txt, useToast } from '@/components/ui';
import { FONT } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { emblemColors, schoolInitials } from '@/lib/school-link';
import type { SchoolLink } from '@/types/api';

/** Ngôi sao năm cánh nhỏ ở đỉnh huy hiệu */
const STAR = (() => {
  const R = 8, r = 3.1, cx = 50, cy = 25;
  return `M${Array.from({ length: 10 }, (_, i) => {
    const a = (-90 + i * 36) * (Math.PI / 180);
    const d = i % 2 === 0 ? R : r;
    return `${(cx + d * Math.cos(a)).toFixed(2)} ${(cy + d * Math.sin(a)).toFixed(2)}`;
  }).join(' L')} Z`;
})();

/** Logo riêng của trường nếu có; nếu chưa có thì huy hiệu vẽ từ tên và mã trường, nên không ai phải dán ảnh */
export const SchoolEmblem: React.FC<{ name: string; code: string; logoUrl?: string | null; size?: number }> = ({ name, code, logoUrl, size = 56 }) => {
  const [failed, setFailed] = useState(false);
  if (logoUrl && !failed) {
    return <Image source={{ uri: logoUrl }} onError={() => setFailed(true)} accessibilityLabel={`Logo ${name}`} accessibilityIgnoresInvertColors resizeMode="contain" style={{ width: size, height: size, borderRadius: 10 }} />;
  }
  const { bg, ring } = emblemColors(code);
  const letters = schoolInitials(name);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`Huy hiệu ${name}`} style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Circle cx="50" cy="50" r="48" fill={ring} />
        <Circle cx="50" cy="50" r="44" fill={bg} />
        <Circle cx="50" cy="50" r="37" fill="none" stroke={ring} strokeWidth="1.5" opacity="0.7" />
        <Path d={STAR} fill={ring} />
        <SvgText x="50" y="64" fontSize={letters.length > 1 ? 30 : 34} fontWeight="800" fill="#ffffff" textAnchor="middle" fontFamily={FONT.heavy}>{letters}</SvgText>
        <Path d="M31 77 Q50 85 69 77" stroke={ring} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </Svg>
    </View>
  );
};

export interface SchoolBrandInfo { school_code: string; name: string; region: string | null; city: string | null; logo_url: string | null }

/** Tên trường ở góc trang đăng nhập riêng: huy hiệu + tên + khu vực */
export const SchoolBadge: React.FC<{ school: SchoolBrandInfo; light?: boolean }> = ({ school, light }) => {
  const { c } = useTheme();
  const place = [school.region, school.city].filter(Boolean).join(' · ');
  return (
    <View accessible accessibilityRole="header" accessibilityLabel={`${school.name}${place ? `, ${place}` : ''}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: 360 }}>
      <SchoolEmblem name={school.name} code={school.school_code} logoUrl={school.logo_url} size={52} />
      <View style={{ flexShrink: 1 }}>
        <Txt f="bold" size={18} color={light ? c.trang : c.logoInk} numberOfLines={2}>{school.name}</Txt>
        {place ? <Txt f="semibold" size={11} color={light ? 'rgba(255,255,255,0.85)' : c.muc2} numberOfLines={2}>{place}</Txt> : null}
      </View>
    </View>
  );
};

/** Đường dẫn riêng của trường: chép hoặc mở ngay, để quản trị tổng gửi cho trường dùng */
export const SchoolLinkBox: React.FC<{ link: SchoolLink }> = ({ link }) => {
  const { c } = useTheme();
  const toast = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link.url);
      toast('Đã sao chép đường dẫn của trường');
    } catch {
      toast('Không sao chép tự động được, hãy chọn và chép thủ công.');
    }
  };
  return (
    <Inset style={{ gap: 8 }}>
      <Txt f="bold" size={13} color={c.muc2}>Đường dẫn riêng của trường</Txt>
      <Txt size={14} selectable testID="school-link-url" style={{ fontFamily: FONT.mono }}>{link.url}</Txt>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {Platform.OS === 'web' && <Btn title="Sao chép" icon={Copy} tone="giay" size="sm" onPress={copy} testID="school-link-copy" />}
        <Btn title="Mở trang" icon={ExternalLink} tone="giay" size="sm" onPress={() => { void Linking.openURL(link.url); }} testID="school-link-open" />
      </View>
      <Txt size={12} color={c.muc3}>Học sinh, giáo viên và quản trị viên của trường dùng đường dẫn này để đăng nhập; tài khoản của trường khác không vào được.</Txt>
    </Inset>
  );
};
