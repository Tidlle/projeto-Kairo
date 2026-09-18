import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { RootShell } from '@/components/root-shell';

SplashScreen.preventAutoHideAsync();

/**
 * `Stack` de verdade na raiz — não o `(tabs)` sozinho como antes.
 *
 * `tasks` e `habits` são telas irmãs do grupo `(tabs)`, empilhadas por cima
 * dele. Ver o comentário em `app/(tabs)/_layout.tsx` para o motivo: o
 * `Tabs`/`TabSlot` da Web só sabe navegar entre as abas registradas, então
 * uma tela fora desse conjunto precisa estar num nível acima, no Stack.
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <RootShell>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="tasks" options={{ presentation: 'modal' }} />
          <Stack.Screen name="habits" options={{ presentation: 'modal' }} />
          <Stack.Screen name="goals" options={{ presentation: 'modal' }} />
          <Stack.Screen name="agenda" options={{ presentation: 'modal' }} />
        </Stack>
      </RootShell>
    </ThemeProvider>
  );
}
