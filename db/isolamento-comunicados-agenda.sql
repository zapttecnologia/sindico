-- ============================================================================
-- Isolamento por EMPRESA — Comunicados, Anexos de comunicado e Agenda (eventos)
-- ----------------------------------------------------------------------------
-- Objetivo: nenhum comunicado, anexo ou evento pode aparecer em outra empresa
-- (outra "estrutura de síndico" cadastrada no painel super admin).
--
-- As tabelas `comunicados` e `eventos` NÃO têm coluna empresa_id — o vínculo com
-- a empresa é feito via condominios.empresa_id. Estas policies fecham o acesso
-- por esse caminho, no mesmo padrão de db/vencimentos.sql.
--
-- Rodar no SQL Editor do Supabase. Idempotente (drop policy if exists + create).
--
-- ATENÇÃO: este script SUBSTITUI as policies dessas tabelas. Antes de rodar,
-- confira as policies atuais com a consulta da seção 0 e compare os papéis.
-- ============================================================================

-- ─── 0. INSPEÇÃO (rode isto primeiro para ver o que já existe) ───────────────
-- select tablename, policyname, cmd, roles, qual, with_check
--   from pg_policies
--  where schemaname = 'public'
--    and tablename in ('comunicados','comunicado_anexos','eventos')
--  order by tablename, policyname;

-- ─── Expressões reutilizadas (documentação) ─────────────────────────────────
-- GESTOR do condomínio X (pode ler E escrever):
--   • síndico vinculado:  tem_acesso_condominio(auth.uid(), X)
--   • super admin:        existe em super_admins
--   • admin da MESMA empresa dona do condomínio X
-- LEITOR adicional (só leitura):
--   • conselheiro do condomínio X → vê tudo do condomínio
--   • morador do condomínio X     → vê apenas publico = 'moradores'

-- ============================================================================
-- 1. COMUNICADOS
-- ============================================================================
alter table public.comunicados enable row level security;

-- Leitura
drop policy if exists comunicados_select on public.comunicados;
create policy comunicados_select on public.comunicados
  for select to authenticated
  using (
    public.tem_acesso_condominio(auth.uid(), condominio_id)
    or exists (select 1 from public.super_admins sa where sa.usuario_id = auth.uid())
    or exists (
      select 1 from public.perfis p
      join public.condominios c on c.id = comunicados.condominio_id
      where p.id = auth.uid() and p.papel = 'admin' and p.empresa_id = c.empresa_id
    )
    or exists (
      select 1 from public.perfis p
      where p.id = auth.uid() and p.papel = 'conselheiro'
        and p.condominio_id = comunicados.condominio_id
    )
    or exists (
      select 1 from public.perfis p
      where p.id = auth.uid() and p.papel = 'morador'
        and p.condominio_id = comunicados.condominio_id
        and comunicados.publico = 'moradores'
    )
  );

-- Escrita (criar/editar/excluir) — só gestores do condomínio
drop policy if exists comunicados_write on public.comunicados;
create policy comunicados_write on public.comunicados
  for all to authenticated
  using (
    public.tem_acesso_condominio(auth.uid(), condominio_id)
    or exists (select 1 from public.super_admins sa where sa.usuario_id = auth.uid())
    or exists (
      select 1 from public.perfis p
      join public.condominios c on c.id = comunicados.condominio_id
      where p.id = auth.uid() and p.papel = 'admin' and p.empresa_id = c.empresa_id
    )
  )
  with check (
    public.tem_acesso_condominio(auth.uid(), condominio_id)
    or exists (select 1 from public.super_admins sa where sa.usuario_id = auth.uid())
    or exists (
      select 1 from public.perfis p
      join public.condominios c on c.id = comunicados.condominio_id
      where p.id = auth.uid() and p.papel = 'admin' and p.empresa_id = c.empresa_id
    )
  );

-- ============================================================================
-- 2. COMUNICADO_ANEXOS  (segue o comunicado-pai)
-- ============================================================================
alter table public.comunicado_anexos enable row level security;

