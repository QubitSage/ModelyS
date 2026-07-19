import { saveRound, scoreboardFor, clearClient, MIN_ROUNDS } from '@/lib/calibration'
import { CalibRound } from '@/lib/types'

// Placar de calibração POR CLIENTE (seção 3).

export async function GET(request: Request) {
  const clientId = new URL(request.url).searchParams.get('clientId') || ''
  return Response.json({ scoreboard: scoreboardFor(clientId), minRounds: MIN_ROUNDS })
}

// Registra uma rodada (voto real + notas opcionais).
export async function POST(request: Request) {
  const b = await request.json()
  if (!b.runId) return Response.json({ error: 'runId obrigatório' }, { status: 400 })
  const round: CalibRound = {
    runId: String(b.runId),
    clientId: String(b.clientId || ''),
    date: new Date().toISOString(),
    idea: String(b.idea || '').slice(0, 200),
    escolhido: b.escolhido ?? null,
    notas: b.notas && typeof b.notas === 'object' ? b.notas : undefined,
    taskTag: b.taskTag ? String(b.taskTag).slice(0, 40) : undefined,
  }
  saveRound(round)
  return Response.json({ scoreboard: scoreboardFor(round.clientId) })
}

export async function DELETE(request: Request) {
  const clientId = new URL(request.url).searchParams.get('clientId') || ''
  clearClient(clientId)
  return Response.json({ scoreboard: scoreboardFor(clientId) })
}
