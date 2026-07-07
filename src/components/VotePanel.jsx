import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { fmtDate } from '../lib/constants'

export default function VotePanel({ solicitacaoId, aprovacaoStatus, podeVotar, ehSindico, onDecisao, onToast }) {
  const { perfil } = useAuth()
  const [votos, setVotos] = useState([])
  const [obs, setObs] = useState('')
  const [meuVoto, setMeuVoto] = useState(null)
  const [loading, setLoading] = useState(false)

  const carregar = async () => {
    const { data: votosData } = await supabase.from('votos_conselheiros')
      .select('conselheiro_id, voto, observacao, criado_em')
      .eq('solicitacao_id', solicitacaoId)
      .order('criado_em', { ascending: true })
    if (!votosData) return

    const ids = [...new Set(votosData.map(v => v.conselheiro_id))]
    const { data: perfisData } = await supabase.from('perfis').select('id, nome').in('id', ids)
    const nomePorId = Object.fromEntries((perfisData || []).map(p => [p.id, p.nome]))

    const enriquecidos = votosData.map(v => ({ ...v, nome: nomePorId[v.conselheiro_id] || 'Conselheiro' }))
    setVotos(enriquecidos)
    setMeuVoto(enriquecidos.find(v => v.conselheiro_id === perfil?.id) || null)
  }

  useEffect(() => { carregar() }, [solicitacaoId])

  const votar = async (voto) => {
    setLoading(true)
    const { error } = await supabase.from('votos_conselheiros').insert({
      solicitacao_id: solicitacaoId,
      conselheiro_id: perfil.id,
      voto,
      observacao: obs || null,
    })
    if (error) onToast?.('Erro ao votar: ' + error.message)
    else { onToast?.('Voto registrado!'); setObs(''); await carregar() }
    setLoading(false)
  }

  return (
    <div className="vote-panel">
      <h4>Votação dos conselheiros</h4>
      <ul className="vote-list">
        {votos.length === 0
          ? <li style={{ color: 'var(--gray-400)', borderTop: 'none' }}>Nenhum voto registrado ainda.</li>
          : votos.map((v, i) => (
            <li key={i}>
              <span className={`v-${v.voto}`}>{v.voto === 'aprovar' ? '✅ Aprovado' : '❌ Rejeitado'}</span>
              {' '}— {v.nome}{v.observacao ? ` · ${v.observacao}` : ''}
              <span style={{ fontSize: 11, color: 'var(--gray-400)', marginLeft: 6 }}>{fmtDate(v.criado_em)}</span>
            </li>
          ))}
      </ul>

      {/* Botões de votação para conselheiro */}
      {podeVotar && !meuVoto && (
        <div className="vote-actions">
          <input
            className="input"
            placeholder="Observação (opcional)"
            value={obs}
            onChange={e => setObs(e.target.value)}
          />
          <button className="btn btn-primary btn-sm" onClick={() => votar('aprovar')} disabled={loading}>✅ Aprovar</button>
          <button className="btn btn-danger btn-sm" onClick={() => votar('rejeitar')} disabled={loading}>❌ Rejeitar</button>
        </div>
      )}
      {podeVotar && meuVoto && (
        <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: 'var(--moss)' }}>
          Seu voto: {meuVoto.voto === 'aprovar' ? '✅ Aprovado' : '❌ Rejeitado'}
        </div>
      )}

      {/* Decisão final do síndico */}
      {ehSindico && aprovacaoStatus === 'aguardando' && (
        <div className="sindico-decision">
          <div className="sindico-decision-label">Decisão final do síndico</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-sm" onClick={() => onDecisao?.('aprovado')}>✅ Marcar como aprovado</button>
            <button className="btn btn-danger btn-sm" onClick={() => onDecisao?.('rejeitado')}>❌ Marcar como rejeitado</button>
            <button className="btn btn-ghost btn-sm" onClick={() => onDecisao?.('cancelar')}>Cancelar aprovação</button>
          </div>
        </div>
      )}
    </div>
  )
}
