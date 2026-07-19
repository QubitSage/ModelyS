import { listClients, createClient } from '@/lib/store'

export async function GET() {
  return Response.json(listClients())
}

export async function POST(request: Request) {
  const { name } = await request.json()
  if (!name?.trim()) return Response.json({ error: 'nome obrigatório' }, { status: 400 })
  return Response.json(createClient(name.trim()))
}
