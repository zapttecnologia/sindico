import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Data e hora fixas: "16/07 14:30"
const fmtDataHora = (d) => {
  if (!d) return '—'
  const dt = new Date(d)
  return dt.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }) + ' ' +
         dt.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })
}

/**
 * ComunicadosRecentes — bloco compacto para o painel inicial do
 * morador e do conselho. Mostra os últimos comunicados (a RLS já
 * limita ao que cada papel pode ver). Clicar em "Ver todos" leva
 * para a tela de comunicados.
 */
export default function ComunicadosRecentes({ onVerTodos, limite = 3 }) {
  const [comunicados, setComunicados] = useState([])
  const [carregado, setCarregado] = useState(false)

  useEffect(() => {
    supabase.from('comunicados')
      .select('id, titulo, mensagem, publico, criado_em, condominios(nome)')
      .order('criado_em', { ascending:false })
      .limit(limite)
      .then(({ data }) => { setComunicados(data || []); setCarregado(true) })
  }, [limite])

  // Não ocupa espaço se não houver comunicados
  if (carregado && comunicados.length === 0) return null

  const badge = (p) => p === 'conselho'
    ? { txt:'⭐ Conselho', bg:'#eef2ff', cor:'#4338ca' }
    : { txt:'👥 Geral', bg:'var(--mint)', cor:'var(--emerald)' }

  return (
    <div className="card" style={{ marginBottom:24, padding:'18px 20px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:18 }}>📢</span>
          <h3 style={{ fontFamily:'var(--font-display)', fontSize:16, fontWeight:700, color:'var(--navy)', margin:0 }}>
            Comunicados recentes
          </h3>
        </div>
        {onVerTodos && (
          <button onClick={onVerTodos}
            style={{ background:'none', border:'none', color:'var(--blue)', fontSize:13, fontWeight:600, cursor:'pointer' }}>
            Ver todos →
          </button>
        )}
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {comunicados.map(c => {
          const bd = badge(c.publico)
          const resumo = (c.mensagem || '').length > 120 ? c.mensagem.slice(0,120) + '…' : c.mensagem
          return (
            <div key={c.id} onClick={onVerTodos}
              style={{ padding:'12px 14px', background:'var(--gray-50)', borderRadius:'var(--r-md)',
                border:'1px solid var(--gray-100)', cursor: onVerTodos ? 'pointer' : 'default' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
                <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:'var(--r-full)', background:bd.bg, color:bd.cor }}>
                  {bd.txt}
                </span>
                <span style={{ fontSize:11, color:'var(--gray-400)', marginLeft:'auto' }}>{fmtDataHora(c.criado_em)}</span>
              </div>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--navy)', marginBottom:2 }}>{c.titulo}</div>
              <div style={{ fontSize:12, color:'var(--gray-500)', lineHeight:1.4 }}>{resumo}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
