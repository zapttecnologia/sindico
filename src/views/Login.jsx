import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

function ZaptCondoLogo({ size = 64, white = false }) {
  const blue = white ? 'white' : '#2843ad'
  const teal = white ? 'rgba(255,255,255,0.75)' : '#5fa9b4'
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="18" y="48" width="13" height="26" rx="1.5" fill={blue}/>
      <rect x="33" y="36" width="13" height="38" rx="1.5" fill={blue}/>
      <rect x="48" y="22" width="13" height="52" rx="1.5" fill={blue}/>
      <rect x="63" y="18" width="13" height="56" rx="1.5" fill={teal}/>
      <path d="M8 76 Q50 92 92 76" stroke={blue} strokeWidth="4.5" fill="none" strokeLinecap="round"/>
      <path d="M8 76 Q28 64 46 68" stroke={blue} strokeWidth="4.5" fill="none" strokeLinecap="round"/>
      <polygon points="22,50 28,46 28,54" fill={blue}/>
    </svg>
  )
}

export default function Login() {
  const { login } = useAuth()
  const [codigo, setCodigo] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!codigo || !senha) { setError('Preencha codigo de acesso e senha.'); return }
    setLoading(true); setError('')
    try { await login(codigo.toUpperCase().trim(), senha) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #0d1a3a 0%, #2843ad 60%, #5fa9b4 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px', position: 'relative', overflow: 'hidden',
    }}>
      <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', opacity:.06 }}
        viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" fill="none" stroke="white" strokeWidth="1">
        <rect x="20" y="30" width="160" height="120"/>
        <rect x="20" y="30" width="70" height="55"/>
        <rect x="90" y="30" width="90" height="55"/>
        <rect x="20" y="150" width="160" height="90"/>
        <rect x="20" y="260" width="80" height="100"/>
        <rect x="120" y="260" width="60" height="100"/>
        <rect x="220" y="50" width="150" height="100"/>
        <rect x="220" y="180" width="70" height="120"/>
        <rect x="300" y="180" width="70" height="120"/>
        <rect x="220" y="330" width="150" height="80"/>
      </svg>

      <div style={{ position:'relative', zIndex:1, width:'100%', maxWidth:420, display:'flex', flexDirection:'column', alignItems:'center' }}>
        <div style={{ textAlign:'center', marginBottom:36 }}>
          <div style={{ display:'inline-flex', alignItems:'center', justifyContent:'center',
            width:76, height:76, background:'rgba(255,255,255,.15)',
            borderRadius:20, marginBottom:18, backdropFilter:'blur(4px)' }}>
            <ZaptCondoLogo size={52} white />
          </div>
          <h1 style={{ fontFamily:'var(--font-display)', fontSize:28, fontWeight:800,
            color:'#fff', margin:'0 0 10px', letterSpacing:'-.3px', lineHeight:1.2 }}>
            Portal de Chamados
          </h1>
          <p style={{ color:'rgba(255,255,255,.65)', fontSize:14, margin:0, lineHeight:1.6 }}>
            Gestao de condominios simples e eficiente<br/>para sindicos e moradores.
          </p>
        </div>

        <div style={{ background:'#fff', borderRadius:20, padding:'32px 28px 36px',
          width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,.3)' }}>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:800,
            color:'#1a1a2e', margin:'0 0 4px', letterSpacing:'-.3px' }}>
            Bem-vindo
          </h2>
          <p style={{ color:'#888', fontSize:13.5, margin:'0 0 24px' }}>
            Entre com seu codigo de acesso e senha.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="codigo">Codigo de acesso</label>
              <input id="codigo" className="input" type="text"
                placeholder="Ex.: JOAO302" value={codigo}
                onChange={e => setCodigo(e.target.value)}
                autoCapitalize="characters" autoFocus />
            </div>
            <div className="field">
              <label htmlFor="senha">Senha</label>
              <input id="senha" className="input" type="password"
                placeholder="Sua senha" value={senha}
                onChange={e => setSenha(e.target.value)} />
            </div>
            {error && <div className="error-text" style={{ marginBottom:14 }}>{error}</div>}
            <button type="submit" disabled={loading}
              style={{ width:'100%', padding:'13px', fontSize:15, fontWeight:700,
                background: loading ? '#5fa9b4' : '#2843ad',
                color:'#fff', border:'none', borderRadius:10, cursor:'pointer',
                transition:'background .2s', marginTop:4 }}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p style={{ fontSize:12.5, color:'#aaa', marginTop:20, textAlign:'center', lineHeight:1.6 }}>
            Nao recebeu seu codigo de acesso?<br/>
            Entre em contato com a administracao.
          </p>
        </div>
      </div>
    </div>
  )
}
