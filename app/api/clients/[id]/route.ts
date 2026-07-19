import { getClient, saveClient, deleteClient } from '@/lib/store'
import { Client } from '@/lib/types'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const client = getClient(id)
  if (!client) return Response.json({ error: 'não encontrado' }, { status: 404 })
  return Response.json(client)
}

// Patch raso — CRM (deals/contacts/activities), memórias, blocklist de QC etc.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const client = getClient(id)
  if (!client) return Response.json({ error: 'não encontrado' }, { status: 404 })
  const patch = (await request.json()) as Partial<Client>
  delete patch.id
  delete patch.threads // threads têm rotas próprias
  const updated = { ...client, ...patch }
  saveClient(updated)
  return Response.json(updated)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  deleteClient(id)
  return Response.json({ ok: true })
}
