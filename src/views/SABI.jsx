import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const FECHADOS = ['resolvido','cancelado']

const CORES_STATUS = {
  aberto:'#f59e0b', em_analise:'#3b82f6', em_andamento:'#06b6d4',
  aguardando_terceiro:'#a855f7', resolvido:'#22c55e', cancelado:'#64748b',
}
const STATUS_LABEL = {
  aberto:'Aberto', em_analise:'Em análise', em_andamento:'Em andamento',
  aguardando_terceiro:'Aguardando terceiro', resolvido:'Resolvido', cancelado:'Cancelado',
}

// ── Blocos visuais (recebem as cores C do tema) ──
function Kpi({ n, label, cor, sub, C }) {
  return (
    <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:'16px 18px' }}>
      <div style={{ fontFamily:'var(--font-display)', fontSize:28, fontWeight:800, lineHeight:1, color:cor||C.text }}>{n}</div>
      <div style={{ color:C.muted, fontSize:11, marginTop:6, fontWeight:600, textTransform:'uppercase', letterSpacing:'.04em' }}>{label}</div>
      {sub && <div style={{ color:C.muted, fontSize:11, marginTop:3, opacity:.8 }}>{sub}</div>}
    </div>
  )
}

function Painel({ titulo, children, C }) {
  return (
    <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:18 }}>
      <h3 style={{ margin:'0 0 16px', fontSize:12, color:C.muted, textTransform:'uppercase', letterSpacing:'.05em', fontWeight:700 }}>{titulo}</h3>
      {children}
    </div>
  )
}

