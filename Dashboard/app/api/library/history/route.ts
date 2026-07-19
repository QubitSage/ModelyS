import { listTerms, listLibraryHistory, pushLibraryHistory, clearLibraryHistory } from '@/lib/store'

export async function GET() {
  return Response.json(listLibraryHistory())
}

// Registra uso de um termo (disparado ao copiar um prompt).
export async function POST(request: Request) {
  const { termId, texto, rotulo } = await request.json()
  if (!termId || !texto) return Response.json({ error: 'termId e texto obrigatórios' }, { status: 400 })
  const term = listTerms().find(t => t.id === termId)
  if (!term) return Response.json({ error: 'termo não encontrado' }, { status: 404 })
  pushLibraryHistory({
    termId,
    termo: term.termo,
    categoria: term.categoria,
    rotulo: rotulo || '',
    texto,
    timestamp: new Date().toISOString(),
  })
  return Response.json({ ok: true })
}

export async function DELETE() {
  clearLibraryHistory()
  return Response.json({ ok: true })
}
