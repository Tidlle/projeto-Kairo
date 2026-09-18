/**
 * Kairo — teste de fumaça da API do Meu Pluggy
 *
 * Valida a premissa central do projeto: autenticar, listar as contas conectadas
 * e puxar as transações dos últimos 30 dias.
 *
 *   npm install
 *   cp .env.example .env      # preencha CLIENT_ID e CLIENT_SECRET
 *   npm run smoke
 *
 * Flags:
 *   --days=60     janela de transações (padrão: 30)
 *   --dump        salva o JSON bruto em ./out/ para inspeção
 *   --limit=5     quantas transações imprimir por conta (padrão: 5)
 *   --sync        força uma nova sincronização do item antes de ler (PATCH /items/{id})
 *                 e espera terminar. Use quando vier 0 transação.
 *
 * Docs: https://docs.pluggy.ai  ·  Guia: https://meu.pluggy.ai/api-guide
 */

import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = 'https://api.pluggy.ai';

// ---------------------------------------------------------------- tipos

type Account = {
  id: string;
  type: 'BANK' | 'CREDIT';
  subtype: string;
  name: string;
  number: string;
  balance: number;
  currencyCode: string;
  creditData?: { brand?: string; limit?: number; availableCreditLimit?: number };
};

type Transaction = {
  id: string;
  description: string;
  descriptionRaw: string | null;
  amount: number;
  currencyCode: string;
  date: string;
  type: 'DEBIT' | 'CREDIT';
  status: 'POSTED' | 'PENDING';
  category: string | null;
  categoryId: string | null;
  merchant?: { name?: string; businessName?: string } | null;
  accountId: string;
};

type Item = {
  id: string;
  status: string;
  executionStatus: string;
  lastUpdatedAt: string | null;
  connector: { id: number; name: string; institutionUrl?: string };
  error?: { code: string; message: string } | null;
};

// ---------------------------------------------------------------- utilidades

const args = process.argv.slice(2);
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const has = (name: string) => args.includes(`--${name}`);

const DAYS = Number(flag('days') ?? 30);
const PRINT_LIMIT = Number(flag('limit') ?? 5);
const DUMP = has('dump');
const SYNC = has('sync');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const brl = (n: number, currency = 'BRL') =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(n);

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

const c = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
};

/** Lê o .env sem depender de pacote externo. */
function loadEnv() {
  const file = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    const key = m?.[1];
    if (!key) continue;
    const value = (m?.[2] ?? '').trim().replace(/^(['"])(.*)\1$/, '$2');
    if (!(key in process.env)) process.env[key] = value;
  }
}

class PluggyError extends Error {
  constructor(readonly status: number, readonly path: string, readonly body: string) {
    super(`HTTP ${status} em ${path}\n${body}`);
  }
}

// ---------------------------------------------------------------- cliente

let apiKey = '';

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'X-API-KEY': apiKey } : {}),
      ...init.headers,
    },
  });

  const text = await res.text();
  if (!res.ok) throw new PluggyError(res.status, path, text.slice(0, 800));
  return text ? (JSON.parse(text) as T) : ({} as T);
}

/** POST /auth — troca clientId/clientSecret por uma apiKey (válida por ~2h). */
async function authenticate(clientId: string, clientSecret: string) {
  const { apiKey: key } = await api<{ apiKey: string }>('/auth', {
    method: 'POST',
    body: JSON.stringify({ clientId, clientSecret }),
  });
  apiKey = key;
}

const fetchItem = (itemId: string) => api<Item>(`/items/${itemId}`);

/**
 * PATCH /items/{id} sem body — dispara nova sincronização usando as credenciais
 * já armazenadas. No ambiente de desenvolvimento o sync automático não roda,
 * então essa é a forma de forçar a coleta.
 */
async function syncItem(itemId: string) {
  await api<Item>(`/items/${itemId}`, { method: 'PATCH', body: JSON.stringify({}) });

  // espera sair do estado "UPDATING" (até ~2min)
  for (let i = 0; i < 40; i++) {
    await sleep(3000);
    const item = await fetchItem(itemId);
    if (item.status !== 'UPDATING') return item;
    process.stdout.write('.');
  }
  return fetchItem(itemId);
}

/** GET /accounts?itemId= — resposta paginada com { results }. */
const fetchAccounts = (itemId: string) =>
  api<{ results: Account[] }>(`/accounts?itemId=${itemId}`).then((r) => r.results ?? []);

