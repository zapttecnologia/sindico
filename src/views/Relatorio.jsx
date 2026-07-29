import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { STATUS_LABEL, DEPARTAMENTOS, fmtDate } from '../lib/constants'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

// Rótulos e cores dos votos do conselho (iguais aos do painel do conselheiro)
const VOTO_OPCOES = [
  { v:'deferido',          l:'Deferido',              cor:'#16a34a', bg:'#dcfce7', icon:'✅' },
  { v:'deferido_ressalva', l:'Deferido com ressalva', cor:'#d97706', bg:'#fef3c7', icon:'⚠️' },
  { v:'indeferido',        l:'Indeferido',            cor:'#dc2626', bg:'#fee2e2', icon:'❌' },
]
const hoje = new Date()

export default function Relatorio({ onToast }) {
  const { perfil } = useAuth()
  const [condominios, setCondominios] = useState([])
  const [categoriasSistema, setCategoriasSistema] = useState([])
  const [tickets, setTickets] = useState([])
  const [votacoes, setVotacoes] = useState([])   // chamados que tiveram voto do conselho
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
    const lista = data || []
    setTickets(lista)

    // Para as VOTAÇÕES, busca os chamados do período/condomínio
    // SEM aplicar o filtro de status/categoria — assim a seção de
    // votação aparece mesmo com a tabela filtrada (ex.: "Resolvido").
    let qv = supabase.from('solicitacoes')
      .select('id, categoria, categoria_personalizada, aprovacao_status, condominio_id, condominios(nome)')
      .gte('criado_em', inicioMes)
      .lte('criado_em', fimMes)
    if (condoFiltro !== 'todos') qv = qv.eq('condominio_id', condoFiltro)
    const { data: dadosVot } = await qv
    const listaVot = dadosVot || []

    // Busca os votos do conselho desses chamados
    const ids = listaVot.map(t => t.id)
    if (ids.length) {
      const { data: votos } = await supabase.from('votos_conselheiros')
        .select('solicitacao_id, voto, observacao, conselheiro_id')
        .in('solicitacao_id', ids)

      // Busca os nomes dos conselheiros numa consulta à parte
      // (não há FK votos->perfis, então o join automático não funciona)
      const conselheiroIds = [...new Set((votos || []).map(v => v.conselheiro_id).filter(Boolean))]
      const nomePorId = {}
      if (conselheiroIds.length) {
        const { data: perfisVotantes } = await supabase.from('perfis')
          .select('id, nome').in('id', conselheiroIds)
        ;(perfisVotantes || []).forEach(p => { nomePorId[p.id] = p.nome })
      }

      // Agrupa por chamado
      const porChamado = {}
      ;(votos || []).forEach(v => {
        if (!porChamado[v.solicitacao_id]) porChamado[v.solicitacao_id] = []
        porChamado[v.solicitacao_id].push({
          nome: nomePorId[v.conselheiro_id] || 'Conselheiro',
          voto: v.voto,
          observacao: v.observacao || '',
        })
      })

      // Monta a lista de votações, com placar
      const vts = Object.entries(porChamado).map(([sid, votosDoChamado]) => {
        const t = listaVot.find(x => x.id === sid)
        const placar = { deferido:0, deferido_ressalva:0, indeferido:0 }
        votosDoChamado.forEach(v => { if (placar[v.voto] != null) placar[v.voto]++ })
        return {
          id: sid,
          titulo: t?.categoria_personalizada || t?.categoria || 'Chamado',
          condominio: t?.condominios?.nome || '-',
          resultado: t?.aprovacao_status || null,
          placar,
          total: votosDoChamado.length,
          votos: votosDoChamado,
        }
      }).sort((a, b) => b.total - a.total)

      setVotacoes(vts)
    } else {
      setVotacoes([])
    }
    setLoading(false)
  }

  useEffect(() => { buscarDados() }, [mes, ano, condoFiltro, catFiltro, subFiltro, statusFiltro])

  // Recarrega quando a aba volta ao foco (ex.: após fechar um chamado em outra tela)
  useEffect(() => {
    const onFocus = () => buscarDados()
    const onVisible = () => { if (!document.hidden) buscarDados() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [mes, ano, condoFiltro, catFiltro, subFiltro, statusFiltro])

  // Stats rápidos
  const FECHADOS = ['resolvido', 'cancelado']
  const stats = {
    total:     tickets.length,
    pendente:  tickets.filter(t=>!FECHADOS.includes(t.status)).length,
    andamento: tickets.filter(t=>t.status==='em_andamento').length,
    concluido: tickets.filter(t=>FECHADOS.includes(t.status)).length,
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
        { l:'Pendentes', v:stats.pendente, c:[244,163,64] },
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

      // ── Votações do conselho ───────────────────────────────
      if (votacoes.length) {
        doc.addPage()
        let vy = 20
        doc.setFontSize(13); doc.setTextColor(40, 67, 173)
        doc.text('Votações do Conselho', 14, vy)
        vy += 6
        doc.setFontSize(9); doc.setTextColor(120, 120, 120)
        doc.text(`${votacoes.length} chamado(s) passaram por votação no período.`, 14, vy)
        vy += 8

        const rotuloVoto = (v) => (VOTO_OPCOES.find(o => o.v === v)?.l) || v

        votacoes.forEach(v => {
          if (vy > 250) { doc.addPage(); vy = 20 }
          // Placar em texto
          const placarTxt = VOTO_OPCOES
            .filter(o => v.placar[o.v] > 0)
            .map(o => `${v.placar[o.v]} ${o.l}`).join('  ·  ')
          const resultadoTxt = v.resultado === 'aprovado' ? 'APROVADO'
            : v.resultado === 'rejeitado' ? 'REJEITADO' : ''

          autoTable(doc, {
            startY: vy,
            head: [[`${v.titulo}  —  ${v.condominio}`, `${v.total} voto(s)  ${resultadoTxt ? '· ' + resultadoTxt : ''}`]],
            body: [
              [{ content: placarTxt || 'Sem votos computados', colSpan:2, styles:{ fontStyle:'bold', textColor:[60,60,60], fillColor:[248,249,251] } }],
              ...v.votos.map(voto => [
                voto.nome,
                rotuloVoto(voto.voto) + (voto.observacao ? `  ("${voto.observacao}")` : ''),
              ]),
            ],
            theme:'grid',
            headStyles:{ fillColor:[99,102,241], textColor:255, fontStyle:'bold', fontSize:8 },
            bodyStyles:{ fontSize:8 },
            margin:{ left:14, right:14 },
            styles:{ overflow:'linebreak', cellPadding:2 },
          })
          vy = doc.lastAutoTable.finalY + 6
        })
      }

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
              <option value="aberto">Aberto</option>
              <option value="em_analise">Em análise</option>
              <option value="em_andamento">Em andamento</option>
              <option value="aguardando_terceiro">Aguardando terceiro</option>
              <option value="resolvido">Resolvido</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
        </div>
      </div>

      {/* Preview stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:10, marginBottom:20 }}>
        {[
          { l:'Total',        v:stats.total,     c:'var(--navy)' },
          { l:'Pendentes',    v:stats.pendente,  c:'var(--amber)' },
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
                        background: FECHADOS.includes(t.status)?'#dcfce7':t.status==='em_andamento'?'#dbeafe':'#fef3c7',
                        color: FECHADOS.includes(t.status)?'#16a34a':t.status==='em_andamento'?'#1d4ed8':'#b45309' }}>
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

      {/* ── SEÇÃO: Chamados que passaram por votação do conselho ── */}
      {!loading && votacoes.length > 0 && (
        <div className="card" style={{ marginTop:20 }}>
          <h3 style={{ fontSize:15, fontWeight:700, color:'var(--navy)', margin:'0 0 4px' }}>
            Votações do conselho
          </h3>
          <p style={{ fontSize:12, color:'var(--gray-400)', margin:'0 0 16px' }}>
            {votacoes.length} chamado(s) passaram por votação neste período.
          </p>

          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {votacoes.map(v => (
              <div key={v.id} style={{ border:'1px solid var(--gray-200)', borderRadius:'var(--r-lg)', padding:14 }}>
                {/* Cabeçalho do chamado */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10, flexWrap:'wrap', marginBottom:10 }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:'var(--navy)' }}>{v.titulo}</div>
                    <div style={{ fontSize:12, color:'var(--gray-400)' }}>{v.condominio}</div>
                  </div>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    <span style={{ fontSize:12, fontWeight:700, padding:'4px 10px', borderRadius:8, background:'var(--gray-100)', color:'var(--gray-600)' }}>
                      {v.total} voto{v.total === 1 ? '' : 's'}
                    </span>
                    {v.resultado && (
                      <span style={{ fontSize:12, fontWeight:700, padding:'4px 10px', borderRadius:8,
                        background: v.resultado === 'aprovado' ? '#dcfce7' : v.resultado === 'rejeitado' ? '#fee2e2' : 'var(--gray-100)',
                        color: v.resultado === 'aprovado' ? '#16a34a' : v.resultado === 'rejeitado' ? '#dc2626' : 'var(--gray-600)' }}>
                        {v.resultado === 'aprovado' ? 'Aprovado' : v.resultado === 'rejeitado' ? 'Rejeitado' : v.resultado}
                      </span>
                    )}
                  </div>
                </div>

                {/* Placar */}
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
                  {VOTO_OPCOES.filter(o => v.placar[o.v] > 0).map(o => (
                    <span key={o.v} style={{ fontSize:12, fontWeight:600, padding:'4px 10px', borderRadius:8, background:o.bg, color:o.cor }}>
                      {o.icon} {v.placar[o.v]} {o.l}
                    </span>
                  ))}
                </div>

                {/* Lista de conselheiros e seus votos */}
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {v.votos.map((voto, i) => {
                    const op = VOTO_OPCOES.find(o => o.v === voto.voto)
                    return (
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:10, fontSize:13, padding:'6px 0', borderTop:i > 0 ? '1px solid var(--gray-100)' : 'none' }}>
                        <span style={{ flex:1, color:'var(--gray-700)' }}>{voto.nome}</span>
                        {voto.observacao && <span style={{ fontSize:11, color:'var(--gray-400)', fontStyle:'italic', maxWidth:'40%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={voto.observacao}>"{voto.observacao}"</span>}
                        <span style={{ fontSize:12, fontWeight:700, padding:'3px 10px', borderRadius:8, background:op?.bg||'var(--gray-100)', color:op?.cor||'var(--gray-600)' }}>
                          {op?.icon} {op?.l || voto.voto}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
