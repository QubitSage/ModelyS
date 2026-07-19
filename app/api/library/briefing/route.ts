import Anthropic from '@anthropic-ai/sdk'
import { listTerms } from '@/lib/store'
import { logUsage } from '@/lib/costlog'
import { HAIKU_MODEL } from '@/lib/ai'

// Analisador de briefing: cola o briefing bagunçado do cliente e recebe 4-6
// direções de estilo — termos já catalogados + ideias novas.

export const maxDuration = 60

const SCHEMA = {
  type: 'object',
  properties: {
    resumo: { type: 'string', description: 'Leitura do briefing em 2 frases: o que o cliente quer de verdade' },
    sugestoes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          titulo: { type: 'string' },
          porque: { type: 'string', description: 'por que combina com ESTE briefing, 1 frase' },
          termIds: { type: 'array', items: { type: 'string' }, description: 'ids de termos do catálogo usados nesta direção' },
          novoTermo: {
            type: 'object',
            description: 'preencher só se a direção usa um estilo que NÃO está no catálogo',
            properties: {
              termo: { type: 'string' },
              explicacao: { type: 'string' },
              promptExemplo: { type: 'string' },
            },
            required: ['termo', 'explicacao', 'promptExemplo'],
            additionalProperties: false,
          },
        },
        required: ['titulo', 'porque', 'termIds'],
        additionalProperties: false,
      },
    },
  },
  required: ['resumo', 'sugestoes'],
  additionalProperties: false,
}

const CLAUDE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

export async function POST(request: Request) {
  const { briefing, image } = (await request.json()) as {
    briefing?: string
    image?: { dataUrl: string; mimeType: string }
  }
  const hasImage = !!(image?.dataUrl && CLAUDE_IMAGE_TYPES.includes(image.mimeType) && image.dataUrl.includes(','))
  if (!briefing?.trim() && !hasImage) return Response.json({ error: 'briefing vazio' }, { status: 400 })

  const index = listTerms()
    .map(t => `${t.id} | ${t.termo} (${t.categoria}) — ${t.explicacao.slice(0, 100)}`)
    .join('\n')

  const system = `Você é diretor criativo de um estúdio premium de vídeo com IA. Recebe briefings bagunçados de cliente e devolve 4-6 direções de estilo CONCRETAS para compor o vídeo, misturando termos do catálogo abaixo (cite os ids) e, quando fizer sentido, 1-2 ideias de estilo ainda não catalogadas (campo novoTermo).

Regras: nada de "moderno e bonito" genérico — cada direção nomeia linguagem visual específica. Cubra espectro: pelo menos uma direção segura e uma ousada. Português simples.

Quando vier uma IMAGEM de referência ("quero algo nesse estilo"), leia o visual dela (paleta, textura, luz, enquadramento, mood) e ancore as direções nesse look — citando os termos do catálogo que reproduzem o que a imagem mostra.

CATÁLOGO:
${index}`

  const userContent: Anthropic.ContentBlockParam[] = []
  if (hasImage) {
    userContent.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: image!.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
        data: image!.dataUrl.split(',')[1],
      },
    })
  }
  userContent.push({
    type: 'text',
    text: `BRIEFING DO CLIENTE:\n${briefing?.trim() || '(sem texto — use a imagem de referência anexada como direção visual)'}`,
  })

  const client = new Anthropic()
  const response = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 1500,
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: userContent }],
  })

  logUsage('library-briefing', HAIKU_MODEL, response.usage.input_tokens, response.usage.output_tokens)

  const text = response.content.find(b => b.type === 'text')?.text ?? '{}'
  try {
    return Response.json(JSON.parse(text))
  } catch {
    return Response.json({ resumo: text, sugestoes: [] })
  }
}
