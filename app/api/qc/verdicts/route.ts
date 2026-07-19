import { addVerdict, readSuggestions, resolveSuggestion, reportBlockedTake } from '@/lib/qc-learn'

export async function GET(request: Request) {
  const clientId = new URL(request.url).searchParams.get('clientId')
  const sugestoes = readSuggestions().filter(s => s.status === 'pendente' && (!clientId || s.clientId === clientId))
  return Response.json({ sugestoes })
}

export async function POST(request: Request) {
  const body = await request.json()

  // registrar veredicto de um finding
  if (body.action === 'verdict') {
    addVerdict({
      at: '',
      clientId: body.clientId,
      regra: body.regra,
      motivo: body.motivo || '',
      decision: body.decision,
      termo: body.termo,
    })
    return Response.json({ ok: true })
  }

  // reportar take que o Flow bloqueou apesar de passar no QC
  if (body.action === 'report-block') {
    const created = reportBlockedTake(body.clientId, body.content || '')
    return Response.json({ ok: true, sugestoes: created })
  }

  // aceitar/recusar sugestão
  if (body.action === 'resolve') {
    const s = resolveSuggestion(body.id, !!body.accept)
    return Response.json({ ok: !!s, sugestao: s })
  }

  return Response.json({ error: 'action inválida' }, { status: 400 })
}
