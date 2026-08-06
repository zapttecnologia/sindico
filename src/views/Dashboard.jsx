import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts'

// Cores de status — paleta semântica (idêntica aos pontos dos KPIs)
const COLORS_STATUS = {
  recebido:  '#f59e0b',  // --warning
  andamento: '#3b82f6',  // --accent
  concluido: '#16a34a',  // --success
}

// Paleta categórica validada (CVD-safe, ordem fixa) — ref. skill dataviz
const COLORS_CAT = ['#2a78d6','#eb6834','#1baf7a','#eda100','#e87ba4','#008300','#4a3aa7','#e34948']

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function KPI({ label, value, tone = 'var(--gray-300)', sub }) {
  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)',
      padding:'var(--space-5) var(--space-5)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'var(--space-2)', marginBottom:'var(--space-3)' }}>
        <span style={{ width:8, height:8, borderRadius:'var(--r-full)', background:tone, flexShrink:0 }}/>
        <span style={{ fontSize:11, fontWeight:700, color:'var(--text-subtle)', textTransform:'uppercase',
          letterSpacing:'.05em' }}>{label}</span>
      </div>
      <div style={{ fontFamily:'var(--font-display)', fontSize:32, fontWeight:700, letterSpacing:'-.02em', color:'var(--navy)', lineHeight:1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize:12, color:'var(--text-subtle)', marginTop:'var(--space-2)' }}>{sub}</div>}
    </div>
  )
}

// Ícones de linha monocromáticos (mesmo traço da sidebar) — cor reservada p/ significado
const ico = { width:16, height:16, fill:'none', stroke:'currentColor', strokeWidth:1.8,
  strokeLinecap:'round', strokeLinejoin:'round', viewBox:'0 0 24 24' }
const IcoTrend = () => <svg {...ico}><polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/></svg>
const IcoBuilding = () => <svg {...ico}><rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M10 21v-4h4v4"/><path d="M8 7h.01M12 7h.01M16 7h.01M8 11h.01M12 11h.01M16 11h.01"/></svg>
const IcoPie = () => <svg {...ico}><path d="M21 15.5A9 9 0 1 1 8.5 3"/><path d="M21.5 12A9.5 9.5 0 0 0 12 2.5V12z"/></svg>
const IcoTag = () => <svg {...ico}><path d="M20.6 13.4 12 22l-9-9V4h9l8.6 8.6a1.4 1.4 0 0 1 0 2z"/><circle cx="7.5" cy="7.5" r="1.1"/></svg>
const IcoFlame = () => <svg {...ico}><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.3 1-3a2.5 2.5 0 0 0 2 2.5z"/></svg>
const IcoRank = () => <svg {...ico}><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-1.5 2-2.5S5 14 4 14.5"/></svg>