/**
 * GET /v2/transactions — paginação por cursor.
 * O endpoint /transactions (por página) está depreciado e sai em 31/12/2026.
 * `next` volta como query string pronta; extraímos o `after` dela para o próximo pedido.
 */
async function fetchTransactions(accountId: string, dateFrom?: string, dateTo?: string) {
  const all: Transaction[] = [];
  let after: string | undefined;

  do {
    const qs = new URLSearchParams({ accountId });
    if (dateFrom) qs.set('dateFrom', dateFrom);
    if (dateTo) qs.set('dateTo', dateTo);
    if (after) qs.set('after', after);

    const page = await api<{ results: Transaction[]; next: string | null }>(
      `/v2/transactions?${qs}`,
    );
    all.push(...(page.results ?? []));

    after = page.next ? extractCursor(page.next) : undefined;
  } while (after);

  return all;
}

/** `next` pode vir como query string completa ou como o cursor cru. */
function extractCursor(next: string): string | undefined {
  if (!next.includes('=')) return next;
  const qs = new URLSearchParams(next.replace(/^[^?]*\??/, ''));
  return qs.get('after') ?? undefined;
}

// ---------------------------------------------------------------- relatório

/**
 * Normaliza o sinal para a convenção do Kairo: saída negativa, entrada positiva.
 *
 * Em conta bancária a Pluggy já usa essa convenção. Em CARTÃO DE CRÉDITO ela
 * inverte: amount positivo = nova compra (aumenta a dívida), negativo = pagamento
 * da fatura. Sem essa normalização o cartão aparece como se fosse renda.
 */
const normalizedAmount = (t: Transaction, accountType: Account['type']) =>
  accountType === 'CREDIT' ? -t.amount : t.amount;

function summarize(txs: Transaction[], accountType: Account['type']) {
  const posted = txs.filter((t) => t.status !== 'PENDING');
  const values = posted.map((t) => normalizedAmount(t, accountType));

  const income = values.filter((v) => v > 0).reduce((s, v) => s + v, 0);
  const expense = values.filter((v) => v < 0).reduce((s, v) => s + v, 0);

  const byCategory = new Map<string, number>();
  for (const t of posted) {
    const value = normalizedAmount(t, accountType);
    if (value >= 0) continue;
    const key = t.category ?? 'Sem categoria';
    byCategory.set(key, (byCategory.get(key) ?? 0) + Math.abs(value));
  }

  const top = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  return { income, expense, top, pending: txs.length - posted.length };
}

function printTransactions(txs: Transaction[], currency: string, accountType: Account['type']) {
  for (const t of txs.slice(0, PRINT_LIMIT)) {
    const amount = normalizedAmount(t, accountType);
    const value = brl(amount, currency).padStart(14);
    const colored = amount < 0 ? c.red(value) : c.green(value);
    const label = (t.merchant?.name || t.description || t.descriptionRaw || '—').slice(0, 42);
    const tag = t.category ? c.dim(` · ${t.category}`) : '';
    const pending = t.status === 'PENDING' ? c.yellow(' [pendente]') : '';
    console.log(`     ${t.date.slice(0, 10)}  ${colored}  ${label}${tag}${pending}`);
  }
  if (txs.length > PRINT_LIMIT) {
    console.log(c.dim(`     … e mais ${txs.length - PRINT_LIMIT} transações`));
  }
}

function dump(name: string, data: unknown) {
  if (!DUMP) return;
  fs.mkdirSync('out', { recursive: true });
  const file = `out/${name}.json`;
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  console.log(c.dim(`     ↳ salvo em ${file}`));
}

// ---------------------------------------------------------------- main

