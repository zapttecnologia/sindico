-- ============================================================================
-- Controle de Vencimentos — tabela, RLS e bucket de anexos
-- Rodar no SQL Editor do painel do Supabase (uma vez).
-- Idempotente: pode rodar de novo sem quebrar.
-- ============================================================================

-- ─── 1. Tabela ──────────────────────────────────────────────────────────────
create table if not exists public.vencimentos (
  id               uuid primary key default gen_random_uuid(),
  condominio_id    uuid not null references public.condominios(id) on delete cascade,
  empresa_id       uuid not null references public.empresas(id)    on delete cascade,
  tipo             text not null default 'outro',      -- item (ex.: 'AVCB'); vem do modelo ou 'outro'
  titulo           text not null,                       -- nome livre (ex.: "AVCB bloco A")
  descricao        text,
  data_vencimento  date not null,
  periodicidade    text not null default 'anual',
  responsavel      text,                                -- fornecedor/empresa responsável (texto livre)
  fornecedor_id    uuid references public.fornecedores(id) on delete set null,
  anexo            text,                                -- caminho do laudo no storage
  anexo_nome       text,
  dias_aviso       int  not null default 30,            -- avisar quantos dias antes
  avisado_em       date,                                -- controla p/ não avisar repetido
  status           text not null default 'ativo',
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  constraint vencimentos_periodicidade_chk
    check (periodicidade in ('unico','mensal','trimestral','semestral','anual','bienal','quinquenal')),
  constraint vencimentos_status_chk
    check (status in ('ativo','concluido','arquivado'))
);

comment on table public.vencimentos is 'Obrigações com prazo/validade por condomínio (AVCB, extintores, seguro, etc.)';

-- ─── 2. Índices ─────────────────────────────────────────────────────────────
create index if not exists idx_vencimentos_condominio  on public.vencimentos (condominio_id);
create index if not exists idx_vencimentos_empresa     on public.vencimentos (empresa_id);
create index if not exists idx_vencimentos_data        on public.vencimentos (data_vencimento);
create index if not exists idx_vencimentos_status      on public.vencimentos (status);

-- ─── 3. Trigger de atualizado_em ────────────────────────────────────────────
create or replace function public.venc_touch_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

drop trigger if exists trg_venc_touch on public.vencimentos;
create trigger trg_venc_touch
  before update on public.vencimentos
  for each row execute function public.venc_touch_atualizado_em();

-- ─── 4. RLS ─────────────────────────────────────────────────────────────────
-- Acesso: síndico (equipe) via tem_acesso_condominio; admin vê os da própria
-- empresa; super_admin vê tudo. Mesma expressão para leitura e escrita.
alter table public.vencimentos enable row level security;

drop policy if exists vencimentos_rw on public.vencimentos;
create policy vencimentos_rw on public.vencimentos
  for all
  to authenticated
  using (
    public.tem_acesso_condominio(auth.uid(), condominio_id)
    or exists (
      select 1 from public.perfis p
      where p.id = auth.uid()
        and p.papel = 'admin'
        and p.empresa_id = vencimentos.empresa_id
    )
    or exists (
      select 1 from public.super_admins sa
      where sa.usuario_id = auth.uid()
    )
  )
  with check (
    public.tem_acesso_condominio(auth.uid(), condominio_id)
    or exists (
      select 1 from public.perfis p
      where p.id = auth.uid()
        and p.papel = 'admin'
        and p.empresa_id = vencimentos.empresa_id
    )
    or exists (
      select 1 from public.super_admins sa
      where sa.usuario_id = auth.uid()
    )
  );

-- ─── 5. Bucket de anexos (privado, mesma postura de contratos-fornecedores) ──
insert into storage.buckets (id, name, public)
values ('vencimentos-anexos', 'vencimentos-anexos', false)
on conflict (id) do nothing;

-- Acesso autenticado ao bucket (leitura por URL assinada de 60s no front).
drop policy if exists "venc anexos select" on storage.objects;
create policy "venc anexos select" on storage.objects
  for select to authenticated using (bucket_id = 'vencimentos-anexos');

drop policy if exists "venc anexos insert" on storage.objects;
create policy "venc anexos insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'vencimentos-anexos');

drop policy if exists "venc anexos update" on storage.objects;
create policy "venc anexos update" on storage.objects
  for update to authenticated using (bucket_id = 'vencimentos-anexos');

drop policy if exists "venc anexos delete" on storage.objects;
create policy "venc anexos delete" on storage.objects
  for delete to authenticated using (bucket_id = 'vencimentos-anexos');
