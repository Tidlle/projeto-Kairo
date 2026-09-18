/**
 * Mapa das categorias do Pluggy (inglês) para as do Kairo (PT-BR).
 *
 * Cobre os 21 rótulos observados nos dados reais. O que não estiver aqui volta
 * como `null` e cai na fila da IA — que é o comportamento desejado: rótulo
 * desconhecido deve ser refinado, não chutado.
 *
 * `Shopping` é caso à parte: 45% das transações caem nele, misturando posto de
 * gasolina, pizzaria e loja de eletrônicos. Mapeamos para "Compras" mas marcamos
 * como impreciso, para a IA sempre reavaliar.
 */

export type CategoryMapping = {
  name: string;
  isIncome?: boolean;
  isTransfer?: boolean;
  /** Balde genérico demais: a IA deve tentar refinar mesmo já tendo categoria. */
  imprecise?: boolean;
};

export const PLUGGY_CATEGORY_MAP: Record<string, CategoryMapping> = {
  // genéricas — refinar
  Shopping: { name: 'Compras', imprecise: true },
  Services: { name: 'Serviços', imprecise: true },
  Transfers: { name: 'Transferências', imprecise: true },

  // transferências
  'Same person transfer': { name: 'Transferência interna', isTransfer: true },
  'Transfer - PIX': { name: 'Transferências', imprecise: true },

  // alimentação
  Groceries: { name: 'Mercado' },
  'Eating out': { name: 'Restaurantes' },
  'Food delivery': { name: 'Delivery' },
  'Food and drinks': { name: 'Alimentação' },

  // transporte
  'Gas stations': { name: 'Combustível' },
  'Taxi and ride-hailing': { name: 'Transporte por app' },
  Parking: { name: 'Estacionamento' },
  Automotive: { name: 'Automóvel' },
  Travel: { name: 'Viagem' },

  // compras específicas
  Electronics: { name: 'Eletrônicos' },
  Clothing: { name: 'Vestuário' },
  'Office supplies': { name: 'Material de escritório' },

  // dinheiro entrando
  Salary: { name: 'Salário', isIncome: true },
  'Proceeds interests and dividends': { name: 'Rendimentos', isIncome: true },

  // outros
  Investments: { name: 'Investimentos', isTransfer: true },
  Gambling: { name: 'Apostas' },
};

export function mapCategory(pluggyCategory: string | null): CategoryMapping | null {
  if (!pluggyCategory) return null;
  return PLUGGY_CATEGORY_MAP[pluggyCategory] ?? null;
}

/** Precisa passar pela IA? Sem categoria, ou categoria genérica demais. */
export function needsAiRefinement(pluggyCategory: string | null): boolean {
  const mapped = mapCategory(pluggyCategory);
  return !mapped || mapped.imprecise === true;
}
