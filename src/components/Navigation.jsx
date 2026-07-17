import { useAuth } from '../context/AuthContext'

const ICONS = {
  home:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  list:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  condo:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 21V8L12 3l8 5v13"/><path d="M9 21v-6h6v6"/></svg>,
  vote:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 12l2 2 4-4"/><rect x="3" y="5" width="18" height="14" rx="2"/></svg>,
  user:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>,
  plus:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>,
  clock:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  report: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  logout: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  bell:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
  search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  dots:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>,
}

const PAPEL_LABEL = {
  morador:'Morador', equipe:'Síndico', admin:'Admin', conselheiro:'Conselheiro',
  manutencao:'Manutenção', limpeza:'Limpeza', administradora:'Administradora',
  portaria:'Portaria', seguranca:'Segurança', zeladoria:'Zeladoria', terceiros:'Terceiros',
}

function initials(name) {
  if (!name) return '?'
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

export default function Navigation({ activeView, onNavigate }) {
  const { perfil, logout } = useAuth()

  const getNavItems = () => {
    if (!perfil) return []
    if (perfil.papel === 'morador') return [
      { id:'painel',        label:'Painel',         icon:ICONS.home,   section:'Principal' },
      { id:'novo-chamado',  label:'Novo chamado',   icon:ICONS.plus },
      { id:'meus-chamados', label:'Meus chamados',  icon:ICONS.list },
      { id:'comunicados',   label:'Comunicados',    icon:ICONS.bell },
      { id:'historico',     label:'Histórico',      icon:ICONS.clock },
    ]
    if (perfil.papel === 'conselheiro') return [
      { id:'painel',        label:'Painel',         icon:ICONS.home,   section:'Principal' },
      { id:'aprovacoes',    label:'Aprovações',     icon:ICONS.vote },
      { id:'chamados',      label:'Chamados',       icon:ICONS.list },
      { id:'novo-chamado',  label:'Novo chamado',   icon:ICONS.plus },
      { id:'comunicados',   label:'Comunicados',    icon:ICONS.bell },
    ]
    if (perfil.papel === 'equipe' || perfil.papel === 'admin') return [
      { id:'dashboard',  label:'Painel',         icon:ICONS.home,   section:'Principal' },
      { id:'chamados',   label:'Chamados',       icon:ICONS.list },
      { id:'admin',      label:'Condomínios',    icon:ICONS.condo,  section:'Gestão' },
      { id:'comunicados',label:'Comunicados',    icon:ICONS.bell },
      { id:'relatorio',  label:'Relatórios',     icon:ICONS.report },
      { id:'perfil',     label:'Minha empresa',  icon:ICONS.user,   section:'Empresa' },
    ]
    return []
  }

  const items = getNavItems()
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768
  const nome = perfil?.nome || 'Usuário'
  const label = PAPEL_LABEL[perfil?.papel] || perfil?.papel || ''

  const PAGE_LABEL = {
    dashboard:'Painel', chamados:'Chamados', admin:'Condomínios',
    relatorio:'Relatórios', perfil:'Minha empresa', painel:'Painel',
    comunicados:'Comunicados',
    'novo-chamado':'Novo chamado', 'meus-chamados':'Meus chamados',
    historico:'Histórico', aprovacoes:'Aprovações',
  }

  return (
    <>
      {/* ── SIDEBAR (desktop) ── */}
      <aside className="sidebar">

        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <svg viewBox="0 0 24 24"><path d="M4 21V8L12 3l8 5v13"/><path d="M9 21v-6h6v6"/></svg>
          </div>
          <div>
            <div className="sidebar-logo-text">Portal Síndico</div>
            <div className="sidebar-logo-sub">Gestão condominial</div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="sidebar-nav">
          {items.map((item, i) => (
            <div key={item.id}>
              {item.section && (
                <div className="sidebar-section">{item.section}</div>
              )}
              <button
                className={`sidebar-item${activeView === item.id ? ' active' : ''}`}
                onClick={() => onNavigate(item.id)}>
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </button>
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="sidebar-footer">
          <div className="sidebar-user" onClick={logout}>
            <div className="sidebar-avatar">{initials(nome)}</div>
            <div style={{ flex:1, overflow:'hidden' }}>
              <div className="sidebar-user-name" style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{nome}</div>
              <div className="sidebar-user-role">{label}</div>
            </div>
            <span style={{ color:'rgba(255,255,255,.25)', fontSize:11 }}>Sair</span>
          </div>
        </div>
      </aside>

      {/* ── TOPBAR (desktop) ── */}
      <div className="topbar">
        <div className="topbar-breadcrumb">
          Portal <strong>/ {PAGE_LABEL[activeView] || activeView}</strong>
        </div>
        <div className="topbar-search">
          <span className="topbar-icon-btn" style={{ width:16, height:16, background:'none', border:'none', padding:0 }}>
            {ICONS.search}
          </span>
          <input placeholder="Buscar chamados, moradores..." />
        </div>
        <div className="topbar-actions">
          <div className="topbar-icon-btn">
            {ICONS.bell}
            <div className="notif-dot" />
          </div>
          <div className="topbar-icon-btn" onClick={logout} title="Sair">
            {ICONS.logout}
          </div>
        </div>
      </div>

      {/* ── BOTTOM NAV (mobile) ── */}
      <nav className="bottom-nav">
        {items.slice(0, 4).map(item => (
          <button
            key={item.id}
            className={`bottom-nav-item${activeView === item.id ? ' active' : ''}`}
            onClick={() => onNavigate(item.id)}>
            <span style={{ width:22, height:22 }}>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
        <button className="bottom-nav-item" onClick={logout}>
          <span style={{ width:22, height:22 }}>{ICONS.logout}</span>
          <span>Sair</span>
        </button>
      </nav>
    </>
  )
}
