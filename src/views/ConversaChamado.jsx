import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { fmtDate } from '../lib/constants'

/**
 * Conversa de um chamado.
 *
 * Props:
 *  - solicitacaoId: id do chamado
 *  - visibilidade: 'morador' | 'conselho' | 'interna'
 *      define quais mensagens carrega E com qual visibilidade grava.
 *  - autorTipo: 'morador' | 'conselheiro' | 'equipe' (quem está escrevendo)
 *  - titulo, placeholder: textos opcionais
 *  - somenteLeitura: se true, não mostra o campo de escrever
 */
export default function ConversaChamado({ solicitacaoId, visibilidade, autorTipo, titulo, placeholder, somenteLeitura }) {
  const { perfil } = useAuth()
  const [msgs, setMsgs] = useState([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [carregando, setCarregando] = useState(true)

  const carregar = async () => {
    const { data } = await supabase.from('notas_internas')
      .select('*')
      .eq('solicitacao_id', solicitacaoId)
      .eq('visibilidade', visibilidade)
      .order('criado_em', { ascending: true })
    setMsgs(data || [])
    setCarregando(false)
  }

  useEffect(() => { if (solicitacaoId) carregar() }, [solicitacaoId, visibilidade])

  const enviar = async () => {
    if (!texto.trim()) return
    setEnviando(true)
    const { error } = await supabase.from('notas_internas').insert({
      solicitacao_id: solicitacaoId,
      autor_id: perfil?.id,
      autor_tipo: autorTipo,
      autor_nome: perfil?.nome,
      texto: texto.trim(),
      visibilidade,
    })
    setEnviando(false)
    if (error) { return }
    setTexto('')
    await carregar()
  }

  const ehMinha = (m) => m.autor_id === perfil?.id

  return (
    <div style={{ borderTop:'1px solid var(--gray-100)', paddingTop:16, marginTop:16 }}>
      <div style={{ fontSize:12, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:12 }}>
        {titulo || 'Mensagens'}
      </div>

      {carregando ? (
        <div style={{ fontSize:13, color:'var(--gray-400)' }}>Carregando...</div>
      ) : msgs.length === 0 ? (
        <div style={{ fontSize:13, color:'var(--gray-400)', marginBottom:12 }}>
          Nenhuma mensagem ainda.
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:14 }}>
          {msgs.map(m => {
            const minha = ehMinha(m)
            return (
              <div key={m.id} style={{ display:'flex', flexDirection:'column',
                alignItems: minha ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth:'85%', background: minha ? '#2843ad' : 'var(--gray-100)',
                  color: minha ? '#fff' : 'var(--navy)', borderRadius:12,
                  borderBottomRightRadius: minha ? 3 : 12, borderBottomLeftRadius: minha ? 12 : 3,
                  padding:'9px 13px', fontSize:14, lineHeight:1.45, whiteSpace:'pre-wrap' }}>
                  {m.texto}
                </div>
                <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:3, padding:'0 4px' }}>
                  {minha ? 'Você' : (m.autor_nome || 'Usuário')} · {fmtDate(m.criado_em)}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!somenteLeitura && (
        <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
          <textarea
            value={texto} onChange={e => setTexto(e.target.value)}
            placeholder={placeholder || 'Escreva uma mensagem...'}
            rows={2}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) enviar() }}
            style={{ flex:1, resize:'vertical', minHeight:42, padding:'10px 12px', fontSize:14,
              border:'1px solid var(--gray-200)', borderRadius:'var(--r-md)', fontFamily:'inherit' }}/>
          <button onClick={enviar} disabled={enviando || !texto.trim()}
            className="btn btn-primary" style={{ whiteSpace:'nowrap', height:42 }}>
            {enviando ? '...' : 'Enviar'}
          </button>
        </div>
      )}
    </div>
  )
}
