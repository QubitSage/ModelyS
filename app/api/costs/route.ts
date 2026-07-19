import { listClients, getClient } from '@/lib/store'
import { readCostLog, rateFor } from '@/lib/costlog'

const USD_BRL = Number(process.env.USD_BRL) || 5.7
const BUDGET_BRL = Number(process.env.COST_BUDGET_BRL) || 500

function sameMonth(iso: string): boolean {
  const d = new Date(iso)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}

export async function GET() {
  const perClient: Array<{
    id: string; name: string
    inputTokens: number; outputTokens: number; cacheReadTokens: number
    costBrl: number; contractBrl: number; marginBrl: number
  }> = []

  let monthUsd = 0
  let totalUsd = 0

  for (const ci of listClients()) {
    const client = getClient(ci.id)
    if (!client) continue
    let inp = 0, out = 0, cache = 0, usd = 0
    for (const thread of client.threads) {
      for (const msg of thread.messages) {
        if (msg.role !== 'assistant') continue
        const r = rateFor(msg.model || 'gemini')
        inp += msg.inputTokens ?? 0
        out += msg.outputTokens ?? 0
        cache += msg.cacheReadTokens ?? 0
        const u = ((msg.inputTokens ?? 0) / 1e6) * r.in + ((msg.outputTokens ?? 0) / 1e6) * r.out
        usd += u
        if (sameMonth(msg.timestamp)) monthUsd += u
      }
    }
    totalUsd += usd
    const contractBrl = (client.deals ?? []).reduce((s, d) => s + (d.contractBrl || 0), 0)
    perClient.push({
      id: ci.id, name: ci.name,
      inputTokens: inp, outputTokens: out, cacheReadTokens: cache,
      costBrl: usd * USD_BRL,
      contractBrl,
      marginBrl: contractBrl - usd * USD_BRL,
    })
  }

  const toolsLog = readCostLog()
  const toolsUsd = toolsLog.reduce((s, e) => s + (e.estimatedUsd || 0), 0)
  const monthToolsUsd = toolsLog.filter(e => sameMonth(e.at)).reduce((s, e) => s + (e.estimatedUsd || 0), 0)
  // agrupado por função + modelo — deixa visível qual modelo atendeu cada chamada
  const toolsByKind: Record<string, { count: number; usd: number }> = {}
  for (const e of toolsLog) {
    const key = `${e.kind} · ${e.model}`
    toolsByKind[key] = toolsByKind[key] || { count: 0, usd: 0 }
    toolsByKind[key].count++
    toolsByKind[key].usd += e.estimatedUsd || 0
  }

  perClient.sort((a, b) => b.costBrl - a.costBrl)

  return Response.json({
    perClient,
    tools: { totalBrl: toolsUsd * USD_BRL, byKind: toolsByKind },
    month: { spentBrl: (monthUsd + monthToolsUsd) * USD_BRL, budgetBrl: BUDGET_BRL },
    totalBrl: (totalUsd + toolsUsd) * USD_BRL,
    usdBrl: USD_BRL,
  })
}
