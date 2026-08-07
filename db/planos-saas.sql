-- ============================================================================
-- Planos SaaS — novos campos (modelo de cobrança, plano personalizado, arquivar)
-- ----------------------------------------------------------------------------
-- Eleva a tabela `planos` ao nível de um SaaS: cobrança por condomínio/unidade
-- ou valor fixo, planos personalizados por cliente e "arquivar sem apagar".
-- Mantém TODOS os campos existentes (nome, nome_exibicao, valor_mensal,
-- max_condominios, max_unidades, max_usuarios, descricao, ativo). Nada é removido.
--
-- Rodar no SQL Editor do Supabase. Idempotente (add column if not exists).
-- ============================================================================

-- ─── 1. Novos campos ────────────────────────────────────────────────────────
alter table public.planos
  add column if not exists modelo_cobranca text    not null default 'fixo',
  add column if not exists preco_unitario  numeric,
  add column if not exists tipo_plano      text    not null default 'padrao',
  add column if not exists empresa_id      uuid    references public.empresas(id) on delete cascade,
  add column if not exists arquivado       boolean not null default false;

comment on column public.planos.modelo_cobranca is 'Como o preço é calculado: por_condominio | por_unidade | fixo';
comment on column public.planos.preco_unitario  is 'Preço por condomínio ou por unidade (usado quando modelo_cobranca != fixo)';
comment on column public.planos.tipo_plano       is 'padrao | personalizado';
comment on column public.planos.empresa_id       is 'Cliente dono do plano (só em tipo_plano = personalizado)';
comment on column public.planos.arquivado        is 'Plano arquivado: some para NOVOS clientes, mas os atuais continuam nele';

-- ─── 2. Constraints (idempotentes) ──────────────────────────────────────────
do $$ begin
  alter table public.planos add constraint planos_modelo_cobranca_chk
    check (modelo_cobranca in ('por_condominio','por_unidade','fixo'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.planos add constraint planos_tipo_plano_chk
    check (tipo_plano in ('padrao','personalizado'));
exception when duplicate_object then null; end $$;

-- ─── 3. Índices ─────────────────────────────────────────────────────────────
create index if not exists idx_planos_empresa   on public.planos (empresa_id);
create index if not exists idx_planos_arquivado on public.planos (arquivado);

-- ─── 4. Backfill de coerência (planos antigos) ──────────────────────────────
-- Planos já existentes viram 'fixo' / 'padrao' (defaults já cuidam disso em
-- linhas novas; este update garante linhas anteriores caso a coluna tenha
-- entrado como null em algum cenário).
update public.planos set modelo_cobranca = 'fixo'   where modelo_cobranca is null;
update public.planos set tipo_plano      = 'padrao' where tipo_plano is null;
update public.planos set arquivado       = false    where arquivado is null;

-- ─── Observação sobre RLS ────────────────────────────────────────────────────
-- A tela de Planos (super admin) já faz insert/update/delete em `planos`.
-- Se o super admin não conseguir CRIAR ou EXCLUIR um plano, verifique a policy:
--   select policyname, cmd, roles, qual, with_check
--     from pg_policies where schemaname='public' and tablename='planos';
-- O esperado é uma policy `for all` permitindo quem está em super_admins
-- (ou eh_super_admin(auth.uid())).
