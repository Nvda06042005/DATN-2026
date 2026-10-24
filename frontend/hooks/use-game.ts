import { createContext, useContext } from 'react';
import type { GameCtx } from '@/types/game';

export const GameContext = createContext<GameCtx | null>(null);

/** Trạng thái và thao tác của game học sinh (do GameShell cung cấp) */
export const useGame = (): GameCtx => {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame phải dùng bên trong GameShell');
  return ctx;
};
