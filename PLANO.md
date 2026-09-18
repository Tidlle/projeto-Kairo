# Kairo — Plano de Projeto

> **Kairo** — *seu dinheiro e seus dias no mesmo lugar.*
> App de gestão diária: finanças pessoais completas + rotina (tarefas, cronograma, hábitos), rodando em desktop e mobile com uma única base de código.

**Escopo definido: uso pessoal.** O app é para o próprio usuário (um CPF), não é produto comercial. Isso simplifica bastante o projeto — sem CNPJ, sem multi-tenancy, sem compliance de LGPD para terceiros — e, principalmente, **destrava a conexão bancária via Open Finance de graça** (seção 7).

---

## 1. O que foi extraído do vídeo (TrilhaIA)

Análise do vídeo `exemplo_trilhaIA.mp4` (2min25s, Reel do @yansampaio, parceria paga com trilha.ia). Funcionalidades demonstradas:

| # | Funcionalidade | Fala / evidência no vídeo |
|---|---|---|
| 1 | **Conexão bancária via Open Finance** | "eu conecto minhas contas bancárias através do Open [Finance] — tudo regulamentado pelo Banco Central" |
| 2 | **Importação automática de transações** | "automaticamente todas as minhas transações já aparecem dentro do aplicativo — tudo que eu gasto no cartão, Pix, assinaturas já entra automaticamente dentro do dashboard" |
| 3 | **Dashboard de entradas x saídas** | Tela: saldo R$ 682,22, gráfico de barras verde/vermelho por mês |
| 4 | **Donut de categorias + ranking** | Tela: rosca com % + lista lateral de categorias |
| 5 | **Gasto médio mensal** | Tela: "R$ 834,74 média" com linha de tendência |
| 6 | **Heatmap de calendário (dia a dia)** | Tela: grade de dias verde/amarelo/vermelho conforme o saldo diário |
| 7 | **Contas e cartões** | "aqui em contas eu consigo cadastrar todos os meus cartões, ter controle das faturas e do meu limite de crédito" |
| 8 | **Investimentos / patrimônio** | "aqui na parte dos investimentos consigo ter uma ideia de todo meu patrimônio... em quais ações ele está aportado, no meu caso renda fixa" |
| 9 | **Gestão de assinaturas** | "muitas pessoas acham que assinam poucas coisas... aqui você tem noção de quanto tá gastando com assinaturas — ele mostra todas elas" |
| 10 | **Categorização automática com IA** | "ele identifica automaticamente com inteligência artificial e já faz a categorização de tudo que você gastou: serviços, alimentação, compras online, assinaturas — em um só lugar" |
| 11 | **Metas & Sonhos** | Tela "Metas & Sonhos": objetivo (apartamento em Fortaleza, categoria imóvel), valor-alvo R$ 800 mil, acumulado R$ 350 mil, aporte R$ 5.000/mês |
| 12 | **Projeção de meta** | "falta R$ 450 mil, meu progresso está em 44%; guardando 5 mil por mês, em 90 meses eu conquisto o objetivo" |
| 13 | ~~Visualização do sonho por IA (foto do rosto)~~ | "eu adiciono uma foto do meu rosto pra ele gerar uma imagem do meu sonho" — **fora do escopo do Kairo por decisão do projeto** |

**Tese central do produto (que vale herdar):**
> "Riqueza não começa com você ganhando mais — começa com você controlando melhor o que você tem." E a metáfora do balde furado: *enquanto você não tapar o furo, ele sempre vai continuar esvaziando.*

**O que o TrilhaIA NÃO faz** — e é exatamente a nossa brecha: ele para no dinheiro. Não tem tarefas, agenda, hábitos, rotina. É um painel financeiro, não um sistema de vida.

---

## 2. Nome e posicionamento

### Sugestão principal: **Kairo**

De *kairós* (καιρός) — o **momento certo**, em oposição a *chronos*, o tempo que só passa. Encaixa perfeitamente num app que junta "o que fazer hoje" com "para onde meu dinheiro está indo".

- 5 letras, uma sílaba tônica clara, fácil de falar e escrever em PT-BR
- Não é palavra comum → domínio e marca mais fáceis de defender
- Neutro: não amarra a app "de finanças" nem a app "de tarefas"
- Tagline: **"Seu dinheiro e seus dias no mesmo lugar."**

### Alternativas

| Nome | Ideia | Observação |
|---|---|---|
| **Norte** | "achar o seu norte" | Muito bom em PT-BR, mas nome comum → SEO/domínio disputado |
| **Órbita** | dinheiro e rotina girando em torno das suas metas | Forte visualmente, ótimo para o logo |
| **Cadência** | ritmo diário sustentável | Bonito, porém longo |
| **Rumo** | direção + progresso | Curto e direto, mas genérico |

> Verificar antes de fechar: domínio (`kairo.app` / `usekairo.com` / `kairo.com.br`), registro INPI classe 9/42, e handles nas redes.

---

## 3. Proposta de valor: o diferencial real

Existem centenas de apps de finanças e milhares de to-do lists. O que quase ninguém faz é **conectar os dois**. É aí que o Kairo vive:

```
        FINANÇAS  ←──── ponte ────→  ROTINA
   "gastei R$ 340 em delivery"    "meta: cozinhar 4x/semana"
   "fatura vence dia 10"          "tarefa: pagar fatura" (auto)
   "meta: apartamento em 90 meses" "hábito: aportar R$ 5.000 dia 5"
```

Cinco pontes concretas (o coração do produto):

1. **Compromisso → Tarefa.** Toda conta a pagar, fatura e assinatura recorrente vira automaticamente um item na agenda e na lista do dia, com lembrete.
2. **Meta → Hábito.** Ao criar "apartamento em 90 meses / R$ 5.000 por mês", o app cria o hábito recorrente "aportar dia 5" e cobra no dia.
3. **Tarefa → Gasto.** Tarefas podem ter custo estimado ("consulta veterinário — R$ 250"), então a agenda vira uma previsão de fluxo de caixa das próximas semanas.
4. **Gasto → Insight de rotina.** "Você gasta R$ 480/mês em delivery, sempre nos dias em que a tarefa 'cozinhar' fica atrasada." Ninguém entrega isso hoje.
5. **Painel único do dia.** Uma tela "Hoje": saldo, o que vence, as 3 tarefas prioritárias, os hábitos do dia, e o progresso da meta principal.

---

## 4. Escopo funcional

### Pilar A — Financeiro (paridade com o TrilhaIA + extras)

- **Contas e cartões**: contas correntes, poupança, carteiras, cartões de crédito com limite, fatura, dia de fechamento/vencimento
- **Transações**: entrada/saída/transferência, parcelamento, recorrência, anexo de comprovante, split entre categorias
- **Categorização automática por IA** com aprendizado das correções do usuário (regra criada a partir do "descategorizei X → sempre Y")
- **Dashboard**: saldo consolidado, entradas x saídas por mês, donut de categorias, gasto médio mensal, heatmap de calendário (dia verde/vermelho)
- **Assinaturas**: detecção automática de cobranças recorrentes, custo mensal e anual total, alerta de aumento de preço, alerta de assinatura não usada
- **Orçamento (envelopes)** por categoria, com alerta de estouro — *o "tapar o furo do balde"*
- **Metas**: valor-alvo, acumulado, aporte mensal, % de progresso, projeção de meses restantes, imagem de capa escolhida pelo usuário
- **Investimentos e patrimônio**: posições (renda fixa, ações, FIIs, cripto), valor de mercado, rentabilidade, alocação, patrimônio líquido total
- **Relatórios**: mensal, anual, por categoria, exportação CSV/PDF

### Pilar B — Rotina / Dia a dia

- **Tarefas**: projetos, subtarefas, prioridade, prazo, tags, recorrência, anotações
- **Hoje**: visão do dia com tarefas, compromissos, hábitos e vencimentos financeiros
- **Cronograma / Agenda**: visão dia/semana/mês, time-blocking, sincronização com Google Calendar
- **Hábitos**: streaks, frequência (diária/semanal/x vezes por semana), heatmap anual
- **Notas rápidas** e checklists
- **Rotinas**: blocos-modelo de dia ("manhã produtiva") aplicáveis à agenda
- **Foco**: timer Pomodoro com registro de tempo por projeto

### Pilar C — Inteligência (a camada que amarra tudo)

- **Resumo diário** ("bom dia"): o que vence, o que fazer, como está o mês
- **Retrospectiva semanal**: onde o dinheiro foi, o que ficou pendente, o que ajustar
- **Insights cruzados** finanças ↔ rotina (item 4 da seção 3)
- **Chat com seus dados**: "quanto gastei com iFood em maio?", "reagenda minhas tarefas de sexta"
- **Criação por linguagem natural**: "almoço com a Ana quinta 12h, uns 80 reais" → cria evento + gasto previsto

---

## 5. Arquitetura e stack

### Requisito central: um app, desktop e mobile

**Recomendação: monorepo com Expo (React Native + React Native Web) + Tauri.**

