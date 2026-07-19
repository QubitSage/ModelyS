// Motor de Direção Criativa — etapa ADITIVA antes do cérebro de geração.
// Nada aqui toca em ai.ts / prompts.ts / workflow_core.md. É uma concepção
// criativa a partir de uma faísca vaga: transforma uma ideia crua em 2-3
// direções distintas ANTES dela virar prompt mecânico.
//
// Multi-provider de propósito: a Arena (bake-off) roda todos em paralelo pra
// calibrar qual modelo fica responsável por essa tarefa. Sonnet e Gemini usam
// os SDKs já no projeto; GPT e Grok usam API compatível-OpenAI via fetch (sem
// dependência nova). Provider sem chave vira "pendente", não quebra a build.

import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI } from '@google/genai'
import { CLAUDE_MODEL, GEMINI_MODEL } from './ai'
import { listTerms, getClient } from './store'
import { logUsage } from './costlog'
import { CreativeProvider } from './types'

export type ProviderId = CreativeProvider

// Fallback global da Direção Criativa: usado pra cliente novo (sem calibração
// ainda) e quando não há cliente. Cavalo de batalha de raciocínio forte.
export const CREATIVE_FALLBACK: ProviderId = 'gpt'

export interface ProviderMeta {
  id: ProviderId
  label: string
  model: string
  keyEnv: string
  hasKey: boolean
}

export function providers(): ProviderMeta[] {
  // Sistema roda só GPT 5.6 Terra + Grok (Sonnet/Gemini saíram como modelos
  // criativos após o benchmark). Gemini/Claude seguem só na infra (digest de
  // arquivos e busca web), não como opção do operador.
  const defs: Omit<ProviderMeta, 'hasKey'>[] = [
    { id: 'gpt', label: 'GPT 5.6 Terra', model: process.env.OPENAI_MODEL || 'gpt-5.6-terra', keyEnv: 'OPENAI_API_KEY' },
    { id: 'grok', label: 'Grok (xAI)', model: process.env.XAI_MODEL || 'grok-4', keyEnv: 'XAI_API_KEY' },
  ]
  return defs.map(d => ({ ...d, hasKey: !!(process.env[d.keyEnv] || '').trim() }))
}

export type SlotId = 'padrao' | 'repertorio' | 'aberto'

export interface CreativeDirection {
  conceito: string   // a aposta central / conceito em 1-2 frases
  tom: string        // tom emocional/estético
  referencia: string // referência cultural ou metáfora que ancora a direção
  blocos: string[]   // termos da biblioteca (nome) que servem de blocos de construção
  slot?: SlotId      // papel do slot (Arena): padrao | repertorio | aberto
}

export interface ProviderResult {
  provider: ProviderId
  label: string
  model: string
  ok: boolean
  pending?: boolean // faltou chave de API
  error?: string
  directions?: CreativeDirection[]
  ms?: number
}

// Contexto compartilhado: catálogo de blocos + memória do cliente.
function buildContext(clientId?: string): { catalog: string; clientCtx: string } {
  const catalog = listTerms().map(t => `${t.termo} (${t.categoria})`).join(', ')
  let clientCtx = ''
  if (clientId) {
    const c = getClient(clientId)
    if (c) {
      const mem = (c.memory || []).filter(() => c.injectMemory !== false).map(m => `- ${m.title}: ${m.content}`).join('\n')
      clientCtx = `\n\nCLIENTE: ${c.name}${c.segment ? ` (${c.segment})` : ''}${mem ? `\nO que já sabemos do estilo/regras deste cliente:\n${mem}` : ''}`
    }
  }
  return { catalog, clientCtx }
}