async function main() {
  loadEnv();

  const clientId = process.env.PLUGGY_CLIENT_ID;
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET;
  const itemIds = (process.env.PLUGGY_ITEM_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (!clientId || !clientSecret) {
    console.error(c.red('\n✗ Faltam credenciais.\n'));
    console.error('  1. Crie o .env a partir do .env.example');
    console.error('  2. Pegue CLIENT_ID e CLIENT_SECRET em https://dashboard.pluggy.ai');
    console.error('     (Aplicações → sua aplicação demo)\n');
    process.exitCode = 1;
    return;
  }

  if (!itemIds.length) {
    console.error(c.red('\n✗ Nenhum PLUGGY_ITEM_ID informado.\n'));
    console.error('  Cada banco conectado no Meu Pluggy vira um "item".');
    console.error('  Pegue os IDs em https://meu.pluggy.ai (nas suas conexões) e coloque no .env:');
    console.error(c.dim('     PLUGGY_ITEM_IDS=uuid-do-banco-1,uuid-do-banco-2\n'));
    process.exitCode = 1;
    return;
  }

  const to = new Date();
  const from = new Date(to.getTime() - DAYS * 86_400_000);

  console.log(c.bold('\n  Kairo · teste de fumaça do Meu Pluggy'));
  console.log(c.dim(`  janela: ${isoDate(from)} → ${isoDate(to)} (${DAYS} dias)\n`));

  // 1. autenticação
  console.log('  [1/3] autenticando…');
  await authenticate(clientId, clientSecret);
  console.log(`        ${c.green('ok')}${c.dim(` (apiKey ${apiKey.slice(0, 8)}…)`)}`);

  // 2. items conectados
  console.log(`  [2/3] ${itemIds.length} conexão(ões) para verificar`);

  let grandIncome = 0;
  let grandExpense = 0;
  let totalTx = 0;
  let accountCount = 0;
  let resolvedItems = 0;

  for (const itemId of itemIds) {
    let item: Item;
    try {
      item = await fetchItem(itemId);
    } catch (err) {
      if (err instanceof PluggyError && err.status === 404) {
        console.log(`\n  ${c.red('✗')} item ${itemId} não existe nesta aplicação`);
        continue;
      }
      throw err;
    }
    resolvedItems++;

    if (SYNC) {
      process.stdout.write(`\n  ⟳ sincronizando ${item.connector.name}`);
      item = await syncItem(itemId);
      console.log('');
    }

    const health = item.executionStatus === 'SUCCESS' ? c.green('●') : c.yellow('●');
    const synced = item.lastUpdatedAt
      ? new Date(item.lastUpdatedAt).toLocaleString('pt-BR')
      : c.yellow('nunca');

    console.log(`\n  ${health} ${c.bold(item.connector.name)} ${c.dim(`· sync: ${synced}`)}`);
    console.log(c.dim(`     status: ${item.status} · execução: ${item.executionStatus}`));
    if (item.error) console.log(`     ${c.yellow(`aviso: ${item.error.message}`)}`);
    if (item.status === 'WAITING_USER_INPUT') {
      console.log(c.yellow('     ⚠ o banco está pedindo ação sua (MFA/token) — resolva em meu.pluggy.ai'));
    }
    if (item.status === 'LOGIN_ERROR' || item.status === 'OUTDATED') {
      console.log(c.yellow('     ⚠ conexão precisa ser refeita em meu.pluggy.ai'));
    }
    dump(`item-${itemId}`, item);

    // 3. contas e transações
    const accounts = await fetchAccounts(itemId);
    dump(`accounts-${itemId}`, accounts);
    accountCount += accounts.length;

    if (!accounts.length) {
      console.log(
        c.yellow('     nenhuma conta retornada') +
          c.dim(' → o item existe mas não coletou dados. Rode com --sync'),
      );
      continue;
    }

    for (const acc of accounts) {
      const kind = acc.type === 'CREDIT' ? 'cartão' : acc.subtype === 'SAVINGS_ACCOUNT' ? 'poupança' : 'conta';
      const limit = acc.creditData?.limit ? c.dim(` · limite ${brl(acc.creditData.limit)}`) : '';
      console.log(
        `\n     ${c.cyan(acc.name)} ${c.dim(`(${kind} ${acc.number})`)}` +
          `  saldo ${c.bold(brl(acc.balance, acc.currencyCode))}${limit}`,
      );

      const txs = await fetchTransactions(acc.id, isoDate(from), isoDate(to));
      dump(`transactions-${acc.id}`, txs);
      totalTx += txs.length;

      if (!txs.length) {
        // Diagnóstico: existe transação nessa conta fora da janela pedida?
        // A Pluggy coleta até 12 meses, então isso separa "janela errada"
        // de "item ainda não sincronizou".
        const any = await fetchTransactions(acc.id);
        if (any.length) {
          const dates = any.map((t) => t.date.slice(0, 10)).sort();
          console.log(
            c.yellow(
              `     sem transações nos últimos ${DAYS} dias, mas a conta tem ${any.length} ` +
                `entre ${dates[0]} e ${dates[dates.length - 1]}`,
            ),
          );
          console.log(c.dim(`     → tente: npm run smoke -- --days=365`));
        } else {
          console.log(
            c.yellow('     nenhuma transação nesta conta em nenhum período') +
              c.dim(' → rode com --sync'),
          );
        }
        continue;
      }

      const { income, expense, top, pending } = summarize(txs, acc.type);
      grandIncome += income;
      grandExpense += expense;

      console.log(
        c.dim(
          `     ${txs.length} transações` +
            (pending ? ` (${pending} pendentes)` : '') +
            ` · entradas ${brl(income)} · saídas ${brl(Math.abs(expense))}`,
        ),
      );

      printTransactions(txs, acc.currencyCode, acc.type);

      if (top.length) {
        const line = top.map(([cat, v]) => `${cat} ${brl(v)}`).join(c.dim(' · '));
        console.log(c.dim(`     top categorias: ${line}`));
      }
    }
  }

  // resumo final
  console.log(c.bold('\n  ─── resumo ───'));
  console.log(`  ${accountCount} contas · ${totalTx} transações em ${DAYS} dias`);
  console.log(`  entradas ${c.green(brl(grandIncome))} · saídas ${c.red(brl(Math.abs(grandExpense)))}`);
  console.log(`  resultado ${c.bold(brl(grandIncome + grandExpense))}\n`);

  if (totalTx > 0) {
    console.log(c.green('  ✓ A premissa do Kairo está validada: os dados chegam.\n'));
  } else if (resolvedItems === 0) {
    // Causa mais comum: as conexões existem no Meu Pluggy, mas nunca foram
    // vinculadas a esta aplicação. O id que aparece na URL do Meu Pluggy
    // (/connections/<uuid>) NÃO é o itemId — o item só nasce após o vínculo.
    console.log(c.yellow('  ! Nenhum item encontrado nesta aplicação.\n'));
    console.log('    Conectar o banco no Meu Pluggy não basta: é preciso vincular');
    console.log('    a conexão à sua aplicação do Dashboard. Uma vez por banco:\n');
    console.log(`      1. ${c.cyan('https://dashboard.pluggy.ai')} → abra sua aplicação → "Ir para Demo"`);
    console.log('      2. Escolha o conector ' + c.bold('MeuPluggy'));
    console.log('      3. Faça login na sua conta Meu Pluggy e autorize o acesso');
    console.log('      4. No menu de três pontos da conexão → ' + c.bold('"Copiar Item ID"'));
    console.log(`      5. Cole esse ID (não o da URL do Meu Pluggy) em ${c.cyan('PLUGGY_ITEM_IDS')}\n`);
  } else {
    console.log(c.yellow('  ! Conectou, mas não veio transação. Na ordem:\n'));
    console.log('    1. Force uma sincronização:  ' + c.cyan('npm run smoke -- --sync'));
    console.log('    2. Amplie a janela:          ' + c.cyan('npm run smoke -- --days=365'));
    console.log('    3. Confira o status acima: se for LOGIN_ERROR, OUTDATED ou');
    console.log('       WAITING_USER_INPUT, refaça a conexão em https://meu.pluggy.ai');
    console.log('    4. Inspecione o retorno cru: ' + c.cyan('npm run smoke -- --dump') + '\n');
  }
}

main().catch((err) => {
  // process.exitCode em vez de process.exit(): deixa o stdout terminar de
  // escrever antes de sair (process.exit no meio de um write trava no Windows).
  process.exitCode = 1;

  if (!(err instanceof PluggyError)) {
    console.error(c.red('\n✗ Erro inesperado:'), err);
    return;
  }

  console.error(c.red(`\n✗ ${err.message}\n`));

  switch (err.status) {
    case 400:
      console.error('  A API rejeitou o payload. O CLIENT_ID e o CLIENT_SECRET são UUIDs —');
      console.error('  confira se você copiou os valores certos do Dashboard, sem espaços.\n');
      break;
    case 401:
    case 403:
      console.error('  Credenciais inválidas ou apiKey expirada (dura ~2h).');
      console.error('  Confira CLIENT_ID/CLIENT_SECRET em https://dashboard.pluggy.ai\n');
      break;
    case 429:
      console.error('  Limite de requisições atingido. Espere alguns minutos e tente de novo.\n');
      break;
  }
});
