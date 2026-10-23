import React from 'react';
import type { GameCtx } from '@/types/gameType';

export const GameContext = React.createContext<GameCtx | null>(null);
