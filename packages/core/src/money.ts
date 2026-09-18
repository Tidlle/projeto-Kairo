/**
 * Dinheiro em centavos.
 *
 * Ponto flutuante não representa decimais exatamente (0.1 + 0.2 === 0.30000000000000004),
 * então todo valor monetário do Kairo trafega como inteiro de centavos e só vira
 * decimal na hora de exibir.
 */

/** Converte o `amount` da API (reais, float) para centavos inteiros. */
export function toCents(amount: number): number {
  if (!Number.isFinite(amount)) throw new RangeError(`valor monetário inválido: ${amount}`);
  // Math.round trata o erro de representação: 75.8 * 100 === 7580.000000000001
  return Math.round(amount * 100);
}

export const fromCents = (cents: number): number => cents / 100;

export const formatBRL = (cents: number, currency = 'BRL'): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(fromCents(cents));
