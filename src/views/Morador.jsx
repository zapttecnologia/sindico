import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { CATEGORIAS, ticketNumber, STATUS_LABEL } from '../lib/constants'
import TicketCard from '../components/TicketCard'

const ICONS = {
  novo: { bg:'#E8F3F0', color:'#1A6E5C', svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg> },
  lista: { bg:'#EDE8F9', color:'#5B21B6', svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 9h8M8 13h5"/></svg> },
  historico: { bg:'#FFF3DC', color:'#8A5A00', svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> },
}

function IconBtn({ icon, label, active, onClick }) {
  return (
    <button className={`icon-btn${active ? ' active' : ''}`} onClick={onClick}>
      <div className="icon-btn-icon" style={{ background:icon.bg, color:icon.color }}>
        {icon.svg}
      </div>
      <span className="icon-btn-label">{label}</span>
    </button>
  )
}

export default function Morador({ onToast }) {
  const { perfil, session } = useAuth()
  const [tela, setTela] = useState('home')
  const [tickets, setTickets] = useState([])
  const [catSel, setCatSel] = useState(null)
  const [catCustom, setCatCustom] = useState('')
  const [descricao, setDescricao] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmNum, setConfirmNum] = useState(null)

  const carregar = async () => {
    const { data } = await supabase.from('solicitacoes')
      .select('*').eq('autor_id', session.user.id).order('criado_em', { ascending: false })
    if (data) setTickets(data)
  }

  useEffect(() => { carregar() }, [])

  const kpis = {
    total: tickets.length,
    abertos: tickets.filter(t => t.status !== 'concluido').length,
    concluidos: tickets.filter(t => t.status === 'concluido').length,
  }

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
      origem: 'Portal do morador',
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

  const local = [
    perfil?.bloco ? `Bloco ${perfil.bloco}` : '',
    perfil?.apartamento ? `Ap. ${perfil.apartamento}` : '',
  ].filter(Boolean).join(', ')

  return (
    <div>
      {/* Header do condomínio */}
      <div className="condo-header">
        <div className="condo-header-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
            <path d="M4 21V8L12 3l8 5v13"/><path d="M9 21v-6h6v6"/>
          </svg>
        </div>
        <div>
          <div className="condo-header-name">{perfil?.nome}</div>
          <div className="condo-header-sub">{local || 'Portal do Morador'}</div>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-row">
        <div className="kpi-box kpi-total">
          <div className="kpi-box-num">{kpis.total}</div>
          <div className="kpi-box-label">Total</div>
        </div>
        <div className="kpi-box kpi-aberto">
          <div className="kpi-box-num">{kpis.abertos}</div>
          <div className="kpi-box-label">Abertos</div>
        </div>
        <div className="kpi-box kpi-ok">
          <div className="kpi-box-num">{kpis.concluidos}</div>
          <div className="kpi-box-label">Concluídos</div>
        </div>
      </div>

      {/* Grid de navegação */}
      <div className="section-group">
        <div className="section-group-title">Solicitações</div>
        <div className="icon-grid">
          <IconBtn icon={ICONS.novo} label="Novo chamado" active={tela==='novo'} onClick={() => { setTela('novo'); setConfirmNum(null) }} />
          <IconBtn icon={ICONS.lista} label="Meus chamados" active={tela==='lista'} onClick={() => setTela('lista')} />
          <IconBtn icon={ICONS.historico} label="Histórico" active={tela==='historico'} onClick={() => setTela('historico')} />
        </div>
      </div>

      {/* ── Tela: Novo chamado ── */}
      {tela === 'novo' && (
        <div className="card">
          {confirmNum ? (
            <div style={{ textAlign:'center', padding:'20px 0' }}>
              <div style={{ fontSize:40, marginBottom:8 }}>✅</div>
              <h2 style={{ fontFamily:'var(--font-display)', color:'var(--navy)', margin:'0 0 6px' }}>Chamado aberto!</h2>
              <p style={{ color:'var(--gray-400)', fontSize:14, margin:'0 0 16px' }}>Número do chamado:</p>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:28, fontWeight:700, color:'var(--emerald)',
                background:'var(--mint)', border:'1.5px dashed var(--emerald)', borderRadius:'var(--r-md)',
                padding:'12px 28px', display:'inline-block', letterSpacing:2, marginBottom:20 }}>
                #{confirmNum}
              </div>
              <br/>
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
                  <input className="input" style={{ marginTop:10 }} placeholder="Descreva o tipo..." value={catCustom} onChange={e => setCatCustom(e.target.value)} />
                )}
              </div>
              <div className="field">
                <label>Descrição</label>
                <textarea className="input" rows={4} placeholder="Conte com detalhes: local, horário, o que notou..." value={descricao} onChange={e => setDescricao(e.target.value)} />
              </div>
              <button className="btn btn-primary btn-block" onClick={enviar} disabled={loading}>
                {loading ? 'Enviando...' : 'Enviar chamado'}
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Tela: Meus chamados (apenas abertos) ── */}
      {tela === 'lista' && (
        <div>
          <h3 className="section-title">Chamados em andamento</h3>
          {tickets.filter(t => t.status !== 'concluido').length === 0
            ? <div className="empty-state">Nenhum chamado em aberto.</div>
            : tickets.filter(t => t.status !== 'concluido').map(t =>
                <TicketCard key={t.id} ticket={t} onUpdate={carregar} onToast={onToast} />
              )
          }
        </div>
      )}

      {/* ── Tela: Histórico (todos) ── */}
      {tela === 'historico' && (
        <div>
          <h3 className="section-title">Histórico completo</h3>
          {tickets.length === 0
            ? <div className="empty-state">Nenhum chamado registrado.</div>
            : tickets.map(t => <TicketCard key={t.id} ticket={t} onUpdate={carregar} onToast={onToast} />)
          }
        </div>
      )}
    </div>
  )
}
