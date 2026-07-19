import { createThread } from '@/lib/store'

export async function POST(request: Request) {
  const { clientId, name, mode } = await request.json()
  if (!clientId) return Response.json({ error: 'clientId obrigatório' }, { status: 400 })
  const thread = createThread(clientId, name || 'Nova conversa', mode || 'producao')
  if (!thread) return Response.json({ error: 'cliente não encontrado' }, { status: 404 })
  return Response.json(thread)
}
