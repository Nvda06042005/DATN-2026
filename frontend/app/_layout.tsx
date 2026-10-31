/** Bố cục chung của trang chủ, điều khoản sử dụng và câu hỏi thường gặp. */
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Manrope_400Regular } from '@expo-google-fonts/manrope/400Regular';
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { Manrope_800ExtraBold } from '@expo-google-fonts/manrope/800ExtraBold';
import { Newsreader_400Regular } from '@expo-google-fonts/newsreader/400Regular';
import { Newsreader_700Bold } from '@expo-google-fonts/newsreader/700Bold';
import { Newsreader_700Bold_Italic } from '@expo-google-fonts/newsreader/700Bold_Italic';
import { PALETTES } from '@/constants/theme';
import { ReduceMotionContext, useSystemReduceMotion } from '@/hooks/use-motion';
import { ThemeContext } from '@/hooks/use-theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const LIGHT = { c: PALETTES.light, dark: false };

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold,
    Newsreader_400Regular, Newsreader_700Bold, Newsreader_700Bold_Italic,
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
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: PALETTES.light.giay }, animation: 'fade' }} />
        </ThemeContext.Provider>
      </ReduceMotionContext.Provider>
    </SafeAreaProvider>
  );
}
