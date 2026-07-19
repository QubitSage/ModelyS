import Anthropic from '@anthropic-ai/sdk'
import { CLAUDE_MODEL } from './ai'
import { getClient } from './store'
import { logUsage } from './costlog'

// Caçador de Pauta — motor dedicado de "sobre o quê falar". Busca na web os
// assuntos EM ALTA no nicho de UM cliente, filtra por atualidade/controvérsia/
// apelo e devolve pauta pronta (gancho + título + legenda) no tom do cliente.
// Independente da Direção Criativa (que é o "como fazer"). Não toca no core.

export interface Pauta {
  assunto: string
  porque: string   // por que está em alta / relevância agora
  gancho: string   // ângulo de abertura (primeira frase que prende)
  titulo: string   // título de capa
  legenda: string  // legenda pronta pro post
}

function clientContext(clientId?: string): { nome: string; nicho: string; tom: string } {
  if (clientId) {
    const c = getClient(clientId)
    if (c) {
      const mem = (c.memory || []).filter(() => c.injectMemory !== false).map(m => `${m.title}: ${m.content}`).join(' | ')
      return {
        nome: c.name,
        nicho: c.segment || mem.slice(0, 400) || c.name,
        tom: mem ? mem.slice(0, 400) : '',
      }
    }
  }
  return { nome: '', nicho: '', tom: '' }
}

// extrai o objeto JSON das pautas — ancora na chave "pautas" e volta até a "{"
// que a contém, pra não tropeçar em chaves soltas no texto da busca web.
function extractJson(raw: string): string {
  const key = raw.indexOf('"pautas"')
  const start = key >= 0 ? raw.lastIndexOf('{', key) : raw.indexOf('{')
  if (start < 0) throw new Error('sem JSON')
  let depth = 0, inStr = false, esc = false
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i]
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue }
    if (ch === '"') inStr = true
    else if (ch === '{') depth++
    else if (ch === '}') { depth--; if (depth === 0) return raw.slice(start, i + 1) }
  }
  throw new Error('JSON incompleto')
}

export async function huntPautas(clientId?: string, tema?: string): Promise<{ pautas: Pauta[]; ok: boolean }> {
  const { nome, nicho, tom } = clientContext(clientId)
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })

  const alvo = nome ? `o cliente "${nome}"` : 'um criador de conteúdo'
  const prompt = `Você é um CAÇADOR DE PAUTA para ${alvo}${nicho ? `.\nNICHO/PERFIL DO CLIENTE: ${nicho}` : ''}${tema ? `\nFOCO PEDIDO AGORA: ${tema}` : ''}

Busque na web os ASSUNTOS MAIS EM ALTA AGORA no nicho desse cliente — notícias recentes, polêmicas, debates e tendências virais das últimas semanas (2026). FILTRE por: (1) atualidade — o mais recente possível; (2) potencial de engajamento/controvérsia; (3) apelo popular. Escolha os 5 melhores e mais aproveitáveis.

Para cada um, entregue PAUTA PRONTA${tom ? `, no TOM do cliente (baseie-se em: ${tom})` : ''}:
- assunto: o tema em si, específico (não genérico)
- porque: por que está em alta / a relevância agora (1 frase)
- gancho: o ângulo de abertura do vídeo — a primeira frase que prende
- titulo: título de capa chamativo
- legenda: legenda pronta pro post

Depois de pesquisar, TERMINE a resposta com um bloco JSON (e nada depois dele):
{"pautas":[{"assunto":"...","porque":"...","gancho":"...","titulo":"...","legenda":"..."}]}`

  try {
    const res = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 7000, // 5 pautas completas + texto da busca não podem truncar o JSON
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 4 }] as unknown as Anthropic.Messages.ToolUnion[],
      messages: [{ role: 'user', content: prompt }],
    })
    logUsage('pauta', CLAUDE_MODEL, res.usage.input_tokens, res.usage.output_tokens)
    const text = res.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('\n')
    const obj = JSON.parse(extractJson(text)) as { pautas?: Pauta[] }
    const pautas = (obj.pautas || []).slice(0, 8).map(p => ({
      assunto: String(p.assunto || '').trim(),
      porque: String(p.porque || '').trim(),
      gancho: String(p.gancho || '').trim(),
      titulo: String(p.titulo || '').trim(),
      legenda: String(p.legenda || '').trim(),
    })).filter(p => p.assunto)
    return { pautas, ok: pautas.length > 0 }
  } catch {
    return { pautas: [], ok: false }
  }
}
