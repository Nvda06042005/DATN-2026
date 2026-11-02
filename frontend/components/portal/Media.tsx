/**
 * Ảnh và video minh họa của câu hỏi (HK.GV.092): ảnh tải lên có đường dẫn tương đối tới máy chủ, ảnh sử liệu là liên kết https;
 * video là liên kết YouTube / Vimeo (nhúng khung phát), tệp .mp4 / .webm (thẻ video) hoặc liên kết khác (nút mở trong tab mới).
 */
import React from 'react';
import { Image, Linking, Platform, View } from 'react-native';
import { Play } from 'lucide-react-native';
import { API_BASE_URL } from '@/api/client';
import { Btn, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';

/** Đường dẫn dùng được trong thẻ ảnh: ảnh đã tải lên nằm trên máy chủ API */
export const mediaUri = (url: string): string => (url.startsWith('/') ? `${API_BASE_URL}${url}` : url);

/** Địa chỉ khung phát nhúng cho YouTube / Vimeo, hoặc null */
export function embedUrl(url: string): string | null {
  const yt = url.match(/^https:\/\/(?:www\.)?(?:youtube\.com\/watch\?(?:[^#]*&)?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{6,15})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const vm = url.match(/^https:\/\/(?:www\.)?vimeo\.com\/(\d{5,12})/);
  return vm ? `https://player.vimeo.com/video/${vm[1]}` : null;
}

const isFile = (url: string): boolean => /\.(mp4|webm)(\?|#|$)/i.test(url);

export const MediaView: React.FC<{ image?: string | null; video?: string | null; label?: string; height?: number }> = ({ image, video, label, height = 220 }) => {
  const { c } = useTheme();
  if (!image && !video) return null;
  const embed = video ? embedUrl(video) : null;
  return (
    <View style={{ gap: 10 }}>
      {image ? <Image source={{ uri: mediaUri(image) }} accessibilityLabel={label ? `Hình minh họa: ${label}` : 'Hình minh họa câu hỏi'} resizeMode="contain" style={{ width: '100%', height, borderRadius: 12, backgroundColor: c.giay2 }} /> : null}
      {video && Platform.OS === 'web' && embed ? React.createElement('iframe', { src: embed, title: 'Video minh họa', allow: 'accelerometer; encrypted-media; picture-in-picture', allowFullScreen: true, style: { width: '100%', height, border: 0, borderRadius: 12, background: '#000' } }) : null}
      {video && Platform.OS === 'web' && !embed && isFile(video) ? React.createElement('video', { src: video, controls: true, preload: 'metadata', 'aria-label': 'Video minh họa', style: { width: '100%', maxHeight: height, borderRadius: 12, background: '#000' } }) : null}
      {video && (Platform.OS !== 'web' || (!embed && !isFile(video))) ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Btn icon={Play} title="Xem video minh họa" tone="giay" size="sm" onPress={() => { void Linking.openURL(video); }} />
          <Txt size={12} color={c.muc3}>Mở trong tab mới</Txt>
        </View>
      ) : null}
    </View>
  );
};
