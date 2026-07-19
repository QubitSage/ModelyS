import { truncateThread } from '@/lib/store'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { clientId, messageId, inclusive } = await request.json()
  if (!clientId || !messageId) return Response.json({ error: 'clientId e messageId obrigatórios' }, { status: 400 })
  const thread = truncateThread(clientId, id, messageId, inclusive !== false)
  if (!thread) return Response.json({ error: 'não encontrado' }, { status: 404 })
  return Response.json(thread)
}
