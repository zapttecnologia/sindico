import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { fmtDate } from '../lib/constants'

const OPCOES_VOTO = [
  { value:'deferido',          label:'Deferido',                    color:'#16a34a', bg:'#dcfce7', icon:'✅' },
  { value:'deferido_ressalva', label:'Deferido com ressalva',       color:'#d97706', bg:'#fef3c7', icon:'⚠️' },
  { value:'indeferido',        label:'Indeferido',                  color:'#dc2626', bg:'#fee2e2', icon:'❌' },
]

function OrcamentoCard({ orc, selecionado, onSelecionar, readonly }) {
  const tipoLabel = orc.tipo === 'produto' ? 'Produto' : 'Prestação de serviço'
  const vencido = orc.data_validade && new Date(orc.data_validade) < new Date()

  return (
    <div onClick={() => !readonly && onSelecionar(orc.id)}
      style={{
        border: `2px solid ${selecionado ? 'var(--emerald)' : 'var(--gray-200)'}`,
        borderRadius:'var(--r-lg)', padding:'14px 16px', cursor: readonly ? 'default' : 'pointer',
        background: selecionado ? 'var(--mint)' : '#fff',
        transition:'all .15s', position:'relative',
      }}>
      {selecionado && (
        <div style={{ position:'absolute', top:10, right:12, fontSize:18 }}>✓</div>
      )}
      <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6 }}>
        Orçamento {orc.numero}
      </div>
      <div style={{ fontSize:15, fontWeight:700, color:'var(--navy)', marginBottom:4 }}>{orc.fornecedor}</div>
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:8 }}>
        {orc.valor && (
          <span style={{ fontSize:16, fontWeight:800, color:'var(--emerald)' }}>
            R$ {Number(orc.valor).toLocaleString('pt-BR', { minimumFractionDigits:2 })}
          </span>
        )}
        <span style={{ fontSize:12, padding:'2px 8px', borderRadius:5,
          background:'var(--gray-100)', color:'var(--gray-600)', fontWeight:600, alignSelf:'center' }}>
          {tipoLabel}
        </span>
      </div>
      {orc.materiais && (
        <div style={{ fontSize:13, color:'var(--gray-600)', marginBottom:6 }}>
          <b>Materiais:</b> {orc.materiais}
        </div>
      )}
      <div style={{ display:'flex', gap:16, fontSize:12, color:'var(--gray-400)', flexWrap:'wrap' }}>
        {orc.data_proposta && <span>Proposta: {new Date(orc.data_proposta+'T12:00:00').toLocaleDateString('pt-BR')}</span>}
        {orc.data_validade && (
          <span style={{ color: vencido ? '#dc2626' : 'var(--gray-400)' }}>
            Validade: {new Date(orc.data_validade+'T12:00:00').toLocaleDateString('pt-BR')}
            {vencido && ' ⚠ Vencido'}
          </span>
        )}
      </div>
    </div>
  )
}

