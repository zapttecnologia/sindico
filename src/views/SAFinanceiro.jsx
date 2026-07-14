import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import React from 'react'

// Captura erros de render e mostra a mensagem em vez de tela branca
class ErroBoundary extends React.Component {
  constructor(props){ super(props); this.state = { erro:null } }
  static getDerivedStateFromError(erro){ return { erro } }
  componentDidCatch(erro, info){ console.error('Erro no Financeiro:', erro, info) }
  render(){
    if (this.state.erro) {
      return (
        <div style={{ padding:24, background:'#111827', border:'1px solid rgba(239,68,68,.4)', borderRadius:12, color:'#f1f5f9', margin:20 }}>
          <div style={{ fontSize:15, fontWeight:700, color:'#ef4444', marginBottom:8 }}>Algo quebrou ao montar o financeiro</div>
          <div style={{ fontSize:13, color:'#94a3b8', fontFamily:'monospace', whiteSpace:'pre-wrap' }}>{String(this.state.erro?.message || this.state.erro)}</div>
        </div>
      )
    }
    return this.props.children
  }
}

const C = {
  bg:'#0a0d14', surface:'#111827', border:'rgba(255,255,255,.07)',
  text:'#f1f5f9', muted:'#64748b', green:'#22c55e', amber:'#f59e0b',
  red:'#ef4444', blue:'#3b82f6', purple:'#8b5cf6', violet:'#a855f7',
}

function KPI({ label, value, sub, cor, icon, prefix='', suffix='' }) {
  return (
    <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:'20px 22px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
        <span style={{ fontSize:13, fontWeight:600, color:C.muted }}>{label}</span>
        <span style={{ fontSize:20 }}>{icon}</span>
      </div>
      <div style={{ fontFamily:'var(--font-display)', fontSize:32, fontWeight:800, color:cor||C.text, lineHeight:1 }}>
        {prefix}{typeof value==='number'?value.toLocaleString('pt-BR',{minimumFractionDigits:value%1?2:0}):value}{suffix}
      </div>
      {sub && <div style={{ fontSize:12, color:C.muted, marginTop:6 }}>{sub}</div>}
    </div>
  )
}

function StatusBadge({ status }) {
  const map = {
    pendente: { cor:'#f59e0b', bg:'rgba(245,158,11,.15)', label:'Pendente' },
    pago:     { cor:'#22c55e', bg:'rgba(34,197,94,.15)',  label:'Pago' },
    atrasado: { cor:'#ef4444', bg:'rgba(239,68,68,.15)',  label:'Atrasado' },
    cancelado:{ cor:'#64748b', bg:'rgba(100,116,139,.15)',label:'Cancelado' },
  }
  const s = map[status] || map.pendente
  return (
    <span style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:6,
      background:s.bg, color:s.cor }}>
      {s.label}
    </span>
  )
}

// Gráfico de barras: faturado vs recebido (6 meses)
function BarChart6({ dados }) {
  const max = Math.max(1, ...dados.map(d => Math.max(d.faturado, d.recebido)))
  const W = 520, H = 200, pad = 28, bw = (W - pad*2) / dados.length
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:'auto' }}>
      {[0.25,0.5,0.75,1].map(t => (
        <line key={t} x1={pad} y1={H-30-(H-50)*t} x2={W-pad} y2={H-30-(H-50)*t} stroke="rgba(255,255,255,.06)" strokeWidth="1"/>
      ))}
      {dados.map((d,i) => {
        const x = pad + i*bw
        const hF = (H-50) * (d.faturado/max)
        const hR = (H-50) * (d.recebido/max)
        const w = bw*0.32
        return (
          <g key={i}>
            <rect x={x+bw*0.16} y={H-30-hF} width={w} height={hF} rx="3" fill="#3b82f6" opacity="0.85"/>
            <rect x={x+bw*0.52} y={H-30-hR} width={w} height={hR} rx="3" fill="#22c55e"/>
            <text x={x+bw*0.5} y={H-12} fontSize="10" fill="#64748b" textAnchor="middle">{d.mes}</text>
          </g>
        )
      })}
    </svg>
  )
}

