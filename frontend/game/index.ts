/**
 * Khởi tạo bản đồ chơi 2D. Tệp chỉ nạp động từ GameViewport web; mỗi khung có một game và hủy sạch khi rời màn.
 */
import Phaser from 'phaser';
import { BACHDANG_SIZE, BachDangScene } from './bachdang-scene';
import type { GameBridge, GameKind } from './bridge';
import { EXPLORE_SIZE, ExploreScene } from './explore-scene';
import { TACTICS_SIZE, TacticsScene } from './tactics-scene';

export const GAME_SIZE: Record<GameKind, { width: number; height: number }> = { explore: EXPLORE_SIZE, tactics: TACTICS_SIZE, bachdang: BACHDANG_SIZE };

export function createGame(parent: HTMLElement, kind: GameKind, bridge: GameBridge): { destroy: () => void } {
  bridge.set('game:renderer', '2d');
  const scene = kind === 'explore' ? new ExploreScene(bridge) : kind === 'tactics' ? new TacticsScene(bridge) : new BachDangScene(bridge);
  const game = new Phaser.Game({
    type: Phaser.AUTO, parent, ...GAME_SIZE[kind], backgroundColor: '#8c9469', banner: false,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true, roundPixels: true, powerPreference: 'low-power' },
    // âm thanh do giao diện phát (và chỉ khi người dùng bật), game không tự mở AudioContext
    audio: { noAudio: true },
    input: { activePointers: 2 },
    scene,
  });
  // Phaser chỉ đo lại vị trí canvas khi cửa sổ đổi kích thước. Trang học sinh cuộn bên trong một khung (không phải cuộn cửa sổ) và nội dung phía trên game có thể
  // dài ra, nên canvas đổi chỗ mà Phaser không biết, làm lệch tọa độ bấm. Đo lại ngay trước mỗi thao tác chuột / chạm (bắt ở pha capture, trước bộ nghe của Phaser).
  const remeasure = (): void => { if (game.scale) game.scale.updateBounds(); };
  const EVENTS = ['mousedown', 'mousemove', 'touchstart', 'touchmove'] as const;
  for (const type of EVENTS) parent.addEventListener(type, remeasure, { capture: true, passive: true });
  // destroy(true): gỡ canvas, dừng vòng lặp, hủy texture và mọi bộ nghe sự kiện của game
  return { destroy: () => { for (const type of EVENTS) parent.removeEventListener(type, remeasure, { capture: true }); game.destroy(true); } };
}
