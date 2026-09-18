import AppTabs from '@/components/app-tabs';

/**
 * Layout do grupo `(tabs)` — só as duas abas (Hoje/Explore).
 *
 * `tasks` e `habits` ficam FORA deste grupo, de propósito: o `Tabs`/`TabSlot`
 * do `expo-router/ui` (usado em `app-tabs.web.tsx`) só entende as rotas
 * registradas como `<TabTrigger>` — navegar para uma rota fora desse conjunto
 * fixo (`router.push('/tasks')`) não atualiza o slot, e a tela continua
 * mostrando a última aba ativa mesmo com a URL certa no navegador. Colocando
 * `tasks`/`habits` como telas irmãs do grupo `(tabs)` no `Stack` da raiz
 * (ver `app/_layout.tsx`), elas navegam por cima da barra de abas — como
 * qualquer app com abas + telas modais é estruturado no Expo Router.
 */
export default function TabsLayout() {
  return <AppTabs />;
}
