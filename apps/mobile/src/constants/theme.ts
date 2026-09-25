/**
 * Identidade visual do Kairo — direção "Kairós", paleta Âmbar.
 *
 * Tema escuro fixo, por decisão do produto (não segue o sistema operacional
 * — ver `hooks/use-color-scheme.ts`). `Colors.light` continua definido para
 * o tipo `ThemeColor` ficar completo e por segurança caso o app volte a
 * seguir o sistema no futuro, mas hoje só `Colors.dark` é usado de verdade.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#16233B',
    textSecondary: '#5B6577',
    background: '#FBF8F3',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#F0E9DC',
    accent: '#C97B1E',
    onAccent: '#16233B',
  },
  dark: {
    text: '#F1EDE6',
    textSecondary: '#98A2B0',
    background: '#10161F',
    backgroundElement: '#19212C',
    backgroundSelected: '#212B3A',
    accent: '#E6A94E',
    onAccent: '#16233B',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * Fraunces nos títulos, Inter no corpo — os nomes exatos que
 * `@expo-google-fonts/*` registra depois de carregados via `useFonts`
 * (ver `app/_layout.tsx`). Não é `Platform.select`: são as MESMAS fontes
 * em qualquer plataforma, diferente de `Fonts.mono` abaixo.
 */
export const FontFamily = {
  display: 'Fraunces_600SemiBold',
  body: 'Inter_500Medium',
  bodyBold: 'Inter_700Bold',
} as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    mono: 'monospace',
  },
  web: {
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
