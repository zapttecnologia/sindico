import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { ticketNumber, fmtDate, STATUS_LABEL, statusClass } from '../lib/constants'
import AnexosPanel from '../components/AnexosPanel'

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
  'Limpeza':'Limpeza','Portaria':'Portaria','Interfone/Antena':'Interfone/Antena',
  'Outros':'Outros','Denuncia':'Denúncia','Sugestao':'Sugestões',
}
const CATEGORIAS_CHAMADO = ['Manutencao','Reclamacao','Elevador','Limpeza','Portaria','Interfone/Antena','Outros']
const CATEGORIAS_EXTRA   = ['Denuncia','Sugestao']

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

export default function Morador({ view, onToast }) {
  const { perfil, session } = useAuth()
  const [tickets, setTickets] = useState([])
  const [condoInfo, setCondoInfo] = useState(null)
  const [catSel, setCatSel] = useState(null)
  const [descricao, setDescricao] = useState('')
  const [extraAnonimo, setExtraAnonimo] = useState(false)
  const [loading, setLoading] = useState(false)
  const [ticketCriado, setTicketCriado] = useState(null)
  const [arquivosSel, setArquivosSel] = useState([])
  const [ticketDetalhe, setTicketDetalhe] = useState(null)
  const MAX_BYTES = 10 * 1024 * 1024

  const carregar = async () => {
    const [{ data:t }, { data:c }] = await Promise.all([
      supabase.from('solicitacoes').select('*').eq('autor_id', session.user.id).order('criado_em', { ascending:false }),
      supabase.from('condominios').select('id,nome,regulamento_pdf_url,convencao_pdf_url').eq('id', perfil.condominio_id).single(),
    ])
    if (t) setTickets(t)
    if (c) setCondoInfo(c)
  }

  useEffect(() => { carregar() }, [])

  // Resetar seleção ao mudar de view
  useEffect(() => { setCatSel(null); setTicketCriado(null); setDescricao(''); setArquivosSel([]) }, [view])

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

  const enviar = async (tipo) => {
    if (!descricao.trim()) { onToast('Escreva a descricao.'); return }
    setLoading(true)
    const isExtra = ['Denuncia','Sugestao'].includes(tipo)
    const { data, error } = await supabase.from('solicitacoes').insert({
      condominio_id: perfil.condominio_id,
      autor_id: session.user.id,
      categoria: isExtra ? (tipo==='Denuncia'?'Reclamacao':'Outros') : (CAT_LABEL[tipo]||tipo),
      categoria_personalizada: isExtra ? tipo : null,
      descricao: (isExtra && extraAnonimo ? '[ANONIMO] ' : '') + descricao.trim(),
      origem: 'Portal do morador',
      nome_solicitante: isExtra && extraAnonimo ? 'Anonimo' : perfil.nome,
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

  // ── Detalhe do chamado ─────────────────────────────────────
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
  if ((view === 'novo-chamado') && catSel) {
    const icon = CAT_ICONS[catSel]
    const isExtra = ['Denuncia','Sugestao'].includes(catSel)
    return (
      <div>
        <button onClick={()=>{setCatSel(null);setTicketCriado(null)}} style={{ background:'var(--gray-100)', border:'none',
          borderRadius:'var(--r-md)', padding:'8px 14px', fontSize:13, fontWeight:600,
          color:'var(--gray-600)', cursor:'pointer', marginBottom:20 }}>← Voltar</button>

        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:24 }}>
          <div className="icon-btn-icon" style={{ background:icon?.bg, color:icon?.color, width:52, height:52, borderRadius:'var(--r-lg)', flexShrink:0 }}>
            {icon?.svg}
          </div>
          <div>
            <h2 style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:800, color:'var(--navy)', margin:0 }}>
              {CAT_LABEL[catSel]}
            </h2>
            <p style={{ fontSize:13, color:'var(--gray-400)', margin:'4px 0 0' }}>
              {isExtra ? 'Sua mensagem' : 'Abrir nova solicitacao'}
            </p>
          </div>
        </div>

        {!ticketCriado ? (
          <div className="card">
            {isExtra && (
              <div style={{ padding:'10px 14px', background:'#fdecea', borderRadius:'var(--r-md)', marginBottom:16, fontSize:13, color:'#c0392b' }}>
                Sua mensagem sera enviada de forma sigilosa a equipe.
              </div>
            )}
            <div className="field">
              <label>Descricao *</label>
              <textarea className="input" rows={5} placeholder="Descreva com detalhes..."
                value={descricao} onChange={e=>setDescricao(e.target.value)} />
            </div>
            {isExtra && (
              <label style={{ display:'flex', alignItems:'center', gap:10, fontSize:14, marginBottom:16, cursor:'pointer' }}>
                <input type="checkbox" checked={extraAnonimo} onChange={e=>setExtraAnonimo(e.target.checked)} />
                Enviar de forma anonima
              </label>
            )}
            {/* Anexar arquivos */}
            <div className="field">
              <label>Fotos ou arquivos (opcional, max. 10MB cada)</label>
              {arquivosSel.length > 0 && (
                <div style={{ marginBottom:8 }}>
                  {arquivosSel.map((f,i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px',
                      background:'var(--mint)', borderRadius:'var(--r-md)', marginBottom:4, fontSize:13 }}>
                      <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.name}</span>
                      <span style={{ fontSize:11, color:'var(--gray-400)', flexShrink:0 }}>{(f.size/1024/1024).toFixed(1)}MB</span>
                      <button onClick={()=>setArquivosSel(p=>p.filter((_,j)=>j!==i))}
                        style={{ background:'none', border:'none', color:'var(--rust)', cursor:'pointer', fontSize:16, padding:0 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
              <label style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                padding:'10px', background:'#fff', border:'1.5px dashed var(--gray-300)',
                borderRadius:'var(--r-md)', fontSize:13, fontWeight:600, color:'var(--gray-500)', cursor:'pointer' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                {arquivosSel.length > 0 ? `${arquivosSel.length} arquivo(s) — adicionar mais` : 'Clique para anexar'}
                <input type="file" multiple style={{ display:'none' }} onChange={handleSelecionarArquivos} />
              </label>
            </div>
            <button className="btn btn-primary btn-block" style={{ fontSize:15, padding:'13px' }}
              onClick={() => enviar(catSel)} disabled={loading||!descricao.trim()}>
              {loading ? 'Enviando...' : `Enviar${arquivosSel.length>0?` + ${arquivosSel.length} arquivo(s)`:''}`}
            </button>
          </div>
        ) : (
          <div className="card" style={{ textAlign:'center' }}>
            <div style={{ fontSize:40, marginBottom:8 }}>✅</div>
            <h3 style={{ fontFamily:'var(--font-display)', color:'var(--navy)', margin:'0 0 8px' }}>Enviado com sucesso!</h3>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:22, fontWeight:700, color:'var(--emerald)',
              background:'var(--mint)', border:'1.5px dashed var(--emerald)', borderRadius:'var(--r-md)',
              padding:'8px 20px', display:'inline-block', letterSpacing:2, margin:'8px 0 20px' }}>
              #{ticketNumber(ticketCriado.id)}
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
              <button className="btn btn-ghost" onClick={()=>{setCatSel(null);setTicketCriado(null)}}>
                Nova solicitacao
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Header do condomínio (fixo em todas as views) ──────────
  const header = (
    <div className="condo-header" style={{ marginBottom:24 }}>
      <div className="condo-header-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
          <path d="M4 21V8L12 3l8 5v13"/><path d="M9 21v-6h6v6"/>
        </svg>
      </div>
      <div>
        <div className="condo-header-name">{condoInfo?.nome||'Meu Condominio'}</div>
        <div className="condo-header-sub">{perfil?.nome}{local?` · ${local}`:''}</div>
      </div>
    </div>
  )

  // ── VIEW: PAINEL ───────────────────────────────────────────
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
  if (view === 'novo-chamado') return (
    <div>
      {header}
      <div className="section-group">
        <div className="section-group-title">Solicitacoes</div>
        <div className="icon-grid">
          {CATEGORIAS_CHAMADO.map(cat => (
            <button key={cat} className="icon-btn" onClick={()=>{setCatSel(cat);setTicketCriado(null);setDescricao('')}}>
              <div className="icon-btn-icon" style={{ background:CAT_ICONS[cat].bg, color:CAT_ICONS[cat].color }}>
                {CAT_ICONS[cat].svg}
              </div>
              <span className="icon-btn-label" style={{ fontSize:11 }}>{CAT_LABEL[cat]}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="section-group">
        <div className="section-group-title">Comunicacao</div>
        <div className="icon-grid">
          {CATEGORIAS_EXTRA.map(cat => (
            <button key={cat} className="icon-btn" onClick={()=>{setCatSel(cat);setTicketCriado(null);setDescricao('')}}>
              <div className="icon-btn-icon" style={{ background:CAT_ICONS[cat].bg, color:CAT_ICONS[cat].color }}>
                {CAT_ICONS[cat].svg}
              </div>
              <span className="icon-btn-label" style={{ fontSize:11 }}>{CAT_LABEL[cat]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )

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