-- Leitura: pode ver o anexo quem pode ver o comunicado (a RLS de comunicados
-- se aplica dentro deste subselect).
drop policy if exists comunicado_anexos_select on public.comunicado_anexos;
create policy comunicado_anexos_select on public.comunicado_anexos
  for select to authenticated
  using (
    exists (select 1 from public.comunicados co where co.id = comunicado_anexos.comunicado_id)
  );

-- Escrita: só gestores do condomínio do comunicado-pai.
drop policy if exists comunicado_anexos_write on public.comunicado_anexos;
create policy comunicado_anexos_write on public.comunicado_anexos
  for all to authenticated
  using (
    exists (
      select 1 from public.comunicados co
      where co.id = comunicado_anexos.comunicado_id
        and (
          public.tem_acesso_condominio(auth.uid(), co.condominio_id)
          or exists (select 1 from public.super_admins sa where sa.usuario_id = auth.uid())
          or exists (
            select 1 from public.perfis p
            join public.condominios c on c.id = co.condominio_id
            where p.id = auth.uid() and p.papel = 'admin' and p.empresa_id = c.empresa_id
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.comunicados co
      where co.id = comunicado_anexos.comunicado_id
        and (
          public.tem_acesso_condominio(auth.uid(), co.condominio_id)
          or exists (select 1 from public.super_admins sa where sa.usuario_id = auth.uid())
          or exists (
            select 1 from public.perfis p
            join public.condominios c on c.id = co.condominio_id
            where p.id = auth.uid() and p.papel = 'admin' and p.empresa_id = c.empresa_id
          )
        )
    )
  );

-- ============================================================================
-- 3. EVENTOS (agenda)
-- ============================================================================
alter table public.eventos enable row level security;

-- Leitura
drop policy if exists eventos_select on public.eventos;
create policy eventos_select on public.eventos
  for select to authenticated
  using (
    public.tem_acesso_condominio(auth.uid(), condominio_id)
    or exists (select 1 from public.super_admins sa where sa.usuario_id = auth.uid())
    or exists (
      select 1 from public.perfis p
      join public.condominios c on c.id = eventos.condominio_id
      where p.id = auth.uid() and p.papel = 'admin' and p.empresa_id = c.empresa_id
    )
    or exists (
      select 1 from public.perfis p
      where p.id = auth.uid() and p.papel = 'conselheiro'
        and p.condominio_id = eventos.condominio_id
    )
    or exists (
      select 1 from public.perfis p
      where p.id = auth.uid() and p.papel = 'morador'
        and p.condominio_id = eventos.condominio_id
        and eventos.publico = 'moradores'
    )
  );

-- Escrita — só gestores do condomínio
drop policy if exists eventos_write on public.eventos;
create policy eventos_write on public.eventos
  for all to authenticated
  using (
    public.tem_acesso_condominio(auth.uid(), condominio_id)
    or exists (select 1 from public.super_admins sa where sa.usuario_id = auth.uid())
    or exists (
      select 1 from public.perfis p
      join public.condominios c on c.id = eventos.condominio_id
      where p.id = auth.uid() and p.papel = 'admin' and p.empresa_id = c.empresa_id
    )
  )
  with check (
    public.tem_acesso_condominio(auth.uid(), condominio_id)
    or exists (select 1 from public.super_admins sa where sa.usuario_id = auth.uid())
    or exists (
      select 1 from public.perfis p
      join public.condominios c on c.id = eventos.condominio_id
      where p.id = auth.uid() and p.papel = 'admin' and p.empresa_id = c.empresa_id
    )
  );

-- ─── Verificação pós-aplicação (opcional) ───────────────────────────────────
-- Logado como admin da empresa A, os counts abaixo devem contar SÓ os itens
-- de condomínios da empresa A:
--   select count(*) from public.comunicados;
--   select count(*) from public.eventos;
-- E, para conferir que não sobra nada de outra empresa:
--   select count(*) from public.comunicados co
--     join public.condominios c on c.id = co.condominio_id
--    where c.empresa_id <> '<UUID_DA_EMPRESA_A>';   -- deve dar 0
