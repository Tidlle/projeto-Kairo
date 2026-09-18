import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { toCents } from '../src/money.ts';
import { mapCategory, needsAiRefinement } from '../src/pluggy/categories.ts';
import { bestDisplayName, fingerprint, merchantKey } from '../src/pluggy/fingerprint.ts';
import { mapTransactions, normalizeSign, summarize } from '../src/pluggy/map.ts';
import { isSelfTransferByDocument, pairInternalTransfers } from '../src/pluggy/transfers.ts';
import type { PluggyAccount, PluggyTransaction } from '../src/pluggy/types.ts';

// ─────────────────────────────────────────── fixtures

const bankAccount: PluggyAccount = {
  id: 'acc-bank',
  itemId: 'item-1',
  type: 'BANK',
  subtype: 'CHECKING_ACCOUNT',
  name: 'Conta Corrente',
  marketingName: null,
  number: '00002009283-4',
  balance: 292.72,
  currencyCode: 'BRL',
  taxNumber: null,
  owner: null,
  bankData: null,
  creditData: null,
};

const creditAccount: PluggyAccount = { ...bankAccount, id: 'acc-credit', type: 'CREDIT' };

const tx = (over: Partial<PluggyTransaction>): PluggyTransaction => ({
  id: 'tx-1',
  accountId: 'acc-bank',
  amount: -100,
  currencyCode: 'BRL',
  date: '2026-08-24T00:00:00.000Z',
  description: 'Compra no débito|CARREFOUR',
  descriptionRaw: null,
  type: 'DEBIT',
  status: 'POSTED',
  category: 'Groceries',
  categoryId: '1',
  balance: null,
  merchant: null,
  paymentData: null,
  operationType: 'CARTAO',
  operationTypeAdditionalInfo: null,
  providerId: null,
  order: 0,
  createdAt: '2026-08-24T00:00:00.000Z',
  updatedAt: '2026-08-24T00:00:00.000Z',
  ...over,
});

const pixParties = (payerDoc: string, receiverDoc: string, names = ['Fulano', 'Beltrano']) => ({
  paymentMethod: 'PIX',
  reason: null,
  referenceNumber: null,
  payer: {
    name: names[0]!,
    documentNumber: { type: 'CPF', value: payerDoc },
    accountNumber: null,
    branchNumber: null,
    routingNumber: null,
    routingNumberISPB: null,
  },
  receiver: {
    name: names[1]!,
    documentNumber: { type: 'CPF', value: receiverDoc },
    accountNumber: null,
    branchNumber: null,
    routingNumber: null,
    routingNumberISPB: null,
  },
});

// ─────────────────────────────────────────── dinheiro

describe('money', () => {
  it('converte para centavos sem erro de ponto flutuante', () => {
    // 75.8 * 100 === 7580.000000000001 em float puro
    assert.equal(toCents(75.8), 7580);
    assert.equal(toCents(0.1 + 0.2), 30);
    assert.equal(toCents(-103.53), -10353);
    assert.equal(toCents(0), 0);
  });

  it('rejeita valor não finito em vez de gravar NaN no banco', () => {
    assert.throws(() => toCents(NaN), RangeError);
    assert.throws(() => toCents(Infinity), RangeError);
  });
});

// ─────────────────────────────────────────── sinal

describe('normalizeSign', () => {
  it('mantém o sinal em conta bancária', () => {
    assert.equal(normalizeSign(-100, 'BANK'), -100);
    assert.equal(normalizeSign(250, 'BANK'), 250);
  });

  it('inverte em cartão de crédito: compra positiva vira saída', () => {
    // A Pluggy manda +75.80 para uma compra no cartão. Sem inverter,
    // o gasto entraria como receita.
    assert.equal(normalizeSign(75.8, 'CREDIT'), -75.8);
    // Pagamento da fatura (negativo lá) é redução de dívida, não gasto.
    assert.equal(normalizeSign(-500, 'CREDIT'), 500);
  });
});

// ─────────────────────────────────────────── fingerprint

