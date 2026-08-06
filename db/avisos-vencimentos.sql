-- ============================================================================
-- Etapa 5 — Avisos agendados de vencimento (e-mail)
-- Pré-requisitos já rodados: db/vencimentos.sql e db/fornecedor-contrato-indice.sql
-- E a Edge Function notify-new-ticket já redeployada com o evento
-- 'avisos_vencimentos'.
-- ============================================================================

-- ─── 1. Marcador anti-repetição do aviso de contrato ─────────────────────────
alter table public.fornecedores
  add column if not exists contrato_avisado_em date;
comment on column public.fornecedores.contrato_avisado_em is 'Data do último aviso de contrato a vencer (evita reenvio diário).';

-- ─── 2. Extensões de agendamento ─────────────────────────────────────────────
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ─── 3. Job diário: chama a Edge Function 1x/dia ─────────────────────────────
-- 11:00 UTC = 08:00 no horário de Brasília (BRT, UTC-3).
-- ⚠️ Troque <SERVICE_ROLE_KEY> pela service_role key do projeto
--    (Dashboard → Project Settings → API → service_role, secret).
--    Ela fica visível só para o role postgres na tabela cron.job.
--
-- Reexecutar este bloco apenas ATUALIZA o job (mesmo nome).
select cron.schedule(
  'avisos-vencimentos-diario',
  '0 11 * * *',
  $$
  select net.http_post(
    url     := 'https://pfcczxhaymwhdgaiidag.supabase.co/functions/v1/notify-new-ticket',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body    := jsonb_build_object('evento', 'avisos_vencimentos')
  );
  $$
);

-- Conferir se ficou agendado:
--   select jobname, schedule, active from cron.job where jobname = 'avisos-vencimentos-diario';
-- Remover (se precisar):
--   select cron.unschedule('avisos-vencimentos-diario');
