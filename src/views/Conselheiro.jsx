import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { ticketNumber, fmtDate, STATUS_LABEL, statusClass, APROVACAO_LABEL, aprovClass } from '../lib/constants'
import TicketCard from '../components/TicketCard'

export default function Conselheiro({ view, onToast }) {
  const { perfil, session } = useAuth()
  const [tickets, setTickets] = useState([])
  const [categoriasSistema, setCategoriasSistema] = useState([])
  const [catSel, setCatSel] = useState(null)
  const [descricao, setDescricao] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmNum, setConfirmNum] = useState(null)
  const [ticketVotando, setTicketVotando] = useState(null)
  const [orcamentos, setOrcamentos] = useState([])
  const [votosExistentes, setVotosExistentes] = useState([])
  const [opcaoVoto, setOpcaoVoto] = useState(null)
  const [orcSel, setOrcSel] = useState(null)
  const [obsVoto, setObsVoto] = useState('')
  const [salvandoVoto, setSalvandoVoto] = useState(false)
  const [meuVoto, setMeuVoto] = useState(null)

  useEffect(() => { setCatSel(null); setDescricao(''); setConfirmNum(null) }, [view])

  const carregar = async () => {
    const { data } = await supabase.from('solicitacoes')
      .select('*, condominios(nome)')
      .eq('condominio_id', perfil.condominio_id)
      .order('criado_em', { ascending:false })
    if (data) setTickets(data)
    const { data:cats } = await supabase.from('categorias_sistema')
      .select('nome, icone').eq('ativo', true).order('ordem')
    if (cats) setCategoriasSistema(cats)
  }

  useEffect(() => { carregar() }, [])

  const pendentes = tickets.filter(t => t.aprovacao_status === 'aguardando').length
  const kpis = {
    total: tickets.length,
    abertos: tickets.filter(t => t.status !== 'resolvido' && t.status !== 'cancelado').length,
    pendentes,
    concluidos: tickets.filter(t => t.status === 'resolvido').length,
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
  const abrirVotacao = async (ticket) => {
    setTicketVotando(ticket)
    setOpcaoVoto(null); setOrcSel(null); setObsVoto('')
    const [{ data:orcs }, { data:votos }] = await Promise.all([
      supabase.from('orcamentos').select('*').eq('solicitacao_id', ticket.id).order('numero'),
      supabase.from('votos_conselheiros').select('*').eq('solicitacao_id', ticket.id),
    ])
    // Buscar nomes dos conselheiros separadamente
    const votosComNome = await Promise.all((votos||[]).map(async v => {
      const { data:p } = await supabase.from('perfis').select('nome').eq('id', v.conselheiro_id).maybeSingle()
      return { ...v, perfis: p || { nome: 'Conselheiro' } }
    }))
    setOrcamentos(orcs||[])
    setVotosExistentes(votosComNome)
    const meu = votosComNome.find(v => v.conselheiro_id === session.user.id)
    setMeuVoto(meu||null)
    if (meu) setOpcaoVoto(meu.voto)
  }

  const registrarVoto = async () => {
    if (!opcaoVoto || !ticketVotando) return
    setSalvandoVoto(true)

    const payload = {
      solicitacao_id: ticketVotando.id,
      conselheiro_id: session.user.id,
      voto: opcaoVoto,
      orcamento_id: orcSel || null,
      observacao: obsVoto.trim() || null,
      votado_em: new Date().toISOString(),
    }

    // Tenta upsert primeiro
    let { error } = await supabase.from('votos_conselheiros')
      .upsert(payload, { onConflict: 'solicitacao_id,conselheiro_id' })

    // Se falhar, tenta deletar o voto antigo e inserir novo
    if (error) {
      await supabase.from('votos_conselheiros')
        .delete()
        .eq('solicitacao_id', ticketVotando.id)
        .eq('conselheiro_id', perfil.id)
      const res2 = await supabase.from('votos_conselheiros').insert(payload)
      error = res2.error
    }

    setSalvandoVoto(false)
    if (error) { onToast('Erro ao votar: ' + error.message); return }
    onToast('✅ Voto registrado!')
    await abrirVotacao(ticketVotando)
    await carregar()
  }

  const OPCOES = [
    { v:'deferido',          l:'Deferido',               cor:'#16a34a', bg:'#dcfce7', icon:'✅' },
    { v:'deferido_ressalva', l:'Deferido com ressalva',  cor:'#d97706', bg:'#fef3c7', icon:'⚠️' },
    { v:'indeferido',        l:'Indeferido',             cor:'#dc2626', bg:'#fee2e2', icon:'❌' },
  ]

  if (view === 'aprovacoes') {
    const pendentes = tickets.filter(t => t.aprovacao_status === 'aguardando')

    // Tela de votação aberta
    if (ticketVotando) return (
      <div>
        {header}
        <button onClick={()=>setTicketVotando(null)}
          style={{ background:'var(--gray-100)', border:'none', borderRadius:'var(--r-md)',
            padding:'8px 14px', fontSize:13, fontWeight:600, color:'var(--gray-600)',
            cursor:'pointer', marginBottom:20 }}>← Voltar</button>

        <div className="card">
          {/* Cabeçalho do chamado */}
          <div style={{ marginBottom:16 }}>
            <span style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:'var(--r-full)',
              background:'var(--gray-100)', color:'var(--gray-600)' }}>
              {ticketVotando.categoria}
            </span>
            <h2 style={{ fontFamily:'var(--font-display)', fontSize:18, fontWeight:700, color:'var(--navy)', margin:'10px 0 4px' }}>
              {ticketVotando.condominios?.nome}
            </h2>
            <p style={{ fontSize:13, color:'var(--gray-500)', margin:'0 0 4px' }}>{ticketVotando.descricao}</p>
            <div style={{ fontSize:11, color:'var(--gray-400)' }}>{ticketVotando.nome_solicitante} · {fmtDate(ticketVotando.criado_em)}</div>
          </div>

          {/* Orçamentos */}
          {orcamentos.length > 0 && (
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>
                Orçamentos apresentados
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:10 }}>
                {orcamentos.map(o => (
                  <div key={o.id} onClick={()=>!meuVoto&&setOrcSel(orcSel===o.id?null:o.id)}
                    style={{ padding:'12px 14px', borderRadius:'var(--r-md)',
                      border:`2px solid ${orcSel===o.id?'var(--emerald)':'var(--gray-200)'}`,
                      background:orcSel===o.id?'var(--mint)':'#fff',
                      cursor:meuVoto?'default':'pointer', transition:'all .15s' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-400)', marginBottom:4 }}>Orçamento {o.numero}</div>
                    <div style={{ fontWeight:700, color:'var(--navy)', marginBottom:4 }}>{o.fornecedor}</div>
                    {o.valor && <div style={{ fontSize:15, fontWeight:800, color:'var(--emerald)' }}>R$ {Number(o.valor).toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>}
                    <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:4 }}>
                      {o.tipo==='servico'?'Prestação de serviço':'Produto'}
                      {o.materiais?` · ${o.materiais}`:''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Meu voto */}
          {meuVoto ? (
            <div style={{ padding:'14px 16px', borderRadius:'var(--r-lg)', marginBottom:20,
              background: OPCOES.find(o=>o.v===meuVoto.voto)?.bg,
              border:`2px solid ${OPCOES.find(o=>o.v===meuVoto.voto)?.cor}` }}>
              <div style={{ fontSize:14, fontWeight:700, color:OPCOES.find(o=>o.v===meuVoto.voto)?.cor, marginBottom:4 }}>
                {OPCOES.find(o=>o.v===meuVoto.voto)?.icon} Você votou: {OPCOES.find(o=>o.v===meuVoto.voto)?.l}
              </div>
              {meuVoto.observacao && <div style={{ fontSize:13, color:'var(--gray-600)', fontStyle:'italic' }}>"{meuVoto.observacao}"</div>}
              <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:4 }}>
                {new Date(meuVoto.votado_em).toLocaleString('pt-BR')}
              </div>
            </div>
          ) : (
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:12 }}>
                Registrar meu voto
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:10, marginBottom:14 }}>
                {OPCOES.map(op => (
                  <button key={op.v} onClick={()=>setOpcaoVoto(opcaoVoto===op.v?null:op.v)}
                    style={{ padding:'14px 10px', borderRadius:'var(--r-md)', fontWeight:700, fontSize:13,
                      cursor:'pointer', transition:'all .15s', textAlign:'center',
                      border:`2px solid ${opcaoVoto===op.v?op.cor:'var(--gray-200)'}`,
                      background:opcaoVoto===op.v?op.bg:'#fff',
                      color:opcaoVoto===op.v?op.cor:'var(--gray-500)' }}>
                    <div style={{ fontSize:20, marginBottom:4 }}>{op.icon}</div>
                    {op.l}
                  </button>
                ))}
              </div>
              <div className="field" style={{ marginBottom:14 }}>
                <label>Observação (opcional)</label>
                <textarea className="input" rows={2} value={obsVoto} onChange={e=>setObsVoto(e.target.value)}
                  placeholder="Adicione uma justificativa ou ressalva..."/>
              </div>
              <button className="btn btn-primary btn-block" onClick={registrarVoto}
                disabled={!opcaoVoto||salvandoVoto} style={{ fontSize:15, padding:'13px' }}>
                {salvandoVoto?'Registrando...':`Confirmar: ${OPCOES.find(o=>o.v===opcaoVoto)?.l||'selecione uma opção'}`}
              </button>
            </div>
          )}

          {/* Placar de votos */}
          {votosExistentes.length > 0 && (
            <div style={{ borderTop:'1px solid var(--gray-100)', paddingTop:16 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:12 }}>
                Placar — {votosExistentes.length} voto{votosExistentes.length!==1?'s':''}
              </div>
              {votosExistentes.map((v,i) => {
                const op = OPCOES.find(o=>o.v===v.voto)
                return (
                  <div key={v.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0',
                    borderBottom:i<votosExistentes.length-1?'1px solid var(--gray-100)':'' }}>
                    <div style={{ width:36, height:36, borderRadius:'50%', background:op?.bg,
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>
                      {op?.icon}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14, fontWeight:600, color:'var(--gray-800)' }}>
                        {v.perfis?.nome||'Conselheiro'}
                      </div>
                      <div style={{ fontSize:12, fontWeight:700, color:op?.cor }}>{op?.l}</div>
                      {v.observacao && <div style={{ fontSize:12, color:'var(--gray-400)', fontStyle:'italic' }}>"{v.observacao}"</div>}
                    </div>
                    <div style={{ fontSize:11, color:'var(--gray-400)', textAlign:'right', flexShrink:0 }}>
                      {v.votado_em ? new Date(v.votado_em).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : ''}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )

    // Lista de pendentes
    return (
      <div>
        {header}
        <h2 style={{ fontFamily:'var(--font-display)', fontSize:18, fontWeight:700, color:'var(--navy)', margin:'0 0 16px' }}>
          Votação do conselho
        </h2>
        {pendentes.length === 0
          ? <div className="empty-state">✅ Nenhum chamado aguardando seu voto.</div>
          : pendentes.map(t => (
            <div key={t.id} onClick={()=>abrirVotacao(t)}
              style={{ background:'#fff', border:'1px solid var(--gray-200)', borderLeft:'3px solid var(--amber)',
                borderRadius:'var(--r-lg)', padding:'16px 18px', marginBottom:10, cursor:'pointer',
                transition:'all .15s', boxShadow:'var(--shadow-sm)' }}
              onMouseEnter={e=>{e.currentTarget.style.boxShadow='var(--shadow-md)';e.currentTarget.style.transform='translateY(-1px)'}}
              onMouseLeave={e=>{e.currentTarget.style.boxShadow='var(--shadow-sm)';e.currentTarget.style.transform='translateY(0)'}}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:8 }}>
                <div>
                  <span style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:'var(--r-full)',
                    background:'var(--amber-bg)', color:'#92400e' }}>
                    ⏳ Aguardando voto
                  </span>
                  <div style={{ fontFamily:'var(--font-display)', fontSize:16, fontWeight:700, color:'var(--navy)', margin:'8px 0 4px' }}>
                    {t.condominios?.nome}
                  </div>
                  <div style={{ fontSize:13, color:'var(--gray-500)' }}>{t.categoria} · {t.nome_solicitante}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:12, color:'var(--gray-400)' }}>{fmtDate(t.criado_em)}</div>
                  <div style={{ fontSize:12, color:'var(--blue)', fontWeight:600, marginTop:4 }}>Votar →</div>
                </div>
              </div>
              {t.descricao && (
                <p style={{ fontSize:13, color:'var(--gray-500)', margin:'8px 0 0', lineHeight:1.5,
                  display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                  {t.descricao}
                </p>
              )}
            </div>
          ))
        }
      </div>
    )
  }

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
              {categoriasSistema.map(c=><button key={c.nome} className={`chip${catSel===c.nome?' selected':''}`} onClick={()=>setCatSel(c.nome)}>{c.icone?c.icone+' ':''}{c.nome}</button>)}
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
