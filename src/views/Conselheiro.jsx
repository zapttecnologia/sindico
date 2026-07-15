import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { ticketNumber, fmtDate, STATUS_LABEL, statusClass, APROVACAO_LABEL, aprovClass, PRIORIDADES } from '../lib/constants'
import TicketCard from '../components/TicketCard'

const MAX_BYTES = 10 * 1024 * 1024  // 10MB por arquivo

export default function Conselheiro({ view, onToast }) {
  const { perfil, session } = useAuth()
  const [tickets, setTickets] = useState([])
  const [categoriasSistema, setCategoriasSistema] = useState([])
  const [subcategorias, setSubcategorias] = useState([])   // subcategorias da categoria escolhida
  const [catSel, setCatSel] = useState(null)
  const [subSel, setSubSel] = useState(null)
  const [passo, setPasso] = useState(1)                    // 1=categoria, 2=subcategoria, 3=descrição
  const [descricao, setDescricao] = useState('')
  const [arquivosSel, setArquivosSel] = useState([])
  const [equipeCondo, setEquipeCondo] = useState([])       // síndico + equipe do condomínio
  const [destinoEquipe, setDestinoEquipe] = useState('')   // pessoa da equipe destino (opcional)
  const [paraSindico, setParaSindico] = useState(false)    // checkbox: chamado é para o síndico/equipe
  const [loading, setLoading] = useState(false)
  const [confirmNum, setConfirmNum] = useState(null)
  const [ticketVotando, setTicketVotando] = useState(null)
  const [orcamentos, setOrcamentos] = useState([])
  const [historicoVotacao, setHistoricoVotacao] = useState([])
  const [votosExistentes, setVotosExistentes] = useState([])
  const [opcaoVoto, setOpcaoVoto] = useState(null)
  const [orcSel, setOrcSel] = useState(null)
  const [obsVoto, setObsVoto] = useState('')
  const [salvandoVoto, setSalvandoVoto] = useState(false)
  const [meuVoto, setMeuVoto] = useState(null)
  const [meusVotos, setMeusVotos] = useState([])   // ids de solicitações que EU já votei
  // Filtros da aba Chamados
  const [fBusca, setFBusca] = useState('')
  const [fCategoria, setFCategoria] = useState('todas')
  const [fStatus, setFStatus] = useState('todos')
  const [fPrioridade, setFPrioridade] = useState('todas')
  // Filtros da aba Aprovações
  const [aBusca, setABusca] = useState('')
  const [aStatus, setAStatus] = useState('aguardando')  // aguardando | aprovado | rejeitado | todos
  const [chamadoAberto, setChamadoAberto] = useState(null)

  useEffect(() => { setCatSel(null); setSubSel(null); setPasso(1); setDescricao(''); setArquivosSel([]); setDestinoEquipe(''); setParaSindico(false); setConfirmNum(null) }, [view])

  // Ao escolher categoria no novo chamado, carrega as subcategorias e avança
  const escolherCategoria = async (cat) => {
    setCatSel(cat)
    setSubSel(null)
    const { data } = await supabase.from('subcategorias_sistema')
      .select('id, nome, icone, categoria_id, categorias_sistema(nome)')
      .eq('ativo', true).order('ordem')
    // filtra as subcategorias cuja categoria bate pelo nome
    const doCat = (data || []).filter(s => s.categorias_sistema?.nome === cat)
    setSubcategorias(doCat)
  }

  const carregar = async () => {
    // O conselho só vê: (a) chamados enviados para votação (aprovacao_status preenchido)
    // e (b) chamados que o próprio conselho abriu (origem Portal do conselheiro).
    // Os demais (dia a dia da gestão) ficam só com síndico/equipe.
    const { data } = await supabase.from('solicitacoes')
      .select('*, condominios(nome)')
      .eq('condominio_id', perfil.condominio_id)
      .or('aprovacao_status.not.is.null,origem.eq."Portal do conselheiro"')
      .order('criado_em', { ascending:false })
    if (data) setTickets(data)
    const { data:cats } = await supabase.from('categorias_sistema')
      .select('nome, icone').eq('ativo', true).order('ordem')
    if (cats) setCategoriasSistema(cats)
    // Síndico + equipe do condomínio (papel equipe/admin) — para direcionar chamado
    const { data:eq } = await supabase.from('perfis')
      .select('id, nome, papel')
      .eq('condominio_id', perfil.condominio_id)
      .in('papel', ['equipe','admin'])
      .order('nome')
    if (eq) setEquipeCondo(eq)
    // Chamados que EU (este conselheiro) já votei
    const { data:mv } = await supabase.from('votos_conselheiros')
      .select('solicitacao_id')
      .eq('conselheiro_id', session.user.id)
    if (mv) setMeusVotos(mv.map(v => v.solicitacao_id))
  }

  useEffect(() => { carregar() }, [])

  // Recarrega ao trocar de view (mudar de assunto) e quando a aba volta ao foco
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

  const pendentes = tickets.filter(t => t.aprovacao_status === 'aguardando' && !meusVotos.includes(t.id)).length
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
      subcategoria: subSel?.nome || null,
      subcategoria_id: subSel?.id || null,
      descricao: descricao.trim(),
      atribuido_para: (paraSindico && destinoEquipe) ? destinoEquipe : null,
      origem: 'Portal do conselheiro',
      nome_solicitante: perfil.nome,
      bloco: perfil.bloco,
      apartamento: perfil.apartamento,
    }).select().single()
    if (error) { setLoading(false); onToast('Erro: '+error.message); return }
    // Upload dos anexos (mesmo padrão do morador: pasta = id da solicitação)
    for (const file of arquivosSel) {
      const nomeSeguro = `${Date.now()}_${file.name}`.replace(/[^a-zA-Z0-9._-]/g, '_')
      await supabase.storage.from('anexos-solicitacoes').upload(`${data.id}/${nomeSeguro}`, file)
    }
    setLoading(false)
    setConfirmNum(ticketNumber(data.id))
    setCatSel(null); setSubSel(null); setPasso(1); setDescricao(''); setArquivosSel([]); setDestinoEquipe(''); setParaSindico(false)
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
          {tickets.filter(t=>t.aprovacao_status==='aguardando' && !meusVotos.includes(t.id)).map(t=>(
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
    const [{ data:orcs }, { data:votos }, { data:notas }] = await Promise.all([
      supabase.from('orcamentos').select('*').eq('solicitacao_id', ticket.id).order('numero'),
      supabase.from('votos_conselheiros').select('*').eq('solicitacao_id', ticket.id),
      supabase.from('notas_internas').select('*').eq('solicitacao_id', ticket.id).order('criado_em', { ascending: true }),
    ])
    setHistoricoVotacao(notas || [])
    // Buscar nomes dos conselheiros separadamente
    const votosComNome = await Promise.all((votos||[]).map(async v => {
      const { data:p } = await supabase.from('perfis').select('nome').eq('id', v.conselheiro_id).maybeSingle()
      return { ...v, perfis: p || { nome: 'Conselheiro' } }
    }))
    // Para cada orçamento, lista os anexos (PDF/imagem) enviados pelo síndico.
    // Bucket é privado → gera URL assinada temporária (respeita a permissão do conselheiro).
    const orcsComAnexo = await Promise.all((orcs||[]).map(async o => {
      try {
        const pasta = `${ticket.id}/orcamentos/${o.id}`
        const { data:arquivos } = await supabase.storage.from('anexos-solicitacoes').list(pasta)
        const anexos = await Promise.all((arquivos||[]).filter(a => a.name).map(async a => {
          const { data:signed } = await supabase.storage.from('anexos-solicitacoes')
            .createSignedUrl(`${pasta}/${a.name}`, 3600)   // válida por 1h
          return { nome: a.name, url: signed?.signedUrl }
        }))
        return { ...o, anexos: anexos.filter(x => x.url) }
      } catch { return { ...o, anexos: [] } }
    }))
    setOrcamentos(orcsComAnexo)
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
    const emAprovacao = tickets.filter(t => t.aprovacao_status)  // aguardando, aprovado ou rejeitado

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
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:10 }}>
              <span style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:'var(--r-full)',
                background:'var(--gray-100)', color:'var(--gray-600)' }}>
                {ticketVotando.categoria}{ticketVotando.subcategoria ? ' · ' + ticketVotando.subcategoria : ''}
              </span>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:12, fontWeight:700, color:'var(--gray-400)' }}>
                #{ticketNumber(ticketVotando.id)}
              </span>
            </div>
            <h2 style={{ fontFamily:'var(--font-display)', fontSize:18, fontWeight:700, color:'var(--navy)', margin:'0 0 12px' }}>
              {ticketVotando.condominios?.nome}
            </h2>

            {/* Resumo estruturado */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:8, marginBottom:12,
              padding:'12px 14px', background:'var(--gray-50)', borderRadius:'var(--r-md)', border:'1px solid var(--gray-200)' }}>
              <div>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.04em' }}>Solicitante</div>
                <div style={{ fontSize:13, color:'var(--gray-700)', fontWeight:600 }}>{ticketVotando.nome_solicitante || '-'}</div>
              </div>
              <div>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.04em' }}>Bloco</div>
                <div style={{ fontSize:13, color:'var(--gray-700)', fontWeight:600 }}>{ticketVotando.bloco || '-'}</div>
              </div>
              <div>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.04em' }}>Unidade</div>
                <div style={{ fontSize:13, color:'var(--gray-700)', fontWeight:600 }}>{ticketVotando.apartamento || '-'}</div>
              </div>
              <div>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.04em' }}>Aberto em</div>
                <div style={{ fontSize:13, color:'var(--gray-700)', fontWeight:600 }}>{fmtDate(ticketVotando.criado_em)}</div>
              </div>
            </div>

            {/* Descrição do morador */}
            <div style={{ padding:'12px 14px', background:'#fff', borderRadius:'var(--r-md)', border:'1px solid var(--gray-200)' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.04em', marginBottom:4 }}>
                Descrição do chamado
              </div>
              <div style={{ fontSize:14, color:'var(--gray-700)', lineHeight:1.5, whiteSpace:'pre-wrap' }}>
                {ticketVotando.descricao || 'Sem descrição.'}
              </div>
            </div>
          </div>

          {/* Histórico de mensagens do chamado */}
          {historicoVotacao.length > 0 && (
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>
                Histórico do chamado
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {historicoVotacao.map(n => {
                  const paraConselho = (n.texto||'').startsWith('[Para conselheiros]')
                  const texto = (n.texto||'').replace('[Para conselheiros]', '').trim()
                  const ehEquipe = n.autor_tipo === 'equipe'
                  return (
                    <div key={n.id} style={{
                      padding:'10px 12px', borderRadius:'var(--r-md)',
                      background: paraConselho ? '#eef2ff' : ehEquipe ? 'var(--gray-50)' : '#fff',
                      border: paraConselho ? '1px solid #c7d2fe' : '1px solid var(--gray-200)' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
                        <span style={{ fontSize:12, fontWeight:700, color: paraConselho ? '#4338ca' : ehEquipe ? 'var(--navy)' : 'var(--gray-700)' }}>
                          {paraConselho ? '📩 Mensagem ao conselho' : ehEquipe ? `${n.autor_nome||'Equipe'} (síndico/equipe)` : `${n.autor_nome||'Morador'}`}
                        </span>
                        <span style={{ fontSize:10, color:'var(--gray-400)' }}>{fmtDate(n.criado_em)}</span>
                      </div>
                      <div style={{ fontSize:13, color:'var(--gray-600)', lineHeight:1.5, whiteSpace:'pre-wrap' }}>{texto}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

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
                    {o.anexos && o.anexos.length > 0 && (
                      <div style={{ marginTop:8, display:'flex', flexWrap:'wrap', gap:6 }} onClick={e=>e.stopPropagation()}>
                        {o.anexos.map((a,ai) => (
                          <a key={ai} href={a.url} target="_blank" rel="noopener noreferrer"
                            style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600,
                              color:'var(--blue)', background:'var(--blue-bg,#eff6ff)', border:'1px solid var(--blue)',
                              borderRadius:6, padding:'4px 9px', textDecoration:'none' }}>
                            📎 Ver proposta
                          </a>
                        ))}
                      </div>
                    )}
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

    // Lista filtrada por estado de aprovação
    const APROV_TABS = [
      ['aguardando', '⏳ Pendentes'],
      ['aprovado', '✅ Aprovados'],
      ['rejeitado', '❌ Não aprovados'],
      ['todos', 'Todos'],
    ]
    const aprovFiltrados = emAprovacao.filter(t => {
      if (aStatus !== 'todos' && t.aprovacao_status !== aStatus) return false
      if (aBusca) {
        const q = aBusca.toLowerCase()
        if (!(t.descricao||'').toLowerCase().includes(q) && !(t.nome_solicitante||'').toLowerCase().includes(q) && !(t.condominios?.nome||'').toLowerCase().includes(q) && !(t.categoria||'').toLowerCase().includes(q)) return false
      }
      return true
    })
    const badgeAprov = (st, jaVotei) => {
      if (st === 'aprovado') return { bg:'var(--mint)', cor:'var(--emerald)', txt:'✅ Aprovado' }
      if (st === 'rejeitado') return { bg:'#fef2f2', cor:'var(--rust)', txt:'❌ Não aprovado' }
      // aguardando o quórum do conselho
      if (jaVotei) return { bg:'#eef2ff', cor:'#4338ca', txt:'🗳️ Você já votou · aguardando conselho' }
      return { bg:'var(--amber-bg)', cor:'#92400e', txt:'⏳ Aguardando seu voto' }
    }
    return (
      <div>
        {header}
        <h2 style={{ fontFamily:'var(--font-display)', fontSize:18, fontWeight:700, color:'var(--navy)', margin:'0 0 16px' }}>
          Aprovações do conselho
        </h2>

        {/* Abas por estado de aprovação */}
        <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
          {APROV_TABS.map(([v,l]) => {
            const n = v==='todos' ? emAprovacao.length : emAprovacao.filter(t=>t.aprovacao_status===v).length
            return (
              <button key={v} onClick={()=>setAStatus(v)}
                style={{ padding:'7px 14px', borderRadius:'var(--r-full)', border:'none', cursor:'pointer',
                  fontSize:13, fontWeight:700, transition:'all .15s',
                  background: aStatus===v ? 'var(--navy)' : 'var(--gray-100)',
                  color: aStatus===v ? '#fff' : 'var(--gray-600)' }}>
                {l} {n>0 && <span style={{ opacity:.7 }}>({n})</span>}
              </button>
            )
          })}
        </div>

        {/* Busca */}
        <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
          <input className="input" placeholder="Buscar por condomínio, solicitante, categoria..." value={aBusca} onChange={e=>setABusca(e.target.value)} style={{ maxWidth:340 }}/>
          <span style={{ marginLeft:'auto', fontSize:13, color:'var(--gray-400)' }}>{aprovFiltrados.length} chamado{aprovFiltrados.length!==1?'s':''}</span>
        </div>

        {emAprovacao.length === 0
          ? <div className="empty-state">Nenhum chamado enviado para aprovação ainda.</div>
          : aprovFiltrados.length === 0
          ? <div className="empty-state">Nenhum chamado neste filtro.</div>
          : aprovFiltrados.map(t => {
            const jaVotei = meusVotos.includes(t.id)
            const bd = badgeAprov(t.aprovacao_status, jaVotei)
            const podeVotar = t.aprovacao_status === 'aguardando'
            return (
            <div key={t.id} onClick={()=>abrirVotacao(t)}
              style={{ background:'#fff', border:'1px solid var(--gray-200)', borderLeft:`3px solid ${bd.cor}`,
                borderRadius:'var(--r-lg)', padding:'16px 18px', marginBottom:10, cursor:'pointer',
                transition:'all .15s', boxShadow:'var(--shadow-sm)' }}
              onMouseEnter={e=>{e.currentTarget.style.boxShadow='var(--shadow-md)';e.currentTarget.style.transform='translateY(-1px)'}}
              onMouseLeave={e=>{e.currentTarget.style.boxShadow='var(--shadow-sm)';e.currentTarget.style.transform='translateY(0)'}}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:8 }}>
                <div>
                  <span style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:'var(--r-full)',
                    background:bd.bg, color:bd.cor }}>
                    {bd.txt}
                  </span>
                  <div style={{ fontFamily:'var(--font-display)', fontSize:16, fontWeight:700, color:'var(--navy)', margin:'8px 0 4px' }}>
                    {t.condominios?.nome}
                  </div>
                  <div style={{ fontSize:13, color:'var(--gray-500)' }}>{t.categoria} · {t.nome_solicitante}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontFamily:'var(--font-mono)', fontSize:11, fontWeight:700, color:'var(--gray-400)' }}>#{ticketNumber(t.id)}</div>
                  <div style={{ fontSize:12, color:'var(--gray-400)' }}>{fmtDate(t.criado_em)}</div>
                  <div style={{ fontSize:12, color:'var(--blue)', fontWeight:600, marginTop:4 }}>{podeVotar ? (jaVotei ? 'Ver/alterar voto →' : 'Votar →') : 'Ver →'}</div>
                </div>
              </div>
              {t.descricao && (
                <p style={{ fontSize:13, color:'var(--gray-500)', margin:'8px 0 0', lineHeight:1.5,
                  display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                  {t.descricao}
                </p>
              )}
            </div>
            )
          })
        }
      </div>
    )
  }

  // ── CHAMADOS ───────────────────────────────────────────────
  if (view === 'chamados') {
    const STATUS_OPCOES = [['todos','Todos'],['aberto','Aberto'],['em_analise','Em análise'],['em_andamento','Em andamento'],['aguardando_terceiro','Aguardando terceiro'],['resolvido','Resolvido'],['cancelado','Cancelado']]
    const PRIO_OPCOES = [['todas','Todas'],['baixa','Baixa'],['media','Média'],['alta','Alta'],['urgente','Urgente']]
    const filtrados = tickets.filter(t => {
      if (fBusca) {
        const q = fBusca.toLowerCase()
        if (!(t.descricao||'').toLowerCase().includes(q) && !(t.nome_solicitante||'').toLowerCase().includes(q) && !(t.categoria||'').toLowerCase().includes(q)) return false
      }
      if (fCategoria !== 'todas' && t.categoria !== fCategoria) return false
      if (fStatus !== 'todos' && t.status !== fStatus) return false
      if (fPrioridade !== 'todas' && t.prioridade !== fPrioridade) return false
      return true
    })
    return (
      <div>
        {header}
        <h2 style={{ fontFamily:'var(--font-display)', fontSize:18, fontWeight:700, color:'var(--navy)', margin:'0 0 16px' }}>
          Todos os chamados
        </h2>

        {/* Filtros */}
        <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
          <input className="input" placeholder="Buscar..." value={fBusca} onChange={e=>setFBusca(e.target.value)} style={{ maxWidth:200 }}/>
          <select className="input" value={fCategoria} onChange={e=>setFCategoria(e.target.value)} style={{ maxWidth:180 }}>
            <option value="todas">Todas as categorias</option>
            {categoriasSistema.map(c=><option key={c.nome} value={c.nome}>{c.nome}</option>)}
          </select>
          <select className="input" value={fStatus} onChange={e=>setFStatus(e.target.value)} style={{ maxWidth:170 }}>
            {STATUS_OPCOES.map(([v,l])=><option key={v} value={v}>{l}</option>)}
          </select>
          <select className="input" value={fPrioridade} onChange={e=>setFPrioridade(e.target.value)} style={{ maxWidth:140 }}>
            {PRIO_OPCOES.map(([v,l])=><option key={v} value={v}>{l}</option>)}
          </select>
          <span style={{ marginLeft:'auto', fontSize:13, color:'var(--gray-400)' }}>{filtrados.length} chamado{filtrados.length!==1?'s':''}</span>
        </div>

        {filtrados.length===0
          ? <div className="empty-state">Nenhum chamado com esses filtros.</div>
          : filtrados.map(t => {
              const prio = t.prioridade && PRIORIDADES[t.prioridade] ? PRIORIDADES[t.prioridade] : null
              const accentColor = prio?.cor || (t.status==='resolvido' ? 'var(--emerald)' : t.aprovacao_status==='aguardando' ? 'var(--amber)' : 'var(--blue)')
              const aberto = chamadoAberto === t.id
              return (
                <div key={t.id} style={{ marginBottom:10 }}>
                  <div onClick={() => setChamadoAberto(aberto ? null : t.id)}
                    style={{ background:'#fff', border:'1px solid var(--gray-200)', borderRadius:'var(--r-lg)',
                      borderLeft:`3px solid ${accentColor}`,
                      padding:'14px 18px', cursor:'pointer', transition:'all .15s', boxShadow:'var(--shadow-sm)' }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow='var(--shadow-md)'; e.currentTarget.style.transform='translateY(-1px)' }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow='var(--shadow-sm)'; e.currentTarget.style.transform='translateY(0)' }}>

                    {/* Linha 1: categoria + badges + status + data */}
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, flexWrap:'wrap' }}>
                      <span style={{ fontFamily:'var(--font-mono)', fontSize:11, fontWeight:700, color:'var(--gray-400)' }}>
                        #{ticketNumber(t.id)}
                      </span>
                      <span style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:'var(--r-full)',
                        background:'var(--gray-100)', color:'var(--gray-600)' }}>
                        {t.categoria_personalizada || t.categoria}
                      </span>
                      {prio && (
                        <span style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:'var(--r-full)',
                          background:prio.bg, color:prio.cor }}>
                          {prio.icon} {prio.label}
                        </span>
                      )}
                      {t.aprovacao_status === 'aguardando' && (
                        <span style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:'var(--r-full)',
                          background:'var(--amber-bg)', color:'#92400e' }}>
                          ⏳ Ag. conselheiros
                        </span>
                      )}
                      {t.departamento && (
                        <span style={{ fontSize:10, fontWeight:600, padding:'3px 8px', borderRadius:'var(--r-full)',
                          background:'#f5f3ff', color:'#6d28d9' }}>
                          ⚙ {t.departamento}
                        </span>
                      )}
                      <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:10 }}>
                        <span className={`status-badge ${statusClass(t.status)}`}>{STATUS_LABEL[t.status]}</span>
                        <span style={{ fontSize:11, color:'var(--gray-400)', fontFamily:'var(--font-mono)', whiteSpace:'nowrap' }}>
                          {fmtDate(t.criado_em)}
                        </span>
                      </div>
                    </div>

                    {/* Linha 2: título + solicitante + descrição */}
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
                      <div>
                        <div style={{ fontSize:14, fontWeight:700, color:'var(--navy)', marginBottom:2 }}>
                          {t.condominios?.nome}
                          {t.bloco ? ` · Bloco ${t.bloco}` : ''}
                          {t.apartamento ? ` · Ap. ${t.apartamento}` : ''}
                        </div>
                        {t.nome_solicitante && (
                          <div style={{ fontSize:12, color:'var(--gray-400)', display:'flex', alignItems:'center', gap:4 }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                            </svg>
                            {t.nome_solicitante}
                          </div>
                        )}
                      </div>
                      {t.descricao && (
                        <p style={{ fontSize:13, color:'var(--gray-500)', margin:0, maxWidth:'55%',
                          overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2,
                          WebkitBoxOrient:'vertical', textAlign:'right', lineHeight:1.4 }}>
                          {t.descricao}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Ao abrir, mostra o painel completo (chat, anexos, votos) */}
                  {aberto && (
                    <div style={{ marginTop:8 }}>
                      <TicketCard ticket={t} onUpdate={carregar} onToast={onToast} />
                    </div>
                  )}
                </div>
              )
            })
        }
      </div>
    )
  }

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
          <button className="btn btn-ghost" onClick={()=>{ setConfirmNum(null); setCatSel(null); setSubSel(null); setSubcategorias([]); setDescricao(''); setArquivosSel([]); setParaSindico(false); setDestinoEquipe('') }}>Abrir outro</button>
        </div>
      ) : (
        <div className="card">
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:700, color:'var(--navy)', margin:'0 0 6px' }}>
            Nova solicitação
          </h2>
          <p style={{ fontSize:13, color:'var(--gray-400)', margin:'0 0 20px' }}>Selecione o tipo de chamado</p>

          {/* ETAPA 1 — Categoria */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>Categoria</div>
            {categoriasSistema.length === 0
              ? <div className="empty-state">Nenhuma categoria disponível.</div>
              : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px, 1fr))', gap:10 }}>
                  {categoriasSistema.map(c=>(
                    <div key={c.nome} className={`cat-card${catSel===c.nome?' selected':''}`} onClick={()=>escolherCategoria(c.nome)}>
                      <div className="cat-card-icon">{c.icone||'📋'}</div>
                      <div className="cat-card-nome">{c.nome}</div>
                    </div>
                  ))}
                </div>}
          </div>

          {/* ETAPA 2 — Subcategoria (aparece após escolher categoria, se houver) */}
          {catSel && subcategorias.length > 0 && (
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>Subcategoria</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px, 1fr))', gap:10 }}>
                {subcategorias.map(s=>(
                  <div key={s.id} className={`cat-card${subSel?.id===s.id?' selected':''}`}
                    onClick={()=>setSubSel(s)}>
                    <div className="cat-card-icon">{s.icone||'📄'}</div>
                    <div className="cat-card-nome">{s.nome}</div>
                  </div>
                ))}
                <div className={`cat-card${subSel==='geral'?' selected':''}`} onClick={()=>setSubSel('geral')}
                  style={{ border:'1.5px dashed var(--gray-300)' }}>
                  <div className="cat-card-icon">📝</div>
                  <div className="cat-card-nome" style={{ color:'var(--gray-400)' }}>Outro / Geral</div>
                </div>
              </div>
            </div>
          )}

          {/* ETAPA 3 — Descrição (aparece após categoria e, se houver, subcategoria) */}
          {catSel && (subcategorias.length === 0 || subSel) && (
            <>
              <div className="field">
                <label>Descreva o chamado</label>
                <textarea className="input" rows={4} value={descricao} onChange={e=>setDescricao(e.target.value)}
                  placeholder="Detalhe o que precisa ser resolvido..." />
              </div>
              <div className="field">
                <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
                  <input type="checkbox" checked={paraSindico}
                    onChange={e=>{ setParaSindico(e.target.checked); if(!e.target.checked) setDestinoEquipe('') }}
                    style={{ width:16, height:16, cursor:'pointer' }}/>
                  <span>Este chamado é para o síndico / equipe</span>
                </label>
                {paraSindico && (
                  <div style={{ marginTop:10 }}>
                    <label>Direcionar para (opcional)</label>
                    <select className="input" value={destinoEquipe} onChange={e=>setDestinoEquipe(e.target.value)}>
                      <option value="">Síndico e equipe (geral)</option>
                      {equipeCondo.map(m=><option key={m.id} value={m.id}>{m.nome}{m.papel==='admin'?' (admin)':''}</option>)}
                    </select>
                    <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:2 }}>
                      Deixe em "geral" para toda a equipe ver, ou escolha uma pessoa específica.
                    </div>
                  </div>
                )}
              </div>
              <div className="field">
                <label>Anexos — fotos, vídeos ou PDF (opcional)</label>
                <input type="file" accept="image/*,video/*,.pdf" multiple onChange={e=>{
                  const files = Array.from(e.target.files||[])
                  const invalidos = files.filter(f => f.size > MAX_BYTES)
                  if (invalidos.length) onToast(`Ignorados (acima de 10MB): ${invalidos.map(f=>f.name).join(', ')}`)
                  setArquivosSel(a=>[...a, ...files.filter(f=>f.size<=MAX_BYTES)].slice(0,5))
                  e.target.value = ''
                }} style={{ fontSize:13, color:'var(--gray-600)' }}/>
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
                <button className="btn" onClick={()=>{ setDescricao(''); setArquivosSel([]) }} disabled={loading}
                  style={{ flexShrink:0, background:'var(--gray-100)', color:'var(--gray-600)', border:'none' }}>
                  Limpar
                </button>
                <button className="btn btn-primary" style={{ flex:1 }} onClick={enviar} disabled={loading||!descricao.trim()}>
                  {loading ? 'Enviando...' : '📨 Enviar chamado'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )

  return null
}
