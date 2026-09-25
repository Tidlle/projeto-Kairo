import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** `useColorScheme()` só devolve `'dark'` hoje (tema fixo) — ver o comentário lá. */
export function useTheme() {
  const scheme = useColorScheme();
  return Colors[scheme];
}
