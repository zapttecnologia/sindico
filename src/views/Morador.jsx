import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { ticketNumber, fmtDate, STATUS_LABEL, statusClass } from '../lib/constants'
import AnexosPanel from '../components/AnexosPanel'
import Modal from '../components/Modal'

const CAT_ICONS = {
  'Manutencao':       { bg:'#fff3dc', color:'#8a5a00', svg:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg> },
  'Reclamacao':       { bg:'#fdecea', color:'#c0392b', svg:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
  'Elevador':         { bg:'#e0edff', color:'#1a47a0', svg:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M9 9l3-3 3 3M9 15l3 3 3-3"/></svg> },
  'Limpeza':          { bg:'#e8eeff', color:'#2843ad', svg:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M9 22V12h6v10"/></svg> },
  'Portaria':         { bg:'#ede8f9', color:'#5b21b6', svg:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><circle cx="16" cy="12" r="1.5"/></svg> },
  'Interfone/Antena': { bg:'#fff3dc', color:'#8a5a00', svg:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0M12 20h.01"/></svg> },
  'Outros':           { bg:'#f1f0ee', color:'#6b6860', svg:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg> },
  'Denuncia':         { bg:'#fdecea', color:'#c0392b', svg:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
  'Sugestao':         { bg:'#e8eeff', color:'#2843ad', svg:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg> },
}
const CAT_LABEL = {
  'Manutencao':'Manutenção','Reclamacao':'Reclamação','Elevador':'Elevador',
  'Limpeza':'Limpeza','Portaria':'Portaria','Interfone/Antena':'Interfone',
  'Outros':'Outros','Denuncia':'Denúncia','Sugestao':'Sugestões',
}

// Para o morador: esconde tudo relacionado a aprovação/conselheiros
function statusMorador(ticket) {
  // Se está aguardando aprovação dos conselheiros, mostrar como "em análise"
  if (ticket.aprovacao_status === 'aguardando') return { label:'Em análise', cls:'status-recebido' }
  return { label: STATUS_LABEL[ticket.status], cls: statusClass(ticket.status) }
}

function TicketRow({ ticket, onClick }) {
  const st = statusMorador(ticket)
  return (
    <div onClick={onClick} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 0',
      borderBottom:'1px solid var(--gray-100)', cursor:'pointer' }}
      onMouseEnter={e=>e.currentTarget.style.background='var(--gray-50)'}
      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:14, fontWeight:600, color:'var(--gray-800)' }}>
          {ticket.categoria_personalizada || ticket.categoria}
        </div>
        <div style={{ fontSize:12, color:'var(--gray-400)', marginTop:2 }}>
          #{ticketNumber(ticket.id)} · {fmtDate(ticket.criado_em)}
        </div>
      </div>
      <span className={`status-badge ${st.cls}`} style={{ flexShrink:0 }}>{st.label}</span>
    </div>
  )
}

export default function Morador({ view, onNavigate, onToast }) {
  const { perfil, session, logout } = useAuth()
  const [tickets, setTickets] = useState([])
  const [condoInfo, setCondoInfo] = useState(null)
  const [categorias, setCategorias] = useState([])
  const [subcategorias, setSubcategorias] = useState([])
  // Novo fluxo: passo 1=categorias, 2=subcategorias, 3=formulário
  const [passo, setPasso] = useState(1)
  const [catSel, setCatSel] = useState(null)       // objeto categoria
  const [subCatSel, setSubCatSel] = useState(null) // objeto subcategoria
  const [descricao, setDescricao] = useState('')
  const [prioridade, setPrioridade] = useState('media')
  const [anonimo, setAnonimo] = useState(false)
  const [extraAnonimo, setExtraAnonimo] = useState(false)
  const [loading, setLoading] = useState(false)
  const [ticketCriado, setTicketCriado] = useState(null)
  const [arquivosSel, setArquivosSel] = useState([])
  const [ticketDetalhe, setTicketDetalhe] = useState(null)
  const [subTela, setSubTela] = useState(null)
  const MAX_BYTES = 10 * 1024 * 1024

  const carregar = async () => {
    const [{ data:t }, { data:c }] = await Promise.all([
      supabase.from('solicitacoes').select('*').eq('autor_id', session.user.id).order('criado_em', { ascending:false }),
      perfil.condominio_id
        ? supabase.from('condominios').select('id,nome,regulamento_pdf_url,convencao_pdf_url').eq('id', perfil.condominio_id).single()
        : Promise.resolve({ data: null }),
    ])
    if (t) setTickets(t)
    if (c) setCondoInfo(c)

    // Carregar categorias (filtradas pelo condomínio se configuradas)
    const { data: catCondo } = perfil.condominio_id
      ? await supabase.from('categorias_condominio').select('categoria_id').eq('condominio_id', perfil.condominio_id).eq('ativo', true)
      : { data: null }

    let query = supabase.from('categorias_sistema').select('*').eq('ativo', true).order('ordem')
    if (catCondo && catCondo.length > 0) {
      query = query.in('id', catCondo.map(c => c.categoria_id))
    }
    const { data: cats } = await query
    setCategorias(cats || [])
  }

  useEffect(() => { carregar() }, [])

  // Recarrega ao trocar de view e quando a aba volta ao foco
  useEffect(() => { carregar() }, [view])
  useEffect(() => {
    const onFocus = () => carregar()
    const onVisible = () => { if (!document.hidden) carregar() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  // Resetar seleção ao mudar de view
  useEffect(() => {
    setPasso(1); setCatSel(null); setSubCatSel(null)
    setTicketCriado(null); setDescricao(''); setArquivosSel([])
    setSubTela(null); setAnonimo(false); setPrioridade('media')
  }, [view])

  const kpis = {
    total:    tickets.length,
    abertos:  tickets.filter(t => t.status !== 'concluido').length,
    concluidos: tickets.filter(t => t.status === 'concluido').length,
  }

  const handleSelecionarArquivos = (e) => {
    const files = Array.from(e.target.files||[])
    const invalidos = files.filter(f => f.size > MAX_BYTES)
    if (invalidos.length) onToast(`Ignorados (acima de 10MB): ${invalidos.map(f=>f.name).join(', ')}`)
    setArquivosSel(prev => [...prev, ...files.filter(f => f.size <= MAX_BYTES)])
    e.target.value = ''
  }

  const enviarNovo = async () => {
    if (!descricao.trim()) { onToast('Descreva o que aconteceu.'); return }
    setLoading(true)
    const { data, error } = await supabase.from('solicitacoes').insert({
      condominio_id:    perfil.condominio_id,
      autor_id:         session.user.id,
      categoria:        catSel?.nome || 'Outros',
      categoria_id:     catSel?.id || null,
      subcategoria:     subCatSel?.nome || null,
      subcategoria_id:  subCatSel?.id || null,
      descricao:        descricao.trim(),
      prioridade:       prioridade,
      status:           'aberto',
      origem:           'Portal do morador',
      anonimo:          anonimo,
      nome_solicitante: anonimo ? 'Anônimo' : perfil.nome,
      bloco:            perfil.bloco,
      apartamento:      perfil.apartamento,
    }).select().single()
    if (error) { setLoading(false); onToast('Erro: '+error.message); return }
    for (const file of arquivosSel) {
      const nomeSeguro = `${Date.now()}_${file.name}`.replace(/[^a-zA-Z0-9._-]/g, '_')
      await supabase.storage.from('anexos-solicitacoes').upload(`${data.id}/${nomeSeguro}`, file)
    }
    setLoading(false)
    setTicketCriado(data); setDescricao(''); setArquivosSel([])
    setPasso(1); setCatSel(null); setSubCatSel(null); setAnonimo(false); setPrioridade('media')
    await carregar()
  }

  const enviar = async (tipo) => {
    if (!descricao.trim()) { onToast('Escreva a descrição.'); return }
    setLoading(true)
    const isExtra = ['Denuncia','Sugestao'].includes(tipo)
    const { data, error } = await supabase.from('solicitacoes').insert({
      condominio_id: perfil.condominio_id,
      autor_id: session.user.id,
      categoria: isExtra ? (tipo==='Denuncia'?'Reclamacao':'Outros') : (CAT_LABEL[tipo]||tipo),
      categoria_personalizada: isExtra ? tipo : null,
      descricao: (isExtra && extraAnonimo ? '[ANÔNIMO] ' : '') + descricao.trim(),
      status: 'aberto',
      origem: 'Portal do morador',
      nome_solicitante: isExtra && extraAnonimo ? 'Anônimo' : perfil.nome,
      bloco: perfil.bloco,
      apartamento: perfil.apartamento,
    }).select().single()
    if (error) { setLoading(false); onToast('Erro: '+error.message); return }
    for (const file of arquivosSel) {
      const nomeSeguro = `${Date.now()}_${file.name}`.replace(/[^a-zA-Z0-9._-]/g, '_')
      await supabase.storage.from('anexos-solicitacoes').upload(`${data.id}/${nomeSeguro}`, file)
    }
    setLoading(false)
    setTicketCriado(data); setDescricao(''); setArquivosSel([]); setExtraAnonimo(false)
    await carregar()
  }

  const local = [perfil?.bloco?`Bloco ${perfil.bloco}`:'', perfil?.apartamento?`Ap. ${perfil.apartamento}`:''].filter(Boolean).join(', ')

  const header = (
    <div className="condo-header" style={{ marginBottom:24 }}>
      <div className="condo-header-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
          <path d="M4 21V8L12 3l8 5v13"/><path d="M9 21v-6h6v6"/>
        </svg>
      </div>
      <div style={{ flex:1 }}>
        <div className="condo-header-name">{condoInfo?.nome || 'Meu Condomínio'}</div>
        <div className="condo-header-sub">{perfil?.nome}{local?` · ${local}`:''}</div>
      </div>
      <button onClick={logout} style={{ background:'none', border:'1px solid var(--gray-200)',
        borderRadius:'var(--r-md)', padding:'6px 12px', fontSize:12, fontWeight:600,
        color:'var(--gray-500)', cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
          <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        Sair
      </button>
    </div>
  )

  // ── TELA: REGULAMENTO ───────────────────────────────────────
  if (subTela === 'regulamento') return (
    <div>
      <button onClick={()=>setSubTela(null)} style={{ background:'var(--gray-100)', border:'none',
        borderRadius:'var(--r-md)', padding:'8px 14px', fontSize:13, fontWeight:600,
        color:'var(--gray-600)', cursor:'pointer', marginBottom:20 }}>← Voltar</button>
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:24 }}>
        <div className="icon-btn-icon" style={{ background:'#e0edff', color:'#1a47a0', width:52, height:52, borderRadius:'var(--r-lg)' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        </div>
        <h2 style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:800, color:'var(--navy)', margin:0 }}>
          Regulamento Interno
        </h2>
      </div>
      <div className="card" style={{ textAlign:'center', padding:'40px 28px' }}>
        {condoInfo?.regulamento_pdf_url ? (
          <>
            <div style={{ fontSize:48, marginBottom:12 }}>📄</div>
            <h3 style={{ fontFamily:'var(--font-display)', color:'var(--navy)', margin:'0 0 8px' }}>Regulamento Interno</h3>
            <p style={{ fontSize:13, color:'var(--gray-400)', margin:'0 0 24px' }}>{condoInfo.nome}</p>
            <a href={condoInfo.regulamento_pdf_url} target="_blank" rel="noopener noreferrer"
              className="btn btn-primary" style={{ display:'inline-flex', gap:8, textDecoration:'none' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Visualizar / Baixar PDF
            </a>
          </>
        ) : (
          <>
            <div style={{ fontSize:48, marginBottom:12, opacity:.3 }}>📄</div>
            <p style={{ color:'var(--gray-400)', fontSize:14 }}>
              O regulamento interno ainda não foi disponibilizado.<br/>
              Entre em contato com a administração.
            </p>
          </>
        )}
      </div>
    </div>
  )

  // ── TELA: CONVENÇÃO ──────────────────────────────────────────
  if (subTela === 'convencao') return (
    <div>
      <button onClick={()=>setSubTela(null)} style={{ background:'var(--gray-100)', border:'none',
        borderRadius:'var(--r-md)', padding:'8px 14px', fontSize:13, fontWeight:600,
        color:'var(--gray-600)', cursor:'pointer', marginBottom:20 }}>← Voltar</button>
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:24 }}>
        <div className="icon-btn-icon" style={{ background:'#e8f3f0', color:'#1a6e5c', width:52, height:52, borderRadius:'var(--r-lg)' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>
        </div>
        <h2 style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:800, color:'var(--navy)', margin:0 }}>
          Convenção do Condomínio
        </h2>
      </div>
      <div className="card" style={{ textAlign:'center', padding:'40px 28px' }}>
        {condoInfo?.convencao_pdf_url ? (
          <>
            <div style={{ fontSize:48, marginBottom:12 }}>📋</div>
            <h3 style={{ fontFamily:'var(--font-display)', color:'var(--navy)', margin:'0 0 8px' }}>Convenção do Condomínio</h3>
            <p style={{ fontSize:13, color:'var(--gray-400)', margin:'0 0 24px' }}>{condoInfo.nome}</p>
            <a href={condoInfo.convencao_pdf_url} target="_blank" rel="noopener noreferrer"
              className="btn btn-primary" style={{ display:'inline-flex', gap:8, textDecoration:'none' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Visualizar / Baixar PDF
            </a>
          </>
        ) : (
          <>
            <div style={{ fontSize:48, marginBottom:12, opacity:.3 }}>📋</div>
            <p style={{ color:'var(--gray-400)', fontSize:14 }}>
              A convenção ainda não foi disponibilizada.<br/>
              Entre em contato com a administração.
            </p>
          </>
        )}
      </div>
    </div>
  )

  // ── TELA: DETALHE DO CHAMADO ────────────────────────────────
  if (ticketDetalhe) {
    const st = statusMorador(ticketDetalhe)
    return (
      <div>
        <button onClick={()=>setTicketDetalhe(null)} style={{ background:'var(--gray-100)', border:'none',
          borderRadius:'var(--r-md)', padding:'8px 14px', fontSize:13, fontWeight:600,
          color:'var(--gray-600)', cursor:'pointer', marginBottom:20 }}>← Voltar</button>
        <div className="card">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:8 }}>
            <div>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--gray-400)', marginBottom:4 }}>
                #{ticketNumber(ticketDetalhe.id)}
              </div>
              <h2 style={{ fontFamily:'var(--font-display)', fontSize:18, fontWeight:700, color:'var(--navy)', margin:0 }}>
                {ticketDetalhe.categoria_personalizada||ticketDetalhe.categoria}
              </h2>
              <div style={{ fontSize:12, color:'var(--gray-400)', marginTop:4 }}>{fmtDate(ticketDetalhe.criado_em)}</div>
            </div>
            <span className={`status-badge ${st.cls}`}>{st.label}</span>
          </div>
          <p style={{ fontSize:14, color:'var(--gray-700)', lineHeight:1.6, margin:'0 0 16px' }}>{ticketDetalhe.descricao}</p>
          <div style={{ borderTop:'1px solid var(--gray-100)', paddingTop:16 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>
              Anexos
            </div>
            <AnexosPanel solicitacaoId={ticketDetalhe.id} onToast={onToast} />
          </div>
        </div>
      </div>
    )
  }

  // ── Formulário de chamado (categoria selecionada) ──────────
  if (view === 'painel') return (
    <div>
      {header}
      <div className="kpi-row" style={{ marginBottom:24 }}>
        <div className="kpi-box kpi-total"><div className="kpi-box-num">{kpis.total}</div><div className="kpi-box-label">Total</div></div>
        <div className="kpi-box kpi-aberto"><div className="kpi-box-num">{kpis.abertos}</div><div className="kpi-box-label">Abertos</div></div>
        <div className="kpi-box kpi-ok"><div className="kpi-box-num">{kpis.concluidos}</div><div className="kpi-box-label">Concluidos</div></div>
      </div>

      {/* Documentos */}
      {(condoInfo?.regulamento_pdf_url || condoInfo?.convencao_pdf_url) && (
        <div className="card" style={{ marginBottom:16 }}>
          <h3 className="section-title">Documentos do condominio</h3>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            {condoInfo.regulamento_pdf_url && (
              <a href={condoInfo.regulamento_pdf_url} target="_blank" rel="noopener noreferrer"
                className="btn btn-ghost btn-sm" style={{ textDecoration:'none', display:'inline-flex', gap:6 }}>
                📄 Regulamento Interno
              </a>
            )}
            {condoInfo.convencao_pdf_url && (
              <a href={condoInfo.convencao_pdf_url} target="_blank" rel="noopener noreferrer"
                className="btn btn-ghost btn-sm" style={{ textDecoration:'none', display:'inline-flex', gap:6 }}>
                📋 Convencao
              </a>
            )}
          </div>
        </div>
      )}

      {/* Documentos */}
      <div className="section-group">
        <div className="section-group-title">Documentos</div>
        <div className="icon-grid">
          <button className="icon-btn" onClick={()=>setSubTela('regulamento')}>
            <div className="icon-btn-icon" style={{ background:'#e0edff', color:'#1a47a0' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            </div>
            <span className="icon-btn-label" style={{ fontSize:11 }}>Regulamento Interno</span>
          </button>
          <button className="icon-btn" onClick={()=>setSubTela('convencao')}>
            <div className="icon-btn-icon" style={{ background:'#e8f3f0', color:'#1a6e5c' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>
            </div>
            <span className="icon-btn-label" style={{ fontSize:11 }}>Convenção</span>
          </button>
        </div>
      </div>

      {/* Últimos chamados */}
      <div className="card">
        <h3 className="section-title">Ultimas solicitacoes</h3>
        {tickets.length === 0
          ? <div className="empty-state">Voce ainda nao tem solicitacoes abertas.</div>
          : tickets.slice(0,6).map(t => <TicketRow key={t.id} ticket={t} onClick={()=>setTicketDetalhe(t)} />)
        }
      </div>
    </div>
  )

  // ── VIEW: NOVO CHAMADO (grade de categorias) ───────────────
  if (view === 'novo-chamado') {
    const PRIO = [
      { v:'baixa',   l:'Baixa',   c:'#3b82f6', bg:'#dbeafe', i:'🔵' },
      { v:'media',   l:'Média',   c:'#f59e0b', bg:'#fef3c7', i:'🟡' },
      { v:'alta',    l:'Alta',    c:'#f97316', bg:'#ffedd5', i:'🟠' },
      { v:'urgente', l:'Urgente', c:'#dc2626', bg:'#fee2e2', i:'🔴' },
    ]

    // Sucesso
    if (ticketCriado) return (
      <Modal open onClose={()=>{ setTicketCriado(null); setCatSel(null); setSubCatSel(null); setSubcategorias([]); setDescricao(''); onNavigate?.('painel') }} title="Chamado registrado" size="md">
        <div style={{ textAlign:'center', padding:'20px 4px' }}>
          <div style={{ fontSize:48, marginBottom:16 }}>✅</div>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:700, color:'var(--navy)', margin:'0 0 8px' }}>
            Chamado registrado!
          </h2>
          <p style={{ color:'var(--gray-500)', fontSize:14, margin:'0 0 8px' }}>
            {catSel?.nome || 'Solicitação'}{(subCatSel && subCatSel !== 'geral') ? ` › ${subCatSel.nome}` : ''}
          </p>
          <p style={{ color:'var(--gray-400)', fontSize:13, margin:'0 0 24px' }}>
            Protocolo <b style={{ fontFamily:'var(--font-mono)' }}>#{ticketCriado.id.slice(-6).toUpperCase()}</b>
          </p>
          {anonimo && <div style={{ padding:'8px 16px', background:'#f5f3ff', borderRadius:'var(--r-md)', fontSize:13, color:'#6d28d9', marginBottom:16 }}>🔒 Chamado enviado anonimamente</div>}
          <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
            <button className="btn" style={{ background:'var(--gray-100)', color:'var(--gray-600)', border:'none' }} onClick={()=>{ setTicketCriado(null); setCatSel(null); setSubCatSel(null); setSubcategorias([]); setDescricao(''); onNavigate?.('painel') }}>
              Voltar ao início
            </button>
            <button className="btn btn-primary" onClick={()=>{ setTicketCriado(null); setCatSel(null); setSubCatSel(null); setSubcategorias([]); setDescricao('') }}>
              Novo chamado
            </button>
          </div>
        </div>
      </Modal>
    )

    // Formato revelado dentro de um Modal (janela sobreposta)
    return (
      <Modal open onClose={()=>onNavigate?.('painel')} title="Nova solicitação" size="lg">
        <p style={{ fontSize:13, color:'var(--gray-400)', margin:'0 0 20px' }}>Selecione o tipo de chamado</p>

        {/* ETAPA 1 — Categoria */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>Categoria</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px, 1fr))', gap:10 }}>
            {categorias.map(cat => (
              <div key={cat.id} className={`cat-card${catSel?.id===cat.id?' selected':''}`} onClick={async ()=>{
                setCatSel(cat); setSubCatSel(null); setTicketCriado(null)
                const { data:subs } = await supabase.from('subcategorias_sistema')
                  .select('*').eq('categoria_id', cat.id).eq('ativo', true).order('ordem')
                setSubcategorias(subs||[])
              }}>
                <div className="cat-card-icon">{cat.icone}</div>
                <div className="cat-card-nome">{cat.nome}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ETAPA 2 — Subcategoria (aparece após escolher categoria, se houver) */}
        {catSel && subcategorias.length > 0 && (
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>Subcategoria</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px, 1fr))', gap:10 }}>
              {subcategorias.map(s => (
                <div key={s.id} className={`cat-card${subCatSel?.id===s.id?' selected':''}`} onClick={()=>setSubCatSel(s)}>
                  <div className="cat-card-icon">{s.icone}</div>
                  <div className="cat-card-nome">{s.nome}</div>
                </div>
              ))}
              <div className={`cat-card${subCatSel==='geral'?' selected':''}`} onClick={()=>setSubCatSel('geral')}
                style={{ border:'1.5px dashed var(--gray-300)' }}>
                <div className="cat-card-icon">📝</div>
                <div className="cat-card-nome" style={{ color:'var(--gray-400)' }}>Outro / Geral</div>
              </div>
            </div>
          </div>
        )}

        {/* ETAPA 3 — Formulário (aparece após categoria e, se houver, subcategoria) */}
        {catSel && (subcategorias.length === 0 || subCatSel) && (
          <div className="card">
            <div className="field">
              <label>Descreva o problema *</label>
              <textarea className="input" rows={5} value={descricao} onChange={e=>setDescricao(e.target.value)}
                placeholder="Quanto mais detalhes, mais rápida a resolução..."/>
            </div>

            {/* Prioridade */}
            <div className="field">
              <label>Prioridade</label>
              <div className="chip-row">
                {PRIO.map(p=>(
                  <button key={p.v} onClick={()=>setPrioridade(p.v)}
                    style={{ padding:'7px 14px', borderRadius:'var(--r-full)', fontSize:12, fontWeight:700,
                      cursor:'pointer', transition:'all .15s',
                      border:`2px solid ${prioridade===p.v?p.c:'var(--gray-200)'}`,
                      background:prioridade===p.v?p.bg:'#fff',
                      color:prioridade===p.v?p.c:'var(--gray-500)' }}>
                    {p.i} {p.l}
                  </button>
                ))}
              </div>
            </div>

            {/* Anonimato (só em Reclamações e Ocorrências) */}
            {['Reclamações','Ocorrências / Incidentes'].includes(catSel?.nome) && (
              <div style={{ padding:'14px', background:anonimo?'#f5f3ff':'var(--gray-50)',
                border:`1.5px solid ${anonimo?'#8b5cf6':'var(--gray-200)'}`,
                borderRadius:'var(--r-md)', marginBottom:16, cursor:'pointer' }}
                onClick={()=>setAnonimo(!anonimo)}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <input type="checkbox" checked={anonimo} onChange={()=>{}} style={{ width:16, height:16, cursor:'pointer' }}/>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:anonimo?'#6d28d9':'var(--gray-700)' }}>
                      🔒 Enviar anonimamente
                    </div>
                    <div style={{ fontSize:12, color:'var(--gray-400)', marginTop:2 }}>
                      Seu nome não será revelado. O síndico verá apenas o conteúdo.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Anexos */}
            <div className="field">
              <label>Anexos (opcional)</label>
              <input type="file" multiple onChange={e=>{
                const novos = Array.from(e.target.files||[]).filter(f=>f.size<=MAX_BYTES)
                const grandes = Array.from(e.target.files||[]).filter(f=>f.size>MAX_BYTES)
                if (grandes.length) onToast(`Ignorados (acima de 10MB): ${grandes.map(f=>f.name).join(', ')}`)
                setArquivosSel(a=>[...a,...novos].slice(0,5))
                e.target.value = ''
              }} style={{ fontSize:13, color:'var(--gray-600)' }}/>
              <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:4 }}>
                Fotos, vídeos, PDF, documentos — até 5 arquivos, 10MB cada.
              </div>
              {arquivosSel.length > 0 && (
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:8 }}>
                  {arquivosSel.map((f,i)=>(
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:4, background:'var(--gray-100)',
                      padding:'4px 10px', borderRadius:'var(--r-full)', fontSize:11 }}>
                      📎 {f.name.slice(0,20)}
                      <button onClick={()=>setArquivosSel(a=>a.filter((_,j)=>j!==i))}
                        style={{ background:'none', border:'none', cursor:'pointer', color:'var(--rust)', fontSize:14, lineHeight:1 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <button className="btn" onClick={()=>{ setDescricao(''); setArquivosSel([]); setPrioridade('media'); setAnonimo(false) }}
                disabled={loading}
                style={{ flexShrink:0, fontSize:15, padding:'14px 18px', background:'var(--gray-100)', color:'var(--gray-600)', border:'none' }}>
                Limpar
              </button>
              <button className="btn btn-primary" onClick={enviarNovo}
                disabled={loading || !descricao.trim()} style={{ flex:1, fontSize:15, padding:'14px' }}>
                {loading ? 'Enviando...' : '📨 Enviar chamado'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    )
  }

  // ── VIEW: MEUS CHAMADOS ────────────────────────────────────
  if (view === 'meus-chamados') {
    const abertos = tickets.filter(t => t.status !== 'concluido')
    return (
      <div>
        {header}
        <h2 style={{ fontFamily:'var(--font-display)', fontSize:18, fontWeight:700, color:'var(--navy)', margin:'0 0 16px' }}>
          Chamados em aberto
        </h2>
        {abertos.length === 0
          ? <div className="empty-state">Nenhum chamado em aberto.</div>
          : abertos.map(t => <TicketRow key={t.id} ticket={t} onClick={()=>setTicketDetalhe(t)} />)
        }
      </div>
    )
  }

  // ── VIEW: HISTÓRICO ────────────────────────────────────────
  if (view === 'historico') return (
    <div>
      {header}
      <h2 style={{ fontFamily:'var(--font-display)', fontSize:18, fontWeight:700, color:'var(--navy)', margin:'0 0 16px' }}>
        Historico completo
      </h2>
      {tickets.length === 0
        ? <div className="empty-state">Nenhuma solicitacao registrada.</div>
        : tickets.map(t => <TicketRow key={t.id} ticket={t} onClick={()=>setTicketDetalhe(t)} />)
      }
    </div>
  )

  return null
}
