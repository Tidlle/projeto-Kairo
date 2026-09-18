// Reexporta a implementação real de fora de `app/` — dentro de `app/` o Expo
// Router carrega todas as variantes de plataforma via require.context e
// ignora a extensão `.web` (github.com/expo/expo/issues/37752). A escolha
// entre `hoje-screen.tsx` (real) e `hoje-screen.web.tsx` (fallback) acontece
// em components/screens/, onde a resolução por plataforma do Metro funciona.
export { default } from '@/components/screens/hoje-screen';
