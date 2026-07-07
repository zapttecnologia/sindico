import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function AlterarSenha() {
  const { perfil, carregarPerfil, session } = useAuth()
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const salvar = async () => {
    setErro('')
    if (novaSenha.length < 6) { setErro('A nova senha precisa ter pelo menos 6 caracteres.'); return }
    if (novaSenha !== confirmar) { setErro('As senhas não coincidem.'); return }
    if (novaSenha === 'mudar123') { setErro('Escolha uma senha diferente da senha padrão.'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: novaSenha })
    if (error) { setErro('Erro ao alterar senha: ' + error.message); setLoading(false); return }
    await supabase.from('perfis').update({ primeiro_acesso: false }).eq('id', perfil.id)
    await carregarPerfil(session.user.id)
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, var(--navy) 0%, var(--emerald) 100%)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 440, background: 'var(--white)', borderRadius: 'var(--r-xl) var(--r-xl) 0 0', padding: '36px 28px 48px', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🔒</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: 'var(--navy)', margin: '0 0 8px' }}>
            Crie sua senha
          </h1>
          <p style={{ fontSize: 14, color: 'var(--gray-400)', margin: 0, lineHeight: 1.5 }}>
            Olá, <b>{perfil?.nome}</b>! Por segurança, crie uma senha pessoal antes de continuar.
          </p>
        </div>

        <div style={{ background: 'var(--mint)', borderRadius: 'var(--r-md)', padding: '12px 14px', marginBottom: 24, fontSize: 13, color: 'var(--emerald)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <span style={{ flexShrink: 0 }}>ℹ️</span>
          <span>Você está usando a senha padrão do sistema. Escolha uma senha que só você saiba.</span>
        </div>

        <div className="field">
          <label>Nova senha</label>
          <input className="input" type="password" placeholder="Mínimo 6 caracteres" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label>Confirmar nova senha</label>
          <input className="input" type="password" placeholder="Repita a nova senha" value={confirmar} onChange={e => setConfirmar(e.target.value)} onKeyDown={e => e.key === 'Enter' && salvar()} />
        </div>
        {erro && <div className="error-text" style={{ marginBottom: 16 }}>{erro}</div>}
        <button className="btn btn-primary btn-block" onClick={salvar} disabled={loading || !novaSenha || !confirmar}>
          {loading ? 'Salvando...' : 'Salvar senha e continuar'}
        </button>
      </div>
    </div>
  )
}
