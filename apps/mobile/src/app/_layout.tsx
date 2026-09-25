import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { Inter_400Regular, Inter_500Medium, Inter_700Bold } from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

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
 *
 * Tema sempre escuro (decisão de produto, não segue o sistema) — por isso
 * `ThemeProvider` usa `DarkTheme` direto, sem checar `useColorScheme()`
 * como antes. Splash fica retido (`preventAutoHideAsync`, acima) até as
 * fontes de marca (Fraunces/Inter) carregarem — sem isso o texto piscaria
 * na fonte do sistema antes de trocar para a fonte de verdade.
 */
export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Fraunces_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
  });

  if (!fontsLoaded) return null;

  return (
    <ThemeProvider value={DarkTheme}>
      <AnimatedSplashOverlay />
      <RootShell>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="tasks" options={{ presentation: 'modal' }} />
          <Stack.Screen name="habits" options={{ presentation: 'modal' }} />
          <Stack.Screen name="goals" options={{ presentation: 'modal' }} />
          <Stack.Screen name="agenda" options={{ presentation: 'modal' }} />
          <Stack.Screen name="dashboard" options={{ presentation: 'modal' }} />
        </Stack>
      </RootShell>
    </ThemeProvider>
  );
}
