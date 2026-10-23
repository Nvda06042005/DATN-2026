import { Crosshair, Footprints, Megaphone, Package, ShieldCheck, Swords, Utensils } from 'lucide-react';
import type { TideState } from '@/types/battleType';
import type { IconType, IntentId } from '@/types/gameType';

export const INTENT_INFO: Record<IntentId, { name: string; desc: string; Icon: IconType; danger: boolean }> = {
  strike: { name: 'Đánh thường', desc: 'Tấn công một tướng', Icon: Swords, danger: false },
  charge: { name: 'Càn quét', desc: 'Đòn rất mạnh vào tướng yếu nhất', Icon: Footprints, danger: true },
  volley: { name: 'Mưa tên', desc: 'Bắn vào cả đội ta', Icon: Crosshair, danger: true },
  forage: { name: 'Cướp lương', desc: 'Hồi khí lực và sức bền – bị chặn khi ta bỏ trống làng mạc', Icon: Utensils, danger: false },
  roar: { name: 'Hò hét', desc: 'Làm một tướng hoảng sợ, mất lượt', Icon: Megaphone, danger: false },
  supply: { name: 'Tiếp lương', desc: 'Hồi phục cho cả quân địch', Icon: Package, danger: false },
  brace: { name: 'Thủ thế', desc: 'Tăng phòng thủ trong lượt tới', Icon: ShieldCheck, danger: false },
};

export const TIDE_CYCLE: TideState[] = ['len', 'len', 'dung', 'rut'];

export const TIDE_LABEL: Record<TideState, string> = { len: 'Triều lên', dung: 'Triều đứng', rut: 'Triều rút' };