function SectionTitle({ icon, children }) {
  return (
    <div style={{ fontFamily:'var(--font-display)', fontSize:14, fontWeight:700,
      color:'var(--navy)', margin:'var(--space-7) 0 var(--space-4)',
      display:'flex', alignItems:'center', gap:'var(--space-2)' }}>
      {icon && <span style={{ display:'inline-flex', color:'var(--text-subtle)' }}>{icon}</span>}
      {children}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'#fff', border:'1px solid var(--gray-200)', borderRadius:8,
      padding:'10px 14px', boxShadow:'var(--shadow-md)', fontSize:13 }}>
      <div style={{ fontWeight:700, marginBottom:6, color:'var(--navy)' }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color:p.color, display:'flex', gap:8, alignItems:'center' }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background:p.color, display:'inline-block' }}/>
          {p.name}: <b>{p.value}</b>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard({ onToast }) {
  const { perfil } = useAuth()
  const [tickets, setTickets] = useState([])
  const [condominios, setCondominios] = useState([])
  const [condoFiltro, setCondoFiltro] = useState('todos')
  const [loading, setLoading] = useState(true)
  const ehAdmin = perfil?.papel === 'admin'

  const carregar = async () => {
    setLoading(true)
    const [{ data: t }, { data: c }] = await Promise.all([
      supabase.from('solicitacoes').select('id,status,categoria,condominio_id,aprovacao_status,criado_em'),
      ehAdmin
        ? supabase.from('condominios').select('id,nome').order('nome')
        : supabase.from('sindico_condominios').select('condominio_id,condominios(id,nome)').eq('perfil_id', perfil?.id),
    ])
    if (t) setTickets(t)
    if (c) {
      if (ehAdmin) setCondominios(c)
      else setCondominios(c.map(r => ({ id:r.condominio_id, nome:r.condominios?.nome||'' })))
    }
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  // Recarrega quando a aba volta ao foco (ex.: após fechar um chamado em outra tela)
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

  // Aplicar filtro de condomínio
  const base = condoFiltro === 'todos' ? tickets : tickets.filter(t => t.condominio_id === condoFiltro)

  // KPIs
  const FECHADOS = ['resolvido', 'cancelado']
  const kpis = {
    total:     base.length,
    recebido:  base.filter(t => t.status === 'aberto').length,
    andamento: base.filter(t => t.status === 'em_andamento').length,
    concluido: base.filter(t => FECHADOS.includes(t.status)).length,
    aprovacao: base.filter(t => t.aprovacao_status === 'aguardando').length,
    pendentes: base.filter(t => !FECHADOS.includes(t.status)).length,
  }

  // Gráfico de barras: por condomínio
  const porCondo = condominios.map(c => {
    const t = base.filter(tk => tk.condominio_id === c.id)
    return {
      nome: c.nome.length > 18 ? c.nome.slice(0, 16) + '…' : c.nome,
      nomeCompleto: c.nome,
      Abertos: t.filter(tk => !FECHADOS.includes(tk.status)).length,
      Concluidos: t.filter(tk => FECHADOS.includes(tk.status)).length,
      Total: t.length,
    }
  }).filter(c => c.Total > 0).sort((a, b) => b.Total - a.Total)

  // Pizza: por categoria
  const catMap = {}
  base.forEach(t => {
    const cat = t.categoria || 'Outros'
    catMap[cat] = (catMap[cat] || 0) + 1
  })
  const porCategoria = Object.entries(catMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  // Pizza: por status
  const porStatus = [
    { name:'Aberto', value:kpis.recebido, color:'#f59e0b' },
    { name:'Em andamento', value:kpis.andamento, color:'#3b82f6' },
    { name:'Concluido', value:kpis.concluido, color:'#16a34a' },
  ].filter(s => s.value > 0)

  // Linha: evolução mensal (últimos 6 meses)
  const hoje = new Date()
  const ultimos6 = Array.from({ length:6 }, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - 5 + i, 1)
    return { mes:`${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`, ano:d.getFullYear(), mesNum:d.getMonth(), abertos:0, concluidos:0 }
  })
  base.forEach(t => {
    const d = new Date(t.criado_em)
    const entry = ultimos6.find(m => m.ano===d.getFullYear() && m.mesNum===d.getMonth())
    if (!entry) return
    if (!FECHADOS.includes(t.status)) entry.abertos++; else entry.concluidos++
  })

  // Ranking: top condominios por abertos
  const ranking = [...porCondo].sort((a, b) => b.Abertos - a.Abertos).slice(0, 5)

  // Ranking: top categorias
  const rankingCat = [...porCategoria].slice(0, 5)

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:60, color:'var(--gray-400)' }}>
      Carregando dados...
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 className="page-title" style={{ margin:0 }}>Painel</h1>
          <p className="page-sub">{base.length} chamado{base.length!==1?'s':''} no periodo</p>
        </div>
        {condominios.length > 1 && (
          <select className="input" style={{ width:'auto', minWidth:200 }} value={condoFiltro} onChange={e => setCondoFiltro(e.target.value)}>
            <option value="todos">Todos os condominios</option>
            {condominios.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        )}
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px,1fr))', gap:'var(--space-3)', marginBottom:'var(--space-2)' }}>
        <KPI label="Total" value={kpis.total} tone="var(--gray-400)" />
        <KPI label="Pendentes" value={kpis.pendentes} tone="var(--warning)" sub={`${kpis.recebido} abertos`} />
        <KPI label="Em andamento" value={kpis.andamento} tone="var(--accent)" />
        <KPI label="Ag. aprovacao" value={kpis.aprovacao} tone="var(--purple)" />
        <KPI label="Concluidos" value={kpis.concluido} tone="var(--success)" />
      </div>

      {/* Evolucao mensal */}
      <SectionTitle icon={<IcoTrend/>}>Evolucao mensal</SectionTitle>
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:'20px 16px' }}>
        {base.length === 0
          ? <div className="empty-state" style={{ padding:24 }}>Nenhum chamado para exibir.</div>
          : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={ultimos6} margin={{ top:5, right:20, left:0, bottom:5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="mes" tick={{ fontSize:12, fill:'#888' }} />
                <YAxis allowDecimals={false} tick={{ fontSize:12, fill:'#888' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize:13 }} />
                <Line type="monotone" dataKey="abertos" name="Abertos" stroke="#f59e0b" strokeWidth={2.5} dot={{ r:4 }} />
                <Line type="monotone" dataKey="concluidos" name="Concluidos" stroke="#16a34a" strokeWidth={2.5} dot={{ r:4 }} />
              </LineChart>
            </ResponsiveContainer>
          )
        }
      </div>

      {/* Chamados por condomínio + por status */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(340px,1fr))', gap:'var(--space-5)', marginTop:4 }}>
        {/* Por condomínio */}
        <div>
          <SectionTitle icon={<IcoBuilding/>}>Chamados por condominio</SectionTitle>
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:'20px 8px 12px' }}>
            {porCondo.length === 0
              ? <div className="empty-state" style={{ padding:24 }}>Sem dados.</div>
              : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={porCondo} margin={{ top:0, right:8, left:-16, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="nome" tick={{ fontSize:11, fill:'#888' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize:11, fill:'#888' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize:12 }} />
                    <Bar dataKey="Abertos" fill="#f59e0b" radius={[4,4,0,0]} />
                    <Bar dataKey="Concluidos" fill="#16a34a" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )
            }
          </div>
        </div>

        {/* Por status (pizza) */}
        <div>
          <SectionTitle icon={<IcoPie/>}>Distribuicao por status</SectionTitle>
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:'20px 8px 12px' }}>
            {porStatus.length === 0
              ? <div className="empty-state" style={{ padding:24 }}>Sem dados.</div>
              : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={porStatus} cx="50%" cy="50%" innerRadius={65} outerRadius={105}
                      dataKey="value" nameKey="name" paddingAngle={3}
                      label={({ name, percent }) => `${(percent*100).toFixed(0)}%`}
                      labelLine={false}>
                      {porStatus.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, n]} />
                    <Legend wrapperStyle={{ fontSize:13 }} />
                  </PieChart>
                </ResponsiveContainer>
              )
            }
          </div>
        </div>
      </div>

      {/* Por categoria */}
      <SectionTitle icon={<IcoTag/>}>Chamados por categoria</SectionTitle>
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:'20px 16px 12px' }}>
        {porCategoria.length === 0
          ? <div className="empty-state" style={{ padding:24 }}>Sem dados.</div>
          : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={porCategoria} layout="vertical" margin={{ top:0, right:32, left:110, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize:11, fill:'#888' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize:12, fill:'#555' }} width={110} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="Chamados" radius={[0,4,4,0]}>
                  {porCategoria.map((_, i) => <Cell key={i} fill={COLORS_CAT[i % COLORS_CAT.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )
        }
      </div>

      {/* Rankings lado a lado */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(300px,1fr))', gap:'var(--space-5)', marginTop:4 }}>
        {/* Ranking condomínios */}
        <div>
          <SectionTitle icon={<IcoFlame/>}>Top condominios com chamados abertos</SectionTitle>
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:'16px 20px' }}>
            {ranking.length === 0
              ? <p style={{ fontSize:13, color:'var(--gray-400)', margin:0 }}>Nenhum chamado aberto.</p>
              : ranking.map((c, i) => (
                <div key={c.nome} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0',
                  borderBottom: i<ranking.length-1?'1px solid var(--gray-100)':'' }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', display:'flex', alignItems:'center',
                    justifyContent:'center', fontFamily:'var(--font-display)', fontSize:13, fontWeight:800,
                    background: i===0?'#f59e0b':i===1?'#c0c0c0':i===2?'#cd7f32':'var(--gray-100)',
                    color: i<3?'#fff':'var(--gray-400)', flexShrink:0 }}>
                    {i+1}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--gray-800)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.nomeCompleto}</div>
                    <div style={{ fontSize:11, color:'var(--gray-400)' }}>{c.Total} total</div>
                  </div>
                  <div style={{ fontSize:22, fontWeight:800, color:'#f59e0b', fontFamily:'var(--font-display)' }}>{c.Abertos}</div>
                </div>
              ))
            }
          </div>
        </div>

        {/* Ranking categorias */}
        <div>
          <SectionTitle icon={<IcoRank/>}>Categorias mais solicitadas</SectionTitle>
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:'16px 20px' }}>
            {rankingCat.length === 0
              ? <p style={{ fontSize:13, color:'var(--gray-400)', margin:0 }}>Nenhum chamado.</p>
              : rankingCat.map((c, i) => {
                const pct = kpis.total > 0 ? Math.round((c.value / kpis.total) * 100) : 0
                return (
                  <div key={c.name} style={{ padding:'8px 0', borderBottom:i<rankingCat.length-1?'1px solid var(--gray-100)':'' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                      <span style={{ fontSize:13, fontWeight:600, color:'var(--gray-800)' }}>{c.name}</span>
                      <span style={{ fontSize:13, fontWeight:700, color:COLORS_CAT[i % COLORS_CAT.length] }}>{c.value}</span>
                    </div>
                    <div style={{ height:6, background:'var(--gray-100)', borderRadius:3, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct}%`, background:COLORS_CAT[i % COLORS_CAT.length], borderRadius:3, transition:'width .4s' }}/>
                    </div>
                    <div style={{ fontSize:10, color:'var(--gray-400)', marginTop:3 }}>{pct}% do total</div>
                  </div>
                )
              })
            }
          </div>
        </div>
      </div>
    </div>
  )
}
