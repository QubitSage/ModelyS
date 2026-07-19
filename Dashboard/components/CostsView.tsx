'use client'

import { useEffect, useState } from 'react'

interface CostData {
  perClient: Array<{
    id: string; name: string
    inputTokens: number; outputTokens: number; cacheReadTokens: number
    costBrl: number; contractBrl: number; marginBrl: number
  }>
  tools: { totalBrl: number; byKind: Record<string, { count: number; usd: number }> }
  month: { spentBrl: number; budgetBrl: number }
  totalBrl: number
  usdBrl: number
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmt = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}k` : String(n)

export default function CostsView() {
  const [data, setData] = useState<CostData | null>(null)

  useEffect(() => {
    fetch('/api/costs').then(r => r.json()).then(setData)
  }, [])

  if (!data) return <div className="flex-1 grid place-items-center bg-[var(--card)] text-[13px] text-[var(--text-2)]">carregando…</div>

  const pct = Math.min(100, (data.month.spentBrl / data.month.budgetBrl) * 100)

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-[var(--card)] overflow-y-auto">
      <header className="h-14 shrink-0 border-b border-[var(--border)] flex items-center px-5">
        <h1 className="font-semibold text-[15px]">Custos de API</h1>
        <span className="ml-auto text-[12px] text-[var(--text-2)]">USD/BRL: {data.usdBrl.toFixed(2)}</span>
      </header>

      <div className="p-5 space-y-5 max-w-3xl">
        {/* Mês */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-[12px] font-semibold uppercase tracking-wide text-[var(--text-3)]">Este mês</span>
            <span className="text-[13px]"><b>{brl(data.month.spentBrl)}</b> <span className="text-[var(--text-2)]">de {brl(data.month.budgetBrl)}</span></span>
          </div>
          <div className="h-2 rounded-full bg-[var(--panel-2)] overflow-hidden">
            <div className={`h-full rounded-full ${pct > 85 ? 'bg-[var(--red)]' : pct > 60 ? 'bg-[var(--amber)]' : 'bg-[var(--green)]'}`} style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Por cliente */}
        <div>
          <h2 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--text-3)] mb-2">Por cliente (chat, histórico completo)</h2>
          <div className="rounded-xl border border-[var(--border)] overflow-hidden">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="bg-[var(--panel)] text-left text-[11px] uppercase tracking-wide text-[var(--text-3)]">
                  <th className="px-3 py-2 font-semibold">Cliente</th>
                  <th className="px-3 py-2 font-semibold text-right">Tokens in</th>
                  <th className="px-3 py-2 font-semibold text-right">⚡ cache</th>
                  <th className="px-3 py-2 font-semibold text-right">Tokens out</th>
                  <th className="px-3 py-2 font-semibold text-right">Custo</th>
                  <th className="px-3 py-2 font-semibold text-right">Contrato</th>
                  <th className="px-3 py-2 font-semibold text-right">Margem</th>
                </tr>
              </thead>
              <tbody>
                {data.perClient.map(c => (
                  <tr key={c.id} className="border-t border-[var(--border)]">
                    <td className="px-3 py-2 font-medium">{c.name}</td>
                    <td className="px-3 py-2 text-right text-[var(--text-2)]">{fmt(c.inputTokens)}</td>
                    <td className="px-3 py-2 text-right text-[var(--green)]">{fmt(c.cacheReadTokens)}</td>
                    <td className="px-3 py-2 text-right text-[var(--text-2)]">{fmt(c.outputTokens)}</td>
                    <td className="px-3 py-2 text-right">{brl(c.costBrl)}</td>
                    <td className="px-3 py-2 text-right text-[var(--text-2)]">{c.contractBrl ? brl(c.contractBrl) : '—'}</td>
                    <td className={`px-3 py-2 text-right font-medium ${c.marginBrl >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                      {c.contractBrl ? brl(c.marginBrl) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-[var(--text-3)] mt-1.5">
            A coluna ⚡ cache mostra tokens servidos do cache (~10-25% do preço) — se ficar zerada com uso frequente, tem invalidador de cache no caminho.
          </p>
        </div>

        {/* Ferramentas */}
        <div>
          <h2 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--text-3)] mb-2">Chamadas de fundo (biblioteca, resumos)</h2>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 text-[12.5px]">
            {Object.entries(data.tools.byKind).length === 0 && <p className="text-[var(--text-2)]">Nenhuma ainda.</p>}
            {Object.entries(data.tools.byKind).map(([kind, v]) => (
              <div key={kind} className="flex justify-between py-0.5">
                <span>{kind} <span className="text-[var(--text-3)]">×{v.count}</span></span>
                <span>{brl(v.usd * data.usdBrl)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-1.5 mt-1.5 border-t border-[var(--border)] font-semibold">
              <span>Total geral (chat + fundo)</span><span>{brl(data.totalBrl)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
