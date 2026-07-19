import { runArenaSlots, providers } from '@/lib/creative'

// Bake-off por SLOTS: 1 busca de tendências + cada modelo devolve slots com
// papel fixo (padrao / repertorio / aberto). Não elege vencedor — o usuário
// compara e vota (cego + notas na UI).

export const maxDuration = 180

export async function GET() {
  // disponibilidade dos providers (pra UI marcar quem está pendente de chave)
  return Response.json({ providers: providers().map(({ id, label, model, hasKey }) => ({ id, label, model, hasKey })) })
}

export async function POST(request: Request) {
  const { idea, clientId, aberto, only, files, link } = await request.json()
  if (!idea?.trim()) return Response.json({ error: 'ideia vazia' }, { status: 400 })
  const { results, trendsOk } = await runArenaSlots(
    idea,
    clientId || undefined,
    typeof aberto === 'string' ? aberto : undefined,
    Array.isArray(only) && only.length ? only : undefined,
    Array.isArray(files) ? files : undefined,
    typeof link === 'string' ? link : undefined,
  )
  return Response.json({ results, trendsOk })
}
