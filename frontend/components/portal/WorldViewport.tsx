/**
 * Khung thế giới khối trên ứng dụng điện thoại gốc (Android / iOS). three.js vẽ bằng WebGL của trình duyệt nên chưa chạy trực tiếp trong React Native
 * (dự án chưa có thư viện WebView / GL gốc). Nút bên dưới mở đúng màn thế giới khối này trên website bằng trình duyệt của máy; em đăng nhập ở đó là chơi tiếp
 * được ngay (tiến độ lưu ở máy chủ). Bản web nằm ở WorldViewport.web.tsx.
 */
import React from 'react';
import { Linking, Pressable, View } from 'react-native';
import { ExternalLink } from 'lucide-react-native';
import { Txt } from '@/components/ui';
import type { GameBridge } from '@/game/bridge';

/** `webUrl`: đúng màn này trên website (ứng dụng điện thoại gốc mở bằng trình duyệt của máy) */
export interface WorldViewportProps { bridge: GameBridge; label: string; height: number; webUrl?: string; children?: React.ReactNode }

export const WorldViewport: React.FC<WorldViewportProps> = ({ label, height, webUrl }) => (
  <View accessibilityLabel={label} testID="world-viewport" style={{ width: '100%', height, borderRadius: 18, backgroundColor: '#2b4a40', alignItems: 'center', justifyContent: 'center', padding: 20, gap: 12 }}>
    <Txt f="bold" size={16} color="#ffffff" center>Thế giới khối 3D mở trên trình duyệt của máy.</Txt>
    <Txt size={14} color="#d7e6dc" center>Bấm nút dưới đây để mở đúng nhiệm vụ này trên website, đăng nhập là chơi tiếp cùng các bạn – tiến độ được lưu ở máy chủ.</Txt>
    {webUrl ? (
      <Pressable accessibilityRole="link" accessibilityLabel="Mở thế giới khối trên trình duyệt" testID="world-open-browser" onPress={() => { void Linking.openURL(webUrl); }}
        style={{ minHeight: 48, paddingHorizontal: 18, borderRadius: 14, backgroundColor: '#ffffff', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <ExternalLink size={18} color="#2b4a40" /><Txt f="bold" size={15} color="#2b4a40">Mở trên trình duyệt</Txt>
      </Pressable>
    ) : null}
  </View>
);
