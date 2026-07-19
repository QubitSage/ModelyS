import { GoogleGenAI } from '@google/genai'
import Anthropic from '@anthropic-ai/sdk'
import { Message } from './types'

const geminiKey = process.env.GEMINI_API_KEY || ''
const claudeKey = process.env.ANTHROPIC_API_KEY || ''

export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash'
export const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5'
export const HAIKU_MODEL = process.env.HAIKU_MODEL || 'claude-haiku-4-5'

// Transcreve um áudio (base64) com o Gemini. Usado no recado de áudio do cliente
// no portal de entrega — mesmo padrão da aba Ferramentas.
export async function transcribeAudio(base64: string, mimeType: string): Promise<string> {
  if (!geminiKey) throw new Error('GEMINI_API_KEY ausente')
  const ai = new GoogleGenAI({ apiKey: geminiKey })
  const res = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ parts: [
      { inlineData: { mimeType, data: base64 } },
      { text: 'Transcreva este áudio em português brasileiro com pontuação correta. Se houver mais de um falante, identifique-os. Retorne apenas a transcrição.' },
    ] }],
  })
  return res.text?.trim() || ''
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
}

export interface MediaAttachment {
  dataUrl: string
  mimeType: string
}

export interface ContextRef {
  name: string
  dataUrl: string
  mimeType: string
  briefing?: string
}

const CLAUDE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

const REFS_INTRO =
  'REFERÊNCIAS VISUAIS FIXAS DESTA CONVERSA — estas imagens são a fonte da verdade ' +
  'para personagens, produtos e cenários. Ao escrever prompts/roteiros, descreva os ' +
  'sujeitos EXATAMENTE como aparecem aqui, a menos que o usuário peça mudança explícita:'

// ---------------------------------------------------------------------------
// Corte de histórico ESTÁVEL (cache-friendly).
//
// O sistema antigo usava janela deslizante: a cada mensagem nova, a mensagem
// mais antiga da janela mudava — o PREFIXO do request mudava na frente, e
// qualquer cache (implícito do Gemini, explícito do Claude) era invalidado
// justamente nas threads longas e caras.
//
// Aqui o início do corte é QUANTIZADO em degraus de TRIM_STEP mensagens: o
// prefixo só muda a cada 16 mensagens novas, e entre degraus os requests
// compartilham o mesmo início de histórico → cache hits na maior parte dos
// turnos. O orçamento de chars vira um teto suave (aplicado por degrau).
// ---------------------------------------------------------------------------
const TRIM_STEP = 16
const MAX_HISTORY_MESSAGES = 64
const MAX_HISTORY_CHARS = 120_000

export function trimHistoryStable(messages: Message[]): Message[] {
  if (messages.length === 0) return []

  // menor início que respeita o teto de mensagens, quantizado no degrau
  let start = Math.max(0, messages.length - MAX_HISTORY_MESSAGES)
  start = Math.ceil(start / TRIM_STEP) * TRIM_STEP

  // orçamento de chars: se o sufixo escolhido estourar, sobe um degrau por vez
  let kept = messages.slice(start)
  let chars = kept.reduce((s, m) => s + m.content.length, 0)
  while (chars > MAX_HISTORY_CHARS && kept.length > TRIM_STEP) {
    kept = kept.slice(TRIM_STEP)
    chars = kept.reduce((s, m) => s + m.content.length, 0)
  }

  // ambos os providers rejeitam blocos de texto vazios
  return kept.map(m => (m.content.trim() ? m : { ...m, content: '(anexo enviado)' }))
}

type GeminiPart = { text?: string; inlineData?: { mimeType: string; data: string } }

// ---------------------------------------------------------------------------
// Gemini — cavalo de batalha (multimodal). Prefixo estruturado pra caching
// implícito: [system estável] + [refs como 1ª mensagem fixa] + [histórico
// cortado em degraus] + [mensagem nova].
// ---------------------------------------------------------------------------
export async function* streamGemini(
  systemStable: string,
  systemVolatile: string,
  history: Message[],
  userText: string,
  media?: MediaAttachment[],
  onUsage?: (usage: TokenUsage) => void,
  contextRefs?: ContextRef[]
): AsyncGenerator<string> {
  const ai = new GoogleGenAI({ apiKey: geminiKey })

  const historyContent = trimHistoryStable(history).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }] as GeminiPart[],
  }))

  if (contextRefs?.length) {
    const refParts: GeminiPart[] = [{ text: REFS_INTRO }]
    for (const r of contextRefs) {
      const base64 = r.dataUrl.split(',')[1]
      if (!base64) continue
      refParts.push({ text: `[${r.name}]${r.briefing?.trim() ? ` — ${r.briefing.trim()}` : ''}:` })
      refParts.push({ inlineData: { mimeType: r.mimeType, data: base64 } })
    }
    if (refParts.length > 1) historyContent.unshift({ role: 'user', parts: refParts })
  }

  const userParts: GeminiPart[] = []
  for (const m of media ?? []) {
    const base64 = m.dataUrl.split(',')[1]
    if (base64) userParts.push({ inlineData: { mimeType: m.mimeType, data: base64 } })
  }
  userParts.push({ text: userText })

  const chat = ai.chats.create({
    model: GEMINI_MODEL,
    // volatile (briefing/notas da thread) entra DEPOIS do bloco estável
    config: { systemInstruction: systemStable + systemVolatile },
    history: historyContent,
  })

  let inputTokens = 0
  let outputTokens = 0
  let cacheReadTokens = 0

  const stream = await chat.sendMessageStream({ message: userParts })
  for await (const chunk of stream) {
    if (chunk.text) yield chunk.text
    const meta = (chunk as {
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; cachedContentTokenCount?: number }
    }).usageMetadata
    if (meta) {
      if (meta.promptTokenCount) inputTokens = meta.promptTokenCount
      if (meta.candidatesTokenCount) outputTokens = meta.candidatesTokenCount
      if (meta.cachedContentTokenCount) cacheReadTokens = meta.cachedContentTokenCount
    }
  }

  if (onUsage) onUsage({ inputTokens, outputTokens, cacheReadTokens })
}

