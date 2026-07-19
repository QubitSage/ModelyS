import { listIndex, saveDelivery, makeSlug, sweepExpiredDeliveries } from '@/lib/deliveries'
import { Delivery } from '@/lib/types'

export async function GET() {
  sweepExpiredDeliveries() // ao abrir o painel, limpa as entregas vencidas
  return Response.json(listIndex())
}

// cria uma entrega vazia (processo em branco, sem itens ainda)
export async function POST(request: Request) {
  const b = await request.json()
  const titulo = String(b.titulo || '').trim() || 'Entrega'
  const clienteNome = String(b.clienteNome || '').trim() || 'Cliente'
  const id = `d_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const delivery: Delivery = {
    id,
    clientId: b.clientId || undefined,
    clienteNome,
    titulo,
    slug: makeSlug(`${clienteNome}-${titulo}`),
    createdAt: new Date().toISOString(),
    processo: { origem: '', direcoes: [], direcaoEscolhida: '', motivoEscolha: '', qcValidado: false },
    itens: [],
  }
  saveDelivery(delivery)
  return Response.json(delivery)
}