// ---------------------------------------------------------------------------
// Prompt LIVRE (usado pela Direção Criativa — 1 modelo, uso diário).
// ---------------------------------------------------------------------------
function buildPrompt(idea: string, clientId?: string, refDigest?: string, hasImages?: boolean): { system: string; user: string } {
  const { catalog, clientCtx } = buildContext(clientId)

  const system = `Você é um DIRETOR CRIATIVO sênior de um estúdio premium de vídeo com IA (geração no Google Flow / Gemini Omni Flash). Recebe uma FAÍSCA — uma ideia vaga, às vezes só uma frase — e seu trabalho é CONCEBER, não executar: desenvolver a ideia em direções criativas fortes ANTES de qualquer prompt técnico.

Devolva de 2 a 3 DIREÇÕES CRIATIVAS genuinamente DISTINTAS entre si (não três variações da mesma coisa — ângulos diferentes de atacar a ideia). Cada direção tem:
- conceito: a aposta central, o que torna essa direção especial, em 1-2 frases afiadas. Nada de "moderno e bonito" genérico — nomeie a ideia.
- tom: o clima emocional/estético (ex.: "documental cru e íntimo", "publicitário de alto brilho", "nostálgico anos 90").
- referencia: uma referência cultural, filme, campanha, ou metáfora concreta que ancora a direção.
- blocos: 2-5 termos da biblioteca abaixo que serviriam de blocos de construção visual pra essa direção (use os nomes exatos quando fizerem sentido; pode citar poucos).

Cubra espectro: pelo menos uma direção mais segura/comercial e uma mais ousada. Português brasileiro, linguagem de quem dirige set, sem encher linguiça.

BIBLIOTECA DE BLOCOS DISPONÍVEIS: ${catalog || '(catálogo vazio)'}${clientCtx}

Responda SOMENTE JSON válido no formato: {"directions":[{"conceito":"...","tom":"...","referencia":"...","blocos":["...","..."]}]}`

  const refNote = [
    hasImages ? 'O operador anexou IMAGEM(NS) de referência — leia o estilo/mood e ancore as direções nesse visual.' : '',
    refDigest ? `CONTEÚDO DAS REFERÊNCIAS ANEXADAS (PDF/vídeo/doc lidos):\n${refDigest}` : '',
  ].filter(Boolean).join('\n')
  const user = `FAÍSCA / IDEIA CRUA:\n${idea.trim()}${refNote ? `\n\n${refNote}` : ''}`
  return { system, user }
}

// Extrai o PRIMEIRO objeto JSON balanceado — tolera cerca de código, texto em
// volta e conteúdo extra depois do objeto (o Gemini às vezes emenda comentário
// depois do JSON mesmo com responseMimeType json).
function extractJson(raw: string): string {
  const t = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const start = t.indexOf('{')
  if (start < 0) throw new Error('resposta sem JSON')
  let depth = 0, inStr = false, esc = false
  for (let i = start; i < t.length; i++) {
    const ch = t[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') inStr = true
    else if (ch === '{') depth++
    else if (ch === '}') { depth--; if (depth === 0) return t.slice(start, i + 1) }
  }
  throw new Error('JSON incompleto na resposta')
}

const SLOTS: SlotId[] = ['padrao', 'repertorio', 'aberto']

function parseDirections(raw: string): CreativeDirection[] {
  const obj = JSON.parse(extractJson(raw)) as { directions?: CreativeDirection[] }
  const dirs = (obj.directions || []).slice(0, 3).map(d => ({
    conceito: String(d.conceito || '').trim(),
    tom: String(d.tom || '').trim(),
    referencia: String(d.referencia || '').trim(),
    blocos: Array.isArray(d.blocos) ? d.blocos.map(String).filter(Boolean).slice(0, 6) : [],
    slot: SLOTS.includes(d.slot as SlotId) ? (d.slot as SlotId) : undefined,
  })).filter(d => d.conceito)
  if (!dirs.length) throw new Error('resposta sem direções utilizáveis')
  return dirs
}

// ---------------------------------------------------------------------------
// Runners por provider — todos devolvem o MESMO formato.
// Aceitam N imagens de referência (as vision models veem direto). Arquivos que
// os modelos não leem uniformemente (PDF/vídeo/áudio/doc) são pré-processados
// pelo Gemini num RESUMO de texto (refDigest) que entra pra todos.
// ---------------------------------------------------------------------------
export interface CreativeImage { dataUrl: string; mimeType: string }
export interface CreativeFile { name: string; dataUrl: string; mimeType: string }
const IMG_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const validImg = (i?: CreativeImage): i is CreativeImage => !!i && IMG_TYPES.includes(i.mimeType) && i.dataUrl.includes(',')

// separa anexos: imagens (vão diretas) x resto (viram texto via Gemini)
function splitFiles(files?: CreativeFile[]): { images: CreativeImage[]; others: CreativeFile[] } {
  const images: CreativeImage[] = [], others: CreativeFile[] = []
  for (const f of files || []) {
    if (!f.dataUrl?.includes(',')) continue
    if (IMG_TYPES.includes(f.mimeType)) images.push({ dataUrl: f.dataUrl, mimeType: f.mimeType })
    else others.push(f)
  }
  return { images, others }
}

// lê PDFs/vídeos/áudios/docs pelo Gemini (multimodal) e devolve um resumo do
// conteúdo relevante — o que alimenta os modelos que não leem esses formatos.
async function extractRefDigest(others: CreativeFile[]): Promise<string> {
  if (!others.length) return ''
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' })
    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = []
    for (const f of others) {
      const b64 = f.dataUrl.split(',')[1]
      if (b64) parts.push({ inlineData: { mimeType: f.mimeType, data: b64 } })
    }
    parts.push({ text: 'Você assiste um diretor criativo. Descreva em português, de forma compacta e útil, o CONTEÚDO RELEVANTE destas referências anexadas (PDFs, vídeos, docs, áudios) para embasar direções criativas de vídeo: tema, dados/mensagens-chave, tom, elementos visuais e narrativos. Sem enrolação, só o que serve de matéria-prima.' })
    const res = await ai.models.generateContent({ model: GEMINI_MODEL, contents: [{ parts }] })
    const meta = res.usageMetadata
    logUsage('creative-refs', GEMINI_MODEL, meta?.promptTokenCount ?? 0, meta?.candidatesTokenCount ?? 0)
    return (res.text || '').trim()
  } catch { return '' }
}

