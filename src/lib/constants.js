// ── Formatação ────────────────────────────────────────────────
export function fmtDate(d) {
  if (!d) return '—'
  const dt = new Date(d)
  const hoje = new Date()
  const diff = Math.floor((hoje - dt) / 1000)
  if (diff < 60) return 'agora'
  if (diff < 3600) return `há ${Math.floor(diff/60)} min`
  if (diff < 86400) return `há ${Math.floor(diff/3600)}h`
  if (diff < 172800) return 'ontem'
  return dt.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' })
}

export function ticketNumber(id) {
  return id ? id.slice(-6).toUpperCase() : '------'
}

// ── Status ────────────────────────────────────────────────────
export const STATUS_LABEL = {
  aberto:              'Aberto',
  em_analise:          'Em análise',
  em_andamento:        'Em andamento',
  aguardando_terceiro: 'Aguardando terceiro',
  resolvido:           'Resolvido',
  cancelado:           'Cancelado',
  // legado
  recebido:  'Recebido',
  concluido: 'Concluído',
}

export const STATUS_LIST = [
  'aberto','em_analise','em_andamento','aguardando_terceiro','resolvido','cancelado'
]

export function statusClass(s) {
  const m = {
    aberto:              'status-aberto',
    em_analise:          'status-analise',
    em_andamento:        'status-andamento',
    aguardando_terceiro: 'status-aguardando',
    resolvido:           'status-resolvido',
    cancelado:           'status-cancelado',
    recebido:            'status-recebido',
    concluido:           'status-concluido',
  }
  return m[s] || 'status-aberto'
}

// ── Aprovação ─────────────────────────────────────────────────
export const APROVACAO_LABEL = {
  aguardando:         'Ag. aprovação',
  aprovado:           'Aprovado',
  aprovado_ressalva:  'Aprovado c/ ressalva',
  rejeitado:          'Rejeitado',
}
export function aprovClass(s) {
  const m = {
    aguardando:'aprov-aguardando', aprovado:'aprov-aprovado',
    aprovado_ressalva:'aprov-aprovado', rejeitado:'aprov-rejeitado',
  }
  return m[s] || ''
}

// ── Prioridades ───────────────────────────────────────────────
export const PRIORIDADES = {
  baixa:    { label:'Baixa',   icon:'🔵', cor:'#3b82f6', bg:'#dbeafe' },
  media:    { label:'Média',   icon:'🟡', cor:'#f59e0b', bg:'#fef3c7' },
  alta:     { label:'Alta',    icon:'🟠', cor:'#f97316', bg:'#ffedd5' },
  urgente:  { label:'Urgente', icon:'🔴', cor:'#dc2626', bg:'#fee2e2' },
  // legado
  emergencia:  { label:'Emergência', icon:'🔴', cor:'#dc2626', bg:'#fee2e2' },
  urgente_old: { label:'Urgente',    icon:'🟠', cor:'#f97316', bg:'#ffedd5' },
  prioritario: { label:'Prioritário',icon:'🟡', cor:'#f59e0b', bg:'#fef3c7' },
  rotina:      { label:'Rotina',     icon:'🔵', cor:'#3b82f6', bg:'#dbeafe' },
}

export const PRIORIDADE_LIST = ['baixa','media','alta','urgente']

// ── Categorias (legado — mantido para compatibilidade) ────────
export const CATEGORIAS = [
  'Manutencao','Reclamacao','Elevador','Limpeza','Portaria',
  'Interfone/Antena','Outros','Denuncia','Sugestao',
]

// ── Departamentos ─────────────────────────────────────────────
export const DEPARTAMENTOS = {
  manutencao:     'Manutenção',
  limpeza:        'Limpeza',
  administradora: 'Administradora',
  portaria:       'Portaria',
  seguranca:      'Segurança',
  zeladoria:      'Zeladoria',
  terceiros:      'Terceiros',
}
export const PAPEIS_DEPARTAMENTO = Object.keys(DEPARTAMENTOS)
export const PAPEIS_EQUIPE      = ['equipe','admin','conselheiro','morador']

export const SIGLAS_DEPT = {
  manutencao:'MAN', limpeza:'LIM', administradora:'ADM',
  portaria:'POR', seguranca:'SEG', zeladoria:'ZEL', terceiros:'TER',
}

// ── Iniciais do condomínio ────────────────────────────────────
export function iniciaisCondo(nome) {
  if (!nome) return ''
  return nome.split(' ').filter(w => w.length > 2)
    .map(w => w[0]).join('').toUpperCase().slice(0, 3)
}

export function gerarCodigo(nomeCondominio, bloco, apartamento) {
  const ini = iniciaisCondo(nomeCondominio)
  const b = (bloco || '').replace(/\s/g, '').toUpperCase().slice(0, 4)
  const a = (apartamento || '').replace(/\s/g, '').toUpperCase().slice(0, 5)
  return (ini + b + a).slice(0, 12)
}

// ── Departamentos status ──────────────────────────────────────
export const STATUS_DEPT = {
  aguardando:    { label:'Aguardando',    cor:'#f59e0b' },
  em_andamento:  { label:'Em andamento',  cor:'#3b82f6' },
  em_aprovacao:  { label:'Em aprovação',  cor:'#8b5cf6' },
  pausado:       { label:'Pausado',       cor:'#9ca3af' },
  concluido:     { label:'Concluído',     cor:'#16a34a' },
}

export const STATUS_ORDER = ['aberto','em_analise','em_andamento','aguardando_terceiro','resolvido','cancelado']

export const BUCKET_ANEXOS = 'anexos-solicitacoes'

// ── Progress steps para timeline de chamado ───────────────────
export function progressSteps(status) {
  const steps = [
    { key:'aberto',              label:'Aberto' },
    { key:'em_analise',          label:'Em análise' },
    { key:'em_andamento',        label:'Em andamento' },
    { key:'aguardando_terceiro', label:'Aguardando' },
    { key:'resolvido',           label:'Resolvido' },
  ]
  const idx = steps.findIndex(s => s.key === status)
  return steps.map((s, i) => ({ ...s, done: i <= idx, current: i === idx }))
}
