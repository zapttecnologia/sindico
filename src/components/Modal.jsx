import { Component, useEffect } from 'react'

/**
 * Modal — janela sobreposta (lightbox/dialog) reutilizável em todo o sistema.
 *
 * Uso:
 *   <Modal open={aberto} onClose={()=>setAberto(false)} title="Novo chamado" size="lg">
 *     ...conteúdo (formulários, etapas, etc.)...
 *   </Modal>
 *
 * Props:
 *   open      (bool)      — controla a visibilidade
 *   onClose   (fn)        — chamada ao fechar (X, clicar no fundo, ou tecla Esc)
 *   title     (string)    — título opcional no cabeçalho
 *   size      (string)    — 'sm' | 'md' | 'lg' | 'xl' (largura máxima)
 *   closeOnOverlay (bool) — fechar ao clicar no fundo (padrão: true)
 *   children  (node)      — conteúdo da janela
 *
 * Recursos:
 *   - Fecha com a tecla Esc.
 *   - Trava a rolagem do fundo enquanto aberto.
 *   - Error boundary embutida: se o conteúdo quebrar, mostra uma mensagem
 *     amigável em vez de deixar a tela branca.
 */

const SIZES = { sm: 380, md: 480, lg: 640, xl: 820 }

// Error boundary: impede a "tela branca" quando algo dentro do modal falha.
class ModalErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { erro: null }
  }
  static getDerivedStateFromError(error) {
    return { erro: error }
  }
  componentDidCatch(error, info) {
    console.error('Erro dentro do Modal:', error, info)
  }
  render() {
    if (this.state.erro) {
      return (
        <div style={{ padding: '20px 4px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--navy)', margin: '0 0 8px' }}>
            Algo não carregou como esperado
          </h3>
          <p style={{ fontSize: 13, color: 'var(--gray-500)', margin: '0 0 16px', lineHeight: 1.5 }}>
            Ocorreu um erro ao exibir esta janela. Feche e tente novamente.
          </p>
          <button className="btn btn-primary" onClick={this.props.onClose}>Fechar</button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function Modal({ open, onClose, title, size = 'md', closeOnOverlay = true, children }) {
  // Fecha com Esc + trava a rolagem do fundo enquanto aberto
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflowAnterior
    }
  }, [open, onClose])

  if (!open) return null

  const maxWidth = SIZES[size] || SIZES.md

  return (
    <div
      className="modal-overlay"
      onClick={(e) => { if (closeOnOverlay && e.target === e.currentTarget) onClose?.() }}
    >
      <div className="modal" style={{ maxWidth }} role="dialog" aria-modal="true">
        {(title || onClose) && (
          <div className="modal-header">
            <h3 className="modal-title">{title || ''}</h3>
            {onClose && <button className="modal-close" onClick={onClose} aria-label="Fechar">✕</button>}
          </div>
        )}
        <ModalErrorBoundary onClose={onClose}>
          {children}
        </ModalErrorBoundary>
      </div>
    </div>
  )
}
