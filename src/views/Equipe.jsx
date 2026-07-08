import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { CATEGORIAS, STATUS_LABEL, STATUS_ORDER, fmtDate, statusClass, aprovClass, APROVACAO_LABEL } from '../lib/constants'
import TicketDetail from '../components/TicketDetail'

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

export default function Equipe({ view, onToast }) {
  const { perfil } = useAuth()
  const [tela, setTela] = useState('dashboard')
  const [tickets, setTickets] = useState([])
  const [condominios, setCondominios] = useState([])
  const [condoFiltro, setCondoFiltro] = useState('todos')
  const [catFiltro, setCatFiltro] = useState('todas')
  const [statusFiltro, setStatusFiltro] = useState('todos')
  const [ticketSel, setTicketSel] = useState(null)
  const [showModalNovo, setShowModalNovo] = useState(false)

  // Form novo chamado
  const [novaCategoria, setNovaCategoria] = useState(null)
  const [novaDescricao, setNovaDescricao] = useState('')
  const [novaCondo, setNovaCondo] = useState('')
  const [novaOrigem, setNovaOrigem] = useState('E-mail')
  const [novoBloco, setNovoBloco] = useState('')
  const [novoApto, setNovoApto] = useState('')
  const [novoNome, setNovoNome] = useState('')
  const [salvando, setSalvando] = useState(false)

  const ehAdmin = perfil?.papel === 'admin'

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

  // Filtragem
  const ticketsFiltrados = tickets.filter(t => {
    if (condoFiltro !== 'todos' && t.condominio_id !== condoFiltro) return false
    if (catFiltro !== 'todas' && t.categoria !== catFiltro) return false
    if (statusFiltro === 'pendentes' && t.status === 'concluido') return false
    if (statusFiltro === 'aprovacao' && t.aprovacao_status !== 'aguardando') return false
    if (statusFiltro !== 'todos' && statusFiltro !== 'pendentes' && statusFiltro !== 'aprovacao' && t.status !== statusFiltro) return false
    return true
  })

  const stats = (list) => ({
    total: list.length,
    pendentes: list.filter(t => t.status !== 'concluido').length,
    aprovacao: list.filter(t => t.aprovacao_status === 'aguardando').length,
    concluidos: list.filter(t => t.status === 'concluido').length,
  })

  const globalStats = stats(tickets)
  const filtStats = stats(ticketsFiltrados)

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

  // Se um ticket está selecionado, mostra o detalhe
  if (ticketSel) return (
    <TicketDetail
      ticket={ticketSel}
      onBack={() => { setTicketSel(null); carregar() }}
      onToast={onToast}
    />
  )

  return (
    <div>
      {/* Header */}
      <div className="condo-header">
        <div className="condo-header-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
            <path d="M4 21V8L12 3l8 5v13"/><path d="M9 21v-6h6v6"/>
          </svg>
        </div>
        <div>
          <div className="condo-header-name">{ehAdmin ? 'Painel Admin' : 'Painel do Sindico'}</div>
          <div className="condo-header-sub">{condominios.length} condominio{condominios.length!==1?'s':''} sob gestao</div>
        </div>
      </div>

      {/* Navegacao por icones */}
      <div className="section-group">
        <div className="icon-grid">
          <IconBtn icon={ICONS.dashboard} label="Painel" active={tela==='dashboard'} onClick={() => setTela('dashboard')} />
          <IconBtn icon={ICONS.chamados} label="Chamados" active={tela==='chamados'} onClick={() => setTela('chamados')} badge={globalStats.pendentes} />
          <IconBtn icon={ICONS.novo} label="Novo chamado" onClick={() => setShowModalNovo(true)} />
          <IconBtn icon={ICONS.aprovacao} label="Aprovacoes" active={tela==='aprovacao'} onClick={() => setTela('aprovacao')} badge={globalStats.aprovacao} />
        </div>
      </div>

      {/* ── PAINEL / DASHBOARD ── */}
      {tela === 'dashboard' && (
        <div>
          {/* Filtro por condominio */}
          {condominios.length > 1 && (
            <div style={{ marginBottom:20 }}>
              <select className="input" style={{ width:'auto', minWidth:220 }} value={condoFiltro} onChange={e => setCondoFiltro(e.target.value)}>
                <option value="todos">Todos os condominios</option>
                {condominios.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          )}

          {/* KPIs */}
          <div className="stats-grid" style={{ gridTemplateColumns:'repeat(4,1fr)', marginBottom:28 }}>
            {[
              { label:'Total', val: filtStats.total, color:'var(--navy)', onClick: () => { setTela('chamados'); setStatusFiltro('todos') } },
              { label:'Pendentes', val: filtStats.pendentes, color:'var(--amber)', onClick: () => { setTela('chamados'); setStatusFiltro('pendentes') } },
              { label:'Ag. aprovacao', val: filtStats.aprovacao, color:'#8a5a00', onClick: () => setTela('aprovacao') },
              { label:'Concluidos', val: filtStats.concluidos, color:'var(--emerald)', onClick: () => { setTela('chamados'); setStatusFiltro('concluido') } },
            ].map(k => (
              <div key={k.label} className="stat-card" style={{ cursor:'pointer' }} onClick={k.onClick}>
                <div className="stat-num" style={{ color:k.color }}>{k.val}</div>
                <div className="stat-label">{k.label}</div>
              </div>
            ))}
          </div>

          {/* Por condominio */}
          {condoFiltro === 'todos' && condominios.length > 1 && (
            <div className="card">
              <h3 className="section-title">Por condominio</h3>
              {condominios.map(c => {
                const t = tickets.filter(tk => tk.condominio_id === c.id)
                const pendentes = t.filter(tk => tk.status !== 'concluido').length
                return (
                  <div key={c.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'12px 0', borderBottom:'1px solid var(--gray-100)', flexWrap:'wrap', gap:10 }}>
                    <div>
                      <div style={{ fontWeight:600, fontSize:14, color:'var(--gray-800)' }}>{c.nome}</div>
                      <div style={{ fontSize:12, color:'var(--gray-400)' }}>{t.length} chamado{t.length!==1?'s':''}</div>
                    </div>
                    <div style={{ display:'flex', gap:12 }}>
                      <span style={{ fontSize:13, fontWeight:700, color:pendentes>0?'var(--amber)':'var(--gray-400)' }}>
                        {pendentes} pendente{pendentes!==1?'s':''}
                      </span>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setCondoFiltro(c.id); setTela('chamados') }}>
                        Ver chamados
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Ultimos chamados */}
          <div className="card" style={{ marginTop:16 }}>
            <h3 className="section-title">Ultimos chamados</h3>
            {(condoFiltro==='todos'?tickets:tickets.filter(t=>t.condominio_id===condoFiltro)).slice(0,8).map(t => (
              <div key={t.id} onClick={() => setTicketSel(t)}
                style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 0',
                  borderBottom:'1px solid var(--gray-100)', cursor:'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background='var(--gray-50)'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:'var(--gray-800)' }}>
                    {t.categoria_personalizada||t.categoria}
                  </div>
                  <div style={{ fontSize:12, color:'var(--gray-400)' }}>
                    {t.condominios?.nome} {t.bloco?`· Bl. ${t.bloco}`:''} {t.apartamento?`· ${t.apartamento}`:''} · {fmtDate(t.criado_em)}
                  </div>
                </div>
                <span className={`status-badge ${statusClass(t.status)}`} style={{ flexShrink:0 }}>{STATUS_LABEL[t.status]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── CHAMADOS ── */}
      {tela === 'chamados' && (
        <div>
          {/* Filtros */}
          <div style={{ background:'var(--white)', border:'1px solid var(--gray-200)', borderRadius:'var(--r-lg)',
            padding:'16px 20px', marginBottom:16 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px,1fr))', gap:10 }}>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', display:'block', marginBottom:4 }}>
                  Condominio
                </label>
                <select className="input" style={{ fontSize:13 }} value={condoFiltro} onChange={e => setCondoFiltro(e.target.value)}>
                  <option value="todos">Todos</option>
                  {condominios.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', display:'block', marginBottom:4 }}>
                  Categoria
                </label>
                <select className="input" style={{ fontSize:13 }} value={catFiltro} onChange={e => setCatFiltro(e.target.value)}>
                  <option value="todas">Todas</option>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', display:'block', marginBottom:4 }}>
                  Status
                </label>
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
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 }}>
            {[
              { l:'Total filtrado', v:filtStats.total, c:'var(--navy)' },
              { l:'Pendentes', v:filtStats.pendentes, c:'var(--amber)' },
              { l:'Ag. aprovacao', v:filtStats.aprovacao, c:'#8a5a00' },
            ].map(k => (
              <div key={k.l} style={{ background:'var(--white)', border:'1px solid var(--gray-200)',
                borderRadius:'var(--r-lg)', padding:'12px 14px', textAlign:'center' }}>
                <div style={{ fontFamily:'var(--font-display)', fontSize:24, fontWeight:800, color:k.c }}>{k.v}</div>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.05em' }}>{k.l}</div>
              </div>
            ))}
          </div>

          {/* Lista */}
          {ticketsFiltrados.length === 0
            ? <div className="empty-state">Nenhum chamado encontrado com esses filtros.</div>
            : ticketsFiltrados.map(t => (
              <div key={t.id} onClick={() => setTicketSel(t)}
                className="ticket-card" style={{ cursor:'pointer' }}
                onMouseEnter={e => e.currentTarget.style.boxShadow='var(--shadow-md)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow='var(--shadow-sm)'}>
                <div className="ticket-header">
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:6 }}>
                      <span className="badge badge-cat">{t.categoria_personalizada||t.categoria}</span>
                      {t.aprovacao_status && <span className={`status-badge ${aprovClass(t.aprovacao_status)}`}>{APROVACAO_LABEL[t.aprovacao_status]}</span>}
                    </div>
                    <div style={{ fontWeight:700, fontSize:14, color:'var(--gray-800)' }}>
                      {t.condominios?.nome}
                      {t.bloco ? ` · Bloco ${t.bloco}` : ''}
                      {t.apartamento ? ` · Ap. ${t.apartamento}` : ''}
                    </div>
                    {t.nome_solicitante && <div style={{ fontSize:13, color:'var(--gray-400)' }}>{t.nome_solicitante}</div>}
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
                    <span className={`status-badge ${statusClass(t.status)}`}>{STATUS_LABEL[t.status]}</span>
                    <span style={{ fontSize:11, color:'var(--gray-400)', fontFamily:'var(--font-mono)' }}>
                      {fmtDate(t.criado_em)}
                    </span>
                  </div>
                </div>
                <p className="ticket-desc">{t.descricao}</p>
                <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:8 }}>
                  Clique para abrir e gerenciar →
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* ── APROVACOES ── */}
      {tela === 'aprovacao' && (
        <div>
          <h3 className="section-title">Aguardando aprovacao dos conselheiros</h3>
          {tickets.filter(t => t.aprovacao_status === 'aguardando').length === 0
            ? <div className="empty-state">Nenhum chamado aguardando aprovacao.</div>
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
              <button className="modal-close" onClick={() => setShowModalNovo(false)}>X</button>
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
            <button className="btn btn-primary btn-block" onClick={salvarNovo} disabled={salvando}>{salvando?'Salvando...':'Registrar chamado'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
