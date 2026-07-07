import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { BUCKET_ANEXOS } from '../lib/constants'
import { useAuth } from '../context/AuthContext'

export default function AnexosPanel({ solicitacaoId, onToast }) {
  const { perfil } = useAuth()
  const [arquivos, setArquivos] = useState([])
  const [uploading, setUploading] = useState(false)

  const carregar = async () => {
    const { data } = await supabase.storage.from(BUCKET_ANEXOS).list(solicitacaoId, {
      sortBy: { column: 'created_at', order: 'desc' }
    })
    if (data) setArquivos(data)
  }

  useEffect(() => { carregar() }, [solicitacaoId])

  const getUrl = async (nome, download = false) => {
    const opts = download ? { download: nome.replace(/^\d+_/, '') } : undefined
    const { data } = await supabase.storage.from(BUCKET_ANEXOS).createSignedUrl(`${solicitacaoId}/${nome}`, 3600, opts)
    return data?.signedUrl
  }

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const nomeSeguro = `${Date.now()}_${file.name}`.replace(/[^a-zA-Z0-9._-]/g, '_')
    const { error } = await supabase.storage.from(BUCKET_ANEXOS).upload(`${solicitacaoId}/${nomeSeguro}`, file)
    if (error) onToast?.('Erro ao enviar arquivo: ' + error.message)
    else { onToast?.('Arquivo anexado.'); await carregar() }
    setUploading(false)
    e.target.value = ''
  }

  const ehAdmin = ['equipe', 'admin'].includes(perfil?.papel)

  return (
    <div className="attachments">
      {arquivos.length === 0 && <p style={{ fontSize: 13, color: 'var(--gray-400)', margin: '0 0 10px' }}>Nenhum arquivo ainda.</p>}
      <div className="attachment-list">
        {arquivos.map(f => (
          <div key={f.name} className="attachment-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--emerald)" strokeWidth="2">
              <path d="M21.44 11.05L12.25 20.24a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
            </svg>
            <a href="#" onClick={async e => { e.preventDefault(); const url = await getUrl(f.name); if (url) window.open(url, '_blank') }}>
              {f.name.replace(/^\d+_/, '')}
            </a>
            {ehAdmin && (
              <a href="#" style={{ fontSize: 12, color: 'var(--gray-400)' }} onClick={async e => { e.preventDefault(); const url = await getUrl(f.name, true); if (url) { const a = document.createElement('a'); a.href = url; a.click() } }}>
                ⬇
              </a>
            )}
          </div>
        ))}
      </div>
      <label className="file-upload-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        {uploading ? 'Enviando...' : 'Adicionar arquivo'}
        <input type="file" style={{ display: 'none' }} onChange={handleUpload} disabled={uploading} />
      </label>
    </div>
  )
}
