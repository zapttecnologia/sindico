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
