import { getClient, setCreativeDefault } from '@/lib/store'
import { CreativeProvider } from '@/lib/types'

// Modelo padrão da Direção Criativa por cliente (seção 3) — promoção manual.

const VALID: CreativeProvider[] = ['sonnet', 'gemini', 'gpt', 'grok']

export async function GET(request: Request) {
  const clientId = new URL(request.url).searchParams.get('clientId') || ''
  const c = clientId ? getClient(clientId) : null
  return Response.json({ creativeDefault: c?.creativeDefault ?? null })
}

export async function POST(request: Request) {
  const { clientId, provider } = await request.json()
  if (!clientId) return Response.json({ error: 'clientId obrigatório' }, { status: 400 })
  if (provider && !VALID.includes(provider)) return Response.json({ error: 'provider inválido' }, { status: 400 })
  const c = setCreativeDefault(clientId, provider || undefined)
  if (!c) return Response.json({ error: 'cliente não encontrado' }, { status: 404 })
  return Response.json({ creativeDefault: c.creativeDefault ?? null })
}
