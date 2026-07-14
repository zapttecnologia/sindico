import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

function FloorPattern() {
  return (
    <svg
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: .08 }}
      viewBox="0 0 400 600"
      preserveAspectRatio="xMidYMid slice"
      fill="none" stroke="white" strokeWidth="1"
    >
      <rect x="20" y="30" width="160" height="120" />
      <rect x="20" y="30" width="70" height="55" />
      <rect x="90" y="30" width="90" height="55" />
      <line x1="20" y1="85" x2="90" y2="85" />
      <line x1="90" y1="30" x2="90" y2="150" />
      <rect x="20" y="150" width="160" height="90" />
      <line x1="20" y1="195" x2="180" y2="195" />
      <rect x="20" y="260" width="80" height="100" />
      <rect x="120" y="260" width="60" height="100" />
      <line x1="100" y1="260" x2="100" y2="360" />
      <rect x="20" y="390" width="160" height="80" />
      <rect x="220" y="50" width="150" height="100" />
      <line x1="220" y1="100" x2="370" y2="100" />
      <rect x="220" y="180" width="70" height="120" />
      <rect x="300" y="180" width="70" height="120" />
      <rect x="220" y="330" width="150" height="80" />
      <rect x="220" y="440" width="150" height="120" />
      <line x1="295" y1="440" x2="295" y2="560" />
      <path d="M90 30 Q70 50 90 70" strokeDasharray="2,2"/>
      <path d="M180 150 Q160 170 180 190" strokeDasharray="2,2"/>
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
    if (!codigo || !senha) { setError('Preencha código de acesso e senha.'); return }
    setLoading(true)
    setError('')
    try {
      await login(codigo.toUpperCase().trim(), senha)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, var(--navy) 0%, var(--navy-mid) 50%, var(--emerald) 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <FloorPattern />

      <div style={{
        position: 'relative',
        zIndex: 1,
        width: '100%',
        maxWidth: 420,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0,
      }}>

        {/* ── Topo: marca + descrição ── */}
        <div style={{ textAlign: 'center', marginBottom: 36, padding: '0 8px' }}>
          {/* Logo */}
          <div style={{
            width: 64, height: 64,
            background: 'rgba(255,255,255,.15)',
            borderRadius: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
            backdropFilter: 'blur(4px)',
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
              <path d="M4 21V8L12 3l8 5v13"/><path d="M9 21v-6h6v6"/>
            </svg>
          </div>

          {/* Nome */}
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 28,
            fontWeight: 800,
            color: '#fff',
            margin: '0 0 10px',
            letterSpacing: '-.4px',
            lineHeight: 1.15,
          }}>
            Central de Solicitações
          </h1>

          {/* Descrição */}
          <p style={{
            color: 'rgba(255,255,255,.7)',
            fontSize: 14,
            margin: 0,
            lineHeight: 1.6,
          }}>
            Gestão de condomínios de forma simples,<br />
            organizada e transparente para todos.
          </p>
          <p style={{ color:'rgba(255,255,255,.5)', fontSize:13, marginTop:12, lineHeight:1.5, fontStyle:'italic' }}>
            Central inteligente de solicitações para condomínios —<br/>
            sem burocracia, sem WhatsApp perdido.
          </p>
        </div>

        {/* ── Card de login ── */}
        <div style={{
          background: 'var(--white)',
          borderRadius: 'var(--r-xl)',
          padding: '32px 28px 36px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(15,33,55,.35)',
        }}>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 800,
            color: 'var(--navy)',
            margin: '0 0 4px',
            letterSpacing: '-.3px',
          }}>
            Bem-vindo
          </h2>
          <p style={{
            color: 'var(--gray-400)',
            fontSize: 13.5,
            margin: '0 0 24px',
          }}>
            Entre com seu código de acesso e senha.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="codigo">Código de acesso</label>
              <input
                id="codigo"
                className="input"
                type="text"
                placeholder="Ex.: JOAO302"
                value={codigo}
                onChange={e => setCodigo(e.target.value)}
                autoCapitalize="characters"
                autoFocus
              />
            </div>
            <div className="field">
              <label htmlFor="senha">Senha</label>
              <input
                id="senha"
                className="input"
                type="password"
                placeholder="Sua senha"
                value={senha}
                onChange={e => setSenha(e.target.value)}
              />
            </div>
            {error && <div className="error-text" style={{ marginBottom: 14 }}>{error}</div>}
            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={loading}
              style={{ marginTop: 4, padding: '13px', fontSize: 15 }}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p style={{
            fontSize: 12.5,
            color: 'var(--gray-400)',
            marginTop: 20,
            textAlign: 'center',
            lineHeight: 1.5,
          }}>
            Não recebeu seu código de acesso?<br />
            Entre em contato com a administração.
          </p>
        </div>

      </div>
    </div>
  )
}
