import { createContext, useContext, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { PALETTES, type Palette } from '@/constants/theme';

export const ThemeContext = createContext<{ c: Palette; dark: boolean }>({ c: PALETTES.light, dark: false });

/** Bảng màu đang dùng (game học sinh có chế độ tối riêng) */
export const useTheme = () => useContext(ThemeContext);

type Styles = Parameters<typeof StyleSheet.create>[0];

/** StyleSheet tạo theo bảng màu hiện tại; `make` nên khai báo ngoài component để không tạo lại mỗi lần vẽ */
export function useStyles<T extends Styles>(make: (c: Palette) => T): Readonly<T> {
  const { c } = useTheme();
  return useMemo(() => StyleSheet.create(make(c)), [c, make]);
}
