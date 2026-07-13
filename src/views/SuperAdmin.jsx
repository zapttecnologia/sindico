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
    plano_nome:'trial', plano_vencimento:'', obs:'', admin_nome:'', admin_email:'', admin_senha:'mudar123', admin_codigo:'' }
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
    if (!nova.nome || !nova.admin_email || !nova.admin_nome || !nova.admin_codigo) { onToast('Preencha todos os campos obrigatórios incluindo o código de acesso.'); return }
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
          codigo_acesso: nova.admin_codigo.toUpperCase() }),
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

  const alertas = empresas.filter(e => {
    if (e.status === 'inadimplente') return true
    if (e.plano_vencimento) {
      const dias = Math.ceil((new Date(e.plano_vencimento) - new Date()) / 86400000)
      if (dias <= 15 && dias >= 0) return true
    }
    return false
  })

  return (
    <div style={{ minHeight:'100vh', background:'#0a0d14', color:C.text, fontFamily:'var(--font-body)' }}>

      {/* ── TOPBAR ERP ── */}
      <div style={{ background:'linear-gradient(90deg,#13111a 0%,#1a1035 100%)',
        borderBottom:'1px solid rgba(124,58,237,.25)', padding:'0 28px',
        display:'flex', alignItems:'center', gap:16, height:56, position:'sticky', top:0, zIndex:50 }}>

        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:9, background:'linear-gradient(135deg,#7c3aed,#a855f7)',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M4 21V8L12 3l8 5v13"/><path d="M9 21v-6h6v6"/>
            </svg>
          </div>
          <div>
            <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:14, color:'#fff', lineHeight:1 }}>
              Portal de Chamados
            </div>
            <div style={{ fontSize:9, color:'#a855f7', fontWeight:700, letterSpacing:'.12em', textTransform:'uppercase' }}>
              Central de Administração
            </div>
          </div>
        </div>

        <div style={{ width:1, height:28, background:'rgba(255,255,255,.1)', margin:'0 4px' }}/>

        {/* Nav tabs integrada */}
        <nav style={{ display:'flex', gap:2, flex:1 }}>
          {[
            { id:'empresas', label:'Clientes', icon:'🏢' },
            { id:'admins',   label:'Usuários', icon:'👤' },
            { id:'planos',   label:'Planos',   icon:'💳' },
          ].map(t => (
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              padding:'6px 14px', borderRadius:7, border:'none', cursor:'pointer', fontSize:13, fontWeight:600,
              background: tab===t.id ? 'rgba(124,58,237,.3)' : 'transparent',
              color: tab===t.id ? '#c084fc' : 'rgba(255,255,255,.5)',
              transition:'all .15s',
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </nav>

        {/* Info + sair */}
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          {alertas.length > 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 10px',
              background:'rgba(248,81,73,.15)', border:'1px solid rgba(248,81,73,.3)',
              borderRadius:6, fontSize:12, color:'#f85149', fontWeight:600 }}>
              ⚠ {alertas.length} alerta{alertas.length>1?'s':''}
            </div>
          )}
          <div style={{ fontSize:11, color:'rgba(255,255,255,.35)' }}>
            {new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'})}
          </div>
          <button onClick={logout} style={{ background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.12)',
            borderRadius:6, color:'rgba(255,255,255,.6)', padding:'5px 12px', fontSize:12, cursor:'pointer',
            fontWeight:600, display:'flex', alignItems:'center', gap:6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
              <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sair
          </button>
        </div>
      </div>

      <div style={{ padding:'24px 28px', maxWidth:1400, margin:'0 auto' }}>

        {/* ── ALERTAS ── */}
        {alertas.length > 0 && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:10, marginBottom:20 }}>
            {alertas.map(e => {
              const dias = e.plano_vencimento
                ? Math.ceil((new Date(e.plano_vencimento)-new Date())/86400000)
                : null
              return (
                <div key={e.id} style={{ background:'rgba(248,81,73,.08)', border:'1px solid rgba(248,81,73,.25)',
                  borderRadius:10, padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
                  <span style={{ fontSize:20, flexShrink:0 }}>{e.status==='inadimplente'?'💸':'⏰'}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:13, color:'#f85149', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      {e.nome}
                    </div>
                    <div style={{ fontSize:11, color:'rgba(255,255,255,.4)', marginTop:2 }}>
                      {e.status==='inadimplente' ? 'Status: Inadimplente' : `Vence em ${dias} dia${dias!==1?'s':''}`}
                    </div>
                  </div>
                  <Btn sm onClick={()=>setModalEditarEmpresa({...e})}>Ver</Btn>
                </div>
              )
            })}
          </div>
        )}

        {/* ── KPIs ── */}
        {metricas && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:12, marginBottom:24 }}>
            {[
              { l:'Clientes',     v:metricas.total,        c:'#e6edf3', ic:'🏢', bg:'rgba(255,255,255,.04)' },
              { l:'Ativos',       v:metricas.ativas,       c:'#3fb950', ic:'✅', bg:'rgba(63,185,80,.08)' },
              { l:'Trial',        v:metricas.trial,        c:'#f59e0b', ic:'🔔', bg:'rgba(245,158,11,.08)' },
              { l:'Inadimplentes',v:metricas.inadimplentes,c:'#f85149', ic:'⚠',  bg:'rgba(248,81,73,.08)' },
              { l:'Condomínios',  v:metricas.condominios,  c:'#58a6ff', ic:'🏘',  bg:'rgba(88,166,255,.08)' },
              { l:'Usuários',     v:metricas.usuarios,     c:'#a78bfa', ic:'👥', bg:'rgba(167,139,250,.08)' },
              { l:'Em aberto',    v:metricas.abertos,      c:'#f59e0b', ic:'📋', bg:'rgba(245,158,11,.08)' },
            ].map(k=>(
              <div key={k.l} style={{ background:k.bg, border:`1px solid rgba(255,255,255,.06)`,
                borderRadius:12, padding:'16px 18px', transition:'all .15s', cursor:'default' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                  <span style={{ fontSize:20 }}>{k.ic}</span>
                </div>
                <div style={{ fontFamily:'var(--font-display)', fontSize:30, fontWeight:800, color:k.c, lineHeight:1, marginBottom:4 }}>
                  {k.v}
                </div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,.35)', fontWeight:600, textTransform:'uppercase', letterSpacing:'.05em' }}>
                  {k.l}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── ABA CLIENTES ── */}
        {tab==='empresas' && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, gap:10, flexWrap:'wrap' }}>
              <div>
                <h2 style={{ margin:0, fontSize:18, fontWeight:700, color:'#e6edf3' }}>Clientes</h2>
                <p style={{ margin:'2px 0 0', fontSize:13, color:C.muted }}>{filtradas.length} empresa{filtradas.length!==1?'s':''} encontrada{filtradas.length!==1?'s':''}</p>
              </div>
              <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                <input placeholder="Buscar empresa..." value={busca} onChange={e=>setBusca(e.target.value)}
                  style={{ background:'rgba(255,255,255,.06)', border:`1px solid rgba(255,255,255,.1)`, borderRadius:8,
                    padding:'8px 14px', color:C.text, fontSize:13, width:220, outline:'none' }} />
                <Btn onClick={()=>setModalNova(true)}>+ Nova empresa</Btn>
              </div>
            </div>
            <div style={{ background:C.surface, border:`1px solid rgba(255,255,255,.06)`, borderRadius:12, overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ background:'rgba(255,255,255,.03)', borderBottom:`1px solid rgba(255,255,255,.06)` }}>
                    {['Empresa','Plano','Status','Condomínios','Usuários','Em aberto','Criada em','Ações'].map(h=>(
                      <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:700,
                        color:'rgba(255,255,255,.35)', textTransform:'uppercase', letterSpacing:'.05em', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtradas.length===0 && (
                    <tr><td colSpan={8} style={{ padding:40, textAlign:'center', color:C.muted }}>Nenhuma empresa encontrada.</td></tr>
                  )}
                  {filtradas.map((e,i)=>{
                    const venceEm = e.plano_vencimento
                      ? Math.ceil((new Date(e.plano_vencimento)-new Date())/86400000)
                      : null
                    return (
                      <tr key={e.id} style={{ borderBottom:`1px solid rgba(255,255,255,.04)`,
                        background: i%2===0 ? 'transparent' : 'rgba(255,255,255,.015)',
                        transition:'background .1s' }}
                        onMouseEnter={el=>el.currentTarget.style.background='rgba(124,58,237,.07)'}
                        onMouseLeave={el=>el.currentTarget.style.background=i%2===0?'transparent':'rgba(255,255,255,.015)'}>
                        <td style={{ padding:'13px 14px' }}>
                          <div style={{ fontWeight:700, color:'#e6edf3', fontSize:14 }}>{e.nome}</div>
                          <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{e.email_contato||'—'}</div>
                        </td>
                        <td style={{ padding:'13px 14px' }}><Badge label={e.plano_nome} map={PLANO_COR}/></td>
                        <td style={{ padding:'13px 14px' }}><Badge label={e.status} map={STATUS_COR}/></td>
                        <td style={{ padding:'13px 14px', textAlign:'center', color:C.blue, fontWeight:800, fontSize:16 }}>{e.total_condominios}</td>
                        <td style={{ padding:'13px 14px', textAlign:'center', color:C.violet, fontWeight:800, fontSize:16 }}>{e.total_usuarios}</td>
                        <td style={{ padding:'13px 14px', textAlign:'center', fontWeight:800, fontSize:16,
                          color:e.chamados_abertos>0?C.amber:C.muted }}>{e.chamados_abertos}</td>
                        <td style={{ padding:'13px 14px' }}>
                          <div style={{ fontSize:12, color:C.muted }}>{new Date(e.criado_em).toLocaleDateString('pt-BR')}</div>
                          {venceEm !== null && (
                            <div style={{ fontSize:11, marginTop:2, fontWeight:600,
                              color: venceEm<=0?C.red:venceEm<=15?C.amber:'rgba(255,255,255,.3)' }}>
                              {venceEm<=0?'Vencido':venceEm<=15?`⏰ ${venceEm}d`:``}
                            </div>
                          )}
                        </td>
                        <td style={{ padding:'13px 14px' }}>
                          <div style={{ display:'flex', gap:6 }}>
                            <Btn sm onClick={()=>setEmpresaSel(e)}>Gerenciar</Btn>
                            <Btn sm variant='ghost' onClick={()=>setModalEditarEmpresa({...e})}>Editar</Btn>
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

        {/* ── ABA ADMINS ── */}
        {tab==='admins' && (
          <PainelAdmins empresas={empresas} onToast={onToast} />
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
          <G2>
            <Fld label="Código de acesso *"><DI value={nova.admin_codigo} onChange={v=>setNova(x=>({...x,admin_codigo:v.toUpperCase()}))} placeholder="Ex.: SINDICO01"/></Fld>
            <Fld label="Senha inicial"><DI value={nova.admin_senha} onChange={v=>setNova(x=>({...x,admin_senha:v}))} /></Fld>
          </G2>
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
          <Btn onClick={salvarEmpresa} style={{ width:'100%' }}>Salvar dados da empresa</Btn>

          {/* Seção: alterar código de acesso do admin */}
          <div style={{ borderTop:`1px solid #30363d`, marginTop:20, paddingTop:20 }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:12 }}>
              Código de acesso do admin
            </div>
            <AdminCodigoEditor empresaId={modalEditarEmpresa.id} onToast={onToast} />
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Painel de gestão de admins ─────────────────────────────
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
    const { data } = await supabase.from('perfis')
      .select('id,nome,email,papel,codigo_acesso,empresa_id,primeiro_acesso')
      .in('papel', ['admin','equipe'])
      .order('criado_em', { ascending:false })
    setAdmins(data || [])
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  const adminsFiltrados = admins.filter(a => {
    if (busca && !a.nome?.toLowerCase().includes(busca.toLowerCase()) &&
        !a.email?.toLowerCase().includes(busca.toLowerCase()) &&
        !a.codigo_acesso?.toLowerCase().includes(busca.toLowerCase())) return false
    if (filtroEmpresa !== 'todas' && a.empresa_id !== filtroEmpresa) return false
    if (filtroPapel !== 'todos' && a.papel !== filtroPapel) return false
    return true
  })

  const salvar = async () => {
    if (!editando) return
    setSalvando(true)
    const { error } = await supabase.from('perfis').update({
      nome: editando.nome,
      codigo_acesso: editando.codigo_acesso?.toUpperCase(),
      empresa_id: editando.empresa_id || null,
    }).eq('id', editando.id)
    setSalvando(false)
    if (error) { onToast('Erro: '+error.message); return }
    onToast('Admin atualizado.')
    setEditando(null)
    await carregar()
  }

  const nomeEmpresa = (id) => empresas.find(e=>e.id===id)?.nome || '—'
  const PAPEL_COR = { admin:C.amber, equipe:C.green }

  return (
    <div>
      {/* Filtros */}
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <input placeholder="Buscar por nome, e-mail ou código..."
          value={busca} onChange={e=>setBusca(e.target.value)}
          style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8,
            padding:'8px 12px', color:C.text, fontSize:13, width:260, outline:'none' }} />
        <select value={filtroEmpresa} onChange={e=>setFiltroEmpresa(e.target.value)}
          style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8,
            padding:'8px 12px', color:C.text, fontSize:13, outline:'none' }}>
          <option value="todas">Todas as empresas</option>
          {empresas.map(e=><option key={e.id} value={e.id}>{e.nome}</option>)}
          <option value="">Sem empresa</option>
        </select>
        <select value={filtroPapel} onChange={e=>setFiltroPapel(e.target.value)}
          style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8,
            padding:'8px 12px', color:C.text, fontSize:13, outline:'none' }}>
          <option value="todos">Todos os papéis</option>
          <option value="admin">Admin</option>
          <option value="equipe">Equipe / Síndico</option>
        </select>
        {(busca||filtroEmpresa!=='todas'||filtroPapel!=='todos') && (
          <button onClick={()=>{setBusca('');setFiltroEmpresa('todas');setFiltroPapel('todos')}}
            style={{ background:'none', border:`1px solid ${C.border}`, borderRadius:8,
              padding:'8px 12px', color:C.muted, fontSize:13, cursor:'pointer' }}>
            Limpar filtros
          </button>
        )}
      </div>

      <div style={{ marginBottom:12, fontSize:13, color:C.muted }}>
        {adminsFiltrados.length} de {admins.length} usuário{admins.length!==1?'s':''}
      </div>

      {loading && <div style={{ textAlign:'center', color:C.muted, padding:32 }}>Carregando...</div>}

      {!loading && (
        <div style={{ border:`1px solid ${C.border}`, borderRadius:10, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:C.surface, borderBottom:`1px solid ${C.border}` }}>
                {['Usuário','Papel','Empresa vinculada','Código','Status',''].map(h=>(
                  <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:11, fontWeight:700,
                    color:C.muted, textTransform:'uppercase', letterSpacing:'.04em', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {adminsFiltrados.map(a => (
                <tr key={a.id} style={{ borderBottom:`1px solid ${C.border2}` }}>
                  <td style={{ padding:'11px 12px' }}>
                    <div style={{ fontWeight:600, color:C.text }}>{a.nome||'—'}</div>
                    <div style={{ fontSize:11, color:C.muted }}>{a.email}</div>
                  </td>
                  <td style={{ padding:'11px 12px' }}>
                    <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:5,
                      background:'#21262d', color:PAPEL_COR[a.papel]||C.muted, textTransform:'uppercase' }}>
                      {a.papel}
                    </span>
                  </td>
                  <td style={{ padding:'11px 12px', color: a.empresa_id ? C.text : C.red }}>
                    {a.empresa_id ? nomeEmpresa(a.empresa_id) : '⚠ Sem empresa'}
                  </td>
                  <td style={{ padding:'11px 12px', fontFamily:'monospace', color:C.violet, fontSize:12 }}>
                    {a.codigo_acesso || '—'}
                  </td>
                  <td style={{ padding:'11px 12px' }}>
                    {a.primeiro_acesso===true
                      ? <span style={{ fontSize:10, background:'#2d1a00', color:C.amber, padding:'2px 6px', borderRadius:4, fontWeight:700 }}>1º acesso</span>
                      : <span style={{ fontSize:10, color:C.green }}>✓ Ativo</span>}
                  </td>
                  <td style={{ padding:'11px 12px' }}>
                    <Btn sm variant='ghost' onClick={()=>setEditando({...a})}>Editar</Btn>
                  </td>
                </tr>
              ))}
              {adminsFiltrados.length === 0 && (
                <tr><td colSpan={6} style={{ padding:32, textAlign:'center', color:C.muted }}>
                  Nenhum usuário encontrado com esses filtros.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal editar admin */}
      {editando && (
        <Modal title="Editar admin / síndico" onClose={()=>setEditando(null)} maxWidth={440}>
          <Fld label="Nome">
            <DI value={editando.nome||''} onChange={v=>setEditando(m=>({...m,nome:v}))} />
          </Fld>
          <Fld label="Código de acesso">
            <DI value={editando.codigo_acesso||''} onChange={v=>setEditando(m=>({...m,codigo_acesso:v.toUpperCase()}))} />
          </Fld>
          <Fld label="Empresa vinculada">
            <DS value={editando.empresa_id||''} onChange={v=>setEditando(m=>({...m,empresa_id:v}))}>
              <option value="">Sem empresa</option>
              {empresas.map(e=><option key={e.id} value={e.id}>{e.nome}</option>)}
            </DS>
          </Fld>
          <div style={{ padding:'10px 12px', background:'#1a1f2e', borderRadius:'var(--r-md)',
            fontSize:12, color:C.muted, marginBottom:16 }}>
            Ao vincular a uma empresa, este usuário verá <b style={{color:C.text}}>apenas</b> os condominios e chamados dessa empresa.
          </div>
          <Btn onClick={salvar} disabled={salvando} style={{ width:'100%' }}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </Btn>
        </Modal>
      )}
    </div>
  )
}

// ── Editor de código do admin da empresa ───────────────────
function AdminCodigoEditor({ empresaId, onToast }) {
  const [admins, setAdmins] = useState([])
  const [editando, setEditando] = useState({})
  const [salvando, setSalvando] = useState({})
  const [showCriar, setShowCriar] = useState(false)
  const [novoAdmin, setNovoAdmin] = useState({ nome:'', email:'', codigo:'', senha:'mudar123' })
  const [criando, setCriando] = useState(false)

  const carregar = async () => {
    const { data } = await supabase.from('perfis')
      .select('id,nome,papel,codigo_acesso,email')
      .eq('empresa_id', empresaId)
      .in('papel', ['admin','equipe'])
    setAdmins(data || [])
  }

  useEffect(() => { carregar() }, [empresaId])

  const salvar = async (user) => {
    const novo = editando[user.id]
    if (!novo?.trim()) { onToast('Informe o código.'); return }
    setSalvando(s => ({...s, [user.id]:true}))
    const { error } = await supabase.from('perfis')
      .update({ codigo_acesso: novo.toUpperCase().trim() }).eq('id', user.id)
    setSalvando(s => ({...s, [user.id]:false}))
    if (error) { onToast('Erro: '+error.message); return }
    onToast('Código atualizado!')
    await carregar()
    setEditando(e => ({...e, [user.id]:''}))
  }

  const criarAdmin = async () => {
    if (!novoAdmin.nome||!novoAdmin.email||!novoAdmin.codigo) { onToast('Preencha todos os campos.'); return }
    setCriando(true)
    const sess = (await supabase.auth.getSession()).data.session
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-actions`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${sess?.access_token}` },
      body: JSON.stringify({ action:'create_user', email:novoAdmin.email, password:novoAdmin.senha,
        nome:novoAdmin.nome, papel:'admin', empresa_id:empresaId,
        codigo_acesso:novoAdmin.codigo.toUpperCase() }),
    })
    const json = await resp.json()
    setCriando(false)
    if (!resp.ok) { onToast('Erro: '+(json.error||'falha')); return }
    onToast('Admin criado! Código: '+novoAdmin.codigo.toUpperCase())
    setShowCriar(false)
    setNovoAdmin({ nome:'', email:'', codigo:'', senha:'mudar123' })
    await carregar()
  }

  return (
    <div>
      {admins.map(u => (
        <div key={u.id} style={{ marginBottom:12 }}>
          <div style={{ fontSize:12, color:C.muted, marginBottom:4 }}>
            {u.nome||u.email} <span style={{ color:u.papel==='admin'?C.amber:C.green, fontWeight:700 }}>({u.papel})</span>
            {u.codigo_acesso && <span style={{ marginLeft:8, color:C.violet }}>Atual: <b>{u.codigo_acesso}</b></span>}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <input value={editando[u.id]??''} onChange={e=>setEditando(ev=>({...ev,[u.id]:e.target.value.toUpperCase()}))}
              placeholder="Novo código de acesso"
              style={{ flex:1, background:'#0d1117', border:`1px solid ${C.border}`, borderRadius:7,
                padding:'8px 11px', color:C.text, fontSize:13, outline:'none' }} />
            <button onClick={()=>salvar(u)} disabled={salvando[u.id]}
              style={{ padding:'8px 14px', background:'#7c3aed', border:'none', borderRadius:7,
                color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer' }}>
              {salvando[u.id]?'...':'Salvar'}
            </button>
          </div>
        </div>
      ))}

      {admins.length === 0 && !showCriar && (
        <p style={{ fontSize:13, color:C.muted, margin:'0 0 10px' }}>Nenhum admin encontrado para esta empresa.</p>
      )}

      {!showCriar ? (
        <button onClick={()=>setShowCriar(true)}
          style={{ fontSize:12, color:C.violet, background:'none', border:`1px solid #7c3aed`,
            borderRadius:6, padding:'5px 12px', cursor:'pointer', fontWeight:600 }}>
          + Criar admin para esta empresa
        </button>
      ) : (
        <div style={{ background:'#0d1117', border:`1px solid ${C.border}`, borderRadius:10, padding:14, marginTop:8 }}>
          <div style={{ fontSize:11, color:C.violet, fontWeight:700, textTransform:'uppercase', marginBottom:10 }}>Novo admin</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
            <input value={novoAdmin.nome} onChange={e=>setNovoAdmin(x=>({...x,nome:e.target.value}))} placeholder="Nome *"
              style={{ background:'#161b22', border:`1px solid ${C.border}`, borderRadius:6, padding:'7px 10px', color:C.text, fontSize:13, outline:'none' }}/>
            <input value={novoAdmin.email} onChange={e=>setNovoAdmin(x=>({...x,email:e.target.value}))} placeholder="E-mail *" type="email"
              style={{ background:'#161b22', border:`1px solid ${C.border}`, borderRadius:6, padding:'7px 10px', color:C.text, fontSize:13, outline:'none' }}/>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
            <input value={novoAdmin.codigo} onChange={e=>setNovoAdmin(x=>({...x,codigo:e.target.value.toUpperCase()}))} placeholder="Código de acesso *"
              style={{ background:'#161b22', border:`1px solid ${C.border}`, borderRadius:6, padding:'7px 10px', color:C.text, fontSize:13, outline:'none' }}/>
            <input value={novoAdmin.senha} onChange={e=>setNovoAdmin(x=>({...x,senha:e.target.value}))} placeholder="Senha inicial"
              style={{ background:'#161b22', border:`1px solid ${C.border}`, borderRadius:6, padding:'7px 10px', color:C.text, fontSize:13, outline:'none' }}/>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={criarAdmin} disabled={criando}
              style={{ padding:'7px 14px', background:'#7c3aed', border:'none', borderRadius:6, color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer' }}>
              {criando?'Criando...':'Criar admin'}
            </button>
            <button onClick={()=>setShowCriar(false)}
              style={{ padding:'7px 14px', background:'none', border:`1px solid ${C.border}`, borderRadius:6, color:C.muted, fontSize:12, cursor:'pointer' }}>
              Cancelar
            </button>
          </div>
        </div>
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
  const [modalUsuario, setModalUsuario] = useState(null)
  const [modalNovaConta, setModalNovaConta] = useState(false)
  const [modalCondo, setModalCondo] = useState(null)
  const [novaConta, setNovaConta] = useState({ nome:'', email:'', codigo:'', senha:'mudar123', papel:'morador', condominio_id:'' })
  const [salvando, setSalvando] = useState(false)

  const carregar = async () => {
    setLoading(true)
    const ids = condominios.map(c=>c.id)

    const [{ data:conds }, { data:users }] = await Promise.all([
      supabase.from('condominios').select('*').eq('empresa_id', empresa.id).order('nome'),
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
  const salvarCondoCompleto = async () => {
    if (!modalCondo) return
    const { error } = await supabase.from('condominios').update({
      nome:               modalCondo.nome,
      cnpj:               modalCondo.cnpj||null,
      total_unidades:     modalCondo.total_unidades ? Number(modalCondo.total_unidades) : null,
      ano_construcao:     modalCondo.ano_construcao ? Number(modalCondo.ano_construcao) : null,
      endereco_rua:       modalCondo.endereco_rua||null,
      endereco_numero:    modalCondo.endereco_numero||null,
      endereco_complemento: modalCondo.endereco_complemento||null,
      endereco_bairro:    modalCondo.endereco_bairro||null,
      endereco_cidade:    modalCondo.endereco_cidade||null,
      endereco_uf:        modalCondo.endereco_uf||null,
      endereco_cep:       modalCondo.endereco_cep||null,
      sindico_nome:       modalCondo.sindico_nome||null,
      sindico_telefone:   modalCondo.sindico_telefone||null,
      sindico_email:      modalCondo.sindico_email||null,
      mandato_inicio:     modalCondo.mandato_inicio||null,
      mandato_fim:        modalCondo.mandato_fim||null,
      administradora_nome:    modalCondo.administradora_nome||null,
      administradora_contato: modalCondo.administradora_contato||null,
      portaria_nome:      modalCondo.portaria_nome||null,
      portaria_telefone:  modalCondo.portaria_telefone||null,
      seguro_seguradora:  modalCondo.seguro_seguradora||null,
      seguro_apolice:     modalCondo.seguro_apolice||null,
      seguro_vencimento:  modalCondo.seguro_vencimento||null,
      gestao_inicio:      modalCondo.gestao_inicio||null,
      obs:                modalCondo.obs||null,
    }).eq('id', modalCondo.id)
    if (error) { onToast('Erro: '+error.message); return }
    onToast('Condomínio atualizado.'); setModalCondo(null); await carregar()
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
          {[['condominios','🏢 Condomínios'],['chamados','📋 Chamados']].map(([id,label])=>(
            <button key={id} onClick={()=>setAba(id)} style={{
              padding:'9px 18px', background:'none', border:'none', cursor:'pointer', fontSize:13, fontWeight:600,
              color:aba===id?'#fff':C.muted, borderBottom:aba===id?`2px solid ${C.purple}`:'2px solid transparent', marginBottom:-1 }}>
              {label}
            </button>
          ))}
        </div>

        {loading && <div style={{ textAlign:'center', color:C.muted, padding:40 }}>Carregando...</div>}

        {/* ── CONDOMÍNIOS + USUÁRIOS (aninhados) ── */}
        {!loading && aba==='condominios' && (
          <div>
            {/* Equipe da empresa (sem condomínio vinculado) */}
            {(() => {
              const equipe = usuarios.filter(u => ['admin','equipe'].includes(u.papel) && !u.condominio_id)
              if (!equipe.length) return null
              return (
                <div style={{ background:'#1a1f2e', border:`1px solid ${C.border}`, borderRadius:12, padding:'14px 16px', marginBottom:12 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:C.violet, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:12 }}>
                    👥 Equipe da empresa
                  </div>
                  {equipe.map(u => (
                    <div key={u.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:`1px solid ${C.border2}` }}>
                      <div style={{ width:32, height:32, borderRadius:'50%', background:'#1a3451',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:12, fontWeight:700, color:C.blue, flexShrink:0 }}>
                        {(u.nome||'?')[0].toUpperCase()}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:C.text }}>{u.nome||'—'}</div>
                        <div style={{ fontSize:11, color:C.muted }}>
                          {u.codigo_acesso ? `Código: ${u.codigo_acesso}` : ''}
                          {u.email ? ` · ${u.email}` : ''}
                        </div>
                      </div>
                      <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:5,
                        background:'#21262d', color: u.papel==='admin' ? C.amber : C.green, textTransform:'uppercase' }}>
                        {u.papel==='admin' ? 'Admin' : 'Síndico'}
                      </span>
                    </div>
                  ))}
                </div>
              )
            })()}

            {condominios.map(c => (
              <CondominioCard
                key={c.id}
                condo={c}
                usuarios={usuarios.filter(u => u.condominio_id === c.id)}
                chamados={chamados.filter(ch => ch.condominio_id === c.id)}
                condominios={condominios}
                empresa={empresa}
                onToast={onToast}
                onRefresh={carregar}
                onEditCondo={() => setModalCondo({...c})}
                onDeleteCondo={() => excluirCondo(c.id)}
                onSaveCondo={(nome) => salvarCondo(c.id, nome)}
              />
            ))}
            <div style={{ display:'flex', gap:10, marginTop:16 }}>
              <DI value={novoCondNome} onChange={setNovoCondNome} placeholder="Nome do novo condomínio" style={{ flex:1 }} />
              <Btn onClick={adicionarCondo}>+ Adicionar</Btn>
            </div>
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

      {/* Modal edição completa do condomínio */}
      {modalCondo && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:70,
          display:'flex', alignItems:'center', justifyContent:'center', padding:16, overflowY:'auto' }}>
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16,
            width:'100%', maxWidth:580, padding:'24px 22px', maxHeight:'92vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h3 style={{ margin:0, fontSize:17, fontWeight:700, color:C.text }}>📋 {modalCondo.nome}</h3>
              <button onClick={()=>setModalCondo(null)} style={{ background:'none', border:'none', color:C.muted, fontSize:22, cursor:'pointer' }}>✕</button>
            </div>

            {[
              { title:'Dados gerais', fields:[
                [['Nome','nome'],['CNPJ','cnpj']],
                [['Total de unidades','total_unidades','number'],['Ano de construção','ano_construcao','number']],
              ]},
              { title:'Endereço', fields:[
                [['Rua / Avenida','endereco_rua'],['Número','endereco_numero']],
                [['Complemento','endereco_complemento'],['Bairro','endereco_bairro']],
                [['Cidade','endereco_cidade'],['UF (2 letras)','endereco_uf'],['CEP','endereco_cep']],
              ]},
              { title:'Síndico responsável', fields:[
                [['Nome','sindico_nome'],['Telefone / WhatsApp','sindico_telefone']],
                [['E-mail','sindico_email'],['Início mandato','mandato_inicio','date'],['Fim mandato','mandato_fim','date']],
              ]},
              { title:'Administradora', fields:[
                [['Nome','administradora_nome'],['Contato','administradora_contato']],
              ]},
              { title:'Portaria / Zelador', fields:[
                [['Nome','portaria_nome'],['Telefone','portaria_telefone']],
              ]},
              { title:'Seguro', fields:[
                [['Seguradora','seguro_seguradora'],['Nº Apólice','seguro_apolice']],
                [['Vencimento','seguro_vencimento','date']],
              ]},
              { title:'Gestão', fields:[
                [['Início da gestão','gestao_inicio','date'],['Observações','obs']],
              ]},
            ].map(sec => (
              <div key={sec.title} style={{ marginBottom:16 }}>
                <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase',
                  letterSpacing:'.05em', marginBottom:10, paddingBottom:6, borderBottom:`1px solid ${C.border}` }}>
                  {sec.title}
                </div>
                {sec.fields.map((row, ri) => (
                  <div key={ri} style={{ display:'grid', gridTemplateColumns:`repeat(${row.length}, 1fr)`, gap:10, marginBottom:10 }}>
                    {row.map(([label, key, type='text']) => (
                      <div key={key}>
                        <Lbl>{label}</Lbl>
                        <DI
                          value={modalCondo[key]||''}
                          onChange={v=>setModalCondo(m=>({...m,[key]: key==='endereco_uf'?v.toUpperCase().slice(0,2):v}))}
                          type={type}
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}

            <Btn onClick={salvarCondoCompleto} style={{ width:'100%', marginTop:8 }}>
              Salvar todos os dados
            </Btn>
          </div>
        </div>
      )}

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

// ── Card de condomínio com usuários aninhados ───────────────
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
    const session = (await supabase.auth.getSession()).data.session
    const URL = import.meta.env.VITE_SUPABASE_URL
    const r = await fetch(`${URL}/functions/v1/admin-actions`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${session?.access_token}` },
      body: JSON.stringify(body),
    })
    const json = await r.json()
    if (!r.ok) throw new Error(json.error)
    return json
  }

  const criarConta = async () => {
    if (!novaConta.nome||!novaConta.email||!novaConta.codigo) { onToast('Preencha nome, e-mail e código.'); return }
    setSalvando(true)
    try {
      await api({
        action:'create_user', email:novaConta.email, password:novaConta.senha,
        nome:novaConta.nome, papel:novaConta.papel, empresa_id:empresa.id,
        codigo_acesso:novaConta.codigo.toUpperCase(),
        condominio_id: condo.id,
      })
      onToast('Usuário criado!'); setModalNovaConta(false)
      setNovaConta({ nome:'', email:'', codigo:'', senha:'mudar123', papel:'morador' })
      onRefresh()
    } catch(e) { onToast('Erro: '+e.message) }
    setSalvando(false)
  }

  const salvarUsuario = async () => {
    if (!modalUsuario) return
    const { error } = await supabase.from('perfis').update({
      nome:modalUsuario.nome, papel:modalUsuario.papel,
      codigo_acesso:modalUsuario.codigo_acesso?.toUpperCase(),
    }).eq('id', modalUsuario.id)
    if (error) { onToast('Erro: '+error.message); return }
    onToast('Salvo.'); setModalUsuario(null); onRefresh()
  }

  const resetarSenha = async () => {
    if (!modalUsuario?.novaSenha || modalUsuario.novaSenha.length<4) { onToast('Senha muito curta.'); return }
    try { await api({action:'reset_password', user_id:modalUsuario.id, new_password:modalUsuario.novaSenha}); onToast('Senha alterada.') }
    catch(e) { onToast('Erro: '+e.message) }
  }

  const excluirUsuario = async () => {
    if (!window.confirm('Excluir esta conta?')) return
    try { await api({action:'delete_user', user_id:modalUsuario.id}); onToast('Excluído.'); setModalUsuario(null); onRefresh() }
    catch(e) { onToast('Erro: '+e.message) }
  }

  return (
    <>
      <div style={{ background:C.surface, border:`1px solid ${expandido ? C.purple : C.border}`,
        borderRadius:12, marginBottom:10, overflow:'hidden', transition:'border-color .15s' }}>

        {/* Linha principal */}
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', flexWrap:'wrap' }}>
          <div style={{ width:36, height:36, borderRadius:8, background:'#1a3451',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:14, fontWeight:700, color:C.blue, flexShrink:0 }}>
            {condo.nome[0]}
          </div>
          <input value={nomeEdit} onChange={e=>setNomeEdit(e.target.value)}
            style={{ flex:1, background:'transparent', border:'none', color:C.text,
              fontSize:15, fontWeight:600, outline:'none', minWidth:120 }} />
          <span style={{ fontSize:12, color:C.muted, whiteSpace:'nowrap' }}>
            {usuarios.length} usuário{usuarios.length!==1?'s':''} · {chamados.length} chamado{chamados.length!==1?'s':''}
          </span>
          <div style={{ display:'flex', gap:6 }}>
            <Btn sm onClick={()=>onSaveCondo(nomeEdit)}>Salvar</Btn>
            <Btn sm variant='ghost' onClick={onEditCondo}>✏️ Dados</Btn>
            <Btn sm variant='ghost' onClick={()=>setExpandido(!expandido)}
              style={{ color: expandido ? C.violet : C.muted, borderColor: expandido ? C.purple : C.border }}>
              {expandido ? '▲ Fechar' : '▼ Usuários'}
            </Btn>
            <Btn sm variant='danger' onClick={onDeleteCondo}>Excluir</Btn>
          </div>
        </div>

        {/* Usuários aninhados */}
        {expandido && (
          <div style={{ borderTop:`1px solid ${C.border}`, padding:'16px 16px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <span style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'.05em' }}>
                Usuários de {condo.nome}
              </span>
              <Btn sm onClick={()=>setModalNovaConta(true)}>+ Novo usuário</Btn>
            </div>

            {usuarios.length === 0 && (
              <div style={{ textAlign:'center', color:C.muted, padding:'16px 0', fontSize:13 }}>
                Nenhum usuário neste condomínio.
              </div>
            )}

            {['admin','equipe','conselheiro','morador'].map(papel => {
              const grupo = usuarios.filter(u=>u.papel===papel)
              if (!grupo.length) return null
              return (
                <div key={papel} style={{ marginBottom:12 }}>
                  <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:4,
                    background:'#21262d', color:PAPEL_COR[papel]||C.muted, textTransform:'uppercase',
                    letterSpacing:'.04em', display:'inline-block', marginBottom:8 }}>
                    {PAPEL_LABEL[papel]}
                  </span>
                  {grupo.map(u=>(
                    <div key={u.id} style={{ display:'flex', alignItems:'center', gap:10,
                      padding:'9px 0', borderBottom:`1px solid ${C.border2}`, flexWrap:'wrap' }}>
                      <div style={{ width:32, height:32, borderRadius:'50%', background:'#1a3451',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:12, fontWeight:700, color:C.blue, flexShrink:0 }}>
                        {(u.nome||'?')[0].toUpperCase()}
                      </div>
                      <div style={{ flex:1, minWidth:100 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:C.text, display:'flex', gap:6, alignItems:'center' }}>
                          {u.nome||'—'}
                          {u.primeiro_acesso===true && (
                            <span style={{ fontSize:9, background:'#2d1a00', color:C.amber,
                              padding:'1px 5px', borderRadius:3, fontWeight:700 }}>1º acesso</span>
                          )}
                        </div>
                        <div style={{ fontSize:11, color:C.muted }}>
                          {u.codigo_acesso ? `Código: ${u.codigo_acesso}` : ''}
                        </div>
                      </div>
                      <Btn sm variant='ghost' onClick={()=>setModalUsuario({...u, novaSenha:''})}>Editar</Btn>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal editar usuário */}
      {modalUsuario && (
        <Modal title="Editar usuário" onClose={()=>setModalUsuario(null)} maxWidth={420}>
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
          <Btn onClick={salvarUsuario} style={{ width:'100%', marginBottom:14 }}>Salvar dados</Btn>
          <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:14 }}>
            <Lbl>Resetar senha</Lbl>
            <div style={{ display:'flex', gap:8, marginTop:6 }}>
              <DI value={modalUsuario.novaSenha||''} onChange={v=>setModalUsuario(m=>({...m,novaSenha:v}))} placeholder="Nova senha" />
              <Btn sm onClick={resetarSenha}>Resetar</Btn>
            </div>
          </div>
          <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:14, marginTop:14 }}>
            <Btn variant='danger' onClick={excluirUsuario} style={{ width:'100%' }}>Excluir conta</Btn>
          </div>
        </Modal>
      )}

      {/* Modal novo usuário */}
      {modalNovaConta && (
        <Modal title={`Novo usuário — ${condo.nome}`} onClose={()=>setModalNovaConta(false)} maxWidth={420}>
          <Fld label="Nome *"><DI value={novaConta.nome} onChange={v=>setNovaConta(x=>({...x,nome:v}))} /></Fld>
          <Fld label="E-mail *"><DI value={novaConta.email} onChange={v=>setNovaConta(x=>({...x,email:v}))} type="email"/></Fld>
          <G2>
            <Fld label="Código *"><DI value={novaConta.codigo} onChange={v=>setNovaConta(x=>({...x,codigo:v.toUpperCase()}))} placeholder="Ex.: JDC101"/></Fld>
            <Fld label="Senha"><DI value={novaConta.senha} onChange={v=>setNovaConta(x=>({...x,senha:v}))} /></Fld>
          </G2>
          <Fld label="Papel">
            <DS value={novaConta.papel} onChange={v=>setNovaConta(x=>({...x,papel:v}))}>
              {PAPEIS.map(p=><option key={p} value={p}>{PAPEL_LABEL[p]}</option>)}
            </DS>
          </Fld>
          <Btn onClick={criarConta} disabled={salvando} style={{ width:'100%' }}>
            {salvando?'Criando...':'Criar usuário'}
          </Btn>
        </Modal>
      )}
    </>
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
