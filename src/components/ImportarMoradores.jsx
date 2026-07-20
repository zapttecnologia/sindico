import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Modal from './Modal'

const SENHA_PADRAO = 'mudar123'

// Iniciais do condomínio: "Parque dos Passaros" -> "PDP" (palavras com +2 letras)
const iniciaisCondo = (nome) =>
  (nome || '').split(' ').filter(w => w.length > 2).map(w => w[0]).join('').toUpperCase().slice(0, 3)

// "00021C" -> { bloco:'C', apto:'21' }  (tira zeros à esquerda)
const parseUnidade = (u) => {
  const s = String(u || '').trim()
  const m = s.match(/^(\d+)([A-Za-z]*)$/)
  if (!m) return { bloco: '', apto: s }
  return { bloco: (m[2] || '').toUpperCase(), apto: String(parseInt(m[1], 10) || m[1]) }
}

// Parser de CSV simples e robusto (lida com aspas e vírgula dentro de aspas)
function parseCSV(texto) {
  const linhas = []
  let campo = '', linha = [], dentroAspas = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i], prox = texto[i + 1]
    if (dentroAspas) {
      if (c === '"' && prox === '"') { campo += '"'; i++ }
      else if (c === '"') dentroAspas = false
      else campo += c
    } else {
      if (c === '"') dentroAspas = true
      else if (c === ',' || c === ';') { linha.push(campo); campo = '' }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && prox === '\n') i++
        if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); linha = []; campo = '' }
      } else campo += c
    }
  }
  if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha) }
  return linhas
}

// Detecta o índice de uma coluna por nomes possíveis (case/acento-insensitive)
const achaCol = (cabec, nomes) => {
  const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  const c = cabec.map(norm)
  for (const n of nomes) { const i = c.indexOf(norm(n)); if (i >= 0) return i }
  return -1
}

const emailValido = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(e || '').trim())