✅ **Decisão tomada em 26/08/2026: mobile + web primeiro**, exatamente este caminho — Expo agora, Tauri depois para desktop. Já implementado e validado (ver seção 5 → *[Implementado: apps/mobile e a tela Hoje](#implementado-appsmobile-e-a-tela-hoje)*).

```
Uma base de código React/TypeScript
        │
        ├── iOS / Android      →  Expo (React Native)
        ├── Web / PWA          →  Expo Web (react-native-web)
        └── Windows / macOS    →  Tauri empacotando o build web (~5 MB, nativo)
```

Por que esse caminho:
- **Um código só** para as 5 plataformas — crítico para um projeto de time pequeno
- Expo Router dá roteamento universal (file-based) igual em todas
- Tauri (Rust) gera binário desktop leve e com acesso a filesystem/notificações nativas — bem menor e mais rápido que Electron
- Se o desktop for prioridade máxima e o mobile secundário, a inversão vale: **Next.js (PWA) + Tauri** para web/desktop e Expo só depois

**Alternativa considerada:** Flutter cobre as 5 plataformas nativamente e é excelente, mas fecha o ecossistema (menos bibliotecas de finanças/gráficos prontas em Dart) e obriga a reescrever caso um dia se queira web SEO-friendly. Fica como plano B.

### Stack detalhada

| Camada | Escolha | Motivo |
|---|---|---|
| Linguagem | **TypeScript** (strict) | Tipos ponta a ponta, do banco à UI |
| UI mobile/web | **Expo SDK + Expo Router** | ✅ **`apps/mobile` no ar**, rodando em Expo Web; universal, OTA updates, build na nuvem (EAS) fica para quando iOS/Android forem testados |
| Desktop | ✅ **Tauri 2** | **`apps/desktop` no ar, com banco funcional** — janela nativa, SQLite de verdade via plugin do Tauri (`sqlx`/Rust) + Drizzle por proxy, `.msi`/`.exe` gerados, ~9 MB o binário. Detalhe abaixo. |
| Design system | **Tamagui** ou **NativeWind** | Estilo compartilhado entre RN e Web |
| Gráficos | **Victory Native XL** (mobile) / **Recharts** (web) | Barras, donut, linha, heatmap |
| Estado servidor | **TanStack Query** | Cache, retry, persistência offline |
| Estado local | **Zustand** | Simples, sem boilerplate |
| Banco local | ✅ **SQLite** (`expo-sqlite` + Drizzle) no app, schema+migração+seed+testes prontos · **PGlite** no runner Node | Offline-first de verdade — [detalhe abaixo](#implementado-persistência-local-sqlite-no-appsmobile) |
| Backend | **Supabase** (Postgres + Auth + Storage + Realtime + Edge Functions) | Entrega em semanas, não meses; RLS por usuário |
| Sincronização | Fila de mutações local → push/pull com `updated_at` + resolução last-write-wins por campo | Funciona no metrô sem sinal |
| Jobs/agendamento | Supabase Cron (`pg_cron` + `pg_net`) + Edge Function `sync` | ✅ **No ar desde 26/08/2026** — `kairo-sync-diario`, 09:00 UTC (06h Brasília), rodando sozinho |
| IA | **Claude API** (`claude-opus-5`) | Categorização, insights, chat com dados |
| Open Finance | **Meu Pluggy** (grátis para uso pessoal) | Ver seção 7 — conecta 99+ bancos, sem CNPJ |
| Erros/analytics | Sentry + PostHog | |

### Segurança (não negociável — o app guarda os seus dados financeiros)

Sendo uso pessoal, a **LGPD não se aplica** (art. 4º, I — tratamento por pessoa natural para fins exclusivamente particulares e não econômicos). Mas segurança continua valendo, porque o alvo aqui é você mesmo:

- **`CLIENT_ID` e `CLIENT_SECRET` do Pluggy nunca no app cliente.** Eles ficam só na Edge Function do servidor; o app fala com a sua API, nunca direto com o Pluggy
- ✅ **Implementado:** segredos via `supabase secrets set` (não ficam em texto no repo, só no `.env` local, que está no `.gitignore`) — a Edge Function os lê como variável de ambiente em runtime, nunca aparecem em log nem em resposta de API
- RLS no Postgres mesmo com um único usuário (custa nada e evita erro bobo)
- Biometria para abrir o app (FaceID / Touch ID / Windows Hello)
- Nenhum dado sensível em log; nada de valores ou identificadores em URL
- Backup automático do Postgres + exportação periódica em JSON/CSV para uma pasta sua

### Implementado: camada de escrita e sincronização

> Código em [`packages/db/src/`](packages/db/src) (`ingest.ts`, `sync.ts`, `client.ts`, `local.ts`) · runner em [`scripts/sync.ts`](scripts/sync.ts) · cron em [`supabase/functions/sync/`](supabase/functions/sync) e [`supabase/migrations/20260826000100_cron_sync.sql`](supabase/migrations/20260826000100_cron_sync.sql).

**Primeira sincronização real rodou em 26/08/2026: 608 transações gravadas, e a segunda execução deu 0 novas / 608 atualizadas** — idempotência provada contra os próprios dados, não contra fixture. `npm run sync` grava num banco **PGlite local** (`data/kairo`, Postgres real compilado para WASM); `npm run sync -- --remote` usa o Supabase via `DATABASE_URL`. Mesmo `runSync()` nos dois casos — só muda quem instancia a conexão.

**A regra que organiza toda a escrita:** rodar o sync duas vezes não pode duplicar nada, nem apagar o que você editou à mão. Na prática isso virou uma linha divisória em cada tabela — campos que a origem controla são sempre sobrescritos; campos seus nunca são tocados:

| Sempre da origem | Sempre seu |
|---|---|
| valor, data, status, descrição crua | anotações, tags, vínculo com tarefa/meta |
| saldo e limite da conta | apelido da conta |
| categoria da Pluggy | categoria travada (`category_locked`) |
| — | nome de merchant fixado (`is_pinned`) |

Validado com **PGlite em vez de mock** — Postgres real, então `on conflict do update`, `excluded.*` e os índices únicos são exercitados de verdade. 11 testes em [`packages/db/test/ingest.test.ts`](packages/db/test/ingest.test.ts), incluindo idempotência, preservação de categoria travada e as duas pernas de uma transferência interna.

**Três bugs que só apareceram rodando contra dados reais** (nenhum teste sintético os teria previsto):

1. **`sql\`= any(\${array})\`` gera SQL inválido.** O template do Drizzle expande o array em parâmetros soltos — `any(($1, $2, …))` é um construtor de linha, não um array, e o Postgres rejeita. Só aparece com volume (588 ids); com 1 ou 2 o bug fica invisível. Trocado por `inArray()`, fatiado em lotes de 1000.
2. **Transferência entre bancos diferentes não casava.** O sync processa um item (banco) por vez, para que a falha de um não derrube os outros — então as duas pernas de uma transferência (saindo do Santander, entrando no Nubank) nunca estão na mesma memória. Resolvido com uma passada SQL (`pairTransfersAcrossAccounts`) rodada depois que todos os items terminam.
3. **Essa própria correção nasceu errada.** A primeira versão comparava `b.id > a.id` para não casar o mesmo par duas vezes — e isso descartava pares onde a perna positiva tinha uuid menor: deu 2 pares em vez dos 3 esperados. Só ficou visível porque o [ensaio offline](#resultado-do-pipeline-de-ingestão-medido-não-estimado) já tinha medido 3 antes — sem esse número de referência, 2 pareceria plausível.

**Atualização 26/08/2026 — Supabase em produção, cron ativo.** O projeto foi criado (por você — cadastro/login é ação de conta, não se automatiza por terceiro), `db:migrate` e `sync -- --remote` já rodaram contra ele. A tentativa inicial de usar o Supabase local via CLI esbarrou em Docker (Docker Desktop instalado mas travando numa tela interativa, provavelmente WSL/licença) — o PGlite local seguiu sendo o caminho de desenvolvimento sem essa dependência, e continua sendo útil para isso.

**Deploy da Edge Function `sync` — três tentativas, três bugs reais, cada um só visível tentando de verdade:**

1. **Bare imports não resolvem no Deno.** `schema.ts` e `ingest.ts` importam `from 'drizzle-orm/pg-core'` — convenção Node, que o bundler do Deno rejeita sem mapa explícito. Resolvido com [`supabase/functions/sync/import_map.json`](supabase/functions/sync/import_map.json).
2. **O empacotador da Supabase não mapeia `.js` → `.ts`.** Diferente do `tsx` (usado localmente), que entende a convenção TypeScript de escrever `.js` para importar um `.ts` (`moduleResolution: "bundler"`), o uploader da Supabase procura o arquivo `.js` literal e falha ao não achar. **Correção: 41 imports relativos em 13 arquivos** trocados de `.js` para `.ts`, com `allowImportingTsExtensions: true` no `tsconfig.json` — mudança que afeta os dois lados (Node e Deno), revalidada com type-check e os 40 testes antes do redeploy.
3. **JWT da plataforma bloqueia antes mesmo do código rodar.** O Supabase exige `Authorization` (JWT) por padrão em toda função, além do `x-sync-secret` que a própria função já valida — primeiro teste real deu `401 UNAUTHORIZED_NO_AUTH_HEADER` sem nunca chegar ao handler. Resolvido com `--no-verify-jwt` no deploy: a autenticação por segredo próprio, já desenhada, passa a ser a única camada — redundância removida, não adicionada.

Um quarto bug apareceu aplicando o SQL do cron: um split ingênuo em `;` para rodar a migração via `postgres.js` quebrava o corpo `$$...$$` da função (que tem `;` internos). Corrigido enviando o arquivo inteiro como uma única instrução — o Postgres processa múltiplos statements nativamente.

**Estado confirmado por consulta direta ao banco, não só pelo retorno dos comandos:**

```
kairo-sync-diario | 0 9 * * * | active: true     -- 09:00 UTC = 06h Brasília
608 transações · 0 duplicatas · 0 conexões com problema
```

Durante os testes, o histórico de `sync_runs` mostrou execuções em horários que não correspondiam a nenhuma chamada feita aqui — sinal de que alguém rodou `sync -- --remote` em paralelo, noutro terminal. Sem explicação completa sobre a causa, mas com o resultado que importa: zero duplicatas, contagem final idêntica à local. **A garantia de idempotência do design se sustentou sob execução concorrente não planejada — o teste mais duro que ela já passou.**

### Implementado: apps/mobile e a tela Hoje

> Código em [`apps/mobile/`](apps/mobile) (Expo + Expo Router) · lógica de domínio em [`packages/core/src/domain.ts`](packages/core/src/domain.ts) · tela em [`apps/mobile/src/app/index.tsx`](apps/mobile/src/app/index.tsx).

**Workspaces configurados.** `packages/core` e `packages/db` viraram pacotes de verdade (`@kairo/core`, `@kairo/db`), instalados via `npm install` na raiz — `apps/mobile` importa `@kairo/core` como qualquer dependência, sem duplicar código. O cliente HTTP da Pluggy (`authenticate`, `createPluggyClient`) fica **de fora do barril de exportação** de propósito: espera `CLIENT_SECRET`, que é segredo de servidor — o app nunca deve falar com a Pluggy direto.

**A ponte apps/mobile → packages/core, provada por execução, não por suposição.** O Metro (empacotador do React Native) não enxerga por padrão nada fora da pasta do app — precisou de `watchFolders`/`nodeModulesPaths` apontando para a raiz do monorepo ([`metro.config.js`](apps/mobile/metro.config.js)). Depois de configurado, subi o Expo Web de verdade e li o texto renderizado da página: `formatBRL`, `fingerprint` e `mapCategory` — as mesmas funções já validadas contra as 608 transações reais do Pluggy — executaram dentro do bundle do React Native e produziram o resultado certo.

**O mesmo bug do deploy Deno, reaparecendo em outro lugar.** `npx tsc --noEmit` dentro de `apps/mobile` falhou com `TS5097` — os imports com extensão `.ts` explícita de `packages/core` (necessários para o deploy da Edge Function, seção anterior) exigem `allowImportingTsExtensions: true` em **todo** `tsconfig.json` que os type-checar. O Metro não reclamou (processa via Babel, mais permissivo); o `tsc` reclamou. Corrigido no `tsconfig.json` do app. **Padrão que se repetiu:** qualquer novo ambiente que consumir `packages/core` vai precisar da mesma flag — vale checar de saída da próxima vez, não descobrir de novo pelo erro.

**A tela "Hoje" — os cinco blocos que o plano já descrevia:** saldo, o que vence hoje, as 3 tarefas prioritárias, hábitos com streak, meta principal com progresso. Antes de tocar em UI, a lógica foi para `packages/core/src/domain.ts` — `topPriorityTasks`, `goalProgressPct`, `monthsToGoal`, `streakLabel`, `needsAttention` — com 17 testes, seguindo a mesma regra de ouro do resto do pacote (puro, sem UI, sem rede).

**Um teste pegou um bug antes da tela existir.** `streakLabel` sempre devolvia "seguidos" (plural), mesmo para 1 dia — o teste `singular em 1 dia` falhou com `'1 dia seguidos'` antes de qualquer renderização acontecer. Corrigido, e confirmado depois na tela real: "comece hoje" no streak zero, plural certo nos demais.

**Continuidade dos números reais.** Os dados de exemplo usam a mesma meta do vídeo original — R$ 800 mil / R$ 350 mil / R$ 5 mil por mês — e a tela renderizou exatamente como os testes previam: **44% · faltam 90 meses.** O `DailyBrief` é o mesmo tipo em toda a cadeia: da leitura SQLite (seção seguinte) até o componente.

**O que ainda falta, por decisão consciente:** Tauri (desktop), CI, testes em iOS/Android físicos e Supabase Auth dentro do app ficaram de fora desta rodada. *(A leitura mock foi substituída por SQLite de verdade na rodada seguinte — ver abaixo.)*

### Implementado: persistência local (SQLite) no apps/mobile

> Schema em [`apps/mobile/src/db/schema.ts`](apps/mobile/src/db/schema.ts) · cliente/hooks/queries em [`apps/mobile/src/db/`](apps/mobile/src/db) · tela real em [`components/screens/hoje-screen.tsx`](apps/mobile/src/components/screens/hoje-screen.tsx) · testes em [`apps/mobile/test/db.test.ts`](apps/mobile/test/db.test.ts).

**Schema SQLite separado do Postgres, de propósito.** `packages/db/schema.ts` usa `pg-core`; o app usa `sqlite-core` — dialetos diferentes do Drizzle, sem como compartilhar um arquivo. Os nomes de campo espelham os do Postgres para a futura sincronização local↔Supabase ser tradução direta, não redesenho. 6 tabelas: `accounts`, `goals`, `tasks`, `habits`, `habit_logs`, `due_items`.

**A escrita separada da leitura reativa, por uma razão concreta, não estética.** `queries.ts` (I/O puro, `toggleHabitToday`, `todayIso`) ficou num arquivo; `hooks.ts` (`useDailyBrief`, que usa `useLiveQuery` do Drizzle — a tela atualiza sozinha em qualquer escrita, sem estado manual) ficou noutro. A separação não foi gosto: importar `useLiveQuery` no topo de `queries.ts` puxava `react-native` inteiro para dentro dos testes Node e quebrava o bundle do teste — só apareceu tentando testar de verdade.

**Dois bugs de configuração corrigidos com fonte oficial, não suposição:**
1. **`.sql` sendo interpretado como JavaScript.** `sourceExts.push('sql')` sozinho não bastava — faltava o `babel-plugin-inline-import` ([`babel.config.js`](apps/mobile/babel.config.js)), que converte o SQL em string de verdade.
2. **`.wasm` não resolvia no Metro.** Precisava ir em `resolver.assetExts`, não `sourceExts` — são binários, não código-fonte.

**Validado com `better-sqlite3` no lugar do driver real, mesmo princípio do PGlite para o Postgres.** `schema.ts` é dialect-agnóstico (`sqlite-core`), então a mesma migração gerada e as mesmas funções de `queries.ts` (que recebem o tipo genérico `Db`, não o driver concreto) rodam sobre qualquer SQLite síncrono — `expo-sqlite` no app, `better-sqlite3` no teste. **10 testes**: migração cria as 6 tabelas, seed é idempotente e reproduz os números reais da meta, e o streak do hábito soma/subtrai/nunca fica negativo/atualiza o recorde sem derrubá-lo ao desmarcar.

**O obstáculo real: um bug conhecido do Expo Router, não do meu código.** Depois dos dois fixes de bundling, o Web travou num erro interno do Metro (`Worker chunk not found`) tentando empacotar o worker que o `expo-sqlite` usa no navegador. A primeira tentativa de resolver — `_layout.web.tsx` + `index.web.tsx`, a convenção óbvia — **não funcionou**: o erro persistiu idêntico. Investigando, achei a causa: é [expo/expo#37752](https://github.com/expo/expo/issues/37752), documentado — dentro de `app/`, o `require.context` que descobre as rotas carrega **todas** as variantes de plataforma de um arquivo, ignorando `.web` (a convenção só funciona corretamente fora de `app/`).

**A correção real:** mover a implementação para `components/`, onde a resolução por plataforma do Metro já funcionava comprovadamente (mesmo mecanismo do `app-tabs.tsx`/`app-tabs.web.tsx` já existente). `app/index.tsx` e `app/_layout.tsx` viraram reexports de uma linha, sem nenhum toque em `expo-sqlite`; a implementação real e o fallback vivem em `components/screens/hoje-screen.tsx`/`.web.tsx` e `components/root-shell.tsx`/`.web.tsx`. Depois disso, o bundle Web passou limpo — zero erro no servidor, zero erro no console — e mostra uma mensagem explicando a situação em vez de travar em "preparando…" para sempre:

```
Ainda não disponível no navegador
A tela "Hoje" lê do banco local (SQLite), e o suporte a Web dessa peça
ainda é alpha — trava o empacotamento antes mesmo do app rodar.
```

iOS e Android não são afetados — usam a versão real sem nenhuma mudança de comportamento.

**Estado ao final daquela rodada:** 70 testes (60 anteriores + 10 novos), type-check limpo em três configurações (`apps/mobile`, `apps/mobile/test`, raiz). A tela "Hoje" lê e escreve de verdade no SQLite local — tocar num hábito grava, e a UI atualiza sozinha via `useLiveQuery`.

### Implementado: CRUD de tarefas, hábitos e metas

> Funções em [`queries.ts`](apps/mobile/src/db/queries.ts) · telas em [`components/screens/`](apps/mobile/src/components/screens) (`tasks-screen.tsx`, `habits-screen.tsx`, `goals-screen.tsx`) · testes em [`db.test.ts`](apps/mobile/test/db.test.ts).

**Criar, editar, apagar — tarefas e hábitos, de verdade.** `createTask`/`updateTask`/`cycleTaskStatus`/`deleteTask` e `createHabit`/`updateHabit`/`deleteHabit`, mais duas telas reais (adicionar com prioridade/frequência, tocar para ciclar status ou marcar hábito do dia, apagar com confirmação), cada uma com sua versão `.web.tsx` de fallback. `deleteHabit` apaga o histórico (`habit_logs`) manualmente antes do hábito — nem `expo-sqlite` nem `better-sqlite3` ligam `PRAGMA foreign_keys` sozinhos, então confiar no `onDelete: cascade` do schema deixaria logs órfãos em silêncio.

**Dois bugs reais, nenhum hipotético:**

1. **Navegação quebrada — só visível testando de verdade.** Naveguei para `/tasks` no navegador: a URL mudava, mas a tela continuava mostrando "Hoje". Causa: o `Tabs`/`TabSlot` do `expo-router/ui` (a versão Web da barra de abas) só entende as rotas registradas como `<TabTrigger>` — `/tasks` e `/habits`, fora desse conjunto fixo, eram ignoradas por completo. **Correção estrutural, não um patch**: as abas Hoje/Explore foram para um grupo `(tabs)`, com um `Stack` de verdade na raiz (`app/_layout.tsx`) para que `tasks`/`habits` sejam telas irmãs empilhadas por cima — o padrão que o próprio Expo Router recomenda para abas + modais, e que provavelmente teria sido necessário mesmo sem o bug do `Tabs`-Web.
2. **Bug de fuso horário, pego pela suíte de testes fazendo seu trabalho — no meio da própria sessão.** `seed.ts` calculava "hoje" com `toISOString()` (UTC); `queries.ts` já calculava com hora local, e o comentário na própria função já explicava por quê ("nunca UTC, senão hoje muda sozinho à noite"). Não segui minha própria regra em `seed.ts`. Às 21h em Brasília (UTC-3), `toISOString()` já devolve o dia seguinte — o log do hábito era gravado com a data errada, e um teste que vinha passando havia horas **começou a falhar de verdade**, porque o relógio real cruzou essa fronteira durante a sessão. Corrigido reaproveitando `todayIso()` num único lugar; o mesmo bug afetaria silenciosamente o card "Vence hoje" (mesma inconsistência UTC/local), corrigido junto.

**Estado depois de tarefas e hábitos:** 80 testes (70 anteriores + 10 novos), confirmado 3x seguidas para garantir que não era coincidência de horário. Type-check limpo. Validado no Expo Web: `/`, `/tasks` e `/habits` cada um renderizando o texto certo, sem erro de bundle nem de console.

**CRUD de metas, completando o trio.** `createGoal`/`updateGoal`/`deleteGoal` e `contributeToGoal` — esta última reaproveita o espírito de `toggleHabitToday`: registrar um aporte já atualiza `savedCents`, e se o total alcançar a meta enquanto ela está `active`, marca `achieved` sozinha, sem passo manual extra. Tela em [`goals-screen.tsx`](apps/mobile/src/components/screens/goals-screen.tsx) com barra de progresso reaproveitada de `packages/core` (`goalProgressPct`, `monthsToGoal` — as mesmas funções já testadas com os números reais do vídeo). 7 testes novos, incluindo o caso que importava verificar: uma meta pausada **não** vira `achieved` sozinha ao receber aporte, mesmo que o valor ultrapasse o alvo — só metas ativas.

A rota `/goals` seguiu o padrão já corrigido (grupo `(tabs)` + `Stack` na raiz) sem precisar de nenhum ajuste novo — confirma que a correção da navegação era estrutural, não um remendo específico para `tasks`/`habits`.

**Estado final desta rodada:** 87 testes (80 anteriores + 7 novos). Type-check limpo. Validado no Expo Web: `/goals` renderizando o texto certo, zero erro de bundle ou console.

**O que resta:** sincronizar esse SQLite com o Supabase (hoje são dois bancos independentes), e Tauri para desktop.

### Implementado: sincronização SQLite ↔ Supabase

> Protocolo compartilhado em [`packages/core/src/sync-protocol.ts`](packages/core/src/sync-protocol.ts) · motor Postgres em [`packages/db/src/routine-sync.ts`](packages/db/src/routine-sync.ts) · Edge Function em [`supabase/functions/sync-routine/`](supabase/functions/sync-routine) · motor do app em [`apps/mobile/src/db/sync.ts`](apps/mobile/src/db/sync.ts) · botão manual em [`hoje-screen.tsx`](apps/mobile/src/components/screens/hoje-screen.tsx).

**Um bug de pré-requisito, achado por raciocínio, não por teste falhando.** Antes de desenhar o sync, revisitei como `apps/mobile/src/db/schema.ts` gravava `created_at`/`updated_at`: o default vinha do próprio SQLite (`current_timestamp`, formato `"2026-09-03 22:14:00"`, sem `T`/`Z`), enquanto `updateTask`/`updateHabit`/`updateGoal` já gravavam `new Date().toISOString()` (`"2026-09-03T22:14:00.000Z"`). Dois formatos na mesma coluna — inofensivo até hoje, porque nada comparava essas strings. O sync inteiro se apoia em comparar `updated_at` como texto (`>`), então esse é exatamente o tipo de inconsistência que quebraria silenciosamente a primeira vez que uma linha fosse criada e nunca editada. Corrigido trocando o default para `.$defaultFn(() => new Date().toISOString())` nas duas colunas, em todas as tabelas, com 3 testes de regressão garantindo que INSERT e UPDATE produzem o mesmo formato.

**Resolução de conflito: last-write-wins por linha, com o relógio do SERVIDOR como fonte da verdade — nunca o do dispositivo.** Decisão direta do bug de fuso horário já encontrado nesta sessão (seção anterior): se o watermark de "o que já sincronizei" fosse gravado com a hora local do celular, um aparelho com o relógio errado corromperia sozinho os próprios dados. A Edge Function captura `serverTime` uma única vez, antes do push, e devolve para o app avançar os marcadores — cliente nunca decide "que horas são agora" para fins de sincronização.

**A comparação roda dentro do próprio SQL, atomicamente.** `on conflict (id) do update ... where excluded.updated_at > tabela.updated_at` (confirmado que tanto `pg-core` quanto `sqlite-core` do Drizzle suportam `setWhere` no `onConflictDoUpdate`, lendo o `.d.ts` de cada um). Os dois lados (Postgres em `routine-sync.ts`, SQLite em `sync.ts`) fazem uma checagem em memória primeiro (evita um upsert para quem não precisa) e repetem a mesma condição no SQL — cinto e suspensório contra a janela entre ler e decidir.

**Segredo próprio para o app, separado do segredo do cron.** O app não tem Supabase Auth; a alternativa óbvia — expor a `anon key` com RLS permissiva — foi descartada por ser insegura demais para dados financeiros/de rotina. Em vez disso, uma Edge Function dedicada (`sync-routine`) exige um header `x-sync-secret` verificado contra `MOBILE_SYNC_SECRET`, uma variável **nova e diferente** do `SYNC_SECRET` do cron do Pluggy — porque um segredo dentro do bundle do app é muito mais exposto que um segredo servidor-a-servidor, e um vazamento aqui não pode alcançar o sync financeiro.

**Testado contra bancos reais nos dois lados, nunca contra mock.** `routine-sync.ts` (Postgres) tem 13 testes contra PGlite — pegou um bug de fixture (ids como `'a'`/`'b'` não são UUID válido; o Postgres real rejeitou, um mock não teria) e comprovou o isolamento por usuário (dois `userId` diferentes só veem as próprias linhas). `sync.ts` (SQLite) tem 9 testes contra `better-sqlite3` **e** um servidor `node:http` de verdade imitando o contrato da Edge Function, em vez de mockar `fetch` — pegou um bug no próprio teste (servidor fake devolvendo um `serverTime` fixo no passado, o que fazia uma tarefa recém-criada parecer "ainda não sincronizada" na sincronização seguinte) e um `setWhere` que eu mesmo tinha deixado quebrado (`gt(...) ? undefined : undefined`, um no-op) — encontrado relendo o próprio código antes de rodar qualquer teste.

**Implantado e validado com chamadas HTTP reais contra o Supabase de produção**, mesmo rigor já aplicado à função `sync` do Pluggy: sem segredo → `401`; com segredo → `200` e `serverTime` real; push de uma tarefa de teste → grava no Postgres; pull imediato → devolve a mesma linha, ida e volta íntegra. A linha de teste foi apagada do banco depois de confirmado — não ficou lixo em produção.

**Botão manual na tela "Hoje", não sync automático.** Sem infraestrutura de agendamento no app ainda, a sincronização é acionada por toque (`Sincronizar`), com feedback de quantos itens foram enviados/recebidos ou o erro, se houver. Configurado via `EXPO_PUBLIC_SYNC_FUNCTION_URL`/`EXPO_PUBLIC_MOBILE_SYNC_SECRET` (convenção do Expo para valores expostos ao bundle do cliente) — o botão só aparece se as duas variáveis estiverem presentes, então builds sem elas configuradas simplesmente omitem a funcionalidade em vez de falhar.

**Estado final desta rodada:** 116 testes (87 anteriores + 29 novos: 4 do protocolo, 13 do lado Postgres, 9 do lado app, 3 do bug de formato de data). Type-check limpo em `apps/mobile` e na raiz. Não validado visualmente no navegador — a tela "Hoje" real não roda em Expo Web (SQLite ainda é alpha ali, ver seção anterior), então o botão de sincronizar só é exercitável em iOS/Android, ainda não testados fisicamente.

### Implementado: Agenda e notificações locais

> Domínio puro em [`packages/core/src/domain.ts`](packages/core/src/domain.ts) (`CalendarEvent`, `eventsForDay`) e [`packages/core/src/reminders.ts`](packages/core/src/reminders.ts) · schema/CRUD em [`apps/mobile/src/db/schema.ts`](apps/mobile/src/db/schema.ts)/[`queries.ts`](apps/mobile/src/db/queries.ts) · wrapper nativo em [`apps/mobile/src/notifications.ts`](apps/mobile/src/notifications.ts) · tela em [`agenda-screen.tsx`](apps/mobile/src/components/screens/agenda-screen.tsx) · seletor compartilhado em [`date-time-field.tsx`](apps/mobile/src/components/kairo/date-time-field.tsx).

**A tabela `events` já existia no Postgres, criada numa rodada anterior e nunca usada.** `packages/db/schema.ts` já tinha `events` completo (`startsAt`, `endsAt`, `allDay`, `recurrenceRule`, `origin`, `externalId`, `taskId`) — provavelmente desenhado junto do modelo de dados original (seção 6) e nunca chegou a ganhar schema local nem UI. A versão SQLite (`apps/mobile/src/db/schema.ts`) replica só o subconjunto que a Fase 2 precisa (sem `recurrenceRule`/`origin`/`externalId`, que só fazem sentido quando existir sincronização com o Google Calendar) — mesma disciplina de nomes espelhados já usada nas outras tabelas.

**Um bug de teste latente, só exposto por precisar de uma tabela nova.** `apps/mobile/test/db.test.ts` aplicava as migrações com `fs.readdirSync(dir).find(f => f.endsWith('.sql'))` — `.find` para no primeiro resultado, então só a migração `0000` (a inicial) jamais rodava, e `0001`/`0002` (que adicionaram `sync_state` e agora `events`) eram ignoradas silenciosamente. Passou despercebido até aqui porque os defaults de `created_at`/`updated_at` são `$defaultFn` do lado do Drizzle (JS), não dependem do DDL aplicado, e nada no arquivo usava `sync_state`. Corrigido para aplicar todas as migrações, em ordem — mesmo padrão que `apps/mobile/test/sync.test.ts` já usava corretamente. Ao corrigir, o teste "cria as N tabelas esperadas" passou a listar 8 (não mais 6): a correção também tornou `sync_state` visível pela primeira vez nesta suíte.

**`eventsForDay` filtra por sobreposição de intervalo, não por `startsAt` cair no dia.** Um evento que atravessa a meia-noite (uma festa até 1h da manhã, por exemplo) precisa aparecer nos dois dias que toca — filtrar só por "começa hoje" o faria sumir do dia seguinte. Eventos de dia inteiro vêm sempre primeiro na lista; o resto por horário de início. 5 testes cobrindo esses casos, incluindo a fronteira exata (evento que termina *no* início do dia não conta como parte dele).

**O cálculo de "quando notificar" é puro; só a chamada à API nativa não é.** `expo-notifications` é um módulo nativo sem equivalente testável em Node — diferente de Postgres/SQLite, que têm PGlite/better-sqlite3 como bancos reais. Em vez de deixar a lógica de negócio presa dentro da chamada nativa (e portanto intestável), ela foi extraída para `packages/core/src/reminders.ts`: `taskReminderAt` (no próprio instante do prazo), `eventReminderAt` (`N` minutos antes do início, padrão 15) e `shouldScheduleReminder` (nunca agenda para o passado) — puras, 6 testes. `apps/mobile/src/notifications.ts` fica fino o bastante para não esconder nada que valesse a pena testar: só pede permissão, cria o canal Android e chama `scheduleNotificationAsync`/`cancelScheduledNotificationAsync`.

**Lembrete reagendado a cada criação/edição, cancelado ao concluir/cancelar/apagar.** Tarefas ganharam um campo opcional de prazo com lembrete (reaproveitando o mesmo `DateTimeField` da agenda) — `cycleTaskStatus` já existia; a tela agora decide, a partir do próximo status, se cancela o lembrete (tarefa concluída ou cancelada) ou o reagenda (voltou a `todo`/`doing` e ainda tem prazo). Eventos seguem a mesma regra: `syncEventReminder` depois de criar/editar, `cancelEventReminder` depois de apagar.

**`DateTimeField` — um componente para dois problemas de plataforma.** Android só suporta os modos `date`/`time` do `@react-native-community/datetimepicker` separados (não existe um modo `datetime` combinado ali); iOS usa `display="spinner"`, que fica inline e não fecha sozinho, então só lá aparece um botão "pronto". Construído uma vez, reaproveitado por `agenda-screen.tsx` (início/fim de evento) e `tasks-screen.tsx` (prazo da tarefa) — mesmo comportamento, sem duplicar a lógica de picker duas vezes.

**Dependências instaladas com `npx expo install`** (não `npm install` direto), para que a versão fique casada com o SDK 57 do projeto: `expo-notifications`, `@react-native-community/datetimepicker` — este último já registrou seu próprio plugin em `app.json` sozinho, via `expo install`.

**Decisões conscientes de escopo, para esta rodada não inchar** *(as duas primeiras foram fechadas numa rodada seguinte — ver [Implementado: eventos na sincronização + vínculo evento↔tarefa](#implementado-eventos-na-sincronização--vínculo-eventotarefa)):*
- ~~Eventos não vinculam a uma tarefa pela UI ainda.~~ O campo `taskId` já existe no schema e em `createEvent`/`updateEvent` — falta só um seletor de tarefa no formulário da agenda.
- ~~`events` não está na sincronização com o Supabase.~~ Local-only por enquanto, mesmo caminho que tarefas/hábitos/metas percorreram antes de a sincronização existir (seção anterior) — entrar no protocolo de sync é trabalho de continuação, não desta rodada.
- **Validado por type-check e bundle Web (zero erro), não por dispositivo físico.** A tela real de agenda não roda no navegador pelo mesmo motivo de sempre (SQLite Web é alpha) — confirmei que `/agenda` e `/tasks` renderizam o fallback certo, sem erro de bundle nem console, mas o comportamento nativo de verdade (prompt de permissão, notificação disparando, os dois modos do date/time picker) só é exercitável em iOS/Android, que seguem não testados fisicamente neste projeto.

**Estado final desta rodada:** 132 testes (116 anteriores + 16 novos: 5 de `eventsForDay`, 6 de `reminders.ts`, 5 de CRUD de eventos). Type-check limpo em `apps/mobile` e na raiz. Bundle Web sem erro em `/`, `/tasks` e `/agenda`.

### Implementado: apps/desktop (Tauri)

> Config em [`apps/desktop/src-tauri/tauri.conf.json`](apps/desktop/src-tauri/tauri.conf.json) · `npm run build -w @kairo/desktop` gera `.msi`/`.exe` em `apps/desktop/src-tauri/target/release/bundle/`.

**Escopo desta rodada, decidido explicitamente antes de começar: só empacotar, não tornar funcional.** O Tauri empacota o MESMO build Web já exportado por `expo export --platform web` — e esse build já mostra as telas de fallback "ainda não disponível no navegador" para Hoje/Tarefas/Hábitos/Metas/Agenda, porque `expo-sqlite` não roda em ambiente Web (alpha, ver seção anterior). Então o app desktop abre de verdade, numa janela nativa, mas hoje mostra os mesmos fallbacks do preview Web — o mesmo tipo de degrau que `apps/mobile` teve na Fase 0 ("hello world" antes de dados reais). Tornar funcional exigiria um driver de banco separado para esse alvo (ex.: plugin SQL do Tauri via `rusqlite` + um driver Drizzle por proxy) — trabalho de continuação, não desta rodada.

**Wrapping de um frontend existente, não scaffold de um novo.** `npx tauri init` (não o assistente interativo `create-tauri-app`, que gera um frontend novo) cria só `src-tauri/` — o projeto Rust + `tauri.conf.json` — apontando para `apps/mobile/dist` (a saída de `expo export --platform web`) como `frontendDist`, e `http://localhost:8081` como `devUrl` para `tauri dev` reaproveitar o mesmo servidor Expo Web já usado no preview. `apps/desktop/package.json` só tem `@tauri-apps/cli` como devDependency — o frontend real continua sendo `apps/mobile`, sem duplicar código nem dependências de UI.

**O obstáculo real não foi código — foi uma política de segurança do Windows.** A primeira tentativa de `tauri build` falhou com `Uma política de Controle de Aplicativo bloqueou este arquivo` ao tentar executar um script de build do Rust recém-compilado (`icu_normalizer_data`, uma dependência transitiva do Tauri). Diagnóstico confirmado lendo o registro (`HKLM\...\CI\Policy\VerifiedAndReputablePolicyState = 1`): o **Smart App Control** do Windows 11 estava ativo, e ele bloqueia por padrão a execução de binários novos e não assinados — exatamente o que todo build Rust gera. Por ser uma configuração de segurança do sistema (não do projeto), a decisão de desligá-la ficou explicitamente com você, não comigo — inclusive o detalhe de que é irreversível sem reinstalar o Windows. Depois de desligado (confirmado de novo lendo o mesmo valor do registro, agora `0`), o build completou em ~4 minutos.

**Verificado abrindo o `.exe` de verdade, não só checando o código de saída do build.** `app.exe` (~9,4 MB) abriu numa janela de título "Kairo" — confirmado tanto por `Get-Process` (processo vivo, `MainWindowTitle: Kairo`) quanto observando a própria tela. Dois instaladores também saíram do mesmo build: `Kairo_0.1.0_x64_en-US.msi` (~4 MB) e `Kairo_0.1.0_x64-setup.exe` (~3 MB, NSIS) — ambos dentro da estimativa "~5 MB, nativo" que o plano já previa para o caminho Tauri, bem abaixo do que um equivalente em Electron pesaria.

**Estado final desta rodada:** empacotamento provado de ponta a ponta — `tauri dev` (aponta pro servidor Expo Web local) e `tauri build` (roda `expo export` sozinho via `beforeBuildCommand`, depois empacota) os dois funcionam. Nenhum teste novo (não há lógica de negócio nesta rodada — é infraestrutura de empacotamento). Funcionalidade real no desktop (SQLite via Tauri) fica para uma rodada futura, por decisão consciente de escopo.

---

### Implementado: eventos na sincronização + vínculo evento↔tarefa

> Fechando os dois pontos deixados conscientemente de fora da rodada da Agenda (ver acima).

**`events` entrou no mesmo protocolo de sincronização de tarefas/hábitos/metas, sem desenho novo — só extensão do que já existia.** `SyncEventRow` em [`packages/core/src/sync-protocol.ts`](packages/core/src/sync-protocol.ts), `pushEvents`/inclusão em `pullRoutine` em [`packages/db/src/routine-sync.ts`](packages/db/src/routine-sync.ts), e o espelho no lado do app em [`apps/mobile/src/db/sync.ts`](apps/mobile/src/db/sync.ts) — mesmo `on conflict ... where excluded.updated_at > tabela.updated_at`, mesmo `isNewer` puro decidindo antes de tentar escrever. **Ordem de push importa de novo**: tarefas agora entram antes de eventos em `pushRoutine` (habits → habitLogs → tasks → events → goals), pelo mesmo motivo de habits entrarem antes de habitLogs — um evento vinculado a uma tarefa recém-criada no mesmo lote precisa da tarefa já gravada primeiro, ou a FK reclama.

**Vínculo evento↔tarefa, exposto na UI da Agenda.** O campo `taskId` já existia no schema e nas funções de `queries.ts` desde a rodada anterior — só faltava um jeito de escolher a tarefa na tela. Adicionado como uma fileira horizontal de chips (tarefas `todo`/`doing`, mais "nenhuma" para desvincular) no formulário de evento, e o evento na lista agora mostra "↳ nome da tarefa" quando vinculado.

**Validado com chamadas HTTP reais contra produção, mesmo rigor de sempre**: `sync-routine` reimplantada (o bundle da Edge Function inclui `routine-sync.ts`/`sync-protocol.ts` diretamente, então mudança neles exige redeploy); push de um evento de teste devolveu `HTTP 200` com o mesmo evento íntegro no pull.

**Um obstáculo de rede, não de código, impediu a limpeza do dado de teste.** Depois de validar, tentei apagar a linha de teste direto no Postgres (mesmo padrão usado nas rodadas anteriores) e a conexão falhou com `ETIMEDOUT`/`CONNECT_TIMEOUT` na porta 6543. Diagnosticado antes de insistir: a API HTTPS do Supabase respondeu normalmente (`401` esperado sem segredo), mas `Test-NetConnection` na porta 6543 (pooler do Postgres) deu `TcpTestSucceeded: False` — a rede local está bloqueando essa porta especificamente, não um problema do projeto nem da função implantada. **Ficou uma linha de teste (`"Teste de sync de evento"`) na tabela `events` de produção, não removida** — inofensiva (é só um evento de calendário), mas vale apagar manualmente quando a porta 6543 estiver acessível de novo (Table Editor do Supabase, ou psql de outra rede).

**Estado final desta rodada:** 138 testes (132 anteriores + 6 novos: 1 de ordenação tarefa-antes-de-evento em `pushRoutine`, 4 de `pushEvents`, 1 de LWW de evento no lado do app). Type-check limpo. Bundle Web de `/agenda` continua sem erro.

---

### Implementado: banco local funcional no desktop

> Driver em [`apps/mobile/src/db/client.web.ts`](apps/mobile/src/db/client.web.ts) · migrações em [`tauri-migrate.ts`](apps/mobile/src/db/tauri-migrate.ts) · reatividade em [`change-bus.ts`](apps/mobile/src/db/change-bus.ts)/[`hooks.web.ts`](apps/mobile/src/db/hooks.web.ts) · gate em [`root-shell.web.tsx`](apps/mobile/src/components/root-shell.web.tsx) · plugin Rust em [`apps/desktop/src-tauri`](apps/desktop/src-tauri).

**O problema de fundo: o Tauri empacotava o build Web, e o build Web nunca teve SQLite de verdade.** A rodada anterior só provou o empacotamento — o app abria numa janela nativa, mas mostrava os mesmos fallbacks "SQLite indisponível" do preview Web, porque `expo-sqlite` não roda fora do runtime nativo do Expo. Resolver isso de verdade significa um banco DIFERENTE para esse alvo — não dá pra simplesmente "ligar" o SQLite que já existe.

**A peça que faltava: o plugin SQL do Tauri (`@tauri-apps/plugin-sql`), que fala com SQLite de verdade do lado Rust (`sqlx`), acessível do JS só por IPC assíncrono.** Como não existe um `drizzle-orm/tauri-sql` oficial, a ponte é o driver genérico `drizzle-orm/sqlite-proxy` — você implementa uma função `(sql, params, método) => Promise<{ rows }>` e o Drizzle trata como qualquer outro banco SQLite. Duas armadilhas reais nessa ponte, achadas lendo o código-fonte do Drizzle (`node_modules/drizzle-orm/sqlite-proxy/session.js`) em vez de supor:
1. **Drizzle espera cada linha como ARRAY posicional** (`row[índiceDaColuna]`), mas o plugin do Tauri devolve OBJETO (`{coluna: valor}`) — sem converter com `Object.values(row)`, os dados viriam embaralhados nas colunas erradas, um jeito de corromper tudo silenciosamente.
2. **Drizzle sempre gera `?` como placeholder; o plugin do Tauri (via `sqlx`) exige `$1, $2, …`**, mesmo para SQLite — sem essa conversão de string antes de cada chamada, todo parâmetro chegaria como `?` literal e o SQLite rejeitaria a instrução.

**Migrações não podiam usar o migrador pronto do Drizzle.** `drizzle-orm/sqlite-proxy/migrator` exige `migrationsFolder` — um CAMINHO DE ARQUIVO, lido via `fs`, que não existe dentro de um webview. Solução: reaproveitar o MESMO `migrations.js` já gerado para o driver nativo (o SQL de cada migração já vem embutido como string) e aplicar manualmente, com uma tabela de controle própria (`_kairo_migrations`) para não tentar recriar tabelas que já existem num segundo lançamento do app.

**Sem `useLiveQuery`, a reatividade teve que ser inventada.** `useLiveQuery` (usado nas telas para a UI atualizar sozinha a cada escrita) é específico do driver `expo-sqlite` — não existe equivalente para um driver-proxy genérico. Resolvido com um pub-sub mínimo (`change-bus.ts`): toda mutação em `queries.ts` chama `emitDbChange()` ao final (inofensivo no nativo, onde ninguém escuta), e um hook próprio (`useLiveProxyQuery`, em `hooks.web.ts`) reconsulta tudo sempre que o sino toca. Sem otimização por tabela — para uso pessoal, refazer todas as consultas a cada mudança é imperceptível.

**A descoberta que simplificou tudo: as TELAS não precisaram mudar.** `queries.ts` já importava `Db` de `./client` sem sufixo de plataforma — o Metro resolve isso para `client.ts` (nativo) ou `client.web.ts` (nosso) sozinho, e como todo acesso em `queries.ts` já usa `await` (funciona igual em driver síncrono ou assíncrono), o MESMO código roda sobre os dois bancos sem saber qual é qual. Mesmo raciocínio valeu para `hoje-screen.tsx`/`tasks-screen.tsx`/etc.: elas só chamam `useDb()`/`useAllTasks()` — nunca souberam, e não precisam saber, que banco está por trás. A armadilha real ficou só em `seed.ts`, que É chamado diretamente por `root-shell.web.tsx` com um `Db` explicitamente async — teve que trocar seu `import type { Db } from './client'` (que o TypeScript sempre resolve para o nativo, já que só o Metro entende `.web.ts`) por um tipo próprio, genérico o bastante para os dois resultKinds (`'sync' | 'async'`).

**As 5 telas de fallback Web foram apagadas, não mantidas ao lado da versão real.** Antes, cada tela tinha duas versões (`X-screen.tsx` real, `X-screen.web.tsx` com a mensagem "indisponível"). Como a MESMA build Web agora roda dentro do Tauri (dados reais) e num navegador comum (sem dados, preview de desenvolvimento) — e essa diferença só existe em TEMPO DE EXECUÇÃO (`isTauri()`), não em tempo de empacotamento — a decisão subiu para UM lugar só: `root-shell.web.tsx` virou um gate de verdade, no mesmo espírito do `MigrationGate` nativo. Dentro do Tauri, ele abre o banco, aplica migrações, povoa na primeira vez, e só então libera a navegação. Fora dele, mostra uma única mensagem consolidada ("abra no app desktop ou mobile") no lugar das cinco mensagens quase-idênticas de antes.

**Validado abrindo o banco de verdade, não só checando se o app inicia.** `tauri build` completou (`sqlx`/`tauri-plugin-sql` entraram na compilação); o `.exe` e os instaladores `.msi`/`.exe` (NSIS) saíram normalmente. Abri o app (via `Get-Process`, janela "Kairo" viva e respondendo) e, com o app rodando, inspecionei o arquivo `kairo.db` real que ele criou em `%APPDATA%\com.kairo.app\` **direto com `better-sqlite3`** — a mesma ferramenta usada nos testes deste projeto o tempo todo:
- as 8 tabelas existem, incluindo a `_kairo_migrations` de controle;
- as 3 migrações aparecem registradas, na ordem certa;
- os dados de exemplo do `seed.ts` estão lá, com os valores exatos (`R$ 292,72` de saldo, as 4 tarefas, os 3 hábitos com os streaks certos, a meta com `R$ 350.000` de `R$ 800.000`) — prova de que o INSERT com `.returning()` (usado para pegar o id gerado dos hábitos) funcionou pela ponte do proxy;
- fechei e reabri o app, e o banco continuou com exatamente as mesmas contagens — a tabela de controle impediu recriar/reinserir tudo de novo.

**O que não foi verificado: a UI renderizando esses dados na tela.** Tentei instalar o app de verdade para poder inspecioná-lo visualmente — o `.msi` falhou (erro genérico do Windows Installer, código 1603, causa não investigada), mas o instalador NSIS funcionou (`%LOCALAPPDATA%\Kairo`, atalho no menu Iniciar). Ainda assim, o pedido de acesso para controlar a janela via automação (`computer-use`) foi negado, então não consegui tirar um screenshot real da tela "Hoje" mostrando os dados, nem testar criar uma tarefa pela interface e ver aparecer sozinha (a prova visual da reatividade do `change-bus`). A confiança de que a UI renderiza certo vem por dedução, não por observação direta: `hoje-screen.tsx` e as outras telas não mudaram uma linha de código nesta rodada, os mapeadores (`mappers.ts`) são os MESMOS já usados (e visualmente confirmados) no app nativo, e os dados lidos do arquivo batem exatamente com o que o `seed.ts` grava — mas isso é inferência, não observação. Vale reabrir o app e olhar a tela quando houver acesso à máquina de verdade.

**MSI com erro 1603, NSIS funcionando — vale registrar mesmo sem investigar a fundo.** Não foi investigada a causa raiz (o NSIS já resolveu a necessidade imediata de ter o app instalado para o teste); se o `.msi` for o formato de distribuição preferido no futuro (empresas costumam exigir MSI para deploy via GPO, por exemplo), vale revisitar.

**Estado final desta rodada:** nenhum teste novo em Node (a lógica nova — o driver proxy, o migrador, a reatividade — só é exercitável de verdade dentro do runtime do Tauri, sem equivalente Node-testável, mesma categoria de `notifications.ts`) além dos 4 de `change-bus.ts` (a única peça desta rodada que é pura o bastante para testar — 142 testes no total). Verificado por inspeção direta do banco real criado pelo app compilado — migrações, seed e idempotência entre execuções, todos corretos.

---

### Implementado: testes em dispositivo físico (iOS/Android) — e um bug crítico que só apareceu ali

> Fix em [`apps/mobile/src/db/schema.ts`](apps/mobile/src/db/schema.ts) · teste em [`apps/mobile/test/db.test.ts`](apps/mobile/test/db.test.ts) (`describe('randomUUID')`).

**Primeiro teste real num aparelho físico deste projeto inteiro — e achou, de cara, um bug que quebrava o app por completo.** Subi o servidor Expo em modo nativo (`npx expo start`, fora do `--web`), gerei um QR code para `exp://192.168.15.13:8082` e o usuário conectou via Expo Go num Android. Resultado imediato: tela de erro do `MigrationGate` — `"Não consegui preparar o banco local" / "Property 'crypto' doesn't exist"`.

**Causa raiz: `crypto.randomUUID()` não existe no Hermes.** `apps/mobile/src/db/schema.ts` gerava o id de toda tabela com `text('id').primaryKey().$defaultFn(() => crypto.randomUUID())` — funciona em Node (tem `crypto` global), em navegador (Web preview) e dentro do webview do Tauri (Chromium), mas o Hermes (motor JS do React Native em produção) **não tem `crypto` global por padrão**. Como TODOS os testes automatizados deste projeto rodam num desses três ambientes — nunca em Hermes de verdade — esse bug ficou invisível desde que o schema foi escrito, várias rodadas atrás, apesar de já ter sido "exercitado" indiretamente centenas de vezes nos testes contra `better-sqlite3` (que roda em Node, então nunca acusaria o problema). **A regra que este projeto já seguia — "todo teste contra um banco real, nunca mock" — não bastou aqui, porque o banco não era o problema: era o próprio runtime JavaScript.** Só um dispositivo físico (ou algo rodando em Hermes de verdade) revelaria isso.

**Corrigido com um gerador de UUID v4 em JS puro** (`Math.random()`, sem nenhuma API de plataforma) — funciona identicamente nas quatro plataformas (Node, navegador, Tauri, Hermes) sem precisar de `expo-crypto` nem de nenhuma outra dependência nova. Não precisa ser criptograficamente seguro: é só a chave primária de uma linha local, nunca um segredo. Formato validado com regex de UUID v4 real — a mesma disciplina de "isso precisa passar pela coluna `uuid` do Postgres" que já tinha pego um bug de fixture de teste (`'a'`, `'b'` em vez de UUID de verdade) numa rodada anterior. 3 testes novos: formato correto em 50 amostras, sem colisão em 1.000 gerações, e uma tarefa criada de verdade recebendo um id nesse formato.

**Validado nos dois sistemas operacionais reais, depois do fix.** Recarregado o app no Android (Expo Go) — abriu normal, com os dados de exemplo do `seed.ts` na tela. Testado também num iPhone de verdade — funcionou corretamente. **Esta é a primeira confirmação visual real, em qualquer plataforma nativa, de que a tela "Hoje" e o banco local funcionam de ponta a ponta** — todas as rodadas anteriores desta fase foram validadas por teste automatizado (Node) ou por inspeção de banco (desktop), nunca por observação direta de um app rodando.

**Limitação encontrada de bônus, sem relação com o bug do UUID:** o Expo Go (desde o SDK 53) não suporta mais `expo-notifications` completamente — aparece um aviso na inicialização recomendando um "development build" para notificações funcionarem de verdade. Não afeta o teste do banco local, mas significa que o lembrete de tarefa/evento **não foi validado fisicamente** ainda (só o cálculo puro, em `packages/core/src/reminders.ts`, e o wrapper, sem exercício real em Hermes).

**Estado final desta rodada:** 145 testes (142 anteriores + 3 novos de `randomUUID`). Type-check limpo. **Primeiro teste bem-sucedido em dispositivo físico do projeto — Android e iOS, ambos após o fix.**

---

### Implementado: skill de README, repositório git e CI

> Skill em [`.claude/skills/update-readme/SKILL.md`](.claude/skills/update-readme/SKILL.md) · workflow em [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

**Um README de verdade, separado do PLANO.md de propósito.** Até aqui o único README existente era o boilerplate do `create-expo-app` dentro de `apps/mobile` — nada na raiz descrevia o monorepo. Criado [`README.md`](README.md) como referência prática (o que existe, como rodar, variáveis de ambiente, limitações conhecidas) — deliberadamente SEM a narrativa de decisões e bugs que já vive no PLANO.md, para os dois documentos não competirem pelo mesmo conteúdo.

**A skill existe para essa distinção não se perder com o tempo.** `update-readme` documenta o processo de manter o README fiel ao código — quando rodar, o que atualizar em cada seção, e a regra mais importante: nunca virar uma segunda cópia do PLANO.md. Como foi criada no meio desta sessão, ela só aparece na lista de skills disponíveis numa sessão nova (a lista carrega uma vez, no início) — o próprio README desta rodada foi atualizado seguindo o processo escrito nela manualmente, não pela invocação automática.

**O projeto virou um repositório git de verdade — primeiro commit, 168 arquivos.** Não havia `.git` até aqui; todo o trabalho das rodadas anteriores vivia só no disco local. `git init`, revisão manual de `git status` antes de qualquer `add` (checando especificamente que nenhum `.env`, `node_modules`, `target/` ou `dist/` entrasse — os `.gitignore` já existentes, escritos rodadas atrás, se mostraram corretos de primeira), commit inicial, e push para o remoto que o usuário já tinha criado (`github.com/Tidlle/projeto-Kairo`, remoto vazio — sem risco de conflito de histórico).

**CI via GitHub Actions, cobrindo só o que roda em Node puro.** Um workflow (`ci.yml`) rodando em `ubuntu-latest` a cada push/PR para `main`: type-check da raiz, type-check de `apps/mobile` (configs de TypeScript separadas, os dois precisam rodar), lint, e a suíte de testes inteira. Fora do escopo deste workflow, de propósito: build do app desktop (Tauri precisa de um toolchain Rust pesado, workflow separado quando fizer falta), build/publicação do mobile via EAS (precisa de credenciais), e testes em dispositivo físico (não automatizáveis). **Zero segredos configurados no CI** — confirmado por busca (`grep process.env` nos arquivos de teste) que nenhum teste depende de rede ou credencial externa, mesma disciplina de "banco real, nunca mock" que sustenta a suíte inteira.

**Lint nunca tinha sido configurado — configurado agora, achou um problema real (de código antigo, não desta sessão).** `npx expo lint` bootstrap um `eslint.config.js` na primeira vez (fluxo interativo da Expo, interrompido sem querer por um timeout artificial numa tentativa e refeito sem ele). Rodando pela primeira vez contra o código todo, achou 1 erro: `use-color-scheme.web.ts` (arquivo original do template do `create-expo-app`, nunca tocado nesta sessão) faz `setState` dentro de um `useEffect` para detectar hidratação no cliente — um padrão legítimo e comum (SSR-safe hydration), mas que a regra `react-hooks/set-state-in-effect` sinaliza por padrão. Resolvido com um `eslint-disable-next-line` pontual e comentado, não reescrevendo a lógica de hidratação (que funciona corretamente) só para agradar a regra.

**Estado final desta rodada:** 145 testes continuam passando, type-check limpo nos dois projetos, lint limpo (1 erro real encontrado e resolvido). Validado localmente rodando exatamente os mesmos comandos que o workflow do CI roda, antes de subir — não só supondo que passariam.

---

## 6. Modelo de dados

> **Schema implementado:** [`packages/db/schema.ts`](packages/db/schema.ts) (Drizzle/Postgres) · SQL gerado em [`packages/db/migrations/`](packages/db/migrations) — 18 tabelas, modeladas a partir dos campos reais da API, não da documentação.

**Três decisões que valem registrar:**

- **Dinheiro em centavos (`bigint`), nunca float.** `0.1 + 0.2 !== 0.3` — num app de finanças isso vira erro de centavo que ninguém rastreia depois.
- **Sinal normalizado na ingestão.** No Kairo, negativo é sempre saída. A Pluggy inverte isso em cartão de crédito (positivo = compra), então a conversão acontece uma vez, na entrada — e nenhuma query depois precisa saber o tipo da conta.
- **`external_id` com UNIQUE por (`user_id`, `source`, `external_id`).** É o que torna o sync idempotente: rodar duas vezes não duplica nada. Lançamentos manuais têm `external_id` nulo, e o Postgres trata NULLs como distintos — exatamente o comportamento desejado.

### Núcleo

```
users
  └─ accounts          (tipo: corrente | poupança | carteira | cartão)
       └─ transactions (amount, date, description, merchant, account_id,
                        category_id, subscription_id?, task_id?, goal_id?,
                        source: manual | ofx | pluggy, external_id UNIQUE,
                        ai_confidence)
  ├─ categories        (hierárquicas, ícone, cor, orçamento mensal)
  ├─ subscriptions     (nome, valor, ciclo, próxima cobrança, status, uso)
  ├─ budgets           (categoria, mês, limite, gasto)
  ├─ goals             (nome, categoria, valor_alvo, acumulado, aporte_mensal,
                        prazo_projetado, capa_url)
  ├─ connections       (Pluggy: item_id, instituição, status, último_sync)
  ├─ investments       (ativo, classe, quantidade, preço_médio, valor_atual)
  │
  ├─ tasks             (título, projeto_id, prazo, prioridade, status,
                        recorrência, custo_estimado, transaction_id?)
  ├─ projects
  ├─ events            (agenda: início, fim, all_day, origem: kairo | google)
  ├─ habits            (frequência, streak_atual, melhor_streak)
  ├─ habit_logs        (habit_id, data, feito)
  ├─ notes
  │
  ├─ insights          (tipo, período, payload JSON, gerado_em, lido)
  └─ sync_queue        (mutações pendentes do cliente offline)
```

**As chaves das pontes** estão marcadas: `transactions.task_id`, `transactions.goal_id`, `tasks.estimated_cost_cents`, `tasks.transaction_id`, `habits.goal_id`. São elas que tornam o Kairo diferente de "um app financeiro + um to-do na mesma casca".

### Tabelas que os dados reais obrigaram a criar

| Tabela | Por quê |
|---|---|
| `merchants` | 90% das transações vêm sem estabelecimento — cache por *fingerprint* da descrição crua, com `is_pinned` para suas correções nunca serem sobrescritas |
| `transactions.is_internal_transfer` + `transfer_pair_id` | Marca as duas pernas de uma transferência entre contas suas, que não é receita nem despesa |
| `transactions.external_category` | Guarda o rótulo cru da Pluggy junto com a sua categoria — permite auditar e reprocessar as regras |
| `transactions.raw` (jsonb) | Payload original preservado: dá para reprocessar tudo sem bater na API de novo |
| `categories.external_labels` | Mapeia "Shopping", "Gas stations" para as suas categorias em PT-BR |
| `sync_runs` | Histórico de sincronização, para diagnosticar sem depender do terminal |

---

## 7. Conexão bancária: **Meu Pluggy** (a solução para uso pessoal)

### O problema, e por que ele desaparece no seu caso

Conectar contas via Open Finance exige ser **instituição participante autorizada pelo Banco Central** — CNPJ, capital mínimo, certificação, homologação. Por isso todo mundo usa um agregador já autorizado (Pluggy, Belvo, Klavi), e os planos comerciais desses agregadores começam na casa de **R$ 2.500/mês** — inviável para um projeto pessoal.

**Mas a Pluggy tem um produto feito exatamente para o seu caso: o [Meu Pluggy](https://www.pluggy.ai/meu-pluggy).**

### O que é o Meu Pluggy

Open Finance regulado pelo BC (a Pluggy Brasil é Iniciadora de Transação de Pagamento autorizada, CNPJ 37.943.755/0001-30), com uma modalidade **gratuita e sem prazo de expiração** para quem quer conectar **as próprias contas** e consumir os dados via API no seu projeto.

| | |
|---|---|
| **Custo** | Grátis, sem expiração. O trial de 15 dias do Dashboard vale só para os recursos comerciais — o uso pessoal continua funcionando depois |
| **CNPJ** | Não exige |
| **Bancos** | 99+ instituições — Nubank, Itaú, Bradesco, Banco do Brasil, Caixa, Inter, Santander, XP, BTG… |
| **Quantidade de contas** | Sem limite declarado, desde que **todas as contas sejam suas e nominais** |
| **Dados** | Saldos, contas, transações, cartões, investimentos e identidade |
| **Limite técnico** | Ambiente de desenvolvimento: 100 *items* (conexões). Existe um teto de atualizações por CPF, compartilhado entre os items — ao atingir, as transações voltam a atualizar no mês seguinte |
| **Restrição** | **Uso pessoal apenas.** Atender clientes, conectar contas de outros CPFs ou virar produto comercial exige plano pago |

Ou seja: o limite não é técnico nem financeiro — é de escopo. E o seu escopo é exatamente o permitido.

### Como funciona na prática

```
1. Você se cadastra em meu.pluggy.ai e conecta seus bancos pela interface deles
   (consentimento Open Finance, com validação no app do banco)
                          ↓
2. No dashboard.pluggy.ai você cria uma aplicação e pega CLIENT_ID e CLIENT_SECRET
                          ↓
2b. ⚠ PASSO FÁCIL DE PERDER — vincular a conexão à aplicação:
    Dashboard → sua aplicação → "Ir para Demo" → conector "MeuPluggy"
    → login + autorização → menu de três pontos → "Copiar Item ID"
    Uma vez por banco. Só aqui nasce o itemId que a API reconhece.
    O UUID da URL do Meu Pluggy (/connections/<uuid>) NÃO serve: dá 404.
                          ↓
3. Seu backend (Edge Function) autentica e consome a API:

   POST https://api.pluggy.ai/auth
        { "clientId": "...", "clientSecret": "..." }   →  { "apiKey": "..." }

   GET  https://api.pluggy.ai/accounts?itemId=SEU_ITEM_ID
   GET  https://api.pluggy.ai/transactions?accountId=...&from=...&to=...
   GET  https://api.pluggy.ai/investments?itemId=...
        Header: X-API-KEY: <apiKey>
                          ↓
4. Um cron diário no Supabase puxa o delta, deduplica por external_id,
   categoriza o que é novo com IA e grava no seu Postgres
```

**Sobre o sync:** verificado nos dados reais que os items voltam com `nextAutoSyncAt` preenchido — a Pluggy atualiza diariamente por conta própria. Ainda assim vale ter o cron: para forçar atualização sob demanda (`PATCH /items/{id}`) e para detectar conexão parada.

> ⚠️ Confirme os limites atuais no [Dashboard](https://dashboard.pluggy.ai) e na [documentação](https://docs.pluggy.ai) antes de construir em cima — política de produto gratuito muda, e a versão consultada aqui é de agosto de 2026.

### Alternativas avaliadas

| Opção | Veredito |
|---|---|
| **Meu Pluggy** | ✅ **Escolhida.** Grátis, legal, 99+ bancos, API limpa, regulado pelo BC |
| **Belvo / Klavi / Quanto** | Bons agregadores, mas sem modalidade pessoal gratuita — exigem contrato comercial |
| **`pynubank`** | ❌ **Morto.** Desde agosto/2023 o Nubank passou a exigir verificação facial e bloqueou o acesso. O próprio repositório recomenda o Meu Pluggy como substituto |
| **APIs diretas dos bancos** (Inter, BB, Sicoob, Itaú) | Existem e são boas, mas são **para conta PJ**, com certificado digital e-CNPJ. Não servem para conta pessoal |
| **Scraping / automação de navegador** | ❌ Viola os termos de uso, quebra a cada atualização do banco, e pode gerar bloqueio da sua conta. Não vale o risco |
| **GoCardless / Nordigen** (grátis) | Só Europa e Reino Unido. Não cobre o Brasil |

### O que os dados reais revelaram (608 transações, 2 contas, 12 meses)

Validado em 26/08/2026 com o script `npm run smoke -- --days=365 --dump`. Quatro achados que mudaram decisões do projeto:

**1. A categorização já vem pronta — mas é fraca.** A Pluggy devolve `category` preenchido em 100% das transações. O problema é a qualidade: **45% caem em `Shopping`**, um balde genérico que mistura posto de gasolina, pizzaria e loja de eletrônicos. Os rótulos também vêm em inglês. Conclusão: a categoria da Pluggy serve como *palpite inicial*, e a IA continua necessária — só que para refinar e traduzir, não para classificar do zero. Mais barato, e o resultado é melhor.

**2. `merchant` vem nulo em 90% dos casos** (549 de 608). Só 59 transações trouxeram nome, CNPJ e CNAE do estabelecimento. As descrições cruas são inconsistentes entre bancos — `DEBITO VISA ELECTRON BRASIL 24/08 CARREF` contra `Compra no débito|PIZZARIA ALONZA 2`. A tabela `merchants` com *fingerprint* da descrição normalizada deixa de ser otimização e vira requisito.

**3. Transferência interna se detecta pelo CPF, não por valor+data.** Toda transação PIX (185 de 185) traz `paymentData.payer.documentNumber` e `receiver.documentNumber`. Comparar os dois CPFs identificou **6 de 6** transferências entre contas próprias. A heurística que eu tinha proposto — casar valor, data e sinal oposto — achou só 3, porque transferências para bancos não conectados não têm par visível. **Use o CPF; o casamento por valor fica como fallback para não-PIX.** Sem isso, o app contaria receita e despesa fantasma (nos seus dados, R$ 103,53 duplicados em 22/08).

**4. O sync automático roda, sim.** Os items voltaram com `nextAutoSyncAt` preenchido e `autoSyncDisabledAt: null` — a Pluggy agenda a atualização diária sozinha. O cron próprio continua valendo como rede de segurança e para forçar atualização sob demanda, mas não é a única fonte.

*Campos úteis que a documentação não destacava:* `operationType` (CARTAO, PIX, RESGATE_APLIC_FINANCEIRA, FOLHA_PAGAMENTO), `bankData.overdraftUsedLimit` (cheque especial), `merchant.cnae` (setor econômico), `connector.health`.

### Resultado do pipeline de ingestão (medido, não estimado)

O ingestor está em [`packages/core/src/pluggy/`](packages/core/src/pluggy) — funções puras, sem IO, 29 testes. O ensaio (`npm run ingest:dry`) roda contra o dump real:

| Métrica | Resultado |
|---|---|
| Linhas geradas | 608 de 608, nenhuma órfã |
| Transferências internas | 6 detectadas, todas por CPF idêntico — o casamento por valor+data não achou nenhuma a mais |
| **Receita fantasma eliminada** | **R$ 305,53** que apareciam como entrada e saída simultâneas |
| Chaves de estabelecimento | 198 para 608 transações → **67% das chamadas de IA economizadas** |
| Precisam de refinamento por IA | 441 transações (72,5%), mas só **142 chamadas** graças ao cache |
| Categorias traduzidas | 608 de 608 — os 21 rótulos observados estão mapeados |

**Bug encontrado no ensaio:** `"Resgate RDB"` (26×) e `"Aplicação RDB"` (5×) eram consumidos inteiramente pela remoção de prefixo, colapsando 31 transações de duas operações distintas numa chave vazia. Corrigido: quando a limpeza consome tudo, o rótulo é a única informação existente e é preservado.

### Métodos complementares (valem manter mesmo com o Pluggy)

Nenhum agregador cobre 100% dos casos — vale ter estes como rede de segurança e para o que ficar de fora:

1. **Importação de OFX/CSV** — todo banco brasileiro exporta extrato e fatura; serve para histórico antigo e para bancos sem conector
2. **Lançamento manual rápido** — 3 toques, com sugestão de categoria por IA; indispensável para dinheiro em espécie
3. **Foto do comprovante / print do Pix** → extração dos dados com Claude (visão)
4. **Leitura de notificações no Android** (`NotificationListenerService`) — captura "Compra aprovada R$ 45,90 IFOOD" em tempo real, antes mesmo de o Pluggy sincronizar. *No iOS é impossível: a Apple não permite ler notificações de outros apps.*

---

## 8. A IA no produto

Modelo padrão: **`claude-opus-5`** (contexto 1M, adaptive thinking). Referência de preço por milhão de tokens:

| Modelo | Entrada | Saída | Uso sugerido |
|---|---|---|---|
| `claude-opus-5` | $5,00 | $25,00 | Padrão: insights, chat com dados, planejamento de metas |
| `claude-sonnet-5` | $3,00 | $15,00 | Alternativa se quiser reduzir custo em volume |
| `claude-haiku-4-5` | $1,00 | $5,00 | Categorização em lote de altíssimo volume |

Três otimizações que derrubam o custo sem trocar de modelo:
- **Prompt caching** no bloco de regras de categorização e no plano de contas do usuário (prefixo estável, > 1024 tokens)
- **Batch API** (50% de desconto) para a categorização noturna de transações importadas
- **Cache local de merchants**: "IFOOD*" já classificado uma vez vira regra determinística — a IA só é chamada para o que é realmente novo

**Papel da IA, corrigido pelos dados reais.** Como a Pluggy já entrega uma categoria (ainda que fraca — 45% em `Shopping`), a IA deixa de ser classificadora e passa a ter três funções mais valiosas:

1. **Refinar e traduzir** — quebrar o balde `Shopping` em categorias reais em PT-BR, usando a descrição crua e o CNAE quando houver
2. **Nomear estabelecimentos** — transformar `DEBITO VISA ELECTRON BRASIL 24/08 CARREF` em `Carrefour`, gravando no cache de merchants para nunca repetir a chamada
3. **Gerar insights** — resumo diário, retrospectiva semanal e os cruzamentos finanças↔rotina, que é onde ela realmente não tem substituto

**Custo real esperado:** volume medido de ~50 transações/mês, das quais só as com *fingerprint* inédito chegam à IA — depois de algumas semanas, quase nenhuma. Com prompt caching e Batch API, a conta fica na casa de poucos dólares por mês, dominada pelos insights, não pela categorização.

*(A geração de "imagem do sonho" por IA foi removida do escopo.)*

---

## 9. Roadmap

### Fase 0 — Fundação (2 semanas)
Monorepo Expo + Tauri rodando nas 5 plataformas com uma tela de "hello world". Supabase configurado com Auth e RLS. Design system e navegação. CI (lint, types, testes, build EAS).
**Entregável:** app instalável em Android, iOS, Web e Windows, com login funcionando.

> **Feito, e bem além do "hello world".** Workspaces configurados, `apps/mobile` rodando em Expo Web com a ponte para `packages/core` provada em runtime — e a tela inicial não é um placeholder, já é a tela "Hoje" real (originalmente prevista só na Fase 2, ver abaixo). **`apps/desktop` também no ar, e funcional de verdade**: Tauri empacotando o mesmo build Web, com SQLite real por baixo (plugin do Tauri + Drizzle via proxy) — `.msi`/`.exe` gerados, banco inspecionado e confirmado correto (migrações, seed, idempotência). **Testado em Android e iPhone físicos** — achou e corrigiu um bug crítico (`crypto.randomUUID()` não existe no Hermes) que quebrava toda escrita no banco; depois do fix, os dois sistemas confirmaram funcionando. Falta: confirmar visualmente a UI do desktop renderizando os dados (acesso de automação negado numa rodada anterior), Supabase Auth/RLS conectado ao app, e CI. Detalhe completo em [Implementado: apps/mobile e a tela Hoje](#implementado-appsmobile-e-a-tela-hoje), [Implementado: apps/desktop (Tauri)](#implementado-appsdesktop-tauri), [Implementado: banco local funcional no desktop](#implementado-banco-local-funcional-no-desktop) e [Implementado: testes em dispositivo físico](#implementado-testes-em-dispositivo-físico-iosandroid--e-um-bug-crítico-que-só-apareceu-ali).

### Fase 1 — MVP financeiro (4–6 semanas)
Contas e cartões · **Integração Meu Pluggy com sync diário** · Transações manuais + import OFX/CSV · Categorias · Dashboard (entradas x saídas, donut, gasto médio, heatmap) · Categorização por IA · Offline-first.
**Entregável:** substitui a planilha, com os bancos entrando sozinhos.

> **Já feito, antes mesmo de a fase começar oficialmente — e já rodando em produção.** `packages/core/src/pluggy/` mapeia a API para o schema (fingerprint de merchant, detecção de transferência interna, normalização de sinal, 40 testes); `packages/db/src/ingest.ts` grava com upsert idempotente e testes contra Postgres real (PGlite); `scripts/sync.ts` já rodou de ponta a ponta contra as suas contas, local e remoto. **O cron está no ar**: a Edge Function `sync` foi implantada no Supabase e `kairo-sync-diario` sincroniza sozinho todo dia às 06h (Brasília), sem depender do seu computador ligado. **O que resta da fase 1 é a metade que sempre foi esperada dela: a interface.** Dashboard, telas de conta e categoria, import OFX/CSV para histórico anterior aos 12 meses do Pluggy.

Consulte a seção 5 → *[Implementado: camada de escrita e sincronização](#implementado-camada-de-escrita-e-sincronização)* para o que já roda e os bugs reais que apareceram no caminho.

### Fase 2 — MVP rotina (3–4 semanas)
Tarefas e projetos · Tela "Hoje" · Agenda (dia/semana/mês) · Hábitos com streak · Notificações locais.
**Entregável:** substitui o to-do app do usuário.

> **Fase 2 completa.** A tela "Hoje" lê e escreve de verdade no SQLite local, e **tarefas, hábitos, metas e agenda têm CRUD completo** — criar, editar, ciclar status/marcar feito/aportar, apagar, cada um com tela própria (`/tasks`, `/habits`, `/goals`, `/agenda`) navegável por cima das abas. **A sincronização SQLite ↔ Supabase está no ar**: Edge Function `sync-routine` implantada e validada com chamadas HTTP reais contra produção, last-write-wins por linha com relógio do servidor, botão manual na tela "Hoje" (`events` ainda fora do protocolo de sync — local-only por ora). **Notificações locais** para prazo de tarefa e início de evento, com o cálculo de "quando notificar" puro e testado, separado da chamada nativa. 132 testes cobrindo migração/seed/streak/CRUD/sync/agenda/lembretes.

### Fase 3 — As pontes (3 semanas) ← *o diferencial*
Contas a pagar viram tarefas · Tarefas com custo alimentam a previsão de caixa · Metas geram hábitos de aporte · Resumo diário e retrospectiva semanal por IA.
**Entregável:** o produto passa a ser algo que não existe no mercado.

### Fase 4 — Profundidade financeira (4 semanas)
Assinaturas com detecção automática · Orçamento por envelopes · Metas com projeção · Investimentos e patrimônio (também via Pluggy) · Relatórios e exportação.

### Fase 5 — Refinamento (contínuo)
Sync com Google Calendar · Chat com seus dados · Widgets iOS/Android · Notificações Android capturando compras em tempo real · Modo compartilhado com o cônjuge (atenção: contas de outro CPF exigem plano pago do Pluggy — a alternativa é ele ter o próprio Meu Pluggy).

**Total até um app completo: ~4 meses** de desenvolvimento focado.

---

## 10. Estrutura de pastas

`ui/`, `ai/` e `config/` ainda não existem. `apps/mobile`, `core/`, `db/` e `supabase/` já são reais e estão implementados:

```
kairo/
├── apps/
│   ├── mobile/                    # ✅ implementado — Expo + Expo Router, Web validado
│   │   ├── metro.config.js        #    monorepo + sourceExts('sql') + assetExts('wasm')
│   │   ├── babel.config.js        #    babel-plugin-inline-import (migrações SQL)
│   │   ├── src/db/                #    schema, client, hooks (useLiveQuery), queries
│   │   │                          #    (CRUD completo de tarefas/hábitos), seed,
│   │   │                          #    migration-gate — SQLite local (Drizzle)
│   │   ├── src/app/_layout.tsx    #    Stack real na raiz — (tabs) + tasks + habits
│   │   │                          #    como telas irmãs (expo-router/ui Tabs não
│   │   │                          #    navega para rota fora do conjunto de abas)
│   │   ├── src/app/(tabs)/        #    Hoje + Explore — grupo de abas
│   │   ├── src/app/tasks.tsx, habits.tsx, goals.tsx  # reexports — dentro de app/ o Router
│   │   │                          #    ignora .web (github.com/expo/expo/issues/37752)
│   │   ├── src/components/screens/{hoje,tasks,habits,goals,agenda}-screen.tsx  # ✅ ÚNICA versão —
│   │   │                          #    roda em nativo E em Web/Tauri (sem mais fallback por tela;
│   │   │                          #    o gate ficou em root-shell.web.tsx, ver abaixo)
│   │   ├── src/components/root-shell.tsx      # nativo: <SQLiteProvider> + MigrationGate
│   │   ├── src/components/root-shell.web.tsx  # ✅ Web/Tauri: isTauri() decide entre banco real
│   │   │                          #    (migra + povoa + libera) ou "abra no app" (navegador comum)
│   │   ├── src/components/kairo/  #    ProgressBar, SectionCard, DateTimeField (picker
│   │   │                          #    nativo compartilhado — agenda + prazo de tarefa)
│   │   ├── src/db/client.ts / client.web.ts  #    Db nativo (expo-sqlite, sync) / Db Tauri
│   │   │                          #    (sqlite-proxy + plugin SQL do Tauri, async)
│   │   ├── src/db/mappers.ts      #    ✅ linha→domínio, compartilhado por hooks.ts e hooks.web.ts
│   │   ├── src/db/hooks.ts / hooks.web.ts  #    useLiveQuery (nativo) / useLiveProxyQuery
│   │   │                          #    própria sobre change-bus.ts (Web/Tauri, sem useLiveQuery)
│   │   ├── src/db/change-bus.ts   #    ✅ pub-sub "banco mudou" — 4 testes
│   │   ├── src/db/tauri-migrate.ts #   ✅ aplica migrations.js contra o plugin do Tauri,
│   │   │                          #    idempotente via tabela própria (_kairo_migrations)
│   │   ├── src/db/sync.ts         #    ✅ motor de sincronização do app — push/pull/
│   │   │                          #    watermarks, testado contra better-sqlite3 + http real
│   │   ├── src/db/sync-config.ts  #    lê EXPO_PUBLIC_SYNC_FUNCTION_URL / _MOBILE_SYNC_SECRET
│   │   ├── src/notifications.ts   #    ✅ wrapper fino sobre expo-notifications (não testável
│   │   │                          #    em Node — só o cálculo de horário, em packages/core)
│   │   └── test/db.test.ts        #    35 testes: migração/seed/streak/CRUD (tarefas, hábitos,
│   │                              #    metas, eventos) via better-sqlite3
│   └── desktop/                   # ✅ implementado — Tauri empacotando o build Web
│       ├── package.json           #    só @tauri-apps/cli — o frontend é apps/mobile/dist
│       └── src-tauri/             #    projeto Rust + tauri.conf.json (frontendDist,
│                                  #    devUrl, before-dev/build-command)
│                                  #    Cargo.toml: tauri-plugin-sql (sqlite) — banco real
├── packages/
│   ├── core/                      # ✅ implementado — regras puras, sem UI nem rede
│   │   ├── src/index.ts           #    barril de exportação (usado por apps/mobile)
│   │   ├── src/money.ts           #    centavos, nunca float
│   │   ├── src/domain.ts          #    tarefas/hábitos/metas/agenda — mesmos nomes do schema
│   │   ├── src/reminders.ts       #    ✅ QUANDO notificar — puro, testado (ver notifications.ts)
│   │   ├── src/sync-protocol.ts   #    ✅ DTOs de sincronização + isNewer() (LWW puro)
│   │   └── src/pluggy/            #    mapeamento Pluggy → Kairo (fingerprint,
│   │                              #    transferências, categorias, cliente HTTP)
│   ├── db/                        # ✅ implementado
│   │   ├── schema.ts              #    18 tabelas (Drizzle)
│   │   ├── migrations/            #    SQL gerado
│   │   └── src/                   #    client.ts, local.ts (PGlite), ingest.ts
│   │                              #    (upserts idempotentes), sync.ts (orquestrador Pluggy),
│   │                              #    routine-sync.ts (✅ push/pull de rotina + agenda, 18 testes PGlite)
│   ├── ui/                        # ainda não criado
│   ├── ai/                        # ainda não criado — refinamento de categoria,
│   │                              # insights, chat com dados
│   └── config/                    # ainda não criado
├── scripts/                       # ✅ ferramentas de linha de comando
│   ├── pluggy-smoke-test.ts       #    teste de fumaça da API, sem banco
│   ├── ingest-dry-run.ts          #    ensaia o mapeamento contra out/, sem gravar
│   ├── sync.ts                    #    sincronização de verdade (local ou --remote)
│   ├── inspect.ts                 #    raio-x do banco local
│   └── db-migrate.ts              #    aplica as migrações no DATABASE_URL (idempotente)
├── supabase/                      # ✅ implementado e implantado
│   ├── migrations/                #    cron do sync + verificação de conexão parada — aplicado
│   ├── functions/sync/            #    Edge Function (Deno) — mesmo runSync() do CLI, no ar
│   │   └── import_map.json        #    mapeia imports Node (drizzle-orm, postgres) para Deno
│   └── functions/sync-routine/    #    ✅ Edge Function do app (SQLite ↔ Supabase), no ar
│       └── import_map.json        #    mesmo mapa do sync do Pluggy
└── PLANO.md                       # este arquivo
```

Regra de ouro, já em prática duas vezes: **schema e lógica de negócio dialect-agnósticos, testados contra um driver diferente do de produção.** `packages/core` não importa UI nem rede — testou fingerprint, transferência e categorização sem mock de banco. `packages/db/schema.ts` (pg-core) validou contra PGlite sem precisar de Docker; `apps/mobile/src/db/schema.ts` (sqlite-core) validou contra `better-sqlite3` sem precisar do runtime do Expo. O padrão se repetiu porque funciona: separar o schema/lógica do driver real é o que torna a lógica testável em Node puro, rápido, sem simulador nem servidor.

---

## 11. Riscos e decisões em aberto

| Risco | Impacto | Mitigação |
|---|---|---|
| Pluggy mudar a política do plano pessoal | Perde o sync automático | ✅ **Mitigado pelo modelo de dados**, já implementado: `source` + `external_id` isolam a origem. Import OFX/CSV continua funcionando como plano B |
| Teto de atualizações por CPF | Transações param de atualizar até o mês seguinte | ✅ **Cron diário já rodando** (`kairo-sync-diario`, 06h Brasília) — não de hora em hora; delta via `countExisting`, não full |
| Conector de um banco específico quebrar | Uma conta some do painel | ✅ **Implantado, ativo, e com lugar na UI**: `kairo_conexoes_paradas()` roda no Supabase (0 problemas em 26/08/2026), e a tela "Hoje" já tem o bloco "Precisa de atenção" pronto para recebê-la — falta só trocar o mock pela consulta real |
| Escopo grande demais (finanças + rotina) | Nada fica bom | Fases 1 e 2 são independentes e entregáveis; a ponte (fase 3) só vem depois de os dois lados funcionarem |
| Sincronização offline com conflitos | Bugs difíceis, perda de dados | Last-write-wins por campo + log de mutações; testes de conflito desde a fase 0. **Precedente já validado**: o upsert de transações usa a mesma lógica de "origem sempre vence, seus campos nunca são tocados" — ver seção 5 |
| Custo de IA cresce com o uso | Conta inesperada | Cache de merchants, prompt caching, Batch API; alerta de gasto na conta Anthropic |
| Tauri + Expo Web ainda pouco trilhado | Atrito na fase 0 | Validar o caminho completo já na fase 0, antes de qualquer feature |
| Projeto pessoal perder tração no meio | Fica sem terminar | Fases curtas e cada uma já utilizável; usar o app de verdade desde a fase 1. **Já em prática**: dados reais rodando antes mesmo do fim da fase 1 |
| SQL gerado por LLM tem bug sutil de primeira | Corrompe dados financeiros sem avisar | Confirmado nesta implementação: 3 bugs reais só apareceram rodando contra dados de verdade (um deles numa correção do bug anterior). **Regra adotada**: toda query de escrita precisa de teste contra Postgres real (PGlite), nunca só contra mock — ver seção 5 |

**Decisões que dependem de você:**
1. ~~Comercial ou pessoal?~~ ✅ **Pessoal** — Open Finance destravado via Meu Pluggy
2. ~~Mobile ou desktop é a plataforma principal?~~ ✅ **Mobile + web primeiro** — decidido em 26/08/2026, `apps/mobile` já rodando em Expo Web
3. Prazo desejado para a primeira versão utilizável?
4. ~~Nuvem ou local?~~ ✅ **As duas, e a nuvem já está em produção** — `npm run sync` grava local (PGlite), `--remote` usa o Supabase; o cron sincroniza sozinho no Supabase todo dia. A pergunta que resta não é mais "qual", é apenas quando o app vai ler do Supabase em vez do dispositivo local — decisão da fase 0/1, não mais em aberto

---

## 12. Próximos passos imediatos

**Concluído** — conexão bancária, mapeamento, persistência e infraestrutura, de ponta a ponta, **em produção**:

- ~~Criar a conta no Meu Pluggy e conectar um banco~~ ✅ 2 bancos conectados (Santander, Nubank)
- ~~Rodar o teste de fumaça da API~~ ✅ [`scripts/pluggy-smoke-test.ts`](scripts/pluggy-smoke-test.ts)
- ~~Validar o mapeamento contra dados reais~~ ✅ [`scripts/ingest-dry-run.ts`](scripts/ingest-dry-run.ts) — 608 transações, R$ 305,53 de receita fantasma eliminados
- ~~Camada de escrita idempotente~~ ✅ [`packages/db/src/ingest.ts`](packages/db/src/ingest.ts), 11 testes contra Postgres real
- ~~Primeira sincronização de verdade~~ ✅ local e remota — 608 transações nos dois lados, sem duplicatas
- ~~Criar o projeto Supabase~~ ✅ `okyxlkivdndmwxttrzey`, região us-west-2
- ~~`db:migrate` e `sync -- --remote`~~ ✅ schema aplicado (idempotente), dados sincronizados
- ~~Deploy da Edge Function `sync`~~ ✅ no ar, testada (`HTTP 200`) — três bugs reais resolvidos no caminho, ver seção 5
- ~~Cron de sincronização diária~~ ✅ **ativo**: `kairo-sync-diario`, 06h Brasília, sem depender do seu computador ligado
- ~~Decidir mobile vs. desktop~~ ✅ **Mobile + web primeiro**
- ~~Workspaces do monorepo~~ ✅ `@kairo/core` e `@kairo/db` instaláveis como pacotes de verdade
- ~~Scaffold do `apps/mobile`~~ ✅ Expo + Router, rodando em Expo Web, ponte com `packages/core` provada em runtime
- ~~Tela "Hoje"~~ ✅ os cinco blocos do plano (saldo, vencimentos, prioridades, hábitos, meta) renderizando
- ~~Persistência local (SQLite)~~ ✅ schema, migração, seed, leitura reativa (`useLiveQuery`) e escrita (toggle de hábito) — 10 testes contra SQLite real, tela "Hoje" lendo e escrevendo de verdade
- ~~Fallback para Web~~ ✅ mensagem explicativa no lugar de travar em "preparando…" — e, no processo, um bug real e documentado do Expo Router ([expo/expo#37752](https://github.com/expo/expo/issues/37752)) identificado e contornado, não só mascarado
- ~~CRUD de tarefas e hábitos~~ ✅ criar/editar/ciclar status/apagar, telas próprias (`/tasks`, `/habits`) navegáveis por cima das abas — exigiu reestruturar a navegação (grupo `(tabs)` + `Stack` na raiz) e corrigir um bug real de fuso horário (UTC vs. local) que os próprios testes pegaram no meio da sessão
- ~~CRUD de metas~~ ✅ criar/editar/apagar/aportar, com marcação automática de `achieved` ao bater o alvo (só quando ativa) — tela `/goals` reaproveitando a correção de navegação sem ajuste extra, prova de que era estrutural
- ~~Sincronizar o SQLite local com o Supabase~~ ✅ protocolo compartilhado, motor Postgres (13 testes PGlite) e motor do app (9 testes SQLite+HTTP real), Edge Function `sync-routine` implantada e validada com chamadas HTTP reais contra produção (401 sem segredo, 200 com segredo, push+pull íntegros), botão manual na tela "Hoje" — 116 testes no total
- ~~Agenda e notificações locais~~ ✅ CRUD de eventos (`/agenda`, dia a dia com navegação prev/próximo), prazo de tarefa com lembrete, cálculo de "quando notificar" puro e testado separado da chamada nativa (`expo-notifications`), seletor de data/hora nativo compartilhado entre agenda e tarefas — 132 testes no total, Fase 2 completa
- ~~Tauri para desktop~~ ✅ `apps/desktop` empacotando o build Web do Expo — `.msi` e `.exe` (NSIS) gerados e testados abrindo de verdade numa janela nativa (~9 MB o binário). Único obstáculo real foi o Smart App Control do Windows bloqueando a compilação Rust — resolvido desligando a política (sua decisão, é irreversível sem reinstalar o Windows). Funcionalidade real (banco local) fica para depois, por escopo — hoje mostra os mesmos fallbacks Web
- ~~Vincular evento a tarefa pela UI~~ e ~~incluir `events` na sincronização com o Supabase~~ ✅ mesmo protocolo de sync já existente, estendido; chips de tarefa no formulário da agenda; validado com push/pull reais contra produção — 138 testes no total
- ~~Banco local funcional no desktop~~ ✅ SQLite de verdade via plugin do Tauri (`sqlx`/Rust) + Drizzle por `sqlite-proxy`, migrações e reatividade próprias (`useLiveQuery` não existe para driver-proxy), as 5 telas de fallback Web substituídas por um gate único (`isTauri()`). Verificado abrindo o `.db` real que o app criou: migrações e dados de exemplo corretos, idempotente entre execuções — 142 testes no total
- ~~Testes em dispositivo físico (iOS/Android)~~ ✅ primeiro teste real do projeto num aparelho físico — achou de cara um bug crítico (`crypto.randomUUID()` não existe no Hermes, quebrava toda escrita) que nenhum teste automatizado (Node/navegador/Tauri) jamais pegaria. Corrigido com UUID v4 em JS puro, sem dependência nova. Confirmado funcionando em Android e iPhone reais, depois do fix — 145 testes no total
- ~~Skill de README, repositório git e CI~~ ✅ skill `update-readme` documentando como manter o README (referência prática) separado do PLANO.md (narrativa); primeiro commit do projeto (168 arquivos) e push para [github.com/Tidlle/projeto-Kairo](https://github.com/Tidlle/projeto-Kairo); GitHub Actions rodando type-check + lint + testes a cada push/PR; ESLint configurado pela primeira vez, achou e corrigiu 1 problema real de código antigo

**Pendente — só você pode fazer:**

1. **Fechar o nome** — verificar `kairo.app`, `usekairo.com`, `kairo.com.br` (registro no INPI é opcional para uso pessoal)
2. **Responder a decisão 3** da seção 11 (prazo para a primeira versão utilizável — as demais já estão resolvidas)
3. **Escrever o `docs/DECISOES.md`** registrando cada escolha de arquitetura e o porquê — o material bruto já existe: três rodadas de deploy da Edge Function, a ponte Metro, o bug de roteamento do Expo Router, e o bug de fuso horário, cada um com uma causa raiz diferente (seção 5)
4. **Considerar revogar o Personal Access Token** usado para o deploy, em [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) — ele dá acesso à conta inteira, não só a este projeto, e já cumpriu a função
5. **Apagar a linha de teste `"Teste de sync de evento"`** da tabela `events` em produção — não consegui remover pelo psql local (porta 6543 bloqueada na rede local no momento, ver seção anterior); dá pra apagar direto pelo Table Editor do Supabase, ou de outra rede
6. **Abrir o app Kairo instalado e olhar a tela "Hoje" de verdade** — já está instalado (`%LOCALAPPDATA%\Kairo`, atalho "Kairo" no menu Iniciar), mas o acesso automatizado para eu mesmo confirmar visualmente foi negado; vale só abrir e conferir que os dados de exemplo aparecem, e testar criar uma tarefa
7. **Conferir a primeira execução do CI** em [github.com/Tidlle/projeto-Kairo/actions](https://github.com/Tidlle/projeto-Kairo/actions) — validado localmente antes do push, mas vale confirmar que passa de verdade no runner do GitHub

---

*Plano gerado a partir da análise do vídeo `exemplo_trilhaIA.mp4`. Criado em 26/08/2026; revisado no mesmo dia em catorze momentos: com o escopo de uso pessoal e a integração Meu Pluggy; após a camada de escrita e a primeira sincronização real; após o deploy completo da infraestrutura — Edge Function e cron ativos em produção; após o scaffold do `apps/mobile` com a tela "Hoje" renderizando de ponta a ponta; após a persistência local (SQLite) — leitura e escrita reais, com o fallback Web resolvendo um bug documentado do Expo Router; após o CRUD de tarefas e hábitos — navegação reestruturada e um bug real de fuso horário corrigido no meio da sessão; após o CRUD de metas, completando o trio; após a sincronização SQLite ↔ Supabase — last-write-wins por linha com relógio do servidor, validada com chamadas HTTP reais contra produção; após a Agenda e as notificações locais, fechando a Fase 2 por completo; após o Tauri para desktop — empacotamento provado de ponta a ponta, incluindo destravar um bloqueio real do Smart App Control do Windows; após fechar os dois pontos em aberto da agenda — eventos na sincronização e o vínculo evento↔tarefa pela UI; após o banco local funcional no desktop — SQLite de verdade via plugin do Tauri, verificado direto no arquivo que o app criou; após o primeiro teste em dispositivo físico — um bug crítico real (`crypto` ausente no Hermes) encontrado e corrigido, Android e iPhone confirmados funcionando; e após o projeto virar um repositório git de verdade, com CI rodando no GitHub.*
