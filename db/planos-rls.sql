-- ============================================================================
-- RLS de planos — permitir super admin CRIAR / EDITAR / EXCLUIR
-- ----------------------------------------------------------------------------
-- Corrige: "new row violates row-level security policy for table planos".
-- A tabela já tinha policy de UPDATE (edição antiga funcionava), mas faltava
-- INSERT/DELETE. Esta policy `for all` cobre os três para o super admin.
--
-- É ADITIVA (permissiva): NÃO remove a policy de leitura existente — os apps
-- das empresas continuam lendo os planos normalmente. Idempotente.
--
-- Rodar no SQL Editor do Supabase.
-- ============================================================================

-- Conferir o que já existe (opcional):
-- select policyname, cmd, roles, qual, with_check
--   from pg_policies where schemaname='public' and tablename='planos'
--  order by policyname;

alter table public.planos enable row level security;

drop policy if exists planos_admin_write on public.planos;
create policy planos_admin_write on public.planos
  for all
  to authenticated
  using      (exists (select 1 from public.super_admins sa where sa.usuario_id = auth.uid()))
  with check (exists (select 1 from public.super_admins sa where sa.usuario_id = auth.uid()));

-- Observação: se o seu projeto identifica super admin por uma FUNÇÃO
-- (ex.: eh_super_admin(auth.uid())) em vez da tabela super_admins, troque as
-- duas expressões acima por:  eh_super_admin(auth.uid())
