import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { STATUS_LABEL } from '../lib/constants'

const FECHADOS = ['resolvido', 'cancelado']

// Paleta do painel (tema escuro)
const C = {
  bg:'#0b1220', panel:'#111c30', panel2:'#0d1626', line:'#22304a',
  txt:'#e6edf7', muted:'#93a4bf',
  brand:'#3b82f6', ok:'#22c55e', warn:'#f59e0b', bad:'#ef4444',
  slate:'#8b5cf6', gray:'#64748b', cyan:'#06b6d4',
}

const CORES_STATUS = {
  aberto:'#f59e0b', em_analise:'#3b82f6', em_andamento:'#06b6d4',
  aguardando_terceiro:'#8b5cf6', resolvido:'#22c55e', cancelado:'#64748b',
}

const PRIORIDADE_COR = { baixa:'#64748b', media:'#3b82f6', alta:'#f59e0b', urgente:'#ef4444' }
const PRIORIDADE_LABEL = { baixa:'Baixa', media:'Média', alta:'Alta', urgente:'Urgente' }

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

// aaaa-mm-dd -> dd/mm/aaaa
const fmtDataBR = (d) => { if (!d) return ''; const [a,m,dia] = String(d).slice(0,10).split('-'); return `${dia}/${m}/${a}` }
// Dias até a data (negativo = já venceu), base hoje 00:00
const diasAteData = (d) => { const h = new Date(); h.setHours(0,0,0,0); return Math.round((new Date(String(d).slice(0,10) + 'T00:00:00') - h) / 86400000) }
// Selo de vencimento (tema escuro)
const seloVenc = (dias) => dias < 0
  ? { cor:'#fca5a5', texto:`Vencido há ${Math.abs(dias)} dia${Math.abs(dias)===1?'':'s'}` }
  : { cor:'#fbbf24', texto: dias===0 ? 'Vence hoje' : `Vence em ${dias} dia${dias===1?'':'s'}` }

// ── Blocos visuais ────────────────────────────────────────────
function Kpi({ n, label, cor, sub }) {
  return (
    <div style={{ background:C.panel, border:`1px solid ${C.line}`, borderRadius:14, padding:14 }}>
      <div style={{ fontSize:26, fontWeight:700, letterSpacing:'-.02em', lineHeight:1, color:cor||C.txt }}>{n}</div>
      <div style={{ color:C.muted, fontSize:11, marginTop:6, textTransform:'uppercase', letterSpacing:'.03em' }}>{label}</div>
      {sub && <div style={{ color:C.muted, fontSize:11, marginTop:3, opacity:.75 }}>{sub}</div>}
    </div>
  )
}

function Painel({ titulo, contagem, children }) {
  return (
    <div style={{ background:C.panel, border:`1px solid ${C.line}`, borderRadius:14, padding:16 }}>
      <h3 style={{ margin:'0 0 14px', fontSize:13, color:C.muted, textTransform:'uppercase', letterSpacing:'.05em', display:'flex', justifyContent:'space-between' }}>
        <span>{titulo}</span>
        {contagem != null && <span style={{ color:C.txt, fontWeight:700 }}>{contagem}</span>}
      </h3>
      {children}
    </div>
  )
}

