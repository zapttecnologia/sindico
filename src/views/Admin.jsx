import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { gerarCodigo } from '../lib/constants'

const PAPEL_LABEL = { morador:'Morador', equipe:'Síndico', admin:'Admin', conselheiro:'Conselheiro' }
const PAPEIS = ['morador','conselheiro','equipe','admin']
const SENHA_PADRAO = 'mudar123'
function initials(n){ return (n||'?').split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase() }

function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display:'flex', borderBottom:'2px solid var(--gray-200)', marginBottom:28, overflowX:'auto' }}>
      {tabs.map(t => (
        <button key={t.id} onClick={()=>onChange(t.id)} style={{
          padding:'12px 20px', fontWeight:600, fontSize:14, border:'none',
          background:'transparent', cursor:'pointer', whiteSpace:'nowrap',
          color: active===t.id ? 'var(--emerald)' : 'var(--gray-400)',
          borderBottom: active===t.id ? '2px solid var(--emerald)' : '2px solid transparent',
          marginBottom:-2, transition:'color .15s',
        }}>{t.icon} {t.label}</button>
      ))}
    </div>
  )
}

export default function Admin({ onToast }) {
  const [secao, setSecao] = useState('condominios')
  const [condominios, setCondominios] = useState([])
  const [blocos, setBlocos] = useState([])
  const [contas, setContas] = useState([])
  const [sindicoCondos, setSindicoCondos] = useState({})
  const [buscaConta, setBuscaConta] = useState('')
  const [filtroCondo, setFiltroCondo] = useState('todos')
  const [novoCondo, setNovoCondo] = useState('')
  const [modalConta, setModalConta] = useState(null)
  const [blocosCarregados, setBlocosCarregados] = useState(true) // false = tabela não existe

  // Form cadastro — ordem: papel → condo → bloco → apto → código auto
  const VAZIO = { nome:'', email:'', codigo:'', senha:SENHA_PADRAO, telefone:'', papel:'morador', condo:'', bloco:'', apto:'' }
  const [nm, setNm] = useState(VAZIO)
  const [nmCondosSindico, setNmCondosSindico] = useState([])
  const [salvando, setSalvando] = useState(false)

  // Novo bloco inline
  const [novoBloco, setNovoBloco] = useState({}) // { [condoId]: {nome:'', total:''} }

  const carregarCondos = useCallback(async () => {
    const { data } = await supabase.from('condominios').select('id,nome').order('nome')
    if (data) setCondominios(data)
  }, [])

  const carregarBlocos = useCallback(async () => {
    const { data, error } = await supabase.from('blocos').select('*').order('nome')
    if (error) {
      console.warn('Tabela blocos:', error.message)
      setBlocosCarregados(false)
    } else {
      setBlocos(data || [])
      setBlocosCarregados(true)
    }
  }, [])

  const carregarContas = useCallback(async () => {
    const { data } = await supabase.from('perfis')
      .select('id,nome,email,codigo_acesso,papel,condominio_id,telefone,primeiro_acesso,condominios(nome)')
      .order('criado_em',{ascending:false})
    if (data) setContas(data)
    const { data:sc } = await supabase.from('sindico_condominios').select('perfil_id,condominio_id')
    if (sc) {
      const map = {}
      sc.forEach(r=>{ if(!map[r.perfil_id]) map[r.perfil_id]=[]; map[r.perfil_id].push(r.condominio_id) })
      setSindicoCondos(map)
    }
  }, [])

  useEffect(() => { carregarCondos(); carregarBlocos(); carregarContas() }, [])

  // Gera código automático ao mudar condo/bloco/apto
  useEffect(() => {
    if (nm.papel !== 'morador' && nm.papel !== 'conselheiro') return
    if (!nm.condo) return
    const condo = condominios.find(c => c.id === nm.condo)
    if (!condo) return
    // Só gera quando pelo menos bloco OU apto estão preenchidos
    if (!nm.bloco && !nm.apto) return
    const auto = gerarCodigo(condo.nome, nm.bloco, nm.apto)
    if (auto) setNm(x => ({ ...x, codigo: auto }))
  }, [nm.condo, nm.bloco, nm.apto, nm.papel, condominios])

  const blocosDoCondo = (condoId) => blocos.filter(b => b.condominio_id === condoId)

  // ── Condomínios ────────────────────────────────────────────
  const adicionarCondo = async () => {
    if (!novoCondo.trim()) return
    const { error } = await supabase.from('condominios').insert({ nome: novoCondo.trim() })
    if (error) { onToast('Erro: '+error.message); return }
    setNovoCondo(''); onToast('Condomínio adicionado.'); carregarCondos()
  }
  const salvarNomeCondo = async (id, nome) => {
    const { error } = await supabase.from('condominios').update({ nome }).eq('id', id)
    if (error) { onToast('Erro ao salvar: '+error.message); return }
    onToast('Nome atualizado.'); carregarCondos()
  }
  const excluirCondo = async (id) => {
    if (!window.confirm('Excluir este condomínio? Os blocos serão removidos junto.')) return
    const { error } = await supabase.from('condominios').delete().eq('id', id)
    if (error) { onToast('Não foi possível excluir: '+error.message); return }
    onToast('Condomínio excluído.'); carregarCondos(); carregarBlocos()
  }

  // ── Blocos ─────────────────────────────────────────────────
  const adicionarBloco = async (condoId) => {
    const nb = novoBloco[condoId] || {}
    if (!nb.nome?.trim()) { onToast('Digite o nome do bloco.'); return }
    const { error } = await supabase.from('blocos').insert({
      condominio_id: condoId,
      nome: nb.nome.trim(),
      total_apartamentos: Number(nb.total) || 0,
    })
    if (error) { onToast('Erro: '+error.message); return }
    setNovoBloco(p => ({ ...p, [condoId]: { nome:'', total:'' } }))
    onToast('Bloco adicionado.'); carregarBlocos()
  }
  const excluirBloco = async (id) => {
    if (!window.confirm('Remover este bloco?')) return
    await supabase.from('blocos').delete().eq('id', id)
    onToast('Bloco removido.'); carregarBlocos()
  }

  // ── API ────────────────────────────────────────────────────
  const api = async (body) => {
    const session = (await supabase.auth.getSession()).data.session
    const URL = import.meta.env.VITE_SUPABASE_URL
    const r = await fetch(`${URL}/functions/v1/admin-actions`, {
      method:'POST',
      headers:{'Content-Type':'application/json', Authorization:`Bearer ${session?.access_token}`},
      body: JSON.stringify(body),
    })
    const json = await r.json()
    if (!r.ok) throw new Error(json.error || 'Erro')
    return json
  }

  const cadastrarUsuario = async () => {
    if (!nm.nome || !nm.email || !nm.codigo || nm.senha.length < 4) { onToast('Preencha nome, e-mail, código e senha.'); return }
    if ((nm.papel==='morador'||nm.papel==='conselheiro') && !nm.condo) { onToast('Selecione o condomínio.'); return }
    setSalvando(true)
    try {
      await api({
        action:'create_user', email:nm.email, password:nm.senha,
        nome:nm.nome, telefone:nm.telefone, codigo_acesso:nm.codigo.toUpperCase(),
        papel:nm.papel,
        condominio_id:(nm.papel==='morador'||nm.papel==='conselheiro')?nm.condo:null,
        bloco:nm.bloco, apartamento:nm.apto,
        condominios_sindico: nm.papel==='equipe' ? nmCondosSindico : [],
      })
      onToast(`✅ Usuário cadastrado! Código: ${nm.codigo.toUpperCase()} · Senha: ${nm.senha}`)
      setNm(VAZIO); setNmCondosSindico([]); carregarContas()
    } catch(e) { onToast('Erro: '+e.message) }
    setSalvando(false)
  }

  const salvarConta = async () => {
    if (!modalConta) return
    const { error } = await supabase.from('perfis').update({
      nome:modalConta.nome, telefone:modalConta.telefone,
      codigo_acesso:modalConta.codigo_acesso?.toUpperCase(),
      papel:modalConta.papel,
      condominio_id:(modalConta.papel==='morador'||modalConta.papel==='conselheiro')?modalConta.condominio_id:null,
    }).eq('id', modalConta.id)
    if (error) { onToast('Erro: '+error.message); return }
    if (modalConta.papel==='equipe') {
      await supabase.rpc('definir_condominios_sindico',{p_perfil_id:modalConta.id,p_condominio_ids:modalConta.condosSindico||[]})
    }
    onToast('Salvo.'); setModalConta(null); carregarContas()
  }

  const resetarSenha = async () => {
    if (!modalConta?.novaSenha || modalConta.novaSenha.length < 4) { onToast('Senha muito curta.'); return }
    try { await api({action:'reset_password',user_id:modalConta.id,new_password:modalConta.novaSenha}); onToast('Senha alterada.') }
    catch(e) { onToast('Erro: '+e.message) }
  }

  const excluirConta = async () => {
    if (!window.confirm('Excluir definitivamente?')) return
    try { await api({action:'delete_user',user_id:modalConta.id}); onToast('Excluído.'); setModalConta(null); carregarContas() }
    catch(e) { onToast('Erro: '+e.message) }
  }

  const contasFiltradas = contas.filter(c => {
    if (filtroCondo!=='todos' && c.condominio_id!==filtroCondo && !(sindicoCondos[c.id]||[]).includes(filtroCondo)) return false
    const t = buscaConta.toLowerCase()
    return !t||(c.nome||'').toLowerCase().includes(t)||(c.email||'').toLowerCase().includes(t)||(c.codigo_acesso||'').toLowerCase().includes(t)
  })

  // Blocos do condo selecionado no formulário de cadastro
  const blocosDisponiveis = nm.condo ? blocosDoCondo(nm.condo) : []

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Administração</h1>
        <p className="page-sub">Condomínios, blocos e usuários</p>
      </div>

      <TabBar
        tabs={[
          {id:'condominios', label:'Condomínios', icon:'🏢'},
          {id:'contas',      label:'Contas',       icon:'👤'},
          {id:'cadastrar',   label:'Cadastrar',    icon:'➕'},
        ]}
        active={secao}
        onChange={setSecao}
      />

      {/* ─────────────────── ABA CONDOMÍNIOS ─────────────────── */}
      {secao==='condominios' && (
        <div>
          {!blocosCarregados && (
            <div style={{ background:'#FFF3DC', border:'1.5px solid #F4A340', borderRadius:'var(--r-md)', padding:'14px 16px', marginBottom:20, fontSize:14 }}>
              ⚠️ <strong>Execute o arquivo <code>fix-schema.sql</code> no SQL Editor do Supabase</strong> para habilitar o cadastro de blocos.
            </div>
          )}

          {/* Lista de condomínios existentes */}
          {condominios.map(c => {
            let nomeEdit = c.nome
            const bls = blocosDoCondo(c.id)
            const totalUnidades = bls.reduce((s,b)=>s+(b.total_apartamentos||0), 0)
            const nb = novoBloco[c.id] || { nome:'', total:'' }

            return (
              <div key={c.id} className="card" style={{ marginBottom:16 }}>
                {/* Cabeçalho do condomínio */}
                <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom: blocosCarregados ? 16 : 0 }}>
                  <input
                    className="input"
                    style={{ border:'none', padding:'4px 0', fontWeight:700, background:'transparent', fontSize:16, flex:1, minWidth:140 }}
                    defaultValue={c.nome}
                    onChange={e => { nomeEdit = e.target.value }}
                  />
                  <div style={{ fontSize:12, color:'var(--gray-400)', whiteSpace:'nowrap' }}>
                    {bls.length} bloco{bls.length!==1?'s':''} · {totalUnidades} unidade{totalUnidades!==1?'s':''}
                  </div>
                  <div style={{ display:'flex', gap:6 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => salvarNomeCondo(c.id, nomeEdit)}>Salvar nome</button>
                    <button className="btn btn-danger btn-sm" onClick={() => excluirCondo(c.id)}>Excluir</button>
                  </div>
                </div>

                {/* Blocos — sempre visíveis */}
                {blocosCarregados && (
                  <div style={{ borderTop:'1px solid var(--gray-100)', paddingTop:14 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:'var(--gray-600)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>
                      Blocos e unidades
                    </div>

                    {bls.length === 0 && (
                      <p style={{ fontSize:13, color:'var(--gray-400)', margin:'0 0 12px' }}>
                        Nenhum bloco cadastrado. Adicione abaixo.
                      </p>
                    )}

                    {/* Lista de blocos */}
                    {bls.map(b => (
                      <div key={b.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid var(--gray-100)' }}>
                        <div style={{ width:36, height:36, borderRadius:'var(--r-sm)', background:'var(--mint)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontSize:12, fontWeight:700, color:'var(--emerald)', flexShrink:0 }}>
                          {b.nome.slice(0,2).toUpperCase()}
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:700, fontSize:14 }}>{b.nome}</div>
                          <div style={{ fontSize:12, color:'var(--gray-400)' }}>{b.total_apartamentos} unidade{b.total_apartamentos!==1?'s':''}</div>
                        </div>
                        <button className="btn btn-danger btn-sm" onClick={() => excluirBloco(b.id)}>Remover</button>
                      </div>
                    ))}

                    {/* Formulário de novo bloco */}
                    <div style={{ display:'flex', gap:8, marginTop:14, alignItems:'flex-end', flexWrap:'wrap' }}>
                      <div style={{ flex:'2 1 130px' }}>
                        <label style={{ fontSize:11, fontWeight:700, color:'var(--gray-600)', textTransform:'uppercase', display:'block', marginBottom:4 }}>Nome do bloco</label>
                        <input
                          className="input"
                          placeholder="Ex.: Bloco A"
                          value={nb.nome}
                          onChange={e => setNovoBloco(p=>({...p,[c.id]:{...nb,nome:e.target.value}}))}
                          onKeyDown={e => e.key==='Enter' && adicionarBloco(c.id)}
                          style={{ fontSize:13 }}
                        />
                      </div>
                      <div style={{ flex:'1 1 80px' }}>
                        <label style={{ fontSize:11, fontWeight:700, color:'var(--gray-600)', textTransform:'uppercase', display:'block', marginBottom:4 }}>Unidades</label>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          placeholder="Ex.: 70"
                          value={nb.total}
                          onChange={e => setNovoBloco(p=>({...p,[c.id]:{...nb,total:e.target.value}}))}
                          style={{ fontSize:13 }}
                        />
                      </div>
                      <button className="btn btn-primary btn-sm" onClick={() => adicionarBloco(c.id)} style={{ marginBottom:1 }}>
                        + Adicionar bloco
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* Adicionar novo condomínio */}
          <div className="card">
            <p style={{ fontSize:13, fontWeight:700, color:'var(--gray-600)', margin:'0 0 12px' }}>
              + Novo condomínio
            </p>
            <div className="row2">
              <input className="input" placeholder="Nome do condomínio" value={novoCondo} onChange={e=>setNovoCondo(e.target.value)} onKeyDown={e=>e.key==='Enter'&&adicionarCondo()} />
              <button className="btn btn-primary" onClick={adicionarCondo}>Adicionar</button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────── ABA CONTAS ─────────────────── */}
      {secao==='contas' && (
        <div>
          <div className="card" style={{ marginBottom:12 }}>
            <div className="row2">
              <input className="input" placeholder="Buscar nome, e-mail ou código..." value={buscaConta} onChange={e=>setBuscaConta(e.target.value)} />
              <select className="input" value={filtroCondo} onChange={e=>setFiltroCondo(e.target.value)}>
                <option value="todos">Todos os condomínios</option>
                {condominios.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          </div>
          {['admin','equipe','conselheiro','morador'].map(papel => {
            const grupo = contasFiltradas.filter(c=>c.papel===papel)
            if (!grupo.length) return null
            return (
              <div key={papel} className="card" style={{ marginBottom:12 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
                  <span className={`badge badge-${papel}`}>{PAPEL_LABEL[papel]}</span>
                  <span style={{ fontSize:12, color:'var(--gray-400)' }}>{grupo.length} conta{grupo.length!==1?'s':''}</span>
                </div>
                {grupo.map(c => {
                  const condosNomes = c.papel==='equipe'
                    ? (sindicoCondos[c.id]||[]).map(id=>condominios.find(x=>x.id===id)?.nome).filter(Boolean).join(', ')
                    : c.condominios?.nome
                  return (
                    <div key={c.id} className="manage-row">
                      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                        <div style={{ width:38, height:38, borderRadius:'50%', background:'var(--mint)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontSize:13, fontWeight:700, color:'var(--emerald)', flexShrink:0 }}>
                          {initials(c.nome)}
                        </div>
                        <div className="info">
                          <strong>
                            {c.nome||'(sem nome)'}
                            {c.primeiro_acesso===true && (
                              <span style={{ fontSize:10, background:'#FFF3DC', color:'#8A5A00', padding:'2px 6px', borderRadius:4, marginLeft:6, fontWeight:600 }}>1º acesso</span>
                            )}
                          </strong>
                          <span>
                            {c.codigo_acesso ? `Código: ${c.codigo_acesso}` : ''}
                            {condosNomes ? ` · ${condosNomes}` : ''}
                            {c.telefone ? ` · ${c.telefone}` : ''}
                          </span>
                        </div>
                      </div>
                      <div className="actions">
                        {c.telefone && (
                          <a className="btn btn-ghost btn-sm" href={`https://wa.me/55${c.telefone.replace(/\D/g,'')}`} target="_blank" rel="noopener">WhatsApp</a>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={()=>setModalConta({...c,condosSindico:sindicoCondos[c.id]||[],novaSenha:''})}>Editar</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
          {contasFiltradas.length===0 && <div className="empty-state">Nenhuma conta encontrada.</div>}
        </div>
      )}

      {/* ─────────────────── ABA CADASTRAR ─────────────────── */}
      {secao==='cadastrar' && (
        <div className="card">
          <h3 className="section-title">Novo usuário</h3>

          <div style={{ background:'var(--mint)', borderRadius:'var(--r-md)', padding:'12px 14px', marginBottom:24, fontSize:13, color:'var(--emerald)' }}>
            🔑 Senha padrão: <b>{SENHA_PADRAO}</b> — o usuário criará uma senha pessoal no primeiro acesso.
          </div>

          {/* Dados pessoais */}
          <div className="row2">
            <div className="field"><label>Nome completo *</label><input className="input" value={nm.nome} onChange={e=>setNm(x=>({...x,nome:e.target.value}))} /></div>
            <div className="field"><label>Telefone (WhatsApp)</label><input className="input" value={nm.telefone} onChange={e=>setNm(x=>({...x,telefone:e.target.value}))} placeholder="(11) 9..." /></div>
          </div>
          <div className="field">
            <label>E-mail * <span style={{ fontSize:10, color:'var(--gray-400)', fontWeight:400 }}>(não usado para login)</span></label>
            <input className="input" type="email" value={nm.email} onChange={e=>setNm(x=>({...x,email:e.target.value}))} />
          </div>

          {/* Papel */}
          <div className="field">
            <label>Papel</label>
            <div className="chip-row">
              {PAPEIS.map(p=>(
                <button key={p}
                  className={`chip${nm.papel===p?' selected':''}`}
                  onClick={()=>setNm(x=>({...x,papel:p,condo:'',bloco:'',apto:'',codigo:''}))}
                >{PAPEL_LABEL[p]}</button>
              ))}
            </div>
          </div>

          {/* Fluxo morador/conselheiro: condo → bloco → apto → código */}
          {(nm.papel==='morador'||nm.papel==='conselheiro') && (
            <>
              {/* Passo 1: Condomínio */}
              <div className="field">
                <label>
                  <span style={{ background:'var(--emerald)', color:'#fff', borderRadius:999, padding:'2px 8px', fontSize:11, fontWeight:700, marginRight:8 }}>1</span>
                  Condomínio *
                </label>
                <select className="input" value={nm.condo} onChange={e=>setNm(x=>({...x,condo:e.target.value,bloco:'',apto:'',codigo:''}))}>
                  <option value="">Selecione o condomínio...</option>
                  {condominios.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>

              {/* Passo 2: Bloco (só aparece após selecionar condomínio) */}
              {nm.condo && (
                <div className="field">
                  <label>
                    <span style={{ background:'var(--emerald)', color:'#fff', borderRadius:999, padding:'2px 8px', fontSize:11, fontWeight:700, marginRight:8 }}>2</span>
                    Bloco *
                  </label>
                  {blocosDisponiveis.length > 0 ? (
                    <select className="input" value={nm.bloco} onChange={e=>setNm(x=>({...x,bloco:e.target.value,apto:'',codigo:''}))}>
                      <option value="">Selecione o bloco...</option>
                      {blocosDisponiveis.map(b=>(
                        <option key={b.id} value={b.nome}>{b.nome} — {b.total_apartamentos} unidade{b.total_apartamentos!==1?'s':''}</option>
                      ))}
                    </select>
                  ) : (
                    <div>
                      <input className="input" placeholder="Ex.: Bloco A" value={nm.bloco} onChange={e=>setNm(x=>({...x,bloco:e.target.value}))} />
                      <p className="hint">
                        💡 Cadastre os blocos deste condomínio na aba <b>Condomínios</b> para ter um menu de seleção aqui.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Passo 3: Apartamento (só aparece após selecionar bloco) */}
              {nm.condo && nm.bloco && (
                <div className="field">
                  <label>
                    <span style={{ background:'var(--emerald)', color:'#fff', borderRadius:999, padding:'2px 8px', fontSize:11, fontWeight:700, marginRight:8 }}>3</span>
                    Apartamento / Unidade *
                  </label>
                  <input className="input" placeholder="Ex.: 302" value={nm.apto} onChange={e=>setNm(x=>({...x,apto:e.target.value}))} />
                </div>
              )}

              {/* Código gerado automaticamente */}
              {nm.codigo && (
                <div className="field">
                  <label>
                    <span style={{ background:'var(--emerald)', color:'#fff', borderRadius:999, padding:'2px 8px', fontSize:11, fontWeight:700, marginRight:8 }}>4</span>
                    Código de acesso
                    <span style={{ fontSize:11, color:'var(--emerald)', fontWeight:600, marginLeft:8 }}>✅ gerado automaticamente</span>
                  </label>
                  <input
                    className="input"
                    value={nm.codigo}
                    onChange={e=>setNm(x=>({...x,codigo:e.target.value.toUpperCase()}))}
                    style={{ fontFamily:'var(--font-mono)', fontSize:18, fontWeight:700, letterSpacing:2, color:'var(--emerald)', borderColor:'var(--emerald)' }}
                  />
                  <p className="hint">Pode editar manualmente se precisar.</p>
                </div>
              )}

              {/* Se condo+bloco+apto preenchidos mas código ainda não gerou */}
              {nm.condo && nm.bloco && nm.apto && !nm.codigo && (
                <div className="field">
                  <label>
                    <span style={{ background:'var(--emerald)', color:'#fff', borderRadius:999, padding:'2px 8px', fontSize:11, fontWeight:700, marginRight:8 }}>4</span>
                    Código de acesso *
                  </label>
                  <input className="input" placeholder="Ex.: JDCB302" value={nm.codigo} onChange={e=>setNm(x=>({...x,codigo:e.target.value.toUpperCase()}))} />
                </div>
              )}
            </>
          )}

          {/* Síndico: condomínios atribuídos */}
          {nm.papel==='equipe' && (
            <>
              <div className="field">
                <label>Código de acesso *</label>
                <input className="input" value={nm.codigo} onChange={e=>setNm(x=>({...x,codigo:e.target.value.toUpperCase()}))} placeholder="Ex.: SINDICO01" />
              </div>
              <div className="field">
                <label>Condomínios atribuídos</label>
                <div style={{ border:'1.5px solid var(--gray-200)', borderRadius:'var(--r-md)', padding:'10px 14px', maxHeight:180, overflowY:'auto', background:'var(--gray-50)' }}>
                  {condominios.map(c=>(
                    <label key={c.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 0', cursor:'pointer', fontSize:14 }}>
                      <input type="checkbox" checked={nmCondosSindico.includes(c.id)} onChange={()=>setNmCondosSindico(p=>p.includes(c.id)?p.filter(x=>x!==c.id):[...p,c.id])} />
                      {c.nome}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {nm.papel==='admin' && (
            <>
              <div className="field">
                <label>Código de acesso *</label>
                <input className="input" value={nm.codigo} onChange={e=>setNm(x=>({...x,codigo:e.target.value.toUpperCase()}))} placeholder="Ex.: ADMIN01" />
              </div>
              <div style={{ padding:'12px 14px', background:'var(--mint)', borderRadius:'var(--r-md)', marginBottom:16, fontSize:13, color:'var(--emerald)' }}>
                Admins têm acesso a todos os condomínios automaticamente.
              </div>
            </>
          )}

          {/* Senha (sempre visível) */}
          <div className="field">
            <label>Senha inicial</label>
            <input className="input" value={nm.senha} onChange={e=>setNm(x=>({...x,senha:e.target.value}))} />
          </div>

          <button className="btn btn-primary btn-block" onClick={cadastrarUsuario} disabled={salvando}>
            {salvando ? 'Cadastrando...' : 'Cadastrar usuário'}
          </button>
        </div>
      )}

      {/* ─────────────────── MODAL EDITAR CONTA ─────────────────── */}
      {modalConta && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModalConta(null)}>
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Editar conta</h3>
              <button className="modal-close" onClick={()=>setModalConta(null)}>✕</button>
            </div>
            <div className="field"><label>Nome</label><input className="input" value={modalConta.nome||''} onChange={e=>setModalConta(m=>({...m,nome:e.target.value}))} /></div>
            <div className="row2">
              <div className="field"><label>Telefone</label><input className="input" value={modalConta.telefone||''} onChange={e=>setModalConta(m=>({...m,telefone:e.target.value}))} /></div>
              <div className="field"><label>Código de acesso</label><input className="input" value={modalConta.codigo_acesso||''} onChange={e=>setModalConta(m=>({...m,codigo_acesso:e.target.value.toUpperCase()}))} /></div>
            </div>
            <div className="field"><label>Papel</label>
              <select className="input" value={modalConta.papel} onChange={e=>setModalConta(m=>({...m,papel:e.target.value}))}>
                {PAPEIS.map(p=><option key={p} value={p}>{PAPEL_LABEL[p]}</option>)}
              </select>
            </div>
            {(modalConta.papel==='morador'||modalConta.papel==='conselheiro') && (
              <div className="field"><label>Condomínio</label>
                <select className="input" value={modalConta.condominio_id||''} onChange={e=>setModalConta(m=>({...m,condominio_id:e.target.value}))}>
                  <option value="">Sem condomínio</option>
                  {condominios.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            )}
            {modalConta.papel==='equipe' && (
              <div className="field"><label>Condomínios atribuídos</label>
                <div style={{ border:'1.5px solid var(--gray-200)', borderRadius:'var(--r-md)', padding:'10px 14px', maxHeight:160, overflowY:'auto', background:'var(--gray-50)' }}>
                  {condominios.map(c=>(
                    <label key={c.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'5px 0', cursor:'pointer', fontSize:14 }}>
                      <input type="checkbox" checked={modalConta.condosSindico?.includes(c.id)||false} onChange={()=>setModalConta(m=>({...m,condosSindico:m.condosSindico.includes(c.id)?m.condosSindico.filter(x=>x!==c.id):[...m.condosSindico,c.id]}))} /> {c.nome}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <button className="btn btn-primary btn-block" onClick={salvarConta}>Salvar dados</button>
            <hr className="divider"/>
            <div className="row2">
              <input className="input" type="text" placeholder="Nova senha" value={modalConta.novaSenha||''} onChange={e=>setModalConta(m=>({...m,novaSenha:e.target.value}))} />
              <button className="btn btn-ghost" onClick={resetarSenha}>Resetar</button>
            </div>
            <hr className="divider"/>
            <button className="btn btn-danger btn-block" onClick={excluirConta}>Excluir conta</button>
          </div>
        </div>
      )}
    </div>
  )
}
