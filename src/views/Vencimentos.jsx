import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// ─── Modelos pré-prontos (SUGESTÃO — prazos variam por estado/cidade) ────────
// O síndico escolhe um modelo e só ajusta a data; periodicidade é sugerida.
const MODELOS = [
  { categoria: 'Segurança contra incêndio', itens: [
    { tipo: 'AVCB',                    titulo: 'AVCB (Auto de Vistoria do Corpo de Bombeiros)', periodicidade: 'quinquenal' },
    { tipo: 'Extintores',              titulo: 'Recarga/manutenção de extintores',              periodicidade: 'anual' },
    { tipo: 'Mangueiras/Hidrantes',    titulo: 'Manutenção de mangueiras e hidrantes',          periodicidade: 'anual' },
    { tipo: 'Iluminação de emergência',titulo: 'Iluminação de emergência',                      periodicidade: 'anual' },
    { tipo: 'PPCI',                    titulo: 'PPCI (Plano de Prevenção contra Incêndio)',     periodicidade: 'anual' },
  ]},
  { categoria: 'Laudos técnicos', itens: [
    { tipo: 'SPDA/Para-raios',         titulo: 'SPDA / para-raios (laudo)',                     periodicidade: 'anual' },
    { tipo: 'Inspeção predial',        titulo: 'Inspeção predial (laudo IBAPE)',                periodicidade: 'quinquenal' },
    { tipo: 'Laudo de gás',            titulo: 'Laudo das instalações de gás',                  periodicidade: 'quinquenal' },
  ]},
  { categoria: 'Manutenções periódicas', itens: [
    { tipo: "Limpeza caixa d'água",    titulo: "Limpeza da caixa d'água",                       periodicidade: 'semestral' },
    { tipo: 'Potabilidade da água',    titulo: 'Análise de potabilidade da água',               periodicidade: 'semestral' },
    { tipo: 'Elevadores (RIA)',        titulo: 'Inspeção anual de elevadores (RIA)',            periodicidade: 'anual' },
    { tipo: 'Dedetização',             titulo: 'Dedetização / controle de pragas',              periodicidade: 'semestral' },
    { tipo: 'Limpeza calhas/cisterna', titulo: 'Limpeza de calhas / cisterna / caixa de gordura', periodicidade: 'semestral' },
  ]},
  { categoria: 'Contratos e seguros', itens: [
    { tipo: 'Seguro condominial',      titulo: 'Seguro condominial (obrigatório por lei)',      periodicidade: 'anual' },
    { tipo: 'Manutenção elevadores',   titulo: 'Contrato de manutenção de elevadores',          periodicidade: 'anual' },
    { tipo: 'Contrato fornecedor',     titulo: 'Contrato de fornecedor (limpeza/portaria/etc.)', periodicidade: 'anual' },
  ]},
  { categoria: 'Recursos humanos', itens: [
    { tipo: 'CIPA (NR-5)',             titulo: 'Treinamento da CIPA (NR-5)',                    periodicidade: 'anual' },
    { tipo: 'ASO/PCMSO/PGR',           titulo: 'Exames periódicos (ASO) / PCMSO / PGR',         periodicidade: 'anual' },
  ]},
]

// Mapa tipo -> categoria (para filtro e exibição)
const TIPO_CATEGORIA = {}
MODELOS.forEach(g => g.itens.forEach(i => { TIPO_CATEGORIA[i.tipo] = g.categoria }))
const categoriaDoTipo = (tipo) => TIPO_CATEGORIA[tipo] || 'Outro'

const PERIODICIDADES = [
  ['unico','Único (não repete)'], ['mensal','Mensal'], ['trimestral','Trimestral'],
  ['semestral','Semestral'], ['anual','Anual'], ['bienal','Bienal (2 anos)'],
  ['quinquenal','Quinquenal (5 anos)'],
]
const MESES_PERIODO = { mensal:1, trimestral:3, semestral:6, anual:12, bienal:24, quinquenal:60 }
const periodicidadeLabel = (p) => (PERIODICIDADES.find(([v]) => v === p)?.[1]) || p

const BUCKET = 'vencimentos-anexos'

const VAZIO = {
  tipo:'', titulo:'', descricao:'', condominio_id:'', data_vencimento:'',
  periodicidade:'anual', responsavel:'', fornecedor_id:'', dias_aviso:30,
  anexo:null, anexo_nome:'', status:'ativo',
}

