import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  const carregarPerfil = useCallback(async (userId) => {
    // Verifica super admin — tolerante a erro caso a tabela não exista ainda
    try {
      const { data: sa } = await supabase
        .from('super_admins').select('id').eq('usuario_id', userId).maybeSingle()
      setIsSuperAdmin(!!sa)
    } catch {
      setIsSuperAdmin(false)
    }

    // Carrega perfil normal
    const { data } = await supabase.from('perfis').select('*').eq('id', userId).single()
    setPerfil(data)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) carregarPerfil(data.session.user.id).finally(() => setLoading(false))
      else setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_e, sess) => {
      setSession(sess)
      if (sess) carregarPerfil(sess.user.id)
      else { setPerfil(null); setIsSuperAdmin(false); setLoading(false) }
    })
    return () => listener.subscription.unsubscribe()
  }, [carregarPerfil])

  const login = async (codigo, senha) => {
    // Tenta código de acesso primeiro; se falhar, usa como e-mail direto
    try {
      const { data: email } = await supabase.rpc('buscar_email_por_codigo', { p_codigo: codigo })
      if (email) {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
        if (!error) return
      }
    } catch { /* ignora */ }

    // Fallback: tenta como e-mail direto (para super admin e outros)
    const { error } = await supabase.auth.signInWithPassword({ email: codigo, password: senha })
    if (error) throw new Error('Código/e-mail ou senha incorretos.')
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setPerfil(null); setIsSuperAdmin(false)
  }

  return (
    <AuthContext.Provider value={{ session, perfil, isSuperAdmin, loading, login, logout, carregarPerfil }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
