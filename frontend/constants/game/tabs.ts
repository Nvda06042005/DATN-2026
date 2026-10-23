import { Landmark, ScrollText, Sprout, Swords, Tent } from 'lucide-react';
import type { GameTab, IconType } from '@/types/gameType';

export const GAME_TABS: Array<{ id: GameTab; label: string; Icon: IconType }> = [
  { id: 'farm', label: 'Điền Trang', Icon: Sprout },
  { id: 'barracks', label: 'Doanh Trại', Icon: Tent },
  { id: 'campaign', label: 'Chiến Dịch', Icon: Swords },
  { id: 'exam', label: 'Quốc Tử Giám', Icon: Landmark },
  { id: 'codex', label: 'Sử Ký', Icon: ScrollText },
];
