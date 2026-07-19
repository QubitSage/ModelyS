import fs from 'fs'
import path from 'path'
import { atomicWriteFileSync } from '@/lib/store'
import { parseBatchInput } from '@/lib/qc-batch'

// Esteira de takes: a fila de produção do Flow. Uma sessão ativa por vez,
// persistida em disco — fecha o app no take 130 e retoma dali.

const FILE = path.join(process.cwd(), 'data', 'esteira.json')

export interface EsteiraTake {
  id: string
  content: string
  status: 'pendente' | 'gerado' | 'refazer'
}

export interface EsteiraSession {
  nome: string
  createdAt: string
  current: number
  takes: EsteiraTake[]
}

function read(): EsteiraSession | null {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf-8'))
  } catch {
    return null
  }
}

function save(s: EsteiraSession) {
  atomicWriteFileSync(FILE, JSON.stringify(s, null, 2))
}

export async function GET() {
  return Response.json(read())
}

// Nova sessão a partir de conteúdo bruto (colado/arquivo/aprovados do QC)
export async function POST(request: Request) {
  const { content, nome } = await request.json()
  if (!content?.trim()) return Response.json({ error: 'conteúdo vazio' }, { status: 400 })
  const items = parseBatchInput(content)
  if (!items.length) return Response.json({ error: 'nenhum take reconhecido' }, { status: 400 })

  const session: EsteiraSession = {
    nome: nome?.trim() || `Sessão ${new Date().toLocaleDateString('pt-BR')}`,
    createdAt: new Date().toISOString(),
    current: 0,
    takes: items.map(i => ({ id: i.id, content: i.content, status: 'pendente' })),
  }
  save(session)
  return Response.json(session)
}

// Atualiza posição/status: { current?, takeIndex?, status? }
export async function PATCH(request: Request) {
  const session = read()
  if (!session) return Response.json({ error: 'sem sessão ativa' }, { status: 404 })
  const body = await request.json()

  if (typeof body.takeIndex === 'number' && body.status && session.takes[body.takeIndex]) {
    session.takes[body.takeIndex].status = body.status
  }
  if (typeof body.current === 'number') {
    session.current = Math.max(0, Math.min(body.current, session.takes.length - 1))
  }
  save(session)
  return Response.json(session)
}

export async function DELETE() {
  try { fs.unlinkSync(FILE) } catch { /* já não existe */ }
  return Response.json({ ok: true })
}