describe('fingerprint', () => {
  it('remove o rótulo do banco antes do pipe', () => {
    assert.equal(fingerprint('Compra no débito|POSTO ILHA DE BALI'), 'POSTO ILHA DE BALI');
    assert.equal(fingerprint('Transferência Recebida|RAFAELLA VITORIA M '), 'RAFAELLA VITORIA M');
  });

  it('remove prefixo de bandeira e a data solta', () => {
    assert.equal(fingerprint('DEBITO VISA ELECTRON BRASIL   24/08 CARREF'), 'CARREF');
  });

  it('reduz variações da mesma compra à mesma chave', () => {
    const a = fingerprint('DEBITO VISA ELECTRON BRASIL   24/08 CARREF');
    const b = fingerprint('DEBITO VISA ELECTRON BRASIL   18/08 CARREF');
    assert.equal(a, b, 'datas diferentes não podem gerar merchants diferentes');
  });

  it('preserva número que faz parte do nome', () => {
    // "2" aqui distingue a unidade — não é ruído.
    assert.equal(fingerprint('Compra no débito|PIZZARIA ALONZA 2'), 'PIZZARIA ALONZA 2');
  });

  it('não quebra com descrição vazia', () => {
    assert.equal(fingerprint(''), '');
  });

  it('preserva o rótulo quando ele é a descrição inteira', () => {
    // "Resgate RDB" (26x) e "Aplicação RDB" (5x) nos dados reais: se a limpeza
    // consome tudo, as duas operações colapsariam na mesma chave vazia.
    assert.equal(fingerprint('Resgate RDB'), 'RESGATE RDB');
    assert.equal(fingerprint('Aplicação RDB'), 'APLICACAO RDB');
    assert.notEqual(fingerprint('Resgate RDB'), fingerprint('Aplicação RDB'));
  });
});

describe('merchantKey', () => {
  it('prefere CNPJ, o identificador mais forte', () => {
    const t = tx({
      merchant: {
        name: 'Carrefour',
        businessName: 'CARREFOUR COM E IND LTDA',
        cnpj: '45543915000181',
        cnae: '4711302',
        category: 'Supermarket',
      },
    });
    assert.equal(merchantKey(t), 'cnpj:45543915000181');
  });

  it('usa a contraparte do PIX quando não há CNPJ', () => {
    const t = tx({
      amount: -50,
      paymentData: pixParties('111', '222', ['Eu', 'Rafaella Vitoria']),
    });
    assert.equal(merchantKey(t), 'party:RAFAELLA VITORIA');
  });

  it('cai na descrição quando não há nem CNPJ nem PIX', () => {
    assert.equal(merchantKey(tx({})), 'desc:CARREFOUR');
  });
});

describe('bestDisplayName', () => {
  it('escolhe o pagador quando o dinheiro entra', () => {
    const t = tx({ amount: 103.53, paymentData: pixParties('111', '222', ['Quem Pagou', 'Eu']) });
    assert.equal(bestDisplayName(t), 'Quem Pagou');
  });

  it('escolhe o recebedor quando o dinheiro sai', () => {
    const t = tx({ amount: -103.53, paymentData: pixParties('111', '222', ['Eu', 'Quem Recebeu']) });
    assert.equal(bestDisplayName(t), 'Quem Recebeu');
  });
});

// ─────────────────────────────────────────── transferências

