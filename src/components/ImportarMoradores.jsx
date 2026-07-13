import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

const S = {
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:9999,
    display:'flex', alignItems:'center', justifyContent:'center', padding:16 },
  box: { background:'#fff', borderRadius:16, width:'100%', maxWidth:680,
    maxHeight:'90vh', overflowY:'auto', padding:'28px 24px', boxShadow:'0 20px 60px rgba(0,0,0,.3)' },
}

function gerarCodAuto(nome, idx) {
  const ini = (nome||'').replace(/[^a-zA-Z]/g,'').slice(0,3).toUpperCase()||'USR'
  return `${ini}${String(idx+1).padStart(3,'0')}`
}

export default function ImportarMoradores({ condominioId, empresaId, onToast, onClose, onSuccess }) {
  const [etapa, setEtapa] = useState('upload')
  const [linhas, setLinhas] = useState([])
  const [importando, setImportando] = useState(false)
  const [progresso, setProgresso] = useState(0)
  const [resultado, setResultado] = useState({ ok:0, erros:[] })
  const inputRef = useRef()

  const baixarTemplate = () => {
    const csv = 'nome,email,bloco,apartamento,codigo_acesso,tipo_ocupacao\nJoão Silva,joao@email.com,Bloco A,101,JOS101,proprietario\nMaria Santos,maria@email.com,Bloco B,202,MAS202,inquilino'
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = 'template_moradores.csv'
    a.click()
  }

  const lerArquivo = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    try {
      const nome = file.name.toLowerCase()
      let dados = []
      if (nome.endsWith('.csv')) {
        const txt = await file.text()
        const linhasRaw = txt.trim().split('\n')
        const headers = linhasRaw[0].split(',').map(h=>h.replace(/"/g,'').trim().toLowerCase())
        dados = linhasRaw.slice(1).map(l=>{
          const cols = l.split(',').map(c=>c.replace(/"/g,'').trim())
          const obj={}; headers.forEach((h,i)=>{ obj[h]=cols[i]||'' }); return obj
        })
      } else {
        const XLSX = await import('xlsx')
        const buf = await file.arrayBuffer()
        const wb = XLSX.read(buf,{type:'array'})
        dados = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''})
      }
      if (!dados.length) { onToast('Arquivo vazio.'); return }
      const norm = dados.map((row,idx)=>{
        const r={}; Object.keys(row).forEach(k=>{ r[k.toLowerCase().trim().replace(/\s+/g,'_').replace(/-/g,'_')]=String(row[k]||'').trim() })
        const nome2=r.nome||r.name||'', email=r.email||r.e_mail||r['e-mail']||''
        return { nome:nome2, email, bloco:r.bloco||r.block||'', apartamento:r.apartamento||r.apto||r.apt||'',
          codigo_acesso:r.codigo_acesso||r.codigo||'',
          tipo_ocupacao:(r.tipo_ocupacao||'').toLowerCase().includes('inq')?'inquilino':'proprietario',
          _idx:idx, _ok:!!(nome2&&email), _erro:!nome2?'Sem nome':!email?'Sem e-mail':'' }
      })
      setLinhas(norm); setEtapa('preview')
    } catch(err) { onToast('Erro ao ler: '+err.message) }
  }

  const importar = async () => {
    const validas = linhas.filter(l=>l._ok)
    if (!validas.length) { onToast('Nenhuma linha válida.'); return }
    setImportando(true); setProgresso(0)
    const { data:s } = await supabase.auth.getSession()
    const token = s?.session?.access_token
    let ok=0; const erros=[]
    for (let i=0;i<validas.length;i++) {
      const l=validas[i]
      const codigo=(l.codigo_acesso||gerarCodAuto(l.nome,i)).toUpperCase()
      try {
        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-actions`,{
          method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
          body:JSON.stringify({ action:'create_user', email:l.email, password:'mudar123', nome:l.nome, papel:'morador',
            empresa_id:empresaId, codigo_acesso:codigo, condominio_id:condominioId,
            bloco:l.bloco, apartamento:l.apartamento, tipo_ocupacao:l.tipo_ocupacao }),
        })
        const j=await resp.json()
        resp.ok ? ok++ : erros.push(`${l.nome}: ${j.error||'falha'}`)
      } catch(err) { erros.push(`${l.nome}: ${err.message}`) }
      setProgresso(Math.round((i+1)/validas.length*100))
    }
    setImportando(false); setResultado({ok,erros}); setEtapa('resultado')
    if (ok>0) { onToast(`${ok} morador${ok!==1?'es':''} importado${ok!==1?'s':''}!`); onSuccess?.() }
  }

  const validas=linhas.filter(l=>l._ok), invalidas=linhas.filter(l=>!l._ok)

  return (
    <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={S.box}>

        {/* ── UPLOAD ── */}
        {etapa==='upload' && <>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
            <div>
              <h3 style={{ fontFamily:'var(--font-display)', fontSize:18, fontWeight:700, color:'var(--navy)', margin:'0 0 4px' }}>
                Importar moradores via planilha
              </h3>
              <p style={{ fontSize:13, color:'var(--gray-400)', margin:0 }}>Aceita Excel (.xlsx) e CSV</p>
            </div>
            <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, color:'var(--gray-400)', cursor:'pointer' }}>✕</button>
          </div>

          <div style={{ background:'#e8f8f0', border:'1.5px dashed #22c55e', borderRadius:12, padding:'14px 18px',
            marginBottom:16, display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:22 }}>📋</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:600, color:'#16a34a', marginBottom:2 }}>Baixe o template CSV primeiro</div>
              <div style={{ fontSize:12, color:'#6b7280' }}>Preencha com os dados dos moradores</div>
            </div>
            <button onClick={baixarTemplate} style={{ padding:'8px 14px', background:'#16a34a', border:'none',
              borderRadius:8, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
              ⬇ Baixar template
            </button>
          </div>

          <div onClick={()=>inputRef.current?.click()}
            style={{ border:'2px dashed #d1d5db', borderRadius:12, padding:'40px 20px', textAlign:'center', cursor:'pointer' }}
            onMouseEnter={e=>e.currentTarget.style.borderColor='#22c55e'}
            onMouseLeave={e=>e.currentTarget.style.borderColor='#d1d5db'}>
            <div style={{ fontSize:36, marginBottom:10 }}>📂</div>
            <div style={{ fontSize:15, fontWeight:600, color:'#4b5563', marginBottom:6 }}>Clique para selecionar o arquivo</div>
            <div style={{ fontSize:12, color:'#9ca3af' }}>Excel (.xlsx, .xls) ou CSV</div>
            <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:'none' }} onChange={lerArquivo}/>
          </div>

          <div style={{ marginTop:12, padding:'10px 14px', background:'#f9fafb', borderRadius:8, fontSize:12, color:'#6b7280' }}>
            Colunas: <b>nome</b>*, <b>email</b>*, bloco, apartamento, codigo_acesso, tipo_ocupacao
            <br/>Senha padrão: <b>mudar123</b> — trocada no 1º acesso.
          </div>
        </>}

        {/* ── PREVIEW ── */}
        {etapa==='preview' && <>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <div>
              <h3 style={{ margin:'0 0 4px', fontFamily:'var(--font-display)', fontSize:18, fontWeight:700, color:'var(--navy)' }}>
                Preview — {linhas.length} linha{linhas.length!==1?'s':''}
              </h3>
              <div style={{ display:'flex', gap:12, fontSize:13 }}>
                <span style={{ color:'#16a34a', fontWeight:700 }}>✅ {validas.length} válida{validas.length!==1?'s':''}</span>
                {invalidas.length>0&&<span style={{ color:'#dc2626', fontWeight:700 }}>⚠ {invalidas.length} com erro</span>}
              </div>
            </div>
            <button onClick={()=>setEtapa('upload')} style={{ background:'#f3f4f6', border:'none', borderRadius:8,
              padding:'7px 14px', fontSize:13, fontWeight:600, color:'#4b5563', cursor:'pointer' }}>
              ← Trocar arquivo
            </button>
          </div>

          <div style={{ border:'1px solid #e5e7eb', borderRadius:10, overflow:'hidden', marginBottom:16 }}>
            <div style={{ overflowX:'auto', maxHeight:280, overflowY:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background:'#f9fafb', borderBottom:'1px solid #e5e7eb' }}>
                    {['Status','Nome','E-mail','Bloco','Apto','Código','Tipo'].map(h=>(
                      <th key={h} style={{ padding:'7px 10px', textAlign:'left', fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l,i)=>(
                    <tr key={i} style={{ borderBottom:'1px solid #f3f4f6', background:l._ok?'transparent':'rgba(239,68,68,.04)' }}>
                      <td style={{ padding:'7px 10px' }}>
                        {l._ok ? <span style={{ color:'#16a34a', fontSize:15 }}>✓</span>
                          : <span style={{ color:'#dc2626', fontSize:11, fontWeight:700 }}>⚠ {l._erro}</span>}
                      </td>
                      <td style={{ padding:'7px 10px', fontWeight:500, color:'#374151' }}>{l.nome||'—'}</td>
                      <td style={{ padding:'7px 10px', color:'#6b7280' }}>{l.email||'—'}</td>
                      <td style={{ padding:'7px 10px', color:'#9ca3af' }}>{l.bloco||'—'}</td>
                      <td style={{ padding:'7px 10px', color:'#9ca3af' }}>{l.apartamento||'—'}</td>
                      <td style={{ padding:'7px 10px', color:'#2843ad', fontFamily:'monospace', fontSize:11 }}>
                        {(l.codigo_acesso||gerarCodAuto(l.nome,i)).toUpperCase()}
                      </td>
                      <td style={{ padding:'7px 10px', fontSize:11, color:'#6b7280' }}>
                        {l.tipo_ocupacao==='inquilino'?'🔑 Inquilino':'🏠 Proprietário'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {importando && (
            <div style={{ marginBottom:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#6b7280', marginBottom:4 }}>
                <span>Importando...</span><span>{progresso}%</span>
              </div>
              <div style={{ height:6, background:'#e5e7eb', borderRadius:3 }}>
                <div style={{ height:'100%', width:`${progresso}%`, background:'#16a34a', borderRadius:3, transition:'width .3s' }}/>
              </div>
            </div>
          )}

          {validas.length>0&&(
            <button onClick={importar} disabled={importando}
              style={{ width:'100%', padding:'13px', background:'#2843ad', border:'none', borderRadius:10,
                color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer', opacity:importando?.6:1 }}>
              {importando?`Importando... ${progresso}%`:`Importar ${validas.length} morador${validas.length!==1?'es':''}`}
            </button>
          )}
        </>}

        {/* ── RESULTADO ── */}
        {etapa==='resultado' && (
          <div style={{ textAlign:'center', padding:'16px 0' }}>
            <div style={{ fontSize:52, marginBottom:12 }}>{resultado.ok>0?'✅':'❌'}</div>
            <h3 style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:700, color:'var(--navy)', margin:'0 0 8px' }}>
              {resultado.ok} morador{resultado.ok!==1?'es':''} importado{resultado.ok!==1?'s':''}
            </h3>
            {resultado.erros.length>0&&(
              <div style={{ textAlign:'left', padding:'12px 14px', background:'#fef2f2', borderRadius:10, marginBottom:16, fontSize:13, color:'#dc2626' }}>
                <b>{resultado.erros.length} erro{resultado.erros.length!==1?'s':''}:</b>
                <ul style={{ margin:'6px 0 0', paddingLeft:18 }}>
                  {resultado.erros.slice(0,8).map((e,i)=><li key={i}>{e}</li>)}
                  {resultado.erros.length>8&&<li style={{ color:'#9ca3af' }}>...e mais {resultado.erros.length-8}</li>}
                </ul>
              </div>
            )}
            <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
              <button onClick={onClose} style={{ padding:'10px 24px', background:'#2843ad', border:'none', borderRadius:8, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}>
                Fechar
              </button>
              <button onClick={()=>{setEtapa('upload');setLinhas([]);setResultado({ok:0,erros:[]})}}
                style={{ padding:'10px 24px', background:'#f3f4f6', border:'none', borderRadius:8, color:'#4b5563', fontSize:14, fontWeight:600, cursor:'pointer' }}>
                Importar mais
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
