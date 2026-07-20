import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts'

const COLORS_STATUS = {
  recebido:  '#f4a340',
  andamento: '#2843ad',
  concluido: '#22c55e',
}

const COLORS_CAT = ['#2843ad','#5fa9b4','#f4a340','#e85d4a','#8b5cf6','#22c55e','#f59e0b']

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function KPI({ label, value, color, sub }) {
  return (
    <div style={{ background:'#fff', border:'1px solid var(--gray-200)', borderRadius:'var(--r-lg)',
      padding:'18px 20px', boxShadow:'var(--shadow-sm)' }}>
      <div style={{ fontFamily:'var(--font-display)', fontSize:36, fontWeight:800, color, lineHeight:1 }}>
        {value}
      </div>
      <div style={{ fontSize:12, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase',
        letterSpacing:'.06em', marginTop:6 }}>{label}</div>
      {sub && <div style={{ fontSize:12, color:'var(--gray-400)', marginTop:4 }}>{sub}</div>}
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontFamily:'var(--font-display)', fontSize:15, fontWeight:700,
      color:'var(--navy)', margin:'28px 0 14px', display:'flex', alignItems:'center', gap:8 }}>
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
    { name:'Aberto', value:kpis.recebido, color:'#f4a340' },
    { name:'Em andamento', value:kpis.andamento, color:'#2843ad' },
    { name:'Concluido', value:kpis.concluido, color:'#22c55e' },
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
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px,1fr))', gap:12, marginBottom:8 }}>
        <KPI label="Total" value={kpis.total} color="var(--navy)" />
        <KPI label="Pendentes" value={kpis.pendentes} color="#f4a340" sub={`${kpis.recebido} abertos`} />
        <KPI label="Em andamento" value={kpis.andamento} color="#2843ad" />
        <KPI label="Ag. aprovacao" value={kpis.aprovacao} color="#8a5a00" />
        <KPI label="Concluidos" value={kpis.concluido} color="#22c55e" />
      </div>

      {/* Evolucao mensal */}
      <SectionTitle>📈 Evolucao mensal</SectionTitle>
      <div style={{ background:'#fff', border:'1px solid var(--gray-200)', borderRadius:'var(--r-lg)', padding:'20px 16px', boxShadow:'var(--shadow-sm)' }}>
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
                <Line type="monotone" dataKey="abertos" name="Abertos" stroke="#f4a340" strokeWidth={2.5} dot={{ r:4 }} />
                <Line type="monotone" dataKey="concluidos" name="Concluidos" stroke="#22c55e" strokeWidth={2.5} dot={{ r:4 }} />
              </LineChart>
            </ResponsiveContainer>
          )
        }
      </div>

      {/* Chamados por condomínio + por status */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(340px,1fr))', gap:16, marginTop:4 }}>
        {/* Por condomínio */}
        <div>
          <SectionTitle>🏢 Chamados por condominio</SectionTitle>
          <div style={{ background:'#fff', border:'1px solid var(--gray-200)', borderRadius:'var(--r-lg)', padding:'20px 8px 12px', boxShadow:'var(--shadow-sm)' }}>
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
                    <Bar dataKey="Abertos" fill="#f4a340" radius={[4,4,0,0]} />
                    <Bar dataKey="Concluidos" fill="#22c55e" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )
            }
          </div>
        </div>

        {/* Por status (pizza) */}
        <div>
          <SectionTitle>📊 Distribuicao por status</SectionTitle>
          <div style={{ background:'#fff', border:'1px solid var(--gray-200)', borderRadius:'var(--r-lg)', padding:'20px 8px 12px', boxShadow:'var(--shadow-sm)' }}>
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
      <SectionTitle>🏷️ Chamados por categoria</SectionTitle>
      <div style={{ background:'#fff', border:'1px solid var(--gray-200)', borderRadius:'var(--r-lg)', padding:'20px 16px 12px', boxShadow:'var(--shadow-sm)' }}>
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
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(300px,1fr))', gap:16, marginTop:4 }}>
        {/* Ranking condomínios */}
        <div>
          <SectionTitle>🔥 Top condominios com chamados abertos</SectionTitle>
          <div style={{ background:'#fff', border:'1px solid var(--gray-200)', borderRadius:'var(--r-lg)', padding:'16px 20px', boxShadow:'var(--shadow-sm)' }}>
            {ranking.length === 0
              ? <p style={{ fontSize:13, color:'var(--gray-400)', margin:0 }}>Nenhum chamado aberto.</p>
              : ranking.map((c, i) => (
                <div key={c.nome} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0',
                  borderBottom: i<ranking.length-1?'1px solid var(--gray-100)':'' }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', display:'flex', alignItems:'center',
                    justifyContent:'center', fontFamily:'var(--font-display)', fontSize:13, fontWeight:800,
                    background: i===0?'#f4a340':i===1?'#c0c0c0':i===2?'#cd7f32':'var(--gray-100)',
                    color: i<3?'#fff':'var(--gray-400)', flexShrink:0 }}>
                    {i+1}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--gray-800)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.nomeCompleto}</div>
                    <div style={{ fontSize:11, color:'var(--gray-400)' }}>{c.Total} total</div>
                  </div>
                  <div style={{ fontSize:22, fontWeight:800, color:'#f4a340', fontFamily:'var(--font-display)' }}>{c.Abertos}</div>
                </div>
              ))
            }
          </div>
        </div>

        {/* Ranking categorias */}
        <div>
          <SectionTitle>📌 Categorias mais solicitadas</SectionTitle>
          <div style={{ background:'#fff', border:'1px solid var(--gray-200)', borderRadius:'var(--r-lg)', padding:'16px 20px', boxShadow:'var(--shadow-sm)' }}>
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
