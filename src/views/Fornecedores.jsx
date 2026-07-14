import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const VAZIO = {
  tipo_pessoa:'pj', razao_social:'', nome_fantasia:'', cnpj_cpf:'',
  contato_nome:'', telefone:'', email:'',
  cep:'', logradouro:'', bairro:'', cidade:'', uf:'',
  categoria:'', observacoes:'',
  banco:'', agencia:'', conta:'', pix:'',
  ativo:true,
}

export default function Fornecedores({ onToast }) {
  const { perfil } = useAuth()
  const [fornecedores, setFornecedores] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState(null)     // objeto (novo/editar) ou null
  const [salvando, setSalvando] = useState(false)

  const carregar = async () => {
    setLoading(true)
    const { data } = await supabase.from('fornecedores')
      .select('*').eq('empresa_id', perfil.empresa_id).order('razao_social')
    setFornecedores(data || [])
    setLoading(false)
  }

  useEffect(() => { if (perfil?.empresa_id) carregar() }, [perfil?.empresa_id])

  const set = (campo, valor) => setModal(m => ({ ...m, [campo]: valor }))

  const salvar = async () => {
    if (!modal.razao_social?.trim()) { onToast('Informe o nome / razão social.'); return }
    setSalvando(true)
    const payload = {
      empresa_id: perfil.empresa_id,
      tipo_pessoa: modal.tipo_pessoa || 'pj',
      razao_social: modal.razao_social.trim(),
      nome_fantasia: modal.nome_fantasia?.trim() || null,
      cnpj_cpf: modal.cnpj_cpf?.trim() || null,
      contato_nome: modal.contato_nome?.trim() || null,
      telefone: modal.telefone?.trim() || null,
      email: modal.email?.trim() || null,
      cep: modal.cep?.trim() || null,
      logradouro: modal.logradouro?.trim() || null,
      bairro: modal.bairro?.trim() || null,
      cidade: modal.cidade?.trim() || null,
      uf: modal.uf?.trim() || null,
      categoria: modal.categoria?.trim() || null,
      observacoes: modal.observacoes?.trim() || null,
      banco: modal.banco?.trim() || null,
      agencia: modal.agencia?.trim() || null,
      conta: modal.conta?.trim() || null,
      pix: modal.pix?.trim() || null,
      ativo: modal.ativo !== false,
      atualizado_em: new Date().toISOString(),
    }
    let error
    if (modal.id) {
      ({ error } = await supabase.from('fornecedores').update(payload).eq('id', modal.id))
    } else {
      ({ error } = await supabase.from('fornecedores').insert(payload))
    }
    setSalvando(false)
    if (error) { onToast('Erro: ' + error.message); return }
    onToast('Fornecedor salvo!'); setModal(null); await carregar()
  }

  const excluir = async (id) => {
    if (!window.confirm('Excluir este fornecedor?')) return
    const { error } = await supabase.from('fornecedores').delete().eq('id', id)
    if (error) { onToast('Erro: ' + error.message); return }
    onToast('Fornecedor excluído.'); await carregar()
  }

  const toggleAtivo = async (f) => {
    await supabase.from('fornecedores').update({ ativo: !f.ativo }).eq('id', f.id)
    await carregar()
  }

  const filtrados = fornecedores.filter(f => {
    if (!busca.trim()) return true
    const q = busca.toLowerCase()
    return [f.razao_social, f.nome_fantasia, f.cnpj_cpf, f.categoria, f.cidade]
      .some(v => (v || '').toLowerCase().includes(q))
  })

  return (
    <div>
      <div className="page-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
        <div>
          <h1 className="page-title">Fornecedores</h1>
          <p className="page-sub">Cadastro de fornecedores para orçamentos e aprovações do conselho</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({ ...VAZIO })}>+ Novo fornecedor</button>
      </div>

      <div style={{ margin:'16px 0' }}>
        <input className="input" placeholder="Buscar por nome, CNPJ, categoria ou cidade..."
          value={busca} onChange={e => setBusca(e.target.value)} style={{ maxWidth:420 }} />
      </div>

      {loading ? (
        <div className="empty-state">Carregando...</div>
      ) : filtrados.length === 0 ? (
        <div className="empty-state">
          {fornecedores.length === 0 ? 'Nenhum fornecedor cadastrado ainda.' : 'Nenhum resultado para a busca.'}
        </div>
      ) : (
        <div style={{ display:'grid', gap:10 }}>
          {filtrados.map(f => (
            <div key={f.id} className="card" style={{ display:'flex', alignItems:'center', gap:14, opacity:f.ativo?1:.55 }}>
              <div style={{ width:44, height:44, borderRadius:10, background:'var(--gray-100)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
                {f.tipo_pessoa === 'pf' ? '👤' : '🏢'}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:15, fontWeight:700, color:'var(--navy)' }}>
                  {f.razao_social}
                  {f.nome_fantasia && <span style={{ fontWeight:500, color:'var(--gray-500)' }}> · {f.nome_fantasia}</span>}
                  {!f.ativo && <span style={{ fontSize:10, marginLeft:8, padding:'2px 8px', background:'var(--gray-100)', color:'var(--gray-500)', borderRadius:10, fontWeight:700 }}>INATIVO</span>}
                </div>
                <div style={{ fontSize:12, color:'var(--gray-400)', marginTop:2, display:'flex', gap:10, flexWrap:'wrap' }}>
                  {f.categoria && <span>🏷 {f.categoria}</span>}
                  {f.cnpj_cpf && <span>📄 {f.cnpj_cpf}</span>}
                  {f.telefone && <span>📞 {f.telefone}</span>}
                  {(f.cidade || f.uf) && <span>📍 {[f.cidade, f.uf].filter(Boolean).join('/')}</span>}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => toggleAtivo(f)} title={f.ativo?'Desativar':'Ativar'}>
                {f.ativo ? '👁' : '🚫'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal({ ...f })}>Editar</button>
              <button className="btn btn-ghost btn-sm" style={{ color:'var(--rust)' }} onClick={() => excluir(f.id)}>Excluir</button>
            </div>
          ))}
        </div>
      )}

      {/* Modal de cadastro/edição */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal" style={{ maxWidth:640, width:'100%', maxHeight:'90vh', overflowY:'auto' }}>
            <div className="modal-header">
              <h3 className="modal-title">{modal.id ? 'Editar' : 'Novo'} fornecedor</h3>
              <button className="modal-close" onClick={() => setModal(null)}>×</button>
            </div>

            {/* Identificação */}
            <div className="section-title" style={{ marginTop:4 }}>Identificação</div>
            <div className="field">
              <label>Tipo</label>
              <div style={{ display:'flex', gap:8 }}>
                {[['pj','Pessoa jurídica'],['pf','Pessoa física']].map(([v,l]) => (
                  <button key={v} type="button" onClick={() => set('tipo_pessoa', v)}
                    className={`chip${modal.tipo_pessoa===v?' selected':''}`}>{l}</button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>{modal.tipo_pessoa === 'pf' ? 'Nome completo *' : 'Razão social *'}</label>
              <input className="input" value={modal.razao_social||''} onChange={e => set('razao_social', e.target.value)}
                placeholder={modal.tipo_pessoa === 'pf' ? 'Nome do prestador' : 'Ex.: Elétrica Silva Ltda'} />
            </div>
            <div className="row2" style={{ display:'flex', gap:12 }}>
              <div className="field" style={{ flex:1 }}>
                <label>Nome fantasia</label>
                <input className="input" value={modal.nome_fantasia||''} onChange={e => set('nome_fantasia', e.target.value)} placeholder="Opcional" />
              </div>
              <div className="field" style={{ flex:1 }}>
                <label>{modal.tipo_pessoa === 'pf' ? 'CPF' : 'CNPJ'}</label>
                <input className="input" value={modal.cnpj_cpf||''} onChange={e => set('cnpj_cpf', e.target.value)} placeholder={modal.tipo_pessoa === 'pf' ? '000.000.000-00' : '00.000.000/0000-00'} />
              </div>
            </div>

            {/* Contato */}
            <div className="section-title">Contato</div>
            <div className="row2" style={{ display:'flex', gap:12 }}>
              <div className="field" style={{ flex:1 }}>
                <label>Pessoa de contato</label>
                <input className="input" value={modal.contato_nome||''} onChange={e => set('contato_nome', e.target.value)} placeholder="Nome de quem atende" />
              </div>
              <div className="field" style={{ flex:1 }}>
                <label>Telefone / WhatsApp</label>
                <input className="input" value={modal.telefone||''} onChange={e => set('telefone', e.target.value)} placeholder="(00) 00000-0000" />
              </div>
            </div>
            <div className="field">
              <label>E-mail</label>
              <input className="input" type="email" value={modal.email||''} onChange={e => set('email', e.target.value)} placeholder="contato@fornecedor.com" />
            </div>

            {/* Endereço */}
            <div className="section-title">Endereço</div>
            <div className="row2" style={{ display:'flex', gap:12 }}>
              <div className="field" style={{ width:140 }}>
                <label>CEP</label>
                <input className="input" value={modal.cep||''} onChange={e => set('cep', e.target.value)} placeholder="00000-000" />
              </div>
              <div className="field" style={{ flex:1 }}>
                <label>Logradouro</label>
                <input className="input" value={modal.logradouro||''} onChange={e => set('logradouro', e.target.value)} placeholder="Rua, número, complemento" />
              </div>
            </div>
            <div className="row2" style={{ display:'flex', gap:12 }}>
              <div className="field" style={{ flex:1 }}>
                <label>Bairro</label>
                <input className="input" value={modal.bairro||''} onChange={e => set('bairro', e.target.value)} />
              </div>
              <div className="field" style={{ flex:1 }}>
                <label>Cidade</label>
                <input className="input" value={modal.cidade||''} onChange={e => set('cidade', e.target.value)} />
              </div>
              <div className="field" style={{ width:80 }}>
                <label>UF</label>
                <input className="input" value={modal.uf||''} maxLength={2} onChange={e => set('uf', e.target.value.toUpperCase())} placeholder="SP" />
              </div>
            </div>

            {/* Classificação */}
            <div className="section-title">Classificação</div>
            <div className="field">
              <label>Categoria de serviço</label>
              <input className="input" value={modal.categoria||''} onChange={e => set('categoria', e.target.value)} placeholder="Ex.: Elétrica, Hidráulica, Limpeza, Jardinagem" />
            </div>
            <div className="field">
              <label>Observações</label>
              <textarea className="input" rows={2} value={modal.observacoes||''} onChange={e => set('observacoes', e.target.value)} placeholder="Notas internas sobre o fornecedor" />
            </div>

            {/* Dados bancários */}
            <div className="section-title">Dados bancários (opcional)</div>
            <div className="row2" style={{ display:'flex', gap:12 }}>
              <div className="field" style={{ flex:1 }}>
                <label>Banco</label>
                <input className="input" value={modal.banco||''} onChange={e => set('banco', e.target.value)} />
              </div>
              <div className="field" style={{ width:110 }}>
                <label>Agência</label>
                <input className="input" value={modal.agencia||''} onChange={e => set('agencia', e.target.value)} />
              </div>
              <div className="field" style={{ width:140 }}>
                <label>Conta</label>
                <input className="input" value={modal.conta||''} onChange={e => set('conta', e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label>Chave PIX</label>
              <input className="input" value={modal.pix||''} onChange={e => set('pix', e.target.value)} placeholder="CNPJ, e-mail, telefone ou chave aleatória" />
            </div>

            <div style={{ display:'flex', gap:10, marginTop:16 }}>
              <button className="btn btn-ghost" style={{ flex:1 }} onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex:1 }} onClick={salvar} disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar fornecedor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
