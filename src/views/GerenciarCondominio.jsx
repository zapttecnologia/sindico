import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import ImportarMoradores from '../components/ImportarMoradores'

const SENHA_PADRAO = 'mudar123'
const PAPEL_LABEL = {
  morador:'Morador', conselheiro:'Conselheiro', equipe:'Síndico', admin:'Admin',
  manutencao:'Manutenção', limpeza:'Limpeza', administradora:'Administradora',
  portaria:'Portaria', seguranca:'Segurança', zeladoria:'Zeladoria', terceiros:'Terceiros',
}
const PAPEL_COR = {
  morador:'var(--gray-400)', conselheiro:'#8b5cf6', equipe:'var(--emerald)', admin:'var(--amber)',
  manutencao:'#0ea5e9', limpeza:'#06b6d4', administradora:'#f59e0b', portaria:'#a855f7',
  seguranca:'#ef4444', zeladoria:'#84cc16', terceiros:'var(--gray-400)',
}
const PAPEIS_RESIDENTES = ['morador','conselheiro']
const PAPEIS_DEPT = ['manutencao','limpeza','administradora','portaria','seguranca','zeladoria','terceiros']

function BlocoRow({ bloco, totalUsuarios, onSave, onDelete }) {
  const [editando, setEditando] = useState(false)
  const [nome, setNome] = useState(bloco.nome)
  const [total, setTotal] = useState(bloco.total_apartamentos || 0)

  const salvar = async () => {
    await onSave(nome, total)
    setEditando(false)
  }

  return (
    <div style={{ background:'#fff', border:'1px solid var(--gray-200)', borderRadius:'var(--r-md)', marginBottom:8, overflow:'hidden' }}>
      {!editando ? (
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px' }}>
          <span style={{ fontSize:20 }}>🏢</span>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:600, color:'var(--navy)' }}>{bloco.nome}</div>
            <div style={{ fontSize:12, color:'var(--gray-400)', marginTop:2 }}>
              {bloco.total_apartamentos > 0 ? `${bloco.total_apartamentos} unidade${bloco.total_apartamentos!==1?'s':''}` : 'Unidades não informadas'}
              {' · '}
              {totalUsuarios} usuário{totalUsuarios!==1?'s':''}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={()=>setEditando(true)}>Editar</button>
          <button onClick={onDelete}
            style={{ background:'none', border:'none', color:'var(--rust)', fontSize:13, cursor:'pointer', fontWeight:600 }}>
            Excluir
          </button>
        </div>
      ) : (
        <div style={{ padding:'14px 16px', background:'var(--gray-50)' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 180px', gap:10, marginBottom:10 }}>
            <div className="field" style={{ margin:0 }}>
              <label style={{ fontSize:11 }}>Nome do bloco</label>
              <input className="input" value={nome} onChange={e=>setNome(e.target.value)} placeholder="Ex.: Bloco A"/>
            </div>
            <div className="field" style={{ margin:0 }}>
              <label style={{ fontSize:11 }}>Qtd. de unidades</label>
              <input className="input" type="number" value={total} onChange={e=>setTotal(e.target.value)} placeholder="Ex.: 20" min="0"/>
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-primary btn-sm" onClick={salvar}>💾 Salvar</button>
            <button className="btn btn-ghost btn-sm" onClick={()=>{ setEditando(false); setNome(bloco.nome); setTotal(bloco.total_apartamentos||0) }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function GerenciarCondominio({ condominio, onVoltar, onToast }) {
  const { perfil } = useAuth()
  const [aba, setAba] = useState('usuarios')
  const [usuarios, setUsuarios] = useState([])
  const [blocos, setBlocos] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroPapel, setFiltroPapel] = useState('todos')
  const [modalNovo, setModalNovo] = useState(false)
  const [modalEditar, setModalEditar] = useState(null)
  const [modalImportar, setModalImportar] = useState(false)
  const [novoConta, setNovoConta] = useState({ nome:'', email:'', codigo:'', senha:SENHA_PADRAO, papel:'morador', bloco:'', apto:'', tipo_ocupacao:'proprietario' })
  const [novoBloco, setNovoBloco] = useState('')
  const [condoEdit, setCondoEdit] = useState({ ...condominio })
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    const [{ data:u }, { data:b }] = await Promise.all([
      supabase.from('perfis').select('id,nome,email,papel,codigo_acesso,bloco,apartamento,tipo_ocupacao,primeiro_acesso')
        .eq('condominio_id', condominio.id).order('papel').order('nome'),
      supabase.from('blocos').select('*').eq('condominio_id', condominio.id).order('nome'),
    ])
    setUsuarios(u||[]); setBlocos(b||[])
    setLoading(false)
  }, [condominio.id])

  useEffect(() => { carregar() }, [carregar])

  const api = async (body) => {
    const { data:s } = await supabase.auth.getSession()
    const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-actions`, {
      method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${s.session?.access_token}`},
      body: JSON.stringify(body),
    })
    const json = await r.json()
    if (!r.ok) throw new Error(json.error || 'Erro')
    return json
  }

  const criarUsuario = async () => {
    if (!novoConta.nome || !novoConta.email || !novoConta.codigo) {
      onToast('Preencha nome, e-mail e código.'); return
    }
    setSalvando(true)
    try {
      await api({ action:'create_user', email:novoConta.email, password:novoConta.senha,
        nome:novoConta.nome, papel:novoConta.papel, empresa_id:perfil?.empresa_id,
        codigo_acesso:novoConta.codigo.toUpperCase(), condominio_id:condominio.id,
        bloco:novoConta.bloco, apartamento:novoConta.apto, tipo_ocupacao:novoConta.tipo_ocupacao })
      onToast('Usuário criado!'); setModalNovo(false)
      setNovoConta({ nome:'', email:'', codigo:'', senha:SENHA_PADRAO, papel:'morador', bloco:'', apto:'', tipo_ocupacao:'proprietario' })
      await carregar()
    } catch(e) { onToast('Erro: '+e.message) }
    setSalvando(false)
  }

  const salvarUsuario = async () => {
    if (!modalEditar) return
    setSalvando(true)
    const { error } = await supabase.from('perfis').update({
      nome: modalEditar.nome,
      codigo_acesso: modalEditar.codigo_acesso?.toUpperCase(),
      bloco: modalEditar.bloco, apartamento: modalEditar.apartamento,
      tipo_ocupacao: modalEditar.tipo_ocupacao,
    }).eq('id', modalEditar.id)
    setSalvando(false)
    if (error) { onToast('Erro: '+error.message); return }
    onToast('Salvo!'); setModalEditar(null); await carregar()
  }

  const resetarSenha = async () => {
    if (!modalEditar?.novaSenha || modalEditar.novaSenha.length < 4) { onToast('Senha mínimo 4 caracteres.'); return }
    try { await api({ action:'reset_password', user_id:modalEditar.id, new_password:modalEditar.novaSenha }); onToast('Senha alterada!') }
    catch(e) { onToast('Erro: '+e.message) }
  }

  const excluirUsuario = async () => {
    if (!window.confirm(`Excluir ${modalEditar?.nome}?`)) return
    try { await api({ action:'delete_user', user_id:modalEditar.id }); onToast('Excluído.'); setModalEditar(null); await carregar() }
    catch(e) { onToast('Erro: '+e.message) }
  }

  const adicionarBloco = async () => {
    if (!novoBloco.trim()) return
    await supabase.from('blocos').insert({ condominio_id:condominio.id, nome:novoBloco.trim(), total_apartamentos:0 })
    setNovoBloco(''); onToast('Bloco adicionado.'); await carregar()
  }

  const salvarCondominio = async () => {
    setSalvando(true)
    const { error } = await supabase.from('condominios').update(condoEdit).eq('id', condominio.id)
    setSalvando(false)
    if (error) { onToast('Erro: '+error.message); return }
    onToast('Condomínio atualizado!')
  }

  const usuariosFiltrados = usuarios.filter(u => {
    if (busca && !u.nome?.toLowerCase().includes(busca.toLowerCase()) && !u.codigo_acesso?.toLowerCase().includes(busca.toLowerCase())) return false
    if (filtroPapel !== 'todos' && u.papel !== filtroPapel) return false
    return true
  })

  const blocosDoCondo = blocos.map(b => b.nome)

  const kpis = {
    total: usuarios.length,
    moradores: usuarios.filter(u => u.papel === 'morador').length,
    conselheiros: usuarios.filter(u => u.papel === 'conselheiro').length,
    dept: usuarios.filter(u => PAPEIS_DEPT.includes(u.papel)).length,
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:24, flexWrap:'wrap' }}>
        <button onClick={onVoltar} style={{ background:'var(--gray-100)', border:'none', borderRadius:'var(--r-md)',
          padding:'8px 14px', fontSize:13, fontWeight:600, color:'var(--gray-600)', cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
          ← Voltar
        </button>
        <div style={{ flex:1 }}>
          <h1 style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:800, color:'var(--navy)', margin:0 }}>
            {condominio.nome}
          </h1>
          <p style={{ fontSize:13, color:'var(--gray-400)', margin:'2px 0 0' }}>
            {kpis.moradores} morador{kpis.moradores!==1?'es':''} · {kpis.conselheiros} conselheiro{kpis.conselheiros!==1?'s':''} · {kpis.dept} equipe operacional
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:10, marginBottom:20 }}>
        {[
          { l:'Total', v:kpis.total, c:'var(--navy)' },
          { l:'Moradores', v:kpis.moradores, c:'var(--gray-600)' },
          { l:'Conselheiros', v:kpis.conselheiros, c:'#8b5cf6' },
          { l:'Operacional', v:kpis.dept, c:'var(--emerald)' },
        ].map(k => (
          <div key={k.l} style={{ background:'#fff', border:'1px solid var(--gray-200)', borderRadius:'var(--r-lg)', padding:'12px 16px', textAlign:'center' }}>
            <div style={{ fontFamily:'var(--font-display)', fontSize:26, fontWeight:800, color:k.c }}>{k.v}</div>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.04em', marginTop:4 }}>{k.l}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'2px solid var(--gray-200)', marginBottom:20 }}>
        {[['usuarios','👥 Usuários'],['blocos','🏢 Blocos'],['configuracoes','⚙️ Dados do condomínio']].map(([id,label]) => (
          <button key={id} onClick={() => setAba(id)} style={{
            padding:'10px 18px', background:'none', border:'none', cursor:'pointer', fontSize:13, fontWeight:600,
            color:aba===id?'var(--emerald)':'var(--gray-400)',
            borderBottom:aba===id?'2px solid var(--emerald)':'2px solid transparent', marginBottom:-2 }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── ABA USUÁRIOS ── */}
      {aba==='usuarios' && (
        <div>
          <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
            <input placeholder="Buscar por nome ou código..." value={busca} onChange={e=>setBusca(e.target.value)}
              className="input" style={{ maxWidth:240 }}/>
            <select value={filtroPapel} onChange={e=>setFiltroPapel(e.target.value)} className="input" style={{ maxWidth:180 }}>
              <option value="todos">Todos os papéis</option>
              <option value="morador">Moradores</option>
              <option value="conselheiro">Conselheiros</option>
              <optgroup label="Departamentos">
                {PAPEIS_DEPT.map(p=><option key={p} value={p}>{PAPEL_LABEL[p]}</option>)}
              </optgroup>
            </select>
            <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
              <button className="btn btn-ghost btn-sm" onClick={()=>setModalImportar(true)}
                style={{ display:'flex', alignItems:'center', gap:6 }}>
                📊 Importar Excel
              </button>
              <button className="btn btn-primary btn-sm" onClick={()=>setModalNovo(true)}>
                + Novo usuário
              </button>
            </div>
          </div>

          {loading && <div className="empty-state">Carregando...</div>}

          {!loading && usuariosFiltrados.length === 0 && (
            <div className="empty-state">
              {busca || filtroPapel!=='todos' ? 'Nenhum usuário encontrado com esses filtros.' : 'Nenhum usuário cadastrado neste condomínio.'}
            </div>
          )}

          {/* Tabela de usuários */}
          {!loading && usuariosFiltrados.length > 0 && (
            <div style={{ border:'1px solid var(--gray-200)', borderRadius:'var(--r-lg)', overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ background:'var(--gray-50)', borderBottom:'1px solid var(--gray-200)' }}>
                    {['Usuário','Papel','Bloco/Ap.','Tipo','Código','Status',''].map(h=>(
                      <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:11, fontWeight:700,
                        color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.04em', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {usuariosFiltrados.map((u,i) => (
                    <tr key={u.id} style={{ borderBottom:'1px solid var(--gray-100)', background:i%2===0?'#fff':'var(--gray-50)' }}>
                      <td style={{ padding:'10px 12px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--mint)',
                            display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'var(--emerald)', flexShrink:0 }}>
                            {(u.nome||'?')[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight:600, color:'var(--gray-800)' }}>{u.nome||'—'}</div>
                            <div style={{ fontSize:11, color:'var(--gray-400)' }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding:'10px 12px' }}>
                        <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:5,
                          background:'var(--gray-100)', color:PAPEL_COR[u.papel]||'var(--gray-400)',
                          textTransform:'uppercase', letterSpacing:'.03em' }}>
                          {PAPEL_LABEL[u.papel]||u.papel}
                        </span>
                      </td>
                      <td style={{ padding:'10px 12px', color:'var(--gray-500)', fontSize:12 }}>
                        {u.bloco ? `${u.bloco}${u.apartamento?' · Ap '+u.apartamento:''}` : '—'}
                      </td>
                      <td style={{ padding:'10px 12px', fontSize:12, color:'var(--gray-500)' }}>
                        {u.tipo_ocupacao === 'inquilino' ? '🔑 Inquilino' : u.tipo_ocupacao === 'proprietario' ? '🏠 Proprietário' : '—'}
                      </td>
                      <td style={{ padding:'10px 12px', fontFamily:'monospace', color:'var(--navy)', fontSize:12 }}>
                        {u.codigo_acesso||'—'}
                      </td>
                      <td style={{ padding:'10px 12px' }}>
                        {u.primeiro_acesso === true
                          ? <span style={{ fontSize:10, background:'#fff3dc', color:'#8a5a00', padding:'2px 7px', borderRadius:4, fontWeight:700 }}>1º acesso</span>
                          : <span style={{ fontSize:11, color:'var(--emerald)', fontWeight:600 }}>✓ Ativo</span>}
                      </td>
                      <td style={{ padding:'10px 12px' }}>
                        <button className="btn btn-ghost btn-sm" onClick={()=>setModalEditar({...u,novaSenha:''})}>Editar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── ABA BLOCOS ── */}
      {aba==='blocos' && (
        <div>
          {blocos.length === 0 && <div className="empty-state">Nenhum bloco cadastrado.</div>}
          {blocos.map(b => (
            <BlocoRow key={b.id} bloco={b} totalUsuarios={usuarios.filter(u=>u.bloco===b.nome).length}
              onSave={async(nome,total)=>{
                await supabase.from('blocos').update({ nome, total_apartamentos:Number(total)||0 }).eq('id',b.id)
                onToast('Bloco salvo.'); await carregar()
              }}
              onDelete={async()=>{
                if(window.confirm('Excluir bloco?')){ await supabase.from('blocos').delete().eq('id',b.id); await carregar() }
              }}
            />
          ))}
          <div style={{ display:'flex', gap:10, marginTop:12 }}>
            <input className="input" placeholder="Nome do bloco (ex: Bloco A)" value={novoBloco} onChange={e=>setNovoBloco(e.target.value)}
              style={{ flex:1 }} onKeyDown={e=>e.key==='Enter'&&adicionarBloco()}/>
            <button className="btn btn-primary" onClick={adicionarBloco}>+ Adicionar bloco</button>
          </div>
        </div>
      )}

      {/* ── ABA CONFIGURAÇÕES ── */}
      {aba==='configuracoes' && (
        <div className="card">
          <h3 className="section-title">Dados do condomínio</h3>
          <div className="row2">
            <div className="field"><label>Nome *</label><input className="input" value={condoEdit.nome||''} onChange={e=>setCondoEdit(c=>({...c,nome:e.target.value}))}/></div>
            <div className="field"><label>CNPJ</label><input className="input" value={condoEdit.cnpj||''} onChange={e=>setCondoEdit(c=>({...c,cnpj:e.target.value}))}/></div>
          </div>
          <div className="row2">
            <div className="field"><label>Total de unidades</label><input className="input" type="number" value={condoEdit.total_unidades||''} onChange={e=>setCondoEdit(c=>({...c,total_unidades:e.target.value}))}/></div>
            <div className="field"><label>Ano de construção</label><input className="input" type="number" value={condoEdit.ano_construcao||''} onChange={e=>setCondoEdit(c=>({...c,ano_construcao:e.target.value}))}/></div>
          </div>
          <h4 style={{ fontSize:13, fontWeight:700, color:'var(--gray-500)', marginBottom:10 }}>Endereço</h4>
          <div className="row2">
            <div className="field"><label>Logradouro</label><input className="input" value={condoEdit.endereco_logradouro||''} onChange={e=>setCondoEdit(c=>({...c,endereco_logradouro:e.target.value}))}/></div>
            <div className="field"><label>Bairro</label><input className="input" value={condoEdit.endereco_bairro||''} onChange={e=>setCondoEdit(c=>({...c,endereco_bairro:e.target.value}))}/></div>
          </div>
          <div className="row2">
            <div className="field"><label>Cidade</label><input className="input" value={condoEdit.endereco_cidade||''} onChange={e=>setCondoEdit(c=>({...c,endereco_cidade:e.target.value}))}/></div>
            <div className="field"><label>UF</label><input className="input" value={condoEdit.endereco_uf||''} onChange={e=>setCondoEdit(c=>({...c,endereco_uf:e.target.value}))}/></div>
          </div>
          <h4 style={{ fontSize:13, fontWeight:700, color:'var(--gray-500)', marginBottom:10 }}>Síndico responsável</h4>
          <div className="row2">
            <div className="field"><label>Nome do síndico</label><input className="input" value={condoEdit.sindico_nome||''} onChange={e=>setCondoEdit(c=>({...c,sindico_nome:e.target.value}))}/></div>
            <div className="field"><label>Telefone</label><input className="input" value={condoEdit.sindico_telefone||''} onChange={e=>setCondoEdit(c=>({...c,sindico_telefone:e.target.value}))}/></div>
          </div>
          <button className="btn btn-primary" onClick={salvarCondominio} disabled={salvando}>
            {salvando?'Salvando...':'💾 Salvar dados do condomínio'}
          </button>
        </div>
      )}

      {/* Modal novo usuário */}
      {modalNovo && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModalNovo(false)}>
          <div className="modal" style={{ maxHeight:'90vh', overflowY:'auto' }}>
            <div className="modal-header">
              <h3 className="modal-title">Novo usuário — {condominio.nome}</h3>
              <button className="modal-close" onClick={()=>setModalNovo(false)}>✕</button>
            </div>
            <div style={{ padding:'10px 12px', background:'var(--mint)', borderRadius:'var(--r-md)', marginBottom:16, fontSize:13, color:'var(--emerald)' }}>
              Senha padrão: <b>mudar123</b> — o usuário troca no 1º acesso.
            </div>
            <div className="field"><label>Nome *</label><input className="input" value={novoConta.nome} onChange={e=>setNovoConta(x=>({...x,nome:e.target.value}))}/></div>
            <div className="field"><label>E-mail *</label><input className="input" type="email" value={novoConta.email} onChange={e=>setNovoConta(x=>({...x,email:e.target.value}))}/></div>
            <div className="field"><label>Papel</label>
              <div style={{ marginBottom:6 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', marginBottom:6 }}>Residentes</div>
                <div className="chip-row">
                  {PAPEIS_RESIDENTES.map(p=><button key={p} className={`chip${novoConta.papel===p?' selected':''}`} onClick={()=>setNovoConta(x=>({...x,papel:p}))}>{PAPEL_LABEL[p]}</button>)}
                </div>
              </div>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', marginBottom:6 }}>Departamentos operacionais</div>
                <div className="chip-row">
                  {PAPEIS_DEPT.map(p=><button key={p} className={`chip${novoConta.papel===p?' selected':''}`} onClick={()=>setNovoConta(x=>({...x,papel:p}))}>{PAPEL_LABEL[p]}</button>)}
                </div>
              </div>
            </div>
            {PAPEIS_RESIDENTES.includes(novoConta.papel) && (
              <div className="row2">
                <div className="field">
                  <label>Bloco</label>
                  {blocosDoCondo.length > 0
                    ? <select className="input" value={novoConta.bloco} onChange={e=>setNovoConta(x=>({...x,bloco:e.target.value}))}>
                        <option value="">Selecione...</option>
                        {blocosDoCondo.map(b=><option key={b} value={b}>{b}</option>)}
                      </select>
                    : <input className="input" value={novoConta.bloco} onChange={e=>setNovoConta(x=>({...x,bloco:e.target.value}))} placeholder="Ex.: Bloco A"/>
                  }
                </div>
                <div className="field"><label>Apartamento</label><input className="input" value={novoConta.apto} onChange={e=>setNovoConta(x=>({...x,apto:e.target.value}))} placeholder="Ex.: 302"/></div>
              </div>
            )}
            {novoConta.papel === 'morador' && (
              <div className="field"><label>Tipo de ocupação</label>
                <div className="chip-row">
                  <button className={`chip${novoConta.tipo_ocupacao==='proprietario'?' selected':''}`} onClick={()=>setNovoConta(x=>({...x,tipo_ocupacao:'proprietario'}))}>🏠 Proprietário</button>
                  <button className={`chip${novoConta.tipo_ocupacao==='inquilino'?' selected':''}`} onClick={()=>setNovoConta(x=>({...x,tipo_ocupacao:'inquilino'}))}>🔑 Inquilino</button>
                </div>
              </div>
            )}
            <div className="field"><label>Código de acesso</label>
              <input className="input" value={novoConta.codigo} onChange={e=>setNovoConta(x=>({...x,codigo:e.target.value.toUpperCase()}))} placeholder="Gerado automaticamente se vazio"/>
            </div>
            <button className="btn btn-primary btn-block" onClick={criarUsuario} disabled={salvando}>
              {salvando?'Criando...':'Criar usuário'}
            </button>
          </div>
        </div>
      )}

      {/* Modal editar usuário */}
      {modalEditar && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModalEditar(null)}>
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Editar usuário</h3>
              <button className="modal-close" onClick={()=>setModalEditar(null)}>✕</button>
            </div>
            <div className="field"><label>Nome</label><input className="input" value={modalEditar.nome||''} onChange={e=>setModalEditar(m=>({...m,nome:e.target.value}))}/></div>
            <div className="row2">
              <div className="field"><label>Bloco</label><input className="input" value={modalEditar.bloco||''} onChange={e=>setModalEditar(m=>({...m,bloco:e.target.value}))}/></div>
              <div className="field"><label>Apartamento</label><input className="input" value={modalEditar.apartamento||''} onChange={e=>setModalEditar(m=>({...m,apartamento:e.target.value}))}/></div>
            </div>
            <div className="field"><label>Código de acesso</label><input className="input" value={modalEditar.codigo_acesso||''} onChange={e=>setModalEditar(m=>({...m,codigo_acesso:e.target.value.toUpperCase()}))}/></div>
            {modalEditar.papel==='morador' && (
              <div className="field"><label>Tipo de ocupação</label>
                <div className="chip-row">
                  <button className={`chip${modalEditar.tipo_ocupacao==='proprietario'?' selected':''}`} onClick={()=>setModalEditar(m=>({...m,tipo_ocupacao:'proprietario'}))}>🏠 Proprietário</button>
                  <button className={`chip${modalEditar.tipo_ocupacao==='inquilino'?' selected':''}`} onClick={()=>setModalEditar(m=>({...m,tipo_ocupacao:'inquilino'}))}>🔑 Inquilino</button>
                </div>
              </div>
            )}
            <button className="btn btn-primary btn-block" onClick={salvarUsuario} disabled={salvando}>{salvando?'Salvando...':'Salvar dados'}</button>
            <div style={{ borderTop:'1px solid var(--gray-100)', paddingTop:16, marginTop:16 }}>
              <label style={{ fontSize:12, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.04em', display:'block', marginBottom:8 }}>Resetar senha</label>
              <div style={{ display:'flex', gap:8 }}>
                <input className="input" type="password" placeholder="Nova senha (mín. 4 caracteres)" value={modalEditar.novaSenha||''} onChange={e=>setModalEditar(m=>({...m,novaSenha:e.target.value}))}/>
                <button className="btn btn-ghost btn-sm" style={{ whiteSpace:'nowrap' }} onClick={resetarSenha}>Resetar</button>
              </div>
            </div>
            <div style={{ borderTop:'1px solid var(--gray-100)', paddingTop:16, marginTop:12 }}>
              <button className="btn btn-danger btn-block" style={{ border:'1px solid var(--rust)', color:'var(--rust)', background:'none' }} onClick={excluirUsuario}>
                Excluir conta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal importar */}
      {modalImportar && (
        <ImportarMoradores
          condominioId={condominio.id}
          empresaId={perfil?.empresa_id}
          onToast={onToast}
          onClose={()=>setModalImportar(false)}
          onSuccess={carregar}
        />
      )}
    </div>
  )
}
