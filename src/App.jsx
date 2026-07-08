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
import { Toast, useToast } from './components/Toast'

function AppNormal() {
  const { perfil } = useAuth()
  const { msg, show, toast } = useToast()
  const defaultView = { morador:'chamados', conselheiro:'votacao', equipe:'dashboard', admin:'dashboard' }[perfil?.papel] || 'chamados'
  const [activeView, setActiveView] = useState(defaultView)

  const renderView = () => {
    if (perfil?.papel === 'morador') return <Morador onToast={toast} />
    if (perfil?.papel === 'conselheiro') return <Conselheiro onToast={toast} />
    if (perfil?.papel === 'equipe' || perfil?.papel === 'admin') {
      if (activeView === 'admin') return <Admin onToast={toast} />
      if (activeView === 'perfil') return <Perfil onToast={toast} />
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
