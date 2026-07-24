import { useState } from 'react'
import { useAuth } from './context/AuthContext'
import ErrorBoundary from './components/ErrorBoundary'
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
import Comunicados from './views/Comunicados'
import Agenda from './views/Agenda'
import Fornecedores from './views/Fornecedores'
import DashboardAnalitico from './views/DashboardAnalitico'
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

    if (perfil?.papel === 'morador') return <Morador view={activeView} onNavigate={setActiveView} onToast={toast} />
    if (perfil?.papel === 'conselheiro') return <Conselheiro view={activeView} onNavigate={setActiveView} onToast={toast} />
    if (perfil?.papel === 'equipe' || perfil?.papel === 'admin') {
      if (activeView === 'admin')     return <Admin onToast={toast} />
      if (activeView === 'perfil')    return <Perfil onToast={toast} />
      if (activeView === 'relatorio') return <Relatorio onToast={toast} />
      if (activeView === 'comunicados') return <Comunicados onToast={toast} />
      if (activeView === 'agenda') return <Agenda onToast={toast} />
      if (activeView === 'fornecedores') return <Fornecedores onToast={toast} />
      if (activeView === 'analitico') return <DashboardAnalitico onToast={toast} />
      return <Equipe view={activeView} onToast={toast} />
    }
    return <div style={{ padding:40 }}>Papel nao reconhecido: {perfil?.papel}</div>
  }

  return (
    <div className="app-shell">
      <Navigation activeView={activeView} onNavigate={setActiveView} />
      <main className="main-content"><ErrorBoundary>{renderView()}</ErrorBoundary></main>
      <Toast msg={msg} show={show} />
    </div>
  )
}

function AppSuperAdmin() {
  const { msg, show, toast } = useToast()
  return <><SuperAdmin onToast={toast} /><Toast msg={msg} show={show} /></>
}

function AppContent() {
  const { perfil, isSuperAdmin } = useAuth()
  if (isSuperAdmin) return <AppSuperAdmin />
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
