import type { FC } from 'react';
import { Chip } from '@/components/ui';
import { LORE_LABEL } from '@/constants/game';
import { useTheme } from '@/hooks/use-theme';
import type { Lore } from '@/types/game';

/** Nhãn nguồn gốc nội dung trong thư viện nhân vật của trang chủ. */
export const LoreChip: FC<{ lore: Lore | string }> = ({ lore }) => {
  const { c } = useTheme();
  const key = (lore in LORE_LABEL ? lore : 'chinh_su') as Lore;
  const colors: Record<Lore, [string, string]> = {
    chinh_su: [c.ngocNhat, c.ngocChu],
    giai_thoai: [c.dongNhat, c.dongChu],
    sang_tao: [c.thongNhat, c.thongChu],
    dan_gian: [c.hoaNhat, c.hoaChu],
  };
  const [bg, fg] = colors[key];
  return <Chip text={LORE_LABEL[key]} bg={bg} fg={fg} />;
};
