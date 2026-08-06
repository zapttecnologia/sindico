import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
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
  agenda: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  chart:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  truck:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="1" y="6" width="13" height="10" rx="1"/><path d="M14 9h4l3 3v4h-7z"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>,
  shield: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4l2 1"/></svg>,
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
  const [chamados, setChamados] = useState(0)
  const [venc, setVenc] = useState(0)
  const [contratos, setContratos] = useState(0)
  const novos = chamados + venc + contratos
  const [somLigado, setSomLigado] = useState(() => {
    // Preferência do usuário (padrão: ligado)
    try { return localStorage.getItem('alertaSom') !== 'off' } catch { return true }
  })
  const anteriorRef = useRef(null)     // contagem da verificação anterior
  const somRef = useRef(somLigado)
  useEffect(() => { somRef.current = somLigado }, [somLigado])

  // Toca um bipe curto usando o próprio navegador (sem arquivo de áudio)
  const tocarAlerta = () => {
    if (!somRef.current) return
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (!Ctx) return
      const ctx = new Ctx()
      const tocar = (freq, inicio, duracao) => {
        const osc = ctx.createOscillator()
        const vol = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = freq
        osc.connect(vol); vol.connect(ctx.destination)
        vol.gain.setValueAtTime(0.0001, ctx.currentTime + inicio)
        vol.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + inicio + 0.02)
        vol.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + inicio + duracao)
        osc.start(ctx.currentTime + inicio)
        osc.stop(ctx.currentTime + inicio + duracao + 0.02)
      }
      // Duas notas curtas, discretas
      tocar(880, 0, 0.15)
      tocar(1174, 0.16, 0.2)
      setTimeout(() => ctx.close(), 800)
    } catch { /* som é acessório: nunca quebra a navegação */ }
  }

  const alternarSom = () => {
    setSomLigado(v => {
      const novo = !v
      try { localStorage.setItem('alertaSom', novo ? 'on' : 'off') } catch {}
      return novo
    })
  }

  // Conta chamados em aberto dos condomínios do síndico (para o sino).
  // Atualiza a cada 2 minutos e quando a aba volta ao foco.
  useEffect(() => {
    const ehGestor = perfil?.papel === 'equipe' || perfil?.papel === 'admin'
    if (!ehGestor || !perfil?.id) return

    const contar = async () => {
      try {
        const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
        const emDias = (d) => Math.round((new Date(String(d).slice(0,10) + 'T00:00:00') - hoje) / 86400000)

        // Contratos de fornecedores vencendo (por empresa — independe de condomínio)
        let nContratos = 0
        try {
          const { data: fs } = await supabase.from('fornecedores')
            .select('contrato_fim').eq('empresa_id', perfil.empresa_id)
            .eq('tem_contrato', true).eq('ativo', true).not('contrato_fim', 'is', null)
          nContratos = (fs || []).filter(f => emDias(f.contrato_fim) <= 30).length
        } catch { /* coluna/tabela pode faltar: o sino não pode quebrar */ }
        setContratos(nContratos)

        // Condomínios do gestor
        let ids = []
        if (perfil.papel === 'admin') {
          const { data } = await supabase.from('condominios').select('id').eq('empresa_id', perfil.empresa_id)
          ids = (data || []).map(c => c.id)
        } else {
          const { data } = await supabase.from('sindico_condominios')
            .select('condominio_id').eq('perfil_id', perfil.id)
          ids = (data || []).map(v => v.condominio_id)
        }

        let nChamados = 0, nVenc = 0
        if (ids.length) {
          const { count } = await supabase.from('solicitacoes')
            .select('id', { count:'exact', head:true })
            .in('condominio_id', ids)
            .not('status', 'in', '("resolvido","cancelado")')
          nChamados = count || 0

          // Vencimentos vencendo/vencidos: janela por-linha (data - hoje <= dias_aviso).
          try {
            const { data: vs } = await supabase.from('vencimentos')
              .select('data_vencimento, dias_aviso')
              .in('condominio_id', ids).eq('status', 'ativo')
            nVenc = (vs || []).filter(v => emDias(v.data_vencimento) <= (v.dias_aviso ?? 30)).length
          } catch { /* tabela pode não existir ainda */ }
        }
        setChamados(nChamados); setVenc(nVenc)

        const total = nChamados + nVenc + nContratos
        // Toca só quando AUMENTA (e não na primeira verificação)
        if (anteriorRef.current !== null && total > anteriorRef.current) tocarAlerta()
        anteriorRef.current = total
      } catch { /* silencioso: o sino é acessório */ }
    }

    contar()
    const timer = setInterval(() => { if (!document.hidden) contar() }, 2 * 60 * 1000)
    const onFoco = () => { if (!document.hidden) contar() }
    document.addEventListener('visibilitychange', onFoco)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onFoco) }
  }, [perfil?.id, perfil?.papel, perfil?.empresa_id])

  const getNavItems = () => {
    if (!perfil) return []
    if (perfil.papel === 'morador') return [
      { id:'painel',        label:'Painel',         icon:ICONS.home,   section:'Principal' },
      { id:'novo-chamado',  label:'Novo chamado',   icon:ICONS.plus },
      { id:'meus-chamados', label:'Meus chamados',  icon:ICONS.list },
      { id:'comunicados',   label:'Comunicados',    icon:ICONS.bell },
      { id:'agenda',        label:'Agenda',         icon:ICONS.agenda },
      { id:'historico',     label:'Histórico',      icon:ICONS.clock },
    ]
    if (perfil.papel === 'conselheiro') return [
      { id:'painel',        label:'Painel',         icon:ICONS.home,   section:'Principal' },
      { id:'aprovacoes',    label:'Aprovações',     icon:ICONS.vote },
      { id:'chamados',      label:'Chamados',       icon:ICONS.list },
      { id:'novo-chamado',  label:'Novo chamado',   icon:ICONS.plus },
      { id:'comunicados',   label:'Comunicados',    icon:ICONS.bell },
      { id:'agenda',        label:'Agenda',         icon:ICONS.agenda },
    ]
    if (perfil.papel === 'equipe' || perfil.papel === 'admin') return [
      { id:'dashboard',  label:'Painel',         icon:ICONS.home,   section:'Principal' },
      { id:'analitico',  label:'Dashboard',      icon:ICONS.chart },
      { id:'chamados',   label:'Chamados',       icon:ICONS.list },
      { id:'admin',      label:'Condomínios',    icon:ICONS.condo,  section:'Gestão' },
      { id:'fornecedores', label:'Fornecedores', icon:ICONS.truck },
      { id:'vencimentos', label:'Controle de Vencimentos',  icon:ICONS.shield },
      { id:'comunicados',label:'Comunicados',    icon:ICONS.bell },
      { id:'agenda',     label:'Agenda',         icon:ICONS.agenda },
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
    fornecedores:'Fornecedores', vencimentos:'Controle de Vencimentos', analitico:'Dashboard',
    relatorio:'Relatórios', perfil:'Minha empresa', painel:'Painel',
    comunicados:'Comunicados', agenda:'Agenda',
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
            <img src="/icone.png" alt="Logo" style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'inherit' }} />
          </div>
          <div>
            <div className="sidebar-logo-text">Portal Síndico</div>
            <div className="sidebar-logo-sub">Zapt Condo</div>
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
          <div className="topbar-icon-btn"
            onClick={() => { if (chamados > 0) onNavigate('chamados'); else if (venc > 0) onNavigate('vencimentos'); else if (contratos > 0) onNavigate('fornecedores') }}
            title={novos > 0
              ? [chamados > 0 && `${chamados} chamado(s) em aberto`, venc > 0 && `${venc} vencimento(s) a vencer`, contratos > 0 && `${contratos} contrato(s) a vencer`].filter(Boolean).join(' · ')
              : 'Nada pendente'}
            style={{ cursor: novos > 0 ? 'pointer' : 'default', position:'relative' }}>
            {ICONS.bell}
            {novos > 0 && (
              <span style={{ position:'absolute', top:-4, right:-4, minWidth:17, height:17, padding:'0 4px',
                borderRadius:9, background:'var(--rust, #ef4444)', color:'#fff', fontSize:10, fontWeight:700,
                display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}>
                {novos > 99 ? '99+' : novos}
              </span>
            )}
          </div>
          {(perfil?.papel === 'equipe' || perfil?.papel === 'admin') && (
            <div className="topbar-icon-btn" onClick={alternarSom}
              title={somLigado ? 'Aviso sonoro ligado (clique para silenciar)' : 'Aviso sonoro desligado'}
              style={{ cursor:'pointer', fontSize:15, opacity: somLigado ? 1 : .45 }}>
              {somLigado ? '🔔' : '🔕'}
            </div>
          )}
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
