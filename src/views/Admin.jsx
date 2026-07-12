import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { gerarCodigo } from '../lib/constants'

const PAPEL_LABEL = {
  morador:'Morador', equipe:'Sindico', admin:'Admin', conselheiro:'Conselheiro',
  manutencao:'Manutenção', limpeza:'Limpeza', administradora:'Administradora',
  portaria:'Portaria', seguranca:'Segurança', zeladoria:'Zeladoria', terceiros:'Terceiros',
}
const PAPEIS = ['morador','conselheiro','equipe','admin','manutencao','limpeza','administradora','portaria','seguranca','zeladoria','terceiros']
const PAPEIS_MORADORES = ['morador','conselheiro']
const PAPEIS_DEPARTAMENTO = ['manutencao','limpeza','administradora','portaria','seguranca','zeladoria','terceiros']
const SENHA_PADRAO = 'mudar123'
function initials(n){ return (n||'?').split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase() }

function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display:'flex', borderBottom:'2px solid var(--gray-200)', marginBottom:28, overflowX:'auto' }}>
      {tabs.map(t => (
        <button key={t.id} onClick={()=>onChange(t.id)} style={{
          padding:'12px 20px', fontWeight:600, fontSize:14, border:'none',
          background:'transparent', cursor:'pointer', whiteSpace:'nowrap',
          color: active===t.id ? 'var(--emerald)' : 'var(--gray-400)',
          borderBottom: active===t.id ? '2px solid var(--emerald)' : '2px solid transparent',
          marginBottom:-2, transition:'color .15s',
        }}>{t.icon} {t.label}</button>
      ))}
    </div>
  )
}

