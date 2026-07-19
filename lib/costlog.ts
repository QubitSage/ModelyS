import fs from 'fs'
import path from 'path'
import { atomicWriteFileSync } from './store'

// Log unificado de TODAS as chamadas de IA fora do chat (biblioteca, resumos,
// transcrição…) — o painel de Custos soma isto + os tokens gravados nas
// mensagens de chat. No sistema antigo esse log nunca funcionou e metade do
// gasto era invisível.
const LOG_FILE = path.join(process.cwd(), 'data', 'costs-log.json')

export interface CostLogEntry {
  at: string
  // library-assistant | library-briefing | library-suggest | qc-batch |
  // tool-video | tool-audio | tool-image | summary | ...
  kind: string
  model: string
  inputTokens: number
  outputTokens: number
  estimatedUsd: number
}

// USD por 1M tokens
export const RATES: Record<string, { in: number; out: number }> = {
  gemini: { in: Number(process.env.GEMINI_PRICE_IN) || 1.5, out: Number(process.env.GEMINI_PRICE_OUT) || 9.0 },
  claude: { in: Number(process.env.CLAUDE_PRICE_IN) || 3.0, out: Number(process.env.CLAUDE_PRICE_OUT) || 15.0 },
  haiku: { in: 1.0, out: 5.0 },
}

export function rateFor(model: string) {
  if (model.includes('haiku')) return RATES.haiku
  if (model.includes('claude') || model.includes('sonnet')) return RATES.claude
  return RATES.gemini
}

export function readCostLog(): CostLogEntry[] {
  try {
    return JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8'))
  } catch {
    return []
  }
}

export function logUsage(
  kind: CostLogEntry['kind'],
  model: string,
  inputTokens: number,
  outputTokens: number
) {
  try {
    const r = rateFor(model)
    const log = readCostLog()
    log.push({
      at: new Date().toISOString(),
      kind,
      model,
      inputTokens,
      outputTokens,
      estimatedUsd: (inputTokens / 1e6) * r.in + (outputTokens / 1e6) * r.out,
    })
    atomicWriteFileSync(LOG_FILE, JSON.stringify(log, null, 2))
  } catch (err) {
    // log nunca pode derrubar a geração — mas erro fica visível no servidor
    console.error('costlog falhou:', err)
  }
}
