import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'

// Formata "2026-07-16T14:30" -> "16/07/2026 14:30"
const fmtEvento = (inicio, fim, diaInteiro) => {
  if (!inicio) return ''
  const di = new Date(inicio)
  const data = di.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' })
  if (diaInteiro) return `${data} · dia inteiro`
  const hi = di.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })
  if (fim) {
    const df = new Date(fim)
    const mesmodia = di.toDateString() === df.toDateString()
    const hf = df.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })
    if (mesmodia) return `${data} · ${hi} às ${hf}`
    const dataF = df.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' })
    return `${data} ${hi} → ${dataF} ${hf}`
  }
  return `${data} · ${hi}`
}

// Converte timestamptz do banco -> valor de <input type="datetime-local">
const paraInputLocal = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const off = d.getTimezoneOffset()
  const local = new Date(d.getTime() - off * 60000)
  return local.toISOString().slice(0, 16)
}

export default function Agenda({ onToast }) {
  const { perfil } = useAuth()
  const ehAdmin = perfil?.papel === 'admin'

  const [condominios, setCondominios] = useState([])
  const [eventos, setEventos] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroCondo, setFiltroCondo] = useState('todos')

  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState(null)
  const [passo, setPasso] = useState(1)          // 1=condomínio, 2=público, 3=conteúdo
  const [condoSel, setCondoSel] = useState('')
  const [publico, setPublico] = useState('')
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [local, setLocal] = useState('')
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [diaInteiro, setDiaInteiro] = useState(false)
  const [salvando, setSalvando] = useState(false)
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
    const { data } = await supabase.from('eventos')
      .select('*, condominios(nome)')
      .order('inicio', { ascending:true })
    if (data) setEventos(data)
    setLoading(false)
  }

  useEffect(() => { carregarCondos(); carregar() }, [])

  const abrirNovo = () => {
    setEditando(null); setPasso(1)
    setCondoSel(condominios.length === 1 ? condominios[0].id : '')
    setPublico(''); setTitulo(''); setDescricao(''); setLocal('')
    setInicio(''); setFim(''); setDiaInteiro(false)
    setModalAberto(true)
  }

  const abrirEdicao = (e) => {
    setEditando(e); setPasso(3)
    setCondoSel(e.condominio_id); setPublico(e.publico)
    setTitulo(e.titulo); setDescricao(e.descricao||''); setLocal(e.local||'')
    setInicio(paraInputLocal(e.inicio)); setFim(paraInputLocal(e.fim)); setDiaInteiro(e.dia_inteiro)
    setModalAberto(true)
  }

  const fechar = () => { setModalAberto(false); setEditando(null) }

  const salvar = async () => {
    if (!condoSel) { onToast('Selecione o condomínio.'); return }
    if (!publico) { onToast('Selecione o público-alvo.'); return }
    if (!titulo.trim()) { onToast('Informe o título do evento.'); return }
    if (!inicio) { onToast('Informe a data do evento.'); return }
    setSalvando(true)

    const dados = {
      titulo: titulo.trim(), descricao: descricao.trim() || null, local: local.trim() || null,
      inicio: new Date(inicio).toISOString(),
      fim: (!diaInteiro && fim) ? new Date(fim).toISOString() : null,
      dia_inteiro: diaInteiro, publico,
    }

    if (editando) {
      const { error } = await supabase.from('eventos')
        .update({ ...dados, atualizado_em: new Date().toISOString() }).eq('id', editando.id)
      if (error) { setSalvando(false); onToast('Erro: '+error.message); return }
    } else {
      const { error } = await supabase.from('eventos').insert({
        ...dados, condominio_id: condoSel, autor_id: perfil?.id, autor_nome: perfil?.nome,
      })
      if (error) { setSalvando(false); onToast('Erro: '+error.message); return }
    }

    setSalvando(false)
    onToast(editando ? 'Evento atualizado.' : 'Evento publicado.')
    fechar()
    await carregar()
  }

  const excluir = async () => {
    if (!excluindo) return
    const { error } = await supabase.from('eventos').delete().eq('id', excluindo.id)
    if (error) { onToast('Erro: '+error.message); return }
    onToast('Evento excluído.')
    setExcluindo(null)
    await carregar()
  }

  const listaFiltrada = eventos.filter(e => filtroCondo === 'todos' || e.condominio_id === filtroCondo)
  const agora = new Date()
  const proximos = listaFiltrada.filter(e => new Date(e.fim || e.inicio) >= agora)
  const passados = listaFiltrada.filter(e => new Date(e.fim || e.inicio) < agora)

  const badgePublico = (p) => p === 'conselho'
    ? { txt:'⭐ Conselho', bg:'#eef2ff', cor:'#4338ca' }
    : { txt:'👥 Moradores', bg:'var(--mint)', cor:'var(--emerald)' }

  const CardEvento = ({ e, passado }) => {
    const bd = badgePublico(e.publico)
    return (
      <div className="card" style={{ padding:'14px 18px', opacity: passado ? .65 : 1 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, flexWrap:'wrap' }}>
          <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:'var(--r-full)', background:bd.bg, color:bd.cor }}>{bd.txt}</span>
          <span style={{ fontSize:12, color:'var(--gray-500)', fontWeight:600 }}>{e.condominios?.nome}</span>
        </div>
        <div style={{ fontSize:16, fontWeight:700, color:'var(--navy)', marginBottom:2 }}>{e.titulo}</div>
        <div style={{ fontSize:13, color:'var(--blue)', fontWeight:600, marginBottom:6 }}>
          🗓️ {fmtEvento(e.inicio, e.fim, e.dia_inteiro)}{e.local ? ` · 📍 ${e.local}` : ''}
        </div>
        {e.descricao && <div style={{ fontSize:13, color:'var(--gray-600)', lineHeight:1.5, whiteSpace:'pre-wrap', marginBottom:8 }}>{e.descricao}</div>}
        <div style={{ display:'flex', gap:8, borderTop:'1px solid var(--gray-100)', paddingTop:8 }}>
          <button onClick={()=>abrirEdicao(e)} style={{ background:'none', border:'none', color:'var(--blue)', fontSize:13, fontWeight:600, cursor:'pointer' }}>✏️ Editar</button>
          <button onClick={()=>setExcluindo(e)} style={{ background:'none', border:'none', color:'var(--rust)', fontSize:13, fontWeight:600, cursor:'pointer' }}>🗑️ Excluir</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginBottom:20, flexWrap:'wrap' }}>
        <div>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:700, color:'var(--navy)', margin:'0 0 4px' }}>Agenda</h2>
          <p style={{ fontSize:13, color:'var(--gray-400)', margin:0 }}>Eventos e avisos do condomínio</p>
        </div>
        <button className="btn btn-primary" onClick={abrirNovo}>+ Novo evento</button>
      </div>

      {condominios.length > 1 && (
        <div style={{ marginBottom:16, maxWidth:280 }}>
          <select className="input" value={filtroCondo} onChange={e=>setFiltroCondo(e.target.value)}>
            <option value="todos">Todos os condomínios</option>
            {condominios.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
      )}

      {loading ? (
        <div className="empty-state">Carregando...</div>
      ) : listaFiltrada.length === 0 ? (
        <div className="empty-state">Nenhum evento ainda. Clique em "Novo evento" para começar.</div>
      ) : (
        <>
          {proximos.length > 0 && (
            <>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:'.05em', margin:'0 0 10px' }}>Próximos</div>
              <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:24 }}>
                {proximos.map(e => <CardEvento key={e.id} e={e} />)}
              </div>
            </>
          )}
          {passados.length > 0 && (
            <>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.05em', margin:'0 0 10px' }}>Já realizados</div>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {passados.slice().reverse().map(e => <CardEvento key={e.id} e={e} passado />)}
              </div>
            </>
          )}
        </>
      )}

      {/* Modal criar/editar */}
      {modalAberto && (
        <Modal open onClose={fechar} title={editando ? 'Editar evento' : 'Novo evento'} size="lg">
          {/* PASSO 1 — Condomínio */}
          {!editando && passo === 1 && (
            <>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>Para qual condomínio?</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:10 }}>
                {condominios.map(c => (
                  <div key={c.id} className={`cat-card${condoSel===c.id?' selected':''}`} onClick={()=>{ setCondoSel(c.id); setPasso(2) }} style={{ padding:'16px 10px' }}>
                    <div className="cat-card-icon" style={{ fontSize:24 }}>🏢</div>
                    <div className="cat-card-nome" style={{ fontSize:13 }}>{c.nome}</div>
                  </div>
                ))}
              </div>
              {condominios.length === 0 && <div className="empty-state">Nenhum condomínio disponível.</div>}
            </>
          )}

          {/* PASSO 2 — Público */}
          {!editando && passo === 2 && (
            <>
              <button onClick={()=>setPasso(1)} style={{ background:'var(--gray-100)', border:'none', borderRadius:'var(--r-md)', padding:'6px 12px', fontSize:13, fontWeight:600, color:'var(--gray-600)', cursor:'pointer', marginBottom:14 }}>← Voltar</button>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>Para quem é o evento?</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div className={`cat-card${publico==='moradores'?' selected':''}`} onClick={()=>{ setPublico('moradores'); setPasso(3) }} style={{ padding:'18px 10px' }}>
                  <div className="cat-card-icon" style={{ fontSize:26 }}>👥</div>
                  <div className="cat-card-nome">Moradores</div>
                  <div style={{ fontSize:10, color:'var(--gray-400)', marginTop:2 }}>O conselho também vê</div>
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
              <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', fontSize:12 }}>
                <span style={{ fontWeight:700, padding:'3px 10px', borderRadius:'var(--r-full)', background:badgePublico(publico).bg, color:badgePublico(publico).cor }}>{badgePublico(publico).txt}</span>
                <span style={{ padding:'3px 0', fontWeight:600, color:'var(--navy)' }}>{condominios.find(c=>c.id===condoSel)?.nome}</span>
              </div>

              <div className="field"><label>Título *</label>
                <input className="input" value={titulo} onChange={e=>setTitulo(e.target.value)} placeholder="Ex.: Assembleia geral ordinária" />
              </div>

              <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', marginBottom:12 }}>
                <input type="checkbox" checked={diaInteiro} onChange={e=>setDiaInteiro(e.target.checked)} style={{ width:16, height:16 }}/>
                <span style={{ fontSize:14 }}>Evento de dia inteiro</span>
              </label>

              <div className="row2">
                <div className="field"><label>{diaInteiro ? 'Data *' : 'Início *'}</label>
                  <input className="input" type={diaInteiro ? 'date' : 'datetime-local'}
                    value={diaInteiro ? (inicio||'').slice(0,10) : inicio}
                    onChange={e=>setInicio(diaInteiro ? e.target.value + 'T00:00' : e.target.value)} />
                </div>
                {!diaInteiro && (
                  <div className="field"><label>Término (opcional)</label>
                    <input className="input" type="datetime-local" value={fim} onChange={e=>setFim(e.target.value)} />
                  </div>
                )}
              </div>

              <div className="field"><label>Local (opcional)</label>
                <input className="input" value={local} onChange={e=>setLocal(e.target.value)} placeholder="Ex.: Salão de festas" />
              </div>
              <div className="field"><label>Descrição (opcional)</label>
                <textarea className="input" rows={4} value={descricao} onChange={e=>setDescricao(e.target.value)} placeholder="Detalhes do evento..." />
              </div>

              <button className="btn btn-primary btn-block" onClick={salvar} disabled={salvando}>
                {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : '🗓️ Publicar evento'}
              </button>
            </>
          )}
        </Modal>
      )}

      {/* Modal excluir */}
      {excluindo && (
        <Modal open onClose={()=>setExcluindo(null)} title="Excluir evento" size="sm">
          <p style={{ fontSize:14, color:'var(--gray-600)', margin:'0 0 20px' }}>
            Excluir <b>"{excluindo.titulo}"</b>? Esta ação não pode ser desfeita.
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
