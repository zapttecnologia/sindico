import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'

const COLUNAS = ['nome','email','bloco','apartamento','codigo_acesso','tipo_ocupacao']
const COLUNAS_LABEL = { nome:'Nome', email:'E-mail', bloco:'Bloco', apartamento:'Apartamento', codigo_acesso:'Código de acesso', tipo_ocupacao:'Tipo (proprietario/inquilino)' }

function gerarCodigo(nome, idx) {
  const iniciais = (nome||'').replace(/[^a-zA-Z]/g,'').slice(0,3).toUpperCase() || 'USR'
  return `${iniciais}${String(idx+1).padStart(3,'0')}`
}

export default function ImportarMoradores({ condominioId, empresaId, onToast, onClose, onSuccess }) {
  const [linhas, setLinhas] = useState([])
  const [importando, setImportando] = useState(false)
  const [progresso, setProgresso] = useState(0)
  const [resultado, setResultado] = useState(null)
  const inputRef = useRef()

  const baixarTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['nome','email','bloco','apartamento','codigo_acesso','tipo_ocupacao'],
      ['João Silva','joao@email.com','Bloco A','101','JOS101','proprietario'],
      ['Maria Santos','maria@email.com','Bloco B','202','MAS202','inquilino'],
    ])
    ws['!cols'] = COLUNAS.map(()=>({ wch:22 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Moradores')
    XLSX.writeFile(wb, 'template_moradores.xlsx')
  }

  const lerArquivo = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type:'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json(ws, { defval:'' })
        if (!data.length) { onToast('Planilha vazia.'); return }
        // Normalizar colunas (case insensitive)
        const norm = data.map((row, idx) => {
          const r = {}
          Object.keys(row).forEach(k => {
            const kl = k.toLowerCase().trim().replace(/ /g,'_')
            r[kl] = String(row[k]).trim()
          })
          return {
            nome: r.nome || r.name || '',
            email: r.email || r['e-mail'] || r['e_mail'] || '',
            bloco: r.bloco || r.block || '',
            apartamento: r.apartamento || r.apto || r.apt || r.unidade || '',
            codigo_acesso: r.codigo_acesso || r.codigo || r.code || '',
            tipo_ocupacao: (r.tipo_ocupacao||r.tipo||'proprietario').toLowerCase().includes('inq') ? 'inquilino' : 'proprietario',
            _linha: idx + 2,
            _ok: !!(r.nome||r.name) && !!(r.email||r['e-mail']||r['e_mail']),
          }
        })
        setLinhas(norm)
        setResultado(null)
      } catch(err) { onToast('Erro ao ler arquivo: '+err.message) }
    }
    reader.readAsBinaryString(file)
    e.target.value = ''
  }

  const importar = async () => {
    const validas = linhas.filter(l => l._ok)
    if (!validas.length) { onToast('Nenhuma linha válida para importar.'); return }
    setImportando(true)
    setProgresso(0)
    const sess = (await supabase.auth.getSession()).data.session
    let ok = 0, erros = []

    for (let i = 0; i < validas.length; i++) {
      const l = validas[i]
      const codigo = l.codigo_acesso || gerarCodigo(l.nome, i)
      try {
        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-actions`, {
          method: 'POST',
          headers: { 'Content-Type':'application/json', Authorization:`Bearer ${sess?.access_token}` },
          body: JSON.stringify({
            action: 'create_user',
            email: l.email,
            password: 'mudar123',
            nome: l.nome,
            papel: 'morador',
            empresa_id: empresaId,
            codigo_acesso: codigo.toUpperCase(),
            condominio_id: condominioId,
            bloco: l.bloco,
            apartamento: l.apartamento,
            tipo_ocupacao: l.tipo_ocupacao,
          }),
        })
        if (resp.ok) { ok++ }
        else { const j = await resp.json(); erros.push(`Linha ${l._linha}: ${j.error||'falha'}`) }
      } catch(err) { erros.push(`Linha ${l._linha}: ${err.message}`) }
      setProgresso(Math.round((i+1)/validas.length*100))
    }

    setImportando(false)
    setResultado({ ok, erros })
    if (ok > 0) { onSuccess?.(); onToast(`${ok} morador${ok!==1?'es':''} importado${ok!==1?'s':''}!`) }
  }

  const validas = linhas.filter(l=>l._ok)
  const invalidas = linhas.filter(l=>!l._ok)

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h3 style={{ fontFamily:'var(--font-display)', fontSize:18, fontWeight:700, color:'var(--navy)', margin:'0 0 4px' }}>
            Importar moradores via Excel
          </h3>
          <p style={{ fontSize:13, color:'var(--gray-400)', margin:0 }}>
            Importe vários moradores de uma vez com uma planilha
          </p>
        </div>
        <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, color:'var(--gray-400)', cursor:'pointer' }}>✕</button>
      </div>

      {!linhas.length && !resultado && (
        <div>
          {/* Baixar template */}
          <div style={{ background:'var(--mint)', border:'1.5px dashed var(--emerald)', borderRadius:'var(--r-lg)',
            padding:'16px 20px', marginBottom:16, display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:24 }}>📋</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:600, color:'var(--emerald)', marginBottom:2 }}>
                Baixe o template primeiro
              </div>
              <div style={{ fontSize:12, color:'var(--gray-400)' }}>
                Preencha com os dados dos moradores e importe
              </div>
            </div>
            <button onClick={baixarTemplate}
              style={{ padding:'8px 16px', background:'var(--emerald)', border:'none', borderRadius:'var(--r-md)',
                color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
              ⬇ Baixar template
            </button>
          </div>

          {/* Upload */}
          <div onClick={()=>inputRef.current.click()}
            style={{ border:'2px dashed var(--gray-200)', borderRadius:'var(--r-lg)', padding:'36px 20px',
              textAlign:'center', cursor:'pointer', transition:'all .15s' }}
            onMouseEnter={e=>e.currentTarget.style.borderColor='var(--emerald)'}
            onMouseLeave={e=>e.currentTarget.style.borderColor='var(--gray-200)'}>
            <div style={{ fontSize:32, marginBottom:8 }}>📂</div>
            <div style={{ fontSize:15, fontWeight:600, color:'var(--gray-600)', marginBottom:4 }}>
              Clique para selecionar o arquivo
            </div>
            <div style={{ fontSize:12, color:'var(--gray-400)' }}>Excel (.xlsx, .xls) ou CSV</div>
            <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:'none' }} onChange={lerArquivo}/>
          </div>

          {/* Colunas aceitas */}
          <div style={{ marginTop:16, padding:'12px 14px', background:'var(--gray-50)', borderRadius:'var(--r-md)' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>
              Colunas reconhecidas:
            </div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {COLUNAS.map(c=>(
                <span key={c} style={{ fontSize:11, padding:'2px 8px', background:'var(--gray-100)', borderRadius:5,
                  fontFamily:'monospace', color:'var(--gray-600)' }}>
                  {c}{['nome','email'].includes(c)?<span style={{ color:'var(--rust)' }}>*</span>:''}
                </span>
              ))}
            </div>
            <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:6 }}>
              * obrigatórios · Senha padrão: <b>mudar123</b> (trocada no 1º acesso) · Código gerado automaticamente se não informado
            </div>
          </div>
        </div>
      )}

      {/* Preview */}
      {linhas.length > 0 && !resultado && (
        <div>
          <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
            <span style={{ fontSize:14, fontWeight:600, color:'var(--gray-700)' }}>
              {linhas.length} linha{linhas.length!==1?'s':''} encontrada{linhas.length!==1?'s':''} —
            </span>
            <span style={{ color:'var(--emerald)', fontWeight:700 }}>✅ {validas.length} válida{validas.length!==1?'s':''}</span>
            {invalidas.length>0&&<span style={{ color:'var(--rust)', fontWeight:700 }}>⚠ {invalidas.length} com erro</span>}
            <button onClick={()=>{setLinhas([]);setResultado(null)}} style={{ marginLeft:'auto', background:'none', border:'1px solid var(--gray-200)', borderRadius:'var(--r-sm)', padding:'4px 10px', fontSize:12, color:'var(--gray-400)', cursor:'pointer' }}>
              Trocar arquivo
            </button>
          </div>

          <div style={{ border:'1px solid var(--gray-200)', borderRadius:'var(--r-lg)', overflow:'hidden', marginBottom:16 }}>
            <div style={{ overflowX:'auto', maxHeight:280, overflowY:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background:'var(--gray-50)', borderBottom:'1px solid var(--gray-200)', position:'sticky', top:0 }}>
                    {['#','Status','Nome','E-mail','Bloco','Apto','Código','Tipo'].map(h=>(
                      <th key={h} style={{ padding:'7px 10px', textAlign:'left', fontSize:10, fontWeight:700,
                        color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.04em', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l,i)=>(
                    <tr key={i} style={{ borderBottom:'1px solid var(--gray-100)',
                      background:l._ok?'transparent':'rgba(239,68,68,.04)' }}>
                      <td style={{ padding:'6px 10px', color:'var(--gray-400)' }}>{l._linha}</td>
                      <td style={{ padding:'6px 10px' }}>
                        {l._ok
                          ? <span style={{ color:'var(--emerald)', fontWeight:700, fontSize:13 }}>✓</span>
                          : <span style={{ color:'var(--rust)', fontSize:11, fontWeight:700 }}>⚠ {!l.nome?'sem nome':'sem e-mail'}</span>
                        }
                      </td>
                      <td style={{ padding:'6px 10px', color:'var(--gray-700)', fontWeight:500 }}>{l.nome||'—'}</td>
                      <td style={{ padding:'6px 10px', color:'var(--gray-500)' }}>{l.email||'—'}</td>
                      <td style={{ padding:'6px 10px', color:'var(--gray-500)' }}>{l.bloco||'—'}</td>
                      <td style={{ padding:'6px 10px', color:'var(--gray-500)' }}>{l.apartamento||'—'}</td>
                      <td style={{ padding:'6px 10px', color:'var(--navy)', fontFamily:'monospace', fontSize:11 }}>
                        {l.codigo_acesso || gerarCodigo(l.nome, i)}
                      </td>
                      <td style={{ padding:'6px 10px', fontSize:11, color:'var(--gray-400)' }}>
                        {l.tipo_ocupacao==='inquilino'?'🔑 Inquilino':'🏠 Proprietário'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Barra de progresso */}
          {importando && (
            <div style={{ marginBottom:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--gray-400)', marginBottom:4 }}>
                <span>Importando...</span><span>{progresso}%</span>
              </div>
              <div style={{ height:6, background:'var(--gray-100)', borderRadius:3 }}>
                <div style={{ height:'100%', width:`${progresso}%`, background:'var(--emerald)', borderRadius:3, transition:'width .3s' }}/>
              </div>
            </div>
          )}

          {validas.length > 0 && (
            <button className="btn btn-primary btn-block" onClick={importar} disabled={importando} style={{ fontSize:14 }}>
              {importando ? `Importando... ${progresso}%` : `Importar ${validas.length} morador${validas.length!==1?'es':''}`}
            </button>
          )}
        </div>
      )}

      {/* Resultado */}
      {resultado && (
        <div>
          <div style={{ textAlign:'center', padding:'24px 0' }}>
            <div style={{ fontSize:40, marginBottom:8 }}>{resultado.ok>0?'✅':'❌'}</div>
            <div style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:700, color:'var(--navy)', marginBottom:4 }}>
              {resultado.ok} morador{resultado.ok!==1?'es':''} importado{resultado.ok!==1?'s':''}
            </div>
            {resultado.erros.length>0&&(
              <div style={{ fontSize:13, color:'var(--rust)', marginTop:8 }}>
                {resultado.erros.length} erro{resultado.erros.length!==1?'s':''}:
                <ul style={{ textAlign:'left', marginTop:6, paddingLeft:20 }}>
                  {resultado.erros.slice(0,5).map((e,i)=><li key={i} style={{ fontSize:12 }}>{e}</li>)}
                </ul>
              </div>
            )}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-primary btn-block" onClick={onClose}>Fechar</button>
            <button className="btn btn-ghost btn-block" onClick={()=>{setLinhas([]);setResultado(null)}}>Importar mais</button>
          </div>
        </div>
      )}
    </div>
  )
}