async function runSonnet(system: string, user: string, model: string, images: CreativeImage[]): Promise<CreativeDirection[]> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })
  const content: Anthropic.ContentBlockParam[] = []
  for (const img of images) content.push({
    type: 'image',
    source: { type: 'base64', media_type: img.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: img.dataUrl.split(',')[1] },
  })
  content.push({ type: 'text', text: user })
  const res = await client.messages.create({
    model, max_tokens: 2000, system,
    messages: [{ role: 'user', content }],
  })
  logUsage('creative-direction', model, res.usage.input_tokens, res.usage.output_tokens)
  const text = res.content.find(b => b.type === 'text')?.text ?? ''
  return parseDirections(text)
}

async function runGemini(system: string, user: string, model: string, images: CreativeImage[]): Promise<CreativeDirection[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' })
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = []
  for (const img of images) parts.push({ inlineData: { mimeType: img.mimeType, data: img.dataUrl.split(',')[1] } })
  parts.push({ text: user })
  const res = await ai.models.generateContent({
    model,
    contents: [{ parts }],
    config: { systemInstruction: system, responseMimeType: 'application/json' },
  })
  const meta = res.usageMetadata
  logUsage('creative-direction', model, meta?.promptTokenCount ?? 0, meta?.candidatesTokenCount ?? 0)
  return parseDirections(res.text ?? '')
}

// GPT e Grok: endpoint compatível-OpenAI (chat/completions), só muda base URL.
async function runOpenAICompat(
  system: string, user: string, model: string, apiKey: string, baseUrl: string, tag: string, images: CreativeImage[]
): Promise<CreativeDirection[]> {
  const userContent: unknown = images.length
    ? [...images.map(img => ({ type: 'image_url', image_url: { url: img.dataUrl } })), { type: 'text', text: user }]
    : user
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    // sem temperature custom: os modelos GPT-5 (reasoning) só aceitam o default;
    // Grok usa o dele. json_object garante saída parseável em ambos.
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: userContent }],
      response_format: { type: 'json_object' },
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`${res.status} ${body.slice(0, 200)}`)
  }
  const data = await res.json()
  const usage = data.usage || {}
  logUsage('creative-direction', model, usage.prompt_tokens ?? 0, usage.completion_tokens ?? 0)
  const text = data.choices?.[0]?.message?.content ?? ''
  if (!text) throw new Error(`${tag}: resposta vazia`)
  return parseDirections(text)
}

