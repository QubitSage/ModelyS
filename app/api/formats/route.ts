import { listFormats, saveFormat, deleteFormat } from '@/lib/formats'
import { FormatEntry } from '@/lib/types'

export async function GET() {
  return Response.json(listFormats())
}

export async function POST(request: Request) {
  const b = await request.json()
  if (!b.clienteProjeto?.trim() || !b.descricao?.trim()) {
    return Response.json({ error: 'cliente/projeto e descrição são obrigatórios' }, { status: 400 })
  }
  const entry: FormatEntry = {
    id: b.id || `fmt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    clienteProjeto: String(b.clienteProjeto).trim(),
    tipo: String(b.tipo || 'outro').trim(),
    descricao: String(b.descricao).trim(),
    data: b.data ? String(b.data) : new Date().toISOString().slice(0, 10),
    metrica: b.metrica ? String(b.metrica).trim() : undefined,
    link: b.link ? String(b.link).trim() : undefined,
    tags: Array.isArray(b.tags) ? b.tags.map(String).map((t: string) => t.trim()).filter(Boolean) : [],
    createdAt: b.createdAt || new Date().toISOString(),
  }
  saveFormat(entry)
  return Response.json(entry)
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get('id') || ''
  if (!id) return Response.json({ error: 'id obrigatório' }, { status: 400 })
  deleteFormat(id)
  return Response.json({ ok: true })
}
