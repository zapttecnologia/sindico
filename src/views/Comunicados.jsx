import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'

const MAX_BYTES = 10 * 1024 * 1024  // 10MB por arquivo
const BUCKET = 'anexos-comunicados'

// Data e hora fixas: "16/07 14:30"
const fmtDataHora = (d) => {
  if (!d) return '—'
  const dt = new Date(d)
  return dt.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }) + ' ' +
         dt.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })
}

export default function Comunicados({ onToast }) {
  const { perfil } = useAuth()
  const ehAdmin = perfil?.papel === 'admin'

  const [condominios, setCondominios] = useState([])
  const [comunicados, setComunicados] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroCondo, setFiltroCondo] = useState('todos')

  // Modal de criar/editar
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState(null)   // comunicado em edição (ou null = novo)
  const [passo, setPasso] = useState(1)             // 1=condomínio, 2=público, 3=conteúdo
  const [condoSel, setCondoSel] = useState('')
  const [publico, setPublico] = useState('')        // 'moradores' | 'conselho'
  const [titulo, setTitulo] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [arquivos, setArquivos] = useState([])
  const [salvando, setSalvando] = useState(false)

  // Modal de exclusão
  const [excluindo, setExcluindo] = useState(null)

  const carregarCondos = async () => {
    if (ehAdmin) {
      const { data } = await supabase.from('condominios').select('id, nome').order('nome')
      if (data) setCondominios(data)
    } else {
      const { data } = await supabase.from('sindico_condominios')
        .select('condominio_id, condominios(nome)').eq('perfil_id', perfil?.id)
      if (data) setCondominios(data.map(r => ({ id:r.condominio_id, nome:r.condominios?.nome||'' })))
    }
  }

  const carregar = async () => {
    setLoading(true)
    const { data } = await supabase.from('comunicados')
      .select('*, condominios(nome), comunicado_anexos(id, nome, caminho)')
      .order('criado_em', { ascending:false })
    if (data) setComunicados(data)
    setLoading(false)
  }

  useEffect(() => { carregarCondos(); carregar() }, [])

  const abrirNovo = () => {
    setEditando(null); setPasso(1)
    setCondoSel(condominios.length === 1 ? condominios[0].id : '')
    setPublico(''); setTitulo(''); setMensagem(''); setArquivos([])
    setModalAberto(true)
  }

  const abrirEdicao = (c) => {
    setEditando(c); setPasso(3)
    setCondoSel(c.condominio_id); setPublico(c.publico)
    setTitulo(c.titulo); setMensagem(c.mensagem); setArquivos([])
    setModalAberto(true)
  }

  const fechar = () => { setModalAberto(false); setEditando(null) }

  const publicar = async () => {
    if (!condoSel) { onToast('Selecione o condomínio.'); return }
    if (!publico) { onToast('Selecione o público-alvo.'); return }
    if (!titulo.trim() || !mensagem.trim()) { onToast('Preencha título e mensagem.'); return }
    setSalvando(true)

    let comunicadoId = editando?.id
    if (editando) {
      const { error } = await supabase.from('comunicados').update({
        titulo: titulo.trim(), mensagem: mensagem.trim(), publico,
        atualizado_em: new Date().toISOString(),
      }).eq('id', editando.id)
      if (error) { setSalvando(false); onToast('Erro: '+error.message); return }
    } else {
      const { data, error } = await supabase.from('comunicados').insert({
        condominio_id: condoSel, autor_id: perfil?.id, autor_nome: perfil?.nome,
        titulo: titulo.trim(), mensagem: mensagem.trim(), publico,
      }).select().single()
      if (error) { setSalvando(false); onToast('Erro: '+error.message); return }
      comunicadoId = data.id
    }

    // Upload dos anexos (se houver)
    for (const file of arquivos) {
      const nomeSeguro = file.name.replace(/[^\w.\-]/g, '_')
      const caminho = `${comunicadoId}/${Date.now()}_${nomeSeguro}`
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(caminho, file)
      if (!upErr) {
        await supabase.from('comunicado_anexos').insert({
          comunicado_id: comunicadoId, nome: file.name, caminho,
        })
      }
    }

    setSalvando(false)
    onToast(editando ? 'Comunicado atualizado.' : 'Comunicado publicado.')
    fechar()
    await carregar()
  }

  const excluir = async () => {
    if (!excluindo) return
    const { error } = await supabase.from('comunicados').delete().eq('id', excluindo.id)
    if (error) { onToast('Erro: '+error.message); return }
    onToast('Comunicado excluído.')
    setExcluindo(null)
    await carregar()
  }

  const baixarAnexo = async (caminho, nome) => {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(caminho, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    else onToast('Não foi possível abrir o anexo.')
  }

  const listaFiltrada = comunicados.filter(c => filtroCondo === 'todos' || c.condominio_id === filtroCondo)

  const badgePublico = (p) => p === 'conselho'
    ? { txt:'⭐ Conselho', bg:'#eef2ff', cor:'#4338ca' }
    : { txt:'👥 Moradores', bg:'var(--mint)', cor:'var(--emerald)' }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginBottom:20, flexWrap:'wrap' }}>
        <div>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:700, color:'var(--navy)', margin:'0 0 4px' }}>
            Comunicados
          </h2>
          <p style={{ fontSize:13, color:'var(--gray-400)', margin:0 }}>Envie avisos aos moradores e ao conselho</p>
        </div>
        <button className="btn btn-primary" onClick={abrirNovo}>+ Novo comunicado</button>
      </div>

      {/* Filtro por condomínio */}
      {condominios.length > 1 && (
        <div style={{ marginBottom:16, maxWidth:280 }}>
          <select className="input" value={filtroCondo} onChange={e=>setFiltroCondo(e.target.value)}>
            <option value="todos">Todos os condomínios</option>
            {condominios.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="empty-state">Carregando...</div>
      ) : listaFiltrada.length === 0 ? (
        <div className="empty-state">Nenhum comunicado ainda. Clique em "Novo comunicado" para começar.</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {listaFiltrada.map(c => {
            const bd = badgePublico(c.publico)
            const anexos = c.comunicado_anexos || []
            return (
              <div key={c.id} className="card" style={{ padding:'16px 20px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, flexWrap:'wrap' }}>
                  <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:'var(--r-full)', background:bd.bg, color:bd.cor }}>
                    {bd.txt}
                  </span>
                  <span style={{ fontSize:12, color:'var(--gray-500)', fontWeight:600 }}>{c.condominios?.nome}</span>
                  <span style={{ fontSize:11, color:'var(--gray-400)', marginLeft:'auto' }}>{fmtDataHora(c.criado_em)}</span>
                </div>
                <div style={{ fontSize:16, fontWeight:700, color:'var(--navy)', marginBottom:4 }}>{c.titulo}</div>
                <div style={{ fontSize:14, color:'var(--gray-600)', lineHeight:1.5, whiteSpace:'pre-wrap', marginBottom:10 }}>{c.mensagem}</div>

                {anexos.length > 0 && (
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
                    {anexos.map(a => (
                      <button key={a.id} onClick={()=>baixarAnexo(a.caminho, a.nome)}
                        style={{ display:'inline-flex', alignItems:'center', gap:4, background:'var(--gray-100)',
                          border:'none', padding:'5px 12px', borderRadius:'var(--r-full)', fontSize:12, cursor:'pointer', color:'var(--navy)' }}>
                        📎 {a.nome}
                      </button>
                    ))}
                  </div>
                )}

                <div style={{ display:'flex', gap:8, borderTop:'1px solid var(--gray-100)', paddingTop:10 }}>
                  <button onClick={()=>abrirEdicao(c)}
                    style={{ background:'none', border:'none', color:'var(--blue)', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                    ✏️ Editar
                  </button>
                  <button onClick={()=>setExcluindo(c)}
                    style={{ background:'none', border:'none', color:'var(--rust)', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                    🗑️ Excluir
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal criar/editar */}
      {modalAberto && (
        <Modal open onClose={fechar} title={editando ? 'Editar comunicado' : 'Novo comunicado'} size="lg">
          {/* PASSO 1 — Condomínio (só no novo) */}
          {!editando && passo === 1 && (
            <>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>
                Para qual condomínio?
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:10 }}>
                {condominios.map(c => (
                  <div key={c.id} className={`cat-card${condoSel===c.id?' selected':''}`}
                    onClick={()=>{ setCondoSel(c.id); setPasso(2) }} style={{ padding:'16px 10px' }}>
                    <div className="cat-card-icon" style={{ fontSize:24 }}>🏢</div>
                    <div className="cat-card-nome" style={{ fontSize:13 }}>{c.nome}</div>
                  </div>
                ))}
              </div>
              {condominios.length === 0 && <div className="empty-state">Nenhum condomínio disponível.</div>}
            </>
          )}

          {/* PASSO 2 — Público-alvo */}
          {!editando && passo === 2 && (
            <>
              <button onClick={()=>setPasso(1)} style={{ background:'var(--gray-100)', border:'none', borderRadius:'var(--r-md)', padding:'6px 12px', fontSize:13, fontWeight:600, color:'var(--gray-600)', cursor:'pointer', marginBottom:14 }}>← Voltar</button>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>
                Enviar para quem?
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div className={`cat-card${publico==='moradores'?' selected':''}`} onClick={()=>{ setPublico('moradores'); setPasso(3) }} style={{ padding:'18px 10px' }}>
                  <div className="cat-card-icon" style={{ fontSize:26 }}>👥</div>
                  <div className="cat-card-nome">Moradores</div>
                  <div style={{ fontSize:10, color:'var(--gray-400)', marginTop:2 }}>O conselho também recebe</div>
                </div>
                <div className={`cat-card${publico==='conselho'?' selected':''}`} onClick={()=>{ setPublico('conselho'); setPasso(3) }} style={{ padding:'18px 10px' }}>
                  <div className="cat-card-icon" style={{ fontSize:26 }}>⭐</div>
                  <div className="cat-card-nome">Somente conselho</div>
                  <div style={{ fontSize:10, color:'var(--gray-400)', marginTop:2 }}>Moradores não veem</div>
                </div>
              </div>
            </>
          )}

          {/* PASSO 3 — Conteúdo */}
          {(editando || passo === 3) && (
            <>
              {!editando && (
                <button onClick={()=>setPasso(2)} style={{ background:'var(--gray-100)', border:'none', borderRadius:'var(--r-md)', padding:'6px 12px', fontSize:13, fontWeight:600, color:'var(--gray-600)', cursor:'pointer', marginBottom:14 }}>← Voltar</button>
              )}
              <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', fontSize:12, color:'var(--gray-500)' }}>
                <span style={{ fontWeight:700, padding:'3px 10px', borderRadius:'var(--r-full)', background:badgePublico(publico).bg, color:badgePublico(publico).cor }}>
                  {badgePublico(publico).txt}
                </span>
                <span style={{ padding:'3px 0', fontWeight:600, color:'var(--navy)' }}>
                  {condominios.find(c=>c.id===condoSel)?.nome}
                </span>
              </div>

              <div className="field"><label>Título *</label>
                <input className="input" value={titulo} onChange={e=>setTitulo(e.target.value)} placeholder="Ex.: Manutenção da caixa d'água" />
              </div>
              <div className="field"><label>Mensagem *</label>
                <textarea className="input" rows={6} value={mensagem} onChange={e=>setMensagem(e.target.value)} placeholder="Escreva o comunicado..." />
              </div>

              <div className="field"><label>Anexos (opcional)</label>
                <input type="file" multiple onChange={e=>{
                  const novos = Array.from(e.target.files||[]).filter(f=>f.size<=MAX_BYTES)
                  const grandes = Array.from(e.target.files||[]).filter(f=>f.size>MAX_BYTES)
                  if (grandes.length) onToast(`Ignorados (acima de 10MB): ${grandes.map(f=>f.name).join(', ')}`)
                  setArquivos(a=>[...a,...novos].slice(0,5))
                  e.target.value = ''
                }} style={{ fontSize:13 }}/>
                <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:4 }}>Até 5 arquivos, 10MB cada.</div>
                {arquivos.length > 0 && (
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:8 }}>
                    {arquivos.map((f,i)=>(
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:4, background:'var(--gray-100)', padding:'4px 10px', borderRadius:'var(--r-full)', fontSize:11 }}>
                        📎 {f.name.slice(0,24)}
                        <button onClick={()=>setArquivos(a=>a.filter((_,j)=>j!==i))} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--rust)', fontSize:14 }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
                {editando && (editando.comunicado_anexos||[]).length > 0 && (
                  <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:8 }}>
                    Anexos já publicados são mantidos. Os novos serão adicionados.
                  </div>
                )}
              </div>

              <button className="btn btn-primary btn-block" onClick={publicar} disabled={salvando}>
                {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : '📢 Publicar comunicado'}
              </button>
            </>
          )}
        </Modal>
      )}

      {/* Modal excluir */}
      {excluindo && (
        <Modal open onClose={()=>setExcluindo(null)} title="Excluir comunicado" size="sm">
          <p style={{ fontSize:14, color:'var(--gray-600)', margin:'0 0 20px' }}>
            Tem certeza que deseja excluir <b>"{excluindo.titulo}"</b>? Esta ação não pode ser desfeita.
          </p>
          <div style={{ display:'flex', gap:10 }}>
            <button className="btn" style={{ flex:1, background:'var(--gray-100)', color:'var(--gray-600)', border:'none' }} onClick={()=>setExcluindo(null)}>Cancelar</button>
            <button className="btn" style={{ flex:1, background:'var(--rust)', color:'#fff', border:'none' }} onClick={excluir}>Excluir</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
