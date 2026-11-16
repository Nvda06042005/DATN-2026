/**
 * Khởi tạo game Phaser (Canvas / WebGL) cho một màn chơi của Hành trình Đông A. Tệp này chỉ được nạp bằng `import()` động từ GameViewport bản web,
 * nên Phaser (khoảng 1,5 MB) nằm trong một gói riêng, không làm nặng các trang khác và không bao giờ vào bản điện thoại.
 */
import Phaser from 'phaser';
import { BACHDANG_SIZE, BachDangScene } from './bachdang-scene';
import type { GameBridge, GameKind } from './bridge';
import { EXPLORE_SIZE, ExploreScene } from './explore-scene';
import { TACTICS_SIZE, TacticsScene } from './tactics-scene';

export const GAME_SIZE: Record<GameKind, { width: number; height: number }> = { explore: EXPLORE_SIZE, tactics: TACTICS_SIZE, bachdang: BACHDANG_SIZE };

export function createGame(parent: HTMLElement, kind: GameKind, bridge: GameBridge): { destroy: () => void } {
  const scene = kind === 'explore' ? new ExploreScene(bridge) : kind === 'tactics' ? new TacticsScene(bridge) : new BachDangScene(bridge);
  const game = new Phaser.Game({
    type: Phaser.AUTO, parent, ...GAME_SIZE[kind], backgroundColor: kind === 'explore' ? '#8fce6a' : '#8fd3ff', banner: false,
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
