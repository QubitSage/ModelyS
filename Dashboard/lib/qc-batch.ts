// QC em lote — o caso real: vídeo de 15min ≈ 250 takes num arquivo só.
// Roteamento: determinístico primeiro (custo zero); só os AMBÍGUOS escalam
// pra Haiku, em UMA chamada batelada. Nunca modelo caro em QC.

import Anthropic from '@anthropic-ai/sdk'
import { runQC, parseTakes, wordCap } from './qc'
import { QCFinding } from './types'
import { logUsage } from './costlog'
import { HAIKU_MODEL } from './ai'

export interface BatchItem {
  id: string
  content: string
  duracao?: number
}

export interface BatchItemResult {
  id: string
  content: string
  status: 'aprovado' | 'ambiguo' | 'flagado'
  findings: QCFinding[]
  ai?: { verdict: 'aprovado' | 'flagado'; motivo: string; sugestao: string }
}

// ---------------------------------------------------------------------------
// Entrada flexível: JSON (array de objetos ou strings), CSV (coluna prompt/take
// + opcional duracao), ou texto com um take por bloco (linha em branco ou ---).
// ---------------------------------------------------------------------------
export function parseBatchInput(raw: string): BatchItem[] {
  const trimmed = raw.trim()

  // JSON
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      let data = JSON.parse(trimmed)
      if (!Array.isArray(data)) data = data.takes ?? data.items ?? []
      return (data as unknown[]).map((item, i) => {
        if (typeof item === 'string') return { id: String(i + 1), content: item }
        const o = item as Record<string, unknown>
        return {
          id: String(o.id ?? i + 1),
          content: String(o.prompt ?? o.take ?? o.texto ?? o.content ?? ''),
          duracao: o.duracao != null ? Number(o.duracao) : undefined,
        }
      }).filter(t => t.content.trim())
    } catch { /* cai pros outros formatos */ }
  }

  // CSV (primeira linha tem cabeçalho com prompt/take/texto)
  const firstLine = trimmed.split('\n')[0].toLowerCase()
  if (firstLine.includes(',') && /(prompt|take|texto)/.test(firstLine)) {
    return parseCsv(trimmed)
  }

  // Texto: um take por bloco. Se o arquivo usa cabeçalhos de take (#### Take N),
  // divide por cabeçalho; senão, por linha em branco / ---.
  if (/#{2,6}\s*\**\s*(Take|Parte|Cena)\s*\d/i.test(trimmed)) {
    const TAKE_HEAD = /^#{2,6}\s*\**\s*(?:Take|Parte|Cena)\s*\d/i
    const parts = trimmed.split(/(?=^#{2,6}\s*\**\s*(?:Take|Parte|Cena)\s*\d)/im)
      .filter(p => p.trim())
      // descarta o preâmbulo (intro/ingredientes antes do 1º take): só ficam
      // partes que começam com um cabeçalho de take de verdade.
      .filter(p => TAKE_HEAD.test(p.trim()))
    return parts.map((p, i) => {
      const m = p.match(/(?:Take|Parte|Cena)\s*(\d+)/i)
      // corta seção final que não é take (ex.: "### REMONTAGEM", "### Guia do
      // editor") grudada no último take: o cabeçalho do take é #### ou #####, então
      // o primeiro header de nível 1-3 DEPOIS da 1ª linha encerra o conteúdo.
      const lines = p.trim().split('\n')
      let end = lines.length
      for (let j = 1; j < lines.length; j++) {
        if (/^#{1,3}\s/.test(lines[j])) { end = j; break }
      }
      return { id: m?.[1] ?? String(i + 1), content: lines.slice(0, end).join('\n').trim() }
    })
  }

  const blocks = trimmed.split(/\n\s*\n|\n-{3,}\n/).filter(b => b.trim())
  return blocks.map((b, i) => {
    const lines = b.trim().split('\n')
    // aceita "#3", "Take 3:", "=== Take 3 ===" (formato do aprovados.txt)
    const header = lines[0].match(/^\s*=*\s*(?:#|take\s*)(\d+)\s*=*\s*[:.\-]?\s*$/i)
    return {
      id: header?.[1] ?? String(i + 1),
      content: (header ? lines.slice(1).join('\n') : b).trim(),
    }
  })
}

function parseCsv(text: string): BatchItem[] {
  // parser CSV mínimo com suporte a aspas
  const rows: string[][] = []
  let row: string[] = [], field = '', inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') inQuotes = false
      else field += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (ch !== '\r') field += ch
  }
  if (field || row.length) { row.push(field); rows.push(row) }

  const header = rows[0].map(h => h.toLowerCase().trim())
  const pi = header.findIndex(h => ['prompt', 'take', 'texto'].includes(h))
  const ii = header.findIndex(h => ['id', 'numero', 'n'].includes(h))
  const di = header.findIndex(h => ['duracao', 'duração', 'dur', 'segundos'].includes(h))
  if (pi < 0) return []

  return rows.slice(1)
    .filter(r => r[pi]?.trim())
    .map((r, i) => ({
      id: (ii >= 0 && r[ii]?.trim()) || String(i + 1),
      content: r[pi].trim(),
      duracao: di >= 0 && r[di] ? parseFloat(r[di].replace(',', '.').replace(/s$/i, '')) : undefined,
    }))
}

// ---------------------------------------------------------------------------
// Validação por item — reusa o runQC (que já cobre item com headers de take) e
// adiciona checagens que dependem da duração vinda do CSV/JSON.
// ---------------------------------------------------------------------------
const QUOTE_RE = /["“”']([^"“”']{3,})["“”']/g

export function runQCItem(item: BatchItem, clientBlocklist: string[]): BatchItemResult {
  const base = runQC(item.content, clientBlocklist)
  const findings = [...base.findings]

  // duração: vem do CSV/JSON, ou é inferida de timestamps inline ("0-4s:", "2-8s:")
  const hasHeaders = parseTakes(item.content).length > 0
  let duracao = item.duracao
  if (!duracao) {
    let maxEnd = 0
    for (const m of item.content.matchAll(/(\d+(?:[.,]\d+)?)\s*s?\s*[-–—]\s*(\d+(?:[.,]\d+)?)\s*s\b/gi)) {
      maxEnd = Math.max(maxEnd, parseFloat(m[2].replace(',', '.')))
    }
    if (maxEnd > 0 && maxEnd <= 60) duracao = maxEnd
  }
  if (!hasHeaders && duracao && duracao > 0) {
    const cap = wordCap(duracao)
    for (const m of item.content.matchAll(QUOTE_RE)) {
      const words = m[1].trim().split(/\s+/).filter(Boolean).length
      if (words > cap) {
        findings.push({
          severidade: 'flagado',
          regra: 'fala-vs-duracao',
          motivo: `Fala com ${words} palavras num take de ${duracao}s (teto: ${cap}) — não fecha no gerador.`,
          sugestao: 'Encurtar a fala ou dividir o take.',
        })
      }
    }
    const totalWords = item.content.split(/\s+/).filter(Boolean).length
    if (totalWords > duracao * 8) {
      findings.push({
        severidade: 'ambiguo',
        regra: 'sobrecarga',
        motivo: `Prompt denso (${totalWords} palavras para ${duracao}s) — risco de fala/timing bugado.`,
        sugestao: 'Segmentar por tempo ou enxugar as instruções.',
      })
    }
  }

  const status = findings.some(f => f.severidade === 'flagado')
    ? 'flagado'
    : findings.length > 0 ? 'ambiguo' : 'aprovado'

  return { id: item.id, content: item.content, status, findings }
}

// ---------------------------------------------------------------------------
// Escalonamento: TODOS os ambíguos numa única chamada Haiku (structured output)
// ---------------------------------------------------------------------------
const AI_SCHEMA = {
  type: 'object',
  properties: {
    veredictos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          verdict: { type: 'string', enum: ['aprovado', 'flagado'] },
          motivo: { type: 'string' },
          sugestao: { type: 'string' },
        },
        required: ['id', 'verdict', 'motivo', 'sugestao'],
        additionalProperties: false,
      },
    },
  },
  required: ['veredictos'],
  additionalProperties: false,
}