// aaaa-mm-dd -> dd/mm/aaaa
const fmtData = (d) => {
  if (!d) return ''
  const [a, m, dia] = String(d).slice(0, 10).split('-')
  return `${dia}/${m}/${a}`
}

// Dias até vencer (negativo = já venceu)
const diasAte = (data) => {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const venc = new Date(String(data).slice(0, 10) + 'T00:00:00')
  return Math.round((venc - hoje) / 86400000)
}

// Situação por cor
const situacao = (v) => {
  const dias = diasAte(v.data_vencimento)
  const aviso = v.dias_aviso ?? 30
  if (dias < 0)      return { chave:'vencido',  texto:`Vencido há ${Math.abs(dias)} dia${Math.abs(dias)===1?'':'s'}`, cor:'var(--rust)',    bg:'var(--rust-bg)' }
  if (dias <= aviso) return { chave:'vencendo',  texto: dias===0 ? 'Vence hoje' : `Vence em ${dias} dia${dias===1?'':'s'}`, cor:'#b45309', bg:'var(--amber-bg)' }
  return               { chave:'emdia',    texto:`Em dia · vence ${fmtData(v.data_vencimento)}`, cor:'var(--emerald)', bg:'#f0fdf4' }
}

// Próxima data pela periodicidade (avança a partir do vencimento atual)
const proximaData = (dataStr, periodicidade) => {
  const meses = MESES_PERIODO[periodicidade]
  if (!meses) return null
  const d = new Date(String(dataStr).slice(0, 10) + 'T12:00:00')
  d.setMonth(d.getMonth() + meses)
  return d.toISOString().slice(0, 10)
}

