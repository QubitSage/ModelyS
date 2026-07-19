import { getDelivery } from '@/lib/deliveries'

// Status leve (sem thumbnails) — pro painel interno fazer polling e refletir
// aprovações/comentários do cliente ao vivo, sem recarregar a página.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const d = getDelivery(id)
  if (!d) return Response.json({ error: 'não encontrada' }, { status: 404 })
  return Response.json({
    itens: d.itens.map(i => ({ id: i.id, status: i.status, comentario: i.comentario, updatedAt: i.updatedAt })),
    audios: (d.audios || []).map(a => ({ id: a.id, transcript: a.transcript, createdAt: a.createdAt })),
  })
}
