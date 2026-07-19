import { getDeliveryBySlug, getDelivery, saveDelivery, saveItemFile } from '@/lib/deliveries'
import { AudioFeedback } from '@/lib/types'

export const maxDuration = 120

const MAX_BYTES = 60 * 1024 * 1024 // 60MB — recado de áudio (bem folgado p/ vários minutos)

// Recado em áudio do cliente (sem login — protegido pelo slug). Só GRAVA o áudio
// no volume; o operador baixa no painel. (Transcrição automática ficou de fora
// por ora: o MediaRecorder do navegador grava webm/opus, que o Gemini não aceita.)
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const ref = getDeliveryBySlug(slug)
  if (!ref) return Response.json({ error: 'não encontrada' }, { status: 404 })
  if (ref.receivedAt) return Response.json({ error: 'recebimento confirmado' }, { status: 410 })

  let form: FormData
  try { form = await request.formData() } catch { return Response.json({ error: 'envie um arquivo de áudio' }, { status: 400 }) }
  const file = form.get('audio')
  if (!(file instanceof File)) return Response.json({ error: 'áudio ausente' }, { status: 400 })
  const mimeType = file.type || 'audio/webm'
  if (!mimeType.startsWith('audio/')) return Response.json({ error: 'envie um arquivo de áudio' }, { status: 400 })
  if (file.size > MAX_BYTES) return Response.json({ error: 'áudio muito grande (máx. 60MB). Grave um recado mais curto.' }, { status: 413 })

  const buf = Buffer.from(await file.arrayBuffer())
  const id = `au_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const ext = (file.name.match(/\.[a-z0-9]+$/i)?.[0] || (mimeType.includes('mp') ? '.mp3' : '.webm')).toLowerCase()
  const stored = `${id}${ext}`
  saveItemFile(ref.id, stored, buf)

  const d = getDelivery(ref.id)!
  const audio: AudioFeedback = { id, file: stored, mimeType, transcript: '', createdAt: new Date().toISOString() }
  d.audios = [...(d.audios || []), audio]
  saveDelivery(d)

  return Response.json({ id: audio.id, createdAt: audio.createdAt })
}
