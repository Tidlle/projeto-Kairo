/**
 * Tema escuro fixo — mesma decisão do hook nativo (`use-color-scheme.ts`).
 * Antes disto, esta versão Web tinha um passo de hidratação (renderizar
 * 'light' no servidor, só trocar para o valor real depois do mount no
 * cliente) porque o valor dependia de `useColorScheme` do React Native,
 * que não existe durante a renderização estática. Como o valor agora é
 * uma constante — não lê nada da plataforma — esse passo não faz mais
 * falta: servidor e cliente já concordam de cara.
 */
export function useColorScheme(): 'dark' {
  return 'dark';
}
