import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { CATEGORIAS, ticketNumber } from '../lib/constants'
import TicketCard from '../components/TicketCard'

export default function Conselheiro({ onToast }) {
  const { perfil, session } = useAuth()
  const [tab, setTab] = useState('chamados')
  const [tickets, setTickets] = useState([])
  const [filtro, setFiltro] = useState('todas')

  // Form novo chamado
  const [catSel, setCatSel] = useState(null)
  const [catCustom, setCatCustom] = useState('')
  const [descricao, setDescricao] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmNum, setConfirmNum] = useState(null)

  const carregar = async () => {
    const { data } = await supabase.from('solicitacoes')
      .select('*, condominios(nome)')
      .eq('condominio_id', perfil.condominio_id)
      .order('criado_em', { ascending: false })
    if (data) setTickets(data)
  }

  useEffect(() => { carregar() }, [])

  const enviar = async () => {
    if (!catSel) { onToast('Escolha o tipo de solicitação.'); return }
    if (!descricao.trim()) { onToast('Descreva o que está acontecendo.'); return }
    if (catSel === 'Outros' && !catCustom.trim()) { onToast('Diga qual é o assunto.'); return }
    setLoading(true)
    const { data, error } = await supabase.from('solicitacoes').insert({
      condominio_id: perfil.condominio_id,
      autor_id: session.user.id,
      categoria: catSel,
      categoria_personalizada: catSel === 'Outros' ? catCustom.trim() : null,
      descricao: descricao.trim(),
      origem: 'Portal do conselheiro',
      nome_solicitante: perfil.nome,
      bloco: perfil.bloco,
      apartamento: perfil.apartamento,
    }).select().single()
    setLoading(false)
    if (error) { onToast('Erro: ' + error.message); return }
    setConfirmNum(ticketNumber(data.id))
    setCatSel(null); setCatCustom(''); setDescricao('')
    await carregar()
  }

  const pendentes = tickets.filter(t => t.aprovacao_status === 'aguardando').length
  const filtrados = filtro === 'todas' ? tickets
    : tickets.filter(t => t.aprovacao_status === filtro)

  const TABS = [
    { id: 'chamados', label: 'Chamados & Votação' },
    { id: 'novo', label: '+ Novo chamado' },
  ]

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Conselheiro</h1>
        <p className="page-sub">{perfil?.nome} · {pendentes > 0 ? `${pendentes} aguardando seu voto` : 'Sem votos pendentes'}</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setConfirmNum(null) }} style={{
            padding: '9px 20px', borderRadius: 'var(--r-full)', border: '1.5px solid',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
            borderColor: tab === t.id ? 'var(--emerald)' : 'var(--gray-200)',
            background: tab === t.id ? 'var(--emerald)' : 'var(--white)',
            color: tab === t.id ? '#fff' : 'var(--gray-600)',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Aba: novo chamado */}
      {tab === 'novo' && (
        <div className="card">
          {confirmNum ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
              <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--navy)', margin: '0 0 6px' }}>Chamado aberto!</h2>
              <p style={{ color: 'var(--gray-400)', fontSize: 14, margin: '0 0 16px' }}>Número do chamado:</p>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 700, color: 'var(--emerald)', background: 'var(--mint)', border: '1.5px dashed var(--emerald)', borderRadius: 'var(--r-md)', padding: '12px 28px', display: 'inline-block', letterSpacing: 2, marginBottom: 20 }}>#{confirmNum}</div>
              <br />
              <button className="btn btn-ghost" onClick={() => setConfirmNum(null)}>Abrir outro chamado</button>
            </div>
          ) : (
            <>
              <h3 className="section-title">Novo chamado</h3>
              <div className="field">
                <label>Tipo de solicitação</label>
                <div className="chip-row">
                  {CATEGORIAS.map(c => (
                    <button key={c} className={`chip${catSel === c ? ' selected' : ''}`} onClick={() => setCatSel(c)}>{c}</button>
                  ))}
                </div>
                {catSel === 'Outros' && (
                  <input className="input" style={{ marginTop: 10 }} placeholder="Descreva o tipo..." value={catCustom} onChange={e => setCatCustom(e.target.value)} />
                )}
              </div>
              <div className="field">
                <label>Descrição</label>
                <textarea className="input" rows={4} placeholder="Descreva com detalhes..." value={descricao} onChange={e => setDescricao(e.target.value)} />
              </div>
              <button className="btn btn-primary btn-block" onClick={enviar} disabled={loading}>
                {loading ? 'Enviando...' : 'Enviar chamado'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Aba: chamados e votação */}
      {tab === 'chamados' && (
        <>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="stat-card"><div className="stat-num">{tickets.length}</div><div className="stat-label">Total</div></div>
            <div className="stat-card accent-amber"><div className="stat-num">{pendentes}</div><div className="stat-label">Pendente voto</div></div>
            <div className="stat-card accent-emerald"><div className="stat-num">{tickets.filter(t => t.aprovacao_status === 'aprovado').length}</div><div className="stat-label">Aprovados</div></div>
          </div>
          <div className="chip-row" style={{ marginBottom: 16 }}>
            {[['todas', 'Todos'], ['aguardando', 'Aguardando voto'], ['aprovado', 'Aprovados'], ['rejeitado', 'Rejeitados']].map(([v, l]) => (
              <button key={v} className={`chip${filtro === v ? ' selected' : ''}`} onClick={() => setFiltro(v)}>{l}</button>
            ))}
          </div>
          {filtrados.length === 0
            ? <div className="empty-state">Nenhum chamado aqui.</div>
            : filtrados.map(t => <TicketCard key={t.id} ticket={t} onUpdate={carregar} onToast={onToast} />)
          }
        </>
      )}
    </div>
  )
}
