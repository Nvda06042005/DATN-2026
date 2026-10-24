/** Bố cục gốc: nạp phông chữ, vùng an toàn, chủ đề sáng, thông báo nhanh; mọi trang không có thanh tiêu đề hệ thống */
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Baloo2_600SemiBold } from '@expo-google-fonts/baloo-2/600SemiBold';
import { Baloo2_700Bold } from '@expo-google-fonts/baloo-2/700Bold';
import { Baloo2_800ExtraBold } from '@expo-google-fonts/baloo-2/800ExtraBold';
import { BeVietnamPro_400Regular } from '@expo-google-fonts/be-vietnam-pro/400Regular';
import { BeVietnamPro_500Medium } from '@expo-google-fonts/be-vietnam-pro/500Medium';
import { BeVietnamPro_600SemiBold } from '@expo-google-fonts/be-vietnam-pro/600SemiBold';
import { BeVietnamPro_700Bold } from '@expo-google-fonts/be-vietnam-pro/700Bold';
import { BeVietnamPro_800ExtraBold } from '@expo-google-fonts/be-vietnam-pro/800ExtraBold';
import { NotoSerif_400Regular } from '@expo-google-fonts/noto-serif/400Regular';
import { NotoSerif_700Bold } from '@expo-google-fonts/noto-serif/700Bold';
import { ToastProvider } from '@/components/ui';
import { PALETTES } from '@/constants/theme';
import { ReduceMotionContext, useSystemReduceMotion } from '@/hooks/use-motion';
import { ThemeContext } from '@/hooks/use-theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const LIGHT = { c: PALETTES.light, dark: false };

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Baloo2_600SemiBold, Baloo2_700Bold, Baloo2_800ExtraBold,
    BeVietnamPro_400Regular, BeVietnamPro_500Medium, BeVietnamPro_600SemiBold, BeVietnamPro_700Bold, BeVietnamPro_800ExtraBold,
    NotoSerif_400Regular, NotoSerif_700Bold,
  });
  const reduceMotion = useSystemReduceMotion();
  const ready = loaded || !!error;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;
  return (
    <SafeAreaProvider>
      <ReduceMotionContext.Provider value={reduceMotion}>
        <ThemeContext.Provider value={LIGHT}>
          <ToastProvider>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: PALETTES.light.giay }, animation: 'fade' }} />
          </ToastProvider>
        </ThemeContext.Provider>
      </ReduceMotionContext.Provider>
    </SafeAreaProvider>
  );
}
