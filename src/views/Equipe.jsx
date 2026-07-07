import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { CATEGORIAS, STATUS_LABEL, STATUS_ORDER } from '../lib/constants'
import TicketCard from '../components/TicketCard'

export default function Equipe({ view, onToast }) {
  const { perfil } = useAuth()
  const [tickets, setTickets] = useState([])
  const [condominios, setCondominios] = useState([])
  const [catFiltro, setCatFiltro] = useState('todas')
  const [condoFiltro, setCondoFiltro] = useState('todos')
  const [showModal, setShowModal] = useState(false)

  // Form nova solicitação
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
    recebido: tickets.filter(t => t.status === 'recebido').length,
    andamento: tickets.filter(t => t.status === 'andamento').length,
    concluido: tickets.filter(t => t.status === 'concluido').length,
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
      condominio_id: novaCondo,
      autor_id: perfil?.id,
      categoria: novaCategoria,
      categoria_personalizada: novaCategoria === 'Outros' ? novaCatCustom : null,
      descricao: novaDescricao.trim(),
      origem: novaOrigem,
      bloco: novoBloco,
      apartamento: novoApto,
      nome_solicitante: novoNome,
    })
    setSalvando(false)
    if (error) { onToast('Erro: ' + error.message); return }
    onToast('Chamado registrado.')
    setShowModal(false)
    setNovaCategoria(null); setNovaCatCustom(''); setNovaDescricao(''); setNovoBloco(''); setNovoApto(''); setNovoNome('')
    await carregar()
  }

  if (view === 'dashboard') return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Painel</h1>
        <p className="page-sub">Visão geral de todos os chamados</p>
      </div>
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-num">{stats.total}</div><div className="stat-label">Total</div></div>
        <div className="stat-card accent-amber"><div className="stat-num">{stats.recebido}</div><div className="stat-label">Recebidos</div></div>
        <div className="stat-card accent-navy"><div className="stat-num">{stats.andamento}</div><div className="stat-label">Em andamento</div></div>
        <div className="stat-card accent-emerald"><div className="stat-num">{stats.concluido}</div><div className="stat-label">Concluídos</div></div>
      </div>
      <div className="card">
        <h3 className="section-title">Chamados recentes</h3>
        {tickets.slice(0, 5).map(t => <TicketCard key={t.id} ticket={t} onUpdate={carregar} onToast={onToast} />)}
      </div>
    </div>
  )

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Chamados</h1>
          <p className="page-sub">{filtrados.length} chamado{filtrados.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>+ Novo chamado</button>
      </div>

      <div className="toolbar">
        <div className="chip-row" style={{ flex: 1 }}>
          <button className={`chip${catFiltro === 'todas' ? ' selected' : ''}`} onClick={() => setCatFiltro('todas')}>Todas</button>
          {CATEGORIAS.map(c => (
            <button key={c} className={`chip${catFiltro === c ? ' selected' : ''}`} onClick={() => setCatFiltro(c)}>{c}</button>
          ))}
        </div>
        {condominios.length > 1 && (
          <select className="input" style={{ width: 'auto', minWidth: 160 }} value={condoFiltro} onChange={e => setCondoFiltro(e.target.value)}>
            <option value="todos">Todos os condomínios</option>
            {condominios.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        )}
      </div>

      {filtrados.length === 0
        ? <div className="empty-state">Nenhum chamado encontrado.</div>
        : filtrados.map(t => <TicketCard key={t.id} ticket={t} onUpdate={carregar} onToast={onToast} />)
      }

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Novo chamado</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
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
              {novaCategoria === 'Outros' && <input className="input" style={{ marginTop: 8 }} placeholder="Tipo de solicitação..." value={novaCatCustom} onChange={e => setNovaCatCustom(e.target.value)} />}
            </div>
            <div className="field"><label>Descrição</label><textarea className="input" rows={3} value={novaDescricao} onChange={e => setNovaDescricao(e.target.value)} /></div>
            <button className="btn btn-primary btn-block" onClick={salvarNova} disabled={salvando}>{salvando ? 'Salvando...' : 'Registrar chamado'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
