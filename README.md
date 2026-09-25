# Kairo

[![CI](https://github.com/Tidlle/projeto-Kairo/actions/workflows/ci.yml/badge.svg)](https://github.com/Tidlle/projeto-Kairo/actions/workflows/ci.yml)

Gestão diária: finanças pessoais + rotina (tarefas, hábitos, metas, agenda) num só app, com uma base de código para mobile, web e desktop.

> Este README é a referência prática — o que existe e como rodar. Para o histórico de decisões, bugs reais encontrados e o porquê de cada escolha de arquitetura, ver [`PLANO.md`](PLANO.md).

## Estado atual

Repositório: [github.com/Tidlle/projeto-Kairo](https://github.com/Tidlle/projeto-Kairo).

**145 testes passando** (`npm test` na raiz), type-check limpo em todo o monorepo.

| Área | Estado |
|---|---|
| Conexão bancária (Meu Pluggy) + ingestão | ✅ Em produção — cron diário no Supabase |
| Tela "Hoje" (saldo, vencimentos, prioridades, hábitos, meta) | ✅ — confirmado em Android e iPhone físicos |
| CRUD de tarefas, hábitos, metas | ✅ — confirmado em Android e iPhone físicos |
| Agenda (eventos, vínculo com tarefa) | ✅ |
| Notificações locais (prazo de tarefa, início de evento) | ✅ (cálculo puro testado; comportamento real não roda no Expo Go, ver [Limitações](#limitações-conhecidas)) |
| Sincronização SQLite local ↔ Supabase | ✅ |
| App desktop (Tauri) com banco local funcional | ✅ (banco verificado; UI não confirmada visualmente ainda) |
| Testes em dispositivo físico (iOS/Android) | ✅ Android e iPhone testados |
| Identidade visual (ícone, tema escuro fixo, tipografia Fraunces/Inter) | ✅ — ver [Identidade visual](#identidade-visual) |
| CI (lint, types, testes automatizados) | ✅ GitHub Actions, roda a cada push/PR para `main` |
| Dashboard financeiro (entradas/saídas, categorias, heatmap) | ⏳ pendente |

## Arquitetura

Monorepo com npm workspaces:

```
kairo/
├── apps/
│   ├── mobile/     # Expo + Expo Router — iOS, Android e Web (react-native-web)
│   └── desktop/    # Tauri 2 — empacota o build Web do apps/mobile, com plugin SQL próprio
├── packages/
│   ├── core/       # Regras de negócio puras — sem UI, sem rede, sem I/O de banco
│   └── db/         # Schema Postgres (Drizzle) + camada de sincronização com o Supabase
├── supabase/       # Edge Functions (Deno) + migrações SQL
└── scripts/        # Ferramentas de linha de comando (smoke test, ingestão, sync manual)
```

| Camada | Tecnologia |
|---|---|
| Linguagem | TypeScript (strict) |
| UI mobile/web | Expo SDK + Expo Router (React Native + react-native-web) |
| Desktop | Tauri 2 (Rust) |
| Banco local (app) | SQLite — `expo-sqlite` (iOS/Android) ou `@tauri-apps/plugin-sql` (desktop), ambos via Drizzle ORM |
| Banco remoto | Postgres (Supabase) |
| Backend | Supabase (Postgres + Edge Functions + Cron) |
| Open Finance | Meu Pluggy (gratuito para uso pessoal) |
| ORM | Drizzle |
| Testes | `node:test` nativo — sempre contra bancos reais (PGlite para Postgres, `better-sqlite3` para SQLite), nunca mock |

## Como rodar

Instalar dependências (raiz do monorepo):

```bash
npm install
```

### Mobile (Expo)

```bash
npm run web -w @kairo/mobile      # Web, em http://localhost:8081
npm run ios -w @kairo/mobile      # simulador iOS (macOS)
npm run android -w @kairo/mobile  # emulador/dispositivo Android
```

Para rodar num celular de verdade via Expo Go, use `npx expo start` dentro de `apps/mobile` e escaneie o QR code — ver [Testes em dispositivo físico](#testes-em-dispositivo-físico) abaixo.

### Desktop (Tauri)

```bash
npm run dev -w @kairo/desktop     # janela nativa, aponta pro servidor Expo Web local
npm run build -w @kairo/desktop   # gera .msi e .exe (NSIS) em apps/desktop/src-tauri/target/release/bundle/
```

Requer o toolchain Rust (`rustup`) e, no Windows, o Visual Studio Build Tools (componente C++) instalados.

### Sincronização financeira (Pluggy → Postgres)

```bash
npm run smoke        # testa a conexão com a API da Pluggy, sem gravar nada
npm run ingest:dry    # ensaia o mapeamento contra um dump salvo, sem gravar
npm run sync           # sincroniza de verdade — grava no PGlite local (data/kairo)
npm run sync -- --remote  # mesma sincronização, mas grava direto no Supabase
npm run db:migrate     # aplica as migrações do Postgres no banco apontado por DATABASE_URL
npm run inspect         # raio-x do banco local (contagens, últimas transações)
```

### Testes e type-check

```bash
npm test                                    # todos os testes do monorepo
npx tsc --noEmit                            # type-check na raiz (packages/core, packages/db)
(cd apps/mobile && npx tsc --noEmit)        # type-check do app mobile (config própria)
(cd apps/mobile && npx expo lint)           # lint (ESLint, config gerada pela Expo)
```

Esses quatro comandos são exatamente os que o CI roda a cada push — ver [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

## Configuração / variáveis de ambiente

### `.env` na raiz (servidor/scripts — nunca comitado)

| Variável | Para quê |
|---|---|
| `DATABASE_URL` | Conexão Postgres usada pelos scripts locais e pela Edge Function `sync` |
| `PLUGGY_CLIENT_ID` / `PLUGGY_CLIENT_SECRET` | Credenciais da aplicação no [dashboard.pluggy.ai](https://dashboard.pluggy.ai) |
| `PLUGGY_ITEM_IDS` | IDs dos bancos conectados (obtidos via Meu Pluggy, ver PLANO.md §7) |
| `SYNC_SECRET` | Segredo server-to-server que protege a Edge Function `sync` (cron do Pluggy) |
| `MOBILE_SYNC_SECRET` | Segredo separado que protege a Edge Function `sync-routine` (chamada pelo app) — gerado com `crypto.randomUUID()` |
| `KAIRO_USER_ID` | UUID do usuário único deste projeto (uso pessoal, sem multi-tenancy) |

### `apps/mobile/.env` (embutido no bundle do app — cliente, não é segredo forte)

| Variável | Para quê |
|---|---|
| `EXPO_PUBLIC_SYNC_FUNCTION_URL` | URL completa da Edge Function `sync-routine` |
| `EXPO_PUBLIC_MOBILE_SYNC_SECRET` | O mesmo valor de `MOBILE_SYNC_SECRET` acima |

### Secrets do Supabase (`npx supabase secrets set ...`)

Espelham as variáveis do `.env` da raiz que a Edge Function precisa em runtime: `DATABASE_URL`/`SUPABASE_DB_URL`, `SYNC_SECRET`, `MOBILE_SYNC_SECRET`, `KAIRO_USER_ID`, mais `PLUGGY_CLIENT_ID`/`PLUGGY_CLIENT_SECRET`/`PLUGGY_ITEM_IDS`.

## Infraestrutura (Supabase)

- Projeto: `okyxlkivdndmwxttrzey` (região `us-west-2`).
- **Edge Functions**: `sync` (cron diário, sincroniza Pluggy → Postgres) e `sync-routine` (chamada pelo app, sincroniza tarefas/hábitos/metas/agenda entre o SQLite local e o Postgres).
- **Cron**: `kairo-sync-diario`, `pg_cron` + `pg_net`, roda `sync` todo dia às 09:00 UTC (06h Brasília).
- Deploy de uma função: `npx supabase functions deploy <nome> --use-api --no-verify-jwt --import-map supabase/functions/<nome>/import_map.json`.
- Migrações do Postgres em [`packages/db/migrations/`](packages/db/migrations) — geradas com `npm run db:generate`, aplicadas com `npm run db:migrate`.

## Testes em dispositivo físico

Já testado com sucesso em Android e iPhone reais, via Expo Go. Para reproduzir:

1. Instale o app **Expo Go** (App Store / Google Play).
2. Dentro de `apps/mobile`, rode `npx expo start`.
3. Escaneie o QR code exibido no terminal com a câmera (iOS) ou o app Expo Go (Android) — o celular precisa estar na mesma rede Wi-Fi do computador.

O Expo Go não suporta mais `expo-notifications` completamente desde o SDK 53 — um aviso aparece na inicialização. Para validar notificações locais de verdade é preciso um development build (`eas build` ou `expo prebuild`), não coberto ainda.

## Identidade visual

- **Tema**: sempre escuro, não segue a preferência do sistema (`apps/mobile/src/hooks/use-color-scheme.ts` retorna `'dark'` de forma fixa). Cores em `apps/mobile/src/constants/theme.ts` (`Colors.dark`/`Colors.light` — o claro existe no código mas não é usado hoje).
- **Tipografia**: Fraunces (display — títulos e o logotipo "kairo", em itálico em alguns cabeçalhos de tela) + Inter (corpo de texto e números, incluindo o estilo `money` com dígitos tabulares).
- **Ícone do app**: a letra grega kappa (κ), primeira letra de "Καιρός" — origem do nome do app. Fontes em `apps/mobile/assets/images/` (`icon.png`, `android-icon-*.png`, `favicon.png`, `splash-icon.png`); a mesma marca aparece animada na abertura do app via `kappa-glyph.png` (`apps/mobile/src/components/animated-icon.tsx`).

## Limitações conhecidas

- **SQLite não funciona num navegador comum** — `expo-sqlite` não tem suporte estável a Web. O preview em `npm run web` mostra uma mensagem explicativa em vez de dados reais; os dados de verdade só existem no app mobile (iOS/Android) e no app desktop (Tauri, que usa um banco SQLite próprio via Rust, não o `expo-sqlite`).
- **UI do app desktop ainda não confirmada visualmente** — o banco local do Tauri foi validado inspecionando o arquivo `.db` gerado diretamente, mas não houve confirmação visual de que a interface renderiza os dados corretamente.
- **Notificações locais não testadas fisicamente** — o Expo Go não suporta `expo-notifications` completamente (SDK 53+); só o cálculo de horário (puro) e o wrapper são testados, não o disparo real da notificação num aparelho.
- **`events` (agenda) sincroniza, mas sem recorrência** — campos como `recurrenceRule`/`origin`/`externalId` já existem no schema do Postgres (pensados para uma futura integração com Google Calendar) mas não são usados ainda.
- **CI cobre só o que roda em Node puro** — type-check, lint e testes. Build do app desktop (precisa de Rust/toolchain nativo), publicação do mobile via EAS (precisa de credenciais) e testes em dispositivo físico ficam de fora, por ora.

## Documentação adicional

[`PLANO.md`](PLANO.md) — o plano completo do projeto: proposta de valor, modelo de dados, todas as decisões de arquitetura já tomadas (e o porquê), o histórico detalhado de cada rodada de implementação com os bugs reais encontrados no caminho, e o roadmap.
