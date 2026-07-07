import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { fmtDate } from '../lib/constants'
import { useAuth } from '../context/AuthContext'

export default function ChatPanel({ solicitacaoId, somenteLeitura, onToast }) {
  const { perfil } = useAuth()
  const [msgs, setMsgs] = useState([])
  const [texto, setTexto] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef(null)

  const carregar = async () => {
    const { data } = await supabase
      .from('notas_internas')
      .select('*')
      .eq('solicitacao_id', solicitacaoId)
      .order('criado_em', { ascending: true })
    if (data) setMsgs(data)
  }

  useEffect(() => { carregar() }, [solicitacaoId])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  const enviar = async () => {
    const t = texto.trim()
    if (!t || loading) return
    setLoading(true)
    const ehMorador = perfil.papel === 'morador'
    const { error } = await supabase.from('notas_internas').insert({
      solicitacao_id: solicitacaoId,
      autor_id: perfil.id,
      autor_tipo: ehMorador ? 'morador' : 'equipe',
      autor_nome: perfil.nome || (ehMorador ? 'Morador' : 'Equipe'),
      texto: t,
    })
    if (error) onToast?.('Erro ao enviar: ' + error.message)
    else { setTexto(''); await carregar() }
    setLoading(false)
  }

  return (
    <div className="chat-container">
      <div className="chat-messages" style={{ minHeight: msgs.length ? 60 : 32 }}>
        {msgs.length === 0 && <span style={{ color: 'var(--gray-400)', fontSize: 13 }}>Nenhuma mensagem ainda.</span>}
        {msgs.map(m => (
          <div key={m.id} className={`chat-msg ${m.autor_tipo}`}>
            <div className="chat-bubble">{m.texto}</div>
            <div className="chat-meta">{m.autor_nome || m.autor_tipo} · {fmtDate(m.criado_em)}</div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      {!somenteLeitura && (
        <div className="chat-input-row">
          <input
            className="input"
            style={{ fontSize: 13.5, padding: '9px 12px' }}
            placeholder="Escrever mensagem..."
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && enviar()}
          />
          <button className="btn btn-primary btn-sm" onClick={enviar} disabled={loading || !texto.trim()}>
            Enviar
          </button>
        </div>
      )}
    </div>
  )
}
