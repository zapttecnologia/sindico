import { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import SAFinanceiro from './SAFinanceiro'

const TemaCtx = createContext('dark')

// ── Design tokens ──────────────────────────────────────────
const TEMAS = {
  dark: {
    bg:      '#070b11',
    sidebar: '#0d1117',
    surface: '#111827',
    card:    '#161b22',
    border:  'rgba(255,255,255,.07)',
    border2: 'rgba(255,255,255,.04)',
    text:    '#f1f5f9',
    muted:   '#64748b',
    inputBg: '#1c2333',
    selectScheme: 'dark',
  },
  light: {
    bg:      '#f1f5f9',
    sidebar: '#ffffff',
    surface: '#ffffff',
    card:    '#f8fafc',
    border:  'rgba(0,0,0,.08)',
    border2: 'rgba(0,0,0,.04)',
    text:    '#0f172a',
    muted:   '#64748b',
    inputBg: '#ffffff',
    selectScheme: 'light',
  },
}

// Cores fixas independentes do tema
const CF = {
  purple: '#7c3aed',
  violet: '#a855f7',
  green:  '#22c55e',
  amber:  '#f59e0b',
  red:    '#ef4444',
  blue:   '#3b82f6',
}

const SIDEBAR_W = 240

const PLANO_COR = {
  trial:        { bg:'rgba(100,116,139,.15)', color:'#94a3b8' },
  basico:       { bg:'rgba(59,130,246,.15)',  color:'#3b82f6' },
  profissional: { bg:'rgba(139,92,246,.15)',  color:'#8b5cf6' },
  enterprise:   { bg:'rgba(245,158,11,.15)',  color:'#f59e0b' },
}
const STATUS_COR = {
  ativa:        { bg:'rgba(34,197,94,.12)',   color:'#22c55e' },
  inadimplente: { bg:'rgba(239,68,68,.12)',   color:'#ef4444' },
  suspensa:     { bg:'rgba(100,116,139,.12)', color:'#94a3b8' },
  cancelada:    { bg:'rgba(239,68,68,.08)',   color:'#64748b' },
}

function Badge({ label, map }) {
  const c = (map||{})[label] || { bg:'rgba(255,255,255,.06)', color:C.muted }
  return (
    <span style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em',
      padding:'3px 9px', borderRadius:6, background:c.bg, color:c.color, whiteSpace:'nowrap' }}>
      {label}
    </span>
  )
}
function Fld({ label, children }) {
  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ display:'block', fontSize:11, fontWeight:700, color:C.muted,
        marginBottom:5, textTransform:'uppercase', letterSpacing:'.04em' }}>{label}</label>
      {children}
    </div>
  )
}
function DI({ value, onChange, type='text', placeholder='', style={} }) {
  const tema = useContext(TemaCtx)
  const bg = tema==='light' ? '#ffffff' : '#1c2333'
  const brd = tema==='light' ? '1px solid rgba(0,0,0,.12)' : '1px solid rgba(255,255,255,.07)'
  const clr = tema==='light' ? '#0f172a' : '#f1f5f9'
  return <input type={type} value={value||''} placeholder={placeholder} onChange={e=>onChange(e.target.value)}
    style={{ width:'100%', background:bg, border:brd, borderRadius:8,
      padding:'9px 12px', color:clr, fontSize:13, outline:'none', boxSizing:'border-box', ...style }}/>
}
function DS({ value, onChange, children }) {
  const tema = useContext(TemaCtx)
  const bg = tema==='light' ? '#ffffff' : '#1c2333'
  const brd = tema==='light' ? '1px solid rgba(0,0,0,.12)' : '1px solid rgba(255,255,255,.07)'
  const clr = tema==='light' ? '#0f172a' : '#f1f5f9'
  return <select value={value||''} onChange={e=>onChange(e.target.value)}
    style={{ width:'100%', background:bg, border:brd, borderRadius:8,
      padding:'9px 12px', color:clr, fontSize:13, outline:'none', boxSizing:'border-box',
      colorScheme:tema }}>
    {children}
  </select>
}
function G2({ children }) {
  return <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>{children}</div>
}
function Btn({ children, onClick, variant='primary', sm, disabled, style={} }) {
  const bg = variant==='primary'?C.purple:variant==='danger'?'transparent':'rgba(255,255,255,.06)'
  const border = variant==='danger'?`1px solid ${C.red}`:`1px solid ${C.border}`
  const color = variant==='danger'?C.red:C.text
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ padding:sm?'5px 12px':'9px 16px', background:bg, border, borderRadius:8, color,
        fontSize:sm?12:13, fontWeight:600, cursor:'pointer', opacity:disabled?.5:1,
        whiteSpace:'nowrap', transition:'opacity .15s', ...style }}>
      {children}
    </button>
  )
}
function Modal({ title, onClose, children, maxWidth=500 }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:80,
      display:'flex', alignItems:'center', justifyContent:'center', padding:16, overflowY:'auto' }}>
      <div style={{ background:'#161b22', border:`1px solid rgba(255,255,255,.1)`, borderRadius:16,
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

export default function SuperAdmin({ onToast }) {
  const { logout } = useAuth()
  const [tema, setTema] = useState(() => localStorage.getItem('sa_tema') || 'dark')
  const C = { ...TEMAS[tema], ...CF }

  const toggleTema = () => {
    const novo = tema === 'dark' ? 'light' : 'dark'
    setTema(novo)
    localStorage.setItem('sa_tema', novo)
  }
  const [empresas, setEmpresas] = useState([])
  const [planos, setPlanos] = useState([])
  const [branding, setBranding] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sa_branding')||'{}') } catch { return {} }
  })
  const [activeMenu, setActiveMenu] = useState('dashboard')
  const [subMenu, setSubMenu] = useState(null)
  const [expandidos, setExpandidos] = useState({ clientes:true, financeiro:false })
  const [empresaSel, setEmpresaSel] = useState(null)
  const [modalNova, setModalNova] = useState(false)
  const [modalEditar, setModalEditar] = useState(null)
  const [busca, setBusca] = useState('')
  const VAZIO = { nome:'', cnpj:'', email_contato:'', telefone_contato:'',
    plano_nome:'trial', plano_vencimento:'', obs:'', admin_nome:'', admin_email:'', admin_senha:'mudar123', admin_codigo:'' }
  const [nova, setNova] = useState(VAZIO)
  const [salvando, setSalvando] = useState(false)

  const carregar = async () => {
    const [{ data:emp }, { data:pl }] = await Promise.all([
      supabase.from('vw_empresas_painel').select('*'),
      supabase.from('planos').select('*').eq('ativo',true).order('valor_mensal'),
    ])
    if (emp) setEmpresas(emp)
    if (pl) setPlanos(pl)
  }

  useEffect(() => { carregar() }, [])

  const salvarBranding = (key, val) => {
    const b = { ...branding, [key]:val }
    setBranding(b)
    localStorage.setItem('sa_branding', JSON.stringify(b))
  }

  // Filtrar empresas por status do submenu
  const empresasFiltradas = () => {
    let base = empresas
    if (busca) base = base.filter(e => e.nome.toLowerCase().includes(busca.toLowerCase()) || (e.email_contato||'').toLowerCase().includes(busca.toLowerCase()))
    if (subMenu === 'ativos') return base.filter(e => e.status === 'ativa')
    if (subMenu === 'inadimplentes') return base.filter(e => e.status === 'inadimplente')
    if (subMenu === 'suspensos') return base.filter(e => e.status === 'suspensa')
    if (subMenu === 'cancelados') return base.filter(e => e.status === 'cancelada')
    return base
  }

  const criarEmpresa = async () => {
    if (!nova.nome || !nova.admin_email || !nova.admin_nome || !nova.admin_codigo) { onToast('Preencha todos os campos.'); return }
    setSalvando(true)
    try {
      const planoObj = planos.find(p=>p.nome===nova.plano_nome)
      const venc = nova.plano_nome==='trial' ? new Date(Date.now()+30*86400000).toISOString().split('T')[0] : nova.plano_vencimento||null
      const { data:emp, error:eErr } = await supabase.from('empresas').insert({
        nome:nova.nome, cnpj:nova.cnpj||null, email_contato:nova.email_contato||null,
        telefone_contato:nova.telefone_contato||null, plano_id:planoObj?.id||null,
        plano_nome:nova.plano_nome, status:'ativa', plano_vencimento:venc, obs:nova.obs||null,
      }).select().single()
      if (eErr) throw new Error(eErr.message)
      const session = (await supabase.auth.getSession()).data.session
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-actions`,{
        method:'POST',
        headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${session?.access_token}` },
        body: JSON.stringify({ action:'create_user', email:nova.admin_email, password:nova.admin_senha,
          nome:nova.admin_nome, papel:'admin', empresa_id:emp.id, codigo_acesso:nova.admin_codigo.toUpperCase() }),
      })
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.error)
      onToast('✅ Empresa criada!'); setModalNova(false); setNova(VAZIO); await carregar()
    } catch(e) { onToast('Erro: '+e.message) }
    setSalvando(false)
  }

  const salvarEmpresa = async () => {
    if (!modalEditar) return
    const { error } = await supabase.from('empresas').update({
      nome:modalEditar.nome, cnpj:modalEditar.cnpj,
      email_contato:modalEditar.email_contato, telefone_contato:modalEditar.telefone_contato,
      plano_nome:modalEditar.plano_nome, status:modalEditar.status,
      plano_vencimento:modalEditar.plano_vencimento||null, obs:modalEditar.obs,
    }).eq('id', modalEditar.id)
    if (error) { onToast('Erro: '+error.message); return }
    onToast('Salvo.'); setModalEditar(null); await carregar()
  }

  const metricas = {
    total: empresas.length,
    ativas: empresas.filter(e=>e.status==='ativa').length,
    trial: empresas.filter(e=>e.plano_nome==='trial').length,
    inadimplentes: empresas.filter(e=>e.status==='inadimplente').length,
    suspensos: empresas.filter(e=>e.status==='suspensa').length,
    cancelados: empresas.filter(e=>e.status==='cancelada').length,
    condominios: empresas.reduce((s,e)=>s+(e.total_condominios||0),0),
    usuarios: empresas.reduce((s,e)=>s+(e.total_usuarios||0),0),
  }

  const corPrimaria = branding.corPrimaria || '#7c3aed'

  // Se empresa selecionada → vai para EmpresaPanel
  if (empresaSel) return <EmpresaPanel empresa={empresaSel} planos={planos}
    onBack={()=>{ setEmpresaSel(null); carregar() }} onToast={onToast} />

  const MENU_ITEMS = [
    { id:'dashboard',    label:'Dashboard',      icon:'📊', section:null },
    { id:'minha-empresa',label:'Minha empresa',  icon:'🏢', section:null },
    { id:'clientes',     label:'Clientes',       icon:'👥', section:null, hasSubmenu:true,
      submenu:[
        { id:'todos',        label:'Todos',          badge:metricas.total },
        { id:'ativos',       label:'Ativos',         badge:metricas.ativas,        cor:C.green },
        { id:'inadimplentes',label:'Inadimplentes',  badge:metricas.inadimplentes, cor:metricas.inadimplentes>0?C.red:C.muted },
        { id:'suspensos',    label:'Suspensos',      badge:metricas.suspensos,     cor:C.amber },
        { id:'cancelados',   label:'Cancelados',     badge:metricas.cancelados,    cor:C.muted },
      ]
    },
    { id:'usuarios',     label:'Usuários',       icon:'👤', section:null },
    { id:'planos',       label:'Planos',         icon:'💳', section:null },
    { id:'financeiro',   label:'Financeiro',     icon:'💰', section:null },
  ]

  const navTo = (id, sub=null) => {
    setActiveMenu(id)
    setSubMenu(sub)
    setBusca('')
    if (id==='clientes' && !sub) setSubMenu('todos')
    if (MENU_ITEMS.find(m=>m.id===id)?.hasSubmenu) {
      setExpandidos(prev=>({...prev,[id]:true}))
    }
  }

  return (
    <TemaCtx.Provider value={tema}>
    <div style={{ display:'flex', minHeight:'100vh', background:C.bg, color:C.text, fontFamily:'var(--font-body)' }}>

      {/* ── SIDEBAR ── */}
      <div style={{ width:SIDEBAR_W, background:C.sidebar, borderRight:`1px solid ${C.border}`,
        display:'flex', flexDirection:'column', position:'fixed', top:0, left:0, height:'100vh', zIndex:40 }}>

        {/* Logo / Branding */}
        <div style={{ padding:'20px 18px', borderBottom:`1px solid ${C.border}` }}>
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt="Logo" style={{ height:36, objectFit:'contain', marginBottom:8 }}/>
          ) : (
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
              <div style={{ width:34, height:34, borderRadius:9,
                background:`linear-gradient(135deg,${corPrimaria},${corPrimaria}aa)`,
                display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <path d="M4 21V8L12 3l8 5v13"/><path d="M9 21v-6h6v6"/>
                </svg>
              </div>
              <div>
                <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:13, color:'#fff', lineHeight:1 }}>
                  {branding.nomePlataforma || 'Portal de Chamados'}
                </div>
                <div style={{ fontSize:9, color:corPrimaria, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', marginTop:2 }}>
                  Admin
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navegação */}
        <nav style={{ flex:1, overflowY:'auto', padding:'10px 8px' }}>
          {MENU_ITEMS.map(item => (
            <div key={item.id}>
              <button onClick={() => {
                if (item.hasSubmenu) {
                  setExpandidos(prev=>({...prev,[item.id]:!prev[item.id]}))
                  navTo(item.id, 'todos')
                } else {
                  navTo(item.id)
                }
              }}
                style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'9px 12px',
                  borderRadius:8, border:'none', cursor:'pointer', textAlign:'left',
                  background: activeMenu===item.id&&!subMenu ? `${corPrimaria}25` : 'transparent',
                  color: activeMenu===item.id&&!subMenu ? '#fff' : C.muted,
                  fontWeight: activeMenu===item.id ? 600 : 400, fontSize:13, transition:'all .15s' }}>
                <span style={{ fontSize:15, flexShrink:0 }}>{item.icon}</span>
                <span style={{ flex:1 }}>{item.label}</span>
                {item.hasSubmenu && (
                  <span style={{ fontSize:10, opacity:.5 }}>{expandidos[item.id]?'▲':'▼'}</span>
                )}
              </button>

              {/* Submenu */}
              {item.hasSubmenu && expandidos[item.id] && (
                <div style={{ marginLeft:14, marginBottom:4 }}>
                  {item.submenu.map(s => (
                    <button key={s.id} onClick={() => navTo(item.id, s.id)}
                      style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
                        padding:'7px 12px', borderRadius:7, border:'none', cursor:'pointer', fontSize:13,
                        background: subMenu===s.id ? `${corPrimaria}20` : 'transparent',
                        color: subMenu===s.id ? '#fff' : C.muted,
                        fontWeight: subMenu===s.id ? 600 : 400, transition:'all .15s' }}>
                      <span>{s.label}</span>
                      <span style={{ fontSize:11, fontWeight:700, color:s.cor||C.muted,
                        background:'rgba(255,255,255,.06)', padding:'1px 7px', borderRadius:10 }}>
                        {s.badge}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Footer sidebar */}
        <div style={{ padding:'12px 10px', borderTop:`1px solid ${C.border}` }}>
          <button onClick={logout} style={{ width:'100%', display:'flex', alignItems:'center', gap:8,
            padding:'8px 12px', borderRadius:8, border:`1px solid ${C.border}`, background:'transparent',
            color:C.muted, fontSize:13, fontWeight:600, cursor:'pointer' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
              <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sair da plataforma
          </button>
        </div>
      </div>

      {/* ── CONTEÚDO PRINCIPAL ── */}
      <div style={{ marginLeft:SIDEBAR_W, flex:1, minHeight:'100vh', background:C.bg }}>

        {/* Topbar */}
        <div style={{ height:52, borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center',
          padding:'0 28px', gap:12, position:'sticky', top:0, background:C.bg, zIndex:30 }}>
          <div style={{ flex:1, fontSize:14, fontWeight:700, color:C.text }}>
            {MENU_ITEMS.find(m=>m.id===activeMenu)?.label}
            {subMenu && subMenu!=='todos' && <span style={{ color:C.muted, fontWeight:400, marginLeft:8 }}>
              / {MENU_ITEMS.find(m=>m.id===activeMenu)?.submenu?.find(s=>s.id===subMenu)?.label}
            </span>}
          </div>
          <div style={{ fontSize:12, color:C.muted }}>
            {new Date().toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short',year:'numeric'})}
          </div>
          <button onClick={toggleTema}
            title={tema==='dark'?'Mudar para tema claro':'Mudar para tema escuro'}
            style={{ padding:'5px 12px', background:tema==='dark'?'rgba(255,255,255,.06)':'rgba(0,0,0,.06)',
              border:`1px solid ${C.border}`, borderRadius:8, color:C.muted,
              fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontWeight:600 }}>
            {tema==='dark' ? '☀️ Claro' : '🌙 Escuro'}
          </button>
          <div style={{ padding:'3px 10px', background:`${corPrimaria}20`, border:`1px solid ${corPrimaria}40`,
            borderRadius:6, fontSize:11, color:corPrimaria, fontWeight:700, letterSpacing:'.08em' }}>
            SUPER ADMIN
          </div>
        </div>

        <div style={{ padding:'28px 32px' }}>

          {/* ── DASHBOARD ── */}
          {activeMenu==='dashboard' && (
            <div>
              <h2 style={{ margin:'0 0 4px', fontSize:22, fontWeight:800, color:C.text }}>Bem-vindo ao painel</h2>
              <p style={{ margin:'0 0 24px', fontSize:13, color:C.muted }}>Visão geral da plataforma</p>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12, marginBottom:28 }}>
                {[
                  { l:'Clientes',       v:metricas.total,         c:C.text,   ic:'🏢', onClick:()=>navTo('clientes','todos') },
                  { l:'Ativos',         v:metricas.ativas,        c:C.green,  ic:'✅', onClick:()=>navTo('clientes','ativos') },
                  { l:'Inadimplentes',  v:metricas.inadimplentes, c:metricas.inadimplentes>0?C.red:C.muted, ic:'⚠️', onClick:()=>navTo('clientes','inadimplentes') },
                  { l:'Condomínios',    v:metricas.condominios,   c:C.blue,   ic:'🏘' },
                  { l:'Usuários',       v:metricas.usuarios,      c:C.violet, ic:'👥' },
                  { l:'Em trial',       v:metricas.trial,         c:C.amber,  ic:'🔔', onClick:()=>navTo('clientes','ativos') },
                ].map(k=>(
                  <div key={k.l} onClick={k.onClick}
                    style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12,
                      padding:'18px 20px', cursor:k.onClick?'pointer':'default', transition:'all .15s' }}
                    onMouseEnter={e=>{ if(k.onClick) e.currentTarget.style.borderColor=corPrimaria }}
                    onMouseLeave={e=>{ e.currentTarget.style.borderColor=C.border }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
                      <span style={{ fontSize:18 }}>{k.ic}</span>
                    </div>
                    <div style={{ fontFamily:'var(--font-display)', fontSize:32, fontWeight:800, color:k.c, lineHeight:1 }}>{k.v}</div>
                    <div style={{ fontSize:11, color:C.muted, marginTop:6, fontWeight:600, textTransform:'uppercase', letterSpacing:'.05em' }}>{k.l}</div>
                  </div>
                ))}
              </div>

              {/* Empresas recentes */}
              <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden' }}>
                <div style={{ padding:'16px 20px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontWeight:700, color:C.text }}>Clientes recentes</span>
                  <Btn sm onClick={()=>navTo('clientes','todos')}>Ver todos →</Btn>
                </div>
                {empresas.slice(0,5).map((e,i)=>(
                  <div key={e.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 20px',
                    borderBottom:i<4?`1px solid ${C.border2}`:'', transition:'background .1s' }}
                    onMouseEnter={el=>el.currentTarget.style.background='rgba(255,255,255,.02)'}
                    onMouseLeave={el=>el.currentTarget.style.background='transparent'}>
                    <div style={{ width:36, height:36, borderRadius:9, background:`${corPrimaria}20`,
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:800, color:corPrimaria, flexShrink:0 }}>
                      {e.nome[0]}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:600, color:C.text, fontSize:14 }}>{e.nome}</div>
                      <div style={{ fontSize:11, color:C.muted }}>{e.email_contato||'—'}</div>
                    </div>
                    <Badge label={e.plano_nome} map={PLANO_COR}/>
                    <Badge label={e.status} map={STATUS_COR}/>
                    <Btn sm onClick={()=>setEmpresaSel(e)}>Gerenciar</Btn>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── MINHA EMPRESA ── */}
          {activeMenu==='minha-empresa' && (
            <div style={{ maxWidth:600 }}>
              <h2 style={{ margin:'0 0 4px', fontSize:20, fontWeight:800, color:C.text }}>Minha empresa</h2>
              <p style={{ margin:'0 0 24px', fontSize:13, color:C.muted }}>Dados da plataforma e identidade visual</p>

              <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:'24px', marginBottom:16 }}>
                <div style={{ fontSize:13, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:16 }}>
                  Identidade visual
                </div>
                <Fld label="Nome da plataforma">
                  <DI value={branding.nomePlataforma||''} onChange={v=>salvarBranding('nomePlataforma',v)} placeholder="Portal de Chamados"/>
                </Fld>
                <Fld label="URL da logo (PNG/SVG)">
                  <DI value={branding.logoUrl||''} onChange={v=>salvarBranding('logoUrl',v)} placeholder="https://..."/>
                </Fld>
                <Fld label="Cor primária">
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <input type="color" value={branding.corPrimaria||'#7c3aed'} onChange={e=>salvarBranding('corPrimaria',e.target.value)}
                      style={{ width:44, height:36, border:`1px solid ${C.border}`, borderRadius:7, cursor:'pointer', padding:2, background:'transparent' }}/>
                    <DI value={branding.corPrimaria||'#7c3aed'} onChange={v=>salvarBranding('corPrimaria',v)} style={{ maxWidth:140, fontFamily:'monospace' }}/>
                    <div style={{ width:36, height:36, borderRadius:8, background:branding.corPrimaria||'#7c3aed' }}/>
                  </div>
                </Fld>
                <div style={{ padding:'12px 14px', background:`${corPrimaria}10`, border:`1px solid ${corPrimaria}30`,
                  borderRadius:8, fontSize:13, color:corPrimaria, marginTop:8 }}>
                  ✅ Alterações salvas automaticamente na sidebar.
                </div>
              </div>

              {/* Preview */}
              <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:'24px' }}>
                <div style={{ fontSize:13, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:16 }}>
                  Preview da sidebar
                </div>
                <div style={{ background:'#0d1117', borderRadius:10, padding:16, border:`1px solid ${C.border}`, maxWidth:200 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                    <div style={{ width:28, height:28, borderRadius:7, background:`linear-gradient(135deg,${corPrimaria},${corPrimaria}aa)`,
                      display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                        <path d="M4 21V8L12 3l8 5v13"/><path d="M9 21v-6h6v6"/>
                      </svg>
                    </div>
                    <div style={{ fontSize:12, fontWeight:800, color:'#fff' }}>{branding.nomePlataforma||'Portal de Chamados'}</div>
                  </div>
                  {['Dashboard','Clientes','Usuários','Financeiro'].map((item,i)=>(
                    <div key={item} style={{ padding:'6px 10px', borderRadius:6, marginBottom:4, fontSize:12,
                      background:i===0?`${corPrimaria}25`:'transparent', color:i===0?'#fff':'#64748b', fontWeight:i===0?600:400 }}>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── CLIENTES ── */}
          {activeMenu==='clientes' && (
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
                <div>
                  <h2 style={{ margin:0, fontSize:20, fontWeight:800, color:C.text }}>
                    {subMenu==='ativos'?'Clientes ativos':subMenu==='inadimplentes'?'Inadimplentes':
                     subMenu==='suspensos'?'Suspensos':subMenu==='cancelados'?'Cancelados':'Todos os clientes'}
                  </h2>
                  <p style={{ margin:'4px 0 0', fontSize:13, color:C.muted }}>{empresasFiltradas().length} empresa{empresasFiltradas().length!==1?'s':''}</p>
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <input placeholder="Buscar..." value={busca} onChange={e=>setBusca(e.target.value)}
                    style={{ background:'rgba(255,255,255,.05)', border:`1px solid ${C.border}`, borderRadius:8,
                      padding:'8px 14px', color:C.text, fontSize:13, width:200, outline:'none' }}/>
                  <Btn onClick={()=>setModalNova(true)}>+ Nova empresa</Btn>
                </div>
              </div>

              <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead>
                    <tr style={{ background:'rgba(255,255,255,.02)', borderBottom:`1px solid ${C.border}` }}>
                      {['Empresa','Plano','Status','Condos','Usuários','Abertos','Vencimento','Ações'].map(h=>(
                        <th key={h} style={{ padding:'11px 14px', textAlign:'left', fontSize:11, fontWeight:700,
                          color:C.muted, textTransform:'uppercase', letterSpacing:'.05em', whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {empresasFiltradas().length===0&&(
                      <tr><td colSpan={8} style={{ padding:48, textAlign:'center', color:C.muted }}>
                        Nenhuma empresa encontrada.
                      </td></tr>
                    )}
                    {empresasFiltradas().map((e,i)=>{
                      const vencEm = e.plano_vencimento ? Math.ceil((new Date(e.plano_vencimento)-new Date())/86400000) : null
                      return (
                        <tr key={e.id} style={{ borderBottom:`1px solid ${C.border2}`, transition:'background .1s' }}
                          onMouseEnter={el=>el.currentTarget.style.background='rgba(255,255,255,.02)'}
                          onMouseLeave={el=>el.currentTarget.style.background='transparent'}>
                          <td style={{ padding:'12px 14px' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                              <div style={{ width:32, height:32, borderRadius:8, background:`${corPrimaria}20`,
                                display:'flex', alignItems:'center', justifyContent:'center',
                                fontSize:13, fontWeight:800, color:corPrimaria, flexShrink:0 }}>
                                {e.nome[0]}
                              </div>
                              <div>
                                <div style={{ fontWeight:700, color:C.text }}>{e.nome}</div>
                                <div style={{ fontSize:11, color:C.muted }}>{e.email_contato||'—'}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding:'12px 14px' }}><Badge label={e.plano_nome} map={PLANO_COR}/></td>
                          <td style={{ padding:'12px 14px' }}><Badge label={e.status} map={STATUS_COR}/></td>
                          <td style={{ padding:'12px 14px', textAlign:'center', fontWeight:800, color:C.blue, fontSize:15 }}>{e.total_condominios}</td>
                          <td style={{ padding:'12px 14px', textAlign:'center', fontWeight:800, color:C.violet, fontSize:15 }}>{e.total_usuarios}</td>
                          <td style={{ padding:'12px 14px', textAlign:'center', fontWeight:800, fontSize:15,
                            color:e.chamados_abertos>0?C.amber:C.muted }}>{e.chamados_abertos}</td>
                          <td style={{ padding:'12px 14px' }}>
                            {vencEm!==null ? (
                              <span style={{ fontSize:12, fontWeight:600,
                                color:vencEm<=0?C.red:vencEm<=15?C.amber:'rgba(255,255,255,.3)' }}>
                                {vencEm<=0?'Vencido':vencEm<=7?`${vencEm}d ⚠`:vencEm<=15?`${vencEm}d`:new Date(e.plano_vencimento).toLocaleDateString('pt-BR')}
                              </span>
                            ) : <span style={{ color:C.muted }}>—</span>}
                          </td>
                          <td style={{ padding:'12px 14px' }}>
                            <div style={{ display:'flex', gap:6 }}>
                              <Btn sm onClick={()=>setEmpresaSel(e)}>Gerenciar</Btn>
                              <Btn sm variant='ghost' onClick={()=>setModalEditar({...e})}>Editar</Btn>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── USUÁRIOS ── */}
          {activeMenu==='usuarios' && <PainelAdmins empresas={empresas} onToast={onToast} />}

          {/* ── PLANOS ── */}
          {activeMenu==='planos' && (
            <div>
              <h2 style={{ margin:'0 0 4px', fontSize:20, fontWeight:800, color:C.text }}>Planos</h2>
              <p style={{ margin:'0 0 24px', fontSize:13, color:C.muted }}>Gerencie os planos e veja quem está em cada um</p>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:16 }}>
                {planos.map(p => {
                  const clientes = empresas.filter(e=>e.plano_nome===p.nome)
                  return (
                    <div key={p.id} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden' }}>
                      <div style={{ padding:'18px 20px', borderBottom:`1px solid ${C.border}` }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                          <Badge label={p.nome} map={PLANO_COR}/>
                          <PlanoCardEdicao plano={p} onToast={onToast} onSaved={carregar} />
                        </div>
                        <div style={{ fontFamily:'var(--font-display)', fontSize:26, fontWeight:800, color:C.text, margin:'10px 0 4px' }}>
                          {Number(p.valor_mensal)===0?'Gratuito':`R$ ${Number(p.valor_mensal).toLocaleString('pt-BR')}/mês`}
                        </div>
                        <div style={{ fontSize:13, color:C.muted }}>{p.nome_exibicao}</div>
                        <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>
                          {clientes.length} cliente{clientes.length!==1?'s':''}
                          {' · '}Até {p.max_condominios>=999?'∞':p.max_condominios} condos
                          {p.max_unidades && p.max_unidades < 999999 ? ` · ${p.max_unidades.toLocaleString('pt-BR')} unidades` : ''}
                        </div>
                      </div>
                      <div style={{ maxHeight:160, overflowY:'auto' }}>
                        {clientes.length===0
                          ? <div style={{ padding:'16px 20px', fontSize:13, color:C.muted }}>Nenhum cliente neste plano.</div>
                          : clientes.map(c=>(
                            <div key={c.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                              padding:'8px 20px', borderBottom:`1px solid ${C.border2}` }}>
                              <span style={{ fontSize:13, color:C.text, fontWeight:500 }}>{c.nome}</span>
                              <Badge label={c.status} map={STATUS_COR}/>
                            </div>
                          ))
                        }
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── FINANCEIRO ── */}
          {activeMenu==='financeiro' && <SAFinanceiro empresas={empresas} planos={planos} />}

        </div>
      </div>

      {/* Modal nova empresa */}
      {modalNova && (
        <Modal title="Nova empresa" onClose={()=>setModalNova(false)} maxWidth={540}>
          <Fld label="Nome da empresa *"><DI value={nova.nome} onChange={v=>setNova(x=>({...x,nome:v}))} placeholder="Ex.: Síndico Prime Ltda"/></Fld>
          <G2>
            <Fld label="CNPJ"><DI value={nova.cnpj} onChange={v=>setNova(x=>({...x,cnpj:v}))}/></Fld>
            <Fld label="Plano">
              <DS value={nova.plano_nome} onChange={v=>setNova(x=>({...x,plano_nome:v}))}>
                {planos.map(p=><option key={p.id} value={p.nome}>{p.nome_exibicao}</option>)}
              </DS>
            </Fld>
          </G2>
          <G2>
            <Fld label="E-mail"><DI value={nova.email_contato} onChange={v=>setNova(x=>({...x,email_contato:v}))} type="email"/></Fld>
            <Fld label="Telefone"><DI value={nova.telefone_contato} onChange={v=>setNova(x=>({...x,telefone_contato:v}))}/></Fld>
          </G2>
          {nova.plano_nome!=='trial'&&<Fld label="Vencimento"><DI value={nova.plano_vencimento} onChange={v=>setNova(x=>({...x,plano_vencimento:v}))} type="date"/></Fld>}
          <div style={{ borderTop:`1px solid ${C.border}`, margin:'16px 0', paddingTop:16, fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'.05em' }}>
            Admin da empresa
          </div>
          <G2>
            <Fld label="Nome *"><DI value={nova.admin_nome} onChange={v=>setNova(x=>({...x,admin_nome:v}))}/></Fld>
            <Fld label="E-mail *"><DI value={nova.admin_email} onChange={v=>setNova(x=>({...x,admin_email:v}))} type="email"/></Fld>
          </G2>
          <G2>
            <Fld label="Código de acesso *"><DI value={nova.admin_codigo} onChange={v=>setNova(x=>({...x,admin_codigo:v.toUpperCase()}))} placeholder="Ex.: ADMIN01"/></Fld>
            <Fld label="Senha inicial"><DI value={nova.admin_senha} onChange={v=>setNova(x=>({...x,admin_senha:v}))}/></Fld>
          </G2>
          <Btn onClick={criarEmpresa} disabled={salvando} style={{ width:'100%' }}>{salvando?'Criando...':'Criar empresa'}</Btn>
        </Modal>
      )}

      {/* Modal editar empresa */}
      {modalEditar && (
        <Modal title="Editar empresa" onClose={()=>setModalEditar(null)} maxWidth={460}>
          <Fld label="Nome"><DI value={modalEditar.nome} onChange={v=>setModalEditar(m=>({...m,nome:v}))}/></Fld>
          <G2>
            <Fld label="CNPJ"><DI value={modalEditar.cnpj||''} onChange={v=>setModalEditar(m=>({...m,cnpj:v}))}/></Fld>
            <Fld label="Status">
              <DS value={modalEditar.status} onChange={v=>setModalEditar(m=>({...m,status:v}))}>
                {['ativa','inadimplente','suspensa','cancelada'].map(s=><option key={s}>{s}</option>)}
              </DS>
            </Fld>
          </G2>
          <G2>
            <Fld label="Plano">
              <DS value={modalEditar.plano_nome} onChange={v=>setModalEditar(m=>({...m,plano_nome:v}))}>
                {planos.map(p=><option key={p.id} value={p.nome}>{p.nome_exibicao}</option>)}
              </DS>
            </Fld>
            <Fld label="Vencimento"><DI value={modalEditar.plano_vencimento||''} onChange={v=>setModalEditar(m=>({...m,plano_vencimento:v}))} type="date"/></Fld>
          </G2>
          <G2>
            <Fld label="E-mail"><DI value={modalEditar.email_contato||''} onChange={v=>setModalEditar(m=>({...m,email_contato:v}))} type="email"/></Fld>
            <Fld label="Telefone"><DI value={modalEditar.telefone_contato||''} onChange={v=>setModalEditar(m=>({...m,telefone_contato:v}))}/></Fld>
          </G2>
          <Fld label="Obs."><DI value={modalEditar.obs||''} onChange={v=>setModalEditar(m=>({...m,obs:v}))}/></Fld>
          <Btn onClick={salvarEmpresa} style={{ width:'100%' }}>Salvar</Btn>
          <div style={{ borderTop:`1px solid ${C.border}`, marginTop:20, paddingTop:20 }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:12 }}>Código do admin</div>
            <AdminCodigoEditor empresaId={modalEditar.id} onToast={onToast}/>
          </div>
        </Modal>
      )}
    </div>
    </TemaCtx.Provider>
  )
}
function PlanoCardEdicao({ plano, onToast, onSaved }) {
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({...plano})
  const salvar = async () => {
    await supabase.from('planos').update({
      nome_exibicao:form.nome_exibicao,
      max_condominios:Number(form.max_condominios),
      max_unidades:Number(form.max_unidades)||999999,
      max_usuarios:Number(form.max_usuarios),
      valor_mensal:Number(form.valor_mensal),
      descricao:form.descricao
    }).eq('id',plano.id)
    onToast('Plano atualizado.'); setEditando(false); onSaved()
  }
  if (!editando) return <button onClick={()=>setEditando(true)} style={{ background:'none', border:`1px solid ${C.border}`, borderRadius:6, color:C.muted, padding:'3px 10px', fontSize:11, cursor:'pointer' }}>Editar</button>
  return (
    <div style={{ position:'absolute', right:20, top:16, background:'#1a1f2e', border:`1px solid #7c3aed`, borderRadius:10, padding:14, zIndex:10, minWidth:260 }}>
      <div style={{ fontSize:11, color:'#a855f7', fontWeight:700, marginBottom:10 }}>Editando plano</div>
      {[['nome_exibicao','Nome'],['valor_mensal','Valor/mês'],['max_condominios','Máx. condos'],['max_unidades','Máx. unidades'],['max_usuarios','Máx. usuários']].map(([k,l])=>(
        <div key={k} style={{ marginBottom:8 }}>
          <label style={{ fontSize:10, color:C.muted, display:'block', marginBottom:3 }}>{l}</label>
          <input value={form[k]||''} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}
            style={{ width:'100%', background:'#0d1117', border:`1px solid ${C.border}`, borderRadius:6, padding:'6px 9px', color:C.text, fontSize:12, outline:'none', boxSizing:'border-box' }}/>
        </div>
      ))}
      <div style={{ display:'flex', gap:8, marginTop:10 }}>
        <button onClick={salvar} style={{ flex:1, padding:'6px', background:'#7c3aed', border:'none', borderRadius:6, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>Salvar</button>
        <button onClick={()=>{setEditando(false);setForm({...plano})}} style={{ padding:'6px 10px', background:'none', border:`1px solid ${C.border}`, borderRadius:6, color:C.muted, fontSize:12, cursor:'pointer' }}>✕</button>
      </div>
    </div>
  )
}

// ── PainelAdmins ──────────────────────────────────────────
function PainelAdmins({ empresas, onToast }) {
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroEmpresa, setFiltroEmpresa] = useState('todas')
  const [filtroPapel, setFiltroPapel] = useState('todos')

  const carregar = async () => {
    setLoading(true)
    const { data } = await supabase.from('perfis').select('id,nome,email,papel,codigo_acesso,empresa_id,primeiro_acesso').in('papel',['admin','equipe']).order('criado_em',{ascending:false})
    setAdmins(data||[]); setLoading(false)
  }
  useEffect(()=>{ carregar() },[])

  const adminsFiltrados = admins.filter(a=>{
    if (busca&&!a.nome?.toLowerCase().includes(busca.toLowerCase())&&!a.email?.toLowerCase().includes(busca.toLowerCase())&&!a.codigo_acesso?.toLowerCase().includes(busca.toLowerCase())) return false
    if (filtroEmpresa!=='todas'&&a.empresa_id!==filtroEmpresa) return false
    if (filtroPapel!=='todos'&&a.papel!==filtroPapel) return false
    return true
  })

  const salvar = async () => {
    if (!editando) return
    setSalvando(true)
    const { error } = await supabase.from('perfis').update({ nome:editando.nome, codigo_acesso:editando.codigo_acesso?.toUpperCase(), empresa_id:editando.empresa_id||null }).eq('id',editando.id)
    setSalvando(false)
    if (error) { onToast('Erro: '+error.message); return }
    onToast('Salvo.'); setEditando(null); await carregar()
  }

  return (
    <div>
      <h2 style={{ margin:'0 0 4px', fontSize:20, fontWeight:800, color:C.text }}>Usuários admin e síndicos</h2>
      <p style={{ margin:'0 0 20px', fontSize:13, color:C.muted }}>{admins.length} usuários</p>
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        <input placeholder="Buscar..." value={busca} onChange={e=>setBusca(e.target.value)}
          style={{ background:'rgba(255,255,255,.05)', border:`1px solid ${C.border}`, borderRadius:8, padding:'8px 14px', color:C.text, fontSize:13, width:220, outline:'none' }}/>
        <select value={filtroEmpresa} onChange={e=>setFiltroEmpresa(e.target.value)}
          style={{ background:'rgba(255,255,255,.05)', border:`1px solid ${C.border}`, borderRadius:8, padding:'8px 12px', color:C.text, fontSize:13, outline:'none' }}>
          <option value="todas">Todas empresas</option>
          {empresas.map(e=><option key={e.id} value={e.id}>{e.nome}</option>)}
          <option value="">Sem empresa</option>
        </select>
        <select value={filtroPapel} onChange={e=>setFiltroPapel(e.target.value)}
          style={{ background:'rgba(255,255,255,.05)', border:`1px solid ${C.border}`, borderRadius:8, padding:'8px 12px', color:C.text, fontSize:13, outline:'none' }}>
          <option value="todos">Todos os papéis</option>
          <option value="admin">Admin</option>
          <option value="equipe">Síndico</option>
        </select>
      </div>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ background:'rgba(255,255,255,.02)', borderBottom:`1px solid ${C.border}` }}>
              {['Usuário','Papel','Empresa','Código','Status',''].map(h=>(
                <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'.04em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading&&<tr><td colSpan={6} style={{ padding:40, textAlign:'center', color:C.muted }}>Carregando...</td></tr>}
            {!loading&&adminsFiltrados.length===0&&<tr><td colSpan={6} style={{ padding:40, textAlign:'center', color:C.muted }}>Nenhum usuário encontrado.</td></tr>}
            {adminsFiltrados.map(a=>(
              <tr key={a.id} style={{ borderBottom:`1px solid ${C.border2}` }}>
                <td style={{ padding:'11px 14px' }}>
                  <div style={{ fontWeight:700, color:C.text }}>{a.nome||'—'}</div>
                  <div style={{ fontSize:11, color:C.muted }}>{a.email}</div>
                </td>
                <td style={{ padding:'11px 14px' }}>
                  <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:5,
                    background:'rgba(255,255,255,.06)', color:a.papel==='admin'?C.amber:C.green, textTransform:'uppercase' }}>
                    {a.papel}
                  </span>
                </td>
                <td style={{ padding:'11px 14px', color:a.empresa_id?C.text:C.red, fontSize:12 }}>
                  {a.empresa_id?empresas.find(e=>e.id===a.empresa_id)?.nome||'—':'⚠ Sem empresa'}
                </td>
                <td style={{ padding:'11px 14px', fontFamily:'monospace', color:'#a855f7', fontSize:12 }}>{a.codigo_acesso||'—'}</td>
                <td style={{ padding:'11px 14px' }}>
                  {a.primeiro_acesso===true
                    ? <span style={{ fontSize:10, background:'rgba(245,158,11,.15)', color:C.amber, padding:'2px 7px', borderRadius:5, fontWeight:700 }}>1º acesso</span>
                    : <span style={{ fontSize:11, color:C.green }}>✓ Ativo</span>}
                </td>
                <td style={{ padding:'11px 14px' }}>
                  <Btn sm variant='ghost' onClick={()=>setEditando({...a})}>Editar</Btn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editando&&(
        <Modal title="Editar usuário" onClose={()=>setEditando(null)} maxWidth={420}>
          <Fld label="Nome"><DI value={editando.nome||''} onChange={v=>setEditando(m=>({...m,nome:v}))}/></Fld>
          <Fld label="Código de acesso"><DI value={editando.codigo_acesso||''} onChange={v=>setEditando(m=>({...m,codigo_acesso:v.toUpperCase()}))}/></Fld>
          <Fld label="Empresa">
            <DS value={editando.empresa_id||''} onChange={v=>setEditando(m=>({...m,empresa_id:v}))}>
              <option value="">Sem empresa</option>
              {empresas.map(e=><option key={e.id} value={e.id}>{e.nome}</option>)}
            </DS>
          </Fld>
          <Btn onClick={salvar} disabled={salvando} style={{ width:'100%' }}>{salvando?'Salvando...':'Salvar'}</Btn>
        </Modal>
      )}
    </div>
  )
}

// ── AdminCodigoEditor ────────────────────────────────────
function AdminCodigoEditor({ empresaId, onToast }) {
  const [admins, setAdmins] = useState([])
  const [editando, setEditando] = useState({})
  const [salvando, setSalvando] = useState({})
  const [showCriar, setShowCriar] = useState(false)
  const [novoAdmin, setNovoAdmin] = useState({ nome:'', email:'', codigo:'', senha:'mudar123' })
  const [criando, setCriando] = useState(false)

  const carregar = async () => {
    const { data } = await supabase.from('perfis').select('id,nome,papel,codigo_acesso,email').eq('empresa_id',empresaId).in('papel',['admin','equipe'])
    setAdmins(data||[])
  }
  useEffect(()=>{ carregar() },[empresaId])

  const salvar = async (user) => {
    const novo = editando[user.id]
    if (!novo?.trim()) return
    setSalvando(s=>({...s,[user.id]:true}))
    const { error } = await supabase.from('perfis').update({ codigo_acesso:novo.toUpperCase().trim() }).eq('id',user.id)
    setSalvando(s=>({...s,[user.id]:false}))
    if (error) { onToast('Erro: '+error.message); return }
    onToast('Código atualizado!'); await carregar(); setEditando(e=>({...e,[user.id]:''}))
  }

  const criarAdmin = async () => {
    if (!novoAdmin.nome||!novoAdmin.email||!novoAdmin.codigo) { onToast('Preencha todos os campos.'); return }
    setCriando(true)
    const sess = (await supabase.auth.getSession()).data.session
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-actions`,{
      method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${sess?.access_token}`},
      body: JSON.stringify({ action:'create_user', email:novoAdmin.email, password:novoAdmin.senha,
        nome:novoAdmin.nome, papel:'admin', empresa_id:empresaId, codigo_acesso:novoAdmin.codigo.toUpperCase() }),
    })
    const json = await resp.json()
    setCriando(false)
    if (!resp.ok) { onToast('Erro: '+(json.error||'falha')); return }
    onToast('Admin criado!'); setShowCriar(false); setNovoAdmin({ nome:'', email:'', codigo:'', senha:'mudar123' }); await carregar()
  }

  return (
    <div>
      {admins.map(u=>(
        <div key={u.id} style={{ marginBottom:10 }}>
          <div style={{ fontSize:12, color:C.muted, marginBottom:4 }}>
            {u.nome||u.email} <span style={{ color:u.papel==='admin'?C.amber:C.green, fontWeight:700 }}>({u.papel})</span>
            {u.codigo_acesso&&<span style={{ marginLeft:8, color:'#a855f7' }}>Atual: <b>{u.codigo_acesso}</b></span>}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <input value={editando[u.id]??''} onChange={e=>setEditando(ev=>({...ev,[u.id]:e.target.value.toUpperCase()}))}
              placeholder="Novo código" style={{ flex:1, background:'rgba(255,255,255,.04)', border:`1px solid ${C.border}`, borderRadius:7, padding:'7px 10px', color:C.text, fontSize:12, outline:'none' }}/>
            <button onClick={()=>salvar(u)} disabled={salvando[u.id]} style={{ padding:'7px 12px', background:C.purple, border:'none', borderRadius:6, color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer' }}>
              {salvando[u.id]?'...':'Salvar'}
            </button>
          </div>
        </div>
      ))}
      {admins.length===0&&!showCriar&&<p style={{ fontSize:13, color:C.muted, margin:'0 0 10px' }}>Nenhum admin encontrado.</p>}
      {!showCriar
        ? <button onClick={()=>setShowCriar(true)} style={{ fontSize:12, color:'#a855f7', background:'none', border:`1px solid ${C.purple}`, borderRadius:6, padding:'5px 12px', cursor:'pointer', fontWeight:600 }}>
            + Criar admin
          </button>
        : <div style={{ background:'rgba(255,255,255,.03)', border:`1px solid ${C.border}`, borderRadius:10, padding:14, marginTop:8 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
              <input value={novoAdmin.nome} onChange={e=>setNovoAdmin(x=>({...x,nome:e.target.value}))} placeholder="Nome *"
                style={{ background:'rgba(255,255,255,.04)', border:`1px solid ${C.border}`, borderRadius:6, padding:'7px 10px', color:C.text, fontSize:12, outline:'none' }}/>
              <input value={novoAdmin.email} onChange={e=>setNovoAdmin(x=>({...x,email:e.target.value}))} placeholder="E-mail *" type="email"
                style={{ background:'rgba(255,255,255,.04)', border:`1px solid ${C.border}`, borderRadius:6, padding:'7px 10px', color:C.text, fontSize:12, outline:'none' }}/>
              <input value={novoAdmin.codigo} onChange={e=>setNovoAdmin(x=>({...x,codigo:e.target.value.toUpperCase()}))} placeholder="Código *"
                style={{ background:'rgba(255,255,255,.04)', border:`1px solid ${C.border}`, borderRadius:6, padding:'7px 10px', color:C.text, fontSize:12, outline:'none' }}/>
              <input value={novoAdmin.senha} onChange={e=>setNovoAdmin(x=>({...x,senha:e.target.value}))} placeholder="Senha"
                style={{ background:'rgba(255,255,255,.04)', border:`1px solid ${C.border}`, borderRadius:6, padding:'7px 10px', color:C.text, fontSize:12, outline:'none' }}/>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={criarAdmin} disabled={criando} style={{ padding:'7px 14px', background:C.purple, border:'none', borderRadius:6, color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                {criando?'Criando...':'Criar admin'}
              </button>
              <button onClick={()=>setShowCriar(false)} style={{ padding:'7px 10px', background:'none', border:`1px solid ${C.border}`, borderRadius:6, color:C.muted, fontSize:12, cursor:'pointer' }}>Cancelar</button>
            </div>
          </div>
      }
    </div>
  )
}

// ── EmpresaPanel ──────────────────────────────────────────
function EmpresaPanel({ empresa, planos, onBack, onToast }) {
  const [aba, setAba] = useState('condominios')
  const [condominios, setCondominios] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [chamados, setChamados] = useState([])
  const [loading, setLoading] = useState(true)
  const [novoCondNome, setNovoCondNome] = useState('')
  const [modalUsuario, setModalUsuario] = useState(null)
  const [modalCondo, setModalCondo] = useState(null)
  const PAPEIS = ['morador','conselheiro','equipe','admin']
  const PAPEL_LABEL = { morador:'Morador', conselheiro:'Conselheiro', equipe:'Síndico', admin:'Admin' }
  const PAPEL_COR_L = { admin:C.amber, equipe:C.green, conselheiro:'#a855f7', morador:C.muted }

  const carregar = async () => {
    setLoading(true)
    const [{ data:conds },{ data:users }] = await Promise.all([
      supabase.from('condominios').select('*').eq('empresa_id',empresa.id).order('nome'),
      supabase.from('perfis').select('id,nome,email,papel,codigo_acesso,primeiro_acesso,condominio_id,condominios(nome)').eq('empresa_id',empresa.id).order('criado_em',{ascending:false}),
    ])
    setCondominios(conds||[])
    setUsuarios(users||[])
    if (conds?.length) {
      const { data:chams } = await supabase.from('solicitacoes').select('id,categoria,status,criado_em,condominios(nome)').in('condominio_id',conds.map(c=>c.id)).order('criado_em',{ascending:false}).limit(100)
      setChamados(chams||[])
    }
    setLoading(false)
  }
  useEffect(()=>{ carregar() },[empresa.id])

  const adicionarCondo = async () => {
    if (!novoCondNome.trim()) return
    await supabase.from('condominios').insert({ nome:novoCondNome.trim(), empresa_id:empresa.id })
    setNovoCondNome(''); onToast('Condomínio adicionado.'); await carregar()
  }
  const excluirCondo = async (id) => {
    if (!window.confirm('Excluir condomínio?')) return
    await supabase.from('condominios').delete().eq('id',id)
    onToast('Excluído.'); await carregar()
  }

  const api = async (body) => {
    const sess = (await supabase.auth.getSession()).data.session
    const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-actions`,{
      method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${sess?.access_token}`},
      body: JSON.stringify(body),
    })
    const json = await r.json()
    if (!r.ok) throw new Error(json.error||'Erro')
    return json
  }

  const salvarUsuario = async () => {
    const { error } = await supabase.from('perfis').update({ nome:modalUsuario.nome, papel:modalUsuario.papel, codigo_acesso:modalUsuario.codigo_acesso?.toUpperCase() }).eq('id',modalUsuario.id)
    if (error) { onToast('Erro: '+error.message); return }
    onToast('Salvo.'); setModalUsuario(null); await carregar()
  }
  const resetarSenha = async () => {
    if (!modalUsuario?.novaSenha||modalUsuario.novaSenha.length<4) { onToast('Senha muito curta.'); return }
    try { await api({action:'reset_password',user_id:modalUsuario.id,new_password:modalUsuario.novaSenha}); onToast('Senha alterada.') }
    catch(e) { onToast('Erro: '+e.message) }
  }
  const excluirUsuario = async () => {
    if (!window.confirm('Excluir conta?')) return
    try { await api({action:'delete_user',user_id:modalUsuario.id}); onToast('Excluído.'); setModalUsuario(null); await carregar() }
    catch(e) { onToast('Erro: '+e.message) }
  }

  return (
    <div style={{ minHeight:'100vh', background:C.bg, color:C.text, fontFamily:'var(--font-body)' }}>
      <div style={{ background:C.sidebar, borderBottom:`1px solid ${C.border}`, padding:'0 28px',
        display:'flex', alignItems:'center', gap:14, height:52 }}>
        <button onClick={onBack} style={{ background:'rgba(255,255,255,.06)', border:`1px solid ${C.border}`, borderRadius:7, color:C.muted, padding:'5px 12px', fontSize:12, cursor:'pointer' }}>← Voltar</button>
        <span style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:15, color:'#fff' }}>{empresa.nome}</span>
        <Badge label={empresa.plano_nome} map={PLANO_COR}/>
        <Badge label={empresa.status} map={STATUS_COR}/>
        <div style={{ flex:1 }}/>
        <span style={{ fontSize:12, color:C.muted }}>{condominios.length} condomínio{condominios.length!==1?'s':''} · {usuarios.length} usuário{usuarios.length!==1?'s':''}</span>
      </div>
      <div style={{ maxWidth:1100, margin:'0 auto', padding:'24px 28px' }}>
        <div style={{ display:'flex', borderBottom:`1px solid ${C.border}`, marginBottom:24 }}>
          {[['condominios','🏢 Condomínios'],['chamados','📋 Chamados']].map(([id,label])=>(
            <button key={id} onClick={()=>setAba(id)} style={{ padding:'9px 18px', background:'none', border:'none', cursor:'pointer', fontSize:13, fontWeight:600, color:aba===id?'#fff':C.muted, borderBottom:aba===id?'2px solid #7c3aed':'2px solid transparent', marginBottom:-1 }}>{label}</button>
          ))}
        </div>
        {loading&&<div style={{ textAlign:'center', color:C.muted, padding:40 }}>Carregando...</div>}
        {!loading&&aba==='condominios'&&(
          <div>
            {(() => {
              const equipe = usuarios.filter(u=>['admin','equipe'].includes(u.papel)&&!u.condominio_id)
              if (!equipe.length) return null
              return (
                <div style={{ background:'rgba(167,139,250,.08)', border:`1px solid rgba(167,139,250,.2)`, borderRadius:12, padding:'14px 16px', marginBottom:12 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#a855f7', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>👥 Equipe da empresa</div>
                  {equipe.map(u=>(
                    <div key={u.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:`1px solid ${C.border2}` }}>
                      <div style={{ width:30, height:30, borderRadius:'50%', background:'rgba(167,139,250,.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#a855f7', flexShrink:0 }}>{(u.nome||'?')[0].toUpperCase()}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:C.text }}>{u.nome||'—'}</div>
                        <div style={{ fontSize:11, color:C.muted }}>{u.codigo_acesso?`Código: ${u.codigo_acesso}`:''}</div>
                      </div>
                      <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:4, background:'rgba(255,255,255,.06)', color:PAPEL_COR_L[u.papel]||C.muted, textTransform:'uppercase' }}>{u.papel}</span>
                    </div>
                  ))}
                </div>
              )
            })()}
            {condominios.map(c=>(
              <CondominioCard key={c.id} condo={c} usuarios={usuarios.filter(u=>u.condominio_id===c.id)} chamados={chamados.filter(ch=>ch.condominio_id===c.id)} condominios={condominios} empresa={empresa} onToast={onToast} onRefresh={carregar} onEditCondo={()=>setModalCondo({...c})} onDeleteCondo={()=>excluirCondo(c.id)} onSaveCondo={async(nome)=>{ await supabase.from('condominios').update({nome}).eq('id',c.id); onToast('Salvo.'); await carregar() }}/>
            ))}
            <div style={{ display:'flex', gap:10, marginTop:16 }}>
              <DI value={novoCondNome} onChange={setNovoCondNome} placeholder="Nome do novo condomínio" style={{ flex:1 }}/>
              <Btn onClick={adicionarCondo}>+ Adicionar</Btn>
            </div>
          </div>
        )}
        {!loading&&aba==='chamados'&&(
          <div>
            {chamados.length===0?<div style={{ textAlign:'center', color:C.muted, padding:32 }}>Nenhum chamado.</div>
              :chamados.map(s=>(
                <div key={s.id} style={{ background:C.surface, border:`1px solid ${C.border2}`, borderRadius:9, padding:'11px 14px', marginBottom:8, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:600, color:C.text }}>{s.categoria}</div>
                    <div style={{ fontSize:12, color:C.muted }}>{s.condominios?.nome} · {new Date(s.criado_em).toLocaleDateString('pt-BR')}</div>
                  </div>
                  <span style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:5, background:'rgba(255,255,255,.06)', color:s.status==='concluido'?C.green:s.status==='andamento'?C.blue:C.amber }}>{s.status}</span>
                </div>
              ))
            }
          </div>
        )}
      </div>
      {modalUsuario&&(
        <Modal title="Editar usuário" onClose={()=>setModalUsuario(null)} maxWidth={420}>
          <Fld label="Nome"><DI value={modalUsuario.nome||''} onChange={v=>setModalUsuario(m=>({...m,nome:v}))}/></Fld>
          <G2>
            <Fld label="Código"><DI value={modalUsuario.codigo_acesso||''} onChange={v=>setModalUsuario(m=>({...m,codigo_acesso:v.toUpperCase()}))}/></Fld>
            <Fld label="Papel">
              <DS value={modalUsuario.papel} onChange={v=>setModalUsuario(m=>({...m,papel:v}))}>
                {PAPEIS.map(p=><option key={p} value={p}>{PAPEL_LABEL[p]}</option>)}
              </DS>
            </Fld>
          </G2>
          <Btn onClick={salvarUsuario} style={{ width:'100%', marginBottom:14 }}>Salvar dados</Btn>
          <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:14 }}>
            <div style={{ display:'flex', gap:8 }}>
              <DI value={modalUsuario.novaSenha||''} onChange={v=>setModalUsuario(m=>({...m,novaSenha:v}))} placeholder="Nova senha"/>
              <Btn sm onClick={resetarSenha}>Resetar</Btn>
            </div>
          </div>
          <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:14, marginTop:14 }}>
            <Btn variant='danger' onClick={excluirUsuario} style={{ width:'100%' }}>Excluir conta</Btn>
          </div>
        </Modal>
      )}
      {modalCondo&&(
        <Modal title={`Editar: ${modalCondo.nome}`} onClose={()=>setModalCondo(null)} maxWidth={560}>
          {[
            [['Nome','nome'],['CNPJ','cnpj']],
            [['Síndico','sindico_nome'],['Telefone síndico','sindico_telefone']],
            [['Administradora','administradora_nome'],['Contato adm.','administradora_contato']],
            [['Portaria/Zelador','portaria_nome'],['Tel. portaria','portaria_telefone']],
            [['Cidade','endereco_cidade'],['UF','endereco_uf']],
            [['Observações','obs']],
          ].map((row,ri)=>(
            <div key={ri} style={{ display:'grid', gridTemplateColumns:`repeat(${row.length},1fr)`, gap:10, marginBottom:10 }}>
              {row.map(([label,key])=>(
                <Fld key={key} label={label} style={{ margin:0 }}>
                  <DI value={modalCondo[key]||''} onChange={v=>setModalCondo(m=>({...m,[key]:v}))} style={{ fontSize:13 }}/>
                </Fld>
              ))}
            </div>
          ))}
          <Btn onClick={async()=>{ await supabase.from('condominios').update(modalCondo).eq('id',modalCondo.id); onToast('Salvo.'); setModalCondo(null); await carregar() }} style={{ width:'100%' }}>Salvar</Btn>
        </Modal>
      )}
    </div>
  )
}

// ── CondominioCard ────────────────────────────────────────
function CondominioCard({ condo, usuarios, chamados, condominios, empresa, onToast, onRefresh, onEditCondo, onDeleteCondo, onSaveCondo }) {
  const [expandido, setExpandido] = useState(false)
  const [modalUsuario, setModalUsuario] = useState(null)
  const [modalNovaConta, setModalNovaConta] = useState(false)
  const [novaConta, setNovaConta] = useState({ nome:'', email:'', codigo:'', senha:'mudar123', papel:'morador' })
  const [salvando, setSalvando] = useState(false)
  const [nomeEdit, setNomeEdit] = useState(condo.nome)
  const PAPEIS = ['morador','conselheiro','equipe','admin']
  const PAPEL_LABEL = { morador:'Morador', conselheiro:'Conselheiro', equipe:'Síndico', admin:'Admin' }

  const api = async (body) => {
    const sess = (await supabase.auth.getSession()).data.session
    const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-actions`,{
      method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${sess?.access_token}`},
      body: JSON.stringify(body),
    })
    const json = await r.json()
    if (!r.ok) throw new Error(json.error||'Erro')
    return json
  }

  const criarConta = async () => {
    if (!novaConta.nome||!novaConta.email||!novaConta.codigo) { onToast('Preencha nome, e-mail e código.'); return }
    setSalvando(true)
    try {
      await api({ action:'create_user', email:novaConta.email, password:novaConta.senha, nome:novaConta.nome, papel:novaConta.papel, empresa_id:empresa.id, codigo_acesso:novaConta.codigo.toUpperCase(), condominio_id:condo.id })
      onToast('Usuário criado!'); setModalNovaConta(false); setNovaConta({ nome:'', email:'', codigo:'', senha:'mudar123', papel:'morador' }); onRefresh()
    } catch(e) { onToast('Erro: '+e.message) }
    setSalvando(false)
  }

  const salvarUsuario = async () => {
    const { error } = await supabase.from('perfis').update({ nome:modalUsuario.nome, papel:modalUsuario.papel, codigo_acesso:modalUsuario.codigo_acesso?.toUpperCase() }).eq('id',modalUsuario.id)
    if (error) { onToast('Erro: '+error.message); return }
    onToast('Salvo.'); setModalUsuario(null); onRefresh()
  }

  return (
    <>
      <div style={{ background:C.surface, border:`1px solid ${expandido?C.purple:C.border}`, borderRadius:12, marginBottom:10, overflow:'hidden', transition:'border-color .15s' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', flexWrap:'wrap' }}>
          <div style={{ width:36, height:36, borderRadius:8, background:'rgba(88,166,255,.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:800, color:C.blue, flexShrink:0 }}>{condo.nome[0]}</div>
          <input value={nomeEdit} onChange={e=>setNomeEdit(e.target.value)} style={{ flex:1, background:'transparent', border:'none', color:C.text, fontSize:15, fontWeight:600, outline:'none', minWidth:120 }}/>
          <span style={{ fontSize:12, color:C.muted, whiteSpace:'nowrap' }}>{usuarios.length} usuários · {chamados.length} chamados</span>
          <div style={{ display:'flex', gap:6 }}>
            <Btn sm onClick={()=>onSaveCondo(nomeEdit)}>Salvar</Btn>
            <Btn sm variant='ghost' onClick={onEditCondo}>✏️ Dados</Btn>
            <Btn sm variant='ghost' onClick={()=>setExpandido(!expandido)} style={{ color:expandido?'#a855f7':C.muted }}>{expandido?'▲':'▼ Usuários'}</Btn>
            <Btn sm variant='danger' onClick={onDeleteCondo}>Excluir</Btn>
          </div>
        </div>
        {expandido&&(
          <div style={{ borderTop:`1px solid ${C.border}`, padding:'16px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <span style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'.05em' }}>Usuários</span>
              <Btn sm onClick={()=>setModalNovaConta(true)}>+ Novo usuário</Btn>
            </div>
            {usuarios.length===0&&<div style={{ textAlign:'center', color:C.muted, padding:'12px 0', fontSize:13 }}>Nenhum usuário.</div>}
            {['admin','equipe','conselheiro','morador'].map(papel=>{
              const grupo = usuarios.filter(u=>u.papel===papel)
              if (!grupo.length) return null
              return (
                <div key={papel} style={{ marginBottom:10 }}>
                  <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:4, background:'rgba(255,255,255,.06)', color:C.muted, textTransform:'uppercase', letterSpacing:'.04em', display:'inline-block', marginBottom:6 }}>
                    {PAPEL_LABEL[papel]}
                  </span>
                  {grupo.map(u=>(
                    <div key={u.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:`1px solid ${C.border2}` }}>
                      <div style={{ width:30, height:30, borderRadius:'50%', background:'rgba(255,255,255,.06)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:C.muted, flexShrink:0 }}>{(u.nome||'?')[0].toUpperCase()}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:C.text }}>{u.nome||'—'}</div>
                        <div style={{ fontSize:11, color:C.muted }}>{u.codigo_acesso?`Cod: ${u.codigo_acesso}`:''}</div>
                      </div>
                      <Btn sm variant='ghost' onClick={()=>setModalUsuario({...u,novaSenha:''})}>Editar</Btn>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </div>
      {modalUsuario&&(
        <Modal title="Editar usuário" onClose={()=>setModalUsuario(null)} maxWidth={420}>
          <Fld label="Nome"><DI value={modalUsuario.nome||''} onChange={v=>setModalUsuario(m=>({...m,nome:v}))}/></Fld>
          <G2>
            <Fld label="Código"><DI value={modalUsuario.codigo_acesso||''} onChange={v=>setModalUsuario(m=>({...m,codigo_acesso:v.toUpperCase()}))}/></Fld>
            <Fld label="Papel"><DS value={modalUsuario.papel} onChange={v=>setModalUsuario(m=>({...m,papel:v}))}>{PAPEIS.map(p=><option key={p} value={p}>{PAPEL_LABEL[p]}</option>)}</DS></Fld>
          </G2>
          <Btn onClick={salvarUsuario} style={{ width:'100%' }}>Salvar</Btn>
        </Modal>
      )}
      {modalNovaConta&&(
        <Modal title={`Novo usuário — ${condo.nome}`} onClose={()=>setModalNovaConta(false)} maxWidth={420}>
          <Fld label="Nome *"><DI value={novaConta.nome} onChange={v=>setNovaConta(x=>({...x,nome:v}))}/></Fld>
          <Fld label="E-mail *"><DI value={novaConta.email} onChange={v=>setNovaConta(x=>({...x,email:v}))} type="email"/></Fld>
          <G2>
            <Fld label="Código *"><DI value={novaConta.codigo} onChange={v=>setNovaConta(x=>({...x,codigo:v.toUpperCase()}))} placeholder="Ex.: JDC101"/></Fld>
            <Fld label="Senha"><DI value={novaConta.senha} onChange={v=>setNovaConta(x=>({...x,senha:v}))}/></Fld>
          </G2>
          <Fld label="Papel"><DS value={novaConta.papel} onChange={v=>setNovaConta(x=>({...x,papel:v}))}>{['morador','conselheiro'].map(p=><option key={p} value={p}>{PAPEL_LABEL[p]}</option>)}</DS></Fld>
          <Btn onClick={criarConta} disabled={salvando} style={{ width:'100%' }}>{salvando?'Criando...':'Criar usuário'}</Btn>
        </Modal>
      )}
    </>
  )
}
