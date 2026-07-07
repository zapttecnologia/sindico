import { useAuth } from '../context/AuthContext'

const ICONS = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12L12 3l9 9"/><path d="M9 21V12h6v9"/>
    </svg>
  ),
  list: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 9h8M8 13h5"/>
    </svg>
  ),
  vote: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 12l2 2 4-4"/><rect x="3" y="5" width="18" height="14" rx="2"/>
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
}

function initials(name) {
  if (!name) return '?'
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

const ROLE_LABEL = { morador: 'Morador', equipe: 'Síndico', admin: 'Administrador', conselheiro: 'Conselheiro' }

export default function Navigation({ activeView, onNavigate }) {
  const { perfil, logout } = useAuth()

  const navItems = () => {
    if (!perfil) return []
    if (perfil.papel === 'morador') return [
      { id: 'chamados', label: 'Meus chamados', icon: ICONS.list },
    ]
    if (perfil.papel === 'conselheiro') return [
      { id: 'votacao', label: 'Votação', icon: ICONS.vote },
    ]
    if (perfil.papel === 'equipe') return [
      { id: 'dashboard', label: 'Painel', icon: ICONS.home },
      { id: 'chamados', label: 'Chamados', icon: ICONS.list },
      { id: 'admin', label: 'Condomínios', icon: ICONS.settings },
    ]
    if (perfil.papel === 'admin') return [
      { id: 'dashboard', label: 'Painel', icon: ICONS.home },
      { id: 'chamados', label: 'Chamados', icon: ICONS.list },
      { id: 'admin', label: 'Administração', icon: ICONS.settings },
    ]
    return []
  }

  const items = navItems()

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8">
              <path d="M4 21V8L12 3l8 5v13"/><path d="M9 21v-6h6v6"/>
            </svg>
          </div>
          <div>
            <div className="sidebar-name">Central de<br/>Solicitações</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {items.map(item => (
            <button
              key={item.id}
              className={`nav-item${activeView === item.id ? ' active' : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-avatar">{initials(perfil?.nome)}</div>
            <div className="user-info">
              <div className="user-name">{perfil?.nome || '—'}</div>
              <div className="user-role">{ROLE_LABEL[perfil?.papel] || perfil?.papel}</div>
            </div>
            <button className="btn-logout btn-icon" onClick={logout} title="Sair">{ICONS.logout}</button>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="bottom-nav">
        {items.map(item => (
          <button
            key={item.id}
            className={`bottom-nav-item${activeView === item.id ? ' active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
        <button className="bottom-nav-item" onClick={logout}>
          {ICONS.logout}
          Sair
        </button>
      </nav>
    </>
  )
}
