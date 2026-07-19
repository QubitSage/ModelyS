import { runDirection } from '@/lib/creative'

// Direção Criativa (seção 1): 1 modelo — o padrão calibrado do cliente, ou o
// fallback global. Não pergunta qual modelo. Saída = 2-3 direções.

export const maxDuration = 90

export async function POST(request: Request) {
  const { idea, clientId, files } = await request.json()
  if (!idea?.trim()) return Response.json({ error: 'ideia vazia' }, { status: 400 })
  const result = await runDirection(idea, clientId || undefined, Array.isArray(files) ? files : undefined)
  return Response.json({ result })
}