// Gráfico donut: composição da receita por plano
function DonutChart({ dados, total }) {
  const cores = ['#8b5cf6','#3b82f6','#22c55e','#f59e0b','#ef4444']
  const R = 70, r = 44, cx = 90, cy = 90
  let ang = -Math.PI/2
  const arcos = dados.map((d,i) => {
    const frac = total>0 ? d.receita/total : 0
    const a0 = ang, a1 = ang + frac*Math.PI*2
    ang = a1
    const x0 = cx+R*Math.cos(a0), y0 = cy+R*Math.sin(a0)
    const x1 = cx+R*Math.cos(a1), y1 = cy+R*Math.sin(a1)
    const xi1 = cx+r*Math.cos(a1), yi1 = cy+r*Math.sin(a1)
    const xi0 = cx+r*Math.cos(a0), yi0 = cy+r*Math.sin(a0)
    const large = frac > 0.5 ? 1 : 0
    const path = `M ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} L ${xi1} ${yi1} A ${r} ${r} 0 ${large} 0 ${xi0} ${yi0} Z`
    return { path, cor:cores[i%cores.length], nome:d.nome, receita:d.receita, frac }
  })
  return (
    <div style={{ display:'flex', gap:18, alignItems:'center', flexWrap:'wrap' }}>
      <svg viewBox="0 0 180 180" style={{ width:150, height:150, flexShrink:0 }}>
        {arcos.map((a,i) => <path key={i} d={a.path} fill={a.cor}/>)}
      </svg>
      <div style={{ flex:1, minWidth:140 }}>
        {arcos.map((a,i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
            <span style={{ width:10, height:10, borderRadius:2, background:a.cor, display:'inline-block' }}/>
            <span style={{ fontSize:12, color:'#f1f5f9', flex:1 }}>{a.nome}</span>
            <span style={{ fontSize:12, fontWeight:700, color:a.cor }}>{Math.round(a.frac*100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Gráfico de linha: fluxo de caixa projetado (30 dias)
function LineChart30({ dados }) {
  const W = 520, H = 180, pad = 34
  if (dados.length === 0) return <div style={{ color:'#64748b', fontSize:13, padding:'20px 0', textAlign:'center' }}>Nenhuma fatura a vencer nos próximos 30 dias.</div>
  const max = Math.max(1, ...dados.map(d => d.valor))
  const x0 = new Date().getTime()
  const xN = x0 + 30*86400000
  const px = (dt) => pad + (W-pad*2) * ((dt.getTime()-x0)/(xN-x0))
  const py = (v) => (H-28) - (H-48)*(v/max)
  const pts = dados.map(d => `${px(d.data)},${py(d.valor)}`)
  const area = `M ${pad},${H-28} L ${pts.join(' L ')} L ${px(dados[dados.length-1].data)},${H-28} Z`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:'auto' }}>
      {[0.25,0.5,0.75,1].map(t => (
        <line key={t} x1={pad} y1={py(max*t)} x2={W-pad} y2={py(max*t)} stroke="rgba(255,255,255,.06)" strokeWidth="1"/>
      ))}
      <path d={area} fill="rgba(139,92,246,.15)"/>
      <polyline points={pts.join(' ')} fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinejoin="round"/>
      {dados.map((d,i) => <circle key={i} cx={px(d.data)} cy={py(d.valor)} r="3" fill="#8b5cf6"/>)}
      <text x={pad} y={H-8} fontSize="10" fill="#64748b">hoje</text>
      <text x={W-pad} y={H-8} fontSize="10" fill="#64748b" textAnchor="end">+30 dias</text>
    </svg>
  )
}

function SAFinanceiroInterno({ empresas, planos }) {
  const [faturas, setFaturas] = useState([])
  const [subSecao, setSubSecao] = useState('overview')
  const [modalNova, setModalNova] = useState(false)
  const [form, setForm] = useState({ empresa_id:'', descricao:'', valor:'', vencimento:'', referencia:'' })
  const [salvando, setSalvando] = useState(false)
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [loading, setLoading] = useState(true)

  const carregar = async () => {
    setLoading(true)
    const { data } = await supabase.from('faturas')
      .select('*, empresas(nome)').order('vencimento', { ascending:true })
    setFaturas(data || [])
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  // ── Cálculos financeiros ──────────────────────────────────
  const empresasAtivas = empresas.filter(e => e.status === 'ativa')
  const mrr = empresasAtivas.reduce((sum, e) => {
    const plano = planos.find(p => p.nome === e.plano_nome)
    return sum + (Number(plano?.valor_mensal) || 0)
  }, 0)
  const arr = mrr * 12
  const churn = empresas.filter(e => e.status === 'cancelada').length
  const churnRate = empresas.length > 0 ? ((churn / empresas.length) * 100).toFixed(1) : 0
  const ticketMedio = empresasAtivas.length > 0 ? mrr / empresasAtivas.length : 0
  const totalInadimplentes = empresas.filter(e => e.status === 'inadimplente').length

  // Receita por plano
  const receitaPorPlano = planos.map(p => {
    const clientes = empresasAtivas.filter(e => e.plano_nome === p.nome)
    return {
      nome: p.nome_exibicao,
      clientes: clientes.length,
      receita: clientes.length * Number(p.valor_mensal),
    }
  }).filter(p => p.clientes > 0).sort((a,b) => b.receita - a.receita)

  // Faturas
  const hoje = new Date()
  const faturasAtrasadas = faturas.filter(f => f.status==='pendente' && new Date(f.vencimento) < hoje)
  const faturasPendentes = faturas.filter(f => f.status==='pendente')
  const totalPendente = faturasPendentes.reduce((s,f) => s+Number(f.valor), 0)
  const totalRecebido = faturas.filter(f=>f.status==='pago').reduce((s,f) => s+Number(f.valor), 0)

  const faturasVisiveis = filtroStatus === 'todos'
    ? faturas
    : filtroStatus === 'atrasado'
      ? faturasAtrasadas
      : faturas.filter(f => f.status === filtroStatus)

  // Próximos 3 meses — previsão de receita
  const previsao = [0,1,2].map(offset => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth()+offset, 1)
    return {
      mes: d.toLocaleDateString('pt-BR',{month:'short', year:'2-digit'}),
      valor: mrr,
      real: offset === 0,
    }
  })

  // ── Série 6 meses: faturado vs recebido ──────────────────
  const MESES_ABREV = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
  const serie6meses = [5,4,3,2,1,0].map(offset => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth()-offset, 1)
    const ym = (dt) => dt.getFullYear()*12 + dt.getMonth()
    const alvo = ym(d)
    const doMes = faturas.filter(f => { const fd = new Date(f.vencimento); return ym(fd) === alvo })
    const faturado = doMes.reduce((s,f)=>s+Number(f.valor||0),0)
    const recebido = doMes.filter(f=>f.status==='pago').reduce((s,f)=>s+Number(f.valor||0),0)
    return { mes:`${MESES_ABREV[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`, faturado, recebido }
  })

  // ── Fluxo próximos 30 dias: a receber acumulado ──────────
  const em30dias = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()+30)
  const aReceber30 = faturas
    .filter(f => f.status!=='pago' && f.status!=='cancelado' && new Date(f.vencimento) >= hoje && new Date(f.vencimento) <= em30dias)
    .sort((a,b)=> new Date(a.vencimento) - new Date(b.vencimento))
  let acc = 0
  const fluxo30 = aReceber30.map(f => { acc += Number(f.valor||0); return { data:new Date(f.vencimento), valor:acc } })
  const totalAReceber30 = acc

  // Inadimplência (faturas atrasadas)
  const totalAtrasado = faturasAtrasadas.reduce((s,f)=>s+Number(f.valor||0),0)
  const baseInadim = totalAtrasado + totalRecebido
  const inadimplenciaPct = baseInadim > 0 ? (totalAtrasado / baseInadim * 100) : 0


  const gerarRelatorio = async () => {
    setGerandoPDF(true)
    try {
      const doc = new jsPDF()
      const W = doc.internal.pageSize.getWidth()
      const hoje = new Date()

      // Header
      doc.setFillColor(40,67,173)
      doc.rect(0,0,W,36,'F')
      doc.setTextColor(255,255,255)
      doc.setFontSize(16); doc.setFont('helvetica','bold')
      doc.text('Relatório Financeiro', 14, 14)
      doc.setFontSize(10); doc.setFont('helvetica','normal')
      doc.text('Portal de Chamados — Central de Administração', 14, 22)
      doc.text(`Gerado em ${hoje.toLocaleDateString('pt-BR')} às ${hoje.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`, W-14, 22, {align:'right'})

      // KPIs
      let y = 46
      doc.setTextColor(30,30,30)
      doc.setFontSize(11); doc.setFont('helvetica','bold')
      doc.text('Resumo financeiro', 14, y); y += 6
      autoTable(doc, {
        startY:y, margin:{left:14,right:14},
        head:[['Métrica','Valor']],
        body:[
          ['MRR (Receita Mensal Recorrente)', `R$ ${mrr.toLocaleString('pt-BR',{minimumFractionDigits:2})}`],
          ['ARR (Receita Anual Recorrente)', `R$ ${arr.toLocaleString('pt-BR',{minimumFractionDigits:2})}`],
          ['Ticket médio por cliente', `R$ ${ticketMedio.toLocaleString('pt-BR',{minimumFractionDigits:2})}`],
          ['Churn rate', `${churnRate}%`],
          ['Clientes ativos', String(empresasAtivas.length)],
          ['Inadimplentes', String(totalInadimplentes)],
          ['A receber (faturas)', `R$ ${totalPendente.toLocaleString('pt-BR',{minimumFractionDigits:2})}`],
          ['Recebido (faturas pagas)', `R$ ${totalRecebido.toLocaleString('pt-BR',{minimumFractionDigits:2})}`],
        ],
        headStyles:{fillColor:[40,67,173],textColor:255,fontStyle:'bold',fontSize:9},
        bodyStyles:{fontSize:9},
        columnStyles:{1:{halign:'right'}},
        theme:'striped',
      })

      // Receita por plano
      y = doc.lastAutoTable.finalY + 10
      doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(40,67,173)
      doc.text('Receita por plano', 14, y); y += 4
      autoTable(doc, {
        startY:y, margin:{left:14,right:14},
        head:[['Plano','Clientes','Valor/mês','Receita mensal','% do MRR']],
        body: planos.map(p=>{
          const cli = empresasAtivas.filter(e=>e.plano_nome===p.nome).length
          const rec = cli * Number(p.valor_mensal)
          return [p.nome_exibicao, String(cli), `R$ ${Number(p.valor_mensal).toLocaleString('pt-BR',{minimumFractionDigits:2})}`, `R$ ${rec.toLocaleString('pt-BR',{minimumFractionDigits:2})}`, mrr>0?`${(rec/mrr*100).toFixed(1)}%`:'0%']
        }),
        headStyles:{fillColor:[40,67,173],textColor:255,fontStyle:'bold',fontSize:9},
        bodyStyles:{fontSize:9},
        theme:'striped',
      })

      // Cobranças
      if (faturas.length > 0) {
        y = doc.lastAutoTable.finalY + 10
        doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(40,67,173)
        doc.text('Cobranças', 14, y); y += 4
        autoTable(doc, {
          startY:y, margin:{left:14,right:14},
          head:[['Cliente','Descrição','Referência','Valor','Vencimento','Status']],
          body: faturas.map(f=>[
            f.empresas?.nome||'—', f.descricao, f.referencia||'—',
            `R$ ${Number(f.valor).toLocaleString('pt-BR',{minimumFractionDigits:2})}`,
            new Date(f.vencimento).toLocaleDateString('pt-BR'),
            f.status,
          ]),
          headStyles:{fillColor:[40,67,173],textColor:255,fontStyle:'bold',fontSize:9},
          bodyStyles:{fontSize:9},
          theme:'striped',
        })
      }

      // Rodapé
      const pages = doc.internal.getNumberOfPages()
      for (let i=1;i<=pages;i++) {
        doc.setPage(i)
        doc.setFontSize(8); doc.setTextColor(150)
        doc.text(`Portal de Chamados · Relatório Financeiro · Página ${i} de ${pages}`, W/2, 291, {align:'center'})
      }

      doc.save(`relatorio_financeiro_${hoje.toLocaleDateString('pt-BR').replace(/\//g,'-')}.pdf`)
    } catch(e) { console.error(e) }
    setGerandoPDF(false)
  }

  const [gerandoCobrancas, setGerandoCobrancas] = useState(false)

  const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

  const gerarCobrancasMensais = async () => {
    const hj = new Date()
    const mesRef = `${MESES_PT[hj.getMonth()]}/${hj.getFullYear()}`
    // Vencimento base no dia 10 do próximo mês; cada empresa pode ter seu próprio dia
    const vencPadrao = new Date(hj.getFullYear(), hj.getMonth()+1, 10).toISOString().split('T')[0]
    const vencDaEmpresa = (emp) => {
      const dia = Number(emp.dia_vencimento)
      if (!dia || dia < 1 || dia > 28) return vencPadrao
      return new Date(hj.getFullYear(), hj.getMonth()+1, dia).toISOString().split('T')[0]
    }
    const empAtivas = empresas.filter(e => e.status === 'ativa')
    const paraGerar = empAtivas.filter(e => {
      const pl = planos.find(p => p.nome === e.plano_nome)
      return pl && Number(pl.valor_mensal) > 0
    })
    if (!paraGerar.length) { return }
    const ok = window.confirm(`Gerar ${paraGerar.length} cobrança${paraGerar.length!==1?'s':''} referente a ${mesRef}?\nVencimento: dia de cada empresa (padrão dia 10).`)
    if (!ok) return
    setGerandoCobrancas(true)
    let criadas = 0, ignoradas = 0
    for (const emp of paraGerar) {
      const { data:exist } = await supabase.from('faturas').select('id').eq('empresa_id', emp.id).eq('referencia', mesRef).maybeSingle()
      if (exist) { ignoradas++; continue }
      const pl = planos.find(p => p.nome === emp.plano_nome)
      await supabase.from('faturas').insert({
        empresa_id: emp.id,
        descricao: `Mensalidade ${pl.nome_exibicao}`,
        valor: Number(pl.valor_mensal),
        vencimento: vencDaEmpresa(emp), referencia: mesRef, status: 'pendente',
      })
      criadas++
    }
    setGerandoCobrancas(false)
    await carregar()
    alert(`✅ ${criadas} cobrança${criadas!==1?'s':''} criada${criadas!==1?'s':''}${ignoradas>0?` · ${ignoradas} já existia${ignoradas!==1?'m':''}`:''}`)
  }

  const criarFatura = async () => {
    if (!form.empresa_id || !form.valor || !form.vencimento) { return }
    setSalvando(true)
    const hoje2 = new Date()
    const status = new Date(form.vencimento) < hoje2 ? 'atrasado' : 'pendente'
    await supabase.from('faturas').insert({ ...form, valor:Number(form.valor), status })
    setSalvando(false)
    setModalNova(false)
    setForm({ empresa_id:'', descricao:'', valor:'', vencimento:'', referencia:'' })
    await carregar()
  }

  const marcarPago = async (id) => {
    await supabase.from('faturas').update({ status:'pago', pago_em:new Date().toISOString().split('T')[0] }).eq('id',id)
    await carregar()
  }

  const cancelarFatura = async (id) => {
    await supabase.from('faturas').update({ status:'cancelado' }).eq('id',id)
    await carregar()
  }

  const fmt = (v) => `R$ ${Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}`

  return (
    <div>
      <div style={{ marginBottom:24, display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:12 }}>
        <div>
          <h2 style={{ margin:0, fontSize:20, fontWeight:800, color:C.text }}>Financeiro</h2>
          <p style={{ margin:'4px 0 0', fontSize:13, color:C.muted }}>Gestão de receitas, cobranças e previsão financeira</p>
        </div>
        <button onClick={gerarRelatorio} disabled={gerandoPDF}
          style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 16px',
            background:'#22c55e', border:'none', borderRadius:8, color:'#fff',
            fontSize:13, fontWeight:700, cursor:'pointer', opacity:gerandoPDF?.6:1 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <polyline points="9 15 12 18 15 15"/>
          </svg>
          {gerandoPDF ? 'Gerando...' : '⬇ Relatório PDF'}
        </button>
      </div>

      {/* Sub-nav */}
      <div style={{ display:'flex', gap:4, marginBottom:24, background:C.surface,
        padding:4, borderRadius:10, width:'fit-content', border:`1px solid ${C.border}` }}>
        {[
          { id:'overview', label:'📊 Visão geral' },
          { id:'receitas', label:'💰 Receitas' },
          { id:'cobrancas', label:'📋 Cobranças' },
          { id:'previsao', label:'🔮 Previsão' },
        ].map(s => (
          <button key={s.id} onClick={()=>setSubSecao(s.id)}
            style={{ padding:'7px 14px', borderRadius:7, border:'none', cursor:'pointer', fontSize:13, fontWeight:600,
              background: subSecao===s.id ? '#7c3aed' : 'transparent',
              color: subSecao===s.id ? '#fff' : C.muted, transition:'all .15s' }}>
            {s.label}
          </button>
        ))}
      </div>

      {/* ── VISÃO GERAL ── */}
      {subSecao === 'overview' && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:14, marginBottom:24 }}>
            <KPI label="MRR" value={mrr} prefix="R$ " cor="#22c55e" icon="📈"
              sub={`${empresasAtivas.length} clientes ativos`} />
            <KPI label="ARR" value={arr} prefix="R$ " cor="#3b82f6" icon="🎯"
              sub="Receita anual recorrente" />
            <KPI label="Ticket médio" value={ticketMedio} prefix="R$ " cor="#8b5cf6" icon="📊"
              sub="Por cliente ativo" />
            <KPI label="Churn rate" value={churnRate} suffix="%" cor={churnRate>5?'#ef4444':'#22c55e'} icon="📉"
              sub={`${churn} cancelamentos`} />
            <KPI label="Inadimplentes" value={totalInadimplentes} cor={totalInadimplentes>0?'#ef4444':'#22c55e'} icon="⚠️"
              sub="Clientes em atraso" />
            <KPI label="A receber" value={totalPendente} prefix="R$ " cor="#f59e0b" icon="💸"
              sub={`${faturasPendentes.length} fatura${faturasPendentes.length!==1?'s':''} pendente${faturasPendentes.length!==1?'s':''}`} />
            <KPI label="Recebido" value={totalRecebido} prefix="R$ " cor="#22c55e" icon="✅"
              sub="Faturas pagas (total)" />
            <KPI label="Inadimplência" value={Number(inadimplenciaPct.toFixed(1))} suffix="%" cor={inadimplenciaPct>0?'#ef4444':'#22c55e'} icon="⚠️"
              sub={`${fmt(totalAtrasado)} em ${faturasAtrasadas.length} fatura${faturasAtrasadas.length!==1?'s':''} atrasada${faturasAtrasadas.length!==1?'s':''}`} />
          </div>

          {/* Receitas vs Recebido — 6 meses */}
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:'20px 22px', marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:8 }}>
              <span style={{ fontSize:14, fontWeight:700, color:C.text }}>Faturado vs Recebido · últimos 6 meses</span>
              <div style={{ display:'flex', gap:16, fontSize:12 }}>
                <span style={{ color:C.muted }}><span style={{ display:'inline-block', width:10, height:10, borderRadius:2, background:'#3b82f6', marginRight:5 }}/>Faturado</span>
                <span style={{ color:C.muted }}><span style={{ display:'inline-block', width:10, height:10, borderRadius:2, background:'#22c55e', marginRight:5 }}/>Recebido</span>
              </div>
            </div>
            <BarChart6 dados={serie6meses} />
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
            {/* Composição da receita por plano (donut) */}
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:'20px 22px' }}>
              <div style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:16 }}>Composição do MRR por plano</div>
              {receitaPorPlano.length === 0
                ? <p style={{ color:C.muted, fontSize:13 }}>Sem dados de planos.</p>
                : <DonutChart dados={receitaPorPlano} total={mrr} />}
            </div>

            {/* Previsão de fluxo — 30 dias */}
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:'20px 22px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:16 }}>
                <span style={{ fontSize:14, fontWeight:700, color:C.text }}>Fluxo projetado · 30 dias</span>
                <span style={{ fontSize:13, fontWeight:700, color:'#8b5cf6' }}>{fmt(totalAReceber30)}</span>
              </div>
              <LineChart30 dados={fluxo30} />
            </div>
          </div>

          {/* Receita por plano (detalhe) */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:'20px 22px' }}>
              <div style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:16 }}>Receita por plano</div>
              {receitaPorPlano.length === 0
                ? <p style={{ color:C.muted, fontSize:13 }}>Sem dados de planos.</p>
                : receitaPorPlano.map((p, i) => {
                  const pct = mrr > 0 ? Math.round(p.receita / mrr * 100) : 0
                  const cores = ['#8b5cf6','#3b82f6','#22c55e','#f59e0b']
                  return (
                    <div key={p.nome} style={{ marginBottom:14 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                        <span style={{ fontSize:13, color:C.text, fontWeight:600 }}>{p.nome}</span>
                        <div style={{ textAlign:'right' }}>
                          <span style={{ fontSize:13, fontWeight:700, color:cores[i%cores.length] }}>{fmt(p.receita)}/mês</span>
                          <span style={{ fontSize:11, color:C.muted, marginLeft:6 }}>{p.clientes} cliente{p.clientes!==1?'s':''}</span>
                        </div>
                      </div>
                      <div style={{ height:6, background:'rgba(255,255,255,.06)', borderRadius:3 }}>
                        <div style={{ height:'100%', width:`${pct}%`, background:cores[i%cores.length], borderRadius:3, transition:'width .5s' }}/>
                      </div>
                      <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>{pct}% da receita</div>
                    </div>
                  )
                })
              }
            </div>

            {/* Alertas financeiros */}
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:'20px 22px' }}>
              <div style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:16 }}>🚨 Atenção</div>
              {faturasAtrasadas.length === 0 && totalInadimplentes === 0
                ? <div style={{ textAlign:'center', padding:'24px 0', color:C.muted }}>
                    <div style={{ fontSize:28, marginBottom:8 }}>✅</div>
                    <div style={{ fontSize:13 }}>Tudo em dia!</div>
                  </div>
                : <>
                  {faturasAtrasadas.slice(0,5).map(f => (
                    <div key={f.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0',
                      borderBottom:`1px solid ${C.border}` }}>
                      <span style={{ fontSize:16 }}>💸</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:C.text }}>{f.empresas?.nome}</div>
                        <div style={{ fontSize:11, color:'#ef4444' }}>
                          Venceu {new Date(f.vencimento).toLocaleDateString('pt-BR')} · {fmt(f.valor)}
                        </div>
                      </div>
                      <button onClick={()=>marcarPago(f.id)}
                        style={{ fontSize:11, padding:'4px 8px', background:'rgba(34,197,94,.15)',
                          border:'1px solid rgba(34,197,94,.3)', color:'#22c55e', borderRadius:5, cursor:'pointer', fontWeight:700 }}>
                        Pago
                      </button>
                    </div>
                  ))}
                </>
              }
            </div>
          </div>
        </div>
      )}

      {/* ── RECEITAS ── */}
      {subSecao === 'receitas' && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:24 }}>
            <KPI label="MRR Total" value={mrr} prefix="R$ " cor="#22c55e" icon="💰"/>
            <KPI label="Recebido (faturas)" value={totalRecebido} prefix="R$ " cor="#3b82f6" icon="✅"/>
            <KPI label="A receber" value={totalPendente} prefix="R$ " cor="#f59e0b" icon="⏳"/>
          </div>

          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:'20px 22px' }}>
            <div style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:16 }}>Distribuição por plano</div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                  {['Plano','Clientes','Valor/mês','Receita mensal','% do MRR'].map(h=>(
                    <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:11, fontWeight:700,
                      color:C.muted, textTransform:'uppercase', letterSpacing:'.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {planos.map((p,i) => {
                  const clientes = empresasAtivas.filter(e=>e.plano_nome===p.nome).length
                  const receita = clientes * Number(p.valor_mensal)
                  const pct = mrr > 0 ? (receita/mrr*100).toFixed(1) : 0
                  if (!clientes && Number(p.valor_mensal)===0) return null
                  return (
                    <tr key={p.id} style={{ borderBottom:`1px solid ${C.border}` }}>
                      <td style={{ padding:'11px 12px', fontWeight:700, color:C.text }}>{p.nome_exibicao}</td>
                      <td style={{ padding:'11px 12px', color:C.muted }}>{clientes}</td>
                      <td style={{ padding:'11px 12px', color:C.muted }}>
                        {Number(p.valor_mensal)===0 ? 'Gratuito' : fmt(p.valor_mensal)}
                      </td>
                      <td style={{ padding:'11px 12px', fontWeight:700, color:'#22c55e' }}>{fmt(receita)}</td>
                      <td style={{ padding:'11px 12px', color:C.muted }}>{pct}%</td>
                    </tr>
                  )
                })}
                <tr style={{ background:'rgba(255,255,255,.03)', borderTop:`2px solid rgba(255,255,255,.1)` }}>
                  <td colSpan={3} style={{ padding:'11px 12px', fontWeight:700, color:C.text }}>Total</td>
                  <td style={{ padding:'11px 12px', fontWeight:800, color:'#22c55e', fontSize:15 }}>{fmt(mrr)}</td>
                  <td style={{ padding:'11px 12px', color:C.muted }}>100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── COBRANÇAS ── */}
      {subSecao === 'cobrancas' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <div style={{ display:'flex', gap:6 }}>
              {['todos','pendente','pago','atrasado','cancelado'].map(s=>(
                <button key={s} onClick={()=>setFiltroStatus(s)}
                  style={{ padding:'6px 12px', borderRadius:7, border:`1px solid ${s===filtroStatus?'#7c3aed':C.border}`,
                    background: s===filtroStatus?'rgba(124,58,237,.2)':'transparent',
                    color: s===filtroStatus?'#a855f7':C.muted, fontSize:12, fontWeight:600, cursor:'pointer',
                    textTransform:'capitalize' }}>
                  {s==='todos'?'Todas':s}
                  {s==='atrasado'&&faturasAtrasadas.length>0&&<span style={{ marginLeft:4, background:'#ef4444', color:'#fff', borderRadius:10, padding:'0 5px', fontSize:10 }}>{faturasAtrasadas.length}</span>}
                </button>
              ))}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={gerarCobrancasMensais} disabled={gerandoCobrancas}
                style={{ padding:'8px 14px', background:'rgba(34,197,94,.15)', border:'1px solid rgba(34,197,94,.3)',
                  borderRadius:8, color:'#22c55e', fontSize:13, fontWeight:700, cursor:'pointer',
                  opacity:gerandoCobrancas?.6:1, display:'flex', alignItems:'center', gap:6 }}>
                ⚡ {gerandoCobrancas?'Gerando...':'Gerar cobranças do mês'}
              </button>
              <button onClick={()=>setModalNova(true)}
                style={{ padding:'8px 16px', background:'#7c3aed', border:'none', borderRadius:8,
                  color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                + Nova cobrança
              </button>
            </div>
          </div>

          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'rgba(255,255,255,.03)', borderBottom:`1px solid ${C.border}` }}>
                  {['Cliente','Descrição','Referência','Valor','Vencimento','Status','Ações'].map(h=>(
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:700,
                      color:C.muted, textTransform:'uppercase', letterSpacing:'.04em', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {faturasVisiveis.length===0 && (
                  <tr><td colSpan={7} style={{ padding:40, textAlign:'center', color:C.muted }}>Nenhuma cobrança encontrada.</td></tr>
                )}
                {faturasVisiveis.map(f => {
                  const atrasada = f.status==='pendente' && new Date(f.vencimento) < hoje
                  return (
                    <tr key={f.id} style={{ borderBottom:`1px solid rgba(255,255,255,.04)` }}>
                      <td style={{ padding:'11px 14px', fontWeight:600, color:C.text }}>{f.empresas?.nome||'—'}</td>
                      <td style={{ padding:'11px 14px', color:C.muted }}>{f.descricao}</td>
                      <td style={{ padding:'11px 14px', color:C.muted }}>{f.referencia||'—'}</td>
                      <td style={{ padding:'11px 14px', fontWeight:700, color:'#22c55e' }}>{fmt(f.valor)}</td>
                      <td style={{ padding:'11px 14px', color: atrasada?'#ef4444':C.muted, fontWeight: atrasada?700:400 }}>
                        {new Date(f.vencimento).toLocaleDateString('pt-BR')}
                        {atrasada && <div style={{ fontSize:10, color:'#ef4444' }}>⚠ Atrasada</div>}
                      </td>
                      <td style={{ padding:'11px 14px' }}><StatusBadge status={atrasada&&f.status==='pendente'?'atrasado':f.status}/></td>
                      <td style={{ padding:'11px 14px' }}>
                        <div style={{ display:'flex', gap:6 }}>
                          {f.status==='pendente'&&(
                            <button onClick={()=>marcarPago(f.id)}
                              style={{ padding:'4px 10px', background:'rgba(34,197,94,.15)', border:'1px solid rgba(34,197,94,.3)',
                                color:'#22c55e', borderRadius:5, cursor:'pointer', fontSize:11, fontWeight:700 }}>
                              Pago ✓
                            </button>
                          )}
                          {f.status!=='cancelado'&&f.status!=='pago'&&(
                            <button onClick={()=>cancelarFatura(f.id)}
                              style={{ padding:'4px 8px', background:'transparent', border:`1px solid ${C.border}`,
                                color:C.muted, borderRadius:5, cursor:'pointer', fontSize:11 }}>
                              Cancelar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── PREVISÃO ── */}
      {subSecao === 'previsao' && (
        <div>
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:'24px', marginBottom:16 }}>
            <div style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:4 }}>Projeção de receita</div>
            <p style={{ fontSize:13, color:C.muted, margin:'0 0 20px' }}>
              Baseado no MRR atual de {fmt(mrr)}, assumindo crescimento zero (conservador).
            </p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
              {previsao.map((p,i) => (
                <div key={p.mes} style={{ background:'rgba(255,255,255,.04)', borderRadius:10, padding:'16px',
                  border:`1px solid ${p.real?'#7c3aed':'rgba(255,255,255,.06)'}` }}>
                  <div style={{ fontSize:12, color:C.muted, marginBottom:4, textTransform:'uppercase', letterSpacing:'.05em' }}>
                    {p.mes} {p.real&&<span style={{ color:'#a855f7', fontWeight:700 }}>· Atual</span>}
                  </div>
                  <div style={{ fontFamily:'var(--font-display)', fontSize:26, fontWeight:800, color:'#22c55e' }}>
                    {fmt(p.valor)}
                  </div>
                  <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>MRR projetado</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background:'rgba(245,158,11,.08)', border:'1px solid rgba(245,158,11,.2)', borderRadius:12, padding:'16px 20px' }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#f59e0b', marginBottom:4 }}>💡 Para melhorar a previsão</div>
            <p style={{ fontSize:13, color:'rgba(255,255,255,.5)', margin:0, lineHeight:1.6 }}>
              Registre as cobranças mensais na aba "Cobranças" e marque como pagas quando receber.
              Isso permitirá análises mais precisas de churn e receita real no futuro.
            </p>
          </div>
        </div>
      )}

      {/* Modal nova cobrança */}
      {modalNova && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:60,
          display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#161b22', border:'1px solid rgba(255,255,255,.1)', borderRadius:16,
            width:'100%', maxWidth:440, padding:'24px 22px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h3 style={{ margin:0, fontSize:16, fontWeight:700, color:C.text }}>Nova cobrança</h3>
              <button onClick={()=>setModalNova(false)} style={{ background:'none', border:'none', color:C.muted, fontSize:20, cursor:'pointer' }}>✕</button>
            </div>
            {[
              { label:'Cliente *', field:'empresa_id', type:'select' },
              { label:'Descrição *', field:'descricao', placeholder:'Ex.: Mensalidade Plano Profissional' },
              { label:'Referência', field:'referencia', placeholder:'Ex.: Julho/2026' },
              { label:'Valor (R$) *', field:'valor', type:'number' },
              { label:'Vencimento *', field:'vencimento', type:'date' },
            ].map(({ label, field, type='text', placeholder }) => (
              <div key={field} style={{ marginBottom:12 }}>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:C.muted,
                  textTransform:'uppercase', letterSpacing:'.04em', marginBottom:4 }}>{label}</label>
                {type==='select'
                  ? <select value={form[field]} onChange={e=>setForm(f=>({...f,[field]:e.target.value}))}
                      style={{ width:'100%', background:'#0d1117', border:'1px solid rgba(255,255,255,.1)',
                        borderRadius:7, padding:'8px 11px', color:C.text, fontSize:13, outline:'none' }}>
                      <option value="">Selecione...</option>
                      {empresas.filter(e=>e.status!=='cancelada').map(e=>(
                        <option key={e.id} value={e.id}>{e.nome}</option>
                      ))}
                    </select>
                  : <input type={type} value={form[field]} placeholder={placeholder}
                      onChange={e=>setForm(f=>({...f,[field]:e.target.value}))}
                      style={{ width:'100%', background:'#0d1117', border:'1px solid rgba(255,255,255,.1)',
                        borderRadius:7, padding:'8px 11px', color:C.text, fontSize:13, outline:'none', boxSizing:'border-box' }}/>
                }
              </div>
            ))}
            <button onClick={criarFatura} disabled={salvando}
              style={{ width:'100%', padding:'11px', background:'#7c3aed', border:'none', borderRadius:8,
                color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', marginTop:8 }}>
              {salvando ? 'Salvando...' : 'Criar cobrança'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Wrapper com error boundary — evita tela branca e mostra o erro
export default function SAFinanceiro(props) {
  return (
    <ErroBoundary>
      <SAFinanceiroInterno {...props} />
    </ErroBoundary>
  )
}
