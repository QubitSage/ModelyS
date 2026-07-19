import { listTerms, saveCustomTerm, getTermRefs, setTermRef } from '@/lib/store'
import { Term } from '@/lib/types'

export async function GET() {
  const refs = getTermRefs()
  const terms = listTerms().map(t => (refs[t.id] ? { ...t, referencia_real: refs[t.id] } : t))
  return Response.json(terms)
}

// Cadastrar/editar termo do usuário
export async function POST(request: Request) {
  const term = (await request.json()) as Term
  if (!term.id || !term.termo || !term.categoria) {
    return Response.json({ error: 'id, termo e categoria são obrigatórios' }, { status: 400 })
  }
  term.custom = true
  saveCustomTerm(term)
  return Response.json(term)
}

// Anexar referência real a um termo
export async function PATCH(request: Request) {
  const { termId, url } = await request.json()
  if (!termId) return Response.json({ error: 'termId obrigatório' }, { status: 400 })
  setTermRef(termId, url || '')
  return Response.json({ ok: true })
}
