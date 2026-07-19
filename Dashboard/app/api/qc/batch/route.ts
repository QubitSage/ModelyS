import { parseBatchInput, runQCItem, escalateToHaiku, normalizeId, BatchItemResult } from '@/lib/qc-batch'
import { getClient } from '@/lib/store'

export const maxDuration = 300

export async function POST(request: Request) {
  const { content, clientId, useAi } = await request.json()
  if (!content?.trim()) return Response.json({ error: 'conteúdo vazio' }, { status: 400 })

  const items = parseBatchInput(content)
  if (!items.length) return Response.json({ error: 'nenhum take reconhecido no arquivo' }, { status: 400 })

  const blocklist = (clientId ? getClient(clientId)?.qcBlocklist : null) || []

  // Camada 1 — determinística, custo zero
  const results: BatchItemResult[] = items.map(item => runQCItem(item, blocklist))

  // Camada 2 — só os ambíguos, numa única chamada Haiku
  let aiUsed = 0
  if (useAi) {
    const ambiguous = results.filter(r => r.status === 'ambiguo')
    if (ambiguous.length) {
      const verdicts = await escalateToHaiku(ambiguous, blocklist)
      aiUsed = verdicts.size
      for (const r of results) {
        const v = verdicts.get(normalizeId(r.id))
        if (r.status === 'ambiguo' && v) {
          r.ai = v
          r.status = v.verdict
        }
      }
    }
  }

  return Response.json({
    total: results.length,
    aprovados: results.filter(r => r.status === 'aprovado').length,
    revisar: results.filter(r => r.status !== 'aprovado').length,
    aiUsed,
    results,
  })
}
