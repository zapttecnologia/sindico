import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// ── Design tokens dark ─────────────────────────────────────
const C = {
  bg:      '#0d1117',
  surface: '#161b22',
  border:  '#30363d',
  border2: '#21262d',
  text:    '#e6edf3',
  muted:   '#8b949e',
  purple:  '#7c3aed',
  green:   '#3fb950',
  amber:   '#f59e0b',
  red:     '#f85149',
  blue:    '#58a6ff',
  violet:  '#a78bfa',
}

const PLANO_COR = {
  trial:        { bg:'#21262d', color:C.muted },
  basico:       { bg:'#0d1f3c', color:C.blue },
  profissional: { bg:'#1a0f3c', color:C.violet },
  enterprise:   { bg:'#2d1a00', color:C.amber },
}
const STATUS_COR = {
  ativa:        { bg:'#0d2b1a', color:C.green },
  inadimplente: { bg:'#2d0e0e', color:C.red },
  suspensa:     { bg:'#21262d', color:C.muted },
  cancelada:    { bg:'#21262d', color:C.muted },
}
const PAPEL_COR = {
  admin:        C.amber,
  equipe:       C.green,
  conselheiro:  C.violet,
  morador:      C.muted,
}
const STATUS_CHAM = {
  recebido:  C.amber,
  andamento: C.blue,
  concluido: C.green,
}

function Badge({ label, map }) {
  const c = (map||{})[label] || { bg:'#21262d', color:C.muted }
  return (
    <span style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.04em',
      padding:'2px 8px', borderRadius:5, background:c.bg, color:c.color, whiteSpace:'nowrap' }}>
      {label}
    </span>
  )
}
function DI({ value, onChange, type='text', placeholder='', style={} }) {
  return <input type={type} value={value||''} placeholder={placeholder} onChange={e=>onChange(e.target.value)}
    style={{ width:'100%', background:'#0d1117', border:`1px solid ${C.border}`, borderRadius:7,
      padding:'8px 11px', color:C.text, fontSize:13, outline:'none', boxSizing:'border-box', ...style }} />
}
function DS({ value, onChange, children }) {
  return <select value={value||''} onChange={e=>onChange(e.target.value)}
    style={{ width:'100%', background:'#0d1117', border:`1px solid ${C.border}`, borderRadius:7,
      padding:'8px 11px', color:C.text, fontSize:13, outline:'none', boxSizing:'border-box' }}>
    {children}
  </select>
}
function Lbl({ children }) {
  return <label style={{ display:'block', fontSize:11, fontWeight:600, color:C.muted,
    marginBottom:4, textTransform:'uppercase', letterSpacing:'.04em' }}>{children}</label>
}
function Fld({ label, children, style={} }) {
  return <div style={{ marginBottom:14, ...style }}><Lbl>{label}</Lbl>{children}</div>
}
function G2({ children, gap=12 }) {
  return <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap }}>{children}</div>
}
function Btn({ children, onClick, variant='primary', sm, disabled, style={} }) {
  const bg = variant==='primary' ? C.purple : variant==='danger' ? 'transparent' : '#21262d'
  const border = variant==='danger' ? `1px solid ${C.red}` : `1px solid ${C.border}`
  const color = variant==='danger' ? C.red : C.text
  return <button onClick={onClick} disabled={disabled}
    style={{ padding: sm ? '5px 12px' : '9px 16px', background:bg, border,
      borderRadius:7, color, fontSize: sm ? 12 : 13, fontWeight:600, cursor:'pointer',
      opacity: disabled ? .5 : 1, whiteSpace:'nowrap', ...style }}>
    {children}
  </button>
}
function Modal({ title, onClose, children, maxWidth=500 }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:60,
      display:'flex', alignItems:'center', justifyContent:'center', padding:16, overflowY:'auto' }}>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16,
        width:'100%', maxWidth, padding:'24px 22px', maxHeight:'92vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h3 style={{ margin:0, fontSize:17, fontWeight:700, color:C.text }}>{title}</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, fontSize:22, cursor:'pointer' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Componente principal ────────────────────────────────────
