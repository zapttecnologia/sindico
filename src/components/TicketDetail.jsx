import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { ticketNumber, fmtDate, STATUS_LABEL, STATUS_ORDER, APROVACAO_LABEL, statusClass, aprovClass, DEPARTAMENTOS, PAPEIS_DEPARTAMENTO, PRIORIDADES, PRIORIDADE_LIST, STATUS_DEPT } from '../lib/constants'
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
  const [orcamentos, setOrcamentos] = useState([
    { numero:1, fornecedor:'', fornecedor_id:'', valor:'', tipo:'servico', materiais:'', data_proposta:'', data_validade:'', arquivo:null },
  ])
  const [addOrcamento, setAddOrcamento] = useState(false)
  const [fornecedores, setFornecedores] = useState([])
  const [modalForn, setModalForn] = useState(null)   // { idx, razao_social, ... } cadastro rápido; idx = qual orçamento receberá
  const [statusPendente, setStatusPendente] = useState(null)  // status escolhido, aguardando confirmação/mensagem
  const [msgStatus, setMsgStatus] = useState('')              // mensagem opcional ao mudar status
  const [fechando, setFechando] = useState(false)             // em processo de fechar chamado
  const [enviarResumoConselho, setEnviarResumoConselho] = useState(false)  // enviar resumo aos conselheiros

  // Carrega fornecedores da empresa (para o seletor)
  useEffect(() => {
    if (!perfil?.empresa_id) return
    supabase.from('fornecedores').select('id, razao_social, nome_fantasia')
      .eq('empresa_id', perfil.empresa_id).eq('ativo', true).order('razao_social')
      .then(({ data }) => setFornecedores(data || []))
  }, [perfil?.empresa_id])

  const addOrc = () => {
    if (orcamentos.length >= 3) return
    setOrcamentos(prev => [...prev, { numero:prev.length+1, fornecedor:'', fornecedor_id:'', valor:'', tipo:'servico', materiais:'', data_proposta:'', data_validade:'', arquivo:null }])
  }
  const removeOrc = (idx) => setOrcamentos(prev => prev.filter((_,i)=>i!==idx).map((o,i)=>({...o,numero:i+1})))
  const setOrcField = (idx, field, value) => setOrcamentos(prev => prev.map((o,i)=>i===idx?{...o,[field]:value}:o))

  // Ao escolher um fornecedor do select, preenche id + nome (ou libera digitação manual)
  const escolherFornecedor = (idx, valor) => {
    if (valor === '__manual__') { setOrcField(idx,'fornecedor_id',''); setOrcField(idx,'fornecedor',''); return }
    const f = fornecedores.find(x => x.id === valor)
    setOrcamentos(prev => prev.map((o,i)=> i===idx ? { ...o, fornecedor_id: valor, fornecedor: f ? (f.nome_fantasia || f.razao_social) : o.fornecedor } : o))
  }

  // Cadastro rápido de fornecedor (mínimo) sem sair do fluxo
  const salvarFornecedorRapido = async () => {
    if (!modalForn.razao_social?.trim()) { onToast('Informe o nome do fornecedor.'); return }
    setSalvando(true)
    const { data, error } = await supabase.from('fornecedores').insert({
      empresa_id: perfil.empresa_id,
      tipo_pessoa: modalForn.tipo_pessoa || 'pj',
      razao_social: modalForn.razao_social.trim(),
      cnpj_cpf: modalForn.cnpj_cpf?.trim() || null,
      telefone: modalForn.telefone?.trim() || null,
      email: modalForn.email?.trim() || null,
      ativo: true,
    }).select().single()
    setSalvando(false)
    if (error) { onToast('Erro: ' + error.message); return }
    // adiciona à lista e já seleciona no orçamento que abriu o cadastro
    setFornecedores(prev => [...prev, data].sort((a,b)=>a.razao_social.localeCompare(b.razao_social)))
    const idx = modalForn.idx
    setOrcamentos(prev => prev.map((o,i)=> i===idx ? { ...o, fornecedor_id:data.id, fornecedor:data.razao_social } : o))
    onToast('Fornecedor cadastrado!'); setModalForn(null)
  }

  const recarregar = async () => {
    const { data } = await supabase.from('solicitacoes')
      .select('*, condominios(nome)').eq('id', ticket.id).single()
    if (data) setTicket(data)
  }

  const STATUS_FINAIS = ['resolvido', 'cancelado']

  // Clique num status: abre o painel de confirmação com campo de mensagem
  const escolherStatus = (novoStatus) => {
    if (ticket.status === novoStatus) return
    setStatusPendente(novoStatus)
    setMsgStatus('')
  }

  // Confirma a mudança de status (com mensagem opcional)
  const confirmarStatus = async () => {
    if (!statusPendente) return
    const ehFinal = STATUS_FINAIS.includes(statusPendente)
    setSalvando(true)
    const { error } = await supabase.from('solicitacoes')
      .update({
        status: statusPendente,
        atualizado_em: new Date().toISOString(),
        ...(ehFinal ? { fechado_em: new Date().toISOString() } : {}),
      }).eq('id', ticket.id)
    if (error) { setSalvando(false); onToast('Erro: ' + error.message); return }

    // Registra a mensagem como nota (se houver)
    if (msgStatus.trim()) {
      await supabase.from('notas_internas').insert({
        solicitacao_id: ticket.id, autor_id: perfil.id,
        autor_tipo: 'equipe', autor_nome: perfil.nome,
        texto: `[Status: ${STATUS_LABEL[statusPendente]}] ${msgStatus.trim()}`,
      })
    }

    // Se fechou o chamado (resolvido/cancelado), o e-mail para morador + equipe
    // é enviado automaticamente pelo webhook de banco (notify-new-ticket),
    // acionado pelo próprio UPDATE de status acima.

    // Envio sob demanda do RESUMO aos conselheiros (chamado do conselho / com aprovação)
    let resumoEnviado = false
    if (ehFinal && enviarResumoConselho) {
      try {
        const { data: s } = await supabase.auth.getSession()
        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-new-ticket`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${s.session?.access_token}`,
          },
          body: JSON.stringify({
            evento: 'resumo_conselho',
            solicitacao_id: ticket.id,
            mensagem: msgStatus.trim() || null,
          }),
        })
        const dados = await resp.json().catch(() => ({}))
        if (resp.ok && dados.ok) {
          resumoEnviado = true
        } else {
          console.error('Resumo não enviado:', resp.status, dados)
        }
      } catch (e) {
        console.error('Falha ao enviar resumo ao conselho:', e)
      }
    }

    setSalvando(false)
    onToast(
      !ehFinal ? 'Status atualizado.'
      : resumoEnviado ? 'Chamado fechado e resumo enviado aos conselheiros.'
      : (enviarResumoConselho ? 'Chamado fechado, mas o e-mail de resumo falhou.' : 'Chamado fechado.')
    )
    setStatusPendente(null); setMsgStatus(''); setEnviarResumoConselho(false)
    await recarregar()
  }

  const enviarParaConselheiros = async () => {
    if (!msgConselheiros.trim()) { onToast('Escreva uma mensagem para os conselheiros.'); return }
    const orcsValidos = orcamentos.filter(o => o.fornecedor.trim())
    setSalvando(true)
    // Insere a mensagem como nota interna
    await supabase.from('notas_internas').insert({
      solicitacao_id: ticket.id, autor_id: perfil.id,
      autor_tipo: 'equipe', autor_nome: perfil.nome,
      texto: '[Para conselheiros] ' + msgConselheiros.trim(),
    })
    // Salva orçamentos
    if (orcsValidos.length > 0) {
      await supabase.from('orcamentos').delete().eq('solicitacao_id', ticket.id)
      const { data: inseridos } = await supabase.from('orcamentos').insert(
        orcsValidos.map(o => ({
          solicitacao_id: ticket.id,
          numero: o.numero,
          fornecedor: o.fornecedor.trim(),
          fornecedor_id: o.fornecedor_id || null,
          valor: o.valor ? Number(o.valor) : null,
          tipo: o.tipo || 'servico',
          materiais: o.materiais.trim() || null,
          data_proposta: o.data_proposta || null,
          data_validade: o.data_validade || null,
        }))
      ).select()
      // Sobe o PDF (se houver) de cada orçamento, casando pelo número
      for (const o of orcsValidos) {
        if (!o.arquivo) continue
        const orcInserido = (inseridos || []).find(x => x.numero === o.numero)
        if (!orcInserido) continue
        const nomeSeguro = `${Date.now()}_${o.arquivo.name}`.replace(/[^a-zA-Z0-9._-]/g, '_')
        await supabase.storage.from('anexos-solicitacoes')
          .upload(`${ticket.id}/orcamentos/${orcInserido.id}/${nomeSeguro}`, o.arquivo)
      }
    }
    // Muda status de aprovação
    const { error } = await supabase.from('solicitacoes')
      .update({ aprovacao_status: 'aguardando', atualizado_em: new Date().toISOString() }).eq('id', ticket.id)
    setSalvando(false)
    if (error) { onToast('Erro: ' + error.message); return }
    onToast('Enviado para os conselheiros!')
    setShowEnviarConselheiros(false); setMsgConselheiros('')
    await recarregar()
  }

  const [showAtribuir, setShowAtribuir] = useState(false)
  const [deptSel, setDeptSel] = useState('')
  const [usuariosDept, setUsuariosDept] = useState([])
  const [usuarioSel, setUsuarioSel] = useState('')
  const [msgDept, setMsgDept] = useState('')

  useEffect(() => {
    if (!deptSel) return
    supabase.from('perfis').select('id,nome').eq('papel', deptSel).eq('empresa_id', perfil?.empresa_id)
      .then(({ data }) => setUsuariosDept(data || []))
  }, [deptSel])

  const atribuirDepartamento = async () => {
    if (!deptSel) { onToast('Selecione o departamento.'); return }
    setSalvando(true)
    const { error } = await supabase.from('solicitacoes').update({
      departamento: deptSel,
      atribuido_para: usuarioSel || null,
      atribuido_em: new Date().toISOString(),
      atribuido_por: perfil?.id,
    }).eq('id', ticket.id)
    if (!error && msgDept.trim()) {
      await supabase.from('notas_internas').insert({
        solicitacao_id: ticket.id, autor_id: perfil.id,
        autor_tipo: 'equipe', autor_nome: perfil.nome,
        texto: `[Atribuído para ${DEPARTAMENTOS[deptSel]}] ${msgDept.trim()}`,
      })
    }
    setSalvando(false)
    if (error) { onToast('Erro: '+error.message); return }
    onToast(`Chamado enviado para ${DEPARTAMENTOS[deptSel]}!`)
    setShowAtribuir(false); setDeptSel(''); setUsuarioSel(''); setMsgDept('')
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
            {ticket.origem === 'Portal do conselheiro' && (
              <span style={{ fontSize:11, fontWeight:800, padding:'3px 10px', borderRadius:'var(--r-full)',
                background:'#4338ca', color:'#fff', letterSpacing:'.02em' }}>
                ⭐ CHAMADO DO CONSELHO
              </span>
            )}
            <span className={`badge badge-cat`}>{cat}</span>
            {ticket.subcategoria && (
              <span className="badge" style={{ background:'#eef2ff', color:'#4338ca' }}>{ticket.subcategoria}</span>
            )}
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

      {/* Prioridade */}
      {ehEquipe && (
        <div className="card" style={{ marginBottom:16, padding:'14px 20px' }}>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:12 }}>
            Nível de prioridade
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {PRIORIDADE_LIST.map(k=>{
              const p = PRIORIDADES[k]
              return (
                <button key={k}
                  onClick={async()=>{
                    await supabase.from('solicitacoes').update({ prioridade:k }).eq('id',ticket.id)
                    onToast(`Prioridade: ${p.label}`)
                    await recarregar()
                  }}
                  style={{ padding:'7px 12px', borderRadius:'var(--r-md)', fontWeight:700, fontSize:12, cursor:'pointer',
                    border: ticket.prioridade===k ? `2px solid ${p.cor}` : '2px solid var(--gray-200)',
                    background: ticket.prioridade===k ? p.bg : '#fff',
                    color: ticket.prioridade===k ? p.cor : 'var(--gray-500)' }}>
                  {p.icon} {p.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Status do departamento (se atribuído) */}
      {ticket.departamento && (
        <div className="card" style={{ marginBottom:16, padding:'14px 20px' }}>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>
            Status no departamento: {DEPARTAMENTOS[ticket.departamento]||ticket.departamento}
          </div>
          {ticket.status_departamento ? (
            <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
              <span style={{ fontSize:13, fontWeight:700, padding:'4px 10px', borderRadius:5,
                background: STATUS_DEPT[ticket.status_departamento]?.bg,
                color: STATUS_DEPT[ticket.status_departamento]?.cor }}>
                {STATUS_DEPT[ticket.status_departamento]?.label}
              </span>
              {ticket.status_dept_obs && (
                <span style={{ fontSize:13, color:'var(--gray-500)', fontStyle:'italic' }}>
                  "{ticket.status_dept_obs}"
                </span>
              )}
              {ticket.status_dept_atualizado_em && (
                <span style={{ fontSize:11, color:'var(--gray-400)' }}>
                  · {new Date(ticket.status_dept_atualizado_em).toLocaleDateString('pt-BR')}
                </span>
              )}
            </div>
          ) : (
            <span style={{ fontSize:13, color:'var(--gray-400)' }}>Aguardando início pelo departamento</span>
          )}
        </div>
      )}

      {/* Status do chamado */}
      {ehEquipe && (
        <div className="card" style={{ marginBottom:16, padding:'14px 20px' }}>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:12 }}>
            🔁 Status do chamado
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {STATUS_ORDER.map(s=>(
              <button key={s} disabled={salvando}
                onClick={()=>escolherStatus(s)}
                className={`status-badge ${statusClass(s)}`}
                style={{ padding:'8px 14px', borderRadius:'var(--r-md)', fontWeight:700, fontSize:12,
                  cursor: ticket.status===s ? 'default' : 'pointer',
                  border: (statusPendente||ticket.status)===s ? '2px solid currentColor' : '2px solid transparent',
                  opacity: (statusPendente||ticket.status)===s ? 1 : .75 }}>
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>

          {/* Painel de confirmação com mensagem opcional */}
          {statusPendente && (
            <div style={{ marginTop:14, padding:'14px', background:'var(--gray-50)', borderRadius:'var(--r-md)', border:'1px solid var(--gray-200)' }}>
              {STATUS_FINAIS.includes(statusPendente) ? (
                <div style={{ fontSize:13, fontWeight:700, color:'var(--navy)', marginBottom:8 }}>
                  {statusPendente==='resolvido' ? '✅ Fechar como resolvido' : '🚫 Fechar como cancelado'}
                  <div style={{ fontSize:12, fontWeight:400, color:'var(--gray-500)', marginTop:2 }}>
                    Ao fechar, morador e equipe serão notificados por e-mail.
                  </div>
                </div>
              ) : (
                <div style={{ fontSize:13, fontWeight:700, color:'var(--navy)', marginBottom:8 }}>
                  Alterar status para "{STATUS_LABEL[statusPendente]}"
                </div>
              )}
              <textarea className="input" rows={3} value={msgStatus} onChange={e=>setMsgStatus(e.target.value)}
                placeholder={STATUS_FINAIS.includes(statusPendente)
                  ? 'Mensagem para o morador (opcional) — ex.: o que foi feito, observações...'
                  : 'Adicionar uma mensagem/observação (opcional)'}
                style={{ marginBottom:10 }}/>

              {/* Enviar resumo aos conselheiros — só em fechamento de chamado do conselho ou com aprovação */}
              {STATUS_FINAIS.includes(statusPendente) && (ticket.origem === 'Portal do conselheiro' || ticket.aprovacao_status) && (
                <label style={{ display:'flex', alignItems:'flex-start', gap:8, cursor:'pointer', marginBottom:10,
                  padding:'10px 12px', background:'#f5f3ff', borderRadius:'var(--r-md)', border:'1px solid #ddd6fe' }}>
                  <input type="checkbox" checked={enviarResumoConselho}
                    onChange={e=>setEnviarResumoConselho(e.target.checked)}
                    style={{ width:16, height:16, marginTop:2, cursor:'pointer', flexShrink:0 }}/>
                  <span style={{ fontSize:13, color:'#4338ca' }}>
                    <b>Enviar resumo por e-mail aos conselheiros</b><br/>
                    <span style={{ fontSize:12, color:'#6d28d9' }}>
                      Inclui os dados do chamado, sua mensagem acima{ticket.aprovacao_status ? ' e o placar da votação' : ''}.
                    </span>
                  </span>
                </label>
              )}

              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <button className="btn btn-primary" disabled={salvando} onClick={confirmarStatus}
                  style={{ background: STATUS_FINAIS.includes(statusPendente) ? (statusPendente==='cancelado'?'var(--rust)':'var(--emerald)') : undefined }}>
                  {salvando ? 'Salvando...' : STATUS_FINAIS.includes(statusPendente) ? '🔒 Fechar chamado' : 'Confirmar'}
                </button>
                <button className="btn btn-ghost" disabled={salvando} onClick={()=>{ setStatusPendente(null); setMsgStatus('') }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ações rápidas */}
      {ehEquipe && (
        <div className="card" style={{ marginBottom:16, padding:'16px 20px' }}>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:12 }}>
            Acoes
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {!ticket.aprovacao_status && (
              <button
                onClick={() => { setShowEnviarConselheiros(!showEnviarConselheiros); setShowAtribuir(false) }}
                style={{
                  display:'inline-flex', alignItems:'center', gap:6,
                  padding:'7px 14px', borderRadius:'var(--r-md)', fontSize:13, fontWeight:600,
                  cursor:'pointer', transition:'all .15s', border:'none',
                  background: showEnviarConselheiros ? 'var(--amber)' : 'var(--amber-bg)',
                  color: showEnviarConselheiros ? '#fff' : '#92400e',
                  boxShadow: showEnviarConselheiros ? '0 0 0 3px rgba(245,158,11,.25)' : 'none',
                }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 12l2 2 4-4"/><rect x="3" y="5" width="18" height="14" rx="2"/>
                </svg>
                {showEnviarConselheiros ? '▼ Conselheiros (aberto)' : 'Enviar para conselheiros'}
              </button>
            )}
            <button
              onClick={() => { setShowAtribuir(!showAtribuir); setShowEnviarConselheiros(false) }}
              style={{
                display:'inline-flex', alignItems:'center', gap:6,
                padding:'7px 14px', borderRadius:'var(--r-md)', fontSize:13, fontWeight:600,
                cursor:'pointer', transition:'all .15s', border:'none',
                background: showAtribuir ? '#7c3aed' : ticket.departamento ? '#f5f3ff' : '#f5f3ff',
                color: showAtribuir ? '#fff' : '#6d28d9',
                boxShadow: showAtribuir ? '0 0 0 3px rgba(124,58,237,.2)' : 'none',
              }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
              </svg>
              {showAtribuir
                ? '▼ Departamento (aberto)'
                : ticket.departamento
                  ? `✓ ${DEPARTAMENTOS[ticket.departamento]||ticket.departamento}`
                  : 'Enviar para departamento'
              }
            </button>
            {ticket.aprovacao_status === 'aguardando' && (
              <>
                <button className="btn btn-primary btn-sm" onClick={() => decidirAprovacao('aprovado')}>Aprovar</button>
                <button className="btn btn-danger btn-sm" onClick={() => decidirAprovacao('rejeitado')}>Rejeitar</button>
                <button className="btn btn-ghost btn-sm" onClick={() => decidirAprovacao('cancelar')}>Cancelar votacao</button>
              </>
            )}
          </div>

          {/* Atribuição a departamento */}
          {showAtribuir && (
            <div style={{ marginTop:14, padding:'18px', background:'#faf5ff',
              border:'2px solid #7c3aed', borderRadius:'var(--r-lg)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
                <div style={{ width:28, height:28, borderRadius:'50%', background:'#7c3aed',
                  display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                    <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
                  </svg>
                </div>
                <span style={{ fontSize:14, fontWeight:700, color:'#5b21b6' }}>Enviar para departamento</span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                <div className="field" style={{ margin:0 }}>
                  <label style={{ fontSize:11 }}>Departamento *</label>
                  <select className="input" style={{ fontSize:13 }} value={deptSel} onChange={e=>setDeptSel(e.target.value)}>
                    <option value="">Selecione...</option>
                    {Object.entries(DEPARTAMENTOS).map(([k,v])=>(
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                {deptSel && usuariosDept.length > 0 && (
                  <div className="field" style={{ margin:0 }}>
                    <label style={{ fontSize:11 }}>Responsável (opcional)</label>
                    <select className="input" style={{ fontSize:13 }} value={usuarioSel} onChange={e=>setUsuarioSel(e.target.value)}>
                      <option value="">Qualquer um do departamento</option>
                      {usuariosDept.map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="field" style={{ margin:'0 0 10px' }}>
                <label style={{ fontSize:11 }}>Instrução (opcional)</label>
                <textarea className="input" style={{ fontSize:13 }} rows={2} value={msgDept}
                  onChange={e=>setMsgDept(e.target.value)} placeholder="Descreva o que precisa ser feito..." />
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-sm" style={{ background:'#5b21b6', color:'#fff', border:'none', borderRadius:'var(--r-md)', padding:'7px 14px', fontWeight:600, cursor:'pointer' }}
                  disabled={salvando||!deptSel} onClick={atribuirDepartamento}>
                  {salvando ? 'Enviando...' : 'Enviar'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={()=>setShowAtribuir(false)}>Cancelar</button>
              </div>
            </div>
          )}
          {showEnviarConselheiros && (
            <div style={{ marginTop:14, padding:'18px', background:'#fffbeb',
              border:'2px solid var(--amber)', borderRadius:'var(--r-lg)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
                <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--amber)',
                  display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                    <path d="M9 12l2 2 4-4"/><rect x="3" y="5" width="18" height="14" rx="2"/>
                  </svg>
                </div>
                <span style={{ fontSize:14, fontWeight:700, color:'#92400e' }}>Enviar para conselheiros</span>
              </div>
              <div style={{ fontSize:13, fontWeight:600, color:'#92400e', marginBottom:8 }}>
                Mensagem para os conselheiros:              </div>
              <textarea className="input" rows={2} value={msgConselheiros}
                onChange={e => setMsgConselheiros(e.target.value)}
                placeholder="Descreva o contexto e o que precisa ser votado..." />

              {/* Orçamentos */}
              <div style={{ marginTop:16 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--gray-600)', textTransform:'uppercase',
                  letterSpacing:'.05em', marginBottom:10 }}>
                  Orçamentos (opcional — até 3)
                </div>
                {orcamentos.map((orc, idx) => (
                  <div key={idx} style={{ border:'1px solid var(--gray-200)', borderRadius:'var(--r-lg)',
                    padding:'14px 16px', marginBottom:10, background:'var(--gray-50)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                      <span style={{ fontSize:13, fontWeight:700, color:'var(--emerald)' }}>Orçamento {orc.numero}</span>
                      {orcamentos.length > 1 && (
                        <button onClick={()=>removeOrc(idx)} style={{ background:'none', border:'none', color:'var(--rust)', cursor:'pointer', fontSize:13 }}>
                          Remover
                        </button>
                      )}
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:8 }}>
                      <div className="field" style={{ margin:0 }}>
                        <label style={{ fontSize:11 }}>Fornecedor *</label>
                        <select className="input" style={{ fontSize:13 }}
                          value={orc.fornecedor_id || (orc.fornecedor ? '__manual__' : '')}
                          onChange={e=>escolherFornecedor(idx, e.target.value)}>
                          <option value="">Selecione um fornecedor...</option>
                          {fornecedores.map(f => (
                            <option key={f.id} value={f.id}>{f.nome_fantasia || f.razao_social}</option>
                          ))}
                          <option value="__manual__">✏ Digitar manualmente</option>
                        </select>
                        {/* Campo de texto aparece só quando é digitação manual (sem fornecedor selecionado) */}
                        {!orc.fornecedor_id && (
                          <input className="input" style={{ fontSize:13, marginTop:6 }} value={orc.fornecedor}
                            onChange={e=>setOrcField(idx,'fornecedor',e.target.value)} placeholder="Nome da empresa" />
                        )}
                        <button type="button" onClick={()=>setModalForn({ idx, tipo_pessoa:'pj', razao_social:'', cnpj_cpf:'', telefone:'', email:'' })}
                          style={{ background:'none', border:'none', color:'var(--blue)', fontSize:12, fontWeight:600, cursor:'pointer', padding:'4px 0', marginTop:2 }}>
                          + Cadastrar novo fornecedor
                        </button>
                      </div>
                      <div className="field" style={{ margin:0 }}>
                        <label style={{ fontSize:11 }}>Valor (R$)</label>
                        <input className="input" style={{ fontSize:13 }} type="number" value={orc.valor}
                          onChange={e=>setOrcField(idx,'valor',e.target.value)} placeholder="0,00" />
                      </div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:8 }}>
                      <div className="field" style={{ margin:0 }}>
                        <label style={{ fontSize:11 }}>Tipo</label>
                        <select className="input" style={{ fontSize:13 }} value={orc.tipo} onChange={e=>setOrcField(idx,'tipo',e.target.value)}>
                          <option value="servico">Prestação de serviço</option>
                          <option value="produto">Produto</option>
                        </select>
                      </div>
                      <div className="field" style={{ margin:0 }}>
                        <label style={{ fontSize:11 }}>Materiais inclusos</label>
                        <input className="input" style={{ fontSize:13 }} value={orc.materiais}
                          onChange={e=>setOrcField(idx,'materiais',e.target.value)} placeholder="Descreva (opcional)" />
                      </div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                      <div className="field" style={{ margin:0 }}>
                        <label style={{ fontSize:11 }}>Data da proposta</label>
                        <input className="input" style={{ fontSize:13 }} type="date" value={orc.data_proposta}
                          onChange={e=>setOrcField(idx,'data_proposta',e.target.value)} />
                      </div>
                      <div className="field" style={{ margin:0 }}>
                        <label style={{ fontSize:11 }}>Validade da proposta</label>
                        <input className="input" style={{ fontSize:13 }} type="date" value={orc.data_validade}
                          onChange={e=>setOrcField(idx,'data_validade',e.target.value)} />
                      </div>
                    </div>
                    {/* Anexo da proposta (PDF/imagem) */}
                    <div className="field" style={{ margin:'8px 0 0' }}>
                      <label style={{ fontSize:11 }}>Anexar proposta (PDF/imagem)</label>
                      {orc.arquivo ? (
                        <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'var(--gray-600)' }}>
                          📎 {orc.arquivo.name}
                          <button type="button" onClick={()=>setOrcField(idx,'arquivo',null)}
                            style={{ background:'none', border:'none', color:'var(--rust)', cursor:'pointer', fontSize:14 }}>×</button>
                        </div>
                      ) : (
                        <input type="file" accept=".pdf,image/*" style={{ fontSize:13 }}
                          onChange={e=>{ const f=e.target.files?.[0]; if(f) setOrcField(idx,'arquivo',f); e.target.value='' }} />
                      )}
                    </div>
                  </div>
                ))}
                {orcamentos.length < 3 && (
                  <button onClick={addOrc} className="btn btn-ghost btn-sm" style={{ width:'100%', marginBottom:12 }}>
                    + Adicionar orçamento {orcamentos.length + 1}
                  </button>
                )}
              </div>

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
                ['Departamento', ticket.departamento ? DEPARTAMENTOS[ticket.departamento]||ticket.departamento : 'Nao atribuido'],
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

      {/* Modal: cadastro rápido de fornecedor (sem sair do envio ao conselho) */}
      {modalForn && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalForn(null)}>
          <div className="modal" style={{ maxWidth:440, width:'100%' }}>
            <div className="modal-header">
              <h3 className="modal-title">Novo fornecedor</h3>
              <button className="modal-close" onClick={() => setModalForn(null)}>×</button>
            </div>
            <p style={{ fontSize:12, color:'var(--gray-400)', margin:'0 0 12px' }}>
              Cadastro rápido. Você pode completar os demais dados depois em “Fornecedores”.
            </p>
            <div className="field">
              <label>Tipo</label>
              <div style={{ display:'flex', gap:8 }}>
                {[['pj','Pessoa jurídica'],['pf','Pessoa física']].map(([v,l]) => (
                  <button key={v} type="button" onClick={() => setModalForn(m=>({...m,tipo_pessoa:v}))}
                    className={`chip${modalForn.tipo_pessoa===v?' selected':''}`}>{l}</button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>{modalForn.tipo_pessoa==='pf' ? 'Nome completo *' : 'Razão social *'}</label>
              <input className="input" value={modalForn.razao_social} onChange={e=>setModalForn(m=>({...m,razao_social:e.target.value}))}
                placeholder={modalForn.tipo_pessoa==='pf' ? 'Nome do prestador' : 'Ex.: Elétrica Silva Ltda'} autoFocus />
            </div>
            <div className="field">
              <label>{modalForn.tipo_pessoa==='pf' ? 'CPF' : 'CNPJ'}</label>
              <input className="input" value={modalForn.cnpj_cpf} onChange={e=>setModalForn(m=>({...m,cnpj_cpf:e.target.value}))} placeholder="Opcional" />
            </div>
            <div className="row2" style={{ display:'flex', gap:12 }}>
              <div className="field" style={{ flex:1 }}>
                <label>Telefone</label>
                <input className="input" value={modalForn.telefone} onChange={e=>setModalForn(m=>({...m,telefone:e.target.value}))} placeholder="(00) 00000-0000" />
              </div>
              <div className="field" style={{ flex:1 }}>
                <label>E-mail</label>
                <input className="input" type="email" value={modalForn.email} onChange={e=>setModalForn(m=>({...m,email:e.target.value}))} placeholder="Opcional" />
              </div>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:14 }}>
              <button className="btn btn-ghost" style={{ flex:1 }} onClick={() => setModalForn(null)}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex:1 }} onClick={salvarFornecedorRapido} disabled={salvando}>
                {salvando ? 'Salvando...' : 'Cadastrar e usar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
