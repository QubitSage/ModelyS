import { TokenUsage, MediaAttachment, ContextRef } from './ai'
import { logUsage } from './costlog'

// Streaming de chat para GPT e Grok — endpoints compatíveis-OpenAI. Vive FORA
// do ai.ts (core intocado): mesma assinatura dos streamGemini/streamClaude, o
// route do chat só escolhe qual chamar. Aditivo, seção 4.

type OpenAIProvider = 'gpt' | 'grok'

interface ProviderCfg { baseUrl: string; apiKey: string; model: string; maxKey: 'max_completion_tokens' | 'max_tokens'; label: string }

export function openaiChatConfig(provider: OpenAIProvider): ProviderCfg {
  if (provider === 'gpt') {
    return {
      baseUrl: 'https://api.openai.com/v1',
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_MODEL || 'gpt-5.6-terra',
      maxKey: 'max_completion_tokens', // série GPT-5 rejeita max_tokens
      label: 'GPT',
    }
  }
  return {
    baseUrl: 'https://api.x.ai/v1',
    apiKey: process.env.XAI_API_KEY || '',
    model: process.env.XAI_MODEL || 'grok-4',
    maxKey: 'max_tokens',
    label: 'Grok',
  }
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

type ContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }

function imagePart(dataUrl: string): ContentPart {
  return { type: 'image_url', image_url: { url: dataUrl } }
}

export async function* streamOpenAICompat(
  provider: OpenAIProvider,
  systemStable: string,
  systemVolatile: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  userText: string,
  media?: MediaAttachment[],
  onUsage?: (usage: TokenUsage) => void,
  contextRefs?: ContextRef[],
): AsyncGenerator<string> {
  const cfg = openaiChatConfig(provider)
  if (!cfg.apiKey) throw new Error(`Chave de API do ${cfg.label} não configurada`)

  const messages: Array<{ role: string; content: string | ContentPart[] }> = [
    { role: 'system', content: systemStable + systemVolatile },
  ]

  // referências visuais fixas da thread como 1ª mensagem do usuário
  const refImgs = (contextRefs ?? []).filter(r => IMAGE_TYPES.includes(r.mimeType) && r.dataUrl.includes(','))
  if (refImgs.length) {
    const parts: ContentPart[] = [{
      type: 'text',
      text: 'REFERÊNCIAS VISUAIS FIXAS DESTA CONVERSA — descreva os sujeitos exatamente como aparecem aqui, salvo pedido explícito de mudança:',
    }]
    for (const r of refImgs) {
      parts.push({ type: 'text', text: `[${r.name}]${r.briefing?.trim() ? ` — ${r.briefing.trim()}` : ''}:` })
      parts.push(imagePart(r.dataUrl))
    }
    messages.push({ role: 'user', content: parts })
  }

  for (const m of history) messages.push({ role: m.role, content: m.content || '(anexo enviado)' })

  // mensagem nova: imagens suportadas inline; vídeo/áudio/pdf viram nota (esses
  // tipos o route já direciona pro Gemini, então aqui só chega imagem no geral).
  const userParts: ContentPart[] = []
  const notes: string[] = []
  for (const a of media ?? []) {
    if (IMAGE_TYPES.includes(a.mimeType) && a.dataUrl.includes(',')) userParts.push(imagePart(a.dataUrl))
    else notes.push(`[Anexo ${a.mimeType} não suportado por ${cfg.label} — use o Gemini para esse tipo.]`)
  }
  const finalText = notes.length ? `${notes.join('\n')}\n\n${userText}` : userText
  userParts.push({ type: 'text', text: finalText })
  messages.push({ role: 'user', content: userParts })

  const body: Record<string, unknown> = {
    model: cfg.model,
    messages,
    stream: true,
    stream_options: { include_usage: true },
  }
  body[cfg.maxKey] = 16000

  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify(body),
  })
  if (!res.ok || !res.body) {
    const errBody = await res.text().catch(() => '')
    throw new Error(`${res.status} ${errBody.slice(0, 200)}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let inputTokens = 0, outputTokens = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? '' // guarda a última linha parcial
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (data === '[DONE]') continue
      try {
        const json = JSON.parse(data)
        const delta = json.choices?.[0]?.delta?.content
        if (delta) yield delta
        if (json.usage) {
          inputTokens = json.usage.prompt_tokens ?? inputTokens
          outputTokens = json.usage.completion_tokens ?? outputTokens
        }
      } catch { /* linha parcial/keep-alive — ignora */ }
    }
  }

  logUsage(`chat-${provider}`, cfg.model, inputTokens, outputTokens)
  if (onUsage) onUsage({ inputTokens, outputTokens })
}
