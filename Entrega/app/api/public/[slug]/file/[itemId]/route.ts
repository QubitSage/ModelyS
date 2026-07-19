import { getDeliveryBySlug, readItemFile } from '@/lib/deliveries'

// Serve o arquivo 4K por slug+itemId. ?download=1 força download (Content-
// Disposition attachment); senão exibe inline (preview/lightbox).
export async function GET(request: Request, { params }: { params: Promise<{ slug: string; itemId: string }> }) {
  const { slug, itemId } = await params
  const d = getDeliveryBySlug(slug)
  if (!d) return new Response('não encontrada', { status: 404 })
  if (d.receivedAt) return new Response('recebimento confirmado — conteúdo liberado', { status: 410 })
  const item = d.itens.find(i => i.id === itemId)
  if (!item) return new Response('item não encontrado', { status: 404 })
  const buf = readItemFile(d.id, item.file)
  if (!buf) return new Response('arquivo ausente', { status: 404 })

  const download = new URL(request.url).searchParams.get('download') === '1'
  const name = item.originalName || item.file
  const headers: Record<string, string> = {
    'Content-Type': item.mimeType || 'application/octet-stream',
    'Content-Length': String(buf.length),
    'Cache-Control': 'private, max-age=3600',
  }
  if (download) headers['Content-Disposition'] = `attachment; filename="${name.replace(/"/g, '')}"`
  return new Response(new Uint8Array(buf), { headers })
}
