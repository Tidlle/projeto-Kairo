---
name: update-readme
description: Atualiza o README.md da raiz do projeto Kairo com detalhes precisos sobre o estado atual do código. Use ao final de qualquer tarefa de implementação neste repositório — nova funcionalidade, correção de bug, mudança de arquitetura, nova dependência, mudança de infraestrutura (Supabase, Tauri, CI) — antes de considerar a tarefa concluída. Não use para perguntas que não mudam código.
---

# Atualizar o README do Kairo

Esta skill mantém o [`README.md`](../../../README.md) da raiz sempre fiel ao que o código faz de verdade — não ao que o plano previa fazer. É a referência prática ("como rodar, o que já funciona, o que falta"); [`PLANO.md`](../../../PLANO.md) é o diário narrativo (decisões, bugs encontrados, o porquê de cada escolha) e **não deve ser confundido nem duplicado aqui**.

## Quando rodar

Ao final de qualquer rodada de trabalho neste repositório que:
- adicionou ou removeu uma funcionalidade visível (uma tela, um comando, um endpoint, uma tabela);
- mudou como rodar, testar ou implantar alguma parte do projeto;
- adicionou/removeu uma dependência que afeta como configurar o ambiente;
- mudou uma variável de ambiente necessária;
- alterou a contagem de testes ou o resultado de `npm test`/`tsc --noEmit`.

Não rode por perguntas, explicações, ou leitura de código sem alteração.

## Passo a passo

1. **Leia o `README.md` atual inteiro** antes de tocar nele — nunca reescreva às cegas. A estrutura de seções já existente é a estrutura a preservar; edite dentro dela, não substitua o arquivo do zero (a menos que ele não exista ainda).

2. **Descubra o que mudou de verdade nesta sessão**, não o que você acha que devia ter mudado:
   - Se o projeto for um repositório git nesse momento (`git status`/`git diff` funcionam), use-os como fonte primária.
   - Sem git (era o caso original deste projeto), reconstrua a partir do que você mesmo fez na conversa: quais arquivos criou/editou, quais comandos rodou, qual foi o resultado real (não o esperado) — teste real, build real, chamada HTTP real.

3. **Atualize só as seções afetadas.** Seções típicas do README deste projeto e quando cada uma muda:
   - **Estado atual** — sempre que uma funcionalidade nova entra no ar ou sai do papel de "pendente" para "implementado". Inclui a contagem de testes (`npm test` na raiz) — confira o número de verdade, não repita o antigo.
   - **Como rodar** — sempre que um comando novo for adicionado a algum `package.json`, ou o jeito de rodar algo mudar (ex.: uma nova plataforma, um novo modo de dev).
   - **Configuração / variáveis de ambiente** — sempre que uma env var for adicionada, removida ou renomeada. **Nunca inclua o valor real de uma variável, só o nome e uma frase sobre onde consegui-lo** (ex.: "gerado com `crypto.randomUUID()`", "painel do Supabase → Settings → API").
   - **Infraestrutura** — sempre que algo mudar no Supabase (nova Edge Function, nova migração, novo cron) ou no Tauri (novo plugin Rust, nova capability).
   - **Limitações conhecidas** — sempre que uma limitação for resolvida (remova a linha) ou uma nova for descoberta (adicione, com uma frase objetiva do porquê).

4. **Nível de detalhe: referência técnica precisa, não narrativa.** Diga O QUE existe e COMO usar — não conte a história de como chegou lá (bugs encontrados, tentativas anteriores, o raciocínio da decisão). Isso é o que distingue o README do PLANO.md. Uma frase como "sincronização via Edge Function `sync-routine`, protocolo last-write-wins" é apropriada aqui; o parágrafo inteiro sobre o bug de placeholder `?` vs `$1` do plugin do Tauri pertence ao PLANO.md, não aqui.

5. **Verifique antes de documentar, não documente por suposição.** Se vai escrever "142 testes passando", rode `npm test` de verdade primeiro. Se vai escrever um comando (`npm run build:web`), confira que ele existe no `package.json` correspondente.

6. **Nunca edite `PLANO.md` a partir desta skill.** Se achar que algo também merece uma entrada narrativa lá (um bug real encontrado, uma decisão de arquitetura), mencione isso ao usuário em vez de editar os dois arquivos na mesma passada — são documentos com donos de decisão diferentes dentro do fluxo deste projeto.

7. Escreva em português, mesmo estilo do resto da documentação do projeto (direto, sem enfeite, números reais em vez de adjetivos).
