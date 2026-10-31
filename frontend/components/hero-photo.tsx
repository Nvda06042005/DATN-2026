import React, { useState } from 'react';
import { Image, Linking, Pressable, View } from 'react-native';
import { Txt } from '@/components/ui';
import { HERO_PHOTOS } from '@/constants/hero-photos';
import { useTheme } from '@/hooks/use-theme';

/** Real statues, reliefs and documented historical material; no entrance or hover motion. */
export const HeroPhoto: React.FC<{ id: string; size: number }> = ({ id, size }) => {
  const { c } = useTheme();
  const photo = HERO_PHOTOS[id];
  const [failedSource, setFailedSource] = useState<unknown>(null);
  const height = Math.round(size * 1.2);
  return (
    <View testID={`hero-photo-${id}`} style={{ width: size, height, borderRadius: 15, overflow: 'hidden', backgroundColor: c.logoPaper, justifyContent: 'center', alignItems: 'center' }}>
      {photo && failedSource !== photo.source ? (
        <Image source={photo.source} resizeMode="contain" accessibilityLabel={photo.caption} onError={() => setFailedSource(photo.source)} style={{ width: size, height }} />
      ) : (
        <Txt size={12} center color={c.logoInk} style={{ paddingHorizontal: 8 }}>Ảnh tạm thời chưa tải được</Txt>
      )}
    </View>
  );
};

/** Keep contextual images distinguishable from portraits without displaying source credits in the profile. */
export const HeroPhotoNote: React.FC<{ id: string }> = ({ id }) => {
  const { c } = useTheme();
  const note = HERO_PHOTOS[id]?.note;
  return note ? <Txt size={12} color={c.logoInk} style={{ lineHeight: 18 }}>{note}</Txt> : null;
};

/** Ghi công đầy đủ được hiển thị trong trang điều khoản sử dụng. */
export const HeroPhotoCredit: React.FC<{ id: string }> = ({ id }) => {
  const { c } = useTheme();
  const photo = HERO_PHOTOS[id];
  if (!photo) return null;
  return (
    <View testID="hero-photo-credit" style={{ gap: 3 }}>
      <Txt f="bold" size={12} color={c.logoInk} style={{ lineHeight: 18 }}>{photo.kind}: {photo.caption}.</Txt>
      {photo.note && <Txt size={12} color={c.logoInk} style={{ lineHeight: 18 }}>{photo.note}</Txt>}
      <Pressable accessibilityRole="link" accessibilityLabel={`Mở nguồn ảnh: ${photo.caption}`} onPress={() => { void Linking.openURL(photo.sourceUrl); }} style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
        <Txt size={12} color={c.logoRed} style={{ lineHeight: 18, textDecorationLine: 'underline' }}>Nguồn ảnh: {photo.credit} ↗</Txt>
      </Pressable>
      {photo.license && photo.licenseUrl && (
        <Pressable accessibilityRole="link" accessibilityLabel={`Giấy phép ảnh: ${photo.license}`} onPress={() => { void Linking.openURL(photo.licenseUrl!); }} style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
          <Txt size={11.5} color={c.logoInk} style={{ lineHeight: 17, textDecorationLine: 'underline' }}>{photo.license} · Thu nhỏ, chuyển WebP ↗</Txt>
        </Pressable>
      )}
    </View>
  );
};