export default function SuperAdmin({ onToast }) {
  const { logout } = useAuth()
  const [tab, setTab] = useState('empresas')
  const [empresas, setEmpresas] = useState([])
  const [planos, setPlanos] = useState([])
  const [metricas, setMetricas] = useState(null)
  const [busca, setBusca] = useState('')
  const [empresaSel, setEmpresaSel] = useState(null)
  const [modalNova, setModalNova] = useState(false)
  const [modalEditarEmpresa, setModalEditarEmpresa] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const VAZIO = { nome:'', cnpj:'', email_contato:'', telefone_contato:'',
    plano_nome:'trial', plano_vencimento:'', obs:'', admin_nome:'', admin_email:'', admin_senha:'mudar123' }
  const [nova, setNova] = useState(VAZIO)

  const carregar = async () => {
    const [{ data: emp }, { data: pl }] = await Promise.all([
      supabase.from('vw_empresas_painel').select('*'),
      supabase.from('planos').select('*').eq('ativo', true).order('valor_mensal'),
    ])
    if (emp) {
      setEmpresas(emp)
      setMetricas({
        total: emp.length,
        ativas: emp.filter(e=>e.status==='ativa').length,
        trial: emp.filter(e=>e.plano_nome==='trial').length,
        inadimplentes: emp.filter(e=>e.status==='inadimplente').length,
        condominios: emp.reduce((s,e)=>s+(e.total_condominios||0),0),
        usuarios: emp.reduce((s,e)=>s+(e.total_usuarios||0),0),
        abertos: emp.reduce((s,e)=>s+(e.chamados_abertos||0),0),
      })
    }
    if (pl) setPlanos(pl)
  }

  useEffect(() => { carregar() }, [])

  const criarEmpresa = async () => {
    if (!nova.nome || !nova.admin_email || !nova.admin_nome) { onToast('Preencha os campos obrigatórios.'); return }
    setSalvando(true)
    try {
      const planoObj = planos.find(p=>p.nome===nova.plano_nome)
      const venc = nova.plano_nome==='trial'
        ? new Date(Date.now()+30*86400000).toISOString().split('T')[0]
        : nova.plano_vencimento||null
      const { data: emp, error: eErr } = await supabase.from('empresas').insert({
        nome:nova.nome, cnpj:nova.cnpj||null, email_contato:nova.email_contato||null,
        telefone_contato:nova.telefone_contato||null, plano_id:planoObj?.id||null,
        plano_nome:nova.plano_nome, status:'ativa', plano_vencimento:venc, obs:nova.obs||null,
      }).select().single()
      if (eErr) throw new Error(eErr.message)
      const session = (await supabase.auth.getSession()).data.session
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-actions`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${session?.access_token}` },
        body: JSON.stringify({ action:'create_user', email:nova.admin_email, password:nova.admin_senha,
          nome:nova.admin_nome, papel:'admin', empresa_id:emp.id,
          codigo_acesso:'ADMIN'+emp.id.slice(-4).toUpperCase() }),
      })
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.error)
      onToast('✅ Empresa criada!'); setModalNova(false); setNova(VAZIO); await carregar()
    } catch(e) { onToast('Erro: '+e.message) }
    setSalvando(false)
  }

  const salvarEmpresa = async () => {
    if (!modalEditarEmpresa) return
    const { error } = await supabase.from('empresas').update({
      nome:modalEditarEmpresa.nome, cnpj:modalEditarEmpresa.cnpj,
      email_contato:modalEditarEmpresa.email_contato, telefone_contato:modalEditarEmpresa.telefone_contato,
      plano_nome:modalEditarEmpresa.plano_nome, status:modalEditarEmpresa.status,
      plano_vencimento:modalEditarEmpresa.plano_vencimento||null, obs:modalEditarEmpresa.obs,
    }).eq('id', modalEditarEmpresa.id)
    if (error) { onToast('Erro: '+error.message); return }
    onToast('Empresa atualizada.'); setModalEditarEmpresa(null); await carregar()
  }

  const filtradas = empresas.filter(e => !busca ||
    e.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (e.email_contato||'').toLowerCase().includes(busca.toLowerCase()))

  // Se uma empresa está selecionada, mostra o painel dela
  if (empresaSel) return (
    <EmpresaPanel
      empresa={empresaSel}
      planos={planos}
      onBack={() => { setEmpresaSel(null); carregar() }}
      onToast={onToast}
    />
  )

  return (
    <div style={{ minHeight:'100vh', background:C.bg, color:C.text, fontFamily:'var(--font-body)' }}>
      {/* Header */}
      <div style={{ background:'#13111a', borderBottom:`1px solid #2d2438`,
        padding:'0 24px', display:'flex', alignItems:'center', gap:12, height:52 }}>
        <div style={{ width:26, height:26, borderRadius:7, background:C.purple,
          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <path d="M4 21V8L12 3l8 5v13"/><path d="M9 21v-6h6v6"/>
          </svg>
        </div>
        <span style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:14, color:'#fff' }}>
          Central de Solicitações
        </span>
        <span style={{ fontSize:10, background:'#2d1a4e', color:C.violet,
          padding:'2px 7px', borderRadius:4, fontWeight:700 }}>SUPER ADMIN</span>
        <div style={{ flex:1 }}/>
        <button onClick={logout} style={{ background:'none', border:'none', color:'rgba(255,255,255,.4)',
          fontSize:13, cursor:'pointer' }}>Sair →</button>
      </div>

      <div style={{ maxWidth:1200, margin:'0 auto', padding:'24px 20px' }}>
        {/* KPIs */}
        {metricas && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(130px,1fr))', gap:10, marginBottom:24 }}>
            {[
              { l:'Clientes',        v:metricas.total,        c:C.text },
              { l:'Ativos',          v:metricas.ativas,       c:C.green },
              { l:'Trial',           v:metricas.trial,        c:C.amber },
              { l:'Inadimplentes',   v:metricas.inadimplentes,c:C.red },
              { l:'Condomínios',     v:metricas.condominios,  c:C.blue },
              { l:'Usuários',        v:metricas.usuarios,     c:C.violet },
              { l:'Chamados abertos',v:metricas.abertos,      c:C.amber },
            ].map(k=>(
              <div key={k.l} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px' }}>
                <div style={{ fontFamily:'var(--font-display)', fontSize:26, fontWeight:800, color:k.c, lineHeight:1 }}>{k.v}</div>
                <div style={{ fontSize:10, color:C.muted, marginTop:4, fontWeight:600, textTransform:'uppercase', letterSpacing:'.04em' }}>{k.l}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:`1px solid ${C.border}`, marginBottom:20 }}>
          {[['empresas','🏢 Clientes'],['planos','💳 Planos']].map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)} style={{
              padding:'9px 18px', background:'none', border:'none', cursor:'pointer', fontSize:13, fontWeight:600,
              color:tab===id?'#fff':C.muted, borderBottom:tab===id?`2px solid ${C.purple}`:'2px solid transparent', marginBottom:-1 }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── ABA CLIENTES ── */}
        {tab==='empresas' && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, gap:10, flexWrap:'wrap' }}>
              <input placeholder="Buscar empresa..." value={busca} onChange={e=>setBusca(e.target.value)}
                style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8,
                  padding:'8px 12px', color:C.text, fontSize:13, width:240, outline:'none' }} />
              <Btn onClick={()=>setModalNova(true)}>+ Nova empresa</Btn>
            </div>
            <div style={{ border:`1px solid ${C.border}`, borderRadius:10, overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ background:C.surface, borderBottom:`1px solid ${C.border}` }}>
                    {['Empresa','Plano','Status','Condomínios','Usuários','Chamados abertos','Criada em',''].map(h=>(
                      <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:11, fontWeight:700,
                        color:C.muted, textTransform:'uppercase', letterSpacing:'.04em', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtradas.length===0 && (
                    <tr><td colSpan={8} style={{ padding:32, textAlign:'center', color:C.muted }}>Nenhuma empresa cadastrada.</td></tr>
                  )}
                  {filtradas.map(e=>(
                    <tr key={e.id} style={{ borderBottom:`1px solid ${C.border2}` }}>
                      <td style={{ padding:'11px 12px' }}>
                        <div style={{ fontWeight:600, color:C.text }}>{e.nome}</div>
                        <div style={{ fontSize:11, color:C.muted }}>{e.email_contato||'—'}</div>
                      </td>
                      <td style={{ padding:'11px 12px' }}><Badge label={e.plano_nome} map={PLANO_COR}/></td>
                      <td style={{ padding:'11px 12px' }}><Badge label={e.status} map={STATUS_COR}/></td>
                      <td style={{ padding:'11px 12px', textAlign:'center', color:C.blue, fontWeight:700 }}>{e.total_condominios}</td>
                      <td style={{ padding:'11px 12px', textAlign:'center', color:C.violet, fontWeight:700 }}>{e.total_usuarios}</td>
                      <td style={{ padding:'11px 12px', textAlign:'center', fontWeight:700,
                        color:e.chamados_abertos>0?C.amber:C.muted }}>{e.chamados_abertos}</td>
                      <td style={{ padding:'11px 12px', color:C.muted, fontSize:12 }}>
                        {new Date(e.criado_em).toLocaleDateString('pt-BR')}
                        {e.plano_vencimento && (
                          <div style={{ color:new Date(e.plano_vencimento)<new Date()?C.red:C.muted, fontSize:11 }}>
                            vence {new Date(e.plano_vencimento).toLocaleDateString('pt-BR')}
                          </div>
                        )}
                      </td>
                      <td style={{ padding:'11px 12px' }}>
                        <div style={{ display:'flex', gap:6 }}>
                          <Btn sm onClick={()=>setEmpresaSel(e)}>Gerenciar</Btn>
                          <Btn sm variant='ghost' onClick={()=>setModalEditarEmpresa({...e})}>Editar</Btn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── ABA PLANOS ── */}
        {tab==='planos' && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px,1fr))', gap:16 }}>
            {planos.map(p=><PlanoCard key={p.id} plano={p} onToast={onToast} onSaved={carregar} />)}
          </div>
        )}
      </div>

      {/* Modal nova empresa */}
      {modalNova && (
        <Modal title="Nova empresa cliente" onClose={()=>setModalNova(false)} maxWidth={540}>
          <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', marginBottom:12, borderBottom:`1px solid ${C.border}`, paddingBottom:8 }}>Dados da empresa</div>
          <Fld label="Nome *"><DI value={nova.nome} onChange={v=>setNova(x=>({...x,nome:v}))} placeholder="Ex.: Síndico Prime Ltda" /></Fld>
          <G2>
            <Fld label="CNPJ"><DI value={nova.cnpj} onChange={v=>setNova(x=>({...x,cnpj:v}))} /></Fld>
            <Fld label="Plano">
              <DS value={nova.plano_nome} onChange={v=>setNova(x=>({...x,plano_nome:v}))}>
                {planos.map(p=><option key={p.id} value={p.nome}>{p.nome_exibicao}</option>)}
              </DS>
            </Fld>
          </G2>
          <G2>
            <Fld label="E-mail"><DI value={nova.email_contato} onChange={v=>setNova(x=>({...x,email_contato:v}))} type="email"/></Fld>
            <Fld label="Telefone"><DI value={nova.telefone_contato} onChange={v=>setNova(x=>({...x,telefone_contato:v}))} /></Fld>
          </G2>
          {nova.plano_nome!=='trial' && <Fld label="Vencimento"><DI value={nova.plano_vencimento} onChange={v=>setNova(x=>({...x,plano_vencimento:v}))} type="date"/></Fld>}
          <Fld label="Obs. internas"><DI value={nova.obs} onChange={v=>setNova(x=>({...x,obs:v}))} placeholder="Anotações..."/></Fld>
          <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', margin:'16px 0 12px', borderBottom:`1px solid ${C.border}`, paddingBottom:8 }}>Usuário admin</div>
          <G2>
            <Fld label="Nome *"><DI value={nova.admin_nome} onChange={v=>setNova(x=>({...x,admin_nome:v}))} /></Fld>
            <Fld label="E-mail *"><DI value={nova.admin_email} onChange={v=>setNova(x=>({...x,admin_email:v}))} type="email"/></Fld>
          </G2>
          <Fld label="Senha inicial"><DI value={nova.admin_senha} onChange={v=>setNova(x=>({...x,admin_senha:v}))} /></Fld>
          <Btn onClick={criarEmpresa} disabled={salvando} style={{ width:'100%', marginTop:4 }}>
            {salvando?'Criando...':'Criar empresa + admin'}
          </Btn>
        </Modal>
      )}

      {/* Modal editar empresa */}
      {modalEditarEmpresa && (
        <Modal title="Editar empresa" onClose={()=>setModalEditarEmpresa(null)} maxWidth={460}>
          <Fld label="Nome"><DI value={modalEditarEmpresa.nome} onChange={v=>setModalEditarEmpresa(m=>({...m,nome:v}))} /></Fld>
          <G2>
            <Fld label="CNPJ"><DI value={modalEditarEmpresa.cnpj||''} onChange={v=>setModalEditarEmpresa(m=>({...m,cnpj:v}))} /></Fld>
            <Fld label="Status">
              <DS value={modalEditarEmpresa.status} onChange={v=>setModalEditarEmpresa(m=>({...m,status:v}))}>
                {['ativa','inadimplente','suspensa','cancelada'].map(s=><option key={s}>{s}</option>)}
              </DS>
            </Fld>
          </G2>
          <G2>
            <Fld label="Plano">
              <DS value={modalEditarEmpresa.plano_nome} onChange={v=>setModalEditarEmpresa(m=>({...m,plano_nome:v}))}>
                {planos.map(p=><option key={p.id} value={p.nome}>{p.nome_exibicao}</option>)}
              </DS>
            </Fld>
            <Fld label="Vencimento"><DI value={modalEditarEmpresa.plano_vencimento||''} onChange={v=>setModalEditarEmpresa(m=>({...m,plano_vencimento:v}))} type="date"/></Fld>
          </G2>
          <G2>
            <Fld label="E-mail"><DI value={modalEditarEmpresa.email_contato||''} onChange={v=>setModalEditarEmpresa(m=>({...m,email_contato:v}))} type="email"/></Fld>
            <Fld label="Telefone"><DI value={modalEditarEmpresa.telefone_contato||''} onChange={v=>setModalEditarEmpresa(m=>({...m,telefone_contato:v}))} /></Fld>
          </G2>
          <Fld label="Obs."><DI value={modalEditarEmpresa.obs||''} onChange={v=>setModalEditarEmpresa(m=>({...m,obs:v}))} /></Fld>
          <Btn onClick={salvarEmpresa} style={{ width:'100%' }}>Salvar</Btn>
        </Modal>
      )}
    </div>
  )
}

