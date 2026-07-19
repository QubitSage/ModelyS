// Cirurgia de take: divide um pacote em blocos de take (preservando posições)
// e reescreve UM take isolado — sem passar pela conversa, sem poluir a memória.

import Anthropic from '@anthropic-ai/sdk'
import { buildSystemPrompt } from './prompts'
import { CLAUDE_MODEL } from './ai'
import { logUsage } from './costlog'
import { Client } from './types'

const TAKE_SPLIT = /(?=^#{2,6}\s*\**\s*(?:Take|Parte|Cena)\s*\d)/im
const TAKE_LABEL = /^#{2,6}\s*\**\s*((?:Take|Parte|Cena)\s*\d+)/im

export interface TakeBlock {
  label: string // "Take 6"
  block: string // bloco completo incluindo o header
  start: number // índice no content original
  end: number
}

export function parseTakeBlocks(content: string): TakeBlock[] {
  const out: TakeBlock[] = []
  const parts = content.split(TAKE_SPLIT)
  let cursor = 0
  for (const part of parts) {
    const start = content.indexOf(part, cursor)
    cursor = start + part.length
    const m = part.match(TAKE_LABEL)
    if (!m) continue // preâmbulo antes do primeiro take
    out.push({ label: m[1].replace(/\s+/g, ' ').trim(), block: part.trimEnd(), start, end: start + part.trimEnd().length })
  }
  return out
}

export function replaceTakeBlock(content: string, label: string, newBlock: string): string | null {
  const takes = parseTakeBlocks(content)
  const t = takes.find(x => x.label.toLowerCase() === label.toLowerCase())
  if (!t) return null
  return content.slice(0, t.start) + newBlock.trimEnd() + '\n\n' + content.slice(t.end).replace(/^\s+/, '')
}

// Reescrita focada: só o take + vizinhos como contexto + a instrução.
// System = bloco estável (regras + memórias do cliente) → mesmo prefixo de
// cache do chat. Sonnet, saída = apenas o bloco corrigido.
export async function fixTakeWithAI(
  client: Client,
  content: string,
  label: string,
  instruction: string
): Promise<{ newBlock: string; inputTokens: number; outputTokens: number } | { error: string }> {
  const takes = parseTakeBlocks(content)
  const i = takes.findIndex(x => x.label.toLowerCase() === label.toLowerCase())
  if (i < 0) return { error: `take "${label}" não encontrado na mensagem` }

  const { stable } = buildSystemPrompt('producao', { briefing: '', notes: '', refs: [] }, client)
  const anthropic = new Anthropic()

  const neighbors = [
    i > 0 ? `TAKE ANTERIOR (contexto de continuidade — NÃO reescrever):\n${takes[i - 1].block}` : '',
    i < takes.length - 1 ? `TAKE SEGUINTE (contexto de continuidade — NÃO reescrever):\n${takes[i + 1].block}` : '',
  ].filter(Boolean).join('\n\n')

  const user = `Correção cirúrgica de UM take de um pacote já entregue. Reescreva APENAS o take abaixo aplicando a instrução do operador. Mantenha o MESMO formato scaffold (header "#### ${takes[i].label} (...)" com contagem de fala, e os campos Cena:/Câmera:/Ação:/Fala:/Efeito:/Áudio:/Estilo:, um por linha, fala UMA única vez na linha Fala:), a mesma numeração e a continuidade com os vizinhos. Se o take usa referência visual, preserve o placeholder de nome do elemento (ex.: [Manu]) — nunca redescreva a aparência de quem tem ref. A fala do cliente é intocável salvo se a instrução mandar mudá-la.

${neighbors ? neighbors + '\n\n' : ''}TAKE A CORRIGIR:
${takes[i].block}

INSTRUÇÃO DO OPERADOR:
${instruction}

Responda SOMENTE com o bloco do take corrigido (do header à última linha), sem comentários antes ou depois.`

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 3000,
    system: [{ type: 'text', text: stable, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: user }],
  })

  logUsage('take-fix', CLAUDE_MODEL, response.usage.input_tokens, response.usage.output_tokens)

  let text = response.content.find(b => b.type === 'text')?.text?.trim() ?? ''
  // tolera cerca de código em volta
  text = text.replace(/^```(?:markdown)?\s*/i, '').replace(/\s*```$/, '').trim()
  if (!TAKE_LABEL.test(text)) {
    // modelo respondeu sem header — recoloca o original
    const headerLine = takes[i].block.split('\n')[0]
    text = `${headerLine}\n${text}`
  }
  return { newBlock: text, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens }
}
