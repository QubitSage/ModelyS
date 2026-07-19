import { getThread, updateThread, deleteThread } from '@/lib/store'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const clientId = new URL(request.url).searchParams.get('clientId') || ''
  const thread = getThread(clientId, id)
  if (!thread) return Response.json({ error: 'não encontrado' }, { status: 404 })
  return Response.json(thread)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const { clientId, ...patch } = body
  const thread = updateThread(clientId, id, patch)
  if (!thread) return Response.json({ error: 'não encontrado' }, { status: 404 })
  return Response.json(thread)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const clientId = new URL(request.url).searchParams.get('clientId') || ''
  deleteThread(clientId, id)
  return Response.json({ ok: true })
}