// ── Painel de gestão de uma empresa ────────────────────────
function EmpresaPanel({ empresa, planos, onBack, onToast }) {
  const [aba, setAba] = useState('condominios')
  const [condominios, setCondominios] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [chamados, setChamados] = useState([])
  const [loading, setLoading] = useState(true)
  const [novoCondNome, setNovoCondNome] = useState('')
  const [modalUsuario, setModalUsuario] = useState(null) // null | objeto usuario
  const [modalNovaConta, setModalNovaConta] = useState(false)
  const [novaConta, setNovaConta] = useState({ nome:'', email:'', codigo:'', senha:'mudar123', papel:'morador', condominio_id:'' })
  const [salvando, setSalvando] = useState(false)

  const carregar = async () => {
    setLoading(true)
    const ids = condominios.map(c=>c.id)

    const [{ data:conds }, { data:users }] = await Promise.all([
      supabase.from('condominios').select('id, nome').eq('empresa_id', empresa.id).order('nome'),
      supabase.from('perfis').select('id, nome, email, papel, codigo_acesso, condominio_id, primeiro_acesso, condominios(nome)')
        .eq('empresa_id', empresa.id).order('criado_em', { ascending:false }),
    ])
    setCondominios(conds||[])
    setUsuarios(users||[])

    if (conds?.length) {
      const { data:chams } = await supabase.from('solicitacoes')
        .select('id, categoria, status, criado_em, nome_solicitante, condominios(nome)')
        .in('condominio_id', conds.map(c=>c.id))
        .order('criado_em', { ascending:false }).limit(100)
      setChamados(chams||[])
    } else {
      setChamados([])
    }
    setLoading(false)
  }

  useEffect(() => { carregar() }, [empresa.id])

  // Condomínios
  const adicionarCondo = async () => {
    if (!novoCondNome.trim()) return
    const { error } = await supabase.from('condominios').insert({ nome:novoCondNome.trim(), empresa_id:empresa.id })
    if (error) { onToast('Erro: '+error.message); return }
    setNovoCondNome(''); onToast('Condomínio adicionado.'); await carregar()
  }
  const salvarCondo = async (id, nome) => {
    await supabase.from('condominios').update({ nome }).eq('id', id)
    onToast('Salvo.'); await carregar()
  }
  const excluirCondo = async (id) => {
    if (!window.confirm('Excluir condomínio? Os chamados vinculados também serão afetados.')) return
    const { error } = await supabase.from('condominios').delete().eq('id', id)
    if (error) { onToast('Não foi possível excluir: '+error.message); return }
    onToast('Condomínio excluído.'); await carregar()
  }

  // Usuários
  const salvarUsuario = async () => {
    if (!modalUsuario) return
    const { error } = await supabase.from('perfis').update({
      nome:modalUsuario.nome, papel:modalUsuario.papel,
      codigo_acesso:modalUsuario.codigo_acesso?.toUpperCase(),
      condominio_id: ['morador','conselheiro'].includes(modalUsuario.papel) ? modalUsuario.condominio_id||null : null,
    }).eq('id', modalUsuario.id)
    if (error) { onToast('Erro: '+error.message); return }
    onToast('Usuário atualizado.'); setModalUsuario(null); await carregar()
  }

  const resetarSenha = async (userId, novaSenha) => {
    if (!novaSenha || novaSenha.length<4) { onToast('Senha muito curta.'); return }
    const session = (await supabase.auth.getSession()).data.session
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-actions`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${session?.access_token}` },
      body: JSON.stringify({ action:'reset_password', user_id:userId, new_password:novaSenha }),
    })
    const json = await resp.json()
    if (!resp.ok) { onToast('Erro: '+json.error); return }
    onToast('Senha alterada.')
  }

  const excluirUsuario = async (userId) => {
    if (!window.confirm('Excluir esta conta definitivamente?')) return
    const session = (await supabase.auth.getSession()).data.session
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-actions`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${session?.access_token}` },
      body: JSON.stringify({ action:'delete_user', user_id:userId }),
    })
    onToast('Conta excluída.'); setModalUsuario(null); await carregar()
  }

  const criarConta = async () => {
    if (!novaConta.nome||!novaConta.email||!novaConta.codigo) { onToast('Preencha nome, e-mail e código.'); return }
    setSalvando(true)
    const session = (await supabase.auth.getSession()).data.session
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-actions`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${session?.access_token}` },
      body: JSON.stringify({
        action:'create_user', email:novaConta.email, password:novaConta.senha,
        nome:novaConta.nome, papel:novaConta.papel, empresa_id:empresa.id,
        codigo_acesso:novaConta.codigo.toUpperCase(),
        condominio_id: ['morador','conselheiro'].includes(novaConta.papel) ? novaConta.condominio_id||null : null,
      }),
    })
    const json = await resp.json()
    setSalvando(false)
    if (!resp.ok) { onToast('Erro: '+json.error); return }
    onToast('Conta criada!'); setModalNovaConta(false)
    setNovaConta({ nome:'', email:'', codigo:'', senha:'mudar123', papel:'morador', condominio_id:'' })
    await carregar()
  }

  const PAPEIS = ['morador','conselheiro','equipe','admin']
  const PAPEL_LABEL = { morador:'Morador', conselheiro:'Conselheiro', equipe:'Síndico', admin:'Admin' }

  return (
    <div style={{ minHeight:'100vh', background:C.bg, color:C.text, fontFamily:'var(--font-body)' }}>
      {/* Header */}
      <div style={{ background:'#13111a', borderBottom:`1px solid #2d2438`,
        padding:'0 20px', display:'flex', alignItems:'center', gap:12, height:52 }}>
        <button onClick={onBack} style={{ background:'none', border:`1px solid ${C.border}`, borderRadius:7,
          color:C.muted, padding:'5px 12px', fontSize:12, cursor:'pointer' }}>← Voltar</button>
        <span style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:15, color:'#fff' }}>{empresa.nome}</span>
        <Badge label={empresa.plano_nome} map={PLANO_COR} />
        <Badge label={empresa.status} map={STATUS_COR} />
        <div style={{ flex:1 }}/>
        <span style={{ fontSize:12, color:C.muted }}>{condominios.length} condomínio{condominios.length!==1?'s':''} · {usuarios.length} usuário{usuarios.length!==1?'s':''}</span>
      </div>

      <div style={{ maxWidth:1100, margin:'0 auto', padding:'24px 20px' }}>
        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:`1px solid ${C.border}`, marginBottom:24 }}>
          {[['condominios','🏢 Condomínios'],['usuarios','👤 Usuários'],['chamados','📋 Chamados']].map(([id,label])=>(
            <button key={id} onClick={()=>setAba(id)} style={{
              padding:'9px 18px', background:'none', border:'none', cursor:'pointer', fontSize:13, fontWeight:600,
              color:aba===id?'#fff':C.muted, borderBottom:aba===id?`2px solid ${C.purple}`:'2px solid transparent', marginBottom:-1 }}>
              {label}
            </button>
          ))}
        </div>

        {loading && <div style={{ textAlign:'center', color:C.muted, padding:40 }}>Carregando...</div>}

        {/* ── CONDOMÍNIOS ── */}
        {!loading && aba==='condominios' && (
          <div>
            {condominios.map(c => {
              let nomeEdit = c.nome
              const qtdUsuarios = usuarios.filter(u=>u.condominio_id===c.id).length
              const qtdChamados = chamados.filter(ch=>ch.condominio_id===c.id).length
              return (
                <div key={c.id} style={{ background:C.surface, border:`1px solid ${C.border}`,
                  borderRadius:10, padding:'14px 16px', marginBottom:10,
                  display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                  <div style={{ width:36, height:36, borderRadius:8, background:'#1a3451',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:14, fontWeight:700, color:C.blue, flexShrink:0 }}>
                    {c.nome[0]}
                  </div>
                  <input defaultValue={c.nome} onChange={e=>{nomeEdit=e.target.value}}
                    style={{ flex:1, background:'transparent', border:'none', color:C.text,
                      fontSize:15, fontWeight:600, outline:'none', minWidth:120 }} />
                  <span style={{ fontSize:12, color:C.muted, whiteSpace:'nowrap' }}>
                    {qtdUsuarios} usuário{qtdUsuarios!==1?'s':''} · {qtdChamados} chamado{qtdChamados!==1?'s':''}
                  </span>
                  <div style={{ display:'flex', gap:6 }}>
                    <Btn sm onClick={()=>salvarCondo(c.id, nomeEdit)}>Salvar</Btn>
                    <Btn sm variant='danger' onClick={()=>excluirCondo(c.id)}>Excluir</Btn>
                  </div>
                </div>
              )
            })}
            <div style={{ display:'flex', gap:10, marginTop:16 }}>
              <DI value={novoCondNome} onChange={setNovoCondNome} placeholder="Nome do novo condomínio"
                style={{ flex:1 }} />
              <Btn onClick={adicionarCondo}>+ Adicionar</Btn>
            </div>
          </div>
        )}

        {/* ── USUÁRIOS ── */}
        {!loading && aba==='usuarios' && (
          <div>
            <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:16 }}>
              <Btn onClick={()=>setModalNovaConta(true)}>+ Novo usuário</Btn>
            </div>
            {['admin','equipe','conselheiro','morador'].map(papel => {
              const grupo = usuarios.filter(u=>u.papel===papel)
              if (!grupo.length) return null
              return (
                <div key={papel} style={{ marginBottom:20 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                    <span style={{ fontSize:11, fontWeight:700, padding:'3px 8px', borderRadius:5,
                      background:'#21262d', color:PAPEL_COR[papel]||C.muted, textTransform:'uppercase' }}>
                      {PAPEL_LABEL[papel]}
                    </span>
                    <span style={{ fontSize:12, color:C.muted }}>{grupo.length} conta{grupo.length!==1?'s':''}</span>
                  </div>
                  {grupo.map(u=>(
                    <div key={u.id} style={{ background:C.surface, border:`1px solid ${C.border2}`,
                      borderRadius:9, padding:'12px 14px', marginBottom:8,
                      display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                      <div style={{ width:36, height:36, borderRadius:'50%', background:'#1a3451',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:13, fontWeight:700, color:C.blue, flexShrink:0 }}>
                        {(u.nome||'?')[0].toUpperCase()}
                      </div>
                      <div style={{ flex:1, minWidth:140 }}>
                        <div style={{ fontSize:14, fontWeight:600, color:C.text, display:'flex', alignItems:'center', gap:8 }}>
                          {u.nome||'—'}
                          {u.primeiro_acesso===true && (
                            <span style={{ fontSize:10, background:'#2d1a00', color:C.amber,
                              padding:'1px 6px', borderRadius:4, fontWeight:700 }}>1º acesso</span>
                          )}
                        </div>
                        <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>
                          {u.codigo_acesso ? `Código: ${u.codigo_acesso}` : ''}
                          {u.condominios?.nome ? ` · ${u.condominios.nome}` : ''}
                        </div>
                      </div>
                      <Btn sm variant='ghost' onClick={()=>setModalUsuario({...u, novaSenha:''})}>Editar</Btn>
                    </div>
                  ))}
                </div>
              )
            })}
            {usuarios.length===0 && <div style={{ textAlign:'center', color:C.muted, padding:32 }}>Nenhum usuário cadastrado.</div>}
          </div>
        )}

        {/* ── CHAMADOS ── */}
        {!loading && aba==='chamados' && (
          <div>
            <div style={{ marginBottom:12, fontSize:13, color:C.muted }}>{chamados.length} chamado{chamados.length!==1?'s':''} no total</div>
            {chamados.length===0
              ? <div style={{ textAlign:'center', color:C.muted, padding:32 }}>Nenhum chamado registrado.</div>
              : chamados.map(s=>(
                <div key={s.id} style={{ background:C.surface, border:`1px solid ${C.border2}`,
                  borderRadius:9, padding:'11px 14px', marginBottom:8,
                  display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:600, color:C.text }}>{s.categoria}</div>
                    <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>
                      {s.condominios?.nome} {s.nome_solicitante ? `· ${s.nome_solicitante}` : ''}
                      {' · '}{new Date(s.criado_em).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                  <span style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:5,
                    background:'#21262d', color:STATUS_CHAM[s.status]||C.muted }}>
                    {s.status}
                  </span>
                </div>
              ))
            }
          </div>
        )}
      </div>

      {/* Modal editar usuário */}
      {modalUsuario && (
        <Modal title="Editar usuário" onClose={()=>setModalUsuario(null)} maxWidth={440}>
          <Fld label="Nome"><DI value={modalUsuario.nome||''} onChange={v=>setModalUsuario(m=>({...m,nome:v}))} /></Fld>
          <G2>
            <Fld label="Código de acesso">
              <DI value={modalUsuario.codigo_acesso||''} onChange={v=>setModalUsuario(m=>({...m,codigo_acesso:v.toUpperCase()}))} />
            </Fld>
            <Fld label="Papel">
              <DS value={modalUsuario.papel} onChange={v=>setModalUsuario(m=>({...m,papel:v}))}>
                {PAPEIS.map(p=><option key={p} value={p}>{PAPEL_LABEL[p]}</option>)}
              </DS>
            </Fld>
          </G2>
          {['morador','conselheiro'].includes(modalUsuario.papel) && (
            <Fld label="Condomínio">
              <DS value={modalUsuario.condominio_id||''} onChange={v=>setModalUsuario(m=>({...m,condominio_id:v}))}>
                <option value="">Sem condomínio</option>
                {condominios.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
              </DS>
            </Fld>
          )}
          <Btn onClick={salvarUsuario} style={{ width:'100%', marginBottom:16 }}>Salvar dados</Btn>
          <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:16 }}>
            <Lbl>Resetar senha</Lbl>
            <div style={{ display:'flex', gap:8, marginTop:6 }}>
              <DI value={modalUsuario.novaSenha||''} onChange={v=>setModalUsuario(m=>({...m,novaSenha:v}))} placeholder="Nova senha" />
              <Btn sm onClick={()=>resetarSenha(modalUsuario.id, modalUsuario.novaSenha)}>Resetar</Btn>
            </div>
          </div>
          <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:16, marginTop:16 }}>
            <Btn variant='danger' onClick={()=>excluirUsuario(modalUsuario.id)} style={{ width:'100%' }}>
              Excluir conta permanentemente
            </Btn>
          </div>
        </Modal>
      )}

      {/* Modal nova conta */}
      {modalNovaConta && (
        <Modal title="Novo usuário" onClose={()=>setModalNovaConta(false)} maxWidth={440}>
          <Fld label="Nome *"><DI value={novaConta.nome} onChange={v=>setNovaConta(x=>({...x,nome:v}))} /></Fld>
          <Fld label="E-mail *"><DI value={novaConta.email} onChange={v=>setNovaConta(x=>({...x,email:v}))} type="email"/></Fld>
          <G2>
            <Fld label="Código de acesso *"><DI value={novaConta.codigo} onChange={v=>setNovaConta(x=>({...x,codigo:v.toUpperCase()}))} /></Fld>
            <Fld label="Senha inicial"><DI value={novaConta.senha} onChange={v=>setNovaConta(x=>({...x,senha:v}))} /></Fld>
          </G2>
          <Fld label="Papel">
            <DS value={novaConta.papel} onChange={v=>setNovaConta(x=>({...x,papel:v}))}>
              {PAPEIS.map(p=><option key={p} value={p}>{PAPEL_LABEL[p]}</option>)}
            </DS>
          </Fld>
          {['morador','conselheiro'].includes(novaConta.papel) && (
            <Fld label="Condomínio">
              <DS value={novaConta.condominio_id} onChange={v=>setNovaConta(x=>({...x,condominio_id:v}))}>
                <option value="">Selecione...</option>
                {condominios.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
              </DS>
            </Fld>
          )}
          <Btn onClick={criarConta} disabled={salvando} style={{ width:'100%', marginTop:4 }}>
            {salvando?'Criando...':'Criar usuário'}
          </Btn>
        </Modal>
      )}
    </div>
  )
}

