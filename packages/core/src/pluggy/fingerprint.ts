/**
 * Fingerprint de estabelecimento.
 *
 * 90% das transações reais chegam com `merchant: null`, e cada banco escreve a
 * descrição do seu jeito. O fingerprint reduz variações da MESMA compra a uma
 * chave estável, para o cache de merchants acertar e a IA ser chamada uma vez só:
 *
 *   "Compra no débito|POSTO ILHA DE BALI"          → POSTO ILHA DE BALI
 *   "DEBITO VISA ELECTRON BRASIL   24/08 CARREF"   → CARREF
 *   "Transferência Recebida|RAFAELLA VITORIA M "   → RAFAELLA VITORIA M
 *
 * Regra de ouro: só remover o que é ruído do BANCO. Números que fazem parte do
 * nome ("PIZZARIA ALONZA 2") ficam — podem distinguir duas unidades.
 */

import type { PluggyTransaction } from './types.ts';

/**
 * Prefixos que os bancos colam antes do nome real. Derivados dos dados
 * observados: "Compra no débito" (371x), "Transferência Recebida" (140x),
 * "DEBITO VISA ELECTRON" (15x), "Resgate RDB" (26x)…
 */
const BANK_PREFIXES = [
  /^compra no debito( via \w+)?/i,
  /^compra no credito/i,
  /^transferencia (recebida|enviada)/i,
  /^pix (recebido|enviado)/i,
  /^debito visa electron( brasil)?/i,
  /^debito mastercard( brasil)?/i,
  /^(resgate|aplicacao) rdb/i,
  /^estorno - (compra|ajuste)/i,
  /^pagamento de (boleto|fatura)/i,
  /^compra com cartao/i,
];

/** Ruído posicional: datas dd/mm, horas, sequenciais longos, docs mascarados. */
const NOISE = [
  /\b\d{2}\/\d{2}(\/\d{2,4})?\b/g, // 24/08 ou 24/08/2026
  /\b\d{2}:\d{2}(:\d{2})?\b/g, // 14:32
  /\b\d{10,}\b/g, // sequenciais de autorização
  /\*{2,}\d+/g, // ****1234
];

/** Remove acentos sem depender de locale. */
const stripAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Reduz uma descrição crua à sua chave estável.
 * Retorna string vazia se não sobrar nada reconhecível.
 */
export function fingerprint(rawDescription: string): string {
  let s = stripAccents(rawDescription).toUpperCase();

  // O pipe separa "rótulo do banco | nome real" — o que interessa é a direita.
  if (s.includes('|')) s = s.slice(s.indexOf('|') + 1);

  const beforeStrip = clean(s);

  for (const re of BANK_PREFIXES) s = s.replace(re, ' ');
  for (const re of NOISE) s = s.replace(re, ' ');

  const stripped = clean(s);

  /**
   * Se a limpeza consumiu tudo, a descrição INTEIRA era o rótulo do banco —
   * é o caso de "Resgate RDB" e "Aplicação RDB" (31 transações nos dados reais).
   * Aí o rótulo é a única informação que existe: preservá-lo mantém as duas
   * operações distintas, em vez de colapsar ambas numa chave vazia.
   */
  return stripped || beforeStrip;
}

const clean = (s: string) =>
  s
    .replace(/[^\w\s.&-]/g, ' ') // pontuação solta
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Melhor nome disponível para o estabelecimento/contraparte.
 *
 * Ordem de preferência, do mais confiável para o menos:
 *   1. `merchant.name` — só 10% das transações têm, mas é o dado limpo
 *   2. contraparte do PIX — nome real de quem pagou/recebeu
 *   3. fingerprint da descrição — o caso comum
 */
export function bestDisplayName(tx: PluggyTransaction): string {
  if (tx.merchant?.name) return tx.merchant.name;

  const counterparty = pixCounterparty(tx);
  if (counterparty) return counterparty;

  const fp = fingerprint(tx.description ?? '');
  return fp || (tx.description ?? '').trim() || 'Sem descrição';
}

/**
 * Nome da contraparte numa transferência PIX.
 * Saída (amount < 0) → quem recebeu. Entrada → quem pagou.
 */
export function pixCounterparty(tx: PluggyTransaction): string | null {
  const pd = tx.paymentData;
  if (!pd) return null;
  const party = tx.amount < 0 ? pd.receiver : pd.payer;
  return party?.name?.trim() || null;
}

/**
 * Chave de cache. Usa CNPJ quando existe — é o identificador mais forte,
 * imune a variações de escrita entre bancos.
 */
export function merchantKey(tx: PluggyTransaction): string {
  if (tx.merchant?.cnpj) return `cnpj:${tx.merchant.cnpj}`;

  const counterparty = pixCounterparty(tx);
  if (counterparty) return `party:${stripAccents(counterparty).toUpperCase().replace(/\s+/g, ' ').trim()}`;

  return `desc:${fingerprint(tx.description ?? '')}`;
}
