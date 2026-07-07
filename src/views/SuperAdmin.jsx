import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { fmtDate } from '../lib/constants'

const STATUS_CORES = {
  ativa:        { bg:'#E2F5ED', color:'#27795E' },
  trial:        { bg:'#FFF3DC', color:'#8A5A00' },
  inadimplente: { bg:'#FDECEA', color:'#C0392B' },
  suspensa:     { bg:'#F1F0EE', color:'#6B6860' },
  cancelada:    { bg:'#F1F0EE', color:'#6B6860' },
}

const PLANO_CORES = {
  trial:        { bg:'#F1F0EE', color:'#6B6860' },
  basico:       { bg:'#E0EDFF', color:'#1A47A0' },
  profissional: { bg:'#EDE8F9', color:'#5B21B6' },
  enterprise:   { bg:'#FFF3DC', color:'#8A5A00' },
}

function Badge({ label, map }) {
  const c = map[label] || { bg:'var(--gray-100)', color:'var(--gray-600)' }
  return (
    <span style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.04em',
      padding:'3px 8px', borderRadius:6, background:c.bg, color:c.color }}>
      {label}
    </span>
  )
}

export default function SuperAdmin({ onToast }) {
  const { logout } = useAuth()
  const [tab, setTab] = useState('empresas')
  const [empresas, setEmpresas] = useState([])
  const [planos, setPlanos] = useState([])
  const [metricas, setMetricas] = useState(null)
  const [modalNova, setModalNova] = useState(false)
  const [modalEditar, setModalEditar] = useState(null)
  const [busca, setBusca] = useState('')
  const [salvando, setSalvando] = useState(false)

  // Form nova empresa
  const VAZIO_EMPRESA = { nome:'', cnpj:'', email_contato:'', telefone_contato:'',
    plano_nome:'trial', plano_vencimento:'', obs:'',
    admin_nome:'', admin_email:'', admin_senha:'mudar123' }
  const [nova, setNova] = useState(VAZIO_EMPRESA)

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
        totalCondominios: emp.reduce((s,e)=>s+(e.total_condominios||0),0),
        totalChamados: emp.reduce((s,e)=>s+(e.total_chamados||0),0),
        chamadosAbertos: emp.reduce((s,e)=>s+(e.chamados_abertos||0),0),
      })
    }
    if (pl) setPlanos(pl)
  }

  useEffect(() => { carregar() }, [])

  const criarEmpresa = async () => {
    if (!nova.nome || !nova.admin_email || !nova.admin_nome) {
      onToast('Preencha nome da empresa, nome e e-mail do admin.')
      return
    }
    setSalvando(true)
    try {
      // 1. Cria a empresa
      const planoEscolhido = planos.find(p=>p.nome===nova.plano_nome)
      const vencimento = nova.plano_nome === 'trial'
        ? new Date(Date.now() + 30*86400000).toISOString().split('T')[0]
        : nova.plano_vencimento || null

      const { data: empresa, error: errEmp } = await supabase
        .from('empresas').insert({
          nome: nova.nome, cnpj: nova.cnpj || null,
          email_contato: nova.email_contato || null,
          telefone_contato: nova.telefone_contato || null,
          plano_id: planoEscolhido?.id || null,
          plano_nome: nova.plano_nome,
          status: 'ativa',
          plano_vencimento: vencimento,
          obs: nova.obs || null,
        }).select().single()
      if (errEmp) throw new Error(errEmp.message)

      // 2. Cria o usuário admin via Edge Function
      const session = (await supabase.auth.getSession()).data.session
      const URL = import.meta.env.VITE_SUPABASE_URL
      const resp = await fetch(`${URL}/functions/v1/admin-actions`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${session?.access_token}` },
        body: JSON.stringify({
          action: 'create_user',
          email: nova.admin_email,
          password: nova.admin_senha,
          nome: nova.admin_nome,
          papel: 'admin',
          empresa_id: empresa.id,
          codigo_acesso: 'ADMIN' + empresa.id.slice(-4).toUpperCase(),
        }),
      })
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.error || 'Erro ao criar usuário')

      onToast(`✅ Empresa "${nova.nome}" criada com sucesso!`)
      setModalNova(false)
      setNova(VAZIO_EMPRESA)
      await carregar()
    } catch(e) {
      onToast('Erro: ' + e.message)
    }
    setSalvando(false)
  }

  const salvarEdicao = async () => {
    if (!modalEditar) return
    const { error } = await supabase.from('empresas').update({
      nome: modalEditar.nome,
      cnpj: modalEditar.cnpj,
      email_contato: modalEditar.email_contato,
      telefone_contato: modalEditar.telefone_contato,
      plano_nome: modalEditar.plano_nome,
      status: modalEditar.status,
      plano_vencimento: modalEditar.plano_vencimento || null,
      obs: modalEditar.obs,
    }).eq('id', modalEditar.id)
    if (error) { onToast('Erro: '+error.message); return }
    onToast('Empresa atualizada.')
    setModalEditar(null)
    await carregar()
  }

  const empresasFiltradas = empresas.filter(e =>
    !busca || e.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (e.email_contato||'').toLowerCase().includes(busca.toLowerCase())
  )

  const TABS = [
    { id:'empresas', label:'🏢 Clientes' },
    { id:'metricas', label:'📊 Métricas' },
    { id:'planos',   label:'💳 Planos' },
  ]

  return (
    <div style={{ minHeight:'100vh', background:'#0d1117', color:'#e6edf3',
      fontFamily:'var(--font-body)' }}>

      {/* Header */}
      <div style={{ background:'#13111a', borderBottom:'1px solid #2d2438',
        padding:'0 24px', display:'flex', alignItems:'center', gap:16, height:56 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:28, height:28, borderRadius:8, background:'#7c3aed',
            display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M4 21V8L12 3l8 5v13"/><path d="M9 21v-6h6v6"/>
            </svg>
          </div>
          <span style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:15, color:'#fff' }}>
            Central de Solicitações
          </span>
          <span style={{ fontSize:10, background:'#2d1a4e', color:'#a78bfa',
            padding:'2px 7px', borderRadius:4, fontWeight:700, letterSpacing:'.05em' }}>
            SUPER ADMIN
          </span>
        </div>
        <div style={{ flex:1 }}></div>
        <button onClick={logout} style={{ background:'none', border:'none', color:'rgba(255,255,255,.4)',
          fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sair
        </button>
      </div>

      <div style={{ maxWidth:1100, margin:'0 auto', padding:'28px 24px' }}>

        {/* KPIs rápidos */}
        {metricas && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))',
            gap:12, marginBottom:28 }}>
            {[
              { label:'Total de clientes', val:metricas.total, color:'#e6edf3' },
              { label:'Clientes ativos', val:metricas.ativas, color:'#3fb950' },
              { label:'Em trial', val:metricas.trial, color:'#f59e0b' },
              { label:'Inadimplentes', val:metricas.inadimplentes, color:'#f85149' },
              { label:'Condomínios', val:metricas.totalCondominios, color:'#58a6ff' },
              { label:'Chamados abertos', val:metricas.chamadosAbertos, color:'#a78bfa' },
            ].map(k => (
              <div key={k.label} style={{ background:'#161b22', border:'1px solid #30363d',
                borderRadius:10, padding:'14px 16px' }}>
                <div style={{ fontFamily:'var(--font-display)', fontSize:28, fontWeight:800,
                  color:k.color, lineHeight:1 }}>{k.val}</div>
                <div style={{ fontSize:11, color:'#8b949e', marginTop:4, fontWeight:600,
                  textTransform:'uppercase', letterSpacing:'.04em' }}>{k.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display:'flex', gap:0, borderBottom:'1px solid #30363d', marginBottom:24 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              padding:'10px 18px', background:'none', border:'none', cursor:'pointer',
              fontSize:13, fontWeight:600,
              color: tab===t.id ? '#fff' : '#8b949e',
              borderBottom: tab===t.id ? '2px solid #7c3aed' : '2px solid transparent',
              marginBottom:-1, transition:'color .15s',
            }}>{t.label}</button>
          ))}
        </div>

        {/* ── CLIENTES ── */}
        {tab==='empresas' && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10 }}>
              <input
                style={{ background:'#161b22', border:'1px solid #30363d', borderRadius:8,
                  padding:'8px 12px', color:'#e6edf3', fontSize:13, width:260, outline:'none' }}
                placeholder="Buscar empresa..."
                value={busca} onChange={e=>setBusca(e.target.value)}
              />
              <button onClick={()=>setModalNova(true)} style={{
                background:'#7c3aed', border:'none', borderRadius:8, padding:'9px 18px',
                color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                + Nova empresa
              </button>
            </div>

            <div style={{ border:'1px solid #30363d', borderRadius:10, overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ background:'#161b22', borderBottom:'1px solid #30363d' }}>
                    {['Empresa','Plano','Status','Condomínios','Chamados abertos','Criada em',''].map(h => (
                      <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11,
                        fontWeight:700, color:'#8b949e', textTransform:'uppercase', letterSpacing:'.04em',
                        whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {empresasFiltradas.length === 0 && (
                    <tr><td colSpan={7} style={{ padding:32, textAlign:'center', color:'#8b949e' }}>
                      Nenhuma empresa cadastrada ainda.
                    </td></tr>
                  )}
                  {empresasFiltradas.map(e => (
                    <tr key={e.id} style={{ borderBottom:'1px solid #21262d' }}>
                      <td style={{ padding:'12px 14px' }}>
                        <div style={{ fontWeight:600, color:'#e6edf3' }}>{e.nome}</div>
                        <div style={{ fontSize:11, color:'#8b949e', marginTop:2 }}>{e.email_contato || '—'}</div>
                      </td>
                      <td style={{ padding:'12px 14px' }}><Badge label={e.plano_nome} map={PLANO_CORES} /></td>
                      <td style={{ padding:'12px 14px' }}><Badge label={e.status} map={STATUS_CORES} /></td>
                      <td style={{ padding:'12px 14px', textAlign:'center', color:'#58a6ff', fontWeight:700 }}>
                        {e.total_condominios}
                      </td>
                      <td style={{ padding:'12px 14px', textAlign:'center',
                        color: e.chamados_abertos > 0 ? '#f59e0b' : '#8b949e', fontWeight:700 }}>
                        {e.chamados_abertos}
                      </td>
                      <td style={{ padding:'12px 14px', color:'#8b949e', fontSize:12 }}>
                        {new Date(e.criado_em).toLocaleDateString('pt-BR')}
                        {e.plano_vencimento && (
                          <div style={{ color: new Date(e.plano_vencimento) < new Date() ? '#f85149' : '#8b949e' }}>
                            vence {new Date(e.plano_vencimento).toLocaleDateString('pt-BR')}
                          </div>
                        )}
                      </td>
                      <td style={{ padding:'12px 14px' }}>
                        <button onClick={()=>setModalEditar({...e})} style={{
                          background:'#21262d', border:'1px solid #30363d', borderRadius:6,
                          color:'#e6edf3', padding:'5px 12px', fontSize:12, cursor:'pointer' }}>
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── MÉTRICAS ── */}
        {tab==='metricas' && (
          <div style={{ color:'#8b949e', textAlign:'center', padding:40 }}>
            <div style={{ fontSize:32, marginBottom:12 }}>📊</div>
            <p>Dashboard de métricas detalhadas em breve.</p>
            <p style={{ fontSize:13 }}>Use a aba Clientes para ver dados por empresa.</p>
          </div>
        )}

        {/* ── PLANOS ── */}
        {tab==='planos' && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:16 }}>
            {planos.map(p => (
              <div key={p.id} style={{ background:'#161b22', border:'1px solid #30363d',
                borderRadius:12, padding:'20px 18px' }}>
                <Badge label={p.nome} map={PLANO_CORES} />
                <div style={{ fontFamily:'var(--font-display)', fontSize:24, fontWeight:800,
                  color:'#e6edf3', margin:'12px 0 4px' }}>
                  {p.valor_mensal === 0 ? 'Grátis' : `R$ ${Number(p.valor_mensal).toLocaleString('pt-BR')}/mês`}
                </div>
                <div style={{ fontSize:13, color:'#e6edf3', fontWeight:600, marginBottom:8 }}>{p.nome_exibicao}</div>
                <div style={{ fontSize:12, color:'#8b949e', lineHeight:1.6 }}>
                  Até {p.max_condominios >= 999 ? '∞' : p.max_condominios} condomínios<br/>
                  Até {p.max_usuarios >= 9999 ? '∞' : p.max_usuarios} usuários<br/>
                  {p.descricao}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal nova empresa */}
      {modalNova && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, padding:16 }}>
          <div style={{ background:'#161b22', border:'1px solid #30363d', borderRadius:16,
            padding:'28px 24px', width:'100%', maxWidth:520, maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
              <h3 style={{ margin:0, fontSize:18, fontWeight:700, color:'#e6edf3' }}>Nova empresa cliente</h3>
              <button onClick={()=>setModalNova(false)} style={{ background:'none', border:'none',
                color:'#8b949e', fontSize:20, cursor:'pointer' }}>✕</button>
            </div>

            <Section label="Dados da empresa">
              <Field label="Nome da empresa *">
                <DarkInput value={nova.nome} onChange={v=>setNova(x=>({...x,nome:v}))} placeholder="Ex.: Síndico Prime Ltda" />
              </Field>
              <Row2>
                <Field label="CNPJ">
                  <DarkInput value={nova.cnpj} onChange={v=>setNova(x=>({...x,cnpj:v}))} placeholder="00.000.000/0001-00" />
                </Field>
                <Field label="Plano">
                  <DarkSelect value={nova.plano_nome} onChange={v=>setNova(x=>({...x,plano_nome:v}))}>
                    {planos.map(p=><option key={p.id} value={p.nome}>{p.nome_exibicao} — R$ {p.valor_mensal}/mês</option>)}
                  </DarkSelect>
                </Field>
              </Row2>
              <Row2>
                <Field label="E-mail de contato">
                  <DarkInput value={nova.email_contato} onChange={v=>setNova(x=>({...x,email_contato:v}))} type="email" />
                </Field>
                <Field label="Telefone">
                  <DarkInput value={nova.telefone_contato} onChange={v=>setNova(x=>({...x,telefone_contato:v}))} />
                </Field>
              </Row2>
              {nova.plano_nome !== 'trial' && (
                <Field label="Vencimento do plano">
                  <DarkInput value={nova.plano_vencimento} onChange={v=>setNova(x=>({...x,plano_vencimento:v}))} type="date" />
                </Field>
              )}
              <Field label="Observações">
                <DarkInput value={nova.obs} onChange={v=>setNova(x=>({...x,obs:v}))} placeholder="Anotações internas..." />
              </Field>
            </Section>

            <Section label="Usuário administrador da empresa">
              <Row2>
                <Field label="Nome *">
                  <DarkInput value={nova.admin_nome} onChange={v=>setNova(x=>({...x,admin_nome:v}))} />
                </Field>
                <Field label="E-mail *">
                  <DarkInput value={nova.admin_email} onChange={v=>setNova(x=>({...x,admin_email:v}))} type="email" />
                </Field>
              </Row2>
              <Field label="Senha inicial">
                <DarkInput value={nova.admin_senha} onChange={v=>setNova(x=>({...x,admin_senha:v}))} />
              </Field>
              <p style={{ fontSize:12, color:'#8b949e', margin:'4px 0 0' }}>
                O admin entrará com o e-mail + essa senha e será solicitado a criar uma senha pessoal no primeiro acesso.
              </p>
            </Section>

            <button onClick={criarEmpresa} disabled={salvando} style={{
              width:'100%', padding:'12px', background:'#7c3aed', border:'none',
              borderRadius:8, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer',
              opacity: salvando ? .6 : 1 }}>
              {salvando ? 'Criando...' : 'Criar empresa e usuário admin'}
            </button>
          </div>
        </div>
      )}

      {/* Modal editar empresa */}
      {modalEditar && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, padding:16 }}>
          <div style={{ background:'#161b22', border:'1px solid #30363d', borderRadius:16,
            padding:'28px 24px', width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
              <h3 style={{ margin:0, fontSize:18, fontWeight:700, color:'#e6edf3' }}>Editar empresa</h3>
              <button onClick={()=>setModalEditar(null)} style={{ background:'none', border:'none',
                color:'#8b949e', fontSize:20, cursor:'pointer' }}>✕</button>
            </div>
            <Field label="Nome"><DarkInput value={modalEditar.nome} onChange={v=>setModalEditar(m=>({...m,nome:v}))} /></Field>
            <Row2>
              <Field label="CNPJ"><DarkInput value={modalEditar.cnpj||''} onChange={v=>setModalEditar(m=>({...m,cnpj:v}))} /></Field>
              <Field label="Status">
                <DarkSelect value={modalEditar.status} onChange={v=>setModalEditar(m=>({...m,status:v}))}>
                  {['ativa','inadimplente','suspensa','cancelada'].map(s=><option key={s} value={s}>{s}</option>)}
                </DarkSelect>
              </Field>
            </Row2>
            <Row2>
              <Field label="Plano">
                <DarkSelect value={modalEditar.plano_nome} onChange={v=>setModalEditar(m=>({...m,plano_nome:v}))}>
                  {planos.map(p=><option key={p.id} value={p.nome}>{p.nome_exibicao}</option>)}
                </DarkSelect>
              </Field>
              <Field label="Vencimento">
                <DarkInput value={modalEditar.plano_vencimento||''} onChange={v=>setModalEditar(m=>({...m,plano_vencimento:v}))} type="date" />
              </Field>
            </Row2>
            <Row2>
              <Field label="E-mail"><DarkInput value={modalEditar.email_contato||''} onChange={v=>setModalEditar(m=>({...m,email_contato:v}))} type="email" /></Field>
              <Field label="Telefone"><DarkInput value={modalEditar.telefone_contato||''} onChange={v=>setModalEditar(m=>({...m,telefone_contato:v}))} /></Field>
            </Row2>
            <Field label="Observações"><DarkInput value={modalEditar.obs||''} onChange={v=>setModalEditar(m=>({...m,obs:v}))} /></Field>
            <button onClick={salvarEdicao} style={{ width:'100%', padding:'12px', background:'#7c3aed',
              border:'none', borderRadius:8, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', marginTop:8 }}>
              Salvar alterações
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Componentes auxiliares para o dark mode do super admin
function Section({ label, children }) {
  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ fontSize:11, fontWeight:700, color:'#8b949e', textTransform:'uppercase',
        letterSpacing:'.06em', marginBottom:12, paddingBottom:8, borderBottom:'1px solid #30363d' }}>
        {label}
      </div>
      {children}
    </div>
  )
}
function Field({ label, children }) {
  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#8b949e',
        marginBottom:5, textTransform:'uppercase', letterSpacing:'.04em' }}>{label}</label>
      {children}
    </div>
  )
}
function Row2({ children }) {
  return <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>{children}</div>
}
function DarkInput({ value, onChange, type='text', placeholder='' }) {
  return (
    <input type={type} value={value} placeholder={placeholder}
      onChange={e=>onChange(e.target.value)}
      style={{ width:'100%', background:'#0d1117', border:'1px solid #30363d', borderRadius:7,
        padding:'9px 11px', color:'#e6edf3', fontSize:13, outline:'none', boxSizing:'border-box' }}
    />
  )
}
function DarkSelect({ value, onChange, children }) {
  return (
    <select value={value} onChange={e=>onChange(e.target.value)}
      style={{ width:'100%', background:'#0d1117', border:'1px solid #30363d', borderRadius:7,
        padding:'9px 11px', color:'#e6edf3', fontSize:13, outline:'none', boxSizing:'border-box' }}>
      {children}
    </select>
  )
}