// ── Plano Card editável ─────────────────────────────────────
function PlanoCard({ plano, onToast, onSaved }) {
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({...plano})
  const [salvando, setSalvando] = useState(false)

  const salvar = async () => {
    setSalvando(true)
    const { error } = await supabase.from('planos').update({
      nome_exibicao:form.nome_exibicao,
      max_condominios:Number(form.max_condominios),
      max_usuarios:Number(form.max_usuarios),
      valor_mensal:Number(form.valor_mensal),
      descricao:form.descricao,
    }).eq('id', plano.id)
    setSalvando(false)
    if (error) { onToast('Erro: '+error.message); return }
    onToast('Plano atualizado.'); setEditando(false); onSaved()
  }

  if (!editando) return (
    <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:'18px 16px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
        <Badge label={plano.nome} map={PLANO_COR} />
        <Btn sm variant='ghost' onClick={()=>setEditando(true)}>Editar</Btn>
      </div>
      <div style={{ fontFamily:'var(--font-display)', fontSize:24, fontWeight:800, color:C.text, margin:'8px 0 4px' }}>
        {plano.valor_mensal===0?'Grátis':`R$ ${Number(plano.valor_mensal).toLocaleString('pt-BR')}/mês`}
      </div>
      <div style={{ fontSize:13, fontWeight:600, color:C.text, marginBottom:6 }}>{plano.nome_exibicao}</div>
      <div style={{ fontSize:12, color:C.muted, lineHeight:1.7 }}>
        Até {plano.max_condominios>=999?'∞':plano.max_condominios} condomínios<br/>
        Até {plano.max_usuarios>=9999?'∞':plano.max_usuarios} usuários<br/>
        {plano.descricao}
      </div>
    </div>
  )

  return (
    <div style={{ background:C.surface, border:`2px solid ${C.purple}`, borderRadius:12, padding:'18px 16px' }}>
      <div style={{ fontSize:11, color:C.violet, fontWeight:700, textTransform:'uppercase', marginBottom:12 }}>
        Editando: {plano.nome}
      </div>
      <Fld label="Nome de exibição"><DI value={form.nome_exibicao} onChange={v=>setForm(f=>({...f,nome_exibicao:v}))} /></Fld>
      <G2>
        <Fld label="Valor (R$/mês)"><DI value={form.valor_mensal} onChange={v=>setForm(f=>({...f,valor_mensal:v}))} type="number"/></Fld>
        <Fld label="Máx. condomínios"><DI value={form.max_condominios} onChange={v=>setForm(f=>({...f,max_condominios:v}))} type="number"/></Fld>
      </G2>
      <Fld label="Máx. usuários"><DI value={form.max_usuarios} onChange={v=>setForm(f=>({...f,max_usuarios:v}))} type="number"/></Fld>
      <Fld label="Descrição"><DI value={form.descricao||''} onChange={v=>setForm(f=>({...f,descricao:v}))} /></Fld>
      <div style={{ display:'flex', gap:8 }}>
        <Btn onClick={salvar} disabled={salvando} style={{ flex:1 }}>{salvando?'Salvando...':'Salvar'}</Btn>
        <Btn variant='ghost' onClick={()=>{ setEditando(false); setForm({...plano}) }}>Cancelar</Btn>
      </div>
    </div>
  )
}
