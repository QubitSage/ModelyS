import fs from 'fs'
import path from 'path'
import { Client, Mode, ThreadContext } from './types'

const PROMPTS_DIR = path.join(process.cwd(), 'prompts')

function load(file: string): string {
  const p = path.join(PROMPTS_DIR, file)
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : ''
}

// Carregados uma vez no boot — conteúdo estável = prefixo estável pro cache.
const WORKFLOW_CORE = load('workflow_core.md')
const MODE_PROMPTS: Record<Mode, string> = {
  producao: load('producao.md'),
  visual: load('visual.md'),
  revisao: load('revisao.md'),
  web: load('producao.md'),
}

// Modos que realmente geram prompts pro Flow recebem as regras completas de
// workflow; revisão (relatório pro editor) não precisa dos 41KB — era a maior
// fonte de custo e de diluição de regra do sistema antigo.
const MODES_WITH_WORKFLOW: Mode[] = ['producao', 'visual']

/**
 * O system prompt é dividido em duas partes pra maximizar cache:
 *  - stable: prompt do modo + workflow core + memórias do cliente — muda só
 *    quando você edita regras/memórias. É o bloco com cache_control no Claude
 *    e o prefixo que o caching implícito do Gemini reaproveita.
 *  - volatile: contexto da thread (briefing, notas, resumo herdado, lista de
 *    refs) — muda por thread, fica depois do bloco estável.
 */
export function buildSystemPrompt(mode: Mode, context: ThreadContext, client?: Client | null): { stable: string; volatile: string } {
  const parts: string[] = [MODE_PROMPTS[mode] || MODE_PROMPTS.producao]

  if (WORKFLOW_CORE && MODES_WITH_WORKFLOW.includes(mode)) {
    parts.push('\n\n---\n# REGRAS GLOBAIS DE WORKFLOW\n' + WORKFLOW_CORE)
  }

  if (client?.injectMemory && client.memory?.length) {
    const bundle = client.memory.map(m => `## ${m.title}\n${m.content}`).join('\n\n')
    parts.push('\n\n---\n# MEMÓRIAS DO CLIENTE\nUse estas informações para personalizar suas respostas:\n\n' + bundle)
  }

  // Regras invioláveis do cliente — bloco aditivo, prioridade máxima. Fica no
  // stable (cache-friendly) porque muda raramente, igual às memórias.
  if (client?.rules?.trim()) {
    parts.push('\n\n---\n# REGRAS INVIOLÁVEIS DO CLIENTE\nPrioridade MÁXIMA — nunca viole estas regras, mesmo que o pedido pareça sugerir o contrário:\n\n' + client.rules.trim())
  }

  const volatile: string[] = []
  if (context.previousSummary?.trim()) {
    volatile.push('\n\n---\n# RESUMO DO HISTÓRICO ANTERIOR\nEsta conversa continua outra, resumida abaixo. Use como contexto do que já foi combinado, sem tratar como mensagens desta conversa.\n\n' + context.previousSummary.trim())
  }
  if (context.briefing?.trim()) volatile.push('\n\n---\n# BRIEFING DO PROJETO\n' + context.briefing.trim())
  if (context.notes?.trim()) volatile.push('\n\n---\n# NOTAS DO PROJETO\n' + context.notes.trim())
  if (context.refs?.length) {
    const list = context.refs.map(r => `- [${r.name}]${r.briefing?.trim() ? ` — ${r.briefing.trim()}` : ''}`).join('\n')
    volatile.push('\n\n---\n# REFERÊNCIAS VISUAIS\nAs imagens destas referências estão anexadas na primeira mensagem da conversa — fonte visual da verdade:\n' + list)
  }

  return { stable: parts.join(''), volatile: volatile.join('') }
}
