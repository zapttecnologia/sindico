import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

const fmtEvento = (inicio, fim, diaInteiro) => {
  if (!inicio) return ''
  const di = new Date(inicio)
  const data = di.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' })
  if (diaInteiro) return `${data} · dia inteiro`
  const hi = di.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })
  if (fim) {
    const df = new Date(fim)
    const hf = df.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })
    if (di.toDateString() === df.toDateString()) return `${data} · ${hi} às ${hf}`
    return `${data} ${hi} → ${df.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})} ${hf}`
  }
  return `${data} · ${hi}`
}

/**
 * AgendaLista — visualização (só leitura) da agenda para morador e
 * conselho. Alterna entre CALENDÁRIO (grade mensal) e LISTA (próximos
 * eventos). A RLS já limita o que cada papel vê.
 */
export default function AgendaLista() {
  const [eventos, setEventos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modo, setModo] = useState('lista')   // 'lista' | 'calendario'
  const [mesRef, setMesRef] = useState(() => { const d = new Date(); return { ano:d.getFullYear(), mes:d.getMonth() } })
  const [diaSel, setDiaSel] = useState(null)

  useEffect(() => {
    supabase.from('eventos')
      .select('*, condominios(nome)')
      .order('inicio', { ascending:true })
      .then(({ data }) => { setEventos(data||[]); setLoading(false) })
  }, [])

  const badge = (p) => p === 'conselho'
    ? { txt:'⭐ Conselho', bg:'#eef2ff', cor:'#4338ca' }
    : { txt:'👥 Geral', bg:'var(--mint)', cor:'var(--emerald)' }

  const CardEvento = ({ e }) => {
    const bd = badge(e.publico)
    return (
      <div className="card" style={{ padding:'14px 18px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, flexWrap:'wrap' }}>
          <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:'var(--r-full)', background:bd.bg, color:bd.cor }}>{bd.txt}</span>
        </div>
        <div style={{ fontSize:16, fontWeight:700, color:'var(--navy)', marginBottom:2 }}>{e.titulo}</div>
        <div style={{ fontSize:13, color:'var(--blue)', fontWeight:600, marginBottom:6 }}>
          🗓️ {fmtEvento(e.inicio, e.fim, e.dia_inteiro)}{e.local ? ` · 📍 ${e.local}` : ''}
        </div>
        {e.descricao && <div style={{ fontSize:13, color:'var(--gray-600)', lineHeight:1.5, whiteSpace:'pre-wrap' }}>{e.descricao}</div>}
      </div>
    )
  }

  // ── Modo LISTA ──
  const agora = new Date()
  const proximos = eventos.filter(e => new Date(e.fim || e.inicio) >= agora)

  // ── Modo CALENDÁRIO ──
  const primeiroDia = new Date(mesRef.ano, mesRef.mes, 1)
  const diasNoMes = new Date(mesRef.ano, mesRef.mes + 1, 0).getDate()
  const offset = primeiroDia.getDay()  // quantos espaços vazios antes do dia 1
  const eventosPorDia = {}
  eventos.forEach(e => {
    const d = new Date(e.inicio)
    if (d.getFullYear() === mesRef.ano && d.getMonth() === mesRef.mes) {
      const dia = d.getDate()
      ;(eventosPorDia[dia] = eventosPorDia[dia] || []).push(e)
    }
  })
  const mudarMes = (delta) => {
    setDiaSel(null)
    let m = mesRef.mes + delta, a = mesRef.ano
    if (m < 0) { m = 11; a-- } else if (m > 11) { m = 0; a++ }
    setMesRef({ ano:a, mes:m })
  }
  const hoje = new Date()
  const ehHoje = (dia) => hoje.getFullYear()===mesRef.ano && hoje.getMonth()===mesRef.mes && hoje.getDate()===dia
  const eventosDiaSel = diaSel ? (eventosPorDia[diaSel] || []) : []

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginBottom:16, flexWrap:'wrap' }}>
        <div>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:700, color:'var(--navy)', margin:'0 0 4px' }}>Agenda</h2>
          <p style={{ fontSize:13, color:'var(--gray-400)', margin:0 }}>Eventos e avisos do condomínio</p>
        </div>
        {/* Alternador calendário / lista */}
        <div style={{ display:'flex', gap:4, background:'var(--gray-100)', borderRadius:'var(--r-md)', padding:3 }}>
          <button onClick={()=>setModo('lista')}
            style={{ border:'none', borderRadius:'var(--r-sm)', padding:'6px 14px', fontSize:13, fontWeight:600, cursor:'pointer',
              background: modo==='lista'?'#fff':'transparent', color: modo==='lista'?'var(--navy)':'var(--gray-500)',
              boxShadow: modo==='lista'?'var(--shadow-sm)':'none' }}>
            ☰ Lista
          </button>
          <button onClick={()=>setModo('calendario')}
            style={{ border:'none', borderRadius:'var(--r-sm)', padding:'6px 14px', fontSize:13, fontWeight:600, cursor:'pointer',
              background: modo==='calendario'?'#fff':'transparent', color: modo==='calendario'?'var(--navy)':'var(--gray-500)',
              boxShadow: modo==='calendario'?'var(--shadow-sm)':'none' }}>
            🗓️ Calendário
          </button>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">Carregando...</div>
      ) : modo === 'lista' ? (
        // ── LISTA ──
        proximos.length === 0
          ? <div className="empty-state">Nenhum evento próximo.</div>
          : <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {proximos.map(e => <CardEvento key={e.id} e={e} />)}
            </div>
      ) : (
        // ── CALENDÁRIO ──
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <button onClick={()=>mudarMes(-1)} style={{ background:'var(--gray-100)', border:'none', borderRadius:'var(--r-md)', width:34, height:34, cursor:'pointer', fontSize:16 }}>‹</button>
            <div style={{ fontFamily:'var(--font-display)', fontSize:16, fontWeight:700, color:'var(--navy)' }}>
              {MESES[mesRef.mes]} {mesRef.ano}
            </div>
            <button onClick={()=>mudarMes(1)} style={{ background:'var(--gray-100)', border:'none', borderRadius:'var(--r-md)', width:34, height:34, cursor:'pointer', fontSize:16 }}>›</button>
          </div>

          <div className="card" style={{ padding:12 }}>
            {/* Cabeçalho dos dias da semana */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom:4 }}>
              {DIAS_SEMANA.map(d => (
                <div key={d} style={{ textAlign:'center', fontSize:11, fontWeight:700, color:'var(--gray-400)', padding:'4px 0' }}>{d}</div>
              ))}
            </div>
            {/* Grade de dias */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4 }}>
              {Array.from({ length: offset }).map((_,i) => <div key={'v'+i} />)}
              {Array.from({ length: diasNoMes }).map((_,i) => {
                const dia = i + 1
                const temEvento = (eventosPorDia[dia] || []).length > 0
                const sel = diaSel === dia
                return (
                  <button key={dia} onClick={()=>setDiaSel(temEvento ? dia : null)}
                    style={{ aspectRatio:'1', border: ehHoje(dia)?'1.5px solid var(--blue)':'1px solid var(--gray-100)',
                      borderRadius:'var(--r-md)', background: sel?'var(--blue)':(temEvento?'#eff6ff':'#fff'),
                      color: sel?'#fff':'var(--navy)', cursor: temEvento?'pointer':'default',
                      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2, position:'relative', padding:0 }}>
                    <span style={{ fontSize:13, fontWeight: ehHoje(dia)?700:500 }}>{dia}</span>
                    {temEvento && <span style={{ width:5, height:5, borderRadius:'50%', background: sel?'#fff':'var(--blue)' }} />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Eventos do dia selecionado */}
          {diaSel && (
            <div style={{ marginTop:16 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>
                {diaSel} de {MESES[mesRef.mes]}
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {eventosDiaSel.map(e => <CardEvento key={e.id} e={e} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
