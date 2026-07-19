import { appendMessage, getThread, getClient } from '@/lib/store'
import { buildSystemPrompt } from '@/lib/prompts'
import { streamGemini, trimHistoryStable, TokenUsage, MediaAttachment, GEMINI_MODEL } from '@/lib/ai'
import { streamOpenAICompat, openaiChatConfig } from '@/lib/chat-openai'
import { runQC } from '@/lib/qc'
import { Message, Attachment, CreativeProvider } from '@/lib/types'

type ChatModel = 'gemini' | 'claude' | 'gpt' | 'grok'
const NAMES: Record<ChatModel, string> = { gemini: 'Gemini', claude: 'Sonnet', gpt: 'GPT', grok: 'Grok' }

const looksLikePackage = (content: string) => /#{2,6}\s*\**\s*(Take|Parte|Cena)\s*\d/i.test(content)

// creativeDefault (seção 3) usa 'sonnet'; no chat isso é 'claude'.
function mapProvider(p?: CreativeProvider): ChatModel | undefined {
  if (!p) return undefined
  return p === 'sonnet' ? 'claude' : p
}

// Traduz erros de API (que vêm como JSON cru dos SDKs) pra mensagem legível.
function humanizeError(err: unknown, model: ChatModel): string {
  const raw = err instanceof Error ? err.message : String(err)
  const nome = NAMES[model]
  const outro = model === 'gemini' ? 'Sonnet' : 'Gemini'
  if (/\b503\b|overloaded|unavailable|UNAVAILABLE/i.test(raw))
    return `O ${nome} está sobrecarregado agora (503). Tente de novo em alguns segundos, ou troque pro ${outro} no topo.`
  if (/\b429\b|rate.?limit|RESOURCE_EXHAUSTED/i.test(raw))
    return `Limite de requisições do ${nome} atingido (429). Aguarde um pouco e reenvie.`
  if (/\b400\b|invalid|INVALID_ARGUMENT/i.test(raw))
    return `O ${nome} recusou a requisição (400) — provável anexo/formato inválido. Detalhe: ${raw.slice(0, 120)}`
  if (/\b401\b|\b403\b|api.?key|permission|PERMISSION_DENIED|unauthorized/i.test(raw))
    return `Falha de autenticação no ${nome} — confira a API key.`
  if (/gastou todo o limite/i.test(raw)) return raw
  return `Erro no ${nome}: ${raw.slice(0, 160)}`
}

export const maxDuration = 300

export async function POST(request: Request) {
  const body = await request.json()
  const { clientId, threadId, text, model, attachments } = body as {
    clientId: string
    threadId: string
    text: string
    model?: ChatModel
    attachments?: Attachment[]
  }

  const client = getClient(clientId)
  const thread = getThread(clientId, threadId)
  if (!client || !thread) return Response.json({ error: 'thread não encontrada' }, { status: 404 })

  // Precedência (seção 4): seleção manual → padrão calibrado do cliente (seção 3)
  // → padrão de chat do cliente → Gemini (fallback).
  // Sistema roda só GPT + Grok como modelos de chat. 'gemini' segue válido só pra
  // ler AV anexado (o ChatView manda 'gemini' automático quando tem vídeo/áudio).
  const VALID: ChatModel[] = ['gemini', 'gpt', 'grok']
  let chosen: ChatModel = (model && VALID.includes(model) && model)
    || mapProvider(client.creativeDefault)
    || client.defaultModel
    || 'gpt'
  if (chosen === 'claude') chosen = 'gpt' // Sonnet removido do sistema

  const { stable, volatile } = buildSystemPrompt(thread.mode, thread.context, client)

  const media: MediaAttachment[] = []
  const stored: Attachment[] = []
  for (const a of attachments || []) {
    if (a.dataUrl?.startsWith('data:')) {
      media.push({ dataUrl: a.dataUrl, mimeType: a.mimeType })
      // v1: anexo fica inline na mensagem (threads migradas já vêm assim)
      stored.push(a)
    } else if (a) stored.push(a)
  }

  const userMsg: Message = {
    id: `m_${Date.now()}_u`,
    role: 'user',
    content: text,
    timestamp: new Date().toISOString(),
    attachments: stored.length ? stored : undefined,
  }
  appendMessage(clientId, threadId, userMsg)

  const history = thread.messages // sem a mensagem recém-anexada (thread foi lido antes)
  const encoder = new TextEncoder()
  let fullText = ''
  let usage: TokenUsage | null = null

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const onUsage = (u: TokenUsage) => { usage = u }
        const contextRefs = (thread.context.refs || []).filter(r => r.dataUrl?.startsWith('data:'))

        let generator: AsyncGenerator<string>
        if (chosen === 'gemini') {
          // Gemini só entra pra ler vídeo/áudio anexado (infra, não é opção do operador)
          generator = streamGemini(stable, volatile, history, text, media, onUsage, contextRefs)
        } else {
          // gpt / grok — histórico já cortado (o streamOpenAICompat recebe pronto)
          const trimmed = trimHistoryStable(history).map(m => ({ role: m.role, content: m.content }))
          generator = streamOpenAICompat(chosen, stable, volatile, trimmed, text, media, onUsage, contextRefs)
        }

        for await (const chunk of generator) {
          fullText += chunk
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`))
        }

        // QC automático: resposta com takes é validada na hora de salvar —
        // determinístico, custo zero, e o badge aparece direto na mensagem.
        const qc = looksLikePackage(fullText) ? runQC(fullText, client.qcBlocklist || []) : undefined

        const assistantMsg: Message = {
          id: `m_${Date.now()}_a`,
          role: 'assistant',
          content: fullText,
          timestamp: new Date().toISOString(),
          model: chosen === 'gemini' ? GEMINI_MODEL : openaiChatConfig(chosen).model,
          inputTokens: usage?.inputTokens,
          outputTokens: usage?.outputTokens,
          cacheReadTokens: usage?.cacheReadTokens,
          ...(qc ? { qc } : {}),
        }
        appendMessage(clientId, threadId, assistantMsg)

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          done: true,
          messageId: assistantMsg.id,
          threadName: getThread(clientId, threadId)?.name,
          inputTokens: usage?.inputTokens ?? 0,
          outputTokens: usage?.outputTokens ?? 0,
          cacheReadTokens: usage?.cacheReadTokens ?? 0,
        })}\n\n`))
      } catch (err) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: humanizeError(err, chosen) })}\n\n`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
