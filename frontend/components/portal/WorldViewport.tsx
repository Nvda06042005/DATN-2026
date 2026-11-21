/**
 * Khung thế giới khối trên ứng dụng điện thoại gốc (Android / iOS): three.js vẽ bằng WebGL của trình duyệt nên chưa chạy trực tiếp trong React Native.
 * Bản web nằm ở WorldViewport.web.tsx.
 */
import React from 'react';
import { View } from 'react-native';
import { Txt } from '@/components/ui';
import type { GameBridge } from '@/game/bridge';

export interface WorldViewportProps { bridge: GameBridge; label: string; height: number; children?: React.ReactNode }

export const WorldViewport: React.FC<WorldViewportProps> = ({ label, height }) => (
  <View accessibilityLabel={label} testID="world-viewport" style={{ width: '100%', height, borderRadius: 18, backgroundColor: '#2b4a40', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
    <Txt f="bold" size={16} color="#ffffff" center>Thế giới khối hiện chạy trên trình duyệt web.</Txt>
    <Txt size={14} color="#d7e6dc" center style={{ marginTop: 6 }}>Hãy mở Hào Khí Đông A bằng trình duyệt trên máy tính hoặc điện thoại để cùng các bạn khám phá.</Txt>
  </View>
);