async function runProvider(p: ProviderMeta, system: string, user: string, images: CreativeImage[] = []): Promise<ProviderResult> {
  const base: ProviderResult = { provider: p.id, label: p.label, model: p.model, ok: false }
  if (!p.hasKey) {
    return { ...base, pending: true, error: `Chave ${p.keyEnv} não configurada` }
  }
  const started = Date.now()
  try {
    let directions: CreativeDirection[]
    if (p.id === 'sonnet') directions = await runSonnet(system, user, p.model, images)
    else if (p.id === 'gemini') directions = await runGemini(system, user, p.model, images)
    else if (p.id === 'gpt') directions = await runOpenAICompat(system, user, p.model, process.env.OPENAI_API_KEY || '', 'https://api.openai.com/v1', 'GPT', images)
    else directions = await runOpenAICompat(system, user, p.model, process.env.XAI_API_KEY || '', 'https://api.x.ai/v1', 'Grok', images)
    return { ...base, ok: true, directions, ms: Date.now() - started }
  } catch (err) {
    return { ...base, error: err instanceof Error ? err.message : 'erro desconhecido', ms: Date.now() - started }
  }
}

// Roda os providers selecionados (ou todos) em paralelo. Um que falha não
// derruba os outros — cada um volta com seu ok/erro. (usado pela ARENA)
export async function runArena(idea: string, clientId?: string, only?: ProviderId[]): Promise<ProviderResult[]> {
  const { system, user } = buildPrompt(idea, clientId)
  const list = providers().filter(p => !only || only.includes(p.id))
  return Promise.all(list.map(p => runProvider(p, system, user)))
}

// Hierarquia de decisão do modelo (seção 3): padrão calibrado do cliente →
// fallback global. É o que a DIREÇÃO CRIATIVA usa — 1 modelo, sem perguntar.
export function resolveProvider(clientId?: string): { provider: ProviderId; source: 'cliente' | 'fallback' } {
  const avail = new Set(providers().map(p => p.id))
  if (clientId) {
    const c = getClient(clientId)
    // ignora calibração antiga que apontava pra sonnet/gemini (já removidos)
    if (c?.creativeDefault && avail.has(c.creativeDefault)) return { provider: c.creativeDefault, source: 'cliente' }
  }
  return { provider: CREATIVE_FALLBACK, source: 'fallback' }
}

// Direção Criativa: gera as 2-3 direções com UM modelo só (o resolvido acima).
export async function runDirection(idea: string, clientId?: string, files?: CreativeFile[]): Promise<ProviderResult & { source: 'cliente' | 'fallback' }> {
  const { provider, source } = resolveProvider(clientId)
  const { images, others } = splitFiles(files)
  const refDigest = await extractRefDigest(others)
  const { system, user } = buildPrompt(idea, clientId, refDigest, images.length > 0)
  const meta = providers().find(p => p.id === provider)!
  const r = await runProvider(meta, system, user, images)
  return { ...r, source }
}

// ---------------------------------------------------------------------------
// ARENA POR SLOTS (papéis fixos, não 3 direções livres parecidas).
// Slot 1 "padrao": a direção segura/esperada.
// Slot 2 "repertorio": inspirada em TENDÊNCIAS atuais (busca na web, descritas
//   em palavras — nunca clonar peça específica).
// Slot 3 "aberto": só se o operador der uma inspiração própria.
// ---------------------------------------------------------------------------

// Busca de tendências: uma vez por rodada (o sistema busca), com a web search
// nativa do Claude. Devolve os PADRÕES observados em palavras (guardrail: sem
// citar/clonar peça específica). Falha silenciosa → repertório sem digest.
async function fetchTrendDigest(idea: string): Promise<string> {
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })
    const res = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1200,
      // web search nativa (server tool) — confirmada disponível nesta conta
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }] as unknown as Anthropic.Messages.ToolUnion[],
      messages: [{
        role: 'user',
        content: `Busque na web TENDÊNCIAS visuais ATUAIS (2026) de vídeo/motion/design relacionadas a: "${idea}". Olhe fontes como Pinterest, Dribbble, Behance, Awwwards, Cosmos e afins. Em português, descreva EM SUAS PALAVRAS 3-5 PADRÕES/tendências recorrentes (paleta, tipografia, motion, edição, mood). GUARDRAIL: não cite, não reproduza nem clone nenhuma peça específica encontrada — só o padrão observado. Curto e direto, sem links.`,
      }],
    })
    logUsage('arena-trends', CLAUDE_MODEL, res.usage.input_tokens, res.usage.output_tokens)
    return res.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('\n').trim()
  } catch {
    return ''
  }
}

