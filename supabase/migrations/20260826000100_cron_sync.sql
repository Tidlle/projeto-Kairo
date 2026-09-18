-- Kairo — agendamento da sincronização diária
--
-- Aplique DEPOIS da migração de schema (packages/db/migrations) e DEPOIS de
-- fazer o deploy da Edge Function `sync`.
--
-- Antes de rodar, substitua:
--   <PROJECT_REF>  → o ref do seu projeto Supabase
--   <SYNC_SECRET>  → o mesmo valor definido em `supabase secrets set SYNC_SECRET=...`

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ─────────────────────────────────────────────────────────────
-- Sync diário às 06:00 (horário de Brasília = 09:00 UTC)
--
-- A Pluggy já roda o auto-sync dela; este job existe para trazer os dados
-- para o SEU banco, que é o que o app lê.
-- ─────────────────────────────────────────────────────────────

select cron.unschedule('kairo-sync-diario')
where exists (select 1 from cron.job where jobname = 'kairo-sync-diario');

select cron.schedule(
  'kairo-sync-diario',
  '0 9 * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/sync?days=90',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'x-sync-secret', '<SYNC_SECRET>'
               ),
    timeout_milliseconds := 120000   -- sync de várias contas passa de 30s
  );
  $$
);

-- ─────────────────────────────────────────────────────────────
-- Verificação semanal de conexões paradas
--
-- Conexão bancária quebra em silêncio: o consentimento expira, o banco pede
-- MFA de novo, o login falha. Sem este aviso, você só descobre quando estranhar
-- que faz uma semana que nada entra.
-- ─────────────────────────────────────────────────────────────

create or replace function kairo_conexoes_paradas()
returns table (connector_name text, status text, dias_sem_sync numeric)
language sql
stable
as $$
  select c.connector_name,
         c.status::text,
         round(extract(epoch from (now() - coalesce(c.last_synced_at, c.created_at))) / 86400, 1)
  from connections c
  where c.status <> 'UPDATED'
     or c.last_synced_at is null
     or c.last_synced_at < now() - interval '3 days'
  order by 3 desc;
$$;

comment on function kairo_conexoes_paradas is
  'Conexões que precisam de atenção: status ruim ou sem sync há mais de 3 dias.';

-- ─────────────────────────────────────────────────────────────
-- Diagnóstico
-- ─────────────────────────────────────────────────────────────
--
--   select * from cron.job;                               -- jobs agendados
--   select * from cron.job_run_details                    -- últimas execuções
--     order by start_time desc limit 10;
--   select * from sync_runs order by started_at desc limit 10;   -- o que o sync fez
--   select * from kairo_conexoes_paradas();               -- o que quebrou
