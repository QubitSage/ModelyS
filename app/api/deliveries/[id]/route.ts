import { getDelivery, saveDelivery, deleteDelivery, slugTaken, makeSlug, randomSuffix } from '@/lib/deliveries'
import { Delivery } from '@/lib/types'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const d = getDelivery(id)
  if (!d) return Response.json({ error: 'não encontrada' }, { status: 404 })
  return Response.json(d)
}

// Atualiza título/cliente/processo/slug. Slug: se colidir, adiciona sufixo.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const d = getDelivery(id)
  if (!d) return Response.json({ error: 'não encontrada' }, { status: 404 })
  const patch = await request.json()

  if (typeof patch.titulo === 'string') d.titulo = patch.titulo.trim() || d.titulo
  if (typeof patch.clienteNome === 'string') d.clienteNome = patch.clienteNome.trim() || d.clienteNome
  if (patch.processo) d.processo = { ...d.processo, ...patch.processo }
  if (typeof patch.slug === 'string') {
    let s = patch.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '')
    if (!s) s = makeSlug(`${d.clienteNome}-${d.titulo}`)
    if (slugTaken(s, id)) s = `${s}-${randomSuffix()}`
    d.slug = s
  }
  if (patch.regenSlug) d.slug = makeSlug(`${d.clienteNome}-${d.titulo}`)
  if (typeof patch.keep === 'boolean') d.keep = patch.keep // "Manter" / "parar de manter" o backup

  saveDelivery(d)
  return Response.json(d as Delivery)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  deleteDelivery(id)
  return Response.json({ ok: true })
}
