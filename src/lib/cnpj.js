import { supabase } from './supabase'

// Remove tudo que não for dígito
export const soDigitosCNPJ = (s) => (s || '').replace(/\D/g, '')

// Aplica máscara 00.000.000/0000-00 conforme digita
export const mascaraCNPJ = (v) => {
  const d = soDigitosCNPJ(v).slice(0, 14)
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

// true quando já tem os 14 dígitos (para disparar a busca automática)
export const cnpjCompleto = (v) => soDigitosCNPJ(v).length === 14

// Consulta os dados do CNPJ na Edge Function 'consultar-cnpj'.
// Retorna { ok, dados } ou lança erro com mensagem amigável.
export async function consultarCNPJ(cnpj) {
  const doc = soDigitosCNPJ(cnpj)
  if (doc.length !== 14) throw new Error('CNPJ deve ter 14 dígitos.')

  const { data: s } = await supabase.auth.getSession()
  const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/consultar-cnpj`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${s.session?.access_token}`,
    },
    body: JSON.stringify({ cnpj: doc }),
  })
  const json = await resp.json()
  if (!resp.ok) throw new Error(json.error || 'Não foi possível consultar o CNPJ.')
  return json  // { ok, fonte, dados: { razao_social, nome_fantasia, email, telefone, cep, logradouro, bairro, cidade, uf, ... } }
}
