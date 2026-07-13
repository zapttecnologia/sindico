import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Perfil({ onToast }) {
  const { perfil, session } = useAuth()
  const [empresa, setEmpresa] = useState(null)
  const [form, setForm] = useState({ nome:'', cnpj:'', telefone_contato:'', email_contato:'' })
  const [branding, setBranding] = useState({ cor_primaria:'#2843ad', logo_url:'' })
  const [salvando, setSalvando] = useState(false)
  const [salvandoBrand, setSalvandoBrand] = useState(false)
  const [loading, setLoading] = useState(true)
  const [usuarios, setUsuarios] = useState([])
  const [tab, setTab] = useState('empresa')
  const [modalEditar, setModalEditar] = useState(null)
  const [modalNovo, setModalNovo] = useState(false)
  const [novaConta, setNovaConta] = useState({ nome:'', email:'', codigo:'', senha:'mudar123', papel:'equipe' })
  const [criando, setCriando] = useState(false)
  const [salvandoUser, setSalvandoUser] = useState(false)

  const carregar = async () => {
    setLoading(true)
    try {
      if (!perfil?.empresa_id) { setLoading(false); return }
      const [{ data:emp }, { data:users }] = await Promise.all([
        supabase.from('empresas').select('*').eq('id', perfil.empresa_id).single(),
        supabase.from('perfis')
          .select('id,nome,email,papel,codigo_acesso,primeiro_acesso')
          .eq('empresa_id', perfil.empresa_id)
          .in('papel', ['admin','equipe'])
          .order('criado_em', { ascending:false }),
      ])
      if (emp) {
        setEmpresa(emp)
        setForm({ nome:emp.nome||'', cnpj:emp.cnpj||'', telefone_contato:emp.telefone_contato||'', email_contato:emp.email_contato||'' })
        setBranding({ cor_primaria:emp.cor_primaria||'#2843ad', logo_url:emp.logo_url||'' })
      }
      if (users) setUsuarios(users)
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { if (perfil) carregar() }, [perfil?.id])

  const salvarEmpresa = async () => {
    if (!perfil?.empresa_id) return
    setSalvando(true)
    const { error } = await supabase.from('empresas').update(form).eq('id', perfil.empresa_id)
    setSalvando(false)
    if (error) { onToast('Erro: '+error.message); return }
    onToast('Dados salvos!'); await carregar()
  }

  const salvarBranding = async () => {
    if (!perfil?.empresa_id) return
    setSalvandoBrand(true)
    const { error } = await supabase.from('empresas').update(branding).eq('id', perfil.empresa_id)
    setSalvandoBrand(false)
    if (error) { onToast('Erro: '+error.message); return }
    onToast('Identidade visual salva!')
    // Aplicar cor no portal
    document.documentElement.style.setProperty('--navy', branding.cor_primaria)
  }

  const salvarUsuario = async () => {
    if (!modalEditar) return
    setSalvandoUser(true)
    const { error } = await supabase.from('perfis').update({
      nome: modalEditar.nome,
      codigo_acesso: modalEditar.codigo_acesso?.toUpperCase(),
    }).eq('id', modalEditar.id)
    setSalvandoUser(false)
    if (error) { onToast('Erro: '+error.message); return }
    onToast('Usuário atualizado!'); setModalEditar(null); await carregar()
  }

  const resetarSenha = async () => {
    if (!modalEditar?.novaSenha || modalEditar.novaSenha.length < 4) { onToast('Senha muito curta (mín. 4 caracteres).'); return }
    const sess = (await supabase.auth.getSession()).data.session
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-actions`, {
      method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${sess?.access_token}`},
      body: JSON.stringify({ action:'reset_password', user_id:modalEditar.id, new_password:modalEditar.novaSenha }),
    })
    const json = await resp.json()
    if (!resp.ok) { onToast('Erro: '+(json.error||'falha')); return }
    onToast('Senha alterada!'); setModalEditar(m=>({...m, novaSenha:''}))
  }

  const criarUsuario = async () => {
    if (!novaConta.nome || !novaConta.email || !novaConta.codigo) { onToast('Preencha nome, e-mail e código.'); return }
    setCriando(true)
    const sess = (await supabase.auth.getSession()).data.session
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-actions`, {
      method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${sess?.access_token}`},
      body: JSON.stringify({ action:'create_user', email:novaConta.email, password:novaConta.senha,
        nome:novaConta.nome, papel:novaConta.papel, empresa_id:perfil?.empresa_id,
        codigo_acesso:novaConta.codigo.toUpperCase() }),
    })
    const json = await resp.json()
    setCriando(false)
    if (!resp.ok) { onToast('Erro: '+(json.error||'falha')); return }
    onToast('Usuário criado!')
    setModalNovo(false); setNovaConta({ nome:'', email:'', codigo:'', senha:'mudar123', papel:'equipe' })
    await carregar()
  }

  const PAPEL_LABEL = { equipe:'Síndico', admin:'Admin' }
  const PAPEL_COR   = { equipe:'var(--emerald)', admin:'var(--amber)' }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:60, color:'var(--gray-400)' }}>
      Carregando...
    </div>
  )

  if (!perfil?.empresa_id) return (
    <div className="card" style={{ textAlign:'center', padding:'48px 28px' }}>
      <div style={{ fontSize:48, marginBottom:12 }}>🏢</div>
      <h3 style={{ fontFamily:'var(--font-display)', color:'var(--navy)', margin:'0 0 8px' }}>Empresa não vinculada</h3>
      <p style={{ fontSize:14, color:'var(--gray-400)', margin:0 }}>Entre em contato com o administrador da plataforma.</p>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Minha empresa</h1>
        <p className="page-sub">Gerencie dados, usuários e identidade visual</p>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'2px solid var(--gray-200)', marginBottom:24 }}>
        {[['empresa','Dados'],['usuarios','Usuários'],['visual','Identidade visual']].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{
            padding:'11px 20px', background:'none', border:'none', cursor:'pointer', fontSize:14, fontWeight:600,
            color:tab===id?'var(--emerald)':'var(--gray-400)',
            borderBottom:tab===id?'2px solid var(--emerald)':'2px solid transparent', marginBottom:-2 }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── DADOS ── */}
      {tab==='empresa' && (
        <div className="card">
          <h3 className="section-title">Dados cadastrais</h3>
          <div className="field">
            <label>Nome da empresa</label>
            <input className="input" value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))}/>
          </div>
          <div className="row2">
            <div className="field">
              <label>CNPJ</label>
              <input className="input" value={form.cnpj} onChange={e=>setForm(f=>({...f,cnpj:e.target.value}))} placeholder="00.000.000/0001-00"/>
            </div>
            <div className="field">
              <label>Telefone</label>
              <input className="input" value={form.telefone_contato} onChange={e=>setForm(f=>({...f,telefone_contato:e.target.value}))}/>
            </div>
          </div>
          <div className="field">
            <label>E-mail de contato</label>
            <input className="input" type="email" value={form.email_contato} onChange={e=>setForm(f=>({...f,email_contato:e.target.value}))}/>
          </div>
          {empresa && (
            <div style={{ padding:'10px 14px', background:'var(--mint)', borderRadius:'var(--r-md)', marginBottom:16, fontSize:13, color:'var(--emerald)' }}>
              Plano: <b>{empresa.plano_nome||'trial'}</b>
              {empresa.plano_vencimento && ` · Vencimento: ${new Date(empresa.plano_vencimento).toLocaleDateString('pt-BR')}`}
            </div>
          )}
          <button className="btn btn-primary" onClick={salvarEmpresa} disabled={salvando}>
            {salvando?'Salvando...':'Salvar dados'}
          </button>
        </div>
      )}

      {/* ── USUÁRIOS ── */}
      {tab==='usuarios' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <p className="page-sub">{usuarios.length} usuário{usuarios.length!==1?'s':''} da equipe</p>
            <button className="btn btn-primary btn-sm" onClick={()=>setModalNovo(true)}>+ Novo usuário</button>
          </div>

          {usuarios.length===0 && <div className="empty-state">Nenhum usuário cadastrado.</div>}

          {['admin','equipe'].map(papel=>{
            const grupo = usuarios.filter(u=>u.papel===papel)
            if (!grupo.length) return null
            return (
              <div key={papel} className="card" style={{ marginBottom:12 }}>
                <div style={{ marginBottom:12 }}>
                  <span style={{ fontSize:11, fontWeight:700, padding:'3px 8px', borderRadius:5, background:'var(--mint)', color:PAPEL_COR[papel], textTransform:'uppercase' }}>
                    {PAPEL_LABEL[papel]}
                  </span>
                </div>
                {grupo.map(u=>(
                  <div key={u.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid var(--gray-100)' }}>
                    <div style={{ width:36, height:36, borderRadius:'50%', background:'var(--mint)',
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'var(--emerald)', flexShrink:0 }}>
                      {(u.nome||'?')[0].toUpperCase()}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14, fontWeight:600, color:'var(--gray-800)', display:'flex', alignItems:'center', gap:8 }}>
                        {u.nome}
                        {u.primeiro_acesso===true && (
                          <span style={{ fontSize:10, background:'#fff3dc', color:'#8a5a00', padding:'2px 6px', borderRadius:4, fontWeight:600 }}>1º acesso</span>
                        )}
                      </div>
                      <div style={{ fontSize:12, color:'var(--gray-400)' }}>
                        {u.codigo_acesso?`Código: ${u.codigo_acesso}`:''}
                        {u.email?` · ${u.email}`:''}
                      </div>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={()=>setModalEditar({...u,novaSenha:''})}>
                      Editar
                    </button>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* ── IDENTIDADE VISUAL ── */}
      {tab==='visual' && (
        <div className="card">
          <h3 className="section-title">Identidade visual da empresa</h3>
          <p style={{ fontSize:13, color:'var(--gray-400)', margin:'0 0 20px' }}>
            Personalize o portal com as cores e logo da sua empresa.
          </p>
          <div className="field">
            <label>Logo da empresa (URL da imagem)</label>
            <input className="input" value={branding.logo_url} onChange={e=>setBranding(b=>({...b,logo_url:e.target.value}))}
              placeholder="https://suaempresa.com/logo.png"/>
            {branding.logo_url && (
              <div style={{ marginTop:10, padding:'10px', background:'var(--gray-50)', borderRadius:'var(--r-md)', display:'inline-block' }}>
                <img src={branding.logo_url} alt="Preview logo" style={{ height:50, objectFit:'contain' }}
                  onError={e=>e.target.style.display='none'}/>
              </div>
            )}
          </div>
          <div className="field">
            <label>Cor principal da empresa</label>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <input type="color" value={branding.cor_primaria} onChange={e=>setBranding(b=>({...b,cor_primaria:e.target.value}))}
                style={{ width:48, height:38, border:'1.5px solid var(--gray-200)', borderRadius:'var(--r-sm)', cursor:'pointer', padding:2 }}/>
              <input className="input" value={branding.cor_primaria} onChange={e=>setBranding(b=>({...b,cor_primaria:e.target.value}))}
                style={{ maxWidth:140, fontFamily:'monospace' }}/>
              <div style={{ width:38, height:38, borderRadius:'var(--r-md)', background:branding.cor_primaria }}/>
            </div>
          </div>

          {/* Preview */}
          <div style={{ padding:'16px', background:'var(--gray-50)', borderRadius:'var(--r-lg)', marginBottom:20 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>
              Preview da barra lateral
            </div>
            <div style={{ background:'#fff', borderRadius:'var(--r-md)', padding:'12px 14px', display:'flex', gap:10, alignItems:'center', border:'1px solid var(--gray-200)' }}>
              <div style={{ width:28, height:28, borderRadius:7, background:branding.cor_primaria,
                display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <path d="M4 21V8L12 3l8 5v13"/><path d="M9 21v-6h6v6"/>
                </svg>
              </div>
              <div style={{ fontSize:13, fontWeight:700, color:branding.cor_primaria }}>
                {empresa?.nome||'Minha empresa'}
              </div>
            </div>
          </div>

          <button className="btn btn-primary" onClick={salvarBranding} disabled={salvandoBrand}
            style={{ backgroundColor:branding.cor_primaria, borderColor:branding.cor_primaria }}>
            {salvandoBrand?'Salvando...':'💾 Salvar identidade visual'}
          </button>
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
            <div className="field">
              <label>Nome</label>
              <input className="input" value={modalEditar.nome||''} onChange={e=>setModalEditar(m=>({...m,nome:e.target.value}))}/>
            </div>
            <div className="field">
              <label>Código de acesso</label>
              <input className="input" value={modalEditar.codigo_acesso||''} onChange={e=>setModalEditar(m=>({...m,codigo_acesso:e.target.value.toUpperCase()}))}/>
            </div>
            <div className="field">
              <label>E-mail</label>
              <input className="input" value={modalEditar.email||''} disabled style={{ opacity:.6 }}/>
            </div>
            <button className="btn btn-primary btn-block" onClick={salvarUsuario} disabled={salvandoUser}>
              {salvandoUser?'Salvando...':'Salvar dados'}
            </button>
            <div style={{ borderTop:'1px solid var(--gray-100)', paddingTop:16, marginTop:16 }}>
              <label style={{ fontSize:12, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.04em', display:'block', marginBottom:8 }}>
                Resetar senha
              </label>
              <div style={{ display:'flex', gap:8 }}>
                <input className="input" type="password" placeholder="Nova senha"
                  value={modalEditar.novaSenha||''} onChange={e=>setModalEditar(m=>({...m,novaSenha:e.target.value}))}/>
                <button className="btn btn-ghost btn-sm" style={{ whiteSpace:'nowrap' }} onClick={resetarSenha}>
                  Resetar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal novo usuário */}
      {modalNovo && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModalNovo(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Novo usuário da equipe</h3>
              <button className="modal-close" onClick={()=>setModalNovo(false)}>✕</button>
            </div>
            <div className="field"><label>Nome *</label><input className="input" value={novaConta.nome} onChange={e=>setNovaConta(x=>({...x,nome:e.target.value}))}/></div>
            <div className="field"><label>E-mail *</label><input className="input" type="email" value={novaConta.email} onChange={e=>setNovaConta(x=>({...x,email:e.target.value}))}/></div>
            <div className="row2">
              <div className="field"><label>Código *</label><input className="input" value={novaConta.codigo} onChange={e=>setNovaConta(x=>({...x,codigo:e.target.value.toUpperCase()}))} placeholder="Ex.: SIND01"/></div>
              <div className="field"><label>Senha inicial</label><input className="input" value={novaConta.senha} onChange={e=>setNovaConta(x=>({...x,senha:e.target.value}))}/></div>
            </div>
            <div className="field">
              <label>Papel</label>
              <select className="input" value={novaConta.papel} onChange={e=>setNovaConta(x=>({...x,papel:e.target.value}))}>
                <option value="equipe">Síndico</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button className="btn btn-primary btn-block" onClick={criarUsuario} disabled={criando}>
              {criando?'Criando...':'Criar usuário'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
