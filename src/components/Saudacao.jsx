import { useAuth } from '../context/AuthContext'

// Saudação leve no topo da tela inicial de cada painel (estilo Linear/Notion).
// Linha 1: marca fixa + primeiro nome. Linha 2 (contexto): passada pelo painel.
// Data de hoje à direita (some/desce em telas estreitas via flex-wrap).
function dataHojePtBr() {
  try {
    const s = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
    return s.charAt(0).toUpperCase() + s.slice(1)
  } catch {
    return ''
  }
}

export default function Saudacao({ contexto }) {
  const { perfil } = useAuth()
  const primeiroNome = (perfil?.nome || '').trim().split(' ')[0] || ''
  const data = dataHojePtBr()

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
      gap: 16, flexWrap: 'wrap', margin: '4px 0 24px',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800,
          letterSpacing: '-.02em', color: 'var(--navy)', lineHeight: 1.2,
        }}>
          Bem-vindo ao Zapt Condo{primeiroNome ? `, ${primeiroNome}` : ''} 👋
        </div>
        {contexto && (
          <div style={{ fontSize: 13.5, color: 'var(--text-subtle)', marginTop: 6, lineHeight: 1.5 }}>
            {contexto}
          </div>
        )}
      </div>
      {data && (
        <div style={{ fontSize: 13, color: 'var(--text-subtle)', whiteSpace: 'nowrap' }}>
          {data}
        </div>
      )}
    </div>
  )
}
