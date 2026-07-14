import { useState } from 'react'
import { useAuth } from './context/AuthContext'
import Navigation from './components/Navigation'
import Login from './views/Login'
import AlterarSenha from './views/AlterarSenha'
import SuperAdmin from './views/SuperAdmin'
import Morador from './views/Morador'
import Equipe from './views/Equipe'
import Conselheiro from './views/Conselheiro'
import Admin from './views/Admin'
import Perfil from './views/Perfil'
import Relatorio from './views/Relatorio'
import Fornecedores from './views/Fornecedores'
import Departamento from './views/Departamento'
import { Toast, useToast } from './components/Toast'

function AppNormal() {
  const { perfil } = useAuth()
  const { msg, show, toast } = useToast()

  const defaultView = {
    morador:     'painel',
    conselheiro: 'painel',
    equipe:      'dashboard',
    admin:       'dashboard',
  }[perfil?.papel] || 'painel'

  const [activeView, setActiveView] = useState(defaultView)

  const renderView = () => {
    // Departamentos operacionais
    const DEPT = ['manutencao','limpeza','administradora','portaria','seguranca','zeladoria','terceiros']
    if (DEPT.includes(perfil?.papel)) return <Departamento onToast={toast} />

    if (perfil?.papel === 'morador') return <Morador view={activeView} onToast={toast} />
    if (perfil?.papel === 'conselheiro') return <Conselheiro view={activeView} onToast={toast} />
    if (perfil?.papel === 'equipe' || perfil?.papel === 'admin') {
      if (activeView === 'admin')     return <Admin onToast={toast} />
      if (activeView === 'perfil')    return <Perfil onToast={toast} />
      if (activeView === 'relatorio') return <Relatorio onToast={toast} />
      if (activeView === 'fornecedores') return <Fornecedores onToast={toast} />
      return <Equipe view={activeView} onToast={toast} />
    }
    return <div style={{ padding:40 }}>Papel nao reconhecido: {perfil?.papel}</div>
  }

  return (
    <div className="app-shell">
      <Navigation activeView={activeView} onNavigate={setActiveView} />
      <main className="main-content">{renderView()}</main>
      <Toast msg={msg} show={show} />
    </div>
  )
}

function AppSuperAdmin() {
  const { msg, show, toast } = useToast()
  return <><SuperAdmin onToast={toast} /><Toast msg={msg} show={show} /></>
}

function AcessoSuspenso() {
  const { logout, perfil } = useAuth()
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--navy)', padding:24 }}>
      <div style={{ maxWidth:460, width:'100%', background:'#fff', borderRadius:16, padding:'36px 32px', textAlign:'center', boxShadow:'0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ width:64, height:64, borderRadius:'50%', background:'#fef2f2', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', fontSize:30 }}>🔒</div>
        <h1 style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:800, color:'var(--navy)', margin:'0 0 10px' }}>Acesso temporariamente suspenso</h1>
        <p style={{ fontSize:14, color:'var(--gray-500)', lineHeight:1.6, margin:'0 0 8px' }}>
          O acesso deste condomínio está suspenso por pendência financeira. Assim que o pagamento for regularizado, o acesso é liberado automaticamente — <b>nenhum dado é perdido</b>.
        </p>
        <p style={{ fontSize:13, color:'var(--gray-400)', lineHeight:1.6, margin:'0 0 24px' }}>
          Fale com o responsável financeiro do seu condomínio ou com a administradora para regularizar.
        </p>
        <button onClick={logout}
          style={{ padding:'11px 22px', background:'var(--gray-100)', border:'none', borderRadius:10, fontSize:13, fontWeight:700, color:'var(--gray-600)', cursor:'pointer' }}>
          Sair
        </button>
      </div>
    </div>
  )
}

function AppContent() {
  const { perfil, isSuperAdmin, empresaStatus } = useAuth()
  if (isSuperAdmin) return <AppSuperAdmin />
  // Bloqueio por billing: empresa suspensa barra todos os papéis, exceto super admin.
  // Fail-open: só bloqueia com o status explicitamente 'suspensa'.
  if (empresaStatus === 'suspensa') return <AcessoSuspenso />
  if (perfil?.primeiro_acesso === true) return <AlterarSenha />
  return <AppNormal />
}

export default function App() {
  const { session, loading } = useAuth()
  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'var(--navy)', flexDirection:'column', gap:16 }}>
      <div style={{ width:48, height:48, borderRadius:14, background:'var(--emerald)', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8"><path d="M4 21V8L12 3l8 5v13"/><path d="M9 21v-6h6v6"/></svg>
      </div>
      <div style={{ fontFamily:'var(--font-display)', fontSize:14, color:'rgba(255,255,255,.5)' }}>Carregando...</div>
    </div>
  )
  if (!session) return <Login />
  return <AppContent />
}
