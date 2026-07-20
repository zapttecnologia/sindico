import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const PROVEDORES = {
  sistema:   { label:'Usar e-mail do sistema',      icon:'🔧', cor:'#6b7280' },
  gmail:     { label:'Gmail pessoal',               icon:'📧', cor:'#ea4335' },
  workspace: { label:'Google Workspace',            icon:'🏢', cor:'#4285f4' },
  outlook:   { label:'Outlook / Microsoft 365',     icon:'📨', cor:'#0078d4' },
  smtp:      { label:'SMTP personalizado / IMAP',   icon:'⚙️', cor:'#7c3aed' },
}

const CONFIG_PADRAO = {
  provider:'sistema', email_remetente:'', nome_remetente:'', senha_app:'',
  smtp_host:'', smtp_port:'587', smtp_tls:true, ativo:true,
}

export default function Perfil({ onToast }) {
  const { perfil, session } = useAuth()
  const [empresa, setEmpresa] = useState(null)
  const [form, setForm] = useState({ nome:'', cnpj:'', telefone_contato:'', email_contato:'' })
  const [branding, setBranding] = useState({ cor_primaria:'#2843ad', logo_url:'' })
  const [emailConfig, setEmailConfig] = useState(CONFIG_PADRAO)
  const [salvando, setSalvando] = useState(false)
  const [salvandoBrand, setSalvandoBrand] = useState(false)
  const [salvandoEmail, setSalvandoEmail] = useState(false)
  const [testandoEmail, setTestandoEmail] = useState(false)
  const [emailTeste, setEmailTeste] = useState('')
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
        setEmailConfig(emp.email_config ? { ...CONFIG_PADRAO, ...emp.email_config } : CONFIG_PADRAO)
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
    if (!resp.ok) { setCriando(false); onToast('Erro: '+(json.error||'falha')); return }

    // Se o novo usuário é síndico/equipe, vincula aos MESMOS condomínios
    // que o criador administra — isolamento: a equipe recebe só desses
    // condomínios, nunca de outros. (conselheiro/morador usam condominio_id
    // do próprio perfil e não entram aqui.)
    if (json.user_id && (novaConta.papel === 'equipe')) {
      const { data: meus } = await supabase.from('sindico_condominios')
        .select('condominio_id').eq('perfil_id', perfil?.id)
      const vinculos = (meus || []).map(m => ({ perfil_id: json.user_id, condominio_id: m.condominio_id }))
      if (vinculos.length) {
        await supabase.from('sindico_condominios').insert(vinculos).then(()=>{}, ()=>{})
      }
    }
    setCriando(false)
    onToast('Usuário criado!')
    setModalNovo(false); setNovaConta({ nome:'', email:'', codigo:'', senha:'mudar123', papel:'equipe' })
    await carregar()
  }

  const salvarEmailConfig = async () => {
    if (!perfil?.empresa_id) return
    if (emailConfig.provider !== 'sistema') {
      if (!emailConfig.email_remetente) { onToast('Informe o e-mail remetente.'); return }
      if (emailConfig.provider === 'smtp' && !emailConfig.smtp_host) { onToast('Informe o servidor SMTP.'); return }
      if (['gmail','workspace','outlook'].includes(emailConfig.provider) && !emailConfig.senha_app) {
        onToast('Informe a senha de aplicativo.'); return
      }
    }
    setSalvandoEmail(true)
    const { error } = await supabase.from('empresas')
      .update({ email_config: emailConfig }).eq('id', perfil.empresa_id)
    setSalvandoEmail(false)
    if (error) { onToast('Erro: '+error.message); return }
    onToast('✅ Configuração de e-mail salva!')
  }

  const testarEmail = async () => {
    if (!perfil?.empresa_id) return
    const destino = (emailTeste || perfil?.email || '').trim()
    if (!destino) { onToast('Informe um e-mail para receber o teste.'); return }
    if (emailConfig.provider !== 'smtp') { onToast('O teste está disponível para SMTP. Salve o SMTP primeiro.'); return }
    // Garante que a config mais recente está salva antes de testar
    await supabase.from('empresas').update({ email_config: emailConfig }).eq('id', perfil.empresa_id)

    setTestandoEmail(true)
    try {
      const sess = (await supabase.auth.getSession()).data.session
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-new-ticket`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${sess?.access_token}` },
        body: JSON.stringify({ evento:'testar_email', empresa_id:perfil.empresa_id, destino }),
      })
      const json = await resp.json()
      if (json.ok) {
        onToast(`✅ E-mail de teste enviado para ${destino}! Verifique a caixa de entrada (e o spam).`)
      } else {
        onToast(`❌ Falhou: ${json.erro || 'erro desconhecido'}`)
      }
    } catch (e) {
      onToast('❌ Erro ao testar: ' + e.message)
    } finally {
      setTestandoEmail(false)
    }
  }

  const ec = emailConfig
  const setEc = (field, val) => setEmailConfig(prev => ({ ...prev, [field]: val }))
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
        {[['empresa','Dados'],['usuarios','Usuários'],['visual','Identidade visual'],['email','📧 E-mail']].map(([id,label])=>(
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

      {/* ── E-MAIL ── */}
      {tab==='email' && (
        <div>
          <div style={{ padding:'12px 16px', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'var(--r-md)', marginBottom:20, fontSize:13, color:'#1e40af' }}>
            <b>Como funciona:</b> se configurar seu e-mail aqui, as notificações do sistema serão enviadas pelo seu endereço.
            Se o envio falhar ou nenhum e-mail estiver configurado, o sistema usará o e-mail padrão da plataforma como fallback.
          </div>

          {/* Seleção de provedor */}
          <div className="card" style={{ marginBottom:16 }}>
            <h3 className="section-title">Provedor de e-mail</h3>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px,1fr))', gap:10, marginBottom:4 }}>
              {Object.entries(PROVEDORES).map(([key, p]) => (
                <button key={key} onClick={()=>setEc('provider', key)}
                  style={{ padding:'12px 14px', borderRadius:'var(--r-md)', border:`2px solid ${ec.provider===key?p.cor:'var(--gray-200)'}`,
                    background: ec.provider===key ? `${p.cor}12` : '#fff',
                    cursor:'pointer', textAlign:'left', transition:'all .15s' }}>
                  <div style={{ fontSize:18, marginBottom:4 }}>{p.icon}</div>
                  <div style={{ fontSize:13, fontWeight:600, color: ec.provider===key?p.cor:'var(--gray-700)' }}>{p.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Sistema — sem campos extras */}
          {ec.provider === 'sistema' && (
            <div className="card" style={{ textAlign:'center', padding:'28px' }}>
              <div style={{ fontSize:36, marginBottom:8 }}>🔧</div>
              <h4 style={{ fontFamily:'var(--font-display)', color:'var(--navy)', margin:'0 0 8px' }}>Usando e-mail do sistema</h4>
              <p style={{ fontSize:13, color:'var(--gray-400)', margin:0 }}>
                As notificações serão enviadas pelo e-mail padrão da plataforma.<br/>
                Selecione outro provedor para usar seu próprio e-mail.
              </p>
            </div>
          )}

          {/* Gmail / Google Workspace */}
          {(ec.provider==='gmail' || ec.provider==='workspace') && (
            <div>
              <div className="card" style={{ marginBottom:16 }}>
                <h3 className="section-title">{ec.provider==='gmail'?'Gmail — configuração':'Google Workspace — configuração'}</h3>
                <div className="field">
                  <label>E-mail remetente *</label>
                  <input className="input" type="email" value={ec.email_remetente} onChange={e=>setEc('email_remetente',e.target.value)}
                    placeholder={ec.provider==='gmail'?'seuemail@gmail.com':'seuemail@suaempresa.com'}/>
                </div>
                <div className="field">
                  <label>Nome do remetente</label>
                  <input className="input" value={ec.nome_remetente} onChange={e=>setEc('nome_remetente',e.target.value)}
                    placeholder="Ex.: Síndico do Condomínio"/>
                </div>
                <div className="field">
                  <label>Senha de aplicativo (App Password) *</label>
                  <input className="input" type="password" value={ec.senha_app} onChange={e=>setEc('senha_app',e.target.value)}
                    placeholder="xxxx xxxx xxxx xxxx"/>
                  <small style={{ fontSize:11, color:'var(--gray-400)', display:'block', marginTop:4 }}>
                    São 16 caracteres separados em 4 grupos. Diferente da sua senha normal do Google.
                  </small>
                </div>
              </div>

              {/* Instruções Gmail */}
              <div className="card" style={{ background:'#fafafa' }}>
                <h4 style={{ fontSize:14, fontWeight:700, color:'var(--gray-700)', margin:'0 0 12px' }}>
                  📋 Como gerar a Senha de Aplicativo no Google
                </h4>
                {[
                  { n:1, t:'Ativar verificação em 2 etapas', d:'Acesse myaccount.google.com → Segurança → Verificação em 2 etapas e ative caso ainda não tenha.' },
                  { n:2, t:'Acessar Senhas de app', d:'Em myaccount.google.com → Segurança → Role até "Senhas de app" (aparece apenas com 2 etapas ativada).' },
                  { n:3, t:'Criar a senha', d:'Clique em "Senhas de app" → escolha "Outro (nome personalizado)" → digite "Portal de Chamados" → clique em Gerar.' },
                  { n:4, t:'Copiar a senha', d:'O Google exibirá 16 caracteres (ex: abcd efgh ijkl mnop). Cole no campo "Senha de aplicativo" acima.' },
                ].map(p => (
                  <div key={p.n} style={{ display:'flex', gap:12, marginBottom:12 }}>
                    <div style={{ width:24, height:24, borderRadius:'50%', background:'#ea4335', color:'#fff',
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0 }}>
                      {p.n}
                    </div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600, color:'var(--gray-700)', marginBottom:2 }}>{p.t}</div>
                      <div style={{ fontSize:12, color:'var(--gray-400)' }}>{p.d}</div>
                    </div>
                  </div>
                ))}
                {ec.provider==='workspace' && (
                  <div style={{ padding:'10px 12px', background:'#eff6ff', borderRadius:'var(--r-sm)', fontSize:12, color:'#1e40af', marginTop:4 }}>
                    <b>Google Workspace:</b> o administrador do domínio pode precisar habilitar "Acesso a app menos seguro" ou criar senhas de app pelo Google Admin Console em admin.google.com.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Outlook / Microsoft 365 */}
          {ec.provider==='outlook' && (
            <div>
              <div className="card" style={{ marginBottom:16 }}>
                <h3 className="section-title">Outlook / Microsoft 365 — configuração</h3>
                <div className="field">
                  <label>E-mail remetente *</label>
                  <input className="input" type="email" value={ec.email_remetente} onChange={e=>setEc('email_remetente',e.target.value)}
                    placeholder="seuemail@outlook.com ou seuemail@suaempresa.com"/>
                </div>
                <div className="field">
                  <label>Nome do remetente</label>
                  <input className="input" value={ec.nome_remetente} onChange={e=>setEc('nome_remetente',e.target.value)}
                    placeholder="Ex.: Síndico do Condomínio"/>
                </div>
                <div className="field">
                  <label>Senha de aplicativo *</label>
                  <input className="input" type="password" value={ec.senha_app} onChange={e=>setEc('senha_app',e.target.value)}
                    placeholder="Senha de aplicativo da Microsoft"/>
                </div>
                <div style={{ padding:'10px 12px', background:'#eff6ff', borderRadius:'var(--r-sm)', fontSize:12, color:'#1e40af' }}>
                  Servidor: <b>smtp.office365.com</b> · Porta: <b>587</b> · Segurança: <b>STARTTLS</b>
                </div>
              </div>

              <div className="card" style={{ background:'#fafafa' }}>
                <h4 style={{ fontSize:14, fontWeight:700, color:'var(--gray-700)', margin:'0 0 12px' }}>
                  📋 Como gerar Senha de Aplicativo na Microsoft
                </h4>
                {[
                  { n:1, t:'Ativar autenticação multifator (MFA)', d:'Acesse account.microsoft.com → Segurança → Opções de segurança avançadas → ative a verificação em 2 etapas.' },
                  { n:2, t:'Acessar senhas de app', d:'Em account.microsoft.com → Segurança → Opções de segurança avançadas → Senhas de app.' },
                  { n:3, t:'Criar senha', d:'Clique em "Criar uma nova senha de app" → dê o nome "Portal de Chamados" → copie a senha gerada.' },
                  { n:4, t:'Microsoft 365 Business', d:'No admin.microsoft.com, habilite autenticação básica ou crie a senha de app pelo portal de usuário individual.' },
                ].map(p => (
                  <div key={p.n} style={{ display:'flex', gap:12, marginBottom:12 }}>
                    <div style={{ width:24, height:24, borderRadius:'50%', background:'#0078d4', color:'#fff',
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0 }}>
                      {p.n}
                    </div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600, color:'var(--gray-700)', marginBottom:2 }}>{p.t}</div>
                      <div style={{ fontSize:12, color:'var(--gray-400)' }}>{p.d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SMTP personalizado */}
          {ec.provider==='smtp' && (
            <div>
              <div className="card" style={{ marginBottom:16 }}>
                <h3 className="section-title">SMTP personalizado</h3>
                <div className="row2">
                  <div className="field">
                    <label>E-mail remetente *</label>
                    <input className="input" type="email" value={ec.email_remetente} onChange={e=>setEc('email_remetente',e.target.value)} placeholder="seuemail@dominio.com"/>
                  </div>
                  <div className="field">
                    <label>Nome do remetente</label>
                    <input className="input" value={ec.nome_remetente} onChange={e=>setEc('nome_remetente',e.target.value)} placeholder="Ex.: Condomínio ABC"/>
                  </div>
                </div>
                <div className="row2">
                  <div className="field">
                    <label>Servidor SMTP (host) *</label>
                    <input className="input" value={ec.smtp_host} onChange={e=>setEc('smtp_host',e.target.value)} placeholder="Ex.: smtp.seuprovedor.com.br"/>
                  </div>
                  <div className="field">
                    <label>Porta</label>
                    <select className="input" value={ec.smtp_port} onChange={e=>setEc('smtp_port',e.target.value)}>
                      <option value="587">587 — STARTTLS (recomendado)</option>
                      <option value="465">465 — SSL/TLS</option>
                      <option value="25">25 — Sem criptografia</option>
                      <option value="2525">2525 — Alternativa</option>
                    </select>
                  </div>
                </div>
                <div className="field">
                  <label>Usuário (login)</label>
                  <input className="input" value={ec.email_remetente} onChange={e=>setEc('email_remetente',e.target.value)} placeholder="Geralmente é o próprio e-mail"/>
                </div>
                <div className="field">
                  <label>Senha *</label>
                  <input className="input" type="password" value={ec.senha_app} onChange={e=>setEc('senha_app',e.target.value)} placeholder="Senha do e-mail"/>
                </div>
                <label style={{ display:'flex', alignItems:'center', gap:10, fontSize:14, cursor:'pointer' }}>
                  <input type="checkbox" checked={ec.smtp_tls} onChange={e=>setEc('smtp_tls',e.target.checked)}/>
                  Usar TLS/STARTTLS (recomendado)
                </label>
              </div>

              <div className="card" style={{ background:'#fafafa' }}>
                <h4 style={{ fontSize:14, fontWeight:700, color:'var(--gray-700)', margin:'0 0 10px' }}>
                  ℹ️ Configurações comuns por provedor
                </h4>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead>
                    <tr style={{ borderBottom:'1px solid var(--gray-200)' }}>
                      {['Provedor','Servidor SMTP','Porta','Segurança'].map(h=>(
                        <th key={h} style={{ padding:'6px 8px', textAlign:'left', fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', fontSize:10 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Locaweb','smtplw.com.br','587','STARTTLS'],
                      ['HostGator','gator####.hostgator.com','465','SSL'],
                      ['UOL Host','smtp.uolhost.com.br','587','STARTTLS'],
                      ['Zoho Mail','smtp.zoho.com','587','STARTTLS'],
                      ['Yahoo','smtp.mail.yahoo.com','465','SSL'],
                      ['Titan Mail','smtp.titan.email','587','STARTTLS'],
                    ].map(([p,s,port,sec])=>(
                      <tr key={p} style={{ borderBottom:'1px solid var(--gray-100)' }}>
                        <td style={{ padding:'7px 8px', fontWeight:600, color:'var(--gray-700)' }}>{p}</td>
                        <td style={{ padding:'7px 8px', fontFamily:'monospace', fontSize:11, color:'var(--gray-500)' }}>{s}</td>
                        <td style={{ padding:'7px 8px', color:'var(--gray-500)' }}>{port}</td>
                        <td style={{ padding:'7px 8px', color:'var(--gray-500)' }}>{sec}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:8 }}>
                  💡 Consulte o suporte do seu provedor de hospedagem para obter as configurações exatas.
                </div>
              </div>
            </div>
          )}

          {/* Botão salvar */}
          {ec.provider !== 'sistema' && (
            <div style={{ marginTop:16, display:'flex', gap:10, alignItems:'center' }}>
              <button className="btn btn-primary" onClick={salvarEmailConfig} disabled={salvandoEmail}>
                {salvandoEmail ? 'Salvando...' : '💾 Salvar configuração de e-mail'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={()=>{ setEc('provider','sistema'); }}>
                Voltar para e-mail do sistema
              </button>
            </div>
          )}

          {/* Teste de envio (SMTP) */}
          {ec.provider === 'smtp' && (
            <div style={{ marginTop:16, padding:16, background:'#f8f9fb', borderRadius:'var(--r-lg)', border:'1px solid var(--gray-200)' }}>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--navy)', marginBottom:6 }}>
                Testar envio
              </div>
              <div style={{ fontSize:12, color:'var(--gray-400)', marginBottom:10 }}>
                Envia um e-mail de teste pelo servidor configurado, para confirmar se está tudo certo.
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                <input className="input" style={{ maxWidth:260 }} type="email"
                  value={emailTeste} onChange={e=>setEmailTeste(e.target.value)}
                  placeholder={perfil?.email || 'seu@email.com'}/>
                <button className="btn btn-ghost" onClick={testarEmail} disabled={testandoEmail}>
                  {testandoEmail ? 'Enviando teste...' : '✉️ Enviar teste'}
                </button>
              </div>
              <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:8 }}>
                Dica: salve a configuração antes de testar. Se não receber, verifique também a pasta de spam.
              </div>
            </div>
          )}

          {ec.provider === 'sistema' && (
            <button className="btn btn-ghost" onClick={salvarEmailConfig} disabled={salvandoEmail} style={{ marginTop:8 }}>
              {salvandoEmail ? 'Salvando...' : '💾 Confirmar uso do e-mail do sistema'}
            </button>
          )}
        </div>
      )}
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
