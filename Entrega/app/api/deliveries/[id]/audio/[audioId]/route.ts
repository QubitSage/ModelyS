import { getDelivery, readItemFile } from '@/lib/deliveries'

// Serve/baixa o áudio do recado do cliente pro operador (autenticado pelo
// middleware). ?download=1 força o download com nome de arquivo.
export async function GET(request: Request, { params }: { params: Promise<{ id: string; audioId: string }> }) {
  const { id, audioId } = await params
  const d = getDelivery(id)
  if (!d) return new Response('não encontrada', { status: 404 })
  const audio = d.audios?.find(a => a.id === audioId)
  if (!audio) return new Response('áudio não encontrado', { status: 404 })
  const buf = readItemFile(id, audio.file)
  if (!buf) return new Response('arquivo ausente', { status: 404 })
  const headers: Record<string, string> = {
    'Content-Type': audio.mimeType || 'audio/webm',
    'Content-Length': String(buf.length),
    'Cache-Control': 'private, max-age=3600',
  }
  if (new URL(request.url).searchParams.get('download') === '1') {
    headers['Content-Disposition'] = `attachment; filename="recado-${audio.id}${audio.file.match(/\.[a-z0-9]+$/i)?.[0] || '.webm'}"`
  }
  return new Response(new Uint8Array(buf), { headers })
}
