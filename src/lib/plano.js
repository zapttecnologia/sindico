import { supabase } from './supabase'

// ── Cobrança por modelo ──────────────────────────────────────────────────────
// Modelos: 'fixo' (usa valor_mensal), 'por_condominio' e 'por_unidade'
// (usam preco_unitario × quantidade real do cliente).

const fmtBRL = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: Number(v) % 1 ? 2 : 0, maximumFractionDigits: 2 })}`

// Descrição curta do preço do plano (para cards/labels). Ex.: "R$ 2/unidade".
export function descricaoCobranca(plano) {
  if (!plano) return ''
  const modelo = plano.modelo_cobranca || 'fixo'
  const unit = Number(plano.preco_unitario) || 0
  if (modelo === 'por_condominio') return `${fmtBRL(unit)}/condomínio`
  if (modelo === 'por_unidade')    return `${fmtBRL(unit)}/unidade`
  const vm = Number(plano.valor_mensal) || 0
  return vm === 0 ? 'Gratuito' : `${fmtBRL(vm)}/mês`
}

// Valor mensal de um cliente conforme o modelo de cobrança do plano.
// counts: { condominios, unidades } — quantidades reais do cliente.
export function calcularValorCliente(plano, counts = {}) {
  if (!plano) return 0
  const modelo = plano.modelo_cobranca || 'fixo'
  const unit = Number(plano.preco_unitario) || 0
  if (modelo === 'por_condominio') return unit * (Number(counts.condominios) || 0)
  if (modelo === 'por_unidade')    return unit * (Number(counts.unidades) || 0)
  return Number(plano.valor_mensal) || 0
}

// Busca o uso atual da empresa e os limites do plano
export async function verificarUsoPlano(empresaId) {
  const [{ data: empresa }, { data: condos }] = await Promise.all([
    supabase.from('empresas')
      .select('plano_nome, planos(max_condominios, max_unidades, nome_exibicao)')
      .eq('id', empresaId).single(),
    supabase.from('condominios')
      .select('id, total_unidades').eq('empresa_id', empresaId),
  ])

  const limites = empresa?.planos || { max_condominios: 999999, max_unidades: 999999 }
  const totalCondos = condos?.length || 0
  const totalUnidades = condos?.reduce((s, c) => s + (Number(c.total_unidades) || 0), 0) || 0

  const pctCondos = limites.max_condominios < 999999
    ? Math.round(totalCondos / limites.max_condominios * 100) : 0
  const pctUnidades = limites.max_unidades < 999999
    ? Math.round(totalUnidades / limites.max_unidades * 100) : 0

  return {
    plano: empresa?.plano_nome,
    planoLabel: limites.nome_exibicao || empresa?.plano_nome,
    condos: { atual: totalCondos, max: limites.max_condominios, pct: pctCondos },
    unidades: { atual: totalUnidades, max: limites.max_unidades, pct: pctUnidades },
    alertar: pctCondos >= 80 || pctUnidades >= 80,
    bloqueado: totalCondos >= limites.max_condominios || totalUnidades >= limites.max_unidades,
    motivoBloqueio: totalCondos >= limites.max_condominios
      ? `Limite de condomínios atingido (${limites.max_condominios})`
      : totalUnidades >= limites.max_unidades
        ? `Limite de unidades atingido (${limites.max_unidades.toLocaleString('pt-BR')})`
        : null,
  }
}

// Verifica se pode adicionar um novo condomínio com X unidades
export async function podeAdicionarCondominio(empresaId, novasUnidades = 0) {
  const uso = await verificarUsoPlano(empresaId)
  const condosOk = uso.condos.atual < uso.condos.max
  const unidadesOk = (uso.unidades.atual + novasUnidades) <= uso.unidades.max
  return {
    pode: condosOk && unidadesOk,
    uso,
    motivo: !condosOk
      ? `Você atingiu o limite de ${uso.condos.max} condomínio${uso.condos.max!==1?'s':''} do plano ${uso.planoLabel}.`
      : !unidadesOk
        ? `Adicionar este condomínio ultrapassaria o limite de ${uso.unidades.max.toLocaleString('pt-BR')} unidades do plano ${uso.planoLabel}.`
        : null,
  }
}
