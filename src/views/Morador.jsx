import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { ticketNumber, fmtDate, STATUS_LABEL, statusClass } from '../lib/constants'
import TicketCard from '../components/TicketCard'
import AnexosPanel from '../components/AnexosPanel'

// ── Ícones de categoria ──────────────────────────────────────
const CAT_ICONS = {
  'Manutencao':       { bg:'#fff3dc', color:'#8a5a00', svg:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg> },
  'Reclamacao':       { bg:'#fdecea', color:'#c0392b', svg:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
  'Elevador':         { bg:'#e0edff', color:'#1a47a0', svg:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M9 9l3-3 3 3M9 15l3 3 3-3"/></svg> },
  'Limpeza':          { bg:'#e8eeff', color:'#2843ad', svg:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M9 22V12h6v10"/></svg> },
  'Portaria':         { bg:'#ede8f9', color:'#5b21b6', svg:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><circle cx="16" cy="12" r="1.5"/></svg> },
  'Interfone/Antena': { bg:'#fff3dc', color:'#8a5a00', svg:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0M12 20h.01"/></svg> },
  'Outros':           { bg:'#f1f0ee', color:'#6b6860', svg:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg> },
}

const EXTRA_ICONS = {
  denuncia:      { bg:'#fdecea', color:'#c0392b', svg:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
  sugestao:      { bg:'#e8eeff', color:'#2843ad', svg:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg> },
  regulamento:   { bg:'#e0edff', color:'#1a47a0', svg:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> },
  convencao:     { bg:'#e8f3f0', color:'#1a6e5c', svg:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg> },
  meusChamados:  { bg:'#ede8f9', color:'#5b21b6', svg:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 9h8M8 13h5"/></svg> },
  historico:     { bg:'#f1f0ee', color:'#6b6860', svg:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> },
}

const CATEGORIAS = ['Manutencao','Reclamacao','Elevador','Limpeza','Portaria','Interfone/Antena','Outros']
// Map para nome exibição
const CAT_LABEL = {
  'Manutencao':'Manutenção','Reclamacao':'Reclamação','Elevador':'Elevador',
  'Limpeza':'Limpeza','Portaria':'Portaria','Interfone/Antena':'Interfone/Antena','Outros':'Outros'
}

function IconBtn({ icon, label, onClick, badge }) {
  return (
    <button className="icon-btn" onClick={onClick} style={{ position:'relative' }}>
      {badge > 0 && <span style={{ position:'absolute', top:8, right:8, background:'var(--rust)',
        color:'#fff', borderRadius:99, fontSize:10, fontWeight:700, minWidth:18, height:18,
        display:'flex', alignItems:'center', justifyContent:'center', padding:'0 4px' }}>{badge}</span>}
      <div className="icon-btn-icon" style={{ background:icon.bg, color:icon.color }}>{icon.svg}</div>
      <span className="icon-btn-label" style={{ fontSize:11 }}>{label}</span>
    </button>
  )
}

function BackBtn({ onClick }) {
  return (
    <button onClick={onClick} style={{ background:'var(--gray-100)', border:'none',
      borderRadius:'var(--r-md)', padding:'8px 14px', fontSize:13, fontWeight:600,
      color:'var(--gray-600)', cursor:'pointer', marginBottom:20, display:'inline-flex', alignItems:'center', gap:6 }}>
      ← Voltar
    </button>
  )
}

export default function Morador({ onToast }) {
  const { perfil, session } = useAuth()
  const [screen, setScreen] = useState('home') // home | nova-form | meus | historico | denuncia | sugestao | regulamento | convencao
  const [catSel, setCatSel] = useState(null)
  const [descricao, setDescricao] = useState('')
  const [loading, setLoading] = useState(false)
  const [ticketCriado, setTicketCriado] = useState(null) // ticket após criação para anexos
  const [tickets, setTickets] = useState([])
  const [condoInfo, setCondoInfo] = useState(null)
  // Denúncia/Sugestão
  const [extraDescricao, setExtraDescricao] = useState('')
  const [extraAnonimo, setExtraAnonimo] = useState(false)

  const carregar = async () => {
    const [{ data: t }, { data: c }] = await Promise.all([
      supabase.from('solicitacoes').select('*').eq('autor_id', session.user.id).order('criado_em', { ascending:false }),
      supabase.from('condominios').select('id,nome,regulamento_pdf_url,convencao_pdf_url').eq('id', perfil.condominio_id).single(),
    ])
    if (t) setTickets(t)
    if (c) setCondoInfo(c)
  }

  useEffect(() => { carregar() }, [])

  const kpis = {
    total: tickets.length,
    abertos: tickets.filter(t => t.status !== 'concluido').length,
    concluidos: tickets.filter(t => t.status === 'concluido').length,
  }

  const enviarChamado = async () => {
    if (!descricao.trim()) { onToast('Escreva a descricao do chamado.'); return }
    setLoading(true)
    const { data, error } = await supabase.from('solicitacoes').insert({
      condominio_id: perfil.condominio_id,
      autor_id: session.user.id,
      categoria: CAT_LABEL[catSel] || catSel,
      descricao: descricao.trim(),
      origem: 'Portal do morador',
      nome_solicitante: perfil.nome,
      bloco: perfil.bloco,
      apartamento: perfil.apartamento,
    }).select().single()
    setLoading(false)
    if (error) { onToast('Erro: ' + error.message); return }
    setTicketCriado(data)
    setDescricao('')
    await carregar()
  }

  const enviarExtra = async (tipo) => {
    if (!extraDescricao.trim()) { onToast('Escreva sua mensagem.'); return }
    setLoading(true)
    const { error } = await supabase.from('solicitacoes').insert({
      condominio_id: perfil.condominio_id,
      autor_id: session.user.id,
      categoria: tipo === 'denuncia' ? 'Reclamacao' : 'Outros',
      categoria_personalizada: tipo === 'denuncia' ? 'Denuncia' : 'Sugestao',
      descricao: (extraAnonimo ? '[ANONIMO] ' : '') + extraDescricao.trim(),
      origem: 'Portal do morador',
      nome_solicitante: extraAnonimo ? 'Anonimo' : perfil.nome,
    })
    setLoading(false)
    if (error) { onToast('Erro: ' + error.message); return }
    onToast('Enviado com sucesso!')
    setExtraDescricao(''); setExtraAnonimo(false)
    setScreen('home'); await carregar()
  }

  const local = [perfil?.bloco ? `Bloco ${perfil.bloco}` : '', perfil?.apartamento ? `Ap. ${perfil.apartamento}` : ''].filter(Boolean).join(', ')

  // ── TELA: HOME ──────────────────────────────────────────────
  if (screen === 'home') return (
    <div>
      <div className="condo-header">
        <div className="condo-header-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
            <path d="M4 21V8L12 3l8 5v13"/><path d="M9 21v-6h6v6"/>
          </svg>
        </div>
        <div>
          <div className="condo-header-name">{condoInfo?.nome || 'Meu Condominio'}</div>
          <div className="condo-header-sub">{perfil?.nome}{local ? ` · ${local}` : ''}</div>
        </div>
      </div>

      <div className="kpi-row">
        <div className="kpi-box kpi-total"><div className="kpi-box-num">{kpis.total}</div><div className="kpi-box-label">Total</div></div>
        <div className="kpi-box kpi-aberto"><div className="kpi-box-num">{kpis.abertos}</div><div className="kpi-box-label">Abertos</div></div>
        <div className="kpi-box kpi-ok"><div className="kpi-box-num">{kpis.concluidos}</div><div className="kpi-box-label">Concluidos</div></div>
      </div>

      {/* Solicitações */}
      <div className="section-group">
        <div className="section-group-title">Abrir solicitacao</div>
        <div className="icon-grid">
          {CATEGORIAS.map(cat => (
            <IconBtn key={cat} icon={CAT_ICONS[cat]} label={CAT_LABEL[cat]}
              onClick={() => { setCatSel(cat); setTicketCriado(null); setScreen('nova-form') }} />
          ))}
        </div>
      </div>

      {/* Comunicação */}
      <div className="section-group">
        <div className="section-group-title">Comunicacao</div>
        <div className="icon-grid">
          <IconBtn icon={EXTRA_ICONS.denuncia} label="Denuncia" onClick={() => { setExtraDescricao(''); setScreen('denuncia') }} />
          <IconBtn icon={EXTRA_ICONS.sugestao} label="Sugestoes" onClick={() => { setExtraDescricao(''); setScreen('sugestao') }} />
        </div>
      </div>

      {/* Documentos */}
      <div className="section-group">
        <div className="section-group-title">Documentos</div>
        <div className="icon-grid">
          <IconBtn icon={EXTRA_ICONS.regulamento} label="Regulamento Interno" onClick={() => setScreen('regulamento')} />
          <IconBtn icon={EXTRA_ICONS.convencao} label="Convencao" onClick={() => setScreen('convencao')} />
        </div>
      </div>

      {/* Meus chamados */}
      <div className="section-group">
        <div className="section-group-title">Meus chamados</div>
        <div className="icon-grid">
          <IconBtn icon={EXTRA_ICONS.meusChamados} label="Em aberto" badge={kpis.abertos}
            onClick={() => setScreen('meus')} />
          <IconBtn icon={EXTRA_ICONS.historico} label="Historico" onClick={() => setScreen('historico')} />
        </div>
      </div>
    </div>
  )

  // ── TELA: NOVA SOLICITAÇÃO ───────────────────────────────────
  if (screen === 'nova-form') {
    const icon = CAT_ICONS[catSel]
    return (
      <div>
        <BackBtn onClick={() => { setScreen('home'); setTicketCriado(null) }} />

        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:24 }}>
          <div className="icon-btn-icon" style={{ background:icon?.bg, color:icon?.color, width:52, height:52, borderRadius:'var(--r-lg)' }}>
            {icon?.svg}
          </div>
          <div>
            <h2 style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:800, color:'var(--navy)', margin:0 }}>
              {CAT_LABEL[catSel]}
            </h2>
            <p style={{ fontSize:13, color:'var(--gray-400)', margin:'4px 0 0' }}>Descreva sua solicitacao</p>
          </div>
        </div>

        {!ticketCriado ? (
          <div className="card">
            <div className="field">
              <label>Descricao *</label>
              <textarea className="input" rows={5}
                placeholder="Descreva com detalhes: local, horario, o que aconteceu..."
                value={descricao} onChange={e => setDescricao(e.target.value)} />
            </div>

            {/* Aviso de anexo — disponível após envio */}
            <div style={{ padding:'12px 14px', background:'#e8eeff', borderRadius:'var(--r-md)',
              fontSize:13, color:'#2843ad', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.44 11.05L12.25 20.24a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
              </svg>
              Apos enviar voce podera anexar fotos e arquivos (max. 10MB cada).
            </div>

            <button className="btn btn-primary btn-block" style={{ fontSize:15, padding:'13px' }}
              onClick={enviarChamado} disabled={loading || !descricao.trim()}>
              {loading ? 'Enviando...' : 'Enviar solicitacao'}
            </button>
          </div>
        ) : (
          <div>
            {/* Confirmação */}
            <div className="card" style={{ textAlign:'center', marginBottom:16 }}>
              <div style={{ fontSize:36, marginBottom:8 }}>✅</div>
              <h3 style={{ fontFamily:'var(--font-display)', color:'var(--navy)', margin:'0 0 6px' }}>Solicitacao enviada!</h3>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:24, fontWeight:700, color:'var(--emerald)',
                background:'var(--mint)', border:'1.5px dashed var(--emerald)', borderRadius:'var(--r-md)',
                padding:'10px 24px', display:'inline-block', letterSpacing:2, margin:'8px 0' }}>
                #{ticketNumber(ticketCriado.id)}
              </div>
              <p style={{ fontSize:13, color:'var(--gray-400)', margin:'8px 0 0' }}>
                Guarde o numero para acompanhamento.
              </p>
            </div>

            {/* Anexar arquivos APÓS criação */}
            <div className="card">
              <h3 className="section-title" style={{ display:'flex', alignItems:'center', gap:8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--emerald)" strokeWidth="2">
                  <path d="M21.44 11.05L12.25 20.24a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                </svg>
                Adicionar fotos ou arquivos
              </h3>
              <AnexosPanel solicitacaoId={ticketCriado.id} onToast={onToast} />
              <div style={{ marginTop:16, display:'flex', gap:8 }}>
                <button className="btn btn-primary" onClick={() => { setTicketCriado(null); setScreen('home') }}>
                  Concluir
                </button>
                <button className="btn btn-ghost" onClick={() => { setTicketCriado(null); setCatSel(null); setScreen('home') }}>
                  Ir para inicio
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── TELA: MEUS CHAMADOS ──────────────────────────────────────
  if (screen === 'meus' || screen === 'historico') {
    const lista = screen === 'meus'
      ? tickets.filter(t => t.status !== 'concluido')
      : tickets
    return (
      <div>
        <BackBtn onClick={() => setScreen('home')} />
        <h2 style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:800, color:'var(--navy)', margin:'0 0 20px' }}>
          {screen === 'meus' ? 'Chamados em aberto' : 'Historico completo'}
        </h2>
        {lista.length === 0
          ? <div className="empty-state">{screen === 'meus' ? 'Nenhum chamado em aberto.' : 'Nenhum chamado registrado.'}</div>
          : lista.map(t => <TicketCard key={t.id} ticket={t} onUpdate={carregar} onToast={onToast} />)
        }
      </div>
    )
  }

  // ── TELA: DENUNCIA ──────────────────────────────────────────
  if (screen === 'denuncia') return (
    <div>
      <BackBtn onClick={() => setScreen('home')} />
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:24 }}>
        <div className="icon-btn-icon" style={{ background:'#fdecea', color:'#c0392b', width:52, height:52, borderRadius:'var(--r-lg)' }}>
          {EXTRA_ICONS.denuncia.svg}
        </div>
        <div>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:800, color:'var(--navy)', margin:0 }}>Denuncia</h2>
          <p style={{ fontSize:13, color:'var(--gray-400)', margin:'4px 0 0' }}>Reporte algo irregular no condominio</p>
        </div>
      </div>
      <div className="card">
        <div style={{ padding:'12px 14px', background:'#fdecea', borderRadius:'var(--r-md)', marginBottom:18, fontSize:13, color:'#c0392b' }}>
          Sua denuncia sera enviada a equipe do condominio de forma sigilosa.
        </div>
        <div className="field">
          <label>Descricao da denuncia *</label>
          <textarea className="input" rows={5}
            placeholder="Descreva o que esta acontecendo, onde e quando..."
            value={extraDescricao} onChange={e => setExtraDescricao(e.target.value)} />
        </div>
        <label style={{ display:'flex', alignItems:'center', gap:10, fontSize:14, marginBottom:18, cursor:'pointer' }}>
          <input type="checkbox" checked={extraAnonimo} onChange={e => setExtraAnonimo(e.target.checked)} />
          Enviar de forma anonima
        </label>
        <button className="btn btn-primary btn-block" onClick={() => enviarExtra('denuncia')} disabled={loading || !extraDescricao.trim()}>
          {loading ? 'Enviando...' : 'Enviar denuncia'}
        </button>
      </div>
    </div>
  )

  // ── TELA: SUGESTÃO ──────────────────────────────────────────
  if (screen === 'sugestao') return (
    <div>
      <BackBtn onClick={() => setScreen('home')} />
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:24 }}>
        <div className="icon-btn-icon" style={{ background:'#e8eeff', color:'#2843ad', width:52, height:52, borderRadius:'var(--r-lg)' }}>
          {EXTRA_ICONS.sugestao.svg}
        </div>
        <div>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:800, color:'var(--navy)', margin:0 }}>Sugestao</h2>
          <p style={{ fontSize:13, color:'var(--gray-400)', margin:'4px 0 0' }}>Compartilhe suas ideias com a gestao</p>
        </div>
      </div>
      <div className="card">
        <div className="field">
          <label>Sua sugestao *</label>
          <textarea className="input" rows={5}
            placeholder="Compartilhe sua ideia para melhorar o condominio..."
            value={extraDescricao} onChange={e => setExtraDescricao(e.target.value)} />
        </div>
        <label style={{ display:'flex', alignItems:'center', gap:10, fontSize:14, marginBottom:18, cursor:'pointer' }}>
          <input type="checkbox" checked={extraAnonimo} onChange={e => setExtraAnonimo(e.target.checked)} />
          Enviar de forma anonima
        </label>
        <button className="btn btn-primary btn-block" onClick={() => enviarExtra('sugestao')} disabled={loading || !extraDescricao.trim()}>
          {loading ? 'Enviando...' : 'Enviar sugestao'}
        </button>
      </div>
    </div>
  )

  // ── TELA: REGULAMENTO INTERNO ────────────────────────────────
  if (screen === 'regulamento') return (
    <div>
      <BackBtn onClick={() => setScreen('home')} />
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:24 }}>
        <div className="icon-btn-icon" style={{ background:'#e0edff', color:'#1a47a0', width:52, height:52, borderRadius:'var(--r-lg)' }}>
          {EXTRA_ICONS.regulamento.svg}
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
              O regulamento interno ainda nao foi disponibilizado.<br/>
              Entre em contato com a administracao.
            </p>
          </>
        )}
      </div>
    </div>
  )

  // ── TELA: CONVENÇÃO ─────────────────────────────────────────
  if (screen === 'convencao') return (
    <div>
      <BackBtn onClick={() => setScreen('home')} />
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:24 }}>
        <div className="icon-btn-icon" style={{ background:'#e8f3f0', color:'#1a6e5c', width:52, height:52, borderRadius:'var(--r-lg)' }}>
          {EXTRA_ICONS.convencao.svg}
        </div>
        <h2 style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:800, color:'var(--navy)', margin:0 }}>
          Convencao do Condominio
        </h2>
      </div>
      <div className="card" style={{ textAlign:'center', padding:'40px 28px' }}>
        {condoInfo?.convencao_pdf_url ? (
          <>
            <div style={{ fontSize:48, marginBottom:12 }}>📋</div>
            <h3 style={{ fontFamily:'var(--font-display)', color:'var(--navy)', margin:'0 0 8px' }}>Convencao do Condominio</h3>
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
              A convencao ainda nao foi disponibilizada.<br/>
              Entre em contato com a administracao.
            </p>
          </>
        )}
      </div>
    </div>
  )

  return null
}
