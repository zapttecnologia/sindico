import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { DEPARTAMENTOS, STATUS_LABEL, STATUS_DEPT, PRIORIDADES, fmtDate, ticketNumber } from '../lib/constants'
import AnexosPanel from '../components/AnexosPanel'

const FLUXO = {
  aguardando:   ['em_andamento'],
  em_andamento: ['em_aprovacao','pausado','concluido'],
  em_aprovacao: ['em_andamento','concluido'],
  pausado:      ['em_andamento'],
  concluido:    [],
}

function PrioridadeBadge({ prioridade }) {
  if (!prioridade) return null
  const p = PRIORIDADES[prioridade]
  if (!p) return null
  return (
    <span style={{ fontSize:11, fontWeight:700, padding:'3px 8px', borderRadius:5,
      background:p.bg, color:p.cor, display:'inline-flex', alignItems:'center', gap:4 }}>
      {p.icon} {p.label}
    </span>
  )
}

function StatusDeptBadge({ status }) {
  if (!status) return null
  const s = STATUS_DEPT[status]
  if (!s) return null
  return (
    <span style={{ fontSize:11, fontWeight:700, padding:'3px 8px', borderRadius:5,
      background:s.bg, color:s.cor }}>
      {s.label}
    </span>
  )
}

export default function Departamento({ onToast }) {
  const { perfil } = useAuth()
  const [tickets, setTickets] = useState([])
  const [ticketSel, setTicketSel] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [modalStatus, setModalStatus] = useState(null) // { ticket, novoStatus }
  const [obs, setObs] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [abaDetalhe, setAbaDetalhe] = useState('info')

  const deptLabel = DEPARTAMENTOS[perfil?.papel] || perfil?.papel

  const carregar = async () => {
    setLoading(true)
    const { data } = await supabase.from('solicitacoes')
      .select('*, condominios(nome), perfis_atribuido:atribuido_para(nome)')
      .or(`departamento.eq.${perfil?.papel},atribuido_para.eq.${perfil?.id}`)
      .order('criado_em', { ascending:false })
    if (data) setTickets(data)
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  // Atualizar ticket selecionado quando tickets mudam
  useEffect(() => {
    if (ticketSel) {
      const atualizado = tickets.find(t => t.id === ticketSel.id)
      if (atualizado) setTicketSel(atualizado)
    }
  }, [tickets])

  const mudarStatusDept = async () => {
    if (!modalStatus) return
    if (modalStatus.novoStatus === 'pausado' && !obs.trim()) {
      onToast('Informe o motivo da pausa.'); return
    }
    setSalvando(true)
    const { error } = await supabase.from('solicitacoes').update({
      status_departamento: modalStatus.novoStatus,
      status_dept_obs: obs.trim() || null,
      status_dept_atualizado_em: new Date().toISOString(),
      // Se concluiu, atualiza também o status geral
      ...(modalStatus.novoStatus === 'concluido' ? { status:'concluido', atualizado_em:new Date().toISOString() } : {}),
    }).eq('id', modalStatus.ticket.id)
    setSalvando(false)
    if (error) { onToast('Erro: '+error.message); return }
    onToast(`Status atualizado: ${STATUS_DEPT[modalStatus.novoStatus]?.label}`)
    setModalStatus(null); setObs('')
    await carregar()
  }

  const stats = {
    total:        tickets.length,
    aguardando:   tickets.filter(t=>!t.status_departamento||t.status_departamento==='aguardando').length,
    em_andamento: tickets.filter(t=>t.status_departamento==='em_andamento').length,
    em_aprovacao: tickets.filter(t=>t.status_departamento==='em_aprovacao').length,
    pausado:      tickets.filter(t=>t.status_departamento==='pausado').length,
    concluido:    tickets.filter(t=>t.status_departamento==='concluido').length,
  }

  const ticketsFiltrados = filtroStatus === 'todos'
    ? tickets
    : filtroStatus === 'aguardando'
      ? tickets.filter(t=>!t.status_departamento||t.status_departamento==='aguardando')
      : tickets.filter(t=>t.status_departamento===filtroStatus)

  const statusAtual = (t) => t.status_departamento || 'aguardando'
  const proximosStatus = (t) => FLUXO[statusAtual(t)] || []

  const BTN_ACAO = {
    em_andamento: { label:'▶ Iniciar',       style:{ background:'#2563eb', color:'#fff' } },
    em_aprovacao: { label:'⏸ Solicitar aprovação', style:{ background:'#d97706', color:'#fff' } },
    pausado:      { label:'⏸ Pausar',        style:{ background:'#dc2626', color:'#fff' } },
    concluido:    { label:'✅ Concluir',      style:{ background:'#16a34a', color:'#fff' } },
  }

  // ── Tela de detalhe do chamado ─────────────────────────────
  if (ticketSel) {
    const st = statusAtual(ticketSel)
    const prox = proximosStatus(ticketSel)
    return (
      <div>
        <button onClick={()=>setTicketSel(null)} style={{ background:'var(--gray-100)', border:'none',
          borderRadius:'var(--r-md)', padding:'8px 14px', fontSize:13, fontWeight:600,
          color:'var(--gray-600)', cursor:'pointer', marginBottom:20 }}>← Voltar</button>

        {/* Header do chamado */}
        <div className="card" style={{ marginBottom:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:10, marginBottom:12 }}>
            <div>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--gray-400)', marginBottom:4 }}>
                #{ticketNumber(ticketSel.id)}
              </div>
              <h2 style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:800, color:'var(--navy)', margin:'0 0 6px' }}>
                {ticketSel.categoria_personalizada||ticketSel.categoria}
              </h2>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <PrioridadeBadge prioridade={ticketSel.prioridade} />
                <StatusDeptBadge status={st} />
              </div>
            </div>
            <div style={{ fontSize:12, color:'var(--gray-400)', textAlign:'right' }}>
              <div>{ticketSel.condominios?.nome}</div>
              {ticketSel.bloco && <div>Bloco {ticketSel.bloco} {ticketSel.apartamento && `· Ap. ${ticketSel.apartamento}`}</div>}
              {ticketSel.nome_solicitante && <div>{ticketSel.nome_solicitante}</div>}
              <div>{fmtDate(ticketSel.criado_em)}</div>
            </div>
          </div>

          {/* Ações de status */}
          {prox.length > 0 && (
            <div style={{ paddingTop:12, borderTop:'1px solid var(--gray-100)' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>
                Atualizar status
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {prox.map(ns => (
                  <button key={ns} onClick={()=>{setModalStatus({ticket:ticketSel, novoStatus:ns}); setObs('')}}
                    style={{ padding:'8px 14px', borderRadius:'var(--r-md)', border:'none', fontWeight:700,
                      fontSize:13, cursor:'pointer', ...(BTN_ACAO[ns]?.style||{}) }}>
                    {BTN_ACAO[ns]?.label || ns}
                  </button>
                ))}
              </div>
            </div>
          )}

          {ticketSel.status_departamento === 'concluido' && (
            <div style={{ padding:'10px 14px', background:'#dcfce7', borderRadius:'var(--r-md)', marginTop:12,
              fontSize:13, color:'#16a34a', fontWeight:600 }}>
              ✅ Chamado concluído pelo departamento
              {ticketSel.status_dept_atualizado_em && ` em ${new Date(ticketSel.status_dept_atualizado_em).toLocaleDateString('pt-BR')}`}
            </div>
          )}

          {ticketSel.status_dept_obs && (
            <div style={{ padding:'10px 14px', background:'var(--gray-50)', borderRadius:'var(--r-md)', marginTop:12,
              fontSize:13, color:'var(--gray-600)', borderLeft:'3px solid var(--gray-300)' }}>
              <b>Observação:</b> {ticketSel.status_dept_obs}
            </div>
          )}
        </div>

        {/* Abas */}
        <div style={{ display:'flex', borderBottom:'2px solid var(--gray-200)', marginBottom:20 }}>
          {[['info','Detalhes'],['anexos','Anexos']].map(([id,label])=>(
            <button key={id} onClick={()=>setAbaDetalhe(id)} style={{
              padding:'9px 18px', background:'none', border:'none', cursor:'pointer', fontSize:13, fontWeight:600,
              color:abaDetalhe===id?'var(--emerald)':'var(--gray-400)',
              borderBottom:abaDetalhe===id?'2px solid var(--emerald)':'2px solid transparent', marginBottom:-2 }}>
              {label}
            </button>
          ))}
        </div>

        {abaDetalhe === 'info' && (
          <div className="card">
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
              <tbody>
                {[
                  ['Categoria', ticketSel.categoria_personalizada||ticketSel.categoria],
                  ['Descrição', ticketSel.descricao],
                  ['Condomínio', ticketSel.condominios?.nome||'-'],
                  ['Bloco', ticketSel.bloco||'-'],
                  ['Apartamento', ticketSel.apartamento||'-'],
                  ['Solicitante', ticketSel.nome_solicitante||'-'],
                  ['Origem', ticketSel.origem||'-'],
                  ['Aberto em', fmtDate(ticketSel.criado_em)],
                  ['Prioridade', PRIORIDADES[ticketSel.prioridade]?.label||'Rotina'],
                  ['Status geral', STATUS_LABEL[ticketSel.status]||ticketSel.status],
                ].map(([k,v])=>(
                  <tr key={k} style={{ borderBottom:'1px solid var(--gray-100)' }}>
                    <td style={{ padding:'10px 0', color:'var(--gray-400)', fontWeight:600, width:'40%' }}>{k}</td>
                    <td style={{ padding:'10px 0', color:'var(--gray-800)' }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {abaDetalhe === 'anexos' && (
          <div className="card">
            <AnexosPanel solicitacaoId={ticketSel.id} onToast={onToast} />
          </div>
        )}
      </div>
    )
  }

  // ── Lista de chamados ──────────────────────────────────────
  return (
    <div>
      <div className="condo-header" style={{ marginBottom:24 }}>
        <div className="condo-header-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
            <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
          </svg>
        </div>
        <div>
          <div className="condo-header-name">{deptLabel}</div>
          <div className="condo-header-sub">
            {stats.em_andamento > 0 ? `${stats.em_andamento} em andamento` : ''}
            {stats.pausado > 0 ? ` · ${stats.pausado} pausado${stats.pausado>1?'s':''}` : ''}
            {stats.aguardando > 0 ? ` · ${stats.aguardando} aguardando` : ''}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(100px,1fr))', gap:8, marginBottom:20 }}>
        {[
          { l:'Total',        v:stats.total,        c:'var(--navy)' },
          { l:'Aguardando',   v:stats.aguardando,   c:'#6b7280' },
          { l:'Em andamento', v:stats.em_andamento, c:'#2563eb' },
          { l:'Em aprovação', v:stats.em_aprovacao, c:'#d97706' },
          { l:'Pausado',      v:stats.pausado,      c:'#dc2626' },
          { l:'Concluído',    v:stats.concluido,    c:'#16a34a' },
        ].map(k=>(
          <div key={k.l} style={{ background:'#fff', border:'1px solid var(--gray-200)', borderRadius:'var(--r-lg)',
            padding:'12px 10px', textAlign:'center', cursor:'pointer',
            boxShadow: filtroStatus===(k.l==='Total'?'todos':k.l.toLowerCase().replace(/ /g,'_').replace('ção','cao').replace('ú','u')) ? '0 0 0 2px var(--emerald)' : 'var(--shadow-sm)' }}
            onClick={()=>setFiltroStatus(k.l==='Total'?'todos':k.l.toLowerCase().replace(/ /g,'_').replace('ção','cao').replace('ú','u'))}>
            <div style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:800, color:k.c }}>{k.v}</div>
            <div style={{ fontSize:10, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.04em', marginTop:3 }}>{k.l}</div>
          </div>
        ))}
      </div>

      {/* Filtro rápido */}
      <div className="chip-row" style={{ marginBottom:16 }}>
        <button className={`chip${filtroStatus==='todos'?' selected':''}`} onClick={()=>setFiltroStatus('todos')}>Todos</button>
        {Object.entries(STATUS_DEPT).map(([k,v])=>(
          <button key={k} className={`chip${filtroStatus===k?' selected':''}`} onClick={()=>setFiltroStatus(k)}>
            {v.label}
          </button>
        ))}
      </div>

      {loading && <div className="empty-state">Carregando...</div>}
      {!loading && ticketsFiltrados.length === 0 && (
        <div className="empty-state">Nenhum chamado {filtroStatus!=='todos'?`com status "${STATUS_DEPT[filtroStatus]?.label||filtroStatus}"`:''}</div>
      )}

      {/* Lista ordenada por prioridade */}
      {!loading && [...ticketsFiltrados]
        .sort((a,b)=>(PRIORIDADES[a.prioridade]?.ordem||4)-(PRIORIDADES[b.prioridade]?.ordem||4))
        .map(t => {
          const st = statusAtual(t)
          const prox = proximosStatus(t)
          return (
            <div key={t.id} className="card" style={{ marginBottom:10, borderLeft:`3px solid ${PRIORIDADES[t.prioridade]?.cor||'#e5e7eb'}` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8, flexWrap:'wrap', gap:8 }}>
                <div>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:6 }}>
                    <PrioridadeBadge prioridade={t.prioridade} />
                    <StatusDeptBadge status={st} />
                  </div>
                  <div style={{ fontSize:15, fontWeight:700, color:'var(--navy)', marginBottom:2 }}>
                    {t.categoria_personalizada||t.categoria}
                  </div>
                  <div style={{ fontSize:12, color:'var(--gray-400)' }}>
                    #{ticketNumber(t.id)} · {t.condominios?.nome}
                    {t.bloco ? ` · Bl. ${t.bloco}` : ''}
                    {t.apartamento ? ` Ap. ${t.apartamento}` : ''}
                    {t.nome_solicitante ? ` · ${t.nome_solicitante}` : ''}
                  </div>
                </div>
                <div style={{ fontSize:11, color:'var(--gray-400)', textAlign:'right' }}>
                  {fmtDate(t.criado_em)}
                </div>
              </div>

              {t.descricao && (
                <p style={{ fontSize:13, color:'var(--gray-600)', margin:'0 0 10px', lineHeight:1.5,
                  display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                  {t.descricao}
                </p>
              )}

              {t.status_dept_obs && (
                <div style={{ fontSize:12, color:'var(--gray-500)', padding:'6px 10px',
                  background:'var(--gray-50)', borderRadius:'var(--r-sm)', marginBottom:10,
                  borderLeft:'2px solid var(--gray-300)' }}>
                  {t.status_dept_obs}
                </div>
              )}

              <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                <button className="btn btn-ghost btn-sm" onClick={()=>{ setTicketSel(t); setAbaDetalhe('info') }}>
                  Ver detalhes →
                </button>
                {prox.map(ns=>(
                  <button key={ns} onClick={()=>{setModalStatus({ticket:t,novoStatus:ns});setObs('')}}
                    style={{ padding:'5px 12px', borderRadius:'var(--r-md)', border:'none', fontWeight:700,
                      fontSize:12, cursor:'pointer', ...(BTN_ACAO[ns]?.style||{}) }}>
                    {BTN_ACAO[ns]?.label||ns}
                  </button>
                ))}
              </div>
            </div>
          )
        })
      }

      {/* Modal de mudança de status */}
      {modalStatus && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModalStatus(null)}>
          <div className="modal" style={{ maxWidth:420 }}>
            <div className="modal-header">
              <h3 className="modal-title">
                {BTN_ACAO[modalStatus.novoStatus]?.label||modalStatus.novoStatus}
              </h3>
              <button className="modal-close" onClick={()=>setModalStatus(null)}>✕</button>
            </div>

            <div style={{ padding:'10px 14px', borderRadius:'var(--r-md)', marginBottom:16, fontSize:13,
              background: STATUS_DEPT[modalStatus.novoStatus]?.bg,
              color: STATUS_DEPT[modalStatus.novoStatus]?.cor, fontWeight:600 }}>
              {modalStatus.ticket.categoria_personalizada||modalStatus.ticket.categoria}
              {' → '}
              {STATUS_DEPT[modalStatus.novoStatus]?.label}
            </div>

            <div className="field">
              <label>
                {modalStatus.novoStatus==='pausado' ? 'Motivo da pausa *' : 'Observação (opcional)'}
              </label>
              <textarea className="input" rows={3} value={obs} onChange={e=>setObs(e.target.value)}
                placeholder={
                  modalStatus.novoStatus==='pausado' ? 'Explique por que está pausando...' :
                  modalStatus.novoStatus==='em_aprovacao' ? 'O que precisa de aprovação?' :
                  modalStatus.novoStatus==='concluido' ? 'Descreva o que foi feito...' :
                  'Adicione uma observação...'
                } />
            </div>

            <button className="btn btn-primary btn-block" onClick={mudarStatusDept} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
