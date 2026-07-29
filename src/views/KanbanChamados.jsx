import { useState } from 'react'
import { STATUS_LABEL, ticketNumber, fmtDate } from '../lib/constants'

// Todos os status possíveis, na ordem do fluxo, com a cor de cada coluna
const COLUNAS = [
  { status:'aberto',              cor:'#ef4444', bg:'#fef2f2' },
  { status:'em_analise',          cor:'#3b82f6', bg:'#eff6ff' },
  { status:'em_andamento',        cor:'#22c55e', bg:'#f0fdf4' },
  { status:'aguardando_terceiro', cor:'#f59e0b', bg:'#fffbeb' },
  { status:'resolvido',           cor:'#10b981', bg:'#ecfdf5' },
  { status:'cancelado',           cor:'#64748b', bg:'#f8fafc' },
]

const PRIORIDADE_COR = { baixa:'#64748b', media:'#3b82f6', alta:'#f59e0b', urgente:'#ef4444' }

export default function KanbanChamados({ tickets, colunasVisiveis, onAbrir, onMudarStatus }) {
  const [arrastando, setArrastando] = useState(null)   // id do card em arraste
  const [colunaAlvo, setColunaAlvo] = useState(null)   // coluna sob o cursor

  // Só as colunas escolhidas pelo síndico (ou todas, se não definido)
  const colunas = COLUNAS.filter(c => !colunasVisiveis || colunasVisiveis.includes(c.status))

  const porColuna = (status) => tickets.filter(t => t.status === status)

  const soltar = (status) => {
    if (arrastando && onMudarStatus) {
      const t = tickets.find(x => x.id === arrastando)
      if (t && t.status !== status) onMudarStatus(t, status)
    }
    setArrastando(null); setColunaAlvo(null)
  }

  return (
    <div style={{ display:'flex', gap:12, overflowX:'auto', paddingBottom:8, alignItems:'flex-start' }}>
      {colunas.map(col => {
        const lista = porColuna(col.status)
        const alvo = colunaAlvo === col.status
        return (
          <div key={col.status}
            onDragOver={e => { e.preventDefault(); setColunaAlvo(col.status) }}
            onDragLeave={() => setColunaAlvo(c => c === col.status ? null : c)}
            onDrop={() => soltar(col.status)}
            style={{ flex:'0 0 280px', maxWidth:280, background: alvo ? col.bg : '#f9fafb',
              border:`1px solid ${alvo ? col.cor : 'var(--gray-200, #e5e7eb)'}`, borderRadius:12,
              transition:'background .15s, border-color .15s' }}>

            {/* Cabeçalho da coluna */}
            <div style={{ padding:'12px 14px', borderTop:`3px solid ${col.cor}`, borderRadius:'12px 12px 0 0',
              display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:13, fontWeight:700, color:'var(--navy, #1e293b)', textTransform:'uppercase', letterSpacing:'.02em' }}>
                {STATUS_LABEL[col.status] || col.status}
              </span>
              <span style={{ fontSize:13, fontWeight:800, color:col.cor,
                background:col.bg, borderRadius:20, padding:'2px 10px', minWidth:24, textAlign:'center' }}>
                {lista.length}
              </span>
            </div>

            {/* Cards */}
            <div style={{ padding:'0 10px 10px', display:'flex', flexDirection:'column', gap:8, minHeight:60,
              maxHeight:'calc(100vh - 320px)', overflowY:'auto' }}>
              {lista.length === 0 && (
                <div style={{ fontSize:12, color:'var(--gray-400, #9ca3af)', textAlign:'center', padding:'16px 0' }}>
                  Nenhum chamado
                </div>
              )}
              {lista.map(t => (
                <div key={t.id}
                  draggable={!!onMudarStatus}
                  onDragStart={() => setArrastando(t.id)}
                  onDragEnd={() => { setArrastando(null); setColunaAlvo(null) }}
                  onClick={() => onAbrir && onAbrir(t)}
                  style={{ background:'#fff', border:'1px solid var(--gray-200, #e5e7eb)', borderRadius:10,
                    padding:'11px 12px', cursor: onMudarStatus ? 'grab' : 'pointer',
                    boxShadow: arrastando === t.id ? '0 8px 20px rgba(0,0,0,.15)' : '0 1px 2px rgba(0,0,0,.04)',
                    opacity: arrastando === t.id ? .5 : 1, transition:'box-shadow .15s' }}>

                  {/* Linha 1: número + prioridade */}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
                    <span style={{ fontSize:12, fontWeight:700, color:col.cor }}>#{ticketNumber(t.id)}</span>
                    {t.prioridade && (
                      <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', color:'#fff',
                        background: PRIORIDADE_COR[t.prioridade] || '#64748b', borderRadius:5, padding:'1px 7px' }}>
                        {t.prioridade}
                      </span>
                    )}
                  </div>

                  {/* Título (categoria) */}
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--navy, #1e293b)', marginBottom:3, lineHeight:1.3 }}>
                    {t.categoria_personalizada || t.categoria || 'Chamado'}
                  </div>

                  {/* Descrição curta */}
                  {t.descricao && (
                    <div style={{ fontSize:12, color:'var(--gray-500, #6b7280)', marginBottom:6,
                      display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden', lineHeight:1.4 }}>
                      {t.descricao}
                    </div>
                  )}

                  {/* Rodapé: condomínio + data */}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                    fontSize:11, color:'var(--gray-400, #9ca3af)', marginTop:6 }}>
                    <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'60%' }}>
                      {t.condominios?.nome || ''}
                    </span>
                    <span>{fmtDate ? fmtDate(t.criado_em) : new Date(t.criado_em).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
