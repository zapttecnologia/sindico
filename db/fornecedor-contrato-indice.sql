-- ============================================================================
-- Fornecedores: índice de reajuste do contrato
-- Rodar no SQL Editor do Supabase. Idempotente.
-- ============================================================================
alter table public.fornecedores
  add column if not exists contrato_indice text;   -- ex.: IGP-M, IPCA, INPC, INCC...

comment on column public.fornecedores.contrato_indice is 'Índice usado no reajuste do contrato (IGP-M, IPCA, etc.)';
