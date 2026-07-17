import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { STATUS_LABEL, STATUS_ORDER, fmtDate, statusClass, aprovClass, APROVACAO_LABEL, PRIORIDADES, DEPARTAMENTOS, ticketNumber } from '../lib/constants'
import TicketDetail from '../components/TicketDetail'
import Dashboard from './Dashboard'

export default function Equipe({ view, onToast }) {
  const { perfil } = useAuth()
  // subTela é só para navegação DENTRO de chamados (aprovações, etc)
  const [subTela, setSubTela] = useState('lista')
  const [tickets, setTickets] = useState([])
  const [condominios, setCondominios] = useState([])
  const [categoriasSistema, setCategoriasSistema] = useState([])
  const [condoFiltro, setCondoFiltro] = useState('todos')
  const [catFiltro, setCatFiltro] = useState('todas')
  const [subFiltro, setSubFiltro] = useState('todas')
  const [statusFiltro, setStatusFiltro] = useState('todos')
  const [ticketSel, setTicketSel] = useState(null)
  const [showModalNovo, setShowModalNovo] = useState(false)
  const [novaCategoria, setNovaCategoria] = useState(null)
  const [novaDescricao, setNovaDescricao] = useState('')
  const [novaCondo, setNovaCondo] = useState('')
  const [novaOrigem, setNovaOrigem] = useState('E-mail')
  const [novoBloco, setNovoBloco] = useState('')
  const [novoApto, setNovoApto] = useState('')
  const [novoNome, setNovoNome] = useState('')
  const [novoDpto, setNovoDpto] = useState('')          // departamento destino (opcional)
  const [novoResponsavel, setNovoResponsavel] = useState('')  // pessoa destino (opcional)
  const [equipeCondo, setEquipeCondo] = useState([])    // membros da equipe do condomínio escolhido
  const [salvando, setSalvando] = useState(false)

  // ── Novo fluxo de abertura (interno/externo) ──
  const [tipoChamado, setTipoChamado] = useState('')       // 'interno' | 'externo'
  const [passoNovo, setPassoNovo] = useState(1)            // etapa do fluxo
  const [equipeInterna, setEquipeInterna] = useState([])   // equipe/admin da empresa do síndico
  const [destinoInterno, setDestinoInterno] = useState('') // perfil interno escolhido
  const [tipoDestino, setTipoDestino] = useState('')       // 'morador' | 'departamento' | 'conselho'
  const [moradoresCondo, setMoradoresCondo] = useState([]) // moradores do condomínio
  const [conselhoCondo, setConselhoCondo] = useState([])   // conselheiros do condomínio
  const [destinoFinal, setDestinoFinal] = useState('')     // id do morador/conselheiro OU chave do departamento
  const [subcatsNovo, setSubcatsNovo] = useState([])       // subcategorias da categoria escolhida
  const [subSelNovo, setSubSelNovo] = useState(null)       // subcategoria escolhida

  const ehAdmin = perfil?.papel === 'admin'

  // Resetar subTela quando muda de view
  useEffect(() => { setSubTela('lista'); setTicketSel(null) }, [view])

  // Carrega equipe, moradores e conselho do condomínio escolhido (para direcionar)
  useEffect(() => {
    if (!novaCondo) { setEquipeCondo([]); setMoradoresCondo([]); setConselhoCondo([]); return }
    supabase.from('perfis')
      .select('id, nome, papel')
      .eq('condominio_id', novaCondo)
      .in('papel', ['equipe','admin','manutencao','limpeza','administradora','portaria','seguranca','zeladoria','terceiros'])
      .order('nome')
      .then(({ data }) => setEquipeCondo(data || []))
    supabase.from('perfis')
      .select('id, nome, bloco, apartamento')
      .eq('condominio_id', novaCondo).eq('papel', 'morador')
      .order('nome')
      .then(({ data }) => setMoradoresCondo(data || []))
    supabase.from('perfis')
      .select('id, nome')
      .eq('condominio_id', novaCondo).eq('papel', 'conselheiro')
      .order('nome')
      .then(({ data }) => setConselhoCondo(data || []))
  }, [novaCondo])

  // Carrega a equipe interna (equipe/admin da mesma empresa do síndico)
  useEffect(() => {
    if (!showModalNovo || !perfil?.empresa_id) return
    supabase.from('perfis')
      .select('id, nome, papel')
      .eq('empresa_id', perfil.empresa_id)
      .in('papel', ['equipe','admin'])
      .neq('id', perfil.id)   // não a si mesmo
      .order('nome')
      .then(({ data }) => setEquipeInterna(data || []))
  }, [showModalNovo, perfil?.empresa_id])

  // Carrega subcategorias quando escolhe categoria (fluxo externo)
  useEffect(() => {
    if (!novaCategoria) { setSubcatsNovo([]); return }
    const cat = categoriasSistema.find(c => c.nome === novaCategoria)
    if (!cat?.id) { setSubcatsNovo([]); return }
    supabase.from('subcategorias_sistema')
      .select('id, nome, icone').eq('categoria_id', cat.id).eq('ativo', true).order('ordem')
      .then(({ data }) => setSubcatsNovo(data || []))
  }, [novaCategoria])

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
    const { data:cats } = await supabase.from('categorias_sistema')
      .select('id, nome, icone').eq('ativo', true).order('ordem')
    if (cats) setCategoriasSistema(cats)
  }

  useEffect(() => { carregarCondos(); carregar() }, [])

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

  const ehPendente = (t) => t.status !== 'resolvido' && t.status !== 'cancelado'

  const globalStats = {
    total: tickets.length,
    pendentes: tickets.filter(ehPendente).length,
    aprovacao: tickets.filter(t => t.aprovacao_status === 'aguardando').length,
  }

  const ticketsFiltrados = tickets.filter(t => {
    if (condoFiltro !== 'todos' && t.condominio_id !== condoFiltro) return false
    if (catFiltro !== 'todas' && t.categoria !== catFiltro) return false
    if (subFiltro !== 'todas' && t.subcategoria !== subFiltro) return false
    if (statusFiltro === 'pendentes' && !ehPendente(t)) return false
    if (statusFiltro === 'aprovacao' && t.aprovacao_status !== 'aguardando') return false
    if (!['todos','pendentes','aprovacao'].includes(statusFiltro) && t.status !== statusFiltro) return false
    return true
  })

  const filtStats = {
    total: ticketsFiltrados.length,
    pendentes: ticketsFiltrados.filter(ehPendente).length,
    aprovacao: ticketsFiltrados.filter(t => t.aprovacao_status === 'aguardando').length,
  }

  const resetNovo = () => {
    setTipoChamado(''); setPassoNovo(1)
    setNovaCategoria(null); setSubSelNovo(null); setSubcatsNovo([]); setNovaDescricao('')
    setNovaCondo(''); setNovoBloco(''); setNovoApto(''); setNovoNome('')
    setNovoDpto(''); setNovoResponsavel('')
    setDestinoInterno(''); setTipoDestino(''); setDestinoFinal('')
  }

  const abrirModalNovo = () => { resetNovo(); setShowModalNovo(true) }
  const fecharModalNovo = () => { setShowModalNovo(false); resetNovo() }

  const salvarNovo = async () => {
    if (!novaDescricao.trim()) { onToast('Escreva a descrição do chamado.'); return }

    let dados = {
      autor_id: perfil?.id,
      categoria: novaCategoria,
      subcategoria: subSelNovo?.nome || null,
      subcategoria_id: subSelNovo?.id || null,
      descricao: novaDescricao.trim(),
      origem: novaOrigem,
    }

    if (tipoChamado === 'interno') {
      if (!destinoInterno) { onToast('Selecione para quem da equipe interna.'); return }
      if (!novaCategoria) { onToast('Selecione a categoria.'); return }
      // Chamado interno: vai para uma pessoa da equipe da empresa.
      // Usa o condomínio do próprio síndico como referência (ou o primeiro atribuído).
      const condoRef = perfil?.condominio_id || novaCondo || (condominios[0]?.id)
      if (!condoRef) { onToast('Nenhum condomínio de referência disponível para o chamado interno.'); return }
      dados = {
        ...dados,
        condominio_id: condoRef,
        atribuido_para: destinoInterno,
        tipo_chamado: 'interno',
      }
    } else if (tipoChamado === 'externo') {
      if (!novaCondo) { onToast('Selecione o condomínio.'); return }
      if (!tipoDestino) { onToast('Selecione o tipo de destinatário.'); return }
      if (!novaCategoria) { onToast('Selecione a categoria.'); return }
      dados = { ...dados, condominio_id: novaCondo, tipo_chamado: 'externo' }

      if (tipoDestino === 'departamento') {
        if (!destinoFinal) { onToast('Selecione o departamento.'); return }
        dados.departamento = destinoFinal
      } else if (tipoDestino === 'morador') {
        if (!destinoFinal) { onToast('Selecione o morador.'); return }
        dados.atribuido_para = destinoFinal
        const m = moradoresCondo.find(x => x.id === destinoFinal)
        if (m) { dados.nome_solicitante = m.nome; dados.bloco = m.bloco; dados.apartamento = m.apartamento }
      } else if (tipoDestino === 'conselho') {
        // Direciona ao conselho: se escolheu um conselheiro específico, usa; senão marca destino conselho
        if (destinoFinal) dados.atribuido_para = destinoFinal
        dados.destino_conselho = true
      }
    } else {
      onToast('Selecione se o chamado é interno ou externo.'); return
    }

    setSalvando(true)
    const { error } = await supabase.from('solicitacoes').insert(dados)
    setSalvando(false)
    if (error) { onToast('Erro: '+error.message); return }
    onToast('Chamado registrado.')
    fecharModalNovo()
    await carregar()
  }

  // ── VIEW: PAINEL → Dashboard BI
  if (view === 'dashboard') return <Dashboard onToast={onToast} />

  // ── VIEW: CHAMADOS
  // Se ticket selecionado → tela de detalhe
  if (ticketSel) return (
    <TicketDetail
      ticket={ticketSel}
      onBack={() => { setTicketSel(null); carregar() }}
      onUpdate={carregar}
      onToast={onToast}
    />
  )

  return (
    <div>
      {/* Header com sub-navegação */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div>
          <h1 className="page-title" style={{ margin:0 }}>Chamados</h1>
          <p className="page-sub">{globalStats.total} total · {globalStats.pendentes} pendentes · {globalStats.aprovacao} ag. aprovacao</p>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button className={`btn btn-sm ${subTela==='lista'?'btn-primary':'btn-ghost'}`} onClick={() => setSubTela('lista')}>Todos</button>
          <button className={`btn btn-sm ${subTela==='aprovacao'?'btn-primary':'btn-ghost'}`}
            onClick={() => setSubTela('aprovacao')}
            style={subTela!=='aprovacao'&&globalStats.aprovacao>0?{borderColor:'var(--amber)',color:'var(--amber)'}:{}}>
            Ag. aprovacao {globalStats.aprovacao > 0 && `(${globalStats.aprovacao})`}
          </button>
          <button className="btn btn-primary btn-sm" onClick={abrirModalNovo}>+ Novo</button>
        </div>
      </div>

      {/* ── LISTA DE CHAMADOS ── */}
      {subTela === 'lista' && (
        <div>
          {/* Filtros */}
          <div style={{ background:'#fff', border:'1px solid var(--gray-200)', borderRadius:'var(--r-lg)', padding:'14px 18px', marginBottom:14 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px,1fr))', gap:10 }}>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', display:'block', marginBottom:4 }}>Condominio</label>
                <select className="input" style={{ fontSize:13 }} value={condoFiltro} onChange={e => setCondoFiltro(e.target.value)}>
                  <option value="todos">Todos</option>
                  {condominios.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', display:'block', marginBottom:4 }}>Categoria</label>
                <select className="input" style={{ fontSize:13 }} value={catFiltro} onChange={e => { setCatFiltro(e.target.value); setSubFiltro('todas') }}>
                  <option value="todas">Todas</option>
                  {categoriasSistema.map(c => <option key={c.nome} value={c.nome}>{c.nome}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', display:'block', marginBottom:4 }}>Subcategoria</label>
                <select className="input" style={{ fontSize:13 }} value={subFiltro} onChange={e => setSubFiltro(e.target.value)}>
                  <option value="todas">Todas</option>
                  {[...new Set(tickets
                    .filter(t => catFiltro==='todas' || t.categoria===catFiltro)
                    .map(t => t.subcategoria).filter(Boolean))]
                    .sort().map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', display:'block', marginBottom:4 }}>Status</label>
                <select className="input" style={{ fontSize:13 }} value={statusFiltro} onChange={e => setStatusFiltro(e.target.value)}>
                  <option value="todos">Todos</option>
                  <option value="pendentes">Pendentes</option>
                  <option value="aprovacao">Ag. aprovação</option>
                  {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Mini stats */}
          <div className="filtros-row" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:14 }}>
            {[
              { l:'Total filtrado', v:filtStats.total, c:'var(--navy)' },
              { l:'Pendentes', v:filtStats.pendentes, c:'var(--amber)' },
              { l:'Ag. aprovacao', v:filtStats.aprovacao, c:'#8a5a00' },
            ].map(k => (
              <div key={k.l} style={{ background:'#fff', border:'1px solid var(--gray-200)', borderRadius:'var(--r-lg)', padding:'12px 14px', textAlign:'center' }}>
                <div style={{ fontFamily:'var(--font-display)', fontSize:24, fontWeight:800, color:k.c }}>{k.v}</div>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.05em' }}>{k.l}</div>
              </div>
            ))}
          </div>

          {ticketsFiltrados.length === 0
            ? <div className="empty-state">Nenhum chamado encontrado com esses filtros.</div>
            : <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {ticketsFiltrados.map(t => {
                const prio = t.prioridade && t.prioridade !== 'rotina' ? PRIORIDADES[t.prioridade] : null
                const ehConselho = t.origem === 'Portal do conselheiro'
                const accentColor = ehConselho ? '#4338ca' : (prio?.cor || (t.status==='resolvido' ? 'var(--emerald)' : t.aprovacao_status==='aguardando' ? 'var(--amber)' : 'var(--blue)'))
                return (
                  <div key={t.id} onClick={() => setTicketSel(t)}
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
                      {t.origem === 'Portal do conselheiro' && (
                        <span style={{ fontSize:10, fontWeight:800, padding:'3px 9px', borderRadius:'var(--r-full)',
                          background:'#4338ca', color:'#fff', letterSpacing:'.02em' }}>
                          ⭐ CONSELHO
                        </span>
                      )}
                      <span style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:'var(--r-full)',
                        background:'var(--gray-100)', color:'var(--gray-600)' }}>
                        {t.categoria_personalizada || t.categoria}
                      </span>
                      {t.subcategoria && (
                        <span style={{ fontSize:10, fontWeight:600, padding:'3px 8px', borderRadius:'var(--r-full)',
                          background:'#eef2ff', color:'#4338ca' }}>
                          {t.subcategoria}
                        </span>
                      )}
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

                    {/* Linha 2: título + solicitante */}
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
                )
              })}
            </div>
          }
        </div>
      )}

      {/* ── APROVAÇÕES ── */}
      {subTela === 'aprovacao' && (
        <div>
          {tickets.filter(t => t.aprovacao_status === 'aguardando').length === 0
            ? <div className="empty-state">Nenhum chamado aguardando aprovação dos conselheiros.</div>
            : <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {tickets.filter(t => t.aprovacao_status === 'aguardando').map(t => (
                <div key={t.id} onClick={() => setTicketSel(t)}
                  style={{ background:'#fff', border:'1px solid var(--gray-200)', borderRadius:'var(--r-lg)',
                    borderLeft:'3px solid var(--amber)', padding:'14px 18px', cursor:'pointer',
                    transition:'all .15s', boxShadow:'var(--shadow-sm)' }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow='var(--shadow-md)'; e.currentTarget.style.transform='translateY(-1px)' }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow='var(--shadow-sm)'; e.currentTarget.style.transform='translateY(0)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                    <span style={{ fontFamily:'var(--font-mono)', fontSize:11, fontWeight:700, color:'var(--gray-400)' }}>
                      #{ticketNumber(t.id)}
                    </span>
                    <span style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:'var(--r-full)',
                      background:'var(--gray-100)', color:'var(--gray-600)' }}>
                      {t.categoria_personalizada || t.categoria}
                    </span>
                    {t.subcategoria && (
                      <span style={{ fontSize:10, fontWeight:600, padding:'3px 8px', borderRadius:'var(--r-full)',
                        background:'#eef2ff', color:'#4338ca' }}>
                        {t.subcategoria}
                      </span>
                    )}
                    <span style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:'var(--r-full)',
                      background:'var(--amber-bg)', color:'#92400e' }}>
                      ⏳ Aguardando votação
                    </span>
                    <div style={{ marginLeft:'auto' }}>
                      <span style={{ fontSize:11, color:'var(--gray-400)', fontFamily:'var(--font-mono)' }}>{fmtDate(t.criado_em)}</span>
                    </div>
                  </div>
                  <div style={{ fontSize:14, fontWeight:700, color:'var(--navy)', marginBottom:4 }}>
                    {t.condominios?.nome}{t.bloco?` · Bloco ${t.bloco}`:''}
                  </div>
                  {t.descricao && (
                    <p style={{ fontSize:13, color:'var(--gray-500)', margin:0, lineHeight:1.5,
                      display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                      {t.descricao}
                    </p>
                  )}
                </div>
              ))}
            </div>
          }
        </div>
      )}

      {/* Modal novo chamado */}
      {showModalNovo && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget&&fecharModalNovo()}>
          <div className="modal" style={{ maxHeight:'90vh', overflowY:'auto' }}>
            <div className="modal-header">
              <h3 className="modal-title">Novo chamado</h3>
              <button className="modal-close" onClick={fecharModalNovo}>✕</button>
            </div>

            {/* PASSO 1: Interno ou Externo */}
            <div className="field"><label>Tipo de chamado</label>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div className={`cat-card${tipoChamado==='interno'?' selected':''}`} onClick={()=>{ setTipoChamado('interno'); setNovaCondo(''); setTipoDestino(''); setDestinoFinal('') }} style={{ padding:'16px 8px' }}>
                  <div className="cat-card-icon" style={{ fontSize:26 }}>🏢</div>
                  <div className="cat-card-nome">Interno</div>
                  <div style={{ fontSize:10, color:'var(--gray-400)', marginTop:2 }}>Para a equipe interna</div>
                </div>
                <div className={`cat-card${tipoChamado==='externo'?' selected':''}`} onClick={()=>{ setTipoChamado('externo'); setDestinoInterno('') }} style={{ padding:'16px 8px' }}>
                  <div className="cat-card-icon" style={{ fontSize:26 }}>🏘️</div>
                  <div className="cat-card-nome">Externo</div>
                  <div style={{ fontSize:10, color:'var(--gray-400)', marginTop:2 }}>Para um condomínio</div>
                </div>
              </div>
            </div>

            {/* ───────── FLUXO INTERNO ───────── */}
            {tipoChamado === 'interno' && (
              <>
                <div className="field"><label>Direcionar para (equipe interna)</label>
                  <select className="input" value={destinoInterno} onChange={e=>setDestinoInterno(e.target.value)}>
                    <option value="">Selecione a pessoa...</option>
                    {equipeInterna.map(m=><option key={m.id} value={m.id}>{m.nome}{m.papel==='admin'?' (admin)':''}</option>)}
                  </select>
                  {equipeInterna.length===0 && <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:2 }}>Nenhuma outra pessoa na equipe interna.</div>}
                </div>
                <div className="field"><label>Categoria</label>
                  <select className="input" value={novaCategoria||''} onChange={e=>setNovaCategoria(e.target.value||null)}>
                    <option value="">Selecione...</option>
                    {categoriasSistema.map(c=><option key={c.nome} value={c.nome}>{c.icone?c.icone+' ':''}{c.nome}</option>)}
                  </select>
                </div>
                <div className="field"><label>Origem</label>
                  <select className="input" value={novaOrigem} onChange={e => setNovaOrigem(e.target.value)}>
                    {['E-mail','Telefone','Presencial','WhatsApp','Outro'].map(o=><option key={o}>{o}</option>)}
                  </select>
                </div>
                <div className="field"><label>Descrição</label><textarea className="input" rows={3} value={novaDescricao} onChange={e=>setNovaDescricao(e.target.value)}/></div>
                <button className="btn btn-primary btn-block" onClick={salvarNovo} disabled={salvando}>{salvando?'Salvando...':'Registrar chamado interno'}</button>
              </>
            )}

            {/* ───────── FLUXO EXTERNO ───────── */}
            {tipoChamado === 'externo' && (
              <>
                <div className="field"><label>Condomínio</label>
                  <select className="input" value={novaCondo} onChange={e => { setNovaCondo(e.target.value); setTipoDestino(''); setDestinoFinal('') }}>
                    <option value="">Selecione...</option>
                    {condominios.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>

                {novaCondo && (
                  <div className="field"><label>Este chamado é para</label>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                      {[['morador','👤','Morador'],['departamento','🔧','Departamento'],['conselho','⭐','Conselho']].map(([v,ic,lb])=>(
                        <div key={v} className={`cat-card${tipoDestino===v?' selected':''}`} onClick={()=>{ setTipoDestino(v); setDestinoFinal('') }} style={{ padding:'12px 6px' }}>
                          <div className="cat-card-icon" style={{ fontSize:22 }}>{ic}</div>
                          <div className="cat-card-nome" style={{ fontSize:11 }}>{lb}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Destinatário específico conforme o tipo */}
                {tipoDestino === 'morador' && (
                  <div className="field"><label>Qual morador</label>
                    <select className="input" value={destinoFinal} onChange={e=>setDestinoFinal(e.target.value)}>
                      <option value="">Selecione...</option>
                      {moradoresCondo.map(m=><option key={m.id} value={m.id}>{m.nome}{m.bloco?` · Bloco ${m.bloco}`:''}{m.apartamento?` · Ap. ${m.apartamento}`:''}</option>)}
                    </select>
                    {moradoresCondo.length===0 && <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:2 }}>Nenhum morador cadastrado neste condomínio.</div>}
                  </div>
                )}
                {tipoDestino === 'departamento' && (
                  <div className="field"><label>Qual departamento</label>
                    <select className="input" value={destinoFinal} onChange={e=>setDestinoFinal(e.target.value)}>
                      <option value="">Selecione...</option>
                      {Object.entries(DEPARTAMENTOS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                )}
                {tipoDestino === 'conselho' && (
                  <div className="field"><label>Conselho</label>
                    <select className="input" value={destinoFinal} onChange={e=>setDestinoFinal(e.target.value)}>
                      <option value="">Todo o conselho</option>
                      {conselhoCondo.map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}
                    </select>
                    <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:2 }}>Deixe em "Todo o conselho" ou escolha um conselheiro específico.</div>
                  </div>
                )}

                {/* Categoria em cards (igual morador) */}
                {tipoDestino && (
                  <div className="field"><label>Categoria</label>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(110px, 1fr))', gap:8 }}>
                      {categoriasSistema.map(c=>(
                        <div key={c.nome} className={`cat-card${novaCategoria===c.nome?' selected':''}`}
                          onClick={()=>{ setNovaCategoria(c.nome); setSubSelNovo(null) }} style={{ padding:'14px 8px' }}>
                          <div className="cat-card-icon" style={{ fontSize:24 }}>{c.icone||'📋'}</div>
                          <div className="cat-card-nome" style={{ fontSize:12 }}>{c.nome}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Subcategoria em cards (se houver) */}
                {novaCategoria && subcatsNovo.length > 0 && (
                  <div className="field"><label>Subcategoria</label>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(110px, 1fr))', gap:8 }}>
                      {subcatsNovo.map(s=>(
                        <div key={s.id} className={`cat-card${subSelNovo?.id===s.id?' selected':''}`}
                          onClick={()=>setSubSelNovo(s)} style={{ padding:'12px 8px' }}>
                          <div className="cat-card-icon" style={{ fontSize:20 }}>{s.icone||'📄'}</div>
                          <div className="cat-card-nome" style={{ fontSize:11 }}>{s.nome}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {novaCategoria && (subcatsNovo.length === 0 || subSelNovo) && (
                  <>
                    <div className="field"><label>Origem</label>
                      <select className="input" value={novaOrigem} onChange={e => setNovaOrigem(e.target.value)}>
                        {['E-mail','Telefone','Presencial','WhatsApp','Outro'].map(o=><option key={o}>{o}</option>)}
                      </select>
                    </div>
                    <div className="field"><label>Descrição</label><textarea className="input" rows={3} value={novaDescricao} onChange={e=>setNovaDescricao(e.target.value)}/></div>
                    <button className="btn btn-primary btn-block" onClick={salvarNovo} disabled={salvando}>{salvando?'Salvando...':'Registrar chamado'}</button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

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
