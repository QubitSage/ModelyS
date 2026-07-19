import { getDeliveryBySlug, confirmReceipt } from '@/lib/deliveries'

// Cliente confirma o recebimento (sem login — protegido pelo slug). Trava o
// acesso dele e arma a janela de 24h de backup do operador. Idempotente.
export async function POST(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const ref = getDeliveryBySlug(slug)
  if (!ref) return Response.json({ error: 'não encontrada' }, { status: 404 })
  const d = confirmReceipt(ref.id)
  return Response.json({ ok: true, receivedAt: d?.receivedAt })
}