export default function VotePanel({ solicitacaoId, aprovacaoStatus, podeVotar, ehSindico, onDecisao, onToast }) {
  const { perfil } = useAuth()
  const [orcamentos, setOrcamentos] = useState([])
  const [votos, setVotos] = useState([])
  const [meuVoto, setMeuVoto] = useState(null)
  const [orcSel, setOrcSel] = useState(null)
  const [observacao, setObservacao] = useState('')
  const [salvando, setSalvando] = useState(false)

  const carregar = async () => {
    const [{ data:orcs }, { data:vts }] = await Promise.all([
      supabase.from('orcamentos').select('*').eq('solicitacao_id', solicitacaoId).order('numero'),
      supabase.from('votos_conselheiros')
        .select('*, orcamentos(fornecedor,numero)')
        .eq('solicitacao_id', solicitacaoId)
        .order('votado_em'),
    ])
    if (orcs) setOrcamentos(orcs)
    if (vts) {
      // Buscar nomes dos conselheiros via perfis separadamente
      const vtsComNome = await Promise.all(vts.map(async v => {
        const { data:p } = await supabase.from('perfis').select('nome').eq('id', v.conselheiro_id).maybeSingle()
        return { ...v, perfis: p || { nome: 'Conselheiro' } }
      }))
      setVotos(vtsComNome)
      const meu = vtsComNome.find(v => v.conselheiro_id === perfil?.id)
      if (meu) { setMeuVoto(meu.voto); setOrcSel(meu.orcamento_id) }
    }
  }

  useEffect(() => { carregar() }, [solicitacaoId])

  const votar = async (opcao) => {
    if (!opcao) return
    setSalvando(true)
    // Upsert voto
    const { error } = await supabase.from('votos_conselheiros').upsert({
      solicitacao_id: solicitacaoId,
      conselheiro_id: perfil.id,
      voto: opcao,
      orcamento_id: orcSel || null,
      observacao: observacao.trim() || null,
      votado_em: new Date().toISOString(),
    }, { onConflict: 'solicitacao_id,conselheiro_id' })
    setSalvando(false)
    if (error) { onToast?.('Erro: '+error.message); return }
    onToast?.('Voto registrado!')
    setMeuVoto(opcao)
    await carregar()
  }

  const opcaoLabel = (v) => OPCOES_VOTO.find(o => o.value === v)?.label || v
  const opcaoCor   = (v) => OPCOES_VOTO.find(o => o.value === v)?.color || '#888'
  const opcaoBg    = (v) => OPCOES_VOTO.find(o => o.value === v)?.bg || '#f5f5f5'
  const opcaoIcon  = (v) => OPCOES_VOTO.find(o => o.value === v)?.icon || '•'

  // Contagem de votos
  const contagem = OPCOES_VOTO.reduce((acc, op) => {
    acc[op.value] = votos.filter(v => v.voto === op.value).length
    return acc
  }, {})

  return (
    <div>
      {/* Orçamentos */}
      {orcamentos.length > 0 && (
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--gray-600)', textTransform:'uppercase',
            letterSpacing:'.05em', marginBottom:12 }}>
            Orçamentos apresentados
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px,1fr))', gap:12 }}>
            {orcamentos.map(orc => (
              <OrcamentoCard
                key={orc.id}
                orc={orc}
                selecionado={orcSel === orc.id}
                onSelecionar={podeVotar && !meuVoto ? setOrcSel : ()=>{}}
                readonly={!podeVotar || !!meuVoto}
              />
            ))}
          </div>
          {podeVotar && !meuVoto && orcamentos.length > 1 && (
            <p style={{ fontSize:12, color:'var(--gray-400)', margin:'8px 0 0' }}>
              Opcional: selecione o orçamento que você prefere antes de votar.
            </p>
          )}
        </div>
      )}

      {/* Meu voto (conselheiro) */}
      {podeVotar && (
        <div style={{ background:'#f8f9ff', border:'1px solid var(--gray-200)', borderRadius:'var(--r-lg)', padding:'16px 18px', marginBottom:20 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--gray-600)', textTransform:'uppercase',
            letterSpacing:'.05em', marginBottom:12 }}>
            {meuVoto ? 'Seu voto foi registrado' : 'Registrar meu voto'}
          </div>

          {meuVoto ? (
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px',
              background: opcaoBg(meuVoto), borderRadius:'var(--r-md)', fontSize:14, fontWeight:600 }}>
              <span style={{ fontSize:18 }}>{opcaoIcon(meuVoto)}</span>
              <span style={{ color: opcaoCor(meuVoto) }}>{opcaoLabel(meuVoto)}</span>
              {orcSel && orcamentos.find(o=>o.id===orcSel) && (
                <span style={{ fontSize:12, color:'var(--gray-400)', marginLeft:4 }}>
                  · Orçamento {orcamentos.find(o=>o.id===orcSel)?.numero}
                </span>
              )}
            </div>
          ) : (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px,1fr))', gap:8, marginBottom:12 }}>
                {OPCOES_VOTO.map(op => (
                  <button key={op.value} onClick={() => votar(op.value)} disabled={salvando}
                    style={{ padding:'12px 10px', borderRadius:'var(--r-md)', border:`2px solid ${op.color}`,
                      background: op.bg, color: op.color, fontWeight:700, fontSize:13,
                      cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                      opacity: salvando ? .6 : 1, transition:'all .15s' }}>
                    {op.icon} {op.label}
                  </button>
                ))}
              </div>
              <div className="field" style={{ margin:0 }}>
                <label style={{ fontSize:12 }}>Observação (opcional)</label>
                <textarea className="input" rows={2} value={observacao} onChange={e=>setObservacao(e.target.value)}
                  placeholder="Adicione uma justificativa ou ressalva..." style={{ fontSize:13 }}/>
              </div>
            </>
          )}
        </div>
      )}

      {/* Placar dos votos */}
      {votos.length > 0 && (
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--gray-600)', textTransform:'uppercase',
            letterSpacing:'.05em', marginBottom:12 }}>
            Resultado dos votos ({votos.length})
          </div>

          {/* Contagem */}
          <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
            {OPCOES_VOTO.filter(op => contagem[op.value] > 0).map(op => (
              <div key={op.value} style={{ padding:'6px 12px', borderRadius:'var(--r-md)',
                background: op.bg, border:`1px solid ${op.color}`, display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ fontSize:14 }}>{op.icon}</span>
                <span style={{ fontWeight:700, color: op.color, fontSize:14 }}>{contagem[op.value]}</span>
                <span style={{ fontSize:12, color: op.color }}>{op.label}</span>
              </div>
            ))}
          </div>

          {/* Detalhes de cada voto */}
          <div style={{ border:'1px solid var(--gray-200)', borderRadius:'var(--r-lg)', overflow:'hidden' }}>
            {votos.map((v, i) => {
              const opc = OPCOES_VOTO.find(o => o.value === v.voto)
              return (
                <div key={v.id} style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'12px 14px',
                  borderBottom: i < votos.length-1 ? '1px solid var(--gray-100)' : '',
                  background: i%2===0 ? '#fff' : 'var(--gray-50)' }}>
                  <div style={{ width:36, height:36, borderRadius:'50%', background: opc?.bg||'var(--gray-100)',
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>
                    {opc?.icon||'•'}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                      <span style={{ fontWeight:700, fontSize:14, color:'var(--gray-800)' }}>
                        {v.perfis?.nome || 'Conselheiro'}
                      </span>
                      <span style={{ fontSize:12, fontWeight:700, color: opc?.color||'#888',
                        background: opc?.bg||'var(--gray-100)', padding:'2px 8px', borderRadius:5 }}>
                        {opc?.label || v.voto}
                      </span>
                    </div>
                    {v.orcamentos && (
                      <div style={{ fontSize:12, color:'var(--gray-500)', marginTop:2 }}>
                        Orçamento selecionado: <b>{v.orcamentos.numero} — {v.orcamentos.fornecedor}</b>
                      </div>
                    )}
                    {v.observacao && (
                      <div style={{ fontSize:13, color:'var(--gray-600)', marginTop:4, fontStyle:'italic' }}>
                        "{v.observacao}"
                      </div>
                    )}
                    <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:3 }}>
                      {v.votado_em
                        ? new Date(v.votado_em).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
                        : fmtDate(v.criado_em||'')}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {votos.length === 0 && !podeVotar && (
        <div className="empty-state">Nenhum voto registrado ainda.</div>
      )}

      {/* Decisão final (síndico) */}
      {ehSindico && aprovacaoStatus === 'aguardando' && votos.length > 0 && (
        <div style={{ marginTop:20, paddingTop:20, borderTop:'1px solid var(--gray-200)' }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--gray-600)', textTransform:'uppercase',
            letterSpacing:'.05em', marginBottom:10 }}>
            Decisão final do síndico
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <button className="btn btn-primary btn-sm" onClick={() => onDecisao?.('aprovado')}>
              ✅ Aprovar e prosseguir
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => onDecisao?.('rejeitado')}>
              ❌ Rejeitar
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => onDecisao?.('cancelar')}>
              Cancelar votação
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