export async function escalateToHaiku(
  ambiguous: BatchItemResult[],
  clientBlocklist: string[]
): Promise<Map<string, { verdict: 'aprovado' | 'flagado'; motivo: string; sugestao: string }>> {
  const out = new Map<string, { verdict: 'aprovado' | 'flagado'; motivo: string; sugestao: string }>()
  if (!ambiguous.length) return out

  const system = `Você é revisor de QC de prompts de vídeo IA (Gemini Omni Flash/Flow). Recebe takes que o motor determinístico marcou como AMBÍGUOS, com o motivo da suspeita. Decida cada um: "aprovado" (pode gerar como está — a suspeita é falso positivo claro) ou "flagado" (risco real de bloqueio de política ou fala/timing bugado — dê motivo objetivo e sugestão de correção concreta).
Termos que o Flow já bloqueou para este cliente: ${clientBlocklist.join(', ') || '(nenhum extra)'}. Seja pragmático: na dúvida com risco de política, flague; na dúvida só de estilo, aprove.`

  const user = ambiguous.map(item =>
    `### Take ${item.id}\n${item.content}\n**Suspeitas:** ${item.findings.map(f => `[${f.regra}] ${f.motivo}`).join(' | ')}`
  ).join('\n\n')

  const client = new Anthropic()
  const response = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: Math.min(8000, 300 * ambiguous.length + 500),
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    output_config: { format: { type: 'json_schema', schema: AI_SCHEMA } },
    messages: [{ role: 'user', content: user }],
  })

  logUsage('qc-batch', HAIKU_MODEL, response.usage.input_tokens, response.usage.output_tokens)

  try {
    const text = response.content.find(b => b.type === 'text')?.text ?? '{}'
    const parsed = JSON.parse(text) as { veredictos: Array<{ id: string; verdict: 'aprovado' | 'flagado'; motivo: string; sugestao: string }> }
    for (const v of parsed.veredictos ?? []) {
      // o modelo às vezes devolve "Take 3" em vez de "3" — normaliza pros dígitos
      out.set(normalizeId(String(v.id)), v)
    }
  } catch { /* sem veredicto → item permanece ambíguo pra revisão humana */ }

  return out
}

export function normalizeId(id: string): string {
  const digits = id.replace(/\D+/g, '')
  return digits || id.trim().toLowerCase()
}
