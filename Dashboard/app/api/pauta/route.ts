import { huntPautas } from '@/lib/pauta'

// Caçador de Pauta — busca web + filtro + pauta pronta, por cliente.

export const maxDuration = 120

export async function POST(request: Request) {
  const { clientId, tema } = await request.json()
  const r = await huntPautas(clientId || undefined, typeof tema === 'string' && tema.trim() ? tema.trim() : undefined)
  return Response.json(r)
}
