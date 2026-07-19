import { getDelivery, saveDelivery, deleteItemFile } from '@/lib/deliveries'
import { DeliveryItemStatus } from '@/lib/types'

const STATUS: DeliveryItemStatus[] = ['pendente', 'aprovado', 'reprovado']

// edição interna do item (status/comentário)
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id, itemId } = await params
  const d = getDelivery(id)
  if (!d) return Response.json({ error: 'não encontrada' }, { status: 404 })
  const item = d.itens.find(i => i.id === itemId)
  if (!item) return Response.json({ error: 'item não encontrado' }, { status: 404 })
  const b = await request.json()
  if (b.status && STATUS.includes(b.status)) item.status = b.status
  if (typeof b.comentario === 'string') item.comentario = b.comentario
  item.updatedAt = new Date().toISOString()
  saveDelivery(d)
  return Response.json(item)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id, itemId } = await params
  const d = getDelivery(id)
  if (!d) return Response.json({ error: 'não encontrada' }, { status: 404 })
  const item = d.itens.find(i => i.id === itemId)
  if (item) deleteItemFile(id, item.file)
  d.itens = d.itens.filter(i => i.id !== itemId)
  saveDelivery(d)
  return Response.json({ ok: true })
}
