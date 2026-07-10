import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { DEPARTAMENTOS, STATUS_LABEL, statusClass, fmtDate, ticketNumber } from '../lib/constants'

export default function Departamento({ onToast }) {
  const { perfil } = useAuth()
  const [tickets, setTickets] = useState([])
  const [ticketSel, setTicketSel] = useState(null)
  const [loading, setLoading] = useState(true)
  const deptLabel = DEPARTAMENTOS[perfil?.papel] || perfil?.papel

  const carregar = async () => {
    setLoading(true)
    const { data } = await supabase.from('solicitacoes')
      .select('*, condominios(nome)')
      .or(`departamento.eq.${perfil?.papel},atribuido_para.eq.${perfil?.id}`)
      .order('atribuido_em', { ascending:false })
    if (data) setTickets(data)
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  const stats = {
    total:    tickets.length,
    abertos:  tickets.filter(t=>t.status!=='concluido').length,
    concluidos: tickets.filter(t=>t.status==='concluido').length,
  }

  const marcarAndamento = async (id) => {
    await supabase.from('solicitacoes').update({ status:'andamento', atualizado_em:new Date().toISOString() }).eq('id',id)
    onToast('Chamado em andamento.'); await carregar()
  }
  const marcarConcluido = async (id) => {
    await supabase.from('solicitacoes').update({ status:'concluido', atualizado_em:new Date().toISOString() }).eq('id',id)
    onToast('Chamado concluído.'); await carregar()
  }

  return (
    <div>
      <div className="condo-header">
        <div className="condo-header-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
            <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
          </svg>
        </div>
        <div>
          <div className="condo-header-name">{deptLabel}</div>
          <div className="condo-header-sub">{stats.abertos} chamado{stats.abertos!==1?'s':''} em aberto</div>
        </div>
      </div>

      <div className="kpi-row" style={{ marginBottom:24 }}>
        <div className="kpi-box kpi-total"><div className="kpi-box-num">{stats.total}</div><div className="kpi-box-label">Total</div></div>
        <div className="kpi-box kpi-aberto"><div className="kpi-box-num">{stats.abertos}</div><div className="kpi-box-label">Abertos</div></div>
        <div className="kpi-box kpi-ok"><div className="kpi-box-num">{stats.concluidos}</div><div className="kpi-box-label">Concluídos</div></div>
      </div>

      {loading && <div className="empty-state">Carregando...</div>}
      {!loading && tickets.length === 0 && <div className="empty-state">Nenhum chamado atribuído a você.</div>}
      {!loading && tickets.map(t => (
        <div key={t.id} className="card" style={{ marginBottom:10 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8, flexWrap:'wrap', gap:8 }}>
            <div>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--gray-400)' }}>#{ticketNumber(t.id)}</span>
              <div style={{ fontSize:15, fontWeight:700, color:'var(--navy)', margin:'4px 0' }}>
                {t.categoria_personalizada||t.categoria}
              </div>
              <div style={{ fontSize:12, color:'var(--gray-400)' }}>
                {t.condominios?.nome}
                {t.bloco ? ` · Bloco ${t.bloco}` : ''}
                {t.apartamento ? ` · Ap. ${t.apartamento}` : ''}
                {t.nome_solicitante ? ` · ${t.nome_solicitante}` : ''}
              </div>
            </div>
            <span className={`status-badge ${statusClass(t.status)}`}>{STATUS_LABEL[t.status]}</span>
          </div>
          {t.descricao && <p style={{ fontSize:13, color:'var(--gray-600)', margin:'0 0 12px', lineHeight:1.5 }}>{t.descricao}</p>}
          <div style={{ fontSize:11, color:'var(--gray-400)', marginBottom:10 }}>
            Atribuído em: {t.atribuido_em ? new Date(t.atribuido_em).toLocaleDateString('pt-BR') : fmtDate(t.criado_em)}
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {t.status === 'recebido' && (
              <button className="btn btn-primary btn-sm" onClick={()=>marcarAndamento(t.id)}>Iniciar execução</button>
            )}
            {t.status === 'andamento' && (
              <button className="btn btn-primary btn-sm" onClick={()=>marcarConcluido(t.id)}>Marcar concluído</button>
            )}
            {t.status === 'concluido' && (
              <span style={{ fontSize:12, color:'#16a34a', fontWeight:600 }}>✅ Concluído</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
