import { getDelivery, saveDelivery, saveItemFile } from '@/lib/deliveries'
import { DeliveryItem } from '@/lib/types'

export const maxDuration = 120

// Upload de UM item (multipart): file (4K, vai pro disco) + thumbnail (dataUrl
// pequeno gerado no cliente, fica no JSON pra galeria leve).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const d = getDelivery(id)
  if (!d) return Response.json({ error: 'não encontrada' }, { status: 404 })

  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return Response.json({ error: 'arquivo ausente' }, { status: 400 })

  const buf = Buffer.from(await file.arrayBuffer())
  const mimeType = file.type || 'application/octet-stream'
  const tipo = mimeType.startsWith('video/') ? 'video' : 'imagem'
  const itemId = `it_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const ext = (file.name.match(/\.[a-z0-9]+$/i)?.[0] || '').toLowerCase()
  const stored = `${itemId}${ext}`
  saveItemFile(id, stored, buf)

  const item: DeliveryItem = {
    id: itemId,
    tipo,
    file: stored,
    mimeType,
    originalName: file.name,
    thumbnail: String(form.get('thumbnail') || '') || undefined,
    status: 'pendente',
    updatedAt: new Date().toISOString(),
  }
  d.itens.push(item)
  saveDelivery(d)
  return Response.json(item)
}
