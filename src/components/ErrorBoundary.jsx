import { Component } from 'react'

/**
 * ErrorBoundary — evita a "tela branca".
 *
 * Envolve qualquer parte da aplicação. Se um erro de renderização acontecer
 * dentro dela, em vez de apagar a tela inteira (comportamento padrão do React),
 * mostra uma mensagem amigável com a opção de recarregar.
 *
 * Uso:
 *   <ErrorBoundary>
 *     <MinhaTela />
 *   </ErrorBoundary>
 *
 * Props:
 *   fallback (node|fn)  — opcional; conteúdo alternativo a exibir no erro.
 *                          Se for função, recebe ({ erro, resetar }).
 *   children (node)
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { erro: null }
    this.resetar = this.resetar.bind(this)
  }

  static getDerivedStateFromError(error) {
    return { erro: error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary capturou um erro:', error, info)
  }

  resetar() {
    this.setState({ erro: null })
  }

  render() {
    if (this.state.erro) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback({ erro: this.state.erro, resetar: this.resetar })
      }
      if (this.props.fallback) return this.props.fallback

      return (
        <div style={{
          minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24, textAlign: 'center',
        }}>
          <div style={{ maxWidth: 380 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--navy)', margin: '0 0 8px' }}>
              Algo deu errado
            </h2>
            <p style={{ fontSize: 14, color: 'var(--gray-500)', margin: '0 0 20px', lineHeight: 1.5 }}>
              A tela encontrou um problema ao carregar. Você pode tentar de novo sem perder o acesso.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={this.resetar}>Tentar novamente</button>
              <button className="btn" style={{ background: 'var(--gray-100)', color: 'var(--gray-600)', border: 'none' }}
                onClick={() => window.location.reload()}>
                Recarregar página
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
