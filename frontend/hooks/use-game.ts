import React from 'react';
import { GameContext } from '@/providers/GameContext';
import type { GameCtx } from '@/types/gameType';

export const useGame = (): GameCtx => {
  const ctx = React.useContext(GameContext);
  if (!ctx) throw new Error('useGame phải dùng bên trong GameContext');
  return ctx;
};
