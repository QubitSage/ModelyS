'use client'

import { useEffect, useState } from 'react'
import { Client, ClientIndex, Deal, DealStage } from '@/lib/types'

const STAGES: Array<{ id: DealStage; label: string }> = [
  { id: 'lead', label: 'Lead' },
  { id: 'proposta', label: 'Proposta' },
  { id: 'fechado', label: 'Fechado' },
  { id: 'producao', label: 'Produção' },
  { id: 'revisao', label: 'Revisão' },
  { id: 'entregue', label: 'Entregue' },
]

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

export default function CrmView({ clients, onChanged }: { clients: ClientIndex[]; onChanged: () => void }) {
  const [full, setFull] = useState<Client[]>([])
  const [selected, setSelected] = useState<Client | null>(null)

  async function loadAll() {
    const loaded = await Promise.all(clients.map(c => fetch(`/api/clients/${c.id}`).then(r => r.json())))
    setFull(loaded.filter(c => !c.error))
  }
  useEffect(() => { loadAll() }, [clients]) // eslint-disable-line react-hooks/exhaustive-deps

  async function addDeal(client: Client) {
    const title = prompt('Título do deal:')
    if (!title?.trim()) return
    const contractBrl = Number(prompt('Valor do contrato (R$):', '0')) || 0
    const deal: Deal = {
      id: `d_${Date.now().toString(36)}`,
      title: title.trim(),
      stage: 'lead',
      contractBrl,
      paidBrl: 0,
      notes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await patchClient(client, { deals: [...(client.deals || []), deal] })
  }

  async function moveDeal(client: Client, deal: Deal, dir: 1 | -1) {
    const i = STAGES.findIndex(s => s.id === deal.stage)
    const next = STAGES[i + dir]
    if (!next) return
    const deals = (client.deals || []).map(d => d.id === deal.id ? { ...d, stage: next.id, updatedAt: new Date().toISOString() } : d)
    await patchClient(client, { deals })
  }

  async function patchClient(client: Client, patch: Partial<Client>) {
    await fetch(`/api/clients/${client.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    await loadAll()
    onChanged()
    if (selected?.id === client.id) {
      const res = await fetch(`/api/clients/${client.id}`)
      setSelected(await res.json())
    }
  }

  const dealsByStage = (stage: DealStage) =>
    full.flatMap(c => (c.deals || []).filter(d => d.stage === stage).map(d => ({ client: c, deal: d })))

  const totalContract = full.flatMap(c => c.deals || []).reduce((s, d) => s + d.contractBrl, 0)
  const totalPaid = full.flatMap(c => c.deals || []).reduce((s, d) => s + d.paidBrl, 0)

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-[var(--card)]">
      <header className="h-14 shrink-0 border-b border-[var(--border)] flex items-center px-5 gap-5">
        <h1 className="font-semibold text-[15px]">CRM</h1>
        <span className="text-[12px] text-[var(--text-2)]">Contratos: <b className="text-[var(--text)]">{brl(totalContract)}</b></span>
        <span className="text-[12px] text-[var(--text-2)]">Recebido: <b className="text-[var(--green)]">{brl(totalPaid)}</b></span>
      </header>

      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex gap-3 h-full min-w-max">
          {STAGES.map(stage => {
            const items = dealsByStage(stage.id)
            return (
              <div key={stage.id} className="w-[210px] flex flex-col rounded-xl bg-[var(--panel)] border border-[var(--border)]">
                <div className="px-3 py-2 flex items-center justify-between">
                  <span className="text-[11.5px] font-semibold uppercase tracking-wide text-[var(--text-2)]">{stage.label}</span>
                  <span className="text-[10.5px] text-[var(--text-3)]">{items.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1.5">
                  {items.map(({ client, deal }) => (
                    <div key={deal.id} className="rounded-lg bg-[var(--card)] border border-[var(--border)] p-2.5">
                      <p className="text-[12px] font-medium leading-snug">{deal.title}</p>
                      <button onClick={() => setSelected(client)} className="text-[11px] text-[var(--text-2)] hover:underline"># {client.name}</button>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[11px] font-semibold">{brl(deal.contractBrl)}</span>
                        <span className="flex gap-0.5">
                          <button onClick={() => moveDeal(client, deal, -1)} className="text-[var(--text-3)] hover:text-[var(--text)] text-[11px] px-1">←</button>
                          <button onClick={() => moveDeal(client, deal, 1)} className="text-[var(--text-3)] hover:text-[var(--text)] text-[11px] px-1">→</button>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {/* Clientes sem deal */}
          <div className="w-[210px] flex flex-col rounded-xl border border-dashed border-[var(--border)]">
            <div className="px-3 py-2 text-[11.5px] font-semibold uppercase tracking-wide text-[var(--text-3)]">Sem deal</div>
            <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
              {full.filter(c => !(c.deals || []).length).map(c => (
                <div key={c.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-[var(--panel-2)]">
                  <span className="text-[12px]">{c.name}</span>
                  <button onClick={() => addDeal(c)} className="text-[11px] text-[var(--text-3)] hover:text-[var(--text)]">+ deal</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/30 grid place-items-center" onClick={() => setSelected(null)}>
          <div className="w-[420px] max-h-[80vh] overflow-y-auto rounded-2xl bg-[var(--panel)] border border-[var(--border)] p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-[15px]">{selected.name}</h2>
              <button onClick={() => addDeal(selected)} className="text-[12px] px-2.5 py-1 rounded-lg border border-[var(--border)]">+ deal</button>
            </div>
            <div className="space-y-2">
              {(selected.deals || []).map(d => (
                <div key={d.id} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-2.5 text-[12.5px]">
                  <div className="flex justify-between"><span className="font-medium">{d.title}</span><span>{brl(d.contractBrl)}</span></div>
                  <div className="text-[11px] text-[var(--text-2)] mt-0.5">{d.stage} · pago {brl(d.paidBrl)}</div>
                </div>
              ))}
              {!(selected.deals || []).length && <p className="text-[12.5px] text-[var(--text-2)]">Sem deals ainda.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
