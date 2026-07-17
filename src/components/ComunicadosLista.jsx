import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const BUCKET = 'anexos-comunicados'

// Data e hora fixas: "16/07 14:30"
const fmtDataHora = (d) => {
  if (!d) return '—'
  const dt = new Date(d)
  return dt.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }) + ' ' +
         dt.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })
}

/**
 * ComunicadosLista — visualização (somente leitura) dos comunicados.
 * Usada nos portais do morador e do conselho. A RLS do banco já limita
 * o que cada papel enxerga (morador vê 'moradores'; conselho vê ambos).
 */
export default function ComunicadosLista({ onToast }) {
  const [comunicados, setComunicados] = useState([])
  const [loading, setLoading] = useState(true)

  const carregar = async () => {
    setLoading(true)
    const { data } = await supabase.from('comunicados')
      .select('*, condominios(nome), comunicado_anexos(id, nome, caminho)')
      .order('criado_em', { ascending:false })
    if (data) setComunicados(data)
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  const baixarAnexo = async (caminho) => {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(caminho, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    else onToast?.('Não foi possível abrir o anexo.')
  }

  const badgePublico = (p) => p === 'conselho'
    ? { txt:'⭐ Conselho', bg:'#eef2ff', cor:'#4338ca' }
    : { txt:'👥 Comunicado geral', bg:'var(--mint)', cor:'var(--emerald)' }

  return (
    <div>
      <h2 style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:700, color:'var(--navy)', margin:'0 0 4px' }}>
        Comunicados
      </h2>
      <p style={{ fontSize:13, color:'var(--gray-400)', margin:'0 0 20px' }}>Avisos da administração</p>

      {loading ? (
        <div className="empty-state">Carregando...</div>
      ) : comunicados.length === 0 ? (
        <div className="empty-state">Nenhum comunicado no momento.</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {comunicados.map(c => {
            const bd = badgePublico(c.publico)
            const anexos = c.comunicado_anexos || []
            return (
              <div key={c.id} className="card" style={{ padding:'16px 20px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, flexWrap:'wrap' }}>
                  <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:'var(--r-full)', background:bd.bg, color:bd.cor }}>
                    {bd.txt}
                  </span>
                  <span style={{ fontSize:11, color:'var(--gray-400)', marginLeft:'auto' }}>{fmtDataHora(c.criado_em)}</span>
                </div>
                <div style={{ fontSize:16, fontWeight:700, color:'var(--navy)', marginBottom:4 }}>{c.titulo}</div>
                <div style={{ fontSize:14, color:'var(--gray-600)', lineHeight:1.5, whiteSpace:'pre-wrap' }}>{c.mensagem}</div>
                {anexos.length > 0 && (
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:10 }}>
                    {anexos.map(a => (
                      <button key={a.id} onClick={()=>baixarAnexo(a.caminho)}
                        style={{ display:'inline-flex', alignItems:'center', gap:4, background:'var(--gray-100)',
                          border:'none', padding:'5px 12px', borderRadius:'var(--r-full)', fontSize:12, cursor:'pointer', color:'var(--navy)' }}>
                        📎 {a.nome}
                      </button>
                    ))}
                  </div>
                )}
                {c.autor_nome && (
                  <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:10, borderTop:'1px solid var(--gray-100)', paddingTop:8 }}>
                    Publicado por {c.autor_nome}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
