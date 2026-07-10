import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { CATEGORIAS, ticketNumber, fmtDate, STATUS_LABEL, statusClass, APROVACAO_LABEL, aprovClass } from '../lib/constants'
import TicketCard from '../components/TicketCard'

export default function Conselheiro({ view, onToast }) {
  const { perfil, session } = useAuth()
  const [tickets, setTickets] = useState([])
  const [catSel, setCatSel] = useState(null)
  const [descricao, setDescricao] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmNum, setConfirmNum] = useState(null)

  useEffect(() => { setCatSel(null); setDescricao(''); setConfirmNum(null) }, [view])

  const carregar = async () => {
    const { data } = await supabase.from('solicitacoes')
      .select('*, condominios(nome)')
      .eq('condominio_id', perfil.condominio_id)
      .order('criado_em', { ascending:false })
    if (data) setTickets(data)
  }

  useEffect(() => { carregar() }, [])

  const pendentes = tickets.filter(t => t.aprovacao_status === 'aguardando').length
  const kpis = {
    total: tickets.length,
    abertos: tickets.filter(t => t.status !== 'concluido').length,
    pendentes,
    concluidos: tickets.filter(t => t.status === 'concluido').length,
  }

  const enviar = async () => {
    if (!catSel || !descricao.trim()) { onToast('Preencha categoria e descricao.'); return }
    setLoading(true)
    const { data, error } = await supabase.from('solicitacoes').insert({
      condominio_id: perfil.condominio_id,
      autor_id: session.user.id,
      categoria: catSel,
      descricao: descricao.trim(),
      origem: 'Portal do conselheiro',
      nome_solicitante: perfil.nome,
      bloco: perfil.bloco,
      apartamento: perfil.apartamento,
    }).select().single()
    setLoading(false)
    if (error) { onToast('Erro: '+error.message); return }
    setConfirmNum(ticketNumber(data.id))
    setCatSel(null); setDescricao('')
    await carregar()
  }

  const header = (
    <div className="condo-header" style={{ marginBottom:24 }}>
      <div className="condo-header-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
          <path d="M9 12l2 2 4-4"/><rect x="3" y="5" width="18" height="14" rx="2"/>
        </svg>
      </div>
      <div>
        <div className="condo-header-name">{perfil?.nome}</div>
        <div className="condo-header-sub">
          Conselheiro{pendentes > 0 ? ` · ${pendentes} voto${pendentes>1?'s':''} pendente${pendentes>1?'s':''}` : ''}
        </div>
      </div>
    </div>
  )

  // ── PAINEL ─────────────────────────────────────────────────
  if (view === 'painel') return (
    <div>
      {header}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(130px,1fr))', gap:10, marginBottom:24 }}>
        {[
          { l:'Total', v:kpis.total, c:'var(--navy)' },
          { l:'Abertos', v:kpis.abertos, c:'var(--amber)' },
          { l:'Ag. votacao', v:kpis.pendentes, c:'#8a5a00' },
          { l:'Concluidos', v:kpis.concluidos, c:'var(--emerald)' },
        ].map(k => (
          <div key={k.l} style={{ background:'#fff', border:'1px solid var(--gray-200)', borderRadius:'var(--r-lg)', padding:'14px 16px', textAlign:'center' }}>
            <div style={{ fontFamily:'var(--font-display)', fontSize:30, fontWeight:800, color:k.c }}>{k.v}</div>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.05em', marginTop:4 }}>{k.l}</div>
          </div>
        ))}
      </div>

      {/* Pendentes de votação */}
      {pendentes > 0 && (
        <div className="card" style={{ marginBottom:16, borderLeft:'3px solid var(--amber)' }}>
          <h3 className="section-title" style={{ color:'var(--amber)' }}>⏳ Aguardando seu voto ({pendentes})</h3>
          {tickets.filter(t=>t.aprovacao_status==='aguardando').map(t=>(
            <div key={t.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'10px 0', borderBottom:'1px solid var(--gray-100)', gap:10, flexWrap:'wrap' }}>
              <div>
                <div style={{ fontSize:14, fontWeight:600, color:'var(--gray-800)' }}>{t.categoria_personalizada||t.categoria}</div>
                <div style={{ fontSize:12, color:'var(--gray-400)' }}>{fmtDate(t.criado_em)}</div>
              </div>
              <span className="status-badge aprov-aguardando">Votacao pendente</span>
            </div>
          ))}
        </div>
      )}

      {/* Últimos chamados */}
      <div className="card">
        <h3 className="section-title">Ultimos chamados</h3>
        {tickets.slice(0,6).map(t=>(
          <div key={t.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid var(--gray-100)', flexWrap:'wrap' }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:600, color:'var(--gray-800)' }}>{t.categoria_personalizada||t.categoria}</div>
              <div style={{ fontSize:12, color:'var(--gray-400)' }}>#{ticketNumber(t.id)} · {fmtDate(t.criado_em)}</div>
            </div>
            <span className={`status-badge ${statusClass(t.status)}`}>{STATUS_LABEL[t.status]}</span>
          </div>
        ))}
        {tickets.length===0 && <div className="empty-state">Nenhum chamado.</div>}
      </div>
    </div>
  )

  // ── APROVAÇÕES ─────────────────────────────────────────────
  if (view === 'aprovacoes') return (
    <div>
      {header}
      <h2 style={{ fontFamily:'var(--font-display)', fontSize:18, fontWeight:700, color:'var(--navy)', margin:'0 0 16px' }}>
        Votacao do conselho
      </h2>
      {tickets.filter(t=>t.aprovacao_status==='aguardando').length === 0
        ? <div className="empty-state">Nenhum chamado aguardando seu voto.</div>
        : tickets.filter(t=>t.aprovacao_status==='aguardando').map(t=>
            <TicketCard key={t.id} ticket={t} onUpdate={carregar} onToast={onToast} />
          )
      }
    </div>
  )

  // ── CHAMADOS ───────────────────────────────────────────────
  if (view === 'chamados') return (
    <div>
      {header}
      <h2 style={{ fontFamily:'var(--font-display)', fontSize:18, fontWeight:700, color:'var(--navy)', margin:'0 0 16px' }}>
        Todos os chamados
      </h2>
      {tickets.length===0
        ? <div className="empty-state">Nenhum chamado.</div>
        : tickets.map(t=><TicketCard key={t.id} ticket={t} onUpdate={carregar} onToast={onToast} />)
      }
    </div>
  )

  // ── NOVO CHAMADO ───────────────────────────────────────────
  if (view === 'novo-chamado') return (
    <div>
      {header}
      <h2 style={{ fontFamily:'var(--font-display)', fontSize:18, fontWeight:700, color:'var(--navy)', margin:'0 0 20px' }}>
        Novo chamado
      </h2>
      {confirmNum ? (
        <div className="card" style={{ textAlign:'center' }}>
          <div style={{ fontSize:40, marginBottom:8 }}>✅</div>
          <h3 style={{ fontFamily:'var(--font-display)', color:'var(--navy)', margin:'0 0 6px' }}>Chamado aberto!</h3>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:22, fontWeight:700, color:'var(--emerald)',
            background:'var(--mint)', border:'1.5px dashed var(--emerald)', borderRadius:'var(--r-md)',
            padding:'8px 20px', display:'inline-block', letterSpacing:2, margin:'8px 0 20px' }}>
            #{confirmNum}
          </div>
          <br/>
          <button className="btn btn-ghost" onClick={()=>setConfirmNum(null)}>Abrir outro</button>
        </div>
      ) : (
        <div className="card">
          <div className="field">
            <label>Categoria</label>
            <div className="chip-row">
              {CATEGORIAS.map(c=><button key={c} className={`chip${catSel===c?' selected':''}`} onClick={()=>setCatSel(c)}>{c}</button>)}
            </div>
          </div>
          <div className="field">
            <label>Descricao</label>
            <textarea className="input" rows={4} value={descricao} onChange={e=>setDescricao(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-block" onClick={enviar} disabled={loading||!catSel||!descricao.trim()}>
            {loading ? 'Enviando...' : 'Enviar chamado'}
          </button>
        </div>
      )}
    </div>
  )

  return null
}