function buildSlotPrompt(idea: string, clientId: string | undefined, digest: string, aberto?: string, link?: string, hasImage?: boolean, refDigest?: string): { system: string; user: string } {
  const { catalog, clientCtx } = buildContext(clientId)
  const hasAberto = !!aberto?.trim()
  const refNote = [
    hasImage ? 'O operador anexou IMAGEM(NS) de referência — leia o estilo/mood e ancore as direções (sobretudo o "aberto", se houver) nesse visual.' : '',
    link?.trim() ? `O operador passou um LINK de referência: ${link.trim()} — considere o estilo/conteúdo dele como norte.` : '',
    refDigest ? `CONTEÚDO DAS REFERÊNCIAS ANEXADAS (PDF/vídeo/doc lidos):\n${refDigest}` : '',
  ].filter(Boolean).join('\n')

  const system = `Você é um DIRETOR CRIATIVO sênior de um estúdio premium de vídeo com IA (Google Flow / Gemini Omni Flash). Recebe uma FAÍSCA e devolve direções por SLOT — cada slot com um PAPEL bem diferente. NÃO faça variações parecidas: cada slot ataca de um jeito distinto.

SLOTS a preencher:
- "padrao": a direção SEGURA/esperada — sólida, comercial, o feijão-com-arroz bem feito pra este pedido.
- "repertorio": uma direção ORIGINAL puxada das TENDÊNCIAS atuais (abaixo). Use os padrões como matéria-prima e proponha algo novo e mais ousado, com a cara do que está EM ALTA agora. GUARDRAIL: nunca clone nem cite uma peça específica — só o padrão/tendência.${hasAberto ? '\n- "aberto": uma direção que PARTE da inspiração do operador (abaixo), desenvolvendo a ideia dele.' : ''}

Gere EXATAMENTE 1 direção por slot pedido${hasAberto ? ' (3 no total)' : ' (2 no total: padrao e repertorio)'}. Cada direção: conceito (1-2 frases afiadas), tom, referencia (cultural/metáfora), blocos (2-5 termos da biblioteca), e o campo "slot".

BIBLIOTECA DE BLOCOS: ${catalog || '(vazio)'}${clientCtx}

TENDÊNCIAS ATUAIS (matéria-prima do slot "repertorio"):
${digest || '(busca de tendências indisponível agora — use seu conhecimento do que está em alta em 2026)'}${hasAberto ? `\n\nINSPIRAÇÃO DO OPERADOR (matéria-prima do slot "aberto"):\n${aberto!.trim()}` : ''}

Responda SOMENTE JSON: {"directions":[{"slot":"padrao|repertorio${hasAberto ? '|aberto' : ''}","conceito":"...","tom":"...","referencia":"...","blocos":["..."]}]}`

  const user = `FAÍSCA / IDEIA CRUA:\n${idea.trim()}${refNote ? `\n\nREFERÊNCIA DO OPERADOR:\n${refNote}` : ''}`
  return { system, user }
}

export async function runArenaSlots(
  idea: string, clientId?: string, aberto?: string, only?: ProviderId[],
  files?: CreativeFile[], link?: string,
): Promise<{ results: ProviderResult[]; trendsOk: boolean }> {
  const { images, others } = splitFiles(files)
  const [digest, refDigest] = await Promise.all([
    fetchTrendDigest(idea),      // busca de tendências (compartilhada)
    extractRefDigest(others),    // lê PDF/vídeo/doc anexados
  ])
  const { system, user } = buildSlotPrompt(idea, clientId, digest, aberto, link, images.length > 0, refDigest)
  const list = providers().filter(p => !only || only.includes(p.id))
  const results = await Promise.all(list.map(p => runProvider(p, system, user, images)))
  return { results, trendsOk: !!digest }
}

// ---------------------------------------------------------------------------
// COMITÊ AUTOMÁTICO (multi-agent debate) — usado pela "Direção Criativa".
// 3 rodadas: (1) cada modelo propõe 1 direção; (2) todos leem as propostas,
// criticam e VOTAM; (3) o presidente (modelo calibrado do cliente, ou fallback)
// consolida UM consenso final + a justificativa. Saída = 1 direção pronta pro
// chat, sem o operador precisar comparar na mão. Pra "quando eu tiver pressa".
// ---------------------------------------------------------------------------