export default function Vencimentos({ onToast }) {
  const { perfil } = useAuth()
  const [itens, setItens] = useState([])
  const [condominios, setCondominios] = useState([])
  const [fornecedores, setFornecedores] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [arq, setArq] = useState(null)          // File novo para upload

  // Filtros
  const [fCondo, setFCondo] = useState('')
  const [fCategoria, setFCategoria] = useState('')
  const [fSituacao, setFSituacao] = useState('')

  const carregar = async () => {
    setLoading(true)
    const [{ data:v }, { data:c }, { data:f }] = await Promise.all([
      supabase.from('vencimentos').select('*').neq('status','arquivado').order('data_vencimento'),
      supabase.from('condominios').select('id, nome').order('nome'),
      supabase.from('fornecedores').select('id, razao_social, nome_fantasia').eq('empresa_id', perfil.empresa_id).eq('ativo', true).order('razao_social'),
    ])
    setItens(v || [])
    setCondominios(c || [])
    setFornecedores(f || [])
    setLoading(false)
  }

  useEffect(() => { if (perfil?.empresa_id) carregar() }, [perfil?.empresa_id])

  const nomeCondo = (id) => condominios.find(c => c.id === id)?.nome || '—'
  const set = (campo, valor) => setModal(m => ({ ...m, [campo]: valor }))

  // Ao escolher um modelo no dropdown, pré-preenche título e periodicidade
  const escolherModelo = (tipo) => {
    if (tipo === 'outro') { set('tipo', 'outro'); return }
    const item = MODELOS.flatMap(g => g.itens).find(i => i.tipo === tipo)
    if (!item) { set('tipo', tipo); return }
    setModal(m => ({
      ...m,
      tipo: item.tipo,
      titulo: m.titulo?.trim() ? m.titulo : item.titulo,
      periodicidade: item.periodicidade,
    }))
  }

  const salvar = async () => {
    if (!modal.condominio_id) { onToast('Escolha o condomínio.'); return }
    if (!modal.data_vencimento) { onToast('Informe a data de vencimento.'); return }
    if (!modal.titulo?.trim()) { onToast('Informe um título.'); return }
    setSalvando(true)
    const payload = {
      empresa_id: perfil.empresa_id,
      condominio_id: modal.condominio_id,
      tipo: modal.tipo || 'outro',
      titulo: modal.titulo.trim(),
      descricao: modal.descricao?.trim() || null,
      data_vencimento: modal.data_vencimento,
      periodicidade: modal.periodicidade || 'anual',
      responsavel: modal.responsavel?.trim() || null,
      fornecedor_id: modal.fornecedor_id || null,
      dias_aviso: Number(modal.dias_aviso) || 30,
      status: modal.status || 'ativo',
    }
    // Ao editar a data, zera o aviso para poder avisar de novo no novo ciclo
    if (modal.id && modal.data_vencimento !== modal._data_original) payload.avisado_em = null

    let error, id = modal.id
    if (modal.id) {
      ({ error } = await supabase.from('vencimentos').update(payload).eq('id', modal.id))
    } else {
      const res = await supabase.from('vencimentos').insert(payload).select('id').single()
      error = res.error; id = res.data?.id
    }
    if (error) { setSalvando(false); onToast('Erro: ' + error.message); return }

    // Upload do anexo (se escolhido)
    if (arq && id) {
      const nomeSeguro = arq.name.replace(/[^\w.-]/g, '_')
      const caminho = `${id}/${Date.now()}_${nomeSeguro}`
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(caminho, arq, { upsert: true })
      if (upErr) {
        setSalvando(false)
        onToast('Vencimento salvo, mas o anexo não subiu: ' + upErr.message)
        setModal(null); setArq(null); await carregar(); return
      }
      if (modal.anexo && modal.anexo !== caminho) {
        await supabase.storage.from(BUCKET).remove([modal.anexo])
      }
      await supabase.from('vencimentos').update({ anexo: caminho, anexo_nome: arq.name }).eq('id', id)
    }

    setSalvando(false)
    onToast('Vencimento salvo!'); setModal(null); setArq(null); await carregar()
  }

  const abrirAnexo = async (caminho) => {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(caminho, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    else onToast('Não foi possível abrir o anexo.')
  }

  const removerAnexo = async () => {
    if (!modal?.anexo) { setArq(null); return }
    if (!window.confirm('Remover o arquivo anexado?')) return
    await supabase.storage.from(BUCKET).remove([modal.anexo])
    if (modal.id) await supabase.from('vencimentos').update({ anexo: null, anexo_nome: null }).eq('id', modal.id)
    setModal(m => ({ ...m, anexo: null, anexo_nome: '' })); setArq(null)
    onToast('Anexo removido.')
  }

  // Renovar: avança a data pela periodicidade e limpa o aviso
  const renovar = async (v) => {
    const prox = proximaData(v.data_vencimento, v.periodicidade)
    if (!prox) { onToast('Item "único" não tem renovação automática — edite a data manualmente.'); return }
    if (!window.confirm(`Renovar "${v.titulo}"?\nNova data: ${fmtData(prox)} (${periodicidadeLabel(v.periodicidade)})`)) return
    const { error } = await supabase.from('vencimentos')
      .update({ data_vencimento: prox, avisado_em: null, status: 'ativo' }).eq('id', v.id)
    if (error) { onToast('Erro: ' + error.message); return }
    onToast(`Renovado para ${fmtData(prox)}.`); await carregar()
  }

  const excluir = async (id) => {
    if (!window.confirm('Excluir este vencimento?')) return
    const { error } = await supabase.from('vencimentos').delete().eq('id', id)
    if (error) { onToast('Erro: ' + error.message); return }
    onToast('Vencimento excluído.'); await carregar()
  }

  // ─── Filtros + resumo ──────────────────────────────────────────────────────
  // Base: aplica condomínio e categoria (o resumo reflete a situação dessa base)
  const base = itens.filter(v => {
    if (fCondo && v.condominio_id !== fCondo) return false
    if (fCategoria && categoriaDoTipo(v.tipo) !== fCategoria) return false
    return true
  })
  const resumo = base.reduce((a, v) => { a[situacao(v).chave]++; return a }, { vencido:0, vencendo:0, emdia:0 })
  const filtrados = base.filter(v => !fSituacao || situacao(v).chave === fSituacao)

  const categoriasDisponiveis = ['Segurança contra incêndio','Laudos técnicos','Manutenções periódicas','Contratos e seguros','Recursos humanos','Outro']

  return (
    <div>
      <div className="page-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
        <div>
          <h1 className="page-title">Controle de Vencimentos</h1>
          <p className="page-sub">Prazos e validades do condomínio — AVCB, extintores, seguro, caixa d'água e mais</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setModal({ ...VAZIO, condominio_id: fCondo || (condominios[0]?.id || '') }); setArq(null) }}>
          + Novo vencimento
        </button>
      </div>

      {/* Resumo */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:10, margin:'16px 0' }}>
        {[
          { k:'vencido',  n:resumo.vencido,  label:'Vencidos',  cor:'var(--rust)',    bg:'var(--rust-bg)' },
          { k:'vencendo', n:resumo.vencendo, label:'Vencendo',  cor:'#b45309',        bg:'var(--amber-bg)' },
          { k:'emdia',    n:resumo.emdia,    label:'Em dia',    cor:'var(--emerald)', bg:'#f0fdf4' },
        ].map(c => (
          <button key={c.k} onClick={() => setFSituacao(fSituacao === c.k ? '' : c.k)}
            className="card" style={{ textAlign:'left', cursor:'pointer', background:c.bg, borderColor: fSituacao===c.k ? c.cor : 'transparent', borderWidth:1, borderStyle:'solid' }}>
            <div style={{ fontSize:26, fontWeight:800, color:c.cor, fontFamily:'var(--font-display)' }}>{c.n}</div>
            <div style={{ fontSize:12, fontWeight:600, color:'var(--gray-600)' }}>{c.label}</div>
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:16 }}>
        <select className="input" value={fCondo} onChange={e => setFCondo(e.target.value)} style={{ maxWidth:220 }}>
          <option value="">Todos os condomínios</option>
          {condominios.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <select className="input" value={fCategoria} onChange={e => setFCategoria(e.target.value)} style={{ maxWidth:220 }}>
          <option value="">Todas as categorias</option>
          {categoriasDisponiveis.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input" value={fSituacao} onChange={e => setFSituacao(e.target.value)} style={{ maxWidth:170 }}>
          <option value="">Todas as situações</option>
          <option value="vencido">Vencidos</option>
          <option value="vencendo">Vencendo</option>
          <option value="emdia">Em dia</option>
        </select>
      </div>

      {loading ? (
        <div className="empty-state">Carregando...</div>
      ) : filtrados.length === 0 ? (
        <div className="empty-state">
          {itens.length === 0 ? 'Nenhum vencimento cadastrado ainda.' : 'Nenhum item para os filtros selecionados.'}
        </div>
      ) : (
        <div style={{ display:'grid', gap:10 }}>
          {filtrados.map(v => {
            const st = situacao(v)
            return (
              <div key={v.id} className="card" style={{ display:'flex', alignItems:'center', gap:14, borderLeft:`4px solid ${st.cor}` }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:15, fontWeight:700, color:'var(--navy)' }}>
                    {v.titulo}
                    {v.tipo && v.tipo !== 'outro' && (
                      <span style={{ fontWeight:500, color:'var(--gray-500)' }}> · {v.tipo}</span>
                    )}
                  </div>
                  <div style={{ fontSize:12, color:'var(--gray-400)', marginTop:3, display:'flex', gap:10, flexWrap:'wrap' }}>
                    <span>🏢 {nomeCondo(v.condominio_id)}</span>
                    <span>📅 {fmtData(v.data_vencimento)}</span>
                    <span>🔁 {periodicidadeLabel(v.periodicidade)}</span>
                    {v.responsavel && <span>👷 {v.responsavel}</span>}
                    {v.anexo && (
                      <button type="button" onClick={() => abrirAnexo(v.anexo)}
                        style={{ background:'none', border:'none', padding:0, cursor:'pointer', color:'var(--blue, #2563eb)', fontSize:12 }}>
                        📄 {v.anexo_nome || 'Anexo'}
                      </button>
                    )}
                  </div>
                </div>
                <span style={{ fontSize:12, fontWeight:700, color:st.cor, background:st.bg, padding:'4px 10px', borderRadius:20, whiteSpace:'nowrap' }}>
                  {st.texto}
                </span>
                {v.periodicidade !== 'unico' && (
                  <button className="btn btn-ghost btn-sm" onClick={() => renovar(v)} title="Avançar para o próximo ciclo">Renovar</button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => { setModal({ ...v, _data_original: v.data_vencimento, fornecedor_id: v.fornecedor_id || '' }); setArq(null) }}>Editar</button>
                <button className="btn btn-ghost btn-sm" style={{ color:'var(--rust)' }} onClick={() => excluir(v.id)}>Excluir</button>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de cadastro/edição */}
      {modal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setModal(null); setArq(null) } }}>
          <div className="modal" style={{ maxWidth:600, width:'100%', maxHeight:'90vh', overflowY:'auto' }}>
            <div className="modal-header">
              <h3 className="modal-title">{modal.id ? 'Editar' : 'Novo'} vencimento</h3>
              <button className="modal-close" onClick={() => { setModal(null); setArq(null) }}>×</button>
            </div>

            {/* Item / modelo */}
            <div className="field">
              <label>Item</label>
              <select className="input" value={modal.tipo || ''} onChange={e => escolherModelo(e.target.value)}>
                <option value="">Escolha um modelo...</option>
                {MODELOS.map(g => (
                  <optgroup key={g.categoria} label={g.categoria}>
                    {g.itens.map(i => <option key={i.tipo} value={i.tipo}>{i.titulo}</option>)}
                  </optgroup>
                ))}
                <option value="outro">Outro (personalizado)</option>
              </select>
              <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:4 }}>
                A periodicidade sugerida é apenas uma referência — ajuste conforme seu estado/cidade.
              </div>
            </div>

            <div className="field">
              <label>Título *</label>
              <input className="input" value={modal.titulo || ''} onChange={e => set('titulo', e.target.value)}
                placeholder='Ex.: "AVCB bloco A"' />
            </div>

            <div className="row2" style={{ display:'flex', gap:12 }}>
              <div className="field" style={{ flex:1 }}>
                <label>Condomínio *</label>
                <select className="input" value={modal.condominio_id || ''} onChange={e => set('condominio_id', e.target.value)}>
                  <option value="">Selecione...</option>
                  {condominios.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div className="field" style={{ width:180 }}>
                <label>Data de vencimento *</label>
                <input className="input" type="date" value={modal.data_vencimento || ''} onChange={e => set('data_vencimento', e.target.value)} />
              </div>
            </div>

            <div className="row2" style={{ display:'flex', gap:12 }}>
              <div className="field" style={{ flex:1 }}>
                <label>Periodicidade</label>
                <select className="input" value={modal.periodicidade || 'anual'} onChange={e => set('periodicidade', e.target.value)}>
                  {PERIODICIDADES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="field" style={{ width:180 }}>
                <label>Avisar quantos dias antes</label>
                <input className="input" type="number" min="0" max="365" value={modal.dias_aviso ?? 30}
                  onChange={e => set('dias_aviso', e.target.value)} />
              </div>
            </div>

            <div className="field">
              <label>Responsável (opcional)</label>
              <input className="input" value={modal.responsavel || ''} onChange={e => set('responsavel', e.target.value)}
                placeholder="Empresa/pessoa responsável pela renovação" />
            </div>

            {fornecedores.length > 0 && (
              <div className="field">
                <label>Vincular a um fornecedor cadastrado (opcional)</label>
                <select className="input" value={modal.fornecedor_id || ''}
                  onChange={e => {
                    const id = e.target.value
                    const f = fornecedores.find(x => x.id === id)
                    setModal(m => ({ ...m, fornecedor_id: id, responsavel: m.responsavel?.trim() ? m.responsavel : (f ? (f.nome_fantasia || f.razao_social) : m.responsavel) }))
                  }}>
                  <option value="">Nenhum</option>
                  {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome_fantasia || f.razao_social}</option>)}
                </select>
              </div>
            )}

            <div className="field">
              <label>Descrição (opcional)</label>
              <textarea className="input" rows={2} value={modal.descricao || ''} onChange={e => set('descricao', e.target.value)}
                placeholder="Observações, número do laudo, etc." />
            </div>

            {/* Anexo */}
            <div className="field">
              <label>Laudo / certificado (opcional)</label>
              {modal.anexo && !arq ? (
                <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => abrirAnexo(modal.anexo)}>
                    📄 {modal.anexo_nome || 'Ver anexo'}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" style={{ color:'var(--rust)' }} onClick={removerAnexo}>Remover</button>
                </div>
              ) : (
                <>
                  <input type="file" accept=".pdf,.doc,.docx,image/*" onChange={e => setArq(e.target.files?.[0] || null)} style={{ fontSize:13 }} />
                  {arq && <div style={{ fontSize:12, color:'var(--emerald)', marginTop:6 }}>{arq.name} — será enviado ao salvar</div>}
                </>
              )}
            </div>

            <div style={{ display:'flex', gap:10, marginTop:16 }}>
              <button className="btn btn-ghost" style={{ flex:1 }} onClick={() => { setModal(null); setArq(null) }}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex:1 }} onClick={salvar} disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar vencimento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
