import { runDebate } from '@/lib/creative'

// Comitê automático (multi-agent debate): as 4 LLMs propõem, debatem/votam e o
// presidente consolida UM consenso. É a nova cara da "Direção Criativa" — pra
// quando o operador quer que os modelos decidam entre si e só copiar pro chat.

export const maxDuration = 300 // 3 rodadas encadeadas de várias chamadas

export async function POST(request: Request) {
  const { idea, clientId, files } = await request.json()
  if (!idea?.trim()) return Response.json({ error: 'ideia vazia' }, { status: 400 })
  const result = await runDebate(idea, clientId || undefined, Array.isArray(files) ? files : undefined)
  return Response.json({ result })
}
