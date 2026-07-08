import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { CATEGORIAS, STATUS_LABEL, fmtDate, statusClass, aprovClass, APROVACAO_LABEL } from '../lib/constants'
import TicketDetail from '../components/TicketDetail'
import Dashboard from './Dashboard'

export default function Equipe({ view, onToast }) {
  const { perfil } = useAuth()
  // subTela é só para navegação DENTRO de chamados (aprovações, etc)
  const [subTela, setSubTela] = useState('lista')
  const [tickets, setTickets] = useState([])
  const [condominios, setCondominios] = useState([])
  const [condoFiltro, setCondoFiltro] = useState('todos')
  const [catFiltro, setCatFiltro] = useState('todas')
  const [statusFiltro, setStatusFiltro] = useState('todos')
  const [ticketSel, setTicketSel] = useState(null)
  const [showModalNovo, setShowModalNovo] = useState(false)
  const [novaCategoria, setNovaCategoria] = useState(null)
  const [novaDescricao, setNovaDescricao] = useState('')
  const [novaCondo, setNovaCondo] = useState('')
  const [novaOrigem, setNovaOrigem] = useState('E-mail')
  const [novoBloco, setNovoBloco] = useState('')
  const [novoApto, setNovoApto] = useState('')
  const [novoNome, setNovoNome] = useState('')
  const [salvando, setSalvando] = useState(false)
  const ehAdmin = perfil?.papel === 'admin'

  // Resetar subTela quando muda de view
  useEffect(() => { setSubTela('lista'); setTicketSel(null) }, [view])

  const carregarCondos = async () => {
    if (ehAdmin) {
      const { data } = await supabase.from('condominios').select('id, nome').order('nome')
      if (data) setCondominios(data)
    } else {
      const { data } = await supabase.from('sindico_condominios')
        .select('condominio_id, condominios(nome)').eq('perfil_id', perfil?.id)
      if (data) setCondominios(data.map(r => ({ id:r.condominio_id, nome:r.condominios?.nome||'' })))
    }
  }

  const carregar = async () => {
    const { data } = await supabase.from('solicitacoes')
      .select('*, condominios(nome)').order('criado_em', { ascending:false })
    if (data) setTickets(data)
  }

  useEffect(() => { carregarCondos(); carregar() }, [])

  const globalStats = {
    total: tickets.length,
    pendentes: tickets.filter(t => t.status !== 'concluido').length,
    aprovacao: tickets.filter(t => t.aprovacao_status === 'aguardando').length,
  }

  const ticketsFiltrados = tickets.filter(t => {
    if (condoFiltro !== 'todos' && t.condominio_id !== condoFiltro) return false
    if (catFiltro !== 'todas' && t.categoria !== catFiltro) return false
    if (statusFiltro === 'pendentes' && t.status === 'concluido') return false
    if (statusFiltro === 'aprovacao' && t.aprovacao_status !== 'aguardando') return false
    if (!['todos','pendentes','aprovacao'].includes(statusFiltro) && t.status !== statusFiltro) return false
    return true
  })

  const filtStats = {
    total: ticketsFiltrados.length,
    pendentes: ticketsFiltrados.filter(t => t.status !== 'concluido').length,
    aprovacao: ticketsFiltrados.filter(t => t.aprovacao_status === 'aguardando').length,
  }

  const salvarNovo = async () => {
    if (!novaCategoria || !novaDescricao.trim() || !novaCondo) { onToast('Preencha categoria, condominio e descricao.'); return }
    setSalvando(true)
    const { error } = await supabase.from('solicitacoes').insert({
      condominio_id:novaCondo, autor_id:perfil?.id, categoria:novaCategoria,
      descricao:novaDescricao.trim(), origem:novaOrigem,
      bloco:novoBloco, apartamento:novoApto, nome_solicitante:novoNome,
    })
    setSalvando(false)
    if (error) { onToast('Erro: '+error.message); return }
    onToast('Chamado registrado.')
    setShowModalNovo(false)
    setNovaCategoria(null); setNovaDescricao(''); setNovoBloco(''); setNovoApto(''); setNovoNome('')
    await carregar()
  }

  // ── VIEW: PAINEL → Dashboard BI
  if (view === 'dashboard') return <Dashboard onToast={onToast} />

  // ── VIEW: CHAMADOS
  // Se ticket selecionado → tela de detalhe
  if (ticketSel) return (
    <TicketDetail
      ticket={ticketSel}
      onBack={() => { setTicketSel(null); carregar() }}
      onToast={onToast}
    />
  )

  return (
    <div>
      {/* Header com sub-navegação */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div>
          <h1 className="page-title" style={{ margin:0 }}>Chamados</h1>
          <p className="page-sub">{globalStats.total} total · {globalStats.pendentes} pendentes · {globalStats.aprovacao} ag. aprovacao</p>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button className={`btn btn-sm ${subTela==='lista'?'btn-primary':'btn-ghost'}`} onClick={() => setSubTela('lista')}>Todos</button>
          <button className={`btn btn-sm ${subTela==='aprovacao'?'btn-primary':'btn-ghost'}`}
            onClick={() => setSubTela('aprovacao')}
            style={subTela!=='aprovacao'&&globalStats.aprovacao>0?{borderColor:'var(--amber)',color:'var(--amber)'}:{}}>
            Ag. aprovacao {globalStats.aprovacao > 0 && `(${globalStats.aprovacao})`}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowModalNovo(true)}>+ Novo</button>
        </div>
      </div>

      {/* ── LISTA DE CHAMADOS ── */}
      {subTela === 'lista' && (
        <div>
          {/* Filtros */}
          <div style={{ background:'#fff', border:'1px solid var(--gray-200)', borderRadius:'var(--r-lg)', padding:'14px 18px', marginBottom:14 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px,1fr))', gap:10 }}>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', display:'block', marginBottom:4 }}>Condominio</label>
                <select className="input" style={{ fontSize:13 }} value={condoFiltro} onChange={e => setCondoFiltro(e.target.value)}>
                  <option value="todos">Todos</option>
                  {condominios.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', display:'block', marginBottom:4 }}>Categoria</label>
                <select className="input" style={{ fontSize:13 }} value={catFiltro} onChange={e => setCatFiltro(e.target.value)}>
                  <option value="todas">Todas</option>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', display:'block', marginBottom:4 }}>Status</label>
                <select className="input" style={{ fontSize:13 }} value={statusFiltro} onChange={e => setStatusFiltro(e.target.value)}>
                  <option value="todos">Todos</option>
                  <option value="pendentes">Pendentes</option>
                  <option value="recebido">Recebido</option>
                  <option value="andamento">Em andamento</option>
                  <option value="concluido">Concluido</option>
                  <option value="aprovacao">Ag. aprovacao</option>
                </select>
              </div>
            </div>
          </div>

          {/* Mini stats */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:14 }}>
            {[
              { l:'Total filtrado', v:filtStats.total, c:'var(--navy)' },
              { l:'Pendentes', v:filtStats.pendentes, c:'var(--amber)' },
              { l:'Ag. aprovacao', v:filtStats.aprovacao, c:'#8a5a00' },
            ].map(k => (
              <div key={k.l} style={{ background:'#fff', border:'1px solid var(--gray-200)', borderRadius:'var(--r-lg)', padding:'12px 14px', textAlign:'center' }}>
                <div style={{ fontFamily:'var(--font-display)', fontSize:24, fontWeight:800, color:k.c }}>{k.v}</div>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.05em' }}>{k.l}</div>
              </div>
            ))}
          </div>

          {ticketsFiltrados.length === 0
            ? <div className="empty-state">Nenhum chamado encontrado com esses filtros.</div>
            : ticketsFiltrados.map(t => (
              <div key={t.id} onClick={() => setTicketSel(t)} className="ticket-card" style={{ cursor:'pointer' }}
                onMouseEnter={e => e.currentTarget.style.boxShadow='var(--shadow-md)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow='var(--shadow-sm)'}>
                <div className="ticket-header">
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:6 }}>
                      <span className="badge badge-cat">{t.categoria_personalizada||t.categoria}</span>
                      {t.aprovacao_status && <span className={`status-badge ${aprovClass(t.aprovacao_status)}`}>{APROVACAO_LABEL[t.aprovacao_status]}</span>}
                    </div>
                    <div style={{ fontWeight:700, fontSize:14, color:'var(--gray-800)' }}>
                      {t.condominios?.nome}{t.bloco?` · Bloco ${t.bloco}`:''}{t.apartamento?` · Ap. ${t.apartamento}`:''}
                    </div>
                    {t.nome_solicitante && <div style={{ fontSize:13, color:'var(--gray-400)' }}>{t.nome_solicitante}</div>}
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
                    <span className={`status-badge ${statusClass(t.status)}`}>{STATUS_LABEL[t.status]}</span>
                    <span style={{ fontSize:11, color:'var(--gray-400)', fontFamily:'var(--font-mono)' }}>{fmtDate(t.criado_em)}</span>
                  </div>
                </div>
                <p className="ticket-desc">{t.descricao}</p>
                <div style={{ fontSize:11, color:'var(--emerald)', marginTop:6, fontWeight:600 }}>Clique para abrir →</div>
              </div>
            ))
          }
        </div>
      )}

      {/* ── APROVAÇÕES ── */}
      {subTela === 'aprovacao' && (
        <div>
          {tickets.filter(t => t.aprovacao_status === 'aguardando').length === 0
            ? <div className="empty-state">Nenhum chamado aguardando aprovacao dos conselheiros.</div>
            : tickets.filter(t => t.aprovacao_status === 'aguardando').map(t => (
              <div key={t.id} onClick={() => setTicketSel(t)} className="ticket-card" style={{ cursor:'pointer' }}>
                <div className="ticket-header">
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', gap:8, marginBottom:6 }}>
                      <span className="badge badge-cat">{t.categoria_personalizada||t.categoria}</span>
                      <span className="status-badge aprov-aguardando">Pendente aprovacao</span>
                    </div>
                    <div style={{ fontWeight:700, fontSize:14 }}>{t.condominios?.nome}</div>
                  </div>
                  <span className={`status-badge ${statusClass(t.status)}`}>{STATUS_LABEL[t.status]}</span>
                </div>
                <p className="ticket-desc">{t.descricao}</p>
              </div>
            ))
          }
        </div>
      )}

      {/* Modal novo chamado */}
      {showModalNovo && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget&&setShowModalNovo(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Novo chamado</h3>
              <button className="modal-close" onClick={() => setShowModalNovo(false)}>✕</button>
            </div>
            <div className="field"><label>Origem</label>
              <select className="input" value={novaOrigem} onChange={e => setNovaOrigem(e.target.value)}>
                {['E-mail','Telefone','Presencial','WhatsApp','Outro'].map(o=><option key={o}>{o}</option>)}
              </select>
            </div>
            <div className="field"><label>Condominio</label>
              <select className="input" value={novaCondo} onChange={e => setNovaCondo(e.target.value)}>
                <option value="">Selecione...</option>
                {condominios.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div className="row2">
              <div className="field"><label>Bloco</label><input className="input" value={novoBloco} onChange={e=>setNovoBloco(e.target.value)}/></div>
              <div className="field"><label>Apartamento</label><input className="input" value={novoApto} onChange={e=>setNovoApto(e.target.value)}/></div>
            </div>
            <div className="field"><label>Solicitante</label><input className="input" value={novoNome} onChange={e=>setNovoNome(e.target.value)}/></div>
            <div className="field"><label>Categoria</label>
              <div className="chip-row">
                {CATEGORIAS.map(c=><button key={c} className={`chip${novaCategoria===c?' selected':''}`} onClick={()=>setNovaCategoria(c)}>{c}</button>)}
              </div>
            </div>
            <div className="field"><label>Descricao</label><textarea className="input" rows={3} value={novaDescricao} onChange={e=>setNovaDescricao(e.target.value)}/></div>
            <button className="btn btn-primary btn-block" onClick={salvarNovo} disabled={salvando}>{salvando?'Salvando...':'Registrar'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

const ICONS = {
  dashboard: { bg:'#e8eeff', color:'#2843ad', svg:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
  chamados:  { bg:'#ede8f9', color:'#5b21b6', svg:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 9h8M8 13h5"/></svg> },
  novo:      { bg:'#e0edff', color:'#1a47a0', svg:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg> },
  aprovacao: { bg:'#fff3dc', color:'#8a5a00', svg:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4"/><rect x="3" y="5" width="18" height="14" rx="2"/></svg> },
  condos:    { bg:'#e8eeff', color:'#2843ad', svg:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 21V8L12 3l8 5v13"/><path d="M9 21v-6h6v6"/></svg> },
  perfil:    { bg:'#f1f0ee', color:'#6b6860', svg:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg> },
}

function IconBtn({ icon, label, active, onClick, badge }) {
  return (
    <button className={`icon-btn${active?' active':''}`} onClick={onClick} style={{ position:'relative' }}>
      {badge > 0 && <span style={{ position:'absolute', top:8, right:8, background:'var(--rust)',
        color:'#fff', borderRadius:99, fontSize:10, fontWeight:700, minWidth:18, height:18,
        display:'flex', alignItems:'center', justifyContent:'center', padding:'0 4px' }}>{badge}</span>}
      <div className="icon-btn-icon" style={{ background:icon.bg, color:icon.color }}>{icon.svg}</div>
      <span className="icon-btn-label">{label}</span>
    </button>
  )
}
