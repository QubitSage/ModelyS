import { getDeliveryBySlug, sweepExpiredDeliveries } from '@/lib/deliveries'

// Dados públicos da entrega (acesso por slug, sem login). Não expõe o id
// interno nem caminhos de arquivo — o cliente usa slug + itemId.
export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  sweepExpiredDeliveries()
  const d = getDeliveryBySlug(slug)
  if (!d) return Response.json({ error: 'não encontrada' }, { status: 404 })
  if (d.receivedAt) return Response.json({ received: true, receivedAt: d.receivedAt, titulo: d.titulo, clienteNome: d.clienteNome })
  return Response.json({
    titulo: d.titulo,
    clienteNome: d.clienteNome,
    createdAt: d.createdAt,
    processo: d.processo,
    itens: d.itens.map(i => ({
      id: i.id,
      tipo: i.tipo,
      thumbnail: i.thumbnail,
      status: i.status,
      comentario: i.comentario,
      originalName: i.originalName,
    })),
    audios: (d.audios || []).map(a => ({ id: a.id, transcript: a.transcript, createdAt: a.createdAt })),
  })
}
