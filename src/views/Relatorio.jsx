import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { STATUS_LABEL, DEPARTAMENTOS, fmtDate } from '../lib/constants'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const hoje = new Date()

export default function Relatorio({ onToast }) {
  const { perfil } = useAuth()
  const [condominios, setCondominios] = useState([])
  const [categoriasSistema, setCategoriasSistema] = useState([])
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(false)
  const [gerandoPDF, setGerandoPDF] = useState(false)

  // Filtros
  const [mes, setMes] = useState(hoje.getMonth())
  const [ano, setAno] = useState(hoje.getFullYear())
  const [condoFiltro, setCondoFiltro] = useState('todos')
  const [catFiltro, setCatFiltro] = useState('todas')
  const [subFiltro, setSubFiltro] = useState('todas')
  const [statusFiltro, setStatusFiltro] = useState('todos')
  const ehAdmin = perfil?.papel === 'admin'

  useEffect(() => {
    const carregarCondos = async () => {
      if (ehAdmin) {
        const { data } = await supabase.from('condominios').select('id,nome').order('nome')
        if (data) setCondominios(data)
      } else {
        const { data } = await supabase.from('sindico_condominios')
          .select('condominio_id,condominios(nome)').eq('perfil_id', perfil?.id)
        if (data) setCondominios(data.map(r=>({ id:r.condominio_id, nome:r.condominios?.nome||'' })))
      }
    }
    carregarCondos()
    supabase.from('categorias_sistema').select('nome').eq('ativo', true).order('ordem')
      .then(({ data }) => { if (data) setCategoriasSistema(data) })
  }, [])

  const buscarDados = async () => {
    setLoading(true)
    const inicioMes = new Date(ano, mes, 1).toISOString()
    const fimMes = new Date(ano, mes+1, 0, 23, 59, 59).toISOString()

    let q = supabase.from('solicitacoes')
      .select('*, condominios(nome), perfis_atribuido:atribuido_para(nome)')
      .gte('criado_em', inicioMes)
      .lte('criado_em', fimMes)
      .order('criado_em', { ascending:false })

    if (condoFiltro !== 'todos') q = q.eq('condominio_id', condoFiltro)
    if (catFiltro !== 'todas') q = q.eq('categoria', catFiltro)
    if (subFiltro !== 'todas') q = q.eq('subcategoria', subFiltro)
    if (statusFiltro !== 'todos') q = q.eq('status', statusFiltro)

    const { data } = await q
    setTickets(data || [])
    setLoading(false)
  }

  useEffect(() => { buscarDados() }, [mes, ano, condoFiltro, catFiltro, subFiltro, statusFiltro])

  // Stats rápidos
  const stats = {
    total:     tickets.length,
    recebido:  tickets.filter(t=>t.status==='recebido').length,
    andamento: tickets.filter(t=>t.status==='andamento').length,
    concluido: tickets.filter(t=>t.status==='concluido').length,
  }

  const nomeCondo = condominios.find(c=>c.id===condoFiltro)?.nome || 'Todos os condomínios'
  const periodoLabel = `${MESES[mes]}/${ano}`

  const gerarPDF = async () => {
    if (!tickets.length) { onToast('Nenhum dado para gerar relatório.'); return }
    setGerandoPDF(true)
    try {
      const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' })
      const W = doc.internal.pageSize.getWidth()

      // ── Cabeçalho ──────────────────────────────────────────
      doc.setFillColor(40, 67, 173) // #2843ad
      doc.rect(0, 0, W, 38, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text('Portal de Chamados', 14, 16)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.text('Relatório Mensal de Chamados', 14, 24)
      doc.text(`${periodoLabel}  |  ${nomeCondo}`, 14, 31)
      doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, W-14, 31, { align:'right' })

      // ── KPIs ───────────────────────────────────────────────
      let y = 48
      doc.setTextColor(30, 30, 30)
      const kpiItems = [
        { l:'Total', v:stats.total, c:[40,67,173] },
        { l:'Recebidos', v:stats.recebido, c:[244,163,64] },
        { l:'Em andamento', v:stats.andamento, c:[40,67,173] },
        { l:'Concluídos', v:stats.concluido, c:[34,197,94] },
      ]
      const kpiW = (W - 28) / 4
      kpiItems.forEach((k, i) => {
        const x = 14 + i * (kpiW + 2)
        doc.setFillColor(245, 247, 255)
        doc.roundedRect(x, y, kpiW, 20, 3, 3, 'F')
        doc.setFontSize(18)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...k.c)
        doc.text(String(k.v), x + kpiW/2, y + 11, { align:'center' })
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(120, 120, 120)
        doc.text(k.l.toUpperCase(), x + kpiW/2, y + 17, { align:'center' })
      })

      // ── Por categoria ──────────────────────────────────────
      y += 30
      const catMap = {}
      tickets.forEach(t => { catMap[t.categoria]=(catMap[t.categoria]||0)+1 })
      const catData = Object.entries(catMap).sort((a,b)=>b[1]-a[1])
      if (catData.length) {
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(40, 67, 173)
        doc.text('Por Categoria', 14, y)
        y += 4
        autoTable(doc, {
          startY: y,
          head: [['Categoria', 'Qtd', '%']],
          body: catData.map(([cat,qtd])=>[cat, qtd, `${Math.round(qtd/stats.total*100)}%`]),
          theme:'striped',
          headStyles:{ fillColor:[40,67,173], textColor:255, fontStyle:'bold', fontSize:9 },
          bodyStyles:{ fontSize:9 },
          columnStyles:{ 1:{ halign:'center' }, 2:{ halign:'center' } },
          margin:{ left:14, right:14 },
        })
        y = doc.lastAutoTable.finalY + 8
      }

      // ── Por subcategoria ───────────────────────────────────
      const subMap = {}
      tickets.forEach(t => { if (t.subcategoria) subMap[t.subcategoria]=(subMap[t.subcategoria]||0)+1 })
      const subData = Object.entries(subMap).sort((a,b)=>b[1]-a[1])
      if (subData.length) {
        if (y > 240) { doc.addPage(); y = 20 }
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(40, 67, 173)
        doc.text('Por Subcategoria', 14, y)
        y += 4
        autoTable(doc, {
          startY: y,
          head: [['Subcategoria', 'Qtd', '%']],
          body: subData.map(([sub,qtd])=>[sub, qtd, `${Math.round(qtd/stats.total*100)}%`]),
          theme:'striped',
          headStyles:{ fillColor:[67,56,202], textColor:255, fontStyle:'bold', fontSize:9 },
          bodyStyles:{ fontSize:9 },
          columnStyles:{ 1:{ halign:'center' }, 2:{ halign:'center' } },
          margin:{ left:14, right:14 },
        })
        y = doc.lastAutoTable.finalY + 8
      }

      // ── Por condomínio (se geral) ──────────────────────────
      if (condoFiltro === 'todos' && condominios.length > 1) {
        const condoMap = {}
        tickets.forEach(t => { condoMap[t.condominios?.nome||'?']=(condoMap[t.condominios?.nome||'?']||0)+1 })
        const condoData = Object.entries(condoMap).sort((a,b)=>b[1]-a[1])
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(40, 67, 173)
        doc.text('Por Condomínio', 14, y)
        y += 4
        autoTable(doc, {
          startY: y,
          head: [['Condomínio', 'Qtd', '%']],
          body: condoData.map(([c,q])=>[c, q, `${Math.round(q/stats.total*100)}%`]),
          theme:'striped',
          headStyles:{ fillColor:[40,67,173], textColor:255, fontStyle:'bold', fontSize:9 },
          bodyStyles:{ fontSize:9 },
          columnStyles:{ 1:{ halign:'center' }, 2:{ halign:'center' } },
          margin:{ left:14, right:14 },
        })
        y = doc.lastAutoTable.finalY + 8
      }

      // ── Lista completa de chamados ─────────────────────────
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(40, 67, 173)
      doc.text('Lista de Chamados', 14, y)
      y += 4

      autoTable(doc, {
        startY: y,
        head: [[
          condoFiltro==='todos'?'Condomínio':null,'Categoria','Subcategoria','Solicitante','Bloco/Ap','Status','Departamento','Data'
        ].filter(Boolean)],
        body: tickets.map(t => [
          condoFiltro==='todos'?t.condominios?.nome||'-':null,
          t.categoria_personalizada||t.categoria,
          t.subcategoria||'-',
          t.nome_solicitante||'-',
          [t.bloco,t.apartamento].filter(Boolean).join(' / ') || '-',
          STATUS_LABEL[t.status]||t.status,
          t.departamento ? (DEPARTAMENTOS[t.departamento]||t.departamento) : '-',
          new Date(t.criado_em).toLocaleDateString('pt-BR'),
        ].filter((_,i)=>condoFiltro==='todos'?true:i!==0)),
        theme:'striped',
        headStyles:{ fillColor:[40,67,173], textColor:255, fontStyle:'bold', fontSize:8 },
        bodyStyles:{ fontSize:8 },
        alternateRowStyles:{ fillColor:[245,247,255] },
        margin:{ left:14, right:14 },
        styles:{ overflow:'linebreak', cellPadding:2 },
      })

      // ── Rodapé ─────────────────────────────────────────────
      const totalPages = doc.internal.getNumberOfPages()
      for (let i=1; i<=totalPages; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(150)
        doc.text(`Portal de Chamados  |  ${periodoLabel}  |  Página ${i} de ${totalPages}`, W/2, 291, { align:'center' })
      }

      const filename = `relatorio_${MESES[mes].toLowerCase()}_${ano}${condoFiltro!=='todos'?`_${nomeCondo.replace(/\s+/g,'_')}`:''}`.replace(/[^a-zA-Z0-9_]/g,'_')
      doc.save(`${filename}.pdf`)
      onToast('PDF gerado com sucesso!')
    } catch(e) {
      onToast('Erro ao gerar PDF: '+e.message)
      console.error(e)
    }
    setGerandoPDF(false)
  }

  const anos = [hoje.getFullYear()-1, hoje.getFullYear()]

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Relatório Mensal</h1>
        <p className="page-sub">Gere relatórios em PDF dos chamados por período, condomínio e categoria</p>
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom:20 }}>
        <h3 className="section-title">Filtros</h3>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px,1fr))', gap:12 }}>
          <div className="field" style={{ margin:0 }}>
            <label>Mês</label>
            <select className="input" value={mes} onChange={e=>setMes(Number(e.target.value))}>
              {MESES.map((m,i)=><option key={i} value={i}>{m}</option>)}
            </select>
          </div>
          <div className="field" style={{ margin:0 }}>
            <label>Ano</label>
            <select className="input" value={ano} onChange={e=>setAno(Number(e.target.value))}>
              {anos.map(a=><option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="field" style={{ margin:0 }}>
            <label>Condomínio</label>
            <select className="input" value={condoFiltro} onChange={e=>setCondoFiltro(e.target.value)}>
              <option value="todos">Todos</option>
              {condominios.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div className="field" style={{ margin:0 }}>
            <label>Categoria</label>
            <select className="input" value={catFiltro} onChange={e=>{ setCatFiltro(e.target.value); setSubFiltro('todas') }}>
              <option value="todas">Todas</option>
              {categoriasSistema.map(c=><option key={c.nome} value={c.nome}>{c.nome}</option>)}
            </select>
          </div>
          <div className="field" style={{ margin:0 }}>
            <label>Subcategoria</label>
            <select className="input" value={subFiltro} onChange={e=>setSubFiltro(e.target.value)}>
              <option value="todas">Todas</option>
              {[...new Set([
                ...(subFiltro!=='todas'?[subFiltro]:[]),
                ...tickets
                  .filter(t => catFiltro==='todas' || t.categoria===catFiltro)
                  .map(t => t.subcategoria).filter(Boolean)
              ])].sort().map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="field" style={{ margin:0 }}>
            <label>Status</label>
            <select className="input" value={statusFiltro} onChange={e=>setStatusFiltro(e.target.value)}>
              <option value="todos">Todos</option>
              <option value="recebido">Recebido</option>
              <option value="andamento">Em andamento</option>
              <option value="concluido">Concluído</option>
            </select>
          </div>
        </div>
      </div>

      {/* Preview stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:10, marginBottom:20 }}>
        {[
          { l:'Total',        v:stats.total,     c:'var(--navy)' },
          { l:'Recebidos',    v:stats.recebido,  c:'var(--amber)' },
          { l:'Em andamento', v:stats.andamento, c:'var(--emerald)' },
          { l:'Concluídos',   v:stats.concluido, c:'#22c55e' },
        ].map(k=>(
          <div key={k.l} style={{ background:'#fff', border:'1px solid var(--gray-200)', borderRadius:'var(--r-lg)', padding:'14px', textAlign:'center', boxShadow:'var(--shadow-sm)' }}>
            <div style={{ fontFamily:'var(--font-display)', fontSize:28, fontWeight:800, color:k.c }}>
              {loading ? '—' : k.v}
            </div>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.05em', marginTop:4 }}>{k.l}</div>
          </div>
        ))}
      </div>

      {/* Botão gerar PDF */}
      <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:20, flexWrap:'wrap' }}>
        <button className="btn btn-primary" onClick={gerarPDF} disabled={gerandoPDF||loading||!tickets.length}
          style={{ display:'flex', alignItems:'center', gap:8, padding:'11px 20px', fontSize:14 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/>
          </svg>
          {gerandoPDF ? 'Gerando PDF...' : `Gerar PDF — ${periodoLabel}`}
        </button>
        {tickets.length > 0 && (
          <span style={{ fontSize:13, color:'var(--gray-400)' }}>
            {tickets.length} chamado{tickets.length!==1?'s':''} no período
          </span>
        )}
        {!tickets.length && !loading && (
          <span style={{ fontSize:13, color:'var(--amber)' }}>Nenhum chamado no período selecionado.</span>
        )}
      </div>

      {/* Preview da lista */}
      {!loading && tickets.length > 0 && (
        <div className="card">
          <h3 className="section-title">Preview — {tickets.length} chamados</h3>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'var(--gray-50)', borderBottom:'1px solid var(--gray-200)' }}>
                  {[condoFiltro==='todos'?'Condomínio':null,'Categoria','Subcategoria','Solicitante','Status','Departamento','Data'].filter(Boolean).map(h=>(
                    <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontSize:11, fontWeight:700,
                      color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.04em', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tickets.slice(0,20).map((t,i)=>(
                  <tr key={t.id} style={{ borderBottom:'1px solid var(--gray-100)', background:i%2===0?'#fff':'var(--gray-50)' }}>
                    {condoFiltro==='todos' && <td style={{ padding:'8px 10px', color:'var(--gray-700)', maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.condominios?.nome||'-'}</td>}
                    <td style={{ padding:'8px 10px', color:'var(--gray-700)' }}>{t.categoria_personalizada||t.categoria}</td>
                    <td style={{ padding:'8px 10px', color:'var(--gray-500)' }}>{t.subcategoria||'-'}</td>
                    <td style={{ padding:'8px 10px', color:'var(--gray-500)' }}>{t.nome_solicitante||'-'}</td>
                    <td style={{ padding:'8px 10px' }}>
                      <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:5,
                        background: t.status==='concluido'?'#dcfce7':t.status==='andamento'?'#dbeafe':'#fef3c7',
                        color: t.status==='concluido'?'#16a34a':t.status==='andamento'?'#1d4ed8':'#b45309' }}>
                        {STATUS_LABEL[t.status]||t.status}
                      </span>
                    </td>
                    <td style={{ padding:'8px 10px', color:'var(--gray-500)', fontSize:12 }}>
                      {t.departamento ? (DEPARTAMENTOS[t.departamento]||t.departamento) : '—'}
                    </td>
                    <td style={{ padding:'8px 10px', color:'var(--gray-400)', fontSize:12, whiteSpace:'nowrap' }}>
                      {new Date(t.criado_em).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tickets.length > 20 && (
              <p style={{ fontSize:12, color:'var(--gray-400)', padding:'10px', textAlign:'center' }}>
                Mostrando 20 de {tickets.length}. O PDF incluirá todos os chamados.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