export interface DebateVoice { provider: ProviderId; label: string; text: string; ok: boolean; error?: string }
export interface DebateFinal { conceito: string; tom: string; referencia: string; blocos: string[]; justificativa: string }
export interface DebateTally { provider: ProviderId; label: string; votes: number }
export interface DebateResult {
  ok: boolean
  error?: string
  proposals: DebateVoice[]
  critiques: DebateVoice[]
  final?: DebateFinal
  chairLabel?: string
  tally?: DebateTally[]
}

// Chamada de TEXTO livre por provider, com 1 retry (503/"high demand" do Gemini
// e picos transitórios costumam passar na 2ª tentativa).
async function callText(p: ProviderMeta, system: string, user: string): Promise<string> {
  try { return await callTextOnce(p, system, user) }
  catch {
    await new Promise(r => setTimeout(r, 1500))
    return await callTextOnce(p, system, user)
  }
}

// Chamada de TEXTO livre por provider (sem parse de JSON de direções). Os 4
// modelos, mesma interface — reaproveita chaves/SDKs já no projeto.
async function callTextOnce(p: ProviderMeta, system: string, user: string): Promise<string> {
  if (p.id === 'sonnet') {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })
    const res = await client.messages.create({ model: p.model, max_tokens: 1500, system, messages: [{ role: 'user', content: user }] })
    logUsage('debate', p.model, res.usage.input_tokens, res.usage.output_tokens)
    return res.content.find(b => b.type === 'text')?.text ?? ''
  }
  if (p.id === 'gemini') {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' })
    const res = await ai.models.generateContent({ model: p.model, contents: [{ parts: [{ text: user }] }], config: { systemInstruction: system } })
    const meta = res.usageMetadata
    logUsage('debate', p.model, meta?.promptTokenCount ?? 0, meta?.candidatesTokenCount ?? 0)
    const text = res.text ?? ''
    if (!text.trim()) throw new Error('Gemini devolveu vazio')
    return text
  }
  const apiKey = p.id === 'gpt' ? (process.env.OPENAI_API_KEY || '') : (process.env.XAI_API_KEY || '')
  const baseUrl = p.id === 'gpt' ? 'https://api.openai.com/v1' : 'https://api.x.ai/v1'
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: p.model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
  })
  if (!res.ok) throw new Error(`${res.status} ${(await res.text().catch(() => '')).slice(0, 150)}`)
  const data = await res.json()
  const usage = data.usage || {}
  logUsage('debate', p.model, usage.prompt_tokens ?? 0, usage.completion_tokens ?? 0)
  return data.choices?.[0]?.message?.content ?? ''
}