export default function ImportarMoradores({ condominioId, empresaId, onToast, onClose, onSuccess }) {
  const [condoNome, setCondoNome] = useState('')
  const [preview, setPreview] = useState(null)   // { validos:[], resumo:{} }
  const [processando, setProcessando] = useState(false)
  const [progresso, setProgresso] = useState({ feito: 0, total: 0 })
  const [resultado, setResultado] = useState(null) // { criados, erros:[] }

  useEffect(() => {
    supabase.from('condominios').select('nome').eq('id', condominioId).single()
      .then(({ data }) => setCondoNome(data?.nome || ''))
  }, [condominioId])

  const api = async (body) => {
    const { data: s } = await supabase.auth.getSession()
    const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session?.access_token}` },
      body: JSON.stringify(body),
    })
    const json = await r.json()
    if (!r.ok) throw new Error(json.error || 'Erro')
    return json
  }

    const aoSubirArquivo = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setResultado(null)

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const linhas = parseCSV(String(reader.result))
        if (linhas.length < 2) { onToast('Arquivo vazio ou sem dados.'); return }
        const cab = linhas[0]
        const iPessoa = achaCol(cab, ['pessoa', 'nome'])
        const iUnidade = achaCol(cab, ['nomeUnidade', 'unidade'])
        const iTipo = achaCol(cab, ['tipo'])
        const iTel = achaCol(cab, ['telefone', 'celular'])
        const iEmail = achaCol(cab, ['email', 'e-mail'])
        const iStatus = achaCol(cab, ['status'])

        if (iPessoa < 0 || iUnidade < 0) {
          onToast('Não encontrei as colunas obrigatórias (pessoa e unidade). Confira o cabeçalho.')
          return
        }

        const ini = iniciaisCondo(condoNome)
        const registros = []
        for (let l = 1; l < linhas.length; l++) {
          const row = linhas[l]
          if (!row || !row[iPessoa]?.trim()) continue
          const status = iStatus >= 0 ? String(row[iStatus] || '').trim().toLowerCase() : 'ativo'
          if (status && status !== 'ativo') continue  // só ativos

          const nome = row[iPessoa].trim()
          const { bloco, apto } = parseUnidade(row[iUnidade])
          const tipoRaw = iTipo >= 0 ? String(row[iTipo] || '').trim().toLowerCase() : ''
          const ehProprietario = tipoRaw.startsWith('propriet')
          const email = iEmail >= 0 ? String(row[iEmail] || '').trim() : ''
          const telefone = iTel >= 0 ? String(row[iTel] || '').replace(/\D/g, '') : ''

          registros.push({ nome, bloco, apto, unidade: `${bloco}-${apto}`, ehProprietario, email, telefone })
        }

        // 1 por unidade: prioriza proprietário com e-mail > proprietário > com e-mail > qualquer
        const prio = (r) => (r.ehProprietario && emailValido(r.email)) ? 0 : r.ehProprietario ? 1 : emailValido(r.email) ? 2 : 3
        const porUnidade = {}
        for (const r of registros) {
          const k = r.unidade
          if (!porUnidade[k] || prio(r) < prio(porUnidade[k])) porUnidade[k] = r
        }
        const escolhidos = Object.values(porUnidade)

        // Gera código de acesso (ini + bloco + apto). Sem colisão porque é 1 por unidade.
        for (const r of escolhidos) {
          r.codigo = `${ini}${r.bloco}${r.apto}`.slice(0, 12)
          r.tipo_ocupacao = r.ehProprietario ? 'proprietario' : 'inquilino'
          r.temEmail = emailValido(r.email)
        }
        escolhidos.sort((a, b) => (a.bloco + a.apto).localeCompare(b.bloco + b.apto))

        setPreview({
          validos: escolhidos,
          resumo: {
            totalLinhas: registros.length,
            unidades: escolhidos.length,
            comEmail: escolhidos.filter(r => r.temEmail).length,
            semEmail: escolhidos.filter(r => !r.temEmail).length,
            descartadosDuplicidade: registros.length - escolhidos.length,
          },
        })
      } catch (err) {
        onToast('Erro ao ler o arquivo: ' + err.message)
      }
    }
    reader.readAsText(file, 'UTF-8')
    e.target.value = ''
  }

  const importar = async () => {
    if (!preview?.validos?.length) return
    setProcessando(true)
    setProgresso({ feito: 0, total: preview.validos.length })
    const erros = []
    let criados = 0

    for (let i = 0; i < preview.validos.length; i++) {
      const r = preview.validos[i]
      try {
        // Sem e-mail: cria um e-mail interno placeholder para permitir o cadastro
        const emailUso = r.temEmail ? r.email : `${r.codigo.toLowerCase()}@sem-email.local`
        await api({
          action: 'create_user',
          email: emailUso,
          password: SENHA_PADRAO,
          nome: r.nome,
          telefone: r.telefone || '',
          codigo_acesso: r.codigo,
          papel: 'morador',
          condominio_id: condominioId,
          bloco: r.bloco,
          apartamento: r.apto,
          tipo_ocupacao: r.tipo_ocupacao,
        })
        criados++
      } catch (err) {
        erros.push({ nome: r.nome, unidade: r.unidade, motivo: err.message })
      }
      setProgresso({ feito: i + 1, total: preview.validos.length })
    }

    setProcessando(false)
    setResultado({ criados, erros })
    setPreview(null)
    onToast(`Importação concluída: ${criados} criados${erros.length ? `, ${erros.length} com erro` : ''}.`)
    onSuccess?.()
  }

  return (
    <Modal open onClose={onClose} title="Importar moradores" size="xl">
      <p style={{ fontSize:13, color:'var(--gray-400)', margin:'0 0 16px' }}>
        Suba um arquivo CSV para cadastrar vários moradores de uma vez em <b>{condoNome}</b>.
      </p>

      {/* Passo: arquivo */}
      {!preview && !processando && !resultado && (
        <div className="card" style={{ marginTop:4 }}>
          <label style={{ fontSize:13, fontWeight:600, color:'var(--gray-600)', display:'block', marginBottom:8 }}>
            Arquivo CSV
          </label>
          <input type="file" accept=".csv,text/csv" onChange={aoSubirArquivo} style={{ fontSize:13 }} />
          <div style={{ fontSize:12, color:'var(--gray-400)', marginTop:10, lineHeight:1.6 }}>
            O arquivo deve ter as colunas: <b>pessoa</b>, <b>nomeUnidade</b>, <b>tipo</b>, <b>telefone</b>, <b>email</b>, <b>status</b>.<br/>
            No Excel: Arquivo → Salvar como → <b>CSV (separado por vírgulas)</b>.<br/>
            Regras aplicadas: só moradores <b>Ativos</b>, <b>uma conta por unidade</b> (priorizando o proprietário), senha inicial padrão.
          </div>
        </div>
      )}

      {/* Passo 3: preview */}
      {preview && !processando && (
        <div style={{ marginTop:16 }}>
          <div className="card" style={{ background:'#f0f9ff', border:'1px solid #bae6fd' }}>
            <div style={{ fontSize:14, fontWeight:700, color:'var(--navy)', marginBottom:10 }}>Confira antes de importar</div>
            <div style={{ display:'flex', gap:20, flexWrap:'wrap', fontSize:13 }}>
              <div><b style={{ fontSize:22, color:'var(--blue)' }}>{preview.resumo.unidades}</b><br/>serão criados</div>
              <div><b style={{ fontSize:22, color:'var(--emerald)' }}>{preview.resumo.comEmail}</b><br/>com e-mail</div>
              <div><b style={{ fontSize:22, color:'var(--amber)' }}>{preview.resumo.semEmail}</b><br/>sem e-mail</div>
              <div><b style={{ fontSize:22, color:'var(--gray-400)' }}>{preview.resumo.descartadosDuplicidade}</b><br/>descartados (mesma unidade)</div>
            </div>
          </div>

          <div className="card" style={{ marginTop:12, maxHeight:340, overflow:'auto', padding:0 }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ position:'sticky', top:0, background:'#fff', borderBottom:'2px solid var(--gray-100)' }}>
                  <th style={{ textAlign:'left', padding:'10px' }}>Nome</th>
                  <th style={{ textAlign:'left', padding:'10px' }}>Bloco</th>
                  <th style={{ textAlign:'left', padding:'10px' }}>Apto</th>
                  <th style={{ textAlign:'left', padding:'10px' }}>Código</th>
                  <th style={{ textAlign:'left', padding:'10px' }}>E-mail</th>
                </tr>
              </thead>
              <tbody>
                {preview.validos.map((r,i)=>(
                  <tr key={i} style={{ borderBottom:'1px solid var(--gray-50)' }}>
                    <td style={{ padding:'8px 10px' }}>{r.nome}</td>
                    <td style={{ padding:'8px 10px' }}>{r.bloco||'-'}</td>
                    <td style={{ padding:'8px 10px' }}>{r.apto||'-'}</td>
                    <td style={{ padding:'8px 10px', fontFamily:'var(--font-mono)', fontWeight:700 }}>{r.codigo}</td>
                    <td style={{ padding:'8px 10px', color: r.temEmail?'var(--gray-600)':'var(--amber)' }}>
                      {r.temEmail ? r.email : '— sem e-mail'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display:'flex', gap:10, marginTop:14 }}>
            <button className="btn" style={{ background:'var(--gray-100)', color:'var(--gray-600)', border:'none' }}
              onClick={()=>setPreview(null)}>Cancelar</button>
            <button className="btn btn-primary" onClick={importar}>
              Importar {preview.resumo.unidades} moradores
            </button>
          </div>
        </div>
      )}

      {/* Processando */}
      {processando && (
        <div className="card" style={{ marginTop:16, textAlign:'center', padding:'30px 20px' }}>
          <div style={{ fontSize:15, fontWeight:700, color:'var(--navy)', marginBottom:12 }}>
            Importando... {progresso.feito} de {progresso.total}
          </div>
          <div style={{ height:10, background:'var(--gray-100)', borderRadius:'var(--r-full)', overflow:'hidden' }}>
            <div style={{ height:'100%', background:'var(--blue)', width:`${(progresso.feito/progresso.total)*100}%`, transition:'width .2s' }} />
          </div>
          <div style={{ fontSize:12, color:'var(--gray-400)', marginTop:10 }}>Não feche esta janela até concluir.</div>
        </div>
      )}

      {/* Resultado */}
      {resultado && (
        <div className="card" style={{ marginTop:16 }}>
          <div style={{ fontSize:16, fontWeight:700, color:'var(--navy)', marginBottom:8 }}>
            ✅ {resultado.criados} moradores criados
          </div>
          {resultado.erros.length > 0 ? (
            <>
              <div style={{ fontSize:13, color:'var(--rust)', fontWeight:600, margin:'10px 0 6px' }}>
                {resultado.erros.length} não puderam ser criados:
              </div>
              <div style={{ maxHeight:200, overflow:'auto', fontSize:12, color:'var(--gray-600)' }}>
                {resultado.erros.map((e,i)=>(
                  <div key={i} style={{ padding:'4px 0', borderBottom:'1px solid var(--gray-50)' }}>
                    <b>{e.nome}</b> (un. {e.unidade}) — {e.motivo}
                  </div>
                ))}
              </div>
              <div style={{ fontSize:12, color:'var(--gray-400)', marginTop:8 }}>
                Erros comuns: e-mail já cadastrado no sistema, ou código de acesso repetido. Você pode cadastrar esses manualmente.
              </div>
            </>
          ) : (
            <div style={{ fontSize:13, color:'var(--emerald)' }}>Todos importados com sucesso!</div>
          )}
          <button className="btn btn-primary" style={{ marginTop:14 }} onClick={onClose}>
            Nova importação
          </button>
        </div>
      )}
    </Modal>
  )
}