// Barras horizontais
function Barras({ dados, vazio = 'Sem dados no período' }) {
  const max = Math.max(1, ...dados.map(d => d.valor))
  if (!dados.length) return <div style={{ color:C.muted, fontSize:13 }}>{vazio}</div>
  return (
    <div>
      {dados.map((d, i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:11 }}>
          <div title={d.label} style={{ width:120, fontSize:12, color:C.muted, textAlign:'right', flexShrink:0,
            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{d.label}</div>
          <div style={{ flex:1, height:22, background:C.panel2, borderRadius:6, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${(d.valor/max)*100}%`, background:d.cor||C.brand, borderRadius:6,
              display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:7,
              fontSize:11, fontWeight:700, color:'#08111f', minWidth:26, transition:'width .5s' }}>
              {d.valor}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// Rosca (donut) com legenda
function Donut({ dados }) {
  const total = dados.reduce((s, d) => s + d.valor, 0)
  if (!total) return <div style={{ color:C.muted, fontSize:13 }}>Sem chamados no período</div>
  let acc = 0
  const partes = dados.filter(d => d.valor > 0).map(d => {
    const ini = (acc / total) * 100
    acc += d.valor
    return `${d.cor} ${ini}% ${(acc / total) * 100}%`
  })
  return (
    <div style={{ display:'flex', alignItems:'center', gap:18, flexWrap:'wrap' }}>
      <div style={{ width:140, height:140, borderRadius:'50%', flexShrink:0,
        background:`conic-gradient(${partes.join(',')})`, position:'relative' }}>
        <div style={{ position:'absolute', inset:'22%', borderRadius:'50%', background:C.panel,
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
          <div style={{ fontSize:22, fontWeight:700, letterSpacing:'-.02em', color:C.txt, lineHeight:1 }}>{total}</div>
          <div style={{ fontSize:10, color:C.muted, textTransform:'uppercase' }}>chamados</div>
        </div>
      </div>
      <div style={{ flex:1, minWidth:150 }}>
        {dados.filter(d => d.valor > 0).map((d, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7, fontSize:12 }}>
            <span style={{ width:10, height:10, borderRadius:3, background:d.cor, flexShrink:0 }} />
            <span style={{ color:C.muted, flex:1 }}>{d.label}</span>
            <span style={{ color:C.txt, fontWeight:700 }}>{d.valor}</span>
            <span style={{ color:C.muted, width:38, textAlign:'right' }}>
              {Math.round((d.valor/total)*100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Evolução mensal (linhas de barras verticais)
function Evolucao({ dados }) {
  const max = Math.max(1, ...dados.map(d => Math.max(d.abertos, d.fechados)))
  return (
    <div>
      <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:150, marginBottom:10 }}>
        {dados.map((d, i) => (
          <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
            <div style={{ display:'flex', alignItems:'flex-end', gap:3, height:130, width:'100%', justifyContent:'center' }}>
              <div title={`${d.abertos} abertos`} style={{ width:'42%', maxWidth:18, height:`${(d.abertos/max)*100}%`,
                background:C.brand, borderRadius:'4px 4px 0 0', minHeight:d.abertos?3:0 }} />
              <div title={`${d.fechados} fechados`} style={{ width:'42%', maxWidth:18, height:`${(d.fechados/max)*100}%`,
                background:C.ok, borderRadius:'4px 4px 0 0', minHeight:d.fechados?3:0 }} />
            </div>
            <div style={{ fontSize:10, color:C.muted }}>{d.rotulo}</div>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', gap:16, fontSize:11, color:C.muted, justifyContent:'center' }}>
        <span><span style={{ display:'inline-block', width:9, height:9, borderRadius:2, background:C.brand, marginRight:5 }}/>Abertos</span>
        <span><span style={{ display:'inline-block', width:9, height:9, borderRadius:2, background:C.ok, marginRight:5 }}/>Fechados</span>
      </div>
    </div>
  )
}

// ── Tela ──────────────────────────────────────────────────────
export default function DashboardAnalitico({ onNavigate, onToast }) {
  const { perfil } = useAuth()
  const [tickets, setTickets] = useState([])
  const [condominios, setCondominios] = useState([])
  const [vencimentos, setVencimentos] = useState([])
  const [fornecedores, setFornecedores] = useState([])
  const [loading, setLoading] = useState(true)
  const [condoFiltro, setCondoFiltro] = useState('todos')
  const [periodo, setPeriodo] = useState(90)   // dias
  const [telaCheia, setTelaCheia] = useState(false)
  const [atualizadoEm, setAtualizadoEm] = useState(null)
  const [totCondominios, setTotCondominios] = useState(0)
  const [totMoradores, setTotMoradores] = useState(0)
  const [totConselheiros, setTotConselheiros] = useState(0)
  const containerRef = useRef(null)

  // Entra/sai da tela cheia
  const alternarTelaCheia = async () => {
    try {
      if (!document.fullscreenElement) {
        await containerRef.current?.requestFullscreen?.()
      } else {
        await document.exitFullscreen?.()
      }
    } catch {
      onToast?.('Seu navegador não permitiu a tela cheia.')
    }
  }

  // Mantém o estado sincronizado (inclusive ao sair com Esc)
  useEffect(() => {
    const onMudou = () => setTelaCheia(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onMudou)
    return () => document.removeEventListener('fullscreenchange', onMudou)
  }, [])

  const ehAdmin = perfil?.papel === 'admin'

  const carregar = async () => {
    setLoading(true)
    // Condomínios do síndico (ou todos, se admin)
    let condos = []
    if (ehAdmin) {
      const { data } = await supabase.from('condominios').select('id,nome').order('nome')
      condos = data || []
    } else {
      const { data } = await supabase.from('sindico_condominios')
        .select('condominio_id, condominios(id,nome)').eq('perfil_id', perfil?.id)
      condos = (data || []).map(r => r.condominios).filter(Boolean)
    }
    setCondominios(condos)

    const ids = condos.map(c => c.id)
    if (ids.length) {
      const { data } = await supabase.from('solicitacoes')
        .select('id,status,categoria,categoria_personalizada,prioridade,departamento,condominio_id,aprovacao_status,criado_em,fechado_em')
        .in('condominio_id', ids)
        .order('criado_em', { ascending:false })
      setTickets(data || [])
      const { data: v } = await supabase.from('vencimentos')
        .select('id,titulo,tipo,data_vencimento,condominio_id')
        .in('condominio_id', ids).neq('status', 'arquivado')
      setVencimentos(v || [])
    } else {
      setTickets([])
      setVencimentos([])
    }
    // Contratos de fornecedores (por empresa — independem de condomínio)
    const { data: f } = await supabase.from('fornecedores')
      .select('id,razao_social,nome_fantasia,categoria,contrato_fim')
      .eq('empresa_id', perfil?.empresa_id).eq('ativo', true).eq('tem_contrato', true)
    setFornecedores(f || [])

    // Totais macro da empresa — condomínios, moradores e conselheiros cadastrados.
    // Sempre restrito à empresa do usuário (empresa_id); a RLS garante que
    // nunca conte itens de outra empresa/estrutura de síndico.
    if (perfil?.empresa_id) {
      const [{ count: nCondos }, { count: nMoradores }, { count: nConselheiros }] = await Promise.all([
        supabase.from('condominios').select('id', { count:'exact', head:true }).eq('empresa_id', perfil.empresa_id),
        supabase.from('perfis').select('id', { count:'exact', head:true }).eq('empresa_id', perfil.empresa_id).eq('papel', 'morador'),
        supabase.from('perfis').select('id', { count:'exact', head:true }).eq('empresa_id', perfil.empresa_id).eq('papel', 'conselheiro'),
      ])
      setTotCondominios(nCondos || 0)
      setTotMoradores(nMoradores || 0)
      setTotConselheiros(nConselheiros || 0)
    }

    setAtualizadoEm(new Date())
    setLoading(false)
  }

  useEffect(() => { if (perfil?.id) carregar() }, [perfil?.id])

  useEffect(() => {
    const onFoco = () => { if (!document.hidden) carregar() }
    window.addEventListener('focus', onFoco)
    document.addEventListener('visibilitychange', onFoco)
    // Atualiza sozinho a cada 5 minutos (útil para deixar num monitor)
    const timer = setInterval(() => { if (!document.hidden) carregar() }, 5 * 60 * 1000)
    return () => {
      window.removeEventListener('focus', onFoco)
      document.removeEventListener('visibilitychange', onFoco)
      clearInterval(timer)
    }
  }, [perfil?.id])

  // ── Filtragem ──
  const limite = new Date(); limite.setDate(limite.getDate() - periodo)
  const base = tickets.filter(t => {
    if (condoFiltro !== 'todos' && t.condominio_id !== condoFiltro) return false
    if (periodo && new Date(t.criado_em) < limite) return false
    return true
  })

  const estaFechado = t => FECHADOS.includes(t.status)

  // ── Indicadores ──
  const kpis = {
    total: base.length,
    abertos: base.filter(t => !estaFechado(t)).length,
    andamento: base.filter(t => t.status === 'em_andamento').length,
    aprovacao: base.filter(t => t.aprovacao_status === 'aguardando').length,
    resolvidos: base.filter(t => t.status === 'resolvido').length,
    urgentes: base.filter(t => t.prioridade === 'urgente' && !estaFechado(t)).length,
  }

  // Tempo médio de resolução (dias)
  const fechadosComData = base.filter(t => estaFechado(t) && t.fechado_em && t.criado_em)
  const tempoMedio = fechadosComData.length
    ? (fechadosComData.reduce((s, t) =>
        s + (new Date(t.fechado_em) - new Date(t.criado_em)) / 86400000, 0) / fechadosComData.length)
    : null

  // Taxa de resolução
  const taxaResolucao = base.length
    ? Math.round((base.filter(estaFechado).length / base.length) * 100) : 0

  // Por status (rosca)
  const porStatus = Object.keys(CORES_STATUS).map(s => ({
    label: STATUS_LABEL[s] || s,
    valor: base.filter(t => t.status === s).length,
    cor: CORES_STATUS[s],
  }))

  // Por condomínio (barras)
  const porCondo = condominios.map(c => ({
    label: c.nome,
    valor: base.filter(t => t.condominio_id === c.id).length,
    cor: C.brand,
  })).filter(d => d.valor > 0).sort((a, b) => b.valor - a.valor).slice(0, 8)

  // Por categoria (barras)
  const catMap = {}
  base.forEach(t => {
    const k = t.categoria_personalizada || t.categoria || 'Sem categoria'
    catMap[k] = (catMap[k] || 0) + 1
  })
  const porCategoria = Object.entries(catMap)
    .map(([label, valor]) => ({ label, valor, cor:C.cyan }))
    .sort((a, b) => b.valor - a.valor).slice(0, 8)

  // Por prioridade (barras)
  const porPrioridade = ['urgente','alta','media','baixa'].map(p => ({
    label: PRIORIDADE_LABEL[p],
    valor: base.filter(t => t.prioridade === p).length,
    cor: PRIORIDADE_COR[p],
  })).filter(d => d.valor > 0)

  // Evolução dos últimos 6 meses
  const evolucao = (() => {
    const hoje = new Date()
    const meses = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
      meses.push({ ano:d.getFullYear(), mes:d.getMonth(), rotulo:MESES[d.getMonth()], abertos:0, fechados:0 })
    }
    tickets.forEach(t => {
      if (condoFiltro !== 'todos' && t.condominio_id !== condoFiltro) return
      const c = new Date(t.criado_em)
      const m = meses.find(x => x.ano === c.getFullYear() && x.mes === c.getMonth())
      if (m) m.abertos++
      if (t.fechado_em) {
        const f = new Date(t.fechado_em)
        const mf = meses.find(x => x.ano === f.getFullYear() && x.mes === f.getMonth())
        if (mf) mf.fechados++
      }
    })
    return meses
  })()

  // Chamados parados há mais de 7 dias
  const parados = base
    .filter(t => !estaFechado(t))
    .map(t => ({ ...t, dias: Math.floor((Date.now() - new Date(t.criado_em)) / 86400000) }))
    .filter(t => t.dias >= 7)
    .sort((a, b) => b.dias - a.dias)
    .slice(0, 8)

  const nomeCondo = id => condominios.find(c => c.id === id)?.nome || '—'

  // Vencimentos próximos: Controle de Vencimentos + contratos de fornecedores.
  // Só vencidos ou vencendo em 30 dias; independe dos filtros de período/condomínio.
  const vencItens = vencimentos
    .filter(v => v.data_vencimento)
    .map(v => ({ id:`v${v.id}`, titulo:v.titulo, tipo:'vencimento', data:v.data_vencimento,
      contexto: condominios.find(c => c.id === v.condominio_id)?.nome || '', dias:diasAteData(v.data_vencimento) }))
  const fornItens = fornecedores
    .filter(f => f.contrato_fim)
    .map(f => ({ id:`f${f.id}`, titulo:`Contrato · ${f.nome_fantasia || f.razao_social}`, tipo:'fornecedor',
      data:f.contrato_fim, contexto:f.categoria || '', dias:diasAteData(f.contrato_fim) }))
  const vencProximos = [...vencItens, ...fornItens]
    .filter(i => i.dias <= 30)
    .sort((a, b) => a.dias - b.dias)
  const nVencidos = vencProximos.filter(i => i.dias < 0).length
  const nVencendo = vencProximos.filter(i => i.dias >= 0).length

  if (loading) return (
    <div style={{ background:C.bg, minHeight:'100vh', margin:-24, padding:40, color:C.muted }}>
      Carregando painel...
    </div>
  )

  return (
    <div ref={containerRef} style={{ background:C.bg, minHeight:'100vh',
      margin: telaCheia ? 0 : -24, padding:24, color:C.txt,
      overflowY: telaCheia ? 'auto' : 'visible',
      fontFamily:'var(--font-body, system-ui)' }}>

      {/* Cabeçalho */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:14, flexWrap:'wrap', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, letterSpacing:'-.02em', margin:0, color:C.txt }}>Dashboard de chamados</h1>
          <p style={{ color:C.muted, fontSize:13, margin:'4px 0 0' }}>
            Visão analítica {condoFiltro === 'todos' ? 'de todos os condomínios' : `— ${nomeCondo(condoFiltro)}`}
            {' · '}últimos {periodo} dias
            {atualizadoEm && <span style={{ opacity:.7 }}>{' · '}atualizado {atualizadoEm.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })}</span>}
          </p>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <select value={condoFiltro} onChange={e => setCondoFiltro(e.target.value)}
            style={{ background:C.panel, color:C.txt, border:`1px solid ${C.line}`, borderRadius:10, padding:'9px 12px', fontSize:13 }}>
            <option value="todos">Todos os condomínios</option>
            {condominios.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <select value={periodo} onChange={e => setPeriodo(Number(e.target.value))}
            style={{ background:C.panel, color:C.txt, border:`1px solid ${C.line}`, borderRadius:10, padding:'9px 12px', fontSize:13 }}>
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
            <option value={180}>Últimos 6 meses</option>
            <option value={3650}>Todo o período</option>
          </select>
          <button onClick={alternarTelaCheia}
            title={telaCheia ? 'Sair da tela cheia (Esc)' : 'Ver em tela cheia'}
            style={{ background:C.panel, color:C.txt, border:`1px solid ${C.line}`, borderRadius:10,
              padding:'9px 14px', fontSize:13, fontWeight:600, cursor:'pointer',
              display:'flex', alignItems:'center', gap:7 }}>
            {telaCheia ? '✕ Sair' : '⛶ Tela cheia'}
          </button>
        </div>
      </div>

      {/* Totais macro da empresa — só na visão de "Todos os condomínios" */}
      {condoFiltro === 'todos' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:12, marginBottom:20 }}>
          {[
            { icone:'🏢', cor:C.brand, n:totCondominios,  label:'Condomínios cadastrados' },
            { icone:'👥', cor:C.cyan,  n:totMoradores,    label:'Moradores cadastrados' },
            { icone:'⭐', cor:C.slate, n:totConselheiros, label:'Conselheiros cadastrados' },
          ].map((m, i) => (
            <div key={i} style={{ background:C.panel, border:`1px solid ${C.line}`, borderRadius:14, padding:'16px 18px', display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ width:44, height:44, borderRadius:12, background:`${m.cor}22`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>{m.icone}</div>
              <div>
                <div style={{ fontSize:28, fontWeight:700, letterSpacing:'-.02em', lineHeight:1, color:C.txt }}>{m.n}</div>
                <div style={{ color:C.muted, fontSize:11.5, marginTop:5, textTransform:'uppercase', letterSpacing:'.03em' }}>{m.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:12, marginBottom:20 }}>
        <Kpi n={kpis.total}      label="Total"           cor={C.txt} />
        <Kpi n={kpis.abertos}    label="Em aberto"       cor="#fbbf24" />
        <Kpi n={kpis.andamento}  label="Em andamento"    cor="#67e8f9" />
        <Kpi n={kpis.aprovacao}  label="Ag. aprovação"   cor="#c4b5fd" />
        <Kpi n={kpis.resolvidos} label="Resolvidos"      cor="#86efac" />
        <Kpi n={kpis.urgentes}   label="Urgentes abertos" cor="#fca5a5" />
      </div>

      {/* Vencimentos próximos */}
      <div style={{ marginBottom:20 }}>
        <Painel titulo="Vencimentos próximos"
          contagem={vencProximos.length ? `${nVencidos} vencido${nVencidos!==1?'s':''} · ${nVencendo} vencendo` : null}>
          {vencProximos.length === 0 ? (
            <div style={{ color:'#86efac', fontSize:13 }}>✅ Nenhum vencimento próximo. Tudo em dia!</div>
          ) : (
            vencProximos.map((item, i) => {
              const st = seloVenc(item.dias)
              const destino = item.tipo === 'fornecedor' ? 'fornecedores' : 'vencimentos'
              return (
                <div key={item.id} onClick={() => onNavigate?.(destino)}
                  style={{ display:'flex', alignItems:'center', gap:12, padding:'9px 6px', cursor:'pointer', borderRadius:8,
                    borderTop: i>0 ? `1px solid ${C.line}` : '' }}
                  onMouseEnter={e => e.currentTarget.style.background=C.panel2}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13.5, fontWeight:600, color:C.txt, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      {item.titulo}
                    </div>
                    <div style={{ fontSize:11.5, color:C.muted, marginTop:3, display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                      <span style={{ padding:'1px 8px', borderRadius:20, background:C.panel2, color:C.muted, fontWeight:600, fontSize:10.5 }}>
                        {item.tipo === 'fornecedor' ? 'Contrato de fornecedor' : 'Vencimento'}
                      </span>
                      <span>{fmtDataBR(item.data)}</span>
                      {item.contexto && <span>· {item.contexto}</span>}
                    </div>
                  </div>
                  <span style={{ fontSize:11.5, fontWeight:700, color:st.cor, background:`${st.cor}22`, padding:'4px 10px', borderRadius:20, whiteSpace:'nowrap', flexShrink:0 }}>
                    {st.texto}
                  </span>
                </div>
              )
            })
          )}
        </Painel>
      </div>

      {/* Indicadores de desempenho */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:12, marginBottom:20 }}>
        <Kpi n={`${taxaResolucao}%`} label="Taxa de resolução"
          cor={taxaResolucao >= 70 ? '#86efac' : taxaResolucao >= 40 ? '#fbbf24' : '#fca5a5'}
          sub={`${base.filter(estaFechado).length} de ${base.length} encerrados`} />
        <Kpi n={tempoMedio != null ? `${tempoMedio.toFixed(1)}d` : '—'} label="Tempo médio de resolução"
          cor={tempoMedio == null ? C.muted : tempoMedio <= 3 ? '#86efac' : tempoMedio <= 7 ? '#fbbf24' : '#fca5a5'}
          sub={fechadosComData.length ? `média de ${fechadosComData.length} chamados` : 'sem dados suficientes'} />
        <Kpi n={parados.length} label="Parados há 7+ dias"
          cor={parados.length ? '#fca5a5' : '#86efac'}
          sub={parados.length ? 'precisam de atenção' : 'nenhum atrasado'} />
      </div>

      {/* Gráficos */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))', gap:14, marginBottom:14 }}>
        <Painel titulo="Situação dos chamados">
          <Donut dados={porStatus} />
        </Painel>

        <Painel titulo="Evolução (6 meses)">
          <Evolucao dados={evolucao} />
        </Painel>

        {condominios.length > 1 && (
          <Painel titulo="Por condomínio" contagem={porCondo.length}>
            <Barras dados={porCondo} />
          </Painel>
        )}

        <Painel titulo="Por categoria" contagem={porCategoria.length}>
          <Barras dados={porCategoria} />
        </Painel>

        {porPrioridade.length > 0 && (
          <Painel titulo="Por prioridade">
            <Barras dados={porPrioridade} />
          </Painel>
        )}
      </div>

      {/* Chamados parados */}
      <Painel titulo="⚠️ Chamados parados há 7 dias ou mais" contagem={parados.length}>
        {parados.length === 0 ? (
          <div style={{ color:'#86efac', fontSize:13 }}>Nenhum chamado parado. Tudo em dia!</div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ color:C.muted, textAlign:'left', fontSize:11, textTransform:'uppercase', letterSpacing:'.04em' }}>
                  <th style={{ padding:'8px 10px 8px 0' }}>Chamado</th>
                  <th style={{ padding:'8px 10px' }}>Condomínio</th>
                  <th style={{ padding:'8px 10px' }}>Situação</th>
                  <th style={{ padding:'8px 0 8px 10px', textAlign:'right' }}>Parado há</th>
                </tr>
              </thead>
              <tbody>
                {parados.map(t => (
                  <tr key={t.id} style={{ borderTop:`1px solid ${C.line}` }}>
                    <td style={{ padding:'10px 10px 10px 0', color:C.txt }}>
                      {t.categoria_personalizada || t.categoria || 'Sem categoria'}
                    </td>
                    <td style={{ padding:'10px', color:C.muted }}>{nomeCondo(t.condominio_id)}</td>
                    <td style={{ padding:'10px' }}>
                      <span style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:6,
                        background:`${CORES_STATUS[t.status]}22`, color:CORES_STATUS[t.status] }}>
                        {STATUS_LABEL[t.status] || t.status}
                      </span>
                    </td>
                    <td style={{ padding:'10px 0 10px 10px', textAlign:'right', fontWeight:700,
                      color: t.dias >= 30 ? '#fca5a5' : t.dias >= 15 ? '#fbbf24' : C.txt }}>
                      {t.dias} dias
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Painel>
    </div>
  )
}
