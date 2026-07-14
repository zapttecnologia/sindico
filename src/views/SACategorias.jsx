import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function SACategorias({ C, tema, onToast }) {
  const [categorias, setCategorias] = useState([])
  const [subcategorias, setSubcategorias] = useState({}) // { categoria_id: [...] }
  const [loading, setLoading] = useState(true)
  const [expandido, setExpandido] = useState(null)
  const [modalCat, setModalCat] = useState(null)      // objeto ou {} para novo
  const [modalSub, setModalSub] = useState(null)      // { categoria_id, ...sub }
  const [salvando, setSalvando] = useState(false)

  const inputBg = tema==='light' ? '#fff' : '#1c2333'
  const inputBrd = tema==='light' ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.1)'

  const carregar = async () => {
    setLoading(true)
    const { data:cats } = await supabase.from('categorias_sistema').select('*').order('ordem')
    const { data:subs } = await supabase.from('subcategorias_sistema').select('*').order('ordem')
    const agrupado = {}
    ;(subs||[]).forEach(s => {
      if (!agrupado[s.categoria_id]) agrupado[s.categoria_id] = []
      agrupado[s.categoria_id].push(s)
    })
    setCategorias(cats||[])
    setSubcategorias(agrupado)
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

  if (loading) return <div style={{ padding:40, textAlign:'center', color:C.muted }}>Carregando...</div>

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:800, color:C.text, margin:0 }}>Categorias do sistema</h2>
          <p style={{ fontSize:13, color:C.muted, margin:'4px 0 0' }}>Gerencie categorias e subcategorias disponíveis para os condomínios</p>
        </div>
        <button onClick={()=>setModalCat({ ativo:true })}
          style={{ padding:'9px 16px', background:C.purple, border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
          + Nova categoria
        </button>
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
                <div style={{ fontSize:12, color:C.muted }}>{subs.length} subcategoria{subs.length!==1?'s':''}{cat.descricao?` · ${cat.descricao}`:''}</div>
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
                  <button onClick={()=>setModalSub({ categoria_id:cat.id, ativo:true })}
                    style={{ padding:'5px 12px', background:'rgba(124,58,237,.15)', border:'1px solid rgba(124,58,237,.3)', borderRadius:6, color:C.purple, fontSize:12, fontWeight:700, cursor:'pointer' }}>
                    + Subcategoria
                  </button>
                </div>
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
            <div style={{ marginBottom:18 }}>
              <label style={{ fontSize:11, fontWeight:700, color:C.muted, display:'block', marginBottom:5 }}>ORDEM</label>
              <input type="number" value={modalCat.ordem||''} onChange={e=>setModalCat(m=>({...m,ordem:e.target.value}))} placeholder="1"
                style={{ width:100, padding:'9px 12px', background:inputBg, border:`1px solid ${inputBrd}`, borderRadius:8, color:C.text, fontSize:14, boxSizing:'border-box' }}/>
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
    </div>
  )
}
