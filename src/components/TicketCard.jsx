import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { ticketNumber, fmtDate, STATUS_LABEL, STATUS_ORDER, APROVACAO_LABEL, statusClass, aprovClass, progressSteps } from '../lib/constants'
import { useAuth } from '../context/AuthContext'
import ChatPanel from './ChatPanel'
import AnexosPanel from './AnexosPanel'
import VotePanel from './VotePanel'

export default function TicketCard({ ticket, onUpdate, onToast }) {
  const { perfil } = useAuth()
  const [open, setOpen] = useState(false)
  const [section, setSection] = useState(null) // 'chat' | 'anexos' | 'votos'

  const papel = perfil?.papel
  const ehEquipe = papel === 'equipe' || papel === 'admin'
  const ehConselheiro = papel === 'conselheiro'
  const ehMorador = papel === 'morador'

  const cat = ticket.categoria === 'Outros' && ticket.categoria_personalizada
    ? ticket.categoria_personalizada
    : ticket.categoria

  const statusIdx = STATUS_ORDER.indexOf(ticket.status)
  const nextStatus = STATUS_ORDER[statusIdx + 1]
  const steps = progressSteps(ticket.status)

  const atualizarStatus = async (novoStatus) => {
    const { error } = await supabase.from('solicitacoes')
      .update({ status: novoStatus, atualizado_em: new Date().toISOString() })
      .eq('id', ticket.id)
    if (error) { onToast?.('Erro: ' + error.message); console.error(error); return }
    onToast?.('Status atualizado.')
    onUpdate?.()
  }

  const enviarParaAprovacao = async () => {
    if (!window.confirm('Enviar para votação dos conselheiros?')) return
    const { error } = await supabase.from('solicitacoes')
      .update({ aprovacao_status: 'aguardando', atualizado_em: new Date().toISOString() })
      .eq('id', ticket.id)
    if (error) { onToast?.('Erro: ' + error.message); return }
    onToast?.('Enviado para os conselheiros.')
    onUpdate?.()
  }

  const decidirAprovacao = async (decisao) => {
    const { error } = await supabase.from('solicitacoes')
      .update({ aprovacao_status: decisao === 'cancelar' ? null : decisao, atualizado_em: new Date().toISOString() })
      .eq('id', ticket.id)
    if (error) { onToast?.('Erro: ' + error.message); return }
    onToast?.(decisao === 'cancelar' ? 'Aprovação cancelada.' : `Marcado como ${decisao === 'aprovado' ? 'aprovado' : 'rejeitado'}.`)
    onUpdate?.()
  }

  const toggleSection = (s) => setSection(prev => prev === s ? null : s)

  const local = [
    ticket.condominios?.nome,
    [ticket.bloco, ticket.apartamento].filter(Boolean).join(' - ')
  ].filter(Boolean).join(' · ')

  return (
    <div className="ticket-card">
      <div className="ticket-header">
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            <span className="badge badge-cat">{cat}</span>
            {ticket.aprovacao_status && (
              <span className={`status-badge ${aprovClass(ticket.aprovacao_status)}`}>
                {APROVACAO_LABEL[ticket.aprovacao_status]}
              </span>
            )}
          </div>
          {local && <div className="ticket-unit">{local}</div>}
          {ticket.nome_solicitante && (
            <div style={{ fontSize: 13, color: 'var(--gray-400)', marginTop: 2 }}>
              {ticket.nome_solicitante}{ticket.origem ? ' · ' + ticket.origem : ''}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <span className={`status-badge ${statusClass(ticket.status)}`}>{STATUS_LABEL[ticket.status]}</span>
          <div className="progress-steps">
            {steps.map((s, i) => <div key={i} className={`progress-step${s ? ' ' + s : ''}`} />)}
          </div>
        </div>
      </div>

      <p className="ticket-desc">{ticket.descricao}</p>
      <div className="ticket-meta">
        #{ticketNumber(ticket.id)} · aberto em {fmtDate(ticket.criado_em)}
      </div>

      {/* Ações da equipe */}
      <div className="ticket-actions">
        {ehEquipe && nextStatus && (
          <button className="btn btn-primary btn-sm" onClick={() => atualizarStatus(nextStatus)}>
            Marcar como {STATUS_LABEL[nextStatus]}
          </button>
        )}
        {ehEquipe && ticket.status !== 'recebido' && (
          <button className="btn btn-ghost btn-sm" onClick={() => atualizarStatus('recebido')}>Reabrir</button>
        )}
        {ehEquipe && !ticket.aprovacao_status && (
          <button className="btn btn-ghost btn-sm" onClick={enviarParaAprovacao}>Enviar para conselheiros</button>
        )}
        <button
          className={`btn btn-ghost btn-sm${section === 'chat' ? ' active-toggle' : ''}`}
          onClick={() => toggleSection('chat')}
          style={section === 'chat' ? { borderColor: 'var(--emerald)', color: 'var(--emerald)' } : {}}
        >
          💬 Mensagens
        </button>
        <button
          className={`btn btn-ghost btn-sm${section === 'anexos' ? ' active-toggle' : ''}`}
          onClick={() => toggleSection('anexos')}
          style={section === 'anexos' ? { borderColor: 'var(--emerald)', color: 'var(--emerald)' } : {}}
        >
          📎 Anexos
        </button>
        {(ehEquipe || ehConselheiro) && ticket.aprovacao_status && (
          <button
            className={`btn btn-ghost btn-sm${section === 'votos' ? ' active-toggle' : ''}`}
            onClick={() => toggleSection('votos')}
            style={section === 'votos' ? { borderColor: 'var(--emerald)', color: 'var(--emerald)' } : {}}
          >
            🗳 Votos
          </button>
        )}
      </div>

      {section === 'chat' && (
        <ChatPanel
          solicitacaoId={ticket.id}
          somenteLeitura={ehConselheiro}
          onToast={onToast}
        />
      )}
      {section === 'anexos' && (
        <AnexosPanel solicitacaoId={ticket.id} onToast={onToast} />
      )}
      {section === 'votos' && (ehEquipe || ehConselheiro) && ticket.aprovacao_status && (
        <VotePanel
          solicitacaoId={ticket.id}
          aprovacaoStatus={ticket.aprovacao_status}
          podeVotar={ehConselheiro && ticket.aprovacao_status === 'aguardando'}
          ehSindico={ehEquipe}
          onDecisao={decidirAprovacao}
          onToast={onToast}
        />
      )}
    </div>
  )
}