export async function runDebate(idea: string, clientId?: string, files?: CreativeFile[]): Promise<DebateResult> {
  const active = providers().filter(p => p.hasKey)
  if (active.length < 2) return { ok: false, error: 'Preciso de pelo menos 2 modelos com chave configurada pro comitê.', proposals: [], critiques: [] }

  const digest = await extractRefDigest(files || []) // refs (inclui imagens) → texto compartilhado
  const { catalog, clientCtx } = buildContext(clientId)
  const brief = `FAÍSCA / PEDIDO:\n${idea.trim()}${digest ? `\n\nREFERÊNCIAS ANEXADAS (resumo):\n${digest}` : ''}${clientCtx}`

  // Rodada 1 — cada modelo propõe UMA direção (paralelo)
  const proposeSystem = `Você é um diretor criativo sênior de um estúdio premium de vídeo com IA (Google Flow / Gemini Omni Flash). Recebe uma FAÍSCA e propõe UMA direção criativa forte, específica e AUTORAL — nada de genérico ("moderno e bonito" é proibido). Responda EXATAMENTE em 3 linhas:
Conceito: <a aposta central, o que a torna especial, 1-2 frases afiadas>
Tom: <clima emocional/estético>
Referência: <referência cultural, filme, campanha ou metáfora concreta>
PT-BR, linguagem de quem dirige set. Sem títulos extras, sem enrolação.`
  const proposals = await Promise.all(active.map(async (p): Promise<DebateVoice> => {
    try { return { provider: p.id, label: p.label, text: (await callText(p, proposeSystem, brief)).trim(), ok: true } }
    catch (e) { return { provider: p.id, label: p.label, text: '', ok: false, error: e instanceof Error ? e.message : 'erro' } }
  }))
  const good = proposals.filter(p => p.ok && p.text)
  if (good.length < 2) return { ok: false, error: 'O comitê não conseguiu propostas suficientes (verifique as chaves dos modelos).', proposals, critiques: [] }
  const proposalsBlock = good.map(p => `[${p.label}]\n${p.text}`).join('\n\n')

  // Rodada 2 — debate + voto (paralelo)
  const debateSystem = `Você é um diretor criativo sênior num COMITÊ com outros diretores. Abaixo estão as PROPOSTAS de todos (a sua inclusa). Debata de forma honesta e afiada: em no máximo 4 linhas, aponte a maior FORÇA e a maior FRAQUEZA das propostas mais relevantes pra ESTE pedido. Depois escolha a MELHOR direção pra este pedido (só vote na sua se for de fato a melhor — seja honesto) e justifique em 1 frase. Termine com uma última linha EXATAMENTE neste formato:
VOTO: <nome do diretor da proposta escolhida>
onde <nome> é um de: ${good.map(p => p.label).join(', ')}. PT-BR, direto.`
  const critiques = await Promise.all(good.map(async (gv): Promise<DebateVoice> => {
    const p = active.find(a => a.id === gv.provider)!
    try { return { provider: p.id, label: p.label, text: (await callText(p, debateSystem, `${brief}\n\nPROPOSTAS DO COMITÊ:\n${proposalsBlock}`)).trim(), ok: true } }
    catch (e) { return { provider: p.id, label: p.label, text: '', ok: false, error: e instanceof Error ? e.message : 'erro' } }
  }))

  // tally de votos (best-effort, da última linha VOTO:)
  const tally: DebateTally[] = good.map(p => ({ provider: p.provider, label: p.label, votes: 0 }))
  for (const c of critiques) {
    if (!c.ok) continue
    const m = c.text.match(/VOTO:\s*(.+)\s*$/im)
    if (!m) continue
    const voted = m[1].trim().toLowerCase()
    const hit = tally.find(t => voted.includes(t.label.toLowerCase()) || voted.includes(t.provider))
    if (hit) hit.votes++
  }

  // Rodada 3 — presidente consolida (modelo calibrado do cliente, ou fallback)
  const { provider: chairId } = resolveProvider(clientId)
  const chair = active.find(p => p.id === chairId) || active[0]
  const critiquesBlock = critiques.filter(c => c.ok).map(c => `[${c.label}]\n${c.text}`).join('\n\n')
  const chairSystem = `Você é o DIRETOR-CHEFE do estúdio. Leu as PROPOSTAS e o DEBATE (com votos) do comitê. Consolide UMA direção criativa final pra este pedido — pode ser a proposta vencedora pura, ou uma SÍNTESE que pega o melhor de cada. Seja decisivo.
Responda SOMENTE JSON válido:
{"conceito":"...","tom":"...","referencia":"...","blocos":["termos da biblioteca que servem de blocos de construção"],"justificativa":"por que ESTA direção venceu, resumindo o consenso do comitê em 2-3 frases"}
BIBLIOTECA DE BLOCOS: ${catalog || '(vazio)'}${clientCtx}`
  let final: DebateFinal | undefined
  try {
    const raw = await callText(chair, chairSystem, `${brief}\n\nPROPOSTAS:\n${proposalsBlock}\n\nDEBATE E VOTOS:\n${critiquesBlock}`)
    const o = JSON.parse(extractJson(raw)) as { conceito?: string; tom?: string; referencia?: string; blocos?: unknown; justificativa?: string }
    const f: DebateFinal = {
      conceito: String(o.conceito || '').trim(),
      tom: String(o.tom || '').trim(),
      referencia: String(o.referencia || '').trim(),
      blocos: Array.isArray(o.blocos) ? o.blocos.map(String).filter(Boolean).slice(0, 6) : [],
      justificativa: String(o.justificativa || '').trim(),
    }
    if (f.conceito) final = f
  } catch { /* final fica indefinido → erro amigável abaixo */ }

  return {
    ok: !!final,
    error: final ? undefined : 'O presidente não conseguiu consolidar o consenso — tente de novo.',
    proposals, critiques, final, chairLabel: chair.label,
    tally: tally.sort((a, b) => b.votes - a.votes),
  }
}
