/**
 * Khung chứa game trên điện thoại (Android / iOS). Phaser vẽ bằng Canvas / WebGL của trình duyệt nên không chạy trực tiếp trong React Native;
 * bản điện thoại sẽ nhúng cùng màn chơi qua WebView ở một bước sau. Hiện tại phần học, luyện tập và ôn tập dùng được trên điện thoại,
 * còn phần nhập vai và trận đánh mở trên trình duyệt. Bản web nằm ở GameViewport.web.tsx.
 */
import React from 'react';
import { View } from 'react-native';
import { Txt } from '@/components/ui';
import type { GameBridge, GameKind } from '@/game/bridge';

export interface GameViewportProps { kind: Exclude<GameKind, 'explore'>; bridge: GameBridge; aspect: number; label: string; maxHeight?: number }

export const GameViewport: React.FC<GameViewportProps> = ({ aspect, label, maxHeight }) => (
  <View accessibilityLabel={label} testID="game-viewport" style={{ width: '100%', maxWidth: maxHeight ? Math.round(maxHeight * aspect) : undefined, aspectRatio: aspect, alignSelf: 'center', borderRadius: 18, backgroundColor: '#16253f', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
    <Txt f="bold" size={16} color="#ffffff" center>Màn chơi này hiện chạy trên trình duyệt web.</Txt>
    <Txt size={14} color="#c8d6ee" center style={{ marginTop: 6 }}>Hãy mở Hào Khí Đông A bằng trình duyệt trên máy tính hoặc điện thoại để nhập vai và ra trận.</Txt>
  </View>
);
