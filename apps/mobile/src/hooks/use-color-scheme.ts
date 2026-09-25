/**
 * Tema escuro fixo — decisão de produto, não segue a configuração do
 * aparelho. Mantido como hook (em vez de ler `Colors.dark` direto em
 * `use-theme.ts`) para o dia em que isso precisar voltar a ser dinâmico
 * bastar trocar esta única função.
 */
export function useColorScheme(): 'dark' {
  return 'dark';
}