describe('detecção de transferência interna', () => {
  it('identifica CPF igual dos dois lados', () => {
    assert.ok(isSelfTransferByDocument(tx({ paymentData: pixParties('12345678901', '12345678901') })));
  });

  it('ignora formatação diferente do mesmo CPF', () => {
    assert.ok(
      isSelfTransferByDocument(tx({ paymentData: pixParties('123.456.789-01', '12345678901') })),
    );
  });

  it('não marca transferência para terceiro', () => {
    assert.equal(
      isSelfTransferByDocument(tx({ paymentData: pixParties('12345678901', '99999999999') })),
      false,
    );
  });

  it('não marca quando falta o documento de um dos lados', () => {
    assert.equal(isSelfTransferByDocument(tx({ paymentData: null })), false);
  });

  it('casa as duas pernas entre contas diferentes', () => {
    const pairs = pairInternalTransfers([
      tx({ id: 'a', accountId: 'acc-1', amount: -103.53, date: '2026-08-22' }),
      tx({ id: 'b', accountId: 'acc-2', amount: 103.53, date: '2026-08-22' }),
    ]);
    assert.equal(pairs.size, 2);
    assert.equal(pairs.get('a'), pairs.get('b'), 'as duas pernas compartilham a chave');
  });

  it('NÃO casa duas saídas de mesmo valor no mesmo dia', () => {
    // Dois cafés de R$ 15 no mesmo dia não são transferência.
    const pairs = pairInternalTransfers([
      tx({ id: 'a', accountId: 'acc-1', amount: -15, date: '2026-08-22' }),
      tx({ id: 'b', accountId: 'acc-2', amount: -15, date: '2026-08-22' }),
    ]);
    assert.equal(pairs.size, 0);
  });

  it('NÃO casa movimentos dentro da mesma conta', () => {
    const pairs = pairInternalTransfers([
      tx({ id: 'a', accountId: 'acc-1', amount: -75.8, date: '2026-08-23' }),
      tx({ id: 'b', accountId: 'acc-1', amount: 75.8, date: '2026-08-23' }),
    ]);
    assert.equal(pairs.size, 0);
  });

  it('não reutiliza a mesma perna em dois pares', () => {
    const pairs = pairInternalTransfers([
      tx({ id: 'a', accountId: 'acc-1', amount: -50, date: '2026-08-22' }),
      tx({ id: 'b', accountId: 'acc-2', amount: 50, date: '2026-08-22' }),
      tx({ id: 'c', accountId: 'acc-2', amount: 50, date: '2026-08-22' }),
    ]);
    assert.equal(pairs.size, 2, 'só um par se forma; a terceira fica solta');
  });
});

// ─────────────────────────────────────────── categorias

describe('categorias', () => {
  it('traduz para PT-BR', () => {
    assert.equal(mapCategory('Groceries')?.name, 'Mercado');
    assert.equal(mapCategory('Gas stations')?.name, 'Combustível');
  });

  it('marca os baldes genéricos para a IA refinar', () => {
    assert.ok(needsAiRefinement('Shopping'), 'Shopping tem 45% das transações: sempre refinar');
    assert.ok(needsAiRefinement(null), 'sem categoria também vai para a IA');
    assert.equal(needsAiRefinement('Groceries'), false, 'categoria específica não precisa');
  });
});

// ─────────────────────────────────────────── integração

describe('mapTransactions', () => {
  const accountsById = new Map([
    ['acc-bank', bankAccount],
    ['acc-credit', creditAccount],
    ['acc-2', { ...bankAccount, id: 'acc-2' }],
  ]);

  it('exclui transferência interna dos totais', () => {
    const rows = mapTransactions(
      [
        tx({ id: 'gasto', amount: -100, category: 'Groceries' }),
        tx({ id: 'salario', amount: 3000, category: 'Salary' }),
        tx({
          id: 'transf-out',
          accountId: 'acc-bank',
          amount: -500,
          date: '2026-08-22',
          paymentData: pixParties('111', '111'),
        }),
        tx({
          id: 'transf-in',
          accountId: 'acc-2',
          amount: 500,
          date: '2026-08-22',
          paymentData: pixParties('111', '111'),
        }),
      ],
      accountsById,
    );

    const s = summarize(rows);
    assert.equal(s.incomeCents, 300_000, 'os R$ 500 transferidos não são receita');
    assert.equal(s.expenseCents, -10_000, 'nem despesa');
    assert.equal(s.transfers, 2);
  });

  it('normaliza o cartão de crédito no lote', () => {
    const rows = mapTransactions(
      [tx({ id: 'compra', accountId: 'acc-credit', amount: 75.8 })],
      accountsById,
    );
    assert.equal(rows[0]!.amountCents, -7580, 'compra no cartão é saída');
  });

  it('descarta transação órfã em vez de estourar', () => {
    const rows = mapTransactions([tx({ accountId: 'conta-inexistente' })], accountsById);
    assert.equal(rows.length, 0);
  });

  it('preserva o rótulo original junto com o traduzido', () => {
    const rows = mapTransactions([tx({ category: 'Gas stations' })], accountsById);
    assert.equal(rows[0]!.externalCategory, 'Gas stations');
    assert.equal(rows[0]!.categoryName, 'Combustível');
  });
});
