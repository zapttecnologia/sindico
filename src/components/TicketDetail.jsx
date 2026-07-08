import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { ticketNumber, fmtDate, STATUS_LABEL, STATUS_ORDER, APROVACAO_LABEL, statusClass, aprovClass } from '../lib/constants'
import ChatPanel from './ChatPanel'
import AnexosPanel from './AnexosPanel'
import VotePanel from './VotePanel'

export default function TicketDetail({ ticket: initialTicket, onBack, onToast }) {
  const { perfil } = useAuth()
  const [ticket, setTicket] = useState(initialTicket)
  const [tab, setTab] = useState('info')
  const [salvando, setSalvando] = useState(false)
  const [showEnviarConselheiros, setShowEnviarConselheiros] = useState(false)
  const [msgConselheiros, setMsgConselheiros] = useState('')

  const recarregar = async () => {
    const { data } = await supabase.from('solicitacoes')
      .select('*, condominios(nome)').eq('id', ticket.id).single()
    if (data) setTicket(data)
  }

  const atualizarStatus = async (novoStatus) => {
    setSalvando(true)
    const { error } = await supabase.from('solicitacoes')
      .update({ status: novoStatus, atualizado_em: new Date().toISOString() }).eq('id', ticket.id)
    setSalvando(false)
    if (error) { onToast('Erro: ' + error.message); return }
    onToast('Status atualizado.')
    await recarregar()
  }

  const enviarParaConselheiros = async () => {
    if (!msgConselheiros.trim()) { onToast('Escreva uma mensagem para os conselheiros.'); return }
    setSalvando(true)
    // Insere a mensagem como nota interna para o contexto
    await supabase.from('notas_internas').insert({
      solicitacao_id: ticket.id, autor_id: perfil.id,
      autor_tipo: 'equipe', autor_nome: perfil.nome,
      texto: '[Para conselheiros] ' + msgConselheiros.trim(),
    })
    // Muda o status de aprovação
    const { error } = await supabase.from('solicitacoes')
      .update({ aprovacao_status: 'aguardando', atualizado_em: new Date().toISOString() }).eq('id', ticket.id)
    setSalvando(false)
    if (error) { onToast('Erro: ' + error.message); return }
    onToast('Enviado para os conselheiros!')
    setShowEnviarConselheiros(false); setMsgConselheiros('')
    await recarregar()
  }

  const decidirAprovacao = async (decisao) => {
    const { error } = await supabase.from('solicitacoes')
      .update({ aprovacao_status: decisao === 'cancelar' ? null : decisao, atualizado_em: new Date().toISOString() })
      .eq('id', ticket.id)
    if (error) { onToast('Erro: ' + error.message); return }
    onToast(decisao === 'cancelar' ? 'Aprovacao cancelada.' : `Marcado como ${decisao}.`)
    await recarregar()
  }

  const statusIdx = STATUS_ORDER.indexOf(ticket.status)
  const cat = ticket.categoria_personalizada || ticket.categoria
  const ehEquipe = perfil?.papel === 'equipe' || perfil?.papel === 'admin'

  const TABS = [
    { id: 'info', label: 'Detalhes' },
    { id: 'mensagens', label: 'Mensagens' },
    { id: 'anexos', label: 'Anexos' },
    ...(ticket.aprovacao_status ? [{ id: 'votos', label: 'Votacao' }] : []),
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
        <button onClick={onBack} style={{ background:'var(--gray-100)', border:'none', borderRadius:'var(--r-md)',
          padding:'8px 14px', fontSize:13, fontWeight:600, color:'var(--gray-600)', cursor:'pointer',
          display:'flex', alignItems:'center', gap:6 }}>
          ← Voltar
        </button>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--gray-400)' }}>
              #{ticketNumber(ticket.id)}
            </span>
            <span className={`badge badge-cat`}>{cat}</span>
            <span className={`status-badge ${statusClass(ticket.status)}`}>{STATUS_LABEL[ticket.status]}</span>
            {ticket.aprovacao_status && (
              <span className={`status-badge ${aprovClass(ticket.aprovacao_status)}`}>
                {APROVACAO_LABEL[ticket.aprovacao_status]}
              </span>
            )}
          </div>
          <div style={{ fontSize:12, color:'var(--gray-400)', marginTop:4 }}>
            {ticket.condominios?.nome} {ticket.bloco ? `· Bloco ${ticket.bloco}` : ''} {ticket.apartamento ? `· Ap. ${ticket.apartamento}` : ''}
            {ticket.nome_solicitante ? ` · ${ticket.nome_solicitante}` : ''}
          </div>
        </div>
      </div>

      {/* Acoes rapidas */}
      {ehEquipe && (
        <div className="card" style={{ marginBottom:16, padding:'16px 20px' }}>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:12 }}>
            Acoes
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {ticket.status === 'recebido' && (
              <button className="btn btn-primary btn-sm" disabled={salvando} onClick={() => atualizarStatus('andamento')}>
                Marcar em andamento
              </button>
            )}
            {ticket.status === 'andamento' && (
              <button className="btn btn-primary btn-sm" disabled={salvando} onClick={() => atualizarStatus('concluido')}>
                Marcar como concluido
              </button>
            )}
            {ticket.status === 'concluido' && (
              <button className="btn btn-ghost btn-sm" disabled={salvando} onClick={() => atualizarStatus('recebido')}>
                Reabrir chamado
              </button>
            )}
            {ticket.status !== 'recebido' && ticket.status !== 'concluido' && (
              <button className="btn btn-ghost btn-sm" disabled={salvando} onClick={() => atualizarStatus('recebido')}>
                Voltar para recebido
              </button>
            )}
            {!ticket.aprovacao_status && (
              <button className="btn btn-ghost btn-sm" onClick={() => setShowEnviarConselheiros(!showEnviarConselheiros)}
                style={{ borderColor:'var(--amber)', color:'var(--amber)' }}>
                Enviar para conselheiros
              </button>
            )}
            {ticket.aprovacao_status === 'aguardando' && (
              <>
                <button className="btn btn-primary btn-sm" onClick={() => decidirAprovacao('aprovado')}>Aprovar</button>
                <button className="btn btn-danger btn-sm" onClick={() => decidirAprovacao('rejeitado')}>Rejeitar</button>
                <button className="btn btn-ghost btn-sm" onClick={() => decidirAprovacao('cancelar')}>Cancelar votacao</button>
              </>
            )}
          </div>

          {showEnviarConselheiros && (
            <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid var(--gray-200)' }}>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--gray-800)', marginBottom:8 }}>
                Mensagem para os conselheiros (explique o contexto da votacao):
              </div>
              <textarea className="input" rows={3} value={msgConselheiros}
                onChange={e => setMsgConselheiros(e.target.value)}
                placeholder="Ex.: Este chamado requer aprovacao do conselho pois envolve obra acima de R$ 5.000..." />
              <div style={{ display:'flex', gap:8, marginTop:10 }}>
                <button className="btn btn-primary btn-sm" disabled={salvando} onClick={enviarParaConselheiros}>
                  {salvando ? 'Enviando...' : 'Enviar para conselheiros'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowEnviarConselheiros(false)}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'2px solid var(--gray-200)', marginBottom:20 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding:'10px 18px', background:'none', border:'none', cursor:'pointer',
            fontSize:13, fontWeight:600,
            color: tab===t.id ? 'var(--emerald)' : 'var(--gray-400)',
            borderBottom: tab===t.id ? '2px solid var(--emerald)' : '2px solid transparent',
            marginBottom:-2,
          }}>{t.label}</button>
        ))}
      </div>

      {/* Tab: Detalhes */}
      {tab === 'info' && (
        <div className="card">
          <div style={{ fontSize:13, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:16 }}>
            Informacoes do chamado
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
            <tbody>
              {[
                ['Categoria', cat],
                ['Status', STATUS_LABEL[ticket.status]],
                ['Aprovacao', ticket.aprovacao_status ? APROVACAO_LABEL[ticket.aprovacao_status] : 'Nao enviado'],
                ['Condominio', ticket.condominios?.nome || '-'],
                ['Bloco', ticket.bloco || '-'],
                ['Apartamento', ticket.apartamento || '-'],
                ['Solicitante', ticket.nome_solicitante || '-'],
                ['Origem', ticket.origem || '-'],
                ['Aberto em', fmtDate(ticket.criado_em)],
                ['Atualizado', fmtDate(ticket.atualizado_em || ticket.criado_em)],
              ].map(([k, v]) => (
                <tr key={k} style={{ borderBottom:'1px solid var(--gray-100)' }}>
                  <td style={{ padding:'10px 0', color:'var(--gray-400)', fontWeight:600, width:'40%' }}>{k}</td>
                  <td style={{ padding:'10px 0', color:'var(--gray-800)' }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {ticket.descricao && (
            <div style={{ marginTop:16, paddingTop:16, borderTop:'1px solid var(--gray-100)' }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>
                Descricao
              </div>
              <p style={{ fontSize:14, color:'var(--gray-800)', lineHeight:1.6, margin:0 }}>{ticket.descricao}</p>
            </div>
          )}
        </div>
      )}

      {tab === 'mensagens' && (
        <div className="card">
          <ChatPanel solicitacaoId={ticket.id} somenteLeitura={false} onToast={onToast} />
        </div>
      )}

      {tab === 'anexos' && (
        <div className="card">
          <AnexosPanel solicitacaoId={ticket.id} onToast={onToast} />
        </div>
      )}

      {tab === 'votos' && ticket.aprovacao_status && (
        <VotePanel
          solicitacaoId={ticket.id}
          aprovacaoStatus={ticket.aprovacao_status}
          podeVotar={false}
          ehSindico={ehEquipe}
          onDecisao={decidirAprovacao}
          onToast={onToast}
        />
      )}
    </div>
  )
}
