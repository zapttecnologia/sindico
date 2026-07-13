import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { verificarUsoPlano } from '../lib/plano'

function BarraUso({ label, atual, max, pct, cor }) {
  if (max >= 999999) return null // ilimitado
  const corBarra = pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#22c55e'
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ fontWeight: 600, color: 'var(--gray-600)' }}>{label}</span>
        <span style={{ fontWeight: 700, color: pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : 'var(--gray-500)' }}>
          {atual.toLocaleString('pt-BR')} / {max.toLocaleString('pt-BR')}
          {pct >= 80 && <span style={{ marginLeft: 6 }}>{pct >= 100 ? '🔴 Limite atingido' : '🟡 Próximo do limite'}</span>}
        </span>
      </div>
      <div style={{ height: 8, background: 'var(--gray-100)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: corBarra,
          borderRadius: 4, transition: 'width .5s' }}/>
      </div>
    </div>
  )
}

export default function UsoPlanoBadge() {
  const { perfil } = useAuth()
  const [uso, setUso] = useState(null)
  const [expandido, setExpandido] = useState(false)

  useEffect(() => {
    if (!perfil?.empresa_id) return
    verificarUsoPlano(perfil.empresa_id).then(setUso)
  }, [perfil?.empresa_id])

  if (!uso || (!uso.alertar && !expandido)) {
    if (!uso) return null
    return (
      <div onClick={() => setExpandido(true)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
          background: 'var(--gray-50)', border: '1px solid var(--gray-200)',
          borderRadius: 'var(--r-md)', cursor: 'pointer', marginBottom: 16, fontSize: 13 }}>
        <span style={{ fontSize: 14 }}>📊</span>
        <span style={{ color: 'var(--gray-500)' }}>
          Plano <b style={{ color: 'var(--navy)' }}>{uso.planoLabel}</b> ·
          {uso.condos.max < 999999 && ` ${uso.condos.atual}/${uso.condos.max} condos ·`}
          {uso.unidades.max < 999999 && ` ${uso.unidades.atual.toLocaleString('pt-BR')}/${uso.unidades.max.toLocaleString('pt-BR')} unidades`}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--gray-400)' }}>ver detalhes ▼</span>
      </div>
    )
  }

  const bgCor = uso.bloqueado ? '#fef2f2' : uso.alertar ? '#fffbeb' : '#f0fdf4'
  const bordaCor = uso.bloqueado ? '#fecaca' : uso.alertar ? '#fde68a' : '#bbf7d0'
  const iconeCor = uso.bloqueado ? '🔴' : uso.alertar ? '⚠️' : '✅'

  return (
    <div style={{ background: bgCor, border: `1px solid ${bordaCor}`, borderRadius: 'var(--r-lg)',
      padding: '14px 16px', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{iconeCor}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-700)' }}>
            Plano {uso.planoLabel}
          </span>
        </div>
        <button onClick={() => setExpandido(false)}
          style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--gray-400)', cursor: 'pointer' }}>
          ▲ minimizar
        </button>
      </div>

      <BarraUso label="Condomínios" atual={uso.condos.atual} max={uso.condos.max} pct={uso.condos.pct}/>
      <BarraUso label="Unidades totais" atual={uso.unidades.atual} max={uso.unidades.max} pct={uso.unidades.pct}/>

      {uso.bloqueado && (
        <div style={{ padding: '10px 12px', background: '#fee2e2', borderRadius: 'var(--r-md)',
          fontSize: 13, color: '#dc2626', fontWeight: 600, marginTop: 8 }}>
          {uso.motivoBloqueio} — faça upgrade para continuar adicionando condomínios.
        </div>
      )}
      {!uso.bloqueado && uso.alertar && (
        <div style={{ padding: '10px 12px', background: '#fef3c7', borderRadius: 'var(--r-md)',
          fontSize: 13, color: '#92400e', marginTop: 8 }}>
          Você está se aproximando do limite do seu plano. Considere fazer upgrade em breve.
        </div>
      )}
    </div>
  )
}