export default function Admin({ onToast }) {
  const [secao, setSecao] = useState('condominios')
  const [condominios, setCondominios] = useState([])
  const [blocos, setBlocos] = useState([])
  const [buscaCondo, setBuscaCondo] = useState('')
  const [condoExpandido, setCondoExpandido] = useState(null)
  const [modalCondo, setModalCondo] = useState(null)
  const [novoCondoNome, setNovoCondoNome] = useState('')
  const [blocoNovoMap, setBlocoNovoMap] = useState({})
  const [modalUsuario, setModalUsuario] = useState(null)
  const [modalNovaConta, setModalNovaConta] = useState(null) // condominio_id
  const [novaConta, setNovaConta] = useState({ nome:'', email:'', codigo:'', senha:SENHA_PADRAO, papel:'morador', bloco:'', apto:'', tipo_ocupacao:'proprietario' })
  const [salvando, setSalvando] = useState(false)

  // Form cadastrar novo condomínio
  const CONDO_VAZIO = {
    nome:'', cnpj:'', total_unidades:'', ano_construcao:'',
    endereco_rua:'', endereco_numero:'', endereco_complemento:'', endereco_bairro:'', endereco_cidade:'', endereco_uf:'', endereco_cep:'',
    sindico_nome:'', sindico_telefone:'', sindico_email:'', mandato_inicio:'', mandato_fim:'',
    administradora_nome:'', administradora_contato:'',
    portaria_nome:'', portaria_telefone:'',
    seguro_seguradora:'', seguro_apolice:'', seguro_vencimento:'',
    gestao_inicio:'', obs:'', regulamento_pdf_url:'', convencao_pdf_url:''
  }
  const [novoCondo, setNovoCondo] = useState(CONDO_VAZIO)
  const [usuariosPorCondo, setUsuariosPorCondo] = useState({})

  const carregarCondos = useCallback(async () => {
    const { data } = await supabase.from('condominios').select('*').order('nome')
    if (data) setCondominios(data)
  }, [])

  const carregarBlocos = useCallback(async () => {
    const { data } = await supabase.from('blocos').select('*').order('nome')
    if (data) setBlocos(data)
  }, [])

  const carregarUsuariosCondo = async (condoId) => {
    const { data } = await supabase.from('perfis')
      .select('id,nome,email,papel,codigo_acesso,bloco,apartamento,primeiro_acesso')
      .eq('condominio_id', condoId).order('criado_em', { ascending:false })
    setUsuariosPorCondo(prev => ({ ...prev, [condoId]: data||[] }))
  }

  useEffect(() => { carregarCondos(); carregarBlocos() }, [])

  // Auto-código
  useEffect(() => {
    const condo = condominios.find(c => c.id === modalNovaConta)
    if (condo && (novaConta.bloco || novaConta.apto)) {
      const auto = gerarCodigo(condo.nome, novaConta.bloco, novaConta.apto)
      if (auto) setNovaConta(x => ({ ...x, codigo: auto }))
    }
  }, [novaConta.bloco, novaConta.apto, modalNovaConta, condominios])

  const blocosDoCondo = (condoId) => blocos.filter(b => b.condominio_id === condoId)

  // Cadastrar novo condomínio
  const cadastrarCondo = async () => {
    if (!novoCondo.nome.trim()) { onToast('Informe o nome do condominio.'); return }
    setSalvando(true)
    const { error } = await supabase.from('condominios').insert({
      ...novoCondo,
      total_unidades: novoCondo.total_unidades ? Number(novoCondo.total_unidades) : null,
      ano_construcao: novoCondo.ano_construcao ? Number(novoCondo.ano_construcao) : null,
    })
    setSalvando(false)
    if (error) { onToast('Erro: '+error.message); return }
    onToast('Condominio cadastrado!'); setNovoCondo(CONDO_VAZIO); setSecao('condominios'); carregarCondos()
  }

  const salvarCondoCompleto = async () => {
    if (!modalCondo) return
    const { error } = await supabase.from('condominios').update({
      nome:modalCondo.nome, cnpj:modalCondo.cnpj||null, total_unidades:modalCondo.total_unidades?Number(modalCondo.total_unidades):null,
      ano_construcao:modalCondo.ano_construcao?Number(modalCondo.ano_construcao):null,
      endereco_rua:modalCondo.endereco_rua||null, endereco_numero:modalCondo.endereco_numero||null,
      endereco_complemento:modalCondo.endereco_complemento||null, endereco_bairro:modalCondo.endereco_bairro||null,
      endereco_cidade:modalCondo.endereco_cidade||null, endereco_uf:modalCondo.endereco_uf||null, endereco_cep:modalCondo.endereco_cep||null,
      sindico_nome:modalCondo.sindico_nome||null, sindico_telefone:modalCondo.sindico_telefone||null, sindico_email:modalCondo.sindico_email||null,
      mandato_inicio:modalCondo.mandato_inicio||null, mandato_fim:modalCondo.mandato_fim||null,
      administradora_nome:modalCondo.administradora_nome||null, administradora_contato:modalCondo.administradora_contato||null,
      portaria_nome:modalCondo.portaria_nome||null, portaria_telefone:modalCondo.portaria_telefone||null,
      seguro_seguradora:modalCondo.seguro_seguradora||null, seguro_apolice:modalCondo.seguro_apolice||null, seguro_vencimento:modalCondo.seguro_vencimento||null,
      gestao_inicio:modalCondo.gestao_inicio||null, obs:modalCondo.obs||null,
      regulamento_pdf_url:modalCondo.regulamento_pdf_url||null,
      convencao_pdf_url:modalCondo.convencao_pdf_url||null,
    }).eq('id', modalCondo.id)
    if (error) { onToast('Erro: '+error.message); return }
    onToast('Condominio atualizado.'); setModalCondo(null); carregarCondos()
  }

  const uploadPDF = async (file, condoId, tipo) => {
    if (file.size > 20 * 1024 * 1024) { onToast('Arquivo muito grande. Máximo 20MB.'); return null }
    if (file.type !== 'application/pdf') { onToast('Apenas arquivos PDF são aceitos.'); return null }
    const path = `${condoId}/${tipo}-${Date.now()}.pdf`
    const { error } = await supabase.storage.from('docs-condominios').upload(path, file, { upsert:true })
    if (error) { onToast('Erro no upload: '+error.message); return null }
    const { data } = supabase.storage.from('docs-condominios').getPublicUrl(path)
    return data.publicUrl
  }

  const handleUploadPDF = async (e, condoId, tipo) => {
    const file = e.target.files?.[0]
    if (!file) return
    onToast('Enviando PDF...')
    const url = await uploadPDF(file, condoId, tipo)
    if (!url) return
    const campo = tipo === 'regulamento' ? 'regulamento_pdf_url' : 'convencao_pdf_url'
    await supabase.from('condominios').update({ [campo]: url }).eq('id', condoId)
    onToast('PDF salvo com sucesso!')
    setModalCondo(m => m ? ({ ...m, [campo]: url }) : m)
    carregarCondos()
    e.target.value = ''
  }

  const excluirCondo = async (id) => {
    if (!window.confirm('Excluir este condominio?')) return
    const { error } = await supabase.from('condominios').delete().eq('id', id)
    if (error) { onToast('Nao foi possivel excluir: '+error.message); return }
    onToast('Excluido.'); carregarCondos()
  }

  // Blocos
  const adicionarBloco = async (condoId) => {
    const nb = blocoNovoMap[condoId] || {}
    if (!nb.nome?.trim()) return
    await supabase.from('blocos').insert({ condominio_id:condoId, nome:nb.nome.trim(), total_apartamentos:Number(nb.total)||0 })
    setBlocoNovoMap(p=>({...p,[condoId]:{nome:'',total:''}}))
    onToast('Bloco adicionado.'); carregarBlocos()
  }

  // Usuários
  const api = async (body) => {
    const sess = (await supabase.auth.getSession()).data.session
    const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-actions`, {
      method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${sess?.access_token}`},
      body: JSON.stringify(body),
    })
    const json = await r.json()
    if (!r.ok) throw new Error(json.error||'Erro')
    return json
  }

  const criarConta = async () => {
    if (!novaConta.nome||!novaConta.email||!novaConta.codigo) { onToast('Preencha nome, e-mail e codigo.'); return }
    setSalvando(true)
    try {
      await api({ action:'create_user', email:novaConta.email, password:novaConta.senha,
        nome:novaConta.nome, papel:novaConta.papel, codigo_acesso:novaConta.codigo.toUpperCase(),
        condominio_id: modalNovaConta, bloco:novaConta.bloco, apartamento:novaConta.apto,
        tipo_ocupacao: novaConta.papel === 'morador' ? novaConta.tipo_ocupacao : null })
      onToast('Usuario criado! Codigo: '+novaConta.codigo.toUpperCase())
      setModalNovaConta(null)
      setNovaConta({ nome:'', email:'', codigo:'', senha:SENHA_PADRAO, papel:'morador', bloco:'', apto:'', tipo_ocupacao:'proprietario' })
      carregarUsuariosCondo(modalNovaConta)
    } catch(e) { onToast('Erro: '+e.message) }
    setSalvando(false)
  }

  const salvarUsuario = async () => {
    if (!modalUsuario) return
    const { error } = await supabase.from('perfis').update({
      nome:modalUsuario.nome, codigo_acesso:modalUsuario.codigo_acesso?.toUpperCase(), papel:modalUsuario.papel,
    }).eq('id', modalUsuario.id)
    if (error) { onToast('Erro: '+error.message); return }
    onToast('Salvo.'); setModalUsuario(null); carregarUsuariosCondo(modalUsuario.condominio_id)
  }

  const resetarSenha = async () => {
    if (!modalUsuario?.novaSenha||modalUsuario.novaSenha.length<4) { onToast('Senha muito curta.'); return }
    try { await api({action:'reset_password',user_id:modalUsuario.id,new_password:modalUsuario.novaSenha}); onToast('Senha alterada.') }
    catch(e) { onToast('Erro: '+e.message) }
  }

  const excluirConta = async () => {
    if (!window.confirm('Excluir esta conta?')) return
    try { await api({action:'delete_user',user_id:modalUsuario.id}); onToast('Excluido.'); setModalUsuario(null); carregarUsuariosCondo(modalUsuario.condominio_id) }
    catch(e) { onToast('Erro: '+e.message) }
  }

  const condosFiltrados = condominios.filter(c => !buscaCondo || c.nome.toLowerCase().includes(buscaCondo.toLowerCase()))

  const SecTitle = ({ children }) => (
    <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.05em', margin:'0 0 10px', paddingBottom:8, borderBottom:'1px solid var(--gray-100)' }}>
      {children}
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Condominios</h1>
      </div>

      <TabBar
        tabs={[{id:'condominios',label:'Condominios',icon:'🏢'},{id:'cadastrar',label:'Cadastrar novo',icon:'➕'}]}
        active={secao} onChange={setSecao}
      />

      {/* ── LISTA DE CONDOMINIOS ── */}
      {secao==='condominios' && (
        <div>
          <div style={{ marginBottom:16 }}>
            <input className="input" placeholder="Buscar condominio..." value={buscaCondo} onChange={e=>setBuscaCondo(e.target.value)} style={{ maxWidth:320 }}/>
          </div>

          {condosFiltrados.length===0 && <div className="empty-state">Nenhum condominio encontrado.</div>}

          {condosFiltrados.map(c => {
            const bls = blocosDoCondo(c.id)
            const aberto = condoExpandido===c.id
            const users = usuariosPorCondo[c.id] || []
            const blocosSelectCond = bls

            return (
              <div key={c.id} className="card" style={{ marginBottom:12 }}>
                {/* Header do condomínio */}
                <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                  <div style={{ width:40, height:40, borderRadius:'var(--r-md)', background:'var(--mint)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontFamily:'var(--font-display)', fontSize:16, fontWeight:700, color:'var(--emerald)', flexShrink:0 }}>
                    {c.nome[0]}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:15, fontWeight:700, color:'var(--gray-800)' }}>{c.nome}</div>
                    <div style={{ fontSize:12, color:'var(--gray-400)' }}>
                      {bls.length} bloco{bls.length!==1?'s':''} · {c.total_unidades||'?'} unidades
                      {c.endereco_cidade ? ` · ${c.endereco_cidade}` : ''}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:6 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setCondoExpandido(aberto?null:c.id); if (!aberto) carregarUsuariosCondo(c.id) }}>
                      {aberto ? '▲ Fechar' : '▼ Gerenciar'}
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={() => setModalCondo({...c})}>Editar dados</button>
                    <button className="btn btn-danger btn-sm" onClick={() => excluirCondo(c.id)}>Excluir</button>
                  </div>
                </div>

                {/* Painel expandido */}
                {aberto && (
                  <div style={{ marginTop:18, paddingTop:18, borderTop:'1px solid var(--gray-200)' }}>
                    {/* Blocos */}
                    <SecTitle>Blocos</SecTitle>
                    {bls.map(b => (
                      <div key={b.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:'1px solid var(--gray-100)' }}>
                        <div style={{ width:32, height:32, borderRadius:'var(--r-sm)', background:'var(--mint)',
                          display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'var(--emerald)' }}>
                          {b.nome.slice(0,2)}
                        </div>
                        <div style={{ flex:1, fontSize:13 }}><b>{b.nome}</b> · {b.total_apartamentos} unidades</div>
                        <button className="btn btn-danger btn-sm" onClick={async()=>{ await supabase.from('blocos').delete().eq('id',b.id); carregarBlocos() }}>Remover</button>
                      </div>
                    ))}
                    <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
                      <input className="input" placeholder="Nome do bloco" value={(blocoNovoMap[c.id]||{}).nome||''}
                        onChange={e=>setBlocoNovoMap(p=>({...p,[c.id]:{...(p[c.id]||{}),nome:e.target.value}}))}
                        style={{ flex:'2 1 120px', fontSize:13 }}/>
                      <input className="input" type="number" placeholder="Unidades" value={(blocoNovoMap[c.id]||{}).total||''}
                        onChange={e=>setBlocoNovoMap(p=>({...p,[c.id]:{...(p[c.id]||{}),total:e.target.value}}))}
                        style={{ flex:'1 1 80px', fontSize:13 }}/>
                      <button className="btn btn-primary btn-sm" onClick={()=>adicionarBloco(c.id)}>+ Bloco</button>
                    </div>

                    {/* Moradores e conselheiros */}
                    <div style={{ marginTop:20 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                        <SecTitle>Moradores e conselheiros</SecTitle>
                        <button className="btn btn-primary btn-sm" onClick={()=>{ setModalNovaConta(c.id); setNovaConta({nome:'',email:'',codigo:'',senha:SENHA_PADRAO,papel:'morador',bloco:'',apto:''}) }}>
                          + Novo usuario
                        </button>
                      </div>

                      {users.length===0 && <p style={{ fontSize:13, color:'var(--gray-400)', margin:'0 0 8px' }}>Nenhum usuario neste condominio.</p>}

                      {['conselheiro','morador'].map(papel => {
                        const grupo = users.filter(u=>u.papel===papel)
                        if (!grupo.length) return null
                        return (
                          <div key={papel} style={{ marginBottom:14 }}>
                            <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.04em', marginBottom:8 }}>
                              {PAPEL_LABEL[papel]} ({grupo.length})
                            </div>
                            {grupo.map(u => (
                              <div key={u.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid var(--gray-100)' }}>
                                <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--mint)',
                                  display:'flex', alignItems:'center', justifyContent:'center',
                                  fontSize:12, fontWeight:700, color:'var(--emerald)', flexShrink:0 }}>{initials(u.nome)}</div>
                                <div style={{ flex:1 }}>
                                  <div style={{ fontSize:13, fontWeight:600, color:'var(--gray-800)', display:'flex', gap:6, alignItems:'center' }}>
                                    {u.nome}
                                    {u.primeiro_acesso===true && <span style={{ fontSize:10, background:'#fff3dc', color:'#8a5a00', padding:'1px 5px', borderRadius:3, fontWeight:600 }}>1o acesso</span>}
                                  </div>
                                  <div style={{ fontSize:11, color:'var(--gray-400)' }}>
                                    {u.codigo_acesso?`Cod: ${u.codigo_acesso}`:''}
                                    {u.bloco?` · Bl. ${u.bloco}`:''}
                                    {u.apartamento?` Ap. ${u.apartamento}`:''}
                                    {u.tipo_ocupacao ? ` · ${u.tipo_ocupacao==='inquilino'?'🔑 Inquilino':'🏠 Proprietário'}` : ''}
                                  </div>
                                </div>
                                <button className="btn btn-ghost btn-sm" onClick={()=>setModalUsuario({...u,novaSenha:'',condominio_id:c.id})}>Editar</button>
                              </div>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── CADASTRAR NOVO CONDOMINIO ── */}
      {secao==='cadastrar' && (
        <div className="card">
          <h3 className="section-title">Cadastrar novo condominio</h3>
          <div style={{ padding:'12px 14px', background:'var(--mint)', borderRadius:'var(--r-md)', marginBottom:20, fontSize:13, color:'var(--emerald)' }}>
            Preencha os dados cadastrais. Voce podera adicionar blocos e usuarios apos o cadastro.
          </div>

          {[
            { titulo:'Dados gerais', campos:[
              [['Nome do condominio *','nome'],['CNPJ','cnpj']],
              [['Total de unidades','total_unidades','number'],['Ano de construcao','ano_construcao','number']],
            ]},
            { titulo:'Endereco', campos:[
              [['Rua / Avenida','endereco_rua'],['Numero','endereco_numero']],
              [['Complemento','endereco_complemento'],['Bairro','endereco_bairro']],
              [['Cidade','endereco_cidade'],['UF','endereco_uf'],['CEP','endereco_cep']],
            ]},
            { titulo:'Sindico responsavel', campos:[
              [['Nome','sindico_nome'],['Telefone / WhatsApp','sindico_telefone']],
              [['E-mail','sindico_email'],['Inicio mandato','mandato_inicio','date'],['Fim mandato','mandato_fim','date']],
            ]},
            { titulo:'Administradora', campos:[[['Nome','administradora_nome'],['Contato','administradora_contato']]]},
            { titulo:'Portaria / Zelador', campos:[[['Nome','portaria_nome'],['Telefone','portaria_telefone']]]},
            { titulo:'Seguro', campos:[
              [['Seguradora','seguro_seguradora'],['Apolice','seguro_apolice']],
              [['Vencimento','seguro_vencimento','date']],
            ]},
            { titulo:'Gestao', campos:[
              [['Inicio da gestao','gestao_inicio','date'],['Observacoes','obs']],
              [['URL Regulamento Interno (PDF)','regulamento_pdf_url'],['URL Convencao (PDF)','convencao_pdf_url']],
            ]},
          ].map(sec => (
            <div key={sec.titulo} style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:12, borderBottom:'1px solid var(--gray-100)', paddingBottom:6 }}>
                {sec.titulo}
              </div>
              {sec.campos.map((row, ri) => (
                <div key={ri} style={{ display:'grid', gridTemplateColumns:`repeat(${row.length},1fr)`, gap:12, marginBottom:12 }}>
                  {row.map(([label,key,type='text']) => (
                    <div key={key} className="field" style={{ margin:0 }}>
                      <label>{label}</label>
                      <input className="input" type={type} value={novoCondo[key]||''}
                        onChange={e=>setNovoCondo(x=>({...x,[key]:key==='endereco_uf'?e.target.value.toUpperCase().slice(0,2):e.target.value}))} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}

          <button className="btn btn-primary btn-block" onClick={cadastrarCondo} disabled={salvando}>
            {salvando ? 'Cadastrando...' : 'Cadastrar condominio'}
          </button>
        </div>
      )}

      {/* Modal editar dados do condomínio */}
      {modalCondo && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModalCondo(null)}>
          <div className="modal" style={{ maxWidth:560 }}>
            <div className="modal-header">
              <h3 className="modal-title">Editar: {modalCondo.nome}</h3>
              <button className="modal-close" onClick={()=>setModalCondo(null)}>X</button>
            </div>
            {[
              [['Nome','nome'],['CNPJ','cnpj']],
              [['Total unidades','total_unidades','number'],['Ano construcao','ano_construcao','number']],
              [['Rua','endereco_rua'],['Numero','endereco_numero']],
              [['Cidade','endereco_cidade'],['UF','endereco_uf']],
              [['CEP','endereco_cep'],['Bairro','endereco_bairro']],
              [['Sindico','sindico_nome'],['Telefone sindico','sindico_telefone']],
              [['Administradora','administradora_nome'],['Contato adm.','administradora_contato']],
              [['Portaria/zelador','portaria_nome'],['Tel. portaria','portaria_telefone']],
              [['Seguradora','seguro_seguradora'],['Apolice','seguro_apolice']],
              [['Vencimento seguro','seguro_vencimento','date'],['Inicio gestao','gestao_inicio','date']],
              [['Observacoes','obs']],
            ].map((row,ri) => (
              <div key={ri} style={{ display:'grid', gridTemplateColumns:`repeat(${row.length},1fr)`, gap:10, marginBottom:10 }}>
                {row.map(([label,key,type='text']) => (
                  <div key={key} className="field" style={{ margin:0 }}>
                    <label>{label}</label>
                    <input className="input" type={type} value={modalCondo[key]||''}
                      onChange={e=>setModalCondo(m=>({...m,[key]:e.target.value}))} style={{ fontSize:13 }}/>
                  </div>
                ))}
              </div>
            ))}
            {/* Upload PDFs */}
            <div style={{ margin:'16px 0', paddingTop:16, borderTop:'1px solid var(--gray-100)' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:12 }}>
                Documentos do Condominio
              </div>
              <div className="row2">
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:'var(--gray-600)', display:'block', marginBottom:6 }}>Regulamento Interno (PDF)</label>
                  {modalCondo?.regulamento_pdf_url && (
                    <a href={modalCondo.regulamento_pdf_url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize:12, color:'var(--emerald)', display:'block', marginBottom:6 }}>
                      ✅ PDF atual — clique para ver
                    </a>
                  )}
                  <label style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'7px 12px',
                    background:'var(--mint)', border:'1px solid var(--emerald)', borderRadius:'var(--r-md)',
                    fontSize:12, fontWeight:600, color:'var(--emerald)', cursor:'pointer' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    {modalCondo?.regulamento_pdf_url ? 'Substituir PDF' : 'Enviar PDF'}
                    <input type="file" accept="application/pdf" style={{ display:'none' }}
                      onChange={e => handleUploadPDF(e, modalCondo?.id, 'regulamento')} />
                  </label>
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:'var(--gray-600)', display:'block', marginBottom:6 }}>Convencao do Condominio (PDF)</label>
                  {modalCondo?.convencao_pdf_url && (
                    <a href={modalCondo.convencao_pdf_url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize:12, color:'var(--emerald)', display:'block', marginBottom:6 }}>
                      ✅ PDF atual — clique para ver
                    </a>
                  )}
                  <label style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'7px 12px',
                    background:'var(--mint)', border:'1px solid var(--emerald)', borderRadius:'var(--r-md)',
                    fontSize:12, fontWeight:600, color:'var(--emerald)', cursor:'pointer' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    {modalCondo?.convencao_pdf_url ? 'Substituir PDF' : 'Enviar PDF'}
                    <input type="file" accept="application/pdf" style={{ display:'none' }}
                      onChange={e => handleUploadPDF(e, modalCondo?.id, 'convencao')} />
                  </label>
                </div>
              </div>
            </div>

            <button className="btn btn-primary btn-block" onClick={salvarCondoCompleto}>Salvar todos os dados</button>
          </div>
        </div>
      )}

      {/* Modal editar usuario */}
      {modalUsuario && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModalUsuario(null)}>
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Editar usuario</h3>
              <button className="modal-close" onClick={()=>setModalUsuario(null)}>X</button>
            </div>
            <div className="field"><label>Nome</label><input className="input" value={modalUsuario.nome||''} onChange={e=>setModalUsuario(m=>({...m,nome:e.target.value}))}/></div>
            <div className="row2">
              <div className="field"><label>Codigo de acesso</label><input className="input" value={modalUsuario.codigo_acesso||''} onChange={e=>setModalUsuario(m=>({...m,codigo_acesso:e.target.value.toUpperCase()}))}/></div>
              <div className="field"><label>Papel</label>
                <select className="input" value={modalUsuario.papel} onChange={e=>setModalUsuario(m=>({...m,papel:e.target.value}))}>
                  {PAPEIS.map(p=><option key={p} value={p}>{PAPEL_LABEL[p]}</option>)}
                </select>
              </div>
            </div>
            <button className="btn btn-primary btn-block" onClick={salvarUsuario}>Salvar dados</button>
            <hr className="divider"/>
            <div className="row2">
              <input className="input" type="text" placeholder="Nova senha" value={modalUsuario.novaSenha||''} onChange={e=>setModalUsuario(m=>({...m,novaSenha:e.target.value}))}/>
              <button className="btn btn-ghost" onClick={resetarSenha}>Resetar senha</button>
            </div>
            <hr className="divider"/>
            <button className="btn btn-danger btn-block" onClick={excluirConta}>Excluir conta</button>
          </div>
        </div>
      )}

      {/* Modal novo usuario no condomínio */}
      {modalNovaConta && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModalNovaConta(null)}>
          <div className="modal" style={{ maxHeight:'90vh', overflowY:'auto' }}>
            <div className="modal-header">
              <h3 className="modal-title">Novo usuario</h3>
              <button className="modal-close" onClick={()=>setModalNovaConta(null)}>X</button>
            </div>
            <div style={{ padding:'10px 12px', background:'var(--mint)', borderRadius:'var(--r-md)', marginBottom:16, fontSize:13, color:'var(--emerald)' }}>
              Senha padrao: <b>{SENHA_PADRAO}</b> - o usuario criara senha propria no 1o acesso.
            </div>
            <div className="field"><label>Nome *</label><input className="input" value={novaConta.nome} onChange={e=>setNovaConta(x=>({...x,nome:e.target.value}))}/></div>
            <div className="field"><label>E-mail *</label><input className="input" type="email" value={novaConta.email} onChange={e=>setNovaConta(x=>({...x,email:e.target.value}))}/></div>
            <div className="field"><label>Papel</label>
              <div style={{ marginBottom:6 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', marginBottom:6 }}>Residentes</div>
                <div className="chip-row">
                  {PAPEIS_MORADORES.map(p=>(
                    <button key={p} className={`chip${novaConta.papel===p?' selected':''}`} onClick={()=>setNovaConta(x=>({...x,papel:p}))}>{PAPEL_LABEL[p]}</button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', marginBottom:6 }}>Departamentos operacionais</div>
                <div className="chip-row">
                  {PAPEIS_DEPARTAMENTO.map(p=>(
                    <button key={p} className={`chip${novaConta.papel===p?' selected':''}`} onClick={()=>setNovaConta(x=>({...x,papel:p}))}>{PAPEL_LABEL[p]}</button>
                  ))}
                </div>
              </div>
            </div>
            {/* Bloco e Apartamento — só para moradores e conselheiros */}
            {PAPEIS_MORADORES.includes(novaConta.papel) && (
              <div className="row2">
                <div className="field">
                  <label>Bloco</label>
                  {blocosDoCondo(modalNovaConta).length > 0 ? (
                    <select className="input" value={novaConta.bloco} onChange={e=>setNovaConta(x=>({...x,bloco:e.target.value}))}>
                      <option value="">Selecione...</option>
                      {blocosDoCondo(modalNovaConta).map(b=><option key={b.id} value={b.nome}>{b.nome} ({b.total_apartamentos} un.)</option>)}
                    </select>
                  ) : (
                    <input className="input" value={novaConta.bloco} onChange={e=>setNovaConta(x=>({...x,bloco:e.target.value}))} placeholder="Ex.: Bloco A"/>
                  )}
                </div>
                <div className="field"><label>Apartamento</label><input className="input" value={novaConta.apto} onChange={e=>setNovaConta(x=>({...x,apto:e.target.value}))} placeholder="Ex.: 302"/></div>
              </div>
            )}
            <div className="field">
              <label>Codigo de acesso {novaConta.codigo && <span style={{ fontSize:11, color:'var(--emerald)', fontWeight:600 }}>gerado automaticamente</span>}</label>
              <input className="input" value={novaConta.codigo} onChange={e=>setNovaConta(x=>({...x,codigo:e.target.value.toUpperCase()}))}
                style={novaConta.codigo?{borderColor:'var(--emerald)',fontWeight:700,letterSpacing:1}:{}}/>
            </div>
            {novaConta.papel === 'morador' && (
              <div className="field">
                <label>Tipo de ocupação</label>
                <div className="chip-row">
                  <button className={`chip${novaConta.tipo_ocupacao==='proprietario'?' selected':''}`}
                    onClick={()=>setNovaConta(x=>({...x,tipo_ocupacao:'proprietario'}))}>
                    🏠 Proprietário
                  </button>
                  <button className={`chip${novaConta.tipo_ocupacao==='inquilino'?' selected':''}`}
                    onClick={()=>setNovaConta(x=>({...x,tipo_ocupacao:'inquilino'}))}>
                    🔑 Inquilino
                  </button>
                </div>
              </div>
            )}
            <button className="btn btn-primary btn-block" onClick={criarConta} disabled={salvando}>
              {salvando ? 'Criando...' : 'Criar usuário'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
