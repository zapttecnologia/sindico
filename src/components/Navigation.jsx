import { useAuth } from '../context/AuthContext'

const ICONS = {
  home:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  list:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 9h8M8 13h5"/></svg>,
  condo:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 21V8L12 3l8 5v13"/><path d="M9 21v-6h6v6"/></svg>,
  vote:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4"/><rect x="3" y="5" width="18" height="14" rx="2"/></svg>,
  user:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>,
  plus:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>,
  clock:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  logout:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
}

function initials(name) {
  if (!name) return '?'
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

const ROLE_LABEL = {
  morador:'Morador', equipe:'Sindico', admin:'Administrador', conselheiro:'Conselheiro',
  manutencao:'Manutenção', limpeza:'Limpeza', administradora:'Administradora',
  portaria:'Portaria', seguranca:'Segurança', zeladoria:'Zeladoria', terceiros:'Terceiros',
}

export default function Navigation({ activeView, onNavigate }) {
  const { perfil, logout } = useAuth()

  const navItems = () => {
    if (!perfil) return []
    if (perfil.papel === 'morador') return [
      { id:'painel',        label:'Painel',        icon:ICONS.home },
      { id:'novo-chamado',  label:'Novo Chamado',  icon:ICONS.plus },
      { id:'meus-chamados', label:'Meus Chamados', icon:ICONS.list },
      { id:'historico',     label:'Histórico',     icon:ICONS.clock },
    ]
    if (perfil.papel === 'conselheiro') return [
      { id:'painel',        label:'Painel',        icon:ICONS.home },
      { id:'aprovacoes',    label:'Aprovações',    icon:ICONS.vote },
      { id:'chamados',      label:'Chamados',      icon:ICONS.list },
      { id:'novo-chamado',  label:'Novo Chamado',  icon:ICONS.plus },
    ]
    // Papéis departamentais
    const isPaperDept = ['manutencao','limpeza','administradora','portaria','seguranca','zeladoria','terceiros'].includes(perfil.papel)
    if (isPaperDept) return [
      { id:'meus-chamados', label:'Meus Chamados', icon:ICONS.list },
    ]
    if (perfil.papel === 'equipe' || perfil.papel === 'admin') return [
      { id:'dashboard',  label:'Painel',        icon:ICONS.home },
      { id:'chamados',   label:'Chamados',      icon:ICONS.list },
      { id:'admin',      label:'Condomínios',   icon:ICONS.condo },
      { id:'relatorio',  label:'Relatório',     icon:ICONS.clock },
      { id:'perfil',     label:'Minha empresa', icon:ICONS.user },
    ]
    return []
  }

  const items = navItems()

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8">
              <path d="M4 21V8L12 3l8 5v13"/><path d="M9 21v-6h6v6"/>
            </svg>
          </div>
          <div>
            <div className="sidebar-name">Portal de<br/>Chamados</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {items.map(item => (
            <button key={item.id} className={`nav-item${activeView===item.id?' active':''}`} onClick={() => onNavigate(item.id)}>
              {item.icon}{item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-avatar">{initials(perfil?.nome)}</div>
            <div className="user-info">
              <div className="user-name">{perfil?.nome || '-'}</div>
              <div className="user-role">{ROLE_LABEL[perfil?.papel] || perfil?.papel}</div>
            </div>
            <button className="btn-logout" onClick={logout}>{ICONS.logout} Sair</button>
          </div>
        </div>
      </aside>

      <nav className="bottom-nav">
        {items.map(item => (
          <button key={item.id} className={`bottom-nav-item${activeView===item.id?' active':''}`} onClick={() => onNavigate(item.id)}>
            {item.icon}{item.label}
          </button>
        ))}
        <button className="bottom-nav-item" onClick={logout}>{ICONS.logout}Sair</button>
      </nav>
    </>
  )
}
