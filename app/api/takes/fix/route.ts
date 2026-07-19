import { getClient, getThread, updateMessage } from '@/lib/store'
import { parseTakeBlocks, replaceTakeBlock, fixTakeWithAI } from '@/lib/takes'
import { runQC } from '@/lib/qc'

export const maxDuration = 120

// GET: lista os takes de uma mensagem (pro editor)
export async function GET(request: Request) {
  const url = new URL(request.url)
  const clientId = url.searchParams.get('clientId') || ''
  const threadId = url.searchParams.get('threadId') || ''
  const messageId = url.searchParams.get('messageId') || ''
  const thread = getThread(clientId, threadId)
  const msg = thread?.messages.find(m => m.id === messageId)
  if (!msg) return Response.json({ error: 'mensagem não encontrada' }, { status: 404 })
  return Response.json({ takes: parseTakeBlocks(msg.content).map(t => ({ label: t.label, block: t.block })) })
}

// POST: corrige um take — manual (newBlock) ou via IA (instruction)
export async function POST(request: Request) {
  const { clientId, threadId, messageId, label, instruction, newBlock } = await request.json()
  const client = getClient(clientId)
  const thread = getThread(clientId, threadId)
  const msg = thread?.messages.find(m => m.id === messageId)
  if (!client || !msg) return Response.json({ error: 'mensagem não encontrada' }, { status: 404 })

  let finalBlock = newBlock as string | undefined
  if (!finalBlock) {
    if (!instruction?.trim()) return Response.json({ error: 'instruction ou newBlock obrigatório' }, { status: 400 })
    const result = await fixTakeWithAI(client, msg.content, label, instruction)
    if ('error' in result) return Response.json({ error: result.error }, { status: 400 })
    finalBlock = result.newBlock
  }

  const newContent = replaceTakeBlock(msg.content, label, finalBlock)
  if (newContent === null) return Response.json({ error: `take "${label}" não encontrado` }, { status: 400 })

  // re-roda o QC no pacote inteiro (o take novo pode ter introduzido problema)
  const qc = runQC(newContent, client.qcBlocklist || [])
  const editedTakes = [...new Set([...(msg.editedTakes || []), label])]
  const updated = updateMessage(clientId, threadId, messageId, { content: newContent, qc, editedTakes })

  return Response.json({ message: updated, qc, block: finalBlock })
}
