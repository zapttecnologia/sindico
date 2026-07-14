import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function SACategorias({ C, tema, onToast }) {
  const [categorias, setCategorias] = useState([])
  const [subcategorias, setSubcategorias] = useState({}) // { categoria_id: [...] }
  const [prioridades, setPrioridades] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandido, setExpandido] = useState(null)
  const [modalCat, setModalCat] = useState(null)      // objeto ou {} para novo
  const [modalSub, setModalSub] = useState(null)      // { categoria_id, ...sub }
  const [modalPrio, setModalPrio] = useState(null)    // objeto ou {} para novo
  const [salvando, setSalvando] = useState(false)
  // Formulários inline de ADIÇÃO (edição continua no modal)
  const CAT_VAZIO = { icone:'📋', nome:'', descricao:'', ordem:'', sla_resposta_horas:'', sla_resolucao_horas:'', ativo:true }
  const [formCat, setFormCat] = useState(null)        // null = fechado; objeto = aberto
  const [formSubCatId, setFormSubCatId] = useState(null) // id da categoria com form de sub aberto
  const [formSub, setFormSub] = useState({ icone:'•', nome:'' })

  const inputBg = tema==='light' ? '#fff' : '#1c2333'
  const inputBrd = tema==='light' ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.1)'
  const scheme = tema==='light' ? 'light' : 'dark'   // colorScheme p/ inputs no tema escuro

  // Converte campo numérico vazio ('') em null antes do insert/update (Postgres não aceita '')
  const numOrNull = (v) => (v === '' || v === null || v === undefined ? null : Number(v))

  const carregar = async () => {
    setLoading(true)
    const { data:cats } = await supabase.from('categorias_sistema').select('*').order('ordem')
    const { data:subs } = await supabase.from('subcategorias_sistema').select('*').order('ordem')
    const { data:prios } = await supabase.from('prioridades_sistema').select('*').order('ordem')
    const agrupado = {}
    ;(subs||[]).forEach(s => {
      if (!agrupado[s.categoria_id]) agrupado[s.categoria_id] = []
      agrupado[s.categoria_id].push(s)
    })
    setCategorias(cats||[])
    setSubcategorias(agrupado)
    setPrioridades(prios||[])
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  const salvarCategoria = async () => {
    if (!modalCat.nome?.trim()) { onToast('Informe o nome.'); return }
    setSalvando(true)
    const payload = {
      nome: modalCat.nome.trim(),
      icone: modalCat.icone || '📋',
      descricao: modalCat.descricao || null,
      ordem: Number(modalCat.ordem) || categorias.length + 1,
      ativo: modalCat.ativo !== false,
      sla_resposta_horas: numOrNull(modalCat.sla_resposta_horas),
      sla_resolucao_horas: numOrNull(modalCat.sla_resolucao_horas),
    }
    let error
    if (modalCat.id) {
      ({ error } = await supabase.from('categorias_sistema').update(payload).eq('id', modalCat.id))
    } else {
      ({ error } = await supabase.from('categorias_sistema').insert(payload))
    }
    setSalvando(false)
    if (error) { onToast('Erro: '+error.message); return }
    onToast('Categoria salva!'); setModalCat(null); carregar()
  }

  // Adiciona categoria pelo formulário inline; mantém o form aberto e limpo para a próxima
  const adicionarCategoriaInline = async () => {
    if (!formCat.nome?.trim()) { onToast('Informe o nome.'); return }
    setSalvando(true)
    const { error } = await supabase.from('categorias_sistema').insert({
      nome: formCat.nome.trim(),
      icone: formCat.icone || '📋',
      descricao: formCat.descricao || null,
      ordem: Number(formCat.ordem) || categorias.length + 1,
      ativo: true,
      sla_resposta_horas: numOrNull(formCat.sla_resposta_horas),
      sla_resolucao_horas: numOrNull(formCat.sla_resolucao_horas),
    })
    setSalvando(false)
    if (error) { onToast('Erro: '+error.message); return }
    onToast('Categoria adicionada!')
    setFormCat({ ...CAT_VAZIO })   // limpa para cadastrar a próxima
    await carregar()
  }

  // Adiciona subcategoria pelo formulário inline; mantém aberto para a próxima
  const adicionarSubInline = async (categoriaId) => {
    if (!formSub.nome?.trim()) { onToast('Informe o nome.'); return }
    setSalvando(true)
    const { error } = await supabase.from('subcategorias_sistema').insert({
      categoria_id: categoriaId,
      nome: formSub.nome.trim(),
      icone: formSub.icone || '•',
      ordem: (subcategorias[categoriaId]?.length || 0) + 1,
      ativo: true,
    })
    setSalvando(false)
    if (error) { onToast('Erro: '+error.message); return }
    onToast('Subcategoria adicionada!')
    setFormSub({ icone:'•', nome:'' })  // limpa para a próxima
    await carregar()
  }

  const excluirCategoria = async (id) => {
    if (!window.confirm('Excluir esta categoria e todas as suas subcategorias?')) return
    await supabase.from('subcategorias_sistema').delete().eq('categoria_id', id)
    await supabase.from('categorias_sistema').delete().eq('id', id)
    onToast('Categoria excluída.'); carregar()
  }

  const salvarSubcategoria = async () => {
    if (!modalSub.nome?.trim()) { onToast('Informe o nome.'); return }
    setSalvando(true)
    const payload = {
      categoria_id: modalSub.categoria_id,
      nome: modalSub.nome.trim(),
      icone: modalSub.icone || '•',
      ordem: Number(modalSub.ordem) || (subcategorias[modalSub.categoria_id]?.length || 0) + 1,
      ativo: modalSub.ativo !== false,
    }
    let error
    if (modalSub.id) {
      ({ error } = await supabase.from('subcategorias_sistema').update(payload).eq('id', modalSub.id))
    } else {
      ({ error } = await supabase.from('subcategorias_sistema').insert(payload))
    }
    setSalvando(false)
    if (error) { onToast('Erro: '+error.message); return }
    onToast('Subcategoria salva!'); setModalSub(null); carregar()
  }

  const excluirSubcategoria = async (id) => {
    if (!window.confirm('Excluir esta subcategoria?')) return
    await supabase.from('subcategorias_sistema').delete().eq('id', id)
    onToast('Subcategoria excluída.'); carregar()
  }

  const toggleAtivo = async (cat) => {
    await supabase.from('categorias_sistema').update({ ativo: !cat.ativo }).eq('id', cat.id)
    carregar()
  }

  // ── Prioridades ──────────────────────────────────────────
  const slugify = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')

  const salvarPrioridade = async () => {
    if (!modalPrio.nome?.trim()) { onToast('Informe o nome.'); return }
    setSalvando(true)
    const payload = {
      nome: modalPrio.nome.trim(),
      slug: (modalPrio.slug?.trim() || slugify(modalPrio.nome)),
      icone: modalPrio.icone || '⚪',
      cor: modalPrio.cor || '#64748b',
      ordem: Number(modalPrio.ordem) || prioridades.length + 1,
      ativo: modalPrio.ativo !== false,
    }
    let error
    if (modalPrio.id) {
      ({ error } = await supabase.from('prioridades_sistema').update(payload).eq('id', modalPrio.id))
    } else {
      ({ error } = await supabase.from('prioridades_sistema').insert(payload))
    }
    setSalvando(false)
    if (error) { onToast('Erro: '+error.message); return }
    onToast('Prioridade salva!'); setModalPrio(null); carregar()
  }

  const excluirPrioridade = async (id) => {
    if (!window.confirm('Excluir esta prioridade?')) return
    const { error } = await supabase.from('prioridades_sistema').delete().eq('id', id)
    if (error) { onToast('Erro: '+error.message); return }
    onToast('Prioridade excluída.'); carregar()
  }

  const togglePrioAtivo = async (p) => {
    await supabase.from('prioridades_sistema').update({ ativo: !p.ativo }).eq('id', p.id)
    carregar()
  }

  if (loading) return <div style={{ padding:40, textAlign:'center', color:C.muted }}>Carregando...</div>

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:800, color:C.text, margin:0 }}>Categorias do sistema</h2>
          <p style={{ fontSize:13, color:C.muted, margin:'4px 0 0' }}>Gerencie categorias e subcategorias disponíveis para os condomínios</p>
        </div>
        <button onClick={()=>setFormCat(formCat ? null : { ...CAT_VAZIO })}
          style={{ padding:'9px 16px', background:formCat?C.surface:C.purple, border:formCat?`1px solid ${C.border}`:'none', borderRadius:8, color:formCat?C.text:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
          {formCat ? '× Fechar' : '+ Nova categoria'}
        </button>
      </div>

      {/* ── Formulário inline: nova categoria ───────────────── */}
      {formCat && (
        <div style={{ background:C.surface, border:`1px solid ${C.purple}`, borderRadius:12, marginBottom:22, padding:'18px 18px' }}>
          <div style={{ fontSize:13, fontWeight:800, color:C.text, marginBottom:14 }}>Nova categoria</div>
          <div style={{ display:'flex', gap:10, marginBottom:12 }}>
            <div style={{ width:64 }}>
              <label style={{ fontSize:11, fontWeight:700, color:C.muted, display:'block', marginBottom:5 }}>ÍCONE</label>
              <input value={formCat.icone} onChange={e=>setFormCat(m=>({...m,icone:e.target.value}))} placeholder="📋"
                style={{ width:'100%', padding:'9px', background:inputBg, border:`1px solid ${inputBrd}`, borderRadius:8, color:C.text, fontSize:20, textAlign:'center', boxSizing:'border-box' }}/>
            </div>
            <div style={{ flex:1 }}>
              <label style={{ fontSize:11, fontWeight:700, color:C.muted, display:'block', marginBottom:5 }}>NOME *</label>
              <input autoFocus value={formCat.nome} onChange={e=>setFormCat(m=>({...m,nome:e.target.value}))} placeholder="Ex.: Manutenção"
                onKeyDown={e=>{ if(e.key==='Enter') adicionarCategoriaInline() }}
                style={{ width:'100%', padding:'9px 12px', background:inputBg, border:`1px solid ${inputBrd}`, borderRadius:8, color:C.text, fontSize:14, boxSizing:'border-box' }}/>
            </div>
          </div>
          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:11, fontWeight:700, color:C.muted, display:'block', marginBottom:5 }}>DESCRIÇÃO</label>
            <input value={formCat.descricao} onChange={e=>setFormCat(m=>({...m,descricao:e.target.value}))} placeholder="Breve descrição"
              style={{ width:'100%', padding:'9px 12px', background:inputBg, border:`1px solid ${inputBrd}`, borderRadius:8, color:C.text, fontSize:14, boxSizing:'border-box' }}/>
          </div>
          <div style={{ display:'flex', gap:10, marginBottom:16 }}>
            <div style={{ width:80 }}>
              <label style={{ fontSize:11, fontWeight:700, color:C.muted, display:'block', marginBottom:5 }}>ORDEM</label>
              <input type="number" value={formCat.ordem} onChange={e=>setFormCat(m=>({...m,ordem:e.target.value}))} placeholder={String(categorias.length+1)}
                style={{ width:'100%', padding:'9px 12px', background:inputBg, border:`1px solid ${inputBrd}`, borderRadius:8, color:C.text, fontSize:14, colorScheme:scheme, boxSizing:'border-box' }}/>
            </div>
            <div style={{ flex:1 }}>
              <label style={{ fontSize:11, fontWeight:700, color:C.muted, display:'block', marginBottom:5 }}>SLA RESPOSTA (h)</label>
              <input type="number" min="0" value={formCat.sla_resposta_horas} onChange={e=>setFormCat(m=>({...m,sla_resposta_horas:e.target.value}))} placeholder="24"
                style={{ width:'100%', padding:'9px 12px', background:inputBg, border:`1px solid ${inputBrd}`, borderRadius:8, color:C.text, fontSize:14, colorScheme:scheme, boxSizing:'border-box' }}/>
            </div>
            <div style={{ flex:1 }}>
              <label style={{ fontSize:11, fontWeight:700, color:C.muted, display:'block', marginBottom:5 }}>SLA RESOLUÇÃO (h)</label>
              <input type="number" min="0" value={formCat.sla_resolucao_horas} onChange={e=>setFormCat(m=>({...m,sla_resolucao_horas:e.target.value}))} placeholder="72"
                style={{ width:'100%', padding:'9px 12px', background:inputBg, border:`1px solid ${inputBrd}`, borderRadius:8, color:C.text, fontSize:14, colorScheme:scheme, boxSizing:'border-box' }}/>
            </div>
          </div>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <button onClick={adicionarCategoriaInline} disabled={salvando}
              style={{ padding:'10px 18px', background:C.purple, border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
              {salvando?'Adicionando...':'+ Adicionar'}
            </button>
            <button onClick={()=>setFormCat(null)}
              style={{ padding:'10px 18px', background:'none', border:`1px solid ${C.border}`, borderRadius:8, color:C.text, fontSize:13, fontWeight:600, cursor:'pointer' }}>
              Concluir
            </button>
            <span style={{ fontSize:12, color:C.muted }}>Após adicionar, os campos limpam para você cadastrar a próxima.</span>
          </div>
        </div>
      )}

      {/* ── Prioridades ─────────────────────────────────── */}
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, marginBottom:22, padding:'16px 18px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <div>
            <span style={{ fontSize:14, fontWeight:800, color:C.text }}>Prioridades</span>
            <span style={{ fontSize:12, color:C.muted, marginLeft:8 }}>Níveis de prioridade disponíveis ao abrir chamados</span>
          </div>
          <button onClick={()=>setModalPrio({ ativo:true, icone:'⚪', cor:'#64748b' })}
            style={{ padding:'5px 12px', background:'rgba(124,58,237,.15)', border:'1px solid rgba(124,58,237,.3)', borderRadius:6, color:C.purple, fontSize:12, fontWeight:700, cursor:'pointer' }}>
            + Prioridade
          </button>
        </div>
        {prioridades.length === 0
          ? <div style={{ fontSize:13, color:C.muted }}>Nenhuma prioridade cadastrada.</div>
          : <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {prioridades.map(p => (
              <div key={p.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 12px', background:tema==='light'?'#f8f9fc':'rgba(255,255,255,.03)', border:`1px solid ${C.border}`, borderLeft:`3px solid ${p.cor||C.muted}`, borderRadius:8, opacity:p.ativo?1:.5 }}>
                <span style={{ fontSize:15 }}>{p.icone}</span>
                <span style={{ fontSize:13, fontWeight:600, color:C.text }}>{p.nome}</span>
                <button onClick={()=>togglePrioAtivo(p)} title={p.ativo?'Desativar':'Ativar'} style={{ background:'none', border:'none', color:C.muted, fontSize:11, cursor:'pointer' }}>{p.ativo?'👁':'🚫'}</button>
                <button onClick={()=>setModalPrio({...p})} style={{ background:'none', border:'none', color:C.muted, fontSize:12, cursor:'pointer' }}>✏</button>
                <button onClick={()=>excluirPrioridade(p.id)} style={{ background:'none', border:'none', color:C.red, fontSize:14, cursor:'pointer' }}>×</button>
              </div>
            ))}
          </div>
        }
      </div>

      {categorias.map(cat => {
        const subs = subcategorias[cat.id] || []
        const aberto = expandido === cat.id
        return (
          <div key={cat.id} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, marginBottom:10, overflow:'hidden', opacity:cat.ativo?1:.55 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 18px' }}>
              <span style={{ fontSize:24 }}>{cat.icone}</span>
              <div style={{ flex:1, cursor:'pointer' }} onClick={()=>setExpandido(aberto?null:cat.id)}>
                <div style={{ fontSize:15, fontWeight:700, color:C.text }}>
                  {cat.nome}
                  {!cat.ativo && <span style={{ fontSize:10, marginLeft:8, padding:'2px 8px', background:'rgba(148,163,184,.2)', color:C.muted, borderRadius:10, fontWeight:700 }}>INATIVA</span>}
                </div>
                <div style={{ fontSize:12, color:C.muted }}>
                  {subs.length} subcategoria{subs.length!==1?'s':''}{cat.descricao?` · ${cat.descricao}`:''}
                  {(cat.sla_resposta_horas!=null || cat.sla_resolucao_horas!=null) && (
                    <span style={{ marginLeft:8 }}>· ⏱ {cat.sla_resposta_horas!=null?`${cat.sla_resposta_horas}h resposta`:'—'} / {cat.sla_resolucao_horas!=null?`${cat.sla_resolucao_horas}h resolução`:'—'}</span>
                  )}
                </div>
              </div>
              <button onClick={()=>toggleAtivo(cat)} title={cat.ativo?'Desativar':'Ativar'}
                style={{ background:'none', border:`1px solid ${C.border}`, borderRadius:6, padding:'5px 10px', fontSize:11, fontWeight:600, color:C.muted, cursor:'pointer' }}>
                {cat.ativo?'👁 Ativa':'🚫 Inativa'}
              </button>
              <button onClick={()=>setModalCat({...cat})}
                style={{ background:'none', border:`1px solid ${C.border}`, borderRadius:6, padding:'5px 10px', fontSize:11, fontWeight:600, color:C.text, cursor:'pointer' }}>
                Editar
              </button>
              <button onClick={()=>excluirCategoria(cat.id)}
                style={{ background:'none', border:'none', color:C.red, fontSize:12, fontWeight:600, cursor:'pointer' }}>
                Excluir
              </button>
              <button onClick={()=>setExpandido(aberto?null:cat.id)}
                style={{ background:'none', border:'none', color:C.muted, fontSize:16, cursor:'pointer' }}>
                {aberto?'▲':'▼'}
              </button>
            </div>

            {aberto && (
              <div style={{ padding:'0 18px 16px', borderTop:`1px solid ${C.border2}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', margin:'14px 0 10px' }}>
                  <span style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'.05em' }}>Subcategorias</span>
                  <button onClick={()=>{ setFormSubCatId(formSubCatId===cat.id?null:cat.id); setFormSub({ icone:'•', nome:'' }) }}
                    style={{ padding:'5px 12px', background:'rgba(124,58,237,.15)', border:'1px solid rgba(124,58,237,.3)', borderRadius:6, color:C.purple, fontSize:12, fontWeight:700, cursor:'pointer' }}>
                    {formSubCatId===cat.id ? '× Fechar' : '+ Subcategoria'}
                  </button>
                </div>

                {/* Formulário inline: nova subcategoria */}
                {formSubCatId===cat.id && (
                  <div style={{ display:'flex', gap:8, alignItems:'flex-end', padding:'10px 12px', background:tema==='light'?'#faf5ff':'rgba(124,58,237,.06)', border:`1px solid rgba(124,58,237,.25)`, borderRadius:8, marginBottom:10, flexWrap:'wrap' }}>
                    <div style={{ width:56 }}>
                      <label style={{ fontSize:10, fontWeight:700, color:C.muted, display:'block', marginBottom:4 }}>ÍCONE</label>
                      <input value={formSub.icone} onChange={e=>setFormSub(m=>({...m,icone:e.target.value}))} placeholder="•"
                        style={{ width:'100%', padding:'8px', background:inputBg, border:`1px solid ${inputBrd}`, borderRadius:7, color:C.text, fontSize:16, textAlign:'center', boxSizing:'border-box' }}/>
                    </div>
                    <div style={{ flex:1, minWidth:140 }}>
                      <label style={{ fontSize:10, fontWeight:700, color:C.muted, display:'block', marginBottom:4 }}>NOME *</label>
                      <input autoFocus value={formSub.nome} onChange={e=>setFormSub(m=>({...m,nome:e.target.value}))} placeholder="Ex.: Elétrica"
                        onKeyDown={e=>{ if(e.key==='Enter') adicionarSubInline(cat.id) }}
                        style={{ width:'100%', padding:'8px 12px', background:inputBg, border:`1px solid ${inputBrd}`, borderRadius:7, color:C.text, fontSize:13, boxSizing:'border-box' }}/>
                    </div>
                    <button onClick={()=>adicionarSubInline(cat.id)} disabled={salvando}
                      style={{ padding:'9px 16px', background:C.purple, border:'none', borderRadius:7, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                      {salvando?'...':'+ Adicionar'}
                    </button>
                  </div>
                )}
                {subs.length === 0
                  ? <div style={{ fontSize:13, color:C.muted, padding:'8px 0' }}>Nenhuma subcategoria.</div>
                  : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:8 }}>
                    {subs.map(s => (
                      <div key={s.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', background:tema==='light'?'#f8f9fc':'rgba(255,255,255,.03)', borderRadius:8, opacity:s.ativo?1:.5 }}>
                        <span style={{ fontSize:16 }}>{s.icone}</span>
                        <span style={{ flex:1, fontSize:13, color:C.text }}>{s.nome}</span>
                        <button onClick={()=>setModalSub({...s})} style={{ background:'none', border:'none', color:C.muted, fontSize:11, cursor:'pointer' }}>✏</button>
                        <button onClick={()=>excluirSubcategoria(s.id)} style={{ background:'none', border:'none', color:C.red, fontSize:13, cursor:'pointer' }}>×</button>
                      </div>
                    ))}
                  </div>
                }
              </div>
            )}
          </div>
        )
      })}

      {/* Modal categoria */}
      {modalCat && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:80, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
          onClick={e=>e.target===e.currentTarget&&setModalCat(null)}>
          <div style={{ background:C.surface, borderRadius:16, padding:24, width:'100%', maxWidth:440, border:`1px solid ${C.border}` }}>
            <h3 style={{ fontSize:17, fontWeight:700, color:C.text, margin:'0 0 18px' }}>{modalCat.id?'Editar':'Nova'} categoria</h3>
            <div style={{ display:'flex', gap:10, marginBottom:12 }}>
              <div style={{ width:70 }}>
                <label style={{ fontSize:11, fontWeight:700, color:C.muted, display:'block', marginBottom:5 }}>ÍCONE</label>
                <input value={modalCat.icone||''} onChange={e=>setModalCat(m=>({...m,icone:e.target.value}))} placeholder="📋"
                  style={{ width:'100%', padding:'9px', background:inputBg, border:`1px solid ${inputBrd}`, borderRadius:8, color:C.text, fontSize:20, textAlign:'center' }}/>
              </div>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:11, fontWeight:700, color:C.muted, display:'block', marginBottom:5 }}>NOME *</label>
                <input value={modalCat.nome||''} onChange={e=>setModalCat(m=>({...m,nome:e.target.value}))} placeholder="Ex.: Manutenção"
                  style={{ width:'100%', padding:'9px 12px', background:inputBg, border:`1px solid ${inputBrd}`, borderRadius:8, color:C.text, fontSize:14, boxSizing:'border-box' }}/>
              </div>
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:11, fontWeight:700, color:C.muted, display:'block', marginBottom:5 }}>DESCRIÇÃO</label>
              <input value={modalCat.descricao||''} onChange={e=>setModalCat(m=>({...m,descricao:e.target.value}))} placeholder="Breve descrição"
                style={{ width:'100%', padding:'9px 12px', background:inputBg, border:`1px solid ${inputBrd}`, borderRadius:8, color:C.text, fontSize:14, boxSizing:'border-box' }}/>
            </div>
            <div style={{ display:'flex', gap:10, marginBottom:18 }}>
              <div style={{ width:90 }}>
                <label style={{ fontSize:11, fontWeight:700, color:C.muted, display:'block', marginBottom:5 }}>ORDEM</label>
                <input type="number" value={modalCat.ordem??''} onChange={e=>setModalCat(m=>({...m,ordem:e.target.value}))} placeholder="1"
                  style={{ width:'100%', padding:'9px 12px', background:inputBg, border:`1px solid ${inputBrd}`, borderRadius:8, color:C.text, fontSize:14, colorScheme:scheme, boxSizing:'border-box' }}/>
              </div>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:11, fontWeight:700, color:C.muted, display:'block', marginBottom:5 }}>SLA RESPOSTA (h)</label>
                <input type="number" min="0" value={modalCat.sla_resposta_horas??''} onChange={e=>setModalCat(m=>({...m,sla_resposta_horas:e.target.value}))} placeholder="24"
                  style={{ width:'100%', padding:'9px 12px', background:inputBg, border:`1px solid ${inputBrd}`, borderRadius:8, color:C.text, fontSize:14, colorScheme:scheme, boxSizing:'border-box' }}/>
              </div>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:11, fontWeight:700, color:C.muted, display:'block', marginBottom:5 }}>SLA RESOLUÇÃO (h)</label>
                <input type="number" min="0" value={modalCat.sla_resolucao_horas??''} onChange={e=>setModalCat(m=>({...m,sla_resolucao_horas:e.target.value}))} placeholder="72"
                  style={{ width:'100%', padding:'9px 12px', background:inputBg, border:`1px solid ${inputBrd}`, borderRadius:8, color:C.text, fontSize:14, colorScheme:scheme, boxSizing:'border-box' }}/>
              </div>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setModalCat(null)} style={{ flex:1, padding:'11px', background:'none', border:`1px solid ${C.border}`, borderRadius:8, color:C.text, fontSize:13, fontWeight:600, cursor:'pointer' }}>Cancelar</button>
              <button onClick={salvarCategoria} disabled={salvando} style={{ flex:1, padding:'11px', background:C.purple, border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                {salvando?'Salvando...':'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal subcategoria */}
      {modalSub && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:80, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
          onClick={e=>e.target===e.currentTarget&&setModalSub(null)}>
          <div style={{ background:C.surface, borderRadius:16, padding:24, width:'100%', maxWidth:400, border:`1px solid ${C.border}` }}>
            <h3 style={{ fontSize:17, fontWeight:700, color:C.text, margin:'0 0 18px' }}>{modalSub.id?'Editar':'Nova'} subcategoria</h3>
            <div style={{ display:'flex', gap:10, marginBottom:18 }}>
              <div style={{ width:70 }}>
                <label style={{ fontSize:11, fontWeight:700, color:C.muted, display:'block', marginBottom:5 }}>ÍCONE</label>
                <input value={modalSub.icone||''} onChange={e=>setModalSub(m=>({...m,icone:e.target.value}))} placeholder="•"
                  style={{ width:'100%', padding:'9px', background:inputBg, border:`1px solid ${inputBrd}`, borderRadius:8, color:C.text, fontSize:20, textAlign:'center' }}/>
              </div>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:11, fontWeight:700, color:C.muted, display:'block', marginBottom:5 }}>NOME *</label>
                <input value={modalSub.nome||''} onChange={e=>setModalSub(m=>({...m,nome:e.target.value}))} placeholder="Ex.: Elétrica"
                  style={{ width:'100%', padding:'9px 12px', background:inputBg, border:`1px solid ${inputBrd}`, borderRadius:8, color:C.text, fontSize:14, boxSizing:'border-box' }}/>
              </div>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setModalSub(null)} style={{ flex:1, padding:'11px', background:'none', border:`1px solid ${C.border}`, borderRadius:8, color:C.text, fontSize:13, fontWeight:600, cursor:'pointer' }}>Cancelar</button>
              <button onClick={salvarSubcategoria} disabled={salvando} style={{ flex:1, padding:'11px', background:C.purple, border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                {salvando?'Salvando...':'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal prioridade */}
      {modalPrio && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:80, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
          onClick={e=>e.target===e.currentTarget&&setModalPrio(null)}>
          <div style={{ background:C.surface, borderRadius:16, padding:24, width:'100%', maxWidth:440, border:`1px solid ${C.border}` }}>
            <h3 style={{ fontSize:17, fontWeight:700, color:C.text, margin:'0 0 18px' }}>{modalPrio.id?'Editar':'Nova'} prioridade</h3>
            <div style={{ display:'flex', gap:10, marginBottom:12 }}>
              <div style={{ width:70 }}>
                <label style={{ fontSize:11, fontWeight:700, color:C.muted, display:'block', marginBottom:5 }}>ÍCONE</label>
                <input value={modalPrio.icone||''} onChange={e=>setModalPrio(m=>({...m,icone:e.target.value}))} placeholder="🔴"
                  style={{ width:'100%', padding:'9px', background:inputBg, border:`1px solid ${inputBrd}`, borderRadius:8, color:C.text, fontSize:20, textAlign:'center' }}/>
              </div>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:11, fontWeight:700, color:C.muted, display:'block', marginBottom:5 }}>NOME *</label>
                <input value={modalPrio.nome||''} onChange={e=>setModalPrio(m=>({...m,nome:e.target.value}))} placeholder="Ex.: Urgente"
                  style={{ width:'100%', padding:'9px 12px', background:inputBg, border:`1px solid ${inputBrd}`, borderRadius:8, color:C.text, fontSize:14, boxSizing:'border-box' }}/>
              </div>
            </div>
            <div style={{ display:'flex', gap:10, marginBottom:18 }}>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:11, fontWeight:700, color:C.muted, display:'block', marginBottom:5 }}>COR</label>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <input type="color" value={modalPrio.cor||'#64748b'} onChange={e=>setModalPrio(m=>({...m,cor:e.target.value}))}
                    style={{ width:44, height:38, padding:2, background:inputBg, border:`1px solid ${inputBrd}`, borderRadius:8, cursor:'pointer', colorScheme:scheme }}/>
                  <input value={modalPrio.cor||''} onChange={e=>setModalPrio(m=>({...m,cor:e.target.value}))} placeholder="#dc2626"
                    style={{ flex:1, padding:'9px 12px', background:inputBg, border:`1px solid ${inputBrd}`, borderRadius:8, color:C.text, fontSize:14, boxSizing:'border-box' }}/>
                </div>
              </div>
              <div style={{ width:90 }}>
                <label style={{ fontSize:11, fontWeight:700, color:C.muted, display:'block', marginBottom:5 }}>ORDEM</label>
                <input type="number" value={modalPrio.ordem??''} onChange={e=>setModalPrio(m=>({...m,ordem:e.target.value}))} placeholder="1"
                  style={{ width:'100%', padding:'9px 12px', background:inputBg, border:`1px solid ${inputBrd}`, borderRadius:8, color:C.text, fontSize:14, colorScheme:scheme, boxSizing:'border-box' }}/>
              </div>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setModalPrio(null)} style={{ flex:1, padding:'11px', background:'none', border:`1px solid ${C.border}`, borderRadius:8, color:C.text, fontSize:13, fontWeight:600, cursor:'pointer' }}>Cancelar</button>
              <button onClick={salvarPrioridade} disabled={salvando} style={{ flex:1, padding:'11px', background:C.purple, border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                {salvando?'Salvando...':'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
