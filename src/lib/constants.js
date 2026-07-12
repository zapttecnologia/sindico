export const CATEGORIAS = ['Manutenção','Reclamação','Elevador','Limpeza','Portaria','Interfone/Antena','Outros']

export const STATUS_ORDER = ['recebido','andamento','concluido']

export const STATUS_LABEL = {
  recebido:  'Recebido',
  andamento: 'Em andamento',
  concluido: 'Concluído',
}

export const APROVACAO_LABEL = {
  aguardando: 'Pendente aprovação',
  aprovado:   'Aprovado',
  rejeitado:  'Rejeitado',
}

export const BUCKET_ANEXOS = 'anexos-solicitacoes'

export function ticketNumber(id) {
  return id.replace(/-/g, '').slice(-6).toUpperCase()
}

export function fmtDate(ts) {
  const d = new Date(ts)
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function statusClass(s) {
  return { recebido: 'status-recebido', andamento: 'status-andamento', concluido: 'status-concluido' }[s] || ''
}

export function aprovClass(s) {
  return { aguardando: 'aprov-aguardando', aprovado: 'aprov-aprovado', rejeitado: 'aprov-rejeitado' }[s] || ''
}

export function progressSteps(status) {
  const idx = STATUS_ORDER.indexOf(status)
  return STATUS_ORDER.map((_, i) =>
    i < idx ? 'done' : i === idx ? 'current' : ''
  )
}

// Gera iniciais do condomínio (ex.: "Jardins da Cidade" → "JDC")
export function iniciaisCondo(nome) {
  if (!nome) return ''
  return nome
    .split(' ')
    .filter(w => w.length > 2 || w === w.toUpperCase()) // ignora "da", "de", etc.
    .map(w => w[0].toUpperCase())
    .join('')
    .slice(0, 4)
}

// Gera código de acesso automático: iniciais + bloco + apto
// Ex.: JDC + B + 302 → JDCB302
export function gerarCodigo(nomeCondominio, bloco, apartamento) {
  const ini = iniciaisCondo(nomeCondominio)
  const b = (bloco || '').replace(/\s/g, '').toUpperCase().slice(0, 4)
  const a = (apartamento || '').replace(/\s/g, '').toUpperCase().slice(0, 5)
  return (ini + b + a).slice(0, 12) // máximo 12 chars
}

// Departamentos operacionais
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
export const PAPEIS_EQUIPE = ['equipe','admin','conselheiro','morador']

// Prioridade dos chamados
export const PRIORIDADES = {
  emergencia:  { label:'Emergência/Crítico',    cor:'#dc2626', bg:'#fee2e2', icon:'🔴', ordem:1 },
  urgente:     { label:'Urgente',               cor:'#ea580c', bg:'#ffedd5', icon:'🟠', ordem:2 },
  prioritario: { label:'Prioritário',           cor:'#ca8a04', bg:'#fef9c3', icon:'🟡', ordem:3 },
  rotina:      { label:'Rotina/Administrativo', cor:'#2563eb', bg:'#dbeafe', icon:'🔵', ordem:4 },
}

// Status do departamento
export const STATUS_DEPT = {
  aguardando:    { label:'Aguardando início', cor:'#6b7280', bg:'#f3f4f6' },
  em_andamento:  { label:'Em andamento',      cor:'#2563eb', bg:'#dbeafe' },
  em_aprovacao:  { label:'Em aprovação',      cor:'#d97706', bg:'#fef3c7' },
  pausado:       { label:'Pausado',           cor:'#dc2626', bg:'#fee2e2' },
  concluido:     { label:'Concluído',         cor:'#16a34a', bg:'#dcfce7' },
}
