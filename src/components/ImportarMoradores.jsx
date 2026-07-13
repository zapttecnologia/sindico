import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

function gerarCodigoAuto(nome, idx) {
  const ini = (nome || '').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'USR'
  return `${ini}${String(idx + 1).padStart(3, '0')}`
}

function parsearCSV(texto) {
  const linhas = texto.trim().split('\n')
  const headers = linhas[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase())
  return linhas.slice(1).map(linha => {
    const cols = linha.split(',').map(c => c.replace(/"/g, '').trim())
    const obj = {}
    headers.forEach((h, i) => { obj[h] = cols[i] || '' })
    return obj
  })
}

export default function ImportarMoradores({ condominioId, empresaId, onToast, onClose, onSuccess }) {
  const [etapa, setEtapa] = useState('upload') // upload | preview | resultado
  const [linhas, setLinhas] = useState([])
  const [importando, setImportando] = useState(false)
  const [progresso, setProgresso] = useState(0)
  const [resultado, setResultado] = useState({ ok: 0, erros: [] })
  const inputRef = useRef()

  const baixarTemplate = () => {
    const csv = 'nome,email,bloco,apartamento,codigo_acesso,tipo_ocupacao\nJoão Silva,joao@email.com,Bloco A,101,JOS101,proprietario\nMaria Santos,maria@email.com,Bloco B,202,MAS202,inquilino'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'template_moradores.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const lerArquivo = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const nome = file.name.toLowerCase()

    try {
      if (nome.endsWith('.csv')) {
        const texto = await file.text()
        const dados = parsearCSV(texto)
        processarDados(dados)
      } else if (nome.endsWith('.xlsx') || nome.endsWith('.xls')) {
        // Importa xlsx dinamicamente para evitar problemas de build
        const XLSX = await import('xlsx')
        const buffer = await file.arrayBuffer()
        const wb = XLSX.read(buffer, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const dados = XLSX.utils.sheet_to_json(ws, { defval: '' })
        processarDados(dados)
      } else {
        onToast('Formato não suportado. Use .xlsx, .xls ou .csv')
      }
    } catch (err) {
      onToast('Erro ao ler arquivo: ' + err.message)
    }
    e.target.value = ''
  }

  const processarDados = (dados) => {
    if (!dados || !dados.length) { onToast('Arquivo vazio ou sem dados.'); return }
    const norm = dados.map((row, idx) => {
      const r = {}
      Object.keys(row).forEach(k => {
        r[k.toLowerCase().trim().replace(/\s+/g, '_').replace(/-/g, '_')] = String(row[k] || '').trim()
      })
      const nome = r.nome || r.name || ''
      const email = r.email || r.e_mail || r['e-mail'] || ''
      return {
        nome,
        email,
        bloco: r.bloco || r.block || '',
        apartamento: r.apartamento || r.apto || r.apt || r.unidade || '',
        codigo_acesso: r.codigo_acesso || r.codigo || r.code || '',
        tipo_ocupacao: String(r.tipo_ocupacao || r.tipo || '').toLowerCase().includes('inq') ? 'inquilino' : 'proprietario',
        _idx: idx,
        _valido: !!(nome && email),
        _erro: !nome ? 'Nome obrigatório' : !email ? 'E-mail obrigatório' : '',
      }
    })
    setLinhas(norm)
    setEtapa('preview')
  }

  const importar = async () => {
    const validas = linhas.filter(l => l._valido)
    if (!validas.length) { onToast('Nenhuma linha válida.'); return }

    setImportando(true)
    setProgresso(0)
    const { data: sessData } = await supabase.auth.getSession()
    const token = sessData?.session?.access_token
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-actions`

    let ok = 0
    const erros = []

    for (let i = 0; i < validas.length; i++) {
      const l = validas[i]
      const codigo = (l.codigo_acesso || gerarCodigoAuto(l.nome, i)).toUpperCase()
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            action: 'create_user',
            email: l.email,
            password: 'mudar123',
            nome: l.nome,
            papel: 'morador',
            empresa_id: empresaId,
            codigo_acesso: codigo,
            condominio_id: condominioId,
            bloco: l.bloco,
            apartamento: l.apartamento,
            tipo_ocupacao: l.tipo_ocupacao,
          }),
        })
        const json = await resp.json()
        if (resp.ok) { ok++ }
        else { erros.push(`${l.nome}: ${json.error || 'falha'}`) }
      } catch (err) {
        erros.push(`${l.nome}: ${err.message}`)
      }
      setProgresso(Math.round((i + 1) / validas.length * 100))
    }

    setImportando(false)
    setResultado({ ok, erros })
    setEtapa('resultado')
    if (ok > 0) {
      onToast(`${ok} morador${ok !== 1 ? 'es' : ''} importado${ok !== 1 ? 's' : ''}!`)
      onSuccess?.()
    }
  }

  const validas = linhas.filter(l => l._valido)
  const invalidas = linhas.filter(l => !l._valido)

  // ── ETAPA: UPLOAD ──────────────────────────────────────────
  if (etapa === 'upload') return (
    <div style={{ padding: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--navy)', margin: '0 0 4px' }}>
            Importar moradores via planilha
          </h3>
          <p style={{ fontSize: 13, color: 'var(--gray-400)', margin: 0 }}>
            Aceita Excel (.xlsx) e CSV
          </p>
        </div>
        <button onClick={onClose}
          style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--gray-400)', cursor: 'pointer' }}>✕</button>
      </div>

      {/* Template */}
      <div style={{ background: 'var(--mint)', border: '1.5px dashed var(--emerald)', borderRadius: 'var(--r-lg)',
        padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 22 }}>📋</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--emerald)', marginBottom: 2 }}>Baixe o template primeiro</div>
          <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Preencha com os dados dos moradores no formato correto</div>
        </div>
        <button onClick={baixarTemplate}
          style={{ padding: '8px 14px', background: 'var(--emerald)', border: 'none', borderRadius: 'var(--r-md)',
            color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          ⬇ Baixar template CSV
        </button>
      </div>

      {/* Upload */}
      <div onClick={() => inputRef.current?.click()}
        style={{ border: '2px dashed var(--gray-200)', borderRadius: 'var(--r-lg)', padding: '40px 20px',
          textAlign: 'center', cursor: 'pointer' }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--emerald)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--gray-200)'}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>📂</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--gray-600)', marginBottom: 6 }}>
          Clique para selecionar o arquivo
        </div>
        <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>Excel (.xlsx, .xls) ou CSV</div>
        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={lerArquivo} />
      </div>

      <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--gray-50)', borderRadius: 'var(--r-md)', fontSize: 12, color: 'var(--gray-400)' }}>
        Colunas: <b>nome</b>*, <b>email</b>*, bloco, apartamento, codigo_acesso, tipo_ocupacao (proprietario/inquilino)
        <br/>Senha padrão: <b>mudar123</b> — alterada no 1º acesso. Código gerado automaticamente se não informado.
      </div>
    </div>
  )

  // ── ETAPA: PREVIEW ─────────────────────────────────────────
  if (etapa === 'preview') return (
    <div style={{ padding: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: '0 0 4px', fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--navy)' }}>
            Preview — {linhas.length} linha{linhas.length !== 1 ? 's' : ''}
          </h3>
          <div style={{ display: 'flex', gap: 12, fontSize: 13 }}>
            <span style={{ color: 'var(--emerald)', fontWeight: 700 }}>✅ {validas.length} válida{validas.length !== 1 ? 's' : ''}</span>
            {invalidas.length > 0 && <span style={{ color: 'var(--rust)', fontWeight: 700 }}>⚠ {invalidas.length} com erro</span>}
          </div>
        </div>
        <button onClick={() => setEtapa('upload')}
          style={{ background: 'var(--gray-100)', border: 'none', borderRadius: 'var(--r-md)', padding: '7px 14px',
            fontSize: 13, fontWeight: 600, color: 'var(--gray-600)', cursor: 'pointer' }}>
          ← Trocar arquivo
        </button>
      </div>

      <div style={{ border: '1px solid var(--gray-200)', borderRadius: 'var(--r-lg)', overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ overflowX: 'auto', maxHeight: 300, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-200)' }}>
                {['Status', 'Nome', 'E-mail', 'Bloco', 'Apto', 'Código', 'Tipo'].map(h => (
                  <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700,
                    color: 'var(--gray-400)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--gray-100)', background: l._valido ? 'transparent' : 'rgba(239,68,68,.04)' }}>
                  <td style={{ padding: '7px 10px' }}>
                    {l._valido
                      ? <span style={{ color: 'var(--emerald)', fontSize: 14 }}>✓</span>
                      : <span style={{ color: 'var(--rust)', fontSize: 11, fontWeight: 700 }}>⚠ {l._erro}</span>
                    }
                  </td>
                  <td style={{ padding: '7px 10px', fontWeight: 500, color: 'var(--gray-700)' }}>{l.nome || '—'}</td>
                  <td style={{ padding: '7px 10px', color: 'var(--gray-500)' }}>{l.email || '—'}</td>
                  <td style={{ padding: '7px 10px', color: 'var(--gray-400)' }}>{l.bloco || '—'}</td>
                  <td style={{ padding: '7px 10px', color: 'var(--gray-400)' }}>{l.apartamento || '—'}</td>
                  <td style={{ padding: '7px 10px', color: 'var(--navy)', fontFamily: 'monospace', fontSize: 11 }}>
                    {(l.codigo_acesso || gerarCodigoAuto(l.nome, i)).toUpperCase()}
                  </td>
                  <td style={{ padding: '7px 10px', fontSize: 11, color: 'var(--gray-400)' }}>
                    {l.tipo_ocupacao === 'inquilino' ? '🔑 Inquilino' : '🏠 Proprietário'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {importando && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--gray-400)', marginBottom: 4 }}>
            <span>Importando...</span><span>{progresso}%</span>
          </div>
          <div style={{ height: 6, background: 'var(--gray-100)', borderRadius: 3 }}>
            <div style={{ height: '100%', width: `${progresso}%`, background: 'var(--emerald)', borderRadius: 3, transition: 'width .3s' }} />
          </div>
        </div>
      )}

      {validas.length > 0 && (
        <button className="btn btn-primary btn-block" onClick={importar} disabled={importando} style={{ fontSize: 14 }}>
          {importando ? `Importando... ${progresso}%` : `Importar ${validas.length} morador${validas.length !== 1 ? 'es' : ''}`}
        </button>
      )}
    </div>
  )

  // ── ETAPA: RESULTADO ────────────────────────────────────────
  return (
    <div style={{ padding: 4, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>{resultado.ok > 0 ? '✅' : '❌'}</div>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--navy)', margin: '0 0 8px' }}>
        {resultado.ok} morador{resultado.ok !== 1 ? 'es' : ''} importado{resultado.ok !== 1 ? 's' : ''} com sucesso
      </h3>
      {resultado.erros.length > 0 && (
        <div style={{ textAlign: 'left', padding: '12px 14px', background: '#fdecea', borderRadius: 'var(--r-md)', marginBottom: 16, fontSize: 13, color: 'var(--rust)' }}>
          <b>{resultado.erros.length} erro{resultado.erros.length !== 1 ? 's' : ''}:</b>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {resultado.erros.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}
            {resultado.erros.length > 8 && <li style={{ color: 'var(--gray-400)' }}>...e mais {resultado.erros.length - 8}</li>}
          </ul>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        <button className="btn btn-primary" onClick={onClose}>Fechar</button>
        <button className="btn btn-ghost" onClick={() => { setEtapa('upload'); setLinhas([]); setResultado({ ok: 0, erros: [] }) }}>
          Importar mais
        </button>
      </div>
    </div>
  )
}
