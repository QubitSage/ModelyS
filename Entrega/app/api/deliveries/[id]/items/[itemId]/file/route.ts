import { getDelivery, readItemFile } from '@/lib/deliveries'

// Download interno do arquivo 4K (operador, autenticado pelo middleware). Serve
// mesmo depois do cliente confirmar o recebimento — é o backup de 24h pra baixar
// antes de sumir. ?download=1 força o download.
export async function GET(request: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id, itemId } = await params
  const d = getDelivery(id)
  if (!d) return new Response('não encontrada', { status: 404 })
  const item = d.itens.find(i => i.id === itemId)
  if (!item) return new Response('item não encontrado', { status: 404 })
  const buf = readItemFile(id, item.file)
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