function Barras({ dados, C, vazio='Sem dados' }) {
  const max = Math.max(1, ...dados.map(d => d.valor))
  if (!dados.length) return <div style={{ color:C.muted, fontSize:13 }}>{vazio}</div>
  return (
    <div>
      {dados.map((d, i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
          <div title={d.label} style={{ width:130, fontSize:12, color:C.muted, textAlign:'right', flexShrink:0,
            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{d.label}</div>
          <div style={{ flex:1, height:20, background:C.border, borderRadius:5, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${(d.valor/max)*100}%`, background:d.cor||'#3b82f6', borderRadius:5,
              display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:6,
              fontSize:11, fontWeight:700, color:'#fff', minWidth:24 }}>{d.valor}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function Donut({ dados, C }) {
  const total = dados.reduce((s, d) => s + d.valor, 0)
  if (!total) return <div style={{ color:C.muted, fontSize:13 }}>Sem chamados</div>
  let acc = 0
  const partes = dados.filter(d => d.valor > 0).map(d => {
    const ini = (acc/total)*100; acc += d.valor
    return `${d.cor} ${ini}% ${(acc/total)*100}%`
  })
  return (
    <div style={{ display:'flex', alignItems:'center', gap:18, flexWrap:'wrap' }}>
      <div style={{ width:130, height:130, borderRadius:'50%', flexShrink:0,
        background:`conic-gradient(${partes.join(',')})`, position:'relative' }}>
        <div style={{ position:'absolute', inset:'24%', borderRadius:'50%', background:C.surface,
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
          <div style={{ fontSize:20, fontWeight:800, color:C.text, lineHeight:1 }}>{total}</div>
          <div style={{ fontSize:9, color:C.muted, textTransform:'uppercase' }}>total</div>
        </div>
      </div>
      <div style={{ flex:1, minWidth:140 }}>
        {dados.filter(d => d.valor > 0).map((d, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, fontSize:12 }}>
            <span style={{ width:10, height:10, borderRadius:3, background:d.cor, flexShrink:0 }} />
            <span style={{ color:C.muted, flex:1 }}>{d.label}</span>
            <span style={{ color:C.text, fontWeight:700 }}>{d.valor}</span>
            <span style={{ color:C.muted, width:34, textAlign:'right' }}>{Math.round((d.valor/total)*100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Evolucao({ dados, C }) {
  const max = Math.max(1, ...dados.map(d => Math.max(d.abertos, d.fechados)))
  return (
    <div>
      <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:140, marginBottom:10 }}>
        {dados.map((d, i) => (
          <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
            <div style={{ display:'flex', alignItems:'flex-end', gap:3, height:120, width:'100%', justifyContent:'center' }}>
              <div title={`${d.abertos} abertos`} style={{ width:'42%', maxWidth:16, height:`${(d.abertos/max)*100}%`, background:'#3b82f6', borderRadius:'3px 3px 0 0', minHeight:d.abertos?3:0 }} />
              <div title={`${d.fechados} fechados`} style={{ width:'42%', maxWidth:16, height:`${(d.fechados/max)*100}%`, background:'#22c55e', borderRadius:'3px 3px 0 0', minHeight:d.fechados?3:0 }} />
            </div>
            <div style={{ fontSize:10, color:C.muted }}>{d.rotulo}</div>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', gap:16, fontSize:11, color:C.muted, justifyContent:'center' }}>
        <span><span style={{ display:'inline-block', width:9, height:9, borderRadius:2, background:'#3b82f6', marginRight:5 }}/>Abertos</span>
        <span><span style={{ display:'inline-block', width:9, height:9, borderRadius:2, background:'#22c55e', marginRight:5 }}/>Fechados</span>
      </div>
    </div>
  )
}

export default function SABI({ empresas, C }) {
  const [chamados, setChamados] = useState([])
  const [moradoresCount, setMoradoresCount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [empresaFiltro, setEmpresaFiltro] = useState('todas')

  useEffect(() => {
    const carregar = async () => {
      setLoading(true)
      // Chamados de toda a plataforma (campos leves, para os gráficos)
      const { data: ch } = await supabase.from('solicitacoes')
        .select('id,status,categoria,criado_em,fechado_em,condominio_id,condominios(nome,empresa_id)')
        .order('criado_em', { ascending:false }).limit(5000)
      setChamados(ch || [])
      // Total de moradores da plataforma
      const { count } = await supabase.from('perfis')
        .select('id', { count:'exact', head:true }).eq('papel','morador')
      setMoradoresCount(count || 0)
      setLoading(false)
    }
    carregar()
  }, [])

  // Filtra por empresa, se selecionada
  const base = empresaFiltro === 'todas'
    ? chamados
    : chamados.filter(c => c.condominios?.empresa_id === empresaFiltro)

  const estaFechado = c => FECHADOS.includes(c.status)

  // KPIs macro
  const totalCond = empresas.reduce((s,e)=>s+Number(e.total_condominios||0),0)
  const totalChamados = base.length
  const abertos = base.filter(c => !estaFechado(c)).length
  const resolvidos = base.filter(c => c.status==='resolvido').length
  const taxa = totalChamados ? Math.round((base.filter(estaFechado).length/totalChamados)*100) : 0

  // Tempo médio de resolução
  const fechadosData = base.filter(c => estaFechado(c) && c.fechado_em && c.criado_em)
  const tempoMedio = fechadosData.length
    ? (fechadosData.reduce((s,c)=>s+(new Date(c.fechado_em)-new Date(c.criado_em))/86400000,0)/fechadosData.length)
    : null

  // Por status
  const porStatus = Object.keys(CORES_STATUS).map(s => ({
    label: STATUS_LABEL[s], valor: base.filter(c=>c.status===s).length, cor: CORES_STATUS[s],
  }))

  // Evolução 6 meses
  const evolucao = (() => {
    const hoje = new Date(); const meses = []
    for (let i=5;i>=0;i--){ const d=new Date(hoje.getFullYear(),hoje.getMonth()-i,1); meses.push({ ano:d.getFullYear(), mes:d.getMonth(), rotulo:MESES[d.getMonth()], abertos:0, fechados:0 }) }
    base.forEach(c => {
      const cr=new Date(c.criado_em); const m=meses.find(x=>x.ano===cr.getFullYear()&&x.mes===cr.getMonth()); if(m)m.abertos++
      if(c.fechado_em){ const f=new Date(c.fechado_em); const mf=meses.find(x=>x.ano===f.getFullYear()&&x.mes===f.getMonth()); if(mf)mf.fechados++ }
    })
    return meses
  })()

  // Comparativo entre clientes (top por chamados)
  const porCliente = [...empresas]
    .map(e => ({ label:e.nome, valor:Number(e.total_chamados||0), cor:'#a855f7' }))
    .filter(d => d.valor>0).sort((a,b)=>b.valor-a.valor).slice(0,10)

  // Clientes por nº de condomínios
  const porCondominios = [...empresas]
    .map(e => ({ label:e.nome, valor:Number(e.total_condominios||0), cor:'#3b82f6' }))
    .filter(d => d.valor>0).sort((a,b)=>b.valor-a.valor).slice(0,10)

  // Ranking de condomínios por chamados
  const condMap = {}
  base.forEach(c => {
    const nome = c.condominios?.nome || '—'
    condMap[nome] = (condMap[nome]||0)+1
  })
  const porCondominio = Object.entries(condMap)
    .map(([label,valor])=>({ label, valor, cor:'#06b6d4' }))
    .sort((a,b)=>b.valor-a.valor).slice(0,10)

  if (loading) return <div style={{ color:C.muted, padding:20 }}>Carregando análise...</div>

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12, marginBottom:8 }}>
        <div>
          <h2 style={{ margin:'0 0 4px', fontSize:22, fontWeight:800, color:C.text }}>BI · Análise da plataforma</h2>
          <p style={{ margin:0, fontSize:13, color:C.muted }}>Visão macro de operação — chamados, condomínios e clientes</p>
        </div>
        <select value={empresaFiltro} onChange={e=>setEmpresaFiltro(e.target.value)}
          style={{ background:C.surface, color:C.text, border:`1px solid ${C.border}`, borderRadius:10, padding:'9px 12px', fontSize:13 }}>
          <option value="todas">Todos os clientes</option>
          {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
      </div>

      {/* KPIs macro */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, margin:'20px 0' }}>
        <Kpi C={C} n={empresas.length} label="Clientes" cor={C.text} />
        <Kpi C={C} n={totalCond} label="Condomínios" cor="#3b82f6" />
        <Kpi C={C} n={moradoresCount ?? '—'} label="Moradores" cor="#a855f7" />
        <Kpi C={C} n={totalChamados} label="Chamados" cor={C.text} />
        <Kpi C={C} n={abertos} label="Em aberto" cor="#f59e0b" />
        <Kpi C={C} n={`${taxa}%`} label="Taxa de resolução" cor={taxa>=70?'#22c55e':taxa>=40?'#f59e0b':'#ef4444'} />
        <Kpi C={C} n={tempoMedio!=null?`${tempoMedio.toFixed(1)}d`:'—'} label="Tempo médio" cor="#06b6d4" sub={fechadosData.length?`${fechadosData.length} resolvidos`:'sem dados'} />
      </div>

      {/* Gráficos */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(340px,1fr))', gap:14, marginBottom:14 }}>
        <Painel titulo="Chamados por status" C={C}><Donut dados={porStatus} C={C} /></Painel>
        <Painel titulo="Evolução (6 meses)" C={C}><Evolucao dados={evolucao} C={C} /></Painel>
        <Painel titulo="Clientes com mais chamados" C={C}><Barras dados={porCliente} C={C} /></Painel>
        <Painel titulo="Clientes com mais condomínios" C={C}><Barras dados={porCondominios} C={C} /></Painel>
        <Painel titulo="Condomínios com mais chamados" C={C}><Barras dados={porCondominio} C={C} /></Painel>
      </div>
    </div>
  )
}