// ---------------------------------------------------------------------------
// Claude — trabalho criativo pesado. Cache explícito em DOIS breakpoints:
// bloco estável do system (regras, muda quase nunca) e fim do prefixo da
// conversa (última mensagem do histórico).
// ---------------------------------------------------------------------------
export async function* streamClaude(
  systemStable: string,
  systemVolatile: string,
  history: Message[],
  userText: string,
  media?: MediaAttachment[],
  onUsage?: (usage: TokenUsage) => void,
  contextRefs?: ContextRef[]
): AsyncGenerator<string> {
  const client = new Anthropic({ apiKey: claudeKey })

  const claudeMessages: Anthropic.MessageParam[] = trimHistoryStable(history).map(m => ({
    role: m.role,
    content: m.content,
  }))

  const refImages = (contextRefs ?? []).filter(
    r => CLAUDE_IMAGE_TYPES.includes(r.mimeType) && r.dataUrl.includes(',')
  )
  if (refImages.length) {
    const refContent: Anthropic.ContentBlockParam[] = [{ type: 'text', text: REFS_INTRO }]
    for (const r of refImages) {
      refContent.push({ type: 'text', text: `[${r.name}]${r.briefing?.trim() ? ` — ${r.briefing.trim()}` : ''}:` })
      refContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: r.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
          data: r.dataUrl.split(',')[1],
        },
      })
    }
    claudeMessages.unshift({ role: 'user', content: refContent })
  }

  // breakpoint no fim do prefixo da conversa
  if (claudeMessages.length > 0) {
    const last = claudeMessages[claudeMessages.length - 1]
    if (typeof last.content === 'string') {
      last.content = [{ type: 'text', text: last.content, cache_control: { type: 'ephemeral' } }]
    }
  }

  const userContent: Anthropic.ContentBlockParam[] = []
  const notes: string[] = []
  for (const m of media ?? []) {
    const base64 = m.dataUrl.split(',')[1]
    if (m.mimeType.startsWith('image/')) {
      userContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: m.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
          data: base64,
        },
      })
    } else if (m.mimeType === 'application/pdf') {
      userContent.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } })
    } else if (m.mimeType.startsWith('video/') || m.mimeType.startsWith('audio/')) {
      notes.push('[Arquivo de vídeo/áudio anexado — o Claude não processa esse tipo; use o Gemini para analisar o conteúdo.]')
    }
  }
  userContent.push({ type: 'text', text: notes.length ? `${notes.join('\n')}\n\n${userText}` : userText })
  claudeMessages.push({ role: 'user', content: userContent })

  // 32k: Sonnet 5 roda adaptive thinking por padrão e max_tokens cobre
  // thinking + texto — com teto baixo, tarefa criativa densa pode gastar tudo
  // pensando e devolver zero texto (cobrado mesmo assim).
  const stream = client.messages.stream({
    model: CLAUDE_MODEL,
    max_tokens: 32000,
    system: [
      // bloco estável: regras + memórias → cache que sobrevive entre threads do mesmo modo
      { type: 'text', text: systemStable, cache_control: { type: 'ephemeral' } },
      // bloco volátil: contexto da thread → fora do breakpoint estável
      ...(systemVolatile ? [{ type: 'text' as const, text: systemVolatile }] : []),
    ],
    messages: claudeMessages,
  })

  let emittedText = false
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      if (event.delta.text) emittedText = true
      yield event.delta.text
    }
  }

  try {
    const finalMsg = await stream.finalMessage()
    if (onUsage) {
      onUsage({
        inputTokens: finalMsg.usage.input_tokens,
        outputTokens: finalMsg.usage.output_tokens,
        cacheReadTokens: finalMsg.usage.cache_read_input_tokens ?? 0,
      })
    }
    if (!emittedText && finalMsg.stop_reason === 'max_tokens') {
      throw new Error('O modelo gastou todo o limite de tokens raciocinando e não escreveu a resposta — envie de novo (ou divida o pedido).')
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('O modelo gastou')) throw err
    // usage indisponível — segue
  }
}
