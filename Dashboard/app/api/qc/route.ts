import { runQC } from '@/lib/qc'
import { getClient } from '@/lib/store'

export async function POST(request: Request) {
  const { content, clientId } = await request.json()
  if (!content?.trim()) return Response.json({ error: 'conteúdo vazio' }, { status: 400 })
  const client = clientId ? getClient(clientId) : null
  const result = runQC(content, client?.qcBlocklist || [])
  return Response.json(result)
}
