import { getDeliveryBySlug, getDelivery, saveDelivery } from '@/lib/deliveries'
import { DeliveryItemStatus } from '@/lib/types'

const STATUS: DeliveryItemStatus[] = ['pendente', 'aprovado', 'reprovado']

// Aprovação PÚBLICA (cliente, sem login) — a proteção é o slug com sufixo
// aleatório. Só permite mexer em status/comentário do próprio item.
export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string; itemId: string }> }) {
  const { slug, itemId } = await params
  const ref = getDeliveryBySlug(slug)
  if (!ref) return Response.json({ error: 'não encontrada' }, { status: 404 })
  if (ref.receivedAt) return Response.json({ error: 'recebimento confirmado' }, { status: 410 })
  const d = getDelivery(ref.id)!
  const item = d.itens.find(i => i.id === itemId)
  if (!item) return Response.json({ error: 'item não encontrado' }, { status: 404 })

  const b = await request.json()
  if (b.status && STATUS.includes(b.status)) item.status = b.status
  if (typeof b.comentario === 'string') item.comentario = b.comentario.slice(0, 2000)
  item.updatedAt = new Date().toISOString()
  saveDelivery(d)
  return Response.json({ id: item.id, status: item.status, comentario: item.comentario })
}
