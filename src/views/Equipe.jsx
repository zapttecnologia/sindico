import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { CATEGORIAS } from '../lib/constants'
import TicketCard from '../components/TicketCard'

const ICONS = {
  dashboard: { bg:'#E8F3F0', color:'#1A6E5C', svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
  chamados:  { bg:'#EDE8F9', color:'#5B21B6', svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 9h8M8 13h5"/></svg> },
  novo:      { bg:'#E0EDFF', color:'#1A47A0', svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg> },
  aprovacao: { bg:'#FFF3DC', color:'#8A5A00', svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4"/><rect x="3" y="5" width="18" height="14" rx="2"/></svg> },
  admin:     { bg:'#FDECEA', color:'#C0392B', svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg> },
  condos:    { bg:'#E8F3F0', color:'#27795E', svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 21V8L12 3l8 5v13"/><path d="M9 21v-6h6v6"/></svg> },
}

function IconBtn({ icon, label, active, onClick, badge }) {
  return (
    <button className={`icon-btn${active ? ' active' : ''}`} onClick={onClick} style={{ position:'relative' }}>
      {badge > 0 && (
        <span style={{ position:'absolute', top:8, right:8, background:'var(--rust)', color:'#fff',
          borderRadius:'99px', fontSize:10, fontWeight:700, minWidth:18, height:18,
          display:'flex', alignItems:'center', justifyContent:'center', padding:'0 4px' }}>
          {badge}
        </span>
      )}
      <div className="icon-btn-icon" style={{ background:icon.bg, color:icon.color }}>{icon.svg}</div>
      <span className="icon-btn-label">{label}</span>
    </button>
  )
}

export default function Equipe({ view, onToast }) {
  const { perfil } = useAuth()
  const [tela, setTela] = useState(view === 'admin' ? 'admin' : 'home')
  const [tickets, setTickets] = useState([])
  const [condominios, setCondominios] = useState([])
  const [catFiltro, setCatFiltro] = useState('todas')
  const [condoFiltro, setCondoFiltro] = useState('todos')
  const [showModal, setShowModal] = useState(false)
  const [novaCategoria, setNovaCategoria] = useState(null)
  const [novaCatCustom, setNovaCatCustom] = useState('')
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
      if (data) setCondominios(data.map(r => ({ id: r.condominio_id, nome: r.condominios?.nome || '' })))
    }
  }

  const carregar = async () => {
    const { data } = await supabase.from('solicitacoes')
      .select('*, condominios(nome)').order('criado_em', { ascending: false })
    if (data) setTickets(data)
  }

  useEffect(() => { carregarCondos(); carregar() }, [])

  const stats = {
    total: tickets.length,
    abertos: tickets.filter(t => t.status === 'recebido').length,
    andamento: tickets.filter(t => t.status === 'andamento').length,
    concluidos: tickets.filter(t => t.status === 'concluido').length,
    aprovacao: tickets.filter(t => t.aprovacao_status === 'aguardando').length,
  }

  const filtrados = tickets.filter(t => {
    if (condoFiltro !== 'todos' && t.condominio_id !== condoFiltro) return false
    if (catFiltro !== 'todas' && t.categoria !== catFiltro) return false
    return true
  })

  const salvarNova = async () => {
    if (!novaCategoria || !novaDescricao.trim() || !novaCondo) { onToast('Preencha categoria, condomínio e descrição.'); return }
    setSalvando(true)
    const { error } = await supabase.from('solicitacoes').insert({
      condominio_id: novaCondo, autor_id: perfil?.id, categoria: novaCategoria,
      categoria_personalizada: novaCategoria === 'Outros' ? novaCatCustom : null,
      descricao: novaDescricao.trim(), origem: novaOrigem,
      bloco: novoBloco, apartamento: novoApto, nome_solicitante: novoNome,
    })
    setSalvando(false)
    if (error) { onToast('Erro: ' + error.message); return }
    onToast('Chamado registrado.'); setShowModal(false)
    setNovaCategoria(null); setNovaCatCustom(''); setNovaDescricao(''); setNovoBloco(''); setNovoApto(''); setNovoNome('')
    await carregar()
  }

  // Se vier do menu de administração, vai direto para essa tela
  useEffect(() => { if (view === 'admin') setTela('admin') }, [view])

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
          <div className="condo-header-name">{ehAdmin ? 'Painel Admin' : 'Painel do Síndico'}</div>
          <div className="condo-header-sub">{condominios.length} condomínio{condominios.length !== 1 ? 's' : ''} sob gestão</div>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-row">
        <div className="kpi-box kpi-total">
          <div className="kpi-box-num">{stats.total}</div>
          <div className="kpi-box-label">Total</div>
        </div>
        <div className="kpi-box kpi-aberto">
          <div className="kpi-box-num">{stats.abertos + stats.andamento}</div>
          <div className="kpi-box-label">Abertos</div>
        </div>
        <div className="kpi-box kpi-ok">
          <div className="kpi-box-num">{stats.concluidos}</div>
          <div className="kpi-box-label">Concluídos</div>
        </div>
      </div>

      {/* Grid de navegação */}
      <div className="section-group">
        <div className="section-group-title">Gestão</div>
        <div className="icon-grid">
          <IconBtn icon={ICONS.chamados} label="Chamados" active={tela==='chamados'} onClick={() => setTela('chamados')} badge={stats.abertos} />
          <IconBtn icon={ICONS.novo} label="Novo chamado" active={tela==='novo'} onClick={() => { setTela('novo'); setShowModal(true) }} />
          <IconBtn icon={ICONS.aprovacao} label="Aprovações" active={tela==='aprovacao'} onClick={() => setTela('aprovacao')} badge={stats.aprovacao} />
          {(ehAdmin) && <IconBtn icon={ICONS.admin} label="Usuários" active={tela==='admin'} onClick={() => setTela('admin')} />}
          <IconBtn icon={ICONS.condos} label="Condomínios" active={tela==='condos'} onClick={() => setTela('condos')} />
        </div>
      </div>

      {/* ── CHAMADOS ── */}
      {(tela === 'chamados' || tela === 'home') && tela !== 'novo' && tela !== 'aprovacao' && tela !== 'admin' && tela !== 'condos' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10 }}>
            <h3 className="section-title" style={{ margin:0 }}>Todos os chamados</h3>
            {condominios.length > 1 && (
              <select className="input" style={{ width:'auto', minWidth:160 }} value={condoFiltro} onChange={e => setCondoFiltro(e.target.value)}>
                <option value="todos">Todos os condomínios</option>
                {condominios.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            )}
          </div>
          <div className="chip-row" style={{ marginBottom:14 }}>
            <button className={`chip${catFiltro === 'todas' ? ' selected' : ''}`} onClick={() => setCatFiltro('todas')}>Todas</button>
            {CATEGORIAS.map(c => <button key={c} className={`chip${catFiltro === c ? ' selected' : ''}`} onClick={() => setCatFiltro(c)}>{c}</button>)}
          </div>
          {filtrados.length === 0
            ? <div className="empty-state">Nenhum chamado encontrado.</div>
            : filtrados.map(t => <TicketCard key={t.id} ticket={t} onUpdate={carregar} onToast={onToast} />)
          }
        </div>
      )}

      {/* ── APROVAÇÕES ── */}
      {tela === 'aprovacao' && (
        <div>
          <h3 className="section-title">Aguardando aprovação</h3>
          {tickets.filter(t => t.aprovacao_status === 'aguardando').length === 0
            ? <div className="empty-state">Nenhum chamado aguardando aprovação.</div>
            : tickets.filter(t => t.aprovacao_status === 'aguardando').map(t =>
                <TicketCard key={t.id} ticket={t} onUpdate={carregar} onToast={onToast} />
              )
          }
        </div>
      )}

      {/* ── MODAL NOVO CHAMADO ── */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Novo chamado</h3>
              <button className="modal-close" onClick={() => { setShowModal(false); setTela('chamados') }}>✕</button>
            </div>
            <div className="field">
              <label>Origem</label>
              <select className="input" value={novaOrigem} onChange={e => setNovaOrigem(e.target.value)}>
                {['E-mail','Telefone','Presencial','WhatsApp','Outro'].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Condomínio</label>
              <select className="input" value={novaCondo} onChange={e => setNovaCondo(e.target.value)}>
                <option value="">Selecione...</option>
                {condominios.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div className="row2">
              <div className="field"><label>Bloco</label><input className="input" value={novoBloco} onChange={e => setNovoBloco(e.target.value)} /></div>
              <div className="field"><label>Apartamento</label><input className="input" value={novoApto} onChange={e => setNovoApto(e.target.value)} /></div>
            </div>
            <div className="field"><label>Solicitante</label><input className="input" value={novoNome} onChange={e => setNovoNome(e.target.value)} /></div>
            <div className="field">
              <label>Categoria</label>
              <div className="chip-row">
                {CATEGORIAS.map(c => <button key={c} className={`chip${novaCategoria === c ? ' selected' : ''}`} onClick={() => setNovaCategoria(c)}>{c}</button>)}
              </div>
              {novaCategoria === 'Outros' && <input className="input" style={{ marginTop:8 }} placeholder="Tipo de solicitação..." value={novaCatCustom} onChange={e => setNovaCatCustom(e.target.value)} />}
            </div>
            <div className="field"><label>Descrição</label><textarea className="input" rows={3} value={novaDescricao} onChange={e => setNovaDescricao(e.target.value)} /></div>
            <button className="btn btn-primary btn-block" onClick={salvarNova} disabled={salvando}>{salvando ? 'Salvando...' : 'Registrar chamado'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
