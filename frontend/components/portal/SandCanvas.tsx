/**
 * Sa bàn 3D chỉ có trên bản web (Three.js, xem SandCanvas.web.tsx). Trên điện thoại hoặc nơi không có WebGL, thành phần này báo `onFail`
 * để trang tự dùng bản vẽ 2D nhẹ — cùng dữ liệu và cùng lời dẫn từng bước.
 */
import React, { useEffect } from 'react';
import type { SandScene } from '@/types/sandtable';

export interface SandCanvasProps { scene: SandScene; step: number; speed: number; height?: number; onFail?: (reason: string) => void }

export const SandCanvas: React.FC<SandCanvasProps> = ({ onFail }) => {
  useEffect(() => { onFail?.('Sa bàn 3D chỉ có trên bản web'); }, [onFail]);
  return null;
};
